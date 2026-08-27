/**
 * Google Drive's startup reads.
 *
 * A connected user's startup used to issue eight sequential sync reads before the
 * store settled, one of them a second fetch of the same key: the store read the
 * connected flag, then called an authentication check that read it again.
 *
 * The counts here are per unit. The end-to-end figure is the closeout ticket's to
 * measure against a real panel — a unit test cannot see round trips issued by code
 * paths it stubs out, and asserting an end-to-end number from here would be
 * claiming coverage this file does not have.
 */
import { describe, test, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { createMemoryBackend } from '../src/api/storageBackend.js';
import { useGoogleDriveStore } from '../src/stores/googleDrive.js';
import { googleDriveService } from '../src/api/googleDriveService.js';

beforeEach(() => setActivePinia(createPinia()));

describe('the folder configuration is fetched in one round trip', () => {
  test('three configuration keys cost one read, not three', async () => {
    const backend = createMemoryBackend({
      sync: {
        google_drive_use_custom_location: true,
        google_drive_parent_folder_id: 'parent-123',
        google_drive_parent_folder_name: 'My Folder'
      }
    });

    const config = await googleDriveService.getFolderConfiguration(backend);

    expect(backend.calls.syncGet).toBe(1);
    // Batching is only correct if it still returns what it used to
    expect(config).toEqual({ useCustom: true, parentId: 'parent-123', parentName: 'My Folder' });
  });

  test('absent configuration keys still produce the documented defaults', async () => {
    const backend = createMemoryBackend();

    const config = await googleDriveService.getFolderConfiguration(backend);

    expect(config).toEqual({ useCustom: false, parentId: null, parentName: null });
  });
});

describe('the store stops re-reading what the authentication check already read', () => {
  test('initialization never fetches the connected flag itself', async () => {
    const requestedKeys = [];
    const base = createMemoryBackend({
      sync: {
        google_drive_connected: true,
        google_drive_sync_enabled: true,
        google_drive_last_sync: '2026-08-01T00:00:00Z'
      }
    });
    const backend = {
      ...base,
      syncGet: async (keys) => { requestedKeys.push(...keys); return base.syncGet(keys); }
    };

    const service = {
      isUsable: () => true,
      isAuthenticated: async () => true,
      getFolderConfiguration: async () => ({ useCustom: false, parentId: null, parentName: null }),
      getRootFolderId: async () => null
    };

    const store = useGoogleDriveStore();
    await store.initialize(service, backend);

    // The connected flag is the authentication check's business; asking for it here
    // as well is the duplicate this removes.
    expect(requestedKeys).not.toContain('google_drive_connected');
    // and the store still ends up knowing the answer
    expect(store.isConnected).toBe(true);
  });

  test('the remaining store keys are fetched together in one call', async () => {
    const backend = createMemoryBackend({
      sync: {
        google_drive_connected: true,
        google_drive_sync_enabled: true,
        google_drive_last_sync: '2026-08-01T00:00:00Z'
      }
    });

    const service = {
      isUsable: () => true,
      isAuthenticated: async () => true,
      getFolderConfiguration: async () => ({ useCustom: false, parentId: null, parentName: null }),
      getRootFolderId: async () => null
    };

    const store = useGoogleDriveStore();
    await store.initialize(service, backend);

    expect(backend.calls.syncGet).toBe(1);
    expect(store.syncEnabled).toBe(true);
    expect(store.lastSyncTime).toBe('2026-08-01T00:00:00Z');
  });

  test('a user who is not authenticated ends up disconnected, as before', async () => {
    // The store used to decide this from its own read of the connected flag. With
    // that read gone, the authentication check is the only thing that decides it,
    // so the false case needs pinning explicitly.
    const backend = createMemoryBackend({ sync: { google_drive_connected: false } });

    const service = {
      isUsable: () => true,
      isAuthenticated: async () => false,
      getFolderConfiguration: async () => ({ useCustom: false, parentId: null, parentName: null }),
      getRootFolderId: async () => null
    };

    const store = useGoogleDriveStore();
    await store.initialize(service, backend);

    expect(store.isConnected).toBe(false);
  });
});
