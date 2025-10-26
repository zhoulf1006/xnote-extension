import { defineStore } from 'pinia';
import { llmProviders, defaultProvider, LLM_PROVIDER_STORAGE_KEY } from '@/config/llmProviders';
import { llmService } from '@/api/llm';

export const useLLMConfigStore = defineStore('llmConfig', {
  state: () => ({
    selectedProvider: localStorage.getItem(LLM_PROVIDER_STORAGE_KEY) || defaultProvider
  }),

  actions: {
    async setProvider(provider) {
      this.selectedProvider = provider;
      localStorage.setItem(LLM_PROVIDER_STORAGE_KEY, provider);
      await llmService.setProvider(provider);
    },
    
    /**
     * Reinitialize the LLM service with the current provider
     * Useful after API key changes
     * @returns {Promise<void>}
     */
    async reinitializeService() {
      try {
        await llmService.setProvider(this.selectedProvider);
        return true;
      } catch (error) {
        console.error('Failed to reinitialize LLM service:', error);
        
        // In development mode, show more helpful error
        if (window.location.hostname === 'localhost') {
          console.log('Development mode detected: You can continue using the app with a mock LLM service. Please configure API keys in the LLM Provider settings to use real providers.');
          return true; // Return true in dev mode to not block UI
        }
        
        return false;
      }
    }
  }
}); 