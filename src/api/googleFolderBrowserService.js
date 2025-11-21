/**
 * Google Folder Browser Service for XNote Extension
 * Handles folder browsing and selection using Google Drive API directly
 */

class GoogleFolderBrowserService {
  constructor() {
    this.currentPath = [];
    this.cache = new Map(); // Cache folder listings
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes cache
  }

  /**
   * Get OAuth token for Drive API
   * @returns {Promise<string|null>} OAuth token
   */
  async getValidToken() {
    return new Promise((resolve) => {
      if (typeof chrome === 'undefined' || !chrome.identity) {
        console.warn('Chrome Identity API not available');
        resolve(null);
        return;
      }

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
   * List folders in a specific parent folder
   * @param {string} parentId - Parent folder ID ('root' for root directory)
   * @returns {Promise<{files: Array, nextPageToken?: string}>} Folder list
   */
  async listFolders(parentId = 'root', pageToken = null) {
    try {
      // Check cache first
      const cacheKey = `${parentId}-${pageToken || 'first'}`;
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }

      const token = await this.getValidToken();
      if (!token) {
        throw new Error('Failed to get authentication token');
      }

      // Build query for folders only
      const query = parentId === 'root'
        ? "mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false"
        : `mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`;

      let url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,createdTime,modifiedTime),nextPageToken&orderBy=name&pageSize=50`;

      if (pageToken) {
        url += `&pageToken=${pageToken}`;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to list folders: ${response.statusText}`);
      }

      const data = await response.json();

      // Cache the result
      this.cache.set(cacheKey, {
        data: data,
        timestamp: Date.now()
      });

      return data;
    } catch (error) {
      console.error('Error listing folders:', error);
      throw error;
    }
  }

  /**
   * Get folder details including parent information
   * @param {string} folderId - Folder ID
   * @returns {Promise<Object>} Folder details
   */
  async getFolderDetails(folderId) {
    try {
      const token = await this.getValidToken();
      if (!token) {
        throw new Error('Failed to get authentication token');
      }

      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name,parents`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to get folder details');
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting folder details:', error);
      throw error;
    }
  }

  /**
   * Build full folder path by traversing parents
   * @param {string} folderId - Folder ID
   * @returns {Promise<Array>} Array of folder objects from root to current
   */
  async buildFolderPath(folderId) {
    try {
      const path = [];
      let currentId = folderId;

      while (currentId && currentId !== 'root') {
        const folder = await this.getFolderDetails(currentId);
        path.unshift({
          id: folder.id,
          name: folder.name
        });

        // Check if we've reached the root
        if (!folder.parents || folder.parents.length === 0) {
          break;
        }

        currentId = folder.parents[0];
      }

      return path;
    } catch (error) {
      console.error('Error building folder path:', error);
      return [];
    }
  }

  /**
   * Search for folders by name
   * @param {string} searchTerm - Search term
   * @param {string} parentId - Parent folder ID to search within
   * @returns {Promise<Object>} Search results
   */
  async searchFolders(searchTerm, parentId = 'root') {
    try {
      const token = await this.getValidToken();
      if (!token) {
        throw new Error('Failed to get authentication token');
      }

      // Build search query
      let query = `mimeType='application/vnd.google-apps.folder' and name contains '${searchTerm}' and trashed=false`;

      if (parentId !== 'root') {
        query += ` and '${parentId}' in parents`;
      }

      const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,parents)&orderBy=name&pageSize=20`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to search folders');
      }

      return await response.json();
    } catch (error) {
      console.error('Error searching folders:', error);
      throw error;
    }
  }

  /**
   * Get shared drives available to the user
   * @returns {Promise<Object>} Shared drives list
   */
  async getSharedDrives() {
    try {
      const token = await this.getValidToken();
      if (!token) {
        throw new Error('Failed to get authentication token');
      }

      const response = await fetch(
        'https://www.googleapis.com/drive/v3/drives?pageSize=20',
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (!response.ok) {
        // Shared drives might not be available for all accounts
        return { drives: [] };
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting shared drives:', error);
      return { drives: [] };
    }
  }

  /**
   * Get recently accessed folders from storage
   * @returns {Promise<Array>} Recent folders
   */
  async getRecentFolders() {
    try {
      // This would be implemented with storage service
      // For now, return empty array
      return [];
    } catch (error) {
      console.error('Error getting recent folders:', error);
      return [];
    }
  }

  /**
   * Clear the cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Validate if a folder exists and is accessible
   * @param {string} folderId - Folder ID to validate
   * @returns {Promise<boolean>} True if folder exists
   */
  async validateFolder(folderId) {
    try {
      const folder = await this.getFolderDetails(folderId);
      return !!folder.id;
    } catch (error) {
      return false;
    }
  }

  /**
   * Clear all cached data and reset state
   * Called when disconnecting from Google Drive
   */
  clearCache() {
    this.cache.clear();
    this.currentPath = [];
    console.log('Cleared folder browser cache and reset state');
  }

  /**
   * Reset the service to initial state
   */
  reset() {
    this.clearCache();
  }
}

// Export singleton instance
export const googleFolderBrowserService = new GoogleFolderBrowserService();