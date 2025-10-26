import { defineStore } from 'pinia';
import { googleDriveService } from '@/api/googleDriveService';
import { getStoredValue, STORAGE_KEYS } from '@/api/storageService';

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
      translations: 0,
      todos: 0
    }
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
        await googleDriveService.disconnect();
        this.isConnected = false;
        this.syncEnabled = false;
        this.lastSyncTime = null;
        console.log('Disconnected from Google Drive');
      } catch (error) {
        console.error('Error disconnecting from Google Drive:', error);
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
     * @param {string} type - Content type (chat, summary, translation, todo)
     * @param {Object} data - Content data
     */
    async exportContent(type, data) {
      if (!this.isConnected) {
        console.warn('Not connected to Google Drive');
        this.lastSyncError = 'Not connected to Google Drive';
        return null;
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
    }
  }
});