# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

XNote Extension is an AI-powered Chrome extension for note-taking and productivity. It's a fork of hn-sidebar-vue with focus on productivity tools, removing HackerNews and Finance features.

## Development Commands

### Core Development
```bash
# Start development server (port 3100)
pnpm run dev

# Build for production
pnpm run build

# Generate extension icons
node scripts/generate-icons.js

# Package extension with timestamp
make pack
```

### Package Management
- **Always use pnpm** for package management
- Dependencies include Vue 3, Pinia, Vite, and Chrome extension APIs

## Architecture Overview

### Chrome Extension Structure
- **Manifest V3**: Modern Chrome extension with side panel API
- **Background Service Worker**: Handles context menus, tab management, and cross-tab communication
- **Content Script**: Page content extraction and notification system
- **Side Panel**: Main Vue application accessible via Ctrl/Cmd+G

### Dual-Mode Development
- **Extension Mode**: Chrome extension with encrypted storage via Chrome sync API
- **Development Mode**: Standalone web app using localStorage and environment variables
- **Environment Detection**: Automatic switching based on `chrome.storage` availability

### Build System (Vite)
- **Custom Plugin**: Handles Chrome extension file structure and asset processing
- **File Processing**: Moves built files to correct extension directory structure
- **Static Asset Copying**: Handles manifest.json, background.js, and public folder contents
- **Production Variable Replacement**: Clears environment variables in production builds

### State Management
- **Pinia Stores**: Centralized state management for navigation, favorites, and LLM config
- **Persistence**: Automatic localStorage sync with reactive updates
- **Store Pattern**: Each feature has dedicated store with actions and getters

### API Integration Architecture

#### Multi-Provider LLM System
- **Provider Factory**: `src/api/providers/providerFactory.js` dynamically creates provider instances
- **Provider Registry**: Maintains available providers with configuration
- **Unified Interface**: All providers implement consistent `generateContent()` and `generateContentStream()` methods
- **Supported Providers**: OpenAI (via Azure), Google Gemini 2.0 Flash, DeepSeek

#### Secure Storage System
- **Dual Storage**: `storageService.js` for basic data, `secureStorageService.js` for encrypted data
- **Encryption**: Web Crypto API with AES-GCM encryption for sensitive data
- **Key Management**: Automatic encryption/decryption with fallback to environment variables
- **Extension Integration**: Uses Chrome sync storage for cross-device synchronization

#### Content Processing
- **Page Content Extraction**: Content script uses semantic selectors for main content
- **Context Menu Integration**: Right-click actions for summarization and link saving
- **Background Communication**: Message passing between content script, background, and side panel

### Component Architecture

#### Active Components (Kept from original)
- **Chat**: AI conversation interface with streaming support
- **Speech**: Azure Speech Service integration with audio export
- **Translation**: Real-time AI translation with multi-provider support
- **Summary**: Web content summarization with favorites system
- **QuickLinks**: Bookmark management with categories (renamed from SegLinks)
- **LLMTest**: Provider testing and debugging interface
- **Common**: Shared components (ApiKeyInput, Separator, Tooltip)

#### Removed Components
- **HackerNews**: News aggregation (removed)
- **Finance**: USD deposit calculator (removed)
- **TodoList**: Task management with persistent storage (removed)

#### Vue 3 Patterns
- **Composition API**: All components use `<script setup>` syntax
- **Reactive Patterns**: Extensive use of `ref()`, `reactive()`, and `computed()`
- **Composables**: Reusable logic in `src/sidepanel/composables/`

### Security Implementation
- **API Key Encryption**: All sensitive data encrypted before storage
- **Content Security Policy**: Strict CSP compliance
- **Permission Minimization**: Only required Chrome permissions
- **No External Dependencies**: Self-contained with minimal attack surface

### Development Patterns

#### Error Handling
- **Comprehensive Error Boundaries**: All API calls wrapped with try-catch
- **User-Friendly Messages**: Configuration guidance for setup issues
- **Graceful Degradation**: Fallbacks for missing configurations

#### Configuration Management
- **Environment Variables**: Development mode uses `.env` file
- **Chrome Storage**: Extension mode uses encrypted sync storage
- **Fallback Chain**: Environment → Chrome storage → user input

#### LLM Configuration Maintenance
- **Provider Store**: `src/stores/llmConfig.js` manages selected provider with localStorage persistence
- **Provider Registry**: `src/config/llmProviders.js` defines all available providers
- **Dynamic Switching**: `setProvider()` updates both store state and LLM service instance
- **Service Reinitialization**: `reinitializeService()` refreshes provider connection after API key changes
- **Configuration UI**: `ApiKeyInput.vue` component handles secure API key input with real-time validation
- **Key Management**: Automatic loading/validation of stored keys with visual status indicators
- **Development Mode**: Graceful fallback to mock service when API keys unavailable in localhost
- **Runtime Configuration**: Ability to switch and configure providers dynamically
- **Fallback Mechanisms**: Auto-detect and suggest alternative providers if primary fails
- **Configuration Validation**: Automatic validation of API keys and provider connectivity

#### Testing Strategy
- **Manual Testing**: Chrome extension environment testing
- **Provider Testing**: Built-in LLM testing interface
- **Cross-Environment**: Both extension and development mode validation

## Special Considerations

### Chrome Extension Development
- **Manifest V3 Compliance**: Uses service workers instead of background pages
- **Content Script Injection**: Dynamic injection with retry logic
- **Side Panel API**: Modern Chrome extension UI pattern
- **Cross-Tab Communication**: Background script message routing

### Azure Speech Service
- **Audio Format Handling**: MP3 output with HTML5 Audio primary, AudioContext fallback
- **Voice Presets**: Pre-configured voices for different languages
- **Export Functionality**: Save audio files without playback requirement

### Build and Deployment
- **Icon Generation**: Automated icon creation with note icon design
- **Timestamped Packaging**: Automatic versioning for distribution
- **Asset Processing**: Intelligent file movement for Chrome extension structure
- **Production Hardening**: Environment variable clearing in builds

## Important Naming Changes from Original

### Branding
- **Extension Name**: "XNote Extension" (was "HN Sidebar Vue")
- **Package Name**: "xnote-extension" (was "hn-sidebar-vue")

### Component Renaming
- **SegLinks → QuickLinks**: All files and references updated
- **useSegLinks → useQuickLinks**: Composable renamed
- **segLinksService → quickLinksService**: Service renamed

### Storage Keys
- **LLM Provider**: `xnote-llm-provider` (was `hn-sidebar-llm-provider`)

### DOM Elements
- **Notification ID**: `#xnote-notification` (was `#hn-sidebar-notification`)
- **Page Info**: `window.xnotePageInfo` (was `window.hnSidebarPageInfo`)

### Navigation Updates
- **Removed Tabs**: "HN" and "Finance" tabs removed from App.vue
- **Renamed Tab**: "Links" renamed to "Quick Links" in display

## Development Best Practices

### Component Development
- Use Vue 3 Composition API with `<script setup>`
- Keep components focused and single-purpose
- Use TypeScript-like JSDoc comments for better IDE support
- Implement proper error boundaries

### State Management
- Use Pinia stores for global state
- Keep component state local when possible
- Implement proper persistence for user data
- Use reactive patterns consistently

### API Integration
- Always use the provider factory pattern
- Implement proper error handling
- Provide user-friendly error messages
- Use streaming responses where applicable

### Security
- Never store unencrypted API keys
- Use Chrome's secure storage APIs
- Validate all user inputs
- Implement proper CSP headers

## File Structure Reference

Key directories and their purposes:
- `src/api/`: API services and provider implementations
- `src/api/providers/`: LLM provider implementations
- `src/config/`: Configuration files (providers, voices)
- `src/sidepanel/components/`: Vue components for features
- `src/sidepanel/stores/`: Pinia state management
- `src/stores/`: Additional Pinia stores
- `public/icons/`: Generated extension icons
- `scripts/`: Build and utility scripts

## Testing the Extension

1. **Development Mode**: Run `pnpm run dev` for hot-reload development
2. **Extension Mode**: Build with `pnpm run build` and load unpacked in Chrome
3. **Test all providers**: Use the LLM Test tab to verify configurations
4. **Check storage**: Verify encrypted storage is working properly
5. **Test context menus**: Right-click to test summary and save features