/**
 * App-wide toast notifications, replacing window.alert().
 *
 * Chrome suppresses native dialogs in extension side panels, so alert() never
 * reached the user — including error messages. Callers use notify.*(); a single
 * ToastLayer hosted in App.vue renders the stack.
 *
 * Errors persist until dismissed (they must be read); success and info messages
 * auto-dismiss.
 */
import { ref } from 'vue';

const AUTO_DISMISS_MS = 4000;
const MAX_VISIBLE = 3;

const toasts = ref([]);
let nextId = 0;

function push(kind, message) {
  const text = String(message ?? '').trim();
  if (!text) return null; // nothing to show

  const id = ++nextId;
  toasts.value.push({ id, kind, message: text, persistent: kind === 'error' });

  // Oldest leaves once the stack is full, so the newest is always visible
  if (toasts.value.length > MAX_VISIBLE) toasts.value.shift();

  if (kind !== 'error') {
    setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
  }
  return id;
}

export function dismiss(id) {
  toasts.value = toasts.value.filter(t => t.id !== id);
}

export const notify = {
  success: (message) => push('success', message),
  error: (message) => push('error', message),
  info: (message) => push('info', message),
  /** Warnings share the info presentation; kept so callers can express intent. */
  warning: (message) => push('info', message)
};

/** For the single toast host (App.vue). */
export function useToastHost() {
  return { toasts, dismiss };
}

export const TOAST_AUTO_DISMISS_MS = AUTO_DISMISS_MS;
