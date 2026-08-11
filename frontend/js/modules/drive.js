/* ============================================================================
   Drive — Google Drive manager inside Olivia Workspace.

   Frontend module for Google Drive integration. Implements the client-side
   for the gdrive Express router (Node.js backend, NOT this file — the
   backend router was previously misplaced as frontend/js/gdrive.js and has
   been removed in Phase 1 cleanup).

   Integrates with Google Drive via OAuth2 REST API. Not an MCP server —
   uses conventional REST endpoints.
   ============================================================================ */
(function () {
    'use strict';

    var DRIVE_API = {
        files: '/api/drive/files',
        upload: '/api/drive/upload',
        download: '/api/drive/download',
        delete: '/api/drive/delete',
        mkdir: '/api/drive/mkdir',
        trash: '/api/drive/trash',
        stats: '/api/drive/stats',
        assistant: '/api/assistant/chat',
        rcloneAuthUrl: '/api/drive/rclone-auth-url',
        rcloneAuthCode: '/api/drive/rclone-auth-code',
        search: '/api/drive/search',
    };

    var DRIVE_PRIMER = [
        'Você é o Drive Assistant — um agente que gerencia arquivos no Google Drive.',
        'Pode listar, pesquisar, criar, copiar, mover, ler conteúdo e baixar arquivos.',
        'Use as ferramentas disponíveis: list_recent_files, search_files, get_file_metadata, read_file_content, download_file_content, create_file, copy_file, get_file_permissions.',
        'Responda sempre em português do Brasil, de forma objetiva e técnica.',
        '— Mensagem do usuário —',
    ].join('\n');

    var CUBE_SVG_DRIVE = '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><polygon points="20,30 50,15 80,30 80,70 50,85 20,70" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/><line x1="50" y1="15" x2="50" y2="85" stroke="currentColor" stroke-width="5"/><line x1="20" y1="70" x2="80" y2="30" stroke="currentColor" stroke-width="5"/></svg>';

    // ── Internal state ───────────────────────────────────────────────────────
    var dBuilt = false;
    var dActivePanel = 'overview';
    var dHistory = [];
    var dSessionId = null;
    var dPrimerSent = false;
    var dStreaming = false;
    var DRIVE_STORAGE_KEY = 'Olivia_drive_chat_v1';
    var _authStatusCache = null; // to avoid repeated fetches

    // ── Search state ────────────────────────────────────────────────────────
    var _driveSearchActive = false;
    var _driveSearchPrevFolder = 'root';   // folder to restore after clearing search
    var _driveSearchSkipRestore = false;   // flag to skip breadcrumb restore (when navigating from search)

    // ── Helpers ───────────────────────────────────────────────────────────────
    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function renderMd(text) {
        try {
            if (window.marked && typeof window.marked.parse === 'function') {
                return window.marked.parse(String(text || ''));
            }
        } catch (_e) { /* fall through */ }
        return '<p>' + esc(text).replace(/\n/g, '<br>') + '</p>';
    }
    function apiBase() {
        return (typeof API_BASE === 'string' && API_BASE)
            ? String(API_BASE).replace(/\/$/, '')
            : window.location.origin;
    }

    // ── Build the main view ──────────────────────────────────────────────────
    function build() {
        var view = document.getElementById('driveView');
        if (!view || dBuilt) return;

        view.innerHTML =
            '<div class="dr-head">' +
            '<div class="dr-head-brand">' +
            '<span class="dr-logo">' + CUBE_SVG_DRIVE + '</span>' +
            '<span class="dr-title">Drive</span>' +
            '<span class="dr-sub">Google Drive</span>' +
            '</div>' +
            '<div class="dr-head-actions">' +
            '<span id="driveAuthStatus" class="dr-auth-status">Carregando…</span>' +
            '<button id="driveAuthBtn" class="btn btn-sm" onclick="driveAuthAction()">Conectar</button>' +
            '<button class="btn btn-sm" onclick="driveHideView()" title="Fechar">' +
            '<i class="fas fa-times"></i></button>' +
            '</div>' +
            '</div>' +
            '<div class="dr-subnav">' +
            '<button class="dr-tab active" data-panel="overview"  onclick="driveSwitchPanel(\'overview\')">Visão Geral</button>' +
            '<button class="dr-tab"        data-panel="files"     onclick="driveSwitchPanel(\'files\')">Arquivos</button>' +
            '<button class="dr-tab"        data-panel="chat"      onclick="driveSwitchPanel(\'chat\')">Chat</button>' +
            '</div>' +
            '<div class="dr-panels">' +
            '<div id="drPanel-overview"  class="dr-panel active">' + overviewHtml() + '</div>' +
            '<div id="drPanel-files"     class="dr-panel">' + filesHtml() + '</div>' +
            '<div id="drPanel-chat"      class="dr-panel">' + chatHtml() + '</div>' +
            '</div>';

        dBuilt = true;
        loadChatHistory();
        renderChatLog();
        driveUpdateAuthStatus();
    }

    // ── Overview panel ───────────────────────────────────────────────────────
    function overviewHtml() {
        return '<div class="dr-hero">' +
            '<span class="dr-hero-logo">' + CUBE_SVG_DRIVE + '</span>' +
            '<h1 class="dr-hero-title">Google Drive</h1>' +
            '<p class="dr-hero-tag">Gerencie seus arquivos diretamente do Olivia Workspace.</p>' +
            '</div>' +
            '<div class="dr-stats" id="driveStats">' +
            '<div class="dr-stat"><div class="dr-stat-num">–</div><div class="dr-stat-label">Arquivos</div></div>' +
            '<div class="dr-stat"><div class="dr-stat-num">–</div><div class="dr-stat-label">Pastas</div></div>' +
            '<div class="dr-stat"><div class="dr-stat-num">–</div><div class="dr-stat-label">Espaço usado</div></div>' +
            '</div>' +
            '<div class="dr-cta">' +
            '<button class="btn btn-primary" onclick="driveSwitchPanel(\'files\')">' +
            '<i class="fas fa-folder-open"></i> Navegar nos arquivos</button>' +
            '<button class="btn" onclick="driveSwitchPanel(\'chat\')">' +
            '<i class="fas fa-comments"></i> Falar com o assistente</button>' +
            '</div>' +
            // ── Rclone-style manual credential setup ──
            '<div id="driveRcloneConfig" class="dr-rclone-config" style="display:none;margin-top:16px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--r);padding:16px">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">' +
            '<h4 style="margin:0;font-size:14px;color:var(--gray-hi)"><i class="fas fa-terminal"></i> Configuração manual (estilo rclone)</h4>' +
            '<button class="btn btn-xs" onclick="driveRcloneConfigToggle()" title="Fechar"><i class="fas fa-times"></i></button>' +
            '</div>' +
            '<div id="drRcloneSteps" style="display:none">' +
            '<div class="dr-rclone-step" style="margin-bottom:10px">' +
            '<span style="color:var(--accent);font-weight:600">Passo 1:</span> ' +
            '<a id="drRcloneUrl" href="#" target="_blank" style="word-break:break-all;font-size:12px;color:var(--blue)"></a>' +
            '<button class="btn btn-xs" onclick="driveRcloneCopyUrl()" title="Copiar URL" style="margin-left:8px"><i class="fas fa-copy"></i></button>' +
            '</div>' +
            '<div class="dr-rclone-step" style="margin-bottom:10px">' +
            '<span style="color:var(--accent);font-weight:600">Passo 2:</span> Abra o link, autorize o acesso. O Google redirecionará para uma página — copie o código <code>code=</code> da barra de endereço.' +
            '</div>' +
            '<div class="dr-rclone-step" style="margin-bottom:12px">' +
            '<span style="color:var(--accent);font-weight:600">Passo 3:</span> Cole o código de verificação abaixo:' +
            '</div>' +
            '<div style="display:flex;gap:8px">' +
            '<input id="drRcloneCode" type="text" class="dr-chat-input" placeholder="Código da URL após autorizar (ex: 4/0AX4X...)" style="flex:1;font-size:13px">' +
            '<button id="drRcloneSubmit" class="btn btn-primary btn-sm" onclick="driveRcloneSubmitCode()">' +
            '<i class="fas fa-check"></i> Verificar</button>' +
            '</div>' +
            '<div id="drRcloneError" style="display:none;margin-top:8px;color:var(--red);font-size:12px"></div>' +
            '<div id="drRcloneSuccess" style="display:none;margin-top:8px;color:var(--green);font-size:12px"></div>' +
            '</div>' +
            '<div id="drRcloneLoading" style="text-align:center;padding:12px;display:none">' +
            '<i class="fas fa-spinner fa-pulse"></i> Gerando link de autorização...' +
            '</div>' +
            '<button id="drRcloneStartBtn" class="btn btn-sm" onclick="driveRcloneStart()" style="width:100%">' +
            '<i class="fas fa-key"></i> Iniciar configuração manual</button>' +
            '</div>' +
            '<div id="driveConfigHint" style="display:none;margin-top:16px;background:rgba(158,74,74,0.1);border:1px solid var(--red);border-radius:var(--r);padding:12px 14px;color:var(--gray-hi);font-size:13px">' +
            '<i class="fas fa-triangle-exclamation" style="color:var(--red)"></i> ' +
            '<span id="driveConfigHintText">Configuração pendente.</span> ' +
            '<a href="#" onclick="event.preventDefault();driveRcloneConfigToggle()" style="color:var(--accent);text-decoration:underline"></a>' +
            '</div>' +
            '<div class="dr-guard"><i class="fas fa-shield-haltered"></i> ' +
            'As operações de arquivo são executadas via API com escopos limitados. O assistente não armazena credenciais.</div>';
    }

    // ── Files panel (with search bar) ─────────────────────────────────────────
    function filesHtml() {
        return '<div class="dr-files-toolbar">' +
            '<div class="dr-toolbar-left">' +
            '<button class="btn btn-xs" id="drNavBack" onclick="driveNavBack()" title="Voltar" disabled>' +
            '<i class="fas fa-chevron-left"></i></button>' +
            '<button class="btn btn-xs" id="drNavFwd" onclick="driveNavForward()" title="Avançar" disabled>' +
            '<i class="fas fa-chevron-right"></i></button>' +
            '<div class="dr-breadcrumb" id="drBreadcrumb">' +
            '<span class="dr-bread-item active" data-id="root" onclick="driveNavFolder(\'root\')">' +
            '<i class="fas fa-hdd"></i> Meu Drive</span>' +
            '</div>' +
            '</div>' +
            '<div class="dr-search-bar">' +
            '<input id="drSearchInput" type="text" class="dr-search-input" placeholder="Pesquisar no Drive…" ' +
            'onkeydown="if(event.key===\'Enter\'){event.preventDefault();driveSearch();}">' +
            '<button class="btn btn-xs" id="drSearchBtn" onclick="driveSearch()" title="Pesquisar">' +
            '<i class="fas fa-search"></i></button>' +
            '<button class="btn btn-xs" id="drSearchClear" onclick="driveClearSearch()" title="Limpar" style="display:none">' +
            '<i class="fas fa-times"></i></button>' +
            '</div>' +
            '<div class="dr-files-actions">' +
            '<div class="dr-filter-dropdown" id="drFilterDropdown" style="display:none">' +
            '<button class="btn btn-xs" onclick="driveToggleFilter()" title="Filtrar pastas">' +
            '<i class="fas fa-filter"></i></button>' +
            '<div class="dr-filter-menu" id="drFilterMenu" style="display:none"></div>' +
            '</div>' +
            '<button class="btn btn-sm" onclick="driveRefreshFiles()" title="Atualizar">' +
            '<i class="fas fa-sync-alt"></i></button>' +
            '<label class="btn btn-sm" title="Upload">' +
            '<i class="fas fa-upload"></i><input type="file" id="drUploadInput" style="display:none" onchange="driveUploadFile()">' +
            '</label>' +
            '<button class="btn btn-sm" onclick="driveCreateFolder()" title="Nova pasta">' +
            '<i class="fas fa-folder-plus"></i></button>' +
            '</div>' +
            '</div>' +
            '<div class="dr-files-list" id="drFilesList">' +
            '<div class="dr-empty"><i class="fas fa-cloud"></i> Carregando...</div>' +
            '</div>';
    }

    // ── Chat panel ───────────────────────────────────────────────────────────
    function chatHtml() {
        return '<div class="dr-chat">' +
            '<div class="dr-chat-bar">' +
            '<span class="dr-chat-bar-label"><i class="fas fa-robot"></i> Drive Assistant</span>' +
            '<button class="btn btn-sm" onclick="driveNewChat()" title="Nova conversa">' +
            '<i class="fas fa-plus"></i> Nova conversa</button>' +
            '</div>' +
            '<div id="drChatLog" class="dr-chat-log"></div>' +
            '<div class="dr-chat-compose">' +
            '<textarea id="drChatInput" class="dr-chat-input" rows="1" ' +
            'placeholder="Pergunte ao assistente do Drive…" ' +
            'onkeydown="if(event.key===\'Enter\'&&!event.shiftKey){event.preventDefault();driveSend();}"></textarea>' +
            '<button class="dr-chat-send" id="drChatSend" onclick="driveSend()" title="Enviar">' +
            '<i class="fas fa-arrow-up"></i></button>' +
            '</div>' +
            '</div>';
    }

    // ── Tab switching ────────────────────────────────────────────────────────
    window.driveSwitchPanel = function (name) {
        dActivePanel = name;
        ['overview', 'files', 'chat'].forEach(function (p) {
            var panel = document.getElementById('drPanel-' + p);
            if (panel) panel.classList.toggle('active', p === name);
        });
        var tabs = document.querySelectorAll('#driveView .dr-tab');
        tabs.forEach(function (t) {
            t.classList.toggle('active', t.getAttribute('data-panel') === name);
        });
        if (name === 'files') {
            driveRefreshFiles();
        } else if (name === 'overview') {
            driveLoadStats();
        } else if (name === 'chat') {
            var input = document.getElementById('drChatInput');
            if (input) setTimeout(function () { input.focus(); }, 30);
        }
    };

    // ── Search functionality ────────────────────────────────────────────────
    window.driveSearch = function () {
        var input = document.getElementById('drSearchInput');
        var query = input ? input.value.trim() : '';
        if (!query) return;

        // Save current folder to restore later
        _driveSearchPrevFolder = getCurrentFolderId();
        _driveSearchActive = true;

        var list = document.getElementById('drFilesList');
        if (!list) return;
        list.innerHTML = '<div class="dr-empty"><i class="fas fa-spinner fa-pulse"></i> Pesquisando…</div>';

        // Show clear button, hide normal nav buttons (back/fwd irrelevant in search)
        var clearBtn = document.getElementById('drSearchClear');
        if (clearBtn) clearBtn.style.display = '';
        var navBack = document.getElementById('drNavBack');
        var navFwd = document.getElementById('drNavFwd');
        if (navBack) navBack.style.display = 'none';
        if (navFwd) navFwd.style.display = 'none';

        // Replace breadcrumb with search result header
        var bread = document.getElementById('drBreadcrumb');
        if (bread) {
            bread.innerHTML = '<span class="dr-bread-item active" data-id="search"><i class="fas fa-search"></i> Resultados para: ' + esc(query) + '</span>';
        }

        // Hide folder filter dropdown while searching
        var filterDropdown = document.getElementById('drFilterDropdown');
        if (filterDropdown) filterDropdown.style.display = 'none';

        fetch(apiBase() + DRIVE_API.search + '?q=' + encodeURIComponent(query))
            .then(function (res) {
                if (!res.ok) throw new Error('Erro na pesquisa (' + res.status + ')');
                return res.json();
            })
            .then(function (data) {
                renderSearchResults(data.files || [], query);
            })
            .catch(function (err) {
                list.innerHTML = '<div class="dr-empty dr-error">' + esc(err.message) + '</div>';
            });
    };

    window.driveClearSearch = function () {
        _driveSearchActive = false;
        var input = document.getElementById('drSearchInput');
        if (input) input.value = '';
        var clearBtn = document.getElementById('drSearchClear');
        if (clearBtn) clearBtn.style.display = 'none';

        // Restore navigation buttons
        var navBack = document.getElementById('drNavBack');
        var navFwd = document.getElementById('drNavFwd');
        if (navBack) navBack.style.display = '';
        if (navFwd) navFwd.style.display = '';
        _updateNavButtons(); // re‑apply disabled state

        // Restore breadcrumb to the previous folder
        _setBreadcrumbFolder(_driveSearchPrevFolder);

        // Restore folder filter (if applicable) and refresh the folder contents
        var filterDropdown = document.getElementById('drFilterDropdown');
        if (filterDropdown) {
            // after refresh, _buildFolderFilterList will decide visibility
        }
        driveRefreshFiles();
    };

    // Clear search UI only (used when navigating to a folder from search results)
    window._driveClearSearchUI = function () {
        _driveSearchActive = false;
        var input = document.getElementById('drSearchInput');
        if (input) input.value = '';
        var clearBtn = document.getElementById('drSearchClear');
        if (clearBtn) clearBtn.style.display = 'none';

        // Restore navigation buttons
        var navBack = document.getElementById('drNavBack');
        var navFwd = document.getElementById('drNavFwd');
        if (navBack) navBack.style.display = '';
        if (navFwd) navFwd.style.display = '';
        _updateNavButtons();

        // Reset breadcrumb path to root so navigation starts fresh
        _driveBreadPath = [{ id: 'root', name: 'Meu Drive' }];
    };

    function renderSearchResults(files, query) {
        var list = document.getElementById('drFilesList');
        if (!list) return;
        if (!files.length) {
            list.innerHTML = '<div class="dr-empty"><i class="fas fa-search"></i> Nenhum resultado para "' + esc(query) + '"</div>';
            return;
        }

        var html = '<div class="dr-file-header dr-file-header-search">' +
            '<span class="dr-file-name">Nome</span>' +
            '<span class="dr-file-type">Tipo</span>' +
            '<span class="dr-file-location">Localização</span>' +
            '<span class="dr-file-modified">Modificado</span>' +
            '<span class="dr-file-size">Tamanho</span>' +
            '<span class="dr-file-actions">Ações</span>' +
            '</div>';

        files.forEach(function (f) {
            var isFolder = f.mimeType === 'application/vnd.google-apps.folder';
            var nameEsc = esc(f.name);
            var icon = isFolder ? '<i class="fas fa-folder"></i>' : '<i class="fas fa-file"></i>';
            var location = esc(f.parentName || '—');
            var actions = '';
            var previewUrl = '';
            if (!isFolder) {
                var downloadUrl = apiBase() + DRIVE_API.download + '?fileId=' + encodeURIComponent(f.id);
                previewUrl = downloadUrl + '&preview=1';
                var pills = window.vwFilePills
                    ? window.vwFilePills(previewUrl, f.name, f.mimeType || '')
                    : '';
                actions = pills +
                    '<a href="' + downloadUrl + '" class="btn btn-xs" title="Download" style="margin-left:4px">' +
                    '<i class="fas fa-download"></i></a>';
            }
            actions += '<button class="btn btn-xs" onclick="driveDeleteFile(\'' + esc(f.id) + '\')" title="Mover para lixeira">' +
                '<i class="fas fa-trash-alt"></i></button>';

            // Click on a folder navigates to it (and clears search), on a file opens preview
            var rowClick = '';
            if (isFolder) {
                rowClick = 'onclick="_driveClearSearchUI(); driveNavFolder(\'' + esc(f.id) + '\');"';
            }

            html += '<div class="dr-file-row dr-file-row-search" ' + rowClick + '>' +
                '<span class="dr-file-name">' + icon + ' ' +
                (previewUrl ? '<a href="#" class="dr-file-link" onclick="event.preventDefault();vwOpenInPreview(' + JSON.stringify(previewUrl) + ',' + JSON.stringify(f.name) + ',' + JSON.stringify(f.mimeType || '') + ');">' + nameEsc + '</a>' : '<span class="dr-file-link">' + nameEsc + '</span>') +
                '</span>' +
                '<span class="dr-file-type">' + esc(isFolder ? 'Pasta' : (f.mimeType || '—')) + '</span>' +
                '<span class="dr-file-location">' + location + '</span>' +
                '<span class="dr-file-modified">' + esc(formatDate(f.modifiedTime)) + '</span>' +
                '<span class="dr-file-size">' + esc(isFolder ? '—' : formatSize(f.size)) + '</span>' +
                '<span class="dr-file-actions">' + actions + '</span>' +
                '</div>';
        });
        list.innerHTML = html;
    }

    // ── Drive file operations ────────────────────────────────────────────────
    window.driveRefreshFiles = function () {
        var list = document.getElementById('drFilesList');
        if (!list) return;
        list.innerHTML = '<div class="dr-empty"><i class="fas fa-spinner fa-pulse"></i> Carregando arquivos...</div>';

        var parentId = getCurrentFolderId();
        var url = apiBase() + DRIVE_API.files + '?parentId=' + encodeURIComponent(parentId);

        fetch(url)
            .then(function (res) {
                if (res.status === 503) throw new Error('Serviço indisponível – Drive não configurado.');
                if (!res.ok) throw new Error('Erro ao listar arquivos (' + res.status + ')');
                return res.json();
            })
            .then(function (data) {
                renderFileList(data.files || []);
                // Hide config hint if files loaded
                showDriveConfigHint(null);
            })
            .catch(function (err) {
                list.innerHTML = '<div class="dr-empty dr-error">' + esc(err.message) + '</div>';
                showDriveConfigHint(err.message);
            });
    };

    function renderFileList(files) {
        var list = document.getElementById('drFilesList');
        if (!files.length) {
            list.innerHTML = '<div class="dr-empty"><i class="fas fa-folder-open"></i> Pasta vazia</div>';
            return;
        }
        var html = '<div class="dr-file-header">' +
            '<span class="dr-file-name">Nome</span>' +
            '<span class="dr-file-type">Tipo</span>' +
            '<span class="dr-file-modified">Modificado</span>' +
            '<span class="dr-file-size">Tamanho</span>' +
            '<span class="dr-file-actions">Ações</span>' +
            '</div>';
        // Build folder filter list from loaded files
        _buildFolderFilterList(files);

        files.forEach(function (f) {
            var isFolder = f.mimeType === 'application/vnd.google-apps.folder';
            var nameEsc = esc(f.name);
            var icon = isFolder ? '<i class="fas fa-folder"></i>' : '<i class="fas fa-file"></i>';
            var actions = '';
            var previewUrl = '';
            if (!isFolder) {
                var downloadUrl = apiBase() + DRIVE_API.download + '?fileId=' + encodeURIComponent(f.id);
                previewUrl = downloadUrl + '&preview=1';
                // Sidebar panel pills (Preview / Output / Browser) — use inline preview mode for Drive files
                var pills = window.vwFilePills
                    ? window.vwFilePills(previewUrl, f.name, f.mimeType || '')
                    : '';
                actions = pills +
                    '<a href="' + downloadUrl + '" class="btn btn-xs" title="Download" style="margin-left:4px">' +
                    '<i class="fas fa-download"></i></a>';
            }
            actions += '<button class="btn btn-xs" onclick="driveDeleteFile(\'' + esc(f.id) + '\')" title="Mover para lixeira">' +
                '<i class="fas fa-trash-alt"></i></button>';

            html += '<div class="dr-file-row" ' + (isFolder ? 'onclick="driveNavFolder(\'' + esc(f.id) + '\')"' : '') + '>' +
                '<span class="dr-file-name">' + icon + ' ' +
                (previewUrl ? '<a href="#" class="dr-file-link" onclick="event.preventDefault();vwOpenInPreview(' + JSON.stringify(previewUrl) + ',' + JSON.stringify(f.name) + ',' + JSON.stringify(f.mimeType || '') + ');">' + nameEsc + '</a>' : '<span class="dr-file-link">' + nameEsc + '</span>') +
                '</span>' +
                '<span class="dr-file-type">' + esc(isFolder ? 'Pasta' : (f.mimeType || '—')) + '</span>' +
                '<span class="dr-file-modified">' + esc(formatDate(f.modifiedTime)) + '</span>' +
                '<span class="dr-file-size">' + esc(isFolder ? '—' : formatSize(f.size)) + '</span>' +
                '<span class="dr-file-actions">' + actions + '</span>' +
                '</div>';
        });
        list.innerHTML = html;

        // Apply any active folder filters after rendering
        _applyFolderFilter();
    }

    // ── Folder filter dropdown ───────────────────────────────────────────────

    var _driveFilterFolders = Object.create(null);  // { folderName: true/false }

    window.driveToggleFilter = function () {
        var menu = document.getElementById('drFilterMenu');
        if (!menu) return;
        var show = menu.style.display === 'none';
        menu.style.display = show ? 'block' : 'none';
        if (show) {
            _buildFilterMenu();
            _closeFilterOnClickOutside();
        }
    };

    function _buildFilterMenu() {
        var menu = document.getElementById('drFilterMenu');
        if (!menu) return;
        var names = Object.keys(_driveFilterFolders).sort();
        if (!names.length) {
            menu.innerHTML = '<div class="dr-filter-empty">Nenhuma pasta no diretório atual</div>';
            return;
        }
        var allChecked = names.every(function (k) { return _driveFilterFolders[k]; });
        var html = '<div class="dr-filter-item"><label><input type="checkbox" onchange="driveToggleAllFolders(this.checked)"' +
            (allChecked ? ' checked' : '') + '> ' +
            '<strong>Todas as pastas</strong></label></div>';
        names.forEach(function (name) {
            var checked = _driveFilterFolders[name] ? ' checked' : '';
            var safeName = name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            var escName = esc(name);
            html += '<div class="dr-filter-item"><label><input type="checkbox" onchange="driveToggleFolder(\'' + safeName + '\',this.checked)"' +
                checked + '> ' + escName + '</label></div>';
        });
        menu.innerHTML = html;
    }

    window.driveToggleFolder = function (name, visible) {
        _driveFilterFolders[name] = visible;
        _applyFolderFilter();
        // Update "Todas as pastas" checkbox
        var allChecked = Object.keys(_driveFilterFolders).every(function (k) { return _driveFilterFolders[k]; });
        var menu = document.getElementById('drFilterMenu');
        if (menu) {
            var allCb = menu.querySelector('input[type=checkbox]');
            if (allCb) allCb.checked = allChecked;
        }
    };

    window.driveToggleAllFolders = function (checked) {
        Object.keys(_driveFilterFolders).forEach(function (k) { _driveFilterFolders[k] = checked; });
        _applyFolderFilter();
        _buildFilterMenu();
    };

    function _applyFolderFilter() {
        var rows = document.querySelectorAll('#drFilesList .dr-file-row');
        rows.forEach(function (row) {
            var nameEl = row.querySelector('.dr-file-link');
            var name = nameEl ? nameEl.textContent.trim() : '';
            var isFolder = row.querySelector('.fa-folder') !== null;
            if (!isFolder) {
                row.style.display = '';  // never filter files
                return;
            }
            var visible = _driveFilterFolders[name] !== false;
            row.style.display = visible ? '' : 'none';
        });
    }

    function _closeFilterOnClickOutside() {
        setTimeout(function () {
            var handler = function (e) {
                var menu = document.getElementById('drFilterMenu');
                var btn = document.querySelector('#drFilterDropdown .btn');
                if (!menu || menu.style.display === 'none') {
                    document.removeEventListener('click', handler);
                    return;
                }
                if (menu.contains(e.target)) return;
                if (btn && btn.contains(e.target)) return;
                menu.style.display = 'none';
                document.removeEventListener('click', handler);
            };
            document.addEventListener('click', handler);
        }, 0);
    }

    function _buildFolderFilterList(files) {
        _driveFilterFolders = Object.create(null);
        files.forEach(function (f) {
            if (f.mimeType === 'application/vnd.google-apps.folder') {
                _driveFilterFolders[f.name] = true;  // all visible by default
            }
        });
        var dropdown = document.getElementById('drFilterDropdown');
        if (dropdown) {
            var hasFolders = Object.keys(_driveFilterFolders).length > 0;
            dropdown.style.display = hasFolders ? '' : 'none';
        }
        // Refresh filter menu if it's currently open
        var menu = document.getElementById('drFilterMenu');
        if (menu && menu.style.display !== 'none') {
            _buildFilterMenu();
        }
    }

    function getCurrentFolderId() {
        var bread = document.getElementById('drBreadcrumb');
        var active = bread ? bread.querySelector('.dr-bread-item.active') : null;
        var folderId = active ? active.getAttribute('data-id') : null;
        return folderId || 'root';
    }

    // ── Folder navigation history ────────────────────────────────────────────

    var _driveNavStack = ['root'];
    var _driveNavPos = 0;

    function _updateNavButtons() {
        var back = document.getElementById('drNavBack');
        var fwd = document.getElementById('drNavFwd');
        if (back) back.disabled = _driveNavPos <= 0;
        if (fwd) fwd.disabled = _driveNavPos >= _driveNavStack.length - 1;
    }

    window.driveNavFolder = function (folderId) {
        // Push to history (truncate forward stack if navigating from middle)
        if (_driveNavPos < _driveNavStack.length - 1) {
            _driveNavStack = _driveNavStack.slice(0, _driveNavPos + 1);
        }
        _driveNavStack.push(folderId);
        _driveNavPos = _driveNavStack.length - 1;
        _updateNavButtons();
        _setBreadcrumbFolder(folderId);
        driveRefreshFiles();
    };

    window.driveNavBack = function () {
        if (_driveNavPos <= 0) return;
        _driveNavPos--;
        _updateNavButtons();
        _setBreadcrumbFolder(_driveNavStack[_driveNavPos]);
        driveRefreshFiles();
    };

    window.driveNavForward = function () {
        if (_driveNavPos >= _driveNavStack.length - 1) return;
        _driveNavPos++;
        _updateNavButtons();
        _setBreadcrumbFolder(_driveNavStack[_driveNavPos]);
        driveRefreshFiles();
    };

    function _setBreadcrumbFolder(folderId) {
        var bread = document.getElementById('drBreadcrumb');
        if (bread) {
            bread.innerHTML = '<span class="dr-bread-item active" data-id="' + esc(folderId) + '">' +
                '<i class="fas fa-folder"></i> ' + (folderId === 'root' ? 'Meu Drive' : 'Pasta') + '</span>';
        }
    }

    window.driveUploadFile = function () {
        var input = document.getElementById('drUploadInput');
        var file = input && input.files[0];
        if (!file) return;

        var formData = new FormData();
        formData.append('file', file);
        formData.append('parentId', getCurrentFolderId());

        fetch(apiBase() + DRIVE_API.upload, { method: 'POST', body: formData })
            .then(function (res) {
                if (!res.ok) throw new Error('Upload falhou (' + res.status + ')');
                return res.json();
            })
            .then(function () {
                driveRefreshFiles();
            })
            .catch(function (err) {
                alert('Upload: ' + err.message);
            });
        input.value = '';
    };

    window.driveCreateFolder = function () {
        var name = prompt('Nome da nova pasta:');
        if (!name) return;
        fetch(apiBase() + DRIVE_API.mkdir, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name, parentId: getCurrentFolderId() })
        })
            .then(function (res) {
                if (!res.ok) throw new Error('Erro ao criar pasta (' + res.status + ')');
                driveRefreshFiles();
            })
            .catch(function (err) {
                alert(err.message);
            });
    };

    window.driveDeleteFile = function (fileId) {
        if (!confirm('Mover este arquivo para a lixeira?')) return;
        fetch(apiBase() + DRIVE_API.delete + '?fileId=' + encodeURIComponent(fileId), { method: 'POST' })
            .then(function (res) {
                if (!res.ok) throw new Error('Erro ao excluir (' + res.status + ')');
                driveRefreshFiles();
            })
            .catch(function (err) {
                alert(err.message);
            });
    };

    window.driveLoadStats = function () {
        fetch(apiBase() + DRIVE_API.stats)
            .then(function (res) {
                if (res.status === 503) throw new Error('Serviço indisponível – Drive não configurado.');
                if (!res.ok) throw new Error('Erro ao carregar estatísticas');
                return res.json();
            })
            .then(function (data) {
                var stats = document.getElementById('driveStats');
                if (!stats) return;
                var nums = stats.querySelectorAll('.dr-stat-num');
                if (nums.length >= 3 && data) {
                    nums[0].textContent = data.totalFiles || '—';
                    nums[1].textContent = data.totalFolders || '—';
                    nums[2].textContent = formatSize(data.usedStorage || 0);
                }
                showDriveConfigHint(null);
            })
            .catch(function (err) {
                var stats = document.getElementById('driveStats');
                if (stats) {
                    var nums = stats.querySelectorAll('.dr-stat-num');
                    if (nums.length >= 3) {
                        nums[0].textContent = '—';
                        nums[1].textContent = '—';
                        nums[2].textContent = '—';
                    }
                }
                showDriveConfigHint(err.message);
            });
    };

    // ── Configuration hint ──────────────────────────────────────────────────
    function showDriveConfigHint(message) {
        var hint = document.getElementById('driveConfigHint');
        var text = document.getElementById('driveConfigHintText');
        if (!hint || !text) return;
        if (message) {
            hint.style.display = 'block';
            text.innerHTML = esc(message) + ' <a href="#" onclick="event.preventDefault();driveRcloneConfigToggle()" style="color:var(--accent);text-decoration:underline">Configurar manualmente</a>';
        } else {
            hint.style.display = 'none';
        }
        // Also update sidebar hint if exists
        var sideHint = document.getElementById('driveSidebarConfigHint');
        if (sideHint) {
            sideHint.style.display = message ? 'block' : 'none';
            if (message) sideHint.innerHTML = '⚠️ ' + esc(message) + ' <a href="#" onclick="event.preventDefault();window.driveShowView();driveRcloneConfigToggle()" style="color:var(--accent);text-decoration:underline">Configurar manualmente</a>';
        }
    }

    // ── Chat (SSE) ───────────────────────────────────────────────────────────
    function loadChatHistory() {
        try {
            var raw = localStorage.getItem(DRIVE_STORAGE_KEY);
            var saved = raw ? JSON.parse(raw) : null;
            if (Array.isArray(saved)) dHistory = saved;
        } catch (_e) { dHistory = []; }
    }
    function saveChatHistory() {
        try { localStorage.setItem(DRIVE_STORAGE_KEY, JSON.stringify(dHistory)); } catch (_e) { }
    }
    function renderChatLog() {
        var log = document.getElementById('drChatLog');
        if (!log) return;
        if (!dHistory.length) {
            log.innerHTML = '<div class="dr-chat-empty">' + CUBE_SVG_DRIVE +
                '<p>Pergunte qualquer coisa sobre seus arquivos.<br>Ex: <em>"liste meus 5 arquivos mais recentes"</em></p></div>';
            return;
        }
        log.innerHTML = '';
        dHistory.forEach(function (m) { log.appendChild(bubble(m.role, m.text)); });
        log.scrollTop = log.scrollHeight;
    }
    function bubble(role, text) {
        var div = document.createElement('div');
        div.className = 'dr-msg dr-msg-' + (role === 'user' ? 'user' : 'agent');
        if (role === 'user') {
            div.innerHTML = '<div class="dr-msg-body">' + esc(text) + '</div>';
        } else {
            div.innerHTML = '<div class="dr-msg-tag">DRIVE</div>' +
                '<div class="dr-msg-body dr-md">' + renderMd(text) + '</div>';
        }
        return div;
    }

    window.driveNewChat = function () {
        if (dStreaming) return;
        dHistory = [];
        dSessionId = null;
        dPrimerSent = false;
        saveChatHistory();
        renderChatLog();
    };

    window.driveSend = function () {
        if (dStreaming) return;
        var input = document.getElementById('drChatInput');
        var log = document.getElementById('drChatLog');
        if (!input || !log) return;
        var message = (input.value || '').trim();
        if (!message) return;

        input.value = '';
        if (!dHistory.length) log.innerHTML = '';
        dHistory.push({ role: 'user', text: message });
        log.appendChild(bubble('user', message));
        saveChatHistory();

        dStreaming = true;
        setSendEnabled(false);
        var proc = createProcessingIndicator(log);
        streamReply(message, log, proc);
    };

    function setSendEnabled(on) {
        var btn = document.getElementById('drChatSend');
        var input = document.getElementById('drChatInput');
        if (btn) { btn.disabled = !on; btn.classList.toggle('dr-busy', !on); }
        if (input) input.disabled = !on;
    }

    function createProcessingIndicator(log) {
        var el = document.createElement('div');
        el.className = 'dr-proc';
        el.innerHTML = '<span class="dr-proc-spin"></span><span class="dr-proc-text">Processando...</span>';
        log.appendChild(el);
        log.scrollTop = log.scrollHeight;
        return {
            setPhase: function (txt) {
                var t = el.querySelector('.dr-proc-text');
                if (t) t.textContent = txt;
            },
            done: function () { if (el.parentNode) el.parentNode.removeChild(el); }
        };
    }

    function streamReply(message, log, proc) {
        var streamEl = null, streamed = '', streamErr = '';
        function ensureBubble() {
            if (!streamEl) {
                streamEl = bubble('agent', '');
                log.appendChild(streamEl);
            }
            return streamEl.querySelector('.dr-msg-body');
        }

        var history = dHistory.filter(function (m) { return m && m.text; })
            .slice(-20).map(function (m) {
                return { role: m.role === 'agent' ? 'assistant' : 'user', content: m.text };
            });
        var messageForBackend = dPrimerSent ? message : (DRIVE_PRIMER + '\n' + message);
        dPrimerSent = true;

        var payload = {
            message: messageForBackend,
            history: history.slice(0, -1),
            session_id: dSessionId || null,
            section_key: 'drive',
        };

        fetch(apiBase() + DRIVE_API.assistant, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        }).then(function (res) {
            if (!res.ok || !res.body || !res.body.getReader) {
                throw new Error('Falha ao conectar ao backend (' + res.status + ').');
            }
            var reader = res.body.getReader();
            var decoder = new TextDecoder('utf-8');
            var buffer = '';

            function pump() {
                return reader.read().then(function (r) {
                    if (r.done) return finish();
                    buffer += decoder.decode(r.value, { stream: true });
                    var lines = buffer.split('\n');
                    buffer = lines.pop() || '';
                    for (var k = 0; k < lines.length; k++) {
                        var line = lines[k].trim();
                        if (line.indexOf('data:') !== 0) continue;
                        var json = line.slice(5).trim();
                        if (!json || json === '[DONE]') continue;
                        var evt;
                        try { evt = JSON.parse(json); } catch (_e) { continue; }

                        if (evt.type === 'token' && typeof evt.content === 'string') {
                            proc.done();
                            streamed += evt.content;
                            ensureBubble().innerHTML = renderMd(streamed);
                            log.scrollTop = log.scrollHeight;
                        } else if (evt.type === 'status' || evt.type === 'agent_status') {
                            proc.setPhase(evt.message || '');
                        } else if (evt.type === 'session_id' && evt.session_id) {
                            dSessionId = evt.session_id;
                        } else if (evt.type === 'error' || evt.event === 'error') {
                            streamErr = String(evt.message || 'Erro no stream.');
                        }
                    }
                    return pump();
                });
            }

            function finish() {
                proc.done();
                if (streamErr) {
                    if (streamEl && streamEl.parentNode) streamEl.parentNode.removeChild(streamEl);
                    log.appendChild(errorEl(streamErr));
                } else {
                    var text = streamed || 'Sem resposta.';
                    if (!streamEl) { streamEl = bubble('agent', ''); log.appendChild(streamEl); }
                    streamEl.querySelector('.dr-msg-body').innerHTML = renderMd(text);
                    dHistory.push({ role: 'agent', text: text });
                    saveChatHistory();
                }
                log.scrollTop = log.scrollHeight;
                dStreaming = false;
                setSendEnabled(true);
            }

            return pump();
        }).catch(function (err) {
            proc.done();
            log.appendChild(errorEl(err && err.message ? err.message : String(err)));
            log.scrollTop = log.scrollHeight;
            dStreaming = false;
            setSendEnabled(true);
        });
    }

    function errorEl(msg) {
        var el = document.createElement('div');
        el.className = 'dr-chat-error';
        el.innerHTML = '<i class="fas fa-triangle-exclamation"></i> ' + esc(msg);
        return el;
    }

    // ── Rclone-style manual credential setup ──────────────────────────────────

    var _rcloneAuthUrl = '';

    window.driveRcloneConfigToggle = function () {
        var el = document.getElementById('driveRcloneConfig');
        if (el) {
            var visible = el.style.display !== 'none';
            el.style.display = visible ? 'none' : 'block';
            if (!visible) driveRcloneReset();
        }
    };

    function driveRcloneReset() {
        var steps = document.getElementById('drRcloneSteps');
        var loading = document.getElementById('drRcloneLoading');
        var startBtn = document.getElementById('drRcloneStartBtn');
        var error = document.getElementById('drRcloneError');
        var success = document.getElementById('drRcloneSuccess');
        var codeInput = document.getElementById('drRcloneCode');
        if (steps) steps.style.display = 'none';
        if (loading) loading.style.display = 'none';
        if (startBtn) startBtn.style.display = '';
        if (error) { error.style.display = 'none'; error.textContent = ''; }
        if (success) { success.style.display = 'none'; success.textContent = ''; }
        if (codeInput) codeInput.value = '';
        _rcloneAuthUrl = '';
    }

    window.driveRcloneStart = function () {
        var steps = document.getElementById('drRcloneSteps');
        var loading = document.getElementById('drRcloneLoading');
        var startBtn = document.getElementById('drRcloneStartBtn');
        var error = document.getElementById('drRcloneError');
        var success = document.getElementById('drRcloneSuccess');
        if (success) { success.style.display = 'none'; success.textContent = ''; }
        if (error) { error.style.display = 'none'; error.textContent = ''; }
        if (startBtn) startBtn.style.display = 'none';
        if (steps) steps.style.display = 'none';
        if (loading) loading.style.display = '';

        fetch(apiBase() + DRIVE_API.rcloneAuthUrl)
            .then(function (res) {
                if (!res.ok) throw new Error('Erro ao gerar URL de autorização (' + res.status + ')');
                return res.json();
            })
            .then(function (data) {
                if (loading) loading.style.display = 'none';
                _rcloneAuthUrl = data.url;
                var urlEl = document.getElementById('drRcloneUrl');
                if (urlEl) {
                    urlEl.href = data.url;
                    urlEl.textContent = data.url;
                }
                if (steps) steps.style.display = '';
            })
            .catch(function (err) {
                if (loading) loading.style.display = 'none';
                if (startBtn) startBtn.style.display = '';
                if (error) {
                    error.textContent = err.message;
                    error.style.display = '';
                }
            });
    };

    window.driveRcloneCopyUrl = function () {
        if (!_rcloneAuthUrl) return;
        navigator.clipboard.writeText(_rcloneAuthUrl).then(function () {
            // brief feedback
        }).catch(function () {
            // fallback: select and copy manually
            var urlEl = document.getElementById('drRcloneUrl');
            if (urlEl) {
                var range = document.createRange();
                range.selectNode(urlEl);
                window.getSelection().removeAllRanges();
                window.getSelection().addRange(range);
            }
        });
    };

    function parseRcloneCodeInput(raw) {
        if (!raw || typeof raw !== 'string') return '';
        var value = raw.trim();
        // Accept: raw code, full query string, or full redirect URL.
        try {
            if (value.indexOf('http://') === 0 || value.indexOf('https://') === 0) {
                var url = new URL(value);
                value = url.searchParams.get('code') || value;
            }
        } catch (e) {
            // ignore invalid URL
        }
        if (value.indexOf('code=') !== -1) {
            var query = value;
            if (query.indexOf('?') !== -1) {
                query = query.split('?')[1];
            }
            query.split('&').forEach(function (pair) {
                var parts = pair.split('=');
                if (parts[0] === 'code') {
                    value = parts.slice(1).join('=');
                }
            });
        } else if (value.indexOf('&') !== -1) {
            value = value.split('&')[0];
        }
        return value.trim();
    }

    window.driveRcloneSubmitCode = function () {
        var codeInput = document.getElementById('drRcloneCode');
        var submitBtn = document.getElementById('drRcloneSubmit');
        var error = document.getElementById('drRcloneError');
        var success = document.getElementById('drRcloneSuccess');
        var code = codeInput ? parseRcloneCodeInput(codeInput.value) : '';

        if (!code) {
            if (error) { error.textContent = 'Cole o código de verificação primeiro.'; error.style.display = ''; }
            return;
        }
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Verificando...'; }
        if (error) { error.style.display = 'none'; error.textContent = ''; }
        if (success) { success.style.display = 'none'; success.textContent = ''; }

        fetch(apiBase() + DRIVE_API.rcloneAuthCode, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: code }),
        })
            .then(function (res) {
                if (!res.ok) throw new Error('Falha ao verificar código (' + res.status + ')');
                return res.json();
            })
            .then(function () {
                if (success) {
                    success.textContent = 'Autenticação concluída com sucesso!';
                    success.style.display = '';
                }
                if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Verificar'; }
                if (codeInput) codeInput.value = '';
                // Refresh the auth status
                setTimeout(function () {
                    driveUpdateAuthStatus();
                    driveRcloneConfigToggle();
                }, 1500);
            })
            .catch(function (err) {
                if (error) {
                    error.textContent = err.message;
                    error.style.display = '';
                }
                if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Verificar'; }
            });
    };

    function updateDriveSidebarStatus(statusText, isConnected) {
        var el = document.getElementById('driveAuthStatusSidebar');
        var btn = document.getElementById('driveAuthBtnSidebar');
        if (!el) return;
        el.textContent = statusText || (isConnected ? 'Conectado' : 'Não conectado');
        el.style.color = isConnected ? 'var(--green)' : 'var(--gray)';
        if (btn) {
            btn.innerHTML = isConnected
                ? '<i class="fas fa-unlink"></i> Desconectar'
                : '<i class="fas fa-plug"></i> Conectar';
            btn.dataset.action = isConnected ? 'disconnect' : 'connect';
        }
    }

    function driveUpdateAuthStatus() {
        var statusEl = document.getElementById('driveAuthStatus');
        var btn = document.getElementById('driveAuthBtn');
        if (!statusEl || !btn) return;

        fetch(apiBase() + '/api/drive/status')
            .then(function (res) {
                if (res.status === 503) {
                    statusEl.textContent = 'Configuração pendente';
                    statusEl.className = 'dr-auth-status dr-auth-off';
                    btn.textContent = 'Configurar';
                    btn.dataset.action = 'connect';
                    updateDriveSidebarStatus('Configuração pendente', false);
                    showDriveConfigHint('Drive não configurado no backend.');
                    return;
                }
                if (res.status === 401) {
                    statusEl.textContent = 'Não conectado';
                    statusEl.className = 'dr-auth-status dr-auth-off';
                    btn.textContent = 'Conectar';
                    btn.dataset.action = 'connect';
                    updateDriveSidebarStatus('Não conectado', false);
                    showDriveConfigHint(null);
                    return;
                }
                return res.json();
            })
            .then(function (data) {
                if (data && data.authenticated) {
                    statusEl.textContent = 'Conectado como ' + (data.email || 'usuário');
                    statusEl.className = 'dr-auth-status dr-auth-on';
                    btn.textContent = 'Desconectar';
                    btn.dataset.action = 'disconnect';
                    updateDriveSidebarStatus('Conectado como ' + (data.email || ''), true);
                    showDriveConfigHint(null);
                } else if (data && !data.authenticated) {
                    statusEl.textContent = 'Não conectado';
                    statusEl.className = 'dr-auth-status dr-auth-off';
                    btn.textContent = 'Conectar';
                    btn.dataset.action = 'connect';
                    updateDriveSidebarStatus('Não conectado', false);
                }
            })
            .catch(function () {
                statusEl.textContent = 'Erro';
                statusEl.className = 'dr-auth-status dr-auth-off';
                updateDriveSidebarStatus('Erro', false);
            });
    }

    window.driveAuthAction = function () {
        var btn = document.getElementById('driveAuthBtn') || document.getElementById('driveAuthBtnSidebar');
        var action = btn ? btn.dataset.action : 'connect';
        if (action === 'connect') {
            window.location.href = apiBase() + '/api/drive/auth';
        } else if (action === 'disconnect') {
            fetch(apiBase() + '/api/drive/disconnect', { method: 'POST' })
                .then(function () {
                    driveUpdateAuthStatus();
                    updateDriveSidebarStatus('Não conectado', false);
                    driveRefreshFiles();
                })
                .catch(function () {
                    alert('Erro ao desconectar');
                });
        }
    };

    window.driveUpdateAuthStatus = driveUpdateAuthStatus;
    window.updateDriveSidebarStatus = updateDriveSidebarStatus;
    window.showDriveConfigHint = showDriveConfigHint;

    // ── Utility formatters ───────────────────────────────────────────────────
    function formatDate(iso) {
        if (!iso) return '—';
        try { return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }); }
        catch (_) { return iso; }
    }
    function formatSize(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        var k = 1024, sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        var i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    // ── Lifecycle: show / hide the view ──────────────────────────────────────
    var SIBLING_HIDE = ['violationsHideView', 'lawLibHideView', 'masterIndexHideView',
        'legalRouterHideView', 'spacesHideView', 'listeningHideView', 'studioHideView',
        'descobertaHideView', 'memoryHideView', 'shadersHideView', 'architectureHideView',
        'craudioHideView', 'writerHideView'];
    var CHAT_IDS = ['chatHeader', 'welcomeState', 'chatLog', 'chatCompose', 'chatToolbar'];

    window.driveShowView = function () {
        build();
        CHAT_IDS.forEach(function (id) {
            var el = document.getElementById(id); if (el) el.style.display = 'none';
        });
        var mc = document.querySelector('.main-content');
        if (mc) { mc._drDisplay = mc.style.display; mc.style.display = 'none'; }
        SIBLING_HIDE.forEach(function (fn) {
            try { if (typeof window[fn] === 'function') window[fn](); } catch (_e) { }
        });
        var v = document.getElementById('driveView');
        if (v) v.classList.add('active');
        var ws = document.querySelector('.workspace');
        if (ws) ws.classList.add('dr-open');
        driveLoadStats();
        driveUpdateAuthStatus();
    };

    window.driveHideView = function () {
        var v = document.getElementById('driveView');
        if (v) v.classList.remove('active');
        var ws = document.querySelector('.workspace');
        if (ws) ws.classList.remove('dr-open');
        var mc = document.querySelector('.main-content');
        if (mc) { mc.style.display = mc._drDisplay !== undefined ? mc._drDisplay : ''; delete mc._drDisplay; }
        CHAT_IDS.forEach(function (id) {
            var el = document.getElementById(id); if (el) el.style.display = '';
        });
    };

    // Automatically close Drive when any other plugin opens
    function wrapSiblings() {
        var names = ['violationsShowView', 'lawLibShowView', 'masterIndexShowView',
            'legalRouterShowView', 'spacesShowView', 'listeningShowView', 'studioShowView',
            'descobertaShowView', 'memoryShowView', 'shadersShowView', 'architectureShowView',
            'craudioShowView', 'writerShowView', 'resetToWelcome', 'aexToggleMain'];
        names.forEach(function (n) {
            var orig = window[n];
            if (typeof orig !== 'function' || orig._drWrapped) return;
            var wrapped = function () {
                try { window.driveHideView(); } catch (_e) { }
                return orig.apply(this, arguments);
            };
            wrapped._drWrapped = true;
            window[n] = wrapped;
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', wrapSiblings);
    } else {
        wrapSiblings();
    }
})();