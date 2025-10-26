<template>
  <div class="page-container">
    <div class="header">
      <h1>LLM Test</h1>
    </div>
    <div class="llm-test-container">
      <div class="provider-selection">
        <label>Provider:</label>
        <select v-model="selectedProvider">
          <option v-for="(config, key) in llmProviders" 
                  :key="key" 
                  :value="key">
            {{ config.name }}
          </option>
        </select>
      </div>

      <div class="input-section">
        <textarea
          v-model="inputText"
          placeholder="Enter your message..."
          :disabled="isGenerating"
        ></textarea>
        <div class="action-buttons">
          <button 
            @click="handleSubmit"
            :disabled="!inputText.trim() || isGenerating"
          >
            <i class="fas" :class="isGenerating ? 'fa-spinner fa-spin' : 'fa-paper-plane'"></i>
            {{ isGenerating ? 'Generating...' : 'Send' }}
          </button>
          <button @click="inputText = ''" :disabled="!inputText.trim()">
            <i class="fas fa-times"></i>
            Clear
          </button>
        </div>
      </div>

      <div class="response-section">
        <div class="response-content" ref="responseRef" v-html="formattedResponse"></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed, nextTick, onMounted } from 'vue';
import { llmService } from '@/api/llm';
import { llmProviders, defaultProvider, LLM_PROVIDER_STORAGE_KEY } from '@/config/llmProviders';

const selectedProvider = ref(
  localStorage.getItem(LLM_PROVIDER_STORAGE_KEY) || defaultProvider
);
const inputText = ref('');
const response = ref('');
const isGenerating = ref(false);
const responseRef = ref(null);

const formattedResponse = computed(() => {
  return response.value.replace(/\n/g, '<br>');
});

// Helper function to get user-friendly error messages
const getErrorMessage = (error) => {
  const errorMessage = error?.message || String(error) || '';
  const errorString = errorMessage.toLowerCase();
  
  // Check for API key related errors
  if (errorString.includes('unauthorized') || 
      errorString.includes('401') ||
      errorString.includes('authentication fails') ||
      errorString.includes('api key') ||
      errorString.includes('invalid key') ||
      errorString.includes('invalid') && errorString.includes('key')) {
    
    const currentProvider = selectedProvider.value;
    const providerName = currentProvider ? 
      (currentProvider.charAt(0).toUpperCase() + currentProvider.slice(1)) : 'LLM';
    
    return `❌ **API Key Error**

Your ${providerName} API key appears to be invalid or missing.

**To fix this:**
1. Click the **⚙️ LLM Config** button at the bottom of the sidebar
2. Enter a valid ${providerName} API key
3. Click **Save** to update your configuration
4. Try your test again

If you don't have an API key, you'll need to get one from the ${providerName} website.`;
  }
  
  // Check for network errors
  if (errorString.includes('network') || 
      errorString.includes('fetch') ||
      errorString.includes('connection')) {
    return `🌐 **Network Error**

Unable to connect to the AI service. Please check your internet connection and try again.`;
  }
  
  // Check for provider not configured
  if (errorString.includes('no llm provider') || 
      errorString.includes('provider not found') ||
      errorString.includes('provider selected')) {
    return `⚙️ **Configuration Required**

No LLM provider is configured. Please:
1. Click the **⚙️ LLM Config** button at the bottom of the sidebar
2. Select a provider (OpenAI, Gemini, or DeepSeek)
3. Enter your API key
4. Click **Save** to complete setup`;
  }
  
  // Generic error fallback
  return `❌ **Error processing your request**

${errorMessage}

Please try again or check your LLM configuration in the settings.`;
};

watch(selectedProvider, (newProvider) => {
  llmService.setProvider(newProvider);
  localStorage.setItem(LLM_PROVIDER_STORAGE_KEY, newProvider);
});

// Initialize provider on component mount
onMounted(() => {
  llmService.setProvider(selectedProvider.value);
});

const handleSubmit = async () => {
  if (!inputText.value.trim() || isGenerating.value) return;

  isGenerating.value = true;
  response.value = '';

  try {
    const messages = [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: inputText.value }
    ];

    const completion = await llmService.chat(messages);

    // Handle streaming response
    for await (const chunk of completion) {
      if (chunk.choices[0]?.delta?.content) {
        response.value += chunk.choices[0].delta.content;
        // Auto scroll to bottom
        nextTick(() => {
          if (responseRef.value) {
            responseRef.value.scrollTop = responseRef.value.scrollHeight;
          }
        });
      }
    }
  } catch (error) {
    console.error('Error calling LLM:', error);
    response.value = getErrorMessage(error);
  } finally {
    isGenerating.value = false;
  }
};
</script>

<style scoped>
.llm-test-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 8px;
}

.provider-selection {
  display: flex;
  gap: 8px;
  align-items: center;
}

.provider-selection label {
  font-size: 13px;
  color: #495057;
}

.provider-selection select {
  padding: 4px;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  font-size: 13px;
}

.input-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

textarea {
  width: 100%;
  min-height: 100px;
  padding: 8px;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  resize: vertical;
  font-family: inherit;
  font-size: 13px;
  line-height: 1.4;
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

.response-section {
  border: 1px solid #dee2e6;
  border-radius: 4px;
  padding: 8px;
  min-height: 200px;
  max-height: 400px;
  overflow-y: auto;
}

.response-content {
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}
</style> 