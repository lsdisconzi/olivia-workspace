/* ═══════════════════════════════════════════════════════════════════
   LAW LIBRARY MODULE — Statute / framework Markdown sources (LA8159)
   Patterned after spaces.js: registry-driven sidebar tree, viewer,
   metadata badge, search/filter, and context-bar attach for chat.
   ═══════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var LL_JURISDICTIONS = [
    { id: 'BR', label: 'Guarulhos · Brasil', icon: 'fas fa-flag' },
    { id: 'CL', label: 'Santiago · Chile', icon: 'fas fa-flag' },
    { id: 'INT', label: 'Tratados internacionais', icon: 'fas fa-globe-americas' },
  ];

  var _ll = {
    initialized: false,
    available: false,
    index: null,
    activeJur: null,
    activePath: null,
    activeText: '',
    activeMeta: null,
    filterJur: 'all',
    searchQuery: '',
    view: 'welcome',          // welcome | source
    attached: {},
  };

  function _llById(id) { return document.getElementById(id); }

  function _llSetStatus(message, tone) {
    var el = _llById('lawLibStatus');
    if (!el) return;
    el.textContent = String(message || '');
    var color = 'var(--gray)';
    if (tone === 'error') color = 'var(--red)';
    else if (tone === 'ok') color = 'var(--green, #5aa469)';
    else if (tone === 'warn') color = 'var(--amber)';
    el.style.color = color;
  }

  function _llMatchesFilter(entry, jur) {
    if (_ll.filterJur !== 'all' && jur !== _ll.filterJur) return false;
    if (_ll.searchQuery) {
      var q = _ll.searchQuery.toLowerCase();
      var hay = [entry.id, entry.filename, entry.title, entry.preview]
        .map(function (s) { return String(s || '').toLowerCase(); })
        .join(' ');
      if (hay.indexOf(q) === -1) return false;
    }
    return true;
  }

  /* ── Parse the metadata frontmatter table at the top of each .md ── */
  function _llParseMeta(text) {
    var meta = {};
    if (!text) return meta;
    var lines = String(text).split(/\r?\n/);
    var inTable = false;
    for (var i = 0; i < Math.min(lines.length, 60); i++) {
      var line = lines[i].trim();
      if (!line) continue;
      if (line.startsWith('|')) {
        if (line.indexOf('---') !== -1) { inTable = true; continue; }
        if (inTable || /^\|\s*[A-Za-z]/.test(line)) {
          var parts = line.split('|').map(function (s) { return s.trim(); }).filter(Boolean);
          if (parts.length >= 2) {
            var key = parts[0].toLowerCase().replace(/\s+/g, '_');
            meta[key] = parts.slice(1).join(' | ');
          }
        }
      } else if (inTable) {
        break;
      }
    }
    return meta;
  }

  /* ── INIT ── */
  async function lawLibInit() {
    if (_ll.initialized) {
      _llRender();
      return;
    }
    _ll.initialized = true;
    _llSetStatus('Carregando biblioteca…', 'muted');
    try {
      var base = (typeof API_BASE !== 'undefined' && API_BASE) ? API_BASE : '';
      var res = await fetch(base + '/api/law-library/index');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var data = await res.json();
      if (data.error) throw new Error(data.error);
      _ll.index = data;
      if (data.available === false || data.status === 'unavailable') {
        _ll.available = false;
        _llSetStatus('Biblioteca legal indisponível neste runtime.', 'warn');
        _llRender();
        return;
      }
      _ll.available = true;
      _llSetStatus('Pronto — ' + _llTotalCount() + ' fontes.', 'ok');
    } catch (err) {
      _ll.available = false;
      _llSetStatus('Falha ao carregar: ' + (err && err.message ? err.message : err), 'error');
    }
    _llRender();
  }

  function _llTotalCount() {
    if (!_ll.index || !_ll.index.jurisdictions) return 0;
    var n = 0;
    Object.keys(_ll.index.jurisdictions).forEach(function (k) {
      n += (_ll.index.jurisdictions[k] || []).length;
    });
    return n;
  }

  /* ── RENDER ── */
  function _llRender() {
    _llRenderTree();
    _llRenderViewer();
    _llUpdateContextBar();
  }

  function _llRenderTree() {
    var tree = _llById('lawLibTree');
    if (!tree) return;
    if (!_ll.available || !_ll.index) {
      tree.innerHTML = '<div style="padding:12px;color:var(--gray);font-size:11px">Sem dados disponíveis.</div>';
      return;
    }
    var html = [];
    var totalShown = 0;
    LL_JURISDICTIONS.forEach(function (j) {
      var entries = (_ll.index.jurisdictions[j.id] || []).filter(function (e) {
        return _llMatchesFilter(e, j.id);
      });
      if (!entries.length) return;
      totalShown += entries.length;
      html.push(
        '<div class="ll-jur-section" style="margin-bottom:8px">',
        '<div style="font-size:10px;letter-spacing:.12em;color:var(--amber);text-transform:uppercase;padding:6px 8px">',
        '<i class="' + j.icon + '"></i> ' + escapeHtml(j.label) + ' <span style="color:var(--gray)">· ' + entries.length + '</span>',
        '</div>'
      );
      entries.forEach(function (entry) {
        var active = (_ll.activePath === entry.path) ? ' active' : '';
        html.push(
          '<div class="ll-item' + active + '" onclick="lawLibSelect(\'' + escapeHtml(j.id) + '\',\'' + escapeHtml(entry.path) + '\')" ',
          'style="padding:8px 10px;border-radius:6px;cursor:pointer;margin:2px 4px;border:1px solid transparent;' + (active ? 'background:var(--bg-hi);border-color:var(--amber)' : '') + '">',
          '<div style="font-size:12px;color:var(--gray-hi);font-weight:600;line-height:1.3">' + escapeHtml(entry.id) + '</div>',
          '<div style="font-size:11px;color:var(--gray);line-height:1.4;margin-top:3px">' + escapeHtml(String(entry.title || '').slice(0, 110)) + '</div>',
          '</div>'
        );
      });
      html.push('</div>');
    });
    if (!totalShown) html.push('<div style="padding:12px;color:var(--gray);font-size:11px">Nenhum resultado.</div>');
    tree.innerHTML = html.join('');
  }

  function _llRenderViewer() {
    var viewer = _llById('lawLibViewer');
    if (!viewer) return;
    if (_ll.view === 'source') {
      viewer.innerHTML = _llSourceHtml();
      return;
    }
    viewer.innerHTML = _llWelcomeHtml();
  }

  function _llWelcomeHtml() {
    var counts = {};
    if (_ll.index && _ll.index.jurisdictions) {
      Object.keys(_ll.index.jurisdictions).forEach(function (k) {
        counts[k] = (_ll.index.jurisdictions[k] || []).length;
      });
    }
    function pill(label, value) {
      return '<span style="display:inline-block;padding:4px 10px;border:1px solid var(--border);border-radius:12px;font-size:11px;color:var(--gray-hi);background:var(--bg);margin:2px 4px">'
        + escapeHtml(label) + ' <strong style="color:var(--amber)">' + escapeHtml(String(value)) + '</strong></span>';
    }
    var pills = LL_JURISDICTIONS.map(function (j) { return pill(j.label, counts[j.id] || 0); }).join('');
    return [
      '<div style="padding:24px;max-width:780px">',
      '<h2 style="margin:0 0 8px;color:var(--gray-hi)"><i class="fas fa-book-bookmark"></i> Biblioteca Legal</h2>',
      '<div style="color:var(--gray);font-size:13px;margin-bottom:16px">Códigos, leis, regulamentos e tratados utilizados como fonte para as violações do incidente OliviaLegal.</div>',
      '<div style="margin-bottom:18px">' + pills + '</div>',
      '<div style="margin-top:16px;padding:14px;border:1px dashed var(--border);border-radius:8px;color:var(--gray);font-size:12px">',
      'Selecione uma fonte na barra lateral para ver metadados (ELI, SHA-256, framework) e o texto integral dos artigos.',
      '</div>',
      '</div>',
    ].join('');
  }

  function _llSourceHtml() {
    var meta = _ll.activeMeta || {};
    var text = _ll.activeText || '';
    // Render metadata rows; turn URL-shaped values into hover-aware links.
    var metaRows = Object.keys(meta).map(function (k) {
      var raw = String(meta[k] == null ? '' : meta[k]);
      var valueHtml;
      var keyLower = String(k).toLowerCase();
      var looksLikeUrl = /^https?:\/\//i.test(raw)
        || keyLower === 'source_url'
        || keyLower === 'url'
        || keyLower === 'eli';
      if (looksLikeUrl && /^https?:\/\//i.test(raw)) {
        valueHtml = '<a href="' + escapeHtml(raw) + '" target="_blank" rel="noopener" style="color:var(--amber);word-break:break-all">' + escapeHtml(raw) + '</a>';
      } else {
        valueHtml = '<span style="color:var(--gray-hi);word-break:break-word">' + escapeHtml(raw) + '</span>';
      }
      return '<div style="display:flex;gap:8px;font-size:11px;line-height:1.5">'
        + '<span style="color:var(--amber);min-width:120px;text-transform:uppercase;letter-spacing:.06em">' + escapeHtml(k.replace(/_/g, ' ')) + '</span>'
        + valueHtml
        + '</div>';
    }).join('');

    // Render the source text as markdown when marked@9 is loaded; fall back
    // to a wrapped pre block. Using .answer-md picks up brand styles for
    // headings, lists, blockquotes and code already defined elsewhere.
    var bodyHtml;
    if (window.marked && typeof marked.parse === 'function' && text) {
      try {
        bodyHtml = '<div class="answer-md" style="font-size:13px;line-height:1.7;color:var(--gray-hi);background:var(--bg);padding:18px 20px;border:1px solid var(--border);border-radius:8px">'
          + marked.parse(text)
          + '</div>';
      } catch (_) {
        bodyHtml = '<pre style="white-space:pre-wrap;font-size:12px;line-height:1.6;color:var(--gray-hi);background:var(--bg);padding:14px;border:1px solid var(--border);border-radius:8px">' + escapeHtml(text) + '</pre>';
      }
    } else {
      bodyHtml = '<pre style="white-space:pre-wrap;font-size:12px;line-height:1.6;color:var(--gray-hi);background:var(--bg);padding:14px;border:1px solid var(--border);border-radius:8px">' + escapeHtml(text) + '</pre>';
    }

    return [
      '<div style="padding:24px;max-width:980px">',
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:14px">',
      '<div style="min-width:0">',
      '<div style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--amber)">' + escapeHtml(_ll.activePath || '') + '</div>',
      '<h2 style="margin:4px 0 0;color:var(--gray-hi);line-height:1.25">' + escapeHtml(meta.framework_name || meta.framework_code || _ll.activePath || '') + '</h2>',
      '</div>',
      '<div style="display:flex;gap:6px;flex-shrink:0;align-items:center">',
      (function () {
        var p = _ll.activePath || '';
        if (!p || typeof window.vwFilePills !== 'function') return '';
        var url = ((typeof API_BASE !== 'undefined' && API_BASE) ? API_BASE : '') + '/api/law-library/file?path=' + encodeURIComponent(p);
        return window.vwFilePills(url, p, 'text');
      })(),
      '<button class="btn-link" onclick="lawLibShowWelcome()"><i class="fas fa-arrow-left"></i> Voltar</button>',
      '<button class="btn-secondary" onclick="lawLibAttachActive()"><i class="fas fa-paperclip"></i> Anexar ao chat</button>',
      '</div>',
      '</div>',
      metaRows ? (
        '<div style="margin-bottom:18px;padding:12px 14px;border:1px solid var(--border);border-radius:8px;background:var(--bg)">' + metaRows + '</div>'
      ) : '',
      bodyHtml,
      '</div>',
    ].join('');
  }

  /* ── ACTIONS ── */
  window.lawLibInit = lawLibInit;

  window.lawLibRefresh = function () {
    _ll.initialized = false;
    lawLibInit();
  };

  window.lawLibFilterJur = function (jur) {
    _ll.filterJur = jur || 'all';
    _llRenderTree();
  };

  window.lawLibSearch = function (input) {
    _ll.searchQuery = String(input && input.value !== undefined ? input.value : input || '').trim();
    _llRenderTree();
  };

  window.lawLibShowWelcome = function () {
    _ll.view = 'welcome';
    _ll.activePath = null;
    _llRender();
  };

  window.lawLibSelect = async function (jur, path) {
    _ll.activeJur = jur;
    _ll.activePath = path;
    _ll.view = 'source';
    _ll.activeText = 'Carregando…';
    _ll.activeMeta = null;
    _llSetStatus('Abrindo ' + path + '…', 'muted');
    _llRender();
    try {
      var base = (typeof API_BASE !== 'undefined' && API_BASE) ? API_BASE : '';
      var res = await fetch(base + '/api/law-library/file?path=' + encodeURIComponent(path));
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var data = await res.json();
      if (data.error) throw new Error(data.error);
      _ll.activeText = data.content || '';
      _ll.activeMeta = _llParseMeta(_ll.activeText);
      _llSetStatus('Pronto.', 'ok');
    } catch (err) {
      _ll.activeText = 'Falha: ' + (err && err.message ? err.message : err);
      _llSetStatus('Falha: ' + (err && err.message ? err.message : err), 'error');
    }
    _llRenderViewer();
  };

  window.lawLibAttachActive = function () {
    if (!_ll.activeText || !_ll.activePath) return;
    var key = 'source:' + _ll.activePath;
    var name = _ll.activePath.split('/').pop() || _ll.activePath;
    _ll.attached[key] = { name: name, length: _ll.activeText.length };
    if (typeof window.addSharedContextItem === 'function') {
      window.addSharedContextItem({
        key: 'lawlib:' + key,
        section: 'lawlib',
        title: name,
        inlineText: _ll.activeText,
      });
    } else if (typeof window._checkedShared === 'object' && window._checkedShared) {
      window._checkedShared['lawlib:' + key] = { section: 'lawlib', title: name, inlineText: _ll.activeText };
      if (typeof window.updateSharedContextBar === 'function') window.updateSharedContextBar();
    }
    _llUpdateContextBar();
    _llSetStatus('Anexado: ' + name, 'ok');
  };

  function _llUpdateContextBar() {
    var bar = _llById('lawLibContextBar');
    var num = _llById('lawLibContextNum');
    var count = Object.keys(_ll.attached).length;
    if (num) num.textContent = String(count);
    if (bar) bar.classList.toggle('empty', count === 0);
  }

  window.lawLibClearContext = function () {
    Object.keys(_ll.attached).forEach(function (k) {
      if (window._checkedShared) delete window._checkedShared['lawlib:' + k];
    });
    _ll.attached = {};
    if (typeof window.updateSharedContextBar === 'function') window.updateSharedContextBar();
    _llUpdateContextBar();
  };

  window.clearLawLibContextState = window.lawLibClearContext;

  /* ── MAIN-VIEW SHOW / HIDE ── */
  window.lawLibShowView = function () {
    var hide = ['chatHeader', 'welcomeState', 'chatLog', 'chatCompose', 'chatToolbar'];
    hide.forEach(function (id) { var el = document.getElementById(id); if (el) el.style.display = 'none'; });
    var mc = document.querySelector('.main-content');
    if (mc) { mc._vwDisplay = mc.style.display; mc.style.display = 'none'; }
    ['spacesView', 'listeningView', 'studioView', 'descobertaView', 'memoryView', 'shadersView', 'aexMainView', 'violationsView', 'legalRouterView'].forEach(function (vid) {
      var v = document.getElementById(vid); if (v) v.classList.remove('active');
    });
    if (typeof window.aexHideMain === 'function') window.aexHideMain();
    if (typeof window.violationsHideView === 'function') window.violationsHideView();
    if (typeof window.legalRouterHideView === 'function') window.legalRouterHideView();
    if (typeof window.spacesHideView === 'function') window.spacesHideView();
    var sv = document.getElementById('lawLibView');
    if (sv) sv.classList.add('active');
    if (typeof window.vwInitResize === 'function') window.vwInitResize('lawLibResize', 'lawLibSidebar');
    if (typeof window.vwInitEdgeResize === 'function') window.vwInitEdgeResize('lawLibEdgeResize', 'lawLibView');
    if (typeof lawLibInit === 'function') lawLibInit();
    if (typeof window.oliviaRefreshSectionRuntimeUi === 'function') { try { window.oliviaRefreshSectionRuntimeUi(); } catch (_e) { } }
  };

  window.lawLibHideView = function () {
    var sv = document.getElementById('lawLibView');
    if (sv) { sv.classList.remove('active'); sv.style.flex = ''; sv.style.maxWidth = ''; }
    var mc = document.querySelector('.main-content');
    if (mc) { mc.style.display = mc._vwDisplay !== undefined ? mc._vwDisplay : ''; delete mc._vwDisplay; }
    var show = ['chatHeader', 'welcomeState', 'chatLog', 'chatCompose', 'chatToolbar'];
    show.forEach(function (id) { var el = document.getElementById(id); if (el) el.style.display = ''; });
  };
})();
