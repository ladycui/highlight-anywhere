/**
 * Highlight Anywhere - Background Script
 * Handles keyboard shortcuts and extension state
 */

// Default storage settings
const DEFAULT_SETTINGS = {
  enabled: false,
  highlightColor: 'rgba(255, 230, 0, 0.5)',
  storeHighlights: true, // 默认开启存储
  storageLocation: '', // Default storage location will be set based on OS
  storageConfigured: false // 标记用户是否已经配置过存储目录
};

// Initialize extension state
let extensionState = {
  enabled: false
};

// Set default storage location based on operating system
function getDefaultStorageLocation() {
  let defaultPath = '';
  
  // Get platform info
  chrome.runtime.getPlatformInfo(info => {
    const os = info.os;
    
    // Set default path based on OS
    switch (os) {
      case 'win':
        defaultPath = '%USERPROFILE%\\Documents\\HighlightAnywhere';
        break;
      case 'mac':
        defaultPath = '~/Documents/HighlightAnywhere';
        break;
      case 'linux':
        defaultPath = '~/Documents/HighlightAnywhere';
        break;
      default:
        defaultPath = '~/HighlightAnywhere';
    }
    
    console.log('[HighlightAnywhere] Default storage path set to:', defaultPath);
    
    // Save default path but don't mark as configured
    chrome.storage.local.get(['settings'], result => {
      const settings = result.settings || DEFAULT_SETTINGS;
      if (!settings.storageConfigured) {
        settings.storageLocation = defaultPath;
        chrome.storage.local.set({ settings });
        console.log('[HighlightAnywhere] Initialized default settings with path');
      }
    });
  });
  
  return defaultPath;
}

// Check if storage needs configuration and show notification if needed
function checkStorageConfiguration() {
  chrome.storage.local.get(['settings'], result => {
    const settings = result.settings || {};
    
    console.log('[HighlightAnywhere] Checking storage configuration:', settings);
    
    // If storage is enabled but not configured, show a notification
    if (settings.storeHighlights && !settings.storageConfigured) {
      // Create a notification to prompt user to configure storage
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (tabs[0]) {
          console.log('[HighlightAnywhere] Sending storage notification to tab:', tabs[0].id);
          chrome.tabs.sendMessage(tabs[0].id, { 
            action: 'showStorageNotification'
          });
        }
      });
    }
  });
}

// Initialize extension settings
function initSettings() {
  chrome.storage.local.get(['settings'], result => {
    if (!result.settings) {
      console.log('[HighlightAnywhere] No settings found, initializing defaults');
      DEFAULT_SETTINGS.storageLocation = getDefaultStorageLocation();
      chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
    } else {
      console.log('[HighlightAnywhere] Loaded settings:', result.settings);
      extensionState.enabled = result.settings.enabled;
      
      // Update icon based on current state
      updateIcon(extensionState.enabled);
      
      // Check storage configuration
      setTimeout(checkStorageConfiguration, 5000); // 延迟5秒检查，给用户一些时间先浏览界面
    }
  });
}

// Update the extension icon based on state
function updateIcon(enabled) {
  // 使用单一图标
  const iconPath = {
    "16": "/public/icons/icon.png",
    "48": "/public/icons/icon.png",
    "128": "/public/icons/icon.png"
  };
  
  chrome.action.setIcon({ path: iconPath });
  
  // 更新badge来指示状态
  if (enabled) {
    chrome.action.setBadgeText({ text: "ON" });
    chrome.action.setBadgeBackgroundColor({ color: "#34c759" }); // 绿色
  } else {
    chrome.action.setBadgeText({ text: "" });
  }
  
  console.log('[HighlightAnywhere] Icon updated, enabled:', enabled);
}

// Toggle highlight mode
function toggleHighlightMode(tabId) {
  extensionState.enabled = !extensionState.enabled;
  console.log('[HighlightAnywhere] Toggle highlight mode:', extensionState.enabled);
  
  // Update settings in storage
  chrome.storage.local.get(['settings'], result => {
    const settings = result.settings || DEFAULT_SETTINGS;
    settings.enabled = extensionState.enabled;
    chrome.storage.local.set({ settings });
    console.log('[HighlightAnywhere] Updated enabled state in settings');
  });
  
  // Update icon
  updateIcon(extensionState.enabled);
  
  // Send message to content script
  if (tabId) {
    console.log('[HighlightAnywhere] Sending toggle message to tab:', tabId);
    chrome.tabs.sendMessage(
      tabId, 
      { action: 'toggleHighlight' },
      response => {
        console.log('[HighlightAnywhere] Toggle response:', response);
      }
    );
  }
  
  return extensionState.enabled;
}

// Listen for keyboard shortcut commands
chrome.commands.onCommand.addListener((command, tab) => {
  if (command === 'toggle-highlight-mode') {
    console.log('[HighlightAnywhere] Keyboard shortcut triggered');
    toggleHighlightMode(tab.id);
  }
});

// Debug helper: dump storage contents
function dumpStorageContents() {
  chrome.storage.local.get(null, function(items) {
    console.log('[HighlightAnywhere] All storage contents:', items);
  });
}

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[HighlightAnywhere] Received message:', request.action, request);
  
  if (request.action === 'getState') {
    sendResponse({ enabled: extensionState.enabled });
  } else if (request.action === 'toggleHighlight') {
    const newState = toggleHighlightMode(request.tabId || (sender.tab ? sender.tab.id : null));
    sendResponse({ enabled: newState });
  } else if (request.action === 'highlightModeChanged') {
    extensionState.enabled = request.isEnabled;
    updateIcon(extensionState.enabled);
    sendResponse({ status: 'success' });
  } else if (request.action === 'configureStorage') {
    // Mark storage as configured
    chrome.storage.local.get(['settings'], result => {
      const settings = result.settings || DEFAULT_SETTINGS;
      settings.storageConfigured = true;
      chrome.storage.local.set({ settings });
      console.log('[HighlightAnywhere] Storage configured');
      sendResponse({ status: 'success' });
    });
    return true; // 异步返回需要这个
  } else if (request.action === 'dumpStorage') {
    // Debug helper
    dumpStorageContents();
    sendResponse({ status: 'success' });
  }
  
  return true; // Required for async sendResponse
});

// Initialize settings when the extension loads
console.log('[HighlightAnywhere] Background script initialized');
initSettings(); 