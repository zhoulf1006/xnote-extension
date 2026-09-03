/**
 * The whole startup path, all tickets combined (#19's closeout case).
 *
 * Every other file verifies one slice against fakes; this one runs
 * buildStartupSteps with the *real* migrations, the real readiness wiring shape
 * App.vue uses, and the real folder-configuration read, against one seeded
 * backend — because markers (#14), batching (#18), readiness (#31) and
 * concurrency (#18) interact in ways no single-slice case exercises: a marker
 * written by one step gates another; the readiness run started by the
 * prerequisite is joined by a store read; the second open must be cheap because
 * of state the first open wrote.
 *
 * Own file on purpose: enabling encryption initialises the shared secure-storage
 * singleton, which must not leak into files whose cases depend on it being off.
 *
 * Still not covered here (needs a real panel — the extension-mode run):
 * initializeStorage's extension branch (chrome API wait), and that App.vue hands
 * these exact dependencies to these exact roles.
 */
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { createMemoryBackend } from '../src/api/storageBackend.js';
import {
  initializeStorage,
  migrateSyncToLocalStorage,
  secureStorageService,
  checkStorage,
  STORAGE_KEYS
} from '../src/api/storageService.js';
import { createStorageReadiness } from '../src/api/storageReadiness.js';
import { runStartupSequence } from '../src/sidepanel/startupSequence.js';
import { buildStartupSteps } from '../src/sidepanel/startupSteps.js';
import { useDriveMappings } from '../src/stores/driveMappings.js';
import { googleDriveService } from '../src/api/googleDriveService.js';
import encryptionService from '../src/api/encryptionService.js';

const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

beforeAll(async () => {
  // The environment a real browser has (pinned — see migrationBatching.test.js for
  // why relying on the runtime's own navigator split local from CI)
  globalThis.screen = { width: 1440, height: 900, colorDepth: 24 };
  Object.defineProperty(globalThis, 'navigator', {
    value: { userAgent: 'xnote-test-agent', language: 'en-US' },
    configurable: true,
    writable: true
  });
  await secureStorageService.initialize();
});

afterAll(() => {
  delete globalThis.screen;
  if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
  else delete globalThis.navigator;
});

/** A legacy user's storage the moment before their first startup on this version. */
function legacyBackend() {
  return createMemoryBackend({
    sync: {
      drive_location_mappings: { 'folder-1': { summaries: { url: 'file' } } },
      [STORAGE_KEYS.SUMMARY_FOLDER_MAPPINGS]: { url: { main: 'Education' } },
      openai_api_key: 'sk-plain-legacy-key',
      google_drive_sync_enabled: true
    }
  });
}

/**
 * The steps as App.vue wires them, against an injected backend. Kept in one place
 * so both cases run the identical shape.
 */
function realSteps(backend, readiness, driveSettled) {
  setActivePinia(createPinia());
  const store = useDriveMappings();
  return {
    store,
    steps: buildStartupSteps({
      initializeStorage,
      migrateMappings: () => readiness.ensure(backend),
      secureStorage: {
        encryptionEnabled: secureStorageService.encryptionEnabled,
        migrateToEncrypted: () => secureStorageService.migrateToEncrypted(backend)
      },
      checkStorage: () => checkStorage(backend),
      initializeDrive: async () => {
        // The store read joins the same readiness run the prerequisite started —
        // the #31 arrangement, exercised inside the full sequence.
        await store.loadMappings(readiness, backend);
        const config = await googleDriveService.getFolderConfiguration(backend);
        driveSettled.resolve(config);
        return true;
      },
      log: () => {},
      warn: () => {}
    })
  };
}

function deferred() {
  let resolve;
  const promise = new Promise((res) => { resolve = res; });
  return { promise, resolve };
}

describe('first startup of a legacy user, everything combined', () => {
  test('migrations, markers, readiness and the background read all land correctly', async () => {
    const backend = legacyBackend();
    const readiness = createStorageReadiness(() => migrateSyncToLocalStorage(backend));
    const driveSettled = deferred();
    const { store, steps } = realSteps(backend, readiness, driveSettled);

    const { value: status, failures } = await runStartupSequence(steps);
    await driveSettled.promise;

    // Nothing failed, and the prerequisite produced the status App.vue logs
    expect(failures).toEqual([]);
    expect(status).toHaveProperty('storageType');

    // Mapping data moved: present in local, gone from sync, marker set
    const local = await backend.localGet([
      'drive_location_mappings',
      STORAGE_KEYS.SUMMARY_FOLDER_MAPPINGS,
      'storage_migration_sync_to_local_v1'
    ]);
    expect(local.drive_location_mappings).toEqual({ 'folder-1': { summaries: { url: 'file' } } });
    expect(local[STORAGE_KEYS.SUMMARY_FOLDER_MAPPINGS]).toEqual({ url: { main: 'Education' } });
    expect(local.storage_migration_sync_to_local_v1).toBe(true);
    const sync = await backend.syncGet(['drive_location_mappings']);
    expect(sync.drive_location_mappings).toBeUndefined();

    // The plain API key was encrypted in place and its migration marked
    const key = (await backend.syncGet(['openai_api_key'])).openai_api_key;
    expect(key).not.toBe('sk-plain-legacy-key');
    expect(encryptionService.isEncryptedFormat(key)).toBe(true);
    const encMarker = await backend.localGet(['storage_migration_encryption_v1']);
    expect(encMarker.storage_migration_encryption_v1).toBe(true);

    // The background Drive read, having joined the readiness run, saw the
    // *migrated* mappings — the #31 guarantee inside the full sequence
    expect(store.locations).toEqual({ 'folder-1': { summaries: { url: 'file' } } });
  });
});

describe('the second open is cheap because of what the first one wrote', () => {
  test('no migration reads, writes or removes reach the backend again', async () => {
    const backend = legacyBackend();

    // First open, as above
    const r1 = createStorageReadiness(() => migrateSyncToLocalStorage(backend));
    const d1 = deferred();
    await runStartupSequence(realSteps(backend, r1, d1).steps);
    await d1.promise;

    // Second open: fresh readiness (a new page load has fresh module state),
    // same backend (the user's storage persists), and every operation counted
    const requestedSyncKeys = [];
    const counted = {
      ...backend,
      syncGet: async (keys) => {
        requestedSyncKeys.push(...(Array.isArray(keys) ? keys : [keys]));
        return backend.syncGet(keys);
      }
    };
    const before = { ...backend.calls };
    const r2 = createStorageReadiness(() => migrateSyncToLocalStorage(counted));
    const d2 = deferred();
    const { value, failures } = await runStartupSequence(realSteps(counted, r2, d2).steps);
    await d2.promise;

    expect(failures).toEqual([]);
    expect(value).toHaveProperty('storageType');

    // The markers gate both migrations: no mapping or sensitive key is fetched
    // again, nothing is removed, nothing is written
    for (const gated of [
      'drive_location_mappings',
      STORAGE_KEYS.SUMMARY_FOLDER_MAPPINGS,
      'openai_api_key'
    ]) {
      expect(requestedSyncKeys).not.toContain(gated);
    }
    expect(backend.calls.syncRemove).toBe(before.syncRemove);
    expect(backend.calls.syncSet).toBe(before.syncSet);

    // Recorded, not asserted exactly: the total backend traffic of a repeat open.
    // The measurement doc cites this figure; an assertion here would turn every
    // legitimate future read into a test failure with no defect behind it.
    const secondOpenOps =
      (backend.calls.syncGet - before.syncGet) +
      (backend.calls.localGet - before.localGet) +
      (backend.calls.localSet - before.localSet);
    console.log(`[measurement] second-open backend ops: ${secondOpenOps} ` +
      `(syncGet ${backend.calls.syncGet - before.syncGet}, ` +
      `localGet ${backend.calls.localGet - before.localGet}, ` +
      `localSet ${backend.calls.localSet - before.localSet})`);
    // It must at least stay in the single digits — the pre-#13 path issued 20+
    expect(secondOpenOps).toBeLessThan(10);
  });
});
