<template>
  <div class="api-key-input">
    <div class="api-key-header">
      <label :for="id">{{ label }}</label>
      <div v-if="isChecking" class="api-key-status checking">
        <i class="fas fa-sync fa-spin"></i> Checking...
      </div>
      <div v-else-if="isConfigured === true" class="api-key-status configured">
        <i class="fas fa-check-circle"></i> Configured
      </div>
      <div v-else-if="isConfigured === false" class="api-key-status not-configured">
        <i class="fas fa-exclamation-circle"></i> Not Configured
      </div>
    </div>
    
    <div class="input-container">
      <input
        :id="id"
        :type="showKey ? 'text' : 'password'"
        v-model="apiKey"
        :placeholder="placeholder"
        :disabled="isChecking"
      />
      <button 
        type="button"
        class="clear-button"
        @click="clearKey"
        :title="'Clear key'"
        v-if="apiKey"
      >
        <i class="fas fa-times"></i>
      </button>
      <button 
        type="button" 
        class="toggle-visibility" 
        @click="showKey = !showKey"
        :title="showKey ? 'Hide key' : 'Show key'"
      >
        <i :class="showKey ? 'fas fa-eye-slash' : 'fas fa-eye'"></i>
      </button>
    </div>
    
    <div v-if="error" class="error-message">
      {{ error }}
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
import { getSecureValue, isSecureKeyConfigured } from '@/api/secureStorageService';

const props = defineProps({
  id: {
    type: String,
    required: true
  },
  label: {
    type: String,
    required: true
  },
  storageKey: {
    type: String,
    required: true
  },
  envFallback: {
    type: String,
    required: true
  },
  placeholder: {
    type: String,
    default: 'Enter API key'
  }
});

const emit = defineEmits(['update:apiKey', 'configurationChanged']);

const apiKey = ref('');
const showKey = ref(false);
const isConfigured = ref(null);
const isChecking = ref(false);
const error = ref('');

const checkConfiguration = async () => {
  isChecking.value = true;
  error.value = '';
  
  try {
    isConfigured.value = await isSecureKeyConfigured(props.storageKey, props.envFallback);
    
    // Load the key if it exists
    if (!apiKey.value) {
      const storedValue = await getSecureValue(props.storageKey, props.envFallback);
      if (storedValue) {
        // Show the actual stored value
        apiKey.value = storedValue;
      }
    }
    
    emit('configurationChanged', isConfigured.value);
  } catch (err) {
    error.value = err.message;
    isConfigured.value = false;
  } finally {
    isChecking.value = false;
  }
};

// Clear the key
const clearKey = () => {
  apiKey.value = '';
  emit('update:apiKey', '');
};

watch(apiKey, (newValue) => {
  // Always emit updates, including empty values for clearing
  emit('update:apiKey', newValue);
});

onMounted(() => {
  checkConfiguration();
});
</script>

<style scoped>
.api-key-input {
  margin-bottom: 15px;
}

.api-key-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 5px;
}

.api-key-status {
  font-size: 11px;
  padding: 2px 5px;
  border-radius: 3px;
}

.checking {
  color: #666;
}

.configured {
  color: #4caf50;
}

.not-configured {
  color: #f44336;
}

.input-container {
  position: relative;
  display: flex;
}

input {
  flex: 1;
  padding: 6px 35px 6px 6px;
  border: 1px solid #ccc;
  border-radius: 3px;
  font-size: 13px;
  width: 100%;
}

.toggle-visibility {
  position: absolute;
  right: 0;
  top: 0;
  background: none;
  border: none;
  height: 100%;
  width: 30px;
  cursor: pointer;
  color: #666;
}

.clear-button {
  position: absolute;
  right: 30px;
  top: 0;
  background: none;
  border: none;
  height: 100%;
  width: 30px;
  cursor: pointer;
  color: #666;
}

.clear-button:hover {
  color: #f44336;
}

.error-message {
  color: #f44336;
  font-size: 11px;
  margin-top: 3px;
}
</style> 