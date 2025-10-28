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
        const providerName = this.config.name || 'OpenAI';
        const enhancedError = new Error(
          errorMessage.includes('token') || errorMessage.includes('expired') || errorMessage.includes('invalid')
            ? errorMessage
            : `401 Authentication Failed: ${errorMessage}`
        );
        enhancedError.originalError = error;
        enhancedError.provider = providerName.toLowerCase();
        enhancedError.status = 401;
        enhancedError.apiErrorDetails = apiErrorDetails;
        throw enhancedError;
      }

      // Handle 400 errors (Bad Request)
      if (error.status === 400) {
        const enhancedError = new Error(errorMessage);
        enhancedError.originalError = error;
        enhancedError.provider = this.config.name?.toLowerCase() || 'openai';
        enhancedError.status = 400;
        enhancedError.apiErrorDetails = apiErrorDetails;
        throw enhancedError;
      }

      // Re-throw other errors with additional context
      const enhancedError = new Error(errorMessage);
      enhancedError.originalError = error;
      enhancedError.provider = this.config.name?.toLowerCase() || 'openai';
      enhancedError.status = error.status;
      enhancedError.apiErrorDetails = apiErrorDetails;
      throw enhancedError;
    }
  }
} 