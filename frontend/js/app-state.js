/* ═══════════════════════════════════════════════════════════════════
  APP STATE  —  olivia/js/app-state.js
   Application-level state (survives across chat runs within the page).
   Part of the Phase 4.2 config.js split (D-007): static config stays
   in config.js; transient session state lives in session-state.js.
   Load order: immediately after config.js, before api-client.js and
   all feature modules. Top-level `let` bindings live in the shared
   global lexical scope, so bare identifiers in other classic scripts
   resolve exactly as they did when these lived in config.js.
   ═══════════════════════════════════════════════════════════════════ */

let agents = [];
let selectedAgent = null;

// Keep legacy window.* access synchronized with top-level state variables.
if (!Object.getOwnPropertyDescriptor(window, 'agents')) {
  Object.defineProperty(window, 'agents', {
    get: function () { return agents; },
    set: function (value) {
      agents = Array.isArray(value) ? value : [];
    },
    configurable: true,
  });
}

if (!Object.getOwnPropertyDescriptor(window, 'selectedAgent')) {
  Object.defineProperty(window, 'selectedAgent', {
    get: function () { return selectedAgent; },
    set: function (value) {
      selectedAgent = value || null;
    },
    configurable: true,
  });
}

console.log('[AppState] loaded — agents, selectedAgent (application state)');
