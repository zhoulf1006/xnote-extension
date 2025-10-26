import OpenAI from 'openai';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { llmProviders, LLM_PROVIDER_STORAGE_KEY } from '@/config/llmProviders';
import { getApiKey } from '@/api/storageService';

/**
 * Provider Factory class that handles creation and configuration of LLM providers
 */
export class ProviderFactory {
  /**
   * Creates a configured client for the specified provider
   * @param {string} providerName - The name of the provider to create
   * @param {boolean} [allowEmptyKeys=false] - Whether to allow empty API keys (useful during setup)
   * @returns {Promise<Object>} The configured client and provider configuration
   */
  static async createProvider(providerName, allowEmptyKeys = false) {
    const providerConfig = llmProviders[providerName];
    
    if (!providerConfig) {
      throw new Error(`Unknown provider: ${providerName}`);
    }
    
    // Get API key, allowing empty values in dev mode
    const apiKey = await ProviderFactory.getApiKey(providerConfig, allowEmptyKeys);
    let client = null;
    
    // Only create actual clients if we have a valid API key
    if (apiKey && apiKey !== 'dev-dummy-key') {
      switch (providerConfig.clientType) {
        case 'openai':
          client = ProviderFactory.createOpenAIClient(providerConfig, apiKey);
          break;
        case 'gemini':
          client = ProviderFactory.createGeminiClient(providerConfig, apiKey);
          break;
        default:
          throw new Error(`Unsupported client type: ${providerConfig.clientType}`);
      }
    } else if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      // In development mode with no API key, create a mock client
      console.warn(`Creating mock client for ${providerName} in development mode (no API key provided)`);
      client = { _isDevelopmentMock: true };
    } else {
      // In production with no API key, throw error
      throw new Error(`API key required for provider: ${providerName}`);
    }
    
    return {
      client,
      config: providerConfig
    };
  }
  
  /**
   * Get the API key for a provider from storage or environment variables
   * @param {Object} providerConfig - The provider configuration
   * @param {boolean} [allowEmpty=false] - Whether to allow empty keys in development mode
   * @returns {Promise<string>} The API key
   */
  static async getApiKey(providerConfig, allowEmpty = false) {
    try {
      return await getApiKey(providerConfig, allowEmpty);
    } catch (error) {
      // In development mode, provide a dummy key to prevent errors during setup
      if (typeof window !== 'undefined' && 
          window.location && 
          window.location.hostname === 'localhost') {
        console.warn(`Using dummy key for ${providerConfig.name} in development mode`);
        return 'dev-dummy-key';
      }
      throw error;
    }
  }
  
  /**
   * Create and configure an OpenAI compatible client
   * @param {Object} config - The provider configuration
   * @param {string} apiKey - The API key
   * @returns {OpenAI} The configured OpenAI client
   */
  static createOpenAIClient(config, apiKey) {
    const options = {
      baseURL: config.baseURL,
      apiKey: apiKey,
      dangerouslyAllowBrowser: true
    };
    
    if (config.apiVersion) {
      options.defaultQuery = { 'api-version': config.apiVersion };
    }
    
    return new OpenAI(options);
  }
  
  /**
   * Create and configure a Gemini client
   * @param {Object} config - The provider configuration
   * @param {string} apiKey - The API key
   * @returns {Object} The configured Gemini client
   */
  static createGeminiClient(config, apiKey) {
    const genAI = new GoogleGenerativeAI(apiKey);
    return genAI.getGenerativeModel({ model: config.model });
  }
} 