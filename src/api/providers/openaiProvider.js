/**
 * Provider implementation for OpenAI compatible APIs (OpenAI, DeepSeek)
 */
export class OpenAIProvider {
  /**
   * Initialize the OpenAI provider
   * @param {Object} client - The OpenAI client
   * @param {Object} config - The provider configuration
   */
  constructor(client, config) {
    this.client = client;
    this.config = config;
  }

  /**
   * Send a chat completion request
   * @param {Array} messages - The messages to send
   * @param {Object} options - Chat completion options
   * @returns {Object} The chat completion response
   */
  async chat(messages, options = {}) {
    try {
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

      // Use vision model if images are detected
      const hasImages = messages.some(msg =>
        Array.isArray(msg.content) &&
        msg.content.some(item => item.type === 'image' || item.type === 'image_url')
      );

      // Check if provider supports vision when images are present
      if (hasImages && !this.config.supportsVision) {
        throw new Error(`The ${this.config.name} provider does not support image analysis.`);
      }

      const defaultOptions = {
        model: hasImages ?
          (this.config.visionModel || this.config.defaultModel) :
          this.config.defaultModel,
        stream: true,
        temperature: 0.7,
        max_tokens: hasImages ? 4096 : 2000 // More tokens for image analysis
      };

      const completion = await this.client.chat.completions.create({
        ...defaultOptions,
        ...options,
        messages: formattedMessages
      });

      return completion;
    } catch (error) {
      // Enhance error message with provider context
      if (error.status === 401) {
        const providerName = this.config.name || 'OpenAI';
        const enhancedError = new Error(`401 Authentication Fails, Your api key: ${error.message?.split(':')[1]?.trim() || 'unknown'} is invalid`);
        enhancedError.originalError = error;
        enhancedError.provider = providerName.toLowerCase();
        throw enhancedError;
      }

      // Re-throw other errors with additional context
      const enhancedError = new Error(error.message || 'Unknown error occurred');
      enhancedError.originalError = error;
      enhancedError.provider = this.config.name?.toLowerCase() || 'openai';
      enhancedError.status = error.status;
      throw enhancedError;
    }
  }
} 