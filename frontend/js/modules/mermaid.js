/* ═══════════════════════════════════════════════════════════════════
   MERMAID MODULE – Diagram editing, rendering, export & full‑screen
   ═══════════════════════════════════════════════════════════════════ */

// ─── State ──────────────────────────────────────────────────────────
let _mmdPanelReady = false;
let _mmdFullscreenOverlay = null;
let _mmdExportHost = null;
let _mmdRenderSeq = 0; // guards against stale async renders overwriting newer ones
const _MMD_THEME = 'base'; // 'base' | 'dark' | 'forest' | 'neutral'

// ─── CodeMirror 5 Mermaid mode ────────────────────────────────────
// cdnjs does not ship a Mermaid mode for CodeMirror, so define one here.
// Lightweight: highlights keywords, strings, comments, arrows and brackets.
if (typeof CodeMirror !== 'undefined' && CodeMirror.defineMode && !CodeMirror.modes.mermaid) {
  CodeMirror.defineMode('mermaid', function () {
    const KEYWORDS = new Set([
      'graph', 'flowchart', 'subgraph', 'end', 'direction', 'TB', 'TD', 'BT', 'RL', 'LR', 'TBP', 'TDP', 'BTP', 'RLP', 'LRP',
      'sequenceDiagram', 'participant', 'actor', 'note', 'over', 'activate', 'deactivate', 'loop', 'alt', 'else', 'opt', 'par', 'rect', 'and',
      'classDiagram', 'class', 'interface', 'enum', 'namespace', 'classDef',
      'stateDiagram', 'stateDiagram-v2', 'state', 'as', 'fork', 'choice', 'join', 'history',
      'erDiagram', 'entity', 'relationship',
      'gantt', 'title', 'dateFormat', 'axisFormat', 'section', 'milestone', 'done', 'active', 'crit', 'after',
      'pie', 'showData', 'xychart-beta', 'sankey-beta', 'mindmap', 'root', 'journey', 'timeline', 'gitGraph', 'requirementDiagram',
      'style', 'linkStyle', 'click', 'accTitle', 'accDescr'
    ]);
    return {
      startState: function () { return {}; },
      token: function (stream) {
        if (stream.match(/^\s+/)) return null;
        if (stream.match(/^%%.*$/)) return 'comment';
        if (stream.match(/^"(?:[^"\\\n]|\\.)*"/)) return 'string';
        if (stream.match(/^'(?:[^'\\\n]|\\.)*'/)) return 'string';
        if (stream.match(/^(?:-->|--o|--x|--\||-.->|\.->|==>|=>|->|---)/)) return 'atom';
        if (stream.match(/^[\[\](){}]/)) return 'bracket';
        if (stream.match(/^[A-Za-z_\u00C0-\u024F][A-Za-z0-9_\u00C0-\u024F-]*/)) {
          const word = stream.current();
          if (KEYWORDS.has(word)) return 'keyword';
          return 'variable-2';
        }
        stream.next();
        return null;
      }
    };
  });
}

// ─── Sanitize source for Mermaid parser ────────────────────────────
function _mmdSanitizeSource(source) {
  return String(source || '')
    .replace(/[\u00B7\u2022]/g, '-')      // middle dot / bullet → dash
    .replace(/[\u2013\u2014]/g, '--')     // en/em dash → double dash
    .replace(/\u00A0/g, ' ')              // non‑breaking space → normal space
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, ''); // zero‑width → remove
}

// ─── Export helpers ────────────────────────────────────────────────
function _mmdExportBaseName() {
  let base = (document.title || '').trim() || 'mermaid-diagram';
  return base
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 80) || 'mermaid-diagram';
}

function _mmdSerializeSvg(svgEl, fixedSize) {
  const clone = svgEl.cloneNode(true);
  if (fixedSize) {
    clone.setAttribute('width', String(Math.round(fixedSize.width)));
    clone.setAttribute('height', String(Math.round(fixedSize.height)));
  } else {
    clone.removeAttribute('width');
    clone.removeAttribute('height');
  }
  let xml = new XMLSerializer().serializeToString(clone);
  if (xml.indexOf('xmlns=') === -1) {
    xml = xml.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
  }
  return xml;
}

function _mmdSvgSize(svgEl) {
  const vb = svgEl.getAttribute('viewBox');
  if (vb) {
    const parts = String(vb).trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
      return { width: parts[2], height: parts[3] };
    }
  }
  const rect = svgEl.getBoundingClientRect();
  if (rect.width > 4 && rect.height > 4) {
    return { width: Math.round(rect.width), height: Math.round(rect.height) };
  }
  return { width: 1200, height: 800 };
}

function _mmdDownloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function _mmdExportHostEl() {
  if (!_mmdExportHost || !_mmdExportHost.parentNode) {
    _mmdExportHost = document.createElement('div');
    _mmdExportHost.setAttribute('aria-hidden', 'true');
    _mmdExportHost.style.cssText = 'position:absolute;left:-20000px;top:0;width:0;height:0;overflow:hidden;';
    document.body.appendChild(_mmdExportHost);
  }
  return _mmdExportHost;
}

function _mmdFlattenStyles(svgEl) {
  if (svgEl.getAttribute('data-mermaid-flattened') === '1') return;
  svgEl.setAttribute('data-mermaid-flattened', '1');
  const PROPS = [
    'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-opacity', 'stroke-width',
    'stroke-dasharray', 'stroke-dashoffset', 'stroke-linecap', 'stroke-linejoin',
    'stroke-miterlimit', 'opacity', 'visibility', 'display',
    'font-family', 'font-size', 'font-weight', 'font-style', 'letter-spacing',
    'text-anchor', 'dominant-baseline'
  ];
  const all = [svgEl, ...svgEl.querySelectorAll('*')];
  all.forEach(el => {
    if (el.tagName === 'STYLE') return;
    let cs;
    try { cs = window.getComputedStyle(el); } catch (_) { return; }
    const inline = [];
    for (const prop of PROPS) {
      const v = cs.getPropertyValue(prop);
      if (v) inline.push(prop + ': ' + v);
    }
    if (inline.length) {
      const existing = el.getAttribute('style') || '';
      el.setAttribute('style', existing ? existing + '; ' + inline.join('; ') : inline.join('; '));
    }
  });
  svgEl.querySelectorAll('style').forEach(s => s.parentNode.removeChild(s));
  svgEl.style.maxWidth = '';
}

function _mmdTextRuns(el) {
  const runs = [];
  (function walk(n, bold, italic) {
    if (n.nodeType === 3) {
      const t = n.textContent || '';
      if (t) runs.push({ t, bold, italic });
      return;
    }
    if (n.nodeType !== 1) return;
    if (n.tagName === 'BR') { runs.push({ br: true }); return; }
    const nb = bold || n.tagName === 'STRONG' || n.tagName === 'B';
    const ni = italic || n.tagName === 'EM' || n.tagName === 'I';
    n.childNodes.forEach(c => walk(c, nb, ni));
  })(el, false, false);
  return runs;
}

function _mmdConvertForeignObjects(svgEl) {
  const SVGNS = 'http://www.w3.org/2000/svg';
  svgEl.querySelectorAll('foreignObject').forEach(fo => {
    const x = parseFloat(fo.getAttribute('x') || '0') || 0;
    const y = parseFloat(fo.getAttribute('y') || '0') || 0;
    const w = parseFloat(fo.getAttribute('width') || '0') || 0;
    const h = parseFloat(fo.getAttribute('height') || '0') || 0;
    const lines = [];
    fo.childNodes.forEach(child => {
      if (child.nodeType !== 1) return;
      if (!child.textContent || !child.textContent.trim()) return;
      lines.push({ runs: _mmdTextRuns(child) });
    });
    if (w < 1 || h < 1 || !lines.length) { fo.parentNode.removeChild(fo); return; }
    const styleEl = fo.querySelector('span, div, p, strong, b, em, i');
    const cs = styleEl ? window.getComputedStyle(styleEl) : null;
    const fs = cs ? (parseFloat(cs.fontSize) || 16) : 16;
    let lh = cs ? (parseFloat(cs.lineHeight) || 0) : 0;
    if (!lh || lh <= 0) lh = Math.round(fs * 1.2);
    const fill = (cs && cs.fill && cs.fill !== 'rgb(0, 0, 0)') ? cs.fill : (cs ? cs.color : '#000');
    const centerX = x + w / 2;
    const firstBaseline = y + (h - lines.length * lh) / 2 + fs * 0.75;
    const text = document.createElementNS(SVGNS, 'text');
    text.setAttribute('x', centerX.toFixed(2));
    text.setAttribute('y', firstBaseline.toFixed(2));
    text.setAttribute('text-anchor', 'start');
    text.setAttribute('fill', fill);
    text.setAttribute('data-mermaid-converted', '1');
    if (cs && cs.fontFamily) text.setAttribute('font-family', cs.fontFamily);
    text.setAttribute('font-size', String(fs));
    if (cs && cs.fontWeight && cs.fontWeight !== '400' && cs.fontWeight !== 'normal') {
      text.setAttribute('font-weight', cs.fontWeight);
    }
    if (cs && cs.fontStyle === 'italic') text.setAttribute('font-style', 'italic');
    lines.forEach((line, i) => {
      const runs = line.runs.filter(r => !r.br);
      if (!runs.length) return;
      const dy = i > 0 ? lh : 0;
      if (runs.length === 1) {
        const r = runs[0];
        const ts = document.createElementNS(SVGNS, 'tspan');
        if (dy) ts.setAttribute('dy', dy.toFixed(2));
        if (r.bold) ts.setAttribute('font-weight', 'bold');
        if (r.italic) ts.setAttribute('font-style', 'italic');
        ts.textContent = r.t;
        text.appendChild(ts);
      } else {
        const lineEl = document.createElementNS(SVGNS, 'tspan');
        if (dy) lineEl.setAttribute('dy', dy.toFixed(2));
        runs.forEach(r => {
          const ts = document.createElementNS(SVGNS, 'tspan');
          if (r.bold) ts.setAttribute('font-weight', 'bold');
          if (r.italic) ts.setAttribute('font-style', 'italic');
          ts.textContent = r.t;
          lineEl.appendChild(ts);
        });
        text.appendChild(lineEl);
      }
    });
    fo.parentNode.replaceChild(text, fo);
  });

  // Centre each converted line
  svgEl.querySelectorAll('text[data-mermaid-converted="1"]').forEach(text => {
    const cx = parseFloat(text.getAttribute('x')) || 0;
    const lines = [...text.childNodes].filter(n => n.nodeType === 1);
    lines.forEach(line => {
      const runs = line.childNodes.length
        ? [...line.childNodes].filter(n => n.nodeType === 1)
        : [line];
      const widths = runs.map(ts => (ts.getComputedTextLength && ts.getComputedTextLength()) || 0);
      const total = widths.reduce((a, b) => a + b, 0);
      let cursor = cx - total / 2;
      runs.forEach((ts, i) => {
        ts.setAttribute('x', cursor.toFixed(2));
        cursor += widths[i];
      });
    });
  });
}

function _mmdPrepareExportSvg(svgEl) {
  return new Promise(resolve => {
    if (!svgEl || typeof window.getComputedStyle !== 'function' || typeof requestAnimationFrame !== 'function') {
      resolve(svgEl);
      return;
    }
    const host = _mmdExportHostEl();
    if (!host) { resolve(svgEl); return; }
    host.appendChild(svgEl);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        try {
          _mmdConvertForeignObjects(svgEl);
          _mmdFlattenStyles(svgEl);
        } catch (_) { /* leave as-is */ }
        if (svgEl.parentNode) svgEl.parentNode.removeChild(svgEl);
        resolve(svgEl);
      });
    });
  });
}

function _mmdResolveSvg(container) {
  let svgEl = container.querySelector('svg');
  if (svgEl) return svgEl;
  const frame = container.querySelector('iframe');
  if (!frame) return null;
  const src = frame.getAttribute('src') || '';
  const m = src.match(/^data:text\/html[^,]*;base64,([\s\S]+)$/);
  if (!m) return null;
  let html;
  try { html = atob(m[1].replace(/\s+/g, '')); } catch (_) { return null; }
  if (!html || html.indexOf('<svg') === -1) return null;
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.querySelector('svg') || null;
  } catch (_) { return null; }
}

function _mmdExportSvg(svgEl, filename) {
  _mmdPrepareExportSvg(svgEl).then(prepared => {
    const xml = _mmdSerializeSvg(prepared, null);
    _mmdDownloadBlob(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }), filename + '.svg');
  });
}

function _mmdExportPng(svgEl, filename) {
  _mmdPrepareExportSvg(svgEl).then(prepared => {
    const size = _mmdSvgSize(prepared);
    const xml = _mmdSerializeSvg(prepared, size);
    const blobUrl = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));
    const img = new Image();
    img.onload = () => {
      try {
        const scale = 2;
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(size.width * scale);
        canvas.height = Math.round(size.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => {
          if (blob) _mmdDownloadBlob(blob, filename + '.png');
        }, 'image/png');
      } finally {
        URL.revokeObjectURL(blobUrl);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(blobUrl);
      _mmdExportSvg(prepared, filename);
    };
    img.src = blobUrl;
  });
}

// ─── Full‑screen overlay ──────────────────────────────────────────
function _mmdOpenFullView(container) {
  if (_mmdFullscreenOverlay) {
    document.body.removeChild(_mmdFullscreenOverlay);
    _mmdFullscreenOverlay = null;
  }

  const isSvg = !!container.querySelector('svg');
  const contentEl = container.querySelector('svg') || container.querySelector('iframe');

  const overlay = document.createElement('div');
  overlay.className = 'mermaid-fullscreen-overlay';
  overlay.tabIndex = -1;

  const toolbar = document.createElement('div');
  toolbar.className = 'mermaid-fullscreen-toolbar';

  const title = document.createElement('span');
  title.className = 'mermaid-fullscreen-title';
  title.textContent = 'Diagrama';

  const controls = document.createElement('div');
  controls.className = 'mermaid-fullscreen-controls';

  if (isSvg) {
    controls.innerHTML = `
      <button class="mermaid-zbtn" data-action="zoom-out" title="Zoom out"><i class="fas fa-minus"></i></button>
      <span class="mermaid-zoom-pct">100%</span>
      <button class="mermaid-zbtn" data-action="zoom-in" title="Zoom in"><i class="fas fa-plus"></i></button>
      <button class="mermaid-zbtn" data-action="zoom-reset" title="Reset zoom"><i class="fas fa-expand"></i></button>
    `;
  }

  const closeBtn = document.createElement('button');
  closeBtn.className = 'mermaid-close-btn';
  closeBtn.innerHTML = '<i class="fas fa-times"></i>';
  closeBtn.title = 'Fechar (Esc)';
  controls.appendChild(closeBtn);

  toolbar.appendChild(title);
  toolbar.appendChild(controls);

  const body = document.createElement('div');
  body.className = 'mermaid-fullscreen-body';

  const diagramBox = document.createElement('div');
  diagramBox.className = 'mermaid-fullscreen-diagram';
  body.appendChild(diagramBox);

  overlay.appendChild(toolbar);
  overlay.appendChild(body);

  // Clone content
  let clonedContent;
  if (contentEl) {
    clonedContent = contentEl.cloneNode(true);
    if (isSvg) {
      clonedContent.removeAttribute('width');
      clonedContent.removeAttribute('height');
      clonedContent.style.maxWidth = 'none';
      clonedContent.style.width = 'auto';
      clonedContent.style.height = 'auto';
    }
    diagramBox.appendChild(clonedContent);
  } else {
    diagramBox.innerHTML = container.innerHTML;
  }

  document.body.appendChild(overlay);
  setTimeout(() => overlay.focus(), 50);

  function closeOverlay() {
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    document.removeEventListener('keydown', _onKey);
    _mmdFullscreenOverlay = null;
  }

  function _onKey(e) {
    if (e.key === 'Escape') closeOverlay();
  }
  document.addEventListener('keydown', _onKey);
  closeBtn.addEventListener('click', closeOverlay);
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeOverlay();
  });

  // Zoom & Pan for SVG
  if (isSvg && clonedContent) {
    let scale = 1, panX = 0, panY = 0;
    const zoomPctEl = controls.querySelector('.mermaid-zoom-pct');

    function updateTransform() {
      clonedContent.style.transformOrigin = '0 0';
      clonedContent.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
      if (zoomPctEl) zoomPctEl.textContent = Math.round(scale * 100) + '%';
    }

    diagramBox.addEventListener('wheel', e => {
      e.preventDefault();
      const rect = diagramBox.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const delta = e.deltaY > 0 ? 0.88 : 1 / 0.88;
      const newScale = Math.max(0.1, Math.min(20, scale * delta));
      const ratio = newScale / scale;
      panX = mx - (mx - panX) * ratio;
      panY = my - (my - panY) * ratio;
      scale = newScale;
      updateTransform();
    }, { passive: false });

    let isDragging = false, dragStartX, dragStartY, panStartX, panStartY;
    clonedContent.style.cursor = 'grab';

    clonedContent.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      panStartX = panX;
      panStartY = panY;
      clonedContent.style.cursor = 'grabbing';
      e.preventDefault();
    });

    document.addEventListener('mousemove', e => {
      if (!isDragging) return;
      panX = panStartX + (e.clientX - dragStartX);
      panY = panStartY + (e.clientY - dragStartY);
      updateTransform();
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        clonedContent.style.cursor = 'grab';
      }
    });

    controls.querySelector('[data-action="zoom-in"]').addEventListener('click', () => {
      scale = Math.min(20, scale * 1.3);
      updateTransform();
    });
    controls.querySelector('[data-action="zoom-out"]').addEventListener('click', () => {
      scale = Math.max(0.1, scale / 1.3);
      updateTransform();
    });
    controls.querySelector('[data-action="zoom-reset"]').addEventListener('click', () => {
      scale = 1; panX = 0; panY = 0;
      updateTransform();
    });
  }

  _mmdFullscreenOverlay = overlay;
}

// ─── Render a diagram from source into a container ──────────────
async function _mmdRenderDiagram(source, targetEl) {
  const mySeq = ++_mmdRenderSeq;
  if (!targetEl) return;
  const cleanSource = _mmdSanitizeSource(source);
  if (!cleanSource.trim()) {
    targetEl.innerHTML = '<div style="color:var(--gray);padding:20px;text-align:center;">Digite ou cole o código Mermaid para visualizar o diagrama.</div>';
    return;
  }

  if (typeof mermaid === 'undefined') {
    targetEl.innerHTML = '<div style="color:var(--red);padding:20px;">Biblioteca Mermaid não carregada.</div>';
    return;
  }

  // Initialize Mermaid once
  if (!window._mermaidInitialized) {
    const isDark = document.body.classList.contains('dark');
    mermaid.initialize({
      startOnLoad: false,
      theme: _MMD_THEME,
      themeVariables: isDark ? {
        background: '#1e1c1a',
        primaryColor: '#2d785a',
        primaryTextColor: '#d4cfc8',
        primaryBorderColor: '#4a6a5a',
        lineColor: '#8a9a8a',
        secondaryColor: '#2a3f30',
        tertiaryColor: '#3a4a3a',
      } : {
        background: '#faf9f6',
        primaryColor: '#2d785a',
        primaryTextColor: '#1a1a1a',
        primaryBorderColor: '#4a6a5a',
        lineColor: '#6a7a6a',
        secondaryColor: '#e8eee8',
        tertiaryColor: '#d8e0d8',
      },
      logLevel: 1, // quiet
      securityLevel: 'sandbox',
    });
    window._mermaidInitialized = true;
  }

  const id = 'mermaid-' + Math.random().toString(36).slice(2, 10);
  try {
    const result = await mermaid.render(id, cleanSource);
    if (mySeq !== _mmdRenderSeq) return; // superseded by a newer render
    // In sandbox mode mermaid returns an <iframe> whose inline height is the
    // diagram's natural height (can be thousands of px), which breaks the
    // preview layout. Resolve the real <svg> and inject it instead.
    const holder = document.createElement('div');
    holder.innerHTML = result.svg;
    const svgEl = _mmdResolveSvg(holder);
    if (svgEl) {
      targetEl.innerHTML = '';
      targetEl.appendChild(svgEl);
    } else {
      targetEl.innerHTML = result.svg;
      const frame = targetEl.querySelector('iframe');
      if (frame) {
        frame.style.height = 'auto';
        frame.style.maxHeight = '55vh';
      }
    }
    targetEl.querySelectorAll('.mermaid-rendered, .mermaid-container, .mermaid-error').forEach(el => el.remove());
    // Add export button & full‑view
    _mmdAttachToolbar(targetEl);
  } catch (err) {
    if (mySeq !== _mmdRenderSeq) return; // superseded by a newer render
    targetEl.innerHTML = `
      <div class="mermaid-error-banner">
        <i class="fas fa-triangle-exclamation"></i> Erro: ${escapeHtml(err.message || 'Erro ao renderizar')}
      </div>
      <pre class="olivia-doc-pre mermaid-error-source"><code>${escapeHtml(cleanSource)}</code></pre>
    `;
  }
}

// ─── Attach toolbar (export, full‑view) to a rendered diagram ──
function _mmdAttachToolbar(container) {
  let svgEl = container.querySelector('svg');
  if (!svgEl) svgEl = _mmdResolveSvg(container);
  if (!svgEl) return;

  const wrapper = document.createElement('div');
  wrapper.className = 'mermaid-container mermaid-rendered';
  wrapper.innerHTML = container.innerHTML;
  container.innerHTML = '';
  container.appendChild(wrapper);

  // Full-view button
  const expandBtn = document.createElement('button');
  expandBtn.className = 'mermaid-expand-btn';
  expandBtn.innerHTML = '<i class="fas fa-expand"></i>';
  expandBtn.title = 'Abrir em tela cheia';
  expandBtn.setAttribute('aria-label', 'Abrir em tela cheia');
  wrapper.appendChild(expandBtn);

  // Export dropdown
  const exportWrap = document.createElement('div');
  exportWrap.className = 'mermaid-export-wrap';

  const exportBtn = document.createElement('button');
  exportBtn.className = 'mermaid-export-btn';
  exportBtn.innerHTML = '<i class="fas fa-download"></i>';
  exportBtn.title = 'Exportar diagrama';
  exportBtn.setAttribute('aria-label', 'Exportar diagrama');
  exportBtn.setAttribute('aria-haspopup', 'menu');
  exportBtn.setAttribute('aria-expanded', 'false');

  const exportMenu = document.createElement('div');
  exportMenu.className = 'mermaid-export-menu';
  exportMenu.setAttribute('role', 'menu');
  exportMenu.innerHTML = `
    <button type="button" role="menuitem" data-format="png"><i class="fas fa-file-image"></i> Exportar PNG</button>
    <button type="button" role="menuitem" data-format="svg"><i class="fas fa-file-code"></i> Exportar SVG</button>
  `;

  exportWrap.appendChild(exportBtn);
  exportWrap.appendChild(exportMenu);
  wrapper.appendChild(exportWrap);

  // Wire export dropdown
  function closeExportMenu() {
    if (!exportMenu.classList.contains('mermaid-export-open')) return;
    exportMenu.classList.remove('mermaid-export-open');
    exportBtn.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', onDocClick);
    document.removeEventListener('keydown', onExportKey);
    window.removeEventListener('scroll', onWinScroll, true);
    window.removeEventListener('resize', onWinScroll);
  }
  function openExportMenu() {
    const rect = exportBtn.getBoundingClientRect();
    exportMenu.style.position = 'fixed';
    exportMenu.style.top = Math.round(rect.bottom + 4) + 'px';
    exportMenu.style.right = Math.round(window.innerWidth - rect.right) + 'px';
    exportMenu.style.maxHeight = 'none';
    exportMenu.classList.add('mermaid-export-open');
    exportBtn.setAttribute('aria-expanded', 'true');
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onExportKey);
    window.addEventListener('scroll', onWinScroll, true);
    window.addEventListener('resize', onWinScroll);
  }
  function onDocClick(e) {
    if (!exportWrap.contains(e.target)) closeExportMenu();
  }
  function onExportKey(e) {
    if (e.key === 'Escape') closeExportMenu();
  }
  function onWinScroll() {
    if (exportMenu.classList.contains('mermaid-export-open')) closeExportMenu();
  }

  exportBtn.addEventListener('click', e => {
    e.stopPropagation();
    e.preventDefault();
    if (exportMenu.classList.contains('mermaid-export-open')) closeExportMenu();
    else openExportMenu();
  });

  exportMenu.addEventListener('click', e => {
    e.stopPropagation();
    e.preventDefault();
    const item = e.target.closest('[data-format]');
    if (!item) return;
    closeExportMenu();
    const svg = _mmdResolveSvg(wrapper) || wrapper.querySelector('svg');
    if (!svg) return;
    const filename = _mmdExportBaseName();
    if (item.getAttribute('data-format') === 'png') _mmdExportPng(svg, filename);
    else _mmdExportSvg(svg, filename);
  });

  // Full-view
  expandBtn.addEventListener('click', e => {
    e.stopPropagation();
    e.preventDefault();
    _mmdOpenFullView(wrapper);
  });

  // Update export button states after render
  setTimeout(() => {
    const svgEl2 = wrapper.querySelector('svg');
    if (svgEl2) {
      svgEl2.style.maxWidth = '100%';
      svgEl2.style.height = 'auto';
    }
  }, 50);
}

// ─── Panel UI ──────────────────────────────────────────────────────
function _mmdLoadPanel() {
  const panel = document.getElementById('mermaidPanel');
  if (!panel) {
    console.warn('[Mermaid] Panel container #mermaidPanel not found.');
    return;
  }

  // Show panel, hide others (caller should handle tab visibility)
  // We'll just build the UI if not already built.
  if (_mmdPanelReady) {
    panel.style.display = '';
    return;
  }

  const initialSource = `graph TD
    A[Início] --> B{Decisão}
    B -->|Sim| C[Resultado]
    B -->|Não| D[Fim]`;

  const cmAvailable = typeof CodeMirror !== 'undefined';

  panel.innerHTML = `
    <div class="mermaid-panel">
      <div class="mermaid-toolbar">
        ${cmAvailable
          ? '<div id="mermaidEditorContainer" class="mermaid-editor-cm"></div>'
          : `<textarea id="mermaidSource" class="mermaid-editor" placeholder="Digite o código Mermaid aqui…" spellcheck="false">${escapeHtml(initialSource)}</textarea>`}
        <div class="mermaid-actions">
          <button id="mermaidRenderBtn" class="btn btn-primary"><i class="fas fa-play"></i> Renderizar</button>
          <button id="mermaidClearBtn" class="btn btn-sm"><i class="fas fa-eraser"></i> Limpar</button>
          <button id="mermaidExampleBtn" class="btn btn-sm"><i class="fas fa-list"></i> Exemplos</button>
          <div class="mermaid-example-dropdown" id="mermaidExampleDropdown" style="display:none;">
            <button data-example="flow">Fluxograma</button>
            <button data-example="seq">Sequência</button>
            <button data-example="class">Classes</button>
            <button data-example="state">Estado</button>
            <button data-example="gantt">Gantt</button>
          </div>
        </div>
      </div>
      <div id="mermaidPreview" class="mermaid-preview">
        <div style="color:var(--gray);padding:20px;text-align:center;">Digite ou cole o código Mermaid para visualizar o diagrama.</div>
      </div>
    </div>
  `;

  const renderBtn = document.getElementById('mermaidRenderBtn');
  const previewEl = document.getElementById('mermaidPreview');
  const clearBtn = document.getElementById('mermaidClearBtn');
  const exampleBtn = document.getElementById('mermaidExampleBtn');
  const exampleDropdown = document.getElementById('mermaidExampleDropdown');

  let getSource, setSource, bindSourceChange;

  if (cmAvailable) {
    const editorContainer = document.getElementById('mermaidEditorContainer');
    const cmEditor = CodeMirror(editorContainer, {
      value: initialSource,
      mode: 'mermaid',
      theme: 'material-darker',
      lineNumbers: true,
      matchBrackets: true,
      autoCloseBrackets: true,
      tabSize: 2,
      indentUnit: 2,
      extraKeys: {
        'Ctrl-Enter': () => doRender(),
        'Cmd-Enter': () => doRender(),
      },
    });
    window._mermaidCodeMirror = cmEditor; // for external use
    getSource = () => cmEditor.getValue();
    setSource = v => cmEditor.setValue(v);
    bindSourceChange = cb => cmEditor.on('change', () => cb());
  } else {
    const sourceEl = document.getElementById('mermaidSource');
    getSource = () => sourceEl.value;
    setSource = v => { sourceEl.value = v; };
    bindSourceChange = cb => {
      sourceEl.addEventListener('input', cb);
      sourceEl.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          doRender();
        }
      });
    };
  }

  // Dedupe: skip re-rendering when the source did not change
  let lastRenderedSource = null;
  const doRender = () => {
    const src = getSource();
    if (src === lastRenderedSource) return;
    lastRenderedSource = src;
    _mmdRenderDiagram(src, previewEl);
  };

  if (renderBtn) {
    renderBtn.addEventListener('click', () => {
      lastRenderedSource = null; // always re-render on explicit click
      doRender();
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      setSource('');
      lastRenderedSource = '';
      previewEl.innerHTML = '<div style="color:var(--gray);padding:20px;text-align:center;">Digite ou cole o código Mermaid para visualizar o diagrama.</div>';
    });
  }

  if (exampleBtn && exampleDropdown) {
    exampleBtn.addEventListener('click', e => {
      e.stopPropagation();
      const isOpen = exampleDropdown.style.display !== 'none';
      exampleDropdown.style.display = isOpen ? 'none' : 'flex';
    });
    document.addEventListener('click', () => {
      if (exampleDropdown) exampleDropdown.style.display = 'none';
    });
    exampleDropdown.querySelectorAll('[data-example]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const key = btn.getAttribute('data-example');
        const examples = {
          flow: `graph TD
    A[Início] --> B{Decisão}
    B -->|Sim| C[Resultado]
    B -->|Não| D[Fim]`,
          seq: `sequenceDiagram
    Alice->>John: Hello John, how are you?
    John-->>Alice: Great!
    Alice-)John: See you later!`,
          class: `classDiagram
    Animal <|-- Duck
    Animal <|-- Fish
    Animal : +int age
    Animal : +string name
    Duck : +string beakColor
    Fish : +int finCount`,
          state: `stateDiagram-v2
    [*] --> Still
    Still --> [*]
    Still --> Moving
    Moving --> Still
    Moving --> Crash
    Crash --> [*]`,
          gantt: `gantt
    title A Gantt Diagram
    dateFormat  YYYY-MM-DD
    section Section
    A task           :a1, 2026-01-01, 30d
    Another task     :after a1, 20d`
        };
        if (examples[key]) {
          setSource(examples[key]);
          lastRenderedSource = null; // force re-render of the example
          doRender();
          exampleDropdown.style.display = 'none';
        }
      });
    });
  }

  // Live preview: auto-render 500ms after the user stops typing
  let debounceTimer = null;
  bindSourceChange(() => {
    const src = getSource();
    if (src === lastRenderedSource) return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(doRender, 500);
  });

  _mmdPanelReady = true;
  // Auto‑render initial example
  setTimeout(doRender, 100);
}

// ─── Full main-area view (sidebar tab integration) ────────────────
function _mmdShowView() {
  // Deactivate competing full-screen views
  ['shadersView', 'listeningView', 'studioView', 'descobertaView', 'memoryView', 'spacesView', 'architectureView']
    .forEach(id => {
      const v = document.getElementById(id);
      if (v) v.classList.remove('active');
    });
  if (typeof aexHideMain === 'function') aexHideMain();
  const mc = document.querySelector('.main-content');
  if (mc) { mc._mermaidDisplay = mc.style.display; mc.style.display = 'none'; }
  const v = document.getElementById('mermaidView');
  if (v) { v.style.display = ''; v.classList.add('active'); }
  const st = document.getElementById('mermaidViewStatus');
  if (st) st.textContent = '';
  _mmdLoadPanel();
}

function _mmdHideView() {
  const v = document.getElementById('mermaidView');
  if (v) { v.classList.remove('active'); v.style.display = 'none'; }
  const mc = document.querySelector('.main-content');
  if (mc) { mc.style.display = mc._mermaidDisplay || ''; }
}

// ─── Expose public API ────────────────────────────────────────────
window.loadMermaidPanel = _mmdLoadPanel;
window.renderMermaidDiagram = _mmdRenderDiagram;
window._openMermaidFullView = _mmdOpenFullView; // for external use
window._exportMermaidPng = _mmdExportPng;
window._exportMermaidSvg = _mmdExportSvg;
window.mermaidShowView = _mmdShowView;
window.mermaidHideView = _mmdHideView;

// ─── Auto‑init when DOM ready ────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // If the panel container exists, we can optionally preload it on demand.
  // The sidebar tab will call mermaidShowView() when clicked.
  // We'll just ensure the container exists.
  if (!document.getElementById('mermaidPanel')) {
    // Optionally create a placeholder; but the HTML should provide it.
    console.warn('[Mermaid] No #mermaidPanel found – create a div with that id.');
  }
});