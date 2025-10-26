import { v4 as uuidv4 } from 'uuid';
import { streamChat } from '@/api/chatService';

export const createSummaryPrompt = (pageData) => {
  return `Please provide a concise summary of the following webpage content:

Title: ${pageData.title}
URL: ${pageData.url}

Content:
${pageData.content}

The summary should capture the main points and key details of the text while conveying the author's intended meaning accurately. Please ensure that the summary is well-organized and easy to read, with clear headings and subheadings to guide the reader through each section. The length of the summary should be appropriate to capture the main points and key details of the text, without including unnecessary information or becoming overly long.

Additionally, at the end of your summary, please add a section called "## Category" and suggest an appropriate two-level category for organizing this content. Use the format "Main Category > Subcategory".

Main categories should be broad domains like: Education, Technology, Business, Health, Entertainment, Science, News, Lifestyle, Sports, Arts, Finance, Travel, Food, Gaming, Politics, etc.

Subcategories should be more specific within that domain. Examples:
- Technology > AI Research
- Education > Programming
- Health > Mental Wellness
- Business > Startups
- Entertainment > Movies
`;
};

export const streamSummary = async (content, onChunk, onComplete, onError) => {
  try {
    await streamChat([
      {
        role: 'system',
        content: 'You are a helpful assistant that specializes in summarizing web content and articles.'
      },
      {
        role: 'user',
        content: content
      }
    ], {
      onChunk,
      onComplete,
      onError
    });
  } catch (error) {
    console.error('Error in streamSummary:', error);
    onError(error);
  }
};