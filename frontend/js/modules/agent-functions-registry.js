/**
 * LA8159-AI Agent Functions Registry
 * Runtime registry of mapped API functions with schemas, validation, and relationships.
 * Loads from the agent_functions/ JSON map and exposes lookups + AI prompt generation.
 * Version 1.0 · June 2025
 */
(function () {
  'use strict';

  /* ── Data source ────────────────────────────────────────────────── */
  // Resolve to an absolute gateway URL so calls work regardless of which static
  // server is hosting this page. Mirrors the logic in config.js.
  var _runtimeCfg = (window.Olivia && typeof window.Olivia === 'object')
    ? window.Olivia
    : ((window.LA8159 && typeof window.LA8159 === 'object') ? window.LA8159 : {});
  var _gatewayOrigin = (_runtimeCfg.gateway && _runtimeCfg.gateway.base)
    ? String(_runtimeCfg.gateway.base).replace(/\/$/, '')
    : window.location.origin;
  function _resolveApiBase() {
    if (typeof API_BASE !== 'undefined' && API_BASE) {
      return String(API_BASE).replace(/\/$/, '');
    }
    var host = String(window.location.hostname || '').toLowerCase();
    if (host === 'LA8159-ai.com.br' || host === 'www.LA8159-ai.com.br') {
      return window.location.origin.replace(/\/$/, '') + '/api/olivialegal';
    }
    return _gatewayOrigin;
  }

  var _FUNCTIONS_API = _resolveApiBase() + '/api/functions';
  var _ARCHITECTURE_API = _resolveApiBase() + '/api/architecture';
  var _LOCAL_MAP_ROOT = (window.Olivia_FUNCTIONS_MAP_ROOT || 'Olivia_functions_mapping').replace(/\/$/, '');

  /* ── Internal state ─────────────────────────────────────────────── */
  var _registry = {
    functions: {},   // id → {id, name, method, url, resolvedUrl, category, capabilities, useCases, …}
    byName: {},   // name → [entries]
    byCategory: {},   // category → [entries]
    byCapability: {},   // capability label → [ids]
    byUseCase: {},   // use case label → [ids]
    byEndpoint: {},   // "METHOD /resolved/path" → entry
    sourceMeta: {},
    architecture: {
      loaded: false,
      error: '',
      groups: {},
      groupLabels: {},
      agentNames: {},
      agentKeys: [],
      capabilityIndexSize: 0,
      assignedCapabilities: 0,
      matchedFunctions: 0,
      unmatchedFunctions: 0
    },
    loaded: false,
    loading: false,
    totalCount: 0
  };

  /* ══════════════════════════════════════════════════════════════════
     INIT — load index + capability map
     ══════════════════════════════════════════════════════════════════ */
  var _initPromise = null;  // stored so concurrent callers share the same load

  function init() {
    if (window.Olivia_EMBED_MODE) return Promise.resolve();
    if (_registry.loaded) return Promise.resolve();
    if (_initPromise) return _initPromise;   // already loading — return same promise
    _registry.loading = true;

    _initPromise = Promise.all([
      _fetchAnyJson([_FUNCTIONS_API + '/index', _localMapPath('agent_functions/index.json')]),
      _fetchAnyJson([_FUNCTIONS_API + '/capabilities', _localMapPath('agent_functions/capability_map.json')]),
      _fetchAnyJson([_FUNCTIONS_API, _localMapPath('agent_functions/index.json')])
    ])
      .then(function (results) {
        var index = results[0];
        var capMap = results[1];
        var listPayload = results[2];

        _registry.sourceMeta = {
          source: (String(results[0] && results[0].__olivia_source || '') === 'local_mapping') ? 'local_mapping' : 'api',
          mapping_root: _LOCAL_MAP_ROOT
        };

        if (!index || !index.categories) throw new Error('Invalid index.json');
        _registry.totalCount = index.total_functions || 0;

        // ── Flatten categories into functions map ──────────────────
        var cats = index.categories;
        Object.keys(cats).forEach(function (category) {
          var fns = cats[category];
          if (!Array.isArray(fns)) return;

          fns.forEach(function (fn) {
            var resolved = _resolveUrl(fn.url);
            var entry = {
              id: fn.id,
              name: fn.name,
              method: fn.method,
              urlTemplate: fn.url,
              resolvedUrl: resolved,
              category: category,
              service: fn.service || null,
              baseUrl: fn.base_url || null,
              port: fn.port != null ? Number(fn.port) : null,
              servicePort: fn.service_port || null,
              capabilities: [],
              useCases: [],
              relatedIds: [],
              agentReady: !!fn.agent_ready,
              validationScore: Number(fn.validation_score || 0),
              testStatus: fn.test_status || null,
              mapSource: _registry.sourceMeta.source || 'api',
              _full: null       // lazy-loaded detail
            };
            _registry.functions[fn.id] = entry;

            // Index by name
            if (!_registry.byName[fn.name]) _registry.byName[fn.name] = [];
            _registry.byName[fn.name].push(entry);

            // Index by category
            if (!_registry.byCategory[category]) _registry.byCategory[category] = [];
            _registry.byCategory[category].push(entry);

            // Index by resolved endpoint key
            if (resolved) {
              var path = resolved.replace(/^https?:\/\/[^/]+/, '');
              _registry.byEndpoint[fn.method + ' ' + path] = entry;
            }
          });
        });

        // ── Merge capability map ──────────────────────────────────
        if (capMap && capMap.by_capability) {
          Object.keys(capMap.by_capability).forEach(function (cap) {
            var ids = capMap.by_capability[cap];
            _registry.byCapability[cap] = ids;
            ids.forEach(function (id) {
              if (_registry.functions[id]) {
                _registry.functions[id].capabilities.push(cap);
              }
            });
          });
        }
        if (capMap && capMap.by_use_case) {
          Object.keys(capMap.by_use_case).forEach(function (uc) {
            var ids = capMap.by_use_case[uc];
            _registry.byUseCase[uc] = ids;
            ids.forEach(function (id) {
              if (_registry.functions[id]) {
                _registry.functions[id].useCases.push(uc);
              }
            });
          });
        }

        // ── Hydrate runtime validation fields from /api/functions ───────────
        // /api/functions/index may omit agent_ready/test_status in some builds.
        if (listPayload && Array.isArray(listPayload.functions)) {
          listPayload.functions.forEach(function (raw) {
            if (!raw || !raw.id) return;
            var fn = _registry.functions[raw.id];
            if (!fn) return;

            if (typeof raw.agent_ready === 'boolean') {
              fn.agentReady = raw.agent_ready;
            } else if (typeof raw.agentReady === 'boolean') {
              fn.agentReady = raw.agentReady;
            }

            if (raw.validation_score != null) {
              fn.validationScore = Number(raw.validation_score || 0);
            } else if (raw.validationScore != null) {
              fn.validationScore = Number(raw.validationScore || 0);
            }

            if (raw.service) fn.service = String(raw.service);
            if (raw.base_url) fn.baseUrl = String(raw.base_url);
            if (raw.port != null && raw.port !== '') fn.port = Number(raw.port);
            if (raw.service_port) fn.servicePort = String(raw.service_port);
            if (!fn.servicePort && fn.service) {
              fn.servicePort = fn.port != null ? (fn.service + '.' + fn.port) : fn.service;
            }

            if (raw.test_status) {
              fn.testStatus = raw.test_status;
            } else if (raw.testStatus) {
              fn.testStatus = raw.testStatus;
            }
          });
        }

        return _loadArchitectureOverlay()
          .catch(function (err) {
            _registry.architecture.error = String(err && err.message ? err.message : err || 'overlay_load_failed');
          })
          .then(function () {
            _registry.loaded = true;
            _registry.loading = false;
            _initPromise = null;

            var architectureSummary = '';
            if (_registry.architecture && _registry.architecture.loaded) {
              architectureSummary = ' · ownership:' +
                String(_registry.architecture.matchedFunctions || 0) + '/' +
                String(Object.keys(_registry.functions).length) + ' functions';
            }
            console.log('[Functions Registry] Loaded ' + Object.keys(_registry.functions).length + ' functions across ' +
              Object.keys(_registry.byCategory).length + ' categories, ' +
              Object.keys(_registry.byCapability).length + ' capabilities' + architectureSummary);

            _fetch(_FUNCTIONS_API + '/meta').then(function (meta) {
              _registry.sourceMeta = Object.assign({}, _registry.sourceMeta || {}, meta || {});
            }).catch(function () {
              // Keep precomputed source metadata when the API meta endpoint is unavailable.
            });
          });
      })
      .catch(function (err) {
        _registry.loading = false;
        _initPromise = null;
        console.warn('[Functions Registry] Failed to load:', err.message);
      });
    return _initPromise;
  }

  function _uniqList(values) {
    var out = [];
    var seen = Object.create(null);
    (values || []).forEach(function (v) {
      var key = String(v || '').trim();
      if (!key || seen[key]) return;
      seen[key] = true;
      out.push(key);
    });
    return out;
  }

  function _normToken(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  }

  function _normalizedPath(raw) {
    var path = String(raw || '').replace(/^https?:\/\/[^/]+/i, '');
    path = path.split('?')[0].trim();
    if (!path) return '';
    if (path.charAt(0) !== '/') path = '/' + path;
    path = path.replace(/\/{2,}/g, '/');
    if (path.length > 1) path = path.replace(/\/+$/, '');
    return path;
  }

  function _pathVariants(raw) {
    var base = _normalizedPath(raw);
    if (!base) return [];
    var seen = Object.create(null);

    function add(path) {
      var clean = _normalizedPath(path);
      if (!clean || seen[clean]) return;
      seen[clean] = true;
    }

    add(base);

    var aliases = ['/api/manus', '/api/olivialegal'];
    aliases.forEach(function (prefix) {
      if (base.indexOf(prefix + '/') === 0) {
        add(base.slice(prefix.length));
      } else if (base === prefix) {
        add('/');
      }
    });

    if (base.indexOf('/api/') === 0 && base.indexOf('/api/manus/') !== 0 && base.indexOf('/api/olivia/') !== 0) {
      add('/api/manus' + base);
      add('/api/olivialegal' + base);
    }

    if (base.indexOf('/api/') !== 0) {
      add('/api' + (base.charAt(0) === '/' ? base : ('/' + base)));
    }

    return Object.keys(seen);
  }

  function _endpointKeys(method, rawPath) {
    var m = String(method || 'GET').toUpperCase();
    return _pathVariants(rawPath).map(function (path) { return m + ' ' + path; });
  }

  function _loadArchitectureOverlay() {
    return Promise.all([
      _fetch(_ARCHITECTURE_API + '/agents').catch(function () { return null; }),
      _fetch(_ARCHITECTURE_API + '/groups').catch(function () { return null; }),
      _fetch(_ARCHITECTURE_API + '/capabilities/catalog').catch(function () { return null; }),
      _fetch(_ARCHITECTURE_API + '/capabilities/assignments').catch(function () { return null; })
    ]).then(function (parts) {
      var agentsPayload = parts[0] || {};
      var groupsPayload = parts[1] || {};
      var catalogPayload = parts[2] || {};
      var assignmentsPayload = parts[3] || {};

      var groups = groupsPayload.groups && typeof groupsPayload.groups === 'object'
        ? groupsPayload.groups
        : {};
      var vpsFunctions = (((catalogPayload.vps || {}).functions) || []);
      var assignments = assignmentsPayload.assignments || {};
      var groupDefaults = assignments.group_defaults && typeof assignments.group_defaults === 'object'
        ? assignments.group_defaults
        : {};
      var agentOverrides = assignments.agent_overrides && typeof assignments.agent_overrides === 'object'
        ? assignments.agent_overrides
        : {};

      var capIdsByEndpoint = Object.create(null);
      vpsFunctions.forEach(function (item) {
        if (!item) return;
        var capId = String(item.capability_id || '').trim();
        if (!capId) return;
        _endpointKeys(item.method || 'GET', item.url || item.path || '').forEach(function (key) {
          if (!capIdsByEndpoint[key]) capIdsByEndpoint[key] = [];
          capIdsByEndpoint[key].push(capId);
        });
      });
      Object.keys(capIdsByEndpoint).forEach(function (key) {
        capIdsByEndpoint[key] = _uniqList(capIdsByEndpoint[key]);
      });

      var agentNameByNorm = Object.create(null);
      ((agentsPayload.agents && Array.isArray(agentsPayload.agents)) ? agentsPayload.agents : []).forEach(function (agent) {
        if (!agent) return;
        var token = _normToken(agent.id || agent.slug);
        if (!token) return;
        agentNameByNorm[token] = String(agent.name || agent.id || agent.slug || token);
      });

      var groupLabels = {};
      var groupByAgentKey = {};
      var agentNames = {};
      var agentKeysByGroup = {};
      Object.keys(groups).forEach(function (groupSlug) {
        var info = groups[groupSlug] || {};
        groupLabels[groupSlug] = String(info.label || groupSlug);
        var rows = Array.isArray(info.agents) ? info.agents : [];
        rows.forEach(function (row) {
          var slug = String((row && row.slug) || '').trim();
          if (!slug) return;
          var key = groupSlug + ':' + slug;
          var normSlug = _normToken(slug);
          groupByAgentKey[key] = groupSlug;
          if (!agentKeysByGroup[groupSlug]) agentKeysByGroup[groupSlug] = [];
          agentKeysByGroup[groupSlug].push(key);
          agentNames[key] = String(row.name || agentNameByNorm[normSlug] || slug);
        });
      });

      Object.keys(agentOverrides).forEach(function (agentKey) {
        var parts = String(agentKey || '').split(':');
        if (parts.length < 2) return;
        var inferredGroup = parts[0];
        var slug = parts.slice(1).join(':');
        if (!groupByAgentKey[agentKey]) {
          groupByAgentKey[agentKey] = inferredGroup;
          if (!agentKeysByGroup[inferredGroup]) agentKeysByGroup[inferredGroup] = [];
          agentKeysByGroup[inferredGroup].push(agentKey);
          if (!groupLabels[inferredGroup]) groupLabels[inferredGroup] = inferredGroup;
        }
        if (!agentNames[agentKey]) {
          agentNames[agentKey] = agentNameByNorm[_normToken(slug)] || slug;
        }
      });

      var capSetByAgent = {};
      Object.keys(agentKeysByGroup).forEach(function (groupSlug) {
        var baseCaps = _uniqList(groupDefaults[groupSlug] || []);
        (agentKeysByGroup[groupSlug] || []).forEach(function (agentKey) {
          var overrideCaps = _uniqList(agentOverrides[agentKey] || []);
          capSetByAgent[agentKey] = _uniqList(baseCaps.concat(overrideCaps));
        });
      });

      Object.keys(agentOverrides).forEach(function (agentKey) {
        if (!capSetByAgent[agentKey]) {
          capSetByAgent[agentKey] = _uniqList(agentOverrides[agentKey] || []);
        }
      });

      var ownersByCapability = { agents: {}, groups: {} };
      Object.keys(capSetByAgent).forEach(function (agentKey) {
        var groupSlug = groupByAgentKey[agentKey] || '';
        (capSetByAgent[agentKey] || []).forEach(function (capId) {
          if (!ownersByCapability.agents[capId]) ownersByCapability.agents[capId] = [];
          ownersByCapability.agents[capId].push(agentKey);
          if (groupSlug) {
            if (!ownersByCapability.groups[capId]) ownersByCapability.groups[capId] = [];
            ownersByCapability.groups[capId].push(groupSlug);
          }
        });
      });

      Object.keys(ownersByCapability.agents).forEach(function (capId) {
        ownersByCapability.agents[capId] = _uniqList(ownersByCapability.agents[capId]);
      });
      Object.keys(ownersByCapability.groups).forEach(function (capId) {
        ownersByCapability.groups[capId] = _uniqList(ownersByCapability.groups[capId]);
      });

      var matchedFunctions = 0;
      Object.keys(_registry.functions).forEach(function (fnId) {
        var fn = _registry.functions[fnId];
        if (!fn) return;

        var endpointKeys = _endpointKeys(fn.method || 'GET', fn.resolvedUrl || fn.urlTemplate || '');
        var matchedCaps = [];
        endpointKeys.forEach(function (key) {
          matchedCaps = matchedCaps.concat(capIdsByEndpoint[key] || []);
        });
        matchedCaps = _uniqList(matchedCaps);

        var ownerAgentKeys = [];
        var ownerGroups = [];
        matchedCaps.forEach(function (capId) {
          ownerAgentKeys = ownerAgentKeys.concat(ownersByCapability.agents[capId] || []);
          ownerGroups = ownerGroups.concat(ownersByCapability.groups[capId] || []);
        });
        ownerAgentKeys = _uniqList(ownerAgentKeys);
        ownerGroups = _uniqList(ownerGroups);

        fn.capabilityIds = matchedCaps;
        fn.ownerAgentKeys = ownerAgentKeys;
        fn.ownerAgents = ownerAgentKeys.map(function (key) { return agentNames[key] || key; });
        fn.ownerGroups = ownerGroups;
        fn.ownerGroupLabels = ownerGroups.map(function (group) { return groupLabels[group] || group; });
        fn.assignedCapabilityCount = matchedCaps.length;

        if (matchedCaps.length > 0) matchedFunctions += 1;
      });

      _registry.architecture = {
        loaded: true,
        error: '',
        groups: groups,
        groupLabels: groupLabels,
        agentNames: agentNames,
        agentKeys: Object.keys(capSetByAgent),
        capabilityIndexSize: Object.keys(capIdsByEndpoint).length,
        assignedCapabilities: Object.keys(ownersByCapability.agents).length,
        matchedFunctions: matchedFunctions,
        unmatchedFunctions: Math.max(0, Object.keys(_registry.functions).length - matchedFunctions)
      };
    });
  }

  /* ══════════════════════════════════════════════════════════════════
     URL RESOLUTION — turn templates into real URLs
     ══════════════════════════════════════════════════════════════════ */
  function _resolveUrl(tpl) {
    if (!tpl) return '';
    var url = String(tpl);

    var apiBase = (typeof API_BASE !== 'undefined') ? API_BASE : '';
    var dscServer = (typeof _DSC_SERVER !== 'undefined') ? _DSC_SERVER
      : (window.Olivia_BASE_URLS && window.Olivia_BASE_URLS.bridge)
        ? window.Olivia_BASE_URLS.bridge
        : (_gatewayOrigin + '/api/bridge');

    // ${API_BASE}/path
    url = url.replace(/\$\{API_BASE\}/g, apiBase);
    // API_BASE + '/path'
    url = url.replace(/^API_BASE\s*\+\s*'([^']+)'/, apiBase + '$1');
    // ${_DSC_SERVER}/path
    url = url.replace(/\$\{_DSC_SERVER\}/g, dscServer);
    // _DSC_SERVER + '/path'
    url = url.replace(/^_DSC_SERVER\s*\+\s*'([^']+)'/, dscServer + '$1');

    // Handle remaining variable patterns (e.g. config.gatewayUrl + '...')
    if (/^[a-zA-Z_]/.test(url) && url.indexOf('/') === -1) {
      return '';  // unresolvable expression like bare "endpoint"
    }
    return url;
  }

  function _functionDetailCandidates(fn) {
    var id = String((fn && fn.id) || '').trim();
    var name = String((fn && fn.name) || '').trim();
    var list = [];
    if (!id) return list;
    list.push(_FUNCTIONS_API + '/' + id);
    if (name) list.push(_localMapPath('agent_functions/functions/' + id + '_' + name + '.json'));
    list.push(_localMapPath('agent_functions/functions/' + id + '.json'));
    return list;
  }

  /* ══════════════════════════════════════════════════════════════════
     LAZY-LOAD — fetch full function detail on demand
     ══════════════════════════════════════════════════════════════════ */
  function loadFunction(id) {
    var fn = _registry.functions[id];
    if (!fn) return Promise.resolve(null);
    if (fn._full) return Promise.resolve(fn._full);

    return _fetchAnyJson(_functionDetailCandidates(fn))
      .then(function (full) {
        if (!full) return fn;
        fn._full = full;
        fn.description = full.description;
        fn.bodySchema = full.body_schema;
        fn.headers = full.headers || [];
        fn.pathParams = full.path_params || [];
        fn.queryParams = full.query_params || [];
        fn.responseType = full.response_type;
        fn.responseSchema = full.response_schema;
        fn.errorHandling = full.error_handling;
        fn.prerequisites = full.prerequisites || [];
        fn.relatedIds = full.related_functions || [];
        fn.agentReady = !!full.agent_ready;
        fn.validationScore = Number(full.validation_score || fn.validationScore || 0);
        fn.validationChecks = full.validation_checks || {};
        fn.validationNotes = full.validation_notes || [];
        fn.testStatus = full.test_status || fn.testStatus || null;
        fn.testHttpCode = full.test_http_code || null;
        fn.fixSuggestion = full.fix_suggestion || '';
        fn.sourceFile = full.source_file;
        fn.sourceFunction = full.source_function;
        fn.confidence = full.confidence;
        return fn;
      })
      .catch(function (err) {
        console.warn('[Functions Registry] Failed to load detail for "' + id + '":', err && err.message || err);
        return fn;
      });
  }

  /* ══════════════════════════════════════════════════════════════════
     LOOKUP METHODS
     ══════════════════════════════════════════════════════════════════ */
  function getById(id) { return _registry.functions[id] || null; }
  function getByName(name) { return _registry.byName[name] || []; }
  function getByCategory(cat) { return _registry.byCategory[cat] || []; }
  function getAllCategories() { return Object.keys(_registry.byCategory); }
  function getAllCapabilities() { return Object.keys(_registry.byCapability); }

  function getByCapability(cap) {
    return (_registry.byCapability[cap] || [])
      .map(function (id) { return _registry.functions[id]; })
      .filter(Boolean);
  }

  function getByUseCase(uc) {
    return (_registry.byUseCase[uc] || [])
      .map(function (id) { return _registry.functions[id]; })
      .filter(Boolean);
  }

  function getOwnership(id) {
    var fn = _registry.functions[id];
    if (!fn) return { capabilityIds: [], ownerAgents: [], ownerGroups: [], ownerGroupLabels: [] };
    return {
      capabilityIds: fn.capabilityIds || [],
      ownerAgents: fn.ownerAgents || [],
      ownerGroups: fn.ownerGroups || [],
      ownerGroupLabels: fn.ownerGroupLabels || []
    };
  }

  function getRelated(id) {
    var fn = _registry.functions[id];
    if (!fn || !fn.relatedIds || !fn.relatedIds.length) return [];
    return fn.relatedIds.map(function (rid) { return _registry.functions[rid]; }).filter(Boolean);
  }

  /**
   * Match a live API call to a registered function.
   * @param {string} method — HTTP method
   * @param {string} url    — full or path URL
   */
  function matchEndpoint(method, url) {
    var path = url.replace(/^https?:\/\/[^/]+/, '').split('?')[0];
    var key = method.toUpperCase() + ' ' + path;
    if (_registry.byEndpoint[key]) return _registry.byEndpoint[key];

    // Pattern match (handle {param} / ${var} in registered paths)
    var ids = Object.keys(_registry.functions);
    for (var i = 0; i < ids.length; i++) {
      var fn = _registry.functions[ids[i]];
      if (fn.method !== method.toUpperCase()) continue;
      var rp = fn.resolvedUrl.replace(/^https?:\/\/[^/]+/, '').split('?')[0];
      if (!rp) continue;
      var escaped = rp.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      var pattern = escaped.replace(/\\\$\\\{[^}]+\\\}/g, '[^/]+').replace(/\{[^}]+\}/g, '[^/]+');
      try {
        if (new RegExp('^' + pattern + '$').test(path)) return fn;
      } catch (e) { /* skip malformed patterns */ }
    }
    return null;
  }

  /**
   * Search functions by free-text query (name, category, capability, use case)
   */
  function search(query) {
    if (!query) return [];
    var q = query.toLowerCase();
    var results = [];
    var seen = {};

    Object.keys(_registry.functions).forEach(function (id) {
      if (seen[id]) return;
      var fn = _registry.functions[id];
      var text = [fn.name, fn.category, fn.resolvedUrl]
        .concat(fn.capabilities)
        .concat(fn.useCases)
        .concat(fn.ownerGroups || [])
        .concat(fn.ownerGroupLabels || [])
        .concat(fn.ownerAgents || [])
        .join(' ').toLowerCase();
      if (text.indexOf(q) !== -1) {
        results.push(fn);
        seen[id] = true;
      }
    });
    return results;
  }

  function getReadyFunctions() {
    return Object.keys(_registry.functions)
      .map(function (id) { return _registry.functions[id]; })
      .filter(function (fn) { return !!fn.agentReady; });
  }

  /* ══════════════════════════════════════════════════════════════════
     AI PROMPT GENERATION
     ══════════════════════════════════════════════════════════════════ */

  /**
   * Generate a concise functions summary for AI system prompts.
   * Call this from endpoint-widget or chat modules to enrich agent context.
   */
  function toSystemPrompt() {
    if (!_registry.loaded) return '';

    var count = Object.keys(_registry.functions).length;
    var readyCount = getReadyFunctions().length;
    var p = '\n## LA8159-AI Functions Registry (' + count + ' functions)\n\n';
    p += '- Agent-ready (validated + test OK): ' + readyCount + '\n';
    p += '- Use agent-ready functions by default for autonomous execution.\n\n';

    // By category — compact table
    Object.keys(_registry.byCategory).forEach(function (cat) {
      var fns = _registry.byCategory[cat];
      var label = cat.replace(/^crud_/, 'CRUD ').replace(/^([a-z])/, function (m) { return m.toUpperCase(); });
      p += '### ' + label + ' (' + fns.length + ')\n';
      fns.forEach(function (fn) {
        var path = fn.resolvedUrl.replace(/^https?:\/\/[^/]+/, '') || fn.urlTemplate;
        p += '- ' + fn.method + ' `' + path + '` — **' + fn.name + '**';
        if (fn.capabilities.length) p += ' [' + fn.capabilities[0] + ']';
        if (fn.agentReady) p += ' {ready}';
        if (fn.testStatus && fn.testStatus !== 'ok') p += ' {status:' + fn.testStatus + '}';
        p += '\n';
      });
      p += '\n';
    });

    // Capabilities overview
    p += '### Capabilities\n';
    Object.keys(_registry.byCapability).forEach(function (cap) {
      p += '- ' + cap + ' (' + _registry.byCapability[cap].length + ' functions)\n';
    });
    p += '\n';

    // Runtime API hints
    p += '### Runtime API\n';
    p += 'Use `Olivia_FUNCTIONS.matchEndpoint(method, url)` to identify any API call.\n';
    p += 'Use `Olivia_FUNCTIONS.loadFunction(id)` for full schemas (body, params, response).\n';
    p += 'Use `Olivia_FUNCTIONS.search(query)` to find functions by keyword.\n';
    p += 'Use `Olivia_FUNCTIONS.getRelated(id)` to navigate function relationships.\n';

    return p;
  }

  /**
   * Generate a compact JSON blob of all functions for agent tool use.
   */
  function toToolManifest() {
    if (!_registry.loaded) return [];
    return Object.keys(_registry.functions).map(function (id) {
      var fn = _registry.functions[id];
      return {
        id: fn.id,
        name: fn.name,
        method: fn.method,
        path: fn.resolvedUrl.replace(/^https?:\/\/[^/]+/, '') || fn.urlTemplate,
        category: fn.category,
        capabilities: fn.capabilities,
        owner_groups: fn.ownerGroups || [],
        owner_agents: fn.ownerAgents || []
      };
    });
  }

  /* ══════════════════════════════════════════════════════════════════
     HELPERS
     ══════════════════════════════════════════════════════════════════ */
  function _localMapPath(relPath) {
    var clean = String(relPath || '').replace(/^\/+/, '');
    return _LOCAL_MAP_ROOT + '/' + clean;
  }

  function _fetchAnyJson(urls) {
    var list = Array.isArray(urls) ? urls.slice() : [urls];
    var idx = 0;
    function next(lastErr) {
      if (idx >= list.length) return Promise.reject(lastErr || new Error('No JSON source available'));
      var target = list[idx++];
      return _fetch(target).then(function (payload) {
        if (payload && typeof payload === 'object' && !payload.__olivia_source) {
          payload.__olivia_source = (String(target).indexOf(_LOCAL_MAP_ROOT + '/') >= 0) ? 'local_mapping' : 'api';
        }
        return payload;
      }).catch(next);
    }
    return next();
  }

  function _fetch(url) {
    var fetchFn = window._epOrigFetch || window.fetch;
    return fetchFn(url).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  /* ══════════════════════════════════════════════════════════════════
     PUBLIC API
     ══════════════════════════════════════════════════════════════════ */
  window.Olivia_FUNCTIONS = {
    init: init,
    getById: getById,
    getByName: getByName,
    getByCategory: getByCategory,
    getByCapability: getByCapability,
    getByUseCase: getByUseCase,
    getOwnership: getOwnership,
    getReadyFunctions: getReadyFunctions,
    getAllCategories: getAllCategories,
    getAllCapabilities: getAllCapabilities,
    getRelated: getRelated,
    matchEndpoint: matchEndpoint,
    search: search,
    loadFunction: loadFunction,
    toSystemPrompt: toSystemPrompt,
    toToolManifest: toToolManifest,

    get registry() { return _registry; },
    get loaded() { return _registry.loaded; },
    get count() { return Object.keys(_registry.functions).length; }
  };

  // Auto-init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 0);
  }

})();
