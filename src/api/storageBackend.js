/**
 * Storage backend — the seam between the startup logic and chrome.storage.
 *
 * The startup path used to reach for chrome.storage directly, so none of it could
 * run outside a real extension context and none of it had automated coverage.
 * Functions on that path now accept a backend and default to the Chrome one, which
 * leaves every existing call site unchanged while making the logic drivable in tests.
 *
 * A backend exposes:
 *   isAvailable()        -> boolean
 *   syncGet(keys)        -> Promise<object>   keys: array of key names
 *   syncSet(items)       -> Promise<void>
 *   syncRemove(key)      -> Promise<void>
 *   localGet(keys)       -> Promise<object>
 *   localSet(items)      -> Promise<void>
 *
 * Reads answer with an object holding only the keys that are present, mirroring
 * chrome.storage's own behaviour, so an absent key is an absent property rather
 * than an explicit undefined.
 */

const AREA_TIMEOUT_MS = 3000;

function promisify(area, method, arg) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(
      () => reject(new Error(`Chrome storage API timeout after ${AREA_TIMEOUT_MS}ms`)),
      AREA_TIMEOUT_MS
    );
    area[method](arg, (result) => {
      clearTimeout(timeoutId);
      if (chrome.runtime?.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(result);
      }
    });
  });
}

/** The real backend, talking to chrome.storage. */
export const chromeStorageBackend = {
  isAvailable: () => typeof chrome !== 'undefined' && !!chrome.storage && !!chrome.storage.sync,
  syncGet: (keys) => promisify(chrome.storage.sync, 'get', keys),
  syncSet: (items) => promisify(chrome.storage.sync, 'set', items),
  syncRemove: (key) => promisify(chrome.storage.sync, 'remove', key),
  localGet: (keys) => promisify(chrome.storage.local, 'get', keys),
  localSet: (items) => promisify(chrome.storage.local, 'set', items)
};

/**
 * An in-memory backend for tests and for driving the startup path without Chrome.
 * Counts the operations performed so callers can be measured, not just observed.
 * @param {{sync?: object, local?: object}} [seed] - initial contents per area
 */
export function createMemoryBackend(seed = {}) {
  const areas = {
    sync: { ...(seed.sync || {}) },
    local: { ...(seed.local || {}) }
  };
  const calls = { syncGet: 0, syncSet: 0, syncRemove: 0, localGet: 0, localSet: 0 };

  const read = (areaName, keys) => {
    const area = areas[areaName];
    // A null/undefined key list means "everything", as chrome.storage does
    const wanted = keys === null || keys === undefined
      ? Object.keys(area)
      : (Array.isArray(keys) ? keys : [keys]);
    const result = {};
    for (const key of wanted) {
      if (key in area) result[key] = area[key];
    }
    return result;
  };

  return {
    calls,
    isAvailable: () => true,
    syncGet: async (keys) => { calls.syncGet++; return read('sync', keys); },
    syncSet: async (items) => { calls.syncSet++; Object.assign(areas.sync, items); },
    // Accepts an array as well as a single key, because chrome.storage.remove does.
    // A double that only handled one key would make batched removal look broken here
    // while working in the browser — the direction of divergence that costs most.
    syncRemove: async (keys) => {
      calls.syncRemove++;
      for (const key of (Array.isArray(keys) ? keys : [keys])) delete areas.sync[key];
    },
    localGet: async (keys) => { calls.localGet++; return read('local', keys); },
    localSet: async (items) => { calls.localSet++; Object.assign(areas.local, items); }
  };
}
