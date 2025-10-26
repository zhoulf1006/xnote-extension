import { OpenAIProvider } from './openaiProvider';
import { GeminiProvider } from './geminiProvider';

/**
 * Registry that maps provider types to their implementation classes
 */
export const ProviderRegistry = {
  'openai': OpenAIProvider,
  'gemini': GeminiProvider
};

/**
 * Get the provider implementation class for a given provider type
 * @param {string} providerType - The provider type
 * @returns {Class} The provider implementation class
 */
export function getProviderImplementation(providerType) {
  const ProviderClass = ProviderRegistry[providerType];
  
  if (!ProviderClass) {
    throw new Error(`No implementation found for provider type: ${providerType}`);
  }
  
  return ProviderClass;
} 