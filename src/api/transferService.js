/**
 * Transfer Service for XNote Extension
 * Handles file transfer operations between devices via Google Drive
 *
 * Key design decisions:
 * - Device ID stored in localStorage (NOT chrome.storage.sync) for unique per-device identity
 * - Google Drive manifest.json as single source of truth
 * - Text messages stored directly in manifest, files in separate folder
 * - 30-day auto-expiration for transferred items
 */

import { googleDriveService } from './googleDriveService';

// Custom error class for timeout
export class TimeoutError extends Error {
  constructor(message = 'Connection timeout') {
    super(message);
    this.name = 'TimeoutError';
    this.isTimeout = true;
  }
}

/**
 * Fetch with timeout support
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @param {number} timeoutMs - Timeout in milliseconds (default: 15000)
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new TimeoutError('Connection timeout');
    }
    throw error;
  }
}

class TransferService {
  constructor() {
    this.transfersFolderId = null;
    this.filesFolderId = null;
    this.manifestFileId = null;
    this.initialized = false;

    // CRITICAL: Use localStorage for device ID, NOT chrome.storage.sync
    // Each device must have its own unique ID
    this.DEVICE_ID_KEY = 'xnote-transfer-device-id';
    this.DEVICE_NAME_KEY = 'xnote-transfer-device-name';

    // Timeout for network requests (15 seconds)
    this.TIMEOUT_MS = 15000;
  }

  // ============ DEVICE IDENTIFICATION ============

  /**
   * Get or create a unique device ID
   * Uses localStorage to ensure each browser/device has its own ID
   * @returns {string} Device ID
   */
  getDeviceId() {
    let deviceId = localStorage.getItem(this.DEVICE_ID_KEY);
    if (!deviceId) {
      deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem(this.DEVICE_ID_KEY, deviceId);
      console.log('Created new device ID:', deviceId);
    }
    return deviceId;
  }

  /**
   * Get the device name (user-defined or auto-generated)
   * @returns {string} Device name
   */
  getDeviceName() {
    let deviceName = localStorage.getItem(this.DEVICE_NAME_KEY);
    if (!deviceName) {
      // Auto-generate based on platform
      deviceName = this.detectPlatformName();
      localStorage.setItem(this.DEVICE_NAME_KEY, deviceName);
    }
    return deviceName;
  }

  /**
   * Set a custom device name
   * @param {string} name - The new device name
   */
  setDeviceName(name) {
    if (name && name.trim()) {
      localStorage.setItem(this.DEVICE_NAME_KEY, name.trim());
    }
  }

  /**
   * Detect platform and generate a default device name
   * @returns {string} Platform-based device name
   */
  detectPlatformName() {
    const platform = navigator.platform || '';
    const userAgent = navigator.userAgent || '';

    if (platform.includes('Mac') || userAgent.includes('Macintosh')) {
      return 'Mac';
    } else if (platform.includes('Win') || userAgent.includes('Windows')) {
      return 'Windows PC';
    } else if (platform.includes('Linux') || userAgent.includes('Linux')) {
      if (userAgent.includes('Android')) {
        return 'Android';
      }
      return 'Linux';
    } else if (platform.includes('iPhone') || userAgent.includes('iPhone')) {
      return 'iPhone';
    } else if (platform.includes('iPad') || userAgent.includes('iPad')) {
      return 'iPad';
    } else if (userAgent.includes('CrOS')) {
      return 'Chromebook';
    }

    return 'Device';
  }

  // ============ FOLDER MANAGEMENT ============

  /**
   * Initialize transfer folder structure in Google Drive
   * Creates: XNote/transfers/files/
   * @returns {Promise<void>}
   */
  async initializeTransferFolder() {
    if (this.initialized && this.transfersFolderId && this.manifestFileId) {
      return;
    }

    try {
      // Ensure XNote root folder exists
      let rootFolderId = await googleDriveService.getRootFolderId();
      if (!rootFolderId) {
        await googleDriveService.initializeFolderStructure();
        rootFolderId = await googleDriveService.getRootFolderId();
      }

      if (!rootFolderId) {
        throw new Error('Failed to get XNote root folder ID');
      }

      // Get or create transfers folder
      this.transfersFolderId = await googleDriveService.getOrCreateFolderInParent(
        'transfers',
        rootFolderId
      );

      // Get or create files subfolder
      this.filesFolderId = await googleDriveService.getOrCreateFolderInParent(
        'files',
        this.transfersFolderId
      );

      // Initialize manifest
      await this.ensureManifestExists();

      this.initialized = true;
      console.log('Transfer folder initialized:', {
        transfers: this.transfersFolderId,
        files: this.filesFolderId,
        manifest: this.manifestFileId
      });
    } catch (error) {
      console.error('Failed to initialize transfer folder:', error);
      throw error;
    }
  }

  // ============ MANIFEST OPERATIONS ============

  /**
   * Ensure manifest.json exists, create if not
   * @returns {Promise<void>}
   */
  async ensureManifestExists() {
    const manifestId = await googleDriveService.findFile('manifest.json', this.transfersFolderId);

    if (manifestId) {
      this.manifestFileId = manifestId;
    } else {
      // Create empty manifest
      const emptyManifest = {
        version: 1,
        lastUpdated: new Date().toISOString(),
        items: []
      };
      this.manifestFileId = await this.createManifestFile(emptyManifest);
    }
  }

  /**
   * Create manifest file in Drive
   * @param {Object} manifest - Manifest object
   * @returns {Promise<string>} File ID
   */
  async createManifestFile(manifest) {
    const token = await googleDriveService.getValidToken();
    if (!token) {
      throw new Error('Failed to get authentication token');
    }

    const metadata = {
      name: 'manifest.json',
      parents: [this.transfersFolderId],
      mimeType: 'application/json'
    };

    const formData = new FormData();
    formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    formData.append('file', new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' }));

    const response = await fetchWithTimeout(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      },
      this.TIMEOUT_MS
    );

    if (!response.ok) {
      throw new Error(`Failed to create manifest: ${response.statusText}`);
    }

    const data = await response.json();
    return data.id;
  }

  /**
   * Get manifest from Drive (source of truth)
   * @returns {Promise<Object>} Manifest object
   */
  async getManifest() {
    if (!this.manifestFileId) {
      await this.initializeTransferFolder();
    }

    const content = await googleDriveService.getFile(this.manifestFileId);
    return JSON.parse(content);
  }

  /**
   * Update manifest in Drive
   * @param {Object} manifest - Updated manifest
   * @returns {Promise<void>}
   */
  async updateManifest(manifest) {
    manifest.lastUpdated = new Date().toISOString();

    const token = await googleDriveService.getValidToken();
    if (!token) {
      throw new Error('Failed to get authentication token');
    }

    const response = await fetchWithTimeout(
      `https://www.googleapis.com/upload/drive/v3/files/${this.manifestFileId}?uploadType=media`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(manifest, null, 2)
      },
      this.TIMEOUT_MS
    );

    if (!response.ok) {
      throw new Error(`Failed to update manifest: ${response.statusText}`);
    }
  }

  // ============ SEND OPERATIONS ============

  /**
   * Send a text message
   * @param {string} content - Message content
   * @returns {Promise<Object>} Created item
   */
  async sendTextMessage(content) {
    await this.initializeTransferFolder();

    const item = {
      id: `msg_${Date.now()}`,
      type: 'text',
      content: content,
      timestamp: new Date().toISOString(),
      deviceId: this.getDeviceId(),
      deviceName: this.getDeviceName(),
      expiresAt: this.calculateExpiryDate()
    };

    // Add to manifest (text content stored directly in manifest)
    const manifest = await this.getManifest();
    manifest.items.push(item);
    await this.updateManifest(manifest);

    console.log('Text message sent:', item.id);
    return item;
  }

  /**
   * Send a file
   * @param {File} file - File to upload
   * @param {Function} onProgress - Progress callback (0-100)
   * @returns {Promise<Object>} Created item
   */
  async sendFile(file, onProgress) {
    await this.initializeTransferFolder();

    // Validate file size (25MB max)
    const maxSize = 25 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new Error(`File size exceeds 25MB limit. Current size: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
    }

    // Upload file to files/ folder
    const fileName = `${Date.now()}_${file.name}`;
    const driveFileId = await this.uploadFileToDrive(file, fileName, onProgress);

    const item = {
      id: `file_${Date.now()}`,
      type: 'file',
      name: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      timestamp: new Date().toISOString(),
      deviceId: this.getDeviceId(),
      deviceName: this.getDeviceName(),
      driveFileId: driveFileId,
      expiresAt: this.calculateExpiryDate()
    };

    // Add to manifest
    const manifest = await this.getManifest();
    manifest.items.push(item);
    await this.updateManifest(manifest);

    console.log('File sent:', item.id, item.name);
    return item;
  }

  /**
   * Upload file to Google Drive with progress
   * @param {File} file - File to upload
   * @param {string} fileName - Name to use in Drive
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<string>} Drive file ID
   */
  async uploadFileToDrive(file, fileName, onProgress) {
    const token = await googleDriveService.getValidToken();
    if (!token) {
      throw new Error('Failed to get authentication token');
    }

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // Track upload progress
      if (onProgress) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percentComplete = Math.round((event.loaded / event.total) * 100);
            onProgress(percentComplete);
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const response = JSON.parse(xhr.responseText);
          resolve(response.id);
        } else {
          reject(new Error(`Upload failed: ${xhr.statusText}`));
        }
      };

      xhr.onerror = () => reject(new Error('Upload failed: Network error'));

      // Create multipart form data
      const metadata = {
        name: fileName,
        parents: [this.filesFolderId],
        mimeType: file.type || 'application/octet-stream'
      };

      const formData = new FormData();
      formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      formData.append('file', file);

      xhr.open('POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart');
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.send(formData);
    });
  }

  // ============ SYNC OPERATIONS ============

  /**
   * Sync with Drive and get all items
   * @param {string} localLastSyncTime - Last sync timestamp (ISO string)
   * @returns {Promise<Object>} { items, newItems, lastUpdated }
   */
  async sync(localLastSyncTime) {
    await this.initializeTransferFolder();

    // Fetch manifest from Drive (source of truth)
    const manifest = await this.getManifest();

    // Filter items newer than local last sync
    const newItems = manifest.items.filter(item => {
      const itemTime = new Date(item.timestamp).getTime();
      const lastSync = localLastSyncTime ? new Date(localLastSyncTime).getTime() : 0;
      return itemTime > lastSync;
    });

    // Clean up expired items (30 days)
    const now = new Date();
    const activeItems = manifest.items.filter(item => {
      return new Date(item.expiresAt) > now;
    });

    // If items were cleaned up, update manifest
    if (activeItems.length !== manifest.items.length) {
      const expiredItems = manifest.items.filter(item => new Date(item.expiresAt) <= now);
      console.log(`Cleaning up ${expiredItems.length} expired items`);

      await this.cleanupExpiredFiles(expiredItems);
      manifest.items = activeItems;
      await this.updateManifest(manifest);
    }

    return {
      items: activeItems,
      newItems: newItems,
      lastUpdated: manifest.lastUpdated
    };
  }

  /**
   * Download a file from Drive
   * @param {Object} item - Transfer item with driveFileId
   * @returns {Promise<Blob>} File content as Blob
   */
  async downloadFile(item) {
    if (!item.driveFileId) {
      throw new Error('Item does not have a Drive file ID');
    }

    const token = await googleDriveService.getValidToken();
    if (!token) {
      throw new Error('Failed to get authentication token');
    }

    const response = await fetchWithTimeout(
      `https://www.googleapis.com/drive/v3/files/${item.driveFileId}?alt=media`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      },
      this.TIMEOUT_MS
    );

    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }

    return await response.blob();
  }

  /**
   * Delete an item from Drive and manifest
   * @param {string} itemId - Item ID to delete
   * @returns {Promise<void>}
   */
  async deleteItem(itemId) {
    const manifest = await this.getManifest();
    const item = manifest.items.find(i => i.id === itemId);

    if (!item) {
      console.warn('Item not found:', itemId);
      return;
    }

    // If file type, delete the actual file from Drive
    if (item.type === 'file' && item.driveFileId) {
      try {
        await googleDriveService.deleteFile(item.driveFileId);
        console.log('Deleted file from Drive:', item.driveFileId);
      } catch (error) {
        console.warn('Failed to delete file from Drive:', error);
        // Continue to remove from manifest even if file deletion fails
      }
    }

    // Remove from manifest
    manifest.items = manifest.items.filter(i => i.id !== itemId);
    await this.updateManifest(manifest);

    console.log('Item deleted:', itemId);
  }

  /**
   * Clear all transfer items
   * @returns {Promise<void>}
   */
  async clearAll() {
    const manifest = await this.getManifest();

    // Delete all files from Drive
    for (const item of manifest.items) {
      if (item.type === 'file' && item.driveFileId) {
        try {
          await googleDriveService.deleteFile(item.driveFileId);
        } catch (error) {
          console.warn('Failed to delete file:', error);
        }
      }
    }

    // Clear manifest
    manifest.items = [];
    await this.updateManifest(manifest);

    console.log('All transfer items cleared');
  }

  // ============ HELPER METHODS ============

  /**
   * Calculate 30-day expiry date
   * @returns {string} ISO date string
   */
  calculateExpiryDate() {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 30);
    return expiry.toISOString();
  }

  /**
   * Clean up expired files from Drive
   * @param {Array} expiredItems - Items to clean up
   * @returns {Promise<void>}
   */
  async cleanupExpiredFiles(expiredItems) {
    for (const item of expiredItems) {
      if (item.type === 'file' && item.driveFileId) {
        try {
          await googleDriveService.deleteFile(item.driveFileId);
          console.log('Cleaned up expired file:', item.driveFileId);
        } catch (error) {
          console.warn('Failed to cleanup expired file:', error);
        }
      }
    }
  }

  /**
   * Format file size for display
   * @param {number} bytes - Size in bytes
   * @returns {string} Formatted size
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Reset initialization state (useful after disconnect)
   */
  reset() {
    this.transfersFolderId = null;
    this.filesFolderId = null;
    this.manifestFileId = null;
    this.initialized = false;
  }
}

// Export singleton instance
export const transferService = new TransferService();
