/*
 * trunk.js — data-driven navigation "tree trunk".
 *
 * Replaces the previously hardcoded sidebar sections. On init it fetches the
 * current user's profile (/api/user/me), which returns:
 *   - sections:        the allow-list of section ids this user may see
 *                       (admin-controlled via auth_users.sections_json)
 *   - available_sections: the canonical SECTION_REGISTRY from the server
 * It then renders the collapsed tree-branches and the expanded tabs-dock
 * using only the allowed sections, preserving the existing
 * openSidebarToTab / switchSidebarView handlers.
 */
(function () {
  "use strict";

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  // Register sidebar keys for the i18n extractor and mapping
  var SIDEBAR_KEYS = {
    agents: (typeof window.t === 'function') ? window.t('sidebar.agents', 'Agents') : 'Agents',
    config: (typeof window.t === 'function') ? window.t('sidebar.config', 'Configuration') : 'Configuration',
    docs: (typeof window.t === 'function') ? window.t('sidebar.docs', 'Documents') : 'Documents',
    shared: (typeof window.t === 'function') ? window.t('sidebar.shared', 'Shared Data') : 'Shared Data',
    legalrouter: (typeof window.t === 'function') ? window.t('sidebar.legalrouter', 'Legal Router') : 'Legal Router',
    violations: (typeof window.t === 'function') ? window.t('sidebar.violations', 'Violations') : 'Violations',
    lawlib: (typeof window.t === 'function') ? window.t('sidebar.lawlib', 'Law Library') : 'Law Library',
    masterindex: (typeof window.t === 'function') ? window.t('sidebar.masterindex', 'Jurisprudence') : 'Jurisprudence',
    memory: (typeof window.t === 'function') ? window.t('sidebar.memory', 'Memory') : 'Memory',
    history: (typeof window.t === 'function') ? window.t('sidebar.history', 'History') : 'History',
    files: (typeof window.t === 'function') ? window.t('sidebar.files', 'Session Files') : 'Session Files',
    projects: (typeof window.t === 'function') ? window.t('sidebar.projects', 'Projects') : 'Projects',
    casebuilder: (typeof window.t === 'function') ? window.t('sidebar.casebuilder', 'Case Builder') : 'Case Builder',
    studio: (typeof window.t === 'function') ? window.t('sidebar.studio', 'Studio') : 'Studio',
    descoberta: (typeof window.t === 'function') ? window.t('sidebar.descoberta', 'Discovery') : 'Discovery',
    listening: (typeof window.t === 'function') ? window.t('sidebar.listening', 'Listening') : 'Listening',
    spaces: (typeof window.t === 'function') ? window.t('sidebar.spaces', 'Contract Space') : 'Contract Space',
    shaders: (typeof window.t === 'function') ? window.t('sidebar.shaders', 'Shaders Space') : 'Shaders Space',
    apiexplorer: (typeof window.t === 'function') ? window.t('sidebar.apiexplorer', 'API Explorer') : 'API Explorer',
    craudio: (typeof window.t === 'function') ? window.t('sidebar.craudio', 'Craudio') : 'Craudio',
    outreach: (typeof window.t === 'function') ? window.t('sidebar.outreach', 'Outreach') : 'Outreach',
    drive: (typeof window.t === 'function') ? window.t('sidebar.drive', 'Drive') : 'Drive',
    writer: (typeof window.t === 'function') ? window.t('sidebar.writer', 'Writer') : 'Writer',
    socialmedia: (typeof window.t === 'function') ? window.t('sidebar.socialmedia', 'Social Media') : 'Social Media',
    health: (typeof window.t === 'function') ? window.t('sidebar.health', 'Health') : 'Health'
  };

  function getLabel(reg) {
    if (SIDEBAR_KEYS[reg.id]) return SIDEBAR_KEYS[reg.id];
    return (typeof window.t === 'function') ? window.t('sidebar.' + reg.id, reg.label) : reg.label;
  }

  // Section icon comes from the localized agents UI dictionary (window.t('sidebar.<id>.icon'))
  // and falls back to the server-provided Font Awesome class in reg.icon.
  function iconFor(reg) {
    var key = 'sidebar.' + reg.id + '.icon';
    if (typeof window.t === 'function') {
      var ic = window.t(key, null);
      if (ic) return ic;
    }
    return reg.icon;
  }

  function buildBranch(reg, onclick) {
    // collapsed strip leaf
    var branch = el("div", "tree-branch");
    branch.setAttribute("onclick", onclick + "('" + reg.id + "')");
    var btn = el("button", "tree-leaf");
    btn.setAttribute("data-label", getLabel(reg));
    btn.innerHTML = '<i class="fas ' + iconFor(reg) + '"></i>';
    branch.appendChild(btn);
    return branch;
  }

  function buildTab(reg) {
    // expanded dock tab
    var tab = el("button", "sidebar-tab");
    tab.setAttribute("data-label", getLabel(reg));
    var handler = "switchSidebarTab('" + reg.id + "')";
    if (reg.onclick) handler = handler.replace(/^switchSidebarTab/, "switchSidebarTab") ;
    // preserve any extra init fn declared server-side (e.g. aexInit())
    if (reg.onclick) {
      tab.setAttribute("onclick", "switchSidebarTab('" + reg.id + "');" + reg.onclick);
    } else {
      tab.setAttribute("onclick", "switchSidebarTab('" + reg.id + "')");
    }
    tab.innerHTML = '<i class="fas ' + iconFor(reg) + '"></i>';
    return tab;
  }

  function render(allowedIds, registry) {
    var branches = document.getElementById("treeBranches");
    var dock = document.getElementById("tabsDock");
    if (!branches || !dock) return;
    branches.innerHTML = "";
    dock.innerHTML = "";

    var byId = {};
    registry.forEach(function (r) { byId[r.id] = r; });

    var first = null;
    allowedIds.forEach(function (id) {
      var reg = byId[id];
      if (!reg) return;
      branches.appendChild(buildBranch(reg, "openSidebarToTab"));
      var tab = buildTab(reg);
      if (!first) {
        first = tab;
        tab.className = "sidebar-tab active";
        tab.setAttribute("data-active", "1");
      }
      dock.appendChild(tab);
    });

    // Make the first allowed section the active one.
    if (first) {
      var fid = (function () {
        var m = /switchSidebarTab\('([^']+)'\)/.exec(first.getAttribute("onclick") || "");
        return m ? m[1] : null;
      })();
      if (fid && typeof window.switchSidebarTab === "function") {
        try { window.switchSidebarTab(fid); } catch (e) {}
      }
    }
  }

  // Re-render the sidebar using the last-loaded section data (used on language change).
  var _lastAllowed = [];
  var _lastRegistry = [];
  window.trunkRender = function () {
    if (_lastRegistry.length) render(_lastAllowed, _lastRegistry);
  };

  function init() {
    if (typeof window.__trunkLoaded !== "undefined") return;
    window.__trunkLoaded = true;

    // Re-localize icons + labels when the workspace language changes.
    document.addEventListener('olivia:lang-changed', function () { window.trunkRender(); });

    var getFn = typeof window.apiGet === "function" ? window.apiGet : function (url) {
      var base = typeof window.API_BASE !== "undefined" ? window.API_BASE : "";
      return fetch(base + url).then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      });
    };

    getFn("/api/user/me")
      .then(function (me) {
        var allowed = (me && me.sections) || [];
        var registry = (me && me.available_sections) || [];
        if (!registry.length) return;
        _lastAllowed = allowed;
        _lastRegistry = registry;
        render(allowed, registry);
      })
      .catch(function (err) {
        console.warn("[trunk] failed to load sections:", err);
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
