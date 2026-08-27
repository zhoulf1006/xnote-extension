/**
 * Which startup step plays which role.
 *
 * Kept apart from `runStartupSequence`, which is the machinery and knows nothing
 * about this app. This is the part with the judgement in it — and judgement about
 * ordering is exactly what a running panel cannot be asked to check, so the
 * dependencies are injected and the assignment is testable.
 *
 * @param {Object} deps - everything the steps touch, injected so they can be faked
 */
export function buildStartupSteps({
  initializeStorage,
  migrateMappings,
  secureStorage,
  checkStorage,
  initializeDrive,
  log = console.log,
  warn = console.warn
}) {
  return {
    prerequisite: {
      name: 'storage',
      run: async () => {
        log('Initializing storage service...');
        const status = await initializeStorage();
        log('Storage initialization completed:', status);

        // Part of storage readiness rather than a step of its own, because it does
        // not merely tidy up: it relocates keys from sync to local storage, and the
        // Drive and Summary stores read those keys from local. A step that starts
        // before this finishes reads an empty result — and only on the single
        // startup where the move actually happens, so the window is both real and
        // easy to never see again.
        await migrateMappings();
        log('✅ Storage migration check completed');

        return status;
      }
    },

    // None of these needs the others; they only need storage to be ready.
    dependents: [
      {
        name: 'encryption-migration',
        run: async () => {
          if (!secureStorage.encryptionEnabled) return;
          log('🔐 Encryption available, checking for migration needs...');
          await secureStorage.migrateToEncrypted();
        }
      },
      {
        name: 'storage-diagnostics',
        run: async () => {
          const status = await checkStorage();
          log('Storage status check completed:', status);
        }
      }
    ],

    // Never awaited: the panel is fully usable before Drive status is known, and
    // this can make network calls. The nav indicator shows how it settles.
    background: [
      {
        name: 'google-drive',
        run: async () => {
          const ok = await initializeDrive();
          log(ok ? '✅ Google Drive store initialized' : 'ℹ️ Google Drive not initialized');
        }
      }
    ],

    onStepError: (name, error) => warn(`❌ Startup step "${name}" failed:`, error)
  };
}
