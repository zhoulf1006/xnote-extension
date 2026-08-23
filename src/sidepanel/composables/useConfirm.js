/**
 * App-wide confirmation, replacing window.confirm().
 *
 * Chrome suppresses native dialogs in extension side panels: confirm() returns
 * false immediately without showing anything, so every `if (!confirm(...))`
 * silently aborted. Callers await confirmAction() instead; a single
 * ConfirmDialog instance hosted in App.vue resolves the promise.
 */
import { ref } from 'vue';

const pending = ref(null); // { message, confirmLabel, resolve }

/**
 * Ask the user to confirm an action.
 * @param {string} message - Question shown in the dialog
 * @param {string} [confirmLabel] - Label of the confirming button
 * @returns {Promise<boolean>} true when confirmed, false when cancelled
 */
export function confirmAction(message, confirmLabel = 'Delete') {
  return new Promise((resolve) => {
    // A new request while one is open cancels the previous, so no caller hangs
    if (pending.value) pending.value.resolve(false);
    pending.value = { message, confirmLabel, resolve };
  });
}

/** For the single dialog host (App.vue). */
export function useConfirmHost() {
  const settle = (answer) => {
    const current = pending.value;
    pending.value = null;
    current?.resolve(answer);
  };
  return {
    pending,
    accept: () => settle(true),
    cancel: () => settle(false)
  };
}
