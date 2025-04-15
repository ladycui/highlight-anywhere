# Highlight Anywhere

A Chrome extension that allows users to highlight text on any webpage and save those highlights for future visits.

## Features

- Toggle highlighting mode on/off with keyboard shortcut (Shift+Ctrl+H)
- Highlight text selections on any webpage
- Automatic persistence of highlights
- ~~Configurable storage location~~ data saved locally
- Highlighted content is restored when revisiting webpages
- Modern, clean Apple-inspired design

### Current bugs
* configuration of storage location, not supported yet
* toggle status is not stable right now


## Architecture

The extension is built using Manifest V3 and has a modular architecture designed for extensibility:

- **Content Scripts**: Handle the highlighting functionality on the webpage
- **Background Service Worker**: Manages extension state and keyboard shortcuts
- **Popup UI**: Provides user settings and controls
- **Utility Modules**: Provide extensible interfaces for future enhancements

### Future Extensions
* only text is supported, intead of all kinds of types
The architecture is designed to be extensible to support highlighting other elements beyond text, such as:

   - Images
   - Videos
   - Maps
   - Tables
   - And more...
* local storage needs to be refreshed regullaly.
* cancel a highlight


## Installation

### From Chrome Web Store (Coming Soon)

1. Visit the Chrome Web Store
2. Search for "Highlight Anywhere"
3. Click "Add to Chrome"

### Manual Installation (Developer Mode)

1. Clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top-right corner
4. Click "Load unpacked" and select the extension directory
5. The extension should now be installed and ready to use

## Usage

1. Click the Highlight Anywhere icon in your browser toolbar or use the keyboard shortcut (Shift+Ctrl+H) to toggle highlighting mode
2. When highlighting mode is enabled, select any text on the webpage to highlight it
3. Highlights will be saved automatically and restored when you revisit the page
4. Access the extension's popup menu to configure settings like storage location and highlight color

## Development

### Project Structure

```
highlight-anywhere/
├── manifest.json           # Extension manifest
├── public/                 # Public assets
│   └── icons/              # Extension icons
├── src/                    # Source code
│   ├── background/         # Background service worker
│   ├── content/            # Content scripts
│   ├── popup/              # Popup UI
│   └── utils/              # Utility modules
└── README.md               # This file
```

### Building the Extension

The extension is built using standard web technologies and doesn't require a compilation step. For development:

1. Make your changes to the source files
2. Reload the extension in Chrome's extensions page
3. Test your changes

## License

MIT License

## Credits

Developed by [@ladycui](https://github.com/ladycui), co-inspired by [@ser-void](https://github.com/ser-void)