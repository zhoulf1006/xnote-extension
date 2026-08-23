<template>
  <div ref="root" class="ms-combo">
    <button type="button" class="ms-btn" :class="{ open }" :disabled="disabled" @click="toggle">
      <span class="ms-val" :class="{ 'ms-placeholder': !modelValue && !nullLabel, 'ms-null': !modelValue && nullLabel }">
        {{ displayText }}
      </span>
      <i class="fas fa-chevron-down ms-chev"></i>
    </button>

    <!-- List expands in flow (pushes content down): the modal is a scroll
         container, so a floating overlay would be clipped by its bounds -->
    <div v-if="open" class="ms-dd">
      <div v-if="nullLabel"
           class="ms-item"
           :class="{ selected: modelValue === null }"
           @click="pick(null)">
        <span class="ms-label">{{ nullLabel }}</span>
        <i v-if="modelValue === null" class="fas fa-check"></i>
      </div>
      <div v-for="opt in options"
           :key="opt"
           class="ms-item"
           :class="{ selected: opt === modelValue }"
           @click="pick(opt)">
        <span class="ms-label ms-mono">{{ opt }}</span>
        <i v-if="opt === modelValue" class="fas fa-check"></i>
      </div>
      <div class="ms-item ms-meta" @click="startCustom">Enter custom model ID…</div>
    </div>

    <div v-if="customOpen" class="ms-custom">
      <input ref="customField"
             v-model="customText"
             placeholder="model-id"
             autocomplete="off"
             @keyup.enter="applyCustom">
      <button type="button" class="ms-custom-apply" @click="applyCustom">Use</button>
      <button type="button" class="ms-custom-cancel" @click="customOpen = false">
        <i class="fas fa-times"></i>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, watch, onMounted, onBeforeUnmount } from 'vue';
import { sanitizeModelInput } from '@/api/modelSelection';

const props = defineProps({
  modelValue: { type: String, default: null },
  options: { type: Array, default: () => [] },
  nullLabel: { type: String, default: null },
  placeholder: { type: String, default: 'Select a model…' },
  disabled: { type: Boolean, default: false }
});
const emit = defineEmits(['update:modelValue']);

const open = ref(false);
const customOpen = ref(false);
const customText = ref('');
const customField = ref(null);

const displayText = computed(() =>
  props.modelValue || props.nullLabel || props.placeholder
);

const toggle = () => {
  open.value = !open.value;
  customOpen.value = false;
};

const pick = (value) => {
  emit('update:modelValue', value);
  open.value = false;
};

const startCustom = async () => {
  open.value = false;
  customOpen.value = true;
  customText.value = '';
  await nextTick();
  customField.value?.focus();
};

const applyCustom = () => {
  const value = sanitizeModelInput(customText.value);
  if (!value) return; // empty/whitespace input is a no-op
  emit('update:modelValue', value);
  customOpen.value = false;
};

watch(() => props.disabled, (isDisabled) => {
  if (isDisabled) {
    open.value = false;
    customOpen.value = false;
  }
});

const root = ref(null);
const onDocumentClick = (event) => {
  if (open.value && root.value && !root.value.contains(event.target)) {
    open.value = false;
  }
};
onMounted(() => document.addEventListener('click', onDocumentClick));
onBeforeUnmount(() => document.removeEventListener('click', onDocumentClick));
</script>

<style scoped>
.ms-combo { margin-bottom: 10px; }

.ms-btn {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: #fff;
  font-size: 13px;
  font-family: monospace;
  color: #333;
  cursor: pointer;
  text-align: left;
}
.ms-btn:hover { border-color: #adb5bd; }
.ms-btn.open { border-color: #673ab7; box-shadow: 0 0 0 2px rgba(103, 58, 183, 0.12); }
.ms-btn:disabled { background: #f5f5f5; color: #adb5bd; cursor: default; }
.ms-btn:disabled:hover { border-color: #ddd; }

.ms-val {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ms-placeholder,
.ms-null {
  color: #999;
  font-family: -apple-system, "Segoe UI", Roboto, sans-serif;
}
.ms-chev { flex: none; font-size: 10px; color: #6c757d; }

.ms-dd {
  margin-top: 4px;
  background: #fff;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  gap: 2px; /* adjacent hover/selected tinted items must not touch */
  padding: 4px;
  max-height: 180px;
  overflow-y: auto;
}
.ms-item {
  padding: 6px 8px;
  border-radius: 4px;
  font-size: 12.5px;
  color: #333;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
}
.ms-item i { font-size: 10px; color: #673ab7; flex: none; }
.ms-label { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.ms-mono { font-family: monospace; }
.ms-item:hover { background: rgba(103, 58, 183, 0.07); }
/* Selected is a shade deeper than hover and declared after it, so it wins on hover */
.ms-item.selected { background: rgba(103, 58, 183, 0.16); }
.ms-meta {
  color: #673ab7;
  font-weight: 500;
  font-size: 12px;
  border-top: 1px solid #eee;
  border-radius: 0 0 4px 4px;
  margin-top: 2px;
  position: sticky;
  bottom: -4px;
  background: #fff;
}
.ms-meta:hover { background: rgba(103, 58, 183, 0.07); }

.ms-custom { display: flex; gap: 6px; margin-top: 6px; }
.ms-custom input {
  flex: 1;
  min-width: 0;
  padding: 7px 9px;
  border: 1px solid #673ab7;
  border-radius: 4px;
  font-size: 12.5px;
  font-family: monospace;
}
.ms-custom-apply,
.ms-custom-cancel {
  border: 1px solid #ba92ff;
  background: transparent;
  color: #673ab7;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
}
.ms-custom-apply { padding: 0 10px; }
.ms-custom-cancel {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  padding: 0;
  align-self: center;
}
.ms-custom-apply:hover,
.ms-custom-cancel:hover { background: #ba92ff; color: #fff; }
</style>
