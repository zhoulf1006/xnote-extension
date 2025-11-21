import { defineStore } from 'pinia';
import { googleDriveService } from '@/api/googleDriveService';
import { googleFolderBrowserService } from '@/api/googleFolderBrowserService';
import { getStoredValue, storeValue, STORAGE_KEYS } from '@/api/storageService';
import { useDriveMappings } from './driveMappings';

export const useGoogleDriveStore = defineStore('googleDrive', {
  state: () => ({
    isConnected: false,
    isSyncing: false,
    lastSyncTime: null,
    syncEnabled: false,
    isAvailable: false,  // Check if API is loaded
    syncStatus: 'idle', // 'idle' | 'syncing' | 'success' | 'failed'
    lastSyncError: null,
    syncDetails: {
      chats: 0,
      summaries: 0,
      translations: 0
    },
    // Custom folder location state
    useCustomLocation: false,
    parentFolderId: null,
    parentFolderName: null,
    isChangingLocation: false
  }),

  actions: {
    /**
     * Initialize the store and check availability
     */
    async initialize() {
      try {
        // Check if Google Drive service is available
        this.isAvailable = typeof googleDriveService !== 'undefined' &&
                          typeof chrome !== 'undefined' &&
                          chrome.identity;

        if (!this.isAvailable) {
          console.log('Google Drive integration not available');
          return false;
        }

        // Check stored connection status
        const isConnected = await getStoredValue(STORAGE_KEYS.GOOGLE_DRIVE_CONNECTED);
        this.isConnected = !!isConnected;

        if (this.isConnected) {
          // Verify token is still valid
          const authenticated = await googleDriveService.isAuthenticated();
          this.isConnected = authenticated;
        }

        // Load other settings
        this.syncEnabled = await getStoredValue(STORAGE_KEYS.GOOGLE_DRIVE_SYNC_ENABLED) || false;
        this.lastSyncTime = await getStoredValue(STORAGE_KEYS.GOOGLE_DRIVE_LAST_SYNC);

        // Load custom folder configuration
        const folderConfig = await googleDriveService.getFolderConfiguration();
        this.useCustomLocation = folderConfig.useCustom;
        this.parentFolderId = folderConfig.parentId;
        this.parentFolderName = folderConfig.parentName;

        // Initialize drive mappings with current location
        if (this.isConnected) {
          const driveMappings = useDriveMappings();
          await driveMappings.loadMappings();

          // Get root folder ID and set as current location
          const rootFolderId = await googleDriveService.getRootFolderId();
          if (rootFolderId) {
            await driveMappings.setCurrentLocation(rootFolderId, this.getDisplayPath());
          }
        }

        return true;
      } catch (error) {
        console.error('Error initializing Google Drive store:', error);
        this.isAvailable = false;
        return false;
      }
    },

    /**
     * Connect to Google Drive
     */
    async connect() {
      if (!this.isAvailable) {
        console.warn('Google Drive not available');
        return false;
      }

      try {
        const success = await googleDriveService.authenticate();
        this.isConnected = success;

        if (success) {
          console.log('Successfully connected to Google Drive');

          // Initialize drive mappings with current location
          const driveMappings = useDriveMappings();
          await driveMappings.loadMappings();

          // Get root folder ID and set as current location
          const rootFolderId = await googleDriveService.getRootFolderId();
          if (rootFolderId) {
            await driveMappings.setCurrentLocation(rootFolderId, this.getDisplayPath());
          }
        }

        return success;
      } catch (error) {
        console.error('Error connecting to Google Drive:', error);
        this.isConnected = false;
        return false;
      }
    },

    /**
     * Disconnect from Google Drive
     */
    async disconnect() {
      try {
        // Stop periodic sync first (fix memory leak)
        this.stopPeriodicSync();

        // Disconnect from service
        await googleDriveService.disconnect();

        // Reset ALL store state
        this.isConnected = false;
        this.isSyncing = false;
        this.lastSyncTime = null;
        this.syncEnabled = false;
        this.syncStatus = 'idle';
        this.lastSyncError = null;
        this.syncDetails = {
          chats: 0,
          summaries: 0,
          translations: 0
        };
        this.useCustomLocation = false;
        this.parentFolderId = null;
        this.parentFolderName = null;
        this.isChangingLocation = false;

        console.log('Disconnected from Google Drive and cleared all state');
      } catch (error) {
        console.error('Error disconnecting from Google Drive:', error);
        throw error; // Re-throw to handle in UI
      }
    },

    /**
     * Sync all data to Google Drive
     */
    async syncAll() {
      if (!this.isConnected) {
        console.warn('Not connected to Google Drive');
        this.syncStatus = 'failed';
        this.lastSyncError = 'Not connected to Google Drive';
        return false;
      }

      this.isSyncing = true;
      this.syncStatus = 'syncing';
      this.lastSyncError = null;

      try {
        await googleDriveService.syncAll();
        this.lastSyncTime = new Date().toISOString();
        this.syncStatus = 'success';
        console.log('Sync completed successfully');
        return true;
      } catch (error) {
        console.error('Error syncing to Google Drive:', error);
        this.syncStatus = 'failed';
        this.lastSyncError = error.message || 'Unknown sync error occurred';
        return false;
      } finally {
        this.isSyncing = false;
      }
    },

    /**
     * Export content to Google Drive
     * @param {string} type - Content type (chat, summary, translation)
     * @param {Object} data - Content data
     */
    async exportContent(type, data) {
      if (!this.isConnected) {
        const error = new Error('Not connected to Google Drive');
        console.warn(error.message);
        this.lastSyncError = error.message;
        throw error; // Throw error instead of returning null
      }

      this.syncStatus = 'syncing';
      this.lastSyncError = null;

      try {
        const fileId = await googleDriveService.exportContent(type, data);
        console.log(`Exported ${type} to Google Drive:`, fileId);

        // Update sync details
        if (this.syncDetails[type + 's'] !== undefined) {
          this.syncDetails[type + 's']++;
        }

        this.lastSyncTime = new Date().toISOString();
        this.syncStatus = 'success';
        return fileId;
      } catch (error) {
        console.error(`Error exporting ${type} to Google Drive:`, error);
        this.syncStatus = 'failed';
        this.lastSyncError = `Failed to export ${type}: ${error.message}`;
        throw error;
      }
    },

    /**
     * Import document from Google Drive
     * @param {string} fileId - File ID to import
     */
    async importDocument(fileId) {
      if (!this.isConnected) {
        console.warn('Not connected to Google Drive');
        return null;
      }

      try {
        const content = await googleDriveService.getFile(fileId);
        console.log('Imported document from Google Drive');
        return content;
      } catch (error) {
        console.error('Error importing from Google Drive:', error);
        throw error;
      }
    },

    /**
     * Toggle sync enabled state
     */
    async toggleSync() {
      this.syncEnabled = !this.syncEnabled;
      await storeValue(STORAGE_KEYS.GOOGLE_DRIVE_SYNC_ENABLED, this.syncEnabled);

      if (this.syncEnabled) {
        // Start periodic sync
        this.startPeriodicSync();
      } else {
        // Stop periodic sync
        this.stopPeriodicSync();
      }
    },

    /**
     * Start periodic sync (every 30 minutes)
     */
    startPeriodicSync() {
      if (this.syncInterval) {
        clearInterval(this.syncInterval);
      }

      this.syncInterval = setInterval(() => {
        if (this.isConnected && this.syncEnabled) {
          this.syncAll();
        }
      }, 30 * 60 * 1000); // 30 minutes
    },

    /**
     * Stop periodic sync
     */
    stopPeriodicSync() {
      if (this.syncInterval) {
        clearInterval(this.syncInterval);
        this.syncInterval = null;
      }
    },

    /**
     * Get the Google Drive folder URL
     * @returns {Promise<string|null>} The folder URL or null
     */
    async getFolderUrl() {
      try {
        const folderId = await googleDriveService.getRootFolderId();
        if (folderId) {
          return `https://drive.google.com/drive/folders/${folderId}`;
        }
        return null;
      } catch (error) {
        console.error('Error getting folder URL:', error);
        return null;
      }
    },

    /**
     * Validate and prepare a custom folder selection
     * Note: The actual folder selection is handled by the FolderBrowser component
     * @param {Object} folder - Selected folder from FolderBrowser
     * @returns {Promise<{id: string, name: string, path: string}|null>} Validated folder or null
     */
    async validateCustomFolder(folder) {
      try {
        // Validate that the folder still exists
        const isValid = await googleFolderBrowserService.validateFolder(folder.id);

        if (!isValid) {
          throw new Error('Selected folder no longer exists or is not accessible');
        }

        // Get the full path if not provided
        let fullPath = folder.path;
        if (!fullPath) {
          const pathArray = await googleFolderBrowserService.buildFolderPath(folder.id);
          fullPath = pathArray.map(f => f.name).join(' / ');
        }

        return {
          id: folder.id,
          name: folder.name,
          path: fullPath || folder.name
        };
      } catch (error) {
        console.error('Error validating custom folder:', error);
        this.lastSyncError = 'Failed to validate folder: ' + error.message;
        throw error;
      }
    },

    /**
     * Apply custom folder location
     * @param {string} folderId - Folder ID
     * @param {string} folderName - Folder name
     * @returns {Promise<boolean>} Success status
     */
    async applyCustomLocation(folderId, folderName) {
      this.isChangingLocation = true;
      this.lastSyncError = null;

      try {
        await googleDriveService.setCustomParentFolder(folderId, folderName);

        // Update store state
        this.useCustomLocation = true;
        this.parentFolderId = folderId;
        this.parentFolderName = folderName;

        // Update drive mappings with new location
        const driveMappings = useDriveMappings();
        const rootFolderId = await googleDriveService.getRootFolderId();
        if (rootFolderId) {
          await driveMappings.setCurrentLocation(rootFolderId, this.getDisplayPath());
        }

        console.log('Successfully changed storage location to:', folderName);
        return true;
      } catch (error) {
        console.error('Error applying custom location:', error);
        this.lastSyncError = 'Failed to change location: ' + error.message;
        return false;
      } finally {
        this.isChangingLocation = false;
      }
    },

    /**
     * Reset to default storage location
     * @returns {Promise<boolean>} Success status
     */
    async resetToDefaultLocation() {
      this.isChangingLocation = true;
      this.lastSyncError = null;

      try {
        await googleDriveService.resetToDefaultLocation();

        // Update store state
        this.useCustomLocation = false;
        this.parentFolderId = null;
        this.parentFolderName = null;

        // Update drive mappings with new location
        const driveMappings = useDriveMappings();
        const rootFolderId = await googleDriveService.getRootFolderId();
        if (rootFolderId) {
          await driveMappings.setCurrentLocation(rootFolderId, this.getDisplayPath());
        }

        console.log('Successfully reset to default storage location');
        return true;
      } catch (error) {
        console.error('Error resetting to default location:', error);
        this.lastSyncError = 'Failed to reset location: ' + error.message;
        return false;
      } finally {
        this.isChangingLocation = false;
      }
    },

    /**
     * Get the display path for current storage location
     * @returns {string} Display path
     */
    getDisplayPath() {
      if (this.useCustomLocation && this.parentFolderName) {
        return `${this.parentFolderName} / XNote /`;
      }
      return 'My Drive / XNote /';
    }
  }
});