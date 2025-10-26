/**
 * Links management service for Chrome extension
 * Handles CRUD operations for categories and links with Chrome sync storage
 */

class LinksService {
  constructor() {
    this.STORAGE_KEY = 'seg_links_data'
    this.LOCAL_STORAGE_KEY = 'seg_links_data_local'
    this.isExtensionContext = typeof chrome !== 'undefined' && chrome.storage
    this.storageType = 'sync' // Will fallback to 'local' if sync fails
    
    // Chrome storage limits
    this.SYNC_QUOTA_BYTES = 102400 // 100KB total sync storage
    this.SYNC_ITEM_MAX_BYTES = 8192 // 8KB per item
    this.LOCAL_QUOTA_BYTES = 5242880 // 5MB local storage
  }

  /**
   * Check storage quota and determine best storage type
   */
  async checkStorageQuota() {
    if (!this.isExtensionContext) return
    
    try {
      // Check sync storage quota
      const syncUsage = await chrome.storage.sync.getBytesInUse()
      if (syncUsage >= this.SYNC_QUOTA_BYTES * 0.9) { // 90% full
        console.warn('Chrome sync storage is near quota limit, switching to local storage')
        this.storageType = 'local'
      }
    } catch (error) {
      console.warn('Cannot check sync storage quota, switching to local storage:', error)
      this.storageType = 'local'
    }
  }

  /**
   * Get storage interface based on current storage type
   */
  getStorageInterface() {
    if (!this.isExtensionContext) return null
    return this.storageType === 'sync' ? chrome.storage.sync : chrome.storage.local
  }

  /**
   * Get storage key based on current storage type
   */
  getStorageKey() {
    return this.storageType === 'sync' ? this.STORAGE_KEY : this.LOCAL_STORAGE_KEY
  }

  /**
   * Get all links data from storage with proper fallback handling
   */
  async getLinksData() {
    try {
      if (this.isExtensionContext) {
        await this.checkStorageQuota()
        
        // Try sync storage first
        try {
          const syncResult = await chrome.storage.sync.get(this.STORAGE_KEY)
          if (syncResult[this.STORAGE_KEY]) {
            this.storageType = 'sync'
            return syncResult[this.STORAGE_KEY]
          }
        } catch (syncError) {
          console.warn('Sync storage failed, trying local storage:', syncError)
        }
        
        // Fallback to local storage
        try {
          const localResult = await chrome.storage.local.get(this.LOCAL_STORAGE_KEY)
          if (localResult[this.LOCAL_STORAGE_KEY]) {
            this.storageType = 'local'
            return localResult[this.LOCAL_STORAGE_KEY]
          }
        } catch (localError) {
          console.warn('Local storage also failed:', localError)
        }
      }
      
      // Fallback to default data from JSON file
      console.log('Loading default data from JSON file')
      const response = await fetch('/data/seg_links.json')
      if (!response.ok) {
        throw new Error('Failed to load default links data')
      }
      const defaultData = await response.json()
      
      // Try to save default data to storage for future use
      if (this.isExtensionContext) {
        try {
          await this.saveLinksData(defaultData)
        } catch (saveError) {
          console.warn('Could not save default data to storage:', saveError)
        }
      }
      
      return defaultData
    } catch (error) {
      console.error('Error getting links data:', error)
      // Return minimal fallback data structure
      return {
        models: [{
          name: 'Default',
          links: []
        }]
      }
    }
  }

  /**
   * Check if data size exceeds storage limits
   */
  checkDataSize(data) {
    const dataSize = JSON.stringify(data).length
    if (this.storageType === 'sync' && dataSize > this.SYNC_ITEM_MAX_BYTES) {
      throw new Error(`Data size (${dataSize} bytes) exceeds sync storage limit (${this.SYNC_ITEM_MAX_BYTES} bytes). Consider reducing data or switching to local storage.`)
    }
    return dataSize
  }

  /**
   * Save links data to storage with comprehensive error handling
   */
  async saveLinksData(data) {
    if (!this.isExtensionContext) {
      console.log('Development mode: would save to storage:', data)
      return
    }

    try {
      // Validate data structure
      if (!data || !data.models || !Array.isArray(data.models)) {
        throw new Error('Invalid data structure: missing models array')
      }

      await this.checkStorageQuota()
      const dataSize = this.checkDataSize(data)
      
      const storageInterface = this.getStorageInterface()
      const storageKey = this.getStorageKey()
      
      // Try to save to current storage type
      try {
        await storageInterface.set({ [storageKey]: data })
        console.log(`Successfully saved ${dataSize} bytes to ${this.storageType} storage`)
        return
      } catch (saveError) {
        console.warn(`Failed to save to ${this.storageType} storage:`, saveError)
        
        // If sync storage failed, try local storage
        if (this.storageType === 'sync') {
          console.log('Attempting to save to local storage as fallback')
          this.storageType = 'local'
          
          try {
            await chrome.storage.local.set({ [this.LOCAL_STORAGE_KEY]: data })
            console.log(`Successfully saved ${dataSize} bytes to local storage (fallback)`)
            
            // Optionally migrate existing sync data to local
            try {
              const syncData = await chrome.storage.sync.get(this.STORAGE_KEY)
              if (syncData[this.STORAGE_KEY]) {
                await chrome.storage.sync.remove(this.STORAGE_KEY)
                console.log('Migrated and cleaned up sync storage')
              }
            } catch (migrationError) {
              console.warn('Could not clean up sync storage:', migrationError)
            }
            
            return
          } catch (localError) {
            console.error('Local storage also failed:', localError)
            throw new Error('Both sync and local storage failed')
          }
        } else {
          throw saveError
        }
      }
    } catch (error) {
      console.error('Error saving links data:', error)
      
      // Provide helpful error messages
      if (error.message.includes('QUOTA_BYTES_PER_ITEM quota exceeded')) {
        throw new Error('Storage quota exceeded. Please reduce the number of links or categories.')
      } else if (error.message.includes('QUOTA_BYTES quota exceeded')) {
        throw new Error('Chrome storage quota exceeded. Please clean up other extension data.')
      } else if (error.message.includes('Invalid data structure')) {
        throw error
      } else {
        throw new Error(`Storage operation failed: ${error.message}`)
      }
    }
  }

  /**
   * Get storage usage information
   */
  async getStorageInfo() {
    if (!this.isExtensionContext) {
      return { storageType: 'development', usage: 0, quota: 0 }
    }

    try {
      const storageInterface = this.getStorageInterface()
      const storageKey = this.getStorageKey()
      
      const usage = await storageInterface.getBytesInUse(storageKey)
      const quota = this.storageType === 'sync' ? this.SYNC_QUOTA_BYTES : this.LOCAL_QUOTA_BYTES
      
      return {
        storageType: this.storageType,
        usage,
        quota,
        usagePercent: Math.round((usage / quota) * 100)
      }
    } catch (error) {
      console.warn('Could not get storage info:', error)
      return { storageType: this.storageType, usage: 0, quota: 0, usagePercent: 0 }
    }
  }

  /**
   * Validate and sanitize category name
   */
  validateCategoryName(name) {
    if (!name || typeof name !== 'string') {
      throw new Error('Category name must be a non-empty string')
    }
    
    const sanitized = name.trim()
    if (sanitized.length === 0) {
      throw new Error('Category name cannot be empty')
    }
    
    if (sanitized.length > 100) {
      throw new Error('Category name too long (max 100 characters)')
    }
    
    return sanitized
  }

  /**
   * Validate and sanitize link data
   */
  validateLinkData(name, url) {
    if (!name || typeof name !== 'string') {
      throw new Error('Link name must be a non-empty string')
    }
    
    if (!url || typeof url !== 'string') {
      throw new Error('Link URL must be a non-empty string')
    }
    
    const sanitizedName = name.trim()
    const sanitizedUrl = url.trim()
    
    if (sanitizedName.length === 0) {
      throw new Error('Link name cannot be empty')
    }
    
    if (sanitizedUrl.length === 0) {
      throw new Error('Link URL cannot be empty')
    }
    
    if (sanitizedName.length > 200) {
      throw new Error('Link name too long (max 200 characters)')
    }
    
    if (sanitizedUrl.length > 2000) {
      throw new Error('Link URL too long (max 2000 characters)')
    }
    
    // Basic URL validation
    try {
      new URL(sanitizedUrl)
    } catch {
      throw new Error('Invalid URL format')
    }
    
    return { name: sanitizedName, url: sanitizedUrl }
  }

  /**
   * Add a new category with validation
   */
  async addCategory(categoryName) {
    try {
      const sanitizedName = this.validateCategoryName(categoryName)
      const data = await this.getLinksData()
      
      // Check if category already exists (case-insensitive)
      const existingCategory = data.models.find(
        model => model.name.toLowerCase() === sanitizedName.toLowerCase()
      )
      if (existingCategory) {
        throw new Error('Category already exists')
      }

      const newCategory = {
        name: sanitizedName,
        links: [],
        createdAt: new Date().toISOString()
      }

      data.models.push(newCategory)
      await this.saveLinksData(data)
      return newCategory
    } catch (error) {
      console.error('Error adding category:', error)
      throw error
    }
  }

  /**
   * Delete a category (only if it has no links)
   */
  async deleteCategory(categoryName) {
    const data = await this.getLinksData()
    const categoryIndex = data.models.findIndex(model => model.name === categoryName)
    
    if (categoryIndex === -1) {
      throw new Error('Category not found')
    }

    const category = data.models[categoryIndex]
    if (category.links.length > 0) {
      throw new Error('Cannot delete category with existing links. Please delete all links first.')
    }

    data.models.splice(categoryIndex, 1)
    await this.saveLinksData(data)
  }

  /**
   * Rename a category
   */
  async renameCategory(oldName, newName) {
    const data = await this.getLinksData()
    const category = data.models.find(model => model.name === oldName)
    
    if (!category) {
      throw new Error('Category not found')
    }

    // Check if new name already exists
    const existingCategory = data.models.find(model => model.name === newName && model.name !== oldName)
    if (existingCategory) {
      throw new Error('Category name already exists')
    }

    category.name = newName
    await this.saveLinksData(data)
  }

  /**
   * Add a link to a category with validation
   */
  async addLink(categoryName, linkName, linkUrl) {
    try {
      const sanitizedCategory = this.validateCategoryName(categoryName)
      const { name: sanitizedName, url: sanitizedUrl } = this.validateLinkData(linkName, linkUrl)
      
      const data = await this.getLinksData()
      const category = data.models.find(model => model.name === sanitizedCategory)
      
      if (!category) {
        throw new Error('Category not found')
      }

      // Check if link already exists in this category (case-insensitive URL)
      const existingLink = category.links.find(
        link => link.url.toLowerCase() === sanitizedUrl.toLowerCase()
      )
      if (existingLink) {
        throw new Error('Link already exists in this category')
      }

      const newLink = {
        name: sanitizedName,
        url: sanitizedUrl,
        createdAt: new Date().toISOString()
      }

      category.links.push(newLink)
      await this.saveLinksData(data)
      return newLink
    } catch (error) {
      console.error('Error adding link:', error)
      throw error
    }
  }

  /**
   * Update a link
   */
  async updateLink(categoryName, oldUrl, newName, newUrl) {
    const data = await this.getLinksData()
    const category = data.models.find(model => model.name === categoryName)
    
    if (!category) {
      throw new Error('Category not found')
    }

    const link = category.links.find(link => link.url === oldUrl)
    if (!link) {
      throw new Error('Link not found')
    }

    // Check if new URL already exists (if URL is being changed)
    if (newUrl !== oldUrl) {
      const existingLink = category.links.find(link => link.url === newUrl)
      if (existingLink) {
        throw new Error('Link URL already exists in this category')
      }
    }

    link.name = newName
    link.url = newUrl
    await this.saveLinksData(data)
  }

  /**
   * Delete a link from a category
   */
  async deleteLink(categoryName, linkUrl) {
    const data = await this.getLinksData()
    const category = data.models.find(model => model.name === categoryName)
    
    if (!category) {
      throw new Error('Category not found')
    }

    const linkIndex = category.links.findIndex(link => link.url === linkUrl)
    if (linkIndex === -1) {
      throw new Error('Link not found')
    }

    category.links.splice(linkIndex, 1)
    await this.saveLinksData(data)
  }

  /**
   * Save current page as a link to a category
   */
  async saveCurrentPage(categoryName, customTitle = null) {
    try {
      if (!this.isExtensionContext) {
        throw new Error('Save current page only works in extension context')
      }

      // Get active tab information
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!activeTab) {
        throw new Error('No active tab found')
      }

      const linkName = customTitle || activeTab.title || 'Untitled Page'
      const linkUrl = activeTab.url

      await this.addLink(categoryName, linkName, linkUrl)
      return { name: linkName, url: linkUrl }
    } catch (error) {
      console.error('Error saving current page:', error)
      throw error
    }
  }

  /**
   * Get categories list
   */
  async getCategories() {
    const data = await this.getLinksData()
    return data.models.map(model => ({
      name: model.name,
      linkCount: model.links.length
    }))
  }

  /**
   * Get links for a specific category
   */
  async getCategoryLinks(categoryName) {
    const data = await this.getLinksData()
    const category = data.models.find(model => model.name === categoryName)
    return category ? category.links : []
  }

  /**
   * Force migration from sync to local storage
   */
  async migrateToLocalStorage() {
    if (!this.isExtensionContext) {
      throw new Error('Migration only available in extension context')
    }

    try {
      // Get data from sync storage
      const syncResult = await chrome.storage.sync.get(this.STORAGE_KEY)
      if (!syncResult[this.STORAGE_KEY]) {
        throw new Error('No data found in sync storage')
      }

      const data = syncResult[this.STORAGE_KEY]
      
      // Save to local storage
      await chrome.storage.local.set({ [this.LOCAL_STORAGE_KEY]: data })
      
      // Remove from sync storage
      await chrome.storage.sync.remove(this.STORAGE_KEY)
      
      // Update storage type
      this.storageType = 'local'
      
      console.log('Successfully migrated data from sync to local storage')
      return data
    } catch (error) {
      console.error('Migration failed:', error)
      throw new Error(`Migration failed: ${error.message}`)
    }
  }

  /**
   * Test storage functionality and return diagnostics
   */
  async testStorage() {
    const results = {
      isExtensionContext: this.isExtensionContext,
      syncAvailable: false,
      localAvailable: false,
      currentStorageType: this.storageType,
      testData: null,
      errors: []
    }

    if (!this.isExtensionContext) {
      results.errors.push('Not in extension context')
      return results
    }

    // Test sync storage
    try {
      const testKey = 'test_sync_' + Date.now()
      const testValue = { test: true, timestamp: Date.now() }
      
      await chrome.storage.sync.set({ [testKey]: testValue })
      const retrieved = await chrome.storage.sync.get(testKey)
      await chrome.storage.sync.remove(testKey)
      
      if (retrieved[testKey] && retrieved[testKey].test === true) {
        results.syncAvailable = true
      }
    } catch (error) {
      results.errors.push(`Sync storage test failed: ${error.message}`)
    }

    // Test local storage
    try {
      const testKey = 'test_local_' + Date.now()
      const testValue = { test: true, timestamp: Date.now() }
      
      await chrome.storage.local.set({ [testKey]: testValue })
      const retrieved = await chrome.storage.local.get(testKey)
      await chrome.storage.local.remove(testKey)
      
      if (retrieved[testKey] && retrieved[testKey].test === true) {
        results.localAvailable = true
      }
    } catch (error) {
      results.errors.push(`Local storage test failed: ${error.message}`)
    }

    // Test actual data retrieval
    try {
      results.testData = await this.getLinksData()
    } catch (error) {
      results.errors.push(`Data retrieval test failed: ${error.message}`)
    }

    return results
  }

  /**
   * Clear all stored data (for testing/debugging)
   */
  async clearAllData() {
    if (!this.isExtensionContext) {
      console.log('Development mode: would clear all data')
      return
    }

    try {
      await chrome.storage.sync.remove(this.STORAGE_KEY)
      await chrome.storage.local.remove(this.LOCAL_STORAGE_KEY)
      console.log('All stored data cleared')
    } catch (error) {
      console.error('Error clearing data:', error)
      throw error
    }
  }
}

export default new LinksService()