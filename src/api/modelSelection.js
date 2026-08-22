/**
 * Model selection storage + resolution.
 * Selections are per-provider {chat, vision} model IDs; null means "not selected".
 * A null vision selection means "same as chat model".
 */

/**
 * Resolve the model to use for a capability.
 * vision → chat → provider fallback default; chat → provider fallback default.
 * @param {'chat'|'vision'} capability
 * @param {{chat: string|null, vision: string|null}|null} selections
 * @param {string} fallbackDefault
 * @returns {string}
 */
/**
 * Create a per-provider selection store on top of an injected key/value store.
 * @param {{store: {read: Function, write: Function}}} deps
 */
export function createSelectionStore({ store }) {
  const key = (providerKey) => `model_selection_${providerKey}`;

  async function getSelections(providerKey) {
    const stored = await store.read(key(providerKey));
    return {
      chat: stored?.chat || null,
      vision: stored?.vision || null
    };
  }

  async function setSelections(providerKey, { chat, vision }) {
    await store.write(key(providerKey), {
      chat: chat || null,
      vision: vision || null
    });
  }

  return { getSelections, setSelections };
}

/**
 * Sanitize a manually-entered model ID: trim; empty/whitespace-only → null.
 * @param {string|null|undefined} raw
 * @returns {string|null}
 */
export function sanitizeModelInput(raw) {
  const trimmed = (raw || '').trim();
  return trimmed === '' ? null : trimmed;
}

export function resolveModel(capability, selections, fallbackDefault) {
  if (capability === 'vision') {
    return selections?.vision || selections?.chat || fallbackDefault;
  }
  return selections?.chat || fallbackDefault;
}
