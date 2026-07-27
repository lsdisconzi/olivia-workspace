/**
 * LA8159-AI Endpoint Widget
 * Reusable endpoint configuration & traffic intelligence component
 * Version 2.0 · March 2026
 * 
 * Canonical location: gateway/static/css|js/
 * Served at: http://<gateway-host>:8183/gateway/css/endpoint-widget.css
 *            http://<gateway-host>:8183/gateway/js/endpoint-widget.js
 *
 * Usage (any page):
 *   <link rel="stylesheet" href="/gateway/css/endpoint-widget.css">
 *   <script src="/gateway/js/endpoint-widget.js"></script>
 *   <script>
 *     LA8159EndpointWidget.init({
 *       storageKey: 'my-app.endpoints',
 *       gatewayUrl: 'http://localhost:8183',  // gateway base URL
 *       aiEndpoint: '/api/assistant/chat',    // LLM chat endpoint (optional)
 *       trafficCapture: true,                 // intercept all fetch/XHR
 *       aiEnabled: true
 *     });
 *   </script>
 *
 * The AI assistant automatically receives:
 *   - Live traffic log (all fetch/XHR calls the page makes)
 *   - Hit map (which endpoints were called, how many times)
 *   - Error summary (4xx/5xx calls)
 *   - Full endpoint catalog (from Olivia_ENDPOINTS or gateway catalog)
 *   - Page URL + title for context
 */

(function () {
  'use strict';

  /* ═══════════════════════════════════════════════════════════════════
     CORE STATE
     ═══════════════════════════════════════════════════════════════════ */
  var config = {
    storageKey: 'OliviaLegal.endpoints',
    trafficKey: 'OliviaLegal.endpoints.traffic',
    gatewayUrl: null,
    aiEndpoint: null,       // LLM chat endpoint — auto-detected if null
    aiModel: 'deepseek-v4-flash', // model for chat responses
    trafficCapture: true,
    aiEnabled: true,
    autoFetchCatalog: true
  };

  var state = {
    endpoints: [],
    groups: {},
    groupOrder: [],
    traffic: [],
    hitMap: {},
    saved: {},
    recording: true,
    totalHits: 0,
    totalErrors: 0,
    initialized: false,
    aiStreaming: false,
    chatHistory: [],          // [{role, content}] for multi-turn context
    _ownRequests: new Set(),  // widget's own fetch URLs — excluded from traffic display
    _panelCtxListenerBound: false
  };

  /* ═══════════════════════════════════════════════════════════════════
     PUBLIC API
     ═══════════════════════════════════════════════════════════════════ */
  window.LA8159EndpointWidget = {
    /**
     * Initialize the widget
     * @param {Object} options - Configuration options
     */
    init: function (options) {
      if (state.initialized) return;

      Object.assign(config, options || {});

      // Load saved config
      try {
        state.saved = JSON.parse(localStorage.getItem(config.storageKey) || '{}');
      } catch (e) {
        state.saved = {};
      }

      // Load endpoints from window.Olivia_ENDPOINTS or fetch from gateway
      if (window.Olivia_ENDPOINTS && window.Olivia_ENDPOINTS.length > 0) {
        processEndpoints(window.Olivia_ENDPOINTS);
      } else if (config.autoFetchCatalog && config.gatewayUrl) {
        fetchCatalog();
      }

      // Inject UI
      injectHTML();

      if (!state._panelCtxListenerBound) {
        window.addEventListener('LA8159:panel-context-updated', _updatePanelContextIndicator);
        state._panelCtxListenerBound = true;
      }
      _updatePanelContextIndicator();

      // Always keep a clean fetch reference for the widget's own AI calls
      if (!window._epOrigFetch) window._epOrigFetch = window.fetch;

      // Setup traffic monitoring
      if (config.trafficCapture) {
        patchFetch();
        patchXHR();
      }

      // Keep an unpatched reference to fetch for widget's own calls
      window._epOrigFetch = window.fetch;

      state.initialized = true;
    },

    /**
     * Toggle the widget panel
     */
    toggle: function () {
      var panel = document.getElementById('epPanel');
      var overlay = document.getElementById('epOverlay');
      if (!panel || !overlay) return;

      var isOpen = panel.classList.contains('open');
      panel.classList.toggle('open');
      overlay.classList.toggle('open');

      if (!isOpen) {
        render();
        _updatePanelContextIndicator();
      }
    },

    /**
     * Get current endpoints
     */
    getEndpoints: function () {
      return state.endpoints;
    },

    /**
     * Get traffic log
     */
    getTraffic: function () {
      return state.traffic;
    },

    /**
     * Check if endpoint is enabled
     */
    isEnabled: function (method, path) {
      var key = method.toUpperCase() + ' ' + path;
      var ep = state.endpoints.find(function (e) { return e.key === key; });
      return ep ? ep.enabled !== false : true;
    },

    /**
     * Get resolved URL for endpoint key
     */
    getUrl: function (key) {
      var val = state.saved[key];
      if (!val) {
        // Try to find in endpoints
        var parts = key.split('.');
        if (parts[0] === 'base') return '';
        // Find endpoint by key pattern
        for (var i = 0; i < state.endpoints.length; i++) {
          if (state.endpoints[i].configKey === key) {
            return state.endpoints[i].path;
          }
        }
      }
      return val || '';
    },

    /**
     * Set endpoint configuration
     */
    setEndpoint: function (key, value) {
      state.saved[key] = value;
      localStorage.setItem(config.storageKey, JSON.stringify(state.saved));
      var input = document.getElementById('ep-' + key);
      if (input) {
        input.value = value;
        input.classList.add('modified');
      }
    },

    /**
     * Save configuration
     */
    save: function () {
      collectConfig();
      toast('Configuration saved — reloading…');
      setTimeout(function () { location.reload(); }, 600);
    },

    /**
     * Reset configuration
     */
    reset: function () {
      localStorage.removeItem(config.storageKey);
      toast('Configuration reset — reloading…');
      setTimeout(function () { location.reload(); }, 600);
    }
  };

  /* ═══════════════════════════════════════════════════════════════════
     ENDPOINT PROCESSING
     ═══════════════════════════════════════════════════════════════════ */
  function processEndpoints(rawEndpoints) {
    state.endpoints = [];
    state.groups = {};
    state.groupOrder = [];
    var seen = {};

    rawEndpoints.forEach(function (ep, idx) {
      var processed = {
        id: idx,
        key: ep.m + ' ' + ep.p,
        path: ep.p,
        method: ep.m,
        tag: ep.t || 'Other',
        summary: ep.s || '',
        description: ep.d || '',
        configKey: ep.configKey || null,
        enabled: true
      };

      state.endpoints.push(processed);

      // Group by tag
      if (!seen[processed.tag]) {
        seen[processed.tag] = true;
        state.groupOrder.push(processed.tag);
        state.groups[processed.tag] = [];
      }
      state.groups[processed.tag].push(processed);
    });
  }

  function fetchCatalog() {
    var url = config.gatewayUrl + '/gateway/gateway-routes.json';
    state._ownRequests.add(url); // don't show catalog fetch in traffic log
    fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data.services) return;
        var rawEndpoints = [];
        data.services.forEach(function (svc) {
          var endpoints = svc.endpoints || {};
          Object.keys(endpoints).forEach(function (key) {
            var ep = endpoints[key];
            rawEndpoints.push({
              p: ep.path,
              m: (ep.method || 'GET').toUpperCase(),
              t: svc.name,
              s: ep.summary || '',
              d: ep.description || ''
            });
          });
        });
        processEndpoints(rawEndpoints);
        render();
      })
      .catch(function (err) {
        console.warn('[Endpoint Widget] Failed to fetch catalog:', err);
      });
  }

  /* ═══════════════════════════════════════════════════════════════════
     HTML INJECTION
     ═══════════════════════════════════════════════════════════════════ */
  function injectHTML() {
    var html = '';

    // Gear button
    html += '<button class="ep-gear" onclick="LA8159EndpointWidget.toggle()" title="Endpoint Configuration">';
    html += '<i class="fas fa-cog"></i>';
    html += '</button>';

    // Overlay
    html += '<div class="ep-overlay" id="epOverlay" onclick="LA8159EndpointWidget.toggle()"></div>';

    // Panel
    html += '<div class="ep-panel" id="epPanel">';

    // Header
    html += '<div class="ep-header">';
    html += '<div class="ep-header-top">';
    html += '<div class="ep-header-title"><i class="fas fa-cog"></i> Endpoint Configuration</div>';
    html += '<button class="ep-close" onclick="LA8159EndpointWidget.toggle()"><i class="fas fa-times"></i></button>';
    html += '</div>';
    html += '<input type="text" class="ep-search" id="epSearch" name="epSearch" placeholder="Filter endpoints…" oninput="epFilter(this.value)">';
    html += '</div>';

    // Tabs
    html += '<div class="ep-tabs">';
    html += '<button class="ep-tab active" data-view="catalog" onclick="epSwitchTab(\'catalog\')"><i class="fas fa-list"></i> Catalog</button>';
    if (config.trafficCapture) {
      html += '<button class="ep-tab" data-view="traffic" onclick="epSwitchTab(\'traffic\')"><i class="fas fa-wave-square"></i> Traffic</button>';
    }
    if (config.aiEnabled) {
      html += '<button class="ep-tab" data-view="ai" onclick="epSwitchTab(\'ai\')"><i class="fas fa-robot"></i> AI Assistant</button>';
    }
    html += '</div>';

    // Views
    html += '<div class="ep-views">';

    // Catalog View
    html += '<div class="ep-view active" id="epViewCatalog"><div id="epBody"></div></div>';

    // Traffic View
    if (config.trafficCapture) {
      html += '<div class="ep-view" id="epViewTraffic">';
      html += '<div class="ep-traffic-controls">';
      html += '<div class="recording" id="recIndicator"><div class="dot"></div><span>Recording</span></div>';
      html += '<button onclick="epToggleRecording()" id="recToggle"><i class="fas fa-pause"></i> Pause</button>';
      html += '<button onclick="epClearTraffic()"><i class="fas fa-trash"></i> Clear</button>';
      html += '<span style="flex:1"></span>';
      html += '<span id="trafficTotal">0 requests</span>';
      html += '</div>';
      html += '<div class="ep-traffic" id="epTraffic">';
      html += '<div class="ep-traffic-empty"><i class="fas fa-wave-square"></i><span>No traffic captured yet</span></div>';
      html += '</div>';
      html += '</div>';
    }

    // AI View
    if (config.aiEnabled) {
      html += '<div class="ep-view" id="epViewAi">';
      html += '<div class="ep-panel-context" id="epPanelContextIndicator">Contexto de paineis: 0/0</div>';
      html += '<div class="ep-chat-log" id="epChatLog">';
      html += '<div class="ep-chat-msg system">';
      html += '<i class="fas fa-robot"></i> Endpoint assistant ready. Ask me about your API configuration.';
      html += '</div>';
      html += '</div>';
      html += '<div class="ep-chat-input-area">';
      html += '<textarea class="ep-chat-textarea" id="epChatInput" name="epChatInput" rows="1" placeholder="Ask about endpoints…" ';
      html += 'onkeydown="if(event.key===\'Enter\'&&!event.shiftKey){event.preventDefault();epChatSend()}"></textarea>';
      html += '<button class="ep-chat-send" onclick="epChatSend()" id="epChatSendBtn"><i class="fas fa-paper-plane"></i></button>';
      html += '</div>';
      html += '</div>';
    }

    html += '</div>'; // end views

    // Footer
    html += '<div class="ep-footer">';
    html += '<div class="ep-footer-info" id="epModCount">defaults</div>';
    html += '<div style="display:flex;gap:8px">';
    html += '<button onclick="LA8159EndpointWidget.reset()">Reset All</button>';
    html += '<button class="primary" onclick="LA8159EndpointWidget.save()">Save & Reload</button>';
    html += '</div>';
    html += '</div>';

    html += '</div>'; // end panel

    // Toast
    html += '<div class="ep-toast" id="epToast"></div>';

    // Inject
    var container = document.createElement('div');
    container.id = 'LA8159EndpointWidget';
    container.innerHTML = html;
    document.body.appendChild(container);
  }

  /* ═══════════════════════════════════════════════════════════════════
     RENDERING
     ═══════════════════════════════════════════════════════════════════ */
  function render() {
    var body = document.getElementById('epBody');
    if (!body) return;

    var html = '';
    state.groupOrder.forEach(function (tag) {
      var eps = state.groups[tag] || [];
      if (eps.length === 0) return;

      html += '<div class="ep-group" id="epg-' + sanitizeId(tag) + '">';
      html += '<div class="ep-group-header" onclick="epToggleGroup(\'' + sanitizeId(tag) + '\')">';
      html += '<span><i class="fas fa-folder" style="color:var(--ep-amber);margin-right:8px"></i>' + escapeHtml(tag) + '</span>';
      html += '<span><span class="ep-group-count">' + eps.length + '</span> <i class="fas fa-chevron-right ep-group-chevron"></i></span>';
      html += '</div>';
      html += '<div class="ep-group-body">';

      eps.forEach(function (ep) {
        html += '<div class="ep-row" data-key="' + escapeHtml(ep.key) + '" data-tag="' + escapeHtml(tag) + '">';
        html += '<div class="ep-row-label">';
        html += '<span class="ep-method ' + ep.method.toLowerCase() + '">' + ep.method + '</span>';
        html += escapeHtml(ep.summary || ep.path);
        if (state.hitMap[ep.key]) {
          html += '<span class="ep-hit-count visible" data-key="' + escapeHtml(ep.key) + '">' + state.hitMap[ep.key] + '</span>';
        }
        html += '</div>';
        html += '<div class="ep-input-wrap">';
        html += '<input class="ep-input" type="text" name="ep-path-' + sanitizeId(ep.key) + '" value="' + escapeHtml(ep.path) + '" readonly>';
        html += '</div>';
        if (ep.description) {
          html += '<div style="font-size:10px;color:var(--ep-text-dim);margin-top:-4px">' + escapeHtml(ep.description.substring(0, 100)) + '</div>';
        }
        html += '</div>';
      });

      html += '</div></div>';
    });

    body.innerHTML = html;
    updateModCount();
  }

  function collectConfig() {
    var newConfig = {};
    document.querySelectorAll('.ep-input').forEach(function (input) {
      var row = input.closest('.ep-row');
      if (!row) return;
      var key = row.dataset.key;
      var val = input.value.trim();
      if (val && key) newConfig[key] = val;
    });
    state.saved = newConfig;
    localStorage.setItem(config.storageKey, JSON.stringify(newConfig));
  }

  function updateModCount() {
    var count = Object.keys(state.saved).length;
    var el = document.getElementById('epModCount');
    if (el) el.textContent = count ? count + ' modified' : 'defaults';
  }

  /* ═══════════════════════════════════════════════════════════════════
     UI INTERACTIONS
     ═══════════════════════════════════════════════════════════════════ */
  window.epToggleGroup = function (id) {
    var el = document.getElementById('epg-' + id);
    if (el) el.classList.toggle('open');
  };

  window.epFilter = function (query) {
    query = (query || '').toLowerCase();
    document.querySelectorAll('.ep-row').forEach(function (row) {
      var key = (row.dataset.key || '').toLowerCase();
      var text = row.textContent.toLowerCase();
      var match = !query || key.indexOf(query) !== -1 || text.indexOf(query) !== -1;
      row.classList.toggle('hidden', !match);
    });

    // Auto-open groups with visible rows
    document.querySelectorAll('.ep-group').forEach(function (g) {
      var visible = g.querySelectorAll('.ep-row:not(.hidden)').length;
      if (query && visible > 0) g.classList.add('open');
    });
  };

  window.epSwitchTab = function (view) {
    document.querySelectorAll('.ep-tab').forEach(function (t) {
      t.classList.toggle('active', t.dataset.view === view);
    });
    document.querySelectorAll('.ep-view').forEach(function (v) {
      v.classList.toggle('active', v.id === 'epView' + capitalize(view));
    });
    if (view === 'ai') _updatePanelContextIndicator();
  };

  window.epToggleRecording = function () {
    state.recording = !state.recording;
    var btn = document.getElementById('recToggle');
    var ind = document.getElementById('recIndicator');
    if (btn) btn.innerHTML = state.recording ? '<i class="fas fa-pause"></i> Pause' : '<i class="fas fa-play"></i> Resume';
    if (ind) ind.classList.toggle('paused', !state.recording);
  };

  window.epClearTraffic = function () {
    state.traffic = [];
    state.hitMap = {};
    state.totalHits = 0;
    state.totalErrors = 0;
    var container = document.getElementById('epTraffic');
    if (container) {
      container.innerHTML = '<div class="ep-traffic-empty"><i class="fas fa-wave-square"></i><span>No traffic captured yet</span></div>';
    }
    document.querySelectorAll('.ep-hit-count').forEach(function (el) {
      el.classList.remove('visible');
    });
    updateTrafficCount();
  };

  /* ═══════════════════════════════════════════════════════════════════
     TRAFFIC MONITORING
     ═══════════════════════════════════════════════════════════════════ */
  // Returns true if this URL should be included in traffic capture.
  // Filters out: widget own requests, browser internals, non-HTTP.
  function shouldCaptureUrl(url) {
    var s = String(url);
    if (!s.startsWith('http') && !s.startsWith('/')) return false;
    if (s.startsWith('chrome-extension://') || s.startsWith('data:') || s.startsWith('blob:')) return false;
    if (state._ownRequests.has(s)) return false;
    // Also skip if matches a configured aiEndpoint
    var aiEp = config.aiEndpoint || _detectAiEndpoint();
    if (s.indexOf(aiEp) !== -1) return false;
    return true;
  }

  function patchFetch() {
    var origFetch = window.fetch;
    window._epOrigFetch = origFetch; // keep clean reference for widget own calls
    window.fetch = function () {
      var url = arguments[0];
      var options = arguments[1] || {};
      var method = (options.method || 'GET').toUpperCase();
      var startTime = Date.now();

      var entry = {
        method: method,
        url: String(url),
        status: '...',
        duration: 0,
        time: new Date(),
        matched: null
      };

      if (state.recording && shouldCaptureUrl(url)) addTrafficEntry(entry);

      return origFetch.apply(this, arguments).then(function (response) {
        entry.status = response.status;
        entry.duration = Date.now() - startTime;
        matchEndpoint(entry);
        updateTrafficEntry(entry);
        return response;
      }).catch(function (err) {
        entry.status = 'ERR';
        entry.duration = Date.now() - startTime;
        state.totalErrors++;
        matchEndpoint(entry);
        updateTrafficEntry(entry);
        throw err;
      });
    };
  }

  function patchXHR() {
    var origOpen = XMLHttpRequest.prototype.open;
    var origSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url) {
      this._epMethod = (method || 'GET').toUpperCase();
      this._epUrl = url;
      return origOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function () {
      var xhr = this;
      var startTime = Date.now();
      var entry = {
        method: xhr._epMethod,
        url: String(xhr._epUrl),
        status: '...',
        duration: 0,
        time: new Date(),
        matched: null
      };

      if (state.recording && shouldCaptureUrl(xhr._epUrl)) addTrafficEntry(entry);

      xhr.addEventListener('loadend', function () {
        entry.status = xhr.status || 'ERR';
        entry.duration = Date.now() - startTime;
        if (xhr.status >= 400 || xhr.status === 0) state.totalErrors++;
        matchEndpoint(entry);
        updateTrafficEntry(entry);
      });

      return origSend.apply(this, arguments);
    };
  }

  function addTrafficEntry(entry) {
    state.traffic.unshift(entry);
    if (state.traffic.length > 100) state.traffic.pop();

    var container = document.getElementById('epTraffic');
    if (!container) return;

    // Remove empty message
    var empty = container.querySelector('.ep-traffic-empty');
    if (empty) empty.remove();

    // Add new entry
    var el = document.createElement('div');
    el.className = 'ep-traffic-entry';
    el.innerHTML = formatTrafficEntry(entry);
    container.insertBefore(el, container.firstChild);

    // Keep only last 50 in DOM
    var entries = container.querySelectorAll('.ep-traffic-entry');
    if (entries.length > 50) entries[entries.length - 1].remove();

    updateTrafficCount();
  }

  function updateTrafficEntry(entry) {
    var entries = document.querySelectorAll('.ep-traffic-entry');
    if (entries.length > 0) {
      entries[0].innerHTML = formatTrafficEntry(entry);
    }
    updateTrafficCount();
  }

  function formatTrafficEntry(entry) {
    var statusColor = entry.status === 'ERR' ? 'var(--ep-red)' :
      entry.status >= 400 ? 'var(--ep-red)' :
        entry.status >= 300 ? 'var(--ep-amber)' :
          entry.status >= 200 ? 'var(--ep-green)' : 'var(--ep-text-dim)';

    var time = entry.time.toTimeString().substring(0, 8);
    var method = entry.method;
    var url = entry.url.length > 60 ? '…' + entry.url.substring(entry.url.length - 60) : entry.url;
    var status = entry.status;
    var duration = entry.duration + 'ms';

    return '<span style="color:var(--ep-text-dim)">' + time + '</span>' +
      '<span class="ep-method ' + method.toLowerCase() + '">' + method + '</span>' +
      '<span style="color:var(--ep-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + escapeHtml(entry.url) + '">' + escapeHtml(url) + '</span>' +
      '<span style="color:' + statusColor + ';font-weight:600">' + status + '</span>' +
      '<span style="color:var(--ep-text-dim)">' + duration + '</span>';
  }

  function updateTrafficCount() {
    var el = document.getElementById('trafficTotal');
    if (el) el.textContent = state.traffic.length + ' requests';
  }

  function matchEndpoint(entry) {
    var urlPath = '';
    try {
      var u = new URL(entry.url, location.origin);
      urlPath = u.pathname;
    } catch (e) {
      urlPath = entry.url.split('?')[0];
    }

    // Try exact match first
    var matched = null;
    for (var i = 0; i < state.endpoints.length; i++) {
      var ep = state.endpoints[i];
      if (ep.method !== entry.method) continue;
      if (ep.path === urlPath) {
        matched = ep;
        break;
      }
      // Pattern match for {param} paths
      var pattern = ep.path.replace(/\{[^}]+\}/g, '[^/]+');
      var regex = new RegExp('^' + pattern + '$');
      if (regex.test(urlPath)) {
        matched = ep;
        break;
      }
    }

    if (matched) {
      entry.matched = matched;
      state.hitMap[matched.key] = (state.hitMap[matched.key] || 0) + 1;
      state.totalHits++;

      // Cross-reference with Functions Registry for richer data
      if (window.Olivia_FUNCTIONS && window.Olivia_FUNCTIONS.loaded) {
        var fnMatch = window.Olivia_FUNCTIONS.matchEndpoint(entry.method, urlPath);
        if (fnMatch) {
          entry.functionId = fnMatch.id;
          entry.functionName = fnMatch.name;
          entry.category = fnMatch.category;
        }
      }

      // Flash the row
      var row = document.querySelector('.ep-row[data-key="' + matched.key.replace(/"/g, '\\"') + '"]');
      if (row) {
        row.classList.add('hit', 'hit-recent');
        setTimeout(function () { row.classList.remove('hit-recent'); }, 1500);
      }

      // Update hit badge
      var badge = document.querySelector('.ep-hit-count[data-key="' + matched.key.replace(/"/g, '\\"') + '"]');
      if (badge) {
        badge.textContent = state.hitMap[matched.key];
        badge.classList.add('visible');
      }
    }
  }

  /* ═══════════════════════════════════════════════════════════════════
     AI CHAT — Streaming LLM with live traffic context
     ═══════════════════════════════════════════════════════════════════ */
  window.epChatSend = function () {
    var input = document.getElementById('epChatInput');
    var msg = (input ? input.value : '').trim();
    if (!msg || state.aiStreaming) return;
    input.value = '';
    if (input.style) input.style.height = 'auto';

    state.chatHistory.push({ role: 'user', content: msg });
    addChatMessage('user', escapeHtml(msg));
    _streamAiResponse(msg);
  };

  function addChatMessage(role, html) {
    var log = document.getElementById('epChatLog');
    if (!log) return;
    var div = document.createElement('div');
    div.className = 'ep-chat-msg ' + role;
    div.innerHTML = html;
    var copyBtn = document.createElement('button');
    copyBtn.className = 'ep-chat-copy-btn';
    copyBtn.title = 'Copy to clipboard';
    copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
    copyBtn.onclick = function () {
      var text = div.innerText.replace(/\n$/, '');
      navigator.clipboard.writeText(text).then(function () {
        copyBtn.innerHTML = '<i class="fas fa-check"></i>';
        setTimeout(function () { copyBtn.innerHTML = '<i class="fas fa-copy"></i>'; }, 1500);
      });
    };
    div.appendChild(copyBtn);
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
    return div; // return for streaming updates
  }

  // Detect the best AI endpoint from page config or fall back to origin
  function _detectAiEndpoint() {
    if (config.aiEndpoint) return config.aiEndpoint;
    if (window.LA8159 && window.OliviaLegal.gateway && window.OliviaLegal.gateway.base) {
      return String(window.OliviaLegal.gateway.base).replace(/\/$/, '') + '/api/assistant/chat';
    }
    if (config.gatewayUrl) {
      return config.gatewayUrl.replace(/\/$/, '') + '/api/assistant/chat';
    }
    return window.location.origin + '/api/assistant/chat';
  }

  function _getPanelContextData() {
    if (typeof window.buildSelectedPanelContext === 'function') {
      return window.buildSelectedPanelContext();
    }
    return { text: '', selectedCount: 0, availableCount: 0, snapshots: [] };
  }

  function _updatePanelContextIndicator() {
    var indicator = document.getElementById('epPanelContextIndicator');
    if (!indicator) return;
    var data = _getPanelContextData();
    var activeLabels = (data.snapshots || []).filter(function (s) {
      return s && s.available && s.content;
    }).map(function (s) {
      if (typeof window.formatPanelContextLabel === 'function') {
        return window.formatPanelContextLabel(s.key || s.label);
      }
      return s.label;
    });
    indicator.classList.toggle('is-empty', data.availableCount === 0);
    indicator.textContent = 'Contexto de paineis: ' + data.availableCount + '/' + data.selectedCount + (activeLabels.length ? ' (' + activeLabels.join(', ') + ')' : '');
    indicator.title = data.availableCount > 0
      ? 'Contexto ativo em: ' + activeLabels.join(', ')
      : 'Nenhum painel selecionado esta ativo no momento.';
  }

  // Build a rich system prompt that includes live traffic data
  function _buildTrafficSystemPrompt() {
    var prompt = 'You are an API traffic intelligence assistant embedded in the browser.\n';
    prompt += 'You can see the live API calls this page is making in real time.\n';
    prompt += 'Help the developer understand, debug, and optimize their API usage.\n\n';

    prompt += '## Page Context\n';
    prompt += '- URL: ' + window.location.href + '\n';
    prompt += '- Title: ' + (document.title || 'Unknown') + '\n';
    prompt += '- Time: ' + new Date().toISOString() + '\n\n';

    if (state.traffic.length > 0) {
      var errored = state.traffic.filter(function (t) {
        return t.status === 'ERR' || (typeof t.status === 'number' && t.status >= 400);
      });
      prompt += '## Live API Traffic (' + state.traffic.length + ' captured, ' + errored.length + ' errors)\n\n';

      // Hit map — sorted by frequency
      var hitKeys = Object.keys(state.hitMap).sort(function (a, b) {
        return state.hitMap[b] - state.hitMap[a];
      });
      if (hitKeys.length > 0) {
        prompt += '### Matched endpoint hits:\n';
        hitKeys.forEach(function (key) {
          var ep = null;
          for (var i = 0; i < state.endpoints.length; i++) {
            if (state.endpoints[i].key === key) { ep = state.endpoints[i]; break; }
          }
          prompt += '- ' + key + ' × ' + state.hitMap[key] + (ep && ep.tag ? ' [' + ep.tag + ']' : '') + '\n';
        });
        prompt += '\n';
      }

      // Unmatched — calls not in catalog (potential unknowns or new routes)
      var unmatched = {};
      state.traffic.forEach(function (t) {
        if (!t.matched) {
          var k = t.method + ' ' + t.url.split('?')[0];
          unmatched[k] = (unmatched[k] || 0) + 1;
        }
      });
      var unmatchedKeys = Object.keys(unmatched);
      if (unmatchedKeys.length > 0) {
        prompt += '### Calls not in catalog (discovered from live traffic):\n';
        unmatchedKeys.slice(0, 25).forEach(function (k) {
          prompt += '- ' + k + ' × ' + unmatched[k] + '\n';
        });
        prompt += '\n';
      }

      // Errors
      if (errored.length > 0) {
        prompt += '### Errors / failures:\n';
        errored.slice(0, 20).forEach(function (t) {
          prompt += '- ' + t.method + ' ' + t.url.split('?')[0] + ' → ' + t.status + '\n';
        });
        prompt += '\n';
      }

      // Last 25 calls
      prompt += '### Chronological log (last 25 calls):\n';
      state.traffic.slice(0, 25).forEach(function (t, i) {
        var ts = t.time.toTimeString ? t.time.toTimeString().substring(0, 8) : '';
        var ok = t.matched ? ' ✓' : '';
        prompt += (i + 1) + '. [' + ts + '] ' + t.method + ' ' + t.url.split('?')[0] +
          ' → ' + t.status + ' (' + t.duration + 'ms)' + ok + '\n';
      });
      prompt += '\n';
    } else {
      prompt += '## Live API Traffic\nNo traffic captured yet — monitoring is active.\n\n';
    }

    // Endpoint catalog
    if (state.endpoints.length > 0) {
      prompt += '## Known Endpoint Catalog (' + state.endpoints.length + ' total)\n';
      state.groupOrder.forEach(function (tag) {
        var eps = state.groups[tag] || [];
        if (eps.length === 0) return;
        prompt += '\n### ' + tag + '\n';
        eps.forEach(function (ep) {
          var hits = state.hitMap[ep.key] ? ' [' + state.hitMap[ep.key] + ' hits]' : '';
          prompt += '- ' + ep.method + ' ' + ep.path;
          if (ep.summary) prompt += ' — ' + ep.summary;
          prompt += hits + '\n';
        });
      });
      prompt += '\n';
    }

    prompt += '## Instructions\n';
    prompt += 'Be concise and actionable. Highlight patterns, errors, and insights from the traffic data.\n';
    prompt += 'You can map what this page does, explain failures, suggest fixes, or identify missing routes.\n';
    prompt += 'When matching traffic to functions, use the Functions Registry data to provide schema details.\n';
    prompt += 'Respond in the same language as the user.\n';

    // Append Functions Registry if loaded
    if (window.Olivia_FUNCTIONS && window.Olivia_FUNCTIONS.loaded) {
      prompt += window.Olivia_FUNCTIONS.toSystemPrompt();
    }

    return prompt;
  }

  async function _streamAiResponse(userMsg) {
    var sendBtn = document.getElementById('epChatSendBtn');
    state.aiStreaming = true;
    if (sendBtn) sendBtn.disabled = true;

    var bubble = addChatMessage('ai', '<i class="fas fa-spinner fa-spin" style="color:var(--ep-amber);opacity:0.7"></i>');
    var log = document.getElementById('epChatLog');

    var aiUrl = _detectAiEndpoint();
    state._ownRequests.add(aiUrl); // never show AI calls in traffic
    _updatePanelContextIndicator();

    var systemPrompt = _buildTrafficSystemPrompt();
    var panelContext = _getPanelContextData();
    var msgWithContext = userMsg + (panelContext.text || '');

    // Keep last 10 turns for context (system prompt stays fresh each call)
    var history = state.chatHistory.slice(-10);

    var fullContent = '';
    try {
      var resp = await window._epOrigFetch(aiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msgWithContext,
          system: systemPrompt,
          history: history,
          model: config.aiModel || 'deepseek-v4-flash'
        })
      });

      if (!resp.ok) throw new Error('HTTP ' + resp.status + ' from ' + aiUrl);

      var reader = resp.body.getReader();
      var decoder = new TextDecoder();
      var buffer = '';

      while (true) {
        var chunk = await reader.read();
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });
        var lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (var i = 0; i < lines.length; i++) {
          var line = lines[i];
          if (!line.startsWith('data: ')) continue;
          var raw = line.slice(6).trim();
          if (!raw || raw === '[DONE]') continue;
          try {
            var d = JSON.parse(raw);
            if (d.type === 'token' && d.content) {
              fullContent += d.content;
              bubble.innerHTML = _renderMd(fullContent);
              if (log) log.scrollTop = log.scrollHeight;
            } else if (d.type === 'done' || d.type === 'error') {
              break;
            }
          } catch (pe) { }
        }
      }

      // Try plain JSON fallback if SSE produced nothing
      if (!fullContent && buffer) {
        try {
          var plain = JSON.parse(buffer);
          fullContent = plain.response || plain.content || plain.message || JSON.stringify(plain, null, 2);
        } catch (e) { fullContent = buffer; }
      }

      if (!fullContent) fullContent = '(no response from AI)';
      bubble.innerHTML = _renderMd(fullContent);
      state.chatHistory.push({ role: 'assistant', content: fullContent });

    } catch (err) {
      var errHtml = '<span style="color:var(--ep-red)"><i class="fas fa-exclamation-triangle"></i> ' +
        escapeHtml(err.message) + '</span>';

      // Offline fallback — answer from local traffic data
      var offline = _offlineAnswer(userMsg);
      if (offline) {
        errHtml += '<hr style="border:none;border-top:1px solid var(--ep-border);margin:8px 0">' +
          '<em style="font-size:10px;color:var(--ep-text-dim)">Offline analysis (AI unavailable):</em><br>' + offline;
      }
      bubble.innerHTML = errHtml;
    }

    if (log) log.scrollTop = log.scrollHeight;
    state.aiStreaming = false;
    if (sendBtn) sendBtn.disabled = false;
  }

  function _renderMd(text) {
    if (typeof marked !== 'undefined') {
      try { return marked.parse(text); } catch (e) { }
    }
    var d = document.createElement('div');
    d.textContent = text;
    var s = d.innerHTML;
    s = s.replace(/```[\s\S]*?```/g, function (m) {
      return '<pre><code>' + m.replace(/```\w*/g, '').trim() + '</code></pre>';
    });
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\n/g, '<br>');
    return s;
  }

  // Offline keyword-based answers using local traffic/catalog data
  function _offlineAnswer(msg) {
    var lower = msg.toLowerCase();
    if (lower.indexOf('error') !== -1 || lower.indexOf('fail') !== -1 || lower.indexOf('404') !== -1) {
      var errs = state.traffic.filter(function (t) {
        return t.status === 'ERR' || (typeof t.status === 'number' && t.status >= 400);
      });
      if (errs.length === 0) return 'No errors in current traffic.';
      var html = errs.length + ' error(s) found:<br>';
      errs.slice(0, 15).forEach(function (t) {
        html += '<code>' + t.status + '</code> ' + escapeHtml(t.method) + ' ' +
          escapeHtml(t.url.split('?')[0]) + '<br>';
      });
      return html;
    }
    if (lower.indexOf('traffic') !== -1 || lower.indexOf('call') !== -1 || lower.indexOf('request') !== -1) {
      return 'Captured ' + state.traffic.length + ' requests · ' + state.totalHits + ' matched catalog · ' + state.totalErrors + ' errors.';
    }
    if (lower.indexOf('endpoint') !== -1 || lower.indexOf('list') !== -1 || lower.indexOf('catalog') !== -1) {
      return 'Catalog: ' + state.endpoints.length + ' endpoints across ' + state.groupOrder.length + ' services.';
    }
    return null;
  }

  /* ═══════════════════════════════════════════════════════════════════
     UTILITIES
     ═══════════════════════════════════════════════════════════════════ */
  function toast(msg) {
    var el = document.getElementById('epToast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(function () { el.classList.remove('show'); }, 2200);
  }

  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function sanitizeId(str) {
    return str.replace(/[^a-zA-Z0-9_-]/g, '_');
  }

})();
