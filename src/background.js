chrome.runtime.onInstalled.addListener(() => {
  // Add context menu item
  chrome.contextMenus.create({
    id: 'summarizePage',
    title: 'Summary Page',
    contexts: ['page']
  });
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