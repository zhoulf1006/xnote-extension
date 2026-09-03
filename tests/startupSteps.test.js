/**
 * How the panel's startup steps are assigned to roles.
 *
 * The roles are not interchangeable, and getting one wrong is invisible in a unit
 * test of the sequence itself: `runStartupSequence` will faithfully run whatever
 * it is handed. The assignment is therefore built somewhere a test can reach,
 * rather than written inline at the call site where only a running panel could
 * check it.
 *
 * The case that matters most: the mapping migration relocates keys from sync to
 * local storage, and other components read those keys from local. Anything that
 * starts before it finishes can read an empty result — on exactly the one startup
 * where the move actually happens, which is the startup nobody re-tests.
 *
 * Known gap, stated rather than papered over: these drive the step assignment with
 * fakes, so they prove the roles are right but not that App.vue hands the real
 * functions to the right roles. Passing the wrong function at that call site would
 * not turn anything here red. Closing it needs the panel actually started, which is
 * the closeout ticket's extension-mode run.
 */
import { describe, test, expect } from 'vitest';
import { runStartupSequence } from '../src/sidepanel/startupSequence.js';
import { buildStartupSteps } from '../src/sidepanel/startupSteps.js';

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Fakes for every dependency, with an order log shared between them. */
function fakes(overrides = {}) {
  const order = [];
  const state = { mappingsMigrated: false };
  const deps = {
    initializeStorage: async () => {
      order.push('storage-init');
      return { storageType: 'chrome.storage.sync', isExtensionURL: true, extensionMode: true };
    },
    migrateMappings: async () => {
      // A turn of latency, so an incorrectly-ordered consumer really can observe
      // the pre-migration state rather than being saved by timing.
      await tick();
      state.mappingsMigrated = true;
      order.push('mapping-migration');
    },
    secureStorage: { encryptionEnabled: false, migrateToEncrypted: async () => { order.push('encryption-migration'); } },
    checkStorage: async () => { order.push('diagnostics'); return {}; },
    initializeDrive: async () => {
      order.push(`drive(sawMigratedMappings=${state.mappingsMigrated})`);
      return true;
    },
    log: () => {},
    warn: () => {},
    ...overrides
  };
  return { deps, order, state };
}

describe('steps that other steps depend on are not left to race', () => {
  test('Drive initialization never begins before the mapping migration has finished', async () => {
    const { deps, order } = fakes();

    await runStartupSequence(buildStartupSteps(deps));
    await tick(); await tick();

    // Drive reads the drive-location mappings from local storage; the migration is
    // what puts them there. Seeing false here is the bug, not a flake.
    expect(order).toContain('drive(sawMigratedMappings=true)');
    expect(order).not.toContain('drive(sawMigratedMappings=false)');
  });

  test('storage readiness covers the relocation, so it precedes every other step', async () => {
    const { deps, order } = fakes();

    await runStartupSequence(buildStartupSteps(deps));
    await tick(); await tick();

    const migration = order.indexOf('mapping-migration');
    expect(migration).toBeGreaterThan(-1);
    for (const later of ['diagnostics', 'drive(sawMigratedMappings=true)']) {
      expect(order.indexOf(later)).toBeGreaterThan(migration);
    }
  });
});

describe('steps that genuinely do not depend on each other still overlap', () => {
  test('diagnostics does not wait for the encryption migration', async () => {
    const started = [];
    const { deps } = fakes({
      secureStorage: {
        encryptionEnabled: true,
        migrateToEncrypted: () => { started.push('encryption'); return new Promise(() => {}); }
      },
      checkStorage: async () => { started.push('diagnostics'); return {}; }
    });

    const steps = buildStartupSteps(deps);
    // Not awaited: the encryption step never settles here on purpose
    runStartupSequence(steps);
    await tick(); await tick();

    // Both began even though the first has not finished — serial execution could
    // not have reached the second at all.
    expect(started).toContain('encryption');
    expect(started).toContain('diagnostics');
  });

  test('the encryption migration is skipped when encryption is off, without failing startup', async () => {
    const { deps, order } = fakes();

    const { failures } = await runStartupSequence(buildStartupSteps(deps));

    expect(order).not.toContain('encryption-migration');
    expect(failures).toEqual([]);
  });
});

describe('failures are contained and reported', () => {
  test('one dependent failing leaves the others done and is reported', async () => {
    const { deps, order } = fakes({
      checkStorage: async () => { throw new Error('diagnostics blew up'); }
    });

    const { failures } = await runStartupSequence(buildStartupSteps({
      ...deps,
      secureStorage: { encryptionEnabled: true, migrateToEncrypted: async () => { order.push('encryption-migration'); } }
    }));

    expect(order).toContain('encryption-migration');
    expect(failures.map((f) => f.name)).toContain('storage-diagnostics');
  });

  test('a failing prerequisite rejects, so the caller reports it as before', async () => {
    const { deps } = fakes({
      initializeStorage: async () => { throw new Error('storage unavailable'); }
    });

    await expect(runStartupSequence(buildStartupSteps(deps))).rejects.toThrow('storage unavailable');
  });
});
