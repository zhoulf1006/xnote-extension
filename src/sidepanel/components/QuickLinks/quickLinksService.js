/**
 * QuickLinks component service wrapper
 * Provides component-specific methods and utilities for the QuickLinks component
 */

import linksService from '../../../api/linksService.js'

class QuickLinksService {
  constructor() {
    this.linksService = linksService
  }

  /**
   * Get all links data
   */
  async getLinksData() {
    return await this.linksService.getLinksData()
  }

  /**
   * Save links data
   */
  async saveLinksData(data) {
    return await this.linksService.saveLinksData(data)
  }

  /**
   * Add a new category
   */
  async addCategory(categoryName) {
    return await this.linksService.addCategory(categoryName)
  }

  /**
   * Delete a category
   */
  async deleteCategory(categoryName) {
    return await this.linksService.deleteCategory(categoryName)
  }

  /**
   * Rename a category
   */
  async renameCategory(oldName, newName) {
    return await this.linksService.renameCategory(oldName, newName)
  }

  /**
   * Add a link to a category
   */
  async addLink(categoryName, linkName, linkUrl) {
    return await this.linksService.addLink(categoryName, linkName, linkUrl)
  }

  /**
   * Update a link
   */
  async updateLink(categoryName, oldUrl, newName, newUrl) {
    return await this.linksService.updateLink(categoryName, oldUrl, newName, newUrl)
  }

  /**
   * Delete a link
   */
  async deleteLink(categoryName, linkUrl) {
    return await this.linksService.deleteLink(categoryName, linkUrl)
  }

  /**
   * Save current page to a category
   */
  async saveCurrentPage(categoryName, customTitle = null) {
    return await this.linksService.saveCurrentPage(categoryName, customTitle)
  }

  /**
   * Get categories list
   */
  async getCategories() {
    return await this.linksService.getCategories()
  }

  /**
   * Get links for a specific category
   */
  async getCategoryLinks(categoryName) {
    return await this.linksService.getCategoryLinks(categoryName)
  }

  /**
   * Get storage information
   */
  async getStorageInfo() {
    return await this.linksService.getStorageInfo()
  }

  /**
   * Test storage functionality
   */
  async testStorage() {
    return await this.linksService.testStorage()
  }

  /**
   * Component-specific utility: Show save page dialog
   */
  showSavePageDialog(pageInfo, categories) {
    if (!categories || categories.length === 0) {
      throw new Error('No categories available. Please add a category first.')
    }
    
    // Simple prompt for category selection (could be enhanced with a proper modal)
    const categoryList = categories.map((cat, idx) => `${idx + 1}. ${cat.name}`).join('\n')
    const categoryIndex = prompt(
      `Save "${pageInfo.title}" to which category?\n\nOptions:\n${categoryList}\n\nEnter the number:`
    )
    
    if (categoryIndex && !isNaN(categoryIndex)) {
      const selectedIndex = parseInt(categoryIndex) - 1
      if (selectedIndex >= 0 && selectedIndex < categories.length) {
        return categories[selectedIndex].name
      }
    }
    
    return null
  }

  /**
   * Component-specific utility: Send notification to background script
   */
  async sendNotification(action, data = {}) {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      try {
        await chrome.runtime.sendMessage({
          action,
          ...data
        })
      } catch (error) {
        console.warn('Failed to send notification:', error.message)
        // Fail silently - notifications are not critical
      }
    }
  }

  /**
   * Component-specific utility: Format error messages for UI display
   */
  formatError(error) {
    if (typeof error === 'string') {
      return error
    }
    
    if (error.message) {
      // Handle common error types with user-friendly messages
      if (error.message.includes('Storage quota exceeded')) {
        return 'Storage limit reached. Please delete some links or categories.'
      }
      if (error.message.includes('Category already exists')) {
        return 'A category with this name already exists.'
      }
      if (error.message.includes('Link already exists')) {
        return 'This link already exists in the category.'
      }
      if (error.message.includes('Invalid URL')) {
        return 'Please enter a valid URL (e.g., https://example.com)'
      }
      if (error.message.includes('Category not found')) {
        return 'Category not found. Please refresh and try again.'
      }
      if (error.message.includes('Link not found')) {
        return 'Link not found. Please refresh and try again.'
      }
      
      return error.message
    }
    
    return 'An unexpected error occurred. Please try again.'
  }

  /**
   * Component-specific utility: Validate category name for UI
   */
  validateCategoryNameUI(name) {
    if (!name || !name.trim()) {
      return 'Category name is required'
    }
    
    if (name.trim().length > 100) {
      return 'Category name is too long (max 100 characters)'
    }
    
    return null
  }

  /**
   * Component-specific utility: Validate link data for UI
   */
  validateLinkDataUI(name, url) {
    if (!name || !name.trim()) {
      return 'Link name is required'
    }
    
    if (!url || !url.trim()) {
      return 'Link URL is required'
    }
    
    if (name.trim().length > 200) {
      return 'Link name is too long (max 200 characters)'
    }
    
    if (url.trim().length > 2000) {
      return 'Link URL is too long (max 2000 characters)'
    }
    
    // Basic URL validation
    try {
      new URL(url.trim())
    } catch {
      return 'Please enter a valid URL (e.g., https://example.com)'
    }
    
    return null
  }
}

export default new QuickLinksService()