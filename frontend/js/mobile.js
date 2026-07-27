/* =====================================================================
   js/mobile.js — Mobile touch enhancements for Olivia Workspace
   Source: projects/frontend-mobile/writer/Current Mobile Implementation Analysis.md (section 5)
   Loaded after core scripts. Does NOT redefine toggleMobileMenu /
   toggleMobileSidebar / scrollHintsCarousel (those live in nav.js / tabs.js).
   ===================================================================== */
(function () {
  'use strict';

  if (!document.addEventListener) return;

  // ── Sidebar swipe-to-open / close (additive) ──
  var touchStartX = 0;
  var touchStartY = 0;
  var isSwiping = false;

  document.addEventListener('touchstart', function (e) {
    var target = e.target;
    if (target.closest('.sidebar') || target.closest('.mobile-dropdown') ||
        target.closest('.chat-compose') || target.closest('.modal')) {
      return;
    }
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    isSwiping = false;
  }, { passive: true });

  document.addEventListener('touchmove', function (e) {
    if (touchStartX === undefined) return;
    var dx = e.touches[0].clientX - touchStartX;
    var dy = e.touches[0].clientY - touchStartY;

    if (Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      isSwiping = true;
      var sidebar = document.getElementById('sidebarEl');
      if (!sidebar) return;

      // Swipe right from left edge → open sidebar
      if (touchStartX < 40 && dx > 30 && !sidebar.classList.contains('open')) {
        e.preventDefault();
        if (typeof toggleMobileSidebar === 'function') toggleMobileSidebar();
        touchStartX = undefined;
        return;
      }

      // Swipe left when sidebar is open → close
      if (dx < -30 && sidebar.classList.contains('open')) {
        e.preventDefault();
        if (typeof toggleMobileSidebar === 'function') toggleMobileSidebar();
        touchStartX = undefined;
        return;
      }
    }
  }, { passive: false });

  document.addEventListener('touchend', function () {
    touchStartX = undefined;
    touchStartY = undefined;
  }, { passive: true });

  // ── Carousel swipe: handled natively by CSS scroll-snap ──
  // No JS gesture tracking needed; the .hints-carousel-track uses
  // `scroll-snap-type: x mandatory` (responsive-mobile.css §4), so removing
  // the empty touch listeners avoids needless passive listeners.

  // ── Auto-resize textarea with touch-friendly height ──
  function autoResize(ta) {
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  }
  document.querySelectorAll('.compose-textarea, .studio-ai-input').forEach(function (ta) {
    ta.addEventListener('input', function () { autoResize(this); });
    autoResize(ta);
  });

  // ── Detect if device is mobile ──
  // Primary signal is viewport width; touch capability is secondary so hybrid
  // touch-laptops at desktop widths don't get the mobile UI forced on them.
  window.isMobileDevice = function () {
    return window.innerWidth < 768;
  };

  // ── Keyboard: Escape closes modals/sidebar/dropdown ──
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      var sidebar = document.getElementById('sidebarEl');
      if (sidebar && sidebar.classList.contains('open') && typeof toggleMobileSidebar === 'function') {
        toggleMobileSidebar();
      }
      var dropdown = document.getElementById('mobileDropdown');
      if (dropdown && dropdown.classList.contains('open') && typeof toggleMobileMenu === 'function') {
        toggleMobileMenu();
      }
    }
  });

  // ── NOTE: double-tap-zoom suppression removed ──
  // The duplicate touchend handler with a 300ms throttle could swallow
  // legitimate taps on some Android browsers. Zoom prevention is already
  // covered by `user-scalable=no` in the viewport meta tag.

  // ── Lazy load heavy panels on mobile ──
  if (window.isMobileDevice && window.isMobileDevice()) {
    document.querySelectorAll('[data-lazy-load]').forEach(function (el) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            var src = el.dataset.lazySrc;
            if (src) el.src = src;
            observer.unobserve(el);
          }
        });
      }, { rootMargin: '200px' });
      observer.observe(el);
    });
  }
})();
