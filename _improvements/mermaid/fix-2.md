Nice catch on the sequence — and this one's a single root cause that explains both symptoms.

## Root cause

`_prepareMermaidExportSvg` (docs.js) and `_mmdPrepareExportSvg` (mermaid.js) — the function both export paths call before serializing — operates on the **live SVG node**, not a copy:

```js
function _prepareMermaidExportSvg(svgEl) {
  return new Promise(resolve => {
    ...
    const host = _mermaidExportHostEl();
    if (!host) { resolve(svgEl); return; }
    host.appendChild(svgEl);          // <-- rips the REAL svg out of .mermaid-body
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        try {
          _convertMermaidForeignObjects(svgEl);
          _flattenMermaidStyles(svgEl);
        } catch (_) { }
        if (svgEl.parentNode) svgEl.parentNode.removeChild(svgEl);  // <-- removed from host, never put back anywhere
        resolve(svgEl);
      });
    });
  });
}
```

`host.appendChild(svgEl)` moves (not clones) the node your diagram is actually made of into the hidden offscreen host for style-flattening. Once processing finishes, it's removed from the host — but it's never re-appended to `.mermaid-body`. The node is now fully detached, alive only as the `prepared` value used to build the download. That's why the container goes empty after export, and reopening the file works (fresh render creates a new SVG node).

The expand-button black view is a downstream consequence: `_openMermaidFullView` does `mermaidContainer.querySelector('svg')` — which now returns `null` because the SVG is gone — so nothing gets cloned into the fullscreen overlay. The faint shapes in your second screenshot are just the (still-broken) page behind the overlay bleeding through its `rgba(0,0,0,.82)` background, not overlay content.

## Fix

Same bug, duplicated in both files. Clone before moving into the host, so the original stays put:

**`docs.js` — `_prepareMermaidExportSvg`:**
```js
function _prepareMermaidExportSvg(svgEl) {
  return new Promise(resolve => {
    if (!svgEl) { resolve(svgEl); return; }
    const clone = svgEl.cloneNode(true);   // work on a copy — never touch the live node
    if (typeof window.getComputedStyle !== 'function' || typeof requestAnimationFrame !== 'function') {
      resolve(clone);
      return;
    }
    const host = _mermaidExportHostEl();
    if (!host) { resolve(clone); return; }
    host.appendChild(clone);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        try {
          _convertMermaidForeignObjects(clone);
          _flattenMermaidStyles(clone);
        } catch (_) { /* leave as-is */ }
        if (clone.parentNode) clone.parentNode.removeChild(clone);
        resolve(clone);
      });
    });
  });
}
```

**`mermaid.js` — `_mmdPrepareExportSvg`:** identical change (clone first, operate on `clone`, resolve `clone`):
```js
function _mmdPrepareExportSvg(svgEl) {
  return new Promise(resolve => {
    if (!svgEl) { resolve(svgEl); return; }
    const clone = svgEl.cloneNode(true);
    if (typeof window.getComputedStyle !== 'function' || typeof requestAnimationFrame !== 'function') {
      resolve(clone);
      return;
    }
    const host = _mmdExportHostEl();
    if (!host) { resolve(clone); return; }
    host.appendChild(clone);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        try {
          _mmdConvertForeignObjects(clone);
          _mmdFlattenStyles(clone);
        } catch (_) { }
        if (clone.parentNode) clone.parentNode.removeChild(clone);
        resolve(clone);
      });
    });
  });
}
```

No changes needed in `_exportMermaidSvg`/`_exportMermaidPng` (or their `_mmd*` twins) — they already just take whatever `_prepareMermaidExportSvg` resolves with and serialize/rasterize it. A detached clone is exactly what serialization needs; it just should never have been the *only* copy.

Once this lands, the on-screen diagram survives export (live node is never removed), and the expand button keeps working afterward since `mermaidContainer.querySelector('svg')` will still find it.

One thing to verify after patching: `_mermaidSvgSize`/`_mmdSvgSize` falls back to `getBoundingClientRect()` when there's no `viewBox` — that's harmless here since Mermaid always emits a `viewBox`, but worth a quick sanity check on your actual diagrams if you ever see a PNG export come out at the 1200×800 fallback size.