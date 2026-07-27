/* ═══════════════════════════════════════════════════════════════════
   CHAT MODULE - Chat interface, streaming, and message handling
   ═══════════════════════════════════════════════════════════════════ */

if (typeof window.oliviaMode !== 'string') {
  window.oliviaMode = 'agent';
}

if (!window.OliviaLegal_KNOWLEDGE || typeof window.OliviaLegal_KNOWLEDGE !== 'object') {
  window.OliviaLegal_KNOWLEDGE = {
    studio: {
      title: 'Studio',
      description: 'Crie, edite e refine interfaces no Studio com geração e ajustes orientados por IA.',
      prompt: 'Abra o Studio e me ajude a construir uma página inicial moderna com foco em conversão.'
    },
    descoberta: {
      title: 'Descoberta',
      description: 'Centralize documentos, organize por categorias e extraia insights de forma progressiva.',
      prompt: 'Quero usar Descoberta para mapear os arquivos, entidades e cronologia do caso.'
    },
    casos: {
      title: 'Casos',
      description: 'Envie materiais do caso e execute o pipeline para estruturar contexto e próximos passos.',
      prompt: 'Inicie um novo caso e me guie no fluxo de ingestão, organização e análise.'
    },
    conhecimento: {
      title: 'Conhecimento',
      description: 'Consulte memória vetorial e grafo para recuperar contexto relevante com rastreabilidade.',
      prompt: 'Faça uma consulta de conhecimento e traga os pontos mais relevantes com síntese.'
    },
    arquitetura: {
      title: 'Arquitetura',
      description: 'Analise componentes, fluxos e dependências para orientar decisões técnicas.',
      prompt: 'Quero uma análise arquitetural do workspace com riscos e melhorias prioritárias.'
    },
    governo: {
      title: 'Governo',
      description: 'Estruture avaliações com foco em transparência, conformidade e prestação de contas.',
      prompt: 'Crie um roteiro de uso para setor público com foco em governança e conformidade.'
    },
    saude: {
      title: 'Saúde',
      description: 'Organize jornadas analíticas e documentação com atenção a contexto sensível.',
      prompt: 'Quero adaptar o workspace para um caso de saúde com fluxo de análise segura.'
    },
    corporativo: {
      title: 'Corporativo',
      description: 'Apoie operações de negócio com execução assistida e documentação estruturada.',
      prompt: 'Monte um fluxo corporativo para análise documental e decisão operacional.'
    },
    educacao: {
      title: 'Educação',
      description: 'Use o workspace para pesquisa, síntese e apoio pedagógico baseado em evidências.',
      prompt: 'Quero um plano de uso do workspace para projetos de educação e pesquisa aplicada.'
    },
    financeiro: {
      title: 'Financeiro',
      description: 'Aplique análise estruturada para compliance, contratos e decisões financeiras.',
      prompt: 'Me ajude a preparar uma análise financeira com foco em risco e conformidade.'
    }
  };
}

const PANEL_CONTEXT_PREF_KEY = 'olivia.panelContextSelection.v1';
let _panelContextSelection = { browser: true, preview: true, output: true };
let _assistantDebugContextPreview = false;
const _assistantCtxPreviewOpenedRunIds = new Set();
const _agentRunSessions = new Map();
const CHAT_MESSAGE_MAX_CHARS = 240000;
const ASSISTANT_CHAT_MESSAGE_MAX_CHARS = 120000;
const ASSISTANT_HISTORY_ENTRY_MAX_CHARS = 24000;
const ASSISTANT_HISTORY_MAX_TURNS = 120;
const ASSISTANT_IMPORTED_FILES_MAX_COUNT = 8;
const ASSISTANT_IMPORTED_FILE_MAX_CHARS = 24000;
const ASSISTANT_IMPORTED_TOTAL_MAX_CHARS = 120000;
const ASSISTANT_IMAGE_ATTACHMENTS_MAX_COUNT = 4;
const _runVisibleResponseState = new Map();
const _runToolCallCount = new Map();
const _runResponseAccumulator = new Map();
const _runAutoFinalizeState = {
  lastAt: 0,
  attemptsInWindow: 0,
};
const _RUN_AUTO_FINALIZE_COOLDOWN_MS = 60000;
const _RUN_AUTO_FINALIZE_MAX_ATTEMPTS = 1;
const OliviaLegal_LOADING_PERSONAS = {
  general: {
    coreIcon: 'fa-robot',
    title: 'Organizando contexto do agente enquanto o modelo trabalha.',
    desc: 'O backend pode levar algum tempo ao cruzar documentos, plano, memoria e ferramentas. Enquanto isso, a interface mostra o estado atual da execucao.',
    pills: [
      { icon: 'fa-folder-tree', text: 'Workspace e arquivos' },
      { icon: 'fa-brain', text: 'Memoria e contexto' },
      { icon: 'fa-screwdriver-wrench', text: 'Ferramentas e execucao' },
    ],
    disciplines: [
      { icon: 'fa-compass', title: 'Pesquisa', note: 'Leitura contextual dos arquivos e objetivos ativos.' },
      { icon: 'fa-list-check', title: 'Planejamento', note: 'Definicao de passos com escopo claro.' },
      { icon: 'fa-gears', title: 'Execucao', note: 'Aplicacao de ferramentas e acoes orientadas.' },
      { icon: 'fa-shield-check', title: 'Validacao', note: 'Conferencia de resultados e consistencia.' },
      { icon: 'fa-file-lines', title: 'Sintese', note: 'Resposta estruturada com proximos passos.' },
    ],
  },
  health: {
    coreIcon: 'fa-stethoscope',
    title: 'Organizando contexto da residencia enquanto o modelo trabalha.',
    desc: 'O backend pode levar algum tempo ao cruzar documentos, plano, memoria e ferramentas. Enquanto isso, a interface continua mostrando as areas do programa e o estado atual da execucao.',
    pills: [
      { icon: 'fa-notes-medical', text: 'SUS e territorio' },
      { icon: 'fa-file-waveform', text: 'Protocolos e artigos' },
      { icon: 'fa-users', text: 'Multiprofissional' },
    ],
    disciplines: [
      { icon: 'fa-user-nurse', title: 'Enfermagem', note: 'Cuidado longitudinal e coordenacao no territorio.' },
      { icon: 'fa-pills', title: 'Farmacia', note: 'Uso racional de medicamentos e apoio clinico.' },
      { icon: 'fa-person-walking', title: 'Fisioterapia', note: 'Funcionalidade, movimento e reabilitacao.' },
      { icon: 'fa-tooth', title: 'Odontologia', note: 'Saude bucal coletiva e cuidado integrado.' },
      { icon: 'fa-brain', title: 'Psicologia', note: 'Saude mental e escuta qualificada na atencao basica.' },
    ],
  },
  legal: {
    coreIcon: 'fa-scale-balanced',
    title: 'Organizando contexto juridico enquanto o modelo trabalha.',
    desc: 'O backend cruza documentos, memoria e ferramentas para montar uma leitura confiavel do caso e do escopo ativo.',
    pills: [
      { icon: 'fa-file-contract', text: 'Contratos e pecas' },
      { icon: 'fa-landmark', text: 'Normas e jurisprudencia' },
      { icon: 'fa-magnifying-glass', text: 'Risco e compliance' },
    ],
    disciplines: [
      { icon: 'fa-gavel', title: 'Normativo', note: 'Mapeamento de base legal aplicavel.' },
      { icon: 'fa-book-open', title: 'Precedentes', note: 'Leitura de decisoes e referencias relevantes.' },
      { icon: 'fa-file-signature', title: 'Contratos', note: 'Analise de clausulas, obrigacoes e riscos.' },
      { icon: 'fa-shield', title: 'Compliance', note: 'Checagem de aderencia e controles.' },
      { icon: 'fa-clipboard-check', title: 'Conclusao', note: 'Sintese objetiva com encaminhamentos.' },
    ],
  },
};

const OliviaLegal_LOADING_KEYWORDS = {
  health: ['coremu', 'residenc', 'saude', 'sus', 'ubs', 'enferm', 'farmac', 'fisioter', 'odont', 'psicolog', 'multiprof'],
  legal: ['legal', 'jurid', 'law', 'compliance', 'contrat', 'litig', 'regulator', 'governo'],
};

function _loadingPersonaMatch(text, words) {
  const hay = String(text || '').toLowerCase();
  return Array.isArray(words) && words.some((word) => hay.includes(String(word || '').toLowerCase()));
}

function _resolveLA8159LoadingPersona(modeLabel) {
  const label = String(modeLabel || 'Assistente').trim() || 'Assistente';
  const agent = (typeof selectedAgent !== 'undefined' && selectedAgent && typeof selectedAgent === 'object')
    ? selectedAgent
    : null;
  const cfg = (agent && agent.config && typeof agent.config === 'object') ? agent.config : {};
  const nestedGroup = (cfg.group && typeof cfg.group === 'object')
    ? String(cfg.group.name || cfg.group.id || '')
    : '';
  const hints = [
    agent && agent.name,
    agent && agent.description,
    cfg.group,
    cfg.group_name,
    cfg.group_id,
    cfg.team,
    cfg.cluster,
    cfg.cohort,
    cfg.domain_group,
    nestedGroup,
  ].map((v) => String(v || '').trim()).filter(Boolean).join(' | ');

  let persona = OliviaLegal_LOADING_PERSONAS.general;
  if (_loadingPersonaMatch(hints, OliviaLegal_LOADING_KEYWORDS.health)) {
    persona = OliviaLegal_LOADING_PERSONAS.health;
  } else if (_loadingPersonaMatch(hints, OliviaLegal_LOADING_KEYWORDS.legal)) {
    persona = OliviaLegal_LOADING_PERSONAS.legal;
  }
  return {
    label,
    coreIcon: persona.coreIcon || OliviaLegal_LOADING_PERSONAS.general.coreIcon,
    title: persona.title || OliviaLegal_LOADING_PERSONAS.general.title,
    desc: persona.desc || OliviaLegal_LOADING_PERSONAS.general.desc,
    pills: Array.isArray(persona.pills) ? persona.pills : OliviaLegal_LOADING_PERSONAS.general.pills,
    disciplines: Array.isArray(persona.disciplines) ? persona.disciplines : OliviaLegal_LOADING_PERSONAS.general.disciplines,
  };
}

// ── Pinned paths (absolute FS paths pinned by user from file trees) ──
const PINNED_PATHS_PREF_KEY = 'OliviaLegal.pinnedPaths.v1';
let _pinnedPaths = [];
function _loadPinnedPaths() {
  try {
    const raw = localStorage.getItem(PINNED_PATHS_PREF_KEY);
    if (!raw) return;
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) _pinnedPaths = arr.filter(x => x && x.abs);
  } catch (_) { }
}
function _savePinnedPaths() {
  try { localStorage.setItem(PINNED_PATHS_PREF_KEY, JSON.stringify(_pinnedPaths)); } catch (_) { }
}
_loadPinnedPaths();

function koutPinnedPaths() { return _pinnedPaths.slice(); }
function koutIsPinned(abs) { return _pinnedPaths.some(p => p.abs === String(abs || '')); }
function koutPinPath(abs, opts) {
  const a = String(abs || '').trim();
  if (!a) return false;
  if (_pinnedPaths.some(p => p.abs === a)) return false;
  _pinnedPaths.push({
    abs: a,
    kind: (opts && opts.kind) || 'file',
    label: (opts && opts.label) || a.split('/').pop() || a,
    origin: (opts && opts.origin) || '',
    added_at: new Date().toISOString(),
  });
  _savePinnedPaths();
  try { window.dispatchEvent(new CustomEvent('LA8159:pinned-paths-updated', { detail: _pinnedPaths.slice() })); } catch (_) { }
  if (typeof _toast === 'function') _toast('Path anexado ao contexto do agente', 'success');
  else if (typeof addSystemBubble === 'function') addSystemBubble(`Path fixado no contexto: ${a}`);
  return true;
}
function koutUnpinPath(abs) {
  const a = String(abs || '').trim();
  const before = _pinnedPaths.length;
  _pinnedPaths = _pinnedPaths.filter(p => p.abs !== a);
  if (_pinnedPaths.length === before) return false;
  _savePinnedPaths();
  try { window.dispatchEvent(new CustomEvent('LA8159:pinned-paths-updated', { detail: _pinnedPaths.slice() })); } catch (_) { }
  return true;
}
function koutClearPinnedPaths() {
  _pinnedPaths = [];
  _savePinnedPaths();
  try { window.dispatchEvent(new CustomEvent('LA8159:pinned-paths-updated', { detail: [] })); } catch (_) { }
}
function buildPinnedPathsContext() {
  if (!_pinnedPaths.length) return { text: '', count: 0 };
  const lines = _pinnedPaths.map(p => `- [${p.kind}] ${p.abs}${p.label && p.label !== p.abs.split('/').pop() ? `  (${p.label})` : ''}`);
  const body = `\n\n[PINNED PATHS — authoritative absolute filesystem paths; resolve any ambiguous file/folder references in this conversation against these]\n${lines.join('\n')}`;
  return { text: body, count: _pinnedPaths.length };
}


function _sanitizePromptPayloadText(value) {
  return String(value || '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}

function _capPromptPayloadText(value, maxChars) {
  const text = String(value || '');
  const cap = Number.isFinite(Number(maxChars)) ? Number(maxChars) : CHAT_MESSAGE_MAX_CHARS;
  if (text.length <= cap) return { text, truncated: false, omitted: 0 };
  const omitted = text.length - cap;
  const marker = `\n\n[Prompt compactado automaticamente: ${omitted} chars omitidos entre inicio e fim para estabilidade]\n\n`;
  if (cap <= marker.length + 80) {
    return {
      text: text.slice(0, cap),
      truncated: true,
      omitted,
    };
  }
  const headLen = Math.max(40, Math.floor((cap - marker.length) * 0.65));
  const tailLen = Math.max(40, cap - marker.length - headLen);
  return {
    text: text.slice(0, headLen) + marker + text.slice(text.length - tailLen),
    truncated: true,
    omitted,
  };
}

function _prepareAssistantImportedFilesPayload(payload) {
  const source = (payload && typeof payload === 'object') ? payload : {};
  const entries = Object.entries(source);
  const files = {};
  let usedChars = 0;
  let keptFiles = 0;
  let omittedFiles = 0;
  let omittedChars = 0;
  let truncated = false;

  for (const [rawName, rawContent] of entries) {
    if (keptFiles >= ASSISTANT_IMPORTED_FILES_MAX_COUNT) {
      omittedFiles += 1;
      continue;
    }

    const name = String(rawName || '').trim();
    if (!name) {
      omittedFiles += 1;
      continue;
    }

    const originalText = _sanitizePromptPayloadText(String(rawContent == null ? '' : rawContent));
    if (!originalText) {
      omittedFiles += 1;
      continue;
    }

    let text = originalText;
    if (text.length > ASSISTANT_IMPORTED_FILE_MAX_CHARS) {
      const compacted = _capPromptPayloadText(text, ASSISTANT_IMPORTED_FILE_MAX_CHARS);
      text = compacted.text;
      omittedChars += compacted.omitted;
      truncated = true;
    }

    if (usedChars + text.length > ASSISTANT_IMPORTED_TOTAL_MAX_CHARS) {
      const remaining = ASSISTANT_IMPORTED_TOTAL_MAX_CHARS - usedChars;
      if (remaining <= 220) {
        omittedFiles += 1;
        omittedChars += originalText.length;
        continue;
      }

      const compactedGlobal = _capPromptPayloadText(text, remaining);
      text = compactedGlobal.text;
      omittedChars += compactedGlobal.omitted;
      truncated = true;
    }

    files[name] = text;
    usedChars += text.length;
    keptFiles += 1;

    if (usedChars >= ASSISTANT_IMPORTED_TOTAL_MAX_CHARS) {
      break;
    }
  }

  return {
    files,
    keptFiles,
    omittedFiles,
    omittedChars,
    truncated,
  };
}

function _prepareAssistantImageAttachmentsPayload(payload) {
  const source = Array.isArray(payload) ? payload : [];
  const attachments = [];
  let omitted = 0;

  for (const raw of source) {
    if (attachments.length >= ASSISTANT_IMAGE_ATTACHMENTS_MAX_COUNT) {
      omitted += 1;
      continue;
    }
    const row = (raw && typeof raw === 'object') ? raw : {};
    const url = String(row.url || row.serverUrl || '').trim();
    if (!url || /^blob:/i.test(url)) {
      omitted += 1;
      continue;
    }

    const name = String(row.name || 'imagem').trim() || 'imagem';
    const mimeType = String(row.mime_type || row.mimeType || 'image/png').trim().toLowerCase() || 'image/png';
    const projectId = String(row.project_id || row.projectId || '').trim();
    const projectPath = String(row.project_path || row.projectPath || '').replace(/^\/+/, '').trim();
    const size = Number(row.size || 0);

    attachments.push({
      name,
      url,
      mime_type: mimeType,
      project_id: projectId,
      project_path: projectPath,
      size: Number.isFinite(size) && size > 0 ? Math.round(size) : 0,
    });
  }

  return { attachments, omitted };
}

function _resolveAssistantContextPreviewUrl(endpoint, runId) {
  const ep = String(endpoint || '').trim();
  const rid = String(runId || '').trim();
  let candidate = '';

  if (ep) {
    if (/^https?:\/\//i.test(ep)) {
      candidate = ep;
    } else if (/^\/api\//i.test(ep) && typeof API_BASE === 'string' && API_BASE) {
      candidate = `${String(API_BASE).replace(/\/$/, '')}${ep}`;
    } else if (ep.startsWith('/')) {
      candidate = ep;
    } else if (typeof API_BASE === 'string' && API_BASE) {
      candidate = `${String(API_BASE).replace(/\/$/, '')}/${ep.replace(/^\/+/, '')}`;
    } else {
      candidate = ep;
    }
  } else if (rid) {
    const base = (typeof API_BASE === 'string' && API_BASE) ? String(API_BASE).replace(/\/$/, '') : '';
    candidate = `${base}/api/assistant/context-preview?run_id=${encodeURIComponent(rid)}`;
  }

  if (!candidate) return '';
  try {
    return new URL(candidate, window.location.origin).href;
  } catch (_e) {
    return candidate;
  }
}

function _openAssistantContextPreviewInBrowser(eventPayload) {
  const evt = eventPayload || {};
  const runId = String(evt.run_id || '').trim();
  if (!runId || _assistantCtxPreviewOpenedRunIds.has(runId)) return '';

  const url = _resolveAssistantContextPreviewUrl(evt.endpoint, runId);
  if (!url) return '';

  let opened = false;
  if (typeof window.navigateBrowser === 'function') {
    window.navigateBrowser(url);
    const panel = document.getElementById('browserPanel');
    if (panel && !panel.classList.contains('open') && typeof toggleBrowserPanel === 'function') {
      toggleBrowserPanel();
    }
    opened = true;
  } else if (typeof window.open === 'function') {
    window.open(url, '_blank');
    opened = true;
  }

  if (opened) {
    _assistantCtxPreviewOpenedRunIds.add(runId);
    return url;
  }
  return '';
}

function _createLA8159LoadingStageMarkup(modeLabel) {
  const persona = _resolveLA8159LoadingPersona(modeLabel);
  const morphItems = persona.disciplines.map(function mapDiscipline(item, index) {
    return `
      <div class="OliviaLegal-loading-morph-item${index === 0 ? ' active' : ''}" data-loading-item>
        <div class="OliviaLegal-loading-morph-icon"><i class="fas ${item.icon}"></i></div>
        <div class="OliviaLegal-loading-morph-text">
          <strong>${escapeHtml(item.title)}</strong>
          <span>${escapeHtml(item.note)}</span>
        </div>
      </div>`;
  }).join('');

  return `
    <div class="OliviaLegal-loading-stage" data-loading-stage>
      <div class="OliviaLegal-loading-visual">
        <div class="OliviaLegal-loading-orbit"></div>
        <div class="OliviaLegal-loading-core">
          <i class="fas ${escapeHtml(persona.coreIcon)}"></i>
        </div>
        <div class="OliviaLegal-loading-morph">
          ${morphItems}
        </div>
      </div>
      <div class="OliviaLegal-loading-copy">
        <div class="OliviaLegal-loading-kicker">${escapeHtml(persona.label)} em andamento</div>
        <div class="OliviaLegal-loading-title">${escapeHtml(persona.title)}</div>
        <div class="OliviaLegal-loading-desc">${escapeHtml(persona.desc)}</div>
        <div class="OliviaLegal-loading-pills">
          ${persona.pills.map(function mapPill(pill) {
    return `<span class="OliviaLegal-loading-pill"><i class="fas ${escapeHtml(pill.icon)}"></i> ${escapeHtml(pill.text)}</span>`;
  }).join('')}
        </div>
      </div>
    </div>`;
}

function _startLA8159LoadingStageCycle(root) {
  if (!root || typeof root.querySelectorAll !== 'function') return null;
  const items = Array.from(root.querySelectorAll('[data-loading-item]'));
  if (items.length <= 1) return null;
  let index = 0;

  function applyActive(nextIndex) {
    items.forEach(function toggle(item, itemIndex) {
      item.classList.toggle('active', itemIndex === nextIndex);
    });
  }

  applyActive(index);
  return window.setInterval(function rotateStage() {
    index = (index + 1) % items.length;
    applyActive(index);
  }, 2600);
}

function _stopLA8159LoadingStageCycle(timerId) {
  if (timerId) window.clearInterval(timerId);
}

function _renderAssistantContextPreviewDebugUi() {
  const btn = document.getElementById('chatCtxPreviewToggleBtn');
  const label = document.getElementById('chatCtxPreviewToggleLabel');
  const enabled = !!_assistantDebugContextPreview;
  if (label) {
    label.textContent = enabled ? 'CtxDbg on' : 'CtxDbg off';
  }
  if (btn) {
    btn.classList.toggle('active', enabled);
    btn.title = enabled
      ? 'Debug de contexto ativo para esta conversa.'
      : 'Ativar debug de contexto para esta conversa.';
    btn.style.borderColor = enabled ? 'var(--amber)' : '';
    btn.style.color = enabled ? 'var(--amber)' : '';
  }
}

function setAssistantContextPreviewDebug(enabled, opts) {
  const options = opts || {};
  const next = !!enabled;
  const changed = _assistantDebugContextPreview !== next;
  _assistantDebugContextPreview = next;
  _renderAssistantContextPreviewDebugUi();
  if (typeof updateComposeContextBar === 'function') updateComposeContextBar();
  if (changed && !options.silent && typeof addSystemBubble === 'function') {
    addSystemBubble(next
      ? 'Debug de contexto ativado para esta conversa.'
      : 'Debug de contexto desativado para esta conversa.');
  }
}

function toggleAssistantContextPreviewDebug() {
  setAssistantContextPreviewDebug(!_assistantDebugContextPreview);
}

function getAssistantContextPreviewDebugEnabled() {
  return !!_assistantDebugContextPreview;
}

const CHAT_RUNTIME_ROUTE_META = {
  idle: {
    label: 'rota: detectando',
    className: 'route-idle',
    title: 'Nenhuma rota ativa.',
  },
  detecting: {
    label: 'rota: detectando',
    className: 'route-detecting',
    title: 'Aguardando sinais do runtime para identificar a rota.',
  },
  openclaude_tools: {
    label: 'rota: openclaude+tools',
    className: 'route-openclaude',
    title: 'Rota OpenClaude com suporte a ferramentas.',
  },
  remote_chat: {
    label: 'rota: chat-only',
    className: 'route-remote',
    title: 'Rota de modelo remoto em modo chat-only.',
  },
  ollama_chat: {
    label: 'rota: ollama chat',
    className: 'route-ollama',
    title: 'Rota local via Ollama (chat-only).',
  },
  error: {
    label: 'rota: erro',
    className: 'route-error',
    title: 'Falha ao identificar ou concluir a rota de runtime.',
  },
};

let _chatRuntimeRoute = 'idle';

function getChatRuntimeRoute() {
  return _chatRuntimeRoute;
}

function setChatRuntimeRoute(routeKey, reason) {
  const key = CHAT_RUNTIME_ROUTE_META[routeKey] ? routeKey : 'detecting';
  _chatRuntimeRoute = key;

  const meta = CHAT_RUNTIME_ROUTE_META[key] || CHAT_RUNTIME_ROUTE_META.detecting;
  const badge = document.getElementById('chatRuntimeRouteBadge');
  if (!badge) return;

  badge.textContent = meta.label;
  badge.className = `chat-runtime-badge ${meta.className}`;
  badge.style.display = key === 'idle' ? 'none' : 'inline-flex';
  badge.title = reason
    ? `${meta.title}\n${String(reason).trim()}`
    : meta.title;
}

function inferRuntimeRouteFromStatusMessage(message) {
  const msg = String(message || '').trim().toLowerCase();
  if (!msg) return '';

  if (msg.includes('usando ollama')) return 'ollama_chat';
  if (msg.includes('usando gemini')) return 'remote_chat';
  if (msg.includes('alternando para modelo remoto')) return 'remote_chat';
  if (msg.includes('modelo remoto')) return 'remote_chat';
  if (msg.includes('chat-only')) return 'remote_chat';
  if (msg.includes('inicializando openclaude')) return 'openclaude_tools';
  if (msg.includes('openclaude ativo')) return 'openclaude_tools';

  return '';
}

function updateRuntimeRouteFromTokenHint(text) {
  const lowered = String(text || '').toLowerCase();
  if (!lowered) return;
  if (lowered.includes('capability disclosure')) {
    setChatRuntimeRoute('remote_chat', 'Capability disclosure detectada na resposta.');
    return;
  }
  if (lowered.includes('chat-only language model') || lowered.includes('chat only language model')) {
    setChatRuntimeRoute('remote_chat', 'Resposta indica modo chat-only.');
    return;
  }
  if (lowered.includes('direct access to tools: no shell')) {
    setChatRuntimeRoute('remote_chat', 'Resposta indica sem acesso a ferramentas.');
  }
}

function _selectedAgentSessionKey() {
  if (selectedAgent && selectedAgent.agent_id) return String(selectedAgent.agent_id);
  return 'global';
}

function _activeSidebarTabKey() {
  var activeSection = document.querySelector('.sidebar-section.active');
  if (!activeSection || !activeSection.id) return '';
  if (activeSection.id.indexOf('tab-') !== 0) return '';
  return String(activeSection.id.slice(4) || '').trim();
}

function _resolveComposeSectionKey() {
  var raw = _activeSidebarTabKey();
  var map = {
    agents: 'main_primary',
    config: 'main_primary',
    docs: 'main_primary',
    shared: 'main_primary',
    history: 'main_primary',
    files: 'main_primary',
    projects: 'main_primary',
    architecture: 'main_primary',
    studio: 'studio',
    shaders: 'shaders',
    descoberta: 'descoberta',
    listening: 'listening',
    memory: 'memory',
    spaces: 'spaces',
    apiexplorer: 'apiexplorer',
    casebuilder: 'casebuilder',
    legalrouter: 'legalrouter',
    violations: 'violations',
    lawlib: 'lawlib',
  };
  return map[raw] || 'main_primary';
}

function _resolveComposeSectionContext() {
  var resolver = null;
  if (typeof window.oliviaResolveSectionAgentContext === 'function') {
    resolver = window.oliviaResolveSectionAgentContext;
  } else if (typeof window.LA8159ResolveSectionAgentContext === 'function') {
    resolver = window.LA8159ResolveSectionAgentContext;
  }

  var fallback = {
    sectionKey: 'main_primary',
    profile: null,
    agent: null,
    agentId: '',
    assigned: false,
    active: true,
    sessionKey: 'section:main_primary:default',
    system: '',
  };
  if (!resolver) return fallback;

  var sectionKey = _resolveComposeSectionKey();
  var ctx = resolver(sectionKey);
  if (ctx && ctx.profile) {
    ctx.sectionKey = sectionKey;
    return ctx;
  }

  var mainCtx = resolver('main_primary');
  if (mainCtx) {
    mainCtx.sectionKey = 'main_primary';
    return mainCtx;
  }
  return fallback;
}

function _buildOrchestrationProbe(sectionCtx, panelContext) {
  var ctx = sectionCtx || {};
  var panel = panelContext || { selectedLabels: [], selectedCount: 0, availableCount: 0 };
  var assignedAgent = ctx.agent || null;
  return {
    section_key: String(ctx.sectionKey || _resolveComposeSectionKey() || 'main_primary'),
    session_key: String(ctx.sessionKey || 'section:main_primary:default'),
    assigned: !!ctx.assigned,
    agent_id: String((assignedAgent && assignedAgent.agent_id) || ctx.agentId || ''),
    agent_name: String((assignedAgent && assignedAgent.name) || ''),
    agent_active: !!ctx.active,
    panel_context: {
      selected_labels: Array.isArray(panel.selectedLabels) ? panel.selectedLabels.slice() : [],
      selected_count: Number(panel.selectedCount || 0),
      available_count: Number(panel.availableCount || 0),
    },
    shared_context_count: (typeof _checkedShared !== 'undefined' && _checkedShared && typeof _checkedShared.size === 'number') ? _checkedShared.size : 0,
    docs_context_count: (typeof _checkedDocs !== 'undefined' && _checkedDocs && typeof _checkedDocs.size === 'number') ? _checkedDocs.size : 0,
    imported_files_count: (typeof _importedFiles !== 'undefined' && _importedFiles && typeof _importedFiles.size === 'number') ? _importedFiles.size : 0,
    pinned_paths_count: (Array.isArray(_pinnedPaths) ? _pinnedPaths.length : 0),
    at: new Date().toISOString(),
  };
}

function _emitOrchestrationProbe(probe, verbose) {
  if (!probe || typeof probe !== 'object') return;
  try {
    window.dispatchEvent(new CustomEvent('LA8159:orchestration-probe', { detail: probe }));
  } catch (_) { }
  if (!verbose || typeof addSystemBubble !== 'function') return;
  var labels = (probe.panel_context && Array.isArray(probe.panel_context.selected_labels))
    ? probe.panel_context.selected_labels.join(', ')
    : '';
  addSystemBubble(
    'Orchestration probe -> section: ' + (probe.section_key || 'main_primary')
    + ' | agent: ' + (probe.agent_name || probe.agent_id || 'none')
    + ' | panels: ' + String((probe.panel_context && probe.panel_context.available_count) || 0)
    + '/' + String((probe.panel_context && probe.panel_context.selected_count) || 0)
    + (labels ? ' (' + labels + ')' : '')
  );
}

function _loadPanelContextSelection() {
  try {
    const raw = localStorage.getItem(PANEL_CONTEXT_PREF_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    _panelContextSelection = {
      browser: parsed && parsed.browser !== false,
      preview: parsed && parsed.preview !== false,
      output: parsed && parsed.output !== false,
    };
  } catch (_) { }
}

function _savePanelContextSelection() {
  try { localStorage.setItem(PANEL_CONTEXT_PREF_KEY, JSON.stringify(_panelContextSelection)); }
  catch (_) { }
}

function _panelOpen(id) {
  const el = document.getElementById(id);
  return !!(el && el.classList.contains('open'));
}

function _compactText(text, maxChars) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  const lim = Number(maxChars) > 0 ? Number(maxChars) : 1200;
  return clean.length > lim ? (clean.slice(0, lim) + ' ...') : clean;
}

const _browserPanelContextState = {
  trackedHref: '',
  selectionText: '',
  focusedElement: '',
  clickedElement: '',
  hooked: false,
};

function _describeBrowserElement(el) {
  if (!el || !el.tagName) return '';
  let label = String(el.tagName || '').toLowerCase();
  if (el.id) label += `#${String(el.id).trim()}`;
  const cls = String(el.className || '').trim();
  if (cls) {
    const compact = cls.split(/\s+/).filter(Boolean).slice(0, 3).join('.');
    if (compact) label += `.${compact}`;
  }
  const text = _compactText(el.innerText || el.textContent || '', 140);
  if (text) label += ` :: ${text}`;
  return label;
}

function _attachBrowserPanelContextTracking(frameEl) {
  if (!frameEl) return;
  try {
    const win = frameEl.contentWindow;
    const doc = win && win.document;
    if (!win || !doc) return;
    const href = String((win.location && win.location.href) || frameEl.src || '').trim();
    if (href) _browserPanelContextState.trackedHref = href;
    if (win.__oliviaPanelContextTrackingInstalled) return;
    win.__oliviaPanelContextTrackingInstalled = true;

    const updateSelection = () => {
      try {
        const selected = win.getSelection ? String(win.getSelection() || '') : '';
        const compact = _compactText(selected, 420);
        if (compact) _browserPanelContextState.selectionText = compact;
      } catch (_) { }
    };

    doc.addEventListener('selectionchange', updateSelection, { passive: true });
    doc.addEventListener('focusin', (ev) => {
      _browserPanelContextState.focusedElement = _describeBrowserElement(ev && ev.target);
    }, true);
    doc.addEventListener('click', (ev) => {
      _browserPanelContextState.clickedElement = _describeBrowserElement(ev && ev.target);
      updateSelection();
    }, true);

    updateSelection();
    _browserPanelContextState.hooked = true;
  } catch (_) {
    _browserPanelContextState.hooked = false;
  }
}

function _bindBrowserPanelContextTracking() {
  const frame = document.getElementById('browserFrame');
  if (!frame || frame.dataset.panelContextBound === '1') return;
  frame.dataset.panelContextBound = '1';

  frame.addEventListener('load', () => {
    _attachBrowserPanelContextTracking(frame);
    if (typeof refreshPanelContextStatus === 'function') refreshPanelContextStatus();
  });

  // Best effort for already-loaded iframe.
  setTimeout(() => {
    _attachBrowserPanelContextTracking(frame);
  }, 120);
}

function _browserPanelNetworkSummary(frameWin) {
  try {
    if (!frameWin || !frameWin.performance || typeof frameWin.performance.getEntriesByType !== 'function') return '';
    const navEntries = frameWin.performance.getEntriesByType('navigation') || [];
    const nav = navEntries.length ? navEntries[navEntries.length - 1] : null;
    const resources = frameWin.performance.getEntriesByType('resource') || [];
    const recent = resources.slice(-6).map((entry) => {
      let shortName = '';
      try {
        const parsed = new URL(String(entry.name || ''), frameWin.location && frameWin.location.href ? frameWin.location.href : window.location.href);
        shortName = (parsed.pathname || '/').slice(-80);
      } catch (_) {
        shortName = _compactText(String(entry.name || ''), 80);
      }
      const dur = Math.round(Number(entry.duration || 0));
      const initType = String(entry.initiatorType || 'resource');
      return `${shortName} (${initType}, ${dur}ms)`;
    });

    const lines = [];
    if (nav) {
      const dcl = Math.round(Number(nav.domContentLoadedEventEnd || 0));
      const load = Math.round(Number(nav.loadEventEnd || 0));
      lines.push(`Rede: nav dcl=${dcl}ms load=${load}ms recursos=${resources.length}`);
    } else if (resources.length) {
      lines.push(`Rede: recursos recentes=${resources.length}`);
    }
    if (recent.length) lines.push(`Rede recentes: ${recent.join(' | ')}`);
    return lines.join('\n');
  } catch (_) {
    return '';
  }
}

function formatPanelContextLabel(panelKeyOrLabel) {
  const raw = String(panelKeyOrLabel || '').toLowerCase();
  const normalized = raw
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z]/g, '');
  if (normalized === 'browser' || normalized === 'navegador') return 'Browser';
  if (normalized === 'preview' || normalized === 'previa') return 'Preview';
  if (normalized === 'output' || normalized === 'saida') return 'Saida';
  return String(panelKeyOrLabel || '').trim() || 'Painel';
}

function _browserPanelSnapshot() {
  const open = _panelOpen('browserPanel');
  const urlBar = document.getElementById('browserUrlBar');
  const frame = document.getElementById('browserFrame');
  const url = (urlBar && urlBar.value) || (frame && frame.src) || '';
  if (!open || !url || url === 'about:blank') {
    return { key: 'browser', label: formatPanelContextLabel('browser'), available: false, content: '' };
  }
  let details = `URL: ${url}`;
  try {
    if (frame && frame.contentDocument) {
      _attachBrowserPanelContextTracking(frame);
      const title = frame.contentDocument.title || '';
      const bodyText = _compactText(frame.contentDocument.body ? frame.contentDocument.body.innerText : '', 1400);
      let selected = '';
      try {
        selected = frame.contentWindow && frame.contentWindow.getSelection
          ? _compactText(String(frame.contentWindow.getSelection() || ''), 420)
          : '';
      } catch (_) {
        selected = '';
      }
      if (selected) _browserPanelContextState.selectionText = selected;
      let focused = _browserPanelContextState.focusedElement;
      try {
        if (!focused && frame.contentDocument.activeElement) {
          focused = _describeBrowserElement(frame.contentDocument.activeElement);
        }
      } catch (_) { }

      if (title) details += `\nTitulo: ${title}`;
      if (bodyText) details += `\nConteudo visivel: ${bodyText}`;
      if (_browserPanelContextState.selectionText) {
        details += `\nArea destacada/selecionada: ${_browserPanelContextState.selectionText}`;
      }
      if (focused) details += `\nElemento em foco: ${focused}`;
      if (_browserPanelContextState.clickedElement) {
        details += `\nUltimo elemento clicado: ${_browserPanelContextState.clickedElement}`;
      }
      const network = _browserPanelNetworkSummary(frame.contentWindow);
      if (network) details += `\n${network}`;
    }
  } catch (_) {
    details += '\nConteudo da pagina nao legivel (origem externa), usando apenas URL.';
  }
  return { key: 'browser', label: formatPanelContextLabel('browser'), available: true, content: details };
}

function _previewPanelSnapshot() {
  const open = _panelOpen('previewPanel');
  const state = window._previewState || {};
  const titleEl = document.getElementById('previewPanelTitle');
  const title = titleEl ? titleEl.textContent.trim() : 'Preview';
  const url = state.url || '';
  const name = state.name || '';
  if (!open || !url || url === 'about:blank') {
    return { key: 'preview', label: formatPanelContextLabel('preview'), available: false, content: '' };
  }
  const details = [
    `Arquivo: ${name || 'desconhecido'}`,
    `URL: ${url}`,
    `Painel: ${title}`,
  ].join('\n');
  return { key: 'preview', label: formatPanelContextLabel('preview'), available: true, content: details };
}

function _outputPanelSnapshot() {
  const open = _panelOpen('outputPanel');
  const activeTab = document.querySelector('#outputTabs .output-tab-item.active .output-tab-title');
  const outputBody = document.getElementById('outputBody');
  const title = activeTab ? activeTab.textContent.trim() : '';
  const excerpt = _compactText(outputBody ? outputBody.innerText : '', 1200);
  const hasInfo = !!(title || excerpt);
  if (!open || !hasInfo) {
    return { key: 'output', label: formatPanelContextLabel('output'), available: false, content: '' };
  }
  const lines = [];
  if (title) lines.push(`Aba ativa: ${title}`);
  if (excerpt) lines.push(`Conteudo visivel: ${excerpt}`);
  return { key: 'output', label: formatPanelContextLabel('output'), available: true, content: lines.join('\n') };
}

function buildSelectedPanelContext() {
  const snapshots = [_browserPanelSnapshot(), _previewPanelSnapshot(), _outputPanelSnapshot()];
  const selected = snapshots.filter(s => _panelContextSelection[s.key]);
  const available = selected.filter(s => s.available && s.content);
  const selectedLabels = selected.map(s => formatPanelContextLabel(s.key || s.label));

  if (selected.length === 0) {
    return {
      text: '',
      selectedCount: 0,
      availableCount: 0,
      selectedLabels: [],
      snapshots,
    };
  }

  if (available.length === 0) {
    const selectedLine = selectedLabels.length ? selectedLabels.join(', ') : 'none';
    return {
      text: `\n\n[CONTEXT FROM SELECTED PANELS]\nSelected panels: ${selectedLine}\nNo readable active panel content was available at send time.`,
      selectedCount: selected.length,
      availableCount: 0,
      selectedLabels,
      snapshots,
    };
  }

  const unavailable = selected.filter(s => !(s.available && s.content));
  const blocks = available.map(s => `[${formatPanelContextLabel(s.key || s.label)}]\n${s.content}`);
  const unavailableNote = unavailable.length
    ? `\n\nUnavailable selected panels: ${unavailable.map(s => formatPanelContextLabel(s.key || s.label)).join(', ')}`
    : '';
  return {
    text: `\n\n[CONTEXT FROM SELECTED PANELS (${available.length} painel${available.length !== 1 ? 'eis' : ''})]\n\n${blocks.join('\n\n')}${unavailableNote}`,
    selectedCount: selected.length,
    availableCount: available.length,
    selectedLabels,
    snapshots,
  };
}

function getPanelContextSelectionSummary() {
  const selected = [];
  if (_panelContextSelection.browser) selected.push(formatPanelContextLabel('browser'));
  if (_panelContextSelection.preview) selected.push(formatPanelContextLabel('preview'));
  if (_panelContextSelection.output) selected.push(formatPanelContextLabel('output'));
  return selected;
}

function refreshPanelContextStatus() {
  const hint = document.getElementById('panelContextHint');
  const data = buildSelectedPanelContext();

  const uiMap = {
    browser: document.getElementById('panelCtxOptionBrowser'),
    preview: document.getElementById('panelCtxOptionPreview'),
    output: document.getElementById('panelCtxOptionOutput'),
  };
  data.snapshots.forEach(s => {
    const el = uiMap[s.key];
    if (!el) return;
    el.classList.toggle('inactive', !_panelContextSelection[s.key]);
    el.classList.toggle('unavailable', _panelContextSelection[s.key] && !s.available);
  });

  if (hint) {
    hint.textContent = `${data.availableCount}/${data.selectedCount} painéis ativos selecionados`;
  }

  if (typeof updateComposeContextBar === 'function') {
    updateComposeContextBar();
  }

  try {
    window.dispatchEvent(new CustomEvent('olivia:panel-context-updated', { detail: data }));
    window.dispatchEvent(new CustomEvent('LA8159:panel-context-updated', { detail: data }));
  } catch (_) { }
}

function setPanelContextEnabled(panelKey, enabled) {
  if (!Object.prototype.hasOwnProperty.call(_panelContextSelection, panelKey)) return;
  _panelContextSelection[panelKey] = !!enabled;
  _savePanelContextSelection();
  refreshPanelContextStatus();
}

function initPanelContextControls() {
  _loadPanelContextSelection();
  const cBrowser = document.getElementById('panelCtxBrowser');
  const cPreview = document.getElementById('panelCtxPreview');
  const cOutput = document.getElementById('panelCtxOutput');
  if (cBrowser) cBrowser.checked = !!_panelContextSelection.browser;
  if (cPreview) cPreview.checked = !!_panelContextSelection.preview;
  if (cOutput) cOutput.checked = !!_panelContextSelection.output;
  refreshPanelContextStatus();
}

function _applyUnifiedLA8159ModeUi(showNotice) {
  window.oliviaMode = 'agent';

  const toggle = document.getElementById('modeToggleSwitch');
  const labelAssistant = document.getElementById('modeLabelAssistant');
  const labelAgent = document.getElementById('modeLabelAgent');
  const icon = document.getElementById('modeIcon');
  const desktopToggle = document.getElementById('desktopModeToggle');
  const desktopLabel = document.getElementById('desktopModeLabel');
  const chatAgentName = document.getElementById('chatAgentName');
  const chatAgentBadge = document.getElementById('chatAgentBadge');

  if (toggle) {
    toggle.classList.add('agent');
    toggle.setAttribute('aria-disabled', 'true');
  }
  if (labelAssistant) labelAssistant.classList.remove('active');
  if (labelAgent) labelAgent.classList.add('active');
  if (icon) icon.className = 'fas fa-robot mode-toggle-icon active';
  if (desktopToggle) {
    desktopToggle.classList.add('agent');
    desktopToggle.setAttribute('aria-disabled', 'true');
  }
  if (desktopLabel) desktopLabel.textContent = 'Agente';
  if (chatAgentName) {
    if (selectedAgent && selectedAgent.name) {
      chatAgentName.textContent = selectedAgent.name;
    } else {
      chatAgentName.textContent = 'LA8159 Agent';
    }
  }
  if (chatAgentBadge) chatAgentBadge.style.display = '';

  if (showNotice) {
    addSystemBubble('Modo unico ativo: Agente (OpenClaude).');
  }
}

// Show chat view (hide welcome)
function showChatView() {
  const welcome = document.getElementById('welcomeState');
  const chatLog = document.getElementById('chatLog');
  const chatHeader = document.getElementById('chatHeader');
  const chatToolbar = document.getElementById('chatToolbar');
  if (typeof spacesHideView === 'function') spacesHideView();
  if (typeof shadersHideView === 'function') shadersHideView();
  if (typeof violationsHideView === 'function') violationsHideView();
  if (typeof lawLibHideView === 'function') lawLibHideView();
  if (typeof legalRouterHideView === 'function') legalRouterHideView();
  if (welcome) welcome.classList.add('hidden');
  if (chatLog) chatLog.classList.add('visible');
  if (chatHeader) chatHeader.classList.add('visible');
  if (chatToolbar) chatToolbar.style.display = '';
}

// Show welcome view (reset chat)
function showWelcomeView() {
  const welcome = document.getElementById('welcomeState');
  const chatLog = document.getElementById('chatLog');
  const chatHeader = document.getElementById('chatHeader');
  const chatToolbar = document.getElementById('chatToolbar');
  if (typeof spacesHideView === 'function') spacesHideView();
  if (typeof shadersHideView === 'function') shadersHideView();
  if (typeof violationsHideView === 'function') violationsHideView();
  if (typeof lawLibHideView === 'function') lawLibHideView();
  if (typeof legalRouterHideView === 'function') legalRouterHideView();
  if (welcome) welcome.classList.remove('hidden');
  if (chatLog) { chatLog.classList.remove('visible'); chatLog.innerHTML = ''; }
  if (chatHeader) chatHeader.classList.remove('visible');
  if (chatToolbar) chatToolbar.style.display = 'none';
  chatHistory.length = 0;
  _assistantCtxPreviewOpenedRunIds.clear();
  setAssistantContextPreviewDebug(false, { silent: true });
  setChatRuntimeRoute('idle');
}

// Toggle Olivia mode between assistant and agent
function toggleOliviaMode() {
  _applyUnifiedLA8159ModeUi(true);
  // Close dropdown after toggle
  const mobileDropdown = document.getElementById('mobileDropdown');
  if (mobileDropdown) mobileDropdown.classList.remove('open');
  console.log('[Stream] Mode \u2192 agent (POST /run)');
}

// Reset to welcome when clicking replied workspace label
function resetToWelcome(event) {
  const wsLabel = document.getElementById('navWorkspaceLabel');
  // Only handle click if label is in "replied" state
  if (!wsLabel || !wsLabel.classList.contains('replied')) return;

  event.preventDefault();
  event.stopPropagation();

  // Clear chat
  const chatLog = document.getElementById('chatLog');
  if (chatLog) chatLog.innerHTML = '';
  chatLog.classList.remove('visible');

  // Show welcome state
  const welcomeState = document.getElementById('welcomeState');
  if (welcomeState) welcomeState.classList.remove('hidden');

  _assistantCtxPreviewOpenedRunIds.clear();
  setAssistantContextPreviewDebug(false, { silent: true });
  setChatRuntimeRoute('idle');

  // Remove replied class
  wsLabel.classList.remove('replied');
}

// Use hint from knowledge base
function useHint(key) {
  const input = document.getElementById('chatInput');
  const knowledge = window.OliviaLegal_KNOWLEDGE[key];

  if (window.oliviaMode === 'assistant' && knowledge) {
    // In assistant mode, show explanation about the feature
    showChatView();
    addBubble('user', `<p>O que é o <strong>${knowledge.title}</strong>?</p>`);
    setTimeout(() => {
      const md = marked.parse(knowledge.description);
      addBubble('agent', `<div class="answer-md">${md}</div>`);
    }, 500);
  } else if (knowledge) {
    // In agent mode, use the prompt to start agentic task
    if (input) { input.value = knowledge.prompt; autoGrow(input); input.focus(); }
  } else {
    // Fallback for unknown keys
    if (input) { input.value = key; autoGrow(input); input.focus(); }
  }
}

// Scroll mobile hints carousel left/right
function scrollHintsCarousel(direction) {
  const track = document.getElementById('hintsCarouselTrack');
  if (!track) return;

  const viewport = track.parentElement;
  const baseWidth = viewport ? viewport.clientWidth : track.clientWidth;
  const step = Math.max(140, Math.floor(baseWidth * 0.75));
  const dir = direction < 0 ? -1 : 1;

  track.scrollBy({
    left: dir * step,
    behavior: 'smooth'
  });
}

// Add chat bubble to log
function addBubble(role, html, skipHistory) {
  showChatView();
  const log = document.getElementById('chatLog');
  const div = document.createElement('div');
  div.className = `chat-bubble ${role}`;
  div.innerHTML = html;
  log.appendChild(div);
  _bindChatFileLinkInteractions(div);
  log.scrollTop = log.scrollHeight;
  if (!skipHistory) chatHistory.push({ role, html, timestamp: new Date().toISOString() });
  return div;
}

// Add system bubble (simple wrapper)
function addSystemBubble(text) {
  addBubble('system', `<p>${escapeHtml(text)}</p>`);
}

// Add thinking bubble with animated dots
function addThinkingBubble() {
  const log = document.getElementById('chatLog');
  const div = document.createElement('div');
  div.className = 'chat-bubble agent olivia-thinking';
  const phrases = [
    typeof window.t === 'function' ? window.t('chat.thinking.1', 'Pensando') : 'Pensando',
    typeof window.t === 'function' ? window.t('chat.thinking.2', 'Analisando') : 'Analisando',
    typeof window.t === 'function' ? window.t('chat.thinking.3', 'Verificando') : 'Verificando',
    typeof window.t === 'function' ? window.t('chat.thinking.4', 'Processando') : 'Processando'
  ];
  const phrase = phrases[Math.floor(Math.random() * phrases.length)];
  div.innerHTML = `${phrase} <span class="chat-thinking-dots"><span></span><span></span><span></span></span>`;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
  return div;
}

// Set thinking indicator in UI
function setThinking(active) {
  document.getElementById('chatThinkingBadge').style.display = active ? 'inline' : 'none';
  const btn = document.getElementById('sendBtn');
  btn.disabled = active;
  const stopBtn = document.getElementById('stopBtn');
  if (stopBtn) {
    stopBtn.style.display = active ? 'inline-flex' : 'none';
    stopBtn.disabled = false;
    stopBtn.innerHTML = '<i class="fas fa-stop"></i>';
  }
  if (btn) btn.style.display = active ? 'none' : 'inline-flex';
  // Update sidebar status
  const sidebarStatus = document.getElementById('sidebarStatus');
  const sidebarDot = document.getElementById('sidebarAgentDot');
  if (sidebarStatus) sidebarStatus.textContent = active ? 'running' : 'idle';
  if (sidebarDot && active) sidebarDot.classList.add('running');
  else if (sidebarDot) sidebarDot.classList.remove('running');
}

// Stop whichever stream is currently active (wired to composer stop button)
function stopActiveStream() {
  if (!activeStream || !activeStream.id) return;
  try { stopStream(activeStream.id, activeStream.type === 'guided'); } catch (e) { console.warn('[Stream] stopActiveStream:', e); }
  const stopBtn = document.getElementById('stopBtn');
  if (stopBtn) {
    stopBtn.disabled = true;
    stopBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  }
}

// Send message (main entry point)
async function sendMessage(presetText) {
  console.log('🎬 sendMessage called with presetText length:', presetText ? presetText.length : 0);
  _applyUnifiedLA8159ModeUi(false);

  const input = document.getElementById('chatInput');
  const message = (presetText || input.value || '').trim();
  if (!message) {
    console.warn('⚠️ sendMessage: No message to send!');
    return;
  }
  console.log('✅ Message prepared, length:', message.length);

  input.value = '';
  autoGrow(input);

  addBubble('user', `<p>${escapeHtml(message)}</p>`);
  console.log('💬 User bubble added to chat');

  console.log('🤖 Using agent mode pipeline');

  const sectionCtx = _resolveComposeSectionContext();
  if (sectionCtx && sectionCtx.assigned && !sectionCtx.active) {
    const inactiveName = sectionCtx.agent
      ? (sectionCtx.agent.name || sectionCtx.agent.agent_id)
      : sectionCtx.agentId;
    addSystemBubble(`Assigned main agent is inactive: ${inactiveName}. Activate it in Agents tab.`);
    return;
  }
  if (sectionCtx && sectionCtx.agent && (!selectedAgent || selectedAgent.agent_id !== sectionCtx.agent.agent_id)) {
    selectedAgent = sectionCtx.agent;
  }

  // Show context indicator if docs or files are attached
  const docCount = _checkedDocs.size;
  const importedContextEntries = Array.from(_importedFiles.values()).filter((file) => {
    if (!file) return false;
    if (file.type === 'text' && file.content) return true;
    if (file.type === 'image' || file.previewType === 'image') return file.contextEligible !== false;
    return false;
  });
  const fileCount = importedContextEntries.length;
  if (docCount > 0) {
    const names = Array.from(_checkedDocs.values()).map(d => d.name).join(', ');
    addBubble('system', `<div class="memory-used-indicator"><i class="fas fa-paperclip"></i> ${docCount} doc${docCount !== 1 ? 's' : ''} attached as context: ${escapeHtml(names)}</div>`, true);
  }
  if (fileCount > 0) {
    const names = importedContextEntries.map(f => f.name).join(', ');
    addBubble('system', `<div class="memory-used-indicator"><i class="fas fa-paperclip"></i> ${fileCount} imported file${fileCount !== 1 ? 's' : ''} as context: ${escapeHtml(names)}</div>`, true);
  }

  const config = getConfig();
  const runtimeModel = normalizeRuntimeModelForProvider(config.model, config.provider);
  console.log('⚙️ Config:', JSON.stringify(config, null, 2));

  const isGuided = config.guided;
  const isAuditor = config.auditor;

  // Fetch docs context if any are checked + imported files + shared data
  const docsContext = await getCheckedDocsContext();
  const filesContext = getImportedFilesContext();
  const sharedContext = await getSharedContext();
  const panelContext = buildSelectedPanelContext();
  const pinnedContext = buildPinnedPathsContext();
  const orchestrationProbe = _buildOrchestrationProbe(sectionCtx, panelContext);
  _emitOrchestrationProbe(orchestrationProbe, !!_assistantDebugContextPreview);
  const fullMessageRaw = message + docsContext + filesContext + sharedContext + panelContext.text + pinnedContext.text;
  const fullMessageSanitized = _sanitizePromptPayloadText(fullMessageRaw);
  const cappedPrompt = _capPromptPayloadText(fullMessageSanitized, CHAT_MESSAGE_MAX_CHARS);
  const fullMessage = cappedPrompt.text;
  if (cappedPrompt.truncated) {
    addSystemBubble(`Contexto anexado excedeu o limite de estabilidade e foi truncado (${cappedPrompt.omitted} chars omitidos).`);
  }
  console.log('📄 Full message length:', fullMessage.length, '(includes context)');

  const importedFilesPayload = {};
  const imageAttachmentsPayload = [];
  if (_importedFiles.size > 0) {
    for (const [name, info] of _importedFiles) {
      if (info.type === 'text' && info.content) importedFilesPayload[name] = info.content;
      const isImage = info && (info.type === 'image' || info.previewType === 'image');
      if (!isImage || info.contextEligible === false) continue;
      const imageUrl = String(info.serverUrl || info.url || '').trim();
      if (!imageUrl || /^blob:/i.test(imageUrl)) continue;
      imageAttachmentsPayload.push({
        name,
        url: imageUrl,
        mime_type: String(info.mimeType || info.mime_type || 'image/png').trim().toLowerCase() || 'image/png',
        project_id: String(info.projectId || '').trim(),
        project_path: String(info.projectPath || '').replace(/^\/+/, '').trim(),
        size: Number.isFinite(Number(info.size)) ? Number(info.size) : 0,
      });
    }
  }

  {
    const assistantOpts = {};
    if (sectionCtx && sectionCtx.agentId) assistantOpts.agentId = sectionCtx.agentId;
    else if (selectedAgent && selectedAgent.agent_id) assistantOpts.agentId = selectedAgent.agent_id;
    if (typeof getCurrentProjectId === 'function') {
      const projectId = getCurrentProjectId();
      if (projectId) assistantOpts.projectId = projectId;
    }
    if (sectionCtx && sectionCtx.sessionKey) assistantOpts.sessionKey = sectionCtx.sessionKey;
    if (sectionCtx && sectionCtx.system) assistantOpts.sectionSystem = sectionCtx.system;
    assistantOpts.sectionKey = orchestrationProbe.section_key;
    assistantOpts.panelContext = orchestrationProbe.panel_context;
    assistantOpts.orchestrationProbe = orchestrationProbe;
    assistantOpts.messageIncludesPanelContext = true;
    assistantOpts.debugContextPreview = !!_assistantDebugContextPreview;
    if (Object.keys(importedFilesPayload).length > 0) {
      assistantOpts.importedFiles = importedFilesPayload;
    }
    if (imageAttachmentsPayload.length > 0) {
      assistantOpts.imageAttachments = imageAttachmentsPayload;
    }
    await sendAssistantMessage(fullMessage, assistantOpts);
    return;
  }

  // Use the /run endpoint which routes internally based on agent_mode
  const url = `${API_BASE}/run`;
  console.log('🎯 Stream URL:', url);

  // Send the full model ID for Ollama so the backend can extract port info
  // from the "ollama|port|raw_id" prefix. For all other providers, send the
  // normalized runtime model (e.g. "deepseek-v4-flash" or "qwen3.5:9b").
  const sendModel = (config.provider === 'ollama' && config.model) ? config.model : runtimeModel;
  if (sendModel) body.model = sendModel;
  if (config.provider) body.provider = config.provider;
  if (config.base_url) body.base_url = config.base_url;
  body.section_key = orchestrationProbe.section_key;
  body.panel_context = orchestrationProbe.panel_context;
  body.orchestration_probe = orchestrationProbe;
  if (sectionCtx && sectionCtx.agentId) body.agent_id = sectionCtx.agentId;
  else if (selectedAgent && selectedAgent.agent_id) body.agent_id = selectedAgent.agent_id;
  const runSessionKey = (sectionCtx && sectionCtx.sessionKey) ? sectionCtx.sessionKey : _selectedAgentSessionKey();
  if (_agentRunSessions.has(runSessionKey)) {
    body.session_id = _agentRunSessions.get(runSessionKey);
  }
  if (typeof getCurrentProjectId === 'function') {
    const projectId = getCurrentProjectId();
    if (projectId) body.project_id = projectId;
  }
  // Include imported file contents so backend writes them to imported_files_dir before agent starts
  if (Object.keys(importedFilesPayload).length > 0) body.imported_files = importedFilesPayload;
  if (imageAttachmentsPayload.length > 0) body.image_attachments = imageAttachmentsPayload;
  if (Number.isFinite(Number(config.temperature))) body.temperature = Number(config.temperature);
  if (isAuditor) {
    body.agent_mode = 'auditor';
    body.mode = config.auditor_mode;
  } else if (isGuided) {
    body.agent_mode = 'guided';
    body.autonomy_level = config.autonomy_level || 'medium';
  } else {
    body.agent_mode = 'general';
  }

  console.log('🔧 Calling setThinking(true)');
  setThinking(true);
  const thinkingBubble = addThinkingBubble();
  console.log('💭 Thinking bubble added');

  console.log('🚀 Calling runStream...');
  await runStream(url, body, isGuided || isAuditor, thinkingBubble);
  console.log('✅ runStream completed');
}

// Send message in assistant mode — delegates streaming to OliviaAPI.assistant.chat()
async function sendAssistantMessage(message, opts) {
  const assistantOpts = opts || {};
  const config = getConfig();
  // Use the full config.model for Ollama (preserves "ollama|port|raw_id" prefix
  // so the backend can resolve the correct base URL and port). For other providers,
  // strip any internal prefix via normalizeRuntimeModelForProvider.
  const model = (config.provider === 'ollama' && config.model)
    ? config.model
    : (normalizeRuntimeModelForProvider(config.model, config.provider) || 'deepseek-v4-flash');
  const provider = config.provider || 'deepseek';
  const temperature = config.temperature;
  const maxTokensRaw = config.max_tokens;
  const maxTokens = Number.isFinite(Number(maxTokensRaw)) ? Number(maxTokensRaw) : null;
  const idleTimeoutRaw = (config && (config.stream_idle_timeout_ms != null ? config.stream_idle_timeout_ms : config.streamIdleTimeoutMs));
  const streamIdleTimeoutMs = Number.isFinite(Number(idleTimeoutRaw))
    ? Math.max(15000, Number(idleTimeoutRaw))
    : 600000;
  const assistantSessionKey = assistantOpts.sessionKey
    ? `assistant:${String(assistantOpts.sessionKey)}`
    : `assistant:${_selectedAgentSessionKey()}`;
  const assistantSystem = String(assistantOpts.sectionSystem || '').trim();
  const assistantSectionKey = String(assistantOpts.sectionKey || _resolveComposeSectionKey() || 'main_primary');

  const safeMessage = _sanitizePromptPayloadText(message);
  const safeUserHistory = _capPromptPayloadText(safeMessage, ASSISTANT_HISTORY_ENTRY_MAX_CHARS);
  _assistantHistory.push({ role: 'user', content: safeUserHistory.text });
  const panelContext = buildSelectedPanelContext();
  const panelMeta = (assistantOpts.panelContext && typeof assistantOpts.panelContext === 'object')
    ? assistantOpts.panelContext
    : {
      selected_labels: panelContext.selectedLabels || [],
      selected_count: Number(panelContext.selectedCount || 0),
      available_count: Number(panelContext.availableCount || 0),
    };
  const messageWithPanelContextRaw = assistantOpts.messageIncludesPanelContext
    ? safeMessage
    : (safeMessage + panelContext.text);
  const messageWithPanelContext = _capPromptPayloadText(messageWithPanelContextRaw, ASSISTANT_CHAT_MESSAGE_MAX_CHARS);
  if (messageWithPanelContext.truncated) {
    addSystemBubble(`Mensagem para o assistente compactada por estabilidade (${messageWithPanelContext.omitted} chars omitidos no meio; inicio e fim preservados).`);
  }
  const importedFilesPayload = _prepareAssistantImportedFilesPayload(assistantOpts.importedFiles);
  const imageAttachmentsPayload = _prepareAssistantImageAttachmentsPayload(assistantOpts.imageAttachments);
  if (importedFilesPayload.truncated || importedFilesPayload.omittedFiles > 0) {
    addSystemBubble(
      `Contexto de arquivos importados otimizado: ${importedFilesPayload.keptFiles} enviado(s), ${importedFilesPayload.omittedFiles} omitido(s).`
    );
  }
  if (imageAttachmentsPayload.omitted > 0) {
    addSystemBubble(`Anexos de imagem otimizados: ${imageAttachmentsPayload.attachments.length} enviado(s), ${imageAttachmentsPayload.omitted} omitido(s).`);
  }
  setChatRuntimeRoute('detecting', 'Mensagem enviada para /api/assistant/chat.');
  setThinking(true);
  const thinkingBubble = addThinkingBubble();

  // Create the response bubble up front for streaming
  const log = document.getElementById('chatLog');
  let bubble = null;
  let contentEl = null;
  let progressUi = null;
  let sawAssistantToken = false;

  try {
    if (thinkingBubble && thinkingBubble.parentNode) {
      thinkingBubble.parentNode.removeChild(thinkingBubble);
    }
    progressUi = createAssistantProgressUi();
    log.appendChild(progressUi.root);
    bubble = document.createElement('div');
    bubble.className = 'chat-bubble agent';
    bubble.innerHTML = '<div class="answer-md"><div class="LA8159-inline-loading">Aguardando os primeiros tokens da resposta...</div></div>';
    log.appendChild(bubble);
    contentEl = bubble.querySelector('.answer-md');
    log.scrollTop = log.scrollHeight;

    if (!window.LA8159API || !window.LA8159API.assistant || typeof window.LA8159API.assistant.chat !== 'function') {
      throw new Error('Assistant API client unavailable (expected LA8159API.assistant.chat).');
    }

    const fullContent = await window.LA8159API.assistant.chat(
      messageWithPanelContext.text,
      {
        model,
        provider,
        baseUrl: config.base_url,
        temperature,
        maxTokens,
        streamIdleTimeoutMs,
        system: assistantSystem || undefined,
        sectionKey: assistantSectionKey,
        agentId: assistantOpts.agentId,
        projectId: assistantOpts.projectId,
        panelContext: panelMeta,
        orchestrationProbe: (assistantOpts.orchestrationProbe && typeof assistantOpts.orchestrationProbe === 'object')
          ? assistantOpts.orchestrationProbe
          : undefined,
        importedFiles: importedFilesPayload.files,
        imageAttachments: imageAttachmentsPayload.attachments,
        debugContextPreview: !!assistantOpts.debugContextPreview,
        sessionKey: assistantSessionKey,
        history: _assistantHistory.slice(-ASSISTANT_HISTORY_MAX_TURNS),
        onEvent: function onAssistantEvent(evt) {
          updateAssistantProgressUi(progressUi, evt);
        }
      },
      function onToken(_token, accumulated) {
        sawAssistantToken = true;
        const hintSlice = String(accumulated || '').slice(-800);
        updateRuntimeRouteFromTokenHint(hintSlice);
        contentEl.innerHTML = marked.parse(accumulated);
        log.scrollTop = log.scrollHeight;
      }
    );

    const normalizedFullContent = String(fullContent || '').trim();
    let renderedAssistantHtml = '';
    if (normalizedFullContent) {
      renderedAssistantHtml = `<div class="answer-md">${marked.parse(normalizedFullContent)}</div>`;
      if (!sawAssistantToken && contentEl) {
        contentEl.innerHTML = marked.parse(normalizedFullContent);
      }
      finalizeAssistantProgressUi(progressUi, 'Resposta concluida.', false);
    } else {
      const fallbackMessage = 'A execucao terminou sem resposta textual. Tente novamente ou reformule a solicitacao.';
      renderedAssistantHtml = `<div class="answer-md"><p>${escapeHtml(fallbackMessage)}</p></div>`;
      if (contentEl) {
        contentEl.innerHTML = `<p>${escapeHtml(fallbackMessage)}</p>`;
      }
      setChatRuntimeRoute('error', fallbackMessage);
      finalizeAssistantProgressUi(progressUi, 'Concluido sem resposta textual.', false);
    }

    // Enrich file references with interactive pills after streaming completes
    if (contentEl) {
      contentEl.innerHTML = enrichChatFileLinks(contentEl.innerHTML);
      _bindChatFileLinkInteractions(bubble || contentEl);
    }
    chatHistory.push({
      role: 'assistant',
      html: contentEl ? `<div class="answer-md">${contentEl.innerHTML}</div>` : renderedAssistantHtml,
      timestamp: new Date().toISOString(),
    });

    if (normalizedFullContent) {
      const safeAssistantHistory = _capPromptPayloadText(
        _sanitizePromptPayloadText(normalizedFullContent),
        ASSISTANT_HISTORY_ENTRY_MAX_CHARS
      );
      _assistantHistory.push({ role: 'assistant', content: safeAssistantHistory.text });
    }
    const wsLabel = document.getElementById('navWorkspaceLabel');
    if (wsLabel) wsLabel.classList.add('replied');

  } catch (error) {
    var _aMsg = (error && error.message) || String(error);
    var _missingKeyMatch = _aMsg.match(/^MISSING_API_KEY:([^:]+):(.+)$/);
    if (_missingKeyMatch) {
      var _displayMsg = _missingKeyMatch[2];
      console.error('[Stream] MISSING_API_KEY for ' + _missingKeyMatch[1] + ': ' + _displayMsg);
      if (thinkingBubble && thinkingBubble.parentNode) {
        thinkingBubble.parentNode.removeChild(thinkingBubble);
      }
      if (contentEl) {
        contentEl.innerHTML = '<p style="color:var(--red)">' + _displayMsg + '</p>';
      } else {
        addBubble('agent', '<p style="color:var(--red)">' + _displayMsg + '</p>');
      }
      setChatRuntimeRoute('error', _displayMsg);
      var _cfgInput = document.getElementById('cfgApiKey');
      if (_cfgInput) {
        _cfgInput.style.borderColor = 'var(--red)';
        _cfgInput.style.borderWidth = '2px';
        _cfgInput.style.borderStyle = 'solid';
        _cfgInput.focus();
        _cfgInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } else {
    var _isAuth = _aMsg.indexOf('401') !== -1 || _aMsg.toLowerCase().indexOf('authentication') !== -1 || _aMsg.toLowerCase().indexOf('x-api-key') !== -1 || _aMsg.toLowerCase().indexOf('api key') !== -1 || _aMsg.toLowerCase().indexOf('api_key') !== -1;
    console.error('[Stream] Assistant error  model:', model, _isAuth ? '\u26a0\ufe0f CHECK API KEY' : '', '\n', _aMsg);
    if (thinkingBubble && thinkingBubble.parentNode) {
      thinkingBubble.parentNode.removeChild(thinkingBubble);
    }
    var _displayMsg = _isAuth
      ? 'Chave de API inv\xe1lida ou n\xe3o configurada no servidor (401). Verifique as configura\xe7\xf5es de API Key.'
      : 'Erro ao conectar: ' + escapeHtml(_aMsg);
    if (contentEl) {
      contentEl.innerHTML = `<p style="color:var(--red)">${_displayMsg}</p>`;
    } else {
      addBubble('agent', `<p style="color:var(--red)">${_displayMsg}</p>`);
    }
    setChatRuntimeRoute('error', _displayMsg);
    }
    finalizeAssistantProgressUi(progressUi, 'Falha ao gerar resposta.', true);
  } finally {
    setThinking(false);
  }
}

function createAssistantProgressUi() {
  const runId = `assistant-progress-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const root = document.createElement('div');
  root.className = 'assistant-progress active';
  root.innerHTML = `
    ${_createLA8159LoadingStageMarkup('Assistente')}
    <div class="assistant-progress-header">
      <span class="assistant-progress-title"><i class="fas fa-circle stream-pulse"></i> Processando resposta</span>
      <span class="assistant-progress-timer" id="${runId}-timer">0s</span>
    </div>
    <div class="assistant-progress-status" id="${runId}-status">Conectando ao modelo...</div>
    <div class="assistant-progress-steps" id="${runId}-steps"></div>
  `;

  const timerEl = root.querySelector(`#${runId}-timer`);
  const statusEl = root.querySelector(`#${runId}-status`);
  const stepsEl = root.querySelector(`#${runId}-steps`);
  const loadingStageTimer = _startLA8159LoadingStageCycle(root);
  const startedAt = Date.now();
  const timerId = setInterval(function updateTimer() {
    if (!timerEl) return;
    const elapsedMs = Date.now() - startedAt;
    timerEl.textContent = elapsedMs < 1000 ? `${elapsedMs}ms` : `${Math.round(elapsedMs / 1000)}s`;
  }, 250);

  return {
    root,
    statusEl,
    stepsEl,
    timerId,
    loadingStageTimer,
    nextStep: 1,
    tokenSeen: false,
    stepMap: new Map(),
    thinkingText: '',
  };
}

function upsertAssistantStep(ui, key, payload) {
  if (!ui || !ui.stepsEl || !key) return;
  let item = ui.stepMap.get(key);
  if (!item) {
    const idx = Number.isFinite(Number(payload.step)) ? Number(payload.step) : ui.nextStep++;
    const wrap = document.createElement('div');
    wrap.className = 'assistant-progress-step';
    wrap.innerHTML = `
      <div class="assistant-progress-step-head">
        <span class="assistant-progress-step-num">Etapa ${idx}</span>
        <span class="assistant-progress-step-title"></span>
      </div>
      <div class="assistant-progress-step-desc"></div>
      <details class="assistant-progress-step-details" style="display:none">
        <summary>Ver detalhes</summary>
        <pre></pre>
      </details>
    `;
    ui.stepsEl.appendChild(wrap);
    item = {
      wrap,
      titleEl: wrap.querySelector('.assistant-progress-step-title'),
      descEl: wrap.querySelector('.assistant-progress-step-desc'),
      detailsEl: wrap.querySelector('.assistant-progress-step-details'),
      detailsPreEl: wrap.querySelector('.assistant-progress-step-details pre'),
      detailText: '',
    };
    ui.stepMap.set(key, item);
  }

  if (payload.title) item.titleEl.textContent = payload.title;
  if (payload.description) item.descEl.textContent = payload.description;
  if (payload.detail) {
    item.detailText = payload.appendDetail && item.detailText
      ? `${item.detailText}\n\n${payload.detail}`
      : payload.detail;
    item.detailsPreEl.textContent = item.detailText;
    item.detailsEl.style.display = '';
  }

  const log = document.getElementById('chatLog');
  if (log) log.scrollTop = log.scrollHeight;
}

function _filesContextRootsInfo(roots) {
  if (!Array.isArray(roots) || !roots.length) {
    return { summary: '', detail: '' };
  }

  const normalized = roots.map((root) => {
    const item = (root && typeof root === 'object') ? root : {};
    const kind = String(item.kind || '').trim();
    const label = String(item.label || '').trim() || (
      kind === 'agent_workspace'
        ? 'workspace do agente'
        : (kind === 'project_root' ? 'raiz do projeto' : 'uploads')
    );
    const rel = String(item.relative_path || '').trim();
    const abs = String(item.absolute_path || '').trim();
    const displayPath = rel || abs;
    return {
      label,
      displayPath,
    };
  }).filter((item) => item.label || item.displayPath);

  if (!normalized.length) {
    return { summary: '', detail: '' };
  }

  const summary = normalized.map((item) => item.label).join(' + ');
  const detail = normalized
    .map((item) => `- ${item.label}: ${item.displayPath || '-'}`)
    .join('\n');

  return { summary, detail };
}

function updateAssistantProgressUi(ui, evt) {
  if (!ui || !evt) return;
  const eventType = evt.event || evt.type;

  if (eventType === 'status') {
    const msg = String(evt.message || '').trim();
    if (msg && ui.statusEl) ui.statusEl.textContent = msg;
    if (msg) {
      const inferredRoute = inferRuntimeRouteFromStatusMessage(msg);
      if (inferredRoute) setChatRuntimeRoute(inferredRoute, msg);
    }
    if (msg) {
      upsertAssistantStep(ui, 'backend-status', {
        title: 'Status do backend',
        description: msg,
      });
    }
    return;
  }

  if (eventType === 'token') {
    if (getChatRuntimeRoute() === 'idle') {
      setChatRuntimeRoute('detecting', 'Recebendo tokens do backend.');
    }
    if (!ui.tokenSeen) {
      ui.tokenSeen = true;
      if (ui.statusEl) ui.statusEl.textContent = 'Gerando resposta...';
      upsertAssistantStep(ui, 'token-start', {
        title: 'Geracao da resposta',
        description: 'O modelo iniciou a resposta em tempo real.',
      });
    }
    return;
  }

  if (eventType === 'tool_call') {
    const toolName = String(evt.tool_name || evt.tool || '').trim() || 'ferramenta';
    setChatRuntimeRoute('openclaude_tools', `tool_call: ${toolName}`);
    return;
  }

  if (eventType === 'tool_result') {
    const toolName = String(evt.tool_name || evt.tool || '').trim().toLowerCase();
    if (toolName && toolName !== 'response') {
      setChatRuntimeRoute('openclaude_tools', `tool_result: ${toolName}`);
    }
    return;
  }

  if (eventType === 'files_context') {
    const files = Array.isArray(evt.files) ? evt.files : [];
    const roots = Array.isArray(evt.roots) ? evt.roots : [];
    const rootsInfo = _filesContextRootsInfo(roots);
    const activeAgentName = (typeof selectedAgent === 'object' && selectedAgent && selectedAgent.name)
      ? String(selectedAgent.name)
      : 'agente ativo';
    const topFiles = files.slice(0, 10).map(function mapFile(f) {
      return f && f.path ? f.path : String(f || 'arquivo');
    });

    const desc = files.length
      ? `${files.length} arquivo(s) de contexto carregado(s) para ${activeAgentName}${rootsInfo.summary ? ` (${rootsInfo.summary})` : ''}.`
      : `Nenhum arquivo de contexto encontrado para ${activeAgentName}${rootsInfo.summary ? ` (${rootsInfo.summary})` : ''}.`;

    const detailChunks = [];
    if (rootsInfo.detail) detailChunks.push(`Escopo ativo:\n${rootsInfo.detail}`);
    if (topFiles.length) detailChunks.push(`Arquivos de contexto:\n${topFiles.join('\n')}`);

    upsertAssistantStep(ui, 'files-context', {
      step: 1,
      title: 'Contexto do agente carregado',
      description: desc,
      detail: detailChunks.join('\n\n'),
    });
    if (ui.statusEl) ui.statusEl.textContent = 'Contexto do agente pronto. Iniciando analise...';
    return;
  }

  if (eventType === 'context_preview') {
    const runId = String(evt.run_id || '').trim();
    const endpoint = String(evt.endpoint || '').trim();
    const openedUrl = _openAssistantContextPreviewInBrowser(evt);
    const fallbackUrl = _resolveAssistantContextPreviewUrl(endpoint, runId);
    const openTarget = openedUrl || fallbackUrl;
    upsertAssistantStep(ui, 'context-preview', {
      title: 'Debug de contexto',
      description: runId
        ? (openedUrl
          ? `Preview de contexto aberto no Browser Panel (${runId}).`
          : `Preview de contexto registrado (${runId}).`)
        : (openedUrl ? 'Preview de contexto aberto no Browser Panel.' : 'Preview de contexto registrado.'),
      detail: openTarget ? `Open Preview: ${openTarget}` : '',
    });
    if (ui.statusEl) {
      ui.statusEl.textContent = openedUrl
        ? 'Preview de contexto aberto no Browser Panel.'
        : 'Debug de contexto registrado para inspeção.';
    }
    return;
  }

  if (eventType === 'thinking') {
    const clean = String(evt.content || '')
      .replace(/<｜DSML｜[^>]*>[\s\S]*/g, '')
      .trim();
    if (!clean) return;
    ui.thinkingText = ui.thinkingText
      ? `${ui.thinkingText}\n\n${clean}`
      : clean;
    if (ui.thinkingText.length > 4000) {
      ui.thinkingText = ui.thinkingText.slice(ui.thinkingText.length - 4000);
    }
    upsertAssistantStep(ui, 'thinking', {
      title: 'Planejamento do modelo',
      description: 'Analisando a solicitacao e preparando os proximos passos.',
      detail: ui.thinkingText,
    });
    if (ui.statusEl) ui.statusEl.textContent = 'Analisando contexto e planejamento...';
    return;
  }

  if (eventType === 'agent_status') {
    const stepNum = Number(evt.step);
    const key = Number.isFinite(stepNum) ? `agent-status-${stepNum}` : `agent-status-${ui.nextStep}`;
    setChatRuntimeRoute('openclaude_tools', evt.message || 'agent_status emitido pelo backend.');
    upsertAssistantStep(ui, key, {
      step: stepNum,
      title: `Execucao${Number.isFinite(stepNum) ? ` da etapa ${stepNum}` : ''}`,
      description: evt.message || 'Executando acao no backend...',
      detail: evt.detail || '',
    });
    if (ui.statusEl) {
      ui.statusEl.textContent = evt.message || 'Executando etapa no backend...';
    }
    return;
  }

  if (eventType === 'session_id' && ui.statusEl) {
    setChatRuntimeRoute('openclaude_tools', 'Sessao OpenClaude ativa para continuidade.');
    ui.statusEl.textContent = 'Sessao atualizada para continuidade da conversa.';
  }
}

function finalizeAssistantProgressUi(ui, statusText, hasError) {
  if (!ui) return;
  if (ui.timerId) {
    clearInterval(ui.timerId);
    ui.timerId = null;
  }
  if (ui.loadingStageTimer) {
    _stopLA8159LoadingStageCycle(ui.loadingStageTimer);
    ui.loadingStageTimer = null;
  }
  if (ui.statusEl && statusText) ui.statusEl.textContent = statusText;
  if (ui.root) {
    ui.root.classList.remove('active');
    ui.root.classList.add(hasError ? 'error' : 'done');
  }
  if (hasError) {
    setChatRuntimeRoute('error', statusText || 'Falha durante a execucao.');
    return;
  }
  const currentRoute = getChatRuntimeRoute();
  if (currentRoute === 'idle' || currentRoute === 'detecting') {
    setChatRuntimeRoute('remote_chat', 'Fluxo concluido sem eventos de ferramentas.');
  }
}

// Send followup message in guided/auditor mode
async function sendFollowup(text) {
  if (!text) return;
  addBubble('user', `<p>${escapeHtml(text)}</p>`);
  const config = getConfig();
  const isGuided = config.guided;
  const isAuditor = config.auditor;

  // Use the /run endpoint which routes internally based on agent_mode
  const url = `${API_BASE}/run`;

  const panelContext = buildSelectedPanelContext();
  const pinnedContext = buildPinnedPathsContext();
  const sectionCtx = _resolveComposeSectionContext();
  const orchestrationProbe = _buildOrchestrationProbe(sectionCtx, panelContext);
  const body = { userPrompt: text + panelContext.text + pinnedContext.text };
  body.section_key = orchestrationProbe.section_key;
  body.panel_context = orchestrationProbe.panel_context;
  body.orchestration_probe = orchestrationProbe;
  if (sectionCtx && sectionCtx.agentId) body.agent_id = sectionCtx.agentId;
  else if (selectedAgent && selectedAgent.agent_id) body.agent_id = selectedAgent.agent_id;
  const runSessionKey = (sectionCtx && sectionCtx.sessionKey) ? sectionCtx.sessionKey : _selectedAgentSessionKey();
  if (_agentRunSessions.has(runSessionKey)) {
    body.session_id = _agentRunSessions.get(runSessionKey);
  }
  if (typeof getCurrentProjectId === 'function') {
    const projectId = getCurrentProjectId();
    if (projectId) body.project_id = projectId;
  }
  if (Number.isFinite(Number(config.temperature))) body.temperature = Number(config.temperature);
  if (isAuditor) {
    body.agent_mode = 'auditor';
    body.mode = config.auditor_mode;
  } else if (isGuided) {
    body.agent_mode = 'guided';
    body.autonomy_level = config.autonomy_level || 'medium';
  } else {
    body.agent_mode = 'general';
  }

  setThinking(true);
  const thinkingBubble = addThinkingBubble();
  await runStream(url, body, isGuided || isAuditor, thinkingBubble);
}

// Tool icon mapping — used by onToolCall to display relevant icons
const TOOL_ICONS = {
  str_replace_editor: 'fa-file-code', bash: 'fa-terminal',
  python_execute_context: 'fa-code', python_execute: 'fa-code',
  browser_use: 'fa-globe', qdrant_search: 'fa-search',
  qdrant_list_collections: 'fa-database', terminate: 'fa-flag-checkered',
  context_assemble: 'fa-layer-group', qdrant_ingest: 'fa-upload',
  neo4j_query: 'fa-project-diagram', ask_human: 'fa-user',
};

// Run streaming agent execution
async function runStream(url, body, isGuided, thinkingBubble) {
  const log = document.getElementById('chatLog');
  const startTime = Date.now();
  const runId = 'run-' + Date.now();
  setChatRuntimeRoute('detecting', 'Mensagem enviada para /run.');
  currentRunId = runId;
  stepCount = 0;
  activeGuidanceBar = null;
  _pendingThinkingContent = '';
  _runVisibleResponseState.set(runId, false);
  _runToolCallCount.set(runId, 0);
  _runResponseAccumulator.set(runId, '');

  // Create streaming log container
  const streamWrap = document.createElement('div');
  streamWrap.className = 'chat-bubble agent olivia-working';
  streamWrap.style.maxWidth = '96%';
  streamWrap.innerHTML = `
    ${_createLA8159LoadingStageMarkup('Agente')}
    <div class="stream-header">
      <span class="stream-header-label">
        <i class="fas fa-circle stream-pulse"></i>
        ${isGuided ? '<span class="stream-guided-tag">guiado</span>' : ''}
      </span>
      <div class="stream-header-actions">
        <span class="stream-timer" id="timer-${runId}">0s</span>
        <button class="stream-stop-btn" id="stop-${runId}" onclick="stopStream('${runId}',${isGuided})" title="Parar"><i class="fas fa-stop"></i></button>
      </div>
    </div>
    <div class="agent-log" id="log-${runId}"><div class="log-connecting">conectando&hellip;</div></div>`;
  const loadingStageTimer = _startLA8159LoadingStageCycle(streamWrap);

  // Helpers
  let logReady = false;
  const logEl = () => document.getElementById(`log-${runId}`);
  function initLog() { const el = logEl(); if (!logReady && el) { el.innerHTML = ''; logReady = true; } }
  function logAppend(el) { initLog(); const l = logEl(); if (l) { l.appendChild(el); } log.scrollTop = log.scrollHeight; }
  function makeEl(tag, cls, html) { const e = document.createElement(tag); e.className = cls; if (html !== undefined) e.innerHTML = html; return e; }

  // Remove thinking bubble if present
  if (thinkingBubble && thinkingBubble.parentNode) {
    thinkingBubble.parentNode.removeChild(thinkingBubble);
  }
  log.appendChild(streamWrap);
  log.scrollTop = log.scrollHeight;

  // Timer update
  const timerEl = document.getElementById(`timer-${runId}`);
  const timerInterval = setInterval(() => {
    if (timerEl) {
      const elapsed = Date.now() - startTime;
      timerEl.textContent = elapsed < 1000 ? (elapsed + 'ms') : (Math.round(elapsed / 1000) + 's');
    }
  }, 200);

  // Prepare event source or fetch with streaming
  let eventSource = null;
  try {
    console.log('🌐 Starting stream to', url);
    const runHeaders = { 'Content-Type': 'application/json' };
    if (typeof window.getCustomApiKey === 'function') {
      const streamKey = window.getCustomApiKey(body.provider);
      if (streamKey) {
        runHeaders.Authorization = 'Bearer ' + streamKey;
      }
    }
    const response = await fetch(url, {
      method: 'POST',
      headers: runHeaders,
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errText}`);
    }

    activeStream = {
      id: runId,
      abort: null,
      type: body.agent_mode || 'general',
      sessionKey: String(body.agent_id || _selectedAgentSessionKey()),
    };
    if (typeof window.startArtifactPolling === 'function') window.startArtifactPolling();
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim() || !line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (raw === '[DONE]') continue;

        try {
          const data = JSON.parse(raw);
          handleStreamEvent(data, runId, isGuided);
        } catch (e) {
          console.warn('Failed to parse SSE line:', line, e);
        }
      }
    }

    onDone(runId, isGuided);
  } catch (error) {
    var _errMsg = (error && error.message) || String(error);
    var _isNetErr = _errMsg === 'Load failed' || _errMsg === 'Failed to fetch' || _errMsg.indexOf('NetworkError') !== -1;
    var _agentMode = (body && body.agent_mode) || 'general';
    if (_isNetErr && !logReady) {
      console.error('[Stream] Connection failed — server unreachable?  mode:', _agentMode, ' url:', url);
      onError(runId, 'Servidor inacess\xedvel. Verifique se o backend est\xe1 ativo. (' + _agentMode + ')');
    } else {
      console.error('[Stream] Error  mode:', _agentMode, ' url:', url, '\n', error);
      onError(runId, _errMsg);
    }
  } finally {
    _stopLA8159LoadingStageCycle(loadingStageTimer);
    clearInterval(timerInterval);
    if (eventSource) eventSource.close();
    activeStream = null;
    setThinking(false);
  }
}

// Stream event handlers
function onStep(step) {
  stepCount = step;
  const runId = currentRunId;
  const log = document.getElementById(`log-${runId}`);
  if (!log) return;

  const stepNum = Number(step);
  const stepKey = Number.isFinite(stepNum) ? stepNum : stepCount;
  const existing = log.querySelector(`[data-step="${stepKey}"]`);
  if (existing) return;

  const el = document.createElement('div');
  el.className = 'log-step';
  el.dataset.step = String(stepKey);
  el.innerHTML = `<span class="log-step-num">Etapa ${escapeHtml(String(stepKey))}</span><span>Executando...</span>`;
  log.appendChild(el);
}

function onAgentStatus(data) {
  const runId = currentRunId;
  const log = document.getElementById(`log-${runId}`);
  if (!log) return;

  const stepNum = Number(data && data.step);
  if (Number.isFinite(stepNum)) {
    onStep(stepNum);
  }

  const detail = data && data.detail ? String(data.detail) : '';
  const message = data && data.message ? String(data.message) : 'Executando acao no backend';
  const el = document.createElement('div');
  el.className = 'log-agent-status';
  el.innerHTML = `<div class="log-step-line"><i class="fas fa-spinner fa-spin"></i><span>${escapeHtml(message)}</span></div>`;

  if (detail.trim()) {
    const details = document.createElement('details');
    details.className = 'log-agent-details';
    details.innerHTML = `<summary>Ver detalhes</summary><pre>${escapeHtml(detail)}</pre>`;
    el.appendChild(details);
  }

  log.appendChild(el);
  const chatLog = document.getElementById('chatLog');
  if (chatLog) chatLog.scrollTop = chatLog.scrollHeight;
}

function onCheckpoint(step) {
  const runId = currentRunId;
  const uid = `steer-${runId}-${step}`;

  const bar = document.createElement('div');
  bar.className = 'steer-bar';
  bar.innerHTML =
    `<div class="steer-bar-label"><i class="fas fa-pause-circle"></i> Passo ${step} — direcione ou continue</div>` +
    `<div class="steer-bar-actions">` +
    `<button class="steer-open-btn" onclick="document.getElementById('${uid}-row').style.display='flex';document.getElementById('${uid}-inp').focus()"><i class="fas fa-pen"></i> Guiar</button>` +
    `<button class="steer-auto-btn" onclick="sendGuidedResume('continue',${step})"><i class="fas fa-play"></i> Continuar</button>` +
    `<button class="steer-cancel-btn" onclick="stopStream('${runId}',true)"><i class="fas fa-ban"></i> Cancelar</button>` +
    `</div>` +
    `<div class="steer-input-row" id="${uid}-row" style="display:none">` +
    `<input type="text" class="steer-input" id="${uid}-inp" name="${uid}-inp" placeholder="Instrução de direção...">` +
    `<button class="steer-send-btn" onclick="sendGuidedResume(document.getElementById('${uid}-inp').value,${step})"><i class="fas fa-paper-plane"></i></button>` +
    `</div>`;

  activeGuidanceBar = bar;
  const logEl = document.getElementById(`log-${runId}`);
  if (logEl) logEl.appendChild(bar);
}

function onAwaitingGuidance() {
  const runId = currentRunId;
  const log = document.getElementById(`log-${runId}`);
  if (!log) return;

  // Show guidance request
  const req = document.createElement('div');
  req.className = 'log-guidance-request';
  req.innerHTML = '<i class="fas fa-hand-paper"></i> Aguardando orientação';
  log.appendChild(req);
}

function onAwaitingInput(toolName) {
  const runId = currentRunId;
  const log = document.getElementById(`log-${runId}`);
  if (!log) return;

  // If ask_human, we already rendered the input area in onToolCall — skip duplicate
  if (toolName === 'ask_human') return;

  const req = document.createElement('div');
  req.className = 'log-input-request';
  req.innerHTML = `<i class="fas fa-keyboard"></i> Aguardando entrada para ${escapeHtml(toolName)}`;
  log.appendChild(req);
}

// Handle agent thinking/reasoning events
function onThinking(content) {
  if (!content) return;
  const runId = currentRunId;
  const log = document.getElementById(`log-${runId}`);

  // Strip raw LLM function call tags (e.g. <｜DSML｜function_calls>...) 
  let clean = content.replace(/<｜DSML｜[^>]*>[\s\S]*/g, '').trim();
  if (!clean) return;

  // Store for final response rendering
  _pendingThinkingContent = clean;
  if (currentRunId) _runVisibleResponseState.set(currentRunId, true);

  // Show collapsible thinking block in the log
  if (log) {
    const el = document.createElement('div');
    el.className = 'log-thinking-block';
    const preview = clean.length > 200 ? clean.substring(0, 200) + '…' : clean;
    el.innerHTML = `
      <div class="log-thinking-toggle" onclick="this.nextElementSibling.classList.toggle('open');this.querySelector('.toggle-icon').classList.toggle('fa-chevron-right');this.querySelector('.toggle-icon').classList.toggle('fa-chevron-down')">
        <i class="fas fa-brain"></i>
        <span>Pensamento do agente</span>
        <i class="fas fa-chevron-right toggle-icon" style="margin-left:auto;font-size:10px"></i>
      </div>
      <div class="log-thinking-body">${escapeHtml(preview)}</div>
    `;
    log.appendChild(el);
  }
}

function onResumed() {
  if (activeGuidanceBar && activeGuidanceBar.parentNode) {
    activeGuidanceBar.parentNode.removeChild(activeGuidanceBar);
  }
  activeGuidanceBar = null;
}

function onStopped() {
  // Already handled by stopStream
}

function onSessionId(data) {
  const sid = String(data && data.session_id || '').trim();
  if (!sid) return;
  setChatRuntimeRoute('openclaude_tools', 'Sessao OpenClaude registrada no run.');
  const key = (activeStream && activeStream.sessionKey)
    ? String(activeStream.sessionKey)
    : _selectedAgentSessionKey();
  _agentRunSessions.set(key, sid);
}

// Keep a window-backed map so stream.js does not depend on config.js lexical state.
const _lastToolCallsMap = (window._lastToolCalls && typeof window._lastToolCalls === 'object')
  ? window._lastToolCalls
  : {};
window._lastToolCalls = _lastToolCallsMap;

// Generate a short human-readable summary for a tool call
function toolSummary(toolName, args) {
  if (!args) return '';
  const str = v => (typeof v === 'string' ? v : '');
  if (toolName === 'str_replace_editor') {
    const cmd = str(args.command);
    const path = str(args.path || args.file_path);
    if (path) {
      const filename = path.split('/').pop();
      return cmd ? cmd + ' · ' + filename : filename;
    }
    return cmd;
  }
  if (toolName === 'bash') return str(args.cmd || args.command).substring(0, 70);
  if (toolName === 'python_execute' || toolName === 'python_execute_context') return 'executar script';
  if (toolName === 'qdrant_search') return str(args.query).substring(0, 60);
  if (toolName === 'context_assemble') return str(args.query).substring(0, 60);
  if (toolName === 'browser_use') return str(args.url || args.action).substring(0, 60);
  if (toolName === 'neo4j_query') return str(args.template || args.query).substring(0, 60);
  if (toolName === 'terminate') return str(args.message).substring(0, 60);
  const first = Object.values(args).find(v => typeof v === 'string');
  return first ? first.substring(0, 60) : '';
}

// Detect if a tool call produced a file artifact (returns artifact obj or null)
function detectArtifact(toolName, args) {
  if (!args) return null;
  if (toolName === 'str_replace_editor') {
    const filePath = args.path || args.file_path;
    if (!filePath) return null;
    const cmd = (args.command || '').toLowerCase();
    if (cmd === 'view' || cmd === 'read') return null;
    const ext = filePath.split('.').pop().toLowerCase();
    const typeMap = { html: 'html', htm: 'html', css: 'code', js: 'code', ts: 'code', py: 'code', json: 'json', md: 'text', txt: 'text', yaml: 'text', yml: 'text', sh: 'code' };
    const type = typeMap[ext] || 'file';
    const title = filePath.split('/').pop();
    const content = args.new_content || args.file_text || args.content || args.new_str || '';
    // Build a server URL so the preview iframe can load the real file
    let url = null;
    const agentId = selectedAgent ? selectedAgent.agent_id : null;
    if (agentId) {
      // Files written inside the agent's artifacts/ directory
      if (filePath.includes('/artifacts/')) {
        url = `${API_BASE}/api/agents/${agentId}/artifacts/${encodeURIComponent(title)}`;
      } else if (filePath.includes('/static/')) {
        // Files written into the LA8159 static/ directory
        const staticIdx = filePath.indexOf('/static/');
        url = `${API_BASE}/static/${encodeURIComponent(filePath.slice(staticIdx + 8))}`;
      }
    }
    return { id: 'art-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6), title, path: filePath, type, content, url };
  }
  return null;
}

// Artifact pill emoji icon
function artifactPillIcon(type) {
  const m = { html: '🌐', code: '💻', json: '{}', text: '📝', file: '📄', data: '📊', image: '🖼️', audio: '🎵', video: '🎬' };
  return m[type] || '📁';
}

// ── Chat File Links — convert file references in markdown to interactive pills ──

// File-type icon map (FontAwesome classes)
const _CFL_ICONS = {
  audio: 'fa-file-audio', wav: 'fa-file-audio', mp3: 'fa-file-audio', m4a: 'fa-file-audio', flac: 'fa-file-audio', ogg: 'fa-file-audio',
  image: 'fa-file-image', png: 'fa-file-image', jpg: 'fa-file-image', jpeg: 'fa-file-image', gif: 'fa-file-image', svg: 'fa-file-image', webp: 'fa-file-image',
  video: 'fa-file-video', mp4: 'fa-file-video', avi: 'fa-file-video', mov: 'fa-file-video',
  pdf: 'fa-file-pdf', json: 'fa-file-code', html: 'fa-file-code', htm: 'fa-file-code',
  md: 'fa-file-lines', txt: 'fa-file-lines', csv: 'fa-file-csv',
  py: 'fa-file-code', js: 'fa-file-code', ts: 'fa-file-code', css: 'fa-file-code',
  doc: 'fa-file-word', docx: 'fa-file-word', xls: 'fa-file-excel', xlsx: 'fa-file-excel',
};

const _CFL_PROJECT_FILE_INDEX_TTL_MS = 45000;
const _cflProjectFileIndexCache = new Map();
const _CFL_PENDING_SAVE_CONTEXT_RE = /\b(?:sera|será|vai|will\s+be|going\s+to)\s+(?:salv\w*|gerad\w*|criad\w*|saved|created|generated|written)\b|\b(?:salvar|save)\b.{0,24}\b(?:em|as|to)\b/i;

function _cflIsPendingSaveContext(text, refStart, refEnd) {
  const src = String(text || '');
  if (!src) return false;
  const start = Math.max(0, Number(refStart || 0) - 90);
  const end = Math.min(src.length, Number(refEnd || 0) + 90);
  const around = src.slice(start, end);
  return _CFL_PENDING_SAVE_CONTEXT_RE.test(around);
}

function _cflIcon(filename) {
  const ext = String(filename || '').split('.').pop().toLowerCase();
  return _CFL_ICONS[ext] || 'fa-file';
}

function _cflFileType(filename) {
  const ext = String(filename || '').split('.').pop().toLowerCase();
  if (['wav', 'mp3', 'm4a', 'flac', 'ogg', 'aac', 'webm'].includes(ext)) return 'audio';
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp'].includes(ext)) return 'image';
  if (['mp4', 'avi', 'mov', 'mkv'].includes(ext)) return 'video';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'json') return 'json';
  if (['md', 'markdown'].includes(ext)) return 'markdown';
  if (['html', 'htm'].includes(ext)) return 'html';
  if (['txt', 'csv', 'log', 'yaml', 'yml'].includes(ext)) return 'text';
  return 'file';
}

function _cflNormalizeLegacyWorkspacePath(pathValue) {
  let rel = String(pathValue || '').replace(/\\/g, '/').replace(/^\/+/, '');

  // Strip absolute filesystem prefixes when models emit local paths.
  rel = rel.replace(/^root\/vps_ecosystem\/vps_projects_\/LA8159\/LA8159-workspace\//i, 'AURA-workspace/');
  rel = rel.replace(/^vps_ecosystem\/vps_projects_\/LA8159\/LA8159-workspace\//i, 'AURA-workspace/');

  // Map all legacy workspace paths to AURA workspace.
  rel = rel.replace(/^LA8159-ai\/olivia\/olivia-workspace\//i, 'AURA-workspace/');
  rel = rel.replace(/^olivia\/olivia-workspace\//i, 'AURA-workspace/');
  rel = rel.replace(/^LA8159-ai\/LA8159\/LA8159-workspace\//i, 'AURA-workspace/');
  rel = rel.replace(/^LA8159\/LA8159-workspace\//i, 'AURA-workspace/');
  rel = rel.replace(/^LA8159-ai\/kout\/kout-workspace\//i, 'AURA-workspace/');
  rel = rel.replace(/^kout\/kout-workspace\//i, 'AURA-workspace/');
  rel = rel.replace(/^LA8159-ai\/CLOVI\/CLOVI\.olivia-workspace\//i, 'AURA-workspace/');
  rel = rel.replace(/^CLOVI\/CLOVI\.olivia-workspace\//i, 'AURA-workspace/');
  // Catch-all: any *-workspace/ path already canonical
  rel = rel.replace(/^(?:LA8159|kout|olivia)-workspace\//i, 'AURA-workspace/');
  rel = rel.replace(/^CLOVI\.olivia-workspace\//i, 'AURA-workspace/');

  return rel;
}

function _cflKoutWorkspaceStaticUrl(relPath) {
  const rel = String(relPath || '').replace(/^AURA-workspace\//i, '').replace(/^\/+/, '');
  if (!rel) return '';
  try {
    return new URL(`/AURA/${rel}`, window.location.origin).href;
  } catch (_e) {
    return `/AURA/${rel}`;
  }
}

// ── Workspace project detection ──────────────────────────────────────
// When the Olivia workspace project is selected, the agent has
// full filesystem access to the app itself.  File references should
// resolve to direct web URLs (e.g. /olivia/js/chat/stream.js) instead
// of the project-raw API endpoint.

const _CFL_WORKSPACE_PROJECT_ID = 'OliviaLegal-project';

function _cflIsWorkspaceProject(projectId) {
  return String(projectId || '').trim() === _CFL_WORKSPACE_PROJECT_ID;
}

/**
 * Build a direct web URL for a file inside the workspace project.
 * The workspace project root is the same as the web-server root, so
 * any relative path maps 1:1 to a served URL.
 */
function _cflWorkspaceWebUrl(relPath) {
  const rel = String(relPath || '').replace(/\\/g, '/').replace(/^\/+/, '').trim();
  if (!rel) return '';
  // Strip leading workspace/ prefix that agents sometimes emit.
  const clean = rel.replace(/^workspace\//i, '');
  try {
    return new URL(`/${clean}`, window.location.origin).href;
  } catch (_e) {
    return `/${clean}`;
  }
}

function _cflContextProjectId() {
  const selected = (typeof window !== 'undefined' && window.selectedAgent) ? window.selectedAgent : null;
  const selectedAgentId = selected && selected.agent_id ? String(selected.agent_id) : '';
  const selectedProjectId = selected && selected.project_id ? String(selected.project_id) : '';
  const bindings = (typeof window !== 'undefined' && window._agentProjectBindings && typeof window._agentProjectBindings === 'object')
    ? window._agentProjectBindings
    : null;
  if (selectedAgentId && bindings && bindings[selectedAgentId]) {
    return String(bindings[selectedAgentId]);
  }
  if (selectedProjectId) return selectedProjectId;
  if (typeof getCurrentProjectId === 'function') {
    const current = String(getCurrentProjectId() || '').trim();
    if (current) return current;
  }
  if (typeof _activeProjectId === 'function') {
    const active = String(_activeProjectId() || '').trim();
    if (active) return active;
  }
  if (typeof window !== 'undefined' && typeof window._docsActiveProjectId === 'string') {
    const docsActive = String(window._docsActiveProjectId || '').trim();
    if (docsActive) return docsActive;
  }
  return '';
}

async function _cflEnsureAgentBoundProjectId() {
  const selected = (typeof window !== 'undefined' && window.selectedAgent) ? window.selectedAgent : null;
  const agentId = selected && selected.agent_id ? String(selected.agent_id) : '';
  if (!agentId) return '';
  const bindings = (typeof window !== 'undefined' && window._agentProjectBindings && typeof window._agentProjectBindings === 'object')
    ? window._agentProjectBindings
    : null;
  if (bindings && bindings[agentId]) return String(bindings[agentId]);

  try {
    const res = await fetch(`${API_BASE}/api/projects/agent/${encodeURIComponent(agentId)}`);
    if (!res.ok) return '';
    const data = await res.json().catch(() => ({}));
    const project = data && data.project;
    const projectId = project && project.project_id ? String(project.project_id) : '';
    if (!projectId) return '';
    if (bindings) bindings[agentId] = projectId;
    return projectId;
  } catch (_e) {
    return '';
  }
}

function _cflProjectRawUrl(projectId, relPath) {
  const pid = String(projectId || '').trim();
  let rel = String(relPath || '').replace(/\\/g, '/').replace(/^\/+/, '').trim();
  if (!pid || !rel) return '';
  rel = rel
    .replace(/^projects\/[^/]+\//i, '')
    .replace(/^workspace\//i, '')
    .replace(/^uploads\/projects\/[^/]+\//i, '')
    .replace(/^\.\//, '');
  return `${API_BASE}/api/projects/${encodeURIComponent(pid)}/raw?path=${encodeURIComponent(rel)}`;
}

function _cflParseProjectRawUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return null;
  try {
    const u = new URL(raw, window.location.origin);
    const m = u.pathname.match(/\/api\/projects\/([^/]+)\/raw$/i);
    if (!m) return null;
    return {
      projectId: decodeURIComponent(m[1] || ''),
      path: String(u.searchParams.get('path') || ''),
    };
  } catch (_e) {
    return null;
  }
}

function _cflPathBasename(value) {
  const normalized = String(value || '').replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  return parts.length ? parts[parts.length - 1] : normalized;
}

function _cflFindCachedProjectPathByName(projectId, fileName) {
  const pid = String(projectId || '').trim();
  const name = _cflPathBasename(fileName).toLowerCase();
  if (!pid || !name) return '';
  const cached = _cflProjectFileIndexCache.get(pid);
  if (!cached || !cached.byName) return '';
  const candidates = cached.byName[name] || [];
  if (!candidates.length) return '';
  // Prefer deeper paths (sectioned folders) over root-level names.
  const sorted = candidates.slice().sort((a, b) => b.split('/').length - a.split('/').length);
  return sorted[0] || '';
}

async function _cflBuildProjectFileIndex(projectId) {
  const pid = String(projectId || '').trim();
  if (!pid) return null;
  const now = Date.now();
  const cached = _cflProjectFileIndexCache.get(pid);
  if (cached && (now - cached.at) < _CFL_PROJECT_FILE_INDEX_TTL_MS) return cached;

  const res = await fetch(`${API_BASE}/api/projects/${encodeURIComponent(pid)}/files`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json().catch(() => ({}));
  const files = Array.isArray(data.files) ? data.files : [];
  const byName = Object.create(null);
  files.forEach((f) => {
    const relPath = String(f && f.name ? f.name : '').replace(/\\/g, '/').trim();
    if (!relPath) return;
    const base = _cflPathBasename(relPath).toLowerCase();
    if (!base) return;
    if (!Array.isArray(byName[base])) byName[base] = [];
    byName[base].push(relPath);
  });

  const entry = { at: now, byName };
  _cflProjectFileIndexCache.set(pid, entry);
  return entry;
}

async function _cflResolveClickUrl(url, name, ref) {
  const initialUrl = String(url || '').trim();
  const refValue = String(ref || '').trim() || String(name || '').trim();
  const refCompat = _cflNormalizeLegacyWorkspacePath(refValue.replace(/^\/+/, ''));
  let ctxProject = _cflContextProjectId();
  if (!ctxProject) {
    ctxProject = await _cflEnsureAgentBoundProjectId();
  }

  const parsed = _cflParseProjectRawUrl(initialUrl);
  if (parsed) {
    let resolvedProject = String(parsed.projectId || '').trim();
    let resolvedPath = String(parsed.path || '').trim();
    if (ctxProject && resolvedProject && ctxProject !== resolvedProject) {
      resolvedProject = ctxProject;
    } else if (!resolvedProject && ctxProject) {
      resolvedProject = ctxProject;
    }

    if (resolvedProject && (!resolvedPath || !resolvedPath.includes('/'))) {
      const probeName = resolvedPath || _cflPathBasename(refCompat || name);
      let matched = _cflFindCachedProjectPathByName(resolvedProject, probeName);
      if (!matched && probeName) {
        try {
          await _cflBuildProjectFileIndex(resolvedProject);
          matched = _cflFindCachedProjectPathByName(resolvedProject, probeName);
        } catch (_e) {
          matched = '';
        }
      }
      if (matched) resolvedPath = matched;
    }

    if (_cflIsWorkspaceProject(resolvedProject)) {
      return _cflWorkspaceWebUrl(resolvedPath || _cflPathBasename(refCompat || name)) || initialUrl;
    }
    const rebuilt = _cflProjectRawUrl(resolvedProject, resolvedPath || _cflPathBasename(refCompat || name));
    return rebuilt || initialUrl;
  }

  if (ctxProject) {
    const isRelativeLike = refCompat.includes('/') || /\.[a-z0-9]{1,8}$/i.test(refCompat);
    if (isRelativeLike) {
      let rel = refCompat
        .replace(/^projects\/[^/]+\//i, '')
        .replace(/^workspace\//i, '')
        .replace(/^uploads\/projects\/[^/]+\//i, '')
        .replace(/^\.\//, '');

      if (rel && !rel.includes('/')) {
        let matched = _cflFindCachedProjectPathByName(ctxProject, rel);
        if (!matched) {
          try {
            await _cflBuildProjectFileIndex(ctxProject);
            matched = _cflFindCachedProjectPathByName(ctxProject, rel);
          } catch (_e) {
            matched = '';
          }
        }
        if (matched) rel = matched;
      }

      if (_cflIsWorkspaceProject(ctxProject)) {
        const rebuilt = _cflWorkspaceWebUrl(rel);
        if (rebuilt) return rebuilt;
      }
      const rebuilt = _cflProjectRawUrl(ctxProject, rel);
      if (rebuilt) return rebuilt;
    }
  }

  return initialUrl;
}

/**
 * Build a server URL for a file reference found in chat text.
 * Handles:
 *  - project-relative paths like "discovery_files/foo/bar.wav"
 *  - uploads-relative paths like "uploads/projects/pinocchio/..."
 *  - transcript IDs like "transcript_1775241338"
 *  - absolute URLs (returned as-is)
 */
function _cflResolveUrl(ref) {
  const trimmed = String(ref || '').trim();
  if (!trimmed) return '';
  // Already a full URL
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  // Direct API path
  if (trimmed.startsWith('/api/')) return `${API_BASE}${trimmed}`;

  const normalized = trimmed
    .replace(/\\/g, '/')
    .replace(/^\.(\/)+/, '')
    .replace(/^\/+/, '');

  const compatNormalized = _cflNormalizeLegacyWorkspacePath(normalized);

  const compatWorkspaceIdx = compatNormalized.toLowerCase().indexOf('AURA-workspace/'.toLowerCase());
  if (compatWorkspaceIdx >= 0) {
    const workspaceRel = compatNormalized.slice(compatWorkspaceIdx);
    if (workspaceRel && /\.[a-z0-9]{1,8}(?:$|[?#])/i.test(workspaceRel)) {
      const staticUrl = _cflKoutWorkspaceStaticUrl(workspaceRel);
      if (staticUrl) return staticUrl;
    }
  }

  const compatLeaf = compatNormalized.toLowerCase();
  if (compatLeaf === 'studio.js') return _cflKoutWorkspaceStaticUrl('AURA-workspace/js/modules/studio.js');
  if (compatLeaf === 'index.html') return _cflKoutWorkspaceStaticUrl('AURA-workspace/index.html');

  // Planning docs live under /AURA-workspace and are not project-upload files.
  const normalizedLower = compatNormalized.toLowerCase();
  const planningNames = new Set(['task_plan.md', 'findings.md', 'progress.md']);
  let planningRel = '';
  if (planningNames.has(normalizedLower)) {
    planningRel = `AURA-workspace/${compatNormalized}`;
  } else if (/^workspace\/(task_plan\.md|findings\.md|progress\.md)$/i.test(normalized)) {
    planningRel = `AURA-workspace/${normalized.split('/').slice(1).join('/')}`;
  } else {
    const compatibilityPlanningMatch = compatNormalized.match(/^([a-z0-9_-]+-workspace)\/(task_plan\.md|findings\.md|progress\.md)$/i);
    if (compatibilityPlanningMatch) {
      planningRel = `AURA-workspace/${compatibilityPlanningMatch[2]}`;
    }
  }
  if (planningRel) {
    const safeRel = planningRel.split('/').map((part) => encodeURIComponent(part)).join('/');
    return `${API_BASE}/${safeRel}`;
  }

  // Transcript ID — route through pinocchio API
  if (/^transcript_\d+$/i.test(trimmed)) {
    return `${API_BASE}/api/transcripts/${encodeURIComponent(trimmed)}`;
  }

  // Explicit uploads/projects/<project_id>/... reference
  const explicitProjectMatch = compatNormalized.match(/^uploads\/projects\/([^/]+)\/(.+)$/i);
  if (explicitProjectMatch) {
    const contextProject = _cflContextProjectId();
    const projectId = contextProject || explicitProjectMatch[1];
    let rel = explicitProjectMatch[2];
    if (projectId) {
      const matched = _cflFindCachedProjectPathByName(projectId, rel);
      if (matched) rel = matched;
    }
    if (_cflIsWorkspaceProject(projectId)) {
      return _cflWorkspaceWebUrl(rel);
    }
    return _cflProjectRawUrl(projectId, rel);
  }

  // Uploads-relative
  if (/^uploads\//i.test(compatNormalized)) {
    return `${API_BASE}/api/uploads/file?path=${encodeURIComponent(compatNormalized.replace(/^uploads\//i, ''))}`;
  }

  // Absolute local path that contains an uploads/ segment.
  const uploadsIdx = compatNormalized.toLowerCase().indexOf('/uploads/');
  if (uploadsIdx >= 0) {
    const rel = compatNormalized.slice(uploadsIdx + '/uploads/'.length);
    if (rel) return `${API_BASE}/api/uploads/file?path=${encodeURIComponent(rel)}`;
  }

  // Project-relative path — try active project as the primary source for workspace files.
  const activeProject = _cflContextProjectId();
  if (activeProject && (compatNormalized.includes('/') || compatNormalized.includes('.'))) {
    let rel = compatNormalized
      .replace(/^projects\/[^/]+\//i, '')
      .replace(/^workspace\//i, '')
      .replace(/^uploads\/projects\/[^/]+\//i, '');
    if (rel && !rel.includes('/')) {
      const matched = _cflFindCachedProjectPathByName(activeProject, rel);
      if (matched) rel = matched;
    }
    if (rel) {
      if (_cflIsWorkspaceProject(activeProject)) {
        return _cflWorkspaceWebUrl(rel);
      }
      return _cflProjectRawUrl(activeProject, rel);
    }
  }

  // Fallback — treat as project file if it looks like a path with extension
  if (compatNormalized.includes('/') && compatNormalized.includes('.')) {
    return `${API_BASE}/api/uploads/file?path=${encodeURIComponent(compatNormalized)}`;
  }
  return '';
}

/**
 * Build the HTML for an interactive file-link pill.
 */
function _cflPillHtml(filename, url, fileType, originalRef) {
  const icon = _cflIcon(filename);
  const safeUrl = escapeHtml(url);
  const safeName = escapeHtml(filename);
  // Use single-quote JSON strings for safe embedding inside double-quoted onclick attributes
  const jsonUrl = JSON.stringify(url).replace(/"/g, '&quot;');
  const jsonName = JSON.stringify(filename).replace(/"/g, '&quot;');
  const jsonKind = JSON.stringify({ type: fileType }).replace(/"/g, '&quot;');
  const jsonRef = JSON.stringify(originalRef || filename).replace(/"/g, '&quot;');

  return `<span class="chat-file-link" data-url="${safeUrl}" data-name="${safeName}" data-type="${escapeHtml(fileType)}">`
    + `<i class="fas ${icon} cfl-icon"></i>`
    + `<span class="cfl-name">${safeName}</span>`
    + `<span class="cfl-actions">`
    + `<button class="cfl-btn" title="Preview" onclick="event.stopPropagation();cflOpenPreview(${jsonUrl},${jsonName},${jsonKind},${jsonRef})"><i class="fas fa-eye"></i></button>`
    + `<button class="cfl-btn" title="Output" onclick="event.stopPropagation();cflOpenOutput(${jsonUrl},${jsonName},${jsonKind},${jsonRef})"><i class="fas fa-columns"></i></button>`
    + `<button class="cfl-btn" title="Browser" onclick="event.stopPropagation();cflOpenBrowser(${jsonUrl},${jsonName},${jsonKind},${jsonRef})"><i class="fas fa-globe"></i></button>`
    + `<button class="cfl-btn" title="Nova aba" onclick="event.stopPropagation();cflOpenExternal(${jsonUrl},${jsonName},${jsonRef})"><i class="fas fa-external-link-alt"></i></button>`
    + `</span></span>`;
}

function _cflSaveIntentPillHtml(fileRef) {
  const safeRef = escapeHtml(fileRef);
  const jsonRef = JSON.stringify(fileRef).replace(/"/g, '&quot;');
  return `<span class="chat-file-save-intent" data-ref="${safeRef}">`
    + `<i class="fas fa-floppy-disk cfsi-icon"></i>`
    + `<span class="cfsi-name">${safeRef}</span>`
    + `<span class="cfsi-label">Salvar?</span>`
    + `<span class="cfsi-actions">`
    + `<button class="cfsi-btn yes" title="Salvar agora" onclick="event.stopPropagation();cflRespondSaveIntent(${jsonRef},true,this)"><i class="fas fa-check"></i></button>`
    + `<button class="cfsi-btn no" title="Nao salvar" onclick="event.stopPropagation();cflRespondSaveIntent(${jsonRef},false,this)"><i class="fas fa-xmark"></i></button>`
    + `</span>`
    + `</span>`;
}

function cflRespondSaveIntent(fileRef, shouldSave, btnEl) {
  const ref = String(fileRef || '').trim();
  if (!ref) return;

  const pill = btnEl && btnEl.closest ? btnEl.closest('.chat-file-save-intent') : null;
  if (pill && pill.dataset.resolved === '1') return;

  if (pill) {
    pill.dataset.resolved = '1';
    pill.classList.add('resolved');
    pill.classList.add(shouldSave ? 'accepted' : 'declined');
    const label = pill.querySelector('.cfsi-label');
    if (label) label.textContent = shouldSave ? 'Solicitado' : 'Ignorado';
    const actions = pill.querySelector('.cfsi-actions');
    if (actions) actions.style.display = 'none';
  }

  const responseText = shouldSave
    ? `Sim, pode salvar agora o arquivo "${ref}" e confirmar quando concluir.`
    : `Nao salve o arquivo "${ref}" por enquanto.`;

  if (typeof sendMessage === 'function') {
    void sendMessage(responseText);
  }
}

// Action handlers (delegate to existing preview/output/browser infrastructure)
async function cflOpenPreview(url, name, kind, ref) {
  const resolvedUrl = await _cflResolveClickUrl(url, name, ref);
  if (typeof window.openPreviewUrl === 'function') {
    window.openPreviewUrl(resolvedUrl, name, { fileType: (kind && kind.type) || _cflFileType(name) });
  } else {
    window.open(resolvedUrl, '_blank');
  }
}

async function cflOpenOutput(url, name, kind, ref) {
  const resolvedUrl = await _cflResolveClickUrl(url, name, ref);
  const fileType = (kind && kind.type) || _cflFileType(name);
  const artifact = {
    id: `cfl:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
    title: name || 'file',
    type: fileType,
    url: resolvedUrl,
    _focusInPanel: true,
  };
  if (typeof addOutputArtifact === 'function') addOutputArtifact(artifact);
  if (typeof showOutputArtifactInPanel === 'function') showOutputArtifactInPanel(artifact.id);
  const panel = document.getElementById('outputPanel');
  if (panel && !panel.classList.contains('open') && typeof toggleOutputPanel === 'function') toggleOutputPanel();
}

async function cflOpenBrowser(url, name, kind, ref) {
  const resolvedUrl = await _cflResolveClickUrl(url, name, ref);
  if (typeof window.navigateBrowser === 'function') {
    window.navigateBrowser(resolvedUrl);
    const bp = document.getElementById('browserPanel');
    if (bp && !bp.classList.contains('open') && typeof toggleBrowserPanel === 'function') toggleBrowserPanel();
  } else {
    window.open(resolvedUrl, '_blank');
  }
}

async function cflOpenExternal(url, name, ref) {
  const resolvedUrl = await _cflResolveClickUrl(url, name, ref);
  window.open(resolvedUrl, '_blank', 'noopener');
}

function _bindChatFileLinkInteractions(rootEl) {
  const scope = rootEl && rootEl.querySelectorAll ? rootEl : document;
  const links = scope.querySelectorAll('.chat-file-link');
  links.forEach((link) => {
    if (link.dataset.cflBound === '1') return;
    link.dataset.cflBound = '1';

    let hoverTimer = null;

    const showActions = () => {
      link.classList.add('cfl-actions-visible');
    };

    const hideActions = () => {
      link.classList.remove('cfl-actions-visible');
      if (link.dataset.cflPinned !== '1') {
        link.removeAttribute('data-cfl-pinned');
      }
    };

    const startHoverTimer = () => {
      if (link.dataset.cflPinned === '1') return;
      if (hoverTimer) clearTimeout(hoverTimer);
      hoverTimer = setTimeout(showActions, 2000);
    };

    const cancelHoverTimer = () => {
      if (hoverTimer) {
        clearTimeout(hoverTimer);
        hoverTimer = null;
      }
      if (link.dataset.cflPinned !== '1') hideActions();
    };

    link.addEventListener('mouseenter', startHoverTimer);
    link.addEventListener('mouseleave', cancelHoverTimer);

    link.addEventListener('focusin', () => {
      if (hoverTimer) clearTimeout(hoverTimer);
      showActions();
    });

    link.addEventListener('focusout', () => {
      if (link.dataset.cflPinned !== '1') hideActions();
    });

    // Mobile/touch fallback: tap once to reveal actions for a few seconds.
    link.addEventListener('click', (ev) => {
      if (ev.target.closest('.cfl-btn')) return;
      if (link.classList.contains('cfl-actions-visible')) return;
      link.dataset.cflPinned = '1';
      showActions();
      setTimeout(() => {
        if (link.dataset.cflPinned === '1') {
          link.removeAttribute('data-cfl-pinned');
          hideActions();
        }
      }, 6000);
    });
  });
}

/**
 * Post-process rendered markdown HTML to enrich file references with interactive pills.
 * Detects:
 *  - Filenames with common extensions (e.g. "audio_trimmed.wav", "report.pdf")
 *  - Paths like "discovery_files/foo/bar.json"
 *  - Transcript IDs like "transcript_1775241338"
 *  - Code elements containing file paths
 */
function enrichChatFileLinks(html) {
  if (!html || typeof html !== 'string') return html;

  // Common file extensions to detect
  const EXT_RE = '(?:wav|mp3|m4a|flac|ogg|aac|webm|png|jpg|jpeg|gif|svg|webp|bmp|mp4|avi|mov|mkv|pdf|json|html|htm|md|txt|csv|py|js|ts|css|doc|docx|xls|xlsx|yaml|yml|log|xml|sh)';

  // Pattern 1: paths with slashes and file extension (e.g. "discovery_files/foo/bar.wav")
  // Pattern 2: standalone filename with extension (e.g. "audio_trimmed.wav")  
  // Pattern 3: transcript IDs (e.g. "transcript_1775241338")
  // Combined into one regex matching content NOT inside HTML tags
  const FILE_PATH_RE = new RegExp(
    '(?<![\\w/\\.\\-])' +                                   // not preceded by path chars
    '(' +
    '(?:[\\w.\\-]+/)+[\\w.\\-]+\\.' + EXT_RE +            // path/to/file.ext
    '|' +
    '[\\w][\\w.\\-]*\\.' + EXT_RE +                        // filename.ext (at least 2 chars before dot)
    '|' +
    'transcript_\\d{5,}' +                                  // transcript_ID
    ')' +
    '(?![\\w/\\.\\-])',                                       // not followed by path chars
    'gi'
  );
  const FILE_PATH_EXACT_RE = new RegExp(
    '^(' +
    '(?:[\\w.\\-]+/)+[\\w.\\-]+\\.' + EXT_RE +
    '|' +
    '[\\w][\\w.\\-]*\\.' + EXT_RE +
    '|' +
    'transcript_\\d{5,}' +
    ')$',
    'i'
  );

  // Process: parse HTML to only replace text nodes (not inside tags or attributes)
  const tmp = document.createElement('div');
  tmp.innerHTML = html;

  // Inline markdown code refs like `reference_index.html` should become actionable pills.
  const inlineCodes = Array.from(tmp.querySelectorAll('code'));
  inlineCodes.forEach((codeEl) => {
    if (codeEl.closest('pre')) return;
    const ref = String(codeEl.textContent || '').trim();
    if (!ref || !FILE_PATH_EXACT_RE.test(ref)) return;
    const parentText = String((codeEl.parentElement && codeEl.parentElement.textContent) || codeEl.textContent || '');
    const at = parentText.indexOf(ref);
    const isPendingIntent = _cflIsPendingSaveContext(parentText, at >= 0 ? at : 0, at >= 0 ? (at + ref.length) : ref.length);

    const pill = document.createElement('span');
    if (isPendingIntent) {
      pill.innerHTML = _cflSaveIntentPillHtml(ref);
    } else {
      const url = _cflResolveUrl(ref);
      if (!url) return;
      const fileName = ref.split('/').pop();
      pill.innerHTML = _cflPillHtml(fileName, url, _cflFileType(ref), ref);
    }
    const rendered = pill.firstElementChild;
    if (rendered) rendered.setAttribute('data-ref', ref);
    if (rendered) codeEl.replaceWith(rendered);
  });

  function walkTextNodes(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent;
      if (!FILE_PATH_RE.test(text)) return;
      FILE_PATH_RE.lastIndex = 0; // reset regex state

      const frag = document.createDocumentFragment();
      let lastIdx = 0;
      let match;
      while ((match = FILE_PATH_RE.exec(text)) !== null) {
        const ref = match[1];
        const isPendingIntent = _cflIsPendingSaveContext(text, match.index, match.index + match[0].length);
        let html = '';
        if (isPendingIntent) {
          html = _cflSaveIntentPillHtml(ref);
        } else {
          const url = _cflResolveUrl(ref);
          if (!url) continue;
          const fileName = ref.split('/').pop();
          html = _cflPillHtml(fileName, url, _cflFileType(ref), ref);
        }

        // Text before the match
        if (match.index > lastIdx) {
          frag.appendChild(document.createTextNode(text.slice(lastIdx, match.index)));
        }
        // Create pill element
        const pill = document.createElement('span');
        pill.innerHTML = html;
        const rendered = pill.firstElementChild;
        if (rendered) {
          rendered.setAttribute('data-ref', ref);
          frag.appendChild(rendered);
        }
        lastIdx = match.index + match[0].length;
      }
      // Remaining text
      if (lastIdx < text.length) {
        frag.appendChild(document.createTextNode(text.slice(lastIdx)));
      }
      if (lastIdx > 0) {
        node.parentNode.replaceChild(frag, node);
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      // Skip <code>, <pre>, <a>, <script>, <style> elements
      const tag = node.tagName.toLowerCase();
      if (['code', 'pre', 'script', 'style', 'a', 'textarea', 'input'].includes(tag)) return;
      // Skip elements that are already file-link pills
      if (node.classList && node.classList.contains('chat-file-link')) return;
      // Walk children (snapshot to avoid mutation issues)
      const children = Array.from(node.childNodes);
      children.forEach(walkTextNodes);
    }
  }

  walkTextNodes(tmp);
  return tmp.innerHTML;
}

// Expose file link functions
window.cflOpenPreview = cflOpenPreview;
window.cflOpenOutput = cflOpenOutput;
window.cflOpenBrowser = cflOpenBrowser;
window.cflOpenExternal = cflOpenExternal;
window.cflRespondSaveIntent = cflRespondSaveIntent;
window.enrichChatFileLinks = enrichChatFileLinks;

// Open a stream artifact in the output panel
function openStreamArtifact(artifactJson) {
  try {
    const artifact = typeof artifactJson === 'string' ? JSON.parse(artifactJson) : artifactJson;
    if (!artifact) return;
    // Only register if not already present — avoid overwriting a fully-populated artifact
    // (the pill dataset may contain the pre-content version)
    const existing = outputArtifacts.find(a => a.id === artifact.id);
    if (!existing) addOutputArtifact(artifact);
    const panel = document.getElementById('outputPanel');
    if (panel && !panel.classList.contains('open')) toggleOutputPanel();
    showOutputArtifact(artifact.id);
  } catch (e) { console.warn('openStreamArtifact error', e); }
}

// Open a stream artifact's URL in the integrated browser panel
function openArtifactInBrowser(artifactJson) {
  try {
    const artifact = typeof artifactJson === 'string' ? JSON.parse(artifactJson) : artifactJson;
    if (!artifact) return;
    const url = artifact.url;
    if (!url) {
      // Fallback: open the artifact modal if no server URL available
      openStreamArtifact(artifactJson);
      return;
    }
    // Register artifact so it's available in the output panel too
    const existing = outputArtifacts.find(a => a.id === artifact.id);
    if (!existing) addOutputArtifact(artifact);
    // Navigate integrated browser
    navigateBrowser(url);
    const bp = document.getElementById('browserPanel');
    if (bp && !bp.classList.contains('open')) toggleBrowserPanel();
  } catch (e) { console.warn('openArtifactInBrowser error', e); }
}

function _autoOpenGeneratedHtmlArtifact(artifact) {
  if (!artifact) return;
  const ext = String(artifact.title || '').split('.').pop().toLowerCase();
  const type = String(artifact.type || '').toLowerCase();
  const contentType = String(artifact.content_type || '').toLowerCase();
  const isHtml = type === 'html' || ext === 'html' || ext === 'htm' || contentType.includes('text/html');
  if (!isHtml) return;

  try {
    const bp = document.getElementById('browserPanel');
    if (bp && !bp.classList.contains('open') && typeof toggleBrowserPanel === 'function') {
      toggleBrowserPanel();
    }

    if (artifact.url && typeof navigateBrowser === 'function') {
      navigateBrowser(artifact.url);
      return;
    }

    const iframe = document.getElementById('browserFrame');
    if (iframe && typeof artifact.content === 'string' && artifact.content.includes('<')) {
      iframe.srcdoc = artifact.content;
      const bar = document.getElementById('browserUrlBar');
      if (bar) bar.value = artifact.title || 'generated-html';
    }
  } catch (e) {
    console.warn('autoOpenGeneratedHtmlArtifact error', e);
  }
}

function onToolCall(toolName, args) {
  const runId = currentRunId;
  const log = document.getElementById(`log-${runId}`);
  if (!log) return;
  if (runId) {
    const count = Number(_runToolCallCount.get(runId) || 0);
    _runToolCallCount.set(runId, count + 1);
  }
  const safeToolName = String(toolName || '').trim();
  if (safeToolName) {
    setChatRuntimeRoute('openclaude_tools', `tool_call: ${safeToolName}`);
  }

  // Special handling for ask_human — show question + input field
  if (toolName === 'ask_human') {
    const question = (args && (args.inquire || args.question)) || '';
    const uid = `ask-human-${runId}-${Date.now()}`;
    const el = document.createElement('div');
    el.className = 'log-ask-human';
    el.innerHTML = `
      <div class="ask-human-header"><i class="fas fa-user"></i> Agente solicita entrada</div>
      ${question ? `<div class="ask-human-question">${marked.parse(question)}</div>` : ''}
      <div class="ask-human-input-row">
        <textarea class="ask-human-input" id="${uid}-inp" name="${uid}-inp" rows="2" placeholder="Digite sua resposta..."></textarea>
        <button class="ask-human-send" onclick="submitAskHumanResponse('${uid}-inp')">
          <i class="fas fa-paper-plane"></i>
        </button>
      </div>
    `;
    log.appendChild(el);
    const chatLog = document.getElementById('chatLog');
    if (chatLog) chatLog.scrollTop = chatLog.scrollHeight;
    return;
  }

  const iconClass = TOOL_ICONS[toolName] || 'fa-cog';
  const summary = toolSummary(toolName, args);
  const argsJson = args ? JSON.stringify(args, null, 2) : '';
  const detailId = `td-${runId}-${Date.now()}`;

  const el = document.createElement('div');
  el.className = 'log-tool-call';
  el.dataset.tool = toolName;
  el.dataset.argsJson = argsJson;
  el.dataset.detailId = detailId;

  el.innerHTML = `
    <div class="log-tc-header" onclick="
      var d=document.getElementById('${detailId}');
      var c=this.querySelector('.tc-chevron');
      d.classList.toggle('open');
      c.classList.toggle('open');
    ">
      <i class="fas ${iconClass} tc-icon"></i>
      <span class="tc-name">${escapeHtml(toolName)}</span>
      ${summary ? `<span class="tc-summary">${escapeHtml(summary)}</span>` : ''}
      <i class="fas fa-chevron-right tc-chevron"></i>
    </div>
    <div class="log-result-body tc-detail" id="${detailId}">
      ${argsJson ? `<pre>${escapeHtml(argsJson)}</pre>` : ''}
    </div>
  `;

  log.appendChild(el);
  _lastToolCallsMap[runId] = el;

  const chatLog = document.getElementById('chatLog');
  if (chatLog) chatLog.scrollTop = chatLog.scrollHeight;
}

function onToolResult(toolName, result) {
  const runId = currentRunId;
  const log = document.getElementById(`log-${runId}`);
  if (!log) return;

  const normalizedToolName = String(toolName || '').trim().toLowerCase();
  if (normalizedToolName && normalizedToolName !== 'response') {
    setChatRuntimeRoute('openclaude_tools', `tool_result: ${normalizedToolName}`);
  }

  // Format result text
  let resultText = '';
  if (typeof result === 'string') {
    try { resultText = JSON.stringify(JSON.parse(result), null, 2); }
    catch (e) { resultText = result; }
  } else {
    resultText = JSON.stringify(result, null, 2);
  }
  if (normalizedToolName === 'response') {
    updateRuntimeRouteFromTokenHint(String(resultText || '').slice(-800));
    let responseText = '';
    if (typeof result === 'string') {
      responseText = String(result);
      try {
        const parsed = JSON.parse(result);
        if (parsed && typeof parsed === 'object') {
          responseText = String(parsed.content || parsed.response || parsed.message || responseText);
        }
      } catch (_e) {
        // Keep plain-text result when JSON parsing fails.
      }
    } else if (result && typeof result === 'object') {
      responseText = String(result.content || result.response || result.message || '');
    }
    if (responseText && runId) {
      const prev = String(_runResponseAccumulator.get(runId) || '');
      let next = prev;
      if (!prev) {
        next = responseText;
      } else if (responseText.startsWith(prev)) {
        // Some backends emit cumulative text; keep the newest full payload.
        next = responseText;
      } else if (!prev.endsWith(responseText)) {
        // LLM-only mode emits token deltas; append them.
        next = prev + responseText;
      }
      _runResponseAccumulator.set(runId, next);
      _pendingThinkingContent = next;
      _runVisibleResponseState.set(runId, true);
    }
  } else if (normalizedToolName === 'final') {
    // The OpenClaude result message — use as fallback bubble if no response block was seen.
    let finalText = '';
    if (typeof result === 'string') {
      finalText = result.trim();
    } else if (result && typeof result === 'object') {
      finalText = String(result.content || result.result || result.message || '').trim();
    }
    if (finalText && runId) {
      const prev = String(_runResponseAccumulator.get(runId) || '');
      let next = prev;
      if (!prev || finalText.startsWith(prev)) {
        next = finalText;
      } else if (!prev.includes(finalText)) {
        next = `${prev}\n\n${finalText}`;
      }
      _runResponseAccumulator.set(runId, next);
      _pendingThinkingContent = next;
      _runVisibleResponseState.set(runId, true);
    }
  }

  // response/final are model-text channels; avoid rendering one "Resultado" block per token.
  if (normalizedToolName === 'response' || normalizedToolName === 'final') {
    const chatLog = document.getElementById('chatLog');
    if (chatLog) chatLog.scrollTop = chatLog.scrollHeight;
    return;
  }

  const truncated = resultText.length > 2000 ? resultText.substring(0, 2000) + '\n…' : resultText;

  const lastCall = _lastToolCallsMap[runId];
  if (lastCall) {
    // Add check badge to header
    const header = lastCall.querySelector('.log-tc-header');
    if (header) {
      const dot = document.createElement('i');
      dot.className = 'fas fa-circle-check tc-status done';
      const chevron = header.querySelector('.tc-chevron');
      if (chevron) header.insertBefore(dot, chevron);
    }

    // Append result section into detail block
    const detailId = lastCall.dataset.detailId;
    const detail = document.getElementById(detailId);
    if (detail) {
      const rb = document.createElement('div');
      rb.className = 'tc-result-block';
      rb.innerHTML = `<pre>${escapeHtml(truncated)}</pre>`;
      detail.appendChild(rb);
    }

    // Detect and emit artifact pill for file writes
    let args = null;
    try { args = JSON.parse(lastCall.dataset.argsJson || 'null'); } catch (e) { }
    const artifact = detectArtifact(toolName, args);
    if (artifact) {
      // Build the full artifact with populated content + url before storing
      const fullArtifact = { ...artifact, content: artifact.content || resultText };
      const pill = document.createElement('div');
      pill.className = 'artifact-pill';
      const icon = artifactPillIcon(artifact.type);
      // Icon is clickable when a server URL exists — opens in the integrated browser
      const iconHtml = fullArtifact.url
        ? `<span class="ap-icon ap-browser" title="Abrir no navegador integrado" onclick="openArtifactInBrowser(JSON.parse(this.closest('.artifact-pill').dataset.artifact))">${icon}</span>`
        : `<span class="ap-icon">${icon}</span>`;
      pill.innerHTML = `${iconHtml}<span class="ap-name">${escapeHtml(artifact.title)}</span><button class="ap-open" title="Abrir no painel" onclick="openStreamArtifact(JSON.parse(this.closest('.artifact-pill').dataset.artifact))"><i class="fas fa-arrow-up-right-from-square"></i></button>`;
      // Store the FULL artifact (with url + content) on the pill so handlers get it
      pill.dataset.artifact = JSON.stringify(fullArtifact);
      lastCall.insertAdjacentElement('afterend', pill);
      addOutputArtifact(fullArtifact);
      _autoOpenGeneratedHtmlArtifact(fullArtifact);
    }
  } else {
    // Fallback: standalone result block
    const el = document.createElement('div');
    el.className = 'log-tool-result';
    el.innerHTML = `<div class="log-tool-header"><i class="fas fa-check-circle"></i> Resultado</div><pre>${escapeHtml(truncated)}</pre>`;
    log.appendChild(el);
  }

  const chatLog = document.getElementById('chatLog');
  if (chatLog) chatLog.scrollTop = chatLog.scrollHeight;
}

function onDone(runId, isGuided) {
  const log = document.getElementById(`log-${runId}`);
  if (!log) return;
  if (log.dataset.done === '1') return;
  log.dataset.done = '1';

  const buffered = String(_runResponseAccumulator.get(runId) || '').trim();
  if (buffered && !_pendingThinkingContent) {
    _pendingThinkingContent = buffered;
  }

  const currentRoute = getChatRuntimeRoute();
  if (currentRoute === 'idle' || currentRoute === 'detecting') {
    setChatRuntimeRoute('remote_chat', 'Execucao concluida sem eventos de ferramentas.');
  }

  const doneEl = document.createElement('div');
  doneEl.className = 'log-done';
  doneEl.innerHTML = '<i class="fas fa-check"></i> concluído';
  log.appendChild(doneEl);

  let renderedResponse = false;

  // Render pending thinking content as agent response bubble
  if (_pendingThinkingContent) {
    addBubble('agent', `<div class="answer-md">${enrichChatFileLinks(marked.parse(_pendingThinkingContent))}</div>`);
    _pendingThinkingContent = '';
    renderedResponse = true;
    _runVisibleResponseState.set(runId, true);
  }

  if (!renderedResponse && !_runVisibleResponseState.get(runId)) {
    const toolCalls = Number(_runToolCallCount.get(runId) || 0);
    const likelyBudgetStop = toolCalls >= 20;
    const now = Date.now();
    if ((now - _runAutoFinalizeState.lastAt) > _RUN_AUTO_FINALIZE_COOLDOWN_MS) {
      _runAutoFinalizeState.attemptsInWindow = 0;
    }
    const canAutoFinalize = !isGuided && likelyBudgetStop && _runAutoFinalizeState.attemptsInWindow < _RUN_AUTO_FINALIZE_MAX_ATTEMPTS;
    if (canAutoFinalize) {
      _runAutoFinalizeState.lastAt = now;
      _runAutoFinalizeState.attemptsInWindow += 1;
      const autoMsg = `A execucao encerrou apos ${toolCalls} etapas sem resposta final. Tentando uma continuacao automatica para concluir.`;
      addSystemBubble(autoMsg);
      setChatRuntimeRoute('openclaude_tools', autoMsg);
      sendFollowup('Continue exatamente de onde parou e entregue somente a resposta final consolidada em formato objetivo. Nao reinicie a investigacao.');
      _runVisibleResponseState.set(runId, true);
    }
    const fallback = likelyBudgetStop
      ? `A execucao foi encerrada apos ${toolCalls} chamadas de ferramenta sem resposta final. Provavel limite de tokens/etapas. Tente reduzir escopo ou pedir resposta curta em blocos.`
      : 'A execucao foi concluida, mas o agente nao retornou uma resposta final. Tente novamente ou ajuste a solicitacao.';
    if (!canAutoFinalize) {
      addBubble('agent', `<div class="answer-md"><p>${escapeHtml(fallback)}</p></div>`);
      setChatRuntimeRoute('error', fallback);
    }
  }

  // Update stop button to done indicator
  const stopBtn = document.getElementById(`stop-${runId}`);
  if (stopBtn) {
    stopBtn.innerHTML = '<i class="fas fa-check"></i>';
    stopBtn.disabled = true;
    stopBtn.style.opacity = '0.4';
  }

  if (sessionTokensIn > 0 || sessionCostUsd > 0) {
    onSessionSummary(runId);
  }

  delete _lastToolCallsMap[runId];
  _runVisibleResponseState.delete(runId);
  _runToolCallCount.delete(runId);
  _runResponseAccumulator.delete(runId);
  if (typeof window.stopArtifactPolling === 'function') window.stopArtifactPolling();

  // Auto-save conversation after agent response completes (user-proof persistence)
  if (typeof window.autoSaveChat === 'function') {
    window.autoSaveChat();
  }
}

function onError(runId, message) {
  const log = document.getElementById(`log-${runId}`);
  if (!log) return;
  setChatRuntimeRoute('error', message || 'Falha na execucao do stream.');

  const errEl = document.createElement('div');
  errEl.className = 'log-error';
  errEl.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Erro: ${escapeHtml(message)}`;
  log.appendChild(errEl);

  const stopBtn = document.getElementById(`stop-${runId}`);
  if (stopBtn) {
    stopBtn.innerHTML = '<i class="fas fa-times"></i> Erro';
    stopBtn.disabled = true;
  }
  _runVisibleResponseState.delete(runId);
  _runToolCallCount.delete(runId);
  _runResponseAccumulator.delete(runId);
}

function onStepReasoning(reasoning) {
  // Optional: show reasoning in collapsed section
}

function onFileAccessed(path) {
  const runId = currentRunId;
  const log = document.getElementById(`log-${runId}`);
  if (!log) return;

  const el = document.createElement('div');
  el.className = 'log-file-access';
  el.innerHTML = `<i class="fas fa-file"></i> ${escapeHtml(path)}`;
  log.appendChild(el);
}

function onDataConsumed(bytes) {
  runTokensIn += bytes;
  sessionTokensIn += bytes;
}

function onStepOutcome(outcome) {
  const runId = currentRunId;
  const log = document.getElementById(`log-${runId}`);
  if (!log) return;

  const el = document.createElement('div');
  el.className = 'log-step-outcome';
  el.innerHTML = `<i class="fas fa-arrow-right"></i> ${escapeHtml(outcome)}`;
  log.appendChild(el);
}

function onCostWarning(cost) {
  const runId = currentRunId;
  const log = document.getElementById(`log-${runId}`);
  if (!log) return;

  const el = document.createElement('div');
  el.className = 'log-cost-warning';
  el.innerHTML = `<i class="fas fa-dollar-sign"></i> Custo estimado: $${cost.toFixed(2)}`;
  log.appendChild(el);
}

function onSessionSummary(runId) {
  const log = document.getElementById(`log-${runId}`);
  if (!log) return;

  const summary = document.createElement('div');
  summary.className = 'log-session-summary';
  summary.innerHTML = `
    <div class="log-summary-header"><i class="fas fa-chart-bar"></i> Resumo da sessão</div>
    <div class="log-summary-grid">
      <div><span>Tokens entrada:</span><span>${sessionTokensIn.toLocaleString()}</span></div>
      <div><span>Tokens saída:</span><span>${sessionTokensOut.toLocaleString()}</span></div>
      <div><span>Custo total:</span><span>$${sessionCostUsd.toFixed(2)}</span></div>
      <div><span>Passos executados:</span><span>${stepCount}</span></div>
    </div>
  `;
  log.appendChild(summary);
}

// Handle stream events
function handleStreamEvent(data, runId, isGuided) {
  const eventType = data.event || data.type;
  if (eventType === 'status') {
    const statusMessage = String(data && data.message || '').trim();
    const inferred = inferRuntimeRouteFromStatusMessage(statusMessage);
    if (inferred) {
      setChatRuntimeRoute(inferred, statusMessage);
    }
  }

  switch (eventType) {
    case 'status':
      onAgentStatus({
        step: data.step,
        message: data.message || 'Atualizacao de status do backend',
        detail: data.detail || '',
      });
      break;
    case 'step':
      onStep(data.step);
      break;
    case 'checkpoint':
      onCheckpoint(data.step);
      break;
    case 'awaiting_guidance':
      onAwaitingGuidance();
      break;
    case 'awaiting_input':
      onAwaitingInput(data.tool_name || data.tool || 'ferramenta');
      break;
    case 'thinking':
      onThinking(data.content);
      break;
    case 'agent_status':
      onAgentStatus(data);
      break;
    case 'resumed':
      onResumed();
      break;
    case 'stopped':
      onStopped();
      break;
    case 'tool_call':
      onToolCall(data.tool_name || data.tool, data.args);
      break;
    case 'tool_result':
      onToolResult(data.tool_name || data.tool, data.result);
      break;
    case 'done':
      onDone(runId, isGuided);
      break;
    case 'error':
      onError(runId, data.message);
      break;
    case 'step_reasoning':
      onStepReasoning(data.reasoning);
      break;
    case 'file_accessed':
      onFileAccessed(data.path);
      break;
    case 'data_consumed':
      onDataConsumed(data.bytes);
      break;
    case 'step_outcome':
      onStepOutcome(data.outcome);
      break;
    case 'cost_warning':
      onCostWarning(data.cost);
      break;
    case 'session_summary':
      onSessionSummary(runId);
      break;
    case 'session_id':
      onSessionId(data);
      break;
    case 'artifact':
      if (typeof addOutputArtifact === 'function') {
        const artifact = data.artifact || data;
        addOutputArtifact(artifact);
        _autoOpenGeneratedHtmlArtifact(artifact);
      }
      break;
    default:
      console.log('Unhandled stream event:', eventType, data);
  }
}

// Append followup bubble
function appendFollowupBubble(text) {
  const bubble = addBubble('user', `<p>${escapeHtml(text)}</p>`, true);
  bubble.classList.add('followup');
  return bubble;
}

// Submit followup bubble
function submitFollowupBubble(btn) {
  const bubble = btn.closest('.followup');
  const textEl = bubble.querySelector('p');
  if (!textEl) return;

  const text = textEl.textContent;
  if (!text) return;

  bubble.remove();
  sendFollowup(text);
}

// Send guided resume
function sendGuidedResume(instruction, step) {
  var body;
  if (!instruction || instruction === 'continue') {
    // Auto-resume
    body = { resume: 'continue' };
  } else {
    // Send specific guidance
    body = { resume: 'guidance', guidance: instruction };
  }
  // Route to guided or auditor resume depending on active stream type
  const endpoint = (activeStream && activeStream.type === 'auditor')
    ? `${API_BASE}/api/auditor/resume`
    : `${API_BASE}/api/guided/resume`;
  fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).catch(function (err) {
    console.warn('[Stream] sendGuidedResume failed:', err && err.message || err);
  });
}

// Submit ask_human response — user answers the agent's question
function submitAskHumanResponse(inputId) {
  const inp = document.getElementById(inputId);
  if (!inp) return;
  const text = inp.value.trim();
  if (!text) { inp.focus(); return; }

  // Disable input after sending
  inp.disabled = true;
  const btn = inp.parentElement.querySelector('.ask-human-send');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-check"></i>'; }

  // Show user response in chat
  addBubble('user', `<p>${escapeHtml(text)}</p>`);

  // Route based on active stream type
  const mode = activeStream && activeStream.type;
  if (mode === 'auditor') {
    sendGuidedResume(text);
  } else if (mode === 'guided') {
    sendGuidedResume(text);
  } else {
    // General agent mode — use /api/agent/respond
    fetch(`${API_BASE}/api/agent/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ response: text })
    }).catch(function (err) {
      console.warn('[Stream] submitAskHumanResponse failed:', err && err.message || err);
    });
  }
}

// Send agent response from TheBridge
function sendAgentResponse(data) {
  if (!data || !data.response) return;
  addBubble('agent', `<div class="answer-md">${enrichChatFileLinks(marked.parse(data.response))}</div>`);
}

// Stop active stream
function stopStream(runId, isGuided) {
  if (!activeStream || activeStream.id !== runId) return;

  // Route stop to the correct endpoint based on active stream type
  const mode = activeStream.type;
  let stopEndpoint;
  if (mode === 'auditor') {
    stopEndpoint = `${API_BASE}/api/auditor/stop`;
  } else if (mode === 'guided') {
    stopEndpoint = `${API_BASE}/api/guided/stop`;
  } else {
    stopEndpoint = `${API_BASE}/api/agent/stop`;
  }
  fetch(stopEndpoint, { method: 'POST' })
    .catch(function (err) { console.warn('[Stream] stopStream failed:', err && err.message || err); });

  const stopBtn = document.getElementById(`stop-${runId}`);
  if (stopBtn) {
    stopBtn.innerHTML = '<i class="fas fa-stop"></i> Parando...';
    stopBtn.disabled = true;
  }

  if (activeGuidanceBar && activeGuidanceBar.parentNode) {
    activeGuidanceBar.parentNode.removeChild(activeGuidanceBar);
  }
  activeGuidanceBar = null;
}

// Load saved chat
// loadChatHistory / loadChatFromServer / saveChat are the single
// authoritative definitions in history.js (loaded after this file).
async function loadSavedChat(chatId) {
  await window.loadChatFromServer(chatId);
}

function _plainTextFromHtml(html) {
  const el = document.createElement('div');
  el.innerHTML = String(html || '');
  return (el.innerText || el.textContent || '').trim();
}

function _lastAssistantMessage() {
  for (let i = chatHistory.length - 1; i >= 0; i--) {
    const msg = chatHistory[i];
    if (!msg) continue;
    if (msg.role === 'agent' || msg.role === 'assistant') return msg;
  }

  const log = document.getElementById('chatLog');
  if (log) {
    const nodes = log.querySelectorAll('.chat-bubble.agent:not(.olivia-thinking)');
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      const answerEl = node.querySelector('.answer-md');
      const html = answerEl ? answerEl.innerHTML : node.innerHTML;
      const text = _plainTextFromHtml(html);
      if (text) {
        return {
          role: 'assistant',
          html,
          timestamp: new Date().toISOString(),
        };
      }
    }
  }

  return null;
}

async function copyLastAssistantMessage() {
  const msg = _lastAssistantMessage();
  if (!msg) {
    addSystemBubble('Nenhuma resposta do assistente para copiar');
    return;
  }
  const text = _plainTextFromHtml(msg.html);
  if (!text) {
    addSystemBubble('A última resposta está vazia');
    return;
  }

  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    addSystemBubble('Última resposta copiada para a área de transferência');
  } catch (_e) {
    addSystemBubble('Falha ao copiar a última resposta');
  }
}

function exportLastMessageTxt() {
  const msg = _lastAssistantMessage();
  if (!msg) {
    addSystemBubble('Nenhuma resposta do assistente para exportar');
    return;
  }

  const role = msg.role === 'agent' ? 'Agente' : 'Assistente';
  const text = _plainTextFromHtml(msg.html);
  if (!text) {
    addSystemBubble('A última resposta está vazia');
    return;
  }
  const payload = `${role}: ${text}\n`;
  const blob = new Blob([payload], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `chat_last_message_${new Date().toISOString().slice(0, 10)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
  addSystemBubble('Última resposta exportada');
}

// ─── Shared brand kit — reuse this for any other export/print surface ───
// NOTE: uses var (not const/let) to avoid "Identifier has already been declared"
// if olivia-pdf-export.js loads first and sets window.OLIVIA_PDF_BRAND.
var OLIVIA_PDF_BRAND = window.OLIVIA_PDF_BRAND || {
  name: 'Olivia',
  kicker: 'Olivia · Workspace Export',
  footerLeft: 'Olivia · AI Operating Environment',
  colors: {
    cream: '#faf9f6',
    ink: '#1a1a1a',
    forestDark: '#1c4532',
    forestMid: '#2d785a',
    amber: '#c4622d',
    amberLight: '#d4733e',
    gray: '#8a8a8a',
    grayHi: '#5a5a5a',
    border: 'rgba(28, 69, 50, 0.14)',
    codeBg: 'rgba(28, 69, 50, 0.05)',
    quoteBg: 'rgba(196, 98, 45, 0.05)',
  },
  // Exact mark used across Olivia surfaces (favicon / sidebar / nav)
  logoSvg: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
    <rect width="32" height="32" rx="8" fill="#1c4532"/>
    <g transform="translate(6,7) scale(0.31)">
      <path d="M12 52 Q24 38,34 30 Q44 22,54 16" fill="none" stroke="#faf9f6" stroke-width="2.5" stroke-linecap="round" opacity=".6"/>
      <path d="M28 36 Q20 26,16 18 Q24 24,28 36Z" fill="#faf9f6" opacity=".4"/>
      <path d="M30 34 Q38 24,44 18 Q38 28,30 34Z" fill="#faf9f6" opacity=".35"/>
      <path d="M42 24 Q36 14,34 8 Q40 14,42 24Z" fill="#faf9f6" opacity=".35"/>
      <ellipse cx="22" cy="42" rx="4" ry="5" fill="#c4622d"/>
    </g>
  </svg>`
};

// Download last assistant response as branded PDF
async function downloadLastResponseAsPdf() {
  const msg = _lastAssistantMessage();
  if (!msg) {
    addSystemBubble('Nenhuma resposta do assistente para exportar como PDF');
    return;
  }

  const role = msg.role === 'agent' ? 'Agente' : 'Assistente';
  const html = msg.html || '';

  if (!html) {
    addSystemBubble('A última resposta está vazia');
    return;
  }

  function _escapeHtml(s) {
    return String(s || '').replace(/&/g, '&amp;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  const B = OLIVIA_PDF_BRAND;
  const now = new Date();
  const timestamp = now.toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' });
  const fileDate = now.toISOString().slice(0, 10);
  const title = `Olivia · ${role} · ${fileDate}`;

  const printDoc = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${_escapeHtml(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400&family=Plus+Jakarta+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  @page { margin: 20mm 18mm 22mm; }
  * {
    box-sizing: border-box;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
  }
  body {
    font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
    color: ${B.colors.ink};
    font-size: 11.5pt;
    line-height: 1.65;
    margin: 0;
    background: ${B.colors.cream};
  }
  .brand-accent-bar {
    height: 5px;
    border-radius: 3px;
    background: linear-gradient(90deg, ${B.colors.forestDark} 0%, ${B.colors.forestMid} 55%, ${B.colors.amber} 100%);
    margin-bottom: 22px;
  }
  .brand-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding-bottom: 14px;
    margin-bottom: 24px;
    border-bottom: 1px solid ${B.colors.border};
  }
  .brand-mark { width: 30px; height: 30px; flex: 0 0 auto; }
  .brand-mark svg { width: 100%; height: 100%; display: block; }
  .brand-word { display: flex; flex-direction: column; line-height: 1.25; }
  .brand-name {
    font-family: 'Fraunces', Georgia, serif;
    font-weight: 500;
    font-size: 17pt;
    letter-spacing: -0.01em;
    color: ${B.colors.forestDark};
  }
  .brand-kicker {
    font-family: 'JetBrains Mono', monospace;
    font-size: 7.5pt;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: ${B.colors.amber};
    margin-top: 2px;
  }
  .brand-meta {
    margin-left: auto;
    text-align: right;
    font-family: 'JetBrains Mono', monospace;
    font-size: 8pt;
    letter-spacing: 0.03em;
    color: ${B.colors.grayHi};
    line-height: 1.8;
  }
  .role-tag {
    display: inline-block;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-size: 7.5pt;
    color: ${B.colors.forestDark};
    background: rgba(28, 69, 50, 0.08);
    border: 1px solid ${B.colors.border};
    padding: 3px 10px;
    border-radius: 20px;
  }
  .content { font-size: 11.5pt; line-height: 1.7; }
  .content h1, .content h2, .content h3, .content h4 {
    font-family: 'Fraunces', Georgia, serif;
    font-weight: 500;
    letter-spacing: -0.01em;
    color: ${B.colors.forestDark};
    line-height: 1.3;
    margin: 1.3em 0 0.5em;
    page-break-after: avoid;
    break-after: avoid;
  }
  .content h1 { font-size: 18pt; border-bottom: 1px solid ${B.colors.border}; padding-bottom: 6px; }
  .content h2 { font-size: 15pt; }
  .content h3 { font-size: 13pt; }
  .content p, .content li { margin: 0 0 0.9em; orphans: 3; widows: 3; }
  .content a { color: ${B.colors.forestMid}; text-decoration: underline; }
  .content strong { color: ${B.colors.forestDark}; }
  .content ul, .content ol { margin: 0 0 0.9em; padding-left: 1.4em; }
  .content code {
    font-family: 'JetBrains Mono', monospace;
    background: ${B.colors.codeBg};
    padding: 1px 5px;
    border-radius: 4px;
    font-size: 0.9em;
    color: ${B.colors.forestDark};
  }
  .content pre {
    font-family: 'JetBrains Mono', monospace;
    background: ${B.colors.codeBg};
    border-left: 3px solid ${B.colors.amber};
    padding: 12px 14px;
    border-radius: 0 6px 6px 0;
    overflow: auto;
    font-size: 9.5pt;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .content pre code { background: none; padding: 0; }
  .content blockquote {
    border-left: 3px solid ${B.colors.amber};
    margin: 0 0 0.9em;
    padding: 4px 16px;
    color: ${B.colors.grayHi};
    font-style: italic;
    background: ${B.colors.quoteBg};
    border-radius: 0 6px 6px 0;
  }
  .content table {
    border-collapse: collapse;
    width: 100%;
    margin: 12px 0;
    font-size: 10pt;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .content th, .content td {
    border: 1px solid ${B.colors.border};
    padding: 7px 10px;
    text-align: left;
  }
  .content th {
    background: rgba(28, 69, 50, 0.06);
    color: ${B.colors.forestDark};
    font-weight: 600;
  }
  .content tr:nth-child(even) td { background: rgba(28, 69, 50, 0.02); }
  .content img { max-width: 100%; border-radius: 6px; }
  .content hr { border: none; border-top: 1px solid ${B.colors.border}; margin: 20px 0; }
  .brand-footer {
    margin-top: 32px;
    padding-top: 10px;
    border-top: 1px solid ${B.colors.border};
    display: flex;
    justify-content: space-between;
    font-family: 'JetBrains Mono', monospace;
    font-size: 7.5pt;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: ${B.colors.gray};
  }
</style>
</head>
<body>
  <div class="doc-wrapper">
    <div class="brand-accent-bar"></div>
    <div class="brand-header">
      <span class="brand-mark">${B.logoSvg}</span>
      <div class="brand-word">
        <span class="brand-name">${B.name}</span>
        <span class="brand-kicker">${_escapeHtml(B.kicker)}</span>
      </div>
      <div class="brand-meta">
        <span class="role-tag">${_escapeHtml(role)}</span><br>
        ${_escapeHtml(timestamp)}
      </div>
    </div>
    <div class="content">${html}</div>
    <div class="brand-footer">
      <span>${_escapeHtml(B.footerLeft)}</span>
      <span>Exportado em ${fileDate}</span>
    </div>
  </div>
</body>
</html>`;

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const finish = () => {
    try { document.body.removeChild(iframe); } catch (_) {}
  };

  iframe.onload = () => {
    let printed = false;
    const triggerPrint = () => {
      if (printed) return;
      printed = true;
      try {
        iframe.contentWindow.document.title = title;
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (_) {}
      setTimeout(finish, 1500);
    };

    // Wait for the brand webfonts (Fraunces / Plus Jakarta Sans / JetBrains
    // Mono) to finish loading before printing, so the exported PDF doesn't
    // get captured mid-swap on a fallback font. Falls back to a fixed delay
    // if the Font Loading API isn't available or never resolves.
    const idoc = iframe.contentWindow.document;
    if (idoc.fonts && idoc.fonts.ready) {
      idoc.fonts.ready.then(triggerPrint).catch(triggerPrint);
      setTimeout(triggerPrint, 900);
    } else {
      setTimeout(triggerPrint, 300);
    }
  };

  iframe.srcdoc = printDoc;
  addSystemBubble('Preparando PDF com a identidade Olivia...');
}

// Clear chat
async function clearChat() {
  if (!await window.customConfirm('Limpar esta conversa? O histórico não será salvo.')) return;

  showWelcomeView();
  _agentRunSessions.clear();
  addSystemBubble('Conversa limpa');
}

// Toggle chat-header-right options behind ••• menu
function toggleHeaderOptions() {
  var dots = document.getElementById('headerDotsToggle');
  if (!dots) return;
  setHeaderOptionsOpen(!dots.classList.contains('open'));
}

function setHeaderOptionsOpen(open) {
  var dots = document.getElementById('headerDotsToggle');
  if (!dots) return;
  var opts = document.querySelectorAll('.chat-header-right .header-opt');
  dots.classList.toggle('open', !!open);
  opts.forEach(function (el) {
    el.classList.toggle('show', !!open);
  });
}

document.addEventListener('DOMContentLoaded', function () {
  initPanelContextControls();
  _bindBrowserPanelContextTracking();
  _applyUnifiedLA8159ModeUi(false);
  _renderAssistantContextPreviewDebugUi();

  document.addEventListener('click', function (ev) {
    var dots = document.getElementById('headerDotsToggle');
    if (!dots || !dots.classList.contains('open')) return;
    var target = ev.target;
    var inside = target && typeof target.closest === 'function'
      ? target.closest('.chat-header-right')
      : null;
    if (!inside) setHeaderOptionsOpen(false);
  });

  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape') {
      setHeaderOptionsOpen(false);
    }
  });
});

// Expose functions to window scope
window.showChatView = showChatView;
window.showWelcomeView = showWelcomeView;
window.toggleOliviaMode = toggleOliviaMode;
window.toggleKoutMode = toggleOliviaMode;
window.resetToWelcome = resetToWelcome;
window.useHint = useHint;
window.scrollHintsCarousel = scrollHintsCarousel;
window.addBubble = addBubble;
window.addSystemBubble = addSystemBubble;
window.addThinkingBubble = addThinkingBubble;
window.setThinking = setThinking;
window.sendMessage = sendMessage;
window.sendAssistantMessage = sendAssistantMessage;
window.sendFollowup = sendFollowup;
window.runStream = runStream;
window.onThinking = onThinking;
window.appendFollowupBubble = appendFollowupBubble;
window.submitFollowupBubble = submitFollowupBubble;
window.sendGuidedResume = sendGuidedResume;
window.sendAgentResponse = sendAgentResponse;
window.stopStream = stopStream;
window.stopActiveStream = stopActiveStream;
window.koutPinPath = koutPinPath;
window.koutUnpinPath = koutUnpinPath;
window.koutIsPinned = koutIsPinned;
window.koutPinnedPaths = koutPinnedPaths;
window.koutClearPinnedPaths = koutClearPinnedPaths;
window.buildPinnedPathsContext = buildPinnedPathsContext;
window.openStreamArtifact = openStreamArtifact;
window.openArtifactInBrowser = openArtifactInBrowser;
// loadChatHistory / loadChatFromServer / saveChat delegated to history.js
window.loadSavedChat = loadSavedChat;
window.copyLastAssistantMessage = copyLastAssistantMessage;
window.exportLastMessageTxt = exportLastMessageTxt;
window.downloadLastResponseAsPdf = downloadLastResponseAsPdf;
window.clearChat = clearChat;
window.setPanelContextEnabled = setPanelContextEnabled;
window.refreshPanelContextStatus = refreshPanelContextStatus;
window.getPanelContextSelectionSummary = getPanelContextSelectionSummary;
window.formatPanelContextLabel = formatPanelContextLabel;
window.buildSelectedPanelContext = buildSelectedPanelContext;
window.toggleAssistantContextPreviewDebug = toggleAssistantContextPreviewDebug;
window.setAssistantContextPreviewDebug = setAssistantContextPreviewDebug;
window.getAssistantContextPreviewDebugEnabled = getAssistantContextPreviewDebugEnabled;

// Stream event handlers
window.onStep = onStep;
window.onCheckpoint = onCheckpoint;
window.onAwaitingGuidance = onAwaitingGuidance;
window.onAwaitingInput = onAwaitingInput;
window.onResumed = onResumed;
window.onStopped = onStopped;
window.onToolCall = onToolCall;
window.onToolResult = onToolResult;
window.onDone = onDone;
window.onError = onError;
window.onStepReasoning = onStepReasoning;
window.onFileAccessed = onFileAccessed;
window.onDataConsumed = onDataConsumed;
window.onStepOutcome = onStepOutcome;
window.onCostWarning = onCostWarning;
window.onSessionSummary = onSessionSummary;