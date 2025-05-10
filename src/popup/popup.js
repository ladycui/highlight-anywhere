/**
 * Highlight Anywhere - Popup Script
 * Manages popup UI and settings
 */

document.addEventListener('DOMContentLoaded', function() {
  console.log('[HighlightAnywhere] Popup loaded');
  
  // UI Elements
  const highlightToggle = document.getElementById('highlightToggle');
  const storeHighlightsToggle = document.getElementById('storeHighlightsToggle');
  const highlightColor = document.getElementById('highlightColor');
  const exportData = document.getElementById('exportData');
  const importData = document.getElementById('importData');
  const importFile = document.getElementById('importFile');
  const notification = document.getElementById('notification');
  const notificationMessage = document.getElementById('notificationMessage');
  const closeNotification = document.getElementById('closeNotification');

  // Create storage instance
  const storage = new HighlightStorage();
  
  // Get current state and settings
  loadCurrentState();
  loadSettings();

  // Event listeners
  highlightToggle.addEventListener('change', toggleHighlightMode);
  // Add auto-save functionality to other settings
  storeHighlightsToggle.addEventListener('change', autoSaveSettings);
  highlightColor.addEventListener('change', () => {
    updateColorPreview();
    autoSaveSettings();
  });
  
  exportData.addEventListener('click', exportHighlightData);
  importData.addEventListener('click', triggerImportFile);
  importFile.addEventListener('change', handleImportFile);
  closeNotification.addEventListener('click', hideNotification);

  // Add debug button (only visible when Ctrl+Shift+D is pressed in popup)
  addDebugPanel();
  
  function addDebugPanel() {
    let debugPanel = document.createElement('div');
    debugPanel.id = 'debug-panel';
    debugPanel.style.display = 'none';
    debugPanel.style.marginTop = '10px';
    debugPanel.style.padding = '10px';
    debugPanel.style.backgroundColor = '#f5f5f5';
    debugPanel.style.borderRadius = '5px';
    
    let debugTitle = document.createElement('h3');
    debugTitle.textContent = 'Debug Panel';
    debugTitle.style.fontSize = '14px';
    debugTitle.style.marginBottom = '8px';
    
    let dumpStorageBtn = document.createElement('button');
    dumpStorageBtn.textContent = 'Dump Storage';
    dumpStorageBtn.style.marginRight = '5px';
    dumpStorageBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'dumpStorage' });
      console.log('[HighlightAnywhere] Storage dump requested');
    });
    
    debugPanel.appendChild(debugTitle);
    debugPanel.appendChild(dumpStorageBtn);
    
    document.querySelector('.container').appendChild(debugPanel);
    
    // Ctrl+Shift+D to toggle debug panel
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        debugPanel.style.display = debugPanel.style.display === 'none' ? 'block' : 'none';
      }
    });
  }

  // Load current extension state
  function loadCurrentState() {
    console.log('[HighlightAnywhere] Loading current state...');
    
    // 从本地存储加载最新状态
    chrome.storage.local.get(['settings'], function(result) {
      if (result.settings && result.settings.enabled !== undefined) {
        const storageState = result.settings.enabled;
        console.log('[HighlightAnywhere] State from storage:', storageState);
        highlightToggle.checked = storageState;
      }
      
      // 再从后台脚本获取当前状态，以确保同步
      chrome.runtime.sendMessage({ action: 'getState' }, function(response) {
        if (response && response.enabled !== undefined) {
          const bgState = response.enabled; 
          console.log('[HighlightAnywhere] State from background:', bgState);
          
          // 如果背景状态与存储状态不同，以背景状态为准
          if (highlightToggle.checked !== bgState) {
            console.log('[HighlightAnywhere] State mismatch, updating to:', bgState);
            highlightToggle.checked = bgState;
            
            // 更新本地存储以匹配背景状态
            chrome.storage.local.get(['settings'], function(result) {
              const settings = result.settings || {};
              settings.enabled = bgState;
              chrome.storage.local.set({ settings });
            });
          }
        }
      });
    });
  }

  // Load saved settings
  function loadSettings() {
    chrome.storage.local.get(['settings'], function(result) {
      console.log('[HighlightAnywhere] Loaded settings:', result.settings);
      if (result.settings) {
        const settings = result.settings;
        
        // Set color input value
        if (settings.highlightColor) {
          // Convert rgba to hex for the color input
          const rgba = settings.highlightColor;
          const color = rgbaToHex(rgba);
          highlightColor.value = color;
        }
        
        // Set storage settings
        if (settings.storeHighlights !== undefined) {
          storeHighlightsToggle.checked = settings.storeHighlights;
        }
        
        // Ensure toggle status is in sync with settings
        if (settings.enabled !== undefined) {
          highlightToggle.checked = settings.enabled;
        }
      }
    });
  }

  // Toggle highlight mode
  function toggleHighlightMode() {
    const currentState = highlightToggle.checked;
    console.log('[HighlightAnywhere] Toggle highlight mode manually:', currentState);
    
    // 立即更新UI状态，避免延迟
    const newState = currentState;
    
    // 1. 立即保存到本地存储，确保状态持久化
    chrome.storage.local.get(['settings'], function(result) {
      const settings = result.settings || {};
      settings.enabled = newState;
      chrome.storage.local.set({ settings }, function() {
        console.log('[HighlightAnywhere] Highlight state saved to storage:', newState);
      });
    });
    
    // 2. 通知背景脚本更新全局状态
    chrome.runtime.sendMessage({ 
      action: 'highlightModeChanged', 
      isEnabled: newState 
    }, function(response) {
      console.log('[HighlightAnywhere] Background notified of state change:', response);
    });
    
    // 3. 更新当前标签页状态
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { 
          action: 'toggleHighlight',
          enabled: newState
        }, function(response) {
          console.log('[HighlightAnywhere] Tab updated with new state:', response);
        });
      }
    });
  }

  // Auto save settings when any setting is changed
  function autoSaveSettings() {
    const newSettings = {
      highlightColor: hexToRgba(highlightColor.value, 0.5),
      storeHighlights: storeHighlightsToggle.checked,
      enabled: highlightToggle.checked
    };
    
    console.log('[HighlightAnywhere] Auto-saving settings:', newSettings);
    
    chrome.storage.local.get(['settings'], function(result) {
      const currentSettings = result.settings || {};
      const updatedSettings = { ...currentSettings, ...newSettings };
      
      chrome.storage.local.set({ settings: updatedSettings }, function() {
        console.log('[HighlightAnywhere] Settings saved automatically');
        
        // Show success message
        showNotification('Settings updated', 'success');
        
        // Apply settings to active tabs
        applySettingsToActiveTabs(updatedSettings);
      });
    });
  }

  // Apply settings to active tabs
  function applySettingsToActiveTabs(settings) {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs[0]) {
        console.log('[HighlightAnywhere] Applying settings to tab:', tabs[0].id);
        chrome.tabs.sendMessage(tabs[0].id, { 
          action: 'updateSettings',
          settings: settings
        });
      }
    });
  }

  // Update color preview
  function updateColorPreview() {
    // Could be used to show a live preview of the highlight color
    console.log('[HighlightAnywhere] Color updated to:', highlightColor.value);
  }
  
  // 导出高亮数据
  async function exportHighlightData() {
    try {
      exportData.disabled = true;
      exportData.textContent = '导出中...';
      
      const result = await storage.exportAllHighlights();
      
      if (result) {
        showNotification('高亮数据导出成功', 'success');
      } else {
        showNotification('没有高亮数据可导出', 'warning');
      }
    } catch (err) {
      console.error('[HighlightAnywhere] Export failed:', err);
      showNotification('导出失败: ' + err.message, 'error');
    } finally {
      exportData.disabled = false;
      exportData.textContent = '导出高亮数据';
    }
  }
  
  // 触发导入文件选择
  function triggerImportFile() {
    importFile.click();
  }
  
  // 处理导入文件
  async function handleImportFile(event) {
    try {
      if (!event.target.files || event.target.files.length === 0) {
        return;
      }
      
      importData.disabled = true;
      importData.textContent = '导入中...';
      
      const file = event.target.files[0];
      const fileData = await storage.readImportFile(file);
      const result = await storage.importHighlights(fileData);
      
      // Get current settings to check storage mode
      chrome.storage.local.get(['settings'], (settingsResult) => {
        const settings = settingsResult.settings || {};
        const storeHighlights = settings.storeHighlights !== undefined ? settings.storeHighlights : true;
        
        // Build notification message
        let notificationMessage;
        if (result.errors && result.errors.length > 0) {
          notificationMessage = `导入完成，但有${result.errors.length}个错误`;
          showNotification(notificationMessage, 'warning');
        } else {
          if (result.storedToMemoryOnly) {
            notificationMessage = `导入成功: ${result.urlsImported} 个URL，${result.highlightsImported} 个高亮 (仅内存)`;
          } else {
            notificationMessage = `导入成功: ${result.urlsImported} 个URL，${result.highlightsImported} 个高亮`;
          }
          showNotification(notificationMessage, 'success');
        }
        
        // Reload current page highlights - if storage is disabled, pass data directly
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
          if (tabs[0]) {
            if (!storeHighlights) {
              // When storage is disabled, find the specific data for current URL and pass it directly
              chrome.tabs.sendMessage(tabs[0].id, { 
                action: 'loadHighlights', 
                force: true,
                directData: fileData.data  // Send all imported data directly to content script
              });
              console.log('[HighlightAnywhere] Sending direct import data to content script');
            } else {
              // When storage is enabled, just trigger normal reload
              chrome.tabs.sendMessage(tabs[0].id, { 
                action: 'loadHighlights', 
                force: true 
              });
            }
          }
        });
      });
    } catch (err) {
      console.error('[HighlightAnywhere] Import failed:', err);
      showNotification('导入失败: ' + err.message, 'error');
    } finally {
      importData.disabled = false;
      importData.textContent = '导入高亮数据';
      event.target.value = ''; // 清空文件输入，允许重复选择相同文件
    }
  }
  
  // 显示通知
  function showNotification(message, type = 'success') {
    notificationMessage.textContent = message;
    notification.className = 'notification show ' + type;
    
    // 自动隐藏
    setTimeout(hideNotification, 3000);
  }
  
  // 隐藏通知
  function hideNotification() {
    notification.className = 'notification';
  }

  // Helper: Convert RGBA to HEX
  function rgbaToHex(rgba) {
    // Simple conversion from rgba(r,g,b,a) to hex
    const rgbaMatch = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
    if (rgbaMatch) {
      const r = parseInt(rgbaMatch[1], 10).toString(16).padStart(2, '0');
      const g = parseInt(rgbaMatch[2], 10).toString(16).padStart(2, '0');
      const b = parseInt(rgbaMatch[3], 10).toString(16).padStart(2, '0');
      return `#${r}${g}${b}`;
    }
    return '#FFEE00'; // Default
  }

  // Helper: Convert HEX to RGBA
  function hexToRgba(hex, alpha = 1.0) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
}); 