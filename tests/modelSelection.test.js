/**
 * Model selection storage + resolution chain.
 * Coverage source: docs/specs/llm-model-selection.md「失败模式与边界」#8, #10, #16, #18.
 */
import { describe, test, expect } from 'vitest';
import { resolveModel, sanitizeModelInput, createSelectionStore } from '../src/api/modelSelection.js';

describe('resolveModel — three-level fallback chain', () => {
  test('chat: explicit selection wins, otherwise provider fallback', () => {
    expect(resolveModel('chat', { chat: 'deepseek-reasoner', vision: null }, 'deepseek-chat'))
      .toBe('deepseek-reasoner');
    expect(resolveModel('chat', { chat: null, vision: null }, 'deepseek-chat'))
      .toBe('deepseek-chat');
    expect(resolveModel('chat', null, 'gemini-2.0-flash'))
      .toBe('gemini-2.0-flash');
  });

  test('vision: vision selection → chat selection → provider fallback', () => {
    expect(resolveModel('vision', { chat: 'gpt-4o-mini', vision: 'gpt-4o' }, 'gpt-4o'))
      .toBe('gpt-4o');
    expect(resolveModel('vision', { chat: 'gpt-4o-mini', vision: null }, 'gpt-4o'))
      .toBe('gpt-4o-mini');
    expect(resolveModel('vision', { chat: null, vision: null }, 'gpt-4o'))
      .toBe('gpt-4o');
    expect(resolveModel('vision', null, 'gpt-4o'))
      .toBe('gpt-4o');
  });
});

describe('sanitizeModelInput', () => {
  test('trims whitespace; empty and whitespace-only become null', () => {
    expect(sanitizeModelInput('  gpt-4o  ')).toBe('gpt-4o');
    expect(sanitizeModelInput('deepseek-reasoner')).toBe('deepseek-reasoner');
    expect(sanitizeModelInput('')).toBeNull();
    expect(sanitizeModelInput('   ')).toBeNull();
    expect(sanitizeModelInput(null)).toBeNull();
    expect(sanitizeModelInput(undefined)).toBeNull();
  });
});

const memoryStore = () => {
  const map = new Map();
  return {
    read: async (key) => (map.has(key) ? map.get(key) : null),
    write: async (key, value) => { map.set(key, value); }
  };
};

describe('createSelectionStore', () => {
  test('selections round-trip per provider and survive a fresh store instance', async () => {
    const backing = memoryStore();
    const store = createSelectionStore({ store: backing });
    await store.setSelections('deepseek', { chat: 'deepseek-reasoner', vision: null });
    await store.setSelections('openai', { chat: 'gpt-4o', vision: 'gpt-4o' });

    expect(await store.getSelections('deepseek')).toEqual({ chat: 'deepseek-reasoner', vision: null });

    const fresh = createSelectionStore({ store: backing });
    expect(await fresh.getSelections('openai')).toEqual({ chat: 'gpt-4o', vision: 'gpt-4o' });
  });

  test('unset provider reads as null selections (existing behavior preserved)', async () => {
    const store = createSelectionStore({ store: memoryStore() });
    expect(await store.getSelections('gemini')).toEqual({ chat: null, vision: null });
  });
});
