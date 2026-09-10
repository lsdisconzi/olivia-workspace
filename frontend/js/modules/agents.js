/* ═══════════════════════════════════════════════════════════════════
   AGENTS MODULE - Agent management, creation, listing, deletion
   ═══════════════════════════════════════════════════════════════════ */

const _agentStatusPending = new Set();
let _editingAgentId = null;
let _selectedModalSkills = [];
let _selectedModalQdrantCollections = [];
let _availableMcpServers = [];
/** Map of MCP server name → {description, tool_count, project} from ecosystem metadata */
let _ecosystemMcpInfo = {};
/** Map of MCP bridge config names → ecosystem canonical names for enrichment lookup */
let _ecosystemNameMap = {};
/** Pre-selected tool names to restore into inline tool checkboxes after render */
let _pendingToolPermissions = null;
let _lastAgentSelectionNotice = { key: '', at: 0 };
let _modalAgentType = 'openclaude';
let _agentModalBehaviorsBound = false;
const _defaultAgentSharedScopes = ['ontology', 'law'];
const _agentBgStatusById = new Map();
let _agentBgSharedStats = { total_links: 0, last_seen_at: '' };
let _agentBgPollTimer = null;
let _agentInvestigationBoard = { summary: {}, agents: [], generated_at: '' };
let _agentBgStatusInFlight = null;
let _agentBoardInFlight = null;
let _agentBgLastFetchAt = 0;
let _agentBoardLastFetchAt = 0;
let _workspacePreviewRequestSeq = 0;
let _workspacePreviewDebounceTimer = null;
const _agentPanelFetchCooldownMs = 1500;
const _referenceModalState = {
  links: [],
  filtered: [],
  shared: { total_links: 0, last_seen_at: '' },
};
let _bundleImportState = {
  mode: 'catalog',
  bundlePayload: null,
  catalogLoaded: false,
  catalogLoading: false,
  catalogSource: '',
  groups: [],
  selectedGroupId: '',
  selectedAgentId: '',
  pluginsLoaded: false,
  pluginsLoading: false,
  plugins: [],
  selectedPluginPath: '',
};
const _agentSidebarUiStorageKey = 'OliviaLegal.sidebar.agents.ui.v1';

const _agentSidebarUiState = (() => {
  const fallback = {
    opsCollapsed: false,
    opsGroupsCollapsed: {},
    agentGroupsCollapsed: {},
  };
  try {
    const raw = localStorage.getItem(_agentSidebarUiStorageKey);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return fallback;
    return {
      opsCollapsed: !!parsed.opsCollapsed,
      opsGroupsCollapsed: (parsed.opsGroupsCollapsed && typeof parsed.opsGroupsCollapsed === 'object') ? parsed.opsGroupsCollapsed : {},
      agentGroupsCollapsed: (parsed.agentGroupsCollapsed && typeof parsed.agentGroupsCollapsed === 'object') ? parsed.agentGroupsCollapsed : {},
    };
  } catch (_e) {
    return fallback;
  }
})();

function _saveAgentSidebarUiState() {
  try {
    localStorage.setItem(_agentSidebarUiStorageKey, JSON.stringify(_agentSidebarUiState));
  } catch (_e) {
    // Ignore persistence failures (private mode, quota).
  }
}

function _normalizeOpsRangeHours(value, fallback = 24) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(336, Math.round(parsed)));
}

function _currentOpsRangeHours() {
  if (typeof window.getConfig === 'function') {
    const cfg = window.getConfig() || {};
    return _normalizeOpsRangeHours(cfg.investigation_range_hours, 24);
  }
  try {
    const saved = JSON.parse(localStorage.getItem('OliviaLegal.workspace.config') || '{}');
    return _normalizeOpsRangeHours(saved.investigation_range_hours, 24);
  } catch (_e) {
    return 24;
  }
}

function _parseIsoDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function _latestActivityDate(values) {
  let latest = null;
  (values || []).forEach((value) => {
    const date = _parseIsoDate(value);
    if (!date) return;
    if (!latest || date.getTime() > latest.getTime()) latest = date;
  });
  return latest;
}

function _resolveAgentGroupFromConfig(configObj) {
  const cfg = (configObj && typeof configObj === 'object') ? configObj : {};
  const directKeys = ['group', 'group_name', 'group_id', 'team', 'cluster', 'cohort', 'domain_group'];
  for (const key of directKeys) {
    const value = String(cfg[key] || '').trim();
    if (value) return value;
  }
  if (cfg.group && typeof cfg.group === 'object') {
    const nested = String(cfg.group.name || cfg.group.id || '').trim();
    if (nested) return nested;
  }
  return '';
}

function _deriveGroupLabelFromName(name) {
  const raw = String(name || '').trim();
  if (!raw) return 'Ungrouped';

  if (raw.includes('·')) {
    const pref = raw.split('·')[0].trim();
    if (pref) return pref;
  }

  const lower = raw.toLowerCase();
  if (lower.startsWith('latin american ')) return 'Latin American';
  if (lower.startsWith('olivia ')) return 'Olivia';
  if (lower.startsWith('coremu ')) return 'COREMU';
  if (lower.startsWith('LA8159 ')) return 'LA8159';
  if (lower.startsWith('chronological ')) return 'Chronological';

  const first = raw.split(/\s+/)[0] || 'Ungrouped';
  if (first.length <= 3) return first.toUpperCase();
  return first;
}

function _deriveAgentGroup(agent) {
  const a = (agent && typeof agent === 'object') ? agent : {};
  const fromConfig = _resolveAgentGroupFromConfig(a.config);
  if (fromConfig) return fromConfig;
  return _deriveGroupLabelFromName(a.name || a.agent_id || 'Ungrouped');
}

function _encodedKey(value) {
  return encodeURIComponent(String(value || 'Ungrouped'));
}

function toggleInvestigationOpsPanelCollapsed() {
  _agentSidebarUiState.opsCollapsed = !_agentSidebarUiState.opsCollapsed;
  _saveAgentSidebarUiState();
  renderAgentList();
}

function toggleInvestigationOpsGroup(encodedGroup) {
  const group = decodeURIComponent(String(encodedGroup || 'Ungrouped'));
  _agentSidebarUiState.opsGroupsCollapsed[group] = !_agentSidebarUiState.opsGroupsCollapsed[group];
  _saveAgentSidebarUiState();
  renderAgentList();
}

function toggleAgentListGroup(encodedGroup) {
  const group = decodeURIComponent(String(encodedGroup || 'Ungrouped'));
  const isCollapsed = !!_agentSidebarUiState.agentGroupsCollapsed[group];
  _agentSidebarUiState.agentGroupsCollapsed[group] = !isCollapsed;
  _saveAgentSidebarUiState();

  const block = document.querySelector(`.agent-group-block[data-group="${CSS.escape(group)}`);
  if (!block) return;
  const body = block.querySelector('.agent-group-body');
  const icon = block.querySelector('.agent-group-header .fas');
  if (!body) return;

  if (isCollapsed) {
    // expanding: set to measured height, then let CSS keep it open
    body.style.maxHeight = body.scrollHeight + 'px';
    body.classList.remove('is-collapsed');
  } else {
    // collapsing: lock current height, force reflow, then animate to 0
    body.style.maxHeight = body.scrollHeight + 'px';
    void body.offsetHeight; // reflow
    body.classList.add('is-collapsed');
    body.style.maxHeight = '0px';
  }
  if (icon) {
    icon.classList.toggle('fa-chevron-down', !_agentSidebarUiState.agentGroupsCollapsed[group]);
    icon.classList.toggle('fa-chevron-right', _agentSidebarUiState.agentGroupsCollapsed[group]);
  }
}

function collapseAllAgentGroups() {
  const groups = Object.keys(_agentSidebarUiState.agentGroupsCollapsed);
  groups.forEach(g => { _agentSidebarUiState.agentGroupsCollapsed[g] = true; });
  _saveAgentSidebarUiState();
  document.querySelectorAll('.agent-group-body').forEach(body => {
    body.style.maxHeight = body.scrollHeight + 'px';
    void body.offsetHeight;
    body.classList.add('is-collapsed');
    body.style.maxHeight = '0px';
  });
  document.querySelectorAll('.agent-group-header .fas').forEach(icon => {
    icon.classList.add('fa-chevron-right');
    icon.classList.remove('fa-chevron-down');
  });
}

function expandAllAgentGroups() {
  const groups = Object.keys(_agentSidebarUiState.agentGroupsCollapsed);
  groups.forEach(g => { _agentSidebarUiState.agentGroupsCollapsed[g] = false; });
  _saveAgentSidebarUiState();
  document.querySelectorAll('.agent-group-body').forEach(body => {
    body.style.maxHeight = body.scrollHeight + 'px';
    body.classList.remove('is-collapsed');
  });
  document.querySelectorAll('.agent-group-header .fas').forEach(icon => {
    icon.classList.add('fa-chevron-down');
    icon.classList.remove('fa-chevron-right');
  });
}

function _normalizedAgentType(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw || raw === 'claude') return 'openclaude';
  if (raw !== 'openclaude') return 'openclaude';
  return 'openclaude';
}

function _agentTypeLabel(value) {
  const kind = _normalizedAgentType(value);
  if (kind === 'openclaude') return 'openclaude';
  return kind;
}

function _normalizeInvestigationBoard(payload) {
  const data = payload && typeof payload === 'object' ? payload : {};
  const summary = data.summary && typeof data.summary === 'object' ? data.summary : {};
  const agentsList = Array.isArray(data.agents) ? data.agents : [];
  return {
    summary: {
      total_agents: Number(summary.total_agents || 0),
      active_agents: Number(summary.active_agents || 0),
      inactive_agents: Number(summary.inactive_agents || 0),
      running_tasks: Number(summary.running_tasks || 0),
      paused_tasks: Number(summary.paused_tasks || 0),
      done_tasks: Number(summary.done_tasks || 0),
      error_tasks: Number(summary.error_tasks || 0),
      agents_with_planning_files: Number(summary.agents_with_planning_files || 0),
    },
    agents: agentsList,
    generated_at: String(data.generated_at || ''),
  };
}

async function loadAgentInvestigationBoard(options) {
  const opts = options && typeof options === 'object' ? options : {};
  const rerender = opts.rerender !== false;
  const now = Date.now();

  if (!opts.force && (now - _agentBoardLastFetchAt) < _agentPanelFetchCooldownMs) {
    if (rerender) renderAgentList();
    return;
  }

  if (_agentBoardInFlight) {
    try {
      await _agentBoardInFlight;
      if (rerender) renderAgentList();
    } catch (_e) {
      // Keep the panel usable when board endpoint is temporarily unavailable.
    }
    return;
  }

  _agentBoardInFlight = (async () => {
    try {
      const res = await fetch(`${API_BASE}/api/agents/investigation/board`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      _agentInvestigationBoard = _normalizeInvestigationBoard(data);
      _agentBoardLastFetchAt = Date.now();
    } finally {
      _agentBoardInFlight = null;
    }
  })();

  try {
    await _agentBoardInFlight;
    if (rerender) renderAgentList();
  } catch (_e) {
    // Keep the panel usable when board endpoint is temporarily unavailable.
  }
}

function _opsCell(label, value) {
  return `<div class="ops-stat-cell">
    <div class="ops-stat-value">${Number(value || 0)}</div>
    <div class="ops-stat-label">${escapeHtml(label || '')}</div>
  </div>`;
}

function _renderInvestigationOpsPanel() {
  const board = _agentInvestigationBoard || { summary: {}, agents: [] };
  const s = board.summary || {};
  const rows = Array.isArray(board.agents) ? board.agents : [];
  const rangeHours = _currentOpsRangeHours();
  const cutoffMs = Date.now() - (rangeHours * 60 * 60 * 1000);
  const generatedAtDate = _parseIsoDate(board.generated_at);
  const updatedAt = board.generated_at ? new Date(board.generated_at).toLocaleTimeString('pt-BR') : '—';

  const enriched = rows.map((item) => {
    const id = String(item.agent_id || '').trim();
    const meta = Array.isArray(agents) ? agents.find(a => String(a.agent_id || '').trim() === id) : null;
    const planning = (item && typeof item.planning === 'object') ? item.planning : {};
    const files = (planning.files && typeof planning.files === 'object') ? planning.files : {};
    const activityDate = _latestActivityDate([
      item.background_updated_at,
      item.background_finished_at,
      item.background_started_at,
      planning.updated_at,
      files.task_plan && files.task_plan.updated_at,
      files.findings && files.findings.updated_at,
      files.progress && files.progress.updated_at,
      item.agent_last_active,
      item.agent_updated_at,
      meta && meta.last_active,
      meta && meta.updated_at,
    ]) || ((item.background_status === 'running' || item.background_status === 'paused') ? generatedAtDate : null);
    const latestProgress = String(planning.latest_progress || '').trim();
    const latestMessage = String(item.background_message || '').trim();
    return {
      ...item,
      group: _deriveAgentGroup(meta || item),
      activityDate,
      latestDisplay: latestProgress || latestMessage || 'Sem atividade registrada',
    };
  }).filter((item) => item.activityDate && item.activityDate.getTime() >= cutoffMs)
    .sort((a, b) => b.activityDate.getTime() - a.activityDate.getTime());

  const grouped = new Map();
  enriched.forEach((item) => {
    const group = String(item.group || 'Ungrouped');
    if (!grouped.has(group)) grouped.set(group, []);
    grouped.get(group).push(item);
  });

  const groupsHtml = Array.from(grouped.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([group, items]) => {
      const isCollapsed = !!_agentSidebarUiState.opsGroupsCollapsed[group];
      const rowsHtml = items.map((item) => {
        const name = String(item.name || item.agent_id || 'agent').trim();
        const bgStatus = String(item.background_status || 'idle');
        const when = item.activityDate ? item.activityDate.toLocaleString('pt-BR') : '—';
        return `<tr>
          <td style="padding:6px 6px;vertical-align:top;color:var(--white)">${escapeHtml(name)}</td>
          <td style="padding:6px 6px;vertical-align:top;color:var(--gray-hi)">${escapeHtml(bgStatus)}</td>
          <td style="padding:6px 6px;vertical-align:top;color:var(--gray-hi)" title="${escapeHtmlAttr(item.latestDisplay)}">${escapeHtml(when)}</td>
        </tr>`;
      }).join('');
      return `<div class="ops-group">
        <button class="ops-group-head" onclick="toggleInvestigationOpsGroup('${_encodedKey(group)}')" title="${(typeof window.t === 'function' ? window.t('ui.collapseGroup', 'Expand/collapse group') : 'Expand/collapse group')}">
          <span><i class="fas ${isCollapsed ? 'fa-chevron-right' : 'fa-chevron-down'}"></i> ${escapeHtml(group)}</span>
          <span>${items.length}</span>
        </button>
        <div class="ops-group-body${isCollapsed ? ' is-collapsed' : ''}">
          <div style="max-height:170px;overflow:auto;border:1px solid var(--border);border-radius:8px;background:var(--bg)">
            <table style="width:100%;border-collapse:collapse;font-size:11px">
              <thead>
                <tr style="position:sticky;top:0;background:var(--bg2)">
                  <th style="text-align:left;padding:6px;color:var(--gray)">Agente</th>
                  <th style="text-align:left;padding:6px;color:var(--gray)">Estado</th>
                  <th style="text-align:left;padding:6px;color:var(--gray)">Última Atividade</th>
                </tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
            </table>
          </div>
        </div>
      </div>`;
    }).join('');

  return `<div class="investigation-ops-panel${_agentSidebarUiState.opsCollapsed ? ' is-collapsed' : ''}">
    <div class="investigation-ops-head">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--gray)">Investigation Operations</div>
      <div style="display:flex;align-items:center;gap:6px">
        <button class="btn-xs" onclick="refreshInvestigationBoard()" title="${(typeof window.t === 'function' ? window.t('ui.updateBoard', 'Update board') : 'Update board')}"><i class="fas fa-rotate-right"></i></button>
        <button class="btn-xs" onclick="toggleInvestigationOpsPanelCollapsed()" title="${(typeof window.t === 'function' ? window.t('ui.collapsePanel', 'Expand/collapse panel') : 'Expand/collapse panel')}"><i class="fas ${_agentSidebarUiState.opsCollapsed ? 'fa-chevron-down' : 'fa-chevron-up'}"></i></button>
      </div>
    </div>
    <div class="investigation-ops-body${_agentSidebarUiState.opsCollapsed ? ' is-collapsed' : ''}">
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
        ${_opsCell('Ativos', s.active_agents)}
        ${_opsCell('Rodando', s.running_tasks)}
        ${_opsCell('Pausados', s.paused_tasks)}
        ${_opsCell('Concluídos', s.done_tasks)}
        ${_opsCell('Erros', s.error_tasks)}
        ${_opsCell('3 arquivos OK', s.agents_with_planning_files)}
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;font-size:10px;color:var(--gray);margin-bottom:6px">
        <span>Atividade dos últimos ${rangeHours}h</span>
        <span>Atualizado: ${escapeHtml(updatedAt)}</span>
      </div>
      ${groupsHtml || '<div style="padding:8px;border:1px solid var(--border);border-radius:8px;color:var(--gray);font-size:11px;background:var(--bg)">Nenhum agente com atividade na janela selecionada.</div>'}
    </div>
  </div>`;
}

function _renderAgentListItem(agent) {
  const a = agent || {};
  const sel = selectedAgent && selectedAgent.agent_id === a.agent_id ? ' selected' : '';
  const active = a.status === 'active';
  const bg = _agentBgState(a.agent_id);
  const bgLabel = _agentBgStatusLabel(bg);
  const unrestrictedTools = !!(
    (a && typeof a.unrestricted_tools !== 'undefined' ? a.unrestricted_tools : null) ??
    (a && a.config && typeof a.config === 'object' ? a.config.unrestricted_tools : false)
  );
  const encodedName = encodeURIComponent(String(a.name || ''));
  return `<div class="agent-list-item${sel}" onclick="selectAgent('${a.agent_id}')">
    <div style="display:flex;align-items:center;gap:8px">
      <span class="agent-list-status ${active ? 'active' : 'inactive'}"></span>
      <span class="agent-list-name">${escapeHtml(a.name)}</span>
    </div>
    <div class="agent-list-meta">
      <span>${_agentTypeLabel(a.agent_type)}</span>
      <span>${a.total_requests || 0} reqs</span>
      <span title="${unrestrictedTools ? 'Acesso irrestrito a ferramentas está habilitado' : 'Política restritiva de ferramentas está ativa'}" style="color:${unrestrictedTools ? 'var(--amber)' : 'var(--gray)'}">${unrestrictedTools ? 'tools: unrestricted' : 'tools: restricted'}</span>
      <span class="agent-bg-pill ${escapeHtml(bg.status)}" title="${escapeHtml(bg.message || bgLabel)}">${escapeHtml(bgLabel)}</span>
    </div>
    <div class="agent-list-actions">
      ${active
      ? `<button class="btn-xs" title="Deactivate" onclick="event.stopPropagation();toggleAgentStatus('${a.agent_id}',false)"><i class="fas fa-pause"></i></button>`
      : `<button class="btn-xs" title="Activate" onclick="event.stopPropagation();toggleAgentStatus('${a.agent_id}',true)"><i class="fas fa-play"></i></button>`}
      ${_agentBgActionButton(a.agent_id, bg)}
      <button class="btn-xs" onclick="event.stopPropagation();showEditModal('${a.agent_id}')" title="Editar agente"><i class="fas fa-pen-to-square"></i></button>
      <button class="btn-xs" onclick="event.stopPropagation();exportAgentMd('${a.agent_id}')" title="Export .agent.md"><i class="fas fa-file-export"></i></button>
      <button class="btn-xs" onclick="event.stopPropagation();exportAgentBundle('${a.agent_id}')" title="Export full bundle (tools, chats, logs)"><i class="fas fa-box-archive"></i></button>
      <button class="btn-xs danger" onclick="event.stopPropagation();deleteAgent('${a.agent_id}',decodeURIComponent('${encodedName}'))"><i class="fas fa-trash"></i></button>
    </div>
  </div>`;
}

function _normalizeAgentBgState(agentId, raw) {
  const base = raw && typeof raw === 'object' ? raw : {};
  const status = String(base.status || 'idle').toLowerCase();
  return {
    agent_id: agentId,
    status,
    progress: Number(base.progress || 0),
    collected_count: Number(base.collected_count || 0),
    target_count: Number(base.target_count || 0),
    message: String(base.message || ''),
    worker_alive: !!base.worker_alive,
  };
}

function _agentBgState(agentId) {
  return _normalizeAgentBgState(agentId, _agentBgStatusById.get(agentId));
}

function _agentBgStatusLabel(state) {
  if (!state) return 'BG idle';
  if (state.status === 'running') return `BG rodando ${state.collected_count}/${state.target_count || 0}`;
  if (state.status === 'paused') return `BG pausado ${state.collected_count}/${state.target_count || 0}`;
  if (state.status === 'done') return `BG concluído ${state.collected_count}`;
  if (state.status === 'error') return 'BG erro';
  if (state.status === 'stopped') return `BG parado ${state.collected_count}`;
  return 'BG idle';
}

function _agentBgActionButton(agentId, state) {
  if (state.status === 'running') {
    return `<button class="btn-xs" title="Pausar coleta de referências" onclick="event.stopPropagation();pauseAgentBackground('${agentId}')"><i class="fas fa-pause-circle"></i></button>`;
  }
  if (state.status === 'paused') {
    return `<button class="btn-xs" title="Retomar coleta de referências" onclick="event.stopPropagation();resumeAgentBackground('${agentId}')"><i class="fas fa-play-circle"></i></button>`;
  }
  return `<button class="btn-xs" title="Iniciar coleta de referências compartilhadas" onclick="event.stopPropagation();startAgentBackground('${agentId}')"><i class="fas fa-satellite-dish"></i></button>`;
}

async function loadAgentBackgroundStatuses(options) {
  const opts = options && typeof options === 'object' ? options : {};
  const rerender = opts.rerender !== false;
  const now = Date.now();

  if (!opts.force && (now - _agentBgLastFetchAt) < _agentPanelFetchCooldownMs) {
    if (rerender) renderAgentList();
    return;
  }

  if (_agentBgStatusInFlight) {
    try {
      await _agentBgStatusInFlight;
      if (rerender) renderAgentList();
    } catch (_e) {
      // Keep UI usable when background-status API is temporarily unavailable.
    }
    return;
  }

  _agentBgStatusInFlight = (async () => {
    try {
      const res = await fetch(`${API_BASE}/api/agents/background/status`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const rows = Array.isArray(data.agents) ? data.agents : [];

      _agentBgStatusById.clear();
      rows.forEach(row => {
        const agentId = String(row.agent_id || '').trim();
        if (agentId) _agentBgStatusById.set(agentId, row);
      });
      _agentBgSharedStats = (data && data.shared) ? data.shared : { total_links: 0, last_seen_at: '' };
      _agentBgLastFetchAt = Date.now();
    } finally {
      _agentBgStatusInFlight = null;
    }
  })();

  try {
    await _agentBgStatusInFlight;
    if (rerender) renderAgentList();
  } catch (_e) {
    // Keep UI usable when background-status API is temporarily unavailable.
  }
}

function ensureAgentBackgroundPolling() {
  if (window.Olivia_EMBED_MODE) return;
  if (_agentBgPollTimer) return;
  _agentBgPollTimer = setInterval(() => {
    if (document.hidden) return;
    const activeSection = document.querySelector('.sidebar-section.active');
    if (!activeSection || activeSection.id !== 'tab-agents') return;
    loadAgentBackgroundStatuses({ rerender: true });
    loadAgentInvestigationBoard({ rerender: true });
  }, 30000);
}

async function _postAgentBackgroundAction(agentId, action, payload) {
  const res = await fetch(`${API_BASE}/api/agents/${encodeURIComponent(agentId)}/background/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || data.detail || `HTTP ${res.status}`);
  }
  if (data && data.background) {
    _agentBgStatusById.set(agentId, data.background);
  }
  if (data && data.shared) {
    _agentBgSharedStats = data.shared;
  }
  renderAgentList();
  return data;
}

async function startAgentBackground(agentId) {
  try {
    const data = await _postAgentBackgroundAction(agentId, 'start', { target_count: 120 });
    const total = Number((data && data.shared && data.shared.total_links) || _agentBgSharedStats.total_links || 0);
    addSystemBubble(`Coleta em background iniciada. Base compartilhada: ${total} links.`);
    await loadAgentBackgroundStatuses({ rerender: true });
  } catch (e) {
    addSystemBubble(`Falha ao iniciar coleta em background: ${e.message}`);
  }
}

async function pauseAgentBackground(agentId) {
  try {
    await _postAgentBackgroundAction(agentId, 'pause');
    await loadAgentBackgroundStatuses({ rerender: true });
  } catch (e) {
    addSystemBubble(`Falha ao pausar coleta em background: ${e.message}`);
  }
}

async function resumeAgentBackground(agentId) {
  try {
    await _postAgentBackgroundAction(agentId, 'resume');
    await loadAgentBackgroundStatuses({ rerender: true });
  } catch (e) {
    addSystemBubble(`Falha ao retomar coleta em background: ${e.message}`);
  }
}

function _formatReferenceDate(isoValue) {
  const raw = String(isoValue || '').trim();
  if (!raw) return '—';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString('pt-BR');
}

function _csvCell(value) {
  const text = String(value == null ? '' : value).replace(/"/g, '""');
  return `"${text}"`;
}

function _downloadTextFile(fileName, content, mimeType) {
  const blob = new Blob([content], { type: mimeType || 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function _jurAgentLabel(agentId) {
  const id = String(agentId || '').trim();
  if (!id) return '—';
  const match = Array.isArray(agents) ? agents.find(a => String(a.agent_id || '') === id) : null;
  return match ? `${match.name} (${id.slice(0, 8)})` : id;
}

function _referenceFilteredRows() {
  const links = Array.isArray(_referenceModalState.links) ? _referenceModalState.links : [];
  const selectedAgent = String(document.getElementById('jurFilterAgent')?.value || '').trim();
  const selectedSource = String(document.getElementById('jurFilterSource')?.value || '').trim();
  const queryTerm = String(document.getElementById('jurFilterQuery')?.value || '').trim().toLowerCase();

  return links.filter(item => {
    if (selectedAgent && String(item.agent_id || '') !== selectedAgent) return false;
    if (selectedSource && String(item.source || '') !== selectedSource) return false;
    if (!queryTerm) return true;
    const haystack = [item.title, item.url, item.query].map(v => String(v || '').toLowerCase()).join(' ');
    return haystack.includes(queryTerm);
  });
}

function _populateReferenceFilters() {
  const links = Array.isArray(_referenceModalState.links) ? _referenceModalState.links : [];
  const agentSelect = document.getElementById('jurFilterAgent');
  const sourceSelect = document.getElementById('jurFilterSource');
  if (!agentSelect || !sourceSelect) return;

  const currentAgent = String(agentSelect.value || '');
  const currentSource = String(sourceSelect.value || '');

  const agentIds = Array.from(new Set(links.map(item => String(item.agent_id || '').trim()).filter(Boolean))).sort();
  const sources = Array.from(new Set(links.map(item => String(item.source || '').trim()).filter(Boolean))).sort();

  agentSelect.innerHTML = '<option value="">Todos os agentes</option>' +
    agentIds.map(id => `<option value="${escapeHtml(id)}">${escapeHtml(_jurAgentLabel(id))}</option>`).join('');
  sourceSelect.innerHTML = '<option value="">Todas as fontes</option>' +
    sources.map(src => `<option value="${escapeHtml(src)}">${escapeHtml(src)}</option>`).join('');

  if (currentAgent && agentIds.includes(currentAgent)) agentSelect.value = currentAgent;
  if (currentSource && sources.includes(currentSource)) sourceSelect.value = currentSource;
}

function renderSharedReferenceTable() {
  const body = document.getElementById('jurTableBody');
  const meta = document.getElementById('jurCountLabel');
  if (!body || !meta) return;

  const filtered = _referenceFilteredRows();
  _referenceModalState.filtered = filtered;

  const total = Number(_referenceModalState.shared.total_links || _referenceModalState.links.length || 0);
  const lastSeen = _formatReferenceDate(_referenceModalState.shared.last_seen_at);
  meta.textContent = `${filtered.length} de ${total} links · atualização: ${lastSeen}`;

  if (!filtered.length) {
    body.innerHTML = '<tr><td colspan="7" class="jur-empty-row">Nenhum link encontrado com os filtros atuais.</td></tr>';
    return;
  }

  body.innerHTML = filtered.map((item, index) => {
    const title = String(item.title || 'Shared Reference').trim();
    const url = String(item.url || '').trim();
    const source = String(item.source || '').trim() || '—';
    const query = String(item.query || '').trim() || '—';
    const agentId = String(item.agent_id || '').trim();
    const seenAt = _formatReferenceDate(item.last_seen_at || item.first_seen_at);
    const number = index + 1;
    return `<tr>
      <td>${number}</td>
      <td><a href="${escapeHtmlAttr(url)}" target="_blank" rel="noopener">${escapeHtml(title)}</a></td>
      <td>${escapeHtml(source)}</td>
      <td title="${escapeHtmlAttr(_jurAgentLabel(agentId))}">${escapeHtml(_jurAgentLabel(agentId))}</td>
      <td title="${escapeHtmlAttr(query)}">${escapeHtml(query)}</td>
      <td>${escapeHtml(seenAt)}</td>
      <td><a class="btn btn-xs" href="${escapeHtmlAttr(url)}" target="_blank" rel="noopener"><i class="fas fa-external-link-alt"></i></a></td>
    </tr>`;
  }).join('');
}

async function refreshSharedReferenceLinks() {
  try {
    const res = await fetch(`${API_BASE}/api/reference/links?limit=500`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || data.detail || `HTTP ${res.status}`);

    const links = Array.isArray(data.links) ? data.links : [];
    _referenceModalState.links = links;
    _referenceModalState.shared = (data && data.shared) ? data.shared : { total_links: links.length, last_seen_at: '' };
    _agentBgSharedStats = _referenceModalState.shared;
    _populateReferenceFilters();
    renderSharedReferenceTable();
    renderAgentList();
  } catch (e) {
    const body = document.getElementById('jurTableBody');
    const meta = document.getElementById('jurCountLabel');
    if (meta) meta.textContent = 'Falha ao carregar links';
    if (body) body.innerHTML = `<tr><td colspan="7" class="jur-empty-row">Falha ao carregar links: ${escapeHtml(e.message || String(e))}</td></tr>`;
  }
}

function closeSharedReferenceModal() {
  const overlay = document.getElementById('referenceModalOverlay');
  const modal = document.getElementById('referenceModal');
  if (overlay) overlay.classList.remove('show');
  if (modal) modal.classList.remove('show');
}

async function openSharedReferenceLinks() {
  const overlay = document.getElementById('referenceModalOverlay');
  const modal = document.getElementById('referenceModal');
  if (overlay) overlay.classList.add('show');
  if (modal) modal.classList.add('show');
  await refreshSharedReferenceLinks();
}

function exportSharedReferenceJson() {
  const rows = Array.isArray(_referenceModalState.filtered) ? _referenceModalState.filtered : [];
  if (!rows.length) {
    addSystemBubble('Nenhum link filtrado para exportar em JSON.');
    return;
  }
  const payload = {
    exported_at: new Date().toISOString(),
    total_filtered: rows.length,
    total_shared: Number((_referenceModalState.shared && _referenceModalState.shared.total_links) || _referenceModalState.links.length || 0),
    links: rows,
  };
  _downloadTextFile(`shared_links_${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
}

function exportSharedReferenceCsv() {
  const rows = Array.isArray(_referenceModalState.filtered) ? _referenceModalState.filtered : [];
  if (!rows.length) {
    addSystemBubble('Nenhum link filtrado para exportar em CSV.');
    return;
  }

  const headers = ['id', 'title', 'url', 'source', 'agent_id', 'agent_name', 'query', 'court', 'first_seen_at', 'last_seen_at', 'download_url'];
  const lines = [headers.map(_csvCell).join(',')];
  rows.forEach(item => {
    const row = [
      item.id,
      item.title,
      item.url,
      item.source,
      item.agent_id,
      _jurAgentLabel(item.agent_id),
      item.query,
      item.court,
      item.first_seen_at,
      item.last_seen_at,
      item.download_url,
    ];
    lines.push(row.map(_csvCell).join(','));
  });

  const csv = lines.join('\n');
  _downloadTextFile(`shared_links_${new Date().toISOString().slice(0, 10)}.csv`, csv, 'text/csv;charset=utf-8');
}

// Removed hardcoded fallback skills: prefer workspace-generated `skill-index.json`.
const _fallbackSkillOptions = [];

function _toSafeSlug(value, separator = '_') {
  const cleaned = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, separator)
    .replace(new RegExp(`${separator}{2,}`, 'g'), separator)
    .replace(new RegExp(`^${separator}|${separator}$`, 'g'), '');
  return cleaned || 'agent';
}

function _normalizeNeo4jDatabaseName(value, fallbackName) {
  const base = String(value || '').trim() || `agent.${_toSafeSlug(fallbackName, '.')}`;
  const normalized = base
    .replace(/_/g, '.')
    .replace(/[^a-zA-Z0-9.]+/g, '.')
    .replace(/\.{2,}/g, '.')
    .replace(/^\.+|\.+$/g, '');
  return normalized || `agent.${_toSafeSlug(fallbackName, '.')}`;
}

function _normalizedWorkspaceScope(scope) {
  const raw = String(scope || '').trim();
  const valid = new Set(['workspace', 'uploads_projects', 'own', 'parent', 'custom']);
  return valid.has(raw) ? raw : 'own';
}

function _normalizedPathLayout(value) {
  const raw = String(value || '').trim().toLowerCase();
  return raw === 'agent_managed' ? 'agent_managed' : 'strict';
}

function _normalizedManagedRoot(value, fallback = '') {
  const cleaned = String(value || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '')
    .replace(/(^|\/)\.\.?($|\/)/g, '/')
    .replace(/\/+/g, '/');
  if (cleaned) return cleaned;
  return String(fallback || '').trim();
}

function _scopeFoldersFromRaw(raw) {
  return String(raw || '')
    .split('\n')
    .map(v => v.trim())
    .filter(Boolean);
}

function _currentProjectIdForWorkspace() {
  if (typeof getCurrentProjectId !== 'function') return '';
  const pid = String(getCurrentProjectId() || '').trim();
  return pid === 'LA8159-project' ? '' : pid;
}

function _computeWorkspacePath(scope, agentName, scopeFolders) {
  const projectId = _currentProjectIdForWorkspace();
  const normalizedScope = _normalizedWorkspaceScope(scope);
  const slug = _toSafeSlug(agentName, '_');
  const ownWorkspace = projectId
    ? `uploads/projects/${projectId}/agents/${slug}/workspace/`
    : `uploads/agents/${slug}/workspace/`;

  if (normalizedScope === 'workspace') {
    return projectId ? `uploads/projects/${projectId}/workspace/` : 'uploads/workspace/';
  }
  if (normalizedScope === 'uploads_projects') {
    return projectId ? `uploads/projects/${projectId}/` : 'uploads/projects/';
  }
  if (normalizedScope === 'parent') {
    return 'uploads/';
  }
  if (normalizedScope === 'custom') {
    return (scopeFolders && scopeFolders[0]) ? scopeFolders[0] : ownWorkspace;
  }
  return ownWorkspace;
}

function _toggleManagedRootVisibility() {
  const layout = _normalizedPathLayout(document.getElementById('modalPathLayout')?.value || 'strict');
  const wrapper = document.getElementById('modalManagedRootWrap');
  const input = document.getElementById('modalManagedRoot');
  if (wrapper) wrapper.style.display = layout === 'agent_managed' ? 'block' : 'none';
  if (layout === 'agent_managed' && input && !input.value.trim()) {
    input.value = 'workbench';
  }
}

function _workspacePreviewFallback(payload) {
  const workspacePath = _computeWorkspacePath(payload.workspaceScope, payload.name, payload.scopeFolders);
  const policyRoot = payload.pathLayout === 'agent_managed'
    ? (_normalizedManagedRoot(payload.managedRoot, 'workbench') || 'workbench')
    : (String(payload.outputFolder || 'outputs').trim().replace(/^\/+|\/+$/g, '') || 'outputs');
  return {
    workspace_path: workspacePath,
    workspace_path_absolute: '(resolução local; backend indisponível)',
    policy_root_relative: policyRoot,
    policy_root_absolute: '',
    path_layout: payload.pathLayout,
  };
}

function _applyWorkspacePreview(payload) {
  const pathEl = document.getElementById('modalResolvedWorkspacePath');
  const absEl = document.getElementById('modalResolvedWorkspaceAbs');
  const policyEl = document.getElementById('modalResolvedPolicyRoot');
  if (!pathEl || !absEl || !policyEl) return;

  const relPath = String((payload && payload.workspace_path) || '').trim() || '-';
  const absPath = String((payload && payload.workspace_path_absolute) || '').trim() || '-';
  const policyRel = String((payload && payload.policy_root_relative) || '').trim() || '-';
  const policyAbs = String((payload && payload.policy_root_absolute) || '').trim();

  pathEl.textContent = relPath;
  absEl.textContent = absPath;
  policyEl.textContent = policyAbs ? `${policyRel}  (${policyAbs})` : policyRel;
}

async function _resolveWorkspacePreview() {
  const name = (document.getElementById('modalAgentName')?.value || '').trim() || 'agent';
  const workspaceScope = _normalizedWorkspaceScope(document.getElementById('modalWorkspaceScope')?.value || 'own');
  const scopeFolders = _scopeFoldersFromRaw(document.getElementById('modalScopeFolders')?.value || '');
  const outputFolder = (document.getElementById('modalOutputFolder')?.value || '').trim() || 'outputs/';
  const pathLayout = _normalizedPathLayout(document.getElementById('modalPathLayout')?.value || 'strict');
  const managedRoot = pathLayout === 'agent_managed'
    ? _normalizedManagedRoot(document.getElementById('modalManagedRoot')?.value || '', 'workbench')
    : '';
  const projectId = _currentProjectIdForWorkspace();
  const scopeDerivedPath = _computeWorkspacePath(workspaceScope, name, scopeFolders);

  const payload = {
    agent_id: _editingAgentId || null,
    name,
    project_id: projectId || null,
    workspace_scope: workspaceScope,
    scope_folders: scopeFolders,
    workspace_path: scopeDerivedPath,
    output_folder: outputFolder,
    path_layout: pathLayout,
    managed_root: managedRoot,
  };

  const requestSeq = ++_workspacePreviewRequestSeq;
  try {
    const res = await fetch(`${API_BASE}/api/agents/workspace/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (requestSeq !== _workspacePreviewRequestSeq) return null;
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    _applyWorkspacePreview(data);
    return data;
  } catch (_e) {
    if (requestSeq !== _workspacePreviewRequestSeq) return null;
    const fallback = _workspacePreviewFallback({
      name,
      workspaceScope,
      scopeFolders,
      outputFolder,
      pathLayout,
      managedRoot,
    });
    _applyWorkspacePreview(fallback);
    return fallback;
  }
}

function refreshWorkspacePathPreview() {
  if (_workspacePreviewDebounceTimer) {
    clearTimeout(_workspacePreviewDebounceTimer);
  }
  _workspacePreviewDebounceTimer = setTimeout(() => {
    _workspacePreviewDebounceTimer = null;
    void _resolveWorkspacePreview();
  }, 120);
}

function _defaultWorkspaceScopeValue() {
  const projectId = _currentProjectIdForWorkspace();
  return projectId ? 'uploads_projects' : 'own';
}

function _sectionProfileDefaults(agentName) {
  const slug = _toSafeSlug(agentName, '_');
  return {
    caseCollection: `${slug}_case`,
    discoveryCollection: `${slug}_discovery`,
    qdrantDedicated: `agent_${slug}`,
    neo4jDedicated: `agent.${_toSafeSlug(agentName, '.')}`
  };
}

function _setModalHint(id, text, tone = 'error') {
  const el = document.getElementById(id);
  if (!el) return;
  const content = String(text || '').trim();
  if (!content) {
    el.textContent = '';
    el.style.display = 'none';
    return;
  }
  el.textContent = content;
  el.style.display = 'block';
  el.style.color = tone === 'error' ? 'var(--red)' : 'var(--gray)';
}

function _clearModalValidationHints() {
  _setModalHint('modalValidationSummary', '');
  _setModalHint('modalNameHint', '');
  _setModalHint('modalScopeFoldersHint', '');
  _setModalHint('modalQdrantExistingHint', '');
}

function _syncSectionProfileDefaultsFromName(force = false) {
  const name = (document.getElementById('modalAgentName')?.value || '').trim() || 'agent';
  const defaults = _sectionProfileDefaults(name);

  const caseInput = document.getElementById('modalCaseQdrantCollection');
  const discoveryInput = document.getElementById('modalDescobertaQdrantCollection');
  const qdrantDedicatedInput = document.getElementById('modalQdrantDedicatedName');
  const neo4jDedicatedInput = document.getElementById('modalNeo4jDedicatedName');

  if (caseInput && (force || !caseInput.value.trim() || caseInput.dataset.auto === '1')) {
    caseInput.value = defaults.caseCollection;
    caseInput.dataset.auto = '1';
  }
  if (discoveryInput && (force || !discoveryInput.value.trim() || discoveryInput.dataset.auto === '1')) {
    discoveryInput.value = defaults.discoveryCollection;
    discoveryInput.dataset.auto = '1';
  }
  if (qdrantDedicatedInput && (force || !qdrantDedicatedInput.value.trim() || qdrantDedicatedInput.dataset.auto === '1')) {
    qdrantDedicatedInput.value = defaults.qdrantDedicated;
    qdrantDedicatedInput.dataset.auto = '1';
  }
  if (neo4jDedicatedInput && (force || !neo4jDedicatedInput.value.trim() || neo4jDedicatedInput.dataset.auto === '1')) {
    neo4jDedicatedInput.value = defaults.neo4jDedicated;
    neo4jDedicatedInput.dataset.auto = '1';
  }

  if (caseInput) {
    const msg = caseInput.dataset.auto === '1'
      ? `Padrão automático: ${defaults.caseCollection}`
      : 'Valor personalizado';
    _setModalHint('modalCaseQdrantHint', msg, 'info');
  }
  if (discoveryInput) {
    const msg = discoveryInput.dataset.auto === '1'
      ? `Padrão automático: ${defaults.discoveryCollection}`
      : 'Valor personalizado';
    _setModalHint('modalDescobertaQdrantHint', msg, 'info');
  }
}

function _bindAgentModalBehaviors() {
  if (_agentModalBehaviorsBound) return;
  _agentModalBehaviorsBound = true;

  const nameInput = document.getElementById('modalAgentName');
  const caseInput = document.getElementById('modalCaseQdrantCollection');
  const discoveryInput = document.getElementById('modalDescobertaQdrantCollection');
  const qdrantDedicatedInput = document.getElementById('modalQdrantDedicatedName');
  const neo4jDedicatedInput = document.getElementById('modalNeo4jDedicatedName');
  const scopeSelect = document.getElementById('modalWorkspaceScope');
  const scopeFoldersInput = document.getElementById('modalScopeFolders');
  const outputFolderInput = document.getElementById('modalOutputFolder');
  const pathLayoutSelect = document.getElementById('modalPathLayout');
  const managedRootInput = document.getElementById('modalManagedRoot');
  const qdrantExistingSelect = document.getElementById('modalQdrantExistingCollection');

  if (nameInput) {
    nameInput.addEventListener('input', () => {
      _setModalHint('modalNameHint', '');
      _setModalHint('modalValidationSummary', '');
      _syncSectionProfileDefaultsFromName(false);
      refreshWorkspacePathPreview();
    });
  }
  if (caseInput) {
    caseInput.addEventListener('input', () => {
      caseInput.dataset.auto = '0';
      _syncSectionProfileDefaultsFromName(false);
    });
  }
  if (discoveryInput) {
    discoveryInput.addEventListener('input', () => {
      discoveryInput.dataset.auto = '0';
      _syncSectionProfileDefaultsFromName(false);
    });
  }
  if (qdrantDedicatedInput) {
    qdrantDedicatedInput.addEventListener('input', () => {
      qdrantDedicatedInput.dataset.auto = '0';
    });
  }
  if (neo4jDedicatedInput) {
    neo4jDedicatedInput.addEventListener('input', () => {
      neo4jDedicatedInput.dataset.auto = '0';
    });
  }
  if (scopeSelect) {
    scopeSelect.addEventListener('change', () => {
      toggleCustomScopeFolders();
      _setModalHint('modalScopeFoldersHint', '');
      _setModalHint('modalValidationSummary', '');
      refreshWorkspacePathPreview();
    });
  }
  if (scopeFoldersInput) {
    scopeFoldersInput.addEventListener('input', () => {
      _setModalHint('modalScopeFoldersHint', '');
      refreshWorkspacePathPreview();
    });
  }
  if (outputFolderInput) {
    outputFolderInput.addEventListener('input', () => {
      refreshWorkspacePathPreview();
    });
  }
  if (pathLayoutSelect) {
    pathLayoutSelect.addEventListener('change', () => {
      _toggleManagedRootVisibility();
      refreshWorkspacePathPreview();
    });
  }
  if (managedRootInput) {
    managedRootInput.addEventListener('input', () => {
      refreshWorkspacePathPreview();
    });
  }
  if (qdrantExistingSelect) {
    qdrantExistingSelect.addEventListener('change', () => {
      _setModalHint('modalQdrantExistingHint', '');
      _setModalHint('modalValidationSummary', '');
    });
  }
}

function _validateAgentModalBeforeSubmit(isEdit) {
  _clearModalValidationHints();
  const errors = [];

  const nameInput = document.getElementById('modalAgentName');
  const name = String(nameInput?.value || '').trim();
  if (!name && !isEdit) {
    errors.push('Informe o nome do agente.');
    _setModalHint('modalNameHint', 'Campo obrigatório para criar o agente.', 'error');
  }

  const workspaceScope = document.getElementById('modalWorkspaceScope')?.value;
  const scopeFoldersRaw = String(document.getElementById('modalScopeFolders')?.value || '').trim();
  if (workspaceScope === 'custom' && !scopeFoldersRaw) {
    errors.push('Escopo personalizado precisa de ao menos uma pasta permitida.');
    _setModalHint('modalScopeFoldersHint', 'Adicione pelo menos uma pasta permitida.', 'error');
  }

  const pathLayout = _normalizedPathLayout(document.getElementById('modalPathLayout')?.value || 'strict');
  const managedRoot = _normalizedManagedRoot(document.getElementById('modalManagedRoot')?.value || '');
  if (pathLayout === 'agent_managed' && !managedRoot) {
    errors.push('Defina a subpasta gerenciável para o modo gerenciado pelo agente.');
    _setModalHint('modalValidationSummary', 'Informe uma subpasta gerenciável (ex.: workbench).', 'error');
  }

  const qdrantModeEl = document.querySelector('input[name="modalQdrantMode"]:checked');
  const qdrantMode = qdrantModeEl ? qdrantModeEl.value : 'shared';
  const qdrantExisting = String(document.getElementById('modalQdrantExistingCollection')?.value || '').trim();
  if (qdrantMode === 'existing' && !qdrantExisting) {
    errors.push('Selecione uma coleção Qdrant existente.');
    _setModalHint('modalQdrantExistingHint', 'Selecione uma coleção para continuar.', 'error');
  }

  const caseCollection = document.getElementById('modalCaseQdrantCollection');
  const discoveryCollection = document.getElementById('modalDescobertaQdrantCollection');
  if (caseCollection && !caseCollection.value.trim()) caseCollection.dataset.auto = '1';
  if (discoveryCollection && !discoveryCollection.value.trim()) discoveryCollection.dataset.auto = '1';
  _syncSectionProfileDefaultsFromName(false);

  if (errors.length) {
    _setModalHint('modalValidationSummary', `${errors.length} ajuste(s) necessário(s) antes de salvar.`, 'error');
    return false;
  }
  return true;
}

function _applyDefaultSharedScopesSelection() {
  const checkboxes = Array.from(document.querySelectorAll('.modal-scope'));
  if (!checkboxes.length) return;
  const alreadyChecked = checkboxes.some(cb => cb.checked);
  if (alreadyChecked) return;

  checkboxes.forEach(cb => {
    const value = String(cb.value || '').trim().toLowerCase();
    cb.checked = _defaultAgentSharedScopes.includes(value);
  });
}

function _normalizeSkillLabel(path) {
  const raw = String(path || '').trim();
  if (!raw) return '';
  const clean = raw.replace(/\\/g, '/');
  const marker = 'LA8159-spaces/skills/';
  const idx = clean.indexOf(marker);
  let shortPath = idx >= 0 ? clean.slice(idx + marker.length) : clean;
  shortPath = shortPath.replace(/^\.\.\//, '');
  shortPath = shortPath.replace(/\.md$/i, '');
  return shortPath;
}

function _extractSkillsFromTree(nodes, out = []) {
  for (const node of (nodes || [])) {
    if (node && node.type === 'file' && node.path) {
      const label = _normalizeSkillLabel(node.path);
      if (label) out.push(label);
    }
    if (node && node.type === 'dir' && Array.isArray(node.children)) {
      _extractSkillsFromTree(node.children, out);
    }
  }
  return out;
}

function _parseTextareaLines(id) {
  const el = document.getElementById(id);
  if (!el) return [];
  return (el.value || '')
    .split('\n')
    .map(v => v.trim())
    .filter(Boolean);
}

function _setTextareaLines(id, values) {
  const el = document.getElementById(id);
  if (!el) return;
  el.value = values.join('\n');
}

function _renderPickerChips(targetId, values, removeHandlerName) {
  const container = document.getElementById(targetId);
  if (!container) return;
  if (!values.length) {
    container.innerHTML = '<span style="font-size:10px;color:var(--gray)">Nenhum item selecionado</span>';
    return;
  }
  container.innerHTML = values.map((v, i) =>
    `<span style="display:inline-flex;align-items:center;gap:6px;padding:3px 8px;border:1px solid var(--border-hi);border-radius:999px;background:var(--bg3);font-size:11px;color:var(--text2)">${escapeHtml(v)}<button type="button" onclick="${removeHandlerName}(${i})" style="background:none;border:none;color:var(--gray);cursor:pointer;padding:0;line-height:1" title="Remover"><i class="fas fa-times"></i></button></span>`
  ).join('');
}

function _syncSkillsTextareaAndChips() {
  const unique = Array.from(new Set(_selectedModalSkills.map(v => String(v).trim()).filter(Boolean))).sort();
  _selectedModalSkills = unique;
  _setTextareaLines('modalSkills', unique);
  _renderPickerChips('modalSkillsSelected', unique, 'removeModalSkill');
}

function _syncQdrantCollectionsTextareaAndChips() {
  const unique = Array.from(new Set(_selectedModalQdrantCollections.map(v => String(v).trim()).filter(Boolean))).sort();
  _selectedModalQdrantCollections = unique;
  _setTextareaLines('modalQdrantCollections', unique);
  _renderPickerChips('modalQdrantCollectionsSelected', unique, 'removeModalQdrantCollection');
}

function _syncModalPickersFromTextareas() {
  _selectedModalSkills = _parseTextareaLines('modalSkills');
  _selectedModalQdrantCollections = _parseTextareaLines('modalQdrantCollections');
  _syncSkillsTextareaAndChips();
  _syncQdrantCollectionsTextareaAndChips();
}

function toggleModalUnrestrictedToolsDisplay() {
  const checkbox = document.getElementById('modalUnrestrictedTools');
  const status = document.getElementById('modalUnrestrictedToolsStatus');
  if (!checkbox || !status) return;
  const enabled = !!checkbox.checked;
  status.textContent = enabled ? 'Sem restricoes: habilitado' : 'Sem restricoes: desabilitado';
  status.style.color = enabled ? 'var(--amber)' : 'var(--gray)';
}

function addModalSkill() {
  const input = document.getElementById('modalSkillInput');
  if (!input) return;
  const value = String(input.value || '').trim();
  if (!value) return;
  _selectedModalSkills.push(value);
  input.value = '';
  _syncSkillsTextareaAndChips();
}

function addModalSkillFromSelect() {
  const select = document.getElementById('modalSkillSelect');
  if (!select) return;
  const value = String(select.value || '').trim();
  if (!value) return;
  _selectedModalSkills.push(value);
  select.value = '';
  _syncSkillsTextareaAndChips();
}

function removeModalSkill(index) {
  _selectedModalSkills.splice(index, 1);
  _syncSkillsTextareaAndChips();
}

function addModalQdrantCollection() {
  const input = document.getElementById('modalQdrantCollectionInput');
  if (!input) return;
  const value = String(input.value || '').trim();
  if (!value) return;
  _selectedModalQdrantCollections.push(value);
  input.value = '';
  _syncQdrantCollectionsTextareaAndChips();
}

function removeModalQdrantCollection(index) {
  _selectedModalQdrantCollections.splice(index, 1);
  _syncQdrantCollectionsTextareaAndChips();
}

async function loadSkillOptions() {
  const select = document.getElementById('modalSkillSelect');
  if (!select) return;

  // Build a list of {id, name, description} skill entries. Prefer the self-hosted
  // agents/skills/manifest.json (served by the dev server via /api/skills/manifest
  // and also available as a static file), then fall back to the external
  // architecture service's tree, then to the generated skill-index.json ID list.
  const skills = await _fetchSkillManifest();
  if (skills && skills.length) {
    const opts = ['<option value="">Selecione uma skill...</option>'];
    for (const sk of skills) {
      const id = String(sk.id || '').trim();
      if (!id) continue;
      const label = String(sk.name || sk.id || '').trim();
      const desc = String(sk.description || '').trim();
      opts.push(
        `<option value="${escapeHtml(id)}"${desc ? ` title="${escapeHtml(desc)}"` : ''}>` +
        `${escapeHtml(label)}</option>`
      );
    }
    select.innerHTML = opts.join('');
    return;
  }

  // Final fallback: bare IDs only (no descriptions available).
  const ids = (await _fetchSkillIds()) || _fallbackSkillOptions;
  select.innerHTML = '<option value="">Selecione uma skill...</option>' +
    Array.from(new Set(ids.map(String))).sort()
      .map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
}

async function _fetchSkillManifest() {
  // 1) Dev server endpoint (always available locally).
  try {
    const res = await fetch(`${API_BASE}/api/skills/manifest`);
    if (res && res.ok) {
      const j = await res.json();
      if (Array.isArray(j.skills) && j.skills.length) return j.skills;
    }
  } catch (_e) { /* fall through */ }

  // 2) Static agents/skills/manifest.json (per-project / preview safe paths).
  const docBase = (location.pathname || '').replace(/\/[^/]*$/, '');
  const manifestCandidates = [
    docBase ? `${docBase}/agents/skills/manifest.json` : '/agents/skills/manifest.json',
    '/agents/skills/manifest.json',
    '/frontend/../agents/skills/manifest.json',
    'agents/skills/manifest.json',
  ];
  for (const p of manifestCandidates) {
    try {
      const r = await fetch(p);
      if (!r || !r.ok) continue;
      const j = await r.json();
      if (Array.isArray(j.skills) && j.skills.length) return j.skills;
    } catch (_err) { continue; }
  }

  // 3) External architecture tree.
  try {
    const res = await fetch(`${API_BASE}/api/skills/tree`);
    if (res && res.ok) {
      const data = await res.json();
      const names = _extractSkillsFromTree(data.tree || []);
      if (names.length) return names.map(n => ({ id: n, name: n }));
    }
  } catch (_e) { /* fall through */ }

  return null;
}

async function _fetchSkillIds() {
  // Workspace-level static skill index (generated from agents/skills).
  const docBase = (location.pathname || '').replace(/\/[^/]*$/, '');
  const candA = docBase ? `${docBase}/js/skill-index.json` : '/js/skill-index.json';
  const localCandidates = [
    candA,
    '/frontend/js/skill-index.json',
    '/js/skill-index.json',
    'js/skill-index.json'
  ];
  for (const p of localCandidates) {
    try {
      console.debug('[loadSkillOptions] trying', p);
      const r = await fetch(p);
      if (!r || !r.ok) continue;
      const j = await r.json();
      if (Array.isArray(j.skills) && j.skills.length) {
        return Array.from(new Set(j.skills.map(String))).sort();
      }
    } catch (_err) { continue; }
  }
  console.warn('[loadSkillOptions] no local skill-index.json found at tried paths:', localCandidates);
  return null;
}

function _normalizeMcpServerNames(values) {
  if (!Array.isArray(values)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of values) {
    const name = String(raw || '').trim();
    if (!name) continue;
    if (!/^[A-Za-z0-9._-]{1,64}$/.test(name)) continue;
    if (seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}

function _renderMcpServerOptions(selectedNames) {
  const grid = document.getElementById('modalMcpServersGrid');
  if (!grid) return;
  const selected = new Set(_normalizeMcpServerNames(selectedNames));
  if (!_availableMcpServers.length) {
    grid.innerHTML = '<div style="font-size:11px;color:var(--gray)">Nenhum servidor MCP configurado.</div>';
    return;
  }

  grid.innerHTML = _availableMcpServers.map((srv) => {
    const id = `modal_mcp_${String(srv.name || '').replace(/[^A-Za-z0-9_-]/g, '_')}`;
    const command = String(srv.command || '').trim();
    const args = Array.isArray(srv.args) ? srv.args : [];
    const detail = [command, args[0] || ''].filter(Boolean).join(' ');
    // Look up ecosystem enrichment — try direct name first, then via name_map
    let eco = _ecosystemMcpInfo[srv.name] || {};
    if (!eco.tool_count && _ecosystemNameMap[srv.name]) {
      const canonicalName = _ecosystemNameMap[srv.name];
      eco = _ecosystemMcpInfo[canonicalName] || {};
    }
    const toolCount = eco.tool_count || 0;
    const projectName = eco.project || '';
    const description = eco.description || '';
    const titleParts = [detail];
    if (toolCount) titleParts.push(`${toolCount} tools`);
    if (description) titleParts.push(description);
    const title = titleParts.join(' · ');
    const badge = toolCount ? ` <span class="mcp-tool-badge" style="font-size:9px;opacity:0.6">${toolCount}</span>` : '';
    const tag = projectName ? ` <span class="mcp-project-tag" style="font-size:9px;opacity:0.5">${escapeHtml(projectName)}</span>` : '';
    const checked = selected.has(srv.name) ? 'checked' : '';

    const tools = Array.isArray(eco.tools) ? eco.tools : [];
    const expandId = `mcp_expand_${String(srv.name || '').replace(/[^A-Za-z0-9_-]/g, '_')}`;
    const expandBtn = tools.length
      ? `<button type="button" class="mcp-tools-expand-btn" onclick="mcpToggleToolPanel('${expandId}', this)" title="Show/hide individual tools" aria-expanded="false">
           <i class="fas fa-chevron-right" style="font-size:8px;pointer-events:none"></i>
         </button>`
      : '';

    let toolRows = '';
    if (tools.length) {
      const toolChecks = tools.map((tool) => {
        const toolName = typeof tool === 'string' ? tool : (tool.name || tool);
        const cbId = `mcp_tool_${String(toolName).replace(/[^A-Za-z0-9_-]/g, '_')}`;
        return `<div class="tool-check mcp-indiv-tool" style="font-size:10px">
          <input type="checkbox" class="mcp-tool-checkbox" id="${cbId}" value="${escapeHtml(toolName)}" checked>
          <label for="${cbId}" style="font-family:var(--mono,monospace)">${escapeHtml(toolName)}</label>
        </div>`;
      }).join('');
      toolRows = `<div class="mcp-tool-panel" id="${expandId}" role="region" style="display:none">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <span style="font-size:9px;color:var(--gray);text-transform:uppercase;letter-spacing:.04em">Individual tools</span>
          <span style="display:flex;gap:6px">
            <button type="button" onclick="mcpSelectAllTools('${expandId}', true)" style="font-size:9px;background:none;border:none;color:var(--amber);cursor:pointer;padding:0">All</button>
            <button type="button" onclick="mcpSelectAllTools('${expandId}', false)" style="font-size:9px;background:none;border:none;color:var(--gray);cursor:pointer;padding:0">None</button>
          </span>
        </div>
        <div class="mcp-tool-panel-grid">${toolChecks}</div>
      </div>`;
    }

    return `<div class="mcp-server-row">
  <div class="mcp-server-row-header tool-check">
    <input type="checkbox" class="modal-mcp-server" id="${id}" value="${escapeHtml(srv.name)}" ${checked} onchange="mcpServerToggle(this, '${expandId}')">
    <label for="${id}" title="${escapeHtml(title)}">${escapeHtml(srv.name)}${badge}${tag}</label>
    ${expandBtn}
  </div>${toolRows}</div>`;
  }).join('');
  _restorePendingToolPermissions();
}

/** Toggle an individual server's tool panel open/closed. */
window.mcpToggleToolPanel = function(panelId, btn) {
  const panel = document.getElementById(panelId);
  if (!panel) return;
  const open = panel.style.display !== 'none';
  panel.style.display = open ? 'none' : 'block';
  const icon = btn && btn.querySelector('i');
  if (icon) icon.style.transform = open ? '' : 'rotate(90deg)';
  btn && btn.setAttribute('aria-expanded', String(!open));
};

/** Select or deselect all tools in a panel. */
window.mcpSelectAllTools = function(panelId, checked) {
  const panel = document.getElementById(panelId);
  if (!panel) return;
  panel.querySelectorAll('.mcp-tool-checkbox').forEach((cb) => { cb.checked = checked; });
};

/** When a server checkbox is toggled, disable/enable its tools. */
window.mcpServerToggle = function(serverCb, panelId) {
  const panel = document.getElementById(panelId);
  if (!panel) return;
  panel.querySelectorAll('.mcp-tool-checkbox').forEach((cb) => { cb.disabled = !serverCb.checked; });
};

/** Restore _pendingToolPermissions into inline tool checkboxes after render. */
function _restorePendingToolPermissions() {
  if (!_pendingToolPermissions) return;
  const pending = new Set(_pendingToolPermissions);
  _pendingToolPermissions = null;
  // Uncheck all first, then re-check only those that were explicitly saved
  document.querySelectorAll('.mcp-tool-checkbox').forEach((cb) => {
    cb.checked = pending.has(cb.value);
  });
}

function _selectedMcpServerNamesFromModal() {
  const selected = Array.from(document.querySelectorAll('.modal-mcp-server:checked')).map(el => el.value);
  return _normalizeMcpServerNames(selected);
}

/** Look up ecosystem metadata for a server by its config name (handles name_map). */
function _ecoForServer(configName) {
  let eco = _ecosystemMcpInfo[configName] || {};
  if (!eco.tools && _ecosystemNameMap[configName]) {
    eco = _ecosystemMcpInfo[_ecosystemNameMap[configName]] || {};
  }
  return eco;
}

/** Return the list of individually permitted tool names from inline checkboxes. */
function _selectedMcpToolNames() {
  return Array.from(document.querySelectorAll('.mcp-tool-checkbox:checked')).map((cb) => cb.value);
}

async function loadMcpServerOptions(selectedNames = null) {
  const grid = document.getElementById('modalMcpServersGrid');
  if (!grid) return;
  grid.innerHTML = '<div style="text-align:center;padding:8px;color:var(--gray);font-size:11px"><div class="loading"></div> Carregando...</div>';

  // Load MCP server info from ecosystem agents endpoint
  try {
    const ecoRes = await fetch(`${API_BASE}/api/ecosystem/agents`);
    if (ecoRes.ok) {
      const ecoData = await ecoRes.json();
      const flatServers = Array.isArray(ecoData.mcp_servers_flat) ? ecoData.mcp_servers_flat : [];
      const flatMap = {};
      for (const srv of flatServers) {
        flatMap[srv.name] = {
          tool_count: srv.tool_count || 0,
          project: srv.project || '',
          description: srv.description || '',
          tools: Array.isArray(srv.tools) ? srv.tools : [],
        };
        _availableMcpServers.push({
          name: srv.name,
          command: srv.command || '',
          args: srv.args || [],
        });
      }
      _ecosystemMcpInfo = flatMap;
      // Fallback to all available runtime servers if no MCP servers found
      if (!_availableMcpServers.length && _availableMcpServers.length === 0) {
        // Keep _availableMcpServers as loaded from ecosystem
      }
    }
  } catch (_e) {
    // Fallback to empty state if ecosystem fetch fails
    _availableMcpServers = [];
  }

  let selected = selectedNames;
  if (!Array.isArray(selected)) {
    selected = _availableMcpServers.map((s) => s.name);
  }
  const availableNames = new Set(_availableMcpServers.map((s) => s.name));
  const filteredSelected = _normalizeMcpServerNames(selected).filter((name) => availableNames.has(name));
  if (!filteredSelected.length && _availableMcpServers.length) {
    // If an agent still references removed servers (e.g. local stacks),
    // fall back to all currently available runtime servers.
    selected = _availableMcpServers.map((s) => s.name);
  } else {
    selected = filteredSelected;
  }
  _renderMcpServerOptions(selected);
  // Tools are now rendered inline per-server; no separate sync needed.
}

// Load agents from API and update UI
async function loadAgents() {
  if (window.Olivia_EMBED_MODE) return;
  // Map seeded runtime agent names to the slugs used in agents.olivia.language.json.
  if (typeof window.registerAgentSlugOverrides === 'function') {
    window.registerAgentSlugOverrides({
      'Olivia Coordinator': 'olivia-coordinator',
      'Olivia · Coordinator': 'olivia-coordinator',
      'Olivia Ecosystem Coordinator': 'olivia-ecosystem-coordinator',
      'Olivia Qdrant Manager Agent': 'olivia-qdrant-manager',
      'Olivia Studio UI Agent': 'olivia-studio-ui',
      'Olivia Orchestrator Control Plane': 'orchestrator-control-plane',
      'Orchestrator Control Plane': 'orchestrator-control-plane',
      'Olivia Discovery Intelligence Agent': 'olivia-discovery-intelligence',
      'Olivia Listening Intelligence Agent': 'olivia-listening-intelligence',
      'Olivia Document Intelligence Agent': 'olivia-document-intelligence',
      'Olivia Writer Agent': 'olivia-writer-agent',
      'Olivia Spaces Agent': 'olivia-spaces-agent',
    });
  }
  // Re-localize the agent list / sidebar when the workspace language changes.
  if (typeof document !== 'undefined' && !loadAgents._langBound) {
    loadAgents._langBound = true;
    document.addEventListener('olivia:lang-changed', function () { renderAgentList(); });
  }
  try {
    const res = await fetch(`${API_BASE}/api/agents/list`);
    const data = await res.json();
    agents = (Array.isArray(data) ? data : (data.agents || [])).map(a => ({
      ...a,
      agent_type: _normalizedAgentType(a && a.agent_type),
    }));
    if (typeof window.oliviaSyncSectionAgentRuntime === 'function') {
      window.oliviaSyncSectionAgentRuntime(agents);
    }
    await loadAgentBackgroundStatuses({ rerender: false });
    await loadAgentInvestigationBoard({ rerender: false });
    ensureAgentBackgroundPolling();
    renderAgentList();
  } catch (e) {
    const agentList = document.getElementById('agentList');
    if (agentList) {
      agentList.innerHTML = '<div style="text-align:center;padding:30px;color:var(--red);font-size:12px"><i class="fas fa-exclamation-circle"></i> ' + (typeof window.t === 'function' ? window.t('ui.agentsLoadFailed', 'Failed to load agents') : 'Failed to load agents') + '</div>';
    }
  }
}

// Render agent list in sidebar
function renderAgentList() {
  const list = document.getElementById('agentList');
  if (!list) return;

  const opsPanel = _renderInvestigationOpsPanel();

  if (!agents.length) {
    list.innerHTML = opsPanel + '<div style="text-align:center;padding:30px 10px"><i class="fas fa-robot" style="font-size:24px;color:var(--border-hi);margin-bottom:10px;display:block"></i><p style="color:var(--gray);font-size:13px">' + (typeof window.t === 'function' ? window.t('ui.noAgentsYet', 'No agents yet') : 'No agents yet') + '</p></div>';
  } else {
    const grouped = new Map();
    agents.forEach((agent) => {
      const group = _deriveAgentGroup(agent);
      if (!grouped.has(group)) grouped.set(group, []);
      grouped.get(group).push(agent);
    });

    const groupedHtml = Array.from(grouped.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([group, items]) => {
        const isCollapsed = !!_agentSidebarUiState.agentGroupsCollapsed[group];
        const bodyHtml = items
          .slice()
          .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
          .map(_renderAgentListItem)
          .join('');
        return `<div class="agent-group-block" data-group="${escapeHtml(group)}">
          <button class="agent-group-header" onclick="toggleAgentListGroup('${_encodedKey(group)}')" title="${(typeof window.t === 'function' ? window.t('ui.collapseGroup', 'Expand/collapse group') : 'Expand/collapse group')}">
            <span><i class="fas ${isCollapsed ? 'fa-chevron-right' : 'fa-chevron-down'}"></i> ${escapeHtml(group)}</span>
            <span>${items.length}</span>
          </button>
          <div class="agent-group-body${isCollapsed ? ' is-collapsed' : ''}">${bodyHtml}</div>
        </div>`;
      }).join('');

    const groupTools = `<div style="display:flex;justify-content:flex-end;gap:4px;margin-bottom:6px">
      <button class="btn-xs" onclick="collapseAllAgentGroups()" style="margin-right:4px"><i class="fas fa-compress-alt"></i></button>
      <button class="btn-xs" onclick="expandAllAgentGroups()"><i class="fas fa-expand-alt"></i></button>
    </div>`;
    list.innerHTML = opsPanel + groupTools + groupedHtml;
  }
  const t = (k, d) => (typeof window.t === 'function' ? window.t(k, d) : d);
  list.innerHTML += `<button class="add-agent-btn" onclick="showCreateModal()"><i class="fas fa-plus"></i> ${t('ui.novoAgente', 'New Agent')}</button>`;
  list.innerHTML += `<button class="add-agent-btn" onclick="showImportBundleModal()" style="margin-top:2px;border-color:var(--amber);color:var(--amber)"><i class="fas fa-box-open"></i> ${t('ui.importarAgente', 'Import Agent/Group')}</button>`;
  list.innerHTML += `<div class="agent-bg-shared">${t('ui.baseShared', 'Shared Base')}: ${Number(_agentBgSharedStats.total_links || 0)} links</div>`;
  list.innerHTML += `<button class="add-agent-btn" style="margin-top:6px;padding:9px;font-size:11px" onclick="openSharedReferenceLinks()"><i class="fas fa-book-open"></i> ${t('ui.verLinksShared', 'View Shared Links')}</button>`;
}

async function refreshInvestigationBoard() {
  await loadAgentBackgroundStatuses({ rerender: false });
  await loadAgentInvestigationBoard({ rerender: true });
}

// Select an agent and update UI
async function selectAgent(id) {
  selectedAgent = agents.find(a => a.agent_id === id) || null;
  if (typeof window.oliviaOnPrimaryAgentSelected === 'function') {
    window.oliviaOnPrimaryAgentSelected(selectedAgent);
  }
  renderAgentList();
  if (selectedAgent) {
    const t = (k, d) => (typeof window.t === 'function' ? window.t(k, d) : d);
    const aT = (field, d) => (typeof window.agentT === 'function' && typeof window.agentSlug === 'function'
      ? window.agentT(window.agentSlug(selectedAgent), field, d) : d);
    // Prefer the localized name/description from the agents language dictionary.
    const displayName = aT('name', selectedAgent.name) || selectedAgent.name;
    const displayDesc = aT('description', selectedAgent.description) || selectedAgent.description || '';
    document.getElementById('chatAgentName').textContent = displayName;
    const active = selectedAgent.status === 'active';
    const badge = document.getElementById('chatAgentBadge');
    badge.textContent = active ? 'active' : 'inactive';
    badge.className = 'chat-agent-badge ' + (active ? 'active' : 'inactive');
    // Update sidebar agent info
    const sidebarName = document.getElementById('sidebarAgentName');
    const sidebarDot = document.getElementById('sidebarAgentDot');
    if (sidebarName) sidebarName.textContent = displayName;
    if (sidebarDot) sidebarDot.className = 'session-agent-dot' + (active ? ' active' : '');
    const notice = t('ui.agentSelected', 'Agent "%s" selected (%s). %s')
      .replace('%s', displayName)
      .replace('%s', _agentTypeLabel(selectedAgent.agent_type))
      .replace('%s', displayDesc);
    const now = Date.now();
    if (_lastAgentSelectionNotice.key !== notice || (now - _lastAgentSelectionNotice.at) > 2500) {
      addSystemBubble(notice);
      _lastAgentSelectionNotice = { key: notice, at: now };
    }
    renderAgentMemoryInfo(selectedAgent);
    if (typeof syncProjectFromAgent === 'function') {
      syncProjectFromAgent(selectedAgent.agent_id);
    }
    if (typeof refreshCaseUploadTargetPath === 'function') {
      refreshCaseUploadTargetPath();
    }
    const sharedTab = document.getElementById('tab-shared');
    if (sharedTab && sharedTab.classList.contains('active') && typeof loadSharedDataTree === 'function') {
      loadSharedDataTree();
    }
    const docsTab = document.getElementById('tab-docs');
    if (docsTab && docsTab.classList.contains('active') && typeof loadDocsTree === 'function') {
      loadDocsTree();
    }
    loadChatHistory();
  }
}

// Toggle agent active/inactive status
async function toggleAgentStatus(id, activate) {
  if (_agentStatusPending.has(id)) return;
  _agentStatusPending.add(id);

  try {
    const endpoint = activate ? 'activate' : 'deactivate';
    const res = await fetch(`${API_BASE}/api/agents/${id}/${endpoint}`, { method: 'POST' });
    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const data = await res.json();
        detail = data.detail || data.message || data.error || JSON.stringify(data);
      } catch (_e) {
        try {
          const text = await res.text();
          if (text) detail = text;
        } catch (_e2) {
          // Keep HTTP status fallback when response body is unreadable.
        }
      }
      throw new Error(detail);
    }

    await loadAgents();
    if (selectedAgent && selectedAgent.agent_id === id) {
      selectedAgent = agents.find(a => a.agent_id === id) || null;
      await selectAgent(id);
    }
  } catch (e) { addSystemBubble(`Falha ao ${activate ? 'ativar' : 'desativar'} agente: ${e.message}`); }
  finally { _agentStatusPending.delete(id); }
}

// Delete an agent
async function deleteAgent(id, name) {
  if (!await window.customConfirm((typeof window.t === 'function' ? window.t('ui.deleteAgentConfirm', 'Delete agent "%s"? This action cannot be undone.') : 'Delete agent "%s"? This action cannot be undone.').replace('%s', name))) return;
  try {
    await fetch(`${API_BASE}/api/agents/${id}`, { method: 'DELETE' });
    if (selectedAgent && selectedAgent.agent_id === id) { selectedAgent = null; document.getElementById('chatAgentName').textContent = (typeof window.t === 'function' ? window.t('ui.noAgent', 'No Agent') : 'No Agent'); }
    await loadAgents();
  } catch (e) { addSystemBubble((typeof window.t === 'function' ? window.t('ui.deleteAgentFailed', 'Failed to delete agent: %s') : 'Failed to delete agent: %s').replace('%s', e.message)); }
}

function _extractAgentDescriptionFromMarkdown(text) {
  const lines = String(text || '').split('\n');
  const headingRe = /^#{1,2}\s+/;
  const purposeIdx = lines.findIndex(l => /^##\s+purpose\b/i.test(String(l || '').trim()));
  if (purposeIdx >= 0) {
    const buff = [];
    for (let i = purposeIdx + 1; i < lines.length; i++) {
      const line = String(lines[i] || '');
      const trimmed = line.trim();
      if (!trimmed && !buff.length) continue;
      if (headingRe.test(trimmed)) break;
      if (!trimmed && buff.length) break;
      buff.push(trimmed);
    }
    const desc = buff.join(' ').trim();
    if (desc) return desc;
  }

  // Fallback: first non-heading paragraph after title.
  let passedTitle = false;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = String(lines[i] || '').trim();
    if (!trimmed) continue;
    if (!passedTitle && /^#\s+/.test(trimmed)) {
      passedTitle = true;
      continue;
    }
    if (/^#{1,2}\s+/.test(trimmed)) continue;
    return trimmed;
  }
  return '';
}

function _deriveAgentNameFromFilename(fileName) {
  const raw = String(fileName || '')
    .replace(/\.agent\.md$/i, '')
    .replace(/\.md$/i, '')
    .replace(/[_-]+/g, ' ')
    .trim();
  return raw || 'agente-importado';
}

function _parseToolsFromFrontmatter(frontmatter) {
  const tools = [];
  const inline = frontmatter.match(/^tools:\s*\[([^\]]*)\]\s*$/im);
  if (inline) {
    inline[1]
      .split(',')
      .map(t => t.trim().replace(/['"]/g, ''))
      .filter(Boolean)
      .forEach(t => tools.push(t));
  }
  const block = frontmatter.match(/(?:^|\n)tools:\s*\n((?:\s*-\s*.+\n?)*)/im);
  if (block && block[1]) {
    block[1]
      .split('\n')
      .map(l => l.match(/^\s*-\s*(.+)\s*$/))
      .filter(Boolean)
      .map(m => String(m[1] || '').trim().replace(/['"]/g, ''))
      .filter(Boolean)
      .forEach(t => tools.push(t));
  }
  return Array.from(new Set(tools));
}

// Import agent from .agent.md file
function importAgentMd(input) {
  const file = input.files[0];
  if (!file) return;
  const status = document.getElementById('modalImportStatus');
  status.textContent = 'Reading...';
  status.style.color = 'var(--gray)';

  const reader = new FileReader();
  reader.onload = function (e) {
    const raw = String(e.target.result || '');
    const text = raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');

    // Parse YAML frontmatter between --- markers (if present)
    const fmMatch = text.match(/^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/);
    let name = '';
    let description = '';
    let body = text.trim();
    let importedVia = 'markdown';

    if (fmMatch) {
      const fm = fmMatch[1];
      body = text.slice(fmMatch[0].length).trim();
      importedVia = 'yaml';

      const nameMatch = fm.match(/^name:\s*(.+)$/im);
      const descMatch = fm.match(/^description:\s*(.+)$/im);
      if (nameMatch) name = String(nameMatch[1] || '').trim().replace(/^['"]|['"]$/g, '');
      if (descMatch) description = String(descMatch[1] || '').trim().replace(/^['"]|['"]$/g, '');
    }

    // Fallback import for plain .agent.md without frontmatter
    if (!name) {
      const titleMatch = body.match(/^#\s+(.+)$/m);
      name = titleMatch ? String(titleMatch[1] || '').trim() : _deriveAgentNameFromFilename(file.name);
    }
    if (!description) {
      description = _extractAgentDescriptionFromMarkdown(body || text);
    }

    if (name) document.getElementById('modalAgentName').value = name;
    if (description) document.getElementById('modalAgentDesc').value = description;
    if (body) document.getElementById('modalSystemPrompt').value = body;
    _syncSectionProfileDefaultsFromName(false);
    _clearModalValidationHints();

    status.textContent = importedVia === 'yaml'
      ? `Importado com frontmatter: ${file.name}`
      : `Importado sem frontmatter: ${file.name}`;
    status.style.color = 'var(--green)';
  };
  reader.onerror = function () {
    status.textContent = 'Falha ao ler arquivo';
    status.style.color = 'var(--red)';
  };
  reader.readAsText(file);
  // Reset input so same file can be re-imported
  input.value = '';
}

// Export agent to .agent.md file
function exportAgentMd(agentId) {
  const agent = agents.find(a => a.agent_id === agentId);
  if (!agent) return;

  const toolsList = (agent.tools || []).map(t => `${t}`).join(', ');
  const desc = (agent.description || '').replace(/"/g, '\\"');
  let md = `---\nname: ${agent.name}\n`;
  md += `description: "${desc}"\n`;
  if (toolsList) md += `tools: [${toolsList}]\n`;
  md += `---\n\n`;

  // Append system prompt if present
  if (agent.system_prompt) md += agent.system_prompt;

  const blob = new Blob([md], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${agent.name.replace(/[^a-z0-9]/gi, '_')}.agent.md`;
  a.click();
  URL.revokeObjectURL(url);
  addSystemBubble(`Agente "${agent.name}" exportado como .agent.md`);
}

// Export full agent bundle (tools, chats, logs)
async function exportAgentBundle(agentId) {
  try {
    const res = await fetch(`${API_BASE}/api/agents/${agentId}/bundle/export`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agent_bundle_${agentId}_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addSystemBubble(`Bundle do agente exportado (${Object.keys(data).length} seções)`);
  } catch (e) {
    addSystemBubble(`Falha ao exportar bundle: ${e.message}`);
  }
}

function _titleCase(value) {
  return String(value || '')
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(' ');
}

function _bundleImportResetUi() {
  const summary = document.getElementById('bundleImportSummary');
  const catalogSummary = document.getElementById('bundleCatalogSummary');
  const fileInput = document.getElementById('bundleFileInput');
  const uploadBtn = document.getElementById('bundleImportBtn');
  const groupBtn = document.getElementById('bundleImportGroupFromCatalogBtn');
  const agentBtn = document.getElementById('bundleImportAgentFromCatalogBtn');
  if (summary) {
    summary.innerHTML = '';
    delete summary.dataset.bundle;
  }
  if (catalogSummary) {
    catalogSummary.textContent = 'Carregando catálogo de bundles...';
  }
  if (fileInput) fileInput.value = '';
  var _tImp = (typeof window.t === 'function');
  if (uploadBtn) {
    uploadBtn.disabled = true;
    uploadBtn.innerHTML = '<i class="fas fa-download" style="margin-right:4px"></i> ' + (_tImp ? window.t('ui.importAgent', 'Import Agent') : 'Import Agent');
  }
  if (groupBtn) {
    groupBtn.disabled = true;
    groupBtn.innerHTML = '<i class="fas fa-layer-group" style="margin-right:4px"></i> ' + (_tImp ? window.t('ui.importGroup', 'Import Group') : 'Import Group');
  }
  if (agentBtn) {
    agentBtn.disabled = true;
    agentBtn.innerHTML = '<i class="fas fa-user-plus" style="margin-right:4px"></i> ' + (_tImp ? window.t('ui.importAgent', 'Import Agent') : 'Import Agent');
  }
}

function _bindBundleDropZone() {
  const zone = document.getElementById('bundleDropZone');
  if (!zone || zone.dataset.bound === '1') return;
  zone.dataset.bound = '1';
  zone.addEventListener('dragover', (ev) => {
    ev.preventDefault();
    zone.classList.add('dragover');
  });
  zone.addEventListener('dragleave', () => {
    zone.classList.remove('dragover');
  });
  zone.addEventListener('drop', (ev) => {
    ev.preventDefault();
    zone.classList.remove('dragover');
    const file = ev.dataTransfer?.files?.[0];
    if (file) _previewBundleFile(file);
  });
}

function _bundleImportSetCatalogSummary(text, tone = 'info') {
  const el = document.getElementById('bundleCatalogSummary');
  if (!el) return;
  const color = tone === 'error' ? 'var(--red)' : (tone === 'ok' ? 'var(--green)' : 'var(--gray-hi)');
  el.style.color = color;
  el.textContent = String(text || '');
}

function _bundleImportUpdateCatalogButtons() {
  const groupBtn = document.getElementById('bundleImportGroupFromCatalogBtn');
  const agentBtn = document.getElementById('bundleImportAgentFromCatalogBtn');
  const selectedGroup = _bundleImportState.groups.find(g => g.id === _bundleImportState.selectedGroupId) || null;
  const selectedAgent = selectedGroup?.agents?.find(a => a.id === _bundleImportState.selectedAgentId) || null;
  if (groupBtn) groupBtn.disabled = !selectedGroup || !selectedGroup.agents?.length || _bundleImportState.catalogLoading;
  if (agentBtn) agentBtn.disabled = !selectedAgent || _bundleImportState.catalogLoading;
}

function _bundleImportRenderCatalogSelectors() {
  const groupSelect = document.getElementById('bundleCatalogGroup');
  const agentSelect = document.getElementById('bundleCatalogAgent');
  if (!groupSelect || !agentSelect) return;

  const groups = _bundleImportState.groups || [];
  if (!groups.length) {
    groupSelect.innerHTML = '<option value="">Nenhum grupo disponível</option>';
    agentSelect.innerHTML = '<option value="">Nenhum agente disponível</option>';
    _bundleImportSetCatalogSummary('Nenhum bundle de catálogo encontrado.', 'error');
    _bundleImportUpdateCatalogButtons();
    return;
  }

  if (!groups.some(g => g.id === _bundleImportState.selectedGroupId)) {
    _bundleImportState.selectedGroupId = groups[0].id;
  }
  groupSelect.innerHTML = groups.map((group) => {
    const count = Array.isArray(group.agents) ? group.agents.length : 0;
    const selected = group.id === _bundleImportState.selectedGroupId ? ' selected' : '';
    return `<option value="${escapeHtml(group.id)}"${selected}>${escapeHtml(group.label)} (${count})</option>`;
  }).join('');

  const selectedGroup = groups.find(g => g.id === _bundleImportState.selectedGroupId) || groups[0];
  const agentsList = Array.isArray(selectedGroup.agents) ? selectedGroup.agents : [];
  if (!agentsList.some(a => a.id === _bundleImportState.selectedAgentId)) {
    _bundleImportState.selectedAgentId = agentsList.length ? agentsList[0].id : '';
  }
  agentSelect.innerHTML = agentsList.length
    ? agentsList.map((agent) => {
      const selected = agent.id === _bundleImportState.selectedAgentId ? ' selected' : '';
      return `<option value="${escapeHtml(agent.id)}"${selected}>${escapeHtml(agent.name)}</option>`;
    }).join('')
    : '<option value="">Nenhum agente com bundle</option>';

  const sourceLabel = _bundleImportState.catalogSource === 'groups'
    ? 'Fonte: grupos de arquitetura'
    : 'Fonte: catálogo de agentes';
  _bundleImportSetCatalogSummary(`${sourceLabel}. ${groups.length} grupo(s) e ${groups.reduce((acc, g) => acc + (g.agents?.length || 0), 0)} agente(s) com bundle.`, 'ok');
  _bundleImportUpdateCatalogButtons();
}

async function _bundleImportLoadCatalog(force = false) {
  if (_bundleImportState.catalogLoading) return;
  if (_bundleImportState.catalogLoaded && !force) {
    _bundleImportRenderCatalogSelectors();
    return;
  }
  _bundleImportState.catalogLoading = true;
  _bundleImportSetCatalogSummary('Carregando catálogo de bundles...');
  _bundleImportUpdateCatalogButtons();

  try {
    const res = await fetch(`${API_BASE}/api/agent-groups`);
    const data = await res.json();
    const groups = (data.groups || []).map(group => ({
      id: String(group.id),
      label: String(group.label || _titleCase(group.id) || group.id),
      agents: (group.agents || []).map(agent => ({
        id: `${group.id}:${agent.id}`,
        slug: String(agent.id),
        name: String(agent.name || agent.id),
        source: { type: 'local_md', path: agent.path },   // new source type
      })),
    })).filter(g => g.agents.length > 0)
      .sort((a, b) => a.label.localeCompare(b.label));

    _bundleImportState.groups = groups;
    _bundleImportState.catalogSource = 'local';
    _bundleImportState.catalogLoaded = true;
    _bundleImportState.catalogLoading = false;
    _bundleImportRenderCatalogSelectors();
    _bundleImportSetCatalogSummary(`Catálogo local: ${groups.length} grupo(s) e ${groups.reduce((acc, g) => acc + g.agents.length, 0)} agente(s).`, 'ok');
  } catch (e) {
    _bundleImportState.catalogLoaded = true;
    _bundleImportState.catalogLoading = false;
    _bundleImportSetCatalogSummary('Erro ao carregar catálogo local.', 'error');
    _bundleImportUpdateCatalogButtons();
  }
}

function bundleImportSetMode(mode) {
  const m = String(mode || '').toLowerCase();
  const nextMode = m === 'upload' ? 'upload' : m === 'plugins' ? 'plugins' : 'catalog';
  _bundleImportState.mode = nextMode;
  const uploadSection = document.getElementById('bundleImportUploadSection');
  const catalogSection = document.getElementById('bundleImportCatalogSection');
  const pluginsSection = document.getElementById('bundleImportPluginsSection');
  const uploadBtn = document.getElementById('bundleImportBtn');
  const uploadTab = document.getElementById('bundleImportModeUpload');
  const catalogTab = document.getElementById('bundleImportModeCatalog');
  const pluginsTab = document.getElementById('bundleImportModePlugins');

  if (uploadSection) uploadSection.style.display = nextMode === 'upload' ? '' : 'none';
  if (catalogSection) catalogSection.style.display = nextMode === 'catalog' ? '' : 'none';
  if (pluginsSection) pluginsSection.style.display = nextMode === 'plugins' ? '' : 'none';
  if (uploadBtn) uploadBtn.style.display = nextMode === 'upload' ? '' : 'none';

  if (uploadTab) uploadTab.classList.toggle('is-active', nextMode === 'upload');
  if (catalogTab) catalogTab.classList.toggle('is-active', nextMode === 'catalog');
  if (pluginsTab) pluginsTab.classList.toggle('is-active', nextMode === 'plugins');
  if (nextMode === 'catalog') _bundleImportLoadCatalog();
  if (nextMode === 'plugins') _bundleImportLoadPlugins();
}

function _bundleImportReadSourcePayload(data) {
  if (data && typeof data === 'object') {
    if (data.bundle && typeof data.bundle === 'object') return data;
    if (data.agent && typeof data.agent === 'object') return { bundle: data };
  }
  return null;
}

function _bundleImportPreviewFromPayload(payload) {
  const summary = document.getElementById('bundleImportSummary');
  const btn = document.getElementById('bundleImportBtn');
  if (!summary || !btn) return;

  const wrapped = _bundleImportReadSourcePayload(payload);
  if (!wrapped) {
    summary.innerHTML = '<div style="color:var(--red);font-size:12px"><i class="fas fa-exclamation-circle"></i> JSON sem estrutura de bundle.</div>';
    btn.disabled = true;
    _bundleImportState.bundlePayload = null;
    return;
  }

  const bundle = wrapped.bundle || {};
  const agent = bundle.agent || {};
  const tools = Array.isArray(agent.tools) ? agent.tools : [];
  const linked = Array.isArray(agent.linked_files) ? agent.linked_files : [];
  const knowledge = Array.isArray(bundle.knowledge?.files) ? bundle.knowledge.files : [];

  summary.innerHTML = [
    '<div class="bundle-summary">',
    '<div class="bs-row"><span class="bs-label">Agente</span><span class="bs-value">' + escapeHtml(agent.name || 'sem nome') + '</span></div>',
    '<div class="bs-row"><span class="bs-label">Ferramentas</span><span class="bs-value">' + tools.length + '</span></div>',
    '<div class="bs-row"><span class="bs-label">Arquivos vinculados</span><span class="bs-value">' + linked.length + '</span></div>',
    '<div class="bs-row"><span class="bs-label">Knowledge files</span><span class="bs-value">' + knowledge.length + '</span></div>',
    '</div>'
  ].join('');
  _bundleImportState.bundlePayload = wrapped;
  btn.disabled = false;
}

function _previewBundleFile(file) {
  const summary = document.getElementById('bundleImportSummary');
  const btn = document.getElementById('bundleImportBtn');
  if (!file || !file.name || !/\.json$/i.test(file.name)) {
    if (summary) {
      summary.innerHTML = '<div style="color:var(--red);font-size:12px"><i class="fas fa-exclamation-circle"></i> Selecione um arquivo .json válido.</div>';
    }
    if (btn) btn.disabled = true;
    return;
  }
  const reader = new FileReader();
  reader.onload = function (ev) {
    try {
      const parsed = JSON.parse(String(ev.target?.result || '{}'));
      _bundleImportPreviewFromPayload(parsed);
    } catch (err) {
      if (summary) {
        summary.innerHTML = `<div style="color:var(--red);font-size:12px"><i class="fas fa-exclamation-circle"></i> JSON inválido: ${escapeHtml(err.message)}</div>`;
      }
      if (btn) btn.disabled = true;
    }
  };
  reader.readAsText(file);
}

async function _bundleImportFetchPayloadFromAgent(item) {
  const source = item?.source || {};
  if (!source.type) throw new Error('source_invalida');

  // ── Local .agent.md file (from agents-groups directory) ──
  if (source.type === 'local_md') {
    if (!source.path) throw new Error('source_invalida');
    const res = await fetch(`${API_BASE}/api/agent-groups/file?path=${encodeURIComponent(source.path)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const mdContent = await res.text();

    const text = mdContent.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
    const fmMatch = text.match(/^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/);
    let name = '';
    let description = '';
    let system_prompt = text.trim();

    if (fmMatch) {
      const fm = fmMatch[1];
      system_prompt = text.slice(fmMatch[0].length).trim();
      const nameMatch = fm.match(/^name:\s*(.+)$/im);
      const descMatch = fm.match(/^description:\s*(.+)$/im);
      if (nameMatch) name = String(nameMatch[1] || '').trim().replace(/^['"]|['"]$/g, '');
      if (descMatch) description = String(descMatch[1] || '').trim().replace(/^['"]|['"]$/g, '');
    } else {
      const titleMatch = text.match(/^#\s+(.+)$/m);
      name = titleMatch ? String(titleMatch[1] || '').trim() : (item.name || item.id || 'agente-local');
    }

    return {
      bundle: {
        agent: {
          name: name || item.name,
          description: description || '',
          system_prompt: system_prompt,
          tools: ['*'],
        },
      },
    };
  }

  // ── Old JSON bundle import (from architecture endpoints) ──
  if (source.type === 'bundle_file') {
    let rel = String(source.value || '').trim().replace(/^\/+/, '');
    while (rel.startsWith('generated/')) rel = rel.slice('generated/'.length);
    if (!rel) throw new Error('bundle_file_invalido');
    const encoded = rel.split('/').map(part => encodeURIComponent(part)).join('/');
    const url = `${API_BASE}/api/architecture/generated/${encoded}`;
    const res = await fetch(url);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
    const wrapped = _bundleImportReadSourcePayload(data);
    if (!wrapped) throw new Error('payload_bundle_invalido');
    return wrapped;
  }

  if (source.type === 'bundle_id') {
    const url = `${API_BASE}/api/architecture/bundles/${encodeURIComponent(String(source.value || ''))}`;
    const res = await fetch(url);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
    const wrapped = _bundleImportReadSourcePayload(data);
    if (!wrapped) throw new Error('payload_bundle_invalido');
    return wrapped;
  }

  throw new Error('tipo_de_source_nao_suportado');
}


async function _bundleImportSend(payload) {
  const res = await fetch(`${API_BASE}/api/agents/import/bundle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.agent_id) {
    const detail = data?.detail || data?.message || data?.error || `HTTP ${res.status}`;
    throw new Error(String(detail));
  }
  return data;
}

function onBundleCatalogGroupChange() {
  const groupSelect = document.getElementById('bundleCatalogGroup');
  _bundleImportState.selectedGroupId = String(groupSelect?.value || '');
  _bundleImportState.selectedAgentId = '';
  _bundleImportRenderCatalogSelectors();
}

function onBundleCatalogAgentChange() {
  const agentSelect = document.getElementById('bundleCatalogAgent');
  _bundleImportState.selectedAgentId = String(agentSelect?.value || '');
  _bundleImportUpdateCatalogButtons();
}

// Show import bundle modal
function showImportBundleModal() {
  const overlay = document.getElementById('bundleImportOverlay') || document.getElementById('modalOverlay');
  const modal = document.getElementById('bundleImportModal') || document.getElementById('importBundleModal');
  if (!overlay || !modal) {
    addSystemBubble('Modal de importação não encontrado na página.');
    return;
  }
  _bundleImportState = {
    mode: 'catalog',
    bundlePayload: null,
    catalogLoaded: false,
    catalogLoading: false,
    catalogSource: '',
    groups: [],
    selectedGroupId: '',
    selectedAgentId: '',
  };
  _bundleImportResetUi();
  _bindBundleDropZone();
  bundleImportSetMode('catalog');
  overlay.classList.add('show');
  modal.classList.add('show');
}

// Close bundle import modal
function closeBundleImportModal() {
  const overlay = document.getElementById('bundleImportOverlay') || document.getElementById('modalOverlay');
  const modal = document.getElementById('bundleImportModal') || document.getElementById('importBundleModal');
  if (overlay) overlay.classList.remove('show');
  if (modal) modal.classList.remove('show');
}

// Handle bundle file drop/selection
function handleBundleFile(input) {
  const file = input?.files?.[0] || input?.target?.files?.[0] || null;
  _previewBundleFile(file);
}

// Preview bundle contents before import
function previewBundle(data) {
  _bundleImportPreviewFromPayload(data);
}

async function submitCatalogAgentImport() {
  const group = _bundleImportState.groups.find(g => g.id === _bundleImportState.selectedGroupId) || null;
  const agent = group?.agents?.find(a => a.id === _bundleImportState.selectedAgentId) || null;
  const btn = document.getElementById('bundleImportAgentFromCatalogBtn');
  if (!agent || !btn) return;

  btn.disabled = true;
  btn.innerHTML = '<span class="loading"></span> Importando...';
  try {
    const payload = await _bundleImportFetchPayloadFromAgent(agent);
    const created = await _bundleImportSend(payload);
    await loadAgents();
    if (created?.agent_id) selectAgent(created.agent_id);
    addSystemBubble(`Importação concluída: agente "${created.agent_name || agent.name}" criado.`);
    closeBundleImportModal();
  } catch (err) {
    addSystemBubble(`Falha ao importar agente: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-user-plus" style="margin-right:4px"></i> ' + (typeof window.t === 'function' ? window.t('ui.importAgent', 'Import Agent') : 'Import Agent');
    _bundleImportUpdateCatalogButtons();
  }
}

async function submitCatalogGroupImport() {
  const group = _bundleImportState.groups.find(g => g.id === _bundleImportState.selectedGroupId) || null;
  const btn = document.getElementById('bundleImportGroupFromCatalogBtn');
  if (!group || !btn) return;

  btn.disabled = true;
  btn.innerHTML = '<span class="loading"></span> Importando grupo...';
  let okCount = 0;
  let failCount = 0;
  const failures = [];
  let lastAgentId = '';
  try {
    for (const agent of (group.agents || [])) {
      try {
        const payload = await _bundleImportFetchPayloadFromAgent(agent);
        const created = await _bundleImportSend(payload);
        okCount += 1;
        if (created?.agent_id) lastAgentId = created.agent_id;
      } catch (err) {
        failCount += 1;
        failures.push(`${agent.name}: ${err.message}`);
      }
    }
    await loadAgents();
    if (lastAgentId) selectAgent(lastAgentId);
    if (failCount > 0) {
      addSystemBubble(`Grupo importado parcialmente (${okCount} ok, ${failCount} falhas).`);
      _bundleImportSetCatalogSummary(`Importação parcial do grupo ${group.label}: ${okCount} ok, ${failCount} falhas.`, 'error');
      console.warn('[bundle-import] group import failures', failures);
    } else {
      addSystemBubble(`Grupo "${group.label}" importado com sucesso (${okCount} agentes).`);
      closeBundleImportModal();
    }
  } catch (err) {
    addSystemBubble(`Falha ao importar grupo: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-layer-group" style="margin-right:4px"></i> ' + (typeof window.t === 'function' ? window.t('ui.importGroup', 'Import Group') : 'Import Group');
    _bundleImportUpdateCatalogButtons();
  }
}

// Submit bundle import from uploaded JSON
async function submitBundleImport() {
  const btn = document.getElementById('bundleImportBtn');
  const payload = _bundleImportState.bundlePayload;
  if (!payload || !btn) return;

  btn.innerHTML = '<span class="loading"></span> Importando...';
  btn.disabled = true;

  try {
    const created = await _bundleImportSend(payload);
    closeBundleImportModal();
    await loadAgents();
    if (created?.agent_id) selectAgent(created.agent_id);
    addSystemBubble(`Bundle importado com sucesso. Agente "${created.agent_name}" criado.`);
  } catch (e) {
    addSystemBubble(`Falha na importação do bundle: ${e.message}`);
  } finally {
    btn.innerHTML = '<i class="fas fa-download" style="margin-right:4px"></i> ' + (typeof window.t === 'function' ? window.t('ui.importAgent', 'Import Agent') : 'Import Agent');
    btn.disabled = false;
  }
}

// Show create agent modal
async function showCreateModal() {
  _editingAgentId = null;
  _modalAgentType = 'openclaude';
  if (window.Olivia_FUNCTIONS && typeof window.Olivia_FUNCTIONS.init === 'function') {
    try {
      await window.Olivia_FUNCTIONS.init();
    } catch (_e) {
      // Non-blocking: modal can still open without mapped registry context.
    }
  }
  _bindAgentModalBehaviors();
  document.getElementById('modalOverlay').classList.add('show');
  document.getElementById('createModal').classList.add('show');
  document.getElementById('modalTitle').textContent = (typeof window.t === 'function' ? window.t('ui.createAgent', 'Create New Agent') : 'Create New Agent');
  document.getElementById('modalSubmitBtn').innerHTML = '<i class="fas fa-plus" style="margin-right:4px"></i> ' + (typeof window.t === 'function' ? window.t('ui.createAgentBtn', 'Create Agent') : 'Create Agent');
  document.getElementById('modalAgentName').disabled = false;
  document.getElementById('modalAgentName').focus();
  document.getElementById('modalWorkspaceScope').value = _defaultWorkspaceScopeValue();
  document.getElementById('modalScopePermissions').value = 'read_write';
  document.getElementById('modalPathLayout').value = 'strict';
  document.getElementById('modalManagedRoot').value = 'workbench';
  document.getElementById('modalPreferredModel').value = 'deepseek-flash';
  document.getElementById('modalTemperature').value = '0.1';
  document.getElementById('modalUnrestrictedTools').checked = false;
  toggleModalUnrestrictedToolsDisplay();
  document.getElementById('modalSkillSelect').value = '';
  document.getElementById('modalSkillInput').value = '';
  await loadSharedScopes();
  _applyDefaultSharedScopesSelection();
  await loadExistingQdrantCollections();
  await loadSkillOptions();
  await loadMcpServerOptions();
  document.getElementById('modalCaseWorkspaceFolder').value = 'case_files';
  document.getElementById('modalCaseQdrantCollection').value = '';
  document.getElementById('modalCaseQdrantCollection').dataset.auto = '1';
  document.getElementById('modalCaseGraphEnabled').checked = false;
  document.getElementById('modalDescobertaWorkspaceFolder').value = 'discovery_files';
  document.getElementById('modalDescobertaQdrantCollection').value = '';
  document.getElementById('modalDescobertaQdrantCollection').dataset.auto = '1';
  document.getElementById('modalDescobertaGraphEnabled').checked = false;
  document.getElementById('modalQdrantDedicatedName').dataset.auto = '1';
  document.getElementById('modalNeo4jDedicatedName').dataset.auto = '1';
  _clearModalValidationHints();
  _toggleManagedRootVisibility();
  _syncSectionProfileDefaultsFromName(true);
  _syncModalPickersFromTextareas();
  refreshWorkspacePathPreview();
}

async function showEditModal(agentId) {
  _editingAgentId = agentId;
  _bindAgentModalBehaviors();
  document.getElementById('modalOverlay').classList.add('show');
  document.getElementById('createModal').classList.add('show');
  document.getElementById('modalTitle').textContent = (typeof window.t === 'function' ? window.t('ui.editAgent', 'Edit Agent') : 'Edit Agent');
  document.getElementById('modalSubmitBtn').innerHTML = '<i class="fas fa-floppy-disk" style="margin-right:4px"></i> ' + (typeof window.t === 'function' ? window.t('ui.saveChanges', 'Save Changes') : 'Save Changes');
  document.getElementById('modalAgentName').disabled = true;

  await loadSharedScopes();
  await loadExistingQdrantCollections();
  await loadSkillOptions();

  try {
    const res = await fetch(`${API_BASE}/api/agents/${agentId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const a = await res.json();
    const cfg = a.config || {};
    const configuredMcpServers = _normalizeMcpServerNames(cfg.mcp_servers);
    _modalAgentType = _normalizedAgentType(a.agent_type);

    await loadMcpServerOptions(configuredMcpServers.length ? configuredMcpServers : null);

    document.getElementById('modalAgentName').value = a.name || '';
    document.getElementById('modalAgentDesc').value = a.description || '';
    const gEl = document.getElementById('modalAgentGroup');
    if (gEl) gEl.value = (a.config && (a.config.group || a.config.group_name)) || '';
    document.getElementById('modalSystemPrompt').value = a.system_prompt || '';

    const scopeSelect = document.getElementById('modalWorkspaceScope');
    const savedScope = cfg.workspace_scope || _defaultWorkspaceScopeValue();
    const scopeExists = Array.from(scopeSelect.options).some(opt => opt.value === savedScope);
    scopeSelect.value = scopeExists ? savedScope : _defaultWorkspaceScopeValue();
    toggleCustomScopeFolders();
    document.getElementById('modalScopeFolders').value = Array.isArray(cfg.scope_folders) ? cfg.scope_folders.join('\n') : '';
    document.getElementById('modalOutputFolder').value = cfg.output_folder || '';
    const permissionSelect = document.getElementById('modalScopePermissions');
    const savedPermission = cfg.scope_permissions || 'read_write';
    const permissionExists = Array.from(permissionSelect.options).some(opt => opt.value === savedPermission);
    permissionSelect.value = permissionExists ? savedPermission : 'read_write';
    document.getElementById('modalPathLayout').value = _normalizedPathLayout(cfg.path_layout || 'strict');
    document.getElementById('modalManagedRoot').value = cfg.managed_root || 'workbench';
    _toggleManagedRootVisibility();

    const qc = a.qdrant_collection || '';
    if (qc) {
      document.getElementById('modalQdrantExisting').checked = true;
      toggleQdrantOptions();
      document.getElementById('modalQdrantExistingCollection').value = qc;
      if (document.getElementById('modalQdrantExistingCollection').value !== qc) {
        document.getElementById('modalQdrantDedicated').checked = true;
        toggleQdrantOptions();
        document.getElementById('modalQdrantDedicatedName').value = qc;
      }
    } else {
      document.getElementById('modalQdrantShared').checked = true;
      toggleQdrantOptions();
    }

    if (a.neo4j_database) {
      document.getElementById('modalNeo4jDedicated').checked = true;
      toggleNeo4jOptions();
      document.getElementById('modalNeo4jDedicatedName').value = a.neo4j_database;
    } else {
      document.getElementById('modalNeo4jShared').checked = true;
      toggleNeo4jOptions();
    }

    const scopes = new Set((a.shared_scopes || []).map(String));
    document.querySelectorAll('.modal-scope').forEach(cb => {
      cb.checked = scopes.has(cb.value);
    });
    if (!scopes.size) {
      _applyDefaultSharedScopesSelection();
    }

    document.getElementById('modalCustomSharedPaths').value = Array.isArray(cfg.custom_shared_paths) ? cfg.custom_shared_paths.join('\n') : '';
    document.getElementById('modalSkills').value = Array.isArray(cfg.skills) ? cfg.skills.join('\n') : '';
    document.getElementById('modalQdrantCollections').value = Array.isArray(cfg.qdrant_collections) ? cfg.qdrant_collections.join('\n') : '';
    const sectionProfiles = (cfg.section_profiles && typeof cfg.section_profiles === 'object') ? cfg.section_profiles : {};
    const caseProfile = (sectionProfiles.case && typeof sectionProfiles.case === 'object') ? sectionProfiles.case : {};
    const descobertaProfile = (sectionProfiles.descoberta && typeof sectionProfiles.descoberta === 'object') ? sectionProfiles.descoberta : {};
    document.getElementById('modalCaseWorkspaceFolder').value = caseProfile.workspace_folder || 'case_files';
    document.getElementById('modalCaseQdrantCollection').value = caseProfile.qdrant_collection || '';
    document.getElementById('modalCaseQdrantCollection').dataset.auto = caseProfile.qdrant_collection ? '0' : '1';
    document.getElementById('modalCaseGraphEnabled').checked = !!caseProfile.graph_enabled;
    document.getElementById('modalDescobertaWorkspaceFolder').value = descobertaProfile.workspace_folder || 'discovery_files';
    document.getElementById('modalDescobertaQdrantCollection').value = descobertaProfile.qdrant_collection || '';
    document.getElementById('modalDescobertaQdrantCollection').dataset.auto = descobertaProfile.qdrant_collection ? '0' : '1';
    document.getElementById('modalDescobertaGraphEnabled').checked = !!descobertaProfile.graph_enabled;
    document.getElementById('modalPreferredModel').value = (cfg.model === 'deepseek-flash' ? 'deepseek-flash' : 'deepseek-flash');
    document.getElementById('modalTemperature').value = (cfg.temperature === 0 || cfg.temperature) ? String(cfg.temperature) : '';
    document.getElementById('modalUnrestrictedTools').checked = !!cfg.unrestricted_tools;
    toggleModalUnrestrictedToolsDisplay();
    // Set _pendingToolPermissions so _restorePendingToolPermissions (called inside
    // _renderMcpServerOptions → loadMcpServerOptions above) can apply them inline.
    // If loadMcpServerOptions already ran, call _restorePendingToolPermissions directly.
    if (Array.isArray(cfg.permitted_tools)) {
      _pendingToolPermissions = cfg.permitted_tools;
      _restorePendingToolPermissions();
    }
    document.getElementById('modalNeo4jGraphData').value = cfg.neo4j_graph_data || '';
    document.getElementById('modalSkillSelect').value = '';
    document.getElementById('modalSkillInput').value = '';
    document.getElementById('modalQdrantDedicatedName').dataset.auto = '0';
    document.getElementById('modalNeo4jDedicatedName').dataset.auto = '0';
    _clearModalValidationHints();
    _syncSectionProfileDefaultsFromName(false);
    _syncModalPickersFromTextareas();
    refreshWorkspacePathPreview();
  } catch (e) {
    addSystemBubble(`Falha ao carregar agente para edição: ${e.message}`);
    closeModal();
  }
}

// Close modal (used for both create and bundle import)
function _rmShow(id) { var e = document.getElementById(id); if (e) e.classList.remove('show'); }
function closeModal() {
  _workspacePreviewRequestSeq += 1;
  if (_workspacePreviewDebounceTimer) {
    clearTimeout(_workspacePreviewDebounceTimer);
    _workspacePreviewDebounceTimer = null;
  }
  _rmShow('modalOverlay');
  _rmShow('createModal');
  _rmShow('bundleImportOverlay');
  _rmShow('bundleImportModal');
  _rmShow('importBundleModal');

  // Reset basic fields
  document.getElementById('modalAgentName').value = '';
  document.getElementById('modalAgentDesc').value = '';
  document.getElementById('modalSystemPrompt').value = '';
  document.getElementById('modalImportStatus').textContent = '';
  document.getElementById('sharedScopesGrid').innerHTML = '';
  document.getElementById('modalMcpServersGrid').innerHTML = '<div style="text-align:center;padding:8px;color:var(--gray);font-size:11px"><div class="loading"></div> Carregando...</div>';
  document.getElementById('modalTitle').textContent = (typeof window.t === 'function' ? window.t('ui.createAgent', 'Create New Agent') : 'Create New Agent');
  document.getElementById('modalSubmitBtn').innerHTML = '<i class="fas fa-plus" style="margin-right:4px"></i> ' + (typeof window.t === 'function' ? window.t('ui.createAgentBtn', 'Create Agent') : 'Create Agent');
  document.getElementById('modalAgentName').disabled = false;
  _editingAgentId = null;
  _modalAgentType = 'openclaude';

  // Reset scope fields
  document.getElementById('modalWorkspaceScope').value = _defaultWorkspaceScopeValue();
  document.getElementById('customScopeFoldersDiv').style.display = 'none';
  document.getElementById('modalScopeFolders').value = '';
  document.getElementById('modalOutputFolder').value = '';
  document.getElementById('modalScopePermissions').value = 'read_write';
  document.getElementById('modalPathLayout').value = 'strict';
  document.getElementById('modalManagedRoot').value = 'workbench';
  _toggleManagedRootVisibility();
  const resolvedPathEl = document.getElementById('modalResolvedWorkspacePath');
  const resolvedAbsEl = document.getElementById('modalResolvedWorkspaceAbs');
  const resolvedPolicyEl = document.getElementById('modalResolvedPolicyRoot');
  if (resolvedPathEl) resolvedPathEl.textContent = 'calculando...';
  if (resolvedAbsEl) resolvedAbsEl.textContent = '-';
  if (resolvedPolicyEl) resolvedPolicyEl.textContent = '-';
  _clearModalValidationHints();

  // Reset Qdrant fields
  document.getElementById('modalQdrantShared').checked = true;
  document.getElementById('qdrantExistingDiv').style.display = 'none';
  document.getElementById('qdrantDedicatedDiv').style.display = 'none';
  document.getElementById('modalQdrantDedicatedName').value = '';
  document.getElementById('modalQdrantDedicatedName').dataset.auto = '1';

  // Reset Neo4j fields
  document.getElementById('modalNeo4jShared').checked = true;
  document.getElementById('neo4jDedicatedDiv').style.display = 'none';
  document.getElementById('modalNeo4jDedicatedName').value = '';
  document.getElementById('modalNeo4jDedicatedName').dataset.auto = '1';

  // Reset memory fields
  document.getElementById('modalCustomSharedPaths').value = '';
  document.getElementById('modalSkills').value = '';
  document.getElementById('modalQdrantCollections').value = '';
  document.getElementById('modalPreferredModel').value = 'deepseek-flash';
  document.getElementById('modalTemperature').value = '';
  document.getElementById('modalUnrestrictedTools').checked = false;
  toggleModalUnrestrictedToolsDisplay();
  document.getElementById('modalNeo4jGraphData').value = '';
  document.getElementById('modalCaseWorkspaceFolder').value = 'case_files';
  document.getElementById('modalCaseQdrantCollection').value = '';
  document.getElementById('modalCaseQdrantCollection').dataset.auto = '1';
  document.getElementById('modalCaseGraphEnabled').checked = false;
  document.getElementById('modalDescobertaWorkspaceFolder').value = 'discovery_files';
  document.getElementById('modalDescobertaQdrantCollection').value = '';
  document.getElementById('modalDescobertaQdrantCollection').dataset.auto = '1';
  document.getElementById('modalDescobertaGraphEnabled').checked = false;
  document.getElementById('modalSkillInput').value = '';
  document.getElementById('modalSkillSelect').value = '';
  document.getElementById('modalQdrantCollectionInput').value = '';
  _selectedModalSkills = [];
  _selectedModalQdrantCollections = [];
  _availableMcpServers = [];
  _ecosystemMcpInfo = {};
  _syncSectionProfileDefaultsFromName(true);
  _syncSkillsTextareaAndChips();
  _syncQdrantCollectionsTextareaAndChips();
}

// Toggle custom scope folders visibility
function toggleCustomScopeFolders() {
  const scope = document.getElementById('modalWorkspaceScope').value;
  document.getElementById('customScopeFoldersDiv').style.display = scope === 'custom' ? 'block' : 'none';
  refreshWorkspacePathPreview();
}

// Toggle Qdrant options visibility
function toggleQdrantOptions() {
  const mode = document.querySelector('input[name="modalQdrantMode"]:checked').value;
  document.getElementById('qdrantExistingDiv').style.display = mode === 'existing' ? 'block' : 'none';
  document.getElementById('qdrantDedicatedDiv').style.display = mode === 'dedicated' ? 'block' : 'none';
}

// Toggle Neo4j options visibility
function toggleNeo4jOptions() {
  const mode = document.querySelector('input[name="modalNeo4jMode"]:checked').value;
  document.getElementById('neo4jDedicatedDiv').style.display = mode === 'dedicated' ? 'block' : 'none';
}

// Load existing Qdrant collections for dropdown
async function loadExistingQdrantCollections() {
  const select = document.getElementById('modalQdrantExistingCollection');
  const datalist = document.getElementById('modalQdrantCollectionOptions');
  if (!select) return;

  try {
    const res = await fetch(`${API_BASE}/api/memory/collections`);
    const data = await res.json();
    const collections = Array.isArray(data) ? data : (data.collections || []);
    if (!collections.length) {
      select.innerHTML = '<option value="">Nenhuma coleção encontrada</option>';
      if (datalist) datalist.innerHTML = '';
      return;
    }
    select.innerHTML = collections.map(c => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)} (${c.points_count || 0} pontos)</option>`).join('');
    if (datalist) {
      datalist.innerHTML = collections
        .map(c => String(c.name || '').trim())
        .filter(Boolean)
        .sort()
        .map(v => `<option value="${escapeHtml(v)}"></option>`)
        .join('');
    }
  } catch (e) {
    select.innerHTML = '<option value="">Erro ao carregar coleções</option>';
    if (datalist) datalist.innerHTML = '';
  }
}

// Select memory files from tree (placeholder)
function selectMemoryFilesFromTree() {
  addSystemBubble('Funcionalidade em desenvolvimento: seleção visual de arquivos do workspace.');
}

// Select memory files from shared (placeholder)
function selectMemoryFilesFromShared() {
  addSystemBubble('Funcionalidade em desenvolvimento: seleção visual de arquivos _shared.');
}

function _buildMappedFunctionsContextBrief() {
  const regApi = (typeof window !== 'undefined' && window.Olivia_FUNCTIONS)
    ? window.Olivia_FUNCTIONS
    : null;
  const baseLines = [
    '## Olivia API Mapping Context',
    '- Fonte principal: agents/functions/agent_functions',
    '- Sempre priorize funções do catálogo mapeado antes de propor chamadas novas.',
    '- Use matchEndpoint/search/loadFunction para casar intenção com função existente.'
  ];

  if (!regApi || !regApi.loaded || !regApi.registry) {
    return baseLines.join('\n');
  }

  const registry = regApi.registry || {};
  const total = Object.keys(registry.functions || {}).length;
  const ready = typeof regApi.getReadyFunctions === 'function' ? regApi.getReadyFunctions().length : 0;
  const categories = typeof regApi.getAllCategories === 'function' ? regApi.getAllCategories().slice(0, 8) : [];
  const capabilities = typeof regApi.getAllCapabilities === 'function' ? regApi.getAllCapabilities().slice(0, 10) : [];
  const source = (registry.sourceMeta && registry.sourceMeta.source) ? registry.sourceMeta.source : 'catalog';

  return [
    '## Olivia API Mapping Context',
    '- Fonte principal: agents/functions/agent_functions',
    '- Origem ativa carregada: ' + source,
    '- Funções mapeadas: ' + total + ' (agent-ready: ' + ready + ')',
    '- Categorias (amostra): ' + (categories.length ? categories.join(', ') : 'n/d'),
    '- Capacidades (amostra): ' + (capabilities.length ? capabilities.join(', ') : 'n/d'),
    '- Sempre priorize funções do catálogo mapeado antes de propor chamadas novas.',
    '- Use matchEndpoint/search/loadFunction para casar intenção com função existente.'
  ].join('\n');
}

function _composeAgentSystemPrompt(basePrompt) {
  const raw = String(basePrompt || '').trim();
  const mappingContext = _buildMappedFunctionsContextBrief();
  if (!mappingContext) return raw || null;
  if (raw && raw.indexOf('## Olivia API Mapping Context') >= 0) return raw;
  if (!raw) return mappingContext;
  return raw + '\n\n' + mappingContext;
}

function prepareAgentFormAssistantPrompt() {
  const name = (document.getElementById('modalAgentName')?.value || '').trim() || '(sem nome)';
  const desc = (document.getElementById('modalAgentDesc')?.value || '').trim() || '(sem descrição)';
  const model = (document.getElementById('modalPreferredModel')?.value || 'deepseek-flash').trim();
  const unrestrictedTools = !!document.getElementById('modalUnrestrictedTools')?.checked;
  const workspaceScope = (document.getElementById('modalWorkspaceScope')?.value || 'workspace').trim();
  const sharedScopes = Array.from(document.querySelectorAll('.modal-scope:checked')).map(cb => cb.value);
  const skills = _parseTextareaLines('modalSkills');
  const mcpServers = _selectedMcpServerNamesFromModal();
  const mappingContext = _buildMappedFunctionsContextBrief();

  const prompt = [
    'Me ajude a finalizar a configuração deste novo agente OpenCloud.',
    `Nome: ${name}`,
    `Descrição: ${desc}`,
    `Modelo preferido: ${model}`,
    `Ferramentas irrestritas: ${unrestrictedTools ? 'habilitado' : 'desabilitado'}`,
    `Escopo do workspace: ${workspaceScope}`,
    `Shared scopes atuais: ${sharedScopes.join(', ') || '(nenhum)'}`,
    `Skills atuais: ${skills.join(', ') || '(nenhuma)'}`,
    `MCP servers selecionados: ${mcpServers.join(', ') || '(todos disponíveis)'}`,
    'Contexto de funções mapeadas disponível para este agente:',
    mappingContext,
    'Sugira melhorias para: skills, coleções Qdrant (geral/case/discovery), escopo e prompt do sistema.',
    'Responda em formato objetivo para eu copiar no formulário.'
  ].join('\n');

  const chatInput = document.getElementById('chatInput');
  if (chatInput) {
    chatInput.value = prompt;
    if (typeof autoGrow === 'function') autoGrow(chatInput);
    chatInput.focus();
  }
  addSystemBubble('Prompt de ajuda preparado no chat. Você pode ajustar e enviar para a OliviaLegal.');
}

// ── AI Agent Builder ──────────────────────────────────────────────
function openAgentAIBuilderModal() {
  const overlay = document.getElementById('agentAIBuilderOverlay');
  const modal = document.getElementById('agentAIBuilderModal');
  if (!overlay || !modal) return;

  // Reset state
  const descInput = document.getElementById('agentAIBuilderDesc');
  if (descInput) descInput.value = '';
  const statusDiv = document.getElementById('agentAIBuilderStatus');
  if (statusDiv) statusDiv.style.display = 'none';
  const errorDiv = document.getElementById('agentAIBuilderError');
  if (errorDiv) errorDiv.style.display = 'none';
  const errorMsg = document.getElementById('agentAIBuilderErrorMsg');
  if (errorMsg) errorMsg.textContent = '';

  overlay.classList.add('show');
  modal.classList.add('show');
  if (descInput) descInput.focus();
}

function closeAgentAIBuilderModal() {
  const overlay = document.getElementById('agentAIBuilderOverlay');
  const modal = document.getElementById('agentAIBuilderModal');
  if (overlay) overlay.classList.remove('show');
  if (modal) modal.classList.remove('show');
}

async function generateAgentWithAI() {
  const descInput = document.getElementById('agentAIBuilderDesc');
  const desc = (descInput?.value || '').trim();
  if (!desc) {
    addSystemBubble('Por favor, descreva o agente que você deseja criar.');
    return;
  }

  const statusDiv = document.getElementById('agentAIBuilderStatus');
  const errorDiv = document.getElementById('agentAIBuilderError');
  const errorMsg = document.getElementById('agentAIBuilderErrorMsg');
  const generateBtn = document.getElementById('agentAIBuilderGenerateBtn');

  if (statusDiv) statusDiv.style.display = 'flex';
  if (errorDiv) errorDiv.style.display = 'none';
  if (generateBtn) generateBtn.disabled = true;

  try {
    const response = await fetch(`${API_BASE}/api/agents/generate-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: desc })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(data.error);
    }

    // Populate the create agent form with AI-generated values
    _populateAgentFormFromAI(data);

    // Close the AI builder modal
    closeAgentAIBuilderModal();

    addSystemBubble('Configuração do agente gerada com IA e preenchida no formulário. Revise os campos e clique em "Create Agent".');
  } catch (err) {
    console.error('[AgentAIBuilder] Error:', err);
    if (errorMsg) errorMsg.textContent = err.message || 'Erro ao gerar configuração do agente';
    if (errorDiv) errorDiv.style.display = 'block';
  } finally {
    if (statusDiv) statusDiv.style.display = 'none';
    if (generateBtn) generateBtn.disabled = false;
  }
}

function _populateAgentFormFromAI(config) {
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val || '';
  };

  const setChecked = (id, checked) => {
    const el = document.getElementById(id);
    if (el) el.checked = !!checked;
  };

  const setSelect = (id, val) => {
    const el = document.getElementById(id);
    if (el && val) {
      const optionToSelect = Array.from(el.options).find(o => o.value === val);
      if (optionToSelect) el.value = val;
    }
  };

  // Basic fields
  setVal('modalAgentName', config.name || '');
  setVal('modalAgentDesc', config.description || '');
  setVal('modalAgentGroup', config.group || '');
  setSelect('modalPreferredModel', config.preferred_model || 'deepseek-flash');
  setChecked('modalUnrestrictedTools', config.unrestricted_tools);

  // Workspace scope
  setSelect('modalWorkspaceScope', config.workspace_scope || 'workspace');

  // System prompt
  setVal('modalSystemPrompt', config.system_prompt || '');

  // Skills
  if (config.skills && Array.isArray(config.skills)) {
    setVal('modalSkills', config.skills.join('\n'));
    // Trigger any skill rendering if needed
    if (typeof renderModalSkills === 'function') renderModalSkills();
  }

  // Qdrant collections
  if (config.qdrant_collections && Array.isArray(config.qdrant_collections)) {
    setVal('modalQdrantCollections', config.qdrant_collections.join('\n'));
    if (typeof renderModalQdrantCollections === 'function') renderModalQdrantCollections();
  }

  // MCP servers
  if (config.mcp_servers && Array.isArray(config.mcp_servers)) {
    config.mcp_servers.forEach(serverName => {
      const checkbox = document.querySelector(`#modalMcpServers input[value="${serverName}"]`);
      if (checkbox) checkbox.checked = true;
    });
  }

  // Shared scopes
  if (config.shared_scopes && Array.isArray(config.shared_scopes)) {
    config.shared_scopes.forEach(scope => {
      const checkbox = document.querySelector(`.modal-scope[value="${scope}"]`);
      if (checkbox) checkbox.checked = true;
    });
  }
}

// Load shared scopes for checkbox grid
async function loadSharedScopes() {
  const grid = document.getElementById('sharedScopesGrid');
  if (!grid) return;

  try {
    const res = await fetch(`${API_BASE}/api/shared/scopes`);
    const data = await res.json();
    const scopes = Array.isArray(data) ? data : (data.scopes || []);
    // Fallback: use hardcoded common _shared categories if API returns empty
    const fallbackScopes = [
      { name: 'docs', file_count: '?' },
      { name: 'ontology', file_count: '?' },
      { name: 'corpus', file_count: '?' },
      { name: 'law', file_count: '?' },
      { name: 'contracts', file_count: '?' },
      { name: 'cases', file_count: '?' },
      { name: 'cases/juris-search', file_count: '?' },
      { name: 'cases/la8159/01-violations', file_count: '?' },
      { name: 'cases/agents', file_count: '?' }
    ];
    const displayScopes = scopes.length ? scopes : fallbackScopes;
    grid.innerHTML = displayScopes.map(s => {
      const id = `modal_scope_${s.name}`;
      const count = s.file_count !== '?' ? s.file_count : '—';
      return `<div class="tool-check"><input type="checkbox" class="modal-scope" id="${id}" value="${escapeHtml(s.name)}" name="${id}"><label for="${id}">${escapeHtml(s.name)} <span style="color:var(--gray);font-size:10px">(${count})</span></label></div>`;
    }).join('');
  } catch (e) {
    // Show fallback on error
    const fallbackScopes = [
      'docs',
      'ontology',
      'corpus',
      'law',
      'contracts',
      'cases',
      'cases/juris-search',
      'cases/la8159/01-violations',
      'cases/agents'
    ];
    grid.innerHTML = fallbackScopes.map(name => {
      const id = `modal_scope_${name}`;
      return `<div class="tool-check"><input type="checkbox" class="modal-scope" id="${id}" value="${escapeHtml(name)}" name="${id}"><label for="${id}">${escapeHtml(name)}</label></div>`;
    }).join('');
  }
}

// Submit create agent form
async function submitCreateAgent() {
  if (window.Olivia_FUNCTIONS && typeof window.Olivia_FUNCTIONS.init === 'function') {
    try {
      await window.Olivia_FUNCTIONS.init();
    } catch (_e) {
      // Keep agent creation functional even if mapping context fails to load.
    }
  }

  _syncSkillsTextareaAndChips();
  _syncQdrantCollectionsTextareaAndChips();

  const isEdit = !!_editingAgentId;
  if (!_validateAgentModalBeforeSubmit(isEdit)) return;
  const editId = _editingAgentId;
  const nameInput = document.getElementById('modalAgentName');
  const name = nameInput.value.trim();
  if (!name && !isEdit) { nameInput.focus(); return; }
  const effectiveName = name || nameInput.value.trim() || 'agent';

  // OpenCloud flow: all tools available by default
  const tools = ['*'];

  // Workspace scope
  const workspaceScope = _normalizedWorkspaceScope(document.getElementById('modalWorkspaceScope').value);
  const scopeFoldersRaw = document.getElementById('modalScopeFolders').value;
  let scopeFolders = workspaceScope === 'custom' ? _scopeFoldersFromRaw(scopeFoldersRaw) : [];
  if (workspaceScope === 'uploads_projects' && !scopeFolders.length) {
    scopeFolders = ['uploads/projects'];
  }
  const outputFolder = document.getElementById('modalOutputFolder').value.trim() || 'outputs/';
  const scopePermissions = document.getElementById('modalScopePermissions').value;
  const pathLayout = _normalizedPathLayout(document.getElementById('modalPathLayout')?.value || 'strict');
  const managedRoot = pathLayout === 'agent_managed'
    ? _normalizedManagedRoot(document.getElementById('modalManagedRoot')?.value || '', 'workbench')
    : '';
  const projectId = _currentProjectIdForWorkspace();
  const resolvedWorkspace = await _resolveWorkspacePreview();
  const workspacePath = (resolvedWorkspace && resolvedWorkspace.workspace_path)
    ? resolvedWorkspace.workspace_path
    : _computeWorkspacePath(workspaceScope, effectiveName, scopeFolders);

  // Qdrant memory config
  const qdrantMode = document.querySelector('input[name="modalQdrantMode"]:checked').value;
  let qdrantCollection = null;
  let createQdrantCollection = false;
  if (qdrantMode === 'dedicated') {
    createQdrantCollection = true;
    qdrantCollection = document.getElementById('modalQdrantDedicatedName').value.trim() || `agent_${_toSafeSlug(effectiveName, '_')}`;
  } else if (qdrantMode === 'existing') {
    qdrantCollection = document.getElementById('modalQdrantExistingCollection').value;
  }

  // Neo4j memory config
  const neo4jMode = document.querySelector('input[name="modalNeo4jMode"]:checked').value;
  let neo4jDatabase = null;
  let createNeo4jDb = false;
  if (neo4jMode === 'dedicated') {
    createNeo4jDb = true;
    const neoInput = document.getElementById('modalNeo4jDedicatedName');
    neo4jDatabase = _normalizeNeo4jDatabaseName(neoInput.value.trim(), effectiveName);
    neoInput.value = neo4jDatabase;
  }

  const baseCollectionSlug = _toSafeSlug(effectiveName, '_');

  // Shared scopes (checkboxes + custom paths)
  const sharedScopesRaw = Array.from(document.querySelectorAll('.modal-scope:checked')).map(cb => cb.value);
  const sharedScopes = sharedScopesRaw.length ? sharedScopesRaw : _defaultAgentSharedScopes.slice();
  const customSharedRaw = document.getElementById('modalCustomSharedPaths').value.trim();
  const customSharedPaths = customSharedRaw ? customSharedRaw.split('\n').map(l => l.trim()).filter(Boolean) : [];
  const skillsRaw = document.getElementById('modalSkills').value.trim();
  const skills = skillsRaw ? skillsRaw.split('\n').map(l => l.trim()).filter(Boolean) : [];
  const qdrantCollectionsRaw = document.getElementById('modalQdrantCollections').value.trim();
  const qdrantCollections = qdrantCollectionsRaw ? qdrantCollectionsRaw.split('\n').map(l => l.trim()).filter(Boolean) : [];
  const mcpServers = _selectedMcpServerNamesFromModal();
  const unrestrictedTools = !!document.getElementById('modalUnrestrictedTools')?.checked;
  const model = document.getElementById('modalPreferredModel').value.trim() || null;
  const tempRaw = document.getElementById('modalTemperature').value.trim();
  const temperature = tempRaw === '' ? null : Number(tempRaw);
  const neo4jGraphData = document.getElementById('modalNeo4jGraphData').value.trim() || null;
  const sectionProfiles = {
    case: {
      workspace_folder: document.getElementById('modalCaseWorkspaceFolder').value.trim() || 'case_files',
      qdrant_collection: document.getElementById('modalCaseQdrantCollection').value.trim() || `${baseCollectionSlug}_case`,
      graph_enabled: !!document.getElementById('modalCaseGraphEnabled').checked
    },
    descoberta: {
      workspace_folder: document.getElementById('modalDescobertaWorkspaceFolder').value.trim() || 'discovery_files',
      qdrant_collection: document.getElementById('modalDescobertaQdrantCollection').value.trim() || `${baseCollectionSlug}_discovery`,
      graph_enabled: !!document.getElementById('modalDescobertaGraphEnabled').checked
    }
  };

  const body = {
    agent_type: _modalAgentType,
    description: document.getElementById('modalAgentDesc').value.trim() || null,
    group: (document.getElementById('modalAgentGroup')?.value || '').trim() || null,
    tools,
    system_prompt: _composeAgentSystemPrompt(document.getElementById('modalSystemPrompt').value),
    // Scope config
    workspace_scope: workspaceScope,
    scope_folders: scopeFolders,
    workspace_path: workspacePath,
    output_folder: outputFolder,
    path_layout: pathLayout,
    managed_root: managedRoot,
    scope_permissions: scopePermissions,
    unrestricted_tools: unrestrictedTools,
    // Memory config
    qdrant_collection: qdrantCollection,
    create_qdrant_collection: createQdrantCollection,
    qdrant_collections: qdrantCollections,
    neo4j_database: neo4jDatabase,
    create_neo4j_db: createNeo4jDb,
    neo4j_graph_data: neo4jGraphData,
    // Shared data
    shared_scopes: sharedScopes,
    custom_shared_paths: customSharedPaths,
    skills,
    mcp_servers: mcpServers,
    permitted_tools: _selectedMcpToolNames(),
    model,
    temperature,
    section_profiles: sectionProfiles
  };

  if (projectId) {
    body.project_id = projectId;
  }

  if (!isEdit) {
    body.name = name;
  }

  const btn = document.getElementById('modalSubmitBtn');
  btn.innerHTML = isEdit ? '<span class="loading"></span> Salvando...' : '<span class="loading"></span> Criando...';
  btn.disabled = true;
  try {
    const url = isEdit ? `${API_BASE}/api/agents/${editId}` : `${API_BASE}/api/agents/create`;
    const method = isEdit ? 'PATCH' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (data.agent_id) {
      closeModal();
      await loadAgents();
      selectAgent(data.agent_id);
      if (isEdit) {
        addSystemBubble(`Agente "${data.name || name}" atualizado com sucesso.`);
      } else {
        addSystemBubble(`Agente "${name}" criado com sucesso.`);
      }
    } else {
      addSystemBubble(`Falha na criação: ${data.detail || JSON.stringify(data)}`);
    }
  } catch (e) { addSystemBubble(`Erro: ${e.message}`); }
  finally {
    btn.innerHTML = isEdit
      ? '<i class="fas fa-floppy-disk" style="margin-right:4px"></i> ' + (typeof window.t === 'function' ? window.t('ui.saveChanges', 'Save Changes') : 'Save Changes')
      : '<i class="fas fa-plus" style="margin-right:4px"></i> ' + (typeof window.t === 'function' ? window.t('ui.createAgentBtn', 'Create Agent') : 'Create Agent');
    btn.disabled = false;
  }
}

// Expose functions to window scope
window.loadAgents = loadAgents;
window.renderAgentList = renderAgentList;
window.selectAgent = selectAgent;
window.toggleAgentStatus = toggleAgentStatus;
window.deleteAgent = deleteAgent;
window.importAgentMd = importAgentMd;
window.exportAgentMd = exportAgentMd;
window.exportAgentBundle = exportAgentBundle;
window.startAgentBackground = startAgentBackground;
window.pauseAgentBackground = pauseAgentBackground;
window.resumeAgentBackground = resumeAgentBackground;
window.refreshInvestigationBoard = refreshInvestigationBoard;
window.toggleInvestigationOpsPanelCollapsed = toggleInvestigationOpsPanelCollapsed;
window.toggleInvestigationOpsGroup = toggleInvestigationOpsGroup;
window.toggleAgentListGroup = toggleAgentListGroup;
window.openSharedReferenceLinks = openSharedReferenceLinks;
window.closeSharedReferenceModal = closeSharedReferenceModal;
window.refreshSharedReferenceLinks = refreshSharedReferenceLinks;
window.renderSharedReferenceTable = renderSharedReferenceTable;
window.exportSharedReferenceJson = exportSharedReferenceJson;
window.exportSharedReferenceCsv = exportSharedReferenceCsv;
window.showImportBundleModal = showImportBundleModal;
window.closeBundleImportModal = closeBundleImportModal;
window.handleBundleFile = handleBundleFile;
window.previewBundle = previewBundle;
window.submitBundleImport = submitBundleImport;
window.showCreateModal = showCreateModal;
window.showEditModal = showEditModal;
window.closeModal = closeModal;
window.toggleCustomScopeFolders = toggleCustomScopeFolders;
window.toggleQdrantOptions = toggleQdrantOptions;
window.toggleNeo4jOptions = toggleNeo4jOptions;
window.loadExistingQdrantCollections = loadExistingQdrantCollections;
window.loadSkillOptions = loadSkillOptions;
window.addModalSkill = addModalSkill;
window.addModalSkillFromSelect = addModalSkillFromSelect;
window.removeModalSkill = removeModalSkill;
window.addModalQdrantCollection = addModalQdrantCollection;
window.removeModalQdrantCollection = removeModalQdrantCollection;
window.selectMemoryFilesFromTree = selectMemoryFilesFromTree;
window.selectMemoryFilesFromShared = selectMemoryFilesFromShared;
window.prepareAgentFormAssistantPrompt = prepareAgentFormAssistantPrompt;
window.loadSharedScopes = loadSharedScopes;
async function _bundleImportLoadPlugins() {
  if (_bundleImportState.pluginsLoading) return;
  _bundleImportState.pluginsLoading = true;
  const list = document.getElementById('bundleImportPluginsList');
  if (list) list.innerHTML = '<div class="plugin-list-loading"><i class="fas fa-spinner fa-spin"></i> Descobrindo plugins...</div>';

  const knownPaths = [
    'pluggins/craudio',
    'pluggins/olisidian',
  ];

  const plugins = [];
  for (const path of knownPaths) {
    try {
      const r = await fetch(`${API_BASE}/api/plugins/discover?path=${encodeURIComponent(path)}`);
      if (r.ok) {
        const info = await r.json();
        if (!info.error) plugins.push(info);
      }
    } catch (e) {
      // plugin path unreachable — skip
    }
  }
  _bundleImportState.plugins = plugins;
  _bundleImportState.pluginsLoaded = true;
  _bundleImportState.pluginsLoading = false;
  _bundleImportRenderPlugins();
}

function _bundleImportRenderPlugins() {
  const list = document.getElementById('bundleImportPluginsList');
  if (!list) return;
  const plugins = _bundleImportState.plugins;
  if (!plugins.length) {
    list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--gray)">Nenhum plugin encontrado nos caminhos conhecidos.</div>';
    return;
  }
  let html = '';
  for (const p of plugins) {
    const stats = [];
    if (p.skill_count) stats.push(`<span><i class="fas fa-puzzle-piece"></i> ${p.skill_count} skills</span>`);
    if (p.agent_count) stats.push(`<span><i class="fas fa-robot"></i> ${p.agent_count} agentes</span>`);
    if (p.has_openclaude_settings) stats.push(`<span><i class="fas fa-cog"></i> settings</span>`);
    html += `<div class="plugin-list-item">
      <div class="plugin-list-meta">
        <div class="plugin-list-name">${escapeHtml(p.name)}${p.version ? ` <small style="color:var(--gray)">v${escapeHtml(p.version)}</small>` : ''}</div>
        <div class="plugin-list-desc">${escapeHtml(p.description || '')}</div>
        <div class="plugin-list-stats">${stats.join('') || '<span style="color:var(--gray)">plugin de infraestrutura</span>'}</div>
        <div style="font-size:10px;color:var(--gray);margin-top:2px">${escapeHtml(p.path)}</div>
      </div>
      <div class="plugin-list-actions">
        <button class="btn btn-xs" style="border-color:var(--amber);color:var(--amber)" onclick="submitPluginImport('${escapeHtml(p.path)}')"><i class="fas fa-download"></i> ${(typeof window.t === 'function' ? window.t('ui.import', 'Import') : 'Import')}</button>
      </div>
    </div>`;
  }
  list.innerHTML = html;
}

async function submitPluginImport(path) {
  if (!path) return;
  try {
    const r = await fetch(`${API_BASE}/api/plugins/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });
    const result = await r.json();
    if (result.ok) {
      if (typeof addSystemBubble === 'function') {
        addSystemBubble(`Plugin "${result.plugin_name}" importado: ${result.agents_imported} agentes (${result.skills_found || 0} skills encontradas)`);
      }
      if (result.agents_imported > 0) {
        try { await loadAgents(); } catch (_) { }
      }
      // Show setup prompt if plugin needs configuration
      if (result.needs_setup) {
        const list = document.getElementById('bundleImportPluginsList');
        if (list) {
          const setupCard = document.createElement('div');
          setupCard.id = 'pluginSetupCard';
          setupCard.style.cssText = 'margin-top:12px;padding:14px;border:1px solid var(--amber);border-radius:8px;background:rgba(255,165,0,.08)';
          setupCard.innerHTML = `<div style="display:flex;align-items:flex-start;gap:10px">
            <i class="fas fa-exclamation-triangle" style="color:var(--amber);font-size:18px;margin-top:2px"></i>
            <div style="flex:1">
              <div style="font-weight:600;font-size:13px;color:var(--white)">Plugin "${escapeHtml(result.plugin_name)}" importado — requer configuração</div>
              <div style="font-size:11px;color:var(--gray);margin-top:4px">Este plugin contém marcadores [MARCADOR]. Execute <code style="background:var(--bg);padding:1px 4px;border-radius:3px">/${escapeHtml(result.setup_skill || 'cold-start-interview')}</code> para configurá-lo.</div>
              <button class="btn btn-xs" style="margin-top:8px;border-color:var(--amber);color:var(--amber)" onclick="runPluginSetup('${escapeHtml(result.setup_skill || 'cold-start-interview')}')"><i class="fas fa-play"></i> Executar ${escapeHtml(result.setup_skill || 'cold-start-interview')}</button>
            </div>
          </div>`;
          list.insertAdjacentElement('afterend', setupCard);
        }
      }
    } else {
      if (typeof addSystemBubble === 'function') {
        addSystemBubble(`Erro ao importar plugin: ${result.error || 'unknown error'}`);
      }
    }
  } catch (e) {
    if (typeof addSystemBubble === 'function') {
      addSystemBubble(`Falha ao importar plugin: ${e.message}`);
    }
  }
}

async function runPluginSetup(setupSkill) {
  // Close the modal
  if (typeof closeBundleImportModal === 'function') closeBundleImportModal();
  // Select the orchestrator agent and send the setup command
  const orchAgent = (agents || []).find(a => a.name && a.name.toLowerCase().includes('orchestrat'));
  if (orchAgent) {
    if (typeof window.selectAgent === 'function') {
      await window.selectAgent(orchAgent.agent_id);
    }
  }
  // Send the setup command
  if (typeof window.sendMessage === 'function') {
    window.sendMessage(`Please run the /${setupSkill} skill to configure this plugin. The plugin's CLAUDE.md contains [MARCADOR] placeholders that must be filled in with the actual case parameters. Follow the cold-start interview flow to set up: law firm profile, case parameters, jurisdiction strategy, evidence paths, and client details. After setup, the plugin's skills and agents will produce substantive output.`);
  }
}
window.runPluginSetup = runPluginSetup;

async function submitPluginImportByPath() {
  const input = document.getElementById('pluginPathInput');
  if (!input) return;
  const path = input.value.trim();
  if (!path) {
    if (typeof addSystemBubble === 'function') addSystemBubble('Informe o caminho do plugin.');
    return;
  }
  // First discover
  try {
    const r = await fetch(`${API_BASE}/api/plugins/discover?path=${encodeURIComponent(path)}`);
    const info = await r.json();
    if (info.error) {
      if (typeof addSystemBubble === 'function') addSystemBubble(`Erro: ${info.error}`);
      return;
    }
    // Add to list and render
    const exists = _bundleImportState.plugins.find(p => p.path === info.path);
    if (!exists) {
      _bundleImportState.plugins.push(info);
      _bundleImportRenderPlugins();
    }
    // Auto-import
    await submitPluginImport(info.path);
  } catch (e) {
    if (typeof addSystemBubble === 'function') addSystemBubble(`Falha: ${e.message}`);
  }
}

window.submitPluginImport = submitPluginImport;
window.submitPluginImportByPath = submitPluginImportByPath;
window.refreshWorkspacePathPreview = refreshWorkspacePathPreview;
window.toggleModalUnrestrictedToolsDisplay = toggleModalUnrestrictedToolsDisplay;
window.submitCreateAgent = submitCreateAgent;