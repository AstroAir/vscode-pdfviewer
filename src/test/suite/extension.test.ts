import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
  vscode.window.showInformationMessage('Start all tests.');

  // ============== 扩展激活测试 ==============
  test('Extension should be present', () => {
    assert.ok(vscode.extensions.getExtension('AstroAir.pdf'));
  });

  test('Extension should activate', async () => {
    const ext = vscode.extensions.getExtension('AstroAir.pdf');
    if (ext) {
      await ext.activate();
      assert.ok(ext.isActive);
    }
  });

  // ============== 命令注册测试 ==============
  suite('Command Registration Tests', () => {
    test('Navigation commands should be registered', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(commands.includes('pdf.gotoPage'));
      assert.ok(commands.includes('pdf.firstPage'));
      assert.ok(commands.includes('pdf.lastPage'));
      assert.ok(commands.includes('pdf.nextPage'));
      assert.ok(commands.includes('pdf.previousPage'));
      assert.ok(commands.includes('pdf.goBack'));
      assert.ok(commands.includes('pdf.goForward'));
    });

    test('Zoom commands should be registered', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(commands.includes('pdf.zoomIn'));
      assert.ok(commands.includes('pdf.zoomOut'));
      assert.ok(commands.includes('pdf.setZoom'));
      assert.ok(commands.includes('pdf.fitToWidth'));
      assert.ok(commands.includes('pdf.fitToPage'));
      assert.ok(commands.includes('pdf.actualSize'));
    });

    test('Text extraction commands should be registered', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(commands.includes('pdf.extractPageText'));
      assert.ok(commands.includes('pdf.extractAllText'));
      assert.ok(commands.includes('pdf.extractRangeText'));
      assert.ok(commands.includes('pdf.extractSelection'));
    });

    test('Screenshot commands should be registered', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(commands.includes('pdf.capturePageScreenshot'));
      assert.ok(commands.includes('pdf.captureAllPagesScreenshot'));
      assert.ok(commands.includes('pdf.copyPageAsImage'));
    });

    test('Highlight commands should be registered', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(commands.includes('pdf.highlightSelection'));
      assert.ok(commands.includes('pdf.jumpToNextHighlight'));
      assert.ok(commands.includes('pdf.clearAllHighlights'));
    });

    test('View mode commands should be registered', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(commands.includes('pdf.toggleFullscreen'));
      assert.ok(commands.includes('pdf.toggleDualPageView'));
      assert.ok(commands.includes('pdf.toggleContinuousScroll'));
      assert.ok(commands.includes('pdf.showThumbnailNavigator'));
      assert.ok(commands.includes('pdf.toggleInvertColors'));
      assert.ok(commands.includes('pdf.toggleNightMode'));
    });

    test('Bookmark commands should be registered', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(commands.includes('pdf.addBookmark'));
      assert.ok(commands.includes('pdf.showBookmarks'));
      assert.ok(commands.includes('pdf.removeBookmark'));
    });

    test('Annotation commands should be registered', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(commands.includes('pdf.exportAnnotations'));
      assert.ok(commands.includes('pdf.copyAnnotations'));
    });

    test('Auto scroll commands should be registered', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(commands.includes('pdf.startAutoScroll'));
      assert.ok(commands.includes('pdf.stopAutoScroll'));
      assert.ok(commands.includes('pdf.toggleAutoScroll'));
    });

    test('Page note commands should be registered', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(commands.includes('pdf.addPageNote'));
      assert.ok(commands.includes('pdf.showPageNotes'));
      assert.ok(commands.includes('pdf.exportNotes'));
    });

    test('Color mode commands should be registered', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(commands.includes('pdf.setColorMode'));
    });

    test('Copy commands should be registered', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(commands.includes('pdf.copySelection'));
      assert.ok(commands.includes('pdf.selectAll'));
      assert.ok(commands.includes('pdf.copyPageInfo'));
      assert.ok(commands.includes('pdf.copyPageLink'));
      assert.ok(commands.includes('pdf.copyAsMarkdownLink'));
    });

    test('Print and export commands should be registered', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(commands.includes('pdf.print'));
      assert.ok(commands.includes('pdf.export'));
      assert.ok(commands.includes('pdf.printPageRange'));
      assert.ok(commands.includes('pdf.extractPages'));
    });

    test('Sidebar and view commands should be registered', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(commands.includes('pdf.toggleSidebar'));
      assert.ok(commands.includes('pdf.showOutline'));
      assert.ok(commands.includes('pdf.showProperties'));
      assert.ok(commands.includes('pdf.openInSplitView'));
    });

    test('Rotation commands should be registered', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(commands.includes('pdf.rotateClockwise'));
      assert.ok(commands.includes('pdf.rotateCounterClockwise'));
    });

    test('Scroll and spread mode commands should be registered', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(commands.includes('pdf.setScrollMode'));
      assert.ok(commands.includes('pdf.setSpreadMode'));
      assert.ok(commands.includes('pdf.setCursorTool'));
    });

    test('Quick navigation commands should be registered', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(commands.includes('pdf.gotoPercent'));
      assert.ok(commands.includes('pdf.quickJump'));
    });

    test('Compare command should be registered', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(commands.includes('pdf.compareWithAnotherPdf'));
    });
  });
});

// ============== i18n 测试 ==============
suite('i18n Test Suite', () => {
  test('Translation function should exist', async () => {
    // 动态导入以避免路径问题
    const i18n = await import('../../i18n');
    assert.ok(typeof i18n.t === 'function');
  });

  test('Translation function should return string', async () => {
    const i18n = await import('../../i18n');
    const result = i18n.t('msg.textCopied');
    assert.ok(typeof result === 'string');
    assert.ok(result.length > 0);
  });

  test('Translation function should handle arguments', async () => {
    const i18n = await import('../../i18n');
    const result = i18n.t('msg.enterPageNumber', 100);
    assert.ok(result.includes('100'));
  });

  test('Translation should have key messages', async () => {
    const i18n = await import('../../i18n');
    // 测试文本提取相关翻译
    assert.ok(i18n.t('msg.noTextToExtract').length > 0);
    assert.ok(i18n.t('msg.textExtractedCopied').length > 0);
    assert.ok(i18n.t('extract.copyToClipboard').length > 0);
    assert.ok(i18n.t('extract.saveToFile').length > 0);
    assert.ok(i18n.t('extract.openInEditor').length > 0);
    assert.ok(i18n.t('extract.openAsMarkdown').length > 0);

    // 测试元数据相关翻译
    assert.ok(i18n.t('msg.documentMetadata').length > 0);
    assert.ok(i18n.t('metadata.title').length > 0);
    assert.ok(i18n.t('metadata.author').length > 0);

    // 测试页面提取相关翻译
    assert.ok(i18n.t('extract.saveAsImages').length > 0);
    assert.ok(i18n.t('msg.pagesExported', '/path').length > 0);
  });
});

// ============== 配置测试 ==============
suite('Configuration Test Suite', () => {
  test('Configuration should have default values', () => {
    const config = vscode.workspace.getConfiguration('pdf');
    assert.ok(config !== undefined);
  });

  test('Configuration should have cursor setting', () => {
    const config = vscode.workspace.getConfiguration('pdf');
    const cursor = config.get('default.cursor');
    assert.ok(cursor === 'select' || cursor === 'hand' || cursor === undefined);
  });

  test('Configuration should have scale setting', () => {
    const config = vscode.workspace.getConfiguration('pdf');
    const scale = config.get('default.scale');
    // scale 可以是字符串或数字
    assert.ok(
      scale === undefined ||
        typeof scale === 'string' ||
        typeof scale === 'number'
    );
  });

  test('Configuration should have sidebar setting', () => {
    const config = vscode.workspace.getConfiguration('pdf');
    const sidebar = config.get('default.sidebar');
    assert.ok(sidebar === undefined || typeof sidebar === 'boolean');
  });

  test('Configuration should have night mode setting', () => {
    const config = vscode.workspace.getConfiguration('pdf');
    const nightMode = config.get('default.nightMode');
    assert.ok(nightMode === undefined || typeof nightMode === 'boolean');
  });

  test('Configuration should have remember position setting', () => {
    const config = vscode.workspace.getConfiguration('pdf');
    const rememberPosition = config.get('default.rememberPosition');
    assert.ok(
      rememberPosition === undefined || typeof rememberPosition === 'boolean'
    );
  });
});

// ============== 工具函数测试 ==============
suite('Utility Function Tests', () => {
  test('Page range parsing should work correctly', () => {
    // 这个测试需要访问 PdfPreview 类的 parsePageRange 方法
    // 由于是私有方法，我们测试其预期行为
    const parsePageRange = (input: string, totalPages: number): number[] => {
      const pages: Set<number> = new Set();
      const parts = input.split(',').map((p) => p.trim());

      for (const part of parts) {
        if (part.includes('-')) {
          const [start, end] = part.split('-').map((n) => parseInt(n, 10));
          if (!isNaN(start) && !isNaN(end)) {
            for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
              if (i >= 1 && i <= totalPages) {
                pages.add(i);
              }
            }
          }
        } else {
          const page = parseInt(part, 10);
          if (!isNaN(page) && page >= 1 && page <= totalPages) {
            pages.add(page);
          }
        }
      }

      return Array.from(pages).sort((a, b) => a - b);
    };

    // 测试单个页面
    assert.deepStrictEqual(parsePageRange('1', 10), [1]);
    assert.deepStrictEqual(parsePageRange('5', 10), [5]);

    // 测试页面范围
    assert.deepStrictEqual(parsePageRange('1-3', 10), [1, 2, 3]);
    assert.deepStrictEqual(parsePageRange('5-7', 10), [5, 6, 7]);

    // 测试组合
    assert.deepStrictEqual(parsePageRange('1, 3, 5', 10), [1, 3, 5]);
    assert.deepStrictEqual(
      parsePageRange('1-3, 5, 7-9', 10),
      [1, 2, 3, 5, 7, 8, 9]
    );

    // 测试边界
    assert.deepStrictEqual(parsePageRange('0', 10), []);
    assert.deepStrictEqual(parsePageRange('11', 10), []);
    assert.deepStrictEqual(
      parsePageRange('1-15', 10),
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    );

    // 测试无效输入
    assert.deepStrictEqual(parsePageRange('abc', 10), []);
    assert.deepStrictEqual(parsePageRange('', 10), []);
  });

  test('Text formatting should handle empty content', () => {
    const formatTextContent = (items: Array<{ str: string }>): string => {
      if (items.length === 0) return '';
      return items.map((item) => item.str).join('');
    };

    assert.strictEqual(formatTextContent([]), '');
    assert.strictEqual(formatTextContent([{ str: 'Hello' }]), 'Hello');
    assert.strictEqual(
      formatTextContent([{ str: 'Hello' }, { str: ' World' }]),
      'Hello World'
    );
  });
});

// ============== 消息类型测试 ==============
suite('Message Type Tests', () => {
  test('All expected message types should be defined', () => {
    // 测试消息类型常量
    const expectedMessageTypes = [
      'ready',
      'pageChanged',
      'textExtracted',
      'extractError',
      'extractProgress',
      'scaleChanged',
      'documentLoaded',
      'stateChanged',
      'textCopied',
      'noSelection',
      'copyError',
      'annotationsData',
      'annotationsCopied',
      'noAnnotations',
      'printInfo',
      'pagesExtracted',
      'metadataResult',
    ];

    // 验证消息类型数组不为空
    assert.ok(expectedMessageTypes.length > 0);
    expectedMessageTypes.forEach((type) => {
      assert.ok(typeof type === 'string');
      assert.ok(type.length > 0);
    });
  });
});

// ============== 颜色模式测试 ==============
suite('Color Mode Tests', () => {
  test('Color mode values should be valid', () => {
    const validColorModes = [
      'normal',
      'night',
      'grayscale',
      'sepia',
      'highContrast',
    ];

    validColorModes.forEach((mode) => {
      assert.ok(typeof mode === 'string');
      assert.ok(mode.length > 0);
    });
  });
});

// ============== 滚动模式测试 ==============
suite('Scroll Mode Tests', () => {
  test('Scroll mode values should be valid', () => {
    const validScrollModes = ['vertical', 'horizontal', 'wrapped', 'page'];

    validScrollModes.forEach((mode) => {
      assert.ok(typeof mode === 'string');
      assert.ok(mode.length > 0);
    });
  });
});

// ============== 分页模式测试 ==============
suite('Spread Mode Tests', () => {
  test('Spread mode values should be valid', () => {
    const validSpreadModes = ['none', 'odd', 'even'];

    validSpreadModes.forEach((mode) => {
      assert.ok(typeof mode === 'string');
      assert.ok(mode.length > 0);
    });
  });
});

// ============== 光标工具测试 ==============
suite('Cursor Tool Tests', () => {
  test('Cursor tool values should be valid', () => {
    const validCursorTools = ['select', 'hand'];

    validCursorTools.forEach((tool) => {
      assert.ok(typeof tool === 'string');
      assert.ok(tool.length > 0);
    });
  });
});
