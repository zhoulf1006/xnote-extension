<template>
  <div class="page-container file-transfer">
    <!-- Header with device name and sync status -->
    <div class="header">
      <div class="header-left">
        <h1>Transfer</h1>
        <DeviceNameEditor
          :device-name="store.deviceName"
          @update="handleDeviceNameUpdate"
        />
      </div>
      <div class="header-actions">
        <SyncStatus
          :is-syncing="store.isSyncing"
          :pending-count="store.pendingItemsCount"
          @sync="handleSync"
        />
      </div>
    </div>

    <!-- Sync status line -->
    <div v-if="googleDriveStore.isConnected" class="sync-status-line">
      <span v-if="store.isSyncing" class="status syncing">
        <i class="fas fa-sync-alt fa-spin"></i> Syncing...
      </span>
      <span v-else-if="store.isTimeout" class="status timeout">
        Last sync timeout
      </span>
      <span v-else-if="store.lastSyncTime" class="status success">
        Last sync: {{ formatSyncTime(store.lastSyncTime) }}
      </span>
    </div>

    <!-- Connection requirement -->
    <div v-if="!googleDriveStore.isConnected" class="connect-prompt">
      <div class="connect-icon">
        <i class="fab fa-google-drive"></i>
      </div>
      <h3>Connect to Google Drive</h3>
      <p>File Transfer requires Google Drive to sync messages and files between your devices.</p>
      <button @click="openStorageModal" class="connect-button">
        <i class="fas fa-link"></i> Connect Google Drive
      </button>
    </div>

    <!-- Main content -->
    <template v-else>
      <!-- Loading state -->
      <div v-if="store.isLoading" class="loading-state">
        <i class="fas fa-spinner fa-spin"></i>
        <span>Loading transfers...</span>
      </div>

      <template v-else>
        <!-- Tab navigation -->
        <div class="tab-navigation">
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'messages' }"
            @click="activeTab = 'messages'"
          >
            <i class="fas fa-comments"></i>
            Messages
            <span v-if="messageCount > 0" class="tab-badge">{{ messageCount }}</span>
          </button>
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'files' }"
            @click="activeTab = 'files'"
          >
            <i class="fas fa-folder"></i>
            Files
            <span v-if="fileCount > 0" class="tab-badge">{{ fileCount }}</span>
          </button>
        </div>

        <!-- Messages tab -->
        <MessageTransfer
          v-if="activeTab === 'messages'"
          :messages="store.textMessages"
          :device-id="store.deviceId"
          @send="handleSendMessage"
          @copy="handleCopyMessage"
          @delete="handleDelete"
        />

        <!-- Files tab -->
        <template v-if="activeTab === 'files'">
          <TransferList
            :items="store.fileItems"
            :device-id="store.deviceId"
            @download="handleDownload"
            @delete="handleDelete"
            @copy="handleCopy"
          />

          <!-- File input area -->
          <TransferInput
            :is-uploading="store.isUploading"
            :upload-progress="currentUploadProgress"
            :files-only="true"
            @send-file="handleSendFile"
          />
        </template>
      </template>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { confirmAction } from '@/sidepanel/composables/useConfirm';
import { useFileTransferStore } from '@/stores/fileTransfer';
import { useGoogleDriveStore } from '@/stores/googleDrive';
import TransferInput from './TransferInput.vue';
import TransferList from './TransferList.vue';
import MessageTransfer from './MessageTransfer.vue';
import SyncStatus from './SyncStatus.vue';
import DeviceNameEditor from './DeviceNameEditor.vue';

const store = useFileTransferStore();
const googleDriveStore = useGoogleDriveStore();

// Tab state
const activeTab = ref('messages');

// Computed counts
const messageCount = computed(() => store.textMessages.length);
const fileCount = computed(() => store.fileItems.length);

// Computed for current upload progress
const currentUploadProgress = computed(() => {
  const uploads = Object.values(store.uploadProgress);
  if (uploads.length === 0) return 0;
  return uploads[uploads.length - 1];
});

// Format sync time as MM-dd hh:mm:ss
const formatSyncTime = (timestamp) => {
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${month}-${day} ${hours}:${minutes}:${seconds}`;
};

// Event handlers
const handleSync = async () => {
  // sync() handles errors internally and updates state
  await store.sync();
};

const handleDeviceNameUpdate = (name) => {
  store.setDeviceName(name);
};

const handleSendMessage = async (content) => {
  try {
    await store.sendMessage(content);
  } catch (error) {
    console.error('Failed to send message:', error);
    alert('Failed to send message: ' + error.message);
  }
};

const handleSendFile = async (file) => {
  try {
    await store.sendFile(file);
  } catch (error) {
    console.error('Failed to send file:', error);
    alert('Failed to send file: ' + error.message);
  }
};

const handleDownload = async (item) => {
  try {
    await store.downloadFile(item);
  } catch (error) {
    console.error('Failed to download file:', error);
    alert('Failed to download file: ' + error.message);
  }
};

const handleDelete = async (item) => {
  if (!(await confirmAction(`Delete this ${item.type === 'text' ? 'message' : 'file'}?`))) {
    return;
  }

  try {
    await store.deleteItem(item.id);
  } catch (error) {
    console.error('Failed to delete item:', error);
    alert('Failed to delete: ' + error.message);
  }
};

const handleCopy = async (item) => {
  try {
    await store.copyToClipboard(item);
  } catch (error) {
    console.error('Failed to copy:', error);
    alert('Failed to copy to clipboard');
  }
};

const handleCopyMessage = async (item) => {
  try {
    await navigator.clipboard.writeText(item.content);
  } catch (error) {
    console.error('Failed to copy:', error);
    alert('Failed to copy to clipboard');
  }
};

const openStorageModal = () => {
  window.dispatchEvent(new CustomEvent('openStorageModal'));
};

// Initialize store on mount
onMounted(async () => {
  if (googleDriveStore.isConnected) {
    await store.initialize();
  }
});

// Watch for connection changes
import { watch } from 'vue';
watch(() => googleDriveStore.isConnected, async (connected) => {
  if (connected) {
    await store.initialize();
  } else {
    store.reset();
  }
});
</script>

<style scoped>
.file-transfer {
  overflow: hidden;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header h1 {
  margin: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-actions {
  display: flex;
  gap: 8px;
}

/* Sync status line */
.sync-status-line {
  font-size: 11px;
  padding: 2px 0;
  margin-bottom: 0;
}

.sync-status-line .status {
  display: flex;
  align-items: center;
  gap: 4px;
}

.sync-status-line .status.success {
  color: #10b981;
}

.sync-status-line .status.timeout {
  color: #fd7e14;
}

.sync-status-line .status.syncing {
  color: #673ab7;
}

.sync-status-line .status i {
  font-size: 10px;
}

/* Tab navigation */
.tab-navigation {
  display: flex;
  border-bottom: 1px solid #e9ecef;
  background: white;
}

.tab-btn {
  flex: 1;
  padding: 12px 16px;
  border: none;
  background: transparent;
  font-size: 13px;
  font-weight: 500;
  color: #6c757d;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.2s;
  position: relative;
}

.tab-btn i {
  font-size: 14px;
}

.tab-btn:hover {
  background: rgba(103, 58, 183, 0.05);
}

.tab-btn.active {
  color: #673ab7;
}

.tab-btn.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: #673ab7;
}

.tab-badge {
  background: #e9ecef;
  color: #6c757d;
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 10px;
  min-width: 18px;
  text-align: center;
}

.tab-btn.active .tab-badge {
  background: rgba(103, 58, 183, 0.15);
  color: #673ab7;
}

/* Connect prompt */
.connect-prompt {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
}

.connect-icon {
  width: 64px;
  height: 64px;
  background: rgba(103, 58, 183, 0.1);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}

.connect-icon i {
  font-size: 28px;
  color: #673ab7;
}

.connect-prompt h3 {
  margin: 0 0 8px 0;
  font-size: 18px;
  color: #495057;
}

.connect-prompt p {
  margin: 0 0 20px 0;
  font-size: 14px;
  color: #6c757d;
  max-width: 280px;
}

.connect-button {
  background: #673ab7;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: background 0.2s;
}

.connect-button:hover {
  background: #5e35b1;
}

/* Loading state */
.loading-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #6c757d;
  font-size: 14px;
}

.loading-state i {
  font-size: 24px;
  color: #673ab7;
}
</style>
