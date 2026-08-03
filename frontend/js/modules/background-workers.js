/* ═══════════════════════════════════════════════════════════════════
   BACKGROUND WORKERS MODULE - Header badge and slide-over panel
   Reference: uploads/projects/agents---ui/writer/Background Agent Visibility _ UI Feature Specification.md
   ═══════════════════════════════════════════════════════════════════ */

// ─── State ──────────────────────────────────────────────────────────────────
let _bgWorkersBadge = null;
let _bgWorkersPanel = null;
let _bgWorkersBadgePollTimer = null;
let _bgWorkersPanelPollTimer = null;
let _bgWorkersPanelOpen = false;
let _bgWorkersStatusData = null; // { agents: [...] }
let _bgWorkersLastFetchAt = 0;
let _bgWorkersFetchInFlight = null;
const _BG_PANEL_FETCH_COOLDOWN_MS = 1500;
const _BG_BADGE_POLL_INTERVAL_MS = 5000;
const _BG_PANEL_POLL_INTERVAL_MS = 3000;

// ─── Badge Initialization ───────────────────────────────────────────────────
function initBackgroundWorkersBadge() {
  if (_bgWorkersBadge) return;

  const chatHeaderRight = document.querySelector('.chat-header-right');
  if (!chatHeaderRight) {
    console.warn('[bg-workers] .chat-header-right not found; skipping badge init');
    return;
  }

  // Insert before headerDotsToggle (the ••• button)
  const headerDotsToggle = document.getElementById('headerDotsToggle');

  _bgWorkersBadge = document.createElement('button');
  _bgWorkersBadge.id = 'bgWorkersBadge';
  _bgWorkersBadge.className = 'bg-workers-badge hidden';
  _bgWorkersBadge.setAttribute('data-i18n', 'backgroundWorkers.idle');
  _bgWorkersBadge.setAttribute('data-i18n-attr', 'title');
  _bgWorkersBadge.setAttribute('title', window.__i18n?.('backgroundWorkers.idle') || 'No background workers active');
  _bgWorkersBadge.innerHTML = `
    <i class="fas fa-sync-alt"></i>
    <span class="bg-workers-badge-count">0</span>
  `;
  _bgWorkersBadge.addEventListener('click', () => openBackgroundWorkersPanel());

  if (headerDotsToggle && chatHeaderRight.contains(headerDotsToggle)) {
    chatHeaderRight.insertBefore(_bgWorkersBadge, headerDotsToggle);
  } else {
    chatHeaderRight.appendChild(_bgWorkersBadge);
  }

  // Start badge polling
  ensureBackgroundWorkersBadgePolling();
}

function ensureBackgroundWorkersBadgePolling() {
  if (window.Olivia_EMBED_MODE) return;
  if (_bgWorkersBadgePollTimer) return;

  // Initial fetch
  fetchBackgroundWorkersStatus({ rerender: false }).then(() => renderBackgroundWorkersBadge());

  _bgWorkersBadgePollTimer = setInterval(() => {
    if (document.hidden) return;
    fetchBackgroundWorkersStatus({ rerender: false }).then(() => renderBackgroundWorkersBadge());
  }, _BG_BADGE_POLL_INTERVAL_MS);
}

// ─── Panel Initialization ───────────────────────────────────────────────────
function initBackgroundWorkersPanel() {
  if (_bgWorkersPanel) return;

  _bgWorkersPanel = document.createElement('div');
  _bgWorkersPanel.id = 'bgWorkersPanel';
  _bgWorkersPanel.className = 'bg-workers-panel hidden';
  _bgWorkersPanel.innerHTML = `
    <div class="bg-workers-panel-header">
      <div class="bg-workers-panel-title">
        <i class="fas fa-sync-alt"></i>
        <span data-i18n="backgroundWorkers.title">Background Workers</span>
      </div>
      <div class="bg-workers-panel-actions">
        <button class="btn btn-sm btn-danger" id="bgWorkersStopAllBtn" data-i18n="backgroundWorkers.stopAll">
          Stop All
        </button>
        <button class="btn btn-sm" id="bgWorkersCloseBtn" title="Close">
          <i class="fas fa-times"></i>
        </button>
      </div>
    </div>
    <div class="bg-workers-panel-body" id="bgWorkersPanelBody">
      <div class="bg-workers-panel-empty" data-i18n="backgroundWorkers.idle">
        No background workers active
      </div>
    </div>
    <div class="bg-workers-panel-footer hidden" id="bgWorkersPanelFooter">
      <button class="btn btn-sm" id="bgWorkersClearCompletedBtn" data-i18n="backgroundWorkers.clearCompleted">
        Clear completed
      </button>
    </div>
  `;

  document.body.appendChild(_bgWorkersPanel);

  // Bind panel events
  document.getElementById('bgWorkersCloseBtn').addEventListener('click', closeBackgroundWorkersPanel);
  document.getElementById('bgWorkersStopAllBtn').addEventListener('click', stopAllBackgroundWorkers);
  document.getElementById('bgWorkersClearCompletedBtn').addEventListener('click', clearCompletedBackgroundWorkers);

  // ESC to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && _bgWorkersPanelOpen) {
      closeBackgroundWorkersPanel();
    }
  });
}

// ─── Panel Open/Close ───────────────────────────────────────────────────────
function openBackgroundWorkersPanel() {
  initBackgroundWorkersPanel();
  _bgWorkersPanelOpen = true;
  _bgWorkersPanel.classList.remove('hidden');
  _bgWorkersPanel.classList.add('open');

  // Start panel polling
  fetchBackgroundWorkersStatus({ rerender: true });
  if (_bgWorkersPanelPollTimer) clearInterval(_bgWorkersPanelPollTimer);
  _bgWorkersPanelPollTimer = setInterval(() => {
    if (document.hidden) return;
    fetchBackgroundWorkersStatus({ rerender: true });
  }, _BG_PANEL_POLL_INTERVAL_MS);
}

function closeBackgroundWorkersPanel() {
  _bgWorkersPanelOpen = false;
  if (_bgWorkersPanel) {
    _bgWorkersPanel.classList.remove('open');
    _bgWorkersPanel.classList.add('hidden');
  }
  // Stop panel polling
  if (_bgWorkersPanelPollTimer) {
    clearInterval(_bgWorkersPanelPollTimer);
    _bgWorkersPanelPollTimer = null;
  }
}

// ─── Data Fetching ──────────────────────────────────────────────────────────
async function fetchBackgroundWorkersStatus(options) {
  const opts = options && typeof options === 'object' ? options : {};
  const rerender = opts.rerender !== false;
  const now = Date.now();

  if (!opts.force && (now - _bgWorkersLastFetchAt) < _BG_PANEL_FETCH_COOLDOWN_MS) {
    return _bgWorkersStatusData;
  }

  if (_bgWorkersFetchInFlight) {
    try {
      await _bgWorkersFetchInFlight;
    } catch (_e) {
      // Keep UI usable
    }
    return _bgWorkersStatusData;
  }

  _bgWorkersFetchInFlight = (async () => {
    try {
      const res = await fetch(`${API_BASE}/api/agents/background/status`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      _bgWorkersStatusData = data;
      _bgWorkersLastFetchAt = Date.now();
    } finally {
      _bgWorkersFetchInFlight = null;
    }
  })();

  try {
    await _bgWorkersFetchInFlight;
    if (rerender) renderBackgroundWorkersPanel();
    return _bgWorkersStatusData;
  } catch (_e) {
    if (rerender) renderBackgroundWorkersPanel();
    return _bgWorkersStatusData;
  }
}

// ─── Badge Rendering ────────────────────────────────────────────────────────
function renderBackgroundWorkersBadge() {
  if (!_bgWorkersBadge) return;

  const agents = _bgWorkersStatusData?.agents || [];
  let runningCount = 0;

  for (const agent of agents) {
    const bg = agent.background;
    if (bg && (bg.status === 'running' || bg.status === 'paused')) {
      runningCount++;
    }
  }

  const countEl = _bgWorkersBadge.querySelector('.bg-workers-badge-count');
  if (countEl) countEl.textContent = runningCount;

  if (runningCount > 0) {
    _bgWorkersBadge.classList.remove('hidden', 'idle');
    _bgWorkersBadge.classList.add('active');
    _bgWorkersBadge.setAttribute('title', `${runningCount} active`);
  } else {
    _bgWorkersBadge.classList.remove('active');
    _bgWorkersBadge.classList.add('hidden', 'idle');
    _bgWorkersBadge.setAttribute('title', window.__i18n?.('backgroundWorkers.idle') || 'No background workers active');
  }
}

// ─── Panel Rendering ────────────────────────────────────────────────────────
function renderBackgroundWorkersPanel() {
  if (!_bgWorkersPanel) return;

  const body = document.getElementById('bgWorkersPanelBody');
  const footer = document.getElementById('bgWorkersPanelFooter');
  const stopAllBtn = document.getElementById('bgWorkersStopAllBtn');

  if (!body) return;

  const agents = _bgWorkersStatusData?.agents || [];

  // Filter agents with background workers
  const workersWithBg = agents.filter(a => a.background && a.background.status);

  if (workersWithBg.length === 0) {
    body.innerHTML = `<div class="bg-workers-panel-empty" data-i18n="backgroundWorkers.idle">No background workers active</div>`;
    footer.classList.add('hidden');
    stopAllBtn.classList.add('hidden');
    return;
  }

  // Count active (running/paused) and completed
  let activeCount = 0;
  let completedCount = 0;
  const rows = [];

  for (const agent of workersWithBg) {
    const bg = agent.background;
    const status = bg.status || 'unknown';
    const isActive = status === 'running' || status === 'paused';
    const isCompleted = status === 'done' || status === 'error' || status === 'stopped';

    if (isActive) activeCount++;
    if (isCompleted) completedCount++;

    rows.push(renderBackgroundWorkerRow(agent));
  }

  body.innerHTML = rows.join('');

  // Bind row events
  body.querySelectorAll('[data-bg-action]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const action = e.currentTarget.getAttribute('data-bg-action');
      const agentId = e.currentTarget.getAttribute('data-agent-id');
      await handleBackgroundWorkerAction(agentId, action);
    });
  });

  // Show/hide footer and stop-all button
  if (completedCount > 0) {
    footer.classList.remove('hidden');
  } else {
    footer.classList.add('hidden');
  }

  if (activeCount > 0) {
    stopAllBtn.classList.remove('hidden');
  } else {
    stopAllBtn.classList.add('hidden');
  }

  // Re-apply i18n
  if (typeof applyI18n === 'function') {
    applyI18n();
  }
}

function renderBackgroundWorkerRow(agent) {
  const bg = agent.background;
  const status = bg.status || 'unknown';
  const agentId = agent.agent_id || '';
  const agentName = agent.name || 'Unknown Agent';

  // Status icon
  let statusIcon = 'fa-question';
  let statusClass = '';
  let statusLabel = status;

  switch (status) {
    case 'running':
      statusIcon = 'fa-sync-alt fa-spin';
      statusClass = 'running';
      statusLabel = window.__i18n?.('backgroundWorkers.status.running') || 'Running';
      break;
    case 'paused':
      statusIcon = 'fa-pause';
      statusClass = 'paused';
      statusLabel = window.__i18n?.('backgroundWorkers.status.paused') || 'Paused';
      break;
    case 'done':
      statusIcon = 'fa-check-circle';
      statusClass = 'done';
      statusLabel = window.__i18n?.('backgroundWorkers.status.done') || 'Completed';
      break;
    case 'error':
      statusIcon = 'fa-exclamation-circle';
      statusClass = 'error';
      statusLabel = window.__i18n?.('backgroundWorkers.status.error') || 'Failed';
      break;
    case 'stopped':
      statusIcon = 'fa-stop-circle';
      statusClass = 'stopped';
      statusLabel = window.__i18n?.('backgroundWorkers.status.stopped') || 'Stopped';
      break;
  }

  // Progress
  const collected = bg.collected_count || 0;
  const target = bg.target_count || 0;
  const progress = bg.progress || 0;
  const progressPct = Math.round(progress * 100);
  const progressText = target > 0
    ? (window.__i18n?.('backgroundWorkers.progress') || '{collected}/{target} references')
        .replace('{collected}', collected)
        .replace('{target}', target)
    : `${collected} references`;

  // Current query
  const lastQuery = bg.last_query || '';
  const queryText = lastQuery
    ? (window.__i18n?.('backgroundWorkers.currentQuery') || 'Current: {query}')
        .replace('{query}', lastQuery.length > 40 ? lastQuery.substring(0, 37) + '...' : lastQuery)
    : '';

  // Elapsed time
  const startedAt = bg.started_at ? new Date(bg.startedAt || bg.started_at) : null;
  const elapsedText = startedAt && !isNaN(startedAt)
    ? formatElapsed(startedAt, status === 'running' ? null : bg.finished_at)
    : '';

  // Message
  const message = bg.message || '';

  // Action buttons
  let actionsHtml = '';
  if (status === 'running') {
    actionsHtml = `
      <button class="btn btn-xs" data-bg-action="pause" data-agent-id="${agentId}" title="Pause">
        <i class="fas fa-pause"></i>
      </button>
      <button class="btn btn-xs btn-danger" data-bg-action="stop" data-agent-id="${agentId}" title="Stop">
        <i class="fas fa-stop"></i>
      </button>
    `;
  } else if (status === 'paused') {
    actionsHtml = `
      <button class="btn btn-xs" data-bg-action="resume" data-agent-id="${agentId}" title="Resume">
        <i class="fas fa-play"></i>
      </button>
      <button class="btn btn-xs btn-danger" data-bg-action="stop" data-agent-id="${agentId}" title="Stop">
        <i class="fas fa-stop"></i>
      </button>
    `;
  } else if (status === 'done' || status === 'error' || status === 'stopped') {
    actionsHtml = `
      <button class="btn btn-xs" data-bg-action="clear" data-agent-id="${agentId}" title="Clear">
        <i class="fas fa-times"></i>
      </button>
    `;
  }

  return `
    <div class="bg-worker-row ${statusClass}" data-agent-id="${agentId}">
      <div class="bg-worker-row-header">
        <div class="bg-worker-status">
          <i class="fas ${statusIcon}"></i>
        </div>
        <div class="bg-worker-info">
          <div class="bg-worker-name">${escapeHtml(agentName)}</div>
          <div class="bg-worker-status-label">${statusLabel}</div>
        </div>
        <div class="bg-worker-actions">
          ${actionsHtml}
        </div>
      </div>
      ${target > 0 ? `
      <div class="bg-worker-progress">
        <div class="bg-worker-progress-bar">
          <div class="bg-worker-progress-fill" style="width: ${progressPct}%"></div>
        </div>
        <div class="bg-worker-progress-text">${progressText}</div>
      </div>
      ` : ''}
      ${queryText ? `<div class="bg-worker-query">${escapeHtml(queryText)}</div>` : ''}
      ${elapsedText ? `<div class="bg-worker-meta">${elapsedText}</div>` : ''}
      ${message ? `<div class="bg-worker-message">${escapeHtml(message)}</div>` : ''}
    </div>
  `;
}

function formatElapsed(startTime, endTime) {
  const startMs = startTime.getTime();
  const endMs = endTime ? new Date(endTime).getTime() : Date.now();
  const elapsedSec = Math.max(0, Math.floor((endMs - startMs) / 1000));

  const hours = Math.floor(elapsedSec / 3600);
  const minutes = Math.floor((elapsedSec % 3600) / 60);
  const seconds = elapsedSec % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
}

// ─── Actions ────────────────────────────────────────────────────────────────
async function handleBackgroundWorkerAction(agentId, action) {
  if (!agentId) return;

  try {
    if (action === 'pause') {
      await fetch(`${API_BASE}/api/agents/${encodeURIComponent(agentId)}/background/pause`, { method: 'POST' });
    } else if (action === 'resume') {
      await fetch(`${API_BASE}/api/agents/${encodeURIComponent(agentId)}/background/resume`, { method: 'POST' });
    } else if (action === 'stop') {
      await fetch(`${API_BASE}/api/agents/${encodeURIComponent(agentId)}/background/stop`, { method: 'POST' });
    } else if (action === 'clear') {
      // Clear is a UI-only action; we just refetch (terminal states remain until worker restarts)
      // In the future, backend may support explicit clearing
    }

    // Refetch and rerender
    await fetchBackgroundWorkersStatus({ force: true, rerender: true });
  } catch (err) {
    console.error('[bg-workers] Action failed:', action, agentId, err);
    if (typeof toast === 'function') {
      toast(`Failed to ${action} worker: ${err.message}`, 'error');
    }
  }
}

async function stopAllBackgroundWorkers() {
  const confirmMsg = window.__i18n?.('backgroundWorkers.stopAllConfirm') || 'Stop all background workers?';
  const confirmed = typeof customConfirm === 'function'
    ? await customConfirm(confirmMsg)
    : window.confirm(confirmMsg);

  if (!confirmed) return;

  const agents = _bgWorkersStatusData?.agents || [];
  const activeAgents = agents.filter(a => {
    const bg = a.background;
    return bg && (bg.status === 'running' || bg.status === 'paused');
  });

  try {
    await Promise.all(activeAgents.map(agent =>
      fetch(`${API_BASE}/api/agents/${encodeURIComponent(agent.agent_id)}/background/stop`, { method: 'POST' })
    ));

    if (typeof toast === 'function') {
      toast(`Stopped ${activeAgents.length} background worker(s)`, 'success');
    }

    await fetchBackgroundWorkersStatus({ force: true, rerender: true });
  } catch (err) {
    console.error('[bg-workers] Stop all failed:', err);
    if (typeof toast === 'function') {
      toast(`Failed to stop all workers: ${err.message}`, 'error');
    }
  }
}

async function clearCompletedBackgroundWorkers() {
  // UI-only clear: refetch to remove any that the backend has cleaned up
  await fetchBackgroundWorkersStatus({ force: true, rerender: true });

  // In the future, if backend supports explicit clearing, call it here
  if (typeof toast === 'function') {
    toast('Completed workers cleared', 'success');
  }
}

// ─── Utility ────────────────────────────────────────────────────────────────
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ─── Initialization ─────────────────────────────────────────────────────────
function initBackgroundWorkers() {
  if (window.Olivia_EMBED_MODE) return;

  initBackgroundWorkersBadge();
  initBackgroundWorkersPanel();

  console.log('[bg-workers] Background Workers module initialized');
}

// Auto-init when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initBackgroundWorkers);
} else {
  initBackgroundWorkers();
}