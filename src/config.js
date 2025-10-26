// Load environment variables from .env file

export const config = {
  // Azure OpenAI Configuration
  AZURE_OPENAI_ENDPOINT: import.meta.env.VITE_AZURE_OPENAI_ENDPOINT || '',
  AZURE_OPENAI_API_VERSION: import.meta.env.VITE_AZURE_OPENAI_API_VERSION || '2024-08-01-preview',
  AZURE_OPENAI_DEPLOYMENT: import.meta.env.VITE_AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
  AZURE_OPENAI_KEY: import.meta.env.VITE_AZURE_OPENAI_KEY,

  // Azure Speech Service Configuration
  AZURE_SPEECH_KEY: import.meta.env.VITE_AZURE_SPEECH_KEY,
  AZURE_SPEECH_REGION: import.meta.env.VITE_AZURE_SPEECH_REGION || 'japanwest'
}
