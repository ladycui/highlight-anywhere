/**
 * Highlight Anywhere - Content Script
 * Handles text highlighting and persistence
 */

class HighlightManager {
  constructor() {
    this.isEnabled = false;
    this.highlightedRanges = [];
    this.storage = new HighlightStorage();
    this.normalizedUrl = this.getNormalizedUrl();
    this.storageKey = `highlight-data-${this.normalizedUrl}`;
    this.highlightsLoaded = false;
    console.log('[HighlightAnywhere] Initialized with storage key:', this.storageKey);
    
    // Add debug tools (development mode only)
    this.addDebugTools();
    
    // First load the highlight mode state
    this.loadHighlightModeState();
    
    // Normal initialization
    this.setupEventListeners();
    
    // Delay loading highlights to ensure DOM is fully loaded
    if (document.readyState === 'complete') {
      // Only load highlights if extension is enabled
      if (this.isEnabled) {
        this.loadHighlights();
      } else {
        console.log('[HighlightAnywhere] Extension disabled, skipping initial highlight loading');
      }
    } else {
      window.addEventListener('load', () => {
        console.log('[HighlightAnywhere] Window loaded');
        
        // Give DOM a bit more time to stabilize, especially for complex pages
        // Only load highlights if extension is enabled
        setTimeout(() => {
          if (this.isEnabled) {
            console.log('[HighlightAnywhere] Now loading highlights');
            this.loadHighlights();
          } else {
            console.log('[HighlightAnywhere] Extension disabled, skipping initial highlight loading');
          }
        }, 500);
      });
    }
  }

  /**
   * Load highlight mode state from storage
   */
  loadHighlightModeState() {
    // First load from local storage
    chrome.storage.local.get(['settings'], (result) => {
      if (result.settings && result.settings.enabled !== undefined) {
        this.isEnabled = result.settings.enabled;
        console.log('[HighlightAnywhere] Loaded highlight mode state from storage:', this.isEnabled);
        
        // Immediately apply state to UI
        if (this.isEnabled) {
          document.body.classList.add('highlight-mode');
        } else {
          document.body.classList.remove('highlight-mode');
        }
      }
      
      // Then request current state from background to ensure sync
      chrome.runtime.sendMessage({ action: 'getState' }, (response) => {
        if (response && response.enabled !== undefined && response.enabled !== this.isEnabled) {
          console.log('[HighlightAnywhere] Updating state from background:', response.enabled);
          this.toggleHighlightMode(response.enabled);
        }
      });
    });
  }

  /**
   * Add debug tools (development phase only)
   */
  addDebugTools() {
    // Check if debug panel already exists
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
    debugPanel.style.display = 'none'; // Default hidden
    
    // URL info display
    const urlInfo = document.createElement('div');
    urlInfo.style.marginBottom = '8px';
    urlInfo.style.fontSize = '11px';
    urlInfo.style.wordBreak = 'break-all';
    urlInfo.innerHTML = `
      <div>Original URL: ${window.location.href}</div>
      <div>Normalized URL: ${this.normalizedUrl}</div>
      <div>Storage Key: ${this.storageKey}</div>
    `;
    debugPanel.appendChild(urlInfo);
    
    // Button container
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '5px';
    
    // Button - Dump storage content
    const dumpStorageBtn = document.createElement('button');
    dumpStorageBtn.textContent = 'Dump Storage';
    dumpStorageBtn.onclick = () => {
      chrome.runtime.sendMessage({ action: 'dumpStorage' });
      console.log('[HighlightAnywhere] Current storage key:', this.storageKey);
      console.log('[HighlightAnywhere] Highlights in memory:', this.highlightedRanges);
      this.showDebugMessage('Storage dump sent to console');
    };
    buttonContainer.appendChild(dumpStorageBtn);
    
    // Button - Reload highlights
    const reloadHighlightsBtn = document.createElement('button');
    reloadHighlightsBtn.textContent = 'Reload Highlights';
    reloadHighlightsBtn.onclick = () => {
      this.loadHighlights(true);
      this.showDebugMessage('Reloading highlights...');
    };
    buttonContainer.appendChild(reloadHighlightsBtn);
    
    // Button - Clear all highlights
    const clearHighlightsBtn = document.createElement('button');
    clearHighlightsBtn.textContent = 'Clear Highlights';
    clearHighlightsBtn.onclick = () => {
      this.clearAllHighlights();
      this.showDebugMessage('All highlights cleared');
    };
    buttonContainer.appendChild(clearHighlightsBtn);
    
    // Button - Show URL info
    const checkUrlBtn = document.createElement('button');
    checkUrlBtn.textContent = 'Check URLs';
    checkUrlBtn.onclick = () => {
      // Look up keys in storage and show them
      chrome.storage.local.get(['highlight-index'], (result) => {
        const indexData = result['highlight-index'] || {};
        console.log('[HighlightAnywhere] Stored URL keys:', Object.keys(indexData));
        console.log('[HighlightAnywhere] Current normalized URL:', this.normalizedUrl);
        this.showDebugMessage('URL info logged to console');
      });
    };
    buttonContainer.appendChild(checkUrlBtn);
    
    // Message display area
    const messageArea = document.createElement('div');
    messageArea.id = 'highlight-debug-message';
    messageArea.style.marginTop = '5px';
    messageArea.style.minHeight = '20px';
    
    debugPanel.appendChild(buttonContainer);
    debugPanel.appendChild(messageArea);
    
    document.body.appendChild(debugPanel);
    
    // Add shortcut to toggle debug panel
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        debugPanel.style.display = debugPanel.style.display === 'none' ? 'block' : 'none';
      }
    });
  }
  
  /**
   * Clear all highlights on the current page
   */
  clearAllHighlights() {
    // Remove all highlighted elements
    document.querySelectorAll('.highlight-anywhere-highlight').forEach(el => {
      const textNode = document.createTextNode(el.textContent);
      el.parentNode.replaceChild(textNode, el);
    });
    
    // Clear memory data
    this.highlightedRanges = [];
    
    // Delete from storage
    this.storage.deleteHighlights(this.normalizedUrl)
      .then(() => {
        console.log('[HighlightAnywhere] Cleared all highlights for this page');
      })
      .catch(err => {
        console.error('[HighlightAnywhere] Error clearing highlights:', err);
      });
  }
  
  /**
   * Show debug message
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
        // If message contains enabled attribute, use it to force set state
        const currentState = this.isEnabled;
        const newState = message.enabled !== undefined ? 
          this.toggleHighlightMode(message.enabled) : 
          this.toggleHighlightMode();
        
        // Record state change and return state
        console.log(`[HighlightAnywhere] State changed: ${currentState} -> ${newState}`);
        sendResponse({ status: 'success', isEnabled: newState, previousState: currentState });
      } else if (message.action === 'updateSettings') {
        this.updateSettings(message.settings);
        sendResponse({ status: 'success' });
      } else if (message.action === 'showStorageNotification') {
        this.showStorageNotification();
        sendResponse({ status: 'success' });
      } else if (message.action === 'loadHighlights') {
        // Check if direct data was provided (used when storage is disabled)
        if (message.directData) {
          this.loadHighlights(message.force === true, message.directData);
        } else {
          this.loadHighlights(message.force === true);
        }
        sendResponse({ status: 'success' });
      } else if (message.action === 'checkState') {
        // New: Request to check and sync state
        this.syncStateWithBackground();
        sendResponse({ status: 'success', isEnabled: this.isEnabled });
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
      
    // Listen for page visibility changes - Force sync state when page regains focus
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        console.log('[HighlightAnywhere] Page became visible, syncing state');
        this.syncStateWithBackground();
      }
    });
  }

  /**
   * Sync highlight state with background script
   */
  syncStateWithBackground() {
    chrome.runtime.sendMessage({ action: 'getState' }, (response) => {
      if (response && response.enabled !== undefined) {
        // If state is inconsistent, force update to background state
        if (this.isEnabled !== response.enabled) {
          console.log('[HighlightAnywhere] State sync: local', this.isEnabled, 'background', response.enabled);
          this.toggleHighlightMode(response.enabled);
        }
      }
    });
  }

  /**
   * Get a normalized URL for storage
   * Remove query parameters and hash to make highlights work across page reloads
   */
  getNormalizedUrl() {
    const url = new URL(window.location.href);
    // Remove any trailing slash to ensure consistent URL storage format
    return `${url.origin}${url.pathname.replace(/\/$/, '')}`;
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
   * @param {boolean} [forceState] - Optional forced state
   */
  toggleHighlightMode(forceState) {
    // If forceState parameter is provided, use it, otherwise toggle current state
    const previousState = this.isEnabled;
    if (typeof forceState === 'boolean') {
      // Only update if the state actually changes
      if (this.isEnabled === forceState) {
        // State is already what was requested, no change needed
        console.log('[HighlightAnywhere] Already in requested state:', forceState);
        return this.isEnabled;
      }
      this.isEnabled = forceState;
    } else {
      this.isEnabled = !this.isEnabled;
    }
    
    console.log('[HighlightAnywhere] Highlight mode changed:', this.isEnabled);
    
    // Apply styles unconditionally - ensure DOM state matches memory state
    if (this.isEnabled) {
      document.body.classList.add('highlight-mode');
      console.log('[HighlightAnywhere] Added highlight-mode class to body');
      
      // When enabled, load highlights
      if (!this.highlightsLoaded || previousState !== this.isEnabled) {
        console.log('[HighlightAnywhere] Loading highlights after enabling highlight mode');
        this.loadHighlights();
      }
    } else {
      document.body.classList.remove('highlight-mode');
      console.log('[HighlightAnywhere] Removed highlight-mode class from body');
      
      // When disabled, remove all visible highlights from the page
      if (previousState !== this.isEnabled) {
        console.log('[HighlightAnywhere] Removing highlights after disabling highlight mode');
        document.querySelectorAll('.highlight-anywhere-highlight').forEach(el => {
          // Replace highlighted element with text node of same text
          const textNode = document.createTextNode(el.textContent);
          el.parentNode.replaceChild(textNode, el);
        });
      }
    }
    
    // Force redraw to apply cursor style changes (using different methods to ensure style refresh)
    const originalCursor = document.body.style.cursor;
    document.body.style.cursor = this.isEnabled ? 'inherit' : 'default';
    setTimeout(() => {
      document.body.style.cursor = originalCursor;
      
      // Double check to ensure styles are correctly applied
      if (this.isEnabled !== document.body.classList.contains('highlight-mode')) {
        console.log('[HighlightAnywhere] Style mismatch detected, forcing update');
        if (this.isEnabled) {
          document.body.classList.add('highlight-mode');
        } else {
          document.body.classList.remove('highlight-mode');
        }
      }
    }, 50);
    
    // Only send state change message if state actually changed
    if (previousState !== this.isEnabled) {
      // Send new state back to background to ensure global state sync
      chrome.runtime.sendMessage({ 
        action: 'highlightModeChanged', 
        isEnabled: this.isEnabled 
      });
    }
    
    return this.isEnabled;
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
        // Save original selection information for later restoration
        const originalTextContent = range.toString();
        
        // Create highlight span
        const highlightSpan = document.createElement('span');
        highlightSpan.className = 'highlight-anywhere-highlight';
        highlightSpan.dataset.id = highlightId;
        highlightSpan.style.backgroundColor = color;
        
        // Apply the highlight
        range.surroundContents(highlightSpan);
        
        // Get more accurate text path
        const betterPath = this.getNodePath(highlightSpan);
        
        // Get container information to ensure we correctly capture text nodes
        const startContainerPath = this.getNodePath(range.startContainer);
        const endContainerPath = this.getNodePath(range.endContainer);
        
        // Store highlight data
        const highlightData = {
          id: highlightId,
          url: this.getNormalizedUrl(),
          text: originalTextContent,  // Store exact selected text
          fullText: this.getContextText(range.startContainer), // Store surrounding context to help text matching
          path: betterPath,
          startContainer: startContainerPath,
          endContainer: endContainerPath,
          startOffset: range.startOffset,
          endOffset: range.endOffset,
          color: color,
          timestamp: Date.now()
        };
        
        console.log('[HighlightAnywhere] Created highlight:', highlightData);
        
        // Add to array (always add to memory regardless of storage setting)
        this.highlightedRanges.push(highlightData);
        
        // Save if storage is enabled
        if (storeHighlights) {
          console.log('[HighlightAnywhere] "Store Highlights" is enabled, saving highlight to storage');
          this.saveHighlights();
        } else {
          console.log('[HighlightAnywhere] "Store Highlights" is disabled, highlight only exists in this session');
        }
        
        // Reset selection
        selection.removeAllRanges();
      } catch (error) {
        console.error('[HighlightAnywhere] Failed to highlight selection:', error);
      }
    });
  }
  
  /**
   * Get a text node's surrounding context content (including its parent's text)
   * This helps to locate similar content when node changes
   */
  getContextText(node) {
    // If it's a text node, get its parent's entire text
    if (node && node.nodeType === Node.TEXT_NODE && node.parentNode) {
      return node.parentNode.textContent;
    }
    
    // If it's an element node, get its text directly
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
      
      // Collect more node information to better identify
      let nodeInfo = {
        index,
        indexInType,
        nodeType: currentNode.nodeType,
        nodeName: currentNode.nodeName,
        tagName: currentNode.tagName || null,
        className: currentNode.className || null,
        id: currentNode.id || null
      };
      
      // For text nodes, save a text fragment for matching
      if (currentNode.nodeType === Node.TEXT_NODE && currentNode.textContent) {
        nodeInfo.textFragment = currentNode.textContent.substring(0, 50); // Save first 50 characters
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
        // Try multiple methods to locate node
        
        // 1. First try id (if any)
        if (step.id && document.getElementById(step.id)) {
          currentNode = document.getElementById(step.id);
          continue;
        }
        
        // 2. Try through type index
        if (step.nodeName && step.indexInType !== undefined) {
          const siblings = Array.from(currentNode.childNodes)
            .filter(n => n.nodeType === step.nodeType && n.nodeName === step.nodeName);
          
          if (siblings.length > step.indexInType) {
            currentNode = siblings[step.indexInType];
            continue;
          }
        }
        
        // 3. If there's text fragment match, try to find matching text node
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
        
        // 4. Fall back to regular index
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
    const highlights = this.highlightedRanges;
    console.log(`[HighlightAnywhere] Saving ${highlights.length} highlights`);
    console.log(`[HighlightAnywhere] URL for storage: ${this.normalizedUrl}`);
    
    this.storage.saveHighlights(this.normalizedUrl, highlights)
      .then(() => {
        console.log('[HighlightAnywhere] Highlights saved successfully');
      })
      .catch(err => {
        console.error('[HighlightAnywhere] Error saving highlights:', err);
      });
  }

  /**
   * Load and apply highlights from storage
   * @param {boolean} force - Force reload even if already loaded
   * @param {Object} directData - Optional direct data to use instead of loading from storage
   */
  loadHighlights(force = false, directData = null) {
    // Avoid repeated loading
    if (this.highlightsLoaded && !force) {
      console.log('[HighlightAnywhere] Highlights already loaded, skipping');
      return;
    }
    
    console.log('[HighlightAnywhere] Loading highlights');
    
    // First check if highlight mode is enabled - don't load if it's disabled
    if (!this.isEnabled) {
      console.log('[HighlightAnywhere] Highlight mode is disabled, not loading highlights');
      return;
    }
    
    // Debug information
    const originalUrl = window.location.href;
    const normalizedUrl = this.normalizedUrl;
    console.log('[HighlightAnywhere] Loading highlights for URL:', originalUrl);
    console.log('[HighlightAnywhere] Normalized URL for storage lookup:', normalizedUrl);
    
    // Function to process highlights once we have them (either from storage or direct data)
    const processHighlights = (savedHighlights) => {
      console.log(`[HighlightAnywhere] Processing ${savedHighlights.length} highlights for URL: ${normalizedUrl}`);
      
      // First clear current highlights to avoid repetition
      if (force) {
        document.querySelectorAll('.highlight-anywhere-highlight').forEach(el => {
          // Replace highlighted element with text node of same text
          const textNode = document.createTextNode(el.textContent);
          el.parentNode.replaceChild(textNode, el);
        });
      }
      
      this.highlightedRanges = savedHighlights;
      let appliedCount = 0;
      
      // Apply each saved highlight
      savedHighlights.forEach(highlight => {
        try {
          // Try to find node - First use stored path
          let node = this.getNodeFromPath(highlight.path);
          let usedMethod = "primary-path";
          
          // If node not found, try using startContainer path
          if (!node && highlight.startContainer) {
            console.log('[HighlightAnywhere] Using startContainer path as fallback');
            node = this.getNodeFromPath(highlight.startContainer);
            usedMethod = "start-container";
          }
          
          // If still no node found, try text search
          if (!node && highlight.text) {
            console.log('[HighlightAnywhere] Trying text search as last resort');
            const textNodes = this.findTextNodesWithContent(document.body, highlight.text);
            if (textNodes.length > 0) {
              node = textNodes[0];
              console.log(`[HighlightAnywhere] Found ${textNodes.length} possible text nodes`);
              usedMethod = "text-search";
            }
          }
          
          // If above methods fail, try using context match
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
          
          // Create range and highlight
          const range = document.createRange();
          
          // Set range - Different handling based on search method
          if (node.nodeType === Node.TEXT_NODE) {
            // Text node handling
            
            // If using text search or context match, we need to find original text position in current text
            if (usedMethod === "text-search" || usedMethod === "context-match") {
              const nodeText = node.textContent;
              const highlightText = highlight.text;
              
              // Try to find original text position in current text node
              const startPos = nodeText.indexOf(highlightText);
              if (startPos >= 0) {
                // We found matching position, use it instead of original offset
                range.setStart(node, startPos);
                range.setEnd(node, startPos + highlightText.length);
                console.log(`[HighlightAnywhere] Set range based on text match: ${startPos}-${startPos + highlightText.length}`);
              } else {
                // If exact match not found, use default value
                range.setStart(node, highlight.startOffset || 0);
                range.setEnd(node, highlight.endOffset || node.textContent.length);
              }
            } else {
              // Use stored offset
              range.setStart(node, highlight.startOffset || 0);
              range.setEnd(node, highlight.endOffset || node.textContent.length);
            }
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            // For element nodes, we need more complex handling...
            const originalText = highlight.text;
            
            // Find all text nodes in this element
            const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
            let foundTextNode = null;
            
            // Traverse to find nodes containing text we want to highlight
            while (walker.nextNode()) {
              const textNode = walker.currentNode;
              if (textNode.textContent.includes(originalText)) {
                foundTextNode = textNode;
                break;
              }
            }
            
            if (foundTextNode) {
              // Found node containing original text, set exact range
              const startPos = foundTextNode.textContent.indexOf(originalText);
              range.setStart(foundTextNode, startPos);
              range.setEnd(foundTextNode, startPos + originalText.length);
              console.log('[HighlightAnywhere] Found exact text within element node');
            } else {
              // If still not found, highlight entire element
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
            // Try backup method - Create new span and insert
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
    };
    
    // If direct data is provided, use it instead of loading from storage
    if (directData) {
      console.log('[HighlightAnywhere] Using direct data instead of loading from storage');
      const highlightsForThisUrl = directData[normalizedUrl] || [];
      processHighlights(highlightsForThisUrl);
    } else {
      // Load highlights from storage regardless of storeHighlights setting
      // storeHighlights only controls saving new highlights, not loading existing ones
      this.storage.loadHighlights(this.normalizedUrl)
        .then(savedHighlights => {
          console.log(`[HighlightAnywhere] Found ${savedHighlights.length} saved highlights for URL: ${normalizedUrl}`);
          processHighlights(savedHighlights);
        })
        .catch(err => {
          console.error('[HighlightAnywhere] Error loading highlights:', err);
          console.error('[HighlightAnywhere] URL used for storage lookup:', normalizedUrl);
        });
    }
  }
  
  /**
   * Find text nodes containing specific text content
   * @param {Node} rootNode - Search starting node
   * @param {string} searchText - Text content to search for
   * @returns {Array} - Array of matching text nodes
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
   * Find nodes with similar context and target text
   * @param {string} context - Full context text
   * @param {string} targetText - Target highlight text
   * @returns {Array} - Array of matching nodes
   */
  findNodesWithSimilarContext(context, targetText) {
    // Clean text, remove extra whitespace and simplify matching
    const cleanContext = context.replace(/\s+/g, ' ').trim();
    const cleanTargetText = targetText.replace(/\s+/g, ' ').trim();
    
    // Result array
    const matchingNodes = [];
    
    // Find elements containing similar context
    const allElements = document.querySelectorAll('p, div, span, li, td, th, h1, h2, h3, h4, h5, h6');
    
    allElements.forEach(element => {
      const elementText = element.textContent.replace(/\s+/g, ' ').trim();
      
      // Check if element contains target text
      if (elementText.includes(cleanTargetText)) {
        // If there's better context match or just searching for target text
        if (elementText.length < cleanContext.length * 1.5 && elementText.length > cleanTargetText.length * 1.5) {
          // Found text node within element containing target text
          const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
          
          while (walker.nextNode()) {
            const node = walker.currentNode;
            if (node.textContent.includes(cleanTargetText)) {
              matchingNodes.push(node);
              break; // Found one matching node is enough
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

  // Initialize and connect to background script
  initHighlighter() {
    this.registerMessageListener();
    
    // Initial sync with background
    this.syncStateWithBackground();
    
    // Listen for visibility changes to resync when tab becomes active
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        console.log('Tab became visible, syncing state with background');
        this.syncStateWithBackground();
      }
    });
    
    // No more periodic sync to reduce message traffic
    console.log('Highlight functionality initialized');
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