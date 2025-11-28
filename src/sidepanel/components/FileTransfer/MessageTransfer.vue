<template>
  <div class="message-transfer">
    <!-- Messages container -->
    <div class="messages-container" ref="messagesContainer">
      <!-- Empty state -->
      <div v-if="messages.length === 0" class="empty-state">
        <div class="empty-icon">
          <i class="fas fa-comments"></i>
        </div>
        <h3>No messages yet</h3>
        <p>Send a message to sync across your devices.</p>
      </div>

      <!-- Message bubbles -->
      <div
        v-for="msg in messages"
        :key="msg.id"
        class="message-wrapper"
        :class="{ 'own': isOwnDevice(msg) }"
      >
        <!-- Device name for other devices -->
        <div v-if="!isOwnDevice(msg)" class="device-name">
          {{ getDisplayName(msg) }}
        </div>

        <!-- Message bubble -->
        <div class="message-bubble">
          <div class="message-content">{{ msg.content }}</div>
          <div class="message-footer">
            <span class="message-time">{{ formatTime(msg.timestamp) }}</span>
            <button
              class="action-btn"
              @click="handleCopy(msg)"
              title="Copy to clipboard"
            >
              <i class="fas fa-copy"></i>
            </button>
            <button
              class="action-btn delete-btn"
              @click="handleDelete(msg)"
              title="Delete message"
            >
              <i class="fas fa-trash-alt"></i>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Message input -->
    <div class="message-input-area">
      <textarea
        v-model="messageText"
        @keydown.enter.exact.prevent="sendMessage"
        @keydown.ctrl.enter="insertNewline"
        @keydown.meta.enter="insertNewline"
        placeholder="Type a message..."
        rows="1"
        :disabled="isSending"
        ref="inputRef"
      ></textarea>
      <button
        class="send-btn"
        @click="sendMessage"
        :disabled="!canSend || isSending"
        title="Send message (Enter)"
      >
        <i v-if="isSending" class="fas fa-spinner fa-spin"></i>
        <i v-else class="fas fa-paper-plane"></i>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, watch } from 'vue';

const props = defineProps({
  messages: {
    type: Array,
    required: true
  },
  deviceId: {
    type: String,
    default: null
  }
});

const emit = defineEmits(['send', 'copy', 'delete']);

const messageText = ref('');
const isSending = ref(false);
const messagesContainer = ref(null);
const inputRef = ref(null);

const canSend = computed(() => messageText.value.trim().length > 0);

const isOwnDevice = (msg) => {
  return msg.deviceId === props.deviceId;
};

const getDisplayName = (msg) => {
  // Use device name if available, otherwise show last 6 chars of deviceId
  if (msg.deviceName) {
    return msg.deviceName;
  }
  if (msg.deviceId) {
    return msg.deviceId.slice(-6);
  }
  return 'Unknown';
};

const formatTime = (timestamp) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  // Today: show time
  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // Yesterday
  if (diffDays === 1) {
    return 'Yesterday ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // Within a week
  if (diffDays < 7) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[date.getDay()] + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // Older
  return date.toLocaleDateString();
};

const sendMessage = async () => {
  if (!canSend.value || isSending.value) return;

  isSending.value = true;
  const content = messageText.value.trim();
  messageText.value = '';

  try {
    emit('send', content);
    // Scroll to bottom after sending
    await nextTick();
    scrollToBottom();
  } catch (error) {
    // Restore message on error
    messageText.value = content;
  } finally {
    isSending.value = false;
    inputRef.value?.focus();
  }
};

const insertNewline = () => {
  messageText.value += '\n';
};

const handleCopy = (msg) => {
  emit('copy', msg);
};

const handleDelete = (msg) => {
  emit('delete', msg);
};

const scrollToBottom = () => {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
};

// Auto-scroll when new messages arrive
watch(() => props.messages.length, async () => {
  await nextTick();
  scrollToBottom();
}, { immediate: true });
</script>

<style scoped>
.message-transfer {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* Messages container */
.messages-container {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 2px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Empty state */
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: #6c757d;
}

.empty-icon {
  width: 56px;
  height: 56px;
  background: rgba(103, 58, 183, 0.1);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
}

.empty-icon i {
  font-size: 24px;
  color: #673ab7;
}

.empty-state h3 {
  margin: 0 0 6px 0;
  font-size: 15px;
  color: #495057;
}

.empty-state p {
  margin: 0;
  font-size: 13px;
}

/* Message wrapper */
.message-wrapper {
  display: flex;
  flex-direction: column;
  max-width: 90%;
}

.message-wrapper.own {
  align-self: flex-end;
}

.message-wrapper:not(.own) {
  align-self: flex-start;
}

/* Device name */
.device-name {
  font-size: 11px;
  color: #6c757d;
  margin-bottom: 3px;
  margin-left: 8px;
}

/* Message bubble */
.message-bubble {
  padding: 10px 14px;
  border-radius: 18px;
  position: relative;
}

.message-wrapper.own .message-bubble {
  background: rgba(103, 58, 183, 0.15);
  color: #333;
  border-bottom-right-radius: 4px;
}

.message-wrapper:not(.own) .message-bubble {
  background: #f1f3f5;
  color: #333;
  border-bottom-left-radius: 4px;
}

/* Message content */
.message-content {
  font-size: 14px;
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-word;
}

/* Message footer */
.message-footer {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
}

.message-time {
  font-size: 10px;
  opacity: 0.7;
  flex: 1;
}

.message-wrapper.own .message-time {
  color: #6c757d;
}

.message-wrapper:not(.own) .message-time {
  color: #999;
}

/* Action buttons in message */
.action-btn {
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  padding: 0;
}

.message-wrapper.own .action-btn {
  background: rgba(0, 0, 0, 0.08);
  color: #6c757d;
}

.message-wrapper.own .action-btn:hover {
  background: rgba(0, 0, 0, 0.12);
}

.message-wrapper:not(.own) .action-btn {
  background: #f1f3f4;
  color: #6c757d;
}

.message-wrapper:not(.own) .action-btn:hover {
  background: #e9ecef;
}

.action-btn.delete-btn:hover {
  color: #dc3545;
}

.action-btn i {
  font-size: 10px;
}

/* Message input area */
.message-input-area {
  display: flex;
  gap: 12px;
  padding: 2px;
  background: white;
  border-top: 1px solid #e9ecef;
  flex-shrink: 0;
}

.message-input-area textarea {
  flex: 1;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 10px 16px;
  font-size: 14px;
  resize: none;
  font-family: inherit;
  line-height: 1.4;
  max-height: 120px;
  transition: border-color 0.2s;
}

.message-input-area textarea:focus {
  outline: none;
  border-color: #673ab7;
}

.message-input-area textarea:disabled {
  background: #f8f9fa;
  cursor: not-allowed;
}

.message-input-area textarea::placeholder {
  color: #adb5bd;
}

.send-btn {
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  background: #673ab7;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
}

.send-btn:hover:not(:disabled) {
  background: #5e35b1;
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.send-btn i {
  font-size: 16px;
}
</style>
