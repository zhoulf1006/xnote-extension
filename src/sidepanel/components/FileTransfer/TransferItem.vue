<template>
  <div class="transfer-item" :class="{ 'own-device': isOwnDevice }">
    <!-- Item header with device info and time -->
    <div class="item-header">
      <div class="device-info">
        <i :class="isOwnDevice ? 'fas fa-desktop' : 'fas fa-mobile-alt'"></i>
        <span class="device-label">{{ isOwnDevice ? 'This device' : getDisplayName(item) }}</span>
      </div>
      <span class="timestamp">{{ formatTime(item.timestamp) }}</span>
    </div>

    <!-- Text message content -->
    <div v-if="item.type === 'text'" class="text-content">
      <p>{{ item.content }}</p>
      <div class="item-actions">
        <button class="action-btn" @click="$emit('copy', item)" title="Copy to clipboard">
          <i class="fas fa-copy"></i>
        </button>
        <button class="action-btn delete-btn" @click="$emit('delete', item)" title="Delete">
          <i class="fas fa-trash-alt"></i>
        </button>
      </div>
    </div>

    <!-- File content -->
    <div v-else class="file-content">
      <div class="file-info">
        <div class="file-icon">
          <i :class="getFileIcon(item.mimeType)"></i>
        </div>
        <div class="file-details">
          <span class="file-name" :title="item.name">{{ item.name }}</span>
          <span class="file-meta">{{ formatSize(item.size) }}</span>
        </div>
      </div>
      <div class="item-actions">
        <button class="action-btn download-btn" @click="$emit('download', item)" title="Download">
          <i class="fas fa-download"></i>
        </button>
        <button class="action-btn delete-btn" @click="$emit('delete', item)" title="Delete">
          <i class="fas fa-trash-alt"></i>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  item: {
    type: Object,
    required: true
  },
  isOwnDevice: {
    type: Boolean,
    default: false
  }
});

defineEmits(['download', 'delete', 'copy']);

const getDisplayName = (item) => {
  if (item.deviceName) return item.deviceName;
  if (item.deviceId) return item.deviceId.slice(-6);
  return 'Other device';
};

const formatTime = (timestamp) => {
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
};

const formatSize = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const getFileIcon = (mimeType) => {
  if (!mimeType) return 'fas fa-file';

  if (mimeType.startsWith('image/')) return 'fas fa-file-image';
  if (mimeType.startsWith('video/')) return 'fas fa-file-video';
  if (mimeType.startsWith('audio/')) return 'fas fa-file-audio';
  if (mimeType.includes('pdf')) return 'fas fa-file-pdf';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'fas fa-file-word';
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'fas fa-file-excel';
  if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'fas fa-file-powerpoint';
  if (mimeType.includes('zip') || mimeType.includes('archive') || mimeType.includes('compressed')) return 'fas fa-file-archive';
  if (mimeType.includes('text') || mimeType.includes('javascript') || mimeType.includes('json')) return 'fas fa-file-code';

  return 'fas fa-file';
};
</script>

<style scoped>
.transfer-item {
  background: white;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 12px;
  transition: box-shadow 0.2s;
}

.transfer-item:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.transfer-item.own-device {
  background: rgba(103, 58, 183, 0.03);
  border-color: rgba(103, 58, 183, 0.15);
}

/* Item header */
.item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.device-info {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #6c757d;
}

.device-info i {
  font-size: 11px;
}

.device-label {
  font-weight: 500;
}

.timestamp {
  font-size: 11px;
  color: #adb5bd;
}

/* Text content */
.text-content {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.text-content p {
  margin: 0;
  font-size: 14px;
  color: #495057;
  line-height: 1.5;
  flex: 1;
  white-space: pre-wrap;
  word-break: break-word;
}

/* File content */
.file-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.file-info {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.file-icon {
  width: 36px;
  height: 36px;
  background: rgba(103, 58, 183, 0.1);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.file-icon i {
  font-size: 16px;
  color: #673ab7;
}

.file-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.file-name {
  font-size: 14px;
  color: #495057;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-meta {
  font-size: 12px;
  color: #adb5bd;
}

/* Item actions */
.item-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.action-btn {
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 6px;
  background: #f8f9fa;
  color: #6c757d;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.action-btn:hover {
  background: #e9ecef;
  color: #495057;
}

.action-btn.download-btn:hover {
  background: rgba(103, 58, 183, 0.1);
  color: #673ab7;
}

.action-btn.delete-btn:hover {
  background: rgba(220, 53, 69, 0.1);
  color: #dc3545;
}

.action-btn i {
  font-size: 12px;
}
</style>
