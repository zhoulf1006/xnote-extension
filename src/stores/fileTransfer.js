/**
 * File Transfer Store
 * Pinia store for managing file transfer state
 *
 * Key features:
 * - IndexedDB for local cache
 * - Automatic change detection via Chrome Alarms
 * - Manual sync for downloading changes
 * - Optimistic UI updates
 */

import { defineStore } from 'pinia';
import { transferService, TimeoutError } from '@/api/transferService';
import { getDB } from './dbManager';

export const useFileTransferStore = defineStore('fileTransfer', {
  state: () => ({
    items: [],                    // Transfer items (from IndexedDB cache)
    isLoading: false,             // Initial load in progress
    isSyncing: false,             // Full sync in progress
    isChecking: false,            // Change detection in progress
    lastSyncTime: null,           // Last full sync (ISO timestamp)
    lastCheckTime: null,          // Last change check timestamp
    pendingItemsCount: 0,         // Number of new items available (not yet synced)
    syncError: null,              // Last error message
    isTimeout: false,             // Whether last error was a timeout
    deviceId: null,               // This device ID (from transferService)
    deviceName: null,             // This device name (user-defined)
    pendingUploads: [],           // Upload queue (temp IDs)
    uploadProgress: {},           // { tempId: percentage }
  }),

  getters: {
    /**
     * Items sorted by timestamp (newest first)
     */
    sortedItems: (state) => {
      return [...state.items]
        .filter(item => item.id !== '__metadata__')  // Exclude metadata
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    },

    /**
     * Text messages only, sorted by timestamp (oldest first for chat view)
     */
    textMessages: (state) => {
      return [...state.items]
        .filter(item => item.type === 'text' && item.id !== '__metadata__')
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    },

    /**
     * File items only, sorted by timestamp (newest first)
     */
    fileItems: (state) => {
      return [...state.items]
        .filter(item => item.type === 'file' && item.id !== '__metadata__')
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    },

    /**
     * Check if there are any items
     */
    hasItems: (state) => state.items.filter(i => i.id !== '__metadata__').length > 0,

    /**
     * Check if there are any text messages
     */
    hasMessages: (state) => state.items.filter(i => i.type === 'text').length > 0,

    /**
     * Check if there are any files
     */
    hasFiles: (state) => state.items.filter(i => i.type === 'file').length > 0,

    /**
     * Get current device ID
     */
    myDeviceId: (state) => state.deviceId,

    /**
     * Get current device name
     */
    myDeviceName: (state) => state.deviceName,

    /**
     * Check if there are pending items to sync
     */
    hasPendingItems: (state) => state.pendingItemsCount > 0,

    /**
     * Check if any upload is in progress
     */
    isUploading: (state) => state.pendingUploads.length > 0,
  },

  actions: {
    // ============ INITIALIZATION ============

    /**
     * Initialize the store
     */
    async initialize() {
      if (this.isLoading) return;

      this.isLoading = true;
      this.syncError = null;

      try {
        // 1. Get device ID and name
        this.deviceId = transferService.getDeviceId();
        this.deviceName = transferService.getDeviceName();

        // 2. Load cached items from IndexedDB
        await this.loadFromIndexedDB();

        // 3. Setup listener for background sync triggers
        this.setupSyncListener();

        // 4. Do an initial sync if connected
        // Don't await - let it run in background
        this.sync().catch(err => {
          console.warn('Initial sync failed:', err);
        });

        console.log('File transfer store initialized, device:', this.deviceId, this.deviceName);
      } catch (error) {
        console.error('Failed to initialize file transfer:', error);
        this.syncError = error.message;
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * Setup listener for sync triggers from background.js
     */
    setupSyncListener() {
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
          if (message.action === 'triggerTransferSync') {
            // Only check for changes, don't download
            this.checkForChanges();
            sendResponse({ received: true });
          }
          return true; // Keep channel open for async response
        });
        console.log('Sync listener setup complete');
      }
    },

    // ============ CHANGE DETECTION (Automatic polling) ============

    /**
     * Check for new items without downloading
     * Called automatically by background.js every 30-60 seconds
     */
    async checkForChanges() {
      if (this.isChecking || this.isSyncing) return;

      this.isChecking = true;

      try {
        // Fetch manifest from Drive
        const manifest = await transferService.getManifest();

        // Clear timeout state on successful check
        this.isTimeout = false;
        this.syncError = null;

        // Count new items (items we don't have locally)
        const localIds = new Set(this.items.map(i => i.id));
        const newItems = manifest.items.filter(item => !localIds.has(item.id));

        this.pendingItemsCount = newItems.length;
        this.lastCheckTime = new Date().toISOString();

        if (newItems.length > 0) {
          console.log(`${newItems.length} new items available`);
        }
      } catch (error) {
        // Check if this is a timeout error
        if (error instanceof TimeoutError || error.isTimeout || error.name === 'TimeoutError') {
          this.isTimeout = true;
          this.syncError = 'Connection timeout';
        }
        // Don't show error for check failures (expected when offline)
        console.warn('Check for changes failed:', error.message);
      } finally {
        this.isChecking = false;
      }
    },

    // ============ FULL SYNC (Manual - user triggered) ============

    /**
     * Full sync with Drive
     * Downloads all items and updates local cache
     */
    async sync() {
      if (this.isSyncing) return;

      this.isSyncing = true;
      this.syncError = null;
      this.isTimeout = false;

      try {
        // Sync with Drive
        const result = await transferService.sync(this.lastSyncTime);

        // Update local state with all active items
        this.items = result.items;

        // Reset pending count (we've now synced)
        this.pendingItemsCount = 0;

        // Update last sync time
        this.lastSyncTime = new Date().toISOString();

        // Cache to IndexedDB
        await this.saveToIndexedDB();

        console.log(`Sync complete: ${result.items.length} items`);
      } catch (error) {
        console.error('Sync failed:', error);
        // Check if this is a timeout error
        if (error instanceof TimeoutError || error.isTimeout || error.name === 'TimeoutError') {
          this.isTimeout = true;
          this.syncError = 'Connection timeout';
        } else {
          this.syncError = error.message;
        }
        throw error;
      } finally {
        this.isSyncing = false;
      }
    },

    // ============ SEND OPERATIONS ============

    /**
     * Send a text message
     * @param {string} content - Message content
     */
    async sendMessage(content) {
      if (!content || !content.trim()) {
        throw new Error('Message cannot be empty');
      }

      try {
        const item = await transferService.sendTextMessage(content.trim());

        // Optimistic update
        this.items.push(item);
        await this.saveToIndexedDB();

        return item;
      } catch (error) {
        console.error('Failed to send message:', error);
        throw error;
      }
    },

    /**
     * Send a file
     * @param {File} file - File to send
     */
    async sendFile(file) {
      const tempId = `pending_${Date.now()}`;
      this.pendingUploads.push(tempId);
      this.uploadProgress[tempId] = 0;

      try {
        const item = await transferService.sendFile(file, (progress) => {
          this.uploadProgress[tempId] = progress;
        });

        // Update state
        this.items.push(item);
        await this.saveToIndexedDB();

        return item;
      } catch (error) {
        console.error('Failed to send file:', error);
        throw error;
      } finally {
        // Cleanup upload tracking
        this.pendingUploads = this.pendingUploads.filter(id => id !== tempId);
        delete this.uploadProgress[tempId];
      }
    },

    // ============ DEVICE NAME ============

    /**
     * Update the device name
     * @param {string} name - New device name
     */
    setDeviceName(name) {
      if (name && name.trim()) {
        transferService.setDeviceName(name.trim());
        this.deviceName = name.trim();
      }
    },

    // ============ DOWNLOAD OPERATION ============

    /**
     * Download a file and trigger browser download
     * @param {Object} item - Transfer item
     */
    async downloadFile(item) {
      if (item.type !== 'file') {
        throw new Error('Item is not a file');
      }

      try {
        const blob = await transferService.downloadFile(item);

        // Create download link
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = item.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log('File downloaded:', item.name);
      } catch (error) {
        console.error('Failed to download file:', error);
        throw error;
      }
    },

    // ============ DELETE OPERATION ============

    /**
     * Delete an item
     * @param {string} itemId - Item ID to delete
     */
    async deleteItem(itemId) {
      try {
        await transferService.deleteItem(itemId);

        // Remove from local state
        this.items = this.items.filter(item => item.id !== itemId);
        await this.saveToIndexedDB();

        console.log('Item deleted:', itemId);
      } catch (error) {
        console.error('Failed to delete item:', error);
        throw error;
      }
    },

    /**
     * Clear all items
     */
    async clearAll() {
      try {
        await transferService.clearAll();
        this.items = [];
        await this.saveToIndexedDB();
        console.log('All items cleared');
      } catch (error) {
        console.error('Failed to clear all:', error);
        throw error;
      }
    },

    // ============ CLIPBOARD OPERATIONS ============

    /**
     * Copy text content to clipboard
     * @param {Object} item - Transfer item
     */
    async copyToClipboard(item) {
      if (item.type !== 'text') {
        throw new Error('Item is not a text message');
      }

      try {
        await navigator.clipboard.writeText(item.content);
        console.log('Copied to clipboard');
        return true;
      } catch (error) {
        console.error('Failed to copy:', error);
        throw error;
      }
    },

    // ============ INDEXEDDB OPERATIONS ============

    /**
     * Load items from IndexedDB cache
     */
    async loadFromIndexedDB() {
      try {
        const db = await getDB();

        // Check if transfers store exists
        if (!db.objectStoreNames.contains('transfers')) {
          console.log('Transfers store not yet created, skipping load');
          return;
        }

        const tx = db.transaction('transfers', 'readonly');
        const store = tx.objectStore('transfers');

        // Get all items
        const items = await new Promise((resolve, reject) => {
          const request = store.getAll();
          request.onsuccess = () => resolve(request.result || []);
          request.onerror = () => reject(request.error);
        });

        // Separate metadata from items
        const metadata = items.find(i => i.id === '__metadata__');
        this.items = items.filter(i => i.id !== '__metadata__');

        if (metadata) {
          this.lastSyncTime = metadata.lastSyncTime;
        }

        console.log(`Loaded ${this.items.length} items from IndexedDB`);
      } catch (error) {
        console.warn('Failed to load from IndexedDB:', error);
        // Don't throw - IndexedDB failure shouldn't break the app
      }
    },

    /**
     * Save items to IndexedDB cache
     */
    async saveToIndexedDB() {
      try {
        const db = await getDB();

        // Check if transfers store exists
        if (!db.objectStoreNames.contains('transfers')) {
          console.log('Transfers store not yet created, skipping save');
          return;
        }

        const tx = db.transaction('transfers', 'readwrite');
        const store = tx.objectStore('transfers');

        // Clear existing items
        await new Promise((resolve, reject) => {
          const request = store.clear();
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });

        // Add all items - convert Vue reactive proxies to plain objects for IndexedDB
        for (const item of this.items) {
          const plainItem = JSON.parse(JSON.stringify(item));
          store.put(plainItem);
        }

        // Save metadata
        store.put({
          id: '__metadata__',
          lastSyncTime: this.lastSyncTime,
          deviceId: this.deviceId,
          savedAt: new Date().toISOString()
        });

        await new Promise((resolve, reject) => {
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });

        console.log(`Saved ${this.items.length} items to IndexedDB`);
      } catch (error) {
        console.warn('Failed to save to IndexedDB:', error);
        // Don't throw - IndexedDB failure shouldn't break the app
      }
    },

    // ============ UTILITY METHODS ============

    /**
     * Format timestamp for display
     * @param {string} timestamp - ISO timestamp
     * @returns {string} Formatted time
     */
    formatTime(timestamp) {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;

      return date.toLocaleDateString();
    },

    /**
     * Format file size for display
     * @param {number} bytes - Size in bytes
     * @returns {string} Formatted size
     */
    formatSize(bytes) {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    /**
     * Check if item is from this device
     * @param {Object} item - Transfer item
     * @returns {boolean}
     */
    isOwnDevice(item) {
      return item.deviceId === this.deviceId;
    },

    /**
     * Reset store state (on disconnect)
     */
    reset() {
      this.items = [];
      this.isLoading = false;
      this.isSyncing = false;
      this.isChecking = false;
      this.lastSyncTime = null;
      this.lastCheckTime = null;
      this.pendingItemsCount = 0;
      this.syncError = null;
      this.pendingUploads = [];
      this.uploadProgress = {};
      transferService.reset();
    }
  }
});
