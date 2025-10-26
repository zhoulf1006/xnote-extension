# XNote Extension

An AI-powered Chrome extension for note-taking and productivity, featuring a convenient sidebar interface with multi-functional tools.

## 🚀 Features Overview

### 🤖 AI-Powered Chat Interface
- **Multi-provider LLM support**: OpenAI (GPT-4), Google Gemini 2.0 Flash, DeepSeek
- **Real-time streaming responses** with typing indicators
- **Markdown rendering** with syntax highlighting for code blocks
- **Message persistence** across sessions with local storage
- **Auto-expanding textarea** input with Enter-to-send functionality
- **Page content integration** for summarizing websites
- **Comprehensive error handling** with user-friendly configuration guidance

### 🗣️ Advanced Text-to-Speech System
- **Azure Speech Service integration** with secure API key management
- **Multi-language voice support**: English and Chinese presets with male/female options
- **Real-time audio playback** with dedicated play/stop controls
- **Audio export capabilities**: Save as MP3 or WAV files without playback
- **Smart audio compatibility**: HTML5 Audio primary, AudioContext fallback
- **Configuration modal** with environment variable fallbacks
- **Comprehensive error handling** with setup guidance

### 🌐 AI Translation Service
- **Real-time translation streaming** with LLM integration
- **Auto-expanding input fields** for optimal user experience
- **Multiple language support** via AI providers
- **Loading states and error handling** with provider context
- **Clean, responsive interface** with clear/translate controls

### 📝 Web Page Summarization
- **One-click summarization** of any webpage via context menu
- **AI-powered content extraction** with intelligent parsing
- **Favorites system** for saving important summaries
- **Search functionality** across saved summaries
- **Export capabilities** for sharing and archival
- **Integration with all LLM providers** for flexibility

### ✅ Todo List Management
- **Persistent task storage** across browser sessions
- **Add, edit, delete tasks** with intuitive controls
- **Mark tasks as complete** with visual feedback
- **Clean, minimalist interface** for distraction-free productivity
- **Local storage persistence** with automatic saving

### 🔗 Quick Links Manager
- **Category-based organization** for bookmarks
- **Add current page** to categories via context menu
- **Edit mode** for managing links and categories
- **Expandable/collapsible categories** for space efficiency
- **Import/export functionality** for backup and sharing
- **Drag-and-drop support** for easy organization

### 🧪 LLM Testing Interface
- **Provider comparison** across different AI models
- **Real-time testing** with immediate feedback
- **Configuration validation** for API keys
- **Performance metrics** for response times
- **Debug mode** for troubleshooting

## 🛠️ Technology Stack

### Core Technologies
- **Vue 3.3+** with Composition API and `<script setup>`
- **Vite 5.0+** for lightning-fast builds
- **Pinia** for centralized state management
- **Chrome Extension Manifest V3** with Side Panel API

### AI & API Integrations
- **OpenAI API** (via Azure endpoint)
- **Google Generative AI** (Gemini 2.0 Flash)
- **DeepSeek API** for alternative LLM
- **Azure Cognitive Services** for Speech
- **Chrome Storage API** for data persistence

### Security & Storage
- **Web Crypto API** for AES-GCM encryption
- **Secure storage service** for API keys
- **Chrome sync storage** for cross-device sync
- **Environment variables** for development mode

## 📦 Installation

### Prerequisites
- Node.js 18+ and pnpm
- Chrome browser (version 114+)
- API keys for desired services

### Development Setup

1. **Clone the repository**
```bash
git clone [repository-url]
cd xnote-extension
```

2. **Install dependencies**
```bash
pnpm install
```

3. **Configure environment variables**
Create a `.env` file in the root directory:
```env
# OpenAI (Azure endpoint)
VITE_AZURE_OPENAI_KEY=your_azure_openai_key

# Google Gemini
VITE_GEMINI_API_KEY=your_gemini_api_key

# DeepSeek
VITE_DEEPSEEK_API_KEY=your_deepseek_api_key

# Azure Speech Service
VITE_AZURE_SPEECH_KEY=your_azure_speech_key
VITE_AZURE_SPEECH_REGION=your_azure_region
```

4. **Start development server**
```bash
pnpm run dev
```
Access at `http://localhost:3100`

### Chrome Extension Installation

1. **Build the extension**
```bash
pnpm run build
```

2. **Load in Chrome**
- Navigate to `chrome://extensions/`
- Enable "Developer mode"
- Click "Load unpacked"
- Select the `dist` folder

3. **Access the extension**
- Click the XNote icon in toolbar
- Use keyboard shortcut: `Ctrl+B` (Windows/Linux) or `Cmd+B` (Mac)

## 🎯 Usage Guide

### Opening the Sidebar
- **Method 1**: Click the XNote extension icon
- **Method 2**: Press `Ctrl+B` / `Cmd+B`
- **Method 3**: Right-click and select from context menu

### Context Menu Features
Right-click on any webpage to access:
- **Summarize Page**: Generate AI summary
- **Save to Quick Links**: Add to bookmarks

### LLM Configuration
1. Click the gear icon (⚙️) in the sidebar
2. Select your preferred provider
3. Enter API keys (encrypted and stored securely)
4. Save configuration

### Provider Selection
Choose from three AI providers:
- **OpenAI**: Best for complex tasks
- **Gemini**: Fast and efficient
- **DeepSeek**: Cost-effective alternative

## 🏗️ Project Structure

```
xnote-extension/
├── src/
│   ├── api/                 # API services and providers
│   │   ├── providers/       # LLM provider implementations
│   │   ├── llm.js          # Main LLM service
│   │   ├── storageService.js # Dual-mode storage
│   │   └── secureStorageService.js # Encrypted storage
│   ├── config/              # Configuration files
│   │   ├── llmProviders.js # Provider definitions
│   │   └── voicePresets.js # Speech voices
│   ├── sidepanel/           # Vue application
│   │   ├── components/      # Feature components
│   │   │   ├── Chat/       # AI chat interface
│   │   │   ├── Speech/     # Text-to-speech
│   │   │   ├── Translation/ # Translation service
│   │   │   ├── Summary/    # Page summarization
│   │   │   ├── QuickLinks/ # Bookmark manager
│   │   │   ├── TodoList.vue # Task management
│   │   │   └── Common/     # Shared components
│   │   └── stores/         # Pinia stores
│   ├── background.js       # Service worker
│   └── content.js          # Content script
├── public/                 # Static assets
│   ├── icons/             # Extension icons
│   └── data/              # Default data
├── scripts/               # Build scripts
│   └── generate-icons.js  # Icon generator
├── manifest.json          # Extension manifest
└── vite.config.js         # Vite configuration
```

## 🔧 Development

### Available Commands
```bash
# Install dependencies
pnpm install

# Start dev server (port 3100)
pnpm run dev

# Build for production
pnpm run build

# Generate extension icons
node scripts/generate-icons.js

# Package extension with timestamp
make pack
```

### Development Features
- **Hot Module Replacement** in development mode
- **Automatic icon generation** from source
- **Environment variable support** for API keys
- **Dual-mode operation** (extension + standalone)

### Build Process
1. Vite builds the Vue application
2. Custom plugin handles Chrome extension structure
3. Assets are copied to appropriate directories
4. Manifest and background scripts are processed
5. Production variables are sanitized

## 🔐 Security

### API Key Management
- Encrypted storage using Web Crypto API
- AES-GCM encryption for sensitive data
- Secure key derivation from user passphrase
- Chrome sync storage for cross-device access

### Content Security Policy
- Strict CSP compliance
- Script-src limited to 'self' and 'wasm-unsafe-eval'
- No inline scripts or styles
- Secure communication with APIs

### Permissions
Minimal permissions requested:
- `sidePanel`: For sidebar functionality
- `contextMenus`: For right-click features
- `activeTab`: For current page access
- `scripting`: For content injection
- `storage`: For data persistence

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

### Code Style
- Use Vue 3 Composition API
- Follow ESLint configuration
- Add JSDoc comments for functions
- Keep components focused and reusable

## 📄 License

[Your License Here]

## 🆘 Support

For issues, questions, or feature requests:
- Open an issue on GitHub
- Check existing issues first
- Provide detailed reproduction steps

## 🙏 Acknowledgments

- Vue.js team for the amazing framework
- Chrome Extensions team for the platform
- All contributors and users

---

**Version**: 1.0.0
**Last Updated**: 2024