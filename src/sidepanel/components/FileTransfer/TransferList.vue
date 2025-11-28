<template>
  <div class="transfer-list">
    <!-- Empty state -->
    <div v-if="items.length === 0" class="empty-state">
      <div class="empty-icon">
        <i class="fas fa-folder-open"></i>
      </div>
      <h3>No files yet</h3>
      <p>Upload a file to sync it across all your devices. Max file size is 25MB.</p>
    </div>

    <!-- Items list -->
    <div v-else class="items-container">
      <TransferItem
        v-for="item in items"
        :key="item.id"
        :item="item"
        :is-own-device="item.deviceId === deviceId"
        @download="$emit('download', item)"
        @delete="$emit('delete', item)"
        @copy="$emit('copy', item)"
      />
    </div>
  </div>
</template>

<script setup>
import TransferItem from './TransferItem.vue';

defineProps({
  items: {
    type: Array,
    required: true
  },
  deviceId: {
    type: String,
    default: null
  }
});

defineEmits(['download', 'delete', 'copy']);
</script>

<style scoped>
.transfer-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

/* Empty state */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
  padding: 40px 20px;
  color: #6c757d;
}

.empty-icon {
  width: 64px;
  height: 64px;
  background: rgba(103, 58, 183, 0.1);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}

.empty-icon i {
  font-size: 28px;
  color: #673ab7;
}

.empty-state h3 {
  margin: 0 0 8px 0;
  font-size: 16px;
  color: #495057;
}

.empty-state p {
  margin: 0;
  font-size: 13px;
  max-width: 260px;
  line-height: 1.5;
}

/* Items container */
.items-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
