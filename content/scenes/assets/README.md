# Scene Asset Catalog

Reusable SVG artifacts (characters, props, environment pieces) that can be
composed into scenes. Each asset is a small JSON file describing metadata plus
a `code` string that appends SVG fragments to a running `svg` buffer.

## File format
```
{
  "id": "owl",                          // unique, lowercase, snake_case
  "name": "Wise Owl",                   // display name
  "icon": "🦉",
  "category": "character",              // character | prop | environment | fx | sky
  "tags": ["forest","bird","nocturnal"],
  "desc": "Short, one-sentence description",
  "params": {                           // declarative — used by catalog UI
    "x":     { "type": "x",     "default": "w*0.3" },
    "y":     { "type": "y",     "default": "bY-60" },
    "scale": { "type": "number","default": 1 },
    "color": { "type": "color", "default": "#8B6B4A" }
  },
  "code": "...function body..."
}
```

## Code runtime
`code` is compiled as:
```js
new Function('svg','ctx','mt','w1','w2','w3','isN','ol', code + '\nreturn svg;')
```
- `svg`   (string)   — current SVG buffer; return the extended string
- `ctx`   (object)   — per-call parameters (x, y, scale, color, ...)
- `mt`    (number)   — master time (seconds * timeSpeed)
- `w1,w2,w3` (0..1)  — deterministic oscillators
- `isN`   (bool)     — night mode
- `ol`    (number)   — stroke outline width

Always use template literals and **never** leave un-evaluated `${...}` or
stray `{` inside attribute values — the scene engine aborts the preview loop
on malformed SVG.

## Registering a new asset
1. Add `my_thing.asset.json` to this folder.
2. Append `"my_thing.asset.json"` to `manifest.json`.
3. Reload the Shaders room (or call `shAutoLoadAssets()`).
4. Scene code can now call:
   ```js
   svg = SH_ASSETS.my_thing.render(svg, { x: w*0.5, y: bY-40, mt, isN, ol });
   ```

## Usage from scenes
Inside a scene's `code` string:
```js
svg = SH_ASSETS.owl.render(svg, { x: w*0.3, y: bY-80, mt, isN, ol, talk: true });
svg = SH_ASSETS.firefly_swarm.render(svg, { x: w*0.5, y: bY-30, w, count: 15, mt, color: sc.acc });
svg = SH_ASSETS.snowflakes.render(svg, { w, h, mt, count: 25 });
```

The catalog UI (`shOpenCatalog()`) builds this composition automatically from
multi-select picks.
