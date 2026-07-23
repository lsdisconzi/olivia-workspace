/* ═══════════════════════════════════════════════════════════════════
   CORE MODULE - App initialization, utilities, event listeners
   ═══════════════════════════════════════════════════════════════════ */

// Core utilities and helpers
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
window.escapeHtml = escapeHtml;

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
window.formatBytes = formatBytes;

function toast(message, kind) {
  const color = kind === 'error' ? 'var(--red)' : (kind === 'success' ? 'var(--green)' : 'var(--blue)');
  const el = document.createElement('div');
  el.textContent = message;
  el.style.cssText = `position:fixed;bottom:20px;right:20px;background:rgba(17,17,17,.92);color:#fff;padding:10px 16px;border-radius:8px;border:1px solid ${color};z-index:10000;font-size:13px;`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2500);
}
window.toast = toast;

function linkifyPaths(text) {
  return text.replace(/(\/[\w\/\.\-]+\.[\w]+)/g, '<span class="path-link">$1</span>');
}

function autoGrow(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = (textarea.scrollHeight) + 'px';
}

function makeEl(tag, className, html) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (html) el.innerHTML = html;
  return el;
}

function isEmbeddedWorkspaceRuntime() {
  try {
    return window.self !== window.top;
  } catch (_e) {
    return true;
  }
}

window.OliviaLegal_EMBED_MODE = isEmbeddedWorkspaceRuntime();

// DOMContentLoaded listener and app initialization
document.addEventListener('DOMContentLoaded', function() {
  const embedMode = !!window.OliviaLegal_EMBED_MODE;
  console.log(`🟢 LA8159 Workspace initialized${embedMode ? ' (embed mode)' : ''}`);
  
  // Initialize mobile layout
  initMobile();
  applyMobileLayout();
  
  // Initialize sidebar resize
  initSidebarResize();
  
  // Initialize sidebar click outside handler
  initSidebarClickOutside();
  
  // Initialize output panel resize
  initOutputResize();

  if (!embedMode) {
    // Load agents and set up initial state
    loadAgents();
    loadModelCatalog();
    restoreApiKeyUI();
    if (typeof restoreWorkspaceConfigUI === 'function') {
      restoreWorkspaceConfigUI();
    }
  } else {
    document.body.classList.add('workspace-embed-mode');
  }
  
  // Set up event listeners for nav
  const hamburger = document.querySelector('.hamburger');
  if (hamburger) {
    hamburger.addEventListener('click', toggleMobileMenu);
  }
  
  // Initial UI state
  if (!embedMode) showWelcomeView();
});

// Mobile layout functions
function initMobile() {
  const hamburger = document.querySelector('.hamburger');
  if (!hamburger) return;
  
  hamburger.addEventListener('click', toggleMobileMenu);
  
  // Close mobile drawer when clicking a link
  document.querySelectorAll('.mobile-drawer a').forEach(link => {
    link.addEventListener('click', () => {
      document.querySelector('.mobile-drawer').classList.remove('open');
      document.querySelector('.hamburger').classList.remove('open');
    });
  });
}

function applyMobileLayout() {
  const sidebar = document.getElementById('sidebarEl') || document.querySelector('.sidebar');
  const overlay = document.getElementById('mobileSidebarOverlay');
  const strip = sidebar ? sidebar.querySelector('.sidebar-collapsed-strip') : null;
  const isMobile = window.innerWidth <= 768;
  
  if (isMobile) {
    // Preserve the wider-layout sidebar state before forcing the mobile sheet behavior.
    if (sidebar) {
      if (!sidebar.dataset.preMobileCollapsed) {
        sidebar.dataset.preMobileCollapsed = sidebar.classList.contains('collapsed') ? 'true' : 'false';
      }
      sidebar.classList.remove('mobile-open');
      sidebar.classList.add('collapsed');
    }
    if (strip) {
      strip.classList.remove('show-mobile');
    }
    if (overlay) {
      overlay.classList.remove('visible');
    }
  } else {
    if (sidebar) {
      sidebar.classList.remove('mobile-open');
      if (sidebar.dataset.preMobileCollapsed) {
        sidebar.classList.toggle('collapsed', sidebar.dataset.preMobileCollapsed === 'true');
        delete sidebar.dataset.preMobileCollapsed;
      }
    }
    if (strip) {
      strip.classList.remove('show-mobile');
    }
    if (overlay) {
      overlay.classList.remove('visible');
    }
  }
}

// Window resize handler
window.addEventListener('resize', applyMobileLayout);

// Expose functions to window scope
window.escapeHtml = escapeHtml;
window.linkifyPaths = linkifyPaths;
window.autoGrow = autoGrow;
window.makeEl = makeEl;
window.initMobile = initMobile;
window.applyMobileLayout = applyMobileLayout;

// window.customPrompt - a beautiful custom async prompt modal dialog
window.customPrompt = function (message, defaultValue) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('promptModalOverlay');
    const modal = document.getElementById('promptModal');
    const title = document.getElementById('promptModalTitle');
    const label = document.getElementById('promptModalLabel');
    const input = document.getElementById('promptModalInput');
    const confirmBtn = document.getElementById('promptModalConfirmBtn');
    const cancelBtn = document.getElementById('promptModalCancelBtn');
    const closeBtn = document.getElementById('promptModalCloseBtn');

    if (!overlay || !modal) {
      // Fallback
      try {
        resolve(prompt(message, defaultValue));
      } catch (e) {
        resolve(null);
      }
      return;
    }

    title.textContent = 'Entrada';
    label.textContent = message;
    input.value = defaultValue || '';
    
    overlay.style.display = 'block';
    modal.style.display = 'block';
    input.focus();
    input.select();

    function cleanUp() {
      overlay.style.display = 'none';
      modal.style.display = 'none';
      confirmBtn.onclick = null;
      cancelBtn.onclick = null;
      closeBtn.onclick = null;
      input.onkeydown = null;
    }

    confirmBtn.onclick = () => {
      const val = input.value;
      cleanUp();
      resolve(val);
    };

    cancelBtn.onclick = closeBtn.onclick = () => {
      cleanUp();
      resolve(null);
    };

    input.onkeydown = (e) => {
      if (e.key === 'Enter') {
        confirmBtn.click();
      } else if (e.key === 'Escape') {
        cancelBtn.click();
      }
    };
  });
};

// window.customConfirm - async confirm dialog that works inside Electron
window.customConfirm = function (message, title) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('confirmModalOverlay');
    const modal = document.getElementById('confirmModal');
    const titleEl = document.getElementById('confirmModalTitle');
    const messageEl = document.getElementById('confirmModalMessage');
    const confirmBtn = document.getElementById('confirmModalConfirmBtn');
    const cancelBtn = document.getElementById('confirmModalCancelBtn');

    if (!overlay || !modal) {
      try { resolve(confirm(message)); } catch (e) { resolve(false); }
      return;
    }

    if (titleEl) titleEl.textContent = title || 'Confirmação';
    if (messageEl) messageEl.textContent = message;

    overlay.style.display = 'block';
    modal.style.display = 'block';
    confirmBtn.focus();

    function cleanUp() {
      overlay.style.display = 'none';
      modal.style.display = 'none';
      confirmBtn.onclick = null;
      cancelBtn.onclick = null;
    }

    confirmBtn.onclick = () => { cleanUp(); resolve(true); };
    cancelBtn.onclick = () => { cleanUp(); resolve(false); };
  });
};