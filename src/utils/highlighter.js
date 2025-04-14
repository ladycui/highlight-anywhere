/**
 * Highlight Anywhere - Highlighter Utility
 * Provides an extensible interface for different highlighting strategies
 */

/**
 * Base Highlighter class that defines the interface
 * All specific highlighters should extend this class
 */
class BaseHighlighter {
  constructor(options = {}) {
    this.options = {
      color: 'rgba(255, 230, 0, 0.5)',
      ...options
    };
  }

  /**
   * Highlight a target element or selection
   * @param {*} target - The target to highlight
   * @returns {Object} - Information about the created highlight
   */
  highlight(target) {
    throw new Error('Method not implemented');
  }

  /**
   * Remove a highlight
   * @param {string} id - ID of the highlight to remove
   * @returns {boolean} - Whether removal was successful
   */
  removeHighlight(id) {
    throw new Error('Method not implemented');
  }

  /**
   * Apply a previously saved highlight
   * @param {Object} highlightData - Data for the highlight to apply
   * @returns {boolean} - Whether application was successful
   */
  applyHighlight(highlightData) {
    throw new Error('Method not implemented');
  }

  /**
   * Update the highlighter options
   * @param {Object} options - New options
   */
  updateOptions(options) {
    this.options = { ...this.options, ...options };
  }
}

/**
 * Text Highlighter for highlighting text selections
 */
class TextHighlighter extends BaseHighlighter {
  constructor(options = {}) {
    super(options);
    this.highlights = new Map();
  }

  /**
   * Highlight a text selection
   * @param {Selection} selection - The text selection to highlight
   * @returns {Object|null} - Information about the created highlight
   */
  highlight(selection) {
    if (!selection || selection.rangeCount === 0 || selection.toString().trim() === '') {
      return null;
    }

    const range = selection.getRangeAt(0);
    const highlightId = `highlight-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    
    try {
      // Create highlight span
      const highlightSpan = document.createElement('span');
      highlightSpan.className = 'highlight-anywhere-highlight';
      highlightSpan.dataset.id = highlightId;
      highlightSpan.style.backgroundColor = this.options.color;
      
      // Apply the highlight
      range.surroundContents(highlightSpan);
      
      // Store highlight data
      const highlightData = {
        id: highlightId,
        type: 'text',
        url: window.location.href,
        text: selection.toString(),
        path: this._getNodePath(range.startContainer),
        startOffset: range.startOffset,
        endOffset: range.endOffset,
        timestamp: Date.now()
      };
      
      this.highlights.set(highlightId, highlightData);
      return highlightData;
    } catch (e) {
      console.error('Failed to highlight selection:', e);
      return null;
    }
  }

  /**
   * Remove a highlight by ID
   * @param {string} id - ID of the highlight to remove
   * @returns {boolean} - Whether removal was successful
   */
  removeHighlight(id) {
    try {
      const highlightElement = document.querySelector(`[data-id="${id}"]`);
      if (!highlightElement) return false;
      
      // Replace the highlight element with its text content
      const textNode = document.createTextNode(highlightElement.textContent);
      highlightElement.parentNode.replaceChild(textNode, highlightElement);
      
      // Remove from tracked highlights
      this.highlights.delete(id);
      return true;
    } catch (e) {
      console.error('Failed to remove highlight:', e);
      return false;
    }
  }

  /**
   * Apply a previously saved highlight
   * @param {Object} highlightData - Data for the highlight to apply
   * @returns {boolean} - Whether application was successful
   */
  applyHighlight(highlightData) {
    try {
      // Only handle text highlights
      if (highlightData.type !== 'text') return false;
      
      const node = this._getNodeFromPath(highlightData.path);
      if (!node) return false;
      
      const range = document.createRange();
      range.setStart(node, highlightData.startOffset);
      range.setEnd(node, highlightData.endOffset);
      
      const highlightSpan = document.createElement('span');
      highlightSpan.className = 'highlight-anywhere-highlight';
      highlightSpan.dataset.id = highlightData.id;
      highlightSpan.style.backgroundColor = this.options.color;
      
      range.surroundContents(highlightSpan);
      
      // Add to tracked highlights
      this.highlights.set(highlightData.id, highlightData);
      return true;
    } catch (e) {
      console.error('Failed to apply highlight:', e);
      return false;
    }
  }

  /**
   * Generate a path to a DOM node for later retrieval
   * @param {Node} node - The node to get a path for
   * @returns {Array} - An array representing the path to the node
   */
  _getNodePath(node) {
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
  _getNodeFromPath(path) {
    let currentNode = document.body;
    
    for (const step of path) {
      const children = Array.from(currentNode.childNodes)
        .filter(n => n.nodeType === Node.TEXT_NODE || n.nodeType === Node.ELEMENT_NODE);
      
      if (step.index >= children.length) return null;
      currentNode = children[step.index];
    }
    
    return currentNode;
  }
}

/**
 * Image Highlighter for highlighting images (future extension)
 */
class ImageHighlighter extends BaseHighlighter {
  constructor(options = {}) {
    super(options);
    this.highlights = new Map();
  }

  /**
   * Highlight an image
   * @param {HTMLImageElement} imageElement - The image to highlight
   * @returns {Object|null} - Information about the created highlight
   */
  highlight(imageElement) {
    // This is a placeholder for future implementation
    if (!imageElement || !(imageElement instanceof HTMLImageElement)) {
      return null;
    }

    const highlightId = `highlight-img-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    
    try {
      // Create a highlight container
      const container = document.createElement('div');
      container.className = 'highlight-anywhere-image-container';
      container.dataset.id = highlightId;
      
      // Clone the image and wrap it
      const parent = imageElement.parentNode;
      parent.insertBefore(container, imageElement);
      container.appendChild(imageElement);
      
      // Add highlight effect
      container.style.boxShadow = `0 0 0 3px ${this.options.color}`;
      container.style.display = 'inline-block';
      container.style.borderRadius = '2px';
      container.style.transition = 'box-shadow 0.2s ease';
      
      // Store highlight data
      const highlightData = {
        id: highlightId,
        type: 'image',
        url: window.location.href,
        imageSrc: imageElement.src,
        imageAlt: imageElement.alt,
        path: this._getNodePath(container),
        timestamp: Date.now()
      };
      
      this.highlights.set(highlightId, highlightData);
      return highlightData;
    } catch (e) {
      console.error('Failed to highlight image:', e);
      return null;
    }
  }

  /**
   * Remove an image highlight
   * @param {string} id - ID of the highlight to remove
   * @returns {boolean} - Whether removal was successful
   */
  removeHighlight(id) {
    // This is a placeholder for future implementation
    try {
      const container = document.querySelector(`[data-id="${id}"]`);
      if (!container) return false;
      
      // Unwrap the image
      const image = container.querySelector('img');
      if (image) {
        container.parentNode.insertBefore(image, container);
        container.parentNode.removeChild(container);
      }
      
      // Remove from tracked highlights
      this.highlights.delete(id);
      return true;
    } catch (e) {
      console.error('Failed to remove image highlight:', e);
      return false;
    }
  }

  /**
   * Apply a previously saved image highlight
   * @param {Object} highlightData - Data for the highlight to apply
   * @returns {boolean} - Whether application was successful
   */
  applyHighlight(highlightData) {
    // This is a placeholder for future implementation
    return false;
  }

  /**
   * Generate a path to a DOM node for later retrieval
   * @param {Node} node - The node to get a path for
   * @returns {Array} - An array representing the path to the node
   */
  _getNodePath(node) {
    // Same implementation as TextHighlighter
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
  _getNodeFromPath(path) {
    // Same implementation as TextHighlighter
    let currentNode = document.body;
    
    for (const step of path) {
      const children = Array.from(currentNode.childNodes)
        .filter(n => n.nodeType === Node.TEXT_NODE || n.nodeType === Node.ELEMENT_NODE);
      
      if (step.index >= children.length) return null;
      currentNode = children[step.index];
    }
    
    return currentNode;
  }
}

/**
 * Highlighter Factory to create appropriate highlighter instances
 */
class HighlighterFactory {
  /**
   * Create a highlighter instance of the specified type
   * @param {string} type - Type of highlighter to create
   * @param {Object} options - Options for the highlighter
   * @returns {BaseHighlighter} - The created highlighter instance
   */
  static createHighlighter(type, options = {}) {
    switch (type.toLowerCase()) {
      case 'text':
        return new TextHighlighter(options);
      case 'image':
        return new ImageHighlighter(options);
      default:
        console.warn(`Unknown highlighter type: ${type}, defaulting to text highlighter`);
        return new TextHighlighter(options);
    }
  }
}

// Export the highlighter classes
window.BaseHighlighter = BaseHighlighter;
window.TextHighlighter = TextHighlighter;
window.ImageHighlighter = ImageHighlighter;
window.HighlighterFactory = HighlighterFactory; 