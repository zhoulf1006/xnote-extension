// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getPageContent') {
    try {
      // Get the page content
      const title = document.title
      const content = extractMainContent()
      const url = window.location.href

      // Send content back to background script
      chrome.runtime.sendMessage({
        action: 'pageContent',
        title,
        content,
        url
      })
    } catch (error) {
      console.error('Error extracting page content:', error)
      chrome.runtime.sendMessage({
        action: 'pageContent',
        error: error.message
      })
    }
  } else if (request.action === 'saveCurrentPage') {
    try {
      // Get current page information
      const pageInfo = {
        title: document.title || 'Untitled Page',
        url: window.location.href,
        domain: window.location.hostname
      }
      
      sendResponse({ success: true, pageInfo })
    } catch (error) {
      console.error('Error getting page info:', error)
      sendResponse({ success: false, error: error.message })
    }
    return true // Keep message channel open for async response
  } else if (request.action === 'showSaveSuccess') {
    showTemporaryNotification(`Saved to ${request.categoryName}!`, 'success')
  } else if (request.action === 'showSaveError') {
    showTemporaryNotification(request.error, 'error')
  }
})

// Function to extract main content from the page
function extractMainContent() {
  // Try to find main content using common selectors
  const selectors = [
    'article',
    '[role="main"]',
    'main',
    '.main-content',
    '#main-content',
    '.content',
    '#content'
  ]

  for (const selector of selectors) {
    const element = document.querySelector(selector)
    if (element) {
      return cleanContent(element.innerText)
    }
  }

  // Fallback to body content if no main content found
  return cleanContent(document.body.innerText)
}

// Clean and format content
function cleanContent(text) {
  return text
    .replace(/\\s+/g, ' ')
    .replace(/\\n+/g, '\\n')
    .trim()
}

// Show temporary notification on page
function showTemporaryNotification(message, type = 'info') {
  // Remove existing notification if any
  const existing = document.querySelector('#xnote-notification')
  if (existing) {
    existing.remove()
  }

  // Create notification element
  const notification = document.createElement('div')
  notification.id = 'xnote-notification'
  notification.textContent = message
  
  // Style the notification
  Object.assign(notification.style, {
    position: 'fixed',
    top: '20px',
    right: '20px',
    padding: '12px 16px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    color: 'white',
    zIndex: '10000',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
    transform: 'translateX(100%)',
    transition: 'transform 0.3s ease-in-out',
    maxWidth: '300px',
    wordWrap: 'break-word'
  })

  // Set background color based on type
  if (type === 'success') {
    notification.style.background = '#28a745'
  } else if (type === 'error') {
    notification.style.background = '#dc3545'
  } else {
    notification.style.background = '#007bff'
  }

  // Add to page
  document.body.appendChild(notification)

  // Animate in
  setTimeout(() => {
    notification.style.transform = 'translateX(0)'
  }, 100)

  // Remove after 3 seconds
  setTimeout(() => {
    notification.style.transform = 'translateX(100%)'
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification)
      }
    }, 300)
  }, 3000)
}

// Context menu support for saving current page
if (typeof chrome !== 'undefined' && chrome.runtime) {
  // Add right-click context menu support
  document.addEventListener('contextmenu', (event) => {
    // Store the current page info for potential context menu action
    window.xnotePageInfo = {
      title: document.title || 'Untitled Page',
      url: window.location.href,
      domain: window.location.hostname
    }
  })
}

// Notify that content script is ready
chrome.runtime.sendMessage({ action: 'contentScriptReady' })
