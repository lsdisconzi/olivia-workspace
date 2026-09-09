The card field values are currently rendered in a small, low‑contrast gray (`var(--gray-hi)`) with tight truncation (max 34 characters per line) and no visual separation. This makes them hard to read, especially when many fields are present. Below are targeted improvements to make them clearly visible without breaking the existing layout.

---

## 1. Increase font size and contrast

In `renderGraph`, locate the loop that renders `cardFieldEntries(ev)`:

```javascript
var cardEntries = cardFieldEntries(ev);
cardEntries.forEach(function (entry, index) {
  appendWrappedText(g, fieldLabel(entry.field) + ': ' + entry.value, x + 12 * scale,
    y + (104 + index * 18) * scale, 34, 12 * scale, 1, 'em-node-summary',
    Math.max(8, 9 * scale), 'var(--gray-hi)');
});
```

Change the `fontSize` and `fill`:

```javascript
appendWrappedText(g, fieldLabel(entry.field) + ': ' + entry.value, x + 12 * scale,
  y + (104 + index * 18) * scale, 34, 12 * scale, 1, 'em-node-summary',
  Math.max(8, 10.5 * scale), 'var(--white)');   // brighter and larger
```

If you still want a subtle distinction between label and value, you could use two separate texts:

```javascript
var labelColor = 'var(--amber)';
var valueColor = 'var(--white)';
// render label then value
```

But the simple change to white already improves legibility dramatically.

---

## 2. Allow more characters per line (less truncation)

The `appendWrappedText` function uses `maxChars` (currently 34) as a character count. It does not account for the actual pixel width of the node. To show more of the field value, increase `maxChars` from `34` to a larger number, e.g. `44` or even `50` if the node is wide.

Adjust the call:

```javascript
appendWrappedText(g, fieldLabel(entry.field) + ': ' + entry.value, x + 12 * scale,
  y + (104 + index * 18) * scale, 44, 12 * scale, 1, 'em-node-summary',
  Math.max(8, 10.5 * scale), 'var(--white)');
```

If you want to be more precise, compute a dynamic `maxChars` based on node width and font size. Inside the loop, before the `appendWrappedText`, add:

```javascript
var availableWidth = (nodeWidth(ev) - 24) * scale; // subtract padding
var charWidth = 6 * scale; // approximate width of one character at current font size
var dynamicMaxChars = Math.max(10, Math.floor(availableWidth / charWidth));
```

Then use `dynamicMaxChars` instead of `44`. This ensures text fills the width without overflowing.

---

## 3. Add visual separation between fields

If multiple fields are stacked, a subtle background or a thin line between rows can make them easier to scan. Add a faint separator line before each field (except the first) or draw a background rectangle per row.

Simpler: change the vertical spacing slightly and add a separator line using an SVG `<line>` element.

Inside the `cardEntries.forEach` loop, before calling `appendWrappedText`, add:

```javascript
if (index > 0) {
  var lineY = y + (102 + index * 18 - 8) * scale;  // adjust to sit just above the text
  var sepLine = document.createElementNS(NS, 'line');
  sepLine.setAttribute('x1', x + 6 * scale);
  sepLine.setAttribute('x2', x + (nodeWidth(ev) - 18) * scale);
  sepLine.setAttribute('y1', lineY);
  sepLine.setAttribute('y2', lineY);
  sepLine.setAttribute('stroke', 'var(--border)');
  sepLine.setAttribute('stroke-width', 0.5);
  g.appendChild(sepLine);
}
```

This will draw a thin line between rows, making each field distinct.

---

## 4. Exclude irrelevant or empty fields

In the SVG you provided, "Residence:" and "Id: 6" appear. The `Id` field is already excluded from `cardFieldEntries` because it's in the standard exclude list, but it may still be appearing due to a different field name (e.g., "Id" vs "id"). Ensure the exclusion list includes all variants:

```javascript
var exclude = ['id', 'Id', 'ID', 'x', 'y', 'links', 'width', 'height'];
```

Also, empty string values (like `Residence: ''`) are being displayed because `fieldValues` returns `['']` (length 1). To skip such fields, modify `cardFieldEntries` to filter out entries where all values are empty/whitespace:

```javascript
function cardFieldEntries(ev) {
  var standard = ['title', 'date', 'description', 'summary', 'category', 'status', 'entities', 'tags'];
  return availableFieldKeys(sourceKey(ev)).filter(function (field) {
    if (standard.indexOf(field) !== -1) return false;
    if (!fieldIsVisible(ev, field)) return false;
    var values = fieldValues(ev, field.split('.'), 0);
    // Filter out if all values are null/undefined/empty strings
    var hasValue = values.some(function (v) {
      return v !== null && v !== undefined && String(v).trim() !== '';
    });
    return hasValue;
  }).map(function (field) {
    // ... existing mapping
  });
}
```

This will remove fields like "Residence" when empty.

---

## Summary of changes

| Change | Location | Effect |
|--------|----------|--------|
| Brighten and enlarge field text | `cardEntries.forEach` loop in `renderGraph` | Better readability |
| Increase truncation limit or dynamic width | Same loop | More content visible |
| Add separator lines between fields | Same loop (before text) | Visual separation |
| Exclude empty / irrelevant fields | `cardFieldEntries` | Cleaner cards |

These adjustments keep the existing node structure but make the important field values stand out clearly.