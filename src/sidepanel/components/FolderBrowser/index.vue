<template>
  <div class="folder-browser-overlay" @click.self="cancel">
    <div class="folder-browser-modal">
      <!-- Header with title -->
      <div class="browser-header">
        <h3>Select a Folder for XNote Storage</h3>
        <button class="close-btn" @click="cancel">
          <i class="fas fa-times"></i>
        </button>
      </div>

      <!-- Breadcrumb navigation -->
      <div class="breadcrumb">
        <span class="breadcrumb-item" @click="navigateToRoot()">
          <i class="fas fa-home"></i> My Drive
        </span>
        <span v-for="(folder, index) in breadcrumbPath" :key="folder.id">
          <i class="fas fa-chevron-right breadcrumb-separator"></i>
          <span class="breadcrumb-item" @click="navigateToBreadcrumb(index)">
            {{ folder.name }}
          </span>
        </span>
      </div>

      <!-- Search bar -->
      <div class="search-bar">
        <i class="fas fa-search"></i>
        <input
          v-model="searchTerm"
          @input="onSearchInput"
          type="text"
          placeholder="Search folders..."
          class="search-input"
        />
        <button v-if="searchTerm" @click="clearSearch" class="clear-search">
          <i class="fas fa-times"></i>
        </button>
      </div>

      <!-- Folder list -->
      <div class="folder-list">
        <!-- Loading state -->
        <div v-if="loading" class="loading-state">
          <i class="fas fa-spinner fa-spin"></i>
          <p>Loading folders...</p>
        </div>

        <!-- Empty state -->
        <div v-else-if="!loading && folders.length === 0" class="empty-state">
          <i class="fas fa-folder-open"></i>
          <p>{{ searchTerm ? 'No folders found' : 'No folders in this location' }}</p>
        </div>

        <!-- Folders grid -->
        <div v-else class="folders-grid">
          <div
            v-for="folder in folders"
            :key="folder.id"
            class="folder-item"
            :class="{ selected: selectedFolder?.id === folder.id }"
            @click="selectFolder(folder)"
            @dblclick="navigateToFolder(folder)"
          >
            <i class="fas fa-folder"></i>
            <span class="folder-name">{{ folder.name }}</span>
          </div>
        </div>

        <!-- Load more button -->
        <div v-if="hasMore && !loading" class="load-more">
          <button @click="loadMore" class="load-more-btn">
            Load More Folders
          </button>
        </div>
      </div>

      <!-- Selected folder info -->
      <div v-if="selectedFolder" class="selected-info">
        <i class="fas fa-folder"></i>
        <span>Selected: <strong>{{ selectedFolder.name }}</strong></span>
      </div>

      <!-- Action buttons -->
      <div class="browser-actions">
        <button @click="cancel" class="btn-cancel">
          Cancel
        </button>
        <button
          @click="confirmSelection"
          :disabled="!selectedFolder"
          class="btn-confirm"
        >
          <i class="fas fa-check"></i>
          Select This Folder
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { googleFolderBrowserService } from '@/api/googleFolderBrowserService';

// Props
const props = defineProps({
  initialFolderId: {
    type: String,
    default: null
  }
});

// Emits
const emit = defineEmits(['select', 'cancel']);

// State
const loading = ref(false);
const folders = ref([]);
const selectedFolder = ref(null);
const currentFolderId = ref('root');
const breadcrumbPath = ref([]);
const searchTerm = ref('');
const searchTimeout = ref(null);
const nextPageToken = ref(null);
const hasMore = computed(() => !!nextPageToken.value);

// Methods
async function loadFolders(folderId = 'root', append = false) {
  loading.value = true;
  try {
    const pageToken = append ? nextPageToken.value : null;
    const result = await googleFolderBrowserService.listFolders(folderId, pageToken);

    if (append) {
      folders.value.push(...result.files);
    } else {
      folders.value = result.files || [];
    }

    nextPageToken.value = result.nextPageToken || null;
    currentFolderId.value = folderId;

    // Update breadcrumb if not appending
    if (!append && folderId !== 'root') {
      breadcrumbPath.value = await googleFolderBrowserService.buildFolderPath(folderId);
    } else if (!append && folderId === 'root') {
      breadcrumbPath.value = [];
    }
  } catch (error) {
    console.error('Error loading folders:', error);
    folders.value = [];
  } finally {
    loading.value = false;
  }
}

async function navigateToFolder(folder) {
  selectedFolder.value = null;
  await loadFolders(folder.id);
}

async function navigateToRoot() {
  selectedFolder.value = null;
  breadcrumbPath.value = [];
  await loadFolders('root');
}

async function navigateToBreadcrumb(index) {
  const targetFolder = breadcrumbPath.value[index];
  breadcrumbPath.value = breadcrumbPath.value.slice(0, index);
  selectedFolder.value = null;
  await loadFolders(targetFolder.id);
}

function selectFolder(folder) {
  selectedFolder.value = folder;
}

async function confirmSelection() {
  if (selectedFolder.value) {
    // Build the full path for the selected folder
    const fullPath = await googleFolderBrowserService.buildFolderPath(selectedFolder.value.id);
    const pathString = fullPath.map(f => f.name).join(' / ');

    emit('select', {
      id: selectedFolder.value.id,
      name: selectedFolder.value.name,
      path: pathString || selectedFolder.value.name
    });
  }
}

function cancel() {
  emit('cancel');
}

async function onSearchInput() {
  // Clear previous timeout
  if (searchTimeout.value) {
    clearTimeout(searchTimeout.value);
  }

  // Debounce search
  searchTimeout.value = setTimeout(async () => {
    if (searchTerm.value.trim()) {
      loading.value = true;
      try {
        const result = await googleFolderBrowserService.searchFolders(
          searchTerm.value,
          currentFolderId.value
        );
        folders.value = result.files || [];
        nextPageToken.value = null; // Search doesn't support pagination in this implementation
      } catch (error) {
        console.error('Error searching folders:', error);
        folders.value = [];
      } finally {
        loading.value = false;
      }
    } else {
      // If search is cleared, reload current folder
      await loadFolders(currentFolderId.value);
    }
  }, 300);
}

function clearSearch() {
  searchTerm.value = '';
  loadFolders(currentFolderId.value);
}

async function loadMore() {
  if (hasMore.value && !loading.value) {
    await loadFolders(currentFolderId.value, true);
  }
}

// Lifecycle
onMounted(() => {
  // Load initial folder
  if (props.initialFolderId) {
    loadFolders(props.initialFolderId);
  } else {
    loadFolders('root');
  }
});

// Keyboard navigation
function handleKeyPress(event) {
  if (event.key === 'Escape') {
    cancel();
  } else if (event.key === 'Enter' && selectedFolder.value) {
    confirmSelection();
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeyPress);
});

// Clean up
onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyPress);
});
</script>

<style scoped>
.folder-browser-overlay {
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
  backdrop-filter: blur(2px);
}

.folder-browser-modal {
  width: 650px;
  max-width: 90vw;
  max-height: 80vh;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Header */
.browser-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: linear-gradient(135deg, #8e72be 0%, #ba79d5 100%);
  color: white;
}

.browser-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
}

.close-btn {
  background: none;
  border: none;
  color: white;
  font-size: 18px;
  cursor: pointer;
  padding: 4px;
  opacity: 0.8;
  transition: opacity 0.2s;
}

.close-btn:hover {
  opacity: 1;
}

/* Breadcrumb */
.breadcrumb {
  padding: 12px 20px;
  background: #f8f9fa;
  border-bottom: 1px solid #dee2e6;
  display: flex;
  align-items: center;
  gap: 8px;
  overflow-x: auto;
  white-space: nowrap;
}

.breadcrumb-item {
  color: #673ab7;
  cursor: pointer;
  font-size: 13px;
  transition: color 0.2s;
}

.breadcrumb-item:hover {
  color: #8e44ad;
  text-decoration: underline;
}

.breadcrumb-separator {
  color: #adb5bd;
  font-size: 10px;
}

/* Search bar */
.search-bar {
  padding: 12px 20px;
  border-bottom: 1px solid #dee2e6;
  display: flex;
  align-items: center;
  gap: 8px;
  background: white;
}

.search-bar i {
  color: #6c757d;
}

.search-input {
  flex: 1;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  padding: 6px 12px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}

.search-input:focus {
  border-color: #673ab7;
}

.clear-search {
  background: none;
  border: none;
  color: #6c757d;
  cursor: pointer;
  padding: 4px;
}

/* Folder list */
.folder-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  background: #fafafa;
  min-height: 300px;
}

.folders-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 12px;
}

.folder-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 8px;
  background: white;
  border: 2px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
}

.folder-item:hover {
  background: #f0f0f0;
  transform: translateY(-2px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.folder-item.selected {
  background: #ede7f6;
  border-color: #673ab7;
}

.folder-item i {
  font-size: 32px;
  color: #ffc107;
  margin-bottom: 8px;
}

.folder-name {
  font-size: 12px;
  color: #495057;
  word-break: break-word;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

/* States */
.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: #6c757d;
}

.loading-state i,
.empty-state i {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.loading-state p,
.empty-state p {
  margin: 0;
  font-size: 14px;
}

/* Load more */
.load-more {
  display: flex;
  justify-content: center;
  padding: 16px;
}

.load-more-btn {
  padding: 8px 16px;
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  color: #673ab7;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}

.load-more-btn:hover {
  background: #f8f9fa;
  border-color: #673ab7;
}

/* Selected info */
.selected-info {
  padding: 12px 20px;
  background: #e8f5e8;
  border-top: 1px solid #c3e6c3;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #2e7d32;
}

.selected-info i {
  color: #4caf50;
}

/* Actions */
.browser-actions {
  padding: 16px 20px;
  background: white;
  border-top: 1px solid #dee2e6;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.btn-cancel,
.btn-confirm {
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
}

.btn-cancel {
  background: white;
  border-color: #dee2e6;
  color: #6c757d;
}

.btn-cancel:hover {
  background: #f8f9fa;
  border-color: #adb5bd;
}

.btn-confirm {
  background: linear-gradient(135deg, #8e72be 0%, #ba79d5 100%);
  color: white;
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn-confirm:hover:not(:disabled) {
  box-shadow: 0 2px 8px rgba(103, 58, 183, 0.3);
  transform: translateY(-1px);
}

.btn-confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Scrollbar styling */
.folder-list::-webkit-scrollbar {
  width: 8px;
}

.folder-list::-webkit-scrollbar-track {
  background: #f1f1f1;
}

.folder-list::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 4px;
}

.folder-list::-webkit-scrollbar-thumb:hover {
  background: #555;
}
</style>