/* ═══════════════════════════════════════════════════════════════════
   OUTPUT MODULE - Output panel, artifact display, and browser panel
   ═══════════════════════════════════════════════════════════════════ */

// Global output variables — use the shared outputArtifacts array from config.js
// (outputArtifacts is declared in config.js as the canonical store)
let artifactViewMode = 'grid';
let currentModalArtifactId = null;
let currentOutputArtifactId = null;
let _outputTabsDockTimer = null;
let _outputAutoOpenSuppressedUntil = 0;
let _panelStateSyncObserver = null;
let _panelStateSyncBound = false;
const OUTPUT_AUTO_OPEN_SUPPRESS_MS = 45000;

// ── Disk artifact polling (artifacts/ folder) ──
let _artifactPollTimer = null;
let _diskArtifactNames = new Set(); // names already in outputArtifacts from disk

// Preview panel state — set by openPreviewUrl so download/maximize work
window._previewState = { url: null, name: null };
const OUTPUT_HTML_SANDBOX = 'allow-scripts allow-forms allow-popups allow-modals';

function _upgradeInsecurePreviewHtml(html) {
  const source = String(html || '');
  if (!source) return source;
  let normalized = source
    .replace(/\b(src|href|poster)\s*=\s*(["'])http:\/\//gi, '$1=$2https://')
    .replace(/url\(\s*(["']?)http:\/\//gi, 'url($1https://');

  const upgradeMeta = '<meta http-equiv="Content-Security-Policy" content="upgrade-insecure-requests">';
  if (/\<head[\s>]/i.test(normalized)) {
    normalized = normalized.replace(/<head([^>]*)>/i, `<head$1>${upgradeMeta}`);
  } else {
    normalized = `${upgradeMeta}${normalized}`;
  }
  return normalized;
}

function _escapeHtmlAttr(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function _projectRawBaseHref(rawUrl) {
  if (!rawUrl) return '';
  try {
    const parsed = new URL(rawUrl, window.location.origin);
    const match = parsed.pathname.match(/^\/api\/projects\/([^/]+)\/raw$/);
    if (!match) return '';
    const relPath = String(parsed.searchParams.get('path') || '').replace(/\\/g, '/');
    if (!relPath) return '';
    const slash = relPath.lastIndexOf('/');
    if (slash < 0) return '';
    const dirPath = relPath.slice(0, slash + 1);
    return `${parsed.origin}/api/projects/${encodeURIComponent(match[1])}/raw?path=${encodeURIComponent(dirPath)}`;
  } catch (_) {
    return '';
  }
}

function _injectBaseHref(html, baseHref) {
  const source = String(html || '');
  const href = String(baseHref || '').trim();
  if (!href) return source;
  const baseTag = `<base href="${_escapeHtmlAttr(href)}">`;
  if (/<base\b[^>]*>/i.test(source)) {
    return source.replace(/<base\b[^>]*>/i, baseTag);
  }
  if (/<head\b[^>]*>/i.test(source)) {
    return source.replace(/<head\b([^>]*)>/i, `<head$1>${baseTag}`);
  }
  return `${baseTag}${source}`;
}

function _prepareHtmlForIframe(html, sourceUrl) {
  const upgraded = _upgradeInsecurePreviewHtml(html);
  const baseHref = _projectRawBaseHref(sourceUrl);
  return _injectBaseHref(upgraded, baseHref);
}

// Download whatever is currently shown in the preview panel
function downloadCurrentPreview() {
  const s = window._previewState;
  if (!s || !s.url) return;
  const a = document.createElement('a');
  a.href = s.url;
  a.download = s.name || 'download';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function downloadPreviewAsPdf() {
  const s = window._previewState;
  if (!s || !s.url) return;

  const ext = (s.name || '').split('.').pop().toLowerCase();
  const previewType = (typeof window.resolvePreviewFileType === 'function')
    ? window.resolvePreviewFileType(s.name || '', { fileType: ext })
    : ext;

  if (previewType !== 'markdown' && previewType !== 'md') {
    const msg = 'PDF export is available for Markdown files only.';
    if (typeof window.toastInfo === 'function') window.toastInfo(msg);
    else if (typeof addSystemBubble === 'function') addSystemBubble(msg);
    return;
  }

  (async () => {
    let mdText = '';
    try {
      const res = await fetch(s.url);
      mdText = await res.text();
    } catch (_) {
      const msg = 'Could not load the Markdown source for PDF export.';
      if (typeof window.toastError === 'function') window.toastError(msg);
      return;
    }

    // Render Markdown → HTML; fall back to escaped pre-block.
    let bodyHtml = '';
    if (window.marked && typeof marked.parse === 'function') {
      try { bodyHtml = marked.parse(mdText); } catch (_) { }
    }
    if (!bodyHtml) {
      bodyHtml = `<pre style="white-space:pre-wrap">${escapeHtml(mdText)}</pre>`;
    }

    const displayName = s.name || 'document';
    const docTitle = displayName.replace(/\.(md|markdown)$/i, '');
    const stamp = new Date().toLocaleString();
    const isoDate = new Date().toISOString().slice(0, 10);

    // ── Olive branch mark (matches the project favicon exactly) ──────────────
    const oliveMark = `<svg width="28" height="28" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" style="display:block">
  <rect width="32" height="32" rx="8" fill="#1c4532"/>
  <g transform="translate(6,7) scale(0.31)">
    <path d="M12 52 Q24 38,34 30 Q44 22,54 16" fill="none" stroke="#faf9f6" stroke-width="2.5" stroke-linecap="round" opacity=".65"/>
    <path d="M28 36 Q20 26,16 18 Q24 24,28 36Z"   fill="#faf9f6" opacity=".4"/>
    <path d="M30 34 Q38 24,44 18 Q38 28,30 34Z"   fill="#faf9f6" opacity=".38"/>
    <path d="M42 24 Q36 14,34 8  Q40 14,42 24Z"   fill="#faf9f6" opacity=".35"/>
    <ellipse cx="22" cy="42" rx="4" ry="5" fill="#c4622d"/>
  </g>
</svg>`;

    const printDoc = /* html */`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(docTitle)}</title>
<!-- Olivia brand type stack: Fraunces · Plus Jakarta Sans · JetBrains Mono -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,500;1,9..144,300;1,9..144,400&family=Plus+Jakarta+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
/* ── Page geometry ───────────────────────────────────────────────────── */
@page {
  margin: 22mm 18mm 20mm;
}
@page:first {
  margin-top: 18mm; /* header is rendered in-flow, not as a @page margin box */
}

/* ── Design tokens (mirrors the workspace CSS) ─────────────────────── */
:root {
  --green-dark:  #1c4532;
  --green-mid:   #2d785a;
  --green-light: #5a8a6e;
  --amber:       #c4622d;
  --amber-light: #d4733e;
  --cream:       #f8f5ee;
  --paper:       #fdfcf9;
  --gray:        #9a9088;
  --gray-hi:     #5a5a5a;
  --ink:         #1a1a1a;
  --border:      rgba(28, 69, 50, .14);
  --font-serif:  'Fraunces', Georgia, serif;
  --font-sans:   'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
  --font-mono:   'JetBrains Mono', monospace;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: var(--font-sans);
  background: #ffffff;
  color: var(--ink);
  font-size: 10.5pt;
  line-height: 1.7;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

/* ── Page header ────────────────────────────────────────────────────── */
.doc-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-bottom: 12px;
  margin-bottom: 30px;
  border-bottom: 1.5px solid var(--green-dark);
}
.doc-header-mark { flex-shrink: 0; line-height: 0; }
.doc-header-brand {
  font-family: var(--font-serif);
  font-size: 13.5pt;
  font-weight: 400;
  color: var(--green-dark);
  letter-spacing: -0.015em;
  line-height: 1;
}
.doc-header-brand span {
  font-style: italic;
  font-weight: 300;
  color: var(--amber);
  font-size: 10pt;
  margin-left: 6px;
  letter-spacing: 0;
}
.doc-header-meta {
  margin-left: auto;
  text-align: right;
  font-family: var(--font-mono);
  font-size: 7pt;
  color: var(--gray);
  line-height: 1.6;
}
.doc-header-meta strong {
  display: block;
  color: var(--gray-hi);
  font-weight: 500;
  font-size: 7.5pt;
}

/* ── Prose typography ────────────────────────────────────────────────── */
h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-serif);
  font-weight: 400;
  color: var(--green-dark);
  line-height: 1.22;
  letter-spacing: -0.012em;
  margin-top: 1.9em;
  margin-bottom: 0.55em;
  break-after: avoid;
}
h1 {
  font-size: 18pt;
  margin-top: 0;
  padding-bottom: 9px;
  border-bottom: 1px solid var(--border);
}
h2 { font-size: 14pt; }
h3 { font-size: 12pt; color: var(--green-mid); }
h4, h5, h6 {
  font-family: var(--font-sans);
  font-size: 8pt;
  font-weight: 600;
  color: var(--gray-hi);
  text-transform: uppercase;
  letter-spacing: .12em;
}

/* Italic within headings matches the brand pattern: em → amber italic */
h1 em, h2 em, h3 em {
  font-style: italic;
  font-weight: 300;
  color: var(--amber);
}

p { margin-bottom: 0.85em; }
p:last-child { margin-bottom: 0; }

a {
  color: var(--green-mid);
  text-decoration: underline;
  text-decoration-color: rgba(45, 120, 90, .3);
}

strong, b { font-weight: 600; color: var(--green-dark); }

/* ── Block elements ─────────────────────────────────────────────────── */
/* Blockquote — mirrors the .quote component: Fraunces italic, amber rail */
blockquote {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 11pt;
  color: var(--green-dark);
  border-left: 2px solid var(--amber);
  padding: 3px 14px;
  margin: 1.3em 0;
  break-inside: avoid;
}

/* Code — inline */
code {
  font-family: var(--font-mono);
  font-size: .82em;
  background: var(--cream);
  color: var(--green-dark);
  padding: 1px 5px;
  border-radius: 4px;
  border: 1px solid var(--border);
}

/* Code — block: cream background, amber left rail (mirrors .story-tree / pre in workspace) */
pre {
  background: var(--cream);
  border-left: 2.5px solid var(--amber);
  border-radius: 0 7px 7px 0;
  padding: 11px 14px;
  margin: 1.2em 0;
  overflow-wrap: break-word;
  white-space: pre-wrap;
  break-inside: avoid;
}
pre code {
  background: none;
  border: none;
  padding: 0;
  font-size: .85em;
  line-height: 1.6;
  color: var(--ink);
}

/* Lists */
ul, ol { padding-left: 1.35em; margin-bottom: 0.85em; }
li { margin-bottom: 0.22em; }
li > ul, li > ol { margin-top: 0.2em; margin-bottom: 0.2em; }

/* Tables — header row uses the kicker / dash-lbl monospace uppercase style */
table {
  border-collapse: collapse;
  width: 100%;
  margin: 1.3em 0;
  font-size: 9.5pt;
  break-inside: avoid;
}
th {
  background: var(--cream);
  font-family: var(--font-mono);
  font-size: 7pt;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: .1em;
  color: var(--gray-hi);
  padding: 7px 10px;
  border-bottom: 1.5px solid var(--green-dark);
  text-align: left;
}
td {
  padding: 6px 10px;
  border-bottom: 1px solid var(--border);
  vertical-align: top;
}
tr:last-child td { border-bottom: none; }
tr:nth-child(even) td { background: rgba(248, 245, 238, .45); }

/* Images */
img { max-width: 100%; height: auto; border-radius: 6px; }

/* Rule — subtle, brand-tinted */
hr { border: none; border-top: 1px solid var(--border); margin: 1.6em 0; }

/* ── Page footer ─────────────────────────────────────────────────────── */
.doc-footer {
  margin-top: 36px;
  padding-top: 10px;
  border-top: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-family: var(--font-mono);
  font-size: 7pt;
  color: var(--gray);
}
/* Olivia wordmark — mirrors the .wm pattern used across all pages */
.wm { display: flex; align-items: baseline; gap: 5px; }
.wm-n { font-family: var(--font-serif); font-size: 9pt; color: var(--green-dark); letter-spacing: -0.01em; }
.wm-s { font-size: 6.5pt; text-transform: uppercase; letter-spacing: .1em; color: var(--gray); }

/* ── Print overrides ─────────────────────────────────────────────────── */
@media print {
  body { background: #fff; }
  a    { color: var(--green-mid) !important; }
  pre, blockquote, table { break-inside: avoid; }
  h1, h2, h3 { break-after: avoid; }
}
</style>
</head>
<body>

  <!-- ── Header ────────────────────────────────────────────── -->
  <div class="doc-header">
    <div class="doc-header-mark">${oliveMark}</div>
    <div class="doc-header-brand">Olivia <span>ecosystem</span></div>
    <div class="doc-header-meta">
      <strong>${escapeHtml(displayName)}</strong>
      ${escapeHtml(stamp)}
    </div>
  </div>

  <!-- ── Body ──────────────────────────────────────────────── -->
  <div class="markdown-body">${bodyHtml}</div>

  <!-- ── Footer ────────────────────────────────────────────── -->
  <div class="doc-footer">
    <div class="wm">
      <span class="wm-n">Olivia</span>
      <span class="wm-s">Awareness · AI</span>
    </div>
    <span>Generated from workspace preview · ${escapeHtml(isoDate)}</span>
  </div>

</body>
</html>`;

    // Create a hidden iframe and print from it.
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    document.body.appendChild(iframe);

    const cleanup = () => { try { document.body.removeChild(iframe); } catch (_) { } };

    iframe.onload = () => {
      const win = iframe.contentWindow;
      const doPrint = () => {
        try {
          win.document.title = docTitle + '.pdf';
          win.focus();
          win.print();
        } catch (_) { }
        setTimeout(cleanup, 2000);
      };

      // Wait for Google Fonts to finish loading before triggering print,
      // so the PDF captures Fraunces / Plus Jakarta Sans / JetBrains Mono.
      if (win.document.fonts && typeof win.document.fonts.ready?.then === 'function') {
        win.document.fonts.ready.then(doPrint).catch(doPrint);
      } else {
        setTimeout(doPrint, 700);
      }
    };

    iframe.srcdoc = printDoc;
  })();
}

// Open the current preview in the fullscreen artifact modal
function maximizeCurrentPreview() {
  const s = window._previewState;
  if (!s || !s.url) return;
  const ext = (s.name || '').split('.').pop().toLowerCase();
  const type = (typeof window.resolvePreviewFileType === 'function')
    ? window.resolvePreviewFileType(s.name || '', { fileType: ext })
    : ext;
  const fakeArt = { id: '__preview_max__', title: s.name || 'File', url: s.url, type };
  renderArtifactModalContent(fakeArt);
  openArtifactModal();
}

// ── Poll artifacts/ on disk ────────────────────────────────────────────────
function startArtifactPolling() {
  stopArtifactPolling();
  _diskArtifactNames.clear(); // reset so all current disk files show up fresh
  _pollArtifactsNow();
  _artifactPollTimer = setInterval(_pollArtifactsNow, 6000);
}

function stopArtifactPolling() {
  if (_artifactPollTimer) { clearInterval(_artifactPollTimer); _artifactPollTimer = null; }
}

async function _pollArtifactsNow() {
  const agent = window.selectedAgent;
  if (!agent || !agent.agent_id) return;
  try {
    const res = await fetch(`${API_BASE}/api/agents/${encodeURIComponent(agent.agent_id)}/artifacts`);
    if (!res.ok) return;
    const data = await res.json();
    let changed = false;
    for (const file of (data.artifacts || [])) {
      if (_diskArtifactNames.has(file.name)) continue;
      _diskArtifactNames.add(file.name);
      const ext = file.name.split('.').pop().toLowerCase();
      const url = `${API_BASE}/api/agents/${encodeURIComponent(agent.agent_id)}/artifacts/${encodeURIComponent(file.name)}`;
      outputArtifacts.push({
        id: 'disk:' + file.name,
        title: file.name,
        type: ext,
        size: file.size,
        url,
        _diskFile: true,
      });
      changed = true;
    }
    if (changed) {
      renderOutputTabs();
      updateArtifactCount();
      renderGeneratedFiles();
    }
  } catch (e) { /* silently ignore network errors */ }
}

// Initialize all panel resize handles (horizontal col-resize)
function initOutputResize() {
  _initPanelStateSync();
  _initHorizResize('outputResizeHandle', 'outputPanel');
  _initHorizResize('previewResizeHandle', 'previewPanel');
  _initHorizResize('browserResizeHandle', 'browserPanel');
  _syncWorkspacePanels();
}

function _panelIsVisiblyOpen(el) {
  if (!el || !el.classList || !el.classList.contains('open')) return false;
  try {
    return window.getComputedStyle(el).display !== 'none';
  } catch (_) {
    return true;
  }
}

function _isOutputAutoOpenSuppressed() {
  return Date.now() < _outputAutoOpenSuppressedUntil;
}

function _syncWorkspacePanels() {
  const outputPanel = document.getElementById('outputPanel');
  const previewPanel = document.getElementById('previewPanel');
  const browserPanel = document.getElementById('browserPanel');

  const outputHandle = document.getElementById('outputResizeHandle');
  const previewHandle = document.getElementById('previewResizeHandle');
  const browserHandle = document.getElementById('browserResizeHandle');
  const edgeToggle = document.getElementById('outputEdgeToggle');

  const outputOpen = _panelIsVisiblyOpen(outputPanel);
  const previewOpenClass = !!(previewPanel && previewPanel.classList.contains('open'));

  // Some modules toggle .open directly on previewPanel; ensure it's actually shown.
  if (previewPanel && previewOpenClass && previewPanel.style.display === 'none') {
    previewPanel.style.display = 'flex';
  }

  const previewOpen = _panelIsVisiblyOpen(previewPanel);
  const browserOpen = _panelIsVisiblyOpen(browserPanel);

  // A closed panel must not retain a stale inline width. The horizontal resize
  // handle writes panel.style.width (e.g. "451px"); an inline width outranks the
  // .open class, so a panel that was resized once would stay visibly open even
  // after its .open class is removed — i.e. it would "sometimes" fail to close.
  // Clearing the inline width here (the panels' open/closed state is governed
  // solely by the .open class) lets the CSS width:0 rule collapse it.
  [outputPanel, previewPanel, browserPanel].forEach(p => {
    if (p && !p.classList.contains('open') && p.style.width) p.style.width = '';
  });

  if (edgeToggle) {
    edgeToggle.classList.toggle('hidden', outputOpen);
    edgeToggle.classList.toggle('open', outputOpen);
  }
  if (outputHandle) outputHandle.classList.toggle('visible', outputOpen);
  if (previewHandle) previewHandle.classList.toggle('visible', previewOpen);
  if (browserHandle) browserHandle.classList.toggle('visible', browserOpen);

  _refreshWorkspacePanelsBusy();
  if (typeof window.refreshPanelContextStatus === 'function') {
    window.refreshPanelContextStatus();
  }
}

function _initPanelStateSync() {
  if (_panelStateSyncBound) return;
  _panelStateSyncBound = true;

  const targets = ['outputPanel', 'previewPanel', 'browserPanel']
    .map(id => document.getElementById(id))
    .filter(Boolean);

  if (typeof MutationObserver !== 'undefined' && targets.length) {
    _panelStateSyncObserver = new MutationObserver(function () {
      _syncWorkspacePanels();
    });
    targets.forEach(function (el) {
      _panelStateSyncObserver.observe(el, { attributes: true, attributeFilter: ['class', 'style'] });
    });
  }

  window.addEventListener('resize', _syncWorkspacePanels);
}

function _initHorizResize(handleId, panelId) {
  const handle = document.getElementById(handleId);
  const panel = document.getElementById(panelId);
  if (!handle || !panel) return;
  if (handle.dataset.resizeBound === '1') return;
  handle.dataset.resizeBound = '1';

  let dragging = false, startX = 0, startW = 0;
  const minW = 220;

  const stopDragging = () => {
    if (!dragging) return;
    dragging = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    document.body.classList.remove('is-panel-resizing');
    panel.classList.remove('resizing');
    handle.classList.remove('dragging');
  };

  handle.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    if (!panel.classList.contains('open')) return;
    dragging = true;
    startX = e.clientX;
    startW = panel.offsetWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.body.classList.add('is-panel-resizing');
    panel.classList.add('resizing');
    handle.classList.add('dragging');
    e.preventDefault();
  });

  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    const delta = startX - e.clientX; // dragging left = growing panel
    const maxW = Math.max(minW, Math.floor(window.innerWidth * 0.9));
    const newW = Math.min(maxW, Math.max(minW, startW + delta));
    panel.style.width = newW + 'px';
  });

  document.addEventListener('mouseup', stopDragging);
  window.addEventListener('mouseup', stopDragging, true);
  window.addEventListener('blur', stopDragging);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopDragging();
  });
}

// Toggle output panel
function toggleOutputPanel() {
  const panel = document.getElementById('outputPanel');
  if (!panel) return;
  const willOpen = !panel.classList.contains('open');
  panel.classList.toggle('open', willOpen);
  const toggle = document.getElementById('outputEdgeToggle');
  if (toggle) toggle.classList.toggle('open', willOpen);
  if (willOpen) {
    _outputAutoOpenSuppressedUntil = 0;
  } else {
    _outputAutoOpenSuppressedUntil = Date.now() + OUTPUT_AUTO_OPEN_SUPPRESS_MS;
  }
  _syncWorkspacePanels();
}

// Toggle browser panel
function toggleBrowserPanel() {
  const panel = document.getElementById('browserPanel');
  if (!panel) return;
  panel.classList.toggle('open');
  _syncWorkspacePanels();
}

// Count how many side panels (output / preview / browser) are currently
// open and toggle the .panels-busy class on .workspace so the main chat
// can collapse to a compact strip when it's getting crowded.
function _refreshWorkspacePanelsBusy() {
  const ws = document.querySelector('.workspace');
  if (!ws) return;
  const ids = ['outputPanel', 'previewPanel', 'browserPanel'];
  let openCount = 0;
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (_panelIsVisiblyOpen(el)) openCount += 1;
  });
  ws.classList.toggle('panels-busy', openCount >= 2);
}
window._refreshWorkspacePanelsBusy = _refreshWorkspacePanelsBusy;

// Dark mode toggle — defined early in index.html <head>; this re-exposes it from the module
// so other module code can call it directly without going through window.
function koutDarkModeToggle() {
  var isDark = document.body.classList.toggle('dark');
  try { localStorage.setItem('OliviaLegal.darkMode', isDark ? '1' : '0'); } catch (e) { }
  var btn = document.getElementById('epDarkModeToggle');
  if (btn) btn.classList.toggle('on', isDark);
}

// HAVAN project theme cycler.
// When the active project sets data-project="havan" on <html>, the global dark-mode
// toggle instead cycles through the 4 HAVAN brand themes defined in
// uploads/projects/havan/studio_files/themes/index.json:
//   a-light → a-dark → b-light → b-dark → (loop)
// Otherwise it behaves exactly like koutDarkModeToggle so non-HAVAN projects are untouched.
var HAVAN_THEME_CYCLE = ['a-light', 'a-dark', 'b-light', 'b-dark'];
var HAVAN_THEME_DEFAULT = 'a-light';

function havanThemeCycle() {
  var root = document.documentElement;

  // Resolve the active project the same way the rest of the runtime does.
  var activePid = '';
  try { if (typeof _activeProjectId === 'function') activePid = String(_activeProjectId() || ''); } catch (e) { }

  var inHavan = (root.getAttribute('data-project') === 'havan') || (activePid.toLowerCase() === 'havan');
  if (!inHavan) {
    // Not in the HAVAN project — fall back to the standard dark/light toggle.
    return koutDarkModeToggle();
  }

  // Ensure the project scope attribute is present so the namespaced CSS engages.
  root.setAttribute('data-project', 'havan');

  // Restore a previously chosen theme, or apply the documented default.
  var current = root.getAttribute('data-theme');
  if (!HAVAN_THEME_CYCLE.includes(current)) {
    try { current = localStorage.getItem('havan.theme') || HAVAN_THEME_DEFAULT; } catch (e) { current = HAVAN_THEME_DEFAULT; }
  }
  var idx = HAVAN_THEME_CYCLE.indexOf(current);
  if (idx === -1) idx = -1; // unknown/invalid → start at first
  var next = HAVAN_THEME_CYCLE[(idx + 1) % HAVAN_THEME_CYCLE.length];
  root.setAttribute('data-theme', next);
  try { localStorage.setItem('havan.theme', next); } catch (e) { }
  return next;
}

// Browser navigation
function browserBack() {
  const iframe = document.getElementById('browserFrame');
  if (iframe && iframe.contentWindow) {
    try { iframe.contentWindow.history.back(); } catch (e) { }
  }
}

function browserForward() {
  const iframe = document.getElementById('browserFrame');
  if (iframe && iframe.contentWindow) {
    try { iframe.contentWindow.history.forward(); } catch (e) { }
  }
}

function browserReload() {
  const iframe = document.getElementById('browserFrame');
  if (iframe) {
    iframe.src = iframe.src;
  }
}

function navigateBrowser(url) {
  if (!url) return;
  url = url.trim();

  // Normalize URL: If it looks like an external domain but lacks a protocol, prepend https://
  if (!/^(https?:\/\/|file:\/\/|\/|data:|about:)/i.test(url)) {
    if (/^www\./i.test(url) || /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/|$)/i.test(url)) {
      url = 'https://' + url;
    }
  }

  const iframe = document.getElementById('browserFrame');
  if (iframe) {
    let targetUrl = url;
    // Proxy external http/https requests to bypass X-Frame-Options: deny.
    // Hosts that refer to the viewer's own machine (localhost / 127.0.0.1 /
    // 0.0.0.0) must be loaded directly in the iframe: a server-side proxy runs
    // on the gateway host and has no route to the viewer's loopback, so it
    // would always 502 (Connection refused) for such URLs.
    const isLoopback = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:[0-9]+)?(\/|$)/i.test(url)
      || /^(localhost|127\.0\.0\.1|0\.0\.0\.0)(:[0-9]+)?(\/|$)/i.test(url);
    if (/^https?:\/\//i.test(url) && !isLoopback) {
      const currentOrigin = window.location.origin;
      if (!url.startsWith(currentOrigin)) {
        targetUrl = '/api/proxy?url=' + encodeURIComponent(url);
      }
    }
    iframe.src = targetUrl;

    // Keep URL bar in sync with user-facing URL (not the proxied internal one)
    const bar = document.getElementById('browserUrlBar');
    if (bar) bar.value = url;
  }
  if (typeof window.refreshPanelContextStatus === 'function') window.refreshPanelContextStatus();
}

function _setActiveOutputTab(id) {
  const tabs = document.querySelectorAll('#outputTabs .output-tab-item');
  tabs.forEach(tab => tab.classList.toggle('active', tab.dataset.artifact === String(id || '')));
}

async function showOutputArtifactInPanel(id) {
  const artifact = outputArtifacts.find(a => a.id === id);
  const body = document.getElementById('outputBody');
  const panel = document.getElementById('outputPanel');
  const handle = document.getElementById('outputResizeHandle');
  if (!artifact || !body) return;

  if (typeof window.refreshPanelContextStatus === 'function') window.refreshPanelContextStatus();

  currentOutputArtifactId = artifact.id;
  _setActiveOutputTab(artifact.id);

  if (panel && !panel.classList.contains('open')) {
    panel.classList.add('open');
    _outputAutoOpenSuppressedUntil = 0;
    _syncWorkspacePanels();
  } else if (handle && !handle.classList.contains('visible')) {
    _syncWorkspacePanels();
  }

  body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:72px"><div class="loading" style="width:22px;height:22px;border-width:3px;border-color:var(--amber) var(--amber) transparent transparent"></div></div>';

  const extFromTitle = String(artifact.title || '').split('.').pop().toLowerCase();
  const declaredType = String(artifact.type || '').toLowerCase();
  const contentType = String(artifact.content_type || '').toLowerCase();
  const type = declaredType || extFromTitle;

  try {
    if (type === 'image' || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(extFromTitle)) {
      const src = artifact.url || artifact.path || '';
      body.innerHTML = `<div style="height:100%;display:flex;align-items:center;justify-content:center;padding:12px"><img src="${escapeHtml(src)}" alt="${escapeHtml(artifact.title || 'image')}" style="max-width:100%;max-height:100%;object-fit:contain;border-radius:8px"></div>`;
      return;
    }

    if (type === 'audio' || ['mp3', 'wav', 'm4a', 'ogg', 'flac', 'aac', 'webm'].includes(extFromTitle)) {
      const src = artifact.url || artifact.path || '';
      body.innerHTML = `
        <div style="padding:18px;display:flex;flex-direction:column;gap:10px;justify-content:center;height:100%">
          <div style="font-size:13px;font-weight:600;color:var(--white)">${escapeHtml(artifact.title || 'Audio')}</div>
          <audio controls preload="metadata" src="${escapeHtml(src)}" style="width:100%"></audio>
        </div>`;
      return;
    }

    if (type === 'pdf' || extFromTitle === 'pdf') {
      const src = artifact.url || artifact.path || '';
      body.innerHTML = `<iframe src="${escapeHtml(src)}" style="width:100%;height:100%;border:none;border-radius:6px;background:#fff"></iframe>`;
      return;
    }

    if ((type === 'docx' || type === 'doc' || ['docx', 'doc'].includes(extFromTitle)) && artifact.url) {
      const res = await fetch(artifact.url);
      const buffer = await res.arrayBuffer();
      if (typeof window.renderDocxIntoElement === 'function') {
        let companionPdfUrl = String(artifact.companion_pdf_url || '').trim();
        let companionPdfName = String(artifact.companion_pdf_name || '').trim();
        const canResolveSharedCompanion = (String(artifact.source || '').toLowerCase().includes('shared')
          || /\/api\/shared\/(?:raw|file)\?/i.test(String(artifact.url || '')));
        if (!companionPdfUrl && canResolveSharedCompanion && typeof window.resolveSharedDocCompanion === 'function') {
          try {
            const companion = await window.resolveSharedDocCompanion(artifact.path || artifact.url || '');
            if (companion && companion.url) {
              companionPdfUrl = companion.url;
              companionPdfName = companion.name || '';
              artifact.companion_pdf_url = companionPdfUrl;
              artifact.companion_pdf_name = companionPdfName;
            }
          } catch (_) {
            // Keep DOCX rendering even if companion lookup fails.
          }
        }
        await window.renderDocxIntoElement(body, buffer, {
          title: artifact.title || '',
          ext: extFromTitle,
          companionPdfUrl,
          companionPdfName,
        });
        return;
      }
    }

    if ((type === 'xlsx' || type === 'xls' || ['xlsx', 'xls'].includes(extFromTitle)) && artifact.url) {
      const res = await fetch(artifact.url);
      const buffer = await res.arrayBuffer();
      if (window.renderXlsxHtml) {
        body.innerHTML = `<div class="output-rich-scroll">${window.renderXlsxHtml(new Uint8Array(buffer), { title: artifact.title || '' })}</div>`;
      } else {
        body.innerHTML = `<div style="padding:20px;color:var(--red)">Biblioteca XLSX não carregada.</div>`;
      }
      return;
    }

    if ((type === 'html' || contentType.includes('text/html')) && artifact.content && artifact.source === 'shared-law') {
      body.innerHTML = `<div class="output-rich-scroll">${artifact.content}</div>`;
      return;
    }

    if ((type === 'html' || contentType.includes('text/html')) && artifact.content && artifact.content.includes('<')) {
      const htmlText = _prepareHtmlForIframe(artifact.content, artifact.url || artifact.path || '');
      body.innerHTML = `<iframe srcdoc="${_escapeHtmlAttr(htmlText)}" sandbox="${OUTPUT_HTML_SANDBOX}" style="width:100%;height:100%;border:none;border-radius:6px;background:#fff"></iframe>`;
      return;
    }

    if ((type === 'html' || contentType.includes('text/html')) && artifact.url) {
      try {
        const res = await fetch(artifact.url);
        if (res.ok) {
          const htmlText = _prepareHtmlForIframe(await res.text(), artifact.url);
          body.innerHTML = `<iframe srcdoc="${_escapeHtmlAttr(htmlText)}" sandbox="${OUTPUT_HTML_SANDBOX}" style="width:100%;height:100%;border:none;border-radius:6px;background:#fff"></iframe>`;
          return;
        }
      } catch (_) {
        // Fall back to URL-based rendering.
      }
      body.innerHTML = `<iframe src="${escapeHtml(artifact.url)}" sandbox="${OUTPUT_HTML_SANDBOX}" style="width:100%;height:100%;border:none;border-radius:6px;background:#fff"></iframe>`;
      return;
    }

    let textContent = typeof artifact.content === 'string' ? artifact.content : '';
    if (!textContent && artifact.url) {
      const res = await fetch(artifact.url);
      if (res.ok) textContent = await res.text();
    }

    if (textContent) {
      if (type === 'json' || extFromTitle === 'json' || contentType.includes('application/json')) {
        try { textContent = JSON.stringify(JSON.parse(textContent), null, 2); } catch (_) { }
      }

      if (type === 'markdown' || extFromTitle === 'md' || extFromTitle === 'markdown' || contentType.includes('text/markdown')) {
        if (typeof window.renderRichMarkdownHtml === 'function') {
          body.innerHTML = `<div class="output-rich-scroll">${window.renderRichMarkdownHtml(textContent, { title: artifact.title || artifact.id })}</div>`;
        } else if (window.marked) {
          body.innerHTML = `<div class="output-body-content" style="padding:16px;color:var(--white);line-height:1.7;overflow:auto;height:100%;box-sizing:border-box">${marked.parse(textContent)}</div>`;
        } else {
          body.innerHTML = `<pre class="output-body-content" style="padding:16px;margin:0;white-space:pre-wrap;word-break:break-word;font-family:var(--mono);font-size:12px;color:var(--white);overflow:auto;height:100%;box-sizing:border-box">${escapeHtml(textContent)}</pre>`;
        }
        if (typeof window.postRenderDom === 'function') {
          setTimeout(function () { window.postRenderDom(body); }, 50);
        }
      } else if ((type === 'csv' || extFromTitle === 'csv' || (typeof window.isCsvContent === 'function' && window.isCsvContent(textContent))) && typeof window.renderCsvHtml === 'function') {
        body.innerHTML = `<div class="output-rich-scroll">${window.renderCsvHtml(textContent, { title: artifact.title || artifact.id })}</div>`;
      } else {
        const richKind = (type === 'json' || extFromTitle === 'json' || contentType.includes('application/json'))
          ? 'json'
          : (type || extFromTitle);
        if (typeof window.renderRichTextCardHtml === 'function') {
          body.innerHTML = `<div class="output-rich-scroll">${window.renderRichTextCardHtml(textContent, { title: artifact.title || artifact.id, kind: richKind })}</div>`;
        } else {
          body.innerHTML = `<pre class="output-body-content" style="padding:16px;margin:0;white-space:pre-wrap;word-break:break-word;font-family:var(--mono);font-size:12px;color:var(--white);overflow:auto;height:100%;box-sizing:border-box">${escapeHtml(textContent)}</pre>`;
        }
      }
      return;
    }

    if (artifact.url) {
      body.innerHTML = `<iframe src="${escapeHtml(artifact.url)}" sandbox="${OUTPUT_HTML_SANDBOX}" style="width:100%;height:100%;border:none;border-radius:6px;background:#fff"></iframe>`;
      return;
    }

    body.innerHTML = '<div class="output-empty"><p>Sem conteúdo disponível para este artefato.</p></div>';
  } catch (e) {
    body.innerHTML = `<div style="padding:18px;color:var(--red)">Falha ao renderizar saída: ${escapeHtml(e.message || 'erro desconhecido')}</div>`;
  }
}

// Add output artifact
function addOutputArtifact(artifact) {
  if (!artifact || !artifact.id) return;

  // Check if artifact already exists
  const existingIndex = outputArtifacts.findIndex(a => a.id === artifact.id);
  if (existingIndex >= 0) {
    outputArtifacts[existingIndex] = artifact;
  } else {
    outputArtifacts.push(artifact);
  }

  renderOutputTabs();
  updateArtifactCount();
  renderGeneratedFiles();

  // Auto-open output panel if closed
  const panel = document.getElementById('outputPanel');
  const handle = document.getElementById('outputResizeHandle');
  const autoOpenSuppressed = _isOutputAutoOpenSuppressed();
  if (panel && !panel.classList.contains('open') && !autoOpenSuppressed) {
    panel.classList.add('open');
    if (handle) handle.classList.add('visible');
    _syncWorkspacePanels();
  }

  if (artifact._focusInPanel || (!currentOutputArtifactId && !autoOpenSuppressed)) {
    showOutputArtifactInPanel(artifact.id);
  } else {
    if (!currentOutputArtifactId) currentOutputArtifactId = artifact.id;
    _setActiveOutputTab(currentOutputArtifactId);
  }
}

// Render generated files in sidebar tab-files
function renderGeneratedFiles() {
  const container = document.getElementById('generatedFilesList');
  const countBadge = document.getElementById('generatedFilesCount');
  if (countBadge) countBadge.textContent = '(' + outputArtifacts.length + ')';
  if (!container) return;

  if (outputArtifacts.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:16px 12px;border:1px dashed var(--border);border-radius:8px;background:rgba(255,255,255,0.02)">'
      + '<div style="font-size:20px;color:var(--gray);margin-bottom:6px"><i class="fas fa-wand-magic-sparkles"></i></div>'
      + '<div style="font-size:11px;color:var(--gray);margin-bottom:4px">Nenhum artefato gerado ainda</div>'
      + '<div style="font-size:10px;color:var(--gray);opacity:.7">Peça ao agente para criar documentos, código, análises e muito mais</div>'
      + '</div>';
    return;
  }

  const html = outputArtifacts.map(art => {
    const icon = getArtifactIcon(art.type);
    const size = art.size ? formatBytes(art.size) : '';
    // Click handler — open in preview panel when we have a URL, otherwise open modal
    const clickJs = art.url
      ? `openPreviewUrl(${JSON.stringify(art.url)}, ${JSON.stringify(art.title || art.id)}, { fileType: ${JSON.stringify(art.type || '')}, mimeType: ${JSON.stringify(art.content_type || '')}, size: ${JSON.stringify(art.size || 0)} })`
      : `showOutputArtifact(${JSON.stringify(art.id)})`;
    const dlHref = art.url
      ? `<a href="${escapeHtml(art.url)}" download="${escapeHtml(art.title || art.id)}" style="border:none;background:none;color:var(--gray);cursor:pointer;padding:2px 5px;font-size:11px;text-decoration:none" title="Download" onclick="event.stopPropagation()"><i class="fas fa-download"></i></a>`
      : '';
    return `
      <div style="display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid var(--border);border-radius:5px;font-size:11px;cursor:pointer" onclick="${escapeHtml(clickJs)}" title="Abrir">
        <span style="font-size:13px;flex-shrink:0">${icon}</span>
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--white)" title="${escapeHtml(art.title || art.id)}">${escapeHtml(art.title || art.id)}</span>
        ${size ? `<span style="color:var(--gray);flex-shrink:0">${size}</span>` : ''}
        <div style="display:flex;gap:4px;flex-shrink:0" onclick="event.stopPropagation()">
          ${dlHref}
          <button style="border:none;background:none;color:var(--gray);cursor:pointer;padding:2px 5px;font-size:11px"
                  onclick="removeArtifact(${JSON.stringify(art.id)})" title="Remover"><i class="fas fa-trash"></i></button>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = html;
}

// Show output artifact
function showOutputArtifact(id) {
  const artifact = outputArtifacts.find(a => a.id === id);
  if (!artifact) return;

  renderArtifactModalContent(artifact);
  openArtifactModal();
}

// Remove artifact
function removeArtifact(id) {
  outputArtifacts = outputArtifacts.filter(a => a.id !== id);
  renderOutputTabs();
  updateArtifactCount();
  renderGeneratedFiles();

  if (currentOutputArtifactId === id) {
    currentOutputArtifactId = null;
    if (outputArtifacts.length) {
      showOutputArtifactInPanel(outputArtifacts[0].id);
    } else {
      const body = document.getElementById('outputBody');
      if (body) body.innerHTML = '<div class="output-empty"><i class="fas fa-file-circle-check" style="font-size:28px;margin-bottom:12px;display:block;color:var(--border-hi)"></i><p>Saídas do agente aparecerão aqui.</p><p style="font-size:12px;margin-top:4px">Markdown, PDF, DOCX — renderizados com qualidade.</p></div>';
    }
  } else {
    _setActiveOutputTab(currentOutputArtifactId);
  }

  if (currentModalArtifactId === id) {
    closeArtifactModal();
  }
}

// Update artifact count
function updateArtifactCount() {
  const badge = document.getElementById('outputTabBadge');
  if (badge) {
    badge.textContent = outputArtifacts.length;
    badge.style.display = outputArtifacts.length ? '' : 'none';
  }
}

// Render output tabs
function renderOutputTabs() {
  const container = document.getElementById('outputTabs');
  if (!container) return;

  if (outputArtifacts.length === 0) {
    container.innerHTML = '<div class="output-empty">No artifacts yet</div>';
    currentOutputArtifactId = null;
    return;
  }

  const html = outputArtifacts.map(artifact => `
    <div class="output-tab-item" data-artifact="${artifact.id}">
      <span class="output-tab-icon">${getArtifactIcon(artifact.type)}</span>
      <span class="output-tab-title">${escapeHtml(artifact.title || artifact.id)}</span>
      <button class="output-tab-close" onclick="removeArtifact('${artifact.id}')">&times;</button>
    </div>
  `).join('');

  container.innerHTML = html;

  // Add click handlers
  container.querySelectorAll('.output-tab-item').forEach(item => {
    item.addEventListener('click', e => {
      if (!e.target.classList.contains('output-tab-close')) {
        const id = item.dataset.artifact;
        showOutputArtifactInPanel(id);
      }
    });
  });

  _setActiveOutputTab(currentOutputArtifactId);
}

// Get artifact icon
function getArtifactIcon(type) {
  const icons = {
    'file': '📄',
    'code': '💻',
    'data': '📊',
    'image': '🖼️',
    'text': '📝',
    'json': '{}',
    'html': '🌐',
    'pdf': '📕',
    'audio': '🎵',
    'video': '🎬',
    'binary': '📦',
    'docx': '📄',
    'doc': '📄',
    'xlsx': '📊',
    'xls': '📊',
    'pptx': '📊',
  };
  return icons[type] || '📁';
}

// Open artifact in tab
function openArtifactInTab(id) {
  const targetId = id || currentOutputArtifactId;
  const artifact = outputArtifacts.find(a => a.id === targetId);
  if (!artifact) return;

  // Create new browser tab with artifact content
  const browser = document.getElementById('browserFrame');
  if (browser) {
    if (artifact.content_type === 'text/html' && artifact.content) {
      browser.srcdoc = _prepareHtmlForIframe(artifact.content, artifact.url || artifact.path || '');
    } else if (artifact.url) {
      browser.src = artifact.url;
    } else if (artifact.path) {
      // Load local file via fetch
      fetch(artifact.path)
        .then(r => r.text())
        .then(text => browser.srcdoc = _prepareHtmlForIframe(text, artifact.path || ''))
        .catch(err => console.error('Failed to load artifact:', err));
    }
  }

  const browserPanel = document.getElementById('browserPanel');
  if (browserPanel && !browserPanel.classList.contains('open')) {
    toggleBrowserPanel();
  } else {
    _syncWorkspacePanels();
  }
}

// Open artifact modal
function openArtifactModal() {
  document.getElementById('artifactModal').classList.add('show');
}

// Close artifact modal
function closeArtifactModal() {
  document.getElementById('artifactModal').classList.remove('show');
  currentModalArtifactId = null;
}

// Render artifact modal content
function renderArtifactModalContent(artifact) {
  const container = document.getElementById('artifactModalBody');
  if (!container) return;

  currentModalArtifactId = artifact.id;

  let content = '';
  const modeSelector = artifact.type === 'image' || artifact.type === 'pdf' ? '' : `
    <div class="artifact-mode-selector">
      <button class="artifact-mode-btn ${artifactViewMode === 'preview' ? 'active' : ''}" onclick="switchArtifactModalView('preview')">
        <i class="fas fa-eye"></i> Preview
      </button>
      <button class="artifact-mode-btn ${artifactViewMode === 'raw' ? 'active' : ''}" onclick="switchArtifactModalView('raw')">
        <i class="fas fa-code"></i> Raw
      </button>
    </div>
  `;

  if (artifact.type === 'image') {
    content = `
      <div class="artifact-image">
        <img src="${escapeHtml(artifact.url || artifact.path || '')}" alt="${escapeHtml(artifact.title || '')}">
      </div>
    `;
  } else if (artifact.type === 'audio' && (artifact.url || artifact.blob)) {
    const audioSrc = artifact.url || URL.createObjectURL(artifact.blob);
    content = `
      <div style="padding:24px;display:flex;flex-direction:column;justify-content:center;align-items:center;height:100%;box-sizing:border-box;gap:14px;">
        <div style="font-size:14px;font-weight:600;color:var(--white);text-align:center">${escapeHtml(artifact.title || 'Audio')}</div>
        <audio controls preload="metadata" src="${escapeHtml(audioSrc)}" style="width:min(720px,100%)"></audio>
      </div>
    `;
  } else if (artifact.type === 'markdown' && artifact.content) {
    if (typeof window.renderRichMarkdownHtml === 'function') {
      content = `<div class="output-rich-scroll" style="padding:16px;height:100%;box-sizing:border-box">${window.renderRichMarkdownHtml(artifact.content, { title: artifact.title || artifact.id })}</div>`;
    } else {
      content = `<pre class="artifact-content">${escapeHtml(artifact.content)}</pre>`;
    }
  } else if (artifact.type === 'html' && artifact.content && artifact.source === 'shared-law') {
    content = `<div class="output-rich-scroll" style="padding:16px;height:100%;box-sizing:border-box">${artifact.content}</div>`;
  } else if ((artifact.type === 'html' && artifact.content && artifact.source === 'xlsx-render')) {
    // Pre-rendered XLSX HTML from discovery
    content = `<div class="output-rich-scroll" style="height:100%;box-sizing:border-box">${artifact.content}</div>`;
  } else if (artifact.type === 'html' && artifact.url) {
    // Prefer URL-based iframe (full file, not snippet) when a server URL is available
    content = `
      <iframe class="artifact-iframe" src="${escapeHtml(artifact.url)}" sandbox="${OUTPUT_HTML_SANDBOX}"></iframe>
    `;
  } else if (artifact.type === 'html' && artifact.content && artifact.content.includes('<')) {
    // Full HTML content available — render in sandboxed iframe via srcdoc
    content = `
      <iframe class="artifact-iframe" srcdoc="${_escapeHtmlAttr(_upgradeInsecurePreviewHtml(artifact.content))}" sandbox="${OUTPUT_HTML_SANDBOX}"></iframe>
    `;
  } else if (artifact.url) {
    content = `
      <iframe class="artifact-iframe" src="${escapeHtml(artifact.url)}" sandbox="${OUTPUT_HTML_SANDBOX}"></iframe>
    `;
  } else if (artifact.content) {
    if (typeof window.renderRichTextCardHtml === 'function') {
      content = `<div class="output-rich-scroll" style="padding:16px;height:100%;box-sizing:border-box">${window.renderRichTextCardHtml(artifact.content, { title: artifact.title || artifact.id, kind: artifact.type || '' })}</div>`;
    } else {
      content = `
      <pre class="artifact-content">${escapeHtml(artifact.content)}</pre>
    `;
    }
  } else if (artifact.path) {
    // Last resort: show path with open-in-tab button
    content = `<div class="artifact-empty"><p style="margin-bottom:10px">Arquivo gerado em:</p><code style="font-size:10px;word-break:break-all">${escapeHtml(artifact.path)}</code></div>`;
  } else {
    content = `<p class="artifact-empty">No content available</p>`;
  }

  container.innerHTML = `
    <div class="artifact-modal-header">
      <div class="artifact-title">
        <span class="artifact-icon">${getArtifactIcon(artifact.type)}</span>
        <h3>${escapeHtml(artifact.title || artifact.id)}</h3>
      </div>
      <div class="artifact-actions">
        <button class="artifact-action-btn" onclick="downloadArtifactBlob('${artifact.id}')" title="Download">
          <i class="fas fa-download"></i>
        </button>
        <button class="artifact-action-btn" onclick="openArtifactExternal('${artifact.id}')" title="Open externally">
          <i class="fas fa-external-link-alt"></i>
        </button>
        <button class="artifact-action-btn" onclick="closeArtifactModal()" title="Close">
          <i class="fas fa-times"></i>
        </button>
      </div>
    </div>
    ${modeSelector}
    <div class="artifact-modal-body">
      ${content}
    </div>
  `;
}

// Switch artifact modal view
function switchArtifactModalView(mode) {
  artifactViewMode = mode;
  const artifact = outputArtifacts.find(a => a.id === currentModalArtifactId);
  if (artifact) {
    renderArtifactModalContent(artifact);
  }
}

// Switch artifact view (grid/list)
function switchArtifactView(mode) {
  artifactViewMode = mode;
  const container = document.getElementById('outputTabs');
  if (container) {
    container.className = `output-tabs-container ${mode}`;
  }

  document.querySelectorAll('.artifact-view-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === mode);
  });
}

// Download artifact as blob
function downloadArtifactBlob(id) {
  const artifact = outputArtifacts.find(a => a.id === id);
  if (!artifact) return;

  let blob, filename;

  if (artifact.content) {
    blob = new Blob([artifact.content], { type: artifact.content_type || 'text/plain' });
    filename = artifact.title || artifact.id + '.txt';
  } else if (artifact.blob) {
    blob = artifact.blob;
    filename = artifact.filename || artifact.title || artifact.id;
  } else {
    // Create download link for URL
    const link = document.createElement('a');
    link.href = artifact.url || artifact.path;
    link.download = artifact.title || artifact.id;
    link.click();
    return;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// Open artifact externally
function openArtifactExternal(id) {
  const artifact = outputArtifacts.find(a => a.id === id);
  if (!artifact) return;

  if (artifact.url) {
    window.open(artifact.url, '_blank');
  } else if (artifact.path) {
    window.open(artifact.path, '_blank');
  } else if (artifact.content && artifact.type === 'html') {
    const win = window.open();
    win.document.write(artifact.content);
    win.document.close();
  }
}

// Detect output files
function detectOutputFiles() {
  // This would scan for output files in workspace
  // For now, it's a placeholder
  console.log('Scanning for output files...');
}

// Render file artifact
function renderFileArtifact(file, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const icon = file.name.match(/\.(jpg|jpeg|png|gif)$/i) ? '🖼️' :
    file.name.match(/\.(pdf)$/i) ? '📕' :
      file.name.match(/\.(html|htm)$/i) ? '🌐' :
        file.name.match(/\.(json)$/i) ? '{}' :
          file.name.match(/\.(txt)$/i) ? '📝' : '📄';

  const html = `
    <div class="file-artifact" data-file="${escapeHtml(file.path)}">
      <span class="file-icon">${icon}</span>
      <span class="file-name">${escapeHtml(file.name)}</span>
      <span class="file-size">${formatBytes(file.size)}</span>
      <div class="file-actions">
        <button class="file-action-btn" onclick="openArtifactExternal('${escapeHtml(file.path)}')">
          <i class="fas fa-external-link-alt"></i>
        </button>
        <button class="file-action-btn" onclick="downloadFile('${escapeHtml(file.path)}')">
          <i class="fas fa-download"></i>
        </button>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

// Initialize tabs dock
function initTabsDock() {
  const tabs = document.getElementById('sidebarTabs');
  const trigger = document.getElementById('tabsTrigger');
  if (!tabs || !trigger) return;

  function expand() {
    tabs.classList.add('expanded');
    trigger.innerHTML = '<i class="fas fa-chevron-down"></i>';
    clearTimeout(_outputTabsDockTimer);
  }

  function collapse() {
    tabs.classList.remove('expanded');
    trigger.innerHTML = '<i class="fas fa-chevron-up"></i>';
  }

  trigger.addEventListener('click', () => {
    if (tabs.classList.contains('expanded')) {
      collapse();
    } else {
      expand();
    }
  });

  // Auto-collapse after inactivity
  tabs.addEventListener('mouseenter', expand);
  tabs.addEventListener('mouseleave', () => {
    _outputTabsDockTimer = setTimeout(collapse, 1000);
  });
}

// Expose functions to window scope
window.initOutputResize = initOutputResize;
window.toggleOutputPanel = toggleOutputPanel;
window.toggleBrowserPanel = toggleBrowserPanel;
window.koutDarkModeToggle = koutDarkModeToggle;
window.havanThemeCycle = havanThemeCycle;
window.browserBack = browserBack;
window.browserForward = browserForward;
window.browserReload = browserReload;
window.navigateBrowser = navigateBrowser;
window.addOutputArtifact = addOutputArtifact;
window.showOutputArtifactInPanel = showOutputArtifactInPanel;
window.showOutputArtifact = showOutputArtifact;
window.removeArtifact = removeArtifact;
window.updateArtifactCount = updateArtifactCount;
window.renderOutputTabs = renderOutputTabs;
window.openArtifactInTab = openArtifactInTab;
window.openArtifactModal = openArtifactModal;
window.closeArtifactModal = closeArtifactModal;
window.renderArtifactModalContent = renderArtifactModalContent;
window.switchArtifactModalView = switchArtifactModalView;
window.switchArtifactView = switchArtifactView;
// ── Preview Download Dropdown Management ─────────────────────────────────────
function toggleDownloadDropdown() {
  const dropdown = document.getElementById('previewDownloadDropdown');
  const menu = dropdown ? dropdown.querySelector('.dropdown-menu') : null;
  if (!menu) return;
  menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}

function closeDownloadDropdown() {
  const menu = document.querySelector('#previewDownloadDropdown .dropdown-menu');
  if (menu) menu.style.display = 'none';
}

// Update download button to show dropdown when file is markdown
function updatePreviewDownloadVisibility(previewFile) {
  const dropdown = document.getElementById('previewDownloadDropdown');
  const button = document.getElementById('previewDownloadBtn');
  if (!dropdown) return;

  const isMd = previewFile && previewFile.name &&
    (previewFile.name.endsWith('.md') || previewFile.name.endsWith('.markdown'));

  if (isMd) {
    dropdown.style.display = 'block';
    if (button) {
      button.onclick = (e) => {
        e.stopPropagation();
        toggleDownloadDropdown();
      };
    }
  } else {
    dropdown.style.display = 'block';
    if (button) {
      button.onclick = () => downloadCurrentPreview();
      closeDownloadDropdown();
    }
  }
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
  const dropdown = document.getElementById('previewDownloadDropdown');
  if (dropdown && !dropdown.contains(e.target)) {
    closeDownloadDropdown();
  }
});

window.downloadArtifactBlob = downloadArtifactBlob;
window.openArtifactExternal = openArtifactExternal;
window.detectOutputFiles = detectOutputFiles;
window.renderGeneratedFiles = renderGeneratedFiles;
window.renderFileArtifact = renderFileArtifact;
window.initTabsDock = initTabsDock;
window.startArtifactPolling = startArtifactPolling;
window.stopArtifactPolling = stopArtifactPolling;
window.downloadCurrentPreview = downloadCurrentPreview;
window.downloadPreviewAsPdf = downloadPreviewAsPdf;
window.maximizeCurrentPreview = maximizeCurrentPreview;
window.syncWorkspacePanels = _syncWorkspacePanels;
window.updatePreviewDownloadVisibility = updatePreviewDownloadVisibility;
window.closeDownloadDropdown = closeDownloadDropdown;