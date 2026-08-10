#!/usr/bin/env node
/**
 * generate-omission-reading-pack-html.js
 *
 * Transforms the Omission (LA8159 / LATAM) English reading package into a single,
 * self-contained HTML reading page in the Olivia design system:
 *
 *   1. Executive summary + reading guide  -> rendered inline (with package links)
 *   2. Full package file index            -> every file in reading_package_EN is
 *                                            accessible via a relative link
 *   3. The two new reports                -> Asymmetry Report + Frente Amplio
 *                                            Cross-Analysis, rendered inline with
 *                                            their rendered graphs from data/graphs/
 *
 * Run from repo root:  node scripts/generate-omission-reading-pack-html.js
 */
const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

const PROJECT   = path.resolve(__dirname, '../uploads/projects/omission');
const PACK      = path.join(PROJECT, 'outputs/reading_package_EN');
const REPORTS   = path.join(PROJECT, 'uploads/reports');
const GRAPHS    = path.join(PROJECT, 'data/graphs');
const OUT       = path.join(PROJECT, 'outputs/reading_package_EN.html');

const ASYM_REPORT = 'Asymmetry Report — Omission Project (Case LA8159 _ LATAM).md';
const FRENTE_REPORT = 'Cross-Analysis_ Frente Amplio’s Human Rights Declaration vs.md';

// ── helpers ──────────────────────────────────────────────────────────────────
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function toRel(p) {
  return path.relative(path.dirname(OUT), p).split(path.sep).join('/');
}
function posixJoin(...parts) {
  return path.join(...parts).split(path.sep).join('/');
}
function fileSize(p) {
  try { return fs.statSync(p).size; } catch { return 0; }
}
function humanSize(n) {
  if (n >= 1048576) return (n / 1048576).toFixed(1) + ' MB';
  if (n >= 1024) return (n / 1024).toFixed(0) + ' KB';
  return n + ' B';
}

// Markdown produced by pandoc-style writers escapes characters with backslash;
// undo those escapes so marked renders cleanly.
function unescapeMd(md) {
  return md.replace(/\\([~>#.+\-\[\]()*_])/g, '$1');
}

// ── mermaid block extraction ────────────────────────────────────────────────
// The report markdown embeds mermaid diagrams as raw text (no code fences):
//   flowchart LR
//       subgraph ...
//       end
//   <blank>
//   <next paragraph at column 0>
// A block begins at a non-indented line whose first token is a mermaid keyword
// and continues while lines are blank or indented.
function splitMermaidBlocks(md) {
  const lines = md.split('\n');
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const kw = /^(pie\s|flowchart\s|graph\s|timeline\b|sequenceDiagram\b|gantt\b|erDiagram\b|mindmap\b|journey\b|stateDiagram)/.exec(line);
    if (kw && !/^\s/.test(line)) {
      const start = i;
      i += 1;
      while (i < lines.length) {
        const l = lines[i];
        if (l.trim() === '' || /^\s/.test(l)) { i += 1; continue; }
        break;
      }
      blocks.push({ kw: kw[1].trim(), raw: lines.slice(start, i).join('\n'), start });
      continue;
    }
    i += 1;
  }
  return blocks;
}

function replaceMermaid(md, figs, label) {
  const blocks = splitMermaidBlocks(md);
  let out = md;
  // Replace from the end so earlier indices stay valid.
  for (let bi = blocks.length - 1; bi >= 0; bi--) {
    const fig = figs[bi];
    let html;
    if (fig) {
      html = figureHtml(fig, bi + 1, label || 'Fig.');
    } else {
      html = '<pre class="mermaid-raw"><code>' + esc(blocks[bi].raw) + '</code></pre>';
    }
    // splice: remove the block and insert the figure html
    const lines = out.split('\n');
    lines.splice(blocks[bi].start, blocks[bi].raw.split('\n').length, html);
    out = lines.join('\n');
  }
  return out;
}

function figureHtml(fig, n, label) {
  const links = [
    { text: 'SVG', href: fig.svg, title: 'Vector render (SVG)' },
  ];
  if (fig.png) links.push({ text: 'PNG', href: fig.png, title: 'High-resolution render (PNG)' });
  if (fig.src) links.push({ text: 'source', href: fig.src, title: 'Original Mermaid source (.mermaid)' });

  return `<figure class="graph">
  <img class="graph-img" src="${fig.svg}" alt="${esc(fig.cap)}">
  <figcaption>
    <span class="g-cap">${label} ${n} — ${esc(fig.cap)}</span>
    <span class="g-links">
      ${links.map(l => `<a class="g-link" href="${l.href}" target="_blank" rel="noopener" title="${l.title}" download><i class="fas fa-file-arrow-down"></i> ${l.text}</a>`).join('')}
      <span class="g-src">${esc(fig.svg)}</span>
    </span>
  </figcaption>
</figure>`;
}

// ── graph asset mapping (rendered in data/graphs/) ──────────────────────────
const A = posixJoin('..', 'data', 'graphs', 'asymetry-report');
const F = posixJoin('..', 'data', 'graphs', 'frente-amplio-IACHR');

const ASYM_FIGS = {
  label: 'Fig.',
  list: [
    { svg: `${A}/deepseek_mermaid_20260807_0d32d1.svg`, png: `${A}/deepseek_mermaid_20260807_eacbdf.png`, src: `${A}/deepseek_mermaid_20260807_7f5885.mermaid`, cap: 'LATAM market share — flights to Santiago (SCL), 2025' },
    { svg: `${A}/deepseek_mermaid_20260807_8388fe.svg`, png: `${A}/deepseek_mermaid_20260807_cdf8e8.png`, src: `${A}/deepseek_mermaid_20260807_e38ae9.mermaid`, cap: 'Institutional response landscape — contact attempts → responses' },
    { svg: `${A}/deepseek_mermaid_20260807_6227ca.svg`, png: `${A}/deepseek_mermaid_20260807_253ed9.png`, src: `${A}/deepseek_mermaid_20260807_97b97a.mermaid`, cap: 'Correlated silence timeline — multiple institutions (2024–2026)' },
    { svg: `${A}/deepseek_mermaid_20260807_a737c5.svg`, png: `${A}/deepseek_mermaid_20260807_208806.png`, src: `${A}/deepseek_mermaid_20260807_2591f5.mermaid`, cap: 'Legal & representative asymmetry — the cascade of rejections' },
    { svg: `${A}/deepseek_mermaid_20260807_c7de56.svg`, png: `${A}/deepseek_mermaid_20260807_daa1d0.png`, src: `${A}/deepseek_mermaid_20260807_299ba6.mermaid`, cap: 'Confirmed blockades — network of rejection (8 cases)' },
    { svg: `${A}/deepseek_mermaid_20260807_773f3c.svg`, png: null, src: `${A}/deepseek_mermaid_20260807_9097f3.mermaid`, cap: 'The self-reinforcing loop — economic power → silence' },
  ],
};

const FRENTE_FIGS = {
  label: 'Fig.',
  list: [
    { svg: `${F}/deepseek_mermaid_20260807_cf351f.svg`, png: `${F}/deepseek_mermaid_20260807_79ada7.png`, src: `${F}/deepseek_mermaid_20260807_8cf2e0.mermaid`, cap: 'The contradiction loop — proclaimed values vs. documented reality' },
  ],
};

// ── package file index ───────────────────────────────────────────────────────
function packageIndex() {
  const rows = [];
  const walk = (dir, prefix) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
      a.isDirectory() === b.isDirectory() ? a.name.localeCompare(b.name) : a.isDirectory() ? -1 : 1);
    for (const e of entries) {
      if (e.name.startsWith('.DS_Store')) continue;
      const full = path.join(dir, e.name);
      const rel = prefix ? prefix + '/' + e.name : e.name;
      if (e.isDirectory()) {
        rows.push({ rel: rel + '/', dir: true, size: null });
        walk(full, rel);
      } else {
        rows.push({ rel, dir: false, size: humanSize(fileSize(full)) });
      }
    }
  };
  walk(PACK, '');
  let html = '<table class="pkg-table"><thead><tr><th>#</th><th>File</th><th>Size</th><th>Open</th></tr></thead><tbody>';
  let n = 0;
  for (const r of rows) {
    if (r.dir) {
      html += `<tr class="pkg-dir"><td></td><td><i class="fas fa-folder"></i> ${esc(r.rel)}</td><td>—</td><td></td></tr>`;
      continue;
    }
    n += 1;
    const href = 'reading_package_EN/' + r.rel;
    html += `<tr>
      <td style="white-space:nowrap">${n}</td>
      <td><a class="pkg-link" href="${href}" target="_blank" rel="noopener">${esc(r.rel)}</a></td>
      <td style="white-space:nowrap">${r.size}</td>
      <td><a class="dl ghost" style="font-size:.62rem;padding:.3rem .6rem" href="${href}" target="_blank" rel="noopener"><i class="fas fa-book-open"></i> Open</a></td>
    </tr>`;
  }
  html += '</tbody></table>';
  return html;
}

// ── reports ──────────────────────────────────────────────────────────────────
function renderReport(mdFile, figs) {
  const md = unescapeMd(fs.readFileSync(path.join(REPORTS, mdFile), 'utf-8'));
  const withFigs = replaceMermaid(md, figs.list, figs.label);
  return marked.parse(withFigs, { gfm: true, breaks: false });
}

function renderMdWithPkgLinks(mdFile) {
  const md = unescapeMd(fs.readFileSync(path.join(PACK, mdFile), 'utf-8'));
  let html = marked.parse(md, { gfm: true, breaks: false });
  // package-relative links must be rooted at the package folder from outputs/
  html = html.replace(/href="\.\//g, 'href="reading_package_EN/');
  return html;
}

// ── page ─────────────────────────────────────────────────────────────────────
const PAGE_CSS = `
:root {
  --white: #faf9f6; --black: #1a1a1a;
  --green-dark: #1c4532; --green-mid: #2d785a; --green-light: #5a8a6e;
  --amber: #c4622d; --amber-light: #d4733e; --golden: #C89B3C;
  --gray: #9a9088; --gray-hi: #5a5a5a;
  --cream: #f8f5ee; --paper: #fdfcf9;
  --red: #c0392b; --red-soft: rgba(192, 57, 43, .08);
  --color-text-primary: var(--black);
  --color-text-secondary: var(--gray-hi);
  --color-text-tertiary: var(--gray);
  --color-border-light: rgba(28, 69, 50, .10);
  --color-border-medium: rgba(28, 69, 50, .18);
  --color-border-strong: rgba(28, 69, 50, .28);
  --font-serif: 'Fraunces', Georgia, serif;
  --font-sans: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  --transition: .3s cubic-bezier(.4, 0, .2, 1);
}
@media (prefers-color-scheme: dark) {
  :root {
    --white: #121412; --black: #efece5;
    --green-dark: #2c5a44; --green-mid: #48a97a;
    --amber: #e07b42; --amber-light: #ef8f58;
    --gray: #6b6560; --gray-hi: #b7b3aa;
    --paper: #171a17; --cream: #1c201c;
    --red: #e0665a;
    --color-border-light: rgba(255,255,255,.09);
    --color-border-medium: rgba(255,255,255,.16);
    --color-border-strong: rgba(255,255,255,.26);
  }
}
* { margin: 0; padding: 0; box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  font-family: var(--font-sans); background: var(--white); color: var(--black);
  line-height: 1.65; overflow-x: hidden; -webkit-font-smoothing: antialiased;
}
a { color: inherit; text-decoration: none; }
@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }

.rail { position: fixed; left: 20px; top: 0; bottom: 0; width: 1px; z-index: 5; pointer-events: none; }
.rail::before { content: ''; position: absolute; left: 0; top: 64px; bottom: 64px; width: 1px;
  background: linear-gradient(var(--green-mid), var(--color-border-light) 40%, var(--color-border-light) 60%, var(--amber)); opacity: .35; }
.rail .dot { position: absolute; left: -2.5px; width: 6px; height: 6px; border-radius: 50%; }
.rail .dot.top { top: 60px; background: var(--green-mid); }
.rail .dot.bottom { bottom: 60px; background: var(--amber); }
@media (max-width: 900px) { .rail { display: none; } }

nav { position: fixed; top: 0; left: 0; right: 0; z-index: 40; display: flex; align-items: center;
  justify-content: space-between; padding: 1.2rem 2.6rem; backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px); background: color-mix(in srgb, var(--white) 82%, transparent);
  border-bottom: 1px solid transparent; transition: border-color var(--transition); }
nav.scrolled { border-bottom-color: var(--color-border-light); }
.logo { display: flex; align-items: baseline; gap: .5rem; font-family: var(--font-serif);
  font-size: 1.2rem; font-weight: 500; color: var(--green-dark); letter-spacing: -0.01em; }
.logo .tag { font-family: var(--font-mono); font-size: .6rem; letter-spacing: .16em; color: var(--gray);
  text-transform: uppercase; font-weight: 400; }
.nav-links { display: flex; align-items: center; gap: 1.6rem; }
.nav-links a { font-size: .8rem; color: var(--color-text-secondary); transition: color var(--transition); font-weight: 500; }
.nav-links a:hover { color: var(--amber); }
.agent-badge { display: inline-flex; align-items: center; gap: .4rem; font-size: .68rem;
  font-family: var(--font-mono); letter-spacing: .04em; padding: .36rem .78rem; border-radius: 2rem;
  border: 1px solid var(--color-border-medium); color: var(--color-text-secondary); white-space: nowrap; }
.agent-badge .d { width: 5px; height: 5px; border-radius: 50%; background: var(--amber);
  animation: subtle-pulse 2s ease-in-out infinite; }
@media (max-width: 900px) {
  nav { padding: 1rem 1.3rem; }
  .nav-links a:not(.agent-badge) { display: none; }
}

.hero { min-height: 92vh; display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 7rem 6vw 3rem; text-align: center; position: relative; }
.hero-kicker { font-family: var(--font-mono); font-size: .66rem; letter-spacing: .2em; text-transform: uppercase;
  color: var(--color-text-tertiary); margin-bottom: 1.6rem; }
.stage-view { position: relative; width: 240px; height: 240px; }
.morph-scene { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  opacity: 0; transition: opacity .85s ease, transform .85s ease; transform: scale(.94); pointer-events: none; }
.morph-scene.active { opacity: 1; transform: scale(1); pointer-events: auto; }
.morph-label { font-family: var(--font-serif); font-size: 2rem; font-weight: 400; color: var(--color-text-primary);
  margin-top: .6rem; letter-spacing: -0.01em; }
.morph-sub { font-family: var(--font-sans); font-size: .9rem; color: var(--color-text-tertiary);
  max-width: 480px; line-height: 1.6; min-height: 42px; margin-top: .4rem; }
.pills { display: flex; gap: .45rem; justify-content: center; flex-wrap: wrap; margin-top: 1.5rem; }
.pill { font-family: var(--font-sans); font-size: .74rem; font-weight: 500; padding: .5rem 1.1rem;
  border-radius: 20px; border: 1px solid var(--color-border-light); background: transparent;
  color: var(--color-text-secondary); cursor: pointer; transition: all var(--transition);
  display: inline-flex; align-items: center; gap: .4rem; }
.pill:hover { border-color: var(--color-border-medium); color: var(--color-text-primary); }
.pill.active { background: var(--green-dark); border-color: var(--green-dark); color: var(--white); }
.pill i { font-size: .68rem; }
.compose-mock { margin-top: 2.4rem; display: flex; align-items: center; gap: .6rem; width: min(460px, 88vw);
  background: var(--white); border: 1px solid var(--color-border-light); border-radius: 2rem;
  padding: .45rem .55rem .45rem 1.2rem; box-shadow: 0 10px 28px rgba(28, 69, 50, .05); cursor: pointer;
  transition: all var(--transition); }
.compose-mock:hover { border-color: var(--color-border-medium); box-shadow: 0 14px 34px rgba(28, 69, 50, .09);
  transform: translateY(-1px); }
.compose-mock span { flex: 1; text-align: left; font-size: .82rem; color: var(--color-text-tertiary); }
.compose-mock .send-btn { width: 32px; height: 32px; border-radius: 50%; border: none; background: var(--amber);
  color: var(--white); display: grid; place-items: center; cursor: pointer; flex-shrink: 0; }
.compose-mock:hover .send-btn { background: var(--amber-light); }
.compose-mock .send-btn i { font-size: .72rem; }
.scroll-hint { margin-top: 2.6rem; font-family: var(--font-mono); font-size: .6rem; letter-spacing: .14em;
  text-transform: uppercase; color: var(--color-text-tertiary); opacity: .6; animation: subtle-pulse 2.5s ease-in-out infinite; }

.reveal { opacity: 0; transform: translateY(18px); transition: opacity .7s ease, transform .7s cubic-bezier(.4, 0, .2, 1); }
.reveal.in { opacity: 1; transform: translateY(0); }

section.quiet { padding: 5rem 6vw; max-width: 760px; margin: 0 auto; }
section.wide { padding: 5rem 6vw; max-width: 1080px; margin: 0 auto; }
section.quiet + section.quiet, section.wide + section.wide { border-top: 1px solid var(--color-border-light); }
.kicker { font-family: var(--font-mono); font-size: .64rem; letter-spacing: .16em; text-transform: uppercase;
  color: var(--amber); margin-bottom: 1rem; display: block; }
h2 { font-family: var(--font-serif); font-weight: 400; font-size: clamp(1.6rem, 2.8vw, 2.2rem);
  color: var(--green-dark); line-height: 1.2; max-width: 24ch; letter-spacing: -0.015em; }
h2 em { font-style: italic; color: var(--amber); font-weight: 300; }
.lede { margin-top: 1rem; font-size: .95rem; color: var(--color-text-secondary); max-width: 60ch; line-height: 1.7; }

.meta-strip { display: flex; flex-wrap: wrap; gap: .55rem; margin-top: 1.8rem; }
.meta-chip { font-family: var(--font-mono); font-size: .66rem; letter-spacing: .04em; padding: .42rem .8rem;
  border-radius: 999px; border: 1px solid var(--color-border-medium); color: var(--color-text-secondary); }
.meta-chip b { color: var(--green-dark); font-weight: 600; }

.doc { background: var(--paper); border: 1px solid var(--color-border-light); border-radius: 18px;
  margin: 1.8rem 0; overflow: hidden; scroll-margin-top: 90px; }
.doc-head { display: flex; align-items: center; gap: 1rem; padding: 1.1rem 1.4rem;
  border-bottom: 1px solid var(--color-border-light); flex-wrap: wrap; }
.doc-head .n { font-family: var(--font-serif); font-size: 1.4rem; color: var(--amber);
  background: color-mix(in srgb, var(--cream) 80%, transparent); border-radius: 12px; padding: .2rem .7rem; line-height: 1.3; }
.doc-head h3 { font-family: var(--font-serif); font-weight: 400; font-size: 1.14rem; color: var(--green-dark); letter-spacing: -.01em; }
.doc-head .src { font-family: var(--font-mono); font-size: .62rem; color: var(--gray); margin-top: .2rem; word-break: break-all; }
.doc-head .spacer { flex: 1; }
.doc-actions { display: flex; gap: .5rem; flex-wrap: wrap; }
.dl { display: inline-flex; align-items: center; gap: .5rem; background: var(--green-dark); color: var(--white);
  font-size: .72rem; padding: .5rem .95rem; border-radius: 999px; white-space: nowrap; transition: background var(--transition); }
.dl:hover { background: var(--green-mid); color: var(--white); }
.dl.ghost { background: transparent; color: var(--green-dark); border: 1px solid var(--color-border-medium); }
.dl.ghost:hover { background: var(--cream); color: var(--green-dark); }
.doc-body { padding: 1.6rem 1.9rem 1.9rem; }

.markdown-body { font-size: .92rem; color: var(--black); }
.markdown-body h1, .markdown-body h2, .markdown-body h3 { font-family: var(--font-serif); font-weight: 400;
  color: var(--green-dark); line-height: 1.25; letter-spacing: -.01em; margin: 1.5em 0 .5em; }
.markdown-body h1 { font-size: 1.5rem; border-bottom: 1px solid var(--color-border-light); padding-bottom: .4rem; margin-top: .2em; }
.markdown-body h2 { font-size: 1.18rem; color: var(--green-mid); }
.markdown-body h3 { font-size: 1rem; }
.markdown-body p { margin-bottom: .85em; }
.markdown-body a { color: var(--green-mid); text-decoration: underline; text-decoration-color: rgba(127,169,142,.4); word-break: break-word; }
.markdown-body strong, .markdown-body b { font-weight: 600; color: var(--green-dark); }
.markdown-body em { color: var(--green-dark); }
.markdown-body blockquote { font-family: var(--font-serif); font-style: italic; color: var(--green-dark);
  border-left: 2.5px solid var(--amber); background: color-mix(in srgb, var(--cream) 55%, transparent);
  padding: .8rem 1.2rem; margin: 1.1em 0; border-radius: 0 10px 10px 0; }
.markdown-body code { font-family: var(--font-mono); font-size: .82em; background: var(--cream);
  color: var(--green-dark); padding: 1px 5px; border-radius: 5px; border: 1px solid var(--color-border-light); }
.markdown-body pre { background: color-mix(in srgb, var(--cream) 65%, transparent); border-left: 2.5px solid var(--amber);
  border-radius: 0 10px 10px 0; padding: 12px 16px; margin: 1.1em 0; overflow-x: auto; }
.markdown-body pre code { background: none; border: none; padding: 0; color: var(--black); white-space: pre-wrap; }
.markdown-body ul, .markdown-body ol { padding-left: 1.4em; margin-bottom: .85em; }
.markdown-body li { margin-bottom: .25em; }
.markdown-body table { border-collapse: collapse; width: 100%; margin: 1.2em 0; font-size: .8rem; display: block; overflow-x: auto; }
.markdown-body th { background: color-mix(in srgb, var(--cream) 70%, transparent); font-family: var(--font-mono);
  font-size: .6rem; font-weight: 500; text-transform: uppercase; letter-spacing: .1em; color: var(--gray-hi);
  padding: 7px 10px; border-bottom: 1.5px solid var(--green-dark); text-align: left; }
.markdown-body td { padding: 6px 10px; border-bottom: 1px solid var(--color-border-light); vertical-align: top; }
.markdown-body hr { border: none; border-top: 1px solid var(--color-border-light); margin: 1.6em 0; }
.markdown-body img { max-width: 100%; border-radius: 8px; }

.graph { background: var(--white); border: 1px solid var(--color-border-light); border-radius: 14px;
  padding: 1.1rem 1.1rem .8rem; margin: 1.4rem 0; }
.graph-img { display: block; max-width: 100%; max-height: 70vh; margin: 0 auto; border-radius: 8px;
  background: #fff; }
.graph figcaption { display: flex; flex-wrap: wrap; align-items: center; gap: .6rem;
  justify-content: space-between; margin-top: .7rem; padding-top: .6rem; border-top: 1px dashed var(--color-border-light); }
.g-cap { font-family: var(--font-mono); font-size: .68rem; letter-spacing: .04em; color: var(--amber); text-transform: uppercase; }
.g-links { display: inline-flex; align-items: center; gap: .6rem; flex-wrap: wrap; }
.g-link { font-family: var(--font-mono); font-size: .64rem; color: var(--green-dark);
  border: 1px solid var(--color-border-medium); padding: .28rem .6rem; border-radius: 999px;
  transition: all var(--transition); white-space: nowrap; }
.g-link:hover { background: var(--green-dark); color: var(--white); border-color: var(--green-dark); }
.g-src { font-family: var(--font-mono); font-size: .6rem; color: var(--gray); word-break: break-all; }
pre.mermaid-raw { font-size: .72rem; }

.pkg-table { border-collapse: collapse; width: 100%; margin: 1.2em 0; font-size: .78rem; display: block; overflow-x: auto; }
.pkg-table th { background: color-mix(in srgb, var(--cream) 70%, transparent); font-family: var(--font-mono);
  font-size: .6rem; font-weight: 500; text-transform: uppercase; letter-spacing: .1em; color: var(--gray-hi);
  padding: 7px 10px; border-bottom: 1.5px solid var(--green-dark); text-align: left; }
.pkg-table td { padding: 5px 10px; border-bottom: 1px solid var(--color-border-light); vertical-align: top; }
.pkg-table tr:hover td { background: color-mix(in srgb, var(--cream) 45%, transparent); }
.pkg-table .pkg-dir td { color: var(--gray); font-family: var(--font-mono); font-size: .7rem; }
.pkg-table .pkg-dir td:first-child { border-left: 2px solid var(--amber); }
.pkg-link { color: var(--green-mid); word-break: break-all; }
.pkg-link:hover { color: var(--amber); }

.assets-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.1rem; margin-top: 1.6rem; }
.asset-card { background: var(--paper); border: 1px solid var(--color-border-light); border-radius: 14px;
  padding: 1.1rem 1.2rem; transition: all var(--transition); }
.asset-card:hover { transform: translateY(-2px); border-color: var(--color-border-medium); box-shadow: 0 8px 24px rgba(28,69,50,.06); }
.asset-card h4 { font-family: var(--font-serif); font-weight: 500; font-size: .98rem; color: var(--green-dark); }
.asset-card .a-cap { font-size: .74rem; color: var(--color-text-secondary); margin: .25rem 0 .7rem; line-height: 1.5; }
.asset-card .a-links { display: flex; flex-wrap: wrap; gap: .45rem; }
.asset-card .a-links a { font-family: var(--font-mono); font-size: .62rem; color: var(--green-dark);
  border: 1px solid var(--color-border-medium); padding: .25rem .55rem; border-radius: 999px; transition: all var(--transition); }
.asset-card .a-links a:hover { background: var(--green-dark); color: var(--white); }

.notice { font-size: .82rem; color: var(--color-text-secondary); background: var(--paper);
  border: 1px solid var(--color-border-light); border-left: 2.5px solid var(--amber);
  border-radius: 0 10px 10px 0; padding: .9rem 1.2rem; margin: 1.4rem 0; }

.closing { text-align: center; padding: 5.5rem 6vw 4.5rem; }
.closing h2 { margin: 0 auto; }
.closing .lede { margin-left: auto; margin-right: auto; }
.closing .compose-mock { margin-left: auto; margin-right: auto; }
footer { border-top: 1px solid var(--color-border-light); padding: 1.8rem 6vw; display: flex;
  justify-content: space-between; align-items: center; flex-wrap: wrap; gap: .8rem;
  font-family: var(--font-mono); font-size: .66rem; color: var(--gray); }
footer .flinks { display: flex; gap: 1.2rem; }
footer a:hover { color: var(--amber); }

@keyframes subtle-pulse { 0%, 100% { opacity: .45; } 50% { opacity: .8; } }
@keyframes sway { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(1.4deg); } }
@keyframes sway-r { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(-1.1deg); } }
@keyframes fruit-glow { 0%, 100% { opacity: .8; } 50% { opacity: 1; } }
`;

// ── build ────────────────────────────────────────────────────────────────────
function buildPage() {
  const execSummary  = renderMdWithPkgLinks('00_EXECUTIVE_SUMMARY.md');
  const readMeFirst  = renderMdWithPkgLinks('00_READ_ME_FIRST.md');
  const asymReport   = renderReport(ASYM_REPORT, ASYM_FIGS);
  const frenteReport = renderReport(FRENTE_REPORT, FRENTE_FIGS);
  const pkgIndex     = packageIndex();

  const asymSrc = toRel(path.join(REPORTS, ASYM_REPORT));
  const frenteSrc = toRel(path.join(REPORTS, FRENTE_REPORT));

  const assetCards = [
    { title: 'Asymmetry Report — graphs', cap: 'Six rendered diagrams (SVG + PNG + Mermaid source) from the Asymmetry Report.', files: ASYM_FIGS.list },
    { title: 'Frente Amplio Cross-Analysis — graph', cap: 'The contradiction-loop diagram from the Frente Amplio cross-analysis.', files: FRENTE_FIGS.list },
  ].map((grp, gi) => {
    const links = grp.files.map((f, i) => {
      const parts = [];
      if (f.svg) parts.push(`<a href="${f.svg}" target="_blank" rel="noopener" download>SVG ${grp.files.length > 1 ? (i + 1) : ''}</a>`);
      if (f.png) parts.push(`<a href="${f.png}" target="_blank" rel="noopener" download>PNG ${grp.files.length > 1 ? (i + 1) : ''}</a>`);
      if (f.src) parts.push(`<a href="${f.src}" target="_blank" rel="noopener" download>Mermaid ${grp.files.length > 1 ? (i + 1) : ''}</a>`);
      return parts.join('');
    }).join('');
    return `<article class="asset-card reveal">
      <h4>${esc(grp.title)}</h4>
      <div class="a-cap">${esc(grp.cap)}</div>
      <div class="a-links">${links}</div>
    </article>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="color-scheme" content="light dark">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Olivia · Case LA8159 — Omission · Reading Package (EN)</title>
<meta name="description" content="English reading package for the Omission project (Case LA8159 / LATAM): executive summary, reading guide, full file index, the Asymmetry Report and the Frente Amplio Cross-Analysis with graphs.">
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='%231c4532'/><g transform='translate(6,7) scale(0.31)'><path d='M12 52 Q24 38,34 30 Q44 22,54 16' fill='none' stroke='%23faf9f6' stroke-width='2.5' stroke-linecap='round' opacity='.6'/><ellipse cx='22' cy='42' rx='4' ry='5' fill='%23c4622d'/></g></svg>">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,500;1,9..144,300;1,9..144,400&family=Plus+Jakarta+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
<style>${PAGE_CSS}</style>
</head>
<body>
<div class="rail"><span class="dot top"></span><span class="dot bottom"></span></div>
<nav id="nav">
  <a href="#top" class="logo">Olivia <span class="tag">Case LA8159 · Omission</span></a>
  <div class="nav-links">
    <a href="#summary">Summary</a>
    <a href="#guide">Reading guide</a>
    <a href="#package">Package files</a>
    <a href="#report-asym">Asymmetry report</a>
    <a href="#report-frente">Frente Amplio</a>
    <span class="agent-badge"><span class="d"></span> LA8159 · EN</span>
  </div>
</nav>

<header class="hero" id="top">
  <div class="hero-kicker">Omission Project · English edition · 2026-08-07</div>
  <div class="stage-view">
    <div class="morph-scene active" id="scene-tree">
      <svg width="200" height="220" viewBox="0 0 200 220">
        <g style="transform-origin:100px 110px;animation:sway 7s ease-in-out infinite">
          <path d="M100 210 Q99 185,98 165 Q97 145,99 125 Q100 110,101 98" fill="none" stroke="var(--green-dark)" stroke-width="3.5" stroke-linecap="round" opacity=".6"/>
          <path d="M70 208 Q100 212,130 208" fill="none" stroke="var(--green-dark)" stroke-width="1" stroke-linecap="round" opacity=".12"/>
          <g style="transform-origin:97px 120px;animation:sway-r 6s ease-in-out .3s infinite">
            <path d="M97 120 Q82 110,62 104" fill="none" stroke="var(--green-dark)" stroke-width="1.6" stroke-linecap="round" opacity=".45"/>
            <path d="M77 108 Q67 100,61 92 Q69 99,77 108Z" fill="var(--green-dark)" opacity=".4"/>
            <path d="M87 111 Q78 106,73 98 Q81 104,87 111Z" fill="var(--green-mid)" opacity=".35"/>
            <ellipse cx="67" cy="111" rx="4" ry="5" fill="var(--amber)" opacity=".85" transform="rotate(-8 67 111)" style="animation:fruit-glow 4s ease-in-out infinite"/>
          </g>
          <g style="transform-origin:103px 112px;animation:sway 5.5s ease-in-out .6s infinite">
            <path d="M103 112 Q118 104,132 101" fill="none" stroke="var(--green-dark)" stroke-width="1.4" stroke-linecap="round" opacity=".4"/>
            <path d="M118 105 Q128 98,134 92 Q129 101,118 105Z" fill="var(--green-dark)" opacity=".35"/>
            <path d="M112 107 Q120 102,125 96 Q120 104,112 107Z" fill="var(--green-mid)" opacity=".3"/>
          </g>
          <g style="transform-origin:101px 95px;animation:sway-r 5s ease-in-out .9s infinite">
            <path d="M101 95 Q90 86,77 82" fill="none" stroke="var(--green-dark)" stroke-width="1.2" stroke-linecap="round" opacity=".38"/>
            <path d="M84 88 Q76 80,71 72 Q78 79,84 88Z" fill="var(--green-dark)" opacity=".35"/>
          </g>
          <g style="transform-origin:102px 76px;animation:sway 4.5s ease-in-out 1s infinite">
            <path d="M102 76 Q98 63,95 51" fill="none" stroke="var(--green-dark)" stroke-width=".9" stroke-linecap="round" opacity=".3"/>
            <path d="M97 58 Q92 50,89 42 Q94 49,97 58Z" fill="var(--green-mid)" opacity=".3"/>
          </g>
        </g>
      </svg>
    </div>
    <div class="morph-scene" id="scene-legal">
      <svg width="200" height="220" viewBox="0 0 200 220">
        <g style="transform-origin:100px 100px">
          <path d="M100 190 Q100 150,100 110 Q100 88,100 68" fill="none" stroke="var(--green-dark)" stroke-width="3" stroke-linecap="round" opacity=".6"/>
          <g style="animation:sway-r 6s ease-in-out infinite;transform-origin:100px 68px">
            <path d="M38 78 Q70 68,100 70 Q130 68,162 78" fill="none" stroke="var(--green-dark)" stroke-width="2" stroke-linecap="round" opacity=".55"/>
            <path d="M47 81 L47 108" fill="none" stroke="var(--green-dark)" stroke-width="1" opacity=".4"/>
            <path d="M38 78 L34 106" fill="none" stroke="var(--green-dark)" stroke-width="1" opacity=".35"/>
            <ellipse cx="40" cy="112" rx="18" ry="5" fill="none" stroke="var(--green-dark)" stroke-width="1.2" opacity=".45"/>
            <path d="M153 81 L153 108" fill="none" stroke="var(--green-dark)" stroke-width="1" opacity=".4"/>
            <path d="M162 78 L166 106" fill="none" stroke="var(--green-dark)" stroke-width="1" opacity=".35"/>
            <ellipse cx="160" cy="112" rx="18" ry="5" fill="none" stroke="var(--green-dark)" stroke-width="1.2" opacity=".45"/>
            <ellipse cx="35" cy="106" rx="4.5" ry="5.5" fill="var(--amber)" opacity=".85" style="animation:fruit-glow 4s ease-in-out infinite"/>
            <ellipse cx="160" cy="105" rx="4.5" ry="5.5" fill="var(--amber)" opacity=".85" style="animation:fruit-glow 4s ease-in-out .6s infinite"/>
          </g>
          <ellipse cx="100" cy="58" rx="5" ry="6.5" fill="var(--amber)" opacity=".9" style="animation:fruit-glow 4s ease-in-out .5s infinite"/>
        </g>
      </svg>
    </div>
    <div class="morph-scene" id="scene-book">
      <svg width="200" height="220" viewBox="0 0 200 220">
        <g style="transform-origin:100px 110px;animation:sway 8s ease-in-out infinite">
          <path d="M100 195 Q100 165,100 135 Q100 112,100 88" fill="none" stroke="var(--green-dark)" stroke-width="3" stroke-linecap="round" opacity=".55"/>
          <g style="animation:sway-r 5s ease-in-out infinite">
            <path d="M100 88 Q76 85,55 96 Q45 102,41 114" fill="none" stroke="var(--green-dark)" stroke-width="1.4" stroke-linecap="round" opacity=".35"/>
            <path d="M100 104 Q72 99,50 112 Q42 118,39 128" fill="none" stroke="var(--green-dark)" stroke-width="1" stroke-linecap="round" opacity=".25"/>
            <path d="M64 100 Q54 92,48 82 Q56 89,64 100Z" fill="var(--green-dark)" opacity=".3"/>
            <path d="M57 115 Q47 108,41 99 Q49 105,57 115Z" fill="var(--green-mid)" opacity=".25"/>
          </g>
          <g style="animation:sway 5.5s ease-in-out .3s infinite">
            <path d="M100 88 Q124 85,145 96 Q155 102,159 114" fill="none" stroke="var(--green-dark)" stroke-width="1.4" stroke-linecap="round" opacity=".35"/>
            <path d="M100 104 Q128 99,150 112 Q158 118,161 128" fill="none" stroke="var(--green-dark)" stroke-width="1" stroke-linecap="round" opacity=".25"/>
            <path d="M136 100 Q146 92,152 82 Q144 89,136 100Z" fill="var(--green-dark)" opacity=".3"/>
            <path d="M143 115 Q153 108,159 99 Q151 105,143 115Z" fill="var(--green-mid)" opacity=".25"/>
          </g>
          <ellipse cx="100" cy="78" rx="4.5" ry="5.5" fill="var(--amber)" opacity=".85" style="animation:fruit-glow 4s ease-in-out infinite"/>
        </g>
      </svg>
    </div>
  </div>
  <div id="morphLabel" class="morph-label">Omission</div>
  <div id="morphSub" class="morph-sub">One passenger against the architecture of silence — the documented record of every attempt, every refusal, every unanswered plea.</div>
  <div class="pills">
    <button class="pill active" onclick="morph('tree')"><i class="fas fa-seedling"></i> Case</button>
    <button class="pill" onclick="morph('legal')"><i class="fas fa-scale-balanced"></i> Justice</button>
    <button class="pill" onclick="morph('book')"><i class="fas fa-book"></i> Record</button>
  </div>
  <button class="compose-mock" onclick="document.getElementById('summary').scrollIntoView({behavior:'smooth'})">
    <span>Start reading — Executive summary…</span>
    <span class="send-btn" tabindex="-1"><i class="fas fa-arrow-up"></i></span>
  </button>
  <div class="scroll-hint">Scroll</div>
</header>

<section class="quiet reveal" id="summary">
  <span class="kicker">01 — Executive summary</span>
  <h2>The case in <em>one page</em></h2>
  <div class="doc">
    <div class="doc-head">
      <span class="n">01</span>
      <div>
        <h3>Executive Summary — Project <em>Omission</em></h3>
        <div class="src">reading_package_EN/00_EXECUTIVE_SUMMARY.md · 1 min</div>
      </div>
      <span class="spacer"></span>
      <div class="doc-actions">
        <a class="dl ghost" href="reading_package_EN/00_EXECUTIVE_SUMMARY.md" target="_blank" rel="noopener"><i class="fas fa-book-open"></i> Open source</a>
        <a class="dl" href="reading_package_EN/00_EXECUTIVE_SUMMARY.md" download><i class="fas fa-file-arrow-down"></i> Download</a>
      </div>
    </div>
    <div class="doc-body markdown-body">${execSummary}</div>
  </div>
</section>

<section class="quiet reveal" id="guide">
  <span class="kicker">02 — Reading guide</span>
  <h2>How to read the <em>package</em></h2>
  <p class="lede">Start here if you are new to the project. The guide explains what the case is, how the package is organised, the recommended reading order, ID conventions and the verification states used across every document.</p>
  <div class="doc">
    <div class="doc-head">
      <span class="n">02</span>
      <div>
        <h3>Read Me First</h3>
        <div class="src">reading_package_EN/00_READ_ME_FIRST.md · 5 min</div>
      </div>
      <span class="spacer"></span>
      <div class="doc-actions">
        <a class="dl ghost" href="reading_package_EN/00_READ_ME_FIRST.md" target="_blank" rel="noopener"><i class="fas fa-book-open"></i> Open source</a>
        <a class="dl" href="reading_package_EN/00_READ_ME_FIRST.md" download><i class="fas fa-file-arrow-down"></i> Download</a>
      </div>
    </div>
    <div class="doc-body markdown-body">${readMeFirst}</div>
  </div>
</section>

<section class="wide reveal" id="package">
  <span class="kicker">03 — Full package — every file accessible</span>
  <h2>All <em>files</em>, one index</h2>
  <p class="lede">Every file of the English reading package, in its recommended reading order. Each row opens the original Markdown document in a new tab (or downloads it). Folders are listed as headers.</p>
  <div class="notice"><i class="fas fa-folder-open"></i> Package folder: <code>outputs/reading_package_EN/</code> · generated by the LA8159 Orchestrator · 2026-08-07</div>
  ${pkgIndex}
  <div class="meta-strip">
    <span class="meta-chip">Context <b>01_CONTEXT</b></span>
    <span class="meta-chip">Narrative <b>02_NARRATIVE</b></span>
    <span class="meta-chip">Evidence <b>03_EVIDENCE</b></span>
    <span class="meta-chip">Registry <b>04_COMMUNICATIONS_REGISTRY</b></span>
    <span class="meta-chip">Contact map <b>05_CONTACT_MAP</b></span>
    <span class="meta-chip">LinkedIn <b>06_LINKEDIN_DOCUMENTATION</b></span>
    <span class="meta-chip">Case files <b>07_CASE_FILES</b></span>
    <span class="meta-chip">Raw sources <b>08_RAW_SOURCES</b></span>
    <span class="meta-chip">Agent logs <b>09_AGENT_LOGS</b></span>
  </div>
</section>

<section class="wide reveal" id="report-asym">
  <span class="kicker">04 — New report 1 · with graphs</span>
  <h2>Asymmetry Report — <em>the architecture of silence</em></h2>
  <p class="lede">Power, response and access-to-justice asymmetry in Case LA8159. The full report is rendered below with its six diagrams (pie, response landscape, correlated timeline, legal cascade, blockades and the self-reinforcing loop).</p>
  <div class="doc">
    <div class="doc-head">
      <span class="n">A</span>
      <div>
        <h3>Asymmetry Report — <em>Omission</em> Project (Case LA8159 / LATAM)</h3>
        <div class="src">uploads/reports/${esc(ASYM_REPORT)} · ASYM-2026-08-07-EN</div>
      </div>
      <span class="spacer"></span>
      <div class="doc-actions">
        <a class="dl ghost" href="${asymSrc}" target="_blank" rel="noopener"><i class="fas fa-book-open"></i> Open report</a>
        <a class="dl" href="${asymSrc}" download><i class="fas fa-file-arrow-down"></i> Download .md</a>
      </div>
    </div>
    <div class="doc-body markdown-body">${asymReport}</div>
  </div>
</section>

<section class="wide reveal" id="report-frente">
  <span class="kicker">05 — New report 2 · with graph</span>
  <h2>Frente Amplio declaration vs. <em>documented reality</em></h2>
  <p class="lede">Cross-analysis of the Frente Amplio human-rights declaration (6 Aug 2026) against the documented asymmetry of Case LA8159, including the contradiction-loop diagram.</p>
  <div class="doc">
    <div class="doc-head">
      <span class="n">B</span>
      <div>
        <h3>Cross-Analysis — Frente Amplio’s Human Rights Declaration vs. Documented Asymmetry</h3>
        <div class="src">uploads/reports/${esc(FRENTE_REPORT)} · 2026-08-07</div>
      </div>
      <span class="spacer"></span>
      <div class="doc-actions">
        <a class="dl ghost" href="${frenteSrc}" target="_blank" rel="noopener"><i class="fas fa-book-open"></i> Open report</a>
        <a class="dl" href="${frenteSrc}" download><i class="fas fa-file-arrow-down"></i> Download .md</a>
      </div>
    </div>
    <div class="doc-body markdown-body">${frenteReport}</div>
  </div>
</section>

<section class="wide reveal" id="assets">
  <span class="kicker">06 — Graph assets</span>
  <h2>Rendered graphs, <em>downloadable</em></h2>
  <p class="lede">All rendered diagrams live in <code>data/graphs/</code>. Each is available as SVG (vector), PNG (high-resolution) and the original Mermaid source.</p>
  <div class="assets-grid">${assetCards}</div>
  <div class="meta-strip">
    <span class="meta-chip">Folder <b>data/graphs/asymetry-report/</b></span>
    <span class="meta-chip">Folder <b>data/graphs/frente-amplio-IACHR/</b></span>
  </div>
</section>

<section class="closing reveal" id="mission">
  <div class="kicker" style="justify-content:center;display:flex">Omission — Case LA8159</div>
  <h2>Silence isn't neutral. <em>It becomes part of the violation itself.</em></h2>
  <p class="lede">Every file in this package is a documented, verifiable record of what was sent, to whom, and what — if anything — came back.</p>
  <button class="compose-mock" onclick="document.getElementById('summary').scrollIntoView({behavior:'smooth'})">
    <span>Back to the top…</span>
    <span class="send-btn" tabindex="-1"><i class="fas fa-arrow-up"></i></span>
  </button>
</section>

<footer>
  <span>© Olivia Ecosystem — Omission Project · Case LA8159 / LATAM</span>
  <div class="flinks">
    <a href="#summary">Summary</a>
    <a href="#guide">Guide</a>
    <a href="#package">Files</a>
    <a href="#report-asym">Asymmetry</a>
    <a href="#report-frente">Frente Amplio</a>
  </div>
</footer>
<script>
  const nav = document.getElementById('nav');
  window.addEventListener('scroll', () => nav.classList.toggle('scrolled', window.scrollY > 12), { passive: true });
  document.querySelectorAll('.reveal').forEach(el => {
    new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in'); });
    }, { threshold: .08 }).observe(el);
  });
  const meta = {
    tree: { label: 'Omission', sub: 'One passenger against the architecture of silence — the documented record of every attempt, every refusal, every unanswered plea.' },
    legal: { label: 'Access to justice', sub: '30+ lawyers contacted, none retained. Regulators deflected. The closer to power, the louder the silence.' },
    book: { label: 'The record', sub: '203 public comments, 156 conversations, 29 verified emails, 9 + 16 + 4 messages to the Presidency and Congress — all preserved.' }
  };
  function morph(id) {
    document.querySelectorAll('.morph-scene').forEach(s => s.classList.remove('active'));
    const sceneEl = document.getElementById('scene-' + id);
    if (sceneEl) sceneEl.classList.add('active');
    document.querySelectorAll('.pills .pill').forEach(p => p.classList.remove('active'));
    const pillEl = document.querySelector(".pills .pill[onclick*='" + id + "']");
    if (pillEl) pillEl.classList.add('active');
    const m = meta[id] || meta.tree;
    const lbl = document.getElementById('morphLabel');
    const sub = document.getElementById('morphSub');
    if (!lbl || !sub) return;
    lbl.style.opacity = '0'; sub.style.opacity = '0';
    setTimeout(() => { lbl.textContent = m.label; sub.textContent = m.sub; lbl.style.opacity = '1'; sub.style.opacity = '1'; }, 220);
  }
  console.log('Olivia · Case LA8159 — Omission · Reading Package (EN)');
</script>
</body>
</html>`;
}

// ── main ─────────────────────────────────────────────────────────────────────
function main() {
  if (!fs.existsSync(PACK)) { console.error('Reading package not found: ' + PACK); process.exit(1); }
  if (!fs.existsSync(REPORTS)) { console.error('Reports folder not found: ' + REPORTS); process.exit(1); }
  fs.writeFileSync(OUT, buildPage());
  console.log('OK — generated ' + OUT + ' (' + humanSize(fileSize(OUT)) + ')');
}

main();
