/**
 * Storage backend seam — lets the startup path run without a real extension context.
 *
 * Every case here runs with no `chrome` global present, which is the point: before
 * this seam existed, the startup functions took their development-mode branch in a
 * test environment and none of their real behaviour could be observed.
 */
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { createMemoryBackend } from '../src/api/storageBackend.js';
import {
  migrateSyncToLocalStorage,
  storeValue,
  getStoredValue,
  storeLocalValue,
  getLocalValue,
  checkStorage,
  STORAGE_KEYS
} from '../src/api/storageService.js';

// Guard against a stray chrome global leaking in from another module
beforeEach(() => { expect(globalThis.chrome).toBeUndefined(); });
afterEach(() => { delete globalThis.chrome; });

describe('createMemoryBackend', () => {
  test('reports itself available and round-trips sync values', async () => {
    const backend = createMemoryBackend({ sync: { alpha: 'one' } });
    expect(backend.isAvailable()).toBe(true);
    expect(await backend.syncGet(['alpha'])).toEqual({ alpha: 'one' });

    await backend.syncSet({ beta: 'two' });
    expect(await backend.syncGet(['alpha', 'beta'])).toEqual({ alpha: 'one', beta: 'two' });

    await backend.syncRemove('alpha');
    expect(await backend.syncGet(['alpha', 'beta'])).toEqual({ beta: 'two' });
  });

  test('keeps sync and local areas separate', async () => {
    const backend = createMemoryBackend();
    await backend.syncSet({ shared: 'from-sync' });
    await backend.localSet({ shared: 'from-local' });
    expect(await backend.syncGet(['shared'])).toEqual({ shared: 'from-sync' });
    expect(await backend.localGet(['shared'])).toEqual({ shared: 'from-local' });
  });

  test('records the operations performed, so callers can be measured', async () => {
    const backend = createMemoryBackend();
    await backend.syncGet(['a']);
    await backend.syncGet(['b']);
    await backend.syncSet({ c: 1 });
    expect(backend.calls.syncGet).toBe(2);
    expect(backend.calls.syncSet).toBe(1);
  });
});

describe('migrateSyncToLocalStorage with an injected backend', () => {
  test('moves an existing mapping value from sync into local storage', async () => {
    const backend = createMemoryBackend({
      sync: { drive_location_mappings: { locations: { abc: 'XNote' } } }
    });

    await migrateSyncToLocalStorage(backend);

    const local = await backend.localGet(['drive_location_mappings']);
    expect(local.drive_location_mappings).toEqual({ locations: { abc: 'XNote' } });
    const sync = await backend.syncGet(['drive_location_mappings']);
    expect(sync.drive_location_mappings).toBeUndefined();
  });

  test('writes nothing to local storage when sync holds nothing to migrate', async () => {
    const backend = createMemoryBackend();
    await migrateSyncToLocalStorage(backend);
    // Asserting on the write itself, not on the resulting contents: an object holding
    // the key with an undefined value compares equal to an empty one, so a contents
    // check cannot tell a spurious write from no write.
    expect(backend.calls.localSet).toBe(0);
  });
});

describe('storage primitives with an injected backend', () => {
  test('storeValue then getStoredValue round-trips through the injected backend', async () => {
    const backend = createMemoryBackend();
    await storeValue('some_key', 'some-value', backend);
    expect(await getStoredValue('some_key', undefined, backend)).toBe('some-value');
    expect(backend.calls.syncSet).toBe(1);
    expect(backend.calls.syncGet).toBe(1);
  });

  test('getStoredValue answers null for a key the backend does not hold', async () => {
    const backend = createMemoryBackend();
    expect(await getStoredValue('never_written', undefined, backend)).toBeNull();
  });

  test('local values are stored separately from sync values', async () => {
    const backend = createMemoryBackend();
    await storeLocalValue('big_data', { a: 1 }, backend);
    expect(await getLocalValue('big_data', backend)).toEqual({ a: 1 });
    // the same key in the sync area is untouched
    expect(await getStoredValue('big_data', undefined, backend)).toBeNull();
  });
});

describe('checkStorage with an injected backend', () => {
  test('reports the backend as the active storage and reads what it holds', async () => {
    const backend = createMemoryBackend({ sync: { alpha: 'one', beta: 'two' } });
    const status = await checkStorage(backend);
    expect(status.isExtensionMode).toBe(true);
    expect(backend.calls.syncGet).toBeGreaterThan(0);
  });
});

describe('startup sequence preserves mapping data while freeing sync quota', () => {
  // Sourced from production rather than retyped: a rename there must break this
  // test loudly instead of quietly making it seed keys nothing looks at.
  const MAPPING_KEYS = [
    'drive_location_mappings',
    STORAGE_KEYS.SUMMARY_FOLDER_MAPPINGS,
    STORAGE_KEYS.SUMMARY_FILE_MAPPINGS,
    STORAGE_KEYS.SUMMARY_UPLOAD_STATUS
  ];

  test('every mapping key present in sync ends up in local, and none is left in sync', async () => {
    const seeded = {};
    for (const key of MAPPING_KEYS) seeded[key] = { [key + '_value']: true };
    const backend = createMemoryBackend({ sync: { ...seeded } });

    await migrateSyncToLocalStorage(backend);

    // Data preserved: nothing may be dropped on the floor
    for (const key of MAPPING_KEYS) {
      const local = await backend.localGet([key]);
      expect(local[key]).toEqual(seeded[key]);
    }
    // Quota freed: the whole point of touching these keys at all
    for (const key of MAPPING_KEYS) {
      const sync = await backend.syncGet([key]);
      expect(sync[key]).toBeUndefined();
    }
  });
});
