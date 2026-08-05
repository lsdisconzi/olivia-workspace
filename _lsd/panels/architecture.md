# Olivia Panel System — Architecture Reference

> Generated 2026-08-04 from live source analysis.
> Source files: `frontend/css/`, `frontend/js/modules/output.js`, `frontend/js/modules/docs.js`,
> `frontend/js/modules/studio.js`, `frontend/js/sidebar/tabs.js`, `frontend/index.html`

---

## 1. OVERVIEW — Seven Panels

```
┌──────────┬──────────────────────────────────────────────────────┐
│          │                                                      │
│ SIDEBAR  │               MAIN CONTENT (chat)                    │
│  (left)  │                                                      │
│          │                                                      │
│          │                                                      │
└──────────┴──────────────────────────────────────────────────────┘
                                              ┌──────────┬───────┐
                                              │ OUTPUT / │       │
                                              │ PREVIEW /│ STUDIO│
                                              │ BROWSER  │  AI   │
                                              └──────────┴───────┘
```

1. **Sidebar** — left edge, tabs (agents, docs, files, projects...)
2. **Output Panel** — right side, renders agent artifacts
3. **Preview Panel** — right side, previews files from doc tree
4. **Browser Panel** — right side, embedded iframe browser
5. **Studio Editor Panel** — left half of studio view, code editor
6. **Studio Preview Panel** — right half of studio view, live HTML preview
7. **Studio AI Panel** — far right within studio, floating chat

The three right-side panels (Output, Preview, Browser) share the same physical space.
They sit side-by-side in the `.workspace` flex container and are ordered by CSS `order`
property (section-views.css:13-17).

---

## 2. SIDEBAR

| Property | Value |
|----------|-------|
| DOM ID | `sidebarEl` |
| CSS class (open) | `.sidebar` |
| CSS class (collapsed) | `.collapsed` |
| CSS class (mobile overlay) | `.mobile-open` |
| Default width | 300px |
| Min width (CSS) | 220px |
| Min width (JS constraint) | 220px (`initSidebarResize`, tabs.js:413) |
| Max width (CSS) | 520px |
| Max width (JS constraint) | 540px (`initSidebarResize`, tabs.js:413) |
| Collapsed width | 44px (forces `min-width: 44px !important`) |
| Resize handle | `#sidebarResizeHandle` |
| Resize CSS file | `sidebar.css:13-23` |
| Resize JS | `initSidebarResize()` at tabs.js:379 |
| Z-index (desktop) | none explicit |
| Z-index (mobile) | 100 (responsive.css:44) |
| On mobile <=768px | `width: 280px`, `transform: translateX(-100%)` overlay |

### Behavior
- **Toggle**: `toggleSidebar()` (tabs.js:300) — adds/removes `.collapsed`
- **Mobile toggle**: `toggleMobileSidebar()` (tabs.js:326) — adds `.mobile-open`
- **Open to tab**: `openSidebarToTab(tab)` (tabs.js:314) — opens + switches tab
- When collapsed: all inner content hidden, only `.sidebar-collapsed-strip` with icon-only trunk buttons shown
- **No localStorage persistence** for collapsed state or width

### Buttons
- Collapse/expand triggered by trunk button or hamburger (mobile)
- Tab buttons inside: agents, docs, files, memory, history, endpoints, etc.

---

## 3. OUTPUT PANEL

| Property | Value |
|----------|-------|
| DOM ID | `outputPanel` |
| CSS class (open) | `.open` |
| CSS class (resizing) | `.resizing` |
| Default closed state | `width: 0; min-width: 0` |
| Default open width | 440px |
| Min width (CSS, open) | 240px |
| Min width (JS drag) | 220px (output.js:422) |
| Max width (CSS) | `min(90vw, 1600px)` |
| Max width (JS drag) | `Math.floor(window.innerWidth * 0.9)` (output.js:451) |
| CSS transition | `none` (instant open/close) |
| Resize handle | `#outputResizeHandle` |
| Resize JS | `_initHorizResize('outputResizeHandle', 'outputPanel')` (output.js:414) |
| Z-index (desktop) | none (flex child in workspace) |
| Z-index (mobile) | 90 (responsive.css:83, slides up from bottom) |
| On mobile <=768px | `display: none !important` (base.css:5389) |
| On tablet <=768px | `position: fixed; bottom: 0; left: 0; right: 0; max-height: 50vh` (responsive.css:76) |

### Behavior
- **Toggle**: `toggleOutputPanel()` (output.js:465)
  - Opening: sets `_outputAutoOpenSuppressedUntil = 0`
  - Closing: suppresses auto-open for 45 seconds (`OUTPUT_AUTO_OPEN_SUPPRESS_MS = 45000`)
- **Auto-open**: When `showOutputArtifactInPanel()` is called, the panel auto-opens UNLESS suppressed (output.js:769-772)
- **Edge toggle button**: `#outputEdgeToggle` — fixed position on right edge of viewport
  - CSS: `output-toggle-panel.css` — `position: fixed; right: 0; top: 50%; z-index: 110`
  - Shows when output panel is closed; hidden when open
  - Arrow rotates 180deg when open
- **Resize drag**: dragging left edge leftward grows the panel. Body gets `.is-panel-resizing` class.
- **No localStorage persistence** for open/closed state or width

### Header elements
- Title (h3, serif font)
- Close button
- Action buttons (download dropdown, maximize button)

### Body content
- `.output-body` — flex: 1, overflow-y: auto, padding: 16px
- Renders: markdown, iframes, images, audio, rich text cards, CSV tables

---

## 4. PREVIEW PANEL

| Property | Value |
|----------|-------|
| DOM ID | `previewPanel` |
| CSS class (open) | `.open` |
| Default closed state | `display: none` |
| Default open width | inherits from inline `style.width` set by resize handler (default CSS: 440px like output) |
| Min width (JS drag) | 220px (same `_initHorizResize`) |
| Max width (JS drag) | 90vw |
| Resize handle | `#previewResizeHandle` |
| Resize JS | `_initHorizResize('previewResizeHandle', 'previewPanel')` (output.js:331) |
| Z-index | none (flex child) |

### Behavior
- **Toggle**: `togglePreviewPanel(show)` (docs.js:1087), exposed as `window.togglePreviewPanel`
  - **Opening** (show=true):
    1. Sets `display: flex`
    2. After 10ms delay, adds `.open` class
    3. Calls `syncWorkspacePanels()` or falls back to showing resize handle + busy refresh
  - **Closing** (show=false):
    1. Removes `.open` class
    2. Calls `syncWorkspacePanels()`
    3. After 300ms delay, sets `display: none` (if `.open` hasn't been re-added)
    4. Calls `syncWorkspacePanels()` again (or falls back to busy refresh)
  - The 300ms close delay allows CSS transitions to complete before hiding the element
- **Opened by**: `openPreviewUrl()` (docs.js:1764) — called from doc tree clicks and workspace artifact clicks
- **No localStorage persistence** for open/closed state or width

### Header elements
- `#previewPanelTitle` — title with file-type icon
- `#previewDownloadDropdown` — download button (hidden when empty, shown when file loaded)
- `#previewMaximizeBtn` — maximize button (shows when file loaded)
- Close button
- `#previewAudioMeta` — audio metadata bar (hidden by default)

### Body content
- `#previewBody` — rendered via `openPreviewUrl()` dispatch by file type

### File type dispatch (openPreviewUrl)
| Type | Handler |
|------|---------|
| pdf | iframe embed |
| html / htm | iframe sandbox |
| markdown / md | marked → `.answer-md` |
| json | pretty-print + hyperlink overlay |
| docx / doc | mammoth.js via `renderDocxIntoElement` |
| audio (wav, mp3, m4a, etc.) | `<audio>` + waveform visualization |
| image (png, jpg, gif, svg, webp) | `<img>` |
| cypher / cql | `<pre><code class="language-cypher">` + highlight.js |
| text (txt, csv, xml, yaml, sql, py, js, etc.) | `renderRichTextCardHtml` |
| csv (special) | `renderRichTextCardHtml` — also renders CSV table in output panel via separate path |

---

## 5. BROWSER PANEL

| Property | Value |
|----------|-------|
| DOM ID | `browserPanel` |
| CSS class (open) | `.open` |
| CSS class (resizing) | `.resizing` |
| Default closed state | `width: 0; min-width: 0` |
| Default open width | 440px |
| Min width (CSS, open) | 240px |
| Min width (JS drag) | 220px |
| Max width (CSS) | `min(90vw, 1600px)` |
| CSS transition | `0.3s ease` (smooth open/close) |
| Resize handle | `#browserResizeHandle` |
| Resize JS | `_initHorizResize('browserResizeHandle', 'browserPanel')` (output.js:332) |
| Z-index | 8 on header (browser-panel.css:5) |

### Behavior
- **Open**: `openBrowserPanel()` (output.js:480) — adds `.open`, calls `_syncWorkspacePanels()`
- **Close**: `closeBrowserPanel()` (output.js:487) — removes `.open`, calls `_syncWorkspacePanels()`
- **Toggle**: `toggleBrowserPanel()` (output.js:494) — toggles `.open`, calls `_syncWorkspacePanels()`
- **Navigate**: `navigateBrowser(url)` (output.js:715) — opens if closed, navigates iframe
- **Share with agent**: `shareBrowserPageWithAgent()` (output.js:535) — opens panel, syncs state
- **No localStorage persistence** for open/closed state or width

### Header elements
- `#browserUrlBar` — URL input
- Nav buttons (back, forward, reload)
- `#browserShareBtn` — share page with agent toggle
- Close button

### Body
- `<iframe>` — full panel body

### Share mechanism
- `syncBrowserSharedState(url, title, shared)` (output.js:502)
- State stored in `window.__oliviaBrowserShareState`
- When shared, the current page URL/title is sent to the agent context
- Green dot indicator on share button when active

---

## 6. STUDIO EDITOR PANEL

| Property | Value |
|----------|-------|
| DOM ID | `studioEditorPanel` |
| CSS class (hidden) | `.s-hidden` |
| Default width | `flex: 0 0 50%` (half of studio area) |
| Min width | 280px (CSS), 200px (splitter JS: studio.js:1466) |
| Max width | 80% (CSS) |
| Toggle button | `#studioEditorToggleBtn` |

### Behavior
- **Toggle**: `studioTogglePanel('editor')` (studio.js:1901) — toggles `.s-hidden`
- When hidden: `flex: 0 0 0 !important; min-width: 0 !important; overflow: hidden`
- Splitter between editor and preview: `#studioSplitter`

---

## 7. STUDIO PREVIEW PANEL

| Property | Value |
|----------|-------|
| DOM ID | `studioPreviewPanel` |
| CSS class (hidden) | `.s-hidden` |
| Default width | `flex: 1` (remaining space after editor) |
| Min width | 300px (CSS), 200px (splitter JS: studio.js:1467) |
| Max width | none explicit |
| Toggle button | `#studioPreviewToggleBtn` |

### Behavior
- **Toggle**: `studioTogglePanel('preview')` (studio.js:1901) — toggles `.s-hidden`
- When hidden: `flex: 0 0 0 !important; min-width: 0 !important; overflow: hidden`

---

## 8. STUDIO AI PANEL

| Property | Value |
|----------|-------|
| DOM ID | `studioAiPanel` |
| CSS class (open) | `.open` |
| Default closed state | `width: 0; min-width: 0` |
| Default open width | 340px |
| Min width | 260px (CSS and JS: studio.js:1505) |
| Max width | 520px (JS: studio.js:1506) |
| CSS transition | `0.28s` on width |
| Drag handle | `#studioSideDrag` (left edge) |

### Behavior
- **Toggle**: `studioToggleAiPanel()` (studio.js:1918) — toggles `.open`, clears inline width on close
- **Drag**: `studioInitSideDrag()` (studio.js:1497) — drag left edge to resize

---

## 9. STUDIO SPLITTER (Editor ↔ Preview divider)

| Property | Value |
|----------|-------|
| DOM ID | `studioSplitter` |
| CSS class (dragging) | `.dragging` |
| CSS class (one panel hidden) | `.s-solo` |
| Width | 5px |
| Cursor | `col-resize` |

### Behavior
- `studioInitSplitter()` (studio.js:1459)
- Dragging sets `flexBasis` percentage on editor panel
- minLeft: 200px, minRight: 200px
- When one panel is hidden (`.s-solo`), splitter gets `display: none`

---

## 10. MUTUAL PANEL INTERACTIONS

### _syncWorkspacePanels() — The Central Orchestrator

Location: `output.js:349`

Called after every panel open/close/resize. It:
1. Reads open/closed state of all three right-side panels (Output, Preview, Browser)
2. Clears `style.width` on closed panels (critical fix: inline width outranks CSS `width: 0`, so a panel resized once would fail to close without this)
3. Shows/hides the edge toggle button (shown when output is closed)
4. Shows/hides resize handles (only visible when the corresponding panel is open)
5. Calls `_refreshWorkspacePanelsBusy()`
6. Calls `refreshPanelContextStatus()`

### _initPanelStateSync() — MutationObserver

Location: `output.js:394`

Watches `class` and `style` attribute changes on all three right-side panel elements.
Any change triggers `_syncWorkspacePanels()` automatically.
Also listens to `window.resize`.

### _refreshWorkspacePanelsBusy() — Chat Collapse

Location: `output.js:633`

When 2+ right-side panels are open simultaneously:
- `.workspace` gets `.panels-busy` class
- Main chat shrinks to `flex: 0 0 280px` — a fixed 280px strip
- Chat log, header, toolbar, and welcome state get `display: none !important`
- Only the compose input remains visible
- A "Chat" label is injected via `::before` pseudo-element (amber text, uppercase, 10px)

When 1 or 0 panels are open, `.panels-busy` is removed and chat returns to normal.

### Focus Mode

`.workspace.focus-mode` — hides sidebar AND output panel entirely.
Exit button appears at fixed position top-right (`z-index: 90`).
Toggled via `toggleFocusMode()`.

### Studio View Enter/Exit

When entering studio view (`studioShowView()`, studio.js:1371):
- Hides all chat UI elements
- Saves output + browser panel open state to `_stPrevOpen`
- Closes output and browser panels

When exiting studio view (`studioHideView()`, studio.js:1431):
- Restores chat UI
- Re-opens output/browser if they were previously open

---

## 11. RESIZE HANDLE MECHANICS

### Right-side panels (Output, Preview, Browser)

All three use the same `_initHorizResize(handleId, panelId)` function (output.js:414).

- Handle width: 5px (`output-resize-handle` CSS)
- Handle shows a vertical bar (`::after`: 3px wide, 40px tall) on hover/drag
- **Drag direction**: dragging LEFT = panel GROWS (`delta = startX - e.clientX`)
- Body gets `cursor: col-resize; user-select: none` during drag
- Body gets `.is-panel-resizing` during drag — disables iframe pointer events
- Panel gets `.resizing` during drag — disables CSS transitions
- Cleanup on: mouseup, blur, visibilitychange (tab switch)

### Sidebar

Separate implementation in `initSidebarResize()` (tabs.js:379).
Drag direction: dragging right = sidebar grows.
Constraints: min 220px, max 540px.

### Studio AI Panel

`studioInitSideDrag()` (studio.js:1497) — drag left edge.
Constraints: min 260px, max 520px.

### Studio Splitter

`studioInitSplitter()` (studio.js:1459) — drag center divider.
Works with flexBasis percentages. minLeft: 200px, minRight: 200px.

---

## 12. Z-INDEX STACKING

```
110   #outputEdgeToggle (edge toggle button, always on top)
100   .sidebar (mobile overlay mode)
 90   .focus-exit-btn, .output-panel (mobile)
 55   .meshy-studio
 50   .sh-rec-btn (preview recorder)
 20   .output-resize-handle, .sidebar-resize-handle
  8   .browser-header
  5   .vw-edge-resize
```

---

## 13. WHAT IS NOT PERSISTED

| State | Persisted? |
|-------|-----------|
| Sidebar open/closed | No |
| Sidebar width | No |
| Output panel open/closed | No (45s volatile suppression timer only) |
| Output panel width | No |
| Preview panel open/closed | No |
| Preview panel width | No |
| Browser panel open/closed | No |
| Browser panel width | No |
| Studio editor/preview split ratio | No |
| Studio AI panel open/closed | No |
| Dark mode | Yes (`localStorage: OliviaLegal.darkMode`) |
| Panel context selection | Yes (`panelContextPrefKey` in stream.js) |
| Doc tree expansion | Yes (`localStorage: olivia.docs.openDirs`) |

---

## 14. KEY FILE INDEX

| File | What it controls |
|------|-----------------|
| `frontend/css/output-panel.css` | Output panel + resize handle styles |
| `frontend/css/output-toggle-panel.css` | Edge toggle button (fixed right edge) |
| `frontend/css/browser-panel.css` | Browser panel styles |
| `frontend/css/sidebar.css` | Sidebar styles |
| `frontend/css/section-views.css` | Panel ordering, `.panels-busy` chat collapse |
| `frontend/css/base.css` | Studio panels, focus mode, mobile panel hiding |
| `frontend/css/responsive.css` | Tablet/mobile panel overrides |
| `frontend/js/modules/output.js` | Output/Browser panel toggles, resize, sync, busy |
| `frontend/js/modules/docs.js` | Preview panel toggle, content rendering, file type dispatch |
| `frontend/js/modules/studio.js` | Studio panels, splitter, side drag, view enter/exit |
| `frontend/js/sidebar/tabs.js` | Sidebar toggle, resize, mobile behavior |

---

## 15. KNOWN ISSUES / REFINEMENT OPPORTUNITIES

1. **No state persistence** — all panel widths and open/closed states are lost on refresh. Only dark mode, doc tree, and panel context survive.
2. **Inline width bug** — closed panels retained stale `style.width` which prevented CSS `width: 0` from collapsing them. Fixed in `_syncWorkspacePanels()` by clearing inline width on closed panels.
3. **Preview panel uses display:none** — unlike Output and Browser panels which use `width: 0`, the Preview panel uses `display: none` when closed. This means it can't use CSS transitions for smooth open/close.
4. **Three panels, one physical space** — Output, Preview, and Browser share the same right-side area but have no mutual exclusion. Users can open all three simultaneously, which triggers the `panels-busy` chat collapse but the panels themselves compete for width.
5. **Mobile panels disabled** — Output and Browser panels are `display: none !important` on mobile (<=768px). Only the Output panel has a tablet fallback (slides up from bottom).
6. **No minimum window width enforcement for panels** — if the window is resized very narrow while multiple panels are open, there's no logic to auto-close panels. The flex layout handles it with `flex-shrink: 0` on panels, so they maintain their widths and the main content area shrinks instead.
7. **Edge toggle only for output panel** — the preview and browser panels don't have edge toggle buttons. Users must open them from toolbar buttons or other triggers.
