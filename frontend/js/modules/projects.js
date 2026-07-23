/* ═══════════════════════════════════════════════════════════════════
   PROJECTS MODULE - Backend-persisted project management for LA8159
   ═══════════════════════════════════════════════════════════════════ */

let _projects = [];
let _currentProjectId = null;
let _lastProjectNotice = { key: '', at: 0 };
const PROJECT_UPLOAD_TARGET_STORAGE_KEY = 'OliviaLegal.project.upload.target.section';
const PROJECT_FILES_CACHE_TTL_MS = 3500;
const AGENT_PROJECT_CACHE_TTL_MS = 3000;
const PROJECT_PANEL_REFRESH_DEBOUNCE_MS = 180;
const _projectFilesCache = new Map();
const _projectFilesInflight = new Map();
const _agentProjectCache = new Map();
const _agentProjectInflight = new Map();
const _agentProjectBindings = (window._agentProjectBindings && typeof window._agentProjectBindings === 'object')
  ? window._agentProjectBindings
  : {};
window._agentProjectBindings = _agentProjectBindings;
let _projectPanelsRefreshTimer = null;
let _projectPanelsRefreshWaiters = [];
let _projectPanelsRefreshOpts = { force: false };

function _systemNoticeOnce(message, minIntervalMs) {
  const now = Date.now();
  if (_lastProjectNotice.key === message && (now - _lastProjectNotice.at) < (minIntervalMs || 2500)) {
    return;
  }
  addSystemBubble(message);
  _lastProjectNotice = { key: message, at: now };
}

function _setProjectActionState() {
  const hasProject = !!_currentProjectId;
  const uploadBtn = document.querySelector('#tab-projects button[onclick="triggerProjectUpload()"]');
  const filesBtn = document.querySelector('#tab-projects button[onclick="loadProjectFiles()"]');
  if (uploadBtn) {
    uploadBtn.disabled = !hasProject;
    uploadBtn.style.opacity = hasProject ? '1' : '.55';
    uploadBtn.style.cursor = hasProject ? 'pointer' : 'not-allowed';
    uploadBtn.title = hasProject
      ? (typeof window.t === 'function' ? window.t('ui.uploadToActiveProject', 'Upload files to active project') : 'Upload files to active project')
      : (typeof window.t === 'function' ? window.t('ui.selectProjectFirst', 'Select a project first') : 'Select a project first');
  }
  if (filesBtn) {
    filesBtn.disabled = !hasProject;
    filesBtn.style.opacity = hasProject ? '1' : '.55';
    filesBtn.style.cursor = hasProject ? 'pointer' : 'not-allowed';
    filesBtn.title = hasProject
      ? (typeof window.t === 'function' ? window.t('ui.refreshProjectFiles', 'Refresh active project file list') : 'Refresh active project file list')
      : (typeof window.t === 'function' ? window.t('ui.selectProjectFirst', 'Select a project first') : 'Select a project first');
  }
}

function _projectsStorageKey() {
  return 'OliviaLegal.workspace.project';
}

function _normalizeProjectUploadSection(raw) {
  let value = String(raw || '').trim().replace(/\\/g, '/');
  if (!value) return 'uploads';
  value = value.replace(/^\/+/, '').replace(/\/+/g, '/');
  const parts = value.split('/').filter((part) => part && part !== '.' && part !== '..');
  return parts.length ? parts.join('/') : 'uploads';
}

function _resolveProjectUploadSection() {
  const input = document.getElementById('projectUploadTargetPath');
  return _normalizeProjectUploadSection(input ? input.value : 'uploads');
}

function _refreshProjectUploadTargetHint() {
  const hint = document.getElementById('projectUploadTargetResolved');
  if (!hint) return;
  const section = _resolveProjectUploadSection();
  const t = (typeof window.t === 'function') ? window.t('ui.finalDestinationInProject', 'Final destination in project: %s/') : 'Final destination in project: %s/';
  hint.textContent = t.replace('%s', section);
}

function onProjectUploadTargetChanged(rawValue) {
  const normalized = _normalizeProjectUploadSection(rawValue);
  try {
    localStorage.setItem(PROJECT_UPLOAD_TARGET_STORAGE_KEY, normalized);
  } catch (_e) {}
  _refreshProjectUploadTargetHint();
}

function _initProjectUploadTargetInput() {
  const input = document.getElementById('projectUploadTargetPath');
  if (!input) return;
  let saved = 'uploads';
  try {
    saved = String(localStorage.getItem(PROJECT_UPLOAD_TARGET_STORAGE_KEY) || 'uploads');
  } catch (_e) {
    saved = 'uploads';
  }
  input.value = _normalizeProjectUploadSection(saved);
  _refreshProjectUploadTargetHint();
}

function _projectCurrentLabel(project) {
  const name = (project && project.name) ? project.name : 'nenhum';
  const files = project && typeof project.files_count === 'number' ? ` (${project.files_count} arquivos)` : '';
  return `Projeto atual: ${name}${files}`;
}

async function _refreshProjectPanels(opts) {
  const options = Object.assign({ force: false }, opts || {});
  await loadProjectFiles({ force: !!options.force });
  if (typeof loadDocsTree === 'function') {
    loadDocsTree({ force: !!options.force });
  }
}

function _scheduleProjectPanelsRefresh(opts) {
  const options = Object.assign({ force: false, delay: PROJECT_PANEL_REFRESH_DEBOUNCE_MS }, opts || {});
  _projectPanelsRefreshOpts = {
    force: !!(_projectPanelsRefreshOpts.force || options.force),
  };

  if (_projectPanelsRefreshTimer) {
    clearTimeout(_projectPanelsRefreshTimer);
  }

  return new Promise((resolve) => {
    _projectPanelsRefreshWaiters.push(resolve);
    _projectPanelsRefreshTimer = setTimeout(async () => {
      _projectPanelsRefreshTimer = null;
      const pending = _projectPanelsRefreshWaiters.slice();
      _projectPanelsRefreshWaiters = [];
      const runOpts = _projectPanelsRefreshOpts;
      _projectPanelsRefreshOpts = { force: false };
      try {
        await _refreshProjectPanels(runOpts);
      } finally {
        pending.forEach((done) => done());
      }
    }, Math.max(0, Number(options.delay) || 0));
  });
}

async function _fetchAgentProjectBinding(agentId, opts) {
  const options = Object.assign({ force: false }, opts || {});
  const aid = String(agentId || '').trim();
  if (!aid) return null;

  const now = Date.now();
  const cached = _agentProjectCache.get(aid);
  if (!options.force && cached && (now - cached.at) <= AGENT_PROJECT_CACHE_TTL_MS) {
    return cached.project;
  }
  if (_agentProjectInflight.has(aid)) {
    return _agentProjectInflight.get(aid);
  }

  const req = fetch(`${API_BASE}/api/projects/agent/${encodeURIComponent(aid)}`)
    .then(async (res) => {
      if (!res.ok) return null;
      const data = await res.json().catch(() => ({}));
      const project = data && data.project ? data.project : null;
      _agentProjectCache.set(aid, { at: Date.now(), project });
      return project;
    })
    .finally(() => {
      _agentProjectInflight.delete(aid);
    });

  _agentProjectInflight.set(aid, req);
  return req;
}

function _clearProjectFilesCache(projectId) {
  const pid = String(projectId || '').trim();
  if (pid) {
    _projectFilesCache.delete(pid);
    return;
  }
  _projectFilesCache.clear();
}

async function fetchProjectFilesSnapshot(projectId, opts) {
  const options = Object.assign({ force: false }, opts || {});
  const pid = String(projectId || '').trim();
  if (!pid) return { files: [], total: 0 };

  const now = Date.now();
  const cached = _projectFilesCache.get(pid);
  if (!options.force && cached && (now - cached.at) <= PROJECT_FILES_CACHE_TTL_MS) {
    return cached.payload;
  }

  if (_projectFilesInflight.has(pid)) {
    return _projectFilesInflight.get(pid);
  }

  const req = fetch(`${API_BASE}/api/projects/${encodeURIComponent(pid)}/files`)
    .then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
      const payload = {
        files: Array.isArray(data.files) ? data.files : [],
        total: Number(data.total) || 0,
        project_abs_path: data && data.project_abs_path ? String(data.project_abs_path) : '',
      };
      _projectFilesCache.set(pid, { at: Date.now(), payload });
      return payload;
    })
    .finally(() => {
      _projectFilesInflight.delete(pid);
    });

  _projectFilesInflight.set(pid, req);
  return req;
}

function _findProject(projectId) {
  return _projects.find(p => p.project_id === projectId) || null;
}

// Expose the active project id so other modules (e.g. the file-convert pill)
// can target the project that is currently selected.
function _syncProjectIdGlobal() {
  window.OliviaProjectId = _currentProjectId || '';
}

function _renderProjectList() {
  const list = document.getElementById('projectList');
  const current = document.getElementById('projectCurrent');
  if (!list) return;

  if (!_projects.length) {
    list.innerHTML = '<p style="color:var(--gray);font-size:11px;text-align:center;padding:12px 0;font-style:italic">Nenhum projeto criado ainda. Clique em "Novo Projeto" para começar.</p>';
  } else {
    const visibleProjects = _projects.filter(p => p.name !== 'OliviaLegal Workspace' && p.project_id !== 'OliviaLegal-project' && p.project_id !== 'OliviaLegal Workspace');
    
    if (!visibleProjects.length) {
      list.innerHTML = '<p style="color:var(--gray);font-size:11px;text-align:center;padding:12px 0;font-style:italic">Nenhum projeto criado ainda. Clique em "Novo Projeto" para começar.</p>';
    } else {
      list.innerHTML = visibleProjects.map((p) => {
        const selected = p.project_id === _currentProjectId ? ' selected' : '';
        const desc = p.description || 'Projeto persistido no backend';
        const meta = `${p.files_count || 0} arquivos`;
        const pidAttr = escapeHtmlAttr(p.project_id);
        return `<div class="project-item${selected}" data-project="${escapeHtml(p.project_id)}" onclick="selectProject('${escapeHtml(p.project_id)}')">
          <div class="project-name">${escapeHtml(p.name || p.project_id)}</div>
          <div class="project-meta">${escapeHtml(desc)} · ${escapeHtml(meta)}</div>
          <div class="project-actions" onclick="event.stopPropagation()">
            <button type="button" class="project-action-pill" title="Exportar projeto (zip)" onclick="exportProject('${pidAttr}')"><i class="fas fa-download"></i></button>
            <button type="button" class="project-action-pill" title="${(typeof window.t === 'function' ? window.t('ui.archiveProject', 'Archive project') : 'Archive project')}" onclick="archiveProject('${pidAttr}')"><i class="fas fa-archive"></i></button>
            <button type="button" class="project-action-pill danger" title="Excluir projeto" onclick="deleteProject('${pidAttr}')"><i class="fas fa-trash"></i></button>
          </div>
        </div>`;
      }).join('');
    }
  }

  if (current) {
    current.textContent = _projectCurrentLabel(_findProject(_currentProjectId));
  }
  if (typeof discUpdateActiveProjectLabel === 'function') discUpdateActiveProjectLabel();
  _setProjectActionState();
}

async function loadProjects() {
  const list = document.getElementById('projectList');
  if (list) {
    list.innerHTML = '<p style="color:var(--gray);font-size:11px;text-align:center;padding:12px 0;font-style:italic">Carregando projetos...</p>';
  }
  try {
    const res = await fetch(`${API_BASE}/api/projects/list`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    _projects = Array.isArray(data.projects) ? data.projects : [];

    if (!_currentProjectId) {
      const saved = localStorage.getItem(_projectsStorageKey());
      if (saved) _currentProjectId = saved;
    }
    if (_currentProjectId && !_findProject(_currentProjectId)) {
      _currentProjectId = null;
      localStorage.removeItem(_projectsStorageKey());
    }

    _syncProjectIdGlobal();
    _renderProjectList();
    if (_currentProjectId) {
      await loadProjectFiles();
    } else {
      const filesBox = document.getElementById('projectFilesList');
      if (filesBox) filesBox.textContent = (typeof window.t === 'function' ? window.t('ui.selectProjectToView', 'Select a project to view files.') : 'Select a project to view files.');
    }
  } catch (e) {
    if (list) {
      list.innerHTML = `<p style="color:var(--red);font-size:11px;text-align:center;padding:12px 0">Falha ao carregar projetos: ${escapeHtml(e.message || String(e))}</p>`;
    }
    toast('Falha ao carregar projetos', 'error');
  }
}

async function createProject() {
  const name = ((await window.customPrompt('Nome do projeto:')) || '').trim();
  if (!name) return;
  const description = ((await window.customPrompt('Descrição (opcional):')) || '').trim();

  try {
    const res = await fetch(`${API_BASE}/api/projects/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || `HTTP ${res.status}`);
    }
    addSystemBubble(`Projeto "${name}" criado.`);
    toast(`Projeto "${name}" criado`, 'success');
    await loadProjects();
    if (data.project && data.project.project_id) {
      await selectProject(data.project.project_id, { assignAgent: true });
    }
  } catch (e) {
    addSystemBubble(`Falha ao criar projeto: ${e.message}`);
    toast('Falha ao criar projeto', 'error');
  }
}

async function selectProject(projectId, opts) {
  // assignAgent defaults to false: switching the active project must NOT silently
  // re-bind the currently selected agent. Use attachAgentToProject() for that.
  const options = Object.assign({ assignAgent: false, silent: false }, opts || {});
  _currentProjectId = projectId;
  localStorage.setItem(_projectsStorageKey(), projectId);
  _syncProjectIdGlobal();
  _renderProjectList();
  _refreshProjectUploadTargetHint();

  const project = _findProject(projectId);
  if (!project) {
    _currentProjectId = null;
    localStorage.removeItem(_projectsStorageKey());
    _renderProjectList();
    const filesBox = document.getElementById('projectFilesList');
    if (filesBox) filesBox.textContent = (typeof window.t === 'function' ? window.t('ui.selectProjectToView', 'Select a project to view files.') : 'Select a project to view files.');
    return;
  }

  await refreshProjectIndex(projectId);
  await _refreshProjectPanels({ force: true });
  if (typeof discLoadFiles === 'function') discLoadFiles();
  if (typeof discLoadOverview === 'function') discLoadOverview();
  if (typeof discUpdateActiveProjectLabel === 'function') discUpdateActiveProjectLabel();
  if (typeof renderArquivosPanel === 'function') renderArquivosPanel();
  if (typeof loadProjectPlanningOverview === 'function') loadProjectPlanningOverview(true);

  if (!options.silent && project) {
    const msg = (typeof window.t === 'function'
      ? window.t('ui.projetoAtivo', 'Active project: %s')
      : 'Active project: %s').replace('%s', project.name);
    _systemNoticeOnce(msg, 2500);
    toast(msg, 'info');
  }

  if (options.assignAgent && selectedAgent && selectedAgent.agent_id) {
    try {
      const res = await fetch(`${API_BASE}/api/projects/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: selectedAgent.agent_id, project_id: projectId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
      _agentProjectBindings[String(selectedAgent.agent_id)] = String(projectId);
      _agentProjectCache.set(String(selectedAgent.agent_id), {
        at: Date.now(),
        project: { project_id: String(projectId), name: (project && project.name) ? String(project.name) : String(projectId) },
      });
      if (!options.silent && project) {
        _systemNoticeOnce(`Agente "${selectedAgent.name}" vinculado ao projeto "${project.name}".`, 3000);
        toast('Projeto vinculado ao agente', 'success');
      }
    } catch (e) {
      addSystemBubble(`Falha ao vincular projeto ao agente: ${e.message}`);
      toast('Falha ao vincular projeto ao agente', 'error');
    }
  }
}

function getCurrentProjectId() {
  return _currentProjectId;
}

async function refreshProjectIndex(projectId) {
  const pid = projectId || _currentProjectId;
  if (!pid) return null;
  const activeAgent = (typeof selectedAgent !== 'undefined') ? selectedAgent : null;
  try {
    const res = await fetch(`${API_BASE}/api/projects/${encodeURIComponent(pid)}/index/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id: activeAgent && activeAgent.agent_id ? activeAgent.agent_id : null,
        agent_name: activeAgent && activeAgent.name ? activeAgent.name : null,
      }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (_e) {
    return null;
  }
}

function triggerProjectUpload() {
  if (!_currentProjectId) {
    addSystemBubble((typeof window.t === 'function' ? window.t('ui.selectProjectBeforeUpload', 'Select a project before sending files.') : 'Select a project before sending files.'));
    toast((typeof window.t === 'function' ? window.t('ui.selectProjectBeforeUpload', 'Select a project before sending files.') : 'Select a project before sending files.'), 'error');
    return;
  }
  const input = document.getElementById('projectFileInput');
  if (input) input.click();
}

async function uploadProjectFiles(input) {
  const files = input && input.files ? Array.from(input.files) : [];
  if (!_currentProjectId) {
    addSystemBubble((typeof window.t === 'function' ? window.t('ui.selectProjectBeforeUpload', 'Select a project before sending files.') : 'Select a project before sending files.'));
    toast((typeof window.t === 'function' ? window.t('ui.selectProjectBeforeUpload', 'Select a project before sending files.') : 'Select a project before sending files.'), 'error');
    if (input) input.value = '';
    return;
  }
  if (!files.length) return;

  const fd = new FormData();
  files.forEach((f) => fd.append('files', f));
  const section = _resolveProjectUploadSection();

  try {
    const res = await fetch(`${API_BASE}/api/projects/${encodeURIComponent(_currentProjectId)}/upload?section=${encodeURIComponent(section)}&preserve_paths=true`, {
      method: 'POST',
      body: fd,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
    const tFiles = (typeof window.t === 'function');
    addSystemBubble((tFiles ? window.t('ui.filesSentToProject', '%s file(s) sent to project.') : '%s file(s) sent to project.').replace('%s', files.length));
    toast((tFiles ? window.t('ui.filesSent', '%s file(s) sent') : '%s file(s) sent').replace('%s', files.length), 'success');
    _clearProjectFilesCache(_currentProjectId);
    await loadProjects();
    await _scheduleProjectPanelsRefresh({ force: true, delay: 0 });
  } catch (e) {
    addSystemBubble(`Falha no upload para projeto: ${e.message}`);
    toast('Falha no upload para projeto', 'error');
  } finally {
    if (input) input.value = '';
  }
}

async function loadProjectFiles(opts) {
  const options = Object.assign({ force: false }, opts || {});
  const box = document.getElementById('projectFilesList');
  if (!box) return;

  if (!_currentProjectId) {
    box.textContent = (typeof window.t === 'function' ? window.t('ui.selectProjectToView', 'Select a project to view files.') : 'Select a project to view files.');
    return;
  }

  box.innerHTML = '<span style="color:var(--gray)">Carregando arquivos...</span>';
  try {
    const data = await fetchProjectFilesSnapshot(_currentProjectId, { force: !!options.force });
    const files = Array.isArray(data.files) ? data.files : [];
    if (data && data.project_abs_path) {
      window._projectAbsRoots = window._projectAbsRoots || {};
      window._projectAbsRoots[_currentProjectId] = String(data.project_abs_path);
    }
    if (!files.length) {
      box.textContent = 'Nenhum arquivo neste projeto ainda.';
      return;
    }
    box.innerHTML = files.map((f) => {
      const size = typeof f.size === 'number' ? formatBytes(f.size) : '';
      const relPath = String(f.name || '');
      const openJs = `openDocFile(${JSON.stringify(relPath)}, ${JSON.stringify(relPath.split('/').pop() || relPath)}, ${JSON.stringify(_currentProjectId)})`;
      return `<div style="padding:6px 4px;border-bottom:1px solid var(--border);cursor:pointer" onclick='${escapeHtmlAttr(openJs)}' title="Abrir no preview">
        <div style="color:var(--white);font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(relPath)}</div>
        <div style="color:var(--gray);font-size:10px">${escapeHtml(size)} · clique para abrir</div>
      </div>`;
    }).join('');
  } catch (e) {
    box.innerHTML = `<span style="color:var(--red)">Falha ao carregar arquivos: ${escapeHtml(e.message || String(e))}</span>`;
    toast('Falha ao carregar arquivos do projeto', 'error');
  }
}

async function attachAgentToProject(projectId, agentId) {
  const pid = String(projectId || _currentProjectId || '').trim();
  const activeAgent = (typeof selectedAgent !== 'undefined') ? selectedAgent : null;
  const aid = String(agentId || (activeAgent && activeAgent.agent_id) || '').trim();
  if (!pid) { toast((typeof window.t === 'function' ? window.t('ui.selectProjectFirst', 'Select a project first') : 'Select a project first'), 'error'); return; }
  if (!aid) { toast((typeof window.t === 'function' ? window.t('ui.selectAgentFirst', 'Select an agent first') : 'Select an agent first'), 'error'); return; }
  try {
    const res = await fetch(`${API_BASE}/api/projects/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_id: aid, project_id: pid }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
    _agentProjectBindings[aid] = pid;
    _agentProjectCache.set(aid, {
      at: Date.now(),
      project: { project_id: pid, name: (_findProject(pid) && _findProject(pid).name) ? String(_findProject(pid).name) : pid },
    });
    const project = _findProject(pid);
    const label = project ? project.name : pid;
    _systemNoticeOnce(`Agente vinculado ao projeto "${label}".`, 3000);
    toast('Agente vinculado ao projeto', 'success');
  } catch (e) {
    addSystemBubble(`Falha ao vincular agente: ${e.message}`);
    toast('Falha ao vincular agente ao projeto', 'error');
  }
}

function exportProject(projectId) {
  const pid = String(projectId || '').trim();
  if (!pid) return;
  // Navigate to the GET endpoint so the browser downloads the zip directly.
  window.location = `${API_BASE}/api/projects/${encodeURIComponent(pid)}/export`;
}

async function archiveProject(projectId) {
  const pid = String(projectId || '').trim();
  if (!pid) return;
  if (!window.customConfirm) {
    return;
  }
  const project = _findProject(pid);
  const label = project && project.name ? project.name : pid;
  const ok = await window.customConfirm((typeof window.t === 'function' ? window.t('ui.archiveProjectConfirm', 'Archive project "%s"? The folder will be moved to archived_projects and removed from the active list.') : 'Archive project "%s"? The folder will be moved to archived_projects and removed from the active list.').replace('%s', label), (typeof window.t === 'function' ? window.t('ui.archiveProject', 'Archive project') : 'Archive project'));
  if (!ok) return;

  try {
    const res = await fetch(`${API_BASE}/api/projects/${encodeURIComponent(pid)}/archive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subfolder: 'default' }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || data.error || `HTTP ${res.status}`);
    addSystemBubble(`Projeto "${label}" arquivado.`);
    toast(`Projeto "${label}" arquivado`, 'success');
    _clearProjectFilesCache(pid);
    if (_agentProjectBindings && _agentProjectBindings[String(pid)]) {
      delete _agentProjectBindings[String(pid)];
    }
    if (_currentProjectId === pid) {
      _currentProjectId = null;
      try { localStorage.removeItem(_projectsStorageKey()); } catch (_e) {}
      _syncProjectIdGlobal();
    }
    await loadProjects();
  } catch (e) {
    addSystemBubble(`Falha ao arquivar projeto: ${e.message}`);
    toast('Falha ao arquivar projeto', 'error');
  }
}

async function deleteProject(projectId) {
  const pid = String(projectId || '').trim();
  if (!pid) return;
  const project = _findProject(pid);
  const label = project && project.name ? project.name : pid;
  const choice = await projectConfirmDelete(label);
  if (!choice) return;

  if (choice === 'archive') {
    return archiveProject(pid);
  }

  try {
    const res = await fetch(`${API_BASE}/api/projects/${encodeURIComponent(pid)}/project`, {
      method: 'DELETE',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || data.error || `HTTP ${res.status}`);
    addSystemBubble(`Projeto "${label}" excluído permanentemente.`);
    toast(`Projeto "${label}" excluído`, 'success');
    _clearProjectFilesCache(pid);
    if (_agentProjectBindings && _agentProjectBindings[String(pid)]) {
      delete _agentProjectBindings[String(pid)];
    }
    if (_currentProjectId === pid) {
      _currentProjectId = null;
      try { localStorage.removeItem(_projectsStorageKey()); } catch (_e) {}
      _syncProjectIdGlobal();
    }
    await loadProjects();
  } catch (e) {
    addSystemBubble(`Falha ao excluir projeto: ${e.message}`);
    toast('Falha ao excluir projeto', 'error');
  }
}

// Lightweight two-choice confirm (Delete permanently vs Archive instead) that
// returns 'delete', 'archive', or null. Self-contained so it does not depend on
// the single-button modal in core.js.
function projectConfirmDelete(label) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('confirmModalOverlay');
    const existing = overlay ? overlay.cloneNode(true) : null;

    const build = () => {
      let ov = document.getElementById('projectDeleteConfirmOverlay');
      if (!ov) {
        ov = document.createElement('div');
        ov.id = 'projectDeleteConfirmOverlay';
        ov.className = 'modal-overlay';
        ov.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55)';
        document.body.appendChild(ov);
      }
      const t = (k, d) => (typeof window.t === 'function' ? window.t(k, d) : d);
      const body = t('ui.deleteProjectBody', 'The project "%s" will be permanently deleted. Archive it instead?').replace('%s', escapeHtml(label));
      ov.innerHTML = `
        <div class="modal-box" style="max-width:420px;width:90%;background:var(--bg-elev,#1a1a1f);border:1px solid var(--border,#333);border-radius:12px;padding:20px;color:var(--white,#fff)">
          <h3 style="margin:0 0 8px;font-size:15px">${t('ui.deleteProjectTitle', 'Delete project?')}</h3>
          <p style="margin:0 0 16px;font-size:13px;color:var(--gray,#aaa);line-height:1.4">
            ${body}
          </p>
          <div style="display:flex;gap:8px;justify-content:flex-end">
            <button type="button" class="modal-btn" data-act="cancel" style="padding:7px 12px;border-radius:8px;border:1px solid var(--border,#333);background:transparent;color:var(--white,#fff);cursor:pointer">${t('ui.cancel', 'Cancel')}</button>
            <button type="button" class="modal-btn" data-act="archive" style="padding:7px 12px;border-radius:8px;border:1px solid var(--accent,#5a8dee);background:transparent;color:var(--accent,#5a8dee);cursor:pointer">${t('ui.archive', 'Archive instead')}</button>
            <button type="button" class="modal-btn danger" data-act="delete" style="padding:7px 12px;border-radius:8px;border:1px solid var(--red,#e2483d);background:var(--red,#e2483d);color:#fff;cursor:pointer">${t('ui.deletePermanent', 'Delete permanently')}</button>
          </div>
        </div>`;

      const close = (result) => {
        ov.removeEventListener('click', onOverlay);
        ov.remove();
        if (existing && overlay && overlay.parentNode) {
          overlay.replaceWith(existing);
        }
        resolve(result);
      };
      const onOverlay = (ev) => {
        if (ev.target === ov) return close(null);
        const act = ev.target.getAttribute && ev.target.getAttribute('data-act');
        if (act === 'cancel') return close(null);
        if (act === 'archive') return close('archive');
        if (act === 'delete') return close('delete');
      };
      ov.addEventListener('click', onOverlay);
    };

    build();
  });
}

async function syncProjectFromAgent(agentId) {
  try {
    const aid = String(agentId || '').trim();
    const project = await _fetchAgentProjectBinding(aid);
    if (!project) {
      if (aid && _agentProjectBindings[aid]) delete _agentProjectBindings[aid];
      _agentProjectCache.set(aid, { at: Date.now(), project: null });
      if (_currentProjectId) {
        await _scheduleProjectPanelsRefresh({ force: false });
      }
      return;
    }

    // Keep workspace context aligned with the selected agent's bound project.
    if (project && project.project_id && _findProject(project.project_id)) {
      _agentProjectBindings[aid] = project.project_id;
      if (_currentProjectId !== project.project_id) {
        await selectProject(project.project_id, { assignAgent: false, silent: true });
      } else {
        await _scheduleProjectPanelsRefresh({ force: false });
      }
      return;
    }

    // Project exists but local list may be stale; refresh once then retry alignment.
    await loadProjects();
    if (project.project_id && _findProject(project.project_id)) {
      _agentProjectBindings[aid] = project.project_id;
      if (_currentProjectId !== project.project_id) {
        await selectProject(project.project_id, { assignAgent: false, silent: true });
      } else {
        await _scheduleProjectPanelsRefresh({ force: false });
      }
      return;
    }

    if (aid && _agentProjectBindings[aid]) delete _agentProjectBindings[aid];
    await _scheduleProjectPanelsRefresh({ force: false });
  } catch (_e) {
    // Keep UI usable even if backend assignment lookup fails.
  }
}

// ── Arquivos (Files) sidebar dashboard ───────────────────────────────────
// Wires the "Arquivos" tab to the active project: surfaces the 4 planning
// files (task_plan / findings / progress / memory) as the project compass,
// plus a direction summary and the remaining project files.
const _PLANNING_FILES = [
  { name: 'task_plan.md', label: 'Task Plan', icon: 'fa-list-check', color: 'var(--blue)' },
  { name: 'findings.md', label: 'Findings', icon: 'fa-magnifying-glass', color: 'var(--amber)' },
  { name: 'progress.md', label: 'Progress', icon: 'fa-chart-line', color: 'var(--green)' },
  { name: 'memory.md', label: 'Memory', icon: 'fa-brain', color: 'var(--purple)' },
];
window._PLANNING_FILES = _PLANNING_FILES;

function _arquivosEscapeAttr(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/'/g, '&#39;')
    .replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function _arquivosFileRow(relPath, displayName, opts) {
  const o = opts || {};
  const openJs = `openDocFile(${JSON.stringify(relPath)}, ${JSON.stringify(displayName)}, ${JSON.stringify(_currentProjectId)})`;
  const size = typeof o.size === 'number' ? formatBytes(o.size) : '';
  const meta = [size, o.section && o.section !== 'arquivos' ? o.section : 'projeto']
    .filter(Boolean).join(' · ');
  const dotColor = o.color || 'var(--gray)';
  const icon = o.icon || 'fa-file-lines';
  return `<div style="display:flex;align-items:center;gap:8px;padding:7px 8px;border:1px solid var(--border);border-radius:7px;cursor:pointer;background:rgba(255,255,255,0.02)" onclick="${_arquivosEscapeAttr(openJs)}" title="Abrir ${_arquivosEscapeAttr(displayName)}">
    <i class="fas ${icon}" style="color:${dotColor};width:14px;text-align:center;flex:0 0 auto"></i>
    <div style="flex:1 1 auto;min-width:0">
      <div style="color:var(--white);font-size:11px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(displayName)}</div>
      <div style="color:var(--gray);font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(meta)} · clique para abrir</div>
    </div>
  </div>`;
}

async function refreshArquivosPanel(opts) {
  // Used both on tab open and explicit refresh; ensure project files are fresh.
  if (typeof _currentProjectId !== 'undefined' && _currentProjectId) {
    try {
      if (opts && opts.force) await refreshProjectIndex(_currentProjectId);
    } catch (_e) { /* tolerate */ }
  }
  return renderArquivosPanel();
}

async function renderArquivosPanel() {
  const ctx = document.getElementById('arquivosProjectContext');
  const planningBox = document.getElementById('arquivosPlanningList');
  const planningCount = document.getElementById('arquivosPlanningCount');
  const otherBox = document.getElementById('arquivosOtherList');
  const otherCount = document.getElementById('arquivosOtherCount');
  const dirBox = document.getElementById('arquivosDirection');
  const dirText = document.getElementById('arquivosDirectionText');
  if (!planningBox || !otherBox) return;

  const pid = (typeof getCurrentProjectId === 'function') ? getCurrentProjectId() : null;
  if (!pid) {
    const noProj = (typeof window.t === 'function' ? window.t('ui.noActiveProject', 'No active project') : 'No active project');
    if (ctx) ctx.innerHTML = '<i class="fas fa-circle-info"></i> ' + noProj;
    planningBox.innerHTML = '<p style="color:var(--gray);font-size:11px;text-align:center;padding:12px 0;font-style:italic">' + noProj + '</p>';
    if (planningCount) planningCount.textContent = '(0)';
    otherBox.innerHTML = '<p style="color:var(--gray);font-size:11px;text-align:center;padding:12px 0;font-style:italic">' + (typeof window.t === 'function' ? window.t('ui.selectProject', 'Select a project') : 'Select a project') + '</p>';
    if (otherCount) otherCount.textContent = '(0)';
    if (dirBox) dirBox.style.display = 'none';
    return;
  }

  try {
    const data = await fetchProjectFilesSnapshot(pid, { force: false });
    const files = Array.isArray(data.files) ? data.files : [];
    if (ctx) {
      const pname = (data.project && data.project.name) ? data.project.name : pid;
      ctx.innerHTML = `<i class="fas fa-folder-tree"></i> Projeto: <strong style="color:var(--white)">${escapeHtml(pname)}</strong>`;
    }

    // Planning files take priority; match by base name (router handles root/various folders).
    const planning = [];
    const others = [];
    const remaining = files.filter((f) => {
      const base = String(f.name || '').split('/').pop();
      const hit = _PLANNING_FILES.find((p) => p.name === base);
      if (hit) { planning.push(Object.assign({}, hit, f)); return false; }
      return true;
    });
    others.push.apply(others, remaining);

    planningBox.innerHTML = planning.length
      ? planning.map((f) => _arquivosFileRow(f.name, f.label || f.name.split('/').pop(), {
          size: f.size, color: f.color, icon: f.icon, section: 'planejamento',
        })).join('')
      : '<p style="color:var(--gray);font-size:11px;text-align:center;padding:12px 0;font-style:italic">Planejamento vazio</p>';
    if (planningCount) planningCount.textContent = `(${planning.length}/4)`;

    otherBox.innerHTML = others.length
      ? others.map((f) => _arquivosFileRow(f.name, f.name.split('/').pop(), {
          size: f.size, section: String(f.name || '').includes('/') ? f.name.split('/')[0] : 'projeto',
        })).join('')
      : '<p style="color:var(--gray);font-size:11px;text-align:center;padding:12px 0;font-style:italic">Nenhum outro arquivo</p>';
    if (otherCount) otherCount.textContent = `(${others.length})`;

    // Direction summary: pull first meaningful line from progress.md / task_plan.md.
    let direction = null;
    const cand = planning.find((f) => f.name.endsWith('progress.md')) || planning.find((f) => f.name.endsWith('task_plan.md'));
    if (cand) {
      try {
        const r = await fetch(`${window.API_BASE || ''}/api/projects/${encodeURIComponent(pid)}/raw?path=${encodeURIComponent(cand.name)}`);
        if (r.ok) {
          const txt = await r.text();
          const lines = txt.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#') && !l.startsWith('<!--') && !l.startsWith('<'));
          direction = lines.slice(0, 3).join(' · ') || null;
        }
      } catch (_e) { /* tolerate */ }
    }
    if (dirBox && dirText) {
      if (direction) { dirText.textContent = direction; dirBox.style.display = ''; }
      else { dirBox.style.display = 'none'; }
    }
  } catch (e) {
    planningBox.innerHTML = `<p style="color:var(--red);font-size:11px;text-align:center;padding:12px 0">Falha ao carregar: ${_arquivosEscapeAttr(e.message || e)}</p>`;
    if (ctx) ctx.innerHTML = '<i class="fas fa-triangle-exclamation" style="color:var(--red)"></i> Erro ao carregar arquivos';
  }
}

window.loadProjects = loadProjects;
window.createProject = createProject;
window.selectProject = selectProject;
window.getCurrentProjectId = getCurrentProjectId;
window.refreshProjectIndex = refreshProjectIndex;
window.triggerProjectUpload = triggerProjectUpload;
window.uploadProjectFiles = uploadProjectFiles;
window.loadProjectFiles = loadProjectFiles;
window.syncProjectFromAgent = syncProjectFromAgent;
window.attachAgentToProject = attachAgentToProject;
window.onProjectUploadTargetChanged = onProjectUploadTargetChanged;
window.exportProject = exportProject;
window.archiveProject = archiveProject;
window.deleteProject = deleteProject;
window.fetchProjectFilesSnapshot = fetchProjectFilesSnapshot;
window.clearProjectFilesSnapshotCache = _clearProjectFilesCache;
window.renderArquivosPanel = renderArquivosPanel;
window.refreshArquivosPanel = refreshArquivosPanel;

// Keep the Arquivos tab fresh when it becomes visible (server-injected
// switchSidebarTab has no local hook, so we observe tab clicks/labels).
function initArquivosPanel() {
  if (typeof window.__arquivosPanelInited !== 'undefined') return;
  window.__arquivosPanelInited = true;

  // First render once projects are loaded.
  setTimeout(() => { try { renderArquivosPanel(); } catch (_e) {} }, 0);

  // Refresh when the "Arquivos" tab is clicked.
  document.addEventListener('click', (e) => {
    const tab = e.target && e.target.closest ? e.target.closest('.sidebar-tab, .tree-leaf') : null;
    if (!tab) return;
    const label = (tab.getAttribute('data-label') || '').trim();
    if (label === 'Arquivos' || (tab.getAttribute('onclick') || '').indexOf("'files'") > -1) {
      setTimeout(() => { try { renderArquivosPanel(); } catch (_e) {} }, 0);
    }
  }, true);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initArquivosPanel);
} else {
  initArquivosPanel();
}

document.addEventListener('DOMContentLoaded', function() {
  if (window.OliviaLegal_EMBED_MODE) return;
  _setProjectActionState();
  _initProjectUploadTargetInput();
  loadProjects();
});
