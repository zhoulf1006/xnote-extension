import { computed } from 'vue';
import { useGoogleDriveStore } from '@/stores/googleDrive';
import { useDriveMappings } from '@/stores/driveMappings';
import { showNotification } from '@/sidepanel/utils/notifications';

/**
 * Centralized composable for Google Drive operations
 * Provides consistent connection checking and operations across all components
 */
export function useGoogleDrive() {
  const googleDriveStore = useGoogleDriveStore();
  const driveMappings = useDriveMappings();

  // Computed states for reactive updates
  const isConnected = computed(() => {
    return googleDriveStore?.isConnected || false;
  });

  const isAvailable = computed(() => {
    return googleDriveStore?.isAvailable || false;
  });

  const isSyncing = computed(() => {
    return googleDriveStore?.isSyncing || false;
  });

  const syncStatus = computed(() => {
    return googleDriveStore?.syncStatus || 'idle';
  });

  const canUpload = computed(() => {
    return isConnected.value && !isSyncing.value;
  });

  // Connection management
  async function connect() {
    if (!isAvailable.value) {
      throw new Error('Google Drive API is not available');
    }

    if (isConnected.value) {
      return true; // Already connected
    }

    try {
      return await googleDriveStore.connect();
    } catch (error) {
      showNotification('Failed to connect to Google Drive: ' + error.message, 'error');
      throw error;
    }
  }

  async function disconnect() {
    if (!isConnected.value) {
      return true; // Already disconnected
    }

    try {
      await googleDriveStore.disconnect();
      showNotification('Disconnected from Google Drive', 'success');
      return true;
    } catch (error) {
      showNotification('Failed to disconnect: ' + error.message, 'error');
      throw error;
    }
  }

  // Upload operations with built-in validation
  async function uploadSummary(summaryData, category) {
    if (!canUpload.value) {
      const message = !isConnected.value
        ? 'Please connect to Google Drive first'
        : 'Please wait for the current sync to complete';
      showNotification(message, 'warning');
      throw new Error(message);
    }

    try {
      const result = await googleDriveStore.exportSummaryToCategory(summaryData, category);
      showNotification('Summary uploaded to Google Drive', 'success');
      return result;
    } catch (error) {
      showNotification('Failed to upload summary: ' + error.message, 'error');
      throw error;
    }
  }

  async function uploadChat(chatData) {
    if (!canUpload.value) {
      const message = !isConnected.value
        ? 'Please connect to Google Drive first'
        : 'Please wait for the current sync to complete';
      showNotification(message, 'warning');
      throw new Error(message);
    }

    try {
      const result = await googleDriveStore.exportContent('chat', chatData);
      showNotification('Chat uploaded to Google Drive', 'success');
      return result;
    } catch (error) {
      showNotification('Failed to upload chat: ' + error.message, 'error');
      throw error;
    }
  }

  async function uploadTranslation(translationData) {
    if (!canUpload.value) {
      const message = !isConnected.value
        ? 'Please connect to Google Drive first'
        : 'Please wait for the current sync to complete';
      showNotification(message, 'warning');
      throw new Error(message);
    }

    try {
      const result = await googleDriveStore.exportContent('translation', translationData);
      showNotification('Translation uploaded to Google Drive', 'success');
      return result;
    } catch (error) {
      showNotification('Failed to upload translation: ' + error.message, 'error');
      throw error;
    }
  }

  // Check if content is already uploaded
  function isUploaded(type, id) {
    if (!isConnected.value) return false;

    switch(type) {
      case 'chat':
        const chats = driveMappings.currentChats;
        return chats && !!chats[id];
      case 'summary':
        const summaries = driveMappings.currentSummaries;
        return summaries && !!summaries[id];
      case 'translation':
        const translations = driveMappings.currentTranslations;
        return translations && !!translations[id];
      default:
        return false;
    }
  }

  // Get upload status details
  function getUploadStatus(type, id) {
    if (!isConnected.value) return null;

    switch(type) {
      case 'chat':
        return driveMappings.currentChats?.[id] || null;
      case 'summary':
        return driveMappings.currentSummaries?.[id] || null;
      case 'translation':
        return driveMappings.currentTranslations?.[id] || null;
      default:
        return null;
    }
  }

  // Sync operations
  async function syncNow() {
    if (!canUpload.value) {
      const message = !isConnected.value
        ? 'Please connect to Google Drive first'
        : 'Sync is already in progress';
      showNotification(message, 'warning');
      throw new Error(message);
    }

    try {
      await googleDriveStore.syncNow();
      showNotification('Sync completed successfully', 'success');
    } catch (error) {
      showNotification('Sync failed: ' + error.message, 'error');
      throw error;
    }
  }

  function toggleAutoSync() {
    if (!isConnected.value) {
      showNotification('Please connect to Google Drive first', 'warning');
      return false;
    }

    googleDriveStore.toggleAutoSync();
    const message = googleDriveStore.syncEnabled
      ? 'Auto-sync enabled'
      : 'Auto-sync disabled';
    showNotification(message, 'info');
    return googleDriveStore.syncEnabled;
  }

  return {
    // State
    isConnected,
    isAvailable,
    isSyncing,
    syncStatus,
    canUpload,

    // Connection management
    connect,
    disconnect,

    // Upload operations
    uploadSummary,
    uploadChat,
    uploadTranslation,

    // Status checks
    isUploaded,
    getUploadStatus,

    // Sync operations
    syncNow,
    toggleAutoSync,

    // Direct store access if needed
    store: googleDriveStore,
    mappings: driveMappings
  };
}