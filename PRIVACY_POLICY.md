# Privacy Policy for XNote Extension

**Last Updated: January 2025**

## Introduction

XNote Extension ("the Extension") is a browser extension that provides AI-powered note-taking and productivity features. This privacy policy explains how we collect, use, and protect your information.

## Summary

- **We do not collect any personal data** - All your data stays on your device
- **We do not track you** - No analytics, no telemetry, no user tracking
- **Your API keys are encrypted** - Stored locally with AES-GCM-256 encryption
- **Third-party services are user-initiated** - Data is only sent when you explicitly use features

## Data Storage

### Local Data (Stored on Your Device)

The Extension stores the following data locally on your device:

| Data Type | Storage Location | Purpose |
|-----------|-----------------|---------|
| API Keys | Chrome Sync Storage | Authenticate with AI services (encrypted with AES-GCM-256) |
| Chat History | IndexedDB | Store your conversation history |
| Page Summaries | IndexedDB | Save your favorite page summaries |
| Quick Links | Chrome Storage | Store your bookmarks and quick links |
| User Preferences | Chrome Storage | Remember your settings (language, provider choice, etc.) |

### Data Encryption

Your API keys are encrypted using:
- **Algorithm**: AES-GCM-256
- **Key Derivation**: PBKDF2 with 100,000 iterations
- **Implementation**: Web Crypto API (browser-native cryptography)

API keys are never stored in plain text.

## Data Transmission

### When Data is Sent to Third-Party Services

The Extension only transmits data to external services when you explicitly use specific features:

#### AI/LLM Providers
When you use chat, summarization, or translation features, the following may be sent to your configured AI provider:

| Provider | Data Sent | When |
|----------|-----------|------|
| OpenAI | Chat messages, page content, images | When you chat, summarize pages, or analyze screenshots |
| Google Gemini | Chat messages, page content, images | When you chat, summarize pages, or analyze screenshots |
| DeepSeek | Chat messages, page content | When you chat or summarize pages |
| Azure OpenAI | Chat messages, page content | When you use custom Azure endpoints |
| Custom Endpoints | Depends on configuration | When you use custom LLM providers |

#### Google Drive
When you enable Google Drive sync:
- Markdown files containing your notes, summaries, and chat exports
- Only files you explicitly choose to upload

#### Azure Speech Service
When you use text-to-speech:
- Text content for audio conversion

### What We Never Send

- We never send your data to the Extension developers
- We never collect analytics or usage statistics
- We never transmit data without your explicit action

## Permissions Explained

The Extension requires the following browser permissions:

| Permission | Why It's Needed |
|------------|-----------------|
| `identity` | Google OAuth authentication for Google Drive sync |
| `storage` | Store your preferences and encrypted API keys |
| `clipboardRead` | Paste content when you initiate paste actions |
| `activeTab` | Access the current page for summarization (only when you click "Summarize") |
| `scripting` | Extract page content for AI summarization |
| `contextMenus` | Add right-click menu options for quick actions |
| `sidePanel` | Display the Extension's sidebar interface |
| `alarms` | Background sync scheduling for Google Drive |

## Third-Party Services

This Extension integrates with third-party services. Each service has its own privacy policy:

- **OpenAI**: [Privacy Policy](https://openai.com/privacy)
- **Google (Gemini & Drive)**: [Privacy Policy](https://policies.google.com/privacy)
- **DeepSeek**: [Privacy Policy](https://www.deepseek.com/privacy)
- **Microsoft Azure**: [Privacy Statement](https://privacy.microsoft.com/privacystatement)

You are responsible for reviewing and agreeing to these policies when using their services.

## Data Retention

- **Local Data**: Stored until you delete it or uninstall the Extension
- **Third-Party Services**: Subject to each provider's data retention policies
- **Google Drive Files**: Remain in your Drive until you delete them

## Your Rights

You have full control over your data:

- **Access**: All data is stored locally and accessible to you
- **Delete**: Clear data through browser settings or Extension options
- **Export**: Export your data via Google Drive sync feature
- **Revoke Access**: Disconnect Google Drive at any time from Extension settings

## Data Security

We implement security measures including:

- AES-GCM-256 encryption for sensitive data
- Device-specific encryption keys
- No server-side data storage
- All data processing happens locally in your browser

## Children's Privacy

This Extension is not intended for children under 13. We do not knowingly collect data from children.

## Changes to This Policy

We may update this privacy policy from time to time. Changes will be reflected in the "Last Updated" date.

## Contact

If you have questions about this privacy policy, please open an issue on our GitHub repository.

---

*This Extension is open source. You can review the source code to verify our privacy practices.*
