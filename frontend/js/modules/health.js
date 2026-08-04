/* ============================================================================
   Health — Personal health memory & pipeline inside Olivia Workspace.
   ============================================================================ */
(function () {
    'use strict';

    var HEALTH_API = {
        upload: '/api/health/upload',
        run: '/api/health/run',
        status: '/api/health/status',
        results: '/api/health/results',
        knowledgeBase: '/api/health/knowledge-base',
        timeline: '/api/health/timeline',
        assistant: '/api/health/assistant/chat',
    };

    var HEALTH_PRIMER = [
        'Você é a Olivia Health Assistant — um agente que ajuda a gerenciar registros de saúde.',
        'Você tem acesso ao pipeline de OCR, extração, timeline e knowledge base do usuário.',
        'Responda em português do Brasil, de forma empática e técnica.',
        '— Mensagem do usuário —',
    ].join('\n');

    // Cube SVG with health green accent
    var CUBE_SVG_HEALTH = '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><polygon points="20,30 50,15 80,30 80,70 50,85 20,70" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/><line x1="50" y1="15" x2="50" y2="85" stroke="currentColor" stroke-width="5"/><line x1="20" y1="70" x2="80" y2="30" stroke="currentColor" stroke-width="5"/></svg>';

    // ── Internal state ───────────────────────────────────────────────────────
    var hBuilt = false;
    var hActivePanel = 'overview';
    var hHistory = [];
    var hSessionId = null;
    var hPrimerSent = false;
    var hStreaming = false;
    var HEALTH_STORAGE_KEY = 'Olivia_health_chat_v1';

    // ── Helpers ───────────────────────────────────────────────────────────────
    // Active project (set by projects.js) — health data lives inside it.
    function healthProjectId() {
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
        var view = document.getElementById('healthView');
        if (!view || hBuilt) return;

        view.innerHTML =
            '<div class="hl-head">' +
            '<div class="hl-head-brand">' +
            '<span class="hl-logo">' + CUBE_SVG_HEALTH + '</span>' +
            '<span class="hl-title">Health</span>' +
            '<span class="hl-sub">Olivia Health</span>' +
            '</div>' +
            '<div class="hl-head-actions">' +
            '<button class="btn btn-sm" onclick="healthHideView()" title="Fechar">' +
            '<i class="fas fa-times"></i></button>' +
            '</div>' +
            '</div>' +
            '<div class="hl-subnav">' +
            '<button class="hl-tab active" data-panel="overview" onclick="healthSwitchPanel(\'overview\')">Overview</button>' +
            '<button class="hl-tab" data-panel="pipeline" onclick="healthSwitchPanel(\'pipeline\')">Pipeline</button>' +
            '<button class="hl-tab" data-panel="documents" onclick="healthSwitchPanel(\'documents\')">Documents</button>' +
            '<button class="hl-tab" data-panel="reports" onclick="healthSwitchPanel(\'reports\')">Reports</button>' +
            '<button class="hl-tab" data-panel="timeline" onclick="healthSwitchPanel(\'timeline\')">Timeline</button>' +
            '<button class="hl-tab" data-panel="chat" onclick="healthSwitchPanel(\'chat\')">Assistant</button>' +
            '</div>' +
            '<div class="hl-panels">' +
            '<div id="hlPanel-overview" class="hl-panel active">' + overviewHtml() + '</div>' +
            '<div id="hlPanel-pipeline" class="hl-panel">' + pipelineHtml() + '</div>' +
            '<div id="hlPanel-documents" class="hl-panel">' + documentsHtml() + '</div>' +
            '<div id="hlPanel-reports" class="hl-panel">' + reportsHtml() + '</div>' +
            '<div id="hlPanel-timeline" class="hl-panel">' + timelineHtml() + '</div>' +
            '<div id="hlPanel-chat" class="hl-panel">' + chatHtml() + '</div>' +
            '</div>';

        hBuilt = true;
        loadChatHistory();
        renderChatLog();
    }

    // ── Overview panel ───────────────────────────────────────────────────────
    function overviewHtml() {
        return '<div class="hl-hero">' +
            '<span class="hl-hero-logo">' + CUBE_SVG_HEALTH + '</span>' +
            '<h1 class="hl-hero-title">Olivia Health</h1>' +
            '<p class="hl-hero-tag">Your personal health memory. Upload documents, track your timeline, and stay in control.</p>' +
            '</div>' +
            '<div class="hl-stats" id="healthStats">' +
            '<div class="hl-stat"><div class="hl-stat-num">–</div><div class="hl-stat-label">Documents</div></div>' +
            '<div class="hl-stat"><div class="hl-stat-num">–</div><div class="hl-stat-label">Conditions</div></div>' +
            '<div class="hl-stat"><div class="hl-stat-num">–</div><div class="hl-stat-label">Medications</div></div>' +
            '</div>' +
            '<div class="hl-cta">' +
            '<button class="btn btn-primary" onclick="healthSwitchPanel(\'pipeline\')">' +
            '<i class="fas fa-upload"></i> Upload & Process</button>' +
            '<button class="btn" onclick="healthSwitchPanel(\'timeline\')">' +
            '<i class="fas fa-timeline"></i> View Timeline</button>' +
            '</div>' +
            '<div class="hl-guard"><i class="fas fa-shield-haltered"></i> ' +
            'This system does not provide medical advice. It helps you organise your health records and share them with your doctor.</div>';
    }

    // ── Pipeline panel (upload, run, view results) ───────────────────────────
    function pipelineHtml() {
        return '<div class="hl-pipeline">' +
            '<div class="hl-upload-area" id="healthUploadArea">' +
            '<i class="fas fa-cloud-upload-alt"></i>' +
            '<p>Drop images or click to upload</p>' +
            '<input type="file" id="healthFileInput" accept="image/*,.pdf" multiple style="display:none" onchange="healthHandleFiles(this.files)">' +
            '</div>' +
            '<div class="hl-pipeline-controls">' +
            '<button class="btn btn-primary" id="healthRunBtn" onclick="healthRunPipeline()" disabled>' +
            '<i class="fas fa-play"></i> Run Pipeline</button>' +
            '<span class="hl-status" id="healthPipelineStatus">Ready</span>' +
            '</div>' +
            '<div class="hl-results" id="healthResults">' +
            '<div class="hl-empty">Upload files and run the pipeline to see results.</div>' +
            '</div>' +
            '</div>';
    }

    // ── Timeline panel ───────────────────────────────────────────────────────
    function timelineHtml() {
        return '<div class="hl-timeline" id="healthTimeline">' +
            '<div class="hl-empty"><i class="fas fa-clock"></i> Your health timeline will appear here after processing documents.</div>' +
            '</div>';
    }

    // ── Documents panel ──────────────────────────────────────────────────────
    function documentsHtml() {
        return '<div class="hl-documents-panel">' +
            '<div class="hl-documents-grid" id="healthDocuments">' +
            '<div class="hl-empty"><i class="fas fa-file-image"></i> Loading documents…</div>' +
            '</div>' +
            '</div>';
    }

    // ── Reports panel ────────────────────────────────────────────────────────
    function reportsHtml() {
        return '<div class="hl-reports-panel">' +
            '<div class="hl-reports-toolbar">' +
            '<button class="btn btn-sm" id="healthVizBtn" onclick="healthLoadVisualizations()" title="Visualization data">' +
            '<i class="fas fa-chart-pie"></i> Visualizations</button>' +
            '<button class="btn btn-sm btn-primary" id="healthReportBtn" onclick="healthLoadReports()" title="Full report">' +
            '<i class="fas fa-file-alt"></i> Full Report</button>' +
            '</div>' +
            '<div class="hl-report-area" id="healthReportArea">' +
            '<div class="hl-empty"><i class="fas fa-file-alt"></i> Select a report to view.</div>' +
            '</div>' +
            '</div>';
    }

    // ── Chat panel ───────────────────────────────────────────────────────────
    function chatHtml() {
        return '<div class="hl-chat">' +
            '<div class="hl-chat-bar">' +
            '<span class="hl-chat-bar-label"><i class="fas fa-robot"></i> Health Assistant</span>' +
            '<button class="btn btn-sm" onclick="healthNewChat()" title="Nova conversa">' +
            '<i class="fas fa-plus"></i> New Chat</button>' +
            '</div>' +
            '<div id="hlChatLog" class="hl-chat-log"></div>' +
            '<div class="hl-chat-compose">' +
            '<textarea id="hlChatInput" class="hl-chat-input" rows="1" ' +
            'placeholder="Ask about your health records…" ' +
            'onkeydown="if(event.key===\'Enter\'&&!event.shiftKey){event.preventDefault();healthSend();}"></textarea>' +
            '<button class="hl-chat-send" id="hlChatSend" onclick="healthSend()" title="Send">' +
            '<i class="fas fa-arrow-up"></i></button>' +
            '</div>' +
            '</div>';
    }

    // ── Tab switching ────────────────────────────────────────────────────────
    window.healthSwitchPanel = function (name) {
        hActivePanel = name;
        ['overview', 'pipeline', 'documents', 'reports', 'timeline', 'chat'].forEach(function (p) {
            var panel = document.getElementById('hlPanel-' + p);
            if (panel) panel.classList.toggle('active', p === name);
        });
        var tabs = document.querySelectorAll('#healthView .hl-tab');
        tabs.forEach(function (t) {
            t.classList.toggle('active', t.getAttribute('data-panel') === name);
        });
        if (name === 'pipeline') healthRefreshPipeline();
        else if (name === 'documents') healthLoadDocuments();
        else if (name === 'reports') healthLoadReports();
        else if (name === 'timeline') healthLoadTimeline();
        else if (name === 'overview') healthLoadStats();
        else if (name === 'chat') {
            var input = document.getElementById('hlChatInput');
            if (input) setTimeout(function () { input.focus(); }, 30);
        }
    };

    // ── Pipeline handling ────────────────────────────────────────────────────
    window.healthHandleFiles = function (files) {
        // store files for pipeline run (simplified: we'll upload when run)
        var area = document.getElementById('healthUploadArea');
        if (!area) return;
        var names = Array.from(files).map(function (f) { return f.name; }).join(', ');
        area.innerHTML = '<p>' + esc(names) + ' (' + files.length + ' files)</p>';
        area.dataset.hasFiles = 'true';
        document.getElementById('healthRunBtn').disabled = false;
        // store files globally for sending
        window._healthFiles = files;
    };

    // Drag & drop support
    function setupUploadDrag() {
        var area = document.getElementById('healthUploadArea');
        if (!area) return;
        area.addEventListener('dragover', function (e) {
            e.preventDefault();
            area.classList.add('hl-dragover');
        });
        area.addEventListener('dragleave', function () {
            area.classList.remove('hl-dragover');
        });
        area.addEventListener('drop', function (e) {
            e.preventDefault();
            area.classList.remove('hl-dragover');
            healthHandleFiles(e.dataTransfer.files);
        });
        area.addEventListener('click', function () {
            document.getElementById('healthFileInput').click();
        });
    }

    window.healthRunPipeline = function () {
        var files = window._healthFiles;
        if (!files || files.length === 0) return;
        var statusEl = document.getElementById('healthPipelineStatus');
        var runBtn = document.getElementById('healthRunBtn');
        if (statusEl) statusEl.textContent = 'Uploading & running...';
        if (runBtn) runBtn.disabled = true;

        var formData = new FormData();
        formData.append('project_id', healthProjectId());
        for (var i = 0; i < files.length; i++) {
            formData.append('files', files[i]);
        }

        fetch(apiBase() + HEALTH_API.upload, { method: 'POST', body: formData })
            .then(function (res) {
                if (!res.ok) throw new Error('Upload failed');
                return res.json();
            })
            .then(function (uploadData) {
                if (statusEl) statusEl.textContent = 'Running pipeline...';
                return fetch(apiBase() + HEALTH_API.run, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ upload_id: uploadData.upload_id, project_id: healthProjectId() })
                });
            })
            .then(function (res) {
                if (!res.ok) throw new Error('Pipeline failed');
                return res.json();
            })
            .then(function (pipelineResult) {
                if (statusEl) statusEl.textContent = 'Completed';
                healthLoadResults(pipelineResult);
            })
            .catch(function (err) {
                if (statusEl) statusEl.textContent = 'Error: ' + esc(err.message);
                if (runBtn) runBtn.disabled = false;
            });
    };

    function healthLoadResults(data) {
        var container = document.getElementById('healthResults');
        if (!container) return;
        if (!data || data.status !== 'completed') {
            container.innerHTML = '<div class="hl-empty">Pipeline did not complete successfully.</div>';
            return;
        }
        var summary = data.summary || {};
        var fs = summary.file_statistics || data.file_statistics || {};
        var html = '<div class="hl-result-summary">';
        html += '<h3>Pipeline Summary</h3>';
        html += '<p>Processed: ' + (fs.total_images != null ? fs.total_images : '?') + ' images</p>';
        html += '<p>Successful OCR: ' + (fs.successful_ocr != null ? fs.successful_ocr : '?') + '</p>';
        if (data.workspace) {
            html += '<p class="hl-result-workspace"><i class="fas fa-folder-open"></i> Patient workspace: <code>' + esc(data.workspace) + '</code></p>';
        }
        html += '</div>';
        container.innerHTML = html;
        document.getElementById('healthRunBtn').disabled = false;
    }

    window.healthRefreshPipeline = function () {
        // reset upload area if needed
        var area = document.getElementById('healthUploadArea');
        if (area && !area.dataset.hasFiles) {
            area.innerHTML = '<i class="fas fa-cloud-upload-alt"></i><p>Drop images or click to upload</p>';
        }
    };

    // ── Timeline ─────────────────────────────────────────────────────────────
    window.healthLoadTimeline = function () {
        var container = document.getElementById('healthTimeline');
        if (!container) return;
        container.innerHTML = '<div class="hl-empty"><i class="fas fa-spinner fa-pulse"></i> Loading timeline…</div>';
        var q = healthProjectId() ? ('?project_id=' + encodeURIComponent(healthProjectId())) : '';
        var base = apiBase();

        // Fetch both timeline and documents-detail in parallel
        Promise.all([
            fetch(base + HEALTH_API.timeline + q).then(function (r) { if (!r.ok) throw new Error('Timeline fetch failed'); return r.json(); }),
            fetch(base + '/api/health/documents-detail' + q).then(function (r) { if (!r.ok) throw new Error('Documents fetch failed'); return r.json(); })
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
                container.innerHTML = '<div class="hl-empty"><i class="fas fa-clock"></i> No events yet. Upload documents to build your timeline.</div>';
                return;
            }

            // Render base events immediately (don't block on the outputs fetch).
            renderTimelineEvents(container, events, docMap);

            // Also try to load visualization timeline data for richer events,
            // then re-render merged.
            fetch(base + '/api/health/outputs' + q)
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

                    // Merge: simple events first, then viz events
                    var allEvents = events.concat(vizEvents);
                    // Sort by date
                    allEvents.sort(function (a, b) {
                        if (a.date < b.date) return -1;
                        if (a.date > b.date) return 1;
                        return 0;
                    });

                    renderTimelineEvents(container, allEvents, docMap);
                });
        }).catch(function (err) {
            container.innerHTML = '<div class="hl-empty dr-error">' + esc(err.message) + '</div>';
        });
    };

    function renderTimelineEvents(container, events, docMap) {
        var html = '<div class="hl-timeline-list">';
        var statusColors = {
            'prevention_failure': '#e67e22',
            'record_gap': '#9b59b6',
            'diagnosis': '#e74c3c',
            'iatrogenic': '#c0392b',
            'medication_error': '#e74c3c',
            'lab_error': '#e74c3c',
            'lab_test': '#3498db',
            'fragmentation': '#f39c12',
            'perverse_incentive': '#e67e22',
            'private_payment': '#2ecc71',
            'bureaucracy': '#95a5a6',
            'documentation': '#1abc9c',
            'scheduling': '#3498db',
            'consultation': '#2e9a6a',
            'treatment': '#2e9a6a'
        };

        events.forEach(function (ev) {
            var color = statusColors[ev.status] || '#95a5a6';
            html += '<div class="hl-tl-card" style="border-left: 3px solid ' + color + '">';
            html += '<div class="hl-tl-card-header">';
            html += '<span class="hl-tl-date">' + esc(ev.date) + '</span>';
            if (ev.category) {
                html += '<span class="hl-tl-category" style="background:' + color + '20;color:' + color + '">' + esc(ev.category) + '</span>';
            }
            if (ev.system) {
                html += '<span class="hl-tl-system">' + esc(ev.system) + '</span>';
            }
            html += '</div>';
            html += '<div class="hl-tl-card-body">';
            html += '<div class="hl-tl-event-title">' + esc(ev.description) + '</div>';
            if (ev.detail) {
                html += '<div class="hl-tl-detail">' + esc(ev.detail) + '</div>';
            }

            // Attach the source document thumbnail(s) when the event text
            // references a processed document filename.
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
                html += '<div class="hl-tl-docs">';
                matched.forEach(function (d) {
                    html += '<img src="' + esc(d.image_url) + '" alt="' + esc(d.filename) + '" loading="lazy" class="hl-tl-doc-thumb" title="' + esc(d.filename) + '" data-url="' + esc(d.image_url) + '" data-title="' + esc(d.filename) + '" data-kind="' + esc(d.kind || 'image') + '" onclick="healthZoom(this)">';
                });
                html += '</div>';
            }
            html += '</div>';
            html += '</div>';
        });
        html += '</div>';
        container.innerHTML = html;
    }

    // ── Documents panel ───────────────────────────────────────────────────────
    window.healthLoadDocuments = function () {
        var container = document.getElementById('healthDocuments');
        if (!container) return;
        container.innerHTML = '<div class="hl-empty"><i class="fas fa-spinner fa-pulse"></i> Loading documents…</div>';
        var q = healthProjectId() ? ('?project_id=' + encodeURIComponent(healthProjectId())) : '';
        fetch(apiBase() + '/api/health/documents-detail' + q)
            .then(function (res) {
                if (!res.ok) throw new Error('Failed to load documents');
                return res.json();
            })
            .then(function (data) {
                var docs = data.documents || [];
                if (!docs.length) {
                    container.innerHTML = '<div class="hl-empty"><i class="fas fa-file-image"></i> No documents yet. Upload images in the Pipeline tab.</div>';
                    return;
                }
                var html = '';
                docs.forEach(function (doc) {
                    var statusClass = doc.ocr_success ? 'hl-doc-ok' : 'hl-doc-pending';
                    var statusIcon = doc.ocr_success ? 'fa-check-circle' : 'fa-clock';
                    var statusText = doc.ocr_success ? 'OCR complete' : 'Pending';
                    var textPreview = doc.text ? doc.text.substring(0, 300) : '';
                    var hasMore = doc.text && doc.text.length > 300;

                    html += '<div class="hl-doc-card ' + statusClass + '">';
                    html += '<div class="hl-doc-card-header">';
                    if (doc.image_url) {
                        html += '<div class="hl-doc-thumb-wrap">';
                        html += '<div class="hl-doc-thumb' + (doc.kind === 'pdf' ? ' hl-doc-thumb-pdf' : '') + '" onclick="healthToggleDocText(this)" title="Click to toggle OCR text">';
                        if (doc.kind === 'pdf') {
                            // PDFs can't render in <img>; embed in an iframe preview.
                            html += '<iframe src="' + esc(doc.image_url) + '" loading="lazy" class="hl-doc-pdf-frame" title="' + esc(doc.filename) + '"></iframe>';
                        } else {
                            html += '<img src="' + esc(doc.image_url) + '" alt="' + esc(doc.filename) + '" loading="lazy">';
                        }
                        html += '</div>';
                        html += '<button class="hl-doc-zoom" data-url="' + esc(doc.image_url) + '" data-title="' + esc(doc.filename) + '" data-kind="' + esc(doc.kind) + '" onclick="healthZoom(this)" title="View large image"><i class="fas fa-expand"></i></button>';
                        html += '</div>';
                    }
                    html += '<div class="hl-doc-meta">';
                    html += '<div class="hl-doc-filename" title="' + esc(doc.filename) + '">' + esc(doc.filename) + '</div>';
                    html += '<div class="hl-doc-status"><i class="fas ' + statusIcon + '"></i> ' + statusText + '</div>';
                    if (doc.uploaded_at) {
                        html += '<div class="hl-doc-date">' + esc(doc.uploaded_at) + '</div>';
                    }
                    html += '</div>';
                    html += '</div>';
                    if (doc.text) {
                        html += '<div class="hl-doc-text" style="display:none">';
                        html += '<div class="hl-doc-text-inner">' + renderMd(doc.text) + '</div>';
                        html += '</div>';
                    }
                    html += '</div>';
                });
                container.innerHTML = html;
            })
            .catch(function (err) {
                container.innerHTML = '<div class="hl-empty dr-error">' + esc(err.message) + '</div>';
            });
    };

    window.healthToggleDocText = function (el) {
        var card = el.closest ? el.closest('.hl-doc-card') : null;
        if (!card) return;
        var text = card.querySelector('.hl-doc-text');
        if (!text) return;
        if (text.style.display === 'none') {
            text.style.display = 'block';
        } else {
            text.style.display = 'none';
        }
    };

    // ── Image modal / lightbox ────────────────────────────────────────────────
    function healthEnsureModal() {
        var modal = document.getElementById('healthImageModal');
        if (modal) return modal;
        modal = document.createElement('div');
        modal.id = 'healthImageModal';
        modal.className = 'hl-modal-overlay';
        modal.innerHTML =
            '<div class="hl-modal" role="dialog" aria-modal="true" aria-label="Document view">' +
            '<div class="hl-modal-head">' +
            '<span class="hl-modal-title"></span>' +
            '<div class="hl-modal-head-actions">' +
            '<a class="hl-modal-openlink" id="healthModalOpenLink" target="_blank" rel="noopener" title="Open in new tab"><i class="fas fa-external-link-alt"></i></a>' +
            '<button class="hl-modal-close" title="Close (Esc)"><i class="fas fa-times"></i></button>' +
            '</div>' +
            '</div>' +
            '<div class="hl-modal-body"></div>' +
            '</div>';
        document.body.appendChild(modal);
        var overlay = modal;
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) window.healthCloseImage();
        });
        var closeBtn = modal.querySelector('.hl-modal-close');
        if (closeBtn) closeBtn.addEventListener('click', function () { window.healthCloseImage(); });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') window.healthCloseImage();
        });
        return modal;
    }

    window.healthZoom = function (el) {
        if (!el) return;
        window.healthViewImage(
            el.getAttribute('data-url'),
            el.getAttribute('data-title') || 'Document',
            el.getAttribute('data-kind') || 'image'
        );
    };

    window.healthViewImage = function (url, title, kind) {
        if (!url) return;
        var modal = healthEnsureModal();
        var body = modal.querySelector('.hl-modal-body');
        if (kind === 'pdf') {
            body.innerHTML = '<iframe src="' + esc(url) + '" class="hl-modal-frame" title="' + esc(title) + '"></iframe>';
        } else {
            body.innerHTML = '<img src="' + esc(url) + '" alt="' + esc(title) + '" class="hl-modal-img">';
        }
        var t = modal.querySelector('.hl-modal-title');
        if (t) t.textContent = title || 'Document';
        var link = modal.querySelector('#healthModalOpenLink');
        if (link) link.setAttribute('href', url);
        modal.classList.add('show');
        document.body.classList.add('hl-modal-lock');
    };

    window.healthCloseImage = function () {
        var modal = document.getElementById('healthImageModal');
        if (!modal) return;
        modal.classList.remove('show');
        document.body.classList.remove('hl-modal-lock');
    };

    // ── Reports panel ────────────────────────────────────────────────────────
    window.healthLoadReports = function () {
        var container = document.getElementById('healthReportArea');
        if (!container) return;
        container.innerHTML = '<div class="hl-empty"><i class="fas fa-spinner fa-pulse"></i> Loading report…</div>';
        var q = healthProjectId() ? ('?project_id=' + encodeURIComponent(healthProjectId())) : '';
        fetch(apiBase() + '/api/health/report' + q)
            .then(function (res) {
                if (!res.ok) throw new Error('Failed to load report');
                return res.json();
            })
            .then(function (data) {
                var report = data.report || '';
                if (!report) {
                    container.innerHTML = '<div class="hl-empty"><i class="fas fa-file-alt"></i> No report available. Run the pipeline first.</div>';
                    return;
                }
                var html = '<div class="hl-md hl-report-content">';
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
                // Post-render mermaid diagrams
                if (window._postRenderMermaid) {
                    setTimeout(function () {
                        try { window._postRenderMermaid(container); } catch (_e) { }
                    }, 100);
                }
                // Update toolbar active state
                var vizBtn = document.getElementById('healthVizBtn');
                var reportBtn = document.getElementById('healthReportBtn');
                if (vizBtn) vizBtn.classList.remove('btn-primary');
                if (reportBtn) reportBtn.classList.add('btn-primary');
            })
            .catch(function (err) {
                container.innerHTML = '<div class="hl-empty dr-error">' + esc(err.message) + '</div>';
            });
    };

    window.healthLoadVisualizations = function () {
        var container = document.getElementById('healthReportArea');
        if (!container) return;
        container.innerHTML = '<div class="hl-empty"><i class="fas fa-spinner fa-pulse"></i> Loading visualizations…</div>';
        var q = healthProjectId() ? ('?project_id=' + encodeURIComponent(healthProjectId())) : '';
        fetch(apiBase() + '/api/health/outputs' + q)
            .then(function (res) {
                if (!res.ok) throw new Error('Failed to load visualization data');
                return res.json();
            })
            .then(function (data) {
                if (!data || data.error) {
                    container.innerHTML = '<div class="hl-empty"><i class="fas fa-chart-pie"></i> No visualization data available. Run the pipeline first.</div>';
                    return;
                }
                container.innerHTML = renderVisualizationCards(data);
                // Update toolbar active state
                var vizBtn = document.getElementById('healthVizBtn');
                var reportBtn = document.getElementById('healthReportBtn');
                if (vizBtn) vizBtn.classList.add('btn-primary');
                if (reportBtn) reportBtn.classList.remove('btn-primary');
            })
            .catch(function (err) {
                container.innerHTML = '<div class="hl-empty dr-error">' + esc(err.message) + '</div>';
            });
    };

    function renderVisualizationCards(data) {
        var html = '';

        // Systemic failures summary
        if (data.systemic_failures && data.systemic_failures.length) {
            html += '<div class="hl-viz-section">';
            html += '<h3 class="hl-viz-section-title"><i class="fas fa-exclamation-triangle"></i> Systemic Failures</h3>';
            html += '<div class="hl-viz-grid">';
            data.systemic_failures.forEach(function (sf) {
                var sevColor = sf.severity === 'CRÍTICA' ? '#e74c3c' : sf.severity === 'ALTA' ? '#e67e22' : '#f39c12';
                html += '<div class="hl-viz-card" style="border-top: 3px solid ' + sevColor + '">';
                html += '<div class="hl-viz-card-header">';
                html += '<span class="hl-viz-card-badge" style="background:' + sevColor + '20;color:' + sevColor + '">' + esc(sf.severity) + '</span>';
                html += '<span class="hl-viz-card-count">' + sf.count + ' incidents</span>';
                html += '</div>';
                html += '<div class="hl-viz-card-title">' + esc(sf.category) + '</div>';
                html += '<ul class="hl-viz-card-list">';
                (sf.incidents || []).forEach(function (inc) {
                    html += '<li>' + esc(inc) + '</li>';
                });
                html += '</ul>';
                if (sf.law) {
                    html += '<div class="hl-viz-card-law"><i class="fas fa-gavel"></i> ' + esc(sf.law) + '</div>';
                }
                html += '</div>';
            });
            html += '</div></div>';
        }

        // Medications
        if (data.medications && data.medications.length) {
            html += '<div class="hl-viz-section">';
            html += '<h3 class="hl-viz-section-title"><i class="fas fa-pills"></i> Medications</h3>';
            html += '<div class="hl-med-list">';
            data.medications.forEach(function (med) {
                var statusColor = med.status === 'Em uso' ? '#2e9a6a' : med.status === 'CONTRAINDICADO' ? '#e74c3c' : '#95a5a6';
                html += '<div class="hl-med-card" style="border-left: 3px solid ' + statusColor + '">';
                html += '<div class="hl-med-name">' + esc(med.name) + ' <span class="hl-med-dose">' + esc(med.dose) + '</span></div>';
                html += '<div class="hl-med-meta">';
                html += '<span class="hl-med-status" style="color:' + statusColor + '">' + esc(med.status) + '</span>';
                if (med.system) html += '<span class="hl-med-system">' + esc(med.system) + '</span>';
                if (med.cost) html += '<span class="hl-med-cost">' + esc(med.cost) + '</span>';
                html += '</div>';
                if (med.note) html += '<div class="hl-med-note">' + esc(med.note) + '</div>';
                html += '</div>';
            });
            html += '</div></div>';
        }

        // Lab results table
        if (data.laboratory_results && data.laboratory_results.length) {
            html += '<div class="hl-viz-section">';
            html += '<h3 class="hl-viz-section-title"><i class="fas fa-flask"></i> Laboratory Results</h3>';
            html += '<div class="hl-lab-table-wrap"><table class="hl-lab-table">';
            html += '<thead><tr><th>Analyte</th><th>Value</th><th>Unit</th><th>Reference</th><th>Date</th></tr></thead><tbody>';
            data.laboratory_results.forEach(function (r) {
                html += '<tr>';
                html += '<td>' + esc(r.analyte) + '</td>';
                html += '<td class="hl-lab-val">' + esc(String(r.value)) + '</td>';
                html += '<td>' + esc(r.unit) + '</td>';
                html += '<td class="hl-lab-ref">' + esc(r.ref_range) + '</td>';
                html += '<td class="hl-lab-date">' + esc(r.date) + '</td>';
                html += '</tr>';
            });
            html += '</tbody></table></div></div>';
        }

        // Key quotes
        if (data.quotes_key && data.quotes_key.length) {
            html += '<div class="hl-viz-section">';
            html += '<h3 class="hl-viz-section-title"><i class="fas fa-quote-right"></i> Key Quotes</h3>';
            data.quotes_key.forEach(function (q) {
                html += '<blockquote class="hl-quote">';
                html += '<p>"' + esc(q.quote) + '"</p>';
                html += '<footer>— ' + esc(q.source) + ' · <span class="hl-quote-theme">' + esc(q.theme) + '</span></footer>';
                html += '</blockquote>';
            });
            html += '</div>';
        }

        return html || '<div class="hl-empty"><i class="fas fa-chart-pie"></i> No structured data available.</div>';
    }



    // ── Overview stats ───────────────────────────────────────────────────────
    window.healthLoadStats = function () {
        var q = healthProjectId() ? ('?project_id=' + encodeURIComponent(healthProjectId())) : '';
        fetch(apiBase() + HEALTH_API.status + q)
            .then(function (res) {
                if (!res.ok) throw new Error('Could not load stats');
                return res.json();
            })
            .then(function (data) {
                var stats = document.getElementById('healthStats');
                if (!stats) return;
                var nums = stats.querySelectorAll('.hl-stat-num');
                if (nums.length >= 3) {
                    nums[0].textContent = data.document_count || '0';
                    nums[1].textContent = data.condition_count || '0';
                    nums[2].textContent = data.medication_count || '0';
                }
            })
            .catch(function () {
                var stats = document.getElementById('healthStats');
                if (stats) {
                    var nums = stats.querySelectorAll('.hl-stat-num');
                    nums.forEach(function (n) { n.textContent = '–'; });
                }
            });
    };

    // ── Chat (SSE) ───────────────────────────────────────────────────────────
    function loadChatHistory() {
        try {
            var raw = localStorage.getItem(HEALTH_STORAGE_KEY);
            var saved = raw ? JSON.parse(raw) : null;
            if (Array.isArray(saved)) hHistory = saved;
        } catch (_e) { hHistory = []; }
    }
    function saveChatHistory() {
        try { localStorage.setItem(HEALTH_STORAGE_KEY, JSON.stringify(hHistory)); } catch (_e) { }
    }
    function renderChatLog() {
        var log = document.getElementById('hlChatLog');
        if (!log) return;
        if (!hHistory.length) {
            log.innerHTML = '<div class="hl-chat-empty">' + CUBE_SVG_HEALTH +
                '<p>Ask about your health timeline, documents, or metrics.<br>Ex: <em>"Show my blood pressure over the last year"</em></p></div>';
            return;
        }
        log.innerHTML = '';
        hHistory.forEach(function (m) { log.appendChild(bubble(m.role, m.text)); });
        log.scrollTop = log.scrollHeight;
    }
    function bubble(role, text) {
        var div = document.createElement('div');
        div.className = 'hl-msg hl-msg-' + (role === 'user' ? 'user' : 'agent');
        if (role === 'user') {
            div.innerHTML = '<div class="hl-msg-body">' + esc(text) + '</div>';
        } else {
            div.innerHTML = '<div class="hl-msg-tag">OLIVIA HEALTH</div>' +
                '<div class="hl-msg-body hl-md">' + renderMd(text) + '</div>';
        }
        return div;
    }

    window.healthNewChat = function () {
        if (hStreaming) return;
        hHistory = [];
        hSessionId = null;
        hPrimerSent = false;
        saveChatHistory();
        renderChatLog();
    };

    window.healthSend = function () {
        if (hStreaming) return;
        var input = document.getElementById('hlChatInput');
        var log = document.getElementById('hlChatLog');
        if (!input || !log) return;
        var message = (input.value || '').trim();
        if (!message) return;

        input.value = '';
        if (!hHistory.length) log.innerHTML = '';
        hHistory.push({ role: 'user', text: message });
        log.appendChild(bubble('user', message));
        saveChatHistory();

        hStreaming = true;
        setSendEnabled(false);
        var proc = createProcessingIndicator(log);
        streamReply(message, log, proc);
    };

    function setSendEnabled(on) {
        var btn = document.getElementById('hlChatSend');
        var input = document.getElementById('hlChatInput');
        if (btn) { btn.disabled = !on; btn.classList.toggle('hl-busy', !on); }
        if (input) input.disabled = !on;
    }

    function createProcessingIndicator(log) {
        var el = document.createElement('div');
        el.className = 'hl-proc';
        el.innerHTML = '<span class="hl-proc-spin"></span><span class="hl-proc-text">Processing...</span>';
        log.appendChild(el);
        log.scrollTop = log.scrollHeight;
        return {
            setPhase: function (txt) {
                var t = el.querySelector('.hl-proc-text');
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
            return streamEl.querySelector('.hl-msg-body');
        }

        var history = hHistory.filter(function (m) { return m && m.text; })
            .slice(-20).map(function (m) {
                return { role: m.role === 'agent' ? 'assistant' : 'user', content: m.text };
            });
        var messageForBackend = hPrimerSent ? message : (HEALTH_PRIMER + '\n' + message);
        hPrimerSent = true;

        var payload = {
            message: messageForBackend,
            history: history.slice(0, -1),
            session_id: hSessionId || null,
            section_key: 'health',
        };

        fetch(apiBase() + HEALTH_API.assistant, {
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
                            hSessionId = evt.session_id;
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
                    if (!streamEl) { streamEl = bubble('agent', ''); log.appendChild(streamEl); }
                    streamEl.querySelector('.hl-msg-body').innerHTML = renderMd(text);
                    hHistory.push({ role: 'agent', text: text });
                    saveChatHistory();
                }
                log.scrollTop = log.scrollHeight;
                hStreaming = false;
                setSendEnabled(true);
            }

            return pump();
        }).catch(function (err) {
            proc.done();
            log.appendChild(errorEl(err && err.message ? err.message : String(err)));
            log.scrollTop = log.scrollHeight;
            hStreaming = false;
            setSendEnabled(true);
        });
    }

    function errorEl(msg) {
        var el = document.createElement('div');
        el.className = 'hl-chat-error';
        el.innerHTML = '<i class="fas fa-triangle-exclamation"></i> ' + esc(msg);
        return el;
    }

    // ── Lifecycle: show / hide the view ──────────────────────────────────────
    var SIBLING_HIDE = ['violationsHideView', 'lawLibHideView', 'masterIndexHideView',
        'legalRouterHideView', 'spacesHideView', 'listeningHideView', 'studioHideView',
        'descobertaHideView', 'memoryHideView', 'shadersHideView', 'architectureHideView',
        'craudioHideView', 'writerHideView', 'driveHideView'];
    var CHAT_IDS = ['chatHeader', 'welcomeState', 'chatLog', 'chatCompose', 'chatToolbar'];

    window.healthShowView = function () {
        build();
        CHAT_IDS.forEach(function (id) {
            var el = document.getElementById(id); if (el) el.style.display = 'none';
        });
        var mc = document.querySelector('.main-content');
        if (mc) { mc._hlDisplay = mc.style.display; mc.style.display = 'none'; }
        SIBLING_HIDE.forEach(function (fn) {
            try { if (typeof window[fn] === 'function') window[fn](); } catch (_e) { }
        });
        var v = document.getElementById('healthView');
        if (v) v.classList.add('active');
        var ws = document.querySelector('.workspace');
        if (ws) ws.classList.add('hl-open');
        healthLoadStats();
        // Setup drag & drop
        setupUploadDrag();
    };

    window.healthHideView = function () {
        var v = document.getElementById('healthView');
        if (v) v.classList.remove('active');
        var ws = document.querySelector('.workspace');
        if (ws) ws.classList.remove('hl-open');
        var mc = document.querySelector('.main-content');
        if (mc) { mc.style.display = mc._hlDisplay !== undefined ? mc._hlDisplay : ''; delete mc._hlDisplay; }
        CHAT_IDS.forEach(function (id) {
            var el = document.getElementById(id); if (el) el.style.display = '';
        });
    };

    // Auto-close when other plugins open
    function wrapSiblings() {
        var names = ['violationsShowView', 'lawLibShowView', 'masterIndexShowView',
            'legalRouterShowView', 'spacesShowView', 'listeningShowView', 'studioShowView',
            'descobertaShowView', 'memoryShowView', 'shadersShowView', 'architectureShowView',
            'craudioShowView', 'writerShowView', 'resetToWelcome', 'aexToggleMain', 'driveShowView'];
        names.forEach(function (n) {
            var orig = window[n];
            if (typeof orig !== 'function' || orig._hlWrapped) return;
            var wrapped = function () {
                try { window.healthHideView(); } catch (_e) { }
                return orig.apply(this, arguments);
            };
            wrapped._hlWrapped = true;
            window[n] = wrapped;
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', wrapSiblings);
    } else {
        wrapSiblings();
    }
})();