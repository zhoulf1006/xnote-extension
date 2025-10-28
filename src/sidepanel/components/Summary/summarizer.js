import { v4 as uuidv4 } from 'uuid';
import { streamChat } from '@/api/chatService';

export const createSummaryPrompt = (pageData) => {
  return `Please provide a concise summary of the following webpage content:

Title: ${pageData.title}
URL: ${pageData.url}

Content:
${pageData.content}

Your entire response must be formatted using Markdown. The summary must be structured in the following two parts:

## Overall Summary
Provide a single, 1-2 sentence paragraph that captures the absolute main point, thesis, or conclusion of the text.

## Key Highlights
Create a bulleted list of the 3-5 most critical takeaways, key findings, or actionable insights from the article. Focus only on high-level concepts and their implications, not on specific examples, data points, or granular details.

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