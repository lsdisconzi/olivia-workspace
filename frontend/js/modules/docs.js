/* ═══════════════════════════════════════════════════════════════════
   DOCS MODULE - Document handling, PDF parsing, doc upload/render
   ═══════════════════════════════════════════════════════════════════ */

// Document global variables
let _checkedDocs = new Set();
let _checkedArticles = new Set();
let _lawArticleCache = {};
let articles = [];
let _sharedLawArticleCache = {};
let _sharedLawFileMetaCache = {};
let _sharedLawSelection = { filePath: '', articleNumber: '', article: null };
let _sharedLawCompareEscBound = false;
let _sharedLawCompareContext = { filePath: '', articleNumber: '', filename: '', markdown: '', html: '', artifactId: '' };
let _sharedBaseAbsPath = '';
const _docProjectAbsPathById = new Map();
let _docsPinUiBound = false;
const _DOC_TREE_OPEN_STORAGE_KEY = 'olivia.docs.openDirs';
let _docOpenDirs = _loadDocOpenDirs();
const _DOCS_HIDDEN_ROOT_ENTRIES = new Set([
  'agents/functions/catalog.json',
  'src/endpoint_mapper.py',
  'endpoints_inventory.json',
  'src/mcp/vps_bridge.py',
  'readme.md',
  'src/mcp/remote_bus.py',
  'config/requirements.txt',
  'serve.py',
  'runtime/start-all.sh',
  'stop-all.sh',
  'vps_8080_api.json',
]);

function _loadDocOpenDirs() {
  try {
    const raw = localStorage.getItem(_DOC_TREE_OPEN_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch (_) {
    return new Set();
  }
}

function _persistDocOpenDirs() {
  try {
    localStorage.setItem(_DOC_TREE_OPEN_STORAGE_KEY, JSON.stringify(Array.from(_docOpenDirs)));
  } catch (_) {
    // Ignore storage failures.
  }
}

function _activeProjectId() {
  if (typeof getCurrentProjectId === 'function') return getCurrentProjectId();
  return null;
}

function _docContextKey(projectId, relPath) {
  return `${projectId || ''}::${relPath || ''}`;
}

function _docContextKeyParts(key) {
  const raw = String(key || '');
  const idx = raw.indexOf('::');
  if (idx < 0) return { projectId: '', relPath: raw };
  return { projectId: raw.slice(0, idx), relPath: raw.slice(idx + 2) };
}

function _docOpenDirKey(projectId, relPath) {
  return `${projectId || ''}::${relPath || ''}`;
}

function _docDirSafeId(relPath) {
  return String(relPath || '').replace(/[^a-zA-Z0-9]/g, '_');
}

function _docProjectFileUrl(relPath, projectId) {
  const pid = String(projectId || _activeProjectId() || '').trim();
  if (!pid || !relPath) return '';
  return `${API_BASE}/api/projects/${encodeURIComponent(pid)}/raw?path=${encodeURIComponent(relPath)}`;
}

function _joinAbsolutePath(base, relPath) {
  const root = String(base || '').replace(/\\/g, '/').replace(/\/+$/, '');
  const rel = String(relPath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!root || !rel) return '';
  return `${root}/${rel}`;
}

function _docProjectAbsolutePath(relPath, projectId) {
  const pid = String(projectId || _activeProjectId() || '').trim();
  const projectAbs = String(_docProjectAbsPathById.get(pid) || '').trim();
  if (!projectAbs || !relPath) return '';
  return _joinAbsolutePath(projectAbs, relPath);
}

function _sharedAbsolutePath(relPath) {
  const base = String(_sharedBaseAbsPath || '').trim();
  const rel = String(relPath || '').replace(/^_shared\//i, '').trim();
  if (!base || !rel) return '';
  return _joinAbsolutePath(base, rel);
}

function _docProjectRawBaseHref(rawUrl) {
  if (!rawUrl) return '';
  try {
    const parsed = new URL(rawUrl, window.location.origin);
    const match = parsed.pathname.match(/^\/api\/projects\/([^/]+)\/raw$/);
    if (!match) return '';
    const relPath = String(parsed.searchParams.get('path') || '').replace(/\\/g, '/');
    if (!relPath) return '';
    const slash = relPath.lastIndexOf('/');
    if (slash < 0) return '';
    const dirPath = relPath.slice(0, slash + 1);
    return `${parsed.origin}/api/projects/${encodeURIComponent(match[1])}/raw?path=${encodeURIComponent(dirPath)}`;
  } catch (_) {
    return '';
  }
}

function _docInjectBaseHref(html, rawUrl) {
  const source = String(html || '');
  const href = _docProjectRawBaseHref(rawUrl);
  if (!href) return source;
  const baseTag = `<base href="${escapeHtmlAttr(href)}">`;
  if (/<base\b[^>]*>/i.test(source)) {
    return source.replace(/<base\b[^>]*>/i, baseTag);
  }
  if (/<head\b[^>]*>/i.test(source)) {
    return source.replace(/<head\b([^>]*)>/i, `<head$1>${baseTag}`);
  }
  return `${baseTag}${source}`;
}

function _docPrepareStaticHtmlPreview(html, rawUrl) {
  const withBase = _docInjectBaseHref(html, rawUrl);
  // Preview panel is intentionally static: strip executable scripts to avoid
  // noisy sandbox warnings and accidental execution side effects.
  return String(withBase).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
}

function _docFilePreviewOptions(name, size) {
  const numericSize = Number(size) || 0;
  return {
    fileType: resolvePreviewFileType(name || ''),
    size: numericSize,
    sizeLabel: formatBytes(numericSize),
  };
}

function _docBrowserThemePalette() {
  const isDark = document.body.classList.contains('dark') || document.documentElement.classList.contains('dark');
  return isDark
    ? {
        bg: '#181715',
        surface: '#1e1c1a',
        text: '#d4cfc8',
        muted: '#a09a92',
        border: '#2e2b27',
        link: '#8ebad0',
        code: '#252320',
        selection: 'rgba(91, 143, 168, 0.35)',
      }
    : {
        bg: '#faf9f6',
        surface: '#ffffff',
        text: '#3f3a34',
        muted: '#6b665d',
        border: '#e5e2dc',
        link: '#3f7490',
        code: '#f3eee6',
        selection: 'rgba(91, 143, 168, 0.22)',
      };
}

function _docWrapBrowserContent(title, bodyHtml) {
  const palette = _docBrowserThemePalette();
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title || 'file')}</title>
  <style>
    :root { color-scheme: light dark; }
    html, body { margin: 0; min-height: 100%; background: ${palette.bg}; color: ${palette.text}; }
    body { font-family: Arial, Helvetica, sans-serif; line-height: 1.6; }
    body ::selection { background: ${palette.selection}; }
    .browser-doc { min-height: 100vh; box-sizing: border-box; padding: 16px; background: ${palette.bg}; color: ${palette.text}; }
    .browser-card { background: ${palette.surface}; border: 1px solid ${palette.border}; border-radius: 10px; padding: 16px; box-sizing: border-box; }
    .browser-card pre { margin: 0; white-space: pre-wrap; word-break: break-word; font-family: 'JetBrains Mono', monospace; font-size: 12px; line-height: 1.6; color: ${palette.text}; background: transparent; }
    .browser-card code { font-family: 'JetBrains Mono', monospace; background: ${palette.code}; border-radius: 4px; padding: 1px 4px; }
    .browser-card a { color: ${palette.link}; }
    .browser-card table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    .browser-card th, .browser-card td { border: 1px solid ${palette.border}; padding: 8px; text-align: left; }
    .browser-card blockquote { margin: 12px 0; padding-left: 12px; border-left: 3px solid ${palette.border}; color: ${palette.muted}; }
    .browser-audio { display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; box-sizing: border-box; }
    .browser-audio-card { width: min(720px, 100%); background: ${palette.surface}; color: ${palette.text}; border: 1px solid ${palette.border}; border-radius: 14px; padding: 20px; box-sizing: border-box; }
    .browser-audio-title { font-size: 14px; font-weight: 600; margin-bottom: 12px; }
    .browser-audio audio { width: 100%; }
    .browser-image { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 18px; box-sizing: border-box; background: ${palette.bg}; }
    .browser-image img { max-width: 100%; max-height: calc(100vh - 36px); object-fit: contain; border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.18); }
  </style>
</head>
<body>${bodyHtml}</body>
</html>`;
}

async function docsOpenFilePreview(relPath, name, projectId, size) {
  const url = _docProjectFileUrl(relPath, projectId);
  if (!url) {
    addSystemBubble('Selecione um projeto ativo para abrir documentos.');
    return;
  }
  return openPreviewUrl(url, name || relPath, _docFilePreviewOptions(name || relPath, size));
}

async function docsOpenFileOutput(relPath, name, projectId, size) {
  const pid = String(projectId || _activeProjectId() || '').trim();
  const url = _docProjectFileUrl(relPath, pid);
  if (!url) {
    addSystemBubble('Selecione um projeto ativo para abrir documentos.');
    return;
  }

  const fileName = name || relPath;
  const previewOptions = _docFilePreviewOptions(fileName, size);
  const fileType = previewOptions.fileType;
  const artifact = {
    id: `project:${pid}:${relPath}`,
    title: fileName,
    type: fileType,
    url,
    source: 'project-doc',
    project_id: pid,
    path: relPath,
    size: Number(size) || 0,
    _focusInPanel: true,
  };

  try {
    if (['json', 'markdown', 'text'].includes(fileType)) {
      const res = await fetch(url);
      let text = await res.text();
      if (text.length > 250000) text = text.slice(0, 250000) + '\n\n... (truncated)';

      if (fileType === 'json') {
        try { text = JSON.stringify(JSON.parse(text), null, 2); } catch (_) {}
        artifact.type = 'json';
      } else if (fileType === 'markdown') {
        artifact.type = 'markdown';
        artifact.content_type = 'text/markdown';
        artifact.content = text;
      } else {
        artifact.content = text;
      }

      if (!artifact.content && artifact.type !== 'html') artifact.content = text;
    }
  } catch (_) {
    // Keep URL-only artifact when content fetch/parsing fails.
  }

  if (typeof addOutputArtifact === 'function') addOutputArtifact(artifact);
  if (typeof showOutputArtifactInPanel === 'function') showOutputArtifactInPanel(artifact.id);
}

function docsOpenFileBrowser(relPath, name, projectId) {
  const url = _docProjectFileUrl(relPath, projectId);
  if (!url) {
    addSystemBubble('Selecione um projeto ativo para abrir documentos.');
    return;
  }

  const iframe = document.getElementById('browserFrame');
  const bar = document.getElementById('browserUrlBar');
  if (!iframe) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }

  const panel = document.getElementById('browserPanel');
  if (panel && !panel.classList.contains('open') && typeof toggleBrowserPanel === 'function') {
    toggleBrowserPanel();
  }

  const fileType = resolvePreviewFileType(name || relPath);
  if (bar) bar.value = url;

  const openRawUrl = () => {
    if (typeof navigateBrowser === 'function') navigateBrowser(url);
    else iframe.src = url;
  };

  if (['audio', 'image', 'json', 'markdown', 'text'].includes(fileType)) {
    fetch(url)
      .then(async res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        if (fileType === 'audio') {
          iframe.srcdoc = _docWrapBrowserContent(name || relPath, `
            <div class="browser-audio">
              <div class="browser-audio-card">
                <div class="browser-audio-title">${escapeHtml(name || relPath)}</div>
                <audio controls preload="metadata" src="${escapeHtmlAttr(url)}"></audio>
              </div>
            </div>`);
          return;
        }

        if (fileType === 'image') {
          iframe.srcdoc = _docWrapBrowserContent(name || relPath, `
            <div class="browser-image">
              <img src="${escapeHtmlAttr(url)}" alt="${escapeHtmlAttr(name || relPath)}">
            </div>`);
          return;
        }

        const rawText = await res.text();
        let contentHtml = '';
        if (fileType === 'json') {
          let pretty = rawText;
          try { pretty = JSON.stringify(JSON.parse(rawText), null, 2); } catch (_) {}
          contentHtml = `<div class="browser-doc"><div class="browser-card"><pre>${escapeHtml(pretty)}</pre></div></div>`;
        } else if (fileType === 'markdown' && window.marked) {
          const renderedMarkdown = _rewriteRenderedMarkdownLinks(marked.parse(rawText), { rawUrl: url });
          contentHtml = `<div class="browser-doc"><div class="browser-card answer-md">${renderedMarkdown}</div></div>`;
        } else {
          contentHtml = `<div class="browser-doc"><div class="browser-card"><pre>${escapeHtml(rawText)}</pre></div></div>`;
        }
        iframe.srcdoc = _docWrapBrowserContent(name || relPath, contentHtml);
      })
      .catch(() => openRawUrl());
    return;
  }

  openRawUrl();
}

async function docsDeleteProjectFile(relPath, name, projectId) {
  const pid = String(projectId || _activeProjectId() || '').trim();
  const path = String(relPath || '').trim();
  if (!pid) {
    addSystemBubble('Selecione um projeto ativo para excluir documentos.');
    return;
  }
  if (!path) return;

  const label = String(name || path.split('/').pop() || path);
  const confirmed = window.confirm(`Excluir o arquivo "${label}" do projeto ativo?`);
  if (!confirmed) return;

  try {
    const res = await fetch(`${API_BASE}/api/projects/${encodeURIComponent(pid)}/file?path=${encodeURIComponent(path)}`, {
      method: 'DELETE',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);

    _checkedDocs.delete(_docContextKey(pid, path));
    if (typeof updateDocsContextBar === 'function') updateDocsContextBar();
    if (typeof updateComposeContextBar === 'function') updateComposeContextBar();

    addSystemBubble(`Arquivo removido do projeto: ${label}`);
    if (typeof _toast === 'function') _toast('Arquivo removido', 'success');

    if (typeof loadDocsTree === 'function') loadDocsTree();
    if (typeof loadProjectFiles === 'function') loadProjectFiles();
    if (typeof discLoadFiles === 'function') discLoadFiles();
    if (typeof discLoadOverview === 'function') discLoadOverview();
  } catch (e) {
    addSystemBubble(`Falha ao excluir arquivo: ${e.message || e}`);
    if (typeof _toast === 'function') _toast('Falha ao excluir arquivo', 'error');
  }
}

function _sharedRawUrl(path) {
  return `${API_BASE}/api/shared/raw?path=${encodeURIComponent(path || '')}`;
}

function _sharedPathFromRawValue(rawValue) {
  const raw = String(rawValue || '').trim();
  if (!raw) return '';

  // Already a logical shared path.
  if (!/^https?:\/\//i.test(raw) && !raw.startsWith('/api/shared/')) {
    return raw.replace(/^_shared\//i, '').replace(/^\/+/, '');
  }

  try {
    const parsed = new URL(raw, window.location.origin);
    if (!/\/api\/shared\/(?:raw|file)$/i.test(parsed.pathname)) return '';
    return String(parsed.searchParams.get('path') || '').trim();
  } catch (_) {
    return '';
  }
}

const _sharedDocCompanionCache = new Map();

async function resolveSharedDocCompanion(pathOrUrl) {
  const sharedPath = _sharedPathFromRawValue(pathOrUrl);
  if (!sharedPath) return null;

  const cacheKey = sharedPath.toLowerCase();
  if (_sharedDocCompanionCache.has(cacheKey)) {
    return _sharedDocCompanionCache.get(cacheKey);
  }

  try {
    const res = await fetch(`${API_BASE}/api/shared/companion?path=${encodeURIComponent(sharedPath)}`);
    if (!res.ok) {
      _sharedDocCompanionCache.set(cacheKey, null);
      return null;
    }

    const data = await res.json().catch(() => ({}));
    const companion = data && data.companion_pdf && data.companion_pdf.url
      ? {
          path: String(data.companion_pdf.path || ''),
          name: String(data.companion_pdf.name || ''),
          url: String(data.companion_pdf.url || ''),
        }
      : null;

    _sharedDocCompanionCache.set(cacheKey, companion);
    return companion;
  } catch (_) {
    return null;
  }
}

function _sharedFileType(name, path) {
  if (typeof resolvePreviewFileType === 'function') {
    return resolvePreviewFileType(name || path || '');
  }
  return String(name || path || '').split('.').pop().toLowerCase() || 'file';
}

function sharedOpenFilePreview(path, name) {
  if (typeof previewSharedFile === 'function') {
    return previewSharedFile(path, name);
  }
  const url = _sharedRawUrl(path);
  if (typeof openPreviewUrl === 'function') {
    return openPreviewUrl(url, name || String(path || '').split('/').pop() || 'shared-file', {
      fileType: _sharedFileType(name, path),
      sharedPath: path,
    });
  }
}

async function sharedOpenFileOutput(path, name) {
  const url = _sharedRawUrl(path);
  const title = name || String(path || '').split('/').pop() || 'shared-file';
  const fileType = _sharedFileType(title, path);
  const ext = String(title).split('.').pop().toLowerCase();
  const artifact = {
    id: `shared:${path}`,
    title,
    type: fileType,
    url,
    source: 'shared-file',
    path,
    _focusInPanel: true,
  };

  try {
    if (['json', 'markdown', 'text'].includes(fileType)) {
      const res = await fetch(url);
      let text = await res.text();
      if (text.length > 250000) text = text.slice(0, 250000) + '\n\n... (truncated)';

      if (fileType === 'json') {
        try { text = JSON.stringify(JSON.parse(text), null, 2); } catch (_) {}
        artifact.type = 'json';
        artifact.content_type = 'application/json';
      } else if (fileType === 'markdown') {
        artifact.type = 'markdown';
        artifact.content_type = 'text/markdown';
        artifact.content = text;
      } else {
        artifact.type = ext === 'csv' || ext === 'tsv' ? 'data' : 'text';
        artifact.content = text;
      }

      if (!artifact.content && artifact.type !== 'html') artifact.content = text;
    }
  } catch (_) {
    // Keep URL-only artifact when text fetch/parsing fails.
  }

  if (['docx', 'doc'].includes(fileType)) {
    try {
      const companion = await resolveSharedDocCompanion(path);
      if (companion && companion.url) {
        artifact.companion_pdf_url = companion.url;
        artifact.companion_pdf_name = companion.name || '';
      }
    } catch (_) {
      // Ignore companion lookup failures.
    }
  }

  if (typeof addOutputArtifact === 'function') addOutputArtifact(artifact);
  if (typeof showOutputArtifactInPanel === 'function') showOutputArtifactInPanel(artifact.id);
}

async function sharedOpenFileBrowser(path, name) {
  const url = _sharedRawUrl(path);
  const title = name || String(path || '').split('/').pop() || 'shared-file';
  const fileType = _sharedFileType(title, path);
  const iframe = document.getElementById('browserFrame');
  const bar = document.getElementById('browserUrlBar');

  if (!iframe) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }

  const panel = document.getElementById('browserPanel');
  if (panel && !panel.classList.contains('open') && typeof toggleBrowserPanel === 'function') {
    toggleBrowserPanel();
  }
  if (bar) bar.value = url;

  const openRawUrl = () => {
    if (typeof navigateBrowser === 'function') navigateBrowser(url);
    else iframe.src = url;
  };

  if (fileType === 'docx' || fileType === 'doc') {
    try {
      const companion = await resolveSharedDocCompanion(path);
      if (companion && companion.url) {
        if (typeof navigateBrowser === 'function') navigateBrowser(companion.url);
        else iframe.src = companion.url;
        if (bar) bar.value = companion.url;
        return;
      }
    } catch (_) {
      // Fall through to raw docx URL when companion lookup fails.
    }
  }

  if (['audio', 'image', 'json', 'markdown', 'text'].includes(fileType)) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      if (fileType === 'audio') {
        iframe.srcdoc = _docWrapBrowserContent(title, `
          <div class="browser-audio">
            <div class="browser-audio-card">
              <div class="browser-audio-title">${escapeHtml(title)}</div>
              <audio controls preload="metadata" src="${escapeHtmlAttr(url)}"></audio>
            </div>
          </div>`);
        return;
      }

      if (fileType === 'image') {
        iframe.srcdoc = _docWrapBrowserContent(title, `
          <div class="browser-image">
            <img src="${escapeHtmlAttr(url)}" alt="${escapeHtmlAttr(title)}">
          </div>`);
        return;
      }

      const rawText = await res.text();
      let contentHtml = '';
      if (fileType === 'json') {
        let pretty = rawText;
        try { pretty = JSON.stringify(JSON.parse(rawText), null, 2); } catch (_) {}
        contentHtml = `<div class="browser-doc"><div class="browser-card"><pre>${escapeHtml(pretty)}</pre></div></div>`;
      } else if (fileType === 'markdown' && window.marked) {
        const renderedMarkdown = _rewriteRenderedMarkdownLinks(marked.parse(rawText), {
          sharedPath: path,
          rawUrl: url,
        });
        contentHtml = `<div class="browser-doc"><div class="browser-card answer-md">${renderedMarkdown}</div></div>`;
      } else {
        contentHtml = `<div class="browser-doc"><div class="browser-card"><pre>${escapeHtml(rawText)}</pre></div></div>`;
      }
      iframe.srcdoc = _docWrapBrowserContent(title, contentHtml);
      return;
    } catch (_) {
      openRawUrl();
      return;
    }
  }

  openRawUrl();
}

function sharedOpenFileExternal(path) {
  const url = _sharedRawUrl(path);
  window.open(url, '_blank', 'noopener,noreferrer');
}

function _sharedFindLawArticle(filePath, articleNumber) {
  const list = _sharedLawArticleCache[filePath] || [];
  return list.find(item => String(item.article_number) === String(articleNumber)) || null;
}

function _sharedLawArticleMarkdownBundle(filePath, articleNumber) {
  const article = _sharedFindLawArticle(filePath, articleNumber);
  if (!article) return null;
  const filename = filePath.split('/').pop() || filePath;
  const markdown = _renderSharedLawArticleMarkdown(article, filename);
  const blob = new Blob([markdown], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  return { article, filename, markdown, url };
}

function sharedOpenLawArticlePreview(filePath, articleNumber, openCompare) {
  openSharedLawArticlePreview(filePath, articleNumber, openCompare);
}

function sharedOpenLawArticleOutput(filePath, articleNumber) {
  const article = _sharedFindLawArticle(filePath, articleNumber);
  if (!article) return;
  const filename = filePath.split('/').pop() || filePath;
  const artifactId = _openSharedLawArticleInOutput(article, filePath, filename);
  if (typeof showOutputArtifactInPanel === 'function' && artifactId) {
    showOutputArtifactInPanel(artifactId);
  }
}

function sharedOpenLawArticleBrowser(filePath, articleNumber) {
  const bundle = _sharedLawArticleMarkdownBundle(filePath, articleNumber);
  if (!bundle) return;
  const iframe = document.getElementById('browserFrame');
  const bar = document.getElementById('browserUrlBar');
  if (!iframe) {
    window.open(bundle.url, '_blank', 'noopener,noreferrer');
    return;
  }
  const panel = document.getElementById('browserPanel');
  if (panel && !panel.classList.contains('open') && typeof toggleBrowserPanel === 'function') {
    toggleBrowserPanel();
  }
  if (bar) bar.value = bundle.url;
  const renderedPreview = window.marked
    ? _rewriteRenderedMarkdownLinks(marked.parse(bundle.markdown), {
        sharedPath: filePath,
        rawUrl: _sharedRawUrl(filePath),
      })
    : `<pre style="margin:0;white-space:pre-wrap;word-break:break-word;font-size:12px;font-family:var(--mono)">${escapeHtml(bundle.markdown)}</pre>`;
  iframe.srcdoc = _docWrapBrowserContent(`${bundle.filename} - Artigo ${articleNumber}`, `<div class="browser-doc"><div class="browser-card">${renderedPreview}</div></div>`);
}

function sharedOpenLawArticleExternal(filePath, articleNumber) {
  const bundle = _sharedLawArticleMarkdownBundle(filePath, articleNumber);
  if (!bundle) return;
  window.open(bundle.url, '_blank', 'noopener,noreferrer');
}

function _buildProjectDocsTree(files, options) {
  const opts = options || {};
  const mapPath = typeof opts.mapPath === 'function' ? opts.mapPath : null;
  const displayPrefix = String(opts.displayPrefix || '').trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  const pathNamespace = String(opts.pathNamespace || '').trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  const ensureTopDirs = Array.isArray(opts.ensureTopDirs) ? opts.ensureTopDirs : [];

  const root = [];
  for (const file of (files || [])) {
    const originalRel = String(file && file.name ? file.name : '').replace(/\\/g, '/').trim();
    if (!originalRel) continue;

    let rel = originalRel;
    if (mapPath) {
      try {
        rel = String(mapPath(originalRel, file) || '').trim();
      } catch (_) {
        rel = originalRel;
      }
    }
    rel = rel.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    if (!rel) continue;
    if (displayPrefix) rel = `${displayPrefix}/${rel}`;

    const parts = rel.split('/').filter(Boolean);
    if (!parts.length) continue;

    let cursor = root;
    let acc = '';
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      acc = acc ? `${acc}/${part}` : part;
      const treePath = pathNamespace ? `${pathNamespace}/${acc}` : acc;
      const isLast = i === parts.length - 1;
      if (isLast) {
        cursor.push({ type: 'file', name: part, path: originalRel, tree_path: treePath, size: file.size || 0 });
      } else {
        let dir = cursor.find(n => n.type === 'dir' && (n.tree_path || n.path) === treePath);
        if (!dir) {
          dir = { type: 'dir', name: part, path: acc, tree_path: treePath, children: [] };
          cursor.push(dir);
        }
        cursor = dir.children;
      }
    }
  }

  function sortTree(nodes) {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
      return String(a.name).localeCompare(String(b.name));
    });
    for (const n of nodes) {
      if (n.type === 'dir' && Array.isArray(n.children)) sortTree(n.children);
    }
  }

  for (const dirName of ensureTopDirs) {
    const name = String(dirName || '').trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    if (!name) continue;
    const treePath = pathNamespace ? `${pathNamespace}/${name}` : name;
    const exists = root.some((node) => node && node.type === 'dir' && (node.tree_path || node.path) === treePath);
    if (!exists) {
      root.push({ type: 'dir', name, path: name, tree_path: treePath, children: [] });
    }
  }

  sortTree(root);
  return root;
}

function _filterDocsSidebarFiles(files) {
  const src = Array.isArray(files) ? files : [];
  return src.filter((file) => {
    const rel = String(file && file.name ? file.name : '').replace(/\\/g, '/').trim();
    if (!rel) return false;
    if (rel.includes('/')) return true;
    return !_DOCS_HIDDEN_ROOT_ENTRIES.has(rel.toLowerCase());
  });
}

function _docActiveAgentOutputsDisplayPath(relPath) {
  const normalized = String(relPath || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (!normalized) return '';

  const wsMatch = normalized.match(/^(.*)\/workspace\/outputs\/(.+)$/i);
  if (wsMatch) {
    const tail = String(wsMatch[2] || '').replace(/^\/+|\/+$/g, '');
    if (tail) return tail;
  }

  const outMatch = normalized.match(/^(.*)\/outputs\/(.+)$/i);
  if (outMatch) {
    const tail = String(outMatch[2] || '').replace(/^\/+|\/+$/g, '');
    if (tail) return tail;
  }

  return normalized;
}

function _mergeDocsTreeNodes(baseNodes, extraNodes) {
  const base = Array.isArray(baseNodes) ? baseNodes : [];
  const extra = Array.isArray(extraNodes) ? extraNodes : [];

  for (const node of extra) {
    if (!node || !node.type) continue;
    const nodeKey = `${node.type}:${String(node.tree_path || node.path || node.name || '')}`;
    const existing = base.find((item) => {
      if (!item || item.type !== node.type) return false;
      const itemKey = `${item.type}:${String(item.tree_path || item.path || item.name || '')}`;
      return itemKey === nodeKey;
    });

    if (!existing) {
      base.push(node);
      continue;
    }

    if (node.type === 'dir') {
      existing.children = _mergeDocsTreeNodes(
        Array.isArray(existing.children) ? existing.children : [],
        Array.isArray(node.children) ? node.children : []
      );
    }
  }

  return base;
}

function _splitDocsFilesByActiveAgentOutputs(files, activeAgentId) {
  const src = Array.isArray(files) ? files : [];
  const aid = String(activeAgentId || '').trim();
  const pinned = [];
  const regular = [];

  for (const file of src) {
    const rel = String(file && file.name ? file.name : '').replace(/\\/g, '/').trim();
    if (!rel) continue;
    const source = String(file && file.source ? file.source : '').trim();
    const owner = String(file && file.agent_id ? file.agent_id : '').trim();
    const isTaggedActiveOutput = source === 'agent_outputs' && (!aid || !owner || owner === aid);
    const isWorkspaceOutputsPath = /(^|\/)workspace\/outputs\//i.test(rel);
    const shouldPinByFallback = !!aid && !source && isWorkspaceOutputsPath;

    if (isTaggedActiveOutput || shouldPinByFallback) pinned.push(file);
    else regular.push(file);
  }

  return { pinned, regular };
}

// Load documents tree
async function loadDocsTree() {
  const el = document.getElementById('docsTree');
  if (!el) return;

  const projectId = _activeProjectId();
  if (!projectId) {
    el.innerHTML = '<p style="color:var(--gray);font-size:12px;text-align:center;padding:20px 0">Selecione um projeto ativo para listar documentos.</p>';
    return;
  }

  try {
    const activeAgentId = (typeof selectedAgent !== 'undefined' && selectedAgent && selectedAgent.agent_id)
      ? String(selectedAgent.agent_id).trim()
      : '';
    const listUrl = activeAgentId
      ? `${API_BASE}/api/projects/${encodeURIComponent(projectId)}/files?agent_id=${encodeURIComponent(activeAgentId)}`
      : `${API_BASE}/api/projects/${encodeURIComponent(projectId)}/files`;
    const res = await fetch(listUrl);
    const data = await res.json();
    if (data && data.project_abs_path) {
      _docProjectAbsPathById.set(String(projectId), String(data.project_abs_path));
    }
    const files = _filterDocsSidebarFiles(Array.isArray(data.files) ? data.files : []);
    const partitioned = _splitDocsFilesByActiveAgentOutputs(files, activeAgentId);
    const baseTree = _buildProjectDocsTree(partitioned.regular, {
      ensureTopDirs: ['outputs'],
    });
    let tree = baseTree;
    if (activeAgentId && partitioned.pinned.length) {
      const pinnedTree = _buildProjectDocsTree(partitioned.pinned, {
        mapPath: _docActiveAgentOutputsDisplayPath,
        displayPrefix: 'outputs',
      });
      tree = _mergeDocsTreeNodes(baseTree, pinnedTree);
    }
    if (!tree.length) {
      el.innerHTML = '<p style="color:var(--gray);font-size:12px;text-align:center;padding:20px 0">Nenhum arquivo no projeto ativo.</p>';
      return;
    }
    el.innerHTML = renderDocsNodes(tree, projectId);
    _bindDocsPinnedPathUiSync();
    _refreshDocsPinButtons();
    updateDocsContextBar();
  } catch(e) {
    el.innerHTML = '<p style="color:var(--red);font-size:12px;text-align:center;padding:20px">Falha ao carregar documentos do projeto.</p>';
  }
}

// Render document tree nodes
function renderDocsNodes(nodes, projectId) {
  const pid = projectId || _activeProjectId() || '';
  return nodes.map(n => {
    if (n.type === 'dir') {
      const dirPath = String(n.tree_path || n.path || '');
      const safeId = _docDirSafeId(dirPath);
      const isOpen = _docOpenDirs.has(_docOpenDirKey(pid, dirPath));
      const childrenHtml = n.children && n.children.length ? `<div class="docs-tree-children" style="display:${isOpen ? 'block' : 'none'}" id="dtree-${safeId}">${renderDocsNodes(n.children, pid)}</div>` : '';
      return `<div class="docs-tree-item dir${isOpen ? ' open' : ''}" onclick='toggleDocsDir(${JSON.stringify(safeId)}, ${JSON.stringify(dirPath)}, ${JSON.stringify(pid)}, this)'><i class="fas ${isOpen ? 'fa-folder-open' : 'fa-folder'}"></i><span class="docs-name">${escapeHtml(n.name)}</span></div>${childrenHtml}`;
    }
    const filePath = String(n.path || '').trim();
    if (!filePath) return '';
    const ext = n.name.split('.').pop().toLowerCase();
    const supportedCtx = ['md','txt','json','yaml','yml','toml','py','html','css','js','docx','doc','pdf','csv','xml','sql','log'].includes(ext);
    const icon = {html:'fa-file-code',md:'fa-file-lines',json:'fa-file-code',pdf:'fa-file-pdf',txt:'fa-file-alt'}[ext] || 'fa-file';
    const key = _docContextKey(pid, filePath);
    const checked = _checkedDocs.has(key) ? ' checked' : '';
    const checkedClass = _checkedDocs.has(key) ? ' checked' : '';
    const previewArgs = `${JSON.stringify(filePath)},${JSON.stringify(n.name)},${JSON.stringify(pid)},${JSON.stringify(Number(n.size) || 0)}`;
    const fileUrl = _docProjectFileUrl(filePath, pid);
    const absPath = _docProjectAbsolutePath(filePath, pid);
    const pinned = !!(absPath && typeof koutIsPinned === 'function' && koutIsPinned(absPath));
    const checkboxHtml = supportedCtx
      ? `<input type="checkbox" class="doc-check" data-path="${escapeHtml(filePath)}" data-project-id="${escapeHtml(pid)}" data-name="${escapeHtml(n.name)}" ${checked} onclick="event.stopPropagation();toggleDocContext(this)" title="Adicionar como contexto">`
      : '';
    const actionsHtml = `
      <div class="docs-tree-actions" onclick="event.stopPropagation()">
        <button class="docs-action-btn" onclick='docsOpenFilePreview(${previewArgs})' title="Preview"><i class="fas fa-eye"></i></button>
        <button class="docs-action-btn" onclick='docsOpenFileOutput(${previewArgs})' title="Output panel"><i class="fas fa-columns"></i></button>
        <button class="docs-action-btn" onclick='docsOpenFileBrowser(${JSON.stringify(filePath)},${JSON.stringify(n.name)},${JSON.stringify(pid)})' title="Browser panel"><i class="fas fa-globe"></i></button>
        <button class="docs-action-btn pin-btn ${pinned ? 'active' : ''}" data-pin-abs="${escapeHtmlAttr(absPath)}" onclick='toggleDocsFilePin(${JSON.stringify(filePath)},${JSON.stringify(n.name)},${JSON.stringify(pid)},this)' title="${pinned ? 'Desafixar path do contexto' : 'Fixar path no contexto do agente'}"><i class="fas fa-thumbtack"></i></button>
        <a class="docs-action-btn" href="${escapeHtmlAttr(fileUrl)}" target="_blank" rel="noopener noreferrer" title="Abrir em nova guia"><i class="fas fa-external-link-alt"></i></a>
        <button class="docs-action-btn danger" onclick='docsDeleteProjectFile(${JSON.stringify(filePath)},${JSON.stringify(n.name)},${JSON.stringify(pid)})' title="Excluir arquivo"><i class="fas fa-trash"></i></button>
      </div>`;
    return `<div class="docs-tree-item file${checkedClass}" onclick='docsOpenFilePreview(${previewArgs})'><div class="docs-tree-main">${checkboxHtml}<i class="fas ${icon}"></i><span class="docs-name">${escapeHtml(n.name)}</span></div>${actionsHtml}</div>`;
  }).join('');
}

function _setDocsPinButtonState(btn, absPath) {
  if (!btn) return;
  const pinned = !!(absPath && typeof koutIsPinned === 'function' && koutIsPinned(absPath));
  btn.classList.toggle('active', pinned);
  btn.title = pinned ? 'Desafixar path do contexto' : 'Fixar path no contexto do agente';
}

function _refreshDocsPinButtons() {
  const buttons = document.querySelectorAll('.docs-action-btn.pin-btn[data-pin-abs]');
  buttons.forEach(btn => {
    const absPath = String(btn.dataset.pinAbs || '').trim();
    _setDocsPinButtonState(btn, absPath);
  });
}

function _bindDocsPinnedPathUiSync() {
  if (_docsPinUiBound) return;
  _docsPinUiBound = true;
  window.addEventListener('LA8159:pinned-paths-updated', () => {
    _refreshDocsPinButtons();
    if (typeof updateComposeContextBar === 'function') updateComposeContextBar();
  });
}

function _togglePinnedPath(absPath, label, kind, origin, btnEl) {
  const abs = String(absPath || '').trim();
  if (!abs) {
    if (typeof _toast === 'function') _toast('Nao foi possivel resolver path absoluto', 'warning');
    return;
  }

  const isPinned = typeof koutIsPinned === 'function' && koutIsPinned(abs);
  if (isPinned) {
    if (typeof koutUnpinPath === 'function') koutUnpinPath(abs);
  } else if (typeof koutPinPath === 'function') {
    koutPinPath(abs, { label: String(label || ''), kind: String(kind || 'file'), origin: String(origin || '') });
  }

  _setDocsPinButtonState(btnEl, abs);
  _refreshDocsPinButtons();
  if (typeof updateComposeContextBar === 'function') updateComposeContextBar();
}

function toggleDocsFilePin(relPath, name, projectId, btnEl) {
  const absPath = _docProjectAbsolutePath(relPath, projectId);
  _togglePinnedPath(absPath, name || relPath, 'project-file', `project:${projectId || _activeProjectId() || ''}`, btnEl);
}

function toggleSharedFilePin(path, name, btnEl) {
  const absPath = _sharedAbsolutePath(path);
  _togglePinnedPath(absPath, name || path, 'shared-file', 'shared', btnEl);
}

// Toggle document directory
function toggleDocsDir(id, relPath, projectId, el) {
  const children = document.getElementById('dtree-' + id);
  if (!children) return;
  const isOpen = children.style.display !== 'none';
  children.style.display = isOpen ? 'none' : 'block';
  const key = _docOpenDirKey(projectId || _activeProjectId(), relPath || '');
  if (isOpen) _docOpenDirs.delete(key);
  else _docOpenDirs.add(key);
  _persistDocOpenDirs();
  if (el) el.classList.toggle('open', !isOpen);
  const icon = el.querySelector('i');
  if (icon) icon.className = isOpen ? 'fas fa-folder' : 'fas fa-folder-open';
}

// Toggle law file articles
async function toggleLawFileArticles(fullPath, category, filename, safeId) {
  const btn = document.getElementById('law-expand-' + safeId);
  const container = document.getElementById('law-arts-' + safeId);
  if (!btn || !container) return;

  const isOpen = container.classList.contains('open');
  if (isOpen) {
    container.classList.remove('open');
    btn.classList.remove('open');
    btn.querySelector('i').className = 'fas fa-chevron-right';
    return;
  }

  // Open
  btn.classList.add('open');
  btn.querySelector('i').className = 'fas fa-chevron-down';
  container.classList.add('open');

  // Already loaded?
  if (_lawArticleCache[fullPath]) {
    renderLawArticles(container, _lawArticleCache[fullPath], fullPath, filename);
    return;
  }

  container.innerHTML = '<div style="text-align:center;padding:12px;color:var(--gray);font-size:11px"><div class="loading" style="width:14px;height:14px;border-width:2px;display:inline-block"></div></div>';

  try {
    const basePath = API.replace(/\/$/, '');
    const res = await fetch(`${basePath}/shared/file?category=${encodeURIComponent(category)}&file=${encodeURIComponent(filename)}`);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const text = await res.text();
    let articles;
    try { articles = JSON.parse(text); } catch(e) { throw new Error('JSON inválido'); }

    // Detect if this is an article array
    if (!Array.isArray(articles) || !articles.length || !articles[0].article_number) {
      container.innerHTML = '<div style="color:var(--gray);font-size:11px;padding:8px 12px;text-align:center">Não é um arquivo de artigos.</div>';
      return;
    }

    _lawArticleCache[fullPath] = articles;
    renderLawArticles(container, articles, fullPath, filename);
  } catch(e) {
    container.innerHTML = `<div style="color:var(--red);font-size:11px;padding:8px 12px">Erro: ${escapeHtml(e.message)}</div>`;
  }
}

// Render law articles
function renderLawArticles(container, articles, fullPath, filename) {
  const html = articles.map(a => {
    const isChecked = _checkedArticles.has(fullPath + '#' + a.article_number);
    return `
      <div class="law-article-item ${isChecked ? 'checked' : ''}">
        <input type="checkbox" class="article-check" aria-label="Artigo ${a.article_number}" data-path="${fullPath}" data-article="${a.article_number}" ${isChecked ? 'checked' : ''} onclick="event.stopPropagation();toggleArticleContext(this)">
        <span class="law-art-number" onclick="previewLawArticle('${fullPath}',${a.article_number})">${a.article_number}</span>
        <span class="law-art-text" onclick="previewLawArticle('${fullPath}',${a.article_number})">${escapeHtml(a.text || '')}</span>
      </div>
    `;
  }).join('');
  container.innerHTML = html;
}

// Filter law articles
function filterLawArticles(query) {
  const items = document.querySelectorAll('.law-article-item');
  const re = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  
  items.forEach(item => {
    const text = item.querySelector('.law-art-text').textContent;
    item.style.display = re.test(text) ? '' : 'none';
  });
}

// Preview law article
async function previewLawArticle(fullPath, articleNumber) {
  const modal = document.getElementById('lawArticleModal');
  const content = document.getElementById('lawArticleContent');
  if (!modal || !content) return;

  content.innerHTML = '<div class="loading" style="width:24px;height:24px;border-width:3px;display:block;margin:40px auto"></div>';
  modal.classList.add('show');

  try {
    const basePath = API.replace(/\/$/, '');
    // /api/shared/article does not exist — fetch the full file and filter the article
    const res = await fetch(`${basePath}/shared/file?path=${encodeURIComponent(fullPath)}`);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const text = await res.text();
    
    let article;
    try {
      const arr = JSON.parse(text);
      const articles = Array.isArray(arr) ? arr : (arr.articles || []);
      article = articles.find(a => String(a.article_number) === String(articleNumber)) || articles[0];
      if (!article) throw new Error('Artigo não encontrado');
    } catch(e) { throw new Error('JSON inválido: ' + e.message); }
    
    content.innerHTML = `
      <div class="law-art-preview-header">
        <h4>${escapeHtml(article.article_number || articleNumber)}</h4>
        <button class="close-btn" onclick="document.getElementById('lawArticleModal').classList.remove('show')">&times;</button>
      </div>
      <div class="law-art-preview-content">
        ${escapeHtml(article.text || 'No text').replace(/\n/g, '<br>')}
      </div>
      ${article.citation ? `<div class="law-art-citation"><small>${escapeHtml(article.citation)}</small></div>` : ''}
      <div class="law-art-actions">
        <button class="btn btn-sm" onclick="addArticleToContext('${fullPath}',${articleNumber})">
          <i class="fas fa-plus"></i> Adicionar ao contexto
        </button>
      </div>
    `;
  } catch(e) {
    content.innerHTML = `<div style="color:var(--red);text-align:center;padding:40px">Erro: ${escapeHtml(e.message)}</div>`;
  }
}

// Open document file
let _previewPanelOpenTimer = null;
let _previewPanelCloseTimer = null;

window.togglePreviewPanel = function(show) {
  const panel  = document.getElementById('previewPanel');
  const handle = document.getElementById('previewResizeHandle');
  if (!panel) return;
  if (show === undefined) show = !panel.classList.contains('open');

  if (_previewPanelOpenTimer) {
    clearTimeout(_previewPanelOpenTimer);
    _previewPanelOpenTimer = null;
  }
  if (_previewPanelCloseTimer) {
    clearTimeout(_previewPanelCloseTimer);
    _previewPanelCloseTimer = null;
  }

  if (show) {
    panel.style.display = 'flex';
    // Small delay to allow display:flex to apply before transition
    _previewPanelOpenTimer = setTimeout(() => {
      panel.classList.add('open');
      if (typeof window.syncWorkspacePanels === 'function') {
        window.syncWorkspacePanels();
      } else {
        if (handle) handle.classList.add('visible');
        if (typeof window._refreshWorkspacePanelsBusy === 'function') window._refreshWorkspacePanelsBusy();
      }
    }, 10);
  } else {
    panel.classList.remove('open');
    if (typeof window.syncWorkspacePanels === 'function') {
      window.syncWorkspacePanels();
    } else if (handle) {
      handle.classList.remove('visible');
    }
    _previewPanelCloseTimer = setTimeout(() => {
      if (!panel.classList.contains('open')) panel.style.display = 'none';
      if (typeof window.syncWorkspacePanels === 'function') {
        window.syncWorkspacePanels();
      } else if (typeof window._refreshWorkspacePanelsBusy === 'function') {
        window._refreshWorkspacePanelsBusy();
      }
    }, 300);
  }
};

function escapeHtmlAttr(s) {
  return (s || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function previewFormatDuration(totalSeconds) {
  const secs = Number(totalSeconds);
  if (!Number.isFinite(secs) || secs < 0) return '—';
  const rounded = Math.round(secs);
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function previewGetAudioContext() {
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  if (!window.__oliviaPreviewAudioContext) {
    window.__oliviaPreviewAudioContext = new Ctor();
  }
  return window.__oliviaPreviewAudioContext;
}

function previewBuildWaveformPeaks(audioBuffer, sampleCount) {
  const channel = audioBuffer.getChannelData(0);
  const buckets = Math.max(48, sampleCount || 160);
  const blockSize = Math.max(1, Math.floor(channel.length / buckets));
  const peaks = [];

  for (let index = 0; index < buckets; index++) {
    const start = index * blockSize;
    const end = Math.min(start + blockSize, channel.length);
    let max = 0;
    for (let cursor = start; cursor < end; cursor++) {
      const value = Math.abs(channel[cursor]);
      if (value > max) max = value;
    }
    peaks.push(max);
  }

  return peaks;
}

function previewRenderWaveform(canvas, peaks, progressRatio) {
  if (!canvas || !peaks || !peaks.length) return;
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(320, Math.floor(canvas.clientWidth || canvas.width || 640));
  const height = Math.max(120, Math.floor(canvas.clientHeight || canvas.height || 160));
  if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const mid = height / 2;
  const barWidth = width / peaks.length;
  const playedColor = 'rgba(196, 98, 45, 0.95)';
  const pendingColor = 'rgba(124, 118, 110, 0.42)';
  const glowColor = 'rgba(196, 98, 45, 0.12)';

  ctx.fillStyle = glowColor;
  ctx.fillRect(0, 0, width, height);

  for (let index = 0; index < peaks.length; index++) {
    const amplitude = Math.max(0.04, peaks[index]);
    const barHeight = Math.max(6, amplitude * (height * 0.82));
    const x = index * barWidth;
    const y = mid - barHeight / 2;
    const played = (index / peaks.length) <= progressRatio;
    ctx.fillStyle = played ? playedColor : pendingColor;
    ctx.fillRect(x + Math.max(0.5, barWidth * 0.15), y, Math.max(1.5, barWidth * 0.7), barHeight);
  }

  const progressX = Math.max(0, Math.min(width, width * progressRatio));
  ctx.fillStyle = 'rgba(250, 249, 246, 0.9)';
  ctx.fillRect(progressX, 0, 2, height);
}

async function attachAudioPreviewMeta(body, audioUrl) {
  if (!body) return;
  const audio = body.querySelector('[data-preview-audio]');
  const durationEl = body.querySelector('[data-preview-audio-duration]');
  const currentEl = body.querySelector('[data-preview-audio-current]');
  const buttonEl = body.querySelector('[data-preview-audio-toggle]');
  const statusEl = body.querySelector('[data-preview-audio-status]');
  const canvas = body.querySelector('[data-preview-audio-waveform]');
  if (!audio || !durationEl) return;

  let peaks = null;

  const render = () => {
    if (!canvas || !peaks) return;
    const ratio = Number.isFinite(audio.duration) && audio.duration > 0
      ? Math.max(0, Math.min(1, audio.currentTime / audio.duration))
      : 0;
    previewRenderWaveform(canvas, peaks, ratio);
  };

  const updateCurrent = () => {
    if (currentEl) currentEl.textContent = previewFormatDuration(audio.currentTime || 0);
  };

  const updateButton = () => {
    if (!buttonEl) return;
    const isPlaying = !audio.paused && !audio.ended;
    buttonEl.innerHTML = isPlaying
      ? '<i class="fas fa-pause"></i> Pausar'
      : '<i class="fas fa-play"></i> Ouvir';
  };

  const update = () => {
    durationEl.textContent = previewFormatDuration(audio.duration);
    updateCurrent();
    render();
  };

  const fail = () => {
    durationEl.textContent = 'indisponível';
    if (statusEl) statusEl.textContent = 'Não foi possível ler a duração do áudio.';
  };

  audio.addEventListener('loadedmetadata', update, { once: true });
  audio.addEventListener('error', fail, { once: true });
  audio.addEventListener('timeupdate', () => {
    updateCurrent();
    render();
  });
  audio.addEventListener('play', updateButton);
  audio.addEventListener('pause', updateButton);
  audio.addEventListener('ended', () => {
    updateButton();
    render();
  });

  if (buttonEl) {
    buttonEl.addEventListener('click', async () => {
      try {
        if (audio.paused) await audio.play();
        else audio.pause();
      } catch (_) {
        if (statusEl) statusEl.textContent = 'O navegador bloqueou a reprodução automática. Use os controles abaixo.';
      }
    });
  }

  let resizeObserver = null;
  if (canvas && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => render());
    resizeObserver.observe(canvas);
  }

  if (Number.isFinite(audio.duration) && audio.duration > 0) update();
  updateButton();
  updateCurrent();

  if (canvas && audioUrl) {
    try {
      if (statusEl) statusEl.textContent = 'Gerando waveform…';
      const audioContext = previewGetAudioContext();
      if (!audioContext) throw new Error('AudioContext indisponível');
      const response = await fetch(audioUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const buffer = await response.arrayBuffer();
      const decoded = await audioContext.decodeAudioData(buffer.slice(0));
      peaks = previewBuildWaveformPeaks(decoded, 180);
      render();
      if (statusEl) statusEl.textContent = 'Waveform pronta.';
    } catch (_) {
      if (statusEl) statusEl.textContent = 'Waveform indisponível. O player continua disponível.';
    }
  }

  if (resizeObserver && canvas) {
    audio.addEventListener('emptied', () => resizeObserver.disconnect(), { once: true });
  }
}

function resolvePreviewFileType(name, options) {
  const previewOptions = options && typeof options === 'object' ? options : {};
  const explicitType = String(previewOptions.fileType || '').trim().toLowerCase();
  const mimeType = String(previewOptions.mimeType || '').trim().toLowerCase();
  const ext = String(name || '').split('.').pop().toLowerCase();

  const normalize = (value) => {
    if (!value) return '';
    if (['file', 'binary', 'unknown', 'artifact'].includes(value)) return '';
    if (value === 'md') return 'markdown';
    if (value === 'htm') return 'html';
    if (['audio', 'image', 'video', 'pdf', 'html', 'htm', 'markdown', 'md', 'doc', 'docx', 'json', 'text'].includes(value)) {
      return value;
    }
    if (['wav', 'mp3', 'm4a', 'flac', 'ogg', 'webm', 'aac'].includes(value)) return 'audio';
    if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp'].includes(value)) return 'image';
    if (['jsonl', 'ndjson'].includes(value)) return 'json';
    if (['docm'].includes(value)) return 'docx';
    if (['mdown', 'mkd'].includes(value)) return 'markdown';
    if (['txt', 'csv', 'xml', 'yaml', 'yml', 'toml', 'log', 'sql', 'sh', 'env', 'cfg', 'ini', 'py', 'js', 'ts', 'tsx', 'jsx', 'css', 'rst'].includes(value)) return 'text';
    return value;
  };

  const normalizedExplicit = normalize(explicitType);
  if (normalizedExplicit && normalizedExplicit !== 'text') return normalizedExplicit;

  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType === 'text/html' || mimeType === 'application/xhtml+xml') return 'html';
  if (mimeType === 'text/markdown') return 'markdown';
  if (mimeType === 'application/json') return 'json';
  if (mimeType.includes('wordprocessingml') || mimeType.includes('msword')) return 'docx';
  if (mimeType === 'application/vnd.google-apps.document') return 'docx';
  if (mimeType === 'application/vnd.google-apps.spreadsheet') return 'file';
  if (mimeType === 'application/vnd.google-apps.presentation') return 'file';
  if (mimeType === 'application/vnd.google-apps.drawing') return 'pdf';
  if (mimeType.startsWith('text/')) return 'text';

  if (normalizedExplicit === 'text') {
    return normalize(ext) || 'text';
  }

  return normalize(ext) || 'file';
}

function resolvePreviewMimeLabel(name, options) {
  const previewOptions = options && typeof options === 'object' ? options : {};
  const rawMime = String(previewOptions.mimeType || '').trim().toLowerCase();
  if (rawMime && rawMime !== 'application/octet-stream') return rawMime;

  const ext = String(name || '').split('.').pop().toLowerCase();
  const fallback = {
    m4a: 'audio/mp4',
    mp4: 'audio/mp4',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    flac: 'audio/flac',
    webm: 'audio/webm',
    aac: 'audio/aac',
  };
  return fallback[ext] || (rawMime || 'audio');
}

function _splitMarkdownHref(rawHref) {
  const raw = String(rawHref || '').trim();
  if (!raw) return { path: '', query: '', hash: '' };

  const hashIdx = raw.indexOf('#');
  const queryIdx = raw.indexOf('?');
  let cut = raw.length;
  if (queryIdx >= 0 && queryIdx < cut) cut = queryIdx;
  if (hashIdx >= 0 && hashIdx < cut) cut = hashIdx;

  const path = raw.slice(0, cut);
  const query = (queryIdx >= 0 && (hashIdx < 0 || queryIdx < hashIdx))
    ? raw.slice(queryIdx, hashIdx >= 0 ? hashIdx : raw.length)
    : '';
  const hash = hashIdx >= 0 ? raw.slice(hashIdx) : '';
  return { path, query, hash };
}

function _decodeMarkdownPathToken(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    return decodeURIComponent(raw);
  } catch (_) {
    try {
      return decodeURI(raw);
    } catch (_) {
      return raw;
    }
  }
}

function _resolvePosixPath(baseDir, relPath) {
  const base = String(baseDir || '').replace(/\\/g, '/');
  const rel = String(relPath || '').replace(/\\/g, '/');
  const stack = [];
  const joined = rel.startsWith('/') ? rel : `${base}${base.endsWith('/') || !base ? '' : '/'}${rel}`;

  joined.split('/').forEach(part => {
    if (!part || part === '.') return;
    if (part === '..') {
      if (stack.length) stack.pop();
      return;
    }
    stack.push(part);
  });

  return stack.join('/');
}

function _resolveSharedMarkdownPath(sharedPath, hrefPath) {
  const source = String(sharedPath || '').replace(/^_shared\//i, '').replace(/^\/+/, '').trim();
  const target = _decodeMarkdownPathToken(hrefPath);
  if (!source || !target) return '';

  if (target.startsWith('/')) {
    return _resolvePosixPath('', target);
  }

  const slash = source.lastIndexOf('/');
  const baseDir = slash >= 0 ? source.slice(0, slash + 1) : '';
  return _resolvePosixPath(baseDir, target);
}

function _resolveProjectMarkdownRawUrl(rawUrl, hrefPath) {
  const href = _decodeMarkdownPathToken(hrefPath);
  if (!rawUrl || !href) return null;

  try {
    const parsed = new URL(rawUrl, window.location.origin);
    const match = parsed.pathname.match(/^\/api\/projects\/([^/]+)\/raw$/);
    if (!match) return null;

    const currentPath = String(parsed.searchParams.get('path') || '').replace(/\\/g, '/');
    if (!currentPath) return null;

    const slash = currentPath.lastIndexOf('/');
    const baseDir = slash >= 0 ? currentPath.slice(0, slash + 1) : '';
    const resolvedPath = href.startsWith('/')
      ? _resolvePosixPath('', href)
      : _resolvePosixPath(baseDir, href);
    if (!resolvedPath) return null;

    return {
      url: `${parsed.origin}/api/projects/${encodeURIComponent(match[1])}/raw?path=${encodeURIComponent(resolvedPath)}`,
      path: resolvedPath,
    };
  } catch (_) {
    return null;
  }
}

function _rewriteRenderedMarkdownLinks(renderedHtml, options) {
  const opts = options && typeof options === 'object' ? options : {};
  const wrapper = document.createElement('div');
  wrapper.innerHTML = String(renderedHtml || '');

  const sharedPath = String(opts.sharedPath || '').trim();
  const rawUrl = String(opts.rawUrl || '').trim();

  wrapper.querySelectorAll('a[href]').forEach(link => {
    const hrefRaw = String(link.getAttribute('href') || '').trim();
    if (!hrefRaw) return;

    if (/^javascript:/i.test(hrefRaw)) {
      link.removeAttribute('href');
      return;
    }

    // Keep same-document anchors in-panel.
    if (hrefRaw.startsWith('#')) {
      return;
    }

    if (/^(https?:|mailto:|tel:)/i.test(hrefRaw)) {
      if (!link.getAttribute('target')) link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener noreferrer');
      return;
    }

    const parts = _splitMarkdownHref(hrefRaw);
    const hrefPath = String(parts.path || '').trim();
    if (!hrefPath) return;

    // Absolute app links that can be previewed.
    if (/^\/api\/(shared|projects)\//i.test(hrefPath)) {
      try {
        const absolute = new URL(hrefRaw, window.location.origin).href;
        link.setAttribute('data-preview-url', absolute);
        link.setAttribute('data-preview-name', link.textContent || hrefPath.split('/').pop() || 'file');
        link.setAttribute('href', absolute);
      } catch (_) {}
      return;
    }

    // Relative links inside shared markdown documents.
    if (sharedPath) {
      const resolvedSharedPath = _resolveSharedMarkdownPath(sharedPath, hrefPath);
      if (resolvedSharedPath) {
        const previewUrl = _sharedRawUrl(resolvedSharedPath);
        link.setAttribute('data-preview-url', previewUrl);
        link.setAttribute('data-preview-name', resolvedSharedPath.split('/').pop() || resolvedSharedPath);
        link.setAttribute('data-shared-path', resolvedSharedPath);
        link.setAttribute('href', previewUrl);
        return;
      }
    }

    // Relative links inside project markdown documents.
    if (rawUrl) {
      const projectTarget = _resolveProjectMarkdownRawUrl(rawUrl, hrefPath);
      if (projectTarget && projectTarget.url) {
        link.setAttribute('data-preview-url', projectTarget.url);
        link.setAttribute('data-preview-name', projectTarget.path.split('/').pop() || projectTarget.path);
        link.setAttribute('href', projectTarget.url);
      }
    }
  });

  return wrapper.innerHTML;
}

let _richMarkdownLinkHandlerBound = false;
function _bindRichMarkdownLinkHandler() {
  if (_richMarkdownLinkHandlerBound) return;
  _richMarkdownLinkHandlerBound = true;

  document.addEventListener('click', function (ev) {
    const target = ev.target;
    if (!target || !target.closest) return;
    const link = target.closest('.olivia-doc-rich-body a[href]');
    if (!link) return;

    const href = String(link.getAttribute('href') || '').trim();
    if (!href) return;

    if (href.startsWith('#')) {
      const anchorId = decodeURIComponent(href.slice(1) || '').trim();
      ev.preventDefault();
      ev.stopPropagation();
      if (!anchorId) return;
      const body = link.closest('.olivia-doc-rich-body') || document;
      let anchorEl = null;
      const anchorLower = anchorId.toLowerCase();
      try {
        if (window.CSS && typeof window.CSS.escape === 'function') {
          anchorEl = body.querySelector('#' + window.CSS.escape(anchorId));
        }
      } catch (_) {
        anchorEl = null;
      }
      if (!anchorEl) {
        anchorEl = body.querySelector(`[id="${anchorId.replace(/"/g, '&quot;')}"]`) || body.querySelector(`[name="${anchorId.replace(/"/g, '&quot;')}"]`);
      }
      if (!anchorEl) {
        const headingCandidates = Array.from(body.querySelectorAll('h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]'));
        anchorEl = headingCandidates.find(node => {
          const id = String(node.id || '').toLowerCase();
          return !!id && (id === anchorLower || id.startsWith(anchorLower));
        }) || null;
      }
      if (anchorEl && typeof anchorEl.scrollIntoView === 'function') {
        anchorEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      return;
    }

    const previewUrl = String(link.getAttribute('data-preview-url') || '').trim();
    if (previewUrl && typeof openPreviewUrl === 'function') {
      ev.preventDefault();
      ev.stopPropagation();
      const previewName = String(link.getAttribute('data-preview-name') || '').trim() || (previewUrl.split('/').pop() || 'file');
      const sharedPath = String(link.getAttribute('data-shared-path') || '').trim();
      const openOpts = { fileType: resolvePreviewFileType(previewName) };
      if (sharedPath) openOpts.sharedPath = sharedPath;
      openPreviewUrl(previewUrl, previewName, openOpts);
    }
  }, true);
}

function renderRichMarkdownHtml(markdown, options) {
  const opts = options && typeof options === 'object' ? options : {};
  const raw = String(markdown || '');
  const title = String(opts.title || '').trim();
  let rendered = (window.marked && typeof marked.parse === 'function')
    ? marked.parse(raw)
    : `<pre class="olivia-doc-pre">${escapeHtml(raw)}</pre>`;
  rendered = _rewriteRenderedMarkdownLinks(rendered, opts);
  _bindRichMarkdownLinkHandler();
  const head = title
    ? `<div class="olivia-doc-rich-head"><span class="olivia-doc-rich-label">${escapeHtml(title)}</span></div>`
    : '';
  return `<article class="olivia-doc-rich">${head}<div class="olivia-doc-rich-body answer-md">${rendered}</div></article>`;
}

function renderRichTextCardHtml(text, options) {
  const opts = options && typeof options === 'object' ? options : {};
  const title = String(opts.title || '').trim();
  const kind = String(opts.kind || '').trim().toLowerCase();
  const preClass = kind === 'json' ? 'olivia-doc-pre is-json' : 'olivia-doc-pre';
  let content = String(text || '');
  if (kind === 'json') {
    try {
      content = JSON.stringify(JSON.parse(content), null, 2);
    } catch (_) {
      // Keep original text when it is not valid JSON.
    }
  }
  const head = title
    ? `<div class="olivia-doc-rich-head"><span class="olivia-doc-rich-label">${escapeHtml(title)}</span></div>`
    : '';
  return `<article class="olivia-doc-rich">${head}<div class="olivia-doc-rich-body"><pre class="${preClass}">${escapeHtml(content)}</pre></div></article>`;
}

// Render the inner document of an API envelope ({path, filename, size, content})
// as the primary payload with a compact metadata header. When the inner content
// is JSON we pretty-print it; markdown is rendered via marked when available.
function _renderJsonEnvelopeHtml(envelope, fallbackTitle) {
  const env = envelope || {};
  const title = String(env.filename || fallbackTitle || env.path || '').trim();
  const sizeNum = Number(env.size);
  const sizeLabel = Number.isFinite(sizeNum) && sizeNum > 0 ? formatBytes(sizeNum) : '';
  const innerKind = String(env.innerKind || '').toLowerCase();
  const innerText = String(env.innerText || '');
  const ext = (title.split('.').pop() || '').toLowerCase();

  let bodyHtml;
  if (innerKind === 'json') {
    bodyHtml = `<pre class="olivia-doc-pre is-json">${escapeHtml(innerText)}</pre>`;
  } else if ((ext === 'md' || ext === 'markdown') && window.marked && typeof marked.parse === 'function') {
    bodyHtml = `<div class="answer-md">${marked.parse(innerText)}</div>`;
  } else {
    bodyHtml = `<pre class="olivia-doc-pre">${escapeHtml(innerText)}</pre>`;
  }

  const metaBits = [];
  if (env.path)     metaBits.push(`<span><strong>path</strong> ${escapeHtml(env.path)}</span>`);
  if (env.filename) metaBits.push(`<span><strong>file</strong> ${escapeHtml(env.filename)}</span>`);
  if (sizeLabel)    metaBits.push(`<span><strong>size</strong> ${escapeHtml(sizeLabel)}</span>`);

  return [
    '<article class="olivia-doc-rich">',
      '<div class="olivia-doc-rich-head">',
        `<span class="olivia-doc-rich-label">${escapeHtml(title)}</span>`,
        metaBits.length
          ? `<div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:4px;font-size:11px;color:var(--gray);font-family:var(--mono)">${metaBits.join('')}</div>`
          : '',
      '</div>',
      `<div class="olivia-doc-rich-body">${bodyHtml}</div>`,
    '</article>',
  ].join('');
}

async function renderDocxIntoElement(targetEl, arrayBuffer, options) {
  if (!targetEl) return;
  const opts = options && typeof options === 'object' ? options : {};
  const title = String(opts.title || '').trim();
  const companionPdfUrl = String(opts.companionPdfUrl || '').trim();
  const companionPdfName = String(opts.companionPdfName || '').trim() || 'PDF';
  const fallbackText = String(opts.fallbackText || '').trim();

  if (!window.mammoth) {
    if (fallbackText) {
      targetEl.innerHTML = `<div class="output-rich-scroll">${renderRichTextCardHtml(fallbackText, { title: title || 'DOCX', kind: 'text' })}</div>`;
    } else {
      targetEl.innerHTML = '<div style="padding:20px;color:var(--red);">Mammoth.js not found for DOCX rendering.</div>';
    }
    return;
  }

  const styleMap = [
    "p[style-name='Heading 1'] => h1.dh1:fresh",
    "p[style-name='Heading 2'] => h2.dh2:fresh",
    "p[style-name='Heading 3'] => h3.dh3:fresh",
    "p[style-name='Heading 4'] => h4.dh4:fresh",
    "p[style-name='heading 1'] => h1.dh1:fresh",
    "p[style-name='heading 2'] => h2.dh2:fresh",
    "p[style-name='Title']     => h1.doc-title:fresh",
    "p[style-name='Subtitle']  => p.doc-subtitle:fresh",
    // Juris-search documents frequently use custom Portuguese styles.
    "p[style-name='Ementa - Corpo'] => p.ementa-corpo:fresh",
    "p[style-name='Ementa-Corpo']   => p.ementa-corpo:fresh",
    "p[style-name='Dados Cadastrais'] => p.dados-cadastrais:fresh",
    "p[style-name='DadosCadastrais']  => p.dados-cadastrais:fresh",
    "p[style-name='Título Principal'] => h1.doc-title:fresh",
    "p[style-name='Titulo Principal'] => h1.doc-title:fresh",
    "p[style-name='TtuloPrincipal']   => h1.doc-title:fresh",
    "r[style-name='Strong']    => strong",
    "r[style-name='Emphasis']  => em",
  ];

  const imageConvert = window.mammoth.images.imgElement(image =>
    image.read('base64').then(b64 => ({ src: `data:${image.contentType};base64,${b64}` }))
  );

  const result = await window.mammoth.convertToHtml(
    { arrayBuffer },
    { styleMap, convertImage: imageConvert }
  );

  const docCSS = `
    .docx-viewer{background:#d4d4d4;padding:24px 12px 40px;overflow-y:auto;height:100%;box-sizing:border-box;}
    .docx-companion{max-width:860px;margin:0 auto 10px;padding:8px 12px;background:#eef6ff;border:1px solid #c7ddff;border-radius:4px;font-size:12px;color:#1f3f6d;font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:space-between;gap:8px;}
    .docx-companion a{color:#245ca6;text-decoration:none;font-weight:600;}
    .docx-companion a:hover{text-decoration:underline;}
    .docx-page{background:#fff;max-width:860px;margin:0 auto;padding:72px 80px 80px;box-shadow:0 6px 32px rgba(0,0,0,.28);border-radius:2px;min-height:1100px;color:#1a1a1a;font-family:Arial,Helvetica,sans-serif;font-size:11pt;line-height:1.6;word-break:break-word;}
    .docx-page h1,.docx-page .dh1,.docx-page .doc-title{font-size:20pt;font-weight:700;color:#1B2A4A;font-family:Arial,sans-serif;margin:28pt 0 12pt;padding-bottom:5pt;border-bottom:2.5px solid #C8102E;page-break-after:avoid;line-height:1.2;}
    .docx-page h2,.docx-page .dh2{font-size:15pt;font-weight:700;color:#2E4A7A;font-family:Arial,sans-serif;margin:20pt 0 8pt;page-break-after:avoid;}
    .docx-page h3,.docx-page .dh3{font-size:13pt;font-weight:700;color:#1B2A4A;font-family:Arial,sans-serif;margin:14pt 0 6pt;}
    .docx-page h4,.docx-page .dh4{font-size:11pt;font-weight:700;color:#2E4A7A;margin:10pt 0 4pt;}
    .docx-page .doc-subtitle{font-size:12pt;color:#666;margin-bottom:24pt;text-align:center;}
    .docx-page p{margin:0 0 8pt;font-size:11pt;color:#1A1A1A;orphans:2;widows:2;}
    .docx-page table{width:100%;border-collapse:collapse;margin:12pt 0 16pt;font-size:10pt;}
    .docx-page table tr:first-child td,.docx-page table tr:first-child th,.docx-page thead td,.docx-page thead th{background:#1B2A4A!important;color:#fff!important;font-weight:700;padding:6pt 8pt;border:1px solid #8A9BB5;font-family:Arial,sans-serif;}
    .docx-page table td,.docx-page table th{padding:5pt 8pt;border:1px solid #B0BEC5;vertical-align:top;line-height:1.4;}
    .docx-page table tbody tr:nth-child(even) td{background:#F0F4F8;}
    .docx-page table tbody tr:nth-child(odd) td{background:#fff;}
    .docx-page strong,.docx-page b{font-weight:700;}.docx-page em,.docx-page i{font-style:italic;}.docx-page u{text-decoration:underline;}.docx-page a{color:#2E4A7A;text-decoration:underline;}
    .docx-page ul,.docx-page ol{margin:4pt 0 10pt 22pt;padding:0;}.docx-page li{margin-bottom:3pt;}
    .docx-page img{max-width:100%;height:auto;display:block;margin:10pt auto;}
    .docx-page hr{border:none;border-top:2px solid #1B2A4A;margin:20pt 0;}
    .docx-warnings{max-width:860px;margin:0 auto 10px;padding:8px 12px;background:#fff8e1;border:1px solid #ffe082;border-radius:4px;font-size:11px;color:#795548;font-family:Arial,sans-serif;}
  `;

  const companionHtml = companionPdfUrl
    ? `<div class="docx-companion"><span>PDF companion detected</span><a href="${escapeHtmlAttr(companionPdfUrl)}" target="_blank" rel="noopener">Open ${escapeHtml(companionPdfName)}</a></div>`
    : '';

  const actionableMessages = Array.isArray(result.messages)
    ? result.messages
      .map(m => String((m && m.message) || '').trim())
      .filter(Boolean)
      .filter(msg => !/^Unrecognised paragraph style:/i.test(msg))
      .filter(msg => !/^Did not understand this style mapping/i.test(msg))
    : [];

  const warningsHtml = actionableMessages.length
    ? `<div class="docx-warnings"><strong>Conversion notes:</strong> ${actionableMessages.slice(0, 3).map(message => escapeHtml(message)).join(' | ')}</div>`
    : '';

  targetEl.innerHTML = `<div class="docx-viewer"><style>${docCSS}</style>${companionHtml}${warningsHtml}<div class="docx-page">${result.value}</div></div>`;
}

// ─── General-purpose preview panel renderer ───
// Called by openDocFile (skills tree), and directly for workspace artifacts / imported files.
async function openPreviewUrl(url, name, options) {
  const previewOptions = options && typeof options === 'object' ? options : {};
  const displayName = previewOptions.displayName || name;
  const previewType = resolvePreviewFileType(name, previewOptions);
  // Track current preview state for download / maximize
  window._previewState = { url, name: displayName || name };

  window.togglePreviewPanel(true);

  const body = document.getElementById('previewBody');
  if (!body) return;

  // Update panel title with appropriate icon
  const panelTitle = document.getElementById('previewPanelTitle');
  if (panelTitle) {
    const ext = (name.split('.').pop() || '').toLowerCase();
    const iconMap = { docx:'fa-file-word', doc:'fa-file-word', pdf:'fa-file-pdf', html:'fa-file-code',
                      htm:'fa-file-code', md:'fa-file-lines', json:'fa-file-code', txt:'fa-file-lines',
                      png:'fa-file-image', jpg:'fa-file-image', jpeg:'fa-file-image', svg:'fa-file-image',
                      image:'fa-file-image', audio:'fa-file-audio', markdown:'fa-file-lines', text:'fa-file-lines' };
    const iconCls = iconMap[previewType] || iconMap[ext] || 'fa-file';
    panelTitle.innerHTML = `<i class="fas ${iconCls}" style="margin-right:6px;font-size:12px;color:var(--blue)"></i> ${escapeHtml(displayName || name)}`;
  }

  // Show download dropdown + maximize buttons now that we have a file
  const dlDropdown = document.getElementById('previewDownloadDropdown');
  const maxBtn = document.getElementById('previewMaximizeBtn');
  if (dlDropdown) {
    dlDropdown.style.display = '';
    // Update dropdown button behavior based on file type
    const dlBtn = document.getElementById('previewDownloadBtn');
    if (dlBtn) {
      if (previewType === 'markdown' || previewType === 'md') {
        // Markdown files: show dropdown with PDF option
        dlBtn.onclick = (e) => {
          e.stopPropagation();
          toggleDownloadDropdown();
        };
      } else {
        // Other files: direct download
        dlBtn.onclick = () => downloadCurrentPreview();
      }
    }
  }
  if (maxBtn) maxBtn.style.display = '';

  body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:80px"><div class="loading" style="width:24px;height:24px;border-width:3px;border-color:var(--amber) var(--amber) transparent transparent;"></div></div>';

  const ext = (name.split('.').pop() || '').toLowerCase();

  try {
    if (previewType === 'pdf') {
      body.innerHTML = `<iframe src="${url}" style="width:100%;height:100%;border:none;background:#fff;" title="${escapeHtmlAttr(name)}"></iframe>`;
    } else if (previewType === 'html' || previewType === 'htm') {
      const res = await fetch(url);
      const text = _docPrepareStaticHtmlPreview(await res.text(), url);
      body.innerHTML = `<iframe srcdoc="${escapeHtmlAttr(text)}" sandbox="allow-same-origin allow-forms allow-popups" style="width:100%;height:100%;border:none;background:#fff;" title="${escapeHtmlAttr(name)}"></iframe>`;
    } else if (previewType === 'markdown' || previewType === 'md') {
      const res = await fetch(url);
      const text = await res.text();
      body.innerHTML = `<div class="output-rich-scroll">${renderRichMarkdownHtml(text, {
        title: displayName || name,
        sharedPath: previewOptions.sharedPath || _sharedPathFromRawValue(url),
        rawUrl: url,
      })}</div>`;
    } else if (previewType === 'json') {
      const res = await fetch(url);
      let text = await res.text();
      let envelope = null;
      try {
        const parsed = JSON.parse(text);
        // Many API endpoints (e.g. /api/violations/file, /api/law-library/file)
        // wrap the real document in a small envelope:
        //   { status, path, filename, size, content: "<actual JSON or text>" }
        // Detect that envelope and render the inner content as the primary
        // payload, with the envelope shown as a small header.
        if (parsed && typeof parsed === 'object'
            && Object.prototype.hasOwnProperty.call(parsed, 'content')
            && typeof parsed.content === 'string'
            && (parsed.path || parsed.filename || parsed.size != null)) {
          let innerText = parsed.content;
          let innerKind = 'text';
          try {
            innerText = JSON.stringify(JSON.parse(parsed.content), null, 2);
            innerKind = 'json';
          } catch (_) { /* keep raw inner content */ }
          envelope = {
            path: String(parsed.path || ''),
            filename: String(parsed.filename || ''),
            size: parsed.size,
            innerText,
            innerKind,
          };
          text = innerText;
        } else {
          text = JSON.stringify(parsed, null, 2);
        }
      } catch (_) {
        // Keep raw payload when JSON parsing fails.
      }
      if (envelope) {
        body.innerHTML = `<div class="output-rich-scroll">${_renderJsonEnvelopeHtml(envelope, displayName || name)}</div>`;
      } else {
        body.innerHTML = `<div class="output-rich-scroll">${renderRichTextCardHtml(text, { title: displayName || name, kind: 'json' })}</div>`;
      }
    } else if (previewType === 'docx' || previewType === 'doc') {
      const res = await fetch(url);
      const buffer = await res.arrayBuffer();
      const sharedPath = String(previewOptions.sharedPath || _sharedPathFromRawValue(url) || '').trim();
      const companion = sharedPath ? await resolveSharedDocCompanion(sharedPath) : null;
      await renderDocxIntoElement(body, buffer, {
        title: displayName || name,
        companionPdfUrl: String(previewOptions.companionPdfUrl || (companion && companion.url) || ''),
        companionPdfName: String(previewOptions.companionPdfName || (companion && companion.name) || ''),
      });
    } else if (previewType === 'audio') {
      const mimeLabel = escapeHtml(resolvePreviewMimeLabel(name, previewOptions));
      const sizeLabel = String(previewOptions.sizeLabel || '').trim() || formatBytes(previewOptions.size);
      body.innerHTML = `
        <div style="padding:18px;display:flex;flex-direction:column;gap:14px;height:100%;box-sizing:border-box;justify-content:center;">
          <div>
            <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:4px;word-break:break-word;">${escapeHtml(displayName || name)}</div>
            <div style="font-size:11px;color:var(--gray-hi);display:flex;gap:12px;flex-wrap:wrap;">
              <span><strong style="color:var(--text)">Tipo:</strong> ${mimeLabel}</span>
              <span><strong style="color:var(--text)">Tamanho:</strong> ${sizeLabel}</span>
              <span><strong style="color:var(--text)">Posição:</strong> <span data-preview-audio-current>0:00</span></span>
              <span><strong style="color:var(--text)">Duração:</strong> <span data-preview-audio-duration>carregando…</span></span>
            </div>
          </div>
          <div style="padding:16px;border:1px solid var(--border);border-radius:12px;background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.02));box-shadow:inset 0 1px 0 rgba(255,255,255,.05)">
            <canvas data-preview-audio-waveform style="width:100%;height:140px;display:block;border-radius:8px;background:rgba(17,17,17,.36);"></canvas>
            <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:12px;flex-wrap:wrap;">
              <button type="button" data-preview-audio-toggle class="btn btn-sm" style="border-color:var(--amber);color:var(--amber);min-width:120px"><i class="fas fa-play"></i> Ouvir</button>
              <span data-preview-audio-status style="font-size:11px;color:var(--gray);flex:1;text-align:right;min-width:160px;">Carregando preview…</span>
            </div>
          </div>
          <div style="padding:14px;border:1px solid var(--border);border-radius:10px;background:rgba(255,255,255,.03)">
            <audio data-preview-audio controls preload="metadata" src="${escapeHtmlAttr(url)}" style="width:100%"></audio>
          </div>
          <div style="font-size:11px;color:var(--gray);line-height:1.5;">Waveform gerada no navegador a partir do áudio real, com reprodução e acompanhamento de progresso.</div>
        </div>`;
      attachAudioPreviewMeta(body, url);
    } else if (previewType === 'image' || ['png','jpg','jpeg','gif','svg','webp'].includes(ext)) {
      body.innerHTML = `<div style="padding:16px;overflow-y:auto;height:100%;box-sizing:border-box;display:flex;align-items:center;justify-content:center;"><img src="${escapeHtml(url)}" style="max-width:100%;max-height:90%;object-fit:contain;border-radius:4px;"></div>`;
    } else {
      const res = await fetch(url);
      const text = await res.text();
      body.innerHTML = `<div class="output-rich-scroll">${renderRichTextCardHtml(text, { title: displayName || name, kind: previewType || ext })}</div>`;
    }
  } catch (e) {
    body.innerHTML = `<div style="padding:20px;color:var(--red);">Error loading file: ${e.message}</div>`;
  }
}

async function openDocFile(relPath, name, projectId) {
  const pid = (projectId || _activeProjectId() || '').trim();
  if (!pid) {
    addSystemBubble('Selecione um projeto ativo para abrir documentos.');
    return;
  }
  const url = `${API_BASE}/api/projects/${encodeURIComponent(pid)}/raw?path=${encodeURIComponent(relPath)}`;
  const fileType = resolvePreviewFileType(name || relPath);
  const artifactId = `project:${pid}:${relPath}`;

  if (typeof addOutputArtifact === 'function') {
    addOutputArtifact({
      id: artifactId,
      title: name || relPath,
      type: fileType,
      url,
      source: 'project-doc',
      project_id: pid,
      path: relPath,
    });
  }

  // Keep preview behavior so parsing/rendering works immediately by file type.
  return openPreviewUrl(url, name || relPath, { fileType });
}

// ─── Expose to window ───
window.openPreviewUrl = openPreviewUrl;
window.openDocFile    = openDocFile;
window.resolvePreviewFileType = resolvePreviewFileType;
window.renderRichMarkdownHtml = renderRichMarkdownHtml;
window.renderRichTextCardHtml = renderRichTextCardHtml;
window.renderDocxIntoElement = renderDocxIntoElement;
window.resolveSharedDocCompanion = resolveSharedDocCompanion;
window.docsOpenFilePreview = docsOpenFilePreview;
window.docsOpenFileOutput = docsOpenFileOutput;
window.docsOpenFileBrowser = docsOpenFileBrowser;

// ─── dead-code placeholder kept for compatibility ───
async function _openDocFileOldBody(url, name, ext, body) {
  // (kept as reference only — logic now lives in openPreviewUrl)
  try {
    if (ext === 'pdf') {
      body.innerHTML = `<iframe src="${url}" style="width:100%;height:100%;border:none;background:#fff;" title="${escapeHtmlAttr(name)}"></iframe>`;
    } else if (ext === 'html') {
      const res = await fetch(url);
      const text = _docPrepareStaticHtmlPreview(await res.text(), url);
      body.innerHTML = `<iframe srcdoc="${escapeHtmlAttr(text)}" sandbox="allow-same-origin allow-forms allow-popups" style="width:100%;height:100%;border:none;background:#fff;" title="${escapeHtmlAttr(name)}"></iframe>`;
    } else if (ext === 'md') {
      const res = await fetch(url);
      const text = await res.text();
      body.innerHTML = `<div class="output-rich-scroll">${renderRichMarkdownHtml(text, { title: name })}</div>`;
    } else if (ext === 'docx') {
      const res = await fetch(url);
      const buffer = await res.arrayBuffer();
      if (window.mammoth) {
        // ── Style map: preserve heading levels and key paragraph styles ──
        const styleMap = [
          "p[style-name='Heading 1'] => h1.dh1:fresh",
          "p[style-name='Heading 2'] => h2.dh2:fresh",
          "p[style-name='Heading 3'] => h3.dh3:fresh",
          "p[style-name='Heading 4'] => h4.dh4:fresh",
          "p[style-name='heading 1'] => h1.dh1:fresh",
          "p[style-name='heading 2'] => h2.dh2:fresh",
          "p[style-name='Title']     => h1.doc-title:fresh",
          "p[style-name='Subtitle']  => p.doc-subtitle:fresh",
          "r[style-name='Strong']    => strong",
          "r[style-name='Emphasis']  => em",
        ];

        // ── Convert images to inline base64 so they display without a server round-trip ──
        const imageConvert = mammoth.images.imgElement(image =>
          image.read('base64').then(b64 => ({ src: `data:${image.contentType};base64,${b64}` }))
        );

        const result = await window.mammoth.convertToHtml(
          { arrayBuffer: buffer },
          { styleMap, convertImage: imageConvert }
        );

        // ── Document-faithful CSS ──
        const docCSS = `
          .docx-viewer {
            background: #d4d4d4;
            padding: 24px 12px 40px;
            overflow-y: auto;
            height: 100%;
            box-sizing: border-box;
          }
          .docx-page {
            background: #ffffff;
            max-width: 860px;
            margin: 0 auto;
            padding: 72px 80px 80px;
            box-shadow: 0 6px 32px rgba(0,0,0,0.28);
            border-radius: 2px;
            min-height: 1100px;
            color: #1a1a1a;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 11pt;
            line-height: 1.6;
            word-break: break-word;
          }
          /* ── Headings ── */
          .docx-page h1, .docx-page .dh1, .docx-page .doc-title {
            font-size: 20pt;
            font-weight: 700;
            color: #1B2A4A;
            font-family: Arial, sans-serif;
            margin: 28pt 0 12pt;
            padding-bottom: 5pt;
            border-bottom: 2.5px solid #C8102E;
            page-break-after: avoid;
            line-height: 1.2;
          }
          .docx-page h2, .docx-page .dh2 {
            font-size: 15pt;
            font-weight: 700;
            color: #2E4A7A;
            font-family: Arial, sans-serif;
            margin: 20pt 0 8pt;
            page-break-after: avoid;
          }
          .docx-page h3, .docx-page .dh3 {
            font-size: 13pt;
            font-weight: 700;
            color: #1B2A4A;
            font-family: Arial, sans-serif;
            margin: 14pt 0 6pt;
          }
          .docx-page h4, .docx-page .dh4 {
            font-size: 11pt;
            font-weight: 700;
            color: #2E4A7A;
            margin: 10pt 0 4pt;
          }
          .docx-page .doc-subtitle {
            font-size: 12pt;
            color: #666666;
            margin-bottom: 24pt;
            text-align: center;
          }
          /* ── Paragraphs ── */
          .docx-page p {
            margin: 0 0 8pt;
            font-size: 11pt;
            color: #1A1A1A;
            orphans: 2; widows: 2;
          }
          /* ── Tables ── */
          .docx-page table {
            width: 100%;
            border-collapse: collapse;
            margin: 12pt 0 16pt;
            font-size: 10pt;
          }
          /* First-row header heuristic: dark navy header */
          .docx-page table tr:first-child td,
          .docx-page table tr:first-child th,
          .docx-page thead td,
          .docx-page thead th {
            background: #1B2A4A !important;
            color: #ffffff !important;
            font-weight: 700;
            padding: 6pt 8pt;
            border: 1px solid #8A9BB5;
            font-family: Arial, sans-serif;
          }
          .docx-page table td,
          .docx-page table th {
            padding: 5pt 8pt;
            border: 1px solid #B0BEC5;
            vertical-align: top;
            line-height: 1.4;
          }
          .docx-page table tbody tr:nth-child(even) td {
            background: #F0F4F8;
          }
          .docx-page table tbody tr:nth-child(odd) td {
            background: #ffffff;
          }
          /* ── Inline / typography ── */
          .docx-page strong, .docx-page b { font-weight: 700; }
          .docx-page em, .docx-page i     { font-style: italic; }
          .docx-page u                    { text-decoration: underline; }
          .docx-page a                    { color: #2E4A7A; text-decoration: underline; }
          /* ── Lists ── */
          .docx-page ul, .docx-page ol {
            margin: 4pt 0 10pt 22pt;
            padding: 0;
          }
          .docx-page li { margin-bottom: 3pt; }
          /* ── Images ── */
          .docx-page img {
            max-width: 100%;
            height: auto;
            display: block;
            margin: 10pt auto;
          }
          /* ── Horizontal rules (section dividers) ── */
          .docx-page hr {
            border: none;
            border-top: 2px solid #1B2A4A;
            margin: 20pt 0;
          }
          /* ── Block-level text alignment helpers mammoth emits ── */
          .docx-page p[style*="text-align:center"],
          .docx-page .docx-center        { text-align: center; }
          .docx-page p[style*="text-align:right"]  { text-align: right; }
          /* ── Warn block for conversion messages ── */
          .docx-warnings {
            max-width: 860px;
            margin: 0 auto 10px;
            padding: 8px 12px;
            background: #fff8e1;
            border: 1px solid #ffe082;
            border-radius: 4px;
            font-size: 11px;
            color: #795548;
            font-family: Arial, sans-serif;
          }
        `;

        const warningsHtml = result.messages && result.messages.length
          ? `<div class="docx-warnings"><strong>⚠ Conversion notes:</strong> ${result.messages.slice(0,3).map(m => escapeHtml(m.message)).join(' · ')}</div>`
          : '';

        body.innerHTML = `
          <div class="docx-viewer">
            <style>${docCSS}</style>
            ${warningsHtml}
            <div class="docx-page">${result.value}</div>
          </div>`;
      } else {
        body.innerHTML = `<div style="padding:20px;color:var(--red);">Mammoth.js not found for DOCX rendering.</div>`;
      }
    } else {
      const res = await fetch(url);
      const text = await res.text();
      body.innerHTML = `<div class="output-rich-scroll">${renderRichTextCardHtml(text, { title: name, kind: ext })}</div>`;
    }
  } catch (e) {
    body.innerHTML = `<div style="padding:20px;color:var(--red);">Error loading file: ${e.message}</div>`;
  }
}
// ─── end _openDocFileOldBody (reference only) ───

// Toggle document context
function toggleDocContext(checkbox) {
  const path = checkbox.dataset.path;
  const projectId = checkbox.dataset.projectId || _activeProjectId();
  const key = _docContextKey(projectId, path);

  if (checkbox.checked) {
    _checkedDocs.add(key);
  } else {
    _checkedDocs.delete(key);
  }

  updateDocsContextBar();
  if(typeof updateChatContextBar!=="undefined") updateChatContextBar();
  checkbox.closest('.docs-tree-item').classList.toggle('checked', checkbox.checked);
}

// Uncheck a document by path (for modal remove button)
function uncheckDoc(path) {
  const projectId = _activeProjectId();
  const key = _docContextKey(projectId, path);
  _checkedDocs.delete(key);
  updateDocsContextBar();
  if(typeof updateChatContextBar!=="undefined") updateChatContextBar();
  if (typeof updateComposeContextBar === 'function') updateComposeContextBar();
  // Update checkbox UI if visible
  const checkbox = document.querySelector(`.docs-tree-item input[data-path="${CSS.escape(path)}"]`);
  if (checkbox) {
    checkbox.checked = false;
    checkbox.closest('.docs-tree-item').classList.remove('checked');
  }
  addSystemBubble('Documento removido do contexto: ' + path);
}
window.uncheckDoc = uncheckDoc;

// Toggle article context
function toggleArticleContext(checkbox) {
  const path = checkbox.dataset.path;
  const article = checkbox.dataset.article;
  const key = path + '#' + article;
  
  if (checkbox.checked) {
    _checkedArticles.add(key);
  } else {
    _checkedArticles.delete(key);
  }
  
  checkbox.closest('.law-article-item').classList.toggle('checked', checkbox.checked);
  updateDocsContextBar();
  if(typeof updateChatContextBar!=="undefined") updateChatContextBar();
}

// Add article to context
function addArticleToContext(path, articleNumber) {
  const key = path + '#' + articleNumber;
  _checkedArticles.add(key);
  updateDocsContextBar();
  if(typeof updateChatContextBar!=="undefined") updateChatContextBar();
}

// Get checked documents context
async function getCheckedDocsContext() {
  if (_checkedDocs.size === 0 && _checkedArticles.size === 0) return '';
  
  let context = '\n\n--- DOCUMENT CONTEXT ---\n';
  
  // Get full documents
  for (const key of _checkedDocs) {
    const parts = _docContextKeyParts(key);
    const path = parts.relPath;
    const projectId = parts.projectId;
    if (!projectId || !path) continue;
    try {
      const res = await fetch(`${API_BASE}/api/projects/${encodeURIComponent(projectId)}/content?path=${encodeURIComponent(path)}`);
      if (res.ok) {
        const data = await res.json();
        const text = data.content || '';
        const name = path.split('/').pop();
        context += `\n[${name} | projeto:${projectId}]:\n${text}\n`;
      }
    } catch(e) {
      console.warn('Failed to fetch project doc:', key, e);
    }
  }
  
  // Get articles
  for (const key of _checkedArticles) {
    const [path, article] = key.split('#');
    try {
      const basePath = API.replace(/\/$/, '');
      // /api/shared/article does not exist — fetch full file and filter
      const res = await fetch(`${basePath}/shared/file?path=${encodeURIComponent(path)}`);
      if (res.ok) {
        const text = await res.text();
        try {
          const arr = JSON.parse(text);
          const articles = Array.isArray(arr) ? arr : (arr.articles || []);
          const articleData = articles.find(a => String(a.article_number) === String(article));
          if (articleData) context += `\n[${path.split('/').pop()} - Artigo ${article}]:\n${articleData.text || ''}\n`;
        } catch(e) {
          console.warn('Invalid article JSON:', key);
        }
      }
    } catch(e) {
      console.warn('Failed to fetch article:', key, e);
    }
  }
  
  return context;
}

// Update documents context bar
function updateDocsContextBar() {
  const total = _checkedDocs.size + _checkedArticles.size;
  const num = document.getElementById('docsContextNum');
  const bar = document.getElementById('docsContextBar');
  if (num) num.textContent = String(total);
  if (bar) bar.classList.toggle('empty', total === 0);
}

// Clear all document context
function clearAllDocContext() {
  _checkedDocs.clear();
  _checkedArticles.clear();
  
  // Uncheck all checkboxes
  document.querySelectorAll('.doc-check').forEach(cb => cb.checked = false);
  document.querySelectorAll('.article-check').forEach(cb => cb.checked = false);
  
  // Remove checked classes
  document.querySelectorAll('.docs-tree-item.checked').forEach(el => el.classList.remove('checked'));
  document.querySelectorAll('.law-article-item.checked').forEach(el => el.classList.remove('checked'));
  
  updateDocsContextBar();
  if(typeof updateChatContextBar!=="undefined") updateChatContextBar();
}

// Load shared data tree
async function loadSharedDataTree() {
  const el = document.getElementById('sharedDataTree');
  if (!el) return;

  _sharedLawArticleCache = {};
  _sharedLawFileMetaCache = {};
  _sharedLawSelection = { filePath: '', articleNumber: '', article: null };
  _setSharedLawActionStatus('');
  _updateSharedLawActionButtons();
  closeSharedLawCompare();

  try {
    const hasAgent = typeof selectedAgent !== 'undefined' && selectedAgent && selectedAgent.agent_id;
    const scopeUrl = hasAgent
      ? `${API_BASE}/api/shared/scopes?agent_id=${encodeURIComponent(selectedAgent.agent_id)}`
      : `${API_BASE}/api/shared/scopes`;
    const res = await fetch(scopeUrl);
    const data = await res.json().catch(() => ({}));
    const scopes = Array.isArray(data) ? data : (data.scopes || []);

    if (!scopes.length) {
      el.innerHTML = '<p style="color:var(--gray);font-size:12px;text-align:center;padding:20px 0">Nenhum escopo em _shared atribuido para este agente.</p>';
      if (typeof updateSharedContextBar === 'function') updateSharedContextBar();
      return;
    }

    const nodes = scopes.map(scope => {
      const scopeName = String(scope.name || '').trim();
      const safeId = scopeName.replace(/[^a-zA-Z0-9]/g, '_');
      return `
        <div class="docs-tree-item dir" onclick="toggleSharedDir('${_sharedJsQuote(scopeName)}','${safeId}',this)">
          <i class="fas fa-folder"></i>
          <span class="docs-name">${escapeHtml(scopeName)}${scope.file_count ? ` (${scope.file_count})` : ''}</span>
        </div>
        <div class="docs-tree-children" style="display:none" id="shared-tree-${safeId}" data-path="${escapeHtmlAttr(scopeName)}" data-loaded="false"></div>
      `;
    }).join('');

    el.innerHTML = nodes;
    _bindDocsPinnedPathUiSync();
    _refreshDocsPinButtons();
    if (typeof updateSharedContextBar === 'function') updateSharedContextBar();
  } catch(e) {
    el.innerHTML = `<p style="color:var(--red);font-size:12px;text-align:center;padding:20px">Falha ao carregar _shared: ${escapeHtml(e.message || 'erro desconhecido')}</p>`;
  }
}

function _sharedJsQuote(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function _sharedFileIcon(filename) {
  const ext = String(filename || '').split('.').pop().toLowerCase();
  const iconMap = {
    md: 'fa-file-lines',
    txt: 'fa-file-lines',
    pdf: 'fa-file-pdf',
    doc: 'fa-file-word',
    docx: 'fa-file-word',
    json: 'fa-file-code',
    yml: 'fa-file-code',
    yaml: 'fa-file-code',
    py: 'fa-file-code',
    js: 'fa-file-code',
    ts: 'fa-file-code',
    csv: 'fa-file-csv',
    html: 'fa-file-code',
    htm: 'fa-file-code'
  };
  return iconMap[ext] || 'fa-file';
}

function _isSharedLawJson(path, name) {
  const full = String(path || '').toLowerCase();
  const filename = String(name || '').toLowerCase();
  return full.startsWith('law/') && filename.endsWith('.json');
}

function _normalizeSharedLawArticles(payload) {
  const list = Array.isArray(payload) ? payload : (Array.isArray(payload.articles) ? payload.articles : []);
  return list.map((item, idx) => {
    const articleNumber = String(item.article_number || item.number || item.id || (idx + 1)).trim();
    const text = String(item.text || item.content || item.body || item.description || '').trim();
    const citation = String(item.citation || item.reference || item.source || '').trim();
    const rolesDuty = Array.isArray(item.duty_bearer_roles) ? item.duty_bearer_roles : [];
    const rolesRight = Array.isArray(item.right_holder_roles) ? item.right_holder_roles : [];
    const sanctions = Array.isArray(item.sanctions) ? item.sanctions : [];
    return {
      article_number: articleNumber,
      text,
      citation,
      reference: String(item.reference || citation || '').trim(),
      framework_code: String(item.framework_code || item.canonical_framework_code || '').trim(),
      framework_name: String(item.framework_name || '').trim(),
      jurisdiction: String(item.jurisdiction || '').trim(),
      hierarchy_label: String(item.hierarchy_label || '').trim(),
      norm_type: String(item.norm_type || '').trim().toLowerCase(),
      norm_direction: String(item.norm_direction || '').trim().toLowerCase(),
      norm_scope: String(item.norm_scope || '').trim().toLowerCase(),
      theme: String(item.theme || '').trim(),
      regulated_subject: String(item.regulated_subject || '').trim(),
      duty_bearer_roles: rolesDuty,
      right_holder_roles: rolesRight,
      sanctions,
      eli_id: String(item.eli_id || item.article_id || '').trim()
    };
  }).filter(item => item.article_number || item.text);
}

function _sharedLawTagClass(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9_-]/g, '-');
}

function _sharedLawPrettyLabel(value) {
  return String(value || '').replace(/_/g, ' ').trim();
}

function _setSharedLawActionStatus(message, tone) {
  const status = document.getElementById('sharedLawActionStatus');
  if (!status) return;
  status.textContent = String(message || '');
  status.className = 'shared-law-action-status';
  if (message && tone) status.classList.add(`is-${tone}`);
}

function _setSharedLawSelection(filePath, article) {
  _sharedLawSelection = {
    filePath: String(filePath || '').trim(),
    articleNumber: article ? String(article.article_number || '').trim() : '',
    article: article || null,
  };
  _updateSharedLawActionButtons();
}

function _updateSharedLawActionButtons() {
  const syncBtn = document.getElementById('sharedLawSyncBtn');
  const compareBtn = document.getElementById('sharedLawCompareBtn');
  const hasFile = !!String(_sharedLawSelection.filePath || '').trim();
  const hasArticle = !!(_sharedLawSelection.article && _sharedLawSelection.articleNumber);
  if (syncBtn) syncBtn.disabled = !hasFile;
  if (compareBtn) compareBtn.disabled = !hasArticle;
}

function _bindSharedLawCompareEsc() {
  if (_sharedLawCompareEscBound) return;
  _sharedLawCompareEscBound = true;
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const modal = document.getElementById('sharedLawCompareModal');
    if (modal && modal.classList.contains('show')) closeSharedLawCompare();
  });
}

function closeSharedLawCompare() {
  const overlay = document.getElementById('sharedLawCompareOverlay');
  const modal = document.getElementById('sharedLawCompareModal');
  if (overlay) overlay.classList.remove('show');
  if (modal) modal.classList.remove('show');
}

function _downloadTextBlob(filename, content, mimeType) {
  const blob = new Blob([String(content || '')], { type: mimeType || 'text/plain' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename || 'download.txt';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

function downloadSharedLawCompare(kind) {
  const ctx = _sharedLawCompareContext || {};
  if (!ctx.articleNumber || !ctx.filename) return;
  if (String(kind || '').toLowerCase() === 'html') {
    const doc = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(ctx.filename)} - Artigo ${escapeHtml(ctx.articleNumber)}</title></head><body>${ctx.html || ''}</body></html>`;
    _downloadTextBlob(`${ctx.filename}-artigo-${ctx.articleNumber}.html`, doc, 'text/html;charset=utf-8');
    return;
  }
  _downloadTextBlob(`${ctx.filename}-artigo-${ctx.articleNumber}.md`, ctx.markdown || '', 'text/markdown;charset=utf-8');
}

function maximizeSharedLawCompare(kind) {
  const mode = String(kind || '').toLowerCase();
  const ctx = _sharedLawCompareContext || {};
  if (mode === 'output') {
    if (ctx.artifactId && typeof showOutputArtifact === 'function') {
      showOutputArtifact(ctx.artifactId);
    }
    return;
  }

  if (!ctx.markdown || !ctx.filename) return;
  const blob = new Blob([ctx.markdown], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  if (typeof openPreviewUrl === 'function') {
    openPreviewUrl(url, `${ctx.filename}-artigo-${ctx.articleNumber}.md`);
  }
  if (typeof maximizeCurrentPreview === 'function') {
    maximizeCurrentPreview();
  }
}

function openSharedLawCompare(filePath, articleNumber) {
  const selectedPath = String(filePath || _sharedLawSelection.filePath || '').trim();
  if (!selectedPath) {
    _setSharedLawActionStatus('Selecione um arquivo de lei para sincronizar/comparar.', 'error');
    return;
  }

  const list = _sharedLawArticleCache[selectedPath] || [];
  let article = null;
  if (articleNumber) {
    article = list.find(item => String(item.article_number) === String(articleNumber));
  }
  if (!article && _sharedLawSelection.article && _sharedLawSelection.filePath === selectedPath) {
    article = _sharedLawSelection.article;
  }
  if (!article && list.length) article = list[0];

  if (!article) {
    _setSharedLawActionStatus('Abra os artigos do arquivo e selecione um artigo para comparar.', 'error');
    return;
  }

  const filename = selectedPath.split('/').pop() || selectedPath;
  const markdown = _renderSharedLawArticleMarkdown(article, filename);
  const htmlCard = _renderSharedLawArticleCardHtml(article, filename);
  const artifactId = _openSharedLawArticleInOutput(article, selectedPath, filename);
  const previewEl = document.getElementById('sharedLawComparePreview');
  const outputEl = document.getElementById('sharedLawCompareOutput');
  const titleEl = document.getElementById('sharedLawCompareTitle');
  const overlay = document.getElementById('sharedLawCompareOverlay');
  const modal = document.getElementById('sharedLawCompareModal');

  if (!previewEl || !outputEl || !overlay || !modal) return;

  const renderedPreview = window.marked
    ? _rewriteRenderedMarkdownLinks(marked.parse(markdown), {
        sharedPath: selectedPath,
        rawUrl: _sharedRawUrl(selectedPath),
      })
    : `<pre style="margin:0;white-space:pre-wrap;word-break:break-word;font-size:12px;font-family:var(--mono)">${escapeHtml(markdown)}</pre>`;

  previewEl.innerHTML = renderedPreview;
  outputEl.innerHTML = htmlCard;
  if (titleEl) titleEl.textContent = `${filename} - Artigo ${article.article_number}`;

  _sharedLawCompareContext = {
    filePath: selectedPath,
    articleNumber: String(article.article_number || ''),
    filename,
    markdown,
    html: htmlCard,
    artifactId: artifactId || '',
  };

  _setSharedLawSelection(selectedPath, article);
  _setSharedLawActionStatus('');
  _bindSharedLawCompareEsc();
  overlay.classList.add('show');
  modal.classList.add('show');
}

async function syncSharedLawSelection() {
  const selectedPath = String(_sharedLawSelection.filePath || '').trim();
  if (!selectedPath) {
    _setSharedLawActionStatus('Selecione um arquivo de lei para sincronizar.', 'error');
    return;
  }

  const btn = document.getElementById('sharedLawSyncBtn');
  const originalHtml = btn ? btn.innerHTML : '';
  const fileMeta = _sharedLawFileMetaCache[selectedPath] || {};
  const article = _sharedLawSelection.article || {};
  const frameworkCode = String(fileMeta.framework_code || article.framework_code || '').trim();

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sync...';
  }
  _setSharedLawActionStatus('Sincronizando no Qdrant...', 'info');

  try {
    const params = new URLSearchParams();
    params.set('path', selectedPath);
    if (frameworkCode) params.set('framework_code', frameworkCode);
    params.set('prune_framework', 'true');

    const res = await fetch(`${API_BASE}/api/shared/law/sync?${params.toString()}`, { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const detail = String(data.detail || `HTTP ${res.status}`);
      throw new Error(detail);
    }

    const summary = data.summary || {};
    const synced = Number(summary.frameworks_synced || 0);
    const upserted = Number(summary.articles_upserted || 0);
    const errorCount = Array.isArray(summary.errors) ? summary.errors.length : 0;
    if (errorCount) {
      _setSharedLawActionStatus(`Sync parcial: ${upserted} artigos (${errorCount} erro(s)).`, 'error');
    } else {
      _setSharedLawActionStatus(`Sync OK: ${synced} framework(s), ${upserted} artigos.`, 'success');
    }
  } catch (e) {
    _setSharedLawActionStatus(`Falha no sync: ${String(e.message || 'erro desconhecido')}`, 'error');
  } finally {
    if (btn) btn.innerHTML = originalHtml;
    _updateSharedLawActionButtons();
  }
}

function _renderSharedLawArticleMarkdown(article, filename) {
  const lines = [
    `# ${filename} - Artigo ${article.article_number}`,
    ''
  ];

  if (article.framework_name || article.framework_code) {
    lines.push(`Framework: ${article.framework_name || article.framework_code}`);
  }
  if (article.hierarchy_label) {
    lines.push(`Hierarchy: ${article.hierarchy_label}`);
  }
  if (article.reference || article.citation) {
    lines.push(`Reference: ${article.reference || article.citation}`);
  }

  const tags = [article.norm_type, article.norm_direction, article.norm_scope].filter(Boolean);
  if (tags.length) {
    lines.push(`Tags: ${tags.map(_sharedLawPrettyLabel).join(' | ')}`);
  }

  lines.push('');
  lines.push(article.text || '(sem texto)');

  if (article.duty_bearer_roles && article.duty_bearer_roles.length) {
    lines.push('');
    lines.push(`Duty Bearers: ${article.duty_bearer_roles.join(', ')}`);
  }
  if (article.right_holder_roles && article.right_holder_roles.length) {
    lines.push(`Right Holders: ${article.right_holder_roles.join(', ')}`);
  }
  if (article.sanctions && article.sanctions.length) {
    lines.push(`Sanctions: ${article.sanctions.join(', ')}`);
  }
  if (article.eli_id) {
    lines.push('');
    lines.push(`ELI: ${article.eli_id}`);
  }
  return lines.join('\n');
}

function _renderSharedLawArticleCardHtml(article, filename) {
  const normTag = article.norm_type
    ? `<span class="art-card-tag type-${escapeHtmlAttr(_sharedLawTagClass(article.norm_type))}">${escapeHtml(_sharedLawPrettyLabel(article.norm_type))}</span>`
    : '';
  const directionTag = article.norm_direction
    ? `<span class="art-card-tag type-${escapeHtmlAttr(_sharedLawTagClass(article.norm_direction))}">${escapeHtml(_sharedLawPrettyLabel(article.norm_direction))}</span>`
    : '';
  const scopeTag = article.norm_scope
    ? `<span class="art-card-tag type-${escapeHtmlAttr(_sharedLawTagClass(article.norm_scope))}">${escapeHtml(_sharedLawPrettyLabel(article.norm_scope))}</span>`
    : '';

  const rolesDuty = (article.duty_bearer_roles || []).map(r => `<span class="article-role-chip">${escapeHtml(r)}</span>`).join('');
  const rolesRight = (article.right_holder_roles || []).map(r => `<span class="article-role-chip">${escapeHtml(r)}</span>`).join('');
  const sanctions = (article.sanctions || []).map(s => `<span class="article-sanction-chip">${escapeHtml(_sharedLawPrettyLabel(s))}</span>`).join('');

  return `
    <article class="article-card">
      <header class="article-card-header">
        <div class="article-card-num">${escapeHtml(String(article.article_number || ''))}</div>
        <div class="article-card-title">
          <div class="article-card-framework">${escapeHtml(article.framework_name || article.framework_code || filename)}</div>
          <div class="article-card-reference">${escapeHtml(article.reference || article.hierarchy_label || article.theme || '')}</div>
        </div>
      </header>

      <div class="article-card-tags">
        ${normTag}${directionTag}${scopeTag}
      </div>

      <section class="article-card-section">
        <div class="article-card-section-title">Article Text</div>
        <div class="article-card-text">${escapeHtml(article.text || '').replace(/\n/g, '<br>')}</div>
      </section>

      <section class="article-card-meta">
        <div class="article-meta-item">
          <div class="article-meta-label">Jurisdiction</div>
          <div class="article-meta-value">${escapeHtml(article.jurisdiction || '-')}</div>
        </div>
        <div class="article-meta-item">
          <div class="article-meta-label">Subject</div>
          <div class="article-meta-value">${escapeHtml(_sharedLawPrettyLabel(article.regulated_subject || '-'))}</div>
        </div>
      </section>

      ${rolesDuty ? `<section class="article-card-section"><div class="article-card-section-title">Duty Bearers</div><div class="article-card-roles">${rolesDuty}</div></section>` : ''}
      ${rolesRight ? `<section class="article-card-section"><div class="article-card-section-title">Right Holders</div><div class="article-card-roles">${rolesRight}</div></section>` : ''}
      ${sanctions ? `<section class="article-card-section"><div class="article-card-section-title">Sanctions</div><div class="article-card-roles">${sanctions}</div></section>` : ''}
      ${article.eli_id ? `<div class="article-card-eli">${escapeHtml(article.eli_id)}</div>` : ''}
    </article>
  `;
}

function _openSharedLawArticleInOutput(article, filePath, filename) {
  if (typeof addOutputArtifact !== 'function') return;
  const artifactId = `shared-law:${filePath}#${article.article_number}`;
  const cardHtml = _renderSharedLawArticleCardHtml(article, filename);
  addOutputArtifact({
    id: artifactId,
    title: `${filename} - Artigo ${article.article_number}`,
    type: 'html',
    content: cardHtml,
    source: 'shared-law',
    path: filePath,
    article_number: article.article_number,
  });
  return artifactId;
}

function _renderSharedEntries(basePath, entries) {
  const dirs = Array.isArray(entries.directories) ? entries.directories : [];
  const files = Array.isArray(entries.files) ? entries.files : [];
  if (entries && entries.base_abs) {
    _sharedBaseAbsPath = String(entries.base_abs || '');
  }

  const dirHtml = dirs.map(dirName => {
    const dirPath = basePath ? `${basePath}/${dirName}` : dirName;
    const safeId = dirPath.replace(/[^a-zA-Z0-9]/g, '_');
    return `
      <div class="docs-tree-item dir" onclick="toggleSharedDir('${_sharedJsQuote(dirPath)}','${safeId}',this)">
        <i class="fas fa-folder"></i>
        <span class="docs-name">${escapeHtml(dirName)}</span>
      </div>
      <div class="docs-tree-children" style="display:none" id="shared-tree-${safeId}" data-path="${escapeHtmlAttr(dirPath)}" data-loaded="false"></div>
    `;
  }).join('');

  const fileHtml = files.map(fileName => {
    const fullPath = basePath ? `${basePath}/${fileName}` : fileName;
    const safeId = fullPath.replace(/[^a-zA-Z0-9]/g, '_');
    const isLaw = _isSharedLawJson(fullPath, fileName);
    const key = fullPath;
    const isChecked = _checkedShared.has(key);
    const checkedClass = isChecked ? ' checked' : '';
    const rawUrl = _sharedRawUrl(fullPath);
    const absPath = _sharedAbsolutePath(fullPath);
    const pinned = !!(absPath && typeof koutIsPinned === 'function' && koutIsPinned(absPath));
    const lawExpander = isLaw
      ? `<button class="docs-action-btn law-expand-btn" id="shared-law-expand-${safeId}" onclick="event.stopPropagation();toggleSharedLawArticles('${_sharedJsQuote(fullPath)}','${safeId}')" title="Ver artigos"><i class="fas fa-chevron-right"></i></button>`
      : '';
    const actionsHtml = `
      <div class="docs-tree-actions shared-file-actions" onclick="event.stopPropagation()">
        <button class="docs-action-btn" onclick="sharedOpenFilePreview('${_sharedJsQuote(fullPath)}','${_sharedJsQuote(fileName)}')" title="Preview"><i class="fas fa-eye"></i></button>
        <button class="docs-action-btn" onclick="sharedOpenFileOutput('${_sharedJsQuote(fullPath)}','${_sharedJsQuote(fileName)}')" title="Output panel"><i class="fas fa-columns"></i></button>
        <button class="docs-action-btn" onclick="sharedOpenFileBrowser('${_sharedJsQuote(fullPath)}','${_sharedJsQuote(fileName)}')" title="Browser panel"><i class="fas fa-globe"></i></button>
        <button class="docs-action-btn pin-btn ${pinned ? 'active' : ''}" data-pin-abs="${escapeHtmlAttr(absPath)}" onclick="toggleSharedFilePin('${_sharedJsQuote(fullPath)}','${_sharedJsQuote(fileName)}',this)" title="${pinned ? 'Desafixar path do contexto' : 'Fixar path no contexto do agente'}"><i class="fas fa-thumbtack"></i></button>
        <a class="docs-action-btn" href="${escapeHtmlAttr(rawUrl)}" target="_blank" rel="noopener noreferrer" title="Abrir em nova guia"><i class="fas fa-external-link-alt"></i></a>
        ${lawExpander}
      </div>`;
    return `
      <div class="docs-tree-item file${checkedClass}" onclick="sharedOpenFilePreview('${_sharedJsQuote(fullPath)}','${_sharedJsQuote(fileName)}')">
        <div class="docs-tree-main">
          <input type="checkbox" class="shared-file-check" data-path="${escapeHtmlAttr(fullPath)}" data-name="${escapeHtmlAttr(fileName)}" ${isChecked ? 'checked' : ''} onclick="event.stopPropagation();toggleSharedFileContext(this)">
          <i class="fas ${_sharedFileIcon(fileName)}"></i>
          <span class="docs-name">${escapeHtml(fileName)}</span>
        </div>
        ${actionsHtml}
      </div>
      ${isLaw ? `<div class="law-articles-list" style="display:none" id="shared-law-articles-${safeId}" data-loaded="false"></div>` : ''}
    `;
  }).join('');

  return dirHtml + fileHtml;
}

async function toggleSharedDir(path, safeId, el) {
  const children = document.getElementById('shared-tree-' + safeId);
  if (!children) return;

  const isOpen = children.style.display !== 'none';
  if (isOpen) {
    children.style.display = 'none';
    const icon = el && el.querySelector('i');
    if (icon) icon.className = 'fas fa-folder';
    return;
  }

  children.style.display = 'block';
  const icon = el && el.querySelector('i');
  if (icon) icon.className = 'fas fa-folder-open';

  if (children.dataset.loaded === 'true') return;
  children.innerHTML = '<div style="padding:8px 12px;color:var(--gray);font-size:11px">Carregando...</div>';

  try {
    const res = await fetch(`${API_BASE}/api/shared/list?path=${encodeURIComponent(path || '')}`);
    const data = await res.json().catch(() => ({}));
    children.innerHTML = _renderSharedEntries(path, data);
    children.dataset.loaded = 'true';
    _bindDocsPinnedPathUiSync();
    _refreshDocsPinButtons();
  } catch (e) {
    children.innerHTML = `<div style="padding:8px 12px;color:var(--red);font-size:11px">Falha ao carregar: ${escapeHtml(e.message || 'erro')}</div>`;
  }
}

function toggleSharedFileContext(checkbox) {
  if (!checkbox) return;
  const path = String(checkbox.dataset.path || '').trim();
  const name = String(checkbox.dataset.name || path.split('/').pop() || path);
  if (!path) return;

  if (checkbox.checked) {
    _checkedShared.set(path, { path, name, type: 'shared-file' });
  } else {
    _checkedShared.delete(path);
  }

  const row = checkbox.closest('.docs-tree-item');
  if (row) row.classList.toggle('checked', checkbox.checked);
  if (_isSharedLawJson(path, name) && checkbox.checked) {
    _setSharedLawSelection(path, null);
    _setSharedLawActionStatus('');
  }
  if (typeof updateSharedContextBar === 'function') updateSharedContextBar();
  if (typeof updateComposeContextBar === 'function') updateComposeContextBar();
}

function _renderSharedLawArticles(container, filePath, filename, articles) {
  const html = (articles || []).map(article => {
    const key = `article:${filePath}#${article.article_number}`;
    const checked = _checkedShared.has(key);
    const label = `${filename} - Artigo ${article.article_number}`;
    const normType = article.norm_type ? _sharedLawTagClass(article.norm_type) : '';
    const metaLabel = article.hierarchy_label || article.reference || article.theme || '';
    return `
      <div class="law-article-item ${checked ? 'checked' : ''}">
        <input type="checkbox" class="shared-article-check" data-file="${escapeHtmlAttr(filePath)}" data-number="${escapeHtmlAttr(article.article_number)}" data-name="${escapeHtmlAttr(label)}" ${checked ? 'checked' : ''} onclick="event.stopPropagation();toggleSharedArticleContext(this)">
        <span class="law-art-number law-art-num" onclick="sharedOpenLawArticlePreview('${_sharedJsQuote(filePath)}','${_sharedJsQuote(article.article_number)}', true)">${escapeHtml(article.article_number)}</span>
        <div style="display:flex;flex-direction:column;min-width:0;flex:1;gap:2px" onclick="sharedOpenLawArticlePreview('${_sharedJsQuote(filePath)}','${_sharedJsQuote(article.article_number)}', true)">
          <span class="law-art-text">${escapeHtml(article.text || '')}</span>
          ${metaLabel ? `<span class="law-art-label">${escapeHtml(metaLabel)}</span>` : ''}
        </div>
        <div class="law-art-actions" onclick="event.stopPropagation()">
          <button class="law-art-action-btn" title="Preview" onclick="sharedOpenLawArticlePreview('${_sharedJsQuote(filePath)}','${_sharedJsQuote(article.article_number)}', false)"><i class="fas fa-eye"></i></button>
          <button class="law-art-action-btn" title="Output panel" onclick="sharedOpenLawArticleOutput('${_sharedJsQuote(filePath)}','${_sharedJsQuote(article.article_number)}')"><i class="fas fa-columns"></i></button>
          <button class="law-art-action-btn" title="Browser panel" onclick="sharedOpenLawArticleBrowser('${_sharedJsQuote(filePath)}','${_sharedJsQuote(article.article_number)}')"><i class="fas fa-globe"></i></button>
          <button class="law-art-action-btn" title="Abrir em nova guia" onclick="sharedOpenLawArticleExternal('${_sharedJsQuote(filePath)}','${_sharedJsQuote(article.article_number)}')"><i class="fas fa-external-link-alt"></i></button>
          <button class="law-art-compare-btn" title="Comparar parsing" onclick="openSharedLawCompare('${_sharedJsQuote(filePath)}','${_sharedJsQuote(article.article_number)}')"><i class="fas fa-columns"></i></button>
        </div>
        ${normType ? `<span class="law-art-tag ${escapeHtmlAttr(normType)}">${escapeHtml(_sharedLawPrettyLabel(article.norm_type || ''))}</span>` : ''}
      </div>
    `;
  }).join('');
  container.innerHTML = html || '<div style="color:var(--gray);font-size:11px;padding:8px 12px">Sem artigos reconhecidos neste arquivo.</div>';
}

async function toggleSharedLawArticles(filePath, safeId) {
  const btn = document.getElementById('shared-law-expand-' + safeId);
  const container = document.getElementById('shared-law-articles-' + safeId);
  if (!btn || !container) return;

  const isOpen = container.style.display !== 'none';
  if (isOpen) {
    container.style.display = 'none';
    btn.classList.remove('open');
    const icon = btn.querySelector('i');
    if (icon) icon.className = 'fas fa-chevron-right';
    return;
  }

  container.style.display = 'block';
  btn.classList.add('open');
  const icon = btn.querySelector('i');
  if (icon) icon.className = 'fas fa-chevron-down';

  if (container.dataset.loaded === 'true' && _sharedLawArticleCache[filePath]) {
    _setSharedLawSelection(filePath, null);
    return;
  }
  container.innerHTML = '<div style="padding:8px 12px;color:var(--gray);font-size:11px">Lendo artigos...</div>';

  try {
    const res = await fetch(`${API_BASE}/api/shared/law/articles?path=${encodeURIComponent(filePath)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload = await res.json().catch(() => ({}));
    const articles = _normalizeSharedLawArticles(payload.items || payload.articles || payload);
    const first = articles[0] || {};
    _sharedLawFileMetaCache[filePath] = {
      framework_code: String(payload.framework_code || (payload.index_entry && payload.index_entry.framework_code) || first.framework_code || '').trim(),
      framework_name: String((payload.index_entry && payload.index_entry.framework_name) || first.framework_name || '').trim(),
      source: String(payload.source || '').trim(),
    };
    _sharedLawArticleCache[filePath] = articles;
    container.dataset.loaded = 'true';
    _renderSharedLawArticles(container, filePath, filePath.split('/').pop() || filePath, articles);
    _setSharedLawSelection(filePath, null);
    _setSharedLawActionStatus('');
  } catch (e) {
    container.innerHTML = `<div style="padding:8px 12px;color:var(--red);font-size:11px">Falha ao ler artigos: ${escapeHtml(e.message || 'erro')}</div>`;
    _setSharedLawActionStatus('Falha ao carregar artigos da lei.', 'error');
  }
}

function toggleSharedArticleContext(checkbox) {
  if (!checkbox) return;
  const filePath = String(checkbox.dataset.file || '').trim();
  const articleNumber = String(checkbox.dataset.number || '').trim();
  const entryKey = `article:${filePath}#${articleNumber}`;
  const articles = _sharedLawArticleCache[filePath] || [];
  const article = articles.find(a => String(a.article_number) === String(articleNumber));
  const articleText = article ? String(article.text || '') : '';
  const citation = article ? String(article.citation || '') : '';
  const name = String(checkbox.dataset.name || `Artigo ${articleNumber}`);

  if (checkbox.checked) {
    _checkedShared.set(entryKey, {
      type: 'law-article',
      path: filePath,
      article_number: articleNumber,
      name,
      articleText,
      citation,
      reference: article ? String(article.reference || '') : '',
      norm_type: article ? String(article.norm_type || '') : '',
      hierarchy_label: article ? String(article.hierarchy_label || '') : ''
    });
    if (article) _setSharedLawSelection(filePath, article);
  } else {
    _checkedShared.delete(entryKey);
  }

  const row = checkbox.closest('.law-article-item');
  if (row) row.classList.toggle('checked', checkbox.checked);
  if (typeof updateSharedContextBar === 'function') updateSharedContextBar();
  if (typeof updateComposeContextBar === 'function') updateComposeContextBar();
}

function openSharedLawArticlePreview(filePath, articleNumber, openCompare) {
  const articles = _sharedLawArticleCache[filePath] || [];
  const article = articles.find(a => String(a.article_number) === String(articleNumber));
  if (!article) return;

  const filename = filePath.split('/').pop() || filePath;
  const markdown = _renderSharedLawArticleMarkdown(article, filename);
  const blob = new Blob([markdown], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  _setSharedLawSelection(filePath, article);
  _setSharedLawActionStatus('');
  openPreviewUrl(url, `${filename}-artigo-${article.article_number}.md`);
  if (openCompare !== false) {
    openSharedLawCompare(filePath, articleNumber);
  }
}

function searchSharedData() {
  const input = document.getElementById('sharedSearchInput');
  const query = String(input && input.value ? input.value : '').trim().toLowerCase();
  const tree = document.getElementById('sharedDataTree');
  if (!tree) return;

  const dirs = tree.querySelectorAll('.docs-tree-item.dir');
  const files = tree.querySelectorAll('.docs-tree-item.file');
  const articles = tree.querySelectorAll('.law-article-item');
  const children = tree.querySelectorAll('.docs-tree-children');

  if (!query) {
    files.forEach(el => { el.style.display = ''; });
    articles.forEach(el => { el.style.display = ''; });
    dirs.forEach(el => { el.style.display = ''; });
    children.forEach(el => {
      if (el.id.startsWith('shared-tree-')) el.style.display = 'none';
    });
    tree.querySelectorAll('.docs-tree-item.dir i').forEach(icon => {
      icon.className = 'fas fa-folder';
    });
    return;
  }

  children.forEach(el => {
    if (el.id.startsWith('shared-tree-')) el.style.display = 'block';
  });
  tree.querySelectorAll('.docs-tree-item.dir i').forEach(icon => {
    icon.className = 'fas fa-folder-open';
  });

  files.forEach(el => {
    const txt = String(el.textContent || '').toLowerCase();
    el.style.display = txt.includes(query) ? '' : 'none';
  });
  articles.forEach(el => {
    const txt = String(el.textContent || '').toLowerCase();
    el.style.display = txt.includes(query) ? '' : 'none';
  });
  dirs.forEach(el => { el.style.display = ''; });
}

// Expose functions to window scope
window.loadDocsTree = loadDocsTree;
window.renderDocsNodes = renderDocsNodes;
window.toggleDocsDir = toggleDocsDir;
window.toggleLawFileArticles = toggleLawFileArticles;
window.renderLawArticles = renderLawArticles;
window.filterLawArticles = filterLawArticles;
window.previewLawArticle = previewLawArticle;
window.openDocFile = openDocFile;
window.toggleDocContext = toggleDocContext;
window.toggleArticleContext = toggleArticleContext;
window.addArticleToContext = addArticleToContext;
window.getCheckedDocsContext = getCheckedDocsContext;
window.updateDocsContextBar = updateDocsContextBar;
window.clearAllDocContext = clearAllDocContext;
window.loadSharedDataTree = loadSharedDataTree;
window.toggleSharedDir = toggleSharedDir;
window.toggleSharedFileContext = toggleSharedFileContext;
window.toggleSharedLawArticles = toggleSharedLawArticles;
window.toggleSharedArticleContext = toggleSharedArticleContext;
window.openSharedLawArticlePreview = openSharedLawArticlePreview;
window.syncSharedLawSelection = syncSharedLawSelection;
window.openSharedLawCompare = openSharedLawCompare;
window.docsDeleteProjectFile = docsDeleteProjectFile;
window.sharedOpenFilePreview = sharedOpenFilePreview;
window.sharedOpenFileOutput = sharedOpenFileOutput;
window.sharedOpenFileBrowser = sharedOpenFileBrowser;
window.sharedOpenFileExternal = sharedOpenFileExternal;
window.toggleDocsFilePin = toggleDocsFilePin;
window.toggleSharedFilePin = toggleSharedFilePin;
window.sharedOpenLawArticlePreview = sharedOpenLawArticlePreview;
window.sharedOpenLawArticleOutput = sharedOpenLawArticleOutput;
window.sharedOpenLawArticleBrowser = sharedOpenLawArticleBrowser;
window.sharedOpenLawArticleExternal = sharedOpenLawArticleExternal;
window.closeSharedLawCompare = closeSharedLawCompare;
window.downloadSharedLawCompare = downloadSharedLawCompare;
window.maximizeSharedLawCompare = maximizeSharedLawCompare;
window.searchSharedData = searchSharedData;