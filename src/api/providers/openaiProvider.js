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
      // Ensure messages are in correct format
      const formattedMessages = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      const defaultOptions = {
        model: this.config.defaultModel,
        stream: true,
        temperature: 0.7,
        max_tokens: 2000
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