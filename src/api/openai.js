import { config } from '../config'

const {
  AZURE_OPENAI_ENDPOINT,
  AZURE_OPENAI_API_VERSION,
  AZURE_OPENAI_DEPLOYMENT,
  AZURE_OPENAI_KEY
} = config

/**
 * Stream chat completions from Azure OpenAI
 * @param {Array} messages - Array of message objects with role and content
 * @param {Object} options - API options (temperature, max_tokens, etc.)
 * @param {Function} onChunk - Callback for each chunk of streamed response
 * @param {Function} onComplete - Callback when streaming is complete
 * @param {Function} onError - Callback for error handling
 */
export async function streamChatCompletions(
  messages,
  options = {},
  onChunk,
  onComplete,
  onError
) {
  try {
    const response = await fetch(`${AZURE_OPENAI_ENDPOINT}/openai/deployments/${AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=${AZURE_OPENAI_API_VERSION}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': AZURE_OPENAI_KEY
      },
      body: JSON.stringify({
        messages,
        stream: true,
        ...options
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullResponse = '';

    // Helper function to process SSE message
    const processMessage = async (rawMessage) => {
      // Handle special SSE messages
      if (rawMessage === '[DONE]') {
        return;
      }

      // Skip empty messages
      if (!rawMessage.trim()) return;

      try {
        const data = JSON.parse(rawMessage);
        // Handle chat completion format
        if (data.choices?.[0]?.delta?.content) {
          const content = data.choices[0].delta.content;
          fullResponse += content;
          if (onChunk) {
            await onChunk(content);
          }
        }
        // Handle regular completion format
        else if (data.choices?.[0]?.text) {
          const content = data.choices[0].text;
          fullResponse += content;
          if (onChunk) {
            await onChunk(content);
          }
        }
        // Log unexpected message structure
        else {
          console.debug('Skipping message with unexpected structure:', data);
        }
      } catch (err) {
        // Only log parsing errors for non-control messages
        if (rawMessage !== '[DONE]') {
          console.warn('Invalid JSON:', rawMessage, err);
        }
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        if (onComplete && fullResponse) {
          await onComplete(fullResponse);
        }
        break;
      }

      // Append new data to existing buffer
      buffer += decoder.decode(value, { stream: true });
      
      // Process complete lines from buffer
      const lines = buffer.split('\n');
      // Keep the last incomplete line in buffer
      buffer = lines.pop() || '';

      for (const line of lines) {
        const line_trim = line.trim();
        // Skip empty lines
        if (!line_trim) continue;
        
        // Check for SSE data prefix
        if (!line_trim.startsWith('data: ')) continue;
        
        // Extract and process the data part
        const data = line_trim.slice(5).trim();
        await processMessage(data);
      }
    }

  } catch (error) {
    console.error('Streaming error:', error);
    if (onError) {
      await onError(error);
    } else {
      throw error;
    }
  }
}
