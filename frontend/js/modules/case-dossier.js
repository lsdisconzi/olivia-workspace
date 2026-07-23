/* Case dossier — single consolidated entry point that points to the
 * canonical sources of truth for the LA8159 case. Pulls /api/case/dossier
 * and renders a tabbed modal: Resumo, Linha do Tempo, Violações, Índices.
 */
(function () {
  if (window.caseDossierOpen) return;

  var _state = { data: null, tab: 'overview' };

  function _fmtNum(n) {
    if (n == null) return '—';
    return String(n);
  }

  function _ensureModal() {
    var m = document.getElementById('caseDossierModal');
    if (m) return m;
    m = document.createElement('div');
    m.id = 'caseDossierModal';
    m.style.cssText = [
      'position:fixed', 'inset:0', 'background:rgba(0,0,0,0.65)',
      'display:none', 'align-items:flex-start', 'justify-content:center',
      'z-index:9998', 'padding:30px 20px', 'overflow-y:auto',
    ].join(';');
    m.innerHTML = ''
      + '<div style="background:var(--bg, #fff);color:var(--gray-hi,#222);max-width:1100px;width:100%;'
      +   'max-height:calc(100vh - 60px);overflow:hidden;border:1px solid var(--border,#ccc);'
      +   'border-radius:12px;box-shadow:0 24px 80px rgba(0,0,0,0.5);display:flex;flex-direction:column">'
      +   '<div style="display:flex;align-items:center;gap:14px;padding:16px 20px;border-bottom:1px solid var(--border,#ccc)">'
      +     '<div style="font-weight:700;font-size:15px;flex:1"><i class="fas fa-folder-open" style="color:var(--amber);margin-right:8px"></i>Dossiê do Caso LA8159</div>'
      +     '<button class="btn-xs" type="button" onclick="caseDossierRefresh()" title="Recarregar"><i class="fas fa-sync-alt"></i></button>'
      +     '<button class="btn-xs" type="button" onclick="caseDossierClose()" title="Fechar (Esc)"><i class="fas fa-times"></i></button>'
      +   '</div>'
      +   '<div id="caseDossierTabs" style="display:flex;gap:0;padding:0 20px;border-bottom:1px solid var(--border,#ccc);background:var(--bg-soft,rgba(0,0,0,0.04))">'
      +     '<button class="cd-tab" data-tab="overview" type="button" onclick="caseDossierShowTab(\'overview\')">Resumo</button>'
      +     '<button class="cd-tab" data-tab="timeline" type="button" onclick="caseDossierShowTab(\'timeline\')">Linha do Tempo</button>'
      +     '<button class="cd-tab" data-tab="violations" type="button" onclick="caseDossierShowTab(\'violations\')">Violações</button>'
      +     '<button class="cd-tab" data-tab="indices" type="button" onclick="caseDossierShowTab(\'indices\')">Índices &amp; Documentos</button>'
      +   '</div>'
      +   '<div id="caseDossierBody" style="padding:18px 22px;font-size:13px;line-height:1.55;overflow-y:auto;flex:1">'
      +     '<div style="color:var(--gray,#666)"><i class="fas fa-spinner fa-spin"></i> Carregando dossiê…</div>'
      +   '</div>'
      + '</div>';
    document.body.appendChild(m);
    // Inject minimal tab styles
    if (!document.getElementById('caseDossierStyles')) {
      var s = document.createElement('style');
      s.id = 'caseDossierStyles';
      s.textContent = ''
        + '.cd-tab{background:transparent;border:none;border-bottom:2px solid transparent;'
        + '  padding:10px 14px;font-size:12px;cursor:pointer;color:var(--gray,#666);font-weight:600}'
        + '.cd-tab.active{color:var(--amber);border-bottom-color:var(--amber)}'
        + '.cd-tab:hover{color:var(--gray-hi,#222)}'
        + '.cd-section{margin-bottom:18px}'
        + '.cd-section h4{margin:0 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:var(--amber)}'
        + '.cd-pill{display:inline-block;padding:2px 8px;border:1px solid var(--border,#ccc);border-radius:10px;font-size:11px;margin:2px 4px 2px 0;background:var(--bg,#fff)}'
        + '.cd-row{display:flex;justify-content:space-between;gap:12px;padding:6px 8px;border-bottom:1px dashed var(--border,#ccc);font-size:12px}'
        + '.cd-row:last-child{border-bottom:none}'
        + '.cd-row code{font-family:monospace;font-size:11px;color:var(--gray-hi,#222)}'
        + '.cd-tl-event{padding:8px 10px;border-left:3px solid var(--amber);background:rgba(0,0,0,0.02);margin-bottom:6px;font-size:12px;border-radius:0 4px 4px 0}'
        + '.cd-tl-event .cd-tl-date{font-family:monospace;font-size:11px;color:var(--amber);font-weight:600}'
        + '.cd-tl-event .cd-tl-title{color:var(--gray-hi,#222);margin-top:2px}'
        + '.cd-tl-event .cd-tl-desc{color:var(--gray,#666);margin-top:4px;font-size:11.5px}'
        + '.cd-vio-row{display:flex;gap:10px;align-items:center;padding:6px 8px;border-bottom:1px dashed var(--border,#ccc);cursor:pointer}'
        + '.cd-vio-row:hover{background:rgba(0,0,0,0.04)}'
        + '.cd-vio-id{font-family:monospace;font-weight:700;color:var(--amber);font-size:11px;min-width:70px}'
        + '.cd-sev-CRITICAL{color:#e53935}.cd-sev-HIGH{color:#fb8c00}.cd-sev-MEDIUM{color:#fbc02d}.cd-sev-LOW{color:#43a047}';
      document.head.appendChild(s);
    }
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && m.style.display !== 'none') window.caseDossierClose();
    });
    return m;
  }

  function _renderTabs() {
    document.querySelectorAll('#caseDossierTabs .cd-tab').forEach(function (b) {
      b.classList.toggle('active', b.dataset.tab === _state.tab);
    });
  }

  function _renderOverview(d) {
    var v = d.violations || {};
    var a = d.agents || {};
    var ts = d.timeline_summary || {};
    var html = ''
      + '<div class="cd-section"><h4>Caso</h4>'
      +   '<div style="font-size:14px;color:var(--gray-hi,#222);margin-bottom:6px">' + escapeHtml(d.case || '—') + '</div>'
      +   '<div style="font-size:12px;color:var(--gray,#666)">Passageiro principal: <strong>' + escapeHtml(d.primary_passenger || '—') + '</strong></div>'
      +   (Array.isArray(d.incident_dates) ? '<div style="margin-top:6px">' + d.incident_dates.map(function (x) { return '<span class="cd-pill">' + escapeHtml(x) + '</span>'; }).join('') + '</div>' : '')
      + '</div>'
      + '<div class="cd-section"><h4>Violações</h4>'
      +   '<div>Total: <strong>' + _fmtNum(v.total) + '</strong></div>'
      +   (v.by_jurisdiction ? '<div style="margin-top:6px">Por jurisdição: ' + Object.keys(v.by_jurisdiction).map(function (k) { return '<span class="cd-pill">' + escapeHtml(k) + ': ' + escapeHtml(v.by_jurisdiction[k]) + '</span>'; }).join('') + '</div>' : '')
      +   (v.by_severity ? '<div style="margin-top:4px">Por severidade: ' + Object.keys(v.by_severity).map(function (k) { return '<span class="cd-pill cd-sev-' + escapeHtml(k) + '">' + escapeHtml(k) + ': ' + escapeHtml(v.by_severity[k]) + '</span>'; }).join('') + '</div>' : '')
      + '</div>'
      + '<div class="cd-section"><h4>Agentes</h4>'
      +   '<div>Total: <strong>' + _fmtNum(a.total) + '</strong></div>'
      +   (a.by_jurisdiction ? '<div style="margin-top:6px">Por jurisdição: ' + Object.keys(a.by_jurisdiction).map(function (k) { return '<span class="cd-pill">' + escapeHtml(k) + ': ' + escapeHtml(a.by_jurisdiction[k]) + '</span>'; }).join('') + '</div>' : '')
      + '</div>'
      + '<div class="cd-section"><h4>Linha do Tempo</h4>'
      +   '<div>Total de eventos: <strong>' + _fmtNum(ts.total_events) + '</strong></div>'
      + '</div>'
      + '<div class="cd-section"><h4>Ferramentas (API)</h4>'
      +   '<div style="font-family:monospace;font-size:11px;color:var(--gray-hi,#222)">'
      +     (Array.isArray(d.tools) ? d.tools.map(function (t) {
            return '<div class="cd-row"><code>' + escapeHtml(t.method) + ' ' + escapeHtml(t.path) + '</code><span style="color:var(--gray,#666)">' + escapeHtml(t.desc) + '</span></div>';
          }).join('') : '')
      +   '</div>'
      + '</div>';
    return html;
  }

  function _renderTimeline(d) {
    var events = Array.isArray(d.timeline_events) ? d.timeline_events : [];
    if (!events.length) return '<div style="color:var(--gray,#666)">Nenhum evento registrado.</div>';
    return '<div class="cd-section"><h4>Eventos (' + events.length + ')</h4>'
      + events.map(function (e) {
        var date = e.date || e.timestamp || e.ts || e.start_date || '';
        var title = e.title || e.summary || e.event || e.label || '';
        var desc = e.description || e.details || e.notes || '';
        return '<div class="cd-tl-event">'
          + '<div class="cd-tl-date">' + escapeHtml(date) + '</div>'
          + '<div class="cd-tl-title">' + escapeHtml(title) + '</div>'
          + (desc ? '<div class="cd-tl-desc">' + escapeHtml(String(desc).slice(0, 320)) + (String(desc).length > 320 ? '…' : '') + '</div>' : '')
          + '</div>';
      }).join('')
      + '</div>';
  }

  function _renderViolations(d) {
    var top = Array.isArray(d.violations_top) ? d.violations_top : [];
    if (!top.length) return '<div style="color:var(--gray,#666)">Catálogo de violações validadas não disponível.</div>';
    return '<div class="cd-section"><h4>Violações validadas (' + top.length + ')</h4>'
      + top.map(function (v) {
        return '<div class="cd-vio-row" onclick="caseDossierOpenViolation(\'' + escapeHtml(v.id || '') + '\')">'
          + '<span class="cd-vio-id">' + escapeHtml(v.id || '—') + '</span>'
          + '<span class="cd-pill">' + escapeHtml(v.jurisdiction || '') + '</span>'
          + '<span class="cd-pill cd-sev-' + escapeHtml(v.severity || '') + '">' + escapeHtml(v.severity || '') + '</span>'
          + '<span style="flex:1;font-size:12px;color:var(--gray-hi,#222);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escapeHtml(v.title || '') + '</span>'
          + '<span style="font-size:11px;color:var(--gray,#666)">' + escapeHtml(v.incident_date || '') + '</span>'
          + '</div>';
      }).join('')
      + '</div>';
  }

  function _renderIndices(d) {
    var idx = Array.isArray(d.indices) ? d.indices : [];
    var pointers = d.doc_pointers || {};
    return ''
      + '<div class="cd-section"><h4>Master Indexes &amp; Mapas</h4>'
      +   '<div style="font-size:12px;color:var(--gray,#666);margin-bottom:8px">Esta é a fonte canônica. Não duplicar índices em outros locais — usar apenas o orquestrador para regenerar.</div>'
      +   idx.map(function (i) {
        var sizeKb = i.size ? Math.round(i.size / 1024) + ' KB' : '';
        return '<div class="cd-row">'
          + '<div><strong style="color:var(--gray-hi,#222)">' + escapeHtml(i.label) + '</strong>'
          + (i.count != null ? ' <span class="cd-pill">' + escapeHtml(i.count) + ' itens</span>' : '')
          + '</div>'
          + '<div style="display:flex;align-items:center;gap:8px"><code>' + escapeHtml(i.path) + '</code>'
          + '<span style="font-size:11px;color:var(--gray,#666)">' + escapeHtml(sizeKb) + '</span></div>'
          + '</div>';
      }).join('')
      + '</div>'
      + '<div class="cd-section"><h4>Documentação do caso</h4>'
      +   Object.keys(pointers).map(function (k) {
        return '<div class="cd-row">'
          + '<span style="color:var(--gray-hi,#222)">' + escapeHtml(k) + '</span>'
          + '<code>' + escapeHtml(pointers[k]) + '</code>'
          + '</div>';
      }).join('')
      + '</div>';
  }

  function _render() {
    var body = document.getElementById('caseDossierBody');
    if (!body) return;
    var d = _state.data;
    if (!d) {
      body.innerHTML = '<div style="color:var(--gray,#666)"><i class="fas fa-spinner fa-spin"></i> Carregando dossiê…</div>';
      return;
    }
    if (d.error) {
      body.innerHTML = '<div style="color:#e53935">Erro: ' + escapeHtml(d.error) + '</div>';
      return;
    }
    _renderTabs();
    if (_state.tab === 'overview') body.innerHTML = _renderOverview(d);
    else if (_state.tab === 'timeline') body.innerHTML = _renderTimeline(d);
    else if (_state.tab === 'violations') body.innerHTML = _renderViolations(d);
    else if (_state.tab === 'indices') body.innerHTML = _renderIndices(d);
  }

  function _load() {
    _state.data = null;
    _render();
    fetch('/api/case/dossier')
      .then(function (r) { return r.json(); })
      .then(function (d) { _state.data = d; _render(); })
      .catch(function (err) { _state.data = { error: String(err) }; _render(); });
  }

  window.caseDossierOpen = function () {
    _ensureModal().style.display = 'flex';
    if (!_state.data) _load();
    else _render();
  };
  window.caseDossierClose = function () {
    var m = document.getElementById('caseDossierModal');
    if (m) m.style.display = 'none';
  };
  window.caseDossierRefresh = function () { _load(); };
  window.caseDossierShowTab = function (tab) { _state.tab = tab; _render(); };
  window.caseDossierOpenViolation = function (vid) {
    if (!vid) return;
    if (typeof window.violationsOpenById === 'function') {
      window.caseDossierClose();
      window.violationsOpenById(vid);
    } else if (typeof window.legalRouterResolve === 'function') {
      window.caseDossierClose();
      window.legalRouterResolve(vid);
    } else {
      window.open('/api/case/violation/' + encodeURIComponent(vid), '_blank');
    }
  };
})();
