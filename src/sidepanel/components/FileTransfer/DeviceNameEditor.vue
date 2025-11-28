<template>
  <div class="device-name-editor">
    <!-- Display mode -->
    <div v-if="!isEditing" class="display-mode" @click="startEditing">
      <span class="device-label">{{ deviceName || 'Set device name' }}</span>
      <i class="fas fa-pen edit-icon"></i>
    </div>

    <!-- Edit mode -->
    <div v-else class="edit-mode">
      <input
        ref="inputRef"
        v-model="editValue"
        type="text"
        maxlength="20"
        placeholder="Device name"
        @keydown.enter="save"
        @keydown.escape="cancel"
        @blur="save"
      />
      <button class="save-btn" @click="save" title="Save">
        <i class="fas fa-check"></i>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick } from 'vue';

const props = defineProps({
  deviceName: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['update']);

const isEditing = ref(false);
const editValue = ref('');
const inputRef = ref(null);

const startEditing = async () => {
  editValue.value = props.deviceName || '';
  isEditing.value = true;
  await nextTick();
  inputRef.value?.focus();
  inputRef.value?.select();
};

const save = () => {
  const newName = editValue.value.trim();
  if (newName && newName !== props.deviceName) {
    emit('update', newName);
  }
  isEditing.value = false;
};

const cancel = () => {
  isEditing.value = false;
};
</script>

<style scoped>
.device-name-editor {
  display: inline-flex;
  align-items: center;
}

/* Display mode */
.display-mode {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}

.display-mode:hover {
  background: rgba(103, 58, 183, 0.1);
}

.device-label {
  font-size: 12px;
  color: #6c757d;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.edit-icon {
  font-size: 10px;
  color: #adb5bd;
  transition: color 0.2s;
}

.display-mode:hover .edit-icon {
  color: #673ab7;
}

/* Edit mode */
.edit-mode {
  display: flex;
  align-items: center;
  gap: 4px;
}

.edit-mode input {
  width: 120px;
  padding: 4px 8px;
  border: 1px solid #673ab7;
  border-radius: 4px;
  font-size: 12px;
  outline: none;
}

.save-btn {
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  background: #673ab7;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.save-btn:hover {
  background: #5e35b1;
}

.save-btn i {
  font-size: 10px;
}
</style>
