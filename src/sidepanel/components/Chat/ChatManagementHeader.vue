<template>
  <div class="chat-management-header">
    <div class="header-left">
      <span class="current-chat-info" v-if="activeChat">
        <i class="fas fa-comment-dots active-indicator"></i>
        <span class="chat-title" @click="showTitleEdit = true">
          {{ activeChat.title }}
        </span>
      </span>
      <span class="no-chat-info" v-else>
        <i class="fas fa-comment-slash"></i>
        No active chat
      </span>
    </div>

    <div class="header-actions">
      <!-- New Chat Button -->
      <button
        @click="createNewChat"
        class="action-button new-chat-btn"
        title="Create new chat"
      >
        <i class="fas fa-plus"></i>
        <span class="btn-text">New Chat</span>
      </button>

      <!-- Chat History Button -->
      <button
        @click="showHistory = true"
        class="action-button history-btn"
        title="View chat history"
      >
        <i class="fas fa-history"></i>
        <span class="btn-text">History</span>
        <span v-if="chatCount > 0" class="badge">{{ chatCount }}</span>
      </button>

      <!-- Google Drive Upload -->
      <button
        v-if="canUploadToDrive"
        @click="uploadToGoogleDrive"
        class="action-button drive-btn"
        :class="{ uploaded: isUploaded }"
        :title="isUploaded ? 'Already uploaded to Google Drive' : 'Upload to Google Drive'"
      >
        <i :class="isUploading ? 'fas fa-spinner fa-spin' : 'fab fa-google-drive'"></i>
        <span class="btn-text">{{ isUploaded ? 'Uploaded' : 'Upload' }}</span>
      </button>
    </div>

    <!-- Chat History Modal -->
    <ChatHistoryList
      :show="showHistory"
      @close="showHistory = false"
      @chat-loaded="handleChatLoaded"
    />

    <!-- Title Edit Dialog -->
    <div v-if="showTitleEdit && activeChat" class="title-edit-overlay" @click.self="showTitleEdit = false">
      <div class="title-edit-dialog">
        <h3>Edit Chat Title</h3>
        <input
          v-model="newTitle"
          @keyup.enter="saveTitleEdit"
          @keyup.esc="showTitleEdit = false"
          class="title-edit-input"
          placeholder="Enter chat title..."
          ref="titleEditInput"
        >
        <div class="dialog-actions">
          <button @click="showTitleEdit = false" class="cancel-btn">Cancel</button>
          <button @click="saveTitleEdit" class="save-btn">Save</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import chatHistory from '@/stores/chatHistory'
import ChatHistoryList from './ChatHistoryList.vue'
import { useGoogleDrive } from '@/sidepanel/composables/useGoogleDrive'
import { useDriveMappings } from '@/stores/driveMappings'

const emit = defineEmits(['new-chat', 'chat-loaded'])

// State
const showHistory = ref(false)
const showTitleEdit = ref(false)
const newTitle = ref('')
const isUploading = ref(false)

// Google Drive composable
const googleDrive = useGoogleDrive()

// Drive mappings store
const driveMappings = useDriveMappings()

// Computed properties
const activeChat = computed(() => chatHistory.state.activeChat)
const chatCount = computed(() => chatHistory.state.chats.length)

const canUploadToDrive = computed(() => {
  return googleDrive.isConnected.value &&
         activeChat.value &&
         activeChat.value.messages.length > 0
})

const isUploaded = computed(() => {
  if (!activeChat.value) return false
  // Check if this chat has been uploaded to Google Drive
  const chats = driveMappings.currentChats
  return chats && !!chats[activeChat.value.id]
})

// Watch for title edit dialog
watch(showTitleEdit, (show) => {
  if (show && activeChat.value) {
    newTitle.value = activeChat.value.title
    nextTick(() => {
      const input = document.querySelector('.title-edit-input')
      if (input) {
        input.focus()
        input.select()
      }
    })
  }
})

// Create new chat
const createNewChat = async () => {
  try {
    const newChat = await chatHistory.createNewChat()
    emit('new-chat', newChat)
  } catch (error) {
    console.error('Error creating new chat:', error)
    alert('Failed to create new chat')
  }
}

// Handle chat loaded from history
const handleChatLoaded = (chatId) => {
  emit('chat-loaded', chatId)
}

// Save title edit
const saveTitleEdit = async () => {
  if (newTitle.value.trim() && activeChat.value) {
    try {
      await chatHistory.updateChatTitle(activeChat.value.id, newTitle.value.trim())
      showTitleEdit.value = false
    } catch (error) {
      console.error('Error updating title:', error)
      alert('Failed to update title')
    }
  }
}

// Upload to Google Drive
const uploadToGoogleDrive = async () => {
  // Additional validation check
  if (!canUploadToDrive.value) {
    console.warn('Cannot upload to Google Drive: not connected or no active chat')
    return
  }

  isUploading.value = true
  try {
    // Format chat data for export
    const chatData = {
      title: activeChat.value.title,
      messages: activeChat.value.messages,
      chatId: activeChat.value.id,
      createdAt: activeChat.value.createdAt,
      updatedAt: activeChat.value.updatedAt
    }

    // Use the composable's upload method with built-in validation
    const fileId = await googleDrive.uploadChat(chatData)

    if (fileId) {
      // Save mapping using the new saveChatMapping method
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const chatTitle = activeChat.value.title.replace(/[^a-z0-9]/gi, '_');
      const fileName = `${chatTitle}_${timestamp}.md`;

      await driveMappings.saveChatMapping(activeChat.value.id, {
        driveFileId: fileId,
        fileName: fileName,
        uploadedAt: new Date().toISOString()
      })
    }
  } catch (error) {
    console.error('Error uploading to Google Drive:', error)
    // Error is already shown by the composable
  } finally {
    isUploading.value = false
  }
}

// Initialize on mount
onMounted(async () => {
  // Initialize chat history if not already loaded
  if (chatHistory.state.chats.length === 0 && !chatHistory.state.isLoading) {
    await chatHistory.init()
  }
})
</script>

<style scoped>
.chat-management-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
  min-height: 48px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.current-chat-info {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #1f2937;
  font-size: 0.95rem;
}

.active-indicator {
  color: #10b981;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.chat-title {
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 300px;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background 0.2s;
}

.chat-title:hover {
  background: #e5e7eb;
}

.no-chat-info {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #9ca3af;
  font-size: 0.9rem;
  font-style: italic;
}

.header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.action-button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid #e5e7eb;
  background: white;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
  transition: all 0.2s;
  color: #4b5563;
  position: relative;
}

.action-button:hover {
  background: #f3f4f6;
  border-color: #d1d5db;
}

.new-chat-btn {
  color: #3b82f6;
  border-color: #3b82f6;
}

.new-chat-btn:hover {
  background: #eff6ff;
  border-color: #2563eb;
}

.history-btn {
  color: #8b5cf6;
  border-color: #8b5cf6;
}

.history-btn:hover {
  background: #f3e8ff;
  border-color: #7c3aed;
}

.drive-btn {
  color: #10b981;
  border-color: #10b981;
}

.drive-btn:hover {
  background: #ecfdf5;
  border-color: #059669;
}

.drive-btn.uploaded {
  background: #ecfdf5;
  color: #059669;
}

.badge {
  position: absolute;
  top: -6px;
  right: -6px;
  background: #8b5cf6;
  color: white;
  border-radius: 10px;
  padding: 2px 6px;
  font-size: 0.7rem;
  font-weight: bold;
  min-width: 18px;
  text-align: center;
}

.btn-text {
  font-weight: 500;
}

/* Title Edit Dialog */
.title-edit-overlay {
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
}

.title-edit-dialog {
  background: white;
  border-radius: 8px;
  padding: 20px;
  width: 90%;
  max-width: 400px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}

.title-edit-dialog h3 {
  margin: 0 0 16px 0;
  color: #1f2937;
  font-size: 1.1rem;
}

.title-edit-input {
  width: 100%;
  padding: 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 1rem;
  margin-bottom: 16px;
}

.title-edit-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.cancel-btn,
.save-btn {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.cancel-btn {
  background: #f3f4f6;
  color: #4b5563;
}

.cancel-btn:hover {
  background: #e5e7eb;
}

.save-btn {
  background: #3b82f6;
  color: white;
}

.save-btn:hover {
  background: #2563eb;
}

/* Upload success toast */
:global(.upload-success-toast) {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: #10b981;
  color: white;
  padding: 12px 20px;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  animation: slideInUp 0.3s ease;
  z-index: 3000;
}

@keyframes slideInUp {
  from {
    transform: translateY(100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

/* Responsive adjustments */
@media (max-width: 600px) {
  .btn-text {
    display: none;
  }

  .chat-title {
    max-width: 150px;
  }

  .action-button {
    padding: 6px 10px;
  }
}
</style>