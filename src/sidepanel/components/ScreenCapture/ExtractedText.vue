<template>
  <div class="extracted-text">
    <div class="text-header">
      <h3>
        <i class="fas fa-file-alt"></i>
        Extracted Text
        <span v-if="isStreaming" class="streaming-indicator">
          <i class="fas fa-circle"></i>
          Streaming...
        </span>
      </h3>
      <div class="text-actions">
        <button @click="$emit('copy')" class="action-btn" title="Copy Text">
          <i class="fas fa-copy"></i>
          Copy
        </button>
        <button @click="exportAsMarkdown" class="action-btn" title="Export as Markdown">
          <i class="fas fa-file-export"></i>
          Export
        </button>
        <button @click="$emit('clear')" class="action-btn danger" title="Clear">
          <i class="fas fa-times"></i>
        </button>
      </div>
    </div>

    <div class="text-content-wrapper">
      <div
        ref="textContent"
        class="text-content"
        :class="{ editing: isEditing }"
        @dblclick="startEditing"
      >
        <textarea
          v-if="isEditing"
          v-model="editableText"
          @blur="saveEdit"
          @keydown.escape="cancelEdit"
          ref="textEditor"
          class="text-editor"
        />
        <pre v-else>{{ displayText }}</pre>
      </div>

      <!-- Character/Word Count -->
      <div class="text-stats">
        <span>
          <i class="fas fa-font"></i>
          {{ characterCount }} characters
        </span>
        <span>
          <i class="fas fa-paragraph"></i>
          {{ wordCount }} words
        </span>
        <span v-if="!isEditing" class="edit-hint">
          <i class="fas fa-edit"></i>
          Double-click to edit
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue';

// Props
const props = defineProps({
  text: {
    type: String,
    required: true
  },
  isStreaming: {
    type: Boolean,
    default: false
  }
});

// Emits
const emit = defineEmits(['copy', 'clear', 'update']);

// State
const isEditing = ref(false);
const editableText = ref(props.text);
const textEditor = ref(null);
const textContent = ref(null);

// Watch for text changes
watch(() => props.text, (newText) => {
  if (!isEditing.value) {
    editableText.value = newText;
  }
});

// Computed
const displayText = computed(() => editableText.value || props.text);

const characterCount = computed(() => displayText.value.length);

const wordCount = computed(() => {
  const words = displayText.value.trim().split(/\s+/);
  return words[0] === '' ? 0 : words.length;
});

// Methods
async function startEditing() {
  isEditing.value = true;
  await nextTick();
  if (textEditor.value) {
    textEditor.value.focus();
    textEditor.value.select();
  }
}

function saveEdit() {
  isEditing.value = false;
  emit('update', editableText.value);
}

function cancelEdit() {
  isEditing.value = false;
  editableText.value = props.text;
}

function exportAsMarkdown() {
  const markdown = `# Screenshot Text Extraction

**Date:** ${new Date().toLocaleString()}
**Provider:** ${getCurrentProvider()}

---

## Extracted Text

${displayText.value}

---

*Extracted using XNote Extension*`;

  const blob = new Blob([markdown], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `extracted-text-${Date.now()}.md`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function getCurrentProvider() {
  // Get from store if available
  const provider = localStorage.getItem('xnote-llm-provider') || 'unknown';
  const providers = {
    'openai': 'OpenAI',
    'deepseek': 'DeepSeek',
    'gemini': 'Gemini 2.0 Flash'
  };
  return providers[provider] || provider;
}
</script>

<style scoped>
.extracted-text {
  margin: 20px 0;
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.text-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #f8f9fa;
  border-bottom: 1px solid #e0e0e0;
}

.text-header h3 {
  margin: 0;
  font-size: 14px;
  color: #333;
  display: flex;
  align-items: center;
  gap: 8px;
}

.text-header h3 i {
  color: #673ab7;
  font-size: 14px;
}

.streaming-indicator {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #4caf50;
  font-size: 12px;
  font-weight: normal;
  animation: pulse 1.5s infinite;
}

.streaming-indicator i {
  font-size: 8px;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.text-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  padding: 6px 12px;
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
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

.text-content-wrapper {
  position: relative;
}

.text-content {
  padding: 16px;
  min-height: 150px;
  max-height: 400px;
  overflow-y: auto;
  background: white;
  position: relative;
}

.text-content.editing {
  padding: 0;
}

.text-content pre {
  margin: 0;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-wrap: break-word;
  color: #2c3e50;
}

.text-editor {
  width: 100%;
  height: 100%;
  min-height: 150px;
  padding: 16px;
  border: none;
  outline: none;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
  line-height: 1.6;
  color: #2c3e50;
  resize: vertical;
  background: #fffef0;
}

.text-stats {
  padding: 8px 16px;
  background: #f8f9fa;
  border-top: 1px solid #e0e0e0;
  display: flex;
  align-items: center;
  gap: 20px;
  font-size: 12px;
  color: #666;
}

.text-stats span {
  display: flex;
  align-items: center;
  gap: 6px;
}

.text-stats i {
  color: #999;
  font-size: 11px;
}

.edit-hint {
  margin-left: auto;
  color: #999;
  font-style: italic;
}

/* Scrollbar styling */
.text-content::-webkit-scrollbar {
  width: 8px;
}

.text-content::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

.text-content::-webkit-scrollbar-thumb {
  background: #ccc;
  border-radius: 4px;
}

.text-content::-webkit-scrollbar-thumb:hover {
  background: #999;
}
</style>