/**
 * The panel's startup sequence.
 *
 * Until this seam existed the steps ran inline in `onMounted`, so nothing about
 * their ordering could be observed: a claim like "startup continues past a hung
 * Drive init" could only be checked by watching a real panel start. These cases
 * drive the sequence with fakes instead.
 *
 * Ordering is asserted through deferred promises rather than timers. A test that
 * proves concurrency with `setTimeout` proves only that one delay is shorter than
 * another, and it goes green on sequential code whenever the machine is fast
 * enough — the exact failure mode these cases exist to catch.
 */
import { describe, test, expect } from 'vitest';
import { runStartupSequence } from '../src/sidepanel/startupSequence.js';

/** A promise whose settlement this test controls. */
function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

/** Records the order in which steps start and finish. */
function recorder() {
  const events = [];
  return {
    events,
    step: (name, body = async () => {}) => ({
      name,
      run: async (value) => {
        events.push(`${name}:start`);
        const result = await body(value);
        events.push(`${name}:end`);
        return result;
      }
    })
  };
}

describe('the prerequisite gates everything that depends on it', () => {
  test('no dependent starts until the prerequisite has finished', async () => {
    const r = recorder();
    const gate = deferred();

    const running = runStartupSequence({
      prerequisite: r.step('prereq', () => gate.promise),
      dependents: [r.step('a'), r.step('b')]
    });

    // The prerequisite is still in flight, so nothing downstream may have begun
    await Promise.resolve();
    expect(r.events).toEqual(['prereq:start']);

    gate.resolve();
    await running;

    expect(r.events.indexOf('prereq:end')).toBeLessThan(r.events.indexOf('a:start'));
    expect(r.events.indexOf('prereq:end')).toBeLessThan(r.events.indexOf('b:start'));
  });

  test('dependents receive the value the prerequisite resolved with', async () => {
    const seen = [];
    await runStartupSequence({
      prerequisite: { name: 'prereq', run: async () => ({ storageType: 'chrome.storage.sync' }) },
      dependents: [
        { name: 'a', run: async (value) => { seen.push(value); } },
        { name: 'b', run: async (value) => { seen.push(value); } }
      ]
    });

    expect(seen).toEqual([
      { storageType: 'chrome.storage.sync' },
      { storageType: 'chrome.storage.sync' }
    ]);
  });

  test('a rejecting prerequisite propagates, because nothing downstream can run', async () => {
    const r = recorder();

    await expect(runStartupSequence({
      prerequisite: { name: 'prereq', run: async () => { throw new Error('storage unavailable'); } },
      dependents: [r.step('a')]
    })).rejects.toThrow('storage unavailable');

    expect(r.events).toEqual([]);
  });
});

describe('independent steps are not serialised', () => {
  test('a dependent starts while an earlier one is still unfinished', async () => {
    const r = recorder();
    const slow = deferred();

    const running = runStartupSequence({
      prerequisite: r.step('prereq'),
      dependents: [r.step('slow', () => slow.promise), r.step('fast')]
    });

    // 'fast' must have run to completion while 'slow' is still pending. Under
    // sequential execution 'fast' could not have started at all.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(r.events).toContain('fast:end');
    expect(r.events).not.toContain('slow:end');

    slow.resolve();
    await running;
  });
});

describe('one failing step does not take the others down', () => {
  test('the others still complete and the failure is reported', async () => {
    const r = recorder();

    const { failures } = await runStartupSequence({
      prerequisite: r.step('prereq'),
      dependents: [
        { name: 'broken', run: async () => { throw new Error('migration failed'); } },
        r.step('healthy')
      ]
    });

    expect(r.events).toContain('healthy:end');
    expect(failures).toHaveLength(1);
    expect(failures[0].name).toBe('broken');
    expect(failures[0].error.message).toBe('migration failed');
  });

  test('a clean run reports no failures', async () => {
    const r = recorder();
    const { failures } = await runStartupSequence({
      prerequisite: r.step('prereq'),
      dependents: [r.step('a'), r.step('b')]
    });
    expect(failures).toEqual([]);
  });
});

describe('background steps never hold up startup', () => {
  // This is #17's outstanding criterion, retro-fitted now that there is a seam to
  // drive. The Drive tests on main assert the *store's* behaviour under a hang;
  // this asserts what that criterion actually claims — the rest of startup finishes.
  test('startup completes while a background step hangs forever', async () => {
    const r = recorder();
    const neverSettles = new Promise(() => {});

    const { failures } = await runStartupSequence({
      prerequisite: r.step('prereq'),
      dependents: [r.step('a')],
      background: [{ name: 'drive', run: () => neverSettles }]
    });

    // Reaching here at all is the assertion: an awaited background step would
    // have hung this test until the runner timed it out.
    expect(r.events).toContain('a:end');
    expect(failures).toEqual([]);
  });

  test('a background step that rejects is reported, not thrown into the sequence', async () => {
    const r = recorder();
    const reported = [];

    const { failures } = await runStartupSequence({
      prerequisite: r.step('prereq'),
      dependents: [r.step('a')],
      background: [{ name: 'drive', run: async () => { throw new Error('drive offline'); } }],
      onStepError: (name, error) => reported.push(`${name}: ${error.message}`)
    });

    // Let the detached rejection settle before asserting on it
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(r.events).toContain('a:end');
    expect(failures).toEqual([]);
    expect(reported).toEqual(['drive: drive offline']);
  });

  test('background steps start once the prerequisite is done, not before', async () => {
    const r = recorder();
    const gate = deferred();

    const running = runStartupSequence({
      prerequisite: r.step('prereq', () => gate.promise),
      background: [r.step('drive')]
    });

    await Promise.resolve();
    expect(r.events).toEqual(['prereq:start']);

    gate.resolve();
    await running;
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(r.events).toContain('drive:start');
  });
});
