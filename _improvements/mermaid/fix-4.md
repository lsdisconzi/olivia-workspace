Good — that reframes it. If it's *never* worked, the collision fix wasn't the cause (both duplicate implementations share the same underlying defect). Here's what's actually happening, and it's a CSS+JS pairing issue, not CSS alone — but your ask to check the CSS pointed me at the real symptom.

## Root cause

Look at what sizes the SVG in fullscreen. The CSS gives it no explicit `width`/`height` (correctly — it can't know the diagram's size ahead of time):

```css
.mermaid-fullscreen-diagram svg{
  max-width:none;max-height:none;flex-shrink:0;
  background:#ffffff;
  border-radius:8px;
  box-shadow:0 8px 40px rgba(0,0,0,.3);
}
```

...and the JS (identically in both `_openMermaidFullView` and `_mmdOpenFullView`) sets:

```js
clonedContent.removeAttribute('width');
clonedContent.removeAttribute('height');
clonedContent.style.maxWidth = 'none';
clonedContent.style.width = 'auto';
clonedContent.style.height = 'auto';
```

An `<svg>` that has only a `viewBox` (no `width`/`height` attributes) and `width:auto;height:auto` in CSS, placed as a flex item inside `.mermaid-fullscreen-diagram{display:flex}`, computes to **0×0** in Chromium/WebKit. Flex's auto-sizing algorithm needs a definite content size or explicit dimensions to size a replaced element like `<svg>`; a bare intrinsic-ratio-only SVG doesn't provide one, so the flex item collapses. Nothing renders because there's literally no area to paint into — you just see the overlay's own `rgba(0,0,0,.82)` backdrop. That's exactly "black view," and exactly why it's never worked: this was broken from day one, independent of the export bug or the collision.

Secondary issue, my mistake from last message: forcing `background:#ffffff` fights the dark-theme Mermaid colors (`primaryTextColor:'#d4cfc8'`, `lineColor:'#8a9a8a'`) — even once sized correctly, light-on-white would be nearly invisible. Reverting that.

## Fix

**CSS** — drop the forced white background, add a collapse safety net:
```css
.mermaid-fullscreen-diagram svg{
  max-width:none;max-height:none;flex-shrink:0;
  min-width:200px;min-height:120px;   /* guards against 0×0 flex collapse */
  background:var(--bg-card);           /* keeps light-on-dark diagram text legible */
  border-radius:8px;
  box-shadow:0 8px 40px rgba(0,0,0,.3);
}
```

**JS — both `docs.js` and `mermaid.js`.** Give the clone real pixel dimensions instead of `auto`, reusing the same viewBox-based sizing already used for PNG export:

`docs.js` — inside `_docsOpenMermaidFullView` (the renamed function from last message):
```js
if (contentEl) {
  clonedContent = contentEl.cloneNode(true);
  if (isSvg) {
    // viewBox-only SVGs collapse to 0×0 as a flex item — size explicitly,
    // same sizing logic already used for PNG export.
    const size = _mermaidSvgSize(contentEl);
    clonedContent.removeAttribute('width');
    clonedContent.removeAttribute('height');
    clonedContent.style.maxWidth = 'none';
    clonedContent.style.width = size.width + 'px';
    clonedContent.style.height = size.height + 'px';
  }
  diagramBox.appendChild(clonedContent);
} else {
  diagramBox.innerHTML = mermaidContainer.innerHTML;
}
```

`mermaid.js` — same change inside `_mmdOpenFullView`, just swap the helper name:
```js
const size = _mmdSvgSize(contentEl);
clonedContent.removeAttribute('width');
clonedContent.removeAttribute('height');
clonedContent.style.maxWidth = 'none';
clonedContent.style.width = size.width + 'px';
clonedContent.style.height = size.height + 'px';
```

Note `contentEl` here (not `clonedContent`) — pass the original, still-attached SVG into the sizing function, since `_mermaidSvgSize`/`_mmdSvgSize` fall back to `getBoundingClientRect()` when there's no `viewBox`, and that only works reliably on an element still in the live DOM.

With explicit pixel dimensions, the element has real area to paint into, the zoom controls' `scale(1)` baseline now means something concrete (100% = actual diagram px size, matching what export produces), and pan/zoom should behave predictably from the first open.