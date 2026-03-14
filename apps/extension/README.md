# MarkView Chrome Extension

A Chrome extension that renders Markdown files beautifully in a side panel.

## Features

- **Side Panel Viewer** — Open MarkView alongside any web page
- **Context Menu** — Right-click any `.md` link → "Open in MarkView"
- **Drag & Drop** — Drop `.md` files directly into the side panel
- **Dark/Light Theme** — Automatic + manual toggle
- **Privacy First** — All processing happens locally

## Installation (Developer Mode)

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **"Developer mode"** (toggle in top-right corner)
3. Click **"Load unpacked"**
4. Select the `apps/extension/` directory
5. The MarkView icon will appear in your extensions toolbar

## Usage

### Open Side Panel
Click the MarkView extension icon in the toolbar to open the side panel.

### View a Local File
Drag and drop any `.md` file into the side panel, or click "browse files".

### View a GitHub File
Right-click on any `.md` link on GitHub → **"Open in MarkView"**

## Roadmap

- [ ] Integrate the full unified markdown pipeline (shared with web app)
- [ ] Add Shiki syntax highlighting
- [ ] Add Mermaid diagram rendering
- [ ] Multiple file/tab support
- [ ] Chrome storage sync for preferences
