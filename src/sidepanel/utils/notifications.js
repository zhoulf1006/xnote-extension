/**
 * Notification utility — routes to the in-app toast layer.
 *
 * Previously this only reached the user for 'error' (via alert(), which Chrome
 * suppresses in extension side panels); everything else went to the console
 * alone. All severities are now visible.
 */
import { notify } from '../composables/useToast';

export function showNotification(message, type = 'info') {
  switch (type) {
    case 'error':
      console.error('[Notification]', message);
      notify.error(message);
      break;
    case 'warning':
      console.warn('[Notification]', message);
      notify.warning(message);
      break;
    case 'success':
      console.log('[Notification]', message);
      notify.success(message);
      break;
    case 'info':
    default:
      console.info('[Notification]', message);
      notify.info(message);
      break;
  }
}
