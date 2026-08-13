/* ═══════════════════════════════════════════════════════════════════
  CONTEXT CLIENT  —  olivia/js/lib/context-client.js
   Browser half of the Context Resolution pipeline (EXECUTION_MODEL §Context
   Resolution; CONTEXT_MANAGER_CONTRACT.md). Unifies the observed context
   sources without forking their storage:
     _contextSessionFiles, _checkedDocs, _importedFiles, _checkedShared,
     probe.panel_context (stream.js), _ctxConfig (context-config.js).
   Methods: getActive(), add(), remove(), clear(), preview(), resolve().
   Load order: after config.js + api-client.js, before feature modules.
   ═══════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const API_BASE = (window.API_BASE !== undefined)
    ? String(window.API_BASE).replace(/\/$/, '')
    : window.location.origin;

  // Live read of a module-level Set (sets are NOT forked here).
  function _readSet(name) {
    try {
      const v = window[name];
      if (v && typeof v.size === 'number' && typeof v.forEach === 'function') {
        return Array.from(v).map(function (x) {
          return (typeof x === 'string') ? x : (x && x.name ? x.name : String(x));
        });
      }
    } catch (_e) { }
    return [];
  }

  function _readPanelContext() {
    try {
      const probe = window.orchestrationProbe || null;
      const pc = probe && probe.panel_context ? probe.panel_context : null;
      if (pc) {
        return {
          selected_labels: Array.isArray(pc.selected_labels) ? pc.selected_labels : [],
          available_count: Number(pc.available_count) || 0,
          selected_count: Number(pc.selected_count) || 0,
        };
      }
    } catch (_e) { }
    return { selected_labels: [], available_count: 0, selected_count: 0 };
  }

  function _dispatchUpdated(state) {
    const detail = { detail: state };
    window.dispatchEvent(new CustomEvent('olivia:panel-context-updated', detail));
    window.dispatchEvent(new CustomEvent('LA8159:panel-context-updated', detail));
  }

  function _nextState(kind) {
    const s = {
      files: _readSet('_contextSessionFiles'),
      docs: _readSet('_checkedDocs'),
      shared: _readSet('_checkedShared'),
      imported: _readSet('_importedFiles'),
      panel: _readPanelContext(),
      labels: [],
    };
    // Flatten selected labels for consumers that want a plain list.
    (s.panel.selected_labels || []).forEach(function (l) {
      if (kind === 'all' || kind === 'labels') s.labels.push(l);
    });
    return s;
  }

  // ── Public interface ─────────────────────────────────────────────
  window.OliviaContext = {
    /** Snapshot of current context sources (never caches). */
    getActive: function () { return _nextState('all'); },

    /** Add item(s) to a source. kind: 'files'|'docs'|'shared'|'imported'. */
    add: function (kind, items) {
      const list = Array.isArray(items) ? items : [items];
      const target = window['_' + (
        kind === 'files' ? 'contextSessionFiles'
        : kind === 'docs' ? 'checkedDocs'
        : kind === 'shared' ? 'checkedShared'
        : kind === 'imported' ? 'importedFiles'
        : 'contextSessionFiles'
      )];
      if (target && typeof target.add === 'function') {
        list.forEach(function (it) {
          target.add(typeof it === 'string' ? it : (it && (it.name || it.path || JSON.stringify(it))));
        });
      }
      const state = _nextState(kind);
      _dispatchUpdated(state);
      return state[kind] ? state[kind].length : 0;
    },

    /** Remove one item from a source. Returns true if present+removed. */
    remove: function (kind, item) {
      const key = kind === 'files' ? '_contextSessionFiles'
        : kind === 'docs' ? '_checkedDocs'
        : kind === 'shared' ? '_checkedShared'
        : kind === 'imported' ? '_importedFiles' : null;
      const target = key ? window[key] : null;
      let removed = false;
      if (target && typeof target.delete === 'function') {
        // Normalize exactly like add() so object-shaped items match stored keys.
        const normalized = typeof item === 'string'
          ? item
          : (item && (item.name || item.path || JSON.stringify(item)));
        removed = target.delete(normalized); // true only if the item was present
      }
      _dispatchUpdated(_nextState(kind));
      return removed;
    },

    /** Clear one source ('files'|'docs'|'shared'|'imported') or all. */
    clear: function (kind) {
      const keys = kind
        ? [kind === 'files' ? '_contextSessionFiles'
            : kind === 'docs' ? '_checkedDocs'
            : kind === 'shared' ? '_checkedShared'
            : kind === 'imported' ? '_importedFiles' : null]
        : ['_contextSessionFiles', '_checkedDocs', '_checkedShared', '_importedFiles'];
      keys.forEach(function (k) {
        if (k && window[k] && typeof window[k].clear === 'function') window[k].clear();
      });
      _dispatchUpdated(_nextState(kind));
    },

    /** Render a preview of the active context (server when run_id exists). */
    preview: function () {
      const runId = window.currentRunId || (window.orchestrationProbe && window.orchestrationProbe.run_id);
      if (runId) {
        return fetch(API_BASE + '/api/assistant/context-preview?run_id=' + encodeURIComponent(runId))
          .then(function (res) { return res.ok ? res.text() : null; })
          .catch(function () { return null; });
      }
      const s = _nextState('all');
      const parts = [];
      if (s.files.length) parts.push('files: ' + s.files.join(', '));
      if (s.docs.length) parts.push('docs: ' + s.docs.join(', '));
      if (s.shared.length) parts.push('shared: ' + s.shared.join(', '));
      if (s.imported.length) parts.push('imported: ' + s.imported.join(', '));
      if (s.labels.length) parts.push('labels: ' + s.labels.join(', '));
      return Promise.resolve(parts.length ? parts.join('\n') : '(no active context)');
    },

    /** Build the resolved context payload sent to stream.js (see contract §3.3). */
    resolve: function () {
      const s = _nextState('all');
      return {
        files: s.files,
        docs: s.docs,
        shared: s.shared,
        imported: s.imported,
        panel: s.panel,
        labels: s.labels,
      };
    },
  };

  // Legacy alias, consistent with api-client.js pattern.
  window.LA8159Context = window.OliviaContext;

  console.log('[OliviaContext] loaded — context client (additive, reads live module state)');
})();
