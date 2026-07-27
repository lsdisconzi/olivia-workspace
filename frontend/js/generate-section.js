#!/usr/bin/env node
/*
 * generate-section.js
 * 
 * Usage: node generate-section.js --spec='{"id":"kanban","label":"Kanban","icon":"fa-columns","description":"..."}' --outDir=./sections --registry=./registry.json
 * 
 * Creates:
 *   <outDir>/<id>.js   – fully functional workspace section
 *   <outDir>/<id>.css  – matching stylesheet
 * Adds the section to the registry JSON file.
 */

"use strict";

const fs = require("fs");
const path = require("path");

// ─── Parse CLI arguments ────────────────────────────────────────────────
function parseArgs(args) {
    const parsed = { outDir: "./sections", registry: "./registry.json" };
    args.forEach(arg => {
        const match = arg.match(/^--(.+)=(.+)$/);
        if (match) {
            parsed[match[1]] = match[2];
        }
    });
    return parsed;
}

const cli = parseArgs(process.argv.slice(2));
if (!cli.spec) {
    console.error("Missing --spec argument.");
    process.exit(1);
}

let spec;
try {
    spec = JSON.parse(cli.spec);
} catch (e) {
    console.error("Invalid JSON in --spec");
    process.exit(1);
}

// ─── Validate required fields ──────────────────────────────────────────
const required = ["id", "label", "icon"];
for (const key of required) {
    if (!spec[key]) {
        console.error(`Spec is missing required field: ${key}`);
        process.exit(1);
    }
}

// defaults
spec.description = spec.description || "Custom workspace section";
spec.features = spec.features || ["create", "edit", "delete", "localStorage persistence"];
spec.dataModel = spec.dataModel || { items: "array of {id, title, content, updated}" };

// ─── Template helpers ──────────────────────────────────────────────────
function toPascalCase(str) {
    return (str.charAt(0).toUpperCase() + str.slice(1)).replace(/[-_](\w)/g, (_, c) => c.toUpperCase());
}

function toKebabCase(str) {
    return str.replace(/([a-z])([A-Z])/g, '$1-$2').replace(/[\s_]+/g, '-').toLowerCase();
}

function toJsClassName(str) {
    return toPascalCase(str) + "Section";
}

function cssClassPrefix(str) {
    return toKebabCase(str).substring(0, 3) + "-";
}

// ─── JS Template ───────────────────────────────────────────────────────
function generateJS(spec) {
    const id = spec.id;
    const label = spec.label;
    const icon = spec.icon;
    const description = spec.description;
    const storageKey = `Olivia_${id}_v1`;
    const className = toJsClassName(id);
    const prefix = cssClassPrefix(id);   // e.g., "kbn-" for kanban

    // Capitalised id for function names
    const Id = toPascalCase(id);

    return `/* ============================================================================
   ${Id} — ${label} inside Olivia Workspace.
   ============================================================================ */
(function () {
    'use strict';

    var STORAGE_KEY = '${storageKey}';
    var PEN_SVG = '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">' +
        '<circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" stroke-width="5"/>' +
        '<path d="M30 50 L70 50 M50 30 L50 70" stroke="currentColor" stroke-width="5"/>' +
        '</svg>';

    var sBuilt = false;
    var sActivePanel = 'main';            // 'main' | 'list' | 'about'
    var sItems = {};                      // { id: {title, content, updated} }
    var sActiveItemId = null;
    var sDirty = false;

    // ── Helpers ────────────────────────────────────────────────────────
    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function uuid() {
        return '${id[0]}' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    }
    function formatDate(iso) {
        if (!iso) return '—';
        try { return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }); }
        catch (_) { return iso; }
    }

    function loadItems() {
        try { var raw = localStorage.getItem(STORAGE_KEY); sItems = raw ? JSON.parse(raw) : {}; } catch (_) { sItems = {}; }
    }
    function saveItems() {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(sItems)); } catch (_) {}
    }

    // ── Build the main view ────────────────────────────────────────────
    function build() {
        var view = document.getElementById('${id}View');
        if (!view || sBuilt) return;
        loadItems();

        view.innerHTML =
            '<div class="${prefix}head">' +
            '<div class="${prefix}head-brand">' +
            '<span class="${prefix}logo">' + PEN_SVG + '</span>' +
            '<span class="${prefix}title">${label}</span>' +
            '<span class="${prefix}sub">${description.substring(0, 40)}</span>' +
            '</div>' +
            '<div class="${prefix}head-actions">' +
            '<button class="btn btn-sm" onclick="${Id}HideView()" title="Fechar"><i class="fas fa-times"></i></button>' +
            '</div>' +
            '</div>' +
            '<div class="${prefix}subnav">' +
            '<button class="${prefix}tab active" data-panel="main" onclick="${Id}SwitchPanel(\'main\')">${label}</button>' +
            '<button class="${prefix}tab" data-panel="list" onclick="${Id}SwitchPanel(\'list\')">Lista</button>' +
            '<button class="${prefix}tab" data-panel="about" onclick="${Id}SwitchPanel(\'about\')">Sobre</button>' +
            '</div>' +
            '<div class="${prefix}panels">' +
            '<div id="${prefix}Panel-main" class="${prefix}panel active">' + mainPanelHtml() + '</div>' +
            '<div id="${prefix}Panel-list" class="${prefix}panel">' + listPanelHtml() + '</div>' +
            '<div id="${prefix}Panel-about" class="${prefix}panel">' + aboutHtml() + '</div>' +
            '</div>';

        sBuilt = true;
        if (Object.keys(sItems).length === 0) {
            // create a first item automatically
            var firstId = uuid();
            sItems[firstId] = { title: 'Meu primeiro item', content: '', updated: new Date().toISOString() };
            saveItems();
        }
        sActiveItemId = Object.keys(sItems)[0] || null;
        renderMainPanel();
        renderItemList();
    }

    // ── Main panel (editor) ───────────────────────────────────────────
    function mainPanelHtml() {
        return '<div class="${prefix}editor-toolbar">' +
            '<button class="btn btn-sm" onclick="${Id}SaveActive()"><i class="fas fa-save"></i> Salvar</button>' +
            '<button class="btn btn-sm" onclick="${Id}NewItem()"><i class="fas fa-plus"></i> Novo</button>' +
            '<button class="btn btn-sm" onclick="${Id}DeleteActive()"><i class="fas fa-trash-alt"></i> Excluir</button>' +
            '</div>' +
            '<div class="${prefix}editor-form">' +
            '<input type="text" id="${prefix}ItemTitle" class="${prefix}input" placeholder="Título..." oninput="${Id}OnFieldChange()">' +
            '<textarea id="${prefix}ItemContent" class="${prefix}textarea" placeholder="Conteúdo..." oninput="${Id}OnFieldChange()"></textarea>' +
            '</div>';
    }

    function listPanelHtml() {
        return '<div class="${prefix}list-toolbar">' +
            '<button class="btn btn-sm" onclick="${Id}NewItem()"><i class="fas fa-plus"></i> Novo</button>' +
            '</div>' +
            '<div class="${prefix}list" id="${prefix}ItemList"></div>';
    }

    function aboutHtml() {
        return '<div class="${prefix}hero">' +
            '<span class="${prefix}hero-logo">' + PEN_SVG + '</span>' +
            '<h1 class="${prefix}hero-title">${label}</h1>' +
            '<p class="${prefix}hero-tag">${description}</p>' +
            '<p class="${prefix}hero-tag">Funcionalidades: ${spec.features.join(", ")}</p>' +
            '</div>';
    }

    function renderMainPanel() {
        if (!sActiveItemId || !sItems[sActiveItemId]) return;
        var item = sItems[sActiveItemId];
        var title = document.getElementById('${prefix}ItemTitle');
        var content = document.getElementById('${prefix}ItemContent');
        if (title) title.value = item.title || '';
        if (content) content.value = item.content || '';
        sDirty = false;
    }

    function renderItemList() {
        var list = document.getElementById('${prefix}ItemList');
        if (!list) return;
        var ids = Object.keys(sItems).sort((a,b) => (sItems[b].updated||'').localeCompare(sItems[a].updated||''));
        if (!ids.length) { list.innerHTML = '<div class="${prefix}empty"><i class="fas fa-folder-open"></i> Nenhum item</div>'; return; }
        var html = '<div class="${prefix}item-header"><span>Nome</span><span>Modificado</span><span>Ações</span></div>';
        ids.forEach(function(itemId) {
            var it = sItems[itemId];
            var active = (itemId === sActiveItemId) ? ' ${prefix}item-active' : '';
            html += '<div class="${prefix}item-row' + active + '">' +
                '<span><a href="#" onclick="event.preventDefault();${Id}OpenItem(\'' + esc(itemId) + '\')">' + esc(it.title) + '</a></span>' +
                '<span>' + formatDate(it.updated) + '</span>' +
                '<span>' +
                '<button class="btn btn-xs" onclick="${Id}RenameItem(\'' + esc(itemId) + '\')"><i class="fas fa-edit"></i></button>' +
                '<button class="btn btn-xs" onclick="${Id}DeleteItem(\'' + esc(itemId) + '\')"><i class="fas fa-trash-alt"></i></button>' +
                '</span></div>';
        });
        list.innerHTML = html;
    }

    // ── Panel switching ────────────────────────────────────────────────
    window.${Id}SwitchPanel = function(name) {
        sActivePanel = name;
        ['main','list','about'].forEach(function(p) {
            var panel = document.getElementById('${prefix}Panel-'+p);
            if (panel) panel.classList.toggle('active', p === name);
        });
        var tabs = document.querySelectorAll('#${id}View .${prefix}tab');
        tabs.forEach(function(t) {
            t.classList.toggle('active', t.getAttribute('data-panel') === name);
        });
        if (name === 'list') renderItemList();
        else if (name === 'main') renderMainPanel();
    };

    // ── CRUD ──────────────────────────────────────────────────────────
    window.${Id}OnFieldChange = function() { sDirty = true; };

    window.${Id}SaveActive = function() {
        if (!sActiveItemId) return;
        var title = document.getElementById('${prefix}ItemTitle').value.trim() || 'Sem título';
        var content = document.getElementById('${prefix}ItemContent').value;
        sItems[sActiveItemId] = { title: title, content: content, updated: new Date().toISOString() };
        saveItems();
        sDirty = false;
        renderItemList();
    };

    window.${Id}NewItem = function() {
        if (sDirty) if (!confirm('Alterações não salvas. Deseja continuar?')) return;
        var id = uuid();
        sItems[id] = { title: 'Novo item', content: '', updated: new Date().toISOString() };
        saveItems();
        sActiveItemId = id;
        renderMainPanel();
        renderItemList();
    };

    window.${Id}OpenItem = function(itemId) {
        if (sDirty) if (!confirm('Alterações não salvas. Deseja continuar?')) return;
        sActiveItemId = itemId;
        renderMainPanel();
        window.${Id}SwitchPanel('main');
    };

    window.${Id}RenameItem = function(itemId) {
        var it = sItems[itemId];
        if (!it) return;
        var newTitle = prompt('Novo título:', it.title);
        if (newTitle === null) return;
        it.title = newTitle.trim() || 'Sem título';
        saveItems();
        if (sActiveItemId === itemId) renderMainPanel();
        renderItemList();
    };

    window.${Id}DeleteItem = function(itemId) {
        if (!confirm('Excluir este item?')) return;
        delete sItems[itemId];
        saveItems();
        if (sActiveItemId === itemId) {
            sActiveItemId = Object.keys(sItems)[0] || null;
            renderMainPanel();
        }
        renderItemList();
    };

    window.${Id}DeleteActive = function() {
        if (sActiveItemId) window.${Id}DeleteItem(sActiveItemId);
    };

    // ── Lifecycle ─────────────────────────────────────────────────────
    var SIBLING_HIDE = ['violationsHideView', 'lawLibHideView', 'masterIndexHideView',
        'legalRouterHideView', 'spacesHideView', 'listeningHideView', 'studioHideView',
        'descobertaHideView', 'memoryHideView', 'shadersHideView', 'architectureHideView',
        'craudioHideView', 'driveHideView', 'writerHideView'];
    var CHAT_IDS = ['chatHeader', 'welcomeState', 'chatLog', 'chatCompose', 'chatToolbar'];

    window.${Id}ShowView = function() {
        build();
        CHAT_IDS.forEach(function(id) {
            var el = document.getElementById(id); if (el) el.style.display = 'none';
        });
        var mc = document.querySelector('.main-content');
        if (mc) { mc._${id}Display = mc.style.display; mc.style.display = 'none'; }
        SIBLING_HIDE.forEach(function(fn) {
            try { if (typeof window[fn] === 'function') window[fn](); } catch (_) {}
        });
        var v = document.getElementById('${id}View');
        if (v) v.classList.add('active');
        var ws = document.querySelector('.workspace');
        if (ws) ws.classList.add('${prefix}open');
    };

    window.${Id}HideView = function() {
        var v = document.getElementById('${id}View');
        if (v) v.classList.remove('active');
        var ws = document.querySelector('.workspace');
        if (ws) ws.classList.remove('${prefix}open');
        var mc = document.querySelector('.main-content');
        if (mc) { mc.style.display = mc._${id}Display !== undefined ? mc._${id}Display : ''; delete mc._${id}Display; }
        CHAT_IDS.forEach(function(id) {
            var el = document.getElementById(id); if (el) el.style.display = '';
        });
    };

    // Wrap sibling show functions so they close this section
    function wrapSiblings() {
        var names = ['violationsShowView','lawLibShowView','masterIndexShowView',
            'legalRouterShowView','spacesShowView','listeningShowView','studioShowView',
            'descobertaShowView','memoryShowView','shadersShowView','architectureShowView',
            'craudioShowView','resetToWelcome','aexToggleMain',
            'driveShowView','writerShowView'];
        names.forEach(function(n) {
            var orig = window[n];
            if (typeof orig !== 'function' || orig._${id}Wrapped) return;
            var wrapped = function() {
                try { window.${Id}HideView(); } catch (_) {}
                return orig.apply(this, arguments);
            };
            wrapped._${id}Wrapped = true;
            window[n] = wrapped;
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', wrapSiblings);
    } else {
        wrapSiblings();
    }
})();`;
}

// ─── CSS Template ───────────────────────────────────────────────────────
function generateCSS(spec) {
    const id = spec.id;
    const label = spec.label;
    const prefix = cssClassPrefix(id);
    const accentColor = spec.accentColor || "var(--blue, #3b82f6)";

    return `/* ============================================================================
   ${label} — Olivia Workspace section styles.
   ============================================================================ */

.${id}-view {
    display: none;
    flex: 1;
    min-height: 0;
    min-width: 0;
    flex-direction: column;
    overflow: hidden;
    background: var(--bg);
}

.${id}-view.active {
    display: flex;
}

.workspace.${prefix}open > .main-content {
    display: none !important;
}

/* Head */
.${prefix}head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 16px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    background: var(--bg-card);
}
.${prefix}head-brand {
    display: flex;
    align-items: baseline;
    gap: 9px;
}
.${prefix}logo {
    width: 20px; height: 20px; color: ${accentColor}; display: flex;
}
.${prefix}logo svg { width: 100%; height: 100%; }
.${prefix}title {
    font-family: var(--serif); font-size: 16px; font-weight: 600;
    color: var(--white); letter-spacing: -0.01em;
}
.${prefix}sub {
    font-family: var(--mono); font-size: 9px; letter-spacing: 0.1em;
    text-transform: uppercase; color: var(--gray);
}
.${prefix}head-actions { display: flex; align-items: center; gap: 12px; }

/* Subnav */
.${prefix}subnav {
    display: flex; gap: 2px; padding: 6px 14px; border-bottom: 1px solid var(--border);
    flex-shrink: 0; background: var(--bg-card); overflow-x: auto;
}
.${prefix}tab {
    padding: 6px 14px; border: none; background: transparent;
    font-family: var(--sans); font-size: 12px; font-weight: 500; color: var(--gray);
    cursor: pointer; border-bottom: 2px solid transparent; white-space: nowrap;
    transition: color .15s, border-color .15s;
}
.${prefix}tab:hover { color: var(--white); }
.${prefix}tab.active { color: ${accentColor}; border-bottom-color: ${accentColor}; }

/* Panels */
.${prefix}panels { flex: 1; min-height: 0; display: flex; }
.${prefix}panel { display: none; flex: 1; min-height: 0; }
.${prefix}panel.active { display: flex; flex-direction: column; }

/* Main editor */
.${prefix}editor-toolbar {
    display: flex; gap: 8px; padding: 10px 14px; border-bottom: 1px solid var(--border);
    background: var(--bg-card); flex-shrink: 0; flex-wrap: wrap;
}
.${prefix}editor-form { flex: 1; padding: 16px; overflow-y: auto; }
.${prefix}input, .${prefix}textarea {
    display: block; width: 100%; background: var(--bg); color: var(--white);
    border: 1px solid var(--border-hi); border-radius: var(--r); padding: 10px 12px;
    font-family: var(--sans); font-size: 14px; margin-bottom: 12px; outline: none;
    transition: border-color .15s;
}
.${prefix}input:focus, .${prefix}textarea:focus { border-color: ${accentColor}; }
.${prefix}textarea { resize: vertical; min-height: 200px; }
.${prefix}input::placeholder, .${prefix}textarea::placeholder { color: var(--gray); }

/* List panel */
.${prefix}list-toolbar {
    display: flex; padding: 10px 14px; border-bottom: 1px solid var(--border);
    background: var(--bg-card); flex-shrink: 0;
}
.${prefix}list { flex: 1; overflow-y: auto; padding: 8px 0; }
.${prefix}empty {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    height: 100%; color: var(--gray); gap: 10px; font-size: 14px;
}
.${prefix}item-header {
    display: grid; grid-template-columns: 1fr 120px 80px;
    padding: 8px 14px; font-size: 10px; font-weight: 600; text-transform: uppercase;
    color: var(--gray); border-bottom: 1px solid var(--border);
}
.${prefix}item-row {
    display: grid; grid-template-columns: 1fr 120px 80px;
    padding: 10px 14px; border-bottom: 1px solid var(--border);
    align-items: center; font-size: 13px; color: var(--white); transition: background .1s;
}
.${prefix}item-row:hover { background: var(--bg-card); }
.${prefix}item-active { background: rgba(59,130,246,0.1); }
.${prefix}item-row a { color: ${accentColor}; text-decoration: underline; cursor: pointer; }

/* About panel */
.${prefix}hero { text-align: center; padding: 28px 24px 48px; overflow-y: auto; }
.${prefix}hero-logo { width: 64px; height: 64px; color: ${accentColor}; display: inline-flex; margin-bottom: 14px; }
.${prefix}hero-logo svg { width: 100%; height: 100%; }
.${prefix}hero-title { font-family: var(--serif); font-weight: 600; font-size: 34px; color: var(--white); margin: 0 0 8px; }
.${prefix}hero-tag { font-family: var(--serif); font-style: italic; font-size: 15px; line-height: 1.6; color: var(--gray-hi); margin: 0 auto 8px; }

/* Responsive */
@media (max-width: 720px) {
    .${prefix}item-header, .${prefix}item-row {
        grid-template-columns: 1fr 80px 60px;
    }
}`;
}

// ─── File writing ───────────────────────────────────────────────────────
function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function writeSectionFiles(spec, outDir) {
    ensureDir(outDir);

    const jsPath = path.join(outDir, spec.id + ".js");
    const cssPath = path.join(outDir, spec.id + ".css");

    fs.writeFileSync(jsPath, generateJS(spec), "utf8");
    fs.writeFileSync(cssPath, generateCSS(spec), "utf8");

    console.log("Generated:", jsPath);
    console.log("Generated:", cssPath);
}

// ─── Registry update ───────────────────────────────────────────────────
function updateRegistry(spec, registryPath) {
    let registry = [];
    if (fs.existsSync(registryPath)) {
        try {
            registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
        } catch (e) {
            console.error("Warning: invalid registry file, starting fresh.");
        }
    }

    // check if already exists
    const idx = registry.findIndex(r => r.id === spec.id);
    const entry = {
        id: spec.id,
        label: spec.label,
        icon: spec.icon,
        onclick: spec.onclick || ""
    };

    if (idx >= 0) {
        registry[idx] = entry;
        console.log("Updated registry entry for", spec.id);
    } else {
        registry.push(entry);
        console.log("Added registry entry for", spec.id);
    }

    fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2), "utf8");
}

// ─── Main ───────────────────────────────────────────────────────────────
writeSectionFiles(spec, cli.outDir);
updateRegistry(spec, cli.registry);

console.log("\nSection", spec.id, "ready. Add the following to your HTML:");
console.log(`  <link rel="stylesheet" href="${spec.id}.css">`);
console.log(`  <script src="${spec.id}.js"></script>`);
console.log(`  <div id="${spec.id}View" class="${spec.id}-view"></div>`);
console.log("Then reload your workspace. The new section will appear in the sidebar.");