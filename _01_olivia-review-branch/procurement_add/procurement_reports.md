No files were actually uploaded — the code was just pasted as text — so here's the fix directly.

**The problem:** in the split view, `.pr-split-left` centers the image with `object-fit: contain` (so a portrait invoice photo shrinks to fit, often leaving empty space around it), while `.pr-split-right` just lets markdown flow at normal text size for however long it is. The two panes end up wildly mismatched in visual "weight," which defeats the point of a side-by-side compare.

**The fix:** wrap the markdown in a "page" element that mirrors the image's actual aspect ratio (measured via JS on load), and size the two panes identically. Now both panes render as same-sized document pages, so scanning left-to-right for a mismatch is much easier.

### 1. CSS — replace the split-pane rules

```css
.pr-doc-pane-split {
    display: none; width: 100%; height: 100%; flex-direction: row; gap: 16px;
    --pr-split-ratio: 0.7071; /* fallback ~A4 portrait, overridden per-image via JS */
}
.pr-doc-pane-split.active { display: flex; flex-direction: row; }
.pr-split-left {
    flex: 1; min-width: 0; height: 100%;
    display: flex; align-items: center; justify-content: center;
    border-right: 1px solid var(--border); padding-right: 16px;
}
.pr-split-right {
    flex: 1; min-width: 0; height: 100%; overflow: hidden;
    display: flex; align-items: flex-start; justify-content: center;
    padding-left: 16px;
}
/* The "page" mirrors the image pane's aspect ratio, so the rendered markdown
   occupies roughly the same footprint as the source document for easy compare. */
.pr-split-page {
    width: 100%;
    max-width: 100%;
    height: 100%;
    max-height: 100%;
    aspect-ratio: var(--pr-split-ratio, 0.7071);
    overflow-y: auto;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--r);
    padding: 18px 20px;
    box-sizing: border-box;
}
.pr-split-right .pr-doc-md {
    max-width: none;
    font-size: 12.5px;
    line-height: 1.6;
    color: var(--gray-hi);
}
.pr-split-right .pr-doc-md h1,
.pr-split-right .pr-doc-md h2,
.pr-split-right .pr-doc-md h3 {
    font-size: 13.5px;
}
```

Optional but recommended — stack the panes on narrow screens instead of squeezing two "pages" side by side, inside your existing `@media (max-width: 720px)` block:

```css
@media (max-width: 720px) {
    .pr-doc-pane-split.active { flex-direction: column; }
    .pr-split-left  { border-right: none; border-bottom: 1px solid var(--border); padding-right: 0; padding-bottom: 12px; height: 45%; }
    .pr-split-right { padding-left: 0; padding-top: 12px; height: 55%; }
}
```

### 2. JS — measure the image and pass the ratio through

In `procurementViewDocument`, change the split-pane block from:

```js
if (doc.text_md && (doc.image_url || doc.kind === 'pdf')) {
    html += '<div class="pr-doc-pane pr-doc-pane-split" data-pane="split">';
    html += '<div class="pr-split-left">';
    if (doc.kind === 'pdf') {
        html += '<iframe src="' + esc(doc.image_url) + '" class="pr-modal-frame" title="' + esc(doc.filename) + '"></iframe>';
    } else {
        html += '<img src="' + esc(doc.image_url) + '" alt="' + esc(doc.filename) + '" class="pr-modal-img">';
    }
    html += '</div>';
    html += '<div class="pr-split-right"><div class="pr-md pr-doc-md">' + renderMd(doc.text_md) + '</div></div>';
    html += '</div>';
}
```

to:

```js
if (doc.text_md && (doc.image_url || doc.kind === 'pdf')) {
    html += '<div class="pr-doc-pane pr-doc-pane-split" data-pane="split">';
    html += '<div class="pr-split-left">';
    if (doc.kind === 'pdf') {
        html += '<iframe src="' + esc(doc.image_url) + '" class="pr-modal-frame" title="' + esc(doc.filename) + '"></iframe>';
    } else {
        html += '<img src="' + esc(doc.image_url) + '" alt="' + esc(doc.filename) + '" class="pr-modal-img" onload="procurementSyncSplitPane(this)">';
    }
    html += '</div>';
    html += '<div class="pr-split-right"><div class="pr-split-page"><div class="pr-md pr-doc-md">' + renderMd(doc.text_md) + '</div></div></div>';
    html += '</div>';
}
```

Then add the sync helper and hook it into tab switching:

```js
// Keep the rendered markdown "page" sized to match the source image, so the
// two panes read as comparable documents rather than mismatched columns.
window.procurementSyncSplitPane = function (img) {
    try {
        var pane = img.closest('.pr-doc-pane-split');
        if (!pane || !img.naturalWidth || !img.naturalHeight) return;
        pane.style.setProperty('--pr-split-ratio', (img.naturalWidth / img.naturalHeight).toFixed(4));
    } catch (_e) { /* noop */ }
};

window.procurementSwitchTab = function(btn, paneName) {
    var viewer = btn.closest('.pr-doc-viewer');
    if (!viewer) return;

    var tabs = viewer.querySelectorAll('.pr-doc-tab');
    tabs.forEach(function(t) { t.classList.remove('active'); });
    btn.classList.add('active');

    var panes = viewer.querySelectorAll('.pr-doc-pane');
    panes.forEach(function(p) {
        if (p.getAttribute('data-pane') === paneName) {
            p.classList.add('active');
        } else {
            p.classList.remove('active');
        }
    });

    if (paneName === 'split') {
        var img = viewer.querySelector('.pr-doc-pane-split .pr-split-left img');
        if (img && img.complete) procurementSyncSplitPane(img);
    }
};
```

Why this works: `--pr-split-ratio` is set as a CSS custom property on the wrapping `.pr-doc-pane-split`, computed once the actual invoice image loads (`naturalWidth / naturalHeight`). The `.pr-split-page` on the right then uses `aspect-ratio: var(--pr-split-ratio)`, so it takes on the same proportions as the real image — a portrait invoice photo gets a portrait markdown page, a landscape scan gets a landscape one. Font size is dialed down slightly (12.5px vs. the default 14px) so more text fits per "page," closer to the information density of the image itself. PDFs fall back to a standard A4-ish ratio (0.7071) since there's no easy client-side way to read PDF page dimensions here — good enough for the vast majority of invoices.