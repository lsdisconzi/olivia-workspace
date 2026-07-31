/* ═══════════════════════════════════════════════════════════════════
   VIOLATIONS MODULE — v2.1 with reference linking & fallback
   ═══════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── REGISTRY ── */
  var VIO_JURISDICTIONS = [
    { id: 'BR', label: 'Guarulhos · Brasil', incident: 'Incidente Guarulhos · GRU-GYN · Abr/2024', icon: 'fas fa-flag', cls: 'jur-br' },
    { id: 'CL', label: 'Santiago · Chile', incident: 'Incidente LA8159 · Santiago · Jul/2024', icon: 'fas fa-flag', cls: 'jur-cl' },
    { id: 'INT', label: 'Tratados internacionais', incident: 'Aplicáveis a ambos os incidentes', icon: 'fas fa-globe-americas', cls: 'jur-int' },
    { id: 'CORPORATE', label: 'LATAM Interno · Código de Conduta', incident: 'Violação interna de conduta · GRU · Abr/2024', icon: 'fas fa-building', cls: 'jur-corporate' },
  ];

  var VIO_SEVERITY = {
    CRITICAL: { label: 'Crítica', color: '#e53935' },
    HIGH: { label: 'Alta', color: '#fb8c00' },
    MEDIUM: { label: 'Média', color: '#fdd835' },
    LOW: { label: 'Baixa', color: '#7cb342' },
  };

  var _vio = {
    initialized: false,
    available: false,
    index: null,
    activeId: null,
    activeFull: null,
    filterJur: 'all',
    filterSeverity: 'all',
    filterPhase: 'all',
    searchQuery: '',
    view: 'welcome',
    activeReportPath: null,
    activeReportText: '',
    lang: 'EN',
    attached: {},
    collapsed: {},
  };

  /* ── TRANSCRIPT MAPPING ── */
  var VIO_EVIDENCE_FILE_MAP = {
    // CL-001
    "EVID-CL-001-01": "cases/LA8159/02-transcripts/transcripts_rendered/I-002/I-002_03_NAR-05_STG_5_aircraft_removal.html",
    "EVID-CL-001-02": "cases/LA8159/02-transcripts/transcripts_rendered/I-002/I-002_05_NAR-07_STG_7_post_removal_investigation.html",
    "EVID-CL-001-03": "cases/LA8159/02-transcripts/transcripts_rendered/I-002/I-002_17_NAR-21_STG_29.html",
    "EVID-CL-001-04": "cases/LA8159/02-transcripts/transcripts_rendered/I-002/I-002_18_NAR_LATAM_STG_2.html",
    // add other violations here …
  };

  var VIO_SPEAKER_ROLES = {
    "SPK-stewardess-accuser": "Flight Attendant — initial accuser",
    "SPK-antonela-latam-agent": "LATAM Supervisor — delivered carta de desembarque",
    "SPK-diego-latam-supervisor": "LATAM Supervisor — arranged the document falsifying the facts",
    "SPK-passenger-leandro": "Passenger Leandro — false accusation target",
    // add others as needed
  };

  var VIO_SECTION_LABELS = {
    legal_theory: { EN: 'Legal Theory', ES: 'Teoría Jurídica', BR: 'Teoria Jurídica', IT: 'Teoria Giuridica' },
    actors: { EN: 'Actors', ES: 'Actores', BR: 'Atores', IT: 'Attori' },
    legal_basis: { EN: 'Legal Basis', ES: 'Base Legal', BR: 'Base Legal', IT: 'Fondamento Giuridico' },
    segments: { EN: 'Transcript Segments', ES: 'Segmentos de la Transcripción', BR: 'Segmentos do Transcript', IT: 'Segmenti della Trascrizione' },
    probative_chain: { EN: 'Probative Chain', ES: 'Cadena Probatoria', BR: 'Cadeia Probatória', IT: 'Catena Probatoria' },
    evidence: { EN: 'Evidence', ES: 'Evidencia', BR: 'Evidência', IT: 'Prova' },
    element_grid: { EN: 'Element Grid', ES: 'Cuadrícula de Elementos', BR: 'Grade de Elementos', IT: 'Griglia di Elementi' },
    nexus_matrix: { EN: 'Nexus Matrix', ES: 'Matriz de Nexo', BR: 'Matriz de Nexo', IT: 'Matrice del Nexo' },
    confidence: { EN: 'Confidence', ES: 'Confianza', BR: 'Confiança', IT: 'Confidenza' },
    authorities: { EN: 'Authorities', ES: 'Autoridades', BR: 'Autoridades', IT: 'Autorità' },
    open_questions: { EN: 'Open Questions', ES: 'Preguntas Abiertas', BR: 'Perguntas Abertas', IT: 'Domande Aperte' },
    validation: { EN: 'Validation', ES: 'Validación', BR: 'Validação', IT: 'Validazione' },
    rec_log: { EN: 'Recommendation 9.3 Log', ES: 'Registro de Recomendación 9.3', BR: 'Registo da Recomendação 9.3', IT: 'Registro Raccomandazione 9.3' },
    cross_references: { EN: 'Cross-References', ES: 'Referencias Cruzadas', BR: 'Referências Cruzadas', IT: 'Riferimenti Incrociati' },
  };

  var VIO_LANGUAGES = [
    { id: 'EN', label: 'English', flag: '🇬🇧' },
    { id: 'ES', label: 'Español', flag: '🇪🇸' },
    { id: 'BR', label: 'Português (BR)', flag: '🇧🇷' },
    { id: 'IT', label: 'Italiano', flag: '🇮🇹' },
  ];

  function _vById(id) { return document.getElementById(id); }

  function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _vSetStatus(message, tone) {
    var el = _vById('violationsStatus');
    if (!el) return;
    el.textContent = String(message || '');
    var color = 'var(--gray)';
    if (tone === 'error') color = 'var(--red)';
    else if (tone === 'ok') color = 'var(--green, #5aa469)';
    else if (tone === 'warn') color = 'var(--amber)';
    el.style.color = color;
  }

  function _vSeverityDot(sev) {
    var s = VIO_SEVERITY[String(sev || '').toUpperCase()];
    var color = s ? s.color : '#888';
    return '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + color + ';margin-right:6px;vertical-align:middle"></span>';
  }

  function _vMatchesFilter(entry) {
    if (_vio.filterJur !== 'all' && String(entry.jurisdiction || '').toUpperCase() !== _vio.filterJur) return false;
    if (_vio.filterSeverity !== 'all' && String(entry.severity || '').toUpperCase() !== _vio.filterSeverity) return false;
    if (_vio.filterPhase !== 'all' && String(entry.phase || '') !== _vio.filterPhase) return false;
    if (_vio.searchQuery) {
      var q = _vio.searchQuery.toLowerCase();
      var hay = [entry.violation_id, entry.record_key, entry.title, entry.id]
        .map(function (s) { return String(s || '').toLowerCase(); })
        .join(' ');
      if (hay.indexOf(q) === -1) return false;
    }
    return true;
  }

  /* ── REFERENCE RESOLUTION ── */
  function _vResolveReference(raw) {
    var ref = raw.replace(/^\[\[|\]\]$/g, '').trim();
    var type = 'unknown';
    var label = ref;
    var pathHint = '';
    var role = '';
    if (/^SPK-/.test(ref)) {

      type = 'speaker';

      role = VIO_SPEAKER_ROLES[ref] || '';

      pathHint = 'LA8159/06-speakers/' + ref + '.md';

    } else if (/^(CL|BR|INT)-\d{3}(?:[A-Z]?)$/.test(ref)) {
      type = 'violation';
      var entry = _findViolationEntry(ref);
      if (entry) label = entry.title || ref;
      pathHint = ref;
    } else if (/^I-\d{3}_/.test(ref)) {
      type = 'evidence';
      var parts = ref.split('_');
      if (parts.length > 1) {
        var incidentId = parts[0];
        var rest = parts.slice(1).join('_');
        var subfolder = '';
        if (rest.startsWith('transcript_rendered_html')) subfolder = 'transcript_rendered_html';
        else if (rest.startsWith('transcript_segment')) subfolder = 'transcript_segment';
        else if (rest.startsWith('transcript_json')) subfolder = 'transcript_json';
        else if (rest.startsWith('email')) subfolder = 'email_' + (rest.includes('dgac') ? 'dgac' : 'latam') + '_communication';
        else if (rest.startsWith('audio_recording')) subfolder = 'audio_recording';
        if (subfolder) {
          pathHint = 'LA8159/03-evidence/' + incidentId + '/' + subfolder + '/' + ref + '.md';
        } else {
          pathHint = 'LA8159/03-evidence/' + incidentId + '/' + ref + '.md';
        }
      } else {
        pathHint = 'LA8159/03-evidence/' + ref + '.md';
      }
    } else if (/^CL\.(CP|CC|CACH|LPDC|CPR)\.Art\.\d+/.test(ref)) {
      type = 'law';
      var code = ref.split('.')[1];
      var fileName = '';
      if (code === 'CP') fileName = 'CodigoPenal.md';
      else if (code === 'CC') fileName = 'CC_CodigoCivil.md';
      else if (code === 'CACH') fileName = 'L18916_CACH.md';
      else if (code === 'LPDC') fileName = 'L19496_LPDC.md';
      else if (code === 'CPR') fileName = 'Constitucion.md';
      else fileName = 'ChileanCivilCodeandRelatedLaws.md';
      pathHint = 'LA8159/04-law/CL/' + fileName;
    } else if (/^(CACH|CodigoPenal|CC_CodigoCivil|CHIPENCOD_CP)$/.test(ref)) {
      type = 'framework';
      pathHint = 'LA8159/04-law/CL/' + ref + '.md';
    } else {
      type = 'reference';
      label = ref;
    }

    return { ref: ref, type: type, label: label, pathHint: pathHint, role: role };

  }

  function _vProcessText(text) {
    if (!text) return text;
    return text.replace(/\[\[([^\]]+)\]\]/g, function (match, inner) {
      var resolved = _vResolveReference(inner);
      var safeRef = escapeHtml(resolved.ref);
      var safeLabel = escapeHtml(resolved.label);
      var type = resolved.type;
      var pathData = (type === 'violation') ? safeRef : escapeHtml(resolved.pathHint || '');
      var role = resolved.role || '';   // from VIO_SPEAKER_ROLES, or empty

      // Tooltip: show role if available, otherwise the label
      var tooltip = escapeHtml(role || resolved.label);
      var displayRole = escapeHtml(role || resolved.label);

      return (
        '<span class="ref-link"' +
        ' data-ref="' + safeRef + '"' +
        ' data-type="' + type + '"' +
        ' data-path="' + pathData + '"' +
        ' title="' + displayRole + '">' +

        '<span class="ref-text">' + safeLabel + '</span>' +
        '<span class="ref-role">' + displayRole + '</span>' +

        '</span>'
      );
    });
  }

  function _findViolationEntry(vid) {
    if (!_vio.index || !_vio.index.jurisdictions) return null;
    var upper = vid.toUpperCase();
    for (var jur in _vio.index.jurisdictions) {
      var list = _vio.index.jurisdictions[jur] || [];
      var found = list.find(function (f) { return f.id && f.id.toUpperCase() === upper; });
      if (found) {
        var entry = (_vio.index.entries || []).find(function (e) { return e.violation_id && e.violation_id.toUpperCase() === upper; });
        return { ...found, title: entry ? entry.title : vid, jurisdiction: jur };
      }
    }
    return null;
  }

  /* ── MODAL & CLICK HANDLER WITH FALLBACK ── */
  var _vModal = null;

  function _vEnsureModal() {
    if (!_vModal) {
      _vModal = document.createElement('div');
      _vModal.id = 'refModal';
      _vModal.style.cssText = `
        display: none;
        position: fixed;
        top: 10%;
        left: 10%;
        width: 80%;
        height: 80%;
        background: var(--bg);
        border: 1px solid var(--border);
        border-radius: 12px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.5);
        z-index: 10000;
        overflow: auto;
        padding: 20px;
      `;
      var closeBtn = document.createElement('button');
      closeBtn.textContent = '✕';
      closeBtn.style.cssText = 'float:right; background:none; border:none; font-size:20px; cursor:pointer; color:var(--gray);';
      closeBtn.onclick = function () { _vModal.style.display = 'none'; };
      _vModal.appendChild(closeBtn);
      var content = document.createElement('div');
      content.id = 'refModalContent';
      _vModal.appendChild(content);
      document.body.appendChild(_vModal);
      _vModal.addEventListener('click', function (e) {
        if (e.target === _vModal) _vModal.style.display = 'none';
      });
    }
    return _vModal;
  }

  function _vShowModal(title, htmlContent) {
    var modal = _vEnsureModal();
    var content = document.getElementById('refModalContent');
    content.innerHTML = '<h3>' + escapeHtml(title) + '</h3><div style="margin-top:10px;">' + htmlContent + '</div>';
    modal.style.display = 'block';
  }

  /* Fetch with fallback: tries the given paths, handles text vs JSON */
  function _vFetchWithFallback(urls, callback) {
    var base = (typeof API_BASE !== 'undefined' && API_BASE) ? API_BASE : '';
    var idx = 0;

    function tryNext() {
      if (idx >= urls.length) {
        callback(new Error('All URLs failed'), null);
        return;
      }
      var fullUrl = base + urls[idx];
      var isShared = urls[idx].indexOf('/api/shared/raw') !== -1;
      console.log('Trying URL:', fullUrl);
      fetch(fullUrl)
        .then(function (res) {
          if (!res.ok) {
            if (res.status === 404) {
              idx++;
              tryNext();
              return;
            }
            throw new Error('HTTP ' + res.status);
          }
          if (isShared) {
            return res.text();
          } else {
            return res.json().then(function (data) {
              if (data.error) throw new Error(data.error);
              return data.content || '';
            });
          }
        })
        .then(function (content) {
          callback(null, content);
        })
        .catch(function (err) {
          idx++;
          tryNext();
        });
    }
    tryNext();
  }

  // Helper: open content in a text‑browser panel
  function _vOpenInTextBrowser(content, path) {
    var panelId = 'vw-text-evidence-' + Date.now();
    var panelDiv = document.createElement('div');
    panelDiv.id = panelId;
    panelDiv.style.display = 'none';
    panelDiv.textContent = content;
    document.body.appendChild(panelDiv);

    if (typeof window.vwOpenTextBrowser === 'function') {
      window.vwOpenTextBrowser(panelId);
    } else {
      _vShowModal('Evidence Transcript', '<pre>' + escapeHtml(content) + '</pre>');
    }
  }

  document.addEventListener('click', function (e) {
    var refEl = e.target.closest('.ref-link');
    if (!refEl) return;
    var ref = refEl.dataset.ref;
    var type = refEl.dataset.type;
    var path = refEl.dataset.path || '';
    if (!ref) return;
    e.preventDefault();

    if (type === 'violation') {
      if (typeof window.violationsSelectById === 'function') {
        window.violationsSelectById(ref);
      }
      return;
    }

    if (!path) {
      _vShowModal('Reference', '<pre>' + escapeHtml(ref) + '</pre>');
      return;
    }

    var candidates = [];
    candidates.push('/api/shared/raw?path=' + encodeURIComponent(path));
    if (!path.startsWith('cases/')) {
      candidates.push('/api/shared/raw?path=' + encodeURIComponent('cases/' + path));
    }
    var relPath = path.replace(/^LA8159\//, '');
    if (relPath !== path) {
      candidates.push('/api/violations/file?path=' + encodeURIComponent(relPath));
    } else {
      candidates.push('/api/violations/file?path=' + encodeURIComponent(path));
    }

    _vFetchWithFallback(candidates, function (err, content) {
      if (err) {
        _vShowModal('Error', 'Could not load: ' + err.message);
        return;
      }
      var htmlContent = content;
      if (window.marked && typeof marked.parse === 'function') {
        try { htmlContent = marked.parse(content); } catch (e) { }
      }
      _vShowModal(ref, '<div style="white-space:pre-wrap;font-family:var(--mono);font-size:12px;line-height:1.5;">' + htmlContent + '</div>');
    });
  });

  /* ── INIT / LOAD ── */
  async function violationsInit() {
    if (_vio.initialized) {
      _vRender();
      return;
    }
    _vio.initialized = true;
    _vSetStatus('Carregando violações…', 'muted');
    try {
      var base = (typeof API_BASE !== 'undefined' && API_BASE) ? API_BASE : '';
      var res = await fetch(base + '/api/violations/index');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var data = await res.json();
      if (data.error) throw new Error(data.error);

      if (data.entries && Array.isArray(data.entries)) {
        data.jurisdictions = data.jurisdictions || {};
        data.entries.forEach(function (e) {
          var jur = e.jurisdiction;
          if (jur) {
            data.jurisdictions[jur] = data.jurisdictions[jur] || [];
            var id = e.violation_id || e.id;
            if (!data.jurisdictions[jur].some(function (x) { return x.id === id; })) {
              data.jurisdictions[jur].push({
                id: id,
                path: e.path || (jur + '/' + id + '.md'),
                filename: e.filename || (id + '.md')
              });
            }
          }
        });
      }

      _vio.index = data;
      if (data.available === false || data.status === 'unavailable') {
        _vio.available = false;
        _vSetStatus('Base de violações indisponível neste runtime.', 'warn');
        _vRender();
        return;
      }
      _vio.available = true;
      _vSetStatus('Pronto — ' + _vTotalCount() + ' violações.', 'ok');
    } catch (err) {
      _vio.available = false;
      _vSetStatus('Falha ao carregar: ' + (err && err.message ? err.message : err), 'error');
    }
    _vRender();
  }

  function _vTotalCount() {
    if (!_vio.index || !_vio.index.jurisdictions) return 0;
    var n = 0;
    Object.keys(_vio.index.jurisdictions).forEach(function (k) {
      n += (_vio.index.jurisdictions[k] || []).length;
    });
    return n;
  }

  /* ── RENDER ── */
  function _vRender() {
    _vRenderLangFlags();
    _vRenderPhaseChips();
    _vRenderTree();
    _vRenderViewer();
    _vUpdateContextBar();
  }

  function _vRenderLangFlags() {
    var host = _vById('violationsLangFlags');
    if (!host) return;
    var html = VIO_LANGUAGES.map(function (l) {
      var active = (_vio.lang === l.id) ? ' active' : '';
      return '<span class="vw-lang-flag' + active + '" data-lang="' + l.id + '" title="' + escapeHtml(l.label) +
        '" onclick="violationsSetLang(\'' + l.id + '\',this)">' + l.flag + '</span>';
    }).join('');
    host.innerHTML = html;
  }

  function _vRenderPhaseChips() {
    var host = _vById('violationsPhaseChips');
    if (!host) return;
    if (!_vio.available || !_vio.index || !_vio.index.jurisdictions) {
      host.innerHTML = '';
      return;
    }
    var phases = {};
    Object.keys(_vio.index.jurisdictions).forEach(function (jid) {
      if (_vio.filterJur !== 'all' && jid !== _vio.filterJur) return;
      (_vio.index.jurisdictions[jid] || []).forEach(function (f) {
        var m = String(f.path || '').match(/__([A-Z0-9]+(?:-\d+)?)__/);
        if (m) phases[m[1]] = (phases[m[1]] || 0) + 1;
      });
    });
    var keys = Object.keys(phases);
    if (keys.length < 2) { host.innerHTML = ''; return; }
    keys.sort(function (a, b) {
      var ra = a.match(/^([A-Z]+)-?(\d+)?$/) || [];
      var rb = b.match(/^([A-Z]+)-?(\d+)?$/) || [];
      if ((ra[1] || a) !== (rb[1] || b)) return (ra[1] || a) < (rb[1] || b) ? -1 : 1;
      return (parseInt(ra[2] || '0', 10) - parseInt(rb[2] || '0', 10));
    });
    var html = ['<span class="vw-chip ' + (_vio.filterPhase === 'all' ? 'active' : '') +
      '" data-phase="all" onclick="violationsFilterPhase(\'all\',this)" title="Mostrar todas as fases">Fase: todas</span>'];
    keys.forEach(function (p) {
      var label = p.replace('-', ' · ');
      html.push('<span class="vw-chip ' + (_vio.filterPhase === p ? 'active' : '') +
        '" data-phase="' + p + '" onclick="violationsFilterPhase(\'' + p +
        '\',this)" title="' + phases[p] + ' violação(ões) ligadas ao áudio ' + p + '">' +
        label + ' <span style="color:var(--gray);font-size:9px">' + phases[p] + '</span></span>');
    });
    host.innerHTML = html.join('');
  }

  function _vRenderTree() {
    var tree = _vById('violationsTree');
    if (!tree) return;
    if (!_vio.available || !_vio.index) {
      tree.innerHTML = '<div style="padding:12px;color:var(--gray);font-size:11px">Sem dados disponíveis.</div>';
      return;
    }
    var html = [];
    var totalShown = 0;
    VIO_JURISDICTIONS.forEach(function (j) {
      var meta = (_vio.index.entries || []).reduce(function (map, ent) {
        map[String(ent.violation_id || '').toUpperCase()] = ent;
        return map;
      }, {});
      var fileEntries = (_vio.index.jurisdictions[j.id] || []).map(function (f) {
        var key = String(f.id || '').toUpperCase();
        var indexed = meta[key] || {};
        var phaseMatch = String(f.path || '').match(/__([A-Z0-9]+(?:-\d+)?)__/);
        return {
          id: f.id,
          path: f.path,
          filename: f.filename,
          title: indexed.title || f.id,
          severity: indexed.severity || '',
          jurisdiction: j.id,
          phase: phaseMatch ? phaseMatch[1] : '',
          confidence: indexed.confidence,
          completeness_score: indexed.completeness_score,
          record_key: indexed.record_key || '',
          violation_id: indexed.violation_id || f.id,
          status: indexed.status || '',
        };
      });
      var visible = fileEntries.filter(_vMatchesFilter);
      if (!visible.length) return;
      totalShown += visible.length;
      html.push(
        '<div class="vio-jur-section" style="margin-bottom:8px">',
        '<div style="font-size:10px;letter-spacing:.12em;color:var(--amber);text-transform:uppercase;padding:6px 8px">',
        '<i class="' + j.icon + '"></i> ' + escapeHtml(j.label) + ' <span style="color:var(--gray)">· ' + visible.length + '</span>',
        '</div>'
      );
      visible.forEach(function (entry) {
        var active = (_vio.activeId === entry.violation_id) ? ' active' : '';
        var sevLabel = entry.severity ? _vSeverityDot(entry.severity) + (VIO_SEVERITY[String(entry.severity).toUpperCase()] || {}).label || entry.severity : '';
        var compl = entry.completeness_score != null ? ('<span style="font-size:10px;color:var(--gray);margin-left:6px">' + Math.round(entry.completeness_score * 100) + '%</span>') : '';
        html.push(
          '<div class="vio-item' + active + '" onclick="violationsSelect(\'' + escapeHtml(j.id) + '\',\'' + escapeHtml(entry.path) + '\',\'' + escapeHtml(entry.violation_id) + '\')" ',
          'style="padding:8px 10px;border-radius:6px;cursor:pointer;margin:2px 4px;border:1px solid transparent;' + (active ? 'background:var(--bg-hi);border-color:var(--amber)' : '') + '">',
          '<div style="font-size:12px;color:var(--gray-hi);font-weight:600;line-height:1.3">',
          escapeHtml(entry.violation_id),
          compl,
          '</div>',
          '<div style="font-size:11px;color:var(--gray);line-height:1.4;margin-top:3px">',
          escapeHtml(String(entry.title || '').slice(0, 110)) + (String(entry.title || '').length > 110 ? '…' : ''),
          '</div>',
          sevLabel ? '<div style="font-size:10px;color:var(--gray);margin-top:4px">' + sevLabel + '</div>' : '',
          '</div>'
        );
      });
      html.push('</div>');
    });
    if (!totalShown) html.push('<div style="padding:12px;color:var(--gray);font-size:11px">Nenhum resultado.</div>');
    tree.innerHTML = html.join('');
  }

  function _vRenderViewer() {
    var viewer = _vById('violationsViewer');
    if (!viewer) return;
    if (_vio.view === 'reports') {
      viewer.innerHTML = _vReportsListHtml();
      return;
    }
    if (_vio.view === 'report') {
      viewer.innerHTML = _vReportHtml();
      return;
    }
    if (_vio.view === 'violation' && _vio.activeFull) {
      viewer.innerHTML = _vViolationHtml(_vio.activeFull);
      return;
    }
    viewer.innerHTML = _vWelcomeHtml();
  }

  function _vWelcomeHtml() {
    var meta = (_vio.index && _vio.index.meta) || {};
    var bySev = meta.severity_distribution || {};
    var byJur = meta.jurisdictions || {};
    function pill(label, value) {
      return '<span style="display:inline-block;padding:4px 10px;border:1px solid var(--border);border-radius:12px;font-size:11px;color:var(--gray-hi);background:var(--bg);margin:2px 4px">'
        + escapeHtml(label) + ' <strong style="color:var(--amber)">' + escapeHtml(String(value)) + '</strong></span>';
    }
    var pills = [];
    Object.keys(bySev).forEach(function (k) { pills.push(pill(k, bySev[k])); });
    Object.keys(byJur).forEach(function (k) { pills.push(pill(k, byJur[k])); });
    return [
      '<div style="padding:24px;max-width:780px">',
      '<h2 style="margin:0 0 8px;color:var(--gray-hi)"><i class="fas fa-triangle-exclamation"></i> Violações Validadas</h2>',
      '<div style="color:var(--gray);font-size:13px;margin-bottom:16px">Banco de dados das violações revisadas (BR, CL, INT) com base legal e segmentos do incidente OliviaLegal.</div>',
      '<div style="margin-bottom:16px">' + pills.join('') + '</div>',
      '<div style="display:flex;gap:8px;flex-wrap:wrap">',
      '<button class="btn-secondary" onclick="violationsShowReports()"><i class="fas fa-file-lines"></i> Relatórios consolidados</button>',
      '</div>',
      '<div style="margin-top:24px;padding:14px;border:1px dashed var(--border);border-radius:8px;color:var(--gray);font-size:12px">',
      'Selecione uma violação na barra lateral para ver fatos, segmentos do transcript, atores e base legal por framework.',
      '</div>',
      '</div>',
    ].join('');
  }

  function _vReportsListHtml() {
    var reports = (_vio.index && _vio.index.reports) || {};
    var html = ['<div style="padding:24px;max-width:900px">'];
    html.push('<h2 style="margin:0 0 12px;color:var(--gray-hi)"><i class="fas fa-file-lines"></i> Relatórios Consolidados</h2>');
    html.push('<div style="margin-bottom:16px"><button class="btn-link" onclick="violationsShowWelcome()"><i class="fas fa-arrow-left"></i> Voltar</button></div>');
    VIO_JURISDICTIONS.forEach(function (j) {
      var list = reports[j.id] || [];
      if (!list.length) return;
      html.push('<div style="margin-bottom:18px">');
      html.push('<h3 style="margin:0 0 8px;color:var(--amber);font-size:13px;letter-spacing:.08em;text-transform:uppercase">' + escapeHtml(j.label) + '</h3>');
      list.forEach(function (r) {
        var fileUrl = ((typeof API_BASE !== 'undefined' && API_BASE) ? API_BASE : '') + '/api/violations/file?path=' + encodeURIComponent(r.path || '');
        var pills = (typeof window.vwFilePills === 'function') ? window.vwFilePills(fileUrl, r.name || r.path, 'json') : '';
        html.push(
          '<div style="padding:10px 12px;border:1px solid var(--border);border-radius:8px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;gap:8px">',
          '<div>',
          '<div style="font-size:13px;color:var(--gray-hi);font-weight:600">' + escapeHtml(r.name) + '</div>',
          '<div style="font-size:11px;color:var(--gray)">' + escapeHtml(r.path) + ' · ' + Math.round((r.size || 0) / 1024) + ' KB</div>',
          '</div>',
          '<div style="display:flex;gap:6px;align-items:center">',
          pills,
          '<button class="btn-secondary" onclick="violationsOpenReport(\'' + escapeHtml(r.path) + '\')"><i class="fas fa-eye"></i> Abrir</button>',
          '<button class="btn-secondary" onclick="violationsAttachReport(\'' + escapeHtml(r.path) + '\',\'' + escapeHtml(r.name) + '\')"><i class="fas fa-paperclip"></i> Anexar</button>',
          '</div>',
          '</div>'
        );
      });
      html.push('</div>');
    });
    html.push('</div>');
    return html.join('');
  }

  function _vReportHtml() {
    var text = _vio.activeReportText || '';
    var hasMd = window.marked && typeof marked.parse === 'function';
    var ext = (String(_vio.activeReportPath || '').split('.').pop() || '').toLowerCase();
    var isMd = ext === 'md' || ext === 'markdown';
    var bodyHtml;
    if (hasMd && isMd) {
      try {
        bodyHtml = '<div class="answer-md" style="padding:18px 20px;border:1px solid var(--border);border-radius:8px;background:var(--bg);font-size:13px;line-height:1.7;color:var(--gray-hi)">'
          + marked.parse(text)
          + '</div>';
      } catch (_) {
        bodyHtml = '<pre style="white-space:pre-wrap;font-size:12px;line-height:1.55;color:var(--gray-hi);background:var(--bg);padding:14px;border:1px solid var(--border);border-radius:8px">' + escapeHtml(text) + '</pre>';
      }
    } else {
      bodyHtml = '<pre style="white-space:pre-wrap;font-size:12px;line-height:1.55;color:var(--gray-hi);background:var(--bg);padding:14px;border:1px solid var(--border);border-radius:8px">' + escapeHtml(text) + '</pre>';
    }
    return [
      '<div style="padding:24px;max-width:920px">',
      '<div style="margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;gap:8px">',
      '<div>',
      '<div style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--amber)">Relatório</div>',
      '<h2 style="margin:0;color:var(--gray-hi)">' + escapeHtml(_vio.activeReportPath || '') + '</h2>',
      '</div>',
      '<div style="display:flex;gap:6px;align-items:center">',
      (function () {
        var p = _vio.activeReportPath || '';
        if (!p || typeof window.vwFilePills !== 'function') return '';
        var url = ((typeof API_BASE !== 'undefined' && API_BASE) ? API_BASE : '') + '/api/violations/file?path=' + encodeURIComponent(p);
        return window.vwFilePills(url, p, 'text');
      })(),
      '<button class="btn-link" onclick="violationsShowReports()"><i class="fas fa-arrow-left"></i> Voltar</button>',
      '<button class="btn-secondary" onclick="violationsOpenReportBranded()" title="Abrir versão HTML formatada"><i class="fas fa-external-link-alt"></i> Abrir HTML</button>',
      '<button class="btn-secondary" onclick="violationsAttachReport(\'' + escapeHtml(_vio.activeReportPath || '') + '\',\'' + escapeHtml(_vio.activeReportPath || '') + '\')"><i class="fas fa-paperclip"></i> Anexar ao chat</button>',
      '</div>',
      '</div>',
      bodyHtml,
      '</div>',
    ].join('');
  }

  /* ── VIOLATION HTML ── */
  function _vViolationHtml(v) {
    v = v || {};

    // ── Normalise confidence (4.0 object vs legacy number) ──
    var confValue = null;
    if (v.confidence) {
      if (typeof v.confidence === 'number') {
        confValue = v.confidence;
      } else if (v.confidence.value != null) {
        confValue = Number(v.confidence.value);
      }
    }
    v.confidence_value = confValue;   // numeric value for header etc.

    if (!v.confidence_details) {
      var cd = v.confidence || {};
      v.confidence_details = {
        formula: cd.derivation_formula || '',
        components: cd.components || {},
        note: cd.note || ''
      };
    }

    /* ========== NORMALISE FIELDS TO LEGACY SHAPES ========== */

    // Segments — use the curated key_admissions, but fall back to the full
    // "segments" list from the 3.0 file if key_admissions is missing.
    v.key_admissions = v.key_admissions || v.segments || [];
    // Make sure each segment object has the right fields
    v.key_admissions = v.key_admissions.map(function (s) {
      return {
        speaker: s.speaker || '',
        text: s.text || s.translation_en || s.verbatim_es || s.content || '',
        timestamp: s.timestamp || s.local_time || '',
        local_time: s.local_time || '',
        segment_audio_path: s.segment_audio_path || s.audio_uri || '',
        group: s.group || '',          // optional, for key admissions
        reasoning: s.reasoning || ''       // optional
      };
    });

    // Legal basis — already in the right shape, but ensure every article has
    // verbatim_text (may come as verbatim_excerpt from 3.0).
    var legalBasis = v.legal_basis || v.established_articles || [];
    if (legalBasis.length && !v.legal_basis) {
      // Convert established_articles (3.0) to the old format
      legalBasis = legalBasis.map(function (a) {
        return {
          article_id: a.article_id,
          article_name: a.article_name || a.framework_code,
          verbatim_text: a.verbatim_excerpt || '',
          framework_name: a.framework_code || ''
        };
      });
    }
    v.legal_basis = legalBasis;

    // Primary & supporting agents — the actual schema does not use these;
    // they are empty unless filled from other sources.
    v.primary_agents = v.primary_agents || [];
    v.supporting_agents = v.supporting_agents || [];

    // Confidence details — build from the new fields if missing.
    if (!v.confidence_details) {
      v.confidence_details = {
        formula: v.confidence_formula || '',
        components: v.confidence_components || {},
        note: v.confidence_note || ''
      };
    }

    // Nexus matrix — use the summary object if the old matrix is absent.
    if (!v.nexus_matrix || !Object.keys(v.nexus_matrix).length) {
      if (v.nexus_matrix_summary) {
        v.nexus_matrix = v.nexus_matrix_summary;
      }
    }

    // Cross‑references — already handled in _vRenderCrossReferences,
    // but we can normalise here to be safe.
    v.cross_references = v.cross_references || v.cross_refs || [];

    /* ========== NOW BUILD THE HTML ========== */

    // Helper: segment audio URL (unchanged)
    function _vSegAudioUrl(p) {
      if (!p) return '';
      if (/^(https?:)?\/\//i.test(p)) return p;
      var dec = String(p);
      try { dec = decodeURIComponent(p); } catch (e) { }
      var m = dec.match(/LA8159[\\/]10-audio[\\/].+$/i);
      if (m) {
        var rel = 'cases/LA8159/10-audio/' + m[0].split(/LA8159[\\/]10-audio[\\/]/i)[1];
        return '/api/shared/raw?path=' + encodeURIComponent(rel);
      }
      if (/^cases[\\/]LA8159[\\/]10-audio/i.test(dec)) {
        return '/api/shared/raw?path=' + encodeURIComponent(dec.replace(/\\/g, '/'));
      }
      if (/^cases[\\/]/i.test(dec)) {
        return '/api/shared/raw?path=' + encodeURIComponent(dec.replace(/\\/g, '/'));
      }
      return p.charAt(0) === '/' ? p : p;
    }

    // Text processor with reference links
    var allegation = _vProcessText(v.allegation_summary || (v.facts && v.facts.summary) || '');
    var theory = _vProcessText(v.legal_theory || '');
    var segments = v.key_admissions;
    var primaryAgents = v.primary_agents;
    var supportingAgents = v.supporting_agents;
    var articles = Array.isArray(v.legal_basis) ? v.legal_basis : [];
    var sevColor = (VIO_SEVERITY[String(v.severity || '').toUpperCase()] || {}).color || '#888';

    // Header
    var header = [
      '<div class="vw-v-header">',
      '<div class="vw-v-head-l">',
      '<div class="vw-v-eyebrow">' + _vProcessText(v.violation_id || '') + ' · ' + _vProcessText(v.jurisdiction || '') + '</div>',
      '<h2 style="margin:2px 0 0;color:var(--white);line-height:1.25">' + _vProcessText(v.title || 'Violação') + '</h2>',
      '<div style="margin-top:6px;font-size:12px;color:var(--gray)">',
      '<span style="color:' + sevColor + ';font-weight:600">' + escapeHtml(v.severity || '') + '</span> · ' + escapeHtml(v.status || '') +
      ' · confiança <strong style="color:var(--amber)">' + (v.confidence_value != null ? Math.round(v.confidence_value * 100) + '%' : '—') + '</strong>',
      '</div>',
      (v.incident_timestamp_display || v.incident_timestamp ? '<div style="margin-top:3px;font-size:11px;color:var(--gray);font-family:var(--mono)">' + _vProcessText(v.incident_timestamp_display || v.incident_timestamp) + '</div>' : ''),
      '</div>',
      '<div class="vw-v-head-r">',
      _vFilePillsHtml(v),
      '</div>',
      '</div>',
    ].join('');

    var summaryHtml = allegation ? '<div class="vw-v-summary">' + allegation + '</div>' : '';
    var theoryHtml = theory ? _vSection('legal_theory', 'fa-gavel', '<div class="vw-v-theory">' + theory + '</div>') : '';

    // Actors
    var actorsHtml = '';
    if (primaryAgents.length || supportingAgents.length) {
      var pri = primaryAgents.map(function (a) { return '<span class="vw-actor vw-actor-pri">' + _vProcessText(a) + '</span>'; }).join('');
      var sup = supportingAgents.map(function (a) { return '<span class="vw-actor vw-actor-sup">' + _vProcessText(a) + '</span>'; }).join('');
      var actorsInner = (pri ? '<div style="margin-bottom:6px"><span class="vw-actor-label">Primários</span>' + pri + '</div>' : '') +
        (sup ? '<div><span class="vw-actor-label">Suporte</span>' + sup + '</div>' : '');
      actorsHtml = _vSection('actors', 'fa-users', actorsInner);
    }

    // Legal basis
    var basesHtml = '';
    if (articles.length) {
      var arts = articles.map(function (a) {
        var opts = { framework: a.article_name || a.framework_name, section: 'violations', defaultExpanded: true };
        var articleName = _vProcessText(a.article_name || '');
        var verbatim = _vProcessText(a.verbatim_text || a.article_text || '');
        var id = _vProcessText(a.article_id || '');
        if (typeof window.vwArticleCard === 'function') {
          var clonedA = JSON.parse(JSON.stringify(a));
          clonedA.article_name = articleName;
          clonedA.verbatim_text = verbatim;
          clonedA.article_id = id;
          return window.vwArticleCard(clonedA, opts);
        }
        return '<div class="vw-art-card"><div class="vw-art-head"><div class="vw-art-id">' + id + '</div></div><div class="vw-art-body">' + verbatim + '</div></div>';
      }).join('');
      basesHtml = _vSection('legal_basis', 'fa-book', arts);
    }

    // Segments
    var segHtml = '';
    if (segments.length) {
      var segs = segments.map(function (s) {
        var audioUrl = _vSegAudioUrl(s.segment_audio_path || '');
        var timeHtml = '';
        if (s.local_time) {
          timeHtml =
            '<span class="vw-seg-time">' +
            '<i class="far fa-clock vw-seg-time-icon"></i>' +
            '<span class="vw-time-text">' + escapeHtml(s.local_time) + '</span>' +
            '</span>';
        }
        var playBtn = audioUrl
          ? '<button class="vw-seg-play" type="button" title="Ouvir segmento" onclick="violationsPlaySegment(this)" data-audio="' + escapeHtml(audioUrl) + '"><i class="fas fa-play"></i></button>'
          : '';
        var speaker = _vProcessText(s.speaker || '');
        var text = _vProcessText(s.text || s.content || '');
        return '<div class="vw-seg">' +
          timeHtml +
          playBtn +
          (s.timestamp ? '<span class="vw-seg-ts">' + _vProcessText(s.timestamp) + '</span>' : '') +
          (speaker ? '<span class="vw-seg-who">' + speaker + ':</span><span class="vw-seg-gap"></span>' : '') +
          text +
          '</div>';
      }).join('');
      segHtml = _vSection('segments', 'fa-comment-dots', segs);
    }

    // Probative chain — smart rendering: if it looks like a table, parse it;
    // otherwise just display as pre‑formatted text.
    function _renderProbativeChain(chainText) {
      if (!chainText) return '';
      var firstLine = String(chainText).trim().split('\n')[0] || '';
      // If the first line has at least two columns separated by 2+ spaces, treat as table.
      if (firstLine.split(/\s{2,}/).length >= 2) {
        var lines = chainText.trim().split('\n');
        var headerCols = lines[0].split(/\s{2,}/).map(function (col) { return col.trim(); });
        var dataLines = lines.slice(1);
        var maxCols = headerCols.length;
        var dataRows = dataLines.map(function (line) {
          var cols = line.split(/\s{2,}/);
          while (cols.length < maxCols) cols.push('');
          return cols.slice(0, maxCols);
        });
        var table = '<table class="vw-chain-table"><thead><tr>';
        headerCols.forEach(function (h) { table += '<th>' + _vProcessText(h) + '</th>'; });
        table += '</tr></thead><tbody>';
        dataRows.forEach(function (row) {
          table += '<tr>';
          row.forEach(function (cell) { table += '<td>' + _vProcessText(cell) + '</td>'; });
          table += '</tr>';
        });
        table += '</tbody></table>';
        return '<div class="vw-v-chain-wrapper">' + table + '</div>';
      } else {
        // Narrative text
        return '<pre style="white-space:pre-wrap;font-size:12px;line-height:1.5;padding:10px;background:var(--bg);border:1px solid var(--border);border-radius:6px;">' + escapeHtml(chainText) + '</pre>';
      }
    }

    var chainHtml = v.probative_chain
      ? _vSection('probative_chain', 'fa-route', _renderProbativeChain(v.probative_chain))
      : '';

    // Evidence, element grids, nexus, confidence, authorities, open questions, validation, rec log, cross refs
    var evHtml = _vRenderEvidence(v);
    var gridHtml = _vRenderElementGrid(v);
    var nexusHtml = _vRenderNexusMatrix(v);
    var confHtml = _vRenderConfidenceDetails(v);
    var authHtml = _vRenderAuthorities(v);
    var oqHtml = _vRenderOpenQuestions(v);
    var valHtml = _vRenderValidation(v);
    var logHtml = _vRenderRecommendationLog(v);
    var xrefHtml = _vRenderCrossReferences(v);

    return [
      '<div class="vw-v">',
      header,
      summaryHtml,
      theoryHtml,
      actorsHtml,
      basesHtml,
      segHtml,
      chainHtml,
      evHtml,
      gridHtml,
      nexusHtml,
      confHtml,
      authHtml,
      oqHtml,
      valHtml,
      logHtml,
      xrefHtml,
      '</div>',
    ].join('');
  }

  /* ── SECTION RENDERERS ── */
  function _vSection(key, icon, innerHtml, suffix) {
    if (!innerHtml) return '';
    var lang = _vio.lang || 'EN';
    var label = (VIO_SECTION_LABELS[key] && VIO_SECTION_LABELS[key][lang]) || key;
    if (suffix) label = label + suffix;
    var collapsed = _vio.collapsed[key] ? ' collapsed' : '';
    var caretCls = _vio.collapsed[key] ? 'collapsed' : '';
    return '<div class="vw-section' + collapsed + '" data-section-key="' + escapeHtml(key) + '">' +
      '<div class="vw-section-head" onclick="violationsToggleSection(\'' + escapeHtml(key) + '\',this)">' +
      '<i class="fas fa-chevron-right vw-section-caret ' + caretCls + '"></i>' +
      '<i class="fas ' + escapeHtml(icon) + ' vw-section-icon"></i>' +
      '<span class="vw-section-title">' + escapeHtml(label) + '</span>' +
      '</div>' +
      '<div class="vw-section-body">' + innerHtml + '</div>' +
      '</div>';
  }

  window.violationsToggleSection = function (key, head) {
    if (!key) return;
    _vio.collapsed[key] = !_vio.collapsed[key];
    var sec = head && head.closest ? head.closest('.vw-section') : null;
    if (sec) sec.classList.toggle('collapsed', !!_vio.collapsed[key]);
  };

  function _vRenderElementGrid(v) {
    var grids = v.element_grids || v.element_grid || [];
    var rows = [];
    if (Array.isArray(grids)) {
      grids.forEach(function (el, i) {
        rows.push([
          (i + 1),
          el.element_name || el.element || '',
          el.status || 'unknown',
          el.evidence,
          el.argument,
          el.weakness,
          el.open_question || (el.open_questions && el.open_questions.join(', ')) || ''
        ]);
      });
    } else if (grids && typeof grids === 'object') {
      Object.keys(grids).forEach(function (fw) {
        (grids[fw] || []).forEach(function (el) {
          rows.push([
            fw,
            el.element_name || el.element || '',
            el.status || 'unknown',
            el.evidence,
            el.argument,
            el.weakness,
            el.open_question || (el.open_questions && el.open_questions.join(', ')) || ''
          ]);
        });
      });
    }
    if (!rows.length) return '';
    var body = rows.map(function (r) {
      var statusClass = _vStatusBadgeClass(r[2]);
      var metaBits = [];
      if (r[4]) metaBits.push('<div class="vw-elem-arg">' + _vProcessText(r[4]) + '</div>');
      if (r[5]) metaBits.push('<div class="vw-elem-weak">' + _vProcessText(r[5]) + '</div>');
      if (r[6]) metaBits.push('<div class="vw-elem-oq"><span class="vw-oq-tag">OQ</span> ' + _vProcessText(r[6]) + '</div>');
      var ev = Array.isArray(r[3]) ? r[3].map(function (s) { return _vProcessText(s); }).join(', ') : (r[3] ? _vProcessText(r[3]) : '—');
      return '<tr>' +
        (rows[0][0] && !/^\d+$/.test(rows[0][0]) ? '<td><code>' + _vProcessText(r[0]) + '</code></td>' : '') +
        '<td>' + _vProcessText(r[1]) + '</td>' +
        '<td><span class="badge ' + statusClass + '">' + escapeHtml(r[2]) + '</span></td>' +
        '<td class="vw-ev">' + ev + '</td>' +
        '<td>' + (metaBits.join('') || '—') + '</td>' +
        '</tr>';
    }).join('');
    var cols = (rows[0][0] && !/^\d+$/.test(String(rows[0][0]))) ? '<th>Framework</th>' : '';
    var inner = '<div class="vw-table-wrap"><table class="vw-table"><thead><tr>' + cols +
      '<th>Element</th><th>Status</th><th>Evidence</th><th>Argument / Weakness / OQ</th></tr></thead><tbody>' + body + '</tbody></table></div>';
    return _vSection('element_grid', 'fa-th-list', inner);
  }

  function _vRenderNexusMatrix(v) {
    var nm = v.nexus_matrix || v.nexus || {};
    var tc = nm.type_counts || nm.summary || {};
    var top = nm.highest_strength_connections || nm.connections || [];
    if (!Object.keys(tc).length && !top.length) return '';
    var barRows = Object.keys(tc).map(function (k) {
      var n = tc[k];
      var pct = nm.total_connections ? Math.round((n / nm.total_connections) * 100) : 0;
      return '<div class="vw-nexus-row">' +
        '<span class="vw-nexus-key">' + escapeHtml(k.replace(/_/g, ' ')) + '</span>' +
        '<span class="vw-nexus-bar"><span class="vw-nexus-fill" style="width:' + (pct || 2) + '%"></span></span>' +
        '<span class="vw-nexus-val">' + n + '</span></div>';
    }).join('');
    var topRows = top.map(function (c) {
      return '<li><code>' + _vProcessText(c.from || '') + '</code> → <strong>' + _vProcessText(c.to_element || '') + '</strong>' +
        ' <span class="badge badge-info">' + escapeHtml(c.type || '') + '</span> ' +
        (c.strength ? '<span class="vw-str ' + escapeHtml(c.strength) + '">' + escapeHtml(c.strength) + '</span>' : '') +
        (c.detail ? ' — ' + _vProcessText(c.detail) : '') + '</li>';
    }).join('');
    var lang = _vio.lang || 'EN';
    var lblConnTotal = { EN: 'total connections', ES: 'conexiones totales', BR: 'conexões totais', IT: 'connessioni totali' }[lang] || 'conexões totais';
    var lblStrongest = { EN: 'Strongest Connections', ES: 'Conexiones de Mayor Fuerza', BR: 'Conexões de maior força', IT: 'Connessioni Più Forti' }[lang] || 'Conexões de maior força';
    var inner = (nm.total_connections ? '<div style="font-size:11px;color:var(--gray);margin-bottom:8px">' + nm.total_connections + ' ' + lblConnTotal + '</div>' : '') +
      (barRows ? '<div class="vw-nexus">' + barRows + '</div>' : '') +
      (topRows ? '<div style="margin-top:10px"><div style="font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:var(--gray);margin-bottom:4px">' + lblStrongest + '</div><ul class="vw-nexus-list">' + topRows + '</ul></div>' : '');
    return _vSection('nexus_matrix', 'fa-project-diagram', inner);
  }

  function _vRenderConfidenceDetails(v) {
    var cd = v.confidence_details;
    if (!cd) return '';
    var pct = v.confidence_value != null ? Math.round(v.confidence_value * 100) : null;
    var inner = '<div class="vw-confidence">';
    if (cd.formula) {
      inner += '<div class="vw-conf-formula"><span class="vw-oq-tag">FÓRMULA</span> <code>' + escapeHtml(cd.formula) + '</code></div>';
    }
    if (cd.components) {
      var compRows = Object.keys(cd.components).map(function (k) {
        var c = cd.components[k];
        var score = (typeof c === 'object') ? c.score : c;
        var weight = (typeof c === 'object' && typeof c.weight !== 'undefined') ? c.weight : null;
        return '<tr><td><code>' + escapeHtml(k) + '</code></td><td>' + (score != null ? Number(score).toFixed(2) : '—') + '</td><td>' + (weight != null ? Number(weight).toFixed(2) : '—') + '</td></tr>';
      }).join('');
      inner += '<div class="vw-table-wrap" style="margin:8px 0"><table class="vw-table vw-table-mini"><thead><tr><th>Component</th><th>Score</th><th>Weight</th></tr></thead><tbody>' + compRows + '</tbody></table></div>';
    }
    if (cd.note) inner += '<div class="vw-conf-note">' + _vProcessText(cd.note) + '</div>';
    inner += '</div>';
    var suffix = pct !== null ? ' · ' + pct + '%' : '';
    return _vSection('confidence', 'fa-bullseye', inner, suffix);
  }

  function _vRenderAuthorities(v) {
    var auths = v.authorities || [];
    if (!auths.length) return '';
    var rows = auths.map(function (a) {
      var els = Array.isArray(a.supports_elements) ? a.supports_elements.map(function (s) { return _vProcessText(s); }).join(', ') : (a.supports_elements || '');
      return '<tr>' +
        '<td><code>' + _vProcessText(a.id || '') + '</code></td>' +
        '<td><span class="badge badge-info">' + escapeHtml(a.type || '') + '</span></td>' +
        '<td>' + els + '</td>' +
        '<td class="vw-ev">' + (a.research_query ? _vProcessText(a.research_query) : '—') + '</td>' +
        '</tr>';
    }).join('');
    var inner = '<div class="vw-table-wrap"><table class="vw-table"><thead><tr><th>ID</th><th>Tipo</th><th>Elementos</th><th>Query de pesquisa</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    return _vSection('authorities', 'fa-balance-scale', inner);
  }

  function _vRenderOpenQuestions(v) {
    var oqs = v.open_questions || [];
    if (!oqs.length) return '';
    var order = { 'crítica': 0, 'alta': 1, 'média': 2, 'baixa': 3 };
    oqs = oqs.slice().sort(function (a, b) {
      var pa = order[String(a.priority).toLowerCase()] ?? 9;
      var pb = order[String(b.priority).toLowerCase()] ?? 9;
      return pa - pb;
    });
    var rows = oqs.map(function (o) {
      var pr = String(o.priority || '').toLowerCase();
      var prCls = pr === 'crítica' ? 'badge-warn' : (pr === 'alta' ? 'badge-info' : 'badge-dim');
      return '<tr>' +
        '<td><span class="badge ' + prCls + '">' + escapeHtml(o.priority || '') + '</span></td>' +
        '<td><code>' + _vProcessText(o.id || '') + '</code></td>' +
        '<td>' + _vProcessText(o.question || o.text || '') + '</td>' +
        '<td class="vw-ev">' + _vProcessText(o.blocks_element || '') + '</td>' +
        '</tr>';
    }).join('');
    var inner = '<div class="vw-table-wrap"><table class="vw-table"><thead><tr><th>Prioridade</th><th>ID</th><th>Pergunta</th><th>Bloqueia</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    return _vSection('open_questions', 'fa-circle-question', inner);
  }

  function _vRenderCrossReferences(v) {
    var xr = v.cross_references || v.cross_refs || [];
    if (!xr.length) return '';

    var chips = xr.map(function (item) {
      // normalise to a plain violation ID string
      var vid = '';
      if (typeof item === 'string') {
        vid = item;
      } else if (item && typeof item.ref === 'string') {
        vid = item.ref;               // object format: { ref: "BR-001", … }
      } else {
        return '';                    // skip unreadable entries
      }

      var e = _findViolationEntry(vid);
      var title = e ? (e.title || vid) : '';
      return '<button class="vw-xref-chip" type="button" title="' + escapeHtml(title) + '" ' +
        'onclick="violationsSelectById(\'' + escapeHtml(vid.toUpperCase()) + '\')">' +
        '<i class="fas fa-link"></i> ' + escapeHtml(vid.toUpperCase()) + '</button>';
    }).join('');

    var inner = '<div class="vw-xref-wrap">' + chips + '</div>';
    return _vSection('cross_references', 'fa-network-wired', inner);
  }

  function _vRenderEvidence(v) {
    var ev = v.evidence || [];
    if (!ev.length) return '';
    var links = v.evidence_links || [];
    var items = ev.map(function (e, idx) {
      var path = (e.source_path || '').trim();
      if (!path) {
        var linkRef = links[idx] || '';
        if (linkRef) {
          var resolved = _vResolveReference(linkRef.replace(/^\[\[|\]\]$/g, ''));
          path = resolved.pathHint || '';
        }
      }
      var sourceHtml = _vProcessText(e.source || '');
      if (path) {
        sourceHtml = '<span class="vw-ev-src-link" onclick="violationsOpenEvidenceSource(\'' + escapeHtml(path) + '\', \'' + escapeHtml(e.id || '') + '\')">' + sourceHtml + '</span>';
      } else {
        sourceHtml = '<span class="vw-ev-src">' + sourceHtml + '</span>';
      }
      return '<div class="vw-ev-item">' +
        '<span class="vw-ev-id"><i class="fas fa-paperclip"></i> ' + _vProcessText(e.id || '') + '</span>' +
        '<span class="vw-ev-type">' + escapeHtml(e.type || '') + '</span>' +
        sourceHtml +
        (e.relevance ? '<span class="vw-ev-rel">' + _vProcessText(e.relevance) + '</span>' : '') +
        '</div>';
    }).join('');
    var inner = '<div class="vw-ev-list">' + items + '</div>';
    return _vSection('evidence', 'fa-folder-open', inner);
  }

  function _vRenderValidation(v) {
    var val = v.validation;
    if (!val || !val.results) return '';
    var rows = val.results.map(function (r) {
      var icon = r.result === 'aprovado' ? '✅' : (r.result === 'alerta' ? '⚠️' : '❌');
      var cls = r.result === 'aprovado' ? 'badge-ok' : (r.result === 'alerta' ? 'badge-warn' : 'badge-info');
      return '<tr>' +
        '<td>' + icon + '</td>' +
        '<td><code>' + escapeHtml(r.check) + '</code></td>' +
        '<td>' + escapeHtml(r.name) + '</td>' +
        '<td><span class="badge ' + cls + '">' + escapeHtml(r.result) + '</span></td>' +
        '<td class="vw-ev">' + _vProcessText(r.detail || '') + '</td>' +
        '</tr>';
    }).join('');
    var summary = val.summary ? ('<div style="margin-bottom:6px;font-size:11px;color:var(--gray)">' +
      '✅ ' + (val.summary.aprovado || 0) + ' · ⚠️ ' + (val.summary.alerta || 0) + ' · ❌ ' + (val.summary.falha || 0) +
      (val.note ? ' — ' + _vProcessText(val.note) : '') + '</div>') : '';
    var inner = summary +
      '<div class="vw-table-wrap"><table class="vw-table"><thead><tr><th></th><th>Check</th><th>Nome</th><th>Resultado</th><th>Detalhe</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    return _vSection('validation', 'fa-clipboard-check', inner);
  }

  function _vRenderRecommendationLog(v) {
    var log = v.recommendation_9_3_log || [];
    if (!log.length) return '';
    var rows = log.map(function (e) {
      return '<tr>' +
        '<td><span class="badge badge-info">' + escapeHtml(e.change) + '</span></td>' +
        '<td><code>' + _vProcessText(e.article || '') + '</code></td>' +
        '<td>' + _vProcessText(e.action || '') + '</td>' +
        '<td class="vw-ev">' + _vProcessText(e.rationale || '') + '</td>' +
        '</tr>';
    }).join('');
    var inner = '<div class="vw-table-wrap"><table class="vw-table"><thead><tr><th>Alteração</th><th>Artigo</th><th>Ação</th><th>Razão</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    return _vSection('rec_log', 'fa-clock-rotate-left', inner);
  }

  function _vFilePillsHtml(v) {
    var path = (v.provenance && v.provenance.source_path) || '';
    var fileName = path.split('/').pop() || (v.violation_id || 'violation') + '.json';
    var rel = v.jurisdiction ? (v.jurisdiction + '/' + fileName) : fileName;
    var url = ((typeof API_BASE !== 'undefined' && API_BASE) ? API_BASE : '') + '/api/violations/file?path=' + encodeURIComponent(rel);
    var pills = (typeof window.vwFilePills === 'function') ? window.vwFilePills(url, fileName, 'json') : '';
    return [
      '<div class="vw-file-pills">', pills,
      '<button class="btn-secondary" type="button" onclick="violationsOpenBranded()" title="Abrir versão HTML formatada"><i class="fas fa-external-link-alt"></i> Abrir HTML</button>',
      '<button class="btn-secondary" type="button" onclick="violationsAttachActive()"><i class="fas fa-paperclip"></i> Anexar</button>',
      '</div>',
    ].join('');
  }

  function _vStatusBadgeClass(status) {
    var s = String(status || '').toLowerCase();
    if (s === 'established' || s === 'ok' || s === 'pass') return 'badge-ok';
    if (s === 'contested' || s === 'warn' || s === 'weak') return 'badge-warn';
    if (s === 'pending' || s === 'open' || s === 'blocked') return 'badge-info';
    return 'badge-dim';
  }

  /* ── ACTIONS ── */
  var _vActiveAudio = null;
  var _vActiveBtn = null;
  window.violationsPlaySegment = function (btn) {
    var url = btn.getAttribute('data-audio');
    if (!url) return;
    if (_vActiveAudio && _vActiveAudio !== btn.__vwAudio) {
      _vActiveAudio.pause();
      if (_vActiveBtn) _vActiveBtn.innerHTML = '<i class="fas fa-play"></i>';
      _vActiveAudio = null;
      _vActiveBtn = null;
    }
    var audio = btn.__vwAudio;
    if (!audio) {
      audio = new Audio(url);
      audio.preload = 'metadata';
      btn.__vwAudio = audio;
      audio.addEventListener('ended', function () {
        btn.innerHTML = '<i class="fas fa-play"></i>';
        btn.classList.remove('playing');
        _vActiveAudio = null;
        _vActiveBtn = null;
      });
    }
    if (audio.paused) {
      audio.play().catch(function () { });
      btn.innerHTML = '<i class="fas fa-pause"></i>';
      btn.classList.add('playing');
      _vActiveAudio = audio;
      _vActiveBtn = btn;
    } else {
      audio.pause();
      btn.innerHTML = '<i class="fas fa-play"></i>';
      btn.classList.remove('playing');
      _vActiveAudio = null;
      _vActiveBtn = null;
    }
  };

  window.violationsInit = violationsInit;
  window.violationsRefresh = function () {
    _vio.initialized = false;
    violationsInit();
  };
  window.violationsFilterJur = function (jur) {
    _vio.filterJur = jur || 'all';
    _vio.filterPhase = 'all';
    _vRender();
  };
  window.violationsFilterSeverity = function (sev) {
    _vio.filterSeverity = sev || 'all';
    _vRenderTree();
  };
  window.violationsFilterPhase = function (phase) {
    _vio.filterPhase = phase || 'all';
    _vRenderPhaseChips();
    _vRenderTree();
  };
  window.violationsSetLang = function (lang, el) {
    if (!lang) return;
    lang = String(lang).toUpperCase();
    _vio.lang = lang;
    var host = _vById('violationsLangFlags');
    if (host && host.children) {
      Array.prototype.forEach.call(host.children, function (c) {
        c.classList.toggle('active', c.getAttribute('data-lang') === lang);
      });
    }
    if (_vio.view === 'violation' && _vio.activeId) {
      var entry = _findViolationEntry(_vio.activeId) || {};
      var jur = (_vio.activeFull && _vio.activeFull.jurisdiction) || entry.jurisdiction || 'all';
      window.violationsSelect(jur, null, _vio.activeId);
    }
  };
  window.violationsSearch = function (input) {
    _vio.searchQuery = String(input && input.value !== undefined ? input.value : input || '').trim();
    _vRenderTree();
  };
  window.violationsShowWelcome = function () {
    _vio.view = 'welcome';
    _vio.activeId = null;
    _vRender();
  };
  window.violationsShowReports = function () {
    _vio.view = 'reports';
    _vRender();
  };

  window.violationsSelect = async function (jur, path, vid) {
    _vio.activeId = vid;
    _vio.activePath = path;
    _vio.view = 'violation';
    _vio.activeFull = null;
    _vSetStatus('Abrindo ' + vid + '…', 'muted');
    _vRender();
    try {
      var base = (typeof API_BASE !== 'undefined' && API_BASE) ? API_BASE : '';
      var lang = _vio.lang || 'EN';
      var jsonPath = '_json/' + lang + '/' + vid + '.json';
      var res = await fetch(base + '/api/violations/file?path=' + encodeURIComponent(jsonPath));
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var data = await res.json();
      if (data.error) throw new Error(data.error);
      var parsed = JSON.parse(data.content);
      _vio.activeFull = parsed;
      _vSetStatus('Pronto.', 'ok');
    } catch (err) {
      var msg = (err && err.message) ? err.message : String(err);
      if (msg.indexOf('file not found') !== -1 || msg.indexOf('HTTP 404') !== -1) {
        _vSetStatus('Tradução ' + lang + ' indisponível para ' + vid + '.', 'warn');
      } else {
        _vSetStatus('Falha: ' + msg, 'error');
      }
    }
    _vRenderViewer();
  };

  window.violationsSelectById = async function (vid) {
    var entry = _findViolationEntry(vid);
    if (!entry) {
      _vSetStatus('Violação ' + vid + ' não encontrada no índice.', 'error');
      return;
    }
    var path = entry.path || ('_json/' + String(vid).toUpperCase() + '.json');
    await window.violationsSelect(entry.jurisdiction, path, String(vid).toUpperCase());
  };

  window.violationsOpenReport = async function (path) {
    _vio.view = 'report';
    _vio.activeReportPath = path;
    _vio.activeReportText = 'Carregando…';
    _vRender();
    try {
      var base = (typeof API_BASE !== 'undefined' && API_BASE) ? API_BASE : '';
      var res = await fetch(base + '/api/violations/file?path=' + encodeURIComponent(path));
      var data = await res.json();
      if (data.error) throw new Error(data.error);
      _vio.activeReportText = data.content || '';
    } catch (err) {
      _vio.activeReportText = 'Falha ao carregar: ' + (err && err.message ? err.message : err);
    }
    _vRenderViewer();
  };

  window.vwBuildViolationBrandedHtml = function (v) {
    v = v || {};

    // ── Normalise confidence ──
    var confValue = null;
    if (v.confidence) {
      if (typeof v.confidence === 'number') confValue = v.confidence;
      else if (v.confidence.value != null) confValue = Number(v.confidence.value);
    }
    var confidencePct = confValue != null ? Math.round(confValue * 100) + '%' : '—';

    // ── Normalise cross‑references ──
    var xrefs = v.cross_references || v.cross_refs || [];
    var xrefChips = xrefs.map(function (item) {
      var vid = '';
      if (typeof item === 'string') vid = item;
      else if (item && typeof item.ref === 'string') vid = item.ref;
      else return '';
      return '<span class="xref-chip">' + escapeHtml(vid.toUpperCase()) + '</span>';
    }).join('');

    // ── Actors (if any) ──
    var primary = v.primary_agents || [];
    var supporting = v.supporting_agents || [];
    var actorHtml = '';
    if (primary.length + supporting.length > 0) {
      actorHtml = '<div class="actors">' +
        primary.map(function (a) { return '<span class="actor primary">' + escapeHtml(a) + '</span>'; }).join('') +
        supporting.map(function (a) { return '<span class="actor supporting">' + escapeHtml(a) + '</span>'; }).join('') +
        '</div>';
    }

    // ── Legal basis (article cards) ──
    var articles = v.legal_basis || [];
    var articlesHtml = articles.map(function (a) {
      return '<div class="legal-article">' +
        '<div class="article-id">' + escapeHtml(a.article_id || '') + '</div>' +
        '<div class="article-text">' + escapeHtml(a.verbatim_text || a.article_text || '') + '</div>' +
        '</div>';
    }).join('');

    // ── Build the final HTML ──
    return `<!DOCTYPE html>
  <html lang="en">
  <head>
  <meta charset="UTF-8">
  <title>${escapeHtml(v.violation_id || 'Violation')} – OliviaLegal</title>
  <style>
    body { font-family: var(--font, sans-serif); background: var(--bg, #0e0e10); color: var(--gray-hi, #d4d4d4); margin: 0; padding: 24px; }
    .header { margin-bottom: 24px; }
    .eyebrow { font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: var(--amber, #ffb300); }
    h1 { margin: 4px 0; font-size: 22px; color: #fff; }
    .meta { display: flex; gap: 8px; flex-wrap: wrap; margin: 8px 0; }
    .pill { display: inline-block; padding: 2px 12px; border: 1px solid var(--border, #333); border-radius: 999px; font-size: 11px; color: var(--gray-hi); }
    .pill.sev-critical { border-color: #e53935; color: #e53935; }
    .summary, .theory, .probative, .nexus { margin-top: 16px; white-space: pre-wrap; font-size: 13px; line-height: 1.6; }
    .section-title { font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: var(--amber); margin: 20px 0 8px; border-bottom: 1px solid var(--border); padding-bottom: 4px; }
    .articles { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .legal-article { border: 1px solid var(--border); border-radius: 8px; padding: 12px; background: var(--bg-card, #1a1a1f); }
    .article-id { font-family: var(--mono); font-size: 11px; color: var(--amber); margin-bottom: 6px; }
    .article-text { font-size: 12px; }
    .xref-chip { display: inline-block; background: var(--bg-hi); border: 1px solid var(--border); border-radius: 16px; padding: 1px 10px; margin: 2px 4px; font-size: 10px; color: var(--gray-hi); }
    .actor { display: inline-block; background: #2a2a30; padding: 2px 8px; border-radius: 8px; font-size: 11px; margin-right: 6px; }
    .actor.primary { border-left: 3px solid var(--amber); }
    .actor.supporting { border-left: 3px solid #888; }
  </style>
  </head>
  <body>
  <div class="header">
    <div class="eyebrow">${escapeHtml(v.violation_id || '')} · ${escapeHtml(v.jurisdiction || '')}</div>
    <h1>${escapeHtml(v.title || 'Violation')}</h1>
    <div class="meta">
      <span class="pill sev-critical">${escapeHtml(v.severity || '')}</span>
      <span class="pill">confiança ${confidencePct}</span>
      <span class="pill">${escapeHtml(v.jurisdiction || '')}</span>
    </div>
  </div>
  ${v.allegation_summary ? '<div class="summary">' + escapeHtml(v.allegation_summary) + '</div>' : ''}
  ${v.legal_theory ? '<div class="section-title">Teoria Jurídica</div><div class="theory">' + escapeHtml(v.legal_theory) + '</div>' : ''}
  ${actorHtml ? '<div class="section-title">Atores</div>' + actorHtml : ''}
  ${articles.length ? '<div class="section-title">Base Legal</div><div class="articles">' + articlesHtml + '</div>' : ''}
  ${v.probative_chain ? '<div class="section-title">Cadeia Probatória</div><div class="probative">' + escapeHtml(v.probative_chain) + '</div>' : ''}
  ${xrefChips ? '<div class="section-title">Referências Cruzadas</div><div>' + xrefChips + '</div>' : ''}
  </body>
  </html>`;
  };

  window.violationsOpenBranded = function () {
    if (!_vio.activeFull || typeof window.vwBuildViolationBrandedHtml !== 'function'
      || typeof window.vwOpenBrandedHtml !== 'function') return;
    var v = _vio.activeFull;
    var html = window.vwBuildViolationBrandedHtml(v);
    var name = (v.violation_id || 'violation') + '.html';
    window.vwOpenBrandedHtml(html, name);
  };

  window.violationsAttachActive = function () {
    if (!_vio.activeFull) return;
    var v = _vio.activeFull;
    var key = 'violation:' + (v.violation_id || v.record_key || Math.random());
    var lines = [];
    lines.push('# ' + (v.violation_id || '') + ' — ' + (v.title || ''));
    lines.push('Jurisdiction: ' + (v.jurisdiction || '') + ' · Severity: ' + (v.severity || '') + ' · Status: ' + (v.status || ''));
    if (v.facts && v.facts.summary) lines.push('\n## Summary\n' + v.facts.summary);
    var frameworks = (v.legal_basis && v.legal_basis.frameworks) || [];
    if (frameworks.length) {
      lines.push('\n## Legal Basis');
      frameworks.forEach(function (fw) {
        lines.push('### ' + (fw.framework || ''));
        (fw.articles || []).forEach(function (a) {
          lines.push('- ' + (a.article_id || '') + (a.duty_bearer ? ' (' + a.duty_bearer + ')' : ''));
        });
      });
    }
    _vAttachShared(key, (v.violation_id || 'violation') + '.md', lines.join('\n'));
  };

  window.violationsAttachReport = function (path, name) {
    if (!path) return;
    var key = 'report:' + path;
    var doFetch = async function () {
      try {
        var base = (typeof API_BASE !== 'undefined' && API_BASE) ? API_BASE : '';
        var res = await fetch(base + '/api/violations/file?path=' + encodeURIComponent(path));
        var data = await res.json();
        if (data.error) throw new Error(data.error);
        _vAttachShared(key, name || data.filename || path, data.content || '');
      } catch (err) {
        _vSetStatus('Falha ao anexar: ' + (err && err.message ? err.message : err), 'error');
      }
    };
    doFetch();
  };

  function _vAttachShared(key, name, text) {
    if (!text) return;
    _vio.attached[key] = { name: name, length: text.length };
    if (typeof window.addSharedContextItem === 'function') {
      window.addSharedContextItem({
        key: 'violations:' + key,
        section: 'violations',
        title: name,
        inlineText: text,
      });
    } else if (typeof window._checkedShared === 'object' && window._checkedShared) {
      window._checkedShared['violations:' + key] = { section: 'violations', title: name, inlineText: text };
      if (typeof window.updateSharedContextBar === 'function') window.updateSharedContextBar();
    }
    _vUpdateContextBar();
    _vSetStatus('Anexado: ' + name, 'ok');
  }

  function _vUpdateContextBar() {
    var bar = _vById('violationsContextBar');
    var num = _vById('violationsContextNum');
    var count = Object.keys(_vio.attached).length;
    if (num) num.textContent = String(count);
    if (bar) bar.classList.toggle('empty', count === 0);
  }

  window.violationsClearContext = function () {
    Object.keys(_vio.attached).forEach(function (k) {
      if (window._checkedShared) delete window._checkedShared['violations:' + k];
    });
    _vio.attached = {};
    if (typeof window.updateSharedContextBar === 'function') window.updateSharedContextBar();
    _vUpdateContextBar();
  };
  window.clearViolationsContextState = window.violationsClearContext;

  // ── SIDEBAR TOGGLE ──
  window.violationsToggleSidebar = function () {
    var sidebar = document.getElementById('violationsSidebar');
    var toggleBtn = document.getElementById('violationsSidebarToggle');
    if (!sidebar) return;

    var isCollapsed = sidebar.classList.contains('collapsed');
    if (isCollapsed) {
      sidebar.classList.remove('collapsed');
      sidebar.style.width = '220px';
      if (toggleBtn) toggleBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
    } else {
      sidebar.classList.add('collapsed');
      sidebar.style.width = '0px';
      if (toggleBtn) toggleBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
    }
    window.dispatchEvent(new Event('resize'));
  };

  /* ── MAIN-VIEW SHOW / HIDE ── */
  var SECTION_VIEW_IDS = ['spacesView', 'listeningView', 'studioView', 'descobertaView', 'memoryView', 'shadersView', 'mermaidView', 'aexMainView', 'violationsView', 'lawLibView', 'legalRouterView'];

  function _vwHideOthers(keepId) {
    SECTION_VIEW_IDS.forEach(function (vid) {
      if (vid === keepId) return;
      var v = document.getElementById(vid);
      if (v) { v.classList.remove('active'); v.style.display = ''; }
    });
    if (typeof window.aexHideMain === 'function') window.aexHideMain();
    ['spacesHideView', 'listeningHideView', 'studioHideView', 'descobertaHideView', 'memoryHideView', 'shadersHideView', 'mermaidHideView', 'lawLibHideView', 'legalRouterHideView'].forEach(function (fn) {
      if (keepId === 'violationsView') return;
      try { if (fn !== 'violationsHideView' && typeof window[fn] === 'function') window[fn](); } catch (_e) { }
    });
  }

  window.violationsShowView = function () {
    var hide = ['chatHeader', 'welcomeState', 'chatLog', 'chatCompose', 'chatToolbar'];
    hide.forEach(function (id) { var el = document.getElementById(id); if (el) el.style.display = 'none'; });
    var mc = document.querySelector('.main-content');
    if (mc) { mc._vwDisplay = mc.style.display; mc.style.display = 'none'; }
    _vwHideOthers('violationsView');
    var sv = document.getElementById('violationsView');
    if (sv) sv.classList.add('active');
    if (typeof window.vwInitResize === 'function') window.vwInitResize('violationsResize', 'violationsSidebar');
    if (typeof window.vwInitEdgeResize === 'function') window.vwInitEdgeResize('violationsEdgeResize', 'violationsView');
    if (typeof violationsInit === 'function') violationsInit();

    // ── Inject sidebar toggle button (once) ──
    var sidebar = document.getElementById('violationsSidebar');
    if (sidebar && !document.getElementById('violationsSidebarToggle')) {
      var btn = document.createElement('button');
      btn.id = 'violationsSidebarToggle';
      btn.title = 'Toggle Sidebar';
      btn.innerHTML = '<i class="fas fa-chevron-left"></i>';
      btn.style.cssText = 'background:none;border:none;color:var(--gray);font-size:14px;cursor:pointer;padding:4px 8px;align-self:flex-start;margin:4px;';
      sidebar.prepend(btn);
    }
    var toggleBtn = document.getElementById('violationsSidebarToggle');
    if (toggleBtn) toggleBtn.onclick = window.violationsToggleSidebar;

    if (typeof window.oliviaRefreshSectionRuntimeUi === 'function') {
      try { window.oliviaRefreshSectionRuntimeUi(); } catch (_e) { }
    }
  };

  window.violationsHideView = function () {
    var sv = document.getElementById('violationsView');
    if (sv) { sv.classList.remove('active'); sv.style.flex = ''; sv.style.maxWidth = ''; }
    var mc = document.querySelector('.main-content');
    if (mc) { mc.style.display = mc._vwDisplay !== undefined ? mc._vwDisplay : ''; delete mc._vwDisplay; }
    var show = ['chatHeader', 'welcomeState', 'chatLog', 'chatCompose', 'chatToolbar'];
    show.forEach(function (id) { var el = document.getElementById(id); if (el) el.style.display = ''; });
  };

  window.violationsOpenEvidenceSource = function (path, evidenceId) {
    if (evidenceId && VIO_EVIDENCE_FILE_MAP[evidenceId]) {
      var filePath = VIO_EVIDENCE_FILE_MAP[evidenceId];
      var displayName = filePath.split('/').pop();
      if (typeof sharedOpenFileBrowser === 'function') {
        sharedOpenFileBrowser(filePath, displayName);
      } else {
        console.warn('sharedOpenFileBrowser not available');
      }
      return;
    }

    var urls = [
      '/api/shared/raw?path=' + encodeURIComponent(path),
      '/api/shared/raw?path=' + encodeURIComponent('cases/' + path),
      '/api/violations/file?path=' + encodeURIComponent(path.replace(/^LA8159\//, ''))
    ];
    _vFetchWithFallback(urls, function (err, content) {
      if (err) {
        _vSetStatus('Could not load transcript: ' + err.message, 'error');
        return;
      }
      _vShowModal('Evidence Transcript',
        '<pre style="white-space:pre-wrap;font-size:12px;line-height:1.5">' + escapeHtml(content) + '</pre>');
    });
  };

  // Inject CSS
  (function _injectRefStyles() {
    var styleId = 'violations-ref-styles';
    if (document.getElementById(styleId)) return;
    var style = document.createElement('style');
    style.id = styleId;
    style.textContent = `

    /* ================================================================
   VIOLATIONS REF & SEGMENT STYLES
   ================================================================ */

/* ── Reference links (icon + hover swap) ── */
.ref-link {
  display: inline-flex;
  align-items: center;
  gap: 0.1rem;
  position: relative;
  color: #ddd;
  text-decoration: none;
  font-size: 0.72rem;
  transition: color 0.15s, background 0.15s;
}
.ref-link::before {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.2rem;
  height: 1.2rem;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.15);
  background: rgba(255,255,255,0.05);
  flex-shrink: 0;
  font-size: 0.72rem;
  transition: background 0.15s, border-color 0.15s;
}
.ref-link[data-type="speaker"]::before   { content: "👤"; }
.ref-link[data-type="violation"]::before { content: "⚖"; }
.ref-link[data-type="evidence"]::before  { content: "📄"; }
.ref-link[data-type="law"]::before       { content: "§"; }
.ref-link[data-type="framework"]::before { content: "📚"; }
.ref-link[data-type="reference"]::before { content: "↗"; }

.ref-text {
  opacity: 1;
  transition: opacity 0.15s;
}
.ref-role {
  position: absolute;
  left: 1.5rem;
  opacity: 0;
  font-weight: 600;
  color: var(--amber);
  transition: opacity 0.15s;
  pointer-events: none;
  white-space: nowrap;
  background: var(--bg-card);
  padding: 0 4px;
  border-radius: 3px;
}

.ref-link:hover {
  color: #fff;
}
.ref-link:hover::before {
  background: rgba(255,215,0,0.15);
  border-color: var(--amber);
}
.ref-link:hover .ref-text {
  opacity: 0;
}
.ref-link:hover .ref-role {
  opacity: 1;
}
.ref-link:focus-visible {
  outline: 1px solid var(--amber);
  outline-offset: 1px;
}

/* ── Segment time (hover expand) ── */
.vw-seg-time {
  display: inline-flex;
  align-items: center;
  overflow: hidden;
  vertical-align: middle;
  margin-right: 0.55rem;
}
.vw-seg-time-icon {
  color: #7b3d1aff;
  font-size: 0.82rem;
}
.vw-time-text {
  max-width: 0;
  opacity: 0;
  overflow: hidden;
  font-size: 10px;
  white-space: nowrap;
  margin-left: 0;
  transition:
    max-width 0.18s ease,
    opacity 0.18s ease,
    margin-left 0.18s ease;
}
.vw-seg-time:hover .vw-time-text {
  max-width: 70px;  /* adjust to your longest time string */
  opacity: 1;
  margin-left: 0.35rem;
}

/* ── Speaker + gap ── */
.vw-seg-who {
  font-weight: 600;
  margin-right: 0.45rem;
}
.vw-seg-gap {
  display: inline-block;
  width: 0.35rem;
}

/* ── Play button ── */
.vw-seg-play {
  margin-right: 0.25rem;
  background: none;
  border: none;
  color: var(--amber);
  cursor: pointer;
}

/* ── Other components (preserved) ── */
#refModal {
  font-family: var(--font, sans-serif);
  color: var(--gray-hi);
}
#refModalContent {
  max-height: 80vh;
  overflow-y: auto;
}
#refModalContent pre {
  white-space: pre-wrap;
  font-size: 12px;
  line-height: 1.5;
  padding: 10px;
  background: var(--bg);
  border-radius: 6px;
  border: 1px solid var(--border);
}

.vw-xref-chip {
  background: var(--bg-hi);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 2px 12px;
  margin: 2px 4px;
  font-size: 11px;
  color: var(--gray-hi);
  cursor: pointer;
  transition: all 0.2s;
}
.vw-xref-chip:hover {
  background: var(--amber);
  color: #000;
  border-color: var(--amber);
}

.vw-chain-table {
  width: 100%;
  border-collapse: collapse;
  margin: 0.5em 0;
}
.vw-chain-table th, .vw-chain-table td {
  border: 1px solid #ccc;
  padding: 4px 8px;
  vertical-align: top;
  text-align: left;
}
.vw-chain-table th {
  background-color: #f5f5f5;
  font-weight: bold;
  color: #333;
}
.vw-v-chain-wrapper {
  overflow-x: auto;
}

.vw-ev-src-link {
  cursor: pointer;
  text-decoration: underline dotted;
  color: var(--amber);
}
.vw-ev-src-link:hover {
  background: rgba(255,215,0,0.1);
}

/* Sidebar collapse */
#violationsSidebar {
  transition: width 0.25s ease;
  overflow: hidden;
}
#violationsSidebar.collapsed {
  min-width: 0 !important;
  border-right: none;
}
#violationsSidebar.collapsed #violationsSidebarToggle {
  position: absolute;
  left: 0;
  top: 8px;
  z-index: 10;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-card);
  border-right: 1px solid var(--border);
  border-radius: 0 6px 6px 0;
}
    `;
    document.head.appendChild(style);
  })();

})();