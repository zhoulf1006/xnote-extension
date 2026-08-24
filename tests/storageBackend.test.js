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
  STORAGE_KEYS,
  secureStorageService
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

  test('copies no mapping data to local storage when sync holds nothing to migrate', async () => {
    const backend = createMemoryBackend();
    await migrateSyncToLocalStorage(backend);
    // Counting keys present rather than comparing objects: a key set to undefined
    // compares equal to an absent one, so a contents comparison could not tell a
    // spurious write from no write. The completion marker is a local write too, so
    // this asserts on the mapping keys specifically rather than on the write count.
    const written = await backend.localGet([
      'drive_location_mappings',
      STORAGE_KEYS.SUMMARY_FOLDER_MAPPINGS,
      STORAGE_KEYS.SUMMARY_FILE_MAPPINGS,
      STORAGE_KEYS.SUMMARY_UPLOAD_STATUS
    ]);
    expect(Object.keys(written)).toHaveLength(0);
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

describe('one-time migrations do not re-run once complete', () => {
  const MAPPING_KEYS = [
    'drive_location_mappings',
    STORAGE_KEYS.SUMMARY_FOLDER_MAPPINGS,
    STORAGE_KEYS.SUMMARY_FILE_MAPPINGS,
    STORAGE_KEYS.SUMMARY_UPLOAD_STATUS
  ];

  test('a second startup performs no migration reads or writes', async () => {
    const backend = createMemoryBackend({ sync: { drive_location_mappings: { a: 1 } } });
    await migrateSyncToLocalStorage(backend);

    const afterFirst = { ...backend.calls };
    await migrateSyncToLocalStorage(backend);

    // Only the marker lookup may happen on a repeat startup — no per-key traffic,
    // and in particular no writes, which consume the hourly sync write quota.
    expect(backend.calls.syncGet).toBe(afterFirst.syncGet);
    expect(backend.calls.syncRemove).toBe(afterFirst.syncRemove);
    expect(backend.calls.localSet).toBe(afterFirst.localSet);
  });

  test('a user who has never migrated still migrates on their first startup', async () => {
    const seeded = {};
    for (const key of MAPPING_KEYS) seeded[key] = { [key]: 'value' };
    const backend = createMemoryBackend({ sync: { ...seeded } });

    await migrateSyncToLocalStorage(backend);

    for (const key of MAPPING_KEYS) {
      expect((await backend.localGet([key]))[key]).toEqual(seeded[key]);
      expect((await backend.syncGet([key]))[key]).toBeUndefined();
    }
  });

  test('a key whose copy fails is retried on the next startup, not marked done', async () => {
    const backend = createMemoryBackend({ sync: { drive_location_mappings: { a: 1 } } });
    let failNext = true;
    const flaky = {
      ...backend,
      localSet: async (items) => {
        if (failNext && 'drive_location_mappings' in items) {
          failNext = false;
          throw new Error('quota exceeded');
        }
        return backend.localSet(items);
      }
    };

    await migrateSyncToLocalStorage(flaky);
    // The copy failed, so the source must survive for the retry to have anything to move
    expect((await backend.syncGet(['drive_location_mappings'])).drive_location_mappings).toEqual({ a: 1 });

    await migrateSyncToLocalStorage(flaky);
    expect((await backend.localGet(['drive_location_mappings'])).drive_location_mappings).toEqual({ a: 1 });
  });
});

describe('the encryption migration also stops re-running once complete', () => {
  test('a marked run returns immediately without reading any sensitive key', async () => {
    const backend = createMemoryBackend({
      local: { storage_migration_encryption_v1: true },
      sync: { openai_api_key: 'plain-value' }
    });

    const result = await secureStorageService.migrateToEncrypted(backend);

    expect(result.skipped).toBe(true);
    // The whole cost saved: no per-key lookups at all
    expect(backend.calls.syncGet).toBe(0);
    expect(backend.calls.syncSet).toBe(0);
  });

  test('a run that could not encrypt is not marked done, so it retries later', async () => {
    // Encryption is unavailable in this environment, which is exactly the case that
    // must stay unmarked: values stored plain now still need migrating if it becomes
    // available later.
    const backend = createMemoryBackend({ sync: { openai_api_key: 'plain-value' } });

    await secureStorageService.migrateToEncrypted(backend);

    const marker = await backend.localGet(['storage_migration_encryption_v1']);
    expect(marker.storage_migration_encryption_v1).toBeUndefined();
  });
});

describe('storage diagnostics are opt-in', () => {
  test('with the switch off, nothing reads the whole store', async () => {
    const backend = createMemoryBackend({ sync: { openai_api_key: 'x', other: 'y' } });

    const status = await checkStorage(backend);

    // Reading the entire sync area just to print it is the cost being removed
    expect(backend.calls.syncGet).toBe(0);
    // The status callers log must still be produced
    expect(status.isExtensionMode).toBe(true);
    expect(status).toHaveProperty('hasExtensionURL');
    expect(status).toHaveProperty('devStorage');
  });

  test('with the switch on, it still reports what it used to', async () => {
    const backend = createMemoryBackend({ sync: { openai_api_key: 'x' } });

    const status = await checkStorage(backend, { verbose: true });

    expect(backend.calls.syncGet).toBeGreaterThan(0);
    expect(status.isExtensionMode).toBe(true);
    expect(status).toHaveProperty('hasExtensionURL');
    expect(status).toHaveProperty('devStorage');
  });
});
