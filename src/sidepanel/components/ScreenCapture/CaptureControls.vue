<template>
  <div class="capture-controls">
    <button
      class="capture-button"
      :class="{ capturing: isCapturing }"
      :disabled="isCapturing || isProcessing"
      @click="$emit('start-capture')"
    >
      <i :class="buttonIcon"></i>
      <span>{{ buttonText }}</span>
    </button>

    <div class="capture-tips">
      <div class="tip">
        <i class="fas fa-info-circle"></i>
        <span>Click and drag to select an area • Press ESC to cancel</span>
      </div>
    </div>

    <!-- Prompt Templates -->
    <div class="prompt-section">
      <label class="prompt-label">
        <i class="fas fa-magic"></i>
        Quick Actions:
      </label>
      <div class="prompt-buttons">
        <button
          v-for="template in promptTemplates"
          :key="template.id"
          @click="selectPrompt(template)"
          class="prompt-btn"
          :class="{ active: selectedPrompt === template.id }"
        >
          {{ template.label }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';

// Props
const props = defineProps({
  isCapturing: {
    type: Boolean,
    default: false
  },
  isProcessing: {
    type: Boolean,
    default: false
  }
});

// Emits
const emit = defineEmits(['start-capture', 'prompt-selected']);

// State
const selectedPrompt = ref('extract-text');

// Prompt templates
const promptTemplates = [
  {
    id: 'extract-text',
    label: 'Extract Text',
    prompt: 'Extract all text from this image accurately. Preserve formatting and structure.'
  },
  {
    id: 'describe',
    label: 'Describe Image',
    prompt: 'Describe what you see in this image in detail.'
  },
  {
    id: 'extract-table',
    label: 'Extract Table',
    prompt: 'Extract any tables from this image and format them clearly.'
  },
  {
    id: 'translate',
    label: 'Translate Text',
    prompt: 'Extract all text from this image and translate it to English.'
  }
];

// Computed
const buttonIcon = computed(() => {
  if (props.isCapturing) return 'fas fa-spinner fa-spin';
  if (props.isProcessing) return 'fas fa-hourglass-half';
  return 'fas fa-camera';
});

const buttonText = computed(() => {
  if (props.isCapturing) return 'Capturing...';
  if (props.isProcessing) return 'Processing...';
  return 'Capture Screenshot';
});

// Methods
function selectPrompt(template) {
  selectedPrompt.value = template.id;
  emit('prompt-selected', template.prompt);
}
</script>

<style scoped>
.capture-controls {
  margin-bottom: 20px;
}

.capture-button {
  width: 100%;
  padding: 14px 20px;
  background: linear-gradient(135deg, #673ab7 0%, #8e44ad 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(103, 58, 183, 0.3);
}

.capture-button:hover:not(:disabled) {
  background: linear-gradient(135deg, #5e35b1 0%, #7b3a9d 100%);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(103, 58, 183, 0.4);
}

.capture-button:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: 0 2px 8px rgba(103, 58, 183, 0.3);
}

.capture-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.capture-button.capturing {
  background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% {
    box-shadow: 0 4px 12px rgba(255, 107, 107, 0.3);
  }
  50% {
    box-shadow: 0 4px 20px rgba(255, 107, 107, 0.5);
  }
  100% {
    box-shadow: 0 4px 12px rgba(255, 107, 107, 0.3);
  }
}

.capture-tips {
  margin-top: 12px;
  padding: 10px;
  background: #f0f7ff;
  border-radius: 6px;
  border: 1px solid #d0e4ff;
}

.tip {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #4a5568;
  font-size: 13px;
}

.tip i {
  color: #3182ce;
  font-size: 14px;
}

/* Prompt Section */
.prompt-section {
  margin-top: 20px;
  padding: 16px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.prompt-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: #4a5568;
  margin-bottom: 12px;
}

.prompt-label i {
  color: #673ab7;
}

.prompt-buttons {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.prompt-btn {
  padding: 8px 12px;
  background: #f8f9fa;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  font-size: 12px;
  color: #4a5568;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.prompt-btn:hover {
  background: white;
  border-color: #673ab7;
  color: #673ab7;
}

.prompt-btn.active {
  background: rgba(103, 58, 183, 0.1);
  border-color: #673ab7;
  color: #673ab7;
  font-weight: 500;
}
</style>