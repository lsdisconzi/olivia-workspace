/* ═══════════════════════════════════════════════════════════════════
   SHARED MODULE - Shared resource file selection, common UI state helpers
   ═══════════════════════════════════════════════════════════════════ */

// Shared global variables
var _checkedShared = window._checkedShared || new Map();
window._checkedShared = _checkedShared;
var _importedFiles = window._importedFiles || new Map();
window._importedFiles = _importedFiles;
let _sharedDataTree = null;
const CASE_UPLOAD_TARGET_STORAGE_KEY = 'OliviaLegal.case.upload.target.subpath';

// ── Session state persistence (6.2) ───────────────────────────────
const SESSION_STATE_FILE = 'data/session_state.json';
let _sessionStateSaveTimer = null;
let _sessionStateFilter = '';    // current search/filter text (6.4)
let _sessionStateSort = 'recent'; // 'recent' | 'name' | 'size' (6.4)
let _sessionIndexSyncedAt = null;

// ── Session context tracking (6.3) ────────────────────────────────
// Tracks which imported files are checked as context for the AI
var _contextSessionFiles = window._contextSessionFiles || new Map();
window._contextSessionFiles = _contextSessionFiles;

// Tracks which imported files have checkboxes selected for bulk actions (6.6)
var _sessionBulkSelection = window._sessionBulkSelection || new Set();
window._sessionBulkSelection = _sessionBulkSelection;

// Serialize _importedFiles to a persistable JSON payload
function _sessionStateSerialize() {
  const entries = [];
  for (const [name, file] of _importedFiles) {
    if (!file) continue;
    // Only persist text content and server-referenced files; skip blob-only entries
    const entry = {
      name: file.name,
      size: file.size,
      type: file.type || '',
      mimeType: file.mimeType || '',
      previewType: file.previewType || '',
      contextEligible: !!file.contextEligible,
      projectId: file.projectId || '',
      projectPath: file.projectPath || '',
      serverUrl: file.serverUrl || '',
      savedAt: file.savedAt || Date.now(),
      inContext: !!_contextSessionFiles.get(name),
    };
    // Persist text content only for text-type files
    if (file.type === 'text' && file.content && typeof file.content === 'string') {
      entry.content = file.content;
    }
    entries.push(entry);
  }
  return { version: 1, saved_at: new Date().toISOString(), files: entries };
}

// Debounced save of session state to project data/
function _sessionStateScheduleSave() {
  if (_sessionStateSaveTimer) clearTimeout(_sessionStateSaveTimer);
  _sessionStateSaveTimer = setTimeout(() => {
    _sessionStateSaveTimer = null;
    _sessionStateSaveNow();
  }, 1200);
}
window._sessionStateScheduleSave = _sessionStateScheduleSave;

async function _sessionStateSaveNow() {
  const pid = (typeof getCurrentProjectId === 'function') ? getCurrentProjectId() : null;
  if (!pid) return;
  const payload = _sessionStateSerialize();
  if (!payload.files.length) {
    // Don't save empty state — just return
    return;
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const fd = new FormData();
  fd.append('files', blob, 'session_state.json');
  try {
    await fetch(`${API_BASE}/api/projects/${encodeURIComponent(pid)}/upload?section=data`, {
      method: 'POST', body: fd
    });
  } catch (_e) {
    // Silently fail — persistence is best-effort
  }
}
window._sessionStateSaveNow = _sessionStateSaveNow;

// Load session state from project data/ and hydrate _importedFiles
async function _sessionStateHydrate(pid) {
  if (!pid) return;
  try {
    const res = await fetch(`${API_BASE}/api/projects/${encodeURIComponent(pid)}/raw?path=${encodeURIComponent(SESSION_STATE_FILE)}`);
    if (!res.ok) return;
    const data = await res.json();
    if (!data || !Array.isArray(data.files)) return;
    for (const entry of data.files) {
      if (!entry || !entry.name) continue;
      if (_importedFiles.has(entry.name)) continue; // don't overwrite existing
      const fileInfo = {
        name: entry.name,
        size: entry.size || 0,
        type: entry.type || 'text',
        mimeType: entry.mimeType || '',
        previewType: entry.previewType || '',
        contextEligible: !!entry.contextEligible,
        projectId: entry.projectId || '',
        projectPath: entry.projectPath || '',
        serverUrl: entry.serverUrl || '',
        savedAt: entry.savedAt || Date.now(),
      };
      if (entry.content && typeof entry.content === 'string') {
        fileInfo.content = entry.content;
      }
      _importedFiles.set(entry.name, fileInfo);
      if (entry.inContext) {
        _contextSessionFiles.set(entry.name, true);
      }
    }
    // Refresh UI after hydration
    renderSessionFiles();
    updateComposeContextBar();
  } catch (_e) {
    // Silently fail — hydration is best-effort
  }
}
window._sessionStateHydrate = _sessionStateHydrate;

// ── Filter & Sort helpers (6.4) ──────────────────────────────────
function _sessionSetFilter(text) {
  _sessionStateFilter = (text || '').trim().toLowerCase();
  renderSessionFiles();
}
window._sessionSetFilter = _sessionSetFilter;

function _sessionSetSort(mode) {
  if (!['recent', 'name', 'size'].includes(mode)) mode = 'recent';
  _sessionStateSort = mode;
  renderSessionFiles();
  // Update toggle button visuals
  document.querySelectorAll('.ss-sort-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.sort === mode);
  });
}
window._sessionSetSort = _sessionSetSort;

function _sessionApplyFilterSort(files) {
  let result = Array.from(files);
  // Filter
  if (_sessionStateFilter) {
    result = result.filter(f => f.name.toLowerCase().includes(_sessionStateFilter));
  }
  // Sort
  if (_sessionStateSort === 'name') {
    result.sort((a, b) => a.name.localeCompare(b.name));
  } else if (_sessionStateSort === 'size') {
    result.sort((a, b) => (b.size || 0) - (a.size || 0));
  } else {
    // 'recent' — most recently added first (by insertion order, reversed)
    result.reverse();
  }
  return result;
}

function _sessionFriendlyTime(ts) {
  if (!ts) return '';
  const diff = Date.now() - (typeof ts === 'number' ? ts : new Date(ts).getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins}m atrás`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h atrás`;
}

function _sessionRefreshStaleness() {
  _sessionIndexSyncedAt = Date.now();
  const el = document.getElementById('tabFilesStaleness');
  if (el) el.textContent = 'index synced just now';
}
window._sessionRefreshStaleness = _sessionRefreshStaleness;

// ── Context toggle for session files (6.3) ────────────────────────
function _sessionToggleContext(name) {
  if (!name) return;
  if (_contextSessionFiles.has(name)) {
    _contextSessionFiles.delete(name);
  } else {
    _contextSessionFiles.set(name, true);
  }
  renderSessionFiles();
  updateComposeContextBar();
  _sessionStateScheduleSave();
}
window._sessionToggleContext = _sessionToggleContext;

function _sessionIsInContext(name) {
  return _contextSessionFiles.has(name);
}

// ── Bulk actions (6.6) ────────────────────────────────────────────
function _sessionToggleBulk(name) {
  if (!name) return;
  if (_sessionBulkSelection.has(name)) {
    _sessionBulkSelection.delete(name);
  } else {
    _sessionBulkSelection.add(name);
  }
  _sessionUpdateBulkBar();
  // Update row visual without full re-render
  const row = document.querySelector(`[data-session-file="${CSS.escape(name)}"]`);
  if (row) row.classList.toggle('selected', _sessionBulkSelection.has(name));
}
window._sessionToggleBulk = _sessionToggleBulk;

function _sessionUpdateBulkBar() {
  const bar = document.getElementById('tabFilesBulkBar');
  const countEl = document.getElementById('tabFilesBulkCount');
  if (!bar || !countEl) return;
  const count = _sessionBulkSelection.size;
  if (count === 0) {
    bar.style.display = 'none';
    return;
  }
  bar.style.display = 'flex';
  countEl.textContent = count + ' selected';
}

function _sessionBulkAttach() {
  const count = _sessionBulkSelection.size;
  _sessionBulkSelection.forEach(name => {
    _contextSessionFiles.set(name, true);
  });
  _sessionBulkSelection.clear();
  _sessionUpdateBulkBar();
  renderSessionFiles();
  updateComposeContextBar();
  _sessionStateScheduleSave();
  addSystemBubble(count + ' file(s) added to context');
}
window._sessionBulkAttach = _sessionBulkAttach;

function _sessionBulkDelete() {
  if (_sessionBulkSelection.size === 0) return;
  const count = _sessionBulkSelection.size;
  _sessionBulkSelection.forEach(name => {
    const file = _importedFiles.get(name);
    if (file && file.url && String(file.url).startsWith('blob:')) {
      try { URL.revokeObjectURL(file.url); } catch (_) {}
    }
    _importedFiles.delete(name);
    _contextSessionFiles.delete(name);
  });
  _sessionBulkSelection.clear();
  _sessionUpdateBulkBar();
  renderSessionFiles();
  updateComposeContextBar();
  _sessionStateScheduleSave();
  addSystemBubble(count + ' file(s) removed');
}
window._sessionBulkDelete = _sessionBulkDelete;

// ── Bulk Download (new) ────────────────────────────────────────────
function _sessionBulkDownload() {
  if (_sessionBulkSelection.size === 0) return;
  const files = Array.from(_sessionBulkSelection).map(name => _importedFiles.get(name)).filter(Boolean);

  if (files.length === 1) {
    // Single file - direct download
    const file = files[0];
    _downloadFile(file);
    return;
  }

  // Multiple files - download sequentially with small delays
  files.forEach((file, index) => {
    setTimeout(() => {
      _downloadFile(file);
    }, index * 200); // Stagger downloads
  });
  addSystemBubble('Downloading ' + files.length + ' file(s)...');
}
window._sessionBulkDownload = _sessionBulkDownload;

// Helper to download a single file (handles blob URLs, server URLs, and text content)
function _downloadFile(file) {
  if (!file) return;

  // If file has a server URL, use that directly
  if (file.serverUrl) {
    const link = document.createElement('a');
    link.href = file.serverUrl;
    link.download = file.name;
    link.click();
    return;
  }

  // If file has a blob URL, use that
  if (file.url && file.url.startsWith('blob:')) {
    const link = document.createElement('a');
    link.href = file.url;
    link.download = file.name;
    link.click();
    return;
  }

  // If file has text content, create a blob and download
  if (file.content !== undefined && file.content !== null) {
    const blob = new Blob([file.content], { type: file.type || 'application/octet-stream' });
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = file.name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    return;
  }

  // Fallback: try serverUrl if available
  if (file.serverUrl) {
    const link = document.createElement('a');
    link.href = file.serverUrl;
    link.download = file.name;
    link.click();
  }
}

function _isImageContextFile(file) {
  const mimeType = String(file && file.type || '').toLowerCase();
  const fileName = String(file && file.name || '');
  return mimeType.startsWith('image/')
    || /\.(png|jpe?g|gif|webp|svg|bmp|tiff?)$/i.test(fileName);
}

function _buildProjectUploadRawUrl(projectId, relPath) {
  const pid = String(projectId || '').trim();
  const rel = String(relPath || '').replace(/^\/+/, '').trim();
  if (!pid || !rel) return '';
  return `${API_BASE}/api/projects/${encodeURIComponent(pid)}/raw?path=${encodeURIComponent(rel)}`;
}

function _safeImageFilename(prefix, mimeType) {
  const type = String(mimeType || '').toLowerCase();
  let ext = 'png';
  if (type.includes('jpeg') || type.includes('jpg')) ext = 'jpg';
  else if (type.includes('webp')) ext = 'webp';
  else if (type.includes('gif')) ext = 'gif';
  else if (type.includes('svg')) ext = 'svg';
  const stamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
  return `${prefix}_${stamp}.${ext}`;
}

function _normalizeCaseUploadSubpath(raw) {
  let value = String(raw || '').trim().replace(/\\/g, '/');
  if (!value) return '';
  value = value.replace(/^\/+/, '').replace(/\/+/g, '/');
  value = value.replace(/^case_files\/?/i, '');
  const parts = value.split('/').filter(part => part && part !== '.' && part !== '..');
  return parts.join('/');
}

function _normalizeSectionPath(raw) {
  const value = String(raw || '').trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  return value || 'case_files';
}

function _resolveCaseUploadSection(baseSection) {
  const base = _normalizeSectionPath(baseSection || 'case_files');
  const input = document.getElementById('caseUploadTargetPath');
  const subpath = _normalizeCaseUploadSubpath(input ? input.value : '');
  return subpath ? `${base}/${subpath}` : base;
}

function _refreshCaseUploadTargetHint(baseSection) {
  const hint = document.getElementById('caseUploadTargetResolved');
  if (!hint) return;
  const section = _resolveCaseUploadSection(baseSection || 'case_files');
  hint.textContent = `Destino final no projeto: ${section}/`;
}

function onCaseUploadTargetChanged(rawValue) {
  const normalized = _normalizeCaseUploadSubpath(rawValue);
  try {
    localStorage.setItem(CASE_UPLOAD_TARGET_STORAGE_KEY, normalized);
  } catch (_e) {}
  const caseProfile = _getSectionProfile('case', 'case_files');
  _refreshCaseUploadTargetHint(caseProfile.workspace_folder || 'case_files');
}

function _initCaseUploadTargetInput() {
  const input = document.getElementById('caseUploadTargetPath');
  if (!input) return;
  let saved = '';
  try {
    saved = String(localStorage.getItem(CASE_UPLOAD_TARGET_STORAGE_KEY) || '');
  } catch (_e) {
    saved = '';
  }
  input.value = _normalizeCaseUploadSubpath(saved);
  const caseProfile = _getSectionProfile('case', 'case_files');
  _refreshCaseUploadTargetHint(caseProfile.workspace_folder || 'case_files');
}

function refreshCaseUploadTargetPath() {
  const caseProfile = _getSectionProfile('case', 'case_files');
  _refreshCaseUploadTargetHint(caseProfile.workspace_folder || 'case_files');
}

// Get imported files context
function getImportedFilesContext() {
  if (_importedFiles.size === 0) return '';
  const textParts = [];
  const imageParts = [];
  for (const [name, info] of _importedFiles) {
    if (info.type === 'text' && info.content) {
      textParts.push(`--- ${name} (${(info.size/1024).toFixed(1)} KB) ---\n${info.content}`);
      continue;
    }

    const isImage = info.type === 'image' || info.previewType === 'image';
    if (isImage && info.contextEligible !== false) {
      const sizeKb = Number(info.size || 0) > 0 ? (Number(info.size) / 1024).toFixed(1) : '0.0';
      const mime = String(info.mimeType || 'image').trim();
      const imageUrl = String(info.serverUrl || '').trim();
      const uploadState = info.uploadPending
        ? 'uploading'
        : (imageUrl ? 'ready' : 'local-only');
      imageParts.push([
        `- ${name} (${sizeKb} KB, ${mime}, ${uploadState})`,
        imageUrl ? `  url: ${imageUrl}` : '  url: unavailable',
        '  note: imagem anexada pelo usuario para analise visual (UI, layout, destaque/selecoes).',
      ].join('\n'));
    }
  }
  const blocks = [];
  if (textParts.length > 0) {
    blocks.push(`[CONTEXT FROM IMPORTED TEXT FILES (${textParts.length} file${textParts.length !== 1 ? 's' : ''})]\n\n${textParts.join('\n\n')}`);
  }
  if (imageParts.length > 0) {
    blocks.push(`[VISUAL CONTEXT FROM ATTACHED IMAGES (${imageParts.length} item${imageParts.length !== 1 ? 's' : ''})]\n${imageParts.join('\n')}`);
  }
  if (blocks.length === 0) return '';
  return `\n\n${blocks.join('\n\n')}`;
}

// Get shared context
async function getSharedContext() {
  /** Fetch content of all checked _shared files and return as a formatted context string. */
  if (_checkedShared.size === 0) return '';
  const parts = [];
  for (const [path, info] of _checkedShared) {
    try {
      if (info && typeof info.inlineText === 'string' && info.inlineText) {
        const inlineLabel = (info && info.name) ? info.name : path;
        parts.push(`--- ${inlineLabel} (${path}) ---\n${info.inlineText}`);
        continue;
      }
      // Article entries have inline text — no server fetch needed
      if (path.startsWith('article:') && info.articleText) {
        parts.push(`--- ${info.name} (${path}) ---\n${info.articleText}`);
        continue;
      }
      const targetPath = (info && info.path) ? String(info.path) : (path.startsWith('article:') ? '' : path);
      if (!targetPath) continue;
      const res = await fetch(`${API_BASE}/api/shared/file-content?path=${encodeURIComponent(targetPath)}`);
      if (!res.ok) continue;
      const data = await res.json().catch(() => ({}));
      const text = data.content || '';
      if (!text) continue;
      const label = (info && info.name) ? info.name : (targetPath.split('/').pop() || targetPath);
      parts.push(`--- ${label} (${targetPath}) ---\n${text}`);
    } catch(e) { /* skip failed loads */ }
  }
  if (!parts.length) return '';
  return `\n\n[CONTEXT FROM _SHARED DATA (${parts.length} file${parts.length !== 1 ? 's' : ''})]\n\n${parts.join('\n\n')}`;
}

function updateSharedContextBar() {
  const total = _checkedShared.size;
  const num = document.getElementById('sharedContextNum');
  const bar = document.getElementById('sharedContextBar');
  if (num) num.textContent = String(total);
  if (bar) bar.classList.toggle('empty', total === 0);
}

function addSharedContextItem(item) {
  const entry = (item && typeof item === 'object') ? item : {};
  const key = String(entry.key || '').trim();
  if (!key) return false;

  const payload = {
    section: String(entry.section || 'shared').trim() || 'shared',
    name: String(entry.title || entry.name || key).trim() || key,
    inlineText: String(entry.inlineText || '').trim(),
    path: String(entry.path || '').trim(),
    articleText: String(entry.articleText || '').trim(),
  };

  if (typeof _checkedShared.set === 'function') {
    _checkedShared.set(key, payload);
  } else {
    _checkedShared[key] = payload;
  }

  updateSharedContextBar();
  if (typeof updateComposeContextBar === 'function') updateComposeContextBar();
  if (typeof window.oliviaRefreshSectionRuntimeUi === 'function') {
    try { window.oliviaRefreshSectionRuntimeUi(); } catch (_e) {}
  }
  return true;
}

// Add artifact to context
function addArtifactToContext(artifactId) {
  const art = outputArtifacts.find(a => a.id === artifactId);
  if (!art || !art.raw) {
    addSystemBubble('Artefato não tem conteúdo de texto para adicionar ao contexto.');
    return;
  }
  
  // Add to imported files with a unique name
  const contextName = `[Generated] ${art.name}`;
  _importedFiles.set(contextName, {
    name: contextName,
    content: art.raw,
    size: new Blob([art.raw]).size
  });
  
  updateComposeContextBar();
  renderSessionFiles();
  addSystemBubble(`Artefato "${art.name}" adicionado ao contexto como "${contextName}"`);
}

// Add transcript to context
async function addTranscriptToContext(filename) {
  try {
    const res = await fetch(`${API_BASE}/api/transcripts/list`);
    if (!res.ok) throw new Error('Failed to fetch transcript data');
    
    const data = await res.json();
    const transcript = data.transcripts.find(t => t.filename === filename);
    if (!transcript) throw new Error('Transcript not found');
    
    // Fetch the full transcript file
    const fileRes = await fetch(`${API_BASE}/api/shared/file?path=${encodeURIComponent(transcript.path)}`);
    if (!fileRes.ok) throw new Error('Failed to fetch transcript file');
    
    const transcriptData = await fileRes.json();
    
    // Format transcript as text for context
    let textContent = `Transcrição: ${transcript.original_filename}\n`;
    textContent += `Duração: ${formatDuration(transcript.duration)}\n`;
    textContent += `Idioma: ${transcript.language}\n`;
    textContent += `Segmentos: ${transcript.segments}\n\n`;
    
    if (transcriptData.segments) {
      textContent += transcriptData.segments.map(seg => {
        const time = formatDuration(seg.start);
        const speaker = seg.speaker || 'UNKNOWN';
        return `[${time}] ${speaker}: ${seg.text}`;
      }).join('\n\n');
    }
    
    // Add to imported files
    const contextName = `[Transcrição] ${transcript.original_filename}`;
    _importedFiles.set(contextName, {
      name: contextName,
      content: textContent,
      size: new Blob([textContent]).size,
      type: 'text'
    });
    
    updateComposeContextBar();
    renderSessionFiles();
    addSystemBubble(`Transcrição "${transcript.original_filename}" adicionada ao contexto`);
  } catch (err) {
    console.error('Failed to add transcript to context:', err);
    addSystemBubble(`Erro ao adicionar transcrição: ${err.message}`);
  }
}

// Clear all shared context
function clearAllSharedContext() {
  _checkedShared.clear();
  document.querySelectorAll('.shared-file-check, .shared-article-check').forEach(cb => { cb.checked = false; });
  document.querySelectorAll('.docs-tree-item.checked, .law-article-item.checked').forEach(el => el.classList.remove('checked'));
  if (typeof window.clearLegalRouterContextState === 'function') window.clearLegalRouterContextState();
  updateSharedContextBar();
  if (typeof updateComposeContextBar === 'function') updateComposeContextBar();
  addSystemBubble('Contexto de _shared limpo.');
}

function _resolveBundleFile(input) {
  if (!input) return null;
  if (typeof Blob !== 'undefined' && input instanceof Blob) return input;
  if (typeof FileList !== 'undefined' && input instanceof FileList) return input[0] || null;
  if (input.target && input.target.files && input.target.files[0]) return input.target.files[0];
  if (input.files && input.files[0]) return input.files[0];
  return null;
}

function _isCaseSystemFile(file) {
  const rel = String((file && (file.webkitRelativePath || file.name)) || '');
  const name = String((file && file.name) || '').trim();
  const normalized = rel.replace(/\\/g, '/');
  if (!name) return true;
  if (name === '.DS_Store' || /^\._/.test(name) || /^~\$/.test(name)) return true;
  if (/(^|\/)__MACOSX(\/|$)/.test(normalized)) return true;
  return false;
}

function _isCaseTextLike(file) {
  const mimeType = String((file && file.type) || '').toLowerCase();
  const fileName = String((file && file.name) || '');
  return mimeType.startsWith('text/')
    || mimeType === 'application/json'
    || mimeType === 'application/xml'
    || mimeType === 'text/csv'
    || /\.(txt|md|markdown|json|jsonl|xml|csv|tsv|html?|css|js|ts|tsx|jsx|py|sh|sql|yaml|yml|toml|ini|cfg|log|env|rst)$/i.test(fileName);
}

function _isCaseDocx(file) {
  const fileName = String((file && file.name) || '');
  const mimeType = String((file && file.type) || '').toLowerCase();
  return /\.docx$/i.test(fileName) || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
}

function _sanitizeCaseIngestContent(value) {
  let text = String(value == null ? '' : value);
  text = text.replace(/\u0000/g, '');
  text = text.replace(/\r\n?/g, '\n');
  return text.trim();
}

function _looksBinaryLikeText(value) {
  const text = String(value == null ? '' : value);
  if (!text) return false;
  if (text.indexOf('PK\u0003\u0004') !== -1) return true;
  if (text.indexOf('\u0000') !== -1) return true;
  const sample = text.slice(0, 2048);
  let control = 0;
  for (let i = 0; i < sample.length; i++) {
    const code = sample.charCodeAt(i);
    if (code < 32 && code !== 9 && code !== 10 && code !== 13) control++;
  }
  return sample.length > 0 && (control / sample.length) > 0.02;
}

// Handle bundle file
function handleBundleFile(bundleInput) {
  const file = _resolveBundleFile(bundleInput);
  const summaryEl = document.getElementById('bundleImportSummary');
  const importBtn = document.getElementById('bundleImportBtn');

  if (!file) {
    if (summaryEl) {
      summaryEl.innerHTML = '<div style="color:var(--red);font-size:12px"><i class="fas fa-exclamation-circle"></i> Selecione um arquivo .json válido.</div>';
    }
    if (importBtn) importBtn.disabled = true;
    return;
  }

  if (!String(file.name || '').toLowerCase().endsWith('.json')) {
    if (summaryEl) {
      summaryEl.innerHTML = '<div style="color:var(--red);font-size:12px"><i class="fas fa-exclamation-circle"></i> Arquivo inválido. Use um bundle .json.</div>';
    }
    if (importBtn) importBtn.disabled = true;
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const content = e.target.result;
      const data = JSON.parse(content);

      // Prefer the richer bundle preview flow defined in agents.js when available.
      if (typeof window.previewBundle === 'function') {
        window.previewBundle(data);
        return;
      }
      
      if (data.type === 'agent-bundle' && data.agent) {
        addSystemBubble(`Importando agente "${data.agent.name || 'bundle'}"...`);
        if (typeof window.previewBundle === 'function') {
          window.previewBundle(data);
        } else {
          addSystemBubble('Estrutura de bundle reconhecida. Use a modal de importação para concluir a criação do agente.');
        }
      } else if (data.type === 'chat-export') {
        addSystemBubble(`Importando histórico de chat (${data.messages?.length || 0} mensagens)...`);
        addSystemBubble('Importação de chat export ainda não está habilitada neste fluxo.');
      } else {
        addSystemBubble('Tipo de bundle não reconhecido');
      }
    } catch (err) {
      if (summaryEl) {
        summaryEl.innerHTML = `<div style="color:var(--red);font-size:12px"><i class="fas fa-exclamation-circle"></i> JSON inválido: ${escapeHtml(err.message)}</div>`;
      }
      if (importBtn) importBtn.disabled = true;
      addSystemBubble(`Erro ao processar arquivo: ${err.message}`);
    }
  };

  reader.onerror = function() {
    if (summaryEl) {
      summaryEl.innerHTML = '<div style="color:var(--red);font-size:12px"><i class="fas fa-exclamation-circle"></i> Falha ao ler arquivo.</div>';
    }
    if (importBtn) importBtn.disabled = true;
    addSystemBubble('Erro ao ler arquivo de bundle.');
  };

  reader.readAsText(file);
}

// Handle case files
function handleCaseFiles(files) {
  if (!files || !files.length) return;
  
  Array.from(files).forEach(file => {
    if (_isCaseSystemFile(file)) {
      addSystemBubble(`Arquivo de sistema ignorado: ${file.name}`);
      return;
    }

    const baseCaseFile = {
      name: file.name,
      relativePath: file.webkitRelativePath || file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
      _file: file,
      ingestEligible: false,
      ingestReason: 'unsupported',
      content: ''
    };

    if (!caseFiles) caseFiles = [];

    const finalizeCaseFile = function(caseFile, message) {
      caseFiles.push(caseFile);
      renderCaseFiles();
      addSystemBubble(message || `Arquivo de caso "${caseFile.name}" carregado`);
    };

    if (_isCaseTextLike(file)) {
      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          const raw = String((e && e.target && e.target.result) || '');
          const sanitized = _sanitizeCaseIngestContent(raw);
          const caseFile = Object.assign({}, baseCaseFile, {
            content: sanitized,
            ingestEligible: !!sanitized && !_looksBinaryLikeText(sanitized),
            ingestReason: sanitized ? 'text' : 'empty'
          });
          if (_looksBinaryLikeText(sanitized)) {
            caseFile.ingestReason = 'binary-signature';
          }
          finalizeCaseFile(
            caseFile,
            caseFile.ingestEligible
              ? `Arquivo de caso "${file.name}" carregado`
              : `Arquivo de caso "${file.name}" carregado (sem ingestão textual)`
          );
        } catch (err) {
          console.error('Failed to read text case file:', err);
          finalizeCaseFile(
            Object.assign({}, baseCaseFile, { ingestReason: 'read-error' }),
            `Falha ao preparar "${file.name}" para ingestão de texto`
          );
        }
      };
      reader.onerror = function() {
        finalizeCaseFile(
          Object.assign({}, baseCaseFile, { ingestReason: 'read-error' }),
          `Falha ao ler "${file.name}"`
        );
      };
      reader.readAsText(file);
      return;
    }

    if (_isCaseDocx(file)) {
      const reader = new FileReader();
      reader.onload = async function(e) {
        try {
          const buffer = e && e.target ? e.target.result : null;
          if (window.mammoth && typeof window.mammoth.extractRawText === 'function' && buffer) {
            const extracted = await window.mammoth.extractRawText({ arrayBuffer: buffer });
            const text = _sanitizeCaseIngestContent((extracted && extracted.value) || '');
            finalizeCaseFile(
              Object.assign({}, baseCaseFile, {
                content: text,
                ingestEligible: !!text,
                ingestReason: text ? 'docx-text' : 'docx-empty'
              }),
              text
                ? `Arquivo DOCX "${file.name}" carregado e extraído`
                : `Arquivo DOCX "${file.name}" carregado (sem texto extraível)`
            );
            return;
          }
          finalizeCaseFile(
            Object.assign({}, baseCaseFile, { ingestReason: 'docx-parser-unavailable' }),
            `Arquivo DOCX "${file.name}" carregado (parser indisponível para ingestão)`
          );
        } catch (err) {
          console.error('Failed to extract DOCX text:', err);
          finalizeCaseFile(
            Object.assign({}, baseCaseFile, { ingestReason: 'docx-extract-error' }),
            `Arquivo DOCX "${file.name}" carregado (falha na extração textual)`
          );
        }
      };
      reader.onerror = function() {
        finalizeCaseFile(
          Object.assign({}, baseCaseFile, { ingestReason: 'read-error' }),
          `Falha ao ler DOCX "${file.name}"`
        );
      };
      reader.readAsArrayBuffer(file);
      return;
    }

    finalizeCaseFile(
      Object.assign({}, baseCaseFile, { ingestReason: 'binary-unsupported' }),
      `Arquivo binário "${file.name}" carregado (não será ingerido como texto)`
    );
  });
}

function _getSectionProfile(sectionKey, fallbackFolder) {
  const cfg = (selectedAgent && selectedAgent.config && typeof selectedAgent.config === 'object') ? selectedAgent.config : {};
  const profiles = (cfg.section_profiles && typeof cfg.section_profiles === 'object') ? cfg.section_profiles : {};
  const profile = (profiles[sectionKey] && typeof profiles[sectionKey] === 'object') ? profiles[sectionKey] : {};
  return {
    workspace_folder: String(profile.workspace_folder || fallbackFolder || sectionKey).trim() || sectionKey,
    qdrant_collection: String(profile.qdrant_collection || 'awa_documents').trim() || 'awa_documents',
    graph_enabled: !!profile.graph_enabled
  };
}

async function _uploadCaseFilesToProject(sectionFolder) {
  const projectId = (typeof getCurrentProjectId === 'function') ? getCurrentProjectId() : null;
  if (!projectId) {
    throw new Error('Selecione um projeto ativo antes de processar arquivos do Caso.');
  }
  const fd = new FormData();
  for (const f of (caseFiles || [])) {
    if (f && f._file) fd.append('files', f._file, f.relativePath || f.name || 'file');
  }
  if (!fd.has('files')) return { status: 'empty' };

  const section = _normalizeSectionPath(sectionFolder || 'case_files');
  const res = await fetch(
    `${API_BASE}/api/projects/${encodeURIComponent(projectId)}/upload?section=${encodeURIComponent(section)}&preserve_paths=true`,
    { method: 'POST', body: fd }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || `HTTP ${res.status}`);
  }

  if (selectedAgent && selectedAgent.agent_id) {
    fetch(`${API_BASE}/api/projects/${encodeURIComponent(projectId)}/index/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_id: selectedAgent.agent_id, agent_name: selectedAgent.name || '' })
    }).catch(() => {});
  }
  return data;
}

// Handle context file import
function handleContextFileImport(files) {
  if (!files || !files.length) return;
  const filesArr = Array.from(files);

  const textLikeFile = (file) => {
    const mimeType = String(file && file.type || '').toLowerCase();
    const fileName = String(file && file.name || '');
    return mimeType.startsWith('text/')
      || mimeType === 'application/json'
      || mimeType === 'application/xml'
      || mimeType === 'text/csv'
      || /\.(txt|md|json|yaml|yml|toml|py|js|ts|tsx|jsx|html|htm|css|csv|sh|xml|rst|cfg|ini|log|sql|env)$/i.test(fileName);
  };

  // Prefer the active project as the persistence target so composer uploads
  // land alongside Case/Discovery artifacts and stay visible in the project index.
  // Fall back to the per-agent workspace only when no project is selected.
  const _activeProjectId = (typeof getCurrentProjectId === 'function') ? getCurrentProjectId() : null;
  if (_activeProjectId) {
    const formData = new FormData();
    filesArr.forEach(f => formData.append('files', f, f.webkitRelativePath || f.name));
    fetch(`${API_BASE}/api/projects/${encodeURIComponent(_activeProjectId)}/upload?section=uploads&preserve_paths=true`, {
      method: 'POST',
      body: formData
    }).then(r => r.json()).then(data => {
      if (data && (data.status === 'ok' || Array.isArray(data.uploaded))) {
        const n = (data.uploaded && data.uploaded.length) || (data.count || 0);
        console.log(`[project-upload] Uploaded ${n} file(s) to project ${_activeProjectId}`);
        const uploaded = Array.isArray(data.uploaded) ? data.uploaded.map(v => String(v || '')) : [];
        const urls = Array.isArray(data.urls) ? data.urls.map(v => String(v || '')) : [];
        if (uploaded.length) {
          const queue = uploaded.slice();
          filesArr.forEach((file) => {
            if (!_isImageContextFile(file)) return;
            let relPath = '';
            const byExact = queue.findIndex(item => item === (file.webkitRelativePath || file.name));
            if (byExact >= 0) {
              relPath = queue.splice(byExact, 1)[0] || '';
            } else {
              const byName = queue.findIndex(item => String(item || '').split('/').pop().toLowerCase() === String(file.name || '').toLowerCase());
              if (byName >= 0) relPath = queue.splice(byName, 1)[0] || '';
            }
            const fallbackRel = relPath || file.name;
            const projectPath = `uploads/${String(fallbackRel || '').replace(/^\/+/, '')}`;
            const responseIdx = uploaded.indexOf(fallbackRel);
            const serverUrl = (responseIdx >= 0 && urls[responseIdx])
              ? urls[responseIdx]
              : _buildProjectUploadRawUrl(_activeProjectId, projectPath);
            const existing = _importedFiles.get(file.name);
            if (existing) {
              existing.projectId = _activeProjectId;
              existing.projectPath = projectPath;
              existing.serverUrl = serverUrl || '';
              existing.uploadPending = false;
            }
          });
          updateComposeContextBar();
          renderSessionFiles();
        }
        if (typeof refreshProjectIndex === 'function') refreshProjectIndex(_activeProjectId);
        if (typeof loadProjectFiles === 'function') loadProjectFiles();
      }
    }).catch(err => console.warn('[project-upload] failed:', err));
  } else if (selectedAgent && selectedAgent.agent_id) {
    const formData = new FormData();
    filesArr.forEach(f => formData.append('files', f));
    fetch(`${API_BASE}/api/agents/${selectedAgent.agent_id}/workspace/upload`, {
      method: 'POST',
      body: formData
    }).then(r => r.json()).then(data => {
      if (data.status === 'ok') {
        console.log(`[workspace] Uploaded ${data.uploaded.length} file(s) to agent workspace (no active project):`, data.workspace);
      }
    }).catch(err => console.warn('[workspace] File upload failed:', err));
  }

  filesArr.forEach(file => {
    const previewType = (typeof window.resolvePreviewFileType === 'function')
      ? window.resolvePreviewFileType(file.name, { mimeType: file.type })
      : '';
    const isTextLike = textLikeFile(file);
    const isImage = _isImageContextFile(file) || previewType === 'image';
    const reader = new FileReader();
    reader.onload = function(e) {
      const content = e.target.result;
      const fileInfo = {
        name: file.name,
        size: file.size,
        type: isTextLike ? 'text' : (isImage ? 'image' : 'binary'),
        content: content,
        lastModified: file.lastModified,
        mimeType: file.type || '',
        previewType,
        contextEligible: isTextLike || isImage,
        projectId: _activeProjectId || '',
        savedAt: Date.now(),
      };

      if (isImage && !isTextLike) {
        fileInfo.content = '';
        fileInfo.url = URL.createObjectURL(file);
        fileInfo.uploadPending = !!_activeProjectId;
        const fallbackProjectPath = _activeProjectId ? `uploads/${file.name}` : '';
        fileInfo.projectPath = fallbackProjectPath;
        fileInfo.serverUrl = _activeProjectId
          ? _buildProjectUploadRawUrl(_activeProjectId, fallbackProjectPath)
          : '';
      }

      _importedFiles.set(file.name, fileInfo);
      updateComposeContextBar();
      renderSessionFiles();
      _sessionStateScheduleSave();
      if (isImage && !isTextLike) {
        addSystemBubble(`Imagem "${file.name}" anexada ao contexto visual`);
      } else {
        addSystemBubble(`Arquivo "${file.name}" importado como contexto`);
      }
    };

    if (isTextLike) {
      reader.readAsText(file);
    } else {
      // Binary files - just store metadata
      const fileInfo = {
        name: file.name,
        size: file.size,
        type: isImage ? 'image' : 'binary',
        lastModified: file.lastModified,
        mimeType: file.type || '',
        previewType,
        url: URL.createObjectURL(file),
        contextEligible: !!isImage,
        projectId: _activeProjectId || '',
        uploadPending: !!(_activeProjectId && isImage),
        projectPath: _activeProjectId && isImage ? `uploads/${file.name}` : '',
        serverUrl: (_activeProjectId && isImage)
          ? _buildProjectUploadRawUrl(_activeProjectId, `uploads/${file.name}`)
          : '',
        savedAt: Date.now(),
      };
      _importedFiles.set(file.name, fileInfo);
      updateComposeContextBar();
      renderSessionFiles();
      _sessionStateScheduleSave();
      if (isImage) {
        addSystemBubble(`Imagem "${file.name}" anexada ao contexto visual`);
      } else {
        addSystemBubble(`Arquivo binário "${file.name}" importado (não disponível como contexto)`);
      }
    }
  });
}

function handleChatImageImport(files) {
  if (!files || !files.length) return;
  const images = Array.from(files).filter(_isImageContextFile);
  if (!images.length) {
    addSystemBubble('Nenhuma imagem válida selecionada. Use PNG, JPG, WEBP, GIF ou SVG.');
    return;
  }
  handleContextFileImport(images);
}

async function capturePrintScreenFromClipboard() {
  if (!navigator.clipboard || typeof navigator.clipboard.read !== 'function') {
    addSystemBubble('Clipboard de imagem indisponível no navegador. Use o botão de imagem ou cole (Ctrl/Cmd+V) no chat.');
    return;
  }

  try {
    const clipboardItems = await navigator.clipboard.read();
    const files = [];
    for (const item of clipboardItems) {
      const types = Array.isArray(item.types) ? item.types : [];
      const imageType = types.find(type => String(type || '').toLowerCase().startsWith('image/'));
      if (!imageType) continue;
      const blob = await item.getType(imageType);
      const filename = _safeImageFilename('printscreen', imageType);
      files.push(new File([blob], filename, { type: imageType }));
    }
    if (!files.length) {
      addSystemBubble('Nenhuma imagem encontrada no clipboard. Tire um print e tente novamente.');
      return;
    }
    handleChatImageImport(files);
  } catch (err) {
    addSystemBubble(`Falha ao capturar print do clipboard: ${(err && err.message) || 'erro desconhecido'}`);
  }
}

function _bindChatImagePasteHook() {
  const input = document.getElementById('chatInput');
  if (!input || input.dataset.imagePasteBound === '1') return;
  input.dataset.imagePasteBound = '1';

  input.addEventListener('paste', (event) => {
    const clipboard = event.clipboardData;
    if (!clipboard || !clipboard.items || !clipboard.items.length) return;
    const files = [];
    for (const item of Array.from(clipboard.items)) {
      if (!item || !item.type || !String(item.type).toLowerCase().startsWith('image/')) continue;
      const blob = item.getAsFile();
      if (!blob) continue;
      const filename = _safeImageFilename('pasted_image', item.type);
      files.push(new File([blob], filename, { type: item.type }));
    }
    if (!files.length) return;
    event.preventDefault();
    handleChatImageImport(files);
  });
}

// Handle file upload
function handleFileUpload(files) {
  if (!files || !files.length) return;

  const textLikeFile = (file) => {
    const mimeType = String(file && file.type || '').toLowerCase();
    const fileName = String(file && file.name || '');
    return mimeType.startsWith('text/')
      || mimeType === 'application/json'
      || mimeType === 'application/xml'
      || mimeType === 'text/csv'
      || /\.(txt|md|json|yaml|yml|toml|py|js|ts|tsx|jsx|html|htm|css|csv|sh|xml|rst|cfg|ini|log|sql|env)$/i.test(fileName);
  };
  
  Array.from(files).forEach(file => {
    const previewType = (typeof window.resolvePreviewFileType === 'function')
      ? window.resolvePreviewFileType(file.name, { mimeType: file.type })
      : 'file';
    const isTextLike = textLikeFile(file);
    const reader = new FileReader();
    reader.onload = function(e) {
      const content = e.target.result;
      
      // Determine file type
      let fileType = isTextLike ? 'text' : previewType;
      if (!isTextLike && !fileType) fileType = 'binary';
      
      const fileInfo = {
        name: file.name,
        size: file.size,
        type: fileType,
        content: content,
        lastModified: file.lastModified
      };
      
      // Add to appropriate storage
      if (fileType === 'text') {
        _importedFiles.set(file.name, fileInfo);
        updateComposeContextBar();
        renderSessionFiles();
        addSystemBubble(`Arquivo "${file.name}" importado como contexto`);
      } else {
        // Non-text files go to output artifacts
        const artifactId = 'file-' + Date.now();
        const blob = new Blob([content], { type: file.type || 'application/octet-stream' });
        const artifact = {
          id: artifactId,
          name: file.name,
          title: file.name,
          type: previewType || fileType,
          size: file.size,
          content: content,
          raw: fileType === 'text' ? content : null,
          content_type: file.type,
          blob,
          url: URL.createObjectURL(blob)
        };
        addOutputArtifact(artifact);
        addSystemBubble(`Arquivo "${file.name}" adicionado como artefato`);
      }
    };
    
    if (isTextLike || !file.type) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  });
}

// Preview shared file
async function previewSharedFile(path, name) {
  const url = `${API_BASE}/api/shared/raw?path=${encodeURIComponent(path)}`;
  const fileType = (typeof window.resolvePreviewFileType === 'function')
    ? window.resolvePreviewFileType(name || path)
    : undefined;
  let companion = null;
  if ((fileType === 'docx' || fileType === 'doc') && typeof window.resolveSharedDocCompanion === 'function') {
    try {
      companion = await window.resolveSharedDocCompanion(path);
    } catch (_) {
      companion = null;
    }
  }
  if (typeof openPreviewUrl === 'function') {
    return openPreviewUrl(url, name || path.split('/').pop() || 'shared-file', {
      fileType,
      sharedPath: path,
      companionPdfUrl: companion && companion.url ? companion.url : '',
      companionPdfName: companion && companion.name ? companion.name : '',
    });
  }
}

function previewImportedWorkspaceFile(name) {
  const file = _importedFiles.get(name);
  if (!file) return;

  if (file.type === 'text' && file.content) {
    return _openImportedFileInPreview(name);
  }

  const previewUrl = file.serverUrl || file.url || '';
  if (previewUrl && typeof openPreviewUrl === 'function') {
    return openPreviewUrl(previewUrl, file.name || name, {
      fileType: file.previewType || file.type,
      mimeType: file.mimeType,
      size: file.size,
    });
  }

  return viewImportedFile(name);
}

// Render case files
function renderCaseFiles() {
  const container = document.getElementById('caseFileList');
  const actions   = document.getElementById('caseActions');
  if (!container) return;

  if (!caseFiles || caseFiles.length === 0) {
    container.innerHTML = '';
    if (actions) actions.style.display = 'none';
    return;
  }

  const html = caseFiles.map((file, i) => {
    const ext  = (file.name.split('.').pop() || '').toLowerCase();
    const icon = ['pdf'].includes(ext) ? '📄'
      : ['jpg','jpeg','png','gif','webp'].includes(ext) ? '🖼️'
      : ['mp3','wav','m4a'].includes(ext) ? '🎵' : '📝';
    const label = file.relativePath || file.name;
    return `
      <div style="display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid var(--border);border-radius:5px;margin-bottom:4px;font-size:11px">
        <span style="font-size:14px;flex-shrink:0">${icon}</span>
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--white)" title="${escapeHtml(label)}">${escapeHtml(label)}</span>
        <span style="color:var(--gray);flex-shrink:0">${formatBytes(file.size)}</span>
        <button onclick="removeCaseFile(${i})" style="border:none;background:none;color:var(--gray);cursor:pointer;padding:2px 4px;font-size:11px" title="Remover"><i class="fas fa-times"></i></button>
      </div>
    `;
  }).join('');

  container.innerHTML = html;
  if (actions) actions.style.display = '';
}

// Render session files
function renderSessionFiles() {
  const container = document.getElementById('importedFilesList');
  const countBadge = document.getElementById('importedFilesCount');
  if (countBadge) countBadge.textContent = '(' + _importedFiles.size + ')';
  if (!container) return;

  // Staleness signal (6.8)
  const stalenessEl = document.getElementById('tabFilesStaleness');
  if (stalenessEl) {
    if (_importedFiles.size > 0 && _sessionIndexSyncedAt) {
      stalenessEl.textContent = 'index synced ' + _sessionFriendlyTime(_sessionIndexSyncedAt);
      stalenessEl.style.display = 'block';
    } else {
      stalenessEl.style.display = 'none';
    }
  }

  if (_importedFiles.size === 0) {
    container.innerHTML = '<div class="case-upload-zone" style="cursor:pointer;text-align:center;padding:20px 12px;border:1.5px dashed var(--border);border-radius:8px;background:rgba(255,255,255,0.02);transition:border-color .2s,background .2s" onclick="document.getElementById(\'contextFileInput\').click()" ondragover="event.preventDefault();this.style.borderColor=\'var(--accent)\';this.style.background=\'rgba(90,141,238,0.06)\'" ondragleave="this.style.borderColor=\'var(--border)\';this.style.background=\'rgba(255,255,255,0.02)\'" ondrop="event.preventDefault();event.dataTransfer.files.length && handleContextFileImport(event.dataTransfer.files);this.style.borderColor=\'var(--border)\';this.style.background=\'rgba(255,255,255,0.02)\'">'
      + '<div style="font-size:24px;color:var(--gray);margin-bottom:8px"><i class="fas fa-cloud-arrow-up"></i></div>'
      + '<div style="font-size:12px;font-weight:600;color:var(--white);margin-bottom:4px">Nenhum arquivo importado ainda</div>'
      + '<div style="font-size:10px;color:var(--gray);margin-bottom:10px">Arraste arquivos aqui ou clique para selecionar</div>'
      + '<div style="font-size:9px;color:var(--gray);opacity:.6">PDFs · imagens · documentos · código</div>'
      + '</div>';
    // Hide filter bar when empty
    const filterBar = document.getElementById('tabFilesFilterBar');
    if (filterBar) filterBar.style.display = 'none';
    return;
  }

  // Show filter bar when files exist (6.4)
  const filterBar = document.getElementById('tabFilesFilterBar');
  if (filterBar) filterBar.style.display = 'flex';

  // Apply filter + sort (6.4)
  const files = _sessionApplyFilterSort(_importedFiles.values());

  const html = files.map(file => {
    const safeName = file.name;
    const safeId = JSON.stringify(safeName);
    const clickJs = `previewImportedWorkspaceFile(${safeId})`;
    const ext  = (safeName.split('.').pop() || '').toLowerCase();
    const isImage = file.type === 'image' || file.previewType === 'image';

    // Richer type icon (6.5)
    let icon;
    if (isImage) icon = '<i class="fas fa-image" style="color:var(--green)"></i>';
    else if (['pdf'].includes(ext)) icon = '<i class="fas fa-file-pdf" style="color:var(--red)"></i>';
    else if (['doc','docx'].includes(ext)) icon = '<i class="fas fa-file-word" style="color:var(--blue)"></i>';
    else if (['xls','xlsx','csv'].includes(ext)) icon = '<i class="fas fa-file-excel" style="color:var(--green)"></i>';
    else if (['json','js','py','html','css','ts','jsx','tsx','go','rs','rb','php','java','c','cpp','h','hpp'].includes(ext)) icon = '<i class="fas fa-file-code" style="color:var(--amber)"></i>';
    else if (['txt','md'].includes(ext)) icon = '<i class="fas fa-file-lines" style="color:var(--purple)"></i>';
    else if (['mp3','wav','ogg','m4a','flac'].includes(ext)) icon = '<i class="fas fa-file-audio" style="color:var(--cyan)"></i>';
    else if (['mp4','avi','mov','webm'].includes(ext)) icon = '<i class="fas fa-file-video" style="color:var(--pink)"></i>';
    else icon = '<i class="fas fa-file" style="color:var(--gray)"></i>';

    // Section tag (6.5)
    const sectionTag = file.projectPath ? file.projectPath.split('/')[0] : '';
    const sectionHtml = sectionTag
      ? `<span style="font-size:8px;padding:1px 5px;border-radius:3px;background:rgba(255,255,255,.05);color:var(--gray);font-weight:500;flex-shrink:0;text-transform:uppercase">${escapeHtml(sectionTag)}</span>`
      : '';

    // Status dot (6.5)
    const isServerBased = !!file.serverUrl || !!file.projectPath;
    const statusDot = isServerBased
      ? `<span title="Saved to project" style="display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--green);flex-shrink:0"></span>`
      : `<span title="Session only" style="display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--amber);flex-shrink:0"></span>`;

    // Timestamp (6.5)
    const ts = file.savedAt ? _sessionFriendlyTime(file.savedAt) : '';

    // In-context indicator (6.3)
    const inContext = _sessionIsInContext(safeName);
    const contextIndicator = inContext
      ? `<span title="In context" style="font-size:9px;color:var(--purple);flex-shrink:0"><i class="fas fa-brain"></i></span>`
      : '';

    // Bulk checkbox (6.6)
    const isSelected = _sessionBulkSelection.has(safeName);
    const checkedAttr = isSelected ? 'checked' : '';

    return `
      <div data-session-file="${escapeHtml(safeName)}" style="display:flex;align-items:center;gap:5px;padding:4px 6px;border:1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'};border-radius:5px;font-size:11px;cursor:pointer;${isSelected ? 'background:rgba(90,141,238,0.06)' : ''}" onclick="${escapeHtml(clickJs)}" title="${escapeHtml(safeName)}">
        <input type="checkbox" ${checkedAttr} onclick="event.stopPropagation();_sessionToggleBulk(${safeId})" style="flex-shrink:0;cursor:pointer;accent-color:var(--accent)">
        ${statusDot}
        <span style="font-size:12px;flex-shrink:0;width:14px;text-align:center">${icon}</span>
        ${contextIndicator}
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--white)" title="${escapeHtml(safeName)}">${escapeHtml(safeName)}</span>
        ${sectionHtml}
        <span style="color:var(--gray);flex-shrink:0;font-size:10px">${file.size ? formatBytes(file.size) : ''}</span>
        <span style="color:var(--gray);flex-shrink:0;font-size:9px;opacity:.6">${ts}</span>
        <div style="display:flex;gap:3px;flex-shrink:0" onclick="event.stopPropagation()">
          <button style="border:none;background:none;color:var(--purple);cursor:pointer;padding:2px 3px;font-size:9px;opacity:.6" onclick="_sessionToggleContext(${safeId});return false" title="${inContext ? 'Remove from context' : 'Add to context'}"><i class="fas fa-${inContext ? 'brain' : 'circle'}"></i></button>
          <button style="border:none;background:none;color:var(--red);cursor:pointer;padding:2px 3px;font-size:9px;opacity:.6" onclick="removeFileContext(${safeId});return false" title="Remover"><i class="fas fa-trash"></i></button>
        </div>
      </div>`;
  }).join('');
  
  container.innerHTML = html;
}

// Open an in-memory imported file (text content) in the preview panel
function _openImportedFileInPreview(name) {
  const file = _importedFiles.get(name);
  if (!file) return;
  window._previewState = { url: null, name };
  const titleEl = document.getElementById('previewPanelTitle');
  if (titleEl) titleEl.innerHTML = `<i class="fas fa-file-lines" style="margin-right:6px;font-size:12px;color:var(--blue)"></i> ${escapeHtml(name)}`;
  const dlBtn  = document.getElementById('previewDownloadBtn');
  const maxBtn = document.getElementById('previewMaximizeBtn');
  // For inline content, set up a blob URL so download/maximize work
  const blob    = new Blob([file.content], { type: 'text/plain' });
  const blobUrl = URL.createObjectURL(blob);
  window._previewState = { url: blobUrl, name, _revokeOnClose: true };
  if (dlBtn)  { dlBtn.style.display = ''; }
  if (maxBtn) { maxBtn.style.display = ''; }
  const body = document.getElementById('previewBody');
  if (!body) return;
  if (typeof window.togglePreviewPanel === 'function') window.togglePreviewPanel(true);
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (ext === 'md' && window.marked) {
    if (typeof window.renderRichMarkdownHtml === 'function') {
      body.innerHTML = `<div class="output-rich-scroll">${window.renderRichMarkdownHtml(file.content, { title: name })}</div>`;
    } else {
      const rendered = marked.parse(file.content);
      body.innerHTML = `<div style="padding:16px;color:var(--text);font-family:var(--font-sans);line-height:1.6;overflow-y:auto;height:100%;box-sizing:border-box;">${rendered}</div>`;
    }
  } else if (['json','js','py','html','css','ts','txt','md'].includes(ext)) {
    if (typeof window.renderRichTextCardHtml === 'function') {
      body.innerHTML = `<div class="output-rich-scroll">${window.renderRichTextCardHtml(file.content, { title: name, kind: ext })}</div>`;
    } else {
      body.innerHTML = `<pre style="padding:16px;margin:0;white-space:pre-wrap;word-break:break-all;font-family:var(--font-mono);font-size:12px;color:var(--text);overflow-y:auto;height:100%;box-sizing:border-box;">${escapeHtml(file.content)}</pre>`;
    }
  } else {
    if (typeof window.renderRichTextCardHtml === 'function') {
      body.innerHTML = `<div class="output-rich-scroll">${window.renderRichTextCardHtml(file.content, { title: name, kind: ext })}</div>`;
    } else {
      body.innerHTML = `<pre style="padding:16px;margin:0;white-space:pre-wrap;font-family:var(--font-mono);font-size:12px;color:var(--text);overflow-y:auto;height:100%;box-sizing:border-box;">${escapeHtml(file.content)}</pre>`;
    }
  }
  if (typeof window.refreshPanelContextStatus === 'function') window.refreshPanelContextStatus();
}

// Select memory files from shared
function selectMemoryFilesFromShared() {
  // This function opens a modal to select files from shared storage for memory ingestion
  const modal = document.getElementById('memoryFileSelectModal');
  if (modal) modal.classList.add('show');
}

// Select memory files from tree
function selectMemoryFilesFromTree() {
  // This function opens the docs tree for file selection for memory ingestion
  const sidebar = document.getElementById('sidebarEl');
  if (sidebar) sidebar.classList.remove('collapsed');
  
  const tabs = document.querySelector('.sidebar-tabs');
  if (tabs) {
    tabs.querySelectorAll('.sidebar-tab-btn').forEach(btn => btn.classList.remove('active'));
    const docsTab = document.querySelector('[data-tab="docs"]');
    if (docsTab) docsTab.classList.add('active');
  }
  
  const contents = document.querySelectorAll('.sidebar-tab-content');
  contents.forEach(c => c.classList.remove('active'));
  const docsContent = document.getElementById('sidebarTab-docs');
  if (docsContent) docsContent.classList.add('active');
}

// View imported file
function viewImportedFile(name) {
  const file = _importedFiles.get(name);
  if (!file) return;
  
  const modal = document.getElementById('importedFileModal');
  const content = document.getElementById('importedFileContent');
  if (!modal || !content) return;
  
  modal.classList.add('show');
  
  if (file.type === 'text' && file.content) {
    content.innerHTML = `
      <div class="imported-file-header">
        <h4>${escapeHtml(name)}</h4>
        <button class="close-btn" onclick="document.getElementById('importedFileModal').classList.remove('show')">&times;</button>
      </div>
      <pre class="imported-file-content">${escapeHtml(file.content)}</pre>
    `;
  } else {
    content.innerHTML = `
      <div class="imported-file-header">
        <h4>${escapeHtml(name)}</h4>
        <button class="close-btn" onclick="document.getElementById('importedFileModal').classList.remove('show')">&times;</button>
      </div>
      <div class="imported-file-binary">
        <p>Arquivo binário (${formatBytes(file.size)})</p>
        <p>Não é possível visualizar conteúdo.</p>
      </div>
    `;
  }
}

// Clear case files
function clearCaseFiles() {
  caseFiles = [];
  renderCaseFiles();
  ['stage-intake','stage-organize','stage-understand','stage-goal','stage-gaps','stage-build','stage-output'].forEach(id => {
    const dot = document.getElementById(id);
    if (dot) dot.className = 'stage-dot';
  });
  const agentActions = document.getElementById('bridgeAgentActions');
  if (agentActions) agentActions.style.display = 'none';
  const results = document.getElementById('bridgeResults');
  if (results) { results.style.display = 'none'; results.innerHTML = ''; }
  const status = document.getElementById('bridgeStatus');
  if (status) status.innerHTML = '';
  addSystemBubble('Todos os arquivos de caso foram removidos');
}

// Clear session files (with confirmation, 6.7)
function clearSessionFiles() {
  // Route through the existing confirm modal
  const overlay = document.getElementById('confirmModalOverlay');
  const modal = document.getElementById('confirmModal');
  const titleEl = document.getElementById('confirmModalTitle');
  const msgEl = document.getElementById('confirmModalMessage');
  const confirmBtn = document.getElementById('confirmModalConfirmBtn');
  const cancelBtn = document.getElementById('confirmModalCancelBtn');
  if (!overlay || !modal || !confirmBtn || !cancelBtn) {
    // Fallback: clear directly if modal elements not found
    _doClearSessionFiles();
    return;
  }

  const t = (k, d) => (typeof window.t === 'function' ? window.t(k, d) : d);
  if (titleEl) titleEl.innerHTML = '<i class="fas fa-trash-can" style="margin-right:6px;color:var(--red)"></i> ' + t('ui.clearSessionTitle', 'Clear all session files?');
  if (msgEl) msgEl.textContent = t('ui.clearSessionBody', 'This will remove all imported files, images, and context from the current session. This action cannot be undone.');

  overlay.style.display = '';
  modal.style.display = '';

  // Remove old listeners by cloning and replacing
  const newConfirm = confirmBtn.cloneNode(true);
  confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);
  const newCancel = cancelBtn.cloneNode(true);
  cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);

  const close = () => {
    overlay.style.display = 'none';
    modal.style.display = 'none';
  };

  newConfirm.addEventListener('click', () => {
    close();
    _doClearSessionFiles();
  });
  newCancel.addEventListener('click', close);
  overlay.addEventListener('click', close, { once: true });
}

// Internal: actually clears session files without confirmation
function _doClearSessionFiles() {
  for (const [, file] of _importedFiles) {
    if (file && file.url && String(file.url).startsWith('blob:')) {
      try { URL.revokeObjectURL(file.url); } catch (_) {}
    }
  }
  _importedFiles.clear();
  _contextSessionFiles.clear();
  _sessionBulkSelection.clear();
  _sessionUpdateBulkBar();
  renderSessionFiles();
  updateComposeContextBar();
  _sessionStateScheduleSave();
  addSystemBubble('Todos os arquivos de sessão foram removidos');
}

// Remove case file
function removeCaseFile(index) {
  if (caseFiles && caseFiles[index]) {
    caseFiles.splice(index, 1);
    renderCaseFiles();
    addSystemBubble('Arquivo de caso removido');
  }
}

// Remove file context
function removeFileContext(name) {
  if (_importedFiles.has(name)) {
    const file = _importedFiles.get(name);
    if (file && file.url && String(file.url).startsWith('blob:')) {
      try { URL.revokeObjectURL(file.url); } catch (_) {}
    }
    _importedFiles.delete(name);
    _contextSessionFiles.delete(name);
    _sessionBulkSelection.delete(name);
    _sessionUpdateBulkBar();
    renderSessionFiles();
    updateComposeContextBar();
    _sessionStateScheduleSave();
    addSystemBubble(`Arquivo "${name}" removido do contexto`);
  }
}

// Download file
function downloadFile(path, name) {
  const link = document.createElement('a');
  link.href = path;
  link.download = name || path.split('/').pop();
  link.click();
}

// Handle drag-drop onto the case upload zone
function handleCaseDrop(e) {
  handleCaseFiles(e.dataTransfer.files);
}

// Update a pipeline stage dot — state: 'active' | 'done' | 'error' | ''
function _setCaseStage(id, state) {
  const dot = document.getElementById(id);
  if (!dot) return;
  // CSS classes are: .stage-dot.active, .stage-dot.done (no prefix)
  dot.className = 'stage-dot' + (state ? ' ' + state : '');
}

// Start pipeline: ingest all uploaded case files into Qdrant memory
async function startBridgeScan() {
  if (!caseFiles || caseFiles.length === 0) {
    addSystemBubble('Nenhum arquivo carregado. Selecione arquivos primeiro.');
    return;
  }

  const btn     = document.getElementById('btnScanExtract');
  const status  = document.getElementById('bridgeStatus');
  const results = document.getElementById('bridgeResults');
  const agentAc = document.getElementById('bridgeAgentActions');

  if (btn)     { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando…'; }
  if (results) { results.style.display = 'none'; results.innerHTML = ''; }
  if (agentAc)   agentAc.style.display = 'none';

  const stageIds = ['stage-intake','stage-organize','stage-understand','stage-goal','stage-gaps','stage-build','stage-output'];
  stageIds.forEach(s => _setCaseStage(s, ''));
  const caseProfile = _getSectionProfile('case', 'case_files');
  const caseUploadSection = _resolveCaseUploadSection(caseProfile.workspace_folder || 'case_files');

  function setStatus(msg) {
    if (status) status.innerHTML = `<div style="font-size:11px;color:var(--gray);margin:6px 0">${msg}</div>`;
  }

  try {
    _setCaseStage('stage-intake', 'active');
    setStatus('Recebendo arquivos…');
    await new Promise(r => setTimeout(r, 300));
    _setCaseStage('stage-intake', 'done');

    _setCaseStage('stage-organize', 'active');
    setStatus(`Indexando ${caseFiles.length} arquivo(s)…`);

    try {
      await _uploadCaseFilesToProject(caseUploadSection);
    } catch (uploadErr) {
      throw new Error(`Falha ao salvar arquivos do Caso no projeto: ${uploadErr.message}`);
    }

    let ingested = 0;
    let skipped = 0;
    const skippedNames = [];
    const errors = [];
    for (const f of caseFiles) {
      const normalizedContent = _sanitizeCaseIngestContent(f && f.content);
      const canIngest = !!(f && f.ingestEligible && normalizedContent && !_looksBinaryLikeText(normalizedContent));
      if (!canIngest) {
        skipped++;
        skippedNames.push((f && (f.relativePath || f.name)) || 'arquivo-sem-nome');
        setStatus(`Indexando… ${ingested + skipped + errors.length}/${caseFiles.length}`);
        continue;
      }
      try {
        const res = await fetch(`${API_BASE}/api/memory/ingest`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: normalizedContent,
            source: f.name,
            collection: caseProfile.qdrant_collection,
            metadata: {
              filename: f.name,
              relative_path: f.relativePath || f.name,
              size: f.size,
              type: f.type,
              ingest_mode: f.ingestReason || 'text'
            }
          })
        });
        if (res.ok) ingested++; else errors.push(f.name);
      } catch(e) { errors.push(f.name); }
      setStatus(`Indexando… ${ingested + skipped + errors.length}/${caseFiles.length}`);
    }
    _setCaseStage('stage-organize', ingested === 0 && errors.length > 0 ? 'error' : 'done');

    _setCaseStage('stage-understand', 'active');
    setStatus('Extraindo metadados…');
    await new Promise(r => setTimeout(r, 400));
    _setCaseStage('stage-understand', 'done');

    let graphStatus = 'desativado';
    if (caseProfile.graph_enabled) {
      try {
        const nodes = caseFiles.map((f, idx) => ({
          key: `case_file_${idx}_${f.name}`,
          labels: ['Document', 'CaseFile'],
          properties: {
            filename: f.name,
            size: f.size,
            section: 'case'
          }
        }));
        const graphRes = await fetch(`${API_BASE}/api/memory/graph/ingest`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nodes, relationships: [] })
        });
        graphStatus = graphRes.ok ? 'gerado' : 'falha';
      } catch (_e) {
        graphStatus = 'falha';
      }
    }

    for (const s of ['stage-goal','stage-gaps','stage-build','stage-output']) {
      _setCaseStage(s, 'done');
      await new Promise(r => setTimeout(r, 120));
    }

    if (results) {
      results.innerHTML = `
        <div style="margin-top:10px;padding:10px 12px;border:1px solid var(--border);border-radius:6px;font-size:11px">
          <div style="font-weight:600;color:var(--white);margin-bottom:6px"><i class="fas fa-check-circle" style="color:var(--amber)"></i> Pipeline concluído</div>
          <div style="color:var(--gray)">✓ ${ingested} arquivo(s) ingerido(s) na memória</div>
          ${skipped ? `<div style="color:var(--yellow)">ℹ ${skipped} arquivo(s) pulado(s): ${skippedNames.slice(0, 8).map(n => escapeHtml(n)).join(', ')}${skippedNames.length > 8 ? '…' : ''}</div>` : ''}
          ${errors.length ? `<div style="color:var(--red)">⚠ Erros: ${errors.map(n => escapeHtml(n)).join(', ')}</div>` : ''}
          <div style="color:var(--gray);margin-top:4px">Pasta do projeto: <code style="color:var(--amber)">${escapeHtml(caseUploadSection)}</code></div>
          <div style="color:var(--gray);margin-top:4px">Coleção: <code style="color:var(--amber)">${escapeHtml(caseProfile.qdrant_collection)}</code></div>
          <div style="color:var(--gray);margin-top:4px">Grafo: <code style="color:var(--amber)">${escapeHtml(graphStatus)}</code></div>
        </div>`;
      results.style.display = '';
    }
    if (agentAc) agentAc.style.display = '';
    if (status)  status.innerHTML = '';
    addSystemBubble(`Pipeline concluído: ${ingested} ingerido(s), ${skipped} pulado(s), ${errors.length} com erro.`);

  } catch(err) {
    stageIds.forEach(s => _setCaseStage(s, ''));
    setStatus(`<span style="color:var(--red)">Erro: ${escapeHtml(err.message)}</span>`);
    addSystemBubble(`Erro no pipeline: ${err.message}`);
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i> Escanear &amp; Extrair'; }
  }
}

function _normalizeCasePromptPath(rawPath) {
  return String(rawPath || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/^\.(\/)+/, '');
}

function _isLowSignalCasePromptPath(pathValue) {
  const p = String(pathValue || '');
  const fileName = p.split('/').pop() || '';
  if (!p || _isCaseSystemFile({ name: fileName, webkitRelativePath: p })) return true;
  if (/(^|\/)\.(git|svn|hg|idea|vscode)(\/|$)/i.test(p)) return true;
  if (/(^|\/)(node_modules|\.venv|venv|__pycache__|\.pytest_cache|\.mypy_cache|cache|tmp|temp|logs?|dist|build)(\/|$)/i.test(p)) return true;
  if (/(^|\/)(sha256sums\.txt|package-lock\.json|yarn\.lock|pnpm-lock\.yaml)$/i.test(p)) return true;
  if (/\.(png|jpe?g|gif|webp|svg|mp3|wav|m4a|mp4|avi|mov|zip|gz|tar|7z|exe|dll|so|bin)$/i.test(p)) return true;
  if (/(^|\/)\.env(\.|$)/i.test(p)) return true;
  return false;
}

function _casePromptPriority(pathValue) {
  const p = String(pathValue || '').toLowerCase();
  let score = 0;
  if (/(^|\/)(project_manifest\.md|project_status\.md|readme\.md)$/.test(p)) score += 100;
  if (/\/(knowledge|docs)\//.test(p)) score += 40;
  if (/\/knowledge\/(legal|procedural|templates|examples|observatory)\//.test(p)) score += 45;
  if (/\.agent\.md$/.test(p)) score += 38;
  if (/\/(app|src)\/(main|agent|tools|config)\.(py|js|ts)$/.test(p)) score += 28;
  if (/(^|\/)(requirements\.txt|pyproject\.toml)$/.test(p)) score += 10;
  if (/\/bundle\//.test(p)) score -= 8;
  if (/\/release\//.test(p)) score -= 12;
  return score;
}

function _selectCasePromptFiles(files, maxItems) {
  const limit = Number.isFinite(maxItems) ? Math.max(1, maxItems) : 12;
  const seen = new Set();
  const candidates = [];

  for (const f of (files || [])) {
    if (!f || !(f.ingestEligible || f.ingestReason === 'docx-text')) continue;
    const rel = _normalizeCasePromptPath(f.relativePath || f.name);
    if (!rel) continue;
    const key = rel.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (_isLowSignalCasePromptPath(rel)) continue;
    candidates.push(rel);
  }

  if (!candidates.length) return [];

  const ranked = candidates.map(path => ({
    path,
    score: _casePromptPriority(path),
    depth: String(path).split('/').length,
    len: String(path).length,
  }));

  ranked.sort((a, b) => (
    (b.score - a.score)
    || (a.depth - b.depth)
    || (a.len - b.len)
    || a.path.localeCompare(b.path)
  ));

  return ranked.slice(0, limit).map(item => item.path);
}

function _buildCasePrompt(baseInstruction) {
  const keyFiles = _selectCasePromptFiles(caseFiles, 12);
  const eligibleCount = (caseFiles || []).filter(f => f && (f.ingestEligible || f.ingestReason === 'docx-text')).length;
  const omitted = Math.max(0, eligibleCount - keyFiles.length);
  const listing = keyFiles.map(name => `- ${name}`).join('\n');

  return [
    baseInstruction,
    '',
    'Use somente os arquivos-chave já ingeridos abaixo:',
    listing || '- (sem arquivos-chave elegíveis)',
    omitted > 0 ? `(${omitted} arquivo(s) adicional(is) omitido(s) para reduzir ruído.)` : '',
    'Ignore artefatos de release/cache/sistema e concentre-se nas fontes canônicas.',
  ].filter(Boolean).join('\n');
}

// Send ingested case data to the agent for analysis
function sendBridgeDataToAgent() {
  if (!caseFiles || caseFiles.length === 0) return;
  const prompt = _buildCasePrompt(
    'Analise os arquivos de caso ingeridos na memória. Forneça uma análise completa com entidades principais, relacionamentos e próximos passos recomendados.'
  );
  const input  = document.getElementById('chatInput') || document.getElementById('msgInput');
  if (input) { input.value = prompt; input.dispatchEvent(new Event('input')); input.focus(); }
}

// Run deep intelligence (L5-L7) via agent
function runBridgeIntelligence() {
  if (!caseFiles || caseFiles.length === 0) return;
  const prompt = _buildCasePrompt(
    'Execute análise profunda L5-L7 nos arquivos de caso. Inclua: violações identificadas, lacunas, cronologia, narrativa e recomendações priorizadas.'
  );
  const input  = document.getElementById('chatInput') || document.getElementById('msgInput');
  if (input) { input.value = prompt; input.dispatchEvent(new Event('input')); input.focus(); }
}

// Update compose context bar
function updateComposeContextBar() {
  const bar = document.getElementById('composeContextBar');
  if (!bar) return;

  const badges = [];
  let imageCount = 0;
  for (const [, file] of _importedFiles) {
    if (!file) continue;
    if (file.type === 'image' || file.previewType === 'image') imageCount += 1;
  }
  if (_importedFiles.size > 0) {
    const filesList = Array.from(_importedFiles.values()).map(f => f.name).join('\\n');
    badges.push(`<span class="context-badge context-badge-imported" data-badge-type="imported" data-files="${escapeHtml(filesList)}" data-count="${_importedFiles.size}"><i class="fas fa-paperclip"></i> ${_importedFiles.size} arquivo(s) importado(s)</span>`);
  }
  if (imageCount > 0) {
    badges.push(`<span class="context-badge"><i class="fas fa-image"></i> ${imageCount} imagem(ns) visual(is)</span>`);
  }
  const ctxCount = _contextSessionFiles.size;
  if (ctxCount > 0) {
    const ctxFilesList = Array.from(_contextSessionFiles.keys()).join('\\n');
    badges.push(`<span class="context-badge context-badge-context" style="border-color:var(--purple)" data-badge-type="context" data-files="${escapeHtml(ctxFilesList)}" data-count="${ctxCount}"><i class="fas fa-brain" style="color:var(--purple)"></i> ${ctxCount} no contexto</span>`);
  }
  if (_checkedShared.size > 0) {
    badges.push(`<span class="context-badge"><i class="fas fa-share-alt"></i> ${_checkedShared.size} item(ns) _shared</span>`);
  }
  if (typeof _checkedDocs !== 'undefined' && _checkedDocs && typeof _checkedDocs.size === 'number' && _checkedDocs.size > 0) {
    const docsList = Array.from(_checkedDocs.keys()).join('\\n');
    badges.push(`<span class="context-badge context-badge-docs" data-badge-type="docs" data-files="${escapeHtml(docsList)}" data-count="${_checkedDocs.size}"><i class="fas fa-file-alt"></i> ${_checkedDocs.size} documento(s)</span>`);
  }
  if (typeof _checkedArticles !== 'undefined' && _checkedArticles && typeof _checkedArticles.size === 'number' && _checkedArticles.size > 0) {
    badges.push(`<span class="context-badge"><i class="fas fa-scale-balanced"></i> ${_checkedArticles.size} artigo(s)</span>`);
  }
  if (typeof getPanelContextSelectionSummary === 'function') {
    const selectedPanels = getPanelContextSelectionSummary();
    selectedPanels.forEach(name => {
      badges.push(`<span class="context-badge context-badge-panel" data-badge-type="panel" data-name="${escapeHtml(name)}"><i class="fas fa-panels"></i> Painel: ${escapeHtml(name)}</span>`);
    });
  }
  if (typeof getAssistantContextPreviewDebugEnabled === 'function' && getAssistantContextPreviewDebugEnabled()) {
    badges.push('<span class="context-badge"><i class="fas fa-bug"></i> Debug contexto</span>');
  }

  if (badges.length === 0) {
    bar.style.display = 'none';
    bar.innerHTML = '';
    return;
  }

  bar.style.display = 'flex';
  bar.innerHTML = badges.join('');

  // Attach hover handlers for context badges
  attachContextBadgeHandlers();
}

// ── Active Project Chip (6.1) ──────────────────────────────────────
// Updates the project name and file count chip at the top of #tab-files
// whenever the active project changes.
function _updateTabFilesProjectChip() {
  const chip = document.getElementById('tabFilesProjectChip');
  const nameEl = document.getElementById('tabFilesProjectName');
  const countEl = document.getElementById('tabFilesProjectFilesCount');
  if (!chip || !nameEl) return;

  const pid = (typeof getCurrentProjectId === 'function') ? getCurrentProjectId() : null;
  if (!pid) {
    chip.style.display = 'none';
    return;
  }

  const project = (typeof _findProject === 'function') ? _findProject(pid) : null;
  if (!project) {
    chip.style.display = 'none';
    return;
  }

  nameEl.textContent = project.name || pid;
  if (countEl) {
    const fc = typeof project.files_count === 'number' ? project.files_count : '';
    countEl.textContent = fc ? `${fc} arquivo${fc !== 1 ? 's' : ''}` : '';
  }
  chip.style.display = 'flex';
}
window._updateTabFilesProjectChip = _updateTabFilesProjectChip;
window.getImportedFilesContext = getImportedFilesContext;
window.getSharedContext = getSharedContext;
window.updateSharedContextBar = updateSharedContextBar;
window.addSharedContextItem = addSharedContextItem;
window.addArtifactToContext = addArtifactToContext;
window.addTranscriptToContext = addTranscriptToContext;
window.clearAllSharedContext = clearAllSharedContext;
window.handleBundleFile = handleBundleFile;
window.handleCaseFiles = handleCaseFiles;
window.handleContextFileImport = handleContextFileImport;
window.handleChatImageImport = handleChatImageImport;
window.capturePrintScreenFromClipboard = capturePrintScreenFromClipboard;
window.handleFileUpload = handleFileUpload;
window.previewSharedFile = previewSharedFile;
window.previewImportedWorkspaceFile = previewImportedWorkspaceFile;
window.renderCaseFiles = renderCaseFiles;
window.renderSessionFiles = renderSessionFiles;
window.selectMemoryFilesFromShared = selectMemoryFilesFromShared;
window.selectMemoryFilesFromTree = selectMemoryFilesFromTree;
window.viewImportedFile = viewImportedFile;
window._openImportedFileInPreview = _openImportedFileInPreview;
window.clearCaseFiles = clearCaseFiles;
window.clearSessionFiles = clearSessionFiles;
window.removeCaseFile = removeCaseFile;
window.removeFileContext = removeFileContext;
window.handleCaseDrop = handleCaseDrop;
window.startBridgeScan = startBridgeScan;
window.sendBridgeDataToAgent = sendBridgeDataToAgent;
window.runBridgeIntelligence = runBridgeIntelligence;
window.downloadFile = downloadFile;
window.updateComposeContextBar = updateComposeContextBar;
window.onCaseUploadTargetChanged = onCaseUploadTargetChanged;
window.refreshCaseUploadTargetPath = refreshCaseUploadTargetPath;
window._sessionBulkDownload = _sessionBulkDownload;
window.attachContextBadgeHandlers = attachContextBadgeHandlers;
window.showContextBadgeModal = showContextBadgeModal;
window.hideContextBadgeModal = hideContextBadgeModal;

// Attach hover handlers for context badges
function attachContextBadgeHandlers() {
  const bar = document.getElementById('composeContextBar');
  if (!bar) return;

  const badges = bar.querySelectorAll('.context-badge[data-badge-type]');
  badges.forEach(badge => {
    // Remove existing handlers to avoid duplicates
    badge.onmouseenter = null;
    badge.onmouseleave = null;
    badge.onclick = null;

    badge.addEventListener('mouseenter', (e) => {
      showContextBadgeModal(e.currentTarget, e);
    });
    badge.addEventListener('mouseleave', (e) => {
      hideContextBadgeModal(e.currentTarget);
    });
    badge.addEventListener('click', (e) => {
      // On click, keep modal open until click outside
      e.stopPropagation();
      toggleContextBadgeModal(e.currentTarget);
    });
  });
}

// Context badge modal state
let _contextBadgeModalTimer = null;
let _currentModalBadge = null;

function showContextBadgeModal(badge, event) {
  if (_contextBadgeModalTimer) {
    clearTimeout(_contextBadgeModalTimer);
    _contextBadgeModalTimer = null;
  }

  const badgeType = badge.dataset.badgeType;
  const filesList = badge.dataset.files;
  const count = badge.dataset.count;
  const panelName = badge.dataset.name;

  let content = '';
  let title = '';

  switch (badgeType) {
    case 'imported':
      title = 'Arquivos Importados';
      if (filesList) {
        const files = filesList.split('\\n').filter(f => f.trim());
        content = files.map(f => `<div class="context-modal-file"><i class="fas fa-file"></i> <span>${escapeHtml(f)}</span> <button class="context-modal-remove" onclick="removeFileContext('${escapeHtml(f)}');hideContextBadgeModal();" title="Remover"><i class="fas fa-times"></i></button></div>`).join('');
      }
      break;
    case 'context':
      title = 'Arquivos no Contexto';
      if (filesList) {
        const files = filesList.split('\\n').filter(f => f.trim());
        content = files.map(f => `<div class="context-modal-file"><i class="fas fa-brain" style="color:var(--purple)"></i> <span>${escapeHtml(f)}</span> <button class="context-modal-remove" onclick="removeFileContext('${escapeHtml(f)}');hideContextBadgeModal();" title="Remover do contexto"><i class="fas fa-times"></i></button></div>`).join('');
      }
      break;
    case 'docs':
      title = 'Documentos Selecionados';
      if (filesList) {
        const files = filesList.split('\\n').filter(f => f.trim());
        content = files.map(f => `<div class="context-modal-file"><i class="fas fa-file-alt"></i> <span>${escapeHtml(f)}</span> <button class="context-modal-remove" onclick="uncheckDoc('${escapeHtml(f)}');hideContextBadgeModal();" title="Desmarcar"><i class="fas fa-times"></i></button></div>`).join('');
      }
      break;
    case 'panel':
      title = 'Painel: ' + panelName;
      content = '<div class="context-modal-file"><i class="fas fa-panels"></i> <span>Painel de contexto ativo</span></div>';
      break;
    default:
      return;
  }

  // Create or update modal
  let modal = document.getElementById('contextBadgeModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'contextBadgeModal';
    modal.className = 'context-badge-modal';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="context-modal-header">
      <span>${escapeHtml(title)}</span>
      <span class="context-modal-count">${count || ''}</span>
    </div>
    <div class="context-modal-body">
      ${content || '<div class="context-modal-empty">Nenhum arquivo</div>'}
    </div>
  `;

  // Position modal in center of viewport (main screen area)
  modal.style.top = '';
  modal.style.left = '';
  modal.style.right = '';
  modal.style.bottom = '';
  modal.style.margin = 'auto';
  modal.style.maxWidth = '90vw';
  modal.style.maxHeight = '80vh';

  // Show with animation
  requestAnimationFrame(() => {
    modal.classList.add('show');
  });

  _currentModalBadge = badge;

  // Add click-outside handler
  document.addEventListener('click', closeModalOnOutsideClick, { once: true });
}

function hideContextBadgeModal(badge) {
  if (_contextBadgeModalTimer) {
    clearTimeout(_contextBadgeModalTimer);
  }
  _contextBadgeModalTimer = setTimeout(() => {
    const modal = document.getElementById('contextBadgeModal');
    if (modal) {
      modal.classList.remove('show');
    }
    _currentModalBadge = null;
  }, 100);
}

function toggleContextBadgeModal(badge) {
  const modal = document.getElementById('contextBadgeModal');
  if (modal && modal.classList.contains('show') && _currentModalBadge === badge) {
    modal.classList.remove('show');
    _currentModalBadge = null;
  } else {
    showContextBadgeModal(badge, null);
    // Keep modal open until click outside
    document.addEventListener('click', closeModalOnOutsideClick, { once: true });
  }
}

function closeModalOnOutsideClick(e) {
  const modal = document.getElementById('contextBadgeModal');
  if (modal && modal.classList.contains('show') && !modal.contains(e.target)) {
    const badges = document.querySelectorAll('.context-badge[data-badge-type]');
    let clickedBadge = false;
    badges.forEach(b => { if (b.contains(e.target)) clickedBadge = true; });
    if (!clickedBadge) {
      modal.classList.remove('show');
      _currentModalBadge = null;
    }
  }
}

window.attachContextBadgeHandlers = attachContextBadgeHandlers;
window.showContextBadgeModal = showContextBadgeModal;
window.hideContextBadgeModal = hideContextBadgeModal;

document.addEventListener('DOMContentLoaded', function() {
  _initCaseUploadTargetInput();
  _bindChatImagePasteHook();
});