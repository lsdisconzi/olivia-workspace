/* ═══════════════════════════════════════════════════════════════════
   LAW LIBRARY MODULE — Statute / framework Markdown sources
   Refactored: full-width view, safe string coercion, semantic CSS
   ═══════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var LL_JURISDICTIONS = [
    { id: 'BR', label: 'Guarulhos · Brasil', icon: 'fas fa-flag' },
    { id: 'CL', label: 'Santiago · Chile', icon: 'fas fa-flag' },
    { id: 'INT', label: 'Tratados internacionais', icon: 'fas fa-globe-americas' }
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
    view: 'welcome',
    attached: {}
  };

  var _llDisplayStash = {};

  function $ll(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function _llText(value, fallback) {
    if (value == null) return fallback == null ? '' : fallback;
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);

    try {
      var json = JSON.stringify(value);
      return json === undefined ? String(value) : json;
    } catch (_) {
      return String(value);
    }
  }

  function _llSetStatus(message, tone) {
    var el = $ll('lawLibStatus');
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
      var hay = [
        _llText(entry.id, ''),
        _llText(entry.filename, ''),
        _llText(entry.title, ''),
        _llText(entry.preview, '')
      ].join(' ').toLowerCase();

      if (hay.indexOf(q) === -1) return false;
    }

    return true;
  }

  /* ── Metadata parsing ─────────────────────────────────────────── */
  function _llParseMeta(text) {
    var meta = {};
    if (!text) return meta;

    var lines = String(text).split(/\r?\n/);

    // YAML frontmatter: --- key: value ---
    if (lines[0] && lines[0].trim() === '---') {
      for (var i = 1; i < lines.length; i++) {
        var yamlLine = lines[i].trim();
        if (yamlLine === '---') break;

        var idx = yamlLine.indexOf(':');
        if (idx > 0) {
          var key = yamlLine.slice(0, idx).trim().toLowerCase().replace(/\s+/g, '_');
          var value = yamlLine.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
          meta[key] = value;
        }
      }
      return meta;
    }

    // Markdown table frontmatter
    var inTable = false;
    for (var j = 0; j < Math.min(lines.length, 60); j++) {
      var line = lines[j].trim();
      if (!line) continue;

      if (line.startsWith('|')) {
        if (line.indexOf('---') !== -1) {
          inTable = true;
          continue;
        }

        if (inTable || /^\|\s*[A-Za-z]/.test(line)) {
          var parts = line.split('|').map(function (s) { return s.trim(); }).filter(Boolean);

          if (parts.length >= 2) {
            var tableKey = parts[0].toLowerCase().replace(/\s+/g, '_');
            var tableValue = parts.slice(1).join(' | ');

            if (meta[tableKey]) meta[tableKey] += ' | ' + tableValue;
            else meta[tableKey] = tableValue;
          }
        }
      } else if (inTable) {
        break;
      }
    }

    return meta;
  }

  /* ── INIT ─────────────────────────────────────────────────────── */
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

  /* ── RENDER ───────────────────────────────────────────────────── */
  function _llRender() {
    _llRenderTree();
    _llRenderViewer();
    _llUpdateContextBar();
  }

  function _llRenderTree() {
    var tree = $ll('lawLibTree');
    if (!tree) return;

    if (!_ll.available || !_ll.index) {
      tree.innerHTML = '<div class="ll-empty">Sem dados disponíveis.</div>';
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

      html.push('<div class="ll-jur-section">');
      html.push(
        '<div class="ll-jur-label"><i class="' + escapeHtml(j.icon) + '"></i> ' +
        escapeHtml(j.label) +
        ' <span class="ll-count">' + entries.length + '</span></div>'
      );

      entries.forEach(function (entry) {
        var active = (_ll.activePath === entry.path) ? ' active' : '';
        var title = _llText(entry.title, entry.id);

        html.push(
          '<button type="button" class="ll-item' + active + '" data-jur="' + escapeHtml(j.id) + '" data-path="' + escapeHtml(entry.path) + '">',
          '<span class="ll-item-id">' + escapeHtml(_llText(entry.id, entry.path)) + '</span>',
          '<span class="ll-item-title">' + escapeHtml(title) + '</span>',
          '</button>'
        );
      });

      html.push('</div>');
    });

    if (!totalShown) html.push('<div class="ll-empty">Nenhum resultado.</div>');

    tree.innerHTML = html.join('');

    tree.onclick = function (ev) {
      var node = ev.target;
      while (node && node !== tree && !(node.classList && node.classList.contains('ll-item'))) {
        node = node.parentElement;
      }

      if (!node || node === tree) return;

      var jur = node.getAttribute('data-jur');
      var path = node.getAttribute('data-path');
      if (jur && path) window.lawLibSelect(jur, path);
    };
  }

  function _llRenderViewer() {
    var viewer = $ll('lawLibViewer');
    if (!viewer) return;

    viewer.innerHTML = (_ll.view === 'source') ? _llSourceHtml() : _llWelcomeHtml();
  }

  function _llWelcomeHtml() {
    var counts = {};

    if (_ll.index && _ll.index.jurisdictions) {
      Object.keys(_ll.index.jurisdictions).forEach(function (k) {
        counts[k] = (_ll.index.jurisdictions[k] || []).length;
      });
    }

    function pill(label, value) {
      return '<span class="ll-pill">' + escapeHtml(label) + ' <strong>' + escapeHtml(value) + '</strong></span>';
    }

    var pills = LL_JURISDICTIONS.map(function (j) {
      return pill(j.label, counts[j.id] || 0);
    }).join('');

    return [
      '<div class="ll-welcome">',
      '<h2><i class="fas fa-book-bookmark"></i> Biblioteca Legal</h2>',
      '<div class="ll-welcome-sub">Códigos, leis, regulamentos e tratados utilizados como fonte para as violações do incidente OliviaLegal.</div>',
      '<div class="ll-pills">' + pills + '</div>',
      '<div class="ll-hint">Selecione uma fonte na barra lateral para ver metadados (ELI, SHA-256, framework) e o texto integral dos artigos.</div>',
      '</div>'
    ].join('');
  }

  function _llSourceHtml() {
    var meta = _ll.activeMeta || {};
    var text = _ll.activeText || '';
    var pathLabel = _llText(_ll.activePath, 'Fonte');
    var title = _llText(meta.framework_name || meta.framework_code, _ll.activePath || 'Fonte legal');

    var metaRows = Object.keys(meta).map(function (k) {
      var raw = _llText(meta[k], '');
      var valueHtml;
      var keyLower = String(k).toLowerCase();
      var looksLikeUrl = /^https?:\/\//i.test(raw) ||
        keyLower === 'source_url' ||
        keyLower === 'url' ||
        keyLower === 'eli';

      if (looksLikeUrl && /^https?:\/\//i.test(raw)) {
        valueHtml = '<a class="ll-meta-link" href="' + escapeHtml(raw) + '" target="_blank" rel="noopener">' + escapeHtml(raw) + '</a>';
      } else {
        valueHtml = '<span class="ll-meta-value">' + escapeHtml(raw) + '</span>';
      }

      return '<div class="ll-meta-row">' +
        '<span class="ll-meta-key">' + escapeHtml(k.replace(/_/g, ' ')) + '</span>' +
        valueHtml +
        '</div>';
    }).join('');

    var bodyHtml;
    if (window.marked && typeof marked.parse === 'function' && text) {
      try {
        bodyHtml = '<div class="ll-body answer-md">' + marked.parse(text) + '</div>';
      } catch (_) {
        bodyHtml = '<pre class="ll-pre">' + escapeHtml(text) + '</pre>';
      }
    } else {
      bodyHtml = '<pre class="ll-pre">' + escapeHtml(text) + '</pre>';
    }

    var filePill = '';
    var p = _ll.activePath;
    if (p && typeof window.vwFilePills === 'function') {
      var url = ((typeof API_BASE !== 'undefined' && API_BASE) ? API_BASE : '') +
        '/api/law-library/file?path=' + encodeURIComponent(p);

      filePill = _llText(window.vwFilePills(url, p, 'text'), '');
    }

    return [
      '<div class="ll-source">',
      '<div class="ll-source-header">',
      '<div class="ll-source-title-box">',
      '<div class="ll-path">' + escapeHtml(pathLabel) + '</div>',
      '<h2 class="ll-source-title">' + escapeHtml(title) + '</h2>',
      '</div>',
      '<div class="ll-actions">',
      filePill,
      '<button type="button" class="ll-btn ll-btn-ghost" onclick="lawLibShowWelcome()"><i class="fas fa-arrow-left"></i> Voltar</button>',
      '<button type="button" class="ll-btn ll-btn-primary" onclick="lawLibAttachActive()"><i class="fas fa-paperclip"></i> Anexar ao chat</button>',
      '</div>',
      '</div>',
      metaRows ? '<div class="ll-meta-card">' + metaRows + '</div>' : '',
      bodyHtml,
      '</div>'
    ].join('');
  }

  /* ── ACTIONS ──────────────────────────────────────────────────── */
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
    _ll.activeMeta = null;
    _ll.activeText = '';
    _llRender();
  };

  window.lawLibSelect = async function (jur, path) {
    _ll.activeJur = _llText(jur, '');
    _ll.activePath = _llText(path, '');
    _ll.view = 'source';
    _ll.activeText = 'Carregando…';
    _ll.activeMeta = null;

    _llSetStatus('Abrindo ' + _ll.activePath + '…', 'muted');
    _llRender();

    try {
      var base = (typeof API_BASE !== 'undefined' && API_BASE) ? API_BASE : '';
      var res = await fetch(base + '/api/law-library/file?path=' + encodeURIComponent(_ll.activePath));

      if (!res.ok) throw new Error('HTTP ' + res.status);

      var data = await res.json();
      if (data.error) throw new Error(data.error);

      _ll.activeText = _llText(data.content, '');
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
    var contextKey = 'lawlib:' + key;

    _ll.attached[key] = { name: name, length: _ll.activeText.length };

    if (typeof window.addSharedContextItem === 'function') {
      window.addSharedContextItem({
        key: contextKey,
        section: 'lawlib',
        title: name,
        inlineText: _ll.activeText
      });
    } else if (typeof window._checkedShared === 'object' && window._checkedShared) {
      window._checkedShared[contextKey] = {
        section: 'lawlib',
        title: name,
        inlineText: _ll.activeText
      };

      if (typeof window.updateSharedContextBar === 'function') {
        window.updateSharedContextBar();
      }
    }

    _llUpdateContextBar();
    _llSetStatus('Anexado: ' + name, 'ok');
  };

  function _llUpdateContextBar() {
    var bar = $ll('lawLibContextBar');
    var num = $ll('lawLibContextNum');
    var count = Object.keys(_ll.attached).length;

    if (num) num.textContent = String(count);
    if (bar) bar.classList.toggle('empty', count === 0);
  }

  window.lawLibClearContext = function () {
    Object.keys(_ll.attached).forEach(function (k) {
      if (window._checkedShared) delete window._checkedShared['lawlib:' + k];
    });

    _ll.attached = {};

    if (typeof window.updateSharedContextBar === 'function') {
      window.updateSharedContextBar();
    }

    _llUpdateContextBar();
  };

  window.clearLawLibContextState = window.lawLibClearContext;

  /* ── MAIN-VIEW SHOW / HIDE ────────────────────────────────────── */
  function _llHideMainUi(hide) {
    var ids = ['chatHeader', 'welcomeState', 'chatLog', 'chatCompose', 'chatToolbar'];

    ids.forEach(function (id) {
      var el = $ll(id);
      if (!el) return;

      if (hide) {
        if (!(id in _llDisplayStash)) _llDisplayStash[id] = el.style.display;
        el.style.display = 'none';
      } else {
        el.style.display = _llDisplayStash[id] || '';
        delete _llDisplayStash[id];
      }
    });

    var mc = document.querySelector('.main-content');
    if (mc) {
      if (hide) {
        if (!('mainContent' in _llDisplayStash)) _llDisplayStash.mainContent = mc.style.display;
        mc.style.display = 'none';
      } else {
        mc.style.display = _llDisplayStash.mainContent || '';
        delete _llDisplayStash.mainContent;
      }
    }
  }

  window.lawLibShowView = function () {
    document.body.classList.add('lawlib-open');
    _llHideMainUi(true);

    [
      'spacesView',
      'listeningView',
      'studioView',
      'descobertaView',
      'memoryView',
      'shadersView',
      'mermaidView',
      'aexMainView',
      'violationsView',
      'legalRouterView'
    ].forEach(function (vid) {
      var v = $ll(vid);
      if (v) v.classList.remove('active');
    });

    if (typeof window.aexHideMain === 'function') window.aexHideMain();
    if (typeof window.violationsHideView === 'function') window.violationsHideView();
    if (typeof window.legalRouterHideView === 'function') window.legalRouterHideView();
    if (typeof window.spacesHideView === 'function') window.spacesHideView();
    if (typeof window.mermaidHideView === 'function') window.mermaidHideView();

    var sv = $ll('lawLibView');
    if (sv) sv.classList.add('active');

    if (typeof window.vwInitResize === 'function') {
      window.vwInitResize('lawLibResize', 'lawLibSidebar');
    }
    if (typeof window.vwInitEdgeResize === 'function') {
      window.vwInitEdgeResize('lawLibEdgeResize', 'lawLibView');
    }

    if (typeof lawLibInit === 'function') lawLibInit();

    if (typeof window.oliviaRefreshSectionRuntimeUi === 'function') {
      try { window.oliviaRefreshSectionRuntimeUi(); } catch (_e) { }
    }
  };

  window.lawLibHideView = function () {
    document.body.classList.remove('lawlib-open');
    _llHideMainUi(false);

    var sv = $ll('lawLibView');
    if (sv) {
      sv.classList.remove('active');
      sv.style.flex = '';
      sv.style.maxWidth = '';
    }
  };
})();