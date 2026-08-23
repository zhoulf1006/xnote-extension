<template>
  <!-- Floats over the panel bottom: does not push content, since the side panel
       is too narrow to absorb layout shift. Sits above the config modal so that
       errors raised while a modal is open are still readable. -->
  <div class="toast-layer">
    <div v-for="toast in toasts"
         :key="toast.id"
         class="toast"
         :class="toast.kind">
      <i class="fas toast-ico" :class="iconFor(toast.kind)"></i>
      <span class="toast-msg">{{ toast.message }}</span>
      <button v-if="toast.persistent"
              type="button"
              class="toast-close"
              title="Dismiss"
              @click="dismiss(toast.id)">
        <i class="fas fa-xmark"></i>
      </button>
      <div v-else class="toast-timer"></div>
    </div>
  </div>
</template>

<script setup>
import { useToastHost } from '../../composables/useToast';

const { toasts, dismiss } = useToastHost();

const iconFor = (kind) => ({
  success: 'fa-circle-check',
  error: 'fa-triangle-exclamation',
  info: 'fa-circle-info'
}[kind] || 'fa-circle-info');
</script>

<style scoped>
.toast-layer {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 0 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 1200; /* above the config modal (1000) and confirm dialog (1100) */
  pointer-events: none; /* empty space stays click-through */
}

.toast {
  position: relative;
  overflow: hidden;
  pointer-events: auto;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 10px 10px 12px;
  border-radius: 6px;
  font-size: 12.5px;
  line-height: 1.45;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.16);
  border: 1px solid transparent;
  animation: toast-in 0.18s ease-out;
}

@keyframes toast-in {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: none; }
}

.toast-ico {
  flex: none;
  margin-top: 2px;
  font-size: 12px;
}

.toast-msg {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}

.toast-close {
  flex: none;
  width: 20px;
  height: 20px;
  display: grid;
  place-items: center;
  border: none;
  background: transparent;
  color: currentColor;
  opacity: 0.55;
  border-radius: 4px;
  cursor: pointer;
  padding: 0;
  font-size: 11px;
}

.toast-close:hover {
  opacity: 1;
  background: rgba(0, 0, 0, 0.07);
}

/* Same semantic colours as the config modal's state notes */
.toast.success {
  background: #e8f5e8;
  color: #2e7d32;
  border-color: #c8e6c9;
}

.toast.error {
  background: #ffeaea;
  color: #c62828;
  border-color: #ffcdd2;
}

.toast.info {
  background: #f0f8ff;
  color: #1565c0;
  border-color: #cfe5fb;
}

/* Countdown for auto-dismissing toasts; errors have a close button instead */
.toast-timer {
  position: absolute;
  left: 0;
  bottom: 0;
  height: 2px;
  background: currentColor;
  opacity: 0.35;
  animation: toast-timer 4s linear forwards;
}

@keyframes toast-timer {
  from { width: 100%; }
  to { width: 0%; }
}
</style>
