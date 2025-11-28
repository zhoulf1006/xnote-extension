<template>
  <div class="sync-status">
    <!-- Pending items badge -->
    <div v-if="pendingCount > 0" class="pending-badge" :title="`${pendingCount} new items available`">
      {{ pendingCount > 99 ? '99+' : pendingCount }}
    </div>

    <!-- Sync button -->
    <button
      class="sync-btn"
      :class="{ 'has-pending': pendingCount > 0 }"
      @click="$emit('sync')"
      :disabled="isSyncing"
      :title="pendingCount > 0 ? `Sync ${pendingCount} new items` : 'Sync now'"
    >
      <i class="fas fa-sync-alt"></i>
    </button>
  </div>
</template>

<script setup>
defineProps({
  isSyncing: {
    type: Boolean,
    default: false
  },
  pendingCount: {
    type: Number,
    default: 0
  }
});

defineEmits(['sync']);
</script>

<style scoped>
.sync-status {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Pending badge */
.pending-badge {
  background: #dc3545;
  color: white;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 10px;
  min-width: 18px;
  text-align: center;
}

/* Sync button */
.sync-btn {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: rgba(103, 58, 183, 0.1);
  color: #673ab7;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.sync-btn:hover:not(:disabled) {
  background: rgba(103, 58, 183, 0.2);
}

.sync-btn.has-pending {
  background: #673ab7;
  color: white;
  animation: pulse 2s infinite;
}

.sync-btn.has-pending:hover:not(:disabled) {
  background: #5e35b1;
}

.sync-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.sync-btn i {
  font-size: 12px;
}

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(103, 58, 183, 0.4);
  }
  70% {
    box-shadow: 0 0 0 6px rgba(103, 58, 183, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(103, 58, 183, 0);
  }
}
</style>
