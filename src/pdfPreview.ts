import * as path from 'path';
import * as vscode from 'vscode';
import { Disposable } from './disposable';
import { t, getWebviewLocale } from './i18n';

function escapeAttribute(value: string | vscode.Uri): string {
  return value.toString().replace(/"/g, '&quot;');
}

type PreviewState = 'Disposed' | 'Visible' | 'Active';

export interface PdfState {
  page: number;
  scale: string;
  scrollTop: number;
  scrollLeft: number;
}

export interface Bookmark {
  page: number;
  label: string;
  timestamp: number;
}

export interface RecentPosition {
  uri: string;
  page: number;
  timestamp: number;
  fileName: string;
}

export interface PageNote {
  page: number;
  content: string;
  timestamp: number;
}

export interface ReadingStats {
  uri: string;
  fileName: string;
  totalPages: number;
  pagesRead: Set<number>;
  startTime: number;
  totalReadingTime: number;
  lastReadTime: number;
  lastPage: number;
}

export interface SearchHistoryItem {
  query: string;
  timestamp: number;
  resultsCount?: number;
}

export interface HighlightData {
  text: string;
  color: string;
  page: number;
  timestamp: number;
  // 用于定位高亮的信息
  textBefore?: string;
  textAfter?: string;
}

// 扩展注释数据接口
export interface AnnotationData {
  type: 'underline' | 'strikethrough' | 'squiggly';
  text: string;
  color: string;
  page: number;
  timestamp: number;
  textBefore?: string;
  textAfter?: string;
}

// 评论数据接口
export interface CommentData {
  text: string;
  comment: string;
  color: string;
  page: number;
  timestamp: number;
  textBefore?: string;
  textAfter?: string;
  author?: string;
}

// 便签数据接口
export interface StickyNoteData {
  content: string;
  color: string;
  page: number;
  x: number;
  y: number;
  timestamp: number;
}

// 绘图注释数据接口
export interface DrawingData {
  type: 'rectangle' | 'circle' | 'arrow' | 'freehand';
  color: string;
  strokeWidth: number;
  page: number;
  timestamp: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  radius?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  path?: Array<{ x: number; y: number }>;
}

// 所有注释数据汇总接口
export interface AllAnnotationsData {
  highlights: HighlightData[];
  annotations: AnnotationData[];
  comments: CommentData[];
  stickyNotes: StickyNoteData[];
  drawings: DrawingData[];
}

export class PdfPreview extends Disposable {
  private _previewState: PreviewState = 'Visible';
  private _currentPage = 1;
  private _totalPages = 0;
  private _currentScale = 'auto';
  private _statusBarItem: vscode.StatusBarItem;
  private _bookmarks: Bookmark[] = [];
  private _nightMode = false;
  private _pageHistory: number[] = [];
  private _historyIndex = -1;
  private _isNavigating = false;
  private _autoScrollInterval: NodeJS.Timeout | null = null;
  private _autoScrollSpeed = 1;
  private _colorMode:
    | 'normal'
    | 'night'
    | 'grayscale'
    | 'sepia'
    | 'highContrast' = 'normal';
  private _pageNotes: Map<number, PageNote> = new Map();
  private _readingStats: ReadingStats | null = null;
  private _currentHighlightColor = '#FFFF00'; // 默认黄色
  private _savedHighlights: HighlightData[] = [];
  private _savedAnnotations: AnnotationData[] = [];
  private _savedComments: CommentData[] = [];
  private _savedStickyNotes: StickyNoteData[] = [];
  private _savedDrawings: DrawingData[] = [];
  private _currentAnnotationType:
    | 'highlight'
    | 'underline'
    | 'strikethrough'
    | 'squiggly' = 'highlight';
  private _sessionStartTime = Date.now();
  private _pagesVisited: Set<number> = new Set();
  private _readingTimeInterval: NodeJS.Timeout | null = null;
  private _searchHistory: SearchHistoryItem[] = [];
  private _estimatedReadingTimePerPage = 60; // 默认每页60秒

  constructor(
    private readonly extensionRoot: vscode.Uri,
    private readonly resource: vscode.Uri,
    private readonly webviewEditor: vscode.WebviewPanel,
    private readonly context: vscode.ExtensionContext
  ) {
    super();

    this._statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this._statusBarItem.command = 'pdf.gotoPage';
    this._statusBarItem.tooltip = t('msg.statusBarTooltip');
    this._register(this._statusBarItem);

    this.loadBookmarks();
    this.loadReadingStats();
    this.loadSearchHistory();
    this.loadHighlights();
    this._nightMode =
      vscode.workspace
        .getConfiguration('pdf-preview')
        .get('default.nightMode') || false;

    // 启动阅读时间追踪
    this.startReadingTimeTracking();
    const resourceRoot = resource.with({
      path: resource.path.replace(/\/[^/]+?\.\w+$/, '/'),
    });

    webviewEditor.webview.options = {
      enableScripts: true,
      localResourceRoots: [resourceRoot, extensionRoot],
    };

    this._register(
      webviewEditor.webview.onDidReceiveMessage((message) => {
        switch (message.type) {
          case 'reopen-as-text': {
            vscode.commands.executeCommand(
              'vscode.openWith',
              resource,
              'default',
              webviewEditor.viewColumn
            );
            break;
          }
          case 'pageChanged': {
            this._currentPage = message.page;
            this._totalPages = message.total;
            this.updateStatusBar();
            // 添加到页面历史
            if (!this._isNavigating) {
              this.addToHistory(message.page);
            }
            this._isNavigating = false;
            break;
          }
          case 'textExtracted': {
            this.handleExtractedText(message.text, message.page);
            break;
          }
          case 'extractError': {
            vscode.window.showErrorMessage(
              t('msg.extractError', message.error)
            );
            break;
          }
          case 'extractProgress': {
            if (this._extractProgressCallback) {
              this._extractProgressCallback(message.current, message.total);
            }
            break;
          }
          case 'scaleChanged': {
            this._currentScale = message.scale;
            this.saveState();
            break;
          }
          case 'documentLoaded': {
            this._totalPages = message.total;
            this._currentPage = message.page || 1;
            this.updateStatusBar();
            this.restoreState();
            break;
          }
          case 'stateChanged': {
            if (message.page) this._currentPage = message.page;
            if (message.scale) this._currentScale = message.scale;
            this.saveState();
            break;
          }
          case 'textCopied': {
            vscode.window.showInformationMessage(t('msg.textCopied'));
            break;
          }
          case 'noSelection': {
            vscode.window.showWarningMessage(t('msg.noSelection'));
            break;
          }
          case 'copyError': {
            vscode.window.showErrorMessage(t('msg.copyError', message.error));
            break;
          }
          case 'annotationsData': {
            this.handleAnnotationsData(message.annotations);
            break;
          }
          case 'annotationsCopied': {
            this.handleCopyAnnotations(message.annotations);
            break;
          }
          case 'noAnnotations': {
            vscode.window.showInformationMessage(t('msg.noAnnotations'));
            break;
          }
          case 'printInfo': {
            vscode.window.showInformationMessage(message.message);
            break;
          }
          case 'pagesExtracted': {
            this.handlePagesExtracted(message.pages);
            break;
          }
          case 'metadataResult': {
            this.handleMetadataResult(message.metadata);
            break;
          }
          case 'selectedTextForSearch': {
            this.handleSelectedTextForSearch(message.text);
            break;
          }
          case 'selectedTextForTranslate': {
            this.handleSelectedTextForTranslate(message.text);
            break;
          }
          case 'selectedTextWithPage': {
            this.handleSelectedTextWithPage(message.text, message.page);
            break;
          }
          case 'outlineResult': {
            this.handleOutlineResult(message.outline);
            break;
          }
          case 'highlightsSummary': {
            this.handleHighlightsSummary(message.highlights, message.total);
            break;
          }
          case 'highlightRemoved': {
            vscode.window.showInformationMessage(
              t('msg.highlightRemoved', message.remaining)
            );
            break;
          }
          case 'noHighlights': {
            vscode.window.showInformationMessage(t('msg.noHighlights'));
            break;
          }
          case 'highlightAdded': {
            // 保存高亮到存储
            if (message.highlightData) {
              this.addHighlightToStorage(message.highlightData);
            }
            vscode.window.showInformationMessage(
              t('msg.highlightAdded', message.count)
            );
            break;
          }
          case 'highlightRemovedWithData': {
            // 从存储中删除高亮
            if (message.index !== undefined) {
              this.removeHighlightFromStorage(message.index);
            }
            break;
          }
          case 'highlightsCleared': {
            // 清除存储中的所有高亮
            this.clearHighlightsStorage();
            vscode.window.showInformationMessage(
              t('msg.highlightsCleared', message.count)
            );
            break;
          }
          case 'requestStoredHighlights': {
            // webview 请求恢复高亮
            this.restoreHighlights();
            break;
          }
          // ============== 扩展注释消息处理 ==============
          case 'annotationAdded': {
            if (message.annotationData) {
              this.addAnnotationToStorage(message.annotationData);
            }
            vscode.window.showInformationMessage(
              t('msg.annotationAdded', message.annotationType, message.count)
            );
            break;
          }
          case 'annotationError': {
            vscode.window.showErrorMessage(
              t('msg.annotationError', message.error)
            );
            break;
          }
          // ============== 评论消息处理 ==============
          case 'commentAdded': {
            if (message.commentData) {
              this.addCommentToStorage(message.commentData);
            }
            vscode.window.showInformationMessage(
              t('msg.commentAdded', message.count)
            );
            break;
          }
          case 'commentDeleted': {
            vscode.window.showInformationMessage(
              t('msg.commentDeleted', message.remaining)
            );
            break;
          }
          case 'commentEdited': {
            vscode.window.showInformationMessage(t('msg.commentEdited'));
            break;
          }
          case 'commentsList': {
            this.handleCommentsList(message.comments, message.total);
            break;
          }
          case 'showComment': {
            this.handleShowComment(message);
            break;
          }
          case 'commentError': {
            vscode.window.showErrorMessage(
              t('msg.commentError', message.error)
            );
            break;
          }
          case 'noComments': {
            vscode.window.showInformationMessage(t('msg.noComments'));
            break;
          }
          // ============== 便签消息处理 ==============
          case 'stickyNoteAdded': {
            if (message.noteData) {
              this.addStickyNoteToStorage(message.noteData);
            }
            vscode.window.showInformationMessage(
              t('msg.stickyNoteAdded', message.count)
            );
            break;
          }
          case 'stickyNoteDeleted': {
            vscode.window.showInformationMessage(
              t('msg.stickyNoteDeleted', message.remaining)
            );
            break;
          }
          case 'stickyNoteUpdated': {
            this.updateStickyNoteInStorage(message.index, message.content);
            break;
          }
          case 'stickyNotePositionChanged': {
            this.updateStickyNotePositionInStorage(
              message.index,
              message.x,
              message.y
            );
            break;
          }
          case 'stickyNotesList': {
            this.handleStickyNotesList(message.notes, message.total);
            break;
          }
          case 'stickyNoteError': {
            vscode.window.showErrorMessage(
              t('msg.stickyNoteError', message.error)
            );
            break;
          }
          // ============== 绘图注释消息处理 ==============
          case 'drawingAdded': {
            if (message.drawingData) {
              this.addDrawingToStorage(message.drawingData);
            }
            vscode.window.showInformationMessage(
              t('msg.drawingAdded', message.count)
            );
            break;
          }
          case 'drawingDeleted': {
            vscode.window.showInformationMessage(
              t('msg.drawingDeleted', message.remaining)
            );
            break;
          }
          case 'drawingsCleared': {
            vscode.window.showInformationMessage(
              t('msg.drawingsCleared', message.count)
            );
            break;
          }
          case 'drawingModeStarted': {
            vscode.window.showInformationMessage(
              t('msg.drawingModeStarted', message.drawingType)
            );
            break;
          }
          case 'drawingModeStopped': {
            vscode.window.showInformationMessage(t('msg.drawingModeStopped'));
            break;
          }
          case 'drawingAnnotationsList': {
            this.handleDrawingsList(message.drawings, message.total);
            break;
          }
          // ============== 全部注释数据 ==============
          case 'allAnnotationsData': {
            this.handleAllAnnotationsData(message.data, message.counts);
            break;
          }
          case 'annotationsRestored': {
            vscode.window.showInformationMessage(t('msg.annotationsRestored'));
            break;
          }
        }
      })
    );

    this._register(
      webviewEditor.onDidChangeViewState(() => {
        this.update();
        if (webviewEditor.active) {
          this._statusBarItem.show();
        } else {
          this._statusBarItem.hide();
        }
      })
    );

    this._register(
      webviewEditor.onDidDispose(() => {
        this._previewState = 'Disposed';
        this._statusBarItem.hide();
        this.saveState();
      })
    );

    const watcher = this._register(
      vscode.workspace.createFileSystemWatcher(resource.fsPath)
    );
    this._register(
      watcher.onDidChange((e) => {
        if (e.toString() === this.resource.toString()) {
          this.reload();
        }
      })
    );
    this._register(
      watcher.onDidDelete((e) => {
        if (e.toString() === this.resource.toString()) {
          this.webviewEditor.dispose();
        }
      })
    );

    this._register(
      vscode.window.onDidChangeActiveColorTheme(() => {
        if (this._previewState !== 'Disposed') {
          this.webviewEditor.webview.postMessage({ type: 'themeChanged' });
        }
      })
    );

    this.webviewEditor.webview.html = this.getWebviewContents();
    this.update();
  }

  private reload(): void {
    if (this._previewState !== 'Disposed') {
      this.webviewEditor.webview.postMessage({ type: 'reload' });
    }
  }

  private update(): void {
    if (this._previewState === 'Disposed') {
      return;
    }

    if (this.webviewEditor.active) {
      this._previewState = 'Active';
      return;
    }
    this._previewState = 'Visible';
  }

  private getWebviewContents(): string {
    const webview = this.webviewEditor.webview;
    const docPath = webview.asWebviewUri(this.resource);
    const cspSource = webview.cspSource;
    const resolveAsUri = (...p: string[]): vscode.Uri => {
      const uri = vscode.Uri.file(path.join(this.extensionRoot.path, ...p));
      return webview.asWebviewUri(uri);
    };

    const config = vscode.workspace.getConfiguration('pdf-preview');
    const settings = {
      cMapUrl: resolveAsUri('lib', 'web', 'cmaps/').toString(),
      standardFontDataUrl: resolveAsUri(
        'lib',
        'web',
        'standard_fonts/'
      ).toString(),
      workerSrc: resolveAsUri('lib', 'build', 'pdf.worker.js').toString(),
      path: docPath.toString(),
      locale: getWebviewLocale(),
      nightMode: this._nightMode,
      defaults: {
        cursor: config.get('default.cursor') as string,
        scale: config.get('default.scale') as string,
        sidebar: config.get('default.sidebar') as boolean,
        scrollMode: config.get('default.scrollMode') as string,
        spreadMode: config.get('default.spreadMode') as string,
        nightMode: config.get('default.nightMode') as boolean,
      },
    };

    const head = `<!DOCTYPE html>
<html dir="ltr" mozdisallowselectionprint>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<meta name="google" content="notranslate">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; connect-src ${cspSource}; script-src 'unsafe-inline' ${cspSource}; style-src 'unsafe-inline' ${cspSource}; img-src blob: data: ${cspSource};">
<meta id="pdf-preview-config" data-config="${escapeAttribute(
      JSON.stringify(settings)
    )}">
<title>PDF.js viewer</title>
<link rel="resource" type="application/l10n" href="${resolveAsUri(
      'lib',
      'web',
      'locale',
      'locale.properties'
    )}">
<link rel="stylesheet" href="${resolveAsUri('lib', 'web', 'viewer.css')}">
<link rel="stylesheet" href="${resolveAsUri('lib', 'pdf.css')}">
<script src="${resolveAsUri('lib', 'build', 'pdf.js')}"></script>
<script>
// 在 viewer.js 加载前设置 workerSrc，防止 "No GlobalWorkerOptions.workerSrc specified" 错误
if (typeof pdfjsLib !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = "${escapeAttribute(
    resolveAsUri('lib', 'build', 'pdf.worker.js').toString()
  )}";
}
</script>
<script src="${resolveAsUri('lib', 'web', 'viewer.js')}"></script>
<script src="${resolveAsUri('lib', 'main.js')}"></script>
</head>`;

    const body = `<body tabindex="1">
    <div id="outerContainer">

      <div id="sidebarContainer">
        <div id="toolbarSidebar">
          <div id="toolbarSidebarLeft">
            <div id="sidebarViewButtons" class="splitToolbarButton toggled" role="radiogroup">
              <button id="viewThumbnail" class="toolbarButton toggled" title="Show Thumbnails" tabindex="2" data-l10n-id="thumbs" role="radio" aria-checked="true" aria-controls="thumbnailView">
                 <span data-l10n-id="thumbs_label">Thumbnails</span>
              </button>
              <button id="viewOutline" class="toolbarButton" title="Show Document Outline (double-click to expand/collapse all items)" tabindex="3" data-l10n-id="document_outline" role="radio" aria-checked="false" aria-controls="outlineView">
                 <span data-l10n-id="document_outline_label">Document Outline</span>
              </button>
              <button id="viewAttachments" class="toolbarButton" title="Show Attachments" tabindex="4" data-l10n-id="attachments" role="radio" aria-checked="false" aria-controls="attachmentsView">
                 <span data-l10n-id="attachments_label">Attachments</span>
              </button>
              <button id="viewLayers" class="toolbarButton" title="Show Layers (double-click to reset all layers to the default state)" tabindex="5" data-l10n-id="layers" role="radio" aria-checked="false" aria-controls="layersView">
                 <span data-l10n-id="layers_label">Layers</span>
              </button>
            </div>
          </div>

          <div id="toolbarSidebarRight">
            <div id="outlineOptionsContainer" class="hidden">
              <div class="verticalToolbarSeparator"></div>

              <button id="currentOutlineItem" class="toolbarButton" disabled="disabled" title="Find Current Outline Item" tabindex="6" data-l10n-id="current_outline_item">
                <span data-l10n-id="current_outline_item_label">Current Outline Item</span>
              </button>
            </div>
          </div>
        </div>
        <div id="sidebarContent">
          <div id="thumbnailView">
          </div>
          <div id="outlineView" class="hidden">
          </div>
          <div id="attachmentsView" class="hidden">
          </div>
          <div id="layersView" class="hidden">
          </div>
        </div>
        <div id="sidebarResizer"></div>
      </div>  <!-- sidebarContainer -->

      <div id="mainContainer">
        <div class="findbar hidden doorHanger" id="findbar">
          <div id="findbarInputContainer">
            <input id="findInput" class="toolbarField" title="Find" placeholder="Find in document…" tabindex="91" data-l10n-id="find_input" aria-invalid="false">
            <div class="splitToolbarButton">
              <button id="findPrevious" class="toolbarButton" title="Find the previous occurrence of the phrase" tabindex="92" data-l10n-id="find_previous">
                <span data-l10n-id="find_previous_label">Previous</span>
              </button>
              <div class="splitToolbarButtonSeparator"></div>
              <button id="findNext" class="toolbarButton" title="Find the next occurrence of the phrase" tabindex="93" data-l10n-id="find_next">
                <span data-l10n-id="find_next_label">Next</span>
              </button>
            </div>
          </div>

          <div id="findbarOptionsOneContainer">
            <input type="checkbox" id="findHighlightAll" class="toolbarField" tabindex="94">
            <label for="findHighlightAll" class="toolbarLabel" data-l10n-id="find_highlight">Highlight All</label>
            <input type="checkbox" id="findMatchCase" class="toolbarField" tabindex="95">
            <label for="findMatchCase" class="toolbarLabel" data-l10n-id="find_match_case_label">Match Case</label>
          </div>
          <div id="findbarOptionsTwoContainer">
            <input type="checkbox" id="findMatchDiacritics" class="toolbarField" tabindex="96">
            <label for="findMatchDiacritics" class="toolbarLabel" data-l10n-id="find_match_diacritics_label">Match Diacritics</label>
            <input type="checkbox" id="findEntireWord" class="toolbarField" tabindex="97">
            <label for="findEntireWord" class="toolbarLabel" data-l10n-id="find_entire_word_label">Whole Words</label>
          </div>

          <div id="findbarMessageContainer" aria-live="polite">
            <span id="findResultsCount" class="toolbarLabel"></span>
            <span id="findMsg" class="toolbarLabel"></span>
          </div>
        </div>  <!-- findbar -->

        <div class="editorParamsToolbar hidden doorHangerRight" id="editorFreeTextParamsToolbar">
          <div class="editorParamsToolbarContainer">
            <div class="editorParamsSetter">
              <label for="editorFreeTextColor" class="editorParamsLabel" data-l10n-id="editor_free_text_color">Color</label>
              <input type="color" id="editorFreeTextColor" class="editorParamsColor" tabindex="100">
            </div>
            <div class="editorParamsSetter">
              <label for="editorFreeTextFontSize" class="editorParamsLabel" data-l10n-id="editor_free_text_size">Size</label>
              <input type="range" id="editorFreeTextFontSize" class="editorParamsSlider" value="10" min="5" max="100" step="1" tabindex="101">
            </div>
          </div>
        </div>

        <div class="editorParamsToolbar hidden doorHangerRight" id="editorInkParamsToolbar">
          <div class="editorParamsToolbarContainer">
            <div class="editorParamsSetter">
              <label for="editorInkColor" class="editorParamsLabel" data-l10n-id="editor_ink_color">Color</label>
              <input type="color" id="editorInkColor" class="editorParamsColor" tabindex="102">
            </div>
            <div class="editorParamsSetter">
              <label for="editorInkThickness" class="editorParamsLabel" data-l10n-id="editor_ink_thickness">Thickness</label>
              <input type="range" id="editorInkThickness" class="editorParamsSlider" value="1" min="1" max="20" step="1" tabindex="103">
            </div>
            <div class="editorParamsSetter">
              <label for="editorInkOpacity" class="editorParamsLabel" data-l10n-id="editor_ink_opacity">Opacity</label>
              <input type="range" id="editorInkOpacity" class="editorParamsSlider" value="100" min="1" max="100" step="1" tabindex="104">
            </div>
          </div>
        </div>

        <div id="secondaryToolbar" class="secondaryToolbar hidden doorHangerRight">
          <div id="secondaryToolbarButtonContainer">
          <div style="display:none;">
            <button id="secondaryOpenFile" class="secondaryToolbarButton visibleLargeView" title="Open File" tabindex="51" data-l10n-id="open_file">
              <span data-l10n-id="open_file_label">Open</span>
            </button>

            <button id="secondaryPrint" class="secondaryToolbarButton visibleMediumView" title="Print" tabindex="52" data-l10n-id="print">
              <span data-l10n-id="print_label">Print</span>
            </button>

            <button id="secondaryDownload" class="secondaryToolbarButton visibleMediumView" title="Save" tabindex="53" data-l10n-id="save">
              <span data-l10n-id="save_label">Save</span>
            </button>

            <div class="horizontalToolbarSeparator visibleLargeView"></div>

            <button id="presentationMode" class="secondaryToolbarButton" title="Switch to Presentation Mode" tabindex="54" data-l10n-id="presentation_mode">
              <span data-l10n-id="presentation_mode_label">Presentation Mode</span>
            </button>

            <a href="#" id="viewBookmark" class="secondaryToolbarButton" title="Current view (copy or open in new window)" tabindex="55" data-l10n-id="bookmark">
              <span data-l10n-id="bookmark_label">Current View</span>
            </a>

            <div class="horizontalToolbarSeparator"></div>
            </div>

            <button id="firstPage" class="secondaryToolbarButton" title="Go to First Page" tabindex="56" data-l10n-id="first_page">
              <span data-l10n-id="first_page_label">Go to First Page</span>
            </button>
            <button id="lastPage" class="secondaryToolbarButton" title="Go to Last Page" tabindex="57" data-l10n-id="last_page">
              <span data-l10n-id="last_page_label">Go to Last Page</span>
            </button>

            <div class="horizontalToolbarSeparator"></div>

            <button id="pageRotateCw" class="secondaryToolbarButton" title="Rotate Clockwise" tabindex="58" data-l10n-id="page_rotate_cw">
              <span data-l10n-id="page_rotate_cw_label">Rotate Clockwise</span>
            </button>
            <button id="pageRotateCcw" class="secondaryToolbarButton" title="Rotate Counterclockwise" tabindex="59" data-l10n-id="page_rotate_ccw">
              <span data-l10n-id="page_rotate_ccw_label">Rotate Counterclockwise</span>
            </button>

            <div class="horizontalToolbarSeparator"></div>

            <div id="cursorToolButtons" role="radiogroup">
              <button id="cursorSelectTool" class="secondaryToolbarButton toggled" title="Enable Text Selection Tool" tabindex="60" data-l10n-id="cursor_text_select_tool" role="radio" aria-checked="true">
                <span data-l10n-id="cursor_text_select_tool_label">Text Selection Tool</span>
              </button>
              <button id="cursorHandTool" class="secondaryToolbarButton" title="Enable Hand Tool" tabindex="61" data-l10n-id="cursor_hand_tool" role="radio" aria-checked="false">
                <span data-l10n-id="cursor_hand_tool_label">Hand Tool</span>
              </button>
            </div>

            <div class="horizontalToolbarSeparator"></div>

            <div id="scrollModeButtons" role="radiogroup">
              <button id="scrollPage" class="secondaryToolbarButton" title="Use Page Scrolling" tabindex="62" data-l10n-id="scroll_page" role="radio" aria-checked="false">
                <span data-l10n-id="scroll_page_label">Page Scrolling</span>
              </button>
              <button id="scrollVertical" class="secondaryToolbarButton toggled" title="Use Vertical Scrolling" tabindex="63" data-l10n-id="scroll_vertical" role="radio" aria-checked="true">
                <span data-l10n-id="scroll_vertical_label" >Vertical Scrolling</span>
              </button>
              <button id="scrollHorizontal" class="secondaryToolbarButton" title="Use Horizontal Scrolling" tabindex="64" data-l10n-id="scroll_horizontal" role="radio" aria-checked="false">
                <span data-l10n-id="scroll_horizontal_label">Horizontal Scrolling</span>
              </button>
              <button id="scrollWrapped" class="secondaryToolbarButton" title="Use Wrapped Scrolling" tabindex="65" data-l10n-id="scroll_wrapped" role="radio" aria-checked="false">
                <span data-l10n-id="scroll_wrapped_label">Wrapped Scrolling</span>
              </button>
            </div>

            <div class="horizontalToolbarSeparator"></div>

            <div id="spreadModeButtons" role="radiogroup">
              <button id="spreadNone" class="secondaryToolbarButton toggled" title="Do not join page spreads" tabindex="66" data-l10n-id="spread_none" role="radio" aria-checked="true">
                <span data-l10n-id="spread_none_label">No Spreads</span>
              </button>
              <button id="spreadOdd" class="secondaryToolbarButton" title="Join page spreads starting with odd-numbered pages" tabindex="67" data-l10n-id="spread_odd" role="radio" aria-checked="false">
                <span data-l10n-id="spread_odd_label">Odd Spreads</span>
              </button>
              <button id="spreadEven" class="secondaryToolbarButton" title="Join page spreads starting with even-numbered pages" tabindex="68" data-l10n-id="spread_even" role="radio" aria-checked="false">
                <span data-l10n-id="spread_even_label">Even Spreads</span>
              </button>
            </div>

            <div class="horizontalToolbarSeparator"></div>

            <button id="documentProperties" class="secondaryToolbarButton" title="Document Properties…" tabindex="69" data-l10n-id="document_properties" aria-controls="documentPropertiesDialog">
              <span data-l10n-id="document_properties_label">Document Properties…</span>
            </button>
          </div>
        </div>  <!-- secondaryToolbar -->

        <div class="toolbar">
          <div id="toolbarContainer">
            <div id="toolbarViewer">
              <div id="toolbarViewerLeft">
                <button id="sidebarToggle" class="toolbarButton" title="Toggle Sidebar" tabindex="11" data-l10n-id="toggle_sidebar" aria-expanded="false" aria-controls="sidebarContainer">
                  <span data-l10n-id="toggle_sidebar_label">Toggle Sidebar</span>
                </button>
                <div class="toolbarButtonSpacer"></div>
                <button id="viewFind" class="toolbarButton" title="Find in Document" tabindex="12" data-l10n-id="findbar" aria-expanded="false" aria-controls="findbar">
                  <span data-l10n-id="findbar_label">Find</span>
                </button>
                <div class="splitToolbarButton hiddenSmallView">
                  <button class="toolbarButton" title="Previous Page" id="previous" tabindex="13" data-l10n-id="previous">
                    <span data-l10n-id="previous_label">Previous</span>
                  </button>
                  <div class="splitToolbarButtonSeparator"></div>
                  <button class="toolbarButton" title="Next Page" id="next" tabindex="14" data-l10n-id="next">
                    <span data-l10n-id="next_label">Next</span>
                  </button>
                </div>
                <input type="number" id="pageNumber" class="toolbarField" title="Page" value="1" min="1" tabindex="15" data-l10n-id="page" autocomplete="off">
                <span id="numPages" class="toolbarLabel"></span>
              </div>
              <div id="toolbarViewerRight">
              <div style="display:none;">
                <button id="openFile" class="toolbarButton hiddenLargeView" title="Open File" tabindex="31" data-l10n-id="open_file">
                  <span data-l10n-id="open_file_label">Open</span>
                </button>

                <button id="print" class="toolbarButton hiddenMediumView" title="Print" tabindex="32" data-l10n-id="print">
                  <span data-l10n-id="print_label">Print</span>
                </button>

                <button id="download" class="toolbarButton hiddenMediumView" title="Save" tabindex="33" data-l10n-id="save">
                  <span data-l10n-id="save_label">Save</span>
                </button>

                <div class="verticalToolbarSeparator hiddenMediumView"></div>

                <div id="editorModeButtons" class="splitToolbarButton toggled" role="radiogroup">
                  <button id="editorFreeText" class="toolbarButton" disabled="disabled" title="Text" role="radio" aria-checked="false" tabindex="34" data-l10n-id="editor_free_text2">
                    <span data-l10n-id="editor_free_text2_label">Text</span>
                  </button>
                  <button id="editorInk" class="toolbarButton" disabled="disabled" title="Draw" role="radio" aria-checked="false" tabindex="35" data-l10n-id="editor_ink2">
                    <span data-l10n-id="editor_ink2_label">Draw</span>
                  </button>
                </div>

                <div id="editorModeSeparator" class="verticalToolbarSeparator"></div>
                </div>
                <button id="secondaryToolbarToggle" class="toolbarButton" title="Tools" tabindex="48" data-l10n-id="tools" aria-expanded="false" aria-controls="secondaryToolbar">
                  <span data-l10n-id="tools_label">Tools</span>
                </button>
              </div>
              <div id="toolbarViewerMiddle">
                <div class="splitToolbarButton">
                  <button id="zoomOut" class="toolbarButton" title="Zoom Out" tabindex="21" data-l10n-id="zoom_out">
                    <span data-l10n-id="zoom_out_label">Zoom Out</span>
                  </button>
                  <div class="splitToolbarButtonSeparator"></div>
                  <button id="zoomIn" class="toolbarButton" title="Zoom In" tabindex="22" data-l10n-id="zoom_in">
                    <span data-l10n-id="zoom_in_label">Zoom In</span>
                   </button>
                </div>
                <span id="scaleSelectContainer" class="dropdownToolbarButton">
                  <select id="scaleSelect" title="Zoom" tabindex="23" data-l10n-id="zoom">
                    <option id="pageAutoOption" title="" value="auto" selected="selected" data-l10n-id="page_scale_auto">Automatic Zoom</option>
                    <option id="pageActualOption" title="" value="page-actual" data-l10n-id="page_scale_actual">Actual Size</option>
                    <option id="pageFitOption" title="" value="page-fit" data-l10n-id="page_scale_fit">Page Fit</option>
                    <option id="pageWidthOption" title="" value="page-width" data-l10n-id="page_scale_width">Page Width</option>
                    <option id="customScaleOption" title="" value="custom" disabled="disabled" hidden="true"></option>
                    <option title="" value="0.5" data-l10n-id="page_scale_percent" data-l10n-args='{ "scale": 50 }'>50%</option>
                    <option title="" value="0.75" data-l10n-id="page_scale_percent" data-l10n-args='{ "scale": 75 }'>75%</option>
                    <option title="" value="1" data-l10n-id="page_scale_percent" data-l10n-args='{ "scale": 100 }'>100%</option>
                    <option title="" value="1.25" data-l10n-id="page_scale_percent" data-l10n-args='{ "scale": 125 }'>125%</option>
                    <option title="" value="1.5" data-l10n-id="page_scale_percent" data-l10n-args='{ "scale": 150 }'>150%</option>
                    <option title="" value="2" data-l10n-id="page_scale_percent" data-l10n-args='{ "scale": 200 }'>200%</option>
                    <option title="" value="3" data-l10n-id="page_scale_percent" data-l10n-args='{ "scale": 300 }'>300%</option>
                    <option title="" value="4" data-l10n-id="page_scale_percent" data-l10n-args='{ "scale": 400 }'>400%</option>
                  </select>
                </span>
              </div>
            </div>
            <div id="loadingBar">
              <div class="progress">
                <div class="glimmer">
                </div>
              </div>
            </div>
          </div>
        </div>

        <div id="viewerContainer" tabindex="0">
          <div id="viewer" class="pdfViewer"></div>
        </div>
      </div> <!-- mainContainer -->

      <div id="dialogContainer">
        <dialog id="passwordDialog">
          <div class="row">
            <label for="password" id="passwordText" data-l10n-id="password_label">Enter the password to open this PDF file:</label>
          </div>
          <div class="row">
            <input type="password" id="password" class="toolbarField">
          </div>
          <div class="buttonRow">
            <button id="passwordCancel" class="dialogButton"><span data-l10n-id="password_cancel">Cancel</span></button>
            <button id="passwordSubmit" class="dialogButton"><span data-l10n-id="password_ok">OK</span></button>
          </div>
        </dialog>
        <dialog id="documentPropertiesDialog">
          <div class="row">
            <span id="fileNameLabel" data-l10n-id="document_properties_file_name">File name:</span>
            <p id="fileNameField" aria-labelledby="fileNameLabel">-</p>
          </div>
          <div class="row">
            <span id="fileSizeLabel" data-l10n-id="document_properties_file_size">File size:</span>
            <p id="fileSizeField" aria-labelledby="fileSizeLabel">-</p>
          </div>
          <div class="separator"></div>
          <div class="row">
            <span id="titleLabel" data-l10n-id="document_properties_title">Title:</span>
            <p id="titleField" aria-labelledby="titleLabel">-</p>
          </div>
          <div class="row">
            <span id="authorLabel" data-l10n-id="document_properties_author">Author:</span>
            <p id="authorField" aria-labelledby="authorLabel">-</p>
          </div>
          <div class="row">
            <span id="subjectLabel" data-l10n-id="document_properties_subject">Subject:</span>
            <p id="subjectField" aria-labelledby="subjectLabel">-</p>
          </div>
          <div class="row">
            <span id="keywordsLabel" data-l10n-id="document_properties_keywords">Keywords:</span>
            <p id="keywordsField" aria-labelledby="keywordsLabel">-</p>
          </div>
          <div class="row">
            <span id="creationDateLabel" data-l10n-id="document_properties_creation_date">Creation Date:</span>
            <p id="creationDateField" aria-labelledby="creationDateLabel">-</p>
          </div>
          <div class="row">
            <span id="modificationDateLabel" data-l10n-id="document_properties_modification_date">Modification Date:</span>
            <p id="modificationDateField" aria-labelledby="modificationDateLabel">-</p>
          </div>
          <div class="row">
            <span id="creatorLabel" data-l10n-id="document_properties_creator">Creator:</span>
            <p id="creatorField" aria-labelledby="creatorLabel">-</p>
          </div>
          <div class="separator"></div>
          <div class="row">
            <span id="producerLabel" data-l10n-id="document_properties_producer">PDF Producer:</span>
            <p id="producerField" aria-labelledby="producerLabel">-</p>
          </div>
          <div class="row">
            <span id="versionLabel" data-l10n-id="document_properties_version">PDF Version:</span>
            <p id="versionField" aria-labelledby="versionLabel">-</p>
          </div>
          <div class="row">
            <span id="pageCountLabel" data-l10n-id="document_properties_page_count">Page Count:</span>
            <p id="pageCountField" aria-labelledby="pageCountLabel">-</p>
          </div>
          <div class="row">
            <span id="pageSizeLabel" data-l10n-id="document_properties_page_size">Page Size:</span>
            <p id="pageSizeField" aria-labelledby="pageSizeLabel">-</p>
          </div>
          <div class="separator"></div>
          <div class="row">
            <span id="linearizedLabel" data-l10n-id="document_properties_linearized">Fast Web View:</span>
            <p id="linearizedField" aria-labelledby="linearizedLabel">-</p>
          </div>
          <div class="buttonRow">
            <button id="documentPropertiesClose" class="dialogButton"><span data-l10n-id="document_properties_close">Close</span></button>
          </div>
        </dialog>
        <dialog id="printServiceDialog" style="min-width: 200px;">
          <div class="row">
            <span data-l10n-id="print_progress_message">Preparing document for printing…</span>
          </div>
          <div class="row">
            <progress value="0" max="100"></progress>
            <span data-l10n-id="print_progress_percent" data-l10n-args='{ "progress": 0 }' class="relative-progress">0%</span>
          </div>
          <div class="buttonRow">
            <button id="printCancel" class="dialogButton"><span data-l10n-id="print_progress_close">Cancel</span></button>
          </div>
        </dialog>
      </div>  <!-- dialogContainer -->

    </div> <!-- outerContainer -->
    <div id="printContainer"></div>

    <input type="file" id="fileInput" class="hidden">
  </body>`;

    const tail = ['</html>'].join('\n');

    return head + body + tail;
  }

  // ============== 状态栏功能 ==============
  private updateStatusBar(): void {
    // 追踪页面访问
    this.trackPageVisit(this._currentPage);

    // 使用增强状态栏
    const config = vscode.workspace.getConfiguration('pdf-preview');
    const showProgress = config.get('statusBar.showProgress', true);
    const showEstimatedTime = config.get('statusBar.showEstimatedTime', true);

    let statusText = `$(file-pdf) ${this._currentPage}/${this._totalPages}`;

    if (showProgress) {
      const progress = this.getReadingProgress();
      if (progress > 0) {
        statusText += ` | ${progress}%`;
      }
    }

    if (showEstimatedTime) {
      const remaining = this.getEstimatedRemainingTime();
      if (remaining > 0 && this.getReadingProgress() < 100) {
        statusText += ` | ~${remaining}m`;
      }
    }

    this._statusBarItem.text = statusText;
    this._statusBarItem.tooltip = t(
      'msg.statusBarTooltipEnhanced',
      this._currentPage,
      this._totalPages,
      this.getReadingProgress(),
      this.getEstimatedRemainingTime()
    );

    if (this.webviewEditor.active) {
      this._statusBarItem.show();
    }
  }

  // ============== 状态持久化功能 ==============
  private getStateKey(): string {
    return `pdf-state-${this.resource.toString()}`;
  }

  private saveState(): void {
    const state: PdfState = {
      page: this._currentPage,
      scale: this._currentScale,
      scrollTop: 0,
      scrollLeft: 0,
    };
    this.context.workspaceState.update(this.getStateKey(), state);
  }

  private restoreState(): void {
    const state = this.context.workspaceState.get<PdfState>(this.getStateKey());
    if (state) {
      this._currentPage = state.page;
      this._currentScale = state.scale;
      this.webviewEditor.webview.postMessage({
        type: 'restoreState',
        page: state.page,
        scale: state.scale,
      });
    }
  }

  // ============== 书签功能 ==============
  private getBookmarksKey(): string {
    return `pdf-bookmarks-${this.resource.toString()}`;
  }

  private loadBookmarks(): void {
    this._bookmarks =
      this.context.globalState.get<Bookmark[]>(this.getBookmarksKey()) || [];
  }

  private saveBookmarks(): void {
    this.context.globalState.update(this.getBookmarksKey(), this._bookmarks);
  }

  public addBookmark(label?: string): void {
    const bookmark: Bookmark = {
      page: this._currentPage,
      label: label || t('msg.page', this._currentPage),
      timestamp: Date.now(),
    };
    this._bookmarks.push(bookmark);
    this.saveBookmarks();
    vscode.window.showInformationMessage(
      t('msg.bookmarkAdded', bookmark.label)
    );
  }

  public async showBookmarks(): Promise<void> {
    if (this._bookmarks.length === 0) {
      vscode.window.showInformationMessage(t('msg.noBookmarks'));
      return;
    }

    const items = this._bookmarks.map((b, index) => ({
      label: b.label,
      description: t('msg.page', b.page),
      detail: new Date(b.timestamp).toLocaleString(),
      index,
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: t('msg.selectBookmark'),
    });

    if (selected) {
      this.gotoPage(this._bookmarks[selected.index].page);
    }
  }

  public async removeBookmark(): Promise<void> {
    if (this._bookmarks.length === 0) {
      vscode.window.showInformationMessage(t('msg.noBookmarksToRemove'));
      return;
    }

    const items = this._bookmarks.map((b, index) => ({
      label: b.label,
      description: t('msg.page', b.page),
      index,
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: t('msg.selectBookmarkRemove'),
    });

    if (selected) {
      this._bookmarks.splice(selected.index, 1);
      this.saveBookmarks();
      vscode.window.showInformationMessage(t('msg.bookmarkRemoved'));
    }
  }

  // ============== 页面导航功能 ==============
  public async gotoPage(page?: number): Promise<void> {
    if (page === undefined) {
      const input = await vscode.window.showInputBox({
        prompt: t('msg.enterPageNumber', this._totalPages),
        validateInput: (value) => {
          const num = parseInt(value, 10);
          if (isNaN(num) || num < 1 || num > this._totalPages) {
            return t('msg.invalidPageNumber', this._totalPages);
          }
          return null;
        },
      });
      if (input) {
        page = parseInt(input, 10);
      }
    }

    if (page !== undefined && page >= 1 && page <= this._totalPages) {
      this.webviewEditor.webview.postMessage({ type: 'gotoPage', page });
      this._currentPage = page;
      this.updateStatusBar();
    }
  }

  public firstPage(): void {
    this.gotoPage(1);
  }

  public lastPage(): void {
    this.gotoPage(this._totalPages);
  }

  public nextPage(): void {
    if (this._currentPage < this._totalPages) {
      this.gotoPage(this._currentPage + 1);
    }
  }

  public previousPage(): void {
    if (this._currentPage > 1) {
      this.gotoPage(this._currentPage - 1);
    }
  }

  // ============== 缩放功能 ==============
  public zoomIn(): void {
    this.webviewEditor.webview.postMessage({ type: 'zoomIn' });
  }

  public zoomOut(): void {
    this.webviewEditor.webview.postMessage({ type: 'zoomOut' });
  }

  public async setZoom(): Promise<void> {
    const items = [
      { label: t('zoom.auto'), value: 'auto' },
      { label: t('zoom.actualSize'), value: 'page-actual' },
      { label: t('zoom.pageFit'), value: 'page-fit' },
      { label: t('zoom.pageWidth'), value: 'page-width' },
      { label: '50%', value: '0.5' },
      { label: '75%', value: '0.75' },
      { label: '100%', value: '1' },
      { label: '125%', value: '1.25' },
      { label: '150%', value: '1.5' },
      { label: '200%', value: '2' },
      { label: '300%', value: '3' },
      { label: '400%', value: '4' },
    ];

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: t('msg.selectZoomLevel'),
    });

    if (selected) {
      this.webviewEditor.webview.postMessage({
        type: 'setScale',
        scale: selected.value,
      });
      this._currentScale = selected.value;
      this.saveState();
    }
  }

  // ============== 打印功能 ==============
  public print(): void {
    this.webviewEditor.webview.postMessage({ type: 'print' });
  }

  // ============== 导出功能 ==============
  public async exportPdf(): Promise<void> {
    const defaultUri = vscode.Uri.file(this.resource.fsPath);
    const uri = await vscode.window.showSaveDialog({
      defaultUri,
      filters: { 'PDF Files': ['pdf'] },
      saveLabel: t('command.export'),
    });

    if (uri) {
      try {
        const fs = await import('fs');
        const sourceContent = fs.readFileSync(this.resource.fsPath);
        fs.writeFileSync(uri.fsPath, sourceContent);
        vscode.window.showInformationMessage(
          t('msg.exportSuccess', uri.fsPath)
        );
      } catch (error) {
        vscode.window.showErrorMessage(t('msg.exportError', String(error)));
      }
    }
  }

  // ============== 侧边栏功能 ==============
  public toggleSidebar(): void {
    this.webviewEditor.webview.postMessage({ type: 'toggleSidebar' });
  }

  // ============== 查找功能 ==============
  public find(): void {
    this.webviewEditor.webview.postMessage({ type: 'find' });
  }

  // ============== 旋转功能 ==============
  public rotateClockwise(): void {
    this.webviewEditor.webview.postMessage({ type: 'rotateCw' });
  }

  public rotateCounterClockwise(): void {
    this.webviewEditor.webview.postMessage({ type: 'rotateCcw' });
  }

  // ============== 滚动模式 ==============
  public async setScrollMode(): Promise<void> {
    const items = [
      { label: t('scroll.vertical'), value: 'vertical' },
      { label: t('scroll.horizontal'), value: 'horizontal' },
      { label: t('scroll.wrapped'), value: 'wrapped' },
      { label: t('scroll.page'), value: 'page' },
    ];

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: t('msg.selectScrollMode'),
    });

    if (selected) {
      this.webviewEditor.webview.postMessage({
        type: 'setScrollMode',
        mode: selected.value,
      });
    }
  }

  // ============== 分页模式 ==============
  public async setSpreadMode(): Promise<void> {
    const items = [
      { label: t('spread.none'), value: 'none' },
      { label: t('spread.odd'), value: 'odd' },
      { label: t('spread.even'), value: 'even' },
    ];

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: t('msg.selectSpreadMode'),
    });

    if (selected) {
      this.webviewEditor.webview.postMessage({
        type: 'setSpreadMode',
        mode: selected.value,
      });
    }
  }

  // ============== 文档属性 ==============
  public showProperties(): void {
    this.webviewEditor.webview.postMessage({ type: 'showProperties' });
  }

  // ============== 光标工具 ==============
  public async setCursorTool(): Promise<void> {
    const items = [
      { label: t('cursor.select'), value: 'select' },
      { label: t('cursor.hand'), value: 'hand' },
    ];

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: t('msg.selectCursorTool'),
    });

    if (selected) {
      this.webviewEditor.webview.postMessage({
        type: 'setCursorTool',
        tool: selected.value,
      });
    }
  }

  // ============== 夜间模式 ==============
  public toggleNightMode(): void {
    this._nightMode = !this._nightMode;
    this.webviewEditor.webview.postMessage({
      type: 'setNightMode',
      enabled: this._nightMode,
    });
    vscode.window.showInformationMessage(
      this._nightMode ? t('msg.nightModeOn') : t('msg.nightModeOff')
    );
  }

  // ============== 演示模式 ==============
  public presentationMode(): void {
    this.webviewEditor.webview.postMessage({ type: 'presentationMode' });
    vscode.window.showInformationMessage(t('msg.presentationModeActive'));
  }

  // ============== 快速缩放 ==============
  public fitToWidth(): void {
    this.webviewEditor.webview.postMessage({
      type: 'setScale',
      scale: 'page-width',
    });
    this._currentScale = 'page-width';
    this.saveState();
  }

  public fitToPage(): void {
    this.webviewEditor.webview.postMessage({
      type: 'setScale',
      scale: 'page-fit',
    });
    this._currentScale = 'page-fit';
    this.saveState();
  }

  public actualSize(): void {
    this.webviewEditor.webview.postMessage({
      type: 'setScale',
      scale: 'page-actual',
    });
    this._currentScale = 'page-actual';
    this.saveState();
  }

  // ============== 大纲视图 ==============
  public showOutline(): void {
    this.webviewEditor.webview.postMessage({ type: 'showOutline' });
  }

  // ============== 最近位置 ==============
  private getRecentPositionsKey(): string {
    return 'pdf-recent-positions';
  }

  public saveCurrentPosition(): void {
    const positions =
      this.context.globalState.get<RecentPosition[]>(
        this.getRecentPositionsKey()
      ) || [];

    const newPosition: RecentPosition = {
      uri: this.resource.toString(),
      page: this._currentPage,
      timestamp: Date.now(),
      fileName: path.basename(this.resource.fsPath),
    };

    const existingIndex = positions.findIndex((p) => p.uri === newPosition.uri);
    if (existingIndex >= 0) {
      positions.splice(existingIndex, 1);
    }

    positions.unshift(newPosition);

    if (positions.length > 20) {
      positions.pop();
    }

    this.context.globalState.update(this.getRecentPositionsKey(), positions);
  }

  public async showRecentPositions(): Promise<void> {
    const positions =
      this.context.globalState.get<RecentPosition[]>(
        this.getRecentPositionsKey()
      ) || [];

    if (positions.length === 0) {
      vscode.window.showInformationMessage(t('msg.noRecentPositions'));
      return;
    }

    const items = positions.map((p, index) => ({
      label: p.fileName,
      description: t('msg.page', p.page),
      detail: new Date(p.timestamp).toLocaleString(),
      index,
      uri: p.uri,
      page: p.page,
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: t('msg.selectRecentPosition'),
    });

    if (selected) {
      const uri = vscode.Uri.parse(selected.uri);
      await vscode.commands.executeCommand(
        'vscode.openWith',
        uri,
        'pdf.preview'
      );
    }
  }

  public async clearRecentPositions(): Promise<void> {
    await this.context.globalState.update(this.getRecentPositionsKey(), []);
    vscode.window.showInformationMessage(t('msg.recentPositionsCleared'));
  }

  // ============== 复制功能 ==============
  public copySelection(): void {
    this.webviewEditor.webview.postMessage({ type: 'copySelection' });
  }

  public selectAll(): void {
    this.webviewEditor.webview.postMessage({ type: 'selectAll' });
  }

  // ============== 注释功能 ==============
  public async exportAnnotations(): Promise<void> {
    // 请求webview获取注释数据
    this.webviewEditor.webview.postMessage({ type: 'getAnnotations' });
  }

  public async copyAnnotations(): Promise<void> {
    // 请求webview获取注释数据并复制到剪贴板
    this.webviewEditor.webview.postMessage({ type: 'copyAnnotations' });
  }

  private async handleAnnotationsData(annotations: unknown[]): Promise<void> {
    if (!annotations || annotations.length === 0) {
      vscode.window.showInformationMessage(t('msg.noAnnotations'));
      return;
    }

    const defaultUri = vscode.Uri.file(
      this.resource.fsPath.replace(/\.pdf$/i, '_annotations.json')
    );
    const uri = await vscode.window.showSaveDialog({
      defaultUri,
      filters: {
        JSON: ['json'],
        Text: ['txt'],
      },
    });

    if (uri) {
      try {
        const fs = await import('fs');
        const content = JSON.stringify(annotations, null, 2);
        fs.writeFileSync(uri.fsPath, content, 'utf-8');
        vscode.window.showInformationMessage(
          t('msg.annotationsExported', uri.fsPath)
        );
      } catch (error) {
        vscode.window.showErrorMessage(
          t('msg.annotationsExportError', String(error))
        );
      }
    }
  }

  private async handleCopyAnnotations(annotations: unknown[]): Promise<void> {
    if (!annotations || annotations.length === 0) {
      vscode.window.showInformationMessage(t('msg.noAnnotations'));
      return;
    }

    const content = JSON.stringify(annotations, null, 2);
    await vscode.env.clipboard.writeText(content);
    vscode.window.showInformationMessage(t('msg.annotationsCopied'));
  }

  // ============== 页面历史导航 ==============
  private addToHistory(page: number): void {
    // 如果当前不在历史末尾，截断后面的记录
    if (this._historyIndex < this._pageHistory.length - 1) {
      this._pageHistory = this._pageHistory.slice(0, this._historyIndex + 1);
    }
    // 避免连续添加相同页面
    if (this._pageHistory[this._pageHistory.length - 1] !== page) {
      this._pageHistory.push(page);
      this._historyIndex = this._pageHistory.length - 1;
    }
    // 限制历史记录数量
    if (this._pageHistory.length > 50) {
      this._pageHistory.shift();
      this._historyIndex--;
    }
  }

  public goBack(): void {
    if (this._historyIndex > 0) {
      this._historyIndex--;
      this._isNavigating = true;
      this.gotoPage(this._pageHistory[this._historyIndex]);
    } else {
      vscode.window.showInformationMessage(t('msg.noBackHistory'));
    }
  }

  public goForward(): void {
    if (this._historyIndex < this._pageHistory.length - 1) {
      this._historyIndex++;
      this._isNavigating = true;
      this.gotoPage(this._pageHistory[this._historyIndex]);
    } else {
      vscode.window.showInformationMessage(t('msg.noForwardHistory'));
    }
  }

  // ============== 文本提取功能 ==============
  public extractPageText(): void {
    this.webviewEditor.webview.postMessage({
      type: 'extractText',
      page: this._currentPage,
    });
  }

  public extractAllText(): void {
    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: t('msg.extractingText', this._totalPages),
        cancellable: true,
      },
      async (progress, token) => {
        return new Promise<void>((resolve) => {
          this._extractCancelled = false;
          token.onCancellationRequested(() => {
            this._extractCancelled = true;
            this.webviewEditor.webview.postMessage({ type: 'cancelExtract' });
            resolve();
          });

          this._extractProgressCallback = (
            current: number,
            total: number
          ): void => {
            progress.report({
              increment: (1 / total) * 100,
              message: `${current}/${total}`,
            });
            if (current >= total) {
              resolve();
            }
          };

          this.webviewEditor.webview.postMessage({
            type: 'extractAllText',
          });
        });
      }
    );
  }

  // 提取指定页面范围的文本
  public async extractRangeText(): Promise<void> {
    const input = await vscode.window.showInputBox({
      prompt: t('msg.enterPageRangeForText', this._totalPages),
      placeHolder: t('msg.pageRangePlaceholder'),
      validateInput: (value) => {
        if (!value.trim()) return null;
        const rangePattern = /^(\d+(-\d+)?)(,\s*\d+(-\d+)?)*$/;
        if (!rangePattern.test(value.trim())) {
          return t('msg.invalidPageRange');
        }
        return null;
      },
    });

    if (!input) return;

    const pages = this.parsePageRange(input);
    if (pages.length === 0) {
      vscode.window.showWarningMessage(t('msg.noValidPages'));
      return;
    }

    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: t('msg.extractingText', pages.length),
        cancellable: true,
      },
      async (progress, token) => {
        return new Promise<void>((resolve) => {
          this._extractCancelled = false;
          token.onCancellationRequested(() => {
            this._extractCancelled = true;
            this.webviewEditor.webview.postMessage({ type: 'cancelExtract' });
            resolve();
          });

          this._extractProgressCallback = (
            current: number,
            total: number
          ): void => {
            progress.report({
              increment: (1 / total) * 100,
              message: `${current}/${total}`,
            });
            if (current >= total) {
              resolve();
            }
          };

          this.webviewEditor.webview.postMessage({
            type: 'extractRangeText',
            pages: pages,
          });
        });
      }
    );
  }

  // 提取选中的文本
  public extractSelection(): void {
    this.webviewEditor.webview.postMessage({
      type: 'extractSelection',
    });
  }

  private _extractCancelled = false;
  private _extractProgressCallback?: (current: number, total: number) => void;

  private async handleExtractedText(
    text: string,
    page?: number
  ): Promise<void> {
    this._extractProgressCallback = undefined;

    if (this._extractCancelled) {
      this._extractCancelled = false;
      return;
    }

    if (!text || text.trim().length === 0) {
      vscode.window.showInformationMessage(t('msg.noTextToExtract'));
      return;
    }

    const items = [
      { label: t('extract.copyToClipboard'), value: 'copy' },
      { label: t('extract.saveToFile'), value: 'save' },
      { label: t('extract.openInEditor'), value: 'editor' },
      { label: t('extract.openAsMarkdown'), value: 'markdown' },
    ];

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: t('msg.selectExtractAction'),
    });

    if (!selected) return;

    switch (selected.value) {
      case 'copy':
        await vscode.env.clipboard.writeText(text);
        vscode.window.showInformationMessage(t('msg.textExtractedCopied'));
        break;
      case 'save': {
        const defaultName = page
          ? this.resource.fsPath.replace(/\.pdf$/i, `_page${page}.txt`)
          : this.resource.fsPath.replace(/\.pdf$/i, '_text.txt');
        const uri = await vscode.window.showSaveDialog({
          defaultUri: vscode.Uri.file(defaultName),
          filters: { 'Text Files': ['txt'], Markdown: ['md'] },
        });
        if (uri) {
          const fs = await import('fs');
          fs.writeFileSync(uri.fsPath, text, 'utf-8');
          vscode.window.showInformationMessage(
            t('msg.textExtractedSaved', uri.fsPath)
          );
        }
        break;
      }
      case 'editor': {
        const doc = await vscode.workspace.openTextDocument({
          content: text,
          language: 'plaintext',
        });
        await vscode.window.showTextDocument(doc);
        break;
      }
      case 'markdown': {
        const doc = await vscode.workspace.openTextDocument({
          content: text,
          language: 'markdown',
        });
        await vscode.window.showTextDocument(doc);
        break;
      }
    }
  }

  // ============== 自动滚动功能 ==============
  public async startAutoScroll(): Promise<void> {
    if (this._autoScrollInterval) {
      this.stopAutoScroll();
      return;
    }

    const items = [
      { label: t('autoScroll.slow'), value: 0.5 },
      { label: t('autoScroll.normal'), value: 1 },
      { label: t('autoScroll.fast'), value: 2 },
      { label: t('autoScroll.veryFast'), value: 3 },
    ];

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: t('msg.selectScrollSpeed'),
    });

    if (!selected) return;

    this._autoScrollSpeed = selected.value;
    this.webviewEditor.webview.postMessage({
      type: 'startAutoScroll',
      speed: this._autoScrollSpeed,
    });
    vscode.window.showInformationMessage(t('msg.autoScrollStarted'));
  }

  public stopAutoScroll(): void {
    this.webviewEditor.webview.postMessage({ type: 'stopAutoScroll' });
    vscode.window.showInformationMessage(t('msg.autoScrollStopped'));
  }

  public toggleAutoScroll(): void {
    this.webviewEditor.webview.postMessage({ type: 'toggleAutoScroll' });
  }

  // ============== 比较视图功能 ==============
  public async openInSplitView(): Promise<void> {
    await vscode.commands.executeCommand(
      'vscode.openWith',
      this.resource,
      'pdf.preview',
      vscode.ViewColumn.Beside
    );
  }

  // ============== 页面笔记功能 ==============
  private getNotesKey(): string {
    return `pdf-notes-${this.resource.toString()}`;
  }

  private loadNotes(): void {
    const notes =
      this.context.globalState.get<Record<string, PageNote>>(
        this.getNotesKey()
      ) || {};
    this._pageNotes = new Map(
      Object.entries(notes).map(([k, v]) => [parseInt(k), v])
    );
  }

  private saveNotes(): void {
    const notesObj: Record<string, PageNote> = {};
    this._pageNotes.forEach((note, page) => {
      notesObj[page.toString()] = note;
    });
    this.context.globalState.update(this.getNotesKey(), notesObj);
  }

  public async addPageNote(): Promise<void> {
    const existingNote = this._pageNotes.get(this._currentPage);
    const input = await vscode.window.showInputBox({
      prompt: t('msg.enterPageNote', this._currentPage),
      value: existingNote?.content || '',
      placeHolder: t('msg.noteplaceholder'),
    });

    if (input !== undefined) {
      if (input.trim() === '') {
        this._pageNotes.delete(this._currentPage);
        vscode.window.showInformationMessage(t('msg.noteDeleted'));
      } else {
        this._pageNotes.set(this._currentPage, {
          page: this._currentPage,
          content: input,
          timestamp: Date.now(),
        });
        vscode.window.showInformationMessage(t('msg.noteSaved'));
      }
      this.saveNotes();
    }
  }

  public async showPageNotes(): Promise<void> {
    this.loadNotes();
    if (this._pageNotes.size === 0) {
      vscode.window.showInformationMessage(t('msg.noNotes'));
      return;
    }

    const items = Array.from(this._pageNotes.entries()).map(([page, note]) => ({
      label: t('msg.page', page),
      description:
        note.content.substring(0, 50) + (note.content.length > 50 ? '...' : ''),
      detail: new Date(note.timestamp).toLocaleString(),
      page,
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: t('msg.selectPageNote'),
    });

    if (selected) {
      this.gotoPage(selected.page);
    }
  }

  public async exportNotes(): Promise<void> {
    this.loadNotes();
    if (this._pageNotes.size === 0) {
      vscode.window.showInformationMessage(t('msg.noNotes'));
      return;
    }

    const notes = Array.from(this._pageNotes.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([page, note]) => `## Page ${page}\n${note.content}\n`)
      .join('\n');

    const content = `# Notes for ${path.basename(
      this.resource.fsPath
    )}\n\n${notes}`;

    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(
        this.resource.fsPath.replace(/\.pdf$/i, '_notes.md')
      ),
      filters: { Markdown: ['md'], Text: ['txt'] },
    });

    if (uri) {
      const fs = await import('fs');
      fs.writeFileSync(uri.fsPath, content, 'utf-8');
      vscode.window.showInformationMessage(t('msg.notesExported', uri.fsPath));
    }
  }

  // ============== 快捷百分比跳转 ==============
  public async gotoPercent(): Promise<void> {
    const input = await vscode.window.showInputBox({
      prompt: t('msg.enterPercent'),
      validateInput: (value) => {
        const num = parseInt(value, 10);
        if (isNaN(num) || num < 0 || num > 100) {
          return t('msg.invalidPercent');
        }
        return null;
      },
    });

    if (input) {
      const percent = parseInt(input, 10);
      const page = Math.max(1, Math.round((percent / 100) * this._totalPages));
      this.gotoPage(page);
    }
  }

  // ============== 颜色模式功能 ==============
  public async setColorMode(): Promise<void> {
    const items = [
      { label: t('colorMode.normal'), value: 'normal' as const },
      { label: t('colorMode.night'), value: 'night' as const },
      { label: t('colorMode.grayscale'), value: 'grayscale' as const },
      { label: t('colorMode.sepia'), value: 'sepia' as const },
      { label: t('colorMode.highContrast'), value: 'highContrast' as const },
    ];

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: t('msg.selectColorMode'),
    });

    if (selected) {
      this._colorMode = selected.value;
      this._nightMode = selected.value === 'night';
      this.webviewEditor.webview.postMessage({
        type: 'setColorMode',
        mode: selected.value,
      });
      vscode.window.showInformationMessage(
        t('msg.colorModeChanged', selected.label)
      );
    }
  }

  // ============== 快速跳转到特定页面 ==============
  public async quickJump(): Promise<void> {
    const items = [
      { label: t('quickJump.first'), value: 1 },
      {
        label: t('quickJump.quarter'),
        value: Math.round(this._totalPages * 0.25),
      },
      { label: t('quickJump.half'), value: Math.round(this._totalPages * 0.5) },
      {
        label: t('quickJump.threeQuarters'),
        value: Math.round(this._totalPages * 0.75),
      },
      { label: t('quickJump.last'), value: this._totalPages },
    ];

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: t('msg.selectQuickJump'),
    });

    if (selected) {
      this.gotoPage(selected.value);
    }
  }

  // ============== 复制当前页码信息 ==============
  public async copyPageInfo(): Promise<void> {
    const info = `${path.basename(this.resource.fsPath)} - Page ${
      this._currentPage
    } of ${this._totalPages}`;
    await vscode.env.clipboard.writeText(info);
    vscode.window.showInformationMessage(t('msg.pageInfoCopied'));
  }

  // ============== 反向链接（从其他文档跳转回来） ==============
  public getPageLink(): string {
    return `${this.resource.toString()}#page=${this._currentPage}`;
  }

  public async copyPageLink(): Promise<void> {
    const link = this.getPageLink();
    await vscode.env.clipboard.writeText(link);
    vscode.window.showInformationMessage(t('msg.pageLinkCopied'));
  }

  // ============== 页面提取功能 ==============
  public async extractPages(): Promise<void> {
    const input = await vscode.window.showInputBox({
      prompt: t('msg.enterPageRange', this._totalPages),
      placeHolder: t('msg.pageRangePlaceholder'),
      validateInput: (value) => {
        if (!value.trim()) return null;
        const rangePattern = /^(\d+(-\d+)?)(,\s*\d+(-\d+)?)*$/;
        if (!rangePattern.test(value.trim())) {
          return t('msg.invalidPageRange');
        }
        return null;
      },
    });

    if (!input) return;

    const pages = this.parsePageRange(input);
    if (pages.length === 0) {
      vscode.window.showWarningMessage(t('msg.noValidPages'));
      return;
    }

    // 请求 Webview 提取指定页面
    this.webviewEditor.webview.postMessage({
      type: 'extractPages',
      pages: pages,
    });
  }

  private parsePageRange(input: string): number[] {
    const pages: Set<number> = new Set();
    const parts = input.split(',').map((p) => p.trim());

    for (const part of parts) {
      if (part.includes('-')) {
        const [start, end] = part.split('-').map((n) => parseInt(n, 10));
        if (!isNaN(start) && !isNaN(end)) {
          for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
            if (i >= 1 && i <= this._totalPages) {
              pages.add(i);
            }
          }
        }
      } else {
        const page = parseInt(part, 10);
        if (!isNaN(page) && page >= 1 && page <= this._totalPages) {
          pages.add(page);
        }
      }
    }

    return Array.from(pages).sort((a, b) => a - b);
  }

  // ============== 页面截图功能 ==============
  public async capturePageScreenshot(): Promise<void> {
    this.webviewEditor.webview.postMessage({
      type: 'captureScreenshot',
      page: this._currentPage,
    });
  }

  public async captureAllPagesScreenshot(): Promise<void> {
    const confirm = await vscode.window.showWarningMessage(
      t('msg.captureAllPagesWarning', this._totalPages),
      { modal: true },
      t('btn.confirm')
    );

    if (confirm) {
      this.webviewEditor.webview.postMessage({
        type: 'captureAllScreenshots',
        totalPages: this._totalPages,
      });
    }
  }

  // ============== 文档比较功能 ==============
  public async compareWithAnotherPdf(): Promise<void> {
    const uris = await vscode.window.showOpenDialog({
      canSelectMany: false,
      filters: { 'PDF Files': ['pdf'] },
      title: t('msg.selectPdfToCompare'),
    });

    if (uris && uris.length > 0) {
      // 在新的编辑器组中打开当前 PDF
      await vscode.commands.executeCommand(
        'vscode.openWith',
        this.resource,
        'pdf.preview',
        vscode.ViewColumn.One
      );
      // 在另一个编辑器组中打开选择的 PDF
      await vscode.commands.executeCommand(
        'vscode.openWith',
        uris[0],
        'pdf.preview',
        vscode.ViewColumn.Two
      );
      vscode.window.showInformationMessage(t('msg.compareViewOpened'));
    }
  }

  // ============== 复制页面为图片 ==============
  public async copyPageAsImage(): Promise<void> {
    this.webviewEditor.webview.postMessage({
      type: 'copyPageAsImage',
      page: this._currentPage,
    });
  }

  // ============== 页面范围打印 ==============
  public async printPageRange(): Promise<void> {
    const input = await vscode.window.showInputBox({
      prompt: t('msg.enterPrintRange', this._totalPages),
      placeHolder: t('msg.pageRangePlaceholder'),
    });

    if (input) {
      const pages = this.parsePageRange(input);
      if (pages.length > 0) {
        this.webviewEditor.webview.postMessage({
          type: 'printPages',
          pages: pages,
        });
      }
    }
  }

  // ============== 缩放到选区 ==============
  public zoomToSelection(): void {
    this.webviewEditor.webview.postMessage({ type: 'zoomToSelection' });
  }

  // ============== 全屏模式 ==============
  public toggleFullscreen(): void {
    this.webviewEditor.webview.postMessage({ type: 'toggleFullscreen' });
  }

  // ============== 双页视图 ==============
  public toggleDualPageView(): void {
    this.webviewEditor.webview.postMessage({ type: 'toggleDualPage' });
  }

  // ============== 连续滚动视图 ==============
  public toggleContinuousScroll(): void {
    this.webviewEditor.webview.postMessage({ type: 'toggleContinuousScroll' });
  }

  // ============== 显示页面缩略图导航 ==============
  public async showThumbnailNavigator(): Promise<void> {
    // 显示缩略图侧边栏
    this.webviewEditor.webview.postMessage({ type: 'showThumbnails' });
  }

  // ============== 反色模式 ==============
  public toggleInvertColors(): void {
    this.webviewEditor.webview.postMessage({ type: 'toggleInvertColors' });
  }

  // ============== 查看元数据 ==============
  public async showMetadata(): Promise<void> {
    this.webviewEditor.webview.postMessage({ type: 'getMetadata' });
  }

  // ============== 复制当前页为 Markdown 引用 ==============
  public async copyAsMarkdownLink(): Promise<void> {
    const fileName = path.basename(this.resource.fsPath);
    const link = `[${fileName} - Page ${
      this._currentPage
    }](${this.resource.toString()}#page=${this._currentPage})`;
    await vscode.env.clipboard.writeText(link);
    vscode.window.showInformationMessage(t('msg.markdownLinkCopied'));
  }

  // ============== 新窗口打开 ==============
  public async openInNewWindow(): Promise<void> {
    await vscode.commands.executeCommand(
      'vscode.openWith',
      this.resource,
      'pdf.preview',
      { viewColumn: vscode.ViewColumn.Active, preserveFocus: false }
    );
  }

  // ============== 整页截取 ==============
  public async captureVisibleArea(): Promise<void> {
    this.webviewEditor.webview.postMessage({ type: 'captureVisibleArea' });
  }

  // ============== 选择性高亮 ==============
  public async highlightSelection(): Promise<void> {
    this.webviewEditor.webview.postMessage({
      type: 'highlightSelection',
      color: this._currentHighlightColor,
    });
  }

  public async setHighlightColor(): Promise<void> {
    const colors = [
      {
        label: '$(circle-filled) ' + t('highlight.yellow'),
        value: '#FFFF00',
        color: 'yellow',
      },
      {
        label: '$(circle-filled) ' + t('highlight.green'),
        value: '#90EE90',
        color: 'green',
      },
      {
        label: '$(circle-filled) ' + t('highlight.blue'),
        value: '#87CEEB',
        color: 'blue',
      },
      {
        label: '$(circle-filled) ' + t('highlight.pink'),
        value: '#FFB6C1',
        color: 'pink',
      },
      {
        label: '$(circle-filled) ' + t('highlight.orange'),
        value: '#FFA500',
        color: 'orange',
      },
      {
        label: '$(circle-filled) ' + t('highlight.purple'),
        value: '#DDA0DD',
        color: 'purple',
      },
      {
        label: '$(circle-filled) ' + t('highlight.red'),
        value: '#FF6B6B',
        color: 'red',
      },
      {
        label: '$(circle-filled) ' + t('highlight.cyan'),
        value: '#00CED1',
        color: 'cyan',
      },
      {
        label: '$(edit) ' + t('highlight.custom'),
        value: 'custom',
        color: 'custom',
      },
    ];

    const selected = await vscode.window.showQuickPick(colors, {
      placeHolder: t('msg.selectHighlightColor'),
    });

    if (!selected) return;

    if (selected.value === 'custom') {
      const customColor = await vscode.window.showInputBox({
        prompt: t('msg.enterCustomColor'),
        placeHolder: '#FF0000',
        validateInput: (value) => {
          if (!/^#[0-9A-Fa-f]{6}$/.test(value)) {
            return t('msg.invalidColorFormat');
          }
          return null;
        },
      });
      if (customColor) {
        this._currentHighlightColor = customColor;
      }
    } else {
      this._currentHighlightColor = selected.value;
    }

    vscode.window.showInformationMessage(
      t('msg.highlightColorSet', this._currentHighlightColor)
    );
  }

  public async highlightSelectionWithColor(): Promise<void> {
    await this.setHighlightColor();
    this.highlightSelection();
  }

  public async showHighlightsList(): Promise<void> {
    this.webviewEditor.webview.postMessage({ type: 'getHighlightsSummary' });
  }

  public async removeHighlightAtIndex(index: number): Promise<void> {
    this.webviewEditor.webview.postMessage({
      type: 'removeHighlight',
      index: index,
    });
  }

  // ============== 高亮数据持久化 ==============
  private getHighlightsKey(): string {
    return `pdf-highlights-${this.resource.toString()}`;
  }

  private loadHighlights(): void {
    this._savedHighlights =
      this.context.globalState.get<HighlightData[]>(this.getHighlightsKey()) ||
      [];
  }

  private saveHighlights(): void {
    this.context.globalState.update(
      this.getHighlightsKey(),
      this._savedHighlights
    );
  }

  public async restoreHighlights(): Promise<void> {
    if (this._savedHighlights.length > 0) {
      this.webviewEditor.webview.postMessage({
        type: 'restoreHighlights',
        highlights: this._savedHighlights,
      });
    }
  }

  private addHighlightToStorage(highlight: HighlightData): void {
    this._savedHighlights.push(highlight);
    this.saveHighlights();
  }

  private removeHighlightFromStorage(index: number): void {
    if (index >= 0 && index < this._savedHighlights.length) {
      this._savedHighlights.splice(index, 1);
      this.saveHighlights();
    }
  }

  private clearHighlightsStorage(): void {
    this._savedHighlights = [];
    this.saveHighlights();
  }

  private async handleHighlightsSummary(
    highlights: Array<{ index: number; color: string; text: string }>,
    total: number
  ): Promise<void> {
    if (!highlights || highlights.length === 0) {
      vscode.window.showInformationMessage(t('msg.noHighlights'));
      return;
    }

    const items = highlights.map((h) => ({
      label: `$(paintcan) ${h.text}`,
      description: t('msg.highlightIndex', h.index, total),
      detail: t('msg.highlightColor', h.color),
      index: h.index - 1,
      color: h.color,
    }));

    // 添加操作选项
    const actions = [
      { label: '$(trash) ' + t('action.deleteAll'), value: 'deleteAll' },
    ];

    const allItems = [
      ...items.map((item) => ({ ...item, value: 'highlight' as const })),
      {
        label: '',
        kind: vscode.QuickPickItemKind.Separator,
      } as unknown as (typeof items)[0] & { value: string },
      ...actions.map((a) => ({
        label: a.label,
        description: '',
        detail: '',
        index: -1,
        color: '',
        value: a.value,
      })),
    ];

    const selected = await vscode.window.showQuickPick(allItems, {
      placeHolder: t('msg.selectHighlight', total),
      matchOnDescription: true,
      matchOnDetail: true,
    });

    if (!selected) return;

    if (selected.value === 'deleteAll') {
      const confirm = await vscode.window.showWarningMessage(
        t('msg.confirmClearHighlights'),
        { modal: true },
        t('btn.confirm')
      );
      if (confirm) {
        this.webviewEditor.webview.postMessage({ type: 'clearAllHighlights' });
      }
    } else if (selected.index >= 0) {
      // 显示单个高亮操作选项
      const highlightActions = [
        { label: '$(search) ' + t('action.jumpTo'), value: 'jump' },
        { label: '$(trash) ' + t('action.delete'), value: 'delete' },
        { label: '$(copy) ' + t('action.copyText'), value: 'copy' },
      ];

      const action = await vscode.window.showQuickPick(highlightActions, {
        placeHolder: t('msg.selectHighlightAction'),
      });

      if (!action) return;

      switch (action.value) {
        case 'jump':
          this.webviewEditor.webview.postMessage({
            type: 'jumpToHighlightIndex',
            index: selected.index,
          });
          break;
        case 'delete':
          this.webviewEditor.webview.postMessage({
            type: 'removeHighlight',
            index: selected.index,
          });
          break;
        case 'copy': {
          const highlight = highlights.find(
            (h) => h.index === selected.index + 1
          );
          if (highlight) {
            await vscode.env.clipboard.writeText(highlight.text);
            vscode.window.showInformationMessage(t('msg.textCopied'));
          }
          break;
        }
      }
    }
  }

  // ============== 跳转到上次高亮 ==============
  public async jumpToNextHighlight(): Promise<void> {
    this.webviewEditor.webview.postMessage({ type: 'jumpToNextHighlight' });
  }

  // ============== 清除所有高亮 ==============
  public async clearAllHighlights(): Promise<void> {
    const confirm = await vscode.window.showWarningMessage(
      t('msg.confirmClearHighlights'),
      { modal: true },
      t('btn.confirm')
    );

    if (confirm) {
      this.webviewEditor.webview.postMessage({ type: 'clearAllHighlights' });
    }
  }

  // ============== 处理提取的页面 ==============
  private async handlePagesExtracted(
    pages: Array<{ page: number; dataUrl: string }>
  ): Promise<void> {
    if (!pages || pages.length === 0) {
      vscode.window.showWarningMessage(t('msg.noValidPages'));
      return;
    }

    const items = [
      { label: t('extract.saveAsImages'), value: 'images' },
      { label: t('extract.copyFirstPage'), value: 'copy' },
    ];

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: t('msg.selectExtractAction'),
    });

    if (!selected) return;

    switch (selected.value) {
      case 'images': {
        const folder = await vscode.window.showOpenDialog({
          canSelectFolders: true,
          canSelectFiles: false,
          canSelectMany: false,
          openLabel: t('msg.selectFolder'),
        });

        if (folder && folder[0]) {
          const fs = await import('fs');
          const path = await import('path');
          for (const pageData of pages) {
            const base64Data = pageData.dataUrl.replace(
              /^data:image\/png;base64,/,
              ''
            );
            const filePath = path.join(
              folder[0].fsPath,
              `page_${pageData.page}.png`
            );
            fs.writeFileSync(filePath, base64Data, 'base64');
          }
          vscode.window.showInformationMessage(
            t('msg.pagesExported', folder[0].fsPath)
          );
        }
        break;
      }
      case 'copy': {
        if (pages[0]) {
          await vscode.env.clipboard.writeText(pages[0].dataUrl);
          vscode.window.showInformationMessage(t('msg.imageCopied'));
        }
        break;
      }
    }
  }

  // ============== 处理元数据结果 ==============
  private async handleMetadataResult(metadata: {
    title: string;
    author: string;
    subject: string;
    keywords: string;
    creator: string;
    producer: string;
    creationDate: string;
    modificationDate: string;
    pageCount: number;
    pdfVersion: string;
    isLinearized: boolean;
    isAcroFormPresent: boolean;
    isXFAPresent: boolean;
  }): Promise<void> {
    const content = [
      `# ${t('msg.documentMetadata')}`,
      '',
      `**${t('metadata.title')}:** ${metadata.title || '-'}`,
      `**${t('metadata.author')}:** ${metadata.author || '-'}`,
      `**${t('metadata.subject')}:** ${metadata.subject || '-'}`,
      `**${t('metadata.keywords')}:** ${metadata.keywords || '-'}`,
      `**${t('metadata.creator')}:** ${metadata.creator || '-'}`,
      `**${t('metadata.producer')}:** ${metadata.producer || '-'}`,
      `**${t('metadata.creationDate')}:** ${metadata.creationDate || '-'}`,
      `**${t('metadata.modificationDate')}:** ${
        metadata.modificationDate || '-'
      }`,
      `**${t('metadata.pageCount')}:** ${metadata.pageCount}`,
      `**${t('metadata.pdfVersion')}:** ${metadata.pdfVersion || '-'}`,
      `**${t('metadata.isLinearized')}:** ${
        metadata.isLinearized ? 'Yes' : 'No'
      }`,
      `**${t('metadata.isAcroFormPresent')}:** ${
        metadata.isAcroFormPresent ? 'Yes' : 'No'
      }`,
      `**${t('metadata.isXFAPresent')}:** ${
        metadata.isXFAPresent ? 'Yes' : 'No'
      }`,
    ].join('\n');

    const doc = await vscode.workspace.openTextDocument({
      content: content,
      language: 'markdown',
    });
    await vscode.window.showTextDocument(doc);
  }

  // ============== 阅读统计功能 ==============
  private getReadingStatsKey(): string {
    return `pdf-reading-stats-${this.resource.toString()}`;
  }

  private loadReadingStats(): void {
    const stored = this.context.globalState.get<{
      uri: string;
      fileName: string;
      totalPages: number;
      pagesRead: number[];
      startTime: number;
      totalReadingTime: number;
      lastReadTime: number;
      lastPage: number;
    }>(this.getReadingStatsKey());

    if (stored) {
      this._readingStats = {
        ...stored,
        pagesRead: new Set(stored.pagesRead),
      };
    } else {
      this._readingStats = {
        uri: this.resource.toString(),
        fileName: path.basename(this.resource.fsPath),
        totalPages: this._totalPages,
        pagesRead: new Set(),
        startTime: Date.now(),
        totalReadingTime: 0,
        lastReadTime: Date.now(),
        lastPage: 1,
      };
    }
  }

  private saveReadingStats(): void {
    if (this._readingStats) {
      const toStore = {
        ...this._readingStats,
        pagesRead: Array.from(this._readingStats.pagesRead),
        totalPages: this._totalPages,
      };
      this.context.globalState.update(this.getReadingStatsKey(), toStore);
    }
  }

  private startReadingTimeTracking(): void {
    this._sessionStartTime = Date.now();
    this._readingTimeInterval = setInterval(() => {
      if (this._readingStats && this.webviewEditor.active) {
        this._readingStats.totalReadingTime += 1;
        this._readingStats.lastReadTime = Date.now();
        // 每30秒保存一次
        if (this._readingStats.totalReadingTime % 30 === 0) {
          this.saveReadingStats();
        }
      }
    }, 1000);

    this._register({
      dispose: () => {
        if (this._readingTimeInterval) {
          clearInterval(this._readingTimeInterval);
          this._readingTimeInterval = null;
        }
        this.saveReadingStats();
      },
    });
  }

  private trackPageVisit(page: number): void {
    this._pagesVisited.add(page);
    if (this._readingStats) {
      this._readingStats.pagesRead.add(page);
      this._readingStats.lastPage = page;
    }
  }

  public async showReadingStats(): Promise<void> {
    if (!this._readingStats) {
      vscode.window.showInformationMessage(t('msg.noReadingStats'));
      return;
    }

    const progress = Math.round(
      (this._readingStats.pagesRead.size / Math.max(this._totalPages, 1)) * 100
    );
    const totalMinutes = Math.floor(this._readingStats.totalReadingTime / 60);
    const totalSeconds = this._readingStats.totalReadingTime % 60;
    const sessionMinutes = Math.floor(
      (Date.now() - this._sessionStartTime) / 60000
    );

    const remainingPages = this._totalPages - this._readingStats.pagesRead.size;
    const avgTimePerPage =
      this._readingStats.pagesRead.size > 0
        ? this._readingStats.totalReadingTime /
          this._readingStats.pagesRead.size
        : this._estimatedReadingTimePerPage;
    const estimatedRemaining = Math.ceil(
      (remainingPages * avgTimePerPage) / 60
    );

    const content = [
      `# ${t('stats.title')}`,
      '',
      `**${t('stats.fileName')}:** ${this._readingStats.fileName}`,
      `**${t('stats.totalPages')}:** ${this._totalPages}`,
      `**${t('stats.pagesRead')}:** ${this._readingStats.pagesRead.size}`,
      `**${t('stats.progress')}:** ${progress}%`,
      `**${t('stats.totalReadingTime')}:** ${totalMinutes}${t(
        'stats.minutes'
      )} ${totalSeconds}${t('stats.seconds')}`,
      `**${t('stats.sessionTime')}:** ${sessionMinutes}${t('stats.minutes')}`,
      `**${t('stats.estimatedRemaining')}:** ${estimatedRemaining}${t(
        'stats.minutes'
      )}`,
      `**${t('stats.lastPage')}:** ${this._readingStats.lastPage}`,
      '',
      `## ${t('stats.pagesVisited')}`,
      Array.from(this._readingStats.pagesRead)
        .sort((a, b) => a - b)
        .join(', '),
    ].join('\n');

    const doc = await vscode.workspace.openTextDocument({
      content,
      language: 'markdown',
    });
    await vscode.window.showTextDocument(doc);
  }

  public async clearReadingStats(): Promise<void> {
    const confirm = await vscode.window.showWarningMessage(
      t('msg.confirmClearStats'),
      { modal: true },
      t('btn.confirm')
    );

    if (confirm) {
      await this.context.globalState.update(
        this.getReadingStatsKey(),
        undefined
      );
      this._readingStats = null;
      this.loadReadingStats();
      vscode.window.showInformationMessage(t('msg.statsCleared'));
    }
  }

  public getReadingProgress(): number {
    if (!this._readingStats || this._totalPages === 0) return 0;
    return Math.round(
      (this._readingStats.pagesRead.size / this._totalPages) * 100
    );
  }

  public getEstimatedRemainingTime(): number {
    if (!this._readingStats) return 0;
    const remainingPages = this._totalPages - this._readingStats.pagesRead.size;
    const avgTimePerPage =
      this._readingStats.pagesRead.size > 0
        ? this._readingStats.totalReadingTime /
          this._readingStats.pagesRead.size
        : this._estimatedReadingTimePerPage;
    return Math.ceil((remainingPages * avgTimePerPage) / 60);
  }

  // ============== 搜索历史功能 ==============
  private getSearchHistoryKey(): string {
    return 'pdf-search-history-global';
  }

  private loadSearchHistory(): void {
    this._searchHistory =
      this.context.globalState.get<SearchHistoryItem[]>(
        this.getSearchHistoryKey()
      ) || [];
  }

  private saveSearchHistory(): void {
    this.context.globalState.update(
      this.getSearchHistoryKey(),
      this._searchHistory
    );
  }

  public addSearchHistory(query: string, resultsCount?: number): void {
    if (!query.trim()) return;

    // 移除重复的搜索词
    this._searchHistory = this._searchHistory.filter(
      (item) => item.query.toLowerCase() !== query.toLowerCase()
    );

    this._searchHistory.unshift({
      query,
      timestamp: Date.now(),
      resultsCount,
    });

    // 最多保留50条记录
    if (this._searchHistory.length > 50) {
      this._searchHistory = this._searchHistory.slice(0, 50);
    }

    this.saveSearchHistory();
  }

  public async showSearchHistory(): Promise<void> {
    if (this._searchHistory.length === 0) {
      vscode.window.showInformationMessage(t('msg.noSearchHistory'));
      return;
    }

    const items = this._searchHistory.map((item, index) => ({
      label: item.query,
      description:
        item.resultsCount !== undefined
          ? t('msg.searchResults', item.resultsCount)
          : '',
      detail: new Date(item.timestamp).toLocaleString(),
      index,
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: t('msg.selectSearchHistory'),
    });

    if (selected) {
      this.webviewEditor.webview.postMessage({
        type: 'searchText',
        query: selected.label,
      });
    }
  }

  public async clearSearchHistory(): Promise<void> {
    const confirm = await vscode.window.showWarningMessage(
      t('msg.confirmClearSearchHistory'),
      { modal: true },
      t('btn.confirm')
    );

    if (confirm) {
      this._searchHistory = [];
      this.saveSearchHistory();
      vscode.window.showInformationMessage(t('msg.searchHistoryCleared'));
    }
  }

  // ============== 书签导入导出功能 ==============
  public async exportBookmarks(): Promise<void> {
    if (this._bookmarks.length === 0) {
      vscode.window.showInformationMessage(t('msg.noBookmarks'));
      return;
    }

    const exportData = {
      fileName: path.basename(this.resource.fsPath),
      exportTime: new Date().toISOString(),
      bookmarks: this._bookmarks,
    };

    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(
        this.resource.fsPath.replace(/\.pdf$/i, '_bookmarks.json')
      ),
      filters: { JSON: ['json'] },
    });

    if (uri) {
      const fs = await import('fs');
      fs.writeFileSync(
        uri.fsPath,
        JSON.stringify(exportData, null, 2),
        'utf-8'
      );
      vscode.window.showInformationMessage(
        t('msg.bookmarksExported', uri.fsPath)
      );
    }
  }

  public async importBookmarks(): Promise<void> {
    const uris = await vscode.window.showOpenDialog({
      canSelectMany: false,
      filters: { JSON: ['json'] },
      title: t('msg.selectBookmarksFile'),
    });

    if (!uris || uris.length === 0) return;

    try {
      const fs = await import('fs');
      const content = fs.readFileSync(uris[0].fsPath, 'utf-8');
      const data = JSON.parse(content);

      if (!data.bookmarks || !Array.isArray(data.bookmarks)) {
        vscode.window.showErrorMessage(t('msg.invalidBookmarksFile'));
        return;
      }

      const items = [
        { label: t('import.merge'), value: 'merge' },
        { label: t('import.replace'), value: 'replace' },
      ];

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: t('msg.selectImportMode'),
      });

      if (!selected) return;

      if (selected.value === 'replace') {
        this._bookmarks = data.bookmarks;
      } else {
        // 合并书签，避免重复
        const existingPages = new Set(this._bookmarks.map((b) => b.page));
        for (const bookmark of data.bookmarks) {
          if (!existingPages.has(bookmark.page)) {
            this._bookmarks.push(bookmark);
          }
        }
      }

      this.saveBookmarks();
      vscode.window.showInformationMessage(
        t('msg.bookmarksImported', data.bookmarks.length)
      );
    } catch (error) {
      vscode.window.showErrorMessage(
        t('msg.bookmarksImportError', String(error))
      );
    }
  }

  // ============== 快捷文本操作功能 ==============
  public async searchSelectedText(): Promise<void> {
    this.webviewEditor.webview.postMessage({ type: 'getSelectedText' });
  }

  public async translateSelectedText(): Promise<void> {
    this.webviewEditor.webview.postMessage({
      type: 'getSelectedTextForTranslate',
    });
  }

  public async copySelectedTextWithPage(): Promise<void> {
    this.webviewEditor.webview.postMessage({ type: 'getSelectedTextWithPage' });
  }

  // ============== 增强状态栏功能 ==============
  private updateStatusBarEnhanced(): void {
    const progress = this.getReadingProgress();
    const remaining = this.getEstimatedRemainingTime();

    let statusText = `$(file-pdf) ${this._currentPage}/${this._totalPages}`;

    if (progress > 0) {
      statusText += ` | ${progress}%`;
    }

    if (remaining > 0 && progress < 100) {
      statusText += ` | ~${remaining}${t('stats.minShort')}`;
    }

    this._statusBarItem.text = statusText;
    this._statusBarItem.tooltip = t(
      'msg.statusBarTooltipEnhanced',
      this._currentPage,
      this._totalPages,
      progress,
      remaining
    );
  }

  // ============== 快捷键帮助面板 ==============
  public async showKeyboardShortcuts(): Promise<void> {
    const shortcuts = [
      { key: 'Ctrl+G / Cmd+G', action: t('shortcut.gotoPage') },
      { key: 'PageUp / PageDown', action: t('shortcut.prevNextPage') },
      { key: 'Home / End', action: t('shortcut.firstLastPage') },
      { key: 'Ctrl+= / Ctrl+-', action: t('shortcut.zoomInOut') },
      { key: 'Ctrl+0', action: t('shortcut.actualSize') },
      { key: 'Ctrl+1 / Ctrl+2', action: t('shortcut.fitWidthPage') },
      { key: 'Ctrl+F', action: t('shortcut.find') },
      { key: 'Ctrl+B', action: t('shortcut.toggleSidebar') },
      { key: 'Ctrl+D', action: t('shortcut.addBookmark') },
      { key: 'Ctrl+Shift+B', action: t('shortcut.showBookmarks') },
      { key: 'Ctrl+Shift+N', action: t('shortcut.nightMode') },
      { key: 'F5', action: t('shortcut.presentationMode') },
      { key: 'Alt+Left / Alt+Right', action: t('shortcut.backForward') },
      { key: 'Ctrl+Shift+E', action: t('shortcut.extractText') },
      { key: 'Ctrl+M', action: t('shortcut.addNote') },
      { key: 'Ctrl+J', action: t('shortcut.quickJump') },
    ];

    const content = [
      `# ${t('shortcuts.title')}`,
      '',
      '| ' + t('shortcuts.key') + ' | ' + t('shortcuts.action') + ' |',
      '|---|---|',
      ...shortcuts.map((s) => `| \`${s.key}\` | ${s.action} |`),
    ].join('\n');

    const doc = await vscode.workspace.openTextDocument({
      content,
      language: 'markdown',
    });
    await vscode.window.showTextDocument(doc);
  }

  // ============== 大纲书签合并视图 ==============
  public async showOutlineWithBookmarks(): Promise<void> {
    // 获取PDF大纲
    this.webviewEditor.webview.postMessage({ type: 'getOutline' });
  }

  // ============== 文本操作处理 ==============
  private async handleSelectedTextForSearch(text: string): Promise<void> {
    if (!text) return;

    const items = [
      { label: t('msg.webSearch'), value: 'web' },
      { label: t('msg.searchInDocument'), value: 'document' },
    ];

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: t('msg.selectSearchAction'),
    });

    if (!selected) return;

    if (selected.value === 'web') {
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(
        text
      )}`;
      await vscode.env.openExternal(vscode.Uri.parse(searchUrl));
    } else {
      this.webviewEditor.webview.postMessage({
        type: 'searchText',
        query: text,
      });
      this.addSearchHistory(text);
    }
  }

  private async handleSelectedTextForTranslate(text: string): Promise<void> {
    if (!text) return;

    const translateUrl = `https://translate.google.com/?sl=auto&tl=zh-CN&text=${encodeURIComponent(
      text
    )}`;
    await vscode.env.openExternal(vscode.Uri.parse(translateUrl));
  }

  private async handleSelectedTextWithPage(
    text: string,
    page: number
  ): Promise<void> {
    if (!text) return;

    const fileName = path.basename(this.resource.fsPath);
    const content = `"${text}"\n\n— ${fileName}, ${t('msg.page', page)}`;
    await vscode.env.clipboard.writeText(content);
    vscode.window.showInformationMessage(t('msg.selectedTextCopied'));
  }

  private async handleOutlineResult(
    outline: Array<{
      title: string;
      dest: unknown;
      level: number;
      children: unknown[];
    }>
  ): Promise<void> {
    if (!outline || outline.length === 0) {
      // 如果没有大纲，只显示书签
      if (this._bookmarks.length === 0) {
        vscode.window.showInformationMessage(t('msg.noOutlineOrBookmarks'));
        return;
      }
      await this.showBookmarks();
      return;
    }

    // 合并大纲和书签
    type QuickPickItem = {
      label: string;
      description: string;
      detail?: string;
      type: 'outline' | 'bookmark';
      dest?: unknown;
      page?: number;
    };
    const items: QuickPickItem[] = [];

    // 添加大纲项
    type OutlineItem = {
      title: string;
      dest: unknown;
      level: number;
      children: unknown[];
    };
    const flattenOutline = (
      outlineItems: OutlineItem[],
      result: QuickPickItem[]
    ): void => {
      for (const item of outlineItems) {
        result.push({
          label: '  '.repeat(item.level) + '$(list-tree) ' + item.title,
          description: t('msg.outline'),
          type: 'outline',
          dest: item.dest,
        });
        if (item.children && Array.isArray(item.children)) {
          flattenOutline(item.children as OutlineItem[], result);
        }
      }
    };
    flattenOutline(outline, items);

    // 添加书签
    for (const bookmark of this._bookmarks) {
      items.push({
        label: '$(bookmark) ' + bookmark.label,
        description: t('msg.page', bookmark.page),
        detail: t('msg.bookmark'),
        type: 'bookmark',
        page: bookmark.page,
      });
    }

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: t('msg.selectOutlineOrBookmark'),
    });

    if (selected) {
      if (selected.type === 'bookmark' && selected.page) {
        this.gotoPage(selected.page);
      } else if (selected.type === 'outline' && selected.dest) {
        // 通过大纲目标跳转
        this.webviewEditor.webview.postMessage({
          type: 'navigateToDestination',
          dest: selected.dest,
        });
      }
    }
  }

  // ============== Getters ==============
  public get currentPage(): number {
    return this._currentPage;
  }

  public get totalPages(): number {
    return this._totalPages;
  }

  public get resourceUri(): vscode.Uri {
    return this.resource;
  }

  // ============== 扩展注释存储方法 ==============
  private addAnnotationToStorage(annotationData: AnnotationData): void {
    this._savedAnnotations.push(annotationData);
    this.saveAllAnnotations();
  }

  private loadAnnotations(): void {
    const key = `pdf.annotations.${this.resource.toString()}`;
    const stored = this.context.globalState.get<AnnotationData[]>(key, []);
    this._savedAnnotations = stored;
  }

  private saveAnnotations(): void {
    const key = `pdf.annotations.${this.resource.toString()}`;
    this.context.globalState.update(key, this._savedAnnotations);
  }

  // ============== 评论存储方法 ==============
  private addCommentToStorage(commentData: CommentData): void {
    this._savedComments.push(commentData);
    this.saveAllAnnotations();
  }

  private loadComments(): void {
    const key = `pdf.comments.${this.resource.toString()}`;
    const stored = this.context.globalState.get<CommentData[]>(key, []);
    this._savedComments = stored;
  }

  private saveComments(): void {
    const key = `pdf.comments.${this.resource.toString()}`;
    this.context.globalState.update(key, this._savedComments);
  }

  private handleCommentsList(
    comments: Array<{
      index: number;
      text: string;
      comment: string;
      page: number;
      color: string;
    }>,
    total: number
  ): void {
    if (total === 0) {
      vscode.window.showInformationMessage(t('msg.noComments'));
      return;
    }

    const items = comments.map((c) => ({
      label: `$(comment) ${c.comment}`,
      description: `${t('msg.page', c.page)}`,
      detail: c.text,
      index: c.index,
    }));

    vscode.window
      .showQuickPick(items, {
        placeHolder: t('msg.selectComment', total),
      })
      .then((selected) => {
        if (selected) {
          this.webviewEditor.webview.postMessage({
            type: 'jumpToComment',
            index: selected.index,
          });
        }
      });
  }

  private handleShowComment(message: {
    index: number;
    comment: string;
    text: string;
    page: number;
    author: string;
    timestamp: number;
  }): void {
    const date = new Date(message.timestamp).toLocaleString();
    const items = [
      { label: t('action.jumpTo'), value: 'jump' },
      { label: t('action.edit'), value: 'edit' },
      { label: t('action.delete'), value: 'delete' },
      { label: t('action.copyText'), value: 'copy' },
    ];

    vscode.window
      .showQuickPick(items, {
        placeHolder: `${message.comment} (${message.author} - ${date})`,
      })
      .then(async (selected) => {
        if (!selected) return;

        switch (selected.value) {
          case 'jump':
            this.webviewEditor.webview.postMessage({
              type: 'jumpToComment',
              index: message.index,
            });
            break;
          case 'edit': {
            const newComment = await vscode.window.showInputBox({
              value: message.comment,
              prompt: t('msg.editComment'),
            });
            if (newComment !== undefined) {
              this.webviewEditor.webview.postMessage({
                type: 'editComment',
                index: message.index,
                newComment: newComment,
              });
              // 更新存储
              if (this._savedComments[message.index]) {
                this._savedComments[message.index].comment = newComment;
                this.saveComments();
              }
            }
            break;
          }
          case 'delete':
            this.webviewEditor.webview.postMessage({
              type: 'deleteComment',
              index: message.index,
            });
            this._savedComments.splice(message.index, 1);
            this.saveComments();
            break;
          case 'copy':
            await vscode.env.clipboard.writeText(message.text);
            vscode.window.showInformationMessage(t('msg.textCopied'));
            break;
        }
      });
  }

  // ============== 便签存储方法 ==============
  private addStickyNoteToStorage(noteData: StickyNoteData): void {
    this._savedStickyNotes.push(noteData);
    this.saveAllAnnotations();
  }

  private loadStickyNotes(): void {
    const key = `pdf.stickyNotes.${this.resource.toString()}`;
    const stored = this.context.globalState.get<StickyNoteData[]>(key, []);
    this._savedStickyNotes = stored;
  }

  private saveStickyNotes(): void {
    const key = `pdf.stickyNotes.${this.resource.toString()}`;
    this.context.globalState.update(key, this._savedStickyNotes);
  }

  private updateStickyNoteInStorage(index: number, content: string): void {
    if (index >= 0 && index < this._savedStickyNotes.length) {
      this._savedStickyNotes[index].content = content;
      this.saveStickyNotes();
    }
  }

  private updateStickyNotePositionInStorage(
    index: number,
    x: number,
    y: number
  ): void {
    if (index >= 0 && index < this._savedStickyNotes.length) {
      this._savedStickyNotes[index].x = x;
      this._savedStickyNotes[index].y = y;
      this.saveStickyNotes();
    }
  }

  private handleStickyNotesList(
    notes: Array<{
      index: number;
      content: string;
      page: number;
      color: string;
    }>,
    total: number
  ): void {
    if (total === 0) {
      vscode.window.showInformationMessage(t('msg.noStickyNotes'));
      return;
    }

    const items = notes.map((n) => ({
      label: `$(note) ${n.content}`,
      description: `${t('msg.page', n.page)}`,
      index: n.index,
    }));

    vscode.window
      .showQuickPick(items, {
        placeHolder: t('msg.selectStickyNote', total),
      })
      .then((selected) => {
        if (selected) {
          this.gotoPage(notes[selected.index].page);
        }
      });
  }

  // ============== 绘图存储方法 ==============
  private addDrawingToStorage(drawingData: DrawingData): void {
    this._savedDrawings.push(drawingData);
    this.saveAllAnnotations();
  }

  private loadDrawings(): void {
    const key = `pdf.drawings.${this.resource.toString()}`;
    const stored = this.context.globalState.get<DrawingData[]>(key, []);
    this._savedDrawings = stored;
  }

  private saveDrawings(): void {
    const key = `pdf.drawings.${this.resource.toString()}`;
    this.context.globalState.update(key, this._savedDrawings);
  }

  private handleDrawingsList(
    drawings: Array<{
      index: number;
      type: string;
      page: number;
      color: string;
    }>,
    total: number
  ): void {
    if (total === 0) {
      vscode.window.showInformationMessage(t('msg.noDrawings'));
      return;
    }

    const items = drawings.map((d) => ({
      label: `$(pencil) ${d.type}`,
      description: `${t('msg.page', d.page)}`,
      index: d.index,
    }));

    vscode.window
      .showQuickPick(items, {
        placeHolder: t('msg.selectDrawing', total),
      })
      .then((selected) => {
        if (selected) {
          this.gotoPage(drawings[selected.index].page);
        }
      });
  }

  // ============== 全部注释数据处理 ==============
  private saveAllAnnotations(): void {
    this.saveHighlightsStorage();
    this.saveAnnotations();
    this.saveComments();
    this.saveStickyNotes();
    this.saveDrawings();
  }

  private loadAllAnnotations(): void {
    this.loadHighlights();
    this.loadAnnotations();
    this.loadComments();
    this.loadStickyNotes();
    this.loadDrawings();
  }

  private handleAllAnnotationsData(
    data: AllAnnotationsData,
    counts: {
      highlights: number;
      annotations: number;
      comments: number;
      stickyNotes: number;
      drawings: number;
    }
  ): void {
    const total =
      counts.highlights +
      counts.annotations +
      counts.comments +
      counts.stickyNotes +
      counts.drawings;

    if (total === 0) {
      vscode.window.showInformationMessage(t('msg.noAnnotationsToExport'));
      return;
    }

    // 导出为JSON文件
    vscode.window
      .showSaveDialog({
        defaultUri: vscode.Uri.file(
          this.resource.fsPath.replace(/\.pdf$/i, '_annotations.json')
        ),
        filters: { JSON: ['json'] },
      })
      .then(async (uri) => {
        if (uri) {
          const fs = await import('fs');
          const exportData = {
            fileName: path.basename(this.resource.fsPath),
            exportTime: new Date().toISOString(),
            ...data,
          };
          fs.writeFileSync(
            uri.fsPath,
            JSON.stringify(exportData, null, 2),
            'utf-8'
          );
          vscode.window.showInformationMessage(
            t('msg.annotationsExported', uri.fsPath)
          );
        }
      });
  }

  private saveHighlightsStorage(): void {
    const key = `pdf.highlights.${this.resource.toString()}`;
    this.context.globalState.update(key, this._savedHighlights);
  }

  // ============== 公开注释方法 ==============
  public async underlineSelection(): Promise<void> {
    this.webviewEditor.webview.postMessage({
      type: 'underlineSelection',
      color: this._currentHighlightColor,
    });
  }

  public async strikethroughSelection(): Promise<void> {
    this.webviewEditor.webview.postMessage({
      type: 'strikethroughSelection',
      color: this._currentHighlightColor,
    });
  }

  public async squigglySelection(): Promise<void> {
    this.webviewEditor.webview.postMessage({
      type: 'squigglySelection',
      color: this._currentHighlightColor,
    });
  }

  public async addCommentToSelection(): Promise<void> {
    const comment = await vscode.window.showInputBox({
      prompt: t('msg.enterComment'),
      placeHolder: t('msg.commentPlaceholder'),
    });

    if (comment !== undefined) {
      this.webviewEditor.webview.postMessage({
        type: 'addCommentToSelection',
        comment: comment,
        color: '#FFE4B5',
      });
    }
  }

  public async showCommentsList(): Promise<void> {
    this.webviewEditor.webview.postMessage({ type: 'getCommentsList' });
  }

  public async addStickyNote(): Promise<void> {
    const content = await vscode.window.showInputBox({
      prompt: t('msg.enterStickyNoteContent'),
      placeHolder: t('msg.stickyNotePlaceholder'),
    });

    if (content !== undefined) {
      this.webviewEditor.webview.postMessage({
        type: 'addStickyNoteAtSelection',
        content: content,
        color: '#FFFACD',
      });
    }
  }

  public async showStickyNotesList(): Promise<void> {
    this.webviewEditor.webview.postMessage({ type: 'getStickyNotes' });
  }

  public async startDrawingMode(): Promise<void> {
    const drawingTypes = [
      { label: t('drawing.rectangle'), value: 'rectangle' },
      { label: t('drawing.circle'), value: 'circle' },
      { label: t('drawing.arrow'), value: 'arrow' },
      { label: t('drawing.freehand'), value: 'freehand' },
    ];

    const selected = await vscode.window.showQuickPick(drawingTypes, {
      placeHolder: t('msg.selectDrawingType'),
    });

    if (selected) {
      this.webviewEditor.webview.postMessage({
        type: 'startDrawingMode',
        drawingType: selected.value,
        color: '#FF0000',
        strokeWidth: 2,
      });
    }
  }

  public stopDrawingMode(): void {
    this.webviewEditor.webview.postMessage({ type: 'stopDrawingMode' });
  }

  public clearDrawings(): void {
    this.webviewEditor.webview.postMessage({ type: 'clearDrawings' });
  }

  public async showDrawingsList(): Promise<void> {
    this.webviewEditor.webview.postMessage({ type: 'getDrawingAnnotations' });
  }

  public async exportAllAnnotations(): Promise<void> {
    this.webviewEditor.webview.postMessage({ type: 'getAllAnnotations' });
  }

  public async showAllAnnotationsList(): Promise<void> {
    const items = [
      {
        label: `$(lightbulb) ${t('annotation.highlights')} (${
          this._savedHighlights.length
        })`,
        value: 'highlights',
      },
      {
        label: `$(text-size) ${t('annotation.textAnnotations')} (${
          this._savedAnnotations.length
        })`,
        value: 'annotations',
      },
      {
        label: `$(comment) ${t('annotation.comments')} (${
          this._savedComments.length
        })`,
        value: 'comments',
      },
      {
        label: `$(note) ${t('annotation.stickyNotes')} (${
          this._savedStickyNotes.length
        })`,
        value: 'stickyNotes',
      },
      {
        label: `$(pencil) ${t('annotation.drawings')} (${
          this._savedDrawings.length
        })`,
        value: 'drawings',
      },
    ];

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: t('msg.selectAnnotationType'),
    });

    if (selected) {
      switch (selected.value) {
        case 'highlights':
          this.showHighlightsList();
          break;
        case 'annotations':
          // 显示文本注释列表
          break;
        case 'comments':
          this.showCommentsList();
          break;
        case 'stickyNotes':
          this.showStickyNotesList();
          break;
        case 'drawings':
          this.showDrawingsList();
          break;
      }
    }
  }
}
