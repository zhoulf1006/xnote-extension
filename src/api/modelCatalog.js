/**
 * Model catalog service — fetches and parses each provider's list-models API.
 * Pure logic (parsing/filtering/request construction) is exported directly;
 * network and cache storage are injected via createModelCatalog for testability.
 */

/**
 * Parse a provider's list-models response into an array of model ID strings.
 * @param {string} providerKey - openai | deepseek | gemini | customized
 * @param {Object} json - The parsed response body
 * @returns {string[]} Model IDs
 */
/**
 * Create a model catalog with injected dependencies.
 * @param {{fetchImpl: Function, cacheStore: {read: Function, write: Function}, now: Function}} deps
 */
export function createModelCatalog({ fetchImpl, cacheStore, now }) {
  const cacheKey = (providerKey) => `model_list_cache_${providerKey}`;

  async function fetchPage(providerKey, { apiKey, baseURL, pageToken }) {
    const { url, headers } = buildModelsRequest(providerKey, { apiKey, baseURL, pageToken });
    let response;
    try {
      response = await fetchImpl(url, { headers });
    } catch (e) {
      throw new ModelListFetchError(`Network error fetching model list: ${e.message}`);
    }
    if (response.status === 401 || response.status === 403) {
      throw new ModelListAuthError(`Model list request rejected (${response.status})`);
    }
    if (!response.ok) {
      throw new ModelListFetchError(`Model list request failed (HTTP ${response.status})`);
    }
    try {
      return await response.json();
    } catch (e) {
      throw new ModelListFetchError('Model list response was not valid JSON');
    }
  }

  async function fetchModels(providerKey, { apiKey, baseURL } = {}) {
    const models = [];
    let pageToken;
    do {
      const json = await fetchPage(providerKey, { apiKey, baseURL, pageToken });
      models.push(...parseModelsResponse(providerKey, json));
      pageToken = providerKey === 'gemini' ? json.nextPageToken : undefined;
    } while (pageToken);
    const entry = { models, fetchedAt: now() };
    await cacheStore.write(cacheKey(providerKey), entry);
    return entry;
  }

  async function readCache(providerKey) {
    return await cacheStore.read(cacheKey(providerKey));
  }

  return { fetchModels, readCache };
}

/** Thrown when a list-models response doesn't have the expected shape. */
export class ModelListParseError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ModelListParseError';
  }
}

/** Thrown when the provider rejects the API key (401/403). */
export class ModelListAuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ModelListAuthError';
  }
}

/** Thrown on network failure, non-2xx status (other than auth), or invalid JSON. */
export class ModelListFetchError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ModelListFetchError';
  }
}

// OpenAI's list API has no capability metadata, so non-chat models are excluded
// by ID heuristic. Deliberately loose — the manual model-ID entry in the UI is
// the escape hatch for anything this filter gets wrong.
const OPENAI_EXCLUDE = /embedding|tts|whisper|transcribe|dall-e|image|moderation|realtime|audio/i;

const GEMINI_MODELS_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Wrap a fetch implementation so requests abort after timeoutMs.
 * The abort rejection surfaces through fetchModels as ModelListFetchError.
 */
export function withTimeout(fetchImpl, timeoutMs) {
  return async (url, options = {}) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetchImpl(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }
  };
}

/** Trim whitespace and trailing slashes from a user-entered base URL. */
export function normalizeBaseUrl(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

/**
 * Build the list-models request for a provider.
 * @param {string} providerKey
 * @param {{apiKey: string, baseURL?: string, pageToken?: string}} opts
 * @returns {{url: string, headers: Object}}
 */
export function buildModelsRequest(providerKey, { apiKey, baseURL, pageToken } = {}) {
  if (providerKey === 'gemini') {
    let url = `${GEMINI_MODELS_URL}?key=${encodeURIComponent(apiKey)}&pageSize=1000`;
    if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;
    return { url, headers: {} };
  }
  return {
    url: `${normalizeBaseUrl(baseURL)}/models`,
    headers: { Authorization: `Bearer ${apiKey}` }
  };
}

// Vision capability by name heuristic — the list APIs expose no capability
// metadata. Deliberately loose; manual model-ID entry is the escape hatch,
// and a wrong pick surfaces as a provider error at request time.
const VISION_CAPABLE = {
  deepseek: id => /vision|vl/i.test(id),
  openai: id => /^(gpt-4o|gpt-4\.1|gpt-4-turbo|gpt-5|chatgpt-|o[1345])/i.test(id)
};

/**
 * Filter a model list down to vision-capable models for a provider.
 * Providers without a known heuristic (gemini: chat models are multimodal;
 * customized: unknown endpoint) pass through unchanged.
 * @param {string} providerKey
 * @param {string[]} ids
 * @returns {string[]}
 */
export function filterVisionCapable(providerKey, ids) {
  const test = VISION_CAPABLE[providerKey];
  return test ? ids.filter(test) : ids;
}

export function parseModelsResponse(providerKey, json) {
  if (providerKey === 'gemini') {
    if (!Array.isArray(json?.models)) {
      throw new ModelListParseError('Gemini response has no models array');
    }
    return json.models
      .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map(m => m.name.replace(/^models\//, ''));
  }
  if (!Array.isArray(json?.data)) {
    throw new ModelListParseError('Model list response has no data array');
  }
  const ids = json.data.map(m => m.id);
  if (providerKey === 'openai') {
    return ids.filter(id => !OPENAI_EXCLUDE.test(id));
  }
  return ids;
}
