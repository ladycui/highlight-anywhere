/**
 * Highlight Anywhere - Popup Script
 * Manages popup UI and settings
 */

document.addEventListener('DOMContentLoaded', function() {
  // UI Elements
  const highlightToggle = document.getElementById('highlightToggle');
  const highlightColor = document.getElementById('highlightColor');
  const storageLocation = document.getElementById('storageLocation');
  const browseButton = document.getElementById('browseButton');
  const saveSettingsButton = document.getElementById('saveSettings');

  // Get current state and settings
  loadCurrentState();
  loadSettings();

  // Event listeners
  highlightToggle.addEventListener('change', toggleHighlightMode);
  saveSettingsButton.addEventListener('click', saveSettings);
  highlightColor.addEventListener('change', updateColorPreview);
  browseButton.addEventListener('click', () => {
    // In a real implementation, this would open a file dialog
    // Chrome extensions can't directly access the file system without user interaction
    alert('In a production extension, this would open a directory selection dialog. For now, please enter the path manually.');
  });

  // Load current extension state
  function loadCurrentState() {
    chrome.runtime.sendMessage({ action: 'getState' }, function(response) {
      if (response && response.enabled !== undefined) {
        highlightToggle.checked = response.enabled;
      }
    });
  }

  // Load saved settings
  function loadSettings() {
    chrome.storage.local.get(['settings'], function(result) {
      if (result.settings) {
        const settings = result.settings;
        
        // Set color input value
        if (settings.highlightColor) {
          // Convert rgba to hex for the color input
          const rgba = settings.highlightColor;
          const color = rgbaToHex(rgba);
          highlightColor.value = color;
        }
        
        // Set storage location
        if (settings.storageLocation) {
          storageLocation.value = settings.storageLocation;
        }
      }
    });
  }

  // Toggle highlight mode
  function toggleHighlightMode() {
    const isEnabled = highlightToggle.checked;
    
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs[0]) {
        chrome.runtime.sendMessage({ 
          action: 'toggleHighlight',
          tabId: tabs[0].id
        }, function(response) {
          // Update UI based on response if needed
        });
      }
    });
  }

  // Save settings
  function saveSettings() {
    const newSettings = {
      highlightColor: hexToRgba(highlightColor.value, 0.5),
      storageLocation: storageLocation.value
    };
    
    chrome.storage.local.get(['settings'], function(result) {
      const currentSettings = result.settings || {};
      const updatedSettings = { ...currentSettings, ...newSettings };
      
      chrome.storage.local.set({ settings: updatedSettings }, function() {
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