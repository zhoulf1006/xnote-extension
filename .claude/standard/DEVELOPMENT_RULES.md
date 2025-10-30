# XNote - Development Rules & Standards

This document defines the development requirements, patterns, and standards for the XNote Chrome extension project.

## 🛠️ Development Environment

### Package Management
- **ALWAYS use `pnpm`** for package management and script execution
- Commands: `pnpm install`, `pnpm run dev`, `pnpm run build`
- Never use `npm` or `yarn` - maintain consistency with `pnpm`

### Build System
- **Vite-based build process** with Chrome Extension Manifest V3
- Development server runs on port 3100 (fallback to next available port)
- Build output goes to `dist/` directory
- Icon generation: `node scripts/generate-icons.js`

### File Structure Standards
```
src/
├── api/                  # API integrations & services
│   ├── providers/        # LLM provider implementations
│   ├── azureSpeech.js   # Azure Speech Service
│   └── storageService.js # Secure storage management
├── config/              # Configuration files
├── stores/              # Pinia state management
├── sidepanel/           # Main application
│   ├── components/      # Feature components
│   │   ├── Common/      # Shared components
│   │   └── [Feature]/   # Feature-specific directories
│   └── App.vue         # Main app component
├── content.js          # Content script
└── background.js       # Background script
```

## 🎨 UI/UX Design Rules

### Layout Standards
- **Navigation**: Fixed 48px width vertical sidebar with purple theme
- **Page Container**: Consistent padding of 8px
- **Responsive Design**: Flex-based layouts throughout
- **Component Spacing**: Maximum margins/padding of 8px

### Typography
- **H1**: 15px, color #495057, margin 8px 0, font-weight 700
- **H2**: 14px for sections
- **Body Text**: 13px standard
- **Meta Text**: 11px for timestamps, metadata
- **Font Stack**: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto

### Color Scheme
- **Primary Purple**: #673ab7 (navigation, accents)
- **Purple Variants**: #ba92ff (hover), #9c82ca (active)
- **Background**: #f8f9fa (main), #fff (components)
- **Text**: #495057 (primary), #6c757d (secondary)
- **Borders**: #dee2e6
- **Error**: #dc3545
- **Success**: #28a745

### Button Standards
- **Primary**: Purple theme with hover effects
- **Secondary**: Gray/white with borders
- **Stop Button**: Red (#dc3545) when enabled, grayed when disabled
- **Icons**: Font Awesome 6.0.0, 11px-16px sizes
- **States**: Hover, disabled, active with proper visual feedback

## 🔧 Component Development Rules

### Vue 3 Composition API
- **ALWAYS use Composition API** (`<script setup>`)
- Use `ref()` for reactive data, `computed()` for derived state
- Implement proper lifecycle hooks (`onMounted`, `onUnmounted`)
- Use composables for reusable logic (e.g., `useSpeech.js`)

### Component Structure
```vue
<template>
  <!-- Template with semantic HTML -->
</template>

<script setup>
// Imports
// Reactive data
// Computed properties
// Functions
// Lifecycle hooks
</script>

<style scoped>
/* Component-specific styles */
</style>
```

### State Management
- **Pinia stores** for global state
- **Local reactive refs** for component state
- **Composables** for shared logic
- **Props/emits** for parent-child communication

## 🔐 Configuration & Security

### API Key Management
- **Extension Mode**: Use Chrome sync storage via `storageService.js`
- **Development Mode**: Environment variables with `VITE_` prefix
- **Display**: Show actual values (no masking) when viewing
- **Security**: Never log or expose API keys in console/errors

### Environment Variables
```bash
# LLM Providers
VITE_OPENAI_API_KEY=your_key
VITE_GEMINI_API_KEY=your_key
VITE_DEEPSEEK_API_KEY=your_key

# Azure Speech
VITE_AZURE_SPEECH_KEY=your_key
VITE_AZURE_SPEECH_REGION=eastus
VITE_AZURE_SPEECH_DEFAULT_VOICE=en-US-JennyNeural
```

### Storage Keys
- Use consistent naming: `STORAGE_KEYS` constants
- Secure storage for sensitive data
- Local storage for user preferences
- Chrome sync storage for API keys

## ❌ Error Handling Standards

### Comprehensive Error Messages
- **User-Friendly**: Clear, actionable error descriptions
- **Provider Context**: Include relevant LLM provider information
- **Step-by-Step Guidance**: Detailed instructions to fix issues
- **Configuration Links**: Direct users to relevant settings

### Error Message Template
```javascript
const getErrorMessage = (error, providerName) => {
  const errorMessage = error?.message || String(error) || '';
  const errorString = errorMessage.toLowerCase();
  
  if (errorString.includes('unauthorized') || errorString.includes('401')) {
    return `❌ **${providerName} API Key Error**

Your ${providerName} API key appears to be invalid or missing.

**To fix this:**
1. Click the **⚙️ LLM Config** button at the bottom of the sidebar
2. Enter a valid ${providerName} API key
3. Click **Save** to update your configuration
4. Try your request again`;
  }
  
  // Additional error types...
  
  return `❌ **Error**: ${errorMessage}`;
};
```

### Error Handling Requirements
- **ALL LLM-powered features** must have comprehensive error handling
- **Consistent patterns** across Chat, Translation, LLM Test, etc.
- **Try-catch blocks** around all async operations
- **Fallback messages** for unknown errors

## 🎵 Audio & Media Standards

### Azure Speech Integration
- **Audio Format**: MP3 for browser compatibility
- **Playback Method**: AudioContext API with HTML5 Audio fallback
- **State Management**: Accurate `isPlaying` tracking
- **Controls**: Separate Play/Stop buttons with fixed positioning

### Audio Implementation Rules
```javascript
// Set isPlaying ONLY when audio actually starts
source.start(0);
isPlaying.value = true;

// Handle all audio sources in stop function
const stop = () => {
  // Stop AudioContext source
  if (currentAudioSource.value?.stop) {
    currentAudioSource.value.stop();
  }
  // Pause HTML Audio element
  if (currentAudioSource.value?.pause) {
    currentAudioSource.value.pause();
    currentAudioSource.value.currentTime = 0;
  }
  // Close AudioContext
  if (currentAudioContext.value) {
    currentAudioContext.value.close();
  }
  // Reset state
  isPlaying.value = false;
};
```

### File Export Standards
- **Silent Operation**: No audio playback during file saves
- **Format Support**: MP3 and WAV options
- **Filename Convention**: Include timestamp and voice name
- **User Feedback**: Indicate successful downloads

## 🔄 API Integration Patterns

### LLM Provider Implementation
- **Modular Design**: Separate provider files in `api/providers/`
- **Factory Pattern**: `providerFactory.js` for provider selection
- **Registry System**: `providerRegistry.js` for provider management
- **Consistent Interface**: Standardized request/response handling

### Provider Structure
```javascript
export class ProviderName {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }
  
  async generateResponse(prompt, options = {}) {
    try {
      // Implementation
    } catch (error) {
      // Enhanced error with provider context
      throw new Error(`ProviderName: ${error.message}`);
    }
  }
}
```

### Azure Speech Requirements
- **Null Audio Config**: Prevent auto-playback during synthesis
- **Separate Instances**: Different configs for playback vs. file saving
- **Format Handling**: Dynamic format selection (MP3/WAV)
- **Resource Cleanup**: Proper synthesizer closing

## 📝 Code Quality Standards

### Never Add Comments
- **CRITICAL**: DO NOT add comments to code unless explicitly requested
- Code should be self-documenting through clear naming
- Use descriptive variable and function names instead of comments

### Naming Conventions
- **Components**: PascalCase (e.g., `ApiKeyInput.vue`)
- **Composables**: camelCase with `use` prefix (e.g., `useSpeech.js`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `STORAGE_KEYS`)
- **Functions**: camelCase, descriptive verbs (e.g., `handleSpeak`)

### File Organization
- **Index Files**: Main component entry point as `index.vue`
- **Composables**: Separate logic files (e.g., `useSpeech.js`)
- **Types**: TypeScript definitions where needed (e.g., `types.ts`)
- **README**: Feature documentation in component directories

## 🧪 Testing & Validation

### Development Workflow
1. **Read existing code** before making changes
2. **Understand patterns** and follow established conventions
3. **Test thoroughly** after implementation
4. **Build and validate** before considering complete

### Build Validation
- **Always run `pnpm run build`** after changes
- **Check for warnings** and resolve build issues
- **Verify extension functionality** in Chrome
- **Test error scenarios** and edge cases

### Feature Testing Checklist
- [ ] API key configuration and validation
- [ ] Error handling with various error types
- [ ] Audio playback start/stop functionality
- [ ] File export without audio playback
- [ ] Cross-browser compatibility
- [ ] Extension loading and navigation

## 🚫 Strict Requirements

### Package Management
- ❌ **NEVER use npm or yarn** - always use pnpm
- ❌ **NEVER run `find` or `grep`** - use Glob/Grep tools instead
- ❌ **NEVER use git commands with -i flag** (interactive mode not supported)

### Security
- ❌ **NEVER log API keys** or sensitive data
- ❌ **NEVER commit credentials** to repository
- ❌ **NEVER expose keys** in client-side code without encryption

### UI/UX
- ❌ **NEVER add emojis** unless explicitly requested
- ❌ **NEVER create documentation files** unless requested
- ❌ **NEVER exceed 8px** margins/padding without justification

### Code Quality
- ❌ **NEVER add comments** unless explicitly requested
- ❌ **NEVER use console.log** in production builds
- ❌ **NEVER ignore error handling** in async operations

## 📋 Feature Development Checklist

When developing new features:

### Planning Phase
- [ ] Review existing similar components for patterns
- [ ] Plan error handling strategy
- [ ] Design API integration approach
- [ ] Consider state management needs

### Implementation Phase
- [ ] Follow established file structure
- [ ] Implement comprehensive error handling
- [ ] Add proper TypeScript types if needed
- [ ] Use consistent styling and themes

### Testing Phase
- [ ] Test all user interactions
- [ ] Validate error scenarios
- [ ] Check API key configuration
- [ ] Verify cross-component integration

### Completion Phase
- [ ] Run `pnpm run build` successfully
- [ ] Update README if significant feature
- [ ] Document configuration requirements
- [ ] Test in actual Chrome extension environment

---

## 🎯 Summary

This project emphasizes:
- **Consistency** in development patterns and tools
- **Security** in API key and credential management
- **User Experience** with comprehensive error handling
- **Quality** through proper testing and validation
- **Maintainability** through clear code organization

Always refer to this document when developing new features or making changes to ensure consistency with established patterns and requirements.