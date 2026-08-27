// Track active tabs with content scripts
const activeTabsWithContentScript = new Set()
const contentScriptReadyTabs = new Set()

// File Transfer sync alarm name
const TRANSFER_SYNC_ALARM = 'fileTransferSync';

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
  // onInstalled also fires on update and on every reload of an unpacked extension,
  // but context menus survive those — so creating them again fails with
  // "Cannot create item with duplicate id". Clearing first makes this idempotent,
  // and is also what lets a changed title actually take effect.
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'summarizePage',
      title: 'Summary Page',
      contexts: ['page']
    });

    chrome.contextMenus.create({
      id: 'saveToQuickLinks',
      title: 'Save to Quick Links',
      contexts: ['page']
    });
  });

  // Set up transfer sync alarm for periodic change detection
  // Minimum period in Manifest V3 is 0.5 minutes (30 seconds)
  // Chrome may enforce minimum of 1 minute in production
  chrome.alarms.create(TRANSFER_SYNC_ALARM, {
    periodInMinutes: 0.5  // 30 seconds (will be 1 minute in production)
  });

  console.log('Transfer sync alarm created');
});

// Handle alarms for file transfer sync
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === TRANSFER_SYNC_ALARM) {
    // Send message to side panel to trigger change detection
    // The side panel may or may not be open - that's OK
    chrome.runtime.sendMessage({ action: 'triggerTransferSync' })
      .then(() => {
        // Message delivered successfully
      })
      .catch((error) => {
        // Side panel not open - this is expected and OK
        // The sync will happen when the panel is opened
        if (error.message && !error.message.includes('Receiving end does not exist')) {
          console.warn('Failed to trigger sync:', error);
        }
      });
  }
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

  // Screenshot capture handlers
  if (request.action === 'startScreenshotCapture') {
    // Inject screenshot overlay content script into active tab
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (tabs[0]) {
        try {
          // First ensure the tab is focused
          await chrome.windows.update(tabs[0].windowId, { focused: true });
          await chrome.tabs.update(tabs[0].id, { active: true });

          // Inject the screenshot overlay script
          await chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            files: ['src/content-scripts/screenshot-overlay.js']
          });

          // After injection, send message to focus the overlay
          setTimeout(() => {
            chrome.tabs.sendMessage(tabs[0].id, {
              action: 'focusScreenshotOverlay'
            }).catch(() => {
              // Ignore errors if message fails (overlay might already be removed)
            });
          }, 100);

          sendResponse({ success: true });
        } catch (error) {
          console.error('Error injecting screenshot overlay:', error);
          sendResponse({ success: false, error: error.message });
        }
      } else {
        sendResponse({ success: false, error: 'No active tab found' });
      }
    });
    return true; // Will respond asynchronously
  }

  if (request.action === 'captureSelectedArea') {
    // Capture the visible tab and crop to selection
    handleScreenshotCapture(request.cropData, sender, sendResponse);
    return true; // Will respond asynchronously
  }

  if (request.action === 'screenshotCancelled') {
    // Notify sidepanel that screenshot was cancelled
    chrome.runtime.sendMessage({
      action: 'screenshotCancelled'
    });
    sendResponse({ success: true });
  }
});

// Handle screenshot capture and cropping
async function handleScreenshotCapture(cropData, sender, sendResponse) {
  try {
    // Capture the visible tab
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, async (dataUrl) => {
      if (chrome.runtime.lastError) {
        console.error('Error capturing tab:', chrome.runtime.lastError);
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
        return;
      }

      // Send the captured image and crop data to the sidepanel
      chrome.runtime.sendMessage({
        action: 'screenshotCaptured',
        imageData: dataUrl,
        cropData: cropData
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error sending screenshot to sidepanel:', chrome.runtime.lastError);
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          sendResponse({ success: true });
        }
      });
    });
  } catch (error) {
    console.error('Error in screenshot capture:', error);
    sendResponse({ success: false, error: error.message });
  }
}
