/* ═══════════════════════════════════════════════════════════════════
  AURA UNIFIED WORKSPACE
  ═══════════════════════════════════════════════════════════════════ */

// API base — all calls go to the same origin that serves this page.
// In LA8159-standalone, serve.py handles both static files and /api/* routes.
const _RUNTIME_NAMESPACE = (() => {
  const la = (window.LA8159 && typeof window.LA8159 === 'object') ? window.LA8159 : {};
  const ol = (window.OliviaLegal && typeof window.OliviaLegal === 'object') ? window.OliviaLegal : {};
  const merged = Object.assign({}, la, ol);
  window.LA8159 = merged;
  window.OliviaLegal = merged;
  return merged;
})();

const _GATEWAY_ORIGIN = (_RUNTIME_NAMESPACE.gateway && _RUNTIME_NAMESPACE.gateway.base)
  ? String(_RUNTIME_NAMESPACE.gateway.base).replace(/\/$/, '')
  : window.location.origin;

function _isPrivateHost(hostname) {
  if (!hostname) return false;
  var h = String(hostname).toLowerCase();
  if (h === 'localhost' || h === '127.0.0.1' || h === '::1' || h.endsWith('.local')) return true;
  if (/^10\./.test(h)) return true;
  if (/^192\.168\./.test(h)) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(h)) return true;
  if (/^127\./.test(h)) return true;
  return false;
}

function _sanitizeApiBase(candidate, fallback) {
  if (!candidate) return fallback;
  var isLocalPage = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  var isSecurePage = (window.location.protocol === 'https:' || window.isSecureContext);
  if (isLocalPage || !isSecurePage) return candidate;
  try {
    var u = new URL(candidate, window.location.origin);
    if (u.protocol === 'http:' && _isPrivateHost(u.hostname)) return fallback;
    return u.toString().replace(/\/$/, '');
  } catch (e) {
    return fallback;
  }
}

function _isPublicLA8159Host() {
  var h = String(window.location.hostname || '').toLowerCase();
  return h === 'LA8159-ai.com.br' || h === 'www.LA8159-ai.com.br';
}

let _resolvedApiBase = _isPublicLA8159Host()
  ? (window.location.origin.replace(/\/$/, '') + '/api/olivialegal')
  : _sanitizeApiBase(_GATEWAY_ORIGIN, _GATEWAY_ORIGIN);
const API_BASE = _resolvedApiBase;
const API = API_BASE + '/api';
let agents = [];
let selectedAgent = null;
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