---
sidebar_position: 1
title: XNote Extension
description: AI-powered note-taking and productivity Chrome extension
---

# XNote Extension

XNote Extension is an AI-powered Chrome extension for note-taking and productivity. It provides a convenient side panel interface for AI chat, web page summarization, translation, and more.

## Features

### AI Chat
- Chat with multiple AI providers (OpenAI, Google Gemini, DeepSeek, Azure OpenAI)
- Streaming responses for real-time interaction
- Chat history management with IndexedDB storage
- Support for custom LLM endpoints

### Web Page Summarization
- Summarize any web page with one click
- Save summaries to favorites
- Export summaries to Google Drive

### Translation
- Real-time AI translation
- Multiple language support
- Text-to-speech with Azure Speech Service

### Screen Capture & Analysis
- Capture screenshots for AI analysis
- Paste images from clipboard
- Extract text and insights from images

### Quick Links
- Save and organize bookmarks
- Category management
- Quick access from side panel

### Google Drive Sync
- Sync notes and summaries to Google Drive
- Cross-device access to your data
- Automatic backup

## Installation

### From Chrome Web Store
1. Visit the [Chrome Web Store](https://chrome.google.com/webstore) (coming soon)
2. Click "Add to Chrome"
3. The extension icon will appear in your toolbar

### From Source
1. Clone the repository
2. Run `pnpm install` to install dependencies
3. Run `pnpm run build` to build the extension
4. Open `chrome://extensions/` in Chrome
5. Enable "Developer mode"
6. Click "Load unpacked" and select the `dist` folder

## Usage

### Opening the Side Panel
- Press `Ctrl+G` (Windows/Linux) or `Cmd+G` (Mac)
- Or click the extension icon in the toolbar

### Setting Up AI Providers
1. Navigate to the "Config" tab
2. Enter your API key for your preferred provider
3. Select the provider from the dropdown
4. Start chatting!

### Summarizing a Page
1. Navigate to any web page
2. Right-click and select "Summary Page"
3. Or use the Summary tab in the side panel

## Security

- All API keys are encrypted with AES-GCM-256
- Data is stored locally on your device
- No data is sent to extension developers
- See our [Privacy Policy](./privacy-policy) for details

## Source Code

XNote Extension is open source. View the source code on [GitHub](https://github.com/zhoulf1006/xnote-extension).

## Support

If you encounter issues or have feature requests, please [open an issue](https://github.com/zhoulf1006/xnote-extension/issues) on GitHub.
