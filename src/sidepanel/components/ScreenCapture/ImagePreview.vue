<template>
  <div class="image-preview">
    <div class="preview-header">
      <h3>
        <i class="fas fa-image"></i>
        Captured Screenshot
      </h3>
      <div class="preview-actions">
        <button @click="$emit('recapture')" class="action-btn" title="Capture Again">
          <i class="fas fa-redo"></i>
        </button>
        <button @click="downloadImage" class="action-btn" title="Download Image">
          <i class="fas fa-download"></i>
        </button>
        <button @click="$emit('clear')" class="action-btn danger" title="Clear">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    </div>

    <div class="preview-container">
      <img
        :src="image"
        alt="Captured screenshot"
        @click="showFullscreen = true"
        class="preview-image"
      />
      <div class="preview-overlay">
        <i class="fas fa-search-plus"></i>
        Click to enlarge
      </div>
    </div>

    <!-- Fullscreen Modal -->
    <div v-if="showFullscreen" class="fullscreen-modal" @click="showFullscreen = false">
      <div class="fullscreen-content">
        <img :src="image" alt="Captured screenshot" />
        <button @click="showFullscreen = false" class="close-btn">
          <i class="fas fa-times"></i>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

// Props
const props = defineProps({
  image: {
    type: String,
    required: true
  }
});

// Emits
defineEmits(['recapture', 'clear']);

// State
const showFullscreen = ref(false);

// Methods
function downloadImage() {
  const link = document.createElement('a');
  link.href = props.image;
  link.download = `screenshot-${Date.now()}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
</script>

<style scoped>
.image-preview {
  margin: 20px 0;
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #f8f9fa;
  border-bottom: 1px solid #e0e0e0;
}

.preview-header h3 {
  margin: 0;
  font-size: 14px;
  color: #333;
  display: flex;
  align-items: center;
  gap: 8px;
}

.preview-header h3 i {
  color: #673ab7;
  font-size: 14px;
}

.preview-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  padding: 6px 10px;
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 14px;
}

.action-btn:hover {
  background: #f8f9fa;
  border-color: #673ab7;
  color: #673ab7;
}

.action-btn.danger:hover {
  border-color: #e03131;
  color: #e03131;
  background: #fff5f5;
}

.preview-container {
  position: relative;
  padding: 16px;
  background: #f8f9fa;
  cursor: pointer;
  overflow: hidden;
}

.preview-image {
  width: 100%;
  max-height: 300px;
  object-fit: contain;
  border-radius: 4px;
  border: 1px solid #e0e0e0;
  background: white;
  transition: transform 0.2s;
}

.preview-container:hover .preview-image {
  transform: scale(1.02);
}

.preview-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0,0,0,0.7);
  color: white;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;
  opacity: 0;
  transition: opacity 0.2s;
  pointer-events: none;
}

.preview-container:hover .preview-overlay {
  opacity: 1;
}

/* Fullscreen Modal */
.fullscreen-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.9);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: zoom-out;
  animation: fadeIn 0.2s;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.fullscreen-content {
  position: relative;
  max-width: 90%;
  max-height: 90%;
}

.fullscreen-content img {
  max-width: 100%;
  max-height: 90vh;
  object-fit: contain;
  border-radius: 4px;
}

.close-btn {
  position: absolute;
  top: -40px;
  right: 0;
  padding: 8px 12px;
  background: rgba(255,255,255,0.1);
  border: 1px solid rgba(255,255,255,0.3);
  border-radius: 4px;
  color: white;
  cursor: pointer;
  font-size: 18px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: rgba(255,255,255,0.2);
}
</style>