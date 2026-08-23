import OpenAI from 'openai';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { llmProviders, LLM_PROVIDER_STORAGE_KEY } from '@/config/llmProviders';
import { getApiKey, getStoredValue, STORAGE_KEYS } from '@/api/storageService';

/**
 * Provider Factory class that handles creation and configuration of LLM providers
 */
export class ProviderFactory {
  /**
   * Creates a configured client for the specified provider
   * @param {string} providerName - The name of the provider to create
   * @param {boolean} [allowEmptyKeys=false] - Whether to allow empty API keys (useful during setup)
   * @returns {Promise<Object>} The configured client, provider configuration, and requiresConfiguration flag
   */
  static async createProvider(providerName, allowEmptyKeys = false) {
    const registryConfig = llmProviders[providerName];

    if (!registryConfig) {
      throw new Error(`Unknown provider: ${providerName}`);
    }

    // Carry the registry key so providers can resolve their stored model selection
    const providerConfig = { ...registryConfig, key: providerName };

    // Get API key, allowing empty values (don't throw on missing key)
    const apiKey = await ProviderFactory.getApiKey(providerConfig, true);
    let client = null;
    let requiresConfiguration = false;

    // Only create actual clients if we have a valid API key
    if (apiKey && apiKey !== 'dev-dummy-key') {
      switch (providerConfig.clientType) {
        case 'openai':
          client = ProviderFactory.createOpenAIClient(providerConfig, apiKey);
          break;
        case 'customized':
          client = await ProviderFactory.createCustomizedClient(providerConfig, apiKey);
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
      // In production with no API key, return "requires configuration" state instead of throwing
      console.warn(`Provider ${providerName} requires API key configuration`);
      requiresConfiguration = true;
    }

    return {
      client,
      config: providerConfig,
      requiresConfiguration
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
   * @returns {GoogleGenerativeAI} The Gemini API client (model instance is
   *   created per request so the user's model selection applies immediately)
   */
  static createGeminiClient(config, apiKey) {
    return new GoogleGenerativeAI(apiKey);
  }

  /**
   * Create and configure a customized OpenAI-compatible client
   * @param {Object} config - The provider configuration
   * @param {string} apiKey - The API key
   * @returns {Promise<OpenAI>} The configured OpenAI client with custom settings
   */
  static async createCustomizedClient(config, apiKey) {
    // Load custom configuration from storage
    let customConfig = {};
    try {
      const storedConfig = await getStoredValue(STORAGE_KEYS.CUSTOMIZED_CONFIG);
      if (storedConfig) {
        customConfig = JSON.parse(storedConfig);
      }
    } catch (error) {
      console.warn('Failed to load custom configuration, using defaults:', error);
    }

    // Use custom base URL if configured, otherwise fall back to config
    const baseURL = customConfig.baseURL || config.baseURL;

    if (!baseURL) {
      console.warn('No base URL configured for customized provider');
    }

    const options = {
      baseURL: baseURL || 'https://api.openai.com/v1', // Default to OpenAI if not configured
      apiKey: apiKey,
      dangerouslyAllowBrowser: true
    };

    // Don't add api-version for customized providers to maintain compatibility
    // The user can include it in the base URL if needed

    return new OpenAI(options);
  }
} 