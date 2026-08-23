/**
 * Model catalog service — list-models fetch/parse/filter/cache logic.
 * Coverage source: the Failure Modes and Boundaries section of docs/specs/llm-model-selection.md.
 *
 * Known gaps (not testable at this seam — App.vue orchestration has no component-test
 * infrastructure; covered manually in the config modal, see docs/.workings/llm-model-selection):
 * - stale-response guard on provider switch mid-fetch (spec #13)
 * - stale-while-revalidate display (cached list shown while refetching, spec #2)
 * - state-note rendering for loading/401/cached/no-key/empty (spec #1-5 UI half)
 * - selected-model-not-in-list display (spec #7 UI half)
 * - production storage bindings in modelConfigService (thin glue over storageService)
 */
import { describe, test, expect } from 'vitest';
import {
  parseModelsResponse,
  ModelListParseError,
  normalizeBaseUrl,
  buildModelsRequest,
  createModelCatalog,
  withTimeout,
  filterVisionCapable
} from '../src/api/modelCatalog.js';

/** In-memory cache store with the injected-store contract. */
const memoryStore = () => {
  const map = new Map();
  return {
    read: async (key) => (map.has(key) ? map.get(key) : null),
    write: async (key, value) => { map.set(key, value); }
  };
};

/** Fake fetch that routes by exact URL; anything unrouted 404s. */
const routedFetch = (routes) => async (url) => {
  if (url in routes) {
    const r = routes[url];
    if (r instanceof Error) throw r;
    return { ok: r.status === 200, status: r.status, json: async () => r.body };
  }
  return { ok: false, status: 404, json: async () => ({}) };
};

// Fixture shaped like the real DeepSeek /models response (OpenAI-compatible list)
const DEEPSEEK_RESPONSE = {
  object: 'list',
  data: [
    { id: 'deepseek-chat', object: 'model', owned_by: 'deepseek' },
    { id: 'deepseek-reasoner', object: 'model', owned_by: 'deepseek' }
  ]
};

describe('parseModelsResponse — deepseek', () => {
  test('returns all model ids unfiltered', () => {
    expect(parseModelsResponse('deepseek', DEEPSEEK_RESPONSE))
      .toEqual(['deepseek-chat', 'deepseek-reasoner']);
  });
});

// Fixture shaped like the real OpenAI /v1/models response: chat models mixed with
// embeddings, TTS, transcription, image, moderation and realtime entries.
const OPENAI_RESPONSE = {
  object: 'list',
  data: [
    { id: 'gpt-4o', object: 'model', created: 1715367049, owned_by: 'system' },
    { id: 'text-embedding-3-small', object: 'model', created: 1705948997, owned_by: 'system' },
    { id: 'tts-1-hd', object: 'model', created: 1699053241, owned_by: 'system' },
    { id: 'whisper-1', object: 'model', created: 1677532384, owned_by: 'openai-internal' },
    { id: 'dall-e-3', object: 'model', created: 1698785189, owned_by: 'system' },
    { id: 'omni-moderation-latest', object: 'model', created: 1731689265, owned_by: 'system' },
    { id: 'gpt-4o-realtime-preview', object: 'model', created: 1727659998, owned_by: 'system' },
    { id: 'gpt-4o-audio-preview', object: 'model', created: 1727460443, owned_by: 'system' },
    { id: 'gpt-image-1', object: 'model', created: 1745517030, owned_by: 'system' },
    { id: 'o3-mini', object: 'model', created: 1737146383, owned_by: 'system' },
    { id: 'chatgpt-4o-latest', object: 'model', created: 1723515131, owned_by: 'system' },
    { id: 'gpt-4.1-2025-04-14', object: 'model', created: 1744315746, owned_by: 'system' }
  ]
};

describe('parseModelsResponse — openai', () => {
  test('keeps chat models, excludes embeddings/tts/transcription/image/moderation/realtime/audio', () => {
    expect(parseModelsResponse('openai', OPENAI_RESPONSE))
      .toEqual(['gpt-4o', 'o3-mini', 'chatgpt-4o-latest', 'gpt-4.1-2025-04-14']);
  });
});

// Fixture shaped like the real Gemini v1beta models.list response: "models/" name
// prefix, per-model supportedGenerationMethods, embedding entries, extra fields.
const GEMINI_PAGE = {
  models: [
    {
      name: 'models/gemini-2.0-flash',
      version: '2.0',
      displayName: 'Gemini 2.0 Flash',
      description: 'Gemini 2.0 Flash',
      inputTokenLimit: 1048576,
      outputTokenLimit: 8192,
      supportedGenerationMethods: ['generateContent', 'countTokens', 'createCachedContent'],
      temperature: 1,
      topP: 0.95,
      topK: 40
    },
    {
      name: 'models/text-embedding-004',
      version: '004',
      displayName: 'Text Embedding 004',
      supportedGenerationMethods: ['embedContent']
    },
    {
      name: 'models/gemini-2.5-flash-preview-native-audio-dialog',
      version: '2.5',
      displayName: 'Gemini 2.5 Flash Native Audio Dialog',
      supportedGenerationMethods: ['countTokens', 'bidiGenerateContent']
    },
    {
      name: 'models/gemini-2.5-pro',
      version: '2.5',
      displayName: 'Gemini 2.5 Pro',
      supportedGenerationMethods: ['generateContent', 'countTokens'],
      thinking: true
    }
  ]
};

describe('parseModelsResponse — gemini', () => {
  test('strips models/ prefix and keeps only generateContent-capable models', () => {
    expect(parseModelsResponse('gemini', GEMINI_PAGE))
      .toEqual(['gemini-2.0-flash', 'gemini-2.5-pro']);
  });
});

const thrownBy = (fn) => { try { fn(); return null; } catch (e) { return e; } };

describe('parseModelsResponse — malformed shapes', () => {
  test('throws ModelListParseError when the expected array is missing', () => {
    expect(thrownBy(() => parseModelsResponse('deepseek', { error: { message: 'oops' } }))?.name)
      .toBe('ModelListParseError');
    expect(thrownBy(() => parseModelsResponse('gemini', { data: [] }))?.name)
      .toBe('ModelListParseError');
    expect(thrownBy(() => parseModelsResponse('openai', { object: 'list', data: 'nope' }))?.name)
      .toBe('ModelListParseError');
  });

  test('an empty list parses to an empty array, not an error', () => {
    expect(parseModelsResponse('deepseek', { object: 'list', data: [] })).toEqual([]);
    expect(parseModelsResponse('gemini', { models: [] })).toEqual([]);
  });
});

// The list APIs expose no capability metadata, so vision capability is a
// name-based heuristic per provider; the manual model-ID entry is the escape hatch.
describe('filterVisionCapable', () => {
  test('deepseek: only vision/vl-named models', () => {
    expect(filterVisionCapable('deepseek',
      ['deepseek-chat', 'deepseek-reasoner', 'deepseek-v4-flash-vision-exp', 'deepseek-vl2']))
      .toEqual(['deepseek-v4-flash-vision-exp', 'deepseek-vl2']);
  });

  test('openai: multimodal families kept, text-only families dropped', () => {
    expect(filterVisionCapable('openai',
      ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4-turbo', 'gpt-3.5-turbo', 'chatgpt-4o-latest', 'o3-mini', 'gpt-5.2']))
      .toEqual(['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4-turbo', 'chatgpt-4o-latest', 'o3-mini', 'gpt-5.2']);
  });

  test('gemini and customized: passthrough (gemini chat models are multimodal; customized is unknown)', () => {
    expect(filterVisionCapable('gemini', ['gemini-2.0-flash', 'gemini-2.5-pro']))
      .toEqual(['gemini-2.0-flash', 'gemini-2.5-pro']);
    expect(filterVisionCapable('customized', ['some/model-a', 'some/model-b']))
      .toEqual(['some/model-a', 'some/model-b']);
  });
});

describe('normalizeBaseUrl', () => {
  test('strips trailing slashes and surrounding whitespace', () => {
    expect(normalizeBaseUrl('https://api.example.com/v1/')).toBe('https://api.example.com/v1');
    expect(normalizeBaseUrl('https://api.example.com/v1///')).toBe('https://api.example.com/v1');
    expect(normalizeBaseUrl('  https://api.example.com/v1  ')).toBe('https://api.example.com/v1');
    expect(normalizeBaseUrl('https://api.example.com/v1')).toBe('https://api.example.com/v1');
  });
});

describe('buildModelsRequest', () => {
  test('openai-compatible providers: {baseURL}/models with Bearer auth', () => {
    expect(buildModelsRequest('openai', { apiKey: 'sk-test', baseURL: 'https://api.openai.com/v1' }))
      .toEqual({ url: 'https://api.openai.com/v1/models', headers: { Authorization: 'Bearer sk-test' } });
    expect(buildModelsRequest('deepseek', { apiKey: 'sk-ds', baseURL: 'https://api.deepseek.com' }))
      .toEqual({ url: 'https://api.deepseek.com/models', headers: { Authorization: 'Bearer sk-ds' } });
    expect(buildModelsRequest('customized', { apiKey: 'ck', baseURL: 'https://my.host/v1/' }))
      .toEqual({ url: 'https://my.host/v1/models', headers: { Authorization: 'Bearer ck' } });
  });

  test('gemini: REST models URL with key and max page size, no auth header', () => {
    expect(buildModelsRequest('gemini', { apiKey: 'g-key' })).toEqual({
      url: 'https://generativelanguage.googleapis.com/v1beta/models?key=g-key&pageSize=1000',
      headers: {}
    });
  });

  test('gemini: pageToken appended when following pagination', () => {
    expect(buildModelsRequest('gemini', { apiKey: 'g-key', pageToken: 'tok123' }).url)
      .toBe('https://generativelanguage.googleapis.com/v1beta/models?key=g-key&pageSize=1000&pageToken=tok123');
  });
});

describe('createModelCatalog — fetchModels', () => {
  test('success: returns models with timestamp and makes them readable from cache', async () => {
    const store = memoryStore();
    const catalog = createModelCatalog({
      fetchImpl: routedFetch({
        'https://api.deepseek.com/models': { status: 200, body: DEEPSEEK_RESPONSE }
      }),
      cacheStore: store,
      now: () => 1723456789000
    });

    const result = await catalog.fetchModels('deepseek', {
      apiKey: 'sk-ds', baseURL: 'https://api.deepseek.com'
    });
    expect(result).toEqual({
      models: ['deepseek-chat', 'deepseek-reasoner'],
      fetchedAt: 1723456789000
    });

    // Cache survives into a fresh catalog sharing the same store
    const catalog2 = createModelCatalog({
      fetchImpl: routedFetch({}), cacheStore: store, now: () => 0
    });
    expect(await catalog2.readCache('deepseek')).toEqual({
      models: ['deepseek-chat', 'deepseek-reasoner'],
      fetchedAt: 1723456789000
    });
  });

  test('readCache returns null when nothing was ever fetched', async () => {
    const catalog = createModelCatalog({
      fetchImpl: routedFetch({}), cacheStore: memoryStore(), now: () => 0
    });
    expect(await catalog.readCache('openai')).toBeNull();
  });

  test('401 rejects with ModelListAuthError and keeps prior cache intact', async () => {
    const store = memoryStore();
    const url = 'https://api.deepseek.com/models';
    // Seed cache through the public path with a working key
    const good = createModelCatalog({
      fetchImpl: routedFetch({ [url]: { status: 200, body: DEEPSEEK_RESPONSE } }),
      cacheStore: store, now: () => 1000
    });
    await good.fetchModels('deepseek', { apiKey: 'sk-ok', baseURL: 'https://api.deepseek.com' });

    // Same store, key now rejected upstream
    const bad = createModelCatalog({
      fetchImpl: routedFetch({ [url]: { status: 401, body: { error: { message: 'invalid api key' } } } }),
      cacheStore: store, now: () => 2000
    });
    const err = await bad.fetchModels('deepseek', { apiKey: 'sk-bad', baseURL: 'https://api.deepseek.com' })
      .then(() => null, (e) => e);
    expect(err?.name).toBe('ModelListAuthError');
    expect(await bad.readCache('deepseek')).toEqual({
      models: ['deepseek-chat', 'deepseek-reasoner'], fetchedAt: 1000
    });
  });

  test('network failure rejects with ModelListFetchError and keeps prior cache intact', async () => {
    const store = memoryStore();
    const url = 'https://api.deepseek.com/models';
    const good = createModelCatalog({
      fetchImpl: routedFetch({ [url]: { status: 200, body: DEEPSEEK_RESPONSE } }),
      cacheStore: store, now: () => 1000
    });
    await good.fetchModels('deepseek', { apiKey: 'sk-ok', baseURL: 'https://api.deepseek.com' });

    const offline = createModelCatalog({
      fetchImpl: routedFetch({ [url]: new TypeError('Failed to fetch') }),
      cacheStore: store, now: () => 2000
    });
    const err = await offline.fetchModels('deepseek', { apiKey: 'sk-ok', baseURL: 'https://api.deepseek.com' })
      .then(() => null, (e) => e);
    expect(err?.name).toBe('ModelListFetchError');
    expect(await offline.readCache('deepseek')).toEqual({
      models: ['deepseek-chat', 'deepseek-reasoner'], fetchedAt: 1000
    });
  });

  test('gemini: follows nextPageToken and aggregates all pages', async () => {
    const base = 'https://generativelanguage.googleapis.com/v1beta/models?key=g-key&pageSize=1000';
    const catalog = createModelCatalog({
      fetchImpl: routedFetch({
        [base]: {
          status: 200,
          body: {
            models: [{ name: 'models/gemini-2.0-flash', supportedGenerationMethods: ['generateContent'] }],
            nextPageToken: 'tok123'
          }
        },
        [`${base}&pageToken=tok123`]: {
          status: 200,
          body: {
            models: [{ name: 'models/gemini-2.5-pro', supportedGenerationMethods: ['generateContent'] }]
          }
        }
      }),
      cacheStore: memoryStore(), now: () => 42
    });
    expect(await catalog.fetchModels('gemini', { apiKey: 'g-key' })).toEqual({
      models: ['gemini-2.0-flash', 'gemini-2.5-pro'],
      fetchedAt: 42
    });
  });

  test('HTTP 500 rejects with ModelListFetchError', async () => {
    const catalog = createModelCatalog({
      fetchImpl: routedFetch({
        'https://api.deepseek.com/models': { status: 500, body: { error: 'server exploded' } }
      }),
      cacheStore: memoryStore(), now: () => 0
    });
    const err = await catalog.fetchModels('deepseek', { apiKey: 'sk', baseURL: 'https://api.deepseek.com' })
      .then(() => null, (e) => e);
    expect(err?.name).toBe('ModelListFetchError');
  });

  test('a hung request rejects with ModelListFetchError after the timeout', async () => {
    const hangingFetch = (url, options) => new Promise((resolve, reject) => {
      // behaves like real fetch: rejects when the passed signal aborts
      options?.signal?.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')));
    });
    const catalog = createModelCatalog({
      fetchImpl: withTimeout(hangingFetch, 50),
      cacheStore: memoryStore(), now: () => 0
    });
    const err = await catalog.fetchModels('deepseek', { apiKey: 'sk', baseURL: 'https://api.deepseek.com' })
      .then(() => null, (e) => e);
    expect(err?.name).toBe('ModelListFetchError');
  });

  test('HTTP 200 with a non-JSON body rejects with ModelListFetchError', async () => {
    const catalog = createModelCatalog({
      fetchImpl: async () => ({
        ok: true, status: 200,
        json: async () => { throw new SyntaxError('Unexpected token < in JSON'); }
      }),
      cacheStore: memoryStore(), now: () => 0
    });
    const err = await catalog.fetchModels('deepseek', { apiKey: 'sk', baseURL: 'https://api.deepseek.com' })
      .then(() => null, (e) => e);
    expect(err?.name).toBe('ModelListFetchError');
  });
});
