/* ==================================================================
  MASTER INDEX MODULE - Jurisprudence index explorer
   Loads data/master_index/master_index.{json,md} and provides:
   - sidebar navigation (overview, markdown, per-document entries)
   - tribunal/search filters
   - detail viewer + attach-to-chat actions
  ================================================================== */

(function () {
  'use strict';

  var MI_JSON_PATHS = [
    './data/master_index/master_index.json',
  ];

  var MI_MD_PATHS = [
    './data/master_index/master_index.md',
  ];

  var MI_STATUS_API = '/api/master-index/status';

  var MI_MD_PREVIEW_CHARS = 24000;
  var MI_ATTACH_MAX_CHARS = 50000;

  var _mi = {
    initialized: false,
    available: false,
    index: null,
    markdown: '',
    sourcePaths: {
      json: './data/master_index/master_index.json',
      md: './data/master_index/master_index.md',
    },
    selected: { type: 'overview' }, // overview | markdown | doc
    filterCourt: 'all',
    searchQuery: '',
    docMap: Object.create(null),
    attached: Object.create(null),
  };

  function _miById(id) { return document.getElementById(id); }

  function _miEsc(text) {
    if (typeof window.escapeHtml === 'function') return window.escapeHtml(text);
    var div = document.createElement('div');
    div.textContent = String(text == null ? '' : text);
    return div.innerHTML;
  }

  function _miSetStatus(message, tone) {
    var el = _miById('masterIndexStatus');
    if (!el) return;
    el.textContent = String(message || '');
    var color = 'var(--gray)';
    if (tone === 'error') color = 'var(--red)';
    else if (tone === 'ok') color = 'var(--green, #5aa469)';
    else if (tone === 'warn') color = 'var(--amber)';
    el.style.color = color;
  }

  function _miUniquePaths(paths) {
    var seen = Object.create(null);
    return (paths || []).filter(function (p) {
      var key = String(p || '').trim();
      if (!key || seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  async function _miFetchWithFallback(paths, asJson) {
    var lastErr = null;
    var list = _miUniquePaths(paths);
    for (var i = 0; i < list.length; i++) {
      var path = list[i];
      try {
        var res = await fetch(path, { cache: 'no-cache' });
        if (!res.ok) throw new Error('HTTP ' + res.status + ' @ ' + path);
        var payload = asJson ? await res.json() : await res.text();
        return { payload: payload, path: path };
      } catch (err) {
        lastErr = err;
      }
    }
    throw (lastErr || new Error('Arquivo nao encontrado.'));
  }

  async function _miLoadRuntimeStatus() {
    try {
      var base = (typeof API_BASE !== 'undefined' && API_BASE) ? API_BASE : '';
      var res = await fetch(base + MI_STATUS_API, { cache: 'no-cache' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var payload = await res.json();
      return (payload && typeof payload === 'object') ? payload : null;
    } catch (err) {
      return null;
    }
  }

  function _miDocs() {
    if (!_mi.index || !_mi.index.documents || !Array.isArray(_mi.index.documents)) return [];
    return _mi.index.documents;
  }

  function _miDocKey(doc) {
    return String((doc && (doc.id || doc.numero_processo || doc.cnj_numero || doc.cdacordao)) || '');
  }

  function _miBuildDocMap() {
    _mi.docMap = Object.create(null);
    _miDocs().forEach(function (doc) {
      var key = _miDocKey(doc);
      if (key) _mi.docMap[key] = doc;
    });
  }

  function _miCourtCounts() {
    var direct = (_mi.index && _mi.index.by_tribunal) || null;
    if (direct && typeof direct === 'object') return direct;
    var counts = Object.create(null);
    _miDocs().forEach(function (doc) {
      var court = String((doc && doc.tribunal) || 'OUTROS');
      counts[court] = (counts[court] || 0) + 1;
    });
    return counts;
  }

  function _miTotalDocuments() {
    if (_mi.index && _mi.index.total_documents != null) return Number(_mi.index.total_documents) || 0;
    return _miDocs().length;
  }

  function _miMatchesDoc(doc) {
    if (!doc) return false;
    if (_mi.filterCourt !== 'all' && String(doc.tribunal || 'OUTROS') !== _mi.filterCourt) return false;
    if (!_mi.searchQuery) return true;
    var q = _mi.searchQuery.toLowerCase();
    var haystack = [
      doc.id,
      doc.tribunal,
      doc.numero_processo,
      doc.cnj_numero,
      doc.relator,
      doc.comarca,
      doc.assunto,
      doc.tipo_processo,
      (doc.outcomes || []).join(' '),
      (doc.search_terms || []).join(' '),
    ].map(function (v) { return String(v || '').toLowerCase(); }).join(' ');
    return haystack.indexOf(q) !== -1;
  }

  function _miSortDocs(a, b) {
    var courtA = String((a && a.tribunal) || '');
    var courtB = String((b && b.tribunal) || '');
    if (courtA !== courtB) return courtA < courtB ? -1 : 1;

    var dA = String((a && (a.data_julgamento || a.data_publicacao || a.data_registro || a.downloaded_at)) || '');
    var dB = String((b && (b.data_julgamento || b.data_publicacao || b.data_registro || b.downloaded_at)) || '');
    if (dA !== dB) return dA > dB ? -1 : 1;

    var idA = _miDocKey(a);
    var idB = _miDocKey(b);
    return idA < idB ? -1 : (idA > idB ? 1 : 0);
  }

  function _miFormatWhen(doc) {
    if (!doc) return '-';
    return String(doc.data_julgamento || doc.data_publicacao || doc.data_registro || doc.downloaded_at || '-');
  }

  function _miRenderCourtChips() {
    var host = _miById('masterIndexCourtChips');
    if (!host) return;

    if (!_mi.available || !_mi.index) {
      host.innerHTML = '';
      return;
    }

    var counts = _miCourtCounts();
    var courts = Object.keys(counts).sort(function (a, b) {
      var ca = Number(counts[a] || 0);
      var cb = Number(counts[b] || 0);
      if (ca !== cb) return cb - ca;
      return a < b ? -1 : 1;
    });

    var html = [];
    var allActive = _mi.filterCourt === 'all' ? ' active' : '';
    html.push(
      '<span class="vw-chip' + allActive + '" data-court="all" onclick="masterIndexFilterCourt(\'all\',this)">' +
      'Todos | ' + _miEsc(String(_miTotalDocuments())) +
      '</span>'
    );

    courts.forEach(function (court) {
      var encoded = encodeURIComponent(court);
      var active = (_mi.filterCourt === court) ? ' active' : '';
      html.push(
        '<span class="vw-chip' + active + '" data-court="' + _miEsc(court) + '" onclick="masterIndexFilterCourt(\'' + encoded + '\',this)">' +
        _miEsc(court) + ' | ' + _miEsc(String(counts[court] || 0)) +
        '</span>'
      );
    });

    host.innerHTML = html.join('');
  }

  function _miTreeEntry(label, hint, onclick, active, icon) {
    return [
      '<div class="mi-tree-item' + (active ? ' active' : '') + '" onclick="' + onclick + '"',
      ' style="padding:8px 10px;border-radius:6px;cursor:pointer;margin:2px 4px;border:1px solid transparent;',
      active ? 'background:var(--bg-hi);border-color:var(--amber)' : '',
      '">',
      '<div style="font-size:12px;color:var(--gray-hi);font-weight:600;line-height:1.3">',
      icon ? ('<i class="' + icon + '" style="color:var(--amber);margin-right:6px"></i>') : '',
      _miEsc(label),
      '</div>',
      hint ? ('<div style="font-size:11px;color:var(--gray);line-height:1.35;margin-top:3px">' + _miEsc(hint) + '</div>') : '',
      '</div>',
    ].join('');
  }

  function _miRenderTree() {
    var tree = _miById('masterIndexTree');
    if (!tree) return;

    if (!_mi.available) {
      tree.innerHTML = '<div style="padding:12px;color:var(--gray);font-size:11px">Master index indisponivel para este runtime.</div>';
      return;
    }

    var html = [];
    html.push(_miTreeEntry(
      'Visao Geral',
      'Totais, distribuicoes e estado das pipelines',
      'masterIndexSelectOverview()',
      _mi.selected.type === 'overview',
      'fas fa-chart-line'
    ));

    html.push(_miTreeEntry(
      'Arquivo master_index.md',
      'Navegacao completa em markdown',
      'masterIndexSelectMarkdown()',
      _mi.selected.type === 'markdown',
      'fas fa-file-lines'
    ));

    var docs = _miDocs().filter(_miMatchesDoc).sort(_miSortDocs);
    var grouped = Object.create(null);
    docs.forEach(function (doc) {
      var court = String((doc && doc.tribunal) || 'OUTROS');
      if (!grouped[court]) grouped[court] = [];
      grouped[court].push(doc);
    });

    var courts = Object.keys(grouped).sort(function (a, b) {
      if (grouped[a].length !== grouped[b].length) return grouped[b].length - grouped[a].length;
      return a < b ? -1 : 1;
    });

    if (!courts.length) {
      html.push('<div style="padding:12px;color:var(--gray);font-size:11px">Nenhum documento para este filtro.</div>');
      tree.innerHTML = html.join('');
      return;
    }

    courts.forEach(function (court) {
      html.push(
        '<div style="font-size:10px;letter-spacing:.12em;color:var(--amber);text-transform:uppercase;padding:8px 8px 6px">' +
        _miEsc(court) + ' <span style="color:var(--gray)">| ' + _miEsc(String(grouped[court].length)) + '</span>' +
        '</div>'
      );

      grouped[court].forEach(function (doc) {
        var key = _miDocKey(doc);
        var active = (_mi.selected.type === 'doc' && _mi.selected.id === key);
        var encoded = encodeURIComponent(key);
        var title = String(doc.numero_processo || doc.cnj_numero || doc.id || key);
        var hint = [_miFormatWhen(doc), doc.relator || '', (doc.outcomes || []).slice(0, 2).join(', ')].filter(Boolean).join(' | ');
        html.push(_miTreeEntry(title, hint, 'masterIndexSelectDoc(\'' + encoded + '\')', active, 'fas fa-scale-balanced'));
      });
    });

    tree.innerHTML = html.join('');
  }

  function _miTableFromObject(obj, keyLabel, valueLabel, limit) {
    if (!obj || typeof obj !== 'object') return '';
    var keys = Object.keys(obj);
    if (!keys.length) return '';
    keys.sort(function (a, b) {
      var av = Number(obj[a] || 0);
      var bv = Number(obj[b] || 0);
      if (av !== bv) return bv - av;
      return a < b ? -1 : 1;
    });
    if (limit && limit > 0) keys = keys.slice(0, limit);

    var rows = keys.map(function (k) {
      return '<tr><td style="padding:6px 8px;color:var(--gray-hi)">' + _miEsc(k) + '</td><td style="padding:6px 8px;color:var(--amber);font-family:var(--mono);text-align:right">' + _miEsc(String(obj[k])) + '</td></tr>';
    }).join('');

    return [
      '<table style="width:100%;border-collapse:collapse;border:1px solid var(--border);border-radius:8px;overflow:hidden">',
      '<thead><tr style="background:var(--bg-hi)">',
      '<th style="padding:7px 8px;text-align:left;font-size:11px;color:var(--gray);font-weight:500">' + _miEsc(keyLabel || 'Chave') + '</th>',
      '<th style="padding:7px 8px;text-align:right;font-size:11px;color:var(--gray);font-weight:500">' + _miEsc(valueLabel || 'Total') + '</th>',
      '</tr></thead>',
      '<tbody>', rows, '</tbody>',
      '</table>',
    ].join('');
  }

  function _miOverviewHtml() {
    var idx = _mi.index || {};
    var total = _miTotalDocuments();
    var jobs = Number(idx.search_jobs_count || 0);
    var generated = String(idx.generated_at || '');
    var qdrant = (idx.qdrant && typeof idx.qdrant === 'object') ? idx.qdrant : null;
    var awareness = (idx.awareness && typeof idx.awareness === 'object') ? idx.awareness : null;

    var qdrantStatus = qdrant
      ? (qdrant.ok ? 'Qdrant: OK' : 'Qdrant: erro')
      : 'Qdrant: sem dados';

    var qdrantTone = qdrant && qdrant.ok ? 'var(--green, #5aa469)' : 'var(--amber)';

    var byCourt = _miTableFromObject(idx.by_tribunal, 'Tribunal', 'Total', 12);
    var byYear = _miTableFromObject(idx.by_year, 'Ano', 'Total', 12);
    var byOutcome = _miTableFromObject(idx.by_outcome, 'Outcome', 'Total', 15);

    return [
      '<div style="padding:24px;max-width:980px">',
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:14px">',
      '<div>',
      '<div style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--amber)">Jurisprudence Master Index</div>',
      '<h2 style="margin:4px 0 0;color:var(--gray-hi)">Visao consolidada da base</h2>',
      generated ? ('<div style="margin-top:6px;font-size:11px;color:var(--gray);font-family:var(--mono)">Gerado em: ' + _miEsc(generated) + '</div>') : '',
      '</div>',
      '<div style="display:flex;gap:6px;align-items:center">',
      (typeof window.vwFilePills === 'function') ? window.vwFilePills(_mi.sourcePaths.json, 'master_index.json', 'json') : '',
      '<button class="btn-secondary" onclick="masterIndexAttachActive()"><i class="fas fa-paperclip"></i> Anexar ao chat</button>',
      '</div>',
      '</div>',

      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-bottom:16px">',
      '<div style="padding:12px;border:1px solid var(--border);border-radius:8px;background:var(--bg)">',
      '<div style="font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--gray)">Documentos</div>',
      '<div style="margin-top:4px;font-size:20px;color:var(--white);font-weight:600">' + _miEsc(String(total)) + '</div>',
      '</div>',
      '<div style="padding:12px;border:1px solid var(--border);border-radius:8px;background:var(--bg)">',
      '<div style="font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--gray)">Jobs</div>',
      '<div style="margin-top:4px;font-size:20px;color:var(--white);font-weight:600">' + _miEsc(String(jobs)) + '</div>',
      '</div>',
      '<div style="padding:12px;border:1px solid var(--border);border-radius:8px;background:var(--bg)">',
      '<div style="font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--gray)">Pipeline</div>',
      '<div style="margin-top:4px;font-size:13px;color:' + qdrantTone + ';font-weight:600">' + _miEsc(qdrantStatus) + '</div>',
      '</div>',
      '<div style="padding:12px;border:1px solid var(--border);border-radius:8px;background:var(--bg)">',
      '<div style="font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--gray)">Awareness</div>',
      '<div style="margin-top:4px;font-size:13px;color:var(--gray-hi);font-weight:600">' + _miEsc(String(awareness && awareness.enabled ? 'enabled' : 'disabled')) + '</div>',
      '</div>',
      '</div>',

      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px">',
      '<div><h3 style="margin:0 0 8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--amber)">Por tribunal</h3>' + (byCourt || '<div style="color:var(--gray);font-size:12px">Sem dados.</div>') + '</div>',
      '<div><h3 style="margin:0 0 8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--amber)">Por ano</h3>' + (byYear || '<div style="color:var(--gray);font-size:12px">Sem dados.</div>') + '</div>',
      '<div style="grid-column:1/-1"><h3 style="margin:0 0 8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--amber)">Por outcome</h3>' + (byOutcome || '<div style="color:var(--gray);font-size:12px">Sem dados.</div>') + '</div>',
      '</div>',
      '</div>',
    ].join('');
  }

  function _miMarkdownHtml() {
    var text = String(_mi.markdown || '');
    var truncated = text.length > MI_MD_PREVIEW_CHARS;
    var preview = truncated ? text.slice(0, MI_MD_PREVIEW_CHARS) : text;

    return [
      '<div style="padding:24px;max-width:980px">',
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:12px">',
      '<div>',
      '<div style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--amber)">Arquivo markdown</div>',
      '<h2 style="margin:4px 0 0;color:var(--gray-hi)">master_index.md</h2>',
      '<div style="margin-top:6px;font-size:11px;color:var(--gray)">Preview de ' + _miEsc(String(preview.length)) + ' caracteres' + (truncated ? ' (arquivo completo disponivel nos botoes).' : '.') + '</div>',
      '</div>',
      '<div style="display:flex;gap:6px;align-items:center">',
      (typeof window.vwFilePills === 'function') ? window.vwFilePills(_mi.sourcePaths.md, 'master_index.md', 'md') : '',
      '<button class="btn-secondary" onclick="masterIndexAttachActive()"><i class="fas fa-paperclip"></i> Anexar ao chat</button>',
      '</div>',
      '</div>',
      '<pre style="white-space:pre-wrap;font-size:12px;line-height:1.6;color:var(--gray-hi);background:var(--bg);padding:14px;border:1px solid var(--border);border-radius:8px">' + _miEsc(preview) + '</pre>',
      '</div>',
    ].join('');
  }

  function _miJoinList(list, limit) {
    if (!Array.isArray(list) || !list.length) return '-';
    var trimmed = list.slice(0, limit || list.length);
    var suffix = list.length > trimmed.length ? (' ... +' + (list.length - trimmed.length)) : '';
    return trimmed.map(function (v) { return String(v || ''); }).join(', ') + suffix;
  }

  function _miLinkOrText(url) {
    var raw = String(url || '').trim();
    if (!raw) return '-';
    if (/^https?:\/\//i.test(raw)) {
      return '<a href="' + _miEsc(raw) + '" target="_blank" rel="noopener" style="color:var(--amber);word-break:break-all">' + _miEsc(raw) + '</a>';
    }
    return '<span style="word-break:break-all;color:var(--gray-hi)">' + _miEsc(raw) + '</span>';
  }

  function _miDocSummary(doc) {
    if (!doc) return '';
    var lines = [];
    lines.push('# ' + String(doc.id || 'documento'));
    lines.push('Tribunal: ' + String(doc.tribunal || ''));
    lines.push('Processo: ' + String(doc.numero_processo || doc.cnj_numero || ''));
    lines.push('Relator: ' + String(doc.relator || ''));
    lines.push('Comarca: ' + String(doc.comarca || ''));
    lines.push('Data: ' + _miFormatWhen(doc));
    lines.push('Outcomes: ' + _miJoinList(doc.outcomes || [], 10));
    if (doc.ementa) lines.push('\n## Ementa\n' + String(doc.ementa));
    if (doc.text_excerpt) lines.push('\n## Excerpt\n' + String(doc.text_excerpt));
    return lines.join('\n');
  }

  function _miDocHtml(doc) {
    if (!doc) {
      return '<div style="padding:24px;color:var(--gray)">Documento nao encontrado no indice.</div>';
    }

    var rows = [
      ['ID', doc.id],
      ['Tribunal', doc.tribunal],
      ['Processo', doc.numero_processo || doc.cnj_numero],
      ['Relator', doc.relator],
      ['Orgao julgador', doc.orgao_julgador],
      ['Comarca', doc.comarca],
      ['Data', _miFormatWhen(doc)],
      ['Parser', doc.parser],
      ['Texto (chars)', doc.text_chars],
      ['Arquivo (bytes)', doc.file_size_bytes],
      ['JSON status', doc.json_status],
    ];

    var tableRows = rows.map(function (row) {
      return '<tr><td style="padding:7px 8px;color:var(--gray);font-size:11px;white-space:nowrap">' + _miEsc(row[0]) + '</td><td style="padding:7px 8px;color:var(--gray-hi);font-size:12px">' + _miEsc(String(row[1] == null ? '-' : row[1])) + '</td></tr>';
    }).join('');

    var outcomes = Array.isArray(doc.outcomes) ? doc.outcomes : [];
    var outcomesHtml = outcomes.length
      ? outcomes.map(function (o) {
        return '<span style="display:inline-block;padding:3px 8px;margin:2px 4px 2px 0;border:1px solid var(--border);border-radius:12px;font-size:11px;color:var(--gray-hi);background:var(--bg)">' + _miEsc(String(o)) + '</span>';
      }).join('')
      : '<span style="color:var(--gray);font-size:12px">Sem outcomes mapeados.</span>';

    var excerpt = String(doc.text_excerpt || doc.ementa || '').trim();
    var excerptShown = excerpt ? excerpt.slice(0, 5000) : '';

    return [
      '<div style="padding:24px;max-width:980px">',
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:14px">',
      '<div style="min-width:0">',
      '<div style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--amber)">' + _miEsc(String(doc.tribunal || 'TRIBUNAL')) + '</div>',
      '<h2 style="margin:4px 0 0;color:var(--gray-hi);line-height:1.25">' + _miEsc(String(doc.numero_processo || doc.cnj_numero || doc.id || 'Documento')) + '</h2>',
      '<div style="margin-top:6px;font-size:11px;color:var(--gray)">' + _miEsc(_miFormatWhen(doc)) + '</div>',
      '</div>',
      '<div style="display:flex;gap:6px;align-items:center">',
      '<button class="btn-link" onclick="masterIndexSelectOverview()"><i class="fas fa-arrow-left"></i> Voltar</button>',
      '<button class="btn-secondary" onclick="masterIndexAttachActive()"><i class="fas fa-paperclip"></i> Anexar ao chat</button>',
      '</div>',
      '</div>',

      '<table style="width:100%;border-collapse:collapse;border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-bottom:14px">' + tableRows + '</table>',

      '<div style="margin-bottom:14px">',
      '<h3 style="margin:0 0 8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--amber)">Outcomes</h3>',
      outcomesHtml,
      '</div>',

      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;margin-bottom:14px">',
      '<div style="padding:12px;border:1px solid var(--border);border-radius:8px;background:var(--bg)">',
      '<h3 style="margin:0 0 8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--amber)">Valores monetarios</h3>',
      '<div style="font-size:12px;color:var(--gray-hi);line-height:1.55">' + _miEsc(_miJoinList(doc.monetary_values || [], 12)) + '</div>',
      '</div>',
      '<div style="padding:12px;border:1px solid var(--border);border-radius:8px;background:var(--bg)">',
      '<h3 style="margin:0 0 8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--amber)">Processos citados</h3>',
      '<div style="font-size:12px;color:var(--gray-hi);line-height:1.55">' + _miEsc(_miJoinList(doc.cited_processes || [], 12)) + '</div>',
      '</div>',
      '</div>',

      '<div style="padding:12px;border:1px solid var(--border);border-radius:8px;background:var(--bg);margin-bottom:14px">',
      '<h3 style="margin:0 0 8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--amber)">Links</h3>',
      '<div style="display:grid;grid-template-columns:minmax(120px,160px) 1fr;gap:6px 10px;font-size:12px">',
      '<div style="color:var(--gray)">Download</div><div>' + _miLinkOrText(doc.download_url) + '</div>',
      '<div style="color:var(--gray)">Inteiro teor</div><div>' + _miLinkOrText(doc.inteiro_url) + '</div>',
      '<div style="color:var(--gray)">Pagina fonte</div><div>' + _miLinkOrText(doc.source_page_url) + '</div>',
      '<div style="color:var(--gray)">Raw source</div><div>' + _miLinkOrText(doc.raw_source_path) + '</div>',
      '<div style="color:var(--gray)">JSON path</div><div>' + _miLinkOrText(doc.json_path) + '</div>',
      '<div style="color:var(--gray)">Sidecar</div><div>' + _miLinkOrText(doc.sidecar_path) + '</div>',
      '</div>',
      '</div>',

      '<div style="margin-bottom:8px">',
      '<h3 style="margin:0 0 8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--amber)">Ementa / excerpt</h3>',
      excerptShown
        ? ('<pre style="white-space:pre-wrap;font-size:12px;line-height:1.6;color:var(--gray-hi);background:var(--bg);padding:14px;border:1px solid var(--border);border-radius:8px">' + _miEsc(excerptShown) + '</pre>')
        : '<div style="font-size:12px;color:var(--gray)">Sem excerpt disponivel.</div>',
      '</div>',
      '</div>',
    ].join('');
  }

  function _miRenderViewer() {
    var viewer = _miById('masterIndexViewer');
    if (!viewer) return;

    if (!_mi.available) {
      viewer.innerHTML = '<div class="vw-empty">Master index indisponivel para este runtime.</div>';
      return;
    }

    if (_mi.selected.type === 'markdown') {
      viewer.innerHTML = _miMarkdownHtml();
      return;
    }

    if (_mi.selected.type === 'doc') {
      viewer.innerHTML = _miDocHtml(_mi.docMap[_mi.selected.id]);
      return;
    }

    viewer.innerHTML = _miOverviewHtml();
  }

  function _miRender() {
    _miRenderCourtChips();
    _miRenderTree();
    _miRenderViewer();
  }

  function _miSelectionStillVisible() {
    if (_mi.selected.type !== 'doc' || !_mi.selected.id) return true;
    var doc = _mi.docMap[_mi.selected.id];
    return _miMatchesDoc(doc);
  }

  function _miBuildAttachPayload() {
    if (_mi.selected.type === 'markdown') {
      var md = String(_mi.markdown || '');
      var clippedMd = md.length > MI_ATTACH_MAX_CHARS
        ? (md.slice(0, MI_ATTACH_MAX_CHARS) + '\n\n[...truncated for chat context...]')
        : md;
      return {
        key: 'master-index:md',
        title: 'master_index.md',
        text: clippedMd,
      };
    }

    if (_mi.selected.type === 'doc') {
      var doc = _mi.docMap[_mi.selected.id];
      if (!doc) return null;
      return {
        key: 'master-index:doc:' + _mi.selected.id,
        title: String(doc.id || _mi.selected.id) + '.md',
        text: _miDocSummary(doc),
      };
    }

    var idx = _mi.index || {};
    var summary = {
      generated_at: idx.generated_at || null,
      total_documents: _miTotalDocuments(),
      search_jobs_count: idx.search_jobs_count || null,
      by_tribunal: idx.by_tribunal || null,
      by_year: idx.by_year || null,
      by_outcome: idx.by_outcome || null,
      qdrant: idx.qdrant || null,
    };
    return {
      key: 'master-index:overview',
      title: 'master_index_overview.json',
      text: JSON.stringify(summary, null, 2),
    };
  }

  function _miAttachShared(payload) {
    if (!payload || !payload.text) return;

    _mi.attached[payload.key] = { title: payload.title, length: payload.text.length };

    if (typeof window.addSharedContextItem === 'function') {
      window.addSharedContextItem({
        key: payload.key,
        section: 'masterindex',
        title: payload.title,
        inlineText: payload.text,
      });
    } else if (window._checkedShared && typeof window._checkedShared === 'object') {
      window._checkedShared[payload.key] = {
        section: 'masterindex',
        title: payload.title,
        inlineText: payload.text,
      };
      if (typeof window.updateSharedContextBar === 'function') window.updateSharedContextBar();
    }

    _miSetStatus('Anexado: ' + payload.title, 'ok');
  }

  async function masterIndexInit() {
    if (_mi.initialized) {
      _miRender();
      return;
    }

    _mi.initialized = true;
    _miSetStatus('Carregando master index...', 'muted');

    var runtimeStatus = await _miLoadRuntimeStatus();
    if (runtimeStatus && runtimeStatus.available === false) {
      _mi.available = false;
      _mi.index = null;
      _mi.markdown = '';
      _miSetStatus('Master index indisponivel neste runtime.', 'warn');
      _miRender();
      return;
    }

    var jsonPaths = MI_JSON_PATHS.slice();
    var mdPaths = MI_MD_PATHS.slice();

    if (runtimeStatus && runtimeStatus.json && runtimeStatus.json.path) {
      jsonPaths.unshift(runtimeStatus.json.path);
    }
    if (runtimeStatus && runtimeStatus.md && runtimeStatus.md.path) {
      mdPaths.unshift(runtimeStatus.md.path);
    }

    var jsonResult = null;
    var mdResult = null;

    try {
      jsonResult = await _miFetchWithFallback(jsonPaths, true);
      _mi.index = jsonResult.payload;
      _mi.sourcePaths.json = jsonResult.path;
      _miBuildDocMap();
    } catch (errJson) {
      _mi.index = null;
    }

    try {
      mdResult = await _miFetchWithFallback(mdPaths, false);
      _mi.markdown = String(mdResult.payload || '');
      _mi.sourcePaths.md = mdResult.path;
    } catch (errMd) {
      _mi.markdown = '';
    }

    _mi.available = !!(_mi.index || _mi.markdown);

    if (_mi.available) {
      var docsCount = _miTotalDocuments();
      if (!_mi.selected || !_mi.selected.type) _mi.selected = { type: 'overview' };
      _miSetStatus('Pronto - ' + docsCount + ' documento(s).', 'ok');
    } else {
      _miSetStatus('Falha ao carregar master_index.{json,md}', 'error');
    }

    _miRender();
  }

  window.masterIndexInit = masterIndexInit;

  window.masterIndexRefresh = function () {
    _mi.initialized = false;
    _mi.available = false;
    _mi.index = null;
    _mi.markdown = '';
    _mi.selected = { type: 'overview' };
    masterIndexInit();
  };

  window.masterIndexFilterCourt = function (courtEncoded) {
    var raw = String(courtEncoded || 'all');
    var court = raw === 'all' ? 'all' : decodeURIComponent(raw);
    _mi.filterCourt = court;
    if (!_miSelectionStillVisible()) _mi.selected = { type: 'overview' };
    _miRender();
  };

  window.masterIndexSearch = function (input) {
    _mi.searchQuery = String(input && input.value !== undefined ? input.value : input || '').trim();
    if (!_miSelectionStillVisible()) _mi.selected = { type: 'overview' };
    _miRenderTree();
    _miRenderViewer();
  };

  window.masterIndexSelectOverview = function () {
    _mi.selected = { type: 'overview' };
    _miRenderTree();
    _miRenderViewer();
  };

  window.masterIndexSelectMarkdown = function () {
    _mi.selected = { type: 'markdown' };
    _miRenderTree();
    _miRenderViewer();
  };

  window.masterIndexSelectDoc = function (encodedId) {
    var id = decodeURIComponent(String(encodedId || ''));
    if (!id) return;
    _mi.selected = { type: 'doc', id: id };
    _miRenderTree();
    _miRenderViewer();
  };

  window.masterIndexAttachActive = function () {
    var payload = _miBuildAttachPayload();
    if (!payload) {
      _miSetStatus('Nada selecionado para anexar.', 'warn');
      return;
    }
    _miAttachShared(payload);
  };

  window.masterIndexClearContext = function () {
    Object.keys(_mi.attached).forEach(function (k) {
      if (window._checkedShared) delete window._checkedShared[k];
    });
    _mi.attached = Object.create(null);
    if (typeof window.updateSharedContextBar === 'function') window.updateSharedContextBar();
  };

  window.clearMasterIndexContextState = window.masterIndexClearContext;

  window.masterIndexShowView = function () {
    var hide = ['chatHeader', 'welcomeState', 'chatLog', 'chatCompose', 'chatToolbar'];
    hide.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });

    var mc = document.querySelector('.main-content');
    if (mc) {
      mc._vwDisplay = mc.style.display;
      mc.style.display = 'none';
    }

    [
      'spacesView',
      'listeningView',
      'studioView',
      'descobertaView',
      'memoryView',
      'shadersView',
      'mermaidView',
      'aexMainView',
      'violationsView',
      'lawLibView',
      'legalRouterView',
    ].forEach(function (vid) {
      var v = document.getElementById(vid);
      if (v) v.classList.remove('active');
    });

    if (typeof window.aexHideMain === 'function') window.aexHideMain();
    if (typeof window.violationsHideView === 'function') window.violationsHideView();
    if (typeof window.lawLibHideView === 'function') window.lawLibHideView();
    if (typeof window.legalRouterHideView === 'function') window.legalRouterHideView();
    if (typeof window.spacesHideView === 'function') window.spacesHideView();

    var sv = document.getElementById('masterIndexView');
    if (sv) sv.classList.add('active');

    if (typeof window.vwInitResize === 'function') window.vwInitResize('masterIndexResize', 'masterIndexSidebar');
    if (typeof window.vwInitEdgeResize === 'function') window.vwInitEdgeResize('masterIndexEdgeResize', 'masterIndexView');

    if (typeof masterIndexInit === 'function') masterIndexInit();
    if (typeof window.oliviaRefreshSectionRuntimeUi === 'function') {
      try { window.oliviaRefreshSectionRuntimeUi(); } catch (_e) { }
    }
  };

  window.masterIndexHideView = function () {
    var sv = document.getElementById('masterIndexView');
    if (sv) {
      sv.classList.remove('active');
      sv.style.flex = '';
      sv.style.maxWidth = '';
    }

    var mc = document.querySelector('.main-content');
    if (mc) {
      mc.style.display = mc._vwDisplay !== undefined ? mc._vwDisplay : '';
      delete mc._vwDisplay;
    }

    var show = ['chatHeader', 'welcomeState', 'chatLog', 'chatCompose', 'chatToolbar'];
    show.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.style.display = '';
    });
  };
})();
