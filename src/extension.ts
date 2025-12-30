import * as vscode from 'vscode';
import { PdfCustomProvider } from './pdfProvider';

export function activate(context: vscode.ExtensionContext): void {
  const extensionRoot = vscode.Uri.file(context.extensionPath);
  // Register our custom editor provider
  const provider = new PdfCustomProvider(extensionRoot, context);
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      PdfCustomProvider.viewType,
      provider,
      {
        webviewOptions: {
          enableFindWidget: false,
          retainContextWhenHidden: true,
        },
      }
    )
  );

  // 注册所有PDF预览命令
  /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-function-return-type */
  const commands: Array<{
    command: string;
    callback: (...args: any[]) => any;
  }> = [
    // 页面导航
    {
      command: 'pdf.gotoPage',
      callback: () => provider.activePreview?.gotoPage(),
    },
    {
      command: 'pdf.firstPage',
      callback: () => provider.activePreview?.firstPage(),
    },
    {
      command: 'pdf.lastPage',
      callback: () => provider.activePreview?.lastPage(),
    },
    {
      command: 'pdf.nextPage',
      callback: () => provider.activePreview?.nextPage(),
    },
    {
      command: 'pdf.previousPage',
      callback: () => provider.activePreview?.previousPage(),
    },

    // 缩放
    { command: 'pdf.zoomIn', callback: () => provider.activePreview?.zoomIn() },
    {
      command: 'pdf.zoomOut',
      callback: () => provider.activePreview?.zoomOut(),
    },
    {
      command: 'pdf.setZoom',
      callback: () => provider.activePreview?.setZoom(),
    },

    // 打印和导出
    { command: 'pdf.print', callback: () => provider.activePreview?.print() },
    {
      command: 'pdf.export',
      callback: () => provider.activePreview?.exportPdf(),
    },

    // 书签
    {
      command: 'pdf.addBookmark',
      callback: () => provider.activePreview?.addBookmark(),
    },
    {
      command: 'pdf.showBookmarks',
      callback: () => provider.activePreview?.showBookmarks(),
    },
    {
      command: 'pdf.removeBookmark',
      callback: () => provider.activePreview?.removeBookmark(),
    },

    // 视图控制
    {
      command: 'pdf.toggleSidebar',
      callback: () => provider.activePreview?.toggleSidebar(),
    },
    { command: 'pdf.find', callback: () => provider.activePreview?.find() },
    {
      command: 'pdf.showProperties',
      callback: () => provider.activePreview?.showProperties(),
    },

    // 旋转
    {
      command: 'pdf.rotateClockwise',
      callback: () => provider.activePreview?.rotateClockwise(),
    },
    {
      command: 'pdf.rotateCounterClockwise',
      callback: () => provider.activePreview?.rotateCounterClockwise(),
    },

    // 模式设置
    {
      command: 'pdf.setScrollMode',
      callback: () => provider.activePreview?.setScrollMode(),
    },
    {
      command: 'pdf.setSpreadMode',
      callback: () => provider.activePreview?.setSpreadMode(),
    },
    {
      command: 'pdf.setCursorTool',
      callback: () => provider.activePreview?.setCursorTool(),
    },

    // 复制功能
    {
      command: 'pdf.copySelection',
      callback: () => provider.activePreview?.copySelection(),
    },
    {
      command: 'pdf.selectAll',
      callback: () => provider.activePreview?.selectAll(),
    },

    // 新增功能
    {
      command: 'pdf.toggleNightMode',
      callback: () => provider.activePreview?.toggleNightMode(),
    },
    {
      command: 'pdf.presentationMode',
      callback: () => provider.activePreview?.presentationMode(),
    },
    {
      command: 'pdf.showRecentPositions',
      callback: () => provider.activePreview?.showRecentPositions(),
    },
    {
      command: 'pdf.clearRecentPositions',
      callback: () => provider.activePreview?.clearRecentPositions(),
    },
    {
      command: 'pdf.fitToWidth',
      callback: () => provider.activePreview?.fitToWidth(),
    },
    {
      command: 'pdf.fitToPage',
      callback: () => provider.activePreview?.fitToPage(),
    },
    {
      command: 'pdf.actualSize',
      callback: () => provider.activePreview?.actualSize(),
    },
    {
      command: 'pdf.showOutline',
      callback: () => provider.activePreview?.showOutline(),
    },

    // 页面历史导航
    {
      command: 'pdf.goBack',
      callback: () => provider.activePreview?.goBack(),
    },
    {
      command: 'pdf.goForward',
      callback: () => provider.activePreview?.goForward(),
    },

    // 文本提取
    {
      command: 'pdf.extractPageText',
      callback: () => provider.activePreview?.extractPageText(),
    },
    {
      command: 'pdf.extractAllText',
      callback: () => provider.activePreview?.extractAllText(),
    },
    {
      command: 'pdf.extractRangeText',
      callback: () => provider.activePreview?.extractRangeText(),
    },
    {
      command: 'pdf.extractSelection',
      callback: () => provider.activePreview?.extractSelection(),
    },

    // 自动滚动
    {
      command: 'pdf.startAutoScroll',
      callback: () => provider.activePreview?.startAutoScroll(),
    },
    {
      command: 'pdf.stopAutoScroll',
      callback: () => provider.activePreview?.stopAutoScroll(),
    },
    {
      command: 'pdf.toggleAutoScroll',
      callback: () => provider.activePreview?.toggleAutoScroll(),
    },

    // 比较视图
    {
      command: 'pdf.openInSplitView',
      callback: () => provider.activePreview?.openInSplitView(),
    },

    // 页面笔记
    {
      command: 'pdf.addPageNote',
      callback: () => provider.activePreview?.addPageNote(),
    },
    {
      command: 'pdf.showPageNotes',
      callback: () => provider.activePreview?.showPageNotes(),
    },
    {
      command: 'pdf.exportNotes',
      callback: () => provider.activePreview?.exportNotes(),
    },

    // 快捷跳转
    {
      command: 'pdf.gotoPercent',
      callback: () => provider.activePreview?.gotoPercent(),
    },
    {
      command: 'pdf.quickJump',
      callback: () => provider.activePreview?.quickJump(),
    },

    // 颜色模式
    {
      command: 'pdf.setColorMode',
      callback: () => provider.activePreview?.setColorMode(),
    },

    // 复制信息
    {
      command: 'pdf.copyPageInfo',
      callback: () => provider.activePreview?.copyPageInfo(),
    },
    {
      command: 'pdf.copyPageLink',
      callback: () => provider.activePreview?.copyPageLink(),
    },

    // 文件操作
    {
      command: 'pdf.openPreview',
      callback: async (uri: vscode.Uri) => {
        if (uri) {
          await vscode.commands.executeCommand(
            'vscode.openWith',
            uri,
            'pdf.preview'
          );
        }
      },
    },
    {
      command: 'pdf.openInExternalApp',
      callback: async (uri: vscode.Uri) => {
        const targetUri = uri || provider.activePreview?.resourceUri;
        if (targetUri) {
          await vscode.env.openExternal(targetUri);
        }
      },
    },
    {
      command: 'pdf.copyFilePath',
      callback: async (uri: vscode.Uri) => {
        const targetUri = uri || provider.activePreview?.resourceUri;
        if (targetUri) {
          await vscode.env.clipboard.writeText(targetUri.fsPath);
          vscode.window.showInformationMessage('Path copied to clipboard');
        }
      },
    },
    {
      command: 'pdf.revealInExplorer',
      callback: async (uri: vscode.Uri) => {
        const targetUri = uri || provider.activePreview?.resourceUri;
        if (targetUri) {
          await vscode.commands.executeCommand('revealFileInOS', targetUri);
        }
      },
    },
    {
      command: 'pdf.showFileInfo',
      callback: async (uri: vscode.Uri) => {
        const targetUri = uri || provider.activePreview?.resourceUri;
        if (targetUri) {
          const fs = await import('fs');
          const stats = fs.statSync(targetUri.fsPath);
          const sizeKB = (stats.size / 1024).toFixed(2);
          const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
          const info = [
            `File: ${targetUri.fsPath}`,
            `Size: ${sizeKB} KB (${sizeMB} MB)`,
            `Created: ${stats.birthtime.toLocaleString()}`,
            `Modified: ${stats.mtime.toLocaleString()}`,
          ].join('\n');
          vscode.window.showInformationMessage(info, { modal: true });
        }
      },
    },
    {
      command: 'pdf.exportAnnotations',
      callback: () => provider.activePreview?.exportAnnotations(),
    },
    {
      command: 'pdf.copyAnnotations',
      callback: () => provider.activePreview?.copyAnnotations(),
    },

    // 页面提取和截图
    {
      command: 'pdf.extractPages',
      callback: () => provider.activePreview?.extractPages(),
    },
    {
      command: 'pdf.capturePageScreenshot',
      callback: () => provider.activePreview?.capturePageScreenshot(),
    },
    {
      command: 'pdf.captureAllPagesScreenshot',
      callback: () => provider.activePreview?.captureAllPagesScreenshot(),
    },
    {
      command: 'pdf.copyPageAsImage',
      callback: () => provider.activePreview?.copyPageAsImage(),
    },

    // 文档比较
    {
      command: 'pdf.compareWithAnotherPdf',
      callback: () => provider.activePreview?.compareWithAnotherPdf(),
    },

    // 打印范围
    {
      command: 'pdf.printPageRange',
      callback: () => provider.activePreview?.printPageRange(),
    },

    // 视图模式
    {
      command: 'pdf.toggleFullscreen',
      callback: () => provider.activePreview?.toggleFullscreen(),
    },
    {
      command: 'pdf.toggleDualPageView',
      callback: () => provider.activePreview?.toggleDualPageView(),
    },
    {
      command: 'pdf.toggleContinuousScroll',
      callback: () => provider.activePreview?.toggleContinuousScroll(),
    },
    {
      command: 'pdf.showThumbnailNavigator',
      callback: () => provider.activePreview?.showThumbnailNavigator(),
    },
    {
      command: 'pdf.toggleInvertColors',
      callback: () => provider.activePreview?.toggleInvertColors(),
    },

    // 其他功能
    {
      command: 'pdf.copyAsMarkdownLink',
      callback: () => provider.activePreview?.copyAsMarkdownLink(),
    },
    {
      command: 'pdf.highlightSelection',
      callback: () => provider.activePreview?.highlightSelection(),
    },
    {
      command: 'pdf.jumpToNextHighlight',
      callback: () => provider.activePreview?.jumpToNextHighlight(),
    },
    {
      command: 'pdf.clearAllHighlights',
      callback: () => provider.activePreview?.clearAllHighlights(),
    },

    // 阅读统计
    {
      command: 'pdf.showReadingStats',
      callback: () => provider.activePreview?.showReadingStats(),
    },
    {
      command: 'pdf.clearReadingStats',
      callback: () => provider.activePreview?.clearReadingStats(),
    },

    // 搜索历史
    {
      command: 'pdf.showSearchHistory',
      callback: () => provider.activePreview?.showSearchHistory(),
    },
    {
      command: 'pdf.clearSearchHistory',
      callback: () => provider.activePreview?.clearSearchHistory(),
    },

    // 书签导入导出
    {
      command: 'pdf.exportBookmarks',
      callback: () => provider.activePreview?.exportBookmarks(),
    },
    {
      command: 'pdf.importBookmarks',
      callback: () => provider.activePreview?.importBookmarks(),
    },

    // 快捷键帮助
    {
      command: 'pdf.showKeyboardShortcuts',
      callback: () => provider.activePreview?.showKeyboardShortcuts(),
    },

    // 文本操作
    {
      command: 'pdf.searchSelectedText',
      callback: () => provider.activePreview?.searchSelectedText(),
    },
    {
      command: 'pdf.copySelectedTextWithPage',
      callback: () => provider.activePreview?.copySelectedTextWithPage(),
    },

    // 高亮颜色
    {
      command: 'pdf.setHighlightColor',
      callback: () => provider.activePreview?.setHighlightColor(),
    },
    {
      command: 'pdf.highlightSelectionWithColor',
      callback: () => provider.activePreview?.highlightSelectionWithColor(),
    },
    {
      command: 'pdf.showHighlightsList',
      callback: () => provider.activePreview?.showHighlightsList(),
    },

    // 扩展注释功能
    {
      command: 'pdf.underlineSelection',
      callback: () => provider.activePreview?.underlineSelection(),
    },
    {
      command: 'pdf.strikethroughSelection',
      callback: () => provider.activePreview?.strikethroughSelection(),
    },
    {
      command: 'pdf.squigglySelection',
      callback: () => provider.activePreview?.squigglySelection(),
    },

    // 评论功能
    {
      command: 'pdf.addCommentToSelection',
      callback: () => provider.activePreview?.addCommentToSelection(),
    },
    {
      command: 'pdf.showCommentsList',
      callback: () => provider.activePreview?.showCommentsList(),
    },

    // 便签功能
    {
      command: 'pdf.addStickyNote',
      callback: () => provider.activePreview?.addStickyNote(),
    },
    {
      command: 'pdf.showStickyNotesList',
      callback: () => provider.activePreview?.showStickyNotesList(),
    },

    // 绘图注释功能
    {
      command: 'pdf.startDrawingMode',
      callback: () => provider.activePreview?.startDrawingMode(),
    },
    {
      command: 'pdf.stopDrawingMode',
      callback: () => provider.activePreview?.stopDrawingMode(),
    },
    {
      command: 'pdf.clearDrawings',
      callback: () => provider.activePreview?.clearDrawings(),
    },
    {
      command: 'pdf.showDrawingsList',
      callback: () => provider.activePreview?.showDrawingsList(),
    },

    // 全部注释管理
    {
      command: 'pdf.exportAllAnnotations',
      callback: () => provider.activePreview?.exportAllAnnotations(),
    },
    {
      command: 'pdf.showAllAnnotationsList',
      callback: () => provider.activePreview?.showAllAnnotationsList(),
    },
  ];
  /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-function-return-type */

  commands.forEach(({ command, callback }) => {
    context.subscriptions.push(
      vscode.commands.registerCommand(command, callback)
    );
  });
}

export function deactivate(): void {}
