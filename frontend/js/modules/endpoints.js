/* ═══════════════════════════════════════════════════════════════════
   ENDPOINTS WIDGET MODULE - Sidebar endpoint quick access
   ═══════════════════════════════════════════════════════════════════ */

function _getGatewayBaseForEndpoints() {
  if (window.LA8159 && window.OliviaLegal.gateway && window.OliviaLegal.gateway.base) {
    return String(window.OliviaLegal.gateway.base).replace(/\/$/, '');
  }

  if (window.OliviaLegal_BASE_URLS && window.OliviaLegal_BASE_URLS.gateway) {
    return String(window.OliviaLegal_BASE_URLS.gateway).replace(/\/$/, '');
  }

  return window.location.origin;
}

function _getApiBaseForEndpoints() {
  if (typeof API_BASE !== 'undefined' && API_BASE) {
    return String(API_BASE).replace(/\/$/, '');
  }
  const host = String(window.location.hostname || '').toLowerCase();
  if (host === 'LA8159-ai.com.br' || host === 'www.LA8159-ai.com.br') {
    return window.location.origin.replace(/\/$/, '') + '/api/olivialegal';
  }
  return _getGatewayBaseForEndpoints();
}

function _resolveEndpointUrl(path) {
  const base = _getApiBaseForEndpoints();
  if (!path) return base;
  if (/^https?:\/\//i.test(path)) return path;
  return `${base}${path.startsWith('/') ? '' : '/'}${path}`;
}

function _renderSelectedEndpointPath() {
  const select = document.getElementById('endpointsWidgetSelect');
  const out = document.getElementById('endpointsWidgetPath');
  if (!select || !out) return;

  const path = select.value || '';
  if (!path) {
    out.textContent = '';
    return;
  }

  const label = select.options[select.selectedIndex] ? select.options[select.selectedIndex].textContent : path;
  out.textContent = label;
}

function initEndpointsWidget() {
  const select = document.getElementById('endpointsWidgetSelect');
  if (!select) return;

  const entries = Array.isArray(window.OliviaLegal_ENDPOINTS) ? window.OliviaLegal_ENDPOINTS : [];

  select.innerHTML = '';
  if (!entries.length) {
    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = 'Nenhum endpoint configurado';
    select.appendChild(empty);
    _renderSelectedEndpointPath();
    return;
  }

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Selecionar endpoint...';
  select.appendChild(placeholder);

  entries.forEach((entry) => {
    const option = document.createElement('option');
    option.value = entry.p || '';
    const summary = entry.s || entry.d || entry.p || '';
    option.textContent = `[${entry.m || 'GET'}] ${summary}`;
    option.dataset.path = entry.p || '';
    option.dataset.tag = entry.t || '';
    select.appendChild(option);
  });

  select.addEventListener('change', _renderSelectedEndpointPath);
  _renderSelectedEndpointPath();
}

function openSelectedEndpoint() {
  const select = document.getElementById('endpointsWidgetSelect');
  if (!select || !select.value) {
    if (typeof addSystemBubble === 'function') addSystemBubble('Selecione um endpoint primeiro.');
    return;
  }

  const url = _resolveEndpointUrl(select.value);
  window.open(url, '_blank', 'noopener');
}

async function copySelectedEndpoint() {
  const select = document.getElementById('endpointsWidgetSelect');
  if (!select || !select.value) {
    if (typeof addSystemBubble === 'function') addSystemBubble('Selecione um endpoint primeiro.');
    return;
  }

  const url = _resolveEndpointUrl(select.value);
  try {
    await navigator.clipboard.writeText(url);
    if (typeof addSystemBubble === 'function') addSystemBubble('URL do endpoint copiada.');
  } catch (err) {
    if (typeof addSystemBubble === 'function') addSystemBubble('Não foi possível copiar a URL do endpoint.');
  }
}

// Toggle the LA8159EndpointWidget panel (called from static HTML markup)
window.epToggle = function() {
  if (window.LA8159EndpointWidget && typeof LA8159EndpointWidget.toggle === 'function') {
    LA8159EndpointWidget.toggle();
  } else {
    // Widget not loaded yet — fall back to toggling the panel directly
    var panel   = document.getElementById('epPanel');
    var overlay = document.getElementById('epOverlay');
    if (panel)   panel.classList.toggle('open');
    if (overlay) overlay.classList.toggle('open');
  }
};

// Fetch a GET endpoint and display its JSON response in a system bubble
window.previewEndpoint = async function(path) {
  var base = _getApiBaseForEndpoints();
  var normalizedPath = String(path || '');
  if (!normalizedPath.startsWith('/')) normalizedPath = '/' + normalizedPath;
  var url = base + normalizedPath;
  if (typeof addSystemBubble === 'function') addSystemBubble('\u23f3 Chamando: ' + url);
  try {
    var res = await fetch(url);
    var text = await res.text();
    var display;
    try {
      display = JSON.stringify(JSON.parse(text), null, 2);
    } catch (_) {
      display = text;
    }
    if (typeof addSystemBubble === 'function') {
      addSystemBubble('<pre style="font-size:11px;white-space:pre-wrap;max-height:200px;overflow:auto">' + escapeHtml(display.slice(0, 2000)) + '</pre>');
    }
  } catch (e) {
    if (typeof addSystemBubble === 'function') addSystemBubble('\u274c Erro ao chamar endpoint: ' + escapeHtml(e.message));
  }
};

// Toggle an endpoint's response as injected context in the next prompt
var _endpointContextSet = new Set();
window.toggleEndpointContext = async function(checkbox) {
  var endpoint = checkbox.dataset.endpoint;
  var method   = (checkbox.dataset.method || 'GET').toUpperCase();
  if (!endpoint) return;

  if (!checkbox.checked) {
    _endpointContextSet.delete(endpoint);
    if (typeof updateComposeContextBar === 'function') updateComposeContextBar();
    return;
  }

  if (method !== 'GET') {
    if (typeof addSystemBubble === 'function') addSystemBubble('Só endpoints GET podem ser adicionados ao contexto automaticamente.');
    checkbox.checked = false;
    return;
  }

  var base = _getApiBaseForEndpoints();
  var url = base + endpoint;

  try {
    var res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var text = await res.text();
    _endpointContextSet.add(endpoint);

    // Inject into _importedFiles so it is sent along with the next message
    if (typeof _importedFiles !== 'undefined') {
      _importedFiles.set('[Endpoint] ' + endpoint, {
        name: '[Endpoint] ' + endpoint,
        content: text,
        size: new Blob([text]).size
      });
      if (typeof updateComposeContextBar === 'function') updateComposeContextBar();
      if (typeof addSystemBubble === 'function') addSystemBubble('\u2705 Endpoint adicionado ao contexto: ' + endpoint);
    }
  } catch (e) {
    checkbox.checked = false;
    _endpointContextSet.delete(endpoint);
    if (typeof addSystemBubble === 'function') addSystemBubble('\u274c Falha ao incluir endpoint no contexto: ' + escapeHtml(e.message));
  }
};

window.initEndpointsWidget = initEndpointsWidget;
window.openSelectedEndpoint = openSelectedEndpoint;
window.copySelectedEndpoint = copySelectedEndpoint;

document.addEventListener('DOMContentLoaded', initEndpointsWidget);
