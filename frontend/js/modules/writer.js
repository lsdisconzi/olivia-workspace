/* ============================================================================
   Writer — Markdown / plain-text editor inside Olivia Workspace.
   v2 – added file import + integrated chat panel.
   ============================================================================ */
(function () {
    'use strict';

    // ---------- localStorage keys ----------
    var WRITER_STORAGE = 'OliviaLegal_writer_docs_v1';
    var WRITER_ACTIVE_KEY = 'OliviaLegal_writer_active_id';

    // ---------- SVG icon ----------
    var PEN_SVG_WRITER = '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M30 80 L30 70 L70 30 L80 40 L40 80 Z" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/>' +
        '<line x1="30" y1="70" x2="40" y2="80" stroke="currentColor" stroke-width="5"/>' +
        '<line x1="70" y1="30" x2="80" y2="40" stroke="currentColor" stroke-width="5"/>' +
        '<circle cx="78" cy="38" r="3" fill="currentColor"/>' +
        '</svg>';

    // ---------- Internal state ----------
    var wBuilt = false;
    var wActivePanel = 'editor';           // 'documents' | 'editor' | 'about'
    var wDocs = {};
    var wActiveDocId = null;
    var wEditorDirty = false;

    // ---------- Helpers ----------
    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function uuid() {
        return 'w' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    }

    function loadDocs() {
        try {
            var raw = localStorage.getItem(WRITER_STORAGE);
            wDocs = raw ? JSON.parse(raw) : {};
        } catch (_) { wDocs = {}; }
    }

    function saveDocs() {
        try { localStorage.setItem(WRITER_STORAGE, JSON.stringify(wDocs)); } catch (_) {}
    }

    function loadActiveDocId() {
        try {
            wActiveDocId = localStorage.getItem(WRITER_ACTIVE_KEY) || null;
        } catch (_) { wActiveDocId = null; }
    }

    function saveActiveDocId() {
        try { localStorage.setItem(WRITER_ACTIVE_KEY, wActiveDocId || ''); } catch (_) {}
    }

    // ---------- Backend sync ----------
    // Persists the active document to the project's `writer` folder on the
    // backend. The server endpoint auto-creates the directory
    // (uploads/projects/<pid>/writer) and returns JSON {saved:[...],count:n}.
    function syncActiveDocToBackend(name, content) {
        if (typeof getCurrentProjectId !== 'function') return Promise.resolve(false);
        var pid = getCurrentProjectId();
        if (!pid) return Promise.resolve(false);
        var safeName = String(name || 'documento').trim().replace(/[^\w.\-() ]/g, '_') || 'documento';
        if (!/\.(md|txt|markdown)$/i.test(safeName)) safeName += '.md';
        try {
            var blob = new Blob([content || ''], { type: 'text/markdown' });
            var fd = new FormData();
            fd.append('files', blob, safeName);
            return fetch(API_BASE + '/api/projects/' + encodeURIComponent(pid) + '/upload?section=writer&preserve_paths=true', {
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
                    console.warn('[writer-backend] sync failed:', err);
                    return false;
                });
        } catch (e) {
            console.warn('[writer-backend] sync error:', e);
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
        var view = document.getElementById('writerView');
        if (!view || wBuilt) return;

        loadDocs();
        loadActiveDocId();
        if (wActiveDocId && !wDocs[wActiveDocId]) wActiveDocId = null;

        view.innerHTML =
            '<div class="wr-head">' +
            '<div class="wr-head-brand">' +
            '<span class="wr-logo">' + PEN_SVG_WRITER + '</span>' +
            '<span class="wr-title">Writer</span>' +
            '<span class="wr-sub">Markdown • TXT</span>' +
            '</div>' +
            '<div class="wr-head-actions">' +
            '<button class="btn btn-sm" onclick="writerHideView()" title="Fechar">' +
            '<i class="fas fa-times"></i></button>' +
            '</div>' +
            '</div>' +
            '<div class="wr-subnav">' +
            '<button class="wr-tab active" data-panel="editor"    onclick="writerSwitchPanel(\'editor\')">Editor</button>' +
            '<button class="wr-tab"        data-panel="documents" onclick="writerSwitchPanel(\'documents\')">Documentos</button>' +
            '<button class="wr-tab"        data-panel="about"     onclick="writerSwitchPanel(\'about\')">Sobre</button>' +
            '</div>' +
            '<div class="wr-panels">' +
            '<div id="wrPanel-editor"    class="wr-panel active">' + editorHtml() + '</div>' +
            '<div id="wrPanel-documents" class="wr-panel">' + documentsHtml() + '</div>' +
            '<div id="wrPanel-about"     class="wr-panel">' + aboutHtml() + '</div>' +
            '</div>';

        wBuilt = true;
        renderEditor();
        renderDocumentList();
    }

    // ---------- Panel: Editor ----------
    function editorHtml() {
        return '<div class="wr-editor-toolbar">' +
            '<div class="wr-tool-group">' +
            '<button class="btn btn-xs" onclick="writerInsertMd(\'**\',\'**\')" title="Negrito"><b>B</b></button>' +
            '<button class="btn btn-xs" onclick="writerInsertMd(\'*\',\'*\')" title="Itálico"><i>I</i></button>' +
            '<button class="btn btn-xs" onclick="writerInsertMd(\'# \',\'\')" title="Título 1">H1</button>' +
            '<button class="btn btn-xs" onclick="writerInsertMd(\'## \',\'\')" title="Título 2">H2</button>' +
            '<button class="btn btn-xs" onclick="writerInsertMd(\'- \',\'\')" title="Lista">•</button>' +
            '<button class="btn btn-xs" onclick="writerInsertMd(\'1. \',\'\')" title="Lista numerada">1.</button>' +
            '<button class="btn btn-xs" onclick="writerInsertMd(\'`\',\'`\')" title="Código"><code>&lt;/&gt;</code></button>' +
            '<button class="btn btn-xs" onclick="writerInsertMd(\'[texto](url)\',\'\')" title="Link">🔗</button>' +
            '</div>' +
            '<div class="wr-tool-group">' +
            // NEW: Import button (hidden file input + visible button)
            '<input type="file" id="wrImportFile" accept=".doc,.docx,.txt,.md,.pdf,.html" style="display:none" onchange="writerImportFile(event)">' +
            '<button class="btn btn-sm" onclick="document.getElementById(\'wrImportFile\').click()" title="Importar arquivo">' +
            '<i class="fas fa-upload"></i> Importar</button>' +
            '<button class="btn btn-sm" onclick="writerShowMdPanel()" title="Ver/colocar/copiar Markdown"><i class="fas fa-file-alt"></i> MD</button>' +
            '<button class="btn btn-sm" onclick="writerSaveActive()" title="Salvar"><i class="fas fa-save"></i> Salvar</button>' +
            '<div class="wr-export-dropdown">' +
            '<button class="btn btn-sm" onclick="writerToggleExport()" title="Exportar"><i class="fas fa-file-export"></i> Exportar ▾</button>' +
            '<div id="wrExportMenu" class="wr-export-menu" style="display:none">' +
            '<button class="btn btn-xs" onclick="writerExport(\'md\')">Markdown (.md)</button>' +
            '<button class="btn btn-xs" onclick="writerExport(\'txt\')">Texto (.txt)</button>' +
            '<button class="btn btn-xs" onclick="writerExport(\'html\')">HTML (.html)</button>' +
            '<div class="wr-export-divider"></div>' +
            '<div class="wr-export-label">Documento HAVAN</div>' +
            '<button class="btn btn-xs" onclick="writerExportHavan(\'docx\')">Word — HAVAN (.docx)</button>' +
            '<button class="btn btn-xs" onclick="writerExportHavan(\'pdf\')">PDF — HAVAN (.pdf)</button>' +
            '<button class="btn btn-xs" onclick="writerExportHavan(\'html\')">HTML — HAVAN (.html)</button>' +
            '<button class="btn btn-xs" onclick="writerExportHavan(\'docx,pdf,html\')">Todos (docx+pdf+html)</button>' +
            '</div>' +
            '</div>' +
            '<button class="btn btn-sm" onclick="writerNewDocument()" title="Novo documento"><i class="fas fa-plus"></i> Novo</button>' +
            '</div>' +
            '</div>' +

            // Editor area
            '<textarea id="wrEditorArea" class="wr-editor-area" placeholder="Comece a escrever em Markdown…" oninput="writerOnEditorChange()"></textarea>' +
            '<div id="wrMdViewPanel" class="wr-md-view-panel" style="display:none;">' +
            '<div class="wr-md-view-header">' +
            '<span>Visualizar Markdown</span>' +
            '<button class="btn btn-xs" onclick="writerHideMdPanel()" title="Fechar"><i class="fas fa-times"></i></button>' +
            '</div>' +
            '<textarea id="wrMdViewArea" class="wr-md-view-area" readonly></textarea>' +
            '<div class="wr-md-view-actions">' +
            '<button class="btn btn-xs" onclick="writerCopyMd()" title="Copiar Markdown"><i class="fas fa-copy"></i> Copiar</button>' +
            '<button class="btn btn-xs" onclick="writerPasteMd()" title="Colar do clipboard"><i class="fas fa-clipboard"></i> Colar</button>' +
            '</div>' +
            '</div>' +

            // Footer with doc info
            '<div class="wr-editor-footer">' +
            '<span id="wrDocName">Sem título</span> • <span id="wrDocStats"></span>' +
            // NEW: Chat toggle button in the footer
            '<button id="wrChatToggleBtn" class="btn btn-xs" onclick="writerToggleChat()" title="Abrir chat com agentes">' +
            '<i class="fas fa-comment-dots"></i> Chat</button>' +
            '</div>' +

            // NEW: Chat panel (hidden by default)
            '<div id="wrChatPanel" class="wr-chat-panel" style="display:none;">' +
            '<div id="wrChatMessages" class="wr-chat-messages"></div>' +
            '<div class="wr-chat-input-area">' +
            '<input id="wrChatInput" class="wr-chat-input" placeholder="Pergunte ao agente…" onkeydown="if(event.key===\'Enter\')writerSendChat()">' +
            '<button class="btn btn-sm" onclick="writerSendChat()" title="Enviar"><i class="fas fa-paper-plane"></i></button>' +
            '</div>' +
            '</div>';
    }

    // ---------- Panel: Documents ----------
    function documentsHtml() {
        return '<div class="wr-docs-toolbar">' +
            '<button class="btn btn-sm" onclick="writerNewDocument()"><i class="fas fa-plus"></i> Novo</button>' +
            '</div>' +
            '<div class="wr-docs-list" id="wrDocsList">' +
            '<div class="wr-empty"><i class="fas fa-file-alt"></i> Nenhum documento salvo</div>' +
            '</div>';
    }

    // ---------- Panel: About ----------
    function aboutHtml() {
        return '<div class="wr-hero">' +
            '<span class="wr-hero-logo">' + PEN_SVG_WRITER + '</span>' +
            '<h1 class="wr-hero-title">Writer</h1>' +
            '<p class="wr-hero-tag">Editor de texto simples e elegante. Suporta Markdown, exportação para .md, .txt e .html.</p>' +
            '<p class="wr-hero-tag">Os documentos são salvos localmente no navegador.</p>' +
            '</div>';
    }

    // ---------- Tab switching ----------
    window.writerSwitchPanel = function (name) {
        wActivePanel = name;
        ['editor', 'documents', 'about'].forEach(function (p) {
            var panel = document.getElementById('wrPanel-' + p);
            if (panel) panel.classList.toggle('active', p === name);
        });
        var tabs = document.querySelectorAll('#writerView .wr-tab');
        tabs.forEach(function (t) {
            t.classList.toggle('active', t.getAttribute('data-panel') === name);
        });
        if (name === 'documents') {
            renderDocumentList();
        } else if (name === 'editor') {
            renderEditor();
        }
    };

    // ---------- Editor helpers ----------
    function renderEditor() {
        if (!wBuilt || wActivePanel !== 'editor') return;
        var area = document.getElementById('wrEditorArea');
        var nameEl = document.getElementById('wrDocName');
        if (!area || !nameEl) return;

        if (!wActiveDocId) {
            wActiveDocId = uuid();
            wDocs[wActiveDocId] = { name: 'Sem título', content: '', updated: new Date().toISOString() };
            saveDocs();
            saveActiveDocId();
        }

        var doc = wDocs[wActiveDocId] || { name: 'Sem título', content: '' };
        area.value = doc.content || '';
        nameEl.textContent = esc(doc.name);
        updateStats();
        wEditorDirty = false;
    }

    function updateStats() {
        var area = document.getElementById('wrEditorArea');
        var stats = document.getElementById('wrDocStats');
        if (!area || !stats) return;
        var chars = area.value.length;
        var lines = (area.value.match(/\n/g) || []).length + 1;
        stats.textContent = chars + ' caracteres, ' + lines + ' linhas';
    }

    window.writerOnEditorChange = function () {
        wEditorDirty = true;
        updateStats();
    };

    window.writerInsertMd = function (prefix, suffix) {
        var area = document.getElementById('wrEditorArea');
        if (!area) return;
        var start = area.selectionStart;
        var end = area.selectionEnd;
        var text = area.value;
        var before = text.substring(0, start);
        var selected = text.substring(start, end);
        var after = text.substring(end);
        if (prefix.indexOf('texto') !== -1) {
            prefix = '[' + (selected || 'texto') + '](';
            suffix = ')';
            selected = '';
        }
        var replacement = prefix + selected + suffix;
        area.value = before + replacement + after;
        var newCursor = start + prefix.length + (selected.length || 0);
        area.setSelectionRange(newCursor, newCursor);
        area.focus();
        wEditorDirty = true;
        updateStats();
    };

    // ---------- Save ----------
    function askDocName(defaultName) {
        return new Promise(function (resolve) {
            if (typeof window.customPrompt === 'function') {
                window.customPrompt('Nome do documento:', defaultName || '').then(function (value) {
                    resolve(value);
                });
                return;
            }
            try {
                resolve(prompt('Nome do documento:', defaultName || ''));
            } catch (_) {
                resolve(defaultName || 'Sem título');
            }
        });
    }

    window.writerSaveActive = async function () {
        if (!wActiveDocId) return;
        var area = document.getElementById('wrEditorArea');
        if (!area) return;
        var name = await askDocName(wDocs[wActiveDocId] ? wDocs[wActiveDocId].name : 'Sem título');
        if (name === null) return;
        name = name.trim() || 'Sem título';
        wDocs[wActiveDocId] = {
            name: name,
            content: area.value,
            updated: new Date().toISOString()
        };
        saveDocs();
        wEditorDirty = false;
        document.getElementById('wrDocName').textContent = esc(name);
        renderDocumentList();

        // Persist the file to the backend (uploads/projects/<pid>/writer).
        syncActiveDocToBackend(name, area.value);
    };

    // ---------- Export ----------
    window.writerToggleExport = function () {
        var menu = document.getElementById('wrExportMenu');
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

    window.writerExport = function (format) {
        var area = document.getElementById('wrEditorArea');
        if (!area) return;
        var content = area.value;
        var docName = (wDocs[wActiveDocId] ? wDocs[wActiveDocId].name : 'documento') || 'documento';
        var filename, mime, blobContent;
        switch (format) {
            case 'md':
                filename = docName.replace(/[^\w\s-]/g, '') + '.md';
                mime = 'text/markdown';
                blobContent = content;
                break;
            case 'txt':
                filename = docName.replace(/[^\w\s-]/g, '') + '.txt';
                mime = 'text/plain';
                blobContent = content;
                break;
            case 'html':
                filename = docName.replace(/[^\w\s-]/g, '') + '.html';
                mime = 'text/html';
                var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + esc(docName) + '</title></head><body>' +
                    content.split('\n').map(function (line) {
                        return line ? '<p>' + esc(line).replace(/  $/, '<br>') + '</p>' : '<br>';
                    }).join('') + '</body></html>';
                blobContent = html;
                break;
            default: return;
        }
        var blob = new Blob([blobContent], { type: mime });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        document.getElementById('wrExportMenu').style.display = 'none';
    };

    // ---------- Export branded "Documento HAVAN" (DOCX/PDF/HTML) ----------
    window.writerExportHavan = function (formats) {
        var area = document.getElementById('wrEditorArea');
        if (!area) return;
        var content = area.value;
        if (!content.trim()) {
            alert('O editor está vazio. Escreva ou cole o Markdown antes de exportar.');
            return;
        }
        var docName = (wActiveDocId && wDocs[wActiveDocId] ? wDocs[wActiveDocId].name : 'documento') || 'documento';
        var pid = (typeof getCurrentProjectId === 'function') ? getCurrentProjectId() : null;
        if (!pid) {
            alert('Nenhum projeto ativo. Selecione um projeto para usar a exportação HAVAN.');
            return;
        }
        formats = (formats && formats.trim()) ? formats.trim() : 'docx,pdf,html';

        var btn = event && event.currentTarget;
        var oldLabel = null;
        if (btn) { oldLabel = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gerando…'; }

        fetch(API_BASE + '/api/projects/' + encodeURIComponent(pid) + '/convert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: docName, md: content, formats: formats, section: 'writer' })
        })
            .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
            .then(function (res) {
                if (!res.ok || res.body.status !== 'ok') {
                    throw new Error((res.body && res.body.message) || 'Falha na conversão');
                }
                (res.body.files || []).forEach(function (f) {
                    window.open(f.url, '_blank');
                });
                if (typeof refreshProjectIndex === 'function') refreshProjectIndex(pid);
            })
            .catch(function (err) {
                console.error('[writer-havan-export]', err);
                alert('Erro ao gerar Documento HAVAN: ' + err.message);
            })
            .finally(function () {
                if (btn) { btn.disabled = false; btn.innerHTML = oldLabel; }
                var menu = document.getElementById('wrExportMenu');
                if (menu) menu.style.display = 'none';
            });
    };

    // ---------- Document management ----------
    window.writerNewDocument = function () {
        if (wEditorDirty) {
            if (!confirm('Há alterações não salvas. Deseja continuar sem salvar?')) return;
        }
        var id = uuid();
        wDocs[id] = { name: 'Sem título', content: '', updated: new Date().toISOString() };
        saveDocs();
        wActiveDocId = id;
        saveActiveDocId();
        renderEditor();
        renderDocumentList();
        writerSwitchPanel('editor');
    };

    window.writerOpenDocument = function (id) {
        if (wActiveDocId === id) {
            writerSwitchPanel('editor');
            return;
        }
        if (wEditorDirty) {
            if (!confirm('Há alterações não salvas no documento atual. Deseja continuar sem salvar?')) return;
        }
        wActiveDocId = id;
        saveActiveDocId();
        renderEditor();
        writerSwitchPanel('editor');
    };

    window.writerDeleteDocument = function (id) {
        if (!confirm('Tem certeza que deseja excluir este documento?')) return;
        delete wDocs[id];
        saveDocs();
        if (wActiveDocId === id) {
            wActiveDocId = null;
            saveActiveDocId();
            renderEditor();
        }
        renderDocumentList();
    };

    window.writerRenameDocument = async function (id) {
        var doc = wDocs[id];
        if (!doc) return;
        var newName = await askDocName(doc.name);
        if (newName === null) return;
        newName = newName.trim() || 'Sem título';
        doc.name = newName;
        saveDocs();
        if (wActiveDocId === id) {
            document.getElementById('wrDocName').textContent = esc(newName);
        }
        renderDocumentList();
    };

    function renderDocumentList() {
        var list = document.getElementById('wrDocsList');
        if (!list) return;
        var ids = Object.keys(wDocs).sort(function (a, b) {
            return (wDocs[b].updated || '').localeCompare(wDocs[a].updated || '');
        });
        if (!ids.length) {
            list.innerHTML = '<div class="wr-empty"><i class="fas fa-file-alt"></i> Nenhum documento salvo</div>';
            return;
        }
        var html = '<div class="wr-doc-header"><span class="wr-doc-name">Nome</span><span class="wr-doc-modified">Modificado</span><span class="wr-doc-actions">Ações</span></div>';
        ids.forEach(function (id) {
            var doc = wDocs[id];
            var isActive = (id === wActiveDocId);
            html += '<div class="wr-doc-row' + (isActive ? ' wr-doc-active' : '') + '">' +
                '<span class="wr-doc-name"><a href="#" onclick="event.preventDefault();writerOpenDocument(\'' + esc(id) + '\')">' + esc(doc.name) + '</a></span>' +
                '<span class="wr-doc-modified">' + esc(formatDate(doc.updated)) + '</span>' +
                '<span class="wr-doc-actions">' +
                '<button class="btn btn-xs" onclick="writerRenameDocument(\'' + esc(id) + '\')" title="Renomear"><i class="fas fa-edit"></i></button>' +
                '<button class="btn btn-xs" onclick="writerDeleteDocument(\'' + esc(id) + '\')" title="Excluir"><i class="fas fa-trash-alt"></i></button>' +
                '</span>' +
                '</div>';
        });
        list.innerHTML = html;
    }

    // ---------- NEW: File import ----------
    window.writerImportFile = function (event) {
        var file = event.target.files[0];
        if (!file) return;

        var area = document.getElementById('wrEditorArea');
        if (!area) return;

        // Helper to insert text after confirmation (replaces current content)
        function insertText(text) {
            if (area.value.trim() !== '' && !confirm('O documento atual será substituído pelo conteúdo importado. Continuar?')) {
                return;
            }
            area.value = text;
            wEditorDirty = true;
            updateStats();
        }

        var ext = file.name.split('.').pop().toLowerCase();
        if (ext === 'txt' || ext === 'md' || ext === 'html') {
            var reader = new FileReader();
            reader.onload = function (e) {
                insertText(e.target.result);
            };
            reader.readAsText(file);
        } else if (ext === 'docx') {
            // Try to use mammoth.js if loaded; otherwise fallback to text with warning
            if (typeof mammoth !== 'undefined' && mammoth.extractRawText) {
                var reader = new FileReader();
                reader.onload = function (e) {
                    mammoth.extractRawText({ arrayBuffer: e.target.result })
                        .then(function (result) {
                            insertText(result.value);
                        })
                        .catch(function (err) {
                            alert('Erro ao processar .docx: ' + err.message);
                        });
                };
                reader.readAsArrayBuffer(file);
            } else {
                alert('Para importar .docx, inclua a biblioteca mammoth.js no projeto.\nPor enquanto o arquivo será lido como texto bruto (pode conter lixo).');
                var fallbackReader = new FileReader();
                fallbackReader.onload = function (e) {
                    insertText(e.target.result);
                };
                fallbackReader.readAsText(file);
            }
        } else if (ext === 'pdf') {
            // Try pdf.js if available
            if (typeof pdfjsLib !== 'undefined') {
                var reader = new FileReader();
                reader.onload = function (e) {
                    var typedarray = new Uint8Array(e.target.result);
                    pdfjsLib.getDocument(typedarray).promise.then(function (pdf) {
                        var maxPages = pdf.numPages;
                        var pageTextPromises = [];
                        for (var i = 1; i <= maxPages; i++) {
                            pageTextPromises.push(
                                pdf.getPage(i).then(function (page) {
                                    return page.getTextContent().then(function (textContent) {
                                        return textContent.items.map(function (item) { return item.str; }).join(' ');
                                    });
                                })
                            );
                        }
                        Promise.all(pageTextPromises).then(function (pagesText) {
                            insertText(pagesText.join('\n\n'));
                        });
                    }).catch(function (err) {
                        alert('Erro ao processar PDF: ' + err.message);
                    });
                };
                reader.readAsArrayBuffer(file);
            } else {
                alert('Para importar PDF, inclua a biblioteca pdf.js no projeto.\nPor enquanto o arquivo será lido como texto bruto (pode conter lixo).');
                var fallbackReader = new FileReader();
                fallbackReader.onload = function (e) {
                    insertText(e.target.result);
                };
                fallbackReader.readAsText(file);
            }
        } else {
            alert('Formato não suportado. Use .txt, .md, .html, .docx ou .pdf.');
        }

        // Reset file input so the same file can be imported again
        event.target.value = '';

        // Persist the (imported) active document to the backend so created or
        // imported files are stored server-side, not just in localStorage.
        // Defer slightly so async reads (pdf/docx) finish and update the editor.
        setTimeout(function () {
            var area = document.getElementById('wrEditorArea');
            if (!area) return;
            var baseName = (file && file.name ? file.name : (wDocs[wActiveDocId] ? wDocs[wActiveDocId].name : 'documento'));
            syncActiveDocToBackend(baseName, area.value);
        }, 600);
    };

    // ---------- NEW: Chat panel integration ----------
    window.writerToggleChat = function () {
        var panel = document.getElementById('wrChatPanel');
        if (!panel) return;
        var isVisible = panel.style.display === 'block';
        panel.style.display = isVisible ? 'none' : 'block';
        if (!isVisible) {
            document.getElementById('wrChatInput').focus();
        }
    };

    window.writerShowMdPanel = function () {
        var panel = document.getElementById('wrMdViewPanel');
        var viewArea = document.getElementById('wrMdViewArea');
        var editor = document.getElementById('wrEditorArea');
        if (!panel || !viewArea || !editor) return;
        viewArea.value = editor.value;
        panel.style.display = 'flex';
        viewArea.focus();
    };

    window.writerHideMdPanel = function () {
        var panel = document.getElementById('wrMdViewPanel');
        if (panel) panel.style.display = 'none';
    };

    window.writerCopyMd = function () {
        var viewArea = document.getElementById('wrMdViewArea');
        var text = viewArea ? viewArea.value : '';
        if (!text) {
            alert('Não há Markdown para copiar.');
            return;
        }
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            navigator.clipboard.writeText(text).then(function () {
                alert('Markdown copiado para a área de transferência.');
            }).catch(function () {
                alert('Não foi possível copiar para a área de transferência.');
            });
        } else {
            try {
                var textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                alert('Markdown copiado para a área de transferência.');
            } catch (_) {
                alert('Copiar não é suportado neste navegador.');
            }
        }
    };

    window.writerPasteMd = async function () {
        var area = document.getElementById('wrEditorArea');
        if (!area) return;
        if (navigator.clipboard && typeof navigator.clipboard.readText === 'function') {
            try {
                var clipboardText = await navigator.clipboard.readText();
                if (!clipboardText) {
                    alert('A área de transferência está vazia.');
                    return;
                }
                var start = area.selectionStart;
                var end = area.selectionEnd;
                area.value = area.value.substring(0, start) + clipboardText + area.value.substring(end);
                area.setSelectionRange(start + clipboardText.length, start + clipboardText.length);
                area.focus();
                wEditorDirty = true;
                updateStats();
            } catch (err) {
                alert('Falha ao ler o clipboard: ' + (err && err.message ? err.message : 'erro desconhecido.'));
            }
        } else {
            alert('Leitura de clipboard não suportada. Use Ctrl/Cmd+V no editor.');
        }
    };

    window.writerSendChat = function () {
        var input = document.getElementById('wrChatInput');
        var messages = document.getElementById('wrChatMessages');
        if (!input || !messages) return;
        var text = input.value.trim();
        if (!text) return;

        // Add user message to local chat log
        var userMsg = document.createElement('div');
        userMsg.className = 'wr-chat-msg wr-chat-msg-user';
        userMsg.textContent = text;
        messages.appendChild(userMsg);
        input.value = '';
        messages.scrollTop = messages.scrollHeight;

        // Call main agent system if available (adjust function name as needed)
        if (typeof window.sendMessageToAgent === 'function') {
            window.sendMessageToAgent(text, function (reply) {
                var agentMsg = document.createElement('div');
                agentMsg.className = 'wr-chat-msg wr-chat-msg-agent';
                agentMsg.textContent = reply;
                messages.appendChild(agentMsg);
                messages.scrollTop = messages.scrollHeight;
            });
        } else {
            // Fallback: echo after a short delay (demo mode)
            setTimeout(function () {
                var agentMsg = document.createElement('div');
                agentMsg.className = 'wr-chat-msg wr-chat-msg-agent';
                agentMsg.textContent = 'Resposta automática (agente não conectado): ' + text;
                messages.appendChild(agentMsg);
                messages.scrollTop = messages.scrollHeight;
            }, 500);
        }
    };

    // ---------- Lifecycle: show / hide the view ----------
    var SIBLING_HIDE = ['violationsHideView', 'lawLibHideView', 'masterIndexHideView',
        'legalRouterHideView', 'spacesHideView', 'listeningHideView', 'studioHideView',
        'descobertaHideView', 'memoryHideView', 'shadersHideView', 'architectureHideView',
        'craudioHideView', 'driveHideView'];
    var CHAT_IDS = ['chatHeader', 'welcomeState', 'chatLog', 'chatCompose', 'chatToolbar'];

    window.writerShowView = function () {
        build();
        CHAT_IDS.forEach(function (id) {
            var el = document.getElementById(id); if (el) el.style.display = 'none';
        });
        var mc = document.querySelector('.main-content');
        if (mc) { mc._wrDisplay = mc.style.display; mc.style.display = 'none'; }
        SIBLING_HIDE.forEach(function (fn) {
            try { if (typeof window[fn] === 'function') window[fn](); } catch (_) { }
        });
        var v = document.getElementById('writerView');
        if (v) v.classList.add('active');
        var ws = document.querySelector('.workspace');
        if (ws) ws.classList.add('wr-open');
    };

    window.writerHideView = function () {
        var v = document.getElementById('writerView');
        if (v) v.classList.remove('active');
        var ws = document.querySelector('.workspace');
        if (ws) ws.classList.remove('wr-open');
        var mc = document.querySelector('.main-content');
        if (mc) { mc.style.display = mc._wrDisplay !== undefined ? mc._wrDisplay : ''; delete mc._wrDisplay; }
        CHAT_IDS.forEach(function (id) {
            var el = document.getElementById(id); if (el) el.style.display = '';
        });
    };

    // Automatically close Writer when any other plugin opens
    function wrapSiblings() {
        var names = ['violationsShowView', 'lawLibShowView', 'masterIndexShowView',
            'legalRouterShowView', 'spacesShowView', 'listeningShowView', 'studioShowView',
            'descobertaShowView', 'memoryShowView', 'shadersShowView', 'architectureShowView',
            'craudioShowView', 'resetToWelcome', 'aexToggleMain',
            'driveShowView'];
        names.forEach(function (n) {
            var orig = window[n];
            if (typeof orig !== 'function' || orig._wrWrapped) return;
            var wrapped = function () {
                try { window.writerHideView(); } catch (_) { }
                return orig.apply(this, arguments);
            };
            wrapped._wrWrapped = true;
            window[n] = wrapped;
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', wrapSiblings);
    } else {
        wrapSiblings();
    }
})();