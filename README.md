# pdf

Display pdf in VSCode with enhanced features.

![screenshot](https://user-images.githubusercontent.com/3643499/84454816-98fcd600-ac96-11ea-822c-3ae1e1599a13.gif)

## Features

- **PDF Viewing**: High-quality PDF rendering using PDF.js
- **Navigation**: Page navigation with keyboard shortcuts
- **Zoom Controls**: Multiple zoom levels with memory
- **Bookmarks**: Add, view, and remove bookmarks for quick access
- **Search**: Find text within documents
- **Print & Export**: Print PDFs or export to a new location
- **State Persistence**: Remembers your reading position and zoom level
- **Theme Support**: Automatically adapts to VSCode's light/dark/high-contrast themes
- **Sidebar**: Thumbnails, document outline, attachments, and layers

## Keyboard Shortcuts

| Action | Windows/Linux | Mac |
|--------|---------------|-----|
| Go to Page | `Ctrl+G` | `Cmd+G` |
| Next Page | `PageDown` | `PageDown` |
| Previous Page | `PageUp` | `PageUp` |
| First Page | `Home` | `Home` |
| Last Page | `End` | `End` |
| Zoom In | `Ctrl+=` | `Cmd+=` |
| Zoom Out | `Ctrl+-` | `Cmd+-` |
| Find | `Ctrl+F` | `Cmd+F` |
| Print | `Ctrl+P` | `Cmd+P` |
| Toggle Sidebar | `Ctrl+B` | `Cmd+B` |
| Add Bookmark | `Ctrl+D` | `Cmd+D` |
| Show Bookmarks | `Ctrl+Shift+B` | `Cmd+Shift+B` |
| Rotate Clockwise | `Ctrl+Shift+R` | `Cmd+Shift+R` |
| Copy Selection | `Ctrl+C` | `Cmd+C` |
| Select All | `Ctrl+A` | `Cmd+A` |
| Night Mode | `Ctrl+Shift+N` | `Cmd+Shift+N` |
| Go Back | `Alt+Left` | `Alt+Left` |
| Go Forward | `Alt+Right` | `Alt+Right` |
| Extract Page Text | `Ctrl+Shift+E` | `Cmd+Shift+E` |
| Extract All Text | `Ctrl+Alt+E` | `Cmd+Alt+E` |
| Extract Range Text | `Ctrl+Shift+R` | `Cmd+Shift+R` |
| Extract Selection | `Ctrl+Alt+C` | `Cmd+Alt+C` |
| Toggle Auto Scroll | `Ctrl+Shift+S` | `Cmd+Shift+S` |
| Add Page Note | `Ctrl+M` | `Cmd+M` |
| Show Page Notes | `Ctrl+Shift+M` | `Cmd+Shift+M` |
| Quick Jump | `Ctrl+J` | `Cmd+J` |
| Open in Split View | `Ctrl+K Ctrl+\` | `Cmd+K Cmd+\` |

## Commands

All commands are available through the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) when a PDF is open:

### Navigation

- `PDF: Go to Page` - Jump to a specific page
- `PDF: First Page` - Go to the first page
- `PDF: Last Page` - Go to the last page
- `PDF: Next Page` - Go to the next page
- `PDF: Previous Page` - Go to the previous page

### Zoom

- `PDF: Zoom In` - Increase zoom level
- `PDF: Zoom Out` - Decrease zoom level
- `PDF: Set Zoom Level` - Choose a specific zoom level

### Bookmarks

- `PDF: Add Bookmark` - Bookmark the current page
- `PDF: Show Bookmarks` - View and jump to bookmarks
- `PDF: Remove Bookmark` - Delete a bookmark

### View

- `PDF: Toggle Sidebar` - Show/hide the sidebar
- `PDF: Find in Document` - Open the find bar
- `PDF: Show Document Properties` - View document metadata
- `PDF: Rotate Clockwise` - Rotate pages clockwise
- `PDF: Rotate Counter-Clockwise` - Rotate pages counter-clockwise

### Settings

- `PDF: Set Scroll Mode` - Choose scroll mode (vertical/horizontal/wrapped/page)
- `PDF: Set Spread Mode` - Choose spread mode (none/odd/even)
- `PDF: Set Cursor Tool` - Switch between text selection and hand tool

### Navigation History

- `PDF: Go Back` - Navigate back in page history
- `PDF: Go Forward` - Navigate forward in page history
- `PDF: Quick Jump` - Jump to preset positions (first, quarter, half, three-quarters, last)
- `PDF: Go to Percentage` - Jump to a specific percentage position

### Text Extraction

- `PDF: Extract Current Page Text` - Extract text from current page
- `PDF: Extract All Text` - Extract all text from the document (with progress indicator)
- `PDF: Extract Text from Page Range` - Extract text from specified pages (e.g., 1-5, 8, 10-12)
- `PDF: Extract Selected Text` - Extract currently selected text

### Auto Scroll

- `PDF: Start Auto Scroll` - Start automatic scrolling with speed selection
- `PDF: Stop Auto Scroll` - Stop automatic scrolling
- `PDF: Toggle Auto Scroll` - Toggle auto scroll on/off

### Page Notes

- `PDF: Add Page Note` - Add a note to the current page
- `PDF: Show Page Notes` - View all notes and jump to pages
- `PDF: Export Notes` - Export all notes to a Markdown file

### Color Modes

- `PDF: Set Color Mode` - Choose display mode (Normal, Night, Grayscale, Sepia, High Contrast)
- `PDF: Toggle Night Mode` - Toggle night mode on/off

### Split View

- `PDF: Open in Split View` - Open the same PDF in a side-by-side view

### Screenshots & Images

- `PDF: Capture Page as Image` - Save current page as PNG image
- `PDF: Capture All Pages as Images` - Save all pages as PNG images
- `PDF: Copy Page as Image` - Copy current page to clipboard as image

### Highlighting

- `PDF: Highlight Selection` - Highlight selected text
- `PDF: Jump to Next Highlight` - Navigate to next highlight
- `PDF: Clear All Highlights` - Remove all highlights

### View Modes

- `PDF: Toggle Fullscreen` - Enter/exit fullscreen mode
- `PDF: Toggle Dual Page View` - Switch between single and dual page view
- `PDF: Toggle Continuous Scroll` - Switch between continuous and page scroll
- `PDF: Show Thumbnail Navigator` - Show page thumbnails
- `PDF: Toggle Invert Colors` - Invert display colors

### Print & Export

- `PDF: Print` - Print the document
- `PDF: Print Page Range` - Print specific pages
- `PDF: Export / Save As` - Save a copy of the PDF
- `PDF: Extract Pages` - Extract pages as images

### Other

- `PDF: Copy Selected Text` - Copy selected text to clipboard
- `PDF: Select All Text` - Select all text in the document
- `PDF: Copy Page Info` - Copy current page information
- `PDF: Copy Page Link` - Copy a link to the current page
- `PDF: Copy as Markdown Link` - Copy page reference as Markdown
- `PDF: Export Annotations` - Export PDF annotations to JSON
- `PDF: Copy Annotations` - Copy annotations to clipboard
- `PDF: Compare with Another PDF` - Open comparison view
- `PDF: Show Document Metadata` - View detailed PDF metadata

## Configuration

| Setting | Description | Default |
|---------|-------------|---------|
| `pdf-preview.default.cursor` | Default cursor tool (`select` or `hand`) | `select` |
| `pdf-preview.default.scale` | Default zoom level (`auto`, `page-actual`, `page-fit`, `page-width`, or number) | `auto` |
| `pdf-preview.default.sidebar` | Show sidebar on load | `false` |
| `pdf-preview.default.scrollMode` | Default scroll mode (`vertical`, `horizontal`, `wrapped`) | `vertical` |
| `pdf-preview.default.spreadMode` | Default spread mode (`none`, `odd`, `even`) | `none` |
| `pdf-preview.default.nightMode` | Enable night mode by default | `false` |
| `pdf-preview.default.rememberPosition` | Remember reading position | `true` |

## Contribute

### Upgrade PDF.js

1. Download latest [Prebuilt(older browsers)](https://mozilla.github.io/pdf.js/getting_started/#download).
1. Extract the ZIP file.
1. Overwrite ./lib/* by extracted directories.
   - If lib/web/viewer.html has changes, apply these changes to HTML template at pdfPreview.ts.
1. To not use sample pdf.

- Remove sample pdf called `compressed.tracemonkey-pldi-09.pdf`.
- Remove code about using sample pdf from lib/web/viewer.js.

    ```js
    defaultUrl: {
      value: "", // "compressed.tracemonkey-pldi-09.pdf"
      kind: OptionKind.VIEWER
    },
    ```

## Change log

See [CHANGELOG.md](CHANGELOG.md).

## License

Please see [LICENSE](./LICENSE)
