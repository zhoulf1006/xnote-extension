/**
 * Storage readiness — one shared run of the sync→local mapping migration.
 *
 * The migration relocates the mapping keys into local storage, and stores read
 * those keys from local. The startup sequence orders its own steps after the
 * migration (see startupSteps.js), but Vue mounts child components before the
 * parent's onMounted runs, so a component-triggered read can arrive before the
 * sequence has even started. Ordering by "who mounts when" is exactly what cannot
 * be relied on.
 *
 * So the ordering is owned here instead: the migration is a single-flight run that
 * the first asker starts and every later asker joins. Startup asks; readers ask;
 * whichever got there first, a reader's await resolves only after the keys are
 * where it is about to look.
 *
 * The run is memoized for the life of the page. A run that failed is not retried
 * within the session — that matches the pre-existing behaviour of one attempt per
 * panel open, with the marker gate making the next open's attempt cheap. Callers
 * that must surface the failure await ensure() directly (the startup prerequisite
 * does); readers catch it and read anyway, since the data may well be in place
 * even when the run as a whole reported failure.
 */
import { migrateSyncToLocalStorage } from './storageService';

export function createStorageReadiness(migrate = migrateSyncToLocalStorage) {
  let run = null;
  return {
    /**
     * Start the migration if nobody has, and return the shared run.
     * @param {Object} [backend] - storage backend, injectable for tests
     * @returns {Promise<void>} settles when the migration run settles
     */
    ensure(backend) {
      if (!run) {
        run = migrate(backend);
      }
      return run;
    }
  };
}

/** The app-wide instance: startup and every mapping reader share this run. */
export const storageReadiness = createStorageReadiness();
