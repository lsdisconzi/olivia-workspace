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
        profiles: '/api/ocr/profiles',
        finalize: '/api/ocr/finalize',
    };

    // Cube SVG with generic blue accent
    var CUBE_SVG_OCR = '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><polygon points="20,30 50,15 80,30 80,70 50,85 20,70" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/><line x1="50" y1="15" x2="50" y2="85" stroke="currentColor" stroke-width="5"/><line x1="20" y1="70" x2="80" y2="30" stroke="currentColor" stroke-width="5"/></svg>';

    // ── Internal state ───────────────────────────────────────────────────────
    var built = false;
    var activePanel = 'overview';
    var currentFiles = null;
    var currentDocs = {};
    var currentProfiles = {};

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
        if (!view) return;
        // Rebuild if a host re-render wiped the view's content since the last
        // build (guards against handlers referencing elements that no longer
        // exist, e.g. #ocrFileInput in setupUploadDrag).
        if (built && view.innerHTML.trim().length > 0) return;

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
                '<button class="ocr-tab" data-panel="profiles" onclick="ocrSwitchPanel(\'profiles\')">Profiles</button>' +
            '</div>' +
            '<div class="ocr-panels">' +
                '<div id="ocrPanel-overview" class="ocr-panel active">' + overviewHtml() + '</div>' +
                '<div id="ocrPanel-pipeline" class="ocr-panel">' + pipelineHtml() + '</div>' +
                '<div id="ocrPanel-documents" class="ocr-panel">' + documentsHtml() + '</div>' +
                '<div id="ocrPanel-profiles" class="ocr-panel">' + profilesHtml() + '</div>' +
            '</div>';

        built = true;
        ocrLoadModelCatalog();
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
                '<div class="ocr-stat"><div class="ocr-stat-num">–</div><div class="ocr-stat-label">LLM Analyses</div></div>' +
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
                    '<label class="ocr-llm-toggle" title="Extract structured LinkedIn profile data with an LLM, then merge pages into clean per-person profiles (needs DEEPSEEK_API_KEY on the server)">' +
                        '<input type="checkbox" id="ocrEnableLlm" onchange="ocrToggleLlmModel(this.checked)" checked> LLM analysis + refinement' +
                    '</label>' +
                    '<label class="ocr-model-wrap" title="AI model used for the LLM analysis + refinement step. Same catalog as the main Settings > Models section.">' +
                        '<span class="ocr-model-label">AI Model</span>' +
                        '<select class="ocr-model-select" id="ocrLlmModel">' +
                            '<option value="">Loading models…</option>' +
                        '</select>' +
                    '</label>' +
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

    // ── Profiles panel ───────────────────────────────────────────────────────
    function profilesHtml() {
        return '<div class="ocr-profiles-panel">' +
                '<div class="ocr-profiles-head">' +
                    '<h3 class="ocr-profiles-title"><i class="fas fa-users"></i> Merged Profiles</h3>' +
                    '<button class="btn btn-primary btn-sm" id="ocrFinalizeBtn" onclick="ocrFinalizeProfiles()">' +
                        '<i class="fas fa-object-group"></i> Merge Pages &rarr; Profiles</button>' +
                '</div>' +
                '<div class="ocr-status" id="ocrProfilesStatus"></div>' +
                '<div class="ocr-profiles-grid" id="ocrProfiles">' +
                    '<div class="ocr-empty"><i class="fas fa-users"></i> No profiles yet. Run the pipeline, then merge pages into per-person profiles.</div>' +
                '</div>' +
            '</div>';
    }

    // ── Tab switching ────────────────────────────────────────────────────────
    window.ocrSwitchPanel = function (name) {
        activePanel = name;
        ['overview', 'pipeline', 'documents', 'profiles'].forEach(function (p) {
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
        else if (name === 'profiles') ocrLoadProfiles();
    };

    // ── Pipeline handling ────────────────────────────────────────────────────
    window.ocrHandleFiles = function (files) {
        var area = document.getElementById('ocrUploadArea');
        if (!area) return;
        var names = Array.from(files).map(function (f) { return f.name; }).join(', ');
        area.innerHTML = '<p>' + esc(names) + ' (' + files.length + ' files)</p>';
        area.dataset.hasFiles = 'true';
        var runBtn = document.getElementById('ocrRunBtn');
        if (runBtn) runBtn.disabled = false;
        currentFiles = files;
    };

    function setupUploadDrag() {
        var area = document.getElementById('ocrUploadArea');
        if (!area || area.dataset.ocrBound) return;
        area.dataset.ocrBound = '1';
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
            var input = document.getElementById('ocrFileInput');
            if (input) input.click();
        });
    }

    window.ocrRunPipeline = function () {
        if (!currentFiles || currentFiles.length === 0) return;
        var statusEl = document.getElementById('ocrPipelineStatus');
        var runBtn = document.getElementById('ocrRunBtn');
        var llmToggle = document.getElementById('ocrEnableLlm');
        var useLlm = !!(llmToggle && llmToggle.checked);
        if (statusEl) statusEl.textContent = useLlm ? 'Uploading & running (LLM analysis on)...' : 'Uploading & running...';
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
                if (statusEl) statusEl.textContent = useLlm ? 'Running OCR + LLM analysis...' : 'Running OCR pipeline...';
                var runBody = { upload_id: uploadData.upload_id, project_id: projectId() };
                if (useLlm) {
                    var sel = document.getElementById('ocrLlmModel');
                    var modelId = sel && sel.value ? sel.value : '';
                    var modelInfo = ocrCatalogModel(modelId);
                    // Provider follows the selected model's catalog provider so
                    // any catalog model is usable; defaults to deepseek (the
                    // pipeline's LLM path uses DEEPSEEK_API_KEY by default).
                    runBody.llm_provider = (modelInfo && modelInfo.provider) || 'deepseek';
                    if (modelId) runBody.llm_model = modelId;
                }
                return fetch(apiBase() + OCR_API.run, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(runBody)
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
        var analysisCount = fs.successful_analyses != null ? fs.successful_analyses
            : (data.analysis_count != null ? data.analysis_count : null);
        if (analysisCount != null) {
            html += '<p><i class="fas fa-magic"></i> LLM analyses: ' + analysisCount + '</p>';
        }
        var profilesMerged = fs.profiles_merged != null ? fs.profiles_merged
            : (data.profiles_merged != null ? data.profiles_merged : 0);
        if (profilesMerged > 0) {
            html += '<p><i class="fas fa-users"></i> LLM profiles merged: ' + profilesMerged + '</p>';
        }
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
        // Repopulate the model select if it is still in its loading state.
        var sel = document.getElementById('ocrLlmModel');
        if (sel && (!sel.options.length || sel.options[0].value === '' && sel.options[0].textContent === 'Loading models…')) {
            ocrLoadModelCatalog();
        }
    };

    // ── AI model selector (same catalog as Settings > Models) ──────────────
    window._ocrModelCatalog = null;

    // Providers the OCR pipeline's LLMAnalyzer can actually call.
    var OCR_LLM_PROVIDERS = ['deepseek', 'ollama', 'openai'];

    // Look up a catalog entry by model id (flat search across all providers).
    function ocrCatalogModel(modelId) {
        if (!modelId || !window._ocrModelCatalog) return null;
        for (var provider in window._ocrModelCatalog) {
            var models = window._ocrModelCatalog[provider];
            if (!Array.isArray(models)) continue;
            for (var i = 0; i < models.length; i++) {
                if (String(models[i].id || models[i].name || '') === String(modelId)) {
                    return models[i];
                }
            }
        }
        return null;
    }

    // Load the shared model catalog (/api/models/catalog — the same endpoint
    // the sidebar Settings > Models section uses) and fill #ocrLlmModel.
    function ocrLoadModelCatalog() {
        var sel = document.getElementById('ocrLlmModel');
        if (!sel) return;
        fetch(apiBase() + '/api/models/catalog')
            .then(function (res) {
                if (!res.ok) throw new Error('Catalog unavailable');
                return res.json();
            })
            .then(function (data) {
                var rawModels = data.models || data.catalog ||
                    (Array.isArray(data) ? data : null);
                if (!rawModels) throw new Error('Catalog empty');
                var catalog = {};
                if (Array.isArray(rawModels)) {
                    rawModels.forEach(function (m) {
                        var prov = m.provider || 'other';
                        if (!catalog[prov]) catalog[prov] = [];
                        catalog[prov].push(m);
                    });
                } else {
                    catalog = rawModels;
                }
                // Keep the full catalog for lookups, but only offer models the
                // OCR pipeline's LLMAnalyzer supports (deepseek/ollama/openai).
                window._ocrModelCatalog = catalog;

                var currentValue = sel.value;
                sel.innerHTML = '';
                var defaultOpt = document.createElement('option');
                defaultOpt.value = '';
                defaultOpt.textContent = 'Default (env LLM_MODEL)';
                sel.appendChild(defaultOpt);

                var supported = Object.keys(catalog).filter(function (provider) {
                    return OCR_LLM_PROVIDERS.indexOf(provider) !== -1;
                });
                supported.forEach(function (provider) {
                    var models = catalog[provider];
                    if (!Array.isArray(models) || !models.length) return;
                    var group = document.createElement('optgroup');
                    group.label = provider;
                    models.forEach(function (m) {
                        var option = document.createElement('option');
                        option.value = m.id || m.name || '';
                        option.textContent = m.name || m.id;
                        group.appendChild(option);
                    });
                    sel.appendChild(group);
                });
                if (sel.options.length <= 1) {
                    sel.innerHTML = '<option value="">No supported models in catalog</option>';
                    sel.disabled = true;
                    return;
                }

                // Prefer the sidebar's current model when it exists in the
                // catalog; otherwise keep any previously chosen value.
                var fallback = currentValue || data.current_model || '';
                if (fallback && ocrCatalogModel(fallback)) {
                    sel.value = fallback;
                } else if (fallback) {
                    // Keep an explicit user choice even if it is not catalogued.
                    sel.value = fallback;
                }
                var llmToggle = document.getElementById('ocrEnableLlm');
                sel.disabled = !(llmToggle && llmToggle.checked);
            })
            .catch(function (err) {
                sel.innerHTML = '<option value="">Models unavailable</option>';
                console.log('OCR: failed to load model catalog:', err.message);
            });
    }

    // Keep the model selector enabled only while LLM analysis is on.
    window.ocrToggleLlmModel = function (checked) {
        var sel = document.getElementById('ocrLlmModel');
        if (sel) sel.disabled = !checked;
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

    // ── LLM analysis rendering ─────────────────────────────────────────────
    // Renders the structured profile fields produced by the LLM analysis step
    // (see ocr_profile_analytics.py) as Markdown.
    function renderAnalysis(a) {
        if (!a || a.error) return '<p class="ocr-empty">No structured analysis for this document.</p>';
        var meta = a.profile_metadata || {};
        var md = '';
        if (meta.person_name) md += '**' + meta.person_name + '**\n\n';
        if (meta.headline) md += meta.headline + '\n\n';
        var contact = [];
        if (meta.location) contact.push(meta.location);
        if (meta.linkedin_url) contact.push(meta.linkedin_url);
        if (Array.isArray(a.contact_info)) contact = contact.concat(a.contact_info.filter(Boolean));
        if (contact.length) md += '**Contact:** ' + contact.join(' · ') + '\n\n';
        if (Array.isArray(a.top_skills) && a.top_skills.length) md += '**Top Skills:** ' + a.top_skills.join(', ') + '\n\n';
        if (Array.isArray(a.languages) && a.languages.length) md += '**Languages:** ' + a.languages.join(', ') + '\n\n';
        if (a.summary) md += '**Summary**\n\n' + a.summary + '\n\n';
        if (Array.isArray(a.experience) && a.experience.length) {
            md += '**Experience**\n\n';
            a.experience.forEach(function (e) {
                var line = '**' + (e.title || '—') + '**';
                if (e.company) line += ' · ' + e.company;
                if (e.period) line += ' (' + e.period + ')';
                md += '- ' + line + '\n';
                if (e.description) md += '  ' + String(e.description).split('\n').join('\n  ') + '\n';
            });
            md += '\n';
        }
        if (Array.isArray(a.education) && a.education.length) {
            md += '**Education**\n\n';
            a.education.forEach(function (e) {
                var parts = [];
                if (e.degree) parts.push('**' + e.degree + '**');
                if (e.institution) parts.push(e.institution);
                if (e.period) parts.push('(' + e.period + ')');
                if (parts.length) md += '- ' + parts.join(' · ') + '\n';
            });
            md += '\n';
        }
        if (Array.isArray(a.certifications) && a.certifications.length) {
            md += '**Certifications**\n\n' + a.certifications.map(function (c) { return '- ' + c; }).join('\n') + '\n\n';
        }
        if (a.llm_analysis_metadata) {
            var lam = a.llm_analysis_metadata;
            var conf = (meta.name_confidence != null) ? ' · conf ' + meta.name_confidence : '';
            md += '---\n\n<small>LLM: ' + (lam.model || '') + ' · ' + (lam.provider || '') + conf + '</small>\n';
        }
        return md;
    }

    window.ocrViewDocument = function (doc) {
        var modal = ensureModal();
        var body = modal.querySelector('.ocr-modal-body');

        var analysisForView = (doc.analysis && !doc.analysis.error) ? doc.analysis : (doc.analysis_refined && !doc.analysis_refined.error ? doc.analysis_refined : null);
        var hasAnalysis = !!(analysisForView && analysisForView.profile_metadata);

        var html = '<div class="ocr-doc-viewer">';
        html += '<div class="ocr-doc-viewer-tabs">';
        html += '<button class="ocr-doc-tab active" onclick="ocrSwitchTab(this, \'image\')"><i class="fas fa-image"></i> Image</button>';
        if (doc.text) html += '<button class="ocr-doc-tab" onclick="ocrSwitchTab(this, \'raw\')"><i class="fas fa-align-left"></i> Raw Text</button>';
        if (doc.text_md) html += '<button class="ocr-doc-tab" onclick="ocrSwitchTab(this, \'md\')"><i class="fab fa-markdown"></i> Markdown</button>';
        if (hasAnalysis) html += '<button class="ocr-doc-tab" onclick="ocrSwitchTab(this, \'analysis\')"><i class="fas fa-address-card"></i> Analysis</button>';
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

        // LLM analysis pane (structured profile fields extracted by the model)
        if (hasAnalysis) {
            html += '<div class="ocr-doc-pane" data-pane="analysis"><div class="ocr-md ocr-doc-md">' + renderMd(renderAnalysis(analysisForView)) + '</div></div>';
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
                if (nums.length >= 4) {
                    nums[0].textContent = data.document_count || data.total_documents || '0';
                    nums[1].textContent = data.successful_ocr || data.ocr_success_count || '0';
                    nums[2].textContent = data.markdown_count || data.md_count || '0';
                    nums[3].textContent = data.analysis_count != null ? data.analysis_count : (data.llm_analysis_count != null ? data.llm_analysis_count : '0');
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

    // ── Merged per-person profiles (final pipeline step) ─────────────────────
    // Ported from _01_olivia-review-branch/ocr-pipeline/improvement-step.md.
    // Review fixes applied:
    //  * newlines are preserved — the original global /\s+/ collapse destroyed
    //    the line structure the Experience parser relies on;
    //  * page number comes from the filename, since single-image extractions
    //    carry no page_number field in their JSON.

    function ocrPersonBase(filename) {
        var name = String(filename || '');
        // The upload flow appends a 6-hex upload-id tail to colliding
        // filenames (e.g. "Juliana-Rios-7b355d-1.png"). Strip it together with
        // the trailing page marker, then each on its own.
        name = name.replace(/[-_](?=[0-9a-f]{6})[0-9a-f]*[a-f][0-9a-f]*[-_]\d+(\.\w+)$/i, '$1');
        name = name.replace(/[-_](?=[0-9a-f]{6})[0-9a-f]*[a-f][0-9a-f]*(\.\w+)$/i, '$1');
        // Strip a trailing page marker like "-1.jpg" / "_2.png".
        name = name.replace(/[-_]\d+(\.\w+)$/, '$1');
        // Remove the remaining extension for a clean base name.
        return name.replace(/\.[a-zA-Z0-9]+$/, '');
    }

    function ocrPersonDisplay(base) {
        return String(base || '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Unknown';
    }

    function ocrPageNumber(filename) {
        var m = String(filename || '').match(/(?:^|[_-])(\d+)\.\w+$/);
        return m ? parseInt(m[1], 10) : 1;
    }

    window.mergePagesIntoMarkdown = function (pageDataArray, personName) {
        var sortedPages = pageDataArray.slice().sort(function (a, b) {
            var pa = (a.pages && a.pages[0] && a.pages[0].page_number) || a.page_number || 0;
            var pb = (b.pages && b.pages[0] && b.pages[0].page_number) || b.page_number || 0;
            return pa - pb;
        });

        // Combine the page text, preserving line structure for the parsers.
        // Pages whose text is blank (or only page markers) are skipped so they
        // cannot produce a title-only profile.
        var fullText = sortedPages.map(function (p) {
            var text = (p.pages && p.pages[0] && p.pages[0].text) || p.text || '';
            return String(text)
                .replace(/Page\s+\d+\s+of\s+\d+/gi, '')
                .replace(/[ \t]+/g, ' ')
                .replace(/[ \t]+\n/g, '\n')
                .trim();
        }).filter(function (t) { return t.length > 0; }).join('\n\n');

        // Identify the standard resume sections (heuristic, English headers).
        // Every lookahead stops at ALL other headers so one section cannot
        // swallow the next (e.g. Contact running through "Top Skills").
        var sections = { contact: '', summary: '', experience: '', education: '', skills: [], languages: [] };

        var contactMatch = fullText.match(/Contact\s+([\s\S]*?)(?=Top\s+Skills|Languages|Summary|Experience|Education|$)/);
        if (contactMatch) sections.contact = contactMatch[1].trim();

        var summaryMatch = fullText.match(/Summary\s+([\s\S]*?)(?=Top\s+Skills|Languages|Experience|Education|$)/);
        if (summaryMatch) sections.summary = summaryMatch[1].trim();

        var experienceMatch = fullText.match(/Experience\s+([\s\S]*?)(?=Languages|Summary|Education|$)/);
        if (experienceMatch) sections.experience = experienceMatch[1].trim();

        var educationMatch = fullText.match(/Education\s+([\s\S]*?)$/);
        if (educationMatch) sections.education = educationMatch[1].trim();

        var skillsMatch = fullText.match(/Top\s+Skills\s+([\s\S]*?)(?=Languages|Summary|Experience|Education|$)/);
        if (skillsMatch) sections.skills = skillsMatch[1].split(/\n+/).map(function (s) { return s.trim(); }).filter(Boolean);

        var languagesMatch = fullText.match(/Languages\s+([\s\S]*?)(?=Top\s+Skills|Summary|Experience|Education|$)/);
        if (languagesMatch) sections.languages = languagesMatch[1].split(/\n+/).map(function (s) { return s.trim(); }).filter(Boolean);

        // Format experience into bullet entries (best-effort).
        var periodRe = /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}\s*[-–—]\s*(?:Present|[A-Z][a-z]+\.?\s+\d{4})/i;
        var experienceLines = [];
        var currentJob = null;
        (sections.experience ? sections.experience.split(/\n+/) : []).forEach(function (line) {
            var l = line.trim();
            if (!l) return;
            if (periodRe.test(l) || /^[-*]\s*(?:Project|Senior|Lead|Principal|Head|Founder|Director|Manager|Analyst|Engineer|Developer)/i.test(l)) {
                if (currentJob) experienceLines.push(currentJob);
                currentJob = '- ' + l;
            } else if (currentJob) {
                currentJob += '\n  ' + l;
            } else {
                experienceLines.push('- ' + l);
            }
        });
        if (currentJob) experienceLines.push(currentJob);
        if (!experienceLines.length && sections.experience) experienceLines.push('- ' + sections.experience);
        var experienceMd = experienceLines.join('\n');

        // Build the Markdown document.
        var md = '# ' + (personName || 'Perfil') + '\n\n';
        if (sections.contact) md += '## Contact\n\n' + sections.contact + '\n\n';
        if (sections.skills.length) md += '## Top Skills\n\n' + sections.skills.map(function (s) { return '- ' + s; }).join('\n') + '\n\n';
        if (sections.languages.length) md += '## Languages\n\n' + sections.languages.map(function (s) { return '- ' + s; }).join('\n') + '\n\n';
        if (sections.summary) md += '## Summary\n\n' + sections.summary + '\n\n';
        if (experienceMd) md += '## Experience\n\n' + experienceMd + '\n\n';
        if (sections.education) md += '## Education\n\n' + sections.education + '\n\n';
        return md.trim() + '\n';
    };

    window.ocrLoadProfiles = function () {
        var container = document.getElementById('ocrProfiles');
        if (!container) return;
        var status = document.getElementById('ocrProfilesStatus');
        container.innerHTML = '<div class="ocr-empty"><i class="fas fa-spinner fa-pulse"></i> Loading profiles…</div>';
        if (status) status.textContent = '';
        var q = projectId() ? ('?project_id=' + encodeURIComponent(projectId())) : '';
        fetch(apiBase() + OCR_API.profiles + q)
            .then(function (res) { if (!res.ok) throw new Error('Failed to load profiles'); return res.json(); })
            .then(function (data) {
                currentProfiles = {};
                var profiles = data.profiles || [];
                var pending = data.pending || [];
                profiles.forEach(function (p) { currentProfiles[p.person_name] = p; });
                if (status) status.textContent = profiles.length + ' profile(s) saved · ' + pending.length + ' person(s) ready to merge';
                if (!profiles.length) {
                    var hasMulti = pending.some(function (p) { return p.page_count > 1; });
                    container.innerHTML = '<div class="ocr-empty"><i class="fas fa-users"></i> No merged profiles yet.' +
                        (hasMulti ? ' Use "Merge Pages \u2192 Profiles" to combine multi-page documents.' : '') + '</div>';
                    return;
                }
                var html = '';
                profiles.forEach(function (profile) {
                    var pagesLabel = (profile.pages && profile.pages.length) ? profile.pages.length + ' page(s)' : '';
                    var srcBadge = (profile.source === 'llm')
                        ? '<span class="ocr-source-badge ocr-source-llm"><i class="fas fa-magic"></i> LLM</span>'
                        : '<span class="ocr-source-badge ocr-source-manual"><i class="fas fa-user-edit"></i> Manual</span>';
                    html += '<div class="ocr-doc-card">' +
                        '<div class="ocr-doc-card-header">' +
                            '<div class="ocr-doc-meta">' +
                                '<div class="ocr-doc-filename" title="' + esc(profile.person_name) + '">' + esc(profile.person_name) + '</div>' +
                                '<div class="ocr-doc-status ocr-doc-ok"><i class="fas fa-check-circle"></i> Merged profile ' + srcBadge + '</div>' +
                                '<div class="ocr-doc-date">' + esc(pagesLabel) + (profile.updated_at ? ' · ' + esc(profile.updated_at) : '') + '</div>' +
                            '</div>' +
                        '</div>' +
                        '<div class="ocr-doc-card-footer">' +
                            '<button class="btn btn-sm" data-person="' + esc(profile.person_name) + '" onclick="ocrViewProfile(this)"><i class="fas fa-eye"></i> View</button>' +
                        '</div>' +
                    '</div>';
                });
                container.innerHTML = html;
            })
            .catch(function (err) {
                container.innerHTML = '<div class="ocr-empty ocr-error">' + esc(err.message) + '</div>';
            });
    };

    window.ocrFinalizeProfiles = function () {
        var btn = document.getElementById('ocrFinalizeBtn');
        var status = document.getElementById('ocrProfilesStatus');
        if (btn) { btn.disabled = true; btn.textContent = 'Merging\u2026'; }
        if (status) status.textContent = 'Grouping documents and merging pages\u2026';
        var q = projectId() ? ('?project_id=' + encodeURIComponent(projectId())) : '';
        return fetch(apiBase() + OCR_API.documents + q)
            .then(function (res) { if (!res.ok) throw new Error('Failed to load documents'); return res.json(); })
            .then(function (data) {
                var docs = (data.documents || []).filter(function (d) {
                    return d.ocr_success && String(d.text || '').trim();
                });
                if (!docs.length) throw new Error('No successful OCR documents to merge');

                // Group by person (base filename without page marker or
                // upload-id tail). All page markers for one upload now land in
                // the same group.
                var groups = {};
                docs.forEach(function (doc) {
                    var base = ocrPersonBase(doc.filename);
                    (groups[base] = groups[base] || []).push(doc);
                });

                var jobs = Object.keys(groups).map(function (base) {
                    var group = groups[base];
                    var pageDataArray = group.map(function (doc) {
                        return { pages: [{ page_number: ocrPageNumber(doc.filename), text: doc.text }], filename: doc.filename };
                    }).filter(function (entry) {
                        // Skip pages whose text cleans to nothing (blank or
                        // just "Page N of M" markers) so we don't create a
                        // bare-title profile.
                        return String(entry.pages[0].text || '')
                            .replace(/Page\s+\d+\s+of\s+\d+/gi, '')
                            .trim().length > 0;
                    });
                    if (!pageDataArray.length) return null;
                    var markdown = window.mergePagesIntoMarkdown(pageDataArray, ocrPersonDisplay(base));
                    // A profile is only worth saving if it has at least one
                    // real section beyond the H1 title.
                    if (!markdown.replace(/^# [^\n]*\n?\s*$/, '').trim()) return null;
                    return fetch(apiBase() + OCR_API.finalize, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            project_id: projectId(),
                            person_name: ocrPersonDisplay(base),
                            markdown: markdown,
                            pages: group.map(function (d) { return d.filename; })
                        })
                    });
                }).filter(Boolean);
                if (!jobs.length) throw new Error('No documents with extractable text to merge');
                return Promise.all(jobs);
            })
            .then(function (responses) {
                for (var i = 0; i < responses.length; i++) {
                    if (!responses[i].ok) throw new Error('Finalize save failed for one profile');
                }
                return ocrLoadProfiles();
            })
            .then(function () {
                if (status) status.textContent = 'Profiles merged and saved.';
                if (btn) { btn.disabled = false; btn.textContent = 'Merge Pages \u2192 Profiles'; }
            })
            .catch(function (err) {
                if (status) status.textContent = 'Error: ' + err.message;
                if (btn) { btn.disabled = false; btn.textContent = 'Merge Pages \u2192 Profiles'; }
            });
    };

    window.ocrViewProfile = function (el) {
        var personName = el.getAttribute('data-person');
        var profile = currentProfiles[personName];
        if (!profile) return;
        var modal = ensureModal();
        var body = modal.querySelector('.ocr-modal-body');
        body.innerHTML = '<div class="ocr-doc-viewer">' +
            '<div class="ocr-doc-viewer-tabs">' +
                '<button class="ocr-doc-tab active" onclick="ocrSwitchTab(this, \'md\')"><i class="fab fa-markdown"></i> Markdown</button>' +
            '</div>' +
            '<div class="ocr-doc-viewer-content">' +
                '<div class="ocr-doc-pane active" data-pane="md"><div class="ocr-md ocr-doc-md">' + renderMd(profile.markdown) + '</div></div>' +
            '</div>' +
        '</div>';
        modal.querySelector('.ocr-modal-title').textContent = profile.person_name || 'Merged Profile';
        modal.querySelector('#ocrModalOpenLink').setAttribute('href', '#');
        modal.classList.add('show', 'ocr-modal-large');
        document.body.classList.add('ocr-modal-lock');
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