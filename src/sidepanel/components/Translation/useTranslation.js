import { ref } from 'vue';
import { streamChat } from '@/api/chatService';
import { TranslationPrompt } from './prompts';
import { useLLMConfigStore } from '@/stores/llmConfig';

export function useTranslation() {
  const translatedText = ref('');
  const isTranslating = ref(false);
  const error = ref(null);
  const llmConfigStore = useLLMConfigStore();

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
      
      const currentProvider = llmConfigStore.selectedProvider;
      const providerName = currentProvider ? 
        (currentProvider.charAt(0).toUpperCase() + currentProvider.slice(1)) : 'LLM';
      
      return `❌ **API Key Error**

Your ${providerName} API key appears to be invalid or missing.

**To fix this:**
1. Click the **⚙️ LLM Config** button at the bottom of the sidebar
2. Enter a valid ${providerName} API key
3. Click **Save** to update your configuration
4. Try translating again

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
    return `❌ **Translation Error**

${errorMessage}

Please try again or check your LLM configuration in the settings.`;
  };

  const translate = async (text) => {
    if (!text || isTranslating.value) return;

    isTranslating.value = true;
    translatedText.value = '';
    error.value = null;

    try {
      await streamChat([
        {
          role: 'system',
          content: TranslationPrompt
        },
        {
          role: 'user',
          content: text
        }
      ], {
        onChunk: async (chunk) => {
          translatedText.value += chunk;
        },
        onComplete: async () => {
          isTranslating.value = false;
        },
        onError: async (err) => {
          console.error('Translation error:', err);
          error.value = getErrorMessage(err);
          isTranslating.value = false;
        }
      });
    } catch (err) {
      console.error('Translation error:', err);
      error.value = getErrorMessage(err);
      isTranslating.value = false;
    }
  };

  return {
    translatedText,
    isTranslating,
    error,
    translate
  };
} 