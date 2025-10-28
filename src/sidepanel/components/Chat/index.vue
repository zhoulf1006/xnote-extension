<template>
  <div class="page-container">
    <ChatManagementHeader
      @new-chat="handleNewChat"
      @chat-loaded="handleChatLoaded"
    />
    <div class="chat-container" ref="chatContainer">
      <div v-for="message in messages" 
           :key="message.id" 
           class="message"
           :class="{ 'message-user': message.role === 'user', 'message-assistant': message.role === 'assistant' }">
        <div class="message-content">
          <div class="message-text">
            <template v-if="message.role === 'user'">
              {{ message.content }}
            </template>
            <Markdown v-else :source="formatMessage(message.content)" :options="markdownOptions" />
          </div>
          <div class="message-time">{{ formatTime(message.timestamp) }}</div>
        </div>
      </div>
      <div v-if="isStreaming" class="message message-assistant">
        <div class="message-content">
          <div class="message-text">
            <Markdown :source="formatMessage(streamingMessage)" :options="markdownOptions" />
          </div>
          <div class="typing-indicator">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </div>
    </div>

    <div class="chat-input">
      <textarea 
        v-model="newMessage" 
        @keydown.enter.prevent="sendMessage"
        placeholder="Type a message..."
        rows="1"
        ref="messageInput"
        :disabled="isStreaming"
      ></textarea>
      <button @click="sendMessage" :disabled="!newMessage.trim() || isStreaming">
        <i class="fas fa-paper-plane"></i>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, watch, onUnmounted, computed } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import Markdown from 'vue3-markdown-it'
import hljs from 'highlight.js'
import useNavigationStore from '@/stores/navigation'
import { useLLMConfigStore } from '@/stores/llmConfig'
import { useGoogleDriveStore } from '@/stores/googleDrive'
import { streamChat } from '@/api/chatService'
import chatHistory from '@/stores/chatHistory'
import ChatManagementHeader from './ChatManagementHeader.vue'

const messages = ref([])
const newMessage = ref('')
const chatContainer = ref(null)
const messageInput = ref(null)
const isStreaming = ref(false)
const streamingMessage = ref('')

// Create store instance at component level
const navigationStore = useNavigationStore()
const llmConfigStore = useLLMConfigStore()
const googleDriveStore = useGoogleDriveStore()

// Use computed to get activeChat from store
const activeChat = computed(() => chatHistory.state.activeChat)

const markdownOptions = {
  html: true,
  linkify: true,
  typographer: true,
  breaks: false,
  highlight: (str, lang) => {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(lang, str).value
      } catch (__) {}
    }
    return str
  }
}

// Helper function to get user-friendly error messages
const getErrorMessage = (error) => {
  const errorMessage = error?.message || String(error) || '';
  const errorString = errorMessage.toLowerCase();

  // Check for token expiry errors
  if (errorString.includes('token') && errorString.includes('expired')) {
    const currentProvider = llmConfigStore.selectedProvider;
    const providerName = currentProvider ?
      (currentProvider.charAt(0).toUpperCase() + currentProvider.slice(1)) : 'LLM';

    return `⏱️ **Authentication Token Expired**

${errorMessage}

**To fix this:**
1. Your ${providerName} authentication token has expired
2. Click the **⚙️ LLM Config** button at the bottom of the sidebar
3. Enter a new valid API key/token
4. Click **Save** to update your configuration
5. Try sending your message again`;
  }

  // Check for API key related errors
  if (errorString.includes('unauthorized') ||
      errorString.includes('401') ||
      errorString.includes('authentication fail') ||
      (errorString.includes('invalid') && errorString.includes('token')) ||
      errorString.includes('api key') ||
      errorString.includes('invalid key') ||
      errorString.includes('invalid') && errorString.includes('key')) {

    const currentProvider = llmConfigStore.selectedProvider;
    const providerName = currentProvider ?
      (currentProvider.charAt(0).toUpperCase() + currentProvider.slice(1)) : 'LLM';

    // Show specific error message if available
    const specificError = errorMessage !== 'An unexpected error occurred' ?
      `\n**Error Details:** ${errorMessage}\n` : '';

    return `❌ **API Authentication Error**
${specificError}
Your ${providerName} API key/token appears to be invalid or missing.

**To fix this:**
1. Click the **⚙️ LLM Config** button at the bottom of the sidebar
2. Enter a valid ${providerName} API key
3. Click **Save** to update your configuration
4. Try sending your message again

If you don't have an API key, you'll need to get one from the ${providerName} website.`;
  }

  // Check for 400 Bad Request errors - show specific API error message
  if (error?.status === 400 || errorString.includes('400')) {
    const providerInfo = error?.provider ? ` (${error.provider})` : '';

    return `⚠️ **Bad Request Error${providerInfo}**

${errorMessage}

This error typically means there's an issue with the request format or parameters.
Please check your message and try again, or verify your LLM configuration in the settings.`;
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

  // Generic error fallback - but show the actual error message
  return `❌ **Error processing your request**

**Error:** ${errorMessage}

Please try again or check your LLM configuration in the settings.`;
}

const formatMessage = (text) => {
  // Clean up extra newlines and format properly
  return text.trim()
    // Replace 3 or more consecutive newlines with just 2 (preserve paragraph breaks)
    .replace(/\n{3,}/g, '\n\n')
    // Remove extra newline before bullet points (•, -, *, or numbered lists)
    .replace(/\n\n(\s*[•\-\*\d+\.])/g, '\n$1')
    // Ensure single newline between consecutive bullet/list items
    .replace(/([•\-\*].+)\n\n(?=\s*[•\-\*])/g, '$1\n')
    // Handle numbered lists similarly
    .replace(/(\d+\..+)\n\n(?=\s*\d+\.)/g, '$1\n')
}

// Load messages from active chat
const loadMessages = async () => {
  if (activeChat.value) {
    messages.value = activeChat.value.messages || []
  } else {
    messages.value = []
  }
}

// Save messages to active chat
const saveMessages = async () => {
  if (messages.value.length > 0) {
    await chatHistory.saveChatMessages(messages.value)
  }
}

const formatTime = (timestamp) => {
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(timestamp))
}

const scrollToBottom = async () => {
  await nextTick()
  if (chatContainer.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight
  }
}

const sendMessage = async () => {
  if (!newMessage.value.trim() || isStreaming.value) return

  // Create new chat if none exists
  if (!activeChat.value) {
    await chatHistory.createNewChat()
  }

  const userMessage = {
    id: Date.now(),
    role: 'user',
    content: newMessage.value,
    timestamp: new Date().toISOString()
  }

  messages.value.push(userMessage)
  await saveMessages()
  newMessage.value = ''
  await scrollToBottom()

  isStreaming.value = true
  streamingMessage.value = ''

  const chatMessages = messages.value.map(msg => ({
    role: msg.role,
    content: msg.content
  }))

  try {
    await streamChat(chatMessages, {
      onChunk: async (chunk) => {
        streamingMessage.value += chunk;
        await scrollToBottom();
      },
      onComplete: async (fullResponse) => {
        messages.value.push({
          id: Date.now(),
          role: 'assistant',
          content: fullResponse,
          timestamp: new Date().toISOString()
        });
        await saveMessages();
        isStreaming.value = false;
        await scrollToBottom();
      },
      onError: async (error) => {
        console.error('Error sending message:', error);
        messages.value.push({
          id: Date.now(),
          role: 'assistant',
          content: getErrorMessage(error),
          timestamp: new Date().toISOString()
        });
        await saveMessages();
        isStreaming.value = false;
        await scrollToBottom();
      }
    });
  } catch (error) {
    console.error('Failed to send message:', error);
  }
}

// Handle new chat creation
const handleNewChat = async () => {
  messages.value = []
  await loadMessages()
  await scrollToBottom()
}

// Handle chat loaded from history
const handleChatLoaded = async (chatId) => {
  if (chatId === null) {
    // Active chat was deleted
    messages.value = []
  } else {
    await loadMessages()
  }
  await scrollToBottom()
}

const messageListener = async (request, sender, sendResponse) => {
  try {
    if (request.action === 'summarizePageContent' && request.data) {
      // Switch to chat tab
      navigationStore.setActiveTab('chat')
      
      // Create and set the prompt
      const prompt = createSummaryPrompt(request.data)
      newMessage.value = prompt
      
      // Auto send after a short delay to ensure UI is ready
      setTimeout(async () => {
        await sendMessage()
      }, 100)

      // Send response to indicate successful handling
      if (sendResponse) {
        sendResponse({ success: true });
      }
    } else if (request.action === 'switchToChatTab') {
      navigationStore.setActiveTab('chat')
      if (sendResponse) {
        sendResponse({ success: true });
      }
    }
  } catch (error) {
    console.error('Error handling message:', error);
    if (sendResponse) {
      sendResponse({ success: false, error: error.message });
    }
  }
  // Return true to indicate we will send a response asynchronously
  return true;
}

const initializeMessageListener = () => {
  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    // Remove any existing listeners first
    chrome.runtime.onMessage.removeListener(messageListener);
    // Add the new listener
    chrome.runtime.onMessage.addListener(messageListener);
    return true;
  }
  return false;
}

onMounted(async () => {
  // Initialize chat history store
  await chatHistory.init();

  // Load messages from active chat
  await loadMessages();

  const listenerInitialized = initializeMessageListener();
  if (!listenerInitialized) {
    console.warn('Chrome runtime messaging not available');
  }
})

// Watch for active chat changes
watch(activeChat, async () => {
  await loadMessages()
  await scrollToBottom()
})


onUnmounted(() => {
  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.removeListener(messageListener);
  }
})

const adjustTextareaHeight = () => {
  if (messageInput.value) {
    messageInput.value.style.height = 'auto'
    messageInput.value.style.height = messageInput.value.scrollHeight + 'px'
  }
}

watch(newMessage, adjustTextareaHeight)
</script>

<style scoped>
.chat-container {
  flex: 1;
  overflow-y: auto;
  padding: 2px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.message {
  display: flex;
  margin-bottom: 8px;
}

.message-content {
  max-width: 90%;
  padding: 12px 12px;
  border-radius: 12px;
  position: relative;
  gap: 0;
}

.message-user {
  justify-content: flex-end;
}

.message-user .message-content {
  background-color: #2196f3;
  color: white;
  border-bottom-right-radius: 4px;
}

.message-assistant .message-content {
  background-color: #f1f3f5;
  color: #333;
  border-bottom-left-radius: 4px;
}

.message-text {
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.5;
  font-size: 13px;
}

.message-time {
  font-size: 12px;
  opacity: 0.8;
  text-align: right;
}

.chat-input {
  padding: 2px;
  background: white;
  border-top: 1px solid #e9ecef;
  display: flex;
  gap: 12px;
  align-items: flex-end;
}

textarea {
  flex: 1;
  padding: 12px;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  resize: none;
  max-height: 200px;
  font-family: inherit;
  font-size: 14px;
  line-height: 1.5;
}

textarea:disabled {
  background-color: #f8f9fa;
  cursor: not-allowed;
}

button {
  background: none;
  border: none;
  color: #2196f3;
  cursor: pointer;
  padding: 8px;
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s;
}

button:hover:not(:disabled) {
  color: #1976d2;
}

button:disabled {
  color: #9e9e9e;
  cursor: not-allowed;
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

.message-text :deep(.markdown-body) {
  margin: 0;
  padding: 0;
  line-height: 1.4;
  gap: 0;
}

.message-text :deep(ol) {
  list-style-position: outside;
  padding-left: 24px;
  margin: 4px 0;
}

.message-text :deep(ol li) {
  margin-bottom: 4px;
}

.message-text :deep(ol li:last-child) {
  margin-bottom: 0;
}

.message-text :deep(ul) {
  list-style-position: outside;
  padding-left: 24px;
  margin: 4px 0;
}

.message-text :deep(ul li) {
  margin-bottom: 4px;
}

.message-text :deep(ul li:last-child) {
  margin-bottom: 0;
}

.message-text :deep(ul li p),
.message-text :deep(ol li p) {
  margin: 0;
  padding: 0;
}

.message-text :deep(p) {
  margin: 0;
  padding: 0;
}
</style>

<style>
/* Add syntax highlighting styles */
@import 'highlight.js/styles/github.css';

/* Override markdown styles */
.message-text :deep(.markdown-body) {
  background: transparent;
  color: inherit;
}

.message-text :deep(pre) {
  background: #f8f9fa;
  padding: 12px;
  border-radius: 4px;
  overflow-x: auto;
  margin: 8px 0;
}

.message-text :deep(code) {
  font-family: 'Fira Code', monospace;
  font-size: 0.9em;
  background: #f8f9fa;
  padding: 2px 4px;
  border-radius: 4px;
}

.message-text :deep(pre code) {
  padding: 0;
  background: transparent;
}
</style>
