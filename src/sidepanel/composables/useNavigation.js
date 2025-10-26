import { ref } from 'vue'

// Create a shared state using Vue's reactivity
const activeTab = ref('chat')

export function useNavigation() {
  const setActiveTab = (tab) => {
    activeTab.value = tab
  }

  return {
    activeTab,
    setActiveTab
  }
} 