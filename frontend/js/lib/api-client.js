/* ═══════════════════════════════════════════════════════════════════
  AURA API CLIENT  —  olivia/js/lib/api-client.js
   Single source of truth for all HTTP/SSE calls to the backend.
   All 40 functions are grouped under window.LA8159API.
   Load order: after config.js (needs API_BASE), before all modules.
   ═══════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ── Core streaming helper ─────────────────────────────────────────
  // Calls POST /api/assistant/chat with SSE streaming.
  // opts: { model, history, system, context, sessionKey }
  // onToken(tokenText, fullText) is called for every streamed token.
  // Returns the full accumulated response string.
  const _sessionIds = new Map(); // openclaude session continuity (keyed)
  async function streamChat(message, opts, onToken) {
    const cfg = opts || {};
    const onEvent = typeof cfg.onEvent === 'function' ? cfg.onEvent : null;
    const sessionKey = String(cfg.sessionKey || 'default');
    const streamIdleTimeoutMs = Number.isFinite(Number(cfg.streamIdleTimeoutMs))
      ? Math.max(15000, Number(cfg.streamIdleTimeoutMs))
      : 600000;
    const controller = new AbortController();
    let idleTimer = null;

    function resetIdleTimer() {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(function onIdleTimeout() {
        try { controller.abort('assistant_stream_idle_timeout'); }
        catch (_e) { }
      }, streamIdleTimeoutMs);
    }

    resetIdleTimer();

    const body = { message };
    if (cfg.model) body.model = cfg.model;
    if (cfg.provider) body.provider = cfg.provider;
    if (cfg.baseUrl) body.base_url = cfg.baseUrl;
    const maxTokens = Number.isFinite(Number(cfg.maxTokens)) ? Number(cfg.maxTokens) : null;
    if (maxTokens && maxTokens > 0) body.max_tokens = Math.floor(maxTokens);
    const temperature = cfg.temperature;
    if (Number.isFinite(Number(temperature))) body.temperature = Number(temperature);
    if (cfg.history) body.history = cfg.history;
    if (cfg.system) body.system = cfg.system;
    if (cfg.context) body.context = cfg.context;
    if (cfg.agentId) body.agent_id = cfg.agentId;
    if (cfg.projectId) body.project_id = cfg.projectId;
    if (cfg.sectionKey) body.section_key = String(cfg.sectionKey);
    if (cfg.panelContext && typeof cfg.panelContext === 'object') body.panel_context = cfg.panelContext;
    if (cfg.orchestrationProbe && typeof cfg.orchestrationProbe === 'object') body.orchestration_probe = cfg.orchestrationProbe;
    if (cfg.debugContextPreview === true) body.debug_context_preview = true;
    if (cfg.importedFiles && typeof cfg.importedFiles === 'object') {
      const keys = Object.keys(cfg.importedFiles);
      if (keys.length > 0) body.imported_files = cfg.importedFiles;
    }
    if (Array.isArray(cfg.imageAttachments) && cfg.imageAttachments.length > 0) {
      body.image_attachments = cfg.imageAttachments;
    }
    if (cfg.session_id) body.session_id = cfg.session_id;
    else if (_sessionIds.has(sessionKey)) body.session_id = _sessionIds.get(sessionKey);

    const headers = { 'Content-Type': 'application/json' };
    if (typeof window.getCustomApiKey === 'function') {
      const customKey = window.getCustomApiKey(cfg.provider);
      if (customKey) {
        headers.Authorization = `Bearer ${customKey}`;
      }
    }

    let response;
    try {
      response = await fetch(`${API_BASE}/api/assistant/chat`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      if (idleTimer) clearTimeout(idleTimer);
      if (err && (err.name === 'AbortError' || String(err).includes('assistant_stream_idle_timeout'))) {
        throw new Error(`Tempo limite do stream (${Math.round(streamIdleTimeoutMs / 1000)}s sem atividade).`);
      }
      throw err;
    }

    if (!response.ok) {
      if (idleTimer) clearTimeout(idleTimer);
      throw new Error(`HTTP ${response.status}`);
    }

    let fullContent = '';
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    function processSseLine(line) {
      if (!line.trim() || !line.startsWith('data:')) return;
      const raw = line.replace(/^data:\s*/, '').trim();
      if (!raw || raw === '[DONE]') return;

      let data;
      try { data = JSON.parse(raw); }
      catch (_e) { return; } // skip non-JSON SSE lines (e.g. keep-alive)

      if (onEvent) {
        try { onEvent(data); }
        catch (_e) { }
      }

      if (data.type === 'token' && data.content) {
        // Defensive: if content is an object, extract the text field
        let tokenText;
        if (typeof data.content === 'string') {
          tokenText = data.content;
        } else if (data.content && typeof data.content === 'object') {
          tokenText = data.content.text || data.content.content || data.content.value || '';
        }
        if (tokenText) {
          fullContent += tokenText;
          if (onToken) onToken(tokenText, fullContent);
        }
      } else if (data.type === 'session_id' && data.session_id) {
        _sessionIds.set(sessionKey, data.session_id);
      } else if (data.type === 'error') {
        throw new Error(data.message || 'Stream error');
      }
    }

    try {
      while (true) {
        let packet;
        try {
          packet = await reader.read();
        } catch (err) {
          if (err && (err.name === 'AbortError' || String(err).includes('assistant_stream_idle_timeout'))) {
            throw new Error(`Tempo limite do stream (${Math.round(streamIdleTimeoutMs / 1000)}s sem atividade).`);
          }
          throw err;
        }
        const { done, value } = packet;
        if (done) break;
        resetIdleTimer();
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          processSseLine(line);
        }
      }

      if (buffer.trim()) {
        processSseLine(buffer);
      }

      return fullContent;
    } finally {
      if (idleTimer) clearTimeout(idleTimer);
    }
  }

  function resetSession(sessionKey) {
    if (sessionKey) {
      _sessionIds.delete(String(sessionKey));
      return;
    }
    _sessionIds.clear();
  }
  async function getModels() {
    const r = await fetch(`${API_BASE}/api/models/catalog`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }

  // ── Agent lifecycle ───────────────────────────────────────────────
  async function agentsList() {
    const r = await fetch(`${API_BASE}/api/agents/list`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }
  async function agentsCreate(data) {
    const r = await fetch(`${API_BASE}/api/agents/create`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }
  async function agentsDelete(id) {
    const r = await fetch(`${API_BASE}/api/agents/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }
  async function agentsActivate(id) {
    const r = await fetch(`${API_BASE}/api/agents/${encodeURIComponent(id)}/activate`, { method: 'POST' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }
  async function agentsDeactivate(id) {
    const r = await fetch(`${API_BASE}/api/agents/${encodeURIComponent(id)}/deactivate`, { method: 'POST' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }
  async function agentsExport(id) {
    const r = await fetch(`${API_BASE}/api/agents/${encodeURIComponent(id)}/bundle/export`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.blob();
  }
  async function agentsImport(formData) {
    const r = await fetch(`${API_BASE}/api/agents/import/bundle`, { method: 'POST', body: formData });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }

  // ── Agent execution ───────────────────────────────────────────────
  // Returns the raw Response so the caller can read SSE directly.
  async function agentRun(body) {
    const r = await fetch(`${API_BASE}/run`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r;
  }
  async function agentStop() {
    const r = await fetch(`${API_BASE}/api/agent/stop`, { method: 'POST' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }
  async function agentRespond(body) {
    const r = await fetch(`${API_BASE}/api/agent/respond`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }
  async function guidedResume(body) {
    const r = await fetch(`${API_BASE}/api/guided/resume`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }
  async function guidedStop() {
    const r = await fetch(`${API_BASE}/api/guided/stop`, { method: 'POST' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }
  async function auditorResume(body) {
    const r = await fetch(`${API_BASE}/api/auditor/resume`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }
  async function auditorStop() {
    const r = await fetch(`${API_BASE}/api/auditor/stop`, { method: 'POST' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }

  // ── Chat persistence ──────────────────────────────────────────────
  async function chatList(agentId) {
    const r = await fetch(`${API_BASE}/api/agents/${encodeURIComponent(agentId)}/chat/list`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }
  async function chatLoad(agentId, name) {
    const r = await fetch(
      `${API_BASE}/api/agents/${encodeURIComponent(agentId)}/chat/load?name=${encodeURIComponent(name)}`
    );
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }
  async function chatSave(agentId, messages) {
    const r = await fetch(`${API_BASE}/api/agents/${encodeURIComponent(agentId)}/chat/save`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }

  // ── Memory (Qdrant + Neo4j) ───────────────────────────────────────
  async function memoryCollections() {
    const r = await fetch(`${API_BASE}/api/memory/collections`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }
  async function memoryCreateCollection(name) {
    const r = await fetch(`${API_BASE}/api/memory/collections`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }
  // memorySearch(query, collection, opts) — opts may carry { limit, minScore }.
  async function memorySearch(query, collection, opts) {
    const body = { query };
    if (collection) body.collection = collection;
    const o = opts || {};
    if (o.limit) body.limit = o.limit;
    if (o.minScore !== undefined) body.min_score = o.minScore;
    const r = await fetch(`${API_BASE}/api/memory/search`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }
  async function memoryIngest(data) {
    const r = await fetch(`${API_BASE}/api/memory/ingest`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }
  async function memoryGraphStats() {
    const r = await fetch(`${API_BASE}/api/memory/graph/stats`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }
  async function memoryIngestArticles(articles, collection) {
    const r = await fetch(`${API_BASE}/api/memory/ingest/articles`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ articles, collection }),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }
  async function memoryIngestViolation(violation, collection) {
    const r = await fetch(`${API_BASE}/api/memory/ingest/violation`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ violation, collection }),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }
  async function memoryGraphIngest(nodes, relationships) {
    const r = await fetch(`${API_BASE}/api/memory/graph/ingest`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nodes, relationships }),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }
  async function memoryRouting() {
    const r = await fetch(`${API_BASE}/api/memory/routing`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }
  async function memoryRoutingSave(payload) {
    const r = await fetch(`${API_BASE}/api/memory/routing`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }
  async function memorySources() {
    const r = await fetch(`${API_BASE}/api/memory/sources`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }
  async function memoryConfig() {
    const r = await fetch(`${API_BASE}/api/memory/config`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }
  async function memoryConfigSave(config) {
    const r = await fetch(`${API_BASE}/api/memory/config`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }
  async function memoryCollectionDetails(name) {
    const r = await fetch(`${API_BASE}/api/memory/collections/${encodeURIComponent(name)}`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }

  // ── Shared files & scopes ─────────────────────────────────────────
  // sharedScopes(agentId) — optional agent_id filter (docs shared tree).
  async function sharedScopes(agentId) {
    const q = agentId ? `?agent_id=${encodeURIComponent(agentId)}` : '';
    const r = await fetch(`${API_BASE}/api/shared/scopes${q}`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }
  // Always use ?path= — construct "category/file" client-side if needed.
  async function sharedFile(path) {
    const r = await fetch(`${API_BASE}/api/shared/file?path=${encodeURIComponent(path)}`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.text();
  }
  async function sharedTranscripts() {
    const r = await fetch(`${API_BASE}/api/transcripts/list`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }
  async function sharedCompanion(path) {
    const r = await fetch(`${API_BASE}/api/shared/companion?path=${encodeURIComponent(path)}`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }
  async function sharedList(path) {
    const r = await fetch(`${API_BASE}/api/shared/list?path=${encodeURIComponent(path || '')}`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }
  // sharedLawSync(query) — query: { path, framework_code, prune_framework }.
  async function sharedLawSync(query) {
    const q = query || {};
    const params = new URLSearchParams();
    if (q.path) params.set('path', q.path);
    if (q.framework_code) params.set('framework_code', q.framework_code);
    if (q.prune_framework) params.set('prune_framework', 'true');
    const r = await fetch(`${API_BASE}/api/shared/law/sync?${params.toString()}`, { method: 'POST' });
    if (!r.ok) {
      let detail = null;
      try { const d = await r.json(); detail = d && d.detail; } catch (_e) { }
      throw new Error(detail || `HTTP ${r.status}`);
    }
    return r.json();
  }
  async function sharedLawArticles(path) {
    const r = await fetch(`${API_BASE}/api/shared/law/articles?path=${encodeURIComponent(path)}`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }

  // ── Project files & content ───────────────────────────────────────
  async function projectFiles(projectId, agentId) {
    const q = agentId ? `?agent_id=${encodeURIComponent(agentId)}` : '';
    const r = await fetch(`${API_BASE}/api/projects/${encodeURIComponent(projectId)}/files${q}`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }
  async function projectFileDelete(projectId, path) {
    const r = await fetch(`${API_BASE}/api/projects/${encodeURIComponent(projectId)}/file?path=${encodeURIComponent(path)}`, {
      method: 'DELETE',
    });
    if (!r.ok) {
      let detail = null;
      try { const d = await r.json(); detail = d && d.detail; } catch (_e) { }
      throw new Error(detail || `HTTP ${r.status}`);
    }
    return r.json();
  }
  async function projectContent(projectId, path) {
    const r = await fetch(`${API_BASE}/api/projects/${encodeURIComponent(projectId)}/content?path=${encodeURIComponent(path)}`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }

  // ── Transcription (Pinocchio :8039) ──────────────────────────────
  async function transcribeRun(formData) {
    const r = await fetch(`${API_BASE}/api/diarization/transcribe`, { method: 'POST', body: formData });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }
  async function whisperModels() {
    const r = await fetch(`${API_BASE}/api/diarization/models/whisper`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }
  async function transcriptSearch(query) {
    const r = await fetch(`${API_BASE}/api/transcripts/search`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }

  // ── Public registry ───────────────────────────────────────────────
  window.LA8159API = {
    assistant: {
      chat: streamChat,   // streamChat(message, opts, onToken) → Promise<string>
      models: getModels,
      resetSession: resetSession, // clear openclaude session_id (new conversation)
    },
    agents: {
      list: agentsList,
      create: agentsCreate,
      delete: agentsDelete,
      activate: agentsActivate,
      deactivate: agentsDeactivate,
      export: agentsExport,
      import: agentsImport,
    },
    agent: {
      run: agentRun,     // returns raw Response for SSE consumption
      stop: agentStop,
      respond: agentRespond, // answer pending ask_human in general mode
    },
    guided: {
      resume: guidedResume,
      stop: guidedStop,
    },
    auditor: {
      resume: auditorResume,
      stop: auditorStop,
    },
    chat: {
      list: chatList,
      load: chatLoad,
      save: chatSave,
    },
    memory: {
      collections: memoryCollections,
      createCollection: memoryCreateCollection,
      search: memorySearch,
      ingest: memoryIngest,
      graphStats: memoryGraphStats,
      ingestArticles: memoryIngestArticles,
      ingestViolation: memoryIngestViolation,
      graphIngest: memoryGraphIngest,
      routing: memoryRouting,
      routingSave: memoryRoutingSave,
      sources: memorySources,
      config: memoryConfig,
      configSave: memoryConfigSave,
      collectionDetails: memoryCollectionDetails,
    },
    projects: {
      files: projectFiles,      // projectFiles(projectId, agentId?)
      fileDelete: projectFileDelete, // projectFileDelete(projectId, path)
      content: projectContent,  // projectContent(projectId, path)
    },
    shared: {
      scopes: sharedScopes,     // sharedScopes(agentId?)
      file: sharedFile,        // sharedFile(path) — always ?path= pattern
      transcripts: sharedTranscripts,
      companion: sharedCompanion, // sharedCompanion(path)
      list: sharedList,         // sharedList(path)
      lawSync: sharedLawSync,   // sharedLawSync(query)
      lawArticles: sharedLawArticles, // sharedLawArticles(path)
    },
    transcribe: {
      run: transcribeRun,
      models: whisperModels,
      search: transcriptSearch,
    },
  };

  // Compatibility alias for legacy modules/global references.
  window.OliviaAPI = window.LA8159API;

  console.log('[LA8159API] v1.3 loaded — 47 functions across 10 groups');
})();
