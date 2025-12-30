"use strict";

(function () {
  const vscode = acquireVsCodeApi();
  
  // 防止递归调用的标志
  let isApplyingTheme = false;
  
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
      
      // 先检测当前的 VSCode 主题类（在移除之前）
      const isDark = classList.contains('vscode-dark');
      const isLight = classList.contains('vscode-light');
      const isHighContrast = classList.contains('vscode-high-contrast');
      
      // 如果已经有正确的主题类，不需要做任何修改
      if (isDark || isLight || isHighContrast) {
        return;
      }
      
      // 如果没有主题类，根据媒体查询添加默认主题
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        classList.add('vscode-dark');
      } else {
        classList.add('vscode-light');
      }
    } finally {
      isApplyingTheme = false;
    }
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
    
    // 监听主题变化
    const observer = new MutationObserver(applyTheme);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    
    const config = loadConfig()
    PDFViewerApplicationOptions.set('cMapUrl', config.cMapUrl)
    PDFViewerApplicationOptions.set('standardFontDataUrl', config.standardFontDataUrl)
    const loadOpts = {
      url: config.path,
      useWorkerFetch: false,
      cMapUrl: config.cMapUrl,
      cMapPacked: true,
      standardFontDataUrl: config.standardFontDataUrl
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
      
      // 监听页面变化事件
      PDFViewerApplication.eventBus.on('pagechanging', notifyPageChange)
      
      // 监听缩放变化事件
      PDFViewerApplication.eventBus.on('scalechanging', notifyScaleChange)
      
      // load() cannot be called before pdf.js is initialized
      // open() makes sure pdf.js is initialized before load()
      PDFViewerApplication.open(config.path).then(async function () {
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
          highlightSelection()
          break
          
        case 'jumpToNextHighlight':
          jumpToNextHighlight()
          break
          
        case 'clearAllHighlights':
          clearAllHighlights()
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
  
  // ============== 高亮功能 ==============
  let highlights = []
  let currentHighlightIndex = -1
  
  function highlightSelection() {
    const selection = window.getSelection()
    if (selection && selection.toString().trim()) {
      const range = selection.getRangeAt(0)
      const span = document.createElement('span')
      span.className = 'pdf-highlight'
      span.style.backgroundColor = 'yellow'
      span.style.opacity = '0.5'
      
      try {
        range.surroundContents(span)
        highlights.push(span)
        selection.removeAllRanges()
      } catch (err) {
        console.error('Error highlighting:', err)
      }
    }
  }
  
  function jumpToNextHighlight() {
    if (highlights.length === 0) return
    
    currentHighlightIndex = (currentHighlightIndex + 1) % highlights.length
    const highlight = highlights[currentHighlightIndex]
    if (highlight) {
      highlight.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // 闪烁效果
      highlight.style.backgroundColor = 'orange'
      setTimeout(() => {
        highlight.style.backgroundColor = 'yellow'
      }, 500)
    }
  }
  
  function clearAllHighlights() {
    highlights.forEach(span => {
      const parent = span.parentNode
      while (span.firstChild) {
        parent.insertBefore(span.firstChild, span)
      }
      parent.removeChild(span)
    })
    highlights = []
    currentHighlightIndex = -1
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

  window.onerror = function () {
    const msg = document.createElement('body')
    msg.innerText = 'An error occurred while loading the file. Please open it again.'
    document.body = msg
  }
}());
