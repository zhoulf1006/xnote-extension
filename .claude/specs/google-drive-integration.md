# Google Drive Integration Specification

## Overview
Add Google Drive integration to XNote Extension for content export, data sync, and document import using Markdown format. **This is an optional feature that does not affect core functionality.**

## Requirements
- **Export**: Save summaries, translations, chats, and todos to Google Drive as Markdown
- **Sync**: Two-way sync for multi-device access
- **Import**: Read Google Drive documents for processing
- **Auth**: Manual login via configuration settings
- **UI**: Separate storage section in configuration modal
- **Independence**: All existing features must work without Google Drive connection

## Architecture

### 1. Core Service: `src/api/googleDriveService.js`

```javascript
class GoogleDriveService {
  // Token Management - IMPORTANT: No token caching
  async getValidToken()        // Always fetches fresh token
  async executeWithRetry()     // Handles 401 errors with retry

  // Authentication
  async authenticate()         // Uses chrome.identity.getAuthToken()
  async disconnect()           // Revokes token and clears storage
  async isAuthenticated()      // Checks for valid token

  // File Operations
  async createFile(name, content, folderId)
  async updateFile(fileId, content)
  async getFile(fileId)
  async listFiles(folderId)
  async deleteFile(fileId)

  // Folder Operations
  async createFolder(name, parentId)
  async getOrCreateFolder(path)

  // Sync Operations
  async syncData(dataType, content)
  async fetchData(dataType)
}
```

**Token Refresh Implementation:**
```javascript
// Always get fresh tokens - Chrome handles refresh automatically
async getValidToken() {
  return new Promise((resolve) => {
    chrome.identity.getAuthToken({ interactive: false }, (token) => {
      if (chrome.runtime.lastError) {
        console.error('Token error:', chrome.runtime.lastError);
        resolve(null);
        return;
      }
      resolve(token);
    });
  });
}

// Retry logic for 401 errors
async executeWithRetry(requestFunc, canRetry = true) {
  const response = await requestFunc();

  if (response.status === 401 && canRetry) {
    const token = await this.getValidToken();
    if (token) {
      // Clear cached token to force refresh
      chrome.identity.removeCachedAuthToken({ token });
    }
    await new Promise(resolve => setTimeout(resolve, 100));
    return await requestFunc(); // Retry once
  }

  return response;
}
```

### 2. Storage Keys Update

Add to `src/api/storageService.js`:
```javascript
export const STORAGE_KEYS = {
  // ... existing keys ...
  GOOGLE_DRIVE_CONNECTED: 'google_drive_connected',
  GOOGLE_DRIVE_FOLDER_ID: 'google_drive_folder_id',
  GOOGLE_DRIVE_SYNC_ENABLED: 'google_drive_sync_enabled',
  GOOGLE_DRIVE_LAST_SYNC: 'google_drive_last_sync'
};
```

### 3. Pinia Store: `src/stores/googleDriveStore.js`

```javascript
export const useGoogleDriveStore = defineStore('googleDrive', {
  state: () => ({
    isConnected: false,
    isSyncing: false,
    lastSyncTime: null,
    syncEnabled: false,
    isAvailable: false,  // Check if API is loaded
    syncStatus: 'idle',   // 'idle' | 'syncing' | 'success' | 'failed'
    lastSyncError: null,  // Track sync errors for user feedback
    syncDetails: {        // Track sync progress by content type
      chats: 0,
      summaries: 0,
      translations: 0,
      todos: 0
    }
  }),

  actions: {
    async initialize() {
      // Check if Google Drive service is available
      this.isAvailable = typeof chrome !== 'undefined' &&
                        chrome.identity &&
                        !window.location.hostname.includes('localhost');

      if (!this.isAvailable) {
        console.log('Google Drive integration not available');
        return false;
      }

      // Check stored connection status
      this.isConnected = await storageService.getStoredValue(
        STORAGE_KEYS.GOOGLE_DRIVE_CONNECTED
      );

      // Verify token is still valid
      if (this.isConnected) {
        const authenticated = await googleDriveService.isAuthenticated();
        this.isConnected = authenticated;
      }
    },

    async connect() {
      if (!this.isAvailable) return false;

      try {
        const success = await googleDriveService.authenticate();
        if (success) {
          this.isConnected = true;
          await storeValue(STORAGE_KEYS.GOOGLE_DRIVE_CONNECTED, true);
        }
        return success;
      } catch (error) {
        console.error('Connection failed:', error);
        return false;
      }
    },

    async syncAll() {
      if (!this.isConnected) {
        this.syncStatus = 'failed';
        this.lastSyncError = 'Not connected to Google Drive';
        return false;
      }

      this.isSyncing = true;
      this.syncStatus = 'syncing';
      this.lastSyncError = null;

      try {
        await googleDriveService.syncAll();
        this.lastSyncTime = new Date().toISOString();
        this.syncStatus = 'success';
        return true;
      } catch (error) {
        console.error('Sync failed:', error);
        this.syncStatus = 'failed';
        this.lastSyncError = error.message || 'Unknown sync error';
        return false;
      } finally {
        this.isSyncing = false;
      }
    },

    async disconnect()
    async exportContent(type, data)
    async importDocument(fileId)
  }
});
```

### 4. Background Service Updates

Add to `background.js`:
```javascript
// Handle Google Drive authentication
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'authenticateGoogleDrive') {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      sendResponse({ token });
    });
    return true;
  }
});
```

## UI Implementation

### Updated: Dedicated Storage & Sync Modal

**Important Change**: Google Drive settings have been moved from the configuration modal to a dedicated sidebar navigation item with its own modal for better user experience.

### Sidebar Navigation Integration

```vue
<!-- In src/sidepanel/App.vue -->
<nav class="nav-menu">
  <!-- Other nav items... -->

  <!-- Google Drive Navigation Item with Status Indicator -->
  <div v-if="googleDriveStore?.isAvailable"
       class="nav-item drive-item"
       @click="showStorageModal = true">
    <i class="fab fa-google-drive"></i>
    <span class="nav-text">Storage & Sync</span>
    <span class="status-dot"
          :class="{
            'connected': googleDriveStore.isConnected,
            'syncing': googleDriveStore.isSyncing,
            'error': googleDriveStore.syncStatus === 'failed'
          }"></span>
  </div>
</nav>
```

### Storage & Sync Modal Structure

```vue
<!-- In src/sidepanel/App.vue -->
<div class="storage-section">
  <h2>Storage & Sync</h2>

  <div class="google-drive-config">
    <h3>
      <i class="fab fa-google-drive"></i> Google Drive
    </h3>

    <div class="connection-status">
      <span v-if="googleDriveStore.isConnected" class="status-connected">
        <i class="fas fa-check-circle"></i> Connected
      </span>
      <span v-else class="status-disconnected">
        <i class="fas fa-times-circle"></i> Not Connected
      </span>
    </div>

    <button v-if="!googleDriveStore.isConnected"
            @click="connectGoogleDrive"
            class="connect-button">
      <i class="fas fa-link"></i> Connect to Google Drive
    </button>

    <div v-else class="sync-settings">
      <label class="sync-toggle">
        <input type="checkbox" v-model="googleDriveStore.syncEnabled">
        <span>Enable Auto-Sync</span>
      </label>

      <div class="last-sync">
        Last synced: {{ formatTime(googleDriveStore.lastSyncTime) }}
      </div>

      <button @click="syncNow" :disabled="googleDriveStore.isSyncing">
        <i class="fas fa-sync" :class="{ 'fa-spin': googleDriveStore.isSyncing }"></i>
        {{ googleDriveStore.isSyncing ? 'Syncing...' : 'Sync Now' }}
      </button>

      <button @click="disconnectGoogleDrive" class="disconnect-button">
        <i class="fas fa-unlink"></i> Disconnect
      </button>
    </div>
  </div>
</div>
```

### Export Buttons in Components

Add **conditional** export functionality to existing components:

```vue
<!-- In each component (Chat, Summary, Translation, TodoList) -->
<!-- Only show if Google Drive is connected -->
<button @click="exportToGoogleDrive"
        v-if="googleDriveStore?.isConnected"
        class="export-button">
  <i class="fas fa-cloud-upload-alt"></i> Export to Drive
</button>
```

**Important**: Export buttons are only visible when connected. Components continue to use localStorage as primary storage.

## Data Formats

### Folder Structure in Google Drive
```
XNote/
├── chats/
│   └── chat_2024-01-20_143022.md
├── summaries/
│   └── summary_[page-title]_2024-01-20.md
├── translations/
│   └── translations_2024-01-20.md
└── todos/
    └── todos_2024-01-20.md
```

### Markdown Templates

#### Chat Export
```markdown
# Chat Session
**Date:** 2024-01-20 14:30:22

---

**User:** [message]

**Assistant:** [response]

---
```

#### Summary Export
```markdown
# [Page Title]
**URL:** [url]
**Date:** 2024-01-20
**Tags:** #summary #xnote

## Summary
[content]

## Original Text (excerpt)
[first 500 chars if available]
```

#### Translation Export
```markdown
# Translations
**Date:** 2024-01-20

## Translation 1
**From:** English
**To:** Chinese
**Original:** [text]
**Translation:** [translated text]

---
```

#### Todo Export
```markdown
# Todo List
**Date:** 2024-01-20

## Tasks
- [x] Completed task
- [ ] Pending task
- [ ] Another task
```

## Implementation Details

### Authentication Flow
1. User clicks "Connect to Google Drive"
2. Call `chrome.identity.getAuthToken({ interactive: true })`
3. Store connection status in storage
4. Initialize folder structure in Drive
5. Update UI to show connected state

### Sync Logic
1. **Manual Sync**: User clicks "Sync Now"
2. **Auto Sync**: If enabled, sync every 30 minutes
3. **Sync Process**:
   - Get latest data from local storage
   - Convert to Markdown format
   - Check if file exists in Drive
   - Update existing or create new file
   - Update last sync timestamp

### Import Flow
1. User clicks "Import from Drive" (future enhancement)
2. Show Google Picker to select file
3. Fetch file content
4. Parse Markdown
5. Import into appropriate store

## API Usage

### Required Google APIs
- Drive API v3
- Identity API (for Chrome extensions)

### Scopes (already in manifest.json)
- `https://www.googleapis.com/auth/drive.file` - Create and manage files
- `https://www.googleapis.com/auth/drive.readonly` - Read files

### Key API Methods
```javascript
// Get auth token
chrome.identity.getAuthToken({ interactive: true }, callback)

// Remove cached token
chrome.identity.removeCachedAuthToken({ token }, callback)

// Drive API calls
fetch('https://www.googleapis.com/drive/v3/files', {
  headers: { 'Authorization': `Bearer ${token}` }
})
```

## Error Handling

1. **Auth Errors**: Show "Please reconnect" message
2. **Network Errors**: Queue for retry, show offline indicator
3. **Quota Errors**: Show user-friendly message about limits
4. **Sync Conflicts**: Last-write-wins approach
5. **Token Expiry**: Auto-refresh using Identity API
6. **401 Unauthorized**: Automatic retry with fresh token using `executeWithRetry()`
7. **Token Refresh**: Chrome Identity API handles refresh automatically when requesting new tokens
8. **Error Tracking**: Store sync errors in `lastSyncError` for user feedback

## Independence Safeguards

### Core Functionality Protection
1. **LocalStorage First**: All features continue using localStorage as primary storage
2. **Google Drive as Add-on**: Drive only provides export/backup, not primary storage
3. **Conditional UI**: All Drive UI elements use `v-if="googleDriveStore?.isConnected"`
4. **Graceful Initialization**: Store checks for service availability before operations
5. **No Breaking Changes**: Existing data flow remains unchanged

### Implementation Guards
```javascript
// In components, always check connection status
methods: {
  async exportToGoogleDrive() {
    if (!this.googleDriveStore?.isConnected) {
      console.log('Google Drive not connected');
      return;
    }
    // ... export logic
  }
}

// In App.vue, make storage section optional
<div v-if="googleDriveStore?.isAvailable" class="storage-section">
  <!-- Google Drive UI -->
</div>
```

### Fallback Behavior
- If Google Drive service fails to load: Section doesn't appear
- If not authenticated: Show connection prompt only
- If sync fails: Log error, continue with localStorage
- If export fails: Show error message, data remains in localStorage

## Security Considerations

1. Use Chrome Identity API for secure OAuth flow
2. Never store tokens in plain text
3. Use secure storage service for sensitive data
4. Implement token refresh before expiry
5. Clear all data on disconnect

## Testing Checklist

### Google Drive Features
- [ ] Authentication flow works
- [ ] Files are created with correct structure
- [ ] Markdown formatting is correct
- [ ] Sync updates existing files
- [ ] Disconnect clears all tokens
- [ ] Error messages are user-friendly
- [ ] Works in both extension and dev mode
- [ ] Handles offline scenarios

### Independence Testing (Critical)
- [ ] Extension loads without Google Drive service
- [ ] All features work without Google Drive connected
- [ ] Chat works without Drive
- [ ] Summaries work without Drive
- [ ] Translations work without Drive
- [ ] Todos work without Drive
- [ ] LocalStorage saves work without Drive
- [ ] No console errors when Drive not configured
- [ ] Export buttons hidden when not connected
- [ ] Config section hidden if service unavailable

## File Structure

```
src/
├── api/
│   └── googleDriveService.js     # Core Google Drive API service
├── stores/
│   └── googleDriveStore.js       # Pinia store for Drive state
├── sidepanel/
│   ├── App.vue                   # Add Storage section to config
│   └── components/
│       └── GoogleDriveSync/      # (Optional) Separate component
│           └── index.vue
└── background.js                  # Add auth message handler
```

## Development Notes

1. Start with manual sync only
2. Add auto-sync as enhancement
3. Focus on export first, import later
4. Use existing UI patterns from LLM config
5. Follow existing storage service patterns
6. Reuse secure storage for tokens
7. Keep Markdown format simple and readable

## Future Enhancements (Not in initial implementation)

- Google Picker for file selection
- Selective sync (choose what to sync)
- Shared folders support
- Version history
- Conflict resolution UI
- Batch operations
- Progress indicators for large syncs