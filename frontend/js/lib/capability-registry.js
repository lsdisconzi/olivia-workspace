/* ═══════════════════════════════════════════════════════════════════
  CAPABILITY REGISTRY  —  olivia/js/lib/capability-registry.js
   Derives capability AVAILABILITY from:
     service health (OliviaServices)  +  permission (OliviaPermissions)
     +  schema compatibility           +  downstream dependencies (D-005)
   The manifest (capability-manifest.json) is an authored CONTRACT;
   the registry is the runtime interpreter. UI should show capability
   availability, NOT raw service health.
   Load order: after config.js, api-client.js, service-registry.js,
   permission-interface.js. Before feature modules.
   ═══════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const API_BASE = (window.API_BASE !== undefined)
    ? String(window.API_BASE).replace(/\/$/, '')
    : window.location.origin;

  let _manifest = null;
  let _manifestPromise = null;
  const _audit = [];            // recent capability check log
  const _MAX_AUDIT = 200;

  // ── Manifest loading (authored contract) ─────────────────────────
  function _loadManifest() {
    if (_manifestPromise) return _manifestPromise;
    _manifestPromise = fetch(API_BASE + '/js/lib/capability-manifest.json', {
      headers: { Accept: 'application/json' },
    })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (m) { _manifest = m; return m; })
      .catch(function (err) {
        console.warn('[OliviaCapabilities] manifest load failed:', err);
        _manifest = { capabilities: [], services: {} };
        return _manifest;
      });
    return _manifestPromise;
  }

  function _auditEntry(capabilityId, state, reason) {
    if (_audit.length >= _MAX_AUDIT) _audit.shift();
    _audit.push({
      capability: capabilityId,
      state: state,
      reason: reason,
      at: new Date().toISOString(),
    });
  }

  // ── Availability derivation ──────────────────────────────────────
  function _serviceUp(serviceId) {
    const svc = window.OliviaServices;
    if (!svc) return true;   // registry not loaded -> do not block (defensive)
    return svc.status(serviceId) !== 'down';
  }

  function _permissionGranted(requiredPermissions) {
    const perm = window.OliviaPermissions;
    if (!perm) return true;
    return (requiredPermissions || []).every(function (p) {
      const section = String(p).split('.')[0];
      return perm.canViewSection(section);
    });
  }

  // Schema compatibility: manifest declares expectations; runtime may
  // override via registerSchemaCheck. Default = compatible (no check).
  function _schemaCompatible(capability) {
    if (typeof capability._schemaCheck === 'function') {
      return !!capability._schemaCheck();
    }
    return true;
  }

  // ── Public registry ──────────────────────────────────────────────
  window.OliviaCapabilities = {
    /** Warm manifest + (if available) delegate to services/permissions init. */
    init: function () {
      const jobs = [_loadManifest()];
      if (window.OliviaServices && window.OliviaServices.start) jobs.push(window.OliviaServices.start());
      if (window.OliviaPermissions && window.OliviaPermissions.init) jobs.push(window.OliviaPermissions.init());
      return Promise.all(jobs);
    },

    /** Raw manifest (authored contract). */
    manifest: function () { return _manifest; },

    /** All capability ids in the manifest. */
    list: function () {
      return (_manifest ? _manifest.capabilities : []).map(function (c) { return c.id; });
    },

    /** Look up a capability definition from the manifest. */
    get: function (capabilityId) {
      if (!_manifest) return null;
      const found = _manifest.capabilities.find(function (c) { return c.id === capabilityId; });
      return found || null;
    },

    /**
     * Compute availability for one capability.
     * Returns { available, reason, checks: { service, permission, schema } }.
     * available=true only when every availability_factor passes.
     */
    availability: function (capabilityId) {
      const cap = this.get(capabilityId);
      if (!cap) {
        _auditEntry(capabilityId, 'unknown', 'not-in-manifest');
        return { available: false, reason: 'unknown-capability', checks: {} };
      }

      const factors = cap.availability_factors || [];
      const checks = {};
      let available = true;
      let reason = 'ok';

      if (factors.indexOf('service_health') !== -1) {
        checks.service = (cap.depends_on || []).every(function (svc) { return _serviceUp(svc); });
        if (!checks.service) { available = false; reason = 'service-down'; }
      }
      if (factors.indexOf('permission') !== -1) {
        checks.permission = _permissionGranted(cap.required_permissions);
        if (!checks.permission) { available = false; reason = 'permission-denied'; }
      }
      if (factors.indexOf('schema_compatibility') !== -1) {
        checks.schema = _schemaCompatible(cap);
        if (!checks.schema) { available = false; reason = 'schema-incompatible'; }
      }
      if (factors.indexOf('downstream_dependencies') !== -1) {
        checks.downstream = (cap.depends_on || []).every(function (svc) { return _serviceUp(svc); });
        if (!checks.downstream) { available = false; reason = 'dependency-down'; }
      }

      _auditEntry(capabilityId, available ? 'available' : reason, reason);
      return { available: available, reason: reason, checks: checks };
    },

    /** Convenience: availability of every manifest capability. */
    availabilityAll: function () {
      return (this.list() || []).reduce(function (acc, id) {
        acc[id] = this.availability(id);
        return acc;
      }.bind(this), {});
    },

    /** Convenience boolean. */
    isAvailable: function (capabilityId) {
      return this.availability(capabilityId).available;
    },

    /** Register an optional schema-compatibility check for a capability. */
    registerSchemaCheck: function (capabilityId, fn) {
      const cap = this.get(capabilityId);
      if (cap && typeof fn === 'function') cap._schemaCheck = fn;
    },

    /** Recent availability audit trail. */
    audit: function () { return _audit.slice(); },
  };

  // Legacy alias, consistent with api-client.js pattern.
  window.LA8159Capabilities = window.OliviaCapabilities;

  console.log('[OliviaCapabilities] loaded — availability derived, not raw health');
})();
