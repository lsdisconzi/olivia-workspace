### `drive.js` — added search endpoint, search UI, search logic, and search result rendering

```javascript
/* ============================================================================
   Drive — Google Drive manager inside Olivia Workspace.
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
        search: '/api/drive/search',          // ← new search endpoint
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
    var _authStatusCache = null;

    // ── Search state ────────────────────────────────────────────────────────
    var _driveSearchActive = false;
    var _driveSearchPrevFolder = 'root';   // folder to restore after clearing search

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

    // ── Files panel (with search bar added) ─────────────────────────────────
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
            bread.innerHTML = '<span class="dr-bread-item active"><i class="fas fa-search"></i> Resultados para: ' + esc(query) + '</span>';
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

    function renderSearchResults(files, query) {
        var list = document.getElementById('drFilesList');
        if (!list) return;
        if (!files.length) {
            list.innerHTML = '<div class="dr-empty"><i class="fas fa-search"></i> Nenhum resultado para “' + esc(query) + '”</div>';
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
                rowClick = 'onclick="driveNavFolder(\'' + esc(f.id) + '\'); driveClearSearch();"';
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
        _applyFolderFilter();
    }

    // ── Folder filter dropdown (unchanged but kept) ──────────────────────────
    var _driveFilterFolders = Object.create(null);

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
        var rows = document.querySelectorAll('#drFilesList .dr-file-row:not(.dr-file-row-search)');
        rows.forEach(function (row) {
            var nameEl = row.querySelector('.dr-file-link');
            var name = nameEl ? nameEl.textContent.trim() : '';
            var isFolder = row.querySelector('.fa-folder') !== null;
            if (!isFolder) {
                row.style.display = '';
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
                _driveFilterFolders[f.name] = true;
            }
        });
        var dropdown = document.getElementById('drFilterDropdown');
        if (dropdown) {
            var hasFolders = Object.keys(_driveFilterFolders).length > 0;
            dropdown.style.display = hasFolders ? '' : 'none';
        }
        var menu = document.getElementById('drFilterMenu');
        if (menu && menu.style.display !== 'none') {
            _buildFilterMenu();
        }
    }

    function getCurrentFolderId() {
        var bread = document.getElementById('drBreadcrumb');
        var active = bread ? bread.querySelector('.dr-bread-item.active') : null;
        return active ? active.getAttribute('data-id') : 'root';
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

    // ── Upload / Create / Delete (unchanged) ─────────────────────────────────
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

    // ── Chat (SSE) unchanged ─────────────────────────────────────────────────
    // ( … all chat functions remain exactly as before … )
    function loadChatHistory() { /* … */ }
    function saveChatHistory() { /* … */ }
    function renderChatLog() { /* … */ }
    function bubble(role, text) { /* … */ }
    window.driveNewChat = function () { /* … */ };
    window.driveSend = function () { /* … */ };
    // … (the rest of the chat code is identical, omitted for brevity)

    // ── Utility formatters unchanged ─────────────────────────────────────────
    function formatDate(iso) { /* … */ }
    function formatSize(bytes) { /* … */ }

    // ── Lifecycle unchanged ──────────────────────────────────────────────────
    window.driveShowView = function () { /* … */ };
    window.driveHideView = function () { /* … */ };
    // … (rest of lifecycle code unchanged)

})();
```

**Important:** In the provided `drive.js` snippet, the complete chat, lifecycle, and utility functions are omitted to keep the answer focused on the search addition. In your full file you must keep all of that original code untouched; only the parts shown above have been modified or added.

---

### `drive.css` — added search bar, search results grid, and search mode adjustments

```css
/* ============================================================================
   Drive — Google Drive manager inside Olivia Workspace.
   Uses workspace CSS variables.
   ============================================================================ */

.drive-view {
    display: none;
    flex: 1;
    min-height: 0;
    min-width: 0;
    flex-direction: column;
    overflow: hidden;
    position: relative;
    background: var(--bg);
}

.drive-view.active {
    display: flex;
}

.workspace.dr-open>.main-content {
    display: none !important;
}

/* ── Cabeçalho ─────────────────────────────────────────────────────────── */
.dr-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 16px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    background: var(--bg-card);
}

.dr-head-brand {
    display: flex;
    align-items: baseline;
    gap: 9px;
}

.dr-logo {
    width: 20px;
    height: 20px;
    color: var(--amber);
    display: flex;
}

.dr-logo svg {
    width: 100%;
    height: 100%;
}

.dr-title {
    font-family: var(--serif);
    font-size: 16px;
    font-weight: 600;
    color: var(--white);
    letter-spacing: -0.01em;
}

.dr-sub {
    font-family: var(--mono);
    font-size: 9px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--gray);
}

/* ── Header actions ─────────────────────────────────────────────────── */
.dr-head-actions {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
}

.dr-auth-status {
    font-size: 11px;
    padding: 4px 10px;
    border-radius: 20px;
    background: var(--bg-code);
    color: var(--gray);
}

.dr-auth-status.dr-auth-on {
    background: rgba(34, 197, 94, 0.12);
    color: #4caf50;
}

.dr-auth-status.dr-auth-off {
    background: rgba(158, 74, 74, 0.10);
    color: var(--red);
}

/* ── Sub-navegação ─────────────────────────────────────────────────────── */
.dr-subnav {
    display: flex;
    gap: 2px;
    padding: 6px 14px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    background: var(--bg-card);
    overflow-x: auto;
}

.dr-tab {
    padding: 6px 14px;
    border: none;
    background: transparent;
    font-family: var(--sans);
    font-size: 12px;
    font-weight: 500;
    color: var(--gray);
    cursor: pointer;
    border-bottom: 2px solid transparent;
    white-space: nowrap;
    transition: color .15s, border-color .15s;
}

.dr-tab:hover {
    color: var(--white);
}

.dr-tab.active {
    color: var(--amber);
    border-bottom-color: var(--amber);
}

/* ── Painéis ───────────────────────────────────────────────────────────── */
.dr-panels {
    flex: 1;
    min-height: 0;
    display: flex;
}

.dr-panel {
    display: none;
    flex: 1;
    min-height: 0;
}

.dr-panel.active {
    display: flex;
    flex-direction: column;
}

#drPanel-overview {
    overflow-y: auto;
    padding: 28px 24px 48px;
}

#drPanel-overview>* {
    width: 100%;
    max-width: 720px;
    margin-left: auto;
    margin-right: auto;
}

.dr-hero {
    text-align: center;
    padding: 12px 0 26px;
}

.dr-hero-logo {
    display: inline-flex;
    width: 64px;
    height: 64px;
    color: var(--amber);
    margin-bottom: 14px;
}

.dr-hero-logo svg {
    width: 100%;
    height: 100%;
}

.dr-hero-title {
    font-family: var(--serif);
    font-weight: 600;
    font-size: 34px;
    color: var(--white);
    letter-spacing: -0.02em;
    margin: 0 0 8px;
}

.dr-hero-tag {
    font-family: var(--serif);
    font-style: italic;
    font-size: 16px;
    line-height: 1.6;
    color: var(--gray-hi);
    max-width: 480px;
    margin: 0 auto;
}

.dr-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin: 24px 0;
}

.dr-stat {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--r);
    padding: 16px 12px;
    text-align: center;
}

.dr-stat-num {
    font-family: var(--serif);
    font-weight: 600;
    font-size: 26px;
    color: var(--amber);
    line-height: 1;
}

.dr-stat-label {
    font-size: 10px;
    color: var(--gray);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-top: 6px;
}

.dr-cta {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    justify-content: center;
    margin-top: 8px;
}

.dr-guard {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    font-size: 12px;
    line-height: 1.6;
    color: var(--gray-hi);
    background: var(--amber-lo, rgba(196, 98, 45, 0.10));
    border: 1px solid var(--border-hi);
    border-radius: var(--r);
    padding: 12px 14px;
    margin: 22px 0;
}

.dr-guard i {
    color: var(--amber);
    margin-top: 2px;
}

/* ── Files panel ────────────────────────────────────────────────────────── */
#drPanel-files {
    padding: 0;
    flex-direction: column;
}

.dr-files-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    border-bottom: 1px solid var(--border);
    background: var(--bg-card);
    flex-shrink: 0;
    gap: 12px;
}

.dr-toolbar-left {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 0 0 auto;
}

.dr-breadcrumb {
    display: flex;
    gap: 6px;
    align-items: center;
    font-size: 13px;
    color: var(--gray-hi);
}

.dr-bread-item {
    cursor: pointer;
    color: var(--amber);
}

.dr-bread-item.active {
    font-weight: 600;
    color: var(--white);
    pointer-events: none;
}

/* ── Search bar inside the toolbar ────────────────────────────────────── */
.dr-search-bar {
    display: flex;
    align-items: center;
    gap: 4px;
    flex: 1 1 auto;
    min-width: 160px;
}

.dr-search-input {
    flex: 1;
    padding: 5px 10px;
    background: var(--bg);
    color: var(--white);
    border: 1px solid var(--border-hi);
    border-radius: var(--r);
    font-family: var(--sans);
    font-size: 13px;
    line-height: 1.5;
    outline: none;
    transition: border-color 0.15s;
    min-width: 0;
}

.dr-search-input:focus {
    border-color: var(--amber);
}

.dr-search-input::placeholder {
    color: var(--gray);
}

/* ── Actions (right side) ─────────────────────────────────────────────── */
.dr-files-actions {
    display: flex;
    gap: 6px;
    flex: 0 0 auto;
}

/* ── File list grid ────────────────────────────────────────────────────── */
.dr-files-list {
    flex: 1;
    overflow-y: auto;
    background: var(--bg);
    padding: 8px 0;
}

.dr-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--gray);
    gap: 10px;
    font-size: 14px;
}

.dr-empty i {
    font-size: 36px;
    opacity: 0.4;
}

.dr-empty.dr-error {
    color: var(--red);
}

.dr-file-header {
    display: grid;
    grid-template-columns: 1fr 120px 120px 80px 80px;
    padding: 8px 14px;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--gray);
    border-bottom: 1px solid var(--border);
    letter-spacing: 0.04em;
}

.dr-file-row {
    display: grid;
    grid-template-columns: 1fr 120px 120px 80px 80px;
    padding: 10px 14px;
    border-bottom: 1px solid var(--border);
    align-items: center;
    font-size: 13px;
    color: var(--white);
    transition: background .1s;
}

.dr-file-row:hover {
    background: var(--bg-card);
}

.dr-file-row .dr-file-link {
    color: var(--amber);
    cursor: pointer;
    text-decoration: underline;
}

.dr-file-actions {
    white-space: nowrap;
}

.dr-file-actions .btn {
    margin-right: 4px;
}

/* ── Search results grid (extra column for location) ──────────────────── */
.dr-file-header-search {
    grid-template-columns: 1fr 100px 100px 120px 80px 80px;
}

.dr-file-row-search {
    grid-template-columns: 1fr 100px 100px 120px 80px 80px;
}

.dr-file-location {
    color: var(--gray-hi);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

/* ── Chat … (unchanged) ───────────────────────────────────────────────── */
/* … all chat styles remain exactly as before … */

/* ── Responsivo (updated) ──────────────────────────────────────────────── */
@media (max-width: 720px) {
    .dr-stats {
        grid-template-columns: repeat(2, 1fr);
    }

    #drPanel-overview {
        padding: 20px 14px 40px;
    }

    .dr-hero-title {
        font-size: 27px;
    }

    .dr-file-header,
    .dr-file-row {
        grid-template-columns: 1fr 80px 80px 60px;
    }

    .dr-file-type {
        display: none;
    }

    /* Search results adapt: hide location column if too cramped */
    .dr-file-header-search,
    .dr-file-row-search {
        grid-template-columns: 1fr 80px 80px 60px;
    }
    .dr-file-location {
        display: none;
    }
}

/* ── Folder filter dropdown (unchanged) ───────────────────────────────── */
.dr-filter-dropdown {
    position: relative;
    display: inline-flex;
}

.dr-filter-menu {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 4px;
    min-width: 200px;
    max-height: 260px;
    overflow-y: auto;
    background: var(--bg2);
    border: 1px solid var(--border);
    border-radius: var(--r);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
    z-index: 100;
    padding: 4px 0;
}

.dr-filter-item {
    padding: 5px 12px;
    font-size: 12px;
    color: var(--gray-hi);
}

.dr-filter-item:hover {
    background: var(--bg);
}

.dr-filter-item label {
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    margin: 0;
    font-weight: 400;
}

.dr-filter-item input[type="checkbox"] {
    margin: 0;
    accent-color: var(--accent);
}

.dr-filter-empty {
    padding: 8px 12px;
    font-size: 11px;
    color: var(--gray-lo);
    font-style: italic;
}

/* ── Nav buttons in toolbar ──────────────────────────────────────────── */
.dr-files-toolbar .btn-xs {
    font-size: 11px;
    padding: 4px 8px;
}
```

Again, the full CSS file includes the existing chat, guard, and other styles — omitted here to focus on the search additions.

---

**Backend requirement:**  
The search UI calls `GET /api/drive/search?q=…` and expects a JSON response `{ files: […] }` where each file object includes the usual fields plus a `parentName` string for the location column. If your backend is not yet implemented, ensure that endpoint exists and returns files matching the query across the whole Google Drive.