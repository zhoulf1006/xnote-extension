// File Transfer sync alarm name
const TRANSFER_SYNC_ALARM = 'fileTransferSync';

chrome.runtime.onInstalled.addListener(() => {
  // Add context menu item
  chrome.contextMenus.create({
    id: 'summarizePage',
    title: 'Summary Page',
    contexts: ['page']
  });

  // Set up transfer sync alarm for periodic change detection
  // Minimum period in Manifest V3 is 0.5 minutes (30 seconds)
  // Chrome may enforce minimum of 1 minute in production
  chrome.alarms.create(TRANSFER_SYNC_ALARM, {
    periodInMinutes: 0.5  // 30 seconds (will be 1 minute in production)
  });

  console.log('Transfer sync alarm created');
});

// Handle alarms
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
    // Execute content script to get page content
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
        // Send data to sidepanel
        chrome.runtime.sendMessage({
          action: 'summarizePage',
          data: results[0].result
        });
      }
    });
  }
}); 