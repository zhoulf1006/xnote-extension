import { reactive } from 'vue';

// Create a single store instance
const state = reactive({
  activeTab: 'chat', // Default active tab
});

const setActiveTab = (tabId) => {
  state.activeTab = tabId;
};

// Listen for tab switch messages from background
if (chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((request) => {
    if (request.action === 'setActiveTab') {
      setActiveTab(request.tabId);
    }
  });
}

export default function useNavigationStore() {
  return {
    state,
    setActiveTab,
  };
}