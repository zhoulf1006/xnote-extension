import { llmService } from './llm';

export async function streamChat(messages, {
  onChunk = () => {},
  onComplete = () => {},
  onError = () => {}
} = {}) {
  try {
    // Check if service requires configuration before attempting to chat
    if (llmService.requiresConfiguration) {
      throw new Error(
        llmService.getConfigurationError() ||
        'LLM service is not configured. Please set up your API key in the settings.'
      );
    }

    let fullResponse = '';

    // Ensure messages include system prompt if not present
    const systemPrompt = {
      role: 'system',
      content: 'You are a helpful assistant. Provide clear and concise responses.'
    };

    const hasSystemMessage = messages.some(msg => msg.role === 'system');
    let chatMessages = hasSystemMessage ? [...messages] : [systemPrompt, ...messages];

    // Ensure messages are in correct order: system -> user/assistant pairs -> last user
    if (chatMessages[chatMessages.length - 1].role !== 'user') {
      throw new Error('Last message must be from user');
    }

    const completion = await llmService.chat(chatMessages);

    // Handle streaming response
    for await (const chunk of completion) {
      const content = chunk.choices[0]?.delta?.content || '';
      fullResponse += content;
      await onChunk(content);
    }

    await onComplete(fullResponse);
    return fullResponse;
  } catch (error) {
    console.error('Chat service error:', error);
    onError(error);
    throw error;
  }
} 