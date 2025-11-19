/**
 * Provider implementation for customized OpenAI-compatible APIs
 * Allows user to configure custom endpoints and models per capability
 */
import { STORAGE_KEYS, getStoredValue, storeValue } from '../storageService.js';

export class CustomizedProvider {
  /**
   * Initialize the customized provider with user-defined configuration
   * @param {Object} client - The OpenAI-compatible client
   * @param {Object} config - The base provider configuration
   */
  constructor(client, config) {
    this.client = client;
    this.config = config;
    this.customConfig = null;
  }

  /**
   * Load custom configuration from storage
   * @returns {Promise<Object>} The custom configuration
   */
  async loadCustomConfig() {
    if (this.customConfig) {
      return this.customConfig;
    }

    try {
      const storedConfig = await getStoredValue(STORAGE_KEYS.CUSTOMIZED_CONFIG);
      if (storedConfig) {
        this.customConfig = JSON.parse(storedConfig);
      } else {
        // Default configuration
        this.customConfig = {
          baseURL: '',
          capabilities: {
            chat: {
              enabled: true,
              model: 'gpt-4o',
              endpoint: '/chat/completions'
            },
            vision: {
              enabled: false,
              model: 'gpt-4o',
              endpoint: '/chat/completions'
            },
            speech: {
              enabled: false,
              model: 'tts-1',
              endpoint: '/audio/speech'
            }
          }
        };
      }
    } catch (error) {
      console.error('Error loading custom configuration:', error);
      this.customConfig = {
        baseURL: '',
        capabilities: {
          chat: { enabled: true, model: 'gpt-4o', endpoint: '/chat/completions' },
          vision: { enabled: false, model: 'gpt-4o', endpoint: '/chat/completions' },
          speech: { enabled: false, model: 'tts-1', endpoint: '/audio/speech' }
        }
      };
    }

    return this.customConfig;
  }

  /**
   * Save custom configuration to storage
   * @param {Object} config - The configuration to save
   * @returns {Promise<void>}
   */
  async saveCustomConfig(config) {
    this.customConfig = config;
    await storeValue(STORAGE_KEYS.CUSTOMIZED_CONFIG, JSON.stringify(config));
  }

  /**
   * Get the appropriate model for a capability
   * @param {string} capability - The capability type (chat, vision, speech)
   * @returns {Promise<string>} The model to use
   */
  async getModelForCapability(capability) {
    const config = await this.loadCustomConfig();
    return config.capabilities[capability]?.model || this.config.defaultModel;
  }

  /**
   * Check if a capability is enabled
   * @param {string} capability - The capability type
   * @returns {Promise<boolean>} Whether the capability is enabled
   */
  async isCapabilityEnabled(capability) {
    const config = await this.loadCustomConfig();
    return config.capabilities[capability]?.enabled || false;
  }

  /**
   * Get the base URL for the custom provider
   * @returns {Promise<string>} The base URL
   */
  async getBaseURL() {
    const config = await this.loadCustomConfig();
    return config.baseURL || this.config.baseURL;
  }

  /**
   * Send a chat completion request
   * @param {Array} messages - The messages to send
   * @param {Object} options - Chat completion options
   * @returns {Object} The chat completion response
   */
  async chat(messages, options = {}) {
    try {
      // Load custom configuration
      const customConfig = await this.loadCustomConfig();

      if (!customConfig.baseURL) {
        throw new Error('Customized provider requires a base URL. Please configure it in the settings.');
      }

      // Ensure messages are in correct format, handling both text and image content
      const formattedMessages = messages.map(msg => {
        // Check if content is an array (multimodal) or string (text-only)
        if (Array.isArray(msg.content)) {
          // Format multimodal content for OpenAI vision API
          const formattedContent = msg.content.map(item => {
            if (item.type === 'text') {
              return { type: 'text', text: item.text };
            } else if (item.type === 'image' || item.type === 'image_url') {
              // Support both 'image' and 'image_url' types for flexibility
              const imageUrl = item.data ?
                `data:image/png;base64,${item.data}` :
                (item.image_url?.url || item.url);

              return {
                type: 'image_url',
                image_url: {
                  url: imageUrl,
                  detail: item.detail || 'auto' // 'low', 'high', or 'auto'
                }
              };
            }
            return item;
          });

          return {
            role: msg.role,
            content: formattedContent
          };
        } else {
          // Simple text message
          return {
            role: msg.role,
            content: msg.content
          };
        }
      });

      // Check if message contains images
      const hasImages = messages.some(msg =>
        Array.isArray(msg.content) &&
        msg.content.some(item => item.type === 'image' || item.type === 'image_url')
      );

      // Determine which capability to use
      const capability = hasImages ? 'vision' : 'chat';

      // Check if capability is enabled
      if (!customConfig.capabilities[capability]?.enabled) {
        throw new Error(`The ${capability} capability is not enabled for the customized provider. Please enable it in the settings.`);
      }

      // Get the model for this capability
      const model = customConfig.capabilities[capability]?.model || this.config.defaultModel;

      if (!model) {
        throw new Error(`No model configured for ${capability} capability. Please configure it in the settings.`);
      }

      const defaultOptions = {
        model: model,
        stream: true,
        temperature: 0.7,
        max_tokens: hasImages ? 4096 : 2000 // More tokens for image analysis
      };

      // Update client configuration with custom base URL if needed
      if (this.client._client && this.client._client.baseURL !== customConfig.baseURL) {
        this.client._client.baseURL = customConfig.baseURL;
      }

      const completion = await this.client.chat.completions.create({
        ...defaultOptions,
        ...options,
        messages: formattedMessages
      });

      return completion;
    } catch (error) {
      // Try to extract error message from response body
      let errorMessage = error.message || 'Unknown error occurred';
      let apiErrorDetails = null;

      // Check if error has response data
      if (error.response) {
        try {
          // For OpenAI SDK errors, the response might be in different places
          const responseData = error.response.data || error.response.body || error.response;

          if (typeof responseData === 'string') {
            // Try to parse as JSON
            apiErrorDetails = JSON.parse(responseData);
          } else if (typeof responseData === 'object') {
            apiErrorDetails = responseData;
          }

          // Extract message from parsed response
          if (apiErrorDetails?.message) {
            errorMessage = apiErrorDetails.message;
          } else if (apiErrorDetails?.error?.message) {
            errorMessage = apiErrorDetails.error.message;
          }
        } catch (parseError) {
          // If parsing fails, try to extract error from error.message
          // OpenAI SDK might include the response body in the error message
          if (error.message && error.message.includes('{')) {
            const jsonMatch = error.message.match(/\{.*\}/s);
            if (jsonMatch) {
              try {
                const parsed = JSON.parse(jsonMatch[0]);
                if (parsed.message) {
                  errorMessage = parsed.message;
                  apiErrorDetails = parsed;
                }
              } catch (e) {
                // Ignore parse error, use original message
              }
            }
          }
        }
      }

      // Handle 401 errors specifically
      if (error.status === 401) {
        const enhancedError = new Error(
          errorMessage.includes('token') || errorMessage.includes('expired') || errorMessage.includes('invalid')
            ? errorMessage
            : `401 Authentication Failed: ${errorMessage}`
        );
        enhancedError.originalError = error;
        enhancedError.provider = 'customized';
        enhancedError.status = 401;
        enhancedError.apiErrorDetails = apiErrorDetails;
        throw enhancedError;
      }

      // Handle 400 errors (Bad Request)
      if (error.status === 400) {
        const enhancedError = new Error(errorMessage);
        enhancedError.originalError = error;
        enhancedError.provider = 'customized';
        enhancedError.status = 400;
        enhancedError.apiErrorDetails = apiErrorDetails;
        throw enhancedError;
      }

      // Re-throw other errors with additional context
      const enhancedError = new Error(errorMessage);
      enhancedError.originalError = error;
      enhancedError.provider = 'customized';
      enhancedError.status = error.status;
      enhancedError.apiErrorDetails = apiErrorDetails;
      throw enhancedError;
    }
  }

  /**
   * Generate speech from text (TTS)
   * @param {string} text - The text to convert to speech
   * @param {Object} options - TTS options
   * @returns {Promise<ArrayBuffer>} The audio data
   */
  async generateSpeech(text, options = {}) {
    const customConfig = await this.loadCustomConfig();

    if (!customConfig.capabilities.speech?.enabled) {
      throw new Error('Speech capability is not enabled for the customized provider. Please enable it in the settings.');
    }

    const model = customConfig.capabilities.speech?.model || 'tts-1';
    const voice = options.voice || 'alloy';

    if (!customConfig.baseURL) {
      throw new Error('Customized provider requires a base URL. Please configure it in the settings.');
    }

    try {
      const response = await fetch(`${customConfig.baseURL}/audio/speech`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getApiKey()}`
        },
        body: JSON.stringify({
          model,
          input: text,
          voice,
          ...options
        })
      });

      if (!response.ok) {
        throw new Error(`Speech generation failed: ${response.statusText}`);
      }

      return await response.arrayBuffer();
    } catch (error) {
      console.error('Speech generation error:', error);
      throw error;
    }
  }

  /**
   * Get the API key for the customized provider
   * @returns {Promise<string>} The API key
   */
  async getApiKey() {
    const { getApiKey } = await import('../storageService.js');
    return await getApiKey(this.config);
  }
}