# Test Guide for Clipboard Paste Feature

## Prerequisites
1. Extension built with `pnpm run build`
2. Load the extension in Chrome (chrome://extensions/ → Load unpacked → select `dist` folder)
3. Have an image ready to copy to clipboard

## Test Scenarios

### 1. Test Paste Button
1. Open the XNote Extension side panel (Ctrl+G / Cmd+G)
2. Navigate to "Screen Capture" tab
3. Copy an image to clipboard (from any app or website)
4. Click the green "Paste Image" button
5. **Expected**: Image should be pasted, processed, and text extracted

### 2. Test Keyboard Shortcut
1. Have the Screen Capture tab open
2. Copy an image to clipboard
3. Press Ctrl+V (Windows/Linux) or Cmd+V (Mac)
4. **Expected**: Image should be pasted automatically

### 3. Test Provider Validation
1. Switch to DeepSeek provider in LLM Config
2. Try to paste an image
3. **Expected**: Paste button should be disabled with tooltip explaining provider doesn't support vision

### 4. Test Error Handling
1. Try pasting without an image in clipboard
2. **Expected**: Error message "No image found in clipboard"

### 5. Test History Management
1. Paste an image from clipboard
2. Capture a screenshot normally
3. Check the history section
4. **Expected**:
   - Pasted images show clipboard icon
   - Screenshot shows camera icon

### 6. Test Multiple Image Formats
Test pasting different image formats:
- PNG images
- JPEG images
- WebP images
- GIF images

### 7. Test Size Validation
1. Try to paste a very large image (>20MB)
2. **Expected**: Error message about image being too large

### 8. Test Permission Handling
1. If clipboard permission is denied, try to paste
2. **Expected**: Clear error message about permission

## How to Copy Images to Clipboard
- **From Web**: Right-click image → Copy image
- **From Screenshot Tool**: Take screenshot → Copy
- **From Image Editor**: Select image → Ctrl+C / Cmd+C
- **From File Explorer**: Copy image file → should work in some cases

## Verification Checklist
- [ ] Manifest has `clipboardRead` permission
- [ ] Paste button appears next to Capture button
- [ ] Paste button is green with paste icon
- [ ] Ctrl+V / Cmd+V shortcut works
- [ ] Error messages are clear and helpful
- [ ] History shows source icons correctly
- [ ] Vision provider validation works
- [ ] Image processing and text extraction works
- [ ] Loading states display correctly during paste