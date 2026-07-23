/* ═══════════════════════════════════════════════════════════════════
   NAV MODULE - Navigation bar and mobile menu functionality
   ═══════════════════════════════════════════════════════════════════ */

// Mobile menu toggle
function toggleMobileMenu() {
  const dropdown = document.getElementById('mobileDropdown');
  const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
  
  if (dropdown) {
    dropdown.classList.toggle('open');
  }
  if (mobileMenuBtn) {
    mobileMenuBtn.classList.toggle('open');
  }
}

// Initialize mobile layout
function initMobile() {
  const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
  if (mobileMenuBtn && !mobileMenuBtn.dataset.bound) {
    mobileMenuBtn.addEventListener('click', toggleMobileMenu);
    mobileMenuBtn.dataset.bound = 'true';
  }
  
  // Close mobile drawer when clicking a link
  document.querySelectorAll('#mobileDropdown a').forEach(link => {
    if (link.dataset.bound) return;
    link.addEventListener('click', () => {
      const dropdown = document.getElementById('mobileDropdown');
      if (dropdown) {
        dropdown.classList.remove('open');
      }
      if (mobileMenuBtn) {
        mobileMenuBtn.classList.remove('open');
      }
    });
    link.dataset.bound = 'true';
  });
  
  // Apply initial mobile layout
  applyMobileLayout();
}

// Apply mobile layout based on screen size
function applyMobileLayout() {
  const isMobile = window.innerWidth <= 768;
  const mobileSidebarBtn = document.getElementById('mobileSidebarBtn');
  const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
  const dropdown = document.getElementById('mobileDropdown');
  const sidebar = document.getElementById('sidebarEl') || document.querySelector('.sidebar');
  const overlay = document.getElementById('mobileSidebarOverlay');
  const strip = sidebar ? sidebar.querySelector('.sidebar-collapsed-strip') : null;
  
  // Show/hide mobile sidebar button
  if (mobileSidebarBtn) {
    mobileSidebarBtn.style.display = isMobile ? 'flex' : 'none';
  }
  
  // Show/hide mobile menu button
  if (mobileMenuBtn) {
    mobileMenuBtn.style.display = isMobile ? 'flex' : 'none';
  }

  if (isMobile) {
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
    return;
  }
  
  // Close mobile dropdown on desktop
  if (dropdown) {
    dropdown.classList.remove('open');
  }
  if (mobileMenuBtn) {
    mobileMenuBtn.classList.remove('open');
  }
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

// Update active navigation link
function updateActiveNavLink(activeLinkId) {
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
  });
  
  const activeLink = document.getElementById(activeLinkId);
  if (activeLink) {
    activeLink.classList.add('active');
  }
}

// Tab switching for top navigation
function switchNavTab(tabId) {
  // Hide all tab contents
  document.querySelectorAll('.nav-tab-content').forEach(tab => {
    tab.style.display = 'none';
  });
  
  // Show selected tab
  const selectedTab = document.getElementById(tabId);
  if (selectedTab) {
    selectedTab.style.display = 'block';
  }
  
  // Update active tab indicator
  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  const activeBtn = document.querySelector(`[data-tab="${tabId}"]`);
  if (activeBtn) {
    activeBtn.classList.add('active');
  }
}

// Expose functions to window scope
window.toggleMobileMenu = toggleMobileMenu;
window.initMobile = initMobile;
window.applyMobileLayout = applyMobileLayout;
window.updateActiveNavLink = updateActiveNavLink;
window.switchNavTab = switchNavTab;