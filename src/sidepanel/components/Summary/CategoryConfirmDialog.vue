<template>
  <div class="category-dialog-overlay" v-if="show">
    <div class="category-dialog">
      <h3><i class="fab fa-google-drive"></i> Save to Google Drive</h3>
      <p class="dialog-description">Choose categories for organizing this summary:</p>

      <div class="category-inputs">
        <div class="input-group">
          <label>Main Category:</label>
          <div class="input-with-suggestions">
            <input
              v-model="localMainCategory"
              placeholder="e.g., Technology, Education"
              @input="updateSubSuggestions"
              list="main-categories">
            <datalist id="main-categories">
              <option value="Education" />
              <option value="Technology" />
              <option value="Business" />
              <option value="Health" />
              <option value="Entertainment" />
              <option value="Science" />
              <option value="News" />
              <option value="Lifestyle" />
              <option value="Sports" />
              <option value="Arts" />
              <option value="Finance" />
              <option value="Travel" />
              <option value="Food" />
              <option value="Gaming" />
              <option value="Politics" />
            </datalist>
          </div>
        </div>

        <div class="input-group">
          <label>Subcategory:</label>
          <div class="input-with-suggestions">
            <input
              v-model="localSubCategory"
              placeholder="e.g., AI Research, Programming"
              :list="`sub-categories-${randomId}`">
            <datalist :id="`sub-categories-${randomId}`">
              <option v-for="suggestion in subSuggestions" :key="suggestion" :value="suggestion" />
            </datalist>
          </div>
        </div>
      </div>

      <div class="folder-path-preview">
        <i class="fas fa-folder-open"></i>
        <span class="path">
          XNote / summaries /
          <span class="category">{{ localMainCategory || '...' }}</span> /
          <span class="category">{{ localSubCategory || '...' }}</span>
        </span>
      </div>

      <div class="existing-folder-hint" v-if="existingFolder">
        <i class="fas fa-info-circle"></i>
        <span>This URL was previously saved to:
          <strong>{{ existingFolder.main }} > {{ existingFolder.sub }}</strong>
        </span>
        <button @click="useExisting" class="link-btn">Use same location</button>
      </div>

      <div class="dialog-actions">
        <button @click="handleCancel" class="cancel-btn">Cancel</button>
        <button @click="handleRegenerate" class="secondary-btn" :disabled="isRegenerating">
          <i class="fas fa-sync" :class="{ 'fa-spin': isRegenerating }"></i> Regenerate
        </button>
        <button @click="handleConfirm" class="primary-btn" :disabled="!isValid">
          <i class="fas fa-save"></i> Save
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { generateCategoryForPage, getSubcategorySuggestions } from './categoryExtractor';

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  suggestedCategory: {
    type: Object,
    default: () => ({ mainCategory: '', subCategory: '' })
  },
  existingFolder: {
    type: Object,
    default: null
  },
  pageData: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['confirm', 'cancel']);

// Generate random ID for datalist to avoid conflicts
const randomId = Math.random().toString(36).substring(7);

// Local state for editing
const localMainCategory = ref('');
const localSubCategory = ref('');
const subSuggestions = ref([]);
const isRegenerating = ref(false);

// Watch for prop changes to update local state
watch(() => props.suggestedCategory, (newVal) => {
  if (newVal) {
    localMainCategory.value = newVal.mainCategory || '';
    localSubCategory.value = newVal.subCategory || '';
    updateSubSuggestions();
  }
}, { immediate: true });

watch(() => props.show, (newVal) => {
  if (newVal && props.suggestedCategory) {
    localMainCategory.value = props.suggestedCategory.mainCategory || '';
    localSubCategory.value = props.suggestedCategory.subCategory || '';
    updateSubSuggestions();
  }
});

// Update subcategory suggestions based on main category
const updateSubSuggestions = () => {
  if (localMainCategory.value) {
    subSuggestions.value = getSubcategorySuggestions(localMainCategory.value);
  } else {
    subSuggestions.value = [];
  }
};

// Check if inputs are valid
const isValid = computed(() => {
  return localMainCategory.value.trim() !== '' && localSubCategory.value.trim() !== '';
});

// Use existing folder mapping
const useExisting = () => {
  if (props.existingFolder) {
    localMainCategory.value = props.existingFolder.main;
    localSubCategory.value = props.existingFolder.sub;
    updateSubSuggestions();
  }
};

// Regenerate category suggestion
const handleRegenerate = async () => {
  isRegenerating.value = true;
  try {
    const newCategory = await generateCategoryForPage(props.pageData);
    localMainCategory.value = newCategory.mainCategory;
    localSubCategory.value = newCategory.subCategory;
    updateSubSuggestions();
  } catch (error) {
    console.error('Error regenerating category:', error);
  } finally {
    isRegenerating.value = false;
  }
};

// Confirm and emit
const handleConfirm = () => {
  if (isValid.value) {
    emit('confirm', {
      mainCategory: localMainCategory.value.trim(),
      subCategory: localSubCategory.value.trim()
    });
  }
};

// Cancel
const handleCancel = () => {
  emit('cancel');
};
</script>

<style scoped>
.category-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  backdrop-filter: blur(4px);
}

.category-dialog {
  background: white;
  border-radius: 8px;
  padding: 24px;
  width: 90%;
  max-width: 480px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.category-dialog h3 {
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 600;
  color: #333;
  display: flex;
  align-items: center;
  gap: 8px;
}

.category-dialog h3 i {
  color: #4285f4;
}

.dialog-description {
  color: #6c757d;
  font-size: 13px;
  margin: 0 0 16px 0;
}

.category-inputs {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.input-group label {
  font-size: 12px;
  font-weight: 500;
  color: #495057;
}

.input-with-suggestions {
  position: relative;
}

.input-with-suggestions input {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  font-size: 13px;
  transition: all 0.2s ease;
}

.input-with-suggestions input:focus {
  outline: none;
  border-color: #ba92ff;
  box-shadow: 0 0 0 2px rgba(186, 146, 255, 0.25);
}

.folder-path-preview {
  background: #f8f9fa;
  padding: 8px 12px;
  border-radius: 4px;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #6c757d;
}

.folder-path-preview i {
  color: #ffc107;
}

.folder-path-preview .path {
  font-family: monospace;
}

.folder-path-preview .category {
  color: #673ab7;
  font-weight: 500;
}

.existing-folder-hint {
  background: #f0f8ff;
  padding: 8px 12px;
  border-radius: 4px;
  margin-bottom: 16px;
  font-size: 12px;
  color: #495057;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.existing-folder-hint i {
  color: #2196f3;
}

.existing-folder-hint strong {
  color: #333;
}

.link-btn {
  background: none;
  border: none;
  color: #2196f3;
  cursor: pointer;
  padding: 0;
  font-size: 12px;
  text-decoration: underline;
  margin-left: auto;
}

.link-btn:hover {
  color: #1976d2;
}

.dialog-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #dee2e6;
}

.dialog-actions button {
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s ease;
  border: none;
}

.cancel-btn {
  background: #f0f0f0;
  color: #495057;
}

.cancel-btn:hover {
  background: #e0e0e0;
}

.secondary-btn {
  background: transparent;
  color: #6c757d;
  border: 1px solid #dee2e6;
}

.secondary-btn:hover:not(:disabled) {
  background: #f8f9fa;
  border-color: #adb5bd;
}

.secondary-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.primary-btn {
  background: #ba92ff;
  color: white;
}

.primary-btn:hover:not(:disabled) {
  background: #a36dff;
}

.primary-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.fa-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>