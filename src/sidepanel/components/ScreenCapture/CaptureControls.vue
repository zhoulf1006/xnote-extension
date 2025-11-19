<template>
  <div class="capture-controls">
    <div class="action-buttons">
      <button
        class="capture-button"
        :class="{ capturing: isCapturing }"
        :disabled="isCapturing || isProcessing || isPasting"
        @click="$emit('start-capture')"
        @mouseenter="hoveredButton = 'capture'"
        @mouseleave="hoveredButton = null"
      >
        <i :class="buttonIcon"></i>
        <span>Capture</span>
      </button>

      <button
        class="paste-button"
        :class="{ pasting: isPasting }"
        :disabled="isCapturing || isProcessing || isPasting || !supportsVision"
        @click="$emit('paste-image')"
        @mouseenter="hoveredButton = 'paste'"
        @mouseleave="hoveredButton = null"
      >
        <i :class="pasteButtonIcon"></i>
        <span>Paste</span>
      </button>
    </div>

    <!-- Single dynamic note that changes on hover -->
    <div class="action-note" :class="noteClass">
      {{ currentNoteText }}
    </div>

    <!-- Dynamic ESC hint during operations -->
    <div v-if="isCapturing || isPasting" class="esc-hint">
      <i class="fas fa-keyboard"></i>
      <span>Press ESC to cancel</span>
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
import { computed, ref, onMounted } from 'vue';

// Props
const props = defineProps({
  isCapturing: {
    type: Boolean,
    default: false
  },
  isProcessing: {
    type: Boolean,
    default: false
  },
  isPasting: {
    type: Boolean,
    default: false
  },
  supportsVision: {
    type: Boolean,
    default: true
  }
});

// Emits
const emit = defineEmits(['start-capture', 'paste-image', 'prompt-selected']);

// State
const selectedPrompt = ref('extract-text');
const hoveredButton = ref(null);

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
  }
];

// Computed
const buttonIcon = computed(() => {
  if (props.isCapturing) return 'fas fa-spinner fa-spin';
  if (props.isProcessing) return 'fas fa-hourglass-half';
  return 'fas fa-camera';
});

const pasteButtonIcon = computed(() => {
  if (props.isPasting) return 'fas fa-spinner fa-spin';
  return 'fas fa-paste';
});

// Dynamic note text based on hover
const currentNoteText = computed(() => {
  if (hoveredButton.value === 'paste') {
    return props.supportsVision
      ? 'Ctrl+V or click to paste image from clipboard'
      : 'Vision not supported by current provider';
  }
  // Default to capture instructions (also shown when hovering capture)
  return 'Click and drag to select area on current page';
});

// Dynamic class for note color
const noteClass = computed(() => {
  if (hoveredButton.value === 'paste') return 'paste-hover';
  // Default to capture styling
  return 'capture-hover';
});

// Methods
function selectPrompt(template) {
  selectedPrompt.value = template.id;
  emit('prompt-selected', template.prompt);
}

// Emit the default prompt on mount
onMounted(() => {
  const defaultTemplate = promptTemplates.find(t => t.id === selectedPrompt.value);
  if (defaultTemplate) {
    emit('prompt-selected', defaultTemplate.prompt);
  }
});
</script>

<style scoped>
.capture-controls {
  margin-bottom: 20px;
}

.action-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 8px;
}

.capture-button,
.paste-button {
  padding: 12px 16px;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.2s ease;
}

.capture-button {
  background: linear-gradient(135deg, #9b81c4 0%, #bb88d1 100%);
  box-shadow: 0 4px 8px rgba(103, 58, 183, 0.3);
}

.paste-button {
  background: linear-gradient(135deg, #4caf50 0%, #66bb6a 100%);
  box-shadow: 0 4px 8px rgba(76, 175, 80, 0.3);
}

.capture-button:hover:not(:disabled) {
  background: linear-gradient(135deg, #9d83c6 0%, #b483c9 100%);
  transform: scale(1.03);
  box-shadow: 0 4px 8px rgba(103, 58, 183, 0.4);
}

.paste-button:hover:not(:disabled) {
  background: linear-gradient(135deg, #5cbf60 0%, #76c97a 100%);
  transform: scale(1.03);
  box-shadow: 0 4px 8px rgba(76, 175, 80, 0.4);
}

.capture-button:active:not(:disabled),
.paste-button:active:not(:disabled) {
  transform: scale(1.03);
}

.capture-button:disabled,
.paste-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.capture-button.capturing {
  background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
  animation: pulse 1.5s infinite;
}

.paste-button.pasting {
  background: linear-gradient(135deg, #2196f3 0%, #42a5f5 100%);
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

/* Single dynamic note area */
.action-note {
  min-height: 20px;
  padding: 6px 12px;
  margin-bottom: 12px;
  font-size: 12px;
  color: #6b7280;
  text-align: center;
  transition: color 0.2s ease;
}

/* Dynamic color based on hover */
.action-note.capture-hover {
  color: #8b73aa; /* Purple tint when hovering capture */
}

.action-note.paste-hover {
  color: #5cb85c; /* Green tint when hovering paste */
}

/* Dynamic ESC hint */
.esc-hint {
  margin-top: 8px;
  padding: 6px 10px;
  background: #fef3c7;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 12px;
  color: #92400e;
  animation: fadeIn 0.3s ease-in;
}

.esc-hint i {
  font-size: 14px;
  color: #d97706;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Prompt Section */
.prompt-section {
  margin-top: 16px;
  padding: 12px;
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