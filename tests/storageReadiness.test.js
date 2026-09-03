/**
 * Storage readiness — the signal that lets mapping readers wait out the migration.
 *
 * The sync→local migration is what puts the mapping keys into local storage, and
 * components read those keys from local in their own `onMounted` — which Vue runs
 * before the parent's. #18 fixed this ordering *inside* the startup sequence; this
 * covers readers the sequence cannot see, by having the store itself await the same
 * single migration run instead of trusting whoever mounted it to have waited.
 *
 * The run is single-flight: whoever asks first starts it, everyone else joins. So
 * the guarantee no longer depends on who mounts when — the property the old
 * arrangement lost the moment a child mounted early.
 *
 * Known gap, stated rather than papered over: these cases drive injected readiness
 * instances. Nothing here proves App.vue wires the startup prerequisite through the
 * *singleton* the stores default to — wiring it to a fresh instance instead would
 * split the run in two and turn nothing red. Same declared gap as the startup-steps
 * wiring in #18; closing it needs a started panel (#19's extension-mode run).
 */
import { describe, test, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { createMemoryBackend } from '../src/api/storageBackend.js';
import { migrateSyncToLocalStorage } from '../src/api/storageService.js';
import { createStorageReadiness } from '../src/api/storageReadiness.js';
import { useDriveMappings } from '../src/stores/driveMappings.js';

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => setActivePinia(createPinia()));

/** A backend whose local writes take a real turn, so "mid-flight" is reachable. */
function slowCopyBackend(seedSync) {
  const base = createMemoryBackend({ sync: seedSync });
  return {
    ...base,
    base,
    localSet: async (items) => { await tick(); return base.localSet(items); }
  };
}

describe('the readiness run is single-flight', () => {
  test('two callers share one migration run instead of starting two', async () => {
    let runs = 0;
    const readiness = createStorageReadiness(async () => { runs++; await tick(); });

    await Promise.all([readiness.ensure(), readiness.ensure()]);
    await readiness.ensure();

    expect(runs).toBe(1);
  });
});

describe('a reader that mounts before the migration finishes', () => {
  test('still loads the migrated mappings, not the pre-migration emptiness', async () => {
    const migrated = { 'folder-abc': { summaries: { url1: 'file1' } } };
    const backend = slowCopyBackend({ drive_location_mappings: migrated });
    const readiness = createStorageReadiness(() => migrateSyncToLocalStorage(backend));

    // Startup begins the migration…
    const startupRun = readiness.ensure();
    // …and the component mounts immediately after, while the copy is still in
    // flight. Without the await this read sees local storage before the key lands.
    const store = useDriveMappings();
    await store.loadMappings(readiness, backend);

    expect(store.locations).toEqual(migrated);
    await startupRun;
  });

  test('the reader does not start a second migration, it joins the one in flight', async () => {
    let runs = 0;
    const backend = createMemoryBackend({ sync: { drive_location_mappings: { a: 1 } } });
    const readiness = createStorageReadiness(async () => { runs++; return migrateSyncToLocalStorage(backend); });

    readiness.ensure();
    const store = useDriveMappings();
    await store.loadMappings(readiness, backend);

    expect(runs).toBe(1);
  });

  test('a reader arriving first starts the run itself rather than hanging', async () => {
    // Nothing guarantees startup got there before the component did — that is the
    // whole lesson. The first asker starts the run; startup joins later.
    const migrated = { 'folder-x': { chats: {} } };
    const backend = createMemoryBackend({ sync: { drive_location_mappings: migrated } });
    const readiness = createStorageReadiness(() => migrateSyncToLocalStorage(backend));

    const store = useDriveMappings();
    await store.loadMappings(readiness, backend);

    expect(store.locations).toEqual(migrated);
  });
});

describe('a write that lands while the migration is mid-flight', () => {
  test('is not overwritten by the legacy data the migration is copying', async () => {
    // The mirror of the read race: the migration's copy is the *last* write to win
    // unless writers also wait for it. Without the await, the user's change lands
    // first and the legacy sync data then lands on top of it — a silent revert, on
    // the one startup where the migration actually copies.
    const legacy = { 'folder-legacy': { summaries: { old: 'file-old' } } };
    const backend = slowCopyBackend({ drive_location_mappings: legacy });
    const readiness = createStorageReadiness(() => migrateSyncToLocalStorage(backend));

    const startupRun = readiness.ensure();       // copy in flight

    const store = useDriveMappings();
    // State reachable via setCurrentLocation; assigned directly because that action
    // also persists, which is the very step under test here.
    store.locations = { 'folder-new': { summaries: {} } };
    await store.saveToStorage(readiness, backend);
    await startupRun;

    const stored = (await backend.base.localGet(['drive_location_mappings'])).drive_location_mappings;
    expect(stored).toEqual({ 'folder-new': { summaries: {} } });
  });

  test('a failed migration does not block the write either', async () => {
    const backend = createMemoryBackend();
    const readiness = createStorageReadiness(async () => { throw new Error('marker write failed'); });

    const store = useDriveMappings();
    store.locations = { 'folder-x': { chats: {} } };
    await store.saveToStorage(readiness, backend);

    const stored = (await backend.localGet(['drive_location_mappings'])).drive_location_mappings;
    expect(stored).toEqual({ 'folder-x': { chats: {} } });
  });
});

describe('a failed migration degrades the read instead of blocking it', () => {
  test('the reader still loads whatever local storage already holds', async () => {
    const existing = { 'folder-old': { summaries: {} } };
    const backend = createMemoryBackend({ local: { drive_location_mappings: existing } });
    const readiness = createStorageReadiness(async () => { throw new Error('marker write failed'); });

    const store = useDriveMappings();
    await store.loadMappings(readiness, backend);

    // The migration failing must not cost the reader data that is already there
    expect(store.locations).toEqual(existing);
  });

  test('the failure is still visible to a caller that asks directly', async () => {
    // The startup prerequisite awaits ensure() itself and surfaces the error to the
    // user; the reader swallowing it must not have swallowed it for everyone.
    const readiness = createStorageReadiness(async () => { throw new Error('marker write failed'); });

    await expect(readiness.ensure()).rejects.toThrow('marker write failed');
  });
});
