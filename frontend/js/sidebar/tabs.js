/* ═══════════════════════════════════════════════════════════════════
   SIDEBAR MODULE - Sidebar tabs, collapse/expand, resize functionality
   ═══════════════════════════════════════════════════════════════════ */

// Global timer for tabs dock
let _tabsDockTimer = null;
let _sidebarOutsideClickBound = false;

// Initialize tabs dock with hover/click behavior
function initTabsDock() {
  const tabs = document.getElementById('sidebarTabs');
  const trigger = document.getElementById('tabsTrigger');
  if (!tabs || !trigger) return;

  function expand() {
    clearTimeout(_tabsDockTimer);
    tabs.classList.add('expanded');
    _tabsDockTimer = setTimeout(() => {
      if (!tabs.matches(':hover')) tabs.classList.remove('expanded');
    }, 3000);
  }

  function collapse() {
    _tabsDockTimer = setTimeout(() => tabs.classList.remove('expanded'), 400);
  }

  trigger.addEventListener('mouseenter', expand);
  trigger.addEventListener('click', () => {
    if (tabs.classList.contains('expanded')) tabs.classList.remove('expanded');
    else expand();
  });
  tabs.addEventListener('mouseenter', () => clearTimeout(_tabsDockTimer));
  tabs.addEventListener('mouseleave', collapse);

  // If the dock starts expanded (default in markup for discoverability),
  // auto-collapse after a generous delay unless the user is interacting.
  if (tabs.classList.contains('expanded')) {
    clearTimeout(_tabsDockTimer);
    _tabsDockTimer = setTimeout(() => {
      if (!tabs.matches(':hover')) tabs.classList.remove('expanded');
    }, 6000);
  }
}

// Expand tabs dock (called from outside)
function expand() {
  const tabs = document.getElementById('sidebarTabs');
  if (!tabs) return;
  clearTimeout(_tabsDockTimer);
  tabs.classList.add('expanded');
  _tabsDockTimer = setTimeout(() => {
    if (!tabs.matches(':hover')) tabs.classList.remove('expanded');
  }, 3000);
}

// Collapse tabs dock (called from outside)
function collapse() {
  const tabs = document.getElementById('sidebarTabs');
  if (tabs) {
    _tabsDockTimer = setTimeout(() => tabs.classList.remove('expanded'), 400);
  }
}

function fallbackShowListeningView() {
  const mc = document.querySelector('.main-content');
  if (mc) {
    mc._lsDisplay = mc.style.display;
    mc.style.display = 'none';
  }
  ['chatHeader','welcomeState','chatLog','chatCompose','chatToolbar'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  const lv = document.getElementById('listeningView');
  if (lv) lv.classList.add('active');
}

function fallbackHideListeningView() {
  const lv = document.getElementById('listeningView');
  if (lv) lv.classList.remove('active');
  const mc = document.querySelector('.main-content');
  if (mc) {
    mc.style.display = mc._lsDisplay !== undefined ? mc._lsDisplay : '';
    delete mc._lsDisplay;
  }
  ['chatHeader','welcomeState','chatLog','chatCompose','chatToolbar'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = '';
  });
}

function fallbackShowStudioView() {
  const hide = ['chatHeader','welcomeState','chatLog','chatCompose','chatToolbar'];
  hide.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  const mc = document.querySelector('.main-content');
  if (mc) {
    mc._stDisplay = mc.style.display;
    mc.style.display = 'none';
  }

  if (typeof studioSetMainSidebarHidden === 'function') {
    studioSetMainSidebarHidden(true);
  } else {
    const sidebar = document.getElementById('sidebarEl') || document.querySelector('.sidebar');
    const expandBtn = document.getElementById('sidebarExpandBtn');
    const mobileOverlay = document.getElementById('mobileSidebarOverlay');
    if (sidebar) sidebar.style.display = 'none';
    if (expandBtn) expandBtn.style.display = 'none';
    if (mobileOverlay) mobileOverlay.classList.remove('visible');
  }

  ['listeningView','descobertaView','memoryView','spacesView','shadersView'].forEach(vid => {
    const viewEl = document.getElementById(vid);
    if (viewEl) viewEl.classList.remove('active');
  });

  const sv = document.getElementById('studioView');
  if (sv) {
    sv.style.display = '';
    sv.classList.add('active');
  }
}

// Switch sidebar tab
function switchSidebarTab(tab) {
  // If leaving studio, hide the studio view first
  const wasStudio = document.querySelector('.sidebar-tab.active[onclick*="studio"]');
  if (wasStudio && tab !== 'studio') {
    if (typeof studioHideView === 'function') studioHideView();
    else if (typeof studioSetMainSidebarHidden === 'function') studioSetMainSidebarHidden(false);
  }
  // If leaving descoberta, hide the descoberta view
  const wasDescoberta = document.querySelector('.sidebar-tab.active[onclick*="descoberta"]');
  if (wasDescoberta && tab !== 'descoberta') discHideView();
  // If leaving listening, hide the listening view
  const wasListening = document.querySelector('.sidebar-tab.active[onclick*="listening"]');
  if (wasListening && tab !== 'listening') {
    if (typeof listeningHideView === 'function') listeningHideView();
    else fallbackHideListeningView();
  }
  // If leaving spaces, hide spaces view
  const wasSpaces = document.querySelector('.sidebar-tab.active[onclick*="spaces"]');
  if (wasSpaces && tab !== 'spaces' && typeof spacesHideView === 'function') spacesHideView();
  // If leaving shaders, hide shaders view
  const wasShaders = document.querySelector('.sidebar-tab.active[onclick*="shaders"]');
  if (wasShaders && tab !== 'shaders' && typeof shadersHideView === 'function') shadersHideView();
  // If leaving memory, hide memory view
  const wasMemory = document.querySelector('.sidebar-tab.active[onclick*="memory"]');
  if (wasMemory && tab !== 'memory' && typeof memoryHideView === 'function') memoryHideView();
  // If leaving master index, hide master index view
  const wasMasterIndex = document.querySelector('.sidebar-tab.active[onclick*="masterindex"]');
  if (wasMasterIndex && tab !== 'masterindex') {
    if (typeof masterIndexHideView === 'function') masterIndexHideView();
    else {
      const mv = document.getElementById('masterIndexView');
      if (mv) mv.classList.remove('active');
    }
  }
  // If leaving craudio, hide craudio view
  const wasCraudio = document.querySelector('.sidebar-tab.active[onclick*="craudio"]');
  if (wasCraudio && tab !== 'craudio' && typeof craudioHideView === 'function') craudioHideView();
  // If leaving outreach, hide outreach view
  const wasOutreach = document.querySelector('.sidebar-tab.active[onclick*="outreach"]');
  if (wasOutreach && tab !== 'outreach' && typeof outreachHideView === 'function') outreachHideView();
  // If leaving comfyui, hide comfyui workflow view
  const wasComfyui = document.querySelector('.sidebar-tab.active[onclick*="comfyui"]');
  if (wasComfyui && tab !== 'comfyui' && typeof comfyuiHideView === 'function') comfyuiHideView();
  // If leaving drive, hide drive view
  const wasDrive = document.querySelector('.sidebar-tab.active[onclick*="drive"]');
  if (wasDrive && tab !== 'drive' && typeof driveHideView === 'function') driveHideView();
  // If leaving writer, hide writer view
  const wasWriter = document.querySelector('.sidebar-tab.active[onclick*="writer"]');
  if (wasWriter && tab !== 'writer' && typeof writerHideView === 'function') writerHideView();
  // If leaving social media, hide social media view
  const wasSocialMedia = document.querySelector('.sidebar-tab.active[onclick*="socialmedia"]');
  if (wasSocialMedia && tab !== 'socialmedia' && typeof socialMediaHideView === 'function') socialMediaHideView();
  // If leaving mermaid, hide the mermaid view
  const wasMermaid = document.querySelector('.sidebar-tab.active[onclick*="mermaid"]');
  if (wasMermaid && tab !== 'mermaid' && typeof mermaidHideView === 'function') mermaidHideView();

  document.querySelectorAll('.sidebar-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.sidebar-section').forEach(s => s.classList.remove('active'));
  
  const tabElement = document.querySelector(`.sidebar-tab[onclick*="${tab}"]`);
  if (tabElement) tabElement.classList.add('active');
  
  const sectionElement = document.getElementById('tab-' + tab);
  if (sectionElement) sectionElement.classList.add('active');
  
  // Update trigger icon to reflect current tab
  const activeTab = document.querySelector('.sidebar-tab.active i');
  const triggerIcon = document.getElementById('triggerIcon');
  if (activeTab && triggerIcon) {
    triggerIcon.className = activeTab.className;
  }
  
  // Collapse dock after selection
  const tabs = document.getElementById('sidebarTabs');
  setTimeout(() => {
    if (tabs) tabs.classList.remove('expanded');
  }, 250);
  
  // Sync tree trunk active branch indicator
  updateActiveBranch(tab);
  
  // Show studio view when Studio tab is selected
  if (tab === 'studio') {
    if (typeof studioShowView === 'function') {
      try {
        studioShowView();
      } catch (err) {
        console.warn('studioShowView failed, applying fallback:', err);
        fallbackShowStudioView();
      }
    } else {
      fallbackShowStudioView();
    }
  }
  
  // Show descoberta view when Descoberta tab is selected
  if (tab === 'descoberta' && typeof discShowView === 'function') discShowView();
  
  // Show listening view when Escuta tab is selected
  if (tab === 'listening') {
    if (typeof listeningShowView === 'function') {
      try {
        listeningShowView();
      } catch (err) {
        console.warn('listeningShowView failed, applying fallback:', err);
        fallbackShowListeningView();
      }
    } else {
      fallbackShowListeningView();
    }
  }
  
  // Show memory view when Memória tab is selected
  if (tab === 'memory' && typeof memoryShowView === 'function') memoryShowView();

  // Show spaces view when Espaço de Contratos tab is selected
  if (tab === 'spaces' && typeof spacesShowView === 'function') spacesShowView();
  // Show shaders view when Espaço de Shaders tab is selected
  if (tab === 'shaders' && typeof shadersShowView === 'function') shadersShowView();

  // Show architecture view when Arquitetura tab is selected
  if (tab === 'architecture' && typeof architectureShowView === 'function') architectureShowView();

  // Ensure API Explorer loads even when opened from tree-branch shortcuts.
  if (tab === 'apiexplorer' && typeof aexInit === 'function') aexInit();
  
  // Load transcripts and project planning overview when files tab is opened
  if (tab === 'files' && typeof loadTranscripts === 'function') loadTranscripts();
  if (tab === 'files' && typeof loadProjectPlanningOverview === 'function') loadProjectPlanningOverview();
  // Load docs tree when docs tab is opened
  if (tab === 'docs' && typeof loadDocsTree === 'function') loadDocsTree();
  // Load shared tree when shared tab is opened
  if (tab === 'shared' && typeof loadSharedDataTree === 'function') loadSharedDataTree();

  // Load legal router status/results when Legal Router tab is opened
  if (tab === 'legalrouter' && typeof legalRouterShowView === 'function') legalRouterShowView();
  else if (tab === 'legalrouter' && typeof legalRouterInit === 'function') legalRouterInit();

  // Load violations explorer (full main view)
  if (tab === 'violations' && typeof violationsShowView === 'function') violationsShowView();
  else if (tab === 'violations' && typeof violationsInit === 'function') violationsInit();

  // Load law library explorer (full main view)
  if (tab === 'lawlib' && typeof lawLibShowView === 'function') lawLibShowView();
  else if (tab === 'lawlib' && typeof lawLibInit === 'function') lawLibInit();

  // Load master index explorer (full main view)
  if (tab === 'masterindex' && typeof masterIndexShowView === 'function') masterIndexShowView();
  else if (tab === 'masterindex' && typeof masterIndexInit === 'function') masterIndexInit();

  // Load projects list when projects tab is opened
  if (tab === 'projects' && typeof loadProjects === 'function') loadProjects();

  // Show craudio view when Craudio tab is selected
  if (tab === 'craudio' && typeof craudioShowView === 'function') craudioShowView();

  // Show outreach view when Outreach tab is selected
  if (tab === 'outreach' && typeof outreachShowView === 'function') outreachShowView();

  // Show comfyui workflow view when ComfyUI tab is selected
  if (tab === 'comfyui' && typeof comfyuiShowView === 'function') comfyuiShowView();

  // Show event map view when Event Map tab is selected
  if (tab === 'eventmap' && typeof eventMapShowView === 'function') eventMapShowView();

  // Show drive view when Drive tab is selected
  if (tab === 'drive' && typeof driveShowView === 'function') {
    driveShowView();
    if (typeof driveUpdateAuthStatus === 'function') driveUpdateAuthStatus();
  }

  // Show writer view when Writer tab is selected
  if (tab === 'writer' && typeof writerShowView === 'function') {
    writerShowView();
  }

  // Show sheets view when Sheets tab is selected
  if (tab === 'sheets' && typeof sheetsShowView === 'function') {
    sheetsShowView();
  }

  // Show mermaid view when Diagramas tab is selected
  if (tab === 'mermaid' && typeof mermaidShowView === 'function') mermaidShowView();
}

// Toggle sidebar collapsed state
function toggleSidebar() {
  const sidebar = document.getElementById('sidebarEl') || document.querySelector('.sidebar');
  if (!sidebar) return;
  
  sidebar.classList.toggle('collapsed');
  // On mobile: use mobile-open class
  if (window.innerWidth <= 768) {
    sidebar.classList.toggle('mobile-open');
    const overlay = document.getElementById('mobileSidebarOverlay');
    if (overlay) overlay.classList.toggle('visible', sidebar.classList.contains('mobile-open'));
  }
}

// Open sidebar directly to a specific tab
function openSidebarToTab(tab) {
  const sidebar = document.getElementById('sidebarEl') || document.querySelector('.sidebar');
  if (!sidebar) return;
  
  if (sidebar.classList.contains('collapsed')) {
    sidebar.classList.remove('collapsed');
  }
  switchSidebarTab(tab);
  updateActiveBranch(tab);
}

// Toggle mobile sidebar (specifically for mobile)
function toggleMobileSidebar() {
  const sidebar = document.getElementById('sidebarEl') || document.querySelector('.sidebar');
  const overlay = document.getElementById('mobileSidebarOverlay');
  if (!sidebar) return;
  
  const isOpening = !sidebar.classList.contains('mobile-open');
  
  if (isOpening) {
    // Remove collapsed to allow sidebar to show
    sidebar.classList.remove('collapsed');
    sidebar.classList.add('mobile-open');
  } else {
    sidebar.classList.remove('mobile-open');
    // Re-collapse after close
    sidebar.classList.add('collapsed');
  }
  
  if (overlay) {
    overlay.classList.toggle('visible', isOpening);
  }
}

// Show/hide mobile trunk strip
function showMobileTrunk() {
  const sidebar = document.getElementById('sidebarEl') || document.querySelector('.sidebar');
  if (!sidebar) return;
  
  const strip = sidebar.querySelector('.sidebar-collapsed-strip');
  
  if (window.innerWidth <= 768) {
    // Mobile: toggle the fixed trunk strip overlay
    if (strip) {
      strip.classList.toggle('show-mobile');
    }
  } else {
    // Desktop: toggle sidebar collapsed state to show/hide trunk
    sidebar.classList.toggle('collapsed');
  }
}

// Toggle focus mode (hide sidebar and other UI)
function toggleFocusMode() {
  const ws = document.querySelector('.workspace');
  if (!ws) return;
  
  ws.classList.toggle('focus-mode');
  const exitBtn = document.getElementById('focusExitBtn');
  if (exitBtn) {
    exitBtn.style.display = ws.classList.contains('focus-mode') ? 'block' : 'none';
  }
}

// Initialize sidebar resize handle
function initSidebarResize() {
  // NOTE: called from core.js DOMContentLoaded — do NOT wrap in another DOMContentLoaded
  const handle = document.getElementById('sidebarResizeHandle');
  const sidebar = document.getElementById('sidebarEl') || document.querySelector('.sidebar');
  if (!handle || !sidebar) return;
  if (handle.dataset.resizeBound === '1') return;
  handle.dataset.resizeBound = '1';

  let dragging = false, startX = 0, startW = 0;

  const stopDragging = () => {
    if (!dragging) return;
    dragging = false;
    handle.classList.remove('dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    document.body.classList.remove('is-panel-resizing');
  };

  handle.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    if (sidebar.classList.contains('collapsed')) return;
    dragging = true;
    startX = e.clientX;
    startW = sidebar.offsetWidth;
    handle.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.body.classList.add('is-panel-resizing');
    e.preventDefault();
  });

  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    const w = Math.min(Math.max(startW + (e.clientX - startX), 220), 540);
    sidebar.style.width = w + 'px';
  });

  document.addEventListener('mouseup', stopDragging);
  window.addEventListener('mouseup', stopDragging, true);
  window.addEventListener('blur', stopDragging);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopDragging();
  });
}

// Initialize click outside sidebar to close
function initSidebarClickOutside() {
  if (_sidebarOutsideClickBound) return;
  _sidebarOutsideClickBound = true;

  document.addEventListener('click', e => {
    const sidebar = document.getElementById('sidebarEl') || document.querySelector('.sidebar');
    if (!sidebar) return;

    const path = (typeof e.composedPath === 'function') ? e.composedPath() : [];
    const inPath = (selectorOrEl) => {
      if (!path || !path.length) return false;
      if (typeof selectorOrEl === 'string') {
        return path.some(node => node && node.nodeType === 1 && typeof node.matches === 'function' && node.matches(selectorOrEl));
      }
      return path.includes(selectorOrEl);
    };

    const isMobile = window.innerWidth <= 768;
    const isSidebarVisible = isMobile
      ? sidebar.classList.contains('mobile-open')
      : !sidebar.classList.contains('collapsed');
    if (!isSidebarVisible) return;

    const clickedInsideSidebar = inPath(sidebar) || sidebar.contains(e.target);
    const clickedSidebarBtn = inPath('.sidebar-expand-btn') || inPath('.mobile-sidebar-btn');
    const clickedModal = inPath('.modal') || inPath('.modal-overlay');
    if (clickedInsideSidebar || clickedSidebarBtn || clickedModal) return;

    if (isMobile) {
      sidebar.classList.remove('mobile-open');
      sidebar.classList.add('collapsed');
      const overlay = document.getElementById('mobileSidebarOverlay');
      if (overlay) overlay.classList.remove('visible');
      return;
    }

    sidebar.classList.add('collapsed');
  });
}

// Update active branch indicator on tree trunk
function updateActiveBranch(tab) {
  const tabMap = ['agents','config','docs','shared','memory','history','files','projects','casebuilder','studio','descoberta','listening','spaces'];
  document.querySelectorAll('.tree-branch').forEach((b, i) => {
    b.classList.toggle('active-branch', tabMap[i] === tab);
  });
}

// Expose functions to window scope
window.initTabsDock = initTabsDock;
window.expand = expand;
window.collapse = collapse;
window.switchSidebarTab = switchSidebarTab;
window.toggleSidebar = toggleSidebar;
window.openSidebarToTab = openSidebarToTab;
window.toggleMobileSidebar = toggleMobileSidebar;
window.showMobileTrunk = showMobileTrunk;
window.toggleFocusMode = toggleFocusMode;
window.initSidebarResize = initSidebarResize;
window.initSidebarClickOutside = initSidebarClickOutside;
window.updateActiveBranch = updateActiveBranch;