<template>
  <div class="page-container">
    <div class="header">
      <div class="header-left">
        <h1>Summary</h1>
        <button class="language-toggle" @click="toggleLanguage">
          <span :class="{ active: selectedLanguage === 'English' }">EN</span>
          <span class="separator">/</span>
          <span :class="{ active: selectedLanguage === 'Chinese' }">中</span>
        </button>
        <button
          class="action-btn regenerate-btn"
          @click="regenerateSummary"
          title="Generate/Regenerate summary"
        >
          <i class="fas fa-sync" :class="{ 'fa-spin': isRegenerating }"></i>
        </button>
      </div>
      <div class="header-actions">
        <button
          v-if="currentPage?.summary"
          class="action-btn"
          :class="{ 'active': isFavorite }"
          @click="toggleFavorite"
        >
          <i class="fas" :class="isFavorite ? 'fa-star' : 'fa-regular fa-star'"></i>
        </button>
        <button
          v-if="isGoogleDriveConnected && currentPage?.summary"
          class="action-btn"
          :class="{ 'uploaded': isUploadedToDrive }"
          @click="saveToGoogleDrive"
          :title="uploadTooltip"
        >
          <i class="fas fa-cloud-upload-alt"></i>
        </button>
        <button class="action-btn" @click="showFavorites = true">
          <i class="fas fa-bookmark"></i>
        </button>
      </div>
    </div>
    <div class="summary-container">
      <div v-if="currentPage" class="page-info">
        <h2>{{ currentPage.title }}</h2>
        <a :href="currentPage.url" target="_blank" class="page-link">
          <i class="fas fa-external-link-alt"></i>
          {{ currentPage.url }}
          <i v-if="isFavorite" class="fas fa-star favorite-indicator"></i>
        </a>
      </div>
      
      <div class="summary-content">
        <div v-if="isStreaming" class="streaming-content">
          <Markdown :source="streamingContent" :options="markdownOptions" />
          <div class="typing-indicator">
            <span></span><span></span><span></span>
          </div>
        </div>
        <div v-else-if="currentPage?.summary" class="summary-text">
          <Markdown :source="currentPage.summary" :options="markdownOptions" />
        </div>
        <div v-else class="empty-state">
          Right click on any webpage and select "Summary Page" to generate a summary
        </div>
      </div>
    </div>
    <FavoritesList
      :show="showFavorites"
      @close="showFavorites = false"
      @select="handleFavoriteSelect"
    />
    <CategoryConfirmDialog
      :show="showCategoryDialog"
      :suggested-category="suggestedCategory"
      :existing-folder="existingFolder"
      :page-data="currentPage"
      @confirm="handleCategoryConfirm"
      @cancel="showCategoryDialog = false"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import Markdown from 'vue3-markdown-it';
import { createSummaryPrompt, streamSummary } from './summarizer';
import useNavigationStore from '@/stores/navigation';
import useFavoritesStore from '@/stores/favorites';
import FavoritesList from './FavoritesList.vue';
import CategoryConfirmDialog from './CategoryConfirmDialog.vue';
import { useLLMConfigStore } from '@/stores/llmConfig';
import { useGoogleDrive } from '@/sidepanel/composables/useGoogleDrive';
import { useDriveMappings } from '@/stores/driveMappings';
import { extractCategoryFromSummary, generateCategoryForPage } from './categoryExtractor';
import { googleDriveService } from '@/api/googleDriveService';

const SUMMARY_STORAGE_KEY = 'xnote-summaries';
const navigationStore = useNavigationStore();
const favoritesStore = useFavoritesStore();
const llmConfigStore = useLLMConfigStore();

// Initialize Google Drive composable and stores
const googleDrive = useGoogleDrive();
const mappingsStore = useDriveMappings();

const currentPage = ref(null);
const isStreaming = ref(false);
const streamingContent = ref('');
const showFavorites = ref(false);
const showCategoryDialog = ref(false);
const suggestedCategory = ref({ mainCategory: '', subCategory: '' });
const existingFolder = ref(null);
const isRegenerating = ref(false);

// Language state management
const LANGUAGE_STORAGE_KEY = 'xnote-summary-language';
const selectedLanguage = ref('English');

// Load saved language preference
const loadLanguagePreference = () => {
  const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (saved === 'Chinese' || saved === 'English') {
    selectedLanguage.value = saved;
  }
};

// Toggle language and save preference
const toggleLanguage = () => {
  selectedLanguage.value = selectedLanguage.value === 'English' ? 'Chinese' : 'English';
  localStorage.setItem(LANGUAGE_STORAGE_KEY, selectedLanguage.value);
};

// Regenerate summary for current page
const regenerateSummary = async () => {
  if (!currentPage.value) {
    // Try to get content from current active tab
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (tabs[0]) {
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          func: () => {
            return {
              content: document.body.innerText,
              title: document.title,
              url: window.location.href
            };
          }
        }, async (results) => {
          if (results && results[0]?.result) {
            isRegenerating.value = true;
            await handleSummaryRequest(results[0].result);
            isRegenerating.value = false;
          }
        });
      }
    });
    return;
  }

  // If we have currentPage with content, regenerate
  if (currentPage.value.content) {
    isRegenerating.value = true;
    await handleSummaryRequest(currentPage.value);
    isRegenerating.value = false;
  } else {
    // If no content stored, try to get from active tab
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (tabs[0] && tabs[0].url === currentPage.value.url) {
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          func: () => {
            return {
              content: document.body.innerText,
              title: document.title,
              url: window.location.href
            };
          }
        }, async (results) => {
          if (results && results[0]?.result) {
            isRegenerating.value = true;
            await handleSummaryRequest(results[0].result);
            isRegenerating.value = false;
          }
        });
      } else {
        alert('Please navigate to the original webpage to regenerate the summary');
      }
    });
  }
};

// Use computed to safely access Google Drive connection state
const isGoogleDriveConnected = computed(() => {
  return googleDrive.isConnected.value;
});

const markdownOptions = {
  html: true,
  linkify: true,
  typographer: true,
  breaks: false
};

// Helper function to get user-friendly error messages
const getErrorMessage = (error) => {
  const errorMessage = error?.message || String(error) || '';
  const errorString = errorMessage.toLowerCase();
  
  // Check for API key related errors
  if (errorString.includes('unauthorized') || 
      errorString.includes('401') ||
      errorString.includes('authentication fails') ||
      errorString.includes('api key') ||
      errorString.includes('invalid key') ||
      errorString.includes('invalid') && errorString.includes('key')) {
    
    const currentProvider = llmConfigStore.selectedProvider;
    const providerName = currentProvider ? 
      (currentProvider.charAt(0).toUpperCase() + currentProvider.slice(1)) : 'LLM';
    
    return `❌ **API Key Error**

Your ${providerName} API key appears to be invalid or missing.

**To fix this:**
1. Click the **⚙️ LLM Config** button at the bottom of the sidebar
2. Enter a valid ${providerName} API key
3. Click **Save** to update your configuration
4. Try generating the summary again

If you don't have an API key, you'll need to get one from the ${providerName} website.`;
  }
  
  // Check for network errors
  if (errorString.includes('network') || 
      errorString.includes('fetch') ||
      errorString.includes('connection')) {
    return `🌐 **Network Error**

Unable to connect to the AI service. Please check your internet connection and try again.`;
  }
  
  // Check for provider not configured
  if (errorString.includes('no llm provider') || 
      errorString.includes('provider not found') ||
      errorString.includes('provider selected')) {
    return `⚙️ **Configuration Required**

No LLM provider is configured. Please:
1. Click the **⚙️ LLM Config** button at the bottom of the sidebar
2. Select a provider (OpenAI, Gemini, or DeepSeek)
3. Enter your API key
4. Click **Save** to complete setup`;
  }
  
  // Generic error fallback
  return `❌ **Error generating summary**

${errorMessage}

Please try again or check your LLM configuration in the settings.`;
};

// Load summaries from storage
const loadSummaries = () => {
  try {
    const saved = localStorage.getItem(SUMMARY_STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch (error) {
    console.error('Error loading summaries:', error);
    return {};
  }
};

// Save summaries to storage
const saveSummary = (pageData) => {
  try {
    const summaries = loadSummaries();
    summaries[pageData.url] = pageData;
    localStorage.setItem(SUMMARY_STORAGE_KEY, JSON.stringify(summaries));
  } catch (error) {
    console.error('Error saving summary:', error);
  }
};

// Handle summary request
const handleSummaryRequest = async (pageData) => {
  currentPage.value = {
    url: pageData.url,
    title: pageData.title,
    content: pageData.content // Store content for potential regeneration
  };

  isStreaming.value = true;
  streamingContent.value = '';

  try {
    const messages = createSummaryPrompt(pageData, selectedLanguage.value);
    if (!llmConfigStore.selectedProvider) {
      throw new Error('No LLM provider selected');
    }

    await streamSummary(
      messages,
      // Handle chunks
      async (chunk) => {
        streamingContent.value += chunk;
      },
      // Handle completion
      async (fullResponse) => {
        currentPage.value.summary = fullResponse;
        saveSummary(currentPage.value);
        isStreaming.value = false;
      },
      // Handle errors
      async (error) => {
        console.error('Error generating summary:', error);
        isStreaming.value = false;
        streamingContent.value = getErrorMessage(error);
      }
    );
  } catch (error) {
    console.error('Error in summary generation:', error);
    isStreaming.value = false;
    streamingContent.value = getErrorMessage(error);
  }
};

const handleFavoriteSelect = (favorite) => {
  currentPage.value = {
    title: favorite.title,
    url: favorite.url,
    summary: favorite.summary
  };
};

// Message listener for content script communication
const messageListener = async (request, sender, sendResponse) => {
  if (request.action === 'summarizePage') {
    navigationStore.setActiveTab('summary');
    await handleSummaryRequest(request.data);
    if (sendResponse) {
      sendResponse({ success: true });
    }
  }
};

const isFavorite = computed(() => {
  return favoritesStore.state.favorites.some(
    f => f.url === currentPage.value?.url
  );
});

const isUploadedToDrive = computed(() => {
  if (!mappingsStore || !currentPage.value?.url) return false;
  return mappingsStore.isUrlUploaded(currentPage.value.url);
});

const uploadStatus = computed(() => {
  if (!mappingsStore || !currentPage.value?.url) return null;
  return mappingsStore.getUploadStatusForUrl(currentPage.value.url);
});

const uploadTooltip = computed(() => {
  if (!uploadStatus.value) return 'Upload to Google Drive';

  const uploadedAt = new Date(uploadStatus.value.uploadedAt);
  const lastUpdatedAt = new Date(uploadStatus.value.lastUpdatedAt);

  if (uploadedAt.getTime() === lastUpdatedAt.getTime()) {
    return `✓ Uploaded to Google Drive on ${uploadedAt.toLocaleDateString()} at ${uploadedAt.toLocaleTimeString()}`;
  } else {
    return `✓ Updated in Google Drive on ${lastUpdatedAt.toLocaleDateString()} at ${lastUpdatedAt.toLocaleTimeString()}`;
  }
});

const toggleFavorite = async () => {
  if (!currentPage.value?.summary) return;

  try {
    if (isFavorite.value) {
      const favorite = favoritesStore.state.favorites.find(
        f => f.url === currentPage.value.url
      );
      if (favorite) {
        await favoritesStore.removeFavorite(favorite.id);
      }
    } else {
      await favoritesStore.addFavorite({
        title: currentPage.value.title,
        url: currentPage.value.url,
        summary: currentPage.value.summary
      });
    }
  } catch (error) {
    console.error('Error toggling favorite:', error);
  }
};

// Save to Google Drive handler
const saveToGoogleDrive = async () => {
  if (!currentPage.value?.summary) return;

  // Check if connected to Google Drive
  if (!googleDrive.isConnected.value) {
    console.warn('Not connected to Google Drive');
    alert('Please connect to Google Drive first.');
    return;
  }

  try {
    // First try to extract category from summary
    let category = extractCategoryFromSummary(currentPage.value.summary);

    // If not found in summary, generate it
    if (!category) {
      category = await generateCategoryForPage(currentPage.value);
    }

    suggestedCategory.value = category;

    // Check for existing mapping
    const existingMapping = mappingsStore.getFolderForUrl(currentPage.value.url);
    if (existingMapping) {
      existingFolder.value = existingMapping;
      suggestedCategory.value = {
        mainCategory: existingMapping.main,
        subCategory: existingMapping.sub
      };
    } else {
      existingFolder.value = null;
    }

    showCategoryDialog.value = true;
  } catch (error) {
    console.error('Error preparing save:', error);
    alert('Failed to prepare save: ' + error.message);
  }
};

// Handle category confirmation
const handleCategoryConfirm = async (category) => {
  showCategoryDialog.value = false;

  // Check if stores are initialized
  if (!mappingsStore) {
    console.error('Mappings store not initialized');
    return;
  }

  try {
    // Get existing file ID if this URL was saved before
    const existingFileId = mappingsStore.getFileIdForUrl(currentPage.value.url);

    const result = await googleDriveService.exportSummaryToCategory({
      title: currentPage.value.title,
      url: currentPage.value.url,
      content: currentPage.value.summary,
      timestamp: new Date().toISOString(),
      existingFileId
    }, category.mainCategory, category.subCategory);

    // Save mappings
    await mappingsStore.saveFolderMapping(
      currentPage.value.url,
      category.mainCategory,
      category.subCategory,
      result.folderId
    );
    await mappingsStore.saveFileMapping(currentPage.value.url, result.fileId);

    // Save upload status (isUpdate will be true if existingFileId exists)
    await mappingsStore.saveUploadStatus(currentPage.value.url, !!existingFileId);

    // Show success message (you can replace this with a better notification system)
    alert(`Summary saved to Google Drive: ${category.mainCategory} > ${category.subCategory}`);
  } catch (error) {
    console.error('Failed to save to Google Drive:', error);
    alert('Failed to save to Google Drive: ' + error.message);
  }
};

onMounted(async () => {
  // Load language preference
  loadLanguagePreference();

  // Load mappings if store is initialized
  if (mappingsStore) {
    try {
      await mappingsStore.loadMappings();
    } catch (error) {
      console.warn('Failed to load mappings:', error);
    }
  }

  if (chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener(messageListener);
  }
  // Load existing favorites
  favoritesStore.loadFavorites();
});

onUnmounted(() => {
  if (chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.removeListener(messageListener);
  }
});
</script>

<style scoped>
.summary-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow: hidden;
}

.page-info {
  padding: 8px;
  background: #ffffff;
  border-radius: 4px;
  border: 1px solid #dee2e6;
}

.page-info h2 {
  font-size: 14px;
  margin-bottom: 4px;
}

.page-link {
  font-size: 11px;
  color: #6c757d;
  text-decoration: none;
  display: flex;
  align-items: center;
  gap: 4px;
}

.page-link:hover {
  color: #495057;
}

.summary-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  background: #ffffff;
  border-radius: 4px;
  border: 1px solid #dee2e6;
  font-size: 14px;
  line-height: 1.5;
}

.empty-state {
  color: #6c757d;
  text-align: center;
  padding: 16px;
  font-size: 14px;
}

.typing-indicator {
  display: flex;
  gap: 4px;
  padding: 4px 0;
}

.typing-indicator span {
  width: 6px;
  height: 6px;
  background-color: #9e9e9e;
  border-radius: 50%;
  animation: typing 1s infinite;
}

.typing-indicator span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-indicator span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-4px);
  }
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.language-toggle {
  background: #ffffff;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 4px 8px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 1px;
}

.language-toggle:hover {
  background: #e7dafd;
  border-color: #ba92ff;
  transform: scale(1.05);
}

.language-toggle span {
  transition: all 0.2s ease;
}

.language-toggle span.active {
  color: #007bff;
  font-weight: 600;
}

.language-toggle span:not(.active) {
  color: #6c757d;
}

.language-toggle .separator {
  color: #adb5bd;
  margin: 0 2px;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  background: none;
  border: none;
  color: #6c757d;
  cursor: pointer;
  padding: 4px;
  font-size: 13px;
}

.action-btn:hover {
  color: #495057;
}

.regenerate-btn {
  margin-left: 2px;
  color: #10b981;
}

.regenerate-btn .fa-spin {
  animation: fa-spin 1s infinite linear;
}

@keyframes fa-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.action-btn.active {
  color: #ffc107;
}

.action-btn.uploaded {
  color: #28a745 !important;
}

.action-btn.uploaded i {
  color: #28a745 !important;
}

.action-btn.uploaded:hover {
  color: #218838 !important;
}

.action-btn.uploaded:hover i {
  color: #218838 !important;
}

.action-btn:hover:not(.active):not(.uploaded) {
  color: #ffc107;
  opacity: 0.7;
}

.favorite-indicator {
  color: #ffc107;
  margin-left: 4px;
  font-size: 10px;
}

/* Markdown content styles */
.summary-text :deep(p),
.streaming-content :deep(p) {
  margin: 8px 0;
  font-size: 14px;
  line-height: 1.5;
}

.summary-text :deep(ul),
.summary-text :deep(ol),
.streaming-content :deep(ul),
.streaming-content :deep(ol) {
  font-size: 14px;
  line-height: 1.5;
  margin: 8px 0;
  padding-left: 24px;
}
</style>