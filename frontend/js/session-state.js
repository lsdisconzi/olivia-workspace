/* ═══════════════════════════════════════════════════════════════════
  SESSION STATE  —  olivia/js/session-state.js
   Transient session/run state (reset per session or per run).
   Part of the Phase 4.2 config.js split (D-007): static config stays
   in config.js; application state lives in app-state.js.
   Load order: immediately after config.js + app-state.js, before
   api-client.js and all feature modules. Top-level `let` bindings live
   in the shared global lexical scope, so bare identifiers in other
   classic scripts resolve exactly as they did when these lived in
   config.js.
   ═══════════════════════════════════════════════════════════════════ */

let chatHistory = [];
let activeStream = null;
let activeGuidanceBar = null;
let currentRunId = null;
let stepCount = 0;
let outputArtifacts = [];
let sessionTokensIn = 0, sessionTokensOut = 0, sessionCostUsd = 0;
let runTokensIn = 0, runTokensOut = 0;
let _pendingThinkingContent = '';
let _lastToolCalls = {};   // runId → last .log-tool-call element (for result pairing)

console.log('[SessionState] loaded — chatHistory, activeStream, currentRunId, tokens (transient)');
