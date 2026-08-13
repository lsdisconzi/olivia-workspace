/* ============================================================================
   Procurement — Supplier invoice OCR pipeline inside Olivia Workspace.
   ============================================================================ */
(function () {
    'use strict';

    var PROCUREMENT_API = {
        upload: '/api/procurement/upload',
        run: '/api/procurement/run',
        status: '/api/procurement/status',
        results: '/api/procurement/results',
        knowledgeBase: '/api/procurement/knowledge-base',
        timeline: '/api/procurement/timeline',
        assistant: '/api/procurement/assistant/chat',
    };

    var PROCUREMENT_PRIMER = [
        'Você é o Olivia Procurement Assistant — um agente que ajuda a gerenciar notas fiscais e faturas de fornecedores.',
        'Você tem acesso ao pipeline de OCR, extração, timeline e knowledge base de compras.',
        'Responda em português do Brasil, de forma objetiva e técnica.',
        '— Mensagem do usuário —',
    ].join('\n');

    // Cube SVG with procurement orange accent
    var CUBE_SVG_PROCUREMENT = '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><polygon points="20,30 50,15 80,30 80,70 50,85 20,70" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/><line x1="50" y1="15" x2="50" y2="85" stroke="currentColor" stroke-width="5"/><line x1="20" y1="70" x2="80" y2="30" stroke="currentColor" stroke-width="5"/></svg>';

    // ── Internal state ───────────────────────────────────────────────────────
    var pBuilt = false;
    var pActivePanel = 'overview';
    var pHistory = [];
    var pSessionId = null;
    var pPrimerSent = false;
    var pStreaming = false;
    var PROCUREMENT_STORAGE_KEY = 'Olivia_procurement_chat_v1';

    // ── Helpers ───────────────────────────────────────────────────────────────
    function procurementProjectId() {
        return (typeof window.OliviaProjectId === 'string' && window.OliviaProjectId) ? window.OliviaProjectId : '';
    }

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
        var view = document.getElementById('procurementView');
        if (!view || pBuilt) return;

        view.innerHTML =
            '<div class="pr-head">' +
            '<div class="pr-head-brand">' +
            '<span class="pr-logo">' + CUBE_SVG_PROCUREMENT + '</span>' +
            '<span class="pr-title">Procurement</span>' +
            '<span class="pr-sub">Olivia Procurement</span>' +
            '</div>' +
            '<div class="pr-head-actions">' +
            '<button class="btn btn-sm" onclick="procurementHideView()" title="Fechar">' +
            '<i class="fas fa-times"></i></button>' +
            '</div>' +
            '</div>' +
            '<div class="pr-subnav">' +
            '<button class="pr-tab active" data-panel="overview" onclick="procurementSwitchPanel(\'overview\')">Overview</button>' +
            '<button class="pr-tab" data-panel="pipeline" onclick="procurementSwitchPanel(\'pipeline\')">Pipeline</button>' +
            '<button class="pr-tab" data-panel="documents" onclick="procurementSwitchPanel(\'documents\')">Invoices</button>' +
            '<button class="pr-tab" data-panel="reports" onclick="procurementSwitchPanel(\'reports\')">Reports</button>' +
            '<button class="pr-tab" data-panel="timeline" onclick="procurementSwitchPanel(\'timeline\')">Timeline</button>' +
            '<button class="pr-tab" data-panel="chat" onclick="procurementSwitchPanel(\'chat\')">Assistant</button>' +
            '</div>' +
            '<div class="pr-panels">' +
            '<div id="prPanel-overview" class="pr-panel active">' + overviewHtml() + '</div>' +
            '<div id="prPanel-pipeline" class="pr-panel">' + pipelineHtml() + '</div>' +
            '<div id="prPanel-documents" class="pr-panel">' + documentsHtml() + '</div>' +
            '<div id="prPanel-reports" class="pr-panel">' + reportsHtml() + '</div>' +
            '<div id="prPanel-timeline" class="pr-panel">' + timelineHtml() + '</div>' +
            '<div id="prPanel-chat" class="pr-panel">' + chatHtml() + '</div>' +
            '</div>';

        pBuilt = true;
        loadChatHistory();
        renderChatLog();
    }

    // ── Overview panel ───────────────────────────────────────────────────────
    function overviewHtml() {
        return '<div class="pr-hero">' +
            '<span class="pr-hero-logo">' + CUBE_SVG_PROCUREMENT + '</span>' +
            '<h1 class="pr-hero-title">Olivia Procurement</h1>' +
            '<p class="pr-hero-tag">Your invoice processing hub. Upload supplier invoices, extract data, and track your procurement history.</p>' +
            '</div>' +
            '<div class="pr-stats" id="procurementStats">' +
            '<div class="pr-stat"><div class="pr-stat-num">–</div><div class="pr-stat-label">Invoices</div></div>' +
            '<div class="pr-stat"><div class="pr-stat-num">–</div><div class="pr-stat-label">Suppliers</div></div>' +
            '<div class="pr-stat"><div class="pr-stat-num">–</div><div class="pr-stat-label">Total Value</div></div>' +
            '</div>' +
            '<div class="pr-cta">' +
            '<button class="btn btn-primary" onclick="procurementSwitchPanel(\'pipeline\')">' +
            '<i class="fas fa-upload"></i> Upload & Process</button>' +
            '<button class="btn" onclick="procurementSwitchPanel(\'timeline\')">' +
            '<i class="fas fa-timeline"></i> View Timeline</button>' +
            '</div>' +
            '<div class="pr-guard"><i class="fas fa-shield-haltered"></i> ' +
            'This system helps you organise procurement records. It does not replace your accounting software.</div>';
    }

    // ── Pipeline panel (upload, run, view results) ───────────────────────────
    function pipelineHtml() {
        return '<div class="pr-pipeline">' +
            '<div class="pr-upload-area" id="procurementUploadArea">' +
            '<i class="fas fa-cloud-upload-alt"></i>' +
            '<p>Drop invoice images or click to upload</p>' +
            '<input type="file" id="procurementFileInput" accept="image/*,.pdf" multiple style="display:none" onchange="procurementHandleFiles(this.files)">' +
            '</div>' +
            '<div class="pr-pipeline-controls">' +
            '<button class="btn btn-primary" id="procurementRunBtn" onclick="procurementRunPipeline()" disabled>' +
            '<i class="fas fa-play"></i> Run Pipeline</button>' +
            '<span class="pr-status" id="procurementPipelineStatus">Ready</span>' +
            '</div>' +
            '<div class="pr-results" id="procurementResults">' +
            '<div class="pr-empty">Upload invoice images and run the pipeline to extract data.</div>' +
            '</div>' +
            '</div>';
    }

    // ── Timeline panel ───────────────────────────────────────────────────────
    function timelineHtml() {
        return '<div class="pr-timeline" id="procurementTimeline">' +
            '<div class="pr-empty"><i class="fas fa-clock"></i> Your procurement timeline will appear here after processing invoices.</div>' +
            '</div>';
    }

    // ── Documents panel (renamed to Invoices) ────────────────────────────────
    function documentsHtml() {
        return '<div class="pr-documents-panel">' +
            '<div class="pr-documents-grid" id="procurementDocuments">' +
            '<div class="pr-empty"><i class="fas fa-file-invoice"></i> Loading invoices…</div>' +
            '</div>' +
            '</div>';
    }

    // ── Reports panel ────────────────────────────────────────────────────────
    function reportsHtml() {
        return '<div class="pr-reports-panel">' +
            '<div class="pr-reports-toolbar">' +
            '<button class="btn btn-sm" id="procurementVizBtn" onclick="procurementLoadVisualizations()" title="Visualization data">' +
            '<i class="fas fa-chart-pie"></i> Visualizations</button>' +
            '<button class="btn btn-sm btn-primary" id="procurementReportBtn" onclick="procurementLoadReports()" title="Full report">' +
            '<i class="fas fa-file-alt"></i> Full Report</button>' +
            '</div>' +
            '<div class="pr-report-area" id="procurementReportArea">' +
            '<div class="pr-empty"><i class="fas fa-file-alt"></i> Select a report to view.</div>' +
            '</div>' +
            '</div>';
    }

    // ── Chat panel ───────────────────────────────────────────────────────────
    function chatHtml() {
        return '<div class="pr-chat">' +
            '<div class="pr-chat-bar">' +
            '<span class="pr-chat-bar-label"><i class="fas fa-robot"></i> Procurement Assistant</span>' +
            '<button class="btn btn-sm" onclick="procurementNewChat()" title="Nova conversa">' +
            '<i class="fas fa-plus"></i> New Chat</button>' +
            '</div>' +
            '<div id="prChatLog" class="pr-chat-log"></div>' +
            '<div class="pr-chat-compose">' +
            '<textarea id="prChatInput" class="pr-chat-input" rows="1" ' +
            'placeholder="Ask about your invoices…" ' +
            'onkeydown="if(event.key===\'Enter\'&&!event.shiftKey){event.preventDefault();procurementSend();}"></textarea>' +
            '<button class="pr-chat-send" id="prChatSend" onclick="procurementSend()" title="Send">' +
            '<i class="fas fa-arrow-up"></i></button>' +
            '</div>' +
            '</div>';
    }

    // ── Tab switching ────────────────────────────────────────────────────────
    window.procurementSwitchPanel = function (name) {
        pActivePanel = name;
        ['overview', 'pipeline', 'documents', 'reports', 'timeline', 'chat'].forEach(function (p) {
            var panel = document.getElementById('prPanel-' + p);
            if (panel) panel.classList.toggle('active', p === name);
        });
        var tabs = document.querySelectorAll('#procurementView .pr-tab');
        tabs.forEach(function (t) {
            t.classList.toggle('active', t.getAttribute('data-panel') === name);
        });
        if (name === 'pipeline') procurementRefreshPipeline();
        else if (name === 'documents') procurementLoadDocuments();
        else if (name === 'reports') procurementLoadReports();
        else if (name === 'timeline') procurementLoadTimeline();
        else if (name === 'overview') procurementLoadStats();
        else if (name === 'chat') {
            var input = document.getElementById('prChatInput');
            if (input) setTimeout(function () { input.focus(); }, 30);
        }
    };

    // ── Pipeline handling ────────────────────────────────────────────────────
    window.procurementHandleFiles = function (files) {
        var area = document.getElementById('procurementUploadArea');
        if (!area) return;
        var names = Array.from(files).map(function (f) { return f.name; }).join(', ');
        area.innerHTML = '<p>' + esc(names) + ' (' + files.length + ' files)</p>';
        area.dataset.hasFiles = 'true';
        document.getElementById('procurementRunBtn').disabled = false;
        window._procurementFiles = files;
    };

    function setupUploadDrag() {
        var area = document.getElementById('procurementUploadArea');
        if (!area) return;
        area.addEventListener('dragover', function (e) {
            e.preventDefault();
            area.classList.add('pr-dragover');
        });
        area.addEventListener('dragleave', function () {
            area.classList.remove('pr-dragover');
        });
        area.addEventListener('drop', function (e) {
            e.preventDefault();
            area.classList.remove('pr-dragover');
            procurementHandleFiles(e.dataTransfer.files);
        });
        area.addEventListener('click', function () {
            document.getElementById('procurementFileInput').click();
        });
    }

    window.procurementRunPipeline = function () {
        var files = window._procurementFiles;
        if (!files || files.length === 0) return;
        var statusEl = document.getElementById('procurementPipelineStatus');
        var runBtn = document.getElementById('procurementRunBtn');
        if (statusEl) statusEl.textContent = 'Uploading & running...';
        if (runBtn) runBtn.disabled = true;

        var formData = new FormData();
        formData.append('project_id', procurementProjectId());
        for (var i = 0; i < files.length; i++) {
            formData.append('files', files[i]);
        }

        fetch(apiBase() + PROCUREMENT_API.upload, { method: 'POST', body: formData })
            .then(function (res) {
                if (!res.ok) throw new Error('Upload failed');
                return res.json();
            })
            .then(function (uploadData) {
                if (statusEl) statusEl.textContent = 'Running pipeline...';
                return fetch(apiBase() + PROCUREMENT_API.run, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ upload_id: uploadData.upload_id, project_id: procurementProjectId() })
                });
            })
            .then(function (res) {
                if (!res.ok) throw new Error('Pipeline failed');
                return res.json();
            })
            .then(function (pipelineResult) {
                if (statusEl) statusEl.textContent = 'Completed';
                procurementLoadResults(pipelineResult);
            })
            .catch(function (err) {
                if (statusEl) statusEl.textContent = 'Error: ' + esc(err.message);
                if (runBtn) runBtn.disabled = false;
            });
    };

    function procurementLoadResults(data) {
        var container = document.getElementById('procurementResults');
        if (!container) return;
        if (!data || data.status !== 'completed') {
            container.innerHTML = '<div class="pr-empty">Pipeline did not complete successfully.</div>';
            return;
        }
        var summary = data.summary || {};
        var fs = summary.file_statistics || data.file_statistics || {};
        var html = '<div class="pr-result-summary">';
        html += '<h3>Pipeline Summary</h3>';
        html += '<p>Processed: ' + (fs.total_images != null ? fs.total_images : '?') + ' invoice images</p>';
        html += '<p>Successful OCR: ' + (fs.successful_ocr != null ? fs.successful_ocr : '?') + '</p>';
        if (data.workspace) {
            html += '<p class="pr-result-workspace"><i class="fas fa-folder-open"></i> Procurement workspace: <code>' + esc(data.workspace) + '</code></p>';
        }
        html += '</div>';
        container.innerHTML = html;
        document.getElementById('procurementRunBtn').disabled = false;
    }

    window.procurementRefreshPipeline = function () {
        var area = document.getElementById('procurementUploadArea');
        if (area && !area.dataset.hasFiles) {
            area.innerHTML = '<i class="fas fa-cloud-upload-alt"></i><p>Drop invoice images or click to upload</p>';
        }
    };

    // ── Timeline ─────────────────────────────────────────────────────────────
    window.procurementLoadTimeline = function () {
        var container = document.getElementById('procurementTimeline');
        if (!container) return;
        container.innerHTML = '<div class="pr-empty"><i class="fas fa-spinner fa-pulse"></i> Loading timeline…</div>';
        var q = procurementProjectId() ? ('?project_id=' + encodeURIComponent(procurementProjectId())) : '';
        var base = apiBase();

        Promise.all([
            fetch(base + PROCUREMENT_API.timeline + q).then(function (r) { if (!r.ok) throw new Error('Timeline fetch failed'); return r.json(); }),
            fetch(base + '/api/procurement/documents-detail' + q).then(function (r) { if (!r.ok) throw new Error('Documents fetch failed'); return r.json(); })
        ]).then(function (results) {
            var timelineData = results[0];
            var docsData = results[1];
            var docMap = {};
            if (docsData.documents) {
                docsData.documents.forEach(function (d) {
                    docMap[d.filename] = d;
                });
            }

            var events = timelineData.events || [];
            if (!events.length) {
                container.innerHTML = '<div class="pr-empty"><i class="fas fa-clock"></i> No events yet. Upload invoices to build your timeline.</div>';
                return;
            }

            renderTimelineEvents(container, events, docMap);

            fetch(base + '/api/procurement/outputs' + q)
                .then(function (r) { return r.ok ? r.json() : {}; })
                .catch(function () { return {}; })
                .then(function (vizData) {
                    var vizEvents = (vizData.timeline || []).map(function (ev) {
                        return {
                            date: ev.date,
                            description: ev.event,
                            category: ev.category || '',
                            system: ev.system || '',
                            detail: ev.detail || '',
                            status: ev.status || '',
                            source: 'viz'
                        };
                    });

                    var allEvents = events.concat(vizEvents);
                    allEvents.sort(function (a, b) {
                        if (a.date < b.date) return -1;
                        if (a.date > b.date) return 1;
                        return 0;
                    });

                    renderTimelineEvents(container, allEvents, docMap);
                });
        }).catch(function (err) {
            container.innerHTML = '<div class="pr-empty dr-error">' + esc(err.message) + '</div>';
        });
    };

    function renderTimelineEvents(container, events, docMap) {
        var html = '<div class="pr-timeline-list">';
        var statusColors = {
            'paid': '#2ecc71',
            'overdue': '#e74c3c',
            'pending': '#f39c12',
            'disputed': '#e67e22',
            'cancelled': '#95a5a6'
        };

        events.forEach(function (ev) {
            var color = statusColors[ev.status] || '#95a5a6';
            html += '<div class="pr-tl-card" style="border-left: 3px solid ' + color + '">';
            html += '<div class="pr-tl-card-header">';
            html += '<span class="pr-tl-date">' + esc(ev.date) + '</span>';
            if (ev.category) {
                html += '<span class="pr-tl-category" style="background:' + color + '20;color:' + color + '">' + esc(ev.category) + '</span>';
            }
            if (ev.system) {
                html += '<span class="pr-tl-system">' + esc(ev.system) + '</span>';
            }
            html += '</div>';
            html += '<div class="pr-tl-card-body">';
            html += '<div class="pr-tl-event-title">' + esc(ev.description) + '</div>';
            if (ev.detail) {
                html += '<div class="pr-tl-detail">' + esc(ev.detail) + '</div>';
            }

            var evText = (ev.description || '') + ' ' + (ev.detail || '');
            var matched = [];
            Object.keys(docMap).forEach(function (fname) {
                if (matched.length >= 2) return;
                if (evText.indexOf(fname) >= 0) {
                    var d = docMap[fname];
                    if (d && d.image_url) matched.push(d);
                }
            });
            (ev.docs || []).forEach(function (fname) {
                if (matched.length >= 2) return;
                var d = docMap[fname];
                if (d && d.image_url) matched.push(d);
            });
            if (matched.length) {
                html += '<div class="pr-tl-docs">';
                matched.forEach(function (d) {
                    html += '<img src="' + esc(d.image_url) + '" alt="' + esc(d.filename) + '" loading="lazy" class="pr-tl-doc-thumb" title="' + esc(d.filename) + '" data-url="' + esc(d.image_url) + '" data-title="' + esc(d.filename) + '" data-kind="' + esc(d.kind || 'image') + '" onclick="procurementZoom(this)">';
                });
                html += '</div>';
            }
            html += '</div>';
            html += '</div>';
        });
        html += '</div>';
        container.innerHTML = html;
    }

    // ── Documents panel (invoices) ────────────────────────────────────────────
    window.procurementLoadDocuments = function () {
        var container = document.getElementById('procurementDocuments');
        if (!container) return;
        container.innerHTML = '<div class="pr-empty"><i class="fas fa-spinner fa-pulse"></i> Loading invoices…</div>';
        var q = procurementProjectId() ? ('?project_id=' + encodeURIComponent(procurementProjectId())) : '';
        fetch(apiBase() + '/api/procurement/documents-detail' + q)
            .then(function (res) {
                if (!res.ok) throw new Error('Failed to load invoices');
                return res.json();
            })
            .then(function (data) {
                var docs = data.documents || [];
                if (!docs.length) {
                    container.innerHTML = '<div class="pr-empty"><i class="fas fa-file-invoice"></i> No invoices yet. Upload images in the Pipeline tab.</div>';
                    return;
                }
                var html = '';
                window.procurementCurrentDocs = {};
                docs.forEach(function (doc) {
                    var docId = doc.id || doc.filename;
                    window.procurementCurrentDocs[docId] = doc;
                    var statusClass = doc.ocr_success ? 'pr-doc-ok' : 'pr-doc-pending';
                    var statusIcon = doc.ocr_success ? 'fa-check-circle' : 'fa-clock';
                    var statusText = doc.ocr_success ? 'OCR complete' : 'Pending';
                    var textPreview = doc.text ? doc.text.substring(0, 300) : '';
                    var hasMore = doc.text && doc.text.length > 300;

                    html += '<div class="pr-doc-card ' + statusClass + '">';
                    html += '<div class="pr-doc-card-header">';
                    if (doc.image_url) {
                        html += '<div class="pr-doc-thumb-wrap">';
                        html += '<div class="pr-doc-thumb' + (doc.kind === 'pdf' ? ' pr-doc-thumb-pdf' : '') + '" onclick="procurementZoom(this.nextElementSibling)" title="Click to view details">';
                        if (doc.kind === 'pdf') {
                            html += '<iframe src="' + esc(doc.image_url) + '" loading="lazy" class="pr-doc-pdf-frame" title="' + esc(doc.filename) + '"></iframe>';
                        } else {
                            html += '<img src="' + esc(doc.image_url) + '" alt="' + esc(doc.filename) + '" loading="lazy">';
                        }
                        html += '</div>';
                        html += '<button class="pr-doc-zoom" data-docid="' + esc(docId) + '" data-url="' + esc(doc.image_url) + '" data-title="' + esc(doc.filename) + '" data-kind="' + esc(doc.kind) + '" onclick="procurementZoom(this)" title="View Details"><i class="fas fa-expand"></i></button>';
                        html += '</div>';
                    }
                    html += '<div class="pr-doc-meta">';
                    html += '<div class="pr-doc-filename" title="' + esc(doc.filename) + '">' + esc(doc.filename) + '</div>';
                    html += '<div class="pr-doc-status"><i class="fas ' + statusIcon + '"></i> ' + statusText + '</div>';
                    if (doc.uploaded_at) {
                        html += '<div class="pr-doc-date">' + esc(doc.uploaded_at) + '</div>';
                    }
                    html += '</div>';
                    html += '</div>';
                    html += '</div>';
                });
                container.innerHTML = html;
            })
            .catch(function (err) {
                container.innerHTML = '<div class="pr-empty dr-error">' + esc(err.message) + '</div>';
            });
    };

    window.procurementToggleDocText = function (el) {
        var card = el.closest ? el.closest('.pr-doc-card') : null;
        if (!card) return;
        var text = card.querySelector('.pr-doc-text');
        if (!text) return;
        if (text.style.display === 'none') {
            text.style.display = 'block';
        } else {
            text.style.display = 'none';
        }
    };

    // ── Image modal / lightbox ────────────────────────────────────────────────
    function procurementEnsureModal() {
        var modal = document.getElementById('procurementImageModal');
        if (modal) return modal;
        modal = document.createElement('div');
        modal.id = 'procurementImageModal';
        modal.className = 'pr-modal-overlay';
        modal.innerHTML =
            '<div class="pr-modal" role="dialog" aria-modal="true" aria-label="Document view">' +
            '<div class="pr-modal-head">' +
            '<span class="pr-modal-title"></span>' +
            '<div class="pr-modal-head-actions">' +
            '<a class="pr-modal-openlink" id="procurementModalOpenLink" target="_blank" rel="noopener" title="Open in new tab"><i class="fas fa-external-link-alt"></i></a>' +
            '<button class="pr-modal-close" title="Close (Esc)"><i class="fas fa-times"></i></button>' +
            '</div>' +
            '</div>' +
            '<div class="pr-modal-body"></div>' +
            '</div>';
        document.body.appendChild(modal);
        var overlay = modal;
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) window.procurementCloseImage();
        });
        var closeBtn = modal.querySelector('.pr-modal-close');
        if (closeBtn) closeBtn.addEventListener('click', function () { window.procurementCloseImage(); });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') window.procurementCloseImage();
        });
        return modal;
    }

    window.procurementZoom = function (el) {
        if (!el) return;
        var docId = el.getAttribute('data-docid');
        if (docId && window.procurementCurrentDocs && window.procurementCurrentDocs[docId]) {
            window.procurementViewDocument(window.procurementCurrentDocs[docId]);
        } else {
            window.procurementViewImage(
                el.getAttribute('data-url'),
                el.getAttribute('data-title') || 'Document',
                el.getAttribute('data-kind') || 'image'
            );
        }
    };

    window.procurementViewImage = function (url, title, kind) {
        if (!url) return;
        var modal = procurementEnsureModal();
        var body = modal.querySelector('.pr-modal-body');
        if (kind === 'pdf') {
            body.innerHTML = '<iframe src="' + esc(url) + '" class="pr-modal-frame" title="' + esc(title) + '"></iframe>';
        } else {
            body.innerHTML = '<img src="' + esc(url) + '" alt="' + esc(title) + '" class="pr-modal-img">';
        }
        var t = modal.querySelector('.pr-modal-title');
        if (t) t.textContent = title || 'Document';
        var link = modal.querySelector('#procurementModalOpenLink');
        if (link) link.setAttribute('href', url);
        modal.classList.add('show');
        document.body.classList.add('pr-modal-lock');
    };

    window.procurementViewDocument = function(doc) {
        var modal = procurementEnsureModal();
        var body = modal.querySelector('.pr-modal-body');
        
        var html = '<div class="pr-doc-viewer">';
        html += '<div class="pr-doc-viewer-tabs">';
        html += '<button class="pr-doc-tab active" onclick="procurementSwitchTab(this, \'image\')"><i class="fas fa-image"></i> Image</button>';
        if (doc.text) html += '<button class="pr-doc-tab" onclick="procurementSwitchTab(this, \'raw\')"><i class="fas fa-align-left"></i> Raw Text</button>';
        if (doc.text_md) html += '<button class="pr-doc-tab" onclick="procurementSwitchTab(this, \'md\')"><i class="fab fa-markdown"></i> Markdown</button>';
        if (doc.text_md && (doc.image_url || doc.kind === 'pdf')) html += '<button class="pr-doc-tab" onclick="procurementSwitchTab(this, \'split\')"><i class="fas fa-columns"></i> Side-by-Side</button>';
        html += '</div>';
        
        html += '<div class="pr-doc-viewer-content">';
        
        html += '<div class="pr-doc-pane active" data-pane="image">';
        if (doc.kind === 'pdf') {
            html += '<iframe src="' + esc(doc.image_url) + '" class="pr-modal-frame" title="' + esc(doc.filename) + '"></iframe>';
        } else if (doc.image_url) {
            html += '<img src="' + esc(doc.image_url) + '" alt="' + esc(doc.filename) + '" class="pr-modal-img">';
        }
        html += '</div>';
        
        if (doc.text) {
            html += '<div class="pr-doc-pane" data-pane="raw"><pre class="pr-doc-raw">' + esc(doc.text) + '</pre></div>';
        }
        
        if (doc.text_md) {
            html += '<div class="pr-doc-pane" data-pane="md"><div class="pr-md pr-doc-md">' + renderMd(doc.text_md) + '</div></div>';
        }
        
        if (doc.text_md && (doc.image_url || doc.kind === 'pdf')) {
            html += '<div class="pr-doc-pane pr-doc-pane-split" data-pane="split">';
            html += '<div class="pr-split-left">';
            if (doc.kind === 'pdf') {
                html += '<iframe src="' + esc(doc.image_url) + '" class="pr-modal-frame" title="' + esc(doc.filename) + '"></iframe>';
            } else {
                html += '<img src="' + esc(doc.image_url) + '" alt="' + esc(doc.filename) + '" class="pr-modal-img" onload="procurementSyncSplitPane(this)">';
            }
            html += '</div>';
            html += '<div class="pr-split-right"><div class="pr-split-page"><div class="pr-md pr-doc-md">' + renderMd(doc.text_md) + '</div></div></div>';
            html += '</div>';
        }
        
        html += '</div></div>';
        
        body.innerHTML = html;
        var t = modal.querySelector('.pr-modal-title');
        if (t) t.textContent = doc.filename || 'Document View';
        var link = modal.querySelector('#procurementModalOpenLink');
        if (link) link.setAttribute('href', doc.image_url || '#');
        modal.classList.add('show', 'pr-modal-large');
        document.body.classList.add('pr-modal-lock');
    };
    
    // Keep the rendered markdown "page" sized to match the source image, so the
    // two panes read as comparable documents rather than mismatched columns.
    window.procurementSyncSplitPane = function (img) {
        try {
            var pane = img.closest('.pr-doc-pane-split');
            if (!pane || !img.naturalWidth || !img.naturalHeight) return;
            pane.style.setProperty('--pr-split-ratio', (img.naturalWidth / img.naturalHeight).toFixed(4));
        } catch (_e) { /* noop */ }
    };

    window.procurementSwitchTab = function(btn, paneName) {
        var viewer = btn.closest('.pr-doc-viewer');
        if (!viewer) return;

        var tabs = viewer.querySelectorAll('.pr-doc-tab');
        tabs.forEach(function(t) { t.classList.remove('active'); });
        btn.classList.add('active');

        var panes = viewer.querySelectorAll('.pr-doc-pane');
        panes.forEach(function(p) {
            if (p.getAttribute('data-pane') === paneName) {
                p.classList.add('active');
            } else {
                p.classList.remove('active');
            }
        });

        if (paneName === 'split') {
            var img = viewer.querySelector('.pr-doc-pane-split .pr-split-left img');
            if (img && img.complete) procurementSyncSplitPane(img);
        }
    };

    window.procurementCloseImage = function () {
        var modal = document.getElementById('procurementImageModal');
        if (!modal) return;
        modal.classList.remove('show', 'pr-modal-large');
        document.body.classList.remove('pr-modal-lock');
    };

    // ── Reports panel ────────────────────────────────────────────────────────
    window.procurementLoadReports = function () {
        var container = document.getElementById('procurementReportArea');
        if (!container) return;
        container.innerHTML = '<div class="pr-empty"><i class="fas fa-spinner fa-pulse"></i> Loading report…</div>';
        var q = procurementProjectId() ? ('?project_id=' + encodeURIComponent(procurementProjectId())) : '';
        fetch(apiBase() + '/api/procurement/report' + q)
            .then(function (res) {
                if (!res.ok) throw new Error('Failed to load report');
                return res.json();
            })
            .then(function (data) {
                var report = data.report || '';
                if (!report) {
                    container.innerHTML = '<div class="pr-empty"><i class="fas fa-file-alt"></i> No report available. Run the pipeline first.</div>';
                    return;
                }
                var html = '<div class="pr-md pr-report-content">';
                if (window.renderRichMarkdownHtml) {
                    try {
                        html += window.renderRichMarkdownHtml(report);
                    } catch (_e) {
                        html += renderMd(report);
                    }
                } else {
                    html += renderMd(report);
                }
                html += '</div>';
                container.innerHTML = html;
                if (window._postRenderMermaid) {
                    setTimeout(function () {
                        try { window._postRenderMermaid(container); } catch (_e) { }
                    }, 100);
                }
                var vizBtn = document.getElementById('procurementVizBtn');
                var reportBtn = document.getElementById('procurementReportBtn');
                if (vizBtn) vizBtn.classList.remove('btn-primary');
                if (reportBtn) reportBtn.classList.add('btn-primary');
            })
            .catch(function (err) {
                container.innerHTML = '<div class="pr-empty dr-error">' + esc(err.message) + '</div>';
            });
    };

    window.procurementLoadVisualizations = function () {
        var container = document.getElementById('procurementReportArea');
        if (!container) return;
        container.innerHTML = '<div class="pr-empty"><i class="fas fa-spinner fa-pulse"></i> Loading visualizations…</div>';
        var q = procurementProjectId() ? ('?project_id=' + encodeURIComponent(procurementProjectId())) : '';
        fetch(apiBase() + '/api/procurement/outputs' + q)
            .then(function (res) {
                if (!res.ok) throw new Error('Failed to load visualization data');
                return res.json();
            })
            .then(function (data) {
                if (!data || data.error) {
                    container.innerHTML = '<div class="pr-empty"><i class="fas fa-chart-pie"></i> No visualization data available. Run the pipeline first.</div>';
                    return;
                }
                container.innerHTML = renderVisualizationCards(data);
                var vizBtn = document.getElementById('procurementVizBtn');
                var reportBtn = document.getElementById('procurementReportBtn');
                if (vizBtn) vizBtn.classList.add('btn-primary');
                if (reportBtn) reportBtn.classList.remove('btn-primary');
            })
            .catch(function (err) {
                container.innerHTML = '<div class="pr-empty dr-error">' + esc(err.message) + '</div>';
            });
    };

    function renderVisualizationCards(data) {
        var html = '';
        // ... (simplified for brevity – adapt health version with procurement fields)
        // This function would build procurement-specific visualization cards
        // using data.suppliers, data.invoice_summary, etc.
        // For now, a placeholder:
        if (data.suppliers && data.suppliers.length) {
            html += '<div class="pr-viz-section">';
            html += '<h3 class="pr-viz-section-title"><i class="fas fa-building"></i> Suppliers</h3>';
            html += '<ul>';
            data.suppliers.forEach(function (s) {
                html += '<li>' + esc(s.name) + ' (' + s.invoice_count + ' invoices)</li>';
            });
            html += '</ul></div>';
        }
        return html || '<div class="pr-empty"><i class="fas fa-chart-pie"></i> No structured data available.</div>';
    }

    // ── Overview stats ───────────────────────────────────────────────────────
    window.procurementLoadStats = function () {
        var q = procurementProjectId() ? ('?project_id=' + encodeURIComponent(procurementProjectId())) : '';
        fetch(apiBase() + PROCUREMENT_API.status + q)
            .then(function (res) {
                if (!res.ok) throw new Error('Could not load stats');
                return res.json();
            })
            .then(function (data) {
                var stats = document.getElementById('procurementStats');
                if (!stats) return;
                var nums = stats.querySelectorAll('.pr-stat-num');
                if (nums.length >= 3) {
                    nums[0].textContent = data.invoice_count || '0';
                    nums[1].textContent = data.supplier_count || '0';
                    nums[2].textContent = data.total_value || '0';
                }
            })
            .catch(function () {
                var stats = document.getElementById('procurementStats');
                if (stats) {
                    var nums = stats.querySelectorAll('.pr-stat-num');
                    nums.forEach(function (n) { n.textContent = '–'; });
                }
            });
    };

    // ── Chat (SSE) ───────────────────────────────────────────────────────────
    function loadChatHistory() {
        try {
            var raw = localStorage.getItem(PROCUREMENT_STORAGE_KEY);
            var saved = raw ? JSON.parse(raw) : null;
            if (Array.isArray(saved)) pHistory = saved;
        } catch (_e) { pHistory = []; }
    }
    function saveChatHistory() {
        try { localStorage.setItem(PROCUREMENT_STORAGE_KEY, JSON.stringify(pHistory)); } catch (_e) { }
    }
    function renderChatLog() {
        var log = document.getElementById('prChatLog');
        if (!log) return;
        if (!pHistory.length) {
            log.innerHTML = '<div class="pr-chat-empty">' + CUBE_SVG_PROCUREMENT +
                '<p>Ask about your invoices, suppliers, or spending.<br>Ex: <em>"Show me all overdue invoices from Supplier X"</em></p></div>';
            return;
        }
        log.innerHTML = '';
        pHistory.forEach(function (m) { log.appendChild(chatBubble(m.role, m.text)); });
        log.scrollTop = log.scrollHeight;
    }
    function chatBubble(role, text) {
        var div = document.createElement('div');
        div.className = 'pr-msg pr-msg-' + (role === 'user' ? 'user' : 'agent');
        if (role === 'user') {
            div.innerHTML = '<div class="pr-msg-body">' + esc(text) + '</div>';
        } else {
            div.innerHTML = '<div class="pr-msg-tag">OLIVIA PROCUREMENT</div>' +
                '<div class="pr-msg-body pr-md">' + renderMd(text) + '</div>';
        }
        return div;
    }

    window.procurementNewChat = function () {
        if (pStreaming) return;
        pHistory = [];
        pSessionId = null;
        pPrimerSent = false;
        saveChatHistory();
        renderChatLog();
    };

    window.procurementSend = function () {
        if (pStreaming) return;
        var input = document.getElementById('prChatInput');
        var log = document.getElementById('prChatLog');
        if (!input || !log) return;
        var message = (input.value || '').trim();
        if (!message) return;

        input.value = '';
        if (!pHistory.length) log.innerHTML = '';
        pHistory.push({ role: 'user', text: message });
        log.appendChild(chatBubble('user', message));
        saveChatHistory();

        pStreaming = true;
        setSendEnabled(false);
        var proc = createProcessingIndicator(log);
        streamReply(message, log, proc);
    };

    function setSendEnabled(on) {
        var btn = document.getElementById('prChatSend');
        var input = document.getElementById('prChatInput');
        if (btn) { btn.disabled = !on; btn.classList.toggle('pr-busy', !on); }
        if (input) input.disabled = !on;
    }

    function createProcessingIndicator(log) {
        var el = document.createElement('div');
        el.className = 'pr-proc';
        el.innerHTML = '<span class="pr-proc-spin"></span><span class="pr-proc-text">Processing...</span>';
        log.appendChild(el);
        log.scrollTop = log.scrollHeight;
        return {
            setPhase: function (txt) {
                var t = el.querySelector('.pr-proc-text');
                if (t) t.textContent = txt;
            },
            done: function () { if (el.parentNode) el.parentNode.removeChild(el); }
        };
    }

    function streamReply(message, log, proc) {
        var streamEl = null, streamed = '', streamErr = '';
        function ensureBubble() {
            if (!streamEl) {
                streamEl = chatBubble('agent', '');
                log.appendChild(streamEl);
            }
            return streamEl.querySelector('.pr-msg-body');
        }

        var history = pHistory.filter(function (m) { return m && m.text; })
            .slice(-20).map(function (m) {
                return { role: m.role === 'agent' ? 'assistant' : 'user', content: m.text };
            });
        var messageForBackend = pPrimerSent ? message : (PROCUREMENT_PRIMER + '\n' + message);
        pPrimerSent = true;

        var payload = {
            message: messageForBackend,
            history: history.slice(0, -1),
            session_id: pSessionId || null,
            section_key: 'procurement',
        };

        fetch(apiBase() + PROCUREMENT_API.assistant, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        }).then(function (res) {
            if (!res.ok || !res.body || !res.body.getReader) {
                throw new Error('Failed to connect to backend (' + res.status + ').');
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
                            pSessionId = evt.session_id;
                        } else if (evt.type === 'error' || evt.event === 'error') {
                            streamErr = String(evt.message || 'Stream error.');
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
                    var text = streamed || 'No response.';
                    if (!streamEl) { streamEl = chatBubble('agent', ''); log.appendChild(streamEl); }
                    streamEl.querySelector('.pr-msg-body').innerHTML = renderMd(text);
                    pHistory.push({ role: 'agent', text: text });
                    saveChatHistory();
                }
                log.scrollTop = log.scrollHeight;
                pStreaming = false;
                setSendEnabled(true);
            }

            return pump();
        }).catch(function (err) {
            proc.done();
            log.appendChild(errorEl(err && err.message ? err.message : String(err)));
            log.scrollTop = log.scrollHeight;
            pStreaming = false;
            setSendEnabled(true);
        });
    }

    function errorEl(msg) {
        var el = document.createElement('div');
        el.className = 'pr-chat-error';
        el.innerHTML = '<i class="fas fa-triangle-exclamation"></i> ' + esc(msg);
        return el;
    }

    // ── Lifecycle: show / hide the view ──────────────────────────────────────
    var SIBLING_HIDE = ['violationsHideView', 'lawLibHideView', 'masterIndexHideView',
        'legalRouterHideView', 'spacesHideView', 'listeningHideView', 'studioHideView',
        'descobertaHideView', 'memoryHideView', 'shadersHideView', 'architectureHideView',
        'craudioHideView', 'writerHideView', 'driveHideView', 'healthHideView'];
    var CHAT_IDS = ['chatHeader', 'welcomeState', 'chatLog', 'chatCompose', 'chatToolbar'];

    window.procurementShowView = function () {
        build();
        CHAT_IDS.forEach(function (id) {
            var el = document.getElementById(id); if (el) el.style.display = 'none';
        });
        var mc = document.querySelector('.main-content');
        if (mc) { mc._prDisplay = mc.style.display; mc.style.display = 'none'; }
        SIBLING_HIDE.forEach(function (fn) {
            try { if (typeof window[fn] === 'function') window[fn](); } catch (_e) { }
        });
        var v = document.getElementById('procurementView');
        if (v) v.classList.add('active');
        var ws = document.querySelector('.workspace');
        if (ws) ws.classList.add('pr-open');
        procurementLoadStats();
        setupUploadDrag();
    };

    window.procurementHideView = function () {
        var v = document.getElementById('procurementView');
        if (v) v.classList.remove('active');
        var ws = document.querySelector('.workspace');
        if (ws) ws.classList.remove('pr-open');
        var mc = document.querySelector('.main-content');
        if (mc) { mc.style.display = mc._prDisplay !== undefined ? mc._prDisplay : ''; delete mc._prDisplay; }
        CHAT_IDS.forEach(function (id) {
            var el = document.getElementById(id); if (el) el.style.display = '';
        });
    };

    // Auto-close when other plugins open (include healthHideView)
    function wrapSiblings() {
        var names = ['violationsShowView', 'lawLibShowView', 'masterIndexShowView',
            'legalRouterShowView', 'spacesShowView', 'listeningShowView', 'studioShowView',
            'descobertaShowView', 'memoryShowView', 'shadersShowView', 'architectureShowView',
            'craudioShowView', 'writerShowView', 'resetToWelcome', 'aexToggleMain', 'driveShowView',
            'healthShowView'];
        names.forEach(function (n) {
            var orig = window[n];
            if (typeof orig !== 'function' || orig._prWrapped) return;
            var wrapped = function () {
                try { window.procurementHideView(); } catch (_e) { }
                return orig.apply(this, arguments);
            };
            wrapped._prWrapped = true;
            window[n] = wrapped;
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', wrapSiblings);
    } else {
        wrapSiblings();
    }
})();