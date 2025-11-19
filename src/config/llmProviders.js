export const llmProviders = {
  openai: {
    name: 'OpenAI',
    baseURL: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
    apiKeyEnv: 'VITE_OPENAI_API_KEY',
    clientType: 'openai',
    supportsVision: true, // Supports image analysis
    supportsSpeech: true, // Supports TTS
    models: {
      chat: 'gpt-4o',
      vision: 'gpt-4o',
      speech: 'tts-1'
    }
  },
  deepseek: {
    name: 'DeepSeek',
    baseURL: 'https://api.deepseek.com',
    defaultModel: 'deepseek-chat',
    apiKeyEnv: 'VITE_DEEPSEEK_API_KEY',
    clientType: 'openai',
    supportsVision: false // DeepSeek API does not support vision
  },
  gemini: {
    name: 'Gemini',
    model: 'gemini-2.0-flash',
    apiKeyEnv: 'VITE_GEMINI_API_KEY',
    clientType: 'gemini',
    supportsVision: true // Gemini 2.0 Flash supports vision
  },
  customized: {
    name: 'Customized',
    baseURL: '', // User-configurable
    defaultModel: 'gpt-4o',
    apiKeyEnv: 'VITE_CUSTOMIZED_API_KEY',
    clientType: 'customized',
    supportsVision: true, // User can enable/disable
    supportsSpeech: false, // User can enable/disable
    requiresConfiguration: true,
    models: {
      chat: '', // User-configurable
      vision: '', // User-configurable
      speech: '' // User-configurable
    }
  }
};

export const defaultProvider = 'gemini';
export const LLM_PROVIDER_STORAGE_KEY = 'xnote-llm-provider';