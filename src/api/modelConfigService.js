/**
 * Production bindings for the model catalog and model selection stores.
 * - Model list cache → chrome.storage.local (lists can be large; sync quota is tight)
 * - Model selections → chrome.storage.sync (small, follows the user across devices)
 * Both fall back to localStorage in development mode via storageService.
 */
import { createModelCatalog, withTimeout } from './modelCatalog';
import { createSelectionStore, resolveModel } from './modelSelection';
import { getLocalValue, storeLocalValue, getStoredValue, storeValue } from './storageService';
import { llmProviders } from '../config/llmProviders';

const asStore = (read, write) => ({
  read: async (key) => {
    const value = await read(key);
    return value === undefined || value === null ? null : value;
  },
  write
});

export const modelCatalogService = createModelCatalog({
  fetchImpl: withTimeout((url, options) => fetch(url, options), 15000),
  cacheStore: asStore(getLocalValue, storeLocalValue),
  now: () => Date.now()
});

export const modelSelectionStore = createSelectionStore({
  store: asStore(getStoredValue, storeValue)
});

/**
 * Resolve the model a provider should use for a capability right now:
 * stored selection (vision → chat) → provider fallback default.
 * @param {string} providerKey
 * @param {'chat'|'vision'} capability
 * @returns {Promise<string>}
 */
export async function resolveModelFor(providerKey, capability) {
  const selections = await modelSelectionStore.getSelections(providerKey);
  return resolveModel(capability, selections, llmProviders[providerKey]?.defaultModel);
}
