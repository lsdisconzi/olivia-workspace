/* ═══════════════════════════════════════════════════════════════════
  PERMISSION INTERFACE  —  olivia/js/lib/permission-interface.js
   Advisory UI gating ONLY (D-004). This interface answers "may the UI
   display / invoke this?" — the backend remains authoritative for actual
   authorization before capability/tool execution. No security boundary
   is implied or enforced here.
   Load order: after config.js, before feature modules.
   ═══════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const API_BASE = (window.API_BASE !== undefined)
    ? String(window.API_BASE).replace(/\/$/, '')
    : window.location.origin;

  let _sections = null;          // allow-list of section ids from /api/user/me
  let _sectionRegistry = [];     // available_sections (canonical SECTION_REGISTRY)
  let _capabilityIndex = null;   // lazy: { capabilityId -> required_permissions }
  let _loaded = false;
  let _loadPromise = null;

  // ── Data source: /api/user/me (verified in trunk.js:153-160) ────
  function _load() {
    if (_loadPromise) return _loadPromise;
    _loadPromise = fetch(API_BASE + '/api/user/me', {
      headers: { Accept: 'application/json' },
    })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (me) {
        _sections = Array.isArray(me && me.sections) ? me.sections : [];
        _sectionRegistry = Array.isArray(me && me.available_sections)
          ? me.available_sections
          : [];
        _loaded = true;
        return me;
      })
      .catch(function (err) {
        console.warn('[OliviaPermissions] failed to load sections:', err);
        _sections = [];
        _loaded = true;
        throw err;
      });
    return _loadPromise;
  }

  function _capabilitiesReady() {
    if (_capabilityIndex) return Promise.resolve(_capabilityIndex);
    return fetch(API_BASE + '/js/lib/capability-manifest.json', {
      headers: { Accept: 'application/json' },
    })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (manifest) {
        _capabilityIndex = {};
        (manifest.capabilities || []).forEach(function (cap) {
          _capabilityIndex[cap.id] = cap;
        });
        return _capabilityIndex;
      })
      .catch(function (err) {
        console.warn('[OliviaPermissions] capability manifest unavailable:', err);
        _capabilityIndex = {};
        return _capabilityIndex;
      });
  }

  // Map a capability permission (e.g. 'memory.search') to a section id.
  // Convention: first path segment of the permission == section id.
  function _sectionFor(permission) {
    const seg = String(permission || '').split('.')[0];
    return seg || null;
  }

  // Advisory check: does the allow-list grant a permission's owning section?
  function _hasSection(permission) {
    const section = _sectionFor(permission);
    if (!section) return true;
    return _sections.indexOf(section) !== -1;
  }

  // ── Public interface (advisory) ──────────────────────────────────
  window.OliviaPermissions = {
    /** Async warm: load sections + capability manifest. Call on app init. */
    init: function () { return Promise.all([_load(), _capabilitiesReady()]); },

    /** May the UI show this section? Uses the /api/user/me allow-list. */
    canViewSection: function (sectionId) {
      if (!_loaded) return false;
      if (!_sections || !_sections.length) return true; // no allow-list -> not restricted
      return _sections.indexOf(String(sectionId)) !== -1;
    },

    /** May the UI invoke this capability (e.g. 'memory.search')? Advisory. */
    canUseCapability: function (capabilityId) {
      const index = _capabilityIndex;
      if (!index) return true; // manifest not loaded yet -> do not block UI
      const cap = index[capabilityId];
      if (!cap) return true;   // unknown capability -> do not block (backend decides)
      const perms = cap.required_permissions || [];
      return perms.every(function (p) { return _hasSection(p); });
    },

    /** May the UI access this resource? Advisory — backend authorizes. */
    canAccessResource: function (resourceType, resourceId) {
      // resourceType maps to a section (docs -> docs, drive -> drive, ...).
      const section = String(resourceType || '').split('/')[0];
      return this.canViewSection(section);
    },

    /** May the UI expose this tool for invocation? Advisory only. */
    canExecuteTool: function (toolName) {
      // No frontend tool allow-list exists; backend/mcp enforces tool use.
      // (EXECUTION_MODEL: "Can this agent use this tool?" — MCP server enforced)
      return true;
    },

    /** Current section allow-list (mirror of trunk._lastAllowed). */
    allowedSections: function () { return (_sections || []).slice(); },

    /** Canonical section registry from the server. */
    sectionRegistry: function () { return _sectionRegistry.slice(); },

    /** Force a section decision override (for tests / manual UI modes). */
    setSections: function (sectionIds) {
      _sections = Array.isArray(sectionIds) ? sectionIds.slice() : [];
      _loaded = true;
    },
  };

  // Legacy alias, consistent with api-client.js pattern.
  window.LA8159Permissions = window.OliviaPermissions;

  console.log('[OliviaPermissions] loaded — advisory UI gating (backend authoritative)');
})();
