import { defineStore } from 'pinia';
import { getStoredValue, storeValue, STORAGE_KEYS } from '@/api/storageService';

export const useSummaryMappings = defineStore('summaryMappings', {
  state: () => ({
    folderMappings: {}, // URL to folder structure { url: { main: 'Education', sub: 'Programming', folderId: '...' }}
    fileMappings: {}    // URL to file ID for update tracking
  }),

  actions: {
    /**
     * Load mappings from storage
     */
    async loadMappings() {
      try {
        this.folderMappings = await getStoredValue(STORAGE_KEYS.SUMMARY_FOLDER_MAPPINGS) || {};
        this.fileMappings = await getStoredValue(STORAGE_KEYS.SUMMARY_FILE_MAPPINGS) || {};
      } catch (error) {
        console.error('Error loading summary mappings:', error);
        this.folderMappings = {};
        this.fileMappings = {};
      }
    },

    /**
     * Save folder mapping for a URL
     * @param {string} url - The page URL
     * @param {string} mainCategory - Main category name
     * @param {string} subCategory - Subcategory name
     * @param {string} folderId - Google Drive folder ID
     */
    async saveFolderMapping(url, mainCategory, subCategory, folderId) {
      this.folderMappings[url] = {
        main: mainCategory,
        sub: subCategory,
        folderId
      };
      await storeValue(STORAGE_KEYS.SUMMARY_FOLDER_MAPPINGS, this.folderMappings);
    },

    /**
     * Save file ID mapping for a URL
     * @param {string} url - The page URL
     * @param {string} fileId - Google Drive file ID
     */
    async saveFileMapping(url, fileId) {
      this.fileMappings[url] = fileId;
      await storeValue(STORAGE_KEYS.SUMMARY_FILE_MAPPINGS, this.fileMappings);
    },

    /**
     * Get folder mapping for a URL
     * @param {string} url - The page URL
     * @returns {Object|null} Folder mapping or null if not found
     */
    getFolderForUrl(url) {
      return this.folderMappings[url] || null;
    },

    /**
     * Get file ID for a URL
     * @param {string} url - The page URL
     * @returns {string|null} File ID or null if not found
     */
    getFileIdForUrl(url) {
      return this.fileMappings[url] || null;
    },

    /**
     * Clear all mappings
     */
    async clearMappings() {
      this.folderMappings = {};
      this.fileMappings = {};
      await storeValue(STORAGE_KEYS.SUMMARY_FOLDER_MAPPINGS, {});
      await storeValue(STORAGE_KEYS.SUMMARY_FILE_MAPPINGS, {});
    }
  }
});