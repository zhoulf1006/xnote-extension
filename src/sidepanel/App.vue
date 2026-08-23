<template>
  <div class="sidebar">
    <nav class="nav-menu">
      <div 
        v-for="tab in tabs" 
        :key="tab.id"
        class="nav-item"
        :class="{ active: navigationStore.state.activeTab === tab.id }"
        @click="navigationStore.setActiveTab(tab.id)"
      >
        <i :class="tab.icon"></i>
        <span class="nav-text">{{ tab.name }}</span>
      </div>
      <div class="nav-spacer"></div>
      <div v-if="googleDriveStore?.isAvailable"
           class="nav-item drive-item"
           @click="showStorageModal = true"
           :class="{ 'drive-connected': googleDriveStore.isConnected }">
        <i class="fab fa-google-drive"></i>
        <span class="nav-text">Storage & Sync</span>
        <span class="status-dot"
              :class="{
                'connected': googleDriveStore.isConnected,
                'syncing': googleDriveStore.isSyncing,
                'error': googleDriveStore.syncStatus === 'failed'
              }"></span>
      </div>
      <div class="nav-item config-item" @click="handleConfigClick">
        <i class="fas fa-cog"></i>
        <span class="nav-text">LLM Config</span>
      </div>
    </nav>
    <main class="content">
      <Chat v-if="navigationStore.state.activeTab === 'chat'" />
      <QuickLinks v-if="navigationStore.state.activeTab === 'links'" />
      <Translation v-if="navigationStore.state.activeTab === 'translate'" />
      <Summary v-if="navigationStore.state.activeTab === 'summary'" />
      <ScreenCapture v-if="navigationStore.state.activeTab === 'capture'" />
      <FileTransfer v-if="navigationStore.state.activeTab === 'transfer'" />
    </main>
    <div v-if="showConfig" class="config-modal">
      <div class="config-content">
        <h2>LLM Provider Configuration</h2>
        <div class="provider-selection">
          <div v-for="(config, key) in llmProviders"
               :key="key"
               class="provider-option"
               :class="{ selected: selectedProvider === key }"
               @click="selectedProvider = key">
            <input type="radio"
                   :id="key"
                   :value="key"
                   v-model="selectedProvider"
                   name="provider">
            <label :for="key">{{ config.name }}</label>
          </div>
        </div>
        
        <div class="api-key-section">
          <h3>API Key Configuration</h3>
          <p class="api-key-info">
            <i class="fas fa-info-circle"></i>
            {{ isExtensionMode ?
              'API keys will be securely stored in your Chrome account storage.' :
              'In development mode, keys are read from environment variables.'
            }}
          </p>

          <!-- Warning when selected provider is not configured -->
          <div v-if="selectedProviderNeedsConfig && isExtensionMode" class="provider-config-warning">
            <i class="fas fa-exclamation-triangle"></i>
            <span>The selected provider requires an API key to be configured before use.</span>
          </div>

          <!-- API Key inputs for all providers (always rendered but conditionally shown) -->
          <div v-show="selectedProvider === 'openai'">
            <ApiKeyInput
              id="openai-key"
              label="OpenAI API Key"
              :storage-key="STORAGE_KEYS.OPENAI_API_KEY"
              env-fallback="VITE_OPENAI_API_KEY"
              placeholder="Enter your OpenAI API key"
              v-model:api-key="apiKeys.openai"
              @configuration-changed="providerKeyStatus.openai = $event"
              :key="'openai-' + configModalKey"
            />
          </div>

          <div v-show="selectedProvider === 'customized'">
            <div class="customized-provider-config">
              <div class="custom-url-section">
                <label for="custom-base-url">Base URL Endpoint</label>
                <input
                  id="custom-base-url"
                  type="url"
                  v-model="customConfig.baseURL"
                  placeholder="https://api.example.com/v1"
                  class="custom-url-input"
                />
                <p class="field-hint">Enter the base URL for your OpenAI-compatible API endpoint</p>
              </div>

              <div class="ms-assist-row">
                <button type="button"
                        class="ms-fetch-assist"
                        :disabled="modelFetch.customized === 'loading'"
                        @click="fetchCustomizedModels">
                  <i class="fas fa-sync" :class="{ 'fa-spin': modelFetch.customized === 'loading' }"></i>
                  <span>{{ modelList.customized ? 'Refresh models from endpoint' : 'Fetch models from endpoint' }}</span>
                </button>
              </div>
              <div v-if="customizedNote" class="ms-note" :class="'ms-note-' + customizedNote.type">
                <i class="fas" :class="customizedNote.icon"></i>
                <span>{{ customizedNote.text }}</span>
              </div>
              <p v-else-if="modelList.customized" class="field-hint">
                {{ modelList.customized.models.length }} models loaded from /models — the capability dropdowns below offer them as suggestions.
              </p>
              <p v-else class="field-hint">
                Loads /models from the endpoint to offer suggestions; manual entry always works.
              </p>

              <ApiKeyInput
                id="customized-key"
                label="API Key"
                :storage-key="STORAGE_KEYS.CUSTOMIZED_API_KEY"
                env-fallback="VITE_CUSTOMIZED_API_KEY"
                placeholder="Enter your API key"
                v-model:api-key="apiKeys.customized"
                @configuration-changed="providerKeyStatus.customized = $event"
                :key="'customized-' + configModalKey"
              />

              <div class="capabilities-section">
                <h4>Capabilities Configuration</h4>

                <!-- Chat capability -->
                <div class="capability-item">
                  <label class="capability-toggle">
                    <input type="checkbox" v-model="customConfig.capabilities.chat.enabled">
                    <span>Chat</span>
                  </label>
                  <ModelSelect
                    v-if="customConfig.capabilities.chat.enabled"
                    :model-value="customConfig.capabilities.chat.model || null"
                    :options="modelList.customized?.models || []"
                    placeholder="Model ID (e.g., gpt-4o)"
                    @update:model-value="v => customConfig.capabilities.chat.model = v || ''"
                  />
                </div>

                <!-- Vision capability -->
                <div class="capability-item">
                  <label class="capability-toggle">
                    <input type="checkbox" v-model="customConfig.capabilities.vision.enabled">
                    <span>Vision (Image Analysis)</span>
                  </label>
                  <ModelSelect
                    v-if="customConfig.capabilities.vision.enabled"
                    :model-value="customConfig.capabilities.vision.model || null"
                    :options="modelList.customized?.models || []"
                    placeholder="Model ID (e.g., gpt-4o)"
                    @update:model-value="v => customConfig.capabilities.vision.model = v || ''"
                  />
                </div>

                <!-- Speech capability -->
                <div class="capability-item">
                  <label class="capability-toggle">
                    <input type="checkbox" v-model="customConfig.capabilities.speech.enabled">
                    <span>Speech (TTS)</span>
                  </label>
                  <ModelSelect
                    v-if="customConfig.capabilities.speech.enabled"
                    :model-value="customConfig.capabilities.speech.model || null"
                    :options="modelList.customized?.models || []"
                    placeholder="Model ID (e.g., tts-1)"
                    @update:model-value="v => customConfig.capabilities.speech.model = v || ''"
                  />
                </div>
              </div>
            </div>
          </div>
          
          <div v-show="selectedProvider === 'deepseek'">
            <ApiKeyInput
              id="deepseek-key"
              label="DeepSeek API Key"
              :storage-key="STORAGE_KEYS.DEEPSEEK_API_KEY"
              env-fallback="VITE_DEEPSEEK_API_KEY"
              placeholder="Enter your DeepSeek API key"
              v-model:api-key="apiKeys.deepseek"
              @configuration-changed="providerKeyStatus.deepseek = $event"
              :key="'deepseek-' + configModalKey"
            />
          </div>
          
          <div v-show="selectedProvider === 'gemini'">
            <ApiKeyInput
              id="gemini-key"
              label="Gemini API Key"
              :storage-key="STORAGE_KEYS.GEMINI_API_KEY"
              env-fallback="VITE_GEMINI_API_KEY"
              placeholder="Enter your Gemini API key"
              v-model:api-key="apiKeys.gemini"
              @configuration-changed="providerKeyStatus.gemini = $event"
              :key="'gemini-' + configModalKey"
            />
          </div>

          <!-- Model selection for built-in providers (list fetched from the provider's API) -->
          <div v-if="selectedProvider !== 'customized'" class="ms-config">
            <div class="ms-field-label">
              <span>Chat model</span>
              <button type="button"
                      class="ms-refresh"
                      title="Refresh model list"
                      :disabled="modelFetch[selectedProvider] === 'loading' || modelFetch[selectedProvider] === 'no-key'"
                      @click="loadModelsFor(selectedProvider)">
                <i class="fas fa-sync" :class="{ 'fa-spin': modelFetch[selectedProvider] === 'loading' }"></i>
              </button>
            </div>
            <ModelSelect v-model="modelSelections[selectedProvider].chat"
                         :options="currentModels"
                         :disabled="modelFetch[selectedProvider] === 'loading'"
                         placeholder="Select a model…" />
            <template v-if="llmProviders[selectedProvider].supportsVision">
              <div class="ms-field-label"><span>Vision model</span></div>
              <ModelSelect v-model="modelSelections[selectedProvider].vision"
                           :options="currentModels"
                           null-label="Same as chat model"
                           :disabled="modelFetch[selectedProvider] === 'loading'" />
            </template>
            <div v-if="modelNote" class="ms-note" :class="'ms-note-' + modelNote.type">
              <i class="fas" :class="modelNote.icon"></i>
              <span>{{ modelNote.text }}</span>
            </div>
            <div class="ms-hint">Default when nothing selected: {{ llmProviders[selectedProvider].defaultModel }}</div>
          </div>
        </div>


        <div class="config-actions">
          <button class="cancel" @click="handleCancel">Cancel</button>
          <button class="save" @click="saveConfig">Save</button>
        </div>
      </div>
    </div>

    <!-- Storage & Sync Modal -->
    <div v-if="showStorageModal" class="storage-modal">
      <div class="storage-modal-content">
        <div class="modal-header">
          <h2><i class="fab fa-google-drive"></i> Storage & Sync</h2>
          <button class="modal-close-btn" @click="showStorageModal = false">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <!-- Connection Status -->
        <div class="storage-section">
          <h3 class="section-title">Connection Status</h3>
          <div class="status-card">
            <div class="status-row">
              <div class="status-indicator">
                <span v-if="googleDriveStore.isConnected" class="status-badge status-connected">
                  <i class="fas fa-check-circle"></i> Connected
                </span>
                <span v-else class="status-badge status-disconnected">
                  <i class="fas fa-times-circle"></i> Not Connected
                </span>
              </div>

              <button v-if="!googleDriveStore.isConnected"
                      @click="connectGoogleDrive"
                      class="button-primary">
                <i class="fas fa-link"></i> Connect
              </button>
              <button v-else
                      @click="disconnectGoogleDrive"
                      class="button-delete">
                <i class="fas fa-unlink"></i> Disconnect
              </button>
            </div>
          </div>
        </div>

        <!-- Storage Location Section (moved above Sync Information) -->
        <div class="storage-section with-separator" v-if="googleDriveStore.isConnected">
          <h3 class="section-title">Storage Location</h3>
          <div class="location-card">
            <!-- Current Location Display -->
            <div class="current-location">
              <i class="fas fa-folder"></i>
              <span class="location-label">Current Location:</span>
              <code class="location-path">{{ googleDriveStore.getDisplayPath() }}</code>
            </div>

            <!-- Location Options -->
            <div class="location-options">
              <label class="radio-option">
                <input type="radio"
                       v-model="locationMode"
                       value="default">
                <span>Use default location (My Drive root)</span>
              </label>

              <label class="radio-option">
                <input type="radio"
                       v-model="locationMode"
                       value="custom">
                <span>Choose custom folder location</span>
              </label>
            </div>

            <!-- Folder Picker Button -->
            <button v-if="locationMode === 'custom'"
                    @click="openFolderBrowser"
                    :disabled="googleDriveStore.isChangingLocation"
                    class="button-primary picker-button">
              <i class="fas fa-folder-open"></i>
              Browse Folders
            </button>

            <!-- Selected Folder Display -->
            <div v-if="selectedFolder" class="selected-folder">
              <i class="fas fa-check-circle"></i>
              <span>Selected: {{ selectedFolder.path }}</span>
            </div>

            <!-- Apply Changes Button -->
            <button v-if="hasLocationChanges"
                    @click="applyLocationChanges"
                    :disabled="googleDriveStore.isChangingLocation"
                    class="button-primary apply-button">
              <i class="fas fa-save"></i>
              {{ googleDriveStore.isChangingLocation ? 'Applying...' : 'Apply Location Change' }}
            </button>

            <!-- Location Change Info -->
            <div v-if="hasLocationChanges" class="location-info">
              <i class="fas fa-info-circle"></i>
              <span>
                <strong>Note:</strong> Each storage location maintains its own files and organization.
                Previously uploaded content will remain in the old location, and the new location will start fresh.
              </span>
            </div>
          </div>
        </div>

        <!-- Sync Information (moved after Storage Location) -->
        <div class="storage-section with-separator">
          <h3 class="section-title">Sync Information</h3>
          <div class="info-card">
            <div class="folder-location">
              <i class="fas fa-folder"></i>
              <span class="location-label">Folder Location:</span>
              <a v-if="googleDriveStore.isConnected"
                 @click="openGoogleDriveFolder"
                 class="location-path location-link"
                 title="Open in Google Drive">
                <code>{{ googleDriveStore.getDisplayPath() }}</code>
                <i class="fas fa-external-link-alt"></i>
              </a>
              <code v-else class="location-path">{{ googleDriveStore.getDisplayPath() }}</code>
            </div>

            <div class="sync-files">
              <p class="sync-label">Files to be synced:</p>
              <div class="file-list">
                <div class="file-item">
                  <i class="fas fa-comments"></i>
                  <span>Chat conversations</span>
                  <code>/chats/*.md</code>
                </div>
                <div class="file-item">
                  <i class="fas fa-file-alt"></i>
                  <span>Summaries</span>
                  <code>/summaries/*.md</code>
                </div>
                <div class="file-item">
                  <i class="fas fa-language"></i>
                  <span>Translations</span>
                  <code>/translations/*.md</code>
                </div>
              </div>
            </div>

            <div v-if="googleDriveStore.isConnected" class="auto-sync-toggle">
              <label class="toggle-label">
                <input type="checkbox"
                       v-model="googleDriveStore.syncEnabled"
                       @change="googleDriveStore.toggleSync()">
                <span>Enable Auto-Sync (every 30 minutes)</span>
              </label>
            </div>
          </div>
        </div>

        <!-- Sync Status -->
        <div v-if="googleDriveStore.isConnected" class="storage-section with-separator">
          <h3 class="section-title">Sync Status</h3>
          <div class="sync-card">
            <!-- Success State -->
            <div v-if="googleDriveStore.syncStatus === 'success' && googleDriveStore.lastSyncTime"
                 class="sync-status sync-status-success">
              <i class="fas fa-check-circle"></i>
              <span>Last synced: {{ formatSyncTime(googleDriveStore.lastSyncTime) }}</span>
            </div>

            <!-- Error State -->
            <div v-if="googleDriveStore.syncStatus === 'failed' && googleDriveStore.lastSyncError"
                 class="sync-status sync-status-error">
              <i class="fas fa-exclamation-triangle"></i>
              <span>Sync failed: {{ googleDriveStore.lastSyncError }}</span>
            </div>

            <!-- Syncing State -->
            <div v-if="googleDriveStore.isSyncing" class="sync-status sync-status-progress">
              <i class="fas fa-sync fa-spin"></i>
              <span>Syncing...</span>
            </div>

            <!-- Sync Button -->
            <button @click="syncNow"
                    :disabled="googleDriveStore.isSyncing"
                    class="button-primary sync-button">
              <i class="fas fa-sync" :class="{ 'fa-spin': googleDriveStore.isSyncing }"></i>
              {{ googleDriveStore.isSyncing ? 'Syncing...' : 'Sync Now' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <ConfirmDialog
      :show="!!confirmPending"
      :message="confirmPending?.message || ''"
      :confirm-label="confirmPending?.confirmLabel || 'Delete'"
      @confirm="acceptConfirm"
      @cancel="cancelConfirm"
    />

    <!-- Folder Browser Modal -->
    <FolderBrowser
      v-if="showFolderBrowser"
      @select="onFolderSelected"
      @cancel="closeFolderBrowser"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import useNavigationStore from '@/stores/navigation';
import { useLLMConfigStore } from '@/stores/llmConfig';
import { useGoogleDriveStore } from '@/stores/googleDrive';
import { llmProviders } from '@/config/llmProviders';
import {
  STORAGE_KEYS,
  isExtensionMode as checkExtensionMode,
  initializeStorage,
  checkStorage,
  storeSecureValue,
  secureStorageService,
  migrateSyncToLocalStorage
} from '@/api/storageService';
import Chat from './components/Chat/index.vue';
import QuickLinks from './components/QuickLinks/index.vue';
import Translation from './components/Translation/index.vue';
import Summary from './components/Summary/index.vue';
import ScreenCapture from './components/ScreenCapture/index.vue';
import FileTransfer from './components/FileTransfer/index.vue';
import ApiKeyInput from './components/Common/ApiKeyInput.vue';
import ModelSelect from './components/Common/ModelSelect.vue';
import FolderBrowser from './components/FolderBrowser/index.vue';
import { modelCatalogService, modelSelectionStore } from '@/api/modelConfigService';
import ConfirmDialog from './components/Common/ConfirmDialog.vue';
import { confirmAction, useConfirmHost } from './composables/useConfirm';

const navigationStore = useNavigationStore();
// Single app-wide confirmation dialog host (window.confirm is suppressed in side panels)
const { pending: confirmPending, accept: acceptConfirm, cancel: cancelConfirm } = useConfirmHost();
const llmConfigStore = useLLMConfigStore();
const googleDriveStore = useGoogleDriveStore();
const showConfig = ref(false);
const showStorageModal = ref(false);
const selectedProvider = ref(llmConfigStore.selectedProvider);
const isExtensionMode = computed(() => checkExtensionMode());
const configModalKey = ref(0); // Key to force component re-rendering when needed

// Folder location state
const locationMode = ref('default');
const selectedFolder = ref(null);
const showFolderBrowser = ref(false);
const hasLocationChanges = computed(() => {
  if (locationMode.value === 'default' && googleDriveStore.useCustomLocation) {
    return true;
  }
  if (locationMode.value === 'custom' && !googleDriveStore.useCustomLocation) {
    return selectedFolder.value !== null;
  }
  if (locationMode.value === 'custom' && googleDriveStore.useCustomLocation) {
    return selectedFolder.value && selectedFolder.value.id !== googleDriveStore.parentFolderId;
  }
  return false;
});

// API key state
const apiKeys = ref({
  openai: '',
  deepseek: '',
  gemini: '',
  customized: ''
});

// Track configuration status for each provider
const providerKeyStatus = ref({
  openai: null,
  deepseek: null,
  gemini: null,
  customized: null
});

// Computed property to check if the selected provider needs configuration
const selectedProviderNeedsConfig = computed(() => {
  const provider = selectedProvider.value;
  if (!provider) return false;

  // Check if we have status info for this provider
  const status = providerKeyStatus.value[provider];

  // If status is explicitly false or null, the provider is not configured
  // Status is true when the API key is configured
  return status === false || status === null;
});

// Model selection state: per built-in provider {chat, vision} (null = not selected),
// fetched model lists and fetch state per provider
const BUILTIN_PROVIDERS = ['openai', 'deepseek', 'gemini'];
const modelSelections = ref({
  openai: { chat: null, vision: null },
  deepseek: { chat: null, vision: null },
  gemini: { chat: null, vision: null }
});
const modelList = ref({ openai: null, deepseek: null, gemini: null, customized: null });
const modelFetch = ref({ openai: 'idle', deepseek: 'idle', gemini: 'idle', customized: 'idle' });
let modelFetchSeq = 0; // guards against stale responses populating a switched-away provider

const currentModels = computed(() => modelList.value[selectedProvider.value]?.models || []);

const modelNote = computed(() => {
  const provider = selectedProvider.value;
  if (provider === 'customized') return null;
  const state = modelFetch.value[provider];
  const cached = modelList.value[provider];
  if (state === 'loading') return { type: 'info', icon: 'fa-sync fa-spin', text: 'Fetching model list…' };
  if (state === 'auth-error') return { type: 'err', icon: 'fa-exclamation-triangle', text: 'Couldn\'t fetch models — the API key was rejected. Check the key above, or enter a model ID manually.' };
  if (state === 'fetch-error') {
    return cached
      ? { type: 'warn', icon: 'fa-exclamation-triangle', text: `Couldn't refresh — showing cached list (fetched ${formatSyncTime(cached.fetchedAt)}). Manual entry still works.` }
      : { type: 'warn', icon: 'fa-exclamation-triangle', text: 'Couldn\'t fetch the model list — check your connection. Manual entry still works.' };
  }
  if (state === 'no-key') return { type: 'info', icon: 'fa-info-circle', text: 'Configure an API key to load the model list. You can still enter a model ID manually.' };
  if (state === 'loaded' && currentModels.value.length === 0) return { type: 'info', icon: 'fa-info-circle', text: 'The API returned no usable models — enter a model ID manually.' };
  return null;
});

const customizedNote = computed(() => {
  const state = modelFetch.value.customized;
  if (state === 'loading') return { type: 'info', icon: 'fa-sync fa-spin', text: 'Fetching model list…' };
  if (state === 'auth-error') return { type: 'err', icon: 'fa-exclamation-triangle', text: 'Couldn\'t fetch models — the API key was rejected. Check the key, or enter model IDs manually.' };
  if (state === 'fetch-error') return { type: 'warn', icon: 'fa-exclamation-triangle', text: 'Couldn\'t fetch models from the endpoint. Check the base URL — manual entry still works.' };
  if (state === 'no-baseurl') return { type: 'info', icon: 'fa-info-circle', text: 'Enter a base URL first, then fetch models.' };
  return null;
});

const loadModelsFor = async (provider) => {
  if (provider === 'customized') return;
  const apiKey = (apiKeys.value[provider] || '').trim();
  if (!apiKey) {
    modelFetch.value[provider] = 'no-key';
    return;
  }
  const seq = ++modelFetchSeq;
  modelFetch.value[provider] = 'loading';
  try {
    const entry = await modelCatalogService.fetchModels(provider, {
      apiKey,
      baseURL: llmProviders[provider].baseURL
    });
    if (seq !== modelFetchSeq) return; // a newer fetch superseded this one
    modelList.value[provider] = entry;
    modelFetch.value[provider] = 'loaded';
  } catch (error) {
    if (seq !== modelFetchSeq) return;
    modelFetch.value[provider] = error.name === 'ModelListAuthError' ? 'auth-error' : 'fetch-error';
  }
};

const fetchCustomizedModels = async () => {
  const baseURL = (customConfig.value.baseURL || '').trim();
  if (!baseURL) {
    modelFetch.value.customized = 'no-baseurl';
    return;
  }
  const apiKey = (apiKeys.value.customized || '').trim();
  const seq = ++modelFetchSeq;
  modelFetch.value.customized = 'loading';
  try {
    const entry = await modelCatalogService.fetchModels('customized', { apiKey, baseURL });
    if (seq !== modelFetchSeq) return;
    modelList.value.customized = entry;
    modelFetch.value.customized = 'loaded';
  } catch (error) {
    if (seq !== modelFetchSeq) return;
    modelFetch.value.customized = error.name === 'ModelListAuthError' ? 'auth-error' : 'fetch-error';
  }
};

// Load stored selections + cached lists, then auto-fetch for the visible provider.
// Each read is guarded: on a storage failure the in-memory value is kept, so a
// transient error can't reset selections to defaults that Save would then persist.
const loadModelConfig = async () => {
  for (const provider of BUILTIN_PROVIDERS) {
    try {
      modelSelections.value[provider] = await modelSelectionStore.getSelections(provider);
    } catch (error) {
      console.warn(`Could not load model selection for ${provider}, keeping current values:`, error);
    }
    modelFetch.value[provider] = 'idle';
  }
  modelFetch.value.customized = 'idle';
  for (const provider of [...BUILTIN_PROVIDERS, 'customized']) {
    if (!modelList.value[provider]) {
      try {
        const cached = await modelCatalogService.readCache(provider);
        if (cached) modelList.value[provider] = cached;
      } catch (error) {
        console.warn(`Could not read cached model list for ${provider}:`, error);
      }
    }
  }
  if (selectedProvider.value !== 'customized') {
    loadModelsFor(selectedProvider.value);
  }
};

// Auto-fetch when switching provider inside the open modal
watch(selectedProvider, (provider) => {
  if (showConfig.value && provider !== 'customized') {
    loadModelsFor(provider);
  }
});

// Custom provider configuration
const customConfig = ref({
  baseURL: '',
  capabilities: {
    chat: { enabled: true, model: 'gpt-4o', endpoint: '/chat/completions' },
    vision: { enabled: false, model: 'gpt-4o', endpoint: '/chat/completions' },
    speech: { enabled: false, model: 'tts-1', endpoint: '/audio/speech' }
  }
});

// Load stored API keys
const loadStoredApiKeys = async () => {
  try {
    console.log('Loading stored API keys...');

    // Import secure storage service
    const { getSecureValue, getStoredValue } = await import('@/api/storageService');

    // Load all API keys in parallel
    const [openaiKey, customizedKey, deepseekKey, geminiKey, customizedConfig] = await Promise.all([
      getSecureValue(STORAGE_KEYS.OPENAI_API_KEY, 'VITE_OPENAI_API_KEY'),
      getSecureValue(STORAGE_KEYS.CUSTOMIZED_API_KEY, 'VITE_CUSTOMIZED_API_KEY'),
      getSecureValue(STORAGE_KEYS.DEEPSEEK_API_KEY, 'VITE_DEEPSEEK_API_KEY'),
      getSecureValue(STORAGE_KEYS.GEMINI_API_KEY, 'VITE_GEMINI_API_KEY'),
      getStoredValue(STORAGE_KEYS.CUSTOMIZED_CONFIG)
    ]);

    // Update apiKeys with stored values (show actual values)
    apiKeys.value.openai = openaiKey;
    apiKeys.value.deepseek = deepseekKey;
    apiKeys.value.gemini = geminiKey;
    apiKeys.value.customized = customizedKey;

    // Load custom configuration if available
    if (customizedConfig) {
      try {
        const config = JSON.parse(customizedConfig);
        customConfig.value = { ...customConfig.value, ...config };
      } catch (error) {
        console.warn('Failed to parse custom configuration:', error);
      }
    }

    console.log('✅ API keys loaded');
  } catch (error) {
    console.warn('⚠️ Could not load stored API keys:', error);
  }
};

// Open configuration modal
const openConfigModal = async () => {
  showConfig.value = true;
  configModalKey.value++; // Force component re-render

  // Load stored API keys when modal opens
  await loadStoredApiKeys();

  // Load model selections + cached lists, auto-fetch for the visible provider
  await loadModelConfig();
};

// Add click handler to the config nav item
const handleConfigClick = () => {
  openConfigModal();
};

// Watch for modal close to reset state
watch(showConfig, (newValue) => {
  if (!newValue) {
    // Modal was closed, increment key to ensure fresh state next time
    configModalKey.value++;
  }
});

// Folder selection handlers
const openFolderBrowser = () => {
  showFolderBrowser.value = true;
};

const onFolderSelected = async (folder) => {
  showFolderBrowser.value = false;

  try {
    // Validate the selected folder
    const validatedFolder = await googleDriveStore.validateCustomFolder(folder);
    if (validatedFolder) {
      selectedFolder.value = validatedFolder;
    }
  } catch (error) {
    console.error('Error validating folder:', error);
    alert('Failed to validate the selected folder. Please try again.');
  }
};

const closeFolderBrowser = () => {
  showFolderBrowser.value = false;
};

const applyLocationChanges = async () => {
  // Show confirmation dialog explaining the new location behavior
  const confirmMessage =
    'Changing storage location will switch to a different folder context.\n\n' +
    '• Each location maintains its own files and organization\n' +
    '• Content in the old location will remain there\n' +
    '• The new location will start fresh or use existing files if you\'ve used it before\n\n' +
    'Do you want to continue?';

  if (!(await confirmAction(confirmMessage, 'Continue'))) {
    return;
  }

  try {
    let success = false;

    if (locationMode.value === 'default') {
      // Reset to default location
      success = await googleDriveStore.resetToDefaultLocation();
    } else if (locationMode.value === 'custom' && selectedFolder.value) {
      // Apply custom location
      success = await googleDriveStore.applyCustomLocation(
        selectedFolder.value.id,
        selectedFolder.value.name
      );
    }

    if (success) {
      selectedFolder.value = null;
      // Update location mode based on new state
      locationMode.value = googleDriveStore.useCustomLocation ? 'custom' : 'default';
      alert('Storage location changed successfully!\n\nYou are now working in the new location.');
    } else {
      alert('Failed to change storage location. Please try again.');
    }
  } catch (error) {
    console.error('Error applying location changes:', error);
    alert('Error changing storage location: ' + error.message);
  }
};

// Initialize location mode on mount
watch(() => googleDriveStore.isConnected, (connected) => {
  if (connected) {
    locationMode.value = googleDriveStore.useCustomLocation ? 'custom' : 'default';
  }
});

watch(showStorageModal, (newValue) => {
  if (newValue) {
    // Initialize location mode when modal opens
    locationMode.value = googleDriveStore.useCustomLocation ? 'custom' : 'default';
    selectedFolder.value = null;
  }
});

onMounted(async () => {
  // Listen for custom event to open LLM config
  window.addEventListener('openLLMConfig', () => {
    openConfigModal();
  });

  // Listen for custom event to open storage modal (from FileTransfer)
  window.addEventListener('openStorageModal', () => {
    showStorageModal.value = true;
  });

  try {
    // Initialize storage service and wait for it to complete
    console.log('Initializing storage service...');
    const storageStatus = await initializeStorage();
    console.log('Storage initialization completed:', storageStatus);

    // Migrate large mapping data from sync to local storage to avoid quota issues
    await migrateSyncToLocalStorage();
    console.log('✅ Storage migration check completed');

    // Note: LLM config store will initialize itself when accessed
    // The store maintains backward compatibility with localStorage access
    console.log('✅ LLM config store ready (lazy initialization)');

    // Initialize Google Drive store
    await googleDriveStore.initialize();
    console.log('✅ Google Drive store initialized');

    // Migrate existing plain text keys to encrypted format if encryption is available
    // (Secure storage is already initialized in initializeStorage)
    if (secureStorageService.encryptionEnabled) {
      console.log('🔐 Encryption available, checking for migration needs...');
      await secureStorageService.migrateToEncrypted();
    }
    
    // Add a small delay to ensure Chrome APIs are fully available
    if (storageStatus.isExtensionURL) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    // Check storage status to make sure we're using the right storage
    const status = await checkStorage();
    console.log('Storage status check completed:', status);
    
    // Verify extension mode is correctly detected
    console.log('Extension mode detected:', checkExtensionMode());
    console.log('Using storage type:', storageStatus.storageType);
    
    if (storageStatus.isExtensionURL && !storageStatus.extensionMode) {
      console.warn('⚠️ Extension URL detected but extension mode is false. This may indicate a problem with Chrome API availability.');
    }
  } catch (error) {
    console.error('❌ Error initializing storage:', error);
    alert('There was a problem initializing the storage system. Some features may not work correctly.');
  }
});

// Google Drive methods
const connectGoogleDrive = async () => {
  try {
    const success = await googleDriveStore.connect();
    if (success) {
      console.log('Successfully connected to Google Drive');
    } else {
      alert('Failed to connect to Google Drive. Please try again.');
    }
  } catch (error) {
    console.error('Error connecting to Google Drive:', error);
    alert('Error connecting to Google Drive: ' + error.message);
  }
};

const disconnectGoogleDrive = async () => {
  if (await confirmAction('Are you sure you want to disconnect from Google Drive? This will stop all syncing.', 'Disconnect')) {
    try {
      await googleDriveStore.disconnect();
      console.log('Disconnected from Google Drive');
    } catch (error) {
      console.error('Error disconnecting from Google Drive:', error);
      alert('Error disconnecting from Google Drive: ' + error.message);
    }
  }
};

const syncNow = async () => {
  try {
    const success = await googleDriveStore.syncAll();
    if (success) {
      console.log('Sync completed successfully');
    } else {
      alert('Sync failed. Please check your connection and try again.');
    }
  } catch (error) {
    console.error('Error syncing with Google Drive:', error);
    alert('Error syncing with Google Drive: ' + error.message);
  }
};

const openGoogleDriveFolder = async () => {
  try {
    const folderUrl = await googleDriveStore.getFolderUrl();
    if (folderUrl) {
      // Use chrome.tabs.create if available (extension environment)
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        chrome.tabs.create({ url: folderUrl });
      } else {
        // Fallback for development mode
        window.open(folderUrl, '_blank');
      }
    } else {
      console.warn('Could not get Google Drive folder URL');
      alert('Could not open Google Drive folder. Please make sure you are connected.');
    }
  } catch (error) {
    console.error('Error opening Google Drive folder:', error);
    alert('Error opening Google Drive folder: ' + error.message);
  }
};

const formatSyncTime = (timestamp) => {
  if (!timestamp) return 'Never';
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;

  // If less than 1 minute ago
  if (diff < 60000) {
    return 'Just now';
  }

  // If less than 1 hour ago
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  }

  // If today
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Otherwise show date and time
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const handleCancel = async () => {
  selectedProvider.value = llmConfigStore.selectedProvider;
  
  // Reset API key inputs to their stored values (not empty strings)
  apiKeys.value = {
    openai: '',
    deepseek: '',
    gemini: ''
  };
  
  // Reload the stored values
  await loadStoredApiKeys();
  
  showConfig.value = false;
};

const saveConfig = async () => {
  try {
    console.log('💾 Saving configuration...');
    
    // Step 1: Save API keys FIRST (before setting provider)
    const promises = [];
    const isDevelopment = window.location.hostname === 'localhost';
    
    console.log('🔑 Saving API keys...');
    
    // Save API keys if they have values
    if (apiKeys.value.openai && apiKeys.value.openai.trim() !== '') {
      promises.push(storeSecureValue(STORAGE_KEYS.OPENAI_API_KEY, apiKeys.value.openai));
      console.log('  - Saving OpenAI key');
    } else if (apiKeys.value.openai === '') {
      promises.push(storeSecureValue(STORAGE_KEYS.OPENAI_API_KEY, ''));
      console.log('  - Clearing OpenAI key');
    }

    if (apiKeys.value.customized && apiKeys.value.customized.trim() !== '') {
      promises.push(storeSecureValue(STORAGE_KEYS.CUSTOMIZED_API_KEY, apiKeys.value.customized));
      console.log('  - Saving Customized key');
    } else if (apiKeys.value.customized === '') {
      promises.push(storeSecureValue(STORAGE_KEYS.CUSTOMIZED_API_KEY, ''));
      console.log('  - Clearing Customized key');
    }

    if (apiKeys.value.deepseek && apiKeys.value.deepseek.trim() !== '') {
      promises.push(storeSecureValue(STORAGE_KEYS.DEEPSEEK_API_KEY, apiKeys.value.deepseek));
      console.log('  - Saving DeepSeek key');
    } else if (apiKeys.value.deepseek === '') {
      promises.push(storeSecureValue(STORAGE_KEYS.DEEPSEEK_API_KEY, ''));
      console.log('  - Clearing DeepSeek key');
    }

    if (apiKeys.value.gemini && apiKeys.value.gemini.trim() !== '') {
      promises.push(storeSecureValue(STORAGE_KEYS.GEMINI_API_KEY, apiKeys.value.gemini));
      console.log('  - Saving Gemini key');
    } else if (apiKeys.value.gemini === '') {
      promises.push(storeSecureValue(STORAGE_KEYS.GEMINI_API_KEY, ''));
      console.log('  - Clearing Gemini key');
    }

    // Save custom configuration for customized provider
    if (selectedProvider.value === 'customized') {
      const { storeValue } = await import('@/api/storageService');
      promises.push(storeValue(STORAGE_KEYS.CUSTOMIZED_CONFIG, JSON.stringify(customConfig.value)));
      console.log('  - Saving Customized provider configuration');
    }

    // Save model selections for built-in providers
    for (const provider of BUILTIN_PROVIDERS) {
      promises.push(modelSelectionStore.setSelections(provider, modelSelections.value[provider]));
    }
    console.log('  - Saving model selections');
    
    // Save all API keys first
    if (promises.length > 0) {
      await Promise.all(promises);
      console.log('✅ API keys saved successfully');
    } else {
      console.log('ℹ️ No API key changes to save');
    }
    
    // Step 2: Update provider selection (this will NOT trigger LLM service init yet)
    console.log('🔄 Updating provider selection...');
    llmConfigStore.selectedProvider = selectedProvider.value;
    localStorage.setItem('xnote-llm-provider', selectedProvider.value);
    
    // Step 3: Verify storage was updated correctly
    await checkStorage();
    
    // Step 4: Now safely reinitialize LLM service with the saved keys
    console.log('🚀 Reinitializing LLM service...');
    try {
      // Reinitialize LLM service with new keys
      const success = await llmConfigStore.reinitializeService();
      if (!success && !isDevelopment) {
        console.warn('LLM service reinitialization failed, but continuing anyway');
      }
    } catch (reinitError) {
      console.error('Failed to reinitialize LLM service:', reinitError);
      // In development mode, we can continue without a valid LLM service
      if (!isDevelopment) {
        throw reinitError; // Re-throw in production mode
      }
    }
    
    if (isDevelopment) {
      console.log('API keys saved in development mode. Note that you can use the app with mock responses even without valid API keys.');
    }
    
    showConfig.value = false;
  } catch (error) {
    console.error('Failed to save API keys:', error);
    
    // Show more specific error message in development mode
    if (window.location.hostname === 'localhost') {
      alert('There was a problem saving your API keys, but you can continue using the app in development mode with mock responses.');
    } else {
      alert('There was a problem saving your API keys. Please try again.');
    }
  }
};

const tabs = [
  { id: 'chat', name: 'Chat', icon: 'fas fa-comments' },
  { id: 'capture', name: 'Capture', icon: 'fas fa-camera' },
  { id: 'translate', name: 'Translate', icon: 'fas fa-language' },
  { id: 'summary', name: 'Summary', icon: 'fas fa-file-alt' },
  { id: 'links', name: 'Quick Links', icon: 'fas fa-link' },
  { id: 'transfer', name: 'Transfer', icon: 'fas fa-exchange-alt' },
];
</script>

<style>
@import url('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css');

.sidebar {
  width: 100%;
  height: 100vh;
  display: flex;
  background: #f8f9fa;
  overflow: hidden;
}

.nav-menu {
  width: 48px;
  background: rgba(103, 58, 183, 0.15);
  backdrop-filter: blur(8px);
  padding: 8px 0;
  position: relative;
  z-index: 1000;
  box-shadow: 1px 0 0 rgba(255, 255, 255, 0.8);
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.nav-item {
  padding: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(0, 0, 0, 0.8);
  position: relative;
  transition: all 0.2s ease;
  height: 48px;
  box-sizing: border-box;
  margin: 2px 0;
}

.nav-item.config-item {
  border: 0;
  margin-bottom: 0;
}

.nav-item:hover {
  background: rgba(195, 175, 229, 0.85);
  color: #ffffff;
}

.nav-item.active {
  color: #ffffff;
  background: rgba(156, 130, 202, 0.85);
  font-weight: 500;
}

.nav-item i {
  text-align: center;
  font-size: 16px;
  transition: color 0.2s ease;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-text {
  position: absolute;
  left: 100%;
  top: 0;
  padding: 8px 12px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(4px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  white-space: nowrap;
  opacity: 0;
  visibility: hidden;
  transition: all 0.15s ease;
  pointer-events: none;
  z-index: 1000;
  height: 32px;
  display: flex;
  align-items: center;
  transform: translateX(-8px);
  font-weight: 400;
  font-size: 12px;
  margin-top: 8px;
  color: rgba(0, 0, 0, 0.8);
}

.nav-item:hover .nav-text {
  opacity: 1;
  visibility: visible;
  transform: translateX(8px);
  display: flex;
  background: rgba(195, 175, 229, 1);
}

.content {
  flex: 1;
  padding: 8px;
  overflow-y: auto;
  height: 100%;
  background: #ffffff;
}

.nav-spacer {
  flex: 1;
}

.config-item {
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.config-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.config-content {
  background: white;
  padding: 24px;
  border-radius: 8px;
  width: 400px;
  max-width: 90vw;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.config-content h2 {
  font-size: 16px;
  margin-bottom: 16px;
  color: #333;
}

.provider-selection {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.provider-option {
  display: flex;
  align-items: center;
  padding: 12px;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.provider-option:hover {
  background: #f8f9fa;
  border-color: #adb5bd;
}

.provider-option.selected {
  background: rgba(103, 58, 183, 0.1);
  border-color: #673ab7;
}

.provider-option input[type="radio"] {
  margin-right: 12px;
}

.provider-option label {
  font-size: 14px;
  color: #495057;
  cursor: pointer;
  flex: 1;
}

.config-actions {
  display: flex;
  gap: 8px;
  margin-top: 24px;
  justify-content: flex-end;
}

.config-actions button {
  padding: 8px 16px;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s ease;
}

.config-actions button.save {
  background: #ba92ff;
  color: white;
  border-color: #ba92ff;
}

.config-actions button.save:hover {
  background: #a36dff;
}

.config-actions button.cancel {
  background: white;
  color: #495057;
}

.config-actions button.cancel:hover {
  background: #ff6464dc;
}

.api-key-section {
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid #ddd;
}

.api-key-section h3 {
  margin-bottom: 10px;
  font-size: 14px;
}

.api-key-info {
  background-color: #f0f8ff;
  padding: 5px 8px;
  border-radius: 3px;
  font-size: 11px;
  margin-bottom: 15px;
  display: flex;
  align-items: center;
}

.api-key-info i {
  margin-right: 5px;
  color: #2196f3;
}

/* Provider configuration warning */
.provider-config-warning {
  background-color: #fff3e0;
  border: 1px solid #ffb74d;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 12px;
  margin-bottom: 15px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #e65100;
}

.provider-config-warning i {
  color: #ff9800;
  flex-shrink: 0;
}

/* Customized Provider Configuration */
.customized-provider-config {
  margin-top: 10px;
}

.custom-url-section {
  margin-top: 15px;
}

.custom-url-section label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 5px;
  color: #333;
}

.custom-url-input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
  font-family: monospace;
  box-sizing: border-box;
}

.custom-url-input:focus {
  outline: none;
  border-color: #2196f3;
  box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.1);
}

.field-hint {
  font-size: 11px;
  color: #666;
  margin-top: 4px;
}

.capabilities-section {
  margin-top: 20px;
}

.capabilities-section h4 {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 12px;
  color: #333;
}

.capability-item {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
  gap: 10px;
  flex-wrap: wrap;
}

.capability-toggle {
  display: flex;
  align-items: center;
  min-width: 150px;
  font-size: 12px;
}

.capability-toggle input[type="checkbox"] {
  margin-right: 6px;
}

.model-input {
  flex: 1;
  min-width: 0;
  max-width: 100%;
  padding: 6px 8px;
  border: 1px solid #ddd;
  border-radius: 3px;
  font-size: 12px;
  font-family: monospace;
  box-sizing: border-box;
}

.model-input:focus {
  outline: none;
  border-color: #2196f3;
  box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.1);
}

/* Model selection rows (config modal) */
.ms-config {
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid #ddd;
}

.ms-field-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  font-weight: 600;
  color: #333;
  margin: 12px 0 5px;
}

.ms-field-label:first-child {
  margin-top: 0;
}

.ms-refresh {
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  border: none;
  background: transparent;
  color: #673ab7;
  border-radius: 4px;
  cursor: pointer;
  padding: 0;
}

.ms-refresh:hover {
  background: rgba(103, 58, 183, 0.12);
}

.ms-refresh:disabled {
  color: #adb5bd;
  cursor: default;
}

.ms-refresh:disabled:hover {
  background: transparent;
}

.ms-note {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 11.5px;
  border-radius: 4px;
  padding: 6px 8px;
  margin: 6px 0;
  line-height: 1.4;
}

.ms-note i {
  flex: none;
  margin-top: 1px;
}

.ms-note-err {
  background: #ffeaea;
  color: #c62828;
}

.ms-note-warn {
  background: #fff3cd;
  color: #8a6d1a;
}

.ms-note-info {
  background: #f0f8ff;
  color: #1565c0;
}

.ms-hint {
  font-size: 11px;
  color: #666;
  margin-top: 4px;
}

.ms-assist-row {
  margin: 10px 0 4px;
}

.ms-fetch-assist {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid #ba92ff;
  background: transparent;
  color: #673ab7;
  border-radius: 4px;
  font-size: 12px;
  padding: 5px 10px;
  cursor: pointer;
}

.ms-fetch-assist:hover:not(:disabled) {
  background: #ba92ff;
  color: #fff;
}

.ms-fetch-assist:disabled {
  opacity: 0.6;
  cursor: default;
}

.capability-item .ms-combo {
  flex: 1;
  min-width: 140px;
  margin-bottom: 0;
}

/* Google Drive Storage Section */
.storage-section {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 2px solid #e9ecef;
}

.storage-section h3 {
  font-size: 16px;
  margin-bottom: 15px;
  color: #333;
}

.google-drive-config {
  background: #f8f9fa;
  padding: 15px;
  border-radius: 8px;
  border: 1px solid #dee2e6;
}

.drive-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 15px;
  font-size: 14px;
  font-weight: 600;
  color: #495057;
}

.drive-header i {
  font-size: 20px;
  color: #4285f4;
}

.connection-status {
  margin-bottom: 15px;
  padding: 8px 12px;
  background: white;
  border-radius: 4px;
  display: inline-block;
}

.status-connected {
  color: #28a745;
  font-weight: 500;
}

.status-disconnected {
  color: #6c757d;
}

.connect-button {
  background: #4285f4;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: background 0.2s;
}

.connect-button:hover {
  background: #357ae8;
}

.sync-settings {
  margin-top: 15px;
}

.sync-toggle {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  font-size: 14px;
  margin-bottom: 15px;
}

.sync-toggle input[type="checkbox"] {
  cursor: pointer;
}

.last-sync {
  font-size: 12px;
  color: #6c757d;
  padding: 8px;
  background: white;
  border-radius: 4px;
}

.sync-actions {
  display: flex;
  gap: 10px;
}

.sync-button {
  background: #34a853;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: background 0.2s;
}

.sync-button:hover:not(:disabled) {
  background: #2d8e47;
}

.sync-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.disconnect-button {
  background: #dc3545;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: background 0.2s;
}

.disconnect-button:hover {
  background: #c82333;
}

/* Google Drive Sidebar Icon */
.nav-item.drive-item {
  position: relative;
}

.nav-item.drive-item .status-dot {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #6c757d;
  transition: all 0.2s ease;
}

.nav-item.drive-item .status-dot.connected {
  background: #4caf50;
}

.nav-item.drive-item .status-dot.syncing {
  background: #ffc107;
  animation: pulse 1s infinite;
}

.nav-item.drive-item .status-dot.error {
  background: #e03131;
}

@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.5; }
  100% { opacity: 1; }
}

/* Storage Modal - Following UI Standards */
.storage-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.storage-modal-content {
  background: #ffffff;
  border-radius: 8px;
  width: 480px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  background: rgba(103, 58, 183, 0.15);
  border-radius: 8px 8px 0 0;
}

.modal-header h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: #495057;
  display: flex;
  align-items: center;
  gap: 8px;
}

.modal-header h2 i {
  color: #673ab7;
}

.modal-close-btn {
  background: none;
  border: none;
  color: #6c757d;
  font-size: 16px;
  cursor: pointer;
  padding: 4px;
  transition: all 0.2s ease;
}

.modal-close-btn:hover {
  color: #495057;
}

/* Storage Sections */
.storage-section {
  padding: 8px 16px;
}

.storage-section.with-separator {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #ddd;
}

.section-title {
  font-size: 14px;
  font-weight: 500;
  color: #495057;
  margin: 0 0 8px 0;
}

/* Status Card */
.status-card {
  background: #f8f9fa;
  padding: 10px;
  border-radius: 4px;
}

.status-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.status-indicator {
  display: flex;
  align-items: center;
}

.status-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
}

.status-connected {
  background: #e8f5e8;
  color: #2e7d32;
}

.status-disconnected {
  background: #f5f5f5;
  color: #6c757d;
}

/* Buttons - Following UI Standards */
.button-primary {
  background: transparent;
  color: #673ab7;
  border: 1px solid #ba92ff;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s ease;
}

.button-primary:hover {
  background: #ba92ff;
  color: white;
}

.button-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.button-delete {
  background: #ffeaea;
  color: #d63384;
  border: 1px solid transparent;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s ease;
}

.button-delete:hover {
  background: #ffcccb;
}

/* Info Card */
.info-card {
  background: #f8f9fa;
  padding: 10px;
  border-radius: 4px;
}

.folder-location {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-size: 13px;
}

.location-label {
  font-weight: 500;
  color: #495057;
}

.location-path {
  color: #673ab7;
  background: rgba(103, 58, 183, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
}

.location-link {
  cursor: pointer;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s ease;
}

.location-link:hover {
  background: rgba(103, 58, 183, 0.2);
  color: #5e35b1;
}

.location-link i {
  font-size: 10px;
  opacity: 0.6;
}

.location-link:hover i {
  opacity: 1;
}

.sync-files {
  margin-top: 12px;
}

.sync-label {
  font-size: 13px;
  color: #6c757d;
  margin-bottom: 8px;
}

.file-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px;
  background: white;
  border-radius: 4px;
  font-size: 13px;
  color: #495057;
}

.file-item i {
  width: 16px;
  color: #673ab7;
}

.file-item span {
  flex: 1;
}

.file-item code {
  color: #6c757d;
  background: #f5f5f5;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 11px;
}

.auto-sync-toggle {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #dee2e6;
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 13px;
  color: #495057;
}

/* Sync Card */
.sync-card {
  background: #f8f9fa;
  padding: 10px;
  border-radius: 4px;
}

.sync-status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px;
  border-radius: 4px;
  margin-bottom: 12px;
  font-size: 13px;
}

.sync-status-success {
  background: #e8f5e8;
  color: #2e7d32;
}

.sync-status-error {
  background: #ffeaea;
  color: #e03131;
}

.sync-status-progress {
  background: #fff3cd;
  color: #495057;
}

.sync-button {
  width: 100%;
  justify-content: center;
  margin-top: 8px;
}

/* Animations */
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.fa-spin {
  animation: spin 1s linear infinite;
}

/* Folder Location Styles */
.location-card {
  background: #f8f9fa;
  padding: 12px;
  border-radius: 4px;
}

.current-location {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding: 6px;
  background: white;
  border-radius: 4px;
}

.current-location i {
  color: #673ab7;
}

.location-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.radio-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.radio-option:hover {
  background: rgba(103, 58, 183, 0.05);
}

.radio-option input[type="radio"] {
  cursor: pointer;
}

.radio-option span {
  font-size: 13px;
  color: #495057;
  cursor: pointer;
}

.picker-button {
  margin-bottom: 12px;
}

.selected-folder {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: #e8f5e8;
  border-radius: 4px;
  margin-bottom: 12px;
  font-size: 13px;
  color: #2e7d32;
}

.selected-folder i {
  color: #2e7d32;
}

.apply-button {
  width: 100%;
  justify-content: center;
  margin-bottom: 12px;
}

.location-info {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  background: #e3f2fd;
  border: 1px solid #90caf9;
  border-radius: 4px;
  font-size: 12px;
  color: #1565c0;
  margin-top: 12px;
}

.location-info i {
  color: #2196f3;
  margin-top: 2px;
  flex-shrink: 0;
}

.location-info span {
  line-height: 1.4;
}

.location-info strong {
  color: #1565c0;
}
</style>
