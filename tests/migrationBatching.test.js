/**
 * The two startup migrations must ask for their keys in one round trip each.
 *
 * Separate file rather than added to storageBackend.test.js on purpose: enabling
 * encryption means initialising the shared secure-storage singleton, and that
 * state would leak into the cases there that depend on encryption being off.
 * Vitest isolates per file, so keeping them apart is what keeps both honest.
 */
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { createMemoryBackend } from '../src/api/storageBackend.js';
import {
  migrateSyncToLocalStorage,
  secureStorageService,
  STORAGE_KEYS
} from '../src/api/storageService.js';

/** Wraps a backend so the arguments of each read can be inspected, not just counted. */
function recordReads(backend) {
  const reads = [];
  return {
    backend: {
      ...backend,
      syncGet: async (keys) => { reads.push(keys); return backend.syncGet(keys); }
    },
    reads
  };
}

describe('the sync-to-local migration batches its reads and removes', () => {
  const MAPPING_KEYS = [
    'drive_location_mappings',
    STORAGE_KEYS.SUMMARY_FOLDER_MAPPINGS,
    STORAGE_KEYS.SUMMARY_FILE_MAPPINGS,
    STORAGE_KEYS.SUMMARY_UPLOAD_STATUS
  ];

  test('all four mapping keys are fetched in a single call', async () => {
    const seeded = {};
    for (const key of MAPPING_KEYS) seeded[key] = { value: key };
    const { backend, reads } = recordReads(createMemoryBackend({ sync: seeded }));

    await migrateSyncToLocalStorage(backend);

    expect(reads).toHaveLength(1);
    // One call is only the right call if it asked for everything it needed
    expect([...reads[0]].sort()).toEqual([...MAPPING_KEYS].sort());
  });

  test('the keys are removed from sync in a single call', async () => {
    const seeded = {};
    for (const key of MAPPING_KEYS) seeded[key] = { value: key };
    const base = createMemoryBackend({ sync: seeded });
    const removals = [];
    const backend = {
      ...base,
      syncRemove: async (keys) => { removals.push(keys); return base.syncRemove(keys); }
    };

    await migrateSyncToLocalStorage(backend);

    expect(removals).toHaveLength(1);
    expect([...removals[0]].sort()).toEqual([...MAPPING_KEYS].sort());
    // The data still has to arrive, and the source still has to be gone
    for (const key of MAPPING_KEYS) {
      expect((await base.localGet([key]))[key]).toEqual({ value: key });
      expect((await base.syncGet([key]))[key]).toBeUndefined();
    }
  });

  test('a failed batched read migrates nothing and stays unmarked for a retry', async () => {
    // The dangerous shape: if a failed read were treated as "no data found", every
    // key would look empty and be removed — deleting the data the migration exists
    // to preserve.
    const seeded = {};
    for (const key of MAPPING_KEYS) seeded[key] = { value: key };
    const base = createMemoryBackend({ sync: seeded });
    const backend = { ...base, syncGet: async () => { throw new Error('storage unavailable'); } };

    await migrateSyncToLocalStorage(backend);

    expect(base.calls.syncRemove).toBe(0);
    expect(base.calls.localSet).toBe(0);
    // Nothing was lost: the source data is still there for the next attempt
    for (const key of MAPPING_KEYS) {
      expect((await base.syncGet([key]))[key]).toEqual({ value: key });
    }
  });
});

describe('the encryption migration batches its reads', () => {
  // Encryption needs a device key, which is derived from `screen`. Supplying it is
  // supplying the environment a real browser has, not reaching into the service.
  beforeAll(async () => {
    globalThis.screen = { width: 1440, height: 900, colorDepth: 24 };
    await secureStorageService.initialize();
  });

  afterAll(() => { delete globalThis.screen; });

  const SENSITIVE_KEYS = [
    'openai_api_key',
    'customized_api_key',
    'deepseek_api_key',
    'gemini_api_key',
    'azure_speech_key'
  ];

  test('encryption really is enabled here, so the cases below exercise the real path', () => {
    // Asserted rather than skipped-if-unavailable: a conditional skip would turn an
    // environment change into a silent pass, and the two are indistinguishable in
    // the report.
    expect(secureStorageService.encryptionEnabled).toBe(true);
  });

  test('every sensitive key is fetched in a single call', async () => {
    const { backend, reads } = recordReads(createMemoryBackend({
      sync: { openai_api_key: 'plain-openai', deepseek_api_key: 'plain-deepseek' }
    }));

    await secureStorageService.migrateToEncrypted(backend);

    expect(reads).toHaveLength(1);
    expect([...reads[0]].sort()).toEqual([...SENSITIVE_KEYS].sort());
  });

  test('a failed batched read is not recorded as a completed migration', async () => {
    // Degrading to "found nothing" would look exactly like "nothing needed
    // migrating", and would mark the migration done without having read a key —
    // leaving plain-text values encrypted never.
    const base = createMemoryBackend({ sync: { openai_api_key: 'plain-openai' } });
    const backend = { ...base, syncGet: async () => { throw new Error('storage unavailable'); } };

    const result = await secureStorageService.migrateToEncrypted(backend);

    expect(result.errors.length).toBeGreaterThan(0);
    const marker = await base.localGet(['storage_migration_encryption_v1']);
    expect(marker.storage_migration_encryption_v1).toBeUndefined();
  });

  test('a plain value present in sync is replaced by an encrypted one', async () => {
    const base = createMemoryBackend({ sync: { openai_api_key: 'plain-openai' } });

    const result = await secureStorageService.migrateToEncrypted(base);

    expect(result.migrated).toBe(1);
    const stored = (await base.syncGet(['openai_api_key'])).openai_api_key;
    expect(stored).not.toBe('plain-openai');
  });
});
