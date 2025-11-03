<template>
  <div class="page-container">
    <div class="header">
      <h1>Quick Links</h1>
      <div class="header-actions">
        <button @click="showAddCategory = true" class="btn btn-primary">
          Add
        </button>
        <button @click="toggleEditMode" class="btn" :class="editMode ? 'btn-secondary' : 'btn-outline'">
          <i class="fas" :class="editMode ? 'fa-check' : 'fa-edit'"></i>
          {{ editMode ? 'Done' : 'Edit' }}
        </button>
      </div>
    </div>

    <!-- Search filter (only shown in view mode) -->
    <div v-if="!editMode" class="search-container">
      <i class="fas fa-search search-icon"></i>
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Search links..."
        class="search-input"
        @input="onSearchInput"
      />
      <button
        v-if="searchQuery"
        @click="clearSearch"
        class="clear-btn"
        title="Clear search"
      >
        <i class="fas fa-times"></i>
      </button>
    </div>

    <!-- Search results summary -->
    <div v-if="searchQuery && !loading" class="search-summary">
      <span v-if="searchResultsCount > 0">
        Found {{ searchResultsCount }} {{ searchResultsCount === 1 ? 'link' : 'links' }}
        in {{ searchResultsCategoryCount }} {{ searchResultsCategoryCount === 1 ? 'category' : 'categories' }}
      </span>
      <span v-else class="no-results">
        No links found matching "{{ searchQuery }}"
      </span>
    </div>

    <div v-if="error" class="error">
      {{ error }}
    </div>

    <div v-if="loading" class="loading">
      Loading links...
    </div>

    <div v-else class="seglinks-container">
      <div v-for="model in filteredModels"
           :key="model.name"
           class="seg-model">
        <div class="seg-model-header"
             :class="{ 'collapsed': !isCategoryExpanded(model.name) }">
          <div class="model-header-content" @click="toggleModel(model.name)">
            <i class="fas"
               :class="isCategoryExpanded(model.name) ? 'fa-chevron-down' : 'fa-chevron-right'">
            </i>
            <span v-if="!editingCategory[model.name]">{{ model.name }}</span>
            <input v-else
                   v-model="editingCategoryName"
                   @keyup.enter="saveCategory(model.name)"
                   @keyup.esc="cancelEditCategory(model.name)"
                   @click.stop
                   class="category-input"
                   ref="categoryInput">
          </div>
          
          <div class="model-actions" @click.stop>
            <!-- Always show add link button -->
            <button @click="showAddLink[model.name] = true" 
                    class="btn-icon btn-add" 
                    title="Add link">
              <i class="fas fa-plus"></i>
            </button>
            
            <!-- Edit mode buttons -->
            <template v-if="editMode">
              <button v-if="!editingCategory[model.name]" 
                      @click="startEditCategory(model.name)" 
                      class="btn-icon btn-edit" 
                      title="Rename category">
                <i class="fas fa-pen"></i>
              </button>
              <template v-else>
                <button @click="saveCategory(model.name)" class="btn-icon btn-save" title="Save">
                  <i class="fas fa-check"></i>
                </button>
                <button @click="cancelEditCategory(model.name)" class="btn-icon btn-cancel" title="Cancel">
                  <i class="fas fa-xmark"></i>
                </button>
              </template>
              <button @click="deleteCategory(model.name)" 
                      class="btn-icon btn-delete" 
                      title="Delete category"
                      :disabled="model.links.length > 0">
                <i class="fas fa-trash-can"></i>
              </button>
              <button @click="saveCurrentPageToCategory(model.name)" 
                      class="btn-icon btn-bookmark" 
                      title="Save current page">
                <i class="fas fa-bookmark"></i>
              </button>
            </template>
          </div>
        </div>

        <!-- Add Link Form -->
        <div v-if="showAddLink[model.name]" class="add-link-form">
          <input v-model="newLink.name" 
                 placeholder="Link name" 
                 class="form-input">
          <input v-model="newLink.url" 
                 placeholder="Link URL" 
                 class="form-input">
          <div class="form-actions">
            <button @click="addLink(model.name)" class="btn btn-primary">Add</button>
            <button @click="cancelAddLink(model.name)" class="btn btn-outline">Cancel</button>
          </div>
        </div>

        <div class="seg-links-container"
             :class="{ 'hidden': !isCategoryExpanded(model.name) }">
          <div v-for="link in model.links"
               :key="link.url"
               class="seg-link-wrapper">
            
            <!-- Normal link display -->
            <a v-if="!editingLink[link.url]"
               :href="link.url"
               target="_blank"
               class="seg-link">
              <i class="fas fa-external-link-alt"></i>
              <span class="seg-link-name">{{ link.name }}</span>
            </a>

            <!-- Edit link form -->
            <div v-else class="edit-link-form">
              <input v-model="editingLinkData.name" 
                     placeholder="Link name" 
                     class="form-input">
              <input v-model="editingLinkData.url" 
                     placeholder="Link URL" 
                     class="form-input">
            </div>

            <!-- Link actions (edit mode) -->
            <div v-if="editMode" class="link-actions">
              <template v-if="!editingLink[link.url]">
                <button @click="startEditLink(model.name, link)" 
                        class="btn-icon btn-edit" 
                        title="Edit link">
                  <i class="fas fa-pen"></i>
                </button>
                <button @click="deleteLink(model.name, link.url)" 
                        class="btn-icon btn-delete" 
                        title="Delete link">
                  <i class="fas fa-trash-can"></i>
                </button>
              </template>
              <template v-else>
                <button @click="saveLink(model.name, link.url)" 
                        class="btn-icon btn-save" 
                        title="Save">
                  <i class="fas fa-check"></i>
                </button>
                <button @click="cancelEditLink(link.url)" 
                        class="btn-icon btn-cancel" 
                        title="Cancel">
                  <i class="fas fa-xmark"></i>
                </button>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Add Category Modal -->
    <div v-if="showAddCategory" class="modal-overlay" @click="showAddCategory = false">
      <div class="modal" @click.stop>
        <h2>Add New Category</h2>
        <input v-model="newCategoryName" 
               placeholder="Category name" 
               class="form-input"
               @keyup.enter="addCategory">
        <div class="modal-actions">
          <button @click="addCategory" class="btn btn-primary">Add Category</button>
          <button @click="showAddCategory = false" class="btn btn-outline">Cancel</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useQuickLinks } from './useQuickLinks.js'

// Destructure all composable methods and state
const {
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

  // Search Methods
  onSearchInput,
  clearSearch,

  // Initialization
  initialize
} = useQuickLinks()

onMounted(() => {
  initialize()
})
</script>

<style scoped>
@import './styles.css';
</style>