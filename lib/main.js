"use strict";

(function () {
  const vscode = acquireVsCodeApi();
  
  // 存储 workerSrc 路径供后续使用
  let cachedWorkerSrc = null;
  
  // 设置 PDF.js worker 源路径，防止 "No GlobalWorkerOptions.workerSrc specified" 错误
  function initWorkerSrc() {
    if (typeof pdfjsLib === 'undefined') {
      console.warn('[PDF Viewer] pdfjsLib not available yet');
      return false;
    }
    
    // 如果已经设置过，直接返回
    if (pdfjsLib.GlobalWorkerOptions && pdfjsLib.GlobalWorkerOptions.workerSrc) {
      cachedWorkerSrc = pdfjsLib.GlobalWorkerOptions.workerSrc;
      return true;
    }
    
    // 首先尝试从配置中获取 workerSrc
    const configElem = document.getElementById('pdf-preview-config');
    if (configElem) {
      try {
        const config = JSON.parse(configElem.getAttribute('data-config'));
        if (config && config.workerSrc) {
          if (pdfjsLib.GlobalWorkerOptions) {
            pdfjsLib.GlobalWorkerOptions.workerSrc = config.workerSrc;
          }
          cachedWorkerSrc = config.workerSrc;
          console.log('[PDF Viewer] workerSrc set from config:', config.workerSrc);
          return true;
        }
      } catch (e) {
        console.warn('[PDF Viewer] Failed to parse config for workerSrc:', e);
      }
    }
    
    // 回退：从页面的 script 标签中找到 pdf.worker.js 的路径
    const scripts = document.getElementsByTagName('script');
    for (let i = 0; i < scripts.length; i++) {
      const src = scripts[i].src;
      if (src && src.includes('pdf.worker.js')) {
        if (pdfjsLib.GlobalWorkerOptions) {
          pdfjsLib.GlobalWorkerOptions.workerSrc = src;
        }
        cachedWorkerSrc = src;
        console.log('[PDF Viewer] workerSrc set from script tag:', src);
        return true;
      }
    }
    
    // 最后回退：从 pdf.js 路径推断
    for (let i = 0; i < scripts.length; i++) {
      const src = scripts[i].src;
      if (src && src.includes('/build/pdf.js')) {
        const workerSrc = src.replace('/build/pdf.js', '/build/pdf.worker.js');
        if (pdfjsLib.GlobalWorkerOptions) {
          pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
        }
        cachedWorkerSrc = workerSrc;
        console.log('[PDF Viewer] workerSrc inferred from pdf.js path:', workerSrc);
        return true;
      }
    }
    
    console.error('[PDF Viewer] Failed to initialize workerSrc');
    return false;
  }
  
  // 确保 workerSrc 在调用 getDocument 前已设置
  function ensureWorkerSrc() {
    if (typeof pdfjsLib !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
      if (!pdfjsLib.GlobalWorkerOptions.workerSrc && cachedWorkerSrc) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = cachedWorkerSrc;
      }
      if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
        initWorkerSrc();
      }
    }
  }
  
  // 立即初始化 workerSrc
  initWorkerSrc();
  
  // 防止递归调用的标志
  let isApplyingTheme = false;
  let currentTheme = null;
  
  // 检测VSCode主题类型
  function detectVSCodeTheme() {
    const body = document.body;
    if (body.classList.contains('vscode-high-contrast')) {
      return 'high-contrast';
    } else if (body.classList.contains('vscode-dark')) {
      return 'dark';
    } else if (body.classList.contains('vscode-light')) {
      return 'light';
    }
    // 回退：根据 CSS 变量检测
    const bgColor = getComputedStyle(body).getPropertyValue('--vscode-editor-background').trim();
    if (bgColor) {
      // 简单判断背景色亮度
      const rgb = bgColor.match(/\d+/g);
      if (rgb && rgb.length >= 3) {
        const brightness = (parseInt(rgb[0]) * 299 + parseInt(rgb[1]) * 587 + parseInt(rgb[2]) * 114) / 1000;
        return brightness < 128 ? 'dark' : 'light';
      }
    }
    // 最终回退：根据媒体查询
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  }
  
  // 检测并应用VSCode主题
  function applyTheme() {
    // 防止 MutationObserver 触发的无限循环
    if (isApplyingTheme) {
      return;
    }
    isApplyingTheme = true;
    
    try {
      const body = document.body;
      const classList = body.classList;
      const detectedTheme = detectVSCodeTheme();
      
      // 如果主题没有变化，不需要做任何处理
      if (detectedTheme === currentTheme) {
        return;
      }
      
      currentTheme = detectedTheme;
      
      // 确保有正确的主题类
      const hasThemeClass = classList.contains('vscode-dark') || 
                           classList.contains('vscode-light') || 
                           classList.contains('vscode-high-contrast');
      
      if (!hasThemeClass) {
        // 如果没有主题类，添加检测到的主题
        if (detectedTheme === 'high-contrast') {
          classList.add('vscode-high-contrast');
        } else if (detectedTheme === 'dark') {
          classList.add('vscode-dark');
        } else {
          classList.add('vscode-light');
        }
      }
      
      // 更新 PDF.js 的颜色变量以匹配 VSCode 主题
      updatePdfJsThemeVariables(detectedTheme);
      
      console.log('[PDF Viewer] Theme applied:', detectedTheme);
    } finally {
      isApplyingTheme = false;
    }
  }
  
  // 更新 PDF.js 颜色变量以匹配 VSCode 主题
  function updatePdfJsThemeVariables(theme) {
    const root = document.documentElement;
    const body = document.body;
    
    // 获取 VSCode 的 CSS 变量
    const editorBg = getComputedStyle(body).getPropertyValue('--vscode-editor-background').trim() || 
                     (theme === 'dark' ? '#1e1e1e' : '#ffffff');
    const editorFg = getComputedStyle(body).getPropertyValue('--vscode-editor-foreground').trim() || 
                     (theme === 'dark' ? '#cccccc' : '#333333');
    const sidebarBg = getComputedStyle(body).getPropertyValue('--vscode-sideBar-background').trim() || 
                      (theme === 'dark' ? '#252526' : '#f3f3f3');
    const inputBg = getComputedStyle(body).getPropertyValue('--vscode-input-background').trim() || 
                    (theme === 'dark' ? '#3c3c3c' : '#ffffff');
    const inputFg = getComputedStyle(body).getPropertyValue('--vscode-input-foreground').trim() || 
                    (theme === 'dark' ? '#cccccc' : '#333333');
    const buttonBg = getComputedStyle(body).getPropertyValue('--vscode-button-background').trim() || 
                     (theme === 'dark' ? '#0e639c' : '#007acc');
    const buttonFg = getComputedStyle(body).getPropertyValue('--vscode-button-foreground').trim() || '#ffffff';
    const borderColor = getComputedStyle(body).getPropertyValue('--vscode-panel-border').trim() || 
                        (theme === 'dark' ? '#454545' : '#c8c8c8');
    
    // 设置自定义 CSS 变量供 PDF.js 使用
    root.style.setProperty('--pdf-toolbar-bg', editorBg);
    root.style.setProperty('--pdf-toolbar-fg', editorFg);
    root.style.setProperty('--pdf-sidebar-bg', sidebarBg);
    root.style.setProperty('--pdf-input-bg', inputBg);
    root.style.setProperty('--pdf-input-fg', inputFg);
    root.style.setProperty('--pdf-button-bg', buttonBg);
    root.style.setProperty('--pdf-button-fg', buttonFg);
    root.style.setProperty('--pdf-border-color', borderColor);
    
    // 设置 viewerContainer 背景色
    const viewerBg = theme === 'dark' ? '#525659' : (theme === 'high-contrast' ? '#000000' : '#808080');
    root.style.setProperty('--pdf-viewer-bg', viewerBg);
  }
  
  function loadConfig() {
    const elem = document.getElementById('pdf-preview-config')
    if (elem) {
      return JSON.parse(elem.getAttribute('data-config'))
    }
    throw new Error('Could not load configuration.')
  }
  
  function cursorTools(name) {
    if (name === 'hand') {
      return 1
    }
    return 0
  }
  
  function scrollMode(name) {
    switch (name) {
      case 'vertical':
        return 0
      case 'horizontal':
        return 1
      case 'wrapped':
        return 2
      case 'page':
        return 3
      default:
        return -1
    }
  }
  
  function spreadMode(name) {
    switch (name) {
      case 'none':
        return 0
      case 'odd':
        return 1
      case 'even':
        return 2
      default:
        return -1
    }
  }

  // 通知扩展页面变化
  function notifyPageChange() {
    const currentPage = PDFViewerApplication.pdfViewer.currentPageNumber
    const totalPages = PDFViewerApplication.pagesCount
    vscode.postMessage({
      type: 'pageChanged',
      page: currentPage,
      total: totalPages
    })
  }

  // 通知扩展缩放变化
  function notifyScaleChange() {
    vscode.postMessage({
      type: 'scaleChanged',
      scale: PDFViewerApplication.pdfViewer.currentScaleValue
    })
  }

  window.addEventListener('load', async function () {
    // 应用主题
    applyTheme();
    
    // 监听主题变化 - 监听 body 的 class 和 style 属性变化
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes') {
          // 延迟执行以确保 VSCode 已完成主题切换
          setTimeout(applyTheme, 50);
          break;
        }
      }
    });
    observer.observe(document.body, { 
      attributes: true, 
      attributeFilter: ['class', 'style'] 
    });
    
    // 监听系统主题变化
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        setTimeout(applyTheme, 50);
      });
    }
    
    // 监听来自 VSCode 的主题变化消息
    window.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'themeChanged') {
        setTimeout(applyTheme, 50);
      }
    });
    
    const config = loadConfig()
    PDFViewerApplicationOptions.set('cMapUrl', config.cMapUrl)
    PDFViewerApplicationOptions.set('standardFontDataUrl', config.standardFontDataUrl)
    
    // 确保 workerSrc 已设置（关键：必须在任何 getDocument 调用前设置）
    if (config.workerSrc) {
      cachedWorkerSrc = config.workerSrc;
      if (pdfjsLib.GlobalWorkerOptions) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = config.workerSrc;
      }
    }
    // 双重确保 workerSrc 已设置
    ensureWorkerSrc();
    
    const loadOpts = {
      url: config.path,
      useWorkerFetch: false,
      cMapUrl: config.cMapUrl,
      cMapPacked: true,
      standardFontDataUrl: config.standardFontDataUrl,
      workerSrc: config.workerSrc
    }
    
    PDFViewerApplication.initializedPromise.then(() => {
      const defaults = config.defaults
      
      // 应用夜间模式
      if (config.nightMode || defaults.nightMode) {
        document.body.classList.add('night-mode')
      }
      
      // 设置locale
      if (config.locale) {
        PDFViewerApplicationOptions.set('locale', config.locale)
      }
      
      const optsOnLoad = () => {
        PDFViewerApplication.pdfCursorTools.switchTool(cursorTools(defaults.cursor))
        PDFViewerApplication.pdfViewer.currentScaleValue = defaults.scale
        PDFViewerApplication.pdfViewer.scrollMode = scrollMode(defaults.scrollMode)
        PDFViewerApplication.pdfViewer.spreadMode = spreadMode(defaults.spreadMode)
        if (defaults.sidebar) {
          PDFViewerApplication.pdfSidebar.open()
        } else {
          PDFViewerApplication.pdfSidebar.close()
        }
        
        // 通知扩展文档已加载
        vscode.postMessage({
          type: 'documentLoaded',
          total: PDFViewerApplication.pagesCount,
          page: PDFViewerApplication.pdfViewer.currentPageNumber
        })
        
        PDFViewerApplication.eventBus.off('documentloaded', optsOnLoad)
      }
      
      PDFViewerApplication.eventBus.on('documentloaded', optsOnLoad)
      
      PDFViewerApplication.eventBus.on('documentloaded', () => {
        // 请求恢复状态
        vscode.postMessage({ type: 'ready' })
        
        // 请求恢复保存的高亮
        vscode.postMessage({ type: 'requestStoredHighlights' })
      })
      
      // 监听页面变化事件
      PDFViewerApplication.eventBus.on('pagechanging', notifyPageChange)
      
      // 监听缩放变化事件
      PDFViewerApplication.eventBus.on('scalechanging', notifyScaleChange)
      
      // load() cannot be called before pdf.js is initialized
      // open() makes sure pdf.js is initialized before load()
      PDFViewerApplication.open(config.path).then(async function () {
        // 确保 workerSrc 在 getDocument 前已设置
        ensureWorkerSrc();
        const doc = await pdfjsLib.getDocument(loadOpts).promise
        doc._pdfInfo.fingerprints = [config.path]
        PDFViewerApplication.load(doc)
      })
    })

    // 处理来自扩展的消息
    window.addEventListener('message', async function (event) {
      const message = event.data
      
      switch (message.type) {
        case 'reload':
          // Prevents flickering of page when PDF is reloaded
          const oldResetView = PDFViewerApplication.pdfViewer._resetView
          PDFViewerApplication.pdfViewer._resetView = function () {
            this._firstPageCapability = (0, pdfjsLib.createPromiseCapability)()
            this._onePageRenderedCapability = (0, pdfjsLib.createPromiseCapability)()
            this._pagesCapability = (0, pdfjsLib.createPromiseCapability)()
            this.viewer.textContent = ""
          }
          // 确保 workerSrc 在 getDocument 前已设置
          ensureWorkerSrc();
          // Changing the fingerprint fools pdf.js into keeping scroll position
          const doc = await pdfjsLib.getDocument(loadOpts).promise
          doc._pdfInfo.fingerprints = [config.path]
          PDFViewerApplication.load(doc)
          PDFViewerApplication.pdfViewer._resetView = oldResetView
          break
          
        case 'gotoPage':
          if (message.page && message.page >= 1 && message.page <= PDFViewerApplication.pagesCount) {
            PDFViewerApplication.pdfViewer.currentPageNumber = message.page
          }
          break
          
        case 'restoreState':
          if (message.page) {
            PDFViewerApplication.pdfViewer.currentPageNumber = message.page
          }
          if (message.scale) {
            PDFViewerApplication.pdfViewer.currentScaleValue = message.scale
          }
          break
          
        case 'zoomIn':
          PDFViewerApplication.zoomIn()
          break
          
        case 'zoomOut':
          PDFViewerApplication.zoomOut()
          break
          
        case 'setScale':
          if (message.scale) {
            PDFViewerApplication.pdfViewer.currentScaleValue = message.scale
          }
          break
          
        case 'print':
          window.print()
          break
          
        case 'toggleSidebar':
          PDFViewerApplication.pdfSidebar.toggle()
          break
          
        case 'find':
          PDFViewerApplication.findBar.open()
          break
          
        case 'rotateCw':
          PDFViewerApplication.rotatePages(90)
          break
          
        case 'rotateCcw':
          PDFViewerApplication.rotatePages(-90)
          break
          
        case 'setScrollMode':
          if (message.mode !== undefined) {
            const mode = scrollMode(message.mode)
            if (mode >= 0) {
              PDFViewerApplication.pdfViewer.scrollMode = mode
            }
          }
          break
          
        case 'setSpreadMode':
          if (message.mode !== undefined) {
            const mode = spreadMode(message.mode)
            if (mode >= 0) {
              PDFViewerApplication.pdfViewer.spreadMode = mode
            }
          }
          break
          
        case 'showProperties':
          PDFViewerApplication.pdfDocumentProperties.open()
          break
          
        case 'setCursorTool':
          if (message.tool) {
            PDFViewerApplication.pdfCursorTools.switchTool(cursorTools(message.tool))
          }
          break
          
        case 'copySelection':
          const selection = window.getSelection()
          if (selection && selection.toString().trim()) {
            navigator.clipboard.writeText(selection.toString()).then(() => {
              vscode.postMessage({
                type: 'textCopied',
                text: selection.toString()
              })
            }).catch(err => {
              vscode.postMessage({
                type: 'copyError',
                error: err.message
              })
            })
          } else {
            vscode.postMessage({
              type: 'noSelection'
            })
          }
          break
          
        case 'selectAll':
          document.execCommand('selectAll')
          break
          
        case 'setNightMode':
          if (message.enabled) {
            document.body.classList.add('night-mode')
          } else {
            document.body.classList.remove('night-mode')
          }
          break
          
        case 'presentationMode':
          PDFViewerApplication.requestPresentationMode()
          break
          
        case 'showOutline':
          PDFViewerApplication.pdfSidebar.open()
          PDFViewerApplication.pdfSidebar.switchView(2) // 2 = outline view
          break
          
        // ============== 文本提取功能 ==============
        case 'extractText':
          extractPageText(message.page)
          break
          
        case 'extractAllText':
          extractAllText()
          break
          
        case 'extractRangeText':
          extractRangeText(message.pages)
          break
          
        case 'extractSelection':
          extractSelectionText()
          break
          
        case 'cancelExtract':
          cancelExtraction()
          break
          
        // ============== 自动滚动功能 ==============
        case 'startAutoScroll':
          startAutoScroll(message.speed || 1)
          break
          
        case 'stopAutoScroll':
          stopAutoScroll()
          break
          
        case 'toggleAutoScroll':
          toggleAutoScroll()
          break
          
        // ============== 颜色模式功能 ==============
        case 'setColorMode':
          setColorMode(message.mode)
          break
          
        // ============== 页面截图功能 ==============
        case 'captureScreenshot':
          capturePageScreenshot(message.page)
          break
          
        case 'captureAllScreenshots':
          captureAllScreenshots(message.totalPages)
          break
          
        case 'copyPageAsImage':
          copyPageAsImage(message.page)
          break
          
        case 'captureVisibleArea':
          captureVisibleArea()
          break
          
        // ============== 高亮功能 ==============
        case 'highlightSelection':
          highlightSelection(message.color)
          break
          
        case 'getHighlightsSummary':
          getHighlightsSummary()
          break
          
        case 'removeHighlight':
          removeHighlight(message.index)
          break
          
        case 'jumpToHighlightIndex':
          jumpToHighlightIndex(message.index)
          break
          
        case 'restoreHighlights':
          restoreHighlights(message.highlights)
          break
          
        case 'jumpToNextHighlight':
          jumpToNextHighlight()
          break
          
        case 'clearAllHighlights':
          clearAllHighlights()
          break
          
        // ============== 扩展注释功能 ==============
        case 'underlineSelection':
          annotateSelection('underline', message.color)
          break
          
        case 'strikethroughSelection':
          annotateSelection('strikethrough', message.color)
          break
          
        case 'squigglySelection':
          annotateSelection('squiggly', message.color)
          break
          
        case 'setAnnotationType':
          currentAnnotationType = message.annotationType || 'highlight'
          break
          
        case 'addCommentToSelection':
          addCommentToSelection(message.comment, message.color)
          break
          
        case 'getCommentsList':
          getCommentsList()
          break
          
        case 'deleteComment':
          deleteComment(message.index)
          break
          
        case 'editComment':
          editComment(message.index, message.newComment)
          break
          
        case 'jumpToComment':
          jumpToComment(message.index)
          break
          
        // ============== 便签功能 ==============
        case 'addStickyNote':
          addStickyNote(message.x, message.y, message.content, message.color)
          break
          
        case 'getStickyNotes':
          getStickyNotes()
          break
          
        case 'updateStickyNote':
          updateStickyNote(message.index, message.content, message.x, message.y)
          break
          
        case 'deleteStickyNote':
          deleteStickyNote(message.index)
          break
          
        case 'addStickyNoteAtSelection':
          addStickyNoteAtSelection(message.content, message.color)
          break
          
        // ============== 绘图注释功能 ==============
        case 'startDrawingMode':
          startDrawingMode(message.drawingType, message.color, message.strokeWidth)
          break
          
        case 'stopDrawingMode':
          stopDrawingMode()
          break
          
        case 'clearDrawings':
          clearDrawings()
          break
          
        case 'getDrawingAnnotations':
          getDrawingAnnotations()
          break
          
        case 'deleteDrawingAnnotation':
          deleteDrawingAnnotation(message.index)
          break
          
        // ============== 获取所有注释 ==============
        case 'getAllAnnotations':
          getAllAnnotations()
          break
          
        case 'restoreAllAnnotations':
          restoreAllAnnotations(message.data)
          break
          
        case 'exportAnnotationsAsJson':
          exportAnnotationsAsJson()
          break
          
        // ============== 视图模式功能 ==============
        case 'toggleDualPage':
          toggleDualPageView()
          break
          
        case 'toggleContinuousScroll':
          toggleContinuousScroll()
          break
          
        case 'showThumbnails':
          PDFViewerApplication.pdfSidebar.open()
          PDFViewerApplication.pdfSidebar.switchView(1) // 1 = thumbnails view
          break
          
        case 'toggleInvertColors':
          document.body.classList.toggle('invert-colors')
          break
          
        case 'toggleFullscreen':
          toggleFullscreen()
          break
          
        // ============== 注释功能 ==============
        case 'getAnnotations':
          getAnnotations()
          break
          
        case 'copyAnnotations':
          getAnnotations(true)
          break
          
        // ============== 打印功能 ==============
        case 'printPages':
          printPageRange(message.pages)
          break
          
        // ============== 页面提取功能 ==============
        case 'extractPages':
          extractPagesAsPdf(message.pages)
          break
          
        // ============== 缩放到选区 ==============
        case 'zoomToSelection':
          zoomToSelection()
          break
          
        // ============== 元数据功能 ==============
        case 'getMetadata':
          getDocumentMetadata()
          break
          
        // ============== 搜索和文本操作 ==============
        case 'searchText':
          searchTextInDocument(message.query)
          break
          
        case 'getSelectedText':
          getSelectedTextForSearch()
          break
          
        case 'getSelectedTextForTranslate':
          getSelectedTextForTranslate()
          break
          
        case 'getSelectedTextWithPage':
          getSelectedTextWithPageInfo()
          break
          
        // ============== 大纲功能 ==============
        case 'getOutline':
          getDocumentOutline()
          break
      }
    })
  }, { once: true })
  
  // ============== 自动滚动相关变量和函数 ==============
  let autoScrollInterval = null
  let autoScrollSpeed = 1
  
  function startAutoScroll(speed) {
    stopAutoScroll()
    autoScrollSpeed = speed
    const container = document.getElementById('viewerContainer')
    if (container) {
      autoScrollInterval = setInterval(() => {
        container.scrollTop += autoScrollSpeed
      }, 16) // ~60fps
    }
  }
  
  function stopAutoScroll() {
    if (autoScrollInterval) {
      clearInterval(autoScrollInterval)
      autoScrollInterval = null
    }
  }
  
  function toggleAutoScroll() {
    if (autoScrollInterval) {
      stopAutoScroll()
    } else {
      startAutoScroll(autoScrollSpeed || 1)
    }
  }
  
  // ============== 文本提取功能 ==============
  
  // 根据文本项提取格式化文本，保持原始布局
  function formatTextContent(textContent) {
    const items = textContent.items.filter(item => item && item.str !== undefined)
    if (items.length === 0) return ''
    
    // 按 Y 坐标分组（同一行），然后按 X 坐标排序
    const lines = []
    let currentLine = []
    let lastY = null
    
    // 计算平均字体高度作为换行阈值
    let totalHeight = 0
    let heightCount = 0
    for (const item of items) {
      if (item.height && item.height > 0) {
        totalHeight += item.height
        heightCount++
      }
    }
    const avgHeight = heightCount > 0 ? totalHeight / heightCount : 12
    const lineThreshold = avgHeight * 0.7 // 行距阈值
    
    for (const item of items) {
      const y = item.transform ? item.transform[5] : 0
      const x = item.transform ? item.transform[4] : 0
      
      // 检测是否换行（Y 坐标变化超过阈值）
      if (lastY !== null && Math.abs(y - lastY) > lineThreshold) {
        if (currentLine.length > 0) {
          lines.push(currentLine)
          currentLine = []
        }
      }
      
      currentLine.push({ str: item.str, x: x, y: y, width: item.width || 0 })
      lastY = y
    }
    
    // 添加最后一行
    if (currentLine.length > 0) {
      lines.push(currentLine)
    }
    
    // 处理每一行：按 X 坐标排序，并在大间隙处添加空格
    const formattedLines = lines.map(line => {
      // 按 X 坐标排序
      line.sort((a, b) => a.x - b.x)
      
      let lineText = ''
      let lastEndX = null
      
      for (const item of line) {
        // 检测是否需要添加空格（基于 X 坐标间隙）
        if (lastEndX !== null) {
          const gap = item.x - lastEndX
          // 如果间隙超过平均字符宽度，添加空格
          if (gap > avgHeight * 0.3) {
            lineText += ' '
          }
        }
        lineText += item.str
        lastEndX = item.x + (item.width || item.str.length * avgHeight * 0.5)
      }
      
      return lineText
    })
    
    // 检测段落（连续空行或大间距）
    let result = ''
    for (let i = 0; i < formattedLines.length; i++) {
      result += formattedLines[i]
      if (i < formattedLines.length - 1) {
        // 检查下一行的 Y 距离是否超过正常行距（可能是段落）
        const currentY = lines[i][0]?.y || 0
        const nextY = lines[i + 1]?.[0]?.y || 0
        const lineGap = Math.abs(currentY - nextY)
        
        if (lineGap > avgHeight * 2) {
          result += '\n\n' // 段落间隔
        } else {
          result += '\n' // 普通换行
        }
      }
    }
    
    return result
  }
  
  async function extractPageText(pageNum) {
    try {
      const pdf = PDFViewerApplication.pdfDocument
      if (!pdf) {
        vscode.postMessage({
          type: 'extractError',
          error: 'PDF document not loaded'
        })
        return
      }
      
      const page = await pdf.getPage(pageNum)
      const textContent = await page.getTextContent()
      const text = formatTextContent(textContent)
      
      vscode.postMessage({
        type: 'textExtracted',
        text: text.trim(),
        page: pageNum
      })
    } catch (err) {
      console.error('Error extracting text:', err)
      vscode.postMessage({
        type: 'extractError',
        error: err.message || 'Failed to extract text from page'
      })
    }
  }
  
  async function extractAllText() {
    try {
      const pdf = PDFViewerApplication.pdfDocument
      if (!pdf) {
        vscode.postMessage({
          type: 'extractError',
          error: 'PDF document not loaded'
        })
        return
      }
      
      // 发送开始提取的消息
      vscode.postMessage({
        type: 'extractProgress',
        current: 0,
        total: pdf.numPages
      })
      
      let allText = ''
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const textContent = await page.getTextContent()
        const pageText = formatTextContent(textContent)
        allText += `--- Page ${i} ---\n${pageText.trim()}\n\n`
        
        // 发送进度更新
        vscode.postMessage({
          type: 'extractProgress',
          current: i,
          total: pdf.numPages
        })
      }
      
      vscode.postMessage({
        type: 'textExtracted',
        text: allText.trim()
      })
    } catch (err) {
      console.error('Error extracting all text:', err)
      vscode.postMessage({
        type: 'extractError',
        error: err.message || 'Failed to extract text from PDF'
      })
    }
  }
  
  // 提取取消标志
  let extractCancelled = false
  
  function cancelExtraction() {
    extractCancelled = true
  }
  
  // 提取指定页面范围的文本
  async function extractRangeText(pages) {
    try {
      extractCancelled = false
      const pdf = PDFViewerApplication.pdfDocument
      if (!pdf) {
        vscode.postMessage({
          type: 'extractError',
          error: 'PDF document not loaded'
        })
        return
      }
      
      if (!pages || pages.length === 0) {
        vscode.postMessage({
          type: 'extractError',
          error: 'No pages specified'
        })
        return
      }
      
      let allText = ''
      const total = pages.length
      
      for (let i = 0; i < total; i++) {
        if (extractCancelled) {
          vscode.postMessage({
            type: 'extractError',
            error: 'Extraction cancelled'
          })
          return
        }
        
        const pageNum = pages[i]
        const page = await pdf.getPage(pageNum)
        const textContent = await page.getTextContent()
        const pageText = formatTextContent(textContent)
        allText += `--- Page ${pageNum} ---\n${pageText.trim()}\n\n`
        
        vscode.postMessage({
          type: 'extractProgress',
          current: i + 1,
          total: total
        })
      }
      
      vscode.postMessage({
        type: 'textExtracted',
        text: allText.trim()
      })
    } catch (err) {
      console.error('Error extracting range text:', err)
      vscode.postMessage({
        type: 'extractError',
        error: err.message || 'Failed to extract text from pages'
      })
    }
  }
  
  // 提取选中的文本
  function extractSelectionText() {
    const selection = window.getSelection()
    if (selection && selection.toString().trim()) {
      vscode.postMessage({
        type: 'textExtracted',
        text: selection.toString()
      })
    } else {
      vscode.postMessage({
        type: 'extractError',
        error: 'No text selected'
      })
    }
  }
  
  // ============== 颜色模式功能 ==============
  function setColorMode(mode) {
    const body = document.body
    // 移除所有颜色模式类
    body.classList.remove('night-mode', 'grayscale-mode', 'sepia-mode', 'high-contrast-mode', 'invert-colors')
    
    switch (mode) {
      case 'night':
        body.classList.add('night-mode')
        break
      case 'grayscale':
        body.classList.add('grayscale-mode')
        break
      case 'sepia':
        body.classList.add('sepia-mode')
        break
      case 'highContrast':
        body.classList.add('high-contrast-mode')
        break
      // 'normal' 不需要添加任何类
    }
  }
  
  // ============== 页面截图功能 ==============
  async function capturePageScreenshot(pageNum) {
    try {
      const pageView = PDFViewerApplication.pdfViewer.getPageView(pageNum - 1)
      if (pageView && pageView.canvas) {
        const dataUrl = pageView.canvas.toDataURL('image/png')
        // 创建下载链接
        const link = document.createElement('a')
        link.download = `page_${pageNum}.png`
        link.href = dataUrl
        link.click()
      }
    } catch (err) {
      console.error('Error capturing screenshot:', err)
    }
  }
  
  async function captureAllScreenshots(totalPages) {
    for (let i = 1; i <= totalPages; i++) {
      await new Promise(resolve => setTimeout(resolve, 500))
      PDFViewerApplication.pdfViewer.currentPageNumber = i
      await new Promise(resolve => setTimeout(resolve, 300))
      await capturePageScreenshot(i)
    }
  }
  
  async function copyPageAsImage(pageNum) {
    try {
      const pageView = PDFViewerApplication.pdfViewer.getPageView(pageNum - 1)
      if (pageView && pageView.canvas) {
        pageView.canvas.toBlob(async (blob) => {
          try {
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ])
            vscode.postMessage({ type: 'textCopied' })
          } catch (err) {
            console.error('Error copying image:', err)
          }
        }, 'image/png')
      }
    } catch (err) {
      console.error('Error copying page as image:', err)
    }
  }
  
  function captureVisibleArea() {
    const container = document.getElementById('viewerContainer')
    if (container) {
      // 使用 html2canvas 或类似方法截取可见区域
      // 这里简单实现，截取当前页面
      const currentPage = PDFViewerApplication.pdfViewer.currentPageNumber
      capturePageScreenshot(currentPage)
    }
  }
  
  // ============== 注释功能 ==============
  let annotations = []  // 所有注释（高亮、下划线、删除线、波浪线、评论）
  let highlights = []   // 保留兼容性
  let currentHighlightIndex = -1
  let currentHighlightColor = '#FFFF00'
  let currentAnnotationType = 'highlight'  // highlight, underline, strikethrough, squiggly
  let comments = []  // 评论列表
  let stickyNotes = []  // 便签列表
  let drawingAnnotations = []  // 绘图注释
  let isDrawingMode = false
  let drawingType = 'rectangle'  // rectangle, circle, arrow, freehand
  let drawingColor = '#FF0000'
  let drawingStrokeWidth = 2
  let currentDrawingPath = []
  
  function highlightSelection(color) {
    const highlightColor = color || currentHighlightColor
    const selection = window.getSelection()
    if (selection && selection.toString().trim()) {
      const range = selection.getRangeAt(0)
      const span = document.createElement('span')
      span.className = 'pdf-highlight'
      span.style.backgroundColor = highlightColor
      span.style.opacity = '0.5'
      span.dataset.color = highlightColor
      
      const text = selection.toString().trim()
      const currentPage = PDFViewerApplication.pdfViewer.currentPageNumber
      
      // 获取上下文文本用于定位
      const textBefore = getTextBefore(range, 20)
      const textAfter = getTextAfter(range, 20)
      
      try {
        range.surroundContents(span)
        const highlightData = {
          element: span,
          color: highlightColor,
          text: text,
          page: currentPage,
          textBefore: textBefore,
          textAfter: textAfter
        }
        highlights.push(highlightData)
        selection.removeAllRanges()
        
        // 通知扩展高亮成功，包含持久化数据
        vscode.postMessage({
          type: 'highlightAdded',
          color: highlightColor,
          count: highlights.length,
          highlightData: {
            text: text,
            color: highlightColor,
            page: currentPage,
            timestamp: Date.now(),
            textBefore: textBefore,
            textAfter: textAfter
          }
        })
      } catch (err) {
        console.error('Error highlighting:', err)
        // 如果 surroundContents 失败，尝试使用替代方法
        try {
          const contents = range.extractContents()
          span.appendChild(contents)
          range.insertNode(span)
          const highlightData = {
            element: span,
            color: highlightColor,
            text: span.textContent,
            page: currentPage,
            textBefore: textBefore,
            textAfter: textAfter
          }
          highlights.push(highlightData)
          selection.removeAllRanges()
          
          vscode.postMessage({
            type: 'highlightAdded',
            color: highlightColor,
            count: highlights.length,
            highlightData: {
              text: span.textContent,
              color: highlightColor,
              page: currentPage,
              timestamp: Date.now(),
              textBefore: textBefore,
              textAfter: textAfter
            }
          })
        } catch (err2) {
          console.error('Error with alternative highlighting:', err2)
          vscode.postMessage({
            type: 'highlightError',
            error: 'Cannot highlight across multiple elements'
          })
        }
      }
    } else {
      vscode.postMessage({
        type: 'noSelection'
      })
    }
  }
  
  // 获取选区前的文本
  function getTextBefore(range, length) {
    try {
      const preRange = range.cloneRange()
      preRange.setStart(range.startContainer.parentNode, 0)
      preRange.setEnd(range.startContainer, range.startOffset)
      const text = preRange.toString()
      return text.slice(-length)
    } catch (e) {
      return ''
    }
  }
  
  // 获取选区后的文本
  function getTextAfter(range, length) {
    try {
      const postRange = range.cloneRange()
      postRange.setStart(range.endContainer, range.endOffset)
      const container = range.endContainer.parentNode
      if (container.textContent) {
        postRange.setEnd(container, container.childNodes.length)
      }
      const text = postRange.toString()
      return text.slice(0, length)
    } catch (e) {
      return ''
    }
  }
  
  function jumpToNextHighlight() {
    if (highlights.length === 0) {
      vscode.postMessage({ type: 'noHighlights' })
      return
    }
    
    currentHighlightIndex = (currentHighlightIndex + 1) % highlights.length
    const highlightData = highlights[currentHighlightIndex]
    if (highlightData && highlightData.element) {
      const element = highlightData.element
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // 闪烁效果
      const originalColor = highlightData.color
      element.style.backgroundColor = '#FF4500' // 橙红色闪烁
      setTimeout(() => {
        element.style.backgroundColor = originalColor
      }, 500)
      
      vscode.postMessage({
        type: 'highlightJumped',
        index: currentHighlightIndex + 1,
        total: highlights.length,
        color: originalColor
      })
    }
  }
  
  function clearAllHighlights() {
    let removed = 0
    highlights.forEach(highlightData => {
      const span = highlightData.element
      if (span && span.parentNode) {
        const parent = span.parentNode
        while (span.firstChild) {
          parent.insertBefore(span.firstChild, span)
        }
        parent.removeChild(span)
        removed++
      }
    })
    highlights = []
    currentHighlightIndex = -1
    
    vscode.postMessage({
      type: 'highlightsCleared',
      count: removed
    })
  }
  
  function getHighlightsSummary() {
    const summary = highlights.map((h, i) => ({
      index: i + 1,
      color: h.color,
      text: h.text.substring(0, 50) + (h.text.length > 50 ? '...' : '')
    }))
    vscode.postMessage({
      type: 'highlightsSummary',
      highlights: summary,
      total: highlights.length
    })
  }
  
  function removeHighlight(index) {
    if (index < 0 || index >= highlights.length) {
      vscode.postMessage({ type: 'highlightError', error: 'Invalid index' })
      return
    }
    
    const highlightData = highlights[index]
    if (highlightData && highlightData.element) {
      const span = highlightData.element
      if (span.parentNode) {
        const parent = span.parentNode
        while (span.firstChild) {
          parent.insertBefore(span.firstChild, span)
        }
        parent.removeChild(span)
      }
    }
    
    highlights.splice(index, 1)
    
    // 重置当前索引
    if (currentHighlightIndex >= highlights.length) {
      currentHighlightIndex = highlights.length - 1
    }
    
    // 通知扩展同步存储
    vscode.postMessage({
      type: 'highlightRemovedWithData',
      index: index
    })
    
    vscode.postMessage({
      type: 'highlightRemoved',
      remaining: highlights.length
    })
  }
  
  // 恢复保存的高亮
  function restoreHighlights(savedHighlights) {
    if (!savedHighlights || savedHighlights.length === 0) return
    
    // 等待 PDF 完全加载
    setTimeout(() => {
      savedHighlights.forEach((highlightData, index) => {
        try {
          restoreSingleHighlight(highlightData)
        } catch (err) {
          console.error('Error restoring highlight:', index, err)
        }
      })
      
      if (highlights.length > 0) {
        vscode.postMessage({
          type: 'highlightsRestored',
          count: highlights.length
        })
      }
    }, 1000)
  }
  
  function restoreSingleHighlight(highlightData) {
    const { text, color, page, textBefore, textAfter } = highlightData
    
    // 跳转到对应页面
    if (page && PDFViewerApplication.pdfViewer.currentPageNumber !== page) {
      PDFViewerApplication.pdfViewer.currentPageNumber = page
    }
    
    // 尝试在页面中查找文本并高亮
    setTimeout(() => {
      const textLayer = document.querySelector(`.page[data-page-number="${page}"] .textLayer`)
      if (!textLayer) return
      
      // 搜索文本节点
      const walker = document.createTreeWalker(
        textLayer,
        NodeFilter.SHOW_TEXT,
        null,
        false
      )
      
      let node
      while ((node = walker.nextNode())) {
        const nodeText = node.textContent
        const index = nodeText.indexOf(text)
        
        if (index !== -1) {
          // 找到匹配的文本，创建高亮
          const range = document.createRange()
          range.setStart(node, index)
          range.setEnd(node, index + text.length)
          
          const span = document.createElement('span')
          span.className = 'pdf-highlight restored-highlight'
          span.style.backgroundColor = color
          span.style.opacity = '0.5'
          span.dataset.color = color
          
          try {
            range.surroundContents(span)
            highlights.push({
              element: span,
              color: color,
              text: text,
              page: page,
              textBefore: textBefore,
              textAfter: textAfter
            })
            return // 找到后退出
          } catch (e) {
            console.error('Error creating restored highlight:', e)
          }
        }
      }
    }, 500)
  }
  
  function jumpToHighlightIndex(index) {
    if (index < 0 || index >= highlights.length) {
      vscode.postMessage({ type: 'noHighlights' })
      return
    }
    
    currentHighlightIndex = index
    const highlightData = highlights[index]
    if (highlightData && highlightData.element) {
      const element = highlightData.element
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // 闪烁效果
      const originalColor = highlightData.color
      element.style.backgroundColor = '#FF4500'
      setTimeout(() => {
        element.style.backgroundColor = originalColor
      }, 500)
      
      vscode.postMessage({
        type: 'highlightJumped',
        index: index + 1,
        total: highlights.length,
        color: originalColor
      })
    }
  }
  
  // ============== 视图模式功能 ==============
  function toggleDualPageView() {
    const currentSpread = PDFViewerApplication.pdfViewer.spreadMode
    // 在无分页和奇数分页之间切换
    PDFViewerApplication.pdfViewer.spreadMode = currentSpread === 0 ? 1 : 0
  }
  
  function toggleContinuousScroll() {
    const currentScroll = PDFViewerApplication.pdfViewer.scrollMode
    // 在垂直滚动和页面滚动之间切换
    PDFViewerApplication.pdfViewer.scrollMode = currentScroll === 0 ? 3 : 0
  }
  
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
  }
  
  // ============== 打印页面范围功能 ==============
  function printPageRange(pages) {
    if (!pages || pages.length === 0) {
      vscode.postMessage({
        type: 'extractError',
        error: 'No pages specified for printing'
      })
      return
    }
    
    // PDF.js 内置打印功能
    // 注意：浏览器打印对话框会打印整个文档，这里只能提示用户
    vscode.postMessage({
      type: 'printInfo',
      message: `Printing pages: ${pages.join(', ')}. Please use the print dialog to select specific pages.`
    })
    
    // 触发打印
    PDFViewerApplication.triggerPrinting()
  }
  
  // ============== 页面提取为 PDF 功能 ==============
  async function extractPagesAsPdf(pages) {
    try {
      const pdf = PDFViewerApplication.pdfDocument
      if (!pdf) {
        vscode.postMessage({
          type: 'extractError',
          error: 'PDF document not loaded'
        })
        return
      }
      
      if (!pages || pages.length === 0) {
        vscode.postMessage({
          type: 'extractError',
          error: 'No pages specified for extraction'
        })
        return
      }
      
      // 发送进度开始
      vscode.postMessage({
        type: 'extractProgress',
        current: 0,
        total: pages.length
      })
      
      // 收集所有页面的图像数据
      const pageImages = []
      for (let i = 0; i < pages.length; i++) {
        const pageNum = pages[i]
        const pageView = PDFViewerApplication.pdfViewer.getPageView(pageNum - 1)
        
        if (pageView && pageView.canvas) {
          const dataUrl = pageView.canvas.toDataURL('image/png')
          pageImages.push({
            page: pageNum,
            dataUrl: dataUrl
          })
        }
        
        vscode.postMessage({
          type: 'extractProgress',
          current: i + 1,
          total: pages.length
        })
      }
      
      // 发送提取的数据到扩展端处理
      vscode.postMessage({
        type: 'pagesExtracted',
        pages: pageImages
      })
    } catch (err) {
      console.error('Error extracting pages:', err)
      vscode.postMessage({
        type: 'extractError',
        error: err.message || 'Failed to extract pages'
      })
    }
  }
  
  // ============== 缩放到选区功能 ==============
  function zoomToSelection() {
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      
      if (rect.width > 0 && rect.height > 0) {
        // 计算需要的缩放比例以适应选区
        const container = document.getElementById('viewerContainer')
        if (container) {
          const containerRect = container.getBoundingClientRect()
          const scaleX = containerRect.width / rect.width
          const scaleY = containerRect.height / rect.height
          const newScale = Math.min(scaleX, scaleY) * 0.8 // 留一些边距
          
          // 限制缩放范围
          const limitedScale = Math.max(0.5, Math.min(5, newScale))
          PDFViewerApplication.pdfViewer.currentScale = limitedScale
          
          // 滚动到选区位置
          const element = range.startContainer.parentElement
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
        }
      }
    } else {
      vscode.postMessage({
        type: 'extractError',
        error: 'No selection to zoom to'
      })
    }
  }
  
  // ============== 获取文档元数据功能 ==============
  async function getDocumentMetadata() {
    try {
      const pdf = PDFViewerApplication.pdfDocument
      if (!pdf) {
        vscode.postMessage({
          type: 'extractError',
          error: 'PDF document not loaded'
        })
        return
      }
      
      const metadata = await pdf.getMetadata()
      const info = metadata.info || {}
      const metadataObj = metadata.metadata ? metadata.metadata.getAll() : {}
      
      const documentInfo = {
        title: info.Title || metadataObj['dc:title'] || '',
        author: info.Author || metadataObj['dc:creator'] || '',
        subject: info.Subject || metadataObj['dc:description'] || '',
        keywords: info.Keywords || '',
        creator: info.Creator || '',
        producer: info.Producer || '',
        creationDate: info.CreationDate || '',
        modificationDate: info.ModDate || '',
        pageCount: pdf.numPages,
        pdfVersion: info.PDFFormatVersion || '',
        isLinearized: info.IsLinearized || false,
        isAcroFormPresent: info.IsAcroFormPresent || false,
        isXFAPresent: info.IsXFAPresent || false
      }
      
      vscode.postMessage({
        type: 'metadataResult',
        metadata: documentInfo
      })
    } catch (err) {
      console.error('Error getting metadata:', err)
      vscode.postMessage({
        type: 'extractError',
        error: err.message || 'Failed to get document metadata'
      })
    }
  }
  
  // ============== 注释功能 ==============
  async function getAnnotations(copyToClipboard = false) {
    try {
      const pdf = PDFViewerApplication.pdfDocument
      if (!pdf) return
      
      const allAnnotations = []
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const annotations = await page.getAnnotations()
        
        annotations.forEach(annot => {
          if (annot.contents || annot.title) {
            allAnnotations.push({
              page: i,
              type: annot.subtype,
              title: annot.title || '',
              contents: annot.contents || '',
              rect: annot.rect
            })
          }
        })
      }
      
      if (copyToClipboard) {
        vscode.postMessage({
          type: 'annotationsCopied',
          annotations: allAnnotations
        })
      } else {
        vscode.postMessage({
          type: 'annotationsData',
          annotations: allAnnotations
        })
      }
      
      if (allAnnotations.length === 0) {
        vscode.postMessage({ type: 'noAnnotations' })
      }
    } catch (err) {
      console.error('Error getting annotations:', err)
    }
  }

  // ============== 搜索和文本操作功能 ==============
  function searchTextInDocument(query) {
    if (!query) return
    
    // 使用 PDF.js 内置的查找功能
    PDFViewerApplication.findBar.open()
    const findInput = document.getElementById('findInput')
    if (findInput) {
      findInput.value = query
      // 触发查找
      PDFViewerApplication.eventBus.dispatch('find', {
        source: window,
        type: 'again',
        query: query,
        phraseSearch: true,
        caseSensitive: false,
        entireWord: false,
        highlightAll: true,
        findPrevious: false
      })
    }
  }
  
  function getSelectedTextForSearch() {
    const selection = window.getSelection()
    if (selection && selection.toString().trim()) {
      const text = selection.toString().trim()
      vscode.postMessage({
        type: 'selectedTextForSearch',
        text: text
      })
    } else {
      vscode.postMessage({
        type: 'noSelection'
      })
    }
  }
  
  function getSelectedTextForTranslate() {
    const selection = window.getSelection()
    if (selection && selection.toString().trim()) {
      const text = selection.toString().trim()
      vscode.postMessage({
        type: 'selectedTextForTranslate',
        text: text
      })
    } else {
      vscode.postMessage({
        type: 'noSelection'
      })
    }
  }
  
  function getSelectedTextWithPageInfo() {
    const selection = window.getSelection()
    if (selection && selection.toString().trim()) {
      const text = selection.toString().trim()
      const currentPage = PDFViewerApplication.pdfViewer.currentPageNumber
      vscode.postMessage({
        type: 'selectedTextWithPage',
        text: text,
        page: currentPage
      })
    } else {
      vscode.postMessage({
        type: 'noSelection'
      })
    }
  }
  
  // ============== 大纲功能 ==============
  async function getDocumentOutline() {
    try {
      const pdf = PDFViewerApplication.pdfDocument
      if (!pdf) {
        vscode.postMessage({
          type: 'outlineResult',
          outline: []
        })
        return
      }
      
      const outline = await pdf.getOutline()
      if (!outline || outline.length === 0) {
        vscode.postMessage({
          type: 'outlineResult',
          outline: []
        })
        return
      }
      
      // 处理大纲数据
      const processOutline = (items, level = 0) => {
        return items.map(item => ({
          title: item.title,
          dest: item.dest,
          level: level,
          children: item.items ? processOutline(item.items, level + 1) : []
        }))
      }
      
      vscode.postMessage({
        type: 'outlineResult',
        outline: processOutline(outline)
      })
    } catch (err) {
      console.error('Error getting outline:', err)
      vscode.postMessage({
        type: 'outlineResult',
        outline: []
      })
    }
  }

  // ============== 扩展注释类型功能 ==============
  
  // 通用注释函数（下划线、删除线、波浪线）
  function annotateSelection(type, color) {
    const annotationColor = color || currentHighlightColor
    const selection = window.getSelection()
    if (!selection || !selection.toString().trim()) {
      vscode.postMessage({ type: 'noSelection' })
      return
    }
    
    const range = selection.getRangeAt(0)
    const span = document.createElement('span')
    span.className = `pdf-annotation pdf-${type}`
    span.dataset.annotationType = type
    span.dataset.color = annotationColor
    
    // 根据类型设置样式
    switch (type) {
      case 'underline':
        span.style.textDecoration = 'underline'
        span.style.textDecorationColor = annotationColor
        span.style.textDecorationThickness = '2px'
        break
      case 'strikethrough':
        span.style.textDecoration = 'line-through'
        span.style.textDecorationColor = annotationColor
        span.style.textDecorationThickness = '2px'
        break
      case 'squiggly':
        span.style.textDecoration = 'underline wavy'
        span.style.textDecorationColor = annotationColor
        break
    }
    
    const text = selection.toString().trim()
    const currentPage = PDFViewerApplication.pdfViewer.currentPageNumber
    const textBefore = getTextBefore(range, 20)
    const textAfter = getTextAfter(range, 20)
    
    try {
      range.surroundContents(span)
      const annotationData = {
        element: span,
        type: type,
        color: annotationColor,
        text: text,
        page: currentPage,
        textBefore: textBefore,
        textAfter: textAfter,
        timestamp: Date.now()
      }
      annotations.push(annotationData)
      selection.removeAllRanges()
      
      vscode.postMessage({
        type: 'annotationAdded',
        annotationType: type,
        color: annotationColor,
        count: annotations.length,
        annotationData: {
          type: type,
          text: text,
          color: annotationColor,
          page: currentPage,
          timestamp: Date.now(),
          textBefore: textBefore,
          textAfter: textAfter
        }
      })
    } catch (err) {
      console.error('Error annotating:', err)
      try {
        const contents = range.extractContents()
        span.appendChild(contents)
        range.insertNode(span)
        const annotationData = {
          element: span,
          type: type,
          color: annotationColor,
          text: span.textContent,
          page: currentPage,
          textBefore: textBefore,
          textAfter: textAfter,
          timestamp: Date.now()
        }
        annotations.push(annotationData)
        selection.removeAllRanges()
        
        vscode.postMessage({
          type: 'annotationAdded',
          annotationType: type,
          color: annotationColor,
          count: annotations.length,
          annotationData: {
            type: type,
            text: span.textContent,
            color: annotationColor,
            page: currentPage,
            timestamp: Date.now(),
            textBefore: textBefore,
            textAfter: textAfter
          }
        })
      } catch (err2) {
        console.error('Error with alternative annotation:', err2)
        vscode.postMessage({
          type: 'annotationError',
          error: 'Cannot annotate across multiple elements'
        })
      }
    }
  }
  
  // ============== 评论功能 ==============
  
  function addCommentToSelection(commentText, color) {
    const commentColor = color || '#FFE4B5'
    const selection = window.getSelection()
    if (!selection || !selection.toString().trim()) {
      vscode.postMessage({ type: 'noSelection' })
      return
    }
    
    const range = selection.getRangeAt(0)
    const selectedText = selection.toString().trim()
    const currentPage = PDFViewerApplication.pdfViewer.currentPageNumber
    const textBefore = getTextBefore(range, 20)
    const textAfter = getTextAfter(range, 20)
    
    // 创建评论标记
    const span = document.createElement('span')
    span.className = 'pdf-comment-highlight'
    span.style.backgroundColor = commentColor
    span.style.opacity = '0.4'
    span.style.borderBottom = '2px dashed ' + commentColor
    span.dataset.commentIndex = comments.length
    span.dataset.color = commentColor
    span.title = commentText  // 鼠标悬停显示评论
    
    // 添加评论图标
    const commentIcon = document.createElement('span')
    commentIcon.className = 'pdf-comment-icon'
    commentIcon.innerHTML = '💬'
    commentIcon.style.cursor = 'pointer'
    commentIcon.style.fontSize = '12px'
    commentIcon.style.marginLeft = '2px'
    commentIcon.onclick = function(e) {
      e.stopPropagation()
      showCommentPopup(comments.length - 1)
    }
    
    try {
      range.surroundContents(span)
      span.appendChild(commentIcon)
      
      const commentData = {
        element: span,
        icon: commentIcon,
        text: selectedText,
        comment: commentText,
        color: commentColor,
        page: currentPage,
        textBefore: textBefore,
        textAfter: textAfter,
        timestamp: Date.now(),
        author: 'User'
      }
      comments.push(commentData)
      selection.removeAllRanges()
      
      vscode.postMessage({
        type: 'commentAdded',
        color: commentColor,
        count: comments.length,
        commentData: {
          text: selectedText,
          comment: commentText,
          color: commentColor,
          page: currentPage,
          timestamp: Date.now(),
          textBefore: textBefore,
          textAfter: textAfter,
          author: 'User'
        }
      })
    } catch (err) {
      console.error('Error adding comment:', err)
      vscode.postMessage({
        type: 'commentError',
        error: 'Cannot add comment across multiple elements'
      })
    }
  }
  
  function showCommentPopup(index) {
    if (index < 0 || index >= comments.length) return
    const comment = comments[index]
    
    vscode.postMessage({
      type: 'showComment',
      index: index,
      comment: comment.comment,
      text: comment.text,
      page: comment.page,
      author: comment.author,
      timestamp: comment.timestamp
    })
  }
  
  function getCommentsList() {
    const summary = comments.map((c, i) => ({
      index: i,
      text: c.text.substring(0, 30) + (c.text.length > 30 ? '...' : ''),
      comment: c.comment.substring(0, 50) + (c.comment.length > 50 ? '...' : ''),
      page: c.page,
      color: c.color,
      author: c.author,
      timestamp: c.timestamp
    }))
    vscode.postMessage({
      type: 'commentsList',
      comments: summary,
      total: comments.length
    })
  }
  
  function deleteComment(index) {
    if (index < 0 || index >= comments.length) {
      vscode.postMessage({ type: 'commentError', error: 'Invalid index' })
      return
    }
    
    const commentData = comments[index]
    if (commentData && commentData.element) {
      const span = commentData.element
      if (span.parentNode) {
        // 移除评论图标
        if (commentData.icon && commentData.icon.parentNode) {
          commentData.icon.parentNode.removeChild(commentData.icon)
        }
        // 保留文本内容
        const parent = span.parentNode
        while (span.firstChild) {
          if (span.firstChild !== commentData.icon) {
            parent.insertBefore(span.firstChild, span)
          } else {
            span.removeChild(span.firstChild)
          }
        }
        parent.removeChild(span)
      }
    }
    
    comments.splice(index, 1)
    // 更新剩余评论的索引
    comments.forEach((c, i) => {
      if (c.element) {
        c.element.dataset.commentIndex = i
      }
    })
    
    vscode.postMessage({
      type: 'commentDeleted',
      remaining: comments.length
    })
  }
  
  function editComment(index, newComment) {
    if (index < 0 || index >= comments.length) {
      vscode.postMessage({ type: 'commentError', error: 'Invalid index' })
      return
    }
    
    comments[index].comment = newComment
    if (comments[index].element) {
      comments[index].element.title = newComment
    }
    
    vscode.postMessage({
      type: 'commentEdited',
      index: index
    })
  }
  
  function jumpToComment(index) {
    if (index < 0 || index >= comments.length) {
      vscode.postMessage({ type: 'noComments' })
      return
    }
    
    const commentData = comments[index]
    if (commentData && commentData.element) {
      // 如果需要切换页面
      if (commentData.page !== PDFViewerApplication.pdfViewer.currentPageNumber) {
        PDFViewerApplication.pdfViewer.currentPageNumber = commentData.page
      }
      
      setTimeout(() => {
        commentData.element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        // 闪烁效果
        const originalBg = commentData.element.style.backgroundColor
        commentData.element.style.backgroundColor = '#FF4500'
        setTimeout(() => {
          commentData.element.style.backgroundColor = originalBg
        }, 500)
      }, 300)
      
      vscode.postMessage({
        type: 'commentJumped',
        index: index,
        total: comments.length
      })
    }
  }
  
  // ============== 便签功能 ==============
  
  function addStickyNote(x, y, content, color) {
    const noteColor = color || '#FFFACD'
    const currentPage = PDFViewerApplication.pdfViewer.currentPageNumber
    const pageContainer = document.querySelector(`.page[data-page-number="${currentPage}"]`)
    
    if (!pageContainer) {
      vscode.postMessage({ type: 'stickyNoteError', error: 'Page not found' })
      return
    }
    
    // 创建便签元素
    const note = document.createElement('div')
    note.className = 'pdf-sticky-note'
    note.style.cssText = `
      position: absolute;
      left: ${x}px;
      top: ${y}px;
      width: 200px;
      min-height: 100px;
      background-color: ${noteColor};
      border: 1px solid #ccc;
      border-radius: 4px;
      box-shadow: 2px 2px 8px rgba(0,0,0,0.2);
      padding: 8px;
      z-index: 1000;
      cursor: move;
      font-size: 12px;
      resize: both;
      overflow: auto;
    `
    
    // 便签头部
    const header = document.createElement('div')
    header.className = 'sticky-note-header'
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 5px;
      padding-bottom: 5px;
      border-bottom: 1px solid #ddd;
      cursor: move;
    `
    
    const title = document.createElement('span')
    title.textContent = '📝 Note'
    title.style.fontWeight = 'bold'
    title.style.fontSize = '11px'
    
    const closeBtn = document.createElement('button')
    closeBtn.innerHTML = '×'
    closeBtn.style.cssText = `
      background: none;
      border: none;
      cursor: pointer;
      font-size: 16px;
      color: #666;
      padding: 0 4px;
    `
    closeBtn.onclick = function() {
      const idx = stickyNotes.findIndex(n => n.element === note)
      if (idx !== -1) {
        deleteStickyNote(idx)
      }
    }
    
    header.appendChild(title)
    header.appendChild(closeBtn)
    
    // 便签内容
    const contentDiv = document.createElement('div')
    contentDiv.className = 'sticky-note-content'
    contentDiv.contentEditable = true
    contentDiv.textContent = content || ''
    contentDiv.style.cssText = `
      min-height: 60px;
      outline: none;
      word-wrap: break-word;
    `
    contentDiv.onblur = function() {
      const idx = stickyNotes.findIndex(n => n.element === note)
      if (idx !== -1) {
        stickyNotes[idx].content = contentDiv.textContent
        vscode.postMessage({
          type: 'stickyNoteUpdated',
          index: idx,
          content: contentDiv.textContent
        })
      }
    }
    
    note.appendChild(header)
    note.appendChild(contentDiv)
    pageContainer.appendChild(note)
    
    // 添加拖拽功能
    makeDraggable(note, header)
    
    const noteData = {
      element: note,
      contentDiv: contentDiv,
      content: content || '',
      color: noteColor,
      page: currentPage,
      x: x,
      y: y,
      timestamp: Date.now()
    }
    stickyNotes.push(noteData)
    
    vscode.postMessage({
      type: 'stickyNoteAdded',
      count: stickyNotes.length,
      noteData: {
        content: content || '',
        color: noteColor,
        page: currentPage,
        x: x,
        y: y,
        timestamp: Date.now()
      }
    })
  }
  
  function makeDraggable(element, handle) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0
    
    handle.onmousedown = dragMouseDown
    
    function dragMouseDown(e) {
      e.preventDefault()
      pos3 = e.clientX
      pos4 = e.clientY
      document.onmouseup = closeDragElement
      document.onmousemove = elementDrag
    }
    
    function elementDrag(e) {
      e.preventDefault()
      pos1 = pos3 - e.clientX
      pos2 = pos4 - e.clientY
      pos3 = e.clientX
      pos4 = e.clientY
      element.style.top = (element.offsetTop - pos2) + "px"
      element.style.left = (element.offsetLeft - pos1) + "px"
    }
    
    function closeDragElement() {
      document.onmouseup = null
      document.onmousemove = null
      // 更新位置
      const idx = stickyNotes.findIndex(n => n.element === element)
      if (idx !== -1) {
        stickyNotes[idx].x = parseInt(element.style.left)
        stickyNotes[idx].y = parseInt(element.style.top)
        vscode.postMessage({
          type: 'stickyNotePositionChanged',
          index: idx,
          x: stickyNotes[idx].x,
          y: stickyNotes[idx].y
        })
      }
    }
  }
  
  function addStickyNoteAtSelection(content, color) {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) {
      // 如果没有选择，在页面中心添加
      const currentPage = PDFViewerApplication.pdfViewer.currentPageNumber
      const pageContainer = document.querySelector(`.page[data-page-number="${currentPage}"]`)
      if (pageContainer) {
        const rect = pageContainer.getBoundingClientRect()
        addStickyNote(rect.width / 2 - 100, rect.height / 2 - 50, content, color)
      }
      return
    }
    
    const range = selection.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    const currentPage = PDFViewerApplication.pdfViewer.currentPageNumber
    const pageContainer = document.querySelector(`.page[data-page-number="${currentPage}"]`)
    
    if (pageContainer) {
      const pageRect = pageContainer.getBoundingClientRect()
      const x = rect.left - pageRect.left + rect.width + 10
      const y = rect.top - pageRect.top
      addStickyNote(x, y, content || selection.toString(), color)
    }
  }
  
  function getStickyNotes() {
    const summary = stickyNotes.map((n, i) => ({
      index: i,
      content: n.content.substring(0, 50) + (n.content.length > 50 ? '...' : ''),
      page: n.page,
      color: n.color,
      x: n.x,
      y: n.y,
      timestamp: n.timestamp
    }))
    vscode.postMessage({
      type: 'stickyNotesList',
      notes: summary,
      total: stickyNotes.length
    })
  }
  
  function updateStickyNote(index, content, x, y) {
    if (index < 0 || index >= stickyNotes.length) return
    
    const note = stickyNotes[index]
    if (content !== undefined) {
      note.content = content
      if (note.contentDiv) {
        note.contentDiv.textContent = content
      }
    }
    if (x !== undefined) {
      note.x = x
      if (note.element) {
        note.element.style.left = x + 'px'
      }
    }
    if (y !== undefined) {
      note.y = y
      if (note.element) {
        note.element.style.top = y + 'px'
      }
    }
    
    vscode.postMessage({
      type: 'stickyNoteUpdated',
      index: index
    })
  }
  
  function deleteStickyNote(index) {
    if (index < 0 || index >= stickyNotes.length) return
    
    const note = stickyNotes[index]
    if (note.element && note.element.parentNode) {
      note.element.parentNode.removeChild(note.element)
    }
    
    stickyNotes.splice(index, 1)
    
    vscode.postMessage({
      type: 'stickyNoteDeleted',
      remaining: stickyNotes.length
    })
  }
  
  // ============== 绘图注释功能 ==============
  
  let drawingCanvas = null
  let drawingContext = null
  
  function startDrawingMode(type, color, strokeWidth) {
    isDrawingMode = true
    drawingType = type || 'rectangle'
    drawingColor = color || '#FF0000'
    drawingStrokeWidth = strokeWidth || 2
    
    const currentPage = PDFViewerApplication.pdfViewer.currentPageNumber
    const pageContainer = document.querySelector(`.page[data-page-number="${currentPage}"]`)
    
    if (!pageContainer) return
    
    // 创建绘图画布
    if (!drawingCanvas) {
      drawingCanvas = document.createElement('canvas')
      drawingCanvas.className = 'pdf-drawing-canvas'
      drawingCanvas.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 999;
        cursor: crosshair;
        pointer-events: auto;
      `
      pageContainer.appendChild(drawingCanvas)
      
      // 设置画布大小
      const pageCanvas = pageContainer.querySelector('canvas')
      if (pageCanvas) {
        drawingCanvas.width = pageCanvas.width
        drawingCanvas.height = pageCanvas.height
      }
      
      drawingContext = drawingCanvas.getContext('2d')
      
      // 添加绘图事件
      setupDrawingEvents()
    }
    
    // 重绘现有注释
    redrawAllDrawings()
    
    vscode.postMessage({
      type: 'drawingModeStarted',
      drawingType: drawingType
    })
  }
  
  function setupDrawingEvents() {
    let isDrawing = false
    let startX, startY
    let tempShape = null
    
    drawingCanvas.onmousedown = function(e) {
      if (!isDrawingMode) return
      isDrawing = true
      const rect = drawingCanvas.getBoundingClientRect()
      const scaleX = drawingCanvas.width / rect.width
      const scaleY = drawingCanvas.height / rect.height
      startX = (e.clientX - rect.left) * scaleX
      startY = (e.clientY - rect.top) * scaleY
      
      if (drawingType === 'freehand') {
        currentDrawingPath = [{ x: startX, y: startY }]
      }
    }
    
    drawingCanvas.onmousemove = function(e) {
      if (!isDrawing || !isDrawingMode) return
      
      const rect = drawingCanvas.getBoundingClientRect()
      const scaleX = drawingCanvas.width / rect.width
      const scaleY = drawingCanvas.height / rect.height
      const currentX = (e.clientX - rect.left) * scaleX
      const currentY = (e.clientY - rect.top) * scaleY
      
      // 清除并重绘
      drawingContext.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height)
      redrawAllDrawings()
      
      drawingContext.strokeStyle = drawingColor
      drawingContext.lineWidth = drawingStrokeWidth
      drawingContext.fillStyle = drawingColor + '20'
      
      switch (drawingType) {
        case 'rectangle':
          drawingContext.beginPath()
          drawingContext.rect(startX, startY, currentX - startX, currentY - startY)
          drawingContext.fill()
          drawingContext.stroke()
          tempShape = { type: 'rectangle', x: startX, y: startY, width: currentX - startX, height: currentY - startY }
          break
        case 'circle':
          const radius = Math.sqrt(Math.pow(currentX - startX, 2) + Math.pow(currentY - startY, 2))
          drawingContext.beginPath()
          drawingContext.arc(startX, startY, radius, 0, 2 * Math.PI)
          drawingContext.fill()
          drawingContext.stroke()
          tempShape = { type: 'circle', x: startX, y: startY, radius: radius }
          break
        case 'arrow':
          drawArrow(drawingContext, startX, startY, currentX, currentY)
          tempShape = { type: 'arrow', x1: startX, y1: startY, x2: currentX, y2: currentY }
          break
        case 'freehand':
          currentDrawingPath.push({ x: currentX, y: currentY })
          drawFreehand(drawingContext, currentDrawingPath)
          tempShape = { type: 'freehand', path: [...currentDrawingPath] }
          break
      }
    }
    
    drawingCanvas.onmouseup = function(e) {
      if (!isDrawing || !isDrawingMode) return
      isDrawing = false
      
      if (tempShape) {
        const currentPage = PDFViewerApplication.pdfViewer.currentPageNumber
        const drawingData = {
          ...tempShape,
          color: drawingColor,
          strokeWidth: drawingStrokeWidth,
          page: currentPage,
          timestamp: Date.now()
        }
        drawingAnnotations.push(drawingData)
        
        vscode.postMessage({
          type: 'drawingAdded',
          count: drawingAnnotations.length,
          drawingData: drawingData
        })
        
        tempShape = null
      }
    }
    
    drawingCanvas.onmouseleave = function() {
      isDrawing = false
    }
  }
  
  function drawArrow(ctx, x1, y1, x2, y2) {
    const headLength = 15
    const angle = Math.atan2(y2 - y1, x2 - x1)
    
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
    
    // 箭头头部
    ctx.beginPath()
    ctx.moveTo(x2, y2)
    ctx.lineTo(x2 - headLength * Math.cos(angle - Math.PI / 6), y2 - headLength * Math.sin(angle - Math.PI / 6))
    ctx.lineTo(x2 - headLength * Math.cos(angle + Math.PI / 6), y2 - headLength * Math.sin(angle + Math.PI / 6))
    ctx.closePath()
    ctx.fill()
  }
  
  function drawFreehand(ctx, path) {
    if (path.length < 2) return
    ctx.beginPath()
    ctx.moveTo(path[0].x, path[0].y)
    for (let i = 1; i < path.length; i++) {
      ctx.lineTo(path[i].x, path[i].y)
    }
    ctx.stroke()
  }
  
  function redrawAllDrawings() {
    if (!drawingContext) return
    
    const currentPage = PDFViewerApplication.pdfViewer.currentPageNumber
    const pageDrawings = drawingAnnotations.filter(d => d.page === currentPage)
    
    pageDrawings.forEach(drawing => {
      drawingContext.strokeStyle = drawing.color
      drawingContext.lineWidth = drawing.strokeWidth
      drawingContext.fillStyle = drawing.color + '20'
      
      switch (drawing.type) {
        case 'rectangle':
          drawingContext.beginPath()
          drawingContext.rect(drawing.x, drawing.y, drawing.width, drawing.height)
          drawingContext.fill()
          drawingContext.stroke()
          break
        case 'circle':
          drawingContext.beginPath()
          drawingContext.arc(drawing.x, drawing.y, drawing.radius, 0, 2 * Math.PI)
          drawingContext.fill()
          drawingContext.stroke()
          break
        case 'arrow':
          drawArrow(drawingContext, drawing.x1, drawing.y1, drawing.x2, drawing.y2)
          break
        case 'freehand':
          if (drawing.path) {
            drawFreehand(drawingContext, drawing.path)
          }
          break
      }
    })
  }
  
  function stopDrawingMode() {
    isDrawingMode = false
    
    if (drawingCanvas) {
      drawingCanvas.style.pointerEvents = 'none'
    }
    
    vscode.postMessage({
      type: 'drawingModeStopped'
    })
  }
  
  function clearDrawings() {
    const currentPage = PDFViewerApplication.pdfViewer.currentPageNumber
    const removed = drawingAnnotations.filter(d => d.page === currentPage).length
    drawingAnnotations = drawingAnnotations.filter(d => d.page !== currentPage)
    
    if (drawingContext) {
      drawingContext.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height)
    }
    
    vscode.postMessage({
      type: 'drawingsCleared',
      count: removed
    })
  }
  
  function getDrawingAnnotations() {
    const summary = drawingAnnotations.map((d, i) => ({
      index: i,
      type: d.type,
      page: d.page,
      color: d.color,
      timestamp: d.timestamp
    }))
    vscode.postMessage({
      type: 'drawingAnnotationsList',
      drawings: summary,
      total: drawingAnnotations.length
    })
  }
  
  function deleteDrawingAnnotation(index) {
    if (index < 0 || index >= drawingAnnotations.length) return
    
    drawingAnnotations.splice(index, 1)
    
    if (drawingContext) {
      drawingContext.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height)
      redrawAllDrawings()
    }
    
    vscode.postMessage({
      type: 'drawingDeleted',
      remaining: drawingAnnotations.length
    })
  }
  
  // ============== 获取和恢复所有注释 ==============
  
  function getAllAnnotations() {
    const allData = {
      highlights: highlights.map(h => ({
        type: 'highlight',
        text: h.text,
        color: h.color,
        page: h.page,
        textBefore: h.textBefore,
        textAfter: h.textAfter,
        timestamp: h.timestamp || Date.now()
      })),
      annotations: annotations.map(a => ({
        type: a.type,
        text: a.text,
        color: a.color,
        page: a.page,
        textBefore: a.textBefore,
        textAfter: a.textAfter,
        timestamp: a.timestamp
      })),
      comments: comments.map(c => ({
        text: c.text,
        comment: c.comment,
        color: c.color,
        page: c.page,
        textBefore: c.textBefore,
        textAfter: c.textAfter,
        author: c.author,
        timestamp: c.timestamp
      })),
      stickyNotes: stickyNotes.map(n => ({
        content: n.content,
        color: n.color,
        page: n.page,
        x: n.x,
        y: n.y,
        timestamp: n.timestamp
      })),
      drawings: drawingAnnotations.map(d => ({
        type: d.type,
        color: d.color,
        strokeWidth: d.strokeWidth,
        page: d.page,
        timestamp: d.timestamp,
        // 形状特定数据
        x: d.x,
        y: d.y,
        width: d.width,
        height: d.height,
        radius: d.radius,
        x1: d.x1,
        y1: d.y1,
        x2: d.x2,
        y2: d.y2,
        path: d.path
      }))
    }
    
    vscode.postMessage({
      type: 'allAnnotationsData',
      data: allData,
      counts: {
        highlights: highlights.length,
        annotations: annotations.length,
        comments: comments.length,
        stickyNotes: stickyNotes.length,
        drawings: drawingAnnotations.length
      }
    })
  }
  
  function restoreAllAnnotations(data) {
    if (!data) return
    
    // 恢复便签
    if (data.stickyNotes && data.stickyNotes.length > 0) {
      data.stickyNotes.forEach(note => {
        addStickyNote(note.x, note.y, note.content, note.color)
      })
    }
    
    // 恢复绘图注释
    if (data.drawings && data.drawings.length > 0) {
      drawingAnnotations = data.drawings
      if (drawingCanvas && drawingContext) {
        redrawAllDrawings()
      }
    }
    
    // 高亮和文本注释需要在页面渲染后恢复
    setTimeout(() => {
      if (data.highlights) {
        restoreHighlights(data.highlights)
      }
      if (data.annotations) {
        data.annotations.forEach(annot => {
          restoreSingleAnnotation(annot)
        })
      }
      if (data.comments) {
        data.comments.forEach(comment => {
          restoreSingleComment(comment)
        })
      }
    }, 1000)
    
    vscode.postMessage({
      type: 'annotationsRestored'
    })
  }
  
  function restoreSingleAnnotation(annotData) {
    const { text, type, color, page, textBefore, textAfter } = annotData
    
    const textLayer = document.querySelector(`.page[data-page-number="${page}"] .textLayer`)
    if (!textLayer) return
    
    const walker = document.createTreeWalker(textLayer, NodeFilter.SHOW_TEXT, null, false)
    let node
    while ((node = walker.nextNode())) {
      const nodeText = node.textContent
      const index = nodeText.indexOf(text)
      
      if (index !== -1) {
        const range = document.createRange()
        range.setStart(node, index)
        range.setEnd(node, index + text.length)
        
        const span = document.createElement('span')
        span.className = `pdf-annotation pdf-${type} restored-annotation`
        span.dataset.annotationType = type
        span.dataset.color = color
        
        switch (type) {
          case 'underline':
            span.style.textDecoration = 'underline'
            span.style.textDecorationColor = color
            span.style.textDecorationThickness = '2px'
            break
          case 'strikethrough':
            span.style.textDecoration = 'line-through'
            span.style.textDecorationColor = color
            span.style.textDecorationThickness = '2px'
            break
          case 'squiggly':
            span.style.textDecoration = 'underline wavy'
            span.style.textDecorationColor = color
            break
        }
        
        try {
          range.surroundContents(span)
          annotations.push({
            element: span,
            type: type,
            color: color,
            text: text,
            page: page,
            textBefore: textBefore,
            textAfter: textAfter,
            timestamp: annotData.timestamp
          })
          return
        } catch (e) {
          console.error('Error restoring annotation:', e)
        }
      }
    }
  }
  
  function restoreSingleComment(commentData) {
    const { text, comment, color, page, textBefore, textAfter, author, timestamp } = commentData
    
    const textLayer = document.querySelector(`.page[data-page-number="${page}"] .textLayer`)
    if (!textLayer) return
    
    const walker = document.createTreeWalker(textLayer, NodeFilter.SHOW_TEXT, null, false)
    let node
    while ((node = walker.nextNode())) {
      const nodeText = node.textContent
      const index = nodeText.indexOf(text)
      
      if (index !== -1) {
        const range = document.createRange()
        range.setStart(node, index)
        range.setEnd(node, index + text.length)
        
        const span = document.createElement('span')
        span.className = 'pdf-comment-highlight restored-comment'
        span.style.backgroundColor = color
        span.style.opacity = '0.4'
        span.style.borderBottom = '2px dashed ' + color
        span.dataset.commentIndex = comments.length
        span.dataset.color = color
        span.title = comment
        
        const commentIcon = document.createElement('span')
        commentIcon.className = 'pdf-comment-icon'
        commentIcon.innerHTML = '💬'
        commentIcon.style.cursor = 'pointer'
        commentIcon.style.fontSize = '12px'
        commentIcon.style.marginLeft = '2px'
        commentIcon.onclick = function(e) {
          e.stopPropagation()
          showCommentPopup(comments.length - 1)
        }
        
        try {
          range.surroundContents(span)
          span.appendChild(commentIcon)
          
          comments.push({
            element: span,
            icon: commentIcon,
            text: text,
            comment: comment,
            color: color,
            page: page,
            textBefore: textBefore,
            textAfter: textAfter,
            author: author,
            timestamp: timestamp
          })
          return
        } catch (e) {
          console.error('Error restoring comment:', e)
        }
      }
    }
  }
  
  function exportAnnotationsAsJson() {
    getAllAnnotations()
  }

  window.onerror = function () {
    const msg = document.createElement('body')
    msg.innerText = 'An error occurred while loading the file. Please open it again.'
    document.body = msg
  }
}());
