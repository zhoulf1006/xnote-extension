import { reactive } from 'vue'
import { getDB } from './dbManager'

// Chat history state
const state = reactive({
  chats: [],
  activeChat: null,
  isLoading: false
})

// Generate UUID
const generateId = () => {
  return 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
}

// Generate chat title from first message or use default
const generateTitle = (messages) => {
  if (messages && messages.length > 0) {
    const firstUserMessage = messages.find(m => m.role === 'user')
    if (firstUserMessage) {
      // Truncate to 50 characters and clean up
      const title = firstUserMessage.content.substring(0, 50).replace(/\n/g, ' ').trim()
      return title + (firstUserMessage.content.length > 50 ? '...' : '')
    }
  }
  return `Chat ${new Date().toLocaleDateString()}`
}

// Load all chats from IndexedDB
const loadChats = async () => {
  const db = await getDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['chatHistory'], 'readonly')
    const store = transaction.objectStore('chatHistory')
    const request = store.getAll()

    request.onsuccess = () => {
      const chats = request.result || []
      // Sort by updatedAt descending (most recent first)
      chats.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      state.chats = chats

      // Set active chat if exists
      const activeChat = chats.find(chat => chat.isActive)
      if (activeChat) {
        state.activeChat = activeChat
      }

      resolve(chats)
    }

    request.onerror = () => reject(request.error)
  })
}

// Create a new chat
const createNewChat = async (initialMessage = null) => {
  const db = await getDB()

  // Deactivate current active chat
  if (state.activeChat) {
    await updateChat(state.activeChat.id, { isActive: false })
  }

  const now = new Date().toISOString()
  const messages = initialMessage ? [initialMessage] : []

  const newChat = {
    id: generateId(),
    title: generateTitle(messages),
    messages: JSON.parse(JSON.stringify(messages)), // Ensure plain object for IndexedDB
    createdAt: now,
    updatedAt: now,
    isActive: true
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['chatHistory'], 'readwrite')
    const store = transaction.objectStore('chatHistory')
    const request = store.add(newChat)

    request.onsuccess = () => {
      state.chats.unshift(newChat)
      state.activeChat = newChat
      resolve(newChat)
    }

    request.onerror = () => reject(request.error)
  })
}

// Load a specific chat
const loadChat = async (chatId) => {
  const db = await getDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['chatHistory'], 'readonly')
    const store = transaction.objectStore('chatHistory')
    const request = store.get(chatId)

    request.onsuccess = async () => {
      const chat = request.result
      if (chat) {
        // Deactivate current active chat
        if (state.activeChat && state.activeChat.id !== chatId) {
          await updateChat(state.activeChat.id, { isActive: false })
        }

        // Activate the loaded chat
        chat.isActive = true
        await updateChat(chatId, { isActive: true })

        state.activeChat = chat
        resolve(chat)
      } else {
        reject(new Error('Chat not found'))
      }
    }

    request.onerror = () => reject(request.error)
  })
}

// Update a chat (title, messages, etc.)
const updateChat = async (chatId, updates) => {
  const db = await getDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['chatHistory'], 'readwrite')
    const store = transaction.objectStore('chatHistory')
    const getRequest = store.get(chatId)

    getRequest.onsuccess = () => {
      const chat = getRequest.result
      if (chat) {
        // Apply updates - deep clone to remove Vue proxies for IndexedDB
        const plainUpdates = JSON.parse(JSON.stringify(updates))
        Object.assign(chat, plainUpdates)
        chat.updatedAt = new Date().toISOString()

        const putRequest = store.put(chat)

        putRequest.onsuccess = () => {
          // Update state
          const index = state.chats.findIndex(c => c.id === chatId)
          if (index !== -1) {
            state.chats[index] = chat
          }

          if (state.activeChat?.id === chatId) {
            state.activeChat = chat
          }

          resolve(chat)
        }

        putRequest.onerror = () => reject(putRequest.error)
      } else {
        reject(new Error('Chat not found'))
      }
    }

    getRequest.onerror = () => reject(getRequest.error)
  })
}

// Save messages to the active chat
const saveChatMessages = async (messages) => {
  if (!state.activeChat) {
    // Create new chat if none exists
    const newChat = await createNewChat()
    state.activeChat = newChat
  }

  // Update title if it's still default and we have messages
  let title = state.activeChat.title
  if (title.startsWith('Chat ') && messages.length > 0) {
    title = generateTitle(messages)
  }

  // Convert Vue Proxy to plain object for IndexedDB storage
  const plainMessages = JSON.parse(JSON.stringify(messages))

  return updateChat(state.activeChat.id, {
    messages: plainMessages,
    title
  })
}

// Delete a chat
const deleteChat = async (chatId) => {
  const db = await getDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['chatHistory'], 'readwrite')
    const store = transaction.objectStore('chatHistory')
    const request = store.delete(chatId)

    request.onsuccess = () => {
      // Remove from state
      const index = state.chats.findIndex(c => c.id === chatId)
      if (index !== -1) {
        state.chats.splice(index, 1)
      }

      // If deleted chat was active, clear active chat
      if (state.activeChat?.id === chatId) {
        state.activeChat = null
      }

      resolve()
    }

    request.onerror = () => reject(request.error)
  })
}

// Update chat title
const updateChatTitle = async (chatId, title) => {
  return updateChat(chatId, { title })
}

// Clear all chats
const clearAllChats = async () => {
  const db = await getDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['chatHistory'], 'readwrite')
    const store = transaction.objectStore('chatHistory')
    const request = store.clear()

    request.onsuccess = () => {
      state.chats = []
      state.activeChat = null
      resolve()
    }

    request.onerror = () => reject(request.error)
  })
}

// Search chats by title or content
const searchChats = (query) => {
  if (!query) return state.chats

  const lowerQuery = query.toLowerCase()
  return state.chats.filter(chat => {
    // Search in title
    if (chat.title.toLowerCase().includes(lowerQuery)) return true

    // Search in messages
    return chat.messages.some(msg =>
      msg.content.toLowerCase().includes(lowerQuery)
    )
  })
}

// Get chat statistics
const getChatStats = () => {
  return {
    totalChats: state.chats.length,
    totalMessages: state.chats.reduce((sum, chat) => sum + chat.messages.length, 0),
    activeChat: state.activeChat?.id || null
  }
}

// Migrate from localStorage if exists
const migrateFromLocalStorage = async () => {
  const savedChat = localStorage.getItem('xnote-chat')
  if (savedChat) {
    try {
      const chat = JSON.parse(savedChat)
      if (chat.messages && chat.messages.length > 0) {
        // Create a new chat with migrated messages
        const newChat = await createNewChat()
        await updateChat(newChat.id, {
          messages: chat.messages,
          title: generateTitle(chat.messages)
        })

        // Remove old localStorage data
        localStorage.removeItem('xnote-chat')
        console.log('Successfully migrated chat from localStorage to IndexedDB')
      }
    } catch (error) {
      console.error('Error migrating chat from localStorage:', error)
    }
  }
}

// Initialize the store
const init = async () => {
  state.isLoading = true
  try {
    await loadChats()

    // Check if we need to migrate from localStorage
    if (state.chats.length === 0) {
      await migrateFromLocalStorage()
    }
  } catch (error) {
    console.error('Error initializing chat history:', error)
  } finally {
    state.isLoading = false
  }
}

export default {
  state,
  init,
  loadChats,
  createNewChat,
  loadChat,
  updateChat,
  saveChatMessages,
  deleteChat,
  updateChatTitle,
  clearAllChats,
  searchChats,
  getChatStats
}