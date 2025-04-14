/**
 * Highlight Anywhere - Content Script
 * Handles text highlighting and persistence
 */

class HighlightManager {
  constructor() {
    this.isEnabled = false;
    this.highlightedRanges = [];
    this.storageKey = `highlight-data-${window.location.href}`;
    this.setupEventListeners();
    this.loadHighlights();
  }

  /**
   * Set up event listeners for user interactions
   */
  setupEventListeners() {
    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'toggleHighlight') {
        this.toggleHighlightMode();
        sendResponse({ status: 'success', isEnabled: this.isEnabled });
      } else if (message.action === 'updateSettings') {
        this.updateSettings(message.settings);
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
   * Update settings for the highlighter
   * @param {Object} settings - New settings
   */
  updateSettings(settings) {
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
    
    // Get color from storage or use default
    chrome.storage.local.get(['settings'], (result) => {
      const settings = result.settings || {};
      const color = settings.highlightColor || 'rgba(255, 230, 0, 0.5)';
      
      try {
        // Create highlight span
        const highlightSpan = document.createElement('span');
        highlightSpan.className = 'highlight-anywhere-highlight';
        highlightSpan.dataset.id = highlightId;
        highlightSpan.style.backgroundColor = color;
        
        // Apply the highlight
        range.surroundContents(highlightSpan);
        
        // Store highlight data
        const highlightData = {
          id: highlightId,
          url: window.location.href,
          text: selection.toString(),
          path: this.getNodePath(range.startContainer),
          startOffset: range.startOffset,
          endOffset: range.endOffset,
          color: color,
          timestamp: Date.now()
        };
        
        // Add to array and save
        this.highlightedRanges.push(highlightData);
        this.saveHighlights();
        
        // Reset selection
        selection.removeAllRanges();
      } catch (error) {
        console.error('Failed to highlight selection:', error);
      }
    });
  }

  /**
   * Generate a path to a DOM node for later retrieval
   * @param {Node} node - The node to get a path for
   * @returns {Array} - An array representing the path to the node
   */
  getNodePath(node) {
    const path = [];
    let currentNode = node;
    
    while (currentNode !== document.body) {
      if (!currentNode.parentNode) break;
      
      const index = Array.from(currentNode.parentNode.childNodes)
        .filter(n => n.nodeType === Node.TEXT_NODE || n.nodeType === Node.ELEMENT_NODE)
        .indexOf(currentNode);
      
      path.unshift({
        index,
        nodeType: currentNode.nodeType,
        nodeName: currentNode.nodeName
      });
      
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
      const children = Array.from(currentNode.childNodes)
        .filter(n => n.nodeType === Node.TEXT_NODE || n.nodeType === Node.ELEMENT_NODE);
      
      if (step.index >= children.length) return null;
      currentNode = children[step.index];
    }
    
    return currentNode;
  }

  /**
   * Save highlights to Chrome storage
   */
  saveHighlights() {
    chrome.storage.local.set({ [this.storageKey]: this.highlightedRanges });
  }

  /**
   * Load and apply highlights from storage
   */
  loadHighlights() {
    chrome.storage.local.get([this.storageKey], (result) => {
      const savedHighlights = result[this.storageKey] || [];
      this.highlightedRanges = savedHighlights;
      
      // Apply each saved highlight
      savedHighlights.forEach(highlight => {
        try {
          const node = this.getNodeFromPath(highlight.path);
          if (!node) return;
          
          const range = document.createRange();
          range.setStart(node, highlight.startOffset);
          range.setEnd(node, highlight.endOffset);
          
          const highlightSpan = document.createElement('span');
          highlightSpan.className = 'highlight-anywhere-highlight';
          highlightSpan.dataset.id = highlight.id;
          highlightSpan.style.backgroundColor = highlight.color || 'rgba(255, 230, 0, 0.5)';
          
          range.surroundContents(highlightSpan);
        } catch (e) {
          console.error('Failed to apply highlight:', e);
        }
      });
    });
  }
}

// Initialize the highlight manager when the DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const highlightManager = new HighlightManager();
  });
} else {
  const highlightManager = new HighlightManager();
} 