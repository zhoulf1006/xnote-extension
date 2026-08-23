<template>
  <div class="chat-history-modal" v-if="show" @click.self="$emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <h2>Chat History</h2>
        <button class="close-btn" @click="$emit('close')">×</button>
      </div>

      <div class="search-bar">
        <input
          type="text"
          v-model="searchQuery"
          placeholder="Search chats..."
          class="search-input"
        >
        <i class="fas fa-search search-icon"></i>
      </div>

      <div class="chat-stats" v-if="stats.totalChats > 0">
        <span>{{ stats.totalChats }} chats</span>
        <span class="separator">•</span>
        <span>{{ stats.totalMessages }} messages</span>
      </div>

      <div class="chat-list" v-if="filteredChats.length > 0">
        <div
          v-for="chat in filteredChats"
          :key="chat.id"
          class="chat-item"
          :class="{ active: chat.isActive }"
        >
          <div class="chat-info">
            <div class="chat-title-row">
              <input
                v-if="editingChatId === chat.id"
                v-model="editingTitle"
                @keyup.enter="saveTitle(chat.id)"
                @keyup.esc="cancelEdit"
                @blur="saveTitle(chat.id)"
                class="title-input"
                ref="titleInput"
              >
              <h3 v-else class="chat-title" @dblclick="startEdit(chat)">
                {{ chat.title }}
                <span v-if="chat.isActive" class="active-badge">Active</span>
              </h3>
            </div>
            <div class="chat-meta">
              <span class="chat-date">
                <i class="far fa-calendar"></i>
                {{ formatDate(chat.createdAt) }}
              </span>
              <span class="chat-messages">
                <i class="far fa-comment"></i>
                {{ chat.messages.length }} messages
              </span>
              <span class="chat-updated">
                <i class="far fa-clock"></i>
                Updated {{ formatRelativeTime(chat.updatedAt) }}
              </span>
            </div>
          </div>
          <div class="chat-actions">
            <button
              v-if="!chat.isActive"
              @click="loadChat(chat.id)"
              class="action-btn load-btn"
              title="Load this chat"
            >
              <i class="fas fa-folder-open"></i>
              Load
            </button>
            <button
              @click="editTitle(chat)"
              class="action-btn edit-btn"
              title="Edit title"
            >
              <i class="fas fa-edit"></i>
            </button>
            <button
              @click="confirmDelete(chat)"
              class="action-btn delete-btn"
              title="Delete this chat"
            >
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      </div>

      <div class="empty-state" v-else>
        <i class="fas fa-comments empty-icon"></i>
        <p>{{ searchQuery ? 'No chats found' : 'No chat history yet' }}</p>
        <p class="empty-hint">
          {{ searchQuery ? 'Try a different search term' : 'Start a new chat to see it here' }}
        </p>
      </div>

      <div class="modal-footer" v-if="stats.totalChats > 0">
        <button @click="clearAll" class="clear-all-btn">
          <i class="fas fa-trash-alt"></i>
          Clear All Chats
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted } from 'vue'
import { confirmAction } from '@/sidepanel/composables/useConfirm'
import chatHistory from '@/stores/chatHistory'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'chat-loaded'])

const searchQuery = ref('')
const editingChatId = ref(null)
const editingTitle = ref('')

// Computed properties
const filteredChats = computed(() => {
  if (!searchQuery.value) {
    return chatHistory.state.chats
  }
  return chatHistory.searchChats(searchQuery.value)
})

const stats = computed(() => chatHistory.getChatStats())

// Format date for display
const formatDate = (dateString) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

// Format relative time
const formatRelativeTime = (dateString) => {
  const date = new Date(dateString)
  const now = new Date()
  const diff = now - date
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''} ago`
  } else if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''} ago`
  } else if (minutes > 0) {
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
  } else {
    return 'just now'
  }
}

// Load a chat
const loadChat = async (chatId) => {
  try {
    await chatHistory.loadChat(chatId)
    emit('chat-loaded', chatId)
    emit('close')
  } catch (error) {
    console.error('Error loading chat:', error)
    alert('Failed to load chat')
  }
}

// Start editing a chat title
const startEdit = (chat) => {
  editingChatId.value = chat.id
  editingTitle.value = chat.title
  nextTick(() => {
    const input = document.querySelector('.title-input')
    if (input) {
      input.focus()
      input.select()
    }
  })
}

// Edit title button click
const editTitle = (chat) => {
  startEdit(chat)
}

// Save edited title
const saveTitle = async (chatId) => {
  if (editingTitle.value.trim() && editingTitle.value !== chatHistory.state.chats.find(c => c.id === chatId)?.title) {
    try {
      await chatHistory.updateChatTitle(chatId, editingTitle.value.trim())
    } catch (error) {
      console.error('Error updating chat title:', error)
    }
  }
  cancelEdit()
}

// Cancel editing
const cancelEdit = () => {
  editingChatId.value = null
  editingTitle.value = ''
}

// Confirm and delete a chat
const confirmDelete = async (chat) => {
  const message = chat.isActive
    ? 'This is the active chat. Are you sure you want to delete it?'
    : `Delete "${chat.title}"?`

  if (await confirmAction(message)) {
    try {
      await chatHistory.deleteChat(chat.id)
      if (chat.isActive) {
        emit('chat-loaded', null) // Signal that active chat was deleted
      }
    } catch (error) {
      console.error('Error deleting chat:', error)
      alert('Failed to delete chat')
    }
  }
}

// Clear all chats
const clearAll = async () => {
  // One dialog carrying both warnings: the old second confirm() existed only
  // because a native prompt cannot express severity
  if (await confirmAction('This will permanently delete all chat history. This cannot be undone. Continue?', 'Delete All')) {
    try {
      await chatHistory.clearAllChats()
      emit('chat-loaded', null)
    } catch (error) {
      console.error('Error clearing chats:', error)
      alert('Failed to clear chats')
    }
  }
}

// Initialize on mount
onMounted(async () => {
  if (chatHistory.state.chats.length === 0) {
    await chatHistory.loadChats()
  }
})
</script>

<style scoped>
.chat-history-modal {
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
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.modal-content {
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 700px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h2 {
  margin: 0;
  font-size: 1.5rem;
  color: #1f2937;
}

.close-btn {
  background: none;
  border: none;
  font-size: 2rem;
  color: #6b7280;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: #f3f4f6;
  color: #1f2937;
}

.search-bar {
  padding: 0 20px;
  position: relative;
  margin-top: 10px;
}

.search-input {
  width: 100%;
  padding: 10px 40px 10px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 0.95rem;
  transition: border-color 0.2s;
}

.search-input:focus {
  outline: none;
  border-color: #3b82f6;
}

.search-icon {
  position: absolute;
  right: 32px;
  top: 50%;
  transform: translateY(-50%);
  color: #9ca3af;
}

.chat-stats {
  padding: 10px 20px;
  font-size: 0.85rem;
  color: #6b7280;
  display: flex;
  gap: 8px;
}

.separator {
  color: #d1d5db;
}

.chat-list {
  flex: 1;
  overflow-y: auto;
  padding: 10px 20px;
}

.chat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  margin-bottom: 8px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  transition: all 0.2s;
  background: white;
}

.chat-item:hover {
  background: #f9fafb;
  border-color: #d1d5db;
}

.chat-item.active {
  background: #eff6ff;
  border-color: #3b82f6;
}

.chat-info {
  flex: 1;
  min-width: 0;
}

.chat-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.chat-title {
  margin: 0 0 4px 0;
  font-size: 1rem;
  color: #1f2937;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
}

.chat-title:hover {
  color: #3b82f6;
}

.active-badge {
  display: inline-block;
  padding: 2px 6px;
  background: #3b82f6;
  color: white;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 500;
  margin-left: 8px;
  vertical-align: middle;
}

.title-input {
  flex: 1;
  padding: 4px 8px;
  border: 1px solid #3b82f6;
  border-radius: 4px;
  font-size: 1rem;
  font-family: inherit;
}

.chat-meta {
  display: flex;
  gap: 12px;
  font-size: 0.85rem;
  color: #6b7280;
  margin-top: 4px;
}

.chat-meta i {
  margin-right: 4px;
}

.chat-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  padding: 6px 12px;
  border: 1px solid #e5e7eb;
  background: white;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 4px;
}

.action-btn:hover {
  background: #f3f4f6;
}

.load-btn {
  color: #3b82f6;
  border-color: #3b82f6;
}

.load-btn:hover {
  background: #eff6ff;
}

.edit-btn {
  color: #10b981;
  border-color: #10b981;
}

.edit-btn:hover {
  background: #ecfdf5;
}

.delete-btn {
  color: #ef4444;
  border-color: #ef4444;
}

.delete-btn:hover {
  background: #fef2f2;
}

.empty-state {
  padding: 60px 20px;
  text-align: center;
  color: #6b7280;
}

.empty-icon {
  font-size: 3rem;
  color: #d1d5db;
  margin-bottom: 16px;
}

.empty-state p {
  margin: 8px 0;
}

.empty-hint {
  font-size: 0.9rem;
  color: #9ca3af;
}

.modal-footer {
  padding: 16px 20px;
  border-top: 1px solid #e5e7eb;
  display: flex;
  justify-content: flex-end;
}

.clear-all-btn {
  padding: 8px 16px;
  background: #ef4444;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: background 0.2s;
}

.clear-all-btn:hover {
  background: #dc2626;
}

/* Scrollbar styling */
.chat-list::-webkit-scrollbar {
  width: 6px;
}

.chat-list::-webkit-scrollbar-track {
  background: #f3f4f6;
  border-radius: 3px;
}

.chat-list::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 3px;
}

.chat-list::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}
</style>