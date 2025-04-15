/**
 * Highlight Anywhere - Content Script
 * Handles text highlighting and persistence
 */

class HighlightManager {
  constructor() {
    this.isEnabled = false;
    this.highlightedRanges = [];
    this.storageKey = `highlight-data-${this.getNormalizedUrl()}`;
    console.log('[HighlightAnywhere] Initialized with storage key:', this.storageKey);
    
    // 添加调试按钮 (开发模式)
    this.addDebugTools();
    
    // 正常初始化
    this.setupEventListeners();
    
    // 延迟加载高亮，确保DOM已完全加载
    if (document.readyState === 'complete') {
      this.loadHighlights();
    } else {
      window.addEventListener('load', () => {
        console.log('[HighlightAnywhere] Window loaded, now loading highlights');
        // 给DOM多一点时间稳定，特别是对于复杂页面
        setTimeout(() => this.loadHighlights(), 500);
      });
    }
  }

  /**
   * 添加调试工具 (仅用于开发阶段)
   */
  addDebugTools() {
    // 检查是否已存在调试面板
    if (document.getElementById('highlight-debug-panel')) return;
    
    const debugPanel = document.createElement('div');
    debugPanel.id = 'highlight-debug-panel';
    debugPanel.style.position = 'fixed';
    debugPanel.style.bottom = '10px';
    debugPanel.style.right = '10px';
    debugPanel.style.zIndex = '9999';
    debugPanel.style.background = 'rgba(0,0,0,0.7)';
    debugPanel.style.color = 'white';
    debugPanel.style.padding = '5px';
    debugPanel.style.borderRadius = '5px';
    debugPanel.style.fontSize = '12px';
    debugPanel.style.fontFamily = 'monospace';
    debugPanel.style.display = 'none'; // 默认隐藏
    
    // 按钮容器
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '5px';
    
    // 按键 - 转储存储内容
    const dumpStorageBtn = document.createElement('button');
    dumpStorageBtn.textContent = 'Dump Storage';
    dumpStorageBtn.onclick = () => {
      chrome.runtime.sendMessage({ action: 'dumpStorage' });
      console.log('[HighlightAnywhere] Current storage key:', this.storageKey);
      console.log('[HighlightAnywhere] Highlights in memory:', this.highlightedRanges);
      this.showDebugMessage('Storage dump sent to console');
    };
    buttonContainer.appendChild(dumpStorageBtn);
    
    // 按键 - 重新加载高亮
    const reloadHighlightsBtn = document.createElement('button');
    reloadHighlightsBtn.textContent = 'Reload Highlights';
    reloadHighlightsBtn.onclick = () => {
      this.loadHighlights(true);
      this.showDebugMessage('Reloading highlights...');
    };
    buttonContainer.appendChild(reloadHighlightsBtn);
    
    // 按键 - 清除所有高亮
    const clearHighlightsBtn = document.createElement('button');
    clearHighlightsBtn.textContent = 'Clear Highlights';
    clearHighlightsBtn.onclick = () => {
      this.clearAllHighlights();
      this.showDebugMessage('All highlights cleared');
    };
    buttonContainer.appendChild(clearHighlightsBtn);
    
    // 消息显示区域
    const messageArea = document.createElement('div');
    messageArea.id = 'highlight-debug-message';
    messageArea.style.marginTop = '5px';
    messageArea.style.minHeight = '20px';
    
    debugPanel.appendChild(buttonContainer);
    debugPanel.appendChild(messageArea);
    
    document.body.appendChild(debugPanel);
    
    // 添加快捷键切换调试面板
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        debugPanel.style.display = debugPanel.style.display === 'none' ? 'block' : 'none';
      }
    });
  }
  
  /**
   * 清除当前页面上的所有高亮
   */
  clearAllHighlights() {
    // 移除所有高亮元素
    document.querySelectorAll('.highlight-anywhere-highlight').forEach(el => {
      const textNode = document.createTextNode(el.textContent);
      el.parentNode.replaceChild(textNode, el);
    });
    
    // 清空内存中的数据
    this.highlightedRanges = [];
    
    // 从存储中删除
    chrome.storage.local.remove(this.storageKey, () => {
      console.log('[HighlightAnywhere] Cleared all highlights for this page');
    });
  }
  
  /**
   * 显示调试消息
   */
  showDebugMessage(message) {
    const messageArea = document.getElementById('highlight-debug-message');
    if (messageArea) {
      messageArea.textContent = message;
      setTimeout(() => {
        messageArea.textContent = '';
      }, 3000);
    }
  }

  /**
   * Set up event listeners for user interactions
   */
  setupEventListeners() {
    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log('[HighlightAnywhere] Received message:', message.action, message);
      
      if (message.action === 'toggleHighlight') {
        this.toggleHighlightMode();
        sendResponse({ status: 'success', isEnabled: this.isEnabled });
      } else if (message.action === 'updateSettings') {
        this.updateSettings(message.settings);
        sendResponse({ status: 'success' });
      } else if (message.action === 'showStorageNotification') {
        this.showStorageNotification();
        sendResponse({ status: 'success' });
      }
      
      return true; // Required for async response
    });

    // Handle text selection when highlight mode is enabled
    document.addEventListener('mouseup', (e) => {
      if (!this.isEnabled) return;
      
      const selection = window.getSelection();
      if (selection.toString().trim().length > 0) {
        this.highlightSelection(selection);
      }
    });
  }

  /**
   * Get a normalized URL for storage
   * Remove query parameters and hash to make highlights work across page reloads
   */
  getNormalizedUrl() {
    const url = new URL(window.location.href);
    return `${url.origin}${url.pathname}`;
  }

  /**
   * Show a notification about storage configuration
   */
  showStorageNotification() {
    // Create notification element if it doesn't exist
    let notification = document.getElementById('highlight-anywhere-notification');
    if (!notification) {
      notification = document.createElement('div');
      notification.id = 'highlight-anywhere-notification';
      notification.style.position = 'fixed';
      notification.style.top = '0';
      notification.style.left = '0';
      notification.style.right = '0';
      notification.style.backgroundColor = 'rgba(52, 199, 89, 0.9)';
      notification.style.color = 'white';
      notification.style.padding = '10px';
      notification.style.textAlign = 'center';
      notification.style.zIndex = '9999';
      notification.style.fontSize = '14px';
      notification.style.transform = 'translateY(-100%)';
      notification.style.transition = 'transform 0.3s ease';
      
      document.body.appendChild(notification);
    }
    
    notification.textContent = 'Please configure a storage location for your highlights in the extension settings.';
    
    // Show notification
    setTimeout(() => {
      notification.style.transform = 'translateY(0)';
      
      // Hide after 5 seconds
      setTimeout(() => {
        notification.style.transform = 'translateY(-100%)';
      }, 5000);
    }, 500);
  }

  /**
   * Update settings for the highlighter
   * @param {Object} settings - New settings
   */
  updateSettings(settings) {
    console.log('[HighlightAnywhere] Updating settings:', settings);
    
    if (settings.highlightColor) {
      // Update existing highlights with new color
      document.querySelectorAll('.highlight-anywhere-highlight').forEach(el => {
        el.style.backgroundColor = settings.highlightColor;
      });
      
      // Save the new color in the highlight data
      this.highlightedRanges.forEach(highlight => {
        highlight.color = settings.highlightColor;
      });
      
      this.saveHighlights();
    }
  }

  /**
   * Toggle highlighting mode on/off
   */
  toggleHighlightMode() {
    this.isEnabled = !this.isEnabled;
    console.log('[HighlightAnywhere] Highlight mode toggled:', this.isEnabled);
    
    // Update cursor to indicate highlight mode
    if (this.isEnabled) {
      document.body.classList.add('highlight-mode');
    } else {
      document.body.classList.remove('highlight-mode');
    }
    
    // Send status update to popup if needed
    chrome.runtime.sendMessage({ 
      action: 'highlightModeChanged', 
      isEnabled: this.isEnabled 
    });
  }

  /**
   * Highlight the current text selection
   * @param {Selection} selection - The current text selection
   */
  highlightSelection(selection) {
    if (!selection || selection.rangeCount === 0) return;
    
    const range = selection.getRangeAt(0);
    const highlightId = `highlight-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    // Get color and storage settings from storage
    chrome.storage.local.get(['settings'], (result) => {
      const settings = result.settings || {};
      const color = settings.highlightColor || 'rgba(255, 230, 0, 0.5)';
      const storeHighlights = settings.storeHighlights !== undefined ? settings.storeHighlights : true;
      
      try {
        // 保存原始选择信息，用于后续恢复
        const originalTextContent = range.toString();
        
        // Create highlight span
        const highlightSpan = document.createElement('span');
        highlightSpan.className = 'highlight-anywhere-highlight';
        highlightSpan.dataset.id = highlightId;
        highlightSpan.style.backgroundColor = color;
        
        // Apply the highlight
        range.surroundContents(highlightSpan);
        
        // 获取更准确的文本路径
        const betterPath = this.getNodePath(highlightSpan);
        
        // 获取容器信息，确保我们正确捕获文本节点
        const startContainerPath = this.getNodePath(range.startContainer);
        const endContainerPath = this.getNodePath(range.endContainer);
        
        // Store highlight data
        const highlightData = {
          id: highlightId,
          url: this.getNormalizedUrl(),
          text: originalTextContent,  // 存储确切的选中文本
          fullText: this.getContextText(range.startContainer), // 存储周围上下文，帮助文本匹配
          path: betterPath,
          startContainer: startContainerPath,
          endContainer: endContainerPath,
          startOffset: range.startOffset,
          endOffset: range.endOffset,
          color: color,
          timestamp: Date.now()
        };
        
        console.log('[HighlightAnywhere] Created highlight:', highlightData);
        
        // Add to array
        this.highlightedRanges.push(highlightData);
        
        // Save if storage is enabled
        if (storeHighlights) {
          this.saveHighlights();
        }
        
        // Reset selection
        selection.removeAllRanges();
      } catch (error) {
        console.error('[HighlightAnywhere] Failed to highlight selection:', error);
      }
    });
  }
  
  /**
   * 获取一个文本节点的上下文内容（包括其父元素的文本）
   * 这有助于在节点变化时定位相似内容
   */
  getContextText(node) {
    // 如果是文本节点，获取其父元素的全部文本
    if (node && node.nodeType === Node.TEXT_NODE && node.parentNode) {
      return node.parentNode.textContent;
    }
    
    // 如果是元素节点，直接获取其文本
    if (node && node.nodeType === Node.ELEMENT_NODE) {
      return node.textContent;
    }
    
    return "";
  }

  /**
   * Generate a path to a DOM node for later retrieval
   * @param {Node} node - The node to get a path for
   * @returns {Array} - An array representing the path to the node
   */
  getNodePath(node) {
    const path = [];
    let currentNode = node;
    
    while (currentNode && currentNode !== document.body) {
      if (!currentNode.parentNode) break;
      
      // Get all siblings of the same type
      const siblings = Array.from(currentNode.parentNode.childNodes)
        .filter(n => n.nodeType === currentNode.nodeType && n.nodeName === currentNode.nodeName);
      
      // Find position within siblings of same type
      const indexInType = siblings.indexOf(currentNode);
      
      // Get general index
      const index = Array.from(currentNode.parentNode.childNodes)
        .indexOf(currentNode);
      
      // 收集更多节点信息，以便更好地识别
      let nodeInfo = {
        index,
        indexInType,
        nodeType: currentNode.nodeType,
        nodeName: currentNode.nodeName,
        tagName: currentNode.tagName || null,
        className: currentNode.className || null,
        id: currentNode.id || null
      };
      
      // 对于文本节点，保存一个文本片段以便匹配
      if (currentNode.nodeType === Node.TEXT_NODE && currentNode.textContent) {
        nodeInfo.textFragment = currentNode.textContent.substring(0, 50); // 保存前50个字符
      }
      
      path.unshift(nodeInfo);
      currentNode = currentNode.parentNode;
    }
    
    return path;
  }

  /**
   * Find a node based on a previously saved path
   * @param {Array} path - The path to the node
   * @returns {Node} - The found node, or null if not found
   */
  getNodeFromPath(path) {
    let currentNode = document.body;
    
    for (const step of path) {
      try {
        // 尝试多种方法定位节点
        
        // 1. 首先尝试id (如果有)
        if (step.id && document.getElementById(step.id)) {
          currentNode = document.getElementById(step.id);
          continue;
        }
        
        // 2. 尝试通过类型索引
        if (step.nodeName && step.indexInType !== undefined) {
          const siblings = Array.from(currentNode.childNodes)
            .filter(n => n.nodeType === step.nodeType && n.nodeName === step.nodeName);
          
          if (siblings.length > step.indexInType) {
            currentNode = siblings[step.indexInType];
            continue;
          }
        }
        
        // 3. 如果有文本片段匹配，尝试找到匹配的文本节点
        if (step.nodeType === Node.TEXT_NODE && step.textFragment) {
          const textNodes = Array.from(currentNode.childNodes)
            .filter(n => n.nodeType === Node.TEXT_NODE);
          
          for (const textNode of textNodes) {
            if (textNode.textContent && textNode.textContent.includes(step.textFragment)) {
              currentNode = textNode;
              console.log('[HighlightAnywhere] Found node by text fragment match');
              break;
            }
          }
          continue;
        }
        
        // 4. 退回到常规索引
        const children = Array.from(currentNode.childNodes);
        if (step.index < children.length) {
          currentNode = children[step.index];
        } else {
          console.warn('[HighlightAnywhere] Node not found at index:', step.index, 'available children:', children.length);
          return null;
        }
      } catch (e) {
        console.error('[HighlightAnywhere] Error navigating DOM path:', e, step);
        return null;
      }
    }
    
    return currentNode;
  }

  /**
   * Save highlights to Chrome storage
   */
  saveHighlights() {
    const normalizedUrl = this.getNormalizedUrl();
    const key = `highlight-data-${normalizedUrl}`;
    
    console.log(`[HighlightAnywhere] Saving ${this.highlightedRanges.length} highlights with key: ${key}`);
    chrome.storage.local.set({ [key]: this.highlightedRanges }, () => {
      if (chrome.runtime.lastError) {
        console.error('[HighlightAnywhere] Error saving highlights:', chrome.runtime.lastError);
      } else {
        console.log('[HighlightAnywhere] Highlights saved successfully');
      }
    });
  }

  /**
   * Load and apply highlights from storage
   * @param {boolean} force - Force reload even if already loaded
   */
  loadHighlights(force = false) {
    // 避免重复加载
    if (this.highlightsLoaded && !force) {
      console.log('[HighlightAnywhere] Highlights already loaded, skipping');
      return;
    }
    
    const key = this.storageKey;
    console.log('[HighlightAnywhere] Loading highlights with key:', key);
    
    chrome.storage.local.get(['settings', key], (result) => {
      // Check if storage is enabled in settings
      const settings = result.settings || {};
      const storeHighlights = settings.storeHighlights !== undefined ? settings.storeHighlights : true;
      
      if (!storeHighlights) {
        console.log('[HighlightAnywhere] Highlight storage is disabled, not loading highlights');
        return; // Don't load if storage is disabled
      }
      
      const savedHighlights = result[key] || [];
      console.log(`[HighlightAnywhere] Found ${savedHighlights.length} saved highlights`);
      
      // 先清除当前高亮，避免重复
      if (force) {
        document.querySelectorAll('.highlight-anywhere-highlight').forEach(el => {
          // 使用具有相同文本的文本节点替换高亮元素
          const textNode = document.createTextNode(el.textContent);
          el.parentNode.replaceChild(textNode, el);
        });
      }
      
      this.highlightedRanges = savedHighlights;
      let appliedCount = 0;
      
      // Apply each saved highlight
      savedHighlights.forEach(highlight => {
        try {
          // 尝试查找节点 - 首先使用存储的路径
          let node = this.getNodeFromPath(highlight.path);
          let usedMethod = "primary-path";
          
          // 如果找不到节点，尝试使用startContainer路径
          if (!node && highlight.startContainer) {
            console.log('[HighlightAnywhere] Using startContainer path as fallback');
            node = this.getNodeFromPath(highlight.startContainer);
            usedMethod = "start-container";
          }
          
          // 如果还是找不到节点，尝试使用文本搜索
          if (!node && highlight.text) {
            console.log('[HighlightAnywhere] Trying text search as last resort');
            const textNodes = this.findTextNodesWithContent(document.body, highlight.text);
            if (textNodes.length > 0) {
              node = textNodes[0];
              console.log(`[HighlightAnywhere] Found ${textNodes.length} possible text nodes`);
              usedMethod = "text-search";
            }
          }
          
          // 如果上述方法都失败，尝试使用上下文匹配
          if (!node && highlight.fullText) {
            console.log('[HighlightAnywhere] Trying context match');
            const contextNodes = this.findNodesWithSimilarContext(highlight.fullText, highlight.text);
            if (contextNodes.length > 0) {
              node = contextNodes[0];
              usedMethod = "context-match";
            }
          }
          
          if (!node) {
            console.warn('[HighlightAnywhere] Could not find node for highlight:', highlight);
            return;
          }
          
          // 创建范围并高亮
          const range = document.createRange();
          
          // 设置范围 - 这里根据查找方法进行不同处理
          if (node.nodeType === Node.TEXT_NODE) {
            // 文本节点处理
            
            // 如果使用的是文本搜索或上下文匹配，我们需要找到原始文本在当前文本中的位置
            if (usedMethod === "text-search" || usedMethod === "context-match") {
              const nodeText = node.textContent;
              const highlightText = highlight.text;
              
              // 尝试找到原始文本在当前文本节点中的开始位置
              const startPos = nodeText.indexOf(highlightText);
              if (startPos >= 0) {
                // 我们找到了匹配位置，使用它代替原始偏移量
                range.setStart(node, startPos);
                range.setEnd(node, startPos + highlightText.length);
                console.log(`[HighlightAnywhere] Set range based on text match: ${startPos}-${startPos + highlightText.length}`);
              } else {
                // 如果找不到精确匹配，使用默认值
                range.setStart(node, highlight.startOffset || 0);
                range.setEnd(node, highlight.endOffset || node.textContent.length);
              }
            } else {
              // 使用存储的偏移量
              range.setStart(node, highlight.startOffset || 0);
              range.setEnd(node, highlight.endOffset || node.textContent.length);
            }
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            // 对于元素节点，我们需要更复杂的处理...
            const originalText = highlight.text;
            
            // 查找该元素中所有文本节点
            const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
            let foundTextNode = null;
            
            // 遍历查找包含我们要高亮文本的节点
            while (walker.nextNode()) {
              const textNode = walker.currentNode;
              if (textNode.textContent.includes(originalText)) {
                foundTextNode = textNode;
                break;
              }
            }
            
            if (foundTextNode) {
              // 找到了包含原始文本的节点，设置精确范围
              const startPos = foundTextNode.textContent.indexOf(originalText);
              range.setStart(foundTextNode, startPos);
              range.setEnd(foundTextNode, startPos + originalText.length);
              console.log('[HighlightAnywhere] Found exact text within element node');
            } else {
              // 实在找不到，高亮整个元素
              if (node.firstChild) {
                range.setStartBefore(node.firstChild);
                range.setEndAfter(node.lastChild);
                console.log('[HighlightAnywhere] Highlighting entire element as fallback');
              } else {
                console.warn('[HighlightAnywhere] Element node has no children to highlight');
                return;
              }
            }
          } else {
            console.warn('[HighlightAnywhere] Unsupported node type:', node.nodeType);
            return;
          }
          
          const highlightSpan = document.createElement('span');
          highlightSpan.className = 'highlight-anywhere-highlight';
          highlightSpan.dataset.id = highlight.id;
          highlightSpan.style.backgroundColor = highlight.color || 'rgba(255, 230, 0, 0.5)';
          
          try {
            range.surroundContents(highlightSpan);
            appliedCount++;
          } catch (e) {
            console.error('[HighlightAnywhere] Failed to surround contents:', e);
            // 尝试备用方法 - 创建新span并插入
            try {
              const fragment = range.extractContents();
              highlightSpan.appendChild(fragment);
              range.insertNode(highlightSpan);
              appliedCount++;
            } catch (ex) {
              console.error('[HighlightAnywhere] Backup highlight method also failed:', ex);
            }
          }
        } catch (e) {
          console.error('[HighlightAnywhere] Failed to apply highlight:', e, highlight);
        }
      });
      
      console.log(`[HighlightAnywhere] Successfully applied ${appliedCount} out of ${savedHighlights.length} highlights`);
      this.highlightsLoaded = true;
    });
  }
  
  /**
   * 查找包含特定文本内容的文本节点
   * @param {Node} rootNode - 搜索起点节点
   * @param {string} searchText - 要查找的文本内容
   * @returns {Array} - 匹配的文本节点数组
   */
  findTextNodesWithContent(rootNode, searchText) {
    const textNodes = [];
    const walker = document.createTreeWalker(
      rootNode,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          return node.textContent.includes(searchText)
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT;
        }
      }
    );
    
    while (walker.nextNode()) {
      textNodes.push(walker.currentNode);
    }
    
    return textNodes;
  }
  
  /**
   * 查找与给定上下文和目标文本相似的节点
   * @param {string} context - 完整上下文文本
   * @param {string} targetText - 目标高亮文本
   * @returns {Array} - 匹配的节点数组
   */
  findNodesWithSimilarContext(context, targetText) {
    // 清理文本，移除额外空白并简化匹配
    const cleanContext = context.replace(/\s+/g, ' ').trim();
    const cleanTargetText = targetText.replace(/\s+/g, ' ').trim();
    
    // 结果数组
    const matchingNodes = [];
    
    // 查找包含类似上下文的元素
    const allElements = document.querySelectorAll('p, div, span, li, td, th, h1, h2, h3, h4, h5, h6');
    
    allElements.forEach(element => {
      const elementText = element.textContent.replace(/\s+/g, ' ').trim();
      
      // 检查元素是否包含目标文本
      if (elementText.includes(cleanTargetText)) {
        // 如果有较好的上下文匹配，或只是查找目标文本
        if (elementText.length < cleanContext.length * 1.5 && elementText.length > cleanTargetText.length * 1.5) {
          // 找到元素内包含目标文本的文本节点
          const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
          
          while (walker.nextNode()) {
            const node = walker.currentNode;
            if (node.textContent.includes(cleanTargetText)) {
              matchingNodes.push(node);
              break; // 找到一个匹配节点就可以了
            }
          }
        }
      }
    });
    
    if (matchingNodes.length > 0) {
      console.log(`[HighlightAnywhere] Found ${matchingNodes.length} context-matching nodes`);
    }
    
    return matchingNodes;
  }
}

// Initialize the highlight manager when the DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('[HighlightAnywhere] DOM Content Loaded, initializing highlight manager');
    window.highlightManager = new HighlightManager();
  });
} else {
  console.log('[HighlightAnywhere] Document already loaded, initializing highlight manager immediately');
  window.highlightManager = new HighlightManager();
} 