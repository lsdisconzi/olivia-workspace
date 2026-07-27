/* ============================================================================
   Craudio — seção de litígio multijurisdicional dentro do Olivia Workspace.
   Apresenta os workflows e agentes do plugin Craudio e oferece um chat dedicado
   que conversa com o backend /api/assistant/chat (SSE). Sem mudanças no servidor.
   ============================================================================ */
(function () {
  'use strict';

  // ── Catálogo de workflows (24 skills do plugin craudio) ──────────────────
  var CR_GROUPS = [
    { id: 'config', label: 'Configuração' },
    { id: 'analysis', label: 'Análise & Evidência' },
    { id: 'drafting', label: 'Redação' },
    { id: 'review', label: 'Revisão & Gestão' },
  ];

  var CR_WORKFLOWS = [
    {
      name: 'cold-start-interview', group: 'config', title: 'Entrevista de Abertura',
      desc: 'Entrevista de intake e configuração do caso — aprende parâmetros, preferências de patrono, estratégia de jurisdição e caminhos de documentos. Rode primeiro: todo o resto depende dela.'
    },
    {
      name: 'matter-intake', group: 'config', title: 'Abertura de Caso',
      desc: 'Cria o arquivo formal do caso — grava matter.md com identificação, partes, jurisdição e estratégia inicial, e anexa ao log de casos do escritório.'
    },
    {
      name: 'customize', group: 'config', title: 'Personalizar Plugin',
      desc: 'Adapta o plugin a um novo advogado, escritório ou caso sem refazer toda a entrevista — muda preferências, estilo, contatos de escalonamento ou calibragem de risco.'
    },

    {
      name: 'violation-analysis', group: 'analysis', title: 'Análise de Violações',
      desc: 'Processa violações candidatas pelo pipeline estruturado — evidência → normas → nexo → confiança → enriquecimento jurisprudencial. O motor central de raciocínio.'
    },
    {
      name: 'legal-framework-mapping', group: 'analysis', title: 'Mapeamento de Marco Legal',
      desc: 'Mapeia cada fato do caso a cada artigo legal aplicável em todas as jurisdições. Marcos e artigos carregados a partir dos packs.'
    },
    {
      name: 'cross-jurisdiction-nexus', group: 'analysis', title: 'Nexo Interjurisdicional',
      desc: 'Analisa as conexões entre jurisdições — como conduta em um país gera consequências em outro e como condutas de agentes estatais ativam obrigações de tratados.'
    },
    {
      name: 'systemic-pattern-analysis', group: 'analysis', title: 'Padrão Sistêmico',
      desc: 'Analisa o padrão institucional entre incidentes — políticas recorrentes, práticas de manuseio de documentos e cultura. Distingue o padrão sistêmico das violações individuais.'
    },
    {
      name: 'evidence-chain-verification', group: 'analysis', title: 'Cadeia de Custódia',
      desc: 'Verifica autenticidade, cadeia de custódia e integridade forense das provas — hashes, alinhamento fonte-transcrição, diarização e lacunas que exigem ordens de preservação.'
    },
    {
      name: 'transcript-segment-analysis', group: 'analysis', title: 'Análise de Transcrições',
      desc: 'Mineração profunda do corpus de transcrições — extrai citações verbatim, identifica admissões-chave e cruza segmentos a violações específicas.'
    },
    {
      name: 'document-authentication', group: 'analysis', title: 'Autenticação de Documentos',
      desc: 'Autentica documentos físicos e digitais para uso judicial — verifica se gravações, transcrições e provas documentais atendem aos padrões de cada jurisdição.'
    },
    {
      name: 'prejudice-quantification', group: 'analysis', title: 'Quantificação de Danos',
      desc: 'Calcula danos morais e materiais em todas as jurisdições do caso. Rubricas de dano, referências e limites de responsabilidade vêm dos packs.'
    },
    {
      name: 'jurisprudence-search', group: 'analysis', title: 'Busca de Jurisprudência',
      desc: 'Busca precedentes de apoio nas bases jurisprudenciais de cada jurisdição declarada pelo caso.'
    },

    {
      name: 'demand-draft', group: 'drafting', title: 'Carta de Demanda',
      desc: 'Redige cartas de demanda específicas por jurisdição para cada réu — idioma e foro vêm dos packs; pretensões vêm da análise de violações do caso.'
    },
    {
      name: 'claim-chart', group: 'drafting', title: 'Claim Chart',
      desc: 'Constrói claim charts elemento a elemento para cada causa de pedir — mapeia elementos legais a fatos específicos com âncoras de evidência.'
    },
    {
      name: 'brief-section-drafter', group: 'drafting', title: 'Redação de Peças',
      desc: 'Redige seções de petições e peças para os foros do caso — específicas por jurisdição, no idioma do foro, com citações de evidência.'
    },
    {
      name: 'chronology', group: 'drafting', title: 'Cronologia do Caso',
      desc: 'Monta a linha do tempo canônica a partir de timestamps de transcrições, metadados de provas e registros de violação. Cada entrada ancorada a evidência específica.'
    },
    {
      name: 'deposition-prep', group: 'drafting', title: 'Preparação de Depoimentos',
      desc: 'Monta roteiros de depoimento e inquirição de testemunhas para os atores-chave do caso, a partir do registro de atores.'
    },

    {
      name: 'ontology-validate', group: 'review', title: 'Validação de Ontologia',
      desc: 'Confere uma saída de análise jurídica contra as invariantes da ontologia legível por máquina. Use após qualquer skill de motor — antes de a saída chegar a um tribunal.'
    },
    {
      name: 'privilege-log-review', group: 'review', title: 'Sigilo & Privilégio',
      desc: 'Analisa sigilo e privilégio transfronteiriço — distingue as proteções de cada jurisdição e identifica riscos de privilégio entre fronteiras.'
    },
    {
      name: 'legal-hold', group: 'review', title: 'Ordem de Preservação',
      desc: 'Emite, renova, libera ou reporta ordens de preservação de provas — redige notificações e pedidos judiciais de preservação e acompanha custodiantes.'
    },
    {
      name: 'matter-briefing', group: 'review', title: 'Briefing do Caso',
      desc: 'Gera um briefing aprofundado do caso — pronto para sócio, co-counsel ou chamada com cliente. Destila violações, provas e transcrições em um resumo executivo.'
    },
    {
      name: 'matter-update', group: 'review', title: 'Atualização do Caso',
      desc: 'Anexa um evento datado ao histórico do caso e atualiza sua linha no log — desenvolvimentos, mudanças de status/fase, reavaliação de risco e prazos.'
    },
    {
      name: 'matter-close', group: 'review', title: 'Encerramento do Caso',
      desc: 'Encerra o caso — registra o desfecho em todas as jurisdições, danos recuperados vs. estimados, lições e estado final, sem apagar o registro.'
    },
    {
      name: 'oc-status', group: 'review', title: 'Status para Co-counsel (CL)',
      desc: 'Gera um informe periódico para o co-counsel chileno — status nos foros BR e CL, coordenação interjurisdicional, vigília de prescrição e itens de ação.'
    },
  ];

  // ── Catálogo de agentes agendados (8) ────────────────────────────────────
  var CR_AGENTS = [
    {
      name: 'deadline-tracker', title: 'Rastreador de Prazos', cadence: 'Diário',
      desc: 'Acompanha toda prescrição, decadência e prazo processual em todas as jurisdições. Produz uma contagem regressiva priorizada e escala agressivamente nos 30 dias finais de qualquer prazo crítico.'
    },
    {
      name: 'docket-watcher-br', title: 'Vigia de Autos · Brasil', cadence: 'Diário',
      desc: 'Monitora autos judiciais e procedimentos administrativos brasileiros em busca de novas petições, decisões e prazos. Posta alertas no canal configurado no perfil do caso.'
    },
    {
      name: 'docket-watcher-cl', title: 'Vigia de Autos · Chile', cadence: 'Diário',
      desc: 'Monitora autos judiciais e procedimentos administrativos chilenos em busca de novas petições, decisões e prazos. Posta alertas no canal configurado no perfil do caso.'
    },
    {
      name: 'evidence-integrity-monitor', title: 'Integridade de Provas', cadence: 'Semanal',
      desc: 'Verifica a integridade das provas — confere hashes SHA-256 contra o manifesto, checa lacunas na cadeia de custódia e monitora novas provas adicionadas ao acervo.'
    },
    {
      name: 'jurisprudence-updater', title: 'Atualizador de Jurisprudência', cadence: 'Semanal',
      desc: 'Varre as fontes jurisprudenciais de cada jurisdição em busca de novos precedentes sobre os temas do caso. Sinaliza decisões que fortalecem, enfraquecem ou distinguem a tese.'
    },
    {
      name: 'regulatory-feed-monitor', title: 'Monitor Regulatório', cadence: 'Semanal',
      desc: 'Consulta os órgãos reguladores relevantes ao caso em busca de mudanças, novas resoluções, ações de enforcement e posicionamentos que afetem a estratégia.'
    },
    {
      name: 'media-monitor', title: 'Monitor de Mídia', cadence: 'Semanal',
      desc: 'Monitora imprensa, publicações setoriais e redes sociais sobre o caso, as partes e reclamações de consumidores. Sinaliza riscos reputacionais e indícios de pressão por acordo.'
    },
    {
      name: 'cross-border-service-monitor', title: 'Citação Internacional', cadence: 'Semanal',
      desc: 'Acompanha a citação internacional de cada réu — cartas rogatórias, apostilamento, conformidade com convenções e traduções. Sinaliza atrasos que ameacem prazos de prescrição.'
    },
  ];

  var CR_PIPELINE = ['Evidência', 'Normas', 'Nexo', 'Confiança', 'Jurisprudência'];

  var CUBE_SVG =
    '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">' +
    '<g stroke="currentColor" stroke-width="3.5" stroke-linejoin="round">' +
    '<path fill="currentColor" fill-opacity="0.95" d="M50 18 L80 35 L50 52 L20 35 Z"/>' +
    '<path fill="currentColor" fill-opacity="0.52" d="M20 35 L50 52 L50 86 L20 69 Z"/>' +
    '<path fill="currentColor" fill-opacity="0.28" d="M80 35 L80 69 L50 86 L50 52 Z"/>' +
    '</g></svg>';

  // ── Estado ───────────────────────────────────────────────────────────────
  var crBuilt = false;
  var crActivePanel = 'overview';
  var crHistory = [];
  var crSessionId = null;
  var crPrimerSent = false;
  var crStreaming = false;
  var CR_STORAGE_KEY = 'Olivia_craudio_chat_v1';

  var CR_PRIMER = [
    'Você é o Craudio — assistente de litígio civil multijurisdicional (Brasil, Chile e direito internacional de tratados).',
    'Trabalha por workflows estruturados: 24 skills (entrevista de abertura, análise de violações, claim charts, cartas de demanda, etc.) e 8 agentes agendados.',
    'Regras: (1) responda em português do Brasil salvo pedido contrário; (2) toda saída é uma MINUTA para revisão do advogado — nunca uma conclusão jurídica; (3) sem linguagem conclusiva (culpado, responsável, provado); (4) cite a base de cada afirmação; (5) tom executivo e direto.',
    '— Mensagem do usuário —',
  ].join('\n');

  // ── Helpers ──────────────────────────────────────────────────────────────
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function renderMd(text) {
    try {
      if (window.marked && typeof window.marked.parse === 'function') {
        return window.marked.parse(String(text || ''));
      }
    } catch (_e) { /* fall through */ }
    return '<p>' + esc(text).replace(/\n/g, '<br>') + '</p>';
  }
  function apiBase() {
    return (typeof API_BASE === 'string' && API_BASE)
      ? String(API_BASE).replace(/\/$/, '')
      : window.location.origin;
  }

  // ── Construção da view ───────────────────────────────────────────────────
  function build() {
    var view = document.getElementById('craudioView');
    if (!view || crBuilt) return;

    view.innerHTML =
      '<div class="cr-head">' +
      '<div class="cr-head-brand">' +
      '<span class="cr-logo">' + CUBE_SVG + '</span>' +
      '<span class="cr-title">Craudio</span>' +
      '<span class="cr-sub">Litígio Multijurisdicional</span>' +
      '</div>' +
      '<button class="btn btn-sm" onclick="craudioHideView()" title="Fechar">' +
      '<i class="fas fa-times"></i></button>' +
      '</div>' +
      '<div class="cr-subnav">' +
      '<button class="cr-tab active" data-panel="overview"  onclick="craudioSwitchPanel(\'overview\')">Visão Geral</button>' +
      '<button class="cr-tab"        data-panel="workflows" onclick="craudioSwitchPanel(\'workflows\')">Workflows</button>' +
      '<button class="cr-tab"        data-panel="agents"    onclick="craudioSwitchPanel(\'agents\')">Agentes</button>' +
      '<button class="cr-tab"        data-panel="chat"      onclick="craudioSwitchPanel(\'chat\')">Chat</button>' +
      '</div>' +
      '<div class="cr-panels">' +
      '<div id="crPanel-overview"  class="cr-panel active">' + overviewHtml() + '</div>' +
      '<div id="crPanel-workflows" class="cr-panel">' + workflowsHtml() + '</div>' +
      '<div id="crPanel-agents"    class="cr-panel">' + agentsHtml() + '</div>' +
      '<div id="crPanel-chat"      class="cr-panel">' + chatHtml() + '</div>' +
      '</div>' +
      '<div id="crDetail" class="cr-detail">' +
      '<div class="cr-detail-backdrop" onclick="craudioCloseDetail()"></div>' +
      '<div class="cr-detail-card" id="crDetailCard"></div>' +
      '</div>';

    crBuilt = true;
    loadHistory();
    renderChatLog();
  }

  function overviewHtml() {
    var pipeline = CR_PIPELINE.map(function (s, i) {
      return '<span class="cr-pipe-step">' + esc(s) + '</span>' +
        (i < CR_PIPELINE.length - 1 ? '<i class="fas fa-arrow-right cr-pipe-arrow"></i>' : '');
    }).join('');
    var stats = [
      ['24', 'Workflows'], ['8', 'Agentes agendados'],
      ['3', 'Jurisdições'], ['MCP', 'Conectores legais'],
    ].map(function (s) {
      return '<div class="cr-stat"><div class="cr-stat-num">' + s[0] + '</div>' +
        '<div class="cr-stat-label">' + s[1] + '</div></div>';
    }).join('');

    return '<div class="cr-hero">' +
      '<span class="cr-hero-logo">' + CUBE_SVG + '</span>' +
      '<h1 class="cr-hero-title">Craudio</h1>' +
      '<p class="cr-hero-tag">Litígio civil estratégico entre Brasil, Chile e o direito internacional de tratados — orientado a workflows.</p>' +
      '</div>' +
      '<div class="cr-block">' +
      '<h3 class="cr-h3">O que é</h3>' +
      '<p class="cr-p">O Craudio é um plugin de litígio multijurisdicional. Ele transforma o trabalho do caso em workflows estruturados e auditáveis: cada análise consome fatos do caso e conhecimento jurídico carregado de <em>packs</em>, e emite minutas com proveniência de fonte. Nada é afirmado como conclusão — tudo é minuta para revisão do advogado.</p>' +
      '</div>' +
      '<div class="cr-block">' +
      '<h3 class="cr-h3">O pipeline central</h3>' +
      '<p class="cr-p">Toda violação candidata percorre o mesmo caminho probabilístico, da prova bruta ao precedente que a sustenta:</p>' +
      '<div class="cr-pipeline">' + pipeline + '</div>' +
      '</div>' +
      '<div class="cr-stats">' + stats + '</div>' +
      '<div class="cr-guard"><i class="fas fa-scale-balanced"></i> ' +
      'Toda saída do Craudio é uma minuta para revisão do advogado — não é aconselhamento jurídico nem conclusão. O advogado revisa, verifica e assume a responsabilidade profissional.' +
      '</div>' +
      '<div class="cr-cta">' +
      '<button class="btn btn-primary" onclick="craudioSwitchPanel(\'workflows\')">' +
      '<i class="fas fa-diagram-project"></i> Explorar workflows</button>' +
      '<button class="btn" onclick="craudioSwitchPanel(\'chat\')">' +
      '<i class="fas fa-comments"></i> Abrir o chat</button>' +
      '</div>';
  }

  function cardHtml(kind, item, badge) {
    return '<div class="cr-card" onclick="craudioOpenDetail(\'' + kind + '\',\'' + item.name + '\')">' +
      '<div class="cr-card-head">' +
      '<span class="cr-card-title">' + esc(item.title) + '</span>' +
      '<span class="cr-card-badge">' + esc(badge) + '</span>' +
      '</div>' +
      '<p class="cr-card-desc">' + esc(item.desc) + '</p>' +
      '<span class="cr-card-name">' +
      (kind === 'skill' ? '/craudio:' + esc(item.name) : esc(item.name)) +
      '</span></div>';
  }

  function workflowsHtml() {
    var html = '<p class="cr-lead">24 workflows de litígio acionáveis por um comando. ' +
      'Clique em um para ver o detalhe e executá-lo no chat.</p>';
    CR_GROUPS.forEach(function (g) {
      var items = CR_WORKFLOWS.filter(function (w) { return w.group === g.id; });
      if (!items.length) return;
      html += '<div class="cr-section-label">' + esc(g.label) +
        ' <span class="cr-section-count">' + items.length + '</span></div>';
      html += '<div class="cr-grid">' +
        items.map(function (w) { return cardHtml('skill', w, g.label); }).join('') +
        '</div>';
    });
    return html;
  }

  function agentsHtml() {
    return '<p class="cr-lead">8 agentes agendados — vigilância contínua do caso: ' +
      'autos, prazos, integridade de provas, jurisprudência e mídia.</p>' +
      '<div class="cr-grid">' +
      CR_AGENTS.map(function (a) { return cardHtml('agent', a, a.cadence); }).join('') +
      '</div>';
  }

  function chatHtml() {
    return '<div class="cr-chat">' +
      '<div class="cr-chat-bar">' +
      '<span class="cr-chat-bar-label"><i class="fas fa-cube"></i> Chat Craudio</span>' +
      '<button class="btn btn-sm" onclick="craudioNewChat()" title="Nova conversa">' +
      '<i class="fas fa-plus"></i> Nova conversa</button>' +
      '</div>' +
      '<div id="crChatLog" class="cr-chat-log"></div>' +
      '<div class="cr-chat-compose">' +
      '<textarea id="crChatInput" class="cr-chat-input" rows="1" ' +
      'placeholder="Pergunte ao Craudio ou execute um workflow…" ' +
      'onkeydown="if(event.key===\'Enter\'&&!event.shiftKey){event.preventDefault();craudioSend();}"></textarea>' +
      '<button class="cr-chat-send" id="crChatSend" onclick="craudioSend()" title="Enviar">' +
      '<i class="fas fa-arrow-up"></i></button>' +
      '</div>' +
      '</div>';
  }

  // ── Sub-tabs ─────────────────────────────────────────────────────────────
  window.craudioSwitchPanel = function (name) {
    crActivePanel = name;
    ['overview', 'workflows', 'agents', 'chat'].forEach(function (p) {
      var panel = document.getElementById('crPanel-' + p);
      if (panel) panel.classList.toggle('active', p === name);
    });
    var tabs = document.querySelectorAll('#craudioView .cr-tab');
    tabs.forEach(function (t) {
      t.classList.toggle('active', t.getAttribute('data-panel') === name);
    });
    if (name === 'chat') {
      var input = document.getElementById('crChatInput');
      if (input) setTimeout(function () { input.focus(); }, 30);
    }
  };

  // ── Detalhe ──────────────────────────────────────────────────────────────
  window.craudioOpenDetail = function (kind, name) {
    var list = kind === 'skill' ? CR_WORKFLOWS : CR_AGENTS;
    var item = list.filter(function (x) { return x.name === name; })[0];
    if (!item) return;

    var isSkill = kind === 'skill';
    var badge = isSkill
      ? (CR_GROUPS.filter(function (g) { return g.id === item.group; })[0] || {}).label
      : 'Agente · ' + item.cadence;
    var command = isSkill ? '/craudio:' + item.name : 'Rode o agente ' + item.name + ' agora.';

    var card = document.getElementById('crDetailCard');
    card.innerHTML =
      '<div class="cr-detail-head">' +
      '<div>' +
      '<div class="cr-detail-kicker">' + esc(badge || '') + '</div>' +
      '<h2 class="cr-detail-title">' + esc(item.title) + '</h2>' +
      '</div>' +
      '<button class="btn btn-sm" onclick="craudioCloseDetail()"><i class="fas fa-times"></i></button>' +
      '</div>' +
      '<p class="cr-detail-desc">' + esc(item.desc) + '</p>' +
      (isSkill
        ? '<div class="cr-detail-meta"><span class="cr-detail-meta-label">Posição no pipeline</span>' +
        '<div class="cr-pipeline cr-pipeline-sm">' +
        CR_PIPELINE.map(function (s, i) {
          return '<span class="cr-pipe-step">' + esc(s) + '</span>' +
            (i < CR_PIPELINE.length - 1 ? '<i class="fas fa-arrow-right cr-pipe-arrow"></i>' : '');
        }).join('') + '</div></div>'
        : '<div class="cr-detail-meta"><span class="cr-detail-meta-label">Cadência</span>' +
        '<span class="cr-detail-cadence">' + esc(item.cadence) + '</span></div>') +
      '<div class="cr-detail-cmd"><span class="cr-detail-meta-label">Comando</span>' +
      '<code>' + esc(command) + '</code></div>' +
      '<button class="btn btn-primary cr-detail-run" ' +
      'onclick="craudioRun(' + JSON.stringify(command).replace(/"/g, '&quot;') + ')">' +
      '<i class="fas fa-play"></i> Executar no chat</button>';

    document.getElementById('crDetail').classList.add('open');
  };

  window.craudioCloseDetail = function () {
    var d = document.getElementById('crDetail');
    if (d) d.classList.remove('open');
  };

  window.craudioRun = function (command) {
    window.craudioCloseDetail();
    window.craudioSwitchPanel('chat');
    var input = document.getElementById('crChatInput');
    if (input) input.value = command;
    setTimeout(function () { window.craudioSend(); }, 60);
  };

  // ── Chat ─────────────────────────────────────────────────────────────────
  function loadHistory() {
    try {
      var raw = localStorage.getItem(CR_STORAGE_KEY);
      var saved = raw ? JSON.parse(raw) : null;
      if (Array.isArray(saved)) crHistory = saved;
    } catch (_e) { crHistory = []; }
  }
  function saveHistory() {
    try { localStorage.setItem(CR_STORAGE_KEY, JSON.stringify(crHistory)); } catch (_e) { }
  }

  function renderChatLog() {
    var log = document.getElementById('crChatLog');
    if (!log) return;
    if (!crHistory.length) {
      log.innerHTML =
        '<div class="cr-chat-empty">' + CUBE_SVG +
        '<p>Pergunte sobre o caso ou execute um workflow.<br>' +
        'Abra <strong>Workflows</strong> ou <strong>Agentes</strong> e clique em <em>Executar no chat</em>.</p></div>';
      return;
    }
    log.innerHTML = '';
    crHistory.forEach(function (m) { log.appendChild(bubble(m.role, m.text)); });
    log.scrollTop = log.scrollHeight;
  }

  function bubble(role, text) {
    var div = document.createElement('div');
    div.className = 'cr-msg cr-msg-' + (role === 'user' ? 'user' : 'agent');
    if (role === 'user') {
      div.innerHTML = '<div class="cr-msg-body">' + esc(text) + '</div>';
    } else {
      div.innerHTML = '<div class="cr-msg-tag">CRAUDIO</div>' +
        '<div class="cr-msg-body cr-md">' + renderMd(text) + '</div>';
    }
    return div;
  }

  window.craudioNewChat = function () {
    if (crStreaming) return;
    crHistory = [];
    crSessionId = null;
    crPrimerSent = false;
    saveHistory();
    renderChatLog();
  };

  window.craudioSend = function () {
    if (crStreaming) return;
    var input = document.getElementById('crChatInput');
    var log = document.getElementById('crChatLog');
    if (!input || !log) return;
    var message = (input.value || '').trim();
    if (!message) return;

    input.value = '';
    if (!crHistory.length) log.innerHTML = '';
    crHistory.push({ role: 'user', text: message });
    log.appendChild(bubble('user', message));
    saveHistory();

    crStreaming = true;
    setSendEnabled(false);
    var proc = createProcessingIndicator(log);
    streamReply(message, log, proc);
  };

  function setSendEnabled(on) {
    var btn = document.getElementById('crChatSend');
    var input = document.getElementById('crChatInput');
    if (btn) { btn.disabled = !on; btn.classList.toggle('cr-busy', !on); }
    if (input) input.disabled = !on;
  }

  function createProcessingIndicator(log) {
    var phases = ['Analisando o pedido', 'Consultando documentação',
      'Conectando evidências', 'Cruzando normas e jurisprudência', 'Estruturando resposta'];
    var el = document.createElement('div');
    el.className = 'cr-proc';
    el.innerHTML = '<span class="cr-proc-spin"></span><span class="cr-proc-text">' +
      phases[0] + '</span>';
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    var i = 0;
    var timer = setInterval(function () {
      i++;
      var t = el.querySelector('.cr-proc-text');
      if (t) t.textContent = phases[i % phases.length];
    }, 3200);
    return {
      setPhase: function (txt) {
        var t = el.querySelector('.cr-proc-text');
        if (t && txt && txt.length > 3) t.textContent = String(txt).slice(0, 60);
      },
      done: function () { clearInterval(timer); if (el.parentNode) el.parentNode.removeChild(el); },
    };
  }

  function streamReply(message, log, proc) {
    var streamEl = null, streamed = '', streamErr = '';
    function ensureBubble() {
      if (!streamEl) {
        streamEl = bubble('agent', '');
        log.appendChild(streamEl);
      }
      return streamEl.querySelector('.cr-msg-body');
    }

    var history = crHistory.filter(function (m) { return m && m.text; })
      .slice(-20).map(function (m) {
        return { role: m.role === 'agent' ? 'assistant' : 'user', content: m.text };
      });
    var messageForBackend = crPrimerSent ? message : (CR_PRIMER + '\n' + message);
    crPrimerSent = true;

    var payload = {
      message: messageForBackend,
      history: history.slice(0, -1),
      session_id: crSessionId || null,
      section_key: 'craudio',
    };

    fetch(apiBase() + '/api/assistant/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(function (res) {
      if (!res.ok || !res.body || !res.body.getReader) {
        throw new Error('Falha ao conectar ao backend (' + res.status + ').');
      }
      var reader = res.body.getReader();
      var decoder = new TextDecoder('utf-8');
      var buffer = '';

      function pump() {
        return reader.read().then(function (r) {
          if (r.done) return finish();
          buffer += decoder.decode(r.value, { stream: true });
          var lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (var k = 0; k < lines.length; k++) {
            var line = lines[k].trim();
            if (line.indexOf('data:') !== 0) continue;
            var json = line.slice(5).trim();
            if (!json || json === '[DONE]') continue;
            var evt;
            try { evt = JSON.parse(json); } catch (_e) { continue; }

            if (evt.type === 'token' && typeof evt.content === 'string') {
              proc.done();
              streamed += evt.content;
              ensureBubble().innerHTML = renderMd(streamed);
              log.scrollTop = log.scrollHeight;
            } else if (evt.type === 'status' || evt.type === 'agent_status') {
              proc.setPhase(evt.message || '');
            } else if (evt.type === 'session_id' && evt.session_id) {
              crSessionId = evt.session_id;
            } else if (evt.type === 'error' || evt.event === 'error') {
              streamErr = String(evt.message || 'Erro no stream.');
            }
          }
          return pump();
        });
      }

      function finish() {
        proc.done();
        if (streamErr) {
          if (streamEl && streamEl.parentNode) streamEl.parentNode.removeChild(streamEl);
          log.appendChild(errorEl(streamErr));
        } else {
          var text = streamed || 'Sem resposta.';
          if (!streamEl) { streamEl = bubble('agent', ''); log.appendChild(streamEl); }
          streamEl.querySelector('.cr-msg-body').innerHTML = renderMd(text);
          crHistory.push({ role: 'agent', text: text });
          saveHistory();
        }
        log.scrollTop = log.scrollHeight;
        crStreaming = false;
        setSendEnabled(true);
      }

      return pump();
    }).catch(function (err) {
      proc.done();
      log.appendChild(errorEl(err && err.message ? err.message : String(err)));
      log.scrollTop = log.scrollHeight;
      crStreaming = false;
      setSendEnabled(true);
    });
  }

  function errorEl(msg) {
    var el = document.createElement('div');
    el.className = 'cr-chat-error';
    el.innerHTML = '<i class="fas fa-triangle-exclamation"></i> ' + esc(msg);
    return el;
  }

  // ── Lifecycle: show / hide a view (espelha o padrão violations.js) ───────
  var CR_SIBLING_HIDE = ['violationsHideView', 'lawLibHideView', 'masterIndexHideView',
    'legalRouterHideView', 'spacesHideView', 'listeningHideView', 'studioHideView',
    'descobertaHideView', 'memoryHideView', 'shadersHideView', 'architectureHideView'];
  var CR_CHAT_IDS = ['chatHeader', 'welcomeState', 'chatLog', 'chatCompose', 'chatToolbar'];

  window.craudioShowView = function () {
    build();
    CR_CHAT_IDS.forEach(function (id) {
      var el = document.getElementById(id); if (el) el.style.display = 'none';
    });
    var mc = document.querySelector('.main-content');
    if (mc) { mc._crDisplay = mc.style.display; mc.style.display = 'none'; }
    if (typeof window.aexHideMain === 'function') { try { window.aexHideMain(); } catch (_e) { } }
    CR_SIBLING_HIDE.forEach(function (fn) {
      try { if (typeof window[fn] === 'function') window[fn](); } catch (_e) { }
    });
    var v = document.getElementById('craudioView');
    if (v) v.classList.add('active');
    var ws = document.querySelector('.workspace');
    if (ws) ws.classList.add('cr-open');
  };

  window.craudioHideView = function () {
    var v = document.getElementById('craudioView');
    if (v) v.classList.remove('active');
    var ws = document.querySelector('.workspace');
    if (ws) ws.classList.remove('cr-open');
    var mc = document.querySelector('.main-content');
    if (mc) { mc.style.display = mc._crDisplay !== undefined ? mc._crDisplay : ''; delete mc._crDisplay; }
    CR_CHAT_IDS.forEach(function (id) {
      var el = document.getElementById(id); if (el) el.style.display = '';
    });
  };

  // Garante que abrir qualquer outra view feche a do Craudio (os módulos
  // existentes não conhecem craudioHideView, então embrulhamos os ShowView).
  function wrapSiblings() {
    var names = ['violationsShowView', 'lawLibShowView', 'masterIndexShowView',
      'legalRouterShowView', 'spacesShowView', 'listeningShowView', 'studioShowView',
      'descobertaShowView', 'memoryShowView', 'shadersShowView', 'architectureShowView',
      'resetToWelcome', 'aexToggleMain'];
    names.forEach(function (n) {
      var orig = window[n];
      if (typeof orig !== 'function' || orig._crWrapped) return;
      var wrapped = function () {
        try { window.craudioHideView(); } catch (_e) { }
        return orig.apply(this, arguments);
      };
      wrapped._crWrapped = true;
      window[n] = wrapped;
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wrapSiblings);
  } else {
    wrapSiblings();
  }
})();
