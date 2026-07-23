/* ═══════════════════════════════════════════════════════════════════
   LEGAL ROUTER MODULE
   Resolve LA8159 0_agents routes and inject them as inline chat context
   ═══════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var _legalRouterState = {
    initialized: false,
    available: false,
    lastPayload: null,
    attachedKeys: [],
    roleFilter: 'all',
    fileSelection: {},
    summarySelected: true,
  };

  var _LR_ROLE_FILTERS = [
    { key: 'all',        label: 'Tudo' },
    { key: 'router',     label: 'Roteador' },
    { key: 'primary',    label: 'Primário' },
    { key: 'supporting', label: 'Suporte' },
    { key: 'direct',     label: 'Direto' },
    { key: 'person',     label: 'Pessoa' },
  ];

  function _lrFileKey(file, index) {
    return _lrSlug(String(file.id || ('file-' + index)) + ':' + String(file.role || 'source'));
  }

  function _lrFileMatchesFilter(file) {
    var role = _legalRouterState.roleFilter || 'all';
    if (role === 'all') return true;
    return String(file.role || '').toLowerCase() === role;
  }

  function _lrEscape(text) {
    if (typeof window.escapeHtml === 'function') return window.escapeHtml(text);
    var div = document.createElement('div');
    div.textContent = String(text == null ? '' : text);
    return div.innerHTML;
  }

  function _lrById(id) {
    return document.getElementById(id);
  }

  function _lrSlug(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'route';
  }

  function _lrToneColor(tone) {
    if (tone === 'error') return 'var(--red)';
    if (tone === 'ok') return 'var(--green, #5aa469)';
    if (tone === 'warn') return 'var(--amber)';
    return 'var(--gray)';
  }

  function _lrSetStatus(message, tone) {
    var el = _lrById('legalRouterStatus');
    if (!el) return;
    el.textContent = String(message || '');
    el.style.color = _lrToneColor(tone || 'muted');
  }

  function _lrAttachedCount() {
    return _legalRouterState.attachedKeys.length;
  }

  function updateLegalRouterContextBar() {
    var bar = _lrById('legalRouterContextBar');
    var num = _lrById('legalRouterContextNum');
    var count = _lrAttachedCount();
    if (num) num.textContent = String(count);
    if (bar) bar.classList.toggle('empty', count === 0);
  }

  function clearLegalRouterContextState() {
    _legalRouterState.attachedKeys = [];
    updateLegalRouterContextBar();
  }

  function _lrFileCard(file, index) {
    var snippet = String(file.content || '').trim().slice(0, 280);
    var role = String(file.role || '').trim() || 'source';
    var meta = [];
    if (file.path) meta.push(file.path);
    if (file.size) meta.push(Math.round(Number(file.size || 0) / 1024) + ' KB');
    var key = _lrFileKey(file, index);
    var checked = _legalRouterState.fileSelection[key] !== false; // default true
    var safeKey = _lrEscape(key);
    var pills = '';
    if (typeof window.vwFilePills === 'function' && file.content) {
      var ext = (String(file.path || '').match(/\.([a-z0-9]+)$/i) || [,''])[1].toLowerCase();
      var mime = ext === 'json' ? 'application/json' : ext === 'html' ? 'text/html' : ext === 'md' ? 'text/markdown' : 'text/plain';
      var dataUrl = 'data:' + mime + ';charset=utf-8,' + encodeURIComponent(String(file.content));
      var fname = (file.path || file.title || file.id || ('arquivo-' + (index + 1))).split('/').pop();
      pills = window.vwFilePills(dataUrl, fname, ext || 'text');
    }
    return [
      '<label style="padding:10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);display:flex;flex-direction:column;gap:6px;cursor:pointer">',
        '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">',
          '<div style="min-width:0;display:flex;align-items:flex-start;gap:8px">',
            '<input type="checkbox" data-lr-file-key="' + safeKey + '"' + (checked ? ' checked' : '') + ' onchange="legalRouterToggleFile(this)" style="margin-top:3px">',
            '<div style="min-width:0">',
              '<div style="font-size:11px;color:var(--amber);text-transform:uppercase;letter-spacing:.08em">' + _lrEscape(role) + '</div>',
              '<div style="font-size:12px;color:var(--gray-hi);font-weight:600;line-height:1.4">' + _lrEscape(file.title || file.id || ('Arquivo ' + (index + 1))) + '</div>',
            '</div>',
          '</div>',
          pills ? '<div style="flex-shrink:0">' + pills + '</div>' : '',
        '</div>',
        meta.length ? '<div style="font-size:10px;color:var(--gray);line-height:1.4;padding-left:24px">' + _lrEscape(meta.join(' · ')) + '</div>' : '',
        snippet ? '<div style="font-size:11px;color:var(--gray);line-height:1.55;white-space:pre-wrap;padding-left:24px">' + _lrEscape(snippet) + (String(file.content || '').length > snippet.length ? '…' : '') + '</div>' : '',
      '</label>'
    ].join('');
  }

  function _lrRoleChips(payload) {
    var files = (payload && Array.isArray(payload.files)) ? payload.files : [];
    var counts = { all: files.length };
    files.forEach(function (f) {
      var r = String(f.role || '').toLowerCase();
      counts[r] = (counts[r] || 0) + 1;
    });
    var current = _legalRouterState.roleFilter || 'all';
    return [
      '<div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center">',
        '<div style="font-size:10px;color:var(--gray);text-transform:uppercase;letter-spacing:.08em;margin-right:4px">Filtrar:</div>',
        _LR_ROLE_FILTERS.filter(function (f) { return f.key === 'all' || (counts[f.key] || 0) > 0; }).map(function (f) {
          var active = current === f.key;
          var c = counts[f.key] || 0;
          var bg = active ? 'var(--amber)' : 'var(--bg)';
          var fg = active ? 'var(--bg)' : 'var(--gray-hi)';
          var border = active ? 'var(--amber)' : 'var(--border)';
          return '<button type="button" class="btn-xs" onclick="legalRouterSetRoleFilter(\'' + f.key + '\')" style="background:' + bg + ';color:' + fg + ';border:1px solid ' + border + '">' + _lrEscape(f.label) + ' (' + c + ')</button>';
        }).join(''),
        '<div style="flex:1"></div>',
        '<button type="button" class="btn-xs" onclick="legalRouterSelectAllVisible(true)" title="Marcar visíveis"><i class="fas fa-check-double"></i></button>',
        '<button type="button" class="btn-xs" onclick="legalRouterSelectAllVisible(false)" title="Desmarcar visíveis"><i class="fas fa-square"></i></button>',
      '</div>'
    ].join('');
  }

  function _lrRenderResults(payload) {
    var el = _lrById('legalRouterResults');
    if (!el) return;

    if (!payload) {
      el.innerHTML = '';
      return;
    }

    if (payload.error) {
      var suggestions = Array.isArray(payload.suggestions) && payload.suggestions.length
        ? '<div style="font-size:11px;color:var(--gray)">Sugestões: ' + _lrEscape(payload.suggestions.join(', ')) + '</div>'
        : '';
      el.innerHTML = '<div style="padding:10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);font-size:12px;color:var(--red)">' + _lrEscape(payload.error) + '</div>' + suggestions;
      return;
    }

    var files = Array.isArray(payload.files) ? payload.files : [];
    var route = payload.route || {};
    var routeBits = [];
    if (route.violation_id) routeBits.push('Violação: ' + route.violation_id);
    if (route.agent_id) routeBits.push('Framework: ' + route.agent_id);
    if (route.person_id) routeBits.push('Pessoa: ' + route.person_id);
    if (route.domain) routeBits.push('Domínio: ' + route.domain);
    if (route.mode === 'search') routeBits.push('Busca: ' + (payload.query || ''));
    var visibleFiles = files.filter(_lrFileMatchesFilter);
    var summaryChecked = _legalRouterState.summarySelected !== false;
    el.innerHTML = [
      '<div style="padding:10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);display:flex;flex-direction:column;gap:8px">',
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">',
          '<div style="min-width:0">',
            '<div style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--amber)">Rota resolvida</div>',
            '<div style="font-size:12px;color:var(--gray-hi);line-height:1.5">' + _lrEscape(routeBits.join(' · ') || payload.query || '') + '</div>',
          '</div>',
          '<button class="btn-xs" type="button" onclick="legalRouterAttachResolved()"><i class="fas fa-paperclip"></i> Anexar selecionados</button>',
        '</div>',
        payload.summary ? (
          '<label style="display:flex;gap:8px;align-items:flex-start;margin:0;padding:8px;border-radius:6px;background:rgba(0,0,0,.08);cursor:pointer">' +
            '<input type="checkbox"' + (summaryChecked ? ' checked' : '') + ' onchange="legalRouterToggleSummary(this)" style="margin-top:3px">' +
            '<pre style="margin:0;font-size:11px;line-height:1.5;white-space:pre-wrap;color:var(--gray-hi);flex:1">' + _lrEscape(payload.summary) + '</pre>' +
          '</label>'
        ) : '',
        files.length ? _lrRoleChips(payload) : '',
        files.length
          ? (visibleFiles.length
              ? visibleFiles.map(function (f) { return _lrFileCard(f, files.indexOf(f)); }).join('')
              : '<div style="font-size:11px;color:var(--gray)">Nenhum arquivo no filtro atual.</div>')
          : '<div style="font-size:11px;color:var(--gray)">Nenhum arquivo resolvido para esta consulta.</div>',
      '</div>'
    ].join('');
  }

  function _lrRemoveAttachedKeys() {
    if (!window._checkedShared) return;
    _legalRouterState.attachedKeys.forEach(function (key) {
      window._checkedShared.delete(key);
    });
    _legalRouterState.attachedKeys = [];
  }

  function clearLegalRouterContext(silent) {
    _lrRemoveAttachedKeys();
    updateLegalRouterContextBar();
    if (typeof window.updateSharedContextBar === 'function') window.updateSharedContextBar();
    if (typeof window.updateComposeContextBar === 'function') window.updateComposeContextBar();
    if (!silent && typeof window.addSystemBubble === 'function') {
      window.addSystemBubble('Contexto do Legal Router limpo.');
    }
  }

  function legalRouterAttachResolved() {
    var payload = _legalRouterState.lastPayload;
    if (!payload || payload.error) {
      _lrSetStatus('Resolva uma rota antes de anexar contexto.', 'warn');
      return;
    }
    if (!window._checkedShared) return;

    clearLegalRouterContext(true);

    var routeKey = _lrSlug((payload.route && (payload.route.violation_id || payload.route.agent_id || payload.route.person_id)) || payload.query);
    var newKeys = [];

    if (payload.summary && _legalRouterState.summarySelected !== false) {
      var summaryKey = 'inline:legal-router:' + routeKey + ':summary';
      window._checkedShared.set(summaryKey, {
        name: '[Legal Router] resumo da rota',
        inlineText: String(payload.summary || ''),
        source: 'legal-router',
      });
      newKeys.push(summaryKey);
    }

    (payload.files || []).forEach(function (file, index) {
      var key = _lrFileKey(file, index);
      if (_legalRouterState.fileSelection[key] === false) return;
      var fileKey = 'inline:legal-router:' + routeKey + ':' + key;
      window._checkedShared.set(fileKey, {
        name: '[Legal Router/' + String(file.role || 'source') + '] ' + String(file.title || file.id || ('Arquivo ' + (index + 1))),
        inlineText: String(file.content || ''),
        path: String(file.path || ''),
        source: 'legal-router',
      });
      newKeys.push(fileKey);
    });

    _legalRouterState.attachedKeys = newKeys;
    updateLegalRouterContextBar();
    if (typeof window.updateSharedContextBar === 'function') window.updateSharedContextBar();
    if (typeof window.updateComposeContextBar === 'function') window.updateComposeContextBar();
    if (typeof window.addSystemBubble === 'function') {
      window.addSystemBubble('Rota legal anexada (' + newKeys.length + ' item(s)).');
    }
    _lrSetStatus('Anexados ' + newKeys.length + ' item(s) ao contexto do chat.', 'ok');
  }

  function legalRouterSetRoleFilter(role) {
    _legalRouterState.roleFilter = String(role || 'all');
    _lrRenderResults(_legalRouterState.lastPayload);
  }

  function legalRouterToggleFile(input) {
    if (!input) return;
    var key = String(input.getAttribute('data-lr-file-key') || '');
    if (!key) return;
    _legalRouterState.fileSelection[key] = !!input.checked;
  }

  function legalRouterToggleSummary(input) {
    _legalRouterState.summarySelected = !!(input && input.checked);
  }

  function legalRouterSelectAllVisible(selected) {
    var payload = _legalRouterState.lastPayload;
    if (!payload || !Array.isArray(payload.files)) return;
    payload.files.forEach(function (f, idx) {
      if (!_lrFileMatchesFilter(f)) return;
      var key = _lrFileKey(f, idx);
      _legalRouterState.fileSelection[key] = !!selected;
    });
    _lrRenderResults(payload);
  }

  async function legalRouterResolve() {
    var input = _lrById('legalRouterQuery');
    var query = String(input && input.value || '').trim();
    if (!query) {
      _lrSetStatus('Informe um ID de violação, framework ou pessoa.', 'warn');
      return;
    }

    _lrSetStatus('Resolvendo rota legal…', 'muted');
    _lrRenderResults(null);

    try {
      var res = await fetch(API_BASE + '/api/legal-router/resolve?query=' + encodeURIComponent(query));
      var payload = await res.json().catch(function () { return {}; });
      _legalRouterState.lastPayload = payload;
      _legalRouterState.fileSelection = {};
      _legalRouterState.summarySelected = true;
      _legalRouterState.roleFilter = 'all';
      _lrRenderResults(payload);
      if (!res.ok || payload.error) {
        _lrSetStatus(payload.error || ('Falha ao resolver rota (HTTP ' + res.status + ').'), 'error');
        return;
      }
      _lrSetStatus('Rota resolvida com ' + String((payload.files || []).length) + ' arquivo(s).', 'ok');
      var autoAttach = _lrById('legalRouterAutoAttach');
      if (autoAttach && autoAttach.checked) {
        legalRouterAttachResolved();
      }
    } catch (err) {
      _legalRouterState.lastPayload = null;
      _lrRenderResults({ error: String((err && err.message) || err) });
      _lrSetStatus('Falha ao resolver rota legal.', 'error');
    }
  }

  async function legalRouterInit(force) {
    if (_legalRouterState.initialized && !force) {
      updateLegalRouterContextBar();
      return;
    }
    _lrSetStatus('Verificando disponibilidade do roteador legal…', 'muted');
    try {
      var res = await fetch(API_BASE + '/api/legal-router/status');
      var payload = await res.json().catch(function () { return {}; });
      _legalRouterState.available = !!payload.available;
      _legalRouterState.initialized = true;
      if (payload.available) {
        _lrSetStatus('Fonte ativa: ' + String(payload.root || ''), 'ok');
      } else {
        _lrSetStatus('0_agents indisponível para o servidor atual.', 'error');
      }
    } catch (err) {
      _legalRouterState.available = false;
      _lrSetStatus('Falha ao verificar o roteador legal.', 'error');
    }
    updateLegalRouterContextBar();
  }

  function legalRouterUseExample(value) {
    var input = _lrById('legalRouterQuery');
    if (input) input.value = String(value || '');
    legalRouterResolve();
  }

  window.legalRouterInit = legalRouterInit;
  window.legalRouterResolve = legalRouterResolve;
  window.legalRouterAttachResolved = legalRouterAttachResolved;
  window.clearLegalRouterContext = clearLegalRouterContext;
  window.clearLegalRouterContextState = clearLegalRouterContextState;
  window.updateLegalRouterContextBar = updateLegalRouterContextBar;
  window.legalRouterUseExample = legalRouterUseExample;
  window.legalRouterSetRoleFilter = legalRouterSetRoleFilter;
  window.legalRouterToggleFile = legalRouterToggleFile;
  window.legalRouterToggleSummary = legalRouterToggleSummary;
  window.legalRouterSelectAllVisible = legalRouterSelectAllVisible;

  window.legalRouterRefresh = function () {
    if (typeof legalRouterInit === 'function') legalRouterInit();
  };
  window.legalRouterFilterRole = function (role, el) {
    if (typeof legalRouterSetRoleFilter === 'function') legalRouterSetRoleFilter(role);
    try {
      var chips = document.querySelectorAll('#legalRouterRoleChips .vw-chip');
      chips.forEach(function (c) { c.classList.remove('active'); });
      if (el) el.classList.add('active');
    } catch (_e) {}
  };

  window.legalRouterShowView = function () {
    var hide = ['chatHeader','welcomeState','chatLog','chatCompose','chatToolbar'];
    hide.forEach(function (id) { var el = document.getElementById(id); if (el) el.style.display = 'none'; });
    var mc = document.querySelector('.main-content');
    if (mc) { mc._vwDisplay = mc.style.display; mc.style.display = 'none'; }
    ['spacesView','listeningView','studioView','descobertaView','memoryView','shadersView','aexMainView','violationsView','lawLibView'].forEach(function (vid) {
      var v = document.getElementById(vid); if (v) v.classList.remove('active');
    });
    if (typeof window.aexHideMain === 'function') window.aexHideMain();
    if (typeof window.violationsHideView === 'function') window.violationsHideView();
    if (typeof window.lawLibHideView === 'function') window.lawLibHideView();
    if (typeof window.spacesHideView === 'function') window.spacesHideView();
    var sv = document.getElementById('legalRouterView');
    if (sv) sv.classList.add('active');
    if (typeof window.vwInitResize === 'function') window.vwInitResize('legalRouterResize', 'legalRouterSidebar');
    if (typeof window.vwInitEdgeResize === 'function') window.vwInitEdgeResize('legalRouterEdgeResize', 'legalRouterView');
    if (typeof legalRouterInit === 'function') legalRouterInit();
    if (typeof window.oliviaRefreshSectionRuntimeUi === 'function') { try { window.oliviaRefreshSectionRuntimeUi(); } catch (_e) {} }
  };

  window.legalRouterHideView = function () {
    var sv = document.getElementById('legalRouterView');
    if (sv) { sv.classList.remove('active'); sv.style.flex=''; sv.style.maxWidth=''; }
    var mc = document.querySelector('.main-content');
    if (mc) { mc.style.display = mc._vwDisplay !== undefined ? mc._vwDisplay : ''; delete mc._vwDisplay; }
    var show = ['chatHeader','welcomeState','chatLog','chatCompose','chatToolbar'];
    show.forEach(function (id) { var el = document.getElementById(id); if (el) el.style.display = ''; });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      updateLegalRouterContextBar();
    });
  } else {
    updateLegalRouterContextBar();
  }
})();