<template>
  <div v-if="request" class="cp-overlay">
    <div class="cp-box">
      <h3>Save to Quick Links</h3>
      <div class="cp-page">
        <i class="fas fa-link"></i>
        <span class="cp-title">{{ request.pageTitle }}</span>
      </div>

      <div class="cp-list">
        <div v-for="(category, index) in request.categories"
             :key="category.name"
             class="cp-opt"
             :class="{ selected: index === selectedIndex }"
             @click="selectedIndex = index">
          <i class="fas fa-folder"></i>
          <span class="cp-name">{{ category.name }}</span>
          <span class="cp-count">{{ category.links?.length || 0 }}</span>
        </div>
      </div>

      <div class="cp-actions">
        <button type="button" class="cp-cancel" @click="cancel">Cancel</button>
        <button type="button"
                class="cp-save"
                :disabled="selectedIndex === null"
                @click="save">Save</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useCategoryPickerHost } from '../../composables/useCategoryPicker';

const { request, resolve } = useCategoryPickerHost();
const selectedIndex = ref(null);

watch(request, () => { selectedIndex.value = null; });

const save = () => resolve(request.value.categories[selectedIndex.value].name);
const cancel = () => resolve(null);
</script>

<style scoped>
.cp-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1100;
}

.cp-box {
  background: #fff;
  border-radius: 8px;
  width: calc(100% - 40px);
  max-width: 340px;
  max-height: calc(100% - 60px);
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.cp-box h3 {
  margin: 0;
  padding: 14px 16px 10px;
  font-size: 14px;
  color: #333;
}

.cp-page {
  padding: 0 16px 10px;
  font-size: 12px;
  color: #888;
  display: flex;
  align-items: center;
  gap: 6px;
}

.cp-page i { font-size: 11px; }

.cp-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #555;
}

.cp-list {
  padding: 4px 8px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px; /* keeps adjacent tinted rows from reading as one block */
}

.cp-opt {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 10px;
  border-radius: 4px;
  font-size: 13px;
  color: #333;
  cursor: pointer;
}

.cp-opt i {
  color: #673ab7;
  font-size: 12px;
}

.cp-name {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}

.cp-count {
  margin-left: auto;
  font-size: 11px;
  color: #999;
}

.cp-opt:hover { background: rgba(103, 58, 183, 0.07); }
/* Selected is a shade deeper than hover and declared after it, so it wins on hover */
.cp-opt.selected { background: rgba(103, 58, 183, 0.16); }

.cp-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid #eee;
}

.cp-actions button {
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  border: 1px solid #dee2e6;
}

.cp-cancel {
  background: #fff;
  color: #495057;
}

.cp-cancel:hover { background: #f8f9fa; }

.cp-save {
  background: #ba92ff;
  border-color: #ba92ff;
  color: #fff;
}

.cp-save:hover:not(:disabled) { background: #a36dff; }

.cp-save:disabled {
  opacity: 0.5;
  cursor: default;
}
</style>
