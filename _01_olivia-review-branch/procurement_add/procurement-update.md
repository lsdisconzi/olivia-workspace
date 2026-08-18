Looking at your code, the side-by-side feature is implemented in:

- **JS** `procurementViewDocument()` – builds the split pane
- **JS** `procurementSwitchTab()` – toggles the active pane
- **CSS** `.pr-doc-pane-split.active` and related rules

The main issue is almost certainly in the **CSS layout**. The split pane is created, but the CSS can prevent it from showing correctly side-by-side.

## Why it breaks

1. **Broad `.pr-doc-pane.active` rule**  
   ```css
   .pr-doc-pane.active { display: flex; flex-direction: column; }
   ```
   This applies to every active pane, including the split pane. The split rule:
   ```css
   .pr-doc-pane-split.active { display: flex; flex-direction: row; }
   ```
   has the same specificity, so if CSS is loaded/minified in a different order, the `column` direction can win and the two children stack vertically.

2. **Height / aspect-ratio conflict**  
   `.pr-split-page` has both:
   ```css
   height: 100%;
   aspect-ratio: var(--pr-split-ratio, 0.7071);
   ```
   When both `height` and `width` are set, `aspect-ratio` is ignored. This can cause the markdown page to collapse or not behave as expected inside the flex/grid container.

3. **Mobile media query**  
   At `max-width: 720px`, the side-by-side layout is intentionally changed to:
   ```css
   .pr-doc-pane-split.active { flex-direction: column; }
   ```
   If you are testing in a narrow browser/device, it will **not** appear side-by-side.

---

## Recommended CSS fix

Replace the relevant split-pane CSS block with this more robust version:

```css
/* Force split pane to be row-direction and always win */
.pr-doc-pane.pr-doc-pane-split.active {
    display: flex !important;
    flex-direction: row !important;
}

/* Guarantee both columns take half width and do not shrink */
.pr-split-left,
.pr-split-right {
    flex: 1 1 50%;
    min-width: 0;
    min-height: 0;
    height: 100%;
    box-sizing: border-box;
}

.pr-split-left {
    display: flex;
    align-items: center;
    justify-content: center;
    border-right: 1px solid var(--border);
    padding-right: 16px;
    overflow: hidden;
}

.pr-split-right {
    padding-left: 16px;
    overflow-y: auto;
}

/* Make image/PDF fill the left pane without distortion */
.pr-split-left img,
.pr-split-left iframe {
    width: 100%;
    height: 100%;
    object-fit: contain;
    border: none;
}

/* Markdown page fills the right pane and scrolls internally */
.pr-split-page {
    width: 100%;
    height: 100%;
    overflow-y: auto;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--r);
    padding: 18px 20px;
    box-sizing: border-box;
}
```

If you no longer need the **aspect-ratio matching** behaviour, you can also remove `procurementSyncSplitPane()` and its `onload` call. The side-by-side view will then simply split into two equal columns.

---

## Optional JS improvement: ensure markdown is actually rendered

Your `renderMd()` currently only uses `window.marked.parse`. If your workspace provides a richer renderer like `window.renderRichMarkdownHtml`, use it first:

```js
function renderMd(text) {
    try {
        if (window.renderRichMarkdownHtml) {
            return window.renderRichMarkdownHtml(String(text || ''));
        }
        if (window.marked && typeof window.marked.parse === 'function') {
            return window.marked.parse(String(text || ''));
        }
    } catch (_e) { /* fall through */ }
    return '<p>' + esc(text).replace(/\n/g, '<br>') + '</p>';
}
```

---

## Check your data

The side-by-side tab only appears if **all** of these are true:

```js
doc.text_md && (doc.image_url || doc.kind === 'pdf')
```

So if the tab is missing, check the API response for the document:

```js
console.log(doc.text_md, doc.image_url, doc.kind);
```

If `text_md` is empty/null, the side-by-side tab will not be created. In that case, either the backend needs to provide `text_md`, or you can fall back to `doc.text`:

```js
var markdownText = doc.text_md || doc.text;
if (markdownText && (doc.image_url || doc.kind === 'pdf')) {
    // use markdownText instead of doc.text_md
}
```

---

Once you apply the CSS changes, the image and rendered markdown should appear side-by-side in the document viewer.