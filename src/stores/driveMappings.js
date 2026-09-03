/**
 * Location-aware Drive Mappings Store
 *
 * This store manages content mappings for different Google Drive storage locations.
 * Each location (identified by its root folder ID) maintains its own set of mappings
 * for summaries, chats, and translations.
 *
 * Benefits:
 * - No data loss when switching locations
 * - Each location remembers what's uploaded there
 * - Users can switch back and forth between locations
 * - Same content can have different organizations in different locations
 */

import { defineStore } from 'pinia';
import { getLocalValue, storeLocalValue } from '@/api/storageService';
import { storageReadiness } from '@/api/storageReadiness';

const STORAGE_KEY = 'drive_location_mappings';

export const useDriveMappings = defineStore('driveMappings', {
  state: () => ({
    locations: {},  // All location mappings keyed by folder ID
    currentLocationId: null,  // Active location folder ID
  }),

  getters: {
    /**
     * Get the current location's data
     */
    currentLocation() {
      if (!this.currentLocationId || !this.locations[this.currentLocationId]) {
        return null;
      }
      return this.locations[this.currentLocationId];
    },

    /**
     * Get summaries for current location
     */
    currentSummaries() {
      return this.currentLocation?.summaries || {};
    },

    /**
     * Get chats for current location
     */
    currentChats() {
      return this.currentLocation?.chats || {};
    },

    /**
     * Get translations for current location
     */
    currentTranslations() {
      return this.currentLocation?.translations || {};
    },
  },

  actions: {
    /**
     * Load mappings from storage (uses local storage for large data)
     */
    async loadMappings(readiness = storageReadiness, backend = undefined) {
      // The sync→local migration is what puts this key into local storage, and Vue
      // mounts components before the parent's onMounted runs the migration — so wait
      // for the shared run rather than trusting the caller to have mounted late
      // enough. A failed run must not block the read: the data may already be in
      // place, and whatever is there beats nothing.
      await readiness.ensure(backend).catch(() => {});
      try {
        const stored = await getLocalValue(STORAGE_KEY, backend);
        if (stored) {
          this.locations = stored;
        }
      } catch (error) {
        console.error('Error loading drive mappings:', error);
        this.locations = {};
      }
    },

    /**
     * Save mappings to storage (uses local storage for large data)
     */
    async saveToStorage(readiness = storageReadiness, backend = undefined) {
      // Writers wait for the same run readers do, and for the mirror reason: the
      // migration's copy is the last write to win, so a change persisted while the
      // copy is in flight would be silently reverted to the legacy sync data. A
      // failed run must not block the write — persisting the user's change beats
      // protecting a copy that already failed.
      await readiness.ensure(backend).catch(() => {});
      try {
        await storeLocalValue(STORAGE_KEY, this.locations, backend);
      } catch (error) {
        console.error('Error saving drive mappings:', error);
      }
    },

    /**
     * Initialize or switch to a location
     * @param {string} folderId - Google Drive folder ID
     * @param {string} folderName - Display name/path of the folder
     */
    async setCurrentLocation(folderId, folderName) {
      if (!folderId) {
        console.error('Cannot set location without folder ID');
        return;
      }

      this.currentLocationId = folderId;

      // Initialize location if doesn't exist
      if (!this.locations[folderId]) {
        this.locations[folderId] = {
          name: folderName || 'Unknown Location',
          lastAccessed: new Date().toISOString(),
          summaries: {},
          chats: {},
          translations: {}
        };
      } else {
        // Update last accessed time and name (in case it changed)
        this.locations[folderId].lastAccessed = new Date().toISOString();
        if (folderName) {
          this.locations[folderId].name = folderName;
        }
      }

      await this.saveToStorage();
      console.log(`Switched to location: ${folderName} (${folderId})`);
    },

    /**
     * Check if URL is uploaded in current location
     * @param {string} url - Page URL
     * @returns {boolean}
     */
    isUrlUploadedInCurrentLocation(url) {
      if (!this.currentSummaries[url]) {
        return false;
      }
      return !!this.currentSummaries[url].fileId;
    },

    /**
     * Get upload status for URL in current location
     * @param {string} url - Page URL
     * @returns {Object|null}
     */
    getUploadStatusForUrl(url) {
      const summary = this.currentSummaries[url];
      if (!summary || !summary.uploadedAt) {
        return null;
      }
      return {
        uploadedAt: summary.uploadedAt,
        lastUpdatedAt: summary.lastUpdatedAt || summary.uploadedAt
      };
    },

    /**
     * Save summary mapping for current location
     * @param {string} url - Page URL
     * @param {Object} data - Mapping data
     */
    async saveSummaryMapping(url, data) {
      if (!this.currentLocationId) {
        console.error('No current location set');
        return;
      }

      // Ensure summaries object exists
      if (!this.locations[this.currentLocationId].summaries) {
        this.locations[this.currentLocationId].summaries = {};
      }

      // Merge with existing data
      const existing = this.locations[this.currentLocationId].summaries[url] || {};
      this.locations[this.currentLocationId].summaries[url] = {
        ...existing,
        ...data,
        lastUpdatedAt: new Date().toISOString()
      };

      // Set uploadedAt if not already set
      if (!this.locations[this.currentLocationId].summaries[url].uploadedAt) {
        this.locations[this.currentLocationId].summaries[url].uploadedAt = new Date().toISOString();
      }

      await this.saveToStorage();
    },

    /**
     * Get summary mapping for URL in current location
     * @param {string} url - Page URL
     * @returns {Object|null}
     */
    getSummaryForUrl(url) {
      return this.currentSummaries[url] || null;
    },

    /**
     * Save chat mapping for current location
     * @param {string} chatId - Chat ID
     * @param {Object} data - Mapping data (fileId, fileName, uploadedAt, etc.)
     */
    async saveChatMapping(chatId, data) {
      if (!this.currentLocationId) {
        console.error('No current location set');
        return;
      }

      // Ensure chats object exists
      if (!this.locations[this.currentLocationId].chats) {
        this.locations[this.currentLocationId].chats = {};
      }

      // Merge with existing data
      const existing = this.locations[this.currentLocationId].chats[chatId] || {};
      this.locations[this.currentLocationId].chats[chatId] = {
        ...existing,
        ...data,
        lastUpdatedAt: new Date().toISOString()
      };

      // Set uploadedAt if not already set
      if (!this.locations[this.currentLocationId].chats[chatId].uploadedAt) {
        this.locations[this.currentLocationId].chats[chatId].uploadedAt = new Date().toISOString();
      }

      await this.saveToStorage();
    },

    /**
     * Get folder mapping for URL in current location
     * @param {string} url - Page URL
     * @returns {Object|null} Folder category info
     */
    getFolderForUrl(url) {
      const summary = this.currentSummaries[url];
      if (!summary || !summary.category) {
        return null;
      }
      return {
        main: summary.category.main,
        sub: summary.category.sub,
        folderId: summary.folderId
      };
    },

    /**
     * Get file ID for URL in current location
     * @param {string} url - Page URL
     * @returns {string|null}
     */
    getFileIdForUrl(url) {
      return this.currentSummaries[url]?.fileId || null;
    },

    /**
     * Save folder mapping (compatibility method)
     * @param {string} url - Page URL
     * @param {string} mainCategory - Main category
     * @param {string} subCategory - Sub category
     * @param {string} folderId - Folder ID
     */
    async saveFolderMapping(url, mainCategory, subCategory, folderId) {
      await this.saveSummaryMapping(url, {
        category: {
          main: mainCategory,
          sub: subCategory
        },
        folderId
      });
    },

    /**
     * Save file mapping (compatibility method)
     * @param {string} url - Page URL
     * @param {string} fileId - File ID
     */
    async saveFileMapping(url, fileId) {
      await this.saveSummaryMapping(url, { fileId });
    },

    /**
     * Save upload status (compatibility method)
     * @param {string} url - Page URL
     * @param {boolean} isUpdate - Whether this is an update
     */
    async saveUploadStatus(url, isUpdate = false) {
      const now = new Date().toISOString();
      const existing = this.currentSummaries[url] || {};

      if (isUpdate && existing.uploadedAt) {
        // Update existing
        await this.saveSummaryMapping(url, {
          lastUpdatedAt: now
        });
      } else {
        // New upload
        await this.saveSummaryMapping(url, {
          uploadedAt: now,
          lastUpdatedAt: now
        });
      }
    },

    /**
     * Check if URL is uploaded (compatibility method)
     * @param {string} url - Page URL
     * @returns {boolean}
     */
    isUrlUploaded(url) {
      return this.isUrlUploadedInCurrentLocation(url);
    },

    /**
     * Get all locations with their upload counts
     * @returns {Array} Array of location info
     */
    getAllLocations() {
      return Object.entries(this.locations).map(([id, loc]) => ({
        id,
        name: loc.name,
        lastAccessed: loc.lastAccessed,
        isCurrent: id === this.currentLocationId,
        counts: {
          summaries: Object.keys(loc.summaries || {}).length,
          chats: Object.keys(loc.chats || {}).length,
          translations: Object.keys(loc.translations || {}).length,
          total: Object.keys(loc.summaries || {}).length +
                 Object.keys(loc.chats || {}).length +
                 Object.keys(loc.translations || {}).length
        }
      }));
    },

    /**
     * Migrate old mappings to new structure
     * @param {Object} oldMappings - Old mapping data
     * @param {string} folderId - Current folder ID
     * @param {string} folderName - Current folder name
     */
    async migrateOldMappings(oldMappings, folderId, folderName) {
      if (!folderId) return;

      console.log('Migrating old mappings to location-aware structure...');

      // Initialize location if needed
      if (!this.locations[folderId]) {
        this.locations[folderId] = {
          name: folderName || 'Migrated Location',
          lastAccessed: new Date().toISOString(),
          summaries: {},
          chats: {},
          translations: {}
        };
      }

      const { folderMappings, fileMappings, uploadStatus } = oldMappings;

      // Migrate summaries
      if (folderMappings) {
        for (const url in folderMappings) {
          const folder = folderMappings[url];
          const file = fileMappings?.[url];
          const status = uploadStatus?.[url];

          this.locations[folderId].summaries[url] = {
            category: {
              main: folder.main,
              sub: folder.sub
            },
            folderId: folder.folderId,
            fileId: file || null,
            uploadedAt: status?.uploadedAt || null,
            lastUpdatedAt: status?.lastUpdatedAt || status?.uploadedAt || null
          };
        }
      }

      this.currentLocationId = folderId;
      await this.saveToStorage();

      console.log('Migration completed successfully');
    }
  }
});