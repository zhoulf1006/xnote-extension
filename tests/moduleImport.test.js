/**
 * Every module that exports an eagerly constructed singleton must be importable
 * without a browser present.
 *
 * A constructor that reads browser-only globals runs at import time, which makes
 * the module — and everything that transitively imports it — unloadable outside a
 * browser. That is what left the whole startup path untestable until recently, and
 * the failure is silent: it looks like an unrelated resolution error.
 *
 * The module list is enumerated reproducibly, not from memory:
 *   grep -rnE "^(export default new |(export )?const [A-Za-z_]+ = new )" src --include=*.js
 * A newly added singleton that is not listed here is a gap in this file, not proof
 * that none exists.
 */
import { describe, test, expect, beforeEach } from 'vitest';

const SINGLETON_MODULES = [
  ['encryptionService', () => import('../src/api/encryptionService.js')],
  ['storageService (secureStorageService)', () => import('../src/api/storageService.js')],
  ['linksService', () => import('../src/api/linksService.js')],
  ['googleDriveService', () => import('../src/api/googleDriveService.js')],
  ['googleFolderBrowserService', () => import('../src/api/googleFolderBrowserService.js')],
  ['transferService', () => import('../src/api/transferService.js')],
  ['llm (llmService)', () => import('../src/api/llm.js')],
  ['quickLinksService', () => import('../src/sidepanel/components/QuickLinks/quickLinksService.js')]
];

describe('singleton modules import without a browser', () => {
  beforeEach(() => {
    // The whole point: none of these may be present while importing
    expect(globalThis.chrome).toBeUndefined();
    expect(globalThis.screen).toBeUndefined();
    expect(globalThis.localStorage).toBeUndefined();
  });

  for (const [name, load] of SINGLETON_MODULES) {
    test(`${name} loads with no browser globals present`, async () => {
      const module = await load();
      expect(module).toBeTruthy();
    });
  }
});
