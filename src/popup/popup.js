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
  const storageLocation = document.getElementById('storageLocation');
  const storageLocationContainer = document.getElementById('storageLocationContainer');
  const browseButton = document.getElementById('browseButton');
  const saveSettingsButton = document.getElementById('saveSettings');

  // Get current state and settings
  loadCurrentState();
  loadSettings();

  // Event listeners
  highlightToggle.addEventListener('change', toggleHighlightMode);
  storeHighlightsToggle.addEventListener('change', toggleStorageVisibility);
  saveSettingsButton.addEventListener('click', saveSettings);
  highlightColor.addEventListener('change', updateColorPreview);
  browseButton.addEventListener('click', () => {
    // In a real implementation, this would open a file dialog
    // Chrome extensions can't directly access the file system without user interaction
    alert('In a production extension, this would open a directory selection dialog. For now, please enter the path manually.');
  });

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
    chrome.runtime.sendMessage({ action: 'getState' }, function(response) {
      console.log('[HighlightAnywhere] Got current state:', response);
      if (response && response.enabled !== undefined) {
        highlightToggle.checked = response.enabled;
      }
    });
  }

  // Toggle storage location visibility based on storage toggle
  function toggleStorageVisibility() {
    console.log('[HighlightAnywhere] Storage toggle changed:', storeHighlightsToggle.checked);
    if (storeHighlightsToggle.checked) {
      storageLocationContainer.style.display = 'block';
    } else {
      storageLocationContainer.style.display = 'none';
    }
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
          // Update UI visibility
          toggleStorageVisibility();
        }
        
        // Set storage location
        if (settings.storageLocation) {
          storageLocation.value = settings.storageLocation;
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
    const isEnabled = highlightToggle.checked;
    console.log('[HighlightAnywhere] Toggle highlight mode manually:', isEnabled);
    
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs[0]) {
        chrome.runtime.sendMessage({ 
          action: 'toggleHighlight',
          tabId: tabs[0].id
        }, function(response) {
          // Update UI based on response
          console.log('[HighlightAnywhere] Toggle response:', response);
          if (response && response.enabled !== undefined) {
            // Make sure the checkbox reflects the actual state
            highlightToggle.checked = response.enabled;
            
            // Also update the settings in storage
            chrome.storage.local.get(['settings'], function(result) {
              const settings = result.settings || {};
              settings.enabled = response.enabled;
              chrome.storage.local.set({ settings });
            });
          }
        });
      }
    });
  }

  // Save settings
  function saveSettings() {
    const newSettings = {
      highlightColor: hexToRgba(highlightColor.value, 0.5),
      storageLocation: storageLocation.value,
      storeHighlights: storeHighlightsToggle.checked,
      // Also save the toggle state
      enabled: highlightToggle.checked
    };
    
    console.log('[HighlightAnywhere] Saving settings:', newSettings);
    
    // 如果用户设置了存储位置，标记为已配置
    if (storeHighlightsToggle.checked && storageLocation.value.trim() !== '') {
      newSettings.storageConfigured = true;
      // 通知后台存储已配置
      chrome.runtime.sendMessage({ action: 'configureStorage' });
    }
    
    chrome.storage.local.get(['settings'], function(result) {
      const currentSettings = result.settings || {};
      const updatedSettings = { ...currentSettings, ...newSettings };
      
      chrome.storage.local.set({ settings: updatedSettings }, function() {
        console.log('[HighlightAnywhere] Settings saved successfully');
        
        // Show success message
        const saveBtn = document.getElementById('saveSettings');
        const originalText = saveBtn.textContent;
        
        saveBtn.textContent = 'Saved!';
        saveBtn.disabled = true;
        
        setTimeout(() => {
          saveBtn.textContent = originalText;
          saveBtn.disabled = false;
        }, 1500);
        
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