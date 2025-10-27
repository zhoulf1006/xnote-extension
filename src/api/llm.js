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

  /**
   * Analyze an image using the current LLM provider's vision capabilities
   * @param {string} imageData - Base64 encoded image data (with or without data URL prefix)
   * @param {string} prompt - The prompt/instruction for analyzing the image
   * @param {Object} options - Additional options for the LLM
   * @returns {Promise} The LLM's response
   */
  async analyzeImage(imageData, prompt = "Extract all text from this image accurately. Format the output clearly.", options = {}) {
    // Ensure provider is initialized
    await this.ensureInitialized();

    // Check if current provider supports vision
    if (!this.supportsVision()) {
      throw new Error(`The ${this.config.name} provider does not support image analysis. Please switch to OpenAI or Gemini to use this feature.`);
    }

    // Strip data URL prefix if present
    let base64Data = imageData;
    if (imageData.startsWith('data:')) {
      const matches = imageData.match(/^data:image\/[^;]+;base64,(.+)$/);
      if (matches && matches[1]) {
        base64Data = matches[1];
      }
    }

    // Format message for multimodal input
    const messages = [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: prompt
          },
          {
            type: 'image',
            data: base64Data
          }
        ]
      }
    ];

    // Use the chat method with image content
    return this.providerInstance.chat(messages, {
      ...options,
      stream: options.stream !== undefined ? options.stream : true
    });
  }

  /**
   * Check if the current provider supports vision/image analysis
   * @returns {boolean} True if provider supports vision
   */
  supportsVision() {
    return this.config?.supportsVision === true;
  }

  /**
   * Extract text from an image using OCR-optimized prompts
   * @param {string} imageData - Base64 encoded image data
   * @param {Object} options - Additional options
   * @returns {Promise} Extracted text
   */
  async extractTextFromImage(imageData, options = {}) {
    const prompt = `Please extract ALL text from this image.
Follow these guidelines:
1. Preserve the original formatting and structure
2. Include all visible text, even if partially obscured
3. Maintain line breaks and paragraph structure
4. If there are tables, preserve their structure
5. If there are multiple columns, process them in reading order

Output the extracted text clearly without any additional commentary.`;

    return this.analyzeImage(imageData, prompt, options);
  }
}

// Export a singleton instance
export const llmService = new LLMService();