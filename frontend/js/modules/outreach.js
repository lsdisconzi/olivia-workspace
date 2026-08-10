/* ============================================================================
   Olivia Outreach Concierge — workspace section for outreach intelligence.
   Provides pipeline overview, stage cards, leads list, and a dedicated chat
   that talks to the backend /api/assistant/chat (SSE). No server changes needed.
   ============================================================================ */
(function () {
    'use strict';

    // ── Pipeline stages ──────────────────────────────────────────────────────
    var ORCH_STAGES = [
        {
            id: 'source-capture',
            group: 'foundation',
            title: 'Source Capture',
            desc: 'Create a reliable starting context from the information supplied by the user — LinkedIn, website, notes, etc. Preserves distinction between direct extraction, user supply, and later discovery.'
        },
        {
            id: 'discovery-enrichment',
            group: 'research',
            title: 'Discovery & Enrichment',
            desc: 'Expand the initial context using reliable public sources — professional biographies, publications, talks, awards, frameworks. Every factual claim must have provenance and confidence level.'
        },
        {
            id: 'profile-synthesis',
            group: 'synthesis',
            title: 'Profile Synthesis',
            desc: 'Create a structured Lead Profile covering professional identity, career, expertise, recurring themes, vocabulary, values (where supported), current context, and open questions.'
        },
        {
            id: 'context-hypothesis',
            group: 'analysis',
            title: 'Context & Hypothesis Analysis',
            desc: 'Distinguish FACTS, INFERENCES, and HYPOTHESES. Never present a hypothesis as a fact. Avoid pain-point language unless explicitly confirmed.'
        },
        {
            id: 'alignment-qualification',
            group: 'evaluation',
            title: 'Alignment & Qualification',
            desc: 'Compare the lead’s world with Olivia’s capabilities and principles. The system may conclude insufficient alignment — that is a successful pipeline outcome.'
        },
        {
            id: 'bridge-creation',
            group: 'creation',
            title: 'Bridge Creation',
            desc: 'Create an intellectual and professional bridge that starts from the lead’s world, uses their vocabulary, and explains Olivia only where relevant. No generic marketing language.'
        },
        {
            id: 'ready-pack',
            group: 'creation',
            title: 'Ready-Pack Assembly',
            desc: 'Optionally generate a contextualised package: Lead Profile, Bridge Document, HTML experience, PDF, outreach draft. Choose the lightest artifact that creates value.'
        },
        {
            id: 'human-outreach',
            group: 'action',
            title: 'Human Outreach',
            desc: 'Prepare recommended channel, message, context, reason for outreach, and optional resource link. Human decides whether and when to send. No autonomous sending.'
        }
    ];

    var ORCH_PIPELINE = ORCH_STAGES.map(function (s) { return s.title; });

    // ── Group labels for the pipeline panel ──────────────────────────────────
    var ORCH_GROUPS = [
        { id: 'foundation', label: 'Foundation' },
        { id: 'research', label: 'Research' },
        { id: 'synthesis', label: 'Synthesis' },
        { id: 'analysis', label: 'Analysis & Evaluation' },
        { id: 'evaluation', label: 'Alignment' },
        { id: 'creation', label: 'Creation' },
        { id: 'action', label: 'Action' }
    ];

    // ── SVG logo (same amber cube, can be replaced) ──────────────────────────
    var ORCH_LOGO_SVG =
        '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">' +
        '<g stroke="currentColor" stroke-width="3.5" stroke-linejoin="round">' +
        '<path fill="currentColor" fill-opacity="0.95" d="M50 18 L80 35 L50 52 L20 35 Z"/>' +
        '<path fill="currentColor" fill-opacity="0.52" d="M20 35 L50 52 L50 86 L20 69 Z"/>' +
        '<path fill="currentColor" fill-opacity="0.28" d="M80 35 L80 69 L50 86 L50 52 Z"/>' +
        '</g></svg>';

    // ── State ───────────────────────────────────────────────────────────────
    var orchBuilt = false;
    var orchActivePanel = 'overview';
    var orchChatHistory = [];
    var orchSessionId = null;
    var orchPrimerSent = false;
    var orchStreaming = false;
    var ORCH_STORAGE_KEY = 'Olivia_outreach_chat_v1';

    // ── System prompt primer ─────────────────────────────────────────────────
    var ORCH_PRIMER = [
        'You are Olivia Outreach Concierge, a specialist agent responsible for researching, understanding, qualifying and preparing deeply contextualised professional outreach.',
        'Your purpose is to help a human understand another person or organisation well enough to determine whether a meaningful relationship or conversation may exist.',
        'Core principles: Research before messaging. Understanding before personalisation. Alignment before outreach. Evidence before inference. Human judgement before delivery.',
        'Never confuse FACT, INFERENCE, and HYPOTHESIS. Always preserve source provenance.',
        'You may run pipeline stages interactively: Source Capture, Discovery & Enrichment, Profile Synthesis, Context & Hypothesis Analysis, Alignment & Qualification, Bridge Creation, Ready-Pack Assembly, and Human Outreach.',
        'Do not autonomously send external communications. The human operator retains final authority.',
        '— User message —'
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

    // ── Build the view ───────────────────────────────────────────────────────
    function build() {
        var view = document.getElementById('outreachView');
        if (!view || orchBuilt) return;

        view.innerHTML =
            '<div class="orch-head">' +
            '<div class="orch-head-brand">' +
            '<span class="orch-logo">' + ORCH_LOGO_SVG + '</span>' +
            '<span class="orch-title">Outreach Concierge</span>' +
            '<span class="orch-sub">Pipeline de inteligência relacional</span>' +
            '</div>' +
            '<button class="btn btn-sm" onclick="outreachHideView()" title="Fechar">' +
            '<i class="fas fa-times"></i></button>' +
            '</div>' +
            '<div class="orch-subnav">' +
            '<button class="orch-tab active" data-panel="overview"  onclick="outreachSwitchPanel(\'overview\')">Visão Geral</button>' +
            '<button class="orch-tab"        data-panel="pipeline" onclick="outreachSwitchPanel(\'pipeline\')">Pipeline</button>' +
            '<button class="orch-tab"        data-panel="leads"    onclick="outreachSwitchPanel(\'leads\')">Leads</button>' +
            '<button class="orch-tab"        data-panel="chat"     onclick="outreachSwitchPanel(\'chat\')">Chat</button>' +
            '</div>' +
            '<div class="orch-panels">' +
            '<div id="orchPanel-overview"  class="orch-panel active">' + overviewHtml() + '</div>' +
            '<div id="orchPanel-pipeline"  class="orch-panel">' + pipelineHtml() + '</div>' +
            '<div id="orchPanel-leads"     class="orch-panel">' + leadsHtml() + '</div>' +
            '<div id="orchPanel-chat"      class="orch-panel">' + chatHtml() + '</div>' +
            '</div>' +
            '<div id="orchDetail" class="orch-detail">' +
            '<div class="orch-detail-backdrop" onclick="outreachCloseDetail()"></div>' +
            '<div class="orch-detail-card" id="orchDetailCard"></div>' +
            '</div>';

        orchBuilt = true;
        loadChatHistory();
        renderChatLog();
    }

    // ── Panel content generators ─────────────────────────────────────────────
    function overviewHtml() {
        var pipelineSteps = ORCH_PIPELINE.map(function (s, i) {
            return '<span class="orch-pipe-step">' + esc(s) + '</span>' +
                (i < ORCH_PIPELINE.length - 1 ? '<i class="fas fa-arrow-right orch-pipe-arrow"></i>' : '');
        }).join('');

        var stats = [
            ['8', 'Estágios'], ['3', 'Checkpoints'],
            ['Evidência', 'Sempre'], ['30 min', 'Alvo humano']
        ].map(function (s) {
            return '<div class="orch-stat"><div class="orch-stat-num">' + s[0] + '</div>' +
                '<div class="orch-stat-label">' + s[1] + '</div></div>';
        }).join('');

        return '<div class="orch-hero">' +
            '<span class="orch-hero-logo">' + ORCH_LOGO_SVG + '</span>' +
            '<h1 class="orch-hero-title">Outreach Concierge</h1>' +
            '<p class="orch-hero-tag">Pesquisa → evidência → entendimento → ponte. Relacionamentos relevantes, não templates genéricos.</p>' +
            '</div>' +
            '<div class="orch-block">' +
            '<h3 class="orch-h3">O que é</h3>' +
            '<p class="orch-p">O Outreach Concierge é um pipeline de inteligência relacional que prepara introduções profundamente contextualizadas entre Olivia e uma pessoa ou organização. Ele <em>não começa gerando uma mensagem</em> — começa perguntando <em>“quem é essa pessoa, e há um motivo legítimo para Olivia entrar no mundo dela?”</em></p>' +
            '</div>' +
            '<div class="orch-block">' +
            '<h3 class="orch-h3">O pipeline</h3>' +
            '<p class="orch-p">Todos os leads percorrem o mesmo caminho rigoroso:</p>' +
            '<div class="orch-pipeline">' + pipelineSteps + '</div>' +
            '</div>' +
            '<div class="orch-stats">' + stats + '</div>' +
            '<div class="orch-guard"><i class="fas fa-shield-haltered"></i> ' +
            'Nenhuma comunicação externa é enviada sem aprovação humana. O pipeline pode concluir que não deve haver outreach — isso é um sucesso.' +
            '</div>' +
            '<div class="orch-cta">' +
            '<button class="btn btn-primary" onclick="outreachSwitchPanel(\'pipeline\')">' +
            '<i class="fas fa-diagram-project"></i> Ver estágios</button>' +
            '<button class="btn" onclick="outreachSwitchPanel(\'chat\')">' +
            '<i class="fas fa-comments"></i> Iniciar no chat</button>' +
            '</div>';
    }

    function cardHtml(kind, item, badge) {
        return '<div class="orch-card" onclick="outreachOpenDetail(\'' + kind + '\',\'' + item.id + '\')">' +
            '<div class="orch-card-head">' +
            '<span class="orch-card-title">' + esc(item.title) + '</span>' +
            '<span class="orch-card-badge">' + esc(badge) + '</span>' +
            '</div>' +
            '<p class="orch-card-desc">' + esc(item.desc) + '</p>' +
            '<span class="orch-card-name">/outreach:' + esc(item.id) + '</span></div>';
    }

    function pipelineHtml() {
        var html = '<p class="orch-lead">Oito estágios estruturados que transformam informação pública fragmentada em entendimento relacional. Clique em um estágio para ver o detalhe e executá-lo no chat.</p>';
        ORCH_GROUPS.forEach(function (g) {
            var items = ORCH_STAGES.filter(function (s) { return s.group === g.id; });
            if (!items.length) return;
            html += '<div class="orch-section-label">' + esc(g.label) +
                ' <span class="orch-section-count">' + items.length + '</span></div>';
            html += '<div class="orch-grid">' +
                items.map(function (s) { return cardHtml('stage', s, g.label); }).join('') +
                '</div>';
        });
        return html;
    }

    function leadsHtml() {
        return '<div style="padding: 28px 24px 48px; max-width: 880px; margin: 0 auto;">' +
            '<h3 class="orch-h3">Leads</h3>' +
            '<p class="orch-p">Nenhum lead ainda. Inicie um novo caso pelo chat usando o comando <code>/outreach:source-capture</code> e fornecendo uma URL ou nota.</p>' +
            '<div style="margin-top:18px;">' +
            '<button class="btn btn-primary" onclick="outreachSwitchPanel(\'chat\')">' +
            '<i class="fas fa-plus"></i> Novo lead</button>' +
            '</div></div>';
    }

    function chatHtml() {
        return '<div class="orch-chat">' +
            '<div class="orch-chat-bar">' +
            '<span class="orch-chat-bar-label"><i class="fas fa-cube"></i> Chat Outreach</span>' +
            '<button class="btn btn-sm" onclick="outreachNewChat()" title="Nova conversa">' +
            '<i class="fas fa-plus"></i> Nova conversa</button>' +
            '</div>' +
            '<div id="orchChatLog" class="orch-chat-log"></div>' +
            '<div class="orch-chat-compose">' +
            '<textarea id="orchChatInput" class="orch-chat-input" rows="1" ' +
            'placeholder="Pesquisar um lead, executar um estágio ou pedir uma análise…" ' +
            'onkeydown="if(event.key===\'Enter\'&&!event.shiftKey){event.preventDefault();outreachSend();}"></textarea>' +
            '<button class="orch-chat-send" id="orchChatSend" onclick="outreachSend()" title="Enviar">' +
            '<i class="fas fa-arrow-up"></i></button>' +
            '</div>' +
            '</div>';
    }

    // ── Panel switching ──────────────────────────────────────────────────────
    window.outreachSwitchPanel = function (name) {
        orchActivePanel = name;
        ['overview', 'pipeline', 'leads', 'chat'].forEach(function (p) {
            var panel = document.getElementById('orchPanel-' + p);
            if (panel) panel.classList.toggle('active', p === name);
        });
        var tabs = document.querySelectorAll('#outreachView .orch-tab');
        tabs.forEach(function (t) {
            t.classList.toggle('active', t.getAttribute('data-panel') === name);
        });
        if (name === 'chat') {
            var input = document.getElementById('orchChatInput');
            if (input) setTimeout(function () { input.focus(); }, 30);
        }
    };

    // ── Detail overlay ───────────────────────────────────────────────────────
    window.outreachOpenDetail = function (kind, id) {
        var item;
        if (kind === 'stage') {
            item = ORCH_STAGES.filter(function (s) { return s.id === id; })[0];
        }
        // Could also handle leads in the future
        if (!item) return;

        var badge = (ORCH_GROUPS.filter(function (g) { return g.id === item.group; })[0] || {}).label || '';
        var command = '/outreach:' + item.id;

        var card = document.getElementById('orchDetailCard');
        card.innerHTML =
            '<div class="orch-detail-head">' +
            '<div>' +
            '<div class="orch-detail-kicker">' + esc(badge) + '</div>' +
            '<h2 class="orch-detail-title">' + esc(item.title) + '</h2>' +
            '</div>' +
            '<button class="btn btn-sm" onclick="outreachCloseDetail()"><i class="fas fa-times"></i></button>' +
            '</div>' +
            '<p class="orch-detail-desc">' + esc(item.desc) + '</p>' +
            '<div class="orch-detail-meta">' +
            '<span class="orch-detail-meta-label">Posição no pipeline</span>' +
            '<div class="orch-pipeline">' +
            ORCH_PIPELINE.map(function (s, i) {
                return '<span class="orch-pipe-step">' + esc(s) + '</span>' +
                    (i < ORCH_PIPELINE.length - 1 ? '<i class="fas fa-arrow-right orch-pipe-arrow"></i>' : '');
            }).join('') +
            '</div></div>' +
            '<div class="orch-detail-cmd"><span class="orch-detail-meta-label">Comando</span>' +
            '<code>' + esc(command) + '</code></div>' +
            '<button class="btn btn-primary orch-detail-run" ' +
            'onclick="outreachRun(' + JSON.stringify(command).replace(/"/g, '&quot;') + ')">' +
            '<i class="fas fa-play"></i> Executar no chat</button>';

        document.getElementById('orchDetail').classList.add('open');
    };

    window.outreachCloseDetail = function () {
        var d = document.getElementById('orchDetail');
        if (d) d.classList.remove('open');
    };

    window.outreachRun = function (command) {
        window.outreachCloseDetail();
        window.outreachSwitchPanel('chat');
        var input = document.getElementById('orchChatInput');
        if (input) input.value = command;
        setTimeout(function () { window.outreachSend(); }, 60);
    };

    // ── Chat ─────────────────────────────────────────────────────────────────
    function loadChatHistory() {
        try {
            var raw = localStorage.getItem(ORCH_STORAGE_KEY);
            var saved = raw ? JSON.parse(raw) : null;
            if (Array.isArray(saved)) orchChatHistory = saved;
        } catch (_e) { orchChatHistory = []; }
    }
    function saveChatHistory() {
        try { localStorage.setItem(ORCH_STORAGE_KEY, JSON.stringify(orchChatHistory)); } catch (_e) { }
    }

    function renderChatLog() {
        var log = document.getElementById('orchChatLog');
        if (!log) return;
        if (!orchChatHistory.length) {
            log.innerHTML =
                '<div class="orch-chat-empty">' + ORCH_LOGO_SVG +
                '<p>Inicie uma pesquisa ou execute um estágio do pipeline.<br>' +
                'Use comandos como <code>/outreach:source-capture</code> ou cole uma URL.</p></div>';
            return;
        }
        log.innerHTML = '';
        orchChatHistory.forEach(function (m) { log.appendChild(bubble(m.role, m.text)); });
        log.scrollTop = log.scrollHeight;
    }

    function bubble(role, text) {
        var div = document.createElement('div');
        div.className = 'orch-msg orch-msg-' + (role === 'user' ? 'user' : 'agent');
        if (role === 'user') {
            div.innerHTML = '<div class="orch-msg-body">' + esc(text) + '</div>';
        } else {
            div.innerHTML = '<div class="orch-msg-tag">OUTREACH CONCIERGE</div>' +
                '<div class="orch-msg-body orch-md">' + renderMd(text) + '</div>';
        }
        return div;
    }

    window.outreachNewChat = function () {
        if (orchStreaming) return;
        orchChatHistory = [];
        orchSessionId = null;
        orchPrimerSent = false;
        saveChatHistory();
        renderChatLog();
    };

    window.outreachSend = function () {
        if (orchStreaming) return;
        var input = document.getElementById('orchChatInput');
        var log = document.getElementById('orchChatLog');
        if (!input || !log) return;
        var message = (input.value || '').trim();
        if (!message) return;

        input.value = '';
        if (!orchChatHistory.length) log.innerHTML = '';
        orchChatHistory.push({ role: 'user', text: message });
        log.appendChild(bubble('user', message));
        saveChatHistory();

        orchStreaming = true;
        setSendEnabled(false);
        var proc = createProcessingIndicator(log);
        streamReply(message, log, proc);
    };

    function setSendEnabled(on) {
        var btn = document.getElementById('orchChatSend');
        var input = document.getElementById('orchChatInput');
        if (btn) { btn.disabled = !on; btn.classList.toggle('orch-busy', !on); }
        if (input) input.disabled = !on;
    }

    function createProcessingIndicator(log) {
        var phases = ['Pesquisando fontes', 'Coletando evidências', 'Sintetizando perfil',
            'Analisando contexto', 'Avaliando alinhamento', 'Preparando ponte'];
        var el = document.createElement('div');
        el.className = 'orch-proc';
        el.innerHTML = '<span class="orch-proc-spin"></span><span class="orch-proc-text">' +
            phases[0] + '</span>';
        log.appendChild(el);
        log.scrollTop = log.scrollHeight;
        var i = 0;
        var timer = setInterval(function () {
            i++;
            var t = el.querySelector('.orch-proc-text');
            if (t) t.textContent = phases[i % phases.length];
        }, 3200);
        return {
            setPhase: function (txt) {
                var t = el.querySelector('.orch-proc-text');
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
            return streamEl.querySelector('.orch-msg-body');
        }

        var history = orchChatHistory.filter(function (m) { return m && m.text; })
            .slice(-20).map(function (m) {
                return { role: m.role === 'agent' ? 'assistant' : 'user', content: m.text };
            });
        var messageForBackend = orchPrimerSent ? message : (ORCH_PRIMER + '\n' + message);
        orchPrimerSent = true;

        var payload = {
            message: messageForBackend,
            history: history.slice(0, -1),
            session_id: orchSessionId || null,
            section_key: 'outreach',
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
                            orchSessionId = evt.session_id;
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
                    streamEl.querySelector('.orch-msg-body').innerHTML = renderMd(text);
                    orchChatHistory.push({ role: 'agent', text: text });
                    saveChatHistory();
                }
                log.scrollTop = log.scrollHeight;
                orchStreaming = false;
                setSendEnabled(true);
            }

            return pump();
        }).catch(function (err) {
            proc.done();
            log.appendChild(errorEl(err && err.message ? err.message : String(err)));
            log.scrollTop = log.scrollHeight;
            orchStreaming = false;
            setSendEnabled(true);
        });
    }

    function errorEl(msg) {
        var el = document.createElement('div');
        el.className = 'orch-chat-error';
        el.innerHTML = '<i class="fas fa-triangle-exclamation"></i> ' + esc(msg);
        return el;
    }

    // ── Show / hide the section (mirrors Craudio pattern) ────────────────────
    var ORCH_SIBLING_HIDE = ['violationsHideView', 'lawLibHideView', 'masterIndexHideView',
        'legalRouterHideView', 'spacesHideView', 'listeningHideView', 'studioHideView',
        'descobertaHideView', 'memoryHideView', 'shadersHideView', 'architectureHideView',
        'socialMediaHideView', 'craudioHideView'];
    var ORCH_CHAT_IDS = ['chatHeader', 'welcomeState', 'chatLog', 'chatCompose', 'chatToolbar'];

    window.outreachShowView = function () {
        build();
        ORCH_CHAT_IDS.forEach(function (id) {
            var el = document.getElementById(id); if (el) el.style.display = 'none';
        });
        var mc = document.querySelector('.main-content');
        if (mc) { mc._orchDisplay = mc.style.display; mc.style.display = 'none'; }
        if (typeof window.aexHideMain === 'function') { try { window.aexHideMain(); } catch (_e) { } }
        ORCH_SIBLING_HIDE.forEach(function (fn) {
            try { if (typeof window[fn] === 'function') window[fn](); } catch (_e) { }
        });
        var v = document.getElementById('outreachView');
        if (v) v.classList.add('active');
        var ws = document.querySelector('.workspace');
        if (ws) ws.classList.add('orch-open');
    };

    window.outreachHideView = function () {
        var v = document.getElementById('outreachView');
        if (v) v.classList.remove('active');
        var ws = document.querySelector('.workspace');
        if (ws) ws.classList.remove('orch-open');
        var mc = document.querySelector('.main-content');
        if (mc) { mc.style.display = mc._orchDisplay !== undefined ? mc._orchDisplay : ''; delete mc._orchDisplay; }
        ORCH_CHAT_IDS.forEach(function (id) {
            var el = document.getElementById(id); if (el) el.style.display = '';
        });
    };

    // Wrap existing ShowView functions so they close Outreach when another view opens
    function wrapSiblings() {
        var names = ['violationsShowView', 'lawLibShowView', 'masterIndexShowView',
            'legalRouterShowView', 'spacesShowView', 'listeningShowView', 'studioShowView',
            'descobertaShowView', 'memoryShowView', 'shadersShowView', 'architectureShowView',
            'socialMediaShowView', 'craudioShowView', 'comfyuiShowView', 'resetToWelcome', 'aexToggleMain'];
        names.forEach(function (n) {
            var orig = window[n];
            if (typeof orig !== 'function' || orig._orchWrapped) return;
            var wrapped = function () {
                try { window.outreachHideView(); } catch (_e) { }
                return orig.apply(this, arguments);
            };
            wrapped._orchWrapped = true;
            window[n] = wrapped;
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', wrapSiblings);
    } else {
        wrapSiblings();
    }
})();