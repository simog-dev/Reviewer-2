# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PDF Reviewer is a cross-platform Electron desktop app for annotating PDF documents with categorized comments (Critical, Major, Minor, Suggestion, Question). It uses PDF.js for rendering, better-sqlite3 for persistence, and vanilla JavaScript Web Components for the UI.

## Commands

```bash
npm install          # Install dependencies (postinstall auto-rebuilds native modules)
npm run rebuild      # Rebuild native modules if you hit issues with better-sqlite3
npm start            # Launch the app
npm run start:dev    # Launch with DevTools open (useful for debugging renderer)
npm test             # Run all tests (install checks → unit → e2e)
npm run test:unit    # Unit tests only (database, utils)
npm run test:e2e     # Playwright E2E tests (headless)
npm run test:e2e:headed  # E2E tests with visible browser window
npm run build        # Build distributable for current platform
```

## Architecture

**Multi-process Electron app with IPC bridge pattern:**

```
Renderer Process (HTML/CSS/JS modules)
    ↓ window.api.*  (exposed via contextBridge)
preload.js          (IPC bridge — maps api methods to ipcRenderer.invoke calls)
    ↓ ipcMain.handle
Main Process (main.js)
    ↓
Database (better-sqlite3) / File System
```

- **Context isolation is enforced.** The renderer never accesses Node.js or `fs` directly. All filesystem and database operations go through IPC handlers defined in `main.js` and exposed via `preload.js` → `window.api`.
- **Navigation between pages** (Home ↔ Review) is done via IPC (`navigate:review`, `navigate:home`) which calls `mainWindow.loadFile(...)`.

### Key Files

| File | Role |
|------|------|
| `main.js` | Electron main process: window creation, all IPC handlers, DB init |
| `preload.js` | Exposes `window.api` — the only channel from renderer to main |
| `src/database/db.js` | `DBManager` class wrapping better-sqlite3 with prepared statements |
| `src/database/schema.sql` | Schema + default category seed data |
| `src/js/pdf-viewer.js` | `PDFViewer` class: loads PDF via pdfjs-dist, renders pages/text/highlights |
| `src/js/annotation-manager.js` | `AnnotationManager`: CRUD for annotations, filtering, sorting, export |
| `src/js/review.js` | Review page controller: wires together PDFViewer, AnnotationManager, UI |
| `src/js/home.js` | Home page controller: PDF list, search, add/remove PDFs |
| `src/js/resizable-panels.js` | `ResizablePanels`: drag-to-resize and collapse for the two-panel layout |
| `src/components/annotation-card.js` | Web Component for annotation list items |
| `src/components/category-filter.js` | Web Component for category filter chips |
| `src/components/pdf-card.js` | Web Component for PDF list cards on home page |
| `src/js/utils.js` | Shared utilities (date formatting, icon helpers, HTML escaping) |

### Pages

- **Home** (`src/index.html`, `src/js/home.js`): Grid of PDF cards with search and pagination. Add PDFs via file dialog or drag-and-drop.
- **Review** (`src/review.html`, `src/js/review.js`): Two-panel layout — PDF viewer on the left, annotation panel on the right. Highlight text to create annotations, click annotations to sync between panels.

### PDF Rendering

`PDFViewer` (in `src/js/pdf-viewer.js`) uses **lazy on-demand rendering** into a scrollable column. On load, all pages are created as sized placeholders (correct layout dimensions, no canvas work) so scroll height is immediately correct. An `IntersectionObserver` triggers actual rendering only for pages near the viewport. A `renderGeneration` counter invalidates stale in-flight renders during zoom changes.

Each rendered page has three layers:
1. **Canvas** — rendered at `devicePixelRatio` resolution for retina sharpness; CSS size is set to layout dimensions so it occupies the correct space
2. **Text layer** — rendered via `pdfjs.TextLayer` with `--scale-factor` CSS custom property (required by PDF.js v4 for span positioning)
3. **Highlight layer** — a plain `div` layer where annotation highlight `div`s are positioned using stored `highlight_rects` scaled by `this.scale`

Highlights store coordinates **unscaled** (at scale=1) and multiply by `this.scale` when rendering. On zoom (`setScale`), placeholder dimensions are updated, rendered content is cleared, and only visible pages are re-rendered. `renderAllHighlights()` skips pages that haven't been rendered yet — those get their highlights when `renderPageIfNeeded` runs for them.

### Annotation Flow

1. User enables highlight mode (`H` key or button)
2. Text selection triggers `onTextSelected` callback with page number, selected text, and bounding rects
3. A popup appears; user picks a category → modal opens for optional comment
4. `AnnotationManager.createAnnotation()` calls `window.api.addAnnotation()` → IPC → `db.addAnnotation()` → SQLite
5. The returned annotation object is pushed to the in-memory array and rendered as a highlight + card

### Database

SQLite with WAL mode and foreign keys. Tables: `pdfs`, `annotations`, `categories`, `settings`. All queries use prepared statements defined in `DBManager.prepareStatements()`. The `highlight_rects` column stores JSON (array of `{left, top, width, height}` objects).

## Known Bugs (from BUGS.md — all fixed)

- **Text layer not resized with zoom** — FIXED: PDF.js v4 TextLayer requires `--scale-factor` CSS custom property on the container; without it all `calc(var(--scale-factor)*...)` expressions for span positions and font sizes are invalid.
- **Clicking highlighted text does nothing** — FIXED: text layer (z-index: 2) intercepts clicks above highlight layer (z-index: 1); added coordinate hit-test on textLayer click to forward matching events to `onHighlightClick`.
- **Low PDF render quality** — FIXED: canvas now renders at `devicePixelRatio` resolution with CSS size scaled back to layout dimensions.
- **UI freezes on large documents** — FIXED: lazy on-demand rendering via IntersectionObserver; pages start as sized placeholders and only render when near the viewport.

## Testing

- **Unit tests** (`tests/unit/`): Test `DBManager` CRUD and utility functions. Use Node.js built-in test runner.
- **E2E tests** (`tests/e2e/`): Playwright tests exercising the full app workflow. Config in `playwright.config.js`.
- **Install tests** (`tests/install.test.js`): Verify that native modules loaded correctly.

Run a single unit test file directly: `node tests/unit/database.test.js`

## Module System

Renderer-side JS uses ES modules (`import`/`export`) loaded via `<script type="module">` in HTML files. Main process and database code use CommonJS (`require`/`module.exports`).

## Category Colors (from schema.sql seed data)

| ID | Name | Color | Icon |
|----|------|-------|------|
| 1 | Critical | #dc2626 | error |
| 2 | Major | #ea580c | warning |
| 3 | Minor | #ca8a04 | info |
| 4 | Suggestion | #2563eb | lightbulb |
| 5 | Question | #7c3aed | help |
