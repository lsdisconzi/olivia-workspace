/* ═══════════════════════════════════════════════════════════════════
  SERVICE REGISTRY  —  olivia/js/lib/service-registry.js
   Tracks backend service UP/DOWN health. Deliberately DISTINCT from
   capability availability (see D-005): Qdrant=UP does NOT mean
   memory.ingest=AVAILABLE — that derivation lives in capability-registry.
   Load order: after config.js (API_BASE), before capability-registry.js.
   ═══════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const API_BASE = (window.API_BASE !== undefined)
    ? String(window.API_BASE).replace(/\/$/, '')
    : window.location.origin;

  // Default probes — health endpoint per service (from capability-manifest.json).
  // Probes are additive config, not sources of truth.
  const DEFAULT_PROBES = {
    gateway:      { url: '/health',                kind: 'http',  intervalMs: 60000 },
    qdrant:       { url: '/api/memory/collections', kind: 'http',  intervalMs: 60000 },
    bridge:       { url: '/api/bridge/categories',  kind: 'http',  intervalMs: 60000 },
    visualizer:   { url: '/api/architecture/generated/', kind: 'http', intervalMs: 120000 },
    'skill-svc':  { url: '/api/architecture/skills', kind: 'http',  intervalMs: 120000 },
    transcription:{ url: '/api/diarization/models/whisper', kind: 'http', intervalMs: 120000 },
    'garage-mcp': { url: null, kind: 'mcp',         intervalMs: 120000 },
  };

  const _health = {};      // serviceId -> { status: 'up'|'down'|'unknown', checkedAt, latencyMs, detail }
  const _timers = {};
  let _started = false;

  function _now() { return Date.now(); }

  function _statusOf(serviceId) {
    const h = _health[serviceId];
    if (!h) return 'unknown';
    return h.status;
  }

  async function _probeHttp(cfg) {
    const t0 = _now();
    const ctrl = new AbortController();
    const timer = setTimeout(function () { try { ctrl.abort(); } catch (_e) {} }, 8000);
    try {
      const res = await fetch(API_BASE + cfg.url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: ctrl.signal,
      });
      return { ok: res.ok, latencyMs: _now() - t0 };
    } catch (_e) {
      return { ok: false, latencyMs: _now() - t0 };
    } finally {
      clearTimeout(timer);
    }
  }

  function _probe(serviceId) {
    const cfg = DEFAULT_PROBES[serviceId] || { kind: 'http' };
    if (!cfg.url) return Promise.resolve({ ok: false, detail: 'no-probe-url' });

    return _probeHttp(cfg).then(function (r) {
      const h = {
        status: r.ok ? 'up' : 'down',
        checkedAt: _now(),
        latencyMs: r.latencyMs,
        detail: r.ok ? 'ok' : 'http-error',
      };
      _health[serviceId] = h;
      return h;
    }).catch(function (e) {
      const h = { status: 'down', checkedAt: _now(), detail: String(e && e.message || e) };
      _health[serviceId] = h;
      return h;
    });
  }

  // ── Public registry ─────────────────────────────────────────────
  window.OliviaServices = {
    /** Probe a single service immediately. */
    probe: _probe,

    /** Probe all known services. Returns Promise<Array<{id, status}>>. */
    probeAll: function () {
      return Promise.all(Object.keys(DEFAULT_PROBES).map(function (id) {
        return _probe(id).then(function (h) { return { id: id, status: h.status }; });
      }));
    },

    /** Cached health snapshot: { id: { status, checkedAt, latencyMs } }. */
    snapshot: function () {
      const out = {};
      Object.keys(DEFAULT_PROBES).forEach(function (id) {
        out[id] = _health[id] || { status: 'unknown', checkedAt: null };
      });
      return out;
    },

    /** Single service status: 'up' | 'down' | 'unknown'. */
    status: function (serviceId) { return _statusOf(serviceId); },

    /** True iff service reported up (never inferred). */
    isUp: function (serviceId) { return _statusOf(serviceId) === 'up'; },

    /** Register an additional probe (e.g. a new MCP server discovered at runtime). */
    registerProbe: function (serviceId, cfg) {
      if (serviceId && cfg && cfg.url) DEFAULT_PROBES[serviceId] = cfg;
      if (_started) _probe(serviceId);
    },

    /** Start background health polling. Idempotent. */
    start: function () {
      if (_started) return;
      _started = true;
      Object.keys(DEFAULT_PROBES).forEach(function (id) {
        _probe(id);
        const ms = DEFAULT_PROBES[id].intervalMs || 60000;
        _timers[id] = setInterval(function () { _probe(id); }, ms);
      });
    },

    /** Stop background polling. */
    stop: function () {
      _started = false;
      Object.keys(_timers).forEach(function (id) {
        clearInterval(_timers[id]);
        delete _timers[id];
      });
    },
  };

  // Legacy alias, consistent with api-client.js pattern.
  window.LA8159Services = window.OliviaServices;

  console.log('[OliviaServices] loaded — ' + Object.keys(DEFAULT_PROBES).length + ' services registered');
})();
