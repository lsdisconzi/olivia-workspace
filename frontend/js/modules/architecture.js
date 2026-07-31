/* ════════════════════════════════════════════════════════════════
   architecture.js — Agent Architecture browser.
   Surfaces the 8 canonical agents from vps_projects_/agent-architecture
   (generated/agents/*.agent.md + generated/bundles/*.bundle.import.json)
   as a launcher grid with deep-links into the matching in-app module.
   Talks to the kout proxy /api/architecture/* -> :8120 (visualizer)
   and /api/architecture/{agents,bundles,skills} -> :4173 (skill svc).
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const ARCH_BASE = '/api/architecture';
  const ARCH_FULL_CONSOLE_URL = '/api/architecture/generated/?focus=la8159';

  // Known in-app launchers keyed by agent-architecture agent id.
  const ARCH_LAUNCHERS = {
    'shaders-proactive':          { view: 'shaders',      sidebar: 'shaders',     fn: 'shadersShowView'      },
    'discovery-intelligence':     { view: 'descoberta',   sidebar: 'descoberta',  fn: 'descShowView'         },
    'listening-operations':       { view: 'listening',    sidebar: 'listening',   fn: 'listeningShowView'    },
    'memory-graph':               { view: 'memory',       sidebar: 'memory',      fn: 'memoryShowView'       },
    'studio-ui':                  { view: 'studio',       sidebar: 'studio',      fn: 'studioShowView'       },
    'api-explorer':               { view: 'apiexplorer',  sidebar: 'apiexplorer', fn: 'aexInit'              },
    'orchestrator-control-plane': { view: 'agents',       sidebar: 'agents',      fn: null                   },
    'qdrant-manager':             { view: 'memory',       sidebar: 'memory',      fn: 'memoryShowView'       },
  };

  const ARCH_ICONS = {
    'shaders-proactive': 'fa-palette',
    'discovery-intelligence': 'fa-compass',
    'listening-operations': 'fa-microphone',
    'memory-graph': 'fa-brain',
    'studio-ui': 'fa-code',
    'api-explorer': 'fa-plug',
    'orchestrator-control-plane': 'fa-sitemap',
    'qdrant-manager': 'fa-database',
  };

  const _state = {
    loaded: false,
    loading: false,
    deploying: false,
    deployStatus: '',
    deployError: false,
    agents: [],   // [{id,name,description,raw}]
    bundles: [],  // [{id,name,agent_id,...}]
    skills: [],
    groups: null,
    error: '',
  };

  function _escape(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  async function _fetchJson(url) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } catch (e) {
      console.warn('[architecture] fetch failed', url, e);
      return null;
    }
  }

  async function _postJson(url, payload) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload || {}),
      });
      const data = await res.json().catch(function () { return {}; });
      return { ok: !!res.ok, status: res.status, data: data || {} };
    } catch (e) {
      return { ok: false, status: 0, data: { error: String(e && e.message ? e.message : e || 'request_failed') } };
    }
  }

  function _norm(v) {
    return String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  }

  function _notify(msg, isError) {
    _state.deployStatus = String(msg || '').trim();
    _state.deployError = !!isError;
    if (typeof window.addSystemBubble === 'function' && _state.deployStatus) {
      window.addSystemBubble(_state.deployStatus);
    }
    archRender();
  }

  function _groupsMap() {
    return (_state.groups && _state.groups.groups) || {};
  }

  function _groupDeployTargets(groupSlug) {
    const groups = _groupsMap();
    const info = groups[groupSlug] || {};
    const agents = Array.isArray(info.agents) ? info.agents : [];
    const seen = Object.create(null);
    return agents
      .filter(function (a) { return a && typeof a.bundle_file === 'string' && String(a.bundle_file).trim(); })
      .map(function (a) {
        return {
          slug: String(a.slug || ''),
          name: String(a.name || a.slug || ''),
          bundle_file: String(a.bundle_file || '').trim(),
        };
      })
      .filter(function (item) {
        if (!item.bundle_file || seen[item.bundle_file]) return false;
        seen[item.bundle_file] = true;
        return true;
      });
  }

  function _bundleFileUrl(bundleFile) {
    let cleaned = String(bundleFile || '').trim().replace(/^\/+/, '');
    while (cleaned.startsWith('generated/')) cleaned = cleaned.slice('generated/'.length);
    if (!cleaned) return '';
    return ARCH_BASE + '/generated/' + cleaned.split('/').map(function (part) {
      return encodeURIComponent(part);
    }).join('/');
  }

  function _findGroupAgentRecord(agentId) {
    const needle = _norm(agentId);
    if (!needle) return null;
    const groups = _groupsMap();
    const slugs = Object.keys(groups);
    for (let i = 0; i < slugs.length; i += 1) {
      const groupSlug = slugs[i];
      const groupInfo = groups[groupSlug] || {};
      const agents = Array.isArray(groupInfo.agents) ? groupInfo.agents : [];
      const match = agents.find(function (a) {
        return _norm(a && a.slug) === needle;
      });
      if (match) {
        return { group: groupSlug, record: match };
      }
    }
    return null;
  }

  function _resolveAgentDeploySource(agent) {
    const id = String((agent && (agent.id || agent.slug)) || '').trim();
    if (!id) return null;
    const grouped = _findGroupAgentRecord(id);
    if (grouped && grouped.record && grouped.record.bundle_file) {
      return {
        type: 'bundle-file',
        source: String(grouped.record.bundle_file),
        group: grouped.group,
      };
    }

    const bundleId = String((agent && agent.bundle_id) || ((_bundleForAgent(id) || {}).id) || '').trim();
    if (bundleId) {
      return { type: 'bundle-id', source: bundleId };
    }
    return null;
  }

  async function _loadBundlePayloadFromSource(source) {
    if (!source || !source.type || !source.source) {
      throw new Error('bundle_source_missing');
    }
    let payload = null;
    if (source.type === 'bundle-file') {
      payload = await _fetchJson(_bundleFileUrl(source.source));
    } else if (source.type === 'bundle-id') {
      payload = await _fetchJson(`${ARCH_BASE}/bundles/${encodeURIComponent(source.source)}`);
    }
    const bundle = payload && payload.bundle && typeof payload.bundle === 'object'
      ? payload.bundle
      : (payload && payload.agent ? payload : null);
    if (!bundle || typeof bundle !== 'object') {
      throw new Error('bundle_payload_invalid');
    }
    return { bundle: bundle };
  }

  async function _deployBundlePayload(payload) {
    const imported = await _postJson('/api/agents/import/bundle', payload);
    if (!imported.ok) {
      const reason = imported.data && (imported.data.error || imported.data.message)
        ? String(imported.data.error || imported.data.message)
        : ('HTTP ' + imported.status);
      throw new Error(reason);
    }
    return imported.data || {};
  }

  async function _deployTargets(targets) {
    const out = {
      okCount: 0,
      failCount: 0,
      imported: [],
      failed: [],
    };
    for (let i = 0; i < targets.length; i += 1) {
      const target = targets[i];
      try {
        const payload = await _loadBundlePayloadFromSource(target.source);
        const res = await _deployBundlePayload(payload);
        out.okCount += 1;
        out.imported.push({
          target: target,
          agent_id: String(res.agent_id || ''),
          agent_name: String(res.agent_name || ''),
        });
      } catch (e) {
        out.failCount += 1;
        out.failed.push({
          target: target,
          error: String((e && e.message) || e || 'deploy_failed'),
        });
      }
    }
    return out;
  }

  async function archLoad(force) {
    if (_state.loading) return;
    if (_state.loaded && !force) return;
    _state.loading = true;
    _state.error = '';
    archRender();  // render skeleton

    const [agentsResp, bundlesResp, skillsResp] = await Promise.all([
      _fetchJson(`${ARCH_BASE}/agents`),
      _fetchJson(`${ARCH_BASE}/bundles`),
      _fetchJson(`${ARCH_BASE}/skills`),
    ]);

    const groupsResp = await _fetchJson(`${ARCH_BASE}/groups`);

    const offlineAgent = (agentsResp && agentsResp._offline);
    const offlineBundle = (bundlesResp && bundlesResp._offline);
    const allOffline = offlineAgent || offlineBundle || (!agentsResp && !bundlesResp);

    if (allOffline) {
      _state.error = 'Serviço agent-architecture offline (portas 8120/4173).';
      _state.agents = [];
      _state.bundles = [];
      _state.skills = [];
      _state.groups = null;
    } else {
      _state.agents = (agentsResp && agentsResp.agents) || [];
      _state.bundles = (bundlesResp && bundlesResp.bundles) || [];
      _state.skills = (skillsResp && skillsResp.skills) || [];
      _state.groups = groupsResp || null;
    }
    _state.loaded = true;
    _state.loading = false;
    archRender();
  }

  function _bundleForAgent(agentId) {
    return _state.bundles.find(b =>
      String(b.id || '') === agentId ||
      String(b.id || '').replace(/[^a-z0-9]/gi, '').toLowerCase() ===
        String(agentId || '').replace(/[^a-z0-9]/gi, '').toLowerCase()
    );
  }

  async function archDeployAgent(agentId) {
    if (_state.deploying) return;
    const agent = _state.agents.find(function (a) {
      return _norm(a && (a.id || a.slug)) === _norm(agentId);
    });
    const source = _resolveAgentDeploySource(agent || { id: agentId });
    if (!source) {
      _notify('Deploy indisponível: bundle não encontrado para ' + String(agentId || 'agente') + '.', true);
      return;
    }

    _state.deploying = true;
    _notify('Deploy do agente ' + String(agent && (agent.name || agent.id) || agentId) + ' em andamento...', false);
    try {
      const payload = await _loadBundlePayloadFromSource(source);
      const imported = await _deployBundlePayload(payload);
      const importedName = String(imported.agent_name || imported.agent_id || agentId);
      _notify('Deploy concluído: ' + importedName + '.', false);
    } catch (e) {
      _notify('Falha no deploy de ' + String(agent && (agent.name || agent.id) || agentId) + ': ' + String((e && e.message) || e), true);
    } finally {
      _state.deploying = false;
      archRender();
    }
  }

  async function archDeployGroup(groupSlug) {
    if (_state.deploying) return;
    const slug = String(groupSlug || '').trim();
    const targets = _groupDeployTargets(slug).map(function (item) {
      return {
        source: { type: 'bundle-file', source: item.bundle_file, group: slug },
        label: item.name || item.slug || item.bundle_file,
      };
    });

    if (!targets.length) {
      _notify('Nenhum bundle deployável no grupo ' + slug + '.', true);
      return;
    }

    _state.deploying = true;
    _notify('Deploy do grupo ' + slug + ' (' + targets.length + ' bundles) em andamento...', false);
    try {
      const result = await _deployTargets(targets);
      const msg = 'Grupo ' + slug + ': ' + result.okCount + ' deploy(s) ok, ' + result.failCount + ' falha(s).';
      _notify(msg, result.failCount > 0);
    } finally {
      _state.deploying = false;
      archRender();
    }
  }

  async function archDeployAllGroups() {
    if (_state.deploying) return;
    const groups = _groupsMap();
    const groupSlugs = Object.keys(groups);
    const targets = [];
    groupSlugs.forEach(function (slug) {
      _groupDeployTargets(slug).forEach(function (item) {
        targets.push({
          source: { type: 'bundle-file', source: item.bundle_file, group: slug },
          label: item.name || item.slug || item.bundle_file,
        });
      });
    });

    if (!targets.length) {
      _notify('Nenhum bundle deployável encontrado nos grupos.', true);
      return;
    }

    _state.deploying = true;
    _notify('Deploy de todos os grupos em andamento (' + targets.length + ' bundles)...', false);
    try {
      const result = await _deployTargets(targets);
      const msg = 'Deploy de grupos finalizado: ' + result.okCount + ' ok, ' + result.failCount + ' falha(s).';
      _notify(msg, result.failCount > 0);
    } finally {
      _state.deploying = false;
      archRender();
    }
  }

  function _launchAgent(agentId) {
    const launcher = ARCH_LAUNCHERS[agentId];
    if (!launcher) {
      if (typeof window.addSystemBubble === 'function') {
        window.addSystemBubble(`Sem launcher nativo para "${agentId}".`);
      }
      return;
    }
    if (launcher.sidebar && typeof window.switchSidebarTab === 'function') {
      window.switchSidebarTab(launcher.sidebar);
    }
    if (launcher.fn && typeof window[launcher.fn] === 'function') {
      try { window[launcher.fn](); } catch (e) { console.warn(e); }
    }
  }

  function _renderAgentCard(a) {
    const id = String(a.id || a.slug || '').trim();
    const name = _escape(a.name || id);
    const desc = _escape(a.description || a.summary || a.tagline || '');
    const cfg = a.config || {};
    const section = _escape(cfg.section || a.domain || '');
    const mode = _escape(cfg.mode || a.kind || '');
    const icon = ARCH_ICONS[id] || 'fa-robot';
    const bundle = a.bundle_id ? { id: a.bundle_id } : _bundleForAgent(id);
    const deploySource = _resolveAgentDeploySource(a);
    const canDeploy = !!deploySource && !_state.deploying;
    const launcher = ARCH_LAUNCHERS[id];
    const canOpen = !!(launcher && (launcher.fn || launcher.sidebar));
    const tools = Array.isArray(a.tools) ? a.tools : [];
    const scope = Array.isArray(cfg.scope) ? cfg.scope : [];
    const linked = Array.isArray(a.linked_files) ? a.linked_files.length : 0;

    return `
      <div class="arch-card" data-agent-id="${_escape(id)}">
        <div class="arch-card-head">
          <i class="fas ${icon}"></i>
          <div style="flex:1;min-width:0">
            <div class="arch-card-name">${name}</div>
            <div class="arch-card-domain">${section || _escape(id)}${mode ? ` · ${mode}` : ''}</div>
          </div>
        </div>
        <div class="arch-card-desc">${desc}</div>
        ${tools.length ? `<ul class="arch-card-caps">${tools.slice(0,6).map(c => `<li>${_escape(c)}</li>`).join('')}</ul>` : ''}
        <div class="arch-card-meta">
          <span title="Tools">${tools.length} tools</span>
          <span title="Scope files">${scope.length} scope</span>
          ${linked ? `<span title="Linked files">${linked} files</span>` : ''}
          ${bundle ? `<span title="Bundle importable">bundle ✓</span>` : ''}
        </div>
        <div class="arch-card-actions">
          <button class="btn btn-primary" ${canOpen ? '' : 'disabled'}
                  onclick="archLaunchAgent('${_escape(id)}')">
            <i class="fas fa-external-link-alt"></i> Abrir no Workspace
          </button>
          <button class="btn" ${canDeploy ? '' : 'disabled'}
                  onclick="archDeployAgent('${_escape(id)}')"
                  title="${canDeploy ? 'Importar bundle no workspace' : 'Bundle não disponível para deploy'}">
            <i class="fas fa-upload"></i> Deploy
          </button>
          <button class="btn" onclick="archShowDetails('${_escape(id)}')">
            <i class="fas fa-circle-info"></i> Spec
          </button>
        </div>
      </div>`;
  }

  function _renderGroupDeployPanel() {
    const groups = _groupsMap();
    const slugs = Object.keys(groups);
    if (!slugs.length) return '';
    const rows = slugs.map(function (slug) {
      const info = groups[slug] || {};
      const total = Number(info.agent_count || (Array.isArray(info.agents) ? info.agents.length : 0) || 0);
      const deployable = _groupDeployTargets(slug).length;
      return `
        <div class="arch-deploy-row">
          <div class="arch-deploy-label">
            <span class="arch-deploy-group">${_escape(info.label || slug)}</span>
            <span class="arch-deploy-meta">${total} agentes · ${deployable} bundles deployáveis</span>
          </div>
          <button class="btn btn-sm" ${deployable && !_state.deploying ? '' : 'disabled'} onclick="archDeployGroup('${_escape(slug)}')">
            <i class="fas fa-cloud-upload-alt"></i> Deploy Grupo
          </button>
        </div>`;
    }).join('');
    return `
      <div class="arch-deploy-panel">
        <div class="arch-deploy-head">
          <span><i class="fas fa-boxes-stacked"></i> Deploy de Grupos</span>
          <button class="btn btn-sm" ${_state.deploying ? 'disabled' : ''} onclick="archDeployAllGroups()">
            <i class="fas fa-rocket"></i> Deploy Todos
          </button>
        </div>
        <div class="arch-deploy-grid">${rows}</div>
      </div>`;
  }

  function _renderLa8159ConsoleCard() {
    const laGroup = (_groupsMap().la8159) || null;
    const laCount = laGroup ? Number(laGroup.agent_count || (Array.isArray(laGroup.agents) ? laGroup.agents.length : 0) || 0) : 0;
    const laDeployable = _groupDeployTargets('la8159').length;
    const label = laGroup && laGroup.label ? laGroup.label : 'LA8159 Grounding';
    return `
      <div class="arch-card" data-agent-id="la8159-console">
        <div class="arch-card-head">
          <i class="fas fa-plane-arrival"></i>
          <div style="flex:1;min-width:0">
            <div class="arch-card-name">${_escape(label)} · Full Console</div>
            <div class="arch-card-domain">8120 index · cards, tools, memory, test harness, reviewer</div>
          </div>
        </div>
        <div class="arch-card-desc">Acesso ao painel completo do LA8159 com cards expandidos (todos os agentes), política de ferramentas por agente, memória e revisão interativa.</div>
        <div class="arch-card-meta">
          <span title="LA8159 agents">${laCount || '—'} agents</span>
          <span title="LA8159 deployables">${laDeployable || 0} bundles</span>
          <span title="Target service">service :8120</span>
          <span title="Workspace export">workspace launcher ✓</span>
        </div>
        <div class="arch-card-actions">
          <button class="btn btn-primary" onclick="architectureOpenLa8159Console()">
            <i class="fas fa-external-link-alt"></i> Abrir Console
          </button>
          <button class="btn" ${laDeployable && !_state.deploying ? '' : 'disabled'} onclick="archDeployGroup('la8159')">
            <i class="fas fa-cloud-upload-alt"></i> Deploy LA8159
          </button>
          <a class="btn" href="/api/architecture/generated/" target="_blank" rel="noreferrer">
            <i class="fas fa-sitemap"></i> Visualizer
          </a>
        </div>
      </div>`;
  }

  function archRender() {
    const host = document.getElementById('architectureGrid');
    const status = document.getElementById('architectureStatus');
    if (!host) return;

    if (_state.loading && !_state.loaded) {
      host.innerHTML = `<div class="arch-empty"><i class="fas fa-spinner fa-spin"></i> Carregando agentes…</div>`;
      if (status) status.textContent = '';
      return;
    }
    if (_state.error && !_state.agents.length) {
      host.innerHTML = `<div class="arch-empty arch-error">
        <i class="fas fa-triangle-exclamation"></i> ${_escape(_state.error)}
        <div style="margin-top:8px;font-size:11px;color:var(--gray)">
          Suba com: <code>./start-all.sh restart agent-architecture</code>
        </div>
      </div>`;
      if (status) status.textContent = 'offline';
      return;
    }
    if (!_state.agents.length) {
      host.innerHTML = `<div class="arch-empty">Nenhum agente encontrado.</div>`;
      if (status) status.textContent = '0 agentes';
      return;
    }
    host.innerHTML = _renderGroupDeployPanel() + _renderLa8159ConsoleCard() + _state.agents.map(_renderAgentCard).join('');
    if (status) {
      const base = `${_state.agents.length} agentes · ${_state.bundles.length} bundles · ${_state.skills.length} skills`;
      if (_state.deploying) {
        status.textContent = `${base} · deploy em andamento...`;
        status.style.color = 'var(--amber, #c4622d)';
      } else if (_state.deployStatus) {
        status.textContent = `${base} · ${_state.deployStatus}`;
        status.style.color = _state.deployError ? 'var(--red, #d97857)' : 'var(--gray, #888)';
      } else {
        status.textContent = base;
        status.style.color = 'var(--gray, #888)';
      }
    }
  }

  async function archShowDetails(agentId) {
    const agent = _state.agents.find(a => String(a.id || a.slug) === agentId);
    if (!agent) return;
    const modal = document.getElementById('architectureDetailsModal');
    const body = document.getElementById('architectureDetailsBody');
    if (!modal || !body) return;

    const bundleId = agent.bundle_id || (_bundleForAgent(agentId) || {}).id;
    const tools = Array.isArray(agent.tools) ? agent.tools : [];
    const cfg = agent.config || {};
    const scope = Array.isArray(cfg.scope) ? cfg.scope : [];
    const linked = Array.isArray(agent.linked_files) ? agent.linked_files : [];
    const sysPrompt = _escape(agent.system_prompt || '');
    const mdPath = agent.file ? `${ARCH_BASE}/generated/${_escape(agent.file)}` : '';

    body.innerHTML = `
      <h2 style="margin:0 0 4px 0">${_escape(agent.name || agentId)}</h2>
      <div style="color:var(--gray-hi);font-size:12px;margin-bottom:10px">${_escape(cfg.section || agent.kind || '')}${cfg.mode ? ` · ${_escape(cfg.mode)}` : ''}</div>
      <p style="font-size:13px;line-height:1.55">${_escape(agent.description || '')}</p>

      ${sysPrompt ? `<h3>System prompt</h3><div style="font-size:12px;line-height:1.55;color:var(--gray-hi)">${sysPrompt}</div>` : ''}

      ${tools.length ? `<h3>Tools (${tools.length})</h3>
        <ul class="arch-mono">${tools.map(t => `<li>${_escape(typeof t === 'string' ? t : (t.name || JSON.stringify(t)))}</li>`).join('')}</ul>` : ''}

      ${scope.length ? `<h3>Scope (${scope.length})</h3>
        <ul class="arch-mono">${scope.map(s => `<li>${_escape(s)}</li>`).join('')}</ul>` : ''}

      ${linked.length ? `<h3>Linked files (${linked.length})</h3>
        <ul class="arch-mono">${linked.map(f => `<li>${_escape(typeof f === 'string' ? f : JSON.stringify(f))}</li>`).join('')}</ul>` : ''}

      <h3>Artifacts</h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${mdPath ? `<a class="btn" href="${mdPath}" target="_blank"><i class="fas fa-file-lines"></i> ${_escape(agent.file || 'agent.md')}</a>` : ''}
        ${bundleId ? `<a class="btn" href="${ARCH_BASE}/bundles/${_escape(bundleId)}" target="_blank"><i class="fas fa-file-code"></i> bundle JSON</a>` : ''}
      </div>
    `;
    modal.style.display = 'flex';
  }

  function archCloseDetails() {
    const modal = document.getElementById('architectureDetailsModal');
    if (modal) modal.style.display = 'none';
  }

  window.architectureShowView = function () {
    // Hide other fullscreen views
    ['shadersView', 'listeningView', 'studioView', 'descobertaView', 'memoryView', 'spacesView', 'mermaidView']
      .forEach(id => { const v = document.getElementById(id); if (v) v.classList.remove('active'); });
    const mc = document.querySelector('.main-content');
    if (mc) { mc._archDisplay = mc.style.display; mc.style.display = 'none'; }
    if (typeof aexHideMain === 'function') aexHideMain();
    const v = document.getElementById('architectureView');
    if (v) { v.style.display = ''; v.classList.add('active'); }
    archLoad(false);
  };

  window.architectureHideView = function () {
    const v = document.getElementById('architectureView');
    if (v) { v.classList.remove('active'); v.style.display = 'none'; }
    const mc = document.querySelector('.main-content');
    if (mc) { mc.style.display = mc._archDisplay || ''; }
  };

  window.archLaunchAgent = _launchAgent;
  window.archShowDetails = archShowDetails;
  window.archCloseDetails = archCloseDetails;
  window.archDeployAgent = archDeployAgent;
  window.archDeployGroup = archDeployGroup;
  window.archDeployAllGroups = archDeployAllGroups;
  window.architectureOpenLa8159Console = function () {
    try {
      window.open(ARCH_FULL_CONSOLE_URL, '_blank', 'noopener');
    } catch (_) {
      window.location.href = ARCH_FULL_CONSOLE_URL;
    }
  };
  window.architectureRefresh = function () { archLoad(true); };
})();
