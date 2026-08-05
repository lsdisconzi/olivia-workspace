# Olivia Panels — Implementation Proposals

> Response to `olivia-panels-review.md`. Each proposal includes concrete approach, files touched,
> and estimated scope. Ordered by review priority.

---

## Proposal A — Fix `.panels-busy` chat collapse (Priority 1.1)

**Problem:** When 2+ right panels are open, the chat becomes a 280px strip showing only the
compose input. The message log, header, toolbar, and welcome state all get `display: none
!important`. It reads as broken, not minimized.

**Approach:** Replace the compose-only strip with a genuine minimized chat that shows:
- The last message (truncated to one line)
- A "N messages" badge
- The compose input at the bottom

**Files touched:**
- `frontend/css/section-views.css` (lines 21-30) — rewrite `.panels-busy` rules
- `frontend/js/modules/output.js` (line 633) — optionally add JS to populate the last-message
  preview, or do it purely in CSS

**CSS-only version (cheapest):**

```css
/* Replace the current .panels-busy block (section-views.css:21-30) with: */
.workspace.panels-busy .main-content {
  flex: 0 0 280px;
  min-width: 0;
}
.workspace.panels-busy .main-content > .chat-header,
.workspace.panels-busy .main-content > #chatHeader,
.workspace.panels-busy .main-content > #chatToolbar,
.workspace.panels-busy .main-content > .welcome-state,
.workspace.panels-busy .main-content > #welcomeState {
  display: none !important;
}
/* Keep the log, but collapse it to show only the last message */
.workspace.panels-busy .main-content > .chat-log,
.workspace.panels-busy .main-content > #chatLog {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 8px 12px;
}
.workspace.panels-busy .chat-log .message:not(:last-child),
.workspace.panels-busy #chatLog .message:not(:last-child) {
  display: none;
}
.workspace.panels-busy .chat-log .message:last-child,
.workspace.panels-busy #chatLog .message:last-child {
  opacity: 0.65;
  max-height: 60px;
  overflow: hidden;
}
/* Replace the ::before "Chat" label with something more useful */
.workspace.panels-busy .main-content::before {
  content: 'Chat (minimized)';
  display: block;
  padding: 6px 14px;
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--amber);
  border-bottom: 1px solid var(--border);
  background: var(--bg-card);
}
```

**Scope:** ~20 lines changed in one CSS file. No JS changes needed.

---

## Proposal B — Unify Preview onto `width: 0` (Priority 2.2)

**Problem:** Preview uses `display: none` when closed, unlike Output and Browser which use
`width: 0`. This forces a 10ms/300ms timeout choreography in `togglePreviewPanel()` instead of a
CSS transition.

**Approach:**
1. Add to `frontend/css/output-panel.css` or a shared location:
   ```css
   #previewPanel {
     width: 0;
     min-width: 0;
     overflow: hidden;
     flex-shrink: 0;
     display: flex;          /* always flex, never display:none */
     flex-direction: column;
     transition: width 220ms cubic-bezier(.4,0,.2,1);
   }
   #previewPanel.open {
     width: 440px;
     min-width: 240px;
   }
   ```
2. Rewrite `togglePreviewPanel()` in `docs.js` (lines 1087-1130):
   ```js
   window.togglePreviewPanel = function(show) {
     const panel = document.getElementById('previewPanel');
     const handle = document.getElementById('previewResizeHandle');
     if (!panel) return;
     if (show === undefined) show = !panel.classList.contains('open');

     // Clear any stale inline width so CSS takes over
     if (!show && panel.style.width) panel.style.width = '';

     panel.classList.toggle('open', show);

     if (typeof window.syncWorkspacePanels === 'function') {
       window.syncWorkspacePanels();
     } else {
       if (handle) handle.classList.toggle('visible', show);
       if (typeof window._refreshWorkspacePanelsBusy === 'function') {
         window._refreshWorkspacePanelsBusy();
       }
     }
   };
   ```
3. Remove `_previewPanelOpenTimer` and `_previewPanelCloseTimer` variables and all their
   clearTimeout/setTimeout logic.

**Files touched:**
- `frontend/css/output-panel.css` — add `#previewPanel` rules (~8 lines)
- `frontend/js/modules/docs.js` — simplify `togglePreviewPanel()` (~20 lines removed, ~15 added)

**Scope:** Small. Removes a timing hack, makes Preview consistent with siblings.

---

## Proposal C — Unified panel transition (Priority 2.1)

**Problem:** Three different transition values: `none` (Output), `0.3s ease` (Browser), `0.28s`
(Studio AI), plus Preview's JS timeout sequence.

**Approach:** Define a shared token and apply it to all four panels.

1. Add to `frontend/css/output-panel.css`:
   ```css
   :root {
     --panel-transition: 220ms cubic-bezier(.4, 0, .2, 1);
   }
   ```
2. Update each panel's open-state CSS:
   - `.output-panel.open` → add `transition: width var(--panel-transition)` (currently `none`)
   - `.browser-panel` → change `transition: width .3s ease` to `width var(--panel-transition)`
   - `#previewPanel` → already handled in Proposal B above
   - `.studio-ai-panel` → change `transition` to `width var(--panel-transition)`

**Files touched:**
- `frontend/css/output-panel.css` — add token, update Output + Preview
- `frontend/css/browser-panel.css:2` — update Browser
- `frontend/css/base.css` (around line 2970) — update Studio AI

**Scope:** 5 lines across 3 CSS files. Cheapest change with most felt impact.

---

## Proposal D — Right-dock single-slot or LRU cap (Priority 1.2)

**Problem:** Output, Preview, and Browser can all be open simultaneously, competing for width and
triggering the `.panels-busy` emergency mode.

**Approach — LRU cap at 2 (smaller version):**

When a third right-side panel opens, auto-close the one that was opened longest ago.

1. Add a tracker in `output.js`:
   ```js
   var _rightPanelOrder = []; // ['output', 'preview', 'browser'] in open order
   var _RIGHT_PANEL_MAX = 2;
   ```
2. In each open function (`toggleOutputPanel`, `openBrowserPanel`, `togglePreviewPanel`), after
   opening, call `_enforceRightPanelCap()`:
   ```js
   function _enforceRightPanelCap() {
     var ids = ['outputPanel', 'previewPanel', 'browserPanel'];
     var openNow = ids.filter(function(id) {
       var el = document.getElementById(id);
       return el && el.classList.contains('open');
     });
     if (openNow.length <= _RIGHT_PANEL_MAX) return;

     // Close the LRU panel (first in _rightPanelOrder that's not the current one)
     // ... implementation
   }
   ```
3. Track open order by updating `_rightPanelOrder` whenever a panel opens.

**Files touched:**
- `frontend/js/modules/output.js` — add `_rightPanelOrder` tracking and enforcement
- `frontend/js/modules/docs.js` — notify output.js when preview opens (already calls
  `syncWorkspacePanels`, can extend that)

**Scope:** Medium. ~40 lines of JS, touches two modules. If done well, `.panels-busy` becomes a
true edge case (triggered only when the user explicitly chooses 2-panel mode).

---

## Proposal E — Persist panel state (Priority 3.1)

**Problem:** Panel widths and open/closed state reset on every refresh. Only dark mode and
doc-tree expansion persist.

**Approach:** Extend the existing `localStorage` pattern. Start with the highest-value surface
area: sidebar width, output panel visibility, last-open right-dock panel.

```js
// In output.js, after initOutputResize():
var PANEL_STATE_KEY = 'olivia.panelState';

function _loadPanelState() {
  try {
    var state = JSON.parse(localStorage.getItem(PANEL_STATE_KEY));
    if (!state) return;

    // Restore sidebar width
    if (state.sidebarWidth) {
      var sb = document.getElementById('sidebarEl');
      if (sb) sb.style.width = state.sidebarWidth + 'px';
    }

    // Restore last-open right panel
    if (state.rightPanelOpen && state.rightPanelOpen !== 'none') {
      if (state.rightPanelOpen === 'output') toggleOutputPanel();
      else if (state.rightPanelOpen === 'browser') openBrowserPanel();
      // Preview restored on-demand when file is opened
    }
  } catch (_) {}
}

function _savePanelState() {
  try {
    var state = {};
    var sb = document.getElementById('sidebarEl');
    if (sb) state.sidebarWidth = sb.offsetWidth;
    // ... save which right panel is open, its width
    localStorage.setItem(PANEL_STATE_KEY, JSON.stringify(state));
  } catch (_) {}
}
```

Debounce the save (200ms) and call it from `_syncWorkspacePanels()`.

**Files touched:**
- `frontend/js/modules/output.js` — add load/save functions, wire into sync
- `frontend/js/sidebar/tabs.js` — notify output.js on sidebar resize

**Scope:** Medium. ~60 lines of JS. High user-perceived value.

---

## Proposal F — Z-index scale documentation (Priority 2.4)

**Problem:** Z-index values (110, 100, 90, 55, 50, 20, 8, 5) have no visible logic. The next
developer adding a floating element has to guess.

**Approach:** Define a scale and document it. No code changes to existing values — just label the
tiers.

Add to `frontend/css/base.css`:
```css
/*
 * Z-INDEX SCALE — reserved ranges:
 *   0–9    Base content, iframes
 *   10–29  Resize handles (sidebar, panels, splitter)
 *   30–59  Floating UI (meshy studio, preview recorder)
 *   60–89  Mode overlays (focus mode exit button)
 *   90–109 Mobile overlays (sidebar overlay, bottom sheet panels)
 *   110+   Always-on-top controls (edge toggle)
 */
```

**Files touched:**
- `frontend/css/base.css` — add comment block at top

**Scope:** Trivial. One comment block. Zero behavior change.

---

## Proposal G — Shared sizing constants (Priority 2.3)

**Problem:** Min-width values (220, 200, 240, 260) are scattered across four files with no
documentation of which are intentional and which are copy-paste drift.

**Approach:** Pull them into a single JS config object in `output.js` (already the panel
orchestrator), reference them everywhere.

```js
// In output.js, near the top:
var PANEL_SIZING = {
  // Right-side panels (output, preview, browser)
  rightPanelDefaultWidth: 440,
  rightPanelMinWidth: 220,      // was scattered: 220/240 — unify to 220 JS, 240 CSS
  rightPanelMaxWidthRatio: 0.9, // fraction of viewport width

  // Sidebar
  sidebarDefaultWidth: 300,
  sidebarMinWidth: 220,
  sidebarMaxWidth: 540,

  // Studio AI
  studioAiDefaultWidth: 340,
  studioAiMinWidth: 260,        // intentional: needs more room than right panels
  studioAiMaxWidth: 520,

  // Studio splitter
  studioSplitterMinLeft: 200,   // intentional: code editor floor
  studioSplitterMinRight: 200,
};
```

Then update call sites:
- `_initHorizResize` → read `minW` from `PANEL_SIZING.rightPanelMinWidth`
- `initSidebarResize` → read from `PANEL_SIZING.sidebarMinWidth` / `sidebarMaxWidth`
- `studioInitSideDrag` → read from `PANEL_SIZING.studioAi*`
- `studioInitSplitter` → read from `PANEL_SIZING.studioSplitter*`

**Files touched:**
- `frontend/js/modules/output.js` — add config object, update `_initHorizResize`
- `frontend/js/sidebar/tabs.js` — import/reference constants
- `frontend/js/modules/studio.js` — import/reference constants

**Scope:** Small-medium. ~30 lines added, ~10 lines changed. Catches drift before it spreads.

---

## If only three things happen (matching the review's bottom line)

| # | Proposal | Lines | Files | User impact |
|---|----------|-------|-------|-------------|
| 1 | A — Fix `.panels-busy` collapse | ~20 CSS | 1 | No more "broken" state |
| 2 | B — Unify Preview onto `width: 0` | ~35 JS/CSS | 2 | Consistent close, removes hacks |
| 3 | C — Unified transition timing | ~5 CSS | 3 | "Feels like one thing" |

**Total: ~60 lines across 4 files.** Everything else (D-G) compounds from there.
