/* ═══════════════════════════════════════════════════════════════════
   HISTORY MODULE - Chat history load/save/render, model configuration
   ═══════════════════════════════════════════════════════════════════ */

// History and configuration global variables
let _assistantHistory = [];
const CHAT_KEY = 'OliviaLegal.chat.saved';
const MODEL_PROVIDER_META = {
  deepseek: { label: 'DeepSeek', icon: 'fa-brain' },
  anthropic: { label: 'Anthropic', icon: 'fa-feather-pointed' },
  openrouter: { label: 'OpenRouter', icon: 'fa-network-wired' },
  fireworks: { label: 'Fireworks', icon: 'fa-fire' },
  openai: { label: 'OpenAI', icon: 'fa-robot' },
  ollama: { label: 'Ollama', icon: 'fa-hard-drive' },
  gemini: { label: 'Gemini', icon: 'fa-cloud' },
  other: { label: 'Outros', icon: 'fa-microchip' }
};

// --- DeepSeek (fallback LLM provider, OpenAI‑compatible) ---------------------
// Only the models actually configured in the environment
const ALLOWED_DEEPSEEK_MODELS = new Set([
  'deepseek-v4-flash',    // default LLM_MODEL
  'deepseek-v4-pro',      // higher‑tier option
]);

// --- Gemini (Google AI Studio direct API) ------------------------------------
// Language models available via GEMINI_API_KEY (chat/completions).
// (imagen-3 and text-embedding-004 are kept if the frontend also
//  uses them for image generation or embeddings.)
const ALLOWED_GEMINI_MODELS = new Set([
  // Gemini 3.x
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite-preview',
  'gemini-3.1-flash-lite',
  'gemini-3.1-pro',
  'gemini-3-flash',
  // Gemini 2.5
  'gemini-2.5-pro-preview-06-05',
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  // Gemini 2.0
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-2-flash',
  'gemini-2-flash-lite',
  // Image / Embedding (separate endpoints)
  'imagen-3',
  'text-embedding-004',
]);

// --- Anthropic (accessed via local openclaude binary) ------------------------
// Model IDs that can be passed to the openclaude CLI.
// Derived from Anthropic models listed in OPENROUTER_CATALOG_MODELS,
// without the "anthropic/" prefix.
const ALLOWED_ANTHROPIC_MODELS = new Set([
  'claude-sonnet-4.6',
  'claude-opus-4.6',
  'claude-opus-4.6-fast',
  'claude-opus-4.7',
  'claude-opus-4.5',
  'claude-haiku-latest',
  'claude-sonnet-latest',
  'claude-opus-latest',
]);

// --- OpenRouter (all models from the OpenRouter catalog) ---------------------
// Exact set that matches OPENROUTER_CATALOG_MODEL_IDS in the Python code.
const ALLOWED_OPENROUTER_MODELS = new Set([
  'cognitivecomputations/dolphin-mistral-24b-venice-edition:free',
  'openai/gpt-oss-20b:free',
  'poolside/laguna-xs-2.1:free',
  'tencent/hy3:free',
  'qwen/qwen3-next-80b-a3b-instruct:free',
  'x-ai/grok-4.1-fast',
  'anthropic/claude-sonnet-4.6',
  'anthropic/claude-opus-4.6',
  'anthropic/claude-opus-4.7',
  'google/gemini-3-flash-preview',
  'anthropic/claude-haiku-latest',
  'anthropic/claude-sonnet-latest',
  'anthropic/claude-opus-latest',
  'anthropic/claude-opus-4.6-fast',
  'anthropic/claude-opus-4.5',
  'x-ai/grok-4.3',
  'google/gemini-3.1-pro-preview',
  'openrouter/free',
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'nvidia/nemotron-3-nano-30b-a3b',
  'nvidia/nemotron-3-super',
  'nvidia/nemotron-nano-9b-v2',
  'nvidia/nemotron-nano-12b-2-vl',
  'google/gemma-4-26b-a4b',
  'nvidia/llama-nemotron-embed-vl-1b-v2',
  'nvidia/llama-nemotron-rerank-vl-1b-v2',
  'liquid/lfm2.5-1.2b-thinking',
  'nvidia/nemotron-3.5-content-safety',
  'liquid/lfm2.5-1.2b-instruct',
  'qwen/qwen3-next-80b-a3b-instruct',
  'meta-llama/llama-3.3-70b-instruct',
  'venice/uncensored',
  'meta-llama/llama-3.2-3b-instruct',
  'nousresearch/hermes-3-405b-instruct',
  'qwen/qwen3-coder-480b-a35b-instruct',
  'gemini-3.5-flash',
  'gemini-2.5-pro-preview-06-05',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-3.1-flash-lite-preview',
  'gemini-3.1-flash-lite',
  'gemini-3.1-pro',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-pro',
  'gemini-2-flash',
  'gemini-2-flash-lite',
  'gemini-3-flash',
  'google/gemini-2.5-pro',
  'google/gemini-2.0-flash',
]);

// --- Ollama (local models – dynamically discovered) --------------------------
// No static list exists; the server fetches available models from the
// Ollama REST API at runtime.  Leave the set empty or populate it
// asynchronously after discovery.
const ALLOWED_OLLAMA_MODELS = new Set();   // populated at runtime

function _isModelInCatalog(rawModel) {
  const catalog = window._modelCatalog;
  if (!catalog) return false;
  const id = String(rawModel || '').trim();
  if (!id) return false;
  for (const provider in catalog) {
    const models = catalog[provider];
    if (!Array.isArray(models)) continue;
    if (models.some(m => String(m.id || m.name || '') === id)) return true;
  }
  return false;
}

function normalizeWorkspaceModel(rawModel, fallback) {
  const fb = String(fallback || 'deepseek-v4-flash').trim() || 'deepseek-v4-flash';
  const model = String(rawModel || '').trim();
  if (!model) return fb;

  const lower = model.toLowerCase();
  if (ALLOWED_DEEPSEEK_MODELS.has(lower)) return lower;
  if (ALLOWED_GEMINI_MODELS.has(lower)) return lower;
  if (ALLOWED_OPENROUTER_MODELS.has(lower)) return lower;
  if (ALLOWED_ANTHROPIC_MODELS.has(lower)) return lower;

  // Preserve provider-scoped model IDs such as Ollama values like
  // "ollama|11434|llama3.2" so UI selection remains stable after reloads.
  if (model.includes('|')) return model;

  // Trust any model the server's live catalog actually exposes — including
  // admin-added OpenRouter models. This makes newly added models selectable
  // and persistable without editing the static ALLOWED_* sets above.
  if (_isModelInCatalog(model)) return model;

  // If the catalog hasn't loaded yet but the id looks provider-scoped
  // (e.g. "anthropic/claude-3.5-sonnet" added via admin), trust it as-is so
  // getConfig() does not clobber a legitimate saved selection with the
  // fallback before the catalog arrives.
  if (model.includes('/')) return model;

  // Some agent modes surface external IDs (e.g. github:copilot) that are
  // not accepted by the DeepSeek-compatible endpoint used by /api/assistant/chat.
  if (lower.startsWith('github:') || lower.startsWith('copilot') || lower.startsWith('claude')) {
    return 'deepseek-v4-pro';
  }
  return fb;
}

function normalizeRuntimeModelForProvider(rawModel, provider) {
  const model = String(rawModel || '').trim();
  const providerName = String(provider || '').trim().toLowerCase();
  if (!model) return 'deepseek-v4-flash';

  if (providerName === 'ollama' && model.includes('|')) {
    const parts = model.split('|');
    if (parts.length >= 3) {
      return parts[2].trim() || 'deepseek-v4-flash';
    }
  }

  if (model.includes('|')) {
    const parts = model.split('|');
    if (parts.length >= 3) {
      return parts[2].trim() || 'deepseek-v4-flash';
    }
  }

  return normalizeWorkspaceModel(model, 'deepseek-v4-flash');
}

function _providerMeta(provider) {
  const key = String(provider || 'other').trim().toLowerCase();
  return MODEL_PROVIDER_META[key] || {
    label: key ? key.charAt(0).toUpperCase() + key.slice(1) : 'Outros',
    icon: 'fa-microchip'
  };
}

function renderProviderTabs(catalog, activeProvider) {
  const container = document.getElementById('providerTabs');
  if (!container || !catalog) return;

  const providers = Object.keys(catalog).filter(provider => Array.isArray(catalog[provider]) && catalog[provider].length);
  if (!providers.length) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = providers.map(provider => {
    const meta = _providerMeta(provider);
    const activeClass = provider === activeProvider ? ' active' : '';
    return `
      <button class="provider-tab${activeClass}" data-provider="${escapeHtml(provider)}" onclick="selectProvider('${escapeHtml(provider)}')">
        <i class="fas ${meta.icon}" style="font-size:10px"></i> ${escapeHtml(meta.label)}
      </button>
    `;
  }).join('');
}

function _readLocalSavedChats() {
  try {
    const raw = localStorage.getItem(CHAT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.chats)) return parsed.chats;
  } catch (_) { }
  return [];
}

function _writeLocalSavedChats(chats) {
  try {
    localStorage.setItem(CHAT_KEY, JSON.stringify(Array.isArray(chats) ? chats : []));
  } catch (_) { }
}

function _extractVisibleChatMessages() {
  const log = document.getElementById('chatLog');
  if (!log) return [];

  const bubbles = Array.from(log.querySelectorAll('.chat-bubble'));
  const messages = [];

  bubbles.forEach((bubble) => {
    if (bubble.classList.contains('LA8159-working') || bubble.classList.contains('LA8159-thinking')) return;

    const role = bubble.classList.contains('user')
      ? 'user'
      : bubble.classList.contains('system')
        ? 'system'
        : 'agent';

    let html = '';
    const answer = bubble.querySelector('.answer-md');
    if (role === 'agent' && answer) {
      html = `<div class="answer-md">${answer.innerHTML}</div>`;
    } else {
      html = bubble.innerHTML || '';
    }

    if (!String(html).trim()) return;
    messages.push({ role, html, timestamp: new Date().toISOString() });
  });

  return messages;
}

function _resolveMessagesForPersistence() {
  const runtimeMessages = Array.isArray(chatHistory)
    ? chatHistory.filter((m) => m && typeof m.html === 'string' && m.html.trim())
    : [];
  const visibleMessages = _extractVisibleChatMessages();

  if (!runtimeMessages.length) return visibleMessages;

  const runtimeHasAgent = runtimeMessages.some((m) => m.role === 'agent');
  const visibleHasAgent = visibleMessages.some((m) => m.role === 'agent');
  if (!runtimeHasAgent && visibleHasAgent) return visibleMessages;
  if (visibleMessages.length > runtimeMessages.length + 1) return visibleMessages;

  return runtimeMessages;
}

function _saveLocalChatSnapshot(name, messages) {
  const chats = _readLocalSavedChats();
  const safeName = String(name || '').trim();
  if (!safeName) return false;

  const session = {
    name: safeName,
    saved_at: new Date().toISOString(),
    size: JSON.stringify(messages || []).length,
    messages: Array.isArray(messages) ? messages : [],
  };

  const idx = chats.findIndex((c) => String(c && c.name) === safeName);
  if (idx >= 0) chats[idx] = session;
  else chats.unshift(session);

  _writeLocalSavedChats(chats);
  return true;
}

function _defaultSessionName(prefix) {
  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
  return `${prefix || 'chat'}_${stamp}`;
}

async function loadLocalSavedChatByName(name) {
  const targetName = String(name || '').trim();
  if (!targetName) return;

  const chats = _readLocalSavedChats();
  const chat = chats.find((c) => String(c && c.name) === targetName);
  if (!chat || !Array.isArray(chat.messages) || !chat.messages.length) {
    addSystemBubble('Conversa local não encontrada.');
    return;
  }

  showChatView();
  const log = document.getElementById('chatLog');
  if (log) log.innerHTML = '';
  chatHistory.length = 0;

  chat.messages.forEach((msg) => {
    const role = msg.role || 'agent';
    const html = msg.content || msg.html || '';
    if (!String(html).trim()) return;
    chatHistory.push({ role, html, timestamp: msg.timestamp || new Date().toISOString() });
    addBubble(role, html, true);
  });

  addSystemBubble(`Conversa local "${targetName.replace(/\.json$/, '')}" carregada.`);
}

async function deleteLocalSavedChat(name) {
  const targetName = String(name || '').trim();
  if (!targetName) return;
  if (!await window.customConfirm(`Excluir a conversa local "${targetName.replace(/\.json$/, '')}"?`)) return;

  const chats = _readLocalSavedChats().filter((c) => String(c && c.name) !== targetName);
  _writeLocalSavedChats(chats);
  await renderSavedChatsList();
}

function startRenameLocalChat(name) {
  const item = document.getElementById(`chi-local-${CSS.escape(name)}`);
  if (!item) return;
  const encodedName = encodeURIComponent(String(name));
  const displayName = name.replace(/\.json$/, '').replace(/_/g, ' ');
  item.innerHTML = `
    <input class="ch-rename-input" id="rename-input-local-${CSS.escape(name)}" type="text" value="${escapeHtml(displayName)}"
      name="renameInputLocal_${CSS.escape(name)}"
      onkeydown="if(event.key==='Enter')commitRenameLocalChat(decodeURIComponent('${encodedName}'),this.value);if(event.key==='Escape')renderSavedChatsList();"
      autocomplete="off" spellcheck="false">
    <div class="ch-actions">
      <button class="ch-btn" title="Confirmar" onclick="commitRenameLocalChat(decodeURIComponent('${encodedName}'),document.getElementById('rename-input-local-${CSS.escape(name)}').value)">
        <i class="fas fa-check"></i>
      </button>
      <button class="ch-btn" title="Cancelar" onclick="renderSavedChatsList()">
        <i class="fas fa-times"></i>
      </button>
    </div>`;
  const input = document.getElementById(`rename-input-local-${CSS.escape(name)}`);
  if (input) { input.focus(); input.select(); }
}

async function commitRenameLocalChat(oldName, newValue) {
  const oldSafe = String(oldName || '').trim();
  const newSafe = String(newValue || '').trim();
  if (!oldSafe || !newSafe) return;

  const chats = _readLocalSavedChats();
  const idx = chats.findIndex((c) => String(c && c.name) === oldSafe);
  if (idx < 0) {
    addSystemBubble('Conversa local não encontrada para renomear.');
    return;
  }
  chats[idx].name = newSafe;
  chats[idx].saved_at = new Date().toISOString();
  _writeLocalSavedChats(chats);
  await renderSavedChatsList();
}

// Load chat history — fetches list and renders it; does NOT auto-load any session
async function loadChatHistory() {
  await renderSavedChatsList();
}

// Render the saved chats list into #chatHistoryList
async function renderSavedChatsList() {
  const container = document.getElementById('chatHistoryList');
  if (!container) return;

  if (!selectedAgent) {
    const localChats = _readLocalSavedChats();
    if (!localChats.length) {
      container.innerHTML = '<p style="color:var(--gray);font-size:12px;text-align:center;padding:20px 0">Nenhuma conversa local salva ainda (modo assistente).</p>';
      return;
    }

    container.innerHTML = localChats.map(chat => {
      const name = chat.name || 'chat_local';
      const encodedName = encodeURIComponent(String(name));
      const displayName = name.replace(/\.json$/, '').replace(/_/g, ' ');
      const size = chat.size ? formatBytes(chat.size) : '';
      return `
        <div class="chat-history-item" id="chi-local-${CSS.escape(name)}">
          <div class="ch-info" onclick="loadLocalSavedChatByName(decodeURIComponent('${encodedName}'))" title="Carregar conversa local">
            <div class="ch-name">${escapeHtml(displayName)}</div>
            ${size ? `<div class="ch-size">${size}</div>` : ''}
          </div>
          <div class="ch-actions">
            <button class="ch-btn" title="Continuar esta conversa" onclick="loadLocalSavedChatByName(decodeURIComponent('${encodedName}'))">
              <i class="fas fa-arrow-right"></i>
            </button>
            <button class="ch-btn" title="Renomear" onclick="startRenameLocalChat(decodeURIComponent('${encodedName}'))">
              <i class="fas fa-pen"></i>
            </button>
            <button class="ch-btn danger" title="Excluir" onclick="deleteLocalSavedChat(decodeURIComponent('${encodedName}'))">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>`;
    }).join('');
    return;
  }

  container.innerHTML = '<p style="color:var(--gray);font-size:11px;text-align:center;padding:12px 0"><i class="fas fa-spinner fa-spin"></i> Carregando...</p>';

  try {
    const res = await fetch(`${API_BASE}/api/agents/${selectedAgent.agent_id}/chat/list`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const chats = Array.isArray(data) ? data : (data.chats || []);

    if (!chats.length) {
      container.innerHTML = '<p style="color:var(--gray);font-size:12px;text-align:center;padding:20px 0;font-style:italic">Nenhuma conversa salva ainda.</p>';
      return;
    }

    container.innerHTML = chats.map(chat => {
      const name = chat.name || chat;
      const encodedName = encodeURIComponent(String(name));
      const displayName = name.replace(/\.json$/, '').replace(/_/g, ' ');
      const size = chat.size ? formatBytes(chat.size) : '';
      return `
        <div class="chat-history-item" id="chi-${CSS.escape(name)}">
          <div class="ch-info" onclick="loadSavedChatByName(decodeURIComponent('${encodedName}'))" title="Carregar conversa">
            <div class="ch-name">${escapeHtml(displayName)}</div>
            ${size ? `<div class="ch-size">${size}</div>` : ''}
          </div>
          <div class="ch-actions">
            <button class="ch-btn" title="Continuar esta conversa" onclick="loadSavedChatByName(decodeURIComponent('${encodedName}'))">
              <i class="fas fa-arrow-right"></i>
            </button>
            <button class="ch-btn" title="Renomear" onclick="startRenameChat(decodeURIComponent('${encodedName}'))">
              <i class="fas fa-pen"></i>
            </button>
            <button class="ch-btn danger" title="Excluir" onclick="deleteSavedChat(decodeURIComponent('${encodedName}'))">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>`;
    }).join('');
  } catch (e) {
    container.innerHTML = `<p style="color:var(--red);font-size:11px;text-align:center;padding:12px 0">${escapeHtml(e.message)}</p>`;
  }
}

// Load a chat session by filename and show it in the chat view
async function loadSavedChatByName(name) {
  if (!selectedAgent) return;
  try {
    const res = await fetch(`${API_BASE}/api/agents/${selectedAgent.agent_id}/chat/load?name=${encodeURIComponent(name)}`);
    if (!res.ok) { addSystemBubble(`Falha ao carregar conversa: ${res.status}`); return; }
    const data = await res.json();
    if (!data.messages || !data.messages.length) { addSystemBubble('Conversa vazia.'); return; }
    showChatView();
    document.getElementById('chatLog').innerHTML = '';
    chatHistory.length = 0;
    data.messages.forEach(msg => addBubble(msg.role, msg.content || msg.html || '', true));
    addSystemBubble(`Conversa "${name.replace(/\.json$/, '')}" carregada.`);
  } catch (e) {
    addSystemBubble(`Erro ao carregar: ${e.message}`);
  }
}

// Start inline rename of a chat item
function startRenameChat(name) {
  const item = document.getElementById(`chi-${CSS.escape(name)}`);
  if (!item) return;
  const encodedName = encodeURIComponent(String(name));
  const displayName = name.replace(/\.json$/, '').replace(/_/g, ' ');
  item.innerHTML = `
    <input class="ch-rename-input" id="rename-input-${CSS.escape(name)}" type="text" value="${escapeHtml(displayName)}"
      name="renameInput_${CSS.escape(name)}"
      onkeydown="if(event.key==='Enter')commitRenameChat(decodeURIComponent('${encodedName}'),this.value);if(event.key==='Escape')renderSavedChatsList();"
      autocomplete="off" spellcheck="false">
    <div class="ch-actions">
      <button class="ch-btn" title="Confirmar" onclick="commitRenameChat(decodeURIComponent('${encodedName}'),document.getElementById('rename-input-${CSS.escape(name)}').value)">
        <i class="fas fa-check"></i>
      </button>
      <button class="ch-btn" title="Cancelar" onclick="renderSavedChatsList()">
        <i class="fas fa-times"></i>
      </button>
    </div>`;
  const input = document.getElementById(`rename-input-${CSS.escape(name)}`);
  if (input) { input.focus(); input.select(); }
}

// Commit a rename — call backend PATCH, then refresh list
async function commitRenameChat(oldName, newValue) {
  if (!selectedAgent || !newValue.trim()) return;
  try {
    const res = await fetch(`${API_BASE}/api/agents/${selectedAgent.agent_id}/chat/rename`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ old_name: oldName, new_name: newValue.trim() })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      addSystemBubble(`Renomear falhou: ${err.detail || res.status}`);
      return;
    }
    await renderSavedChatsList();
  } catch (e) {
    addSystemBubble(`Erro: ${e.message}`);
  }
}

// Delete a saved chat after confirmation
async function deleteSavedChat(name) {
  if (!selectedAgent) return;
  if (!await window.customConfirm(`Excluir a conversa "${name.replace(/\.json$/, '')}"? Esta ação não pode ser desfeita.`)) return;
  try {
    const res = await fetch(`${API_BASE}/api/agents/${selectedAgent.agent_id}/chat/${encodeURIComponent(name)}`, {
      method: 'DELETE'
    });
    if (!res.ok) { addSystemBubble(`Falha ao excluir: ${res.status}`); return; }
    await renderSavedChatsList();
  } catch (e) {
    addSystemBubble(`Erro: ${e.message}`);
  }
}

// Load chat history (legacy compat — now just renders the list)
async function loadChatFromServer(chatId) {
  await loadSavedChatByName(chatId);
}

// Save chat — optionally prompt for a session name
async function saveChat() {
  const messages = _resolveMessagesForPersistence();
  if (!messages.length) {
    addSystemBubble('Nenhuma conversa para salvar');
    return;
  }

  const rawName = await window.customPrompt('Nome para esta conversa (deixe vazio para usar data/hora):', '');
  if (rawName === null) return; // user cancelled

  const sessionName = rawName.trim() || _defaultSessionName(selectedAgent ? 'chat' : 'assistant');

  if (!selectedAgent) {
    if (_saveLocalChatSnapshot(sessionName, messages)) {
      addSystemBubble('Conversa salva localmente');
      await renderSavedChatsList();
    } else {
      addSystemBubble('Falha ao salvar conversa local');
    }
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/agents/${selectedAgent.agent_id}/chat/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, session_name: sessionName })
    });
    if (res.ok) {
      addSystemBubble('Conversa salva');
      await renderSavedChatsList();
    } else {
      addSystemBubble('Falha ao salvar conversa');
    }
  } catch (e) {
    addSystemBubble(`Erro: ${e.message}`);
  }
}

// Auto-save chat — silent, no prompts, called after each agent/assistant response
let _autoSaveChatLastSize = 0;
let _autoSaveChatTimer = null;
const AUTO_SAVE_DEBOUNCE_MS = 2000;
const AUTO_SAVE_MIN_MESSAGES = 2;

async function autoSaveChat() {
  const messages = _resolveMessagesForPersistence();
  if (!messages.length || messages.length < AUTO_SAVE_MIN_MESSAGES) return;

  // Debounce: skip if content hasn't changed since last auto-save
  const currentSize = JSON.stringify(messages).length;
  if (currentSize === _autoSaveChatLastSize) return;
  _autoSaveChatLastSize = currentSize;

  if (_autoSaveChatTimer) clearTimeout(_autoSaveChatTimer);
  _autoSaveChatTimer = setTimeout(async () => {
    _autoSaveChatTimer = null;
    const msgs = _resolveMessagesForPersistence();
    if (!msgs.length) return;

    const prefix = selectedAgent
      ? (selectedAgent.name || selectedAgent.agent_id || 'agente').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()
      : 'assistant';
    const sessionName = _defaultSessionName(prefix);

    if (!selectedAgent) {
      _saveLocalChatSnapshot(sessionName, msgs);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/agents/${selectedAgent.agent_id}/chat/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: msgs, session_name: sessionName })
      });
      if (res.ok) {
        // Update the saved chats list silently in the background
        if (document.getElementById('chatHistoryList') && document.getElementById('chatHistoryList').children.length > 0) {
          await renderSavedChatsList();
        }
      }
    } catch (_e) {
      // Silently fall back to local save on network errors
      _saveLocalChatSnapshot(sessionName, msgs);
    }
  }, AUTO_SAVE_DEBOUNCE_MS);
}

// Load saved chat (legacy compat)
async function loadSavedChat(chatId) {
  await loadSavedChatByName(chatId);
}

// Export chat as text
function exportChatTxt() {
  const messages = _resolveMessagesForPersistence();
  if (!messages.length) {
    addSystemBubble('Nenhuma conversa para exportar');
    return;
  }

  let txt = '';
  messages.forEach(msg => {
    const role = msg.role === 'user' ? 'Usuário' :
      msg.role === 'agent' ? 'Agente' :
        msg.role === 'system' ? 'Sistema' : 'Assistente';
    const content = msg.html.replace(/<[^>]*>/g, '').trim();
    txt += `${role}: ${content}\n\n`;
  });

  const blob = new Blob([txt], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `chat_${new Date().toISOString().slice(0, 10)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
  addSystemBubble('Chat exportado como texto');
}

// Export chat as JSON
function exportChatJson() {
  const messages = _resolveMessagesForPersistence();
  if (!messages.length) {
    addSystemBubble('Nenhuma conversa para exportar');
    return;
  }

  const data = {
    export_date: new Date().toISOString(),
    agent: selectedAgent ? selectedAgent.name : 'unknown',
    messages
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `chat_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  addSystemBubble('Chat exportado como JSON');
}

// Clear chat
async function clearChat() {
  if (!await window.customConfirm('Limpar esta conversa? O histórico não será salvo.')) return;

  showWelcomeView();
  addSystemBubble('Conversa limpa');
}

// Load model catalog
async function loadModelCatalog() {
  try {
    const res = await fetch(`${API_BASE}/api/models/catalog`);
    if (!res.ok) return;

    const data = await res.json();
    // API returns { models: [...flat array...], current_model: "..." }
    // Normalise to { provider: [models] } shape used by the rest of the code
    const rawModels = data.models || data.catalog ||
      (Array.isArray(data) ? data : null);
    if (!rawModels) return;
    let catalog;
    if (Array.isArray(rawModels)) {
      catalog = {};
      rawModels.forEach(m => {
        const prov = m.provider || 'other';
        if (!catalog[prov]) catalog[prov] = [];
        catalog[prov].push(m);
      });
    } else {
      catalog = rawModels;
    }

    // Update model selects
    const selects = document.querySelectorAll('select.model-select');
    selects.forEach(select => {
      const currentValue = select.value;
      select.innerHTML = '';

      // Add default options
      const defaultOpt = document.createElement('option');
      defaultOpt.value = '';
      defaultOpt.textContent = 'Select a model';
      select.appendChild(defaultOpt);

      // Add model groups
      Object.entries(catalog).forEach(([provider, models]) => {
        const optgroup = document.createElement('optgroup');
        optgroup.label = provider;

        models.forEach(model => {
          const option = document.createElement('option');
          option.value = model.id || model.name;
          option.textContent = model.name || model.id;
          optgroup.appendChild(option);
        });

        select.appendChild(optgroup);
      });

      // Restore previous selection
      if (currentValue) {
        select.value = currentValue;
      }
    });

    // Store globally for provider-tab filtering
    window._modelCatalog = catalog;
    window._currentModel = data.current_model || null;

    // Activate the provider tab matching saved config (or first available)
    const cfg = getConfig();
    const activeProvider = cfg.provider && catalog[cfg.provider] ? cfg.provider : Object.keys(catalog)[0];
    renderProviderTabs(catalog, activeProvider);

    // Render only the active provider's models
    renderModelCards({ [activeProvider]: catalog[activeProvider] || [] }, window._currentModel);
  } catch (e) {
    console.log('Failed to load model catalog:', e.message);
    const c = document.getElementById('modelCards');
    if (c) c.innerHTML = '<p style="color:var(--gray);text-align:center;font-size:12px;padding:12px">Failed to load models</p>';
  }
}

// Restore API key UI
function restoreApiKeyUI() {
  try {
    const saved = JSON.parse(localStorage.getItem('OliviaLegal.api.keys') || '{}');
    Object.entries(saved).forEach(([key, value]) => {
      const input = document.getElementById(key);
      if (input) {
        input.value = value;
        input.dispatchEvent(new Event('input'));
      }
    });
  } catch (e) {
    console.log('Failed to restore API keys:', e);
  }
}

// Get custom API key
function getCustomApiKey(provider) {
  try {
    const saved = JSON.parse(localStorage.getItem('OliviaLegal.api.keys') || '{}');
    return saved[provider] || '';
  } catch {
    return '';
  }
}

// Verify API key — saves it locally and shows feedback in apiKeyStatus
async function verifyApiKey(provider, key) {
  // When called from the sidebar button (no args), read from UI
  if (!provider) {
    const activeTab = document.querySelector('.provider-tab.active');
    provider = activeTab ? activeTab.dataset.provider : 'anthropic';
  }
  if (key === undefined) {
    const input = document.getElementById('cfgApiKey');
    key = input ? input.value.trim() : '';
  }

  const statusEl = document.getElementById('apiKeyStatus');

  if (!key) {
    if (statusEl) {
      statusEl.style.color = 'var(--gray)';
      statusEl.textContent = provider === 'ollama'
        ? 'Usando Ollama local do servidor (11434/11435/11436)'
        : 'Usando configuração do servidor para ' + provider;
    }
    // Clear any saved key for this provider
    try {
      const saved = JSON.parse(localStorage.getItem('OliviaLegal.api.keys') || '{}');
      delete saved[provider];
      delete saved['cfgApiKey'];
      localStorage.setItem('OliviaLegal.api.keys', JSON.stringify(saved));
    } catch (e) { }
    return false;
  }

  // Save key to localStorage under both provider name and element ID
  try {
    const saved = JSON.parse(localStorage.getItem('OliviaLegal.api.keys') || '{}');
    saved[provider] = key;
    saved['cfgApiKey'] = key;
    localStorage.setItem('OliviaLegal.api.keys', JSON.stringify(saved));
  } catch (e) {
    if (statusEl) { statusEl.style.color = 'var(--red)'; statusEl.textContent = 'Erro ao salvar chave'; }
    return false;
  }

  // Show green success in apiKeyStatus
  if (statusEl) {
    statusEl.style.color = 'var(--green)';
    statusEl.innerHTML = '<i class="fas fa-check-circle"></i> Chave salva localmente';
    setTimeout(function () {
      statusEl.style.color = 'var(--gray)';
      statusEl.textContent = 'Chave personalizada ativa (' + provider + ')';
    }, 2500);
  }
  return true;
}

// Switch model
function switchModel(modelId) {
  const normalizedModel = normalizeWorkspaceModel(modelId, 'deepseek-v4-flash');
  // Save to localStorage
  try {
    const saved = JSON.parse(localStorage.getItem('OliviaLegal.workspace.config') || '{}');
    saved.model = normalizedModel;
    localStorage.setItem('OliviaLegal.workspace.config', JSON.stringify(saved));
  } catch (e) {
    console.warn('Failed to save model config:', e);
  }

  // Update current model tracking and refresh card highlights
  window._currentModel = normalizedModel;
  const activeTab = document.querySelector('.provider-tab.active');
  const activeProvider = activeTab ? activeTab.dataset.provider : null;
  if (activeProvider && window._modelCatalog && window._modelCatalog[activeProvider]) {
    renderModelCards({ [activeProvider]: window._modelCatalog[activeProvider] }, normalizedModel);
  }

  // Ensure the current provider view also re-renders with the selected model
  // when the chosen model comes from a provider-specific ID like Ollama.
  if (window._modelCatalog && window._modelCatalog[activeProvider]) {
    const currentProviderModels = window._modelCatalog[activeProvider] || [];
    const hasSelectedModel = currentProviderModels.some(model => normalizeWorkspaceModel(model.id, 'deepseek-v4-flash') === normalizedModel);
    if (!hasSelectedModel && window._modelCatalog.ollama) {
      renderModelCards({ ollama: window._modelCatalog.ollama }, normalizedModel);
    }
  }

  addSystemBubble(`Modelo alterado para: ${normalizedModel}`);
}

// Render model cards
function renderModelCards(catalog, currentModel) {
  const container = document.getElementById('modelCards');
  if (!container || !catalog) return;

  function fmtCtx(n) {
    if (!n) return 'N/A';
    const k = Math.round(n / 1000);
    return k >= 1000 ? (k / 1000).toFixed(0) + 'M' : k + 'k';
  }

  let html = '';
  Object.entries(catalog).forEach(([provider, models]) => {
    if (!models || !models.length) return;
    models.forEach(model => {
      const isCurrent = model.id === currentModel;
      const tier = model.tier || '';
      const ctx = fmtCtx(model.context_window);

      html += `
        <div class="model-card${isCurrent ? ' active' : ''}" data-model="${model.id}">
          <div class="model-card-header">
            <span class="model-card-name">${escapeHtml(model.name)}</span>
            ${tier ? `<span class="model-card-tier ${tier}">${tier.toUpperCase()}</span>` : ''}
          </div>
          <div class="model-card-desc">${escapeHtml(model.best_for || model.description || '')}</div>
          <div class="model-card-pricing">
            <span>&#9632; ${ctx} ctx</span>
            ${model.input_cost_per_1m != null ? `<span>&#8595; $${model.input_cost_per_1m}/1M in</span>` : ''}
            ${model.output_cost_per_1m != null ? `<span>&#8593; $${model.output_cost_per_1m}/1M out</span>` : ''}
            ${model.supports_thinking ? '<span style="color:var(--amber)">&#9670; thinking</span>' : ''}
            ${model.supports_vision ? '<span>&#9654; vision</span>' : ''}
          </div>
          <div class="model-card-footer" style="margin-top:8px">
            <button class="btn btn-sm${isCurrent ? ' active' : ''}" onclick="switchModel('${model.id}')" style="font-size:11px;width:100%">
              ${isCurrent ? '&#10003; Em uso' : 'Selecionar'}
            </button>
          </div>
        </div>
      `;
    });
  });

  container.innerHTML = html || '<p style="color:var(--gray);text-align:center;font-size:12px;padding:12px">Nenhum modelo dispon\u00edvel</p>';
}

// Select provider
function selectProvider(provider) {
  // Update active tab (class is provider-tab in HTML)
  document.querySelectorAll('.provider-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.provider === provider);
  });

  // Persist provider choice
  try {
    const saved = JSON.parse(localStorage.getItem('OliviaLegal.workspace.config') || '{}');
    saved.provider = provider;
    localStorage.setItem('OliviaLegal.workspace.config', JSON.stringify(saved));
  } catch (e) { }

  // Filter cards to selected provider
  if (window._modelCatalog) {
    const provModels = window._modelCatalog[provider];
    if (provModels) {
      renderModelCards({ [provider]: provModels }, window._currentModel);
    }
  }

  // Restore the saved API key for this provider into the input field
  try {
    const keys = JSON.parse(localStorage.getItem('OliviaLegal.api.keys') || '{}');
    const keyInput = document.getElementById('cfgApiKey');
    const statusEl = document.getElementById('apiKeyStatus');
    if (keyInput) {
      const savedKey = keys[provider] || keys.cfgApiKey || '';
      keyInput.value = savedKey;
    }
    if (statusEl) {
      if (provider === 'ollama') {
        statusEl.style.color = 'var(--gray)';
        statusEl.textContent = 'Usando Ollama local do servidor (11434/11435/11436)';
      } else {
        const key = keys[provider] || '';
        if (key) {
          statusEl.style.color = 'var(--green)';
          statusEl.innerHTML = '<i class="fas fa-check-circle"></i> Chave personalizada ativa (' + provider + ')';
        } else {
          statusEl.style.color = 'var(--gray)';
          statusEl.textContent = 'Usando configuração do servidor para ' + provider;
        }
      }
    }
  } catch (e) { }
}

function normalizeTemperature(value, fallback = 0.7) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(2, parsed));
}

function normalizeMaxTokens(value, fallback = 8192) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const rounded = Math.round(parsed);
  return Math.max(256, Math.min(32768, rounded));
}

function normalizeInvestigationRangeHours(value, fallback = 24) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const rounded = Math.round(parsed);
  return Math.max(1, Math.min(336, rounded));
}

function syncTemperatureUI(value) {
  const temperature = normalizeTemperature(value, 0.7);
  const numInput = document.getElementById('cfgTemperature');
  const rangeInput = document.getElementById('cfgTemperatureRange');
  const status = document.getElementById('cfgTemperatureStatus');
  const display = temperature.toFixed(1);

  if (numInput && document.activeElement !== numInput) numInput.value = display;
  if (rangeInput && document.activeElement !== rangeInput) rangeInput.value = display;
  if (status) status.textContent = `Temperatura atual: ${display}`;
}

function syncMaxTokensUI(value) {
  const maxTokens = normalizeMaxTokens(value, 8192);
  const numInput = document.getElementById('cfgMaxTokens');
  const rangeInput = document.getElementById('cfgMaxTokensRange');
  const status = document.getElementById('cfgMaxTokensStatus');

  if (numInput && document.activeElement !== numInput) numInput.value = String(maxTokens);
  if (rangeInput && document.activeElement !== rangeInput) rangeInput.value = String(maxTokens);
  if (status) status.textContent = `Max tokens atual: ${maxTokens}`;
}

function syncInvestigationRangeUI(value) {
  const hours = normalizeInvestigationRangeHours(value, 24);
  const numInput = document.getElementById('cfgOpsActivityRangeHours');
  const rangeInput = document.getElementById('cfgOpsActivityRangeRange');
  const status = document.getElementById('cfgOpsActivityRangeStatus');

  if (numInput && document.activeElement !== numInput) numInput.value = String(hours);
  if (rangeInput && document.activeElement !== rangeInput) rangeInput.value = String(hours);
  if (status) status.textContent = `Janela atual: ${hours}h`;
}

function setModelTemperature(value, opts) {
  const options = opts || {};
  const temperature = normalizeTemperature(value, getConfig().temperature);
  try {
    const saved = JSON.parse(localStorage.getItem('OliviaLegal.workspace.config') || '{}');
    saved.temperature = temperature;
    localStorage.setItem('OliviaLegal.workspace.config', JSON.stringify(saved));
  } catch (e) {
    console.warn('Failed to save model temperature:', e);
  }

  syncTemperatureUI(temperature);
  if (!options.silent && typeof addSystemBubble === 'function') {
    addSystemBubble(`Temperatura alterada para: ${temperature.toFixed(1)}`);
  }
  return temperature;
}

function setMaxTokens(value, opts) {
  const options = opts || {};
  const maxTokens = normalizeMaxTokens(value, getConfig().max_tokens);
  try {
    const saved = JSON.parse(localStorage.getItem('OliviaLegal.workspace.config') || '{}');
    saved.max_tokens = maxTokens;
    localStorage.setItem('OliviaLegal.workspace.config', JSON.stringify(saved));
  } catch (e) {
    console.warn('Failed to save max tokens:', e);
  }

  syncMaxTokensUI(maxTokens);
  if (!options.silent && typeof addSystemBubble === 'function') {
    addSystemBubble(`Max tokens alterado para: ${maxTokens}`);
  }
  return maxTokens;
}

function setInvestigationRangeHours(value, opts) {
  const options = opts || {};
  const hours = normalizeInvestigationRangeHours(value, getConfig().investigation_range_hours);
  try {
    const saved = JSON.parse(localStorage.getItem('OliviaLegal.workspace.config') || '{}');
    saved.investigation_range_hours = hours;
    localStorage.setItem('OliviaLegal.workspace.config', JSON.stringify(saved));
  } catch (e) {
    console.warn('Failed to save investigation range hours:', e);
  }

  syncInvestigationRangeUI(hours);
  if (typeof window.renderAgentList === 'function') {
    window.renderAgentList();
  }
  if (!options.silent && typeof addSystemBubble === 'function') {
    addSystemBubble(`Janela de atividade alterada para: ${hours}h`);
  }
  return hours;
}

function restoreWorkspaceConfigUI() {
  const cfg = getConfig();
  syncTemperatureUI(cfg.temperature);
  syncMaxTokensUI(cfg.max_tokens);
  syncInvestigationRangeUI(cfg.investigation_range_hours);
}

// Get configuration
function getConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem('OliviaLegal.workspace.config') || '{}');
    const model = normalizeWorkspaceModel(saved.model, 'deepseek-v4-flash');
    if (saved.model !== model) {
      saved.model = model;
      localStorage.setItem('OliviaLegal.workspace.config', JSON.stringify(saved));
    }
    return {
      model: normalizeRuntimeModelForProvider(saved.model, saved.provider || 'deepseek'),
      provider: saved.provider || 'deepseek',
      guided: saved.guided || false,
      auditor: saved.auditor || false,
      autonomy_level: saved.autonomy_level || 'medium',
      auditor_mode: saved.auditor_mode || 'simple',
      temperature: normalizeTemperature(saved.temperature, 0.7),
      max_tokens: normalizeMaxTokens(saved.max_tokens, 8192),
      investigation_range_hours: normalizeInvestigationRangeHours(saved.investigation_range_hours, 24)
    };
  } catch (e) {
    return {
      model: 'deepseek-v4-flash',
      provider: 'deepseek',
      guided: false,
      auditor: false,
      autonomy_level: 'medium',
      auditor_mode: 'simple',
      temperature: 0.7,
      max_tokens: 8192,
      investigation_range_hours: 24
    };
  }
}

// Update cost badge
function updateCostBadge() {
  const badge = document.getElementById('costBadge');
  if (!badge) return;

  if (sessionCostUsd > 0) {
    badge.textContent = `$${sessionCostUsd.toFixed(2)}`;
    badge.style.display = '';
  } else {
    badge.style.display = 'none';
  }
}

// Reset cost badge
function resetCostBadge() {
  sessionTokensIn = 0;
  sessionTokensOut = 0;
  sessionCostUsd = 0;
  updateCostBadge();
}

// Reset run counters
function resetRunCounters() {
  runTokensIn = 0;
  runTokensOut = 0;
}

// Format duration
function formatDuration(seconds) {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Expose functions to window scope
window.loadChatHistory = loadChatHistory;
window.loadChatFromServer = loadChatFromServer;
window.renderSavedChatsList = renderSavedChatsList;
window.loadSavedChatByName = loadSavedChatByName;
window.startRenameChat = startRenameChat;
window.commitRenameChat = commitRenameChat;
window.deleteSavedChat = deleteSavedChat;
window.loadLocalSavedChatByName = loadLocalSavedChatByName;
window.startRenameLocalChat = startRenameLocalChat;
window.commitRenameLocalChat = commitRenameLocalChat;
window.deleteLocalSavedChat = deleteLocalSavedChat;
window.saveChat = saveChat;
window.autoSaveChat = autoSaveChat;
window.saveToServer = saveChat;
window.loadSavedChat = loadSavedChat;
window.exportChatTxt = exportChatTxt;
window.exportChatJson = exportChatJson;
window.clearChat = clearChat;
window.loadModelCatalog = loadModelCatalog;
window.restoreApiKeyUI = restoreApiKeyUI;
window.getCustomApiKey = getCustomApiKey;
window.verifyApiKey = verifyApiKey;
window.switchModel = switchModel;
window.renderModelCards = renderModelCards;
window.selectProvider = selectProvider;
window.normalizeTemperature = normalizeTemperature;
window.normalizeMaxTokens = normalizeMaxTokens;
window.normalizeInvestigationRangeHours = normalizeInvestigationRangeHours;
window.syncTemperatureUI = syncTemperatureUI;
window.syncMaxTokensUI = syncMaxTokensUI;
window.syncInvestigationRangeUI = syncInvestigationRangeUI;
window.setModelTemperature = setModelTemperature;
window.setMaxTokens = setMaxTokens;
window.setInvestigationRangeHours = setInvestigationRangeHours;
window.restoreWorkspaceConfigUI = restoreWorkspaceConfigUI;
window.getConfig = getConfig;
window.updateCostBadge = updateCostBadge;
window.resetCostBadge = resetCostBadge;
window.resetRunCounters = resetRunCounters;
window.formatDuration = formatDuration;