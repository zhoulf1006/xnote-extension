import { defineStore } from 'pinia';
import { googleDriveService } from '@/api/googleDriveService';
import { googleFolderBrowserService } from '@/api/googleFolderBrowserService';
import { getStoredValues, storeValue, STORAGE_KEYS } from '@/api/storageService';
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
    isChangingLocation: false,
    // Startup no longer waits for Drive, so the panel needs to say which of the three
    // outcomes it is in rather than looking identical to "not connected" while working.
    isInitializing: false,
    initFailed: false
  }),

  actions: {
    /**
     * Initialize the store and check availability
     */
    async initialize(service = googleDriveService, backend = undefined) {
      this.isInitializing = true;
      this.initFailed = false;
      const settled = new Promise((resolve) => { this._resolveReady = resolve; });
      this._readyPromise = settled;

      try {
        // Whether the integration exists at all is a capability question, separate
        // from whether this attempt succeeded. An injected service may answer it
        // itself; the real one falls back to asking the browser.
        this.isAvailable = typeof service?.isUsable === 'function'
          ? service.isUsable()
          : (typeof service !== 'undefined' &&
             typeof chrome !== 'undefined' &&
             !!chrome.identity);

        if (!this.isAvailable) {
          console.log('Google Drive integration not available');
          return false;
        }

        // The authentication check reads the connected flag itself and answers false
        // when it is unset, so reading it here as well was a second fetch of the same
        // key for an answer already being computed.
        this.isConnected = await service.isAuthenticated();

        const settings = await getStoredValues([
          STORAGE_KEYS.GOOGLE_DRIVE_SYNC_ENABLED,
          STORAGE_KEYS.GOOGLE_DRIVE_LAST_SYNC
        ], backend);
        this.syncEnabled = settings[STORAGE_KEYS.GOOGLE_DRIVE_SYNC_ENABLED] || false;
        this.lastSyncTime = settings[STORAGE_KEYS.GOOGLE_DRIVE_LAST_SYNC];

        const folderConfig = await service.getFolderConfiguration(backend);
        this.useCustomLocation = folderConfig.useCustom;
        this.parentFolderId = folderConfig.parentId;
        this.parentFolderName = folderConfig.parentName;

        if (this.isConnected) {
          const driveMappings = useDriveMappings();
          await driveMappings.loadMappings();

          const rootFolderId = await service.getRootFolderId();
          if (rootFolderId) {
            await driveMappings.setCurrentLocation(rootFolderId, this.getDisplayPath());
          }
        }

        return true;
      } catch (error) {
        // isAvailable is deliberately left alone: it used to be cleared here, which
        // removed the whole entry from the rail and left no way to retry.
        console.error('Error initializing Google Drive store:', error);
        this.initFailed = true;
        return false;
      } finally {
        this.isInitializing = false;
        this._resolveReady?.({ failed: this.initFailed });
      }
    },

    /**
     * Resolves once initialization has settled, either way. Callers that need Drive
     * await this instead of acting on a half-populated store.
     */
    async whenReady() {
      if (this._readyPromise) return await this._readyPromise;
      return { failed: this.initFailed };
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
      // Startup no longer blocks on initialization, so this can be reached while it is
      // still running — when isConnected is not yet its final value. Reporting "not
      // connected" then would be a lie about the cause.
      await this.whenReady();

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