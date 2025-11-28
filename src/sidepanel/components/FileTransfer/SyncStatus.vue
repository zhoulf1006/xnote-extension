<template>
  <div class="sync-status">
    <!-- Syncing/Checking indicator -->
    <div v-if="isSyncing || isChecking" class="status-indicator syncing">
      <i class="fas fa-sync-alt fa-spin"></i>
      <span>{{ isSyncing ? 'Syncing...' : 'Checking...' }}</span>
    </div>

    <!-- Timeout state - show on timestamp area -->
    <div v-else-if="isTimeout" class="status-indicator timeout" title="Connection timeout - click sync to retry">
      <i class="fas fa-clock"></i>
      <span>Connection timeout</span>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="status-indicator error" :title="error">
      <i class="fas fa-exclamation-circle"></i>
      <span>Sync error</span>
    </div>

    <!-- Normal state with pending badge -->
    <div v-else class="status-indicator">
      <!-- Pending items badge -->
      <div v-if="pendingCount > 0" class="pending-badge" :title="`${pendingCount} new items available`">
        {{ pendingCount > 99 ? '99+' : pendingCount }}
      </div>

      <!-- Last sync time -->
      <span v-if="lastSyncTime" class="last-sync" :title="formatFullTime(lastSyncTime)">
        {{ formatRelativeTime(lastSyncTime) }}
      </span>
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
  isChecking: {
    type: Boolean,
    default: false
  },
  pendingCount: {
    type: Number,
    default: 0
  },
  lastSyncTime: {
    type: String,
    default: null
  },
  error: {
    type: String,
    default: null
  },
  isTimeout: {
    type: Boolean,
    default: false
  }
});

defineEmits(['sync']);

const formatRelativeTime = (timestamp) => {
  if (!timestamp) return '';

  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatFullTime = (timestamp) => {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleString();
};
</script>

<style scoped>
.sync-status {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #6c757d;
}

.status-indicator.syncing {
  color: #673ab7;
}

.status-indicator.syncing i {
  font-size: 11px;
}

.status-indicator.error {
  color: #dc3545;
}

.status-indicator.timeout {
  color: #fd7e14;
}

.status-indicator.timeout i {
  font-size: 11px;
}

.last-sync {
  color: #adb5bd;
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
