/**
 * Screenshot Overlay Content Script
 * Provides area selection functionality for screenshot capture
 */

(function() {
  // Prevent multiple injections
  if (window.__xnoteScreenshotOverlayInjected) {
    return;
  }
  window.__xnoteScreenshotOverlayInjected = true;

  let overlay = null;
  let selectionBox = null;
  let startX = 0;
  let startY = 0;
  let isSelecting = false;
  let dimensionDisplay = null;

  /**
   * Create and show the screenshot overlay
   */
  function createOverlay() {
    // Remove existing overlay if any
    removeOverlay();

    // Create overlay container
    overlay = document.createElement('div');
    overlay.id = 'xnote-screenshot-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.3);
      z-index: 2147483647;
      cursor: crosshair;
      user-select: none;
      -webkit-user-select: none;
    `;

    // Create selection box
    selectionBox = document.createElement('div');
    selectionBox.id = 'xnote-selection-box';
    selectionBox.style.cssText = `
      position: absolute;
      border: 2px dashed #ffffff;
      background: rgba(255, 255, 255, 0.1);
      box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.3);
      pointer-events: none;
      display: none;
    `;

    // Create dimension display
    dimensionDisplay = document.createElement('div');
    dimensionDisplay.id = 'xnote-dimension-display';
    dimensionDisplay.style.cssText = `
      position: absolute;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-family: monospace;
      white-space: nowrap;
      display: none;
      pointer-events: none;
      z-index: 2147483648;
    `;

    // Create instructions
    const instructions = document.createElement('div');
    instructions.style.cssText = `
      position: absolute;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      z-index: 2147483648;
      pointer-events: none;
    `;
    instructions.innerHTML = `
      <strong>Select an area to capture</strong><br>
      <span style="font-size: 12px; opacity: 0.9;">Click and drag to select • Press ESC to cancel</span>
    `;

    // Append elements
    overlay.appendChild(selectionBox);
    overlay.appendChild(dimensionDisplay);
    overlay.appendChild(instructions);
    document.body.appendChild(overlay);

    // Add event listeners
    overlay.addEventListener('mousedown', handleMouseDown);
    overlay.addEventListener('mousemove', handleMouseMove);
    overlay.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('keydown', handleKeyDown);

    // Prevent context menu
    overlay.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /**
   * Handle mouse down event
   */
  function handleMouseDown(e) {
    if (e.button !== 0) return; // Only left click

    isSelecting = true;
    startX = e.clientX;
    startY = e.clientY;

    // Reset selection box
    selectionBox.style.left = startX + 'px';
    selectionBox.style.top = startY + 'px';
    selectionBox.style.width = '0';
    selectionBox.style.height = '0';
    selectionBox.style.display = 'block';

    // Show dimension display
    dimensionDisplay.style.display = 'block';
    updateDimensionDisplay(e.clientX, e.clientY, 0, 0);
  }

  /**
   * Handle mouse move event
   */
  function handleMouseMove(e) {
    if (!isSelecting) return;

    const currentX = e.clientX;
    const currentY = e.clientY;

    // Calculate dimensions
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);
    const left = Math.min(currentX, startX);
    const top = Math.min(currentY, startY);

    // Update selection box
    selectionBox.style.left = left + 'px';
    selectionBox.style.top = top + 'px';
    selectionBox.style.width = width + 'px';
    selectionBox.style.height = height + 'px';

    // Update dimension display
    updateDimensionDisplay(currentX, currentY, width, height);
  }

  /**
   * Handle mouse up event
   */
  function handleMouseUp(e) {
    if (!isSelecting) return;

    isSelecting = false;

    const currentX = e.clientX;
    const currentY = e.clientY;

    // Calculate final dimensions
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);
    const left = Math.min(currentX, startX);
    const top = Math.min(currentY, startY);

    // Minimum size check (at least 10x10 pixels)
    if (width < 10 || height < 10) {
      removeOverlay();
      return;
    }

    // Get device pixel ratio for high DPI screens
    const devicePixelRatio = window.devicePixelRatio || 1;

    // Prepare crop data with actual pixel values
    const cropData = {
      x: Math.round(left * devicePixelRatio),
      y: Math.round(top * devicePixelRatio),
      width: Math.round(width * devicePixelRatio),
      height: Math.round(height * devicePixelRatio),
      // Include display dimensions for reference
      displayX: left,
      displayY: top,
      displayWidth: width,
      displayHeight: height
    };

    // Add visual feedback for capture
    selectionBox.style.transition = 'all 0.2s ease';
    selectionBox.style.border = '2px solid #4CAF50';
    selectionBox.style.background = 'rgba(76, 175, 80, 0.2)';

    // Send crop data to background script
    setTimeout(() => {
      chrome.runtime.sendMessage({
        action: 'captureSelectedArea',
        cropData: cropData
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error sending crop data:', chrome.runtime.lastError);
        }
        removeOverlay();
      });
    }, 200);
  }

  /**
   * Handle keyboard events
   */
  function handleKeyDown(e) {
    // ESC key to cancel
    if (e.key === 'Escape' || e.keyCode === 27) {
      e.preventDefault();
      e.stopPropagation();

      // Notify background script of cancellation
      chrome.runtime.sendMessage({
        action: 'screenshotCancelled'
      });

      removeOverlay();
    }
  }

  /**
   * Update dimension display position and text
   */
  function updateDimensionDisplay(mouseX, mouseY, width, height) {
    if (!dimensionDisplay) return;

    // Position the display near the cursor
    let displayX = mouseX + 10;
    let displayY = mouseY - 30;

    // Adjust position if near edges
    if (displayX + 100 > window.innerWidth) {
      displayX = mouseX - 110;
    }
    if (displayY < 10) {
      displayY = mouseY + 10;
    }

    dimensionDisplay.style.left = displayX + 'px';
    dimensionDisplay.style.top = displayY + 'px';
    dimensionDisplay.textContent = `${Math.round(width)} × ${Math.round(height)}`;
  }

  /**
   * Remove the overlay and clean up
   */
  function removeOverlay() {
    if (overlay) {
      // Remove event listeners
      overlay.removeEventListener('mousedown', handleMouseDown);
      overlay.removeEventListener('mousemove', handleMouseMove);
      overlay.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('keydown', handleKeyDown);

      // Remove overlay
      overlay.remove();
      overlay = null;
      selectionBox = null;
      dimensionDisplay = null;
    }

    // Reset state
    isSelecting = false;
    window.__xnoteScreenshotOverlayInjected = false;
  }

  // Initialize overlay
  createOverlay();

  // Listen for cleanup message
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'cleanupScreenshotOverlay') {
      removeOverlay();
      sendResponse({ success: true });
    }
  });
})();