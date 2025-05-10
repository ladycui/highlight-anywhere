/**
 * Highlight Anywhere - Background Script
 * Handles keyboard shortcuts and extension state
 */

// Default storage settings
const DEFAULT_SETTINGS = {
  enabled: false,
  highlightColor: 'rgba(255, 230, 0, 0.5)',
  storeHighlights: true  // Default enabled
};

// Initialize extension state
let extensionState = {
  enabled: false,
  debugMode: false, // Debug mode disabled by default to reduce logs
};

// Initialize extension settings
function initSettings() {
  chrome.storage.local.get(['settings'], result => {
    if (!result.settings) {
      console.log('[HighlightAnywhere] No settings found, initializing defaults');
      chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
      extensionState.enabled = DEFAULT_SETTINGS.enabled;
    } else {
      console.log('[HighlightAnywhere] Loaded settings:', result.settings);
      extensionState.enabled = result.settings.enabled;
    }
    
    // Update icon based on current state
    updateIcon(extensionState.enabled);
    
    // Broadcast current state to all tabs
    broadcastCurrentState();
  });
}

// Update the extension icon based on state
function updateIcon(enabled) {
  // Use single icon
  const iconPath = {
    "16": "/public/icons/icon.png",
    "48": "/public/icons/icon.png",
    "128": "/public/icons/icon.png"
  };
  
  chrome.action.setIcon({ path: iconPath });
  
  // Update badge to indicate status
  if (enabled) {
    chrome.action.setBadgeText({ text: "ON" });
    chrome.action.setBadgeBackgroundColor({ color: "#34c759" }); // Green
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
      { 
        action: 'toggleHighlight',
        enabled: extensionState.enabled
      },
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
    // Set new state directly without toggling
    extensionState.enabled = request.isEnabled;
    console.log('[HighlightAnywhere] State set directly to:', extensionState.enabled);
    
    // Update icon
    updateIcon(extensionState.enabled);
    
    // Broadcast to all tabs to ensure state consistency
    broadcastCurrentState();
    
    // Send success response
    sendResponse({ status: 'success', enabled: extensionState.enabled });
  } else if (request.action === 'dumpStorage') {
    // Debug helper
    dumpStorageContents();
    sendResponse({ status: 'success' });
  }
  
  return true; // Required for async sendResponse
});

// Optimize broadcasting to reduce unnecessary messages
function broadcastCurrentState() {
  if (extensionState.debugMode) {
    console.log(`Broadcasting state: ${extensionState.enabled ? 'ENABLED' : 'DISABLED'}`);
  }
  
  // Only query regular tabs (http/https)
  chrome.tabs.query({url: ["http://*/*", "https://*/*"]}, (tabs) => {
    if (!tabs || tabs.length === 0) {
      if (extensionState.debugMode) {
        console.log("No valid tabs found for broadcasting");
      }
      return;
    }

    if (extensionState.debugMode) {
      console.log(`Broadcasting to ${tabs.length} tabs`);
    }
    
    const message = {
      action: 'highlightModeChanged',
      enabled: extensionState.enabled
    };
    
    // Send to each tab individually
    tabs.forEach(tab => {
      try {
        chrome.tabs.sendMessage(tab.id, message, (response) => {
          // Only log if debugging is enabled
          if (chrome.runtime.lastError) {
            if (extensionState.debugMode) {
              console.log(`Could not establish connection to tab ${tab.id}: ${chrome.runtime.lastError.message}`);
            }
            return;
          }
          
          if (extensionState.debugMode && response) {
            console.log(`Response from tab ${tab.id}:`, response);
          }
        });
      } catch (error) {
        if (extensionState.debugMode) {
          console.error(`Error sending message to tab ${tab.id}:`, error);
        }
      }
    });
  });
}

// Initialize settings when the extension loads
console.log('[HighlightAnywhere] Background script initialized');
initSettings(); 