export const llmProviders = {
  openai: {
    name: 'OpenAI',
    baseURL: 'https://api.rdsec.trendmicro.com/prod/aiendpoint/v1/',
    defaultModel: 'gpt-4',
    apiVersion: '2024-02-15-preview',
    apiKeyEnv: 'VITE_AZURE_OPENAI_KEY',
    clientType: 'openai'
  },
  deepseek: {
    name: 'DeepSeek',
    baseURL: 'https://api.deepseek.com',
    defaultModel: 'deepseek-chat',
    apiKeyEnv: 'VITE_DEEPSEEK_API_KEY',
    clientType: 'openai'
  },
  gemini: {
    name: 'Gemini',
    model: 'gemini-2.0-flash',
    apiKeyEnv: 'VITE_GEMINI_API_KEY',
    clientType: 'gemini'
  }
};

export const defaultProvider = 'gemini';
export const LLM_PROVIDER_STORAGE_KEY = 'xnote-llm-provider';