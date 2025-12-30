# Changelog

## 1.6.0 (2024/12/31)

### Text Extraction Enhancements

- **Extract Page Range Text**: Extract text from specified pages (e.g., 1-5, 8, 10-12)
- **Extract Selected Text**: Extract currently selected text directly
- **Improved Text Formatting**: Better preservation of original layout with intelligent line breaks and paragraph detection
- **Progress Indicator**: Shows extraction progress for multi-page operations with cancel support
- **Multiple Output Options**: Copy to clipboard, save to file, open in editor, or open as Markdown

### New Keyboard Shortcuts

| Action | Windows/Linux | Mac |
|--------|---------------|-----|
| Extract All Text | `Ctrl+Alt+E` | `Cmd+Alt+E` |
| Extract Range Text | `Ctrl+Shift+R` | `Cmd+Shift+R` |
| Extract Selection | `Ctrl+Alt+C` | `Cmd+Alt+C` |

### New Commands

- `PDF: Extract Text from Page Range` - Extract text from specified page range
- `PDF: Extract Selected Text` - Extract currently selected text
- `PDF: Show Document Metadata` - View detailed PDF metadata (title, author, dates, etc.)
- `PDF: Zoom to Selection` - Zoom to fit selected area

### Functional Improvements

- **Document Metadata Viewer**: Display comprehensive PDF metadata including title, author, creation date, PDF version, and more
- **Page Extraction to Images**: Extract pages as PNG images with folder selection
- **Print Page Range**: Improved print functionality with page range support
- **Error Feedback**: Better error messages when operations fail (PDF not loaded, extraction errors, etc.)
- **Zoom to Selection**: Automatically zoom and scroll to selected text area

### Test Suite

- Added comprehensive unit tests for command registration, i18n, configuration, and utility functions
- Added integration tests for command execution safety, configuration changes, and multi-file operations
- Created test PDF file for integration testing

### Documentation

- Updated README.md with all new features and keyboard shortcuts
- Added configuration documentation for `nightMode` and `rememberPosition` settings

---

## 1.5.0 (2024/12/31)

### New Advanced Features

- **Page Extraction**: Extract specific pages by range (e.g., 1-5, 8, 10-12)
- **Page Screenshot**: Capture current page or all pages as images
- **Copy Page as Image**: Copy the current page directly to clipboard as image
- **Document Comparison**: Compare two PDFs side by side
- **Print Page Range**: Print specific page ranges
- **Dual Page View**: Toggle between single and dual page display
- **Continuous Scroll**: Toggle continuous scrolling mode
- **Thumbnail Navigator**: Quick navigation using page thumbnails
- **Invert Colors**: Toggle inverted color display
- **Copy as Markdown Link**: Copy page reference as Markdown link
- **Highlight Selection**: Highlight selected text in the document
- **Jump to Next Highlight**: Navigate between highlights
- **Clear All Highlights**: Remove all highlights at once

### New Commands

- `PDF: Extract Pages` - Extract specific pages
- `PDF: Capture Page as Image` / `PDF: Capture All Pages as Images`
- `PDF: Copy Page as Image`
- `PDF: Compare with Another PDF`
- `PDF: Print Page Range`
- `PDF: Toggle Fullscreen` / `PDF: Toggle Dual Page View`
- `PDF: Toggle Continuous Scroll`
- `PDF: Show Thumbnail Navigator`
- `PDF: Toggle Invert Colors`
- `PDF: Copy as Markdown Link`
- `PDF: Highlight Selection` / `PDF: Jump to Next Highlight` / `PDF: Clear All Highlights`

---

## 1.4.0 (2024/12/31)

### New Features

- **Navigation History**: Go back/forward through page history (`Alt+Left` / `Alt+Right`)
- **Text Extraction**: Extract text from current page or entire document
  - Copy to clipboard, save to file, or open in editor
- **Auto Scroll**: Automatic scrolling with adjustable speed (slow/normal/fast/very fast)
  - Toggle: `Ctrl+Shift+S` / `Cmd+Shift+S`
- **Page Notes**: Add personal notes to any page
  - Add Note: `Ctrl+M` / `Cmd+M`
  - Show Notes: `Ctrl+Shift+M` / `Cmd+Shift+M`
  - Export notes to Markdown
- **Quick Jump**: Jump to preset positions (first, 25%, 50%, 75%, last) with `Ctrl+J` / `Cmd+J`
- **Percentage Navigation**: Jump to any percentage position in the document
- **Color Modes**: Multiple display modes for different lighting conditions
  - Normal, Night Mode, Grayscale, Sepia, High Contrast
- **Split View**: Open the same PDF in a side-by-side view (`Ctrl+K Ctrl+\`)
- **Copy Page Info**: Copy current page information to clipboard
- **Copy Page Link**: Copy a link to the current page for reference

### New Commands

- `PDF: Go Back` / `PDF: Go Forward` - Navigate page history
- `PDF: Extract Current Page Text` / `PDF: Extract All Text`
- `PDF: Start Auto Scroll` / `PDF: Stop Auto Scroll` / `PDF: Toggle Auto Scroll`
- `PDF: Add Page Note` / `PDF: Show Page Notes` / `PDF: Export Notes`
- `PDF: Quick Jump` / `PDF: Go to Percentage`
- `PDF: Set Color Mode`
- `PDF: Open in Split View`
- `PDF: Copy Page Info` / `PDF: Copy Page Link`
- `PDF: Export Annotations` / `PDF: Copy Annotations`

### Explorer Context Menu

- Open with PDF Preview
- Open with External Application
- Copy Path
- Reveal in File Explorer
- Show File Info

### Technical Improvements

- Enhanced state management for page history
- Improved internationalization with new translations (English & Chinese)
- Better keyboard shortcut coverage

---

## 1.3.0 (2024/12/30)

### New Features

- **Print Support**: Print PDFs directly from VSCode (`Ctrl+P` / `Cmd+P`)
- **Export/Save As**: Export PDFs to a new location
- **Go to Page**: Jump to a specific page with `Ctrl+G` / `Cmd+G`
- **Status Bar**: Display current page and total pages in the status bar (clickable to jump to page)
- **Reading Position Memory**: Automatically saves and restores your reading position for each PDF
- **Zoom Memory**: Remembers zoom level for each PDF file
- **Theme Support**: Automatically adapts to VSCode's light/dark/high-contrast themes
- **Bookmarks**: Add, view, and remove bookmarks for quick navigation
  - Add Bookmark: `Ctrl+D` / `Cmd+D`
  - Show Bookmarks: `Ctrl+Shift+B` / `Cmd+Shift+B`
  - Remove Bookmark: via Command Palette
- **Copy Selection**: Copy selected text to clipboard (`Ctrl+C` / `Cmd+C`)
- **Select All**: Select all text in the document (`Ctrl+A` / `Cmd+A`)

### Enhanced Navigation

- First/Last Page: `Home` / `End` keys
- Next/Previous Page: `PageDown` / `PageUp` keys
- Zoom In/Out: `Ctrl+=` / `Ctrl+-` (or `Cmd+=` / `Cmd+-` on Mac)

### New Commands

- `PDF: Go to Page` - Jump to a specific page
- `PDF: First Page` / `PDF: Last Page` - Navigate to document start/end
- `PDF: Next Page` / `PDF: Previous Page` - Page-by-page navigation
- `PDF: Zoom In` / `PDF: Zoom Out` / `PDF: Set Zoom Level`
- `PDF: Print` - Print the document
- `PDF: Export / Save As` - Save a copy
- `PDF: Add Bookmark` / `PDF: Show Bookmarks` / `PDF: Remove Bookmark`
- `PDF: Toggle Sidebar` - Show/hide sidebar (`Ctrl+B` / `Cmd+B`)
- `PDF: Find in Document` - Open find bar (`Ctrl+F` / `Cmd+F`)
- `PDF: Rotate Clockwise` / `PDF: Rotate Counter-Clockwise`
- `PDF: Set Scroll Mode` - Vertical/Horizontal/Wrapped/Page scrolling
- `PDF: Set Spread Mode` - None/Odd/Even spreads
- `PDF: Set Cursor Tool` - Text Selection or Hand tool
- `PDF: Show Document Properties` - View document metadata
- `PDF: Copy Selected Text` / `PDF: Select All Text`

### Technical Improvements

- Updated TypeScript to 4.9.5 for better compatibility
- Added comprehensive keyboard shortcuts
- Commands only appear in Command Palette when a PDF is open
- Improved webview-extension communication

## 1.2.2 (2022/12/23)

- Fix about rendering Unicode characters

## 1.2.1 (2022/12/12)

- Update PDF.js to 3.1.81-legacy
- Restore scroll position during reload (#136)
- Run under remote development (#100)

### Thank you

- @kfigiela Run extension locally when using remote development #100
- @Daniel-Atanasov fix: Fix scroll location and flickering during reload #136

## 1.2.0 (2021/12/15)

- Allow pdf viewer to work in an untrusted workspace (#102)
- Bump version of PDF.js to Stable (v2.10.377) (#120)

### Bug fixes

- Support Unicode in PDF by passing the right cMapUrl to pdf.js (#116)
- Preserve the current page number and zoom level on reload (#121)

### Thank you
- @lramos15 Added settings about untrusted workspaces. #102
- @aifreedom Fixed bug about Unicode charactors. #116
- @simon446 Bump pdf.js version. #120
- @zamzterz Fixed to preserve page number and scale on reload. #121

## 1.1.0 (2020/07/13)

- The issue about extension view is resolved.
  + Remove message shown on loaded. 
- Support default viewer settings
  + cursor (**hand** or tool)
  + scale (**auto**, page-actual, etc...)
  + sidebar (**hide** or show)
  + scrollMode (**vertical**, horizontal or wrapped)
  + spreadMode (**none**, odd or even)

## 1.0.0 (2020/06/18)

- [Change extension API](https://github.com/microsoft/vscode/issues/77131)
- Resolve known issues about showing pdf preview.
- Upgrade PDF.js to 2.4.456

## 0.6.0 (2020/04/10)

- Support auto reload (#52)
- Migrate vscode-extension packages

### Thank you
- @GeorchW Implemented auto-refresh ( #11 )  #52

## 0.5.0 (2019/02/25)

- Recovery for working even VSCode 1.31.x.
- Avoid nested `<iframe>`.

## 0.4.3 (2018/11/28)

- Recovery for working even VSCode 1.30.0.

## 0.4.2 (2018/11/28)

- Revive display state on load VSCode.
- [Event-Stream Package Security Update](https://code.visualstudio.com/blogs/2018/11/26/event-stream)

## 0.4.0 (2018/11/9)

- Migrate vscode internal api. Due to [Microsoft/vscode#62630](https://github.com/Microsoft/vscode/issues/62630)
- Upgrade PDF.js to 2.1.36

## 0.3.0 (2018/6/6)

- Upgrade PDF.js to 1.9.426 (#23)

### Thank you
- @Kampfgnom bump to pdf.js version #23

## 0.2.0 (2017/1/12)

- Fixed displaying on linux (#5)
- Be able to open PDF from context menu in explorer now (#6)

### Thank you
- @serl support for context menu in explorer #6

## 0.1.0 (2016/11/30)

- Add extension icon.
- Use all PDF.js [Pre-built](https://mozilla.github.io/pdf.js/getting_started/#download) files.

## 0.0.2 (2016/11/24)

- consistent file icon

## 0.0.1 (2016/10/25)

- Initial release.
