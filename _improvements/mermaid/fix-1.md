Looking at the screenshots, a few things are going on:

- The blank space in image 1/2 and the white box with a download icon + resize corner in image 2/3 is almost certainly an `<iframe>` — in your CSS, white background (`background:#fff`) only ever gets applied to iframes (`.output-body iframe`, `.mermaid-fullscreen-diagram iframe`). Nothing else in this file renders white on a dark panel. That tells me the mermaid diagram for the *inline* (non-fullscreen) view is being dropped into an iframe with no sizing rule constraining it outside fullscreen mode — so it's falling back to whatever height the script that builds it happens to set, and the resize handle you're seeing is the raw browser resize-corner on an unstyled resizable box inside that iframe/container.
- Two bugs I *can* pin down directly from what you gave me:

**1. The output/preview/browser panels are hard-capped well under 90%**

CSS:
```css
.output-panel.open{width:440px;min-width:240px;max-width:min(72vw,920px);transition:none}
```
JS (`_initHorizResize`, used by all three side panels):
```js
const maxW = Math.max(minW, Math.floor(window.innerWidth * 0.72));
```
Both cap the drag at 72vw *and* 920px, whichever is smaller — so on a big screen you never even get to 72%. Fix:
```css
.output-panel.open{width:440px;min-width:240px;max-width:min(90vw,1600px);transition:none}
```
```js
const maxW = Math.max(minW, Math.floor(window.innerWidth * 0.9));
```
Apply the same `72vw/920px → 90vw/1600px` swap to any equivalent rule you have for `.preview-panel.open` / `.browser-panel.open` if they're defined separately elsewhere — this file only shows the output-panel one explicitly.

**2. The mermaid SVG is force-capped to 50px tall**
```css
.mermaid-container svg{max-width:100%;height: 50px;}
```
This alone would badly squash any diagram. Combined with a container that has no height constraint of its own, you get the "tiny diagram + huge dead space" look. Replace with a proper resizable box:

```css
.mermaid-container{
  display:flex;justify-content:center;margin:14px 0;padding:10px;
  background:rgba(255,255,255,.015);border:1px solid var(--border);
  border-radius:10px;position:relative;overflow:hidden; /* clips body to rounded corners */
}

/* the actual scrollable/resizable viewport, separate from the button toolbar */
.mermaid-body{
  width:100%;
  overflow:auto;
  resize:vertical;              /* user-draggable */
  min-height:180px;
  max-height:75vh;
  height:clamp(240px, 42vw, 600px); /* fits most diagrams on first load, no scroll needed */
}

.mermaid-body svg{
  max-width:none;
  width:100%;
  height:auto;
  display:block;
}
```

**Buttons:** your existing rules are already correct for "pinned top-right, independent of content height" —
```css
.mermaid-expand-btn{position:absolute;top:8px;right:8px;...}
.mermaid-export-wrap{position:absolute;top:8px;right:44px;...}
```
— but that only works if they're DOM siblings of `.mermaid-body` inside `.mermaid-container` (not children of the scrollable body itself). If they're currently children of the scrollable/iframe content, they'll scroll away with it, which is exactly the "export button ends up at the bottom" symptom you're seeing.

That last part — and the white iframe box — is the piece I can't fix blind: the actual DOM/JS that builds `.mermaid-container`'s contents (mermaid init, the iframe, the toolbar buttons) isn't in either file you shared here (this CSS file and `output.js`/panel-management only). It's probably in something like a `mermaid-render.js` or wherever `renderRichMarkdownHtml` post-processes mermaid code blocks.


Now that I have the actual rendering code, I can point to the exact bug instead of guessing.

## The root cause

`mermaid.js`'s `_mmdRenderDiagram` initializes the shared Mermaid instance like this:

```js
mermaid.initialize({
  startOnLoad: false,
  theme: _MMD_THEME,
  ...
  securityLevel: 'sandbox',
});
```

With `securityLevel: 'sandbox'`, `mermaid.render()` doesn't return raw `<svg>` markup — it returns an `<iframe>` (a sandboxed data-URL wrapper around the SVG). `_mmdRenderDiagram` knows this and handles it correctly:

```js
const holder = document.createElement('div');
holder.innerHTML = result.svg;
const svgEl = _mmdResolveSvg(holder);   // <- unwraps the iframe, extracts real <svg>
if (svgEl) {
  targetEl.innerHTML = '';
  targetEl.appendChild(svgEl);
} else { ... }
```

But `docs.js`'s `_postRenderMermaid` — which is what actually renders the diagram you're looking at in the output panel (embedded in `agent-interaction-flow-diagram.v2.md`) — does **not** do this unwrap. It just dumps the raw result:

```js
mermaid.render(id, source).then(result => {
  const wrapper = document.createElement('div');
  wrapper.className = 'mermaid-container mermaid-rendered';
  wrapper.innerHTML = result.svg;   // <- if sandboxed, this is an <iframe>, not an <svg>
  ...
```

Since `mermaid` is a single shared library instance, once anything in the app calls `_mmdRenderDiagram` and trips `window._mermaidInitialized = true` with `securityLevel: 'sandbox'`, **every subsequent render anywhere in the app** — including markdown diagrams in the output panel — comes back as an iframe. That iframe has no CSS applied to it (only `.mermaid-container svg{...}` exists, which doesn't match an `<iframe>`), so it renders at its own unconstrained intrinsic height — that's your blank white box with no visible diagram, and why the export/expand buttons (which *are* correctly positioned as absolute siblings) end up looking stranded relative to that huge empty area.

There's also a second, compounding bug: `.mermaid-container svg{height:50px}` — so even in the *non*-sandboxed path, any successfully-rendered SVG gets squashed to 50px tall.

## Fixes

### 1. `docs.js` — `_postRenderMermaid`: unwrap the sandboxed iframe on render, not just on export

You already have `_resolveMermaidSvg()` defined later in the file — it's just never called during the initial render, only inside the export-menu handler. Reuse it immediately:Right — you've pasted the code as text rather than uploading the files, so I'll give you exact patches to apply on your end.

**`docs.js` → `_postRenderMermaid`**, replace the `.then()` body:

```js
mermaid.render(id, source).then(result => {
  const wrapper = document.createElement('div');
  wrapper.className = 'mermaid-container mermaid-rendered';

  const body = document.createElement('div');
  body.className = 'mermaid-body';
  body.innerHTML = result.svg;

  // securityLevel:'sandbox' makes mermaid.render() return an <iframe>
  // instead of raw <svg>. Unwrap it now (not just at export time) so the
  // iframe's unbounded intrinsic height can't blow out the layout.
  const rawSvg = _resolveMermaidSvg(body);
  if (rawSvg) {
    body.innerHTML = '';
    body.appendChild(rawSvg);
  }
  const svgEl = body.querySelector('svg');
  if (svgEl) {
    svgEl.removeAttribute('height');
    svgEl.removeAttribute('width');
    svgEl.style.maxWidth = 'none';
    svgEl.style.width = '100%';
    svgEl.style.height = 'auto';
    svgEl.style.display = 'block';
  } else {
    // Could not unwrap (e.g. still on data-URL iframe) — at least cap it.
    const frame = body.querySelector('iframe');
    if (frame) { frame.style.width = '100%'; frame.style.height = '100%'; frame.style.border = 'none'; }
  }

  wrapper.appendChild(body);

  // Expand button
  const expandBtn = document.createElement('button');
  expandBtn.className = 'mermaid-expand-btn';
  expandBtn.innerHTML = '<i class="fas fa-expand"></i>';
  expandBtn.title = 'Open diagram in full view';
  expandBtn.setAttribute('aria-label', 'Open diagram in full view');
  wrapper.appendChild(expandBtn);

  // Export button + dropdown  (unchanged from here down — still siblings of .mermaid-body)
  const exportWrap = document.createElement('div');
  exportWrap.className = 'mermaid-export-wrap';
  // ... rest of the export button/menu code is unchanged ...
  wrapper.appendChild(exportWrap);

  preEl.parentNode.replaceChild(wrapper, preEl);

  expandBtn.addEventListener('click', e => {
    e.stopPropagation();
    e.preventDefault();
    _openMermaidFullView(wrapper);
  });
}).catch(err => {
  _showMermaidError(preEl, source, err);
});
```

Everything from `const exportWrap = ...` down to the `exportMenu.addEventListener` block stays exactly as you have it — it already operates on `wrapper`, and `_resolveMermaidSvg(wrapper)` inside it will now just find the already-unwrapped `<svg>` directly.

### 2. `mermaid.js` — `_mmdAttachToolbar`: same `.mermaid-body` wrapping, for consistency

The standalone editor panel already unwraps correctly in `_mmdRenderDiagram`, but `_mmdAttachToolbar` re-wraps without the resizable body:

```js
function _mmdAttachToolbar(container) {
  let svgEl = container.querySelector('svg');
  if (!svgEl) svgEl = _mmdResolveSvg(container);
  if (!svgEl) return;

  const wrapper = document.createElement('div');
  wrapper.className = 'mermaid-container mermaid-rendered';

  const body = document.createElement('div');
  body.className = 'mermaid-body';
  body.innerHTML = container.innerHTML;
  wrapper.appendChild(body);

  container.innerHTML = '';
  container.appendChild(wrapper);

  // expand/export button code below is unchanged
  ...
```

### 3. CSS — replace the height cap, add the resizable body, fix panel width

```css
.mermaid-container{
  display:flex;justify-content:center;margin:14px 0;padding:10px;
  background:rgba(255,255,255,.015);border:1px solid var(--border);
  border-radius:10px;overflow:hidden;position:relative;
}

.mermaid-body{
  width:100%;
  overflow:auto;
  resize:vertical;               /* user can drag to resize */
  min-height:180px;
  max-height:75vh;
  height:clamp(240px, 42vw, 600px);
}

/* was: .mermaid-container svg{max-width:100%;height: 50px;} */
.mermaid-body svg{
  max-width:none;
  width:100%;
  height:auto;
  display:block;
}
```

Keep your existing `.mermaid-expand-btn` / `.mermaid-export-wrap` rules as-is — they're already `position:absolute; top:8px; right:...` relative to `.mermaid-container`, which is correct now that `.mermaid-container`'s own height is bounded by `.mermaid-body` instead of an unconstrained iframe.

### 4. Panel horizontal resize (from before, still applies)

```css
.output-panel.open{width:440px;min-width:240px;max-width:min(90vw,1600px);transition:none}
```
```js
// in _initHorizResize, output.js
const maxW = Math.max(minW, Math.floor(window.innerWidth * 0.9));
```

## One more thing worth doing

You now have two nearly-identical copies of the mermaid render/export/fullscreen pipeline — `_postRenderMermaid`/`_resolveMermaidSvg`/etc. in `docs.js`, and `_mmdRenderDiagram`/`_mmdResolveSvg`/etc. in `mermaid.js`. This bug is a direct consequence of that duplication: the iframe-unwrap fix landed in one copy and not the other. I'd suggest extracting the shared bits (`resolveSvg`, `exportSvg`, `exportPng`, `flattenStyles`, `convertForeignObjects`, `openFullView`) into one module both files import, so a fix like this can't silently apply to only one call site again.