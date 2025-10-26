import { llmProviders, defaultProvider, LLM_PROVIDER_STORAGE_KEY } from '@/config/llmProviders';
import { ProviderFactory } from './providers/providerFactory';
import { getProviderImplementation } from './providers/providerRegistry';

export class LLMService {
  constructor(provider = defaultProvider) {
    const savedProvider = localStorage.getItem(LLM_PROVIDER_STORAGE_KEY) || provider;
    // Initialize with empty provider - will be set asynchronously
    this.currentProvider = savedProvider;
    this.providerInstance = null;
    this.config = null;
    this.isInitialized = false;
    this.initializationPromise = this.setProvider(savedProvider);
  }

  async setProvider(providerName) {
    // Check if provider exists in configuration
    if (!llmProviders[providerName]) {
      throw new Error(`Unknown provider: ${providerName}`);
    }

    this.currentProvider = providerName;
    
    try {
      // Detect development mode
      const isDevelopment = typeof window !== 'undefined' && 
                          window.location && 
                          window.location.hostname === 'localhost';
      
      // Create the provider instance, allowing empty keys in development mode
      const { client, config } = await ProviderFactory.createProvider(
        providerName, 
        isDevelopment // allowEmptyKeys = true in development mode
      );
      
      // If we have a real client, initialize the provider
      if (client) {
        const ProviderClass = getProviderImplementation(config.clientType);
        this.providerInstance = new ProviderClass(client, config);
        this.config = config;
        this.isInitialized = true;
      } else if (isDevelopment) {
        // In development with no API key, create a mock provider
        console.log(`Using mock provider for ${providerName} in development mode`);
        this.providerInstance = {
          chat: async () => ({ content: 'This is a development mode mock response. Please set up API keys.' })
        };
        this.config = { ...llmProviders[providerName], _isDevelopmentMock: true };
        this.isInitialized = true;
      }
      
      // Save the current provider to localStorage
      localStorage.setItem(LLM_PROVIDER_STORAGE_KEY, providerName);
    } catch (error) {
      console.error(`Failed to initialize provider ${providerName}:`, error);
      this.isInitialized = false;
      throw error;
    }
  }

  async ensureInitialized() {
    if (this.initializationPromise) {
      await this.initializationPromise;
      this.initializationPromise = null;
    }
    
    if (!this.isInitialized) {
      throw new Error(`LLM Service not properly initialized for provider: ${this.currentProvider}`);
    }
  }

  async chat(messages, options = {}) {
    // Ensure provider is initialized
    await this.ensureInitialized();
    
    // Delegate to the provider implementation
    return this.providerInstance.chat(messages, options);
  }
}

// Export a singleton instance
export const llmService = new LLMService();