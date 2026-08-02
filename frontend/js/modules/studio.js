/* ═══════════════════════════════════════════════════════════════════
   STUDIO MODULE - HTML editor, AI assistance, and component studio
   ═══════════════════════════════════════════════════════════════════ */

// Studio global state
let _studio = {
  conversationHistory: [],
  components: {},
  templates: {},
  currentMode: 'edit',
  currentTab: 'html',
  documentSource: '',
  viewState: null,
  selection: null,
  editorBound: false,
  syncingView: false,
  sourceIsDefault: false,   // true while documentSource is the unedited localized default template
};

// Maps the active i18n language code (from <html lang>-adjacent cache) to the
// value used on the preview document's <html lang> attribute.
const STUDIO_PREVIEW_LANG_MAP = {
  en: 'en',
  pt: 'pt-BR',
  es: 'es',
  fr: 'fr',
  de: 'de',
  it: 'it',
  el: 'el',
  pl: 'pl',
  sq: 'sq',
  cs: 'cs',
  th: 'th',
};

// Resolve the localized default preview document at *call time* (not module
// load) so it reflects the currently active language. The frozen
// STUDIO_DEFAULT_DOCUMENT const below stays as a stable English seed used only
// for fallbacks / new-project comparisons.
function studioDefaultDocument() {
  const t = (key, fallback) => (typeof window.t === 'function' ? window.t(key, fallback) : fallback);
  // The active language code is mirrored on <html lang> by index.html's applyLang().
  const activeLang = (document.documentElement && document.documentElement.lang) || 'en';
  const htmlLang = STUDIO_PREVIEW_LANG_MAP[activeLang] || activeLang || 'en';
  return `<!DOCTYPE html>
<html lang="${htmlLang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t('studio.default.title', 'Olivia — Your story begins')}</title>
  <style>
    :root {
      --green: #1c4532;
      --green-dark: #143423;
      --green-light: #e8f0ea;
      --orange: #c4622d;
      --orange-light: #e8a878;
      --paper: #fdfbf6;
      --ink: #2a2a26;
      --muted: #6b6f66;
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      height: 100%;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: var(--paper);
      color: var(--ink);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      min-height: 100%;
    }
    .container {
      max-width: 540px;
      width: 100%;
      text-align: center;
    }
    .olive-icon {
      width: 80px;
      height: 80px;
      margin-bottom: 8px;
    }
    h1 {
      font-size: 1.9rem;
      font-weight: 700;
      margin: 0 0 14px;
      color: var(--green-dark);
      letter-spacing: -0.01em;
    }
    h1 em {
      font-style: normal;
      color: var(--orange);
    }
    p {
      font-size: 1rem;
      line-height: 1.6;
      color: var(--muted);
      margin: 0 auto 28px;
      max-width: 460px;
    }
    .prompt-mock {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #fff;
      border: 1.5px solid #d8ded7;
      border-radius: 14px;
      padding: 10px 10px 10px 16px;
      box-shadow: 0 8px 24px rgba(28, 69, 50, 0.06);
      max-width: 460px;
      margin: 0 auto 18px;
    }
    .prompt-mock input {
      flex: 1;
      border: none;
      outline: none;
      font-size: 0.98rem;
      background: transparent;
      color: var(--ink);
    }
    .prompt-mock input::placeholder {
      color: #a7ad9f;
    }
    .prompt-mock button {
      border: none;
      background: var(--green);
      color: #fff;
      width: 38px;
      height: 38px;
      border-radius: 10px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.18s ease;
    }
    .prompt-mock button:hover {
      background: var(--green-dark);
    }
    .prompt-mock button svg {
      width: 18px;
      height: 18px;
      fill: #fff;
    }
    .tagline {
      font-size: 0.82rem;
      color: #9aa092;
      letter-spacing: 0.02em;
    }
    .tagline .dot {
      color: var(--orange-light);
      margin: 0 4px;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Olive branch icon — simple, organic mark -->
    <svg class="olive-icon" viewBox="0 0 80 80">
      <path d="M40 72 Q38 52,40 36 Q42 26,40 20" fill="none" stroke="#1c4532" stroke-width="2.4" stroke-linecap="round" opacity="0.55"/>
      <path d="M26 68 Q40 74,54 68" fill="none" stroke="#1c4532" stroke-width="0.7" opacity="0.12"/>
      <g>
        <path d="M38 30 Q28 22,20 18" fill="none" stroke="#1c4532" stroke-width="1.2" stroke-linecap="round" opacity="0.35"/>
        <path d="M42 30 Q52 22,60 18" fill="none" stroke="#1c4532" stroke-width="1.2" stroke-linecap="round" opacity="0.35"/>
        <ellipse cx="30" cy="34" rx="3.5" ry="4.5" fill="#c4622d" opacity="0.8"/>
        <ellipse cx="50" cy="32" rx="3" ry="4" fill="#c4622d" opacity="0.7"/>
      </g>
      <circle cx="40" cy="17" r="3" fill="#c4622d" opacity="0.9"/>
    </svg>
    <h1>${t('studio.default.h1', 'Your story <em>begins here</em>')}</h1>
    <p>
      ${t('studio.default.desc', 'This is the Olivia Studio — a living canvas where you describe a world and it comes to life. Edit the code on the left, see the result transform instantly on the right.')}
    </p>
    <form class="prompt-mock" id="studio-prompt" autocomplete="off" novalidate>
      <input
        id="studio-prompt-input"
        type="text"
        aria-label="${t('studio.default.ariaInput', 'Describe a scene, a story, a world')}"
        placeholder="${t('studio.default.placeholder', 'Describe a scene, a story, a world…')}" />
      <button type="submit" aria-label="${t('studio.default.ariaSend', 'Send')}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.5 21 3l-8.5 18-2.2-7.3z"/></svg>
      </button>
    </form>
    <p class="tagline">
      ${t('studio.default.tagline', 'Powered by Olivia · From imagination to living worlds')}
    </p>
  </div>
  <script>
    (function () {
      const form = document.getElementById('studio-prompt');
      const input = document.getElementById('studio-prompt-input');
      if (form && input) {
        form.addEventListener('submit', function (e) {
          e.preventDefault();
          console.log('Olivia Studio preview prompt (demo only):', input.value);
        });
      }
    })();
  </script>
</body>
</html>`;
}

let _studioProject = null;   // { files: Map<path, content>, rootName: string }

const STUDIO_FALLBACK_MODELS = {
  deepseek: [
    { v: 'deepseek-v4-pro', l: 'DeepSeek V4 Pro' },
    { v: 'deepseek-v4-flash', l: 'DeepSeek V4 Flash' }
  ],
  anthropic: [
    { v: 'deepseek-v4-pro', l: 'DeepSeek V4 Pro (Anthropic-compatible)' },
    { v: 'deepseek-v4-flash', l: 'DeepSeek V4 Flash (Anthropic-compatible)' }
  ],
  openai: [
    { v: 'gpt-4o', l: 'GPT-4o' },
    { v: 'gpt-4.1', l: 'GPT-4.1' },
    { v: 'gpt-4.1-mini', l: 'GPT-4.1 Mini' }
  ],
  openrouter: [
    { v: 'google/gemini-2.5-flash', l: 'Gemini 2.5 Flash' },
    { v: 'google/gemini-2.5-pro', l: 'Gemini 2.5 Pro' },
    { v: 'anthropic/claude-3.7-sonnet', l: 'Claude 3.7 Sonnet' }
  ],
  ollama: []
};

const STUDIO_DEFAULT_DOCUMENT = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Olivia — Your story begins</title>
  <style>
    :root {
      --green: #1c4532;
      --green-dark: #143423;
      --green-light: #e8f0ea;
      --orange: #c4622d;
      --orange-light: #e8a878;
      --paper: #fdfbf6;
      --ink: #2a2a26;
      --muted: #6b6f66;
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; height: 100%; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: var(--paper);
      color: var(--ink);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      min-height: 100%;
    }
    .container { max-width: 540px; width: 100%; text-align: center; }
    .olive-icon { width: 80px; height: 80px; margin-bottom: 8px; }
    h1 { font-size: 1.9rem; font-weight: 700; margin: 0 0 14px; color: var(--green-dark); letter-spacing: -0.01em; }
    h1 em { font-style: normal; color: var(--orange); }
    p { font-size: 1rem; line-height: 1.6; color: var(--muted); margin: 0 auto 28px; max-width: 460px; }
    .prompt-mock { display: flex; align-items: center; gap: 8px; background: #fff; border: 1.5px solid #d8ded7; border-radius: 14px; padding: 10px 10px 10px 16px; box-shadow: 0 8px 24px rgba(28,69,50,0.06); max-width: 460px; margin: 0 auto 18px; }
    .prompt-mock input { flex: 1; border: none; outline: none; font-size: 0.98rem; background: transparent; color: var(--ink); }
    .prompt-mock input::placeholder { color: #a7ad9f; }
    .prompt-mock button { border: none; background: var(--green); color: #fff; width: 38px; height: 38px; border-radius: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.18s ease; }
    .prompt-mock button:hover { background: var(--green-dark); }
    .prompt-mock button svg { width: 18px; height: 18px; fill: #fff; }
    .tagline { font-size: 0.82rem; color: #9aa092; letter-spacing: 0.02em; }
    .tagline .dot { color: var(--orange-light); margin: 0 4px; }
  </style>
</head>
<body>
  <div class="container">
    <svg class="olive-icon" viewBox="0 0 80 80">
      <path d="M40 72 Q38 52,40 36 Q42 26,40 20" fill="none" stroke="#1c4532" stroke-width="2.4" stroke-linecap="round" opacity="0.55"/>
      <path d="M26 68 Q40 74,54 68" fill="none" stroke="#1c4532" stroke-width="0.7" opacity="0.12"/>
      <g>
        <path d="M38 30 Q28 22,20 18" fill="none" stroke="#1c4532" stroke-width="1.2" stroke-linecap="round" opacity="0.35"/>
        <path d="M42 30 Q52 22,60 18" fill="none" stroke="#1c4532" stroke-width="1.2" stroke-linecap="round" opacity="0.35"/>
        <ellipse cx="30" cy="34" rx="3.5" ry="4.5" fill="#c4622d" opacity="0.8"/>
        <ellipse cx="50" cy="32" rx="3" ry="4" fill="#c4622d" opacity="0.7"/>
      </g>
      <circle cx="40" cy="17" r="3" fill="#c4622d" opacity="0.9"/>
    </svg>
    <h1>Your story <em>begins here</em></h1>
    <p>This is the Olivia Studio — a living canvas where you describe a world and it comes to life. Edit the code on the left, see the result transform instantly on the right.</p>
    <form class="prompt-mock" id="studio-prompt" autocomplete="off" novalidate>
      <input id="studio-prompt-input" type="text" aria-label="Describe a scene, a story, a world" placeholder="Describe a scene, a story, a world…" />
      <button type="submit" aria-label="Send">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.5 21 3l-8.5 18-2.2-7.3z"/></svg>
      </button>
    </form>
    <p class="tagline">Powered by Olivia · From imagination to living worlds</p>
  </div>
</body>
</html>`;

let _studioProviderModels = null;
let _studioPanelContextListenerBound = false;


function _studioGetPanelContextData() {
  if (typeof window.buildSelectedPanelContext === 'function') {
    return window.buildSelectedPanelContext();
  }
  return { text: '', selectedCount: 0, availableCount: 0, snapshots: [] };
}


function _studioPanelContextSummary() {
  const data = _studioGetPanelContextData();
  const activeLabels = (data.snapshots || []).filter(s => s && s.available && s.content).map(s => s.label);
  const base = `Paineis: ${data.availableCount}/${data.selectedCount}`;
  return activeLabels.length ? `${base} (${activeLabels.join(', ')})` : base;
}


function _studioCloneFallbackModels() {
  return JSON.parse(JSON.stringify(STUDIO_FALLBACK_MODELS));
}


function _studioNormalizeCatalog(data) {
  const rawModels = data && (data.models || data.catalog || (Array.isArray(data) ? data : null));
  if (!rawModels) return {};
  if (!Array.isArray(rawModels)) return rawModels;

  const normalized = {};
  rawModels.forEach(model => {
    const provider = model.provider || 'other';
    if (!normalized[provider]) normalized[provider] = [];
    normalized[provider].push(model);
  });
  return normalized;
}


async function studioEnsureProviderModels() {
  if (_studioProviderModels) return _studioProviderModels;

  const merged = _studioCloneFallbackModels();
  try {
    const res = await fetch(`${API_BASE}/api/models/catalog`);
    if (res.ok) {
      const data = await res.json();
      const catalog = _studioNormalizeCatalog(data);
      ['deepseek', 'anthropic', 'openai', 'openrouter', 'ollama'].forEach(provider => {
        const models = catalog[provider];
        if (Array.isArray(models) && models.length) {
          merged[provider] = models.map(model => ({
            v: model.id || model.name,
            l: model.name || model.id
          }));
        }
      });
    }
  } catch (e) {
    console.warn('Failed to load studio model catalog:', e);
  }

  _studioProviderModels = merged;
  return _studioProviderModels;
}


function studioPopulateModelSelect(provider, preferredModel) {
  const modelSelect = document.getElementById('studioModelSelect');
  if (!modelSelect) return;

  const providerModels = (_studioProviderModels && _studioProviderModels[provider]) || [];
  if (!providerModels.length) {
    if (provider === 'ollama') {
      modelSelect.innerHTML = '<option value="">Nenhum modelo Ollama encontrado em 12434/12435/12436</option>';
      modelSelect.value = '';
      return;
    }

    const fallbackProvider = STUDIO_FALLBACK_MODELS[provider] ? provider : 'deepseek';
    const fallbackModels = STUDIO_FALLBACK_MODELS[fallbackProvider];
    modelSelect.innerHTML = fallbackModels.map(model => `<option value="${model.v}">${model.l}</option>`).join('');
    modelSelect.value = preferredModel && fallbackModels.some(model => model.v === preferredModel)
      ? preferredModel
      : fallbackModels[0].v;
    return;
  }

  modelSelect.innerHTML = providerModels.map(model => `<option value="${model.v}">${model.l}</option>`).join('');
  const hasPreferredModel = preferredModel && providerModels.some(model => model.v === preferredModel);
  modelSelect.value = hasPreferredModel ? preferredModel : providerModels[0].v;
}


function studioNormalizeText(text) {
  return String(text || '').replace(/\r\n?/g, '\n');
}


function studioNormalizeTab(tab) {
  if (tab === 'javascript') return 'js';
  if (tab === 'htm') return 'html';
  if (tab === 'css' || tab === 'html' || tab === 'js') return tab;
  return 'html';
}


function studioGetEditor() {
  return document.getElementById('studioCodeEditor');
}


function studioHtmlMarker(type, id) {
  return `<!-- [studio-${type}-${id}] -->`;
}


function studioViewMarker(type, id) {
  return type === 'css' ? `/* [studio-css-${id}] */` : `// [studio-js-${id}]`;
}


function studioRenderBlockView(blocks) {
  if (!blocks.length) return '';
  return blocks.map(block => `${block.viewMarker}\n${block.content}`).join('\n\n');
}


function studioParseDocument(source) {
  const normalized = studioNormalizeText(source);
  const htmlParts = [];
  const cssBlocks = [];
  const jsBlocks = [];
  const blockRegex = /<style\b([^>]*)>([\s\S]*?)<\/style>|<script\b([^>]*)>([\s\S]*?)<\/script>/gi;

  let cursor = 0;
  let cssIndex = 0;
  let jsIndex = 0;
  let match;

  while ((match = blockRegex.exec(normalized))) {
    htmlParts.push(normalized.slice(cursor, match.index));
    if (match[1] !== undefined) {
      cssIndex += 1;
      const block = {
        id: cssIndex,
        attrs: match[1] || '',
        content: match[2] || '',
        htmlMarker: studioHtmlMarker('css', cssIndex),
        viewMarker: studioViewMarker('css', cssIndex),
      };
      cssBlocks.push(block);
      htmlParts.push(block.htmlMarker);
    } else {
      const attrs = match[3] || '';
      if (/\bsrc\s*=/.test(attrs)) {
        htmlParts.push(match[0]);
      } else {
        jsIndex += 1;
        const block = {
          id: jsIndex,
          attrs: attrs,
          content: match[4] || '',
          htmlMarker: studioHtmlMarker('js', jsIndex),
          viewMarker: studioViewMarker('js', jsIndex),
        };
        jsBlocks.push(block);
        htmlParts.push(block.htmlMarker);
      }
    }
    cursor = blockRegex.lastIndex;
  }

  htmlParts.push(normalized.slice(cursor));

  return {
    source: normalized,
    htmlView: htmlParts.join(''),
    cssBlocks,
    jsBlocks,
    cssView: studioRenderBlockView(cssBlocks),
    jsView: studioRenderBlockView(jsBlocks),
  };
}


function studioInsertStyleBlock(source, cssText) {
  const styleBlock = `<style>\n${cssText}\n</style>`;
  if (/<\/head>/i.test(source)) return source.replace(/<\/head>/i, `${styleBlock}\n</head>`);
  if (/<body\b[^>]*>/i.test(source)) {
    return source.replace(/<body\b[^>]*>/i, match => `${match}\n${styleBlock}`);
  }
  return `${styleBlock}\n${source}`;
}


function studioInsertScriptBlock(source, jsText) {
  const scriptBlock = `<script>\n${jsText}\n</script>`;
  if (/<\/body>/i.test(source)) return source.replace(/<\/body>/i, `${scriptBlock}\n</body>`);
  if (/<\/html>/i.test(source)) return source.replace(/<\/html>/i, `${scriptBlock}\n</html>`);
  return `${source}\n${scriptBlock}`;
}


function studioComposeDocument(state, override) {
  const htmlView = override && override.htmlView !== undefined ? override.htmlView : state.htmlView;
  const cssContents = override && override.cssContents ? override.cssContents : state.cssBlocks.map(block => block.content);
  const jsContents = override && override.jsContents ? override.jsContents : state.jsBlocks.map(block => block.content);
  const syntheticCss = override && override.syntheticCss !== undefined ? override.syntheticCss : '';
  const syntheticJs = override && override.syntheticJs !== undefined ? override.syntheticJs : '';

  let source = htmlView;
  state.cssBlocks.forEach((block, index) => {
    const replacement = `<style${block.attrs}>${cssContents[index] || ''}</style>`;
    source = source.replace(block.htmlMarker, replacement);
  });
  state.jsBlocks.forEach((block, index) => {
    const replacement = `<script${block.attrs}>${jsContents[index] || ''}</script>`;
    source = source.replace(block.htmlMarker, replacement);
  });

  if (!state.cssBlocks.length && syntheticCss.trim()) {
    source = studioInsertStyleBlock(source, syntheticCss);
  }
  if (!state.jsBlocks.length && syntheticJs.trim()) {
    source = studioInsertScriptBlock(source, syntheticJs);
  }

  return studioNormalizeText(source);
}


function studioExtractBlockContents(view, blocks) {
  const normalized = studioNormalizeText(view);
  if (!blocks.length) return [normalized];

  const markersFound = blocks.every(block => normalized.indexOf(block.viewMarker) !== -1);
  if (!markersFound) {
    return blocks.map((_, index) => (index === 0 ? normalized : ''));
  }

  return blocks.map((block, index) => {
    const markerIndex = normalized.indexOf(block.viewMarker);
    let start = markerIndex + block.viewMarker.length;
    if (normalized.slice(start, start + 1) === '\n') start += 1;

    const nextBlock = blocks[index + 1];
    const end = nextBlock ? normalized.indexOf(nextBlock.viewMarker, start) : normalized.length;
    const slice = normalized.slice(start, end === -1 ? normalized.length : end);
    return slice.replace(/^\n/, '').replace(/\n+$/, '');
  });
}


function studioGetViewContent(state, tab) {
  const normalizedTab = studioNormalizeTab(tab);
  if (normalizedTab === 'css') return state.cssView;
  if (normalizedTab === 'js') return state.jsView;
  return state.htmlView;
}


function studioDescribeCurrentScope() {
  const state = _studio.viewState || studioParseDocument(_studio.documentSource || '');
  if (_studio.currentTab === 'css') {
    return state.cssBlocks.length
      ? `CSS view · ${state.cssBlocks.length} bloco(s) <style> inline`
      : 'CSS view · sem bloco inline ainda; digite para criar um novo';
  }
  if (_studio.currentTab === 'js') {
    return state.jsBlocks.length
      ? `JS view · ${state.jsBlocks.length} bloco(s) <script> inline`
      : 'JS view · sem bloco inline ainda; digite para criar um novo';
  }
  return 'HTML view · estrutura visivel, com CSS e JS recolhidos em marcadores';
}


function studioUpdateSelectionUi() {
  const scopeEl = document.getElementById('studioEditorScope');
  const selectionEl = document.getElementById('studioEditorSelection');
  const contextEl = document.getElementById('studioAiContextHint');
  const selectionOpt = document.getElementById('studioOptSelection');
  const contextToggle = document.getElementById('studioOptCtx');

  if (scopeEl) scopeEl.textContent = studioDescribeCurrentScope();

  const panelSummary = _studioPanelContextSummary();

  if (_studio.selection && _studio.selection.text.trim()) {
    const lines = _studio.selection.text.split('\n').length;
    const chars = _studio.selection.text.length;
    const summary = `${_studio.selection.tab.toUpperCase()} · ${lines} linha(s) · ${chars} caract.`;
    if (selectionEl) {
      selectionEl.textContent = summary;
      selectionEl.classList.remove('is-empty');
      selectionEl.disabled = false;
      selectionEl.title = _studio.selection.preview;
    }
    if (contextEl) contextEl.textContent = `Selecao ativa: ${summary} | ${panelSummary}`;
    if (selectionOpt) {
      selectionOpt.classList.remove('is-disabled');
      selectionOpt.disabled = false;
    }
  } else {
    if (selectionEl) {
      selectionEl.textContent = 'Sem selecao ativa';
      selectionEl.classList.add('is-empty');
      selectionEl.disabled = true;
      selectionEl.title = 'Selecione um trecho no editor para enviar esse contexto ao assistente.';
    }
    if (contextEl) {
      const ctxState = contextToggle && contextToggle.classList.contains('active') ? 'com documento atual' : 'sem documento atual';
      contextEl.textContent = `Contexto ativo: ${_studio.currentTab.toUpperCase()} ${ctxState} | ${panelSummary}`;
    }
    if (selectionOpt) {
      selectionOpt.classList.add('is-disabled');
      selectionOpt.disabled = true;
    }
  }
}


function studioSyncAssistantContext() {
  studioUpdateSelectionUi();
}


function studioScrollSelectionIntoView(editor) {
  const lineHeight = parseFloat(window.getComputedStyle(editor).lineHeight) || 20;
  const prefix = editor.value.slice(0, editor.selectionStart);
  const lineNumber = prefix.split('\n').length;
  editor.scrollTop = Math.max(0, (lineNumber - 3) * lineHeight);
}


function studioHighlightRange(tab, start, end) {
  studioSwitchTab(null, tab, { skipCommit: false });
  const editor = studioGetEditor();
  if (!editor) return;

  requestAnimationFrame(() => {
    editor.focus();
    editor.setSelectionRange(start, end);
    studioScrollSelectionIntoView(editor);
    studioHandleEditorSelectionChange();
  });
}


function studioFindSnippetRange(view, snippet) {
  const normalizedView = studioNormalizeText(view);
  const rawSnippet = studioNormalizeText(snippet || '');
  if (!rawSnippet.trim()) return null;

  let index = normalizedView.indexOf(rawSnippet);
  let length = rawSnippet.length;
  if (index === -1) {
    const trimmed = rawSnippet.trim();
    index = normalizedView.indexOf(trimmed);
    length = trimmed.length;
  }

  if (index === -1) return null;
  return { start: index, end: index + length };
}


function studioEscapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}


function studioBuildPreviewSelector(el) {
  const parts = [];
  let node = el;
  while (node && node.nodeType === 1 && parts.length < 6) {
    const tag = (node.tagName || '').toLowerCase();
    if (!tag) break;
    let part = tag;

    if (node.id) {
      part += `#${node.id}`;
      parts.unshift(part);
      break;
    }

    const cls = Array.from(node.classList || []).filter(Boolean);
    if (cls.length) part += `.${cls[0]}`;

    const parent = node.parentElement;
    if (parent) {
      const sameTagSiblings = Array.from(parent.children).filter(child => child.tagName === node.tagName);
      if (sameTagSiblings.length > 1) {
        part += `:nth-of-type(${sameTagSiblings.indexOf(node) + 1})`;
      }
    }

    parts.unshift(part);
    node = node.parentElement;
  }
  return parts.join(' > ');
}


function studioFindPreviewRangeInHtml(htmlView, payload) {
  const normalizedView = studioNormalizeText(htmlView || '');
  if (!normalizedView) return null;

  const exactCandidates = [payload.outerHTML, payload.openTag]
    .map(value => studioNormalizeText(value || '').trim())
    .filter(Boolean);

  for (const candidate of exactCandidates) {
    const range = studioFindSnippetRange(normalizedView, candidate);
    if (range) return range;
  }

  if (payload.id) {
    const idNeedles = [`id="${payload.id}"`, `id='${payload.id}'`];
    for (const needle of idNeedles) {
      const idx = normalizedView.indexOf(needle);
      if (idx !== -1) {
        const start = normalizedView.lastIndexOf('<', idx);
        const close = normalizedView.indexOf('>', idx);
        if (start !== -1 && close !== -1) return { start: start, end: close + 1 };
      }
    }
  }

  if (payload.tagName && Array.isArray(payload.classNames) && payload.classNames.length) {
    for (const cls of payload.classNames) {
      const clsEsc = studioEscapeRegExp(cls);
      const tagEsc = studioEscapeRegExp(payload.tagName);
      const rx = new RegExp(`<${tagEsc}\\b[^>]*\\bclass=("|')[^"']*\\b${clsEsc}\\b[^"']*\\1[^>]*>`, 'i');
      const match = rx.exec(normalizedView);
      if (match && Number.isFinite(match.index)) {
        return { start: match.index, end: match.index + match[0].length };
      }
    }
  }

  const textSample = studioNormalizeText(payload.textSample || '').trim();
  if (textSample.length >= 12) {
    const idx = normalizedView.indexOf(textSample);
    if (idx !== -1) return { start: idx, end: idx + textSample.length };
  }

  return null;
}


function studioApplyPreviewSelection(payload) {
  if (!payload) return;

  const state = _studio.viewState || studioParseDocument(_studio.documentSource || STUDIO_DEFAULT_DOCUMENT);
  const htmlView = studioGetViewContent(state, 'html');
  const range = studioFindPreviewRangeInHtml(htmlView, payload);

  if (range && range.end > range.start) {
    studioHighlightRange('html', range.start, range.end);
    return;
  }

  const fallbackText = studioNormalizeText(payload.outerHTML || payload.openTag || payload.textSample || '').trim();
  if (!fallbackText) return;

  _studio.selection = {
    tab: 'html',
    text: fallbackText.slice(0, 2200),
    preview: payload.selector ? `Preview: ${payload.selector}` : 'Selecao no preview',
    source: 'preview',
  };
  studioUpdateSelectionUi();
}


function studioBindPreviewSelection(previewFrame) {
  if (!previewFrame) return;

  let doc;
  try {
    doc = previewFrame.contentDocument;
  } catch (_err) {
    return;
  }
  if (!doc || doc.__koutPreviewSelectionBound) return;
  doc.__koutPreviewSelectionBound = true;

  const style = doc.createElement('style');
  style.textContent = '[data-LA8159-preview-selected="1"]{outline:2px solid #c4622d !important;outline-offset:2px !important;}';
  (doc.head || doc.documentElement).appendChild(style);

  doc.addEventListener('click', function (evt) {
    const target = evt && evt.target && evt.target.closest ? evt.target.closest('*') : evt.target;
    if (!target || !target.tagName) return;

    const tag = String(target.tagName).toLowerCase();
    if (tag === 'html' || tag === 'head' || tag === 'body' || tag === 'script' || tag === 'style') return;

    evt.preventDefault();
    evt.stopPropagation();

    const prev = doc.querySelector('[data-LA8159-preview-selected="1"]');
    if (prev && prev !== target) prev.removeAttribute('data-LA8159-preview-selected');
    target.setAttribute('data-LA8159-preview-selected', '1');

    const shallowOuter = studioNormalizeText((target.cloneNode(false).outerHTML || '').trim());
    const openTagMatch = shallowOuter.match(/^<[^>]+>/);
    const payload = {
      tagName: tag,
      id: target.id || '',
      classNames: Array.from(target.classList || []).slice(0, 4),
      selector: studioBuildPreviewSelector(target),
      openTag: openTagMatch ? openTagMatch[0] : shallowOuter,
      outerHTML: studioNormalizeText((target.outerHTML || '').trim()).slice(0, 12000),
      textSample: studioNormalizeText((target.textContent || '').replace(/\s+/g, ' ').trim()).slice(0, 220),
    };

    studioApplyPreviewSelection(payload);
  }, true);
}


function studioGetSelectionContext() {
  const useSelection = document.getElementById('studioOptSelection');
  if (!useSelection || !useSelection.classList.contains('active')) return null;
  if (!_studio.selection || !_studio.selection.text.trim()) return null;
  return Object.assign({}, _studio.selection);
}


function studioCommitEditorToSource() {
  const editor = studioGetEditor();
  if (!editor || _studio.syncingView) return;
  const currentValue = studioNormalizeText(editor.value);
  const currentState = _studio.viewState || studioParseDocument(_studio.documentSource || currentValue);

  let nextSource = currentState.source;
  if (_studio.currentTab === 'css') {
    nextSource = studioComposeDocument(currentState, {
      cssContents: studioExtractBlockContents(currentValue, currentState.cssBlocks),
      syntheticCss: currentValue,
    });
  } else if (_studio.currentTab === 'js') {
    nextSource = studioComposeDocument(currentState, {
      jsContents: studioExtractBlockContents(currentValue, currentState.jsBlocks),
      syntheticJs: currentValue,
    });
  } else {
    nextSource = studioComposeDocument(currentState, { htmlView: currentValue });
  }

  _studio.documentSource = nextSource;
  _studio.viewState = studioParseDocument(nextSource);
  studioUpdatePreview();
}

async function studioSaveCurrentFile() {
  studioCommitEditorToSource();
  if (!_studioProject || !_studioProject.currentPage) {
    alert('Nenhum arquivo de projeto ativo para salvar. Importe um projeto primeiro.');
    return;
  }

  const htmlPath = _studioProject.currentPage;
  const content = _studioProject.documentSource || _studio.documentSource;
  if (!content) {
    alert('Nenhum conteúdo para salvar.');
    return;
  }

  _studioProject.files.set(htmlPath, content);

  try {
    await _studioUploadFileToProject(htmlPath, new Blob([content], { type: 'text/html' }), _studioProject._projectId || _studioGetActiveProjectId());
    const saveBtn = document.querySelector('.studio-top-actions button[title="Salvar arquivo"]');
    if (saveBtn) {
      const orig = saveBtn.innerHTML;
      saveBtn.innerHTML = '<i class="fas fa-check"></i>';
      setTimeout(() => { saveBtn.innerHTML = orig; }, 900);
    }
  } catch (err) {
    alert('Erro ao salvar arquivo: ' + (err.message || err));
  }
}

function studioUpdateSaveButtonState() {
  const saveBtn = document.querySelector('.studio-top-actions button[title="Salvar arquivo"]');
  if (!saveBtn) return;

  const enabled = !!(_studioProject && _studioProject.currentPage);
  saveBtn.disabled = !enabled;
  saveBtn.classList.toggle('disabled', !enabled);
}


function studioHandleEditorSelectionChange() {
  const editor = studioGetEditor();
  if (!editor || _studio.syncingView) return;

  const start = editor.selectionStart || 0;
  const end = editor.selectionEnd || 0;
  const text = editor.value.slice(start, end);

  if (end > start && text.trim()) {
    const preview = text.trim().replace(/\s+/g, ' ').slice(0, 140);
    _studio.selection = {
      tab: _studio.currentTab,
      start,
      end,
      text,
      preview,
    };
  } else {
    _studio.selection = null;
  }

  studioUpdateSelectionUi();
}


function studioHandleEditorInput() {
  if (_studio.syncingView) return;
  studioCommitEditorToSource();
  // Any manual edit moves the document away from the pristine default template.
  _studio.sourceIsDefault = false;
  studioHandleEditorSelectionChange();
}


function studioEnsureEditorModel() {
  const editor = studioGetEditor();
  if (!editor) return;

  if (!_studio.documentSource) {
    _studio.documentSource = studioNormalizeText(editor.value || studioDefaultDocument());
    _studio.sourceIsDefault = !editor.value;
    _studio.viewState = studioParseDocument(_studio.documentSource);
  }

  if (!_studio.editorBound) {
    editor.addEventListener('input', studioHandleEditorInput);
    editor.addEventListener('select', studioHandleEditorSelectionChange);
    editor.addEventListener('keyup', studioHandleEditorSelectionChange);
    editor.addEventListener('mouseup', studioHandleEditorSelectionChange);
    _studio.editorBound = true;
  }
}

/* Page select change listener is now attached in studioSetProjectFiles */

function studioRenderCurrentTab() {
  const editor = studioGetEditor();
  if (!editor) return;
  const state = _studio.viewState || studioParseDocument(_studio.documentSource || STUDIO_DEFAULT_DOCUMENT);
  const nextValue = studioGetViewContent(state, _studio.currentTab);

  _studio.syncingView = true;
  editor.value = nextValue;
  _studio.syncingView = false;

  document.querySelectorAll('.studio-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === _studio.currentTab);
  });

  studioHandleEditorSelectionChange();
  studioUpdateSelectionUi();
}


function studioSetDocumentSource(source, options) {
  // options.isDefault marks the source as the pristine localized default
  // template; while true, a language change may re-seed it (see
  // studioWatchPreviewLanguage). options.skipRender skips re-rendering the tab.
  _studio.documentSource = studioNormalizeText(source || STUDIO_DEFAULT_DOCUMENT);
  _studio.sourceIsDefault = !!(options && options.isDefault);
  _studio.viewState = studioParseDocument(_studio.documentSource);
  if (!(options && options.skipRender)) studioRenderCurrentTab();
  studioUpdatePreview();
}


function studioApplyViewChange(tab, nextView, highlightRange) {
  studioCommitEditorToSource();
  const state = studioParseDocument(_studio.documentSource || STUDIO_DEFAULT_DOCUMENT);
  const normalizedTab = studioNormalizeTab(tab);

  let nextSource;
  if (normalizedTab === 'css') {
    nextSource = studioComposeDocument(state, {
      cssContents: studioExtractBlockContents(nextView, state.cssBlocks),
      syntheticCss: nextView,
    });
  } else if (normalizedTab === 'js') {
    nextSource = studioComposeDocument(state, {
      jsContents: studioExtractBlockContents(nextView, state.jsBlocks),
      syntheticJs: nextView,
    });
  } else {
    nextSource = studioComposeDocument(state, { htmlView: nextView });
  }

  _studio.currentTab = normalizedTab;
  studioSetDocumentSource(nextSource);

  if (highlightRange) {
    studioHighlightRange(normalizedTab, highlightRange.start, highlightRange.end);
  }
}


function studioNormalizeAction(action) {
  return {
    tab: studioNormalizeTab(action && action.tab ? action.tab : _studio.currentTab),
    action: action && action.action ? action.action : 'replace_all',
    label: action && action.label ? action.label : 'Mudanca sugerida',
    target: action && action.target ? action.target : '',
    content: studioNormalizeText(action && (action.content || action.code) ? (action.content || action.code) : ''),
  };
}


function studioHighlightReference(reference) {
  const ref = reference || {};
  const tab = studioNormalizeTab(ref.tab || _studio.currentTab);

  if (ref.selection && _studio.selection && _studio.selection.tab === tab) {
    studioHighlightRange(tab, _studio.selection.start, _studio.selection.end);
    return;
  }

  const state = studioParseDocument(_studio.documentSource || STUDIO_DEFAULT_DOCUMENT);
  const view = studioGetViewContent(state, tab);
  const range = studioFindSnippetRange(view, ref.snippet || ref.target || '');
  if (range) {
    studioHighlightRange(tab, range.start, range.end);
  }
}


function studioApplyAction(action) {
  const normalized = studioNormalizeAction(action);
  const tab = normalized.tab;
  const state = studioParseDocument(_studio.documentSource || STUDIO_DEFAULT_DOCUMENT);
  const currentView = studioGetViewContent(state, tab);
  const selection = _studio.selection && _studio.selection.tab === tab ? _studio.selection : null;

  let nextView = currentView;
  let highlight = null;
  let range = null;

  if (normalized.action === 'replace_selection') {
    if (selection) {
      nextView = currentView.slice(0, selection.start) + normalized.content + currentView.slice(selection.end);
      highlight = { start: selection.start, end: selection.start + normalized.content.length };
    } else if (normalized.target) {
      range = studioFindSnippetRange(currentView, normalized.target);
      if (!range) return;
      nextView = currentView.slice(0, range.start) + normalized.content + currentView.slice(range.end);
      highlight = { start: range.start, end: range.start + normalized.content.length };
    } else {
      return;
    }
  } else if (normalized.action === 'replace_snippet') {
    range = studioFindSnippetRange(currentView, normalized.target);
    if (!range) return;
    nextView = currentView.slice(0, range.start) + normalized.content + currentView.slice(range.end);
    highlight = { start: range.start, end: range.start + normalized.content.length };
  } else if (normalized.action === 'insert_before') {
    range = studioFindSnippetRange(currentView, normalized.target);
    if (!range) return;
    nextView = currentView.slice(0, range.start) + normalized.content + '\n' + currentView.slice(range.start);
    highlight = { start: range.start, end: range.start + normalized.content.length };
  } else if (normalized.action === 'insert_after') {
    range = studioFindSnippetRange(currentView, normalized.target);
    if (!range) return;
    nextView = currentView.slice(0, range.end) + '\n' + normalized.content + currentView.slice(range.end);
    highlight = { start: range.end + 1, end: range.end + 1 + normalized.content.length };
  } else if (normalized.action === 'prepend') {
    nextView = normalized.content + (currentView ? '\n\n' + currentView : '');
    highlight = { start: 0, end: normalized.content.length };
  } else if (normalized.action === 'append') {
    const joiner = currentView.trim() ? '\n\n' : '';
    const start = currentView.length + joiner.length;
    nextView = currentView + joiner + normalized.content;
    highlight = { start: start, end: start + normalized.content.length };
  } else {
    nextView = normalized.content;
    highlight = { start: 0, end: normalized.content.length };
  }

  studioApplyViewChange(tab, nextView, highlight);
}


function studioBuildMiniButton(label, tone) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `studio-ai-mini-btn${tone ? ` ${tone}` : ''}`;
  btn.textContent = label;
  return btn;
}


function studioBuildAssistantMessage(payload) {
  const wrapper = document.createElement('div');

  const reply = document.createElement('div');
  reply.className = 'studio-ai-body';
  reply.innerHTML = _studioEscHtml(payload.reply || 'Atualizacao pronta.').replace(/\n/g, '<br>');
  wrapper.appendChild(reply);

  if (payload.references.length) {
    const refRow = document.createElement('div');
    refRow.className = 'studio-ai-chipline';
    payload.references.forEach(reference => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'studio-ai-ref';
      btn.textContent = `${reference.label} · ${reference.tab.toUpperCase()}`;
      btn.addEventListener('click', () => studioHighlightReference(reference));
      refRow.appendChild(btn);
    });
    wrapper.appendChild(refRow);
  }

  if (payload.edits.length) {
    const list = document.createElement('div');
    list.className = 'studio-ai-edit-list';
    payload.edits.forEach(edit => {
      const card = document.createElement('div');
      card.className = 'studio-ai-edit-card';

      const titleRow = document.createElement('div');
      titleRow.className = 'studio-ai-edit-head';

      const title = document.createElement('div');
      title.className = 'studio-ai-edit-title';
      title.textContent = edit.label || 'Mudanca sugerida';
      titleRow.appendChild(title);

      const badge = document.createElement('span');
      badge.className = 'studio-ai-badge';
      badge.textContent = `${edit.tab.toUpperCase()} · ${edit.action}`;
      titleRow.appendChild(badge);
      card.appendChild(titleRow);

      const preview = document.createElement('pre');
      preview.className = 'studio-ai-edit-preview';
      preview.textContent = (edit.content || '').slice(0, 480);
      card.appendChild(preview);

      const actions = document.createElement('div');
      actions.className = 'studio-ai-edit-actions';
      const reviewBtn = studioBuildMiniButton('Revisar');
      reviewBtn.addEventListener('click', () => {
        if (edit.target) {
          studioHighlightReference({ tab: edit.tab, snippet: edit.target, label: edit.label });
        } else if (_studio.selection && _studio.selection.tab === edit.tab) {
          studioHighlightRange(edit.tab, _studio.selection.start, _studio.selection.end);
        }
      });
      actions.appendChild(reviewBtn);

      const applyBtn = studioBuildMiniButton('Aplicar', 'is-primary');
      applyBtn.addEventListener('click', () => studioApplyAction(edit));
      actions.appendChild(applyBtn);
      card.appendChild(actions);

      list.appendChild(card);
    });
    wrapper.appendChild(list);
  }

  return wrapper;
}


function studioNormalizeReferences(references) {
  if (!Array.isArray(references)) return [];
  return references
    .map(reference => ({
      tab: studioNormalizeTab(reference && reference.tab ? reference.tab : _studio.currentTab),
      label: reference && reference.label ? reference.label : 'Trecho referenciado',
      snippet: reference && (reference.snippet || reference.target) ? (reference.snippet || reference.target) : '',
      selection: !!(reference && reference.selection),
    }))
    .filter(reference => reference.selection || reference.snippet);
}


function studioInferEditFromFence(response) {
  const fence = response.match(/```(html|css|js|javascript)?\s*([\s\S]*?)```/i);
  if (!fence) return null;
  const lang = (fence[1] || '').toLowerCase();
  if (lang === 'json') return null;

  const tab = studioNormalizeTab(lang || _studio.currentTab);
  const content = studioNormalizeText(fence[2] || '').trim();
  if (!content) return null;

  return {
    tab,
    action: tab === 'html' ? 'replace_all' : 'append',
    label: tab === 'html' ? 'Substituir visual atual' : `Adicionar ${tab.toUpperCase()}`,
    content,
  };
}


function studioParseAssistantPayload(response) {
  const normalized = studioNormalizeText(response);
  let payload = null;
  let replyText = normalized;
  const jsonRegex = /```json\s*([\s\S]*?)```/gi;
  let match;

  while ((match = jsonRegex.exec(normalized))) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (parsed && (parsed.reply || parsed.references || parsed.edits)) {
        payload = parsed;
        replyText = normalized.replace(match[0], '').trim();
        break;
      }
    } catch (_error) {
      // Ignore invalid JSON blocks from the model and keep parsing.
    }
  }

  const fallbackEdit = studioInferEditFromFence(replyText);
  const edits = Array.isArray(payload && payload.edits)
    ? payload.edits.map(studioNormalizeAction)
    : (fallbackEdit ? [studioNormalizeAction(fallbackEdit)] : []);
  const references = studioNormalizeReferences(payload && payload.references ? payload.references : []);
  const reply = (payload && payload.reply ? payload.reply : replyText.replace(/```(?:html|css|js|javascript)?[\s\S]*?```/i, '').trim()) || 'Atualizacao pronta.';

  return { reply, references, edits };
}

function studioSetMainSidebarHidden(hidden) {
  const sidebar = document.getElementById('sidebarEl') || document.querySelector('.sidebar');
  const expandBtn = document.getElementById('sidebarExpandBtn');
  const mobileOverlay = document.getElementById('mobileSidebarOverlay');

  if (hidden) {
    if (sidebar) {
      if (sidebar._stDisplay === undefined) sidebar._stDisplay = sidebar.style.display;
      sidebar.classList.remove('mobile-open');
      sidebar.style.display = 'none';
    }
    if (expandBtn) {
      if (expandBtn._stDisplay === undefined) expandBtn._stDisplay = expandBtn.style.display;
      expandBtn.style.display = 'none';
    }
    if (mobileOverlay) mobileOverlay.classList.remove('visible');
    return;
  }

  if (sidebar) {
    sidebar.style.display = sidebar._stDisplay !== undefined ? sidebar._stDisplay : '';
    delete sidebar._stDisplay;
  }
  if (expandBtn) {
    expandBtn.style.display = expandBtn._stDisplay !== undefined ? expandBtn._stDisplay : '';
    delete expandBtn._stDisplay;
  }
}

// Toggle the main sidebar ("trunk") visibility from within Studio
function studioToggleMainSidebar() {
  const sidebar = document.getElementById('sidebarEl') || document.querySelector('.sidebar');
  const expandBtn = document.getElementById('sidebarExpandBtn');
  const isHidden = !sidebar || sidebar.style.display === 'none';
  studioSetMainSidebarHidden(isHidden ? false : true);

  const trunkBtn = document.getElementById('studioSidebarBtn');
  if (trunkBtn) trunkBtn.classList.toggle('active', !isHidden);
}


// Keep the default preview template in sync with the active language.
// index.html's applyLang() sets document.documentElement.lang on every switch,
// so we watch that attribute and re-seed the document (only while it's still the
// unedited default) so the live preview reflects the new language immediately.
let _studioPreviewLangObserver = null;
let _studioPreviewLastLang = (document.documentElement && document.documentElement.lang) || 'en';
function studioWatchPreviewLanguage() {
  // Capture the language at first paint so we don't needlessly re-seed English->English.
  _studioPreviewLastLang = (document.documentElement && document.documentElement.lang) || 'en';

  if (_studioPreviewLangObserver) return;
  _studioPreviewLangObserver = new MutationObserver(function (mutations) {
    const lang = (document.documentElement && document.documentElement.lang) || 'en';
    if (lang === _studioPreviewLastLang) return;
    _studioPreviewLastLang = lang;
    // Only re-localize while the user hasn't edited away from the default template.
    if (!_studio.sourceIsDefault) return;
    studioSetDocumentSource(studioDefaultDocument(), { isDefault: true });
  });
  _studioPreviewLangObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['lang'],
  });
}

// Show studio view
function studioShowView() {
  const hide = ['chatHeader', 'welcomeState', 'chatLog', 'chatCompose', 'chatToolbar'];
  hide.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });

  // Collapse chat container so Studio becomes the active workspace pane.
  const mc = document.querySelector('.main-content');
  if (mc) {
    mc._stDisplay = mc.style.display;
    mc.style.display = 'none';
  }

  studioSetMainSidebarHidden(true);
  const trunkBtn = document.getElementById('studioSidebarBtn');
  if (trunkBtn) trunkBtn.classList.add('active');

  if (typeof aexHideMain === 'function') aexHideMain();
  ['listeningView', 'descobertaView', 'memoryView', 'spacesView', 'shadersView', 'mermaidView'].forEach(vid => {
    const viewEl = document.getElementById(vid);
    if (viewEl) viewEl.classList.remove('active');
  });

  const sv = document.getElementById('studioView');
  if (sv) {
    sv.style.display = '';
    sv.classList.add('active');
  }

  const op = document.getElementById('outputPanel');
  const bp = document.getElementById('browserPanel');
  if (op) { op._stPrevOpen = op.classList.contains('open'); op.classList.remove('open'); }
  if (bp) { bp._stPrevOpen = bp.classList.contains('open'); bp.classList.remove('open'); }

  studioInitSplitter();
  studioInitSideDrag();
  studioInitDropZone();   // ← Fix: initialize drop zone when view is shown

  const currentProjectId = _studioGetActiveProjectId();
  if (currentProjectId && (!_studioProject || _studioProject._projectId !== currentProjectId)) {
    studioLoadProjectFilesFromServer().then(() => {
      if (_studioProject && _studioProject.currentPage) {
        studioLoadPage(_studioProject.currentPage);
      }
    });
  }

  if (!_studioPanelContextListenerBound) {
    window.addEventListener('olivia:panel-context-updated', studioSyncAssistantContext);
    _studioPanelContextListenerBound = true;
  }
  studioEnsureEditorModel();
  studioRenderCurrentTab();
  studioUpdatePreview();
  studioWatchPreviewLanguage();   // re-localize the default template on language change
  studioBindPreviewAgentBridge();
  studioLoadConfig();
  studioSyncAssistantContext();
  studioUpdateSaveButtonState();
}

// Hide studio view
function studioHideView() {
  const sv = document.getElementById('studioView');
  if (sv) {
    sv.classList.remove('active');
    sv.style.display = '';
  }

  const mc = document.querySelector('.main-content');
  if (mc) {
    mc.style.display = mc._stDisplay !== undefined ? mc._stDisplay : '';
    delete mc._stDisplay;
  }

  studioSetMainSidebarHidden(false);

  const trunkBtn = document.getElementById('studioSidebarBtn');
  if (trunkBtn) trunkBtn.classList.remove('active');

  const show = ['chatHeader', 'welcomeState', 'chatLog', 'chatCompose', 'chatToolbar'];
  show.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = ''; });

  const op = document.getElementById('outputPanel');
  const bp = document.getElementById('browserPanel');
  if (op && op._stPrevOpen) op.classList.add('open');
  if (bp && bp._stPrevOpen) bp.classList.add('open');
}

// Initialize studio splitter
function studioInitSplitter() {
  const splitter = document.getElementById('studioSplitter');
  const left = document.getElementById('studioEditorPanel');
  const right = document.getElementById('studioPreviewPanel');
  if (!splitter || !left || !right || splitter.dataset.bound === 'true') return;

  let dragging = false;
  const minLeft = 200;
  const minRight = 200;

  splitter.addEventListener('mousedown', e => {
    dragging = true;
    splitter.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    const rect = splitter.parentNode.getBoundingClientRect();
    const percent = ((e.clientX - rect.left) / rect.width) * 100;
    const clamped = Math.max(minLeft / rect.width * 100, Math.min(percent, 100 - minRight / rect.width * 100));
    left.style.flexBasis = `${clamped}%`;
    right.style.flexBasis = `${100 - clamped}%`;
  });

  document.addEventListener('mouseup', () => {
    dragging = false;
    splitter.classList.remove('dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });

  splitter.dataset.bound = 'true';
}

// Initialize studio side drag panel
function studioInitSideDrag() {
  const handle = document.getElementById('studioSideDrag');
  const panel = document.getElementById('studioAiPanel');
  if (!handle || !panel || handle.dataset.bound === 'true') return;

  let dragging = false;
  let startX = 0;
  let startWidth = 0;
  const minWidth = 260;
  const maxWidth = 520;

  handle.addEventListener('mousedown', e => {
    dragging = true;
    handle.classList.add('dragging');
    startX = e.clientX;
    startWidth = panel.classList.contains('open') ? panel.offsetWidth : 340;
    panel.classList.add('open');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    const delta = startX - e.clientX;
    const nextWidth = Math.max(minWidth, Math.min(maxWidth, startWidth + delta));
    panel.style.width = `${nextWidth}px`;
    panel.style.minWidth = `${nextWidth}px`;
  });

  document.addEventListener('mouseup', () => {
    dragging = false;
    handle.classList.remove('dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });

  handle.dataset.bound = 'true';
}


function studioPreviewBaseHref() {
  try {
    return new URL('.', window.location.href).href;
  } catch (_err) {
    return '/';
  }
}


function studioPreviewBootstrapMarkup(baseHref) {
  const safeBase = String(baseHref || '/').replace(/"/g, '&quot;');
  return `<base href="${safeBase}">
<script>(function(){
  var PREVIEW_TAG = '[Studio Preview]';

  // Shim localStorage/sessionStorage when sandboxed without same-origin.
  try {
    // Accessing localStorage may throw in sandboxed frames without same-origin.
    void window.localStorage;
  } catch (_e) {
    try {
      window.localStorage = {
        getItem: function() { return null; },
        setItem: function() {},
        removeItem: function() {},
        clear: function() {}
      };
    } catch (_e2) {}
  }

  function resolveUrl(input){
    try { return new URL(String(input || ''), document.baseURI || window.location.href); }
    catch(_e) { return null; }
  }

  function shouldBlock(input){
    var raw = String(input || '').trim();
    if (!raw) return false;
    var lowerRaw = raw.toLowerCase();
    if (
      lowerRaw.indexOf('data:') === 0
      || lowerRaw.indexOf('blob:') === 0
      || lowerRaw.indexOf('javascript:') === 0
      || lowerRaw.indexOf('mailto:') === 0
      || lowerRaw.indexOf('tel:') === 0
      || lowerRaw.indexOf('#') === 0
    ) return false;
    if (lowerRaw.indexOf('null/') === 0) return true;
    if (lowerRaw.indexOf('/LA8159/null/') !== -1) return true;

    var abs = resolveUrl(raw);
    if (!abs) return lowerRaw.indexOf('api/') === 0 || lowerRaw.indexOf('/api/') === 0;

    var path = (abs.pathname || '').toLowerCase();
    // Block auth/login endpoints which often assume same-origin and access localStorage
    if (path.indexOf('/login') === 0) return true;
    if (path.indexOf('/api/') === 0) return true;
    if (path.indexOf('/LA8159/api/') === 0) return true;
    if (path.indexOf('/AURA-workspace/') !== -1) return true;
    return false;
  }

  function logBlocked(url){
    try { console.info(PREVIEW_TAG + ' blocked network call:', url); } catch(_e) {}
  }

  var originalFetch = window.fetch;
  if (typeof originalFetch === 'function') {
    window.fetch = function(input, init){
      var url = (typeof input === 'string') ? input : ((input && input.url) || '');
      if (shouldBlock(url)) {
        logBlocked(url);
        // Return a 204 No Content with no body to indicate blocked resource
        return Promise.resolve(new Response(null, {
          status: 204,
          headers: { 'Content-Type': 'application/json' }
        }));
      }
      return originalFetch.call(this, input, init);
    };
  }

  var OriginalXHR = window.XMLHttpRequest;
  if (typeof OriginalXHR === 'function') {
    var origOpen = OriginalXHR.prototype.open;
    var origSend = OriginalXHR.prototype.send;

    OriginalXHR.prototype.open = function(method, url){
      this.__studioBlockedUrl = shouldBlock(url) ? String(url || '') : '';
      if (this.__studioBlockedUrl) return;
      return origOpen.apply(this, arguments);
    };

    OriginalXHR.prototype.send = function(){
      if (!this.__studioBlockedUrl) return origSend.apply(this, arguments);
      logBlocked(this.__studioBlockedUrl);
      var xhr = this;
      setTimeout(function(){
        try { if (typeof xhr.onreadystatechange === 'function') xhr.onreadystatechange(); } catch(_e) {}
        try { if (typeof xhr.onload === 'function') xhr.onload(); } catch(_e) {}
      }, 0);
    };
  }
})();</script>`;
}


// Fix: updated preview builder that does not delete unresolved external scripts
function studioBuildPreviewDocument(source) {
  if (!_studioProject || !_studioProject.currentPage) {
    return studioBuildPreviewDocumentFallback(source);
  }

  const currentPage = _studioProject.currentPage;
  const baseDir = currentPage.substring(0, currentPage.lastIndexOf('/') + 1);
  let html = studioNormalizeText(source || _studio.documentSource);

  // 1. Inline stylesheets that exist in the project
  html = html.replace(/<link\b[^>]*\brel=["']?stylesheet["']?[^>]*>/gi, match => {
    const href = match.match(/href=["']([^"']+)["']/);
    if (!href) return match;
    const url = href[1];
    if (url.startsWith('http') || url.startsWith('//') || url.startsWith('data:')) return match;
    const resolvedPath = studioResolvePath(baseDir, url);
    const cssContent = _studioProject.files.get(resolvedPath);
    return cssContent ? `<style>/* ${url} */\n${cssContent}\n</style>` : match;
  });

  // 2. Inline scripts that exist; keep original if not found (fix: no double‑strip)
  const _inlinedScripts = [];
  html = html.replace(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>\s*<\/script>/gi, (match) => {
    // Capture attributes so we can preserve things like type="module"
    const m = match.match(/<script\b([^>]*)\bsrc=["']([^"']+)["']([^>]*)>\s*<\/script>/i);
    if (!m) return match;
    const before = (m[1] || '') + (m[3] || '');
    const src = m[2] || '';
    if (src.startsWith('http') || src.startsWith('//') || src.startsWith('data:')) return match;
    const resolvedPath = studioResolvePath(baseDir, src);
    const jsContent = _studioProject.files.get(resolvedPath);
    if (!jsContent) return match;
    // If the file contains NUL bytes, treat as non-text (binary) and do not inline
    if (/\x00/.test(jsContent)) {
      console.warn('[Studio Preview] Skipping inlining binary script:', resolvedPath);
      return match;
    }
    // Avoid inlining extremely large scripts or scripts that begin with a BOM
    // which can produce "Invalid or unexpected token" when injected into
    // an about:srcdoc. If the content is over 200KB or starts with U+FEFF,
    // keep the external script reference instead.
    if (jsContent.length > 200 * 1024 || (jsContent.length && jsContent.charCodeAt(0) === 0xFEFF)) {
      console.warn('[Studio Preview] Not inlining large or BOM script:', resolvedPath, 'size=', jsContent.length);
      return match;
    }
    const attrs = before.trim() ? ' ' + before.trim() : '';
    // Escape closing </script> sequences to avoid prematurely terminating
    // the injected script when used inside about:srcdoc. Also wrap with
    // a lightweight CDATA-style fence to reduce accidental HTML parsing.
    const safeJs = String(jsContent).replace(/<\/script>/gi, '<\\/script>');
    _inlinedScripts.push({ path: resolvedPath, length: jsContent.length });
    return `<script${attrs}>/* ${src} */\n//<![CDATA[\n${safeJs}\n//]]>\n</script>`;
  });

  // 3. Images (simplified – for now we ignore binary data, just keep original)
  //    If we later store base64, we can inject data URIs.

  // 4. Inject bootstrap (network blocker)
  const bootstrap = studioPreviewBootstrapMarkup(studioPreviewBaseHref());
  let finalHtml;
  if (/<head\b[^>]*>/i.test(html)) {
    finalHtml = html.replace(/<head\b[^>]*>/i, match => match + '\n' + bootstrap + '\n');
  } else {
    finalHtml = bootstrap + '\n' + html;
  }

  if (!/^\s*<!doctype/i.test(finalHtml)) {
    finalHtml = '<!doctype html>\n' + finalHtml;
  }

  if (_inlinedScripts.length) {
    try {
      console.debug('[Studio Preview] inlined scripts:', _inlinedScripts.map(s => `${s.path} (${s.length} chars)`));
    } catch (_e) {}
  }

  return finalHtml;
}

// Backwards-compatible inline handlers for textarea attributes in index.html
function studioOnCodeInput() {
  try { studioCommitEditorToSource(); } catch (_e) {}
  try { studioUpdatePreview(); } catch (_e) {}
}

function studioOnCodeSelectionChange() {
  try { studioHandleEditorSelectionChange(); } catch (_e) {}
}

function studioOnCodeScroll() {
  // no-op for now; keep for inline handler compatibility
}

function studioOnCodeKeyDown(e) {
  try {
    if (!e) return;
    // Tab handling
    if (e.key === 'Tab') {
      const editor = studioGetEditor();
      if (!editor) return;
      e.preventDefault();
      const start = editor.selectionStart || 0;
      const end = editor.selectionEnd || 0;
      const value = editor.value;
      const before = value.slice(0, start);
      const after = value.slice(end);
      const insert = '  ';
      editor.value = before + insert + after;
      editor.setSelectionRange(start + insert.length, start + insert.length);
      studioOnCodeInput();
      return;
    }
    // Ctrl/Cmd+S => save
    if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      try { studioSaveCurrentFile(); } catch (_e) {}
    }
  } catch (_e) {}
}

// Update preview iframe
function studioUpdatePreview() {
  const preview = document.getElementById('studioPreviewFrame');
  if (!preview) return;
  try {
    preview.onload = function () {
      studioBindPreviewSelection(preview);
    };
    preview.srcdoc = studioBuildPreviewDocument(_studio.documentSource || STUDIO_DEFAULT_DOCUMENT);
  } catch (e) {
    console.error('Preview update error:', e);
  }
}

// Bridge: let the live preview act as an interaction point with the user/agent.
let _studioPreviewBridgeBound = false;
function studioBindPreviewAgentBridge() {
  if (_studioPreviewBridgeBound) return;
  _studioPreviewBridgeBound = true;

  window.addEventListener('message', function (e) {
    const d = e.data || {};
    if (d.type !== 'olivia-user-prompt' || typeof d.text !== 'string') return;

    const text = d.text.trim();
    if (!text) return;

    const aiInput = document.getElementById('studioAiInput');
    const preview = document.getElementById('studioPreviewFrame');

    function pushToPreview(replyText) {
      try {
        if (preview && preview.contentWindow) {
          preview.contentWindow.postMessage({ type: 'olivia-agent-message', text: String(replyText) }, '*');
        }
      } catch (_err) { /* cross-origin silence */ }
    }

    if (aiInput && typeof studioSendAiMsg === 'function') {
      aiInput.value = text;
      aiInput.focus();
      pushToPreview('📨 ' + text);
      studioSendAiMsg();
      const msgs = document.getElementById('studioAiMessages');
      if (msgs && !msgs.__studioPreviewObserver) {
        msgs.__studioPreviewObserver = true;
        const obs = new MutationObserver(function (mutations) {
          mutations.forEach(function (m) {
            Array.prototype.forEach.call(m.addedNodes || [], function (node) {
              if (node && node.nodeType === 1 && node.classList && node.classList.contains('assistant')) {
                pushToPreview((node.textContent || '').trim());
              }
            });
          });
        });
        obs.observe(msgs, { childList: true });
      }
    } else {
      pushToPreview('Olivia received: "' + text + '". Assistant panel unavailable in this view.');
    }
  });
}

// Load studio config
async function studioLoadConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem('OliviaLegal.studio.config') || '{}');
    await studioEnsureProviderModels();
    await studioSelectProvider(saved.ai_provider || 'deepseek', saved.ai_model);
    try {
      const keys = JSON.parse(localStorage.getItem('OliviaLegal.api.keys') || '{}');
      const provider = saved.ai_provider || 'deepseek';
      const keyInput = document.getElementById('studioApiKeyInput');
      if (keyInput) keyInput.value = keys[provider] || keys.cfgApiKey || '';
    } catch (e) { }
  } catch (e) {
    console.warn('Failed to load studio config:', e);
  }
}

// Save studio config
function studioSaveCfg() {
  const modelSel = document.getElementById('studioModelSelect');
  const provCard = document.querySelector('.studio-provider-card.active');
  const apiKeyInput = document.getElementById('studioApiKeyInput');
  const provider = provCard ? provCard.dataset.sprovider : 'deepseek';
  if (provider === 'ollama' && (!modelSel || !modelSel.value)) {
    alert('Nenhum modelo Ollama foi encontrado em http://0.0.0.0:12434/v1/models, http://0.0.0.0:12435/v1/models ou http://0.0.0.0:12436/v1/models.');
    return;
  }
  const cfg = {
    ai_model: modelSel ? modelSel.value : 'deepseek-v4-pro',
    ai_provider: provider
  };
  localStorage.setItem('OliviaLegal.studio.config', JSON.stringify(cfg));

  if (apiKeyInput && apiKeyInput.value.trim()) {
    try {
      const keys = JSON.parse(localStorage.getItem('OliviaLegal.api.keys') || '{}');
      keys[provider] = apiKeyInput.value.trim();
      keys.cfgApiKey = apiKeyInput.value.trim();
      localStorage.setItem('OliviaLegal.api.keys', JSON.stringify(keys));
    } catch (e) { }
  }

  const saveBtn = document.querySelector('#studioCfgModal .studio-modal-footer .btn:last-child');
  if (saveBtn) {
    const origHtml = saveBtn.innerHTML;
    saveBtn.innerHTML = '<i class="fas fa-check-circle"></i> Salvo!';
    saveBtn.style.color = 'var(--green)';
    saveBtn.style.borderColor = 'var(--green)';
    setTimeout(() => {
      saveBtn.innerHTML = origHtml;
      saveBtn.style.color = '';
      saveBtn.style.borderColor = '';
      studioCloseCfgModal();
    }, 900);
  } else {
    studioCloseCfgModal();
  }
}

// Set studio mode
function studioSetMode(mode) {
  const shell = document.getElementById('studioPreviewShell');
  const modeBtns = document.querySelectorAll('.studio-mode-btn');
  modeBtns.forEach(btn => btn.classList.toggle('active', (btn.title || '').toLowerCase() === mode));
  if (shell) {
    shell.classList.remove('mobile', 'tablet', 'desktop');
    shell.classList.add(mode);
  }
  _studio.currentMode = mode;
}

// Toggle studio panel
function studioTogglePanel(name) {
  const idMap = { editor: 'studioEditorPanel', preview: 'studioPreviewPanel' };
  const stripMap = { editor: 'studioEditorStrip', preview: 'studioPreviewStrip' };
  const panelId = idMap[name] || name;
  const stripId = stripMap[name];
  const panel = document.getElementById(panelId);
  const strip = stripId ? document.getElementById(stripId) : null;
  if (!panel) return;
  const hidden = panel.classList.toggle('s-hidden');
  if (strip) strip.classList.toggle('visible', hidden);
  const ep = document.getElementById('studioEditorPanel');
  const pp = document.getElementById('studioPreviewPanel');
  const sp = document.getElementById('studioSplitter');
  if (sp) sp.classList.toggle('s-solo', !!(ep && ep.classList.contains('s-hidden') && pp && pp.classList.contains('s-hidden')));
}

// Toggle AI panel
function studioToggleAiPanel() {
  const panel = document.getElementById('studioAiPanel');
  const btn = document.getElementById('studioAiFabBtn');
  if (!panel) return;
  const open = panel.classList.toggle('open');
  if (!open) {
    panel.style.width = '';
    panel.style.minWidth = '';
  }
  if (btn) btn.classList.toggle('active', open);
}

// Switch studio tab
function studioSwitchTab(el, tab, options) {
  studioEnsureEditorModel();
  if (!(options && options.skipCommit)) studioCommitEditorToSource();
  _studio.currentTab = studioNormalizeTab(tab);
  if (el && el.classList) {
    document.querySelectorAll('.studio-tab-btn').forEach(btn => btn.classList.remove('active'));
    el.classList.add('active');
  }
  studioRenderCurrentTab();
}

// Format code
function studioFormatCode() {
  studioEnsureEditorModel();
  const editor = studioGetEditor();
  if (!editor) return;

  let formatted = studioNormalizeText(editor.value);
  if (_studio.currentTab === 'html') {
    formatted = formatted.replace(/></g, '>\n<').replace(/\n{3,}/g, '\n\n').trim();
  } else {
    formatted = formatted.replace(/[ \t]+\n/g, '\n').trim();
  }

  editor.value = formatted;
  studioCommitEditorToSource();
  studioRenderCurrentTab();
}

// Apply code from AI suggestion
function studioApplyCode(code) {
  studioEnsureEditorModel();
  studioApplyAction({
    tab: _studio.currentTab,
    action: _studio.currentTab === 'html' ? 'replace_all' : 'append',
    label: 'Aplicar sugestao direta',
    content: studioNormalizeText(code || ''),
  });
}

// Refresh preview
function studioRefreshPreview() {
  studioCommitEditorToSource();
  studioUpdatePreview();
}

// Reset code
function studioResetCode() {
  if (!confirm('Reset codigo para template padrao?')) return;
  _studio.currentTab = 'html';
  studioSetDocumentSource(studioDefaultDocument(), { isDefault: true });
}

// Insert component
function studioInsertComponent(name) {
  studioEnsureEditorModel();
  if (_studio.currentTab !== 'html') studioSwitchTab(null, 'html');
  const editor = studioGetEditor();
  if (!editor) return;

  const components = {
    button: '<button class="btn" onclick="alert(\'Clicked!\')">Click me</button>',
    card: '<div class="card">\n  <h3>Card Title</h3>\n  <p>Card content goes here.</p>\n</div>',
    nav: '<nav>\n  <a href="#">Home</a>\n  <a href="#">About</a>\n  <a href="#">Contact</a>\n</nav>',
    form: '<form>\n  <label>Name: <input type="text" name="name" placeholder="Name"></label>\n  <label>Email: <input type="email" name="email" placeholder="Email"></label>\n  <button type="submit">Submit</button>\n</form>',
    table: '<table>\n  <thead><tr><th>Header 1</th><th>Header 2</th></tr></thead>\n  <tbody><tr><td>Cell 1</td><td>Cell 2</td></tr></tbody>\n</table>'
  };

  const component = components[name] || `<!-- ${name} component -->`;
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  editor.value = editor.value.slice(0, start) + component + editor.value.slice(end);
  editor.setSelectionRange(start, start + component.length);
  studioCommitEditorToSource();
  studioHandleEditorSelectionChange();
}

// Load template
function studioLoadTemplate(name) {
  const templates = {
    blank: '<!DOCTYPE html>\n<html>\n<head>\n  <meta charset="UTF-8">\n  <title>New Project</title>\n  <style>\n    body { margin: 0; padding: 20px; font-family: sans-serif; }\n  </style>\n</head>\n<body>\n  <!-- Your content here -->\n</body>\n</html>',
    dashboard: '<!DOCTYPE html>\n<html>\n<head>\n  <meta charset="UTF-8">\n  <title>Dashboard</title>\n  <style>\n    body { margin: 0; font-family: sans-serif; }\n    .sidebar { width: 200px; background: #333; color: white; height: 100vh; float: left; }\n    .content { margin-left: 200px; padding: 20px; }\n  </style>\n</head>\n<body>\n  <div class="sidebar">\n    <h3>Dashboard</h3>\n    <ul>\n      <li>Home</li>\n      <li>Analytics</li>\n      <li>Settings</li>\n    </ul>\n  </div>\n  <div class="content">\n    <h1>Welcome</h1>\n    <p>Dashboard content.</p>\n  </div>\n</body>\n</html>',
    landing: '<!DOCTYPE html>\n<html>\n<head>\n  <meta charset="UTF-8">\n  <title>Landing Page</title>\n  <style>\n    body { margin: 0; font-family: Arial, sans-serif; }\n    .hero { background: #007bff; color: white; padding: 60px 20px; text-align: center; }\n    .features { display: flex; padding: 40px 20px; }\n    .feature { flex: 1; padding: 20px; }\n  </style>\n</head>\n<body>\n  <div class="hero">\n    <h1>Welcome to Our Product</h1>\n    <p>A short description here.</p>\n    <button>Get Started</button>\n  </div>\n  <div class="features">\n    <div class="feature">\n      <h3>Feature 1</h3>\n      <p>Description.</p>\n    </div>\n    <div class="feature">\n      <h3>Feature 2</h3>\n      <p>Description.</p>\n    </div>\n  </div>\n</body>\n</html>'
  };

  if (templates[name]) {
    _studio.currentTab = 'html';
    studioSetDocumentSource(templates[name]);
  }
}

// Select AI provider
async function studioSelectProvider(el, preferredModel) {
  const provider = (el && el.dataset) ? el.dataset.sprovider : el;
  document.querySelectorAll('.studio-provider-card').forEach(card => card.classList.toggle('active', card.dataset.sprovider === provider));
  await studioEnsureProviderModels();
  studioPopulateModelSelect(provider, preferredModel);

  const keyInput = document.getElementById('studioApiKeyInput');
  try {
    const keys = JSON.parse(localStorage.getItem('OliviaLegal.api.keys') || '{}');
    if (keyInput) keyInput.value = keys[provider] || keys.cfgApiKey || '';
  } catch (e) { }
}

// Close config modal
function studioCloseCfgModal() {
  const m = document.getElementById('studioCfgModal');
  const o = document.getElementById('studioCfgOverlay');
  if (m) m.classList.remove('open');
  if (o) o.classList.remove('open');
}

// Open config modal
function studioOpenCfgModal() {
  const m = document.getElementById('studioCfgModal');
  const o = document.getElementById('studioCfgOverlay');
  if (m) m.classList.add('open');
  if (o) o.classList.add('open');
  studioLoadConfig();
}

// AI keydown handler
function studioAiKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    studioSendAiMsg();
  }
}

// Send AI message
async function studioSendAiMsg() {
  studioEnsureEditorModel();
  studioCommitEditorToSource();

  const input = document.getElementById('studioAiInput');
  const prompt = input ? input.value.trim() : '';
  if (!prompt) return;
  _studioAddAiMsg(_studioEscHtml(prompt), 'user');
  input.value = '';

  const useCtx = document.getElementById('studioOptCtx') && document.getElementById('studioOptCtx').classList.contains('active');
  const panelContext = _studioGetPanelContextData();
  const context = {
    activeTab: _studio.currentTab,
    currentView: useCtx && _studio.viewState ? studioGetViewContent(_studio.viewState, _studio.currentTab) : '',
    fullDocument: useCtx ? _studio.documentSource : '',
    selection: studioGetSelectionContext(),
    panelContextText: panelContext.text || '',
  };

  const loader = document.createElement('div');
  loader.className = 'studio-ai-msg assistant';
  loader.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gerando...';
  document.getElementById('studioAiMessages').appendChild(loader);
  document.getElementById('studioAiMessages').scrollTop = 99999;

  try {
    const response = await _studioCallLLM(prompt, context);
    loader.remove();

    const payload = studioParseAssistantPayload(response);
    _studioAddAiMsg(studioBuildAssistantMessage(payload), 'assistant');

    _studio.conversationHistory.push(
      { role: 'user', content: prompt },
      { role: 'assistant', content: response }
    );
  } catch (err) {
    loader.remove();
    _studioAddAiMsg(`<i class="fas fa-exclamation-triangle" style="color:var(--red)"></i> ${_studioEscHtml(err.message)}`, 'system');
  }
}

// Internal: Add AI message
function _studioAddAiMsg(content, role) {
  const container = document.getElementById('studioAiMessages');
  if (!container) return null;

  const msg = document.createElement('div');
  msg.className = `studio-ai-msg ${role}`;
  if (content instanceof Node) msg.appendChild(content);
  else msg.innerHTML = content;
  container.appendChild(msg);
  container.scrollTop = container.scrollHeight;
  return msg;
}

// Internal: Call LLM
async function _studioCallLLM(prompt, context) {
  const sectionCtx = (typeof window.LA8159ResolveSectionAgentContext === 'function')
    ? window.LA8159ResolveSectionAgentContext('studio')
    : null;

  if (sectionCtx && sectionCtx.assigned && !sectionCtx.active) {
    const inactiveName = sectionCtx.agent ? (sectionCtx.agent.name || sectionCtx.agent.agent_id) : sectionCtx.agentId;
    throw new Error(`Agent assigned to Studio is inactive: ${inactiveName}. Activate it in Agents tab.`);
  }

  const system = [
    'You are LA8159 Studio, a precise HTML, CSS, and JavaScript editing assistant.',
    'The editor has three views: html, css, and js.',
    'When suggesting actionable changes, include exactly one ```json``` block with the keys reply, references, and edits.',
    'references must be an array of objects: { tab, label, snippet } using exact snippets from the provided context whenever possible.',
    'edits must be an array of objects: { tab, label, action, target, content }.',
    'Allowed edit actions are replace_selection, replace_snippet, replace_all, append, prepend, insert_before, and insert_after.',
    'Use replace_selection only if a user selection is provided in the prompt.',
    'If the request is CSS-only or JS-only, put the edit in the css or js tab instead of rewriting the whole document.',
    'Keep reply concise, practical, and aligned with the requested change.',
    'Do not include Markdown outside the reply text except the required JSON block.'
  ].join(' ');

  const chunks = [
    `Active tab: ${context.activeTab.toUpperCase()}`,
  ];

  if (context.selection) {
    const tabLabel = studioNormalizeTab(context.selection.tab || context.activeTab).toUpperCase();
    const hasRange = Number.isFinite(context.selection.start)
      && Number.isFinite(context.selection.end)
      && context.selection.end > context.selection.start;
    if (hasRange) {
      chunks.push(`Current selection in ${tabLabel} (${context.selection.start}-${context.selection.end}):\n${context.selection.text}`);
    } else {
      const sourceLabel = context.selection.source === 'preview' ? 'preview' : 'editor';
      chunks.push(`Current selection from ${sourceLabel} in ${tabLabel}:\n${context.selection.text}`);
    }
  } else {
    chunks.push('No active selection.');
  }

  if (context.currentView) {
    chunks.push(`Current ${context.activeTab.toUpperCase()} view:\n${context.currentView}`);
  }

  if (context.fullDocument) {
    chunks.push(`Full document:\n${context.fullDocument}`);
  }

  if (context.panelContextText) {
    chunks.push(`Panel context from Browser/Preview/Output:\n${context.panelContextText.trim()}`);
  }

  chunks.push(`User request: ${prompt}`);

  const message = chunks.join('\n\n');
  const modelSel = document.getElementById('studioModelSelect');
  const model = (modelSel && modelSel.value) ? modelSel.value : 'deepseek-v4-pro';

  const combinedSystem = [
    system,
    sectionCtx && sectionCtx.system ? sectionCtx.system : ''
  ].filter(Boolean).join('\n\n');

  const assistantOpts = {
    model,
    system: combinedSystem,
    history: _studio.conversationHistory.slice(-6),
    sessionKey: sectionCtx && sectionCtx.sessionKey ? sectionCtx.sessionKey : 'section:studio:default',
  };
  if (sectionCtx && sectionCtx.agentId) assistantOpts.agentId = sectionCtx.agentId;
  if (typeof getCurrentProjectId === 'function') {
    const projectId = getCurrentProjectId();
    if (projectId) assistantOpts.projectId = projectId;
  }

  return LA8159API.assistant.chat(message, assistantOpts);
}

// Internal: Escape HTML
function _studioEscHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function studioExtractMessageText(messageEl) {
  if (!messageEl) return '';
  const clone = messageEl.cloneNode(true);
  clone.querySelectorAll('button, .studio-ai-edit-actions, i').forEach(node => node.remove());
  return (clone.innerText || clone.textContent || '')
    .replace(/\r\n?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function studioCollectConversationEntries() {
  const container = document.getElementById('studioAiMessages');
  if (!container) return [];

  const entries = [];
  container.querySelectorAll('.studio-ai-msg').forEach((msgEl, index) => {
    let role = 'assistant';
    if (msgEl.classList.contains('user')) role = 'user';
    else if (msgEl.classList.contains('system')) role = 'system';

    const text = studioExtractMessageText(msgEl);
    if (!text) return;

    entries.push({
      idx: index + 1,
      role,
      text,
    });
  });

  return entries;
}

function studioConversationMarkdown(entries, meta) {
  const lines = [];
  lines.push('# Conversa do Studio Assistant');
  lines.push('');
  lines.push(`- Data: ${meta.savedAt}`);
  lines.push(`- Provider: ${meta.provider}`);
  lines.push(`- Modelo: ${meta.model}`);
  lines.push(`- Mensagens: ${entries.length}`);
  lines.push('');

  entries.forEach(entry => {
    const roleLabel = entry.role === 'user'
      ? 'Usuario'
      : (entry.role === 'system' ? 'Sistema' : 'Assistente');
    lines.push(`## ${entry.idx}. ${roleLabel}`);
    lines.push('');
    lines.push(entry.text);
    lines.push('');
  });

  return lines.join('\n');
}

function studioDownloadBlob(content, mimeType, fileName) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

function studioMarkSaveButtonSaved(buttonId, labelHtml) {
  const button = document.getElementById(buttonId);
  if (!button) return;

  const previousHtml = button.innerHTML;
  button.classList.add('saved');
  button.innerHTML = labelHtml;
  setTimeout(() => {
    button.classList.remove('saved');
    button.innerHTML = previousHtml;
  }, 1000);
}

function studioBuildConversationPayload() {
  const entries = studioCollectConversationEntries();
  if (!entries.length) return null;

  const modelSel = document.getElementById('studioModelSelect');
  const provCard = document.querySelector('.studio-provider-card.active');
  const provider = provCard ? provCard.dataset.sprovider : 'deepseek';
  const model = (modelSel && modelSel.value) ? modelSel.value : 'deepseek-v4-pro';
  const now = new Date();
  const safeStamp = now.toISOString().replace(/[:]/g, '-').replace(/\..+$/, '');
  const humanStamp = now.toLocaleString('pt-BR');

  const payload = {
    savedAt: now.toISOString(),
    provider,
    model,
    entries,
    history: (_studio.conversationHistory || []).slice(),
  };

  try {
    localStorage.setItem('OliviaLegal.studio.lastAssistantConversation', JSON.stringify(payload));
  } catch (e) {
    console.warn('Failed to cache studio conversation:', e);
  }

  return { payload, safeStamp, humanStamp };
}

function studioSaveAssistantConversation() {
  const built = studioBuildConversationPayload();
  if (!built) {
    alert('Nao ha conversa para salvar ainda.');
    return;
  }

  const payload = built.payload;

  const markdown = studioConversationMarkdown(payload.entries, {
    savedAt: built.humanStamp,
    provider: payload.provider,
    model: payload.model,
  });

  studioDownloadBlob(
    markdown,
    'text/markdown;charset=utf-8',
    `studio_assistente_conversa_${built.safeStamp}.md`
  );

  studioMarkSaveButtonSaved('studioAiSaveBtn', '<i class="fas fa-check"></i> Salvo');
}

function studioSaveAssistantConversationJson() {
  const built = studioBuildConversationPayload();
  if (!built) {
    alert('Nao ha conversa para salvar ainda.');
    return;
  }

  const jsonText = JSON.stringify(built.payload, null, 2);
  studioDownloadBlob(
    jsonText,
    'application/json;charset=utf-8',
    `studio_assistente_conversa_${built.safeStamp}.json`
  );

  studioMarkSaveButtonSaved('studioAiSaveJsonBtn', '<i class="fas fa-check"></i> JSON');
}

function studioImportAssistantConversationJson() {
  const input = document.getElementById('studioAiImportJsonInput');
  if (input) input.click();
}

function studioNormalizeImportedEntries(rawEntries) {
  if (!Array.isArray(rawEntries)) return [];

  return rawEntries
    .map((entry, index) => {
      const role = entry && (entry.role === 'user' || entry.role === 'assistant' || entry.role === 'system')
        ? entry.role
        : 'assistant';
      const text = studioNormalizeText(entry && (entry.text || entry.content) ? (entry.text || entry.content) : '').trim();
      if (!text) return null;
      return {
        idx: index + 1,
        role,
        text,
      };
    })
    .filter(Boolean);
}

function studioRenderImportedConversation(entries) {
  const container = document.getElementById('studioAiMessages');
  if (!container) return;

  container.innerHTML = '';
  entries.forEach(entry => {
    _studioAddAiMsg(_studioEscHtml(entry.text).replace(/\n/g, '<br>'), entry.role);
  });
}

function studioBuildHistoryFromEntries(entries) {
  return entries
    .filter(entry => entry.role === 'user' || entry.role === 'assistant')
    .map(entry => ({ role: entry.role, content: entry.text }));
}

function studioNormalizeImportedHistory(rawHistory) {
  if (!Array.isArray(rawHistory)) return [];
  return rawHistory
    .map(item => {
      if (!item || (item.role !== 'user' && item.role !== 'assistant')) return null;
      const content = studioNormalizeText(item.content || '').trim();
      if (!content) return null;
      return { role: item.role, content };
    })
    .filter(Boolean);
}

function studioHandleAssistantConversationImport(input) {
  const file = input && input.files ? input.files[0] : null;
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const parsed = JSON.parse(String((e && e.target && e.target.result) || '{}'));
      const rawEntries = Array.isArray(parsed)
        ? parsed
        : (Array.isArray(parsed.entries) ? parsed.entries : []);

      const entries = studioNormalizeImportedEntries(rawEntries);
      if (!entries.length) {
        throw new Error('Arquivo JSON sem mensagens validas em entries.');
      }

      studioRenderImportedConversation(entries);

      const importedHistory = studioNormalizeImportedHistory(parsed && parsed.history);
      _studio.conversationHistory = importedHistory.length ? importedHistory : studioBuildHistoryFromEntries(entries);

      const metadata = [];
      if (parsed && parsed.provider) metadata.push(`Provider: ${parsed.provider}`);
      if (parsed && parsed.model) metadata.push(`Modelo: ${parsed.model}`);
      if (parsed && parsed.savedAt) metadata.push(`Salvo: ${parsed.savedAt}`);

      const statusText = metadata.length
        ? `Conversa JSON importada com sucesso. ${metadata.join(' | ')}`
        : 'Conversa JSON importada com sucesso.';
      _studioAddAiMsg(`<i class="fas fa-check-circle" style="color:var(--green)"></i> ${_studioEscHtml(statusText)}`, 'system');

      studioMarkSaveButtonSaved('studioAiImportJsonBtn', '<i class="fas fa-check"></i> Importado');
    } catch (err) {
      alert(`Falha ao importar JSON: ${err && err.message ? err.message : 'formato invalido'}`);
    } finally {
      input.value = '';
    }
  };

  reader.onerror = function () {
    alert('Falha ao ler o arquivo JSON.');
    input.value = '';
  };

  reader.readAsText(file);
}

// Download HTML
function studioDownloadHtml() {
  studioCommitEditorToSource();
  const blob = new Blob([_studio.documentSource || STUDIO_DEFAULT_DOCUMENT], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `studio_project_${new Date().toISOString().slice(0, 10)}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

// Import file
function studioImportFile() {
  const input = document.getElementById('studioFileInput');
  if (input) input.click();
}

function studioHandleImport(input) {
  const file = input.files[0];
  if (!file || !file.name.endsWith('.html')) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    _studio.currentTab = 'html';
    if (e.target.result) {
      studioSetDocumentSource(e.target.result);
    } else {
      studioSetDocumentSource(studioDefaultDocument(), { isDefault: true });
    }
  };
  reader.readAsText(file);
  input.value = '';
}

// ====================== MULTI‑FILE PROJECT IMPORT ======================

function _studioGetActiveProjectId() {
  if (typeof getCurrentProjectId === 'function') {
    return String(getCurrentProjectId() || '').trim() || null;
  }
  return null;
}

function _studioIsHiddenPath(path) {
  if (!path) return false;
  return path.split(/[\/]/).some(segment => segment.startsWith('.') || segment === '__MACOSX');
}

async function _studioUploadFileToProject(relativePath, fileOrBlob, projectId) {
  if (!projectId) throw new Error('Project ID is required');
  if (_studioIsHiddenPath(relativePath)) return;

  const url = `${API_BASE}/api/projects/${encodeURIComponent(projectId)}/upload?section=studio_files&preserve_paths=true`;
  const form = new FormData();
  const payload = (fileOrBlob instanceof Blob) ? fileOrBlob : new Blob([fileOrBlob], { type: 'text/plain' });
  form.append('file', payload, relativePath);

  const response = await fetch(url, {
    method: 'POST',
    body: form
  });
  if (!response.ok) {
    throw new Error(`Upload failed for ${relativePath}: ${response.status} ${response.statusText}`);
  }
}

async function _studioFetchProjectFile(projectId, filePath) {
  if (!projectId) throw new Error('Project ID is required');
  const url = `${API_BASE}/api/projects/${encodeURIComponent(projectId)}/raw?path=${encodeURIComponent(filePath)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Fetch failed for ${filePath}: ${res.status} ${res.statusText}`);
  }
  return res.text();
}

function studioImportProject(projectId) {
  const input = document.getElementById('studioProjectInput');
  if (!input) return;
  if (projectId) {
    input.dataset.targetProjectId = String(projectId);
  } else {
    delete input.dataset.targetProjectId;
  }
  input.click();
}

async function studioHandleProjectImport(input) {
  const files = Array.from(input.files || []);
  if (!files.length) return;

  const projectId = String(input.dataset.targetProjectId || _studioGetActiveProjectId() || '').trim() || null;
  if (!projectId) {
    alert('Nenhum projeto ativo. Ative um projeto primeiro.');
    input.value = '';
    delete input.dataset.targetProjectId;
    return;
  }

  const zipFile = files.find(f => f.name.toLowerCase().endsWith('.zip'));
  if (zipFile) {
    await studioLoadProjectFromZip(zipFile, projectId);
    input.value = '';
    delete input.dataset.targetProjectId;
    return;
  }

  await studioLoadProjectFromFiles(files, projectId);
  input.value = '';
  delete input.dataset.targetProjectId;
}

// New project – fix #6: clear project state
function studioNewProject() {
  if (!confirm('Start new project? Unsaved changes will be lost.')) return;
  _studio.conversationHistory = [];
  _studioProject = null;
  const pageSelect = document.getElementById('studioPageSelect');
  if (pageSelect) {
    pageSelect.innerHTML = '<option>Carregue um projeto</option>';
  }
  _studio.currentTab = 'html';
  studioSetDocumentSource(studioDefaultDocument(), { isDefault: true });
  const container = document.getElementById('studioAiMessages');
  if (container) {
    container.innerHTML = '<div class="studio-ai-msg system"><i class="fas fa-lightbulb"></i> Posso editar HTML, CSS e JS por seccao. Selecione um trecho no editor para enviar esse contexto ao assistente.</div>';
  }
  studioUpdateSaveButtonState();
}

function studioFocusSelection() {
  if (_studio.selection) {
    if (Number.isFinite(_studio.selection.start) && Number.isFinite(_studio.selection.end) && _studio.selection.end > _studio.selection.start) {
      studioHighlightRange(_studio.selection.tab, _studio.selection.start, _studio.selection.end);
      return;
    }

    const state = _studio.viewState || studioParseDocument(_studio.documentSource || STUDIO_DEFAULT_DOCUMENT);
    const tab = studioNormalizeTab(_studio.selection.tab || 'html');
    const view = studioGetViewContent(state, tab);
    const range = studioFindSnippetRange(view, _studio.selection.text || '');
    if (range) studioHighlightRange(tab, range.start, range.end);
  }
}

function studioInitDropZone() {
  const view = document.getElementById('studioView');
  if (!view || view.dataset.dropBound) return;
  view.dataset.dropBound = 'true';

  view.addEventListener('dragover', e => {
    e.preventDefault();
    e.stopPropagation();
    view.classList.add('studio-drop-hover');
  });
  view.addEventListener('dragleave', e => {
    e.preventDefault();
    view.classList.remove('studio-drop-hover');
  });
  view.addEventListener('drop', async e => {
    e.preventDefault();
    view.classList.remove('studio-drop-hover');
    const items = e.dataTransfer.items;
    if (!items) return;

    // Check if a folder is dropped
    for (let i = 0; i < items.length; i++) {
      const entry = items[i].webkitGetAsEntry ? items[i].webkitGetAsEntry() : null;
      if (entry && entry.isDirectory) {
        const files = await studioTraverseFileTree(entry);
        studioLoadProjectFromFiles(files);
        return;
      }
    }

    // If not a folder, check for zip file
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.zip')) {
      studioLoadProjectFromZip(file);
    } else {
      alert('Arraste uma pasta ou um arquivo .zip com o projeto.');
    }
  });
}

// Fix #10: read all directory entries
async function studioTraverseFileTree(entry) {
  const files = [];  // { path, file }
  if (entry.isFile) {
    return new Promise(resolve => {
      entry.file(file => {
        files.push({ path: entry.fullPath.replace(/^\//, ''), file });
        resolve(files);
      });
    });
  } else if (entry.isDirectory) {
    const reader = entry.createReader();
    const entries = await readAllEntries(reader);
    for (const child of entries) {
      const childFiles = await studioTraverseFileTree(child);
      files.push(...childFiles);
    }
    return files;
  }
  return files;
}

function readAllEntries(dirReader) {
  return new Promise((resolve) => {
    const allEntries = [];
    function readBatch() {
      dirReader.readEntries((entries) => {
        if (entries.length === 0) {
          resolve(allEntries);
        } else {
          allEntries.push(...entries);
          readBatch();
        }
      });
    }
    readBatch();
  });
}

async function studioLoadProjectFromZip(zipFile, projectId) {
  projectId = projectId || _studioGetActiveProjectId();
  if (!projectId) {
    alert('Nenhum projeto ativo. Ative um projeto primeiro.');
    return;
  }

  try {
    if (typeof JSZip === 'undefined') {
      alert('JSZip library required for zip import. Please include the script.');
      return;
    }
    const zip = await JSZip.loadAsync(zipFile);
    const filesMap = new Map();
    const uploadPromises = [];

    zip.forEach((relativePath, file) => {
      if (file.dir || _studioIsHiddenPath(relativePath)) return;
      const promise = file.async('string').then(async content => {
        filesMap.set(relativePath, content);
        await _studioUploadFileToProject(relativePath, content, projectId);
      });
      uploadPromises.push(promise);
    });

    await Promise.all(uploadPromises);
    studioSetProjectFiles(filesMap, zipFile.name.replace(/\.zip$/i, ''));
  } catch (err) {
    alert('Erro ao ler o arquivo zip: ' + err.message);
  }
}

async function studioLoadProjectFromFiles(fileList, projectId) {
  projectId = projectId || _studioGetActiveProjectId();
  if (!projectId) {
    alert('Nenhum projeto ativo. Ative um projeto primeiro.');
    return;
  }

  const promises = Array.from(fileList).map(item => {
    const file = item.file || item;
    const relativePath = item.path || file.webkitRelativePath || file.name;
    if (_studioIsHiddenPath(relativePath)) {
      return Promise.resolve(null);
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async e => {
        const content = e.target.result;
        try {
          await _studioUploadFileToProject(relativePath, content, projectId);
          resolve({ path: relativePath, content });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  });

  try {
    const results = (await Promise.all(promises)).filter(Boolean);
    const map = new Map();
    results.forEach(r => map.set(r.path, r.content));
    studioSetProjectFiles(map, 'projeto');
  } catch (err) {
    alert('Erro ao enviar arquivos para o projeto: ' + err.message);
  }
}

// Fix #2: attach page select listener here
function studioSetProjectFiles(filesMap, projectName) {
  _studioProject = {
    files: filesMap,
    rootName: projectName || 'projeto',
    _projectId: _studioGetActiveProjectId()
  };

  const select = document.getElementById('studioPageSelect');
  if (!select) return;

  select.innerHTML = '';
  const htmlFiles = [];
  for (const [path] of filesMap) {
    if (path.endsWith('.html') || path.endsWith('.htm')) {
      htmlFiles.push(path);
    }
  }

  if (htmlFiles.length === 0) {
    select.innerHTML = '<option>Nenhum HTML encontrado</option>';
    studioUpdateSaveButtonState();
    return;
  }

  htmlFiles.sort().forEach(path => {
    const opt = document.createElement('option');
    opt.value = path;
    opt.textContent = path;
    select.appendChild(opt);
  });

  // Fix #2: bind change listener once
  if (!select.dataset.bound) {
    select.dataset.bound = 'true';
    select.addEventListener('change', function(e) {
      studioLoadPage(e.target.value);
    });
  }

  const firstHtml = htmlFiles[0];
  _studio.currentTab = 'html';
  studioLoadPage(firstHtml);
  studioRefreshFileTree();
}

function studioLoadPage(htmlPath) {
  if (!_studioProject) return;
  const content = _studioProject.files.get(htmlPath);
  if (!content) return;

  _studioProject.currentPage = htmlPath;
  _studio.documentSource = content;
  _studio.viewState = studioParseDocument(content);
  studioRenderCurrentTab();
  studioUpdatePreview();
}

function studioResolvePath(baseDir, relative) {
  if (relative.startsWith('/')) return relative.substring(1);
  const combined = (baseDir + relative).replace(/\/$/, '');
  const parts = combined.split('/').filter(Boolean);
  const resolved = [];
  for (const part of parts) {
    if (part === '..') resolved.pop();
    else if (part !== '.') resolved.push(part);
  }
  return resolved.join('/');
}

function studioBuildPreviewDocumentFallback(source) {
  const html = studioNormalizeText(source || STUDIO_DEFAULT_DOCUMENT);
  const withoutExternalScripts = html.replace(
    /<script\b[^>]*\bsrc\s*=\s*("[^"]*"|'[^']*')[^>]*>\s*<\/script>/gi, ''
  );
  const withoutInlineHandlers = withoutExternalScripts.replace(
    /\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, ''
  );
  const bootstrap = studioPreviewBootstrapMarkup(studioPreviewBaseHref());
  let finalHtml;
  if (/<head\b[^>]*>/i.test(withoutInlineHandlers)) {
    finalHtml = withoutInlineHandlers.replace(/<head\b[^>]*>/i, function (match) {
      return match + '\n' + bootstrap + '\n';
    });
  } else {
    finalHtml = bootstrap + '\n' + withoutInlineHandlers;
  }

  if (!/^\s*<!doctype/i.test(finalHtml)) {
    finalHtml = '<!doctype html>\n' + finalHtml;
  }
  return finalHtml;
}

let _studioSelectedFileForEdit = null;

async function studioLoadProjectFilesFromServer() {
  const projectId = _studioGetActiveProjectId();
  if (!projectId) return;

  // Use the /files endpoint the server exposes, then select entries under studio_files/
  const listUrl = `${API_BASE}/api/projects/${encodeURIComponent(projectId)}/files`;
  let payload = null;
  try {
    const res = await fetch(listUrl);
    if (!res.ok) throw new Error(`List request failed: ${res.status}`);
    payload = await res.json();
  } catch (e) {
    console.warn('Could not fetch project files list:', e);
    return;
  }

  // Expecting payload.files to be an array of entries; filter for the studio_files prefix
  const entries = Array.isArray(payload && payload.files) ? payload.files : [];
  const studioEntries = entries
    .map(item => (typeof item === 'string' ? item : (item && item.name ? item.name : null)))
    .filter(Boolean)
    .filter(name => name.startsWith('studio_files/'));

  if (!studioEntries.length) return;

  const filesMap = new Map();
  const fetchPromises = studioEntries.map(async fullPath => {
    const strippedPath = fullPath.replace(/^studio_files\//, '');
    try {
      const content = await _studioFetchProjectFile(projectId, fullPath);
      filesMap.set(strippedPath, content);
    } catch (err) {
      console.warn(`Skipping ${fullPath}:`, err);
    }
  });

  await Promise.all(fetchPromises);
  if (filesMap.size > 0) {
    studioSetProjectFiles(filesMap, 'projeto');
  }
}

function studioOpenProjectFilesModal() {
  const modal = document.getElementById('studioProjectFilesModal');
  if (!modal) return;
  if (!_studioProject) {
    alert('Nenhum projeto carregado. Importe uma pasta primeiro.');
    return;
  }
  modal.classList.add('open');
  studioRefreshFileTree();
}

function studioCloseProjectFilesModal() {
  const modal = document.getElementById('studioProjectFilesModal');
  if (modal) modal.classList.remove('open');
  _studioSelectedFileForEdit = null;
  const editor = document.getElementById('studioFileEditor');
  const pathEl = document.getElementById('studioFileEditorPath');
  if (editor) editor.value = '';
  if (pathEl) pathEl.textContent = '';
}

function studioRefreshFileTree() {
  const container = document.getElementById('studioFileTreeContainer');
  if (!container || !_studioProject) return;

  const tree = {};
  for (const [path] of _studioProject.files) {
    const parts = path.split('/');
    let current = tree;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!current[part]) {
        current[part] = (i === parts.length - 1) ? '__file__' : {};
      }
      if (typeof current[part] !== 'string') current = current[part];
    }
  }

  container.innerHTML = '';
  const ul = document.createElement('ul');
  ul.className = 'studio-file-tree';
  studioRenderTreeLevel(tree, ul, '');
  container.appendChild(ul);

  ul.addEventListener('click', function(e) {
    const li = e.target.closest('li');
    if (!li || li.classList.contains('folder')) return;
    const path = li.dataset.path;
    if (!path) return;
    ul.querySelectorAll('li.selected').forEach(el => el.classList.remove('selected'));
    li.classList.add('selected');
    _studioSelectedFileForEdit = path;
    const content = _studioProject.files.get(path) || '';
    const pathEl = document.getElementById('studioFileEditorPath');
    const editor = document.getElementById('studioFileEditor');
    if (pathEl) pathEl.textContent = path;
    if (editor) editor.value = content;
  });
}

function studioRenderTreeLevel(node, parentUl, parentPath) {
  const keys = Object.keys(node).sort();
  for (const key of keys) {
    const value = node[key];
    const fullPath = parentPath ? `${parentPath}/${key}` : key;
    const li = document.createElement('li');
    if (value === '__file__') {
      li.className = 'file';
      li.textContent = key;
      li.dataset.path = fullPath;
    } else {
      li.className = 'folder';
      li.textContent = key;
      const subUl = document.createElement('ul');
      subUl.className = 'studio-file-tree';
      studioRenderTreeLevel(value, subUl, fullPath);
      li.appendChild(subUl);
    }
    parentUl.appendChild(li);
  }
}

function studioSaveFileFromModal() {
  if (!_studioSelectedFileForEdit || !_studioProject) return;
  const editor = document.getElementById('studioFileEditor');
  if (!editor) return;
  const newContent = editor.value;
  _studioProject.files.set(_studioSelectedFileForEdit, newContent);

  if (_studioSelectedFileForEdit === _studioProject.currentPage) {
    _studio.documentSource = newContent;
    _studio.viewState = studioParseDocument(newContent);
    studioRenderCurrentTab();
    studioUpdatePreview();
  } else if (_studioSelectedFileForEdit.endsWith('.css') || _studioSelectedFileForEdit.endsWith('.js')) {
    studioUpdatePreview();
  }

  const saveBtn = document.querySelector('#studioProjectFilesModal .btn:first-child');
  if (saveBtn) {
    const orig = saveBtn.innerHTML;
    saveBtn.innerHTML = '<i class="fas fa-check"></i> Salvo';
    setTimeout(() => { saveBtn.innerHTML = orig; }, 800);
  }
}

// Expose functions to window scope
window.studioShowView = studioShowView;
window.studioHideView = studioHideView;
window.studioSetMainSidebarHidden = studioSetMainSidebarHidden;
window.studioToggleMainSidebar = studioToggleMainSidebar;
window.studioInitSplitter = studioInitSplitter;
window.studioInitSideDrag = studioInitSideDrag;
window.studioUpdatePreview = studioUpdatePreview;
window.studioLoadConfig = studioLoadConfig;
window.studioSaveCfg = studioSaveCfg;
window.studioSetMode = studioSetMode;
window.studioTogglePanel = studioTogglePanel;
window.studioToggleAiPanel = studioToggleAiPanel;
window.studioSwitchTab = studioSwitchTab;
window.studioFormatCode = studioFormatCode;
window.studioApplyCode = studioApplyCode;
window.studioApplyAction = studioApplyAction;
window.studioHighlightReference = studioHighlightReference;
window.studioRefreshPreview = studioRefreshPreview;
window.studioResetCode = studioResetCode;
window.studioInsertComponent = studioInsertComponent;
window.studioLoadTemplate = studioLoadTemplate;
window.studioSelectProvider = studioSelectProvider;
window.studioCloseCfgModal = studioCloseCfgModal;
window.studioOpenCfgModal = studioOpenCfgModal;
window.studioAiKeydown = studioAiKeydown;
window.studioSendAiMsg = studioSendAiMsg;
window.studioSaveCurrentFile = studioSaveCurrentFile;
window._studioAddAiMsg = _studioAddAiMsg;
window._studioCallLLM = _studioCallLLM;
window._studioEscHtml = _studioEscHtml;
window.studioSaveAssistantConversation = studioSaveAssistantConversation;
window.studioSaveAssistantConversationJson = studioSaveAssistantConversationJson;
window.studioImportAssistantConversationJson = studioImportAssistantConversationJson;
window.studioHandleAssistantConversationImport = studioHandleAssistantConversationImport;
window.studioDownloadHtml = studioDownloadHtml;
window.studioImportFile = studioImportFile;
window.studioNewProject = studioNewProject;
window.studioHandleImport = studioHandleImport;
window.studioFocusSelection = studioFocusSelection;
window.studioSyncAssistantContext = studioSyncAssistantContext;
window.studioImportProject = studioImportProject;
window.studioHandleProjectImport = studioHandleProjectImport;
window.studioLoadProjectFromZip = studioLoadProjectFromZip;
window.studioLoadProjectFromFiles = studioLoadProjectFromFiles;
window.studioSetProjectFiles = studioSetProjectFiles;
window.studioLoadPage = studioLoadPage;
window.studioOpenProjectFilesModal = studioOpenProjectFilesModal;
window.studioCloseProjectFilesModal = studioCloseProjectFilesModal;
window.studioSaveFileFromModal = studioSaveFileFromModal;