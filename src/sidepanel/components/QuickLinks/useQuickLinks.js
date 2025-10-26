/**
 * QuickLinks component composable
 * Provides reactive state management and methods for the QuickLinks component
 */

import { ref, reactive, nextTick, onMounted } from 'vue'
import quickLinksService from './quickLinksService.js'

export function useQuickLinks() {
  // Data refs
  const segLinksData = ref(null)
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
    }
  }

  // Data loading
  const loadSegLinks = async () => {
    try {
      loading.value = true
      error.value = null
      segLinksData.value = await quickLinksService.getLinksData()
      
      // Set first category as expanded by default (accordion behavior)
      if (segLinksData.value?.models?.length > 0 && !expandedCategory.value) {
        expandedCategory.value = segLinksData.value.models[0].name
      }
    } catch (err) {
      console.error('Error loading SEG links:', err)
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
      await loadSegLinks()
      
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
      await loadSegLinks()
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
    if (!confirm(`Are you sure you want to delete the category "${categoryName}"?`)) {
      return
    }

    try {
      await quickLinksService.deleteCategory(categoryName)
      await loadSegLinks()
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
      await loadSegLinks()
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
      await loadSegLinks()
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
    if (!confirm('Are you sure you want to delete this link?')) {
      return
    }

    try {
      await quickLinksService.deleteLink(categoryName, linkUrl)
      await loadSegLinks()
      error.value = null
    } catch (err) {
      error.value = quickLinksService.formatError(err)
    }
  }

  // Save current page
  const saveCurrentPageToCategory = async (categoryName) => {
    try {
      const savedLink = await quickLinksService.saveCurrentPage(categoryName)
      await loadSegLinks()
      
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
    if (!segLinksData.value?.models?.length) {
      error.value = 'No categories available. Please add a category first.'
      return
    }
    
    try {
      const categoryName = quickLinksService.showSavePageDialog(pageInfo, segLinksData.value.models)
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
      await loadSegLinks()
      
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
  const initialize = () => {
    loadSegLinks()
    
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

  return {
    // State
    segLinksData,
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

    // UI Methods
    toggleModel,
    isCategoryExpanded,
    toggleEditMode,

    // Data Methods
    loadSegLinks,

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

    // Page Saving Methods
    saveCurrentPageToCategory,
    showSavePageDialog,
    savePageToCategory,

    // Initialization
    initialize
  }
}