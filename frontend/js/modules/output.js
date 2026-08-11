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
window.__oliviaBrowserShareState = window.__oliviaBrowserShareState || {
  shared: false,
  url: '',
  title: '',
  updatedAt: 0,
};

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
  const displayName = s.name || 'document';
  const docTitle = displayName.replace(/\.(md|markdown)$/i, '');
  const stamp = new Date().toLocaleString();
  const isoDate = new Date().toISOString().slice(0, 10);

  // ── Olive branch mark ───────────────────────────────────────────────────
  const oliveMark = '<svg width="28" height="28" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" style="display:block"><rect width="32" height="32" rx="8" fill="#1c4532"/><g transform="translate(6,7) scale(0.31)"><path d="M12 52 Q24 38,34 30 Q44 22,54 16" fill="none" stroke="#faf9f6" stroke-width="2.5" stroke-linecap="round" opacity=".65"/><path d="M28 36 Q20 26,16 18 Q24 24,28 36Z" fill="#faf9f6" opacity=".4"/><path d="M30 34 Q38 24,44 18 Q38 28,30 34Z" fill="#faf9f6" opacity=".38"/><path d="M42 24 Q36 14,34 8  Q40 14,42 24Z" fill="#faf9f6" opacity=".35"/><ellipse cx="22" cy="42" rx="4" ry="5" fill="#c4622d"/></g></svg>';

  // ── Async work starts here ───────────────────────────────────────────────
  (async function () {
    var bodyHtml = '';
    var previewBody = document.getElementById('previewBody');
    if (previewBody) {
      var clone = previewBody.cloneNode(true);
      // Strip interactive elements that don't belong in print.
      var interactiveSels = '.mermaid-export-wrap,.mermaid-expand-btn,.mermaid-fullscreen-overlay,button,[onclick]';
      var nodes = clone.querySelectorAll(interactiveSels);
      for (var i = 0; i < nodes.length; i++) {
        try { nodes[i].parentNode.removeChild(nodes[i]); } catch (_) {}
      }
      // For sandboxed Mermaid iframes, leave them — they'll render inline SVGs.
      // For HTML preview iframes, pull the srcdoc content.
      var iframes = clone.querySelectorAll('iframe');
      for (var j = 0; j < iframes.length; j++) {
        var f = iframes[j];
        if (f.srcdoc) {
          var wrapper = document.createElement('div');
          wrapper.innerHTML = f.srcdoc;
          wrapper.className = 'preview-html-body';
          f.parentNode.replaceChild(wrapper, f);
        }
      }
      bodyHtml = clone.innerHTML;
    }

    // Fallback: if the body is empty, try rendering from raw source.
    if (!bodyHtml || !bodyHtml.trim()) {
      if (previewType === 'markdown' || previewType === 'md') {
        try {
          var res = await fetch(s.url);
          var mdText = await res.text();
          if (window.marked && typeof marked.parse === 'function') {
            bodyHtml = marked.parse(mdText);
          } else {
            bodyHtml = '<pre style="white-space:pre-wrap">' + escapeHtml(mdText) + '</pre>';
          }
        } catch (_) {
          bodyHtml = '<p style="color:#9a9088;font-style:italic">Preview content could not be captured for export.</p>';
        }
      } else {
        bodyHtml = '<p style="color:#9a9088;font-style:italic">Preview content could not be captured for export.</p>';
      }
    }

  // ── Collect stylesheets ──────────────────────────────────────────────────
  var stylesheetCss = '';
  var links = document.querySelectorAll('link[rel="stylesheet"]');
  for (var k = 0; k < links.length; k++) {
    var href = links[k].getAttribute('href');
    // Skip external fonts — they're loaded separately.
    if (href && href.indexOf('fonts.googleapis.com') < 0) {
      try {
        var cssRes = await fetch(href);
        stylesheetCss += '/* ' + href + ' */\n' + (await cssRes.text()) + '\n';
      } catch (_) {}
    }
  }

  // ── Assemble the print document ──────────────────────────────────────────
  var printDoc = '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>' + escapeHtml(docTitle) + '</title>\n' +
    '<link rel="preconnect" href="https://fonts.googleapis.com">\n' +
    '<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,500;1,9..144,300;1,9..144,400&family=Plus+Jakarta+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">\n' +
    '<style>\n' +
    '@page{ margin: 22mm 18mm 20mm; }\n' +
    '@page:first{ margin-top: 18mm; }\n' +
    ':root{ --green-dark:#1c4532; --green-mid:#2d785a; --green-light:#5a8a6e; --amber:#c4622d; --amber-light:#d4733e;' +
    ' --cream:#f8f5ee; --paper:#fdfcf9; --gray:#9a9088; --gray-hi:#5a5a5a; --ink:#1a1a1a;' +
    ' --border:rgba(28,69,50,.14);' +
    ' --font-serif: Fraunces,Georgia,serif; --font-sans: Plus\\ Jakarta\\ Sans,system-ui,-apple-system,sans-serif;' +
    ' --font-mono: JetBrains\\ Mono,monospace; }\n' +
    '*,*::before,*::after{ box-sizing:border-box; margin:0; padding:0; }\n' +
    'body{ font-family:var(--font-sans); background:#fff; color:var(--ink); font-size:10.5pt; line-height:1.7;' +
    ' -webkit-print-color-adjust:exact; print-color-adjust:exact; }\n' +
    // header
    '.doc-header{ display:flex; align-items:center; gap:10px; padding-bottom:12px; margin-bottom:30px; border-bottom:1.5px solid var(--green-dark); }\n' +
    '.doc-header-mark{ flex-shrink:0; line-height:0; }\n' +
    '.doc-header-brand{ font-family:var(--font-serif); font-size:13.5pt; font-weight:400; color:var(--green-dark); letter-spacing:-0.015em; line-height:1; }\n' +
    '.doc-header-brand span{ font-style:italic; font-weight:300; color:var(--amber); font-size:10pt; margin-left:6px; letter-spacing:0; }\n' +
    '.doc-header-meta{ margin-left:auto; text-align:right; font-family:var(--font-mono); font-size:7pt; color:var(--gray); line-height:1.6; }\n' +
    '.doc-header-meta strong{ display:block; color:var(--gray-hi); font-weight:500; font-size:7.5pt; }\n' +
    // prose
    'h1,h2,h3,h4,h5,h6{ font-family:var(--font-serif); font-weight:400; color:var(--green-dark); line-height:1.22; letter-spacing:-0.012em; margin-top:1.9em; margin-bottom:.55em; break-after:avoid; }\n' +
    'h1{ font-size:18pt; margin-top:0; padding-bottom:9px; border-bottom:1px solid var(--border); }\n' +
    'h2{ font-size:14pt; } h3{ font-size:12pt; color:var(--green-mid); }\n' +
    'h4,h5,h6{ font-family:var(--font-sans); font-size:8pt; font-weight:600; color:var(--gray-hi); text-transform:uppercase; letter-spacing:.12em; }\n' +
    'h1 em,h2 em,h3 em{ font-style:italic; font-weight:300; color:var(--amber); }\n' +
    'p{ margin-bottom:.85em; } p:last-child{ margin-bottom:0; }\n' +
    'a{ color:var(--green-mid); text-decoration:underline; text-decoration-color:rgba(45,120,90,.3); }\n' +
    'strong,b{ font-weight:600; color:var(--green-dark); }\n' +
    'blockquote{ font-family:var(--font-serif); font-style:italic; font-size:11pt; color:var(--green-dark); border-left:2px solid var(--amber); padding:3px 14px; margin:1.3em 0; break-inside:avoid; }\n' +
    'code{ font-family:var(--font-mono); font-size:.82em; background:var(--cream); color:var(--green-dark); padding:1px 5px; border-radius:4px; border:1px solid var(--border); }\n' +
    'pre{ background:var(--cream); border-left:2.5px solid var(--amber); border-radius:0 7px 7px 0; padding:11px 14px; margin:1.2em 0; overflow-wrap:break-word; white-space:pre-wrap; break-inside:avoid; }\n' +
    'pre code{ background:none; border:none; padding:0; font-size:.85em; line-height:1.6; color:var(--ink); }\n' +
    'ul,ol{ padding-left:1.35em; margin-bottom:.85em; } li{ margin-bottom:.22em; } li>ul,li>ol{ margin-top:.2em; margin-bottom:.2em; }\n' +
    'table{ border-collapse:collapse; width:100%; margin:1.3em 0; font-size:9.5pt; break-inside:avoid; }\n' +
    'th{ background:var(--cream); font-family:var(--font-mono); font-size:7pt; font-weight:500; text-transform:uppercase; letter-spacing:.1em; color:var(--gray-hi); padding:7px 10px; border-bottom:1.5px solid var(--green-dark); text-align:left; }\n' +
    'td{ padding:6px 10px; border-bottom:1px solid var(--border); vertical-align:top; } tr:last-child td{ border-bottom:none; } tr:nth-child(even) td{ background:rgba(248,245,238,.45); }\n' +
    'img{ max-width:100%; height:auto; border-radius:6px; }\n' +
    'hr{ border:none; border-top:1px solid var(--border); margin:1.6em 0; }\n' +
    // mermaid diagrams
    '.mermaid-container{ text-align:center; margin:1.2em 0; break-inside:avoid; }\n' +
    '.mermaid-container svg{ max-width:100%; height:auto; }\n' +
    // footer
    '.doc-footer{ margin-top:36px; padding-top:10px; border-top:1px solid var(--border); display:flex; align-items:center; justify-content:space-between; gap:12px; font-family:var(--font-mono); font-size:7pt; color:var(--gray); }\n' +
    '.wm{ display:flex; align-items:baseline; gap:5px; } .wm-n{ font-family:var(--font-serif); font-size:9pt; color:var(--green-dark); letter-spacing:-0.01em; } .wm-s{ font-size:6.5pt; text-transform:uppercase; letter-spacing:.1em; color:var(--gray); }\n' +
    '@media print{ body{ background:#fff; } a{ color:var(--green-mid)!important; } pre,blockquote,table{ break-inside:avoid; } h1,h2,h3{ break-after:avoid; } }\n';

  // Append collected stylesheets (scoped under .doc-body).
  if (stylesheetCss) {
    printDoc += '/* Collected page stylesheets */\n' + stylesheetCss + '\n';
  }

  // The app's global CSS was written for a desktop-app shell —
  // css/base.css sets `html, body { height: 100dvh; overflow: hidden; }`.
  // Inlined here it wins the cascade over the print styles above and
  // clips the body to a single page, so "Export as PDF" only produced
  // the first page. Re-assert the print document's own layout.
  printDoc += '/* Neutralize app chrome leaking into the print document */\n' +
    'html, body{ height:auto !important; overflow:visible !important; min-height:0 !important; max-height:none !important; }\n' +
    'body{ display:block !important; background:#fff !important; color:var(--ink) !important; }\n';

  printDoc += '</style>\n</head>\n<body>\n' +
    '<div class="doc-header"><div class="doc-header-mark">' + oliveMark + '</div>' +
    '<div class="doc-header-brand">Olivia <span>ecosystem</span></div>' +
    '<div class="doc-header-meta"><strong>' + escapeHtml(displayName) + '</strong>' + escapeHtml(stamp) + '</div></div>\n' +
    '<div class="doc-body">' + bodyHtml + '</div>\n' +
    '<div class="doc-footer"><div class="wm"><span class="wm-n">Olivia</span><span class="wm-s">Awareness · AI</span></div>' +
    '<span>Generated from workspace preview · ' + escapeHtml(isoDate) + '</span></div>\n' +
    '</body>\n</html>';

  // ── Hidden iframe → print ────────────────────────────────────────────────
  var iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(iframe);

  var cleanup = function () { try { document.body.removeChild(iframe); } catch (_) {} };

  iframe.onload = function () {
    var win = iframe.contentWindow;
    var doPrint = function () {
      try {
        win.document.title = docTitle + '.pdf';
        win.focus();
        win.print();
      } catch (_) {}
      setTimeout(cleanup, 2000);
    };
    if (win.document.fonts && typeof win.document.fonts.ready && typeof win.document.fonts.ready.then === 'function') {
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

  // Wire the DOM bridge injection for agent-controlled browser interaction.
  // When the browser iframe loads a same-origin page (e.g., ComfyUI at
  // localhost:8188), inject the bridge script so the agent can click, type,
  // and interact with the page UI as if it were the user.
  var frame = document.getElementById('browserFrame');
  if (frame) {
    frame.addEventListener('load', function () {
      _bridgeInjectTimer = null;
      window.__browserBridgeReadySent = false;
      setTimeout(function () { _injectBrowserBridge(); }, 300);
    });
    // If the frame already has content (e.g. restored from session), try now.
    setTimeout(function () { _injectBrowserBridge(); }, 600);
  }
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

  // Update toolbar toggle buttons to reflect panel open/closed state
  const outputToggleBtn = document.getElementById('outputToggleBtn');
  const sidebarOutputBtn = document.getElementById('sidebarOutputToggleBtn');
  const browserToggleBtn = document.getElementById('browserToggleBtn');
  if (outputToggleBtn) outputToggleBtn.classList.toggle('active', outputOpen);
  if (sidebarOutputBtn) sidebarOutputBtn.classList.toggle('active', outputOpen);
  if (browserToggleBtn) browserToggleBtn.classList.toggle('active', browserOpen);

  // Update docs tree action buttons to reflect panel open/closed state
  document.querySelectorAll('.docs-action-btn[data-panel]').forEach(btn => {
    const panel = btn.dataset.panel;
    if (panel === 'preview') btn.classList.toggle('active', previewOpen);
    else if (panel === 'output') btn.classList.toggle('active', outputOpen);
    else if (panel === 'browser') btn.classList.toggle('active', browserOpen);
  });

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

function openBrowserPanel() {
  const panel = document.getElementById('browserPanel');
  if (!panel) return;
  panel.classList.add('open');
  _syncWorkspacePanels();
}

function closeBrowserPanel() {
  const panel = document.getElementById('browserPanel');
  if (!panel) return;
  panel.classList.remove('open');
  _syncWorkspacePanels();
}

// Toggle browser panel
function toggleBrowserPanel() {
  const panel = document.getElementById('browserPanel');
  if (!panel) return;
  panel.classList.toggle('open');
  _syncWorkspacePanels();
}

function syncBrowserSharedState(url, title, shared) {
  const state = window.__oliviaBrowserShareState || (window.__oliviaBrowserShareState = {});
  const bar = document.getElementById('browserUrlBar');
  const sourceUrl = String(url || (bar && bar.value) || state.url || '').trim();
  const sourceTitle = String(title || (document.title || state.title || '')).trim();
  state.shared = !!shared;
  state.url = sourceUrl;
  state.title = sourceTitle;
  state.updatedAt = Date.now();
  const shareBtn = document.getElementById('browserShareBtn');
  if (shareBtn) {
    shareBtn.classList.toggle('active', state.shared);
    shareBtn.setAttribute('aria-pressed', state.shared ? 'true' : 'false');
    shareBtn.title = state.shared ? 'Browser page shared with the agent' : 'Share this browser page with the agent';
    shareBtn.innerHTML = state.shared
      ? '<i class="fas fa-share-alt"></i><span class="browser-share-dot"></span>'
      : '<i class="fas fa-share-alt"></i>';
  }
  try {
    window.dispatchEvent(new CustomEvent('olivia:browser-shared', {
      detail: {
        shared: state.shared,
        url: state.url,
        title: state.title,
        updatedAt: state.updatedAt,
      },
    }));
  } catch (_) { }
  if (typeof window.refreshPanelContextStatus === 'function') {
    window.refreshPanelContextStatus();
  }
}

function shareBrowserPageWithAgent() {
  const bar = document.getElementById('browserUrlBar');
  const frame = document.getElementById('browserFrame');
  let browserUrl = String((bar && bar.value) || (frame && frame.src) || '').trim();
  let browserTitle = String((frame && frame.contentDocument && frame.contentDocument.title) || document.title || '').trim();
  let hasPage = !!browserUrl && browserUrl !== 'about:blank';

  // Fallback: when the Browser panel is empty but the Studio preview is active,
  // share the Studio preview document instead of silently doing nothing. This is
  // the common case inside Olivia Studio, where the user is editing a page in the
  // preview but the separate Browser panel has never been navigated.
  if (!hasPage) {
    const studioView = document.getElementById('studioView');
    const studioActive = !!(studioView && studioView.classList.contains('active'));
    if (studioActive && typeof _studio !== 'undefined' && _studio && typeof studioBuildPreviewDocument === 'function') {
      try {
        const doc = String(_studio.documentSource || '').trim();
        if (doc) {
          const html = studioBuildPreviewDocument(doc);
          const pageName = (_studioProject && _studioProject.currentPage)
            || (_studio.currentTab ? ('file.' + _studio.currentTab) : 'preview.html');
          const sharedUrl = 'studio://preview/' + encodeURIComponent(String(pageName).replace(/^.*\//, ''));
          if (frame) frame.srcdoc = html;
          if (bar) bar.value = sharedUrl;
          browserUrl = sharedUrl;
          hasPage = true;
          if (typeof toast === 'function') toast('Browser vazio — compartilhando o preview do Studio.', 'success');
        }
      } catch (e) {
        console.error('Failed to share Studio preview:', e);
      }
    }
  }

  if (!hasPage) {
    openBrowserPanel();
    if (typeof toast === 'function') toast('Nada para compartilhar — abra uma página no Browser primeiro.', 'error');
    return;
  }

  openBrowserPanel();
  syncBrowserSharedState(browserUrl, browserTitle, true);
}

// ── DOM bridge: inject a control script into same-origin iframes ─────────
// When the browser panel navigates to a same-origin page (e.g., ComfyUI at
// localhost:8188), inject a lightweight script that listens for postMessage
// commands from the parent (Olivia).  This lets the agent click, type, select,
// scroll, and evaluate JS inside the iframe as if it were the user.
var _browserBridgeScript = [
  '(function(){',
  '  if(window.__oliviaBridgeInstalled)return;',
  '  window.__oliviaBridgeInstalled=true;',
  '  var ACTIONS={',
  '    click:function(p){var el=_q(p.selector);if(el){el.focus();el.click();return _ok(el,true)}return _miss(p.selector)};',
  '    type:function(p){var el=_q(p.selector);if(!el)return _miss(p.selector);el.focus();',
  '      var v=String(p.text||p.value||"");',
  '      if(el.tagName==="INPUT"||el.tagName==="TEXTAREA"){',
  '        el.value=v;el.dispatchEvent(new Event("input",{bubbles:true}));',
  '        el.dispatchEvent(new Event("change",{bubbles:true}));',
  '      }else{el.innerText=v}',
  '      return _ok(el,true)};',
  '    fill:function(p){var el=_q(p.selector);if(!el)return _miss(p.selector);',
  '      el.focus();el.value=String(p.text||p.value||"");',
  '      el.dispatchEvent(new Event("input",{bubbles:true}));',
  '      el.dispatchEvent(new Event("change",{bubbles:true}));',
  '      return _ok(el,true)};',
  '    select:function(p){var el=_q(p.selector);if(!el)return _miss(p.selector);',
  '      el.focus();el.value=String(p.value||"");',
  '      el.dispatchEvent(new Event("change",{bubbles:true}));',
  '      return _ok(el,true)};',
  '    press:function(p){var el=_q(p.selector)||document.activeElement||document.body;',
  '      el.dispatchEvent(new KeyboardEvent("keydown",{key:p.key||"Enter",bubbles:true}));',
  '      el.dispatchEvent(new KeyboardEvent("keyup",{key:p.key||"Enter",bubbles:true}));',
  '      return _ok(el,true)};',
  '    focus:function(p){var el=_q(p.selector);if(!el)return _miss(p.selector);',
  '      el.focus();return _ok(el,true)};',
  '    scroll:function(p){var el=_q(p.selector)||window;var y=Number(p.y||p.top||0);',
  '      var x=Number(p.x||p.left||0);if(el===window)window.scrollTo(x,y);else el.scrollTop=y;',
  '      return _ok(el,true)};',
  '    read:function(p){var el=_q(p.selector)||document.body;',
  '      return{ok:true,tag:el.tagName,text:(el.innerText||el.textContent||"").slice(0,3000)};};',
  '    snapshot:function(p){return{ok:true,title:document.title,',
  '      url:window.location.href,body:(document.body?document.body.innerText:"").slice(0,4000)};};',
  '    eval:function(p){try{var r=eval(p.js||p.code||"");return{ok:true,result:r}}catch(e){return{ok:false,error:String(e)}};};',
  '    query:function(p){var els=document.querySelectorAll(p.selector||"*");',
  '      var r=[];for(var i=0;i<Math.min(els.length,50);i++){var e=els[i];',
  '      r.push({tag:e.tagName,id:e.id||"",cls:String(e.className||"").slice(0,60),',
  '      text:(e.innerText||e.textContent||"").slice(0,120)})}',
  '      return{ok:true,count:els.length,els:r};};',
  '    wait:function(p){return{ok:true,waited:Number(p.ms||p.timeout||1000)};};',
  '  };',
  '  function _q(sel){if(!sel||sel==="body")return document.body;',
  '    try{return document.querySelector(sel)}catch(e){return null}}',
  '  function _ok(el,tag){return{ok:true,tag:el.tagName,id:el.id||"",',
  '    text:(el.innerText||el.textContent||el.value||"").slice(0,500)}}',
  '  function _miss(sel){return{ok:false,error:"Element not found: "+(sel||"<empty>")}}',
  '  window.addEventListener("message",function(ev){',
  '    var d=ev.data;if(!d||typeof d!=="object"||!d._oliviaBridge)return;',
  '    var fn=ACTIONS[d.action];var result;',
  '    try{if(fn)result=fn(d);else result={ok:false,error:"Unknown action: "+d.action}}',
  '    catch(e){result={ok:false,error:String(e)}}',
  '    ev.source.postMessage({_oliviaBridgeReply:true,id:d.id,result:result},"*");',
  '  });',
  '})();'
].join('');

var _bridgeInjectTimer = null;
var _bridgePending = {};  // pending promise resolvers keyed by message id
var _bridgeMsgId = 0;

function _injectBrowserBridge() {
  var frame = document.getElementById('browserFrame');
  if (!frame) return;
  try {
    // Skip about:blank and other about: URIs — the frame hasn't navigated yet.
    // The 'load' event listener will retry once the real page loads.
    try {
      if (frame.contentWindow && String(frame.contentWindow.location.href || '').startsWith('about:')) {
        return;
      }
    } catch (_x) { /* cross-origin — can't read location, skip guard */ }
    var doc = frame.contentDocument || frame.contentWindow.document;
    if (!doc || !doc.body) { _retryBridgeInjection(); return; }
    // Only inject into same-origin frames where we can access the DOM.
    // Cross-origin frames get navigation-only support (server-side proxy).
    var script = doc.createElement('script');
    script.textContent = _browserBridgeScript;
    doc.head.appendChild(script);
    _setBridgeReady();
  } catch (e) {
    // Cross-origin — bridge injection is impossible. That's fine; the agent
    // can still navigate/reload/share, just not click/type inside the page.
    _setBridgeReady();  // mark as settled so we don't keep retrying
  }
}

function _retryBridgeInjection() {
  if (_bridgeInjectTimer) return;
  _bridgeInjectTimer = setTimeout(function () {
    _bridgeInjectTimer = null;
    _injectBrowserBridge();
  }, 500);
}

function _setBridgeReady() {
  if (window.__browserBridgeReadySent) return;
  window.__browserBridgeReadySent = true;
  try {
    window.dispatchEvent(new CustomEvent('olivia:browser-bridge-ready', { detail: {} }));
  } catch (_) { }
}

function _sendBridgeCommand(action, payload, timeoutMs) {
  var frame = document.getElementById('browserFrame');
  if (!frame || !frame.contentWindow) {
    return Promise.resolve({ ok: false, error: 'Browser frame not available' });
  }

  // If the bridge has never been installed (e.g., the agent sent a command
  // before the page finished loading), try injecting it now and retry once.
  if (!window.__browserBridgeReadySent) {
    _injectBrowserBridge();
    // Wait a short moment for injection to complete, then retry.
    return new Promise(function (resolve) {
      setTimeout(function () {
        _sendBridgeCommand(action, payload, timeoutMs).then(resolve);
      }, 400);
    });
  }

  var id = ++_bridgeMsgId;
  var msg = { _oliviaBridge: true, id: id, action: action };
  if (payload && typeof payload === 'object') {
    Object.keys(payload).forEach(function (k) { msg[k] = payload[k]; });
  }
  return new Promise(function (resolve) {
    var timer = null;
    var done = false;
    var ttl = timeoutMs || 8000;

    function finish(result) {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      delete _bridgePending[id];
      resolve(result || { ok: false, error: 'Bridge timeout' });
    }

    _bridgePending[id] = finish;

    // Listen for reply
    function onMsg(ev) {
      var d = ev.data;
      if (!d || !d._oliviaBridgeReply || d.id !== id) return;
      window.removeEventListener('message', onMsg);
      finish(d.result);
    }
    window.addEventListener('message', onMsg);

    timer = setTimeout(function () {
      window.removeEventListener('message', onMsg);
      finish({ ok: false, error: 'Bridge command timed out after ' + ttl + 'ms' });
    }, ttl);

    try {
      frame.contentWindow.postMessage(msg, '*');
    } catch (e) {
      finish({ ok: false, error: 'Failed to post message: ' + e.message });
    }
  });
}

function handleBrowserUseTool(args) {
  const payload = args && typeof args === 'object' ? args : {};
  const action = String(payload.action || payload.mode || payload.type || payload.command || '').trim().toLowerCase();
  const rawUrl = String(payload.url || payload.href || payload.target_url || payload.targetUrl || payload.value || '').trim();
  const panel = document.getElementById('browserPanel');
  if (panel && !panel.classList.contains('open')) {
    openBrowserPanel();
  }

  // ── Gate: DOM manipulation requires user consent ──────────────────────
  // Actions that modify or interact with the page (click, type, select,
  // press, focus, scroll, eval) require the "share with agent" button to
  // be active.  Read-only actions (navigate, snapshot, read, query, back,
  // forward, reload) work without sharing so the agent can still browse.
  var DOM_INTERACTION_ACTIONS = ['click', 'type', 'fill', 'select', 'press', 'key', 'focus', 'scroll', 'eval', 'evaluate'];
  var shared = window.__oliviaBrowserShareState && window.__oliviaBrowserShareState.shared;
  if (DOM_INTERACTION_ACTIONS.indexOf(action) !== -1 && !shared) {
    return Promise.resolve({
      ok: false,
      error: 'Browser interaction requires the "share with agent" button to be active. '
        + 'Please click the share button in the browser panel toolbar first.'
    });
  }

  // ── DOM interaction actions (postMessage bridge) ──────────────────────
  if (action === 'click') {
    if (!payload.selector) return Promise.resolve({ ok: false, error: 'click requires a selector' });
    return _sendBridgeCommand('click', payload);
  }

  if (action === 'type' || action === 'fill') {
    if (!payload.selector || !payload.text) {
      return Promise.resolve({ ok: false, error: 'type requires selector + text' });
    }
    return _sendBridgeCommand(action === 'fill' ? 'fill' : 'type', payload);
  }

  if (action === 'select' && payload.selector) {
    return _sendBridgeCommand('select', payload);
  }

  if (action === 'press' || action === 'key') {
    return _sendBridgeCommand('press', payload);
  }

  if (action === 'focus') {
    if (!payload.selector) return Promise.resolve({ ok: false, error: 'focus requires a selector' });
    return _sendBridgeCommand('focus', payload);
  }

  if (action === 'scroll') {
    return _sendBridgeCommand('scroll', payload);
  }

  if (action === 'eval' || action === 'evaluate') {
    if (!payload.js && !payload.code) {
      return Promise.resolve({ ok: false, error: 'eval requires js or code parameter' });
    }
    return _sendBridgeCommand('eval', payload);
  }

  if (action === 'query') {
    return _sendBridgeCommand('query', payload);
  }

  if (action === 'read') {
    return _sendBridgeCommand('read', payload);
  }

  if (action === 'snapshot') {
    shareBrowserPageWithAgent();
    return _sendBridgeCommand('snapshot', payload);
  }

  if (action === 'wait' || action === 'wait_ms') {
    var ms = Number(payload.ms || payload.timeout || payload.duration || 1000);
    return new Promise(function (resolve) {
      setTimeout(function () {
        // After waiting, inject bridge if needed and return
        _injectBrowserBridge();
        resolve({ ok: true, waited_ms: ms });
      }, Math.max(100, Math.min(ms, 30000)));
    });
  }

  // ── Legacy navigation actions ─────────────────────────────────────────

  if (!action || action === 'navigate' || action === 'visit' || action === 'open' || action === 'go') {
    if (rawUrl) {
      navigateBrowser(rawUrl);
      syncBrowserSharedState(rawUrl, '', true);
      // After navigation, schedule bridge injection
      _retryBridgeInjection();
    } else {
      shareBrowserPageWithAgent();
    }
    return;
  }

  if (action === 'share') {
    shareBrowserPageWithAgent();
    return;
  }

  if (action === 'back') {
    browserBack();
    return;
  }

  if (action === 'forward') {
    browserForward();
    return;
  }

  if (action === 'reload') {
    browserReload();
    return;
  }
}

window.openBrowserPanel = openBrowserPanel;
window.closeBrowserPanel = closeBrowserPanel;
window.shareBrowserPageWithAgent = shareBrowserPageWithAgent;
window.handleBrowserUseTool = handleBrowserUseTool;
window.syncBrowserSharedState = syncBrowserSharedState;
window._injectBrowserBridge = _injectBrowserBridge;
window._sendBridgeCommand = _sendBridgeCommand;

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
  // Sync settings sidebar dark mode toggle
  var dmToggle = document.getElementById('settingsDarkModeToggle');
  if (dmToggle) dmToggle.checked = isDark;
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

// ── Settings Sidebar ────────────────────────────────────────────────────────
function toggleSettingsSidebar() {
  var overlay = document.getElementById('settingsOverlay');
  var sidebar = document.getElementById('settingsSidebar');
  if (!overlay || !sidebar) return;
  var isOpen = sidebar.classList.contains('open');
  if (isOpen) {
    overlay.classList.remove('open');
    sidebar.classList.remove('open');
  } else {
    // Sync toggle states before opening
    syncSettingsToggles();
    overlay.classList.add('open');
    sidebar.classList.add('open');
  }
}

function syncSettingsToggles() {
  // Dark mode
  var dmToggle = document.getElementById('settingsDarkModeToggle');
  if (dmToggle) {
    dmToggle.checked = document.body.classList.contains('dark');
  }
  // Runpod
  var rpToggle = document.getElementById('settingsRunpodToggle');
  if (rpToggle) {
    try { rpToggle.checked = localStorage.getItem('olivia.runpod.enabled') !== '0'; } catch(e) {}
  }
}

// ── Runpod Toggle ───────────────────────────────────────────────────────────
// Toggles the checkbox and applies the state (called from row click)
function toggleRunpodEnabled() {
  var rpToggle = document.getElementById('settingsRunpodToggle');
  if (rpToggle) rpToggle.checked = !rpToggle.checked;
  applyRunpodState();
}

// Applies runpod state based on current checkbox value (called from switch onchange)
function applyRunpodState() {
  var rpToggle = document.getElementById('settingsRunpodToggle');
  var enabled = rpToggle ? rpToggle.checked : true;
  try { localStorage.setItem('olivia.runpod.enabled', enabled ? '1' : '0'); } catch(e) {}
  var fab = document.getElementById('runpod-fab');
  if (fab) {
    fab.style.display = enabled ? '' : 'none';
  }
}

// Sync runpod state on page load (called on DOMContentLoaded or via init)
function initRunpodState() {
  try {
    var enabled = localStorage.getItem('olivia.runpod.enabled') !== '0';
    var fab = document.getElementById('runpod-fab');
    if (fab && !enabled) fab.style.display = 'none';
  } catch(e) {}
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
  syncBrowserSharedState(url, '', true);

  // Schedule bridge injection after navigation (for same-origin iframes like ComfyUI).
  _retryBridgeInjection();
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
window.toggleSettingsSidebar = toggleSettingsSidebar;
window.toggleRunpodEnabled = toggleRunpodEnabled;
window.applyRunpodState = applyRunpodState;
window.initRunpodState = initRunpodState;
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

// Initialize runpod state on load
initRunpodState();
window.closeDownloadDropdown = closeDownloadDropdown;