/* ============================================================================
   ComfyUI Workflow Editor — import, visualise, refine and export
   ComfyUI workflows inside the Olivy workspace.
   ============================================================================ */
(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';

  // ── Catalogues ──────────────────────────────────────────────────────────
  var MASK_NODE_TYPES = new Set([
    'CLIPSeg', 'InvertMask', 'ThresholdMask', 'CombineSegMasks',
    'ImpactGaussianBlurMask', 'MaskToImage', 'Cut By Mask',
    'MaskPreview+', 'VAEEncodeForInpaint', 'InpaintModelConditioning'
  ]);

  var NODE_COLORS = {
    'LoadImage': '#4a9eff',
    'CheckpointLoaderSimple': '#4ecdc4',
    'CLIPTextEncode': '#ff6b6b',
    'KSampler': '#ffe66d',
    'VAEDecode': '#a37eba',
    'VAEEncodeForInpaint': '#a37eba',
    'ImageResize+': '#5c9ead',
    'Zoe-DepthMapPreprocessor': '#7bd389',
    'ControlNetLoaderAdvanced': '#f78b45',
    'ACN_AdvancedControlNetApply': '#f78b45',
    'PreviewImage': '#b0b0b0',
    'SaveImage': '#b0b0b0',
    'Cut By Mask': '#e76f51',
    'CLIPSeg': '#e76f51',
    'InvertMask': '#e76f51',
    'ThresholdMask': '#e76f51',
    'CombineSegMasks': '#e76f51',
    'ImpactGaussianBlurMask': '#e76f51',
    'MaskToImage': '#e76f51',
    'InpaintModelConditioning': '#e76f51',
  };

  // Legend groups shown over the graph canvas (label + representative swatch).
  var LEGEND = [
    { label: 'Loaders', color: '#4ecdc4' },
    { label: 'Conditioning', color: '#ff6b6b' },
    { label: 'Sampling', color: '#ffe66d' },
    { label: 'VAE / Latent', color: '#a37eba' },
    { label: 'ControlNet', color: '#f78b45' },
    { label: 'Image I/O', color: '#b0b0b0' },
    { label: 'Mask', color: '#e76f51' },
    { label: 'Other', color: '#888' }
  ];

  // Colors used for link curves & arrowheads, keyed by ComfyUI slot type.
  var LINK_TYPE_COLORS = {
    IMAGE: '#4a9eff', MASK: '#e76f51', MODEL: '#4ecdc4', CLIP: '#4ecdc4',
    CONDITIONING: '#ff6b6b', LATENT: '#a37eba', VAE: '#a37eba',
    CONTROL_NET: '#f78b45', default: '#8a8a8a'
  };

  // Best-effort widget layouts for common/stock node types, so parameters show
  // up with real names and proper controls (sliders, seeds, dropdowns, text
  // areas) instead of generic "param 1 / param 2" fields. Custom or unknown
  // node types still work — they fall back to type-inferred generic fields,
  // same as before. Exact widget order can vary slightly between ComfyUI /
  // custom-node versions, so treat these as a strong default, not gospel.
  var WIDGET_SCHEMAS = {
    'CheckpointLoaderSimple': [{ name: 'ckpt_name', type: 'text' }],
    'ControlNetLoaderAdvanced': [{ name: 'control_net_name', type: 'text' }],
    'LoadImage': [{ name: 'filename', type: 'text' }],
    'CLIPTextEncode': [{ name: 'text', type: 'textarea' }],
    'KSampler': [
      { name: 'seed', type: 'seed' },
      { name: 'control_after_generate', type: 'combo', options: ['fixed', 'increment', 'decrement', 'randomize'] },
      { name: 'steps', type: 'int', min: 1, max: 150, step: 1 },
      { name: 'cfg', type: 'number', min: 0, max: 30, step: 0.1 },
      { name: 'sampler_name', type: 'text' },
      { name: 'scheduler', type: 'text' },
      { name: 'denoise', type: 'range', min: 0, max: 1, step: 0.01 }
    ],
    'ImageResize+': [
      { name: 'width', type: 'int', min: 1, max: 8192, step: 1 },
      { name: 'height', type: 'int', min: 1, max: 8192, step: 1 },
      { name: 'interpolation', type: 'text' },
      { name: 'method', type: 'text' },
      { name: 'condition', type: 'text' },
      { name: 'multiple_of', type: 'int', min: 0, max: 512, step: 1 }
    ],
    'Zoe-DepthMapPreprocessor': [{ name: 'resolution', type: 'int', min: 64, max: 2048, step: 8 }],
    'ACN_AdvancedControlNetApply': [
      { name: 'strength', type: 'range', min: 0, max: 2, step: 0.01 },
      { name: 'start_percent', type: 'range', min: 0, max: 1, step: 0.01 },
      { name: 'end_percent', type: 'range', min: 0, max: 1, step: 0.01 }
    ],
    'SaveImage': [{ name: 'filename_prefix', type: 'text' }],
    'VAEEncodeForInpaint': [{ name: 'grow_mask_by', type: 'int', min: 0, max: 64, step: 1 }],
    'Cut By Mask': [
      { name: 'force_resize_width', type: 'int', min: 0, max: 8192, step: 1 },
      { name: 'force_resize_height', type: 'int', min: 0, max: 8192, step: 1 }
    ],
    'CLIPSeg': [
      { name: 'text', type: 'textarea' },
      { name: 'threshold', type: 'range', min: 0, max: 1, step: 0.01 }
    ],
    'ThresholdMask': [{ name: 'threshold', type: 'range', min: 0, max: 1, step: 0.01 }],
    'ImpactGaussianBlurMask': [
      { name: 'kernel_size', type: 'int', min: 1, max: 99, step: 2 },
      { name: 'sigma', type: 'range', min: 0, max: 20, step: 0.1 }
    ]
  };

  // ── State ───────────────────────────────────────────────────────────────
  var built = false;
  var activePanel = 'editor';
  var workflow = null;                 // parsed JSON object
  var selectedNodeId = null;
  var scale = 0.5;
  var offset = null;                   // null until first render, so the graph auto-centers
  var searchQuery = '';
  var expandedMaskCards = new Set();
  var lastMaskTestResult = null;       // { status: 'loading'|'ok'|'error', message, previewUrl }

  var dragNode = null;                 // { id, startClientX, startClientY, origX, origY }
  var isPanning = false;
  var panStart = { x: 0, y: 0 };
  var panOrigin = { x: 0, y: 0 };
  var rafId = null;

  // ── SVG Icons ──────────────────────────────────────────────────────────
  var ICONS = {
    cube: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">' +
      '<g stroke="currentColor" stroke-width="3.5" stroke-linejoin="round">' +
      '<path fill="currentColor" fill-opacity="0.95" d="M50 18 L80 35 L50 52 L20 35 Z"/>' +
      '<path fill="currentColor" fill-opacity="0.52" d="M20 35 L50 52 L50 86 L20 69 Z"/>' +
      '<path fill="currentColor" fill-opacity="0.28" d="M80 35 L80 69 L50 86 L50 52 Z"/>' +
      '</g></svg>',
    mask: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4" y1="4" x2="20" y2="20"/></svg>',
    node: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="3"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="16" x2="12" y2="16"/></svg>',
    export: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    import: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
    save: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
  };

  // ── Build the view ─────────────────────────────────────────────────────
  function build() {
    var view = document.getElementById('comfyuiWorkflowView');
    if (!view || built) return;

    view.innerHTML =
      '<div class="cf-head">' +
      '<div class="cf-head-brand">' +
      '<span class="cf-logo">' + ICONS.cube + '</span>' +
      '<span class="cf-title">ComfyUI Workflow</span>' +
      '<span class="cf-sub">Visual Editor & Mask Refinery</span>' +
      '</div>' +
      '<div class="cf-head-actions">' +
      '<span class="cf-head-stats" id="cfHeadStats"></span>' +
      '<button class="btn btn-sm" onclick="comfyuiImportWorkflow()" title="Import workflow JSON">' +
      ICONS.import + ' Import</button>' +
      '<button class="btn btn-sm" onclick="comfyuiExportWorkflow()" title="Download workflow JSON">' +
      ICONS.export + ' Export</button>' +
      '<button class="btn btn-sm" onclick="comfyuiSaveWorkflow()" title="Save to workspace">' +
      ICONS.save + ' Save</button>' +
      '<button class="btn btn-sm" onclick="comfyuiHideView()" title="Close">' +
      '<i class="fas fa-times"></i></button>' +
      '</div>' +
      '</div>' +
      '<div class="cf-subnav">' +
      '<button class="cf-tab active" data-panel="editor" onclick="comfyuiSwitchPanel(\'editor\')">' +
      ICONS.node + ' Workflow Editor</button>' +
      '<button class="cf-tab" data-panel="masks" onclick="comfyuiSwitchPanel(\'masks\')">' +
      ICONS.mask + ' Mask Pipeline</button>' +
      '<div class="cf-subnav-spacer"></div>' +
      '<div class="cf-search-wrap">' +
      '<span class="cf-search-icon">' + ICONS.search + '</span>' +
      '<input type="text" class="cf-search-input" id="cfSearchInput" placeholder="Search nodes…" oninput="comfyuiSearchNodes(this.value)">' +
      '</div>' +
      '<span class="cf-search-count" id="cfSearchCount"></span>' +
      '</div>' +
      '<div class="cf-panels">' +
      '<div id="cfPanel-editor" class="cf-panel active">' +
      '<div class="cf-editor-layout">' +
      '<div class="cf-graph-container" id="cfGraphContainer">' +
      '<div class="cf-graph-controls">' +
      '<button class="btn btn-sm" onclick="comfyuiZoomIn()" title="Zoom in"><i class="fas fa-plus"></i></button>' +
      '<button class="btn btn-sm" onclick="comfyuiZoomOut()" title="Zoom out"><i class="fas fa-minus"></i></button>' +
      '<button class="btn btn-sm" onclick="comfyuiZoomFit()" title="Fit to view"><i class="fas fa-expand"></i></button>' +
      '</div>' +
      '<div class="cf-legend" id="cfLegend"></div>' +
      '<svg id="cfGraphSvg" class="cf-graph-svg"></svg>' +
      '<span class="cf-zoom-readout" id="cfZoomReadout">50%</span>' +
      '</div>' +
      '<div class="cf-detail-panel" id="cfDetailPanel">' +
      '<div class="cf-detail-placeholder">Click a node to inspect and edit parameters. Drag a node to move it, drag empty canvas to pan, scroll to zoom.</div>' +
      '</div>' +
      '</div>' +
      '</div>' +
      '<div id="cfPanel-masks" class="cf-panel">' +
      '<div class="cf-mask-toolbar">' +
      '<span class="cf-mask-title">Mask Processing Chain</span>' +
      '<div class="cf-mask-toolbar-actions">' +
      '<button class="btn btn-sm" onclick="comfyuiTestMaskChain()" title="Send the mask chain to the connected ComfyUI backend for a live preview">' +
      ICONS.play + ' Test Chain</button>' +
      '</div>' +
      '</div>' +
      '<div class="cf-mask-pipeline" id="cfMaskPipeline"></div>' +
      '</div>' +
      '</div>';

    built = true;
    renderLegend();
    wireCanvasInteractions();
    if (workflow) renderGraph();
  }

  function renderLegend() {
    var el = document.getElementById('cfLegend');
    if (!el) return;
    el.innerHTML = LEGEND.map(function (item) {
      return '<div class="cf-legend-item"><span class="cf-legend-swatch" style="background:' + item.color + '"></span>' + item.label + '</div>';
    }).join('');
  }

  // ── Panel switching ────────────────────────────────────────────────────
  window.comfyuiSwitchPanel = function (name) {
    activePanel = name;
    ['editor', 'masks'].forEach(function (p) {
      var panel = document.getElementById('cfPanel-' + p);
      if (panel) panel.classList.toggle('active', p === name);
    });
    var tabs = document.querySelectorAll('#comfyuiWorkflowView .cf-tab');
    tabs.forEach(function (t) {
      t.classList.toggle('active', t.getAttribute('data-panel') === name);
    });
    if (name === 'masks' && workflow) renderMaskPipeline();
  };

  // ── Search / filter ────────────────────────────────────────────────────
  function matchesSearch(n) {
    if (!searchQuery) return true;
    var hay = (String(n.id) + ' ' + (n.title || '') + ' ' + n.type).toLowerCase();
    return hay.indexOf(searchQuery) !== -1;
  }

  window.comfyuiSearchNodes = function (q) {
    searchQuery = (q || '').trim().toLowerCase();
    renderGraph();
    var countEl = document.getElementById('cfSearchCount');
    if (!countEl) return;
    if (!searchQuery || !workflow) { countEl.textContent = ''; return; }
    var n = workflow.nodes.filter(matchesSearch).length;
    countEl.textContent = n + ' match' + (n === 1 ? '' : 'es');
  };

  // ── Canvas interactions: drag nodes, pan background, zoom with wheel ───
  function scheduleRender() {
    if (rafId) return;
    rafId = requestAnimationFrame(function () { rafId = null; renderGraph(); });
  }

  function wireCanvasInteractions() {
    var container = document.getElementById('cfGraphContainer');
    if (!container) return;

    container.addEventListener('mousedown', function (e) {
      if (e.button !== 0 || !workflow) return;
      isPanning = true;
      panStart = { x: e.clientX, y: e.clientY };
      panOrigin = { x: (offset && offset.x) || 0, y: (offset && offset.y) || 0 };
      container.classList.add('panning');
    });

    container.addEventListener('wheel', function (e) {
      if (!workflow) return;
      e.preventDefault();
      var rect = container.getBoundingClientRect();
      var mx = e.clientX - rect.left, my = e.clientY - rect.top;
      var o = offset || { x: 0, y: 0 };
      var graphX = (mx - o.x) / scale, graphY = (my - o.y) / scale;
      var factor = e.deltaY < 0 ? 1.1 : 0.9;
      scale = Math.max(0.05, Math.min(3, scale * factor));
      offset = { x: mx - graphX * scale, y: my - graphY * scale };
      renderGraph();
    }, { passive: false });

    document.addEventListener('mousemove', function (e) {
      if (dragNode) {
        var dx = (e.clientX - dragNode.startClientX) / scale;
        var dy = (e.clientY - dragNode.startClientY) / scale;
        var node = workflow && workflow.nodes.find(function (n) { return n.id === dragNode.id; });
        if (node) {
          node.pos[0] = dragNode.origX + dx;
          node.pos[1] = dragNode.origY + dy;
          scheduleRender();
        }
      } else if (isPanning) {
        offset = {
          x: panOrigin.x + (e.clientX - panStart.x),
          y: panOrigin.y + (e.clientY - panStart.y)
        };
        scheduleRender();
      }
    });

    document.addEventListener('mouseup', function (e) {
      if (dragNode) {
        dragNode = null;
        renderGraph();
      }
      if (isPanning) {
        isPanning = false;
        container.classList.remove('panning');
        var moved = Math.abs(e.clientX - panStart.x) + Math.abs(e.clientY - panStart.y);
        if (moved < 4 && selectedNodeId !== null) {
          // A plain click on empty canvas (no drag) deselects the current node.
          selectedNodeId = null;
          renderGraph();
          renderNodeDetail(null);
        }
      }
    });

    document.addEventListener('keydown', function (e) {
      var view = document.getElementById('comfyuiWorkflowView');
      if (!view || !view.classList.contains('active') || activePanel !== 'editor') return;
      var tag = (e.target && e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNodeId !== null) {
        e.preventDefault();
        window.comfyuiDeleteNode(selectedNodeId);
      }
    });
  }

  // ── Graph rendering ────────────────────────────────────────────────────
  function renderGraph() {
    var statsEl = document.getElementById('cfHeadStats');
    if (statsEl) statsEl.textContent = workflow ? (workflow.nodes.length + ' nodes · ' + (workflow.links || []).length + ' links') : '';

    if (!workflow || !workflow.nodes) return;
    var svg = document.getElementById('cfGraphSvg');
    var container = document.getElementById('cfGraphContainer');
    if (!svg || !container) return;

    // Compute bounding box of all nodes
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    workflow.nodes.forEach(function (n) {
      var x = n.pos[0], y = n.pos[1];
      var w = (n.size && n.size[0]) ? n.size[0] : 200;
      var h = (n.size && n.size[1]) ? n.size[1] : 100;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x + w > maxX) maxX = x + w;
      if (y + h > maxY) maxY = y + h;
    });
    var graphW = maxX - minX + 40;
    var graphH = maxY - minY + 40;
    var containerW = container.clientWidth;
    var containerH = container.clientHeight;

    // Auto-scale if not manually set
    if (!scale || scale === 0) {
      scale = Math.min(containerW / graphW, containerH / graphH, 1);
      scale = Math.max(0.2, Math.min(2, scale));
    }
    // Auto-center only when offset hasn't been established yet (fresh load / fit-to-view).
    if (!offset) offset = { x: -minX * scale + 20, y: -minY * scale + 20 };

    svg.setAttribute('width', containerW);
    svg.setAttribute('height', containerH);
    svg.innerHTML = '';

    var defs = document.createElementNS(NS, 'defs');
    Object.keys(LINK_TYPE_COLORS).forEach(function (key) {
      var marker = document.createElementNS(NS, 'marker');
      marker.setAttribute('id', 'cf-arrow-' + key);
      marker.setAttribute('viewBox', '0 0 10 10');
      marker.setAttribute('refX', '8');
      marker.setAttribute('refY', '5');
      marker.setAttribute('markerWidth', '7');
      marker.setAttribute('markerHeight', '7');
      marker.setAttribute('orient', 'auto-start-reverse');
      var path = document.createElementNS(NS, 'path');
      path.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
      path.setAttribute('fill', LINK_TYPE_COLORS[key]);
      marker.appendChild(path);
      defs.appendChild(marker);
    });
    svg.appendChild(defs);

    // Draw group boxes (organizational rectangles some workflows define)
    (workflow.groups || []).forEach(function (grp) {
      if (!grp.bounding) return;
      var gx = grp.bounding[0] * scale + offset.x, gy = grp.bounding[1] * scale + offset.y;
      var gw = grp.bounding[2] * scale, gh = grp.bounding[3] * scale;
      var col = grp.color || '#888';
      var wrap = document.createElementNS(NS, 'g');
      wrap.setAttribute('class', 'cf-group-box');
      var r = document.createElementNS(NS, 'rect');
      r.setAttribute('x', gx); r.setAttribute('y', gy);
      r.setAttribute('width', gw); r.setAttribute('height', gh);
      r.setAttribute('rx', 8);
      r.setAttribute('fill', col); r.setAttribute('stroke', col);
      wrap.appendChild(r);
      var t = document.createElementNS(NS, 'text');
      t.setAttribute('x', gx + 8); t.setAttribute('y', gy + 16);
      t.setAttribute('fill', col);
      t.textContent = grp.title || 'Group';
      wrap.appendChild(t);
      svg.appendChild(wrap);
    });

    // Draw links
    var links = workflow.links || [];
    var nodeMap = {};
    workflow.nodes.forEach(function (n) { nodeMap[n.id] = n; });

    links.forEach(function (l) {
      var srcNode = nodeMap[l[1]];
      var tgtNode = nodeMap[l[3]];
      if (!srcNode || !tgtNode) return;
      var sw = srcNode.size ? srcNode.size[0] : 200, sh = srcNode.size ? srcNode.size[1] : 100;
      var tw = tgtNode.size ? tgtNode.size[0] : 200, th = tgtNode.size ? tgtNode.size[1] : 100;
      var sx = (srcNode.pos[0] + sw) * scale + offset.x;
      var sy = (srcNode.pos[1] + sh / 2) * scale + offset.y;
      var tx = tgtNode.pos[0] * scale + offset.x;
      var ty = (tgtNode.pos[1] + th / 2) * scale + offset.y;
      var bend = Math.max(30, Math.min(150, Math.abs(tx - sx) * 0.5));
      var d = 'M ' + sx + ' ' + sy + ' C ' + (sx + bend) + ' ' + sy + ', ' + (tx - bend) + ' ' + ty + ', ' + tx + ' ' + ty;

      var linkType = String(l[5] || '').toUpperCase();
      var colorKey = LINK_TYPE_COLORS[linkType] ? linkType : 'default';
      var path = document.createElementNS(NS, 'path');
      path.setAttribute('d', d);
      path.setAttribute('class', 'cf-link');
      path.setAttribute('stroke', LINK_TYPE_COLORS[colorKey]);
      path.setAttribute('marker-end', 'url(#cf-arrow-' + colorKey + ')');
      path.setAttribute('data-link', l[0]);
      var title = document.createElementNS(NS, 'title');
      title.textContent = (linkType || 'link') + ': ' + (srcNode.title || srcNode.type) + ' #' + srcNode.id +
        ' \u2192 ' + (tgtNode.title || tgtNode.type) + ' #' + tgtNode.id;
      path.appendChild(title);
      svg.appendChild(path);
    });

    // Draw nodes
    workflow.nodes.forEach(function (n) {
      var x = n.pos[0] * scale + offset.x;
      var y = n.pos[1] * scale + offset.y;
      var w = (n.size ? n.size[0] : 200) * scale;
      var h = (n.size ? n.size[1] : 100) * scale;
      var color = NODE_COLORS[n.type] || '#888';
      var isSelected = n.id === selectedNodeId;
      var modeClass = n.mode === 4 ? ' cf-node-mode-bypass' : (n.mode === 2 ? ' cf-node-mode-mute' : '');
      var searchClass = searchQuery ? (matchesSearch(n) ? ' match' : ' dimmed') : '';

      var g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'cf-node-group' + (isSelected ? ' selected' : '') + modeClass + searchClass);
      g.setAttribute('data-node-id', n.id);
      g.addEventListener('click', function (e) {
        e.stopPropagation();
        selectNode(n.id);
      });
      g.addEventListener('mousedown', function (e) {
        if (e.button !== 0) return;
        e.stopPropagation();
        dragNode = { id: n.id, startClientX: e.clientX, startClientY: e.clientY, origX: n.pos[0], origY: n.pos[1] };
      });

      var rect = document.createElementNS(NS, 'rect');
      rect.setAttribute('x', x);
      rect.setAttribute('y', y);
      rect.setAttribute('width', w);
      rect.setAttribute('height', h);
      rect.setAttribute('rx', 6);
      rect.setAttribute('ry', 6);
      rect.setAttribute('fill', color + '22');
      rect.setAttribute('stroke', color);
      rect.setAttribute('stroke-width', isSelected ? 2.5 : 1.5);
      rect.setAttribute('class', 'cf-node-rect');
      g.appendChild(rect);

      var text = document.createElementNS(NS, 'text');
      text.setAttribute('x', x + 6);
      text.setAttribute('y', y + 16);
      text.setAttribute('font-size', Math.max(10, 13 * scale));
      text.setAttribute('fill', 'var(--white)');
      text.setAttribute('font-family', 'var(--mono)');
      text.textContent = (n.title || n.type) + ' (' + n.id + ')' + (n.mode === 4 ? ' [bypass]' : n.mode === 2 ? ' [muted]' : '');
      g.appendChild(text);

      // Small type label
      var typeLabel = document.createElementNS(NS, 'text');
      typeLabel.setAttribute('x', x + 6);
      typeLabel.setAttribute('y', y + 32 * scale);
      typeLabel.setAttribute('font-size', Math.max(8, 10 * scale));
      typeLabel.setAttribute('fill', 'var(--gray)');
      typeLabel.setAttribute('font-family', 'var(--mono)');
      typeLabel.textContent = n.type;
      g.appendChild(typeLabel);

      svg.appendChild(g);
    });

    var zr = document.getElementById('cfZoomReadout');
    if (zr) zr.textContent = Math.round(scale * 100) + '%';
  }

  function selectNode(id) {
    selectedNodeId = id;
    renderGraph();
    renderNodeDetail(id);
  }

  // ── Shared widget field renderer (used by detail panel + mask cards) ───
  // Note: field handlers mutate workflow data directly and deliberately do
  // NOT force a full panel re-render on every keystroke/drag — that would
  // yank focus out from under whoever is mid-edit. Re-renders only happen
  // on discrete actions (toggle, delete, duplicate, mode change) where
  // nothing was actively being typed into.
  function buildWidgetFieldsHTML(node) {
    var schema = WIDGET_SCHEMAS[node.type] || [];
    var html = '';
    (node.widgets_values || []).forEach(function (val, idx) {
      var def = schema[idx];
      var label = def ? def.name : ('param ' + (idx + 1));
      var kind = def ? def.type : (typeof val === 'boolean' ? 'boolean' : typeof val === 'number' ? 'number' : 'text');

      if (kind === 'textarea') {
        html += '<div class="cf-widget-row cf-widget-col"><label class="cf-widget-label">' + esc(label) + '</label>' +
          '<textarea class="cf-widget-textarea" onchange="comfyuiUpdateWidget(' + node.id + ',' + idx + ', this.value)">' + esc(String(val)) + '</textarea></div>';
      } else if (kind === 'boolean') {
        html += '<div class="cf-widget-row"><label class="cf-widget-label">' + esc(label) + '</label>' +
          '<input type="checkbox" class="cf-widget-checkbox" ' + (val ? 'checked' : '') +
          ' onchange="comfyuiUpdateWidget(' + node.id + ',' + idx + ', this.checked)"></div>';
      } else if (kind === 'combo' && def.options) {
        html += '<div class="cf-widget-row"><label class="cf-widget-label">' + esc(label) + '</label>' +
          '<select class="cf-widget-select" onchange="comfyuiUpdateWidget(' + node.id + ',' + idx + ', this.value)">';
        def.options.forEach(function (opt) {
          html += '<option value="' + esc(opt) + '"' + (String(val) === opt ? ' selected' : '') + '>' + esc(opt) + '</option>';
        });
        html += '</select></div>';
      } else if (kind === 'range') {
        var min = def.min != null ? def.min : 0, max = def.max != null ? def.max : 1, step = def.step != null ? def.step : 0.01;
        html += '<div class="cf-widget-row"><label class="cf-widget-label">' + esc(label) + '</label>' +
          '<div class="cf-widget-range-wrap">' +
          '<input type="range" class="cf-widget-range" min="' + min + '" max="' + max + '" step="' + step + '" value="' + val + '" ' +
          'oninput="this.nextElementSibling.textContent=this.value; comfyuiUpdateWidget(' + node.id + ',' + idx + ', parseFloat(this.value))">' +
          '<span class="cf-widget-range-val">' + val + '</span></div></div>';
      } else if (kind === 'int' || kind === 'number' || kind === 'seed') {
        var attrs = '';
        if (def && def.min != null) attrs += ' min="' + def.min + '"';
        if (def && def.max != null) attrs += ' max="' + def.max + '"';
        attrs += ' step="' + (def && def.step != null ? def.step : (kind === 'number' ? 'any' : 1)) + '"';
        html += '<div class="cf-widget-row"><label class="cf-widget-label">' + esc(label) + '</label>' +
          '<input type="number" class="cf-widget-input"' + attrs + ' value="' + val + '" onchange="comfyuiUpdateWidget(' + node.id + ',' + idx + ', ' +
          (kind === 'number' ? 'parseFloat(this.value)' : 'parseInt(this.value,10)') + ')">';
        if (kind === 'seed') {
          html += '<button type="button" class="btn btn-sm" style="padding:3px 7px;flex:0;" title="Randomize" ' +
            'onclick="comfyuiRandomizeSeed(' + node.id + ',' + idx + ', this)">\uD83C\uDFB2</button>';
        }
        html += '</div>';
      } else {
        html += '<div class="cf-widget-row"><label class="cf-widget-label">' + esc(label) + '</label>' +
          '<input type="text" class="cf-widget-input" value="' + esc(String(val)) + '" onchange="comfyuiUpdateWidget(' + node.id + ',' + idx + ', this.value)"></div>';
      }
    });
    return html;
  }

  function renderNodeDetail(id) {
    var panel = document.getElementById('cfDetailPanel');
    if (!panel) return;
    if (!workflow || id === null || id === undefined) {
      panel.innerHTML = '<div class="cf-detail-placeholder">Click a node to inspect and edit parameters. Drag a node to move it, drag empty canvas to pan, scroll to zoom.</div>';
      return;
    }
    var node = workflow.nodes.find(function (n) { return n.id === id; });
    if (!node) {
      panel.innerHTML = '<div class="cf-detail-placeholder">Node not found.</div>';
      return;
    }

    var html = '<div class="cf-node-detail">';
    html += '<div class="cf-node-detail-head"><h3 class="cf-node-detail-title">' + esc(node.type) + ' <span class="cf-node-id">#' + node.id + '</span></h3></div>';
    if (node.title) html += '<div class="cf-node-detail-sub">' + esc(node.title) + '</div>';

    html += '<div class="cf-node-toolbar">';
    html += '<button class="btn btn-sm" onclick="comfyuiDuplicateNode(' + node.id + ')" title="Duplicate this node (links are not copied)">' + ICONS.copy + ' Duplicate</button>';
    html += '<button class="btn btn-sm danger" onclick="comfyuiDeleteNode(' + node.id + ')" title="Delete this node and its links">' + ICONS.trash + ' Delete</button>';
    html += '</div>';

    html += '<div class="cf-mode-row"><label>Mode</label><select class="cf-widget-select" onchange="comfyuiSetNodeMode(' + node.id + ', parseInt(this.value,10))">';
    [[0, 'Always'], [2, 'Never (mute)'], [4, 'Bypass']].forEach(function (pair) {
      html += '<option value="' + pair[0] + '"' + ((node.mode || 0) === pair[0] ? ' selected' : '') + '>' + pair[1] + '</option>';
    });
    html += '</select></div>';

    html += '<div class="cf-pos-row">' +
      '<div class="cf-pos-field"><label>X</label><input class="cf-widget-input" type="number" value="' + Math.round(node.pos[0]) +
      '" onchange="comfyuiSetPos(' + node.id + ', 0, parseFloat(this.value))"></div>' +
      '<div class="cf-pos-field"><label>Y</label><input class="cf-widget-input" type="number" value="' + Math.round(node.pos[1]) +
      '" onchange="comfyuiSetPos(' + node.id + ', 1, parseFloat(this.value))"></div>' +
      '</div>';

    html += '<div class="cf-node-io"><span class="cf-io-label">Inputs:</span><ul>';
    if (!(node.inputs && node.inputs.length)) html += '<li style="color:var(--gray)">None</li>';
    (node.inputs || []).forEach(function (inp) {
      var dotColor = LINK_TYPE_COLORS[String(inp.type || '').toUpperCase()] || LINK_TYPE_COLORS.default;
      html += '<li><span class="cf-io-dot" style="background:' + dotColor + '"></span><code>' + esc(inp.name) + '</code> : ' + esc(inp.type) +
        (inp.link !== null && inp.link !== undefined ? ' \u2192 link ' + inp.link : ' (unconnected)') + '</li>';
    });
    html += '</ul></div>';
    html += '<div class="cf-node-io"><span class="cf-io-label">Outputs:</span><ul>';
    if (!(node.outputs && node.outputs.length)) html += '<li style="color:var(--gray)">None</li>';
    (node.outputs || []).forEach(function (out) {
      var dotColor = LINK_TYPE_COLORS[String(out.type || '').toUpperCase()] || LINK_TYPE_COLORS.default;
      html += '<li><span class="cf-io-dot" style="background:' + dotColor + '"></span><code>' + esc(out.name) + '</code> : ' + esc(out.type) +
        (out.links && out.links.length ? ' \u2192 links ' + out.links.join(', ') : '') + '</li>';
    });
    html += '</ul></div>';

    if (node.widgets_values && node.widgets_values.length) {
      html += '<div class="cf-widgets"><span class="cf-io-label">Parameters:</span>' + buildWidgetFieldsHTML(node) + '</div>';
    }

    html += '</div>';
    panel.innerHTML = html;
  }

  window.comfyuiUpdateWidget = function (nodeId, idx, value) {
    if (!workflow) return;
    var node = workflow.nodes.find(function (n) { return n.id === nodeId; });
    if (!node) return;
    node.widgets_values[idx] = value;
    // Intentionally no re-render here — see note above buildWidgetFieldsHTML.
  };

  window.comfyuiRandomizeSeed = function (nodeId, idx, btn) {
    if (!workflow) return;
    var node = workflow.nodes.find(function (n) { return n.id === nodeId; });
    if (!node) return;
    var val = Math.floor(Math.random() * 1e15);
    node.widgets_values[idx] = val;
    if (btn && btn.previousElementSibling) btn.previousElementSibling.value = val;
  };

  window.comfyuiSetNodeMode = function (nodeId, mode) {
    if (!workflow) return;
    var node = workflow.nodes.find(function (n) { return n.id === nodeId; });
    if (!node) return;
    node.mode = mode;
    renderGraph();
    if (activePanel === 'masks') renderMaskPipeline();
  };

  window.comfyuiSetPos = function (nodeId, axis, value) {
    if (!workflow || isNaN(value)) return;
    var node = workflow.nodes.find(function (n) { return n.id === nodeId; });
    if (!node) return;
    node.pos[axis] = value;
    renderGraph();
  };

  window.comfyuiDeleteNode = function (nodeId) {
    if (!workflow) return;
    if (!confirm('Delete this node? Its links will be removed too.')) return;
    workflow.nodes = workflow.nodes.filter(function (n) { return n.id !== nodeId; });
    workflow.links = (workflow.links || []).filter(function (l) { return l[1] !== nodeId && l[3] !== nodeId; });
    if (selectedNodeId === nodeId) selectedNodeId = null;
    renderGraph();
    renderNodeDetail(selectedNodeId);
    if (activePanel === 'masks') renderMaskPipeline();
  };

  window.comfyuiDuplicateNode = function (nodeId) {
    if (!workflow) return;
    var node = workflow.nodes.find(function (n) { return n.id === nodeId; });
    if (!node) return;
    var maxId = workflow.nodes.reduce(function (m, n) { return Math.max(m, n.id); }, 0);
    var clone = JSON.parse(JSON.stringify(node));
    clone.id = maxId + 1;
    clone.pos = [node.pos[0] + 30, node.pos[1] + 30];
    // A duplicate starts disconnected — links aren't copied, so re-wire it in the graph.
    (clone.inputs || []).forEach(function (inp) { inp.link = null; });
    (clone.outputs || []).forEach(function (out) { out.links = []; });
    workflow.nodes.push(clone);
    selectedNodeId = clone.id;
    renderGraph();
    renderNodeDetail(clone.id);
  };

  // Expose selectNode so inline onclick handlers (mask pipeline cards) can reach it
  window.comfyuiSelectNode = function (id) {
    selectNode(id);
    comfyuiSwitchPanel('editor');
  };

  // ── Mask Pipeline ──────────────────────────────────────────────────────
  function isMaskNode(n) {
    return MASK_NODE_TYPES.has(n.type) ||
      (n.inputs && n.inputs.some(function (i) { return i.type === 'MASK'; })) ||
      (n.outputs && n.outputs.some(function (o) { return o.type === 'MASK'; }));
  }

  function topoSortMaskNodes(maskNodes, links) {
    var ids = new Set(maskNodes.map(function (n) { return n.id; }));
    var inDegree = {}, adjacency = {};
    maskNodes.forEach(function (n) { inDegree[n.id] = 0; adjacency[n.id] = []; });
    links.forEach(function (l) {
      var src = l[1], tgt = l[3];
      if (ids.has(src) && ids.has(tgt)) {
        adjacency[src].push(tgt);
        inDegree[tgt] = (inDegree[tgt] || 0) + 1;
      }
    });
    var queue = maskNodes.filter(function (n) { return !inDegree[n.id]; }).map(function (n) { return n.id; }).sort(function (a, b) { return a - b; });
    var order = [], visited = new Set();
    while (queue.length) {
      var id = queue.shift();
      if (visited.has(id)) continue;
      visited.add(id);
      order.push(id);
      (adjacency[id] || []).forEach(function (nextId) {
        inDegree[nextId]--;
        if (inDegree[nextId] <= 0 && !visited.has(nextId)) queue.push(nextId);
      });
      queue.sort(function (a, b) { return a - b; });
    }
    maskNodes.forEach(function (n) { if (!visited.has(n.id)) order.push(n.id); }); // leftover / cyclic
    var nodeMap = {};
    maskNodes.forEach(function (n) { nodeMap[n.id] = n; });
    return order.map(function (id) { return nodeMap[id]; });
  }

  function renderMaskPipeline() {
    if (!workflow) return;
    var container = document.getElementById('cfMaskPipeline');
    if (!container) return;

    var maskNodes = workflow.nodes.filter(isMaskNode);
    if (!maskNodes.length) {
      container.innerHTML = '<div class="cf-mask-empty">No mask-related nodes found in this workflow.</div>';
      return;
    }

    var ordered = topoSortMaskNodes(maskNodes, workflow.links || []);
    var nodeMap = {};
    workflow.nodes.forEach(function (n) { nodeMap[n.id] = n; });

    var html = '<div class="cf-mask-chain">';
    ordered.forEach(function (n, i) {
      if (i > 0) html += '<div class="cf-mask-chain-arrow">\u2192</div>';
      var isBypassed = n.mode === 4 || n.mode === 2;
      var isOpen = expandedMaskCards.has(n.id);

      html += '<div class="cf-mask-chain-item"><div class="cf-mask-node-card' + (isBypassed ? ' bypassed' : '') + '">';
      html += '<div class="cf-mask-card-head">';
      html += '<div class="cf-mask-card-head-main" onclick="comfyuiSelectNode(' + n.id + ')">';
      html += '<div class="cf-mask-card-title-row">' + esc(n.title || n.type) + ' <span class="cf-mask-card-id">#' + n.id + '</span></div>';
      html += '<div class="cf-mask-card-type">' + esc(n.type) + '</div>';
      html += '</div>';
      html += '<button class="cf-toggle' + (isBypassed ? '' : ' on') + '" title="Enable / bypass this node" ' +
        'onclick="event.stopPropagation(); comfyuiToggleMaskBypass(' + n.id + ')"></button>';
      html += '</div>';

      html += '<div class="cf-mask-card-desc">';
      var any = false;
      (n.inputs || []).forEach(function (inp) {
        if (inp.link !== null && inp.link !== undefined) {
          var srcLink = (workflow.links || []).find(function (l) { return l[0] === inp.link; });
          var srcNode = srcLink && nodeMap[srcLink[1]];
          if (srcNode) { html += '\u2190 from <code>' + esc(srcNode.type) + ' #' + srcNode.id + '</code><br>'; any = true; }
        }
      });
      (n.outputs || []).forEach(function (out) {
        (out.links || []).forEach(function (lid) {
          var tgtLink = (workflow.links || []).find(function (l) { return l[0] === lid; });
          var tgtNode = tgtLink && nodeMap[tgtLink[3]];
          if (tgtNode) { html += '\u2192 to <code>' + esc(tgtNode.type) + ' #' + tgtNode.id + '</code><br>'; any = true; }
        });
      });
      if (!any) html += '<span style="color:var(--gray)">No connections</span>';
      html += '</div>';

      if (n.widgets_values && n.widgets_values.length) {
        html += '<button class="cf-mask-card-expand" onclick="comfyuiToggleMaskExpand(' + n.id + ')">' +
          (isOpen ? 'Hide parameters \u25B4' : 'Edit parameters \u25BE') + '</button>';
        html += '<div class="cf-mask-card-body' + (isOpen ? ' open' : '') + '">' + buildWidgetFieldsHTML(n) + '</div>';
      }

      html += '</div></div>';
    });
    html += '</div>';
    html += '<div class="cf-test-result" id="cfMaskTestResult" style="display:none"></div>';

    container.innerHTML = html;
    renderMaskTestResult();
  }

  window.comfyuiToggleMaskBypass = function (nodeId) {
    if (!workflow) return;
    var node = workflow.nodes.find(function (n) { return n.id === nodeId; });
    if (!node) return;
    node.mode = (node.mode === 4) ? 0 : 4;
    renderMaskPipeline();
    renderGraph();
  };

  window.comfyuiToggleMaskExpand = function (nodeId) {
    if (expandedMaskCards.has(nodeId)) expandedMaskCards.delete(nodeId);
    else expandedMaskCards.add(nodeId);
    renderMaskPipeline();
  };

  function renderMaskTestResult() {
    var el = document.getElementById('cfMaskTestResult');
    if (!el) return;
    if (!lastMaskTestResult) { el.style.display = 'none'; return; }
    el.style.display = 'block';
    if (lastMaskTestResult.status === 'loading') {
      el.className = 'cf-test-result';
      el.innerHTML = '<span class="cf-test-spinner"></span>Sending mask chain for preview…';
    } else if (lastMaskTestResult.status === 'ok') {
      el.className = 'cf-test-result';
      el.innerHTML = esc(lastMaskTestResult.message) +
        (lastMaskTestResult.previewUrl ? '<img src="' + esc(lastMaskTestResult.previewUrl) + '">' : '');
    } else {
      el.className = 'cf-test-result error';
      el.innerHTML = esc(lastMaskTestResult.message);
    }
  }

  // Sends the isolated mask subgraph to the workspace backend for a live
  // preview render. This is a real request, wired to a placeholder endpoint
  // (mirrors comfyuiSaveWorkflow's pattern) — until that endpoint exists on
  // the Olivy backend / a ComfyUI instance is connected, it fails gracefully
  // with an honest message rather than pretending to have rendered anything.
  window.comfyuiTestMaskChain = function () {
    if (!workflow) return;
    var maskNodes = workflow.nodes.filter(isMaskNode);
    if (!maskNodes.length) return;
    var ids = new Set(maskNodes.map(function (n) { return n.id; }));
    var subLinks = (workflow.links || []).filter(function (l) { return ids.has(l[1]) && ids.has(l[3]); });

    lastMaskTestResult = { status: 'loading' };
    renderMaskTestResult();

    var api = (typeof API_BASE === 'string' && API_BASE) ? API_BASE.replace(/\/$/, '') : window.location.origin;
    fetch(api + '/api/workflows/test-mask-chain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nodes: maskNodes, links: subLinks })
    }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }).then(function (data) {
      lastMaskTestResult = { status: 'ok', message: data.message || 'Preview rendered.', previewUrl: data.previewUrl || null };
      renderMaskTestResult();
    }).catch(function () {
      lastMaskTestResult = {
        status: 'error',
        message: 'No live preview backend is connected yet. Connect a ComfyUI API endpoint to enable in-app testing of this mask chain — for now, export the workflow and run it directly in ComfyUI.'
      };
      renderMaskTestResult();
    });
  };

  // ── Import / Export / Save ─────────────────────────────────────────────
  window.comfyuiImportWorkflow = function () {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = function (e) {
      var file = e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function (ev) {
        try {
          var json = JSON.parse(ev.target.result);
          workflow = json;
          selectedNodeId = null;
          searchQuery = '';
          expandedMaskCards = new Set();
          lastMaskTestResult = null;
          scale = 0;      // triggers auto-fit on next render
          offset = null;  // triggers auto-center on next render
          var searchInput = document.getElementById('cfSearchInput');
          if (searchInput) searchInput.value = '';
          build();
          comfyuiSwitchPanel('editor');
          renderGraph();
        } catch (err) {
          alert('Invalid ComfyUI workflow JSON.');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  window.comfyuiExportWorkflow = function () {
    if (!workflow) return alert('No workflow loaded.');
    var blob = new Blob([JSON.stringify(workflow, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'workflow.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  window.comfyuiSaveWorkflow = function () {
    if (!workflow) return alert('No workflow loaded.');
    // Placeholder: send to Olivy backend (similar to chat endpoint)
    var api = (typeof API_BASE === 'string' && API_BASE) ? API_BASE.replace(/\/$/, '') : window.location.origin;
    fetch(api + '/api/workflows/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workflow: workflow, name: 'comfyui_workflow' }),
    }).then(function (res) {
      if (res.ok) alert('Workflow saved.');
      else alert('Save failed.');
    }).catch(function () { alert('Save failed.'); });
  };

  // ── Graph controls ─────────────────────────────────────────────────────
  function zoomAtCenter(factor) {
    var container = document.getElementById('cfGraphContainer');
    if (!container || !offset) { scale *= factor; renderGraph(); return; }
    var rect = container.getBoundingClientRect();
    var cx = rect.width / 2, cy = rect.height / 2;
    var graphX = (cx - offset.x) / scale, graphY = (cy - offset.y) / scale;
    scale = Math.max(0.05, Math.min(3, scale * factor));
    offset = { x: cx - graphX * scale, y: cy - graphY * scale };
    renderGraph();
  }
  window.comfyuiZoomIn = function () { zoomAtCenter(1.2); };
  window.comfyuiZoomOut = function () { zoomAtCenter(1 / 1.2); };
  window.comfyuiZoomFit = function () { scale = 0; offset = null; renderGraph(); };

  // ── View life cycle ────────────────────────────────────────────────────
  window.comfyuiShowView = function () {
    build();
    // Hide main chat / other views (mirrors craudio)
    var ids = ['chatHeader', 'welcomeState', 'chatLog', 'chatCompose', 'chatToolbar'];
    ids.forEach(function (id) {
      var el = document.getElementById(id); if (el) el.style.display = 'none';
    });
    var mc = document.querySelector('.main-content');
    if (mc) { mc._cfDisplay = mc.style.display; mc.style.display = 'none'; }
    var v = document.getElementById('comfyuiWorkflowView');
    if (v) v.classList.add('active');
    var ws = document.querySelector('.workspace');
    if (ws) ws.classList.add('cf-open');
    if (workflow) {
      renderGraph();
      if (activePanel === 'masks') renderMaskPipeline();
    }
  };

  window.comfyuiHideView = function () {
    var v = document.getElementById('comfyuiWorkflowView');
    if (v) v.classList.remove('active');
    var ws = document.querySelector('.workspace');
    if (ws) ws.classList.remove('cf-open');
    var mc = document.querySelector('.main-content');
    if (mc) { mc.style.display = mc._cfDisplay !== undefined ? mc._cfDisplay : ''; delete mc._cfDisplay; }
    var ids = ['chatHeader', 'welcomeState', 'chatLog', 'chatCompose', 'chatToolbar'];
    ids.forEach(function (id) {
      var el = document.getElementById(id); if (el) el.style.display = '';
    });
  };

  // Wrap sibling ShowView functions so they close us
  function wrapSiblings() {
    var names = ['violationsShowView', 'lawLibShowView', 'masterIndexShowView',
      'legalRouterShowView', 'spacesShowView', 'listeningShowView', 'studioShowView',
      'descobertaShowView', 'memoryShowView', 'shadersShowView', 'architectureShowView',
      'socialMediaShowView', 'craudioShowView', 'outreachShowView', 'resetToWelcome', 'aexToggleMain'];
    names.forEach(function (n) {
      var orig = window[n];
      if (typeof orig !== 'function' || orig._cfWrapped) return;
      var wrapped = function () {
        try { window.comfyuiHideView(); } catch (_e) { }
        return orig.apply(this, arguments);
      };
      wrapped._cfWrapped = true;
      window[n] = wrapped;
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wrapSiblings);
  } else {
    wrapSiblings();
  }

  // Helper
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
})();