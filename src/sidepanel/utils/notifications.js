/**
 * Simple notification utility for consistent user feedback
 * Can be replaced with a toast library in the future
 */

export function showNotification(message, type = 'info') {
  // For now, use console and alert for critical messages
  // This can be replaced with a proper toast/notification system later

  switch(type) {
    case 'error':
      console.error('[Notification]', message);
      // Only alert for errors to avoid being too intrusive
      alert(`Error: ${message}`);
      break;
    case 'warning':
      console.warn('[Notification]', message);
      break;
    case 'success':
      console.log('[Notification]', message);
      break;
    case 'info':
    default:
      console.info('[Notification]', message);
      break;
  }

  // TODO: In the future, integrate with a proper notification system
  // For example: Vue Toastification, Element Plus notifications, etc.
}