/* ═══════════════════════════════════════════════════════════════════
  AURA DEBUG LOGGER  —  olivia/js/lib/logger.js

   Intercepts all fetch() calls and provides structured console output.
   Load order: first script to run (before api-client.js).

   Console API:
     OliviaLegal.verbose = true   → expand all groups (default: collapsed)
     OliviaLegal.enabled = false  → silence everything
     OliviaLegal.filter  = '/api' → only log URLs matching this string
     OliviaLegal.noisy   = true   → include high-frequency remote-bus/blob logs

   Color-coded groups:
     🔵 [FETCH]     outgoing request (collapsed by default)
     🟢 [200]       successful response
     🔴 [4xx/5xx]   HTTP error
     ⚠️  [WARN]     soft problems
     🟣 [REGISTRY]  function registry events
     ⚫ [STREAM]    SSE streaming events
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── Config ──────────────────────────────────────────────────────── */
  var cfg = {
    enabled: true,
    verbose: false,    // true = expand groups by default
    filter: '',       // filter by URL substring; '' = show all
    timing: true,     // show ms for each request
    noisy: false,    // false = suppress repetitive remote-bus/blob lines
    noisyEvery: 250,   // print one aggregate note every N suppressed lines
  };

  var _isEmbeddedRuntime = false;
  try {
    _isEmbeddedRuntime = window.self !== window.top;
  } catch (e) {
    _isEmbeddedRuntime = true;
  }
  if (typeof window.Olivia_EMBED_MODE !== 'boolean') {
    window.Olivia_EMBED_MODE = _isEmbeddedRuntime;
  }
  // Embedded runtimes (e.g. workspace opened inside browser-panel iframe)
  // tend to duplicate logs from the host page, so keep logger silent by default.
  if (_isEmbeddedRuntime) {
    cfg.enabled = false;
  }

  var _noiseState = {
    suppressed: 0,
    byRoute: Object.create(null),
  };

  /* ── Styles ──────────────────────────────────────────────────────── */
  var C = {
    fetch: 'background:#1565c0;color:#fff;padding:1px 6px;border-radius:3px;font-size:10px;font-weight:700',
    ok: 'background:#2e7d32;color:#fff;padding:1px 6px;border-radius:3px;font-size:10px;font-weight:700',
    err: 'background:#b71c1c;color:#fff;padding:1px 6px;border-radius:3px;font-size:10px;font-weight:700',
    warn: 'background:#e65100;color:#fff;padding:1px 6px;border-radius:3px;font-size:10px;font-weight:700',
    reg: 'background:#6a1b9a;color:#fff;padding:1px 6px;border-radius:3px;font-size:10px;font-weight:700',
    stream: 'background:#004d40;color:#fff;padding:1px 6px;border-radius:3px;font-size:10px;font-weight:700',
    dim: 'color:#888;font-size:11px',
    path: 'color:#222;font-weight:500',
    reset: '',
  };

  /* ── Internal helpers ────────────────────────────────────────────── */
  function _maskSecret(value) {
    var s = String(value == null ? '' : value);
    if (!s) return s;
    if (s.length <= 8) return '***redacted***';
    return s.slice(0, 3) + '***redacted***' + s.slice(-2);
  }

  function _sanitizeUrl(rawUrl) {
    var str = String(rawUrl || '');
    if (!str) return str;
    try {
      var u = new URL(str, window.location.origin);
      ['api_key', 'apikey', 'key', 'token', 'access_token', 'auth'].forEach(function (k) {
        if (u.searchParams.has(k)) u.searchParams.set(k, _maskSecret(u.searchParams.get(k)));
      });
      return u.toString();
    } catch (e) {
      return str.replace(/([?&](?:api_key|apikey|key|token|access_token|auth)=)([^&]+)/ig, function (_, p1, p2) {
        return p1 + _maskSecret(p2);
      });
    }
  }

  function _path(url) {
    var safeUrl = _sanitizeUrl(url);
    return String(safeUrl).replace(/^https?:\/\/[^/]+/, '') || String(safeUrl);
  }

  function _shouldLog(path, safeUrl) {
    if (!cfg.enabled) return false;
    if (cfg.filter) {
      var needle = String(cfg.filter);
      var p = String(path || '');
      var u = String(safeUrl || '');
      if (p.indexOf(needle) === -1 && u.indexOf(needle) === -1) return false;
    }
    return true;
  }

  function _isNoisyPath(path) {
    var p = String(path || '');
    if (/^blob:/i.test(p)) return true;
    if (/\/api\/olivialegal\/remote-bus(?:\?|$)/i.test(p)) return true;
    return false;
  }

  function _trackSuppressedNoise(method, path) {
    _noiseState.suppressed += 1;
    var route = String(path || '').split('?')[0] || 'unknown';
    var key = String(method || 'GET').toUpperCase() + ' ' + route;
    _noiseState.byRoute[key] = (_noiseState.byRoute[key] || 0) + 1;

    var every = Math.max(1, parseInt(cfg.noisyEvery, 10) || 25);
    if ((_noiseState.suppressed % every) !== 0) return;

    var top = Object.keys(_noiseState.byRoute)
      .sort(function (a, b) { return _noiseState.byRoute[b] - _noiseState.byRoute[a]; })
      .slice(0, 3)
      .map(function (k) { return k + ' x' + _noiseState.byRoute[k]; })
      .join(' · ');

    try {
      console.log(
        '%c NOISE %c suppressed ' + _noiseState.suppressed +
        ' high-frequency fetch logs. Top routes: ' + top +
        '. Set OliviaLegal.noisy=true or OliviaLegal.verbose=true to show all.',
        C.warn,
        C.reset
      );
    } catch (e) { }
  }

  function _groupFn() {
    return cfg.verbose ? console.group : console.groupCollapsed;
  }

  function _tryParseBody(body) {
    if (!body) return null;
    try { return JSON.parse(typeof body === 'string' ? body : JSON.stringify(body)); } catch (e) { return String(body).substring(0, 300); }
  }

  // Returns a clean prototype-free snapshot safe to pass to console.log
  function _snap(obj) {
    try { return JSON.parse(JSON.stringify(obj)); } catch (e) { return String(obj); }
  }

  function _normalizeHeaders(rawHdrs) {
    if (!rawHdrs) return null;
    try {
      // Native Headers instance
      if (typeof Headers !== 'undefined' && rawHdrs instanceof Headers) {
        var out = {};
        rawHdrs.forEach(function (v, k) { out[k] = v; });
        return _redactHeaders(out);
      }
      // Array of [key, value]
      if (Array.isArray(rawHdrs)) {
        var arrOut = {};
        rawHdrs.forEach(function (p) {
          if (Array.isArray(p) && p.length >= 2) arrOut[String(p[0])] = String(p[1]);
        });
        return _redactHeaders(arrOut);
      }
      return _redactHeaders(_snap(rawHdrs));
    } catch (e) {
      return _redactHeaders(_snap(rawHdrs));
    }
  }

  function _redactHeaders(headersObj) {
    if (!headersObj || typeof headersObj !== 'object') return headersObj;
    var out = {};
    Object.keys(headersObj).forEach(function (key) {
      var lower = String(key).toLowerCase();
      var val = headersObj[key];
      if (lower === 'authorization' || lower === 'x-api-key' || lower === 'api-key') {
        out[key] = _maskSecret(val);
      } else {
        out[key] = val;
      }
    });
    return out;
  }

  function _preview(value, maxLen) {
    var limit = typeof maxLen === 'number' ? maxLen : 1000;
    try {
      var s = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
      if (!s) return null;
      return s.length > limit ? s.substring(0, limit) + ' ...[truncated]' : s;
    } catch (e) {
      var fallback = String(value);
      return fallback.length > limit ? fallback.substring(0, limit) + ' ...[truncated]' : fallback;
    }
  }

  function _extractBodyContentString(body) {
    if (typeof body === 'string') return body;
    if (body && typeof body === 'object' && typeof body.content === 'string') return body.content;
    return '';
  }

  function _isBinaryLikeBody(body) {
    var s = _extractBodyContentString(body);
    if (!s) return false;
    if (s.indexOf('PK\u0003\u0004') !== -1 || s.indexOf('\u0000') !== -1) return true;
    var sample = s.slice(0, 2048);
    var ctrl = 0;
    for (var i = 0; i < sample.length; i++) {
      var code = sample.charCodeAt(i);
      if (code < 32 && code !== 9 && code !== 10 && code !== 13) ctrl++;
    }
    return sample.length > 0 && (ctrl / sample.length) > 0.02;
  }

  /* ── Fetch interceptor ───────────────────────────────────────────── */
  var _origFetch = window.fetch;

  window.fetch = function (url, opts) {
    // fetch() accepts a Request object as first arg. Unwrap it so we don't log
    // "[object Request]" for every intercepted call.
    if (url && typeof url === 'object' && typeof url.url === 'string') {
      if (!opts) {
        opts = { method: url.method };
        try { if (url.headers) opts.headers = url.headers; } catch (e) { }
      }
      url = url.url;
    }
    var method = ((opts && opts.method) || 'GET').toUpperCase();
    var safeUrl = _sanitizeUrl(url);
    var path = _path(safeUrl);
    if (!_shouldLog(path, safeUrl)) return _origFetch.apply(this, arguments);
    if (!cfg.verbose && !cfg.noisy && _isNoisyPath(path)) {
      _trackSuppressedNoise(method, path);
      return _origFetch.apply(this, arguments);
    }

    var t0 = performance.now();
    var body = opts && opts.body ? _tryParseBody(opts.body) : null;
    var rawHdrs = opts && opts.headers ? opts.headers : null;
    var headers = _normalizeHeaders(rawHdrs);
    var isSSE = rawHdrs && (
      (typeof rawHdrs.Accept === 'string' && rawHdrs.Accept.indexOf('text/event-stream') !== -1) ||
      path.indexOf('/stream') !== -1 || path.indexOf('/run') !== -1
    );

    var label = '%c ' + method + ' %c' + path;

    try {
      _groupFn().call(console, label, isSSE ? C.stream : C.fetch, C.path);
      console.log('%c url  %c ' + safeUrl, C.dim, C.reset);
      if (body) {
        if (_isBinaryLikeBody(body)) {
          var bodyContent = _extractBodyContentString(body);
          console.log('%c body %c [binary-like payload omitted] (%s chars)', C.dim, C.reset, String(bodyContent.length || 0));
        } else {
          console.log('%c body %c %s', C.dim, C.reset, _preview(body));
        }
      }
      if (headers && Object.keys(headers).length) {
        console.log('%c hdrs %c %s', C.dim, C.reset, _preview(headers, 600));
      }
    } catch (e) { }

    return _origFetch.apply(this, arguments)
      .then(function (response) {
        var ms = Math.round(performance.now() - t0);
        var ok = response.ok;
        try {
          if (ok) {
            console.log('%c ' + response.status + ' ' + (response.statusText || 'OK') + ' %c' + (cfg.timing ? ' ' + ms + 'ms' : ''), C.ok, C.dim);
          } else {
            console.warn('%c ' + response.status + ' ' + (response.statusText || 'Error') + ' %c' + (cfg.timing ? ' ' + ms + 'ms' : ''), C.err, C.dim);
          }
          console.groupEnd();
        } catch (e) { }
        return response;
      })
      .catch(function (err) {
        var ms = Math.round(performance.now() - t0);
        try {
          console.error('%c NETWORK ERROR %c ' + err.message + (cfg.timing ? '  ' + ms + 'ms' : ''), C.err, C.dim);
          console.groupEnd();
        } catch (e) { }
        throw err;
      });
  };

  /* ── Public structured logger ────────────────────────────────────── */
  // OliviaLegal.log('REGISTRY', 'info',  'Loaded 45 functions', { ... })
  // OliviaLegal.log('STREAM',   'error', 'Parse failed on line: ...', line)
  function _log(group, level, message, data) {
    if (!cfg.enabled) return;
    var style = level === 'error' ? C.err
      : level === 'warn' ? C.warn
        : level === 'stream' ? C.stream
          : C.reg;
    var fn = level === 'error' ? console.error
      : level === 'warn' ? console.warn
        : console.log;
    if (data !== undefined) {
      fn.call(console, '%c ' + group + ' %c ' + message, style, C.reset, data);
    } else {
      fn.call(console, '%c ' + group + ' %c ' + message, style, C.reset);
    }
  }

  /* ── Public API ──────────────────────────────────────────────────── */
  var existingLA8159 = (window.LA8159 && typeof window.LA8159 === 'object') ? window.LA8159 : {};
  var existingOlivia = (window.Olivia && typeof window.Olivia === 'object') ? window.Olivia : {};
  var runtimeNamespace = Object.assign({}, existingLA8159, existingOliviaLegal, cfg, {
    log: _log,
    _orig: _origFetch,
  });
  window.LA8159 = runtimeNamespace;
  window.Olivia = runtimeNamespace;

  /* ── Boot banner ─────────────────────────────────────────────────── */
  if (cfg.enabled) {
    console.log(
      '%c LA8159 Debug %c fetch interceptor active — ' +
      '%cOliviaLegal.verbose=true%c to expand · ' +
      '%cOliviaLegal.noisy=true%c for remote-bus/blob · ' +
      '%cOliviaLegal.filter="/api"%c to narrow · ' +
      '%cOliviaLegal.enabled=false%c to silence',
      'background:#1c4532;color:#faf9f6;padding:2px 8px;border-radius:3px;font-weight:700',
      'color:#1c4532',
      'font-family:monospace;color:#1565c0', '',
      'font-family:monospace;color:#1565c0', '',
      'font-family:monospace;color:#1565c0', '',
      'font-family:monospace;color:#1565c0', ''
    );
  }

})();
