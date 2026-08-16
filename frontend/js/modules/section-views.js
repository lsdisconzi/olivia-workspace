/* ═══════════════════════════════════════════════════════════════════
   section-views.js — shared helpers for the .vw-* main views
   (violations, lawlib, legalrouter).
   - vwInitResize(handleId, sidebarId): drag-to-resize the sidebar.
   - vwFilePills(url, name, kind): HTML for Preview / Output / Browser pills.
   - vwOpenInPreview/Output/Browser: thin wrappers that fall back gracefully
     when the discovery helpers (discOpenFile*) are not loaded yet.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function _vwEsc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function vwInitResize(handleId, sidebarId) {
    var handle = document.getElementById(handleId);
    var sidebar = document.getElementById(sidebarId);
    if (!handle || !sidebar) return;
    if (handle._vwResizeBound) return;
    handle._vwResizeBound = true;

    var dragging = false, startX = 0, startW = 0;
    var stopDragging = function () {
      if (!dragging) return;
      dragging = false;
      handle.classList.remove('dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.body.classList.remove('is-panel-resizing');
    };
    handle.addEventListener('mousedown', function (e) {
      if (e.button !== 0) return;
      dragging = true;
      startX = e.clientX;
      startW = sidebar.offsetWidth;
      handle.classList.add('dragging');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.body.classList.add('is-panel-resizing');
      e.preventDefault();
    });
    document.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      var w = Math.min(Math.max(startW + (e.clientX - startX), 220), 520);
      sidebar.style.width = w + 'px';
      sidebar.style.maxWidth = w + 'px';
    });
    document.addEventListener('mouseup', stopDragging);
    window.addEventListener('mouseup', stopDragging, true);
    window.addEventListener('blur', stopDragging);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stopDragging();
    });
  }

  function vwOpenInPreview(url, name, kind) {
    if (typeof window.discOpenFilePreview === 'function') {
      return window.discOpenFilePreview(url, name, kind);
    }
    if (typeof window.openPreviewUrl === 'function') {
      var opts = {};
      if (kind) {
        opts.mimeType = kind;
      }
      return window.openPreviewUrl(url, name, opts);
    }
    window.open(url, '_blank');
  }

  function vwOpenInOutput(url, name, kind) {
    if (typeof window.discOpenFileOutput === 'function') {
      return window.discOpenFileOutput(url, name, kind);
    }
    window.open(url, '_blank');
  }

  function vwOpenInBrowser(url, name, kind) {
    if (typeof window.discOpenFileBrowser === 'function') {
      return window.discOpenFileBrowser(url, name, kind);
    }
    var iframe = document.getElementById('browserFrame');
    if (iframe && typeof window.toggleBrowserPanel === 'function') {
      var panel = document.getElementById('browserPanel');
      if (panel && !panel.classList.contains('open')) window.toggleBrowserPanel();
      iframe.src = url;
      return;
    }
    window.open(url, '_blank');
  }

  /**
   * Build a 3-pill action bar (Preview / Output / Browser) for a file URL.
   * The url + name are JSON-stringified so they survive being inlined inside
   * onclick="..." attributes (single-quoted).
   */
  function vwFilePills(url, name, kind) {
    if (!url) return '';
    var u = JSON.stringify(String(url));
    var n = JSON.stringify(String(name || ''));
    var k = JSON.stringify(kind == null ? '' : kind);
    // The Convert pill is shown for files with a convertible extension
    var ext = String(name || '').split('.').pop().toLowerCase();
    var convertible = (ext === 'json' || ext === 'md' || ext === 'docx');
    var convertPill = convertible
      ? '<button class="btn-xs vw-convert-btn" type="button" onclick=\'vwOpenConvertMenu(' + _vwEsc(u) + ',' + _vwEsc(n) + ',' + _vwEsc(k) + ')\' title="Converter (JSON→MD→DOCX/PDF)"><i class="fas fa-exchange-alt"></i></button>'
      : '';
    return [
      '<span class="vw-file-pills">',
        '<button class="btn-xs" type="button" onclick=\'vwOpenInPreview(' + _vwEsc(u) + ',' + _vwEsc(n) + ',' + _vwEsc(k) + ')\' title="Preview"><i class="fas fa-eye"></i></button>',
        '<button class="btn-xs" type="button" onclick=\'vwOpenInOutput('  + _vwEsc(u) + ',' + _vwEsc(n) + ',' + _vwEsc(k) + ')\' title="Output panel"><i class="fas fa-columns"></i></button>',
        '<button class="btn-xs" type="button" onclick=\'vwOpenInBrowser(' + _vwEsc(u) + ',' + _vwEsc(n) + ',' + _vwEsc(k) + ')\' title="Browser panel"><i class="fas fa-globe"></i></button>',
        convertPill,
      '</span>',
    ].join('');
  }

  // ── Convert menu (project-default actions) ──────────────────────────────
  function vwOpenConvertMenu(url, name, kind) {
    if (typeof name !== 'string') name = '';
    var ext = (name.split('.').pop() || '').toLowerCase();
    var pid = (typeof window.OliviaProjectId === 'string' && window.OliviaProjectId)
              ? window.OliviaProjectId : 'translations';
    var api = (typeof API_BASE !== 'undefined' && API_BASE) ? API_BASE : '';
    var menu = document.getElementById('vwConvertMenu');
    if (!menu) {
      menu = document.createElement('div');
      menu.id = 'vwConvertMenu';
      menu.className = 'vw-convert-menu';
      document.body.appendChild(menu);
    }
    menu.innerHTML = '<div class="vw-convert-head"><i class="fas fa-exchange-alt"></i> Converter arquivo'
      + '<button type="button" class="vw-convert-close" onclick="vwCloseConvertMenu()">×</button></div>'
      + '<div class="vw-convert-loading">Carregando ações…</div>';
    menu.style.display = 'block';
    if (window.event && window.event.currentTarget) {
      var r = window.event.currentTarget.getBoundingClientRect();
      menu.style.left = Math.min(r.left, window.innerWidth - 260) + 'px';
      menu.style.top = (r.bottom + 6) + 'px';
    }
    fetch(api + '/api/violations/actions?project_id=' + encodeURIComponent(pid))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var acts = (data && data.actions) || [];
        var html = ['<div class="vw-convert-head"><i class="fas fa-exchange-alt"></i> Converter arquivo'
          + '<button type="button" class="vw-convert-close" onclick="vwCloseConvertMenu()">×</button></div>'];
        html.push('<div class="vw-convert-file">' + _vwEscHtml(name) + '</div>');
        if (!acts.length) {
          html.push('<div class="vw-convert-empty">Nenhuma ação disponível.</div>');
        }
        acts.forEach(function (a) {
          var fromOk = (a.from && a.from.indexOf(ext) >= 0) || (!a.from);
          if (!fromOk) return;
          html.push('<button type="button" class="vw-convert-action" title="' + _vwEscHtml(a.title || a.label || '')
            + '" onclick=\'vwConvertFile(' + JSON.stringify(url) + ',' + JSON.stringify(name) + ',' + JSON.stringify(a.id) + ',' + JSON.stringify(pid) + ')\'>'
            + '<i class="fas fa-' + (a.icon || 'file') + '"></i> ' + _vwEscHtml(a.label || a.id) + '</button>');
        });
        if (data && data.source === 'project') {
          html.push('<div class="vw-convert-note">Ações salvas no projeto: ' + _vwEscHtml(pid) + '</div>');
        }
        menu.innerHTML = html.join('');
      })
      .catch(function () {
        menu.innerHTML = '<div class="vw-convert-head">Converter</div><div class="vw-convert-empty">Falha ao carregar ações.</div>';
      });
  }

  function vwCloseConvertMenu() {
    var menu = document.getElementById('vwConvertMenu');
    if (menu) menu.style.display = 'none';
  }

  function _vwPathFromUrl(url) {
    try {
      var u = new URL(url, location.href);
      return u.searchParams.get('path') || '';
    } catch (e) { return ''; }
  }

  function vwConvertFile(url, name, actionId, projectId) {
    vwCloseConvertMenu();
    var rel = _vwPathFromUrl(url);
    var api = (typeof API_BASE !== 'undefined' && API_BASE) ? API_BASE : '';
    var pid = projectId || (typeof window.OliviaProjectId === 'string' ? window.OliviaProjectId : 'translations');
    vwToast('Convertendo ' + (name || '') + ' …');
    fetch(api + '/api/violations/convert?path=' + encodeURIComponent(rel)
         + '&action=' + encodeURIComponent(actionId)
         + '&project_id=' + encodeURIComponent(pid))
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (!res || !res.ok) {
          vwToast('Erro: ' + ((res && res.error) || 'desconhecido'), true);
          return;
        }
        var out = (res.url || (api + '/api/violations/file?path=' + encodeURIComponent(res.output || '')));
        vwToast('Concluído: ' + (res.output_name || res.output || ''));
        if (typeof window.vwOpenInOutput === 'function') {
          window.vwOpenInOutput(out, res.output_name || 'result', res.output ? res.output.split('.').pop() : '');
        }
      })
      .catch(function (e) { vwToast('Falha: ' + e, true); });
  }

  function vwToast(msg, isError) {
    var t = document.getElementById('vwToast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'vwToast';
      t.className = 'vw-toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.className = 'vw-toast show' + (isError ? ' error' : '');
    clearTimeout(t._vwT);
    t._vwT = setTimeout(function () { t.className = 'vw-toast'; }, 3500);
  }

  function _vwEscHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  window.vwInitResize = vwInitResize;
  window.vwOpenInPreview = vwOpenInPreview;
  window.vwOpenInOutput = vwOpenInOutput;
  window.vwOpenInBrowser = vwOpenInBrowser;
  window.vwFilePills = vwFilePills;

  /**
   * Edge-resize the section view itself by dragging its left grip.
   * Sets `flex: 0 0 Xpx` so other panels (output/preview/browser) can
   * claim the freed horizontal space.
   */
  function vwInitEdgeResize(handleId, viewId) {
    var handle = document.getElementById(handleId);
    var view = document.getElementById(viewId);
    if (!handle || !view) return;
    if (handle._vwEdgeBound) return;
    handle._vwEdgeBound = true;

    var dragging = false, startX = 0, startW = 0;
    var stopDragging = function () {
      if (!dragging) return;
      dragging = false;
      handle.classList.remove('dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.body.classList.remove('is-panel-resizing');
    };
    handle.addEventListener('mousedown', function (e) {
      if (e.button !== 0) return;
      dragging = true;
      startX = e.clientX;
      startW = view.offsetWidth;
      handle.classList.add('dragging');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.body.classList.add('is-panel-resizing');
      e.preventDefault();
    });
    document.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      // Drag handle is on the LEFT edge → moving cursor right shrinks the view.
      var delta = e.clientX - startX;
      var w = Math.min(Math.max(startW - delta, 360), Math.max(window.innerWidth - 200, 480));
      view.style.flex = '0 0 ' + w + 'px';
      view.style.maxWidth = 'none';
    });
    document.addEventListener('mouseup', stopDragging);
    window.addEventListener('mouseup', stopDragging, true);
    window.addEventListener('blur', stopDragging);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stopDragging();
    });

    // Double-click to reset to flex:1 (auto-fill).
    handle.addEventListener('dblclick', function () {
      view.style.flex = '';
      view.style.maxWidth = '';
    });
  }
  window.vwInitEdgeResize = vwInitEdgeResize;

  /* ── Article-style pills (5 actions) for inline content ────────────── */

  // Cache of synthesized blobs so the same content reused across pills uses
  // the same URL (preview/output/browser).
  var _vwTextStore = Object.create(null);
  var _vwSeq = 0;

  function _vwRegisterText(name, ext, content) {
    var id = 'vw-text-' + (++_vwSeq);
    _vwTextStore[id] = { name: name || 'fragment.txt', ext: (ext || 'md').toLowerCase(), content: String(content || '') };
    return id;
  }

  function _vwResolve(id) { return _vwTextStore[id]; }

  function _vwMime(ext) {
    return ({ json: 'application/json', html: 'text/html', md: 'text/markdown', markdown: 'text/markdown' })[ext] || 'text/plain';
  }

  function _vwDataUrl(rec) {
    return 'data:' + _vwMime(rec.ext) + ';charset=utf-8,' + encodeURIComponent(rec.content);
  }

  // Public openers indirected through the cache so onclick payloads stay tiny.
  window.vwOpenTextPreview = function (id) {
    var r = _vwResolve(id); if (!r) return;
    vwOpenInPreview(_vwDataUrl(r), r.name, r.ext);
  };
  window.vwOpenTextOutput = function (id) {
    var r = _vwResolve(id); if (!r) return;
    if (typeof window.addOutputArtifact === 'function') {
      var artifact = {
        id: 'vw:' + id,
        title: r.name,
        type: r.ext === 'json' ? 'json' : r.ext === 'html' ? 'html' : 'markdown',
        content: r.content,
        content_type: _vwMime(r.ext),
        _focusInPanel: true,
      };
      window.addOutputArtifact(artifact);
      if (typeof window.showOutputArtifactInPanel === 'function') window.showOutputArtifactInPanel(artifact.id);
      var panel = document.getElementById('outputPanel');
      if (panel && !panel.classList.contains('open') && typeof window.toggleOutputPanel === 'function') window.toggleOutputPanel();
      return;
    }
    vwOpenInOutput(_vwDataUrl(r), r.name, r.ext);
  };
  window.vwOpenTextBrowser = function (id) {
    var r = _vwResolve(id); if (!r) return;
    vwOpenInBrowser(_vwDataUrl(r), r.name, r.ext);
  };
  window.vwCopyText = function (id) {
    var r = _vwResolve(id); if (!r) return;
    var done = function () { vwToast('Copiado: ' + r.name); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(r.content).then(done, done);
    } else {
      var ta = document.createElement('textarea');
      ta.value = r.content;
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (_) {}
      document.body.removeChild(ta);
      done();
    }
  };
  window.vwAttachText = function (id, section) {
    var r = _vwResolve(id); if (!r) return;
    var key = (section || 'vw') + ':' + id;
    if (typeof window.addSharedContextItem === 'function') {
      window.addSharedContextItem({ key: key, section: section || 'vw', title: r.name, inlineText: r.content });
      vwToast('Anexado ao chat: ' + r.name);
    } else if (window._checkedShared && typeof window._checkedShared === 'object') {
      window._checkedShared[(section || 'vw') + ':' + id] = { section: section || 'vw', title: r.name, inlineText: r.content };
      vwToast('Anexado ao chat: ' + r.name);
    } else {
      vwToast('Chat indisponível.');
    }
  };

  function vwToast(msg) {
    var t = document.getElementById('vwToast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'vwToast';
      t.className = 'vw-toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(function () { t.classList.remove('show'); }, 2000);
  }

  /**
   * Build a 5-action pill bar for inline text/markdown content (no URL).
   * Returns HTML and registers the content keyed by an opaque id.
   */
  function vwTextPills(content, name, ext, section) {
    if (!content) return '';
    var id = _vwRegisterText(name, ext, content);
    var sect = JSON.stringify(section || 'vw');
    return [
      '<span class="vw-art-actions">',
        '<button class="btn-xs" type="button" title="Preview" onclick="vwOpenTextPreview(\'' + id + '\')"><i class="fas fa-eye"></i></button>',
        '<button class="btn-xs" type="button" title="Output panel" onclick="vwOpenTextOutput(\'' + id + '\')"><i class="fas fa-columns"></i></button>',
        '<button class="btn-xs" type="button" title="Browser panel" onclick="vwOpenTextBrowser(\'' + id + '\')"><i class="fas fa-globe"></i></button>',
        '<button class="btn-xs" type="button" title="Copiar" onclick="vwCopyText(\'' + id + '\')"><i class="fas fa-copy"></i></button>',
        '<button class="btn-xs" type="button" title="Anexar ao chat" onclick="vwAttachText(\'' + id + '\',' + sect + ')"><i class="fas fa-paperclip"></i></button>',
      '</span>',
    ].join('');
  }

  /** Toggle expanded class on the .vw-art-card ancestor of the toggle button. */
  function vwToggleCard(btn) {
    var card = btn && btn.closest ? btn.closest('.vw-art-card') : null;
    if (!card) return;
    var expanded = card.classList.toggle('expanded');
    btn.textContent = expanded ? 'Ler menos' : 'Ler mais';
  }

  window.vwTextPills = vwTextPills;
  window.vwToggleCard = vwToggleCard;
  window.vwToast = vwToast;

  /* ── Unified article card renderer ───────────────────────────────────
   * Shared by violations and law-library so both render the same fields
   * with the same look (id · framework · norm_type · duty_bearer ·
   * applicability · collapsible full text · 5 hover-pills).
   * ──────────────────────────────────────────────────────────────────── */

  function _vwBadgeClass(prefix, value) {
    var v = String(value || '').toLowerCase().replace(/[^a-z0-9_]+/g, '_');
    return v ? (prefix + ' b-' + v) : prefix;
  }

  function _vwHtmlEsc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /**
   * @param {object} a Article object: { article_id, article_text, duty_bearer,
   *   norm_type, applicability, framework_name?, eli? }
   * @param {object} [opts] { framework, section, defaultExpanded }
   */
  function vwArticleCard(a, opts) {
    a = a || {};
    opts = opts || {};
    var artId = a.article_id || a.id || '';
    var text = String(a.article_text || a.verbatim_text || a.text || '');
    var fwName = opts.framework || a.framework_name || '';
    var dutyBearer = a.duty_bearer || '';
    var normType = a.norm_type || '';
    var applic = a.applicability || '';
    var eli = a.eli || '';

    var badges = [];
    if (normType) badges.push('<span class="' + _vwBadgeClass('vw-art-badge', normType) + '">' + _vwHtmlEsc(normType) + '</span>');
    if (dutyBearer) badges.push('<span class="' + _vwBadgeClass('vw-art-badge', dutyBearer) + '">' + _vwHtmlEsc(dutyBearer) + '</span>');
    if (applic) badges.push('<span class="' + _vwBadgeClass('vw-art-badge', applic) + '">' + _vwHtmlEsc(applic) + '</span>');

    var isLong = text.length > 360;
    var expanded = !!opts.defaultExpanded;

    var md = [
      '# ' + (artId || 'Artigo'),
      '',
      fwName ? '**Framework:** ' + fwName : '',
      dutyBearer ? '**Duty bearer:** ' + dutyBearer : '',
      normType ? '**Norm type:** ' + normType : '',
      applic ? '**Applicability:** ' + applic : '',
      eli ? '**ELI:** ' + eli : '',
      '',
      '## Texto integral',
      '',
      text || '_(sem texto)_',
    ].filter(Boolean).join('\n');

    var safeName = (artId || 'artigo').replace(/[^A-Za-z0-9_.-]/g, '_') + '.md';
    var pills = (typeof window.vwTextPills === 'function')
      ? window.vwTextPills(md, safeName, 'md', opts.section || 'vw')
      : '';

    return [
      '<div class="vw-art-card' + (expanded ? ' expanded' : '') + '">',
        '<div class="vw-art-head">',
          '<div class="vw-art-id">' + _vwHtmlEsc(artId) + (fwName ? ' · ' + _vwHtmlEsc(fwName) : '') + '</div>',
          pills,
        '</div>',
        badges.length ? '<div class="vw-art-badges">' + badges.join('') + '</div>' : '',
        eli ? '<div class="vw-art-meta-row"><span><i class="fas fa-link"></i> ' + _vwHtmlEsc(eli) + '</span></div>' : '',
        '<div class="vw-art-body' + (isLong ? '' : ' no-clip') + '">' + _vwHtmlEsc(text) + '</div>',
        isLong ? '<button class="vw-art-toggle" type="button" onclick="vwToggleCard(this)">' + (expanded ? 'Ler menos' : 'Ler mais') + '</button>' : '',
      '</div>',
    ].join('');
  }

  window.vwArticleCard = vwArticleCard;

  /* ── Branded HTML view + report builder ─────────────────────────────
   * Produces a self-contained HTML document styled with the LA8159
   * brand tokens, then opens it in the browser panel via blob URL.
   * Used by violations ("Abrir HTML") and reports.
   * ─────────────────────────────────────────────────────────────────── */

  function _vwBrandShell(title, bodyHtml) {
    var safeTitle = _vwHtmlEsc(title || 'LA8159 · Violação');
    return [
      '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width,initial-scale=1">',
      '<title>' + safeTitle + '</title>',
      '<link rel="preconnect" href="https://fonts.googleapis.com">',
      '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
      '<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Plus+Jakarta+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">',
      '<style>',
        ':root{--bg:#1a1a1a;--bg-card:#212121;--bg-hi:#2a2a2a;--border:#333;--border-hi:#444;',
              '--white:#faf9f6;--gray-hi:#cfcdc6;--gray:#999;--amber:#c4622d;--amber-lo:rgba(196,98,45,.15);',
              '--green:#2d785a;--red:#a13a2c;--blue:#5b8db8;',
              '--serif:"Fraunces",Georgia,serif;--sans:"Plus Jakarta Sans",system-ui,sans-serif;--mono:"JetBrains Mono",monospace}',
        '*{box-sizing:border-box}',
        'body{margin:0;background:var(--bg);color:var(--gray-hi);font-family:var(--sans);font-size:14px;line-height:1.6;padding:32px 28px 64px}',
        '.aw-doc{max-width:880px;margin:0 auto}',
        '.aw-eyebrow{font-family:var(--mono);font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--amber);margin-bottom:6px}',
        '.aw-h1{font-family:var(--serif);font-size:30px;line-height:1.2;color:var(--white);margin:0 0 8px;font-weight:500}',
        '.aw-h2{font-family:var(--serif);font-size:18px;color:var(--white);margin:24px 0 10px;font-weight:500}',
        '.aw-h3{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--amber);margin:18px 0 8px}',
        '.aw-meta{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 18px;font-size:12px;color:var(--gray)}',
        '.aw-meta .pill{padding:3px 10px;border:1px solid var(--border);border-radius:12px;background:var(--bg-card)}',
        '.aw-meta .pill.sev-critical{border-color:var(--red);color:#e07a6e}',
        '.aw-meta .pill.sev-high{border-color:var(--amber);color:var(--amber)}',
        '.aw-meta .pill.sev-medium{border-color:var(--blue);color:var(--blue)}',
        '.aw-summary{padding:14px 16px;border:1px solid var(--border);border-radius:8px;background:var(--bg-card);white-space:pre-wrap;color:var(--gray-hi)}',
        '.aw-actors{display:flex;flex-wrap:wrap;gap:6px}',
        '.aw-actors .actor{padding:3px 9px;border:1px solid var(--border);border-radius:12px;font-size:12px;background:var(--bg-card)}',
        '.aw-seg{border-left:2px solid var(--amber);padding:8px 12px;margin:6px 0;background:var(--bg-card);border-radius:0 6px 6px 0}',
        '.aw-seg .who{color:var(--white);font-weight:500;margin-right:6px}',
        '.aw-seg .ts{font-family:var(--mono);font-size:11px;color:var(--amber);margin-right:8px}',
        '.aw-fw{margin:14px 0;padding:14px 16px;border:1px solid var(--border);border-radius:8px;background:var(--bg-card)}',
        '.aw-fw-name{font-weight:600;color:var(--white);margin-bottom:8px}',
        '.aw-art{padding:10px 12px;border:1px solid var(--border);border-radius:6px;margin:8px 0;background:var(--bg)}',
        '.aw-art-id{font-family:var(--mono);font-size:11px;color:var(--amber);margin-bottom:4px}',
        '.aw-art-badges{display:flex;flex-wrap:wrap;gap:4px;margin:4px 0 6px}',
        '.aw-art-badges span{font-size:10px;letter-spacing:.05em;text-transform:uppercase;padding:2px 7px;border:1px solid var(--border-hi);border-radius:10px;color:var(--gray-hi)}',
        '.aw-art-text{font-size:13px;line-height:1.6;color:var(--gray-hi);white-space:pre-wrap}',
        'a{color:var(--amber)}a:hover{color:var(--white)}',
        'pre{font-family:var(--mono);font-size:12px;background:var(--bg-card);border:1px solid var(--border);border-radius:6px;padding:12px;overflow:auto;white-space:pre-wrap;word-break:break-word}',
      '</style></head><body><article class="aw-doc">',
      bodyHtml,
      '</article></body></html>',
    ].join('');
  }

  function _vwSeverityClass(sev) {
    var s = String(sev || '').toLowerCase();
    if (s.indexOf('critical') !== -1 || s.indexOf('crítica') !== -1) return 'sev-critical';
    if (s.indexOf('high') !== -1 || s.indexOf('alta') !== -1) return 'sev-high';
    if (s.indexOf('medium') !== -1 || s.indexOf('média') !== -1) return 'sev-medium';
    return '';
  }

  function vwBuildViolationBrandedHtml(v) {
    v = v || {};

    // Normalize to the expanded schema (with fallbacks to the legacy shape).
    var allegation = v.allegation_summary || (v.facts && v.facts.summary) || '';
    var primaryAgents = v.primary_agents || [];
    var supportingAgents = v.supporting_agents || (v.facts && v.facts.actors) || [];
    var segments = v.key_admissions || (v.facts && v.facts.segments) || [];

    // Normalize legal basis: array of articles OR { frameworks:[{articles}] }.
    var articles = [];
    if (Array.isArray(v.legal_basis)) {
      articles = v.legal_basis;
    } else if (v.legal_basis && Array.isArray(v.legal_basis.frameworks)) {
      v.legal_basis.frameworks.forEach(function (fw) {
        (fw.articles || []).forEach(function (a) { articles.push(a); });
      });
    }

    var inc = v.incident || {};
    var incLine = (v.incident_timestamp_display || v.incident_date ||
      [inc.location, inc.flight, inc.date].filter(Boolean).join(' · '));

    var sevCls = _vwSeverityClass(v.severity);
    var meta = [];
    if (v.severity) meta.push('<span class="pill ' + sevCls + '">' + _vwHtmlEsc(v.severity) + '</span>');
    if (v.status) meta.push('<span class="pill">' + _vwHtmlEsc(v.status) + '</span>');
    if (v.jurisdiction) meta.push('<span class="pill">' + _vwHtmlEsc(v.jurisdiction) + '</span>');

    var allActors = primaryAgents.concat(supportingAgents);
    function _awActorLabel(a) {
      if (typeof a === 'string') return a;
      if (a && typeof a === 'object') return a.name || a.id || a.label || (a.role ? '(' + a.role + ')' : '') || '';
      return String(a == null ? '' : a);
    }
    var actorsHtml = allActors.length
      ? allActors.map(function (a) { return '<span class="actor">' + _vwHtmlEsc(_awActorLabel(a)) + '</span>'; }).join('')
      : '<span style="color:var(--gray);font-size:12px">Sem atores listados.</span>';

    var segHtml = segments.length
      ? segments.map(function (s) {
          var who = s.speaker ? '<span class="who">' + _vwHtmlEsc(s.speaker) + ':</span>' : '';
          var ts = s.timestamp ? '<span class="ts">' + _vwHtmlEsc(s.timestamp) + '</span>' : '';
          return '<div class="aw-seg">' + ts + who + _vwHtmlEsc(s.text || s.content || '') + '</div>';
        }).join('')
      : '<div style="color:var(--gray);font-size:12px">Sem segmentos.</div>';

    var fwHtml = articles.length
      ? articles.map(function (a) {
          var badges = [];
          if (a.norm_type) badges.push('<span>' + _vwHtmlEsc(a.norm_type) + '</span>');
          if (a.duty_bearer) badges.push('<span>' + _vwHtmlEsc(a.duty_bearer) + '</span>');
          if (a.applicability) badges.push('<span>' + _vwHtmlEsc(a.applicability) + '</span>');
          return [
            '<div class="aw-art">',
              '<div class="aw-art-id">' + _vwHtmlEsc(a.article_id || '') + '</div>',
              badges.length ? '<div class="aw-art-badges">' + badges.join('') + '</div>' : '',
              a.eli ? '<div style="font-size:11px;color:var(--gray);margin-bottom:6px">' + _vwHtmlEsc(a.eli) + '</div>' : '',
              '<div class="aw-art-text">' + _vwHtmlEsc(a.verbatim_text || a.article_text || '') + '</div>',
            '</div>',
          ].join('');
        }).join('')
      : '<div style="color:var(--gray);font-size:12px">Sem frameworks vinculados.</div>';

    var parts = [
      '<div class="aw-eyebrow">' + _vwHtmlEsc(v.violation_id || '') + (v.jurisdiction ? ' · ' + _vwHtmlEsc(v.jurisdiction) : '') + '</div>',
      '<h1 class="aw-h1">' + _vwHtmlEsc(v.title || 'Violação') + '</h1>',
      meta.length ? '<div class="aw-meta">' + meta.join('') + '</div>' : '',
      incLine ? '<div style="font-family:var(--mono);font-size:11px;color:var(--gray);margin-bottom:18px">📍 ' + _vwHtmlEsc(incLine) + '</div>' : '',
      allegation ? '<div class="aw-summary">' + _vwHtmlEsc(allegation) + '</div>' : '',
      v.legal_theory ? '<h3 class="aw-h3">Teoria Jurídica</h3><div class="aw-summary">' + _vwHtmlEsc(v.legal_theory) + '</div>' : '',
      '<h3 class="aw-h3">Atores</h3><div class="aw-actors">' + actorsHtml + '</div>',
      '<h3 class="aw-h3">Segmentos do transcript</h3>' + segHtml,
      '<h2 class="aw-h2">Base Legal</h2>' + fwHtml,
    ];

    // Probative chain
    if (v.probative_chain) {
      parts.push('<h3 class="aw-h3">Cadeia Probatória</h3><pre class="aw-pre">' + _vwHtmlEsc(v.probative_chain) + '</pre>');
    }
    // Nexus matrix highlights
    if (v.nexus_matrix && v.nexus_matrix.highest_strength_connections) {
      var nx = v.nexus_matrix.highest_strength_connections.map(function (c) {
        return '<li><code>' + _vwHtmlEsc(c.from || '') + '</code> → <strong>' + _vwHtmlEsc(c.to_element || '') + '</strong>' +
          (c.detail ? ' — ' + _vwHtmlEsc(c.detail) : '') + '</li>';
      }).join('');
      parts.push('<h3 class="aw-h3">Nexus Matrix (topo)</h3><ul class="aw-list">' + nx + '</ul>');
    }
    // Authorities
    if (Array.isArray(v.authorities) && v.authorities.length) {
      var ax = v.authorities.map(function (a) {
        return '<li><code>' + _vwHtmlEsc(a.id || '') + '</code> <span class="aw-tag">' + _vwHtmlEsc(a.type || '') + '</span>' +
          (a.research_query ? ' — ' + _vwHtmlEsc(a.research_query) : '') + '</li>';
      }).join('');
      parts.push('<h3 class="aw-h3">Authorities</h3><ul class="aw-list">' + ax + '</ul>');
    }
    // Open questions
    if (Array.isArray(v.open_questions) && v.open_questions.length) {
      var ox = v.open_questions.map(function (o) {
        return '<li><span class="aw-tag">' + _vwHtmlEsc(o.priority || '') + '</span> <strong>' + _vwHtmlEsc(o.id || '') +
          '</strong> — ' + _vwHtmlEsc(o.question || '') + '</li>';
      }).join('');
      parts.push('<h3 class="aw-h3">Open Questions</h3><ul class="aw-list">' + ox + '</ul>');
    }
    // Cross-references
    if (Array.isArray(v.cross_references) && v.cross_references.length) {
      parts.push('<h3 class="aw-h3">Cross-References</h3><div class="aw-actors">' +
        v.cross_references.map(function (id) { return '<span class="actor">' + _vwHtmlEsc(String(id).toUpperCase()) + '</span>'; }).join('') +
        '</div>');
    }

    var body = parts.join('');
    return _vwBrandShell((v.title || 'Violação') + ' · LA8159', body);
  }

  function vwBuildReportBrandedHtml(text, title) {
    var safeTxt = _vwHtmlEsc(String(text || ''));
    var body = [
      '<div class="aw-eyebrow">Relatório</div>',
      '<h1 class="aw-h1">' + _vwHtmlEsc(title || 'Relatório') + '</h1>',
      '<pre>' + safeTxt + '</pre>',
    ].join('');
    return _vwBrandShell(title || 'Relatório', body);
  }

  // Track blob URLs created for branded views so they can be revoked.
  var _vwBrandedBlobs = [];
  function vwOpenBrandedHtml(html, name) {
    if (!html) return;
    try {
      var blob = new Blob([String(html)], { type: 'text/html' });
      var url = URL.createObjectURL(blob);
      _vwBrandedBlobs.push(url);
      // Keep last 8 blobs alive (download/maximize use them); revoke older ones.
      while (_vwBrandedBlobs.length > 8) {
        var old = _vwBrandedBlobs.shift();
        try { URL.revokeObjectURL(old); } catch (_) {}
      }
      vwOpenInBrowser(url, name || 'view.html', 'html');
    } catch (e) {
      // Fallback to data URL when Blob is unavailable.
      var dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(String(html));
      vwOpenInBrowser(dataUrl, name || 'view.html', 'html');
    }
  }

  window.vwBuildViolationBrandedHtml = vwBuildViolationBrandedHtml;
  window.vwBuildReportBrandedHtml = vwBuildReportBrandedHtml;
  window.vwOpenBrandedHtml = vwOpenBrandedHtml;

  /* ── Source-URL hover → open in browser panel ───────────────────────
   * Hovering an external link inside any section viewer (or rendered
   * markdown body) for >280ms loads the URL into the browser panel
   * without stealing focus. Click still works normally.
   * ─────────────────────────────────────────────────────────────────── */
  var _vwHoverTimer = null;
  var _vwHoverLastUrl = '';
  var HOVER_TARGET_SELECTOR = [
    '.vw-viewer a[href^="http"]',
    '.olivia-doc-rich-body a[href^="http"]',
    '.docx-viewer a[href^="http"]',
    '.aw-doc a[href^="http"]',
    '.answer-md a[href^="http"]',
  ].join(',');

  document.addEventListener('mouseover', function (ev) {
    var t = ev.target;
    if (!t || t.nodeType !== 1) return;
    var a = t.closest && t.closest('a[href]');
    if (!a) return;
    if (!a.matches || !a.matches(HOVER_TARGET_SELECTOR)) return;
    var href = a.getAttribute('href') || '';
    if (!/^https?:\/\//i.test(href)) return;
    if (_vwHoverTimer) clearTimeout(_vwHoverTimer);
    _vwHoverTimer = setTimeout(function () {
      if (_vwHoverLastUrl === href) return;
      _vwHoverLastUrl = href;
      try { vwOpenInBrowser(href, a.textContent || href, 'html'); } catch (_e) {}
    }, 280);
  }, true);
  document.addEventListener('mouseout', function (ev) {
    var a = ev.target && ev.target.closest && ev.target.closest('a[href]');
    if (!a) return;
    if (_vwHoverTimer) { clearTimeout(_vwHoverTimer); _vwHoverTimer = null; }
  }, true);
})();
