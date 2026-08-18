/* ═══════════════════════════════════════════════════════════════════
   DISCOVERY MODULE - Document analysis, insights, and intelligence
   Wired to TheBridge via /api/bridge gateway endpoints
   ═══════════════════════════════════════════════════════════════════ */

// Bridge base URL — all TheBridge calls go through /api/bridge
const _BRIDGE_SERVER = (() => {
  const runtime = (window.Olivia && typeof window.Olivia === 'object')
    ? window.OliviaLegal
    : ((window.LA8159 && typeof window.LA8159 === 'object') ? window.LA8159 : {});

  const viaLA8159 = runtime && runtime.bridge
    ? String(runtime.bridge).trim()
    : '';
  if (viaLA8159) return viaLA8159.replace(/\/$/, '');

  const viaDsc = runtime && runtime.dsc
    ? String(runtime.dsc).trim()
    : '';
  if (viaDsc) return viaDsc.replace('/api/discovery', '/api/bridge').replace(/\/$/, '');

  if (typeof API_BASE !== 'undefined' && API_BASE) {
    return String(API_BASE).replace(/\/$/, '') + '/api/bridge';
  }

  const origin = (runtime && runtime.gateway && runtime.gateway.base)
    ? String(runtime.gateway.base).replace(/\/$/, '')
    : window.location.origin;
  return origin.replace(/\/$/, '') + '/api/bridge';
})();

// Legacy alias for any inline HTML references
const _DSC_SERVER = _BRIDGE_SERVER;

// Discovery global state
let _discAllFiles = [];
let _discUploadedFiles = [];
let _discCategoriesData = {};
let _discPipelineStats = null;
let _discEntitiesData = null;
let _discTimelineData = null;
let _discIntelData = null;
let _discCaseState = null;
let _discNarrative = null;
let _discGapReport = null;
let _discViolations = null;
let _discIntelSummary = null;
let _discIntelTimeline = null;
let _discCaseGraph = null;
let _discComprehendOverview = null;
let _discComprehendGroups = null;
let _discCasePhase = null;
let _discCaseFindings = null;
let _discCaseNextSteps = null;
let _discEventsData = null;
let _discRouteSupport = {
  indexSection: null,
  comprehendOverview: null,
  comprehendGroups: null,
  intelligenceCaseState: null,
  intelligenceSummary: null,
  intelligenceViolations: null,
  intelligenceGapReport: null,
  intelligenceTimeline: null,
  intelligenceCasePhase: null,
  intelligenceCaseFindings: null,
  intelligenceCaseNextSteps: null,
  events: null,
};
let _discProjectMirrorIndex = new Map();

function _discBridgeFileUrl(relPath) {
  const rel = String(relPath || '').replace(/^\/+/, '');
  if (!rel) return '';
  const encoded = rel.split('/').filter(Boolean).map(encodeURIComponent).join('/');
  return _BRIDGE_SERVER.replace(/\/$/, '') + '/files/' + encoded;
}

function _discBridgeRawUrl(relPath) {
  const rel = String(relPath || '').replace(/^\/+/, '');
  if (!rel) return '';
  return _BRIDGE_SERVER.replace(/\/$/, '') + '/raw?file=' + encodeURIComponent(rel);
}

function _discNormalizeBridgeListPath(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const withoutQuery = raw.split('?')[0];
  const cleaned = withoutQuery.replace(/^https?:\/\/[^/]+/i, '');
  const routeMatch = cleaned.match(/\/api\/(?:bridge\/)?files\/(.+)$/i);
  const candidate = routeMatch ? routeMatch[1] : cleaned.replace(/^\/+/, '');
  try {
    return decodeURIComponent(candidate.replace(/\\/g, '/'));
  } catch {
    return candidate.replace(/\\/g, '/');
  }
}

function _discBuildBridgeFileSet() {
  const set = new Set();
  for (const file of (_discAllFiles || [])) {
    const fields = [
      file && file.relativePath,
      file && file.relative_path,
      file && file.file,
      file && file.path,
      file && file.route,
      file && file.url,
      file && file.name,
      file && file.displayName,
      file && file.fileName,
    ];
    for (const field of fields) {
      const normalized = _discNormalizeBridgeListPath(field);
      if (normalized) set.add(normalized);
    }
  }
  return set;
}

function _discHasBridgeArtifact(fileSet, name) {
  const base = String(name || '').split('/').pop();
  return fileSet.has(name) || fileSet.has(`documents_scanned/${name}`) || (!!base && fileSet.has(base));
}

async function _discEnsureFunctionsRegistry() {
  const registry = window.Olivia_FUNCTIONS;
  if (!registry || typeof registry.init !== 'function') return null;
  try {
    await registry.init();
  } catch (_) {
    // Ignore registry init errors; unsupported endpoints gracefully fallback.
  }
  return registry;
}

async function _discSupportsBridgeEndpoint(method, bridgePath) {
  try {
    const registry = await _discEnsureFunctionsRegistry();
    if (!registry || typeof registry.matchEndpoint !== 'function') return false;
    const normalizedPath = String(bridgePath || '').startsWith('/') ? String(bridgePath) : ('/' + String(bridgePath || ''));
    const canonicalPath = '/api/bridge' + normalizedPath;
    const absolutePath = _BRIDGE_SERVER.replace(/https?:\/\/[^/]+/i, '') + normalizedPath;
    return !!(
      registry.matchEndpoint(method, canonicalPath) ||
      registry.matchEndpoint(method, absolutePath) ||
      registry.matchEndpoint(method, _BRIDGE_SERVER + normalizedPath)
    );
  } catch (_) {
    return false;
  }
}

async function _discSupportsIndexSection() {
  if (_discRouteSupport.indexSection !== null) return _discRouteSupport.indexSection;
  _discRouteSupport.indexSection = await _discSupportsBridgeEndpoint('POST', '/index-section');
  return _discRouteSupport.indexSection;
}

async function _discLoadProjectMirrorIndex() {
  _discProjectMirrorIndex = new Map();

  const projectId = (typeof getCurrentProjectId === 'function') ? getCurrentProjectId() : null;
  if (!projectId) return [];

  const profile = _discGetSectionProfile('descoberta', 'discovery_files');
  const section = String(profile.workspace_folder || 'discovery_files').replace(/^\/+|\/+$/g, '');
  const prefix = section ? `${section}/` : '';
  const scopedFiles = [];

  try {
    const res = await fetch(`${API_BASE}/api/projects/${encodeURIComponent(projectId)}/files`);
    if (!res.ok) return [];
    const data = await res.json().catch(() => ({}));
    const files = Array.isArray(data.files) ? data.files : [];

    for (const entry of files) {
      const relPath = String(entry && entry.name || '').replace(/\\/g, '/');
      if (!relPath) continue;
      if (prefix && !relPath.startsWith(prefix)) continue;
      const scopedPath = prefix ? relPath.slice(prefix.length) : relPath;
      if (!scopedPath) continue;
      if (_discIsIgnoredUploadPath(scopedPath)) continue;
      const base = relPath.split('/').pop();
      if (!base) continue;

      scopedFiles.push({
        scoped_path: scopedPath,
        project_path: relPath,
        size: Number(entry && entry.size) || 0,
      });

      if (!_discProjectMirrorIndex.has(relPath)) _discProjectMirrorIndex.set(relPath, relPath);
      if (!_discProjectMirrorIndex.has(scopedPath)) _discProjectMirrorIndex.set(scopedPath, relPath);
      if (!_discProjectMirrorIndex.has(base)) _discProjectMirrorIndex.set(base, relPath);
    }

    scopedFiles.sort((a, b) => String(a.scoped_path || '').localeCompare(String(b.scoped_path || '')));
    return scopedFiles;
  } catch (_) {
    _discProjectMirrorIndex = new Map();
    return [];
  }
}

function _discBuildCategoriesFromFiles(files) {
  const map = {};
  for (const f of (files || [])) {
    const key = String(f.category || f.categoryLabel || f.category_label || 'discovery_files').trim() || 'discovery_files';
    if (!map[key]) map[key] = { label: key, count: 0, kinds: {} };
    map[key].count += 1;
    const kind = String((f.kind || discGetFileExt(f.displayName || f.name || f.fileName || '') || 'file')).toLowerCase();
    map[key].kinds[kind] = (map[key].kinds[kind] || 0) + 1;
  }
  return map;
}

function _discResolveProjectMirrorUrl(file) {
  if (!_discProjectMirrorIndex || !_discProjectMirrorIndex.size) return '';

  const projectId = (typeof getCurrentProjectId === 'function') ? getCurrentProjectId() : null;
  if (!projectId) return '';

  const candidates = [
    file && file.relativePath,
    file && file.relative_path,
    file && file.file,
    file && file.fileName,
    file && file.file_name,
    file && file.name,
  ];

  for (const candidate of candidates) {
    const normalized = _discNormalizeBridgeListPath(candidate);
    if (!normalized) continue;
    const base = normalized.split('/').pop();
    const relPath = _discProjectMirrorIndex.get(normalized) || (base ? _discProjectMirrorIndex.get(base) : '');
    if (relPath) {
      return `${API_BASE}/api/projects/${encodeURIComponent(projectId)}/raw?path=${encodeURIComponent(relPath)}`;
    }
  }

  return '';
}

async function _discFetchBridgeIntelligenceFile(relPath, asText) {
  const url = _discBridgeFileUrl(relPath);
  if (!url) return null;
  const res = await fetch(url);
  if (!res.ok) return null;
  if (asText) return await res.text();
  return await res.json().catch(() => null);
}

async function _discLoadIntelligenceFromArtifacts() {
  if (!_discAllFiles.length) {
    try { await discLoadFiles(); } catch (_) { }
  }

  const fileSet = _discBuildBridgeFileSet();
  const intelBasenames = new Set([
    'pipeline_summary.json',
    'violations.json',
    'gap_report.json',
    'timeline.json',
    'case_state.json',
    'events.json',
    'narrative.md',
  ]);
  const hasIntelFolder = Array.from(fileSet).some(p => {
    if (p.startsWith('_intelligence/')) return true;
    const base = p.split('/').pop();
    return intelBasenames.has(base || '');
  });
  if (!hasIntelFolder) return false;

  const hasFile = (name) => _discHasBridgeArtifact(fileSet, name);

  const summary = hasFile('_intelligence/pipeline_summary.json')
    ? await _discFetchBridgeIntelligenceFile('_intelligence/pipeline_summary.json', false)
    : null;
  const violations = hasFile('_intelligence/violations.json')
    ? await _discFetchBridgeIntelligenceFile('_intelligence/violations.json', false)
    : null;
  const gapReport = hasFile('_intelligence/gap_report.json')
    ? await _discFetchBridgeIntelligenceFile('_intelligence/gap_report.json', false)
    : null;
  const timeline = hasFile('_intelligence/timeline.json')
    ? await _discFetchBridgeIntelligenceFile('_intelligence/timeline.json', false)
    : null;
  const caseState = hasFile('_intelligence/case_state.json')
    ? await _discFetchBridgeIntelligenceFile('_intelligence/case_state.json', false)
    : null;
  const events = hasFile('_intelligence/events.json')
    ? await _discFetchBridgeIntelligenceFile('_intelligence/events.json', false)
    : null;
  const narrativeMd = hasFile('_intelligence/narrative.md')
    ? await _discFetchBridgeIntelligenceFile('_intelligence/narrative.md', true)
    : null;

  if (summary && !summary.error) {
    _discIntelSummary = summary;
    discRenderNarrative(discBuildNarrativePayload(summary));
  } else if (narrativeMd) {
    discRenderNarrative({ text: String(narrativeMd || '') });
  }

  if (violations && !violations.error) {
    _discViolations = violations;
    const items = Array.isArray(violations) ? violations : (violations.violations || violations.items || []);
    discRenderViolations({ items });
  }

  if (gapReport && !gapReport.error) {
    _discGapReport = gapReport;
    const gaps = Array.isArray(gapReport) ? gapReport : (gapReport.gaps || gapReport.items || []);
    discRenderGapReport({ gaps });
  }

  if (timeline && !timeline.error) {
    _discIntelTimeline = timeline;
    const eventsList = Array.isArray(timeline) ? timeline : (timeline.timeline || timeline.events || []);
    discRenderTimeline({ events: eventsList });
  }

  if (caseState && !caseState.error) {
    _discCaseState = caseState;
    discRenderCaseState(caseState);
    if (caseState.phase) {
      _discCasePhase = caseState.phase;
      discRenderCasePhase(caseState.phase);
    }
    if (Array.isArray(caseState.findings)) {
      _discCaseFindings = { findings: caseState.findings };
      discRenderCaseFindings(_discCaseFindings);
    }
    if (Array.isArray(caseState.next_steps)) {
      _discCaseNextSteps = { next_steps: caseState.next_steps };
      discRenderCaseNextSteps(_discCaseNextSteps);
    }
  }

  if (events && !events.error) {
    _discEventsData = events;
  }

  return true;
}

function _discNormalizeComprehendOverview(data) {
  if (!data || typeof data !== 'object') return data;
  if (data.overview || data.description || data.hint) return data;

  const synthesis = (data.synthesis && typeof data.synthesis === 'object') ? data.synthesis : {};
  const overviewText = synthesis.corpus_summary || synthesis.temporal_narrative || '';
  const descriptionText = synthesis.case_nature || synthesis.analysis_readiness || '';

  return {
    ...data,
    overview: overviewText || data.overview || '',
    description: descriptionText || data.description || ''
  };
}

function _discNormalizeComprehendGroups(data) {
  if (!data || data.hint) return data;
  if (Array.isArray(data)) return { groups: data };
  if (data.groups && Array.isArray(data.groups)) return data;

  const groups = Object.entries(data || {}).map(([name, value]) => {
    const payload = (value && typeof value === 'object') ? value : { description: value };
    const analysis = (payload.llm_analysis && typeof payload.llm_analysis === 'object') ? payload.llm_analysis : {};
    return {
      name,
      count: payload.count || 0,
      description:
        analysis.category_description ||
        analysis.case_relevance ||
        payload.description ||
        payload.summary ||
        ''
    };
  });

  return { groups };
}

async function _discLoadComprehensionFromArtifacts() {
  if (!_discAllFiles.length) {
    try { await discLoadFiles(); } catch (_) { }
  }

  const fileSet = _discBuildBridgeFileSet();
  const hasOverview = _discHasBridgeArtifact(fileSet, '_intelligence/corpus_overview.json') || _discHasBridgeArtifact(fileSet, 'corpus_overview.json');
  const hasGroups = _discHasBridgeArtifact(fileSet, '_intelligence/group_descriptions.json') || _discHasBridgeArtifact(fileSet, 'group_descriptions.json');

  if (!hasOverview && !hasGroups) return false;

  let loaded = false;
  const loadJson = async (candidates) => {
    for (const relPath of candidates) {
      const data = await _discFetchBridgeIntelligenceFile(relPath, false);
      if (data) return data;
    }
    return null;
  };

  if (hasOverview) {
    const rawOverview = await loadJson(['_intelligence/corpus_overview.json', 'corpus_overview.json']);
    if (rawOverview && !rawOverview.error) {
      const normalizedOverview = _discNormalizeComprehendOverview(rawOverview);
      _discComprehendOverview = normalizedOverview;
      discRenderComprehendOverview(normalizedOverview);
      loaded = true;
    }
  }

  if (hasGroups) {
    const rawGroups = await loadJson(['_intelligence/group_descriptions.json', 'group_descriptions.json']);
    if (rawGroups && !rawGroups.error) {
      const normalizedGroups = _discNormalizeComprehendGroups(rawGroups);
      _discComprehendGroups = normalizedGroups;
      discRenderComprehendGroups(normalizedGroups);
      loaded = true;
    }
  }

  return loaded;
}

function _discGetSectionProfile(sectionKey, fallbackFolder) {
  const activeAgent = (typeof selectedAgent !== 'undefined' && selectedAgent) ? selectedAgent : window.selectedAgent;
  const cfg = (activeAgent && activeAgent.config && typeof activeAgent.config === 'object')
    ? activeAgent.config
    : {};
  const profiles = (cfg.section_profiles && typeof cfg.section_profiles === 'object') ? cfg.section_profiles : {};
  const profile = (profiles[sectionKey] && typeof profiles[sectionKey] === 'object') ? profiles[sectionKey] : {};
  return {
    workspace_folder: String(profile.workspace_folder || fallbackFolder || sectionKey).trim() || sectionKey,
    qdrant_collection: String(profile.qdrant_collection || 'uploads-global').trim() || 'uploads-global',
    graph_enabled: !!profile.graph_enabled
  };
}

function _discCurrentProjectLabel() {
  const pid = (typeof getCurrentProjectId === 'function') ? String(getCurrentProjectId() || '').trim() : '';
  if (!pid) return { hasProject: false, projectId: '', name: 'nenhum' };

  let name = '';
  const selectedNameEl = document.querySelector('#projectList .project-item.selected .project-name');
  if (selectedNameEl) name = String(selectedNameEl.textContent || '').trim();

  if (!name) {
    const currentEl = document.getElementById('projectCurrent');
    const currentText = currentEl ? String(currentEl.textContent || '').trim() : '';
    const m = currentText.match(/^Projeto atual:\s*(.+?)(?:\s*\(\d+\s+arquivos\))?$/i);
    if (m && m[1] && String(m[1]).toLowerCase() !== 'nenhum') {
      name = String(m[1]).trim();
    }
  }

  if (!name) name = pid;
  return { hasProject: true, projectId: pid, name };
}

function discUpdateActiveProjectLabel() {
  const labelEl = document.getElementById('discActiveProjectName');
  const pillEl = document.getElementById('discActiveProjectPill');
  if (!labelEl) return;

  const t = (k, d) => (typeof window.t === 'function' ? window.t(k, d) : d);
  const info = _discCurrentProjectLabel();
  if (!info.hasProject) {
    labelEl.textContent = t('ui.projetoAtivoNone', 'Active project: none');
    if (pillEl) {
      pillEl.classList.add('is-empty');
      pillEl.title = t('ui.discSelectProject', 'Select a project for the Discovery scope');
    }
    return;
  }

  labelEl.textContent = t('ui.projetoAtivo', 'Active project: %s').replace('%s', info.name);
  if (pillEl) {
    pillEl.classList.remove('is-empty');
    pillEl.title = t('ui.projetoId', 'Project ID: %s').replace('%s', info.projectId);
  }
}

async function _discMirrorFilesToProject(profile) {
  const projectId = (typeof getCurrentProjectId === 'function') ? getCurrentProjectId() : null;
  if (!projectId) throw new Error((typeof window.t === 'function' ? window.t('ui.discSelectFirst', 'Select an active project before processing Discovery files.') : 'Select an active project before processing Discovery files.'));

  const fd = new FormData();
  for (const f of _discUploadedFiles) {
    const relPath = String(f && (f.relativePath || f.name) || '');
    if (_discIsIgnoredUploadPath(relPath)) continue;
    if (f._file) fd.append('files', f._file, f._file.webkitRelativePath || f.name);
  }
  if (!fd.has('files')) return;

  const section = profile.workspace_folder || 'discovery_files';
  const res = await fetch(
    `${API_BASE}/api/projects/${encodeURIComponent(projectId)}/upload?section=${encodeURIComponent(section)}&preserve_paths=true`,
    { method: 'POST', body: fd }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || `HTTP ${res.status}`);
  }

  const activeAgent = (typeof selectedAgent !== 'undefined' && selectedAgent) ? selectedAgent : window.selectedAgent;
  if (activeAgent && activeAgent.agent_id) {
    fetch(`${API_BASE}/api/projects/${encodeURIComponent(projectId)}/index/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_id: activeAgent.agent_id, agent_name: activeAgent.name || '' })
    }).catch(() => { });
  }
}

async function _discIndexSectionFiles(result, profile) {
  const supportsIndexSection = await _discSupportsIndexSection();
  if (!supportsIndexSection) {
    return {
      status: 'unsupported',
      reason: 'index_section_unavailable',
      ingested_chunks: 0,
    };
  }

  const files = (result && Array.isArray(result.files)) ? result.files : [];
  const includeFiles = files.map(f => String(f.name || '').trim()).filter(Boolean);
  const r = await fetch(`${API_BASE}/api/bridge/index-section`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      section: 'descoberta',
      workspace_folder: profile.workspace_folder,
      collection: profile.qdrant_collection,
      graph_enabled: !!profile.graph_enabled,
      include_files: includeFiles,
      max_files: Math.max(1, includeFiles.length || 1),
      max_chunks_per_file: 24,
      chunk_size: 1800
    })
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    if (r.status === 404) {
      _discRouteSupport.indexSection = false;
      return {
        status: 'unsupported',
        reason: 'index_section_404',
        detail: err.detail || err.error || 'HTTP 404',
        ingested_chunks: 0,
      };
    }
    throw new Error(err.detail || err.error || `HTTP ${r.status}`);
  }
  return r.json();
}

// Show discovery view
function discShowView() {
  const hide = ['chatHeader', 'welcomeState', 'chatLog', 'chatCompose', 'chatToolbar'];
  hide.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
  // Collapse main-content so disc-view gets the full flex:1 width
  const mc = document.querySelector('.main-content');
  if (mc) { mc._dscDisplay = mc.style.display; mc.style.display = 'none'; }
  if (typeof aexHideMain === 'function') aexHideMain();
  const dv = document.getElementById('descobertaView');
  if (dv) dv.classList.add('active');
  const op = document.getElementById('outputPanel');
  const bp = document.getElementById('browserPanel');
  if (op) { op._discPrevOpen = op.classList.contains('open'); op.classList.remove('open'); }
  if (bp) { bp._discPrevOpen = bp.classList.contains('open'); bp.classList.remove('open'); }
  discUpdateActiveProjectLabel();
  // Auto-load files from TheBridge/documents_scanned
  discLoadFiles();
  discLoadOverview();
}

// Hide discovery view
function discHideView() {
  const dv = document.getElementById('descobertaView');
  if (dv) dv.classList.remove('active');
  // Exit maximized when hiding
  const ws = document.querySelector('.workspace');
  if (ws) ws.classList.remove('disc-maximized');
  const btn = document.getElementById('discMaxBtn');
  if (btn) btn.innerHTML = '<i class="fas fa-expand"></i>';
  // Restore main-content
  const mc = document.querySelector('.main-content');
  if (mc) { mc.style.display = mc._dscDisplay !== undefined ? mc._dscDisplay : ''; delete mc._dscDisplay; }
  const show = ['chatHeader', 'welcomeState', 'chatLog', 'chatCompose', 'chatToolbar'];
  show.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = ''; });
  const op = document.getElementById('outputPanel');
  const bp = document.getElementById('browserPanel');
  if (op && op._discPrevOpen) op.classList.add('open');
  if (bp && bp._discPrevOpen) bp.classList.add('open');
}

// Load files from TheBridge via GET /api/bridge/files
async function discLoadFiles() {
  discUpdateActiveProjectLabel();
  const tableEl = document.getElementById('discFileTable');
  if (tableEl) tableEl.innerHTML = '<div class="dsc-empty"><i class="fas fa-spinner fa-spin"></i><p>' + (typeof window.t === 'function' ? window.t('ui.loadingFiles', 'Loading files...') : 'Loading files...') + '</p></div>';
  const projectId = (typeof getCurrentProjectId === 'function') ? getCurrentProjectId() : null;
  if (!projectId) {
    _discAllFiles = [];
    _discProjectMirrorIndex = new Map();
    if (tableEl) tableEl.innerHTML = '<div class="dsc-empty"><i class="fas fa-folder-open"></i><p>' + (typeof window.t === 'function' ? window.t('ui.discSelectViewFiles', 'Select an active project to view Discovery files.') : 'Select an active project to view Discovery files.') + '</p></div>';
    const badgeTotalNoProject = document.getElementById('discBadgeTotal');
    if (badgeTotalNoProject) badgeTotalNoProject.textContent = '0';
    const elFiles = document.getElementById('discStatFiles');
    const elSize = document.getElementById('discStatSize');
    if (elFiles) elFiles.textContent = '0';
    if (elSize) elSize.textContent = '0 B';
    return;
  }

  const profile = _discGetSectionProfile('descoberta', 'discovery_files');
  const scoped = await _discLoadProjectMirrorIndex();
  if (scoped.length) {
    _discAllFiles = scoped.map((entry) => {
      const scopedPath = String(entry.scoped_path || '').replace(/\\/g, '/');
      const size = Number(entry.size) || 0;
      return {
        displayName: scopedPath,
        display_name: scopedPath,
        fileName: scopedPath,
        file_name: scopedPath,
        name: scopedPath,
        relativePath: scopedPath,
        relative_path: scopedPath,
        projectRelativePath: String(entry.project_path || scopedPath),
        size_bytes: size,
        size_human: formatBytes(size),
        categoryLabel: profile.workspace_folder || 'discovery_files',
        category: profile.workspace_folder || 'discovery_files',
        kind: (discGetFileExt(scopedPath) || 'file').toUpperCase(),
      };
    });
  } else {
    _discAllFiles = [];
    if (tableEl) {
      const sectionLabel = escapeHtml(profile.workspace_folder || 'discovery_files');
      tableEl.innerHTML = `<div class="dsc-empty"><i class="fas fa-folder-open"></i><p>${(typeof window.t === 'function' ? window.t('ui.noFilesInProject', 'No files in %s in the active project.') : 'No files in %s in the active project.').replace('%s', sectionLabel)}</p></div>`;
    }
  }

  _discCategoriesData = _discBuildCategoriesFromFiles(_discAllFiles);
  const badgeTotal = document.getElementById('discBadgeTotal');
  if (badgeTotal) badgeTotal.textContent = _discAllFiles.length;

  if (scoped.length) discRenderFileTable(_discAllFiles);
  discUpdateStats();
}

// Load overview (categories) from GET /api/bridge/categories
async function discLoadOverview() {
  _discCategoriesData = _discBuildCategoriesFromFiles(_discAllFiles);
  const badgeCat = document.getElementById('discBadgeCat');
  if (badgeCat) badgeCat.textContent = Object.keys(_discCategoriesData).length;
  // Populate category sub-items in sidebar
  const subCat = document.getElementById('discSubCat');
  if (subCat) {
    subCat.innerHTML = Object.entries(_discCategoriesData).map(([key, data]) =>
      `<div class="dsc-subitem" onclick="discFilterByCategory('${escapeHtml(key)}')"><i class="fas fa-folder"></i> ${escapeHtml(data.label || key)} <span style="opacity:.6;font-size:10px">(${data.count || 0})</span></div>`
    ).join('');
  }
  discRenderCategories();
  discUpdateStats();
}

// Load insights — stats, entities, timeline from GET /api/bridge/pipeline/*
async function discLoadInsights() {
  const [statsR, entR, tlR] = await Promise.allSettled([
    _discPipelineStats
      ? Promise.resolve(_discPipelineStats)
      : fetch(_BRIDGE_SERVER + '/pipeline/stats').then(r => r.ok ? r.json() : null),
    _discEntitiesData
      ? Promise.resolve(_discEntitiesData)
      : fetch(_BRIDGE_SERVER + '/pipeline/entities').then(r => r.ok ? r.json() : null),
    _discTimelineData
      ? Promise.resolve(_discTimelineData)
      : fetch(_BRIDGE_SERVER + '/pipeline/timeline').then(r => r.ok ? r.json() : null),
  ]);

  const stats = statsR.status === 'fulfilled' ? statsR.value : null;
  const ent = entR.status === 'fulfilled' ? entR.value : null;
  const tl = tlR.status === 'fulfilled' ? tlR.value : null;

  if (stats && !stats.error) {
    _discPipelineStats = stats;
    discRenderLanguages(stats.languages || {});
    discRenderDomains(stats.domains || {});
    // top_tags from API is [[name, count], ...] — extract names only
    const tagNames = (stats.top_tags || []).map(t => Array.isArray(t) ? t[0] : t);
    discRenderTags(tagNames);
  }
  if (ent && !ent.error) {
    // Summary format wraps entities in .entities; store inner map
    _discEntitiesData = ent.entities || ent;
    discRenderEntityList('people');
  }
  if (tl && !tl.error) {
    _discTimelineData = tl;
    discRenderTimeline(tl.timeline || tl);
  }
}

// Load intelligence — GET /api/bridge/intelligence/* and /case-state/*
async function discLoadIntelligence() {
  const loadedFromArtifacts = await _discLoadIntelligenceFromArtifacts();
  if (loadedFromArtifacts) return;

  // Compatibility mode: some bridge deployments expose intelligence only as
  // generated files under _intelligence and do not serve /case-state/* routes.
  // In that scenario we intentionally skip endpoint fan-out to avoid 404 noise.
  return;

  const [caseR, summaryR, violR, gapR, intelTlR, phaseR, findR, nextR] = await Promise.allSettled([
    _discCaseState
      ? Promise.resolve(_discCaseState)
      : fetch(_BRIDGE_SERVER + '/case-state').then(r => r.ok ? r.json() : null),
    _discIntelSummary
      ? Promise.resolve(_discIntelSummary)
      : fetch(_BRIDGE_SERVER + '/intelligence/summary').then(r => r.ok ? r.json() : null),
    _discViolations
      ? Promise.resolve(_discViolations)
      : fetch(_BRIDGE_SERVER + '/intelligence/violations').then(r => r.ok ? r.json() : null),
    _discGapReport
      ? Promise.resolve(_discGapReport)
      : fetch(_BRIDGE_SERVER + '/intelligence/gap-report').then(r => r.ok ? r.json() : null),
    _discIntelTimeline
      ? Promise.resolve(_discIntelTimeline)
      : fetch(_BRIDGE_SERVER + '/intelligence/timeline').then(r => r.ok ? r.json() : null),
    _discCasePhase
      ? Promise.resolve(_discCasePhase)
      : fetch(_BRIDGE_SERVER + '/case-state/phase').then(r => r.ok ? r.json() : null),
    _discCaseFindings
      ? Promise.resolve(_discCaseFindings)
      : fetch(_BRIDGE_SERVER + '/case-state/findings').then(r => r.ok ? r.json() : null),
    _discCaseNextSteps
      ? Promise.resolve(_discCaseNextSteps)
      : fetch(_BRIDGE_SERVER + '/case-state/next-steps').then(r => r.ok ? r.json() : null),
  ]);

  const caseData = caseR.status === 'fulfilled' ? caseR.value : null;
  const summaryData = summaryR.status === 'fulfilled' ? summaryR.value : null;
  const violData = violR.status === 'fulfilled' ? violR.value : null;
  const gapData = gapR.status === 'fulfilled' ? gapR.value : null;
  const intelTlData = intelTlR.status === 'fulfilled' ? intelTlR.value : null;
  const phaseData = phaseR.status === 'fulfilled' ? phaseR.value : null;
  const findData = findR.status === 'fulfilled' ? findR.value : null;
  const nextData = nextR.status === 'fulfilled' ? nextR.value : null;

  if (caseData && !caseData.error) {
    _discCaseState = caseData;
    discRenderCaseState(caseData);
  }
  if (summaryData && !summaryData.error) {
    _discIntelSummary = summaryData;
    discRenderNarrative(discBuildNarrativePayload(summaryData));
  }
  if (violData && !violData.error) {
    _discViolations = violData;
    const items = Array.isArray(violData) ? violData : (violData.violations || violData.items || []);
    discRenderViolations({ items });
  }
  if (gapData && !gapData.error) {
    _discGapReport = gapData;
    const gaps = Array.isArray(gapData) ? gapData : (gapData.gaps || gapData.items || []);
    discRenderGapReport({ gaps });
  }
  if (intelTlData && !intelTlData.error) {
    _discIntelTimeline = intelTlData;
    const events = Array.isArray(intelTlData) ? intelTlData : (intelTlData.timeline || intelTlData.events || []);
    discRenderTimeline({ events });
  }
  if (phaseData && !phaseData.error) { _discCasePhase = phaseData; discRenderCasePhase(phaseData); }
  if (findData && !findData.error) { _discCaseFindings = findData; discRenderCaseFindings(findData); }
  if (nextData && !nextData.error) { _discCaseNextSteps = nextData; discRenderCaseNextSteps(nextData); }
}

// Load pipeline status — GET /api/bridge/pipeline/stats
async function discLoadPipeline() {
  const el = document.getElementById('discPipelineStatus');
  const progressEl = document.getElementById('discPipelineProgress');
  try {
    const r = await fetch(_BRIDGE_SERVER + '/pipeline/stats');
    if (!r.ok) throw new Error('offline');
    const json = await r.json();
    if (json.error) throw new Error(json.error);
    _discPipelineStats = json;
    if (el) el.innerHTML = `
      <div class="dsc-pipe-item"><span class="dsc-pipe-label">Arquivos processados</span><span class="dsc-pipe-val">${json.files_enriched || 0}</span></div>
      <div class="dsc-pipe-item"><span class="dsc-pipe-label">Arquivos de texto</span><span class="dsc-pipe-val">${json.text_files || 0}</span></div>
      <div class="dsc-pipe-item"><span class="dsc-pipe-label">Total de palavras</span><span class="dsc-pipe-val">${(json.total_words || 0).toLocaleString()}</span></div>
      <div class="dsc-pipe-item"><span class="dsc-pipe-label">Com entidades</span><span class="dsc-pipe-val">${json.files_with_entities || 0}</span></div>
    `;
    if (progressEl) progressEl.style.width = json.files_enriched ? '100%' : '0%';
  } catch {
    if (el) el.innerHTML = '<div class="dsc-pipe-item"><span class="dsc-pipe-label">Pipeline</span><span class="dsc-pipe-val" style="color:var(--gray)">Aguardando execução</span></div>';
    if (progressEl) progressEl.style.width = '0%';
  }
  // Also load recent events
  discLoadEvents();
}

// Load events — GET /api/bridge/events
// Skip fetch if pipeline stats show nothing has been enriched yet (avoids a noisy console 404).
async function discLoadEvents() {
  const el = document.getElementById('discEvents');
  if (_discEventsData) {
    discRenderEvents(_discEventsData.events || _discEventsData);
    return;
  }

  if (!_discAllFiles.length) {
    try { await discLoadFiles(); } catch (_) { }
  }
  const fileSet = _discBuildBridgeFileSet();
  const hasEventsFile = fileSet.has('_intelligence/events.json') || fileSet.has('events.json');
  if (hasEventsFile) {
    try {
      const data = await _discFetchBridgeIntelligenceFile('_intelligence/events.json', false);
      if (data) {
        _discEventsData = data;
        discRenderEvents(data.events || data);
        return;
      }
    } catch (_) { }
    if (el && el.children.length === 0) {
      el.innerHTML = '<div class="dsc-empty"><p>Eventos ainda não disponíveis no artefato local.</p></div>';
    }
    return;
  }

  if (_discPipelineStats && (_discPipelineStats.files_enriched || 0) === 0) {
    if (el && el.children.length === 0) el.innerHTML = '<div class="dsc-empty"><p>Sem eventos — execute o pipeline primeiro</p></div>';
    return;
  }
  if (!hasEventsFile) {
    if (el && el.children.length === 0) el.innerHTML = '<div class="dsc-empty"><p>Sem eventos — execute o pipeline primeiro</p></div>';
    return;
  }
  try {
    const r = await fetch(_BRIDGE_SERVER + '/events');
    if (!r.ok) {
      if (r.status === 404) {
        if (el && el.children.length === 0) el.innerHTML = '<div class="dsc-empty"><p>Sem eventos — execute o pipeline primeiro</p></div>';
        return;
      }
      throw new Error('no events');
    }
    const data = await r.json();
    discRenderEvents(data.events || data);
  } catch {
    if (el && el.children.length === 0) el.innerHTML = '<div class="dsc-empty"><p>Sem eventos</p></div>';
  }
}

// Refresh all discovery data
function discRefreshAll() {
  // Invalidate all caches
  _discPipelineStats = null; _discEntitiesData = null; _discTimelineData = null;
  _discCaseState = null; _discIntelSummary = null; _discViolations = null;
  _discGapReport = null; _discIntelTimeline = null; _discCaseGraph = null;
  _discComprehendOverview = null; _discComprehendGroups = null;
  _discCasePhase = null; _discCaseFindings = null; _discCaseNextSteps = null;
  _discEventsData = null;
  discLoadFiles();
  discLoadOverview();
  discLoadInsights();
  discLoadIntelligence();
  discLoadPipeline();
}

// Render staged upload file list (files queued for upload, not yet sent)
function discRenderFileList(files) {
  const container = document.getElementById('discFileList');
  if (!container) return;
  const list = files || _discUploadedFiles;
  const html = list.map(f => `
    <div class="disc-file-item">
      <span class="disc-file-icon">${((f.kind || f.type || 'file').toUpperCase()).slice(0, 4)}</span>
      <span class="disc-file-name" title="${escapeHtml(f.relativePath || f.name || f.fileName || '')}">${escapeHtml(f.relativePath || f.name || f.fileName || '')}</span>
      <span class="disc-file-size">${formatBytes(f.size_bytes || f.size || 0)}</span>
      <button class="btn-xs" onclick="discRemoveFile('${f._id || ''}')" title="Remover"><i class="fas fa-times"></i></button>
    </div>
  `).join('');
  container.innerHTML = html;
}

function discGetFileExt(name) {
  const n = String(name || '').trim();
  if (!n.includes('.')) return '';
  return n.split('.').pop().toLowerCase();
}

function discEnsurePreviewExtension(name, fileType, previewInfo) {
  const rawName = String(name || '').trim();
  if (discGetFileExt(rawName)) return rawName;

  const info = previewInfo && typeof previewInfo === 'object' ? previewInfo : {};
  const explicitExt = String(info.extension || '').replace(/^\./, '').toLowerCase();
  if (explicitExt) return `${rawName || 'arquivo'}.${explicitExt}`;

  const fallbackMap = {
    pdf: 'pdf',
    html: 'html',
    markdown: 'md',
    json: 'json',
    text: 'txt',
    docx: 'docx',
    audio: 'mp3',
    image: 'png',
  };

  return fallbackMap[fileType] ? `${rawName || 'arquivo'}.${fallbackMap[fileType]}` : (rawName || 'arquivo');
}

function discFormatSeconds(totalSeconds) {
  const secs = Number(totalSeconds);
  if (!Number.isFinite(secs) || secs < 0) return '—';
  const rounded = Math.round(secs);
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function discMakeAudioPreviewHtml(url, name, previewInfo) {
  const info = previewInfo && typeof previewInfo === 'object' ? previewInfo : {};
  const mime = escapeHtml(info.mime || info.contentType || info.type || 'audio');
  const size = info.size ? formatBytes(info.size) : '—';
  return `
    <div style="padding:18px;display:flex;flex-direction:column;gap:14px;height:100%;box-sizing:border-box;justify-content:center;">
      <div>
        <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:4px;word-break:break-word;">${escapeHtml(name || 'Áudio')}</div>
        <div style="font-size:11px;color:var(--gray-hi);display:flex;gap:12px;flex-wrap:wrap;">
          <span><strong style="color:var(--text)">Tipo:</strong> ${mime}</span>
          <span><strong style="color:var(--text)">Tamanho:</strong> ${size}</span>
          <span><strong style="color:var(--text)">Duração:</strong> <span data-audio-duration>carregando…</span></span>
        </div>
      </div>
      <div style="padding:14px;border:1px solid var(--border);border-radius:10px;background:rgba(255,255,255,.03)">
        <audio controls preload="metadata" src="${escapeHtml(url)}" style="width:100%"></audio>
      </div>
      <div style="font-size:11px;color:var(--gray);line-height:1.5;">Pré-visualização com player nativo. O áudio pode ser ouvido diretamente aqui antes de abrir em outra aba.</div>
    </div>
  `;
}

function discAttachAudioPreviewMeta(container) {
  if (!container) return;
  const audio = container.querySelector('audio');
  const durationEl = container.querySelector('[data-audio-duration]');
  if (!audio || !durationEl) return;

  const updateDuration = () => {
    durationEl.textContent = discFormatSeconds(audio.duration);
  };

  const showError = () => {
    durationEl.textContent = 'indisponível';
  };

  audio.addEventListener('loadedmetadata', updateDuration, { once: true });
  audio.addEventListener('error', showError, { once: true });
  if (Number.isFinite(audio.duration) && audio.duration > 0) updateDuration();
}

function discResolveFileUrl(file) {
  if (!file) return '';

  const relCandidates = [
    file.relativePath,
    file.relative_path,
    file.file,
    file.path,
  ];

  for (const field of relCandidates) {
    const normalized = _discNormalizeBridgeListPath(field);
    if (normalized && !/^files\//i.test(normalized)) {
      const rawUrl = _discBridgeRawUrl(normalized);
      if (rawUrl) return rawUrl;
    }
  }

  const route = file.route ? String(file.route) : '';
  if (route) {
    if (/^https?:\/\//i.test(route)) return route;
    if (_BRIDGE_SERVER) {
      if (route.startsWith('/api/')) return _BRIDGE_SERVER + route.replace(/^\/api/, '');
      if (route.startsWith('/')) return _BRIDGE_SERVER + route;
      return _BRIDGE_SERVER + '/' + route;
    }
    return route;
  }

  const rawUrl = file.url ? String(file.url) : '';
  if (!rawUrl) return '';

  try {
    const u = new URL(rawUrl, window.location.origin);
    if (_BRIDGE_SERVER && u.pathname.startsWith('/api/')) {
      return _BRIDGE_SERVER + u.pathname.replace(/^\/api/, '') + (u.search || '');
    }
    return u.toString();
  } catch {
    return rawUrl;
  }
}

function _discResolveProjectRelativePath(file) {
  if (!file) return '';
  const directPath = String(file.projectRelativePath || file.project_relative_path || '').trim();
  if (directPath) return directPath;

  const candidates = [
    file.relativePath,
    file.relative_path,
    file.file,
    file.path,
    file.fileName,
    file.file_name,
    file.name,
    file.displayName,
  ];

  for (const candidate of candidates) {
    const normalized = _discNormalizeBridgeListPath(candidate);
    if (!normalized) continue;
    const base = normalized.split('/').pop();
    const relPath = _discProjectMirrorIndex.get(normalized) || (base ? _discProjectMirrorIndex.get(base) : '');
    if (relPath) return relPath;
  }
  return '';
}

async function discDeleteProjectFile(projectRelPath, displayName) {
  const pid = (typeof getCurrentProjectId === 'function') ? getCurrentProjectId() : null;
  if (!pid) {
    addSystemBubble((typeof window.t === 'function' ? window.t('ui.discSelectDelete', 'Select an active project to delete files.') : 'Select an active project to delete files.'));
    return;
  }

  const relPath = String(projectRelPath || '').trim();
  if (!relPath) return;
  const label = String(displayName || relPath.split('/').pop() || relPath);
  const confirmed = window.confirm((typeof window.t === 'function' ? window.t('ui.deleteFileConfirm', 'Delete file "%s" from the active project?') : 'Delete file "%s" from the active project?').replace('%s', label));
  if (!confirmed) return;

  try {
    const res = await fetch(`${API_BASE}/api/projects/${encodeURIComponent(pid)}/file?path=${encodeURIComponent(relPath)}`, {
      method: 'DELETE',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);

    addSystemBubble(`Arquivo removido do projeto: ${label}`);
    if (typeof _toast === 'function') _toast('Arquivo removido', 'success');
    await discLoadFiles();
    await discLoadOverview();
    if (typeof loadDocsTree === 'function') loadDocsTree();
    if (typeof loadProjectFiles === 'function') loadProjectFiles();
  } catch (e) {
    addSystemBubble((typeof window.t === 'function' ? window.t('ui.deleteFileFailed', 'Failed to delete file: %s') : 'Failed to delete file: %s').replace('%s', e.message || e));
    if (typeof _toast === 'function') _toast((typeof window.t === 'function' ? window.t('ui.deleteFileFailedShort', 'Failed to delete file') : 'Failed to delete file'), 'error');
  }
}

function discInferFileType(name, kind) {
  const ext = discGetFileExt(name);
  const info = kind && typeof kind === 'object' ? kind : { kind };
  const joined = [
    info.kind,
    info.mime,
    info.contentType,
    info.type,
    info.category,
    info.label,
    info.extension,
  ]
    .filter(Boolean)
    .map(value => String(value).toLowerCase())
    .join(' ');

  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp'].includes(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  if (['docx', 'doc'].includes(ext)) return 'docx';
  if (['htm', 'html'].includes(ext)) return 'html';
  if (ext === 'json') return 'json';
  if (ext === 'md') return 'markdown';
  if (['mp3', 'wav', 'm4a', 'flac', 'ogg', 'aac'].includes(ext)) return 'audio';
  if (['mp4', 'mov', 'webm', 'mkv', 'avi', 'm4v', 'ogv'].includes(ext)) return 'video';
  if (['txt', 'log', 'csv', 'tsv', 'xml', 'yaml', 'yml'].includes(ext)) return 'text';
  if (joined.includes('pdf')) return 'pdf';
  if (joined.includes('officedocument.wordprocessingml') || joined.includes('msword') || joined.includes('word') || joined.includes('docx')) return 'docx';
  if (joined.includes('audio') || joined.includes('mp3') || joined.includes('wav') || joined.includes('m4a') || joined.includes('flac') || joined.includes('ogg')) return 'audio';
  if (joined.includes('video') || joined.includes('mp4') || joined.includes('webm') || joined.includes('mov') || joined.includes('quicktime') || joined.includes('x-matroska')) return 'video';
  if (joined.includes('json')) return 'json';
  if (joined.includes('markdown')) return 'markdown';
  if (joined.includes('html')) return 'html';
  if (joined.includes('image')) return 'image';
  if (joined.includes('text') || joined.includes('plain') || joined.includes('csv') || joined.includes('xml') || joined.includes('yaml')) return 'text';
  return 'file';
}

function discEnsurePanelOpen(panelId, toggleFnName, arg) {
  const panel = document.getElementById(panelId);
  if (!panel) return;
  if (panel.classList.contains('open')) return;
  if (typeof window[toggleFnName] === 'function') {
    if (arg === undefined) window[toggleFnName]();
    else window[toggleFnName](arg);
    return;
  }
  panel.classList.add('open');
}

function discMakeTextPreviewHtml(rawText, fileName, type) {
  let text = String(rawText || '');
  const ext = discGetFileExt(fileName);

  if (text.length > 400000) {
    text = text.slice(0, 400000) + '\n\n... (truncated)';
  }

  if (type === 'json') {
    try {
      const parsed = JSON.parse(text);
      const pretty = JSON.stringify(parsed, null, 2);
      const keys = parsed && typeof parsed === 'object' ? Object.keys(parsed).length : 0;
      return `
        <div style="padding:12px 16px;border-bottom:1px solid var(--border);font-size:11px;color:var(--gray-hi)">
          JSON formatado${keys ? ` · ${keys} chaves de topo` : ''}
        </div>
        <pre style="padding:16px;margin:0;white-space:pre-wrap;word-break:break-word;font-family:var(--font-mono);font-size:12px;color:var(--text);overflow:auto;height:calc(100% - 44px);box-sizing:border-box;">${escapeHtml(pretty)}</pre>
      `;
    } catch {
      return `<pre style="padding:16px;margin:0;white-space:pre-wrap;word-break:break-word;font-family:var(--font-mono);font-size:12px;color:var(--text);overflow:auto;height:100%;box-sizing:border-box;">${escapeHtml(text)}</pre>`;
    }
  }

  if (type === 'markdown' && window.marked) {
    const rendered = marked.parse(text);
    return `<div style="padding:16px;color:var(--text);font-family:var(--font-sans);line-height:1.6;overflow:auto;height:100%;box-sizing:border-box;">${rendered}</div>`;
  }

  return `<pre style="padding:16px;margin:0;white-space:pre-wrap;word-break:break-word;font-family:var(--font-mono);font-size:12px;color:var(--text);overflow:auto;height:100%;box-sizing:border-box;">${escapeHtml(text)}</pre>`;
}

async function discOpenFilePreview(url, name, kind) {
  const fileType = discInferFileType(name, kind);
  const previewName = discEnsurePreviewExtension(name, fileType, kind);

  if (!url) return;

  if (typeof window.openPreviewUrl === 'function' && fileType !== 'file') {
    return window.openPreviewUrl(url, previewName, {
      fileType,
      displayName: name,
      mimeType: kind && typeof kind === 'object' ? (kind.mime || kind.contentType || kind.type || '') : '',
      size: kind && typeof kind === 'object' ? (kind.size || 0) : 0,
      sizeLabel: kind && typeof kind === 'object' ? (kind.sizeLabel || '') : '',
    });
  }

  const titleEl = document.getElementById('previewPanelTitle');
  const body = document.getElementById('previewBody');
  if (!body) {
    if (typeof window.openPreviewUrl === 'function') return window.openPreviewUrl(url, name);
    window.open(url, '_blank');
    return;
  }

  discEnsurePanelOpen('previewPanel', 'togglePreviewPanel', true);
  window._previewState = { url, name };

  const iconMap = {
    image: 'fa-file-image',
    pdf: 'fa-file-pdf',
    docx: 'fa-file-word',
    audio: 'fa-file-audio',
    video: 'fa-file-video',
    html: 'fa-file-code',
    json: 'fa-file-code',
    markdown: 'fa-file-lines',
    text: 'fa-file-lines',
    file: 'fa-file',
  };
  if (titleEl) {
    const iconCls = iconMap[fileType] || 'fa-file';
    titleEl.innerHTML = `<i class="fas ${iconCls}" style="margin-right:6px;font-size:12px;color:var(--blue)"></i> ${escapeHtml(name || 'Arquivo')}`;
  }

  const dlBtn = document.getElementById('previewDownloadBtn');
  const maxBtn = document.getElementById('previewMaximizeBtn');
  if (dlBtn) dlBtn.style.display = '';
  if (maxBtn) maxBtn.style.display = '';

  body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:80px"><div class="loading" style="width:24px;height:24px;border-width:3px;border-color:var(--amber) var(--amber) transparent transparent;"></div></div>';

  try {
    if (fileType === 'pdf') {
      body.innerHTML = `<iframe src="${escapeHtml(url)}" style="width:100%;height:100%;border:none;background:#fff;" title="${escapeHtml(name || '')}"></iframe>`;
      return;
    }

    if (fileType === 'image') {
      body.innerHTML = `<div style="padding:16px;overflow:auto;height:100%;box-sizing:border-box;display:flex;align-items:center;justify-content:center;"><img src="${escapeHtml(url)}" style="max-width:100%;max-height:90%;object-fit:contain;border-radius:4px;"></div>`;
      return;
    }

    if (fileType === 'audio') {
      body.innerHTML = discMakeAudioPreviewHtml(url, name, kind);
      discAttachAudioPreviewMeta(body);
      return;
    }

    if (fileType === 'video') {
      body.innerHTML = [
        '<div style="display:flex;align-items:center;justify-content:center;height:100%;background:#000;">',
        '<video controls autoplay style="max-width:100%;max-height:100%;" src="' + escapeHtml(url) + '"',
        ' title="' + escapeHtml(name || '') + '">',
        '</video>',
        '</div>',
      ].join('');
      return;
    }

    if (fileType === 'html') {
      body.innerHTML = `<iframe src="${escapeHtml(url)}" sandbox="allow-same-origin allow-forms allow-popups" style="width:100%;height:100%;border:none;background:#fff;" title="${escapeHtml(name || '')}"></iframe>`;
      return;
    }

    const res = await fetch(url);
    const text = await res.text();
    body.innerHTML = discMakeTextPreviewHtml(text, name, fileType);
  } catch (e) {
    body.innerHTML = `<div style="padding:20px;color:var(--red);">Erro ao abrir preview: ${escapeHtml(e.message || 'falha desconhecida')}</div>`;
  }
}

async function discOpenFileOutput(url, name, kind) {
  if (!url || typeof window.addOutputArtifact !== 'function') {
    return window.open(url, '_blank');
  }

  const fileType = discInferFileType(name, kind);
  const ext = discGetFileExt(name);
  const artifact = {
    id: `disc:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
    title: name || 'arquivo',
    type: fileType === 'markdown' ? 'text' : fileType,
    url,
    _focusInPanel: true,
  };

  try {
    if (['json', 'markdown', 'text'].includes(fileType)) {
      const res = await fetch(url);
      let text = await res.text();
      if (text.length > 250000) text = text.slice(0, 250000) + '\n\n... (truncated)';

      if (fileType === 'json') {
        try { text = JSON.stringify(JSON.parse(text), null, 2); } catch { }
        artifact.type = 'json';
      } else if (fileType === 'markdown') {
        artifact.type = 'markdown';
        artifact.content_type = 'text/markdown';
        artifact.content = text;
      } else {
        artifact.type = ext === 'csv' || ext === 'tsv' ? 'data' : 'text';
      }

      if (!artifact.content) artifact.content = text;
    }
  } catch {
    // Fallback to URL-only artifact
  }

  window.addOutputArtifact(artifact);
  if (typeof window.showOutputArtifactInPanel === 'function') {
    window.showOutputArtifactInPanel(artifact.id);
  }
  discEnsurePanelOpen('outputPanel', 'toggleOutputPanel');
}

async function discOpenFileBrowser(url, name, kind) {
  if (!url) return;
  const fileType = discInferFileType(name, kind);
  const iframe = document.getElementById('browserFrame');
  const bar = document.getElementById('browserUrlBar');

  if (!iframe) {
    window.open(url, '_blank');
    return;
  }

  discEnsurePanelOpen('browserPanel', 'toggleBrowserPanel');
  if (bar) bar.value = url;

  try {
    if (fileType === 'audio') {
      iframe.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(name || 'audio')}</title><style>html,body{height:100%;margin:0;background:#111;color:#ddd;font-family:Arial,sans-serif}body{display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box}audio{width:min(720px,100%)}</style></head><body><div><div style="margin-bottom:12px;font-size:14px;font-weight:600">${escapeHtml(name || 'Áudio')}</div><audio controls preload="metadata" src="${escapeHtml(url)}"></audio></div></body></html>`;
      return;
    }

    if (fileType === 'video') {
      iframe.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(name || 'video')}</title><style>html,body{height:100%;margin:0;background:#000;font-family:Arial,sans-serif}body{display:flex;align-items:center;justify-content:center}video{max-width:100%;max-height:100vh}</style></head><body><video controls autoplay src="${escapeHtml(url)}"></video></body></html>`;
      return;
    }

    if (['json', 'markdown', 'text'].includes(fileType)) {
      const res = await fetch(url);
      const text = await res.text();
      const previewHtml = discMakeTextPreviewHtml(text, name, fileType);
      iframe.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(name || 'file')}</title><style>html,body{height:100%;margin:0;background:#111;color:#ddd}a{color:#57a2ff}pre{tab-size:2}</style></head><body>${previewHtml}</body></html>`;
      return;
    }
  } catch {
    // fallback below
  }

  if (typeof window.navigateBrowser === 'function') {
    window.navigateBrowser(url);
  } else {
    iframe.src = url;
  }
}

// Render file table — maps TheBridge API field names (displayName, categoryLabel, size_bytes, size_human)
function discRenderFileTable(files) {
  const container = document.getElementById('discFileTable');
  if (!container) return;
  const list = files || _discAllFiles;
  if (!list.length) {
    container.innerHTML = '<div class="dsc-empty"><i class="fas fa-folder-open"></i><p>' + (typeof window.t === 'function' ? window.t('ui.noFilesUploaded', 'No files uploaded yet.') : 'No files uploaded yet.') + '</p></div>';
    return;
  }
  const rows = list.map((f) => {
    const displayName = f.displayName || f.display_name || f.name || f.fileName || f.file_name || '';
    const categoryLabel = f.categoryLabel || f.category_label || f.category || '—';
    const sizeBytes = f.size_bytes || f.sizeBytes || f.size || 0;
    const sizeHuman = f.size_human || f.sizeHuman || '';
    const name = escapeHtml(displayName);
    const cat = escapeHtml(categoryLabel);
    const size = escapeHtml(sizeHuman || formatBytes(sizeBytes));
    const kind = escapeHtml((f.kind || 'file').toString().replace('/', '').toUpperCase().slice(0, 6));
    const refName = displayName || f.file || f.path || 'arquivo';
    const url = _discResolveProjectMirrorUrl(f) || discResolveFileUrl(f);
    const projectRelPath = _discResolveProjectRelativePath(f);
    const kindRaw = {
      kind: f.kind || '',
      mime: f.mimeType || f.mime_type || f.contentType || f.content_type || f.type || '',
      category: f.category || f.categoryLabel || f.category_label || '',
      extension: f.extension || discGetFileExt(f.fileName || f.file || f.name || ''),
      size: sizeBytes,
      sizeLabel: sizeHuman,
    };
    const deleteBtn = projectRelPath
      ? `<button class="btn-xs danger" onclick='discDeleteProjectFile(${JSON.stringify(projectRelPath)}, ${JSON.stringify(refName)})' title="Excluir arquivo"><i class="fas fa-trash"></i></button>`
      : '';
    return `<tr>
      <td><span class="file-kind">${kind}</span></td>
      <td class="file-name">${name}</td>
      <td class="file-category">${cat}</td>
      <td class="file-size">${size}</td>
      <td class="file-actions">
        <button class="btn-xs" onclick='discOpenFilePreview(${JSON.stringify(url)}, ${JSON.stringify(refName)}, ${JSON.stringify(kindRaw)})' title="Preview"><i class="fas fa-eye"></i></button>
        <button class="btn-xs" onclick='discOpenFileOutput(${JSON.stringify(url)}, ${JSON.stringify(refName)}, ${JSON.stringify(kindRaw)})' title="Output panel"><i class="fas fa-columns"></i></button>
        <button class="btn-xs" onclick='discOpenFileBrowser(${JSON.stringify(url)}, ${JSON.stringify(refName)}, ${JSON.stringify(kindRaw)})' title="Browser panel"><i class="fas fa-globe"></i></button>
        <a class="btn-xs" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" title="Abrir em nova guia"><i class="fas fa-external-link-alt"></i></a>
        ${deleteBtn}
      </td>
    </tr>`;
  }).join('');
  container.innerHTML = `<table class="disc-file-table"><thead><tr><th>Tipo</th><th>Nome</th><th>Categoria</th><th>Tamanho</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
}

// Filter files — accepts optional value arg (called from oninput)
function discFilterFiles(value) {
  const query = (value !== undefined ? String(value) : ((document.getElementById('discSearchInput') || {}).value || '')).toLowerCase();
  const filtered = _discAllFiles.filter(f => {
    const searchable = `${f.displayName || f.display_name || f.name || f.fileName || f.file_name || ''} ${f.categoryLabel || f.category_label || f.category || ''}`.toLowerCase();
    return !query || searchable.includes(query);
  });
  discRenderFileTable(filtered);
}

// Filter by category
function discFilterByCategory(category) {
  const filtered = category
    ? _discAllFiles.filter(f => String(f.category || f.categoryLabel || f.category_label || '') === String(category))
    : _discAllFiles;
  discRenderFileTable(filtered);
}

// Handle uploaded files (from drop or file picker) — shows staged list, sends on Processar
function _discNormalizeUploadPath(fileLike) {
  const raw = String(
    (fileLike && (fileLike.webkitRelativePath || fileLike.relativePath || fileLike.name))
    || fileLike
    || ''
  ).trim();
  return raw.replace(/\\/g, '/').replace(/^\/+/, '');
}

function _discIsIgnoredUploadPath(fileLike) {
  const normalized = _discNormalizeUploadPath(fileLike);
  const basename = normalized.split('/').pop() || '';
  if (!basename) return true;
  if (basename === '.DS_Store' || /^\._/.test(basename) || /^~\$/.test(basename)) return true;
  if (/(^|\/)__MACOSX(\/|$)/.test(normalized)) return true;
  return false;
}

function discHandleFiles(fileList) {
  if (!fileList || !fileList.length) return;
  let ignoredCount = 0;
  const dedupe = new Set(
    _discUploadedFiles.map(f => {
      const path = _discNormalizeUploadPath(f).toLowerCase();
      const size = Number(f.size || f.size_bytes || 0);
      return `${path}::${size}`;
    })
  );

  for (let i = 0; i < fileList.length; i++) {
    const f = fileList[i];
    const relativePath = _discNormalizeUploadPath(f);
    if (_discIsIgnoredUploadPath(relativePath)) {
      ignoredCount += 1;
      continue;
    }
    const key = `${relativePath.toLowerCase()}::${Number(f.size || 0)}`;
    if (dedupe.has(key)) continue;
    dedupe.add(key);

    _discUploadedFiles.push({
      _id: `disc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: f.name,
      relativePath,
      size: f.size,
      type: f.type || 'unknown',
      category: 'uploaded',
      _file: f
    });
  }
  discRenderFileList(_discUploadedFiles);
  if (typeof discUpdateStats === 'function') discUpdateStats();
  if (ignoredCount > 0) {
    var _igMsg = (typeof window.t === 'function' ? window.t('ui.discIgnoredFiles', 'Discovery: %s system file(s) ignored (e.g. .DS_Store).') : 'Discovery: %s system file(s) ignored (e.g. .DS_Store).').replace('%s', ignoredCount);
    if (typeof addSystemBubble === 'function') {
      addSystemBubble(_igMsg);
    } else {
      alert(_igMsg);
    }
  }
}

// Handle file drop
function discHandleDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  discHandleFiles(e.dataTransfer.files);
}

// Handle file select
function discHandleFileSelect(e) {
  discHandleFiles(e.target.files);
  if (e.target) e.target.value = '';
}

function discHandleFolderSelect(e) {
  discHandleFiles(e.target.files);
  if (e.target) e.target.value = '';
}

// Clear files
function discClearFiles() {
  _discUploadedFiles = [];
  discRenderFileList(_discUploadedFiles);
  discRenderFileTable(_discAllFiles);
}

// Remove file
function discRemoveFile(fileId) {
  _discUploadedFiles = _discUploadedFiles.filter(f => f._id !== fileId);
  discRenderFileTable([..._discAllFiles, ..._discUploadedFiles]);
  discRenderFileList(_discUploadedFiles);
}

// Upload staged files via POST /api/bridge/upload — auto-triggers pipeline L1-L5 rebuild
async function discStartProcessing() {
  if (!_discUploadedFiles.length) {
    alert((typeof window.t === 'function' ? window.t('ui.selectFilesToSend', 'Select files to send') : 'Select files to send'));
    return;
  }

  const uploadableFiles = _discUploadedFiles.filter(f => !_discIsIgnoredUploadPath(f.relativePath || f.name));
  if (uploadableFiles.length !== _discUploadedFiles.length) {
    _discUploadedFiles = uploadableFiles;
    discRenderFileList(_discUploadedFiles);
    if (typeof discUpdateStats === 'function') discUpdateStats();
  }
  if (!uploadableFiles.length) {
    alert((typeof window.t === 'function' ? window.t('ui.noValidFiles', 'No valid files selected.') : 'No valid files selected.'));
    return;
  }

  const projectId = (typeof getCurrentProjectId === 'function') ? getCurrentProjectId() : null;
  if (!projectId) {
    alert((typeof window.t === 'function' ? window.t('ui.discSelectFirst', 'Select an active project before processing Discovery files.') : 'Select an active project before processing Discovery files.'));
    return;
  }
  const fd = new FormData();
  for (const f of uploadableFiles) {
    if (f._file) fd.append('files', f._file, f.relativePath || f.name);
  }
  const profile = _discGetSectionProfile('descoberta', 'discovery_files');
  try {
    const r = await fetch(_BRIDGE_SERVER + '/upload', { method: 'POST', body: fd });
    if (r.ok) {
      const res = await r.json();
      const indexedCount = Array.isArray(res.files) ? res.files.length : 0;
      const uploadedCount = uploadableFiles.length;
      try {
        await _discMirrorFilesToProject(profile);
      } catch (mirrorErr) {
        console.warn('[discovery] failed to mirror files to project section', mirrorErr);
        addSystemBubble((typeof window.t === 'function' ? window.t('ui.discMirrorFail', 'Discovery: failed to save files to project (%s).') : 'Discovery: failed to save files to project (%s).').replace('%s', mirrorErr.message || mirrorErr));
      }
      let indexSummary = null;
      try {
        indexSummary = await _discIndexSectionFiles(res, profile);
      } catch (idxErr) {
        console.warn('[discovery] failed to index section files', idxErr);
      }
      const _tDisc = (k, d) => (typeof window.t === 'function' ? window.t(k, d) : d);
      if (indexedCount === uploadedCount) {
        alert(_tDisc('ui.discUploadIndexedBoth', 'Discovery: %s file(s) uploaded and indexed in documents_scanned').replace('%s', indexedCount));
      } else {
        alert(_tDisc('ui.discUploadIndexedSplit', 'Discovery: %s file(s) uploaded; %s indexed in documents_scanned').replace('%s', uploadedCount).replace('%s', indexedCount));
      }
      if (indexSummary && indexSummary.status === 'ok') {
        const graphStatus = (indexSummary.graph && indexSummary.graph.status) ? indexSummary.graph.status : 'desativado';
        addSystemBubble((typeof window.t === 'function' ? window.t('ui.discIndexed', 'Discovery: folder=%s, collection=%s, chunks=%s, graph=%s.') : 'Discovery: folder=%s, collection=%s, chunks=%s, graph=%s.')
          .replace('%s', profile.workspace_folder).replace('%s', profile.qdrant_collection).replace('%s', indexSummary.ingested_chunks || 0).replace('%s', graphStatus));
      } else if (indexSummary && indexSummary.status === 'unsupported') {
        addSystemBubble((typeof window.t === 'function' ? window.t('ui.discUnsupported', 'Discovery: advanced section indexing unavailable on this server; upload and project mirroring completed.') : 'Discovery: advanced section indexing unavailable on this server; upload and project mirroring completed.'));
      } else {
        addSystemBubble((typeof window.t === 'function' ? window.t('ui.discNoDetailedIndex', 'Discovery: files processed, but no detailed indexing completed in this run.') : 'Discovery: files processed, but no detailed indexing completed in this run.'));
      }
      _discUploadedFiles = [];
      const fileListEl = document.getElementById('discFileList');
      if (fileListEl) fileListEl.innerHTML = '';
      const fileInputEl = document.getElementById('discFileInput');
      const folderInputEl = document.getElementById('discFolderInput');
      if (fileInputEl) fileInputEl.value = '';
      if (folderInputEl) folderInputEl.value = '';
      discLoadFiles();
      discLoadOverview();
    } else {
      const err = await r.json().catch(() => ({}));
      alert('Erro: ' + (err.detail || err.error || r.status));
    }
  } catch {
    alert((typeof window.t === 'function' ? window.t('ui.networkErrorSendingFiles', 'Network error sending files') : 'Network error sending files'));
  }
}

// Shared SSE pipeline runner
async function _discStreamPipeline({ backendPath, params, labelText, onComplete }) {
  const progressEl = document.getElementById('discRunProgress');
  const labelEl = document.getElementById('discRunProgressLabel');
  const elapsedEl = document.getElementById('discRunElapsed');
  const statusEl = document.getElementById('discRunStatus');
  const barEl = document.getElementById('discRunBar');

  if (progressEl) {
    progressEl.style.display = '';
    progressEl.style.borderLeftColor = 'var(--orange,#e05a1c)';
  }
  if (labelEl) labelEl.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${labelText}`;
  if (barEl) {
    barEl.style.animation = 'discBarSlide 1.8s linear infinite';
    barEl.style.width = '38%';
    barEl.style.background = 'linear-gradient(90deg,var(--orange,#e05a1c),#f5a623)';
  }
  if (statusEl) statusEl.textContent = 'Conectando ao pipeline…';
  if (elapsedEl) elapsedEl.textContent = '0:00';

  let seconds = 0;
  const timerInterval = setInterval(() => {
    seconds++;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (elapsedEl) elapsedEl.textContent = `${m}:${String(s).padStart(2, '0')}`;
  }, 1000);

  const qs = new URLSearchParams(params).toString();
  const url = _BRIDGE_SERVER + backendPath + (qs ? '?' + qs : '');
  let succeeded = false;

  try {
    const response = await fetch(url, {
      headers: { Accept: 'text/event-stream' },
      signal: AbortSignal.timeout(5 * 60 * 1000),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let streamDone = false;

    while (!streamDone) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      let evtName = '', evtData = '';
      for (const line of lines) {
        if (line.startsWith('event: ')) evtName = line.slice(7).trim();
        else if (line.startsWith('data: ')) evtData = line.slice(6).trim();
        else if (line === '' && evtData) {
          let payload;
          try { payload = JSON.parse(evtData); } catch { payload = { text: evtData }; }

          if (evtName === 'progress') {
            if (statusEl) statusEl.textContent = payload.stage || payload.detail || 'Processando…';

          } else if (evtName === 'complete') {
            succeeded = true;
            streamDone = true;
            clearInterval(timerInterval);
            const count = payload.processed || payload.files_processed || payload.groups_written || 0;
            if (statusEl) statusEl.textContent = `✔ Concluído — ${count} item(ns) processado(s)`;
            if (labelEl) labelEl.innerHTML = '<i class="fas fa-check-circle" style="color:var(--green,#22a06b)"></i> Pipeline concluído';
            if (barEl) {
              barEl.style.animation = 'none';
              barEl.style.width = '100%';
              barEl.style.background = 'var(--green,#22a06b)';
            }
            if (onComplete) onComplete(payload);
            setTimeout(() => { if (progressEl) progressEl.style.display = 'none'; }, 5000);

          } else if (evtName === 'error') {
            throw new Error(payload.error || 'Pipeline error');
          }

          evtName = ''; evtData = '';
        }
      }
    }
  } catch (e) {
    clearInterval(timerInterval);
    const isTimeout = e.name === 'TimeoutError' || e.name === 'AbortError';
    const msg = isTimeout ? 'Tempo limite excedido (5 min)' : (e.message || 'Erro de rede');
    if (statusEl) statusEl.textContent = '✖ ' + msg;
    if (labelEl) labelEl.innerHTML = '<i class="fas fa-exclamation-triangle" style="color:var(--orange,#e05a1c)"></i> Erro no pipeline';
    if (barEl) { barEl.style.animation = 'none'; barEl.style.width = '100%'; barEl.style.background = 'rgba(180,50,50,.6)'; }
  } finally {
    if (!succeeded) clearInterval(timerInterval);
  }
}

// Run intelligence L5-L7 pipeline via GET /api/bridge/intelligence/run-stream (SSE)
async function discRunIntelPipeline() {
  const savedKeys = (() => { try { return JSON.parse(localStorage.getItem('olivia.api.keys') || '{}'); } catch { return {}; } })();
  const cfg = (typeof getConfig === 'function') ? getConfig() : {};
  const provider = cfg.provider || 'anthropic';
  const apiKey = savedKeys[provider] || prompt(`Chave ${provider} para Inteligência L5-L7:`);
  if (!apiKey) return;
  const model = cfg.model || 'deepseek-v4-pro';
  const btn = document.getElementById('discBtnRunIntel');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Rodando…'; }
  await _discStreamPipeline({
    backendPath: '/intelligence/run-stream',
    params: { api_key: apiKey, model },
    labelText: 'Inteligência L5-L7 em execução…',
    onComplete: () => {
      _discIntelSummary = null; _discViolations = null; _discGapReport = null;
      _discCaseState = null; _discIntelTimeline = null; _discCaseGraph = null;
      discLoadIntelligence();
      discLoadPipeline();
    },
  });
  if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-brain"></i> Inteligência L5-L7'; }
}

// Run comprehension (Layer C) via GET /api/bridge/comprehend/run-stream (SSE)
async function discRunComprehension() {
  const savedKeys = (() => { try { return JSON.parse(localStorage.getItem('olivia.api.keys') || '{}'); } catch { return {}; } })();
  const cfg = (typeof getConfig === 'function') ? getConfig() : {};
  const provider = cfg.provider || 'anthropic';
  const apiKey = savedKeys[provider] || prompt(`Chave ${provider} para Compreensão:`);
  if (!apiKey) return;
  const model = cfg.model || 'deepseek-v4-pro';
  const btn = document.getElementById('discBtnRunComprehend');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Rodando…'; }
  await _discStreamPipeline({
    backendPath: '/comprehend/run-stream',
    params: { api_key: apiKey, model, concurrency: 3 },
    labelText: 'Compreensão do Corpus em execução…',
    onComplete: () => {
      _discComprehendOverview = null; _discComprehendGroups = null;
      discLoadComprehension();
    },
  });
  if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-book-open"></i> Compreensão'; }
}

// Load comprehension data — GET /api/bridge/comprehend/overview and /groups
async function discLoadComprehension() {
  const loadedFromArtifacts = await _discLoadComprehensionFromArtifacts();
  if (loadedFromArtifacts) return;

  if (_discRouteSupport.comprehendOverview === null) {
    _discRouteSupport.comprehendOverview = await _discSupportsBridgeEndpoint('GET', '/comprehend/overview');
  }
  if (_discRouteSupport.comprehendGroups === null) {
    _discRouteSupport.comprehendGroups = await _discSupportsBridgeEndpoint('GET', '/comprehend/groups');
  }

  if (!_discRouteSupport.comprehendOverview && !_discRouteSupport.comprehendGroups) {
    discRenderComprehendOverview({ hint: true });
    discRenderComprehendGroups({ hint: true });
    return;
  }

  const [ovR, grR] = await Promise.allSettled([
    _discComprehendOverview
      ? Promise.resolve(_discComprehendOverview)
      : (_discRouteSupport.comprehendOverview
        ? fetch(_BRIDGE_SERVER + '/comprehend/overview').then(r => {
          if (!r.ok) {
            if (r.status === 404) _discRouteSupport.comprehendOverview = false;
            return null;
          }
          return r.json();
        })
        : Promise.resolve(null)),
    _discComprehendGroups
      ? Promise.resolve(_discComprehendGroups)
      : (_discRouteSupport.comprehendGroups
        ? fetch(_BRIDGE_SERVER + '/comprehend/groups').then(r => {
          if (!r.ok) {
            if (r.status === 404) _discRouteSupport.comprehendGroups = false;
            return null;
          }
          return r.json();
        })
        : Promise.resolve(null)),
  ]);
  const ov = ovR.status === 'fulfilled' ? ovR.value : null;
  const gr = grR.status === 'fulfilled' ? grR.value : null;
  if (ov && !ov.error) {
    const normalizedOverview = _discNormalizeComprehendOverview(ov);
    _discComprehendOverview = normalizedOverview;
    discRenderComprehendOverview(normalizedOverview);
  }
  if (gr && !gr.error) {
    const normalizedGroups = _discNormalizeComprehendGroups(gr);
    _discComprehendGroups = normalizedGroups;
    discRenderComprehendGroups(normalizedGroups);
  }

  if (!_discComprehendOverview && !_discComprehendGroups) {
    discRenderComprehendOverview({ hint: true });
    discRenderComprehendGroups({ hint: true });
  }
}

// Export data
function discExportData(format) {
  const data = {
    files: _discAllFiles,
    categories: _discCategoriesData,
    stats: _discPipelineStats,
    entities: _discEntitiesData,
    timeline: _discTimelineData,
    case_state: _discCaseState,
    narrative: _discNarrative,
    violations: _discViolations,
    gap_report: _discGapReport
  };

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `discovery_export_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// Toggle maximize
function discToggleMaximize() {
  const ws = document.querySelector('.workspace');
  const btn = document.getElementById('discMaxBtn');
  if (!ws || !btn) return;

  ws.classList.toggle('disc-maximized');
  btn.innerHTML = ws.classList.contains('disc-maximized')
    ? '<i class="fas fa-compress"></i>'
    : '<i class="fas fa-expand"></i>';
}

// Toggle subsection
function discToggleSub(subId) {
  const el = document.getElementById(subId);
  if (el) el.classList.toggle('collapsed');
}

// Map legacy/sidebar section names to real view section IDs
const _DISC_SECTION_MAP = { upload: 'files', overview: 'files', api: 'pipeline' };

// Show section — maps sidebar names, updates tree active state, lazy-loads data
function discShowSection(sectionId) {
  const mapped = _DISC_SECTION_MAP[sectionId] || sectionId;
  document.querySelectorAll('.disc-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.disc-section-tab').forEach(t => t.classList.remove('active'));
  // Update sidebar tree active indicator
  document.querySelectorAll('.dsc-tree-item').forEach(el => el.classList.remove('active'));
  const treeMap = { files: 'discTreeFiles', insights: 'discTreeInsights', intelligence: 'discTreeIntel', pipeline: 'discTreePipeline' };
  const treeId = treeMap[mapped];
  if (treeId) { const tEl = document.getElementById(treeId); if (tEl) tEl.classList.add('active'); }
  const sec = document.getElementById(mapped);
  if (sec) sec.classList.add('active');
  // Lazy-load section data on first visit
  if (mapped === 'insights' && !_discPipelineStats) discLoadInsights();
  if (mapped === 'intelligence' && !_discCaseState && !_discIntelSummary) discLoadIntelligence();
  if (mapped === 'pipeline') discLoadPipeline();
  if (mapped === 'comprehension') discLoadComprehension();
}

// Show insights subsection
function discShowInsightsSub(subId) {
  document.querySelectorAll('.disc-insights-sub').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(subId);
  if (el) el.classList.add('active');
}

// Show intelligence subsection
function discShowIntelSub(subId) {
  document.querySelectorAll('.disc-intel-sub').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(subId);
  if (el) el.classList.add('active');
}

// Select entity type
function discSelectEtype(type) {
  document.querySelectorAll('.disc-etype-btn').forEach(b => b.classList.toggle('active', b.dataset.type === type));
  discRenderEntityList(type);
}

function discHumanKey(key) {
  return String(key || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase());
}

function discTextValue(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value.toLocaleString('pt-BR') : String(value);
  }
  if (typeof value === 'boolean') return value ? 'sim' : 'nao';
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) {
    return value.map(v => discTextValue(v)).filter(Boolean).join(', ');
  }
  if (typeof value === 'object') {
    return Object.entries(value)
      .slice(0, 8)
      .map(([k, v]) => `${discHumanKey(k)}: ${discTextValue(v)}`)
      .filter(Boolean)
      .join(' · ');
  }
  return String(value);
}

function discValueHtml(value) {
  if (value === null || value === undefined || value === '') {
    return '<span style="opacity:.7">-</span>';
  }

  if (Array.isArray(value)) {
    if (!value.length) return '<span style="opacity:.7">[]</span>';
    const primitive = value.every(v => v === null || ['string', 'number', 'boolean'].includes(typeof v));
    if (primitive && value.length <= 6) {
      return escapeHtml(value.map(v => discTextValue(v) || '-').join(', '));
    }
    const prettyArray = escapeHtml(JSON.stringify(value, null, 2));
    return `<details><summary>${value.length} itens</summary><pre style="margin:6px 0 0;white-space:pre-wrap;word-break:break-word;font-size:11px;opacity:.9">${prettyArray}</pre></details>`;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value);
    const flat = entries.length <= 6 && entries.every(([, v]) => v === null || ['string', 'number', 'boolean'].includes(typeof v));
    if (flat) {
      return entries
        .map(([k, v]) => `${escapeHtml(discHumanKey(k))}: ${escapeHtml(discTextValue(v) || '-')}`)
        .join(' · ');
    }
    const prettyObject = escapeHtml(JSON.stringify(value, null, 2));
    return `<details><summary>${entries.length} campos</summary><pre style="margin:6px 0 0;white-space:pre-wrap;word-break:break-word;font-size:11px;opacity:.9">${prettyObject}</pre></details>`;
  }

  return escapeHtml(discTextValue(value) || '-');
}

function discBuildNarrativePayload(summaryData) {
  if (!summaryData) return { text: '', key_points: [], raw: null, stats: null };
  if (typeof summaryData === 'string') return { text: summaryData, key_points: [], raw: null, stats: null };

  const directText = [
    summaryData.narrative,
    summaryData.summary,
    summaryData.text,
    summaryData.markdown,
  ].find(v => typeof v === 'string' && v.trim());

  const stats = summaryData.stats && typeof summaryData.stats === 'object' ? summaryData.stats : null;
  const rawPoints = summaryData.key_findings || summaryData.key_points || summaryData.highlights || [];
  const keyPoints = (Array.isArray(rawPoints) ? rawPoints : [rawPoints])
    .map(v => discTextValue(v))
    .filter(Boolean);

  if (directText) {
    return { text: directText, key_points: keyPoints, raw: summaryData, stats };
  }

  const phase = summaryData.case_phase || (stats && stats.case_phase) || 'unknown';
  const totalFiles = summaryData.total_files ?? (stats && stats.total_files);
  const extracted = summaryData.files_extracted ?? (stats && stats.files_extracted);
  const totalViolations = summaryData.total_violations ?? (stats && stats.total_violations);

  const lines = ['Resumo tecnico do pipeline de inteligencia.'];
  if (summaryData.generated_at) lines.push(`Gerado em ${summaryData.generated_at}.`);
  if (summaryData.llm_model) lines.push(`Modelo: ${summaryData.llm_model}.`);
  if (totalFiles !== undefined) lines.push(`Arquivos: ${discTextValue(totalFiles)}.`);
  if (extracted !== undefined) lines.push(`Extraidos: ${discTextValue(extracted)}.`);
  if (totalViolations !== undefined) lines.push(`Violacoes: ${discTextValue(totalViolations)}.`);
  if (phase) lines.push(`Fase: ${discTextValue(phase)}.`);

  const logs = Array.isArray(summaryData.log) ? summaryData.log : [];
  if (logs.length) lines.push(`Ultimo evento: ${logs[logs.length - 1]}`);

  const derivedPoints = keyPoints.length
    ? keyPoints
    : (stats
      ? Object.entries(stats)
        .slice(0, 6)
        .map(([k, v]) => `${discHumanKey(k)}: ${discTextValue(v) || '-'}`)
      : []);

  return { text: lines.join(' '), key_points: derivedPoints, raw: summaryData, stats };
}

// Update stats — handles both size and size_bytes field names
function discUpdateStats() {
  const files = [..._discAllFiles, ..._discUploadedFiles];
  const totalSize = files.reduce((sum, f) => sum + (f.size_bytes || f.sizeBytes || f.size || 0), 0);
  const catCount = Object.keys(_discCategoriesData).length ||
    new Set(files.map(f => f.category).filter(Boolean)).size;
  const elFiles = document.getElementById('discStatFiles');
  const elSize = document.getElementById('discStatSize');
  const elCats = document.getElementById('discStatCats');
  if (elFiles) elFiles.textContent = files.length;
  if (elSize) elSize.textContent = formatBytes(totalSize);
  if (elCats) elCats.textContent = catCount;
}

// Enriched search via GET /api/bridge/pipeline/search
async function discEnrichedSearchRun() {
  const input = document.getElementById('discEnrichedSearchInput');
  const query = (input || {}).value ? input.value.trim() : '';
  if (!query) return;
  const container = document.getElementById('discGapReport');
  if (container) container.innerHTML = '<div class="dsc-empty"><i class="fas fa-spinner fa-spin"></i><p>Buscando...</p></div>';
  try {
    const r = await fetch(`${_BRIDGE_SERVER}/pipeline/search?q=${encodeURIComponent(query)}&limit=50`);
    if (!r.ok) throw new Error(r.status);
    const data = await r.json();
    const results = data.results || [];
    if (!container) return;
    if (!results.length) {
      container.innerHTML = '<div class="dsc-empty"><p>Nenhum resultado para "' + escapeHtml(query) + '"</p></div>';
      return;
    }
    container.innerHTML = results.map(res => `
      <div class="disc-gap-item">
        <span class="disc-gap-category">${escapeHtml(res.categoryLabel || res.category || '')}</span>
        <span class="disc-gap-desc">${escapeHtml(res.displayName || res.fileName || res.file || '')}</span>
        <span class="disc-gap-severity">${escapeHtml(res.kind || '')}</span>
      </div>
    `).join('');
  } catch {
    if (container) container.innerHTML = '<div class="dsc-empty"><p>Erro na busca</p></div>';
  }
}

// Render categories — TheBridge returns {key: {label, count, kinds, extensions}}
function discRenderCategories() {
  const container = document.getElementById('discCategories');
  if (!container) return;

  const cats = Object.entries(_discCategoriesData);
  const html = cats.map(([key, data]) => `
    <div class="disc-category-item" onclick="discFilterByCategory('${escapeHtml(key)}')" style="cursor:pointer">
      <div class="disc-category-header">
        <span class="disc-category-name">${escapeHtml(data.label || key)}</span>
        <span class="disc-category-count">${data.count || 0}</span>
      </div>
      <div class="disc-category-kinds">
        ${Object.keys(data.kinds || data.extensions || {}).map(k => `<span class="disc-kind-badge">${escapeHtml(k)}</span>`).join('')}
      </div>
    </div>
  `).join('');
  container.innerHTML = html || '<div class="disc-empty">No categories</div>';
}

// Render languages
function discRenderLanguages(langs) {
  const container = document.getElementById('discLanguages');
  if (!container) return;

  const entries = Object.entries(langs).sort((a, b) => b[1] - a[1]);
  const html = entries.map(([lang, count]) => `
    <div class="disc-lang-item">
      <span class="disc-lang-name">${escapeHtml(lang)}</span>
      <span class="disc-lang-count">${count}</span>
      <div class="disc-lang-bar" style="width: ${Math.min(100, count * 10)}%"></div>
    </div>
  `).join('');
  container.innerHTML = html || '<div class="disc-empty">No language data</div>';
}

// Render domains
function discRenderDomains(domains) {
  const container = document.getElementById('discDomains');
  if (!container) return;

  const entries = Object.entries(domains).sort((a, b) => b[1] - a[1]);
  const html = entries.map(([domain, count]) => `
    <div class="disc-domain-item">
      <span class="disc-domain-name">${escapeHtml(domain)}</span>
      <span class="disc-domain-count">${count}</span>
    </div>
  `).join('');
  container.innerHTML = html || '<div class="disc-empty">No domain data</div>';
}

// Render tags
function discRenderTags(tags) {
  const container = document.getElementById('discTags');
  if (!container) return;

  const html = tags.map(tag => `
    <span class="disc-tag-pill">${escapeHtml(tag)}</span>
  `).join('');
  container.innerHTML = html || '<div class="disc-empty">No tags</div>';
}

// Render entity list — API summary format: {[type]: {unique_count, total_mentions, top: [{name, file_count}]}}
function discRenderEntityList(type) {
  const container = document.getElementById('discEntityList');
  if (!container || !_discEntitiesData) return;
  const bucket = _discEntitiesData[type] || {};
  // Supports both flat array and {top: [...]} summary format
  const entities = Array.isArray(bucket) ? bucket : (bucket.top || []);
  const html = entities.map(e => `
    <div class="disc-entity-item">
      <span class="disc-entity-name">${escapeHtml(e.name || e.text || '')}</span>
      <span class="disc-entity-type">${escapeHtml(type)}</span>
      <span class="disc-entity-count">${e.file_count || e.count || 1}</span>
    </div>
  `).join('');
  container.innerHTML = html || '<div class="dsc-empty"><p>Sem entidades</p></div>';
}

// Render events
function discRenderEvents(events) {
  const container = document.getElementById('discEvents');
  if (!container) return;

  const html = (events || []).map(e => `
    <div class="disc-event-item">
      <span class="disc-event-date">${escapeHtml(e.date || '')}</span>
      <span class="disc-event-title">${escapeHtml(e.title || '')}</span>
      <span class="disc-event-type ${e.type || ''}">${escapeHtml(e.type || '')}</span>
    </div>
  `).join('');
  container.innerHTML = html || '<div class="disc-empty">No events</div>';
}

// Render timeline
function discRenderTimeline(timeline) {
  const container = document.getElementById('discTimeline');
  if (!container) return;

  const events = timeline.events || timeline || [];
  const html = events.map(e => `
    <div class="disc-timeline-item">
      <div class="disc-timeline-date">${escapeHtml(e.date || '')}</div>
      <div class="disc-timeline-content">${escapeHtml(e.description || '')}</div>
    </div>
  `).join('');
  container.innerHTML = html || '<div class="disc-empty">No timeline data</div>';
}

// Render case state
function discRenderCaseState(caseData) {
  const container = document.getElementById('discCaseState');
  if (!container) return;

  const title = discTextValue(caseData.title || 'Case') || 'Case';
  const statusText = discTextValue(caseData.status || '');
  const statusClass = typeof caseData.status === 'string' ? caseData.status : '';
  const summary = discTextValue(caseData.summary || '');
  const statsEntries = Object.entries(caseData.stats || {});

  const html = `
    <div class="disc-case-header">
      <span class="disc-case-title">${escapeHtml(title)}</span>
      <span class="disc-case-status ${escapeHtml(statusClass)}">${escapeHtml(statusText)}</span>
    </div>
    <div class="disc-case-summary">${escapeHtml(summary)}</div>
    <div class="disc-case-stats">
      ${statsEntries.map(([k, v]) => `
        <div class="disc-case-stat">
          <span class="disc-case-stat-label">${escapeHtml(discHumanKey(k))}</span>
          <span class="disc-case-stat-value">${discValueHtml(v)}</span>
        </div>
      `).join('')}
    </div>
  `;
  container.innerHTML = html;
}

// Render narrative
function discRenderNarrative(narrative) {
  const container = document.getElementById('discNarrative');
  if (!container) return;

  const text = discTextValue(narrative && narrative.text);
  const points = (narrative && Array.isArray(narrative.key_points) ? narrative.key_points : [])
    .map(p => discTextValue(p))
    .filter(Boolean);
  const stats = narrative && narrative.stats && typeof narrative.stats === 'object'
    ? Object.entries(narrative.stats)
    : [];
  const rawJson = narrative && narrative.raw && typeof narrative.raw === 'object'
    ? escapeHtml(JSON.stringify(narrative.raw, null, 2))
    : '';

  const html = `
    <div class="disc-narrative-text">${escapeHtml(text || 'Resumo nao disponivel.')}</div>
    ${points.length ? `<ul class="disc-narrative-keypoints">${points.map(p => `<li>${escapeHtml(p)}</li>`).join('')}</ul>` : ''}
    ${stats.length ? `
      <div class="disc-case-stats" style="margin-top:10px">
        ${stats.map(([k, v]) => `
          <div class="disc-case-stat">
            <span class="disc-case-stat-label">${escapeHtml(discHumanKey(k))}</span>
            <span class="disc-case-stat-value">${discValueHtml(v)}</span>
          </div>
        `).join('')}
      </div>
    ` : ''}
    ${rawJson ? `<details style="margin-top:10px"><summary style="cursor:pointer;opacity:.85">Detalhes tecnicos</summary><pre style="margin:6px 0 0;white-space:pre-wrap;word-break:break-word;font-size:11px;opacity:.9">${rawJson}</pre></details>` : ''}
  `;
  container.innerHTML = html;
}

// Render violations
function discRenderViolations(violations) {
  const container = document.getElementById('discViolations');
  if (!container) return;

  const items = violations.items || violations || [];
  const html = items.map(v => `
    <div class="disc-violation-item">
      <span class="disc-violation-type ${escapeHtml(v.severity || '')}">${escapeHtml(discTextValue(v.type || v.category || ''))}</span>
      <span class="disc-violation-desc">${escapeHtml(discTextValue(v.description || v.detail || v.finding || ''))}</span>
      <span class="disc-violation-ref">${escapeHtml(discTextValue(v.reference || v.law || v.norm || ''))}</span>
    </div>
  `).join('');
  container.innerHTML = html || '<div class="disc-empty">No violations</div>';
}

// Render gap report
function discRenderGapReport(gapReport) {
  const container = document.getElementById('discGapReport');
  if (!container) return;

  const gaps = gapReport.gaps || gapReport || [];
  const html = gaps.map(g => `
    <div class="disc-gap-item">
      <span class="disc-gap-category">${escapeHtml(discTextValue(g.category || g.type || ''))}</span>
      <span class="disc-gap-desc">${escapeHtml(discTextValue(g.description || g.detail || ''))}</span>
      <span class="disc-gap-severity ${escapeHtml(g.severity || '')}">${escapeHtml(discTextValue(g.severity || g.priority || ''))}</span>
    </div>
  `).join('');
  container.innerHTML = html || '<div class="disc-empty">No gap analysis</div>';
}

// Render comprehension overview
function discRenderComprehendOverview(data) {
  const container = document.getElementById('discComprehendOverview');
  if (!container) return;
  if (!data || data.hint) {
    container.innerHTML = '<div class="dsc-empty"><p>Execute a Compreensão para gerar a visão geral do corpus.</p></div>';
    return;
  }
  const overviewText = typeof data === 'string'
    ? data
    : (data.overview || data.description || 'Resumo de compreensão disponível nos detalhes técnicos.');
  const html = `
    <div class="disc-narrative-text">${escapeHtml(discTextValue(overviewText))}</div>
    ${typeof data === 'object' ? `<details style="margin-top:10px"><summary style="cursor:pointer;opacity:.85">Detalhes tecnicos</summary><pre style="margin:6px 0 0;white-space:pre-wrap;word-break:break-word;font-size:11px;opacity:.9">${escapeHtml(JSON.stringify(data, null, 2))}</pre></details>` : ''}
  `;
  container.innerHTML = html;
}

// Render comprehension groups
function discRenderComprehendGroups(data) {
  const container = document.getElementById('discComprehendGroups');
  if (!container) return;
  if (!data || data.hint) {
    container.innerHTML = '<div class="dsc-empty"><p>Execute a Compreensão para gerar descrições por grupo.</p></div>';
    return;
  }
  const groups = Array.isArray(data) ? data : (data.groups || Object.entries(data).map(([k, v]) => ({ name: k, ...(typeof v === 'object' ? v : { description: v }) })));
  const html = groups.map(g => `
    <div class="disc-gap-item">
      <span class="disc-gap-category">${escapeHtml(g.name || g.group || g.category || '')}</span>
      <span class="disc-gap-desc">${escapeHtml(g.description || g.summary || '')}</span>
      <span class="disc-gap-severity">${g.count ? escapeHtml(String(g.count)) + ' arquivos' : ''}</span>
    </div>
  `).join('');
  container.innerHTML = html || '<div class="disc-empty">Sem grupos</div>';
}

// Render case phase
function discRenderCasePhase(data) {
  const container = document.getElementById('discCasePhase');
  if (!container) return;
  if (!data || data.error) { container.innerHTML = '<div class="dsc-empty"><p>Fase não disponível</p></div>'; return; }
  container.innerHTML = `
    <div class="disc-case-header">
      <span class="disc-case-title">${escapeHtml(data.phase || data.current_phase || data.name || 'Fase')}</span>
      <span class="disc-case-status">${escapeHtml(data.status || '')}</span>
    </div>
    <div class="disc-case-summary">${escapeHtml(data.description || data.summary || '')}</div>
  `;
}

// Render case findings (anomalies and gaps)
function discRenderCaseFindings(data) {
  const container = document.getElementById('discCaseFindings');
  if (!container) return;
  const items = Array.isArray(data) ? data : (data.findings || data.anomalies || data.gaps || []);
  if (!items.length) { container.innerHTML = '<div class="dsc-empty"><p>Sem anomalias identificadas</p></div>'; return; }
  container.innerHTML = items.map(f => `
    <div class="disc-gap-item">
      <span class="disc-gap-category">${escapeHtml(discTextValue(f.category || f.type || ''))}</span>
      <span class="disc-gap-desc">${escapeHtml(discTextValue(f.description || f.detail || f.finding || f.summary || ''))}</span>
      <span class="disc-gap-severity ${escapeHtml(f.severity || '')}">${escapeHtml(discTextValue(f.severity || f.impact || ''))}</span>
    </div>
  `).join('');
}

// Render case next steps
function discRenderCaseNextSteps(data) {
  const container = document.getElementById('discCaseNextSteps');
  if (!container) return;
  const items = Array.isArray(data) ? data : (data.next_steps || data.recommendations || []);
  if (!items.length) { container.innerHTML = '<div class="dsc-empty"><p>Sem próximas etapas</p></div>'; return; }
  container.innerHTML = `<ol style="margin:0;padding-left:16px">${items.map(s => {
    const text = typeof s === 'string'
      ? s
      : (s.action || s.step || s.description || s.summary || discTextValue(s));
    return `<li style="margin-bottom:6px;font-size:12px;color:var(--white)">${escapeHtml(discTextValue(text) || '-')}</li>`;
  }).join('')
    }</ol>`;
}

// Expose functions to window scope
window.discShowView = discShowView;
window.discHideView = discHideView;
window.discLoadFiles = discLoadFiles;
window.discLoadOverview = discLoadOverview;
window.discLoadInsights = discLoadInsights;
window.discLoadIntelligence = discLoadIntelligence;
window.discLoadPipeline = discLoadPipeline;
window.discRefreshAll = discRefreshAll;
window.discRenderFileList = discRenderFileList;
window.discRenderFileTable = discRenderFileTable;
window.discOpenFilePreview = discOpenFilePreview;
window.discOpenFileOutput = discOpenFileOutput;
window.discOpenFileBrowser = discOpenFileBrowser;
window.discFilterFiles = discFilterFiles;
window.discFilterByCategory = discFilterByCategory;
window.discHandleDrop = discHandleDrop;
window.discHandleFileSelect = discHandleFileSelect;
window.discHandleFolderSelect = discHandleFolderSelect;
window.discHandleFiles = discHandleFiles;
window.discClearFiles = discClearFiles;
window.discRemoveFile = discRemoveFile;
window.discDeleteProjectFile = discDeleteProjectFile;
window.discStartProcessing = discStartProcessing;
window.discRunIntelPipeline = discRunIntelPipeline;
window.discRunComprehension = discRunComprehension;
window.discLoadComprehension = discLoadComprehension;
window.discExportData = discExportData;
window.discToggleMaximize = discToggleMaximize;
window.discToggleSub = discToggleSub;
window.discShowSection = discShowSection;
window.discShowInsightsSub = discShowInsightsSub;
window.discShowIntelSub = discShowIntelSub;
window.discSelectEtype = discSelectEtype;
window.formatBytes = formatBytes;
window.discUpdateStats = discUpdateStats;
window.discEnrichedSearchRun = discEnrichedSearchRun;
window.discRenderCategories = discRenderCategories;
window.discRenderLanguages = discRenderLanguages;
window.discRenderDomains = discRenderDomains;
window.discRenderTags = discRenderTags;
window.discRenderEntityList = discRenderEntityList;
window.discRenderEvents = discRenderEvents;
window.discRenderTimeline = discRenderTimeline;
window.discRenderCaseState = discRenderCaseState;
window.discRenderNarrative = discRenderNarrative;
window.discRenderViolations = discRenderViolations;
window.discRenderGapReport = discRenderGapReport;
window.discRenderComprehendOverview = discRenderComprehendOverview;
window.discRenderComprehendGroups = discRenderComprehendGroups;
window.discRenderCasePhase = discRenderCasePhase;
window.discRenderCaseFindings = discRenderCaseFindings;
window.discRenderCaseNextSteps = discRenderCaseNextSteps;
window.discLoadEvents = discLoadEvents;
window.discUpdateActiveProjectLabel = discUpdateActiveProjectLabel;
// Alias: HTML processar button calls discRunPipeline which maps to discStartProcessing
window.discRunPipeline = discStartProcessing;