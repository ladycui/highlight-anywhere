# Highlight Anywhere - Installation Guide

This guide will help you install and set up the Highlight Anywhere Chrome extension for development and testing.

## Prerequisites

- Google Chrome browser (version 88 or later)
- Basic knowledge of Chrome's developer mode for extensions

## Installation Steps

### 1. Clone or Download the Repository

```bash
git clone https://github.com/yourusername/highlight-anywhere.git
# or download and extract the ZIP file
```

### 2. Load the Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" by toggling the switch in the top-right corner
3. Click "Load unpacked" button that appears
4. Navigate to the directory where you cloned/extracted the extension
5. Select the root folder of the extension and click "Open"

The extension should now be installed and visible in your extensions list.

### 3. Verify Installation

1. You should see the Highlight Anywhere icon in your browser toolbar
2. Click the icon to open the popup and verify the UI appears correctly
3. The default keyboard shortcut (Shift+Ctrl+H) should toggle highlighting mode

## Usage

### Basic Usage

1. Navigate to any webpage
2. Toggle highlighting mode on by clicking the extension icon or using the keyboard shortcut (Shift+Ctrl+H)
3. Select text on the page - it should be highlighted in yellow
4. Toggle highlighting mode off when done
5. Reload the page to verify your highlights are persisted

### Changing Settings

1. Click the extension icon to open the popup
2. Adjust highlight color using the color picker
3. Set your preferred storage location
4. Click "Save Settings" to apply changes

## Troubleshooting

### Common Issues

- **Highlights not persisting**: Check if you have storage permissions enabled
- **Keyboard shortcut not working**: Ensure there are no conflicts with other extensions
- **Highlighting not working on certain pages**: Some websites with complex DOM structures may have issues

### Debug Mode

For development and debugging:

1. Right-click the extension icon and select "Inspect popup"
2. Navigate to the console tab to see error messages
3. For content script debugging, open the developer tools on the webpage, and check the console

## Development Setup

If you want to modify the extension:

1. Make your changes to the relevant files
2. Go to `chrome://extensions/`
3. Find the Highlight Anywhere extension and click the refresh icon
4. Test your changes

After significant changes, you might want to:

1. Click the "Pack extension" button on the extensions page
2. This will create a `.crx` file that you can distribute for testing

## Security Notes

- The extension requests permissions to access and modify webpage content
- All data is stored locally in Chrome's storage API
- No data is sent to external servers

## Feedback and Contributions

We welcome feedback and contributions to improve Highlight Anywhere!

- Open issues on GitHub for bugs or feature requests
- Submit pull requests with improvements
- Contact the maintainers with questions 