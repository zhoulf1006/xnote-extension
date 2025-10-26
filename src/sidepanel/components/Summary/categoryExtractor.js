import { streamChat } from '@/api/chatService';

/**
 * Extract category from existing summary that contains ## Category section
 * @param {string} summary - The summary text
 * @returns {Object|null} { mainCategory, subCategory } or null if not found
 */
export function extractCategoryFromSummary(summary) {
  try {
    // Look for ## Category section
    const categoryMatch = summary.match(/##\s*Category\s*\n([^\n]+)/);
    if (categoryMatch) {
      const categoryLine = categoryMatch[1].trim();
      // Parse "Main Category > Subcategory" format
      const parts = categoryLine.split('>').map(s => s.trim());
      if (parts.length === 2) {
        return {
          mainCategory: parts[0],
          subCategory: parts[1]
        };
      }
    }
  } catch (error) {
    console.error('Error extracting category from summary:', error);
  }
  return null;
}

/**
 * Generate category suggestion using LLM for a page
 * @param {Object} pageData - Page data with title, url, and summary
 * @returns {Promise<Object>} { mainCategory, subCategory }
 */
export async function generateCategoryForPage(pageData) {
  const prompt = `Based on this webpage, suggest a two-level category for organizing it.
Title: ${pageData.title}
URL: ${pageData.url}
Summary: ${pageData.summary ? pageData.summary.substring(0, 500) : 'No summary available'}

Respond ONLY with the category in this format: "Main Category > Subcategory"

Main categories should be broad domains (Education, Technology, Business, Health, Entertainment, Science, News, Lifestyle, Sports, Arts, Finance, Travel, Food, Gaming, Politics, etc.)
Subcategories should be specific within that domain.

Examples:
- Technology > Machine Learning
- Education > Online Courses
- Health > Nutrition
- Business > Marketing
- Science > Physics
- Entertainment > Streaming Services

Your response should be exactly in the format: "Main Category > Subcategory"`;

  try {
    let fullResponse = '';

    await streamChat([
      {
        role: 'system',
        content: 'You are a helpful assistant that categorizes web content. Respond only with the category in the exact format requested.'
      },
      {
        role: 'user',
        content: prompt
      }
    ], {
      onChunk: (chunk) => {
        fullResponse += chunk;
      },
      onComplete: () => {},
      onError: (error) => {
        throw error;
      }
    });

    // Parse the response
    const cleanResponse = fullResponse.trim();
    const parts = cleanResponse.split('>').map(s => s.trim());

    if (parts.length === 2) {
      return {
        mainCategory: parts[0],
        subCategory: parts[1]
      };
    } else {
      // Fallback if parsing fails
      console.warn('Could not parse category response:', cleanResponse);
      return {
        mainCategory: 'General',
        subCategory: 'Uncategorized'
      };
    }
  } catch (error) {
    console.error('Error generating category:', error);
    // Return default categories on error
    return {
      mainCategory: 'General',
      subCategory: 'Uncategorized'
    };
  }
}

/**
 * Get common subcategory suggestions based on main category
 * @param {string} mainCategory - The main category
 * @returns {Array<string>} List of suggested subcategories
 */
export function getSubcategorySuggestions(mainCategory) {
  const suggestions = {
    'Technology': ['AI Research', 'Web Development', 'Software Engineering', 'Cybersecurity', 'Mobile Apps', 'Cloud Computing'],
    'Education': ['Programming', 'Online Courses', 'Mathematics', 'Science', 'Languages', 'Academic Research'],
    'Business': ['Startups', 'Marketing', 'Finance', 'Management', 'E-commerce', 'Entrepreneurship'],
    'Health': ['Nutrition', 'Mental Wellness', 'Fitness', 'Medical Research', 'Healthcare', 'Alternative Medicine'],
    'Entertainment': ['Movies', 'Music', 'Gaming', 'Books', 'TV Shows', 'Streaming Services'],
    'Science': ['Physics', 'Biology', 'Chemistry', 'Astronomy', 'Environmental Science', 'Research'],
    'News': ['Politics', 'World News', 'Local News', 'Technology News', 'Business News', 'Sports News'],
    'Lifestyle': ['Fashion', 'Travel', 'Food', 'Home Design', 'Relationships', 'Personal Development'],
    'Sports': ['Football', 'Basketball', 'Soccer', 'Tennis', 'Fitness', 'Olympics'],
    'Arts': ['Visual Arts', 'Music', 'Literature', 'Photography', 'Design', 'Architecture'],
    'Finance': ['Investing', 'Banking', 'Cryptocurrency', 'Personal Finance', 'Stock Market', 'Real Estate'],
    'Travel': ['Destinations', 'Travel Tips', 'Hotels', 'Adventure', 'Culture', 'Budget Travel'],
    'Food': ['Recipes', 'Restaurants', 'Cooking', 'Nutrition', 'Wine', 'Baking'],
    'Gaming': ['PC Gaming', 'Console Gaming', 'Mobile Gaming', 'Game Reviews', 'eSports', 'Game Development'],
    'Politics': ['Elections', 'Policy', 'International Relations', 'Government', 'Political Analysis', 'Activism']
  };

  return suggestions[mainCategory] || ['General'];
}