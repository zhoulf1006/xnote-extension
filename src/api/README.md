# API Key Management

This directory contains the implementation for API services and key management used in the application.

## Storage Service

The `storageService.js` file provides a unified interface for storing and retrieving API keys and other sensitive information:

- In extension mode, keys are stored in Chrome's synced storage
- In development mode, keys are read from environment variables

### Key Features

- **Cross-device synchronization**: When running as a Chrome extension, API keys are stored in Chrome's synced storage, making them available on all devices where the user is signed in.
- **Environment variable fallback**: In development mode, the service falls back to reading keys from environment variables.
- **Secure storage**: API keys are stored securely in Chrome's account storage, not in localStorage.
- **Lazy loading**: API keys are only loaded when needed, not on application startup.

## LLM Service

The LLM service in `llm.js` uses a provider factory pattern to create and configure different LLM providers:

- OpenAI (Azure OpenAI)
- DeepSeek
- Gemini

### Provider Structure

- **Provider Factory**: Creates and configures provider clients
- **Provider Registry**: Maps provider types to implementation classes
- **Provider Implementations**: Handle provider-specific logic

## Azure Speech Service

The Azure Speech service in `azureSpeech.js` provides text-to-speech functionality:

- Initializes only when needed
- Reads configuration from Chrome storage or environment variables
- Provides status information for UI configuration

## Adding a New API Service

1. Update `storageService.js` to add new storage keys
2. Create a service implementation that uses the storage service
3. Add UI components for configuration

## Security Considerations

- API keys are never exposed in client-side code
- Keys are masked when displayed in the UI
- In extension mode, keys are stored in Chrome's synced storage, which is encrypted
- In development mode, keys are read from environment variables 