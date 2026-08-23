<template>
  <div v-if="show" class="cd-overlay">
    <div class="cd-box">
      <p class="cd-message">{{ message }}</p>
      <div class="cd-actions">
        <button type="button" class="cd-cancel" @click="$emit('cancel')">Cancel</button>
        <button type="button" class="cd-confirm" @click="$emit('confirm')">{{ confirmLabel }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
// In-app replacement for window.confirm(): Chrome suppresses native dialogs in
// extension side panels (confirm() returns false without showing anything).
defineProps({
  show: { type: Boolean, default: false },
  message: { type: String, default: '' },
  confirmLabel: { type: String, default: 'Delete' }
});
defineEmits(['confirm', 'cancel']);
</script>

<style scoped>
.cd-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1100;
  backdrop-filter: blur(4px);
}

.cd-box {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  width: 320px;
  max-width: 90vw;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.cd-message {
  font-size: 14px;
  color: #333;
  line-height: 1.5;
  margin: 0 0 16px;
  overflow-wrap: anywhere;
}

.cd-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.cd-actions button {
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  border: 1px solid #dee2e6;
}

.cd-cancel {
  background: #fff;
  color: #495057;
}

.cd-cancel:hover {
  background: #f8f9fa;
}

.cd-confirm {
  background: #ffeaea;
  color: #d63384;
  border-color: transparent;
}

.cd-confirm:hover {
  background: #ffcccb;
}
</style>
