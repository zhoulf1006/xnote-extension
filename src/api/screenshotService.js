/**
 * Screenshot Service
 * Handles screenshot capture, cropping, and processing for the extension
 */

export const screenshotService = {
  /**
   * Capture the visible area of the current tab
   * @returns {Promise<string>} Base64 encoded image data URL
   */
  async captureVisibleTab() {
    return new Promise((resolve, reject) => {
      chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(dataUrl);
        }
      });
    });
  },

  /**
   * Crop an image to specified dimensions
   * @param {string} imageDataUrl - The original image data URL
   * @param {Object} cropData - Crop dimensions {x, y, width, height}
   * @returns {Promise<string>} Cropped image as base64 data URL
   */
  async cropImage(imageDataUrl, cropData) {
    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        // Create canvas for cropping
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Set canvas size to crop dimensions
        canvas.width = cropData.width;
        canvas.height = cropData.height;

        // Draw the cropped portion of the image
        ctx.drawImage(
          img,
          cropData.x, cropData.y,           // Source x, y
          cropData.width, cropData.height,   // Source width, height
          0, 0,                              // Destination x, y
          cropData.width, cropData.height    // Destination width, height
        );

        // Convert to data URL
        const croppedDataUrl = canvas.toDataURL('image/png');

        // Clean up
        canvas.remove();

        resolve(croppedDataUrl);
      };

      img.onerror = () => {
        reject(new Error('Failed to load image for cropping'));
      };

      img.src = imageDataUrl;
    });
  },

  /**
   * Capture and crop a selected area of the current tab
   * @param {Object} cropData - Crop dimensions {x, y, width, height}
   * @returns {Promise<string>} Cropped screenshot as base64 data URL
   */
  async captureArea(cropData) {
    try {
      // First capture the entire visible tab
      const fullScreenshot = await this.captureVisibleTab();

      // Then crop to the selected area
      const croppedScreenshot = await this.cropImage(fullScreenshot, cropData);

      return croppedScreenshot;
    } catch (error) {
      console.error('Error capturing area:', error);
      throw error;
    }
  },

  /**
   * Extract base64 data from a data URL
   * @param {string} dataUrl - The data URL to process
   * @returns {string} Base64 encoded string without the data URL prefix
   */
  extractBase64(dataUrl) {
    const base64Prefix = 'data:image/png;base64,';
    if (dataUrl.startsWith(base64Prefix)) {
      return dataUrl.substring(base64Prefix.length);
    }

    // Handle other image formats
    const matches = dataUrl.match(/^data:image\/[^;]+;base64,(.+)$/);
    if (matches && matches[1]) {
      return matches[1];
    }

    throw new Error('Invalid data URL format');
  },

  /**
   * Compress image if it's too large for API
   * @param {string} dataUrl - The image data URL
   * @param {number} maxWidth - Maximum width (default: 1920)
   * @param {number} quality - JPEG quality (0-1, default: 0.9)
   * @returns {Promise<string>} Compressed image as data URL
   */
  async compressImage(dataUrl, maxWidth = 1920, quality = 0.9) {
    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        // Calculate new dimensions
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = (maxWidth / width) * height;
          width = maxWidth;
        }

        // Create canvas for resizing
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        canvas.width = width;
        canvas.height = height;

        // Draw resized image
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to JPEG for better compression
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);

        // Clean up
        canvas.remove();

        resolve(compressedDataUrl);
      };

      img.onerror = () => {
        reject(new Error('Failed to load image for compression'));
      };

      img.src = dataUrl;
    });
  },

  /**
   * Save screenshot to storage for history
   * @param {Object} screenshotData - Screenshot data including image and metadata
   */
  async saveToHistory(screenshotData) {
    try {
      // Get existing history from storage
      const result = await chrome.storage.local.get(['screenshotHistory']);
      const history = result.screenshotHistory || [];

      // Add new screenshot with timestamp
      const entry = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        ...screenshotData
      };

      // Add to beginning of array
      history.unshift(entry);

      // Limit history to last 20 items
      if (history.length > 20) {
        history.splice(20);
      }

      // Save back to storage
      await chrome.storage.local.set({ screenshotHistory: history });

      return entry;
    } catch (error) {
      console.error('Error saving screenshot to history:', error);
      throw error;
    }
  },

  /**
   * Get screenshot history from storage
   * @returns {Promise<Array>} Array of screenshot history entries
   */
  async getHistory() {
    try {
      const result = await chrome.storage.local.get(['screenshotHistory']);
      return result.screenshotHistory || [];
    } catch (error) {
      console.error('Error getting screenshot history:', error);
      return [];
    }
  },

  /**
   * Clear screenshot history
   */
  async clearHistory() {
    try {
      await chrome.storage.local.remove(['screenshotHistory']);
    } catch (error) {
      console.error('Error clearing screenshot history:', error);
      throw error;
    }
  }
};

export default screenshotService;