/**
 * Google Drive Service for XNote Extension
 * Handles authentication, file operations, and sync with Google Drive
 */

import { getStoredValue, storeValue, STORAGE_KEYS } from './storageService';

class GoogleDriveService {
  constructor() {
    this.baseUrl = 'https://www.googleapis.com/drive/v3';
    this.uploadUrl = 'https://www.googleapis.com/upload/drive/v3';
    this.rootFolderId = null;
    // Remove token caching - will get fresh token for each request
  }

  /**
   * Execute API request with automatic retry on 401
   * @param {Function} requestFunc - Function that makes the API request
   * @param {boolean} canRetry - Whether to retry on 401 (default: true)
   * @returns {Promise<Response>}
   */
  async executeWithRetry(requestFunc, canRetry = true) {
    const response = await requestFunc();

    // If we get a 401 and can retry, try once more with a fresh token
    if (response.status === 401 && canRetry) {
      console.log('Got 401, attempting to refresh token and retry...');

      // Clear the cached token by removing it
      const token = await this.getValidToken();
      if (token) {
        chrome.identity.removeCachedAuthToken({ token }, async () => {
          console.log('Cleared cached token, getting new one...');
        });
      }

      // Wait a bit for the cache to clear
      await new Promise(resolve => setTimeout(resolve, 100));

      // Retry the request once
      return await requestFunc();
    }

    return response;
  }

  /**
   * Get a valid access token from Chrome Identity API
   * @returns {Promise<string|null>} Access token or null
   */
  async getValidToken() {
    return new Promise((resolve) => {
      if (typeof chrome === 'undefined' || !chrome.identity) {
        console.warn('Chrome Identity API not available');
        resolve(null);
        return;
      }

      // Always get a fresh token - Chrome handles refresh automatically
      chrome.identity.getAuthToken({ interactive: false }, (token) => {
        if (chrome.runtime.lastError) {
          console.error('Token error:', chrome.runtime.lastError);
          resolve(null);
          return;
        }
        resolve(token);
      });
    });
  }

  /**
   * Authenticate with Google Drive using Chrome Identity API
   * @returns {Promise<boolean>} Success status
   */
  async authenticate() {
    return new Promise((resolve) => {
      if (typeof chrome === 'undefined' || !chrome.identity) {
        console.warn('Chrome Identity API not available');
        resolve(false);
        return;
      }

      // Use interactive: true for initial authentication
      chrome.identity.getAuthToken({ interactive: true }, async (token) => {
        if (chrome.runtime.lastError) {
          console.error('Authentication error:', chrome.runtime.lastError);
          resolve(false);
          return;
        }

        if (token) {
          // Store connection status (no longer storing token)
          await storeValue(STORAGE_KEYS.GOOGLE_DRIVE_CONNECTED, true);

          // Initialize folder structure
          await this.initializeFolderStructure();

          resolve(true);
        } else {
          resolve(false);
        }
      });
    });
  }

  /**
   * Disconnect from Google Drive
   * @returns {Promise<void>}
   */
  async disconnect() {
    // Get current token to revoke it
    const token = await this.getValidToken();
    if (token && typeof chrome !== 'undefined' && chrome.identity) {
      chrome.identity.removeCachedAuthToken({ token: token }, () => {
        chrome.identity.revokeAuthToken({ token: token }, () => {
          console.log('Token revoked');
        });
      });
    }

    this.rootFolderId = null;

    // Clear storage
    await storeValue(STORAGE_KEYS.GOOGLE_DRIVE_CONNECTED, false);
    await storeValue(STORAGE_KEYS.GOOGLE_DRIVE_FOLDER_ID, null);
    await storeValue(STORAGE_KEYS.GOOGLE_DRIVE_SYNC_ENABLED, false);
    await storeValue(STORAGE_KEYS.GOOGLE_DRIVE_LAST_SYNC, null);
  }

  /**
   * Check if authenticated
   * @returns {Promise<boolean>}
   */
  async isAuthenticated() {
    // Always check for a valid token
    const token = await this.getValidToken();
    return !!token;
  }

  /**
   * Initialize folder structure in Google Drive
   * @returns {Promise<void>}
   */
  async initializeFolderStructure() {
    try {
      // Check if we already have a root folder ID
      const storedFolderId = await getStoredValue(STORAGE_KEYS.GOOGLE_DRIVE_FOLDER_ID);

      if (storedFolderId) {
        // Verify the folder still exists
        const exists = await this.checkFileExists(storedFolderId);
        if (exists) {
          this.rootFolderId = storedFolderId;
          return;
        }
      }

      // Create root folder
      this.rootFolderId = await this.createFolder('XNote', null);
      await storeValue(STORAGE_KEYS.GOOGLE_DRIVE_FOLDER_ID, this.rootFolderId);

      // Create subfolders
      await this.createFolder('chats', this.rootFolderId);
      await this.createFolder('summaries', this.rootFolderId);
      await this.createFolder('translations', this.rootFolderId);
      await this.createFolder('todos', this.rootFolderId);
    } catch (error) {
      console.error('Error initializing folder structure:', error);
    }
  }

  /**
   * Create a folder in Google Drive
   * @param {string} name - Folder name
   * @param {string} parentId - Parent folder ID (optional)
   * @returns {Promise<string>} Folder ID
   */
  async createFolder(name, parentId = null) {
    const metadata = {
      name: name,
      mimeType: 'application/vnd.google-apps.folder'
    };

    if (parentId) {
      metadata.parents = [parentId];
    }

    const response = await this.executeWithRetry(async () => {
      const token = await this.getValidToken();
      if (!token) {
        throw new Error('Failed to get authentication token');
      }

      return await fetch(`${this.baseUrl}/files`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(metadata)
      });
    });

    if (!response.ok) {
      throw new Error(`Failed to create folder: ${response.statusText}`);
    }

    const data = await response.json();
    return data.id;
  }

  /**
   * Get or create a folder by path
   * @param {string} path - Path like "chats" or "summaries"
   * @returns {Promise<string>} Folder ID
   */
  async getOrCreateFolder(path) {
    if (!this.rootFolderId) {
      await this.initializeFolderStructure();
    }

    // Search for existing folder
    const query = `name='${path}' and '${this.rootFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;

    const response = await this.executeWithRetry(async () => {
      const token = await this.getValidToken();
      if (!token) {
        throw new Error('Failed to get authentication token');
      }

      return await fetch(`${this.baseUrl}/files?q=${encodeURIComponent(query)}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
    });

    const data = await response.json();

    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }

    // Create if doesn't exist
    return await this.createFolder(path, this.rootFolderId);
  }

  /**
   * Create or update a file in Google Drive
   * @param {string} name - File name
   * @param {string} content - File content
   * @param {string} folderId - Parent folder ID
   * @returns {Promise<string>} File ID
   */
  async createFile(name, content, folderId) {
    // Check if file already exists
    const existingFileId = await this.findFile(name, folderId);

    if (existingFileId) {
      return await this.updateFile(existingFileId, content);
    }

    const token = await this.getValidToken();
    if (!token) {
      throw new Error('Failed to get authentication token');
    }

    // Create new file
    const metadata = {
      name: name,
      parents: [folderId],
      mimeType: 'text/markdown'
    };

    const formData = new FormData();
    formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    formData.append('file', new Blob([content], { type: 'text/markdown' }));

    const response = await fetch(`${this.uploadUrl}/files?uploadType=multipart`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Failed to create file: ${response.statusText}`);
    }

    const data = await response.json();
    return data.id;
  }

  /**
   * Update an existing file
   * @param {string} fileId - File ID
   * @param {string} content - New content
   * @returns {Promise<string>} File ID
   */
  async updateFile(fileId, content) {
    const token = await this.getValidToken();
    if (!token) {
      throw new Error('Failed to get authentication token');
    }

    const response = await fetch(`${this.uploadUrl}/files/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'text/markdown'
      },
      body: content
    });

    if (!response.ok) {
      throw new Error(`Failed to update file: ${response.statusText}`);
    }

    return fileId;
  }

  /**
   * Get file content
   * @param {string} fileId - File ID
   * @returns {Promise<string>} File content
   */
  async getFile(fileId) {
    const token = await this.getValidToken();
    if (!token) {
      throw new Error('Failed to get authentication token');
    }

    const response = await fetch(`${this.baseUrl}/files/${fileId}?alt=media`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get file: ${response.statusText}`);
    }

    return await response.text();
  }

  /**
   * List files in a folder
   * @param {string} folderId - Folder ID
   * @returns {Promise<Array>} List of files
   */
  async listFiles(folderId) {
    const token = await this.getValidToken();
    if (!token) {
      throw new Error('Failed to get authentication token');
    }

    const query = `'${folderId}' in parents and trashed=false`;

    const response = await fetch(`${this.baseUrl}/files?q=${encodeURIComponent(query)}&fields=files(id,name,modifiedTime,size)`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to list files: ${response.statusText}`);
    }

    const data = await response.json();
    return data.files || [];
  }

  /**
   * Delete a file
   * @param {string} fileId - File ID
   * @returns {Promise<void>}
   */
  async deleteFile(fileId) {
    const token = await this.getValidToken();
    if (!token) {
      throw new Error('Failed to get authentication token');
    }

    const response = await fetch(`${this.baseUrl}/files/${fileId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to delete file: ${response.statusText}`);
    }
  }

  /**
   * Find a file by name in a folder
   * @param {string} name - File name
   * @param {string} folderId - Folder ID
   * @returns {Promise<string|null>} File ID or null
   */
  async findFile(name, folderId) {
    const token = await this.getValidToken();
    if (!token) {
      throw new Error('Failed to get authentication token');
    }

    const query = `name='${name}' and '${folderId}' in parents and trashed=false`;

    const response = await fetch(`${this.baseUrl}/files?q=${encodeURIComponent(query)}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }

    return null;
  }

  /**
   * Check if a file exists
   * @param {string} fileId - File ID
   * @returns {Promise<boolean>}
   */
  async checkFileExists(fileId) {
    try {
      const token = await this.getValidToken();
      if (!token) {
        return false;
      }

      const response = await fetch(`${this.baseUrl}/files/${fileId}?fields=id`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Export content to Google Drive
   * @param {string} type - Content type (chat, summary, translation, todo)
   * @param {Object} data - Content data
   * @returns {Promise<string>} File ID
   */
  async exportContent(type, data) {
    if (!await this.isAuthenticated()) {
      throw new Error('Not authenticated');
    }

    const folderId = await this.getOrCreateFolder(`${type}s`);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);

    let fileName, content;

    switch (type) {
      case 'chat':
        fileName = `chat_${timestamp}.md`;
        content = this.formatChatAsMarkdown(data);
        break;
      case 'summary':
        fileName = `summary_${this.sanitizeFilename(data.title)}_${timestamp}.md`;
        content = this.formatSummaryAsMarkdown(data);
        break;
      case 'translation':
        fileName = `translation_${timestamp}.md`;
        content = this.formatTranslationAsMarkdown(data);
        break;
      case 'todo':
        fileName = `todos_${timestamp}.md`;
        content = this.formatTodoAsMarkdown(data);
        break;
      default:
        throw new Error(`Unknown content type: ${type}`);
    }

    return await this.createFile(fileName, content, folderId);
  }

  /**
   * Get or create folder in specific parent
   * @param {string} folderName - Folder name
   * @param {string} parentId - Parent folder ID
   * @returns {Promise<string>} Folder ID
   */
  async getOrCreateFolderInParent(folderName, parentId) {
    const query = `name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;

    const response = await this.executeWithRetry(async () => {
      const token = await this.getValidToken();
      if (!token) {
        throw new Error('Failed to get authentication token');
      }

      return await fetch(`${this.baseUrl}/files?q=${encodeURIComponent(query)}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
    });

    const data = await response.json();

    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }

    // Create if doesn't exist
    return await this.createFolder(folderName, parentId);
  }

  /**
   * Export summary with two-level folder organization
   * @param {Object} data - Summary data
   * @param {string} mainCategory - Main category folder
   * @param {string} subCategory - Subcategory folder
   * @returns {Promise<{fileId: string, folderId: string}>}
   */
  async exportSummaryToCategory(data, mainCategory, subCategory) {
    if (!await this.isAuthenticated()) {
      throw new Error('Not authenticated');
    }

    // Create folder hierarchy: summaries/MainCategory/SubCategory/
    const summariesFolder = await this.getOrCreateFolder('summaries');
    const mainFolder = await this.getOrCreateFolderInParent(mainCategory, summariesFolder);
    const subFolder = await this.getOrCreateFolderInParent(subCategory, mainFolder);

    // Create semantic filename without hash
    const sanitizedTitle = this.sanitizeFilename(data.title);
    const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const fileName = `${sanitizedTitle}_${dateStr}.md`;

    // Check if file exists for this URL (for updates)
    const existingFileId = data.existingFileId;

    if (existingFileId) {
      // Update existing file
      const content = this.formatSummaryAsMarkdown(data);
      await this.updateFile(existingFileId, content);
      return { fileId: existingFileId, folderId: subFolder };
    }

    // Check for duplicate filename in folder
    const existingFile = await this.findFile(fileName, subFolder);
    if (existingFile) {
      // Append timestamp to make unique
      const timestamp = new Date().getTime();
      const uniqueFileName = `${sanitizedTitle}_${dateStr}_${timestamp}.md`;
      const content = this.formatSummaryAsMarkdown(data);
      const fileId = await this.createFile(uniqueFileName, content, subFolder);
      return { fileId, folderId: subFolder };
    }

    // Create new file
    const content = this.formatSummaryAsMarkdown(data);
    const fileId = await this.createFile(fileName, content, subFolder);
    return { fileId, folderId: subFolder };
  }

  /**
   * Format chat messages as Markdown
   * @param {Object} data - Chat data
   * @returns {string} Markdown content
   */
  formatChatAsMarkdown(data) {
    const { messages, chatId } = data;
    const date = new Date().toLocaleString();

    let markdown = `# Chat Session\n`;
    markdown += `**Date:** ${date}\n`;
    markdown += `**Session ID:** ${chatId}\n\n`;
    markdown += `---\n\n`;

    messages.forEach(msg => {
      const role = msg.role === 'user' ? 'User' : 'Assistant';
      markdown += `**${role}:** ${msg.content}\n\n`;
      markdown += `---\n\n`;
    });

    return markdown;
  }

  /**
   * Format summary as Markdown
   * @param {Object} data - Summary data
   * @returns {string} Markdown content
   */
  formatSummaryAsMarkdown(data) {
    const { title, url, content, timestamp } = data;
    const date = timestamp ? new Date(timestamp).toLocaleString() : new Date().toLocaleString();

    let markdown = `# ${title}\n`;
    markdown += `**URL:** ${url}\n`;
    markdown += `**Date:** ${date}\n`;
    markdown += `**Tags:** #summary #xnote\n\n`;
    markdown += `## Summary\n`;
    markdown += `${content}\n`;

    return markdown;
  }

  /**
   * Format translations as Markdown
   * @param {Object} data - Translation data
   * @returns {string} Markdown content
   */
  formatTranslationAsMarkdown(data) {
    const { translations } = data;
    const date = new Date().toLocaleString();

    let markdown = `# Translations\n`;
    markdown += `**Date:** ${date}\n\n`;

    translations.forEach((trans, index) => {
      markdown += `## Translation ${index + 1}\n`;
      markdown += `**From:** ${trans.fromLang}\n`;
      markdown += `**To:** ${trans.toLang}\n`;
      markdown += `**Original:** ${trans.original}\n`;
      markdown += `**Translation:** ${trans.translated}\n\n`;
      markdown += `---\n\n`;
    });

    return markdown;
  }

  /**
   * Format todos as Markdown
   * @param {Object} data - Todo data
   * @returns {string} Markdown content
   */
  formatTodoAsMarkdown(data) {
    const { todos } = data;
    const date = new Date().toLocaleString();

    let markdown = `# Todo List\n`;
    markdown += `**Date:** ${date}\n\n`;
    markdown += `## Tasks\n`;

    todos.forEach(todo => {
      const checkbox = todo.completed ? '[x]' : '[ ]';
      markdown += `- ${checkbox} ${todo.text}\n`;
    });

    return markdown;
  }

  /**
   * Sanitize filename
   * @param {string} name - Original name
   * @returns {string} Sanitized name
   */
  sanitizeFilename(name) {
    return name.replace(/[^a-z0-9]/gi, '_').toLowerCase().slice(0, 50);
  }

  /**
   * Sync all data to Google Drive
   * @returns {Promise<void>}
   */
  async syncAll() {
    if (!await this.isAuthenticated()) {
      throw new Error('Not authenticated');
    }

    // This is a placeholder for full sync functionality
    // In a complete implementation, this would:
    // 1. Get all local data from stores
    // 2. Compare with Drive contents
    // 3. Upload changed files
    // 4. Download remote changes

    await storeValue(STORAGE_KEYS.GOOGLE_DRIVE_LAST_SYNC, new Date().toISOString());
  }
}

// Export singleton instance
export const googleDriveService = new GoogleDriveService();