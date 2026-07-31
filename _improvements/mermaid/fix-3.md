Good — that confirms the export fix landed cleanly. The expand button is a separate, pre-existing bug, and I can point to one concrete defect plus one likely contributor, but I want you to confirm which one before we chase the wrong thing.

## Confirmed bug: a global name collision

Both files declare a function with essentially the same job, and one silently overwrites the other:

- `docs.js` has a **top-level** `function _openMermaidFullView(mermaidContainer) {...}`. In a plain (non-module) `<script>`, a top-level `function` declaration becomes a property of `window` automatically.
- `mermaid.js` explicitly does `window._openMermaidFullView = _mmdOpenFullView;` — overwriting that exact same global.

Whichever of these two scripts finishes loading *last* wins, and it wins for **every** caller from then on — including the click handler inside `docs.js` itself, which calls the bare identifier `_openMermaidFullView(wrapper)`. If `mermaid.js` loads after `docs.js` (likely, given it builds on the shared render pipeline), every expand click in the output/preview panel is actually running `_mmdOpenFullView` from `mermaid.js`, not the one sitting right next to it in `docs.js`. This is a real defect independent of what's causing the black screen, so fix it regardless:

**`docs.js`** — rename the local function so it can't collide, and update its one call site:
```js
function _docsOpenMermaidFullView(mermaidContainer) { /* unchanged body */ }
```
```js
expandBtn.addEventListener('click', e => {
  e.stopPropagation();
  e.preventDefault();
  _docsOpenMermaidFullView(wrapper);
});
```

**`mermaid.js`** — stop clobbering the global; expose under its own name only:
```js
window._mmdOpenFullView = _mmdOpenFullView; // was: window._openMermaidFullView = _mmdOpenFullView;
```

That guarantees each module's expand button always runs its own implementation.

## One quick check before I chase the visual symptom

The two implementations are otherwise near-identical, so this rename alone might not explain a *fully black* screen. Could you do this once, then tell me what you see:

1. Click expand to get the black overlay.
2. Open DevTools → Elements, find `.mermaid-fullscreen-diagram` (it's a direct child of `.mermaid-fullscreen-body`).
3. Tell me: does it have a child element inside it (an `<svg>` or `<iframe>`), or is it empty?

If it's **empty** → the bug is upstream (`contentEl` came back null when the button was created), and the collision fix above is likely the actual cure.

If it **does** have an `<svg>` inside → this is a contrast issue, not a missing-content issue: `.mermaid-fullscreen-diagram svg{background:var(--bg-card)}` combined with `.mermaid-fullscreen-overlay{background:rgba(0,0,0,.82)}` can put a dark-themed diagram on a near-black canvas inside an already-dark overlay — which matches your earlier inline screenshots too (those diagrams were already low-contrast dark boxes even in the small panel view). The fix there is to force a legible, theme-independent canvas for the expanded view regardless of app dark mode:
```css
.mermaid-fullscreen-diagram svg{
  max-width:none;max-height:none;flex-shrink:0;
  background:#ffffff;              /* was var(--bg-card) */
  border-radius:8px;
  box-shadow:0 8px 40px rgba(0,0,0,.3);
}
```

Let me know which of the two you find and I'll narrow the fix to that.