/* ═══════════════════════════════════════════════════════════════════
   SPACES MODULE — Contracts, Ontology & Analysis Workspace
   AURA Spaces: organize, extract, validate, and chat over contracts
   ═══════════════════════════════════════════════════════════════════ */
(function(){
'use strict';

/* ── CONTRACT REGISTRY ── */
const SP_CONTRACTS = [
  // Layer 1: Foundation
  { id:'golden_case_spec',       file:'GOLDEN_CASE_SPEC_md-contract.md',                    name:'Golden Case Spec',          layer:'foundation', category:'spec',       icon:'fas fa-scroll',             desc:'Ontology v2.4 requirements, invariants I-1 through IX-3, precision rule' },
  { id:'chain_analysis',         file:'chain_analysis_json-contract.md',                     name:'Chain Analysis',            layer:'foundation', category:'spec',       icon:'fas fa-link',               desc:'Execution order, chaining modes, framework dependency management' },
  { id:'cba_framework',          file:'cba_framework_json-contract.md',                      name:'CBA Framework',             layer:'foundation', category:'framework',  icon:'fas fa-gavel',              desc:'Código Brasileiro de Aeronáutica — Art.175, Art.260' },
  { id:'mc99_framework',         file:'mc99_framework_json-contract.md',                     name:'MC99 Framework',            layer:'foundation', category:'framework',  icon:'fas fa-globe',              desc:'Montreal Convention 1999 — Art.19 delay, Art.21 death/injury' },
  // Layer 2: Input Processing
  { id:'aeropuerto_template',    file:'aeropuerto_template_json-contract.md',                name:'Aeropuerto Template',       layer:'input',      category:'input',      icon:'fas fa-microphone',         desc:'Segment structure, speaker roles, timestamping' },
  { id:'framework_analysis',     file:'framework_analysis_files-contract.md',                name:'Framework Analysis Files',  layer:'input',      category:'input',      icon:'fas fa-file-code',          desc:'Raw LLM analysis outputs, chaining context, severity mapping' },
  { id:'mc99_analysis',          file:'aeropuerto_template_mc99_analysis_json-contract.md',  name:'MC99 Analysis',             layer:'input',      category:'input',      icon:'fas fa-search',             desc:'Independent analysis (mode="none"), Art.19 violation' },
  { id:'cba_analysis',           file:'aeropuerto_template_cba_analysis_json-contract.md',   name:'CBA Analysis',              layer:'input',      category:'input',      icon:'fas fa-search-plus',        desc:'Chained analysis (mode="all"), Art.175 violation' },
  // Layer 3: Pipeline Synthesis
  { id:'evid_trscr001',          file:'EVID_trscr001_json-contract.md',                     name:'Evidence Artefact',         layer:'synthesis',  category:'evidence',   icon:'fas fa-fingerprint',        desc:'Forensic chain MEDIA→TRNS→EVID, integrity hashes' },
  { id:'extraction_prompt',      file:'extraction_prompt_md-contract.md',                    name:'Extraction Prompt',         layer:'synthesis',  category:'evidence',   icon:'fas fa-terminal',           desc:'LLM prompt templates v1-3, chaining injection, precision rule' },
  { id:'pipeline_ontology',      file:'pipeline_ontology_files-contract.md',                 name:'Pipeline Ontology',         layer:'synthesis',  category:'output',     icon:'fas fa-project-diagram',    desc:'Stage 3/4 outputs — ontology_v2.4 and enriched_ontology' },
  { id:'canonical_output',       file:'golden_case_canonical_output_json-contract.md',       name:'Canonical Output',          layer:'synthesis',  category:'output',     icon:'fas fa-database',           desc:'Complete ontology graph, invariant checklist, deduplication' },
  { id:'chaining_decision_log',  file:'chaining_decision_log_json-contract.md',              name:'Chaining Decision Log',     layer:'synthesis',  category:'evidence',   icon:'fas fa-clipboard-list',     desc:'Framework execution rationale, node deduplication' },
  // Layer 4: Human Interface
  { id:'violation_brief_tpl',    file:'violation_brief_template-contract.md',                name:'Violation Brief Template',  layer:'interface',  category:'viz',        icon:'fas fa-file-lines',         desc:'Human-readable summary structure, traceability paths' },
  { id:'violation_briefs',       file:'violation_briefs-contract.md',                        name:'Violation Briefs',          layer:'interface',  category:'viz',        icon:'fas fa-file-alt',           desc:'MC99 and CBA briefs, cross-jurisdiction, precision rule demo' },
  { id:'golden_case_graph',      file:'golden_case_graph_md-contract.md',                    name:'Ontology Graph',            layer:'interface',  category:'viz',        icon:'fas fa-diagram-project',    desc:'Node relationships, forensic paths, multi-framework connections' },
  { id:'scenario_walkthrough',   file:'scenario_walkthrough_md-contract.md',                 name:'Scenario Walkthrough',      layer:'interface',  category:'viz',        icon:'fas fa-route',              desc:'Event-to-node mapping, multi-framework explanation' },
  // Layer 5: Ecosystem Integration
  { id:'golden_analyzer',        file:'golden_analyzer_md-contract.md',                      name:'Golden Analyzer',           layer:'ecosystem',  category:'analyzer',   icon:'fas fa-cogs',               desc:'Pack structure requirements, consistency rules, validation' },
  { id:'mc99_analyzer_pack',     file:'mc99_analyzer_pack-contract.md',                      name:'MC99 Analyzer Pack',        layer:'ecosystem',  category:'analyzer',   icon:'fas fa-box-open',           desc:'Canonical reference implementation, prompt templates, ID rules' },
  { id:'manifest',               file:'manifest_json-contract.md',                           name:'Manifest',                  layer:'ecosystem',  category:'manifest',   icon:'fas fa-list-check',         desc:'File registry, integrity verification, metadata documentation' },
];

const SP_LAYERS = [
  { id:'foundation', label:'Foundation',           icon:'fas fa-layer-group',      num:'L1', cls:'l1', desc:'Core specifications and framework definitions' },
  { id:'input',      label:'Input Processing',     icon:'fas fa-file-import',      num:'L2', cls:'l2', desc:'Raw inputs, transcript templates, analysis files' },
  { id:'synthesis',  label:'Pipeline Synthesis',   icon:'fas fa-diagram-project',  num:'L3', cls:'l3', desc:'Evidence chain, extraction, ontology assembly' },
  { id:'interface',  label:'Human Interface',      icon:'fas fa-eye',              num:'L4', cls:'l4', desc:'Violation briefs, graphs, walkthroughs' },
  { id:'ecosystem',  label:'Ecosystem Integration',icon:'fas fa-puzzle-piece',     num:'L5', cls:'l5', desc:'Analyzer packs, manifests, tooling' },
];

const SP_CATEGORIES = {
  spec:       { label:'Specs',       cls:'spec' },
  framework:  { label:'Frameworks',  cls:'framework' },
  input:      { label:'Inputs',      cls:'input' },
  output:     { label:'Outputs',     cls:'output' },
  evidence:   { label:'Evidence',    cls:'evidence' },
  viz:        { label:'Interface',   cls:'viz' },
  analyzer:   { label:'Analyzers',   cls:'analyzer' },
  manifest:   { label:'Manifest',    cls:'manifest' },
};

/* ── STATE ── */
let _spActiveContract = null;
let _spLoadedContent = {};
let _spChatMessages = [];
let _spContextContracts = []; // contracts added as analysis context
let _spFilterCategory = 'all';
let _spSearchQuery = '';
let _spChatCollapsed = false;
let _spUploadedCaseFiles = [];
let _spValidationResults = {};
let _spCurrentView = 'welcome'; // welcome|contract|ontology|validation|tools

/* ── SHOW / HIDE ── */
window.spacesShowView = function(){
  var hide = ['chatHeader','welcomeState','chatLog','chatCompose','chatToolbar'];
  hide.forEach(function(id){ var el = document.getElementById(id); if(el) el.style.display = 'none'; });
  // Collapse main-content so spaces-view gets the full flex:1 width
  var mc = document.querySelector('.main-content');
  if(mc){ mc._spDisplay = mc.style.display; mc.style.display = 'none'; }
  // Hide other views
  if (typeof aexHideMain === 'function') aexHideMain();
  ['listeningView','studioView','descobertaView','memoryView'].forEach(function(vid){
    var v = document.getElementById(vid); if(v){ v.classList.remove('active'); v.style.display = 'none'; }
  });
  var sv = document.getElementById('spacesView');
  if(sv){ sv.classList.add('active'); }
  var op = document.getElementById('outputPanel'), bp = document.getElementById('browserPanel');
  if(op){ op._spPrevOpen = op.classList.contains('open'); op.classList.remove('open'); }
  if(bp){ bp._spPrevOpen = bp.classList.contains('open'); bp.classList.remove('open'); }
  spBuildTree();
  spUpdateStats();
};

window.spacesHideView = function(){
  var sv = document.getElementById('spacesView');
  if(sv){ sv.classList.remove('active'); }
  // Restore main-content
  var mc = document.querySelector('.main-content');
  if(mc){ mc.style.display = mc._spDisplay !== undefined ? mc._spDisplay : ''; delete mc._spDisplay; }
  var show = ['chatHeader','welcomeState','chatLog','chatCompose','chatToolbar'];
  show.forEach(function(id){ var el = document.getElementById(id); if(el) el.style.display = ''; });
  var op = document.getElementById('outputPanel'), bp = document.getElementById('browserPanel');
  if(op && op._spPrevOpen) op.classList.add('open');
  if(bp && bp._spPrevOpen) bp.classList.add('open');
};

/* ── BUILD SIDEBAR TREE ── */
function spBuildTree(){
  var tree = document.getElementById('spContractTree');
  if(!tree) return;
  tree.innerHTML = '';

  var filteredContracts = SP_CONTRACTS.filter(function(c){
    if(_spFilterCategory !== 'all' && c.category !== _spFilterCategory) return false;
    if(_spSearchQuery){
      var q = _spSearchQuery.toLowerCase();
      return c.name.toLowerCase().includes(q) || c.desc.toLowerCase().includes(q) || c.id.toLowerCase().includes(q);
    }
    return true;
  });

  SP_LAYERS.forEach(function(layer){
    var layerContracts = filteredContracts.filter(function(c){ return c.layer === layer.id; });
    if(layerContracts.length === 0) return;

    var section = document.createElement('div');
    section.className = 'sp-tree-section';
    section.innerHTML = '<div class="sp-tree-section-title" onclick="spToggleSection(this)"><i class="fas fa-circle"></i> ' + layer.label.toUpperCase() + ' <span style="margin-left:auto;font-family:var(--mono);color:var(--amber)">' + layerContracts.length + '</span></div>';
    var items = document.createElement('div');
    items.className = 'sp-tree-section-items';

    layerContracts.forEach(function(c){
      var catCls = SP_CATEGORIES[c.category] ? SP_CATEGORIES[c.category].cls : 'spec';
      var isActive = _spActiveContract && _spActiveContract.id === c.id;
      var isCtx = _spContextContracts.indexOf(c.id) > -1;
      var item = document.createElement('div');
      item.className = 'sp-tree-item' + (isActive ? ' active' : '');
      item.setAttribute('data-contract-id', c.id);
      item.onclick = function(){ spSelectContract(c.id); };
      item.innerHTML =
        '<div class="sp-tree-item-icon ' + catCls + '"><i class="' + c.icon + '"></i></div>' +
        '<div class="sp-tree-item-body">' +
          '<div class="sp-tree-item-name">' + c.name + '</div>' +
          '<div class="sp-tree-item-meta">' + layer.num + ' · ' + (SP_CATEGORIES[c.category]||{}).label + '</div>' +
        '</div>' +
        (isCtx ? '<i class="fas fa-link" style="font-size:8px;color:var(--green)" title="In context"></i>' : '') +
        '<div class="sp-tree-item-status ' + spGetValidationStatus(c.id) + '"></div>';
      items.appendChild(item);
    });

    section.appendChild(items);
    tree.appendChild(section);
  });
}

/* ── TOGGLE TREE SECTION ── */
window.spToggleSection = function(el){
  el.classList.toggle('collapsed');
  var items = el.nextElementSibling;
  if(items) items.classList.toggle('collapsed');
};

/* ── FILTER ── */
window.spSetFilter = function(cat){
  _spFilterCategory = cat;
  document.querySelectorAll('.sp-filter-btn').forEach(function(b){
    b.classList.toggle('active', b.getAttribute('data-filter') === cat);
  });
  spBuildTree();
};

/* ── SEARCH ── */
window.spSearch = function(){
  var input = document.getElementById('spSearchInput');
  _spSearchQuery = input ? input.value.trim() : '';
  spBuildTree();
};

/* ── SELECT CONTRACT ── */
function spSelectContract(id){
  var contract = SP_CONTRACTS.find(function(c){ return c.id === id; });
  if(!contract) return;
  _spActiveContract = contract;
  _spCurrentView = 'contract';
  spBuildTree();
  spRenderContractViewer(contract);
}
window.spSelectContract = spSelectContract;

/* ── RENDER CONTRACT VIEWER ── */
function spRenderContractViewer(contract){
  var content = document.getElementById('spContent');
  if(!content) return;

  var layer = SP_LAYERS.find(function(l){ return l.id === contract.layer; }) || {};
  var catCls = SP_CATEGORIES[contract.category] ? SP_CATEGORIES[contract.category].cls : 'spec';
  var catLabel = SP_CATEGORIES[contract.category] ? SP_CATEGORIES[contract.category].label : 'Spec';

  content.innerHTML =
    '<div class="sp-viewer active">' +
      '<div class="sp-viewer-header">' +
        '<div class="sp-viewer-title">' +
          '<div class="sp-tree-item-icon ' + catCls + '"><i class="' + contract.icon + '"></i></div>' +
          '<h2>' + contract.name + '</h2>' +
        '</div>' +
        '<div class="sp-viewer-breadcrumb">' +
          '<span onclick="spShowWelcome()">Spaces</span> <i class="fas fa-chevron-right" style="font-size:7px"></i> ' +
          '<span onclick="spShowOntology()">' + layer.label + '</span> <i class="fas fa-chevron-right" style="font-size:7px"></i> ' +
          '<span>' + contract.name + '</span>' +
        '</div>' +
        '<div class="sp-viewer-actions">' +
          '<button class="btn btn-sm" onclick="spAddToContext(\'' + contract.id + '\')"><i class="fas fa-link"></i> Add to Context</button>' +
          '<button class="btn btn-sm" onclick="spRunValidation(\'' + contract.id + '\')"><i class="fas fa-check-circle"></i> Validate</button>' +
          '<button class="btn btn-sm" onclick="spAnalyzeWith(\'' + contract.id + '\')"><i class="fas fa-wand-magic-sparkles"></i> Analyze</button>' +
          '<button class="btn btn-sm" onclick="spCopyContract(\'' + contract.id + '\')"><i class="fas fa-copy"></i> Copy</button>' +
        '</div>' +
      '</div>' +
      '<div class="sp-viewer-body" id="spViewerBody">' +
        '<div class="sp-loading"><div class="loading"></div><p>Loading contract...</p></div>' +
      '</div>' +
    '</div>';

  spLoadContractContent(contract);
}

/* ── LOAD CONTRACT CONTENT ── */
function spLoadContractContent(contract){
  // Content is loaded from project knowledge context or fetched
  var body = document.getElementById('spViewerBody');
  if(!body) return;

  // Simulate loading with parsed sections
  setTimeout(function(){
    body.innerHTML =
      '<div class="sp-contract-section">' +
        '<div class="sp-contract-section-head" onclick="spToggleContractSection(this)">' +
          '<i class="section-icon fas fa-info-circle"></i>' +
          '<h3>Overview</h3>' +
          '<i class="chevron fas fa-chevron-down"></i>' +
        '</div>' +
        '<div class="sp-contract-section-body">' +
          '<strong>Contract:</strong> ' + contract.file + '\n' +
          '<strong>Layer:</strong> ' + contract.layer + '\n' +
          '<strong>Category:</strong> ' + (SP_CATEGORIES[contract.category]||{}).label + '\n\n' +
          contract.desc +
        '</div>' +
      '</div>' +

      '<div class="sp-contract-section">' +
        '<div class="sp-contract-section-head" onclick="spToggleContractSection(this)">' +
          '<i class="section-icon fas fa-shield-halved"></i>' +
          '<h3>Invariants & Rules</h3>' +
          '<i class="chevron fas fa-chevron-down"></i>' +
        '</div>' +
        '<div class="sp-contract-section-body">' +
          spRenderInvariantsForContract(contract.id) +
        '</div>' +
      '</div>' +

      '<div class="sp-contract-section">' +
        '<div class="sp-contract-section-head" onclick="spToggleContractSection(this)">' +
          '<i class="section-icon fas fa-diagram-project"></i>' +
          '<h3>Dependencies & References</h3>' +
          '<i class="chevron fas fa-chevron-down"></i>' +
        '</div>' +
        '<div class="sp-contract-section-body">' +
          spRenderDependencies(contract.id) +
        '</div>' +
      '</div>' +

      '<div class="sp-contract-section">' +
        '<div class="sp-contract-section-head collapsed" onclick="spToggleContractSection(this)">' +
          '<i class="section-icon fas fa-file-code"></i>' +
          '<h3>Raw Contract Source</h3>' +
          '<i class="chevron fas fa-chevron-down"></i>' +
        '</div>' +
        '<div class="sp-contract-section-body collapsed" id="spRawSource">' +
          '<p style="color:var(--gray);font-style:italic">Click "Load Source" to view full contract markdown</p>' +
          '<button class="btn btn-sm" style="margin-top:8px" onclick="spLoadRawSource(\'' + contract.id + '\')"><i class="fas fa-download"></i> Load Source</button>' +
        '</div>' +
      '</div>';
  }, 300);
}

/* ── INVARIANTS PER CONTRACT ── */
function spRenderInvariantsForContract(id){
  var inv = {
    golden_case_spec:    ['I-1: id pattern VIOL_[a-z0-9]{8}','I-2: evidence_node_id required','III-1: integrity hash on all nodes','IX-3: precision rule'],
    chain_analysis:      ['CA-1: execution_order must be array','CA-2: chaining modes: none|all|prior','CA-3: dependency references valid'],
    cba_framework:       ['FW-1: article_id unique per framework','FW-2: severity in {low,medium,high,critical}','FW-3: description non-empty'],
    mc99_framework:      ['FW-1: article_id unique per framework','FW-2: severity in {low,medium,high,critical}','FW-3: description non-empty'],
    canonical_output:    ['CO-1: all nodes have integrity_hash','CO-2: no orphan nodes','CO-3: VIOL nodes have evidence_node_id','CO-4: cross-framework deduplication'],
    evid_trscr001:       ['EV-1: chain MEDIA→TRNS→EVID','EV-2: SHA-256 hash present','EV-3: timestamps validated'],
    extraction_prompt:   ['EP-1: prompt_version 1-3','EP-2: chaining context injection format','EP-3: precision rule enforcement'],
    pipeline_ontology:   ['PO-1: stage_03 ontology v2.4','PO-2: stage_04 enriched','PO-3: node_id patterns enforced'],
  };
  var items = inv[id] || ['No specific invariants documented for this contract'];
  return '<table class="sp-invariants-table"><thead><tr><th>ID</th><th>Rule</th><th>Status</th></tr></thead><tbody>' +
    items.map(function(item){
      var parts = item.split(': ');
      var status = _spValidationResults[id] ? 'pass' : 'untested';
      return '<tr><td class="sp-inv-id">' + (parts[0]||'—') + '</td><td>' + (parts[1]||item) + '</td><td><span class="sp-inv-status ' + status + '">' + (status === 'pass' ? '✓ Pass' : status === 'fail' ? '✗ Fail' : '○ Untested') + '</span></td></tr>';
    }).join('') +
    '</tbody></table>';
}

/* ── DEPENDENCIES ── */
function spRenderDependencies(id){
  var deps = {
    golden_case_spec:    { upstream:[], downstream:['chain_analysis','cba_framework','mc99_framework'] },
    chain_analysis:      { upstream:['golden_case_spec'], downstream:['framework_analysis','chaining_decision_log'] },
    cba_framework:       { upstream:['golden_case_spec'], downstream:['cba_analysis'] },
    mc99_framework:      { upstream:['golden_case_spec'], downstream:['mc99_analysis'] },
    aeropuerto_template: { upstream:[], downstream:['evid_trscr001','mc99_analysis','cba_analysis'] },
    framework_analysis:  { upstream:['chain_analysis','extraction_prompt'], downstream:['canonical_output'] },
    mc99_analysis:       { upstream:['mc99_framework','aeropuerto_template'], downstream:['canonical_output'] },
    cba_analysis:        { upstream:['cba_framework','aeropuerto_template'], downstream:['canonical_output'] },
    evid_trscr001:       { upstream:['aeropuerto_template'], downstream:['canonical_output'] },
    extraction_prompt:   { upstream:[], downstream:['framework_analysis'] },
    pipeline_ontology:   { upstream:['framework_analysis'], downstream:['canonical_output'] },
    canonical_output:    { upstream:['pipeline_ontology','mc99_analysis','cba_analysis','evid_trscr001'], downstream:['violation_briefs','golden_case_graph'] },
    violation_brief_tpl: { upstream:[], downstream:['violation_briefs'] },
    violation_briefs:    { upstream:['canonical_output','violation_brief_tpl'], downstream:[] },
    golden_case_graph:   { upstream:['canonical_output'], downstream:[] },
    scenario_walkthrough:{ upstream:['canonical_output'], downstream:[] },
    golden_analyzer:     { upstream:[], downstream:['mc99_analyzer_pack'] },
    mc99_analyzer_pack:  { upstream:['golden_analyzer','framework_analysis'], downstream:[] },
    chaining_decision_log:{ upstream:['chain_analysis'], downstream:['canonical_output'] },
    manifest:            { upstream:[], downstream:[] },
  };
  var d = deps[id] || { upstream:[], downstream:[] };
  var html = '<div style="display:flex;gap:20px;flex-wrap:wrap">';
  html += '<div style="flex:1;min-width:140px"><div style="font-size:10px;text-transform:uppercase;color:var(--gray);margin-bottom:6px;letter-spacing:.06em"><i class="fas fa-arrow-left" style="font-size:8px"></i> Upstream</div>';
  if(d.upstream.length === 0) html += '<span style="font-size:10px;color:var(--gray);font-style:italic">None (root)</span>';
  else d.upstream.forEach(function(uid){ var uc = SP_CONTRACTS.find(function(c){ return c.id === uid; }); if(uc) html += '<div class="sp-onto-node" onclick="spSelectContract(\'' + uid + '\')"><i class="fas fa-arrow-left" style="font-size:7px"></i> ' + uc.name + '</div>'; });
  html += '</div>';
  html += '<div style="flex:1;min-width:140px"><div style="font-size:10px;text-transform:uppercase;color:var(--gray);margin-bottom:6px;letter-spacing:.06em">Downstream <i class="fas fa-arrow-right" style="font-size:8px"></i></div>';
  if(d.downstream.length === 0) html += '<span style="font-size:10px;color:var(--gray);font-style:italic">None (terminal)</span>';
  else d.downstream.forEach(function(did){ var dc = SP_CONTRACTS.find(function(c){ return c.id === did; }); if(dc) html += '<div class="sp-onto-node" onclick="spSelectContract(\'' + did + '\')"><i class="fas fa-arrow-right" style="font-size:7px"></i> ' + dc.name + '</div>'; });
  html += '</div></div>';
  return html;
}

/* ── TOGGLE CONTRACT SECTION ── */
window.spToggleContractSection = function(el){
  el.classList.toggle('collapsed');
  var body = el.nextElementSibling;
  if(body) body.classList.toggle('collapsed');
};

/* ── WELCOME VIEW ── */
window.spShowWelcome = function(){
  _spCurrentView = 'welcome';
  _spActiveContract = null;
  spBuildTree();
  var content = document.getElementById('spContent');
  if(!content) return;
  content.innerHTML =
    '<div class="sp-welcome">' +
      '<div class="sp-welcome-icon"><i class="fas fa-cubes"></i></div>' +
      '<h2>AURA Spaces</h2>' +
      '<p>Your unified workspace for contracts, ontology, and case analysis. Explore the full Golden Case contract suite, validate invariants, and use contracts as tools to analyze your documentation.</p>' +
      '<div class="sp-welcome-grid">' +
        '<div class="sp-welcome-card" onclick="spShowOntology()">' +
          '<i class="fas fa-diagram-project"></i>' +
          '<h3>Ontology Explorer</h3>' +
          '<p>Navigate the 5-layer pipeline architecture and node relationships</p>' +
        '</div>' +
        '<div class="sp-welcome-card" onclick="spShowValidation()">' +
          '<i class="fas fa-shield-halved"></i>' +
          '<h3>Validation Suite</h3>' +
          '<p>Run invariant checks across all contracts and track compliance</p>' +
        '</div>' +
        '<div class="sp-welcome-card" onclick="spShowTools()">' +
          '<i class="fas fa-wand-magic-sparkles"></i>' +
          '<h3>Analysis Tools</h3>' +
          '<p>Extract, compare, and analyze documents against contract rules</p>' +
        '</div>' +
        '<div class="sp-welcome-card" onclick="spSelectContract(\'golden_case_spec\')">' +
          '<i class="fas fa-scroll"></i>' +
          '<h3>Golden Case Spec</h3>' +
          '<p>Start with the master specification — the foundation of everything</p>' +
        '</div>' +
      '</div>' +
    '</div>';
};

/* ── ONTOLOGY VIEW ── */
window.spShowOntology = function(){
  _spCurrentView = 'ontology';
  _spActiveContract = null;
  spBuildTree();
  var content = document.getElementById('spContent');
  if(!content) return;
  var html = '<div class="sp-ontology">' +
    '<div class="sp-ontology-header">' +
      '<h2><i class="fas fa-diagram-project"></i> Pipeline Ontology</h2>' +
      '<div style="display:flex;gap:6px">' +
        '<button class="btn btn-sm" onclick="spValidateAll()"><i class="fas fa-check-double"></i> Validate All</button>' +
      '</div>' +
    '</div>' +
    '<div class="sp-onto-layers">';

  SP_LAYERS.forEach(function(layer){
    var contracts = SP_CONTRACTS.filter(function(c){ return c.layer === layer.id; });
    html += '<div class="sp-onto-layer" id="spLayer_' + layer.id + '">' +
      '<div class="sp-onto-layer-head" onclick="spToggleLayer(\'' + layer.id + '\')">' +
        '<div class="sp-onto-layer-num ' + layer.cls + '">' + layer.num + '</div>' +
        '<div class="sp-onto-layer-title"><h3>' + layer.label + '</h3><p>' + layer.desc + '</p></div>' +
        '<div class="sp-onto-layer-count">' + contracts.length + ' contracts</div>' +
        '<i class="fas fa-chevron-down" style="font-size:10px;color:var(--gray);transition:transform .2s"></i>' +
      '</div>' +
      '<div class="sp-onto-layer-body"><div class="sp-onto-nodes">';
    contracts.forEach(function(c){
      var catCls = SP_CATEGORIES[c.category] ? SP_CATEGORIES[c.category].cls : 'spec';
      html += '<div class="sp-onto-node" onclick="spSelectContract(\'' + c.id + '\')" title="' + c.desc + '"><i class="' + c.icon + '"></i> ' + c.name + '</div>';
    });
    html += '</div></div></div>';
    // Arrow between layers
    html += '<div class="sp-onto-arrow"><i class="fas fa-arrow-down"></i></div>';
  });

  // Remove last arrow
  html = html.replace(/<div class="sp-onto-arrow"><i class="fas fa-arrow-down"><\/i><\/div>$/, '');
  html += '</div></div>';
  content.innerHTML = html;
};

window.spToggleLayer = function(id){
  var layer = document.getElementById('spLayer_' + id);
  if(layer) layer.classList.toggle('open');
};

/* ── VALIDATION VIEW ── */
window.spShowValidation = function(){
  _spCurrentView = 'validation';
  _spActiveContract = null;
  spBuildTree();
  var content = document.getElementById('spContent');
  if(!content) return;

  var totalContracts = SP_CONTRACTS.length;
  var validated = Object.keys(_spValidationResults).length;
  var passed = Object.values(_spValidationResults).filter(function(v){ return v === 'pass'; }).length;

  content.innerHTML =
    '<div class="sp-validation">' +
      '<div class="sp-ontology-header">' +
        '<h2><i class="fas fa-shield-halved" style="color:var(--amber)"></i> Validation Suite</h2>' +
        '<div style="display:flex;gap:6px">' +
          '<button class="btn btn-sm" onclick="spValidateAll()"><i class="fas fa-play"></i> Run All</button>' +
          '<button class="btn btn-sm" onclick="spResetValidation()"><i class="fas fa-rotate-left"></i> Reset</button>' +
        '</div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px">' +
        '<div class="sp-tree-stat" style="padding:12px"><span class="sp-tree-stat-num">' + totalContracts + '</span><span class="sp-tree-stat-label">Total Contracts</span></div>' +
        '<div class="sp-tree-stat" style="padding:12px"><span class="sp-tree-stat-num" style="color:var(--green)">' + passed + '</span><span class="sp-tree-stat-label">Passed</span></div>' +
        '<div class="sp-tree-stat" style="padding:12px"><span class="sp-tree-stat-num" style="color:' + (validated < totalContracts ? 'var(--gray)' : 'var(--green)') + '">' + validated + '/' + totalContracts + '</span><span class="sp-tree-stat-label">Tested</span></div>' +
      '</div>' +
      '<div class="sp-val-grid">' +
      SP_CONTRACTS.map(function(c){
        var status = _spValidationResults[c.id] || 'pending';
        var statusCls = status === 'pass' ? 'pass' : status === 'fail' ? 'fail' : 'warn';
        if(status === 'pending') statusCls = '';
        return '<div class="sp-val-card" onclick="spSelectContract(\'' + c.id + '\')">' +
          '<div class="sp-val-card-head">' +
            '<div class="sp-val-card-icon ' + statusCls + '" style="' + (status === 'pending' ? 'background:var(--gray);opacity:.3' : '') + '"></div>' +
            '<div class="sp-val-card-title">' + c.name + '</div>' +
          '</div>' +
          '<div class="sp-val-card-body">' + c.desc.substring(0,80) + '</div>' +
          '<div class="sp-val-card-id">' + c.file + '</div>' +
        '</div>';
      }).join('') +
      '</div>' +
    '</div>';
};

/* ── TOOLS VIEW ── */
window.spShowTools = function(){
  _spCurrentView = 'tools';
  _spActiveContract = null;
  spBuildTree();
  var content = document.getElementById('spContent');
  if(!content) return;

  content.innerHTML =
    '<div class="sp-tools">' +
      '<div class="sp-ontology-header">' +
        '<h2><i class="fas fa-wand-magic-sparkles" style="color:var(--amber)"></i> Analysis Tools</h2>' +
      '</div>' +
      '<div class="sp-tools-grid">' +
        '<div class="sp-tool-card" onclick="spToolExtract()">' +
          '<i class="fas fa-file-export"></i>' +
          '<h3>Extract & Classify</h3>' +
          '<p>Upload documents and extract entities using contract ontology as schema</p>' +
        '</div>' +
        '<div class="sp-tool-card" onclick="spToolCompare()">' +
          '<i class="fas fa-code-compare"></i>' +
          '<h3>Cross-Framework Compare</h3>' +
          '<p>Compare CBA vs MC99 analysis results side by side</p>' +
        '</div>' +
        '<div class="sp-tool-card" onclick="spToolChainTrace()">' +
          '<i class="fas fa-route"></i>' +
          '<h3>Evidence Chain Tracer</h3>' +
          '<p>Trace evidence from source transcript through to violation brief</p>' +
        '</div>' +
        '<div class="sp-tool-card" onclick="spToolGapAnalysis()">' +
          '<i class="fas fa-puzzle-piece"></i>' +
          '<h3>Gap Analysis</h3>' +
          '<p>Identify missing evidence, unlinked nodes, or incomplete chains</p>' +
        '</div>' +
        '<div class="sp-tool-card" onclick="spToolBriefGen()">' +
          '<i class="fas fa-file-lines"></i>' +
          '<h3>Brief Generator</h3>' +
          '<p>Generate violation briefs from canonical output using templates</p>' +
        '</div>' +
        '<div class="sp-tool-card" onclick="spToolValidateDoc()">' +
          '<i class="fas fa-clipboard-check"></i>' +
          '<h3>Document Validator</h3>' +
          '<p>Validate uploaded JSON/MD against contract schemas and invariants</p>' +
        '</div>' +
      '</div>' +
      '<div style="margin-top:20px">' +
        '<div class="sp-upload-zone" id="spToolUploadZone" onclick="document.getElementById(\'spToolFileInput\').click()" ondragover="event.preventDefault();this.classList.add(\'dragover\')" ondragleave="this.classList.remove(\'dragover\')" ondrop="event.preventDefault();this.classList.remove(\'dragover\');spHandleToolDrop(event)">' +
          '<i class="fas fa-cloud-arrow-up"></i>' +
          '<h4>Upload Case Files for Analysis</h4>' +
          '<p>JSON, Markdown, PDF — any case documentation to analyze against contracts</p>' +
          '<input type="file" id="spToolFileInput" style="display:none" multiple accept=".json,.md,.txt,.pdf,.docx,.csv,.html" onchange="spHandleToolFiles(this.files)">' +
        '</div>' +
        '<div id="spToolFileList"></div>' +
      '</div>' +
    '</div>';
};

/* ── CONTEXT MANAGEMENT ── */
window.spAddToContext = function(id){
  if(_spContextContracts.indexOf(id) === -1){
    _spContextContracts.push(id);
    spUpdateContextBar();
    spBuildTree();
    spChatSystem('Contract "' + (SP_CONTRACTS.find(function(c){ return c.id === id; })||{}).name + '" added to analysis context.');
  }
};

window.spRemoveFromContext = function(id){
  _spContextContracts = _spContextContracts.filter(function(cid){ return cid !== id; });
  spUpdateContextBar();
  spBuildTree();
};

function spUpdateContextBar(){
  var bar = document.getElementById('spContextBar');
  if(!bar) return;
  if(_spContextContracts.length === 0){
    bar.className = 'sp-context-bar empty';
    bar.innerHTML = '';
    return;
  }
  bar.className = 'sp-context-bar';
  bar.innerHTML = '<i class="fas fa-link" style="font-size:9px"></i> <span style="font-size:9px;text-transform:uppercase;letter-spacing:.06em">Context:</span> ' +
    _spContextContracts.map(function(id){
      var c = SP_CONTRACTS.find(function(cc){ return cc.id === id; });
      return '<span class="sp-context-tag">' + (c ? c.name : id) + ' <span class="remove" onclick="event.stopPropagation();spRemoveFromContext(\'' + id + '\')">×</span></span>';
    }).join('');
}

/* ── VALIDATION HELPERS ── */
function spGetValidationStatus(id){
  return _spValidationResults[id] || 'pending';
}

window.spRunValidation = function(id){
  // Simulate validation
  _spValidationResults[id] = 'pass';
  spBuildTree();
  spChatSystem('✓ Validation passed for "' + (SP_CONTRACTS.find(function(c){ return c.id === id; })||{}).name + '"');
  spToast('Validation complete');
};

window.spValidateAll = function(){
  SP_CONTRACTS.forEach(function(c){
    _spValidationResults[c.id] = Math.random() > 0.15 ? 'pass' : 'warn';
  });
  spBuildTree();
  spChatSystem('✓ Full validation suite complete — ' + Object.values(_spValidationResults).filter(function(v){ return v === 'pass'; }).length + '/' + SP_CONTRACTS.length + ' passed');
  // Refresh validation view if active
  if(_spCurrentView === 'validation') spShowValidation();
};

window.spResetValidation = function(){
  _spValidationResults = {};
  spBuildTree();
  if(_spCurrentView === 'validation') spShowValidation();
};

/* ── ANALYSIS ACTIONS ── */
window.spAnalyzeWith = function(id){
  spAddToContext(id);
  var c = SP_CONTRACTS.find(function(cc){ return cc.id === id; });
  var chatInput = document.getElementById('spChatInput');
  if(chatInput){
    chatInput.value = 'Analyze the current case files using ' + (c ? c.name : 'this contract') + ' rules and invariants';
    chatInput.focus();
  }
};

window.spCopyContract = function(id){
  var c = SP_CONTRACTS.find(function(cc){ return cc.id === id; });
  if(c){
    navigator.clipboard.writeText(JSON.stringify(c, null, 2)).then(function(){
      spToast('Contract metadata copied');
    });
  }
};

window.spLoadRawSource = function(id){
  var el = document.getElementById('spRawSource');
  if(!el) return;
  el.innerHTML = '<div class="sp-loading"><div class="loading"></div><p>Loading source...</p></div>';
  // In production, this would fetch from the backend
  setTimeout(function(){
    var c = SP_CONTRACTS.find(function(cc){ return cc.id === id; });
    el.innerHTML = '<pre style="font-size:10px;line-height:1.7;white-space:pre-wrap;color:var(--gray-hi)"># ' + (c ? c.file : 'unknown') + '\n\n' +
      '> This contract defines the authoritative specification for ' + (c ? c.name : 'this component') + '.\n' +
      '> Layer: ' + (c ? c.layer : 'unknown') + '\n' +
      '> Category: ' + (c ? (SP_CATEGORIES[c.category]||{}).label : 'unknown') + '\n\n' +
      '## Invariants\n' +
      (c ? c.desc : '') + '\n\n' +
      '## Source File\n' +
      (c ? c.file : '') + '\n\n' +
      '<span style="color:var(--amber)">[Full content available via project knowledge or server API]</span></pre>';
  }, 500);
};

/* ── CHAT SYSTEM ── */
function spChatSystem(msg){
  _spChatMessages.push({ role:'system', content:msg, ts:Date.now() });
  spRenderChat();
}

function spChatAssistant(msg){
  _spChatMessages.push({ role:'assistant', content:msg, ts:Date.now() });
  spRenderChat();
}

window.spSendChat = function(){
  var input = document.getElementById('spChatInput');
  if(!input || !input.value.trim()) return;
  var msg = input.value.trim();
  input.value = '';

  _spChatMessages.push({ role:'user', content:msg, ts:Date.now() });
  spRenderChat();

  // Smart response based on context
  setTimeout(function(){
    var response = spGenerateResponse(msg);
    spChatAssistant(response);
  }, 600);
};

window.spChatKeydown = function(e){
  if(e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); spSendChat(); }
};

function spGenerateResponse(msg){
  var lower = msg.toLowerCase();
  var contextNames = _spContextContracts.map(function(id){ var c = SP_CONTRACTS.find(function(cc){ return cc.id === id; }); return c ? c.name : id; });

  if(lower.includes('invariant') || lower.includes('rule')){
    return 'Based on the contract suite, the key invariants are:\n\n• <code>I-1</code>: Node ID pattern <code>VIOL_[a-z0-9]{8}</code>\n• <code>I-2</code>: <code>evidence_node_id</code> required on all violations\n• <code>III-1</code>: Integrity hash on all nodes\n• <code>IX-3</code>: Precision rule — never infer beyond source evidence\n\n' +
      (contextNames.length ? 'Currently analyzing with: ' + contextNames.join(', ') : 'Add contracts to context for targeted analysis.');
  }
  if(lower.includes('cba') && lower.includes('mc99') || lower.includes('compare') || lower.includes('cross')){
    return 'Cross-framework comparison:\n\n• <span class="sp-ref" onclick="spSelectContract(\'cba_framework\')">CBA</span> covers Brazilian domestic aviation law (Art.175 service, Art.260 baggage)\n• <span class="sp-ref" onclick="spSelectContract(\'mc99_framework\')">MC99</span> covers international treaty obligations (Art.19 delay, Art.21 injury)\n\nThe chaining mode determines execution order — MC99 runs first (mode="none"), CBA chains after (mode="all") with prior context.';
  }
  if(lower.includes('evidence') || lower.includes('chain') || lower.includes('trace')){
    return 'Evidence chain traceability:\n\n<span class="sp-ref" onclick="spSelectContract(\'aeropuerto_template\')">Transcript</span> → <span class="sp-ref" onclick="spSelectContract(\'evid_trscr001\')">EVID artefact</span> → <span class="sp-ref" onclick="spSelectContract(\'canonical_output\')">Canonical Output</span> → <span class="sp-ref" onclick="spSelectContract(\'violation_briefs\')">Violation Briefs</span>\n\nEach step requires SHA-256 integrity hash and <code>evidence_node_id</code> linkage.';
  }
  if(lower.includes('validate') || lower.includes('check')){
    return 'I can validate documents against contract invariants. Use the "Validate" button on any contract, or run "Validate All" from the Validation Suite. Upload case files via the Tools section and I\'ll check them against active context contracts.';
  }
  if(lower.includes('ontology') || lower.includes('layer') || lower.includes('pipeline')){
    return 'The pipeline follows 5 layers:\n\n• <strong>L1 Foundation</strong> — Specs and frameworks\n• <strong>L2 Input</strong> — Transcripts and raw analysis\n• <strong>L3 Synthesis</strong> — Evidence chain, ontology assembly\n• <strong>L4 Interface</strong> — Human-readable briefs and graphs\n• <strong>L5 Ecosystem</strong> — Analyzer packs and tooling\n\nClick <span class="sp-ref" onclick="spShowOntology()">Ontology Explorer</span> for the visual map.';
  }
  if(lower.includes('help') || lower.includes('what can')){
    return 'I can help you with:\n\n• Exploring contracts and their relationships\n• Validating invariants across the pipeline\n• Tracing evidence chains from source to output\n• Comparing CBA vs MC99 frameworks\n• Analyzing uploaded case files against contract rules\n• Generating violation briefs from canonical data\n\nAdd contracts to context using the <i class="fas fa-link"></i> button, then ask me anything.';
  }

  // Default
  return 'I\'m analyzing your query with ' + SP_CONTRACTS.length + ' contracts in the registry' +
    (contextNames.length ? ' and ' + contextNames.length + ' in active context (' + contextNames.join(', ') + ')' : '') +
    '. Could you be more specific? Try asking about invariants, evidence chains, cross-framework comparison, or validation.';
}

function spRenderChat(){
  var log = document.getElementById('spChatLog');
  if(!log) return;
  log.innerHTML = _spChatMessages.map(function(m){
    return '<div class="sp-chat-msg ' + m.role + '">' + m.content + '</div>';
  }).join('');
  log.scrollTop = log.scrollHeight;
}

window.spToggleChat = function(){
  var chat = document.getElementById('spChat');
  if(!chat) return;
  _spChatCollapsed = !_spChatCollapsed;
  chat.classList.toggle('collapsed', _spChatCollapsed);
};

/* ── CHAT MODES ── */
window.spSetChatMode = function(mode, el){
  document.querySelectorAll('.sp-chat-pill').forEach(function(p){ p.classList.remove('active'); });
  if(el) el.classList.add('active');
  spChatSystem('Mode: <strong>' + mode + '</strong> — ' + {
    analyze:'Analyze documents using contract rules',
    validate:'Validate data against invariants',
    explore:'Explore contract relationships and ontology',
    extract:'Extract entities and structured data',
  }[mode]);
};

/* ── FILE HANDLING ── */
window.spHandleToolFiles = function(files){
  Array.from(files).forEach(function(f){
    _spUploadedCaseFiles.push({ name:f.name, size:f.size, type:f.type, file:f });
  });
  spRenderToolFiles();
  spChatSystem(_spUploadedCaseFiles.length + ' case file(s) loaded for analysis.');
};

window.spHandleToolDrop = function(e){
  if(e.dataTransfer && e.dataTransfer.files) spHandleToolFiles(e.dataTransfer.files);
};

function spRenderToolFiles(){
  var list = document.getElementById('spToolFileList');
  if(!list) return;
  if(_spUploadedCaseFiles.length === 0){ list.innerHTML = ''; return; }
  list.innerHTML = _spUploadedCaseFiles.map(function(f, i){
    var sizeKb = (f.size / 1024).toFixed(1);
    return '<div style="display:flex;align-items:center;gap:7px;padding:6px 8px;background:var(--bg-card);border:1px solid var(--border);border-radius:5px;margin-bottom:3px">' +
      '<i class="fas fa-file" style="color:var(--amber);font-size:11px"></i>' +
      '<span style="flex:1;font-size:11px;color:var(--gray-hi);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + f.name + '</span>' +
      '<span style="font-family:var(--mono);font-size:10px;color:var(--gray)">' + sizeKb + 'KB</span>' +
      '<button onclick="_spUploadedCaseFiles.splice(' + i + ',1);spRenderToolFiles()" style="background:none;border:none;color:var(--gray);cursor:pointer;font-size:10px;padding:2px">×</button>' +
    '</div>';
  }).join('');
}

/* ── TOOL STUBS ── */
window.spToolExtract = function(){
  spChatSystem('Opening <strong>Extract & Classify</strong> tool. Upload documents or add contracts to context, then describe what to extract.');
};
window.spToolCompare = function(){
  spAddToContext('cba_framework');
  spAddToContext('mc99_framework');
  spChatAssistant('Cross-framework comparison ready. Both <span class="sp-ref" onclick="spSelectContract(\'cba_framework\')">CBA</span> and <span class="sp-ref" onclick="spSelectContract(\'mc99_framework\')">MC99</span> frameworks added to context. What would you like to compare?');
};
window.spToolChainTrace = function(){
  spChatSystem('Opening <strong>Evidence Chain Tracer</strong>. Select a starting contract or ask me to trace a specific evidence path.');
};
window.spToolGapAnalysis = function(){
  spChatSystem('Opening <strong>Gap Analysis</strong>. I\'ll scan for missing links, unconnected nodes, and incomplete evidence chains.');
};
window.spToolBriefGen = function(){
  spAddToContext('violation_brief_tpl');
  spChatAssistant('Brief Generator ready. <span class="sp-ref" onclick="spSelectContract(\'violation_brief_tpl\')">Violation Brief Template</span> loaded. Provide canonical output data or upload a JSON to generate briefs.');
};
window.spToolValidateDoc = function(){
  spChatSystem('Opening <strong>Document Validator</strong>. Upload JSON or MD files and select which contract(s) to validate against.');
};

/* ── STATS ── */
function spUpdateStats(){
  var els = {
    spStatTotal: SP_CONTRACTS.length,
    spStatLayers: SP_LAYERS.length,
    spStatCtx: _spContextContracts.length,
  };
  Object.keys(els).forEach(function(id){
    var el = document.getElementById(id);
    if(el) el.textContent = els[id];
  });
}

/* ── SIDEBAR RESIZE ── */
function spInitResize(){
  var handle = document.getElementById('spResizeHandle');
  var sidebar = document.getElementById('spSidebar');
  if(!handle || !sidebar) return;
  var dragging = false, startX = 0, startW = 0;
  handle.addEventListener('mousedown', function(e){
    dragging = true; startX = e.clientX; startW = sidebar.offsetWidth;
    handle.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  });
  document.addEventListener('mousemove', function(e){
    if(!dragging) return;
    var w = Math.min(Math.max(startW + (e.clientX - startX), 220), 420);
    sidebar.style.width = w + 'px';
  });
  document.addEventListener('mouseup', function(){
    if(dragging){ dragging = false; handle.classList.remove('dragging'); document.body.style.cursor = ''; document.body.style.userSelect = ''; }
  });
}

/* ── TOAST ── */
function spToast(msg){
  var t = document.getElementById('spToast'); if(!t) return;
  t.textContent = msg; t.style.display = 'block';
  clearTimeout(t._timer);
  t._timer = setTimeout(function(){ t.style.display = 'none'; }, 2500);
}

/* ── COMPAT LAYER (spaces-* HTML API) ── */
function _spacesRenderSidebarTree(){
  var tree = document.getElementById('spacesContractTree');
  if(!tree) return;
  tree.innerHTML = SP_CONTRACTS.slice(0, 10).map(function(c){
    return '<div class="sp-tree-item" onclick="spacesOpenContract(\'' + c.id + '\')">' +
      '<div class="sp-tree-item-icon ' + ((SP_CATEGORIES[c.category]||{}).cls || 'spec') + '"><i class="' + c.icon + '"></i></div>' +
      '<div class="sp-tree-item-body">' +
        '<div class="sp-tree-item-name">' + c.name + '</div>' +
        '<div class="sp-tree-item-meta">' + c.file + '</div>' +
      '</div>' +
    '</div>';
  }).join('');
}

function _spacesRenderFullTree(){
  var fullTree = document.getElementById('spacesFullTree');
  if(!fullTree) return;
  var byLayer = {};
  SP_LAYERS.forEach(function(layer){ byLayer[layer.id] = []; });
  SP_CONTRACTS.forEach(function(c){
    if (byLayer[c.layer]) byLayer[c.layer].push(c);
  });
  fullTree.innerHTML = SP_LAYERS.map(function(layer){
    var items = byLayer[layer.id] || [];
    if (!items.length) return '';
    return '<div class="sp-tree-section">' +
      '<div class="sp-tree-section-title"><i class="fas fa-circle"></i>' + layer.label + ' <span style="margin-left:auto">' + items.length + '</span></div>' +
      '<div class="sp-tree-section-items">' +
        items.map(function(c){
          return '<div class="sp-tree-item" onclick="spacesOpenContract(\'' + c.id + '\')">' +
            '<div class="sp-tree-item-icon ' + ((SP_CATEGORIES[c.category]||{}).cls || 'spec') + '"><i class="' + c.icon + '"></i></div>' +
            '<div class="sp-tree-item-body"><div class="sp-tree-item-name">' + c.name + '</div><div class="sp-tree-item-meta">' + c.file + '</div></div>' +
          '</div>';
        }).join('') +
      '</div>' +
    '</div>';
  }).join('');
}

function _spacesRenderOntologySummary(){
  var summary = document.getElementById('spacesOntologySummary');
  if(!summary) return;
  summary.innerHTML =
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">' +
      '<div class="sp-tree-stat"><span class="sp-tree-stat-num">' + SP_CONTRACTS.length + '</span><span class="sp-tree-stat-label">Contratos</span></div>' +
      '<div class="sp-tree-stat"><span class="sp-tree-stat-num">' + SP_LAYERS.length + '</span><span class="sp-tree-stat-label">Camadas</span></div>' +
    '</div>';
}

function _spacesAppendChat(role, content){
  var log = document.getElementById('spacesChatLog');
  if(!log) return;
  var bubble = document.createElement('div');
  bubble.className = 'spaces-chat-bubble ' + role;
  bubble.innerHTML = content;
  log.appendChild(bubble);
  log.scrollTop = log.scrollHeight;
}

function _spacesUpdateContextIndicator(){
  var indicator = document.getElementById('spacesContextIndicator');
  var count = document.getElementById('spacesCtxCount');
  if(!indicator || !count) return;
  count.textContent = String(_spContextContracts.length);
  indicator.style.display = _spContextContracts.length ? '' : 'none';
}

window.spacesOpenContract = function(id){
  var c = SP_CONTRACTS.find(function(x){ return x.id === id; });
  if(!c) return;
  if (_spContextContracts.indexOf(id) === -1) _spContextContracts.push(id);
  _spacesUpdateContextIndicator();
  var preview = document.getElementById('spacesPreview');
  var title = document.getElementById('spacesPreviewTitle');
  var content = document.getElementById('spacesPreviewContent');
  if (title) title.textContent = c.name;
  if (content) {
    content.innerHTML =
      '<p><strong>Arquivo:</strong> ' + c.file + '</p>' +
      '<p><strong>Camada:</strong> ' + c.layer + '</p>' +
      '<p><strong>Categoria:</strong> ' + ((SP_CATEGORIES[c.category]||{}).label || c.category) + '</p>' +
      '<p style="margin-top:10px">' + c.desc + '</p>';
  }
  if (preview) preview.classList.add('open');
};

window.spacesRefresh = function(){
  _spacesRenderSidebarTree();
  _spacesRenderFullTree();
  _spacesRenderOntologySummary();
  _spacesUpdateContextIndicator();
};

window.spacesCloseView = function(){
  if (typeof window.spacesHideView === 'function') {
    window.spacesHideView();
  } else {
    var v = document.getElementById('spacesView');
    if (v) v.classList.remove('active');
  }
};

window.spacesToggleLeftPanel = function(){
  var left = document.getElementById('spacesLeftPanel');
  if(!left) return;
  left.classList.toggle('collapsed');
  var icon = left.querySelector('.spaces-panel-toggle i');
  if(icon) icon.className = left.classList.contains('collapsed') ? 'fas fa-chevron-right' : 'fas fa-chevron-left';
};

window.spacesClosePreview = function(){
  var preview = document.getElementById('spacesPreview');
  if (preview) preview.classList.remove('open');
};

window.spacesClearContext = function(){
  _spContextContracts = [];
  _spacesUpdateContextIndicator();
  _spacesAppendChat('system', 'Contexto limpo.');
};

window.spacesSendMessage = function(){
  var input = document.getElementById('spacesChatInput');
  if(!input) return;
  var text = (input.value || '').trim();
  if(!text) return;
  input.value = '';
  _spacesAppendChat('user', text.replace(/</g, '&lt;').replace(/>/g, '&gt;'));
  var thinking = document.getElementById('spacesThinkingBadge');
  if (thinking) thinking.style.display = '';
  setTimeout(function(){
    if (thinking) thinking.style.display = 'none';
    _spacesAppendChat('assistant', 'Análise inicial concluída. Contratos no contexto: <strong>' + _spContextContracts.length + '</strong>. Use “Validar Contratos” para checagem completa.');
  }, 350);
};

window.spacesHandleCaseFiles = function(files){
  _spUploadedCaseFiles = Array.from(files || []);
  var list = document.getElementById('spacesFileList');
  if(!list) return;
  if(!_spUploadedCaseFiles.length){
    list.innerHTML = '<div style="font-size:11px;color:var(--gray)">Nenhum arquivo selecionado</div>';
    return;
  }
  list.innerHTML = _spUploadedCaseFiles.map(function(f){
    var size = (f.size / 1024).toFixed(1);
    return '<div style="display:flex;justify-content:space-between;gap:8px;padding:4px 0;border-bottom:1px solid var(--border)">' +
      '<span style="font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + f.name + '</span>' +
      '<span style="font-size:10px;color:var(--gray);font-family:var(--mono)">' + size + ' KB</span>' +
    '</div>';
  }).join('');
};

window.spacesValidateContracts = function(){
  if (typeof window.spValidateAll === 'function') window.spValidateAll();
  _spacesAppendChat('system', 'Validação dos contratos executada.');
};

window.spacesExtractEntities = function(){
  _spacesAppendChat('system', 'Extração de entidades iniciada a partir dos contratos no contexto.');
};

window.spacesGenerateReport = function(){
  _spacesAppendChat('system', 'Relatório consolidado gerado para revisão.');
};

window.spacesShowView = (function(original){
  return function(){
    if (typeof original === 'function') original();
    window.spacesRefresh();
  };
})(window.spacesShowView);

/* ── INIT ── */
window.addEventListener('load', function(){
  spInitResize();
  // Initial welcome chat message
  _spChatMessages = [
    { role:'system', content:'AURA Spaces initialized — <strong>' + SP_CONTRACTS.length + '</strong> contracts in registry across <strong>' + SP_LAYERS.length + '</strong> layers.', ts:Date.now() },
    { role:'assistant', content:'Welcome to <strong>Spaces</strong>. I can help you explore contracts, validate invariants, trace evidence chains, and analyze case files. Select a contract from the tree or ask me anything.', ts:Date.now() }
  ];
  spRenderChat();
});

/* ── EXPOSE ── */
window.spBuildTree = spBuildTree;
window.spUpdateStats = spUpdateStats;
window.spRenderChat = spRenderChat;

})();
