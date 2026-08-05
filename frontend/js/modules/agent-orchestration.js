/* ═══════════════════════════════════════════════════════════════════
   AGENT ORCHESTRATION MODULE
   Section-level agent assignments + secondary main chat lane
   ═══════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var STORAGE_KEY = 'olivia.section.agent.runtime.v1';
  var SECTION_PROFILES = [
    {
      key: 'main_primary',
      label: 'Main Primary',
      scope: 'Main workspace chat. Coordinate cross-section tasks and route to specialist agents.',
      keywords: ['orchestrator', 'manus', 'general', 'main', 'core'],
      capabilities: ['Cross-section planning', 'General execution', 'Tool-first actions'],
    },
    {
      key: 'main_secondary',
      label: 'Main Secondary',
      scope: 'Independent secondary main chat lane for parallel reasoning without mutating primary chat state.',
      keywords: ['orchestrator', 'general', 'analyst', 'assistant'],
      capabilities: ['Parallel analysis', 'Independent context thread', 'No conflict with primary lane'],
    },
    {
      key: 'studio',
      label: 'Studio',
      scope: 'HTML/CSS/JS studio editor, live preview, templates, components, and AI code edits.',
      keywords: ['studio', 'ui', 'frontend', 'web', 'design'],
      capabilities: ['Edit HTML/CSS/JS', 'Generate UI snippets', 'Apply scoped code changes'],
    },
    {
      key: 'shaders',
      label: 'Shaders',
      scope: 'SVG scene creation, animation tuning, and shader workspace controls.',
      keywords: ['shader', 'vfx', 'scene', 'graphics', 'render'],
      capabilities: ['Create scenes', 'Tune animation loops', 'Implement scene files via agent'],
    },
    {
      key: 'descoberta',
      label: 'Descoberta',
      scope: 'Document ingestion, NLP pipeline, intelligence views, findings, and timeline.',
      keywords: ['discovery', 'descoberta', 'intelligence', 'corpus'],
      capabilities: ['Analyze files', 'Summarize insights', 'Drive case intelligence'],
    },
    {
      key: 'listening',
      label: 'Listening',
      scope: 'Audio transcription, diarization, transcript cleanup, and AI transcript analysis.',
      keywords: ['listening', 'audio', 'transcribe', 'pinocchio', 'speech'],
      capabilities: ['Transcription workflow', 'Speaker labeling', 'Transcript analysis'],
    },
    {
      key: 'memory',
      label: 'Memory',
      scope: 'Qdrant/Neo4j memory workflows, search, ingest, and graph operations.',
      keywords: ['memory', 'qdrant', 'neo4j', 'vector', 'graph'],
      capabilities: ['Vector retrieval', 'Graph exploration', 'Memory curation'],
    },
    {
      key: 'apiexplorer',
      label: 'API Explorer',
      scope: 'Endpoint catalog, request testing, response inspection, and contract validation.',
      keywords: ['api', 'explorer', 'endpoint', 'contract'],
      capabilities: ['Endpoint testing', 'Schema checks', 'Service diagnostics'],
    },
    {
      key: 'spaces',
      label: 'Spaces',
      scope: 'Contracts and ontology exploration with document navigation.',
      keywords: ['space', 'contracts', 'ontology', 'law'],
      capabilities: ['Contract review', 'Ontology lookup', 'Context enrichment'],
    },
    {
      key: 'casebuilder',
      label: 'Case Builder',
      scope: 'Case upload intake, pipeline stages, and bridge intelligence orchestration.',
      keywords: ['case', 'bridge', 'pipeline', 'intake'],
      capabilities: ['Case intake', 'Pipeline sequencing', 'Evidence orchestration'],
    },
    {
      key: 'legalrouter',
      label: 'Legal Router',
      scope: 'LA8159 0_agents legal grounding library: violation IDs, frameworks, personnel dossiers, jurisdictional routing.',
      keywords: ['legal', 'router', 'framework', 'law', 'mapping', 'violation', 'jurisdiction', 'compliance'],
      capabilities: ['Resolve violation IDs to frameworks', 'Lookup personnel dossiers', 'Cross-framework routing', 'Inject grounded legal context'],
      preferredAgentId: '8dfa0540-effd-487b-bbc5-23c5f12f07d9',
    },
    {
      key: 'violations',
      label: 'Violações',
      scope: 'LA8159 validated violations corpus: BR/CL/INT JSON files, severity, legal_basis frameworks, narrative segments.',
      keywords: ['violation', 'la8159', 'violacao', 'severity', 'evidence', 'incident', 'specialist'],
      capabilities: ['Lookup violation by ID', 'Compare facts vs legal basis', 'Roll-up by jurisdiction/severity', 'Quote facts with citations'],
      preferredAgentId: '16b57998-84b2-450b-87dc-f892d1004de5',
    },
    {
      key: 'lawlib',
      label: 'Biblioteca Legal',
      scope: 'LA8159 statute library: BR/CL/INT framework markdown sources with verbatim article text, ELI IDs, SHA-256.',
      keywords: ['library', 'statute', 'lei', 'codigo', 'codice', 'article', 'eli', 'biblioteca', 'curator', 'law'],
      capabilities: ['Locate article by code', 'Quote verbatim with SHA-256', 'Compare frameworks', 'Browse by jurisdiction'],
      preferredAgentId: 'e3a047ed-e52f-4559-9658-d3ea483afc76',
    },
  ];

  var _runtime = {
    assignments: {},
    secondaryOpen: false,
    runtimeBarCollapsed: false,
    sectionMapCollapsed: false,
    secondaryHistory: [],
    secondaryBusy: false,
    uiMounted: false,
    suppressPrimarySync: false,
  };

  var HEADER_BADGE_TARGETS = [
    { id: 'oliviaHeaderBadgeMain', sectionKey: 'main_primary', anchor: '#chatHeader .chat-header-left' },
    { id: 'oliviaHeaderBadgeStudio', sectionKey: 'studio', anchor: '#studioView .studio-top-bar-left' },
    { id: 'oliviaHeaderBadgeShaders', sectionKey: 'shaders', anchor: '#shadersView .sh-hbar-title > div:last-child' },
    { id: 'oliviaHeaderBadgeDescoberta', sectionKey: 'descoberta', anchor: '#descobertaView .disc-hbar-copy' },
    { id: 'oliviaHeaderBadgeListening', sectionKey: 'listening', anchor: '#listeningView .ls-hbar-title > div:last-child' },
    { id: 'oliviaHeaderBadgeMemory', sectionKey: 'memory', anchor: '#memoryView #mvHeaderStatus' },
    { id: 'oliviaHeaderBadgeSpaces', sectionKey: 'spaces', anchor: '#spacesView .sp-hbar-title > div:last-child' },
    { id: 'oliviaHeaderBadgeApiMain', sectionKey: 'apiexplorer', anchor: '#aexMainView .aex-main-header' },
    { id: 'oliviaHeaderBadgeApiChat', sectionKey: 'apiexplorer', anchor: '#tab-apiexplorer .aex-chat-header' },
    { id: 'oliviaHeaderBadgeViolations', sectionKey: 'violations', anchor: '#violationsView .vw-hbar-title > div:last-child' },
    { id: 'oliviaHeaderBadgeLawLib', sectionKey: 'lawlib', anchor: '#lawLibView .vw-hbar-title > div:last-child' },
    { id: 'oliviaHeaderBadgeLegalRouter', sectionKey: 'legalrouter', anchor: '#legalRouterView .vw-hbar-title > div:last-child' }
  ];

  function _profileByKey(key) {
    return SECTION_PROFILES.find(function (p) { return p.key === key; }) || null;
  }

  function _safeAgents() {
    return Array.isArray(window.agents) ? window.agents : [];
  }

  function _agentById(agentId) {
    var id = String(agentId || '').trim();
    if (!id) return null;
    return _safeAgents().find(function (a) { return String(a.agent_id || '') === id; }) || null;
  }

  function _agentIsActive(agent) {
    if (!agent) return false;
    return String(agent.status || '').toLowerCase() === 'active';
  }

  function _scoreAgentForProfile(agent, profile) {
    if (!agent || !profile) return 0;
    var hay = [agent.name, agent.description, agent.agent_type, agent.agent_id].join(' ').toLowerCase();
    var score = _agentIsActive(agent) ? 5 : 0;
    (profile.keywords || []).forEach(function (kw) {
      if (hay.indexOf(String(kw).toLowerCase()) !== -1) score += 3;
    });
    return score;
  }

  function _bestAgentIdForProfile(profile) {
    var all = _safeAgents();
    if (!all.length || !profile) return '';
    var sorted = all.slice().sort(function (a, b) {
      return _scoreAgentForProfile(b, profile) - _scoreAgentForProfile(a, profile);
    });
    return String(sorted[0] && sorted[0].agent_id || '');
  }

  function _readRuntimeState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        _runtime.assignments = parsed.assignments && typeof parsed.assignments === 'object' ? parsed.assignments : {};
        _runtime.secondaryOpen = !!parsed.secondaryOpen;
        _runtime.runtimeBarCollapsed = !!parsed.runtimeBarCollapsed;
        _runtime.sectionMapCollapsed = !!parsed.sectionMapCollapsed;
      }
    } catch (_e) {
      _runtime.assignments = {};
      _runtime.secondaryOpen = false;
      _runtime.runtimeBarCollapsed = false;
      _runtime.sectionMapCollapsed = false;
    }
  }

  function _saveRuntimeState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        assignments: _runtime.assignments,
        secondaryOpen: _runtime.secondaryOpen,
        runtimeBarCollapsed: _runtime.runtimeBarCollapsed,
        sectionMapCollapsed: _runtime.sectionMapCollapsed,
      }));
    } catch (_e) {}
  }

  function _ensureAssignments() {
    if (!_runtime.assignments || typeof _runtime.assignments !== 'object') {
      _runtime.assignments = {};
    }

    SECTION_PROFILES.forEach(function (profile) {
      var assigned = String(_runtime.assignments[profile.key] || '');
      if (assigned && _agentById(assigned)) return;
      var preferred = String(profile.preferredAgentId || '');
      if (preferred && _agentById(preferred)) {
        _runtime.assignments[profile.key] = preferred;
        return;
      }
      _runtime.assignments[profile.key] = _bestAgentIdForProfile(profile);
    });

    if (window.selectedAgent && window.selectedAgent.agent_id) {
      _runtime.assignments.main_primary = String(window.selectedAgent.agent_id);
    }

    _saveRuntimeState();
  }

  function _buildSystemPrompt(sectionKey, agent) {
    var profile = _profileByKey(sectionKey);
    if (!profile) return '';

    var lines = [
      'You are running inside Olivia Workspace with section-scoped orchestration.',
      'Section: ' + profile.label + '.',
      'Section scope: ' + profile.scope,
      'Conflict policy: never assume shared mutable state with other active section agents.',
      'If cross-section work is required, describe handoff steps before proceeding.',
    ];

    if (agent) {
      lines.push('Assigned runtime agent: ' + (agent.name || 'agent') + ' (' + (agent.agent_id || '') + ').');
      lines.push('Agent status: ' + String(agent.status || 'unknown') + '.');
    } else {
      lines.push('No dedicated agent assignment exists for this section yet.');
    }

    if (profile.capabilities && profile.capabilities.length) {
      lines.push('Section capabilities: ' + profile.capabilities.join('; ') + '.');
    }

    return lines.join('\n');
  }

  function _agentOptionLabel(agent) {
    var name = _agentDisplayName(agent) || String(agent.agent_id || 'agent');
    var status = _agentIsActive(agent) ? 'active' : 'inactive';
    return name + ' (' + status + ')';
  }

  function _buildAgentOptions(selectedId) {
    var opts = ['<option value="">- none -</option>'];
    _safeAgents().forEach(function (agent) {
      var id = String(agent.agent_id || '');
      var selected = id === String(selectedId || '') ? ' selected' : '';
      opts.push('<option value="' + escapeHtml(id) + '"' + selected + '>' + escapeHtml(_agentOptionLabel(agent)) + '</option>');
    });
    return opts.join('');
  }

  function _ensureHeaderBadgeElement(target) {
    if (!target || !target.id || !target.anchor) return null;
    var anchor = document.querySelector(target.anchor);
    if (!anchor) return null;

    var badge = document.getElementById(target.id);
    if (!badge) {
      badge = document.createElement('span');
      badge.id = target.id;
      badge.className = 'olivia-section-header-badge is-unassigned';
      badge.innerHTML = '<span class="olivia-status-dot"></span><span class="olivia-section-header-agent">unassigned</span>';

      if (anchor.id === 'mvHeaderStatus' && anchor.parentElement) {
        anchor.insertAdjacentElement('afterend', badge);
      } else {
        anchor.appendChild(badge);
      }
    }

    return badge;
  }

  function _renderHeaderBadge(target) {
    var badge = _ensureHeaderBadgeElement(target);
    if (!badge) return;

    var ctx = oliviaResolveSectionAgentContext(target.sectionKey);
    var statusClass = ctx.active ? 'is-active' : (ctx.assigned ? 'is-inactive' : 'is-unassigned');
    badge.classList.remove('is-active', 'is-inactive', 'is-unassigned');
    badge.classList.add(statusClass);

    var agentName = 'unassigned';
    if (ctx.agent) agentName = String(ctx.agent.name || ctx.agent.agent_id || 'assigned');
    else if (ctx.assigned) agentName = String(ctx.agentId || 'assigned');

    var dotClass = ctx.active ? 'active' : (ctx.assigned ? 'inactive' : '');
    badge.innerHTML = '<span class="olivia-status-dot ' + dotClass + '"></span><span class="olivia-section-header-agent">' + escapeHtml(agentName) + '</span>';
    badge.title = (ctx.profile ? ctx.profile.label : target.sectionKey) + ': ' + agentName + ' (' + (ctx.active ? 'active' : (ctx.assigned ? 'inactive' : 'unassigned')) + ')';
  }

  function _renderSectionHeaderBadges() {
    HEADER_BADGE_TARGETS.forEach(_renderHeaderBadge);
  }

  function _t(key, def) { return (typeof window.t === 'function') ? window.t(key, def) : def; }
  function _agentDisplayName(agent) {
    if (!agent) return '';
    if (typeof window.agentT === 'function' && typeof window.agentSlug === 'function') {
      return window.agentT(window.agentSlug(agent), 'name', agent.name) || agent.name;
    }
    return agent.name;
  }

  // Update the runtime bar's static labels (called on language change so we don't
  // rebuild the bar and rebind its listeners).
  function _renderRuntimeBarLabels() {
    var titleEl = document.querySelector('#oliviaRuntimeBar .olivia-runtime-title');
    if (titleEl) {
      var label = _t('ui.orchestratorControls', 'Orchestrator Controls');
      var collapsed = !!_runtime.runtimeBarCollapsed;
      titleEl.textContent = (collapsed ? '▶ ' : '▼ ') + label;
    }
    var labels = document.querySelectorAll('#oliviaRuntimeBar .olivia-runtime-label');
    var labelKeys = ['ui.mainAgent', 'ui.secondaryAgent'];
    labels.forEach(function (el, i) {
      if (labelKeys[i]) el.textContent = _t(labelKeys[i], el.textContent);
    });
    var secBtn = document.getElementById('oliviaToggleSecondaryBtn');
    if (secBtn) secBtn.textContent = _t('ui.secondaryChat', 'Secondary chat');
  }

  function _ensureMainLaneUi() {
    var header = document.getElementById('chatHeader');
    if (!header) return;

    if (!document.getElementById('oliviaRuntimeBar')) {
      var bar = document.createElement('div');
      bar.id = 'oliviaRuntimeBar';
      bar.className = 'olivia-runtime-bar';
      bar.innerHTML = [
        '<div class="olivia-runtime-head">',
          '<div class="olivia-runtime-title" role="button" tabindex="0" aria-expanded="true" title="' + _t('ui.hide', 'Hide') + ' orchestration controls">' + _t('ui.orchestratorControls', 'Orchestrator Controls') + '</div>',
        '</div>',
        '<div id="oliviaRuntimeBody" class="olivia-runtime-body">',
        '<div class="olivia-runtime-row">',
          '<span class="olivia-runtime-label">' + _t('ui.mainAgent', 'Main agent') + '</span>',
          '<select id="oliviaMainPrimarySelect" class="olivia-runtime-select"></select>',
          '<button id="oliviaToggleSecondaryBtn" class="olivia-runtime-btn" type="button">' + _t('ui.secondaryChat', 'Secondary chat') + '</button>',
          '<span class="olivia-runtime-label">' + _t('ui.secondaryAgent', 'Secondary agent') + '</span>',
          '<select id="oliviaMainSecondarySelect" class="olivia-runtime-select"></select>',
        '</div>',
        '</div>'
      ].join('');
      header.insertAdjacentElement('afterend', bar);
    }

    if (!document.getElementById('oliviaSecondaryChat')) {
      var panel = document.createElement('div');
      panel.id = 'oliviaSecondaryChat';
      panel.className = 'olivia-secondary-chat';
      panel.innerHTML = [
        '<div class="olivia-secondary-head">',
          '<span class="olivia-secondary-title">Secondary Main Chat</span>',
          '<span id="oliviaSecondaryStatus" class="olivia-secondary-status">idle</span>',
        '</div>',
        '<div id="oliviaSecondaryLog" class="olivia-secondary-log"></div>',
        '<div class="olivia-secondary-compose">',
          '<textarea id="oliviaSecondaryInput" class="olivia-secondary-input" placeholder="Send a message to the secondary agent lane..." rows="1"></textarea>',
          '<button id="oliviaSecondarySend" class="olivia-secondary-send" type="button" title="Send"><i class="fas fa-arrow-up"></i></button>',
        '</div>'
      ].join('');

      var barEl = document.getElementById('oliviaRuntimeBar');
      if (barEl) barEl.insertAdjacentElement('afterend', panel);
    }

    var toggleBtn = document.getElementById('oliviaToggleSecondaryBtn');
    if (toggleBtn && !toggleBtn.dataset.bound) {
      toggleBtn.addEventListener('click', function () {
        _runtime.secondaryOpen = !_runtime.secondaryOpen;
        _saveRuntimeState();
        _renderSecondaryState();
      });
      toggleBtn.dataset.bound = 'true';
    }

    var runtimeTitle = document.querySelector('#oliviaRuntimeBar .olivia-runtime-title');
    if (runtimeTitle && !runtimeTitle.dataset.bound) {
      runtimeTitle.addEventListener('click', function () {
        _runtime.runtimeBarCollapsed = !_runtime.runtimeBarCollapsed;
        _saveRuntimeState();
        _renderRuntimeBarCollapsedState();
      });
      runtimeTitle.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          _runtime.runtimeBarCollapsed = !_runtime.runtimeBarCollapsed;
          _saveRuntimeState();
          _renderRuntimeBarCollapsedState();
        }
      });
      runtimeTitle.dataset.bound = 'true';
    }

    var sendBtn = document.getElementById('oliviaSecondarySend');
    if (sendBtn && !sendBtn.dataset.bound) {
      sendBtn.addEventListener('click', _sendSecondaryMessage);
      sendBtn.dataset.bound = 'true';
    }

    var input = document.getElementById('oliviaSecondaryInput');
    if (input && !input.dataset.bound) {
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          _sendSecondaryMessage();
        }
      });
      input.dataset.bound = 'true';
    }
  }

  function _ensureSectionMapUi() {
    var tab = document.getElementById('tab-agents');
    if (!tab) return;

    if (!document.getElementById('oliviaSectionAgentMap')) {
      var wrap = document.createElement('div');
      wrap.id = 'oliviaSectionAgentMap';
      wrap.className = 'olivia-section-agent-map';
      wrap.innerHTML = [
        '<div class="olivia-section-agent-head">',
          '<div class="olivia-section-agent-title">Section Agent Routing</div>',
          '<button id="oliviaSectionMapToggleBtn" class="olivia-section-agent-toggle" type="button" title="Expandir/recolher painel"><i class="fas fa-chevron-up"></i></button>',
        '</div>',
        '<div id="oliviaSectionAgentGrid" class="olivia-section-agent-grid"></div>'
      ].join('');

      var agentList = document.getElementById('agentList');
      if (agentList && agentList.parentNode === tab) {
        tab.insertBefore(wrap, agentList);
      } else {
        tab.insertAdjacentElement('afterbegin', wrap);
      }
    }

    var toggleBtn = document.getElementById('oliviaSectionMapToggleBtn');
    if (toggleBtn && !toggleBtn.dataset.bound) {
      toggleBtn.addEventListener('click', function () {
        _runtime.sectionMapCollapsed = !_runtime.sectionMapCollapsed;
        _saveRuntimeState();
        _renderSectionMapCollapsedState();
      });
      toggleBtn.dataset.bound = 'true';
    }
  }

  function _renderSectionMapCollapsedState() {
    var map = document.getElementById('oliviaSectionAgentMap');
    var grid = document.getElementById('oliviaSectionAgentGrid');
    var toggleBtn = document.getElementById('oliviaSectionMapToggleBtn');
    var collapsed = !!_runtime.sectionMapCollapsed;

    if (map) map.classList.toggle('is-collapsed', collapsed);
    if (grid) grid.classList.toggle('is-collapsed', collapsed);
    if (toggleBtn) {
      toggleBtn.innerHTML = '<i class="fas ' + (collapsed ? 'fa-chevron-down' : 'fa-chevron-up') + '"></i>';
      toggleBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    }
  }

  function _renderRuntimeBarCollapsedState() {
    var bar = document.getElementById('oliviaRuntimeBar');
    var body = document.getElementById('oliviaRuntimeBody');
    var titleEl = document.querySelector('#oliviaRuntimeBar .olivia-runtime-title');
    var collapsed = !!_runtime.runtimeBarCollapsed;

    if (bar) bar.classList.toggle('is-collapsed', collapsed);
    if (body) body.classList.toggle('is-collapsed', collapsed);
    if (titleEl) {
      var label = _t('ui.orchestratorControls', 'Orchestrator Controls');
      titleEl.textContent = (collapsed ? '▶ ' : '▼ ') + label;
      titleEl.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      titleEl.title = collapsed ? _t('ui.show', 'Show') + ' orchestration controls' : _t('ui.hide', 'Hide') + ' orchestration controls';
    }
  }

  function _renderMainSelectors() {
    var primary = document.getElementById('oliviaMainPrimarySelect');
    var secondary = document.getElementById('oliviaMainSecondarySelect');
    if (!primary || !secondary) return;

    primary.innerHTML = _buildAgentOptions(_runtime.assignments.main_primary);
    secondary.innerHTML = _buildAgentOptions(_runtime.assignments.main_secondary);

    if (!primary.dataset.bound) {
      primary.addEventListener('change', function () {
        var agentId = String(primary.value || '');
        _setAssignment('main_primary', agentId, true);
        if (agentId && typeof window.selectAgent === 'function') {
          _runtime.suppressPrimarySync = true;
          Promise.resolve(window.selectAgent(agentId)).finally(function () {
            _runtime.suppressPrimarySync = false;
          });
        }
      });
      primary.dataset.bound = 'true';
    }

    if (!secondary.dataset.bound) {
      secondary.addEventListener('change', function () {
        _setAssignment('main_secondary', String(secondary.value || ''), true);
      });
      secondary.dataset.bound = 'true';
    }
  }

  function _renderSectionGrid() {
    var grid = document.getElementById('oliviaSectionAgentGrid');
    if (!grid) return;

    var sectionKeys = SECTION_PROFILES
      .map(function (p) { return p.key; })
      .filter(function (key) { return key !== 'main_primary' && key !== 'main_secondary'; });

    grid.innerHTML = sectionKeys.map(function (sectionKey) {
      var profile = _profileByKey(sectionKey);
      var assignedId = String(_runtime.assignments[sectionKey] || '');
      var assignedAgent = _agentById(assignedId);
      var dotClass = assignedAgent ? (_agentIsActive(assignedAgent) ? 'active' : 'inactive') : '';
      return [
        '<div class="olivia-section-agent-row" data-section="' + escapeHtml(sectionKey) + '">',
          '<div class="olivia-section-agent-key" title="' + escapeHtml(profile ? profile.scope : sectionKey) + '">' + escapeHtml(profile ? profile.label : sectionKey) + '</div>',
          '<select id="oliviaSectionAgentSelect_' + escapeHtml(sectionKey) + '" name="oliviaSectionAgentSelect_' + escapeHtml(sectionKey) + '" class="olivia-section-agent-select" data-role="assign" data-section="' + escapeHtml(sectionKey) + '">',
            _buildAgentOptions(assignedId),
          '</select>',
          '<div class="olivia-section-agent-actions">',
            '<span class="olivia-status-dot ' + dotClass + '" title="' + escapeHtml(assignedAgent ? (assignedAgent.status || 'unknown') : 'unassigned') + '"></span>',
            '<button class="olivia-row-btn" data-role="activate" data-section="' + escapeHtml(sectionKey) + '">Activate</button>',
          '</div>',
        '</div>'
      ].join('');
    }).join('');

    Array.from(grid.querySelectorAll('select[data-role="assign"]')).forEach(function (selectEl) {
      selectEl.addEventListener('change', function () {
        var section = String(selectEl.getAttribute('data-section') || '');
        _setAssignment(section, String(selectEl.value || ''), true);
      });
    });

    Array.from(grid.querySelectorAll('button[data-role="activate"]')).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var section = String(btn.getAttribute('data-section') || '');
        var assignedId = String(_runtime.assignments[section] || '');
        var agent = _agentById(assignedId);
        if (!agent) {
          if (typeof window.addSystemBubble === 'function') {
            window.addSystemBubble('Assign an agent to section "' + section + '" first.');
          }
          return;
        }
        if (_agentIsActive(agent)) {
          if (typeof window.addSystemBubble === 'function') {
            window.addSystemBubble('Agent "' + (agent.name || agent.agent_id) + '" is already active.');
          }
          return;
        }
        if (typeof window.toggleAgentStatus === 'function') {
          window.toggleAgentStatus(agent.agent_id, true);
        }
      });
    });
  }

  function _renderSecondaryState() {
    var panel = document.getElementById('oliviaSecondaryChat');
    var status = document.getElementById('oliviaSecondaryStatus');
    var toggleBtn = document.getElementById('oliviaToggleSecondaryBtn');
    if (panel) panel.classList.toggle('open', !!_runtime.secondaryOpen);
    if (toggleBtn) toggleBtn.textContent = _runtime.secondaryOpen ? _t('ui.hide', 'Hide') + ' ' + _t('ui.secondaryChat', 'secondary') : _t('ui.secondaryChat', 'Secondary chat');

    var assigned = _agentById(_runtime.assignments.main_secondary);
    if (status) {
      if (!assigned) status.textContent = 'no agent assigned';
      else status.textContent = (assigned.name || assigned.agent_id) + ' · ' + String(assigned.status || 'unknown');
    }
  }

  function _appendSecondaryMessage(role, html) {
    var log = document.getElementById('oliviaSecondaryLog');
    if (!log) return null;
    var row = document.createElement('div');
    row.className = 'olivia-secondary-msg ' + role;
    row.innerHTML = html;
    log.appendChild(row);
    log.scrollTop = log.scrollHeight;
    return row;
  }

  function _secondaryHistoryForApi() {
    return _runtime.secondaryHistory
      .filter(function (m) { return m && (m.role === 'user' || m.role === 'assistant'); })
      .slice(-8)
      .map(function (m) {
        return { role: m.role, content: m.content };
      });
  }

  function _resolveMarked(content) {
    if (window.marked && typeof window.marked.parse === 'function') {
      return window.marked.parse(content);
    }
    return escapeHtml(content).replace(/\n/g, '<br>');
  }

  async function _sendSecondaryMessage() {
    if (_runtime.secondaryBusy) return;

    var input = document.getElementById('oliviaSecondaryInput');
    var text = String(input && input.value || '').trim();
    if (!text) return;

    var agent = _agentById(_runtime.assignments.main_secondary);
    if (!agent) {
      _appendSecondaryMessage('system', _t('ui.secondaryNoAgent', 'Assign an agent to Secondary chat before sending messages.'));
      return;
    }
    if (!_agentIsActive(agent)) {
      _appendSecondaryMessage('system', _t('ui.secondaryInactive', 'Assigned secondary agent is inactive. Activate it in Agents tab first.'));
      return;
    }

    if (input) input.value = '';
    _runtime.secondaryBusy = true;
    _appendSecondaryMessage('user', escapeHtml(text));

    var loader = _appendSecondaryMessage('agent', '<i class="fas fa-spinner fa-spin"></i> Thinking...');

    var sectionCtx = window.oliviaResolveSectionAgentContext('main_secondary');
    var panelCtx = (typeof window.buildSelectedPanelContext === 'function') ? window.buildSelectedPanelContext() : { text: '' };
    var pinnedCtx = (typeof window.buildPinnedPathsContext === 'function') ? window.buildPinnedPathsContext() : { text: '' };

    var config = (typeof window.getConfig === 'function') ? window.getConfig() : {};
    var message = text
      + (panelCtx && panelCtx.text ? panelCtx.text : '')
      + (pinnedCtx && pinnedCtx.text ? pinnedCtx.text : '');

    try {
      var full = await window.OliviaAPI.assistant.chat(message, {
        model: config && config.model ? config.model : undefined,
        provider: config && config.provider ? config.provider : undefined,
        temperature: config && config.temperature !== undefined ? config.temperature : undefined,
        history: _secondaryHistoryForApi(),
        system: [
          'You are operating in the Olivia Secondary Main Chat lane.',
          sectionCtx.system,
          'Keep this lane independent from primary lane state unless the user explicitly asks to synchronize outputs.'
        ].join('\n\n'),
        sessionKey: sectionCtx.sessionKey,
      }, function (_token, accumulated) {
        if (loader) loader.innerHTML = _resolveMarked(accumulated);
      });

      _runtime.secondaryHistory.push({ role: 'user', content: text });
      _runtime.secondaryHistory.push({ role: 'assistant', content: full });
      if (loader) loader.innerHTML = _resolveMarked(full || '');
    } catch (err) {
      if (loader) loader.innerHTML = '<span style="color:var(--red)">' + escapeHtml((err && err.message) || String(err)) + '</span>';
    } finally {
      _runtime.secondaryBusy = false;
    }
  }

  function _setAssignment(sectionKey, agentId, persist) {
    if (!_profileByKey(sectionKey)) return;
    _runtime.assignments[sectionKey] = String(agentId || '');
    if (persist !== false) _saveRuntimeState();
    _renderAll();
  }

  function _renderAll() {
    _ensureMainLaneUi();
    _ensureSectionMapUi();
    _renderMainSelectors();
    _renderSectionGrid();
    _renderRuntimeBarCollapsedState();
    _renderSectionMapCollapsedState();
    _renderSecondaryState();
    _renderSectionHeaderBadges();
    _renderRuntimeBarLabels();
  }

  function _bootstrapRuntimeUi() {
    _readRuntimeState();
    _ensureAssignments();
    _renderAll();

    if (!_bootstrapRuntimeUi._langBound && typeof document !== 'undefined') {
      _bootstrapRuntimeUi._langBound = true;
      document.addEventListener('olivia:lang-changed', function () { _renderAll(); });
    }

    if (!window.selectedAgent && _runtime.assignments.main_primary && typeof window.selectAgent === 'function') {
      _runtime.suppressPrimarySync = true;
      Promise.resolve(window.selectAgent(_runtime.assignments.main_primary)).finally(function () {
        _runtime.suppressPrimarySync = false;
      });
    }
  }

  function oliviaSyncSectionAgentRuntime() {
    _ensureAssignments();
    _renderAll();
    if (!window.selectedAgent && _runtime.assignments.main_primary && typeof window.selectAgent === 'function') {
      _runtime.suppressPrimarySync = true;
      Promise.resolve(window.selectAgent(_runtime.assignments.main_primary)).finally(function () {
        _runtime.suppressPrimarySync = false;
      });
    }
  }

  function oliviaResolveSectionAgentContext(sectionKey) {
    var profile = _profileByKey(sectionKey);
    if (!profile) {
      return {
        sectionKey: sectionKey,
        profile: null,
        agent: null,
        agentId: '',
        assigned: false,
        active: false,
        sessionKey: 'section:' + String(sectionKey || 'unknown') + ':default',
        system: 'Unknown section context.',
      };
    }

    var assignedId = String(_runtime.assignments[sectionKey] || '');
    var agent = _agentById(assignedId);
    var assigned = !!assignedId;
    var active = _agentIsActive(agent);

    return {
      sectionKey: sectionKey,
      profile: profile,
      agent: agent,
      agentId: agent ? String(agent.agent_id || '') : assignedId,
      assigned: assigned,
      active: active,
      sessionKey: 'section:' + sectionKey + ':' + (agent ? String(agent.agent_id || '') : 'default'),
      system: _buildSystemPrompt(sectionKey, agent),
    };
  }

  function oliviaOnPrimaryAgentSelected(agent) {
    if (_runtime.suppressPrimarySync) return;
    if (!agent || !agent.agent_id) return;
    _runtime.assignments.main_primary = String(agent.agent_id);
    _saveRuntimeState();
    _renderMainSelectors();
    _renderSectionGrid();
    _renderSectionHeaderBadges();
  }

  function oliviaSetSectionAgentAssignment(sectionKey, agentId) {
    _setAssignment(sectionKey, agentId, true);
  }

  function oliviaGetSectionAgentAssignment(sectionKey) {
    return String(_runtime.assignments[sectionKey] || '');
  }

  function oliviaGetAssignedAgentForSection(sectionKey) {
    return _agentById(_runtime.assignments[sectionKey]);
  }

  window.oliviaSyncSectionAgentRuntime = oliviaSyncSectionAgentRuntime;
  window.oliviaResolveSectionAgentContext = oliviaResolveSectionAgentContext;
  window.oliviaOnPrimaryAgentSelected = oliviaOnPrimaryAgentSelected;
  window.oliviaSetSectionAgentAssignment = oliviaSetSectionAgentAssignment;
  window.oliviaGetSectionAgentAssignment = oliviaGetSectionAgentAssignment;
  window.oliviaGetAssignedAgentForSection = oliviaGetAssignedAgentForSection;
  window.oliviaRefreshSectionRuntimeUi = _renderAll;
  // Backward-compat aliases used by older modules.
  window.LA8159ResolveSectionAgentContext = oliviaResolveSectionAgentContext;
  window.LA8159SetSectionAgentAssignment = oliviaSetSectionAgentAssignment;
  window.LA8159GetSectionAgentAssignment = oliviaGetSectionAgentAssignment;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _bootstrapRuntimeUi);
  } else {
    _bootstrapRuntimeUi();
  }
})();
