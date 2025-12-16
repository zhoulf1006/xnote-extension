# QuickLinks Component

The QuickLinks component provides a comprehensive links management system for the Chrome extension sidebar. It allows users to organize bookmarks into categories with full CRUD operations and Chrome storage sync.

## Features

### Core Functionality
- **Category Management**: Create, rename, delete categories with validation
- **Link Management**: Add, edit, delete links within categories
- **Accordion Interface**: Single-category expansion for clean navigation
- **Chrome Storage Sync**: Cross-device synchronization with local fallback
- **Save Current Page**: Quick bookmark current webpage to any category

### User Interface
- **Compact Design**: Optimized for sidebar display with minimal padding
- **Purple Theme**: Consistent with extension design language
- **Edit Mode**: Toggle between view and edit modes
- **Modern Buttons**: Icon-based actions with hover effects
- **Form Validation**: Real-time validation for names and URLs

### Storage Features
- **Chrome Sync Priority**: Automatic sync across devices when possible
- **Local Fallback**: Falls back to local storage if sync quota exceeded
- **Quota Management**: Monitors storage usage and handles limits gracefully
- **Data Migration**: Automatic migration between storage types

### Integration Features
- **Context Menu**: Save pages via right-click context menu
- **Background Script**: Integration with Chrome extension background processes
- **Content Script**: Page notifications for save operations
- **Tab Management**: Current page detection and saving

## File Structure

```
QuickLinks/
├── README.md            # This documentation
├── index.vue            # Main component file
├── styles.css           # Component-specific styles
├── useQuickLinks.js     # Composition API composable
└── quickLinksService.js # Local service wrapper
```

## Usage

```vue
<template>
  <QuickLinks />
</template>

<script setup>
import QuickLinks from './components/QuickLinks/index.vue'
</script>
```

## API

### Props
- None (self-contained component)

### Events
- None (internal state management)

### Storage Schema

```javascript
{
  models: [
    {
      name: "Category Name",
      links: [
        {
          name: "Link Name",
          url: "https://example.com",
          createdAt: "2024-01-01T00:00:00.000Z"
        }
      ],
      createdAt: "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

## Error Handling

- **Storage Quota**: Automatically switches to local storage when sync quota exceeded
- **Network Issues**: Graceful fallback to cached data
- **Validation Errors**: User-friendly error messages for invalid input
- **Connection Errors**: Retry mechanisms for Chrome runtime messaging

## Keyboard Shortcuts

- **Enter**: Save category/link when editing
- **Escape**: Cancel edit operation
- **Click outside**: Auto-save or cancel editing

## Accessibility

- Proper ARIA labels for interactive elements
- Keyboard navigation support
- High contrast button states
- Screen reader friendly structure