<template>
  <div class="transfer-input">
    <!-- File upload drop zone -->
    <div
      class="drop-zone"
      :class="{ 'drag-over': isDragging, 'uploading': isUploading }"
      @dragover.prevent="isDragging = true"
      @dragleave="isDragging = false"
      @drop.prevent="handleDrop"
    >
      <input
        ref="fileInput"
        type="file"
        @change="handleFileSelect"
        class="file-input"
        :disabled="isUploading"
      />

      <div v-if="isUploading" class="upload-status">
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: uploadProgress + '%' }"></div>
        </div>
        <span>Uploading... {{ uploadProgress }}%</span>
      </div>

      <div v-else class="drop-hint">
        <i class="fas fa-cloud-upload-alt"></i>
        <span>Drop file here or click to select</span>
        <span class="size-limit">Max 25MB</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { notify } from '@/sidepanel/composables/useToast';

const props = defineProps({
  isUploading: {
    type: Boolean,
    default: false
  },
  uploadProgress: {
    type: Number,
    default: 0
  },
  filesOnly: {
    type: Boolean,
    default: true
  }
});

const emit = defineEmits(['send-file']);

const fileInput = ref(null);
const isDragging = ref(false);

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

const handleFileSelect = (event) => {
  const file = event.target.files?.[0];
  if (file) {
    processFile(file);
  }
  // Reset input to allow selecting same file again
  event.target.value = '';
};

const handleDrop = (event) => {
  isDragging.value = false;
  const file = event.dataTransfer.files?.[0];
  if (file) {
    processFile(file);
  }
};

const processFile = (file) => {
  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    notify.error(`File is too large. Maximum size is 25MB. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB.`);
    return;
  }

  emit('send-file', file);
};
</script>

<style scoped>
.transfer-input {
  padding: 12px;
  background: #f8f9fa;
  border-top: 1px solid #e9ecef;
}

/* Drop zone */
.drop-zone {
  position: relative;
  border: 2px dashed #ced4da;
  border-radius: 8px;
  padding: 16px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 12px;
  background: white;
}

.drop-zone:hover {
  border-color: #673ab7;
  background: rgba(103, 58, 183, 0.02);
}

.drop-zone.drag-over {
  border-color: #673ab7;
  background: rgba(103, 58, 183, 0.05);
}

.drop-zone.uploading {
  cursor: not-allowed;
  opacity: 0.8;
}

.file-input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.file-input:disabled {
  cursor: not-allowed;
}

.drop-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  color: #6c757d;
}

.drop-hint i {
  font-size: 24px;
  color: #673ab7;
  margin-bottom: 4px;
}

.drop-hint span {
  font-size: 13px;
}

.size-limit {
  font-size: 11px !important;
  color: #adb5bd;
}

/* Upload status */
.upload-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.progress-bar {
  width: 100%;
  max-width: 200px;
  height: 6px;
  background: #e9ecef;
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #673ab7;
  transition: width 0.2s;
}

.upload-status span {
  font-size: 12px;
  color: #673ab7;
}
</style>
