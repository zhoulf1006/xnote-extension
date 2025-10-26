// Track active tabs with content scripts
const activeTabsWithContentScript = new Set()
const contentScriptReadyTabs = new Set()

// Set up side panel behavior
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

// Handle tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'complete') {
    activeTabsWithContentScript.delete(tabId)
    contentScriptReadyTabs.delete(tabId)
  }
})

// Handle tab removal
chrome.tabs.onRemoved.addListener((tabId) => {
  activeTabsWithContentScript.delete(tabId)
  contentScriptReadyTabs.delete(tabId)
})

// Handle connection errors
chrome.runtime.onInstalled.addListener(() => {
  chrome.runtime.lastError;  // Clear any existing errors
});

// Handle Google Drive authentication requests
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'authenticateGoogleDrive') {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ success: true, token });
      }
    });
    return true; // Will respond asynchronously
  }
});

// Chrome extension initialization
chrome.runtime.onInstalled.addListener(() => {
  // Add context menu item for page summary
  chrome.contextMenus.create({
    id: 'summarizePage',
    title: 'Summary Page',
    contexts: ['page']
  });

  // Add context menu item for saving to quick links
  chrome.contextMenus.create({
    id: 'saveToQuickLinks',
    title: 'Save to Quick Links',
    contexts: ['page']
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'summarizePage') {
    // First ensure the sidebar is open and wait for it to be ready
    chrome.sidePanel.open({ windowId: tab.windowId }).then(() => {
      // Wait a moment for the sidepanel to initialize
      setTimeout(() => {
        // Switch to summary tab first
        chrome.runtime.sendMessage({
          action: 'setActiveTab',
          tabId: 'summary'
        }, () => {
          // After tab switch, get page content and send to summary
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              return {
                content: document.body.innerText,
                title: document.title,
                url: window.location.href
              };
            }
          }, (results) => {
            if (results && results[0]?.result) {
              chrome.runtime.sendMessage({
                action: 'summarizePage',
                data: results[0].result
              });
            }
          });
        });
      }, 500); // Give sidepanel 500ms to initialize
    });
  } else if (info.menuItemId === 'saveToQuickLinks') {
    // Open sidebar and switch to links tab
    chrome.sidePanel.open({ windowId: tab.windowId }).then(() => {
      setTimeout(() => {
        // Switch to links tab
        chrome.runtime.sendMessage({
          action: 'setActiveTab',
          tabId: 'links'
        }, () => {
          // Send message to show save page dialog
          chrome.runtime.sendMessage({
            action: 'showSavePageDialog',
            pageInfo: {
              title: tab.title,
              url: tab.url
            }
          });
        });
      }, 500);
    });
  }
});

// Helper function to send notifications with retry logic
async function sendNotificationWithRetry(tabId, message, maxRetries = 3, delayMs = 500) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Check if content script is ready first
      if (contentScriptReadyTabs.has(tabId)) {
        await chrome.tabs.sendMessage(tabId, message);
        console.log(`Notification sent successfully to tab ${tabId} on attempt ${attempt}`);
        return;
      } else if (attempt === 1) {
        // First attempt: try to inject content script if not ready
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['src/content.js']
          });
          // Wait a bit for the script to initialize
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (injectError) {
          console.log(`Could not inject content script: ${injectError.message}`);
        }
      }
      
      // Try to send the message
      await chrome.tabs.sendMessage(tabId, message);
      console.log(`Notification sent successfully to tab ${tabId} on attempt ${attempt}`);
      return;
      
    } catch (error) {
      console.log(`Attempt ${attempt} failed for tab ${tabId}:`, error.message);
      
      if (attempt < maxRetries) {
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
      } else {
        console.log(`Failed to send notification after ${maxRetries} attempts. Content script may not be available.`);
      }
    }
  }
}

// Handle runtime messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'contentScriptReady') {
    // Track that content script is ready for this tab
    if (sender.tab && sender.tab.id) {
      contentScriptReadyTabs.add(sender.tab.id)
      console.log(`Content script ready for tab ${sender.tab.id}`)
    }
    return true;
  }
  
  if (request.action === 'savePageToCategory') {
    // This will be handled by the links service in the sidebar
    return true;
  }
  
  if (request.action === 'notifyPageSaved') {
    // Send notification to content script with error handling and retry
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (tabs[0]) {
        await sendNotificationWithRetry(tabs[0].id, {
          action: 'showSaveSuccess',
          categoryName: request.categoryName
        });
      }
    });
  }
  
  if (request.action === 'notifyPageSaveError') {
    // Send error notification to content script with error handling and retry
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (tabs[0]) {
        await sendNotificationWithRetry(tabs[0].id, {
          action: 'showSaveError',
          error: request.error
        });
      }
    });
  }
});
