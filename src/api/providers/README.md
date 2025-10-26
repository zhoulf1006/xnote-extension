# LLM Providers

This directory contains the implementation for different LLM providers used in the application.

## Structure

- `providerFactory.js` - Factory that creates and configures provider clients
- `providerRegistry.js` - Registry that maps provider types to implementation classes
- `openaiProvider.js` - OpenAI-compatible provider implementation
- `geminiProvider.js` - Google Gemini provider implementation

## How it Works

1. The application selects a provider (e.g., "openai", "gemini", "deepseek")
2. The `ProviderFactory` creates the appropriate client configuration based on provider settings
3. The `ProviderRegistry` finds the right implementation class for the provider type
4. The LLM service delegates chat requests to the provider implementation

## Adding a New Provider

1. Update `src/config/llmProviders.js` to add your new provider configuration:
```js
myNewProvider: {
  name: 'My New Provider',
  baseURL: 'https://api.mynewprovider.com',
  defaultModel: 'my-model',
  apiKeyEnv: 'VITE_MYNEWPROVIDER_API_KEY',
  clientType: 'openai' // Use existing type if compatible
}
```

2. If your provider uses a new client type, create a new provider implementation file:
```js
// myNewProviderType.js
export class MyNewProviderImplementation {
  constructor(client, config) {
    this.client = client;
    this.config = config;
  }
  
  async chat(messages, options = {}) {
    // Implementation details
  }
}
```

3. Update the `ProviderFactory` to handle the new client type (if needed)
4. Update the `ProviderRegistry` to map the new client type to its implementation

## Benefits

- Clean separation of concerns
- Easy to add new providers
- API key management is abstracted away
- Consistent provider interface
- Provider configuration is centralized 