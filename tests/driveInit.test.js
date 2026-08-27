/**
 * Google Drive initialization must not hold up the rest of startup, and whatever
 * happens to it must leave the panel in a state the user can act on.
 *
 * The Drive service is injected so these run with no chrome APIs present.
 */
import { describe, test, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useGoogleDriveStore } from '../src/stores/googleDrive.js';

// A service that never settles, to stand in for an unreachable network
const hangingService = {
  isUsable: () => true,
  isAuthenticated: () => new Promise(() => {}),
  getFolderConfiguration: () => new Promise(() => {}),
  getRootFolderId: () => new Promise(() => {})
};

const failingService = {
  isUsable: () => true,
  isAuthenticated: async () => { throw new Error('network unreachable'); },
  getFolderConfiguration: async () => { throw new Error('network unreachable'); },
  getRootFolderId: async () => { throw new Error('network unreachable'); }
};

beforeEach(() => setActivePinia(createPinia()));

describe('Drive initialization state', () => {
  test('an initialization in flight is reported as initializing, not as disconnected', async () => {
    const store = useGoogleDriveStore();

    store.initialize(hangingService);          // deliberately not awaited
    await Promise.resolve();

    expect(store.isInitializing).toBe(true);
    expect(store.initFailed).toBe(false);
  });

  test('a failed initialization settles into a defined failed state, not a permanent spinner', async () => {
    const store = useGoogleDriveStore();

    await store.initialize(failingService);

    expect(store.isInitializing).toBe(false);
    expect(store.initFailed).toBe(true);
    // The entry must remain in the rail so the user can open it and retry
    expect(store.isAvailable).toBe(true);
  });

  test('waiting for readiness resolves once initialization settles, so callers never act on a half-set store', async () => {
    const store = useGoogleDriveStore();

    const done = store.initialize(failingService);
    const ready = store.whenReady();
    await done;

    await expect(ready).resolves.toBeDefined();
    expect(store.isInitializing).toBe(false);
  });
});

describe('Drive-dependent actions during initialization', () => {
  test('syncing waits for initialization rather than reporting "not connected"', async () => {
    const store = useGoogleDriveStore();
    store.initialize(hangingService);          // never settles
    await Promise.resolve();

    let settled = false;
    const sync = store.syncAll().then(() => { settled = true; });
    // Give it several turns; a silent no-op would have resolved by now
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();

    expect(settled).toBe(false);
    expect(store.lastSyncError).toBeNull();    // it has not claimed a cause it cannot know
    return Promise.race([sync, Promise.resolve()]);
  });
});
