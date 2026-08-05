# Olivia — Morphing SVGs / "Morphing Olivia" Scenes

Two morphing-SVG families exist in the project, both built from the same eco palette
but on **different artboards, keyframes, and runtime behaviour**:

1. **Welcome morph** (11 scenes) — the app's empty-state "Morphing Olivia", inline SVG in
   `frontend/index.html` + `frontend/index-i18n.html`, animated with **CSS keyframes only**
   (no JS drives the crossfade — see "Runtime behaviour" below).
2. **Awareness-AI hero morph** (13 scenes) — a standalone pt-BR marketing page
   (`_lsd/morphs/index-br.html`), **JS-driven** scene cycling (auto-cycle, pill hover,
   scroll-spy, mobile carousel).

## Files in this directory

| File | What it is |
|---|---|
| `README.md` | This index — both morph families, scenes, palettes, locations, runtime notes |
| `index-br.html` | Reference copy of the pt-BR Awareness-AI page (source of family #2) |
| `css/morph-animations.css` | Extracted `.morph-stage` / `.morph-scene` classes + all keyframes for both families |
| `scenes/scene-*.svg` | 11 standalone welcome-morph SVGs (family #1), self-animating |
| `scenes/br/scene-*.svg` | 13 standalone hero-morph SVGs (family #2), self-animating |
| `scripts/extract-br-scenes.py` | Generator for `scenes/br/` — pulls scenes out of `index-br.html` byte-exact |

## Where the scenes live in the codebase

Both entry files contain **byte-identical** scene markup (copy of `index-i18n.html`):

| File | Section | Line range |
|---|---|---|
| `frontend/index-i18n.html` | `<!-- Welcome/Empty State - Morphing Olivia -->` | 1544–1906 |
| `frontend/index.html` | `<!-- Welcome/Empty State - Morphing Olivia -->` | 1814–2154 |

Supporting CSS: `frontend/css/base.css` lines **1529–1650** (classes + keyframes) and
line **5738** (mobile size override).

## The 11 scenes

| # | Scene ID | Concept | Key visual | Animations used |
|---|---|---|---|---|
| 1 | `scene-branch` | Origin | curved olive branch + 3 terra fruits | sway, sway-r, fruit-glow |
| 2 | `scene-pencil` | Education / Writing | branch with pencil tip | sway, fruit-glow |
| 3 | `scene-scale` | Law / Justice | balance scale, tilting | scale-balance, fruit-glow |
| 4 | `scene-knowledge` | Knowledge / Ontology | open book with fluttering pages | sway, page-flutter, fruit-glow |
| 5 | `scene-network` | Intelligence | hub-and-spoke neural network | subtle-pulse, fruit-glow |
| 6 | `scene-tree` | Full Ecosystem | full olive tree with canopy | sway, sway-r, fruit-glow |
| 7 | `scene-education` | School | mortarboard-style cap | sway, sway-r, fruit-glow |
| 8 | `scene-lending` | Finance | branch with leaf clusters + chart lines | sway, sway-r, fruit-glow |
| 9 | `scene-government` | Public Sector | courthouse/columns | sway, fruit-glow |
| 10 | `scene-healthcare` | Health | plus/cross on stem | sway, sway-r, fruit-glow |
| 11 | `scene-corporate` | Business | building block | sway, fruit-glow |

All scenes share the same artboard: `viewbox="0 0 260 280"` (source spelling — lowercase
`viewbox`; the standalone files in `scenes/` use valid XML `viewBox`).

## Palette (eco palette)

| Variable | Hex | Role |
|---|---|---|
| `--eco-verde` | `#2d785a` | olive green (trunk, branches, strokes) |
| `--eco-verde-3` | `#4a9e70` | lighter green (defined but unused in scenes) |
| `--eco-terra` | `#c4622d` | terra / orange (fruit, berries, accents) |
| `--eco-terra-light` | `#d4733e` | lighter terra (defined but unused in scenes) |
| — | `#1c4532` | dark green (canopy, glyph strokes) |
| — | `#9a9088` | warm grey (pencil lead detail, scene-pencil only) |

## Container classes (CSS)

```css
.morph-stage { position: relative; width: 160px; height: 180px; }
.morph-scene { position: absolute; inset: 0; display: flex; align-items: center;
               justify-content: center; opacity: 0;
               transition: opacity 2.5s ease-in-out; pointer-events: none; }
.morph-scene.active { opacity: 1; pointer-events: auto; }
.morph-scene svg { width: 100%; height: 100%; }
```

Mobile (≤ ~600px, `base.css` line 5738): `.welcome-logo, .morph-stage { width: 110px; height: 124px; }`

## Keyframe animations

| Keyframe | What it animates | Motion |
|---|---|---|
| `sway` | branch/trunk rotation | rotate −1.5° ↔ +1.5° (8–10s) |
| `sway-r` | secondary twigs | rotate +1.2° ↔ −1.2° (5–6s, offset delay) |
| `page-flutter` | book pages | scaleX 1 ↔ 1.03 |
| `fruit-glow` | fruit/berries | opacity .85↔1 + brightness 1↔1.15 |
| `scale-balance` | balance arm | rotate 0° → +2° → −2° (6s) |
| `subtle-pulse` | network spokes | opacity .4 ↔ .6 (5s) |
| `leaf-rustle` | sidebar olive-tree mark (not part of welcome morph) | translate + rotate 1.2° |

## Runtime behaviour (important)

- **Only `scene-branch` is `.active` at load.** No JavaScript references
  `morph-scene` / `scene-*` anywhere in `frontend/js/` — the other 10 scenes are
  currently **never shown**. The CSS supports a crossfade (2.5s opacity transition),
  but nothing drives it. If scene cycling is desired, a `setInterval` toggling
  `.morph-scene.active` (mirroring `_startLA8159LoadingStageCycle` in
  `frontend/js/chat/stream.js`) would activate the dormant scenes.

## Other "morph" usages in the project (NOT the welcome SVG)

| Location | What it is |
|---|---|
| `frontend/js/chat/stream.js` (441–499) | "loading stage" morph items — `_createLA8159LoadingStageMarkup` cycles discipline pills (`.OliviaLegal-loading-morph-*`) |
| `frontend/css/chat.css` (59–65, 153) | styles for the loading-stage morph items above |
| `frontend/js/shaders.js` | `bgmorph` (0–1) background-morph/distortion level; `shUpdateMorph(val)` slider; see `shaderbench.html` |
| i18n keys | `frontend.index.welcomeempty_state_morphing_olivia`, `frontend.index-i18n.welcomeempty_state_morphing_olivia`, `frontend.shaderbench.background_morph`, `shadersMorphSlider` |

## Standalone SVGs in `scenes/`

Each file embeds only the keyframes its scene uses (from the table above) inside a
`<style>` block, so opening the `.svg` directly reproduces the animation. Artboard
converted to XML-valid `viewBox="0 0 260 280"`.

---

# Second morph family — `index-br.html` (Awareness-AI hero)

The pt-BR Awareness-AI marketing page (`_lsd/morphs/index-br.html`) carries a
**separate, larger** morphing-SVG hero — 13 scenes on a `280×260` artboard
(note: **transposed** vs the welcome morph's `260×280`). Same eco-palette family,
but different variable names, different keyframe definitions, and a **JS-driven**
runtime (the welcome morph is CSS-only).

## The 13 scenes

| # | Scene ID | Concept (pt-BR label from `meta` / extractor) | Key visual | Animations used |
|---|---|---|---|---|
| 1 | `scene-branch` | Origem — "O ramo de oliveira" | curved ascending olive branch + 3 terra fruits | sway, sway-r, fruit-glow |
| 2 | `scene-pencil` | Educação — Lápis | pencil curved like a branch, terra eraser tip | sway, fruit-glow |
| 3 | `scene-scale` | Direito — Balança | balance scale, olives as weights | scale-balance, fruit-glow |
| 4 | `scene-tree` | Ecossistema — Oliveira completa | full olive tree with canopy clusters | sway, sway-r, leaf-rustle, fruit-glow |
| 5 | `scene-network` | Inteligência — Rede | hub-and-spoke network | subtle-pulse, fruit-glow |
| 6 | `scene-book` | Ontologia — Livro | open book with text lines, olives as bookmarks | sway, fruit-glow |
| 7 | `scene-heart` | Terceiro Setor — "O coração de ramos" | two branches meeting in a heart shape | sway, sway-r, leaf-rustle, fruit-glow |
| 8 | `scene-dna` | Ciências da Vida — "A hélice da vida" | double helix of entwined branches | sway, sway-r, leaf-rustle, fruit-glow |
| 9 | `scene-pulse` | Saúde — "O pulso do cuidado" | branch cross + ECG trace, heartbeat centre | pulse-beat, sway, subtle-pulse, fruit-glow |
| 10 | `scene-capitol` | Governo — "O pórtico público" | courthouse columns / portico | sway, sway-r, fruit-glow |
| 11 | `scene-chart` | Financeiro — "A curva de crescimento" | ascending branch tracing a value curve | sway, fruit-glow, leaf-rustle |
| 12 | `scene-school` | Educação — "O caderno e o capelo" | open book under a graduation cap | sway, sway-r, fruit-glow |
| 13 | `scene-headset` | Suporte — "O fone de escuta" | headset woven from olive branches | sway, sway-r, subtle-pulse, leaf-rustle, fruit-glow |

## Artboard & palette (index-br variant)

All 13 scenes share `viewBox="0 0 280 260"`. The page defines its own palette
(`index-br.html` `:root`, lines 10–27) — a **darker** trunk green than the
welcome morph:

| Variable | Hex | Role |
|---|---|---|
| `--eco-verde` | `#1c4532` | dark trunk green (welcome morph uses `#2d785a` here) |
| `--eco-verde-3` | `#2d785a` | main strokes (welcome morph's `--eco-verde`) |
| `--eco-terra` | `#c4622d` | fruit / accents |
| `--eco-terra-light` | `#d4733e` | fruit highlight |
| `--eco-tinta` | `#1a1814` | pencil lead |
| `--eco-claro` | `#9a9088` | pencil ferrule |
| unused | `#163a2a` · `#5a8a6e` · `rgba(28,69,50,.06)` | `--eco-verde-2`, `--eco-verde-light`, `--eco-verde-lo` |

## Container CSS (index-br.html lines 126–150)

```css
.morph-stage { position: relative; width: 280px; height: 260px; margin: 0 auto 40px; }
.morph-scene { position: absolute; inset: 0; display: flex; align-items: center;
               justify-content: center; opacity: 0; transform: scale(0.94);
               transition: opacity 0.8s ease, transform 0.8s ease; pointer-events: none; }
.morph-scene.active { opacity: 1; transform: scale(1); pointer-events: auto; }
```

Differs from the welcome morph: 280×260 stage, a **zoom-in** (`scale 0.94 → 1`)
alongside the fade, and a faster 0.8s transition (welcome: 2.5s).

## Keyframes (index-br variants — differ from welcome morph)

| Keyframe | What it animates | Motion | vs welcome morph |
|---|---|---|---|
| `sway` | branches / trunks | rest 0° → peak +1.2° | angles differ (welcome: −1.5° ↔ +1.5°) |
| `sway-r` | secondary twigs | rest 0° → peak −1° | angles differ |
| `fruit-glow` | fruit | opacity .85 ↔ 1 only | **no brightness filter** |
| `leaf-rustle` | leaves | rotate 3° + scale 1.02 | welcome: rotate + translate |
| `subtle-pulse` | network spokes / ECG | opacity .4 ↔ .6 | identical |
| `scale-balance` | balance arm | 0° → +2° → −2° | identical |
| `pulse-beat` | heartbeat centre (scene-pulse) | scale 1 ↔ 1.04 | **new, index-br only** |
| `float-up` / `float-down` | page-level hero / scroll hint | fade+translate / bob | not used inside scenes |

## Runtime behaviour (JS-driven — unlike the welcome morph)

- **8-scene auto-cycle** (index-br.html line 1717): `morphScenes =
  ['branch','heart','dna','pulse','capitol','chart','school','headset']`,
  advancing every 5000 ms via `startMorphCycle`.
- **Pill hover** (lines 1287–1311): each `.sector-pill` maps a scene to a sector
  section; hovering pauses the cycle and calls `morphTo(scene)`.
- **Scroll-spy** (lines 1789–1821): as the user scrolls through the 8 sector
  sections, the hero morphs to the matching scene.
- **Mobile pill carousel** (lines 1855–1998): 2 pills visible, auto-rotate every
  5 s, edge taps to flip.
- **5 dormant scenes** (parallel to the welcome morph): `scene-pencil`,
  `scene-scale`, `scene-tree`, `scene-network`, `scene-book` exist in the markup
  but **no JS path shows them** — they are absent from `morphScenes`, `meta`, and
  every pill's `data-sector`.
- **Section-logo variants** (lines 1325–1646): each sector section repeats a
  simplified `.section-logo` SVG reusing the same branch/heart/… geometry with
  only the keyframes it needs.

## Standalone SVGs in `scenes/br/`

Generated by `scripts/extract-br-scenes.py` from `index-br.html`:

- `<g>` bodies pulled **byte-exact** from the page (regex on
  `<div class="morph-scene" id="scene-…">`).
- CSS custom properties substituted with hex values — longest match first
  (`var(--eco-verde-3)` before `var(--eco-verde)`).
- Only the keyframes a scene actually uses are embedded in each file's
  `<style>` block.
- Artboard normalized to XML-valid `viewBox="0 0 280 260"`.

Re-run `python3 scripts/extract-br-scenes.py` after editing `index-br.html` to
regenerate.
