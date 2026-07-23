/* ============================================================================
   Sheets — Planilhas editor inside Olivia Workspace.
   v1 – grid editor, CSV/XLSX import/export, chat panel.
   ============================================================================ */
(function () {
    'use strict';

    // ---------- localStorage keys ----------
    var SHEETS_STORAGE = 'OliviaLegal_sheets_docs_v1';
    var SHEETS_ACTIVE_KEY = 'OliviaLegal_sheets_active_id';

    // ---------- SVG icon (simple grid) ----------
    var SHEET_SVG = '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="10" y="15" width="80" height="70" fill="none" stroke="currentColor" stroke-width="5" rx="4"/>' +
        '<line x1="10" y1="40" x2="90" y2="40" stroke="currentColor" stroke-width="5"/>' +
        '<line x1="10" y1="65" x2="90" y2="65" stroke="currentColor" stroke-width="5"/>' +
        '<line x1="40" y1="15" x2="40" y2="85" stroke="currentColor" stroke-width="5"/>' +
        '<line x1="65" y1="15" x2="65" y2="85" stroke="currentColor" stroke-width="5"/>' +
        '</svg>';

    // ---------- Internal state ----------
    var sBuilt = false;
    var sActivePanel = 'editor';           // 'documents' | 'editor' | 'about'
    var sDocs = {};                        // { id: { name, rows, cols, data, updated } }
    var sActiveDocId = null;
    var sEditorDirty = false;

    // ---------- Helpers ----------
    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function uuid() {
        return 's' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    }

    function loadDocs() {
        try {
            var raw = localStorage.getItem(SHEETS_STORAGE);
            sDocs = raw ? JSON.parse(raw) : {};
        } catch (_) { sDocs = {}; }
    }

    function saveDocs() {
        try { localStorage.setItem(SHEETS_STORAGE, JSON.stringify(sDocs)); } catch (_) {}
    }

    function loadActiveDocId() {
        try {
            sActiveDocId = localStorage.getItem(SHEETS_ACTIVE_KEY) || null;
        } catch (_) { sActiveDocId = null; }
    }

    function saveActiveDocId() {
        try { localStorage.setItem(SHEETS_ACTIVE_KEY, sActiveDocId || ''); } catch (_) {}
    }

    // ---------- Backend sync ----------
    // Persists the active sheet to the project's `sheets` folder on the
    // backend. The server endpoint auto-creates the directory
    // (uploads/projects/<pid>/sheets) and returns JSON {saved:[...],count:n}.
    function syncActiveDocToBackend(doc) {
        if (!doc || typeof getCurrentProjectId !== 'function') return Promise.resolve(false);
        var pid = getCurrentProjectId();
        if (!pid) return Promise.resolve(false);
        var safeName = String(doc.name || 'planilha').trim().replace(/[^\w.\-() ]/g, '_') || 'planilha';
        if (!/\.(csv|json)$/i.test(safeName)) safeName += '.csv';
        // Serialize as CSV (matches the export behaviour).
        var csvContent = sheetToCSV(doc);
        try {
            var mime = /\.json$/i.test(safeName) ? 'application/json' : 'text/csv';
            var blob = new Blob([csvContent], { type: mime });
            var fd = new FormData();
            fd.append('files', blob, safeName);
            return fetch(API_BASE + '/api/projects/' + encodeURIComponent(pid) + '/upload?section=sheets&preserve_paths=true', {
                method: 'POST',
                body: fd
            })
                .then(function (r) { return r.ok ? r.json() : null; })
                .then(function (data) {
                    if (data && (data.count || (data.saved && data.saved.length))) {
                        if (typeof refreshProjectIndex === 'function') refreshProjectIndex(pid);
                        return true;
                    }
                    return false;
                })
                .catch(function (err) {
                    console.warn('[sheets-backend] sync failed:', err);
                    return false;
                });
        } catch (e) {
            console.warn('[sheets-backend] sync error:', e);
            return Promise.resolve(false);
        }
    }

    function formatDate(iso) {
        if (!iso) return '—';
        try { return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }); }
        catch (_) { return iso; }
    }

    // ---------- Build the main view ----------
    function build() {
        var view = document.getElementById('sheetsView');
        if (!view || sBuilt) return;

        loadDocs();
        loadActiveDocId();
        if (sActiveDocId && !sDocs[sActiveDocId]) sActiveDocId = null;

        view.innerHTML =
            '<div class="sh-head">' +
            '<div class="sh-head-brand">' +
            '<span class="sh-logo">' + SHEET_SVG + '</span>' +
            '<span class="sh-title">Sheets</span>' +
            '<span class="sh-sub">Planilhas • CSV • Excel</span>' +
            '</div>' +
            '<div class="sh-head-actions">' +
            '<button class="btn btn-sm" onclick="sheetsHideView()" title="Fechar">' +
            '<i class="fas fa-times"></i></button>' +
            '</div>' +
            '</div>' +
            '<div class="sh-subnav">' +
            '<button class="sh-tab active" data-panel="editor"    onclick="sheetsSwitchPanel(\'editor\')">Editor</button>' +
            '<button class="sh-tab"        data-panel="documents" onclick="sheetsSwitchPanel(\'documents\')">Documentos</button>' +
            '<button class="sh-tab"        data-panel="about"     onclick="sheetsSwitchPanel(\'about\')">Sobre</button>' +
            '</div>' +
            '<div class="sh-panels">' +
            '<div id="shPanel-editor"    class="sh-panel active">' + editorHtml() + '</div>' +
            '<div id="shPanel-documents" class="sh-panel">' + documentsHtml() + '</div>' +
            '<div id="shPanel-about"     class="sh-panel">' + aboutHtml() + '</div>' +
            '</div>';

        sBuilt = true;
        renderEditor();
        renderDocumentList();
    }

    // ---------- Panel: Editor ----------
    function editorHtml() {
        return '<div class="sh-editor-toolbar">' +
            '<div class="sh-tool-group">' +
            '<button class="btn btn-xs" onclick="sheetsAddRow()" title="Adicionar linha"><i class="fas fa-plus"></i> Linha</button>' +
            '<button class="btn btn-xs" onclick="sheetsAddCol()" title="Adicionar coluna"><i class="fas fa-plus"></i> Coluna</button>' +
            '<button class="btn btn-xs" onclick="sheetsDeleteRow()" title="Excluir linha"><i class="fas fa-trash-alt"></i> Linha</button>' +
            '<button class="btn btn-xs" onclick="sheetsDeleteCol()" title="Excluir coluna"><i class="fas fa-trash-alt"></i> Coluna</button>' +
            '</div>' +
            '<div class="sh-tool-group">' +
            '<label for="shImportFile" class="sr-only" style="display:none">Importar planilha (CSV/XLS/XLSX)</label>' +
            '<input type="file" id="shImportFile" aria-label="Importar planilha (CSV/XLS/XLSX)" accept=".csv,.xls,.xlsx" style="display:none" onchange="sheetsImportFile(event)">' +
            '<button class="btn btn-sm" onclick="document.getElementById(\'shImportFile\').click()" title="Importar planilha"><i class="fas fa-upload"></i> Importar</button>' +
            '<button class="btn btn-sm" onclick="sheetsSaveActive()" title="Salvar"><i class="fas fa-save"></i> Salvar</button>' +
            '<div class="sh-export-dropdown">' +
            '<button class="btn btn-sm" onclick="sheetsToggleExport()" title="Exportar"><i class="fas fa-file-export"></i> Exportar ▾</button>' +
            '<div id="shExportMenu" class="sh-export-menu" style="display:none">' +
            '<button class="btn btn-xs" onclick="sheetsExport(\'csv\')">CSV (.csv)</button>' +
            '<button class="btn btn-xs" onclick="sheetsExport(\'xlsx\')">Excel (.xlsx)</button>' +
            '<div class="sh-export-divider"></div>' +
            '<div class="sh-export-label">Documento HAVAN</div>' +
            '<button class="btn btn-xs" onclick="sheetsExportHavan(\'docx\')">Word — HAVAN (.docx)</button>' +
            '<button class="btn btn-xs" onclick="sheetsExportHavan(\'pdf\')">PDF — HAVAN (.pdf)</button>' +
            '<button class="btn btn-xs" onclick="sheetsExportHavan(\'html\')">HTML — HAVAN (.html)</button>' +
            '<button class="btn btn-xs" onclick="sheetsExportHavan(\'docx,pdf,html\')">Todos (docx+pdf+html)</button>' +
            '</div>' +
            '</div>' +
            '<button class="btn btn-sm" onclick="sheetsNewDocument()" title="Nova planilha"><i class="fas fa-plus"></i> Nova</button>' +
            '</div>' +
            '</div>' +
            '<div class="sh-grid-wrapper" id="shGridWrapper">' +
            '<table id="shGrid" class="sh-grid"></table>' +
            '</div>' +
            '<div class="sh-editor-footer">' +
            '<span id="shDocName">Sem título</span> • <span id="shDocStats"></span>' +
            '<button id="shChatToggleBtn" class="btn btn-xs" onclick="sheetsToggleChat()" title="Abrir chat com agentes">' +
            '<i class="fas fa-comment-dots"></i> Chat</button>' +
            '</div>' +
            '<div id="shChatPanel" class="sh-chat-panel" style="display:none;">' +
            '<div id="shChatMessages" class="sh-chat-messages"></div>' +
            '<div class="sh-chat-input-area">' +
            '<label for="shChatInput" class="sr-only" style="display:none">Pergunte ao agente sobre esta planilha</label>' +
            '<input id="shChatInput" class="sh-chat-input" aria-label="Pergunte ao agente sobre esta planilha" placeholder="Pergunte ao agente…" onkeydown="if(event.key===\'Enter\')sheetsSendChat()">' +
            '<button class="btn btn-sm" onclick="sheetsSendChat()" title="Enviar"><i class="fas fa-paper-plane"></i></button>' +
            '</div>' +
            '</div>';
    }

    // ---------- Panel: Documents ----------
    function documentsHtml() {
        return '<div class="sh-docs-toolbar">' +
            '<button class="btn btn-sm" onclick="sheetsNewDocument()"><i class="fas fa-plus"></i> Nova</button>' +
            '</div>' +
            '<div class="sh-docs-list" id="shDocsList">' +
            '<div class="sh-empty"><i class="fas fa-table"></i> Nenhuma planilha salva</div>' +
            '</div>';
    }

    // ---------- Panel: About ----------
    function aboutHtml() {
        return '<div class="sh-hero">' +
            '<span class="sh-hero-logo">' + SHEET_SVG + '</span>' +
            '<h1 class="sh-hero-title">Sheets</h1>' +
            '<p class="sh-hero-tag">Editor de planilhas integrado. Suporta CSV e Excel, com importação e exportação.</p>' +
            '<p class="sh-hero-tag">As planilhas são salvas localmente no navegador.</p>' +
            '</div>';
    }

    // ---------- Tab switching ----------
    window.sheetsSwitchPanel = function (name) {
        sActivePanel = name;
        ['editor', 'documents', 'about'].forEach(function (p) {
            var panel = document.getElementById('shPanel-' + p);
            if (panel) panel.classList.toggle('active', p === name);
        });
        var tabs = document.querySelectorAll('#sheetsView .sh-tab');
        tabs.forEach(function (t) {
            t.classList.toggle('active', t.getAttribute('data-panel') === name);
        });
        if (name === 'documents') {
            renderDocumentList();
        } else if (name === 'editor') {
            renderEditor();
        }
    };

    // ---------- Grid rendering ----------
    function renderEditor() {
        if (!sBuilt || sActivePanel !== 'editor') return;
        if (!sActiveDocId) {
            sActiveDocId = uuid();
            sDocs[sActiveDocId] = createEmptySheet('Sem título');
            saveDocs();
            saveActiveDocId();
        }
        var doc = sDocs[sActiveDocId] || createEmptySheet('Sem título');
        var nameEl = document.getElementById('shDocName');
        if (nameEl) nameEl.textContent = esc(doc.name);
        renderGrid(doc);
        updateStats(doc);
        sEditorDirty = false;
    }

    function createEmptySheet(name) {
        return {
            name: name,
            rows: 10,
            cols: 5,
            data: Array.from({ length: 10 }, () => Array(5).fill('')),
            updated: new Date().toISOString()
        };
    }

    function renderGrid(doc) {
        var table = document.getElementById('shGrid');
        if (!table) return;
        var html = '<thead><tr><th></th>';
        for (var c = 0; c < doc.cols; c++) {
            html += '<th>' + colLabel(c) + '</th>';
        }
        html += '</tr></thead><tbody>';
        for (var r = 0; r < doc.rows; r++) {
            html += '<tr><td class="sh-row-header">' + (r + 1) + '</td>';
            for (var c = 0; c < doc.cols; c++) {
                var cell = (doc.data[r] && doc.data[r][c]) || '';
                html += '<td contenteditable="true" data-row="' + r + '" data-col="' + c +
                    '" class="sh-cell" oninput="sheetsOnCellChange(this)" onkeydown="sheetsOnCellKey(event, this)">' +
                    esc(cell) + '</td>';
            }
            html += '</tr>';
        }
        html += '</tbody>';
        table.innerHTML = html;
    }

    function colLabel(index) {
        // Excel-like column labels: A, B, ..., Z, AA, AB, ...
        var label = '';
        var n = index;
        while (n >= 0) {
            label = String.fromCharCode((n % 26) + 65) + label;
            n = Math.floor(n / 26) - 1;
        }
        return label;
    }

    function updateStats(doc) {
        var stats = document.getElementById('shDocStats');
        if (!stats) return;
        var filled = 0;
        for (var r = 0; r < doc.rows; r++) {
            for (var c = 0; c < doc.cols; c++) {
                if (doc.data[r] && doc.data[r][c]) filled++;
            }
        }
        stats.textContent = doc.rows + ' linhas × ' + doc.cols + ' colunas, ' + filled + ' células preenchidas';
    }

    window.sheetsOnCellChange = function (td) {
        if (!sActiveDocId) return;
        var row = parseInt(td.getAttribute('data-row'));
        var col = parseInt(td.getAttribute('data-col'));
        var value = td.textContent;
        var doc = sDocs[sActiveDocId];
        if (!doc.data[row]) doc.data[row] = [];
        doc.data[row][col] = value;
        doc.updated = new Date().toISOString();
        sEditorDirty = true;
        updateStats(doc);
    };

    window.sheetsOnCellKey = function (e, td) {
        // Tab and Enter navigation
        if (e.key === 'Tab' || e.key === 'Enter') {
            e.preventDefault();
            var row = parseInt(td.getAttribute('data-row'));
            var col = parseInt(td.getAttribute('data-col'));
            var doc = sDocs[sActiveDocId];
            var nextRow = row, nextCol = col;
            if (e.key === 'Tab') {
                nextCol = e.shiftKey ? col - 1 : col + 1;
            } else {
                nextRow = row + 1;
            }
            if (nextRow >= 0 && nextRow < doc.rows && nextCol >= 0 && nextCol < doc.cols) {
                var nextCell = document.querySelector('.sh-cell[data-row="' + nextRow + '"][data-col="' + nextCol + '"]');
                if (nextCell) {
                    nextCell.focus();
                    var range = document.createRange();
                    range.selectNodeContents(nextCell);
                    var sel = window.getSelection();
                    sel.removeAllRanges();
                    sel.addRange(range);
                }
            }
        }
    };

    // ---------- Row/Col manipulation ----------
    window.sheetsAddRow = function () {
        if (!sActiveDocId) return;
        var doc = sDocs[sActiveDocId];
        doc.rows++;
        doc.data.push(Array(doc.cols).fill(''));
        doc.updated = new Date().toISOString();
        sEditorDirty = true;
        renderGrid(doc);
        updateStats(doc);
    };

    window.sheetsAddCol = function () {
        if (!sActiveDocId) return;
        var doc = sDocs[sActiveDocId];
        doc.cols++;
        for (var r = 0; r < doc.rows; r++) {
            if (!doc.data[r]) doc.data[r] = [];
            doc.data[r].push('');
        }
        doc.updated = new Date().toISOString();
        sEditorDirty = true;
        renderGrid(doc);
        updateStats(doc);
    };

    window.sheetsDeleteRow = function () {
        if (!sActiveDocId) return;
        var doc = sDocs[sActiveDocId];
        if (doc.rows <= 1) return alert('A planilha deve ter pelo menos uma linha.');
        doc.rows--;
        doc.data.pop();
        doc.updated = new Date().toISOString();
        sEditorDirty = true;
        renderGrid(doc);
        updateStats(doc);
    };

    window.sheetsDeleteCol = function () {
        if (!sActiveDocId) return;
        var doc = sDocs[sActiveDocId];
        if (doc.cols <= 1) return alert('A planilha deve ter pelo menos uma coluna.');
        doc.cols--;
        for (var r = 0; r < doc.rows; r++) {
            if (doc.data[r]) doc.data[r].pop();
        }
        doc.updated = new Date().toISOString();
        sEditorDirty = true;
        renderGrid(doc);
        updateStats(doc);
    };

    // ---------- Save ----------
    window.sheetsSaveActive = function () {
        if (!sActiveDocId) return;
        var doc = sDocs[sActiveDocId];
        var name = prompt('Nome da planilha:', doc.name);
        if (name === null) return;
        name = name.trim() || 'Sem título';
        doc.name = name;
        saveDocs();
        sEditorDirty = false;
        document.getElementById('shDocName').textContent = esc(name);
        renderDocumentList();

        // Persist the file to the backend (uploads/projects/<pid>/sheets).
        syncActiveDocToBackend(doc);
    };

    // ---------- Export ----------
    window.sheetsToggleExport = function () {
        var menu = document.getElementById('shExportMenu');
        if (menu) menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
        if (menu.style.display !== 'none') {
            setTimeout(function () {
                var handler = function (e) {
                    if (!menu.contains(e.target)) {
                        menu.style.display = 'none';
                        document.removeEventListener('click', handler);
                    }
                };
                document.addEventListener('click', handler);
            }, 0);
        }
    };

    window.sheetsExport = function (format) {
        if (!sActiveDocId) return;
        var doc = sDocs[sActiveDocId];
        var name = doc.name.replace(/[^\w\s-]/g, '') || 'planilha';
        var csvContent = sheetToCSV(doc);
        if (format === 'csv') {
            downloadBlob(csvContent, name + '.csv', 'text/csv');
        } else if (format === 'xlsx') {
            if (typeof XLSX !== 'undefined') {
                var wb = XLSX.utils.book_new();
                var ws = XLSX.utils.aoa_to_sheet(doc.data);
                XLSX.utils.book_append_sheet(wb, ws, 'Planilha1');
                var wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
                downloadBlob(new Blob([wbout], { type: 'application/octet-stream' }), name + '.xlsx');
            } else {
                alert('A biblioteca SheetJS (XLSX) não foi carregada. Exportando como CSV.');
                downloadBlob(csvContent, name + '.csv', 'text/csv');
            }
        }
        document.getElementById('shExportMenu').style.display = 'none';
    };

    // ---------- Export branded "Documento HAVAN" from a sheet (DOCX/PDF/HTML) ----------
    window.sheetsExportHavan = function (formats) {
        if (!sActiveDocId) { alert('Nenhuma planilha ativa.'); return; }
        var doc = sDocs[sActiveDocId];
        if (!doc || !Array.isArray(doc.data) || !doc.data.length) {
            alert('A planilha está vazia.'); return;
        }
        // Serializa a grade em Markdown (tabela)
        var md = '# ' + (doc.name || 'Planilha') + '\n\n';
        md += '| ' + doc.data[0].map(function (c, i) { return 'Coluna ' + (i + 1); }).join(' | ') + ' |\n';
        md += '| ' + doc.data[0].map(function () { return '---'; }).join(' | ') + ' |\n';
        for (var r = 0; r < doc.data.length; r++) {
            var row = doc.data[r];
            md += '| ' + row.map(function (c) { return (c == null ? '' : String(c)).replace(/\|/g, '\\|').replace(/\n/g, ' '); }).join(' | ') + ' |\n';
        }
        md += '\n';

        var pid = (typeof getCurrentProjectId === 'function') ? getCurrentProjectId() : null;
        if (!pid) { alert('Nenhum projeto ativo.'); return; }
        formats = (formats && formats.trim()) ? formats.trim() : 'docx,pdf,html';

        var btn = event && event.currentTarget;
        var oldLabel = null;
        if (btn) { oldLabel = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gerando…'; }

        fetch(API_BASE + '/api/projects/' + encodeURIComponent(pid) + '/convert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: doc.name || 'planilha', md: md, formats: formats, section: 'sheets' })
        })
            .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
            .then(function (res) {
                if (!res.ok || res.body.status !== 'ok') {
                    throw new Error((res.body && res.body.message) || 'Falha na conversão');
                }
                (res.body.files || []).forEach(function (f) { window.open(f.url, '_blank'); });
            })
            .catch(function (err) {
                console.error('[sheets-havan-export]', err);
                alert('Erro ao gerar Documento HAVAN: ' + err.message);
            })
            .finally(function () {
                if (btn) { btn.disabled = false; btn.innerHTML = oldLabel; }
                var menu = document.getElementById('shExportMenu');
                if (menu) menu.style.display = 'none';
            });
    };

    function sheetToCSV(doc) {
        return doc.data.map(row =>
            row.map(cell => {
                if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
                    return '"' + cell.replace(/"/g, '""') + '"';
                }
                return cell;
            }).join(',')
        ).join('\n');
    }

    function downloadBlob(content, filename, mime) {
        var blob = mime ? new Blob([content], { type: mime }) : content;
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // ---------- Import ----------
    window.sheetsImportFile = function (event) {
        var file = event.target.files[0];
        if (!file) return;
        var ext = file.name.split('.').pop().toLowerCase();

        function insertSheet(name, rows, cols, data) {
            if (sActiveDocId && sEditorDirty) {
                if (!confirm('Há alterações não salvas. Deseja substituir a planilha atual?')) return;
            }
            var id = sActiveDocId || uuid();
            sDocs[id] = {
                name: name || file.name.replace(/\.[^/.]+$/, ''),
                rows: rows,
                cols: cols,
                data: data,
                updated: new Date().toISOString()
            };
            sActiveDocId = id;
            saveDocs();
            saveActiveDocId();
            renderEditor();
            renderDocumentList();
            sheetsSwitchPanel('editor');
        }

        if (ext === 'csv') {
            var reader = new FileReader();
            reader.onload = function (e) {
                var text = e.target.result;
                var rows = parseCSV(text);
                if (rows.length === 0) return alert('Arquivo CSV vazio.');
                var maxCols = Math.max.apply(null, rows.map(r => r.length));
                var data = rows.map(r => {
                    while (r.length < maxCols) r.push('');
                    return r;
                });
                insertSheet(file.name.replace(/\.csv$/i, ''), data.length, maxCols, data);
                if (sActiveDocId) syncActiveDocToBackend(sDocs[sActiveDocId]);
            };
            reader.readAsText(file);
        } else if (ext === 'xls' || ext === 'xlsx') {
            if (typeof XLSX !== 'undefined') {
                var reader = new FileReader();
                reader.onload = function (e) {
                    var data = new Uint8Array(e.target.result);
                    var wb = XLSX.read(data, { type: 'array' });
                    var firstSheet = wb.SheetNames[0];
                    var ws = wb.Sheets[firstSheet];
                    var aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
                    if (!aoa.length) return alert('Planilha vazia.');
                    var maxCols = Math.max.apply(null, aoa.map(r => r.length));
                    var fixedData = aoa.map(r => {
                        while (r.length < maxCols) r.push('');
                        return r;
                    });
                    insertSheet(file.name.replace(/\.[^.]+$/, ''), fixedData.length, maxCols, fixedData);
                    if (sActiveDocId) syncActiveDocToBackend(sDocs[sActiveDocId]);
                };
                reader.readAsArrayBuffer(file);
            } else {
                alert('Para importar Excel, inclua a biblioteca SheetJS (xlsx.full.min.js).\nPor enquanto, apenas CSV é suportado.');
            }
        } else {
            alert('Formato não suportado. Use .csv ou .xlsx.');
        }
        event.target.value = '';
    };

    function parseCSV(text) {
        var rows = [];
        var lines = text.split(/\r?\n/);
        for (var i = 0; i < lines.length; i++) {
            if (lines[i].trim() === '') continue;
            var cols = [];
            var inQuotes = false;
            var current = '';
            for (var j = 0; j < lines[i].length; j++) {
                var ch = lines[i][j];
                if (inQuotes) {
                    if (ch === '"') {
                        if (j + 1 < lines[i].length && lines[i][j + 1] === '"') {
                            current += '"';
                            j++;
                        } else {
                            inQuotes = false;
                        }
                    } else {
                        current += ch;
                    }
                } else {
                    if (ch === '"') {
                        inQuotes = true;
                    } else if (ch === ',') {
                        cols.push(current);
                        current = '';
                    } else {
                        current += ch;
                    }
                }
            }
            cols.push(current);
            rows.push(cols);
        }
        return rows;
    }

    // ---------- Document management ----------
    window.sheetsNewDocument = function () {
        if (sEditorDirty && !confirm('Há alterações não salvas. Deseja continuar sem salvar?')) return;
        var id = uuid();
        sDocs[id] = createEmptySheet('Sem título');
        saveDocs();
        sActiveDocId = id;
        saveActiveDocId();
        renderEditor();
        renderDocumentList();
        sheetsSwitchPanel('editor');
    };

    window.sheetsOpenDocument = function (id) {
        if (sActiveDocId === id) {
            sheetsSwitchPanel('editor');
            return;
        }
        if (sEditorDirty && !confirm('Há alterações não salvas na planilha atual. Deseja continuar sem salvar?')) return;
        sActiveDocId = id;
        saveActiveDocId();
        renderEditor();
        sheetsSwitchPanel('editor');
    };

    window.sheetsDeleteDocument = function (id) {
        if (!confirm('Tem certeza que deseja excluir esta planilha?')) return;
        delete sDocs[id];
        saveDocs();
        if (sActiveDocId === id) {
            sActiveDocId = null;
            saveActiveDocId();
            renderEditor();
        }
        renderDocumentList();
    };

    window.sheetsRenameDocument = function (id) {
        var doc = sDocs[id];
        if (!doc) return;
        var newName = prompt('Novo nome:', doc.name);
        if (newName === null) return;
        newName = newName.trim() || 'Sem título';
        doc.name = newName;
        saveDocs();
        if (sActiveDocId === id) {
            document.getElementById('shDocName').textContent = esc(newName);
        }
        renderDocumentList();
    };

    function renderDocumentList() {
        var list = document.getElementById('shDocsList');
        if (!list) return;
        var ids = Object.keys(sDocs).sort(function (a, b) {
            return (sDocs[b].updated || '').localeCompare(sDocs[a].updated || '');
        });
        if (!ids.length) {
            list.innerHTML = '<div class="sh-empty"><i class="fas fa-table"></i> Nenhuma planilha salva</div>';
            return;
        }
        var html = '<div class="sh-doc-header"><span class="sh-doc-name">Nome</span><span class="sh-doc-modified">Modificado</span><span class="sh-doc-actions">Ações</span></div>';
        ids.forEach(function (id) {
            var doc = sDocs[id];
            var isActive = (id === sActiveDocId);
            html += '<div class="sh-doc-row' + (isActive ? ' sh-doc-active' : '') + '">' +
                '<span class="sh-doc-name"><a href="#" onclick="event.preventDefault();sheetsOpenDocument(\'' + esc(id) + '\')">' + esc(doc.name) + '</a></span>' +
                '<span class="sh-doc-modified">' + esc(formatDate(doc.updated)) + '</span>' +
                '<span class="sh-doc-actions">' +
                '<button class="btn btn-xs" onclick="sheetsRenameDocument(\'' + esc(id) + '\')" title="Renomear"><i class="fas fa-edit"></i></button>' +
                '<button class="btn btn-xs" onclick="sheetsDeleteDocument(\'' + esc(id) + '\')" title="Excluir"><i class="fas fa-trash-alt"></i></button>' +
                '</span>' +
                '</div>';
        });
        list.innerHTML = html;
    }

    // ---------- Chat panel ----------
    window.sheetsToggleChat = function () {
        var panel = document.getElementById('shChatPanel');
        if (!panel) return;
        var isVisible = panel.style.display === 'block';
        panel.style.display = isVisible ? 'none' : 'block';
        if (!isVisible) document.getElementById('shChatInput').focus();
    };

    window.sheetsSendChat = function () {
        var input = document.getElementById('shChatInput');
        var messages = document.getElementById('shChatMessages');
        if (!input || !messages) return;
        var text = input.value.trim();
        if (!text) return;

        var userMsg = document.createElement('div');
        userMsg.className = 'sh-chat-msg sh-chat-msg-user';
        userMsg.textContent = text;
        messages.appendChild(userMsg);
        input.value = '';
        messages.scrollTop = messages.scrollHeight;

        if (typeof window.sendMessageToAgent === 'function') {
            window.sendMessageToAgent(text, function (reply) {
                var agentMsg = document.createElement('div');
                agentMsg.className = 'sh-chat-msg sh-chat-msg-agent';
                agentMsg.textContent = reply;
                messages.appendChild(agentMsg);
                messages.scrollTop = messages.scrollHeight;
            });
        } else {
            setTimeout(function () {
                var agentMsg = document.createElement('div');
                agentMsg.className = 'sh-chat-msg sh-chat-msg-agent';
                agentMsg.textContent = 'Resposta automática (agente não conectado): ' + text;
                messages.appendChild(agentMsg);
                messages.scrollTop = messages.scrollHeight;
            }, 500);
        }
    };

    // ---------- Lifecycle: show / hide ----------
    var SIBLING_HIDE = ['violationsHideView', 'lawLibHideView', 'masterIndexHideView',
        'legalRouterHideView', 'spacesHideView', 'listeningHideView', 'studioHideView',
        'descobertaHideView', 'memoryHideView', 'shadersHideView', 'architectureHideView',
        'craudioHideView', 'driveHideView', 'writerHideView'];  // include Writer hide
    var CHAT_IDS = ['chatHeader', 'welcomeState', 'chatLog', 'chatCompose', 'chatToolbar'];

    window.sheetsShowView = function () {
        build();
        CHAT_IDS.forEach(function (id) {
            var el = document.getElementById(id); if (el) el.style.display = 'none';
        });
        var mc = document.querySelector('.main-content');
        if (mc) { mc._shDisplay = mc.style.display; mc.style.display = 'none'; }
        SIBLING_HIDE.forEach(function (fn) {
            try { if (typeof window[fn] === 'function') window[fn](); } catch (_) { }
        });
        var v = document.getElementById('sheetsView');
        if (v) v.classList.add('active');
        var ws = document.querySelector('.workspace');
        if (ws) ws.classList.add('sh-open');
    };

    window.sheetsHideView = function () {
        var v = document.getElementById('sheetsView');
        if (v) v.classList.remove('active');
        var ws = document.querySelector('.workspace');
        if (ws) ws.classList.remove('sh-open');
        var mc = document.querySelector('.main-content');
        if (mc) { mc.style.display = mc._shDisplay !== undefined ? mc._shDisplay : ''; delete mc._shDisplay; }
        CHAT_IDS.forEach(function (id) {
            var el = document.getElementById(id); if (el) el.style.display = '';
        });
    };

    // ---------- Sibling wrapping (auto-close) ----------
    function wrapSiblings() {
        var names = ['violationsShowView', 'lawLibShowView', 'masterIndexShowView',
            'legalRouterShowView', 'spacesShowView', 'listeningShowView', 'studioShowView',
            'descobertaShowView', 'memoryShowView', 'shadersShowView', 'architectureShowView',
            'craudioShowView', 'resetToWelcome', 'aexToggleMain',
            'driveShowView', 'writerShowView'];  // also wrap Writer's show
        names.forEach(function (n) {
            var orig = window[n];
            if (typeof orig !== 'function' || orig._shWrapped) return;
            var wrapped = function () {
                try { window.sheetsHideView(); } catch (_) { }
                return orig.apply(this, arguments);
            };
            wrapped._shWrapped = true;
            window[n] = wrapped;
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', wrapSiblings);
    } else {
        wrapSiblings();
    }
})();