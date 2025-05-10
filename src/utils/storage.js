/**
 * Highlight Anywhere - Storage Utility
 * Handles data persistence and provides an abstraction layer for storage operations
 */

class HighlightStorage {
  constructor() {
    this.storageBackend = 'chrome';
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

  /**
   * 导出所有高亮数据到本地文件
   * @returns {Promise<boolean>} - 是否成功导出
   */
  async exportAllHighlights() {
    try {
      // 获取所有高亮数据
      const highlightIndex = await this._getFromStorage('highlight-index') || {};
      const urls = Object.keys(highlightIndex);
      
      if (urls.length === 0) {
        console.log('[HighlightAnywhere] No highlights to export');
        return false;
      }
      
      // 构建完整的导出数据
      const exportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        highlightIndex: highlightIndex,
        data: {}
      };
      
      // 收集每个URL的高亮数据
      for (const url of urls) {
        const key = this._getStorageKey(url);
        const highlights = await this._getFromStorage(key) || [];
        exportData.data[url] = highlights;
      }
      
      // 转换为JSON
      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      
      // 生成文件名
      const date = new Date().toISOString().split('T')[0];
      const filename = `highlight-anywhere-export-${date}.json`;
      
      // 使用chrome.downloads API下载文件
      chrome.downloads.download({
        url: URL.createObjectURL(blob),
        filename: filename,
        saveAs: true
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          console.error('[HighlightAnywhere] Export failed:', chrome.runtime.lastError);
          return false;
        }
        console.log('[HighlightAnywhere] Data exported successfully, download ID:', downloadId);
        return true;
      });
      
      return true;
    } catch (err) {
      console.error('[HighlightAnywhere] Export failed:', err);
      return false;
    }
  }
  
  /**
   * 导入高亮数据
   * @param {Object} importData - 导入的数据对象
   * @returns {Promise<Object>} - 导入结果统计
   */
  async importHighlights(importData) {
    try {
      if (!importData || !importData.version || !importData.data) {
        throw new Error('Invalid import data format');
      }
      
      // Check if store highlights setting is enabled
      const settingsResult = await new Promise(resolve => {
        chrome.storage.local.get(['settings'], resolve);
      });
      const settings = settingsResult.settings || {};
      const storeHighlights = settings.storeHighlights !== undefined ? settings.storeHighlights : true;
      
      const stats = {
        urlsImported: 0,
        highlightsImported: 0,
        errors: [],
        storedToMemoryOnly: !storeHighlights
      };
      
      // Only update the index if storage is enabled
      if (storeHighlights) {
        // 导入高亮索引
        await this._saveToStorage('highlight-index', importData.highlightIndex || {});
        
        // 导入每个URL的高亮数据
        const urls = Object.keys(importData.data);
        for (const url of urls) {
          try {
            const highlights = importData.data[url];
            if (Array.isArray(highlights) && highlights.length > 0) {
              const key = this._getStorageKey(url);
              await this._saveToStorage(key, highlights);
              stats.urlsImported++;
              stats.highlightsImported += highlights.length;
            }
          } catch (err) {
            stats.errors.push(`Error importing ${url}: ${err.message}`);
          }
        }
      } else {
        console.log('[HighlightAnywhere] "Store Highlights" is disabled, imported data will not be saved to storage');
        
        // Just count the items for statistics without saving
        const urls = Object.keys(importData.data);
        stats.urlsImported = urls.length;
        
        for (const url of urls) {
          if (Array.isArray(importData.data[url])) {
            stats.highlightsImported += importData.data[url].length;
          }
        }
      }
      
      console.log('[HighlightAnywhere] Import completed:', stats);
      return stats;
    } catch (err) {
      console.error('[HighlightAnywhere] Import failed:', err);
      return { 
        urlsImported: 0, 
        highlightsImported: 0, 
        errors: [err.message] 
      };
    }
  }
  
  /**
   * 从文件对象读取导入数据
   * @param {File} file - 用户选择的文件
   * @returns {Promise<Object>} - 解析后的数据
   */
  readImportFile(file) {
    return new Promise((resolve, reject) => {
      if (!file) {
        reject(new Error('No file selected'));
        return;
      }
      
      const reader = new FileReader();
      
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target.result);
          resolve(data);
        } catch (err) {
          reject(new Error('Invalid JSON file'));
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Error reading file'));
      };
      
      reader.readAsText(file);
    });
  }
}

// Export the storage class
window.HighlightStorage = HighlightStorage; 