<template>
  <div class="translation-input">
    <div class="input-container">
      <textarea
        v-model="inputValue"
        :disabled="isStreaming"
        placeholder="Enter text to translate..."
        @keydown.enter.prevent="handleTranslate"
      ></textarea>
    </div>
    <div class="button-container">
      <button @click="handleTranslate" :disabled="!inputValue.trim() || isStreaming">
        <i class="fas fa-language"></i>
        Translate
      </button>
      <button @click="clearText" :disabled="!inputValue.trim()">
        <i class="fas fa-times"></i>
        Clear
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  isStreaming: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update:modelValue', 'translate']);

const inputValue = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
});

const handleTranslate = () => {
  if (!inputValue.value.trim() || props.isStreaming) return;
  emit('translate', inputValue.value);
};

const clearText = () => {
  emit('update:modelValue', '');
};
</script>

<style scoped>
.translation-input {
  display: flex;
  flex-direction: column;
  min-height: 120px;
  gap: 8px;
}

.input-container {
  display: flex;
  flex-direction: column;
  flex: 1;
  background: #ffffff;
  border-radius: 4px;
  border: 1px solid #dee2e6;
}

textarea {
  width: 100%;
  height: auto;
  min-height: 80px;
  padding: 8px;
  border: none;
  resize: none;
  font-family: inherit;
  font-size: 13px;
  line-height: 1.4;
  box-sizing: border-box;
}

textarea:focus {
  outline: none;
}

.button-container {
  display: flex;
  gap: 8px;
}

button {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  background: #ffffff;
  color: #495057;
  cursor: pointer;
  font-size: 13px;
}

button:hover:not(:disabled) {
  background: #f8f9fa;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

button i {
  font-size: 11px;
}
</style>
