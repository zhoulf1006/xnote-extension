<template>
  <div class="result-area" ref="resultContainer">
    <div v-if="isStreaming" class="streaming">
      <Markdown :source="streamingResult" :options="markdownOptions" />
      <div class="typing-indicator">
        <span></span><span></span><span></span>
      </div>
    </div>
    <div v-else-if="result" class="result">
      <Markdown :source="result" :options="markdownOptions" />
    </div>
  </div>
</template>

<script setup>
import Markdown from 'vue3-markdown-it';

defineProps({
  streamingResult: {
    type: String,
    default: ''
  },
  result: {
    type: String,
    default: ''
  },
  isStreaming: {
    type: Boolean,
    default: false
  }
});

const markdownOptions = {
  html: true,
  breaks: true,
  linkify: true,
  typographer: true,
  quotes: '""\'\'',
  langPrefix: 'language-',
  wrapper: 'div class="markdown-body"'
};
</script>

<style scoped>
.result-area {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow: auto;
  padding: 8px;
  font-size: 13px;
  flex: 1;
  width: 100%;
  min-height: 100px;
  max-height: calc(100% - 120px);
  box-sizing: border-box;
}

.result, .streaming {
  background: #ffffff;
  border-radius: 4px;
  padding: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  line-height: 1.8;
  width: 100%; /* Ensure it takes up the full width of its parent */
  overflow-wrap: break-word; /* Break long words */
  word-wrap: break-word;
  word-break: break-word;
  max-width: 100%; /* Prevent children from overflowing horizontally */
  overflow-x: auto; /* Allow horizontal scroll for large inline content */
}

.result :deep(.markdown-body) {
  width: 100%;
  max-width: 100%;
  overflow: auto;
  margin: 0;
  padding: 0;
}

.result :deep(p) {
  margin: 8px 0;
  width: 100%;
  overflow-wrap: break-word;
  word-wrap: break-word;
  word-break: break-word;
}

.result :deep(p:first-child) {
  margin-top: 0;
  font-weight: 500;
  color: #1976d2;
}

.result :deep(p:last-child) {
  margin-bottom: 0;
}

.result :deep(p:nth-child(even)) {
  color: #666;
  padding-left: 16px;
  border-left: 2px solid #e0e0e0;
}

.typing-indicator {
  display: flex;
  gap: 4px;
  padding: 2px 4px;
  margin-top: 4px;
  justify-content: center;
}

.typing-indicator span {
  width: 4px;
  height: 4px;
  background: #666;
  border-radius: 50%;
  animation: bounce 0.8s infinite;
}

.typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
.typing-indicator span:nth-child(3) { animation-delay: 0.4s; }

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}
</style>