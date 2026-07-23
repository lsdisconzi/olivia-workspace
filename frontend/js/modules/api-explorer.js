/**
 * API Explorer — Interactive panel for browsing mapped functions,
 * viewing the endpoint flow diagram, and chatting with an API-aware agent.
 *
 * Depends on:  window.OliviaLegal_FUNCTIONS (agent-functions-registry.js)
 *              window.LA8159API            (api-client.js)
 * Globals exposed: aexInit, aexSwitchView, aexShowDetail, aexAskAbout, aexSendChat,
 *                  aexSearchFunctions, aexFilterCategory
 */
(function () {
  'use strict';

  // ── State ──────────────────────────────────────────────────────────────────
  var _loaded    = false;
  var _currentFn = null;
  var _chatHistory = [];
  var _diagramLoaded = false;
  var _diagramMode = 'functions';
  var _diagramModeStorageKey = 'OliviaLegal.aex.diagram.mode';
  var _mcpLoaded = false;
  var _ctxListenerBound = false;

  // ── Helpers ────────────────────────────────────────────────────────────────

  function _fmt(str) {
    // Minimal markdown: **bold**, `code`, newlines → <br>
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code style="font-family:var(--mono);font-size:10px;color:var(--amber)">$1</code>')
      .replace(/\n/g, '<br>');
  }

  function _reg() { return typeof OliviaLegal_FUNCTIONS !== 'undefined' ? OliviaLegal_FUNCTIONS : null; }

  function _panelContextData() {
    if (typeof window.buildSelectedPanelContext === 'function') {
      return window.buildSelectedPanelContext();
    }
    return { text: '', selectedCount: 0, availableCount: 0, snapshots: [] };
  }

  function _refreshAgentContextIndicator() {
    var indicator = document.getElementById('aexPanelCtxIndicator');
    if (!indicator) return;
    var data = _panelContextData();
    var activeLabels = (data.snapshots || []).filter(function (s) {
      return s && s.available && s.content;
    }).map(function (s) {
      if (typeof window.formatPanelContextLabel === 'function') {
        return window.formatPanelContextLabel(s.key || s.label);
      }
      return s.label;
    });
    indicator.classList.toggle('is-empty', data.availableCount === 0);
    indicator.textContent = 'Contexto de paineis: ' + data.availableCount + '/' + data.selectedCount + (activeLabels.length ? ' (' + activeLabels.join(', ') + ')' : '');
    indicator.title = data.availableCount > 0
      ? 'Contexto ativo em: ' + activeLabels.join(', ')
      : 'Nenhum painel selecionado esta ativo no momento.';
  }

  function _aexNormalizeDiagramMode(mode) {
    var m = String(mode || '').toLowerCase();
    if (m === 'mcp-vps' || m === 'combined' || m === 'functions' || m === 'owners') return m;
    return 'functions';
  }

  function _aexReadDiagramMode() {
    try {
      if (typeof localStorage !== 'undefined') {
        return _aexNormalizeDiagramMode(localStorage.getItem(_diagramModeStorageKey));
      }
    } catch (_e) {}
    return 'functions';
  }

  function _aexApplyDiagramModeControl() {
    var sel = document.getElementById('aexMapMode');
    if (!sel) return;
    sel.value = _diagramMode;
  }

  function _aexSetMapStatus(msg) {
    var el = document.getElementById('aexMapStatus');
    if (!el) return;
    el.textContent = String(msg || 'Role para explorar →');
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  function aexInit() {
    var r = _reg();
    if (!r) { _renderFnList([]); return; }

    if (!_ctxListenerBound) {
      window.addEventListener('LA8159:panel-context-updated', _refreshAgentContextIndicator);
      _ctxListenerBound = true;
    }
    _refreshAgentContextIndicator();

    // Re-render whenever the list has no function cards (first open OR revisit after reset)
    var list = document.getElementById('aexFnList');
    var hasCards = list && list.querySelector('.aex-fn-card');
    if (_loaded && hasCards) {
      _refreshStats();
      return;
    }
    _loaded = true;

    r.init().then(function () {
      _refreshStats();
      _populateCatFilter();
      _populateServicePortFilter();
      _populateOwnerGroupFilter();
      _renderFnList(_allFunctions());
    }).catch(function (err) {
      var list = document.getElementById('aexFnList');
      if (list) list.innerHTML = '<div class="aex-empty"><i class="fas fa-exclamation-triangle"></i>Erro ao carregar registro: ' + escapeHtml(err && err.message) + '</div>';
    });
  }

  function _allFunctions() {
    var r = _reg();
    if (!r || !r.loaded) return [];
    return Object.values(r.registry.functions || {});
  }

  // ── Stats bar ──────────────────────────────────────────────────────────────
  function _refreshStats() {
    var el = document.getElementById('aexStats');
    if (!el) return;
    var r = _reg();
    if (!r || !r.loaded) { el.innerHTML = '<span>Carregando&hellip;</span>'; return; }
    var sourceMeta = (r.registry && r.registry.sourceMeta) ? r.registry.sourceMeta : {};
    var sourceTag = sourceMeta.source === 'local_mapping' ? 'local mapping' : 'api';
    var cats = r.getAllCategories().length;
    var caps = r.getAllCapabilities().length;
    var allFns = Object.values(r.registry.functions || {});
    var total = allFns.length;
    var ready = allFns.filter(function (fn) { return !!fn.agentReady; }).length;
    var ok = allFns.filter(function (fn) { return fn.testStatus === 'ok'; }).length;
    var missingServicePort = allFns.filter(function (fn) { return !fn.servicePort; }).length;
    var owned = allFns.filter(function (fn) {
      var groups = Array.isArray(fn.ownerGroups) ? fn.ownerGroups : [];
      var agents = Array.isArray(fn.ownerAgents) ? fn.ownerAgents : [];
      return groups.length > 0 || agents.length > 0;
    }).length;
    el.innerHTML =
      '<span>' + total + ' fun&ccedil;&otilde;es</span>' +
      '<span>fonte: ' + escapeHtml(sourceTag) + '</span>' +
      '<span>' + ready + ' prontas</span>' +
      '<span>' + ok + ' testadas OK</span>' +
      '<span>' + owned + ' com ownership</span>' +
      '<span>' + missingServicePort + ' sem service.port</span>' +
      '<span>' + cats + ' categorias</span>' +
      '<span>' + caps + ' capacidades</span>';
  }

  // ── Category filter ────────────────────────────────────────────────────────
  function _populateCatFilter() {
    var sel = document.getElementById('aexCatFilter');
    if (!sel) return;
    var r = _reg();
    if (!r || !r.loaded) return;
    var cats = r.getAllCategories();
    sel.innerHTML = '<option value="">Todas</option>' +
      cats.map(function (c) {
        var label = c.replace(/^crud_/, 'CRUD ').replace(/^[a-z]/, function (m) { return m.toUpperCase(); });
        return '<option value="' + escapeHtml(c) + '">' + escapeHtml(label) + '</option>';
      }).join('');
  }

  function _populateServicePortFilter() {
    var sel = document.getElementById('aexServicePortFilter');
    if (!sel) return;
    var allFns = _allFunctions();
    var counts = {};
    var missingCount = 0;

    allFns.forEach(function (fn) {
      var key = fn.servicePort || null;
      if (!key) {
        missingCount += 1;
        return;
      }
      counts[key] = (counts[key] || 0) + 1;
    });

    var values = Object.keys(counts).sort();
    var missingOption = missingCount
      ? '<option value="__missing__">Sem service.port (' + missingCount + ')</option>'
      : '';

    sel.innerHTML = '<option value="">Todos os service.port</option>' +
      missingOption +
      values.map(function (v) {
        return '<option value="' + escapeHtml(v) + '">' + escapeHtml(v) + ' (' + counts[v] + ')</option>';
      }).join('');
  }

  function _populateOwnerGroupFilter() {
    var sel = document.getElementById('aexOwnerGroupFilter');
    if (!sel) return;
    var r = _reg();
    if (!r || !r.loaded) return;

    var allFns = _allFunctions();
    var counts = {};
    var noOwner = 0;
    allFns.forEach(function(fn) {
      var groups = Array.isArray(fn.ownerGroups) ? fn.ownerGroups : [];
      if (!groups.length) {
        noOwner += 1;
        return;
      }
      groups.forEach(function(group) {
        counts[group] = (counts[group] || 0) + 1;
      });
    });

    var labels = (r.registry && r.registry.architecture && r.registry.architecture.groupLabels)
      ? r.registry.architecture.groupLabels
      : {};
    var groupKeys = Object.keys(labels).concat(Object.keys(counts)).filter(function(v, idx, arr) {
      return arr.indexOf(v) === idx;
    }).sort();

    var selected = sel.value || '';
    sel.innerHTML = '<option value="">Todos os grupos owner</option>' +
      '<option value="__none__">Sem ownership (' + noOwner + ')</option>' +
      groupKeys.map(function(group) {
        var label = labels[group] || group;
        return '<option value="' + escapeHtml(group) + '">' + escapeHtml(label) + ' (' + (counts[group] || 0) + ')</option>';
      }).join('');
    if (selected) sel.value = selected;
  }

  // ── Function rendering ─────────────────────────────────────────────────────
  function _renderFnList(fns) {
    var list = document.getElementById('aexFnList');
    if (!list) return;
    if (!fns || !fns.length) {
      list.innerHTML = '<div class="aex-empty"><i class="fas fa-search"></i>Nenhuma fun&ccedil;&atilde;o encontrada</div>';
      return;
    }
    list.innerHTML = fns.map(function (fn) {
      var method = (fn.method || 'GET').toLowerCase();
      var path = fn.resolvedUrl
        ? fn.resolvedUrl.replace(/^https?:\/\/[^/]+/, '')
        : (fn.urlTemplate || '');
      if (path.length > 52) path = path.substring(0, 52) + '…';
      var srcFile = fn.source_file ? fn.source_file.split('/').pop() : '';
      var portNum = fn.port != null && fn.port !== '' ? Number(fn.port) : null;
      var servicePort = fn.servicePort || (fn.service ? (portNum != null ? (fn.service + '.' + portNum) : fn.service) : '');
      var caps = fn.capabilities ? fn.capabilities.slice(0, 3) : [];
      var ownerGroups = (fn.ownerGroupLabels && fn.ownerGroupLabels.length ? fn.ownerGroupLabels : (fn.ownerGroups || [])).slice(0, 2);
      var extraOwnerCount = Math.max(0, (fn.ownerGroups || []).length - ownerGroups.length);
      var status = fn.testStatus || null;
      var readyChip = fn.agentReady
        ? '<span class="aex-cap-chip" style="border-color:#2e7d32;color:#2e7d32">ready</span>'
        : '';
      var testChip = status
        ? '<span class="aex-cap-chip" style="border-color:' +
          (status === 'ok' ? '#2e7d32' : (status === 'untested' ? '#6c757d' : '#d32f2f')) +
          ';color:' +
          (status === 'ok' ? '#2e7d32' : (status === 'untested' ? '#6c757d' : '#d32f2f')) +
          '">test:' + escapeHtml(status) + '</span>'
        : '';

      return '<div class="aex-fn-card" onclick="aexShowDetail(\'' + fn.id + '\')" data-id="' + fn.id + '">' +
        '<div class="aex-fn-header">' +
          '<span class="aex-method aex-method-' + method + '">' + escapeHtml(fn.method || 'GET') + '</span>' +
          '<span class="aex-fn-name">' + escapeHtml(fn.name) + '</span>' +
        '</div>' +
        (path ? '<div class="aex-fn-url">' + escapeHtml(path) + '</div>' : '') +
        (servicePort ? '<div class="aex-fn-src"><i class="fas fa-plug"></i> ' + escapeHtml(servicePort) + '</div>' : '') +
        (ownerGroups.length ? '<div class="aex-fn-src"><i class="fas fa-users"></i> ' + escapeHtml(ownerGroups.join(', ')) + (extraOwnerCount ? ' +' + extraOwnerCount : '') + '</div>' : '') +
        (srcFile ? '<div class="aex-fn-src"><i class="fas fa-file-code"></i> ' + escapeHtml(srcFile) + '</div>' : '') +
        (caps.length ? '<div class="aex-fn-caps">' + caps.map(function (c) {
          return '<span class="aex-cap-chip">' + escapeHtml(c) + '</span>';
        }).join('') + readyChip + testChip + '</div>' : ('<div class="aex-fn-caps">' + readyChip + testChip + '</div>')) +
      '</div>';
    }).join('');
  }

  // ── Search ─────────────────────────────────────────────────────────────────
  function aexSearchFunctions() {
    var q = (document.getElementById('aexSearch') || {}).value || '';
    var catFilter = (document.getElementById('aexCatFilter') || {}).value || '';
    var statusFilter = (document.getElementById('aexStatusFilter') || {}).value || '';
    var servicePortFilter = (document.getElementById('aexServicePortFilter') || {}).value || '';
    var ownerGroupFilter = (document.getElementById('aexOwnerGroupFilter') || {}).value || '';
    var r = _reg();
    if (!r) { _renderFnList([]); return; }
    if (!r.loaded) {
      aexInit();
      return;
    }

    var fns;
    if (q.trim()) {
      fns = r.search(q.trim());
      if (catFilter) fns = fns.filter(function (fn) { return fn.category === catFilter; });
    } else if (catFilter) {
      fns = r.getByCategory(catFilter) || [];
    } else {
      fns = _allFunctions();
    }

    if (statusFilter) {
      fns = (fns || []).filter(function (fn) {
        var testStatus = fn.testStatus || null;
        if (statusFilter === 'ready') return !!fn.agentReady;
        if (statusFilter === 'tested_any') return !!testStatus && testStatus !== 'untested';
        if (statusFilter === 'tested_ok') return testStatus === 'ok';
        if (statusFilter === 'tested_not_ok') return !!testStatus && testStatus !== 'ok' && testStatus !== 'untested';
        if (statusFilter === 'untested') return !testStatus || testStatus === 'untested';
        return true;
      });
    }

    if (servicePortFilter) {
      fns = (fns || []).filter(function (fn) {
        if (servicePortFilter === '__missing__') return !fn.servicePort;
        return (fn.servicePort || '') === servicePortFilter;
      });
    }

    if (ownerGroupFilter) {
      fns = (fns || []).filter(function(fn) {
        var groups = Array.isArray(fn.ownerGroups) ? fn.ownerGroups : [];
        if (ownerGroupFilter === '__none__') return groups.length === 0;
        return groups.indexOf(ownerGroupFilter) >= 0;
      });
    }

    _renderFnList(fns || []);
  }

  function aexFilterCategory() {
    aexSearchFunctions();
  }

  // ── View switching ─────────────────────────────────────────────────────────
  function aexSwitchView(view) {
    document.querySelectorAll('.aex-view').forEach(function (el) {
      el.classList.toggle('active', el.getAttribute('data-view') === view);
    });
    document.querySelectorAll('.aex-subtab').forEach(function (el) {
      el.classList.toggle('active', el.getAttribute('data-view') === view);
    });
    if (view === 'diagram') {
      _aexApplyDiagramModeControl();
      _loadDiagram();
    }
    if (view === 'mcp') {
      _aexSetMcpViewMode(_mcpViewMode, { persist: false });
      _loadMcpInventory(false);
    }
    if (view === 'agent') _refreshAgentContextIndicator();
  }

  // ── Function detail ────────────────────────────────────────────────────────
  function aexShowDetail(id) {
    _currentFn = id;
    document.querySelectorAll('.aex-fn-card').forEach(function (el) {
      el.classList.toggle('active', el.getAttribute('data-id') === id);
    });

    var panel = document.getElementById('aexDetail');
    if (!panel) return;
    panel.innerHTML = '<div class="aex-detail-loading"><div class="loading"></div></div>';
    panel.classList.add('open');

    var r = _reg();
    var fn = r ? r.getById(id) : null;
    if (!fn) {
      panel.innerHTML = '<div class="aex-empty"><i class="fas fa-question-circle"></i>Fun&ccedil;&atilde;o n&atilde;o encontrada</div>';
      return;
    }

    if (r) {
      r.loadFunction(id).then(function (full) {
        var detailHtml = _buildDetail(full || fn, fn, r);
        panel.innerHTML = detailHtml;
        _pushToOutputPanel(full || fn, fn);
      }).catch(function () {
        var detailHtml = _buildDetail(fn, fn, r);
        panel.innerHTML = detailHtml;
        _pushToOutputPanel(fn, fn);
      });
    } else {
      panel.innerHTML = _buildDetail(fn, fn, null);
      _pushToOutputPanel(fn, fn);
    }
  }

  /* Push function detail as an HTML artifact to the output panel */
  function _pushToOutputPanel(full, fn) {
    if (typeof addOutputArtifact !== 'function') return;
    addOutputArtifact({
      id:           'fn-' + fn.id,
      title:        (fn.method || 'GET') + ' · ' + fn.name,
      type:         'html',
      content_type: 'text/html',
      content:      _buildDetailPage(full, fn)
    });
    // Auto-open output panel if closed
    var outPanel = document.getElementById('outputPanel');
    if (outPanel && !outPanel.classList.contains('open') && typeof toggleOutputPanel === 'function') {
      toggleOutputPanel();
    }
  }

  /* Generate a self-contained HTML page with function detail (for output panel / browser) */
  function _buildDetailPage(full, fn) {
    var method = fn.method || 'GET';
    var path = fn.resolvedUrl
      ? fn.resolvedUrl.replace(/^https?:\/\/[^/]+/, '')
      : (fn.urlTemplate || '');
    var methodColor = {GET:'#2e7d32',POST:'#1565c0',DELETE:'#b71c1c',PUT:'#e65100',PATCH:'#6a1b9a'}[method] || '#555';

    var rows = '';
    var svcName = full.service || fn.service || '';
    var svcPortNum = full.port != null && full.port !== '' ? Number(full.port) : (fn.port != null && fn.port !== '' ? Number(fn.port) : null);
    var svcPortLabel = full.service_port || fn.servicePort || (svcName ? (svcPortNum != null ? (svcName + '.' + svcPortNum) : svcName) : '');
    var svcBaseUrl = full.base_url || fn.baseUrl || '';
    if (full.source_file)     rows += '<tr><td>Arquivo</td><td><code>' + escapeHtml(full.source_file) + '</code></td></tr>';
    if (full.source_function) rows += '<tr><td>Função</td><td><code>' + escapeHtml(full.source_function) + '()</code></td></tr>';
    if (fn.category)          rows += '<tr><td>Categoria</td><td>' + escapeHtml(fn.category) + '</td></tr>';
    if (svcPortLabel)         rows += '<tr><td>Service.Port</td><td><code>' + escapeHtml(svcPortLabel) + '</code></td></tr>';
    if (svcBaseUrl)           rows += '<tr><td>Base URL</td><td><code>' + escapeHtml(svcBaseUrl) + '</code></td></tr>';
    if (full.response_type)   rows += '<tr><td>Resposta</td><td>' + escapeHtml(full.response_type) + '</td></tr>';

    var caps = (fn.capabilities || []).map(function(c) {
      return '<span style="display:inline-block;background:#e8f5e9;color:#2e7d32;border:1px solid #a5d6a7;border-radius:10px;padding:2px 8px;font-size:11px;margin:2px">' + escapeHtml(c) + '</span>';
    }).join('');
    var ownerGroups = fn.ownerGroupLabels || fn.ownerGroups || [];
    var ownerAgents = fn.ownerAgents || [];
    var ownerCaps = fn.capabilityIds || [];
    var ownership = '';
    if (ownerGroups.length || ownerAgents.length || ownerCaps.length) {
      ownership = '<h4 style="margin:16px 0 6px;font-size:12px;color:#555">Ownership &amp; Assigned Capabilities</h4>' +
        '<div style="margin:6px 0">' +
          ownerGroups.map(function(g){
            return '<span style="display:inline-block;background:#eef7ff;color:#1565c0;border:1px solid #90caf9;border-radius:10px;padding:2px 8px;font-size:11px;margin:2px">group: ' + escapeHtml(g) + '</span>';
          }).join('') +
          ownerAgents.slice(0, 8).map(function(a){
            return '<span style="display:inline-block;background:#fff3e0;color:#e65100;border:1px solid #ffcc80;border-radius:10px;padding:2px 8px;font-size:11px;margin:2px">agent: ' + escapeHtml(a) + '</span>';
          }).join('') +
          ownerCaps.slice(0, 8).map(function(c){
            return '<span style="display:inline-block;background:#f5f5f5;color:#455a64;border:1px solid #cfd8dc;border-radius:10px;padding:2px 8px;font-size:11px;margin:2px">' + escapeHtml(c) + '</span>';
          }).join('') +
        '</div>';
    }

    var bodySection = '';
    var bs = full.body_schema || full.bodySchema;
    if (bs) {
      var bsStr = typeof bs === 'string' ? bs : (bs.description || JSON.stringify(bs, null, 2));
      bodySection = '<h4 style="margin:16px 0 6px;font-size:12px;color:#555">Request Body</h4><pre style="background:#f5f5f5;padding:10px;border-radius:4px;font-size:11px;overflow:auto">' + escapeHtml(bsStr) + '</pre>';
    }

    var respSection = '';
    var rs = full.response_schema || full.responseSchema;
    if (rs) {
      var rsStr = typeof rs === 'string' ? rs : (rs.description || JSON.stringify(rs, null, 2));
      respSection = '<h4 style="margin:16px 0 6px;font-size:12px;color:#555">Response Schema</h4><pre style="background:#f5f5f5;padding:10px;border-radius:4px;font-size:11px;overflow:auto">' + escapeHtml(rsStr) + '</pre>';
    }

    return '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>' + escapeHtml(fn.name) + '</title>' +
      '<style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:0;padding:16px;color:#222;font-size:13px}' +
      'code{background:#f0f0f0;padding:1px 4px;border-radius:3px;font-family:monospace}' +
      'table{border-collapse:collapse;width:100%;margin:8px 0}td{padding:5px 8px;border-bottom:1px solid #eee}td:first-child{color:#888;width:90px;white-space:nowrap}' +
      'pre{white-space:pre-wrap;word-break:break-all}' +
      '</style></head><body>' +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">' +
        '<span style="background:' + methodColor + ';color:#fff;padding:3px 8px;border-radius:4px;font-size:11px;font-weight:700">' + escapeHtml(method) + '</span>' +
        '<strong style="font-size:15px">' + escapeHtml(fn.name) + '</strong>' +
      '</div>' +
      (path ? '<code style="display:block;background:#f5f5f5;padding:8px 10px;border-radius:4px;margin-bottom:12px;font-size:12px">' + escapeHtml(path) + '</code>' : '') +
      (full.description ? '<p style="color:#555;margin:0 0 12px;line-height:1.5">' + escapeHtml(full.description) + '</p>' : '') +
      (rows ? '<table>' + rows + '</table>' : '') +
      (caps ? '<div style="margin:10px 0">' + caps + '</div>' : '') +
        ownership +
      bodySection + respSection +
      '</body></html>';
  }

  /* Generate an interactive HTML test form for the browser panel */
  function _buildFormPage(full, fn) {
    var method = fn.method || 'GET';
    var url = fn.resolvedUrl || fn.urlTemplate || '';
    var methodColor = {GET:'#2e7d32',POST:'#1565c0',DELETE:'#b71c1c',PUT:'#e65100',PATCH:'#6a1b9a'}[method] || '#555';

    var pathParams = (full.path_params || fn.pathParams || []);
    var queryParams = (full.query_params || fn.queryParams || []);
    var bodySchema = full.body_schema || full.bodySchema;

    var paramFields = '';
    pathParams.forEach(function(p) {
      var name = p.name || p;
      paramFields += '<div class="field"><label for="pp_' + escapeHtml(name) + '">{' + escapeHtml(name) + '} <small style="color:#888">path</small></label>' +
        '<input type="text" id="pp_' + escapeHtml(name) + '" name="pp_' + escapeHtml(name) + '" placeholder="' + escapeHtml(name) + '" oninput="updateUrl()"></div>';
    });
    queryParams.forEach(function(p) {
      var name = p.name || p;
      var req = p.required ? ' <span style="color:red">*</span>' : '';
      paramFields += '<div class="field"><label for="qp_' + escapeHtml(name) + '">' + escapeHtml(name) + req + ' <small style="color:#888">query</small></label>' +
        '<input type="text" id="qp_' + escapeHtml(name) + '" name="qp_' + escapeHtml(name) + '" placeholder="' + escapeHtml(name) + '" oninput="updateUrl()"></div>';
    });

    var bodyField = '';
    if (method !== 'GET' && method !== 'DELETE') {
      var bodyDefault = bodySchema
        ? (typeof bodySchema === 'string' ? bodySchema : JSON.stringify(bodySchema, null, 2))
        : '{}';
      bodyField = '<div class="field"><label for="reqBody">Request Body <small style="color:#888">JSON</small></label>' +
        '<textarea id="reqBody" name="reqBody" rows="6" style="font-family:monospace;font-size:12px">' + escapeHtml(bodyDefault) + '</textarea></div>';
    }

    return '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>Test: ' + escapeHtml(fn.name) + '</title>' +
      '<style>*{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:0;padding:12px;font-size:13px;color:#222;background:#fafafa}' +
      'h3{margin:0 0 8px;font-size:14px}.badge{background:' + methodColor + ';color:#fff;padding:2px 7px;border-radius:3px;font-size:11px;font-weight:700;margin-right:6px}' +
      '.field{margin:8px 0}.field label,.field .field-label{display:block;font-size:11px;color:#666;margin-bottom:3px;font-weight:500}' +
      'input,textarea,select{width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:4px;font-size:12px;font-family:inherit}' +
      'input:focus,textarea:focus{outline:none;border-color:#1976d2}' +
      '#urlDisplay{background:#f0f0f0;padding:8px 10px;border-radius:4px;font-size:11px;font-family:monospace;word-break:break-all;margin:8px 0;min-height:28px}' +
      'button{padding:8px 16px;background:#1976d2;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:13px;font-weight:500}' +
      'button:hover{background:#1565c0}button:active{background:#0d47a1}' +
      '#result{margin-top:10px;padding:10px;background:#fff;border:1px solid #ddd;border-radius:4px;font-family:monospace;font-size:11px;white-space:pre-wrap;max-height:300px;overflow:auto;display:none}' +
      '.status-ok{color:#2e7d32}.status-err{color:#c62828}' +
      '.loader{display:inline-block;width:14px;height:14px;border:2px solid #ccc;border-top-color:#1976d2;border-radius:50%;animation:spin .7s linear infinite;vertical-align:middle;margin-left:8px}' +
      '@keyframes spin{to{transform:rotate(360deg)}}' +
      'hr{border:none;border-top:1px solid #eee;margin:10px 0}' +
      '</style></head><body>' +
      '<h3><span class="badge">' + escapeHtml(method) + '</span>' + escapeHtml(fn.name) + '</h3>' +
      (full.description ? '<p style="color:#666;font-size:12px;margin:0 0 8px">' + escapeHtml(full.description) + '</p>' : '') +
      '<hr>' +
      (paramFields ? '<div id="params">' + paramFields + '</div>' : '') +
      '<div class="field"><div class="field-label">URL</div><div id="urlDisplay">' + escapeHtml(url) + '</div></div>' +
      bodyField +
      '<div class="field"><label for="extraHeaders">Headers extras <small style="color:#888">JSON opcional</small></label>' +
        '<input type="text" id="extraHeaders" name="extraHeaders" placeholder=\'{"Authorization":"Bearer ..."}\' >' +
      '</div>' +
      '<button onclick="sendRequest()">Enviar &rarr;</button> <span id="loader" style="display:none" class="loader"></span>' +
      '<div id="result"></div>' +
      '<script>' +
      'var _baseUrl = ' + JSON.stringify(url) + ';' +
      'var _method = ' + JSON.stringify(method) + ';' +
      'var _pathParams = ' + JSON.stringify(pathParams.map(function(p){ return p.name||p; })) + ';' +
      'var _queryParams = ' + JSON.stringify(queryParams.map(function(p){ return p.name||p; })) + ';' +
      'function updateUrl(){' +
        'var u = _baseUrl;' +
        '_pathParams.forEach(function(n){var v=document.getElementById("pp_"+n);if(v&&v.value)u=u.replace("{"+n+"}","${"+n+"}".replace("${"+n+"}",v.value)||("{"+n+"}"))});' +
        // simpler version:
        '_pathParams.forEach(function(n){var el=document.getElementById("pp_"+n);if(el&&el.value)u=u.replace(new RegExp("\\\\{"+n+"\\\\}|\\\\$\\\\{"+n+"\\\\}","g"),encodeURIComponent(el.value))});' +
        'var qs=[];_queryParams.forEach(function(n){var el=document.getElementById("qp_"+n);if(el&&el.value)qs.push(encodeURIComponent(n)+"="+encodeURIComponent(el.value))});' +
        'if(qs.length)u+=(u.indexOf("?")>=0?"&":"?")+qs.join("&");' +
        'document.getElementById("urlDisplay").textContent=u;' +
      '}' +
      'function sendRequest(){' +
        'var u=document.getElementById("urlDisplay").textContent;' +
        'var opts={method:_method,headers:{"Content-Type":"application/json"}};' +
        'try{var eh=JSON.parse(document.getElementById("extraHeaders").value||"{}");Object.assign(opts.headers,eh);}catch(e){}' +
        'var bd=document.getElementById("reqBody");if(bd&&bd.value.trim())opts.body=bd.value.trim();' +
        'var res=document.getElementById("result");res.style.display="block";res.textContent="Enviando...";' +
        'document.getElementById("loader").style.display="inline-block";' +
        'fetch(u,opts).then(function(r){' +
          'document.getElementById("loader").style.display="none";' +
          'var statusEl="<span class=\'"+(r.ok?"status-ok":"status-err")+"\'> HTTP "+r.status+" "+r.statusText+"</span>\\n";' +
          'return r.text().then(function(t){try{t=JSON.stringify(JSON.parse(t),null,2)}catch(e){}res.innerHTML=statusEl+"<code>"+t.replace(/&/g,"&amp;").replace(/</g,"&lt;")+"</code>"});' +
        '}).catch(function(e){document.getElementById("loader").style.display="none";res.innerHTML="<span class=\'status-err\'>Erro: "+e.message+"</span>"});' +
      '}' +
      'updateUrl();' +
      '<\/script>' +
      '</body></html>';
  }

  /* Open the interactive test form in the browser panel */
  function aexTestInBrowser(id) {
    var r = _reg();
    var fn = r ? r.getById(id) : null;
    if (!fn) return;
    r.loadFunction(id).then(function(full) {
      var html = _buildFormPage(full || fn, fn);
      var browser = document.getElementById('browserFrame');
      if (browser) { browser.srcdoc = html; }
      if (typeof toggleBrowserPanel === 'function') toggleBrowserPanel();
    }).catch(function() {
      var html = _buildFormPage(fn, fn);
      var browser = document.getElementById('browserFrame');
      if (browser) { browser.srcdoc = html; }
      if (typeof toggleBrowserPanel === 'function') toggleBrowserPanel();
    });
  }

  function _buildDetail(full, fn, reg) {
    var method = fn.method || 'GET';
    var path = fn.resolvedUrl
      ? fn.resolvedUrl.replace(/^https?:\/\/[^/]+/, '')
      : (fn.urlTemplate || '');
    var svcName = full.service || fn.service || '';
    var svcPortNum = full.port != null && full.port !== '' ? Number(full.port) : (fn.port != null && fn.port !== '' ? Number(fn.port) : null);
    var svcPortLabel = full.service_port || fn.servicePort || (svcName ? (svcPortNum != null ? (svcName + '.' + svcPortNum) : svcName) : '');
    var svcBaseUrl = full.base_url || fn.baseUrl || '';

    var html = '<div class="aex-detail-header">' +
      '<button class="aex-detail-close" onclick="document.getElementById(\'aexDetail\').classList.remove(\'open\')" title="Fechar"><i class="fas fa-times"></i></button>' +
      '<span class="aex-method aex-method-' + method.toLowerCase() + '">' + escapeHtml(method) + '</span>' +
      '<strong>' + escapeHtml(fn.name) + '</strong>' +
    '</div>';

    if (full.description) {
      html += '<p class="aex-detail-desc">' + escapeHtml(full.description) + '</p>';
    }

    if (path) {
      html += '<div class="aex-detail-url"><code>' + escapeHtml(path) + '</code></div>';
    }

    if (full.source_file) {
      html += '<div class="aex-detail-row"><span class="aex-detail-label">Arquivo</span><span class="aex-detail-val">' + escapeHtml(full.source_file) + '</span></div>';
    }
    if (full.source_function) {
      html += '<div class="aex-detail-row"><span class="aex-detail-label">Fun&ccedil;&atilde;o</span><code>' + escapeHtml(full.source_function) + '()</code></div>';
    }
    if (fn.category) {
      html += '<div class="aex-detail-row"><span class="aex-detail-label">Categoria</span><span class="aex-detail-val">' + escapeHtml(fn.category) + '</span></div>';
    }
    if (svcPortLabel) {
      html += '<div class="aex-detail-row"><span class="aex-detail-label">Service.Port</span><code>' + escapeHtml(svcPortLabel) + '</code></div>';
    }
    if (svcBaseUrl) {
      html += '<div class="aex-detail-row"><span class="aex-detail-label">Base URL</span><code>' + escapeHtml(svcBaseUrl) + '</code></div>';
    }
    if (full.agent_ready != null) {
      html += '<div class="aex-detail-row"><span class="aex-detail-label">Ready</span><span class="aex-detail-val">' + (full.agent_ready ? 'sim' : 'não') + '</span></div>';
    }
    if (full.validation_score != null) {
      html += '<div class="aex-detail-row"><span class="aex-detail-label">Validation</span><span class="aex-detail-val">' + escapeHtml(full.validation_score) + '/100</span></div>';
    }
    if (full.test_status) {
      var testLabel = escapeHtml(full.test_status + (full.test_http_code ? ' (' + full.test_http_code + ')' : ''));
      html += '<div class="aex-detail-row"><span class="aex-detail-label">Teste</span><span class="aex-detail-val">' + testLabel + '</span></div>';
    }
    if (full.fix_suggestion) {
      html += '<div class="aex-detail-row"><span class="aex-detail-label">Fix</span><span class="aex-detail-val">' + escapeHtml(full.fix_suggestion) + '</span></div>';
    }

    // Body schema
    var bs = full.body_schema || full.bodySchema;
    if (bs) {
      var bsDesc = typeof bs === 'string' ? bs : (bs.description || JSON.stringify(bs, null, 2));
      html += '<div class="aex-detail-section">' +
        '<div class="aex-detail-section-title">Request Body</div>' +
        '<div class="aex-detail-code">' + escapeHtml(bsDesc) + '</div>' +
      '</div>';
    }

    // Headers
    var headers = full.headers || full.required_headers;
    if (headers && headers.length) {
      html += '<div class="aex-detail-section"><div class="aex-detail-section-title">Headers</div>' +
        headers.map(function (h) {
          var name = h.name || h;
          var val  = h.value || '';
          var req  = h.required ? ' <em style="color:var(--amber);font-size:9px">required</em>' : '';
          return '<div class="aex-detail-row"><code>' + escapeHtml(name) + '</code>' +
            (val ? '<span class="aex-detail-val">' + escapeHtml(val) + req + '</span>' : req) + '</div>';
        }).join('') + '</div>';
    }

    // Response schema
    var rs = full.response_schema || full.responseSchema;
    if (rs) {
      var rsDesc = typeof rs === 'string' ? rs : (rs.description || JSON.stringify(rs, null, 2));
      html += '<div class="aex-detail-section">' +
        '<div class="aex-detail-section-title">Response</div>' +
        '<div class="aex-detail-code">' + escapeHtml(rsDesc) + '</div>' +
      '</div>';
    }

    // Capabilities + use cases
    var caps = fn.capabilities || [];
    var uses = fn.useCases || fn.use_cases || [];
    if (caps.length || uses.length) {
      html += '<div class="aex-detail-section"><div class="aex-detail-section-title">Capacidades &amp; Usos</div>' +
        '<div class="aex-fn-caps">' +
          caps.map(function (c) { return '<span class="aex-cap-chip">' + escapeHtml(c) + '</span>'; }).join('') +
          uses.map(function (u) { return '<span class="aex-cap-chip" style="border-color:var(--blue);color:var(--blue)">' + escapeHtml(u) + '</span>'; }).join('') +
        '</div></div>';
    }

    var ownerGroups = fn.ownerGroupLabels || fn.ownerGroups || [];
    var ownerAgents = fn.ownerAgents || [];
    var ownerCaps = fn.capabilityIds || [];
    if (ownerGroups.length || ownerAgents.length || ownerCaps.length) {
      html += '<div class="aex-detail-section"><div class="aex-detail-section-title">Ownership (Agentes &amp; Grupos)</div>' +
        '<div class="aex-fn-caps">' +
          ownerGroups.map(function (g) { return '<span class="aex-cap-chip" style="border-color:var(--blue);color:var(--blue)">group: ' + escapeHtml(g) + '</span>'; }).join('') +
          ownerAgents.slice(0, 12).map(function (a) { return '<span class="aex-cap-chip" style="border-color:var(--amber);color:var(--amber)">agent: ' + escapeHtml(a) + '</span>'; }).join('') +
        '</div>' +
        (ownerCaps.length
          ? '<div class="aex-detail-row" style="margin-top:8px"><span class="aex-detail-label">Capability IDs</span><span class="aex-detail-val">' + escapeHtml(ownerCaps.slice(0, 10).join(', ')) + (ownerCaps.length > 10 ? ' +' + (ownerCaps.length - 10) : '') + '</span></div>'
          : '') +
      '</div>';
    }

    // Related
    if (reg) {
      var related = reg.getRelated(fn.id) || [];
      if (related.length) {
        html += '<div class="aex-detail-section"><div class="aex-detail-section-title">Relacionadas</div>' +
          related.map(function (r) {
            return '<div class="aex-related-item" onclick="aexShowDetail(\'' + r.id + '\')">' +
              '<span class="aex-method aex-method-' + (r.method || 'GET').toLowerCase() + '" style="font-size:9px;padding:1px 4px">' + escapeHtml(r.method || 'GET') + '</span>' +
              '<span>' + escapeHtml(r.name) + '</span></div>';
          }).join('') + '</div>';
      }
    }

    // Action buttons
    html += '<div style="margin:12px 12px 4px;display:flex;gap:6px">' +
      '<button class="btn btn-sm" style="flex:1;justify-content:center" onclick="aexTestInBrowser(\'' + escapeHtml(fn.id) + '\')" title="Abrir formul&aacute;rio interativo no painel browser">' +
        '<i class="fas fa-flask"></i>&nbsp; Testar' +
      '</button>' +
      '<button class="btn btn-sm" style="flex:1;justify-content:center" onclick="aexAskAbout(\'' + escapeHtml(fn.id) + '\')">' +
        '<i class="fas fa-comment-alt"></i>&nbsp; Perguntar ao agente' +
      '</button>' +
    '</div>';

    return html;
  }

  // ── Diagram ────────────────────────────────────────────────────────────────
  function _loadDiagram() {
    var container = document.getElementById('aexDiagram');
    if (!container || _diagramLoaded) return;

    container.innerHTML =
      '<div style="text-align:center;padding:30px;color:var(--gray)">' +
        '<div class="loading"></div>' +
        '<p style="margin-top:8px;font-size:11px;color:var(--gray)">Carregando diagrama&hellip;</p>' +
      '</div>';

    _aexBuildDiagramText(_diagramMode)
      .then(function (mmdText) {
        _aexRenderDiagramMermaid(container, mmdText);
        _diagramLoaded = true;
      })
      .catch(function (err) {
        container.innerHTML =
          '<div class="aex-empty">' +
            '<i class="fas fa-exclamation-triangle"></i>' +
            'Diagrama n&atilde;o dispon&iacute;vel.<br>' +
            '<span style="font-size:10px">' + escapeHtml(err && err.message) + '</span>' +
          '</div>';
        _aexSetMapStatus('Falha ao carregar mapa.');
      });
  }

  function _aexRenderDiagramMermaid(container, mmdText) {
    container.innerHTML = '';
    var el = document.createElement('div');
    el.className = 'mermaid';
    el.textContent = mmdText;
    container.appendChild(el);

    if (typeof mermaid !== 'undefined') {
      try {
        mermaid.run({ nodes: [el] });
      } catch (_e) {
        mermaid.init(undefined, el);
      }
      return;
    }
    container.innerHTML =
      '<div class="aex-empty">' +
        '<i class="fas fa-project-diagram"></i>' +
        'Mermaid n&atilde;o carregado. Inclua a CDN para renderizar o diagrama.' +
      '</div>' +
      '<pre style="font-size:9px;color:var(--gray);overflow:auto;padding:8px;max-height:400px">' + escapeHtml(mmdText) + '</pre>';
  }

  function _aexFetchText(path) {
    var fetchFn = (typeof window._epOrigFetch !== 'undefined' ? window._epOrigFetch : window.fetch).bind(window);
    var base = (typeof API_BASE !== 'undefined' && API_BASE)
      ? String(API_BASE).replace(/\/$/, '')
      : window.location.origin.replace(/\/$/, '');
    var target = String(path || '');
    if (/^https?:\/\//i.test(target)) {
      // Use absolute URL as-is.
    } else if (target.indexOf('/api/') === 0) {
      target = base + target;
    } else if (target.charAt(0) === '/') {
      target = window.location.origin.replace(/\/$/, '') + target;
    }
    return fetchFn(target).then(function (r) {
      if (!r.ok) throw new Error(path + ' -> HTTP ' + r.status);
      return r.text();
    });
  }

  function _aexTryFetchText(paths) {
    var list = Array.isArray(paths) ? paths.slice() : [paths];
    var i = 0;
    function next(lastErr) {
      if (i >= list.length) return Promise.reject(lastErr || new Error('no-text-source'));
      var p = list[i++];
      return _aexFetchText(p).catch(next);
    }
    return next();
  }

  function _aexNodeId(prefix, raw) {
    return String(prefix || 'n') + '_' + String(raw || 'x').toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 56);
  }

  function _aexNodeLabel(raw) {
    return String(raw || '').replace(/"/g, '\\"');
  }

  function _aexPathGroup(path) {
    var cleaned = String(path || '').trim();
    if (!cleaned) return '(sem rota)';
    var first = cleaned.replace(/^\/+/, '').split('/')[0] || '';
    if (!first) return '(raiz)';
    return '/' + first;
  }

  function _aexBuildMcpMapMermaid(tools, servers) {
    var lines = ['flowchart LR'];
    lines.push('  HUB["VPS MCP Runtime"]');
    var byServer = {};
    (tools || []).forEach(function (tool) {
      var sid = _aexToolServer(tool);
      if (!byServer[sid]) byServer[sid] = [];
      byServer[sid].push(tool);
    });

    var serverOrder = (servers || []).map(function (s) { return _aexServerName(s); });
    Object.keys(byServer).forEach(function (sid) {
      if (serverOrder.indexOf(sid) < 0) serverOrder.push(sid);
    });

    serverOrder.forEach(function (sid) {
      if (!sid) return;
      var sidNode = _aexNodeId('srv', sid);
      var srvTools = byServer[sid] || [];
      var groupCounts = {};
      srvTools.forEach(function (tool) {
        var grp = _aexPathGroup(_aexToolPath(tool));
        groupCounts[grp] = (groupCounts[grp] || 0) + 1;
      });
      var topGroups = Object.keys(groupCounts)
        .sort(function (a, b) { return groupCounts[b] - groupCounts[a]; })
        .slice(0, 12);

      lines.push('  ' + sidNode + '["' + _aexNodeLabel(sid) + ' (' + srvTools.length + ' tools)"]');
      lines.push('  HUB --> ' + sidNode);
      topGroups.forEach(function (grp) {
        var gNode = _aexNodeId(sidNode + '_g', grp);
        lines.push('  ' + gNode + '["' + _aexNodeLabel(grp) + ' (' + groupCounts[grp] + ')"]');
        lines.push('  ' + sidNode + ' --> ' + gNode);
      });
    });

    if (!serverOrder.length) {
      lines.push('  HUB --> EMPTY["Nenhum servidor MCP ativo"]');
    }
    return lines.join('\n');
  }

  function _aexBuildCombinedMapMermaid(functions, tools, servers) {
    var lines = ['flowchart LR'];
    lines.push('  ROOT["LA8159 API + VPS MCP"]');
    lines.push('  FN["Functions Catalog (' + functions.length + ')"]');
    lines.push('  MCP["VPS MCP Tools (' + tools.length + ')"]');
    lines.push('  ROOT --> FN');
    lines.push('  ROOT --> MCP');

    var fnByGroup = {};
    (functions || []).forEach(function (fn) {
      var p = String(fn.urlTemplate || fn.resolvedUrl || '').replace(/^https?:\/\/[^/]+/, '');
      var grp = _aexPathGroup(p);
      fnByGroup[grp] = (fnByGroup[grp] || 0) + 1;
    });
    Object.keys(fnByGroup)
      .sort(function (a, b) { return fnByGroup[b] - fnByGroup[a]; })
      .slice(0, 10)
      .forEach(function (grp) {
        var id = _aexNodeId('fn_g', grp);
        lines.push('  ' + id + '["' + _aexNodeLabel(grp) + ' (' + fnByGroup[grp] + ')"]');
        lines.push('  FN --> ' + id);
      });

    var byServer = {};
    (tools || []).forEach(function (tool) {
      var sid = _aexToolServer(tool);
      if (!byServer[sid]) byServer[sid] = 0;
      byServer[sid] += 1;
    });
    var serverOrder = (servers || []).map(function (s) { return _aexServerName(s); });
    Object.keys(byServer).forEach(function (sid) {
      if (serverOrder.indexOf(sid) < 0) serverOrder.push(sid);
    });
    serverOrder.slice(0, 6).forEach(function (sid) {
      if (!sid) return;
      var id = _aexNodeId('mcp_srv', sid);
      lines.push('  ' + id + '["' + _aexNodeLabel(sid) + ' (' + (byServer[sid] || 0) + ')"]');
      lines.push('  MCP --> ' + id);
    });

    return lines.join('\n');
  }

  function _aexBuildOwnershipMapMermaid(functions) {
    var lines = ['flowchart LR'];
    lines.push('  ROOT["Functions Ownership"]');

    var reg = _reg();
    var labels = (reg && reg.registry && reg.registry.architecture && reg.registry.architecture.groupLabels)
      ? reg.registry.architecture.groupLabels
      : {};

    var groupCounts = {};
    var unowned = 0;
    (functions || []).forEach(function(fn) {
      var groups = Array.isArray(fn.ownerGroups) ? fn.ownerGroups : [];
      if (!groups.length) {
        unowned += 1;
        return;
      }
      groups.forEach(function(group) {
        groupCounts[group] = (groupCounts[group] || 0) + 1;
      });
    });

    Object.keys(groupCounts)
      .sort(function(a, b) { return groupCounts[b] - groupCounts[a]; })
      .slice(0, 16)
      .forEach(function(group) {
        var id = _aexNodeId('own_g', group);
        var label = labels[group] || group;
        lines.push('  ' + id + '["' + _aexNodeLabel(label) + ' (' + groupCounts[group] + ')"]');
        lines.push('  ROOT --> ' + id);
      });

    if (unowned > 0) {
      lines.push('  OWN_NONE["Sem owner (' + unowned + ')"]');
      lines.push('  ROOT --> OWN_NONE');
    }

    if (!Object.keys(groupCounts).length && !unowned) {
      lines.push('  EMPTY["Ownership indisponível"]');
      lines.push('  ROOT --> EMPTY');
    }

    return lines.join('\n');
  }

  function _aexBuildDiagramText(mode) {
    var currentMode = _aexNormalizeDiagramMode(mode);
    if (currentMode === 'functions') {
      _aexSetMapStatus('Mapa de funções do catálogo local.');
      return _aexTryFetchText(['/api/functions/diagram', '/agents/functions/diagram.mmd', 'olivialegal_functions_mapping/diagram.mmd']);
    }

    if (currentMode === 'owners') {
      _aexSetMapStatus('Mapa de ownership por grupos e capacidades atribuídas.');
      return Promise.resolve(_aexBuildOwnershipMapMermaid(_allFunctions()));
    }

    _aexSetMapStatus(currentMode === 'mcp-vps'
      ? 'Mapa de capacidades VPS MCP (agrupado por rotas).'
      : 'Mapa combinado entre funções locais e VPS MCP.');

    return Promise.all([
      _aexTryFetchJson(['/api/mcp/servers']),
      _aexTryFetchJson(['/api/mcp/tools?limit=1000'])
    ]).then(function (parts) {
      var servers = _aexList(parts[0], 'servers').map(function (s) {
        if (!s || typeof s !== 'object') return {};
        if (s.id || s.service) return s;
        return {
          id: s.name || 'unknown',
          service: s.name || 'unknown',
          name: s.name || 'unknown'
        };
      });
      var tools = _aexList(parts[1], 'tools');
      if (currentMode === 'mcp-vps') {
        return _aexBuildMcpMapMermaid(tools, servers);
      }
      return _aexBuildCombinedMapMermaid(_allFunctions(), tools, servers);
    });
  }

  function _aexSetDiagramMode(mode, options) {
    var opts = options || {};
    _diagramMode = _aexNormalizeDiagramMode(mode);
    _aexApplyDiagramModeControl();
    if (opts.persist !== false) {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(_diagramModeStorageKey, _diagramMode);
        }
      } catch (_e) {}
    }
    _aexReloadDiagram();
  }

  // ── MCP inventory ─────────────────────────────────────────────────────────
  var _mcpSummary = {};
  var _mcpServers = [];
  var _mcpTools = [];
  var _mcpVisibleTools = [];
  var _mcpSelected = null;
  var _mcpExecBusy = false;
  var _mcpPage = 1;
  var _mcpPageSize = 50;
  var _mcpNavBound = false;
  var _mcpFilterDebounceTimer = null;
  var _mcpViewMode = 'list';
  var _mcpViewModeStorageKey = 'OliviaLegal.aex.mcp.view_mode';
  var _mcpHideStaleStorageKey = 'OliviaLegal.aex.mcp.hide_stale';

  function _aexMcpNormalizeViewMode(mode) {
    return String(mode || '').toLowerCase() === 'table' ? 'table' : 'list';
  }

  function _aexMcpReadViewMode() {
    try {
      if (typeof localStorage !== 'undefined') {
        return _aexMcpNormalizeViewMode(localStorage.getItem(_mcpViewModeStorageKey));
      }
    } catch (_e) {}
    return 'list';
  }

  function _aexMcpApplyViewMode() {
    var workspace = document.getElementById('aexMcpWorkspace');
    var tableWrap = document.getElementById('aexMcpTableWrap');
    var listWrap = workspace ? workspace.querySelector('.aex-mcp-list-wrap') : null;
    var detailWrap = workspace ? workspace.querySelector('.aex-mcp-detail-wrap') : null;
    var listBtn = document.getElementById('aexMcpModeListBtn');
    var tableBtn = document.getElementById('aexMcpModeTableBtn');
    var isTable = _mcpViewMode === 'table';

    if (workspace) workspace.classList.toggle('is-table-mode', isTable);
    if (tableWrap) tableWrap.hidden = !isTable;
    if (listWrap) listWrap.hidden = isTable;
    if (detailWrap) detailWrap.hidden = isTable;

    if (listBtn) {
      listBtn.classList.toggle('is-active', !isTable);
      listBtn.setAttribute('aria-pressed', (!isTable) ? 'true' : 'false');
    }
    if (tableBtn) {
      tableBtn.classList.toggle('is-active', isTable);
      tableBtn.setAttribute('aria-pressed', isTable ? 'true' : 'false');
    }
  }

  function _aexSetMcpViewMode(mode, options) {
    var opts = options || {};
    _mcpViewMode = _aexMcpNormalizeViewMode(mode);
    if (opts.persist !== false) {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(_mcpViewModeStorageKey, _mcpViewMode);
        }
      } catch (_e) {}
    }
    _aexMcpApplyViewMode();
    _aexMcpRenderToolsTable();
    _aexMcpRenderExecPanel();
  }

  _mcpViewMode = _aexMcpReadViewMode();

  function _aexFetchJson(path, options) {
    var fetchFn = (typeof window._epOrigFetch !== 'undefined' ? window._epOrigFetch : window.fetch).bind(window);
    var base = (typeof API_BASE !== 'undefined' && API_BASE)
      ? String(API_BASE).replace(/\/$/, '')
      : window.location.origin.replace(/\/$/, '');
    var target = base + path;
    return fetchFn(target, options || {}).then(function (r) {
      return r.text().then(function (text) {
        var data = {};
        try { data = JSON.parse(text || '{}'); } catch (_e) { data = {}; }
        if (!r.ok) {
          var err = new Error(path + ' -> HTTP ' + r.status);
          err.status = r.status;
          err.payload = data;
          throw err;
        }
        return data;
      });
    });
  }

  function _aexPostJson(path, payload) {
    var fetchFn = (typeof window._epOrigFetch !== 'undefined' ? window._epOrigFetch : window.fetch).bind(window);
    var base = (typeof API_BASE !== 'undefined' && API_BASE)
      ? String(API_BASE).replace(/\/$/, '')
      : window.location.origin.replace(/\/$/, '');
    var target = base + path;
    return fetchFn(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {})
    }).then(function (r) {
      return r.text().then(function (text) {
        var data = {};
        try { data = JSON.parse(text || '{}'); } catch (_e) { data = {}; }
        return { ok: r.ok, status: r.status, data: data };
      });
    });
  }

  function _aexTryFetchJson(paths) {
    var i = 0;
    function next(lastErr) {
      if (i >= paths.length) return Promise.reject(lastErr || new Error('no-endpoint'));
      var p = paths[i++];
      return _aexFetchJson(p).catch(next);
    }
    return next();
  }

  function _aexList(payload, key) {
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload[key])) return payload[key];
    return [];
  }

  function _aexNum(v, fallback) {
    var n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function _aexToolName(tool) {
    return tool.tool_name || tool.name || tool.id || 'unknown';
  }

  function _aexToolServer(tool) {
    return tool.server_id || tool.server || tool.service || tool.command_id || 'n/a';
  }

  function _aexToolSource(tool) {
    if (tool.source) return tool.source;
    if (tool.source_file) {
      var parts = String(tool.source_file).split('/');
      return parts[parts.length - 1] || tool.source_file;
    }
    return 'n/a';
  }

  function _aexToolMethod(tool) {
    var m = String(tool.method || tool.http_method || '').toUpperCase();
    if (m) return m;
    var desc = String(tool.description || '');
    var match = desc.match(/\[(GET|POST|PUT|PATCH|DELETE)\s+[^\]]+\]/i);
    return match ? String(match[1] || '').toUpperCase() : '';
  }

  function _aexToolPath(tool) {
    var p = String(tool.path || tool.endpoint || tool.endpoint_path || '').trim();
    if (p) return p;
    var desc = String(tool.description || '');
    var match = desc.match(/\[(GET|POST|PUT|PATCH|DELETE)\s+([^\]]+)\]/i);
    return match ? String(match[2] || '').trim() : '';
  }

  function _aexToolSchema(tool) {
    var schema = tool.input_schema || tool.inputSchema || tool.schema || {};
    return schema && typeof schema === 'object' ? schema : {};
  }

  function _aexToolKey(tool) {
    return _aexToolServer(tool) + '::' + _aexToolName(tool);
  }

  function _aexServerName(server) {
    return server.id || server.service || server.name || 'unknown';
  }

  function _aexMcpPopulateServerFilter() {
    var sel = document.getElementById('aexMcpServerFilter');
    if (!sel) return;
    var current = sel.value || '';
    var options = _mcpServers.map(function (s) {
      var sid = _aexServerName(s);
      return '<option value="' + escapeHtml(sid) + '">' + escapeHtml(sid) + '</option>';
    }).join('');
    sel.innerHTML = '<option value="">Todos os servidores</option>' + options;
    sel.value = current;
  }

  function _aexMcpReadHideStale() {
    try {
      if (typeof localStorage === 'undefined') return false;
      return String(localStorage.getItem(_mcpHideStaleStorageKey) || '').toLowerCase() === 'true';
    } catch (_e) {
      return false;
    }
  }

  function _aexMcpPersistHideStale(v) {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(_mcpHideStaleStorageKey, v ? 'true' : 'false');
    } catch (_e) {}
  }

  function _aexMcpServiceToken(tool) {
    var path = String(_aexToolPath(tool) || '').toLowerCase();
    var q = path.indexOf('?');
    if (q >= 0) path = path.slice(0, q);
    var first = path.replace(/^\/+/, '').split('/')[0] || '';
    if (!first) return '';
    if (first === 'api') {
      var second = path.replace(/^\/+/, '').split('/')[1] || '';
      return second || 'api';
    }
    return first;
  }

  function _aexMcpStaleReason(tool) {
    var serverId = String(_aexToolServer(tool) || '').trim();
    var server = (_mcpServers || []).find(function (s) {
      return _aexServerName(s) === serverId;
    });
    if (server && server.available === false && String(server.status || '').toLowerCase() !== 'configured') {
      return 'servidor indisponível';
    }

    var path = String(_aexToolPath(tool) || '').toLowerCase();
    var token = _aexMcpServiceToken(tool);
    if (!token) return '';

    if (/\/api\/metrics\b/.test(path)) return 'serviço metrics não publicado';

    var name = String(_aexToolName(tool) || '').toLowerCase();
    if (name.indexOf('metrics') >= 0 && path.indexOf('/api/ops/system') < 0 && path.indexOf('/api/steps/cost') < 0) {
      return 'métrica fora do escopo atual';
    }

    return '';
  }

  function _aexMcpIsLikelyStale(tool) {
    return !!_aexMcpStaleReason(tool);
  }

  function _aexMcpFilteredTools() {
    var q = ((document.getElementById('aexMcpToolSearch') || {}).value || '').trim().toLowerCase();
    var serverFilter = ((document.getElementById('aexMcpServerFilter') || {}).value || '').trim().toLowerCase();
    var hideStaleEl = document.getElementById('aexMcpHideStale');
    var hideStale = !!(hideStaleEl && hideStaleEl.checked);
    _aexMcpPersistHideStale(hideStale);
    return (_mcpTools || []).filter(function (tool) {
      if (serverFilter && String(_aexToolServer(tool) || '').toLowerCase() !== serverFilter) {
        return false;
      }
      if (hideStale && _aexMcpIsLikelyStale(tool)) {
        return false;
      }
      if (!q) return true;
      var haystack = [
        _aexToolName(tool),
        _aexToolServer(tool),
        _aexToolSource(tool),
        _aexToolMethod(tool),
        _aexToolPath(tool),
        _aexMcpStaleReason(tool),
        tool.description || ''
      ].join(' ').toLowerCase();
      return haystack.indexOf(q) >= 0;
    });
  }

  function _aexMcpRenderToolsTable() {
    var toolsList = document.getElementById('aexMcpToolsList');
    var toolsTbody = document.getElementById('aexMcpToolsTbody');
    var metaEl = document.getElementById('aexMcpToolsMeta');
    var pageInfoEl = document.getElementById('aexMcpPageInfo');
    var prevBtn = document.getElementById('aexMcpPrevBtn');
    var nextBtn = document.getElementById('aexMcpNextBtn');
    if (!toolsList && !toolsTbody) return;

    var filtered = _aexMcpFilteredTools();
    var totalFiltered = filtered.length;
    var totalPages = Math.max(1, Math.ceil(totalFiltered / _mcpPageSize));
    if (_mcpPage > totalPages) _mcpPage = totalPages;
    if (_mcpPage < 1) _mcpPage = 1;
    var start = (_mcpPage - 1) * _mcpPageSize;
    var end = Math.min(totalFiltered, start + _mcpPageSize);

    if (metaEl) {
      if (!totalFiltered) {
        metaEl.textContent = 'Exibindo 0/0 tools';
      } else {
        metaEl.textContent = 'Exibindo ' + (start + 1) + '-' + end + ' de ' + totalFiltered + ' tools';
      }
    }
    if (pageInfoEl) pageInfoEl.textContent = 'Pág. ' + _mcpPage + '/' + totalPages;
    if (prevBtn) prevBtn.disabled = _mcpPage <= 1;
    if (nextBtn) nextBtn.disabled = _mcpPage >= totalPages;

    if (!filtered.length) {
      if (toolsList) {
        toolsList.innerHTML = '<div class="aex-mcp-empty">Nenhuma tool MCP corresponde aos filtros.</div>';
      }
      if (toolsTbody) {
        toolsTbody.innerHTML = '<tr><td colspan="6" class="aex-mcp-empty">Nenhuma tool MCP corresponde aos filtros.</td></tr>';
      }
      _mcpVisibleTools = [];
      return;
    }

    var sample = filtered.slice(start, end);
    _mcpVisibleTools = sample.slice();
    if (toolsList) {
      toolsList.innerHTML = sample.map(function (t, idx) {
        var toolName = _aexToolName(t);
        var serverId = _aexToolServer(t);
        var source = _aexToolSource(t);
        var method = _aexToolMethod(t);
        var path = _aexToolPath(t);
        var staleReason = _aexMcpStaleReason(t);
        var staleChip = staleReason
          ? ('<span class="aex-mcp-stale-chip" title="' + escapeHtml(staleReason) + '"><i class="fas fa-exclamation-triangle"></i> provável stale</span>')
          : '';
        var endpointLabel = method && path ? (method + ' ' + path) : (path || '-');
        var methodClass = method ? ('aex-method aex-method-' + method.toLowerCase()) : '';
        var key = _aexToolKey(t);
        var selectedClass = (_mcpSelected && _mcpSelected.key === key) ? ' is-selected' : '';
        return '<div class="aex-mcp-tool-card' + selectedClass + '" data-tool-key="' + escapeHtml(key) + '" onclick="_aexPrepareMcpToolByIndex(' + idx + ')" tabindex="0" onkeydown="if(event.key===\'Enter\'){event.preventDefault();_aexPrepareMcpToolByIndex(' + idx + ');}">' +
          '<div class="aex-mcp-tool-top">' +
            '<code class="aex-mcp-tool-name">' + escapeHtml(toolName) + '</code>' +
            '<span class="aex-mcp-chip">' + escapeHtml(serverId) + '</span>' +
          '</div>' +
          '<div class="aex-mcp-tool-row">' +
            (method ? ('<span class="' + methodClass + '">' + escapeHtml(method) + '</span>') : '<span class="aex-mcp-chip warn">n/a</span>') +
            '<code class="aex-mcp-tool-endpoint">' + escapeHtml(endpointLabel) + '</code>' +
          '</div>' +
          '<div class="aex-mcp-tool-foot">' +
            '<span class="aex-mcp-tool-source">' + escapeHtml(source) + '</span>' +
            staleChip +
            '<button class="btn btn-sm aex-mcp-action" onclick="event.stopPropagation();_aexPrepareMcpToolByIndex(' + idx + ')"><i class="fas fa-flask"></i> Testar</button>' +
          '</div>' +
        '</div>';
      }).join('');
    }

    if (toolsTbody) {
      toolsTbody.innerHTML = sample.map(function (t, idx) {
        var toolName = _aexToolName(t);
        var serverId = _aexToolServer(t);
        var source = _aexToolSource(t);
        var method = _aexToolMethod(t);
        var path = _aexToolPath(t);
        var staleReason = _aexMcpStaleReason(t);
        var staleClass = staleReason ? ' aex-mcp-row-stale' : '';
        var endpointLabel = method && path ? (method + ' ' + path) : (path || '-');
        var methodClass = method ? ('aex-method aex-method-' + method.toLowerCase()) : '';
        var key = _aexToolKey(t);
        var selectedClass = (_mcpSelected && _mcpSelected.key === key) ? ' class="aex-mcp-row-selected"' : '';
        var trClass = '';
        if (selectedClass) {
          trClass = selectedClass.replace(' class="', '').replace('"', '');
        }
        if (staleClass) {
          trClass = (trClass ? (trClass + ' ') : '') + staleClass.trim();
        }
        var classAttr = trClass ? (' class="' + trClass + '"') : '';
        return '<tr data-tool-key="' + escapeHtml(key) + '"' + classAttr + ' onclick="_aexPrepareMcpToolByIndex(' + idx + ')" tabindex="0" onkeydown="if(event.key===\'Enter\'){event.preventDefault();_aexPrepareMcpToolByIndex(' + idx + ');}">' +
          '<td><code>' + escapeHtml(toolName) + '</code>' + (staleReason ? ('<div class="aex-mcp-error" style="margin-top:3px">⚠ ' + escapeHtml(staleReason) + '</div>') : '') + '</td>' +
          '<td>' + escapeHtml(serverId) + '</td>' +
          '<td>' + (method ? ('<span class="' + methodClass + '">' + escapeHtml(method) + '</span>') : '<span class="aex-mcp-chip warn">n/a</span>') + '</td>' +
          '<td><code>' + escapeHtml(endpointLabel) + '</code></td>' +
          '<td>' + escapeHtml(source) + '</td>' +
          '<td><button class="btn btn-sm aex-mcp-action" onclick="event.stopPropagation();_aexMcpOpenToolFromTable(' + idx + ')"><i class="fas fa-flask"></i> Testar</button></td>' +
        '</tr>';
      }).join('');
    }
  }

  function _aexPrepareMcpToolByIndex(index) {
    var idx = Number(index);
    if (!Number.isFinite(idx) || idx < 0) return;
    var tool = (_mcpVisibleTools || [])[idx];
    if (!tool) return;
    _aexPrepareMcpTool(_aexToolServer(tool), _aexToolName(tool));
  }

  function _aexMcpOpenToolFromTable(index) {
    _aexPrepareMcpToolByIndex(index);
    _aexSetMcpViewMode('list');
  }

  function _aexMcpDefaultArgs(tool) {
    var schema = _aexToolSchema(tool);
    var properties = (schema && schema.properties && typeof schema.properties === 'object') ? schema.properties : {};
    var required = Array.isArray(schema.required) ? schema.required.slice() : [];
    var out = {};

    Object.keys(properties).forEach(function (name) {
      var spec = properties[name] || {};
      var t = String(spec.type || '').toLowerCase();
      if (required.indexOf(name) === -1) return;
      if (t === 'integer' || t === 'number') out[name] = 0;
      else if (t === 'boolean') out[name] = false;
      else if (t === 'array') out[name] = [];
      else if (t === 'object') out[name] = {};
      else out[name] = '';
    });

    var path = _aexToolPath(tool);
    var matches = path.match(/\{([^}]+)\}/g) || [];
    matches.forEach(function (raw) {
      var key = raw.replace(/[{}]/g, '');
      if (!Object.prototype.hasOwnProperty.call(out, key)) out[key] = '';
    });

    if (!Object.keys(out).length && /^(POST|PUT|PATCH)$/i.test(_aexToolMethod(tool))) {
      out.body = {};
    }
    return out;
  }

  function _aexMcpRenderExecPanel() {
    var panel = document.getElementById('aexMcpToolExecPanel');
    var emptyEl = document.getElementById('aexMcpToolEmpty');
    var nameEl = document.getElementById('aexMcpToolName');
    var routeEl = document.getElementById('aexMcpToolRoute');
    var argsEl = document.getElementById('aexMcpToolArgs');
    var resultEl = document.getElementById('aexMcpExecResult');
    var statusEl = document.getElementById('aexMcpExecStatus');
    if (!panel || !nameEl || !routeEl || !argsEl || !resultEl || !statusEl) return;

    if (!_mcpSelected || !_mcpSelected.tool) {
      panel.hidden = true;
      if (emptyEl) emptyEl.hidden = false;
      return;
    }

    panel.hidden = false;
    if (emptyEl) emptyEl.hidden = true;
    nameEl.textContent = _mcpSelected.toolName + ' @ ' + _mcpSelected.serverId;
    var method = _aexToolMethod(_mcpSelected.tool);
    var path = _aexToolPath(_mcpSelected.tool);
    routeEl.textContent = method && path ? (method + ' ' + path) : (path || 'Tool sem mapeamento HTTP explícito.');
    if (!argsEl.value || argsEl.dataset.toolKey !== _mcpSelected.key) {
      argsEl.value = JSON.stringify(_aexMcpDefaultArgs(_mcpSelected.tool), null, 2);
      argsEl.dataset.toolKey = _mcpSelected.key;
      resultEl.textContent = '';
      statusEl.textContent = 'Pronto para executar.';
      statusEl.classList.remove('is-error', 'is-ok');
    }
  }

  function _aexPrepareMcpTool(serverId, toolName) {
    var selected = (_mcpTools || []).find(function (tool) {
      return _aexToolServer(tool) === serverId && _aexToolName(tool) === toolName;
    });
    if (!selected) return;
    _mcpSelected = {
      key: _aexToolKey(selected),
      serverId: serverId,
      toolName: toolName,
      tool: selected
    };
    _aexMcpRenderToolsTable();
    _aexMcpRenderExecPanel();
  }

  function _aexFilterMcpTools() {
    _mcpPage = 1;
    if (_mcpFilterDebounceTimer) {
      clearTimeout(_mcpFilterDebounceTimer);
    }
    _mcpFilterDebounceTimer = setTimeout(function () {
      _mcpFilterDebounceTimer = null;
      _aexMcpRenderToolsTable();
    }, 90);
  }

  function _aexMcpPrevPage() {
    if (_mcpPage <= 1) return;
    _mcpPage -= 1;
    _aexMcpRenderToolsTable();
  }

  function _aexMcpNextPage() {
    var filtered = _aexMcpFilteredTools();
    var totalPages = Math.max(1, Math.ceil(filtered.length / _mcpPageSize));
    if (_mcpPage >= totalPages) return;
    _mcpPage += 1;
    _aexMcpRenderToolsTable();
  }

  function _aexMcpIsActive() {
    var view = document.querySelector('.aex-view[data-view="mcp"]');
    return !!(view && view.classList.contains('active'));
  }

  function _aexMcpMoveSelection(step) {
    if (!_mcpVisibleTools.length) return;
    var currentIdx = -1;
    if (_mcpSelected && _mcpSelected.key) {
      currentIdx = _mcpVisibleTools.findIndex(function (t) {
        return _aexToolKey(t) === _mcpSelected.key;
      });
    }
    if (currentIdx < 0) currentIdx = 0;
    var nextIdx = Math.max(0, Math.min(_mcpVisibleTools.length - 1, currentIdx + step));
    _aexPrepareMcpToolByIndex(nextIdx);

    var selectedEl = (_mcpViewMode === 'table')
      ? document.querySelector('#aexMcpToolsTbody tr.aex-mcp-row-selected')
      : document.querySelector('#aexMcpToolsList .aex-mcp-tool-card.is-selected');
    if (selectedEl && typeof selectedEl.scrollIntoView === 'function') {
      selectedEl.scrollIntoView({ block: 'nearest' });
    }
  }

  function _aexBindMcpNavigation() {
    if (_mcpNavBound) return;
    _mcpNavBound = true;

    document.addEventListener('keydown', function (ev) {
      if (!_aexMcpIsActive()) return;
      var target = ev.target;
      if (target && target.closest && target.closest('input,textarea,select,[contenteditable="true"]')) {
        return;
      }
      if (ev.key === 'ArrowDown') {
        ev.preventDefault();
        _aexMcpMoveSelection(1);
        return;
      }
      if (ev.key === 'ArrowUp') {
        ev.preventDefault();
        _aexMcpMoveSelection(-1);
        return;
      }
      if (ev.key === 'PageDown') {
        ev.preventDefault();
        _aexMcpNextPage();
        return;
      }
      if (ev.key === 'PageUp') {
        ev.preventDefault();
        _aexMcpPrevPage();
        return;
      }
      if (ev.key === 'Enter' && _mcpSelected && !_mcpExecBusy) {
        ev.preventDefault();
        _aexExecuteMcpTool();
      }
    });

  }

  function _aexExecuteMcpTool() {
    if (_mcpExecBusy || !_mcpSelected) return;
    var argsEl = document.getElementById('aexMcpToolArgs');
    var statusEl = document.getElementById('aexMcpExecStatus');
    var resultEl = document.getElementById('aexMcpExecResult');
    var runBtn = document.getElementById('aexMcpExecBtn');
    if (!argsEl || !statusEl || !resultEl || !runBtn) return;

    var args = {};
    try {
      args = JSON.parse(argsEl.value || '{}');
      if (!args || typeof args !== 'object' || Array.isArray(args)) {
        throw new Error('argumentos devem ser objeto JSON');
      }
    } catch (e) {
      statusEl.textContent = 'JSON inválido: ' + (e && e.message ? e.message : 'erro de parse');
      statusEl.classList.add('is-error');
      statusEl.classList.remove('is-ok');
      return;
    }

    _mcpExecBusy = true;
    runBtn.disabled = true;
    statusEl.textContent = 'Executando tool...';
    statusEl.classList.remove('is-error', 'is-ok');

    _aexPostJson('/api/mcp/tools/execute', {
      server_id: _mcpSelected.serverId,
      tool_name: _mcpSelected.toolName,
      arguments: args
    }).then(function (resp) {
      var payload = resp && resp.data ? resp.data : {};
      resultEl.textContent = _aexSafePrettyJson(payload, 140000);
      if (resp.ok && payload.ok !== false) {
        statusEl.textContent = 'Execução concluída com sucesso.';
        statusEl.classList.add('is-ok');
        statusEl.classList.remove('is-error');
      } else {
        var decoded = _aexMcpDecodedFailure(payload);
        if (decoded.unknownService) {
          statusEl.textContent = 'Tool indisponível no gateway atual: serviço "' + decoded.unknownService + '" não está publicado.' + _aexMcpAltToolHint(_mcpSelected && _mcpSelected.toolName);
        } else if (decoded.status || decoded.reason) {
          statusEl.textContent = 'Falha na execução (HTTP ' + resp.status + ' → upstream ' + (decoded.status || '?') + ' ' + (decoded.reason || '').trim() + ').';
        } else {
          statusEl.textContent = 'Falha na execução (HTTP ' + resp.status + ').';
        }
        statusEl.classList.add('is-error');
        statusEl.classList.remove('is-ok');
      }
    }).catch(function (err) {
      statusEl.textContent = 'Erro ao executar: ' + (err && err.message ? err.message : 'falha desconhecida');
      statusEl.classList.add('is-error');
      statusEl.classList.remove('is-ok');
      resultEl.textContent = '';
    }).finally(function () {
      _mcpExecBusy = false;
      runBtn.disabled = false;
    });
  }

  function _aexSafePrettyJson(value, maxChars) {
    var limit = Number(maxChars || 0) > 0 ? Number(maxChars) : 120000;
    var text = '';
    try {
      text = JSON.stringify(value, null, 2);
    } catch (_e) {
      text = String(value || '');
    }
    if (text.length <= limit) return text;
    return text.slice(0, limit) + '\n\n... [truncated ' + (text.length - limit) + ' chars for UI responsiveness]';
  }

  function _aexMcpDecodedFailure(payload) {
    var parsed = payload && payload.parsed && typeof payload.parsed === 'object' ? payload.parsed : null;
    var detail = '';
    if (parsed && typeof parsed.body === 'string') {
      try {
        var bodyObj = JSON.parse(parsed.body);
        if (bodyObj && typeof bodyObj.detail === 'string') detail = bodyObj.detail;
      } catch (_e) {
        detail = parsed.body;
      }
    }

    var unknownService = null;
    if (detail) {
      var m = detail.match(/Unknown service:\s*([^\.\n]+)/i);
      if (m && m[1]) unknownService = String(m[1]).trim();
    }

    return {
      status: parsed && parsed.status ? Number(parsed.status) : null,
      reason: parsed && parsed.reason ? String(parsed.reason) : '',
      unknownService: unknownService
    };
  }

  function _aexMcpAltToolHint(selectedToolName) {
    var current = String(selectedToolName || '').toLowerCase();
    if (!current) return '';

    if (current.indexOf('metrics') >= 0) {
      var metricAlt = (_mcpTools || []).find(function (t) {
        var nm = String(_aexToolName(t) || '').toLowerCase();
        var path = String(_aexToolPath(t) || '').toLowerCase();
        return nm.indexOf('system_metrics') >= 0 || path === '/api/ops/system';
      });
      if (metricAlt) {
        return ' Tente: ' + _aexToolName(metricAlt) + ' (' + (_aexToolMethod(metricAlt) || 'GET') + ' ' + (_aexToolPath(metricAlt) || '-') + ').';
      }
    }
    return '';
  }

  function _aexClearMcpResult() {
    var resultEl = document.getElementById('aexMcpExecResult');
    var statusEl = document.getElementById('aexMcpExecStatus');
    if (resultEl) resultEl.textContent = '';
    if (statusEl) {
      statusEl.textContent = 'Pronto para executar.';
      statusEl.classList.remove('is-error', 'is-ok');
    }
  }

  function _aexRenderMcp(summary, servers, tools, options) {
    var opts = options || {};
    var statusEl = document.getElementById('aexMcpStatus');
    var serverCountEl = document.getElementById('aexMcpServerCount');
    var toolCountEl = document.getElementById('aexMcpToolCount');
    var requiredReadyEl = document.getElementById('aexMcpRequiredReady');
    var availableCountEl = document.getElementById('aexMcpAvailableCount');
    var serversTbody = document.getElementById('aexMcpServersTbody');
    if (!statusEl || !serverCountEl || !toolCountEl || !requiredReadyEl || !availableCountEl || !serversTbody) return;

    _mcpSummary = summary || {};
    _mcpServers = servers || [];
    _mcpTools = tools || [];
    if (_mcpPage < 1) _mcpPage = 1;
    if (_mcpSelected) {
      var stillExists = _mcpTools.some(function (tool) {
        return _aexToolKey(tool) === _mcpSelected.key;
      });
      if (!stillExists) _mcpSelected = null;
    }

    var serverCount = _aexNum(summary && summary.server_count, _mcpServers.length);
    var toolCount = _aexNum(summary && summary.total_tools, _mcpTools.length);
    var requiredReady = _aexNum(
      summary && summary.required_server_available_count,
      _mcpServers.filter(function (s) { return s.required && s.available; }).length
    );
    var availableCount = _aexNum(
      summary && summary.server_available_count,
      _mcpServers.filter(function (s) { return s.available || s.status === 'configured'; }).length
    );

    serverCountEl.textContent = String(serverCount);
    toolCountEl.textContent = String(toolCount);
    requiredReadyEl.textContent = String(requiredReady);
    availableCountEl.textContent = String(availableCount);

    var scopeLabel = '';
    if (_mcpServers.length === 1) {
      scopeLabel = ' Escopo ativo: ' + _aexServerName(_mcpServers[0]) + '.';
    } else if (_mcpServers.length > 1) {
      scopeLabel = ' Escopo ativo: ' + _mcpServers.length + ' servidores MCP.';
    }
    if (opts.partial) {
      statusEl.textContent = 'Inventário parcial: algumas fontes MCP não responderam.' + scopeLabel;
    } else {
      statusEl.textContent = 'Inventário MCP carregado e pronto para teste interativo.' + scopeLabel;
    }

    if (!_mcpServers.length) {
      serversTbody.innerHTML = '<tr><td colspan="5" class="aex-mcp-empty">Nenhum servidor MCP encontrado.</td></tr>';
    } else {
      serversTbody.innerHTML = _mcpServers.map(function (s) {
        var name = escapeHtml(_aexServerName(s));
        var toolsCount = (s.tool_count != null && s.tool_count !== '') ? escapeHtml(s.tool_count) : '-';
        var isAvailable = (s.available === true) || (s.status === 'configured');
        var statusChip = isAvailable
          ? '<span class="aex-mcp-chip ok">ready</span>'
          : '<span class="aex-mcp-chip warn">down</span>';
        var requiredChip = (s.required === true)
          ? '<span class="aex-mcp-chip">yes</span>'
          : '<span class="aex-mcp-chip">no</span>';
        var error = s.error ? '<span class="aex-mcp-error">' + escapeHtml(s.error) + '</span>' : '<span style="color:var(--gray)">-</span>';
        return '<tr>' +
          '<td><strong>' + name + '</strong></td>' +
          '<td>' + toolsCount + '</td>' +
          '<td>' + statusChip + '</td>' +
          '<td>' + requiredChip + '</td>' +
          '<td>' + error + '</td>' +
        '</tr>';
      }).join('');
    }

    _aexMcpPopulateServerFilter();
    var hideStaleEl = document.getElementById('aexMcpHideStale');
    if (hideStaleEl) hideStaleEl.checked = _aexMcpReadHideStale();
    _aexMcpRenderToolsTable();
    _aexMcpRenderExecPanel();
  }

  function _loadMcpInventory(forceReload) {
    if (_mcpLoaded && !forceReload) return;

    var statusEl = document.getElementById('aexMcpStatus');
    var serversTbody = document.getElementById('aexMcpServersTbody');
    var toolsList = document.getElementById('aexMcpToolsList');
    var toolsTbody = document.getElementById('aexMcpToolsTbody');
    _aexBindMcpNavigation();
    _aexMcpApplyViewMode();
    var refreshSuffix = forceReload ? '?refresh=1' : '';
    var toolsSuffix = forceReload ? '?limit=1000&refresh=1' : '?limit=1000';
    if (statusEl) statusEl.textContent = 'Carregando inventário MCP...';
    if (serversTbody) serversTbody.innerHTML = '<tr><td colspan="5" class="aex-mcp-empty">Carregando servidores MCP&hellip;</td></tr>';
    if (toolsList) toolsList.innerHTML = '<div class="aex-mcp-empty">Carregando ferramentas MCP&hellip;</div>';
    if (toolsTbody) toolsTbody.innerHTML = '<tr><td colspan="6" class="aex-mcp-empty">Carregando ferramentas MCP&hellip;</td></tr>';

    Promise.all([
      _aexTryFetchJson(['/api/architecture/mcp/registry-summary' + refreshSuffix, '/api/architecture/mcp/registry-index' + refreshSuffix]),
      _aexTryFetchJson(['/api/architecture/mcp/registry-servers' + refreshSuffix, '/api/mcp/servers']),
      _aexTryFetchJson(['/api/architecture/mcp/registry-tools' + toolsSuffix, '/api/mcp/tools' + toolsSuffix])
    ]).then(function (results) {
      var summary = results[0] || {};
      var servers = _aexList(results[1], 'servers');
      var tools = _aexList(results[2], 'tools');

      // Normalize legacy /api/mcp/servers payload if registry endpoint fallback was used.
      if (servers.length && !servers[0].id && servers[0].name) {
        servers = servers.map(function (s) {
          return {
            id: s.name,
            service: s.name,
            name: s.name,
            tool_count: s.tool_count != null ? s.tool_count : '-',
            required: !!s.required,
            available: s.available !== false,
            status: s.status || 'configured',
            error: s.error || ''
          };
        });
      }

      _aexRenderMcp(summary, servers, tools, { partial: !!summary.partial });
      _mcpLoaded = true;
    }).catch(function (err) {
      if (statusEl) statusEl.textContent = 'Falha ao carregar inventário MCP.';
      if (serversTbody) {
        serversTbody.innerHTML = '<tr><td colspan="5" class="aex-mcp-empty">MCP indisponível: ' + escapeHtml(err && err.message) + '</td></tr>';
      }
      if (toolsList) {
        toolsList.innerHTML = '<div class="aex-mcp-empty">Sem dados de ferramentas.</div>';
      }
      if (toolsTbody) {
        toolsTbody.innerHTML = '<tr><td colspan="6" class="aex-mcp-empty">Sem dados de ferramentas.</td></tr>';
      }
    });
  }

  function _aexReloadMcp() {
    _mcpLoaded = false;
    _mcpPage = 1;
    _mcpSelected = null;
    _loadMcpInventory(true);
  }

  // ── Agent chat ─────────────────────────────────────────────────────────────
  function aexAskAbout(fnId) {
    aexSwitchView('agent');
    var r = _reg();
    var fn = r ? r.getById(fnId) : null;
    if (!fn) return;

    var inp = document.getElementById('aexChatInput');
    if (inp) {
      inp.value = 'Me explique a função ' + fn.name +
        ' (' + (fn.method || 'GET') + ' ' + (fn.resolvedUrl || fn.urlTemplate || '') + ')';
      // Defer one tick so the view transition completes and input is focused
      setTimeout(function () { aexSendChat(); }, 0);
    }
  }

  function aexSendChat() {
    var input = document.getElementById('aexChatInput');
    if (!input) return;
    var msg = input.value.trim();
    if (!msg) return;
    input.value = '';
    _refreshAgentContextIndicator();

    _appendMsg('user', escapeHtml(msg));

    var bubble = _appendMsg('assistant',
      '<span class="aex-chat-thinking"><i class="fas fa-circle-notch fa-spin" style="font-size:10px;margin-right:4px"></i>Pensando&hellip;</span>');

    var r = _reg();
    var panelContext = _panelContextData();
    var msgWithContext = msg + (panelContext.text || '');
    var systemPrompt =
      'Você é o Agente de APIs da LA8159 — especialista em todos os endpoints e funções mapeadas da plataforma LA8159-AI.\n\n' +
      'Você tem acesso ao registro completo de funções:\n' +
      (r && r.loaded ? r.toSystemPrompt() : '(Registro ainda não carregado.)') +
      '\n\nResponda em português. Seja técnico e conciso. Quando mencionar funções use o nome e o método HTTP.' +
      '\nQuando relevante, cite o arquivo-fonte (source_file) da função.';

    var sectionCtx = (typeof window.LA8159ResolveSectionAgentContext === 'function')
      ? window.LA8159ResolveSectionAgentContext('apiexplorer')
      : null;
    if (sectionCtx && sectionCtx.assigned && !sectionCtx.active) {
      var inactiveName = sectionCtx.agent ? (sectionCtx.agent.name || sectionCtx.agent.agent_id) : sectionCtx.agentId;
      bubble.innerHTML = '<span style="color:var(--red)">Agente de API Explorer inativo: ' + escapeHtml(inactiveName) + '</span>';
      return;
    }

    var combinedSystem = [
      systemPrompt,
      sectionCtx && sectionCtx.system ? sectionCtx.system : ''
    ].filter(Boolean).join('\n\n');

    _chatHistory.push({ role: 'user', content: msg });

    if (typeof LA8159API !== 'undefined') {
      var assistantOpts = {
        system:  combinedSystem,
        history: _chatHistory.slice(-10),
        model:   null,
        sessionKey: sectionCtx && sectionCtx.sessionKey ? sectionCtx.sessionKey : 'section:apiexplorer:default'
      };
      if (sectionCtx && sectionCtx.agentId) assistantOpts.agentId = sectionCtx.agentId;
      if (typeof getCurrentProjectId === 'function') {
        var projectId = getCurrentProjectId();
        if (projectId) assistantOpts.projectId = projectId;
      }

      LA8159API.assistant.chat(
        msgWithContext,
        assistantOpts,
        function (_token, accumulated) {
          bubble.innerHTML = _fmt(accumulated);
        }
      ).then(function (full) {
        _chatHistory.push({ role: 'assistant', content: full });
        bubble.innerHTML = _fmt(full);
      }).catch(function (err) {        console.error('[API Explorer] Chat error:', err);        bubble.innerHTML = '<span style="color:var(--red)">Erro: ' + escapeHtml(err && err.message) + '</span>';
      });
    } else {
      bubble.innerHTML =
        '<span style="color:var(--gray)">LA8159API n&atilde;o dispon&iacute;vel. Verifique se o servidor est&aacute; ativo.</span>';
    }
  }

  function _appendMsg(role, html) {
    var msgs = document.getElementById('aexChatMsgs');
    if (!msgs) return { innerHTML: '' };
    var div = document.createElement('div');
    div.className = 'aex-chat-msg aex-msg-' + role;
    div.innerHTML = html;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
    return div;
  }

  // ── Diagram reload (used by Reload button) ─────────────────────────────────
  function _aexReloadDiagram() {
    _diagramLoaded = false;
    var container = document.getElementById('aexDiagram');
    if (container) container.innerHTML = '';
    _aexApplyDiagramModeControl();
    _loadDiagram();
  }

  // ── Main view (portal to full workspace area) ──────────────────────────────
  var _inMainMode  = false;
  var _wasTabActive = false;

  function aexToggleMain() {
    if (_inMainMode) aexHideMain(); else aexShowMain();
  }

  function aexShowMain() {
    _inMainMode = true;

    // Record if the sidebar tab was the active one
    var tab = document.getElementById('tab-apiexplorer');
    _wasTabActive = tab && tab.classList.contains('active');

    // Deactivate all competing full-screen views
    ['studioView','descobertaView','memoryView','spacesView','shadersView','listeningView'].forEach(function(vid) {
      var el = document.getElementById(vid);
      if (el) el.classList.remove('active');
    });

    // Hide main chat elements (same pattern as listeningShowView)
    ['chatHeader','welcomeState','chatLog','chatCompose','chatToolbar'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) { el._aexPrevDisplay = el.style.display; el.style.display = 'none'; }
    });
    var mc = document.querySelector('.main-content');
    if (mc) { mc._aexDisplay = mc.style.display; mc.style.display = 'none'; }

    // Collapse output/browser panels
    var op = document.getElementById('outputPanel');
    var bp = document.getElementById('browserPanel');
    if (op) { op._aexPrevOpen = op.classList.contains('open'); op.classList.remove('open'); }
    if (bp) { bp._aexPrevOpen = bp.classList.contains('open'); bp.classList.remove('open'); }

    // Move #aexPanel into the main view
    var panel    = document.getElementById('aexPanel');
    var mainView = document.getElementById('aexMainView');
    if (panel && mainView) {
      mainView.appendChild(panel);
      panel.classList.add('aex-main-mode');
    }

    // Remove active class from sidebar host (now empty)
    if (tab) tab.classList.remove('active');

    // Show the main view
    if (mainView) mainView.classList.add('active');

    // Update expand button icon
    var icon = document.getElementById('aexExpandIcon');
    if (icon) { icon.className = 'fas fa-compress-alt'; }
    var btn = document.getElementById('aexExpandBtn');
    if (btn) btn.title = 'Minimizar para sidebar';

    // Re-init to ensure list is populated in the new context
    _loaded = false;
    aexInit();
  }

  function aexHideMain() {
    if (!_inMainMode) return;
    _inMainMode = false;

    // Move #aexPanel back to sidebar host
    var panel    = document.getElementById('aexPanel');
    var sidebar  = document.getElementById('tab-apiexplorer');
    var mainView = document.getElementById('aexMainView');
    if (panel && sidebar) {
      sidebar.appendChild(panel);
      panel.classList.remove('aex-main-mode');
    }

    // Hide the main view
    if (mainView) mainView.classList.remove('active');

    // Restore sidebar tab active state
    if (sidebar && _wasTabActive) sidebar.classList.add('active');

    // Restore main-content
    var mc = document.querySelector('.main-content');
    if (mc) { mc.style.display = mc._aexDisplay !== undefined ? mc._aexDisplay : ''; delete mc._aexDisplay; }

    // Restore chat elements
    ['chatHeader','welcomeState','chatLog','chatCompose','chatToolbar'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) { el.style.display = el._aexPrevDisplay !== undefined ? el._aexPrevDisplay : ''; delete el._aexPrevDisplay; }
    });

    // Restore output/browser panels
    var op = document.getElementById('outputPanel');
    var bp = document.getElementById('browserPanel');
    if (op && op._aexPrevOpen) op.classList.add('open');
    if (bp && bp._aexPrevOpen) bp.classList.add('open');

    // Reset expand button icon
    var icon = document.getElementById('aexExpandIcon');
    if (icon) icon.className = 'fas fa-expand-alt';
    var btn = document.getElementById('aexExpandBtn');
    if (btn) btn.title = 'Expandir para área principal';
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  window.aexInit             = aexInit;
  window.aexSwitchView       = aexSwitchView;
  window.aexShowDetail       = aexShowDetail;
  window.aexAskAbout         = aexAskAbout;
  window.aexSendChat         = aexSendChat;
  window.aexSearchFunctions  = aexSearchFunctions;
  window.aexFilterCategory   = aexFilterCategory;
  window._aexReloadDiagram   = _aexReloadDiagram;
  window._aexSetDiagramMode  = _aexSetDiagramMode;
  window._aexReloadMcp       = _aexReloadMcp;
  window._aexFilterMcpTools  = _aexFilterMcpTools;
  window._aexSetMcpViewMode  = _aexSetMcpViewMode;
  window._aexMcpPrevPage     = _aexMcpPrevPage;
  window._aexMcpNextPage     = _aexMcpNextPage;
  window._aexPrepareMcpToolByIndex = _aexPrepareMcpToolByIndex;
  window._aexMcpOpenToolFromTable = _aexMcpOpenToolFromTable;
  window._aexPrepareMcpTool  = _aexPrepareMcpTool;
  window._aexExecuteMcpTool  = _aexExecuteMcpTool;
  window._aexClearMcpResult  = _aexClearMcpResult;
  window.aexTestInBrowser    = aexTestInBrowser;
  window.aexToggleMain       = aexToggleMain;
  window.aexShowMain         = aexShowMain;
  window.aexHideMain         = aexHideMain;

  _diagramMode = _aexReadDiagramMode();

})();
