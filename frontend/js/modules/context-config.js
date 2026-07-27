/* ═══════════════════════════════════════════════════════════════════
   CONTEXT CONFIG MODULE — user-facing context file selector (Phase 3)
   Olivia Workspace
   Depends on: config.js (API_BASE), core.js (toast, escapeHtml)
   ═══════════════════════════════════════════════════════════════════ */

let _ctxConfig = null;           // cached response from GET /api/user/context-files
let _ctxDirty = false;           // tracks unsaved changes
const _PLANNING_LABELS = {
  'task_plan.md': 'Task Plan',
  'findings.md': 'Findings',
  'progress.md': 'Progress',
  'memory.md': 'Memory',
};
const _PLANNING_ICONS = {
  'task_plan.md': 'fa-list-check',
  'findings.md': 'fa-magnifying-glass',
  'progress.md': 'fa-chart-line',
  'memory.md': 'fa-brain',
};
const _PLANNING_COLORS = {
  'task_plan.md': 'var(--blue)',
  'findings.md': 'var(--amber)',
  'progress.md': 'var(--green)',
  'memory.md': 'var(--purple)',
};

/* ── escapeHtml helper (fallback if core.js not loaded) ── */
function _ctxEscape(s) {
  if (typeof window.escapeHtml === 'function') return window.escapeHtml(s);
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ── toast helper (fallback) ── */
function _ctxToast(msg, type) {
  if (typeof window.toast === 'function') { window.toast(msg, type || 'info'); return; }
  if (typeof window.addSystemBubble === 'function') { window.addSystemBubble(msg); }
}

/* ── Get auth headers for API calls ── */
function _ctxAuthHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (typeof window.getCustomApiKey === 'function') {
    const customKey = window.getCustomApiKey();
    if (customKey) {
      headers.Authorization = `Bearer ${customKey}`;
    }
  }
  return headers;
}

/* ── Format bytes ── */
function _ctxFormatBytes(n) {
  if (typeof n !== 'number' || n < 0) return '';
  if (n < 1024) return n + ' B';
  if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1048576).toFixed(1) + ' MB';
}

/* ── Toggle panel open/close ── */
function toggleContextConfigPanel() {
  const body = document.getElementById('contextConfigBody');
  const chevron = document.getElementById('contextConfigChevron');
  if (!body) return;
  const isOpen = body.style.display !== 'none';
  body.style.display = isOpen ? 'none' : '';
  if (chevron) chevron.classList.toggle('open', !isOpen);
  // Load on first open
  if (!isOpen && !_ctxConfig) {
    loadContextConfig();
  }
}
window.toggleContextConfigPanel = toggleContextConfigPanel;

/* ── Load context config from backend ── */
async function loadContextConfig() {
  const loading = document.getElementById('contextConfigLoading');
  const content = document.getElementById('contextConfigContent');
  if (loading) loading.style.display = '';
  if (content) content.style.display = 'none';

  try {
    // Detect active project ID for project-specific planning files
    let projectParam = '';
    if (typeof getCurrentProjectId === 'function') {
      const pid = String(getCurrentProjectId() || '').trim();
      if (pid) projectParam = '?project_id=' + encodeURIComponent(pid);
    }
    const res = await fetch((window.API_BASE || '') + '/api/user/context-files' + projectParam, {
      headers: _ctxAuthHeaders(),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();

    // Check for auth error in response body
    if (data && data.error === 'unauthenticated') {
      throw new Error('unauthenticated — please log in');
    }

    _ctxConfig = data;
    _ctxDirty = false;
    renderContextConfig(data);
  } catch (e) {
    if (loading) {
      var authMsg = (e.message || '').includes('unauthenticated')
        ? '🔒 Please <a href="javascript:void(0)" onclick="location.reload()" style="color:var(--blue);text-decoration:underline">log in</a> to configure context injection'
        : 'Failed to load: ' + _ctxEscape(e.message);
      loading.innerHTML = '<span style="color:var(--red);font-size:11px">' + authMsg + '</span>';
    }
    _ctxToast(e.message && e.message.includes('unauthenticated') ? 'Please log in to configure context' : 'Failed to load context config', 'error');
    // Reset _ctxConfig so user can retry by reopening the panel
    _ctxConfig = null;
  }
}
window.loadContextConfig = loadContextConfig;

/* ── Render the context file selector ── */
function renderContextConfig(data) {
  const loading = document.getElementById('contextConfigLoading');
  const content = document.getElementById('contextConfigContent');
  const scopeSelect = document.getElementById('contextScopeSelect');
  const container = document.getElementById('contextFilesContainer');
  const statusInfo = document.getElementById('contextStatusInfo');
  const statusText = document.getElementById('contextStatusText');

  if (loading) loading.style.display = 'none';
  if (content) content.style.display = '';

  if (scopeSelect) {
    scopeSelect.value = data.scope || 'project_only';
  }

  if (container) {
    if (!Array.isArray(data.sources) || data.sources.length === 0) {
      container.innerHTML = '<div style="padding:12px;text-align:center;color:var(--gray);font-size:10px"><i class="fas fa-info-circle"></i> No context files available.</div>';
      return;
    }

    let html = '';
    let selectedCount = 0;
    let totalAvailable = 0;
    const isCustom = data.scope === 'custom';

    function buildTree(items, level) {
      let out = '';
      if (!Array.isArray(items)) return out;
      items.forEach(function(item) {
        if (item.type === 'directory') {
          // Folder node
          const folderId = 'folder-' + Math.random().toString(36).substr(2, 9);
          const hasSelectedChildren = item.children.some(c => c.selected);
          out += '<div class="context-tree-node">';
          out += '<div class="context-tree-row" onclick="toggleFolder(\'' + folderId + '\')">';
          out += '<i class="fas fa-chevron-right context-tree-toggle" id="icon-' + folderId + '"></i>';
          out += '<i class="fas fa-folder context-tree-icon" style="color:var(--blue)"></i>';
          out += '<span class="context-tree-name">' + _ctxEscape(item.name) + '</span>';
          if (isCustom) {
            out += '<input type="checkbox" class="context-tree-checkbox" onclick="toggleFolderSelection(event, \'' + folderId + '\')" ' + (hasSelectedChildren ? 'checked' : '') + ' />';
          }
          out += '</div>';
          out += '<div class="context-tree-children" id="' + folderId + '" style="display:none">';
          out += buildTree(item.children, level + 1);
          out += '</div></div>';
        } else {
          // File node
          totalAvailable++;
          if (item.selected) selectedCount++;
          
          let icon = 'fa-file-lines';
          let color = 'var(--gray)';
          if (item.type.includes('image')) { icon = 'fa-image'; color = 'var(--green)'; }
          else if (item.name.endsWith('.pdf')) { icon = 'fa-file-pdf'; color = 'var(--red)'; }
          else if (item.name.endsWith('.json')) { icon = 'fa-code'; color = 'var(--amber)'; }
          
          if (_PLANNING_ICONS[item.name]) icon = _PLANNING_ICONS[item.name];
          if (_PLANNING_COLORS[item.name]) color = _PLANNING_COLORS[item.name];
          
          const sizeStr = _ctxFormatBytes(item.size);
          const checked = item.selected ? 'checked' : '';
          const disabled = !isCustom ? 'disabled' : '';

          out += '<label class="context-tree-row file-row ' + disabled + '" data-search="' + _ctxEscape(item.name).toLowerCase() + '">';
          out += '<i class="fas fa-fw context-tree-toggle leaf"></i>';
          out += '<input type="checkbox" class="context-tree-checkbox file-checkbox" data-filename="' + _ctxEscape(item.path) + '" ' + checked + ' ' + disabled + ' onchange="toggleContextFile(\'' + _ctxEscape(item.path) + '\')" />';
          out += '<i class="fas ' + icon + ' context-tree-icon" style="color:' + color + '"></i>';
          out += '<span class="context-tree-name">' + _ctxEscape(item.name) + '</span>';
          out += '<span class="context-file-size" style="font-size:9px;color:var(--gray);flex-shrink:0">' + _ctxEscape(sizeStr) + '</span>';
          out += '</label>';
        }
      });
      return out;
    }

    data.sources.forEach(function(source) {
      const sourceIcon = source.source === 'workspace' ? 'fa-building' : 'fa-box-open';
      html += '<div class="context-tree-node source-node">';
      html += '<div class="context-tree-row" style="background:rgba(255,255,255,0.02)">';
      html += '<i class="fas ' + sourceIcon + ' context-tree-icon" style="color:var(--white); margin-left:16px;"></i>';
      html += '<span class="context-tree-name" style="font-weight:bold">' + _ctxEscape(source.label) + '</span>';
      html += '</div>';
      html += '<div class="context-tree-children" style="display:flex; border-left:none; padding-left:0; margin-left:0;">';
      html += buildTree(source.files, 0);
      html += '</div></div><div style="height:8px"></div>';
    });

    container.innerHTML = html;

    if (statusInfo && statusText) {
      var scopeLabels = {
        'workspace_and_project': 'Full context: all files from workspace + project.',
        'project_only': 'Project-only context: workspace planning excluded.',
        'custom': 'Custom selection: only checked files are injected.',
      };
      var statusMsg = scopeLabels[data.scope] || '';
      if (isCustom) {
        statusMsg += ' (' + selectedCount + '/' + totalAvailable + ' selected)';
      }
      statusText.textContent = statusMsg;
      statusInfo.style.display = statusMsg ? '' : 'none';
    }
  }

  const previewContainer = document.getElementById('contextPreviewContainer');
  if (previewContainer) previewContainer.style.display = 'none';
  _ctxDirty = false;
  
  // Apply current search filter if any
  onContextSearch();
}
window.renderContextConfig = renderContextConfig;

/* ── Tree View Helpers ── */
function toggleFolder(id) {
  const el = document.getElementById(id);
  const icon = document.getElementById('icon-' + id);
  if (!el) return;
  if (el.style.display === 'none') {
    el.style.display = 'flex';
    if (icon) icon.classList.add('expanded');
  } else {
    el.style.display = 'none';
    if (icon) icon.classList.remove('expanded');
  }
}
window.toggleFolder = toggleFolder;

function toggleFolderSelection(e, folderId) {
  e.stopPropagation();
  if (!_ctxConfig || _ctxConfig.scope !== 'custom') return;
  const folder = document.getElementById(folderId);
  if (!folder) return;
  const checkboxes = folder.querySelectorAll('.file-checkbox');
  const isChecked = e.target.checked;
  
  checkboxes.forEach(cb => {
    cb.checked = isChecked;
    const filename = cb.getAttribute('data-filename');
    if (filename) {
      var selected = Array.isArray(_ctxConfig.selected_files) ? _ctxConfig.selected_files.slice() : [];
      var idx = selected.indexOf(filename);
      if (isChecked && idx < 0) {
        selected.push(filename);
      } else if (!isChecked && idx >= 0) {
        selected.splice(idx, 1);
      }
      _ctxConfig.selected_files = selected;
    }
  });
  
  _ctxDirty = true;
  const saveBtn = document.getElementById('contextSaveBtn');
  if (saveBtn) saveBtn.style.opacity = '1';
  
  // Re-render to update counts, but that might collapse folders, so let's just trigger a save intent
}
window.toggleFolderSelection = toggleFolderSelection;

function onContextSearch() {
  const input = document.getElementById('contextSearchInput');
  if (!input) return;
  const term = input.value.toLowerCase().trim();
  const rows = document.querySelectorAll('.context-tree-node .file-row');
  
  rows.forEach(row => {
    const text = row.getAttribute('data-search') || '';
    if (term === '' || text.includes(term)) {
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  });
  
  // Expand parent folders automatically if we are searching
  if (term !== '') {
    document.querySelectorAll('.context-tree-children').forEach(el => {
      el.style.display = 'flex';
    });
    document.querySelectorAll('.context-tree-toggle').forEach(el => {
      el.classList.add('expanded');
    });
  }
}
window.onContextSearch = onContextSearch;

/* ── Handle scope change ── */
function onContextScopeChange() {
  const select = document.getElementById('contextScopeSelect');
  if (!select || !_ctxConfig) return;
  const newScope = select.value;

  // When switching away from "custom", keep current selection but disable checkboxes
  // When switching TO "custom", enable checkboxes with current selection

  // Update local state
  _ctxConfig.scope = newScope;

  // Re-render to reflect disabled/enabled state
  renderContextConfig(_ctxConfig);
  _ctxDirty = true;

  // Enable save button
  const saveBtn = document.getElementById('contextSaveBtn');
  if (saveBtn) saveBtn.style.opacity = '1';

  _ctxToast('Scope changed to "' + newScope + '". Click Save to apply.', 'info');
}
window.onContextScopeChange = onContextScopeChange;

/* ── Toggle individual file selection (custom mode only) ── */
function toggleContextFile(filename) {
  if (!_ctxConfig || _ctxConfig.scope !== 'custom') return;

  // Toggle in selected_files
  var selected = Array.isArray(_ctxConfig.selected_files) ? _ctxConfig.selected_files.slice() : [];
  var idx = selected.indexOf(filename);
  if (idx >= 0) {
    selected.splice(idx, 1);
  } else {
    selected.push(filename);
  }
  _ctxConfig.selected_files = selected;
  _ctxDirty = true;

  // Update checkbox state without full re-render
  // Note: browser already toggled the checkbox via the native click event,
  // so we just sync it to match the array state (no manual re-toggle)
  var checkboxes = document.querySelectorAll('#contextFilesContainer input[type=checkbox]');
  checkboxes.forEach(function(cb) {
    var fn = cb.getAttribute('data-filename');
    if (fn === filename) {
      cb.checked = (selected.indexOf(filename) >= 0);
    }
  });

  // Update count in status text
  var totalAvailable = 0;
  var selectedCount = 0;
  if (_ctxConfig.sources) {
    _ctxConfig.sources.forEach(function(s) {
      (s.files || []).forEach(function(f) {
        if (f.available) {
          totalAvailable++;
          if (selected.indexOf(f.name) >= 0) selectedCount++;
        }
      });
    });
  }
  var statusText = document.getElementById('contextStatusText');
  if (statusText && _ctxConfig.scope === 'custom') {
    statusText.textContent = 'Custom selection: only checked files are injected. (' + selectedCount + '/' + totalAvailable + ' files selected)';
  }
}
window.toggleContextFile = toggleContextFile;

/* ── Preview what the agent will receive ── */
async function previewContextContent() {
  const container = document.getElementById('contextPreviewContainer');
  if (!container) return;

  if (!_ctxConfig) {
    _ctxToast('No context config loaded', 'error');
    return;
  }

  container.style.display = '';
  container.innerHTML = '<div style="text-align:center;padding:12px;color:var(--gray);font-size:11px"><i class="fas fa-spinner fa-spin"></i> Loading preview...</div>';

  try {
    // Determine which files would be injected based on current scope + selection
    var scope = _ctxConfig.scope;
    var selected = Array.isArray(_ctxConfig.selected_files) ? _ctxConfig.selected_files : [];

    var filesToPreview = [];

    if (_ctxConfig.sources) {
      _ctxConfig.sources.forEach(function(source) {
        (source.files || []).forEach(function(file) {
          if (!file.available) return;
          var include = false;
          if (scope === 'workspace_and_project') {
            include = true;
          } else if (scope === 'project_only') {
            include = source.source === 'project';
          } else if (scope === 'custom') {
            include = selected.indexOf(file.name) >= 0;
          }
          if (include) {
            filesToPreview.push({
              name: file.name,
              source: source.source,
              sourceLabel: source.source === 'workspace' ? 'Workspace (planning/)' : 'Project',
              size: file.size,
            });
          }
        });
      });
    }

    if (!filesToPreview.length) {
      container.innerHTML = '<div class="context-preview-empty">No files selected — agent will receive no planning context.</div>';
      return;
    }

    var apiBase = window.API_BASE || '';
    // Project id is exposed as window.OliviaProjectId by projects.js
    var projectId = window.OliviaProjectId || null;

    var previewHtml = '<div class="context-preview-box">';
    previewHtml += '<div class="context-preview-header"><span><i class="fas fa-code"></i> Agent Will Receive (' + filesToPreview.length + ' file(s))</span>';
    previewHtml += '<span style="color:var(--gray);font-size:9px">scope: ' + _ctxEscape(scope) + '</span></div>';

    var loadedCount = 0;
    for (var i = 0; i < filesToPreview.length; i++) {
      var f = filesToPreview[i];
      var contentPreview = '';

      // Try to fetch content for project files only (workspace files have no public API)
      if (f.source === 'project' && projectId) {
        try {
          var url = apiBase + '/api/projects/' + encodeURIComponent(projectId) + '/raw?path=' + encodeURIComponent(f.name);
          var res = await fetch(url);
          if (res.ok) {
            var text = await res.text();
            contentPreview = text.substring(0, 300);
            if (text.length > 300) contentPreview += '\n... (truncated)';
          }
        } catch (_e) {
          contentPreview = '(preview unavailable)';
        }
      } else if (f.source === 'workspace') {
        contentPreview = '(file from workspace planning/ directory — content available in agent context)';
      } else {
        contentPreview = '(preview unavailable — no active project)';
      }

      var color = _PLANNING_COLORS[f.name] || 'var(--gray)';
      var icon = _PLANNING_ICONS[f.name] || 'fa-file-lines';
      var label = _PLANNING_LABELS[f.name] || f.name;

      previewHtml += '<div style="padding:6px 8px;border-bottom:1px solid var(--border)">';
      previewHtml += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">';
      previewHtml += '<i class="fas ' + icon + '" style="color:' + color + ';font-size:10px"></i>';
      previewHtml += '<span style="color:var(--white);font-size:10px;font-weight:600">' + _ctxEscape(label) + '</span>';
      previewHtml += '<span style="color:var(--gray);font-size:9px">(' + _ctxEscape(f.sourceLabel) + ')</span>';
      if (f.size) previewHtml += '<span style="color:var(--gray);font-size:9px">' + _ctxEscape(_ctxFormatBytes(f.size)) + '</span>';
      previewHtml += '</div>';
      previewHtml += '<div class="context-preview-content">' + (contentPreview ? _ctxEscape(contentPreview) : '(empty)') + '</div>';
      previewHtml += '</div>';

      loadedCount++;
    }

    previewHtml += '</div>';
    container.innerHTML = previewHtml;

    if (!loadedCount) {
      container.innerHTML = '<div class="context-preview-empty">Could not fetch content for preview.</div>';
    }
  } catch (e) {
    container.innerHTML = '<div class="context-preview-empty">Preview error: ' + _ctxEscape(e.message) + '</div>';
    _ctxToast('Preview failed', 'error');
  }
}
window.previewContextContent = previewContextContent;

/* ── Save context config to backend ── */
async function saveContextConfig() {
  const saveBtn = document.getElementById('contextSaveBtn');
  const notice = document.getElementById('contextSavedNotice');

  if (!_ctxConfig) {
    _ctxToast('No config loaded', 'error');
    return;
  }

  // Disable button during save
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
  }

  try {
    var body = {
      scope: _ctxConfig.scope,
    };

    // Include selected_files when scope is custom, or pass empty array for project_only
    if (_ctxConfig.scope === 'custom') {
      body.selected_files = Array.isArray(_ctxConfig.selected_files) ? _ctxConfig.selected_files : [];
    } else {
      body.selected_files = [];
    }

    const res = await fetch((window.API_BASE || '') + '/api/user/context-files', {
      method: 'POST',
      headers: _ctxAuthHeaders(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      var errData = await res.json().catch(function() { return {}; });
      throw new Error(errData.error || 'HTTP ' + res.status);
    }

    _ctxDirty = false;
    _ctxConfig.scope = body.scope;
    _ctxConfig.selected_files = body.selected_files;

    // Show saved notice
    if (notice) {
      notice.classList.add('show');
      setTimeout(function() { notice.classList.remove('show'); }, 2500);
    }

    _ctxToast('Context settings saved', 'success');

    // Re-fetch fresh state to sync with backend
    await loadContextConfig();
  } catch (e) {
    _ctxToast('Save failed: ' + e.message, 'error');
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i class="fas fa-floppy-disk"></i> Save';
    }
  }
}
window.saveContextConfig = saveContextConfig;

/* ── Auto-load when project tab becomes active (called from projects.js hook) ── */
function initContextConfig() {
  if (window.__ctxConfigInited) return;
  window.__ctxConfigInited = true;

  // Detect clicks on the Session Files tab to lazy-load context config
  document.addEventListener('click', function(e) {
    var tab = e.target && e.target.closest ? e.target.closest('.sidebar-tab, .tree-leaf') : null;
    if (!tab) return;
    var label = (tab.getAttribute('data-label') || '').trim();
    if (label === 'Arquivos' || label === 'Files' || label === 'Session Files' || (tab.getAttribute('onclick') || '').indexOf("'files'") > -1) {
      // Lazy load: wait a beat for project tab to render, then check if we should preload
      setTimeout(function() {
        var chevron = document.getElementById('contextConfigChevron');
        if (chevron && !chevron.classList.contains('open')) {
          // Don't auto-open, just cache the config in background
          if (!_ctxConfig) {
            var pidHint = '';
            if (typeof getCurrentProjectId === 'function') {
              var p = String(getCurrentProjectId() || '').trim();
              if (p) pidHint = '?project_id=' + encodeURIComponent(p);
            }
            fetch((window.API_BASE || '') + '/api/user/context-files' + pidHint, {
              headers: _ctxAuthHeaders(),
            })
              .then(function(r) { return r.json(); })
              .then(function(d) {
                // Only cache valid responses (no auth error, has sources array)
                if (d && !d.error && Array.isArray(d.sources)) {
                  _ctxConfig = d;
                }
              })
              .catch(function() {});
          }
        }
      }, 500);
    }
  }, true);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initContextConfig);
} else {
  initContextConfig();
}
