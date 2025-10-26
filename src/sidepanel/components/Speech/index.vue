<template>
  <div class="page-container">
    <div class="header">
      <h1>Speech</h1>
      <button 
        class="config-button" 
        @click="showSpeechConfig = true" 
        title="Configure Speech Service"
      >
        <i class="fas fa-cog"></i>
      </button>
    </div>
    
    <!-- Speech Config Modal -->
    <div v-if="showSpeechConfig" class="speech-config-modal">
      <div class="speech-config-content">
        <h2>Azure Speech Service Configuration</h2>
        
        <div v-if="configStatus.isChecking" class="speech-config-loading">
          <i class="fas fa-circle-notch fa-spin"></i>
          Checking configuration...
        </div>
        
        <div v-else>
          <p class="config-info">
            <i class="fas fa-info-circle"></i>
            {{ configStatus.isExtensionMode ? 
              'Speech configuration will be securely stored in your Chrome account storage.' : 
              'In development mode, settings are read from environment variables.' 
            }}
          </p>
          
          <ApiKeyInput
            id="speech-key"
            label="Azure Speech API Key"
            :storage-key="STORAGE_KEYS.AZURE_SPEECH_KEY"
            env-fallback="VITE_AZURE_SPEECH_KEY"
            placeholder="Enter your Azure Speech API key"
            v-model:api-key="speechConfig.key"
          />
          
          <div class="form-group">
            <label for="speech-region">Azure Speech Region</label>
            <input 
              id="speech-region" 
              v-model="speechConfig.region" 
              placeholder="e.g., eastus, westus"
            />
          </div>
          
          <div class="speech-config-actions">
            <button class="cancel" @click="handleConfigCancel">Cancel</button>
            <button class="save" @click="saveSpeechConfig">Save</button>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Not Configured Warning -->
    <div v-if="!isSpeechConfigured && !showSpeechConfig" class="speech-not-configured">
      <i class="fas fa-exclamation-triangle"></i>
      <p>Azure Speech service is not configured.</p>
      <button @click="showSpeechConfig = true">Configure Now</button>
    </div>
    
    <div v-else class="speech-container">
      <h2>Select Voice</h2>
      <div class="voice-selection">
        <div class="voice-columns">
          <!-- English Voices -->
          <div class="voice-column">
            <h3>English</h3>
            <div class="voice-options">
              <label v-for="voice in voicePresets['en-US']" :key="voice.name">
                <input
                  type="radio"
                  :value="voice"
                  v-model="selectedVoice"
                  name="voice-selection"
                >
                {{ voice.displayName }}
              </label>
            </div>
          </div>
          <!-- Chinese Voices -->
          <div class="voice-column">
            <h3>Chinese</h3>
            <div class="voice-options">
              <label v-for="voice in voicePresets['zh-CN']" :key="voice.name">
                <input
                  type="radio"
                  :value="voice"
                  v-model="selectedVoice"
                  name="voice-selection"
                >
                {{ voice.displayName }}
              </label>
            </div>
          </div>
        </div>
      </div>

      <!-- Text Input and Controls -->
      <div class="input-section">
        <textarea
          v-model="inputText"
          placeholder="Enter text to speak..."
          :disabled="isPlaying"
        ></textarea>
        <div class="action-buttons">
          <button 
            @click="handleSpeak()" 
            :disabled="!inputText.trim() || isPlaying"
          >
            <i class="fas fa-play"></i>
            Speak
          </button>
          <button 
            @click="stop()" 
            class="stop-button"
            :disabled="!isPlaying"
          >
            <i class="fas fa-stop"></i>
            Stop
          </button>
          <button 
            @click="handleSave('mp3')" 
            :disabled="!inputText.trim() || isPlaying"
          >
            <i class="fas fa-file-audio"></i>
            Save MP3
          </button>
          <button 
            @click="handleSave('wav')" 
            :disabled="!inputText.trim() || isPlaying"
          >
            <i class="fas fa-download"></i>
            Save WAV
          </button>
          <button @click="inputText = ''" :disabled="!inputText.trim()">
            <i class="fas fa-times"></i>
            Clear
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed, onMounted } from 'vue';
import { useSpeech } from './useSpeech';
import { voicePresets } from '@/config/voicePresets';
import { STORAGE_KEYS, storeValue, isExtensionMode as checkExtensionMode, checkStorage } from '@/api/storageService';
import { getSpeechConfigStatus, initializeSpeechConfig } from '@/api/azureSpeech';
import ApiKeyInput from '../Common/ApiKeyInput.vue';

// Speech component state
const activeTab = ref('tts');
const {
  selectedVoice,
  inputText,
  isPlaying,
  speak,
  stop,
  saveAudio
} = useSpeech();

// Configuration modal state
const showSpeechConfig = ref(false);
const isSpeechConfigured = ref(false);
const speechConfig = ref({
  key: '',
  region: ''
});

// Configuration status
const configStatus = ref({
  isChecking: true,
  isConfigured: false,
  hasKey: false,
  hasRegion: false,
  isExtensionMode: checkExtensionMode()
});

// Check if speech is configured
const checkSpeechConfig = async () => {
  configStatus.value.isChecking = true;
  
  try {
    // Only check configuration when on the Speech page
    const status = await getSpeechConfigStatus();
    configStatus.value = {
      ...status,
      isChecking: false
    };
    
    isSpeechConfigured.value = status.isConfigured;
    
    // If configured, pre-fill the current values
    if (status.hasRegion) {
      speechConfig.value.region = '*'.repeat(5); // Masked for security
    }
  } catch (error) {
    console.error('Error checking speech configuration:', error);
    configStatus.value.isChecking = false;
    isSpeechConfigured.value = false;
  }
};

// Cancel configuration
const handleConfigCancel = () => {
  speechConfig.value = {
    key: '',
    region: ''
  };
  showSpeechConfig.value = false;
};

// Helper function to get user-friendly error messages for speech service
const getSpeechErrorMessage = (error) => {
  const errorMessage = error?.message || String(error) || '';
  const errorString = errorMessage.toLowerCase();
  
  // Check for API key related errors
  if (errorString.includes('unauthorized') || 
      errorString.includes('401') ||
      errorString.includes('authentication') ||
      errorString.includes('api key') ||
      errorString.includes('subscription') ||
      errorString.includes('invalid key')) {
    
    return `❌ **Azure Speech API Key Error**

Your Azure Speech API key appears to be invalid or missing.

**To fix this:**
1. Click the **⚙️** button next to "Speech" in the header
2. Enter a valid Azure Speech API key and region
3. Click **Save** to update your configuration
4. Try using speech synthesis again

If you don't have an Azure Speech API key, you'll need to create one from the Azure portal.`;
  }
  
  // Check for region/endpoint errors
  if (errorString.includes('region') || 
      errorString.includes('endpoint') ||
      errorString.includes('location')) {
    return `🌐 **Azure Speech Region Error**

The Azure Speech region appears to be incorrect or missing.

**To fix this:**
1. Click the **⚙️** button next to "Speech" in the header
2. Enter the correct Azure region (e.g., "eastus", "westus")
3. Click **Save** to update your configuration

Make sure the region matches your Azure Speech resource location.`;
  }
  
  // Check for network errors
  if (errorString.includes('network') || 
      errorString.includes('fetch') ||
      errorString.includes('connection')) {
    return `🌐 **Network Error**

Unable to connect to Azure Speech service. Please check your internet connection and try again.`;
  }
  
  // Generic error fallback
  return `❌ **Speech Service Error**

${errorMessage}

Please check your Azure Speech configuration or try again.`;
};

// Save speech configuration
const saveSpeechConfig = async () => {
  try {
    const promises = [];
    
    // Only update key if it's not masked (doesn't contain asterisks)
    if (!speechConfig.value.key.includes('*')) {
      promises.push(storeValue(STORAGE_KEYS.AZURE_SPEECH_KEY, speechConfig.value.key));
    }
    
    // Only update region if it's not masked (doesn't contain asterisks)
    if (!speechConfig.value.region.includes('*')) {
      promises.push(storeValue(STORAGE_KEYS.AZURE_SPEECH_REGION, speechConfig.value.region));
    }
    
    if (promises.length > 0) {
      await Promise.all(promises);
      
      // Verify storage was updated correctly
      await checkStorage();
      
      // Reinitialize the speech service
      await initializeSpeechConfig();
      await checkSpeechConfig();
    }
    
    showSpeechConfig.value = false;
  } catch (error) {
    console.error('Error saving speech configuration:', error);
    alert(getSpeechErrorMessage(error));
  }
};

// Initialize on component mount
onMounted(async () => {
  try {
    // Check storage status to make sure we're using the right storage
    await checkStorage();
    
    // Then check speech configuration
    await checkSpeechConfig();
  } catch (error) {
    console.error('Error initializing speech component:', error);
  }
});

// Compute character count
const characterCount = computed(() => inputText.value.length);

// Word count
const wordCount = computed(() => {
  const text = inputText.value.trim();
  return text ? text.split(/\s+/).length : 0;
});

// Clear the text area
const clearText = () => {
  inputText.value = '';
};

const handleSpeak = async () => {
  try {
    await speak(inputText.value, true);
  } catch (error) {
    console.error('Error in speech synthesis:', error);
    alert(getSpeechErrorMessage(error));
  }
};

const handleSave = async (format) => {
  try {
    const filename = `speech_${selectedVoice.value.name}_${Date.now()}`;
    await saveAudio(inputText.value, filename, format);
  } catch (error) {
    console.error('Error saving audio:', error);
    alert(getSpeechErrorMessage(error));
  }
};

// Initialize voice when language changes
watch(selectedVoice, (newVoice) => {
  if (newVoice) {
    // Save voice selection if needed
  }
});
</script>

<style scoped>
.speech-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  overflow: hidden;
}

.tabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid #dee2e6;
}

.tab-btn {
  padding: 8px 16px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 13px;
  color: #6c757d;
  border-bottom: 2px solid transparent;
}

.tab-btn.active {
  color: #2196f3;
  border-bottom-color: #2196f3;
}

.tab-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  overflow: hidden;
}

.input-container, .transcript-container {
  flex: 1;
  overflow: hidden;
  border: 1px solid #dee2e6;
  border-radius: 4px;
}

textarea {
  width: 100%;
  min-height: 120px;
  padding: 8px;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  resize: vertical;
  font-family: inherit;
  font-size: 13px;
  line-height: 1.4;
}

textarea:focus {
  outline: none;
}

.transcript {
  padding: 8px;
  height: 100%;
  overflow-y: auto;
  font-size: 13px;
  line-height: 1.4;
  color: #495057;
}

.transcript.recording {
  border: 1px solid #28a745;
}

.controls {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.voice-controls {
  display: flex;
  gap: 8px;
  align-items: center;
}

.voice-selector {
  display: flex;
  gap: 8px;
  align-items: center;
}

.language-select,
.voice-select {
  padding: 4px;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  font-size: 13px;
}

.language-select {
  width: 100px;
}

.voice-select {
  width: 200px;
}

optgroup {
  font-weight: 500;
  color: #495057;
}

.sliders {
  display: flex;
  gap: 16px;
  flex: 1;
}

.sliders label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #495057;
}

.action-buttons {
  display: flex;
  gap: 8px;
}

button {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  background: #ffffff;
  color: #495057;
  cursor: pointer;
  font-size: 13px;
}

button:hover:not(:disabled) {
  background: #f8f9fa;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

button i {
  font-size: 11px;
}

.stop-button {
  background: #dc3545 !important;
  color: white !important;
  border-color: #dc3545 !important;
}

.stop-button:hover:not(:disabled) {
  background: #c82333 !important;
  border-color: #bd2130 !important;
}

.stop-button:disabled {
  background: #f8f9fa !important;
  color: #6c757d !important;
  border-color: #dee2e6 !important;
  opacity: 0.5 !important;
}

.voice-selection {
  margin: 8px 0;
  padding: 8px;
  background: #f8f9fa;
  border-radius: 4px;
}

h2 {
  font-size: 14px;
  margin-bottom: 8px;
  color: #495057;
}

h3 {
  font-size: 13px;
  margin-bottom: 8px;
  color: #495057;
}

.voice-columns {
  display: flex;
  gap: 24px;
}

.voice-column {
  flex: 1;
}

.voice-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.voice-options label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #495057;
  cursor: pointer;
}

.voice-options input[type="radio"] {
  margin: 0;
  cursor: pointer;
}

.input-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.config-button {
  background: none;
  border: none;
  font-size: 13px;
  cursor: pointer;
  color: #555;
  padding: 4px 8px;
  border-radius: 3px;
}

.config-button:hover {
  background-color: #f0f0f0;
}

.speech-config-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.speech-config-content {
  background-color: white;
  padding: 20px;
  border-radius: 5px;
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
}

.speech-config-content h2 {
  margin-top: 0;
  font-size: 15px;
  margin-bottom: 15px;
}

.config-info {
  background-color: #f0f8ff;
  padding: 5px 8px;
  border-radius: 3px;
  font-size: 11px;
  margin-bottom: 15px;
  display: flex;
  align-items: center;
}

.config-info i {
  margin-right: 5px;
  color: #2196f3;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
}

.form-group input {
  width: 100%;
  padding: 6px;
  border: 1px solid #ccc;
  border-radius: 3px;
  font-size: 13px;
}

.speech-config-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 15px;
}

.speech-config-actions button {
  padding: 6px 12px;
  cursor: pointer;
  border-radius: 3px;
  font-size: 13px;
}

.speech-config-actions .cancel {
  background-color: #f0f0f0;
  border: 1px solid #ddd;
  margin-right: 8px;
}

.speech-config-actions .save {
  background-color: #4caf50;
  color: white;
  border: none;
}

.speech-config-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  color: #666;
}

.speech-config-loading i {
  margin-right: 8px;
}

.speech-not-configured {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 30px;
  text-align: center;
  color: #e65100;
}

.speech-not-configured i {
  font-size: 24px;
  margin-bottom: 10px;
}

.speech-not-configured button {
  margin-top: 15px;
  padding: 6px 12px;
  background-color: #ff9800;
  color: white;
  border: none;
  border-radius: 3px;
  cursor: pointer;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
