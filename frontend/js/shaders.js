/* ═══════════════════════════════════════════════════════════════════
   SHADERS MODULE — Scene Creation, Editing & VFX Workspace
   Olivia Shaders: brainstorm, create, edit, and preview SVG scenes
   for the Edinburgh Storytelling Workbench (shaderbench.html)
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── SCENE REGISTRY (mirrors shaderbench.html scenes array) ── */
  const SH_SCENES = [
    // Cleared on 2026-04-19 — originals backed up at
    // kout/_archive/scenes-backup-20260419-024754.tar.gz
  ];

  /* ── CREATIVE COMPOSITION GUIDE ── */
  const SH_METAPHOR_MAP = [
    { source: 'Narrative Core', visual: 'Main structure (bridge, tower, lighthouse)', icon_s: 'fas fa-compass', icon_v: 'fas fa-landmark' },
    { source: 'Motion Driver', visual: 'Pulsing / rotating dynamic element', icon_s: 'fas fa-wave-square', icon_v: 'fas fa-circle-notch' },
    { source: 'World Detail', visual: 'Plaque, flag, or inscribed stone with glow', icon_s: 'fas fa-scroll', icon_v: 'fas fa-flag' },
    { source: 'Character Presence', visual: 'Characters or icons (boats, people, figures)', icon_s: 'fas fa-user-astronaut', icon_v: 'fas fa-ship' },
    { source: 'Flow Layer', visual: 'Moving objects (ripples, flowing water)', icon_s: 'fas fa-water', icon_v: 'fas fa-droplet' },
    { source: 'Rhythm', visual: 'Steps, stones, or windows (count-based repetition)', icon_s: 'fas fa-bars', icon_v: 'fas fa-th' },
    { source: 'Intensity', visual: 'Colour intensity (high, medium, low)', icon_s: 'fas fa-sliders', icon_v: 'fas fa-palette' },
    { source: 'Connection Path', visual: 'Path or chain connecting elements', icon_s: 'fas fa-route', icon_v: 'fas fa-link' },
  ];

  /* ── PRESETS ── */
  const SH_STYLE_PRESETS = [
    { id: 'cartoon', name: 'Cartoon', values: { outline: 4, cel: 0.9, sat: 1.3, contrast: 1.3 } },
    { id: 'anime', name: 'Anime', values: { outline: 3, cel: 0.8, sat: 1.5, contrast: 1.4 } },
    { id: 'storybook', name: 'Storybook', values: { outline: 2.5, cel: 0.6, sat: 1.1, contrast: 1.1 } },
    { id: 'watercolor', name: 'Watercolor', values: { outline: 1.5, cel: 0.4, sat: 0.8, contrast: 0.9 } },
    { id: 'noir', name: 'Noir', values: { outline: 1, cel: 0.2, sat: 0.2, contrast: 1.6 } },
    { id: 'cinematic', name: 'Cinematic', values: { outline: 0.5, cel: 0.1, sat: 0.95, contrast: 1.15 } },
  ];

  const SH_TSL_TARGET_VERSION = 'three.js r160+ (WebGPU preferred, WebGL fallback)';

  const SH_COMPLEXITY_BUDGET = {
    mobile: {
      useSDF: false,
      layerCount: 2,
      postProcessingLevel: 'minimal',
      maxNoiseOctaves: 2,
      chromaticAberration: false,
      targetFps: 55,
    },
    desktop: {
      useSDF: false,
      layerCount: 3,
      postProcessingLevel: 'standard',
      maxNoiseOctaves: 3,
      chromaticAberration: true,
      targetFps: 60,
    },
    'high-end': {
      useSDF: true,
      layerCount: 4,
      postProcessingLevel: 'premium',
      maxNoiseOctaves: 4,
      chromaticAberration: true,
      targetFps: 60,
    },
  };

  const SH_MOOD_PRESETS = {
    cyberpunk: { bloom: 0.65, chromaticAberration: 0.01, vignette: 0.22, saturation: 1.25 },
    minimal: { bloom: 0.1, chromaticAberration: 0.0, vignette: 0.12, saturation: 0.95 },
    organic: { bloom: 0.22, chromaticAberration: 0.002, vignette: 0.16, saturation: 1.0 },
    glass: { bloom: 0.35, chromaticAberration: 0.006, vignette: 0.14, saturation: 1.05 },
  };

  const SH_BRIDGE_KEY = 'kout.shaders.sync.v1';
  const SH_BRIDGE_VERSION = 1;
  const SH_BRIDGE_SOURCE = 'kout-shaders';
  const SH_TASK_ASSET_EXAMPLES = [
    { label: 'City Harbor Baseline', path: 'content/examples/svg-assets/city-harbor.svg' },
    { label: 'Aurora Flow Arcs', path: 'content/examples/svg-assets/aurora-flow.svg' },
    { label: 'Topographic Ridges', path: 'content/examples/svg-assets/topo-ridges.svg' },
  ];
  let _shBridgeApplying = false;
  let _shBridgeLastPublish = 0;
  var _shUploadedTaskAssets = {};

  /* ── STATE ── */
  let _sh = {
    activeScene: null,
    customScenes: [],
    viewMode: 'list',       // list | grid
    activeTab: 'preview',   // preview | editor | brainstorm | settings
    sceneMode: '2d',        // '2d' | '3d'
    previewState: {
      tod: 12,
      era: 1750,
      weather: 'clear',
      outline: 2.5,
      bgmorph: 0.3,
      isNight: false,
      timeSpeed: 1,
      dayNightCycle: 0.5,
      weatherIntensity: 0,
      rotation3D: 0,
    },
    shaderTask: {
      svgAsset: '',
      desiredMood: 'organic',
      interactionType: 'hover',
      performanceTarget: 'desktop',
    },
    postFx: {
      bloom: 0.08,
      chromaticAberration: 0.0,
      vignette: 0.15,
      grain: 0.0,
      blur: 0.0,
      saturation: 1.0,
      contrast: 1.0,
      hueShift: 0,        // -180..180 degrees
      warmth: 0,          // -1..1  (cool↔warm via sepia + hue)
      brightness: 1.0,    // 0.3..2
      temperature: 6500,  // 2000..10000 K  (cooler→warmer)
      sepia: 0.0,         // 0..1
      lensFlare: 0.0,     // 0..1 (radial warm glow overlay)
      celShading: 0.0,    // 0..1 (contrast boost + quantize illusion)
    },
    envFx: {
      weatherType: 'clear', // clear | cloudy | rain | fog | snow | storm
      wind: 0.3,          // 0..2
      fogDensity: 0.0,    // 0..1
      turbulence: 0.2,    // 0..1
      gravity: 1.0,       // 0..2
      particleDensity: 0.5, // 0..1
      particleGlow: 0.4,  // 0..1
      autoRotate: false,
      autoCycleDayNight: false,
      mouseReactive: false,
      autoEraSepia: false,
    },
    renderingStrategy: {
      useSDF: false,
      layerCount: 3,
      postProcessingLevel: 'standard',
      maxNoiseOctaves: 3,
      chromaticAberration: true,
      targetFps: 60,
    },
    agentReport: {
      warnings: [],
      fallbackApplied: false,
      tslTarget: SH_TSL_TARGET_VERSION,
    },
    editorCode: '',
    brainMessages: [],
    brainChatExpanded: false,
    splitterDragging: false,
    previewRafId: null,
  };

  /* ── LOAD PERSISTED STATE ── */
  function shLoadState() {
    try {
      // One-shot scene reset (2026-04-19): clear any browser-cached custom scenes
      // so the gallery matches the wiped disk state. Runs once per browser.
      var RESET_SENTINEL = 'kout.shaders.reset.20260419';
      if (!localStorage.getItem(RESET_SENTINEL)) {
        try {
          var s0 = JSON.parse(localStorage.getItem('olivia.shaders.state') || '{}');
          s0.customScenes = [];
          s0.activeScene = null;
          localStorage.setItem('olivia.shaders.state', JSON.stringify(s0));
        } catch (_) { /* ignore */ }
        localStorage.setItem(RESET_SENTINEL, String(Date.now()));
      }

      var saved = JSON.parse(localStorage.getItem('olivia.shaders.state') || '{}');
      if (saved.customScenes) _sh.customScenes = saved.customScenes;
      if (saved.activeScene) _sh.activeScene = saved.activeScene;
      if (saved.viewMode) _sh.viewMode = saved.viewMode;
      if (saved.sceneMode) _sh.sceneMode = saved.sceneMode;
      if (saved.previewState) _sh.previewState = Object.assign({}, _sh.previewState, saved.previewState);
      if (saved.shaderTask) _sh.shaderTask = Object.assign({}, _sh.shaderTask, saved.shaderTask);
      if (saved.postFx) _sh.postFx = Object.assign({}, _sh.postFx, saved.postFx);
      if (saved.envFx) _sh.envFx = Object.assign({}, _sh.envFx, saved.envFx);
      if (saved.renderingStrategy) _sh.renderingStrategy = Object.assign({}, _sh.renderingStrategy, saved.renderingStrategy);
      if (saved.agentReport) _sh.agentReport = Object.assign({}, _sh.agentReport, saved.agentReport);
      if (typeof saved.brainChatExpanded === 'boolean') _sh.brainChatExpanded = saved.brainChatExpanded;
    } catch (e) { /* ignore */ }
  }
  function shSaveState(skipBridge) {
    try {
      localStorage.setItem('olivia.shaders.state', JSON.stringify({
        customScenes: _sh.customScenes,
        activeScene: _sh.activeScene,
        viewMode: _sh.viewMode,
        sceneMode: _sh.sceneMode,
        previewState: _sh.previewState,
        shaderTask: _sh.shaderTask,
        postFx: _sh.postFx,
        envFx: _sh.envFx,
        renderingStrategy: _sh.renderingStrategy,
        agentReport: _sh.agentReport,
        brainChatExpanded: _sh.brainChatExpanded,
      }));
      if (!skipBridge && !_shBridgeApplying) {
        shPublishBridgeState();
      }
    } catch (e) { /* ignore */ }
  }

  /* ── AUTO-LOAD SCENES FROM /scenes/manifest.json ── */
  // Fetches the manifest, loads each listed .scene.json file, and upserts into
  // _sh.customScenes by id — so just adding a file + updating manifest.json is
  // enough to make it appear in the Shaders room on next open.
  function shAutoLoadScenes() {
    var base = (typeof API_BASE === 'string' && API_BASE)
      ? API_BASE.replace(/\/$/, '') + '/content/scenes'
      : 'content/scenes';

    fetch(base + '/manifest.json?_=' + Date.now())
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (files) {
        if (!Array.isArray(files)) return;
        var pending = files.length;
        if (!pending) return;
        files.forEach(function (filename) {
          fetch(base + '/' + filename + '?_=' + Date.now())
            .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
            .then(function (data) {
              var items = Array.isArray(data) ? data : [data];
              items.forEach(function (scene) {
                if (!scene || !scene.id) return;
                var idx = _sh.customScenes.findIndex(function (s) { return s.id === scene.id; });
                if (idx >= 0) _sh.customScenes[idx] = scene;
                else _sh.customScenes.push(scene);
              });
            })
            .catch(function () { }) // individual file missing — skip silently
            .finally(function () {
              pending--;
              if (pending === 0) {
                shSaveState();
                shBuildSceneList();
              }
            });
        });
      })
      .catch(function () { }); // no manifest or server — skip silently
  }

  /* ── ASSET CATALOG ──────────────────────────────────────────────
     Reusable SVG artifacts (owl, deer, windmill, fireflies, ...) extracted
     from scenes. Loaded from /scenes/assets/manifest.json; each asset file
     is a JSON object with a `code` string compiled to a render function.
  
     Scene code can invoke an asset via:
       svg = SH_ASSETS.owl.render(svg, { x: w*0.3, y: bY-80, mt, isN, ol });
  
     The catalog modal (shOpenCatalog) lets the user pick assets and
     auto-generates a scene whose code composes the selected pieces.
     ─────────────────────────────────────────────────────────────── */
  window.SH_ASSETS = window.SH_ASSETS || {};

  function shAutoLoadAssets() {
    var base = (typeof API_BASE === 'string' && API_BASE)
      ? API_BASE.replace(/\/$/, '') + '/content/scenes/assets'
      : 'content/scenes/assets';

    fetch(base + '/manifest.json?_=' + Date.now())
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (files) {
        if (!Array.isArray(files)) return;
        files.forEach(function (filename) {
          fetch(base + '/' + filename + '?_=' + Date.now())
            .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
            .then(function (data) {
              if (!data || !data.id || typeof data.code !== 'string') return;
              try {
                var fn = new Function(
                  'svg', 'ctx', 'mt', 'w1', 'w2', 'w3', 'isN', 'ol',
                  data.code + '\nreturn svg;'
                );
                window.SH_ASSETS[data.id] = {
                  meta: data,
                  render: function (svg, ctx) {
                    ctx = ctx || {};
                    var mt = (ctx.mt != null) ? ctx.mt : 0;
                    var w1 = (ctx.w1 != null) ? ctx.w1 : (Math.sin(mt) * 0.5 + 0.5);
                    var w2 = (ctx.w2 != null) ? ctx.w2 : (Math.sin(mt * 1.7 + 2.5) * 0.5 + 0.5);
                    var w3 = (ctx.w3 != null) ? ctx.w3 : (Math.sin(mt * 2.3 + 4.8) * 0.5 + 0.5);
                    var isN = !!ctx.isN;
                    var ol = (ctx.ol != null) ? ctx.ol : 2.5;
                    try { return fn(svg, ctx, mt, w1, w2, w3, isN, ol); }
                    catch (e) { console.warn('[assets] render failed', data.id, e); return svg; }
                  }
                };
              } catch (compileErr) {
                console.warn('[assets] compile failed', data.id, compileErr);
              }
            })
            .catch(function () { });
        });
      })
      .catch(function () { });
  }

  /* List assets as plain metadata — used by the catalog UI and by the brain
     prompt so the LLM knows what's available to compose scenes with. */
  window.shListAssets = function () {
    return Object.keys(window.SH_ASSETS).map(function (id) {
      var m = window.SH_ASSETS[id].meta;
      return {
        id: m.id, name: m.name, icon: m.icon, category: m.category,
        tags: m.tags || [], desc: m.desc || '', params: m.params || {}
      };
    });
  };


  // Executes user/LLM-generated SVG code in an rAF loop.
  // The code runs inside a Function with the same variables available in shRenderPreview.
  var _shCustomCodeFn = null;  // compiled function cache
  var _shCustomCodeScene = null;

  // Validate every <path d="…"> in an SVG string. Each path command (MLHVCSQTAZ /
  // lowercase relatives) has a fixed stride of numeric operands; if the operand
  // count at the end of the path isn't a multiple of the last command's stride,
  // the path is truncated and the SVG renderer will spam the console. Returns
  // `true` when all paths parse cleanly, `false` if any d attribute is malformed.
  var _SH_PATH_STRIDE = { M: 2, m: 2, L: 2, l: 2, H: 1, h: 1, V: 1, v: 1, C: 6, c: 6, S: 4, s: 4, Q: 4, q: 4, T: 2, t: 2, A: 7, a: 7, Z: 0, z: 0 };
  function _shValidatePaths(svg) {
    var re = /<path\b[^>]*\sd\s*=\s*(?:"([^"]*)"|'([^']*)')/g, m;
    while ((m = re.exec(svg)) !== null) {
      var d = m[1] || m[2] || '';
      if (!d.trim()) continue;
      var tokens = d.match(/[a-zA-Z]|[+-]?(?:\d+\.\d+|\.\d+|\d+)(?:[eE][+-]?\d+)?/g);
      if (!tokens) continue;
      var cmd = null, args = 0;
      for (var i = 0; i < tokens.length; i++) {
        var t = tokens[i];
        if (/^[a-zA-Z]$/.test(t)) {
          // close out previous command — only check stride if it actually takes args
          if (cmd !== null) {
            var prevStride = _SH_PATH_STRIDE[cmd];
            if (prevStride > 0 && args % prevStride !== 0) return false;
          }
          if (!(t in _SH_PATH_STRIDE)) return false;
          cmd = t; args = 0;
        } else {
          args++;
        }
      }
      if (cmd !== null) {
        var stride = _SH_PATH_STRIDE[cmd];
        if (stride > 0 && args % stride !== 0) return false;
      }
    }
    return true;
  }

  function _shStartCustomCodeLoop(sc, codeStr) {
    if (_sh.previewRafId) cancelAnimationFrame(_sh.previewRafId);
    _sh.previewRafId = null;
    try {
      // Compile once — runs on every rAF tick
      _shCustomCodeFn = new Function(
        'svg', 'w', 'h', 'bY', 'bCol', 'wc', 'ol', 'isN', 'mt', 'w1', 'w2', 'w3', 'sc',
        codeStr + '\nreturn svg;'
      );
      _shCustomCodeScene = sc;
    } catch (compileErr) {
      shToast('Code error: ' + (compileErr.message || compileErr));
      return;
    }
    function loop() {
      var el2 = document.getElementById('shPreviewSVG');
      if (!el2) { _sh.previewRafId = null; _shCustomCodeFn = null; return; }
      var rect2 = el2.parentElement.getBoundingClientRect();
      var w = rect2.width || 800, h = rect2.height || 500;
      var ps = _sh.previewState;
      var ol = ps.outline || 2.5;
      var isN = ps.tod < 5 || ps.tod > 20;
      var isD = (ps.tod >= 17 && ps.tod <= 20) || (ps.tod >= 5 && ps.tod < 7);
      var dim = isN ? 0.4 : isD ? 0.7 : 1;
      var mt = Date.now() * 0.001 * (ps.timeSpeed || 1) * Math.max((ps.bgmorph || 0.3) + 0.5, 0.3);
      var w1 = Math.sin(mt) * 0.5 + 0.5;
      var w2 = Math.sin(mt * 1.7 + 2.5) * 0.5 + 0.5;
      var w3 = Math.sin(mt * 2.3 + 4.8) * 0.5 + 0.5;
      var bY = h * 0.65 + 20;
      var bCol = sc.bld, wc = isN ? '#F0C860' : '#3A3228';
      try {
        var svg = '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" xmlns="http://www.w3.org/2000/svg" style="filter:brightness(' + dim + ')">';
        svg += '<defs><linearGradient id="sh-sky-cc" x1="0" y1="0" x2="0" y2="1">'
          + '<stop offset="0%" stop-color="' + (isN ? '#0E1A3A' : sc.sky1) + '"/>'
          + '<stop offset="100%" stop-color="' + (isN ? '#223366' : sc.sky2) + '"/>'
          + '</linearGradient></defs>';
        svg += '<rect width="' + w + '" height="' + h + '" fill="url(#sh-sky-cc)"/>';
        svg += '<rect x="0" y="' + bY + '" width="' + w + '" height="' + (h - bY) + '" fill="' + sc.ground + '"/>';
        svg = _shCustomCodeFn(svg, w, h, bY, bCol, wc, ol, isN, mt, w1, w2, w3, sc);
        svg = shApplyWorldFX(svg, w, h, bY, mt, ps, isN);
        svg += '</svg>';
        // Guard: detect leftover template fragments / broken attrs before injecting.
        // LLM-generated code sometimes leaves un-evaluated ${…} or stray } inside
        // attribute values (e.g. ry="…2}") which the SVG renderer then spams to
        // the console every frame. Stop the loop on first detection and toast.
        if (/=\s*["'][^"']*[{}][^"']*["']/.test(svg)) {
          _sh.previewRafId = null;
          _shCustomCodeFn = null;
          if (typeof shToast === 'function') shToast('Cena contém código SVG inválido — use o Editor para corrigir ou regenerar.');
          console.warn('[shaders] aborted custom-code loop — malformed attribute detected in scene', sc && sc.id);
          return;
        }
        // Guard: detect malformed <path d="…"> (e.g. command expecting another
        // coordinate but the value was truncated). Cheap check: each d attribute
        // must end with either a command letter (MLHVCSQTAZmlhvcsqtaz) or the
        // operand count of its last command must be a multiple of its stride.
        if (!_shValidatePaths(svg)) {
          _sh.previewRafId = null;
          _shCustomCodeFn = null;
          if (typeof shToast === 'function') shToast('Cena contém <path> com d inválido — use o Editor para regenerar.');
          console.warn('[shaders] aborted custom-code loop — invalid path d in scene', sc && sc.id);
          return;
        }
        el2.innerHTML = svg;
        shApplyPostFxRuntime(svg);
        shUpdatePreviewHUD(sc);
      } catch (runErr) { /* silent — bad frame, keep loop alive */ }
      _sh.previewRafId = requestAnimationFrame(loop);
    }
    _sh.previewRafId = requestAnimationFrame(loop);
  }

  /* ═════════════════════════════════════════════════════════════
     SHOW / HIDE VIEW
     ═════════════════════════════════════════════════════════════ */
  window.shadersShowView = function () {
    var hide = ['chatHeader', 'welcomeState', 'chatLog', 'chatCompose', 'chatToolbar'];
    hide.forEach(function (id) { var el = document.getElementById(id); if (el) el.style.display = 'none'; });
    // Collapse main-content so shaders-view gets the full flex:1 width
    var mc = document.querySelector('.main-content');
    if (mc) { mc._shDisplay = mc.style.display; mc.style.display = 'none'; }
    // Hide other views
    if (typeof aexHideMain === 'function') aexHideMain();
    ['listeningView', 'studioView', 'descobertaView', 'memoryView', 'spacesView', 'mermaidView'].forEach(function (vid) {
      var v = document.getElementById(vid); if (v) { v.classList.remove('active'); }
    });
    var sv = document.getElementById('shadersView');
    if (sv) { sv.style.display = ''; sv.classList.add('active'); }
    var op = document.getElementById('outputPanel'), bp = document.getElementById('browserPanel');
    if (op) { op._shPrevOpen = op.classList.contains('open'); op.classList.remove('open'); }
    if (bp) { bp._shPrevOpen = bp.classList.contains('open'); bp.classList.remove('open'); }
    shLoadState();
    shAutoLoadScenes();
    shAutoLoadAssets();
    shBuildSceneList();
    shUpdateStats();
    // Restore scene mode from saved state (applies 3D/2D UI)
    window.shSetSceneMode(_sh.sceneMode || '2d');
    if (_sh.activeScene) shSelectScene(_sh.activeScene);
    else if (SH_SCENES.length) shSelectScene(SH_SCENES[0].id);
    if (_sh.sceneMode !== '3d') shStartPreviewLoop();
    if (!_shPanelCtxListenerBound) {
      window.addEventListener('olivia:panel-context-updated', _shUpdatePanelContextIndicator);
      _shPanelCtxListenerBound = true;
    }
    _shUpdatePanelContextIndicator();
    if (typeof shRefreshTaskPreview === 'function') shRefreshTaskPreview();
    if (typeof shSyncWorldUI === 'function') shSyncWorldUI();
    if (typeof shSyncPostFxUI === 'function') shSyncPostFxUI();
    if (typeof window.shToggleBrainChatSize === 'function') window.shToggleBrainChatSize(!!_sh.brainChatExpanded);
  };

  window.shadersHideView = function () {
    var sv = document.getElementById('shadersView');
    if (sv) { sv.classList.remove('active'); }
    // Restore main-content
    var mc = document.querySelector('.main-content');
    if (mc) { mc.style.display = mc._shDisplay !== undefined ? mc._shDisplay : ''; delete mc._shDisplay; }
    var show = ['chatHeader', 'welcomeState', 'chatLog', 'chatCompose', 'chatToolbar'];
    show.forEach(function (id) { var el = document.getElementById(id); if (el) el.style.display = ''; });
    var op = document.getElementById('outputPanel'), bp = document.getElementById('browserPanel');
    if (op && op._shPrevOpen) op.classList.add('open');
    if (bp && bp._shPrevOpen) bp.classList.add('open');
    shStopPreviewLoop();
    if (typeof window.sh3dCleanup === 'function') window.sh3dCleanup();
  };

  window.shadersRefresh = function () { shBuildSceneList(); shUpdateStats(); };

  /* ═════════════════════════════════════════════════════════════
     SCENE LIST (sidebar gallery)
     ═════════════════════════════════════════════════════════════ */
  function shBuildSceneList() {
    var list = document.getElementById('shSceneList');
    if (!list) return;
    var mode = _sh.viewMode || 'list';
    list.className = 'sh-scenes' + (mode === 'grid' ? ' grid' : mode === 'compact' ? ' compact' : '');
    var all = SH_SCENES.concat(_sh.customScenes);
    var html = '';
    all.forEach(function (sc) {
      var isActive = _sh.activeScene === sc.id;
      var badge = sc.type === '3d'
        ? '<span class="sh-scene-card-badge sh3d-badge">3D</span>'
        : (sc.category === 'custom'
          ? '<span class="sh-scene-card-badge custom">custom</span>'
          : (sc.category === 'landmark' ? '<span class="sh-scene-card-badge">landmark</span>' : ''));
      var tip = (sc.name || '') + (sc.desc ? ' — ' + sc.desc : '');
      html += '<div class="sh-scene-card' + (isActive ? ' active' : '') + '" data-id="' + sc.id + '" title="' + String(tip).replace(/"/g, '&quot;') + '" onclick="shCardClick(\'' + sc.id + '\')">'
        + '<div class="sh-scene-card-icon">' + sc.icon + '</div>'
        + '<div class="sh-scene-card-body">'
        + '<div class="sh-scene-card-name">' + sc.name + '</div>'
        + '<div class="sh-scene-card-desc">' + (sc.desc || '') + '</div>'
        + '</div>'
        + badge
        + '</div>';
    });
    list.innerHTML = html;
  }

  window.shCardClick = function (id) { shSelectScene(id); };

  function shSelectScene(id) {
    _sh.activeScene = id;
    var all = SH_SCENES.concat(_sh.customScenes);
    var sc = all.find(function (s) { return s.id === id; });
    if (!sc) return;

    // Highlight in list
    document.querySelectorAll('.sh-scene-card').forEach(function (el) {
      el.classList.toggle('active', el.dataset.id === id);
    });

    // ── 3D or Hybrid scene: delegate to Three.js engine + restore extras ──
    if (sc.type === '3d' || sc.type === 'hybrid') {
      _sh.activeScene = id;
      // For hybrid: render the 2D SVG ONCE first so it shows behind the 3D canvas
      if (sc.type === 'hybrid') {
        try { shRenderPreview(sc); } catch (e) { console.warn('[shaders] 2D pre-render failed', e); }
      }
      if (_sh.sceneMode !== '3d') window.shSetSceneMode('3d');
      // If 3D activation failed (WebGL unavailable), show metadata and bail
      if (_sh.sceneMode !== '3d') {
        shFillMetaForm(sc);
        shSaveState();
        return;
      }
      if (typeof window.sh3dApplyConfig === 'function') window.sh3dApplyConfig(sc);
      // Restore full snapshot if available
      if (sc.scene3d && typeof window.sh3dRestoreState === 'function') {
        try { window.sh3dRestoreState(sc.scene3d); } catch (e) { console.warn('[shaders] restore failed', e); }
      }
      if (sc.type === 'hybrid' && typeof window.sh3dSetHybrid2D === 'function') {
        window.sh3dSetHybrid2D(true);
      }
      shFillMetaForm(sc);
      shSaveState();
      return;
    }

    // ── 2D SVG scene ──
    if (_sh.sceneMode === '3d') window.shSetSceneMode('2d');
    // Update meta form
    shFillMetaForm(sc);
    // Update editor code (loads sc.code if available, else generates template)
    shLoadSceneCode(sc, function () {
      // Render preview — if scene has custom code, run the custom animated loop
      if (sc.code) {
        shStopPreviewLoop();
        _shStartCustomCodeLoop(sc, sc.code);
      } else {
        shRenderPreview(sc);
      }
      // Save
      shSaveState();
    });
  }

  /* ─ updateStats: include 3D count ─────────────────────────── */
  function shUpdateStats() {
    var all = SH_SCENES.concat(_sh.customScenes);
    var el1 = document.getElementById('shStatScenes');
    var el2 = document.getElementById('shStatCustom');
    var el3 = document.getElementById('shStatAnimated');
    var el4 = document.getElementById('shStat3D');
    if (el1) el1.textContent = all.length;
    if (el2) el2.textContent = _sh.customScenes.length;
    var animated = all.filter(function (s) { return s.id === 'london' || s.id === 'windmill_canal' || s.category === 'custom'; }).length;
    if (el3) el3.textContent = animated;
    var count3d = _sh.customScenes.filter(function (s) { return s.type === '3d'; }).length;
    if (el4) el4.textContent = count3d;
  }

  /* ═════════════════════════════════════════════════════════════
     VIEW MODE TOGGLE
     ═════════════════════════════════════════════════════════════ */
  window.shSetViewMode = function (mode) {
    _sh.viewMode = mode;
    document.querySelectorAll('.sh-gallery-actions button').forEach(function (b) {
      b.classList.toggle('active', b.dataset.mode === mode);
    });
    shBuildSceneList();
    shSaveState();
  };

  /* ═════════════════════════════════════════════════════════════
     SCENE MODE: 2D (SVG) ↔ 3D (WebGL/Three.js)
     ═════════════════════════════════════════════════════════════ */
  window.shSetSceneMode = function (mode) {
    if (mode !== '2d' && mode !== '3d') return;
    _sh.sceneMode = mode;
    var is3d = mode === '3d';

    // Mode toggle buttons
    document.querySelectorAll('.sh-mode-btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.mode === mode);
    });
    // Show/hide mode-specific buttons in header
    document.querySelectorAll('.sh3d-only').forEach(function (el) { el.style.display = is3d ? '' : 'none'; });
    document.querySelectorAll('.sh2d-only').forEach(function (el) { el.style.display = is3d ? 'none' : ''; });
    // Show/hide 3D settings section
    var s3dSec = document.getElementById('sh3dSettingsSection');
    if (s3dSec) s3dSec.style.display = is3d ? '' : 'none';
    // Show 3D stat
    document.querySelectorAll('.sh-stat.sh3d-only').forEach(function (el) { el.style.display = is3d ? '' : 'none'; });
    // 3D brainstorm quick buttons
    document.querySelectorAll('.btn.sh3d-only').forEach(function (el) { el.style.display = is3d ? '' : 'none'; });

    if (is3d) {
      shStopPreviewLoop();
      if (typeof window.sh3dActivate === 'function') window.sh3dActivate();
      // If 3D activation failed (WebGL unavailable), revert to 2D cleanly
      if (typeof window.sh3dIsActive === 'function' && !window.sh3dIsActive()) {
        _sh.sceneMode = '2d';
        is3d = false;
        document.querySelectorAll('.sh-mode-btn').forEach(function (b) {
          b.classList.toggle('active', b.dataset.mode === '2d');
        });
        document.querySelectorAll('.sh3d-only').forEach(function (el) { el.style.display = 'none'; });
        document.querySelectorAll('.sh2d-only').forEach(function (el) { el.style.display = ''; });
        var s3dSec = document.getElementById('sh3dSettingsSection');
        if (s3dSec) s3dSec.style.display = 'none';
        document.querySelectorAll('.sh-stat.sh3d-only').forEach(function (el) { el.style.display = 'none'; });
        document.querySelectorAll('.btn.sh3d-only').forEach(function (el) { el.style.display = 'none'; });
        if (typeof window.shToast === 'function') window.shToast('3D mode not available (WebGL disabled)');
        return;
      }
      // If active scene is a 3D scene, apply its config
      var all3d = SH_SCENES.concat(_sh.customScenes);
      var active = all3d.find(function (s) { return s.id === _sh.activeScene; });
      if (active && active.type === '3d' && typeof window.sh3dApplyConfig === 'function') {
        window.sh3dApplyConfig(active);
      }
    } else {
      if (typeof window.sh3dDeactivate === 'function') window.sh3dDeactivate();
      shStartPreviewLoop();
      var allSc = SH_SCENES.concat(_sh.customScenes);
      var activeSc = allSc.find(function (s) { return s.id === _sh.activeScene; });
      if (activeSc && activeSc.type !== '3d') shSelectScene(activeSc.id);
    }
    shSaveState();
  };

  /* ── Register/update a 3D scene from scene3d.js callback ─── */
  window.shRegister3DScene = function (cfg) {
    if (!cfg || !cfg.type) cfg = Object.assign({ type: '3d' }, cfg || {});
    var id = cfg.id || ('3d-' + (cfg.name || 'scene').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now());
    cfg.id = id;
    if (!cfg.icon) cfg.icon = '🧊';
    if (!cfg.name) cfg.name = '3D Scene';
    if (!cfg.category) cfg.category = '3d';
    var idx = _sh.customScenes.findIndex(function (s) { return s.id === id; });
    if (idx >= 0) _sh.customScenes[idx] = cfg;
    else _sh.customScenes.push(cfg);
    _sh.activeScene = id;
    shBuildSceneList();
    shUpdateStats();
    shSaveState();
  };

  window.shSwitchTab = function (tab) {
    _sh.activeTab = tab;
    document.querySelectorAll('.sh-content-tab').forEach(function (t) {
      t.classList.toggle('active', t.dataset.tab === tab);
    });
    document.querySelectorAll('.sh-panel').forEach(function (p) {
      p.classList.toggle('active', p.id === 'shPanel-' + tab);
    });
    if (tab === 'preview') shStartPreviewLoop();
    else shStopPreviewLoop();
    // In 3D mode, preview tab = keep 3D loop alive
    if (tab === 'preview' && _sh.sceneMode === '3d') {
      shStopPreviewLoop(); // stop 2D
      if (typeof window.sh3dActivate === 'function' && typeof window.sh3dIsActive === 'function' && !window.sh3dIsActive()) {
        window.sh3dActivate();
      }
    }
    if (tab === 'brainstorm') shBuildMappingCards();
    if (tab === 'brainstorm') _shUpdatePanelContextIndicator();
    if (tab === 'brainstorm' && typeof shRefreshTaskPreview === 'function') shRefreshTaskPreview();
    if (tab === 'settings' && typeof shSyncWorldUI === 'function') shSyncWorldUI();
  };

  /* ═════════════════════════════════════════════════════════════
     SVG PREVIEW RENDERER
     ═════════════════════════════════════════════════════════════ */
  function shApplyWorldFX(svg, w, h, bY, mt, ps, isN) {
    var weather = Math.max(0, Math.min(1, Number(ps.weatherIntensity || 0)));
    var cycle = Math.max(0, Math.min(1, Number(ps.dayNightCycle || 0.5)));
    var rot = Math.max(-30, Math.min(30, Number(ps.rotation3D || 0)));

    // Global tint driven by day/night cycle.
    var nightOpacity = (1 - cycle) * 0.22;
    if (nightOpacity > 0.01) {
      svg += '<rect x="0" y="0" width="' + w + '" height="' + h + '" fill="#10213f" opacity="' + nightOpacity.toFixed(3) + '"/>';
    }

    // Weather overlay: deterministic rain streaks + subtle ground haze.
    if (weather > 0.03) {
      var drops = Math.max(6, Math.floor(36 * weather));
      for (var i = 0; i < drops; i++) {
        var seed = i * 19.37;
        var x = ((i * 73) % w) + Math.sin(mt * 0.8 + seed) * 9;
        var y0 = ((i * 41) % h) + (mt * 180 * weather % (h + 50)) - 50;
        var y1 = y0 + 10 + weather * 12;
        var op = 0.07 + weather * 0.22;
        svg += '<line x1="' + x.toFixed(2) + '" y1="' + y0.toFixed(2) + '" x2="' + (x - 2).toFixed(2) + '" y2="' + y1.toFixed(2) + '" stroke="#9fc8e8" stroke-width="1" opacity="' + op.toFixed(3) + '"/>';
      }
      var fogOp = Math.min(0.2, weather * 0.22) * (isN ? 1.2 : 0.9);
      svg += '<rect x="0" y="' + (bY - 18).toFixed(2) + '" width="' + w + '" height="' + (h - bY + 18).toFixed(2) + '" fill="#a7bfd1" opacity="' + fogOp.toFixed(3) + '"/>';
    }

    // Rotation hint: adds subtle directional light sweep linked to rotation control.
    if (Math.abs(rot) > 1) {
      var sweepOp = Math.min(0.12, Math.abs(rot) / 300);
      var skew = Math.abs(rot) * 2.2;
      if (rot > 0) {
        svg += '<polygon points="0,0 ' + (w * 0.45).toFixed(1) + ',0 ' + (w * 0.45 + skew).toFixed(1) + ',' + h + ' 0,' + h + '" fill="#ffffff" opacity="' + sweepOp.toFixed(3) + '"/>';
      } else {
        svg += '<polygon points="' + w + ',0 ' + (w * 0.55).toFixed(1) + ',0 ' + (w * 0.55 - skew).toFixed(1) + ',' + h + ' ' + w + ',' + h + '" fill="#ffffff" opacity="' + sweepOp.toFixed(3) + '"/>';
      }
    }

    return svg;
  }

  function shClamp(num, min, max) {
    var n = Number(num);
    if (!Number.isFinite(n)) n = min;
    return Math.min(max, Math.max(min, n));
  }

  function shNormalizePostFx(raw) {
    var src = raw && typeof raw === 'object' ? raw : {};
    return {
      bloom: shClamp(src.bloom, 0, 1),
      chromaticAberration: shClamp(src.chromaticAberration, 0, 0.03),
      vignette: shClamp(src.vignette, 0, 1),
      grain: shClamp(src.grain, 0, 0.6),
      blur: shClamp(src.blur, 0, 6),
      saturation: shClamp(src.saturation === undefined ? 1 : src.saturation, 0.2, 2),
      contrast: shClamp(src.contrast === undefined ? 1 : src.contrast, 0.5, 2),
      hueShift: shClamp(src.hueShift === undefined ? 0 : src.hueShift, -180, 180),
      warmth: shClamp(src.warmth === undefined ? 0 : src.warmth, -1, 1),
      brightness: shClamp(src.brightness === undefined ? 1 : src.brightness, 0.3, 2),
      temperature: shClamp(src.temperature === undefined ? 6500 : src.temperature, 2000, 10000),
      sepia: shClamp(src.sepia === undefined ? 0 : src.sepia, 0, 1),
      lensFlare: shClamp(src.lensFlare === undefined ? 0 : src.lensFlare, 0, 1),
      celShading: shClamp(src.celShading === undefined ? 0 : src.celShading, 0, 1),
    };
  }

  function shApplyPostFxRuntime(svgMarkup) {
    var main = document.getElementById('shPreviewSVG');
    if (!main) return;

    var fx = shNormalizePostFx(_sh.postFx);
    _sh.postFx = fx;

    var bloomPx = (fx.bloom * 16).toFixed(2);
    var bloomAlpha = (0.12 + fx.bloom * 0.32).toFixed(3);
    // warmth adds sepia and a mild hue bias (+warm = toward red, -warm = toward blue)
    var warmthSepia = Math.max(0, fx.warmth) * 0.35;
    var warmthHue = -fx.warmth * 18; // deg
    // temperature (K) mapped to hue offset: 6500K neutral, cooler negative, warmer positive
    var tempHue = ((fx.temperature - 6500) / 6500) * 28;
    var totalHue = (fx.hueShift + warmthHue + tempHue).toFixed(2);
    var totalSepia = Math.min(1, fx.sepia + warmthSepia).toFixed(3);
    // cel shading: boost contrast and slightly saturate
    var celContrast = 1 + fx.celShading * 0.8;
    var celSat = 1 + fx.celShading * 0.4;
    var finalContrast = (fx.contrast * celContrast).toFixed(3);
    var finalSat = (fx.saturation * celSat).toFixed(3);

    var filter = 'brightness(' + fx.brightness.toFixed(3) + ') '
      + 'saturate(' + finalSat + ') '
      + 'contrast(' + finalContrast + ')';
    if (Math.abs(fx.hueShift + warmthHue + tempHue) > 0.1) filter += ' hue-rotate(' + totalHue + 'deg)';
    if (parseFloat(totalSepia) > 0.001) filter += ' sepia(' + totalSepia + ')';
    if (fx.blur > 0.01) filter += ' blur(' + fx.blur.toFixed(2) + 'px)';
    if (fx.bloom > 0.01) filter += ' drop-shadow(0 0 ' + bloomPx + 'px rgba(255,220,170,' + bloomAlpha + '))';
    main.style.filter = filter;

    var chromaR = document.getElementById('shPreviewChromaR');
    var chromaB = document.getElementById('shPreviewChromaB');
    var grain = document.getElementById('shPreviewGrain');
    var vignette = document.getElementById('shPreviewVignette');
    var markup = typeof svgMarkup === 'string' ? svgMarkup : main.innerHTML;

    if (chromaR && chromaB) {
      if (fx.chromaticAberration > 0.0001) {
        if (markup) {
          chromaR.innerHTML = markup;
          chromaB.innerHTML = markup;
        }
        var px = Math.max(0.25, fx.chromaticAberration * 220);
        chromaR.style.opacity = Math.min(0.35, fx.chromaticAberration * 26).toFixed(3);
        chromaB.style.opacity = Math.min(0.35, fx.chromaticAberration * 26).toFixed(3);
        chromaR.style.transform = 'translateX(' + px.toFixed(2) + 'px)';
        chromaB.style.transform = 'translateX(' + (-px).toFixed(2) + 'px)';
      } else {
        chromaR.style.opacity = '0';
        chromaB.style.opacity = '0';
        chromaR.innerHTML = '';
        chromaB.innerHTML = '';
      }
    }

    if (grain) {
      grain.style.opacity = fx.grain.toFixed(3);
    }
    if (vignette) {
      vignette.style.opacity = fx.vignette.toFixed(3);
    }

    // Lens flare overlay (created on demand)
    var flare = document.getElementById('shPreviewLensFlare');
    var fxLayer = document.getElementById('shPreviewFxLayer');
    if (!flare && fxLayer && fx.lensFlare > 0.001) {
      flare = document.createElement('div');
      flare.id = 'shPreviewLensFlare';
      flare.className = 'sh-preview-lensflare';
      fxLayer.appendChild(flare);
    }
    if (flare) {
      flare.style.opacity = fx.lensFlare.toFixed(3);
    }
  }

  function shApplyPostFxObject(rawPostFx, options) {
    _sh.postFx = shNormalizePostFx(rawPostFx);
    shApplyPostFxRuntime();
    shSyncPostFxUI();
    shUpdateRuntimeDiagnostics();
    shSaveState(options && options.skipBridge);
  }

  /* ── PostFX slider control ── */
  var _shPostFxSliderMap = {
    bloom: { slider: 'shFxBloom', val: 'shFxBloomVal', dec: 2 },
    chromaticAberration: { slider: 'shFxChroma', val: 'shFxChromaVal', dec: 3 },
    vignette: { slider: 'shFxVignette', val: 'shFxVignetteVal', dec: 2 },
    grain: { slider: 'shFxGrain', val: 'shFxGrainVal', dec: 2 },
    blur: { slider: 'shFxBlur', val: 'shFxBlurVal', dec: 2 },
    saturation: { slider: 'shFxSat', val: 'shFxSatVal', dec: 2 },
    contrast: { slider: 'shFxContrast', val: 'shFxContrastVal', dec: 2 },
    hueShift: { slider: 'shFxHue', val: 'shFxHueVal', dec: 0 },
    warmth: { slider: 'shFxWarmth', val: 'shFxWarmthVal', dec: 2 },
    brightness: { slider: 'shFxBright', val: 'shFxBrightVal', dec: 2 },
    temperature: { slider: 'shFxTemp', val: 'shFxTempVal', dec: 0 },
    sepia: { slider: 'shFxSepia', val: 'shFxSepiaVal', dec: 2 },
    lensFlare: { slider: 'shFxLens', val: 'shFxLensVal', dec: 2 },
    celShading: { slider: 'shFxCel', val: 'shFxCelVal', dec: 2 },
  };

  window.shSetPostFxSlider = function (key, val) {
    var v = parseFloat(val);
    if (!Number.isFinite(v)) return;
    _sh.postFx[key] = v;
    _sh.postFx = shNormalizePostFx(_sh.postFx);
    var m = _shPostFxSliderMap[key];
    if (m) {
      var el = document.getElementById(m.val);
      if (el) el.textContent = v.toFixed(m.dec);
      var asEl = document.getElementById('as_' + m.val);
      if (asEl) asEl.textContent = v.toFixed(m.dec);
      // mirror slider position into the panel that wasn't being dragged
      var sl = document.getElementById(m.slider);
      if (sl && Math.abs(parseFloat(sl.value) - v) > 1e-6) sl.value = v;
      var asSl = document.getElementById('as_' + m.slider);
      if (asSl && Math.abs(parseFloat(asSl.value) - v) > 1e-6) asSl.value = v;
    }
    shApplyPostFxRuntime();
    shSaveState();
  };

  window.shResetPostFx = function () {
    _sh.postFx = {
      bloom: 0.08,
      chromaticAberration: 0.0,
      vignette: 0.15,
      grain: 0.0,
      blur: 0.0,
      saturation: 1.0,
      contrast: 1.0,
      hueShift: 0,
      warmth: 0,
      brightness: 1.0,
      temperature: 6500,
      sepia: 0.0,
      lensFlare: 0.0,
      celShading: 0.0,
    };
    shApplyPostFxRuntime();
    shSyncPostFxUI();
    shSaveState();
    shToast('Visual effects reset');
  };

  function shSyncPostFxUI() {
    var fx = _sh.postFx;
    Object.keys(_shPostFxSliderMap).forEach(function (key) {
      var m = _shPostFxSliderMap[key];
      var sl = document.getElementById(m.slider);
      var vl = document.getElementById(m.val);
      var v = fx[key];
      if (v === undefined) return;
      if (sl) sl.value = v;
      if (vl) vl.textContent = v.toFixed(m.dec);
      // mirror into aside (as_ prefix)
      var asSl = document.getElementById('as_' + m.slider);
      var asVl = document.getElementById('as_' + m.val);
      if (asSl) asSl.value = v;
      if (asVl) asVl.textContent = v.toFixed(m.dec);
    });
  }

  function shRenderPreview(sc) {
    if (!sc) return;
    var el = document.getElementById('shPreviewSVG');
    if (!el) return;
    var rect = el.parentElement.getBoundingClientRect();
    var w = rect.width || 800, h = rect.height || 500;
    var ps = _sh.previewState;
    var ol = ps.outline || 2.5;
    var isN = ps.tod < 5 || ps.tod > 20;
    var isD = (ps.tod >= 17 && ps.tod <= 20) || (ps.tod >= 5 && ps.tod < 7);
    var dim = isN ? 0.4 : isD ? 0.7 : 1;
    var mt = Date.now() * 0.001 * (ps.timeSpeed || 1) * Math.max((ps.bgmorph || 0.3) + 0.5, 0.3);
    var w1 = Math.sin(mt) * 0.5 + 0.5;
    var w2 = Math.sin(mt * 1.7 + 2.5) * 0.5 + 0.5;
    var w3 = Math.sin(mt * 2.3 + 4.8) * 0.5 + 0.5;
    var bY = h * 0.65 + 20;
    var bCol = sc.bld, wc = isN ? '#F0C860' : '#3A3228';

    var svg = '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" xmlns="http://www.w3.org/2000/svg" style="filter:brightness(' + dim + ')">';

    // Sky gradient
    svg += '<defs><linearGradient id="sh-sky" x1="0" y1="0" x2="0" y2="1">'
      + '<stop offset="0%" stop-color="' + sc.sky1 + '"/>'
      + '<stop offset="100%" stop-color="' + sc.sky2 + '"/>'
      + '</linearGradient></defs>';
    svg += '<rect x="0" y="0" width="' + w + '" height="' + h + '" fill="url(#sh-sky)"/>';

    // Sun or moon
    if (isN) {
      var moonX = w * 0.78, moonY = h * 0.12;
      svg += '<circle cx="' + moonX + '" cy="' + moonY + '" r="18" fill="#E8E0C0" opacity="0.85"/>';
      svg += '<circle cx="' + (moonX + 5) + '" cy="' + (moonY - 3) + '" r="15" fill="' + sc.sky1 + '"/>';
      // Stars
      for (var s = 0; s < 12; s++) {
        var sx = w * (0.05 + s * 0.08), sy = h * (0.04 + Math.sin(s * 2.7) * 0.08);
        var sop = 0.3 + Math.sin(mt * 1.5 + s * 1.1) * 0.3;
        svg += '<circle cx="' + sx + '" cy="' + sy + '" r="1.2" fill="#FFF" opacity="' + sop + '"/>';
      }
    } else {
      var sunX = w * 0.75, sunY = h * 0.15;
      svg += '<circle cx="' + sunX + '" cy="' + sunY + '" r="22" fill="#FFD700" opacity="0.7"/>';
      svg += '<circle cx="' + sunX + '" cy="' + sunY + '" r="30" fill="#FFD700" opacity="0.08"/>';
    }

    // Ground
    svg += '<path d="M0 ' + (bY - 10) + ' Q' + w * 0.15 + ' ' + (bY - 40) + ',' + w * 0.3 + ' ' + bY + ' Q' + w * 0.5 + ' ' + (bY + 30) + ',' + w * 0.7 + ' ' + (bY - 15) + ' Q' + w * 0.85 + ' ' + (bY - 40) + ',' + w + ' ' + bY + ' L' + w + ' ' + h + ' L0 ' + h + 'Z" fill="' + sc.ground + '" stroke="#2A3A22" stroke-width="' + (ol * 0.7) + '" opacity="0.85"/>';

    // ── Scene-specific rendering (ported from shaderbench.html renderSVG) ──
    var mod = ps.era >= 1920;

    if (sc.id === 'castle') {
      let cx = w * 0.42, cy = bY - 70;
      svg += `<rect x="${cx - 55}" y="${cy}" width="110" height="70" rx="2" fill="${bCol}" stroke="#3A3228" stroke-width="${ol}"/>`;
      svg += `<rect x="${cx - 65}" y="${cy - 45}" width="22" height="45" rx="1" fill="${bCol}" stroke="#3A3228" stroke-width="${ol}"/>`;
      svg += `<rect x="${cx + 43}" y="${cy - 35}" width="22" height="35" rx="1" fill="${bCol}" stroke="#3A3228" stroke-width="${ol}"/>`;
      for (let i = 0; i < 5; i++)svg += `<rect x="${cx - 50 + i * 22}" y="${cy - 6}" width="12" height="6" fill="${bCol}" stroke="#3A3228" stroke-width="${ol * 0.6}"/>`;
      svg += `<line x1="${cx - 54}" y1="${cy - 45}" x2="${cx - 54}" y2="${cy - 68}" stroke="#3A3228" stroke-width="${ol * 0.5}"/>`;
      svg += `<path d="M${cx - 54} ${cy - 68} L${cx - 36} ${cy - 62} L${cx - 54} ${cy - 56}" fill="#B83A3A" stroke="#3A3228" stroke-width="${ol * 0.4}"/>`;
      svg += `<path d="M${cx - 80} ${bY} Q${cx - 70} ${bY - 25},${cx - 65} ${cy + 70} L${cx + 65} ${cy + 70} Q${cx + 70} ${bY - 25},${cx + 80} ${bY}" fill="#5A5040" stroke="#3A3228" stroke-width="${ol}"/>`;
      for (let i = 0; i < 3; i++)svg += `<rect x="${cx - 35 + i * 28}" y="${cy + 18}" width="9" height="12" rx="4.5" fill="${wc}" opacity="${isN ? 0.7 : 0.2}"/>`;
      if (isN) for (let i = 0; i < 3; i++)svg += `<circle cx="${cx - 30 + i * 28}" cy="${cy + 24}" r="10" fill="${wc}" opacity="0.06"/>`;

    } else if (sc.id === 'oldtown') {
      for (let i = 0; i < 7; i++) {
        let bx2 = w * 0.12 + i * (w * 0.11), bh2 = 55 + Math.sin(i * 2.3) * 25 + (mod ? 25 : 0), bw2 = 32 + Math.sin(i * 1.7) * 8;
        svg += `<rect x="${bx2}" y="${bY - bh2}" width="${bw2}" height="${bh2}" rx="2" fill="${bCol}" stroke="#3A3228" stroke-width="${ol}"/>`;
        svg += `<rect x="${bx2 + bw2 * 0.3}" y="${bY - bh2 - 10}" width="5" height="10" fill="${bCol}" stroke="#3A3228" stroke-width="${ol * 0.5}"/>`;
        for (let r = 0; r < Math.floor(bh2 / 16); r++) {
          let wy2 = bY - bh2 + 10 + r * 14;
          svg += `<rect x="${bx2 + 5}" y="${wy2}" width="7" height="9" rx="3" fill="${wc}" opacity="${isN ? 0.6 : 0.15}"/>`;
          svg += `<rect x="${bx2 + bw2 - 12}" y="${wy2}" width="7" height="9" rx="3" fill="${wc}" opacity="${isN ? 0.5 : 0.15}"/>`;
        }
      }

    } else if (sc.id === 'arthurs') {
      let px = w * 0.5, py = bY - 120;
      svg += `<path d="M${w * 0.2} ${bY} Q${w * 0.3} ${bY - 50},${px - 35} ${py + 15} Q${px - 8} ${py},${px} ${py} Q${px + 8} ${py},${px + 35} ${py + 15} Q${w * 0.7} ${bY - 50},${w * 0.8} ${bY}" fill="${sc.ground}" stroke="#2A4A2A" stroke-width="${ol}"/>`;
      for (let i = 0; i < 4; i++) {
        let gx = w * 0.25 + i * w * 0.14, gy = bY - 25 - Math.sin(i * 3.7) * 12;
        svg += `<ellipse cx="${gx}" cy="${gy}" rx="${8 + Math.sin(i * 2.1) * 5}" ry="${5 + Math.sin(i * 1.3) * 3}" fill="#8A9A30" stroke="#5A6A20" stroke-width="${ol * 0.4}" opacity="0.6"/>`;
      }

    } else if (sc.id === 'calton') {
      let mx2 = w * 0.45, my2 = bY - 50;
      svg += `<rect x="${mx2 - 35}" y="${my2}" width="70" height="6" fill="${sc.acc}" stroke="#3A3228" stroke-width="${ol * 0.7}"/>`;
      for (let i = 0; i < 5; i++)svg += `<rect x="${mx2 - 28 + i * 12}" y="${my2 - 35}" width="4" height="35" rx="2" fill="#AEA99E" stroke="#3A3228" stroke-width="${ol * 0.6}"/>`;
      svg += `<path d="M${mx2 - 33} ${my2 - 35} L${mx2} ${my2 - 48} L${mx2 + 33} ${my2 - 35}" fill="#AEA99E" stroke="#3A3228" stroke-width="${ol * 0.7}"/>`;
      svg += `<rect x="${mx2 + 60}" y="${my2 - 70}" width="10" height="70" fill="#8B8578" stroke="#3A3228" stroke-width="${ol}"/>`;

    } else if (sc.id === 'leith') {
      svg += `<rect x="0" y="${bY + 8}" width="${w}" height="${h - bY - 8}" fill="#3A6080" opacity="0.5"/>`;
      for (let i = 0; i < 6; i++)svg += `<ellipse cx="${w * 0.08 + i * w * 0.16}" cy="${bY + 25 + i * 2}" rx="25" ry="2" fill="none" stroke="#5A8AAA" stroke-width="0.8" opacity="0.25"/>`;
      for (let i = 0; i < 4; i++) {
        let bx2 = w * 0.12 + i * w * 0.2, bh2 = 35 + Math.sin(i * 3) * 12 + (mod ? 18 : 0);
        svg += `<rect x="${bx2}" y="${bY - bh2}" width="40" height="${bh2}" rx="2" fill="${bCol}" stroke="#3A3228" stroke-width="${ol}"/>`;
      }

    } else if (sc.id === 'greyfriars') {
      let kx = w * 0.4, ky = bY - 65;
      svg += `<rect x="${kx}" y="${ky}" width="60" height="65" rx="2" fill="${bCol}" stroke="#3A3228" stroke-width="${ol}"/>`;
      svg += `<polygon points="${kx + 30},${ky - 28} ${kx - 4},${ky} ${kx + 64},${ky}" fill="${bCol}" stroke="#3A3228" stroke-width="${ol}"/>`;
      svg += `<rect x="${kx + 24}" y="${ky - 50}" width="12" height="26" fill="${bCol}" stroke="#3A3228" stroke-width="${ol}"/>`;
      svg += `<polygon points="${kx + 30},${ky - 65} ${kx + 22},${ky - 50} ${kx + 38},${ky - 50}" fill="#6E6A60" stroke="#3A3228" stroke-width="${ol * 0.7}"/>`;
      for (let i = 0; i < 5; i++) {
        let gx = w * 0.14 + i * w * 0.09 + (i > 2 ? w * 0.18 : 0), gy = bY - 8;
        svg += `<path d="M${gx} ${gy} L${gx} ${gy - 15} Q${gx} ${gy - 20},${gx + 5} ${gy - 20} Q${gx + 10} ${gy - 20},${gx + 10} ${gy - 15} L${gx + 10} ${gy}" fill="#7A7268" stroke="#3A3228" stroke-width="${ol * 0.5}" opacity="0.6"/>`;
      }

    } else if (sc.id === 'london') {
      // ── London Bridge — deterministic morphing + colorful animations ──
      let bx2 = w * 0.5, rw = w * 0.72;
      let bridgeY = bY - 58;
      let riverY = bridgeY + 62, riverH = h - riverY;

      // Thames river
      svg += `<defs><linearGradient id="lg-thames" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#2A5F8A" stop-opacity="0.92"/>
      <stop offset="100%" stop-color="#0E2A42" stop-opacity="1"/>
    </linearGradient></defs>`;
      svg += `<rect x="0" y="${riverY}" width="${w}" height="${riverH}" fill="url(#lg-thames)"/>`;

      // River shimmer
      for (let i = 0; i < 10; i++) {
        let rx = w * 0.05 + i * (w * 0.088), ra = Math.sin(mt * 1.5 + i * 0.97) * 10;
        let rop = 0.15 + Math.sin(mt * 0.8 + i * 1.3) * 0.12;
        svg += `<path d="M${rx} ${riverY + 12} Q${rx + 18} ${riverY + 12 + ra} ${rx + 36} ${riverY + 12}" fill="none" stroke="#7ABFE8" stroke-width="1.5" opacity="${rop}"/>`;
      }

      // Road deck
      let deckH = 14;
      svg += `<rect x="${bx2 - rw / 2}" y="${bridgeY + 32}" width="${rw}" height="${deckH}" rx="2" fill="${bCol}" stroke="#2A2018" stroke-width="${ol}"/>`;

      // Suspension chains
      let chainColors = ['#FF6B6B', '#4ECDC4', '#FFD166', '#06D6A0', '#EF476F'];
      for (let side = 0; side < 2; side++) {
        let anchorX = bx2 + (side ? 1 : -1) * (rw * 0.48);
        let midX = bx2 + (side ? 1 : -1) * (rw * 0.12);
        let sag = 18 + w2 * 12;
        let cc = chainColors[(side * 2) % chainColors.length];
        let cop = 0.55 + w1 * 0.3;
        svg += `<path d="M${anchorX} ${bridgeY} Q${midX} ${bridgeY + sag} ${bx2} ${bridgeY + 10}" fill="none" stroke="${cc}" stroke-width="${2 + w2}" stroke-linecap="round" opacity="${cop}"/>`;
      }

      // Two Gothic towers
      let towerPalette = ['#B8860B', '#C4622D', '#7B5EA7', '#1D8AA8'];
      for (let t = 0; t < 2; t++) {
        let tx = bx2 + (t ? 1 : -1) * (rw * 0.28);
        let tw2 = 38, th2 = 90 + w2 * 18;
        let tcap = towerPalette[t * 2 + 1];
        svg += `<rect x="${tx - tw2 / 2}" y="${bridgeY - th2}" width="${tw2}" height="${th2 + deckH}" rx="3" fill="${bCol}" stroke="#2A2018" stroke-width="${ol}"/>`;
        for (let b = 0; b < 5; b++)svg += `<rect x="${tx - tw2 / 2 + b * 8 + 1}" y="${bridgeY - th2 - 12}" width="5" height="12" rx="1" fill="${bCol}" stroke="#2A2018" stroke-width="${ol * 0.6}"/>`;
        svg += `<path d="M${tx - tw2 / 2 - 6} ${bridgeY - th2} L${tx} ${bridgeY - th2 - 30} L${tx + tw2 / 2 + 6} ${bridgeY - th2}" fill="${tcap}" stroke="#2A2018" stroke-width="${ol * 0.8}" opacity="0.85"/>`;
        svg += `<line x1="${tx}" y1="${bridgeY - th2 - 30}" x2="${tx}" y2="${bridgeY - th2 - 55}" stroke="#2A2018" stroke-width="${ol * 0.5}"/>`;
        svg += `<path d="M${tx} ${bridgeY - th2 - 55} L${tx + 18} ${bridgeY - th2 - 47} L${tx} ${bridgeY - th2 - 39}" fill="#CF1020" stroke="#2A2018" stroke-width="${ol * 0.4}"/>`;
        // Gothic windows with pulsing colour
        for (let row = 0; row < 3; row++) {
          for (let col = 0; col < 2; col++) {
            let wx2 = tx - 10 + col * 20, wy2 = bridgeY - th2 + 16 + row * 22;
            let pulse = Math.sin(mt * 2.5 + t * 3.7 + row * 1.9 + col * 0.8) * 0.5 + 0.5;
            let wc2 = isN ? `rgba(255,210,80,${0.4 + pulse * 0.55})` : `rgba(180,160,120,${0.12 + pulse * 0.08})`;
            svg += `<path d="M${wx2} ${wy2 + 10} L${wx2} ${wy2 + 2} Q${wx2} ${wy2 - 2},${wx2 + 4} ${wy2 - 2} Q${wx2 + 8} ${wy2 - 2},${wx2 + 8} ${wy2 + 2} L${wx2 + 8} ${wy2 + 10}" fill="${wc2}"/>`;
            if (isN) svg += `<ellipse cx="${wx2 + 4}" cy="${wy2 + 5}" rx="10" ry="8" fill="rgba(255,210,80,0.06)"/>`;
          }
        }
        let ringR2 = 22 + w1 * 8, ringOp2 = 0.12 + w3 * 0.14;
        let rc = chainColors[t % chainColors.length];
        svg += `<circle cx="${tx}" cy="${bridgeY - th2 * 0.55}" r="${ringR2}" fill="none" stroke="${rc}" stroke-width="2" opacity="${ringOp2}"/>`;
      }

      // Pedestrian walkway
      if (w > 500) {
        let walkW = rw * 0.56 * 0.5, walkY2 = bridgeY - 35, ah = 16;
        svg += `<rect x="${bx2 - walkW / 2}" y="${walkY2}" width="${walkW}" height="${ah}" rx="3" fill="${bCol}" stroke="#2A2018" stroke-width="${ol * 0.8}" opacity="0.9"/>`;
        for (let pw = 0; pw < 4; pw++) {
          let pwx = bx2 - walkW / 2 + pw * (walkW / 4) + 4;
          let pwpulse = Math.sin(mt * 1.8 + pw * 1.4) * 0.5 + 0.5;
          svg += `<rect x="${pwx}" y="${walkY2 + 3}" width="${walkW / 4 - 8}" height="${ah - 6}" rx="2" fill="rgba(80,190,255,${isN ? 0.35 + pwpulse * 0.35 : 0.08})" stroke="#2A2018" stroke-width="${ol * 0.4}"/>`;
        }
      }

      // London skyline silhouette
      let skyPal = ['#FF6B6B', '#4ECDC4', '#FFD166', '#06D6A0', '#A29BFE', '#EF476F', '#118AB2'];
      let skyB = [{ rx: 0.06, rh: 115, rw: 18, shape: 'shard' }, { rx: 0.14, rh: 68, rw: 22, shape: 'box' }, { rx: 0.22, rh: 50, rw: 28, shape: 'box' }, { rx: 0.68, rh: 55, rw: 24, shape: 'box' }, { rx: 0.76, rh: 80, rw: 16, shape: 'shard' }, { rx: 0.84, rh: 60, rw: 20, shape: 'box' }, { rx: 0.92, rh: 45, rw: 26, shape: 'box' }];
      skyB.forEach(function (b, i) {
        let sbx = w * b.rx, sbY2 = bridgeY - b.rh;
        let sc2 = skyPal[i % skyPal.length];
        if (b.shape === 'shard') {
          svg += `<polygon points="${sbx + b.rw / 2},${sbY2} ${sbx},${bridgeY} ${sbx + b.rw},${bridgeY}" fill="${bCol}" stroke="${sc2}" stroke-width="${ol * 0.6}" opacity="0.75"/>`;
        } else {
          svg += `<rect x="${sbx}" y="${sbY2}" width="${b.rw}" height="${b.rh}" rx="1" fill="${bCol}" stroke="${sc2}" stroke-width="${ol * 0.5}" opacity="0.7"/>`;
        }
        for (let wr = 0; wr < 3; wr++) {
          for (let wc2 = 0; wc2 < 2; wc2++) {
            let wop = Math.sin(mt * 3 + i * 1.7 + wr * 2.1 + wc2) * 0.5 + 0.5;
            svg += `<rect x="${sbx + 3 + wc2 * (b.rw / 2 - 3)}" y="${sbY2 + 8 + wr * 14}" width="4" height="6" rx="1" fill="${sc2}" opacity="${isN ? 0.15 + wop * 0.5 : 0.04 + wop * 0.08}"/>`;
          }
        }
      });

      // Thames boats
      let boatCols = ['#D4A853', '#7A8D9E', '#C45A3A'];
      for (let i = 0; i < 3; i++) {
        let bxb = w * (0.1 + i * 0.28) + Math.sin(mt * 0.4 + i * 2.1) * 25;
        let byb = riverY + 20 + Math.sin(mt * 0.7 + i) * 4;
        svg += `<path d="M${bxb - 18} ${byb} L${bxb + 18} ${byb} L${bxb + 14} ${byb + 9} L${bxb - 14} ${byb + 9}Z" fill="${boatCols[i]}" stroke="#2A2018" stroke-width="${ol * 0.5}"/>`;
        svg += `<rect x="${bxb - 4}" y="${byb - 15}" width="7" height="15" fill="#555" stroke="#2A2018" stroke-width="${ol * 0.3}"/>`;
        if (isN) svg += `<circle cx="${bxb}" cy="${byb - 16}" r="5" fill="${boatCols[i]}" opacity="0.4"/>`;
      }

      // Lamp posts on bridge
      for (let i = 0; i < 5; i++) {
        let lx2 = bx2 - rw * 0.35 + i * (rw * 0.18);
        let lpulse = Math.sin(mt * 2.4 + i * 1.1) * 0.5 + 0.5;
        svg += `<line x1="${lx2}" y1="${bridgeY + 32}" x2="${lx2}" y2="${bridgeY + 2}" stroke="#3A3030" stroke-width="${ol * 0.7}"/>`;
        svg += `<path d="M${lx2} ${bridgeY + 2} Q${lx2 + 10} ${bridgeY + 2},${lx2 + 10} ${bridgeY - 5}" fill="none" stroke="#3A3030" stroke-width="${ol * 0.7}"/>`;
        svg += `<circle cx="${lx2 + 10}" cy="${bridgeY - 5}" r="4" fill="${isN ? '#FFF0A0' : '#8A8070'}" stroke="#3A3030" stroke-width="${ol * 0.4}"/>`;
        if (isN) svg += `<circle cx="${lx2 + 10}" cy="${bridgeY - 5}" r="${14 + lpulse * 4}" fill="rgba(255,230,100,0.04)"/>`;
      }

    } else if (sc.id === 'windmill_canal') {
      // ── Windmill Canal — rotating blades, rippling water, canal boats ──
      let mx2 = w * 0.5, my2 = bY - 85;
      let canalY = h * 0.65, canalH = h - canalY;

      // Canal gradient
      svg += `<defs><linearGradient id="lg-canal" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(110,198,202,${0.7 + w1 * 0.3})"/>
      <stop offset="100%" stop-color="rgba(74,144,148,${0.8 + w2 * 0.2})"/>
    </linearGradient></defs>`;

      // Distant hills
      let hillY = h * 0.55;
      svg += `<path d="M0 ${hillY} Q${w * 0.2} ${hillY - 25},${w * 0.4} ${hillY} T${w * 0.8} ${hillY - 15} T${w} ${hillY} L${w} ${h} L0 ${h}Z" fill="${sc.ground}" opacity="0.7"/>`;

      // Canal water
      svg += `<rect x="0" y="${canalY}" width="${w}" height="${canalH}" fill="url(#lg-canal)"/>`;

      // Windmill building
      let millW = w * 0.15, millH = h * 0.25;
      let millX = mx2 - millW / 2, millY2 = my2 - millH;
      svg += `<rect x="${millX}" y="${millY2}" width="${millW}" height="${millH}" rx="3" fill="${sc.bld}" stroke="#8B6B4A" stroke-width="${ol}"/>`;
      svg += `<polygon points="${mx2},${millY2 - 10} ${millX - 5},${millY2} ${millX + millW + 5},${millY2}" fill="${sc.bld}" stroke="#8B6B4A" stroke-width="${ol}"/>`;

      // Windmill windows
      for (let i = 0; i < 3; i++) {
        let wx2 = millX + millW * 0.25 + i * (millW * 0.25);
        let wy2 = millY2 + millH * 0.3 + i * (millH * 0.2);
        let wpulse = Math.sin(mt * 2.1 + i * 1.7) * 0.5 + 0.5;
        svg += `<rect x="${wx2 - 6}" y="${wy2 - 4}" width="12" height="8" rx="1" fill="rgba(255,255,200,${isN ? 0.4 + wpulse * 0.5 : 0.1})" stroke="#8B6B4A" stroke-width="${ol * 0.5}"/>`;
      }

      // Rotating blades
      let bladeLen = millW * 0.8, bladeAngle = mt * 0.5;
      for (let i = 0; i < 4; i++) {
        let angle = bladeAngle + i * (Math.PI / 2);
        let bxa = mx2 + Math.cos(angle) * bladeLen * 0.1;
        let bya = millY2 + 10 + Math.sin(angle) * bladeLen * 0.1;
        let ex = mx2 + Math.cos(angle) * bladeLen;
        let ey = millY2 + 10 + Math.sin(angle) * bladeLen;
        svg += `<line x1="${bxa}" y1="${bya}" x2="${ex}" y2="${ey}" stroke="#5A4A3A" stroke-width="${ol * 0.8}" stroke-linecap="round"/>`;
        svg += `<rect x="${ex - 3}" y="${ey - 3}" width="6" height="6" rx="1" fill="#8B7A6A" stroke="#5A4A3A" stroke-width="${ol * 0.3}"/>`;
      }

      // Canal boats
      let boatColors2 = ['#D4A76A', '#FF6B6B', '#6EC6CA'];
      for (let i = 0; i < 3; i++) {
        let boatX = w * (0.15 + i * 0.25) + Math.sin(mt * 0.3 + i * 2.1) * 30;
        let boatY = canalY + 15 + Math.sin(mt * 0.5 + i) * 5;
        svg += `<path d="M${boatX - 25} ${boatY} L${boatX + 25} ${boatY} L${boatX + 20} ${boatY + 12} L${boatX - 20} ${boatY + 12}Z" fill="${boatColors2[i]}" stroke="#5A4A3A" stroke-width="${ol * 0.5}"/>`;
        svg += `<rect x="${boatX - 12}" y="${boatY - 18}" width="24" height="18" rx="2" fill="#E8D8B8" stroke="#5A4A3A" stroke-width="${ol * 0.4}"/>`;
        svg += `<line x1="${boatX}" y1="${boatY - 18}" x2="${boatX}" y2="${boatY - 40}" stroke="#8B7A6A" stroke-width="${ol * 0.5}"/>`;
        let flagPulse = Math.sin(mt * 1.8 + i * 1.3) * 0.5 + 0.5;
        svg += `<polygon points="${boatX},${boatY - 40} ${boatX + 15},${boatY - 38} ${boatX},${boatY - 36}" fill="${sc.acc}" opacity="${0.7 + flagPulse * 0.3}"/>`;
      }

      // Water ripples
      for (let i = 0; i < 8; i++) {
        let rippleY = canalY + 5 + i * 8, rippleOff = Math.sin(mt * 0.8 + i * 0.7) * 15;
        svg += `<path d="M${-rippleOff} ${rippleY} Q${w * 0.2} ${rippleY + 3},${w * 0.4} ${rippleY} T${w * 0.8} ${rippleY + 2} T${w + rippleOff} ${rippleY}" fill="none" stroke="rgba(255,255,255,${0.15 + w2 * 0.1})" stroke-width="1.5"/>`;
      }

      // Grass/reeds along canal banks
      for (let i = 0; i < 12; i++) {
        let reedX = w * (0.02 + i * 0.08), reedH = 15 + Math.sin(mt * 0.6 + i * 1.1) * 8;
        svg += `<path d="M${reedX} ${canalY} Q${reedX + 3} ${canalY - reedH * 0.7},${reedX} ${canalY - reedH} Q${reedX - 3} ${canalY - reedH * 0.7},${reedX} ${canalY}" fill="none" stroke="#5A8C5A" stroke-width="${ol * 0.4}" opacity="0.8"/>`;
      }

    } else {
      // Generic fallback for custom scenes
      let cx = w * 0.45, cy = bY - 80;
      let bw2 = 50 + w2 * 10, bh2 = 80 + w1 * 15;
      svg += `<rect x="${cx - bw2 / 2}" y="${cy}" width="${bw2}" height="${bh2}" rx="3" fill="${bCol}" stroke="#3A3228" stroke-width="${ol}"/>`;
      let tw2 = 18, th2 = bh2 + 30 + w2 * 12;
      svg += `<rect x="${cx - tw2 / 2}" y="${cy - th2 + bh2}" width="${tw2}" height="${th2}" rx="2" fill="${bCol}" stroke="#3A3228" stroke-width="${ol}"/>`;
      svg += `<polygon points="${cx},${cy - th2 + bh2 - 18} ${cx - tw2 / 2 - 6},${cy - th2 + bh2} ${cx + tw2 / 2 + 6},${cy - th2 + bh2}" fill="${sc.acc}" stroke="#3A3228" stroke-width="${ol * 0.7}" opacity="0.85"/>`;
      for (let wi = 0; wi < 3; wi++) {
        for (let wj = 0; wj < 2; wj++) {
          let wx2 = cx - bw2 / 2 + 10 + wj * (bw2 - 28), wy2 = cy + 12 + wi * 22;
          let wpulse = Math.sin(mt * 2.1 + wi * 1.7 + wj * 2.3) * 0.5 + 0.5;
          let wfill = isN ? `rgba(255,210,80,${0.35 + wpulse * 0.5})` : `rgba(180,160,120,${0.1 + wpulse * 0.06})`;
          svg += `<rect x="${wx2}" y="${wy2}" width="8" height="10" rx="1" fill="${wfill}"/>`;
          if (isN) svg += `<ellipse cx="${wx2 + 4}" cy="${wy2 + 5}" rx="12" ry="10" fill="rgba(255,210,80,0.04)"/>`;
        }
      }
      let flagY2 = cy - th2 + bh2 - 18, fwave = Math.sin(mt * 1.8) * 3;
      svg += `<line x1="${cx}" y1="${flagY2}" x2="${cx}" y2="${flagY2 - 25}" stroke="#3A3228" stroke-width="${ol * 0.5}"/>`;
      svg += `<path d="M${cx} ${flagY2 - 25} L${cx + 16} ${flagY2 - 20 + fwave} L${cx} ${flagY2 - 15}" fill="${sc.acc}" stroke="#3A3228" stroke-width="${ol * 0.3}" opacity="0.8"/>`;
    }

    // Victorian+ street lamps (shared — except arthurs and london which have their own)
    if (ps.era >= 1830 && sc.id !== 'arthurs' && sc.id !== 'london') {
      for (let i = 0; i < 2; i++) {
        let lx = w * 0.22 + i * w * 0.45;
        svg += `<line x1="${lx}" y1="${bY}" x2="${lx}" y2="${bY - 30}" stroke="#4A4238" stroke-width="${ol * 0.6}"/>`;
        svg += `<circle cx="${lx}" cy="${bY - 33}" r="4" fill="${isN ? '#F0C860' : '#6A6258'}" stroke="#4A4238" stroke-width="${ol * 0.4}"/>`;
        if (isN) svg += `<circle cx="${lx}" cy="${bY - 33}" r="16" fill="#F0C860" opacity="0.05"/>`;
      }
    }

    svg = shApplyWorldFX(svg, w, h, bY, mt, ps, isN);
    svg += '</svg>';
    el.innerHTML = svg;
    shApplyPostFxRuntime(svg);

    // Update HUD
    shUpdatePreviewHUD(sc);
  }

  function shUpdatePreviewHUD(sc) {
    var ps = _sh.previewState;
    var hh = Math.floor(ps.tod), mm = Math.floor((ps.tod % 1) * 60);
    var ts = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
    var el1 = document.getElementById('shHudTime');
    var el2 = document.getElementById('shHudScene');
    var el3 = document.getElementById('shHudEra');
    if (el1) el1.textContent = ts;
    if (el2) el2.textContent = sc.icon + ' ' + sc.name;
    if (el3) el3.textContent = ps.era;
  }

  /* ── Preview animation loop ── */
  function shStartPreviewLoop() {
    if (_sh.previewRafId) return;
    // If the active scene has custom code stored, run it instead of the built-in renderer
    var all0 = SH_SCENES.concat(_sh.customScenes);
    var sc0 = all0.find(function (s) { return s.id === _sh.activeScene; });
    if (sc0 && sc0.code) {
      _shStartCustomCodeLoop(sc0, sc0.code);
      return;
    }
    function loop() {
      if (_sh.activeTab === 'preview') {
        var all = SH_SCENES.concat(_sh.customScenes);
        var sc = all.find(function (s) { return s.id === _sh.activeScene; });
        if (sc) shRenderPreview(sc);
      }
      _sh.previewRafId = requestAnimationFrame(loop);
    }
    _sh.previewRafId = requestAnimationFrame(loop);
  }

  function shStopPreviewLoop() {
    if (_sh.previewRafId) {
      cancelAnimationFrame(_sh.previewRafId);
      _sh.previewRafId = null;
    }
  }

  /* ═════════════════════════════════════════════════════════════
     PREVIEW CONTROLS
     ═════════════════════════════════════════════════════════════ */
  window.shUpdateTOD = function (val) {
    _sh.previewState.tod = parseFloat(val);
    var h = Math.floor(val), m = Math.floor((val % 1) * 60);
    var label = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
    var el = document.getElementById('shValTOD'); if (el) el.textContent = label;
    var asEl = document.getElementById('as_shValTOD'); if (asEl) asEl.textContent = label;
    var sl = document.getElementById('shSliderTOD'); if (sl && parseFloat(sl.value) !== _sh.previewState.tod) sl.value = _sh.previewState.tod;
    var asSl = document.getElementById('as_shSliderTOD'); if (asSl && parseFloat(asSl.value) !== _sh.previewState.tod) asSl.value = _sh.previewState.tod;
    var hud = document.getElementById('shHudTime'); if (hud) hud.textContent = label;
    var cycle = Math.max(0, Math.min(1, (23 - _sh.previewState.tod) / 11));
    _sh.previewState.dayNightCycle = cycle;
    var cycEl = document.getElementById('shWorldDayNight');
    var cycVal = document.getElementById('shWorldDayNightVal');
    if (cycEl) cycEl.value = cycle.toFixed(2);
    if (cycVal) cycVal.textContent = cycle.toFixed(2);
    var asCyc = document.getElementById('as_shWorldDayNight'); if (asCyc) asCyc.value = cycle.toFixed(2);
    var asCycVal = document.getElementById('as_shWorldDayNightVal'); if (asCycVal) asCycVal.textContent = cycle.toFixed(2);
    shRefreshWorldSummary();
    shSaveState();
  };

  window.shUpdateOutline = function (val) {
    _sh.previewState.outline = parseFloat(val);
    var el = document.getElementById('shValOutline');
    if (el) el.textContent = parseFloat(val).toFixed(1);
    shSaveState();
  };

  window.shUpdateMorph = function (val) {
    _sh.previewState.bgmorph = parseFloat(val);
    var el = document.getElementById('shValMorph');
    if (el) el.textContent = parseFloat(val).toFixed(2);
    shSaveState();
  };

  window.shToggleNight = function () {
    var ps = _sh.previewState;
    ps.tod = ps.tod > 5 && ps.tod < 20 ? 22 : 12;
    var sl = document.getElementById('shSliderTOD');
    if (sl) sl.value = ps.tod;
    shUpdateTOD(ps.tod);
    shSyncWorldUI();
    shSaveState();
  };

  window.shToggleFullscreen = function () {
    var area = document.querySelector('.sh-preview-area');
    if (!area) return;
    area.classList.toggle('fullscreen');
  };

  /* ═════════════════════════════════════════════════════════════
     METADATA FORM
     ═════════════════════════════════════════════════════════════ */
  function shFillMetaForm(sc) {
    var bgOpacityRaw = Number(sc.bgOpacity);
    var bgOpacity = Number.isFinite(bgOpacityRaw) ? Math.max(0, Math.min(1, bgOpacityRaw)) : 0.28;
    var bgFit = String(sc.bgFit || 'cover').toLowerCase() === 'contain' ? 'contain' : 'cover';
    var fields = {
      shMetaId: sc.id, shMetaName: sc.name, shMetaIcon: sc.icon, shMetaDesc: sc.desc || '',
      shMetaSky1: sc.sky1, shMetaSky2: sc.sky2, shMetaGround: sc.ground, shMetaBld: sc.bld, shMetaAcc: sc.acc,
      shMetaBgFit: bgFit, shMetaBgOpacity: bgOpacity.toFixed(2)
    };
    Object.keys(fields).forEach(function (fid) {
      var el = document.getElementById(fid);
      if (el) el.value = fields[fid];
    });
    // Color inputs
    ['shColorSky1', 'shColorSky2', 'shColorGround', 'shColorBld', 'shColorAcc'].forEach(function (cid) {
      var el = document.getElementById(cid);
      if (!el) return;
      var key = cid.replace('shColor', 'shMeta');
      var src = document.getElementById(key);
      if (src) el.value = src.value;
    });
    var bgOpacityEl = document.getElementById('shMetaBgOpacity');
    var bgOpacityVal = document.getElementById('shMetaBgOpacityVal');
    if (bgOpacityEl && bgOpacityVal) {
      bgOpacityVal.textContent = Number(bgOpacityEl.value || 0).toFixed(2);
    }
  }

  window.shSaveMetaForm = function () {
    var id = (document.getElementById('shMetaId') || {}).value;
    if (!id) return;
    var all = SH_SCENES.concat(_sh.customScenes);
    var sc = all.find(function (s) { return s.id === id; });
    if (!sc) return;
    sc.name = (document.getElementById('shMetaName') || {}).value || sc.name;
    sc.icon = (document.getElementById('shMetaIcon') || {}).value || sc.icon;
    sc.desc = (document.getElementById('shMetaDesc') || {}).value || '';
    sc.sky1 = (document.getElementById('shMetaSky1') || {}).value || sc.sky1;
    sc.sky2 = (document.getElementById('shMetaSky2') || {}).value || sc.sky2;
    sc.ground = (document.getElementById('shMetaGround') || {}).value || sc.ground;
    sc.bld = (document.getElementById('shMetaBld') || {}).value || sc.bld;
    sc.acc = (document.getElementById('shMetaAcc') || {}).value || sc.acc;
    var bgFit = String((document.getElementById('shMetaBgFit') || {}).value || 'cover').toLowerCase();
    sc.bgFit = bgFit === 'contain' ? 'contain' : 'cover';
    var bgOpacity = Number((document.getElementById('shMetaBgOpacity') || {}).value);
    sc.bgOpacity = Number.isFinite(bgOpacity) ? Math.max(0, Math.min(1, bgOpacity)) : 0.28;
    var bgOpacityVal = document.getElementById('shMetaBgOpacityVal');
    if (bgOpacityVal) bgOpacityVal.textContent = sc.bgOpacity.toFixed(2);
    // Also persist current editor code with the scene
    var editor = document.getElementById('shCodeEditor');
    if (editor && editor.value.trim()) sc.code = editor.value.trim();
    shBuildSceneList();
    shSaveState();
    shToast('Scene saved');
  };

  function shGetActiveSceneRef() {
    var all = SH_SCENES.concat(_sh.customScenes);
    return all.find(function (s) { return s.id === _sh.activeScene; }) || null;
  }

  function shRefreshActiveScenePreview(sc) {
    if (!sc) return;
    if (sc.code) {
      if (!_sh.previewRafId) _shStartCustomCodeLoop(sc, sc.code);
      return;
    }
    shRenderPreview(sc);
  }

  window.shSetSceneBgFit = function (val) {
    var sc = shGetActiveSceneRef();
    if (!sc) return;
    sc.bgFit = String(val || 'cover').toLowerCase() === 'contain' ? 'contain' : 'cover';
    var fitEl = document.getElementById('shMetaBgFit');
    if (fitEl && fitEl.value !== sc.bgFit) fitEl.value = sc.bgFit;
    shRefreshActiveScenePreview(sc);
    shSaveState(true);
  };

  window.shSetSceneBgOpacity = function (val) {
    var sc = shGetActiveSceneRef();
    if (!sc) return;
    var bgOpacity = Number(val);
    var nextOpacity = Number.isFinite(bgOpacity) ? Math.max(0, Math.min(1, bgOpacity)) : 0.28;
    sc.bgOpacity = nextOpacity;
    var sliderEl = document.getElementById('shMetaBgOpacity');
    if (sliderEl && Number(sliderEl.value) !== nextOpacity) sliderEl.value = String(nextOpacity);
    var valueEl = document.getElementById('shMetaBgOpacityVal');
    if (valueEl) valueEl.textContent = nextOpacity.toFixed(2);
    shRefreshActiveScenePreview(sc);
    shSaveState(true);
  };

  /* ═════════════════════════════════════════════════════════════
     RUN EDITOR CODE IN LIVE PREVIEW
     Executes the current editor content in the animated preview
     loop so the user sees their SVG code animated immediately.
     Also persists the code to the scene for future loads.
     ═════════════════════════════════════════════════════════════ */
  window.shRunEditorCode = function () {
    var all = SH_SCENES.concat(_sh.customScenes);
    var sc = all.find(function (s) { return s.id === _sh.activeScene; });
    if (!sc) { shToast('Select a scene from the gallery first'); return; }
    var editor = document.getElementById('shCodeEditor');
    var userCode = editor ? editor.value.trim() : '';
    if (!userCode) { shToast('Editor is empty — no code to run'); return; }
    // Validate by compiling
    try { new Function('svg', 'w', 'h', 'bY', 'bCol', 'wc', 'ol', 'isN', 'mt', 'w1', 'w2', 'w3', 'sc', userCode + '\nreturn svg;'); }
    catch (e) { shToast('Syntax error: ' + e.message); return; }
    // Persist code to scene
    sc.code = userCode;
    _sh.editorCode = userCode;
    shSaveState();
    // Stop current loop, switch to preview tab, start custom loop
    shStopPreviewLoop();
    shSwitchTab('preview');
    _shStartCustomCodeLoop(sc, userCode);
    shToast('▶ Running — preview updated and saved');
  };

  /* ═════════════════════════════════════════════════════════════
     IMPLEMENT WITH AGENT
    Sends scene metadata + code to the OpenClaude agent via SSE.
     The agent writes the scene as a proper implementation file
     and confirms. Results stream into the Brainstorm chat.
     ═════════════════════════════════════════════════════════════ */
  window.shImplementWithAgent = async function () {
    var sectionCtx = (typeof window.oliviaResolveSectionAgentContext === 'function')
      ? window.oliviaResolveSectionAgentContext('shaders')
      : null;
    if (sectionCtx && sectionCtx.assigned && !sectionCtx.active) {
      var inactiveName = sectionCtx.agent ? (sectionCtx.agent.name || sectionCtx.agent.agent_id) : sectionCtx.agentId;
      shToast('Assigned shaders agent is inactive: ' + inactiveName);
      return;
    }

    var all = SH_SCENES.concat(_sh.customScenes);
    var sc = all.find(function (s) { return s.id === _sh.activeScene; });
    if (!sc) { shToast('No active scene selected'); return; }
    var editor = document.getElementById('shCodeEditor');
    var code = editor ? editor.value.trim() : (sc.code || '');
    if (!code) { shToast('Add scene rendering code in the Editor first'); return; }
    // Persist code first
    sc.code = code;
    shSaveState();
    var sceneMeta = JSON.stringify({ id: sc.id, icon: sc.icon, name: sc.name, desc: sc.desc, sky1: sc.sky1, sky2: sc.sky2, ground: sc.ground, bld: sc.bld, acc: sc.acc }, null, 2);
    var taskMeta = JSON.stringify(_shReadTaskInterface(), null, 2);
    var agentPrompt = [
      'I am working in the Kout workspace VFX shader system.',
      'Core principle: think in vector logic (SVG), execute in shader math (TSL).',
      'This request runs in tool-enabled mode (filesystem writes allowed if scope permits).',
      'Please persist this custom scene using the runtime scene file format.',
      '',
      '## Scene Metadata',
      '```json',
      sceneMeta,
      '```',
      '',
      '## Shader Task Interface',
      '```json',
      taskMeta,
      '```',
      '',
      '## Scene SVG Rendering Code',
      '(Variables available: svg string, w, h, bY, bCol, wc, ol, isN, mt, w1/w2/w3 oscillators, sc object)',
      '```javascript',
      code,
      '```',
      '',
      '## Task',
      '1. Create or update `content/scenes/' + sc.id + '.scene.json` as one JSON object with fields:',
      '   id, icon, name, desc, sky1, sky2, ground, bld, acc, category="custom", code.',
      '2. Ensure `content/scenes/manifest.json` contains `' + sc.id + '.scene.json` exactly once.',
      '3. Return the exact files changed and a concise write summary.',
      '4. If writing fails due to permissions/scope, report the exact error and stop (no fake success).'
    ].join('\n');
    // Stream agent response into Brainstorm chat
    shSwitchTab('brainstorm');
    _sh.brainMessages.push({ role: 'user', text: '🔧 Implement scene "' + sc.name + '" via agent' });
    _sh.brainMessages.push({ role: 'agent', text: '', streaming: true });
    shRenderBrainChat();
    var msgIdx = _sh.brainMessages.length - 1;
    _shBrainStreaming = true;
    shUpdateBrainUI();
    var agentDone = false;
    try {
      var runPayload = { userPrompt: agentPrompt };
      if (sectionCtx && sectionCtx.agent && sectionCtx.agent.agent_id) {
        runPayload.agent_id = sectionCtx.agent.agent_id;
      }
      if (typeof getCurrentProjectId === 'function') {
        var projectId = getCurrentProjectId();
        if (projectId) runPayload.project_id = projectId;
      }
      var response = await OliviaAPI.agent.run(runPayload);
      var reader = response.body.getReader();
      var decoder = new TextDecoder();
      var buf = '';
      var agentText = '';
      var log = document.getElementById('shBrainLog');
      while (!agentDone) {
        var readResult = await reader.read();
        if (readResult.done) break;
        buf += decoder.decode(readResult.value, { stream: true });
        var lines = buf.split('\n');
        buf = lines.pop();
        for (var li = 0; li < lines.length; li++) {
          var line = lines[li].trim();
          if (!line || !line.startsWith('data:')) continue;
          var raw = line.slice(5).trim();
          if (raw === '[DONE]') { agentDone = true; break; }
          try {
            var ev = JSON.parse(raw);
            var chunk = '';
            if (ev.type === 'step' || ev.type === 'tool_result' || ev.type === 'done') {
              chunk = ev.content || ev.output || ev.summary || '';
            } else if (ev.delta && ev.delta.text) {
              chunk = ev.delta.text;
            } else if (ev.type === 'error') {
              chunk = '⚠ ' + (ev.message || 'Agent error');
              agentDone = true;
            }
            if (chunk) {
              agentText += chunk;
              _sh.brainMessages[msgIdx].text = agentText;
              var msgEls = log ? log.querySelectorAll('.sh-brain-msg.agent') : [];
              var lastEl = msgEls[msgEls.length - 1];
              if (lastEl) { lastEl.innerHTML = shFormatBrainMsg(agentText); if (log) log.scrollTop = log.scrollHeight; }
            }
          } catch (parseErr) { /* ignore unparseable frames */ }
        }
      }
      _sh.brainMessages[msgIdx].text = agentText || '✅ Agent completed';
      _sh.brainMessages[msgIdx].streaming = false;
      shRenderBrainChat();
      shToast('Agent implementation complete');
    } catch (err) {
      _sh.brainMessages[msgIdx].text = '⚠ Agent error: ' + (err.message || err);
      _sh.brainMessages[msgIdx].streaming = false;
      shRenderBrainChat();
      shToast('Agent error — check Brainstorm tab');
    } finally {
      _shBrainStreaming = false;
      _shBrainAbortCtrl = null;
      shUpdateBrainUI();
    }
  };

  window.shSyncColor = function (colorId, textId) {
    var c = document.getElementById(colorId);
    var t = document.getElementById(textId);
    if (c && t) t.value = c.value;
  };

  /* ═════════════════════════════════════════════════════════════
     EDITOR — Code editing for scene SVG code
     ═════════════════════════════════════════════════════════════ */
  function shLoadSceneCode(sc, callback) {
    var editor = document.getElementById('shCodeEditor');
    if (!editor) { if (typeof callback === 'function') callback(); return; }
    // If the scene has saved custom code, load it directly
    if (sc.code) {
      editor.value = sc.code;
      _sh.editorCode = sc.code;
      if (typeof callback === 'function') callback();
      return;
    }
    // External code file reference (keeps scene JSON small)
    if (sc.codeFile) {
      fetch(sc.codeFile + '?_=' + Date.now())
        .then(function (r) { return r.ok ? r.text() : Promise.reject(r.status); })
        .then(function (externalCode) {
          sc.code = externalCode;
          editor.value = externalCode;
          _sh.editorCode = externalCode;
          if (typeof callback === 'function') callback();
        })
        .catch(function () {
          // Fallback: generate template code
          _generateSceneCodeTemplate(sc, editor);
          if (typeof callback === 'function') callback();
        });
      return;
    }
    // Generate a code template for the scene
    _generateSceneCodeTemplate(sc, editor);
    if (typeof callback === 'function') callback();
  }

  function _generateSceneCodeTemplate(sc, editor) {
    var code = '// ── ' + sc.name.toUpperCase() + ' — ' + (sc.desc || '') + ' ──\n'
      + '// Scene ID: ' + sc.id + '\n'
      + '// Palette: sky1=' + sc.sky1 + ', sky2=' + sc.sky2 + ', ground=' + sc.ground + ', bld=' + sc.bld + ', acc=' + sc.acc + '\n\n'
      + 'const mt = Date.now() * 0.001 * (S.timeSpeed || 1) * Math.max(S.bgmorph + 0.5, 0.3);\n'
      + 'const w1 = Math.sin(mt)         * 0.5 + 0.5;\n'
      + 'const w2 = Math.sin(mt*1.7+2.5) * 0.5 + 0.5;\n'
      + 'const w3 = Math.sin(mt*2.3+4.8) * 0.5 + 0.5;\n\n'
      + '// Sky gradient\n'
      + 'svg+=`<defs><linearGradient id="lg-' + sc.id + '" x1="0" y1="0" x2="0" y2="1">\n'
      + '  <stop offset="0%" stop-color="' + sc.sky1 + '"/>\n'
      + '  <stop offset="100%" stop-color="' + sc.sky2 + '"/>\n'
      + '</linearGradient></defs>`;\n\n'
      + '// Main structure\n'
      + 'const cx = w*0.45, baseY = bY - 80;\n'
      + 'svg+=`<rect x="${cx-30}" y="${baseY}" width="60" height="80" rx="3"\n'
      + '  fill="' + sc.bld + '" stroke="#3A3228" stroke-width="${ol}"/>`;\n\n'
      + '// TODO: Add scene-specific elements here\n'
      + '// Use w1, w2, w3 oscillators for deterministic animation\n'
      + '// Use isN for night mode glow effects\n';
    editor.value = code;
    _sh.editorCode = code;
  }

  window.shCopyCode = function () {
    var editor = document.getElementById('shCodeEditor');
    if (!editor) return;
    navigator.clipboard.writeText(editor.value).then(function () {
      shToast('Code copied to clipboard');
    }).catch(function () { shToast('Copy failed'); });
  };

  window.shExportScene = function () {
    var all = SH_SCENES.concat(_sh.customScenes);
    var sc = all.find(function (s) { return s.id === _sh.activeScene; });
    if (!sc) return;
    var json = JSON.stringify(sc, null, 2);
    var blob = new Blob([json], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = sc.id + '-scene.json'; a.click();
    URL.revokeObjectURL(url);
    shToast('Scene exported: ' + sc.id);
  };

  window.shExportShaderbenchPatch = function () {
    var all = SH_SCENES.concat(_sh.customScenes);
    var sc = all.find(function (s) { return s.id === _sh.activeScene; });
    if (!sc) return;
    var editor = document.getElementById('shCodeEditor');
    var code = editor ? editor.value : '';
    var patch = '// ═══ SCENE ENTRY ═══\n'
      + '// Add to the scenes[] array in shaderbench.html:\n'
      + '{id:\'' + sc.id + '\',icon:\'' + sc.icon + '\',name:\'' + sc.name + '\',desc:\'' + (sc.desc || '') + '\','
      + 'sky1:\'' + sc.sky1 + '\',sky2:\'' + sc.sky2 + '\',ground:\'' + sc.ground + '\',bld:\'' + sc.bld + '\',acc:\'' + sc.acc + '\'}\n\n'
      + '// ═══ RENDERING CODE ═══\n'
      + '// Add inside renderSVG() as: else if(S.scene===\'' + sc.id + '\'){...}\n'
      + 'else if(S.scene===\'' + sc.id + '\'){\n'
      + code + '\n'
      + '}\n';
    var blob = new Blob([patch], { type: 'text/plain' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = sc.id + '-patch.js'; a.click();
    URL.revokeObjectURL(url);
    shToast('Patch exported for shaderbench.html');
  };

  /* ═════════════════════════════════════════════════════════════
     EDITOR SPLITTER
     ═════════════════════════════════════════════════════════════ */
  function shInitSplitter() {
    var sp = document.getElementById('shEditorSplitter');
    var left = document.getElementById('shEditorPane');
    if (!sp || !left) return;

    sp.addEventListener('mousedown', function (e) {
      e.preventDefault();
      _sh.splitterDragging = true;
      sp.classList.add('dragging');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', function (e) {
      if (!_sh.splitterDragging) return;
      var parent = sp.parentElement;
      if (!parent) return;
      var rect = parent.getBoundingClientRect();
      var pct = ((e.clientX - rect.left) / rect.width) * 100;
      pct = Math.max(25, Math.min(75, pct));
      left.style.flex = 'none';
      left.style.width = pct + '%';
    });

    document.addEventListener('mouseup', function () {
      if (_sh.splitterDragging) {
        _sh.splitterDragging = false;
        var sp2 = document.getElementById('shEditorSplitter');
        if (sp2) sp2.classList.remove('dragging');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    });
  }

  /* ═════════════════════════════════════════════════════════════
    BRAINSTORM — Creative concept → Scene mapping
    ═════════════════════════════════════════════════════════════ */
  function shBuildMappingCards() {
    var list = document.getElementById('shMappingList');
    if (!list) return;
    var html = '';
    SH_METAPHOR_MAP.forEach(function (m, i) {
      html += '<div class="sh-mapping-card">'
        + '<div class="sh-mapping-card-head">'
        + '<div class="sh-mapping-card-icon source"><i class="' + m.icon_s + '"></i></div>'
        + '<span class="sh-mapping-card-title">' + m.source + '</span>'
        + '<span class="sh-mapping-card-arrow"><i class="fas fa-arrow-right"></i></span>'
        + '<div class="sh-mapping-card-icon visual"><i class="' + m.icon_v + '"></i></div>'
        + '<span class="sh-mapping-card-title">' + m.visual.split('(')[0].trim() + '</span>'
        + '</div>'
        + '<div class="sh-mapping-card-body">' + m.visual + '</div>'
        + '</div>';
    });
    list.innerHTML = html;
  }

  /* ── Brainstorm chat — real LLM layer via Kout assistant API ── */

  var SH_SYSTEM_PROMPT = [
    'You are the VFX Shader Agent running live in Kout.',
    'Core principle: Think in vector logic (SVG), execute in shader math (TSL).',
    'Do not ask the user to switch tools/apps. Operate directly in this workspace context.',
    'Target TSL version: ' + SH_TSL_TARGET_VERSION + '.',
    '',
    '━━ EXECUTION RULES ━━',
    '1) Be uniform-centric: dynamic values must be controllable through uniforms.',
    '2) Be depth-aware: classify elements as background, midground, foreground.',
    '3) Think in systems: effects should connect motion, color, and interaction.',
    '4) Prefer deterministic animation: no Math.random(), use mt/w1/w2/w3 oscillators.',
    '5) Keep SVG logic clean and composable (paths/layers/metaphors).',
    '',
    '━━ INPUT CONTEXT ━━',
    'You may receive a ShaderTaskInterface JSON with:',
    '- svgAsset',
    '- desiredMood',
    '- interactionType',
    '- performanceTarget',
    'Use it as a hard constraint when generating scenes and strategy choices.',
    '',
    '━━ SVG PREPROCESSING POLICY ━━',
    'If SVG is not shader-ready, try: normalize viewBox, remove transforms, simplify paths, enforce IDs.',
    'If preprocessing fails: fallback to texture-based rendering (useSDF=false), include warning, continue.',
    '',
    '━━ UNIFORM NAMING ━━',
    'Use semantic camelCase with u-prefix for shader-bound values:',
    '- uTimeSpeed',
    '- uDayNight',
    '- uWeather',
    '- uMouse',
    '- uRotation3D',
    '',
    '━━ REQUIRED OUTPUT CONTRACT ━━',
    'For scene generation, output these blocks in order:',
    '```scene-json',
    '{"id":"lowercase_snake_case","icon":"emoji","name":"Display Name","desc":"One-line description","sky1":"#hex","sky2":"#hex","ground":"#hex","bld":"#hex","acc":"#hex"}',
    '```',
    '```scene-code',
    '// CRITICAL: svg is a STRING, NOT a DOM element.',
    '// Build SVG by appending markup strings: svg += `<rect .../>`;',
    '// NEVER use querySelector, querySelectorAll, setAttribute, or any DOM API.',
    '// The code runs inside: new Function("svg","w","h","bY","bCol","wc","ol","isN","mt","w1","w2","w3","sc", code + "return svg;")',
    '// The runtime already provides: sky gradient rect, ground rect, and the opening <svg> tag.',
    '// Your code appends scene elements (buildings, water, particles, etc.) as SVG string markup.',
    '// Variables: svg(string),w(width),h(height),bY(ground Y),bCol(building color),wc(window color),ol(outline width),isN(is night bool),mt(time),w1/w2/w3(oscillators 0-1),sc(scene metadata with sky1/sky2/ground/bld/acc)',
    '// Must end with: return svg;',
    '```',
    '```scene-uniforms',
    '{"uTimeSpeed":1.0,"uDayNight":0.5,"uWeather":0.0,"uRotation3D":0}',
    '```',
    '```postfx-json',
    '{"bloom":0.2,"chromaticAberration":0.0,"vignette":0.15}',
    '```',
    '```agent-report',
    '{"warnings":[],"fallbackApplied":false}',
    '```',
    'Then finish with one concise apply instruction.',
    '',
    '━━ AUTO-APPLY BEHAVIOR ━━',
    'The frontend automatically parses your fenced blocks and renders Apply buttons next to each:',
    '- ```scene-json → "Apply Scene" button (calls shApplySceneFromChat)',
    '- ```scene-code → "Copy to Editor" button (calls shApplyCodeFromChat)',
    '- ```scene-uniforms → "Apply Uniforms" button (calls shApplyUniformsFromChat)',
    '- ```postfx-json → auto-applied on stream end (shIngestPostFxFromText) + "Apply PostFX" button',
    '- ```agent-report → auto-applied on stream end (shIngestAgentReportFromText) + button',
    '- ```scene3d-config → "Apply 3D Config" + "Apply & Save" buttons (calls shApply3DConfigFromChat)',
    '- ```three-code → "Copy Three.js Code" button (calls shApply3DCodeFromChat)',
    'The user clicks these buttons to apply each block. PostFX and agent-report are also auto-ingested.',
    'IMPORTANT: In 3D mode, ALWAYS output a scene3d-config block first, then a three-code block.',
    'Always include BOTH an "Apply 3D Config" (preview only) and "Apply & Save" (persist to gallery) option.',
    'THREE-CODE RULES: NEVER use import statements in three-code blocks. THREE is available as window.THREE.',
    'Do NOT write: import * as THREE from "three"; — just use THREE directly.',
    'three-code blocks run in a non-module context; assume THREE, _s3 (scene state) are globally available.',
    'For GLB model loading in three-code: use sh3dLoadGLB(url) or sh3dUploadGLB() — do NOT instantiate new loaders.',
    '',
    '━━ PROACTIVE APPLY RULE ━━',
    'After generating scene blocks, ALWAYS offer to apply immediately.',
    'Say: "Do you want me to apply the scene now? (yes/sim/apply)"',
    'When user confirms with yes/sim/apply, describe applying each block in order.',
    'If the Apply buttons are visible, the user can click them directly.',
    'Be proactive: after applying, suggest the next useful action (tune palette, adjust animation, export, etc.).',
    '',
    '━━ AVAILABLE FRONTEND ACTIONS ━━',
    'You are running inside the Shaders section of Kout Workspace. These actions exist:',
    '',
    'Scene Gallery:',
    '- shSelectScene(id) — select and preview a scene by ID',
    '- shBuildSceneList() — refresh the scene gallery sidebar',
    '- shUpdateStats() — update scene count badges (total, custom, animated)',
    '- shCreateScene() — create a blank new scene',
    '- shSaveMetaForm() — save current scene metadata from the editor form',
    '',
    'Preview Controls:',
    '- shRenderPreview(scene) — render a single frame of the given scene',
    '- shStartPreviewLoop() — start the animated preview loop',
    '- shStopPreviewLoop() — stop the animated preview loop',
    '- shUpdateTOD(val) — set time of day (0-24)',
    '- shUpdateOutline(val) — set outline width',
    '- shUpdateMorph(val) — set morph/distortion level',
    '- shToggleNight() — toggle day/night',
    '- shToggleFullscreen() — toggle fullscreen preview',
    '',
    'World State (uniforms):',
    '- shSetDayNightCycle(val) — set day/night cycle (0-1)',
    '- shSetWorldTimeSpeed(val) — set animation time speed',
    '- shSetWorldWeather(val) — set weather intensity',
    '- shSetWorldRotation(val) — set 3D rotation amount',
    '',
    'PostFX Pipeline:',
    '- shSetPostFxSlider(key, val) — set individual PostFX value (bloom, chromaticAberration, vignette, grain, sepia, blur)',
    '- shResetPostFx() — reset all PostFX to defaults',
    '- shApplyPostFxObject(obj) — apply a full PostFX object at once',
    '',
    'Editor:',
    '- shRunEditorCode() — compile and run code from the editor textarea',
    '- shLoadSceneCode(scene) — load scene code into the editor',
    '- shCopyCode() — copy editor code to clipboard',
    '',
    'Export:',
    '- shExportScene() — export current scene as .scene.json download',
    '- shExportShaderbenchPatch() — export as shaderbench-compatible patch',
    '',
    'Chat Apply (from agent output):',
    '- shApplySceneFromChat(btn) — apply scene-json block to gallery + preview',
    '- shApplyCodeFromChat(btn) — copy scene-code block to editor',
    '- shApplyUniformsFromChat(btn) — apply uniforms to world state',
    '- shApplyPostFxFromChat(btn) — apply PostFX to pipeline',
    '- shApplyAgentReportFromChat(btn) — apply agent report to diagnostics',
    '',
    'Task Interface:',
    '- shApplyTaskToComposer() — send task interface settings to brainstorm chat',
    '- shRefreshTaskPreview() — regenerate task preview thumbnail',
    '',
    '━━ FILE SYSTEM CONTEXT ━━',
    'Scene files: ./content/scenes/*.scene.json',
    'Scene manifest: ./content/scenes/manifest.json (array of filenames to auto-load)',
    'Asset catalog: ./content/scenes/assets/*.asset.json (reusable SVG artifacts)',
    'Asset manifest: ./content/scenes/assets/manifest.json',
    'Scene code can invoke any catalog asset via: SH_ASSETS.<id>.render(svg, ctx)',
    'A list of currently-loaded asset ids is appended to this prompt at chat time under "AVAILABLE ASSETS".',
    'Example usage in scene code:',
    '  svg = SH_ASSETS.owl.render(svg, { x: w*0.3, y: bY-80, mt, isN, ol, talk: true });',
    '  svg = SH_ASSETS.firefly_swarm.render(svg, { x:0, y:bY-40, w, h:55, count:15, mt, color:sc.acc });',
    'Uploaded assets: uploads/ directory (SVG and image files)',
    'Brainstorm lane capability: this chat does NOT execute filesystem tools directly.',
    'Do NOT claim to have listed directories, read files, or written files in this lane.',
    'Use fenced blocks + Apply buttons to update in-memory state (gallery/editor/preview).',
    'For disk persistence, tell user to click Implement with Agent or type /persist.',
    'To persist a new scene on disk: create scenes/<id>.scene.json and add filename to manifest.json.',
    '',
    '━━ CREATIVE MAPPING HINTS ━━',
    '- Narrative core -> central structure',
    '- Motion driver -> pulsing/rotating focal element',
    '- Flow layer -> ripples, drift, particles',
    '- Rhythm -> repeated windows/steps/stones',
    '- Intensity -> color force and contrast bands',
    '',
    '━━ STYLE ━━',
    '- Keep responses concise and operational.',
    '- Same language as user input.',
    '',
    '━━ POST-GENERATION RULE ━━',
    'After ANY generation output (scene, palette suggestion, animation tips, shader code, etc.),',
    'ALWAYS end your response by proposing the user to run /save to persist the chat.',
    'Example: "Type `/save` to save this conversation."',
    'This applies to every generation without exception.'
  ].join('\n');

  var _shBrainStreaming = false;
  var _shBrainAbortCtrl = null;
  var _shPanelCtxListenerBound = false;

  function _shGetPanelContextData() {
    if (typeof window.buildSelectedPanelContext === 'function') {
      return window.buildSelectedPanelContext();
    }
    return { text: '', selectedCount: 0, availableCount: 0, snapshots: [] };
  }

  function _shUpdatePanelContextIndicator() {
    var indicator = document.getElementById('shPanelCtxIndicator');
    if (!indicator) return;
    var data = _shGetPanelContextData();
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

  function _shGetPanelContextText() {
    var data = _shGetPanelContextData();
    return data && data.text ? data.text : '';
  }

  function shBuildRenderingStrategy(task) {
    var perfKey = task && task.performanceTarget ? task.performanceTarget : 'desktop';
    var base = SH_COMPLEXITY_BUDGET[perfKey] || SH_COMPLEXITY_BUDGET.desktop;
    var strategy = Object.assign({}, base);

    if (task && task.interactionType === 'audio') {
      strategy.layerCount = Math.min(strategy.layerCount + 1, 4);
    }
    if (task && task.desiredMood === 'minimal') {
      strategy.layerCount = Math.max(2, strategy.layerCount - 1);
      strategy.postProcessingLevel = strategy.postProcessingLevel === 'premium' ? 'standard' : 'minimal';
    }

    return strategy;
  }

  function shEvaluateSvgReadiness(task) {
    var warnings = [];
    var fallbackApplied = false;
    var svgAsset = task && task.svgAsset ? String(task.svgAsset).trim() : '';

    if (!svgAsset) {
      warnings.push('No svgAsset provided; using current scene context as source.');
      return { shaderReady: true, fallbackApplied: false, warnings: warnings };
    }

    var lowered = svgAsset.toLowerCase();
    var isSvgRef = lowered.endsWith('.svg')
      || lowered.endsWith('.svgz')
      || lowered.indexOf('<svg') !== -1
      || lowered.indexOf('data:image/svg+xml') === 0;
    if (!isSvgRef) {
      warnings.push('svgAsset is not SVG-compatible; fallback to texture-based workflow.');
      fallbackApplied = true;
    }

    if (svgAsset.indexOf(' ') !== -1) {
      warnings.push('svgAsset contains spaces; ensure URL-safe path for runtime loading.');
    }

    return {
      shaderReady: !fallbackApplied,
      fallbackApplied: fallbackApplied,
      warnings: warnings,
      fallbackStrategy: fallbackApplied ? 'texture' : 'sdf-or-texture',
    };
  }

  function shGetMoodPreset(task) {
    var key = task && task.desiredMood ? task.desiredMood : 'organic';
    return SH_MOOD_PRESETS[key] || SH_MOOD_PRESETS.organic;
  }

  function shDefaultTaskAssetHint() {
    return 'Formatos aceitos: .svg, .svgz, .png, .jpg, .jpeg, .webp, .json';
  }

  function shSetTaskAssetHint(msg) {
    var hint = document.getElementById('shTaskSvgAssetHint');
    if (hint) hint.textContent = msg || shDefaultTaskAssetHint();
  }

  function shSetTaskSvgAssetValue(value) {
    var input = document.getElementById('shTaskSvgAsset');
    if (!input) return;
    input.value = String(value || '').trim();
    shRefreshTaskPreview();
  }

  function shPopulateTaskAssetExamples() {
    var select = document.getElementById('shTaskSvgExample');
    if (!select) return;
    var options = '<option value="">Exemplos salvos...</option>';
    SH_TASK_ASSET_EXAMPLES.forEach(function (item) {
      options += '<option value="' + item.path + '">' + item.label + '</option>';
    });
    select.innerHTML = options;
  }

  window.shSelectSvgAssetExample = function (path) {
    if (!path) return;
    var picked = SH_TASK_ASSET_EXAMPLES.find(function (item) { return item.path === path; });
    shSetTaskSvgAssetValue(path);
    shSetTaskAssetHint('Exemplo selecionado: ' + (picked ? picked.label : path));
    shToast('Example loaded');
  };

  window.shOpenSvgAssetPicker = function () {
    var input = document.getElementById('shTaskSvgUploadInput');
    if (!input) return;
    input.value = '';
    input.click();
  };

  window.shHandleSvgAssetUpload = function (event) {
    var file = event && event.target && event.target.files ? event.target.files[0] : null;
    if (!file) return;

    var accepted = /\.(svg|svgz|png|jpe?g|webp|json)$/i.test(file.name || '');
    if (!accepted) {
      shToast('Unsupported format');
      shSetTaskAssetHint('Formato nao suportado para importacao. ' + shDefaultTaskAssetHint());
      return;
    }

    var key = 'uploaded://' + String(file.name || 'asset').trim().replace(/\s+/g, '-');
    if (_shUploadedTaskAssets[key]) {
      try { URL.revokeObjectURL(_shUploadedTaskAssets[key]); } catch (_err) { }
    }
    _shUploadedTaskAssets[key] = URL.createObjectURL(file);

    shSetTaskSvgAssetValue(key);

    var select = document.getElementById('shTaskSvgExample');
    if (select) select.value = '';

    var kb = Math.max(1, Math.round((file.size || 0) / 1024));
    shSetTaskAssetHint('Importado: ' + file.name + ' (' + kb + ' KB). Ref: ' + key);
    shToast('Asset imported');
  };

  function _shReadTaskInterface() {
    var getVal = function (id) {
      var el = document.getElementById(id);
      return el ? String(el.value || '').trim() : '';
    };
    var task = {
      svgAsset: getVal('shTaskSvgAsset') || _sh.shaderTask.svgAsset || '',
      desiredMood: getVal('shTaskMood') || _sh.shaderTask.desiredMood || 'organic',
      interactionType: getVal('shTaskInteraction') || _sh.shaderTask.interactionType || 'hover',
      performanceTarget: getVal('shTaskPerformance') || _sh.shaderTask.performanceTarget || 'desktop',
    };
    _sh.shaderTask = task;

    _sh.renderingStrategy = shBuildRenderingStrategy(task);
    var svgEval = shEvaluateSvgReadiness(task);
    _sh.agentReport = {
      warnings: svgEval.warnings || [],
      fallbackApplied: !!svgEval.fallbackApplied,
      tslTarget: SH_TSL_TARGET_VERSION,
    };

    return task;
  }

  function _shGetTaskContextText() {
    var task = _shReadTaskInterface();
    var mood = shGetMoodPreset(task);
    var svgEval = shEvaluateSvgReadiness(task);
    return '\n\n[ShaderTaskInterface]\n' + JSON.stringify(task, null, 2)
      + '\n\n[RenderingStrategy]\n' + JSON.stringify(_sh.renderingStrategy, null, 2)
      + '\n\n[MoodPreset]\n' + JSON.stringify(mood, null, 2)
      + '\n\n[SvgPreprocess]\n' + JSON.stringify(svgEval, null, 2)
      + '\n\n[ComplexityBudget]\n' + JSON.stringify(SH_COMPLEXITY_BUDGET, null, 2)
      + '\n\n[TSLTargetVersion]\n"' + SH_TSL_TARGET_VERSION + '"';
  }

  window.shRefreshTaskPreview = function () {
    var task = _shReadTaskInterface();
    var strategy = _sh.renderingStrategy;
    var svgEval = shEvaluateSvgReadiness(task);
    var pre = document.getElementById('shTaskPreview');
    if (pre) {
      pre.textContent = '{"svgAsset":"' + (task.svgAsset || 'auto-from-current-scene')
        + '", "desiredMood":"' + task.desiredMood
        + '", "interactionType":"' + task.interactionType
        + '", "performanceTarget":"' + task.performanceTarget
        + '", "useSDF":' + String(!!strategy.useSDF)
        + ', "layers":' + String(strategy.layerCount)
        + ', "postFX":"' + strategy.postProcessingLevel
        + '", "fallbackApplied":' + String(!!svgEval.fallbackApplied) + '}';
    }
    shUpdateRuntimeDiagnostics();
    shSaveState();
  };

  window.shApplyTaskToComposer = function () {
    var task = _shReadTaskInterface();
    var input = document.getElementById('shBrainInput');
    if (!input) return;
    var parts = [
      'Create a new shader scene using this task interface:',
      JSON.stringify(task),
      'Think in vector logic (SVG), execute in shader math (TSL).',
      'Return scene-json, scene-code, scene-uniforms, postfx-json, and agent-report.'
    ];
    input.value = parts.join(' ');
    input.focus();
  };

  window.shCopyTaskInterfaceJson = function () {
    var task = _shReadTaskInterface();
    var txt = JSON.stringify(task, null, 2);
    navigator.clipboard.writeText(txt).then(function () {
      shToast('Task interface copied');
    }).catch(function () {
      shToast('Copy failed');
    });
  };

  window.shResetTaskInterface = function () {
    var defaults = {
      shTaskSvgAsset: '',
      shTaskMood: 'organic',
      shTaskInteraction: 'hover',
      shTaskPerformance: 'desktop',
    };
    Object.keys(defaults).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.value = defaults[id];
    });
    var ex = document.getElementById('shTaskSvgExample');
    if (ex) ex.value = '';
    shSetTaskAssetHint();
    _sh.shaderTask = {
      svgAsset: '', desiredMood: 'organic', interactionType: 'hover', performanceTarget: 'desktop'
    };
    shRefreshTaskPreview();
    shToast('Task interface reset');
  };

  function shRefreshWorldSummary() {
    var summary = document.getElementById('shWorldSummary');
    if (!summary) return;
    var ps = _sh.previewState;
    summary.textContent = '{"timeSpeed":' + Number(ps.timeSpeed || 1).toFixed(2)
      + ', "dayNightCycle":' + Number(ps.dayNightCycle || 0).toFixed(2)
      + ', "weatherIntensity":' + Number(ps.weatherIntensity || 0).toFixed(2)
      + ', "rotation3D":' + Math.round(Number(ps.rotation3D || 0)) + '}';
  }

  function shUpdateRuntimeDiagnostics() {
    var strategyEl = document.getElementById('shStrategySummary');
    if (strategyEl) {
      strategyEl.textContent = 'RenderingStrategy ' + JSON.stringify(_sh.renderingStrategy || {}, null, 0);
    }

    var diagEl = document.getElementById('shAgentDiagnostics');
    if (diagEl) {
      var report = _sh.agentReport || { warnings: [], fallbackApplied: false, tslTarget: SH_TSL_TARGET_VERSION };
      var warnings = Array.isArray(report.warnings) ? report.warnings : [];
      diagEl.textContent = 'ShaderOutputMeta ' + JSON.stringify({
        fallbackApplied: !!report.fallbackApplied,
        warnings: warnings,
        tslTarget: report.tslTarget || SH_TSL_TARGET_VERSION,
        postFx: _sh.postFx,
      });
    }
  }

  function shSyncWorldUI() {
    var ps = _sh.previewState;
    var bind = function (id, val) {
      var el = document.getElementById(id); if (el) el.value = String(val);
      var as = document.getElementById('as_' + id); if (as) as.value = String(val);
    };
    bind('shWorldDayNight', Number(ps.dayNightCycle || 0.5));
    bind('shWorldTimeSpeed', Number(ps.timeSpeed || 1));
    bind('shWorldWeather', Number(ps.weatherIntensity || 0));
    bind('shWorldRotation', Number(ps.rotation3D || 0));
    bind('shSliderTOD', Number(ps.tod || 12));
    bind('shSliderEra', Number(ps.era || 1750));

    var setText = function (id, txt) {
      var el = document.getElementById(id); if (el) el.textContent = txt;
      var as = document.getElementById('as_' + id); if (as) as.textContent = txt;
    };
    setText('shWorldDayNightVal', Number(ps.dayNightCycle || 0.5).toFixed(2));
    setText('shWorldTimeSpeedVal', Number(ps.timeSpeed || 1).toFixed(2));
    setText('shWorldWeatherVal', Number(ps.weatherIntensity || 0).toFixed(2));
    setText('shWorldRotationVal', Math.round(Number(ps.rotation3D || 0)) + '°');
    setText('shValEra', Number(ps.era || 1750).toFixed(0));
    // TOD label is HH:MM
    var tod = Number(ps.tod || 12);
    var hh = Math.floor(tod), mm = Math.floor((tod % 1) * 60);
    setText('shValTOD', String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'));
    shRefreshWorldSummary();
    shUpdateRuntimeDiagnostics();
  }

  window.shSetDayNightCycle = function (val) {
    var cycle = Math.max(0, Math.min(1, parseFloat(val)));
    _sh.previewState.dayNightCycle = cycle;
    var tod = 23 - (11 * cycle);
    _sh.previewState.tod = tod;
    var sl = document.getElementById('shSliderTOD');
    if (sl) sl.value = tod;
    shUpdateTOD(tod);
    shSyncWorldUI();
    shSaveState();
  };

  window.shSetWorldTimeSpeed = function (val) {
    _sh.previewState.timeSpeed = Math.max(0.2, Math.min(4, parseFloat(val) || 1));
    shSyncWorldUI();
    shSaveState();
  };

  window.shSetWorldWeather = function (val) {
    _sh.previewState.weatherIntensity = Math.max(0, Math.min(1, parseFloat(val) || 0));
    _sh.previewState.weather = _sh.previewState.weatherIntensity > 0.05 ? 'rain' : 'clear';
    shSyncWorldUI();
    shSaveState();
  };

  window.shSetWorldRotation = function (val) {
    _sh.previewState.rotation3D = Math.max(-30, Math.min(30, parseFloat(val) || 0));
    shSyncWorldUI();
    shSaveState();
  };

  /* ═════════════════════════════════════════════════════════════
     EXTENDED CAPABILITIES — era · weather pills · envFx · capture
     Ported from shaderbench.html / edinburgh-scene-studio / ontologia
     ═════════════════════════════════════════════════════════════ */

  window.shSetEra = function (val) {
    var y = Math.max(1200, Math.min(2025, parseInt(val, 10) || 1750));
    _sh.previewState.era = y;
    var vl = document.getElementById('shValEra');
    if (vl) vl.textContent = y;
    var asVl = document.getElementById('as_shValEra');
    if (asVl) asVl.textContent = y;
    var sl = document.getElementById('shSliderEra');
    if (sl && parseInt(sl.value, 10) !== y) sl.value = y;
    var asSl = document.getElementById('as_shSliderEra');
    if (asSl && parseInt(asSl.value, 10) !== y) asSl.value = y;
    var hud = document.getElementById('shHudEra');
    if (hud) hud.textContent = y;
    // auto era-sepia: newer year = less sepia, older = more
    if (_sh.envFx && _sh.envFx.autoEraSepia) {
      var t = 1 - ((y - 1200) / (2025 - 1200)); // 1200→1, 2025→0
      _sh.postFx.sepia = Math.min(1, t * 0.6);
      _sh.postFx.warmth = Math.min(1, t * 0.4);
      shApplyPostFxRuntime();
      shSyncPostFxUI();
    }
    shSaveState();
  };

  window.shSetWeatherType = function (type) {
    var types = ['clear', 'cloudy', 'rain', 'fog', 'snow', 'storm'];
    if (types.indexOf(type) < 0) return;
    _sh.envFx.weatherType = type;
    _sh.previewState.weather = type;
    // derive intensity from type so legacy shSetWorldWeather stays in sync
    var intensityMap = { clear: 0, cloudy: 0.25, rain: 0.55, fog: 0.45, snow: 0.4, storm: 0.9 };
    _sh.previewState.weatherIntensity = intensityMap[type];
    // sync legacy slider + pill active state
    var sl = document.getElementById('shWorldWeather');
    if (sl) sl.value = _sh.previewState.weatherIntensity;
    var vl = document.getElementById('shWorldWeatherVal');
    if (vl) vl.textContent = _sh.previewState.weatherIntensity.toFixed(2);
    var pills = document.querySelectorAll('.sh-weather-pill');
    pills.forEach(function (p) { p.classList.toggle('active', p.getAttribute('data-weather') === type); });
    shSaveState();
  };

  var _shEnvFxMap = {
    wind: { slider: 'shEnvWind', val: 'shEnvWindVal', dec: 2, min: 0, max: 2 },
    fogDensity: { slider: 'shEnvFog', val: 'shEnvFogVal', dec: 2, min: 0, max: 1 },
    turbulence: { slider: 'shEnvTurb', val: 'shEnvTurbVal', dec: 2, min: 0, max: 1 },
    gravity: { slider: 'shEnvGrav', val: 'shEnvGravVal', dec: 2, min: 0, max: 2 },
    particleDensity: { slider: 'shEnvPartD', val: 'shEnvPartDVal', dec: 2, min: 0, max: 1 },
    particleGlow: { slider: 'shEnvPartG', val: 'shEnvPartGVal', dec: 2, min: 0, max: 1 },
  };

  window.shSetEnvFx = function (key, val) {
    var m = _shEnvFxMap[key];
    if (!m) return;
    var v = parseFloat(val);
    if (!Number.isFinite(v)) return;
    v = Math.max(m.min, Math.min(m.max, v));
    _sh.envFx[key] = v;
    var vl = document.getElementById(m.val);
    if (vl) vl.textContent = v.toFixed(m.dec);
    var asVl = document.getElementById('as_' + m.val);
    if (asVl) asVl.textContent = v.toFixed(m.dec);
    var sl = document.getElementById(m.slider);
    if (sl && Math.abs(parseFloat(sl.value) - v) > 1e-6) sl.value = v;
    var asSl = document.getElementById('as_' + m.slider);
    if (asSl && Math.abs(parseFloat(asSl.value) - v) > 1e-6) asSl.value = v;
    // forward to 3D if available
    if (typeof window.sh3dSetEnvFx === 'function') window.sh3dSetEnvFx(key, v);
    shSaveState();
  };

  window.shToggleEnvFlag = function (flag, el) {
    if (!_sh.envFx || !(flag in _sh.envFx)) return;
    _sh.envFx[flag] = !_sh.envFx[flag];
    if (el) el.classList.toggle('on', _sh.envFx[flag]);
    // mirror toggle in both panels
    var t = document.getElementById('shEnvToggle_' + flag);
    if (t && t !== el) t.classList.toggle('on', _sh.envFx[flag]);
    var asT = document.getElementById('as_shEnvToggle_' + flag);
    if (asT && asT !== el) asT.classList.toggle('on', _sh.envFx[flag]);
    // Notify 3D subsystem for autoRotate / mouseReactive
    if (flag === 'autoRotate' && typeof window.sh3dSetAutoRotate === 'function') {
      window.sh3dSetAutoRotate(_sh.envFx.autoRotate);
    }
    if (flag === 'autoEraSepia') shSetEra(_sh.previewState.era);
    shSaveState();
  };

  window.shSyncEnvFxUI = function () {
    var env = _sh.envFx || {};
    Object.keys(_shEnvFxMap).forEach(function (key) {
      var m = _shEnvFxMap[key];
      var sl = document.getElementById(m.slider);
      var vl = document.getElementById(m.val);
      var v = env[key];
      if (v === undefined) return;
      if (sl) sl.value = v;
      if (vl) vl.textContent = v.toFixed(m.dec);
      var asSl = document.getElementById('as_' + m.slider);
      var asVl = document.getElementById('as_' + m.val);
      if (asSl) asSl.value = v;
      if (asVl) asVl.textContent = v.toFixed(m.dec);
    });
    ['autoRotate', 'autoCycleDayNight', 'mouseReactive', 'autoEraSepia'].forEach(function (flag) {
      var t = document.getElementById('shEnvToggle_' + flag);
      if (t) t.classList.toggle('on', !!env[flag]);
      var asT = document.getElementById('as_shEnvToggle_' + flag);
      if (asT) asT.classList.toggle('on', !!env[flag]);
    });
    var pills = document.querySelectorAll('.sh-weather-pill');
    pills.forEach(function (p) { p.classList.toggle('active', p.getAttribute('data-weather') === env.weatherType); });
    var era = document.getElementById('shSliderEra');
    if (era) era.value = _sh.previewState.era;
    var asEra = document.getElementById('as_shSliderEra');
    if (asEra) asEra.value = _sh.previewState.era;
    var eraVal = document.getElementById('shValEra');
    if (eraVal) eraVal.textContent = _sh.previewState.era;
    var asEraVal = document.getElementById('as_shValEra');
    if (asEraVal) asEraVal.textContent = _sh.previewState.era;
  };

  /* ── CAPTURE preview as PNG ── */
  window.shCapturePNG = function () {
    try {
      if (_sh.sceneMode === '3d' && typeof window.sh3dCapturePNG === 'function') {
        window.sh3dCapturePNG();
        return;
      }
      var svgEl = document.querySelector('#shPreviewSVG svg');
      if (!svgEl) { shToast('Nada para capturar'); return; }
      var bbox = svgEl.getBoundingClientRect();
      var w = Math.max(800, Math.floor(bbox.width));
      var h = Math.max(500, Math.floor(bbox.height));
      // serialize SVG and rasterize
      var clone = svgEl.cloneNode(true);
      if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      var str = new XMLSerializer().serializeToString(clone);
      var blob = new Blob([str], { type: 'image/svg+xml;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var img = new Image();
      img.onload = function () {
        var cnv = document.createElement('canvas');
        cnv.width = w; cnv.height = h;
        var ctx = cnv.getContext('2d');
        // apply current CSS filter to the context for parity with preview
        var main = document.getElementById('shPreviewSVG');
        if (main && main.style.filter) ctx.filter = main.style.filter;
        ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        cnv.toBlob(function (png) {
          if (!png) { shToast('Falha ao gerar PNG'); return; }
          var a = document.createElement('a');
          a.href = URL.createObjectURL(png);
          var name = (_sh.activeScene || 'scene') + '-' + Date.now() + '.png';
          a.download = name;
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(function () { URL.revokeObjectURL(a.href); }, 1500);
          shToast('Captura salva: ' + name);
        }, 'image/png');
      };
      img.onerror = function () { URL.revokeObjectURL(url); shToast('Falha ao renderizar SVG'); };
      img.src = url;
    } catch (e) { shToast('Erro: ' + (e.message || e)); }
  };

  /* ── FX PRESET (save/load full visual+env state) ── */
  window.shExportFxPreset = function () {
    var preset = {
      version: 1,
      exportedAt: new Date().toISOString(),
      preview: _sh.previewState,
      postFx: _sh.postFx,
      envFx: _sh.envFx,
    };
    var blob = new Blob([JSON.stringify(preset, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'kout-fx-preset-' + Date.now() + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1500);
    shToast('Preset FX exportado');
  };

  window.shImportFxPreset = function () {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      var r = new FileReader();
      r.onload = function () {
        try {
          var p = JSON.parse(r.result);
          if (p.preview) _sh.previewState = Object.assign({}, _sh.previewState, p.preview);
          if (p.postFx) _sh.postFx = shNormalizePostFx(Object.assign({}, _sh.postFx, p.postFx));
          if (p.envFx) _sh.envFx = Object.assign({}, _sh.envFx, p.envFx);
          shApplyPostFxRuntime();
          shSyncPostFxUI();
          if (typeof shSyncWorldUI === 'function') shSyncWorldUI();
          if (typeof window.shSyncEnvFxUI === 'function') window.shSyncEnvFxUI();
          shSaveState();
          shToast('Preset FX aplicado');
        } catch (err) { shToast('JSON inválido: ' + err.message); }
      };
      r.readAsText(f);
    };
    input.click();
  };

  window.shToggleBrainChatSize = function (forceExpanded) {
    var main = document.querySelector('.sh-brain-main');
    var btn = document.getElementById('shBrainExpandBtn');
    if (!main || !btn) return;
    var shouldExpand = typeof forceExpanded === 'boolean'
      ? forceExpanded
      : !main.classList.contains('chat-expanded');
    main.classList.toggle('chat-expanded', shouldExpand);
    _sh.brainChatExpanded = shouldExpand;
    btn.innerHTML = shouldExpand
      ? '<i class="fas fa-down-left-and-up-right-to-center"></i><span>Restaurar</span>'
      : '<i class="fas fa-up-right-and-down-left-from-center"></i><span>Expandir</span>';
    btn.title = shouldExpand ? 'Restaurar layout' : 'Expandir chat';
    shSaveState();
  };

  window.shBrainSend = function () {
    var input = document.getElementById('shBrainInput');
    if (!input || !input.value.trim() || _shBrainStreaming) return;
    var msg = input.value.trim();
    input.value = '';

    // ── Slash command: /persist ──
    if (/^\/persist$/i.test(msg.trim())) {
      _sh.brainMessages.push({ role: 'user', text: msg });
      shRenderBrainChat();
      window.shImplementWithAgent();
      return;
    }

    // ── Slash command: /save ──
    if (/^\/save$/i.test(msg.trim())) {
      _sh.brainMessages.push({ role: 'user', text: msg });
      shRenderBrainChat();
      shBrainSaveChat();
      return;
    }

    _sh.brainMessages.push({ role: 'user', text: msg });
    shRenderBrainChat();

    // Yes/apply shortcut — if user confirms, apply last pending 3D config or 2D scene-json without calling LLM
    var isAffirmative = /^(yes|sim|apply|aplica|ok|yep|sure|go|do it|fa[çc]a|pode|pode ser|cria|criar|adiciona|add it|save it|salva|salvar)$/i.test(msg.trim());
    if (isAffirmative) {
      // 3D path: check for scene3d-config first
      var last3dMsg = _sh.brainMessages.slice().reverse().find(function (m) { return m.role === 'agent' && m.text.indexOf('```scene3d-config') !== -1; });
      if (last3dMsg) {
        var cfgMatch = last3dMsg.text.match(/```scene3d-config\n([\s\S]*?)```/);
        if (cfgMatch) {
          try {
            var cfg3d = JSON.parse(cfgMatch[1]);
            cfg3d.type = '3d';
            if (!cfg3d.id) cfg3d.id = '3d-scene-' + Date.now();
            if (!cfg3d.name) cfg3d.name = '3D Scene ' + new Date().toLocaleTimeString();
            if (!cfg3d.icon) cfg3d.icon = '🧊';
            if (!cfg3d.category) cfg3d.category = '3d';
            if (_sh.sceneMode !== '3d') window.shSetSceneMode('3d');
            if (typeof window.sh3dApplyConfig === 'function') window.sh3dApplyConfig(cfg3d);
            window.shRegister3DScene(cfg3d);
            shToast('3D scene applied: ' + cfg3d.name);
            _sh.brainMessages.push({ role: 'agent', text: '✅ **' + cfg3d.name + '** applied in 3D mode and saved to gallery.\n\nClick **Apply & Save** on the config block above to re-apply at any time.' });
            shRenderBrainChat();
            return;
          } catch (e) { }
        }
      }
      // 2D path
      var lastAgentMsg = _sh.brainMessages.slice().reverse().find(function (m) { return m.role === 'agent' && m.text.indexOf('```scene-json') !== -1; });
      if (lastAgentMsg) {
        var jsonMatch = lastAgentMsg.text.match(/```scene-json\n([\s\S]*?)```/);
        var codeMatch = lastAgentMsg.text.match(/```scene-code\n([\s\S]*?)```/);
        if (jsonMatch) {
          try {
            var scData = JSON.parse(jsonMatch[1]);
            if (scData.id && scData.name) {
              scData.category = 'custom';
              if (codeMatch) scData.code = codeMatch[1].trim();
              var allSc = SH_SCENES.concat(_sh.customScenes);
              var existing = allSc.find(function (s) { return s.id === scData.id; });
              if (existing) Object.assign(existing, scData);
              else _sh.customScenes.push(scData);
              shBuildSceneList();
              shUpdateStats();
              shSelectScene(scData.id);
              shSaveState();
              if (scData.code) {
                var appliedSc2 = SH_SCENES.concat(_sh.customScenes).find(function (s) { return s.id === scData.id; });
                if (appliedSc2) {
                  shStopPreviewLoop();
                  shSwitchTab('preview');
                  _shStartCustomCodeLoop(appliedSc2, scData.code);
                }
                _sh.brainMessages.push({
                  role: 'agent',
                  text: '✅ **' + scData.name + '** applied with custom code in this session. Preview is now live.\n\nTo persist files in `content/scenes`, click **Implement with Agent** or type `/persist`.'
                });
              } else {
                _sh.brainMessages.push({
                  role: 'agent',
                  text: '✅ **' + scData.name + '** applied in this session.\n\nTo persist files in `content/scenes`, click **Implement with Agent** or type `/persist`.'
                });
              }
              shRenderBrainChat();
              shToast('Scene applied: ' + scData.name);
              return;
            }
          } catch (e) { }
        }
      }
    }

    // Build conversation history for context (last 12 messages)
    var history = [];
    var recent = _sh.brainMessages.slice(-12);
    recent.forEach(function (m) {
      if (m.role === 'user') history.push({ role: 'user', content: m.text });
      else if (m.role === 'agent') history.push({ role: 'assistant', content: m.text });
    });

    // Add the current scene context to the message
    var all = SH_SCENES.concat(_sh.customScenes);
    var activeSc = all.find(function (s) { return s.id === _sh.activeScene; });
    var sceneCtx = '';
    if (activeSc && activeSc.type === '3d') {
      sceneCtx = '\n\n[Active 3D scene: ' + activeSc.id + ' "' + (activeSc.name || '3D Scene') + '" — '
        + 'environment:' + (activeSc.environment || 'studio') + ' model:' + (activeSc.model || 'none') + ']';
    } else if (activeSc) {
      sceneCtx = '\n\n[Active scene: ' + activeSc.id + ' "' + activeSc.name + '" — '
        + 'sky1:' + activeSc.sky1 + ' sky2:' + activeSc.sky2
        + ' ground:' + activeSc.ground + ' bld:' + activeSc.bld + ' acc:' + activeSc.acc + ']';
    }

    // Show streaming indicator
    _shBrainStreaming = true;
    _sh.brainMessages.push({ role: 'agent', text: '', streaming: true });
    shRenderBrainChat();
    shUpdateBrainUI();

    var msgIdx = _sh.brainMessages.length - 1;

    // Use OliviaAPI.assistant.chat for real LLM streaming
    _shBrainAbortCtrl = new AbortController();
    _shUpdatePanelContextIndicator();
    shStreamChat(msg + sceneCtx + _shGetTaskContextText() + _shGetPanelContextText(), history, msgIdx);
  };

  async function shStreamChat(message, history, msgIdx) {
    var log = document.getElementById('shBrainLog');
    try {
      var sectionCtx = (typeof window.oliviaResolveSectionAgentContext === 'function')
        ? window.oliviaResolveSectionAgentContext('shaders')
        : null;
      if (sectionCtx && sectionCtx.assigned && !sectionCtx.active) {
        var inactiveName = sectionCtx.agent ? (sectionCtx.agent.name || sectionCtx.agent.agent_id) : sectionCtx.agentId;
        throw new Error('Assigned shaders agent is inactive: ' + inactiveName);
      }

      var shaderSystem = SH_SYSTEM_PROMPT;
      if (sectionCtx && sectionCtx.system) {
        shaderSystem += '\n\n' + sectionCtx.system;
      }
      // Inject live asset catalog so the LLM can reference current assets by id
      try {
        var _assetList = (typeof window.shListAssets === 'function') ? window.shListAssets() : [];
        if (_assetList.length) {
          shaderSystem += '\n\n━━ AVAILABLE ASSETS (catalog) ━━\n'
            + _assetList.map(function (a) {
              return '- ' + a.id + ' [' + a.category + '] ' + (a.icon || '') + ' ' + a.name
                + (a.desc ? ' — ' + a.desc : '')
                + ((a.tags && a.tags.length) ? '  {tags: ' + a.tags.join(',') + '}' : '');
            }).join('\n');
        }
      } catch (_e) { }
      // Inject 3D context when in 3D mode
      if (_sh.sceneMode === '3d' && typeof window.sh3dBuildBrainPrompt === 'function') {
        shaderSystem += '\n\n━━ CURRENT MODE: 3D/WebGL ━━\n'
          + 'The user is working in 3D mode. You are now the 3D Scene Agent.\n'
          + 'You have full access to Three.js r163, GLTFLoader, OrbitControls, AnimationMixer.\n'
          + 'Environment presets: studio, outdoor, night, cyberpunk, warm, product.\n'
          + 'CRITICAL — three-code blocks must NOT contain import statements. THREE = window.THREE (already loaded).\n'
          + 'Do NOT write: import * as THREE from "three"; — just use THREE directly.\n'
          + 'For GLB model loading: call sh3dLoadGLB(url) or sh3dUploadGLB() — do NOT create your own GLTFLoader.\n'
          + 'For 3D scenes, output blocks in this order:\n'
          + '1. ```scene3d-config\n{"type":"3d","environment":"studio","bg":"#1a1a2e","lighting":{"ambient":0.6,"directional":1.4},"animations":{"play":true,"speed":1.0}}\n```\n'
          + '2. ```three-code\n// THREE available globally — no import needed\nconst mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());\n```\n'
          + 'Current 3D scene: ' + (typeof window.sh3dExportConfig === 'function' ? window.sh3dExportConfig() : 'none');
      }

      var fullContent = await OliviaAPI.assistant.chat(
        message,
        {
          history: history.slice(0, -1),
          system: shaderSystem,
          sessionKey: sectionCtx && sectionCtx.sessionKey ? sectionCtx.sessionKey : 'section:shaders:default',
          agentId: sectionCtx && sectionCtx.agentId ? sectionCtx.agentId : undefined,
          projectId: (typeof getCurrentProjectId === 'function' && getCurrentProjectId()) ? getCurrentProjectId() : undefined
        },
        function onToken(_token, accumulated) {
          _sh.brainMessages[msgIdx].text = accumulated;
          var msgEls = log ? log.querySelectorAll('.sh-brain-msg.agent') : [];
          var lastEl = msgEls[msgEls.length - 1];
          if (lastEl) {
            lastEl.innerHTML = shFormatBrainMsg(accumulated);
            log.scrollTop = log.scrollHeight;
          }
        }
      );

      _sh.brainMessages[msgIdx].text = fullContent;
      _sh.brainMessages[msgIdx].streaming = false;
      shIngestAgentReportFromText(fullContent);
      shIngestPostFxFromText(fullContent);
      shRenderBrainChat();
      // Note: no auto-apply — user confirms via the Apply Scene button or by typing "yes"

    } catch (err) {
      var errMsg = (err && err.message) || String(err);
      if (errMsg.indexOf('abort') !== -1) errMsg = 'Stopped';
      _sh.brainMessages[msgIdx].text = '⚠ ' + errMsg;
      _sh.brainMessages[msgIdx].streaming = false;
      shRenderBrainChat();
    } finally {
      _shBrainStreaming = false;
      _shBrainAbortCtrl = null;
      shUpdateBrainUI();
    }
  }

  window.shBrainStop = function () {
    if (_shBrainAbortCtrl) _shBrainAbortCtrl.abort();
    _shBrainStreaming = false;
    shUpdateBrainUI();
  };

  function shUpdateBrainUI() {
    var sendBtn = document.querySelector('.sh-brain-compose button');
    if (!sendBtn) return;
    if (_shBrainStreaming) {
      sendBtn.innerHTML = '<i class="fas fa-stop"></i>';
      sendBtn.onclick = window.shBrainStop;
      sendBtn.title = 'Stop generating';
    } else {
      sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
      sendBtn.onclick = window.shBrainSend;
      sendBtn.title = 'Send';
    }
  }

  window.shBrainKeydown = function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (_shBrainStreaming) return;
      shBrainSend();
    }
  };

  function shIngestAgentReportFromText(text) {
    if (!text) return;
    var match = String(text).match(/```agent-report\n([\s\S]*?)```/);
    if (!match) return;
    try {
      var parsed = JSON.parse(match[1]);
      _sh.agentReport = {
        warnings: Array.isArray(parsed.warnings) ? parsed.warnings.map(function (w) { return String(w); }) : [],
        fallbackApplied: !!parsed.fallbackApplied,
        tslTarget: SH_TSL_TARGET_VERSION,
      };
      shUpdateRuntimeDiagnostics();
      shSaveState();
    } catch (_err) {
      // ignore malformed report blocks
    }
  }

  function shIngestPostFxFromText(text) {
    if (!text) return;
    var match = String(text).match(/```postfx-json\n([\s\S]*?)```/);
    if (!match) return;
    try {
      var parsed = JSON.parse(match[1]);
      shApplyPostFxObject(parsed);
    } catch (_err) {
      // ignore malformed postfx blocks
    }
  }

  function shFormatBrainMsg(text) {
    if (!text) return '';
    var placeholders = {};
    var idx = 0;

    // Step 1: extract custom fenced blocks BEFORE marked.parse so they survive unchanged
    var processed = text
      .replace(/```scene-json\n([\s\S]*?)```/g, function (_, code) {
        var key = '\x00SJ' + (idx++) + '\x00';
        placeholders[key] = '<pre class="sh-code-block scene-json"><code>'
          + escapeHtml(code.replace(/\n$/, ''))
          + '</code></pre><button class="sh-apply-scene-btn" onclick="shApplySceneFromChat(this)">'
          + '<i class="fas fa-plus-circle"></i> Apply Scene</button>';
        return key;
      })
      .replace(/```scene-code\n([\s\S]*?)```/g, function (_, code) {
        var key = '\x00SC' + (idx++) + '\x00';
        placeholders[key] = '<pre class="sh-code-block scene-code"><code>'
          + escapeHtml(code.replace(/\n$/, ''))
          + '</code></pre><button class="sh-apply-code-btn" onclick="shApplyCodeFromChat(this)">'
          + '<i class="fas fa-code"></i> Copy to Editor</button>';
        return key;
      })
      .replace(/```scene-uniforms\n([\s\S]*?)```/g, function (_, code) {
        var key = '\x00SU' + (idx++) + '\x00';
        placeholders[key] = '<pre class="sh-code-block scene-uniforms"><code>'
          + escapeHtml(code.replace(/\n$/, ''))
          + '</code></pre><button class="sh-apply-code-btn" onclick="shApplyUniformsFromChat(this)">'
          + '<i class="fas fa-sliders-h"></i> Apply Uniforms</button>';
        return key;
      })
      .replace(/```postfx-json\n([\s\S]*?)```/g, function (_, code) {
        var key = '\x00PF' + (idx++) + '\x00';
        placeholders[key] = '<pre class="sh-code-block postfx-json"><code>'
          + escapeHtml(code.replace(/\n$/, ''))
          + '</code></pre><button class="sh-apply-code-btn" onclick="shApplyPostFxFromChat(this)">'
          + '<i class="fas fa-film"></i> Apply PostFX</button>';
        return key;
      })
      .replace(/```agent-report\n([\s\S]*?)```/g, function (_, code) {
        var key = '\x00AR' + (idx++) + '\x00';
        placeholders[key] = '<pre class="sh-code-block agent-report"><code>'
          + escapeHtml(code.replace(/\n$/, ''))
          + '</code></pre><button class="sh-apply-code-btn" onclick="shApplyAgentReportFromChat(this)">'
          + '<i class="fas fa-triangle-exclamation"></i> Apply Report</button>';
        return key;
      })
      .replace(/```scene3d-config\n([\s\S]*?)```/g, function (_, code) {
        var key = '\x00S3C' + (idx++) + '\x00';
        placeholders[key] = '<pre class="sh-code-block scene3d-config"><code>'
          + escapeHtml(code.replace(/\n$/, ''))
          + '</code></pre>'
          + '<div class="sh-apply-btn-row">'
          + '<button class="sh-apply-scene-btn sh3d-apply-btn" onclick="shApply3DConfigFromChat(this)">'
          + '<i class="fas fa-cube"></i> Apply 3D Config</button>'
          + '<button class="sh-apply-code-btn sh3d-save-btn" onclick="shApply3DConfigFromChat(this, true)">'
          + '<i class="fas fa-floppy-disk"></i> Apply &amp; Save</button>'
          + '</div>';
        return key;
      })
      .replace(/```(?:three-code|threejs-code)\n([\s\S]*?)```/g, function (_, code) {
        var key = '\x00TC' + (idx++) + '\x00';
        placeholders[key] = '<pre class="sh-code-block three-code"><code>'
          + escapeHtml(code.replace(/\n$/, ''))
          + '</code></pre>'
          + '<div class="sh-apply-btn-row">'
          + '<button class="sh-apply-code-btn" onclick="shApply3DCodeFromChat(this)">'
          + '<i class="fas fa-code"></i> Copy Three.js Code</button>'
          + '</div>';
        return key;
      });

    // Step 2: standard markdown via marked
    var html = (typeof marked !== 'undefined' && marked.parse)
      ? marked.parse(processed)
      : processed.replace(/\n/g, '<br>');

    // Step 3: restore custom blocks
    Object.keys(placeholders).forEach(function (key) {
      html = html.split(key).join(placeholders[key]);
    });

    // Step 4: color swatch decoration for hex codes not already inside a code tag
    html = html.replace(/(?<!background:)(#[0-9A-Fa-f]{6})\b/g,
      '<span class="sh-color-swatch" style="background:$1"></span><code class="sh-inline-code">$1</code>');

    return html;
  }

  function shRenderBrainChat() {
    var log = document.getElementById('shBrainLog');
    if (!log) return;
    var html = '';
    _sh.brainMessages.forEach(function (m) {
      var content = m.role === 'agent' ? shFormatBrainMsg(m.text) : escapeHtml(m.text);
      var streaming = m.streaming ? ' streaming' : '';
      html += '<div class="sh-brain-msg ' + m.role + streaming + '">' + content;
      if (m.streaming) html += '<span class="sh-typing-dot"><span></span><span></span><span></span></span>';
      html += '</div>';
    });
    log.innerHTML = html;
    log.scrollTop = log.scrollHeight;
  }

  /* ── /save command for shader brain chat ── */
  function shBrainSaveChat() {
    var messages = _sh.brainMessages.filter(function (m) { return m.text && !m.streaming; });
    if (!messages.length) {
      _sh.brainMessages.push({ role: 'agent', text: '⚠ Nenhuma conversa para salvar.' });
      shRenderBrainChat();
      return;
    }

    shPromptModal('Nome para esta conversa (deixe vazio para usar data/hora):', function (rawName) {
      if (rawName === null) return; // user cancelled

      var sessionName = (rawName && rawName.trim()) || ('shaders_' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19));

      // Resolve section agent for server-side persistence
      var sectionCtx = (typeof window.oliviaResolveSectionAgentContext === 'function')
        ? window.oliviaResolveSectionAgentContext('shaders')
        : null;
      var agentId = sectionCtx && sectionCtx.agentId ? sectionCtx.agentId : null;

      var persistMessages = messages.map(function (m) {
        return { role: m.role === 'agent' ? 'assistant' : m.role, content: m.text };
      });

      if (agentId && typeof API_BASE !== 'undefined') {
        fetch(API_BASE + '/api/agents/' + encodeURIComponent(agentId) + '/chat/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: persistMessages, session_name: sessionName })
        }).then(function (res) {
          if (res.ok) {
            _sh.brainMessages.push({ role: 'agent', text: '✅ Conversa salva: **' + sessionName + '**' });
          } else {
            _sh.brainMessages.push({ role: 'agent', text: '⚠ Falha ao salvar conversa no servidor. Salvando localmente...' });
            _shSaveBrainChatLocal(sessionName, persistMessages);
          }
          shRenderBrainChat();
        }).catch(function () {
          _shSaveBrainChatLocal(sessionName, persistMessages);
          _sh.brainMessages.push({ role: 'agent', text: '✅ Conversa salva localmente: **' + sessionName + '**' });
          shRenderBrainChat();
        });
      } else {
        _shSaveBrainChatLocal(sessionName, persistMessages);
        _sh.brainMessages.push({ role: 'agent', text: '✅ Conversa salva localmente: **' + sessionName + '**' });
        shRenderBrainChat();
      }
    });
  }

  function _shSaveBrainChatLocal(name, messages) {
    try {
      var key = 'olivia.shaders.savedChats';
      var existing = JSON.parse(localStorage.getItem(key) || '[]');
      existing.push({ name: name, date: new Date().toISOString(), messages: messages });
      localStorage.setItem(key, JSON.stringify(existing));
      return true;
    } catch (e) { return false; }
  }

  /* ── Scene extraction from LLM output ── */
  function shExtractSceneFromResponse(text) {
    var jsonMatch = text.match(/```scene-json\n([\s\S]*?)```/);
    if (!jsonMatch) return;
    try {
      var scData = JSON.parse(jsonMatch[1]);
      if (!scData.id || !scData.name) return;
      // Check if scene already exists
      var all = SH_SCENES.concat(_sh.customScenes);
      var existing = all.find(function (s) { return s.id === scData.id; });
      if (existing) {
        // Update existing scene metadata
        Object.assign(existing, scData);
        shToast('Scene updated: ' + scData.name);
      } else {
        // Auto-add as custom scene
        scData.category = 'custom';
        _sh.customScenes.push(scData);
        shToast('Scene created: ' + scData.name);
      }
      shBuildSceneList();
      shUpdateStats();
      shSelectScene(scData.id);
      shSaveState();
    } catch (e) { /* JSON parse failed — ignore, user can apply manually */ }
  }

  /* ── Apply scene/code from chat buttons ── */
  window.shApplySceneFromChat = function (btn) {
    var pre = btn.previousElementSibling;
    if (!pre) return;
    var code = pre.textContent || pre.innerText;
    try {
      var scData = JSON.parse(code.trim());
      if (!scData.id || !scData.name) { shToast('Invalid scene JSON'); return; }
      scData.category = 'custom';
      // Also grab any scene-code block from the same message bubble
      var bubble = btn.closest ? btn.closest('.sh-brain-msg') : null;
      if (bubble) {
        var codePre = bubble.querySelector('pre.sh-code-block.scene-code code');
        if (codePre) { scData.code = (codePre.textContent || codePre.innerText).trim(); }
      }
      var all = SH_SCENES.concat(_sh.customScenes);
      var existing = all.find(function (s) { return s.id === scData.id; });
      if (existing) Object.assign(existing, scData);
      else _sh.customScenes.push(scData);
      shBuildSceneList();
      shUpdateStats();
      shSelectScene(scData.id);
      shSaveState();
      btn.innerHTML = '<i class="fas fa-check"></i> Applied';
      btn.disabled = true;
      if (scData.code) {
        // Run the code immediately in the preview
        var appliedSc = SH_SCENES.concat(_sh.customScenes).find(function (s) { return s.id === scData.id; });
        if (appliedSc) {
          shStopPreviewLoop();
          shSwitchTab('preview');
          _shStartCustomCodeLoop(appliedSc, scData.code);
          shToast('Scene + code applied! Preview is live 🎬');
        }
      } else {
        shToast('Scene applied: ' + scData.name);
      }
    } catch (e) { shToast('Parse error: ' + e.message); }
  };

  window.shApplyCodeFromChat = function (btn) {
    var pre = btn.previousElementSibling;
    if (!pre) return;
    var code = pre.textContent || pre.innerText;
    var editor = document.getElementById('shCodeEditor');
    if (editor) {
      editor.value = code.trim();
      _sh.editorCode = code.trim();
      shSwitchTab('editor');
      shToast('Code copied to editor');
      btn.innerHTML = '<i class="fas fa-check"></i> Copied';
      btn.disabled = true;
    }
  };

  /* ── 3D config Apply / Apply & Save ─────────────────────────────── */
  window.shApply3DConfigFromChat = function (btn, andSave) {
    var row = btn.closest ? btn.closest('.sh-apply-btn-row') : null;
    var pre = row ? row.previousElementSibling : btn.previousElementSibling;
    if (!pre) return;
    var code = pre.textContent || pre.innerText;
    try {
      var cfg = JSON.parse(code.trim());
      cfg.type = '3d';
      if (!cfg.id) cfg.id = '3d-scene-' + Date.now();
      if (!cfg.name) cfg.name = '3D Scene ' + new Date().toLocaleTimeString();
      if (!cfg.icon) cfg.icon = '🧊';
      if (!cfg.category) cfg.category = '3d';
      // Also grab three-code from same bubble if present
      var bubble = btn.closest ? btn.closest('.sh-brain-msg') : null;
      if (bubble) {
        var codePre = bubble.querySelector('pre.sh-code-block.three-code code');
        if (codePre) cfg.threeCode = (codePre.textContent || codePre.innerText).trim();
      }
      // Switch to 3D mode and apply
      if (_sh.sceneMode !== '3d') window.shSetSceneMode('3d');
      if (typeof window.sh3dApplyConfig === 'function') window.sh3dApplyConfig(cfg);
      shSwitchTab('preview');
      // Save to gallery
      if (andSave) {
        window.shRegister3DScene(cfg);
        shToast('3D scene applied & saved: ' + cfg.name);
        // Mark all buttons in row
        if (row) row.querySelectorAll('button').forEach(function (b) {
          b.innerHTML = '<i class="fas fa-check"></i> ' + (b === btn ? 'Saved' : 'Applied');
          b.disabled = true;
        });
      } else {
        shToast('3D config applied (not saved)');
        btn.innerHTML = '<i class="fas fa-check"></i> Applied';
        btn.disabled = true;
      }
    } catch (e) { shToast('3D config parse error: ' + e.message); }
  };

  /* ── Three.js code copy to editor ───────────────────────────────── */
  window.shApply3DCodeFromChat = function (btn) {
    var row = btn.closest ? btn.closest('.sh-apply-btn-row') : null;
    var pre = row ? row.previousElementSibling : btn.previousElementSibling;
    if (!pre) return;
    var code = pre.textContent || pre.innerText;
    var editor = document.getElementById('shCodeEditor');
    if (editor) {
      editor.value = code.trim();
      _sh.editorCode = code.trim();
      shSwitchTab('editor');
      shToast('Three.js code copied to editor');
      btn.innerHTML = '<i class="fas fa-check"></i> Copied';
      btn.disabled = true;
    }
  };

  window.shCopyCodeBlockFromChat = function (btn) {
    var pre = btn.previousElementSibling;
    if (!pre) return;
    var code = pre.textContent || pre.innerText || '';
    navigator.clipboard.writeText(code.trim()).then(function () {
      btn.innerHTML = '<i class="fas fa-check"></i> Copied';
      btn.disabled = true;
      shToast('Block copied');
    }).catch(function () {
      shToast('Copy failed');
    });
  };

  window.shApplyUniformsFromChat = function (btn) {
    var pre = btn.previousElementSibling;
    if (!pre) return;
    var raw = pre.textContent || pre.innerText || '{}';
    try {
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') throw new Error('Invalid uniforms JSON');

      var num = function (v, fallback) {
        var n = Number(v);
        return Number.isFinite(n) ? n : fallback;
      };

      var dayNight = parsed.uDayNight;
      if (dayNight === undefined) dayNight = parsed.dayNightCycle;
      if (dayNight === undefined) dayNight = parsed.dayNight;
      if (dayNight !== undefined) window.shSetDayNightCycle(num(dayNight, _sh.previewState.dayNightCycle));

      var timeSpeed = parsed.uTimeSpeed;
      if (timeSpeed === undefined) timeSpeed = parsed.timeSpeed;
      if (timeSpeed !== undefined) window.shSetWorldTimeSpeed(num(timeSpeed, _sh.previewState.timeSpeed));

      var weather = parsed.uWeather;
      if (weather === undefined) weather = parsed.weatherIntensity;
      if (weather === undefined) weather = parsed.weather;
      if (weather !== undefined) window.shSetWorldWeather(num(weather, _sh.previewState.weatherIntensity));

      var rotation = parsed.uRotation3D;
      if (rotation === undefined) rotation = parsed.rotation3D;
      if (rotation !== undefined) window.shSetWorldRotation(num(rotation, _sh.previewState.rotation3D));

      btn.innerHTML = '<i class="fas fa-check"></i> Applied';
      btn.disabled = true;
      shToast('Uniforms applied to world state');
    } catch (err) {
      shToast('Uniform parse error: ' + (err.message || err));
    }
  };

  window.shApplyPostFxFromChat = function (btn) {
    var pre = btn.previousElementSibling;
    if (!pre) return;
    var raw = pre.textContent || pre.innerText || '{}';
    try {
      var parsed = JSON.parse(raw);
      shApplyPostFxObject(parsed);
      btn.innerHTML = '<i class="fas fa-check"></i> Applied';
      btn.disabled = true;
      shToast('PostFX applied to preview pipeline');
    } catch (err) {
      shToast('PostFX parse error: ' + (err.message || err));
    }
  };

  window.shApplyAgentReportFromChat = function (btn) {
    var pre = btn.previousElementSibling;
    if (!pre) return;
    var raw = pre.textContent || pre.innerText || '{}';
    try {
      var parsed = JSON.parse(raw);
      var warnings = Array.isArray(parsed.warnings) ? parsed.warnings.map(function (w) { return String(w); }) : [];
      _sh.agentReport = {
        warnings: warnings,
        fallbackApplied: !!parsed.fallbackApplied,
        tslTarget: SH_TSL_TARGET_VERSION,
      };
      shUpdateRuntimeDiagnostics();
      shSaveState();
      btn.innerHTML = '<i class="fas fa-check"></i> Applied';
      btn.disabled = true;
      shToast('Agent report applied');
    } catch (err) {
      shToast('Report parse error: ' + (err.message || err));
    }
  };

  /* ═════════════════════════════════════════════════════════════
     CREATE NEW SCENE
     ═════════════════════════════════════════════════════════════ */
  /* ── Reusable modal prompt (replaces window.prompt for iframe-safe usage) ── */
  function shPromptModal(label, defaultValue, callback) {
    // Normalise args: shPromptModal(label, callback) and shPromptModal(label, defaultValue, callback)
    if (typeof defaultValue === 'function') { callback = defaultValue; defaultValue = ''; }
    if (!callback) return;

    // Tear down any previous prompt modal
    var prev = document.getElementById('shPromptModal');
    if (prev) prev.remove();

    defaultValue = defaultValue || '';

    var m = document.createElement('div');
    m.id = 'shPromptModal';
    m.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(10,12,20,0.65);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);';
    m.innerHTML =
      '<div style="width:min(420px,90vw);background:#141824;border:1px solid rgba(255,255,255,0.12);border-radius:10px;box-shadow:0 16px 48px rgba(0,0,0,.55);color:#eee;font-family:system-ui,sans-serif;padding:18px 20px 14px;">'
      + '<div style="font-size:14px;font-weight:600;margin-bottom:10px;">' + escapeHtml(label) + '</div>'
      + '<input id="shPromptInput" value="' + escapeHtml(defaultValue) + '" style="width:100%;box-sizing:border-box;background:#0c0f18;border:1px solid rgba(255,255,255,0.15);color:#eee;padding:9px 12px;border-radius:6px;font-size:13px;outline:none;" autofocus/>'
      + '<div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end;">'
      + '<button id="shPromptCancel" style="background:#2a2e3c;color:#ccc;border:1px solid rgba(255,255,255,0.08);padding:7px 16px;border-radius:6px;cursor:pointer;">Cancel</button>'
      + '<button id="shPromptOk" style="background:linear-gradient(135deg,#6B8CE3,#A873E8);color:#fff;border:none;padding:7px 20px;border-radius:6px;cursor:pointer;font-weight:600;">OK</button>'
      + '</div>'
      + '</div>';
    document.body.appendChild(m);

    var input = document.getElementById('shPromptInput');

    function dismiss(val) {
      m.remove();
      callback(val);
    }

    m.addEventListener('click', function (ev) { if (ev.target === m) dismiss(null); });
    document.getElementById('shPromptCancel').addEventListener('click', function () { dismiss(null); });
    document.getElementById('shPromptOk').addEventListener('click', function () { dismiss(input.value); });
    input.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') dismiss(input.value);
      if (ev.key === 'Escape') dismiss(null);
    });
    input.focus();
    input.select();
  }

  window.shCreateScene = function () {
    shPromptModal('Scene name:', function (name) {
      if (!name || !name.trim()) return;
      var id = 'custom_' + name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_+$/, '');
      var sc = {
        id: id, icon: '🎨', name: name.trim(),
        desc: 'Custom scene — ' + name.trim(),
        sky1: '#5B8EC4', sky2: '#87CEEB', ground: '#3D6B4F', bld: '#6B5D4F', acc: '#C4862D',
        category: 'custom'
      };
      _sh.customScenes.push(sc);
      shBuildSceneList();
      shUpdateStats();
      shSelectScene(id);
      shSaveState();
      shToast('Scene created: ' + name.trim());
    });
  };

  /* ═════════════════════════════════════════════════════════════
     ASSET CATALOG MODAL
     Browse reusable SVG artifacts (owl, deer, windmill, ...), multi-select,
     and spawn a new scene whose code composes them.
     ═════════════════════════════════════════════════════════════ */
  var _shCatalogState = { picked: {} }; // id -> true

  window.shOpenCatalog = function () {
    // Retry briefly if assets haven't finished loading yet
    var assets = window.shListAssets ? window.shListAssets() : [];
    if (!assets.length) {
      shToast('Loading asset catalog…');
      setTimeout(function () {
        if (window.shListAssets && window.shListAssets().length) window.shOpenCatalog();
        else shToast('No assets available — check content/scenes/assets/manifest.json');
      }, 600);
      return;
    }

    // Tear down any previous instance
    var prev = document.getElementById('shCatalogModal');
    if (prev) prev.remove();

    var m = document.createElement('div');
    m.id = 'shCatalogModal';
    m.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(10,12,20,0.72);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);';

    var cats = {};
    assets.forEach(function (a) {
      var k = a.category || 'other';
      (cats[k] = cats[k] || []).push(a);
    });
    var catOrder = ['character', 'prop', 'environment', 'sky', 'fx', 'other']
      .filter(function (k) { return cats[k]; });

    function assetCard(a) {
      var tags = (a.tags || []).slice(0, 3).map(function (t) {
        return '<span style="font-size:10px;background:rgba(255,255,255,0.08);padding:1px 6px;border-radius:8px;margin-right:3px;">' + t + '</span>';
      }).join('');
      return '<label class="sh-cat-item" data-id="' + a.id + '" style="display:flex;gap:10px;padding:10px;border:1px solid rgba(255,255,255,0.08);border-radius:8px;cursor:pointer;transition:background .15s;align-items:flex-start;">'
        + '<input type="checkbox" class="sh-cat-check" data-id="' + a.id + '" ' + (_shCatalogState.picked[a.id] ? 'checked' : '') + ' style="margin-top:3px;"/>'
        + '<div style="font-size:26px;line-height:1;">' + (a.icon || '🧩') + '</div>'
        + '<div style="flex:1;min-width:0;">'
        + '<div style="font-weight:600;font-size:13px;color:#fff;">' + a.name + '</div>'
        + '<div style="font-size:11px;color:#aaa;margin:2px 0 4px;">' + a.desc + '</div>'
        + '<div>' + tags + '</div>'
        + '</div>'
        + '</label>';
    }

    var body = '';
    catOrder.forEach(function (k) {
      body += '<div style="margin:14px 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#7aa;">' + k + ' · ' + cats[k].length + '</div>';
      body += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:8px;">';
      cats[k].forEach(function (a) { body += assetCard(a); });
      body += '</div>';
    });

    m.innerHTML =
      '<div style="width:min(900px,92vw);max-height:86vh;display:flex;flex-direction:column;background:#141824;border:1px solid rgba(255,255,255,0.12);border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,.6);color:#eee;font-family:system-ui,sans-serif;">'
      + '<div style="display:flex;align-items:center;gap:12px;padding:14px 18px;border-bottom:1px solid rgba(255,255,255,0.08);">'
      + '<div style="font-size:16px;font-weight:600;">🎨 Scene Asset Catalog</div>'
      + '<input id="shCatSearch" placeholder="Filter by name, tag, category…" style="flex:1;background:#0c0f18;border:1px solid rgba(255,255,255,0.1);color:#eee;padding:7px 10px;border-radius:6px;font-size:12px;"/>'
      + '<span id="shCatCount" style="font-size:11px;color:#8aa;">0 picked</span>'
      + '<button onclick="shCloseCatalog()" style="background:transparent;color:#aaa;border:none;font-size:18px;cursor:pointer;">&times;</button>'
      + '</div>'
      + '<div id="shCatBody" style="flex:1;overflow:auto;padding:10px 18px 14px;">' + body + '</div>'
      + '<div style="display:flex;gap:8px;padding:12px 18px;border-top:1px solid rgba(255,255,255,0.08);justify-content:space-between;align-items:center;">'
      + '<div style="font-size:11px;color:#7aa;">Tip: scene code can call <code style="background:#0c0f18;padding:1px 4px;border-radius:3px;">SH_ASSETS.&lt;id&gt;.render(svg, ctx)</code></div>'
      + '<div style="display:flex;gap:8px;">'
      + '<button onclick="shCatalogClear()" style="background:#2a2e3c;color:#ccc;border:1px solid rgba(255,255,255,0.08);padding:8px 14px;border-radius:6px;cursor:pointer;">Clear</button>'
      + '<button onclick="shCreateSceneFromCatalog()" style="background:linear-gradient(135deg,#6B8CE3,#A873E8);color:#fff;border:none;padding:8px 18px;border-radius:6px;cursor:pointer;font-weight:600;">Create Scene →</button>'
      + '</div>'
      + '</div>'
      + '</div>';
    document.body.appendChild(m);

    // Wire events
    m.addEventListener('click', function (ev) { if (ev.target === m) shCloseCatalog(); });
    m.querySelectorAll('.sh-cat-check').forEach(function (c) {
      c.addEventListener('change', function () {
        var id = c.getAttribute('data-id');
        if (c.checked) _shCatalogState.picked[id] = true;
        else delete _shCatalogState.picked[id];
        shCatalogUpdateCount();
      });
    });
    var search = document.getElementById('shCatSearch');
    if (search) {
      search.addEventListener('input', function () {
        var q = search.value.toLowerCase().trim();
        m.querySelectorAll('.sh-cat-item').forEach(function (el) {
          var id = el.getAttribute('data-id');
          var a = assets.find(function (x) { return x.id === id; }) || {};
          var hay = [a.id, a.name, a.desc, (a.tags || []).join(' '), a.category].join(' ').toLowerCase();
          el.style.display = (!q || hay.indexOf(q) >= 0) ? '' : 'none';
        });
      });
    }
    shCatalogUpdateCount();
  };

  window.shCloseCatalog = function () {
    var m = document.getElementById('shCatalogModal');
    if (m) m.remove();
  };

  window.shCatalogClear = function () {
    _shCatalogState.picked = {};
    var m = document.getElementById('shCatalogModal');
    if (!m) return;
    m.querySelectorAll('.sh-cat-check').forEach(function (c) { c.checked = false; });
    shCatalogUpdateCount();
  };

  function shCatalogUpdateCount() {
    var n = Object.keys(_shCatalogState.picked).length;
    var el = document.getElementById('shCatCount');
    if (el) el.textContent = n + ' picked';
  }

  /* Given an ordered list of picked asset ids, build a scene `code` body that
     invokes each asset at an auto-generated position. Characters go near the
     ground at spaced-out x positions; sky assets go in the upper region; fx
     (fireflies, snowflakes) span the whole canvas; environment layers go first. */
  function shComposeCodeFromAssets(pickedIds) {
    var layers = { environment: [], sky: [], prop: [], character: [], fx: [] };
    pickedIds.forEach(function (id) {
      var a = window.SH_ASSETS[id];
      if (!a) return;
      var cat = a.meta.category || 'prop';
      (layers[cat] || layers.prop).push(id);
    });

    var lines = [
      '// ── Auto-generated from Asset Catalog ──',
      '// Edit freely; each SH_ASSETS call appends to svg.',
      '',
    ];

    // Environment first (sand, grass, canal water, etc.)
    layers.environment.forEach(function (id) {
      lines.push('svg = SH_ASSETS[\'' + id + '\'].render(svg, { y: bY, w: w, h: h, mt, w1, w2, w3, isN, ol });');
    });
    // Sky
    layers.sky.forEach(function (id) {
      lines.push('svg = SH_ASSETS[\'' + id + '\'].render(svg, { w, h, mt, w1, w2, w3, isN, ol });');
    });
    // Props (trees, windmill, castle) — space across width
    var nProps = layers.prop.length;
    layers.prop.forEach(function (id, i) {
      var fx = nProps > 1 ? (0.15 + (0.7 * i / (nProps - 1))) : 0.45;
      lines.push('svg = SH_ASSETS[\'' + id + '\'].render(svg, { x: w*' + fx.toFixed(2) + ', y: bY-3, baseY: bY-80, w, h, mt, w1, w2, w3, isN, ol });');
    });
    // Characters — space along a path
    var nCh = layers.character.length;
    layers.character.forEach(function (id, i) {
      var fx = nCh > 1 ? (0.2 + (0.6 * i / Math.max(1, nCh - 1))) : 0.5;
      var meta = window.SH_ASSETS[id].meta;
      // Flying things go high
      var yExpr = (meta.tags || []).indexOf('flying') >= 0 ? 'h*0.25' : 'bY-10';
      lines.push('svg = SH_ASSETS[\'' + id + '\'].render(svg, { x: w*' + fx.toFixed(2) + ', y: ' + yExpr + ', mt, w1, w2, w3, isN, ol });');
    });
    // FX on top
    layers.fx.forEach(function (id) {
      lines.push('svg = SH_ASSETS[\'' + id + '\'].render(svg, { x: 0, y: bY-60, w, h, mt, w1, w2, w3, isN, ol });');
    });

    lines.push('');
    lines.push('// Moon at night, sun by day (auto)');
    lines.push('if (isN && SH_ASSETS.moon) svg = SH_ASSETS.moon.render(svg, { x: w*0.78, y: h*0.12, mt, w1, w2, w3, isN, ol });');
    return lines.join('\n');
  }

  window.shCreateSceneFromCatalog = function () {
    var ids = Object.keys(_shCatalogState.picked);
    if (!ids.length) { shToast('Pick at least one asset first'); return; }
    shPromptModal('Scene name:', 'Catalog Scene', function (name) {
      if (!name || !name.trim()) return;

      var id = 'custom_' + name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_+$/, '');
      var code = shComposeCodeFromAssets(ids);
      var picked = ids.map(function (i) { return window.SH_ASSETS[i].meta; });
      var hasSnow = ids.indexOf('snowflakes') >= 0 || ids.indexOf('pine_tree_snowy') >= 0 || ids.indexOf('snowman') >= 0 || ids.indexOf('castle_ice') >= 0;
      var sc = {
        id: id,
        icon: (picked[0] && picked[0].icon) || '🎨',
        name: name.trim(),
        desc: 'Composed from catalog: ' + picked.map(function (p) { return p.name; }).join(', '),
        sky1: hasSnow ? '#2D3A5A' : '#5B8EC4',
        sky2: hasSnow ? '#8AB0D8' : '#87CEEB',
        ground: hasSnow ? '#E8F0FE' : '#3D6B4F',
        bld: '#6B5D4F',
        acc: '#C4862D',
        category: 'custom',
        code: code,
        _assets: ids
      };
      _sh.customScenes.push(sc);
      shBuildSceneList();
      shUpdateStats();
      shSelectScene(id);
      shSaveState();
      shCloseCatalog();
      shToast('Scene created with ' + ids.length + ' assets');
    });
  };

  window.shDeleteScene = function () {
    if (!_sh.activeScene) return;
    // Can only delete custom scenes
    var idx = _sh.customScenes.findIndex(function (s) { return s.id === _sh.activeScene; });
    if (idx === -1) { shToast('Cannot delete built-in scenes'); return; }
    if (!confirm('Delete this custom scene?')) return;
    _sh.customScenes.splice(idx, 1);
    _sh.activeScene = SH_SCENES[0].id;
    shBuildSceneList();
    shUpdateStats();
    shSelectScene(_sh.activeScene);
    shSaveState();
    shToast('Scene deleted');
  };

  /* ═════════════════════════════════════════════════════════════
    IMPORT SCENE DATA (from JSON files)
    ═════════════════════════════════════════════════════════════ */
  window.shImportCase = function () {
    // Open file picker for JSON scene/context data
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = function (e) {
      var f = e.target.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function (ev) {
        try {
          var data = JSON.parse(ev.target.result);
          shProcessCaseData(data);
        } catch (err) {
          shToast('Invalid JSON file');
        }
      };
      reader.readAsText(f);
    };
    input.click();
  };

  function shProcessCaseData(data) {
    // Try to extract scene-relevant info from imported JSON
    var title = data.title || data.case_title || data.id || 'Imported Scene';
    var framework = '';
    var jurisdiction = '';

    // Look for nodes array (ontology format)
    if (data.nodes && Array.isArray(data.nodes)) {
      var caseNode = data.nodes.find(function (n) { return n.type === 'Case'; });
      if (caseNode) {
        title = caseNode.title || caseNode.properties && caseNode.properties.title || title;
        jurisdiction = caseNode.jurisdiction || caseNode.properties && caseNode.properties.jurisdiction || '';
      }
      var fwNode = data.nodes.find(function (n) { return n.type === 'LegalFramework'; });
      if (fwNode) framework = fwNode.name || fwNode.properties && fwNode.properties.name || '';
    }

    // Auto-generate palette from jurisdiction
    var sky1 = '#2A5F8A', sky2 = '#0E2A42', ground = '#5A8C5A', bld = '#B8860B', acc = '#FF6B6B';
    if (jurisdiction === 'BR') {
      sky1 = '#2A5F8A'; sky2 = '#0E2A42'; ground = '#5A8C5A'; bld = '#B8860B'; acc = '#FF6B6B';
    }

    var id = 'imported_' + title.toLowerCase().replace(/[^a-z0-9]+/g, '_').substring(0, 30);
    var sc = {
      id: id, icon: '🗼', name: title.substring(0, 30),
      desc: 'Imported source: ' + (framework || 'custom context') + ' — ' + title,
      sky1: sky1, sky2: sky2, ground: ground, bld: bld, acc: acc,
      category: 'custom', caseData: data
    };
    _sh.customScenes.push(sc);
    shBuildSceneList();
    shUpdateStats();
    shSelectScene(id);
    shSaveState();
    shToast('Source imported: ' + title.substring(0, 25));
  }

  /* ═════════════════════════════════════════════════════════════
     IMPORT SCENE FILE (.scene.json)
     Accepts a JSON file with the full scene object:
     { id, icon, name, desc, sky1, sky2, ground, bld, acc, code }
     Supports single-scene objects OR arrays of scenes.
     Also accepts the legacy olivia-custom-scenes.json array format.
     ═════════════════════════════════════════════════════════════ */
  window.shImportSceneFile = function () {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.scene.json';
    input.onchange = function (e) {
      var f = e.target.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function (ev) {
        try {
          var parsed = JSON.parse(ev.target.result);
          // Accept either a single scene object or an array
          var scenes = Array.isArray(parsed) ? parsed : [parsed];
          var imported = 0;
          var firstName = '';
          var firstId = '';
          scenes.forEach(function (scData) {
            if (!scData.id || !scData.name) return;
            // Sanitise: only allowed fields
            var sc = {
              id: String(scData.id).replace(/[^a-z0-9_\-]/gi, '_').substring(0, 60),
              icon: scData.icon || '🎨',
              name: String(scData.name).substring(0, 60),
              desc: String(scData.desc || '').substring(0, 200),
              sky1: /^#[0-9A-Fa-f]{3,8}$/.test(scData.sky1) ? scData.sky1 : '#5B8EC4',
              sky2: /^#[0-9A-Fa-f]{3,8}$/.test(scData.sky2) ? scData.sky2 : '#87CEEB',
              ground: /^#[0-9A-Fa-f]{3,8}$/.test(scData.ground) ? scData.ground : '#3D6B4F',
              bld: /^#[0-9A-Fa-f]{3,8}$/.test(scData.bld) ? scData.bld : '#6B5D4F',
              acc: /^#[0-9A-Fa-f]{3,8}$/.test(scData.acc) ? scData.acc : '#C4862D',
              category: 'custom'
            };
            if (scData.code && typeof scData.code === 'string') sc.code = scData.code;
            var existing = _sh.customScenes.findIndex(function (s) { return s.id === sc.id; });
            if (existing !== -1) _sh.customScenes[existing] = sc;
            else _sh.customScenes.push(sc);
            if (!firstId) { firstId = sc.id; firstName = sc.name; }
            imported++;
          });
          if (imported === 0) { shToast('No valid scenes found in file'); return; }
          shBuildSceneList();
          shUpdateStats();
          shSelectScene(firstId);
          shSaveState();
          shToast('Imported ' + imported + ' scene' + (imported > 1 ? 's' : '') + ': ' + firstName);
        } catch (err) {
          shToast('Import error: ' + (err.message || 'Invalid JSON'));
        }
      };
      reader.readAsText(f);
    };
    input.click();
  };

  /* ═════════════════════════════════════════════════════════════
     SETTINGS
     ═════════════════════════════════════════════════════════════ */
  window.shExportAllScenes = function () {
    if (_sh.customScenes.length === 0) { shToast('No custom scenes to export'); return; }
    var json = JSON.stringify(_sh.customScenes, null, 2);
    var blob = new Blob([json], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'olivia-custom-scenes.json'; a.click();
    URL.revokeObjectURL(url);
    shToast('Exported ' + _sh.customScenes.length + ' custom scenes');
  };

  window.shApplyPreset = function (presetId) {
    var preset = SH_STYLE_PRESETS.find(function (p) { return p.id === presetId; });
    if (!preset) return;
    Object.keys(preset.values).forEach(function (k) {
      _sh.previewState[k] = preset.values[k];
    });
    document.querySelectorAll('.sh-preset-btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.preset === presetId);
    });
    var sl = document.getElementById('shSliderOutline');
    if (sl) sl.value = _sh.previewState.outline || 2.5;
    shSaveState();
    shToast('Preset: ' + preset.name);
  };

  function shWeatherIntensityFromLabel(label) {
    var key = String(label || '').toLowerCase();
    if (key === 'storm') return 1;
    if (key === 'rain') return 0.7;
    if (key === 'snow') return 0.58;
    if (key === 'fog' || key === 'cloudy') return 0.35;
    return 0;
  }

  function shWeatherLabelFromIntensity(intensity) {
    var w = Number(intensity) || 0;
    if (w >= 0.9) return 'storm';
    if (w >= 0.6) return 'rain';
    if (w >= 0.45) return 'snow';
    if (w >= 0.2) return 'cloudy';
    return 'clear';
  }

  function shBuildBridgePayload() {
    var all = SH_SCENES.concat(_sh.customScenes);
    var active = all.find(function (s) { return s.id === _sh.activeScene; }) || null;
    var editor = document.getElementById('shCodeEditor');
    var code = editor ? String(editor.value || '').trim() : '';
    return {
      version: SH_BRIDGE_VERSION,
      source: SH_BRIDGE_SOURCE,
      ts: Date.now(),
      state: {
        sceneId: _sh.activeScene,
        customScenes: _sh.customScenes,
        preview: {
          tod: Number(_sh.previewState.tod || 12),
          era: Number(_sh.previewState.era || 1750),
          timeSpeed: Number(_sh.previewState.timeSpeed || 1),
          dayNightCycle: Number(_sh.previewState.dayNightCycle || 0.5),
          weatherIntensity: Number(_sh.previewState.weatherIntensity || 0),
          weather: _sh.previewState.weather || shWeatherLabelFromIntensity(_sh.previewState.weatherIntensity),
          rotation3D: Number(_sh.previewState.rotation3D || 0),
          outline: Number(_sh.previewState.outline || 2.5),
          bgmorph: Number(_sh.previewState.bgmorph || 0.3),
        },
        postFx: _sh.postFx,
        shaderTask: _sh.shaderTask,
        renderingStrategy: _sh.renderingStrategy,
        agentReport: _sh.agentReport,
        generated: {
          sceneMeta: active,
          sceneCode: code || (active && active.code ? active.code : ''),
        },
      },
    };
  }

  function shPublishBridgeState(force) {
    try {
      var now = Date.now();
      if (!force && now - _shBridgeLastPublish < 140) return;
      var payload = shBuildBridgePayload();
      localStorage.setItem(SH_BRIDGE_KEY, JSON.stringify(payload));
      _shBridgeLastPublish = now;
    } catch (_err) {
      // ignore sync failures
    }
  }

  function shUpsertExternalCustomScenes(externalScenes) {
    if (!Array.isArray(externalScenes)) return;
    externalScenes.forEach(function (scene) {
      if (!scene || !scene.id || !scene.name) return;
      var id = String(scene.id).trim();
      var existsBuiltIn = SH_SCENES.some(function (s) { return s.id === id; });
      if (existsBuiltIn) return;
      var incoming = {
        id: id,
        icon: scene.icon || '🎨',
        name: scene.name,
        desc: scene.desc || scene.description || '',
        sky1: scene.sky1 || '#5B8EC4',
        sky2: scene.sky2 || '#87CEEB',
        ground: scene.ground || '#3D6B4F',
        bld: scene.bld || '#6B5D4F',
        acc: scene.acc || '#C4862D',
        category: 'custom',
      };
      if (scene.code && typeof scene.code === 'string') incoming.code = scene.code;
      var idx = _sh.customScenes.findIndex(function (s) { return s.id === id; });
      if (idx >= 0) _sh.customScenes[idx] = Object.assign({}, _sh.customScenes[idx], incoming);
      else _sh.customScenes.push(incoming);
    });
  }

  function shApplyBridgePayload(payload) {
    if (!payload || payload.source === SH_BRIDGE_SOURCE) return;
    var state = payload.state || {};
    _shBridgeApplying = true;
    try {
      shUpsertExternalCustomScenes(state.customScenes);

      if (state.shaderTask && typeof state.shaderTask === 'object') {
        _sh.shaderTask = Object.assign({}, _sh.shaderTask, state.shaderTask);
        var taskMap = {
          shTaskSvgAsset: _sh.shaderTask.svgAsset || '',
          shTaskMood: _sh.shaderTask.desiredMood || 'organic',
          shTaskInteraction: _sh.shaderTask.interactionType || 'hover',
          shTaskPerformance: _sh.shaderTask.performanceTarget || 'desktop',
        };
        Object.keys(taskMap).forEach(function (id) {
          var el = document.getElementById(id);
          if (el) el.value = taskMap[id];
        });
      }

      var preview = state.preview && typeof state.preview === 'object' ? state.preview : {};
      var workbench = state.workbench && typeof state.workbench === 'object' ? state.workbench : {};

      if (preview.tod !== undefined) _sh.previewState.tod = shClamp(preview.tod, 0, 24);
      else if (workbench.tod !== undefined) _sh.previewState.tod = shClamp(workbench.tod, 0, 24);

      if (preview.era !== undefined) _sh.previewState.era = Math.round(shClamp(preview.era, 1200, 2200));
      else if (workbench.era !== undefined) _sh.previewState.era = Math.round(shClamp(workbench.era, 1200, 2200));

      if (preview.timeSpeed !== undefined) _sh.previewState.timeSpeed = shClamp(preview.timeSpeed, 0.2, 4);
      else if (workbench.speed !== undefined) _sh.previewState.timeSpeed = shClamp(workbench.speed, 0.2, 4);

      if (preview.dayNightCycle !== undefined) _sh.previewState.dayNightCycle = shClamp(preview.dayNightCycle, 0, 1);
      else _sh.previewState.dayNightCycle = shClamp((23 - _sh.previewState.tod) / 11, 0, 1);

      if (preview.weatherIntensity !== undefined) _sh.previewState.weatherIntensity = shClamp(preview.weatherIntensity, 0, 1);
      else if (preview.weather !== undefined) _sh.previewState.weatherIntensity = shWeatherIntensityFromLabel(preview.weather);
      else if (workbench.weather !== undefined) _sh.previewState.weatherIntensity = shWeatherIntensityFromLabel(workbench.weather);

      _sh.previewState.weather = shWeatherLabelFromIntensity(_sh.previewState.weatherIntensity);

      if (preview.rotation3D !== undefined) _sh.previewState.rotation3D = shClamp(preview.rotation3D, -30, 30);
      if (preview.outline !== undefined) _sh.previewState.outline = shClamp(preview.outline, 0, 6);
      else if (workbench.outline !== undefined) _sh.previewState.outline = shClamp(workbench.outline, 0, 6);
      if (preview.bgmorph !== undefined) _sh.previewState.bgmorph = shClamp(preview.bgmorph, 0, 1);
      else if (workbench.bgmorph !== undefined) _sh.previewState.bgmorph = shClamp(workbench.bgmorph, 0, 1);

      if (state.postFx && typeof state.postFx === 'object') {
        _sh.postFx = shNormalizePostFx(state.postFx);
      } else {
        _sh.postFx = shNormalizePostFx({
          bloom: workbench.bloom,
          vignette: workbench.vignette,
          grain: workbench.grain,
          blur: workbench.blur,
          chromaticAberration: workbench.chromaticAberration || (Number(workbench.flare || 0) * 0.01),
          saturation: workbench.sat,
          contrast: workbench.contrast,
        });
      }

      if (state.renderingStrategy && typeof state.renderingStrategy === 'object') {
        _sh.renderingStrategy = Object.assign({}, _sh.renderingStrategy, state.renderingStrategy);
      }
      if (state.agentReport && typeof state.agentReport === 'object') {
        _sh.agentReport = Object.assign({}, _sh.agentReport, state.agentReport);
      }

      if (state.generated && state.generated.sceneCode) {
        var activeScene = SH_SCENES.concat(_sh.customScenes).find(function (s) { return s.id === _sh.activeScene; });
        if (activeScene && activeScene.category === 'custom') {
          activeScene.code = String(state.generated.sceneCode);
        }
      }

      shBuildSceneList();
      shUpdateStats();

      if (state.sceneId) {
        var exists = SH_SCENES.concat(_sh.customScenes).some(function (s) { return s.id === state.sceneId; });
        if (exists) shSelectScene(state.sceneId);
      } else {
        var sc = SH_SCENES.concat(_sh.customScenes).find(function (s) { return s.id === _sh.activeScene; });
        if (sc) shRenderPreview(sc);
      }

      shSyncWorldUI();
      shRefreshTaskPreview();
      shApplyPostFxRuntime();
      shSaveState(true);
    } finally {
      _shBridgeApplying = false;
    }
  }

  function shInitBridgeSync() {
    window.addEventListener('storage', function (event) {
      if (event.key !== SH_BRIDGE_KEY || !event.newValue) return;
      try {
        var payload = JSON.parse(event.newValue);
        shApplyBridgePayload(payload);
      } catch (_err) {
        // ignore malformed payloads
      }
    });

    try {
      var raw = localStorage.getItem(SH_BRIDGE_KEY);
      if (raw) {
        var payload = JSON.parse(raw);
        if (payload && payload.source !== SH_BRIDGE_SOURCE) {
          shApplyBridgePayload(payload);
        }
      }
    } catch (_err) {
      // ignore
    }
  }

  window.shOpenWorkbench = function () {
    shPublishBridgeState(true);
    window.open('/shaders/?bridge=kout-shaders', '_blank');
  };

  /* ═════════════════════════════════════════════════════════════
     TOAST
     ═════════════════════════════════════════════════════════════ */
  function shToast(msg) {
    var t = document.getElementById('shToast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(function () { t.classList.remove('show'); }, 2500);
  }

  /* ═════════════════════════════════════════════════════════════
     INIT (called once on DOMContentLoaded)
     ═════════════════════════════════════════════════════════════ */
  function shInit() {
    shLoadState();
    shInitSplitter();
    shInitBridgeSync();
    shPopulateTaskAssetExamples();
    var taskMap = {
      shTaskSvgAsset: _sh.shaderTask.svgAsset || '',
      shTaskMood: _sh.shaderTask.desiredMood || 'organic',
      shTaskInteraction: _sh.shaderTask.interactionType || 'hover',
      shTaskPerformance: _sh.shaderTask.performanceTarget || 'desktop',
    };
    Object.keys(taskMap).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.value = taskMap[id];
    });
    shSetTaskAssetHint();
    shRefreshTaskPreview();
    shSyncWorldUI();
    shApplyPostFxRuntime();
    if (typeof window.shSyncEnvFxUI === 'function') window.shSyncEnvFxUI();
  }

  // ─────────────────────────────────────────────────────────────
  // Guided Scene Flow (cards replacing the old task-interface)
  // ─────────────────────────────────────────────────────────────
  var _shGuide = { dimension: null, content: null, bg: null, layers: 3 };

  function shGuideShowStep(n) {
    document.querySelectorAll('#shGuide .sh-guide-step').forEach(function (el) {
      var step = parseInt(el.getAttribute('data-step'), 10);
      if (step <= n) el.hidden = false; else el.hidden = true;
    });
  }

  window.shGuidePick = function (key, value) {
    _shGuide[key] = value;
    // mark selected card
    var scope = document.querySelector('#shGuide .sh-guide-step[data-step]');
    document.querySelectorAll('#shGuide .sh-guide-step').forEach(function (step) {
      step.querySelectorAll('.sh-guide-card').forEach(function (card) {
        // leave selected style alone except within same step
      });
    });
    // highlight within the step that owns this key
    if (key === 'dimension') {
      document.querySelectorAll('#shGuide [data-step="1"] .sh-guide-card').forEach(function (c) {
        c.classList.toggle('selected', c.getAttribute('data-dim') === value);
      });
      // drive existing sceneMode toggle
      if (typeof window.shSetSceneMode === 'function') window.shSetSceneMode(value);
      // reveal step 2; reveal step 3 only if 3D; step 4 always after content
      shGuideShowStep(2);
    } else if (key === 'content') {
      document.querySelectorAll('#shGuide [data-step="2"] .sh-guide-card').forEach(function (c) {
        c.classList.toggle('selected', c === event.currentTarget);
      });
      // propagate mood to legacy input
      var mood = (event.currentTarget && event.currentTarget.getAttribute('data-mood')) || 'organic';
      var moodEl = document.getElementById('shTaskMood');
      if (moodEl) moodEl.value = mood;
      if (_shGuide.dimension === '3d') shGuideShowStep(4); // step 3 also shown because <=4
      else {
        // 2D — skip step 3
        var step3 = document.querySelector('#shGuide [data-step="3"]');
        if (step3) step3.hidden = true;
        document.querySelector('#shGuide [data-step="4"]').hidden = false;
      }
    } else if (key === 'bg') {
      document.querySelectorAll('#shGuide [data-step="3"] .sh-guide-card').forEach(function (c) {
        c.classList.toggle('selected', c === event.currentTarget);
      });
    }
  };

  window.shGuideReset = function () {
    _shGuide = { dimension: null, content: null, bg: null, layers: 3 };
    document.querySelectorAll('#shGuide .sh-guide-card').forEach(function (c) { c.classList.remove('selected'); });
    var prompt = document.getElementById('shGuidePrompt'); if (prompt) prompt.value = '';
    shGuideShowStep(1);
  };

  window.shGuideRun = function () {
    var layersEl = document.getElementById('shGuideLayers');
    if (layersEl) _shGuide.layers = parseInt(layersEl.value, 10) || 3;
    var desc = (document.getElementById('shGuidePrompt') || {}).value || '';
    var parts = [];
    parts.push('Gerar cena ' + (_shGuide.dimension === '3d' ? '3D (WebGL/Three.js)' : '2D (SVG animado)'));
    if (_shGuide.content) parts.push('foco: ' + _shGuide.content);
    if (_shGuide.dimension === '3d' && _shGuide.bg) parts.push('fundo: ' + _shGuide.bg);
    if (_shGuide.dimension === '3d') parts.push('camadas: ' + _shGuide.layers);
    var moodEl = document.getElementById('shTaskMood');
    if (moodEl && moodEl.value) parts.push('mood: ' + moodEl.value);
    if (desc.trim()) parts.push('descrição: ' + desc.trim());
    var prompt = parts.join(' · ');
    var input = document.getElementById('shBrainInput');
    if (input) { input.value = prompt; }
    if (typeof window.shBrainSend === 'function') window.shBrainSend();
  };
  // ─────────────────────────────────────────────────────────────

  // ─────────────────────────────────────────────────────────────
  // Sidebar resize + Scene Controls panel toggle
  // ─────────────────────────────────────────────────────────────
  function shInitSidebarResize() {
    var sidebar = document.getElementById('shSidebar');
    var handle = document.getElementById('shSidebarResize');
    if (!sidebar || !handle) return;
    // Restore persisted width
    try {
      var saved = JSON.parse(localStorage.getItem('olivia.shaders.state') || '{}');
      if (saved.sidebarWidth) {
        document.documentElement.style.setProperty('--sh-sidebar-w', saved.sidebarWidth + 'px');
      }
    } catch (e) { }
    var dragging = false, startX = 0, startW = 0;
    handle.addEventListener('mousedown', function (e) {
      dragging = true; startX = e.clientX;
      startW = sidebar.getBoundingClientRect().width;
      handle.classList.add('dragging');
      sidebar.classList.add('is-resizing');
      document.body.style.cursor = 'col-resize';
      e.preventDefault();
    });
    document.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      var w = Math.max(180, Math.min(640, startW + (e.clientX - startX)));
      document.documentElement.style.setProperty('--sh-sidebar-w', w + 'px');
    });
    document.addEventListener('mouseup', function () {
      if (!dragging) return;
      dragging = false;
      handle.classList.remove('dragging');
      sidebar.classList.remove('is-resizing');
      document.body.style.cursor = '';
      var w = sidebar.getBoundingClientRect().width;
      try {
        var s = JSON.parse(localStorage.getItem('olivia.shaders.state') || '{}');
        s.sidebarWidth = Math.round(w);
        localStorage.setItem('olivia.shaders.state', JSON.stringify(s));
      } catch (e) { }
      // Nudge 3D renderer to resize
      if (typeof window.dispatchEvent === 'function') window.dispatchEvent(new Event('resize'));
    });
  }
  window.shInitSidebarResize = shInitSidebarResize;
  // Expose helpers needed by code OUTSIDE the IIFE (e.g. shSaveCurrentScene)
  window.SH_SCENES = SH_SCENES;
  window.shBuildSceneList = shBuildSceneList;
  window.shUpdateStats = shUpdateStats;
  window.shToast = shToast;
  window.shGetActiveScene = function () {
    var all = SH_SCENES.concat(_sh.customScenes);
    return all.find(function (s) { return s.id === _sh.activeScene; }) || null;
  };
  // ─────────────────────────────────────────────────────────────

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { shInit(); shInitSidebarResize(); });
  } else {
    shInit(); shInitSidebarResize();
  }

  // Expose state to code defined outside this IIFE (e.g. fullscreen configurator)
  window._sh = _sh;

})();

/* ── Scene Controls panel toggle (declared OUTSIDE IIFE so inline
   onclick handlers can always find it even if the IIFE errored) ── */
window.shToggleSceneControls = function (force) {
  var panel = document.getElementById('shSceneCtrl');
  var btn = document.querySelector('.sh-gallery-actions button[data-action="controls"]');
  if (!panel) return;
  var show = (typeof force === 'boolean') ? force : panel.hasAttribute('hidden');
  if (show) { panel.removeAttribute('hidden'); if (btn) btn.classList.add('active'); }
  else { panel.setAttribute('hidden', ''); if (btn) btn.classList.remove('active'); }
  // Nudge renderer to recompute size
  if (typeof window.dispatchEvent === 'function') window.dispatchEvent(new Event('resize'));
};

/* ── Scene Controls sidebar width resize ────────────────────── */
window.shInitCtrlResize = function () {
  var panel = document.getElementById('shSceneCtrl');
  var handle = document.getElementById('shSceneCtrlResize');
  if (!panel || !handle || handle._wired) return;
  handle._wired = true;
  try {
    var saved = JSON.parse(localStorage.getItem('olivia.shaders.state') || '{}');
    if (saved.ctrlWidth) {
      document.documentElement.style.setProperty('--sh-ctrl-w', saved.ctrlWidth + 'px');
    }
  } catch (e) { }
  var dragging = false, startX = 0, startW = 0;
  handle.addEventListener('mousedown', function (e) {
    dragging = true; startX = e.clientX;
    startW = panel.getBoundingClientRect().width;
    handle.classList.add('dragging');
    panel.classList.add('is-resizing');
    document.body.style.cursor = 'col-resize';
    e.preventDefault();
  });
  document.addEventListener('mousemove', function (e) {
    if (!dragging) return;
    var w = Math.max(240, Math.min(560, startW - (e.clientX - startX)));
    document.documentElement.style.setProperty('--sh-ctrl-w', w + 'px');
  });
  document.addEventListener('mouseup', function () {
    if (!dragging) return;
    dragging = false;
    handle.classList.remove('dragging');
    panel.classList.remove('is-resizing');
    document.body.style.cursor = '';
    var w = panel.getBoundingClientRect().width;
    try {
      var s = JSON.parse(localStorage.getItem('olivia.shaders.state') || '{}');
      s.ctrlWidth = Math.round(w);
      localStorage.setItem('olivia.shaders.state', JSON.stringify(s));
    } catch (e) { }
    if (typeof window.dispatchEvent === 'function') window.dispatchEvent(new Event('resize'));
  });
};

/* ── Save current scene as a new custom scene ────────────────
   Captures: base 2D scene (palette + code), active 3D state
   (main GLB + added extras + environment + bg + hybrid flag).
   New scene is immediately selectable from the Cenas gallery.  */
window.shSaveCurrentScene = function () {
  try {
    var nameInput = document.getElementById('shSaveSceneName');
    var typedName = nameInput && nameInput.value ? nameInput.value.trim() : '';
    var state = (typeof window.sh3dGetState === 'function') ? window.sh3dGetState() : null;
    // Detect non-persistable extras (blob: URLs from failed uploads)
    var ephemeral = state && state.extras ? state.extras.filter(function (ex) {
      return ex.kind === 'glb' && (!ex.url || ex.url.indexOf('blob:') === 0);
    }) : [];
    if (ephemeral.length) {
      var ok = window.confirm(ephemeral.length + ' modelo(s) GLB têm URL temporária (blob:) e NÃO serão reabertos ao recarregar a página. Salvar mesmo assim?');
      if (!ok) return;
    }
    // Find the scene currently driving the 2D background (if any)
    var active = null;
    try {
      var st = JSON.parse(localStorage.getItem('olivia.shaders.state') || '{}');
      var allScenes = (window.SH_SCENES || []).concat(st.customScenes || []);
      active = allScenes.find(function (s) { return s.id === st.activeScene; });
    } catch (e) { }
    // Fallback: attempt direct window.shGetActiveScene if exposed
    if (!active && typeof window.shGetActiveScene === 'function') {
      try { active = window.shGetActiveScene(); } catch (e) { }
    }
    var baseName = typedName || ((active && active.name) ? (active.name + ' + 3D') : '3D Scene');
    var slug = baseName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').substring(0, 40) || 'scene';
    var id = 'custom_' + slug + '_' + Date.now().toString(36);

    var newScene = {
      id: id,
      icon: (state && state.active) ? '🎬' : (active && active.icon ? active.icon : '✨'),
      name: baseName.substring(0, 40),
      desc: 'Cena salva em ' + new Date().toLocaleString(),
      category: 'custom',
      // 2D base palette (keep so the SVG scene still renders behind hybrid)
      sky1: active && active.sky1 ? active.sky1 : '#2A5F8A',
      sky2: active && active.sky2 ? active.sky2 : '#0E2A42',
      ground: active && active.ground ? active.ground : '#5A8C5A',
      bld: active && active.bld ? active.bld : '#B8860B',
      acc: active && active.acc ? active.acc : '#FF6B6B',
      code: active && active.code ? active.code : undefined,
      // 3D snapshot
      scene3d: state || null,
    };
    // If the 3D canvas is active we treat the saved scene as hybrid/3D
    if (state && state.active) {
      newScene.type = state.hybrid ? 'hybrid' : '3d';
    }

    if (typeof window.shRegister3DScene === 'function' && (newScene.type === '3d' || newScene.type === 'hybrid')) {
      // shRegister3DScene will push+save+refresh list
      window.shRegister3DScene(newScene);
    } else {
      // Load current state, push, save back
      var s = {};
      try { s = JSON.parse(localStorage.getItem('olivia.shaders.state') || '{}'); } catch (e) { }
      s.customScenes = s.customScenes || [];
      s.customScenes.push(newScene);
      s.activeScene = id;
      localStorage.setItem('olivia.shaders.state', JSON.stringify(s));
      if (typeof window.location.reload === 'function') {
        // Let the module re-read state on next build; simpler: trigger rebuild hook if available
        if (typeof window.shBuildSceneList === 'function') window.shBuildSceneList();
        if (typeof window.shUpdateStats === 'function') window.shUpdateStats();
      }
    }
    if (nameInput) nameInput.value = '';
    if (typeof window.shToast === 'function') window.shToast('Cena salva: ' + newScene.name);
    else console.info('[shaders] Saved scene', newScene.id);
  } catch (err) {
    console.error('[shaders] save scene failed', err);
    if (typeof window.shToast === 'function') window.shToast('Falha ao salvar cena: ' + (err.message || err));
  }
};

document.addEventListener('DOMContentLoaded', function () {
  if (typeof window.shInitCtrlResize === 'function') window.shInitCtrlResize();
});
if (document.readyState !== 'loading' && typeof window.shInitCtrlResize === 'function') {
  window.shInitCtrlResize();
}

/* ── Extras list renderer ─────────────────────────────────── */
window.shRenderExtrasList = function () {
  var listEl = document.getElementById('sh3dExtrasList');
  var countEl = document.getElementById('sh3dExtrasCount');
  if (!listEl) return;
  var extras = (typeof window.sh3dListExtras === 'function') ? window.sh3dListExtras() : [];
  var main = (typeof window.sh3dGetMainInfo === 'function') ? window.sh3dGetMainInfo() : null;
  if (countEl) countEl.textContent = '(' + (extras.length + (main ? 1 : 0)) + ')';

  function renderRow(ex, isMain) {
    var kindLabel = isMain ? 'MAIN' : (ex.kind === 'glb' ? 'GLB' : ex.label.toUpperCase());
    var kindCls = isMain ? 'main' : (ex.kind === 'glb' ? 'glb' : '');
    var warn = (!isMain && ex.ephemeral) ? '<span class="sh3d-warn" title="URL temporária (blob:) — não será salva">⚠</span>' : '';
    var animBadge = ex.hasAnimations ? '<span class="sh3d-anim" title="' + ex.clipCount + ' animação(ões)"><i class="fas fa-film"></i></span>' : '';
    var displayName = isMain
      ? (ex.label || 'Modelo principal')
      : (ex.kind === 'glb' ? ex.label : (ex.label.charAt(0).toUpperCase() + ex.label.slice(1)));
    var selCls = ex.selected ? ' is-selected' : '';
    var ephCls = (!isMain && ex.ephemeral) ? ' ephemeral' : '';
    var nameAttr = isMain ? 'main' : ex.name;
    var details = isMain ? '' : (
      '<div class="sh3d-extra-details">' +
      '<div class="row"><label>X<input type="number" step="0.1" value="' + ex.position[0] + '" onchange="shExtraPatch(\'' + ex.name + '\',\'px\',this.value)"></label>' +
      '<label>Y<input type="number" step="0.1" value="' + ex.position[1] + '" onchange="shExtraPatch(\'' + ex.name + '\',\'py\',this.value)"></label>' +
      '<label>Z<input type="number" step="0.1" value="' + ex.position[2] + '" onchange="shExtraPatch(\'' + ex.name + '\',\'pz\',this.value)"></label></div>' +
      '<div class="row"><label>RX<input type="number" step="0.1" value="' + ex.rotation[0] + '" onchange="shExtraPatch(\'' + ex.name + '\',\'rx\',this.value)"></label>' +
      '<label>RY<input type="number" step="0.1" value="' + ex.rotation[1] + '" onchange="shExtraPatch(\'' + ex.name + '\',\'ry\',this.value)"></label>' +
      '<label>RZ<input type="number" step="0.1" value="' + ex.rotation[2] + '" onchange="shExtraPatch(\'' + ex.name + '\',\'rz\',this.value)"></label></div>' +
      '<div class="row"><label>Escala<input type="number" step="0.1" min="0.05" value="' + ex.scale + '" onchange="shExtraPatch(\'' + ex.name + '\',\'s\',this.value)"></label>' +
      (ex.color ? '<label>Cor<input type="color" value="' + ex.color + '" onchange="shExtraPatch(\'' + ex.name + '\',\'color\',this.value)" style="width:28px;height:22px;padding:0;border:1px solid rgba(255,255,255,.1);border-radius:3px"></label>' : '') +
      '</div>' +
      '</div>'
    );
    var focusBtn = '<button class="sh3d-extra-btn" title="Focar câmera" onclick="event.stopPropagation();shExtraFocus(\'' + nameAttr + '\')"><i class="fas fa-crosshairs"></i></button>';
    var editBtn = isMain ? '' : '<button class="sh3d-extra-btn" title="Editar transform" onclick="event.stopPropagation();shExtraToggle(\'' + ex.name + '\')"><i class="fas fa-sliders"></i></button>';
    var delBtn = isMain ? '' : '<button class="sh3d-extra-btn del" title="Remover" onclick="event.stopPropagation();shExtraRemove(\'' + ex.name + '\')"><i class="fas fa-trash"></i></button>';
    return '<div class="sh3d-extra-item' + selCls + ephCls + '" data-name="' + nameAttr + '" onclick="shExtraSelect(\'' + nameAttr + '\')" title="Clique para selecionar">' +
      '<div class="sh3d-extra-label">' +
      '<span class="sh3d-kind ' + kindCls + '">' + kindLabel + '</span>' +
      warn + animBadge +
      '<span>' + displayName + '</span>' +
      '</div>' +
      focusBtn + editBtn + delBtn +
      details +
      '</div>';
  }

  var html = '';
  if (main) html += renderRow(main, true);
  if (extras.length) html += extras.map(function (ex) { return renderRow(ex, false); }).join('');
  if (!html) html = '<div class="sh-ctrl-hint">Nenhum modelo na cena. Use <strong>GLB principal</strong> ou <strong>+GLB extra</strong>.</div>';
  listEl.innerHTML = html;
};

window.shExtraSelect = function (name) {
  if (typeof window.sh3dSelect === 'function') {
    window.sh3dSelect(name === 'main' ? null : name);
  }
};

// Gizmo mode toolbar. Toggles the active class and calls the scene API.
window.shSetTransformMode = function (mode) {
  if (['translate', 'rotate', 'scale'].indexOf(mode) < 0) return;
  if (typeof window.sh3dSetTransformMode === 'function') window.sh3dSetTransformMode(mode);
  try {
    document.querySelectorAll('.sh3d-mode-btn').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-mode') === mode);
    });
  } catch (e) { }
};

// Keyboard shortcuts while the app has focus and not typing in an input.
(function () {
  function isTyping(ev) {
    var t = ev.target;
    if (!t) return false;
    var tag = (t.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
    if (t.isContentEditable) return true;
    return false;
  }
  window.addEventListener('keydown', function (ev) {
    if (isTyping(ev)) return;
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    var k = ev.key.toLowerCase();
    if (k === 'w') { ev.preventDefault(); window.shSetTransformMode('translate'); }
    else if (k === 'e') { ev.preventDefault(); window.shSetTransformMode('rotate'); }
    else if (k === 'r') { ev.preventDefault(); window.shSetTransformMode('scale'); }
    else if (ev.key === 'Escape') {
      if (typeof window.sh3dSelect === 'function') window.sh3dSelect(null);
    }
  });
})();

window.shExtraToggle = function (name) {
  var item = document.querySelector('.sh3d-extra-item[data-name="' + name + '"]');
  if (item) item.classList.toggle('expanded');
};
window.shExtraRemove = function (name) {
  if (typeof window.sh3dRemoveExtra === 'function') window.sh3dRemoveExtra(name);
};
window.shExtraFocus = function (name) {
  if (name === 'main') {
    if (typeof window.sh3dResetCamera === 'function') {
      // Temporarily clear selection so resetCamera targets the main model
      var prev = typeof window.sh3dGetSelected === 'function' ? window.sh3dGetSelected() : null;
      if (typeof window.sh3dSelect === 'function') window.sh3dSelect(null);
      window.sh3dResetCamera();
      if (prev !== null && prev !== undefined && typeof window.sh3dSelect === 'function') window.sh3dSelect(prev);
    }
    return;
  }
  if (typeof window.sh3dFocusExtra === 'function') window.sh3dFocusExtra(name);
};
window.shExtraPatch = function (name, field, value) {
  if (typeof window.sh3dListExtras !== 'function' || typeof window.sh3dUpdateExtra !== 'function') return;
  var list = window.sh3dListExtras();
  var ex = list.find(function (e) { return e.name === name; });
  if (!ex) return;
  var patch = {};
  var v = parseFloat(value);
  if (field === 'px' || field === 'py' || field === 'pz') {
    patch.position = ex.position.slice();
    patch.position[{ px: 0, py: 1, pz: 2 }[field]] = isNaN(v) ? 0 : v;
  } else if (field === 'rx' || field === 'ry' || field === 'rz') {
    patch.rotation = ex.rotation.slice();
    patch.rotation[{ rx: 0, ry: 1, rz: 2 }[field]] = isNaN(v) ? 0 : v;
  } else if (field === 's') {
    patch.scale = isNaN(v) || v <= 0 ? 1 : v;
  } else if (field === 'color') {
    patch.color = value;
  }
  window.sh3dUpdateExtra(name, patch);
};

window.addEventListener('sh3d:extras-changed', function () {
  if (typeof window.shRenderExtrasList === 'function') window.shRenderExtrasList();
});
window.addEventListener('sh3d:selection-changed', function () {
  if (typeof window.shRenderExtrasList === 'function') window.shRenderExtrasList();
});
document.addEventListener('DOMContentLoaded', function () {
  if (typeof window.shRenderExtrasList === 'function') window.shRenderExtrasList();
});
if (document.readyState !== 'loading' && typeof window.shRenderExtrasList === 'function') {
  window.shRenderExtrasList();
}

/* ═════════════════════════════════════════════════════════════
   LIVE CONTROL MODE (Fast/Detail) for the right-side aside
   ═════════════════════════════════════════════════════════════ */
window.shSetLiveMode = function (mode) {
  var aside = document.getElementById('shSceneCtrl');
  if (!aside) return;
  if (mode !== 'fast' && mode !== 'detail') mode = 'detail';
  aside.classList.toggle('sh-live-fast', mode === 'fast');
  aside.classList.toggle('sh-live-detail-mode', mode === 'detail');
  var fast = document.getElementById('shLiveModeFast');
  var det = document.getElementById('shLiveModeDetail');
  if (fast) fast.classList.toggle('active', mode === 'fast');
  if (det) det.classList.toggle('active', mode === 'detail');
  try { localStorage.setItem('olivia.shaders.liveMode', mode); } catch (e) { }
};
(function () {
  try {
    var saved = localStorage.getItem('olivia.shaders.liveMode') || 'detail';
    document.addEventListener('DOMContentLoaded', function () { window.shSetLiveMode(saved); });
    if (document.readyState !== 'loading') window.shSetLiveMode(saved);
  } catch (e) { }
})();

/* ═════════════════════════════════════════════════════════════
   FULLSCREEN CONFIGURATOR + KEYBOARD SHORTCUTS
   - Visibility checkboxes per control (shown over preview when fullscreen)
   - Custom key bindings: hold key, Arrow Left/Right adjusts (Shift = ×10)
   - Esc exits fullscreen
   ═════════════════════════════════════════════════════════════ */
var SH_FS_CONTROLS = [
  { id: 'tod', label: 'Time', key: 't', fn: 'shUpdateTOD', min: 0, max: 24, step: 0.1, fmt: function (v) { var h = Math.floor(v), m = Math.floor((v % 1) * 60); return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') } },
  { id: 'outline', label: 'Outline', key: 'o', fn: 'shUpdateOutline', min: 0, max: 6, step: 0.1, fmt: function (v) { return Number(v).toFixed(1) } },
  { id: 'morph', label: 'Morph', key: 'm', fn: 'shUpdateMorph', min: 0, max: 1, step: 0.01, fmt: function (v) { return Number(v).toFixed(2) } },
  { id: 'era', label: 'Era', key: 'e', fn: 'shSetEra', min: 1200, max: 2025, step: 1, fmt: function (v) { return Math.round(v) } },
  { id: 'dayNight', label: 'Day/Night', key: 'd', fn: 'shSetDayNightCycle', min: 0, max: 1, step: 0.01, fmt: function (v) { return Number(v).toFixed(2) } },
  { id: 'timeSpeed', label: 'Time Speed', key: '', fn: 'shSetWorldTimeSpeed', min: 0.2, max: 4, step: 0.05, fmt: function (v) { return Number(v).toFixed(2) + '×' } },
  { id: 'bloom', label: 'Bloom', key: 'b', postfx: 'bloom', min: 0, max: 1, step: 0.01, fmt: function (v) { return Number(v).toFixed(2) } },
  { id: 'vignette', label: 'Vignette', key: 'v', postfx: 'vignette', min: 0, max: 1, step: 0.01, fmt: function (v) { return Number(v).toFixed(2) } },
  { id: 'grain', label: 'Grain', key: 'g', postfx: 'grain', min: 0, max: 0.6, step: 0.01, fmt: function (v) { return Number(v).toFixed(2) } },
  { id: 'brightness', label: 'Brightness', key: '', postfx: 'brightness', min: 0.3, max: 2, step: 0.01, fmt: function (v) { return Number(v).toFixed(2) } },
  { id: 'saturation', label: 'Saturation', key: '', postfx: 'saturation', min: 0.2, max: 2, step: 0.01, fmt: function (v) { return Number(v).toFixed(2) } },
  { id: 'sepia', label: 'Sepia', key: 's', postfx: 'sepia', min: 0, max: 1, step: 0.01, fmt: function (v) { return Number(v).toFixed(2) } },
  { id: 'lensFlare', label: 'Lens Flare', key: 'l', postfx: 'lensFlare', min: 0, max: 1, step: 0.01, fmt: function (v) { return Number(v).toFixed(2) } },
  { id: 'wind', label: 'Wind', key: 'w', envfx: 'wind', min: 0, max: 2, step: 0.02, fmt: function (v) { return Number(v).toFixed(2) } },
  { id: 'fog', label: 'Fog', key: 'f', envfx: 'fogDensity', min: 0, max: 1, step: 0.01, fmt: function (v) { return Number(v).toFixed(2) } },
];

function shFsConfigDefaults() {
  var visible = {
    tod: true, outline: true, morph: true, era: true, dayNight: false, timeSpeed: false,
    bloom: false, vignette: false, grain: false, brightness: false, saturation: false,
    sepia: false, lensFlare: false, wind: false, fog: false
  };
  var keys = {};
  SH_FS_CONTROLS.forEach(function (c) { keys[c.id] = c.key; });
  return { visible: visible, keys: keys };
}

function shFsConfigLoad() {
  try {
    var raw = localStorage.getItem('olivia.shaders.fsConfig');
    if (!raw) return shFsConfigDefaults();
    var parsed = JSON.parse(raw);
    var d = shFsConfigDefaults();
    return {
      visible: Object.assign({}, d.visible, parsed.visible || {}),
      keys: Object.assign({}, d.keys, parsed.keys || {}),
    };
  } catch (e) { return shFsConfigDefaults(); }
}

function shFsConfigSave(cfg) {
  try { localStorage.setItem('olivia.shaders.fsConfig', JSON.stringify(cfg)); } catch (e) { }
}

var _shFsCfg = shFsConfigLoad();
var _shFsActive = null; // currently-armed control id (key held)

function shFsCurrentValue(c) {
  var s = window._sh; if (!s) return 0;
  if (c.postfx) return s.postFx ? s.postFx[c.postfx] : 0;
  if (c.envfx) return s.envFx ? s.envFx[c.envfx] : 0;
  var ps = s.previewState || {};
  if (c.id === 'tod') return ps.tod;
  if (c.id === 'era') return ps.era;
  if (c.id === 'outline') return ps.outline;
  if (c.id === 'morph') return ps.bgmorph;
  if (c.id === 'dayNight') return ps.dayNightCycle;
  if (c.id === 'timeSpeed') return ps.timeSpeed;
  return 0;
}

function shFsSetValue(c, v) {
  v = Math.max(c.min, Math.min(c.max, v));
  if (c.postfx) { window.shSetPostFxSlider(c.postfx, v); return; }
  if (c.envfx) { window.shSetEnvFx(c.envfx, v); return; }
  if (c.fn && typeof window[c.fn] === 'function') window[c.fn](v);
}

window.shFsConfigToggle = function (force) {
  var pop = document.getElementById('shFsConfig');
  if (!pop) return;
  var open = (typeof force === 'boolean') ? force : pop.hasAttribute('hidden');
  if (open) { pop.removeAttribute('hidden'); shFsConfigRender(); }
  else { pop.setAttribute('hidden', ''); }
};

function shFsConfigRender() {
  var list = document.getElementById('shFsConfigList');
  if (!list) return;
  var html = '';
  SH_FS_CONTROLS.forEach(function (c) {
    var vis = !!_shFsCfg.visible[c.id];
    var key = _shFsCfg.keys[c.id] || '';
    html += '<div class="sh-fs-config-row">'
      + '<label class="sh-fs-config-vis"><input type="checkbox" ' + (vis ? 'checked' : '') + ' onchange="shFsConfigSetVis(\'' + c.id + '\',this.checked)"> ' + c.label + '</label>'
      + '<input class="sh-fs-config-key" type="text" maxlength="1" value="' + key + '" placeholder="—" oninput="shFsConfigSetKey(\'' + c.id + '\',this.value)" title="Tecla para ativar este controle em fullscreen">'
      + '</div>';
  });
  list.innerHTML = html;
}

window.shFsConfigSetVis = function (id, on) {
  _shFsCfg.visible[id] = !!on;
  shFsConfigSave(_shFsCfg);
  if (_shFsFullscreenActive) shFsFloatingRender();
};

window.shFsConfigSetKey = function (id, k) {
  k = String(k || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 1);
  _shFsCfg.keys[id] = k;
  shFsConfigSave(_shFsCfg);
};

window.shFsConfigReset = function () {
  _shFsCfg = shFsConfigDefaults();
  shFsConfigSave(_shFsCfg);
  shFsConfigRender();
  if (_shFsFullscreenActive) shFsFloatingRender();
  if (typeof window.shToast === 'function') window.shToast('Atalhos restaurados');
};

/* ── Fullscreen floating control bar ── */
var _shFsFullscreenActive = false;

function shFsFloatingRender() {
  var bar = document.getElementById('shFsFloating');
  if (!bar) return;
  if (!_shFsFullscreenActive) { bar.setAttribute('hidden', ''); bar.innerHTML = ''; return; }
  bar.removeAttribute('hidden');
  var html = '';
  SH_FS_CONTROLS.forEach(function (c) {
    if (!_shFsCfg.visible[c.id]) return;
    var v = shFsCurrentValue(c);
    var k = _shFsCfg.keys[c.id] ? '<kbd>' + _shFsCfg.keys[c.id].toUpperCase() + '</kbd>' : '';
    html += '<div class="sh-fs-fl-row" data-fsid="' + c.id + '">'
      + '<div class="sh-fs-fl-lab">' + c.label + ' ' + k + ' <span class="sh-fs-fl-val" id="shFsFlVal_' + c.id + '">' + c.fmt(v) + '</span></div>'
      + '<input id="shFsFlSl_' + c.id + '" type="range" min="' + c.min + '" max="' + c.max + '" step="' + c.step + '" value="' + v + '" oninput="shFsFloatingSliderInput(\'' + c.id + '\',this.value)">'
      + '</div>';
  });
  if (!html) html = '<div class="sh-fs-fl-empty">Nenhum controle ativado. Clique no <i class="fas fa-cog"></i> para escolher.</div>';
  bar.innerHTML = html;
}

window.shFsFloatingSliderInput = function (id, val) {
  var c = SH_FS_CONTROLS.find(function (x) { return x.id === id; });
  if (!c) return;
  shFsSetValue(c, parseFloat(val));
  var lab = document.getElementById('shFsFlVal_' + id);
  if (lab) lab.textContent = c.fmt(parseFloat(val));
};

/* Override shToggleFullscreen to drive floating bar */
var _shOriginalToggleFullscreen = window.shToggleFullscreen;
window.shToggleFullscreen = function () {
  var area = document.querySelector('.sh-preview-area');
  if (!area) return;
  area.classList.toggle('fullscreen');
  _shFsFullscreenActive = area.classList.contains('fullscreen');
  shFsFloatingRender();
  // ensure config popover hides on entering fs (cleaner)
  if (_shFsFullscreenActive) shFsConfigToggle(false);
};

/* Periodically refresh floating values when fullscreen (so HUD stays in sync) */
setInterval(function () {
  if (!_shFsFullscreenActive) return;
  SH_FS_CONTROLS.forEach(function (c) {
    if (!_shFsCfg.visible[c.id]) return;
    var v = shFsCurrentValue(c);
    var sl = document.getElementById('shFsFlSl_' + c.id);
    var lab = document.getElementById('shFsFlVal_' + c.id);
    if (sl && Math.abs(parseFloat(sl.value) - v) > 1e-6) sl.value = v;
    if (lab) lab.textContent = c.fmt(v);
  });
}, 500);

/* ── Keyboard shortcuts ── */
function shFsKeyHandler(ev) {
  // Only act when Shaders view is visible
  var view = document.getElementById('shadersView');
  if (!view || !view.classList.contains('active')) return;
  // Skip when typing in inputs/textareas
  var t = ev.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;

  if (ev.key === 'Escape') {
    if (_shFsFullscreenActive) { window.shToggleFullscreen(); ev.preventDefault(); return; }
    if (_shFsActive) { _shFsActive = null; shFsActiveHudRender(); ev.preventDefault(); return; }
  }

  // Arrow keys adjust active control
  if (_shFsActive && (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight' || ev.key === 'ArrowUp' || ev.key === 'ArrowDown')) {
    var c = SH_FS_CONTROLS.find(function (x) { return x.id === _shFsActive; });
    if (!c) return;
    var dir = (ev.key === 'ArrowRight' || ev.key === 'ArrowUp') ? 1 : -1;
    var mult = ev.shiftKey ? 10 : 1;
    var cur = shFsCurrentValue(c);
    shFsSetValue(c, cur + dir * c.step * mult);
    shFsActiveHudRender();
    ev.preventDefault();
    return;
  }

  // Bind key activates a control
  var k = (ev.key || '').toLowerCase();
  if (!k || k.length !== 1) return;
  var match = SH_FS_CONTROLS.find(function (x) { return _shFsCfg.keys[x.id] === k; });
  if (match) {
    _shFsActive = match.id;
    shFsActiveHudRender();
    ev.preventDefault();
  }
}

function shFsActiveHudRender() {
  var hud = document.getElementById('shFsActiveHud');
  if (!hud) return;
  if (!_shFsActive) { hud.setAttribute('hidden', ''); hud.innerHTML = ''; return; }
  var c = SH_FS_CONTROLS.find(function (x) { return x.id === _shFsActive; });
  if (!c) { hud.setAttribute('hidden', ''); return; }
  var v = shFsCurrentValue(c);
  hud.removeAttribute('hidden');
  hud.innerHTML = '<span class="sh-fs-hud-key"><kbd>' + (_shFsCfg.keys[c.id] || '?').toUpperCase() + '</kbd></span>'
    + '<span class="sh-fs-hud-name">' + c.label + '</span>'
    + '<span class="sh-fs-hud-val">' + c.fmt(v) + '</span>'
    + '<span class="sh-fs-hud-hint"><kbd>←</kbd><kbd>→</kbd> ajustar · <kbd>Shift</kbd> ×10 · <kbd>Esc</kbd></span>';
}

document.addEventListener('keydown', shFsKeyHandler);
