/**
 * Provider implementation for Google's Gemini API
 */
export class GeminiProvider {
  /**
   * Initialize the Gemini provider
   * @param {Object} client - The Gemini client
   * @param {Object} config - The provider configuration
   */
  constructor(client, config) {
    this.client = client;
    this.config = config;
  }

  /**
   * Send a chat to Gemini and get streaming response
   * @param {Array} messages - The messages to send
   * @param {Object} options - Additional options (unused)
   * @returns {AsyncGenerator} The streaming chat response
   */
  async* chat(messages, options = {}) {
    try {
      // Get the last user message
      const lastMessage = messages[messages.length - 1];
      if (!lastMessage || lastMessage.role !== 'user') {
        throw new Error('Last message must be from user');
      }

      // Build content parts for Gemini format
      const parts = [];

      // Check if the last message contains multimodal content
      if (Array.isArray(lastMessage.content)) {
        // Handle multimodal content
        for (const item of lastMessage.content) {
          if (item.type === 'text') {
            parts.push({ text: item.text });
          } else if (item.type === 'image' || item.type === 'image_url') {
            // Extract base64 data
            let base64Data = item.data;

            if (!base64Data && (item.image_url?.url || item.url)) {
              const url = item.image_url?.url || item.url;
              // Extract base64 from data URL if present
              const matches = url.match(/^data:image\/([^;]+);base64,(.+)$/);
              if (matches) {
                base64Data = matches[2];
              }
            }

            if (base64Data) {
              parts.push({
                inline_data: {
                  mime_type: 'image/png', // Default to PNG, adjust if needed
                  data: base64Data
                }
              });
            }
          }
        }

        // Add context from previous messages if any
        if (messages.length > 1) {
          const context = messages.slice(0, -1)
            .map(msg => {
              if (msg.role === 'system') return `System: ${msg.content}`;
              if (msg.role === 'assistant') return `Assistant: ${msg.content}`;
              return `User: ${msg.content}`;
            })
            .join('\n\n');

          // Prepend context as a text part
          parts.unshift({ text: context + '\n\n' });
        }
      } else {
        // Handle text-only content
        let prompt = lastMessage.content;
        if (messages.length > 1) {
          const context = messages.slice(0, -1)
            .map(msg => {
              if (msg.role === 'system') return `System: ${msg.content}`;
              if (msg.role === 'assistant') return `Assistant: ${msg.content}`;
              return `User: ${msg.content}`;
            })
            .join('\n\n');
          prompt = `${context}\n\nUser: ${prompt}`;
        }
        parts.push({ text: prompt });
      }

      // Send message and get streaming response
      const result = await this.client.generateContentStream(parts);

      for await (const chunk of result.stream) {
        yield {
          choices: [{
            delta: {
              content: chunk.text()
            }
          }]
        };
      }
    } catch (error) {
      console.error('Gemini API error:', error);

      // Enhance error message with provider context
      if (error.message?.includes('API key') ||
          error.message?.includes('unauthorized') ||
          error.message?.includes('401') ||
          error.status === 401) {
        const enhancedError = new Error(`401 Authentication Fails, Your api key: ${error.message?.split(':')[1]?.trim() || 'unknown'} is invalid`);
        enhancedError.originalError = error;
        enhancedError.provider = 'gemini';
        enhancedError.status = 401;
        throw enhancedError;
      }

      // Re-throw other errors with additional context
      const enhancedError = new Error(error.message || 'Unknown Gemini API error occurred');
      enhancedError.originalError = error;
      enhancedError.provider = 'gemini';
      enhancedError.status = error.status;
      throw enhancedError;
    }
  }
} 