// Provider registry. defaultModel is the last-resort fallback only — the model
// actually used is resolved at request time from the user's stored selection
// (see modelConfigService). Model lists come from each provider's list-models API.
export const llmProviders = {
  openai: {
    name: 'OpenAI',
    baseURL: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
    apiKeyEnv: 'VITE_OPENAI_API_KEY',
    clientType: 'openai',
    supportsVision: true
  },
  deepseek: {
    name: 'DeepSeek',
    baseURL: 'https://api.deepseek.com',
    defaultModel: 'deepseek-chat',
    apiKeyEnv: 'VITE_DEEPSEEK_API_KEY',
    clientType: 'openai',
    supportsVision: true // DeepSeek offers vision models (e.g. the vision-exp line)
  },
  gemini: {
    name: 'Gemini',
    defaultModel: 'gemini-2.0-flash',
    apiKeyEnv: 'VITE_GEMINI_API_KEY',
    clientType: 'gemini',
    supportsVision: true
  },
  customized: {
    name: 'Customized',
    baseURL: '', // User-configurable
    defaultModel: 'gpt-4o',
    apiKeyEnv: 'VITE_CUSTOMIZED_API_KEY',
    clientType: 'customized',
    supportsVision: true, // User can enable/disable
    requiresConfiguration: true
  }
};

export const defaultProvider = 'gemini';
export const LLM_PROVIDER_STORAGE_KEY = 'xnote-llm-provider';
