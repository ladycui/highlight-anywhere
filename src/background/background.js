/**
 * Highlight Anywhere - Background Script
 * Handles keyboard shortcuts and extension state
 */

// Default storage settings
const DEFAULT_SETTINGS = {
  enabled: false,
  highlightColor: 'rgba(255, 230, 0, 0.5)',
  storageLocation: '' // Default storage location will be set based on OS
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
    
    // Save default path
    chrome.storage.local.set({ storageLocation: defaultPath });
  });
  
  return defaultPath;
}

// Initialize extension settings
function initSettings() {
  chrome.storage.local.get(['settings'], result => {
    if (!result.settings) {
      DEFAULT_SETTINGS.storageLocation = getDefaultStorageLocation();
      chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
    } else {
      extensionState.enabled = result.settings.enabled;
      
      // Update icon based on current state
      updateIcon(extensionState.enabled);
    }
  });
}

// Update the extension icon based on state
function updateIcon(enabled) {
  const path = enabled 
    ? {
        16: "/public/icons/icon.png",
        32: "/public/icons/icon.png",
        48: "/public/icons/icon.png",
        128: "/public/icons/icon.png"
      }
    : {
        16: "/public/icons/icon.png",
        32: "/public/icons/icon.png",
        48: "/public/icons/icon.png",
        128: "/public/icons/icon.png"
      };
  
  chrome.action.setIcon({ path });
}

// Toggle highlight mode
function toggleHighlightMode(tabId) {
  extensionState.enabled = !extensionState.enabled;
  
  // Update settings in storage
  chrome.storage.local.get(['settings'], result => {
    const settings = result.settings || DEFAULT_SETTINGS;
    settings.enabled = extensionState.enabled;
    chrome.storage.local.set({ settings });
  });
  
  // Update icon
  updateIcon(extensionState.enabled);
  
  // Send message to content script
  chrome.tabs.sendMessage(
    tabId, 
    { action: 'toggleHighlight' },
    response => {
      console.log('Highlight mode toggled:', response);
    }
  );
}

// Listen for keyboard shortcut commands
chrome.commands.onCommand.addListener((command, tab) => {
  if (command === 'toggle-highlight-mode') {
    toggleHighlightMode(tab.id);
  }
});

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getState') {
    sendResponse({ enabled: extensionState.enabled });
  } else if (request.action === 'toggleHighlight') {
    toggleHighlightMode(sender.tab ? sender.tab.id : null);
    sendResponse({ enabled: extensionState.enabled });
  } else if (request.action === 'highlightModeChanged') {
    extensionState.enabled = request.isEnabled;
    updateIcon(extensionState.enabled);
  }
  
  return true; // Required for async sendResponse
});

// Initialize settings when the extension loads
initSettings(); 