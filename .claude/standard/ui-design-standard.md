# HN Sidebar Vue - UI Design Standard

This comprehensive UI design standard document combines guidelines from UX.md, DEVELOPMENT_RULES.md, and actual implementation patterns found in the codebase.

## 🎨 Color System

### Brand Colors (Purple Theme)

| Color | Hex/RGBA | Usage |
|-------|----------|-------|
| **Primary Purple** | `#673ab7` | Navigation active state, borders, primary selections |
| **Purple Accent** | `#ba92ff` | Buttons, hover states, focus borders |
| **Medium Purple** | `#8b5cdd` | Secondary buttons |
| **Light Purple BG** | `rgba(103, 58, 183, 0.15)` | Navigation sidebar background, category headers |
| **Very Light Purple** | `rgba(103, 58, 183, 0.1)` | Selected provider backgrounds |
| **Purple Hover** | `rgba(195, 175, 229, 0.85)` | Navigation item hover |
| **Purple Active** | `rgba(156, 130, 202, 0.85)` | Navigation item active |

### Interactive State Colors

#### Blue (Info/User Actions)
| Color | Hex | Usage |
|-------|-----|-------|
| **Bright Blue** | `#2196f3` | User messages, primary buttons, active selections |
| **Blue Hover** | `#1976d2` | Button hover states |
| **Link Blue** | `#1a0dab` | HackerNews story links |
| **Light Blue BG** | `#c6e5fc` | Currency box backgrounds |
| **Info Blue BG** | `#f0f8ff` | Information backgrounds |

#### Green (Success/Configured)
| Color | Hex | Usage |
|-------|-----|-------|
| **Success Green** | `#4caf50` | Configured status, success states |
| **Green Hover** | `#c8e6c9` | Success button hover |
| **Dark Green** | `#2e7d32` | Edit/save buttons |
| **Light Green BG** | `#e8f5e8` | Add/save button backgrounds |
| **CN Market Green** | `#52c41a` | Positive rates (Chinese convention) |

#### Red/Pink (Error/Delete)
| Color | Hex | Usage |
|-------|-----|-------|
| **Error Red** | `#e03131` | Error messages |
| **Delete Pink** | `#d63384` | Delete button text |
| **Light Pink BG** | `#ffeaea` | Delete button backgrounds |
| **Material Red** | `#f44336` | Error states, clear buttons |
| **CN Market Red** | `#ff4d4f` | Negative rates (Chinese convention) |

#### Yellow/Orange (Warning/Special)
| Color | Hex | Usage |
|-------|-----|-------|
| **Amber** | `#ffc107` | Favorite stars, active states |
| **Light Yellow BG** | `#fff3cd` | Bookmark backgrounds |
| **Orange** | `#fa8c16` | Currency values, financial data |
| **HN Orange** | `#ff6600` | HackerNews link hover |

### Neutral Colors

| Color | Hex | Usage |
|-------|-----|-------|
| **White** | `#ffffff` | Primary backgrounds, cards |
| **Off-White** | `#f8f9fa` | Sidebar background, disabled states |
| **Light Gray** | `#f5f5f5` | Secondary backgrounds |
| **Assistant Gray** | `#f1f3f5` | Assistant message backgrounds |
| **Border Gray** | `#dee2e6` | Standard borders |
| **Medium Gray** | `#adb5bd` | Secondary borders, metadata |
| **Dark Gray** | `#6c757d` | Secondary text, metadata |
| **Text Gray** | `#495057` | Primary text, headings |
| **Dark Text** | `#333333` | Body text |

## 📐 Typography

### Font Stack
```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
             Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
```

### Font Sizes
| Size | Usage |
|------|-------|
| **16px** | Navigation icons, large headings (h2 in modals) |
| **15px** | H1 headings |
| **14px** | Labels, section headings, standard content |
| **13px** | Default text, inputs, buttons |
| **12px** | Metadata, tooltips, timestamps, small text |
| **11px** | API key info, very small metadata |

### Font Weights
| Weight | Usage |
|--------|-------|
| **700 (bold)** | H1 headings |
| **500 (medium)** | Active states, important values, selected items |
| **400 (normal)** | Default text |

### Line Heights
| Height | Usage |
|--------|-------|
| **1.8** | Translation results |
| **1.5** | Default, message text |
| **1.4** | Story links, markdown content |

## 📏 Spacing System

### Base Unit: 4px
The entire spacing system is based on a 4px grid for consistency.

### Padding Scale
| Size | Value | Usage |
|------|-------|-------|
| **xs** | 2px | Icon buttons, minimal padding |
| **sm** | 4px | Small elements, tight spacing |
| **md** | 6px | Form inputs, standard buttons |
| **base** | 8px | Default padding, containers |
| **lg** | 12px | Message content, larger elements |
| **xl** | 16px | Section padding |
| **2xl** | 24px | Modal padding |

### Gap Scale
| Size | Value | Usage |
|------|-------|-------|
| **xs** | 2px | Minimal gaps |
| **sm** | 4px | Standard small gaps |
| **base** | 8px | Default gaps between elements |
| **lg** | 12px | Larger section gaps |

### Margins
- **Standard margin**: 8px
- **Section margin**: 16px
- **Minimal margin**: 4px
- **Navigation item margin**: 2px 0

## 🔲 Border System

### Border Radius
| Size | Value | Usage |
|------|-------|-------|
| **xs** | 2px | Minimal rounding |
| **sm** | 3px | Small inputs |
| **base** | 4px | Default for all elements |
| **md** | 6px | Larger elements, cards |
| **lg** | 8px | Modals, large containers |
| **xl** | 12px | Message bubbles, pills |
| **2xl** | 16px | Filter buttons (pill shape) |

### Border Styles
```css
/* Standard border */
border: 1px solid #dee2e6;

/* Focus border */
border: 1px solid #ba92ff;
box-shadow: 0 0 0 2px rgba(186, 146, 255, 0.25);

/* Purple theme border */
border: 1px solid rgba(103, 58, 183, 0.1);
```

## 🎭 Shadow System

| Type | Value | Usage |
|------|-------|-------|
| **Subtle** | `0 2px 4px rgba(103, 58, 183, 0.08)` | Category headers |
| **Standard** | `0 2px 8px rgba(0, 0, 0, 0.08)` | Cards, tooltips |
| **Modal** | `0 4px 16px rgba(0, 0, 0, 0.1)` | Modal overlays |
| **Navigation** | `1px 0 0 rgba(255, 255, 255, 0.8)` | Sidebar edge |

## 🧭 Layout Components

### Navigation Sidebar
```css
.nav-menu {
  width: 48px;
  background: rgba(103, 58, 183, 0.15);
  backdrop-filter: blur(8px);
  padding: 8px 0;
  box-shadow: 1px 0 0 rgba(255, 255, 255, 0.8);
}

.nav-item {
  height: 48px;
  padding: 8px;
  margin: 2px 0;
  transition: all 0.2s ease;
}
```

### Page Container
```css
.page-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 8px;
  max-width: 800px;
}
```

### Content Area
```css
.content {
  flex: 1;
  overflow-y: auto;
  background: #ffffff;
  border-radius: 4px;
  padding: 8px;
}
```

## 🔘 Button Styles

### Primary Button
```css
.button-primary {
  background: transparent;
  color: #673ab7;
  border: 1px solid #ba92ff;
  padding: 6px 12px;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.button-primary:hover {
  background: #ba92ff;
  color: white;
}
```

### Secondary Button
```css
.button-secondary {
  background: #8b5cdd;
  color: white;
  padding: 6px 12px;
  border-radius: 4px;
}

.button-secondary:hover {
  background: white;
  color: #8b5cdd;
  border: 1px solid #8b5cdd;
}
```

### Action Buttons
```css
/* Save/Add */
.button-save {
  background: #e8f5e8;
  color: #2e7d32;
}
.button-save:hover {
  background: #c8e6c9;
}

/* Delete */
.button-delete {
  background: #ffeaea;
  color: #d63384;
}
.button-delete:hover {
  background: #ffcccb;
}

/* Cancel */
.button-cancel {
  background: #f0f0f0;
  color: #495057;
}
.button-cancel:hover {
  background: #e0e0e0;
}
```

## 📝 Form Elements

### Input Fields
```css
input, textarea {
  font-size: 13px;
  padding: 6px 8px;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  background: #ffffff;
  transition: all 0.2s ease;
}

input:focus, textarea:focus {
  border-color: #ba92ff;
  box-shadow: 0 0 0 2px rgba(186, 146, 255, 0.25);
  outline: none;
}

input:disabled {
  background: #f8f9fa;
  cursor: not-allowed;
}
```

## 💬 Message Components

### Chat Messages
```css
/* User Message */
.message-user {
  background: #2196f3;
  color: white;
  align-self: flex-end;
  max-width: 90%;
  border-radius: 12px 12px 4px 12px;
}

/* Assistant Message */
.message-assistant {
  background: #f1f3f5;
  color: #333;
  align-self: flex-start;
  max-width: 90%;
  border-radius: 12px 12px 12px 4px;
}
```

## 🎬 Animations & Transitions

### Standard Transitions
```css
/* Default */
transition: all 0.2s ease;

/* Quick */
transition: all 0.1s ease;

/* Tooltip */
transition: all 0.15s ease;
```

### Special Animations
```css
/* Button hover scale */
transform: scale(1.05);

/* Tooltip slide */
transform: translateX(8px);

/* Typing indicator */
@keyframes bounce {
  0%, 80%, 100% { transform: translateY(0); }
  40% { transform: translateY(-4px); }
}

/* Refresh spin */
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
```

## 📱 Responsive Guidelines

### Breakpoints
- **Mobile**: Not applicable (Chrome extension side panel)
- **Default**: 48px sidebar + flexible content area
- **Max content width**: 800px

### Overflow Handling
```css
/* Content scrolling */
overflow-y: auto;
overflow-x: hidden;

/* Text truncation */
white-space: nowrap;
overflow: hidden;
text-overflow: ellipsis;
```

## ✅ Component Checklist

When implementing UI components, ensure:

### Visual Consistency
- [ ] Uses colors from defined palette
- [ ] Follows typography scale
- [ ] Maintains 4px spacing grid
- [ ] Uses standard border radius values
- [ ] Applies consistent shadows

### Interactive States
- [ ] Default state defined
- [ ] Hover state with visual feedback
- [ ] Active/selected state distinct
- [ ] Disabled state clearly indicated
- [ ] Focus state for accessibility

### Transitions
- [ ] Smooth transitions (0.2s ease)
- [ ] No jarring animations
- [ ] Consistent timing across similar elements

### Layout
- [ ] Flexbox for alignment
- [ ] Proper overflow handling
- [ ] Responsive within side panel constraints
- [ ] Maximum 8px padding/margins

## 🚫 Design Don'ts

- ❌ Don't exceed 8px margins/padding without justification
- ❌ Don't use font sizes outside the scale
- ❌ Don't create custom shadows without following the system
- ❌ Don't use border-radius values outside the scale
- ❌ Don't add emojis unless explicitly requested
- ❌ Don't ignore hover/active states
- ❌ Don't use inline styles when classes are available

## 📊 Quick Reference Tables

### Color Usage by Feature
| Feature | Primary | Secondary | Accent |
|---------|---------|-----------|--------|
| Navigation | Purple theme | White | - |
| Chat | Blue (user) | Gray (assistant) | Purple |
| Finance | Orange | Green/Red (CN) | Blue |
| HackerNews | Orange | Gray | Blue |
| Buttons | Purple | Green/Red/Gray | - |
| Forms | White | Gray borders | Purple focus |

### Spacing Quick Guide
| Element | Padding | Margin | Gap |
|---------|---------|--------|-----|
| Container | 8px | 0 | - |
| Button | 6px 12px | 4px | - |
| Input | 6px 8px | 4px | - |
| Card | 8px | 8px | - |
| Nav Item | 8px | 2px 0 | - |
| Section | 16px | 16px | 8px |

This standard should be followed for all UI implementations to maintain consistency across the application.