# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

XNote Extension is an AI-powered Chrome extension for note-taking and productivity, built with Vue 3 + Pinia + Vite. It runs in Chrome's side panel (Manifest V3), opened via Ctrl/Cmd+G or the toolbar icon.

## Development Commands

```bash
pnpm run dev      # Dev server on port 3100 (runs as a plain web app, auto-opens sidepanel.html)
pnpm run build    # Production build — runs the custom build.js, NOT plain `vite build`
make pack         # Build + strip the manifest `key` for Chrome Web Store + zip into pack/ with timestamp
make dev-pack     # Build + zip with the dev manifest (keeps the `key` field)
```

- Always use pnpm for package management.

## Architecture

### Extension Structure
- **Side panel** (`sidepanel.html` → `src/sidepanel/`): the main Vue app. `src/sidepanel/App.vue` owns tab navigation and the LLM Config / Storage & Sync modals.
- **Background service worker** (`background.js`): context menus ("Summary Page", "Save to Quick Links"), screenshot orchestration, Google Drive auth relay, transfer-sync alarm (30s tick), notification delivery to content scripts with injection + retry.
- **Content scripts**: `src/content.js` (declared in manifest; page content extraction, save-success toasts), `src/content-scripts/screenshot-overlay.js` (injected on demand for area selection).

### Feature Tabs
- **Chat**: streaming AI conversation, history in IndexedDB.
- **Capture**: screenshot area selection or clipboard paste → vision-capable LLM extracts text/insights.
- **Translate**: AI translation.
- **Summary**: summarizes current page (also via context menu), favorites, category-based export to Google Drive.
- **Quick Links**: bookmark manager with categories, seeded from `public/data/quick_links.json`.
- **Transfer**: cross-device text/file transfer using Google Drive as relay — a `manifest.json` on Drive is the source of truth, items expire after 30 days.

### Multi-Provider LLM System
- Registry: `src/config/llmProviders.js` — OpenAI, DeepSeek, Gemini (default), and "Customized" (user-configured OpenAI-compatible endpoint with per-capability chat/vision/speech models).
- Factory: `src/api/providers/providerFactory.js` creates provider instances; all implement `generateContent()` and `generateContentStream()`.
- Selected provider: `src/stores/llmConfig.js` (persisted in localStorage); API key input UI: `src/sidepanel/components/Common/ApiKeyInput.vue`.
- Model selection: chat/vision models per provider are picked in the config modal from live provider model lists (`src/api/modelCatalog.js` pure logic, `src/api/modelConfigService.js` storage/fetch bindings); providers resolve the model at request time with fallback to the registry `defaultModel`.

### Storage Layers (three distinct ones)
1. **`src/api/storageService.js`**: dual-mode key/value storage — Chrome storage in extension mode, localStorage in dev mode. Includes `secureStorageService` (AES-GCM encryption via `encryptionService.js`) for API keys.
2. **IndexedDB** (`xnote-db` v3 via `src/stores/dbManager.js`): `favorites`, `chatHistory`, `transfers` object stores.
3. **Google Drive** (`src/api/googleDriveService.js`): syncs chats/summaries/translations as markdown into `/chats`, `/summaries`, `/translations`; auto-sync every 30 min when enabled. URL↔folder/file ID mappings tracked in `src/stores/driveMappings.js`.

### Dual-Mode Development
- **Extension mode**: Chrome storage, real Chrome APIs, encrypted key storage.
- **Dev mode** (localhost): localStorage, API keys from `.env` (`VITE_*` vars), graceful fallback to a mock LLM service when keys are missing.
- Detection is automatic (`isExtensionMode()` in `storageService.js`); most bugs that only reproduce in one mode trace back to this split.

### Build System
- `build.js` runs Vite then assembles `dist/` into extension layout: copies `manifest.json`, `background.js`, content scripts, icons, `public/data`, and moves the built HTML to `dist/sidepanel.html`.
- `dist/` is always dev-marked — name "XNote Extension (Dev)" and orange icons (`scripts/apply-dev-manifest.js`) — so the unpacked build is distinguishable from the store version; `prepare-store-manifest.js` reverses this (plus key removal and OAuth client swap) inside `make pack`.
- Production builds blank all `VITE_*` env vars (see `vite.config.js` `define`) so keys are never inlined into shipped code.

## Invariants and Gotchas

- **Never store API keys unencrypted** — always go through `secureStorageService` / `storeSecureValue()`.
- **Large mapping data goes in `chrome.storage.local`, not sync** — sync storage has tight quotas; `migrateSyncToLocalStorage()` exists for this reason.
- **Transfer device ID must stay in `localStorage`, never sync storage** — each device needs its own identity (see `transferService.js`).
- **Drive tokens are never persisted** — a fresh token is fetched per request via `chrome.identity.getAuthToken`; 401s retry once after clearing the cached token.
- **All IndexedDB schema changes go through `dbManager.js`** — bumping the version anywhere else causes version conflicts between stores.
- **Nothing that reads mapping keys from `chrome.storage.local` may run before the sync→local migration finishes** — that migration is what puts them there, so a reader that starts first sees nothing, and only on the single startup where the move actually happens. The migration is one single-flight run owned by `storageReadiness` (`src/api/storageReadiness.js`): the startup prerequisite starts it, and any reader of `drive_location_mappings` or the `summary_*` keys must `await storageReadiness.ensure()` before its first read (see `driveMappings.loadMappings`) rather than relying on mount order — Vue mounts children before the parent's `onMounted`, so mount order guarantees nothing.

## Testing

- Unit tests run with Vitest: `pnpm test` (tests live under `tests/`; `vitest.config.js` keeps test runs from triggering the extension-files build plugin).
- UI and provider connectivity are tested manually in both modes:
  1. Dev mode: `pnpm run dev`, verify against localhost.
  2. Extension mode: `pnpm run build`, load `dist/` unpacked at `chrome://extensions/`.
- Verify context menus, encrypted storage, and Drive sync in extension mode — none of these exist in dev mode.
- Create test files or scripts under the `tests/` folder.
- **A test that needs a browser global must define it, never lean on the runtime having it.** CI pins Node 20, which has no global `navigator`; newer local Node versions do. A test relying on that difference passes locally and fails only in CI — or worse, passes in both for the wrong reason. Define what you need (`Object.defineProperty` where the global already exists as a getter) and restore it afterwards. `tests/migrationBatching.test.js` does this for `screen` and `navigator`.
- **To reproduce a CI-only test failure locally, run the CI Node version**: `PATH="$HOME/.nvm/versions/node/v20.9.0/bin:$PATH" pnpm test`.

### Debugging storage

`checkStorage()` normally prints only a short summary. To make it dump the full contents of sync and
local storage, set the flag in the panel's console and reload:

```js
localStorage.setItem('xnote-debug-storage', 'true')   // 'false' or removing it turns it back off
```

It is off by default because dumping the store means reading all of it on every panel open, purely to
log it.

## File Structure Reference

- `src/api/`: services (LLM, Google Drive, transfer, storage/encryption, screenshot, links)
- `src/api/providers/`: LLM provider implementations + factory
- `src/config/`: provider registry
- `src/sidepanel/components/`: one directory per feature tab + `Common/` shared components
- `src/sidepanel/composables/`: shared composition logic
- `src/stores/`: Pinia stores + IndexedDB manager
- `src/content-scripts/`: on-demand injected scripts
- `public/`: icons and seed data copied into the build
- `scripts/`: build utilities (icon generation, store manifest prep)
