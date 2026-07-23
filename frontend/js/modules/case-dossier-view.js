/* ==================================================================
   CASE DOSSIER VIEW — Consolidated case documentation surface
   One place to inspect every "final" / "master" / "index" artifact
   produced by the LA8159 orchestrator and the case management pipeline.

   - Calls /api/case/dossier   → summary cards + indices catalog
   - Calls /api/case/documents → curated, group-organized doc list
   - Loads each document on demand from its static URL
   ================================================================== */
(function () {
  'use strict';

  if (window.caseDossierShowView) return;

  var _state = {
    initialized: false,
    summary: null,
    docs: null,           // { groups: [{id,label,icon,items:[...]}] }
    selectedKey: null,    // 'overview' | 'indices' | 'timeline' | path
    selectedTitle: '',
    loadingViewer: false,
    filterQuery: '',
    filterGroup: 'all',
    filterJurisdiction: 'all',
    selectedPaths: Object.create(null),
    policyEnabled: false,
    policyGroups: Object.create(null),
    policyJurisdictions: Object.create(null),
  };

  function _esc(s) {
    var d = document.createElement('div');
    d.textContent = String(s == null ? '' : s);
    return d.innerHTML;
  }

  function _fmtSize(n) {
    n = Number(n) || 0;
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / (1024 * 1024)).toFixed(2) + ' MB';
  }

  function _fmtDate(ts) {
    if (!ts) return '';
    try { return new Date(ts * 1000).toLocaleString('pt-BR'); } catch (_) { return ''; }
  }

  function _setStatus(msg, tone) {
    var el = document.getElementById('caseDossierStatus');
    if (!el) return;
    el.textContent = String(msg || '');
    var color = 'var(--gray)';
    if (tone === 'error') color = 'var(--red)';
    else if (tone === 'ok') color = 'var(--green, #5aa469)';
    else if (tone === 'warn') color = 'var(--amber)';
    el.style.color = color;
  }

  async function _fetchJson(url) {
    var r = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url);
    return await r.json();
  }

  async function _fetchText(url) {
    var r = await fetch(url);
    if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url);
    return await r.text();
  }

  function _normalizeJurisdiction(jur) {
    var v = String(jur || '').trim().toUpperCase();
    if (v === 'BR' || v === 'CL' || v === 'INT') return v;
    return 'MULTI';
  }

  function _inferJurisdictionClient(item, groupId) {
    var hay = String((item && item.label) || '') + ' ' + String((item && item.path) || '');
    hay = hay.toUpperCase();
    if (hay.indexOf(' BR ') >= 0 || hay.indexOf('BR_') >= 0 || hay.indexOf('-BR') >= 0) return 'BR';
    if (hay.indexOf(' CL ') >= 0 || hay.indexOf('CL_') >= 0 || hay.indexOf('-CL') >= 0) return 'CL';
    if (hay.indexOf(' INT ') >= 0 || hay.indexOf('INT_') >= 0 || hay.indexOf('-INT') >= 0) return 'INT';
    if (groupId === 'jurisdictions') {
      if (hay.indexOf('STF') >= 0) return 'BR';
      if (hay.indexOf('CONADECUS') >= 0) return 'CL';
    }
    return 'MULTI';
  }

  function _allDocItems() {
    var out = [];
    var groups = (_state.docs && _state.docs.groups) || [];
    groups.forEach(function (g) {
      (g.items || []).forEach(function (it) {
        out.push({ group: g, item: it });
      });
    });
    return out;
  }

  function _filteredDocItems() {
    var q = String(_state.filterQuery || '').trim().toLowerCase();
    var gFilter = String(_state.filterGroup || 'all');
    var jFilter = _normalizeJurisdiction(_state.filterJurisdiction || 'all');
    if (String(_state.filterJurisdiction || 'all').toLowerCase() === 'all') jFilter = 'all';

    return _allDocItems().filter(function (entry) {
      var g = entry.group || {};
      var it = entry.item || {};
      if (gFilter !== 'all' && String(g.id || '') !== gFilter) return false;
      var jur = _normalizeJurisdiction(it.jurisdiction || _inferJurisdictionClient(it, String(g.id || '')));
      if (jFilter !== 'all' && jur !== jFilter) return false;
      if (!q) return true;
      var hay = [it.label, it.path, it.description].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }

  function _selectedPathsList() {
    return Object.keys(_state.selectedPaths || {}).filter(function (p) { return !!_state.selectedPaths[p]; });
  }

  function _allPathMeta() {
    var out = Object.create(null);
    _allDocItems().forEach(function (entry) {
      var g = entry.group || {};
      var it = entry.item || {};
      var p = String(it.path || '');
      if (!p) return;
      out[p] = {
        groupId: String(g.id || ''),
        jurisdiction: _normalizeJurisdiction(it.jurisdiction || _inferJurisdictionClient(it, String(g.id || ''))),
      };
    });
    return out;
  }

  function _ensurePolicyMaps() {
    var groups = (_state.docs && _state.docs.groups) || [];
    groups.forEach(function (g) {
      var gid = String(g.id || '');
      if (!gid) return;
      if (_state.policyGroups[gid] === undefined) _state.policyGroups[gid] = true;
    });

    var jurSet = Object.create(null);
    _allDocItems().forEach(function (entry) {
      var g = entry.group || {};
      var it = entry.item || {};
      var jur = _normalizeJurisdiction(it.jurisdiction || _inferJurisdictionClient(it, String(g.id || '')));
      jurSet[jur] = true;
    });
    Object.keys(jurSet).forEach(function (jur) {
      if (_state.policyJurisdictions[jur] === undefined) _state.policyJurisdictions[jur] = true;
    });
  }

  function _effectiveExportPaths() {
    var filtered = _filteredDocItems();
    var filteredPaths = filtered.map(function (entry) { return entry.item.path; });
    var filteredSet = Object.create(null);
    filteredPaths.forEach(function (p) { filteredSet[p] = true; });

    var selected = _selectedPathsList();
    var base = selected.length ? selected.slice() : filteredPaths.slice();
    var unique = Object.create(null);
    var out = [];
    var metaMap = _allPathMeta();

    base.forEach(function (p) {
      if (!p || unique[p]) return;
      if (_state.policyEnabled) {
        if (!filteredSet[p]) return; // Always respect current filters in policy mode.
        var meta = metaMap[p];
        if (!meta) return;
        if (_state.policyGroups[meta.groupId] === false) return;
        if (_state.policyJurisdictions[meta.jurisdiction] === false) return;
      }
      unique[p] = true;
      out.push(p);
    });

    return out;
  }

  async function _exportBundle(paths) {
    if (!Array.isArray(paths) || !paths.length) {
      _setStatus('Nenhum documento para exportar.', 'warn');
      return;
    }
    _setStatus('Gerando bundle ZIP…', 'warn');
    try {
      var r = await fetch('/api/case/documents/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/zip' },
        body: JSON.stringify({ paths: paths })
      });
      if (!r.ok) {
        var msg = 'HTTP ' + r.status;
        try {
          var err = await r.json();
          if (err && err.error) msg = err.error;
        } catch (_) {}
        throw new Error(msg);
      }
      var blob = await r.blob();
      var name = 'la8159_dossier_bundle.zip';
      var cd = r.headers.get('Content-Disposition') || '';
      var m = cd.match(/filename="?([^";]+)"?/i);
      if (m && m[1]) name = m[1];
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      _setStatus('Bundle exportado com sucesso (' + paths.length + ' arquivo(s)).', 'ok');
    } catch (e) {
      _setStatus('Falha ao exportar bundle: ' + (e && e.message || e), 'error');
    }
  }

  async function _shareBundleLink(paths) {
    if (!Array.isArray(paths) || !paths.length) {
      _setStatus('Selecione ou filtre documentos antes de compartilhar.', 'warn');
      return;
    }
    var query = paths.map(function (p) { return 'path=' + encodeURIComponent(p); }).join('&');
    var url = window.location.origin + '/api/case/documents/export?' + query;
    if (url.length > 1800) {
      _setStatus('Link muito longo. Use menos documentos para compartilhar.', 'warn');
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      _setStatus('Link de compartilhamento copiado.', 'ok');
    } catch (_) {
      window.prompt('Copie o link de compartilhamento:', url);
      _setStatus('Link de compartilhamento pronto.', 'ok');
    }
  }

  function _renderTree() {
    var tree = document.getElementById('caseDossierTree');
    if (!tree) return;

    var groups = (_state.docs && _state.docs.groups) || [];
    var filtered = _filteredDocItems();
    var byGroup = Object.create(null);
    filtered.forEach(function (entry) {
      var gid = String((entry.group && entry.group.id) || '');
      if (!byGroup[gid]) byGroup[gid] = [];
      byGroup[gid].push(entry.item);
    });

    var allJurSet = Object.create(null);
    _allDocItems().forEach(function (entry) {
      var jur = _normalizeJurisdiction(entry.item.jurisdiction || _inferJurisdictionClient(entry.item, String((entry.group || {}).id || '')));
      allJurSet[jur] = true;
    });
    _ensurePolicyMaps();
    var jurOptions = ['BR', 'CL', 'INT', 'MULTI'].filter(function (j) { return !!allJurSet[j]; });
    var selectedCount = _selectedPathsList().length;
    var effectiveCount = _effectiveExportPaths().length;

    var groupOptionsHtml = ['<option value="all">Todos os grupos</option>'];
    groups.forEach(function (g) {
      groupOptionsHtml.push('<option value="' + _esc(g.id) + '"' + (_state.filterGroup === g.id ? ' selected' : '') + '>' + _esc(g.label) + '</option>');
    });

    var jurOptionsHtml = ['<option value="all">Todas jurisdições</option>'];
    var currentJur = String(_state.filterJurisdiction || 'all').toLowerCase() === 'all'
      ? 'all'
      : _normalizeJurisdiction(_state.filterJurisdiction);
    jurOptions.forEach(function (j) {
      jurOptionsHtml.push('<option value="' + j + '"' + (currentJur === j ? ' selected' : '') + '>' + j + '</option>');
    });

    var policyGroupChips = groups.map(function (g) {
      var gid = String(g.id || '');
      var on = _state.policyGroups[gid] !== false;
      var style = on
        ? 'background:rgba(45,120,90,.25);border-color:#2d785a;color:var(--white)'
        : 'background:var(--bg);border-color:var(--border);color:var(--gray)';
      return '<button type="button" data-cd-policy-group="' + _esc(gid) + '" class="btn btn-sm" style="font-size:10px;padding:4px 8px;' + style + '">' + _esc(g.label) + '</button>';
    });
    var policyJurChips = jurOptions.map(function (jur) {
      var on = _state.policyJurisdictions[jur] !== false;
      var style = on
        ? 'background:rgba(45,82,120,.25);border-color:#2d5278;color:var(--white)'
        : 'background:var(--bg);border-color:var(--border);color:var(--gray)';
      return '<button type="button" data-cd-policy-jur="' + jur + '" class="btn btn-sm" style="font-size:10px;padding:4px 8px;' + style + '">' + jur + '</button>';
    });

    var html = [];
    html.push(
      '<div style="position:sticky;top:0;z-index:2;padding:10px;background:linear-gradient(180deg,var(--surface) 0%,rgba(20,20,20,.95) 100%);border-bottom:1px solid var(--border)">',
      '<input id="caseDossierSearchInput" type="search" placeholder="Filtrar por nome/caminho..." value="' + _esc(_state.filterQuery) + '" style="width:100%;padding:8px 10px;background:var(--bg);color:var(--gray-hi);border:1px solid var(--border);border-radius:6px;font-size:12px" />',
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:6px">',
      '<select id="caseDossierGroupFilter" style="padding:7px 8px;background:var(--bg);color:var(--gray-hi);border:1px solid var(--border);border-radius:6px;font-size:11px">' + groupOptionsHtml.join('') + '</select>',
      '<select id="caseDossierJurFilter" style="padding:7px 8px;background:var(--bg);color:var(--gray-hi);border:1px solid var(--border);border-radius:6px;font-size:11px">' + jurOptionsHtml.join('') + '</select>',
      '</div>',
      '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">',
      '<button id="caseDossierSelectVisibleBtn" class="btn btn-sm" style="font-size:11px"><i class="fas fa-check-double"></i> Selecionar visiveis</button>',
      '<button id="caseDossierClearSelectionBtn" class="btn btn-sm" style="font-size:11px"><i class="fas fa-eraser"></i> Limpar seleção</button>',
      '<button id="caseDossierPolicyToggleBtn" class="btn btn-sm" style="font-size:11px;' + (_state.policyEnabled ? 'background:linear-gradient(135deg,#a13a2c 0%,#4b3b22 100%);border-color:#a13a2c' : '') + '"><i class="fas fa-shield-halved"></i> Política ' + (_state.policyEnabled ? 'ON' : 'OFF') + '</button>',
      '<button id="caseDossierExportBtn" class="btn btn-sm" style="font-size:11px;background:linear-gradient(135deg,#2d785a 0%,#2d5278 100%);border-color:#2d785a"><i class="fas fa-file-zipper"></i> Exportar ZIP</button>',
      '<button id="caseDossierShareBtn" class="btn btn-sm" style="font-size:11px"><i class="fas fa-share-nodes"></i> Link bundle</button>',
      '</div>',
      (_state.policyEnabled
        ? '<div style="margin-top:8px;padding:8px;border:1px solid var(--border);border-radius:6px;background:rgba(161,58,44,.08)">'
            + '<div style="font-size:10px;color:var(--gray);text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">Restrições de Política</div>'
            + '<div style="font-size:10px;color:var(--gray);margin-bottom:4px">Grupos permitidos</div>'
            + '<div style="display:flex;flex-wrap:wrap;gap:6px">' + policyGroupChips.join('') + '</div>'
            + '<div style="font-size:10px;color:var(--gray);margin:8px 0 4px">Jurisdições permitidas</div>'
            + '<div style="display:flex;flex-wrap:wrap;gap:6px">' + policyJurChips.join('') + '</div>'
          + '</div>'
        : ''),
      '<div style="margin-top:6px;font-size:10px;color:var(--gray)">Selecionados: ' + selectedCount + ' · Visíveis: ' + filtered.length + ' · Exportáveis: ' + effectiveCount + '</div>',
      '</div>'
    );

    html.push(
      '<div class="vw-tree-section" style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--gray);padding:10px 12px 4px">Visão Geral</div>',
      '<div class="vw-tree-item' + (_state.selectedKey === 'overview' ? ' active' : '') + '" data-cd-key="overview"><i class="fas fa-circle-info"></i><span>Resumo do Caso</span></div>',
      '<div class="vw-tree-item' + (_state.selectedKey === 'indices' ? ' active' : '') + '" data-cd-key="indices"><i class="fas fa-list-ul"></i><span>Catálogo de Índices</span></div>',
      '<div class="vw-tree-item' + (_state.selectedKey === 'timeline' ? ' active' : '') + '" data-cd-key="timeline"><i class="fas fa-clock"></i><span>Timeline (eventos)</span></div>'
    );

    groups.forEach(function (g) {
      var visibleItems = byGroup[g.id] || [];
      if (!visibleItems.length) return;
      html.push('<div class="vw-tree-section" style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--gray);padding:14px 12px 4px"><i class="fas ' + _esc(g.icon || 'fa-folder') + '" style="margin-right:6px;color:var(--amber)"></i>' + _esc(g.label) + ' <span style="opacity:.7">(' + visibleItems.length + ')</span></div>');
      visibleItems.forEach(function (it) {
        var key = it.path;
        var active = (_state.selectedKey === key) ? ' active' : '';
        var checked = _state.selectedPaths[key] ? ' checked' : '';
        var jur = _normalizeJurisdiction(it.jurisdiction || _inferJurisdictionClient(it, String(g.id || '')));
        var jurBadge = '<span style="font-size:9px;color:var(--amber);margin-left:6px;font-family:var(--mono)">' + _esc(jur) + '</span>';
        var extBadge = it.ext ? '<span style="font-size:9px;color:var(--gray);margin-left:6px;font-family:var(--mono);text-transform:uppercase">' + _esc(it.ext) + '</span>' : '';
        html.push(
          '<div class="vw-tree-item' + active + '" data-cd-key="' + _esc(key) + '" data-cd-title="' + _esc(it.label) + '" title="' + _esc(it.description || '') + '">'
          + '<input type="checkbox" aria-label="' + _esc(it.label) + '" data-cd-select="' + _esc(key) + '"' + checked + ' style="margin-right:8px" />'
          + '<i class="fas fa-file-lines"></i><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _esc(it.label) + '</span>'
          + jurBadge + extBadge + '</div>'
        );
      });
    });

    if (!filtered.length) {
      html.push('<div class="vw-empty" style="padding:18px 12px;color:var(--gray)">Nenhum documento encontrado com os filtros atuais.</div>');
    }

    tree.innerHTML = html.join('');

    var searchInput = tree.querySelector('#caseDossierSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', function () {
        _state.filterQuery = String(searchInput.value || '');
        _renderTree();
      });
    }

    var groupFilter = tree.querySelector('#caseDossierGroupFilter');
    if (groupFilter) {
      groupFilter.addEventListener('change', function () {
        _state.filterGroup = String(groupFilter.value || 'all');
        _renderTree();
      });
    }

    var jurFilter = tree.querySelector('#caseDossierJurFilter');
    if (jurFilter) {
      jurFilter.addEventListener('change', function () {
        _state.filterJurisdiction = String(jurFilter.value || 'all');
        _renderTree();
      });
    }

    var selectVisibleBtn = tree.querySelector('#caseDossierSelectVisibleBtn');
    if (selectVisibleBtn) {
      selectVisibleBtn.addEventListener('click', function () {
        filtered.forEach(function (entry) {
          if (entry && entry.item && entry.item.path) _state.selectedPaths[entry.item.path] = true;
        });
        _renderTree();
        _setStatus('Documentos visíveis selecionados.', 'ok');
      });
    }

    var clearSelectionBtn = tree.querySelector('#caseDossierClearSelectionBtn');
    if (clearSelectionBtn) {
      clearSelectionBtn.addEventListener('click', function () {
        _state.selectedPaths = Object.create(null);
        _renderTree();
      });
    }

    var policyToggleBtn = tree.querySelector('#caseDossierPolicyToggleBtn');
    if (policyToggleBtn) {
      policyToggleBtn.addEventListener('click', function () {
        _state.policyEnabled = !_state.policyEnabled;
        _renderTree();
        _setStatus(_state.policyEnabled ? 'Modo de política ativado.' : 'Modo de política desativado.', 'ok');
      });
    }

    tree.querySelectorAll('[data-cd-policy-group]').forEach(function (el) {
      el.addEventListener('click', function () {
        var gid = String(el.getAttribute('data-cd-policy-group') || '');
        if (!gid) return;
        _state.policyGroups[gid] = !(_state.policyGroups[gid] !== false);
        _renderTree();
      });
    });

    tree.querySelectorAll('[data-cd-policy-jur]').forEach(function (el) {
      el.addEventListener('click', function () {
        var jur = _normalizeJurisdiction(el.getAttribute('data-cd-policy-jur') || '');
        _state.policyJurisdictions[jur] = !(_state.policyJurisdictions[jur] !== false);
        _renderTree();
      });
    });

    var exportBtn = tree.querySelector('#caseDossierExportBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', function () {
        var paths = _effectiveExportPaths();
        _exportBundle(paths);
      });
    }

    var shareBtn = tree.querySelector('#caseDossierShareBtn');
    if (shareBtn) {
      shareBtn.addEventListener('click', function () {
        var paths = _effectiveExportPaths();
        _shareBundleLink(paths);
      });
    }

    tree.querySelectorAll('[data-cd-select]').forEach(function (el) {
      el.addEventListener('click', function (ev) {
        ev.stopPropagation();
      });
      el.addEventListener('change', function () {
        var path = String(el.getAttribute('data-cd-select') || '');
        if (!path) return;
        if (el.checked) _state.selectedPaths[path] = true;
        else delete _state.selectedPaths[path];
        _renderTree();
      });
    });

    tree.querySelectorAll('[data-cd-key]').forEach(function (el) {
      el.addEventListener('click', function () {
        var key = el.getAttribute('data-cd-key');
        var title = el.getAttribute('data-cd-title') || '';
        _state.selectedKey = key;
        _state.selectedTitle = title;
        _renderTree();
        _renderViewer();
      });
    });
  }

  function _renderOverview() {
    var s = _state.summary || {};
    var caseInfo = s.case || {};
    var pp = s.primary_passenger || {};
    var dates = Array.isArray(s.incident_dates) ? s.incident_dates : [];
    var indices = Array.isArray(s.indices) ? s.indices : [];
    var docPointers = s.doc_pointers || {};

    function _stat(label, value) {
      return '<div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:14px"><div style="font-size:11px;color:var(--gray);text-transform:uppercase;letter-spacing:.05em">' + _esc(label) + '</div><div style="font-size:22px;font-weight:600;color:var(--white);margin-top:4px;font-family:var(--mono)">' + _esc(value == null ? '—' : value) + '</div></div>';
    }

    var v = s.violations || {};
    var ag = s.agents || {};
    var tl = s.timeline_summary || {};

    var html = [];
    html.push(
      '<div style="padding:24px;max-width:1100px;margin:0 auto">',
      '<h1 style="margin:0 0 4px;color:var(--white);font-size:24px"><i class="fas fa-folder-open" style="color:var(--amber);margin-right:8px"></i>' + _esc(caseInfo.id || 'LA8159') + '</h1>',
      '<p style="margin:0 0 18px;color:var(--gray-hi);font-size:13px">' + _esc(caseInfo.title || 'Dossiê consolidado do caso') + '</p>',

      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-bottom:18px">',
      _stat('Violações', v.total || '—'),
      _stat('Agentes', ag.total || '—'),
      _stat('Eventos timeline', tl.events_count || '—'),
      _stat('Datas de incidente', dates.length || '—'),
      _stat('Índices catalogados', indices.length || '—'),
      '</div>'
    );

    if (pp && (pp.name || pp.id)) {
      html.push(
        '<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:16px;margin-bottom:18px">',
        '<div style="font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:var(--gray);margin-bottom:8px">Passageiro Primário</div>',
        '<div style="font-size:16px;color:var(--white);font-weight:600">' + _esc(pp.name || pp.id) + '</div>',
        pp.role ? '<div style="font-size:12px;color:var(--gray-hi);margin-top:4px">' + _esc(pp.role) + '</div>' : '',
        '</div>'
      );
    }

    if (dates.length) {
      html.push(
        '<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:16px;margin-bottom:18px">',
        '<div style="font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:var(--gray);margin-bottom:10px">Datas de Incidente</div>',
        '<div style="display:flex;flex-wrap:wrap;gap:6px">',
        dates.map(function (d) { return '<span style="display:inline-block;padding:4px 10px;background:var(--bg);border:1px solid var(--border);border-radius:14px;font-family:var(--mono);font-size:11px;color:var(--gray-hi)">' + _esc(d) + '</span>'; }).join(''),
        '</div></div>'
      );
    }

    var dpEntries = Object.keys(docPointers || {});
    if (dpEntries.length) {
      html.push(
        '<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:16px;margin-bottom:18px">',
        '<div style="font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:var(--gray);margin-bottom:10px">Documentos de Referência</div>',
        '<div style="display:grid;gap:6px">',
        dpEntries.map(function (k) {
          var p = docPointers[k];
          return '<div style="display:flex;align-items:center;gap:8px;font-size:12px"><i class="fas fa-link" style="color:var(--gray);font-size:10px"></i><span style="color:var(--gray-hi);min-width:200px">' + _esc(k) + '</span><a href="/case_files/' + _esc(String(p).replace(/^cases\/LA8159\//, '')) + '" target="_blank" style="color:var(--amber);font-family:var(--mono);font-size:11px;text-decoration:none">' + _esc(p) + '</a></div>';
        }).join(''),
        '</div></div>'
      );
    }

    html.push('</div>');
    return html.join('');
  }

  function _renderIndices() {
    var s = _state.summary || {};
    var indices = Array.isArray(s.indices) ? s.indices : [];
    var html = [];
    html.push(
      '<div style="padding:24px;max-width:1100px;margin:0 auto">',
      '<h1 style="margin:0 0 4px;color:var(--white);font-size:22px"><i class="fas fa-list-ul" style="color:var(--amber);margin-right:8px"></i>Catálogo de Índices</h1>',
      '<p style="margin:0 0 18px;color:var(--gray-hi);font-size:13px">Arquivos de índice/registro produzidos pelo orquestrador LA8159 e seus conteúdos.</p>',
      '<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;overflow:hidden">',
      '<table style="width:100%;border-collapse:collapse;font-size:12px">',
      '<thead><tr style="background:var(--bg);text-align:left">',
      '<th style="padding:10px 12px;color:var(--gray);font-weight:500;text-transform:uppercase;font-size:10px;letter-spacing:.05em">Label</th>',
      '<th style="padding:10px 12px;color:var(--gray);font-weight:500;text-transform:uppercase;font-size:10px;letter-spacing:.05em">Caminho</th>',
      '<th style="padding:10px 12px;color:var(--gray);font-weight:500;text-transform:uppercase;font-size:10px;letter-spacing:.05em;text-align:right">Itens</th>',
      '<th style="padding:10px 12px;color:var(--gray);font-weight:500;text-transform:uppercase;font-size:10px;letter-spacing:.05em;text-align:right">Tamanho</th>',
      '<th style="padding:10px 12px;color:var(--gray);font-weight:500;text-transform:uppercase;font-size:10px;letter-spacing:.05em">Atualizado</th>',
      '</tr></thead><tbody>'
    );
    indices.forEach(function (it) {
      html.push(
        '<tr style="border-top:1px solid var(--border)">',
        '<td style="padding:10px 12px;color:var(--white);font-weight:500">' + _esc(it.label) + '</td>',
        '<td style="padding:10px 12px"><a href="/case_files/' + _esc(String(it.path).replace(/^cases\/LA8159\//, '')) + '" target="_blank" style="color:var(--amber);font-family:var(--mono);font-size:11px;text-decoration:none">' + _esc(it.path) + '</a></td>',
        '<td style="padding:10px 12px;text-align:right;font-family:var(--mono);color:var(--gray-hi)">' + (it.count != null ? _esc(it.count) : '—') + '</td>',
        '<td style="padding:10px 12px;text-align:right;font-family:var(--mono);color:var(--gray-hi)">' + _esc(_fmtSize(it.size)) + '</td>',
        '<td style="padding:10px 12px;color:var(--gray);font-size:11px">' + _esc(_fmtDate(it.mtime)) + '</td>',
        '</tr>'
      );
    });
    if (!indices.length) {
      html.push('<tr><td colspan="5" style="padding:20px;text-align:center;color:var(--gray)">Sem índices disponíveis.</td></tr>');
    }
    html.push('</tbody></table></div></div>');
    return html.join('');
  }

  function _renderTimeline() {
    var s = _state.summary || {};
    var events = Array.isArray(s.timeline_events) ? s.timeline_events : [];
    var html = [];
    html.push(
      '<div style="padding:24px;max-width:1100px;margin:0 auto">',
      '<h1 style="margin:0 0 4px;color:var(--white);font-size:22px"><i class="fas fa-clock" style="color:var(--amber);margin-right:8px"></i>Timeline de Eventos</h1>',
      '<p style="margin:0 0 18px;color:var(--gray-hi);font-size:13px">Primeiros ' + events.length + ' eventos do <code style="color:var(--amber)">cases/CASE_MANAGEMENT/master_timeline.json</code>.</p>',
      '<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;overflow:hidden">'
    );
    if (!events.length) {
      html.push('<div style="padding:24px;text-align:center;color:var(--gray)">Nenhum evento carregado.</div>');
    } else {
      events.forEach(function (ev) {
        var ts = ev.timestamp || ev.datetime || ev.time || ev.date || '';
        var title = ev.title || ev.event || ev.name || ev.summary || '';
        var loc = ev.location || ev.place || '';
        var actors = Array.isArray(ev.actors) ? ev.actors.join(', ') : (ev.actor || '');
        html.push(
          '<div style="padding:12px 14px;border-top:1px solid var(--border);display:grid;grid-template-columns:180px 1fr;gap:12px">',
          '<div style="font-family:var(--mono);font-size:11px;color:var(--amber)">' + _esc(ts || '—') + '</div>',
          '<div>',
          '<div style="color:var(--white);font-size:13px;margin-bottom:2px">' + _esc(title || '(sem título)') + '</div>',
          (loc ? '<div style="color:var(--gray-hi);font-size:11px"><i class="fas fa-location-dot"></i> ' + _esc(loc) + '</div>' : ''),
          (actors ? '<div style="color:var(--gray);font-size:11px;margin-top:2px"><i class="fas fa-user"></i> ' + _esc(actors) + '</div>' : ''),
          '</div></div>'
        );
      });
    }
    html.push('</div></div>');
    return html.join('');
  }

  async function _renderDocument(path) {
    var ext = (path.split('.').pop() || '').toLowerCase();
    var url = '/' + path;
    var title = _state.selectedTitle || path;
    var headerHtml =
      '<div style="padding:14px 24px 8px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:14px">'
      + '<i class="fas fa-file-lines" style="color:var(--amber);font-size:18px"></i>'
      + '<div style="flex:1;min-width:0">'
      +   '<div style="color:var(--white);font-weight:600;font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _esc(title) + '</div>'
      +   '<div style="color:var(--gray);font-size:11px;font-family:var(--mono);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _esc(path) + '</div>'
      + '</div>'
      + '<a href="' + _esc(url) + '" target="_blank" class="btn btn-sm" style="white-space:nowrap"><i class="fas fa-external-link-alt"></i> Abrir</a>'
      + '</div>';

    if (ext === 'pdf') {
      return headerHtml + '<iframe src="' + _esc(url) + '" style="border:0;width:100%;height:calc(100% - 70px);background:#1a1a1a"></iframe>';
    }
    if (ext === 'html' || ext === 'htm') {
      return headerHtml + '<iframe src="' + _esc(url) + '" sandbox="allow-same-origin" style="border:0;width:100%;height:calc(100% - 70px);background:#fff"></iframe>';
    }

    // Text-like content (md, json, tex, txt) — fetch + render
    try {
      var txt = await _fetchText(url);
      if (ext === 'json') {
        try { txt = JSON.stringify(JSON.parse(txt), null, 2); } catch (_) {}
      }
      var max = 200000; // cap to keep DOM fast
      var truncated = txt.length > max;
      var shown = truncated ? (txt.slice(0, max) + '\n\n… (truncado, abra o arquivo para ver completo)') : txt;
      return headerHtml
        + '<div style="overflow:auto;height:calc(100% - 70px);padding:18px 24px"><pre style="white-space:pre-wrap;word-break:break-word;font-family:var(--mono);font-size:12px;line-height:1.6;color:var(--gray-hi);margin:0">' + _esc(shown) + '</pre></div>';
    } catch (e) {
      return headerHtml + '<div style="padding:24px;color:var(--red)">Falha ao carregar: ' + _esc(String(e && e.message || e)) + '</div>';
    }
  }

  async function _renderViewer() {
    var v = document.getElementById('caseDossierViewer');
    if (!v) return;
    var key = _state.selectedKey;
    if (!key || key === 'overview') { v.innerHTML = _renderOverview(); return; }
    if (key === 'indices')         { v.innerHTML = _renderIndices(); return; }
    if (key === 'timeline')        { v.innerHTML = _renderTimeline(); return; }

    v.innerHTML = '<div style="padding:30px;text-align:center;color:var(--gray)"><i class="fas fa-spinner fa-spin"></i> Carregando…</div>';
    try {
      v.innerHTML = await _renderDocument(key);
    } catch (e) {
      v.innerHTML = '<div style="padding:24px;color:var(--red)">Erro: ' + _esc(String(e && e.message || e)) + '</div>';
    }
  }

  async function _load(force) {
    if (_state.initialized && !force) return;
    _setStatus('Carregando dossiê…', 'warn');
    try {
      var summaryPromise = _fetchJson('/api/case/dossier');
      var docsPromise = _fetchJson('/api/case/documents');
      var results = await Promise.all([summaryPromise, docsPromise]);
      _state.summary = results[0] || {};
      _state.docs = results[1] || { groups: [] };
      ((_state.docs && _state.docs.groups) || []).forEach(function (g) {
        (g.items || []).forEach(function (it) {
          it.jurisdiction = _normalizeJurisdiction(it.jurisdiction || _inferJurisdictionClient(it, String(g.id || '')));
        });
      });
      _state.initialized = true;
      if (!_state.selectedKey) _state.selectedKey = 'overview';
      _renderTree();
      _renderViewer();
      var totalDocs = _state.docs && _state.docs.total != null ? _state.docs.total : '—';
      _setStatus('Dossiê carregado · ' + totalDocs + ' documentos', 'ok');
    } catch (e) {
      _setStatus('Falha ao carregar dossiê: ' + (e && e.message || e), 'error');
    }
  }

  function _refresh() { _load(true); }

  function caseDossierShowView() {
    if (typeof window.vwEnter === 'function') {
      window.vwEnter('caseDossierView');
    } else {
      var v = document.getElementById('caseDossierView');
      if (v) { v.classList.add('active'); }
    }
    _load(false);
  }

  function caseDossierHideView() {
    if (typeof window.vwLeave === 'function') {
      window.vwLeave('caseDossierView');
    } else {
      var v = document.getElementById('caseDossierView');
      if (v) v.classList.remove('active');
    }
  }

  window.caseDossierShowView = caseDossierShowView;
  window.caseDossierHideView = caseDossierHideView;
  window.caseDossierRefresh = _refresh;
})();
