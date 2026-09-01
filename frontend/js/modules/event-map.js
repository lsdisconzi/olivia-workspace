/* ============================================================================
   Event Map — create, structure and navigate a detailed map of events.
   Expanded to import transcripts, violations, and emails with full field support.
   ============================================================================ */
(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';

  // ── Helpers ──────────────────────────────────────────────────────────────
  function safeDate(value) {
    if (!value) return null;
    var d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  // ── File references (attachments + auto-detected file-like fields) ──────
  var FILE_EXT_KIND = {
    pdf: 'pdf',
    jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', webp: 'image', bmp: 'image', svg: 'image',
    eml: 'eml',
    txt: 'text', md: 'text', csv: 'text', log: 'text', json: 'text',
    html: 'html', htm: 'html',
    mp3: 'audio', wav: 'audio', m4a: 'audio', ogg: 'audio',
    mp4: 'video', mov: 'video', webm: 'video'
  };

  function fileExt(name) {
    var m = /\.([a-z0-9]+)$/i.exec(String(name || '').split('?')[0]);
    return m ? m[1].toLowerCase() : '';
  }

  function fileKind(name) {
    return FILE_EXT_KIND[fileExt(name)] || 'other';
  }

  function fileIconName(ref) {
    var kind = fileKind(ref.name || ref.path || ref.url || '');
    if (kind === 'pdf') return 'file-pdf';
    if (kind === 'image') return 'file-image';
    if (kind === 'eml') return 'envelope';
    if (kind === 'text') return 'file-lines';
    if (kind === 'html') return 'file-code';
    if (kind === 'audio') return 'file-audio';
    if (kind === 'video') return 'file-video';
    return 'file';
  }

  // Recognizes a plain string value that looks like a file path or URL with
  // a known extension, so any field anywhere (imported data, custom fields)
  // can offer a "View" affordance without needing an explicit attachment.
  function looksLikeFileRef(value) {
    if (typeof value !== 'string') return null;
    var v = value.trim();
    if (!v || v.length > 600) return null;
    var ext = fileExt(v);
    if (!ext || !FILE_EXT_KIND[ext]) return null;
    if (/^https?:\/\//i.test(v)) return { name: v.split('/').pop(), kind: 'url', url: v, ext: ext };
    if (/[\s<>"]/.test(v)) return null; // avoid matching prose that merely contains a dot-extension-like word
    return { name: v.split('/').pop(), kind: 'path', path: v, ext: ext };
  }

  function resolveFileSrc(fileRef) {
    if (fileRef.kind === 'upload') return Promise.resolve(fileRef.dataUrl);
    if (fileRef.kind === 'path') return Promise.resolve(sharedSourceUrl(fileRef.path));
    if (fileRef.kind === 'url') return Promise.resolve(fileRef.url);
    return Promise.reject(new Error('Unrecognized file reference'));
  }

  // ── Categories & Legend ──────────────────────────────────────────────────
  var EVENT_CATEGORIES = {
    'Transcript': '#4a9eff',
    'Violation': '#ff6b6b',
    'Email': '#4ecdc4',
    'Legal': '#4a9eff',
    'Medical': '#4ecdc4',
    'Financial': '#ff6b6b',
    'Communication': '#ffe66d',
    'Travel': '#a37eba',
    'Personal': '#f78b45',
    'Other': '#888888'
  };

  var RELATIONSHIP_TYPES = {
    'led to': '#4a9eff',
    'caused by': '#e76f51',
    'related to': '#888888',
    'documented by': '#4ecdc4',
    'involved': '#a37eba'
  };

  var LEGEND = Object.keys(EVENT_CATEGORIES).map(function (cat) {
    return { label: cat, color: EVENT_CATEGORIES[cat] };
  });

  // ── State ───────────────────────────────────────────────────────────────
  var built = false;
  var activePanel = 'map';
  var events = [];
  var links = [];
  var selectedEventId = null;
  var scale = 0.8;
  var offset = null;
  var searchQuery = '';
  var entityFilter = [];
  var visibleSources = {};
  var defaultVisibleFields = { title: true, date: true, description: true, tags: false };
  var visibleFieldsBySource = {};
  var fieldFilters = [];

  var dragNode = null;
  var resizeNode = null;
  var isPanning = false;
  var panStart = { x: 0, y: 0 };
  var panOrigin = { x: 0, y: 0 };
  var rafId = null;
  var linkMode = false;
  var linkSourceId = null;
  var selectedLinkId = null;

  // Flag to prevent duplicate document-level listeners for detail resize
  var detailResizeWired = false;
  // Shared resize state — lives outside wireDetailResize so re-rendered handles can access it
  var panelResizing = false;
  var panelStartX = 0;
  var panelStartWidth = 0;

  // ── Field expand state ────────────────────────────────────────────────
  // expandedFields[evId] = Set of field keys currently expanded in the sidebar
  var expandedFields = {};
  // The field key currently shown in the card-field popover (for toggle behaviour)
  var cardFieldPopoverState = null; // { evId, field }

  // ── SVG Icons ──────────────────────────────────────────────────────────
  var ICONS = {
    map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2 L22 7 L12 12 L2 7 Z"/><path d="M2 17 L12 22 L22 17"/><path d="M2 12 L12 17 L22 12"/></svg>',
    timeline: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="2" x2="12" y2="22"/><circle cx="12" cy="6" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="18" r="2"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="7" r="4"/><path d="M2 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M21 21v-2a4 4 0 0 0-3-3.87"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    export: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    import: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
    save: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'
  };

  // ── Build the view ─────────────────────────────────────────────────────
  function build() {
    var view = document.getElementById('eventMapView');
    if (!view || built) return;

    view.innerHTML =
      '<div class="em-head">' +
      '<div class="em-head-brand">' +
      '<span class="em-logo">' + ICONS.map + '</span>' +
      '<span class="em-title">Event Map</span>' +
      '<span class="em-sub">Chronology &amp; Case Builder</span>' +
      '</div>' +
      '<div class="em-head-actions">' +
      '<span class="em-head-stats" id="emHeadStats"></span>' +
      '<button class="btn btn-sm" onclick="eventMapNewMap()" title="Start a new event map">' + ICONS.plus + ' New</button>' +
      '<button class="btn btn-sm" onclick="eventMapImportEvents()" title="Import event map JSON (auto-detects format)">' + ICONS.import + ' Import</button>' +
      '<button class="btn btn-sm" onclick="eventMapExportEvents()" title="Download event map JSON">' + ICONS.export + ' Export</button>' +
      '<button class="btn btn-sm" onclick="eventMapSaveEvents()" title="Save to workspace">' + ICONS.save + ' Save</button>' +
      '<button class="btn btn-sm" onclick="eventMapHideView()" title="Close">' +
      '<i class="fas fa-times"></i>' +
      '</button>' +
      '</div>' +
      '</div>' +
      '<div class="em-subnav">' +
      '<button class="em-tab active" data-panel="map" onclick="eventMapSwitchPanel(\'map\')">' + ICONS.map + ' Map</button>' +
      '<button class="em-tab" data-panel="timeline" onclick="eventMapSwitchPanel(\'timeline\')">' + ICONS.timeline + ' Timeline</button>' +
      '<button class="em-tab" data-panel="entities" onclick="eventMapSwitchPanel(\'entities\')">' + ICONS.users + ' Entities</button>' +
      '<button class="em-tab em-toggle-btn" id="emToggleLegend" onclick="eventMapToggleLegend()" title="Show/hide legend"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="3" y="14" width="7" height="7" rx="1"></rect><rect x="14" y="14" width="7" height="7" rx="1"></rect></svg></button>' +
      '<button class="em-tab em-toggle-btn" id="emToggleSidebar" onclick="eventMapToggleSidebar()" title="Show/hide detail sidebar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"></rect><line x1="15" y1="3" x2="15" y2="21"></line></svg></button>' +
      '<div class="em-subnav-spacer"></div>' +
      '<div class="em-search-wrap">' +
      '<span class="em-search-icon">' + ICONS.search + '</span>' +
      '<input type="text" class="em-search-input" id="emSearchInput" placeholder="Search events…" oninput="eventMapSearchEvents(this.value)">' +
      '</div>' +
      '<span class="em-search-count" id="emSearchCount"></span>' +
      '<button class="btn btn-sm em-filter-toggle" type="button" onclick="eventMapToggleFilters()" title="Filter visible sources and fields"><i class="fas fa-filter"></i> Filters</button>' +
      '</div>' +
      '<div class="em-filter-panel" id="emFilterPanel" hidden></div>' +
      '<div class="em-panels">' +
      '<div id="emPanel-map" class="em-panel active">' +
      '<div class="em-editor-layout">' +
      '<div class="em-graph-container" id="emGraphContainer">' +
      '<div class="em-graph-controls">' +
      '<button class="btn btn-sm" onclick="eventMapZoomIn()" title="Zoom in"><i class="fas fa-plus"></i></button>' +
      '<button class="btn btn-sm" onclick="eventMapZoomOut()" title="Zoom out"><i class="fas fa-minus"></i></button>' +
      '<button class="btn btn-sm" onclick="eventMapZoomFit()" title="Fit to view"><i class="fas fa-expand"></i></button>' +
      '<button class="btn btn-sm" onclick="eventMapArrangeNodes()" title="Arrange nodes"><i class="fas fa-table-cells"></i></button>' +
      '<button class="btn btn-sm" onclick="eventMapAddEvent()" title="Add event"><i class="fas fa-plus"></i> Add</button>' +
      '<button class="btn btn-sm em-link-mode-btn" id="emLinkModeBtn" onclick="eventMapToggleLinkMode()" title="Add or remove arrows between nodes"><i class="fas fa-project-diagram"></i> Link</button>' +
      '</div>' +
      '<div class="em-legend" id="emLegend"></div>' +
      '<svg id="emGraphSvg" class="em-graph-svg"></svg>' +
      '<span class="em-zoom-readout" id="emZoomReadout">80%</span>' +
      '</div>' +
      '<div class="em-detail-panel" id="emDetailPanel">' +
      '<div class="em-detail-resize" id="emDetailResize" title="Drag to resize"></div>' +
      '<div class="em-detail-placeholder">Click an event to inspect and edit details. Drag nodes to move them, drag empty canvas to pan, scroll to zoom.</div>' +
      '</div>' +
      '</div>' +
      '</div>' +
      '<div id="emPanel-timeline" class="em-panel">' +
      '<div class="em-timeline-list" id="emTimelineList"></div>' +
      '</div>' +
      '<div id="emPanel-entities" class="em-panel">' +
      '<div class="em-entities-list" id="emEntitiesList"></div>' +
      '</div>' +
      '</div>';

    built = true;
    loadState();
    loadExpandedFields();
    restoreViewToggles();
    renderLegend();
    renderFilters();
    wireCanvasInteractions();
    renderGraph();
    renderTimeline();
    renderEntities();
  }

  function restoreViewToggles() {
    var legendHidden = false, sidebarHidden = false;
    try {
      legendHidden = localStorage.getItem('olivia.eventMap.legendHidden') === '1';
      sidebarHidden = localStorage.getItem('olivia.eventMap.sidebarHidden') === '1';
    } catch (e) { }
    var legend = document.getElementById('emLegend');
    if (legend && legendHidden) legend.classList.add('is-hidden');
    var panel = document.getElementById('emDetailPanel');
    if (panel && sidebarHidden) panel.classList.add('is-hidden');
    var lb = document.getElementById('emToggleLegend');
    if (lb) lb.classList.toggle('active', !legendHidden);
    var sb = document.getElementById('emToggleSidebar');
    if (sb) sb.classList.toggle('active', !sidebarHidden);
  }

  function renderLegend() {
    var el = document.getElementById('emLegend');
    if (!el) return;
    var items = Object.keys(EVENT_CATEGORIES).map(function (cat) {
      return '<div class="em-legend-item"><span class="em-legend-swatch" style="background:' + EVENT_CATEGORIES[cat] + '"></span>' + cat + '</div>';
    }).join('');
    el.innerHTML = items +
      '<div class="em-legend-item em-legend-actions">' +
      '<button class="em-legend-more" onclick="eventMapToggleLegendConfig(event)" title="Configure category colors"><i class="fas fa-ellipsis-h"></i></button>' +
      '</div>' +
      '<div class="em-legend-config" id="emLegendConfig" style="display:none"></div>';
  }

  function detachResizeHandle(panel) {
    var handle = panel.querySelector('.em-detail-resize');
    if (handle) panel.removeChild(handle);
    return handle;
  }

  function reattachResizeHandle(panel, handle) {
    if (handle && !panel.contains(handle)) {
      panel.insertBefore(handle, panel.firstChild);
    }
  }

  window.eventMapToggleLegendConfig = function (e) {
    if (e && e.stopPropagation) e.stopPropagation();
    var cfg = document.getElementById('emLegendConfig');
    if (!cfg) return;
    if (cfg.style.display === 'block') {
      cfg.style.display = 'none';
      return;
    }
    var html = '<div class="em-legend-config-title">Category colors</div>';
    Object.keys(EVENT_CATEGORIES).forEach(function (cat) {
      html += '<div class="em-legend-config-row">' +
        '<span class="em-legend-config-name">' + cat + '</span>' +
        '<input type="color" class="em-legend-config-color" value="' + EVENT_CATEGORIES[cat] + '" onchange="eventMapSetCategoryColor(\'' + cat.replace(/'/g, '\\\'') + '\', this.value)">' +
        '</div>';
    });
    cfg.innerHTML = html;
    cfg.style.display = 'block';
  };

  window.eventMapSetCategoryColor = function (cat, color) {
    if (EVENT_CATEGORIES[cat]) EVENT_CATEGORIES[cat] = color;
    renderLegend();
    renderGraph();
    persistState();
  };

  function sourceKey(ev) {
    return ev.source_type || String(ev.category || 'other').toLowerCase();
  }

  function sourceLabel(key) {
    return key === 'violation' ? 'Violations' : key === 'transcript' ? 'Transcripts' : key === 'email' ? 'Emails' : key;
  }

  function availableSourceKeys() {
    var keys = [];
    events.forEach(function (ev) {
      var key = sourceKey(ev);
      if (keys.indexOf(key) === -1) keys.push(key);
    });
    return keys.sort();
  }

  function availableFieldKeys(source) {
    var paths = [];
    function visit(value, prefix, depth) {
      if (depth > 4 || value === null || value === undefined) return;
      if (Array.isArray(value)) {
        value.forEach(function (item) { visit(item, prefix ? prefix + '[]' : '[]', depth + 1); });
        return;
      }
      if (typeof value !== 'object') return;
      Object.keys(value).forEach(function (key) {
        var path = prefix ? prefix + '.' + key : key;
        if (['id', 'Id', 'ID', 'x', 'y', 'links', 'width', 'height'].indexOf(key) === -1 && paths.indexOf(path) === -1) paths.push(path);
        if (value[key] && typeof value[key] === 'object') visit(value[key], path, depth + 1);
      });
    }
    events.filter(function (ev) { return !source || sourceKey(ev) === source; }).forEach(function (ev) { visit(ev, '', 0); });
    return paths.sort();
  }

  function fieldLabel(key) {
    return key.replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  function isDateField(field) {
    return /(^|[_.])(date|datetime|timestamp|time)(_|$)/i.test(field) || /(_date|_utc|_at)$/i.test(field);
  }

  function fieldFilterOptions(field) {
    return isDateField(field)
      ? '<option value="on">on date</option><option value="before">before date</option><option value="after">after date</option>'
      : '<option value="contains">contains</option><option value="exact">is exactly</option>';
  }

  function fieldsForSource(source) {
    if (!visibleFieldsBySource[source]) visibleFieldsBySource[source] = Object.assign({}, defaultVisibleFields);
    return visibleFieldsBySource[source];
  }

  function fieldIsVisible(ev, field) {
    var fields = fieldsForSource(sourceKey(ev));
    return fields[field] !== false && !(ev.hiddenFields && ev.hiddenFields[field] === true);
  }

  function nodeIsVisible(ev) {
    return ev.hidden !== true;
  }
  function fieldVisibilityButton(ev, field) {
    var visible = fieldIsVisible(ev, field);
    return '<button type="button" class="em-field-visibility ' + (visible ? '' : 'is-hidden') + '" data-field-value="' +
      encodeURIComponent(field) + '" data-event-id="' + ev.id + '" title="' + (visible ? 'Hide field on card' : 'Show field on card') + '">' + ICONS.eye + '</button>';
  }

  function renderFilters() {
    var panel = document.getElementById('emFilterPanel');
    if (!panel) return;
    var toggle = document.querySelector('.em-filter-toggle');
    var hiddenSourceCount = Object.keys(visibleSources).filter(function (key) { return visibleSources[key] === false; }).length;
    var activeFilterCount = hiddenSourceCount + fieldFilters.length;
    if (toggle) {
      toggle.innerHTML = '<i class="fas fa-filter"></i> Filters' + (activeFilterCount ? ' (' + activeFilterCount + ')' : '');
      toggle.classList.toggle('active', activeFilterCount > 0);
    }
    var sources = availableSourceKeys();
    sources.forEach(function (key) {
      if (visibleSources[key] === undefined) visibleSources[key] = true;
    });
    var sourceGroupsHtml = sources.map(function (source) {
      var fields = fieldsForSource(source);
      var fieldHtml = availableFieldKeys(source).map(function (key) {
        if (['id', 'x', 'y', 'links', 'width', 'height'].indexOf(key) !== -1) return '';
        return '<label class="em-filter-check"><input type="checkbox" data-filter-field="' + esc(key) + '" data-filter-field-source="' + esc(source) + '"' +
          (fields[key] ? ' checked' : '') + '> <span>' + esc(fieldLabel(key)) + '</span></label>';
      }).join('');
      var sourceRules = fieldFilters.filter(function (rule) { return rule.source === source; });
      var sourceRuleHtml = sourceRules.map(function (rule) {
        var ruleIndex = fieldFilters.indexOf(rule);
        var operatorLabel = rule.operator === 'exact' ? '=' : rule.operator === 'on' ? 'on' : rule.operator;
        return '<span class="em-filter-rule">' + esc(fieldLabel(rule.field)) + ' ' + esc(operatorLabel) + ' "' + esc(rule.value) + '"' +
          '<button type="button" data-remove-field-filter="' + ruleIndex + '" title="Remove filter"><i class="fas fa-times"></i></button></span>';
      }).join('');
      var sourceFields = availableFieldKeys(source);
      return '<details class="em-filter-source-group" open><summary class="em-filter-source-head"><label class="em-filter-check"><input type="checkbox" data-filter-source="' + esc(source) + '"' +
        (visibleSources[source] ? ' checked' : '') + '> <strong>' + esc(sourceLabel(source)) + '</strong></label><small>' + events.filter(function (ev) { return sourceKey(ev) === source; }).length + ' records</small></summary>' +
        '<details class="em-filter-advanced"><summary>Advanced Filters</summary>' +
        '<div class="em-filter-source-fields"><div class="em-filter-title">Visible fields on cards</div>' + fieldHtml +
        '<div class="em-filter-title em-filter-rule-title">Filter fields in ' + esc(sourceLabel(source)) + '</div>' +
        '<div class="em-filter-rule-editor" data-rule-source="' + esc(source) + '"><select class="em-filter-select" data-rule-field>' +
        sourceFields.map(function (key) { return '<option value="' + esc(key) + '">' + esc(fieldLabel(key)) + '</option>'; }).join('') +
        '</select><select class="em-filter-select" data-rule-operator>' + fieldFilterOptions(sourceFields[0] || '') + '</select>' +
        '<input class="em-filter-input" data-rule-value type="text" placeholder="value, ID, status, text...">' +
        '<button class="btn btn-sm" type="button" data-add-source-rule title="Add filter for this source"><i class="fas fa-plus"></i> Add</button></div>' +
        '<div class="em-filter-rules" data-source-rules="' + esc(source) + '">' + (sourceRuleHtml || '<span class="em-filter-empty">No filters for this source</span>') + '</div>' +
        '</div></details></details>';
    }).join('');
    panel.innerHTML = '<div class="em-filter-head"><strong>Map visibility</strong>' +
      '<button class="btn btn-sm" type="button" onclick="eventMapResetFilters()">Reset</button></div>' +
      '<div class="em-filter-note">Source toggles hide records. Field visibility and value rules are available under Advanced Filters.</div>' +
      '<div class="em-filter-source-groups">' + sourceGroupsHtml + '</div>';
    panel.querySelectorAll('[data-filter-source]').forEach(function (input) {
      input.addEventListener('change', function () {
        visibleSources[input.getAttribute('data-filter-source')] = input.checked;
        renderGraph(); renderTimeline();
        persistState();
      });
    });
    panel.querySelectorAll('[data-filter-field]').forEach(function (input) {
      input.addEventListener('change', function () {
        var source = input.getAttribute('data-filter-field-source');
        fieldsForSource(source)[input.getAttribute('data-filter-field')] = input.checked;
        renderGraph();
        persistState();
      });
    });
    panel.querySelectorAll('[data-rule-source]').forEach(function (editor) {
      var fieldSelect = editor.querySelector('[data-rule-field]');
      var operatorSelect = editor.querySelector('[data-rule-operator]');
      var valueInput = editor.querySelector('[data-rule-value]');
      var addButton = editor.querySelector('[data-add-source-rule]');
      if (!fieldSelect || !operatorSelect || !valueInput || !addButton) return;
      var syncFieldInput = function () {
        operatorSelect.innerHTML = fieldFilterOptions(fieldSelect.value);
        var dateMode = isDateField(fieldSelect.value);
        valueInput.type = dateMode ? 'date' : 'text';
        valueInput.placeholder = dateMode ? 'YYYY-MM-DD' : 'value, ID, status, text...';
      };
      fieldSelect.addEventListener('change', function () {
        syncFieldInput();
      });
      syncFieldInput();
      valueInput.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
          event.preventDefault();
          addButton.click();
        }
      });
      addButton.addEventListener('click', function () {
        var field = fieldSelect.value;
        var value = valueInput.value.trim();
        var operator = operatorSelect.value;
        var source = editor.getAttribute('data-rule-source');
        if (!field || !value || !source) return;
        fieldFilters.push({ source: source, field: field, value: value, operator: operator });
        renderFilters(); renderGraph(); renderTimeline(); persistState();
      });
    });
    panel.querySelectorAll('[data-remove-field-filter]').forEach(function (button) {
      button.addEventListener('click', function () {
        fieldFilters.splice(Number(button.getAttribute('data-remove-field-filter')), 1);
        renderFilters(); renderGraph(); renderTimeline(); persistState();
      });
    });
  }

  window.eventMapToggleFilters = function () {
    var panel = document.getElementById('emFilterPanel');
    if (panel) panel.hidden = !panel.hidden;
  };

  // ── Legend / sidebar visibility toggles ────────────────────────────────
  window.eventMapToggleLegend = function () {
    var legend = document.getElementById('emLegend');
    if (!legend) return;
    var hidden = legend.classList.toggle('is-hidden');
    var btn = document.getElementById('emToggleLegend');
    if (btn) btn.classList.toggle('active', !hidden);
    try { localStorage.setItem('olivia.eventMap.legendHidden', hidden ? '1' : '0'); } catch (e) { }
  };

  window.eventMapToggleSidebar = function () {
    var panel = document.getElementById('emDetailPanel');
    if (!panel) return;
    var hidden = panel.classList.toggle('is-hidden');
    var btn = document.getElementById('emToggleSidebar');
    if (btn) btn.classList.toggle('active', !hidden);
    try { localStorage.setItem('olivia.eventMap.sidebarHidden', hidden ? '1' : '0'); } catch (e) { }
  };

  window.eventMapResetFilters = function () {
    visibleSources = {};
    fieldFilters = [];
    visibleFieldsBySource = {};
    renderFilters();
    renderGraph();
    renderTimeline();
    persistState();
  };

  // ── Panel switching ────────────────────────────────────────────────────
  window.eventMapSwitchPanel = function (name) {
    activePanel = name;
    ['map', 'timeline', 'entities'].forEach(function (p) {
      var panel = document.getElementById('emPanel-' + p);
      if (panel) panel.classList.toggle('active', p === name);
    });
    var tabs = document.querySelectorAll('#eventMapView .em-tab');
    tabs.forEach(function (t) {
      t.classList.toggle('active', t.getAttribute('data-panel') === name);
    });
    if (name === 'timeline') renderTimeline();
    if (name === 'entities') renderEntities();
  };

  // ── Search / Filter ────────────────────────────────────────────────────
  // FIX #11: Improved performance by avoiding JSON.stringify
  function matchesSearch(ev) {
    if (!searchQuery) return true;
    var hay = (
      (ev.title || '') + ' ' +
      (ev.description || '') + ' ' +
      (ev.summary || '') + ' ' +
      (ev.category || '') + ' ' +
      (ev.status || '') + ' ' +
      (ev.transcript_id || '') + ' ' +
      (ev.violation_id || '') + ' ' +
      (ev.subject || '') + ' ' +
      (ev.entities || []).join(' ') + ' ' +
      (ev.tags || []).join(' ')
    ).toLowerCase();
    return hay.indexOf(searchQuery) !== -1;
  }

  function matchesEntityFilter(ev) {
    if (!entityFilter || entityFilter.length === 0) return true;
    var entities = ev.entities || [];
    if (ev.participants) {
      ev.participants.forEach(function (p) {
        if (p.canonical_name) entities.push(p.canonical_name);
        if (p.speaker_label) entities.push(p.speaker_label);
      });
    }
    // Check if event has AT LEAST ONE of the filtered entities
    return entityFilter.some(function(ef) { return entities.indexOf(ef) !== -1; });
  }

  function fieldValues(value, parts, index) {
    if (index >= parts.length) return [value];
    if (value === null || value === undefined) return [];
    var part = parts[index];
    if (part === '[]') {
      return Array.isArray(value) ? value.reduce(function (all, item) {
        return all.concat(fieldValues(item, parts, index + 1));
      }, []) : [];
    }
    if (part.slice(-2) === '[]') {
      var key = part.slice(0, -2);
      return Array.isArray(value[key]) ? value[key].reduce(function (all, item) {
        return all.concat(fieldValues(item, parts, index + 1));
      }, []) : [];
    }
    return fieldValues(value[part], parts, index + 1);
  }

  function matchesFieldFilters(ev) {
    return fieldFilters.filter(function (rule) {
      return !rule.source || rule.source === sourceKey(ev);
    }).every(function (rule) {
      var values = fieldValues(ev, rule.field.split('.'), 0);
      var expected = rule.value.toLowerCase();
      return values.some(function (value) {
        var actual = value !== null && value !== undefined ? String(value).toLowerCase() : '';
        if (isDateField(rule.field) && rule.operator !== 'contains' && rule.operator !== 'exact') {
          var actualDate = actual.slice(0, 10);
          if (rule.operator === 'on') return actualDate === expected;
          if (rule.operator === 'before') return actualDate < expected;
          if (rule.operator === 'after') return actualDate > expected;
        }
        return rule.operator === 'exact' ? actual === expected : actual.indexOf(expected) !== -1;
      });
    });
  }

  function isVisibleEvent(ev) {
    return nodeIsVisible(ev) && visibleSources[sourceKey(ev)] !== false && matchesSearch(ev) && matchesEntityFilter(ev) && matchesFieldFilters(ev);
  }

  window.eventMapSearchEvents = function (q) {
    searchQuery = (q || '').trim().toLowerCase();
    renderGraph();
    renderTimeline();
    var countEl = document.getElementById('emSearchCount');
    if (!countEl) return;
    if (!searchQuery) { countEl.textContent = ''; return; }
    var n = events.filter(isVisibleEvent).length;
    countEl.textContent = n + ' match' + (n === 1 ? '' : 'es');
  };

  // ── Canvas interactions ────────────────────────────────────────────────
  function scheduleRender() {
    if (rafId) return;
    rafId = requestAnimationFrame(function () { rafId = null; renderGraph(); });
  }

  function wireCanvasInteractions() {
    var container = document.getElementById('emGraphContainer');
    if (!container) return;

    container.addEventListener('mousedown', function (e) {
      if (e.button !== 0 || !events.length) return;
      isPanning = true;
      panStart = { x: e.clientX, y: e.clientY };
      panOrigin = { x: (offset && offset.x) || 0, y: (offset && offset.y) || 0 };
      container.classList.add('panning');
    });

    container.addEventListener('wheel', function (e) {
      if (!events.length) return;
      e.preventDefault();
      var rect = container.getBoundingClientRect();
      var mx = e.clientX - rect.left, my = e.clientY - rect.top;
      var o = offset || { x: 0, y: 0 };
      var graphX = (mx - o.x) / scale, graphY = (my - o.y) / scale;
      var factor = e.deltaY < 0 ? 1.1 : 0.9;
      scale = Math.max(0.1, Math.min(3, scale * factor));
      offset = { x: mx - graphX * scale, y: my - graphY * scale };
      renderGraph();
    }, { passive: false });

    document.addEventListener('mousemove', function (e) {
      if (resizeNode) {
        var resizedEvent = events.find(function (node) { return node.id === resizeNode.id; });
        if (resizedEvent) {
          resizedEvent.width = Math.max(160, resizeNode.origWidth + (e.clientX - resizeNode.startClientX) / scale);
          resizedEvent.height = Math.max(84, resizeNode.origHeight + (e.clientY - resizeNode.startClientY) / scale);
          scheduleRender();
        }
      } else if (dragNode) {
        var dx = (e.clientX - dragNode.startClientX) / scale;
        var dy = (e.clientY - dragNode.startClientY) / scale;
        var ev = events.find(function (n) { return n.id === dragNode.id; });
        if (ev) {
          ev.x = dragNode.origX + dx;
          ev.y = dragNode.origY + dy;
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
      if (resizeNode) {
        resizeNode = null;
        renderGraph();
        persistState();
      } else if (dragNode) {
        var nodeId = dragNode.id;
        var dx = e.clientX - dragNode.startClientX;
        var dy = e.clientY - dragNode.startClientY;
        dragNode = null;
        if (Math.abs(dx) + Math.abs(dy) < 4) {
          selectEvent(nodeId);
        } else {
          renderGraph();
          persistState();
        }
      }
      if (isPanning) {
        isPanning = false;
        container.classList.remove('panning');
        var moved = Math.abs(e.clientX - panStart.x) + Math.abs(e.clientY - panStart.y);
        if (moved < 4 && (selectedEventId !== null || selectedLinkId !== null)) {
          selectedEventId = null;
          selectedLinkId = null;
          renderGraph();
          renderEventDetail(null);
        }
      }
    });

    document.addEventListener('keydown', function (e) {
      var view = document.getElementById('eventMapView');
      if (!view || !view.classList.contains('active') || activePanel !== 'map') return;
      var tag = (e.target && e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedEventId !== null) {
        e.preventDefault();
        window.eventMapDeleteEvent(selectedEventId);
      }
      if (e.key === 'Escape') {
        closeNodeEditor();
        closeContextMenu();
        closeFieldValuePopover();
      }
    });

    // ── Right-click context menu ──────────────────────────────────────────
    container.addEventListener('contextmenu', function (e) {
      var nodeGroup = e.target && e.target.closest ? e.target.closest('.em-node-group') : null;
      if (nodeGroup) {
        var id = Number(nodeGroup.getAttribute('data-node-id'));
        showContextMenu(e.clientX, e.clientY, [
          { label: 'Edit event', action: function () { window.eventMapShowNodeEditor(id); } },
          { label: 'Duplicate', action: function () { window.eventMapDuplicateEvent(id); } },
          { label: 'Delete', action: function () { window.eventMapDeleteEvent(id); } },
          { separator: true },
          { label: 'Add arrow from here', action: function () { window.eventMapStartLinkFrom(id); } },
          { label: 'Add field', action: function () { window.eventMapAddField(id); } }
        ]);
      } else {
        showContextMenu(e.clientX, e.clientY, [
          { label: 'Add event', action: window.eventMapAddEvent },
          { label: 'Paste', disabled: true }
        ]);
      }
    });

    // ── Detail panel horizontal resize ────────────────────────────────────
    var resizeHandle = document.getElementById('emDetailResize');
    var detailPanel = document.getElementById('emDetailPanel');
    if (resizeHandle && detailPanel) wireDetailResize(resizeHandle, detailPanel);
  }

  // Attaches the one-time document-level mousemove/mouseup listeners for panel resize.
  // Called once; subsequent calls are no-ops.
  function wireDetailResizeDocListeners(detailPanel) {
    if (detailResizeWired) return;
    detailResizeWired = true;

    document.addEventListener('mousemove', function (e) {
      if (!panelResizing) return;
      var delta = panelStartX - e.clientX;
      var newWidth = Math.max(240, Math.min(640, panelStartWidth + delta));
      detailPanel.style.width = newWidth + 'px';
    });

    document.addEventListener('mouseup', function () {
      if (!panelResizing) return;
      panelResizing = false;
      detailPanel.classList.remove('is-resizing');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      persistState();
    });
  }

  // Wires the mousedown listener to a (possibly freshly created) resize handle element.
  // Safe to call every time the handle is re-inserted into the DOM.
  function wireDetailResize(resizeHandle, detailPanel) {
    // Attach document listeners once
    wireDetailResizeDocListeners(detailPanel);

    // Always attach mousedown to the current handle element so re-rendered
    // panels don't lose their drag affordance.
    resizeHandle.addEventListener('mousedown', function (e) {
      e.preventDefault();
      e.stopPropagation();
      panelResizing = true;
      panelStartX = e.clientX;
      panelStartWidth = detailPanel.getBoundingClientRect().width;
      detailPanel.classList.add('is-resizing');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    });
  }

  // ── Graph rendering ────────────────────────────────────────────────────
  var NODE_WIDTH = 240;
  var NODE_HEIGHT = 120;
  var NODE_GAP_X = 34;
  var NODE_GAP_Y = 24;

  function nodeWidth(ev) { return Number(ev.width) >= 160 ? Number(ev.width) : NODE_WIDTH; }

  function cardFieldEntries(ev) {
    var standard = ['title', 'date', 'description', 'summary', 'category', 'status', 'entities', 'tags'];
    return availableFieldKeys(sourceKey(ev)).filter(function (field) {
      if (standard.indexOf(field) !== -1) return false;
      if (!fieldIsVisible(ev, field)) return false;
      var values = fieldValues(ev, field.split('.'), 0);
      // Skip fields where all values are null/undefined/empty strings
      return values.some(function (v) {
        return v !== null && v !== undefined && String(v).trim() !== '';
      });
    }).map(function (field) {
      var values = fieldValues(ev, field.split('.'), 0);
      return {
        field: field, value: values.map(function (value) {
          if (value && typeof value === 'object') return JSON.stringify(value);
          if (typeof value === 'boolean') return value ? 'yes' : 'no';
          return String(value == null ? '' : value);
        }).join(', ')
      };
    });
  }

  function nodeHeight(ev) {
    if (Number(ev.height) >= 84) return Number(ev.height);
    var extraFields = cardFieldEntries(ev).length;
    return Math.max(NODE_HEIGHT, 120 + extraFields * 18);
  }

  function eventDateValue(ev) {
    var raw = ev.date || ev.recording_datetime || ev.incident_date || ev.date_utc || '';
    var value = Date.parse(raw);
    return Number.isNaN(value) ? Number.MAX_SAFE_INTEGER : value;
  }

  function arrangeEvents() {
    var groups = ['Violation', 'Transcript', 'Email', 'Other'];
    var grouped = {};
    groups.forEach(function (group) { grouped[group] = []; });
    events.filter(isVisibleEvent).forEach(function (ev) {
      var group = groups.indexOf(ev.category) !== -1 ? ev.category : 'Other';
      if (!grouped[group]) grouped[group] = [];
      grouped[group].push(ev);
    });
    var activeGroups = Object.keys(grouped).filter(function (group) { return grouped[group].length; });
    var laneGap = Math.max(NODE_WIDTH + NODE_GAP_X, 300);
    activeGroups.forEach(function (group, laneIndex) {
      grouped[group].sort(function (a, b) {
        return eventDateValue(a) - eventDateValue(b) || a.id - b.id;
      });
      var laneY = 62;
      grouped[group].forEach(function (ev) {
        ev.x = 40 + laneIndex * laneGap;
        ev.y = laneY;
        laneY += nodeHeight(ev) + NODE_GAP_Y;
      });
    });
    deriveLinks(grouped);
    offset = null;
    renderGraph();
  }

  window.eventMapArrangeNodes = arrangeEvents;

  function deriveLinks(grouped) {
    var derived = [];
    var seen = {};
    function add(source, target, type) {
      if (!source || !target || source.id === target.id) return;
      var key = source.id + ':' + target.id;
      if (seen[key]) return;
      seen[key] = true;
      derived.push({ id: 'derived-' + derived.length, source: source.id, target: target.id, type: type });
    }
    var violations = grouped.Violation || [];
    var transcripts = grouped.Transcript || [];
    var emails = grouped.Email || [];
    transcripts.forEach(function (transcript, index) {
      if (index > 0) add(transcripts[index - 1], transcript, 'related to');
      var ref = String(transcript.audio_ref || '').match(/[A-Z]+-?\d+/i);
      if (ref) {
        violations.forEach(function (violation) {
          var haystack = JSON.stringify(violation).toLowerCase();
          if (haystack.indexOf(ref[0].toLowerCase()) !== -1) add(transcript, violation, 'documented by');
        });
      }
    });
    emails.forEach(function (email) {
      var mapped = String(email.mapped_event_id || '');
      if (!mapped) return;
      events.forEach(function (target) {
        if (String(target.id) === mapped || String(target.event_id || '') === mapped || String(target.violation_id || '') === mapped) {
          add(email, target, 'documented by');
        }
      });
    });
    links = derived;
  }

  // FIX #10: Scale-aware character wrapping using explicit pixel widths
  function appendWrappedText(parent, value, x, y, maxWidthPx, lineHeight, maxLines, className, fontSize, color) {
    var charWidth = fontSize * 0.6; // approx for monospace
    var adjustedMaxChars = Math.max(5, Math.floor(maxWidthPx / charWidth));
    var text = document.createElementNS(NS, 'text');
    text.setAttribute('x', x);
    text.setAttribute('y', y);
    text.setAttribute('font-size', fontSize);
    text.setAttribute('fill', color);
    text.setAttribute('font-family', 'var(--mono)');
    if (className) text.setAttribute('class', className);
    var words = String(value || '').split(/\s+/);
    var lines = [];
    var line = '';
    words.forEach(function (word) {
      var candidate = line ? line + ' ' + word : word;
      if (line && candidate.length > adjustedMaxChars) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    });
    if (line) lines.push(line);
    if (!lines.length) lines.push('');
    if (lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      lines[maxLines - 1] = lines[maxLines - 1].replace(/[.,;:!?]?$/, '') + '…';
    }
    lines.forEach(function (lineText, index) {
      var tspan = document.createElementNS(NS, 'tspan');
      tspan.setAttribute('x', x);
      tspan.setAttribute('dy', index === 0 ? 0 : lineHeight);
      tspan.textContent = lineText;
      text.appendChild(tspan);
    });
    parent.appendChild(text);
  }

  // Counts explicit uploads ({ name, type, dataUrl }) plus string values that
  // look like a file path/URL with a known extension.
  function countFileAttachments(ev) {
    var count = 0;
    for (var key in ev) {
      if (['id', 'x', 'y', 'links', 'width', 'height'].indexOf(key) !== -1) continue;
      var v = ev[key];
      if (v && typeof v === 'object' && v.dataUrl) count++;
      else if (typeof v === 'string' && looksLikeFileRef(v)) count++;
    }
    return count;
  }

  function renderGraph() {
    var statsEl = document.getElementById('emHeadStats');
    var visibleEvents = events.filter(isVisibleEvent);
    var visibleIds = {};
    visibleEvents.forEach(function (ev) { visibleIds[ev.id] = true; });
    var visibleLinks = links.filter(function (link) {
      return visibleIds[link.source] && visibleIds[link.target];
    });
    if (statsEl) statsEl.textContent = visibleEvents.length + '/' + events.length + ' events · ' + visibleLinks.length + ' links';

    if (!visibleEvents.length) {
      var svg = document.getElementById('emGraphSvg');
      if (svg) svg.innerHTML = '';
      return;
    }
    var svg = document.getElementById('emGraphSvg');
    var container = document.getElementById('emGraphContainer');
    if (!svg || !container) return;

    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    visibleEvents.forEach(function (ev) {
      var x = ev.x || 0, y = ev.y || 0;
      var w = nodeWidth(ev), h = nodeHeight(ev);
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x + w > maxX) maxX = x + w;
      if (y + h > maxY) maxY = y + h;
    });
    var graphW = maxX - minX + 40;
    var graphH = maxY - minY + 40;
    var containerW = container.clientWidth;
    var containerH = container.clientHeight;

    if (!offset) offset = { x: -minX * scale + 20, y: -minY * scale + 20 };

    svg.setAttribute('width', containerW);
    svg.setAttribute('height', containerH);
    svg.innerHTML = '';

    var defs = document.createElementNS(NS, 'defs');
    Object.keys(RELATIONSHIP_TYPES).forEach(function (rel) {
      var marker = document.createElementNS(NS, 'marker');
      marker.setAttribute('id', 'em-arrow-' + rel.replace(/\s/g, '_'));
      marker.setAttribute('viewBox', '0 0 10 10');
      marker.setAttribute('refX', '8');
      marker.setAttribute('refY', '5');
      marker.setAttribute('markerWidth', '7');
      marker.setAttribute('markerHeight', '7');
      marker.setAttribute('orient', 'auto-start-reverse');
      var path = document.createElementNS(NS, 'path');
      path.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
      path.setAttribute('fill', RELATIONSHIP_TYPES[rel] || '#888');
      marker.appendChild(path);
      defs.appendChild(marker);
    });
    svg.appendChild(defs);

    var laneLabels = {};
    visibleEvents.forEach(function (ev) {
      var label = ev.category || 'Other';
      if (laneLabels[label]) return;
      laneLabels[label] = true;
      var laneTitle = document.createElementNS(NS, 'text');
      laneTitle.setAttribute('x', (ev.x || 0) * scale + offset.x);
      laneTitle.setAttribute('y', (ev.y || 0) * scale + offset.y - 22 * scale);
      laneTitle.setAttribute('fill', EVENT_CATEGORIES[label] || EVENT_CATEGORIES.Other);
      laneTitle.setAttribute('font-family', 'var(--mono)');
      laneTitle.setAttribute('font-size', Math.max(10, 12 * scale));
      laneTitle.setAttribute('font-weight', '600');
      laneTitle.textContent = label.toUpperCase() + ' · ' + visibleEvents.filter(function (item) {
        return (item.category || 'Other') === label;
      }).length;
      svg.appendChild(laneTitle);
    });

    var evMap = {};
    visibleEvents.forEach(function (ev) { evMap[ev.id] = ev; });
    visibleLinks.forEach(function (l) {
      var src = evMap[l.source], tgt = evMap[l.target];
      if (!src || !tgt) return;
      var srcX = (src.x || 0) * scale + offset.x;
      var srcY = (src.y || 0) * scale + offset.y;
      var tgtX = (tgt.x || 0) * scale + offset.x;
      var tgtY = (tgt.y || 0) * scale + offset.y;
      var sx, sy, tx, ty, d;
      if (tgtY >= srcY) {
        sx = srcX + nodeWidth(src) * scale / 2;
        sy = srcY + nodeHeight(src) * scale;
        tx = tgtX + nodeWidth(tgt) * scale / 2;
        ty = tgtY;
        var verticalBend = Math.max(24, Math.abs(ty - sy) * 0.35);
        d = 'M ' + sx + ' ' + sy + ' C ' + sx + ' ' + (sy + verticalBend) + ', ' + tx + ' ' + (ty - verticalBend) + ', ' + tx + ' ' + ty;
      } else {
        sx = srcX + nodeWidth(src) * scale;
        sy = srcY + nodeHeight(src) * scale / 2;
        tx = tgtX;
        ty = tgtY + nodeHeight(tgt) * scale / 2;
        var horizontalBend = Math.max(30, Math.min(150, Math.abs(tx - sx) * 0.5));
        d = 'M ' + sx + ' ' + sy + ' C ' + (sx + horizontalBend) + ' ' + sy + ', ' + (tx - horizontalBend) + ' ' + ty + ', ' + tx + ' ' + ty;
      }
      var linkType = l.type || 'related to';
      var color = RELATIONSHIP_TYPES[linkType] || '#888';
      var isLinkSelected = l.id === selectedLinkId;
      var path = document.createElementNS(NS, 'path');
      path.setAttribute('d', d);
      path.setAttribute('class', 'em-link' + (isLinkSelected ? ' selected' : ''));
      path.setAttribute('stroke', color);
      path.setAttribute('stroke-width', isLinkSelected ? 3 : 1.5);
      path.setAttribute('marker-end', 'url(#em-arrow-' + linkType.replace(/\s/g, '_') + ')');
      path.setAttribute('data-link', l.id);
      path.style.cursor = 'pointer';
      path.addEventListener('click', function (e) {
        e.stopPropagation();
        selectedLinkId = l.id;
        selectedEventId = null;
        renderGraph();
        renderEventDetail(null);
        renderLinkDetail(l.id);
      });
      var title = document.createElementNS(NS, 'title');
      title.textContent = linkType + ': ' + (src.title || 'Event') + ' → ' + (tgt.title || 'Event');
      path.appendChild(title);
      svg.appendChild(path);
    });

    visibleEvents.forEach(function (ev) {
      var x = (ev.x || 0) * scale + offset.x;
      var y = (ev.y || 0) * scale + offset.y;
      var w = nodeWidth(ev) * scale;
      var h = nodeHeight(ev) * scale;
      var color = EVENT_CATEGORIES[ev.category] || EVENT_CATEGORIES.Other;
      var isSelected = ev.id === selectedEventId;
      var searchClass = searchQuery ? ' match' : '';

      var g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'em-node-group' + (isSelected ? ' selected' : '') + searchClass);
      g.setAttribute('data-node-id', ev.id);
      g.addEventListener('mousedown', function (e) {
        if (e.button !== 0) return;
        e.stopPropagation();
        if (linkMode) {
          if (linkSourceId === null) {
            linkSourceId = ev.id;
            renderGraph();
          } else if (linkSourceId !== ev.id) {
            window.eventMapLinkNode(linkSourceId, ev.id);
            linkSourceId = null;
            renderGraph();
          } else {
            linkSourceId = null;
            renderGraph();
          }
          return;
        }
        dragNode = { id: ev.id, startClientX: e.clientX, startClientY: e.clientY, origX: ev.x || 0, origY: ev.y || 0 };
      });

      var resizeHandle = document.createElementNS(NS, 'rect');
      resizeHandle.setAttribute('x', x + w - Math.min(14, w));
      resizeHandle.setAttribute('y', y + h - Math.min(14, h));
      resizeHandle.setAttribute('width', Math.min(14, w));
      resizeHandle.setAttribute('height', Math.min(14, h));
      resizeHandle.setAttribute('fill', color);
      resizeHandle.setAttribute('opacity', '0.8');
      resizeHandle.setAttribute('class', 'em-node-resize-handle');
      resizeHandle.addEventListener('mousedown', function (e) {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        resizeNode = {
          id: ev.id,
          startClientX: e.clientX,
          startClientY: e.clientY,
          origWidth: nodeWidth(ev),
          origHeight: nodeHeight(ev)
        };
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
      rect.setAttribute('class', 'em-node-rect');
      g.appendChild(rect);

      var title = ev.title || ev.transcript_id || ev.violation_id || ev.subject || 'Untitled';
      if (fieldIsVisible(ev, 'title')) {
        var titleMaxWidth = (nodeWidth(ev) - 24) * scale;
        appendWrappedText(g, title + ' (#' + ev.id + ')', x + 12 * scale, y + 18 * scale,
          titleMaxWidth, 15 * scale, 2, 'em-node-title', Math.max(10, 13 * scale), 'var(--white)');
      }

      var cardDate = safeDate(ev.date);
      var dateStr = cardDate ? cardDate.toLocaleDateString() : (ev.recording_datetime || ev.incident_date || ev.date_utc || 'no date');
      var dateLabel = document.createElementNS(NS, 'text');
      dateLabel.setAttribute('x', x + 6);
      dateLabel.setAttribute('y', y + 52 * scale);
      dateLabel.setAttribute('font-size', Math.max(8, 10 * scale));
      dateLabel.setAttribute('fill', 'var(--gray)');
      dateLabel.setAttribute('font-family', 'var(--mono)');
      if (fieldIsVisible(ev, 'date')) {
        dateLabel.textContent = (ev.source_type || ev.category || 'Other') + ' · ' + dateStr;
        g.appendChild(dateLabel);
      }

      var description = ev.description || ev.summary || '';
      var contentMaxWidth = (nodeWidth(ev) - 24) * scale;
      if (fieldIsVisible(ev, 'description') && description) {
        var descBlockX = x + 8 * scale;
        var descBlockY = y + 60 * scale;
        var descBlockW = (nodeWidth(ev) - 16) * scale;
        var descBlockH = Math.max(24, 28 * scale);
        var descriptionBg = document.createElementNS(NS, 'rect');
        descriptionBg.setAttribute('x', descBlockX);
        descriptionBg.setAttribute('y', descBlockY);
        descriptionBg.setAttribute('width', descBlockW);
        descriptionBg.setAttribute('height', descBlockH);
        descriptionBg.setAttribute('rx', 6);
        descriptionBg.setAttribute('fill', 'rgba(196, 98, 45, 0.10)');
        descriptionBg.setAttribute('stroke', 'rgba(196, 98, 45, 0.75)');
        descriptionBg.setAttribute('stroke-width', 1);
        g.appendChild(descriptionBg);

        var descriptionLabel = document.createElementNS(NS, 'text');
        descriptionLabel.setAttribute('x', x + 14 * scale);
        descriptionLabel.setAttribute('y', y + 68 * scale);
        descriptionLabel.setAttribute('font-size', Math.max(7, 8 * scale));
        descriptionLabel.setAttribute('fill', 'var(--amber)');
        descriptionLabel.setAttribute('font-family', 'var(--mono)');
        descriptionLabel.textContent = 'DESCRIPTION';
        g.appendChild(descriptionLabel);

        appendWrappedText(g, description, x + 12 * scale, y + 82 * scale,
          contentMaxWidth, 12 * scale, 2, 'em-node-summary em-node-summary-featured', Math.max(8, 9 * scale), 'var(--white)');

        var descriptionHit = document.createElementNS(NS, 'rect');
        descriptionHit.setAttribute('x', descBlockX);
        descriptionHit.setAttribute('y', descBlockY);
        descriptionHit.setAttribute('width', descBlockW);
        descriptionHit.setAttribute('height', descBlockH + 28 * scale);
        descriptionHit.setAttribute('fill', 'transparent');
        descriptionHit.setAttribute('class', 'em-node-description-hit');
        descriptionHit.style.cursor = 'pointer';
        descriptionHit.addEventListener('mousedown', function (e) { e.stopPropagation(); });
        descriptionHit.addEventListener('click', function (e) {
          e.stopPropagation();
          window.eventMapOpenEventDescription(ev.id);
        });
        g.appendChild(descriptionHit);
      }
      if (fieldIsVisible(ev, 'tags') && ev.tags && ev.tags.length) {
        appendWrappedText(g, ev.tags.slice(0, 2).join(' · '), x + 12 * scale, y + 86 * scale,
          contentMaxWidth, 12 * scale, 1, 'em-node-summary', Math.max(8, 9 * scale), 'var(--amber)');
      }

      var cardEntries = cardFieldEntries(ev);
      cardEntries.forEach(function (entry, index) {
        var rowY = (104 + index * 18) * scale;
        // Separator line between rows
        if (index > 0) {
          var lineY = y + (102 + index * 18 - 8) * scale;
          var sepLine = document.createElementNS(NS, 'line');
          sepLine.setAttribute('x1', x + 6 * scale);
          sepLine.setAttribute('x2', x + (nodeWidth(ev) - 18) * scale);
          sepLine.setAttribute('y1', lineY);
          sepLine.setAttribute('y2', lineY);
          sepLine.setAttribute('stroke', 'var(--border)');
          sepLine.setAttribute('stroke-width', 0.5);
          g.appendChild(sepLine);
        }
        // Label in amber (distinct from value)
        var labelStr = fieldLabel(entry.field);
        var labelMaxWidth = Math.min((nodeWidth(ev) - 24) * scale, 120 * scale); // Don't let label take entire card width
        appendWrappedText(g, labelStr, x + 12 * scale,
          y + rowY, labelMaxWidth, 12 * scale, 1, 'em-node-field-label',
          Math.max(7, 9 * scale), 'var(--amber)');
        // Value in white after label — offset by label's actual rendered width
        var labelCharWidth = Math.min(labelStr.length, Math.floor(labelMaxWidth / (Math.max(7, 9 * scale) * 0.6)));
        var labelPxOffset = (labelCharWidth * 5.5 + 6) * scale;
        var valueMaxWidth = (nodeWidth(ev) - 24) * scale - labelPxOffset;
        appendWrappedText(g, entry.value, x + 12 * scale + labelPxOffset,
          y + rowY, valueMaxWidth, 12 * scale, 1, 'em-node-field-value',
          Math.max(8, 10.5 * scale), 'var(--white)');
        // Invisible hit rect — makes the full row clickable without intercepting drag
        (function (capturedEntry, capturedIndex) {
          var hitRect = document.createElementNS(NS, 'rect');
          hitRect.setAttribute('x', x + 4 * scale);
          hitRect.setAttribute('y', y + (96 + capturedIndex * 18) * scale);
          hitRect.setAttribute('width', (nodeWidth(ev) - 22) * scale);
          hitRect.setAttribute('height', 16 * scale);
          hitRect.setAttribute('fill', 'transparent');
          hitRect.setAttribute('class', 'em-card-field-hit');
          hitRect.style.cursor = 'pointer';
          hitRect.addEventListener('mousedown', function (e) { e.stopPropagation(); });
          hitRect.addEventListener('click', function (e) {
            e.stopPropagation();
            window.eventMapOpenCardFieldPopover(ev.id, capturedEntry.field);
          });
          g.appendChild(hitRect);
        }(entry, index));
      });

      g.appendChild(resizeHandle);

      // ── Inline "edit" affordance ──────────────────────────────────────
      var editBtn = document.createElementNS(NS, 'circle');
      editBtn.setAttribute('cx', x + w - 12);
      editBtn.setAttribute('cy', y + 12);
      editBtn.setAttribute('r', 10);
      editBtn.setAttribute('fill', 'rgba(255,255,255,0.9)');
      editBtn.setAttribute('stroke', color);
      editBtn.setAttribute('stroke-width', 1);
      editBtn.setAttribute('class', 'em-node-edit-btn');
      editBtn.style.cursor = 'pointer';
      editBtn.addEventListener('mousedown', function (e) { e.stopPropagation(); });
      editBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        window.eventMapShowNodeEditor(ev.id);
      });
      g.appendChild(editBtn);

      // ── File-attachment indicator ─────────────────────────────────────
      var attachCount = countFileAttachments(ev);
      if (attachCount) {
        var clip = document.createElementNS(NS, 'text');
        clip.setAttribute('x', x + 12 * scale);
        clip.setAttribute('y', y + h - 6);
        clip.setAttribute('font-size', Math.max(9, 12 * scale));
        clip.setAttribute('class', 'em-node-paperclip');
        clip.textContent = '\uD83D\uDCCE' + (attachCount > 1 ? ' ' + attachCount : '');
        g.appendChild(clip);
      }

      svg.appendChild(g);
    });

    var zr = document.getElementById('emZoomReadout');
    if (zr) zr.textContent = Math.round(scale * 100) + '%';
  }

  function selectEvent(id) {
    selectedEventId = id;
    selectedLinkId = null;
    renderGraph();
    renderEventDetail(id);
  }

  // ── Detail panel (supports rich fields and collapsible sections) ──────
  function ensureDetailResizeHandle() {
    var panel = document.getElementById('emDetailPanel');
    if (!panel) return;
    if (panel.querySelector('.em-detail-resize')) return;
    var handle = document.createElement('div');
    handle.className = 'em-detail-resize';
    handle.id = 'emDetailResize';
    handle.title = 'Drag to resize';
    panel.insertBefore(handle, panel.firstChild);
    wireDetailResize(handle, panel);
  }

  function renderEventDetail(id, focusField) {
    var panel = document.getElementById('emDetailPanel');
    if (!panel) return;
    if (id === null || id === undefined) {
      panel.innerHTML = '<div class="em-detail-placeholder">Click an event to inspect and edit details. Drag nodes to move them, drag empty canvas to pan, scroll to zoom.</div>';
      ensureDetailResizeHandle();
      return;
    }
    var ev = events.find(function (e) { return e.id === id; });
    if (!ev) {
      panel.innerHTML = '<div class="em-detail-placeholder">Event not found.</div>';
      ensureDetailResizeHandle();
      return;
    }

    var html = '<div class="em-node-detail">';
    html += '<div class="em-node-detail-head"><h3 class="em-node-detail-title">' + esc(ev.title || ev.violation_id || ev.transcript_id || ev.subject || 'Untitled') +
      ' <span class="em-node-id">#' + ev.id + '</span></h3></div>';

    var rawDate = ev.date || ev.recording_datetime || ev.incident_date || ev.date_utc;
    var safeD = safeDate(rawDate);
    if (safeD) html += '<div class="em-node-detail-sub">' + esc(safeD.toLocaleString()) + '</div>';
    if (ev.source_type) html += '<div class="em-source-badge">Source: ' + esc(ev.source_type) + '</div>';

    html += '<div class="em-node-toolbar">';
    html += '<button class="btn btn-sm" onclick="eventMapToggleNodeVisibility(' + ev.id + ')" title="' + (nodeIsVisible(ev) ? 'Hide node' : 'Show node') + '"><i class="fas fa-eye' + (nodeIsVisible(ev) ? '' : '-slash') + '"></i> ' + (nodeIsVisible(ev) ? 'Hide' : 'Show') + '</button>';
    html += '<button class="btn btn-sm" onclick="eventMapAddField(' + ev.id + ')" title="Add a field to this event"><i class="fas fa-plus"></i> Add field</button>';
    html += '<button class="btn btn-sm" onclick="eventMapStartLinkFrom(' + ev.id + ')" title="Add an arrow from this event to another"><i class="fas fa-project-diagram"></i> Add arrow</button>';
    html += '<button class="btn btn-sm" onclick="eventMapDuplicateEvent(' + ev.id + ')" title="Duplicate this event">' + ICONS.copy + ' Duplicate</button>';
    html += '<button class="btn btn-sm danger" onclick="eventMapDeleteEvent(' + ev.id + ')" title="Delete this event and its links">' + ICONS.trash + ' Delete</button>';
    html += '</div>';

    // Basic editable fields (always shown)
    html += '<div class="em-widget-row"><label class="em-widget-label">Title</label>' +
      '<input type="text" class="em-widget-input" value="' + esc(ev.title || '') + '" onchange="eventMapUpdateEvent(' + ev.id + ', \'title\', this.value)"></div>';
    var dateInputValue = safeDate(ev.date) ? safeDate(ev.date).toISOString().slice(0, 16) : '';
    html += '<div class="em-widget-row"><label class="em-widget-label">Date</label>' +
      '<input type="datetime-local" class="em-widget-input" value="' + dateInputValue +
      '" onchange="eventMapUpdateEvent(' + ev.id + ', \'date\', this.value)"></div>';
    html += '<div class="em-widget-row"><label class="em-widget-label">Category</label>' +
      '<select class="em-widget-select" onchange="eventMapCategoryChanged(' + ev.id + ', this)">';
    Object.keys(EVENT_CATEGORIES).forEach(function (cat) {
      html += '<option value="' + cat + '"' + (ev.category === cat ? ' selected' : '') + '>' + cat + '</option>';
    });
    html += '<option value="__add__">+ Add new category…</option>';
    html += '</select></div>';
    html += '<div class="em-widget-row em-widget-col em-add-category-row" id="emAddCategoryRow-' + ev.id + '" style="display:none">' +
      '<div class="em-add-category-inline"><input type="text" class="em-widget-input" id="emAddCategoryInput-' + ev.id + '" placeholder="New category name" onkeydown="if(event.key===\'Enter\')eventMapConfirmNewCategory(' + ev.id + ');if(event.key===\'Escape\')eventMapCancelNewCategory(' + ev.id + ')">' +
      '<button class="btn btn-sm" onclick="eventMapConfirmNewCategory(' + ev.id + ')">Add</button>' +
      '<button class="btn btn-sm" onclick="eventMapCancelNewCategory(' + ev.id + ')">Cancel</button></div></div>';
    html += '<div class="em-widget-row"><label class="em-widget-label">Status</label>' +
      '<input type="text" class="em-widget-input" value="' + esc(ev.status || '') + '" onchange="eventMapUpdateEvent(' + ev.id + ', \'status\', this.value)"></div>';
    html += '<div class="em-widget-row em-widget-col"><label class="em-widget-label">Description</label>' +
      '<textarea class="em-widget-textarea" onchange="eventMapUpdateEvent(' + ev.id + ', \'description\', this.value)">' + esc(ev.description || ev.summary || '') + '</textarea></div>';

    // Entities / tags
    var entities = ev.entities || [];
    if (ev.participants) {
      ev.participants.forEach(function (p) {
        if (p.canonical_name) entities.push(p.canonical_name);
      });
    }
    entities = Array.from(new Set(entities));
    html += '<div class="em-widget-row em-widget-col"><label class="em-widget-label">Entities (comma separated)</label>' +
      '<input type="text" class="em-widget-input" value="' + esc(entities.join(', ')) +
      '" onchange="eventMapUpdateEvent(' + ev.id + ', \'entities\', this.value.split(\',\').map(s=>s.trim()).filter(Boolean))"></div>';
    var tags = ev.tags || [];
    html += '<div class="em-widget-row em-widget-col"><label class="em-widget-label">Tags (comma separated)</label>' +
      '<input type="text" class="em-widget-input" value="' + esc(tags.join(', ')) +
      '" onchange="eventMapUpdateEvent(' + ev.id + ', \'tags\', this.value.split(\',\').map(s=>s.trim()).filter(Boolean))"></div>';

    // Render all other fields dynamically (collapsible)
    var exclude = ['id', 'title', 'date', 'description', 'summary', 'category', 'status', 'entities', 'tags', 'x', 'y', 'links'];
    for (var key in ev) {
      if (exclude.indexOf(key) !== -1) continue;
      if (ev[key] === null || ev[key] === undefined || ev[key] === '') continue;
      html += renderRichSection(key, ev[key], ev);
    }

    html += '</div>';
    var resizeHandle = detachResizeHandle(panel);
    panel.innerHTML = html;
    if (resizeHandle) reattachResizeHandle(panel, resizeHandle);
    ensureDetailResizeHandle();
    panel.querySelectorAll('[data-field-value]').forEach(function (button) {
      button.addEventListener('click', function (e) {
        e.stopPropagation();
        var field = decodeURIComponent(button.getAttribute('data-field-value'));
        showFieldValuePopover(ev, field, button);
      });
    });

    // Auto-expand and scroll to focusField if specified
    if (focusField) {
      var target = panel.querySelector('.em-rich-section[data-field-key="' + focusField + '"]');
      if (target) {
        var header = target.querySelector('.em-rich-header');
        var body = target.querySelector('.em-rich-body');
        if (header && body && !header.classList.contains('open')) {
          header.classList.add('open');
          body.classList.add('open');
          // Persist this expansion
          if (!expandedFields[ev.id]) expandedFields[ev.id] = new Set();
          expandedFields[ev.id].add(focusField);
          saveExpandedFields();
        }
        // Highlight and scroll
        target.classList.add('is-focused');
        setTimeout(function () {
          target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          setTimeout(function () { target.classList.remove('is-focused'); }, 1200);
        }, 50);
      }
    }
  }

  // FIX #9: Stop propagation on popover so toggle button works
  function showFieldValuePopover(ev, field, btn) {
    closeFieldValuePopover();
    var value = fieldValues(ev, field.split('.'), 0);
    var display = value.length ? value.map(function (v) {
      if (v && typeof v === 'object') return JSON.stringify(v);
      return String(v == null ? '' : v);
    }).join(', ') : '(empty)';

    var pop = document.createElement('div');
    pop.id = 'emFieldValuePopover';
    pop.className = 'em-field-value-popover';
    pop.innerHTML =
      '<div class="em-field-value-head">' +
      '<span class="em-field-value-name">' + esc(fieldLabel(field)) + '</span>' +
      '</div>' +
      '<div class="em-field-value-body">' + esc(display) + '</div>';
    document.body.appendChild(pop);

    // Prevent clicks inside the popover from closing it
    pop.addEventListener('click', function (e) {
      e.stopPropagation();
    });

    // Position to the right of the button
    var rect = btn.getBoundingClientRect();
    var popRect = pop.getBoundingClientRect();
    var left = rect.right + 8;
    var top = rect.top;
    if (left + popRect.width > window.innerWidth - 8) left = rect.left - popRect.width - 8;
    if (top + popRect.height > window.innerHeight - 8) top = window.innerHeight - popRect.height - 8;
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';

    setTimeout(function () {
      document.addEventListener('click', closeFieldValuePopover, { once: true });
    }, 0);
  }

  function closeFieldValuePopover() {
    var pop = document.getElementById('emFieldValuePopover');
    if (pop) pop.remove();
    cardFieldPopoverState = null;
  }

  window.eventMapOpenEventDescription = function (evId) {
    var ev = events.find(function (e) { return e.id === evId; });
    if (!ev) return;
    var text = ev.description || ev.summary || '';
    if (!String(text).trim()) return;

    var modal = document.createElement('div');
    modal.className = 'em-event-description-modal';
    modal.innerHTML =
      '<div class="em-event-description-card" role="dialog" aria-modal="true" aria-labelledby="emEventDescriptionTitle">' +
        '<div class="em-event-description-head">' +
          '<div>' +
            '<div class="em-event-description-kicker">Description</div>' +
            '<h3 id="emEventDescriptionTitle">' + esc(ev.title || ev.violation_id || ev.transcript_id || ev.subject || 'Untitled') + '</h3>' +
          '</div>' +
          '<button type="button" class="em-event-description-close" title="Close"><i class="fas fa-times"></i></button>' +
        '</div>' +
        '<div class="em-event-description-body">' + esc(text).replace(/\n/g, '<br>') + '</div>' +
        '<div class="em-event-description-foot">' +
          '<button type="button" class="em-event-description-sidebar-link"><i class="fas fa-sidebar"></i> View &amp; edit in sidebar</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(modal);

    var closeModal = function () { modal.remove(); };
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeModal();
    });
    modal.querySelector('.em-event-description-close').addEventListener('click', function (e) {
      e.stopPropagation();
      closeModal();
    });
    modal.querySelector('.em-event-description-sidebar-link').addEventListener('click', function (e) {
      e.stopPropagation();
      selectedEventId = evId;
      renderGraph();
      renderEventDetail(evId, 'description');
      closeModal();
      var panel = document.getElementById('emDetailPanel');
      if (panel && panel.classList.contains('is-hidden')) {
        window.eventMapToggleSidebar();
      }
    });
  };

  // ── Card-field popover (floating, next to the node) ───────────────────
  window.eventMapOpenCardFieldPopover = function (evId, field) {
    // Toggle off if already showing this field
    if (cardFieldPopoverState && cardFieldPopoverState.evId === evId && cardFieldPopoverState.field === field) {
      closeFieldValuePopover();
      return;
    }
    closeFieldValuePopover();

    var ev = events.find(function (e) { return e.id === evId; });
    if (!ev) return;

    var values = fieldValues(ev, field.split('.'), 0);
    var display = values.length ? values.map(function (v) {
      if (v && typeof v === 'object') return JSON.stringify(v, null, 2);
      return String(v == null ? '' : v);
    }).join('\n') : '(empty)';

    cardFieldPopoverState = { evId: evId, field: field };

    var pop = document.createElement('div');
    pop.id = 'emFieldValuePopover';
    pop.className = 'em-card-field-popover';
    pop.innerHTML =
      '<div class="em-card-field-popover-head">' +
        '<span class="em-field-value-name">' + esc(fieldLabel(field)) + '</span>' +
        '<button class="em-card-field-popover-close" title="Close"><i class="fas fa-times"></i></button>' +
      '</div>' +
      '<div class="em-card-field-popover-body">' + esc(display) + '</div>' +
      '<div class="em-card-field-popover-foot">' +
        '<button class="em-card-field-popover-sidebar-link" title="Expand in sidebar"><i class="fas fa-sidebar"></i> View &amp; edit in sidebar</button>' +
      '</div>';

    document.body.appendChild(pop);

    // Position: right of the card node in screen space
    var container = document.getElementById('emGraphContainer');
    var containerRect = container ? container.getBoundingClientRect() : { left: 0, top: 0 };
    var nodeX = (ev.x || 0) * scale + (offset ? offset.x : 0) + containerRect.left;
    var nodeY = (ev.y || 0) * scale + (offset ? offset.y : 0) + containerRect.top;
    var nodeW = nodeWidth(ev) * scale;
    var popRect = pop.getBoundingClientRect();
    var left = nodeX + nodeW + 14;
    var top = nodeY;
    if (left + popRect.width > window.innerWidth - 8) left = Math.max(8, nodeX - popRect.width - 14);
    if (top + popRect.height > window.innerHeight - 8) top = Math.max(8, window.innerHeight - popRect.height - 8);
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';

    pop.addEventListener('click', function (e) { e.stopPropagation(); });

    pop.querySelector('.em-card-field-popover-close').addEventListener('click', function (e) {
      e.stopPropagation();
      closeFieldValuePopover();
    });

    pop.querySelector('.em-card-field-popover-sidebar-link').addEventListener('click', function (e) {
      e.stopPropagation();
      // Select event and expand the field in the sidebar
      selectedEventId = evId;
      renderGraph();
      renderEventDetail(evId, field);
      // Make sure sidebar is visible
      var panel = document.getElementById('emDetailPanel');
      if (panel && panel.classList.contains('is-hidden')) {
        window.eventMapToggleSidebar();
      }
    });

    setTimeout(function () {
      document.addEventListener('click', function dismissPop() {
        closeFieldValuePopover();
        document.removeEventListener('click', dismissPop);
      });
    }, 0);

    // Also select event + expand field in sidebar silently
    if (selectedEventId !== evId) {
      selectedEventId = evId;
      renderGraph();
    }
    renderEventDetail(evId, field);
  };

  // ── Inline node editor ────────────────────────────────────────────────
  // FIX #14: Added entities/tags fields and __add__ category option
  function buildEditorHtml(ev) {
    var html = '<div class="em-node-editor-head"><strong>' + esc(ev.title || 'Event #' + ev.id) + '</strong>' +
      '<button type="button" class="em-node-editor-close" data-close title="Close"><i class="fas fa-times"></i></button></div>';
    html += '<div class="em-node-editor-body">';
    html += '<div class="em-widget-row"><label class="em-widget-label">Title</label>' +
      '<input type="text" class="em-widget-input" value="' + esc(ev.title || '') + '" onchange="eventMapUpdateEvent(' + ev.id + ', \'title\', this.value)"></div>';
    var dateInputValue = safeDate(ev.date) ? safeDate(ev.date).toISOString().slice(0, 16) : '';
    html += '<div class="em-widget-row"><label class="em-widget-label">Date</label>' +
      '<input type="datetime-local" class="em-widget-input" value="' + dateInputValue + '" onchange="eventMapUpdateEvent(' + ev.id + ', \'date\', this.value)"></div>';
    html += '<div class="em-widget-row"><label class="em-widget-label">Category</label>' +
      '<select class="em-widget-select" onchange="eventMapCategoryChanged(' + ev.id + ', this)">';
    Object.keys(EVENT_CATEGORIES).forEach(function (cat) {
      html += '<option value="' + cat + '"' + (ev.category === cat ? ' selected' : '') + '>' + cat + '</option>';
    });
    html += '<option value="__add__">+ Add new category…</option>';
    html += '</select></div>';
    html += '<div class="em-widget-row"><label class="em-widget-label">Status</label>' +
      '<input type="text" class="em-widget-input" value="' + esc(ev.status || '') + '" onchange="eventMapUpdateEvent(' + ev.id + ', \'status\', this.value)"></div>';
    html += '<div class="em-widget-row em-widget-col"><label class="em-widget-label">Description</label>' +
      '<textarea class="em-widget-textarea" onchange="eventMapUpdateEvent(' + ev.id + ', \'description\', this.value)">' + esc(ev.description || ev.summary || '') + '</textarea></div>';

    // Add entities and tags for consistency
    var entities = ev.entities || [];
    html += '<div class="em-widget-row em-widget-col"><label class="em-widget-label">Entities (comma separated)</label>' +
      '<input type="text" class="em-widget-input" value="' + esc(entities.join(', ')) +
      '" onchange="eventMapUpdateEvent(' + ev.id + ', \'entities\', this.value.split(\',\').map(s=>s.trim()).filter(Boolean))"></div>';
    var tags = ev.tags || [];
    html += '<div class="em-widget-row em-widget-col"><label class="em-widget-label">Tags (comma separated)</label>' +
      '<input type="text" class="em-widget-input" value="' + esc(tags.join(', ')) +
      '" onchange="eventMapUpdateEvent(' + ev.id + ', \'tags\', this.value.split(\',\').map(s=>s.trim()).filter(Boolean))"></div>';

    html += '<div class="em-node-editor-actions">' +
      '<button class="btn btn-sm" onclick="eventMapAddField(' + ev.id + ')" title="Add a field"><i class="fas fa-plus"></i> Add field</button>' +
      '<button class="btn btn-sm" onclick="eventMapDuplicateEvent(' + ev.id + ')" title="Duplicate">' + ICONS.copy + ' Duplicate</button>' +
      '<button class="btn btn-sm" onclick="eventMapStartLinkFrom(' + ev.id + ')" title="Add an arrow from this event"><i class="fas fa-project-diagram"></i> Arrow</button>' +
      '<button class="btn btn-sm danger" onclick="eventMapDeleteEvent(' + ev.id + ')" title="Delete this event">' + ICONS.trash + ' Delete</button>' +
      '</div>';
    html += '</div>';
    return html;
  }

  function positionNodeEditor(pop, ev) {
    var x = (ev.x || 0) * scale + (offset ? offset.x : 0);
    var y = (ev.y || 0) * scale + (offset ? offset.y : 0);
    var w = nodeWidth(ev) * scale;
    var left = x + w + 12;
    var top = y;
    var pr = pop.getBoundingClientRect();
    if (left + pr.width > window.innerWidth - 8) left = Math.max(8, x - pr.width - 12);
    if (top + pr.height > window.innerHeight - 8) top = Math.max(8, window.innerHeight - pr.height - 8);
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';
  }

  function closeNodeEditor() {
    var pop = document.getElementById('emNodeEditorPopover');
    if (pop) pop.remove();
  }

  window.eventMapShowNodeEditor = function (id) {
    var ev = events.find(function (e) { return e.id === id; });
    if (!ev) return;
    closeNodeEditor();
    var pop = document.createElement('div');
    pop.id = 'emNodeEditorPopover';
    pop.className = 'em-node-editor-popover';
    pop.innerHTML = buildEditorHtml(ev);
    document.body.appendChild(pop);
    positionNodeEditor(pop, ev);
    pop.querySelector('[data-close]').addEventListener('click', function (e) {
      e.stopPropagation();
      closeNodeEditor();
    });
    setTimeout(function () {
      document.addEventListener('click', function handler(e) {
        if (!pop.contains(e.target)) { closeNodeEditor(); document.removeEventListener('click', handler); }
      });
    }, 0);
  };

  // ── Right-click context menu ──────────────────────────────────────────
  function closeContextMenu() {
    var menu = document.querySelector('.em-context-menu');
    if (menu) menu.remove();
  }

  function showContextMenu(x, y, items) {
    closeContextMenu();
    var menu = document.createElement('div');
    menu.className = 'em-context-menu';
    document.body.appendChild(menu);
    var html = '';
    items.forEach(function (item) {
      if (item.separator) { html += '<div class="em-context-separator"></div>'; return; }
      html += '<button type="button" class="em-context-item' + (item.disabled ? ' is-disabled' : '') + '"' +
        (item.disabled ? ' disabled' : '') + ' data-index="' + items.indexOf(item) + '">' + esc(item.label) + '</button>';
    });
    menu.innerHTML = html;
    var menuRect = menu.getBoundingClientRect();
    menu.style.left = Math.min(x, window.innerWidth - menuRect.width - 8) + 'px';
    menu.style.top = Math.min(y, window.innerHeight - menuRect.height - 8) + 'px';
    menu.querySelectorAll('[data-index]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = Number(btn.getAttribute('data-index'));
        var item = items[idx];
        closeContextMenu();
        if (item && item.action) item.action();
      });
    });
    setTimeout(function () {
      document.addEventListener('click', closeContextMenu, { once: true });
    }, 0);
  }

  window.eventMapToggleNodeVisibility = function (id) {
    var ev = events.find(function (item) { return item.id === id; });
    if (!ev) return;
    ev.hidden = nodeIsVisible(ev);
    renderGraph();
    renderTimeline();
    renderEntities();
    renderFilters();
    renderEventDetail(id);
  };

  function renderLinkDetail(linkId) {
    var panel = document.getElementById('emDetailPanel');
    if (!panel) return;
    var link = links.find(function (l) { return l.id === linkId; });
    if (!link) {
      panel.innerHTML = '<div class="em-detail-placeholder">Link not found.</div>';
      ensureDetailResizeHandle();
      return;
    }
    var src = events.find(function (e) { return e.id === link.source; });
    var tgt = events.find(function (e) { return e.id === link.target; });
    var html = '<div class="em-node-detail">';
    html += '<div class="em-node-detail-head"><h3 class="em-node-detail-title">Arrow / Link <span class="em-node-id">#' + link.id + '</span></h3></div>';
    html += '<div class="em-link-detail-info">' +
      '<div><strong>From:</strong> ' + esc(src ? (src.title || 'Event #' + src.id) : '#' + link.source) + '</div>' +
      '<div><strong>To:</strong> ' + esc(tgt ? (tgt.title || 'Event #' + tgt.id) : '#' + link.target) + '</div>' +
      '</div>';
    html += '<div class="em-widget-row"><label class="em-widget-label">Type</label>' +
      '<select class="em-widget-select" onchange="eventMapSetLinkType(\'' + link.id + '\', this.value)">';
    Object.keys(RELATIONSHIP_TYPES).forEach(function (type) {
      html += '<option value="' + type + '"' + (link.type === type ? ' selected' : '') + '>' + type + '</option>';
    });
    html += '</select></div>';
    html += '<div class="em-node-toolbar">' +
      '<button class="btn btn-sm" onclick="eventMapStartLinkFrom(' + link.source + ')" title="Add another arrow from the source event"><i class="fas fa-project-diagram"></i> Add arrow</button>' +
      '<button class="btn btn-sm danger" onclick="eventMapRemoveLink(\'' + link.id + '\')" title="Remove this arrow"><i class="fas fa-trash"></i> Remove arrow</button>' +
      '</div>';
    html += '</div>';
    panel.innerHTML = html;
    ensureDetailResizeHandle();
  }

  function closeAddFieldDialog() {
    var dialog = document.getElementById('emAddFieldDialog');
    if (dialog) dialog.remove();
  }

  // Reads a picked file into a data URL and remembers it on the input so the
  // Add Field handler can store it as an attachment { name, type, dataUrl }.
  window.eventMapReadFile = function (input) {
    var file = input.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (e) {
      input._fileData = e.target.result;
      input._fileName = file.name;
      input._fileType = file.type;
      var info = document.getElementById('emAddFieldFileName');
      if (info) info.textContent = 'Ready: ' + file.name + ' (' + (file.type || 'unknown type') + ', ' + Math.round(file.size / 1024) + ' KB)';
    };
    reader.readAsDataURL(file);
  };

  // FIX #8: Handle path/URL references, not just dataUrl
  window.eventMapOpenFile = function (eventId, fieldName) {
    var ev = events.find(function (e) { return e.id === eventId; });
    if (!ev) return;

    var file = null;
    if (Object.prototype.hasOwnProperty.call(ev, fieldName)) {
      file = ev[fieldName];
    } else {
      var vals = fieldValues(ev, String(fieldName).split('.'), 0);
      if (vals.length) file = vals[0];
    }
    if (!file || file === null || file === undefined) return;

    // Object with dataUrl
    if (typeof file === 'object' && file.dataUrl) {
      openFileModal(file.name || 'File', file.type || '', file.dataUrl);
      return;
    }

    // String that looks like a path or URL
    if (typeof file === 'string') {
      var ref = looksLikeFileRef(file);
      if (ref) {
        if (ref.kind === 'url') {
          openFileModal(ref.name, '', ref.url);
        } else if (ref.kind === 'path') {
          var src = sharedSourceUrl(ref.path);
          window.open(src, '_blank');
        }
        return;
      }
    }
  };

  // Helper to open a file modal
  function openFileModal(name, type, src) {
    var modal = document.createElement('div');
    modal.className = 'em-file-modal';
    var lowerName = String(name || '').toLowerCase();
    
    if (type && type.indexOf('image/') === 0) {
      modal.innerHTML = '<div class="em-file-modal-card"><div class="em-file-modal-head"><span>' + esc(name || 'Image') + '</span><button class="btn btn-sm" data-close><i class="fas fa-times"></i></button></div>' +
        '<div class="em-file-modal-body"><img src="' + src + '" alt="' + esc(name || '') + '"></div></div>';
    } else if (type === 'application/pdf' || lowerName.indexOf('.pdf') !== -1) {
      modal.innerHTML = '<div class="em-file-modal-card em-file-modal-card-tall"><div class="em-file-modal-head"><span>' + esc(name || 'PDF') + '</span><button class="btn btn-sm" data-close><i class="fas fa-times"></i></button></div>' +
        '<iframe src="' + src + '"></iframe></div>';
    } else if ((type && type.indexOf('video/') === 0) || lowerName.match(/\.(mp4|webm|ogg|mov)$/)) {
      modal.innerHTML = '<div class="em-file-modal-card em-file-modal-card-tall"><div class="em-file-modal-head"><span>' + esc(name || 'Video') + '</span><button class="btn btn-sm" data-close><i class="fas fa-times"></i></button></div>' +
        '<div class="em-file-modal-body" style="display: flex; justify-content: center; align-items: center; background: #000; height: 100%;"><video src="' + src + '" controls autoplay style="max-width: 100%; max-height: 100%;"></video></div></div>';
    } else {
      modal.innerHTML = '<div class="em-file-modal-card"><div class="em-file-modal-head"><span>' + esc(name || 'File') + '</span><button class="btn btn-sm" data-close><i class="fas fa-times"></i></button></div>' +
        '<div class="em-file-modal-body"><pre>' + esc('(binary or unsupported type)') + '</pre></div></div>';
    }
    document.body.appendChild(modal);
    modal.addEventListener('click', function (e) {
      if (e.target === modal || (e.target && e.target.closest && e.target.closest('[data-close]'))) modal.remove();
    });
  }

  window.eventMapAddField = function (id) {
    var ev = events.find(function (item) { return item.id === id; });
    if (!ev) return;
    closeAddFieldDialog();
    var reserved = ['id', 'x', 'y', 'links'];
    var existing = Object.keys(ev);
    var options = availableFieldKeys(sourceKey(ev)).filter(function (key) {
      return existing.indexOf(key) === -1 && reserved.indexOf(key) === -1;
    });
    var dialog = document.createElement('div');
    dialog.id = 'emAddFieldDialog';
    dialog.className = 'em-new-map-dialog';
    dialog.innerHTML = '<div class="em-add-field-card" role="dialog" aria-modal="true" aria-labelledby="emAddFieldTitle">' +
      '<div class="em-new-map-head"><h3 id="emAddFieldTitle">Add field to event #' + ev.id + '</h3>' +
      '<button class="btn btn-sm" type="button" data-close title="Close"><i class="fas fa-times"></i></button></div>' +
      '<p class="em-new-map-sub">Choose a known field or define a new one. The value can be text, valid JSON, or a file attachment.</p>' +
      '<label class="em-add-field-label">Known fields</label>' +
      '<select id="emAddFieldSelect" class="em-filter-select"><option value="">Choose a field...</option>' +
      options.map(function (key) { return '<option value="' + esc(key) + '">' + esc(fieldLabel(key)) + ' · ' + esc(key) + '</option>'; }).join('') +
      '</select>' +
      '<label class="em-add-field-label">Field name</label>' +
      '<input id="emAddFieldName" class="em-filter-input" type="text" placeholder="e.g. legal_note or review_status">' +
      '<label class="em-add-field-label">Value</label>' +
      '<textarea id="emAddFieldValue" class="em-add-field-value" rows="5" placeholder="Enter text or JSON..."></textarea>' +
      '<label class="em-add-field-label">File (optional)</label>' +
      '<input type="file" id="emAddFieldFile" onchange="eventMapReadFile(this)">' +
      '<div id="emAddFieldFileName" class="em-add-field-file-name"></div>' +
      '<div class="em-add-field-preview-title">Markdown preview</div><pre id="emAddFieldPreview" class="em-add-field-preview">## Field\n\nValue</pre>' +
      '<div class="em-add-field-actions"><button class="btn btn-sm" type="button" data-cancel>Cancel</button>' +
      '<button class="btn btn-sm" type="button" data-add><i class="fas fa-plus"></i> Add field</button></div>' +
      '<div id="emAddFieldStatus" class="em-new-map-status" aria-live="polite"></div></div>';
    document.body.appendChild(dialog);
    var select = dialog.querySelector('#emAddFieldSelect');
    var nameInput = dialog.querySelector('#emAddFieldName');
    var valueInput = dialog.querySelector('#emAddFieldValue');
    var preview = dialog.querySelector('#emAddFieldPreview');
    var updatePreview = function () {
      var name = nameInput.value.trim() || 'Field';
      preview.textContent = '## ' + name + '\n\n' + (valueInput.value || 'Value');
    };
    select.addEventListener('change', function () { if (select.value) nameInput.value = select.value; updatePreview(); });
    nameInput.addEventListener('input', updatePreview);
    valueInput.addEventListener('input', updatePreview);
    dialog.querySelector('[data-close]').addEventListener('click', closeAddFieldDialog);
    dialog.querySelector('[data-cancel]').addEventListener('click', closeAddFieldDialog);
    dialog.addEventListener('click', function (event) { if (event.target === dialog) closeAddFieldDialog(); });
    dialog.querySelector('[data-add]').addEventListener('click', function () {
      var name = nameInput.value.trim();
      var rawValue = valueInput.value;
      var status = dialog.querySelector('#emAddFieldStatus');
      if (!name) { status.textContent = 'Enter a field name.'; return; }
      if (reserved.indexOf(name) !== -1 || ['title', 'date', 'description', 'category', 'status', 'entities', 'tags'].indexOf(name) !== -1) {
        status.textContent = 'Use the existing editor for this standard field.';
        return;
      }
      if (Object.prototype.hasOwnProperty.call(ev, name)) { status.textContent = 'This field already exists on the event.'; return; }
      var parsedValue = rawValue;
      if (rawValue.trim()) {
        try { parsedValue = JSON.parse(rawValue); } catch (_error) { parsedValue = rawValue; }
      }
      var fileInput = dialog.querySelector('#emAddFieldFile');
      var fileData = (fileInput && fileInput._fileData)
        ? { name: fileInput._fileName, type: fileInput._fileType || '', dataUrl: fileInput._fileData }
        : null;
      ev[name] = fileData || parsedValue;
      renderEventDetail(id);
      renderFilters();
      renderGraph();
      closeAddFieldDialog();
    });
  };

  // Recursively render a field value as a collapsible section
  // Recursively render a field value as a collapsible, editable section
  function renderRichSection(key, value, ev) {
    var label = key.replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
    // Restore expand state persisted in expandedFields
    var evExpanded = expandedFields[ev.id];
    var isOpen = evExpanded && evExpanded.has ? evExpanded.has(key) : false;
    var openClass = isOpen ? ' open' : '';
    var html = '<div class="em-rich-section" data-field-key="' + esc(key) + '">';
    html += '<div class="em-rich-header' + openClass + '" onclick="eventMapToggleRichSection(this,' + ev.id + ',\'' + esc(key).replace(/'/g, "\\''") + '\')"><span>' + esc(label) + '</span><span class="em-rich-toggle">v</span></div>';
    html += '<div class="em-rich-body' + openClass + '">';
    html += renderEditableValue(key, value, ev);
    html += '</div></div>';
    return html;
  }
  // Updates a rich field from an editable textarea
  window.eventMapUpdateRichField = function (eventId, fieldKey, newValue, originalType) {
    var ev = events.find(function (e) { return e.id === eventId; });
    if (!ev) return;
    var parsedValue;
    if (originalType === 'object') {
      try {
        parsedValue = JSON.parse(newValue);
        
        // Restore truncated dataUrls
        var restoreDataUrls = function(oldObj, newObj) {
          if (!oldObj || !newObj || typeof oldObj !== 'object' || typeof newObj !== 'object') return;
          if (Array.isArray(oldObj) && Array.isArray(newObj)) {
            newObj.forEach(function(newItem, i) {
              if (newItem && newItem.dataUrl === '<dataUrl hidden in editor>') {
                var oldItem = oldObj.find(function(o) { return o && o.name === newItem.name && o.dataUrl; }) || oldObj[i];
                if (oldItem && oldItem.dataUrl) newItem.dataUrl = oldItem.dataUrl;
              } else {
                restoreDataUrls(oldObj[i], newItem);
              }
            });
          } else if (!Array.isArray(oldObj) && !Array.isArray(newObj)) {
            if (newObj.dataUrl === '<dataUrl hidden in editor>' && oldObj.dataUrl) {
              newObj.dataUrl = oldObj.dataUrl;
            }
            Object.keys(newObj).forEach(function(k) {
              restoreDataUrls(oldObj[k], newObj[k]);
            });
          }
        };
        restoreDataUrls(ev[fieldKey], parsedValue);
        
      } catch (e) {
        alert('Invalid JSON – field not updated.');
        return;
      }
    } else if (originalType === 'number') {
      var num = Number(newValue);
      if (isNaN(num)) {
        alert('Invalid number – field not updated.');
        return;
      }
      parsedValue = num;
    } else if (originalType === 'boolean') {
      if (newValue === 'true' || newValue === 'false') {
        parsedValue = newValue === 'true';
      } else {
        alert('Enter "true" or "false" – field not updated.');
        return;
      }
    } else {
      parsedValue = newValue;
    }
    ev[fieldKey] = parsedValue;
    persistState();
    renderEventDetail(eventId); // re-render to reflect updated value
    renderGraph(); // in case this field affects card display
  };

  // New helper: returns an editable input/textarea for a field value
  function renderEditableValue(fieldKey, value, ev) {
    var inputId = 'em-edit-' + ev.id + '-' + fieldKey.replace(/\./g, '-');
    var originalType = typeof value;
    var displayValue;
    if (value === null || value === undefined) {
      displayValue = '';
    } else if (typeof value === 'string') {
      displayValue = value;
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      displayValue = String(value);
    } else {
      // objects and arrays → JSON string, but hide massive dataUrls
      displayValue = JSON.stringify(value, function(k, v) {
        if (k === 'dataUrl' && typeof v === 'string' && v.length > 100) {
          return '<dataUrl hidden in editor>';
        }
        return v;
      }, 2);
    }
    
    // Check if the value contains any file attachments, and render them visually
    var attachmentsHtml = '';
    if (Array.isArray(value)) {
       value.forEach(function(item, idx) {
          if (item && item.dataUrl) attachmentsHtml += renderAttachmentHtml(item, ev, fieldKey + '.' + idx);
          else if (typeof item === 'string' && looksLikeFileRef(item)) attachmentsHtml += renderAttachmentHtml({ name: item, dataUrl: null }, ev, fieldKey + '.' + idx);
       });
    } else if (value && typeof value === 'object' && value.dataUrl) {
       attachmentsHtml += renderAttachmentHtml(value, ev, fieldKey);
    } else if (typeof value === 'string' && looksLikeFileRef(value)) {
       attachmentsHtml += renderAttachmentHtml({ name: value, dataUrl: null }, ev, fieldKey);
    }
    
    // Use a textarea for all types for simplicity; single-line input could be used for primitives
    var html = '<div class="em-editable-value-wrap" style="position: relative;">';
    if (attachmentsHtml) {
       html += '<div style="margin-bottom: 8px; display: flex; flex-direction: column; gap: 4px;">' + attachmentsHtml + '</div>';
    }
    html += '<textarea class="em-widget-textarea" id="' + inputId + '" data-event-id="' + ev.id + '" data-field-key="' + esc(fieldKey) + '" data-original-type="' + originalType + '" onchange="eventMapUpdateRichField(' + ev.id + ', \'' + esc(fieldKey).replace(/'/g, '\\\'') + '\', this.value, this.getAttribute(\'data-original-type\'))">' + esc(displayValue) + '</textarea>';
    html += '<div style="margin-top: 6px; display: flex; justify-content: flex-end;">';
    html += '<label class="btn btn-sm" style="cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">';
    html += '<i class="fas fa-upload"></i> Upload File';
    html += '<input type="file" style="display: none" onchange="eventMapUploadFieldFile(' + ev.id + ', \'' + esc(fieldKey).replace(/'/g, '\\\'') + '\', this)">';
    html += '</label>';
    html += '</div></div>';
    return html;
  }

  window.eventMapUploadFieldFile = function (eventId, fieldKey, input) {
    var file = input.files[0];
    if (!file) return;
    
    var ev = events.find(function (item) { return item.id === eventId; });
    if (!ev) return;
    
    var reader = new FileReader();
    reader.onload = function(e) {
      var fileObj = {
        name: file.name,
        type: file.type || '',
        dataUrl: e.target.result
      };
      
      // If the field was originally an array, append to it (or replace matching filename string). 
      // Otherwise, replace it.
      var currentValue = ev[fieldKey];
      
      if (Array.isArray(currentValue)) {
        var replaced = false;
        for (var i = 0; i < currentValue.length; i++) {
          if (typeof currentValue[i] === 'string' && currentValue[i] === fileObj.name) {
            currentValue[i] = fileObj;
            replaced = true;
            break;
          }
        }
        if (!replaced) currentValue.push(fileObj);
        ev[fieldKey] = currentValue;
      } else {
        // If it was a matching string, replace it
        if (typeof currentValue === 'string' && currentValue === fileObj.name) {
          ev[fieldKey] = fileObj;
        } else if (currentValue && typeof currentValue === 'string') {
          // If it was some other string, maybe convert to array?
          // Let's just replace it for simplicity, or make it an array.
          ev[fieldKey] = [currentValue, fileObj];
        } else {
          ev[fieldKey] = fileObj;
        }
      }
      
      persistState();
      renderEventDetail(eventId, fieldKey); // re-render sidebar, keeping focus on this field
      renderGraph(); // re-render map in case this affects card
    };
    reader.readAsDataURL(file);
  };

  function saveExpandedFields() {
    try {
      var serialized = {};
      Object.keys(expandedFields).forEach(function (evId) {
        var set = expandedFields[evId];
        serialized[evId] = set && set.forEach ? (function () { var a = []; set.forEach(function (k) { a.push(k); }); return a; }()) : [];
      });
      localStorage.setItem('olivia.eventMap.expandedFields', JSON.stringify(serialized));
    } catch (e) { }
  }

  function loadExpandedFields() {
    try {
      var raw = localStorage.getItem('olivia.eventMap.expandedFields');
      if (!raw) return;
      var parsed = JSON.parse(raw);
      Object.keys(parsed).forEach(function (evId) {
        expandedFields[evId] = new Set(parsed[evId]);
      });
    } catch (e) { }
  }

  window.eventMapToggleRichSection = function (header, evId, fieldKey) {
    var body = header.nextElementSibling;
    if (body && body.classList.contains('em-rich-body')) {
      var nowOpen = header.classList.toggle('open');
      body.classList.toggle('open');
      // Persist expand state
      if (evId !== undefined && fieldKey !== undefined) {
        if (!expandedFields[evId]) expandedFields[evId] = new Set();
        if (nowOpen) {
          expandedFields[evId].add(fieldKey);
        } else {
          expandedFields[evId].delete(fieldKey);
        }
        saveExpandedFields();
      }
    }
  };

  // FIX #15: Only show "Open" button if ref can be opened
  function renderAttachmentHtml(ref, ev, fieldPath) {
    var name = ref.name || 'Attachment';
    var icon = fileIconName(ref) || 'file';
    var canOpen = false;
    if (ref.dataUrl) canOpen = true;
    else if (ref.kind === 'url') canOpen = true;
    else if (ref.kind === 'path') canOpen = true;

    var openBtn = (ev && fieldPath && canOpen)
      ? '<button type="button" class="btn btn-sm" onclick="eventMapOpenFile(' + ev.id + ',\'' + String(fieldPath).replace(/'/g, '\\\'') + '\')">Open</button>'
      : '';

    return '<div class="em-file-attachment"><i class="fas fa-' + icon + ' em-file-icon"></i>' +
      '<span class="em-file-name">' + esc(name) + '</span>' + openBtn + '</div>';
  }

  function renderValue(val, ev, fieldPath) {
    if (val === null || val === undefined) return '<span class="em-kv-value">null</span>';
    if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
      if (typeof val === 'string') {
        var ref = looksLikeFileRef(val);
        if (ref) return renderAttachmentHtml({ name: ref, dataUrl: null }, ev, fieldPath);
      }
      return '<span class="em-kv-value">' + esc(String(val)) + '</span>';
    }
    if (typeof val === 'object' && !Array.isArray(val) && val.dataUrl) {
      return renderAttachmentHtml(val, ev, fieldPath);
    }
    if (Array.isArray(val)) {
      if (val.length === 0) return '<span class="em-kv-value">(empty array)</span>';
      var items = val.map(function (item, idx) {
        if (typeof item === 'object' && item !== null) {
          return '<div class="em-array-item"><strong>[' + idx + ']</strong> ' + renderValue(item, ev, fieldPath ? fieldPath + '.' + idx : fieldPath) + '</div>';
        }
        return '<div class="em-array-item"><strong>[' + idx + ']</strong> ' + renderValue(item, ev, fieldPath ? fieldPath + '.' + idx : fieldPath) + '</div>';
      }).join('');
      return items;
    }
    if (typeof val === 'object') {
      var rows = Object.keys(val).map(function (k) {
        return '<div class="em-kv-row"><span class="em-kv-key">' + esc(k) + ':</span> ' + renderValue(val[k], ev, fieldPath ? fieldPath + '.' + k : k) + '</div>';
      }).join('');
      return rows;
    }
    return '';
  }

  window.eventMapUpdateEvent = function (id, field, value) {
    var ev = events.find(function (e) { return e.id === id; });
    if (!ev) return;
    if (field === 'date' && value) {
      var d = safeDate(value);
      ev[field] = d ? d.toISOString() : value;
    } else {
      ev[field] = value;
    }
    if (field === 'category' || field === 'date') renderGraph();
    if (field === 'date') renderTimeline();
    if (field === 'entities') renderEntities();
    persistState();
  };

  window.eventMapCategoryChanged = function (id, select) {
    var ev = events.find(function (e) { return e.id === id; });
    if (!ev) return;
    var value = select.value;
    if (value === '__add__') {
      var row = document.getElementById('emAddCategoryRow-' + id);
      var input = document.getElementById('emAddCategoryInput-' + id);
      if (row) row.style.display = 'flex';
      if (input) input.focus();
      return;
    }
    ev.category = value;
    renderGraph();
    persistState();
  };

  window.eventMapConfirmNewCategory = function (id) {
    var ev = events.find(function (e) { return e.id === id; });
    if (!ev) return;
    var input = document.getElementById('emAddCategoryInput-' + id);
    var name = input ? input.value.trim() : '';
    if (!name) {
      eventMapCancelNewCategory(id);
      return;
    }
    if (!EVENT_CATEGORIES[name]) {
      EVENT_CATEGORIES[name] = '#a37eba';
    }
    ev.category = name;
    renderGraph();
    renderLegend();
    renderEventDetail(id);
    persistState();
  };

  window.eventMapCancelNewCategory = function (id) {
    var ev = events.find(function (e) { return e.id === id; });
    var row = document.getElementById('emAddCategoryRow-' + id);
    if (row) row.style.display = 'none';
    if (ev) {
      var select = document.querySelector('#emDetailPanel select.em-widget-select');
      if (select) select.value = ev.category || 'Other';
    }
  };

  // ── New map / case sources ─────────────────────────────────────────────
  var CASE_SOURCE_PATHS = {
    violations: 'cases/la8159/01-violations/index.json',
    transcripts: 'cases/la8159/02-transcripts/transcripts_rendered/index.html',
    emails: 'cases/la8159/09-emails/email_index.json'
  };

  function sharedSourceUrl(path) {
    return '/api/shared/raw?path=' + encodeURIComponent(path);
  }

  function fetchCaseSource(name) {
    return fetch(sharedSourceUrl(CASE_SOURCE_PATHS[name])).then(function (res) {
      if (!res.ok) throw new Error(name + ' source returned HTTP ' + res.status);
      return name === 'transcripts' ? res.text() : res.json();
    });
  }

  // FIX #13: Attempt to parse date from HTML instead of hardcoding
  function transcriptEventsFromHtml(html) {
    var doc = new DOMParser().parseFromString(html, 'text/html');
    return Array.prototype.slice.call(doc.querySelectorAll('a.evidence-card')).map(function (card) {
      var phase = card.closest('.phase-group');
      var text = function (selector) {
        var el = card.querySelector(selector);
        return el ? el.textContent.trim() : '';
      };
      var time = text('.ev-time');
      var date = null;
      if (/^\d{1,2}:\d{2}$/.test(time)) {
        // Try to find a date in the parent phase or document
        var phaseTitle = phase ? textFromElement(phase, '.phase-title') : '';
        var docDate = doc.querySelector('meta[data-date]');
        var dateStr = phaseTitle.match(/\d{4}-\d{2}-\d{2}/) || (docDate && docDate.getAttribute('data-date'));
        if (dateStr) {
          date = dateStr + 'T' + time;
        } else {
          date = '2024-07-05T' + time; // Fallback
        }
      }
      return {
        title: text('h3') || text('.ev-badge') || 'Transcript',
        date: date,
        description: text('.ev-summary'),
        category: 'Transcript',
        entities: [],
        tags: Array.prototype.slice.call(card.querySelectorAll('.ev-tag')).map(function (el) {
          return el.textContent.trim();
        }),
        status: '',
        audio_ref: text('.ev-badge'),
        duration: text('.ev-duration'),
        speakers: text('.ev-speakers'),
        phase: phase ? textFromElement(phase, '.phase-title') : '',
        source_file: card.getAttribute('href') || '',
        source_type: 'transcript'
      };
    });
  }

  function textFromElement(root, selector) {
    var el = root.querySelector(selector);
    return el ? el.textContent.trim() : '';
  }

  function violationEventsFromJson(data) {
    return (Array.isArray(data && data.entries) ? data.entries : []).map(function (entry) {
      var ev = Object.assign({}, entry);
      var entities = (entry.primary_agents || []).concat(entry.supporting_agents || []);
      var tags = Array.isArray(entry.tags) && entry.tags.length ? entry.tags.slice() : [];
      if (!tags.length) {
        if (entry.jurisdiction) tags.push('jurisdiction/' + entry.jurisdiction);
        if (entry.severity) tags.push('severity/' + entry.severity);
      }
      ev.title = entry.title || entry.violation_id || 'Violation';
      ev.date = entry.incident_date || null;
      ev.category = 'Violation';
      ev.description = entry.allegation_summary || entry.summary || '';
      ev.entities = Array.from(new Set(entities));
      ev.tags = tags;
      ev.status = entry.status || '';
      ev.source_type = 'violation';
      return ev;
    });
  }

  function emailEventsFromJson(data) {
    return (Array.isArray(data && data.emails) ? data.emails : []).map(function (email) {
      return Object.assign({}, email, {
        title: email.subject || 'Email',
        date: email.date_utc || null,
        category: 'Email',
        description: email.subject || '',
        entities: [],
        tags: email.folder ? ['folder/' + email.folder] : [],
        status: email.mapped_event_id ? 'mapped' : '',
        source_type: 'email'
      });
    });
  }

  function normalizeImportedEvents(items) {
    return items.map(function (ev, index) {
      var normalized = Object.assign({}, ev);
      normalized.id = index + 1;
      if (normalized.x === undefined) normalized.x = 50 + (index % 5) * 220;
      if (normalized.y === undefined) normalized.y = 50 + Math.floor(index / 5) * 120;
      return normalized;
    });
  }

  function loadSelectedCaseSources(sourceNames) {
    return Promise.all(sourceNames.map(function (name) {
      return fetchCaseSource(name).then(function (data) {
        if (name === 'violations') return violationEventsFromJson(data);
        if (name === 'transcripts') return transcriptEventsFromHtml(data);
        return emailEventsFromJson(data);
      });
    })).then(function (groups) {
      events = normalizeImportedEvents([].concat.apply([], groups));
      links = [];
      selectedEventId = null;
      arrangeEvents();
      renderTimeline();
      renderEntities();
      renderFilters();
      eventMapSwitchPanel('map');
    });
  }

  function closeNewMapDialog() {
    var dialog = document.getElementById('emNewMapDialog');
    if (dialog) dialog.remove();
  }

  window.eventMapNewMap = function () {
    closeNewMapDialog();
    var dialog = document.createElement('div');
    dialog.id = 'emNewMapDialog';
    dialog.className = 'em-new-map-dialog';
    dialog.innerHTML = '<div class="em-new-map-card" role="dialog" aria-modal="true" aria-labelledby="emNewMapTitle">' +
      '<div class="em-new-map-head"><h3 id="emNewMapTitle">Start a new map</h3>' +
      '<button class="btn btn-sm" type="button" data-close title="Close"><i class="fas fa-times"></i></button></div>' +
      '<p class="em-new-map-sub">Choose empty data or refresh the LA8159 case sources.</p>' +
      '<div class="em-new-map-options">' +
      '<button type="button" class="em-new-map-option" data-source="empty"><strong>Empty map</strong><span>Start with no events.</span></button>' +
      '<button type="button" class="em-new-map-option" data-source="violations"><strong>Violations</strong><span>Load the current violations index.</span></button>' +
      '<button type="button" class="em-new-map-option" data-source="transcripts"><strong>Transcripts</strong><span>Load every rendered audio transcript card.</span></button>' +
      '<button type="button" class="em-new-map-option" data-source="emails"><strong>Emails</strong><span>Load the current email index.</span></button>' +
      '<button type="button" class="em-new-map-option em-new-map-option-wide" data-source="all"><strong>All case sources</strong><span>Refresh and combine violations, transcripts, and emails.</span></button>' +
      '</div><div class="em-new-map-status" aria-live="polite"></div></div>';
    document.body.appendChild(dialog);
    dialog.querySelector('[data-close]').addEventListener('click', closeNewMapDialog);
    dialog.addEventListener('click', function (event) {
      if (event.target === dialog) closeNewMapDialog();
    });
    dialog.querySelectorAll('[data-source]').forEach(function (button) {
      button.addEventListener('click', function () {
        var source = button.getAttribute('data-source');
        if (source === 'empty') {
          events = [];
          links = [];
          selectedEventId = null;
          offset = null;
          visibleSources = {};
          fieldFilters = [];
          visibleFieldsBySource = {};
          eventMapAddEvent();
          renderGraph();
          renderTimeline();
          renderEntities();
          renderFilters();
          closeNewMapDialog();
          return;
        }
        var status = dialog.querySelector('.em-new-map-status');
        dialog.querySelectorAll('[data-source]').forEach(function (item) { item.disabled = true; });
        status.textContent = 'Refreshing case sources…';
        var names = source === 'all' ? ['violations', 'transcripts', 'emails'] : [source];
        loadSelectedCaseSources(names).then(closeNewMapDialog).catch(function (error) {
          status.textContent = 'Could not load case data: ' + error.message;
          dialog.querySelectorAll('[data-source]').forEach(function (item) { item.disabled = false; });
        });
      });
    });
  };

  // ── Add / Duplicate / Delete events ────────────────────────────────────
  window.eventMapAddEvent = function () {
    var maxId = events.reduce(function (m, e) { return Math.max(m, e.id); }, 0);
    var newId = maxId + 1;
    var newEv = {
      id: newId,
      title: 'New Event',
      date: new Date().toISOString(),
      description: '',
      category: 'Other',
      entities: [],
      tags: [],
      evidence: [],
      status: '',
      x: (offset ? (window.innerWidth / 2 - offset.x) / scale : 200) + Math.random() * 50,
      y: (offset ? (window.innerHeight / 2 - offset.y) / scale : 100) + Math.random() * 50
    };
    events.push(newEv);
    visibleSources[sourceKey(newEv)] = true;
    renderGraph();
    renderTimeline();
    renderEntities();
    renderFilters();
    selectEvent(newId);
    persistState();
  };

  window.eventMapDuplicateEvent = function (id) {
    var ev = events.find(function (e) { return e.id === id; });
    if (!ev) return;
    closeNodeEditor();
    closeContextMenu();
    var maxId = events.reduce(function (m, e) { return Math.max(m, e.id); }, 0);
    var clone = JSON.parse(JSON.stringify(ev));
    clone.id = maxId + 1;
    clone.x = (ev.x || 0) + 30;
    clone.y = (ev.y || 0) + 30;
    events.push(clone);
    visibleSources[sourceKey(clone)] = true;
    renderGraph();
    renderTimeline();
    renderEntities();
    renderFilters();
    selectEvent(clone.id);
    persistState();
  };

  window.eventMapDeleteEvent = function (id) {
    if (!confirm('Delete this event? Its links will be removed too.')) return;
    closeNodeEditor();
    closeContextMenu();
    events = events.filter(function (e) { return e.id !== id; });
    links = links.filter(function (l) { return l.source !== id && l.target !== id; });
    if (selectedEventId === id) selectedEventId = null;
    renderGraph();
    renderEventDetail(null);
    renderTimeline();
    renderEntities();
    renderFilters();
    persistState();
  };

  // ── Link (arrow) editing ──────────────────────────────────────────────
  window.eventMapToggleLinkMode = function () {
    linkMode = !linkMode;
    linkSourceId = null;
    selectedLinkId = null;
    var btn = document.getElementById('emLinkModeBtn');
    if (btn) btn.classList.toggle('active', linkMode);
    renderGraph();
    renderEventDetail(selectedEventId);
  };

  window.eventMapStartLinkFrom = function (sourceId) {
    linkMode = true;
    linkSourceId = sourceId;
    selectedLinkId = null;
    var btn = document.getElementById('emLinkModeBtn');
    if (btn) btn.classList.add('active');
    renderGraph();
    renderEventDetail(sourceId);
    showLinkHint('Click a target event to create an arrow from this event.');
  };

  function showLinkHint(msg) {
    var hint = document.getElementById('emLinkHint');
    if (!hint) {
      hint = document.createElement('div');
      hint.id = 'emLinkHint';
      hint.className = 'em-link-hint';
      document.body.appendChild(hint);
    }
    hint.textContent = msg;
    hint.classList.add('show');
    clearTimeout(showLinkHint._t);
    showLinkHint._t = setTimeout(function () {
      hint.classList.remove('show');
    }, 3500);
  }

  window.eventMapLinkNode = function (sourceId, targetId) {
    if (sourceId === targetId) return;
    var exists = links.some(function (l) {
      return l.source === sourceId && l.target === targetId;
    });
    if (exists) return;
    links.push({
      id: 'link-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      source: sourceId,
      target: targetId,
      type: 'related to'
    });
    persistState();
    renderGraph();
  };

  window.eventMapRemoveLink = function (linkId) {
    links = links.filter(function (l) { return l.id !== linkId; });
    if (selectedLinkId === linkId) selectedLinkId = null;
    persistState();
    renderGraph();
    renderEventDetail(selectedEventId);
  };

  window.eventMapSetLinkType = function (linkId, type) {
    var link = links.find(function (l) { return l.id === linkId; });
    if (!link) return;
    link.type = type;
    persistState();
    renderGraph();
    renderEventDetail(selectedEventId);
  };

  // ── Timeline view ─────────────────────────────────────────────────────
  function renderTimeline() {
    var container = document.getElementById('emTimelineList');
    if (!container) return;
    if (!events.length) {
      container.innerHTML = '<div class="em-timeline-empty">No events yet. Click "New" to add one.</div>';
      return;
    }
    var filtered = events.filter(isVisibleEvent);
    if (!filtered.length) {
      container.innerHTML = '<div class="em-timeline-empty">No events match current filters.</div>';
      return;
    }
    filtered.sort(function (a, b) {
      var da = safeDate(a.date || a.recording_datetime || a.incident_date || a.date_utc);
      var db = safeDate(b.date || b.recording_datetime || b.incident_date || b.date_utc);
      return (da ? da.getTime() : 0) - (db ? db.getTime() : 0);
    });
    var html = '<div class="em-timeline-list">';
    filtered.forEach(function (ev) {
      var isSelected = ev.id === selectedEventId;
      var dateStr = ev.date || ev.recording_datetime || ev.incident_date || ev.date_utc || 'No date';
      var tlDate = safeDate(dateStr);
      html += '<div class="em-timeline-card' + (isSelected ? ' selected' : '') + '" onclick="eventMapSelectFromTimeline(' + ev.id + ')">';
      html += '<div class="em-timeline-date">' + esc(tlDate ? tlDate.toLocaleString() : dateStr) + '</div>';
      html += '<div class="em-timeline-title">' + esc(ev.title || ev.violation_id || ev.transcript_id || ev.subject || 'Untitled') + ' <span class="em-node-id">#' + ev.id + '</span></div>';
      if (ev.description || ev.summary) html += '<div class="em-timeline-desc">' + esc(ev.description || ev.summary) + '</div>';
      if (ev.tags && ev.tags.length) {
        html += '<div class="em-timeline-tags">';
        ev.tags.forEach(function (tag) {
          html += '<span class="em-tag">' + esc(tag) + '</span>';
        });
        html += '</div>';
      }
      html += '</div>';
    });
    html += '</div>';
    container.innerHTML = html;
  }

  window.eventMapSelectFromTimeline = function (id) {
    selectEvent(id);
    if (activePanel !== 'map') eventMapSwitchPanel('map');
  };

  // ── Entities view ─────────────────────────────────────────────────────
  function renderEntities() {
    var container = document.getElementById('emEntitiesList');
    if (!container) return;
    if (!events.length) {
      container.innerHTML = '<div class="em-entities-empty">No entities found.</div>';
      return;
    }
    var entityCounts = {};
    events.filter(function (ev) { return nodeIsVisible(ev) && visibleSources[sourceKey(ev)] !== false; }).forEach(function (ev) {
      var ents = ev.entities || [];
      if (ev.participants) {
        ev.participants.forEach(function (p) {
          if (p.canonical_name) ents.push(p.canonical_name);
          if (p.speaker_label) ents.push(p.speaker_label);
        });
      }
      ents.forEach(function (ent) {
        entityCounts[ent] = (entityCounts[ent] || 0) + 1;
      });
    });
    var entityNames = Object.keys(entityCounts).sort();
    if (!entityNames.length) {
      container.innerHTML = '<div class="em-entities-empty">No entities mentioned in any event.</div>';
      return;
    }
    var html = '<div class="em-entities-list">';
    entityNames.forEach(function (ent) {
      var isActive = entityFilter.indexOf(ent) !== -1;
      html += '<div class="em-entity-chip' + (isActive ? ' active' : '') + '" onclick="eventMapFilterByEntity(\'' + esc(ent).replace(/'/g, '\\\'') + '\')">' +
        esc(ent) + ' <span class="em-entity-count">' + entityCounts[ent] + '</span></div>';
    });
    html += '</div>';
    container.innerHTML = html;
  }

  window.eventMapFilterByEntity = function (entity) {
    var idx = entityFilter.indexOf(entity);
    if (idx !== -1) {
      entityFilter.splice(idx, 1); // deselect
    } else {
      entityFilter.push(entity); // select
    }
    renderEntities();
    renderGraph();
    renderTimeline();
  };

  // ── Import (supports auto-detection of format) ────────────────────────
  window.eventMapImportEvents = function () {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = function (e) {
      var file = e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function (ev) {
        try {
          var data = JSON.parse(ev.target.result);
          importData(data);
        } catch (err) {
          alert('Invalid JSON file: ' + err.message);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  function importData(data) {
    if (data && Array.isArray(data.events)) {
      // Our own format
      events = data.events;
      links = (data.links || []).map(function (link) {
        return {
          id: link.id || 'link-' + Math.random().toString(36).substr(2, 6),
          source: link.source,
          target: link.target,
          type: link.type || 'related to'
        };
      });
    } else if (data && data.transcript_id && data.segments) {
      // Transcript format
      events = [transcriptToEvent(data)];
      links = [];
    } else if (data && data.meta && Array.isArray(data.entries)) {
      // Violations index format ({ meta, entries })
      var map = violationIndexToMap(data.entries);
      events = map.events;
      links = map.links;
    } else if (isViolation(data)) {
      // Single violation object (e.g. CL-001.json) → full map
      var singleMap = violationToMap(data);
      events = singleMap.events;
      links = singleMap.links;
    } else if (Array.isArray(data) && data.length && data.every(isViolation)) {
      // Array of violation objects → full map
      var arrMap = violationIndexToMap(data);
      events = arrMap.events;
      links = arrMap.links;
    } else if (data && Array.isArray(data.emails)) {
      // Emails index format
      events = data.emails.map(emailToEvent);
      links = [];
    } else {
      alert('Unrecognized JSON format.');
      return;
    }

    // Assign positions and IDs if needed
    events.forEach(function (ev, i) {
      if (!ev.id) ev.id = i + 1;
      if (ev.x === undefined) ev.x = 50 + (i % 5) * 220;
      if (ev.y === undefined) ev.y = 50 + Math.floor(i / 5) * 120;
    });

    selectedEventId = null;
    offset = null;
    renderGraph();
    renderTimeline();
    renderEntities();
    renderFilters();
    eventMapSwitchPanel('map');
    persistState();
  }

  function isViolation(v) {
    return v && typeof v === 'object' && !Array.isArray(v) &&
      (typeof v.violation_id === 'string' || typeof v.incident_id === 'string') &&
      (v.legal_basis || v.element_grids || v.allegation_summary || v.incident_timestamp);
  }

  function ensureCategory(cat) {
    if (cat && !EVENT_CATEGORIES[cat]) EVENT_CATEGORIES[cat] = '#a37eba';
    return cat;
  }

  function transcriptToEvent(t) {
    var ev = Object.assign({}, t);
    ev.title = t.title || t.transcript_id || 'Transcript';
    ev.date = t.recording_datetime || (t.metadata && t.metadata.timestamps && t.metadata.timestamps.File_Modified_Date) || null;
    ev.category = 'Transcript';
    ev.description = t.subtitle || t.summary || '';
    ev.entities = t.participants ? t.participants.map(function (p) { return p.canonical_name; }).filter(Boolean) : [];
    ev.tags = t.tags || [];
    ev.status = t.status || '';
    return ev;
  }

  function violationToEvent(v) {
    var ev = Object.assign({}, v);
    ev.title = v.title || v.violation_id || 'Violation';
    ev.date = v.incident_timestamp || v.incident_date || v.date_utc || null;
    ev.category = ensureCategory(v.category || 'Violation');
    ev.description = v.allegation_summary || v.summary || '';
    ev.entities = [];
    if (v.aliases && Array.isArray(v.aliases)) ev.entities = ev.entities.concat(v.aliases);
    if (v.key_admissions && Array.isArray(v.key_admissions)) {
      v.key_admissions.forEach(function (ka) {
        if (ka && ka.speaker) ev.entities.push(ka.speaker);
      });
    }
    ev.entities = Array.from(new Set(ev.entities.filter(Boolean)));
    ev.tags = (v.tags || []).slice();
    if (v.severity) ev.tags.push(v.severity);
    if (v.jurisdiction) ev.tags.push(v.jurisdiction);
    ev.status = v.required_elements_status || v.status || '';

    if (v.incident) ev.incident = v.incident;
    if (v.incident_id) ev.incident_id = v.incident_id;
    if (v.severity) ev.severity = v.severity;
    if (v.jurisdiction) ev.jurisdiction = v.jurisdiction;
    if (v.legal_theory) ev.legal_theory = v.legal_theory;
    if (v.legal_reasoning) ev.legal_reasoning = v.legal_reasoning;
    if (v.evidentiary_strength) ev.evidentiary_strength = v.evidentiary_strength;
    if (v.confidence && typeof v.confidence === 'object' && v.confidence.value !== undefined) {
      ev.confidence = v.confidence.value;
    }
    if (v.legal_basis && Array.isArray(v.legal_basis)) {
      ev.legal_basis_summary = v.legal_basis.map(function (lb) {
        return (lb.article_id || '') + (lb.applicability ? ' [' + lb.applicability + ']' : '');
      }).join(', ');
    }
    if (v.element_grids && typeof v.element_grids === 'object') {
      ev.element_grids_summary = Object.keys(v.element_grids).map(function (article) {
        var grid = v.element_grids[article];
        var established = Array.isArray(grid) ? grid.filter(function (el) { return el && el.status === 'established'; }).length : 0;
        var total = Array.isArray(grid) ? grid.length : 0;
        return article + ' (' + established + '/' + total + ' established)';
      }).join(', ');
    }
    return ev;
  }

  function violationToMap(v) {
    var events = [];
    var links = [];
    var idCounter = 1;
    var cat = ensureCategory(v.category || 'Violation');

    function addEvent(partial) {
      var ev = Object.assign({}, partial);
      ev.id = idCounter++;
      ev.x = partial.x !== undefined ? partial.x : 0;
      ev.y = partial.y !== undefined ? partial.y : 0;
      events.push(ev);
      return ev;
    }
    function addLink(source, target, type) {
      links.push({ id: 'link-' + idCounter + '-' + Math.random().toString(36).substr(2, 5), source: source, target: target, type: type || 'related to' });
    }

    var central = addEvent({
      title: v.title || v.violation_id || 'Violation',
      date: v.incident_timestamp || v.incident_date || v.date_utc || null,
      category: cat,
      description: v.allegation_summary || v.summary || '',
      status: v.required_elements_status || v.status || '',
      severity: v.severity || '',
      jurisdiction: v.jurisdiction || '',
      incident: v.incident || '',
      incident_id: v.incident_id || '',
      legal_theory: v.legal_theory || '',
      legal_reasoning: v.legal_reasoning || '',
      evidentiary_strength: v.evidentiary_strength || '',
      confidence: (v.confidence && typeof v.confidence === 'object' && v.confidence.value !== undefined) ? v.confidence.value : undefined,
      violation_id: v.violation_id || '',
      source_type: 'violation',
      tags: (v.tags || []).slice(),
      entities: [],
      x: 0, y: 0
    });
    if (v.aliases && Array.isArray(v.aliases)) central.entities = central.entities.concat(v.aliases);
    if (v.key_admissions && Array.isArray(v.key_admissions)) {
      v.key_admissions.forEach(function (ka) { if (ka && ka.speaker) central.entities.push(ka.speaker); });
    }
    central.entities = Array.from(new Set(central.entities.filter(Boolean)));
    if (central.severity) central.tags.push(central.severity);
    if (central.jurisdiction) central.tags.push(central.jurisdiction);

    var articleNodes = {};
    if (v.legal_basis && Array.isArray(v.legal_basis)) {
      v.legal_basis.forEach(function (lb, i) {
        var node = addEvent({
          title: (lb.article_id || 'Article') + (lb.applicability ? ' [' + lb.applicability + ']' : ''),
          category: 'Legal',
          description: lb.article_name || '',
          status: lb.status || '',
          article_id: lb.article_id || '',
          applicability: lb.applicability || '',
          verbatim_text: lb.verbatim_text || '',
          penalty: lb.penalty || '',
          source_type: 'legal_basis',
          tags: ['legal', lb.applicability || ''],
          entities: [],
          x: 0, y: 0
        });
        articleNodes[lb.article_id] = node.id;
        addLink(central.id, node.id, 'involved');
      });
    }

    if (v.element_grids && typeof v.element_grids === 'object') {
      Object.keys(v.element_grids).forEach(function (article) {
        var grid = v.element_grids[article];
        if (!Array.isArray(grid)) return;
        var parentId = articleNodes[article];
        grid.forEach(function (el, i) {
          if (!el || !el.element_name) return;
          var node = addEvent({
            title: el.element_name,
            category: 'Legal',
            description: el.argument || '',
            status: el.status || '',
            element_status: el.status || '',
            evidence: (el.evidence || []).join(', '),
            source_type: 'element',
            tags: ['element', el.status || ''],
            entities: [],
            x: 0, y: 0
          });
          if (parentId) addLink(parentId, node.id, 'documented by');
          else addLink(central.id, node.id, 'documented by');
        });
      });
    }

    var admissionGroups = {};
    if (v.key_admissions && Array.isArray(v.key_admissions)) {
      v.key_admissions.forEach(function (ka) {
        if (!ka) return;
        var group = ka.group || 'Admission';
        if (!admissionGroups[group]) admissionGroups[group] = [];
        admissionGroups[group].push(ka);
      });
    }
    Object.keys(admissionGroups).forEach(function (group) {
      var items = admissionGroups[group];
      var node = addEvent({
        title: group,
        category: 'Transcript',
        description: items.map(function (ka) {
          return (ka.speaker || '') + ': ' + (ka.translation || ka.text || '');
        }).join('\n\n'),
        status: '',
        source_type: 'admission',
        tags: ['admission'],
        entities: Array.from(new Set(items.map(function (ka) { return ka.speaker; }).filter(Boolean))),
        x: 0, y: 0
      });
      addLink(central.id, node.id, 'documented by');
    });

    if (v.evidence && Array.isArray(v.evidence)) {
      v.evidence.forEach(function (e) {
        if (!e) return;
        var node = addEvent({
          title: e.id || e.source || 'Evidence',
          category: 'Transcript',
          description: (e.relevance || '') + (e.source ? '\nSource: ' + e.source : ''),
          status: '',
          source_type: 'evidence',
          tags: ['evidence', e.type || ''],
          entities: [],
          x: 0, y: 0
        });
        addLink(central.id, node.id, 'documented by');
      });
    }

    var related = v.related_violations || [];
    if (v.cross_references && Array.isArray(v.cross_references)) {
      v.cross_references.forEach(function (cr) {
        if (cr && cr.ref && related.indexOf(cr.ref) === -1) related.push(cr.ref);
      });
    }
    related.forEach(function (ref) {
      var node = addEvent({
        title: ref,
        category: 'Violation',
        description: 'Related violation (not imported)',
        status: '',
        source_type: 'related',
        tags: ['related'],
        entities: [],
        x: 0, y: 0
      });
      addLink(central.id, node.id, 'related to');
    });

    var centerX = 0, centerY = 0;
    central.x = centerX; central.y = centerY;
    var ring = 0, ringIndex = 0;
    var ringCounts = [6, 12, 18];
    var others = events.filter(function (e) { return e.id !== central.id; });
    others.forEach(function (e) {
      var count = ringCounts[ring] || 18;
      var angle = (ringIndex / count) * Math.PI * 2;
      var radius = 260 + ring * 220;
      e.x = centerX + Math.cos(angle) * radius;
      e.y = centerY + Math.sin(angle) * radius;
      ringIndex++;
      if (ringIndex >= count) { ringIndex = 0; ring++; }
    });

    return { events: events, links: links };
  }

  function violationIndexToMap(violations) {
    var allEvents = [];
    var allLinks = [];
    var offsetX = 0;
    violations.forEach(function (v) {
      var m = violationToMap(v);
      var clusterMinX = Infinity, clusterMaxX = -Infinity;
      m.events.forEach(function (e) {
        if (e.x < clusterMinX) clusterMinX = e.x;
        if (e.x > clusterMaxX) clusterMaxX = e.x;
      });
      var shift = offsetX - clusterMinX;
      m.events.forEach(function (e) { e.x += shift; });
      offsetX = clusterMaxX + shift + 320;
      allEvents = allEvents.concat(m.events);
      allLinks = allLinks.concat(m.links);
    });
    return { events: allEvents, links: allLinks };
  }

  function emailToEvent(m) {
    var ev = {
      title: m.subject || 'Email',
      date: m.date_utc || null,
      category: 'Email',
      description: '',
      entities: [],
      tags: [],
      status: '',
      subject: m.subject,
      from: m.from,
      to: m.to,
      message_id: m.message_id,
      filename: m.filename,
      path: m.path,
      folder: m.folder,
      mapped_event_id: m.mapped_event_id
    };
    return ev;
  }

  // ── Persistence (localStorage) ─────────────────────────────────────────
  var STORAGE_KEY = 'olivia.eventMap.v1';

  // FIX #12: Persist scale and offset
  function persistState() {
    try {
      var panel = document.getElementById('emDetailPanel');
      var panelWidth = panel ? panel.getBoundingClientRect().width : null;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        events: events,
        links: links,
        categories: EVENT_CATEGORIES,
        panelWidth: panelWidth,
        visibleSources: visibleSources,
        visibleFieldsBySource: visibleFieldsBySource,
        fieldFilters: fieldFilters,
        scale: scale,
        offset: offset
      }));
    } catch (err) {
      // storage may be unavailable; ignore
    }
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      var data = JSON.parse(raw);
      if (data.events && Array.isArray(data.events)) events = data.events;
      if (data.links && Array.isArray(data.links)) links = data.links;
      if (data.categories && typeof data.categories === 'object') {
        Object.keys(data.categories).forEach(function (cat) {
          EVENT_CATEGORIES[cat] = data.categories[cat];
        });
      }
      if (data.panelWidth) {
        var panel = document.getElementById('emDetailPanel');
        if (panel) panel.style.width = Math.max(240, Math.min(640, Number(data.panelWidth))) + 'px';
      }
      if (data.visibleSources && typeof data.visibleSources === 'object') visibleSources = data.visibleSources;
      if (data.visibleFieldsBySource && typeof data.visibleFieldsBySource === 'object') visibleFieldsBySource = data.visibleFieldsBySource;
      if (data.fieldFilters && Array.isArray(data.fieldFilters)) fieldFilters = data.fieldFilters;
      if (data.scale && typeof data.scale === 'number') scale = data.scale;
      if (data.offset && typeof data.offset === 'object') offset = data.offset;
      return true;
    } catch (err) {
      return false;
    }
  }

  window.eventMapClearSaved = function () {
    try { localStorage.removeItem(STORAGE_KEY); } catch (err) { }
    alert('Saved event map cleared.');
  };

  // ── Export / Save ──────────────────────────────────────────────────────
  window.eventMapExportEvents = function () {
    var data = { events: events, links: links };
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'event-map.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  window.eventMapSaveEvents = function () {
    persistState();
    alert('Event map saved to this browser.');
    var api = (typeof API_BASE === 'string' && API_BASE) ? API_BASE.replace(/\/$/, '') : window.location.origin;
    fetch(api + '/api/event-map/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: events, links: links, name: 'event_map' })
    }).then(function (res) {
      if (res.ok) alert('Event map saved to workspace.');
      else alert('Save to workspace failed (saved locally).');
    }).catch(function () { alert('Save failed.'); });
  };

  // ── Graph controls ────────────────────────────────────────────────────
  function zoomAtCenter(factor) {
    var container = document.getElementById('emGraphContainer');
    if (!container || !offset) { scale *= factor; renderGraph(); return; }
    var rect = container.getBoundingClientRect();
    var cx = rect.width / 2, cy = rect.height / 2;
    var graphX = (cx - offset.x) / scale, graphY = (cy - offset.y) / scale;
    scale = Math.max(0.1, Math.min(3, scale * factor));
    offset = { x: cx - graphX * scale, y: cy - graphY * scale };
    renderGraph();
  }
  window.eventMapZoomIn = function () { zoomAtCenter(1.2); };
  window.eventMapZoomOut = function () { zoomAtCenter(1 / 1.2); };
  window.eventMapZoomFit = function () { offset = null; renderGraph(); };

  // ── View life cycle ────────────────────────────────────────────────────
  window.eventMapShowView = function () {
    build();
    var ids = ['chatHeader', 'welcomeState', 'chatLog', 'chatCompose', 'chatToolbar'];
    ids.forEach(function (id) {
      var el = document.getElementById(id); if (el) el.style.display = 'none';
    });
    var mc = document.querySelector('.main-content');
    if (mc) { mc._emDisplay = mc.style.display; mc.style.display = 'none'; }
    var v = document.getElementById('eventMapView');
    if (v) v.classList.add('active');
    var ws = document.querySelector('.workspace');
    if (ws) ws.classList.add('em-open');
    renderGraph();
    renderTimeline();
    renderEntities();
  };

  window.eventMapHideView = function () {
    var v = document.getElementById('eventMapView');
    if (v) v.classList.remove('active');
    var ws = document.querySelector('.workspace');
    if (ws) ws.classList.remove('em-open');
    var mc = document.querySelector('.main-content');
    if (mc) { mc.style.display = mc._emDisplay !== undefined ? mc._emDisplay : ''; delete mc._emDisplay; }
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
      'socialMediaShowView', 'craudioShowView', 'outreachShowView', 'resetToWelcome', 'aexToggleMain',
      'comfyuiShowView'];
    names.forEach(function (n) {
      var orig = window[n];
      if (typeof orig !== 'function' || orig._emWrapped) return;
      var wrapped = function () {
        try { window.eventMapHideView(); } catch (_e) { }
        return orig.apply(this, arguments);
      };
      wrapped._emWrapped = true;
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