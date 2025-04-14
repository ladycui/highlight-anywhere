/**
 * Highlight Anywhere - Storage Utility
 * Handles data persistence and provides an abstraction layer for storage operations
 */

class HighlightStorage {
  constructor() {
    this.defaultStoragePath = '';
    this.initDefaultPath();
  }

  /**
   * Initialize default storage path based on OS
   */
  async initDefaultPath() {
    try {
      const platformInfo = await this._getPlatformInfo();
      
      switch (platformInfo.os) {
        case 'win':
          this.defaultStoragePath = '%USERPROFILE%\\Documents\\HighlightAnywhere';
          break;
        case 'mac':
          this.defaultStoragePath = '~/Documents/HighlightAnywhere';
          break;
        case 'linux':
          this.defaultStoragePath = '~/Documents/HighlightAnywhere';
          break;
        default:
          this.defaultStoragePath = '~/HighlightAnywhere';
      }
    } catch (err) {
      console.error('Error initializing default path:', err);
      this.defaultStoragePath = '~/HighlightAnywhere';
    }
  }

  /**
   * Get platform info (Promise wrapper for chrome.runtime.getPlatformInfo)
   * @returns {Promise<Object>} - Platform information
   */
  _getPlatformInfo() {
    return new Promise((resolve) => {
      chrome.runtime.getPlatformInfo(resolve);
    });
  }

  /**
   * Save highlight data for a specific URL
   * @param {string} url - The URL of the page
   * @param {Array} highlights - Array of highlight objects
   * @returns {Promise<void>}
   */
  async saveHighlights(url, highlights) {
    try {
      const key = this._getStorageKey(url);
      await this._saveToStorage(key, highlights);
      
      // Also save to local metadata index for future features
      await this._updateHighlightIndex(url, highlights);
    } catch (err) {
      console.error('Error saving highlights:', err);
    }
  }

  /**
   * Load highlight data for a specific URL
   * @param {string} url - The URL of the page
   * @returns {Promise<Array>} - Array of highlight objects
   */
  async loadHighlights(url) {
    try {
      const key = this._getStorageKey(url);
      return await this._getFromStorage(key) || [];
    } catch (err) {
      console.error('Error loading highlights:', err);
      return [];
    }
  }

  /**
   * Delete highlight data for a specific URL
   * @param {string} url - The URL of the page
   * @returns {Promise<void>}
   */
  async deleteHighlights(url) {
    try {
      const key = this._getStorageKey(url);
      await this._removeFromStorage(key);
      await this._removeFromHighlightIndex(url);
    } catch (err) {
      console.error('Error deleting highlights:', err);
    }
  }

  /**
   * Get all URLs with highlights
   * @returns {Promise<Array>} - Array of URLs with highlights
   */
  async getHighlightedUrls() {
    try {
      const index = await this._getFromStorage('highlight-index') || {};
      return Object.keys(index);
    } catch (err) {
      console.error('Error getting highlighted URLs:', err);
      return [];
    }
  }

  /**
   * Update the highlight index with metadata
   * @param {string} url - The URL of the page
   * @param {Array} highlights - Array of highlight objects
   * @returns {Promise<void>}
   */
  async _updateHighlightIndex(url, highlights) {
    try {
      const index = await this._getFromStorage('highlight-index') || {};
      
      // Update index with metadata
      index[url] = {
        count: highlights.length,
        lastUpdated: Date.now(),
        title: document.title || url
      };
      
      await this._saveToStorage('highlight-index', index);
    } catch (err) {
      console.error('Error updating highlight index:', err);
    }
  }

  /**
   * Remove a URL from the highlight index
   * @param {string} url - The URL to remove
   * @returns {Promise<void>}
   */
  async _removeFromHighlightIndex(url) {
    try {
      const index = await this._getFromStorage('highlight-index') || {};
      delete index[url];
      await this._saveToStorage('highlight-index', index);
    } catch (err) {
      console.error('Error removing from highlight index:', err);
    }
  }

  /**
   * Generate a storage key for a URL
   * @param {string} url - The URL to generate a key for
   * @returns {string} - The storage key
   */
  _getStorageKey(url) {
    return `highlight-data-${this._hashUrl(url)}`;
  }

  /**
   * Create a simple hash of a URL for storage keys
   * @param {string} url - The URL to hash
   * @returns {string} - Hashed URL
   */
  _hashUrl(url) {
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Save data to Chrome storage
   * @param {string} key - Storage key
   * @param {any} data - Data to save
   * @returns {Promise<void>}
   */
  _saveToStorage(key, data) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: data }, resolve);
    });
  }

  /**
   * Get data from Chrome storage
   * @param {string} key - Storage key
   * @returns {Promise<any>} - Retrieved data
   */
  _getFromStorage(key) {
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (result) => {
        resolve(result[key]);
      });
    });
  }

  /**
   * Remove data from Chrome storage
   * @param {string} key - Storage key
   * @returns {Promise<void>}
   */
  _removeFromStorage(key) {
    return new Promise((resolve) => {
      chrome.storage.local.remove(key, resolve);
    });
  }
}

// Export the storage class
window.HighlightStorage = HighlightStorage; 