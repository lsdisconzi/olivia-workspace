/* ═══════════════════════════════════════════════════════════════════
   FILES MODULE - File system tree, file upload/open operations
   ═══════════════════════════════════════════════════════════════════ */

// File system global variables
let caseFiles = [];
let docsContext = '';
let filesContext = '';
var _importedFiles = window._importedFiles || new Map();
window._importedFiles = _importedFiles;
var _checkedShared = window._checkedShared || new Map();
window._checkedShared = _checkedShared;

// File utility functions
function file(name, content) {
  return { name, content };
}

function fileChips(files) {
  if (!files || !files.length) return '';
  return files.map(f => `<span class="file-chip">${escapeHtml(f.name)}</span>`).join('');
}

function fileCount(files) {
  return files ? files.length : 0;
}

function fileName(path) {
  return path.split('/').pop() || path;
}

function fileNames(files) {
  return files ? files.map(f => f.name).join(', ') : '';
}

function fileRes(response) {
  return response && response.ok ? response.json() : null;
}

function filename(path) {
  return fileName(path);
}

function files(list) {
  return Array.isArray(list) ? list : [];
}

function getFilesContextValue(context) {
  return context || '';
}

function filesHtml(files) {
  if (!files || !files.length) return '<div class="empty">No files</div>';
  return files.map(f => `<div class="file-item">📄 ${escapeHtml(f.name)}</div>`).join('');
}

// Tree operations
function tree(nodes, depth = 0) {
  if (!nodes || !nodes.length) return '';

  const indent = '  '.repeat(depth);
  return nodes.map(node => {
    if (node.type === 'dir') {
      return `${indent}📁 ${node.name}\n${tree(node.children, depth + 1)}`;
    } else {
      return `${indent}📄 ${node.name}`;
    }
  }).join('\n');
}

function treeMap(nodes, callback, path = '') {
  if (!nodes || !nodes.length) return [];

  const result = [];
  nodes.forEach(node => {
    const nodePath = path ? `${path}/${node.name}` : node.name;
    result.push(callback(node, nodePath));

    if (node.type === 'dir' && node.children) {
      result.push(...treeMap(node.children, callback, nodePath));
    }
  });
  return result;
}

// File access tracking
function onFileAccessed(path, action = 'read') {
  console.log(`File ${action}: ${path}`);
  // Could send analytics or update UI
}

// Safe file ID generation
function safeFileId(path) {
  return path.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_');
}

// Initial memory files setup
function initialMemoryFiles() {
  return [
    { name: 'welcome.md', content: '# Welcome to LA8159\n\nThis is your memory workspace.' },
    { name: 'quickstart.md', content: '## Quick Start\n\n1. Select an agent\n2. Start chatting\n3. Use tools from sidebar' }
  ];
}

// Memory files raw data
function memoryFilesRaw() {
  return Array.from(_importedFiles.values()).filter(f => f.type === 'text');
}

// Detect output files
function detectOutputFiles() {
  // This would scan the workspace for output files
  // For now, returns empty array
  return [];
}

// Load and display saved transcripts in the tab-files sidebar section
async function loadTranscripts() {
  const container = document.getElementById('transcriptsList');
  const countBadge = document.getElementById('transcriptsCount');
  if (!container) return;
  container.innerHTML = '<p style="color:var(--gray);font-size:11px;text-align:center;padding:12px 0;font-style:italic">Carregando transcrições...</p>';
  try {
    const res = await fetch(`${API_BASE}/api/transcripts/list`);
    if (!res.ok) throw new Error(res.statusText);
    const data = await res.json();
    const list = data.transcripts || [];
    if (countBadge) countBadge.textContent = '(' + list.length + ')';
    if (!list.length) {
      container.innerHTML = '<div style="text-align:center;padding:16px 12px;border:1px dashed var(--border);border-radius:8px;background:rgba(255,255,255,0.02)">'
        + '<div style="font-size:20px;color:var(--gray);margin-bottom:6px"><i class="fas fa-closed-captioning"></i></div>'
        + '<div style="font-size:11px;color:var(--gray);margin-bottom:4px">Nenhuma transcrição salva ainda</div>'
        + '<div style="font-size:10px;color:var(--gray);opacity:.7">Grave áudio no módulo <strong>Listening</strong> para gerar transcrições</div>'
        + '</div>';
      return;
    }
    container.innerHTML = list.map(t => {
      const name = t.original_filename || t.filename || 'Transcrição';
      const dur = t.duration ? ` · ${Math.round(t.duration)}s` : '';
      const lang = t.language ? ` · ${t.language}` : '';
      const previewName = (t.path && t.path.split('/').pop()) || `${t.filename || 'transcript'}.json`;
      const previewJs = `previewSavedTranscript(${JSON.stringify(t.path || '')}, ${JSON.stringify(previewName)}, ${JSON.stringify(name)})`;
      const addJs = `addTranscriptToContext(${JSON.stringify(t.filename)})`;
      return `
        <div style="display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid var(--border);border-radius:5px;font-size:11px;cursor:pointer" onclick="${escapeHtml(previewJs)}" title="Abrir preview da transcrição">
          <span style="font-size:13px;flex-shrink:0">🎤</span>
          <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--white)" title="${escapeHtml(name)}">${escapeHtml(name)}</span>
          <span style="color:var(--gray);flex-shrink:0;font-size:10px">${dur}${lang}</span>
          <button style="border:none;background:none;color:var(--gray);cursor:pointer;padding:2px 5px;font-size:11px;flex-shrink:0" onclick="event.stopPropagation();${escapeHtml(addJs)}" title="Adicionar ao contexto"><i class="fas fa-paperclip"></i></button>
        </div>
      `;
    }).join('');
  } catch (e) {
    container.innerHTML = `<p style="color:var(--red);font-size:11px;text-align:center;padding:12px 0">Erro ao carregar transcrições</p>`;
    if (countBadge) countBadge.textContent = '(0)';
  }
}
// ── Project Planning Overview (sidebar tab-files) ────────────────────
// Loads and renders expandable cards for the 4 planning files
// (task_plan.md, findings.md, progress.md, memory.md) from the active project.
// Clicking a card expands it inline in the sidebar to show full file content.
// Uses window._PLANNING_FILES from projects.js as the canonical definition.

// Track which planning cards are expanded (keyed by filename)
const _planningExpanded = {};

// Simple markdown-to-HTML converter for inline rendering
function _planningRenderMD(text) {
  let html = text
    // Headers
    .replace(/^##### (.*$)/gm, '<div style="font-size:10px;font-weight:600;color:var(--gray-hi,#ddd);margin-top:10px;margin-bottom:3px;text-transform:uppercase;letter-spacing:.05em">$1</div>')
    .replace(/^#### (.*$)/gm, '<div style="font-size:11px;font-weight:600;color:var(--gray-hi,#ddd);margin-top:10px;margin-bottom:3px">$1</div>')
    .replace(/^### (.*$)/gm, '<div style="font-size:12px;font-weight:600;color:var(--white);margin-top:12px;margin-bottom:4px">$1</div>')
    .replace(/^## (.*$)/gm, '<div style="font-size:13px;font-weight:700;color:var(--white);margin-top:14px;margin-bottom:5px;padding-bottom:3px;border-bottom:1px solid var(--border)">$1</div>')
    .replace(/^# (.*$)/gm, '<div style="font-size:14px;font-weight:700;color:var(--accent);margin-top:14px;margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid var(--border)">$1</div>')
    // Bold
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code style="background:rgba(255,255,255,0.06);padding:1px 4px;border-radius:3px;font-size:10px;font-family:monospace">$1</code>')
    // Unordered list items
    .replace(/^- (.*$)/gm, '<div style="display:flex;gap:6px;padding:1px 0"><span style="color:var(--gray);flex-shrink:0">•</span><span>$1</span></div>')
    // Ordered list items
    .replace(/^\d+\. (.*$)/gm, '<div style="display:flex;gap:6px;padding:1px 0"><span style="color:var(--gray);flex-shrink:0;font-size:10px">→</span><span>$1</span></div>')
    // Table rows (simple)
    .replace(/^\|(.+)\|$/gm, (m) => {
      const cells = m.split('|').filter(c => c.trim()).map(c => c.trim());
      if (cells.every(c => /^[-]+$/.test(c.replace(/:/g, '')))) return '<hr style="border-color:var(--border);margin:2px 0">';
      return '<div style="display:flex;gap:8px;padding:2px 0;font-size:10px">' + cells.map(c => '<span style="flex:1">' + c.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') + '</span>').join('') + '</div>';
    })
    // Horizontal rules (preserve as spacer)
    .replace(/^---+$/gm, '<hr style="border-color:var(--border);margin:6px 0">')
    // Empty lines become paragraph breaks
    .replace(/\n\n/g, '<div style="height:4px"></div>');

  // Wrap in container with line-height for readability
  return '<div style="font-size:11px;line-height:1.5;color:var(--gray-hi,#ccc);overflow-wrap:break-word">' + html + '</div>';
}

// Toggle a planning card expanded state
window._togglePlanningCard = async function (filename) {
  const container = document.getElementById('planningOverviewContent');
  if (!container) return;

  const pid = (typeof getCurrentProjectId === 'function') ? getCurrentProjectId() : null;
  if (!pid) return;

  const cardEl = container.querySelector(`[data-planning-file="${CSS.escape(filename)}"]`);
  if (!cardEl) return;

  const contentArea = cardEl.querySelector('.planning-card-content');
  const chevronIcon = cardEl.querySelector('.planning-chevron i');
  const wasExpanded = _planningExpanded[filename];

  if (wasExpanded) {
    // Collapse
    _planningExpanded[filename] = false;
    contentArea.style.maxHeight = '0';
    contentArea.style.opacity = '0';
    setTimeout(() => { contentArea.innerHTML = ''; }, 300);
    if (chevronIcon) chevronIcon.className = 'fas fa-chevron-down';
    cardEl.classList.remove('expanded');
    return;
  }

  // Expand - load content if not already loaded
  _planningExpanded[filename] = true;
  cardEl.classList.add('expanded');
  if (chevronIcon) chevronIcon.className = 'fas fa-chevron-up';

  // If content already loaded, just reveal
  if (contentArea.dataset.loaded === '1') {
    contentArea.style.maxHeight = contentArea.scrollHeight + 'px';
    contentArea.style.opacity = '1';
    return;
  }

  // Show loading
  contentArea.innerHTML = '<div style="padding:8px;text-align:center;color:var(--gray);font-size:10px">Loading...</div>';
  contentArea.style.maxHeight = '60px';
  contentArea.style.opacity = '1';

  try {
    const res = await fetch(`${window.API_BASE || ''}/api/projects/${encodeURIComponent(pid)}/raw?path=${encodeURIComponent(filename)}`);
    if (res.ok) {
      const text = await res.text();
      contentArea.innerHTML = '<div class="planning-scroll-wrap">' + _planningRenderMD(text) + '</div>';
      contentArea.dataset.loaded = '1';
      // Let the DOM settle then set max-height for smooth animation
      requestAnimationFrame(() => {
        const inner = contentArea.querySelector('.planning-scroll-wrap');
        if (inner) {
          contentArea.style.maxHeight = Math.min(inner.scrollHeight + 20, 320) + 'px';
        }
      });
    } else {
      contentArea.innerHTML = '<div style="padding:8px;text-align:center;color:var(--red);font-size:10px">Failed to load</div>';
      contentArea.style.maxHeight = '60px';
    }
  } catch (e) {
    contentArea.innerHTML = '<div style="padding:8px;text-align:center;color:var(--red);font-size:10px">Error loading content</div>';
    contentArea.style.maxHeight = '60px';
    console.warn('[planning] fetch error:', e);
  }
};

async function loadProjectPlanningOverview(force) {
  const container = document.getElementById('planningOverviewContent');
  if (!container) return;

  const pid = (typeof getCurrentProjectId === 'function') ? getCurrentProjectId() : null;
  if (!pid) {
    container.innerHTML = '<p style="color:var(--gray);font-size:11px;text-align:center;padding:12px 0;font-style:italic">'
      + (typeof window.t === 'function' ? window.t('ui.noActiveProject', 'No active project') : 'No active project') + '</p>';
    return;
  }

  container.innerHTML = '<span style="color:var(--gray);font-size:11px;">'
    + (typeof window.t === 'function' ? window.t('ui.loading', 'Loading...') : 'Loading...') + '</span>';

  // Use the canonical planning files definition from projects.js
  const planningDefs = window._PLANNING_FILES || [];

  try {
    const data = await fetchProjectFilesSnapshot(pid, { force: !!force });
    const files = Array.isArray(data.files) ? data.files : [];

    // Find planning files by basename
    const planning = [];
    files.forEach(f => {
      const base = String(f.name || '').split('/').pop();
      const match = planningDefs.find(p => p.name === base);
      if (match) planning.push({ ...match, ...f });
    });

    // Build HTML
    let html = '';
    if (!planning.length) {
      html = '<p style="color:var(--gray);font-size:11px;text-align:center;padding:12px 0;font-style:italic">'
        + (typeof window.t === 'function' ? window.t('ui.noPlanningFiles', 'No planning files found') : 'No planning files found') + '</p>';
    } else {
      // Fetch summaries for each planning file
      const summaries = await Promise.all(planning.map(async (f) => {
        let summary = '';
        try {
          const res = await fetch(`${window.API_BASE || ''}/api/projects/${encodeURIComponent(pid)}/raw?path=${encodeURIComponent(f.name)}`);
          if (res.ok) {
            const text = await res.text();
            const lines = text.split('\n')
              .map(l => l.trim())
              .filter(l => l && !l.startsWith('#') && !l.startsWith('<!--') && !l.startsWith('<'));
            summary = lines.slice(0, 2).join(' · ') || '';
          }
        } catch (_) { /* ignore */ }
        return { ...f, summary };
      }));

      html = '<div style="display:flex;flex-direction:column;gap:4px;">';
      summaries.forEach(f => {
        const fileName = String(f.name).split('/').pop();
        const label = String(f.label).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const icon = f.icon || 'fa-file-lines';
        const color = f.color || 'var(--gray)';
        const summaryText = (f.summary || '\u2014').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const wasExpanded = !!_planningExpanded[fileName];
        const chevronClass = wasExpanded ? 'fa-chevron-up' : 'fa-chevron-down';

        html += `<div class="planning-card" data-planning-file="${fileName}" style="border:1px solid var(--border);border-radius:7px;overflow:hidden;background:rgba(255,255,255,0.02)">
          <div class="planning-card-header" onclick="_togglePlanningCard('${fileName}')" style="display:flex;align-items:center;gap:8px;padding:7px 8px;cursor:pointer;user-select:none">
            <i class="fas ${icon}" style="color:${color};width:14px;text-align:center;flex-shrink:0;"></i>
            <div style="flex:1;min-width:0;">
              <div style="color:var(--white);font-size:11px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${label}</div>
              <div class="planning-card-preview" style="color:var(--gray);font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${summaryText}</div>
            </div>
            <span class="planning-chevron" style="font-size:9px;color:var(--gray);flex-shrink:0;transition:transform .2s"><i class="fas ${chevronClass}"></i></span>
          </div>
          <div class="planning-card-content" style="max-height:${wasExpanded ? '200px' : '0'};opacity:${wasExpanded ? '1' : '0'};overflow:hidden;transition:max-height .3s ease, opacity .3s ease;border-top:${wasExpanded ? '1px solid var(--border)' : 'none'}">
          </div>
        </div>`;
      });
      html += '</div>';

      // Direction summary from progress.md or task_plan.md
      let direction = null;
      const cand = planning.find(f => f.name.endsWith('progress.md')) || planning.find(f => f.name.endsWith('task_plan.md'));
      if (cand) {
        try {
          const r = await fetch(`${window.API_BASE || ''}/api/projects/${encodeURIComponent(pid)}/raw?path=${encodeURIComponent(cand.name)}`);
          if (r.ok) {
            const txt = await r.text();
            const lines = txt.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#') && !l.startsWith('<!--') && !l.startsWith('<'));
            direction = lines.slice(0, 3).join(' · ') || null;
          }
        } catch (_) { /* ignore */ }
      }
      if (direction) {
        html += `<div style="margin-top:6px;padding:6px 8px;background:rgba(255,255,255,0.04);border-left:3px solid var(--amber);border-radius:4px;">
          <div style="font-size:9px;color:var(--gray);text-transform:uppercase;letter-spacing:.08em;">Direction</div>
          <div style="font-size:11px;color:var(--gray-hi, #ddd);margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${direction.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
        </div>`;
      }

      // Auto-expand previously expanded cards - load content after render
      setTimeout(() => {
        const expandedEntries = Object.entries(_planningExpanded).filter(([, v]) => v);
        expandedEntries.forEach(([fn]) => {
          _togglePlanningCard(fn);
        });
      }, 50);
    }

    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = '<p style="color:var(--red);font-size:11px;text-align:center;padding:12px 0">'
      + (typeof window.t === 'function' ? window.t('ui.failedToLoadPlanning', 'Failed to load planning overview') : 'Failed to load planning overview') + '</p>';
    console.warn('[loadProjectPlanningOverview] error:', e);
  }
}
window.loadProjectPlanningOverview = loadProjectPlanningOverview;

function previewSavedTranscript(path, previewName, title) {
  if (!path || typeof openPreviewUrl !== 'function') return;
  const url = `${API_BASE}/api/shared/raw?path=${encodeURIComponent(path)}`;
  if (typeof addOutputArtifact === 'function') {
    addOutputArtifact({
      id: `transcript:${path}`,
      title: title || previewName || 'Transcrição',
      type: 'json',
      url,
      path,
      source: 'saved-transcript'
    });
  }
  return openPreviewUrl(url, previewName || title || 'transcript.json', { fileType: 'json' });
}
window.previewSavedTranscript = previewSavedTranscript;

// Handle file drop for memory
function mvHandleFileDrop(e) {
  e.preventDefault();
  e.stopPropagation();

  const files = e.dataTransfer.files;
  if (files.length) {
    // Process files for memory ingestion
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = function (e) {
        const content = e.target.result;
        const fileInfo = {
          name: file.name,
          size: file.size,
          type: file.type.includes('text') ? 'text' : 'binary',
          content: content
        };

        _importedFiles.set(file.name, fileInfo);
        updateComposeContextBar();
        renderSessionFiles();
        addSystemBubble(`Arquivo "${file.name}" pronto para ingestão na memória`);
      };

      if (file.type.includes('text')) {
        reader.readAsText(file);
      } else {
        // Binary files - just store metadata
        const fileInfo = {
          name: file.name,
          size: file.size,
          type: 'binary'
        };
        _importedFiles.set(file.name, fileInfo);
        updateComposeContextBar();
        renderSessionFiles();
        addSystemBubble(`Arquivo binário "${file.name}" (não ingerível na memória)`);
      }
    });
  }
}

// Handle file select for memory
function mvHandleFileSelect(e) {
  if (e.target.files.length) {
    mvHandleFileDrop({ dataTransfer: { files: e.target.files }, preventDefault: () => { }, stopPropagation: () => { } });
  }
}

// File-related UI helpers
function fileInputHandler(inputId, callback) {
  const input = document.getElementById(inputId);
  if (!input) return;

  input.addEventListener('change', function (e) {
    if (e.target.files && e.target.files[0]) {
      callback(e.target.files[0]);
    }
  });
}

function dragAndDropHandler(elementId, callback) {
  const element = document.getElementById(elementId);
  if (!element) return;

  element.addEventListener('dragover', function (e) {
    e.preventDefault();
    e.stopPropagation();
    element.classList.add('dragover');
  });

  element.addEventListener('dragleave', function (e) {
    e.preventDefault();
    e.stopPropagation();
    element.classList.remove('dragover');
  });

  element.addEventListener('drop', function (e) {
    e.preventDefault();
    e.stopPropagation();
    element.classList.remove('dragover');

    if (e.dataTransfer.files.length) {
      callback(e.dataTransfer.files);
    }
  });
}

// File icon based on extension
function fileIcon(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const icons = {
    'pdf': '📕',
    'doc': '📄', 'docx': '📄',
    'txt': '📝', 'md': '📝',
    'json': '{}', 'yaml': '⚙️', 'yml': '⚙️',
    'csv': '📊', 'xls': '📊', 'xlsx': '📊',
    'jpg': '🖼️', 'jpeg': '🖼️', 'png': '🖼️', 'gif': '🖼️',
    'mp3': '🎵', 'wav': '🎵',
    'mp4': '🎬', 'avi': '🎬',
    'zip': '📦', 'tar': '📦', 'gz': '📦',
    'html': '🌐', 'htm': '🌐',
    'js': '💻', 'py': '💻', 'java': '💻', 'cpp': '💻'
  };
  return icons[ext] || '📁';
}

// File type detection
function fileType(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const types = {
    'pdf': 'document',
    'doc': 'document', 'docx': 'document',
    'txt': 'text', 'md': 'text',
    'json': 'data', 'yaml': 'data', 'yml': 'data', 'csv': 'data',
    'jpg': 'image', 'jpeg': 'image', 'png': 'image', 'gif': 'image',
    'mp3': 'audio', 'wav': 'audio',
    'mp4': 'video', 'avi': 'video',
    'zip': 'archive', 'tar': 'archive', 'gz': 'archive',
    'html': 'web', 'htm': 'web',
    'js': 'code', 'py': 'code', 'java': 'code', 'cpp': 'code'
  };
  return types[ext] || 'unknown';
}

// Validate file
function validateFile(file, options = {}) {
  const defaults = {
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: ['text/plain', 'application/pdf', 'image/jpeg', 'image/png'],
    allowedExtensions: ['.txt', '.md', '.pdf', '.jpg', '.jpeg', '.png', '.json']
  };

  const config = { ...defaults, ...options };

  if (file.size > config.maxSize) {
    return { valid: false, error: `File too large (max ${formatBytes(config.maxSize)})` };
  }

  if (config.allowedTypes.length && !config.allowedTypes.includes(file.type) && file.type !== '') {
    return { valid: false, error: `File type not allowed: ${file.type}` };
  }

  const ext = '.' + file.name.split('.').pop().toLowerCase();
  if (config.allowedExtensions.length && !config.allowedExtensions.includes(ext)) {
    return { valid: false, error: `File extension not allowed: ${ext}` };
  }

  return { valid: true, error: null };
}

// Expose functions to window scope
window.detectOutputFiles = detectOutputFiles;
window.file = file;
window.fileChips = fileChips;
window.fileCount = fileCount;
window.fileName = fileName;
window.fileNames = fileNames;
window.fileRes = fileRes;
window.filename = filename;
window.files = files;
window.filesContext = filesContext;
window.filesHtml = filesHtml;
window.initialMemoryFiles = initialMemoryFiles;
window.memoryFilesRaw = memoryFilesRaw;
window.mvHandleFileDrop = mvHandleFileDrop;
window.mvHandleFileSelect = mvHandleFileSelect;
window.onFileAccessed = onFileAccessed;
window.safeFileId = safeFileId;
window.tree = tree;
window.treeMap = treeMap;
window.fileInputHandler = fileInputHandler;
window.dragAndDropHandler = dragAndDropHandler;
window.formatBytes = formatBytes;
window.fileIcon = fileIcon;
window.fileType = fileType;
window.validateFile = validateFile;