/* ============================================================================
   General OCR Pipeline — upload PDF/image, extract Markdown, document viewer.
   ============================================================================ */
(function () {
    'use strict';

    var OCR_API = {
        upload: '/api/ocr/upload',
        run: '/api/ocr/run',
        status: '/api/ocr/status',
        documents: '/api/ocr/documents',
    };

    // Cube SVG with generic blue accent
    var CUBE_SVG_OCR = '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><polygon points="20,30 50,15 80,30 80,70 50,85 20,70" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/><line x1="50" y1="15" x2="50" y2="85" stroke="currentColor" stroke-width="5"/><line x1="20" y1="70" x2="80" y2="30" stroke="currentColor" stroke-width="5"/></svg>';

    // ── Internal state ───────────────────────────────────────────────────────
    var built = false;
    var activePanel = 'overview';
    var currentFiles = null;
    var currentDocs = {};

    // ── Helpers ───────────────────────────────────────────────────────────────
    function projectId() {
        return (typeof window.OliviaProjectId === 'string' && window.OliviaProjectId)
            ? window.OliviaProjectId
            : '';
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
        var view = document.getElementById('ocrView');
        if (!view || built) return;

        view.innerHTML =
            '<div class="ocr-head">' +
                '<div class="ocr-head-brand">' +
                    '<span class="ocr-logo">' + CUBE_SVG_OCR + '</span>' +
                    '<span class="ocr-title">OCR Pipeline</span>' +
                    '<span class="ocr-sub">General Document OCR</span>' +
                '</div>' +
                '<div class="ocr-head-actions">' +
                    '<button class="btn btn-sm" onclick="ocrHideView()" title="Fechar">' +
                        '<i class="fas fa-times"></i>' +
                    '</button>' +
                '</div>' +
            '</div>' +
            '<div class="ocr-subnav">' +
                '<button class="ocr-tab active" data-panel="overview" onclick="ocrSwitchPanel(\'overview\')">Overview</button>' +
                '<button class="ocr-tab" data-panel="pipeline" onclick="ocrSwitchPanel(\'pipeline\')">Pipeline</button>' +
                '<button class="ocr-tab" data-panel="documents" onclick="ocrSwitchPanel(\'documents\')">Documents</button>' +
            '</div>' +
            '<div class="ocr-panels">' +
                '<div id="ocrPanel-overview" class="ocr-panel active">' + overviewHtml() + '</div>' +
                '<div id="ocrPanel-pipeline" class="ocr-panel">' + pipelineHtml() + '</div>' +
                '<div id="ocrPanel-documents" class="ocr-panel">' + documentsHtml() + '</div>' +
            '</div>';

        built = true;
    }

    // ── Overview panel ───────────────────────────────────────────────────────
    function overviewHtml() {
        return '<div class="ocr-hero">' +
                '<span class="ocr-hero-logo">' + CUBE_SVG_OCR + '</span>' +
                '<h1 class="ocr-hero-title">OCR Pipeline</h1>' +
                '<p class="ocr-hero-tag">Upload any PDF or image. Extract Markdown, review raw text, and export documented output.</p>' +
            '</div>' +
            '<div class="ocr-stats" id="ocrStats">' +
                '<div class="ocr-stat"><div class="ocr-stat-num">–</div><div class="ocr-stat-label">Documents</div></div>' +
                '<div class="ocr-stat"><div class="ocr-stat-num">–</div><div class="ocr-stat-label">Successful OCR</div></div>' +
                '<div class="ocr-stat"><div class="ocr-stat-num">–</div><div class="ocr-stat-label">Markdown Outputs</div></div>' +
            '</div>' +
            '<div class="ocr-cta">' +
                '<button class="btn btn-primary" onclick="ocrSwitchPanel(\'pipeline\')">' +
                    '<i class="fas fa-upload"></i> Upload & Process</button>' +
                '<button class="btn" onclick="ocrSwitchPanel(\'documents\')">' +
                    '<i class="fas fa-folder-open"></i> View Documents</button>' +
            '</div>';
    }

    // ── Pipeline panel ───────────────────────────────────────────────────────
    function pipelineHtml() {
        return '<div class="ocr-pipeline">' +
                '<div class="ocr-upload-area" id="ocrUploadArea">' +
                    '<i class="fas fa-cloud-upload-alt"></i>' +
                    '<p>Drop PDF or images here, or click to upload</p>' +
                    '<input type="file" id="ocrFileInput" accept="image/*,.pdf" multiple style="display:none" onchange="ocrHandleFiles(this.files)">' +
                '</div>' +
                '<div class="ocr-pipeline-controls">' +
                    '<button class="btn btn-primary" id="ocrRunBtn" onclick="ocrRunPipeline()" disabled>' +
                        '<i class="fas fa-play"></i> Run Pipeline</button>' +
                    '<span class="ocr-status" id="ocrPipelineStatus">Ready</span>' +
                '</div>' +
                '<div class="ocr-results" id="ocrResults">' +
                    '<div class="ocr-empty">Upload documents and run the pipeline to extract Markdown.</div>' +
                '</div>' +
            '</div>';
    }

    // ── Documents panel ──────────────────────────────────────────────────────
    function documentsHtml() {
        return '<div class="ocr-documents-panel">' +
                '<div class="ocr-documents-grid" id="ocrDocuments">' +
                    '<div class="ocr-empty"><i class="fas fa-file"></i> Loading documents…</div>' +
                '</div>' +
            '</div>';
    }

    // ── Tab switching ────────────────────────────────────────────────────────
    window.ocrSwitchPanel = function (name) {
        activePanel = name;
        ['overview', 'pipeline', 'documents'].forEach(function (p) {
            var panel = document.getElementById('ocrPanel-' + p);
            if (panel) panel.classList.toggle('active', p === name);
        });
        var tabs = document.querySelectorAll('#ocrView .ocr-tab');
        tabs.forEach(function (t) {
            t.classList.toggle('active', t.getAttribute('data-panel') === name);
        });
        if (name === 'overview') ocrLoadStats();
        else if (name === 'pipeline') ocrRefreshPipeline();
        else if (name === 'documents') ocrLoadDocuments();
    };

    // ── Pipeline handling ────────────────────────────────────────────────────
    window.ocrHandleFiles = function (files) {
        var area = document.getElementById('ocrUploadArea');
        if (!area) return;
        var names = Array.from(files).map(function (f) { return f.name; }).join(', ');
        area.innerHTML = '<p>' + esc(names) + ' (' + files.length + ' files)</p>';
        area.dataset.hasFiles = 'true';
        document.getElementById('ocrRunBtn').disabled = false;
        currentFiles = files;
    };

    function setupUploadDrag() {
        var area = document.getElementById('ocrUploadArea');
        if (!area) return;
        area.addEventListener('dragover', function (e) {
            e.preventDefault();
            area.classList.add('ocr-dragover');
        });
        area.addEventListener('dragleave', function () {
            area.classList.remove('ocr-dragover');
        });
        area.addEventListener('drop', function (e) {
            e.preventDefault();
            area.classList.remove('ocr-dragover');
            ocrHandleFiles(e.dataTransfer.files);
        });
        area.addEventListener('click', function () {
            document.getElementById('ocrFileInput').click();
        });
    }

    window.ocrRunPipeline = function () {
        if (!currentFiles || currentFiles.length === 0) return;
        var statusEl = document.getElementById('ocrPipelineStatus');
        var runBtn = document.getElementById('ocrRunBtn');
        if (statusEl) statusEl.textContent = 'Uploading & running...';
        if (runBtn) runBtn.disabled = true;

        var formData = new FormData();
        formData.append('project_id', projectId());
        for (var i = 0; i < currentFiles.length; i++) {
            formData.append('files', currentFiles[i]);
        }

        fetch(apiBase() + OCR_API.upload, { method: 'POST', body: formData })
            .then(function (res) {
                if (!res.ok) throw new Error('Upload failed');
                return res.json();
            })
            .then(function (uploadData) {
                if (statusEl) statusEl.textContent = 'Running OCR pipeline...';
                return fetch(apiBase() + OCR_API.run, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ upload_id: uploadData.upload_id, project_id: projectId() })
                });
            })
            .then(function (res) {
                if (!res.ok) throw new Error('Pipeline failed');
                return res.json();
            })
            .then(function (pipelineResult) {
                if (statusEl) statusEl.textContent = 'Completed';
                ocrLoadResults(pipelineResult);
                ocrLoadStats();
                ocrLoadDocuments();
            })
            .catch(function (err) {
                if (statusEl) statusEl.textContent = 'Error: ' + esc(err.message);
                if (runBtn) runBtn.disabled = false;
            });
    };

    function ocrLoadResults(data) {
        var container = document.getElementById('ocrResults');
        if (!container) return;
        if (!data || data.status !== 'completed') {
            container.innerHTML = '<div class="ocr-empty">Pipeline did not complete successfully.</div>';
            return;
        }
        var summary = data.summary || {};
        var fs = summary.file_statistics || data.file_statistics || {};
        var html = '<div class="ocr-result-summary">';
        html += '<h3>Pipeline Summary</h3>';
        html += '<p>Processed: ' + (fs.total_files != null ? fs.total_files : (fs.total_images != null ? fs.total_images : '?')) + ' files</p>';
        html += '<p>Successful OCR: ' + (fs.successful_ocr != null ? fs.successful_ocr : '?') + '</p>';
        if (data.workspace) {
            html += '<p class="ocr-result-workspace"><i class="fas fa-folder-open"></i> Workspace: <code>' + esc(data.workspace) + '</code></p>';
        }
        html += '</div>';
        container.innerHTML = html;
        document.getElementById('ocrRunBtn').disabled = false;
    }

    window.ocrRefreshPipeline = function () {
        var area = document.getElementById('ocrUploadArea');
        if (area && !area.dataset.hasFiles) {
            area.innerHTML = '<i class="fas fa-cloud-upload-alt"></i><p>Drop PDF or images here, or click to upload</p>';
        }
    };

    // ── Documents panel ──────────────────────────────────────────────────────
    window.ocrLoadDocuments = function () {
        var container = document.getElementById('ocrDocuments');
        if (!container) return;
        container.innerHTML = '<div class="ocr-empty"><i class="fas fa-spinner fa-pulse"></i> Loading documents…</div>';
        var q = projectId() ? ('?project_id=' + encodeURIComponent(projectId())) : '';
        fetch(apiBase() + OCR_API.documents + q)
            .then(function (res) {
                if (!res.ok) throw new Error('Failed to load documents');
                return res.json();
            })
            .then(function (data) {
                var docs = data.documents || [];
                if (!docs.length) {
                    container.innerHTML = '<div class="ocr-empty"><i class="fas fa-file"></i> No documents yet. Upload files in the Pipeline tab.</div>';
                    return;
                }
                currentDocs = {};
                var html = '';
                docs.forEach(function (doc) {
                    var docId = doc.id || doc.filename;
                    currentDocs[docId] = doc;
                    var statusClass = doc.ocr_success ? 'ocr-doc-ok' : 'ocr-doc-pending';
                    var statusIcon = doc.ocr_success ? 'fa-check-circle' : 'fa-clock';
                    var statusText = doc.ocr_success ? 'OCR complete' : 'Pending';

                    html += '<div class="ocr-doc-card ' + statusClass + '">';
                    html += '<div class="ocr-doc-card-header">';
                    if (doc.image_url) {
                        html += '<div class="ocr-doc-thumb-wrap">';
                        html += '<div class="ocr-doc-thumb' + (doc.kind === 'pdf' ? ' ocr-doc-thumb-pdf' : '') + '" onclick="ocrZoom(this.nextElementSibling)" title="Click to view details">';
                        if (doc.kind === 'pdf') {
                            html += '<iframe src="' + esc(doc.image_url) + '" loading="lazy" class="ocr-doc-pdf-frame" title="' + esc(doc.filename) + '"></iframe>';
                        } else {
                            html += '<img src="' + esc(doc.image_url) + '" alt="' + esc(doc.filename) + '" loading="lazy">';
                        }
                        html += '</div>';
                        html += '<button class="ocr-doc-zoom" data-docid="' + esc(docId) + '" data-url="' + esc(doc.image_url) + '" data-title="' + esc(doc.filename) + '" data-kind="' + esc(doc.kind) + '" onclick="ocrZoom(this)" title="View Details"><i class="fas fa-expand"></i></button>';
                        html += '</div>';
                    }
                    html += '<div class="ocr-doc-meta">';
                    html += '<div class="ocr-doc-filename" title="' + esc(doc.filename) + '">' + esc(doc.filename) + '</div>';
                    html += '<div class="ocr-doc-status"><i class="fas ' + statusIcon + '"></i> ' + statusText + '</div>';
                    if (doc.uploaded_at) {
                        html += '<div class="ocr-doc-date">' + esc(doc.uploaded_at) + '</div>';
                    }
                    html += '</div>';
                    html += '</div>';
                    html += '</div>';
                });
                container.innerHTML = html;
            })
            .catch(function (err) {
                container.innerHTML = '<div class="ocr-empty ocr-error">' + esc(err.message) + '</div>';
            });
    };

    // ── Image modal / lightbox ────────────────────────────────────────────────
    function ensureModal() {
        var modal = document.getElementById('ocrImageModal');
        if (modal) return modal;
        modal = document.createElement('div');
        modal.id = 'ocrImageModal';
        modal.className = 'ocr-modal-overlay';
        modal.innerHTML =
            '<div class="ocr-modal" role="dialog" aria-modal="true" aria-label="Document view">' +
                '<div class="ocr-modal-head">' +
                    '<span class="ocr-modal-title"></span>' +
                    '<div class="ocr-modal-head-actions">' +
                        '<a class="ocr-modal-openlink" id="ocrModalOpenLink" target="_blank" rel="noopener" title="Open in new tab"><i class="fas fa-external-link-alt"></i></a>' +
                        '<button class="ocr-modal-close" title="Close (Esc)"><i class="fas fa-times"></i></button>' +
                    '</div>' +
                '</div>' +
                '<div class="ocr-modal-body"></div>' +
            '</div>';
        document.body.appendChild(modal);
        modal.addEventListener('click', function (e) {
            if (e.target === modal) window.ocrCloseImage();
        });
        modal.querySelector('.ocr-modal-close').addEventListener('click', function () { window.ocrCloseImage(); });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') window.ocrCloseImage();
        });
        return modal;
    }

    window.ocrZoom = function (el) {
        if (!el) return;
        var docId = el.getAttribute('data-docid');
        if (docId && currentDocs[docId]) {
            ocrViewDocument(currentDocs[docId]);
        } else {
            ocrViewImage(
                el.getAttribute('data-url'),
                el.getAttribute('data-title') || 'Document',
                el.getAttribute('data-kind') || 'image'
            );
        }
    };

    window.ocrViewImage = function (url, title, kind) {
        if (!url) return;
        var modal = ensureModal();
        var body = modal.querySelector('.ocr-modal-body');
        if (kind === 'pdf') {
            body.innerHTML = '<iframe src="' + esc(url) + '" class="ocr-modal-frame" title="' + esc(title) + '"></iframe>';
        } else {
            body.innerHTML = '<img src="' + esc(url) + '" alt="' + esc(title) + '" class="ocr-modal-img">';
        }
        modal.querySelector('.ocr-modal-title').textContent = title || 'Document';
        modal.querySelector('#ocrModalOpenLink').setAttribute('href', url);
        modal.classList.add('show');
        document.body.classList.add('ocr-modal-lock');
    };

    window.ocrViewDocument = function (doc) {
        var modal = ensureModal();
        var body = modal.querySelector('.ocr-modal-body');

        var html = '<div class="ocr-doc-viewer">';
        html += '<div class="ocr-doc-viewer-tabs">';
        html += '<button class="ocr-doc-tab active" onclick="ocrSwitchTab(this, \'image\')"><i class="fas fa-image"></i> Image</button>';
        if (doc.text) html += '<button class="ocr-doc-tab" onclick="ocrSwitchTab(this, \'raw\')"><i class="fas fa-align-left"></i> Raw Text</button>';
        if (doc.text_md) html += '<button class="ocr-doc-tab" onclick="ocrSwitchTab(this, \'md\')"><i class="fab fa-markdown"></i> Markdown</button>';
        if (doc.text_md && (doc.image_url || doc.kind === 'pdf')) html += '<button class="ocr-doc-tab" onclick="ocrSwitchTab(this, \'split\')"><i class="fas fa-columns"></i> Side-by-Side</button>';
        html += '</div>';

        html += '<div class="ocr-doc-viewer-content">';

        // Image pane
        html += '<div class="ocr-doc-pane active" data-pane="image">';
        if (doc.kind === 'pdf') {
            html += '<iframe src="' + esc(doc.image_url) + '" class="ocr-modal-frame" title="' + esc(doc.filename) + '"></iframe>';
        } else if (doc.image_url) {
            html += '<img src="' + esc(doc.image_url) + '" alt="' + esc(doc.filename) + '" class="ocr-modal-img">';
        }
        html += '</div>';

        // Raw text pane
        if (doc.text) {
            html += '<div class="ocr-doc-pane" data-pane="raw"><pre class="ocr-doc-raw">' + esc(doc.text) + '</pre></div>';
        }

        // Markdown pane
        if (doc.text_md) {
            html += '<div class="ocr-doc-pane" data-pane="md"><div class="ocr-md ocr-doc-md">' + renderMd(doc.text_md) + '</div></div>';
        }

        // Side-by-side pane
        if (doc.text_md && (doc.image_url || doc.kind === 'pdf')) {
            html += '<div class="ocr-doc-pane ocr-doc-pane-split" data-pane="split">';
            html += '<div class="ocr-split-left">';
            if (doc.kind === 'pdf') {
                html += '<iframe src="' + esc(doc.image_url) + '" class="ocr-modal-frame" title="' + esc(doc.filename) + '"></iframe>';
            } else {
                html += '<img src="' + esc(doc.image_url) + '" alt="' + esc(doc.filename) + '" class="ocr-modal-img" onload="ocrSyncSplitPane(this)">';
            }
            html += '</div>';
            html += '<div class="ocr-split-right"><div class="ocr-split-page"><div class="ocr-md ocr-doc-md">' + renderMd(doc.text_md) + '</div></div></div>';
            html += '</div>';
        }

        html += '</div></div>';

        body.innerHTML = html;
        modal.querySelector('.ocr-modal-title').textContent = doc.filename || 'Document View';
        modal.querySelector('#ocrModalOpenLink').setAttribute('href', doc.image_url || '#');
        modal.classList.add('show', 'ocr-modal-large');
        document.body.classList.add('ocr-modal-lock');
    };

    window.ocrSyncSplitPane = function (img) {
        try {
            var pane = img.closest('.ocr-doc-pane-split');
            if (!pane || !img.naturalWidth || !img.naturalHeight) return;
            pane.style.setProperty('--ocr-split-ratio', (img.naturalWidth / img.naturalHeight).toFixed(4));
        } catch (_e) { /* noop */ }
    };

    window.ocrSwitchTab = function (btn, paneName) {
        var viewer = btn.closest('.ocr-doc-viewer');
        if (!viewer) return;

        viewer.querySelectorAll('.ocr-doc-tab').forEach(function (t) { t.classList.remove('active'); });
        btn.classList.add('active');

        viewer.querySelectorAll('.ocr-doc-pane').forEach(function (p) {
            p.classList.toggle('active', p.getAttribute('data-pane') === paneName);
        });

        if (paneName === 'split') {
            var img = viewer.querySelector('.ocr-doc-pane-split .ocr-split-left img');
            if (img && img.complete) ocrSyncSplitPane(img);
        }
    };

    window.ocrCloseImage = function () {
        var modal = document.getElementById('ocrImageModal');
        if (!modal) return;
        modal.classList.remove('show', 'ocr-modal-large');
        document.body.classList.remove('ocr-modal-lock');
    };

    // ── Overview stats ───────────────────────────────────────────────────────
    window.ocrLoadStats = function () {
        var q = projectId() ? ('?project_id=' + encodeURIComponent(projectId())) : '';
        fetch(apiBase() + OCR_API.status + q)
            .then(function (res) {
                if (!res.ok) throw new Error('Could not load stats');
                return res.json();
            })
            .then(function (data) {
                var stats = document.getElementById('ocrStats');
                if (!stats) return;
                var nums = stats.querySelectorAll('.ocr-stat-num');
                if (nums.length >= 3) {
                    nums[0].textContent = data.document_count || data.total_documents || '0';
                    nums[1].textContent = data.successful_ocr || data.ocr_success_count || '0';
                    nums[2].textContent = data.markdown_count || data.md_count || '0';
                }
            })
            .catch(function () {
                var stats = document.getElementById('ocrStats');
                if (stats) {
                    stats.querySelectorAll('.ocr-stat-num').forEach(function (n) { n.textContent = '–'; });
                }
            });
    };

    // ── Lifecycle: show / hide the view ──────────────────────────────────────
    var SIBLING_HIDE = ['procurementHideView', 'violationsHideView', 'lawLibHideView',
        'masterIndexHideView', 'legalRouterHideView', 'spacesHideView', 'listeningHideView',
        'studioHideView', 'descobertaHideView', 'memoryHideView', 'shadersHideView',
        'architectureHideView', 'craudioHideView', 'writerHideView', 'driveHideView',
        'healthHideView'];
    var CHAT_IDS = ['chatHeader', 'welcomeState', 'chatLog', 'chatCompose', 'chatToolbar'];

    window.ocrShowView = function () {
        build();
        CHAT_IDS.forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
        var mc = document.querySelector('.main-content');
        if (mc) {
            mc._ocrDisplay = mc.style.display;
            mc.style.display = 'none';
        }
        SIBLING_HIDE.forEach(function (fn) {
            try { if (typeof window[fn] === 'function') window[fn](); } catch (_e) { }
        });
        var v = document.getElementById('ocrView');
        if (v) v.classList.add('active');
        var ws = document.querySelector('.workspace');
        if (ws) ws.classList.add('ocr-open');
        ocrLoadStats();
        setupUploadDrag();
    };

    window.ocrHideView = function () {
        var v = document.getElementById('ocrView');
        if (v) v.classList.remove('active');
        var ws = document.querySelector('.workspace');
        if (ws) ws.classList.remove('ocr-open');
        var mc = document.querySelector('.main-content');
        if (mc) {
            mc.style.display = mc._ocrDisplay !== undefined ? mc._ocrDisplay : '';
            delete mc._ocrDisplay;
        }
        CHAT_IDS.forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.style.display = '';
        });
    };

    // Auto-close when other plugins open
    function wrapSiblings() {
        var names = ['procurementShowView', 'violationsShowView', 'lawLibShowView',
            'masterIndexShowView', 'legalRouterShowView', 'spacesShowView', 'listeningShowView',
            'studioShowView', 'descobertaShowView', 'memoryShowView', 'shadersShowView',
            'architectureShowView', 'craudioShowView', 'writerShowView', 'resetToWelcome',
            'aexToggleMain', 'driveShowView', 'healthShowView'];
        names.forEach(function (n) {
            var orig = window[n];
            if (typeof orig !== 'function' || orig._ocrWrapped) return;
            var wrapped = function () {
                try { window.ocrHideView(); } catch (_e) { }
                return orig.apply(this, arguments);
            };
            wrapped._ocrWrapped = true;
            window[n] = wrapped;
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', wrapSiblings);
    } else {
        wrapSiblings();
    }
})();