<template>
  <div class="screen-capture">
    <!-- Header Section -->
    <div class="capture-header">
      <h2>
        <i class="fas fa-camera"></i>
        Screen Capture & Text Extraction
      </h2>
      <p class="capture-description">
        Capture any area of the screen and extract text using AI
      </p>
    </div>

    <!-- Provider Warning for Non-Vision Support -->
    <div v-if="!providerSupportsVision" class="vision-warning">
      <i class="fas fa-exclamation-triangle"></i>
      <div class="warning-content">
        <strong>{{ currentProviderName }} does not support image analysis</strong>
        <p>Please switch to OpenAI or Gemini in LLM Config to use the screenshot capture feature.</p>
        <button @click="openLLMConfig" class="config-link-btn">
          <i class="fas fa-cog"></i>
          Open LLM Config
        </button>
      </div>
    </div>

    <!-- Capture Controls -->
    <CaptureControls
      v-if="providerSupportsVision"
      :isCapturing="isCapturing"
      :isProcessing="isProcessing"
      @start-capture="startCapture"
    />

    <!-- Image Preview -->
    <ImagePreview
      v-if="capturedImage && !hidePreview"
      :image="capturedImage"
      @recapture="startCapture"
      @clear="clearCapture"
    />

    <!-- Processing Status -->
    <div v-if="isProcessing" class="processing-status">
      <div class="processing-indicator">
        <i class="fas fa-spinner fa-spin"></i>
        <span>Analyzing image with {{ currentProviderName }}...</span>
      </div>
    </div>

    <!-- Extracted Text Results -->
    <ExtractedText
      v-if="extractedText"
      :text="extractedText"
      :isStreaming="isStreaming"
      @copy="copyToClipboard"
      @clear="clearResults"
    />

    <!-- Error Display -->
    <div v-if="error" class="error-message">
      <i class="fas fa-exclamation-triangle"></i>
      <span>{{ error }}</span>
      <button @click="error = null" class="dismiss-button">
        <i class="fas fa-times"></i>
      </button>
    </div>

    <!-- History Section -->
    <div v-if="captureHistory.length > 0" class="history-section">
      <div class="history-header">
        <h3>
          <i class="fas fa-history"></i>
          Recent Captures
        </h3>
        <button @click="clearHistory" class="clear-history-btn">
          Clear All
        </button>
      </div>
      <div class="history-list">
        <div
          v-for="item in captureHistory"
          :key="item.id"
          class="history-item"
          @click="loadFromHistory(item)"
        >
          <img :src="item.thumbnail" alt="Capture thumbnail" />
          <div class="history-info">
            <div class="history-time">{{ formatTime(item.timestamp) }}</div>
            <div class="history-preview">{{ truncateText(item.text, 50) }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useLLMConfigStore } from '@/stores/llmConfig';
import { llmService } from '@/api/llm';
import { llmProviders } from '@/config/llmProviders';
import screenshotService from '@/api/screenshotService';
import CaptureControls from './CaptureControls.vue';
import ImagePreview from './ImagePreview.vue';
import ExtractedText from './ExtractedText.vue';
import useNavigationStore from '@/stores/navigation';

// Store references
const llmConfigStore = useLLMConfigStore();
const navigationStore = useNavigationStore();

// State
const isCapturing = ref(false);
const isProcessing = ref(false);
const isStreaming = ref(false);
const capturedImage = ref(null);
const extractedText = ref('');
const error = ref(null);
const captureHistory = ref([]);
const hidePreview = ref(false);

// Computed
const currentProviderName = computed(() => {
  const providers = {
    'openai': 'OpenAI',
    'deepseek': 'DeepSeek',
    'gemini': 'Gemini 2.0 Flash'
  };
  return providers[llmConfigStore.selectedProvider] || llmConfigStore.selectedProvider;
});

const providerSupportsVision = computed(() => {
  const currentProvider = llmConfigStore.selectedProvider;
  return llmProviders[currentProvider]?.supportsVision === true;
});

// Methods
function openLLMConfig() {
  // Trigger the LLM config modal - this simulates clicking the config button
  const event = new CustomEvent('openLLMConfig');
  window.dispatchEvent(event);
}

async function startCapture() {
  try {
    // Check if provider supports vision
    if (!providerSupportsVision.value) {
      error.value = `${currentProviderName.value} does not support image analysis. Please switch to OpenAI or Gemini.`;
      return;
    }

    isCapturing.value = true;
    error.value = null;
    extractedText.value = '';
    hidePreview.value = false;

    // Send message to background script to start capture
    const response = await chrome.runtime.sendMessage({
      action: 'startScreenshotCapture'
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to start capture');
    }
  } catch (err) {
    console.error('Error starting capture:', err);
    error.value = err.message || 'Failed to start screen capture';
    isCapturing.value = false;
  }
}

async function processScreenshot(imageData, cropData) {
  try {
    isProcessing.value = true;
    isStreaming.value = false;
    extractedText.value = '';

    // Crop the image if crop data is provided
    let processedImage = imageData;
    if (cropData) {
      processedImage = await screenshotService.cropImage(imageData, cropData);
    }

    // Compress if needed
    processedImage = await screenshotService.compressImage(processedImage, 1920, 0.9);

    // Store the captured image
    capturedImage.value = processedImage;

    // Extract base64 data
    const base64Data = screenshotService.extractBase64(processedImage);

    // Use LLM service to extract text
    const stream = await llmService.extractTextFromImage(base64Data, { stream: true });

    // Handle streaming response
    isStreaming.value = true;
    for await (const chunk of stream) {
      if (chunk.choices && chunk.choices[0]?.delta?.content) {
        extractedText.value += chunk.choices[0].delta.content;
      }
    }
    isStreaming.value = false;

    // Save to history
    await saveToHistory(processedImage, extractedText.value);
  } catch (err) {
    console.error('Error processing screenshot:', err);
    error.value = err.message || 'Failed to process screenshot';
  } finally {
    isProcessing.value = false;
    isStreaming.value = false;
  }
}

async function saveToHistory(image, text) {
  try {
    // Create thumbnail (smaller version)
    const thumbnail = await screenshotService.compressImage(image, 200, 0.7);

    const historyEntry = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      thumbnail,
      image,
      text
    };

    // Add to local history
    captureHistory.value.unshift(historyEntry);

    // Limit to 10 items
    if (captureHistory.value.length > 10) {
      captureHistory.value = captureHistory.value.slice(0, 10);
    }

    // Save to storage
    await screenshotService.saveToHistory({
      thumbnail,
      text: text.substring(0, 500) // Store preview only
    });
  } catch (err) {
    console.error('Error saving to history:', err);
  }
}

function loadFromHistory(item) {
  capturedImage.value = item.image;
  extractedText.value = item.text;
  hidePreview.value = false;
  error.value = null;
}

function clearCapture() {
  capturedImage.value = null;
  extractedText.value = '';
  error.value = null;
  hidePreview.value = false;
}

function clearResults() {
  extractedText.value = '';
}

async function clearHistory() {
  if (confirm('Clear all capture history?')) {
    captureHistory.value = [];
    await screenshotService.clearHistory();
  }
}

async function copyToClipboard() {
  try {
    await navigator.clipboard.writeText(extractedText.value);

    // Show temporary success message
    const originalError = error.value;
    error.value = 'Text copied to clipboard!';
    setTimeout(() => {
      if (error.value === 'Text copied to clipboard!') {
        error.value = originalError;
      }
    }, 2000);
  } catch (err) {
    error.value = 'Failed to copy to clipboard';
  }
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;

  return date.toLocaleDateString();
}

function truncateText(text, maxLength) {
  if (!text) return 'No text extracted';
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

// Load history on mount
onMounted(async () => {
  try {
    const history = await screenshotService.getHistory();
    // Note: Full images aren't stored in chrome storage, only thumbnails
    // For demo purposes, we'll just show the thumbnails
    captureHistory.value = history.slice(0, 10);
  } catch (err) {
    console.error('Error loading history:', err);
  }
});

// Listen for screenshot captured messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'screenshotCaptured') {
    isCapturing.value = false;
    processScreenshot(request.imageData, request.cropData);
    sendResponse({ success: true });
  } else if (request.action === 'screenshotCancelled') {
    isCapturing.value = false;
    error.value = 'Screenshot capture cancelled';
    sendResponse({ success: true });
  }
});
</script>

<style scoped>
.screen-capture {
  padding: 16px;
  height: 100%;
  overflow-y: auto;
  background: #f8f9fa;
}

.capture-header {
  margin-bottom: 24px;
  text-align: center;
}

.capture-header h2 {
  font-size: 20px;
  color: #333;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.capture-header h2 i {
  color: #673ab7;
}

.capture-description {
  color: #666;
  font-size: 14px;
}

.processing-status {
  margin: 20px 0;
  padding: 16px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.processing-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #673ab7;
  font-size: 14px;
}

.processing-indicator i {
  font-size: 18px;
}

.vision-warning {
  margin: 20px 0;
  padding: 16px;
  background: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 8px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.vision-warning > i {
  color: #ff9800;
  font-size: 20px;
  margin-top: 2px;
}

.warning-content {
  flex: 1;
}

.warning-content strong {
  color: #e65100;
  display: block;
  margin-bottom: 8px;
  font-size: 15px;
}

.warning-content p {
  color: #795548;
  margin: 8px 0;
  font-size: 14px;
  line-height: 1.5;
}

.config-link-btn {
  margin-top: 12px;
  padding: 8px 16px;
  background: #673ab7;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s;
}

.config-link-btn:hover {
  background: #5e35b1;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(103, 58, 183, 0.3);
}

.error-message {
  margin: 20px 0;
  padding: 12px;
  background: #fff5f5;
  border: 1px solid #ffcdd2;
  border-radius: 6px;
  color: #c62828;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.dismiss-button {
  margin-left: auto;
  background: none;
  border: none;
  color: #c62828;
  cursor: pointer;
  padding: 4px;
}

.dismiss-button:hover {
  opacity: 0.7;
}

/* History Section */
.history-section {
  margin-top: 32px;
  padding-top: 24px;
  border-top: 2px solid #e0e0e0;
}

.history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.history-header h3 {
  font-size: 16px;
  color: #333;
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
}

.history-header h3 i {
  color: #673ab7;
  font-size: 14px;
}

.clear-history-btn {
  padding: 6px 12px;
  background: transparent;
  border: 1px solid #ddd;
  border-radius: 4px;
  color: #666;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.clear-history-btn:hover {
  background: #fff;
  border-color: #c62828;
  color: #c62828;
}

.history-list {
  display: grid;
  gap: 12px;
}

.history-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  background: white;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.history-item:hover {
  box-shadow: 0 2px 6px rgba(0,0,0,0.15);
  transform: translateY(-1px);
}

.history-item img {
  width: 60px;
  height: 45px;
  object-fit: cover;
  border-radius: 4px;
  border: 1px solid #e0e0e0;
}

.history-info {
  flex: 1;
  min-width: 0;
}

.history-time {
  font-size: 12px;
  color: #999;
  margin-bottom: 4px;
}

.history-preview {
  font-size: 13px;
  color: #666;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>