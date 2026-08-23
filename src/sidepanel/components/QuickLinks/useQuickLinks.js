/**
 * QuickLinks component composable
 * Provides reactive state management and methods for the QuickLinks component
 */

import { ref, reactive, nextTick, onMounted, computed } from 'vue'
import quickLinksService from './quickLinksService.js'
import { confirmAction } from '../../composables/useConfirm.js'

export function useQuickLinks() {
  // Data refs
  const quickLinksData = ref(null)
  const error = ref(null)
  const loading = ref(false)
  const expandedCategory = ref(null)

  // Edit mode
  const editMode = ref(false)
  const showAddCategory = ref(false)

  // Category management
  const newCategoryName = ref('')
  const editingCategory = reactive({})
  const editingCategoryName = ref('')

  // Link management
  const showAddLink = reactive({})
  const newLink = reactive({ name: '', url: '' })
  const editingLink = reactive({})
  const editingLinkData = reactive({ name: '', url: '' })

  // Current tab management
  const showAddCurrentTab = reactive({})
  const currentTabData = reactive({
    name: '',
    url: '',
    categoryName: ''
  })

  // Search state
  const searchQuery = ref('')

  // UI Methods - Accordion behavior (only one category expanded at a time)
  const toggleModel = (modelName) => {
    if (expandedCategory.value === modelName) {
      // If clicking the expanded category, collapse it
      expandedCategory.value = null
    } else {
      // Expand the clicked category (automatically collapses others)
      expandedCategory.value = modelName
    }
  }

  // Helper to check if a category is expanded
  const isCategoryExpanded = (modelName) => {
    return expandedCategory.value === modelName
  }

  const toggleEditMode = () => {
    editMode.value = !editMode.value
    if (!editMode.value) {
      // Clear all editing states when exiting edit mode
      Object.keys(editingCategory).forEach(key => delete editingCategory[key])
      Object.keys(editingLink).forEach(key => delete editingLink[key])
      Object.keys(showAddLink).forEach(key => delete showAddLink[key])
      Object.keys(showAddCurrentTab).forEach(key => delete showAddCurrentTab[key])
    }
  }

  // Data loading
  const loadQuickLinks = async () => {
    try {
      loading.value = true
      error.value = null
      quickLinksData.value = await quickLinksService.getLinksData()

      // Set first category as expanded by default (accordion behavior)
      if (quickLinksData.value?.models?.length > 0 && !expandedCategory.value) {
        expandedCategory.value = quickLinksData.value.models[0].name
      }
    } catch (err) {
      console.error('Error loading QuickLinks:', err)
      error.value = quickLinksService.formatError(err)
    } finally {
      loading.value = false
    }
  }

  // Category Management
  const addCategory = async () => {
    const validationError = quickLinksService.validateCategoryNameUI(newCategoryName.value)
    if (validationError) {
      error.value = validationError
      return
    }

    try {
      const newCategory = await quickLinksService.addCategory(newCategoryName.value.trim())
      await loadQuickLinks()
      
      // Expand the newly added category
      expandedCategory.value = newCategory.name
      
      showAddCategory.value = false
      newCategoryName.value = ''
      error.value = null
    } catch (err) {
      error.value = quickLinksService.formatError(err)
    }
  }

  const startEditCategory = async (categoryName) => {
    editingCategory[categoryName] = true
    editingCategoryName.value = categoryName
    await nextTick()
    // Focus on the input
    const input = document.querySelector('.category-input')
    if (input) input.focus()
  }

  const saveCategory = async (oldName) => {
    const validationError = quickLinksService.validateCategoryNameUI(editingCategoryName.value)
    if (validationError) {
      error.value = validationError
      return
    }

    try {
      await quickLinksService.renameCategory(oldName, editingCategoryName.value.trim())
      await loadQuickLinks()
      delete editingCategory[oldName]
      editingCategoryName.value = ''
      error.value = null
    } catch (err) {
      error.value = quickLinksService.formatError(err)
    }
  }

  const cancelEditCategory = (categoryName) => {
    delete editingCategory[categoryName]
    editingCategoryName.value = ''
  }

  const deleteCategory = async (categoryName) => {
    // Deleting a category removes its links too, so name the cost in the prompt
    const linkCount = quickLinksData.value?.models
      ?.find(model => model.name === categoryName)?.links?.length || 0
    const message = linkCount > 0
      ? `Delete the category "${categoryName}" and the ${linkCount} link${linkCount === 1 ? '' : 's'} inside it?`
      : `Are you sure you want to delete the category "${categoryName}"?`

    if (!(await confirmAction(message))) return

    try {
      await quickLinksService.deleteCategory(categoryName)
      await loadQuickLinks()
      error.value = null
    } catch (err) {
      error.value = quickLinksService.formatError(err)
    }
  }

  // Link Management
  const addLink = async (categoryName) => {
    const nameValidation = quickLinksService.validateLinkDataUI(newLink.name, newLink.url)
    if (nameValidation) {
      error.value = nameValidation
      return
    }

    try {
      await quickLinksService.addLink(categoryName, newLink.name.trim(), newLink.url.trim())
      await loadQuickLinks()
      cancelAddLink(categoryName)
      error.value = null
    } catch (err) {
      error.value = quickLinksService.formatError(err)
    }
  }

  const cancelAddLink = (categoryName) => {
    delete showAddLink[categoryName]
    newLink.name = ''
    newLink.url = ''
  }

  const startEditLink = (categoryName, link) => {
    editingLink[link.url] = true
    editingLinkData.name = link.name
    editingLinkData.url = link.url
  }

  const saveLink = async (categoryName, oldUrl) => {
    const validationError = quickLinksService.validateLinkDataUI(editingLinkData.name, editingLinkData.url)
    if (validationError) {
      error.value = validationError
      return
    }

    try {
      await quickLinksService.updateLink(
        categoryName, 
        oldUrl, 
        editingLinkData.name.trim(), 
        editingLinkData.url.trim()
      )
      await loadQuickLinks()
      delete editingLink[oldUrl]
      editingLinkData.name = ''
      editingLinkData.url = ''
      error.value = null
    } catch (err) {
      error.value = quickLinksService.formatError(err)
    }
  }

  const cancelEditLink = (linkUrl) => {
    delete editingLink[linkUrl]
    editingLinkData.name = ''
    editingLinkData.url = ''
  }

  const deleteLink = async (categoryName, linkUrl) => {
    if (!(await confirmAction('Are you sure you want to delete this link?'))) return

    try {
      await quickLinksService.deleteLink(categoryName, linkUrl)
      await loadQuickLinks()
      error.value = null
    } catch (err) {
      error.value = quickLinksService.formatError(err)
    }
  }

  // Current Tab Methods
  /**
   * Get current active tab information via Chrome API
   * @returns {Object|null} Object with {title, url} or null if unavailable
   */
  const getCurrentTabInfo = async () => {
    try {
      // Check Chrome API availability
      if (typeof chrome === 'undefined' || !chrome.tabs) {
        console.warn('Chrome tabs API not available')
        return null
      }

      // Query active tab in current window
      const [activeTab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
      })

      if (!activeTab) {
        console.warn('No active tab found')
        return null
      }

      return {
        title: activeTab.title || '',
        url: activeTab.url || ''
      }
    } catch (error) {
      console.error('Error getting current tab:', error)
      return null
    }
  }

  /**
   * Validate that tab URL is appropriate for saving as a link
   * Blocks chrome://, file://, and other restricted URL schemes
   * @param {string} url - The URL to validate
   * @returns {string|null} Error message or null if valid
   */
  const validateTabUrl = (url) => {
    if (!url) {
      return 'No URL available for current tab'
    }

    // List of restricted URL schemes that should not be saved
    const restrictedSchemes = [
      'chrome://',
      'chrome-extension://',
      'edge://',
      'about:',
      'file://',
      'view-source:'
    ]

    const lowerUrl = url.toLowerCase()

    // Check if URL starts with any restricted scheme
    for (const scheme of restrictedSchemes) {
      if (lowerUrl.startsWith(scheme)) {
        return `Cannot save ${scheme} URLs. Please navigate to a regular webpage.`
      }
    }

    // Only allow HTTP and HTTPS
    if (!lowerUrl.startsWith('http://') && !lowerUrl.startsWith('https://')) {
      return 'Only HTTP/HTTPS URLs can be saved'
    }

    return null // Valid
  }

  /**
   * Show inline form to add current tab with pre-filled data
   * Fetches current tab info, validates URL, and displays editable form
   * @param {string} categoryName - The category to add the link to
   */
  const showAddCurrentTabForm = async (categoryName) => {
    try {
      error.value = null

      // Check if running in extension context
      if (typeof chrome === 'undefined' || !chrome.tabs) {
        error.value = 'This feature only works in the Chrome extension environment'
        return
      }

      // Get current tab information
      const tabInfo = await getCurrentTabInfo()
      if (!tabInfo) {
        error.value = 'Could not retrieve current tab information. Please try again.'
        return
      }

      // Validate URL scheme (block chrome://, file://, etc.)
      const urlValidationError = validateTabUrl(tabInfo.url)
      if (urlValidationError) {
        error.value = urlValidationError
        return
      }

      // Pre-fill form data with tab information
      currentTabData.name = tabInfo.title || 'Untitled Page'
      currentTabData.url = tabInfo.url
      currentTabData.categoryName = categoryName

      // Show the inline form
      showAddCurrentTab[categoryName] = true

      // Auto-focus and select text in name input for easy editing
      await nextTick()
      const input = document.querySelector('.current-tab-name-input')
      if (input) {
        input.select() // Selects all text so user can immediately start typing
      }
    } catch (err) {
      console.error('Error showing add current tab form:', err)
      error.value = quickLinksService.formatError(err)
    }
  }

  /**
   * Save current tab as a link to the category with user's edited title
   */
  const addCurrentTabLink = async () => {
    const categoryName = currentTabData.categoryName

    // Validate link data using existing validation
    const validationError = quickLinksService.validateLinkDataUI(
      currentTabData.name,
      currentTabData.url
    )
    if (validationError) {
      error.value = validationError
      return
    }

    try {
      // Add link to category
      await quickLinksService.addLink(
        categoryName,
        currentTabData.name.trim(),
        currentTabData.url.trim()
      )

      // Reload data to reflect changes
      await loadQuickLinks()

      // Store the name before clearing
      const savedName = currentTabData.name

      // Close form and clear data
      cancelAddCurrentTab(categoryName)

      // Show temporary success message
      error.value = null
      const successMessage = `Added "${savedName}" to ${categoryName}`
      error.value = successMessage

      // Auto-dismiss success message after 3 seconds
      setTimeout(() => {
        if (error.value === successMessage) {
          error.value = null
        }
      }, 3000)
    } catch (err) {
      error.value = quickLinksService.formatError(err)
    }
  }

  /**
   * Cancel adding current tab and reset form state
   * @param {string} categoryName - The category whose form should be closed
   */
  const cancelAddCurrentTab = (categoryName) => {
    delete showAddCurrentTab[categoryName]
    currentTabData.name = ''
    currentTabData.url = ''
    currentTabData.categoryName = ''
  }

  // Save current page
  const saveCurrentPageToCategory = async (categoryName) => {
    try {
      const savedLink = await quickLinksService.saveCurrentPage(categoryName)
      await loadQuickLinks()
      
      // Send success notification
      await quickLinksService.sendNotification('notifyPageSaved', {
        categoryName: categoryName
      })
      
      error.value = null
      // Show success message briefly
      const originalError = error.value
      error.value = `Saved "${savedLink.name}" to ${categoryName}`
      setTimeout(() => {
        if (error.value === `Saved "${savedLink.name}" to ${categoryName}`) {
          error.value = originalError
        }
      }, 3000)
    } catch (err) {
      // Send error notification
      await quickLinksService.sendNotification('notifyPageSaveError', {
        error: err.message
      })
      error.value = quickLinksService.formatError(err)
    }
  }

  // Save page dialog functionality
  const showSavePageDialog = (pageInfo) => {
    if (!quickLinksData.value?.models?.length) {
      error.value = 'No categories available. Please add a category first.'
      return
    }
    
    try {
      const categoryName = quickLinksService.showSavePageDialog(pageInfo, quickLinksData.value.models)
      if (categoryName) {
        savePageToCategory(categoryName, pageInfo.title, pageInfo.url)
      }
    } catch (err) {
      error.value = quickLinksService.formatError(err)
    }
  }

  const savePageToCategory = async (categoryName, title, url) => {
    try {
      await quickLinksService.addLink(categoryName, title, url)
      await loadQuickLinks()
      
      // Send success notification
      await quickLinksService.sendNotification('notifyPageSaved', {
        categoryName: categoryName
      })
      
      error.value = null
    } catch (err) {
      // Send error notification
      await quickLinksService.sendNotification('notifyPageSaveError', {
        error: err.message
      })
      error.value = quickLinksService.formatError(err)
    }
  }

  // Initialize component
  const initialize = async () => {
    await loadQuickLinks()
    
    // Listen for messages from background script
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'showSavePageDialog') {
          // Show a modal to select category for saving the page
          showSavePageDialog(request.pageInfo)
        }
      })
    }
  }

  // Computed property for filtered models using Vue-native search
  const filteredModels = computed(() => {
    // If no search query, return all categories
    if (!searchQuery.value || searchQuery.value.trim() === '') {
      return quickLinksData.value?.models || []
    }

    // Normalize search query for case-insensitive matching
    const query = searchQuery.value.toLowerCase().trim()

    // Filter categories and their links
    const filtered = []

    quickLinksData.value?.models?.forEach(category => {
      // Check if category name matches
      const categoryMatches = category.name.toLowerCase().includes(query)

      // Filter links that match in name or URL
      const matchingLinks = category.links?.filter(link => {
        const nameMatches = link.name.toLowerCase().includes(query)
        const urlMatches = link.url.toLowerCase().includes(query)
        return nameMatches || urlMatches
      }) || []

      // Include category if it matches OR has matching links
      if (categoryMatches || matchingLinks.length > 0) {
        filtered.push({
          name: category.name,
          links: categoryMatches ? category.links : matchingLinks,
          createdAt: category.createdAt
        })
      }
    })

    // Auto-expand first category with results
    if (filtered.length > 0 && searchQuery.value) {
      expandedCategory.value = filtered[0].name
    }

    return filtered
  })

  // Computed property for search results count
  const searchResultsCount = computed(() => {
    if (!searchQuery.value) return 0
    return filteredModels.value.reduce((total, category) => {
      return total + (category.links?.length || 0)
    }, 0)
  })

  // Computed property for category count with results
  const searchResultsCategoryCount = computed(() => {
    if (!searchQuery.value) return 0
    return filteredModels.value.length
  })

  // Search methods
  const onSearchInput = () => {
    // Auto-expand first category when searching
    if (searchQuery.value && filteredModels.value.length > 0) {
      expandedCategory.value = filteredModels.value[0].name
    }
  }

  const clearSearch = () => {
    searchQuery.value = ''
    expandedCategory.value = null // Reset accordion state
  }


  return {
    // State
    quickLinksData,
    error,
    loading,
    expandedCategory,
    editMode,
    showAddCategory,
    newCategoryName,
    editingCategory,
    editingCategoryName,
    showAddLink,
    newLink,
    editingLink,
    editingLinkData,
    showAddCurrentTab,      // NEW
    currentTabData,         // NEW

    // Search State
    searchQuery,
    filteredModels,
    searchResultsCount,
    searchResultsCategoryCount,

    // UI Methods
    toggleModel,
    isCategoryExpanded,
    toggleEditMode,

    // Data Methods
    loadQuickLinks,

    // Category Methods
    addCategory,
    startEditCategory,
    saveCategory,
    cancelEditCategory,
    deleteCategory,

    // Link Methods
    addLink,
    cancelAddLink,
    startEditLink,
    saveLink,
    cancelEditLink,
    deleteLink,

    // Current Tab Methods   // NEW SECTION
    showAddCurrentTabForm,
    addCurrentTabLink,
    cancelAddCurrentTab,

    // Page Saving Methods
    saveCurrentPageToCategory,
    showSavePageDialog,
    savePageToCategory,

    // Search Methods
    onSearchInput,
    clearSearch,

    // Initialization
    initialize
  }
}