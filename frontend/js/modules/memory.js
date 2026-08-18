// ── Phase 4.5 pilot: capability availability gate ─────────────────
// Consumes window.OliviaCapabilities (Phase 3 primitive; D-005 says
// availability ≠ raw service health). ADVISORY and DEFENSIVE: when the
// registry is absent or its manifest has not finished loading, the gate
// passes — the pilot never blocks a healthy action and adds no latency
// (rollback criterion 4.5).
var _MV_CAPABILITY_LABELS = {
  'service-down': 'serviço indisponível',
  'permission-denied': 'sem permissão para esta ação',
  'schema-incompatible': 'esquema incompatível',
  'dependency-down': 'dependência indisponível'
};

function _mvCapabilityGate(capabilityId) {
  var caps = window.OliviaCapabilities;
  if (!caps || typeof caps.availability !== 'function') return { ok: true };
  var manifest = caps.manifest();
  if (!manifest || !manifest.capabilities) return { ok: true }; // not warmed yet
  if (!caps.get(capabilityId)) return { ok: true };             // not in manifest
  var a = caps.availability(capabilityId);
  return a && a.available ? { ok: true } : { ok: false, reason: (a && a.reason) || 'unavailable' };
}

function _mvCapabilityReason(reason) {
  return _MV_CAPABILITY_LABELS[reason] || reason || 'indisponível';
}

function _mvCollectionPoints(c) {
  var points = Number((c && (c.points || c.points_count)) || 0);
  if (Number.isFinite(points) && points > 0) return Math.round(points);
  var vectors = Number((c && c.vectors_count) || 0);
  return (Number.isFinite(vectors) && vectors > 0) ? Math.round(vectors) : 0;
}

function _mvCollectionVectors(c) {
  var vectors = Number((c && c.vectors_count) || 0);
  if (Number.isFinite(vectors) && vectors > 0) return Math.round(vectors);
  return _mvCollectionPoints(c);
}

function _mvGetPanelContextData() {
  if (typeof window.buildSelectedPanelContext === 'function') {
    return window.buildSelectedPanelContext();
  }
  return { text: '', selectedCount: 0, availableCount: 0, snapshots: [] };
}

function _mvGetPanelContextText() {
  var data = _mvGetPanelContextData();
  return data && data.text ? data.text : '';
}

function _mvUpdatePanelContextIndicator() {
  var indicator = document.getElementById('mvPanelContextIndicator');
  if (!indicator) return;
  var data = _mvGetPanelContextData();
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

// Global memory variables
let _mvCollections = [];
let _mvShortMemory = [];
let _mvChatHistory = [];
let _mvIngestTags = [];
let _mvGraphData = null;
let _mvSelectedCollection = '';
let _mvPrevOpen = null;
let _mvRoutingConfig = { default_qdrant_url: '', rules: {} };
let _mvCollectionDetailsOpen = '';
let _mvPanelCtxListenerBound = false;

// Show memory view
window.memoryShowView = function () {
  var hide = ['chatHeader', 'welcomeState', 'chatLog', 'chatCompose', 'chatToolbar'];
  hide.forEach(function (id) { var el = document.getElementById(id); if (el) el.style.display = 'none'; });

  // Collapse main content so memory gets full workspace width
  var mc = document.querySelector('.main-content');
  if (mc) { mc._mvDisplay = mc.style.display; mc.style.display = 'none'; }

  if (typeof aexHideMain === 'function') aexHideMain();

  // Deactivate competing full-screen views
  var lv = document.getElementById('listeningView'); if (lv) lv.classList.remove('active');
  var sv = document.getElementById('studioView'); if (sv) sv.classList.remove('active');
  var dv = document.getElementById('discoverView'); if (dv) dv.classList.remove('active');

  var mv = document.getElementById('memoryView');
  if (mv) {
    mv.style.display = '';
    mv.classList.add('active');

    var op = document.getElementById('outputPanel'), bp = document.getElementById('browserPanel');
    if (op || bp) {
      _mvPrevOpen = {
        output: op ? op.classList.contains('open') : false,
        browser: bp ? bp.classList.contains('open') : false
      };
      if (op) op.classList.remove('open');
      if (bp) bp.classList.remove('open');
    }

    mvLoadOverview();
    mvLoadConfig();
    mvLoadSidebarSummary();
    mvLoadRoutingConfig();

    if (!_mvPanelCtxListenerBound) {
      window.addEventListener('LA8159:panel-context-updated', _mvUpdatePanelContextIndicator);
      _mvPanelCtxListenerBound = true;
    }
    _mvUpdatePanelContextIndicator();

    // Initialise collapsible sections after view is shown
    mvInitCollapsibleCards();
  }
};

// Hide memory view
window.memoryHideView = function () {
  var mv = document.getElementById('memoryView');
  if (mv) { mv.style.display = 'none'; mv.classList.remove('active'); }

  // Restore main content
  var mc = document.querySelector('.main-content');
  if (mc) { mc.style.display = mc._mvDisplay !== undefined ? mc._mvDisplay : ''; delete mc._mvDisplay; }

  var show = ['chatHeader', 'welcomeState', 'chatLog', 'chatCompose', 'chatToolbar'];
  show.forEach(function (id) { var el = document.getElementById(id); if (el) el.style.display = ''; });

  // Restore panels that were open before entering memory view
  var op = document.getElementById('outputPanel'), bp = document.getElementById('browserPanel');
  if (op && _mvPrevOpen && _mvPrevOpen.output) op.classList.add('open');
  if (bp && _mvPrevOpen && _mvPrevOpen.browser) bp.classList.add('open');
};

// Render agent memory information
function renderAgentMemoryInfo(agent) {
  const list = document.getElementById('agentList');
  // Remove any existing memory info panel
  const existing = document.getElementById('agentMemoryPanel');
  if (existing) existing.remove();

  const qdrant = agent.qdrant_collection || 'none';
  const neo4j = agent.neo4j_database || 'shared (default)';
  const files = agent.linked_files || [];
  const scopes = agent.shared_scopes || [];
  const wsPath = agent.workspace_path || 'none';
  const filesHtml = files.length
    ? `<ul class="agent-file-list">${files.map(f => `<li><i class="fas fa-link"></i> ${escapeHtml(f)}</li>`).join('')}</ul>`
    : '<span style="color:var(--gray);font-size:11px">No linked files</span>';
  const scopesHtml = scopes.length
    ? scopes.map(s => `<span style="display:inline-block;font-size:10px;padding:2px 7px;margin:2px;border-radius:4px;background:rgba(28,69,50,.06);color:var(--amber);border:1px solid rgba(28,69,50,.12);font-family:var(--mono)">${escapeHtml(s)}</span>`).join('')
    : '<span style="color:var(--gray);font-size:11px">No shared scopes</span>';

  // MCP toolset — rendered synchronously from the agent config, then enriched
  // with live per-server detail (tool counts, bridge wiring, reachability).
  const cfg = agent.config || {};
  const mcpServers = Array.isArray(cfg.mcp_servers) ? cfg.mcp_servers : [];
  const permitted = Array.isArray(cfg.permitted_tools) ? cfg.permitted_tools : null;
  const mcpToolsHtml = mcpServers.length
    ? mcpServers.map(function (s) {
        return `<span class="mcp-tool-chip" style="display:inline-block;font-size:10px;padding:2px 7px;margin:2px;border-radius:4px;background:rgba(28,69,50,.06);color:var(--amber);border:1px solid rgba(28,69,50,.12);font-family:var(--mono)">${escapeHtml(s)}</span>`;
      }).join('')
    : '<span style="color:var(--gray);font-size:11px">No MCP servers enabled</span>';
  const mcpSummaryHtml = mcpServers.length
    ? (permitted
        ? `${mcpServers.length} servers · per-tool restrictions (${permitted.length} tool names)`
        : `${mcpServers.length} servers · all catalog tools enabled`)
    : '';

  const panel = document.createElement('div');
  panel.id = 'agentMemoryPanel';
  panel.className = 'agent-memory-info';
  panel.innerHTML = `
    <div style="margin-bottom:6px"><span class="mem-label">Workspace</span><br><span class="mem-value" style="font-size:10px">${escapeHtml(wsPath)}</span></div>
    <div style="margin-bottom:6px"><span class="mem-label">Shared Data Access</span><br>${scopesHtml}</div>
    <div style="margin-bottom:6px"><span class="mem-label">Qdrant Collection</span><br><span class="mem-value">${escapeHtml(qdrant)}</span></div>
    <div style="margin-bottom:6px"><span class="mem-label">Neo4j Database</span><br><span class="mem-value">${escapeHtml(neo4j)}</span></div>
    <div style="margin-bottom:6px"><span class="mem-label">MCP Tools</span><br>${mcpToolsHtml}<div style="font-size:10px;color:var(--gray);margin-top:2px">${escapeHtml(mcpSummaryHtml)}</div><div id="agentMcpToolsDetail" style="margin-top:3px"><span style="color:var(--gray);font-size:11px">Loading detail…</span></div></div>
    <div><span class="mem-label">Linked Files</span>${filesHtml}</div>
  `;
  if (list) list.appendChild(panel);

  // Enrich asynchronously from the backend toolset summary.
  if (mcpServers.length && agent.agent_id) {
    _renderAgentMcpToolsetDetail(agent.agent_id, panel);
  }
}

// Enrich the agent memory panel with per-server MCP toolset detail.
async function _renderAgentMcpToolsetDetail(agentId, panel) {
  try {
    const res = await fetch(`${API_BASE}/api/agents/${encodeURIComponent(agentId)}/mcp-tools`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const detailEl = document.getElementById('agentMcpToolsDetail');
    if (!detailEl || !document.body.contains(panel)) return; // panel was replaced
    if (!Array.isArray(data.servers)) {
      detailEl.innerHTML = '<span style="color:var(--gray);font-size:11px">Detail unavailable</span>';
      return;
    }
    const rows = data.servers.map(function (s) {
      const dot = s.reachable ? 'ok' : (s.wired ? 'down' : 'off');
      const dotColor = dot === 'ok' ? '#4caf7d' : (dot === 'down' ? '#e2a03f' : '#999');
      const wiredLabel = s.wired ? (s.bridge_key ? `${s.bridge_key}` : 'wired') : 'not wired';
      const countLabel = s.unrestricted ? `${s.enabled_tools}/${s.total_tools} tools` : `${s.enabled_tools} of ${s.total_tools} enabled`;
      return `<div style="display:flex;align-items:center;gap:6px;font-size:10px;margin:2px 0;font-family:var(--mono);color:var(--text)">
        <span style="width:8px;height:8px;border-radius:50%;background:${dotColor};flex:0 0 auto" title="${dot}"></span>
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(s.name)}</span>
        <span style="color:var(--gray);flex:0 0 auto">${countLabel}</span>
        <span style="color:var(--gray);flex:0 0 auto">${escapeHtml(wiredLabel)}</span>
      </div>`;
    }).join('');
    const reachableCount = data.servers.filter(function (s) { return s.reachable; }).length;
    const summary = `${reachableCount}/${data.servers.length} reachable · ${data.enabled_tool_count}/${data.tool_count} tools`;
    detailEl.innerHTML = rows + `<div style="font-size:10px;color:var(--gray);margin-top:3px">${escapeHtml(summary)}</div>`;
  } catch (_e) {
    const detailEl = document.getElementById('agentMcpToolsDetail');
    if (detailEl && document.body.contains(panel)) {
      detailEl.innerHTML = '<span style="color:var(--gray);font-size:11px">Detail unavailable</span>';
    }
  }
}

// Memory view toast notification
function mvToast(msg, duration) {
  var t = document.getElementById('mvToast'); if (!t) return;
  t.textContent = msg; t.style.display = 'block'; clearTimeout(t._timer);
  t._timer = setTimeout(function () { t.style.display = 'none'; }, duration || 3000);
}

// Collapsible cards initialisation
function mvInitCollapsibleCards() {
  document.querySelectorAll('.mv-card-head, .mv-panel-section-head, [data-mv-collapse]').forEach(function (head) {
    if (head.dataset.mvCollapsibleBound) return;
    head.dataset.mvCollapsibleBound = 'true';

    if (!head.querySelector('.mv-toggle-icon')) {
      var icon = document.createElement('i');
      icon.className = 'fas fa-chevron-down mv-toggle-icon';
      head.appendChild(icon);
    }

    head.addEventListener('click', function (e) {
      if (e.target.closest('button, input, select, textarea, a, label')) return;
      var container = head.closest('.mv-card, .mv-panel-section, [data-mv-collapse-container]');
      if (container) container.classList.toggle('collapsed');
    });
  });
}
window.mvInitCollapsibleCards = mvInitCollapsibleCards;

// Load memory overview
function _mvSet(id, val, prop) { var e = document.getElementById(id); if (e) e[prop || 'textContent'] = val; }

async function mvLoadOverview() {
  // Phase 4.5 pilot — observability: log capability availability. Background
  // refresh is never blocked (existing error handling renders the offline
  // state); this surfaces when a memory capability becomes unavailable.
  var caps = window.OliviaCapabilities;
  if (caps && typeof caps.availability === 'function') {
    ['memory.collections', 'memory.search', 'memory.ingest', 'memory.graph', 'memory.routing'].forEach(function (id) {
      var a = caps.availability(id);
      if (a && !a.available) {
        console.info('[OliviaMemory] capability ' + id + ' unavailable: ' + (a.reason || 'unknown'));
      }
    });
  }
  try {
    var data = await LA8159API.memory.collections();
    if (data.error) {
      mvSetHealth('mvHealthQdrant', 'off', 'Qdrant: offline');
      _mvSet('mvStatVectors', '—');
    } else {
      _mvCollections = Array.isArray(data) ? data : (data.collections || []);
      var totalPts = _mvCollections.reduce(function (sum, c) { return sum + _mvCollectionPoints(c); }, 0);
      var totalVectors = Number((data.totals && data.totals.vectors) || 0);
      if (!Number.isFinite(totalVectors) || totalVectors <= 0) {
        totalVectors = _mvCollections.reduce(function (sum, c) { return sum + _mvCollectionVectors(c); }, 0);
      }
      mvSetHealth('mvHealthQdrant', 'ok', 'Qdrant: ' + _mvCollections.length + ' coleções');
      _mvSet('mvStatVectors', totalVectors.toLocaleString());
      _mvSet('mvStatCollCount', _mvCollections.length + ' coleções');
      _mvSet('mvBadgeCollections', _mvCollections.length);
      mvRenderCollectionsList();
      mvRenderRoutingRules();
      var collHtml = _mvCollections.map(function (c) {
        var points = _mvCollectionPoints(c);
        var vectors = _mvCollectionVectors(c);
        var pct = Math.min(100, Math.round((points / Math.max(totalPts, 1)) * 100));
        return '<div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--border)">' +
          '<span class="memory-collection-dot ok"></span>' +
          '<span style="font-family:var(--mono);font-size:12px;color:var(--white);flex:1">' + escapeHtml(c.name) + '</span>' +
          '<span style="font-family:var(--mono);font-size:11px;color:var(--gray)">' + points.toLocaleString() + ' pts · ' + vectors.toLocaleString() + ' vec</span>' +
          '<span style="font-family:var(--mono);font-size:10px;color:var(--amber)">' + pct + '%</span></div>';
      }).join('');
      _mvSet('mvOverviewCollections', collHtml || '<div class="mv-empty"><p>Nenhuma coleção encontrada</p></div>', 'innerHTML');
      _mvSet('mvStatLong', totalVectors.toLocaleString());
    }
  } catch (e) { mvSetHealth('mvHealthQdrant', 'off', 'Qdrant: erro'); }

  try {
    var gdata = await LA8159API.memory.graphStats();
    _mvGraphData = gdata;
    if (gdata.status === 'connected') {
      var labels = gdata.labels || {};
      var relMap = gdata.relationships || {};
      var rels = Object.keys(relMap);
      var relTotal = rels.reduce(function (s, k) { return s + (Number(relMap[k]) || 0); }, 0);
      var totalNodes = Object.values(labels).reduce(function (s, v) { return s + v; }, 0);
      mvSetHealth('mvHealthNeo4j', 'ok', 'Neo4j: conectado');
      _mvSet('mvStatNodes', totalNodes.toLocaleString());
      _mvSet('mvStatRels', rels.length + ' tipos · ' + relTotal.toLocaleString() + ' rels');
      var graphHtml = '';
      for (var label in labels) {
        graphHtml += '<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);font-size:12px">' +
          '<span style="font-family:var(--mono);color:var(--gray-hi)">' + escapeHtml(label) + '</span>' +
          '<span style="font-family:var(--mono);color:var(--white);font-weight:500">' + labels[label].toLocaleString() + '</span></div>';
      }
      if (rels.length) graphHtml += '<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px"><span style="font-family:var(--mono);color:var(--gray-hi)">Relacionamentos</span><span style="font-family:var(--mono);color:var(--white);font-weight:500">' + rels.length + ' tipos · ' + relTotal.toLocaleString() + '</span></div>';
      _mvSet('mvOverviewGraph', graphHtml || '<div class="mv-empty"><p>Grafo vazio</p></div>', 'innerHTML');
    } else {
      mvSetHealth('mvHealthNeo4j', gdata.status === 'not_installed' ? 'warn' : 'off', 'Neo4j: ' + (gdata.status || 'offline'));
      _mvSet('mvStatNodes', '—');
    }
  } catch (e) { mvSetHealth('mvHealthNeo4j', 'off', 'Neo4j: erro'); }

  _mvSet('mvStatShort', _mvShortMemory.length);
  var vectorsEl = document.getElementById('mvStatVectors');
  var total = parseInt(((vectorsEl ? vectorsEl.textContent : '') || '0').replace(/\D/g, '')) || 0;
  var nodesEl2 = document.getElementById('mvStatNodes');
  var header = document.getElementById('mvHeaderStatus');
  if (header) header.textContent = total.toLocaleString() + ' memórias · ' + _mvCollections.length + ' coleções · ' + ((nodesEl2 ? nodesEl2.textContent : '') || '0') + ' nós';

  mvInitCollapsibleCards();
}

// Set health status indicator
function mvSetHealth(id, state, text) {
  var el = document.getElementById(id); if (!el) return;
  el.className = 'mv-health-pill ' + (state === 'ok' ? 'connected' : 'disconnected');
  el.innerHTML = '<span class="mv-health-dot ' + (state === 'ok' ? 'ok' : state === 'warn' ? 'warn' : 'off') + '"></span> ' + escapeHtml(text);
}

// Switch between memory panels
window.mvSwitchPanel = function (panel) {
  document.querySelectorAll('.mv-subnav-tab').forEach(function (t) { t.classList.toggle('active', t.dataset.panel === panel); });
  document.querySelectorAll('.mv-panel').forEach(function (p) { p.classList.toggle('active', p.id === 'mvPanel-' + panel); });
  if (panel === 'graph') mvLoadGraphPanel();
  if (panel === 'quadrants') mvLoadQuadrants();
  if (panel === 'redistribute') mvLoadRedistribute();
  if (panel === 'collections') mvLoadCollectionsPanel();
  if (panel === 'chat') _mvUpdatePanelContextIndicator();
  mvInitCollapsibleCards();
};

// Refresh all memory data
window.mvRefreshAll = async function () {
  await mvLoadOverview();
  mvLoadSidebarSummary();
  mvToast('Memória atualizada', 1500);
};

// Load collections panel
async function mvLoadCollectionsPanel() {
  await mvRefreshCollections();
}

function _mvRouteForCollection(name) {
  if (!_mvRoutingConfig || !_mvRoutingConfig.rules) return null;
  return _mvRoutingConfig.rules[name] || null;
}

function _mvCanReadCollection(name) {
  var rule = _mvRouteForCollection(name);
  return !rule || rule.readable !== false;
}

function _mvCanWriteCollection(name) {
  var rule = _mvRouteForCollection(name);
  return !rule || rule.writable !== false;
}

// Load search filters
function mvLoadSearchFilters() {
  var container = document.getElementById('mvSearchFilters'); if (!container) return;
  var html = '<button class="mv-filter-chip active" data-collection="" onclick="mvSetSearchFilter(this,\'\')"' + '>Todas</button>';
  _mvCollections
    .filter(function (c) { return _mvCanReadCollection(c.name); })
    .forEach(function (c) {
      html += '<button class="mv-filter-chip" data-collection="' + escapeHtml(c.name) + '" onclick="mvSetSearchFilter(this,\'' + escapeHtml(c.name) + '\')">' + escapeHtml(c.name) + '</button>';
    });
  container.innerHTML = html;
}

// Set search filter
window.mvSetSearchFilter = function (btn, collection) {
  document.querySelectorAll('.mv-filter-chip').forEach(function (c) { c.classList.remove('active'); });
  btn.classList.add('active');
  _mvSelectedCollection = collection;
  document.getElementById('mvSearchInput').focus();
};

// Expanded search result viewer
window._mvMemorySearchResults = [];
window.expandMemoryResult = function (i) {
  var r = window._mvMemorySearchResults[i];
  if (!r) return;
  var html = '<div class="mv-result-modal-body">' +
    '<div class="mv-result-header"><span class="mv-result-collection">' + escapeHtml(r.collection || 'default') + '</span>' +
    '<span class="mv-result-score">' + (r.score || 0).toFixed(4) + '</span></div>' +
    '<div class="mv-result-text">' + escapeHtml(r.text || r.content || '') + '</div>' +
    '<div class="mv-result-meta">' +
    '<div style="margin-top:10px;padding:8px;background:rgba(0,0,0,0.04);border-radius:4px;font-size:10px;font-family:var(--mono)">' +
    '<strong>Collection:</strong> ' + escapeHtml(r.collection || 'default') + '<br>' +
    (r.file_path ? '<strong>File:</strong> ' + escapeHtml(r.file_path) + '<br>' : '') +
    (r.doc_type ? '<strong>Type:</strong> ' + escapeHtml(r.doc_type) + '<br>' : '') +
    (r.created_at ? '<strong>Created:</strong> ' + escapeHtml(r.created_at) + '<br>' : '') +
    '</div>' +
    '</div>' +
    '</div>';
  var container = document.getElementById('mvSearchResultModalBody');
  if (!container) return;
  container.innerHTML = html;
  document.getElementById('mvSearchResultModal').style.display = 'block';
};

window.mvCloseSearchResultModal = function () {
  var m = document.getElementById('mvSearchResultModal');
  if (m) m.style.display = 'none';
};

// Search memory
window.mvSearch = async function () {
  var input = document.getElementById('mvSearchInput');
  var query = input.value.trim();
  if (!query) return;

  var results = document.getElementById('mvSearchResults');

  var gate = _mvCapabilityGate('memory.search');
  if (!gate.ok) {
    results.innerHTML = '<div class="mv-error"><i class="fas fa-exclamation-circle"></i> Busca indisponível: ' + escapeHtml(_mvCapabilityReason(gate.reason)) + '</div>';
    return;
  }

  results.innerHTML = '<div class="mv-loading"><span class="loading"></span> Searching...</div>';

  try {
    var data = await LA8159API.memory.search(query, _mvSelectedCollection);
    var items = data.results || [];
    window._mvMemorySearchResults = items;

    if (!items.length) {
      results.innerHTML = '<div class="mv-empty"><i class="fas fa-search"></i><p>No results</p></div>';
      return;
    }

    results.innerHTML = items.map(function (r, i) {
      return '<div class="mv-search-result" onclick="expandMemoryResult(' + i + ')">' +
        '<div class="mv-result-header">' +
        '<span class="mv-result-collection">' + escapeHtml(r.collection || 'default') + '</span>' +
        '<span class="mv-result-score">' + (r.score || 0).toFixed(3) + '</span>' +
        '</div>' +
        '<div class="mv-result-text">' + escapeHtml((r.text || '').substring(0, 200)) + '</div>' +
        '<div class="mv-result-meta">' +
        (r.file_path ? '<span><i class="fas fa-file"></i> ' + escapeHtml(r.file_path) + '</span>' : '') +
        (r.doc_type ? '<span><i class="fas fa-tag"></i> ' + escapeHtml(r.doc_type) + '</span>' : '') +
        '</div>' +
        '</div>';
    }).join('');
  } catch (e) {
    results.innerHTML = '<div class="mv-error"><i class="fas fa-exclamation-circle"></i> Search failed</div>';
  }
};

// Load ingest dropdowns
function mvLoadIngestDropdowns() {
  var writableCollections = _mvCollections.filter(function (c) { return _mvCanWriteCollection(c.name); });
  var activeAgentCollection = '';
  if (typeof selectedAgent !== 'undefined' && selectedAgent && selectedAgent.qdrant_collection) {
    activeAgentCollection = String(selectedAgent.qdrant_collection || '').trim();
  }

  // Free-text collection selector
  var sel = document.getElementById('mvIngestCollection');
  if (sel) {
    if (writableCollections.length) {
      sel.innerHTML = writableCollections.map(function (c) { return '<option value="' + escapeHtml(c.name) + '">' + escapeHtml(c.name) + '</option>'; }).join('');
      if (activeAgentCollection && writableCollections.some(function (c) { return c.name === activeAgentCollection; })) {
        sel.value = activeAgentCollection;
      }
    } else {
      sel.innerHTML = '<option value="awa_documents">awa_documents</option>';
    }
  }
  // Violation collection selector — show all + ensure awa_violations on top
  var vsel = document.getElementById('mvViolationCollection');
  if (vsel) {
    if (writableCollections.length) {
      var hasViol = writableCollections.some(function (c) { return c.name === 'awa_violations'; });
      var opts = ['<option value="awa_violations">awa_violations</option>'];
      if (activeAgentCollection && /viol/i.test(activeAgentCollection) && activeAgentCollection !== 'awa_violations') {
        opts.push('<option value="' + escapeHtml(activeAgentCollection) + '">' + escapeHtml(activeAgentCollection) + '</option>');
      }
      writableCollections.forEach(function (c) {
        if (c.name === 'awa_violations') return;
        if (c.name === activeAgentCollection && /viol/i.test(activeAgentCollection)) return;
        opts.push('<option value="' + escapeHtml(c.name) + '"' + (c.name === 'awa_violations' ? ' selected' : '') + '>' + escapeHtml(c.name) + '</option>');
      });
      vsel.innerHTML = opts.join('');
      vsel.value = hasViol ? 'awa_violations' : (activeAgentCollection && /viol/i.test(activeAgentCollection) ? activeAgentCollection : 'awa_violations');
    } else {
      vsel.innerHTML = '<option value="awa_violations">awa_violations</option>';
    }
  }
}

// Render tags
function mvRenderTags() {
  var wrapper = document.getElementById('mvTagsWrapper');
  var input = document.getElementById('mvTagsInput');
  if (!wrapper || !input) return;

  wrapper.querySelectorAll('.mv-tag-pill').forEach(function (p) { p.remove(); });
  _mvIngestTags.forEach(function (tag, i) {
    var pill = document.createElement('span');
    pill.className = 'mv-tag-pill';
    pill.innerHTML = escapeHtml(tag) + ' <button onclick="mvRemoveTag(' + i + ')">&times;</button>';
    wrapper.insertBefore(pill, input);
  });
}

// Remove tag
window.mvRemoveTag = function (idx) {
  _mvIngestTags.splice(idx, 1);
  mvRenderTags();
};

// Ingest text content into Qdrant via POST /api/memory/ingest
window.mvDoIngest = async function () {
  var textEl = document.getElementById('mvIngestText');
  var collEl = document.getElementById('mvIngestCollection');
  var btn = document.getElementById('mvIngestBtn');
  var statusEl = document.getElementById('mvIngestStatus');

  var text = textEl ? textEl.value.trim() : '';
  var collection = collEl ? collEl.value : 'awa_documents';

  var gate = _mvCapabilityGate('memory.ingest');
  if (!gate.ok) {
    mvToast('⚠ Ingestão indisponível: ' + _mvCapabilityReason(gate.reason), 3500);
    return;
  }

  if (!_mvCanWriteCollection(collection)) {
    mvToast('Escrita bloqueada para ' + collection + ' pelas regras de roteamento', 3000);
    return;
  }

  if (!text) {
    mvToast('Cole algum conteúdo antes de ingerir', 2500);
    if (textEl) { textEl.style.borderColor = 'var(--red)'; setTimeout(function () { textEl.style.borderColor = ''; }, 2000); }
    return;
  }

  // Visual: loading state
  var origBtnHtml = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="loading"></span> Ingerindo...'; }
  if (statusEl) { statusEl.style.display = 'none'; }

  var metadata = {};
  if (_mvIngestTags.length) metadata.tags = _mvIngestTags.join(',');
  metadata.source = 'user_input';
  metadata.doc_type = 'note';

  try {
    var data = await LA8159API.memory.ingest({ content: text, collection: collection, metadata: metadata });

    if (data.status === 'error') {
      throw new Error(data.message || data.detail || 'HTTP error');
    }

    // Success
    mvToast('✓ Ingerido em ' + collection + ' · id ' + (data.point_id || '').substring(0, 8) + '…', 3000);
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.style.color = 'var(--green)';
      statusEl.textContent = '✓ Conteúdo indexado em ' + collection;
    }
    if (textEl) textEl.value = '';
    _mvIngestTags = [];
    mvRenderTags();
    // Refresh overview counts after a short delay
    setTimeout(mvLoadOverview, 600);
  } catch (e) {
    mvToast('Erro ao ingerir: ' + e.message, 4000);
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.style.color = 'var(--red)';
      statusEl.textContent = 'Erro: ' + e.message;
    }
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = origBtnHtml; }
  }
};

// ── Ingest type switcher ──────────────────────────────────────────────────
var _mvIngestType = 'free';

window.mvSetIngestType = function (btn, type) {
  _mvIngestType = type;
  document.querySelectorAll('.mv-ingest-type-btn').forEach(function (b) { b.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  ['free', 'articles', 'violation', 'graph'].forEach(function (t) {
    var s = document.getElementById('mvIngestSection-' + t);
    if (s) s.style.display = t === type ? '' : 'none';
  });
};

// Law articles: live JSON preview
window.mvArticlesPreview = function () {
  var ta = document.getElementById('mvArticlesText');
  var prev = document.getElementById('mvArticlesPreviewEl');
  var lbl = document.getElementById('mvArticlesCollLabel');
  if (!ta || !prev) return;
  var val = ta.value.trim();
  if (!val) { prev.style.display = 'none'; return; }
  try {
    var arr = JSON.parse(val);
    if (!Array.isArray(arr)) {
      prev.style.display = 'block'; prev.style.color = 'var(--amber)';
      prev.textContent = '⚠ O JSON deve ser um array de artigos'; return;
    }
    var fc = arr[0] ? (arr[0].framework_code || '?') : '?';
    var region = arr[0] ? (arr[0].region || '') : '';
    var autoCol = 'law_' + fc.toLowerCase().replace(/[^a-z0-9]/g, '_');
    if (lbl) lbl.textContent = 'collection: ' + autoCol;
    prev.style.display = 'block'; prev.style.color = 'var(--green)';
    prev.textContent = '✓ ' + arr.length + ' artigos detectados · ' + (region ? region + ' · ' : '') + fc + ' → ' + autoCol;
  } catch (e) {
    prev.style.display = 'block'; prev.style.color = 'var(--red)';
    prev.textContent = 'JSON inválido: ' + e.message;
  }
};

// Violation: live JSON preview
window.mvViolationPreview = function () {
  var ta = document.getElementById('mvViolationText');
  var prev = document.getElementById('mvViolationPreviewEl');
  if (!ta || !prev) return;
  var val = ta.value.trim();
  if (!val) { prev.style.display = 'none'; return; }
  try {
    var obj = JSON.parse(val);
    var vid = obj.violation_id || obj.id || '?';
    var cat = obj.category || '?';
    var sev = obj.severity || '?';
    var region = obj.region || '';
    prev.style.display = 'block'; prev.style.color = 'var(--green)';
    prev.textContent = '✓ ' + vid + ' · ' + cat + ' · ' + sev + (region ? ' · ' + region : '');
  } catch (e) {
    prev.style.display = 'block'; prev.style.color = 'var(--red)';
    prev.textContent = 'JSON inválido: ' + e.message;
  }
};

// Ingest law articles — batch via /api/memory/ingest/articles
window.mvDoIngestArticles = async function () {
  var ta = document.getElementById('mvArticlesText');
  var btn = document.getElementById('mvIngestArticlesBtn');
  var statusEl = document.getElementById('mvIngestArticlesStatus');
  var val = ta ? ta.value.trim() : '';
  if (!val) { mvToast('Cole o JSON de artigos antes de ingerir', 2500); return; }
  var articles;
  try { articles = JSON.parse(val); } catch (e) { mvToast('JSON inválido: ' + e.message, 3000); return; }
  if (!Array.isArray(articles) || !articles.length) {
    mvToast('O JSON deve ser um array de artigos não-vazio', 2500); return;
  }
  var gate = _mvCapabilityGate('memory.ingest');
  if (!gate.ok) {
    mvToast('⚠ Ingestão de artigos indisponível: ' + _mvCapabilityReason(gate.reason), 3500);
    return;
  }
  var origHtml = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="loading"></span> Ingerindo ' + articles.length + ' artigos…'; }
  if (statusEl) statusEl.style.display = 'none';
  try {
    var data = await LA8159API.memory.ingestArticles(articles, '');
    if (data.status === 'error') throw new Error(data.message || 'HTTP error');
    mvToast('✓ ' + data.count + ' artigos ingeridos em ' + data.collection, 4000);
    if (statusEl) {
      statusEl.style.display = 'block'; statusEl.style.color = 'var(--green)';
      statusEl.textContent = '✓ ' + data.count + ' artigos indexados em ' + data.collection +
        (data.failed && data.failed.length ? ' · ' + data.failed.length + ' falhos' : '');
    }
    if (ta) ta.value = '';
    var prev = document.getElementById('mvArticlesPreviewEl'); if (prev) prev.style.display = 'none';
    var lbl = document.getElementById('mvArticlesCollLabel'); if (lbl) lbl.textContent = 'collection: auto';
    setTimeout(mvLoadOverview, 800);
  } catch (e) {
    mvToast('Erro: ' + e.message, 4000);
    if (statusEl) { statusEl.style.display = 'block'; statusEl.style.color = 'var(--red)'; statusEl.textContent = 'Erro: ' + e.message; }
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = origHtml; }
  }
};

// Ingest violation — via /api/memory/ingest/violation
window.mvDoIngestViolation = async function () {
  var ta = document.getElementById('mvViolationText');
  var btn = document.getElementById('mvIngestViolationBtn');
  var collEl = document.getElementById('mvViolationCollection');
  var statusEl = document.getElementById('mvIngestViolationStatus');
  var val = ta ? ta.value.trim() : '';
  if (!val) { mvToast('Cole o JSON de violação antes de ingerir', 2500); return; }
  var violation;
  try { violation = JSON.parse(val); } catch (e) { mvToast('JSON inválido: ' + e.message, 3000); return; }
  var collection = (collEl ? collEl.value : '') || 'awa_violations';
  var gate = _mvCapabilityGate('memory.ingest');
  if (!gate.ok) {
    mvToast('⚠ Ingestão de violação indisponível: ' + _mvCapabilityReason(gate.reason), 3500);
    return;
  }
  if (!_mvCanWriteCollection(collection)) {
    mvToast('Escrita bloqueada para ' + collection + ' pelas regras de roteamento', 3000);
    return;
  }
  var origHtml = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="loading"></span> Ingerindo…'; }
  if (statusEl) statusEl.style.display = 'none';
  try {
    var data = await LA8159API.memory.ingestViolation(violation, collection);
    if (data.status === 'error') throw new Error(data.message || 'HTTP error');
    var vid = data.violation_id || '';
    mvToast('✓ Violação ' + (vid || data.point_id.substring(0, 8)) + ' ingerida em ' + data.collection, 3500);
    if (statusEl) {
      statusEl.style.display = 'block'; statusEl.style.color = 'var(--green)';
      statusEl.textContent = '✓ ' + (vid || data.point_id.substring(0, 8)) + ' indexada em ' + data.collection;
    }
    if (ta) ta.value = '';
    var prev = document.getElementById('mvViolationPreviewEl'); if (prev) prev.style.display = 'none';
    setTimeout(mvLoadOverview, 800);
  } catch (e) {
    mvToast('Erro: ' + e.message, 4000);
    if (statusEl) { statusEl.style.display = 'block'; statusEl.style.color = 'var(--red)'; statusEl.textContent = 'Erro: ' + e.message; }
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = origHtml; }
  }
};

// Graph: live JSON preview
window.mvGraphPreview = function () {
  var ta = document.getElementById('mvGraphText');
  var prev = document.getElementById('mvGraphPreviewEl');
  if (!ta || !prev) return;
  var val = ta.value.trim();
  if (!val) { prev.style.display = 'none'; return; }
  try {
    var payload = JSON.parse(val);
    var nodes = Array.isArray(payload.nodes) ? payload.nodes.length : 0;
    var rels = Array.isArray(payload.relationships) ? payload.relationships.length : 0;
    if (!nodes && !rels) {
      prev.style.display = 'block';
      prev.style.color = 'var(--amber)';
      prev.textContent = '⚠ JSON válido, mas sem nodes/relationships';
      return;
    }
    prev.style.display = 'block';
    prev.style.color = 'var(--green)';
    prev.textContent = '✓ ' + nodes + ' nós · ' + rels + ' relações';
  } catch (e) {
    prev.style.display = 'block';
    prev.style.color = 'var(--red)';
    prev.textContent = 'JSON inválido: ' + e.message;
  }
};

// Ingest graph payload in Neo4j
window.mvDoIngestGraph = async function () {
  var ta = document.getElementById('mvGraphText');
  var btn = document.getElementById('mvIngestGraphBtn');
  var statusEl = document.getElementById('mvIngestGraphStatus');
  var val = ta ? ta.value.trim() : '';
  if (!val) { mvToast('Cole o JSON de grafo antes de ingerir', 2500); return; }

  var payload;
  try { payload = JSON.parse(val); } catch (e) { mvToast('JSON inválido: ' + e.message, 3000); return; }

  var gate = _mvCapabilityGate('memory.ingest');
  if (!gate.ok) {
    mvToast('⚠ Ingestão de grafo indisponível: ' + _mvCapabilityReason(gate.reason), 3500);
    return;
  }

  var origHtml = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="loading"></span> Ingerindo...'; }
  if (statusEl) statusEl.style.display = 'none';

  try {
    var data = await LA8159API.memory.graphIngest(
      Array.isArray(payload.nodes) ? payload.nodes : [],
      Array.isArray(payload.relationships) ? payload.relationships : []
    );
    if (data.status === 'error' || data.status === 'degraded') {
      throw new Error(data.error || data.message || 'HTTP error');
    }
    mvToast('✓ Grafo ingerido: ' + (data.nodes_upserted || 0) + ' nós · ' + (data.relationships_upserted || 0) + ' relações', 4000);
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.style.color = 'var(--green)';
      statusEl.textContent = '✓ Banco ' + (data.database || 'neo4j') + ': ' +
        (data.nodes_upserted || 0) + ' nós, ' + (data.relationships_upserted || 0) + ' relações';
    }
    if (ta) ta.value = '';
    var prev = document.getElementById('mvGraphPreviewEl'); if (prev) prev.style.display = 'none';
    setTimeout(mvLoadOverview, 600);
  } catch (e) {
    mvToast('Erro ao ingerir grafo: ' + e.message, 4000);
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.style.color = 'var(--red)';
      statusEl.textContent = 'Erro: ' + e.message;
    }
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = origHtml; }
  }
};

// Load graph panel
async function mvLoadGraphPanel() {
  // Placeholder - would call mvRefreshGraph()
}

// Load quadrants
async function mvLoadQuadrants() {
  var shortCritical = [], shortContext = [], longReference = [], longArchive = [];
  _mvShortMemory.forEach(function (item) { if (item.importance >= 8) shortCritical.push(item); else shortContext.push(item); });
  try {
    var data = await LA8159API.memory.search('important reference knowledge', '', { limit: 20, minScore: 0.1 });
    (data.results || []).forEach(function (r, i) { if (i < 10) longReference.push({ text: r.text, source: r.file_path || r.doc_type }); else longArchive.push({ text: r.text, source: r.file_path || r.doc_type }); });
  } catch (e) { /* silent */ }
  mvRenderQuadrant('mvQ1Body', 'mvQ1Count', shortCritical);
  mvRenderQuadrant('mvQ2Body', 'mvQ2Count', shortContext);
  mvRenderQuadrant('mvQ3Body', 'mvQ3Count', longReference);
  mvRenderQuadrant('mvQ4Body', 'mvQ4Count', longArchive);
  var total = shortCritical.length + shortContext.length + longReference.length + longArchive.length;
  if (total > 0) {
    document.getElementById('mvQuadrantDistribution').innerHTML =
      '<div style="display:flex;gap:4px;height:24px;border-radius:4px;overflow:hidden">' +
      '<div style="flex:' + (shortCritical.length || 0.5) + ';background:var(--red)" title="Crítica: ' + shortCritical.length + '"></div>' +
      '<div style="flex:' + (shortContext.length || 0.5) + ';background:var(--amber)" title="Contexto: ' + shortContext.length + '"></div>' +
      '<div style="flex:' + (longReference.length || 0.5) + ';background:var(--blue)" title="Referência: ' + longReference.length + '"></div>' +
      '<div style="flex:' + (longArchive.length || 0.5) + ';background:var(--gray)" title="Arquivo: ' + longArchive.length + '"></div></div>' +
      '<div style="display:flex;gap:16px;margin-top:8px;font-size:10px;color:var(--gray)"><span><i class="fas fa-square" style="color:var(--red)"></i> Crítica: ' + shortCritical.length + '</span><span><i class="fas fa-square" style="color:var(--amber)"></i> Contexto: ' + shortContext.length + '</span><span><i class="fas fa-square" style="color:var(--blue)"></i> Referência: ' + longReference.length + '</span><span><i class="fas fa-square" style="color:var(--gray)"></i> Arquivo: ' + longArchive.length + '</span></div>';
  }
}

// Render quadrant
function mvRenderQuadrant(bodyId, countId, items) {
  document.getElementById(countId).textContent = items.length;
  var body = document.getElementById(bodyId);
  if (!body) return;

  if (!items.length) { body.innerHTML = '<div class="mv-empty" style="padding:16px"><i class="fas fa-inbox" style="font-size:18px"></i><p style="font-size:11px">Vazio</p></div>'; return; }
  body.innerHTML = items.map(function (item) { var text = (item.text || '').substring(0, 120); return '<div class="mv-quadrant-item" title="' + escapeHtml(item.source || '') + '">' + escapeHtml(text) + (item.text && item.text.length > 120 ? '...' : '') + '</div>'; }).join('');
}

// Add chat bubble
function mvAddChatBubble(role, html) {
  var log = document.getElementById('mvChatLog');
  var bubble = document.createElement('div');
  bubble.className = 'mv-chat-bubble ' + role;
  bubble.innerHTML = html;
  log.appendChild(bubble);
  log.scrollTop = log.scrollHeight;
}

// Load redistribute panel
function mvLoadRedistribute() {
  var shortCount = _mvShortMemory.length;
  var vEl = document.getElementById('mvStatVectors');
  var nEl = document.getElementById('mvStatNodes');
  var vectorCount = parseInt(((vEl ? vEl.textContent : '') || '0').replace(/\D/g, '')) || 0;
  var graphCount = parseInt(((nEl ? nEl.textContent : '') || '0').replace(/\D/g, '')) || 0;
  var total = Math.max(shortCount + vectorCount + graphCount, 1);
  _mvSet('mvRedistShort', shortCount);
  _mvSet('mvRedistVector', vectorCount.toLocaleString());
  document.getElementById('mvRedistGraph').textContent = graphCount.toLocaleString();
  document.getElementById('mvRedistShortBar').style.width = Math.round((shortCount / total) * 100) + '%';
  document.getElementById('mvRedistVectorBar').style.width = Math.round((vectorCount / total) * 100) + '%';
  document.getElementById('mvRedistGraphBar').style.width = Math.round((graphCount / total) * 100) + '%';
  // Hide AI analysis panel on reload
  var analysisEl = document.getElementById('mvRedistAnalysis');
  if (analysisEl) analysisEl.style.display = 'none';
  mvInitCollapsibleCards();
}

// AI-powered memory analysis — asks LA8159 to advise on memory distribution
async function mvAnalyzeWithAI() {
  var analysisEl = document.getElementById('mvRedistAnalysis');
  if (!analysisEl) return;

  var gate = _mvCapabilityGate('assistant.chat');
  if (!gate.ok) {
    analysisEl.style.display = 'block';
    analysisEl.innerHTML = '<div style="color:var(--red);font-size:11px">Análise indisponível: ' + escapeHtml(_mvCapabilityReason(gate.reason)) + '</div>';
    return;
  }

  analysisEl.style.display = 'block';
  analysisEl.innerHTML = '<div class="mv-loading"><span class="loading"></span> A LA8159 está analisando sua memória...</div>';

  var sectionCtx = (typeof window.LA8159ResolveSectionAgentContext === 'function')
    ? window.LA8159ResolveSectionAgentContext('memory')
    : null;
  if (sectionCtx && sectionCtx.assigned && !sectionCtx.active) {
    var inactiveName = sectionCtx.agent ? (sectionCtx.agent.name || sectionCtx.agent.agent_id) : sectionCtx.agentId;
    analysisEl.innerHTML = '<div style="color:var(--red);font-size:11px">Agente de Memória inativo: ' + escapeHtml(inactiveName) + '</div>';
    return;
  }

  var vEl = document.getElementById('mvStatVectors');
  var nEl = document.getElementById('mvStatNodes');
  var vectorCount = parseInt(((vEl ? vEl.textContent : '') || '0').replace(/\D/g, '')) || 0;
  var graphCount = parseInt(((nEl ? nEl.textContent : '') || '0').replace(/\D/g, '')) || 0;
  var collNames = _mvCollections.map(function (c) { return c.name + ' (' + (c.points || 0).toLocaleString() + ' pts)'; }).join(', ');

  var prompt = 'Analise a distribuição de memória da LA8159:\n' +
    '- Curto prazo (sessão): ' + _mvShortMemory.length + ' itens\n' +
    '- Vetor Qdrant (semântico): ' + vectorCount.toLocaleString() + ' vetores em ' + _mvCollections.length + ' coleções: ' + collNames + '\n' +
    '- Grafo Neo4j (relacional): ' + graphCount.toLocaleString() + ' nós\n\n' +
    'Com base nesses números, dê uma análise breve (3-5 linhas) sobre:\n' +
    '1. Se a distribuição está balanceada\n' +
    '2. Qual camada está subutilizada ou sobrecarregada\n' +
    '3. Uma recomendação de ação concreta\n' +
    'Responda de forma objetiva e direta.';

  try {
    var analyzeOpts = {
      sessionKey: sectionCtx && sectionCtx.sessionKey ? sectionCtx.sessionKey : 'section:memory:default',
      system: sectionCtx && sectionCtx.system ? sectionCtx.system : undefined,
      agentId: sectionCtx && sectionCtx.agentId ? sectionCtx.agentId : undefined,
    };
    if (typeof getCurrentProjectId === 'function') {
      var analyzeProjectId = getCurrentProjectId();
      if (analyzeProjectId) analyzeOpts.projectId = analyzeProjectId;
    }

    var fullResponse = await LA8159API.assistant.chat(prompt + _mvGetPanelContextText(), analyzeOpts, function (token, accumulated) {
      analysisEl.innerHTML = '<div style="font-size:12px;color:var(--gray-hi);line-height:1.6;padding:4px 0">' +
        (typeof marked !== 'undefined' ? marked.parse(accumulated) : escapeHtml(accumulated)) + '</div>';
    });
    analysisEl.innerHTML = '<div style="font-size:12px;color:var(--gray-hi);line-height:1.6;padding:4px 0">' +
      (typeof marked !== 'undefined' ? marked.parse(fullResponse) : escapeHtml(fullResponse)) + '</div>';
  } catch (e) {
    analysisEl.innerHTML = '<div style="color:var(--red);font-size:11px">Erro ao analisar: ' + e.message + '</div>';
  }
}

function mvRenderRoutingRules() {
  var list = document.getElementById('mvRoutingRulesList');
  if (!list) return;

  var names = {};
  _mvCollections.forEach(function (c) { names[c.name] = true; });
  Object.keys((_mvRoutingConfig && _mvRoutingConfig.rules) || {}).forEach(function (k) { names[k] = true; });
  var allCollections = Object.keys(names).sort();

  if (!allCollections.length) {
    list.innerHTML = '<div class="mv-empty" style="padding:16px"><p style="font-size:11px">Nenhuma coleção disponível ainda.</p></div>';
    return;
  }

  list.innerHTML = allCollections.map(function (name) {
    var rule = _mvRouteForCollection(name) || {};
    var readable = rule.readable !== false;
    var writable = rule.writable !== false;
    var url = rule.qdrant_url || '';
    var notes = rule.notes || '';
    return '<div class="mv-routing-row" data-collection="' + escapeHtml(name) + '">' +
      '<div class="mv-routing-header">' +
      '<div class="mv-routing-name">' + escapeHtml(name) + '</div>' +
      '<div class="mv-routing-flags">' +
      '<label><input class="mv-routing-read" type="checkbox" ' + (readable ? 'checked' : '') + ' name="mvRoutingRead_' + escapeHtml(name) + '"> Ler</label>' +
      '<label><input class="mv-routing-write" type="checkbox" ' + (writable ? 'checked' : '') + ' name="mvRoutingWrite_' + escapeHtml(name) + '"> Escrever</label>' +
      '</div>' +
      '</div>' +
      '<input class="mv-routing-input mv-routing-url" type="text" value="' + escapeHtml(url) + '" placeholder="Qdrant URL (vazio = usa padrão ativo)" name="mvRoutingUrl_' + escapeHtml(name) + '">' +
      '<input class="mv-routing-input mv-routing-key" type="password" value="" placeholder="Nova API key (opcional; vazio mantém a atual)" name="mvRoutingKey_' + escapeHtml(name) + '">' +
      '<input class="mv-routing-input mv-routing-notes" type="text" value="' + escapeHtml(notes) + '" placeholder="Observações da regra (opcional)" name="mvRoutingNotes_' + escapeHtml(name) + '">' +
      '</div>';
  }).join('');

  mvInitCollapsibleCards();
}

window.mvAddRoutingRule = function () {
  var name = prompt('Nome da coleção para adicionar regra:');
  if (!name) return;
  name = String(name).trim();
  if (!name) return;
  _mvRoutingConfig.rules = _mvRoutingConfig.rules || {};
  if (!_mvRoutingConfig.rules[name]) {
    _mvRoutingConfig.rules[name] = { readable: true, writable: true, qdrant_url: '', notes: '' };
  }
  mvRenderRoutingRules();
};

async function mvLoadRoutingConfig() {
  try {
    var data = await LA8159API.memory.routing();
    var rules = {};
    (data.rules || []).forEach(function (r) {
      rules[r.collection] = {
        readable: r.readable !== false,
        writable: r.writable !== false,
        qdrant_url: r.qdrant_url || '',
        notes: r.notes || ''
      };
    });
    _mvRoutingConfig = {
      default_qdrant_url: data.default_qdrant_url || '',
      rules: rules
    };
  } catch (e) {
    // Keep existing local state if backend is unavailable.
  }
  mvRenderRoutingRules();
  mvLoadSearchFilters();
  mvLoadIngestDropdowns();
}

window.mvLoadRoutingConfig = mvLoadRoutingConfig;

window.mvSaveRoutingConfig = async function () {
  var list = document.getElementById('mvRoutingRulesList');
  if (!list) return;

  var gate = _mvCapabilityGate('memory.routing');
  if (!gate.ok) {
    mvToast('⚠ Roteamento indisponível: ' + _mvCapabilityReason(gate.reason), 3500);
    return;
  }
  var rows = list.querySelectorAll('.mv-routing-row');
  var rules = [];
  rows.forEach(function (row) {
    var collection = row.getAttribute('data-collection') || '';
    collection = collection.trim();
    if (!collection) return;
    var readEl = row.querySelector('.mv-routing-read');
    var writeEl = row.querySelector('.mv-routing-write');
    var urlEl = row.querySelector('.mv-routing-url');
    var keyEl = row.querySelector('.mv-routing-key');
    var notesEl = row.querySelector('.mv-routing-notes');
    rules.push({
      collection: collection,
      readable: !!(readEl && readEl.checked),
      writable: !!(writeEl && writeEl.checked),
      qdrant_url: (urlEl && urlEl.value ? urlEl.value : '').trim(),
      qdrant_api_key: (keyEl && keyEl.value ? keyEl.value : '').trim(),
      notes: (notesEl && notesEl.value ? notesEl.value : '').trim()
    });
  });

  var payload = {
    default_qdrant_url: (document.getElementById('mvConfigQdrantUrl') || {}).value || '',
    default_qdrant_api_key: (document.getElementById('mvConfigQdrantApiKey') || {}).value || '',
    rules: rules
  };

  try {
    var data = await LA8159API.memory.routingSave(payload);
    if (data.status !== 'ok') throw new Error(data.error || data.detail || 'HTTP error');
    mvToast('✓ Roteamento salvo', 2200);
    await mvLoadRoutingConfig();
    await mvRefreshCollections();
  } catch (e) {
    mvToast('Erro ao salvar roteamento: ' + e.message, 4000);
  }
};

// Qdrant / Neo4j preset source URLs — loaded from server on first use
var MV_QDRANT_PRESETS = {
  local: { url: 'http://localhost:6333', api_key: '' },
  cloud: { url: '', api_key: '' }
};
var MV_NEO4J_PRESETS = {
  local: { uri: 'bolt://localhost:7687', user: 'neo4j', pass: '' },
  desktop: { uri: 'bolt://localhost:7688', user: 'neo4j', pass: '' },
  cloud: { uri: '', user: '', pass: '' }
};
var MV_QDRANT_DASHBOARD_URL = '';
var MV_NEO4J_CONSOLE_URL = 'https://console-preview.neo4j.io/projects';

// Fetch available sources from server and populate presets
async function mvLoadSourcePresets() {
  try {
    var data = await LA8159API.memory.sources();
    if (data.qdrant) {
      if (data.qdrant.local && data.qdrant.local.url) MV_QDRANT_PRESETS.local.url = data.qdrant.local.url;
      if (data.qdrant.cloud && data.qdrant.cloud.url) MV_QDRANT_PRESETS.cloud.url = data.qdrant.cloud.url;
    }
    if (data.neo4j) {
      if (data.neo4j.local) { if (data.neo4j.local.uri) MV_NEO4J_PRESETS.local.uri = data.neo4j.local.uri; if (data.neo4j.local.user) MV_NEO4J_PRESETS.local.user = data.neo4j.local.user; }
      if (data.neo4j.desktop) { if (data.neo4j.desktop.uri) MV_NEO4J_PRESETS.desktop.uri = data.neo4j.desktop.uri; if (data.neo4j.desktop.user) MV_NEO4J_PRESETS.desktop.user = data.neo4j.desktop.user; }
      if (data.neo4j.cloud) { if (data.neo4j.cloud.uri) MV_NEO4J_PRESETS.cloud.uri = data.neo4j.cloud.uri; if (data.neo4j.cloud.user) MV_NEO4J_PRESETS.cloud.user = data.neo4j.cloud.user; }
      if (data.neo4j.console_url) MV_NEO4J_CONSOLE_URL = data.neo4j.console_url;
    }
    if (data.dashboards) {
      if (data.dashboards.qdrant_collections_url) MV_QDRANT_DASHBOARD_URL = data.dashboards.qdrant_collections_url;
      if (data.dashboards.neo4j_console_url) MV_NEO4J_CONSOLE_URL = data.dashboards.neo4j_console_url;
    }
  } catch (e) { /* use static defaults */ }
}
if (!window.Olivia_EMBED_MODE) {
  mvLoadSourcePresets(); // load in background on module init
}

function _mvOpenUrlInBrowser(url) {
  var target = String(url || '').trim();
  if (!target) {
    mvToast('URL indisponível', 2500);
    return;
  }
  var panel = document.getElementById('browserPanel');
  if (panel && !panel.classList.contains('open') && typeof toggleBrowserPanel === 'function') {
    toggleBrowserPanel();
  }
  if (typeof navigateBrowser === 'function') {
    navigateBrowser(target);
  } else {
    var iframe = document.getElementById('browserFrame');
    if (iframe) iframe.src = target;
  }
}

window.mvOpenQdrantDashboard = function () {
  var configured = (document.getElementById('mvConfigQdrantUrl') || {}).value || '';
  var base = String(configured || MV_QDRANT_PRESETS.cloud.url || '').trim();
  var target = String(MV_QDRANT_DASHBOARD_URL || '').trim();
  if (!target && base) {
    var clean = base.replace(/\/$/, '');
    if (clean.indexOf(':6333') === -1) clean = clean + ':6333';
    target = clean + '/dashboard#/collections';
  }
  _mvOpenUrlInBrowser(target);
};

window.mvOpenNeo4jConsole = function () {
  _mvOpenUrlInBrowser(MV_NEO4J_CONSOLE_URL);
};

// Select Qdrant source and fill URL field
window.mvSelectQdrantSource = function (mode) {
  var preset = MV_QDRANT_PRESETS[mode];
  if (!preset) return;
  var urlEl = document.getElementById('mvConfigQdrantUrl');
  if (urlEl) urlEl.value = preset.url;
  // Only clear the API key field when switching to local; don't overwrite saved cloud key
  var keyEl = document.getElementById('mvConfigQdrantApiKey');
  if (keyEl && mode === 'local') keyEl.value = '';
  // Highlight active button
  var lb = document.getElementById('mvQdrantLocalBtn');
  var cb = document.getElementById('mvQdrantCloudBtn');
  if (lb) { lb.style.borderColor = mode === 'local' ? 'var(--amber)' : ''; lb.style.color = mode === 'local' ? 'var(--amber)' : ''; }
  if (cb) { cb.style.borderColor = mode === 'cloud' ? 'var(--amber)' : ''; cb.style.color = mode === 'cloud' ? 'var(--amber)' : ''; }
};

// Select Neo4j source and fill URI/user fields
window.mvSelectNeo4jSource = function (mode) {
  var preset = MV_NEO4J_PRESETS[mode];
  if (!preset) return;
  var uriEl = document.getElementById('mvConfigNeo4jUri');
  var userEl = document.getElementById('mvConfigNeo4jUser');
  if (uriEl) uriEl.value = preset.uri;
  if (userEl) userEl.value = preset.user;
  // Clear password when switching sources so user consciously enters it
  var passEl = document.getElementById('mvConfigNeo4jPass');
  if (passEl) passEl.value = '';
  // Highlight active button, clear others
  ['Local', 'Desktop', 'Cloud'].forEach(function (m) {
    var btn = document.getElementById('mvNeo4j' + m + 'Btn');
    var active = mode === m.toLowerCase();
    if (btn) { btn.style.borderColor = active ? 'var(--amber)' : ''; btn.style.color = active ? 'var(--amber)' : ''; }
  });
};

// Load config — pull active config from server first, fall back to localStorage
async function mvLoadConfig() {
  // Pull the server's currently active connection so the UI reflects truth
  try {
    var srv = await LA8159API.memory.config();
    var local = {};
    try { local = JSON.parse(localStorage.getItem('OliviaLegal.memory.config') || '{}'); } catch (e) { }
    // Server values win (they reflect what's actually being used)
    if (srv.qdrant_url) local.qdrant_url = srv.qdrant_url;
    if (srv.neo4j_uri) local.neo4j_uri = srv.neo4j_uri;
    if (srv.neo4j_user) local.neo4j_user = srv.neo4j_user;
    if (srv.embed_model) local.embed_model = srv.embed_model;
    if (srv.extract_model) local.extract_model = srv.extract_model;
    localStorage.setItem('OliviaLegal.memory.config', JSON.stringify(local));
  } catch (e) { /* server unreachable — use localStorage only */ }

  try {
    var saved = JSON.parse(localStorage.getItem('OliviaLegal.memory.config') || '{}');
    if (saved.qdrant_url) { var el = document.getElementById('mvConfigQdrantUrl'); if (el) el.value = saved.qdrant_url; }
    if (saved.qdrant_api_key) { var el = document.getElementById('mvConfigQdrantApiKey'); if (el) el.value = saved.qdrant_api_key; }
    if (saved.neo4j_uri) { var el = document.getElementById('mvConfigNeo4jUri'); if (el) el.value = saved.neo4j_uri; }
    if (saved.neo4j_user) { var el = document.getElementById('mvConfigNeo4jUser'); if (el) el.value = saved.neo4j_user; }
    if (saved.neo4j_pass) { var el = document.getElementById('mvConfigNeo4jPass'); if (el) el.value = saved.neo4j_pass; }
    if (saved.embed_model) { var el = document.getElementById('mvConfigEmbedModel'); if (el) el.value = saved.embed_model; }
    if (saved.extract_model) { var el = document.getElementById('mvConfigExtractModel'); if (el) el.value = saved.extract_model; }
    if (saved.auto_promote !== undefined) { var el = document.getElementById('mvConfigAutoPromote'); if (el) el.checked = saved.auto_promote; }
    if (saved.auto_extract !== undefined) { var el = document.getElementById('mvConfigAutoExtract'); if (el) el.checked = saved.auto_extract; }
    // Restore source button highlights
    if (saved.qdrant_url) {
      var isCloud = saved.qdrant_url.indexOf('cloud.qdrant.io') !== -1;
      var lb = document.getElementById('mvQdrantLocalBtn'), cb = document.getElementById('mvQdrantCloudBtn');
      if (lb) { lb.style.borderColor = !isCloud ? 'var(--amber)' : ''; lb.style.color = !isCloud ? 'var(--amber)' : ''; }
      if (cb) { cb.style.borderColor = isCloud ? 'var(--amber)' : ''; cb.style.color = isCloud ? 'var(--amber)' : ''; }
    }
    if (saved.neo4j_uri) {
      var isCloud = saved.neo4j_uri.indexOf('neo4j+s://') === 0;
      var lb = document.getElementById('mvNeo4jLocalBtn'), cb = document.getElementById('mvNeo4jCloudBtn');
      if (lb) { lb.style.borderColor = !isCloud ? 'var(--amber)' : ''; lb.style.color = !isCloud ? 'var(--amber)' : ''; }
      if (cb) { cb.style.borderColor = isCloud ? 'var(--amber)' : ''; cb.style.color = isCloud ? 'var(--amber)' : ''; }
    }
  } catch (e) { }

  // Cloud is the default source for LA8159 workspace memory.
  if (!(document.getElementById('mvConfigQdrantUrl') || {}).value) {
    mvSelectQdrantSource('cloud');
  }
  if (!(document.getElementById('mvConfigNeo4jUri') || {}).value) {
    mvSelectNeo4jSource('cloud');
  }

  // Keep routing editor synchronized with backend policy.
  mvLoadRoutingConfig();
}

// Save config to localStorage AND push to server so backend reconnects
async function mvSaveConfig() {
  var btn = document.querySelector('#mvPanel-config .btn[onclick*="mvSaveConfig"]') ||
    document.querySelector('#mvPanel-config button');
  var orig = btn ? btn.innerHTML : '';
  try {
    var config = {
      qdrant_url: (document.getElementById('mvConfigQdrantUrl') || {}).value || '',
      qdrant_api_key: (document.getElementById('mvConfigQdrantApiKey') || {}).value || '',
      neo4j_uri: (document.getElementById('mvConfigNeo4jUri') || {}).value || '',
      neo4j_user: (document.getElementById('mvConfigNeo4jUser') || {}).value || '',
      neo4j_pass: (document.getElementById('mvConfigNeo4jPass') || {}).value || '',
      embed_model: (document.getElementById('mvConfigEmbedModel') || {}).value || '',
      extract_model: (document.getElementById('mvConfigExtractModel') || {}).value || '',
      auto_extract: !!(document.getElementById('mvConfigAutoExtract') || {}).checked,
      auto_promote: !!(document.getElementById('mvConfigAutoPromote') || {}).checked,
    };
    // 1. Persist locally
    localStorage.setItem('OliviaLegal.memory.config', JSON.stringify(config));
    // 2. Push to server so backend reconnects immediately
    await LA8159API.memory.configSave({
      qdrant_url: config.qdrant_url,
      qdrant_api_key: config.qdrant_api_key,
      neo4j_uri: config.neo4j_uri,
      neo4j_user: config.neo4j_user,
      neo4j_pass: config.neo4j_pass,
      embed_model: config.embed_model,
      extract_model: config.extract_model,
    });
    // Visual feedback: green
    if (btn) {
      btn.innerHTML = '<i class="fas fa-check-circle"></i> Salvo ✓';
      btn.style.borderColor = 'var(--green)';
      btn.style.color = 'var(--green)';
      setTimeout(function () {
        btn.innerHTML = orig;
        btn.style.borderColor = 'var(--amber)';
        btn.style.color = 'var(--amber)';
      }, 2500);
    }
    mvToast('\u2713 Config aplicada ao servidor', 2000);
    // Refresh overview to show new data source
    setTimeout(mvLoadOverview, 400);
  } catch (e) {
    if (btn) { btn.innerHTML = orig; }
    mvToast('Erro: ' + e.message, 4000);
  }
}

// Load sidebar summary
async function mvLoadSidebarSummary() {
  try {
    var data = await LA8159API.memory.collections();
    var cols = Array.isArray(data) ? data : (data.collections || []);
    if (cols.length) {
      var total = cols.reduce(function (s, c) { return s + (c.points || 0); }, 0);
      var el = document.getElementById('mvSidebarVectorCount'); if (el) el.textContent = total.toLocaleString();
      var qs = document.getElementById('mvSidebarQdrantStatus'); if (qs) { qs.textContent = cols.length + ' coleções'; qs.style.color = 'var(--green)'; }
    } else { var qs2 = document.getElementById('mvSidebarQdrantStatus'); if (qs2) { qs2.textContent = 'offline'; qs2.style.color = 'var(--red)'; } }
  } catch (e) { var qs3 = document.getElementById('mvSidebarQdrantStatus'); if (qs3) { qs3.textContent = 'erro'; qs3.style.color = 'var(--red)'; } }

  try {
    var gdata = await LA8159API.memory.graphStats();
    if (gdata.status === 'connected') {
      var nodes = Object.values(gdata.labels || {}).reduce(function (s, v) { return s + v; }, 0);
      var el2 = document.getElementById('mvSidebarGraphCount'); if (el2) el2.textContent = nodes.toLocaleString();
      var ns = document.getElementById('mvSidebarNeo4jStatus'); if (ns) { ns.textContent = 'conectado'; ns.style.color = 'var(--green)'; }
    } else { var ns2 = document.getElementById('mvSidebarNeo4jStatus'); if (ns2) { ns2.textContent = gdata.status || 'offline'; ns2.style.color = 'var(--red)'; } }
  } catch (e) { var ns3 = document.getElementById('mvSidebarNeo4jStatus'); if (ns3) { ns3.textContent = 'erro'; ns3.style.color = 'var(--red)'; } }

  var sc = document.getElementById('mvSidebarShortCount'); if (sc) sc.textContent = _mvShortMemory.length + ' itens';
}

// Render collections list in the Collections panel
function mvRenderCollectionsList() {
  var list = document.getElementById('mvCollectionsList');
  if (!list) return;
  if (!_mvCollections.length) {
    list.innerHTML = '<div class="mv-empty"><i class="fas fa-layer-group" style="font-size:22px;color:var(--border-hi)"></i><p style="font-size:12px;margin-top:8px">Nenhuma coleção encontrada</p></div>';
    return;
  }
  var totalPts = _mvCollections.reduce(function (s, c) { return s + _mvCollectionPoints(c); }, 0);
  var labels = {
    awa_documents: 'Documentos, specs, SOPs',
    awa_conversations: 'Conversas e sessões de agente',
    awa_code: 'Código-fonte, funções, scripts',
    awa_ontology: 'Ontologia e invariantes do sistema',
    awa_violations: 'Violações refinadas e evidências'
  };
  list.innerHTML = _mvCollections.map(function (c) {
    var points = _mvCollectionPoints(c);
    var vectors = _mvCollectionVectors(c);
    var pct = Math.min(100, Math.round((points / Math.max(totalPts, 1)) * 100));
    var desc = labels[c.name] || 'Coleção Qdrant';
    var target = c.target_qdrant ? String(c.target_qdrant).replace(/^https?:\/\//, '').replace(/\/$/, '') : 'padrão';
    var readable = c.readable !== false;
    var writable = c.writable !== false;
    var access = (readable ? 'R+' : 'R-') + ' / ' + (writable ? 'W+' : 'W-');
    var dotClass = readable || writable ? 'ok' : 'off';
    return '<div class="memory-collection" data-collection="' + escapeHtml(c.name) + '" onclick="mvOpenCollectionDetails(this.dataset.collection)" style="flex-direction:column;align-items:stretch;gap:6px;cursor:pointer">' +
      '<div style="display:flex;align-items:center;gap:8px">' +
      '<span class="memory-collection-dot ' + dotClass + '"></span>' +
      '<div style="flex:1;min-width:0">' +
      '<div class="memory-collection-name">' + escapeHtml(c.name) + '</div>' +
      '<div style="font-size:10px;color:var(--gray);margin-top:1px">' + escapeHtml(desc) + ' · ' + escapeHtml(access) + ' · ' + escapeHtml(target) + '</div>' +
      '</div>' +
      '<span class="memory-collection-count">' + points.toLocaleString() + ' pts · ' + vectors.toLocaleString() + ' vec · ' + pct + '%</span>' +
      '</div>' +
      '<div style="height:4px;background:var(--border);border-radius:2px;overflow:hidden">' +
      '<div style="height:100%;width:' + pct + '%;background:var(--amber);border-radius:2px;transition:width .3s"></div>' +
      '</div>' +
      '</div>';
  }).join('');

  if (_mvCollectionDetailsOpen) {
    var stillExists = _mvCollections.some(function (c) { return c.name === _mvCollectionDetailsOpen; });
    if (stillExists) {
      window.mvOpenCollectionDetails(_mvCollectionDetailsOpen, true);
    }
  }

  mvInitCollapsibleCards();
}

window.mvOpenCollectionDetails = async function (collectionName, silent) {
  var name = String(collectionName || '').trim();
  if (!name) return;
  _mvCollectionDetailsOpen = name;
  var box = document.getElementById('mvCollectionDetail');
  if (!box) return;

  var gate = _mvCapabilityGate('memory.collections');
  if (!gate.ok) {
    if (!silent) {
      box.innerHTML = '<div style="font-size:11px;color:var(--red)">Detalhes indisponíveis: ' + escapeHtml(_mvCapabilityReason(gate.reason)) + '</div>';
    }
    return;
  }

  if (!silent) {
    box.innerHTML = '<div class="mv-loading"><span class="loading"></span> Carregando detalhes de ' + escapeHtml(name) + '...</div>';
  }

  try {
    var data = await LA8159API.memory.collectionDetails(name);
    var c = data.collection || {};
    var samples = Array.isArray(data.samples) ? data.samples : [];
    var status = c.status || 'unknown';
    var points = _mvCollectionPoints(c);
    var vectors = _mvCollectionVectors(c);
    var head =
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px">' +
      '<div style="font-size:12px;color:var(--white);font-family:var(--mono)">' + escapeHtml(name) + '</div>' +
      '<div style="font-size:11px;color:var(--gray)">' + points.toLocaleString() + ' pts · ' + vectors.toLocaleString() + ' vec · size ' + (c.vector_size || '?') + '</div>' +
      '</div>' +
      '<div style="font-size:10px;color:var(--gray);margin-top:3px">status: ' + escapeHtml(status) + '</div>';

    if (!samples.length) {
      box.innerHTML = head + '<div class="mv-empty" style="margin-top:8px;padding:10px"><p style="font-size:11px">Sem amostras para exibir (scroll vazio).</p></div>';
      return;
    }

    var rows = samples.map(function (s) {
      var sid = String(s.violation_id || s.id || '').trim();
      var preview = String(s.text || '').trim();
      var keys = Array.isArray(s.payload_keys) ? s.payload_keys.join(', ') : '';
      return '<div style="padding:7px 0;border-top:1px solid var(--border)">' +
        (sid ? '<div style="font-family:var(--mono);font-size:10px;color:var(--amber);margin-bottom:3px">' + escapeHtml(sid) + '</div>' : '') +
        '<div style="font-size:11px;color:var(--gray-hi);line-height:1.4">' + escapeHtml(preview || '(sem texto)') + '</div>' +
        (keys ? '<div style="font-size:10px;color:var(--gray);margin-top:3px">keys: ' + escapeHtml(keys) + '</div>' : '') +
        '</div>';
    }).join('');

    box.innerHTML = head + '<div style="margin-top:8px">' + rows + '</div>';
  } catch (e) {
    box.innerHTML = '<div style="font-size:11px;color:var(--red)">Falha ao carregar detalhes: ' + escapeHtml(e.message || String(e)) + '</div>';
  }
};

// Refresh collections
window.mvRefreshCollections = async function () {
  mvToast('Atualizando coleções...', 1500);
  await mvLoadOverview();
  mvLoadSearchFilters();
  mvLoadIngestDropdowns();
  mvRenderCollectionsList();
  mvRenderRoutingRules();
};

// Create collection
window.mvCreateCollection = async function () {
  var name = prompt('Collection name (letters, numbers, underscores):');
  if (!name || !/^[a-zA-Z0-9_]+$/.test(name)) return;

  var gate = _mvCapabilityGate('memory.collections');
  if (!gate.ok) {
    mvToast('⚠ Criar coleção indisponível: ' + _mvCapabilityReason(gate.reason), 3000);
    return;
  }

  try {
    await LA8159API.memory.createCollection(name);
    mvToast('Collection created: ' + name, 2000);
    await mvRefreshCollections();
  } catch (e) { mvToast('Failed: ' + e.message, 3000); }
};

// Handle file drop
window.mvHandleFileDrop = function (e) {
  e.preventDefault(); e.stopPropagation();
  var dz = e.target.closest('.mv-dropzone');
  if (dz) { dz.style.borderColor = ''; dz.style.background = ''; }
  mvHandleFiles(e.dataTransfer.files);
};

// Handle file select
window.mvHandleFileSelect = function (e) {
  mvHandleFiles(e.target.files);
};

// Quick search — reads from sidebar input when called with no args
window.mvQuickSearch = async function (query) {
  var sidebarInput = document.getElementById('mvSidebarQuickSearch');
  if (query === undefined) {
    query = sidebarInput ? sidebarInput.value.trim() : '';
  }
  if (!query) return;

  var resultsEl = document.getElementById('mvSidebarQuickResults');
  if (resultsEl) resultsEl.innerHTML = '<div class="mv-loading"><span class="loading"></span> Buscando...</div>';

  try {
    var data = await LA8159API.memory.search(query, '', { limit: 5 });
    var items = data.results || [];
    if (resultsEl) {
      if (!items.length) {
        resultsEl.innerHTML = '<div style="font-size:11px;color:var(--gray);padding:6px 0">Nenhum resultado para "' + escapeHtml(query) + '"</div>';
      } else {
        resultsEl.innerHTML = items.map(function (r) {
          return '<div class="mv-search-result" style="margin-bottom:4px">' +
            '<div class="mv-result-header"><span class="mv-result-collection">' + escapeHtml(r.collection || 'default') + '</span>' +
            '<span class="mv-result-score">' + ((r.score || 0).toFixed(2)) + '</span></div>' +
            '<div class="mv-result-text">' + escapeHtml((r.text || '').substring(0, 120)) + '</div>' +
            '</div>';
        }).join('');
      }
    }
  } catch (e) {
    if (resultsEl) resultsEl.innerHTML = '<div style="font-size:11px;color:var(--red);padding:4px 0">Erro: ' + e.message + '</div>';
  }
};

// Render markdown safely — uses marked if available, otherwise basic escaping
function _mvRenderMd(text) {
  if (typeof marked !== 'undefined') {
    try { return marked.parse(text); } catch (e) { /* fall through */ }
  }
  return '<p>' + escapeHtml(text).replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>') + '</p>';
}

// Send chat message — delegates to LA8159API.assistant.chat() with streaming
window.mvSendChat = async function () {
  var input = document.getElementById('mvChatInput');
  if (!input) return;
  var text = input.value.trim();
  if (!text) return;

  var sectionCtx = (typeof window.LA8159ResolveSectionAgentContext === 'function')
    ? window.LA8159ResolveSectionAgentContext('memory')
    : null;
  if (sectionCtx && sectionCtx.assigned && !sectionCtx.active) {
    var inactiveName = sectionCtx.agent ? (sectionCtx.agent.name || sectionCtx.agent.agent_id) : sectionCtx.agentId;
    mvAddChatBubble('system', 'Agente de Memória inativo: ' + escapeHtml(inactiveName));
    return;
  }

  input.value = '';
  mvAddChatBubble('user', escapeHtml(text));

  // Create streaming bubble
  var log = document.getElementById('mvChatLog');
  var bubble = document.createElement('div');
  bubble.className = 'mv-chat-bubble assistant mv-chat-bubble--md';
  bubble.innerHTML = '<span style="color:var(--gray);font-style:italic">…</span>';
  if (log) { log.appendChild(bubble); log.scrollTop = log.scrollHeight; }

  try {
    _mvUpdatePanelContextIndicator();
    var textWithContext = text + _mvGetPanelContextText();
    var chatOpts = {
      history: _mvChatHistory.slice(-5),
      sessionKey: sectionCtx && sectionCtx.sessionKey ? sectionCtx.sessionKey : 'section:memory:default',
      system: sectionCtx && sectionCtx.system ? sectionCtx.system : undefined,
      agentId: sectionCtx && sectionCtx.agentId ? sectionCtx.agentId : undefined,
    };
    if (typeof getCurrentProjectId === 'function') {
      var projectId = getCurrentProjectId();
      if (projectId) chatOpts.projectId = projectId;
    }

    var fullContent = await LA8159API.assistant.chat(
      textWithContext,
      chatOpts,
      function (token, accumulated) {
        bubble.innerHTML = _mvRenderMd(accumulated);
        requestAnimationFrame(function () { if (log) log.scrollTop = log.scrollHeight; });
      }
    );
    bubble.innerHTML = _mvRenderMd(fullContent);
    requestAnimationFrame(function () { if (log) log.scrollTop = log.scrollHeight; });
    _mvChatHistory.push({ role: 'user', content: text });
    _mvChatHistory.push({ role: 'assistant', content: fullContent });
  } catch (e) {
    bubble.className = 'mv-chat-bubble error';
    bubble.textContent = 'Erro ao conectar: ' + e.message;
  }
};

// Add to short-term memory
window.mvAddToShortMemory = function (text, importance) {
  if (!text) return;
  _mvShortMemory.push({
    text: text,
    importance: importance || 5,
    timestamp: Date.now()
  });
  if (_mvShortMemory.length > 50) _mvShortMemory.shift(); // Keep only 50 items
  mvToast('Added to short-term memory', 1500);
};

// Expose functions to window scope
window.renderAgentMemoryInfo = renderAgentMemoryInfo;
window.mvToast = mvToast;
window.mvLoadOverview = mvLoadOverview;
window.mvSetHealth = mvSetHealth;
window.mvLoadSearchFilters = mvLoadSearchFilters;
window.mvLoadIngestDropdowns = mvLoadIngestDropdowns;
window.mvRenderTags = mvRenderTags;
window.mvDoIngest = mvDoIngest;
window.mvLoadQuadrants = mvLoadQuadrants;
window.mvRenderQuadrant = mvRenderQuadrant;
window.mvAddChatBubble = mvAddChatBubble;
window.mvLoadRedistribute = mvLoadRedistribute;
window.mvAnalyzeWithAI = mvAnalyzeWithAI;  // named function declared above
window.mvLoadConfig = mvLoadConfig;
window.mvSaveConfig = mvSaveConfig;
window.mvLoadSidebarSummary = mvLoadSidebarSummary;
window.mvRenderCollectionsList = mvRenderCollectionsList;