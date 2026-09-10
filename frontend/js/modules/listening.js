(function(){
'use strict';

/* ── SPEAKER COLORS ── */
const LS_COLORS = ['#1c4532','#c4622d','#5b8fa8','#6b4c8c','#b8860b','#9e4a4a','#2d785a','#8b6914','#4a6f8c','#8c4a6b'];
function lsSpeakerColor(idx){ return LS_COLORS[idx % LS_COLORS.length]; }

/* ── CONFIG KEY ── */
const LS_CFG_KEY = 'pinocchio_runpod_v1'; // shared with transcribe.html
const LS_APP_KEY = 'ls_app_cfg_v1';
const LS_DEFAULT_ENDPOINT = 'http://127.0.0.1:8039/api/diarization/transcribe';

function lsIsPrivateHost(hostname){
  if(!hostname) return false;
  var h = String(hostname).toLowerCase();
  if(h === 'localhost' || h === '127.0.0.1' || h === '::1' || h.endsWith('.local')) return true;
  if(/^10\./.test(h)) return true;
  if(/^192\.168\./.test(h)) return true;
  if(/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(h)) return true;
  if(/^127\./.test(h)) return true;
  return false;
}

function lsIsRemoteSecureContext(){
  var isLocalPage = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  var isSecurePage = (window.location.protocol === 'https:' || window.isSecureContext);
  return !isLocalPage && isSecurePage;
}

function lsNormalizeEndpoint(ep){
  var raw = String(ep || '').trim();
  if(!raw) return LS_DEFAULT_ENDPOINT;
  var lower = raw.toLowerCase();
  if (lower === '/api/diarization/transcribe' || lower === 'api/diarization/transcribe') {
    return LS_DEFAULT_ENDPOINT;
  }
  if(/^https?:\/\//i.test(raw)){
    try {
      var parsed = new URL(raw, window.location.origin);
      if(lsIsRemoteSecureContext() && parsed.protocol === 'http:' && lsIsPrivateHost(parsed.hostname)){
        return LS_DEFAULT_ENDPOINT;
      }
      return parsed.toString();
    } catch(_err) {
      return LS_DEFAULT_ENDPOINT;
    }
  }
  if(!/^https?:\/\//i.test(raw) && !raw.startsWith('/')) return '/' + raw;
  return raw;
}

function lsResolveCorsMode(){
  var uiMode = String(((document.getElementById('lsCorsMode')||{}).value || '')).toLowerCase();
  if(uiMode === 'auto' || uiMode === 'proxy' || uiMode === 'direct') return uiMode;
  var cfg = lsGetCfg();
  var cfgMode = String((cfg && cfg.cors_mode) || '').toLowerCase();
  if(cfgMode === 'auto' || cfgMode === 'proxy' || cfgMode === 'direct') return cfgMode;
  return 'auto';
}

function lsLooksLikeCorsError(err){
  if(!err) return false;
  var msg = String(err.message || err || '').toLowerCase();
  if(msg.includes('failed to fetch')) return true;
  if(msg.includes('networkerror')) return true;
  if(msg.includes('load failed')) return true;
  if(msg.includes('cors')) return true;
  return false;
}

// Pass the configured backend origin to the gateway proxy as ?target= so the
// proxy forwards to the backend the user actually configured (e.g. 8049),
// not the gateway's env default. Server validates the hint against
// local/private hosts (SSRF guard), then falls back to its default.
function lsProxyTargetQuery(endpoint, existingSearch){
  var raw = String(endpoint || '').trim();
  if(!/^https?:\/\//i.test(raw)) return '';
  try {
    var origin = new URL(raw).origin;
    if(!origin) return '';
    return (existingSearch ? '&' : '?') + 'target=' + encodeURIComponent(origin);
  } catch(_err) {
    return '';
  }
}

function lsBuildProxyEndpoint(endpoint){
  var raw = String(endpoint || '').trim();
  if(!raw) return '/api/diarization/transcribe';
  var path = raw;
  if(/^https?:\/\//i.test(raw)){
    try {
      var parsed = new URL(raw, window.location.origin);
      path = parsed.pathname || '/api/diarization/transcribe';
    } catch(_err) {
      return '/api/diarization/transcribe';
    }
  }
  var proxyPath;
  var lowerPath = String(path).toLowerCase();
  if(lowerPath.endsWith('/transcribe/async')) proxyPath = '/api/diarization/transcribe/async';
  else if(lowerPath.endsWith('/transcribe')) proxyPath = '/api/diarization/transcribe';
  else {
    var match = path.match(/\/api\/diarization\/transcribe(?:\/async)?/i);
    if(match && match[0]) proxyPath = match[0];
    else if(path.startsWith('/')) proxyPath = path;
    else proxyPath = '/' + path.replace(/^\/+/, '');
  }
  return proxyPath + lsProxyTargetQuery(raw, false);
}

function lsBuildProxyStatusEndpoint(statusEndpoint){
  var raw = String(statusEndpoint || '').trim();
  if(!raw) return '/api/transcripts/status';
  if(/^https?:\/\//i.test(raw)){
    try {
      var parsed = new URL(raw, window.location.origin);
      var basePath = parsed.pathname || '/api/transcripts/status';
      return basePath + (parsed.search || '') + lsProxyTargetQuery(raw, !!parsed.search);
    } catch(_err) {
      return '/api/transcripts/status';
    }
  }
  if(raw.startsWith('/')) return raw;
  return '/' + raw.replace(/^\/+/, '');
}

async function lsFetchWithCorsFallback(url, init, fallbackUrl, contextLabel){
  var mode = lsResolveCorsMode();
  var primary = String(url || '').trim();
  var fallback = String(fallbackUrl || '').trim();
  var attempt = (mode === 'proxy' && fallback) ? fallback : primary;
  try {
    return await fetch(attempt, init);
  } catch(err){
    if(mode === 'direct') throw err;
    var canRetry = !!fallback && attempt !== fallback && lsLooksLikeCorsError(err);
    if(!canRetry) throw err;
    lsLogProcess('CORS bloqueou ' + (contextLabel || 'requisição') + '; tentando via proxy same-origin…', 'info');
    return await fetch(fallback, init);
  }
}

function lsGetCfg(){ try{ return JSON.parse(localStorage.getItem(LS_APP_KEY)||'{}'); }catch{ return {}; } }
function lsSaveCfg(obj){ localStorage.setItem(LS_APP_KEY, JSON.stringify(Object.assign({}, lsGetCfg(), obj))); }
function lsGetRpCfg(){ try{ return JSON.parse(localStorage.getItem(LS_CFG_KEY)||'{}'); }catch{ return {}; } }
function lsSaveRpCfg(obj){ localStorage.setItem(LS_CFG_KEY, JSON.stringify(Object.assign({}, lsGetRpCfg(), obj))); }

/* ── UTILS ── */
function lsToast(msg){
  var t = document.getElementById('lsToast'); if(!t) return;
  t.textContent = msg; t.style.display = 'block';
  setTimeout(function(){ t.style.display = 'none'; }, 2800);
}
function lsFmtTime(sec){
  if(sec==null) return '—';
  var m=Math.floor(sec/60), s=Math.floor(sec%60), ms=Math.round((sec%1)*100);
  return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')+'.'+String(ms).padStart(2,'0');
}
function lsCountWords(text){ return (text||'').split(/\s+/).filter(Boolean).length; }

function lsParseNumberInput(raw, fallback){
  var s = String(raw == null ? '' : raw).trim();
  if(!s) return fallback;
  s = s.replace(/\s+/g, '');
  if(s.includes(',') && s.includes('.')){
    if(s.lastIndexOf(',') > s.lastIndexOf('.')){
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if(s.includes(',')){
    s = s.replace(',', '.');
  }
  var n = Number(s);
  return Number.isFinite(n) ? n : fallback;
}

function lsReadNumericField(id, cfgValue, fallback){
  var input = document.getElementById(id);
  var raw = input ? input.value : '';
  if(String(raw == null ? '' : raw).trim() === '') raw = cfgValue;
  return lsParseNumberInput(raw, fallback);
}

/* ── RUN ID + PARAMS + CONTEXT helpers ── */
function lsGenerateRunId(){
  var ts = Date.now();
  var rand = Math.random().toString(36).slice(2, 8);
  return ts + '_' + rand;
}

function lsSanitizeFilenameToken(raw){
  return String(raw == null ? '' : raw).replace(/[^\w.\-]/g, '_').replace(/_{2,}/g, '_').replace(/^_+|_+$/g, '');
}

function lsCollectParamsSnapshot(){
  var cfg = lsGetCfg();
  function v(id, fb){ var el = document.getElementById(id); return el && String(el.value || '').length ? el.value : fb; }
  return {
    api_endpoint: v('lsApiEndpoint', cfg.api_endpoint || ''),
    language: v('lsLanguage', cfg.language || ''),
    model: v('lsModel', cfg.model || ''),
    min_speakers: Math.max(1, Math.round(lsReadNumericField('lsMinSpeakers', cfg.min_speakers, 1))),
    max_speakers: Math.max(1, Math.round(lsReadNumericField('lsMaxSpeakers', cfg.max_speakers, 4))),
    diarization: v('lsDiarization', cfg.diarization),
    align_output: v('lsAlignOutput', cfg.align_output),
    remove_silence: v('lsRemoveSilence', cfg.remove_silence),
    noise_reduce: v('lsNoiseReduce', cfg.noise_reduce),
    voice_enhance: v('lsVoiceEnhance', cfg.voice_enhance),
    word_timestamps: v('lsWordTimestamps', cfg.word_timestamps),
    vad_threshold: lsReadNumericField('lsVadThreshold', cfg.vad_threshold, 0.3),
    whisper_temp: lsReadNumericField('lsWhisperTemp', cfg.whisper_temp, 0.0),
    beam_size: lsReadNumericField('lsBeamSize', cfg.beam_size, 5),
    best_of: lsReadNumericField('lsBestOf', cfg.best_of, 5),
    chunk_size: lsReadNumericField('lsChunkSize', cfg.chunk_size, 30),
    batch_size: lsReadNumericField('lsBatchSize', cfg.batch_size, 24),
    initial_prompt: v('lsInitialPrompt', cfg.initial_prompt || ''),
    save_to_qdrant: v('lsSaveToQdrant', cfg.save_to_qdrant || 'true'),
    qdrant_collection: v('lsQdrantCollection', cfg.qdrant_collection || ''),
    cors_mode: lsResolveCorsMode()
  };
}

var LS_CONTEXT_KEY = 'ls_context_selection_v1';
function lsGetContextSelection(){
  try { return JSON.parse(localStorage.getItem(LS_CONTEXT_KEY) || '{}') || {}; } catch(_e){ return {}; }
}
function lsSetContextSelection(obj){
  try { localStorage.setItem(LS_CONTEXT_KEY, JSON.stringify(obj || {})); } catch(_e){}
}

/* ── STATE ── */
var lsCurrentResponse = null;
var lsCurrentRunId = null;
var lsSpeakerLabels = {};
var lsIsRunning = false;
var lsSpeakerEditMode = false;   // inline speaker name editing

/* ── PREVIEW STATE ── */
var lsSelectedFile = null;       // File object for the selected media
var lsSelectedFileUrl = null;    // blob: URL for preview
var lsPreviewActive = false;     // true when media is loaded for preview
var lsClipStart = null;          // clip start time in seconds (null = from beginning)
var lsClipEnd = null;            // clip end time in seconds (null = until end)

/* ── ALLOWED VIDEO EXTENSIONS ── */
var LS_VIDEO_EXTS = ['mp4', 'webm', 'mov', 'avi', 'mkv', 'm4v'];

/* ── SEGMENT PLAYBACK STATE ── */
var lsSegmentAudio = null;
var lsSegmentPlayingBtn = null;

/* ── SHOW / HIDE VIEW ── */
window.listeningShowView = function(){
  var hide = ['chatHeader','welcomeState','chatLog','chatCompose','chatToolbar'];
  hide.forEach(function(id){ var el = document.getElementById(id); if(el) el.style.display = 'none'; });
  // Collapse main content so listening gets full workspace width.
  var mc = document.querySelector('.main-content');
  if(mc){ mc._lsDisplay = mc.style.display; mc.style.display = 'none'; }
  // Ensure competing full-screen views are deactivated.
  if (typeof aexHideMain === 'function') aexHideMain();
  ['studioView','descobertaView','memoryView','spacesView','shadersView','mermaidView'].forEach(function(vid){
    var viewEl = document.getElementById(vid);
    if(viewEl) viewEl.classList.remove('active');
  });
  var lv = document.getElementById('listeningView');
  if(lv){
    lv.style.display = '';
    lv.classList.add('active');
  }
  var op = document.getElementById('outputPanel'), bp = document.getElementById('browserPanel');
  if(op){ op._lsPrevOpen = op.classList.contains('open'); op.classList.remove('open'); }
  if(bp){ bp._lsPrevOpen = bp.classList.contains('open'); bp.classList.remove('open'); }
  lsLoadConfig();
  // Best-effort: refresh context lists when the panel is shown.
  try { if(typeof window.lsRefreshContext === 'function') window.lsRefreshContext(); } catch(_e){}
  // Initialise collapsible cards
  lsInitCollapsibleCards();
};

window.listeningHideView = function(){
  var lv = document.getElementById('listeningView');
  if(lv){
    lv.classList.remove('active');
    lv.style.display = '';
  }
  // Restore main-content when leaving listening mode.
  var mc = document.querySelector('.main-content');
  if(mc){ mc.style.display = mc._lsDisplay !== undefined ? mc._lsDisplay : ''; delete mc._lsDisplay; }
  var show = ['chatHeader','welcomeState','chatLog','chatCompose','chatToolbar'];
  show.forEach(function(id){ var el = document.getElementById(id); if(el) el.style.display = ''; });
  var op = document.getElementById('outputPanel'), bp = document.getElementById('browserPanel');
  if(op && op._lsPrevOpen) op.classList.add('open');
  if(bp && bp._lsPrevOpen) bp.classList.add('open');
};

/* ── PROVIDER TOGGLE ── */
window.lsSetProvider = function(provider){
  document.querySelectorAll('#lsProviderToggle button').forEach(function(b){
    b.classList.toggle('active', b.dataset.provider === provider);
  });
  var lf = document.getElementById('lsLocalEndpointField');
  var rf = document.getElementById('lsRunpodFields');
  if(lf) lf.style.display = provider === 'local' ? '' : 'none';
  if(rf) { if(provider === 'runpod') rf.classList.add('visible'); else rf.classList.remove('visible'); }
  lsSaveRpCfg({ provider: provider });
};

window.lsToggleConfig = function(){
  var p = document.getElementById('lsConfigPanel');
  if(!p) return;
  p.style.display = p.style.display === 'none' ? '' : 'none';
};

window.lsSaveConfig = function(){
  var ep = lsNormalizeEndpoint((document.getElementById('lsApiEndpoint')||{}).value || LS_DEFAULT_ENDPOINT);
  var endpointInput = document.getElementById('lsApiEndpoint');
  if(endpointInput) endpointInput.value = ep;

  function lsCfgBoolSelect(id, fallback){
    var raw = String(((document.getElementById(id)||{}).value || fallback)).toLowerCase();
    if(raw === 'true' || raw === 'false') return raw;
    return String(fallback);
  }

  function lsCfgNum(id, fallback){
    return lsParseNumberInput((document.getElementById(id)||{}).value, fallback);
  }

  var cfg = {
    api_endpoint: ep,
    cors_mode: String(((document.getElementById('lsCorsMode')||{}).value || 'auto')).toLowerCase(),
    language: (document.getElementById('lsLanguage')||{}).value || '',
    model: (document.getElementById('lsModel')||{}).value || 'large-v3',
    min_speakers: Math.max(1, Math.round(lsCfgNum('lsMinSpeakers', 1))),
    max_speakers: Math.max(1, Math.round(lsCfgNum('lsMaxSpeakers', 4))),
    diarization: lsCfgBoolSelect('lsDiarization', 'true'),
    align_output: lsCfgBoolSelect('lsAlignOutput', 'true'),
    remove_silence: lsCfgBoolSelect('lsRemoveSilence', 'true'),
    noise_reduce: lsCfgBoolSelect('lsNoiseReduce', 'true'),
    voice_enhance: lsCfgBoolSelect('lsVoiceEnhance', 'true'),
    word_timestamps: lsCfgBoolSelect('lsWordTimestamps', 'false'),
    vad_threshold: lsCfgNum('lsVadThreshold', 0.3),
    whisper_temp: lsCfgNum('lsWhisperTemp', 0.0),
    beam_size: lsCfgNum('lsBeamSize', 5),
    best_of: lsCfgNum('lsBestOf', 5),
    chunk_size: lsCfgNum('lsChunkSize', 30),
    batch_size: lsCfgNum('lsBatchSize', 24),
    initial_prompt: String((document.getElementById('lsInitialPrompt')||{}).value || ''),
    save_to_qdrant: String(((document.getElementById('lsSaveToQdrant')||{}).value || 'true')).toLowerCase(),
    qdrant_collection: String((document.getElementById('lsQdrantCollection')||{}).value || '').trim()
  };
  lsSaveCfg(cfg);
  var rp = {
    api_key: (document.getElementById('lsRunpodApiKey')||{}).value || '',
    endpoint_id: (document.getElementById('lsRunpodEndpointId')||{}).value || '',
    hf_token: (document.getElementById('lsHfToken')||{}).value || '',
    exec_mode: (document.getElementById('lsRunpodExecMode')||{}).value || 'run',
    poll_interval: Math.max(250, Math.round(lsCfgNum('lsRunpodPoll', 3000))),
    timeout: Math.max(1, Math.round(lsCfgNum('lsRunpodTimeout', 600)))
  };
  var activeProvBtn = document.querySelector('#lsProviderToggle button.active');
  rp.provider = activeProvBtn ? activeProvBtn.dataset.provider : 'local';
  lsSaveRpCfg(rp);
  lsToast('Config salva');
};

function lsLoadConfig(){
  var cfg = lsGetCfg();
  var rp  = lsGetRpCfg();
  var ep = lsNormalizeEndpoint(cfg.api_endpoint || LS_DEFAULT_ENDPOINT);
  if (ep !== (cfg.api_endpoint || '')) {
    lsSaveCfg({ api_endpoint: ep });
  }
  var elEndpoint = document.getElementById('lsApiEndpoint');
  if(elEndpoint) elEndpoint.value = ep;
  var corsMode = document.getElementById('lsCorsMode'); if(corsMode) corsMode.value = cfg.cors_mode || 'auto';
  var lang = document.getElementById('lsLanguage'); if(lang && cfg.language) lang.value = cfg.language;
  var model = document.getElementById('lsModel'); if(model && cfg.model) model.value = cfg.model;
  var mins = document.getElementById('lsMinSpeakers'); if(mins && cfg.min_speakers) mins.value = cfg.min_speakers;
  var maxs = document.getElementById('lsMaxSpeakers'); if(maxs && cfg.max_speakers) maxs.value = cfg.max_speakers;
  var diarization = document.getElementById('lsDiarization'); if(diarization && cfg.diarization !== undefined) diarization.value = String(cfg.diarization);
  var alignOutput = document.getElementById('lsAlignOutput'); if(alignOutput && cfg.align_output !== undefined) alignOutput.value = String(cfg.align_output);
  var removeSilence = document.getElementById('lsRemoveSilence'); if(removeSilence && cfg.remove_silence !== undefined) removeSilence.value = String(cfg.remove_silence);
  var noiseReduce = document.getElementById('lsNoiseReduce'); if(noiseReduce && cfg.noise_reduce !== undefined) noiseReduce.value = String(cfg.noise_reduce);
  var voiceEnhance = document.getElementById('lsVoiceEnhance'); if(voiceEnhance && cfg.voice_enhance !== undefined) voiceEnhance.value = String(cfg.voice_enhance);
  var wordTimestamps = document.getElementById('lsWordTimestamps'); if(wordTimestamps && cfg.word_timestamps !== undefined) wordTimestamps.value = String(cfg.word_timestamps);
  var vadThreshold = document.getElementById('lsVadThreshold'); if(vadThreshold && cfg.vad_threshold !== undefined) vadThreshold.value = cfg.vad_threshold;
  var whisperTemp = document.getElementById('lsWhisperTemp'); if(whisperTemp && cfg.whisper_temp !== undefined) whisperTemp.value = cfg.whisper_temp;
  var beamSize = document.getElementById('lsBeamSize'); if(beamSize && cfg.beam_size !== undefined) beamSize.value = cfg.beam_size;
  var bestOf = document.getElementById('lsBestOf'); if(bestOf && cfg.best_of !== undefined) bestOf.value = cfg.best_of;
  var chunkSize = document.getElementById('lsChunkSize'); if(chunkSize && cfg.chunk_size !== undefined) chunkSize.value = cfg.chunk_size;
  var batchSize = document.getElementById('lsBatchSize'); if(batchSize && cfg.batch_size !== undefined) batchSize.value = cfg.batch_size;
  var initialPrompt = document.getElementById('lsInitialPrompt'); if(initialPrompt && cfg.initial_prompt !== undefined) initialPrompt.value = cfg.initial_prompt;
  var saveToQdrant = document.getElementById('lsSaveToQdrant'); if(saveToQdrant && cfg.save_to_qdrant !== undefined) saveToQdrant.value = String(cfg.save_to_qdrant);
  var qdrantCollection = document.getElementById('lsQdrantCollection'); if(qdrantCollection && cfg.qdrant_collection !== undefined) qdrantCollection.value = cfg.qdrant_collection;
  lsPopulateQdrantCollectionSelect(lsAvailableQdrantCollections, cfg.qdrant_collection || '');
  if(rp.api_key){ var k=document.getElementById('lsRunpodApiKey'); if(k) k.value=rp.api_key; }
  if(rp.endpoint_id){ var ei=document.getElementById('lsRunpodEndpointId'); if(ei) ei.value=rp.endpoint_id; }
  if(rp.hf_token){ var hft=document.getElementById('lsHfToken'); if(hft) hft.value=rp.hf_token; }
  if(rp.exec_mode){ var em=document.getElementById('lsRunpodExecMode'); if(em) em.value=rp.exec_mode; }
  if(rp.poll_interval){ var pi=document.getElementById('lsRunpodPoll'); if(pi) pi.value=rp.poll_interval; }
  if(rp.timeout){ var to=document.getElementById('lsRunpodTimeout'); if(to) to.value=rp.timeout; }
  lsSetProvider(rp.provider || 'local');
}

/* ── RUNPOD HEALTH CHECK ── */
window.lsTestRunpodHealth = async function(){
  var s = document.getElementById('lsRunpodHealthStatus');
  var apiKey = (document.getElementById('lsRunpodApiKey')||{}).value;
  var epId = (document.getElementById('lsRunpodEndpointId')||{}).value;
  if(!apiKey||!epId){ if(s){s.className='ls-runpod-status err';s.innerHTML='<i class="fas fa-times-circle"></i> Credenciais ausentes';s.style.display='';} return; }
  if(s){s.className='ls-runpod-status pending';s.innerHTML='<i class="fas fa-spinner fa-spin"></i> Verificando…';s.style.display='';}
  try{
    var resp = await fetch('https://api.runpod.ai/v2/'+encodeURIComponent(epId)+'/health',{headers:{'Authorization':'Bearer '+apiKey}});
    if(!resp.ok) throw new Error('HTTP '+resp.status);
    var data = await resp.json(); var w=data.workers||{}; var ready=(w.ready||0)+(w.idle||0); var total=ready+(w.running||0)+(w.initializing||0);
    if(s){s.className='ls-runpod-status ok';s.innerHTML='<i class="fas fa-check-circle"></i> Conectado · '+ready+'/'+total+' prontos';}
  }catch(err){
    if(s){s.className='ls-runpod-status err';s.innerHTML='<i class="fas fa-times-circle"></i> '+(err.message||'Falha');}
  }
};

/* ── PROGRESS ── */
function lsSetProgress(pct, label, opts){
  var bar = document.getElementById('lsProgressBar');
  var lbl = document.getElementById('lsProgressLabel');
  if(bar) bar.style.width = Math.min(100,Math.max(0,pct))+'%';
  if(lbl && label) lbl.textContent = label;
  if(label && !(opts && opts.silentLog)) lsLogProcess(label);
}
function lsLogProcess(msg, type){
  var logDiv = document.getElementById('lsProcessLog');
  var content = document.getElementById('lsProcessLogContent');
  if(!logDiv || !content) return;
  logDiv.style.display = '';
  var timestamp = new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit', second: '2-digit'});
  var icon = type === 'error' ? '❌' : type === 'success' ? '✓' : type === 'info' ? 'ℹ️' : '▶';
  var color = type === 'error' ? 'var(--red)' : type === 'success' ? 'var(--green)' : type === 'info' ? 'var(--blue)' : 'var(--gray-hi)';
  var entry = '<div style="margin-bottom:3px;color:' + color + '"><span style="color:var(--gray);font-size:9px">' + timestamp + '</span> ' + icon + ' ' + escapeHtml(msg) + '</div>';
  content.innerHTML += entry;
  content.scrollTop = content.scrollHeight;
}
function lsClearLog(){
  var content = document.getElementById('lsProcessLogContent');
  if(content) content.innerHTML = '';
}
function lsSetStage(name){
  var stages = ['Upload','Preprocess','Diarization','Transcription'];
  var map = {upload:'Upload',preprocess:'Preprocess',diarization:'Diarization',transcription:'Transcription'};
  var cur = map[name] || name;
  stages.forEach(function(s){
    var el = document.getElementById('lsStage'+s);
    if(!el) return;
    var isCur = s.toLowerCase() === (name||'').toLowerCase();
    var isDone = stages.indexOf(s) < stages.indexOf(cur);
    el.className = 'ls-stage' + (isCur?' active':'') + (isDone?' done':'');
  });
}
function lsSetRunStatus(text){
  var el = document.getElementById('lsRunStatus');
  if(el) el.textContent = text;
}

function lsFmtElapsed(totalSec){
  var m = Math.floor(totalSec / 60);
  var s = Math.floor(totalSec % 60);
  return String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
}

function lsStartLocalProcessingTicker(){
  var startedAt = Date.now();
  var tick = 0;
  var nextInfoLogSec = 30;

  lsSetRunStatus('Processando transcrição...');

  function update(){
    tick += 1;
    var elapsedSec = Math.floor((Date.now() - startedAt) / 1000);
    var elapsedLabel = lsFmtElapsed(elapsedSec);
    var pct = 56;
    var label = 'Processando áudio... (' + elapsedLabel + ')';

    if(elapsedSec < 45){
      lsSetStage('preprocess');
      pct = Math.min(68, 56 + Math.floor((elapsedSec / 45) * 12));
      label = 'Pré-processando áudio... (' + elapsedLabel + ')';
    } else if(elapsedSec < 180){
      lsSetStage('diarization');
      pct = Math.min(84, 68 + Math.floor(((elapsedSec - 45) / 135) * 16));
      label = 'Identificando falantes... (' + elapsedLabel + ')';
    } else {
      lsSetStage('transcription');
      pct = Math.min(99, 84 + Math.floor((elapsedSec - 180) / 20));
      label = 'Transcrevendo conteúdo... (' + elapsedLabel + ')';
    }

    lsSetProgress(pct, label, { silentLog: true });
    lsSetRunStatus('LA8159 está processando (' + elapsedLabel + ')');

    if(elapsedSec >= nextInfoLogSec){
      lsLogProcess('Ainda processando... tempo decorrido: ' + elapsedLabel, 'info');
      nextInfoLogSec += 30;
    }
  }

  update();
  var timer = setInterval(update, 5000);
  return {
    stop: function(){
      clearInterval(timer);
    }
  };
}

function lsResolveAsyncTranscribeEndpoint(ep){
  var raw = String(ep || '').trim();
  if(!raw) return '/api/diarization/transcribe/async';
  var lowerRaw = raw.toLowerCase();
  if(lowerRaw.endsWith('/transcribe/async')) return raw;
  if(lowerRaw.endsWith('/transcribe')) return raw + '/async';
  if(raw.endsWith('/')) return raw + 'async';
  return raw + '/async';
}

function lsResolveJobStatusEndpoint(asyncEndpoint, asyncData){
  if(asyncData && asyncData.status_url){
    var statusUrl = String(asyncData.status_url).trim();
    if(/^https?:\/\//i.test(statusUrl)) return statusUrl;
    if(/^https?:\/\//i.test(asyncEndpoint)){
      try {
        var base = new URL(asyncEndpoint);
        var rel = statusUrl.startsWith('/') ? statusUrl : ('/' + statusUrl.replace(/^\/+/, ''));
        return new URL(rel, base.origin).toString();
      } catch(_err){}
    }
    if(statusUrl.startsWith('/')) return statusUrl;
    return '/' + statusUrl.replace(/^\/+/, '');
  }

  var rawJobId = asyncData && (asyncData.job_id || asyncData.id || asyncData.jobId || asyncData.task_id || asyncData.request_id);
  if(!rawJobId) return null;
  var jobId = encodeURIComponent(String(rawJobId));
  if(/^https?:\/\//i.test(asyncEndpoint)){
    try {
      var parsed = new URL(asyncEndpoint);
      return parsed.origin + '/api/transcripts/status/' + jobId;
    } catch(_err){}
  }
  return '/api/transcripts/status/' + jobId;
}

function lsResolveJobStatusEndpoints(asyncEndpoint, asyncData){
  var candidates = [];
  var seen = {};

  function pushCandidate(url){
    var u = String(url || '').trim();
    if(!u) return;
    if(seen[u]) return;
    seen[u] = true;
    candidates.push(u);
  }

  var preferred = lsResolveJobStatusEndpoint(asyncEndpoint, asyncData);
  pushCandidate(preferred);

  var rawJobId = asyncData && (asyncData.job_id || asyncData.id || asyncData.jobId || asyncData.task_id || asyncData.request_id);
  if(!rawJobId) return candidates;
  var jobId = encodeURIComponent(String(rawJobId));

  var suffixes = [
    '/api/transcripts/status/' + jobId,
    '/api/pinocchio/transcripts/status/' + jobId,
    '/api/diarization/transcripts/status/' + jobId
  ];

  if(/^https?:\/\//i.test(asyncEndpoint)){
    try {
      var parsed = new URL(asyncEndpoint);
      suffixes.forEach(function(s){ pushCandidate(parsed.origin + s); });
    } catch(_err){}
  }

  suffixes.forEach(pushCandidate);
  return candidates;
}

async function lsPollLocalTranscriptionJob(statusEndpoint, jobId){
  var statusEndpoints = Array.isArray(statusEndpoint) ? statusEndpoint.slice() : [statusEndpoint];
  statusEndpoints = statusEndpoints.filter(function(ep){ return !!String(ep || '').trim(); });
  if(!statusEndpoints.length){
    throw new Error('Nenhum endpoint de status disponível para o job ' + jobId);
  }

  var endpointIdx = 0;
  var lastLoggedProgress = -1;
  var lastLoggedMessage = '';
  var transientFailCount = 0;

  while(true){
    var activeStatusEndpoint = statusEndpoints[endpointIdx];
    var resp = await lsFetchWithCorsFallback(
      activeStatusEndpoint,
      { cache: 'no-store' },
      lsBuildProxyStatusEndpoint(activeStatusEndpoint),
      'consulta de status'
    );
    if(!resp.ok){
      if(resp.status === 404 && endpointIdx < statusEndpoints.length - 1){
        endpointIdx += 1;
        lsLogProcess('Endpoint de status alternativo detectado, tentando fallback...', 'info');
        continue;
      }
      if(resp.status === 404 || resp.status === 500 || resp.status === 502 || resp.status === 503 || resp.status === 504){
        transientFailCount += 1;
        if(transientFailCount % 5 === 1){
          lsLogProcess('Aguardando atualização de status do job...', 'info');
        }
        await new Promise(function(r){ setTimeout(r, 1000); });
        continue;
      }
      var errText = await resp.text().catch(function(){ return ''; });
      throw new Error('Falha ao consultar status do job ' + jobId + ' em ' + activeStatusEndpoint + ' (HTTP ' + resp.status + '): ' + errText.substring(0, 240));
    }

    transientFailCount = 0;

    var statusData = await resp.json();
    var normalizedStatus = String((statusData && statusData.status) || '').toLowerCase();
    var statusResult = statusData && (statusData.result || statusData.output || statusData.data || null);

    if(!normalizedStatus && !statusResult){
      if(endpointIdx < statusEndpoints.length - 1){
        endpointIdx += 1;
        lsLogProcess('Payload de status vazio/inválido; alternando endpoint...', 'info');
        continue;
      }
      transientFailCount += 1;
      if(transientFailCount % 5 === 1){
        lsLogProcess('Status do job ainda indisponível (payload vazio), aguardando...', 'info');
      }
      await new Promise(function(r){ setTimeout(r, 1000); });
      continue;
    }

    var stage = String(statusData.stage || 'transcription').toLowerCase();
    var progress = Number(statusData.progress || 0);
    if(!Number.isFinite(progress)) progress = 0;
    progress = Math.max(0, Math.min(100, Math.round(progress)));
    var message = String(statusData.message || 'Processando...');
    var elapsed = Number(statusData.elapsed_s || 0);
    var elapsedLabel = Number.isFinite(elapsed) && elapsed >= 0 ? lsFmtElapsed(elapsed) : null;

    lsSetStage(stage);
    lsSetProgress(Math.min(progress, 99), message + (elapsedLabel ? ' (' + elapsedLabel + ')' : ''), { silentLog: true });
    lsSetRunStatus('LA8159 está processando' + (elapsedLabel ? ' (' + elapsedLabel + ')' : '...'));

    if(message !== lastLoggedMessage || progress >= lastLoggedProgress + 5){
      lsLogProcess(message + (elapsedLabel ? ' · ' + elapsedLabel : ''), 'info');
      lastLoggedMessage = message;
      lastLoggedProgress = progress;
    }

    if(normalizedStatus === 'done' || normalizedStatus === 'completed' || normalizedStatus === 'success' || normalizedStatus === 'finished'){
      if(statusResult){
        return statusResult;
      }
      if(statusData && statusData.segments){
        return statusData;
      }
      if(endpointIdx < statusEndpoints.length - 1){
        endpointIdx += 1;
        lsLogProcess('Status final sem resultado; tentando endpoint alternativo...', 'info');
        continue;
      }
      throw new Error('Job ' + jobId + ' concluído sem resultado');
    }
    if(normalizedStatus === 'error' || normalizedStatus === 'failed' || normalizedStatus === 'cancelled' || normalizedStatus === 'canceled'){
      throw new Error(String(statusData.error || statusData.message || ('Job ' + jobId + ' falhou')));
    }

    await new Promise(function(r){ setTimeout(r, 1500); });
  }
}

async function lsTranscribeLocalLegacy(ep, fd){
  var processingTicker = lsStartLocalProcessingTicker();
  var resp;
  var data;
  try {
    resp = await lsFetchWithCorsFallback(
      ep,
      { method:'POST', body:fd },
      lsBuildProxyEndpoint(ep),
      'transcrição legado'
    );
    if(!resp.ok){
      var e=await resp.text().catch(function(){return '';});
      lsLogProcess('Erro na requisição: HTTP ' + resp.status, 'error');
      throw new Error('HTTP '+resp.status+': '+e.substring(0,300));
    }

    lsSetStage('diarization'); lsSetProgress(78, 'Diarização concluída, preparando transcrição...');
    lsLogProcess('Preprocessamento e diarização concluídos', 'success');

    data = await resp.json();
  } finally {
    processingTicker.stop();
  }

  lsSetStage('transcription');
  lsLogProcess('Diarização concluída: ' + (data.segments ? data.segments.length : 0) + ' segmentos identificados', 'success');
  lsLogProcess('Iniciando transcrição com Whisper large-v3...', 'info');
  lsSetProgress(85, 'Transcrição pronta, finalizando resultado...');
  lsSetProgress(95, 'Organizando segmentos finais...');
  lsSetProgress(100, 'Concluído');
  lsLogProcess('Transcrição finalizada com sucesso!', 'success');
  return data;
}

/* ── LOCAL TRANSCRIPTION ── */
async function lsTranscribeLocal(file){
  var cfg = lsGetCfg();
  var ep = lsNormalizeEndpoint((document.getElementById('lsApiEndpoint')||{}).value || cfg.api_endpoint || LS_DEFAULT_ENDPOINT);
  var asyncEp = lsResolveAsyncTranscribeEndpoint(ep);
  lsSetStage('upload'); lsSetProgress(15, 'Enviando áudio…');
  var fd = new FormData(); fd.append('file', file);
  var lang = (document.getElementById('lsLanguage')||{}).value || cfg.language || '';
  var model = (document.getElementById('lsModel')||{}).value || cfg.model || 'large-v3';
  var minS = Math.max(1, Math.round(lsReadNumericField('lsMinSpeakers', cfg.min_speakers, 1)));
  var maxS = Math.max(1, Math.round(lsReadNumericField('lsMaxSpeakers', cfg.max_speakers, 4)));
  var diarization = String((document.getElementById('lsDiarization')||{}).value || cfg.diarization || 'true');
  var alignOutput = String((document.getElementById('lsAlignOutput')||{}).value || cfg.align_output || 'true');
  var removeSilence = String((document.getElementById('lsRemoveSilence')||{}).value || cfg.remove_silence || 'true');
  var noiseReduce = String((document.getElementById('lsNoiseReduce')||{}).value || cfg.noise_reduce || 'true');
  var voiceEnhance = String((document.getElementById('lsVoiceEnhance')||{}).value || cfg.voice_enhance || 'true');
  var wordTimestamps = String((document.getElementById('lsWordTimestamps')||{}).value || cfg.word_timestamps || 'false');
  var vadThreshold = lsReadNumericField('lsVadThreshold', cfg.vad_threshold, 0.3);
  var whisperTemp = lsReadNumericField('lsWhisperTemp', cfg.whisper_temp, 0.0);
  var beamSize = lsReadNumericField('lsBeamSize', cfg.beam_size, 5);
  var bestOf = lsReadNumericField('lsBestOf', cfg.best_of, 5);
  var chunkSize = lsReadNumericField('lsChunkSize', cfg.chunk_size, 30);
  var batchSize = lsReadNumericField('lsBatchSize', cfg.batch_size, 24);
  var initialPrompt = String((document.getElementById('lsInitialPrompt')||{}).value || cfg.initial_prompt || '');
  fd.append('language', lang); fd.append('model_size', model);
  fd.append('min_speakers', minS); fd.append('max_speakers', maxS);
  fd.append('diarization', diarization);
  fd.append('align_output', alignOutput);
  fd.append('remove_silence', removeSilence);
  fd.append('noise_reduce', noiseReduce);
  fd.append('voice_enhance', voiceEnhance);
  fd.append('word_timestamps', wordTimestamps);
  if(Number.isFinite(vadThreshold)) fd.append('vad_threshold', String(vadThreshold));
  if(Number.isFinite(whisperTemp)) fd.append('whisper_temp', String(whisperTemp));
  if(Number.isFinite(beamSize)) fd.append('beam_size', String(Math.max(1, Math.round(beamSize))));
  if(Number.isFinite(bestOf)) fd.append('best_of', String(Math.max(1, Math.round(bestOf))));
  if(Number.isFinite(chunkSize)) fd.append('chunk_size', String(Math.max(5, Math.round(chunkSize))));
  if(Number.isFinite(batchSize)) fd.append('batch_size', String(Math.max(1, Math.round(batchSize))));
  if(initialPrompt) fd.append('initial_prompt', initialPrompt);
  // Per-run id (so reprocessing the same audio doesn't collide on disk/qdrant).
  var runId = lsCurrentRunId || lsGenerateRunId();
  lsCurrentRunId = runId;
  fd.append('run_id', runId);
  fd.append('client_run_id', runId);
  // Qdrant indexing opt-in/out + optional target collection (best-effort; backend may ignore).
  var saveToQdrant = String(((document.getElementById('lsSaveToQdrant')||{}).value || cfg.save_to_qdrant || 'true')).toLowerCase();
  var qdrantCollection = String((document.getElementById('lsQdrantCollection')||{}).value || cfg.qdrant_collection || '').trim();
  fd.append('save_to_qdrant', saveToQdrant);
  fd.append('index_qdrant', saveToQdrant);
  fd.append('index_params', 'true');
  if(qdrantCollection) fd.append('qdrant_collection', qdrantCollection);
  // Always send a params snapshot so the backend can persist alongside the run.
  try { fd.append('params_json', JSON.stringify(lsCollectParamsSnapshot())); } catch(_e){}
  lsSetProgress(30, 'Upload completo, processando…'); lsSetStage('preprocess');
  lsLogProcess('Arquivo enviado: ' + file.name + ' (' + (file.size/1024/1024).toFixed(2) + ' MB)', 'info');
  lsLogProcess('Iniciando preprocessamento de áudio...', 'info');
  lsSetProgress(35, 'Carregando áudio...');
  lsSetProgress(40, 'Aplicando redução de ruído...');
  lsSetProgress(45, 'Aplicando voice enhancement...');
  lsSetProgress(50, 'Ajustando ganho de áudio...');
  lsSetProgress(55, 'Removendo silêncios...');

  var asyncResp = await lsFetchWithCorsFallback(
    asyncEp,
    { method:'POST', body:fd },
    lsBuildProxyEndpoint(asyncEp),
    'início da transcrição assíncrona'
  );
  if(asyncResp.status === 404 || asyncResp.status === 405){
    lsLogProcess('Servidor sem modo assíncrono, usando fluxo legado...', 'info');
    return lsTranscribeLocalLegacy(ep, fd);
  }
  if(!asyncResp.ok){
    var asyncErr = await asyncResp.text().catch(function(){ return ''; });
    throw new Error('Falha ao iniciar transcrição assíncrona (HTTP ' + asyncResp.status + '): ' + asyncErr.substring(0, 300));
  }

  var asyncData = await asyncResp.json();
  var asyncJobId = asyncData && (asyncData.job_id || asyncData.id || asyncData.jobId || asyncData.task_id || asyncData.request_id);
  var asyncResult = asyncData && (asyncData.result || asyncData.output || asyncData.data || null);

  if(!asyncJobId){
    if(asyncData && asyncData.segments){
      lsLogProcess('Servidor retornou resultado direto sem job_id', 'info');
      lsSetStage('transcription');
      lsSetProgress(100, 'Concluído');
      return asyncData;
    }
    if(asyncResult && asyncResult.segments){
      lsLogProcess('Servidor retornou resultado direto em payload.result sem job_id', 'info');
      lsSetStage('transcription');
      lsSetProgress(100, 'Concluído');
      return asyncResult;
    }
    throw new Error('Resposta inválida ao iniciar transcrição assíncrona: ' + JSON.stringify(asyncData || {}).slice(0, 240));
  }

  var statusEndpoints = lsResolveJobStatusEndpoints(asyncEp, asyncData);
  if(!statusEndpoints.length){
    throw new Error('Não foi possível resolver endpoint de status para o job');
  }

  lsSetStage('preprocess');
  lsSetProgress(6, 'Job criado, aguardando execução...', { silentLog: true });
  lsLogProcess('Job iniciado: ' + asyncJobId, 'info');

  var data = await lsPollLocalTranscriptionJob(statusEndpoints, asyncJobId);
  lsSetStage('transcription');
  lsSetProgress(100, 'Concluído');
  lsLogProcess('Transcrição finalizada com sucesso!', 'success');
  return data;
}

/* ── RUNPOD TRANSCRIPTION ── */
async function lsTranscribeRunpod(file){
  var rpCfg = lsGetRpCfg();
  var apiKey = (document.getElementById('lsRunpodApiKey')||{}).value || rpCfg.api_key;
  var endpointId = (document.getElementById('lsRunpodEndpointId')||{}).value || rpCfg.endpoint_id;
  var execMode = (document.getElementById('lsRunpodExecMode')||{}).value || rpCfg.exec_mode || 'run';
  var pollInterval = Math.max(250, Math.round(lsReadNumericField('lsRunpodPoll', rpCfg.poll_interval, 3000)));
  var timeout = Math.max(1, Math.round(lsReadNumericField('lsRunpodTimeout', rpCfg.timeout, 600))) * 1000;
  if(!apiKey||!endpointId) throw new Error('Credenciais RunPod necessárias');
  var cfg = lsGetCfg();
  var lang = (document.getElementById('lsLanguage')||{}).value || cfg.language || '';
  var model = (document.getElementById('lsModel')||{}).value || cfg.model || 'large-v3';
  var minS = Math.max(1, Math.round(lsReadNumericField('lsMinSpeakers', cfg.min_speakers, 1)));
  var maxS = Math.max(1, Math.round(lsReadNumericField('lsMaxSpeakers', cfg.max_speakers, 4)));

  lsSetStage('upload'); lsSetProgress(10, 'Lendo arquivo…');
  var buf = await file.arrayBuffer();
  var base64 = btoa(new Uint8Array(buf).reduce(function(d,b){return d+String.fromCharCode(b);},''));
  lsSetProgress(50, 'Codificando ('+((base64.length/1024/1024).toFixed(1))+' MB)…');

  var hfToken = (document.getElementById('lsHfToken')||{}).value || rpCfg.hf_token || '';
  if(!hfToken){
    lsToast('⚠️ HuggingFace Token ausente — abra Config e preencha o campo HF Token');
    var panel = document.getElementById('lsConfigPanel');
    if(panel) panel.style.display = '';
    throw new Error('HuggingFace Token não configurado. Abra Config → campo "HuggingFace Token" → cole hf_... → Salvar Config');
  }
  var input = {
    audio_base64: base64, audio_filename: file.name,
    language: lang.split('-')[0], model: model,
    diarization: true, align_output: true,
    min_speakers: minS, max_speakers: maxS,
    word_timestamps: false, batch_size: 24, chunk_size: 30,
    initial_prompt: '',
    hf_token: hfToken,
    auth_token: hfToken,
    huggingface_api_key: hfToken
  };

  lsSetProgress(90, 'Enviando para RunPod…');
  var baseUrl = 'https://api.runpod.ai/v2/'+encodeURIComponent(endpointId);
  var headers = {'Authorization':'Bearer '+apiKey,'Content-Type':'application/json'};
  var submitResp = await fetch(baseUrl+'/'+execMode, {method:'POST',headers:headers,body:JSON.stringify({input:input})});
  if(!submitResp.ok){ var e=await submitResp.text().catch(function(){return '';}); throw new Error('RunPod submit falhou ('+submitResp.status+'): '+e); }
  var submitData = await submitResp.json();

  if(execMode === 'runsync'){
    if(submitData.status === 'COMPLETED' && submitData.output) return lsNormalizeOutput(submitData.output, file.name);
    if(submitData.error) throw new Error('RunPod: '+submitData.error);
    if(submitData.output) return lsNormalizeOutput(submitData.output, file.name);
    // runsync timed out internally → fall through to poll if job ID exists
    if(!submitData.id) throw new Error('Resposta inesperada do RunPod');
  }

  var jobId = submitData.id; if(!jobId) throw new Error('Sem ID de job');
  lsSetStage('diarization'); lsSetProgress(20, 'Job na fila: '+jobId);
  var deadline = Date.now() + timeout, pollCount = 0;
  while(Date.now() < deadline){
    await new Promise(function(r){setTimeout(r, pollInterval);}); pollCount++;
    var sr = await fetch(baseUrl+'/status/'+jobId, {headers:{'Authorization':'Bearer '+apiKey}});
    if(!sr.ok) continue;
    var sd = await sr.json();
    if(sd.status === 'IN_QUEUE') lsSetProgress(30, 'Na fila (poll #'+pollCount+')…');
    else if(sd.status === 'IN_PROGRESS') lsSetProgress(50+Math.min(pollCount,20), 'Processando na GPU…');
    else if(sd.status === 'COMPLETED'){ lsSetStage('transcription'); lsSetProgress(100, 'Concluído'); return lsNormalizeOutput(sd.output, file.name); }
    else if(sd.status === 'FAILED') throw new Error('Job falhou: '+(sd.error||'desconhecido'));
    else if(sd.status === 'CANCELLED') throw new Error('Job cancelado');
  }
  throw new Error('Timeout após '+(timeout/1000)+'s');
}

function lsNormalizeOutput(output, filename){
  if(!output) return {segments:[],text:'',provider:'runpod'};
  if(output.segments && output.segments.length>0 && output.segments[0].speaker !== undefined){
    output.provider = 'runpod'; return output;
  }
  var segments = (output.segments||[]).map(function(seg,i){
    return {id:i,start:seg.start||0,end:seg.end||0,text:(seg.text||'').trim(),speaker:seg.speaker||('SPEAKER_'+String(i%10).padStart(2,'0')),avg_logprob:seg.avg_logprob||null};
  });
  return {segments:segments,text:segments.map(function(s){return s.text;}).join(' '),language:output.language||'',duration:output.duration||null,filename:filename,provider:'runpod',timings:output.timings||null};
}

/* ── MAIN TRANSCRIPTION ── */
async function lsRunTranscription(file){
  if(lsIsRunning) return;
  lsIsRunning = true;
  lsSpeakerLabels = {};
  lsSpeakerEditMode = false;
  lsCurrentResponse = null;
  // Preserve run ID if already set during preview (so media file in listening_files/ matches)
  if(!lsCurrentRunId) lsCurrentRunId = lsGenerateRunId();

  // Reset UI
  var pc = document.getElementById('lsProgressCard'), tc = document.getElementById('lsTranscriptCard');
  var sp = document.getElementById('lsSpeakerPanel');
  if(pc) pc.style.display = '';
  if(tc) tc.style.display = 'none';
  if(sp) sp.style.display = 'none';
  // Reset edit mode UI
  var editBtn = document.getElementById('lsSpeakerEditBtn');
  var editActions = document.getElementById('lsSpeakerEditActions');
  if(editBtn){ editBtn.innerHTML = '<i class="fas fa-pen"></i> Edit'; editBtn.classList.remove('active'); }
  if(editActions) editActions.classList.remove('visible');
  lsSetProgress(0, 'Preparando…');
  lsSetRunStatus('LA8159 está ouvindo…');
  var aio = document.getElementById('lsAiOutput'); if(aio) aio.style.display = 'none';

  // Show file info
  var fi = document.getElementById('lsFileInfo');
  if(fi){ fi.style.display=''; fi.textContent = file.name + ' · ' + (file.size/1024/1024).toFixed(2) + ' MB'; }

  try{
    var useRunpod = (function(){
      var activeBtn = document.querySelector('#lsProviderToggle button.active');
      return activeBtn && activeBtn.dataset.provider === 'runpod';
    })();
    var data = useRunpod ? await lsTranscribeRunpod(file) : await lsTranscribeLocal(file);
    lsCurrentResponse = data;

    // Resolve a stable unique id for this run: prefer the backend's transcript_id
    // (already unique per execution), else fall back to the client-side run id.
    var paramsSnapshot = lsCollectParamsSnapshot();
    var runId = (data && (data.transcript_id || data.id)) || lsCurrentRunId || lsGenerateRunId();
    lsCurrentRunId = runId;
    var runIdToken = lsSanitizeFilenameToken(runId);

    // Always attach params to the persisted payload so we can later mine
    // best configurations per segment / per audio.
    try {
      if(data && typeof data === 'object'){
        if(!data.params || typeof data.params !== 'object') data.params = paramsSnapshot;
        else data.params = Object.assign({}, paramsSnapshot, data.params);
        data.run_id = runId;
        data.client_run_id = lsCurrentRunId;
      }
    } catch(_e){}

    // Save transcript to olivia/transcripts for persistence and cross-section access
    try {
      lsLogProcess('💾 Salvando transcrição...', 'info');
      var baseTranscriptName = file.name.replace(/\.(m4a|mp3|wav|ogg|flac|mp4|webm)$/i, '');
      var requestedTranscriptName = baseTranscriptName + '__' + runIdToken + '_transcript';
      const saveResp = await fetch(`${API_BASE}/api/transcripts/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: requestedTranscriptName,
          run_id: runId,
          params: paramsSnapshot,
          save_to_qdrant: paramsSnapshot.save_to_qdrant,
          qdrant_collection: paramsSnapshot.qdrant_collection,
          data: data
        })
      });
      if (saveResp.ok) {
        var saveResult = {};
        try {
          saveResult = await saveResp.json();
        } catch(_parseErr) {
          saveResult = {};
        }
        var savedName =
          (saveResult && (saveResult.filename || saveResult.file || saveResult.name || saveResult.saved_as)) ||
          requestedTranscriptName;
        lsLogProcess('Transcrição salva: ' + savedName, 'success');
        if (typeof console !== 'undefined' && console.info) {
          console.info('Transcript saved to:', (saveResult && (saveResult.path || saveResult.filepath || saveResult.location)) || savedName);
        }
      } else {
        lsLogProcess('⚠️ Falha ao salvar transcrição (continua em memória)', 'warning');
      }
    } catch (saveErr) {
      var saveMsg = (saveErr && saveErr.message) ? saveErr.message : String(saveErr || 'erro desconhecido');
      lsLogProcess('⚠️ Erro ao salvar transcrição (continua em memória): ' + saveMsg, 'warning');
      console.warn('Failed to save transcript:', saveErr);
    }

    // Mirror the transcript into the active project's listening_files/ so it
    // lives alongside Case/Discovery artifacts and is visible to the agent.
    try {
      var _pid = (typeof getCurrentProjectId === 'function') ? getCurrentProjectId() : null;
      if (_pid) {
        var baseName = file.name.replace(/\.(m4a|mp3|wav|ogg|flac|mp4|webm)$/i, '');
        var safeBase = baseName.replace(/[^\w.\-() ]/g, '_') + '__' + runIdToken;
        var transcriptJson = JSON.stringify(data, null, 2);
        var transcriptText = (data.segments || [])
          .map(function(s){ return '[' + (s.speaker || '?') + '] ' + String(s.text || '').trim(); })
          .filter(function(line){ return line.length > 4; })
          .join('\n');
        var fd = new FormData();
        fd.append('files', new Blob([transcriptJson], { type: 'application/json' }), safeBase + '.transcript.json');
        if (transcriptText) {
          fd.append('files', new Blob([transcriptText], { type: 'text/plain;charset=utf-8' }), safeBase + '.transcript.txt');
        }
        var mirrorResp = await fetch(
          `${API_BASE}/api/projects/${encodeURIComponent(_pid)}/upload?section=listening_files&preserve_paths=false`,
          { method: 'POST', body: fd }
        );
        if (mirrorResp.ok) {
          lsLogProcess('Transcrição anexada ao projeto ativo', 'success');
          if (typeof refreshProjectIndex === 'function') refreshProjectIndex(_pid);
          if (typeof loadProjectFiles === 'function') loadProjectFiles();
        } else {
          lsLogProcess('⚠️ Falha ao anexar transcrição ao projeto', 'warning');
        }
      }
    } catch (mirrorErr) {
      console.warn('Failed to mirror transcript to project:', mirrorErr);
    }
    
    if(tc) tc.style.display = '';
    lsRenderTranscript(data.segments || []);
    lsRenderSpeakers(data.segments || []);
    lsSetRunStatus('Concluído — '+(data.segments||[]).length+' segmentos');
    lsToast('Transcrição completa');
  }catch(err){
    lsSetProgress(0, err.message);
    lsSetRunStatus('Erro: '+err.message);
    lsToast('Erro: '+err.message);
  }finally{
    lsIsRunning = false;
  }
}

/* ── COLLAPSIBLE CARDS ── */
function lsInitCollapsibleCards() {
  document.querySelectorAll('.ls-card-head').forEach(function(head) {
    if (head.dataset.lsCollapsibleBound) return;
    head.dataset.lsCollapsibleBound = 'true';

    if (!head.querySelector('.ls-toggle-icon')) {
      var icon = document.createElement('i');
      icon.className = 'fas fa-chevron-down ls-toggle-icon';
      head.appendChild(icon);
    }

    head.addEventListener('click', function(e) {
      if (e.target.closest('button, input, select, textarea, a')) return;
      var card = head.closest('.ls-card');
      if (card) card.classList.toggle('collapsed');
    });
  });
}

/* ── SEGMENT PLAYBACK ── */
window.lsPlaySegment = function(start, end, btn) {
  if (lsSegmentAudio) {
    lsSegmentAudio.pause();
    lsSegmentAudio.currentTime = 0;
    lsSegmentAudio = null;
  }
  if (lsSegmentPlayingBtn) {
    lsSegmentPlayingBtn.classList.remove('playing');
    lsSegmentPlayingBtn.innerHTML = '▶';
    lsSegmentPlayingBtn = null;
  }

  if (!lsSelectedFileUrl && !lsSelectedFile) {
    lsToast('⚠️ Mídia original não disponível para reprodução');
    return;
  }

  var audioUrl = lsSelectedFileUrl;
  if (!audioUrl && lsSelectedFile) {
    audioUrl = URL.createObjectURL(lsSelectedFile);
    lsSelectedFileUrl = audioUrl; // cache it
  }

  lsSegmentAudio = new Audio(audioUrl);
  lsSegmentAudio.currentTime = Math.max(0, start);
  lsSegmentPlayingBtn = btn;
  if (btn) {
    btn.classList.add('playing');
    btn.innerHTML = '⏸';
  }

  lsSegmentAudio.play().catch(function(err) {
    lsToast('Playback error: ' + err.message);
    if (btn) {
      btn.classList.remove('playing');
      btn.innerHTML = '▶';
    }
  });

  var stopAt = end;
  var checkInterval = setInterval(function() {
    if (lsSegmentAudio && lsSegmentAudio.currentTime >= stopAt) {
      lsSegmentAudio.pause();
      clearInterval(checkInterval);
      if (lsSegmentPlayingBtn) {
        lsSegmentPlayingBtn.classList.remove('playing');
        lsSegmentPlayingBtn.innerHTML = '▶';
        lsSegmentPlayingBtn = null;
      }
      lsSegmentAudio = null;
    }
  }, 250);

  lsSegmentAudio._stopInterval = checkInterval;
  lsSegmentAudio.addEventListener('pause', function() {
    clearInterval(checkInterval);
    if (lsSegmentPlayingBtn) {
      lsSegmentPlayingBtn.classList.remove('playing');
      lsSegmentPlayingBtn.innerHTML = '▶';
      lsSegmentPlayingBtn = null;
    }
    if (lsSegmentAudio === this) lsSegmentAudio = null;
  });
};

/* ── RENDER TRANSCRIPT (updated with play button + editable text) ── */
function lsRenderTranscript(segments){
  var body = document.getElementById('lsTranscriptBody'); if(!body) return;
  body.innerHTML = '';
  var speakerIdx = {};
  var speakerColorIdx = 0;
  (segments||[]).forEach(function(seg, segIndex){
    var text = (seg.text||'').trim(); if(!text) return;
    var spk = seg.speaker || 'UNKNOWN';
    if(speakerIdx[spk] === undefined) {
      speakerIdx[spk] = speakerColorIdx++;
    }
    var name = lsSpeakerLabels[spk] || spk;
    var color = lsSpeakerColor(speakerIdx[spk]);
    var row = document.createElement('div');
    row.className = 'ls-seg-row';
    row.innerHTML =
      '<div class="ls-seg-time">'+lsFmtTime(seg.start)+'</div>'+
      '<div class="ls-seg-dot" style="background:'+color+'"></div>'+
      '<button class="ls-seg-play" data-start="'+seg.start+'" data-end="'+seg.end+'" data-index="'+segIndex+'" title="Play segment">▶</button>'+
      '<div class="ls-seg-body">' +
        '<div class="ls-seg-speaker" style="color:'+color+'">'+name+'</div>'+
        '<div class="ls-seg-text" contenteditable="true" data-index="'+segIndex+'" spellcheck="false">'+text+'</div>'+
      '</div>';
    body.appendChild(row);
  });

  // Attach play button events
  body.querySelectorAll('.ls-seg-play').forEach(function(btn){
    btn.addEventListener('click', function(e){
      e.stopPropagation();
      var start = parseFloat(btn.dataset.start);
      var end = parseFloat(btn.dataset.end);
      if(isNaN(start) || isNaN(end)){
        lsToast('Segmento sem timestamps válidos');
        return;
      }
      lsPlaySegment(start, end, btn);
    });
  });

  // Attach editable text events
  body.querySelectorAll('.ls-seg-text').forEach(function(el){
    el.addEventListener('input', function(){
      var idx = parseInt(el.dataset.index);
      var newText = el.textContent.trim();
      if(lsCurrentResponse && lsCurrentResponse.segments && lsCurrentResponse.segments[idx]){
        lsCurrentResponse.segments[idx].text = newText;
      }
    });

    el.addEventListener('blur', function(){
      var idx = parseInt(el.dataset.index);
      if(lsCurrentResponse && lsCurrentResponse.segments && lsCurrentResponse.segments[idx]){
        var newText = el.textContent.trim();
        if(newText !== lsCurrentResponse.segments[idx].text){
          lsCurrentResponse.segments[idx].text = newText;
          lsToast('Segmento atualizado');
          // Optionally re-render speakers to update word counts
          lsRenderSpeakers(lsCurrentResponse.segments);
        }
      }
    });
  });

  // Ensure collapsible cards are initialised
  lsInitCollapsibleCards();
}

/* ── RENDER SPEAKERS ── */
function lsRenderSpeakers(segments){
  var sp = document.getElementById('lsSpeakerPanel');
  var grid = document.getElementById('lsSpeakerGrid');
  if(!grid) return;
  var speakers = {};
  (segments||[]).forEach(function(seg){
    var spk = seg.speaker || 'UNKNOWN';
    if(!speakers[spk]) speakers[spk] = {count:0,words:0};
    speakers[spk].count++;
    speakers[spk].words += lsCountWords(seg.text);
  });
  var keys = Object.keys(speakers);
  if(!keys.length){ if(sp) sp.style.display='none'; return; }
  if(sp) sp.style.display='';
  var speakerIdx = {};
  keys.forEach(function(k,i){ speakerIdx[k]=i; });
  grid.innerHTML = keys.map(function(spk){
    var d = speakers[spk];
    var name = lsSpeakerLabels[spk] || spk;
    var color = lsSpeakerColor(speakerIdx[spk]);
    var safeId = 'lsSpeakEdit_' + spk.replace(/[^\w]/g, '_');

    if(lsSpeakerEditMode){
      // Edit mode: render inline input
      return '<div class="ls-speaker-card" style="cursor:default">'+
        '<div style="display:flex;align-items:center;gap:8px">'+
          '<div style="width:28px;height:28px;border-radius:50%;background:'+color+';display:flex;align-items:center;justify-content:center;color:white;font-size:12px;font-weight:600;flex-shrink:0">'+name.charAt(0).toUpperCase()+'</div>'+
          '<div style="flex:1;min-width:0">'+
            '<input id="'+safeId+'" class="ls-speaker-edit-input" data-speaker="'+spk.replace(/"/g,'&quot;')+'" value="'+name.replace(/"/g,'&quot;')+'" spellcheck="false">'+
            '<div class="ls-speaker-meta" style="margin-top:3px">'+d.count+' seg · '+d.words+' pal.</div>'+
          '</div>'+
        '</div>'+
      '</div>';
    }

    // View mode: clickable card
    return '<div class="ls-speaker-card" onclick="lsEditOneSpeaker(\''+spk.replace(/'/g,"\\'")+'\')">'+
      '<div style="display:flex;align-items:center;gap:8px">'+
        '<div style="width:28px;height:28px;border-radius:50%;background:'+color+';display:flex;align-items:center;justify-content:center;color:white;font-size:12px;font-weight:600">'+name.charAt(0).toUpperCase()+'</div>'+
        '<div><div class="ls-speaker-name">'+name+'</div><div class="ls-speaker-meta">'+d.count+' seg · '+d.words+' pal.</div></div>'+
      '</div>'+
    '</div>';
  }).join('');

  // If edit mode is active but the actions bar isn't visible, show it
  var actions = document.getElementById('lsSpeakerEditActions');
  var btn = document.getElementById('lsSpeakerEditBtn');
  if(lsSpeakerEditMode){
    if(actions) actions.classList.add('visible');
    if(btn) btn.classList.add('active');
  }

  // Ensure collapsible cards are initialised
  lsInitCollapsibleCards();
}

/* ── INLINE SPEAKER EDITOR ── */

window.lsEditOneSpeaker = function(spk){
  // Enter edit mode and pre-fill for this speaker
  if(!lsSpeakerEditMode){
    lsSpeakerEditMode = true;
    if(lsCurrentResponse && lsCurrentResponse.segments){
      lsRenderSpeakers(lsCurrentResponse.segments);
    }
    // Focus the input for this speaker after render
    setTimeout(function(){
      var inp = document.getElementById('lsSpeakEdit_' + spk.replace(/[^\w]/g, '_'));
      if(inp){ inp.focus(); inp.select(); }
    }, 50);
  }
};

window.lsToggleSpeakerEdit = function(){
  lsSpeakerEditMode = !lsSpeakerEditMode;
  var btn = document.getElementById('lsSpeakerEditBtn');
  var actions = document.getElementById('lsSpeakerEditActions');
  if(!lsSpeakerEditMode){
    // Exiting without saving — reset labels to their pre-edit state
    lsSpeakerEditMode = false;
    if(btn){ btn.innerHTML = '<i class="fas fa-pen"></i> Edit'; btn.classList.remove('active'); }
    if(actions) actions.classList.remove('visible');
    if(lsCurrentResponse && lsCurrentResponse.segments){
      lsRenderSpeakers(lsCurrentResponse.segments);
    }
    return;
  }
  // Entering edit mode
  if(btn){ btn.innerHTML = '<i class="fas fa-times"></i> Cancel'; btn.classList.add('active'); }
  if(actions) actions.classList.add('visible');
  if(lsCurrentResponse && lsCurrentResponse.segments){
    lsRenderSpeakers(lsCurrentResponse.segments);
  }
};

window.lsSaveSpeakerEdits = function(){
  var inputs = document.querySelectorAll('.ls-speaker-edit-input');
  var newLabels = {};
  inputs.forEach(function(inp){
    var spk = inp.dataset.speaker;
    var val = String(inp.value || '').trim();
    if(spk && val) newLabels[spk] = val;
  });
  // Apply new labels
  Object.keys(newLabels).forEach(function(spk){ lsSpeakerLabels[spk] = newLabels[spk]; });
  // Exit edit mode
  lsSpeakerEditMode = false;
  var btn = document.getElementById('lsSpeakerEditBtn');
  var actions = document.getElementById('lsSpeakerEditActions');
  if(btn){ btn.innerHTML = '<i class="fas fa-pen"></i> Edit'; btn.classList.remove('active'); }
  if(actions) actions.classList.remove('visible');
  // Re-render
  if(lsCurrentResponse && lsCurrentResponse.segments){
    lsRenderTranscript(lsCurrentResponse.segments);
    lsRenderSpeakers(lsCurrentResponse.segments);
  }
  lsToast('Speaker names updated');
};

window.lsCancelSpeakerEdit = function(){
  lsSpeakerEditMode = false;
  var btn = document.getElementById('lsSpeakerEditBtn');
  var actions = document.getElementById('lsSpeakerEditActions');
  if(btn){ btn.innerHTML = '<i class="fas fa-pen"></i> Edit'; btn.classList.remove('active'); }
  if(actions) actions.classList.remove('visible');
  if(lsCurrentResponse && lsCurrentResponse.segments){
    lsRenderSpeakers(lsCurrentResponse.segments);
  }
};

window.lsEditSpeakers = function(){
  // Legacy compatibility: toggle edit mode
  lsToggleSpeakerEdit();
};

/* ── COPY / DOWNLOAD ── */
window.lsCopyTranscript = function(){
  if(!lsCurrentResponse || !lsCurrentResponse.segments) return lsToast('Nada para copiar');
  var text = lsCurrentResponse.segments.map(function(s){
    var name = lsSpeakerLabels[s.speaker] || s.speaker || ''; 
    return '['+lsFmtTime(s.start)+'] '+name+': '+(s.text||'').trim();
  }).join('\n');
  navigator.clipboard.writeText(text).then(function(){ lsToast('Copiado!'); });
};

window.lsDownloadJson = function(){
  if(!lsCurrentResponse) return lsToast('Nada para baixar');
  var blob = new Blob([JSON.stringify(lsCurrentResponse, null, 2)], {type:'application/json'});
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = (lsCurrentResponse.filename || 'transcricao')+'_export.json'; a.click();
};

/* ── AI ANALYSIS ── */
window.lsSetAiPrompt = function(text){
  var ta = document.getElementById('lsAiPrompt'); if(ta) ta.value = text;
};

window.lsRunAiAnalysis = async function(){
  var endpoint = (document.getElementById('lsAiEndpoint')||{}).value;
  var model = (document.getElementById('lsAiModel')||{}).value || 'deepseek-flash';
  var prompt = (document.getElementById('lsAiPrompt')||{}).value;
  var output = document.getElementById('lsAiOutput');
  if(!endpoint) return lsToast('Configure o endpoint da IA');
  if(!prompt) return lsToast('Digite uma pergunta');
  if(!lsCurrentResponse) return lsToast('Execute uma transcrição primeiro');
  var transcript = (lsCurrentResponse.segments||[]).map(function(s){
    var name = lsSpeakerLabels[s.speaker] || s.speaker || '';
    return '['+lsFmtTime(s.start)+'] '+name+': '+(s.text||'').trim();
  }).join('\n').substring(0, 10000);
  var messages = [
    {role:'system', content:'Você é um assistente especializado em análise de transcrições. Responda em português.\n\nTranscrição:\n'+transcript},
    {role:'user', content:prompt}
  ];
  var payload = {model:model, messages:messages, stream:true};
  if(output){ output.style.display=''; output.textContent=''; }
  try{
    var resp = await fetch(endpoint, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)});
    if(!resp.ok) throw new Error('HTTP '+resp.status);
    var reader = resp.body.getReader(), decoder = new TextDecoder(), buf = '';
    while(true){
      var chunk = await reader.read(); if(chunk.done) break;
      buf += decoder.decode(chunk.value, {stream:true});
      var lines = buf.split('\n'); buf = lines.pop()||'';
      lines.forEach(function(line){
        if(!line.startsWith('data: ')) return;
        var d = line.slice(6).trim(); if(d==='[DONE]') return;
        try{
          var j = JSON.parse(d);
          var c = (j.choices&&j.choices[0]&&j.choices[0].delta&&j.choices[0].delta.content)||'';
          if(output) output.textContent += c;
        }catch(e){}
      });
    }
  }catch(err){
    if(output) output.textContent = 'Erro: '+err.message;
    lsToast('Erro: '+err.message);
  }
};

/* ── FILE INPUT — PREVIEW FIRST, TRANSCRIBE ON DEMAND ── */

function lsIsVideoFile(fileName){
  var ext = String(fileName || '').split('.').pop().toLowerCase();
  return LS_VIDEO_EXTS.indexOf(ext) !== -1;
}

function lsShowMediaPreview(file, url){
  var container = document.getElementById('lsMediaPreview');
  var player = document.getElementById('lsMediaPlayer');
  var clipStartInp = document.getElementById('lsClipStart');
  var clipEndInp = document.getElementById('lsClipEnd');
  var fileLabel = document.getElementById('lsPreviewFileName');
  var runBtn = document.getElementById('lsRunBtn');

  if(!container) return;

  // Store references
  lsSelectedFile = file;
  lsSelectedFileUrl = url;
  lsPreviewActive = true;
  lsClipStart = null;
  lsClipEnd = null;

  // Show container
  container.style.display = '';

  // Update file label
  if(fileLabel){
    fileLabel.textContent = file.name + ' · ' + (file.size / 1024 / 1024).toFixed(2) + ' MB';
  }

  // Create media element
  if(player){
    // Remove old media element
    var oldEl = player.querySelector('audio, video');
    if(oldEl) oldEl.remove();

    var isVideo = lsIsVideoFile(file.name);
    var mediaEl = document.createElement(isVideo ? 'video' : 'audio');
    mediaEl.src = url;
    mediaEl.controls = true;
    mediaEl.preload = 'auto';
    mediaEl.style.width = '100%';
    mediaEl.style.maxHeight = isVideo ? '280px' : '60px';
    mediaEl.style.borderRadius = '6px';
    mediaEl.style.backgroundColor = '#000';
    if(isVideo){
      mediaEl.style.maxWidth = '100%';
    }
    player.appendChild(mediaEl);

    // Enable clip tracking
    mediaEl.addEventListener('loadedmetadata', function(){
      if(clipStartInp) clipStartInp.placeholder = '0:00';
      if(clipEndInp) clipEndInp.placeholder = lsFmtTime(mediaEl.duration);
    });
  }

  // Reset clip inputs
  if(clipStartInp){ clipStartInp.value = ''; clipStartInp.placeholder = '0:00'; }
  if(clipEndInp){ clipEndInp.value = ''; clipEndInp.placeholder = '—'; }

  // Enable transcribe button
  if(runBtn){
    runBtn.disabled = false;
    runBtn.style.opacity = '1';
    runBtn.style.cursor = 'pointer';
  }
}

function lsClearMediaPreview(){
  var container = document.getElementById('lsMediaPreview');
  var player = document.getElementById('lsMediaPlayer');
  var runBtn = document.getElementById('lsRunBtn');
  var fileLabel = document.getElementById('lsPreviewFileName');
  var clipStartInp = document.getElementById('lsClipStart');
  var clipEndInp = document.getElementById('lsClipEnd');

  if(player){
    var oldEl = player.querySelector('audio, video');
    if(oldEl){
      oldEl.pause();
      oldEl.removeAttribute('src');
      oldEl.load();
      oldEl.remove();
    }
  }
  if(container) container.style.display = 'none';
  if(fileLabel) fileLabel.textContent = '';
  if(clipStartInp) clipStartInp.value = '';
  if(clipEndInp) clipEndInp.value = '';

  if(lsSelectedFileUrl){
    URL.revokeObjectURL(lsSelectedFileUrl);
  }

  lsSelectedFile = null;
  lsSelectedFileUrl = null;
  lsPreviewActive = false;
  lsClipStart = null;
  lsClipEnd = null;

  if(runBtn){
    runBtn.disabled = true;
    runBtn.style.opacity = '0.5';
    runBtn.style.cursor = 'default';
  }
}

async function lsSaveMediaToProject(file){
  var pid = (typeof getCurrentProjectId === 'function') ? getCurrentProjectId() : null;
  if(!pid){
    lsLogProcess('⚠️ Nenhum projeto ativo — mídia não foi salva em listening_files/', 'warning');
    return false;
  }

  try {
    var fd = new FormData();
    fd.append('files', file, file.name);
    var resp = await fetch(
      API_BASE + '/api/projects/' + encodeURIComponent(pid) + '/upload?section=listening_files&preserve_paths=false',
      { method: 'POST', body: fd }
    );
    if(resp.ok){
      lsLogProcess('Mídia salva em listening_files/: ' + file.name, 'success');
      if(typeof refreshProjectIndex === 'function') refreshProjectIndex(pid);
      if(typeof loadProjectFiles === 'function') loadProjectFiles();
      return true;
    } else {
      lsLogProcess('⚠️ Falha ao salvar mídia no projeto', 'warning');
      return false;
    }
  } catch(err){
    lsLogProcess('⚠️ Erro ao salvar mídia: ' + (err.message || String(err)), 'warning');
    return false;
  }
}

window.lsHandleFileSelect = function(event){
  var file = event.target && event.target.files && event.target.files[0];
  if(!file) return;
  lsLoadMediaFile(file);
};

window.lsHandleDrop = function(event){
  event.preventDefault();
  var file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
  if(!file) return;
  // Also update the file input so the label matches
  var inp = document.getElementById('lsAudioInput');
  if(inp){
    try {
      var dt = new DataTransfer();
      dt.items.add(file);
      inp.files = dt.files;
    } catch(_){}
  }
  lsLoadMediaFile(file);
};

async function lsLoadMediaFile(file){
  // Clear any previous preview
  lsClearMediaPreview();

  // Generate a unique run id for this file
  lsCurrentRunId = lsGenerateRunId();

  // Save original media to project's listening_files/
  await lsSaveMediaToProject(file);

  // Create blob URL for preview
  var url = URL.createObjectURL(file);

  // Show media preview
  lsShowMediaPreview(file, url);
  lsLogProcess('Mídia carregada: ' + file.name + ' (' + (file.size / 1024 / 1024).toFixed(2) + ' MB)', 'info');

  // Show file info
  var fi = document.getElementById('lsFileInfo');
  if(fi){
    fi.style.display = '';
    fi.textContent = file.name + ' · ' + (file.size / 1024 / 1024).toFixed(2) + ' MB';
  }

  // Reset transcript/speaker display
  var tc = document.getElementById('lsTranscriptCard');
  var sp = document.getElementById('lsSpeakerPanel');
  var aio = document.getElementById('lsAiOutput');
  if(tc) tc.style.display = 'none';
  if(sp) sp.style.display = 'none';
  if(aio) aio.style.display = 'none';

  // Reset progress
  var pc = document.getElementById('lsProgressCard');
  if(pc) pc.style.display = 'none';
  lsSetRunStatus('Pronto para transcrição');
}

/* ── TRANSCRIBE (from preview, with optional clip) ── */
window.lsRun = async function(){
  if(lsIsRunning) return;
  if(!lsSelectedFile){
    lsToast('Selecione um arquivo primeiro');
    return;
  }

  // Read clip values from inputs
  var clipStartInp = document.getElementById('lsClipStart');
  var clipEndInp = document.getElementById('lsClipEnd');
  var rawStart = clipStartInp ? String(clipStartInp.value || '').trim() : '';
  var rawEnd = clipEndInp ? String(clipEndInp.value || '').trim() : '';

  var fileToTranscribe = lsSelectedFile; // start with the full file

  if(rawStart || rawEnd){
    // Parse clip times
    var clipStartSec = rawStart ? lsParseTimeToSeconds(rawStart) : null;
    var clipEndSec = rawEnd ? lsParseTimeToSeconds(rawEnd) : null;

    if(clipStartSec !== null || clipEndSec !== null){
      try {
        lsLogProcess('✂️ Clipando áudio: ' +
          (clipStartSec !== null ? lsFmtTime(clipStartSec) : '0:00') +
          ' → ' +
          (clipEndSec !== null ? lsFmtTime(clipEndSec) : 'fim'), 'info');
        fileToTranscribe = await lsClipAudio(lsSelectedFile, clipStartSec, clipEndSec);
        lsLogProcess('Áudio clipado: ' + (fileToTranscribe.size / 1024 / 1024).toFixed(2) + ' MB', 'success');
      } catch(clipErr){
        lsLogProcess('⚠️ Falha ao clipar áudio, usando arquivo original: ' + (clipErr.message || String(clipErr)), 'warning');
        fileToTranscribe = lsSelectedFile;
      }
    }
  }

  // Run transcription
  await lsRunTranscription(fileToTranscribe);
};

function lsParseTimeToSeconds(str){
  if(!str) return null;
  str = String(str).trim().replace(',', '.');
  // Support mm:ss, hh:mm:ss, and plain seconds
  var parts = str.split(':');
  if(parts.length === 3){
    return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2]);
  } else if(parts.length === 2){
    return parseInt(parts[0]) * 60 + parseFloat(parts[1]);
  } else {
    var n = parseFloat(str);
    return Number.isFinite(n) ? n : null;
  }
}

async function lsClipAudio(file, startSec, endSec){
  // Decode the audio file, extract the desired portion, re-encode as WAV
  var arrayBuffer = await file.arrayBuffer();
  var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  var audioBuffer;

  try {
    audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  } catch(decErr){
    // If decode fails (e.g. video file), fall back to serving the full file
    throw new Error('Não foi possível decodificar o áudio: ' + decErr.message);
  }

  var sampleRate = audioBuffer.sampleRate;
  var numChannels = audioBuffer.numberOfChannels;
  var totalSamples = audioBuffer.length;
  var duration = totalSamples / sampleRate;

  // Clamp clip boundaries
  var startSample = startSec !== null ? Math.max(0, Math.round(startSec * sampleRate)) : 0;
  var endSample = endSec !== null ? Math.min(totalSamples, Math.round(endSec * sampleRate)) : totalSamples;

  if(startSample >= endSample){
    throw new Error('Clip inválido: início (' + lsFmtTime(startSample / sampleRate) + ') ≥ fim (' + lsFmtTime(endSample / sampleRate) + ')');
  }

  if(startSample === 0 && endSample === totalSamples){
    // No actual clipping, return original file
    audioCtx.close();
    return file;
  }

  var clipLength = endSample - startSample;

  // Create new buffer for the clip
  var clipBuffer = audioCtx.createBuffer(numChannels, clipLength, sampleRate);

  for(var ch = 0; ch < numChannels; ch++){
    var origData = audioBuffer.getChannelData(ch);
    var clipData = clipBuffer.getChannelData(ch);
    for(var i = 0; i < clipLength; i++){
      clipData[i] = origData[startSample + i];
    }
  }

  audioCtx.close();

  // Encode as WAV
  var wavBlob = lsEncodeWav(clipBuffer);
  var clippedFile = new File([wavBlob], file.name.replace(/\.\w+$/, '.wav'), { type: 'audio/wav' });
  return clippedFile;
}

function lsEncodeWav(audioBuffer){
  var numChannels = audioBuffer.numberOfChannels;
  var sampleRate = audioBuffer.sampleRate;
  var length = audioBuffer.length;

  // Interleave channels
  var interleaved = new Float32Array(length * numChannels);
  for(var ch = 0; ch < numChannels; ch++){
    var channelData = audioBuffer.getChannelData(ch);
    for(var i = 0; i < length; i++){
      interleaved[i * numChannels + ch] = channelData[i];
    }
  }

  // Convert to 16-bit PCM
  var numSamples = interleaved.length;
  var dataSize = numSamples * 2; // 16-bit = 2 bytes per sample
  var buffer = new ArrayBuffer(44 + dataSize);
  var view = new DataView(buffer);

  // WAV header
  function writeString(offset, str){
    for(var i = 0; i < str.length; i++){
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, 1, true);  // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true); // byte rate
  view.setUint16(32, numChannels * 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Write PCM samples
  var offset = 44;
  for(var i = 0; i < numSamples; i++){
    var s = Math.max(-1, Math.min(1, interleaved[i]));
    s = s < 0 ? s * 0x8000 : s * 0x7FFF;
    view.setInt16(offset, s, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

document.addEventListener('DOMContentLoaded', function(){
  // Wire up drag-and-drop on the upload zone
  var dropZone = document.querySelector('.ls-upload-zone');
  if(dropZone){
    dropZone.addEventListener('dragover', function(e){
      e.preventDefault();
      this.classList.add('dragover');
    });
    dropZone.addEventListener('dragleave', function(){
      this.classList.remove('dragover');
    });
    dropZone.addEventListener('drop', function(e){
      e.preventDefault();
      this.classList.remove('dragover');
      if(typeof lsHandleDrop === 'function') lsHandleDrop(e);
    });
  }
});

window.lsHandleFile = function(file){
  if(file) lsLoadMediaFile(file);
};

window.lsStop = function(){
  // Cancel running transcription if any
  lsIsRunning = false;
  lsSetRunStatus('Cancelado');
  lsSetProgress(0, 'Cancelado');
  lsLogProcess('⏹ Transcrição cancelada pelo usuário', 'error');
  lsToast('Cancelado');
};

/* ── CONTEXT (Qdrant collections + saved transcripts) ── */
function lsResolveApiBase(){
  return (typeof API_BASE === 'string' && API_BASE) ? String(API_BASE).replace(/\/$/, '') : '';
}

var lsAvailableQdrantCollections = [];

function lsNormalizeQdrantCollections(payload){
  if(!payload) return [];
  var rows = [];
  if(Array.isArray(payload)) rows = payload;
  else if(Array.isArray(payload.collections)) rows = payload.collections;
  else if(Array.isArray(payload.items)) rows = payload.items;
  return rows.map(function(it){
    if(typeof it === 'string') return { name: it, points: 0 };
    return {
      name: String((it && it.name) || ''),
      points: Number((it && (it.points || it.points_count || it.vectors_count)) || 0)
    };
  }).filter(function(it){ return !!it.name; });
}

function lsPopulateQdrantCollectionSelect(collections, preferredValue){
  var sel = document.getElementById('lsQdrantCollection');
  if(!sel) return;

  var rows = Array.isArray(collections) ? collections : [];
  rows = rows.filter(function(c){ return c && c.name; });

  var selectedValue = String(
    (preferredValue != null ? preferredValue : sel.value) ||
    ((lsGetCfg() || {}).qdrant_collection || '')
  ).trim();

  var html = '<option value="">(auto: coleção padrão do backend)</option>';
  rows.forEach(function(c){
    var name = String(c.name || '');
    var pts = Number(c.points || 0);
    var meta = pts > 0 ? (' (' + pts + ' pts)') : '';
    html += '<option value="' + escapeHtml(name).replace(/"/g, '&quot;') + '">' + escapeHtml(name + meta) + '</option>';
  });

  // Preserve config value even if collection is currently unavailable.
  if(selectedValue && !rows.some(function(c){ return c.name === selectedValue; })){
    html += '<option value="' + escapeHtml(selectedValue).replace(/"/g, '&quot;') + '">' + escapeHtml(selectedValue + ' (config)') + '</option>';
  }

  sel.innerHTML = html;
  sel.value = selectedValue;
}

async function lsFetchQdrantSampleRows(base, collectionNames){
  var names = (collectionNames || []).filter(Boolean);
  if(!names.length) return [];

  var out = [];
  var detailRequests = names.map(function(name){
    var url = base + '/api/memory/collections/' + encodeURIComponent(name);
    return fetch(url, { cache: 'no-store' })
      .then(function(r){ return r.ok ? r.json() : null; })
      .then(function(j){ return { name: name, payload: j || {} }; })
      .catch(function(){ return { name: name, payload: {} }; });
  });

  var details = await Promise.all(detailRequests);
  details.forEach(function(item){
    var name = item.name;
    var samples = item.payload && Array.isArray(item.payload.samples) ? item.payload.samples : [];
    samples.forEach(function(s){
      var sid = String((s && (s.id || s.point_id || s.uuid)) || '').trim();
      var text = String((s && (s.text || s.content || s.summary || s.title)) || '').trim();
      if(!sid && !text) return;
      out.push({
        id: 'qdrant:' + name + ':' + (sid || text.slice(0, 32)),
        source: name,
        timestamp: '',
        text: text
      });
    });
  });
  return out;
}

function lsSelectionSetFromDom(selector){
  var boxes = document.querySelectorAll(selector);
  if(!boxes || !boxes.length) return null;
  var set = {};
  Array.prototype.forEach.call(boxes, function(cb){
    if(cb && cb.checked && cb.dataset && cb.dataset.lsId) set[cb.dataset.lsId] = true;
  });
  return set;
}

var lsContextCollectionRefreshTimer = null;
function lsScheduleRefreshFromCollectionChange(){
  if(lsContextCollectionRefreshTimer) clearTimeout(lsContextCollectionRefreshTimer);
  lsContextCollectionRefreshTimer = setTimeout(function(){
    if(typeof window.lsRefreshContext === 'function') window.lsRefreshContext();
  }, 160);
}

function lsRenderCheckboxList(containerId, items, selectedSet, idKey, labelFn, metaFn){
  var box = document.getElementById(containerId);
  if(!box) return;
  if(!items || !items.length){
    box.innerHTML = '<div style="color:var(--gray);font-size:11px">— vazio —</div>';
    return;
  }
  box.innerHTML = items.map(function(it){
    var id = String(it[idKey] || '');
    var checked = selectedSet[id] ? 'checked' : '';
    var label = labelFn ? labelFn(it) : id;
    var meta = metaFn ? metaFn(it) : '';
    var safeId = id.replace(/"/g, '&quot;');
    return '<label style="display:flex;align-items:center;gap:6px;padding:3px 4px;border-radius:4px;cursor:pointer;color:var(--gray-hi)">'
      + '<input type="checkbox" data-ls-ctx="' + containerId + '" data-ls-id="' + safeId + '" ' + checked + ' style="accent-color:var(--amber)">'
      + '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escapeHtml(label) + '</span>'
      + (meta ? '<span style="color:var(--gray);font-size:10px">' + escapeHtml(meta) + '</span>' : '')
      + '</label>';
  }).join('');
  box.querySelectorAll('input[type="checkbox"]').forEach(function(cb){
    cb.addEventListener('change', function(){
      lsUpdateContextSummary();
      if(containerId === 'lsQdrantCollectionsList'){
        lsScheduleRefreshFromCollectionChange();
      }
    });
  });
}

function lsUpdateContextSummary(){
  var colCount = document.querySelectorAll('#lsQdrantCollectionsList input[type="checkbox"]:checked').length;
  var trCount = document.querySelectorAll('#lsSavedTranscriptsList input[type="checkbox"]:checked').length;
  var s = document.getElementById('lsContextSummary');
  if(!s) return;
  if(!colCount && !trCount) s.textContent = 'nenhum contexto selecionado';
  else s.textContent = colCount + ' coleção(ões) · ' + trCount + ' transcrição(ões)';
}

window.lsRefreshContext = async function(){
  var sel = lsGetContextSelection();
  var collectionsBox = document.getElementById('lsQdrantCollectionsList');
  var transcriptsBox = document.getElementById('lsSavedTranscriptsList');
  if(collectionsBox) collectionsBox.innerHTML = 'Carregando…';
  if(transcriptsBox) transcriptsBox.innerHTML = 'Carregando…';

  var base = lsResolveApiBase();
  var savedColSet = {}; (sel.qdrant_collections || []).forEach(function(n){ savedColSet[n] = true; });
  var savedTrSet = {}; (sel.transcripts || []).forEach(function(n){ savedTrSet[n] = true; });
  var domColSet = lsSelectionSetFromDom('#lsQdrantCollectionsList input[type="checkbox"]');
  var domTrSet = lsSelectionSetFromDom('#lsSavedTranscriptsList input[type="checkbox"]');
  var colSet = domColSet !== null ? domColSet : savedColSet;
  var trSet = domTrSet !== null ? domTrSet : savedTrSet;

  // Qdrant collections (existing endpoint).
  try {
    var cr = await fetch(base + '/api/memory/collections', { cache: 'no-store' });
    var cj = cr.ok ? await cr.json() : { collections: [] };
    var collections = lsNormalizeQdrantCollections(cj);
    lsAvailableQdrantCollections = collections.slice();
    lsPopulateQdrantCollectionSelect(collections);
    lsRenderCheckboxList('lsQdrantCollectionsList', collections, colSet, 'name',
      function(c){ return c.name; },
      function(c){ var p = Number(c.points || c.points_count || 0); return p ? (p + ' pts') : ''; });
  } catch(err){
    if(collectionsBox) collectionsBox.innerHTML = '<div style="color:var(--red);font-size:11px">Falha ao carregar coleções: ' + escapeHtml(err.message || String(err)) + '</div>';
  }

  // Saved transcripts list (gateway proxy → backend 8039).
  try {
    var tr = await fetch(base + '/api/transcripts', { cache: 'no-store' });
    var tj = tr.ok ? await tr.json() : { transcripts: [] };

    function lsNormalizeTranscriptRows(payload){
      if(Array.isArray(payload)) return payload;
      if(!payload || typeof payload !== 'object') return [];
      if(Array.isArray(payload.transcripts)) return payload.transcripts;
      if(Array.isArray(payload.items)) return payload.items;
      if(Array.isArray(payload.data)) return payload.data;
      if(Array.isArray(payload.result)) return payload.result;
      if(payload.transcripts && typeof payload.transcripts === 'object'){
        if(Array.isArray(payload.transcripts.items)) return payload.transcripts.items;
        if(Array.isArray(payload.transcripts.transcripts)) return payload.transcripts.transcripts;
        if(Array.isArray(payload.transcripts.data)) return payload.transcripts.data;
      }
      return [];
    }

    var raw = lsNormalizeTranscriptRows(tj);
    if(!raw.length){
      try {
        var trLegacy = await fetch(base + '/api/transcripts/list', { cache: 'no-store' });
        var tjLegacy = trLegacy.ok ? await trLegacy.json() : [];
        raw = lsNormalizeTranscriptRows(tjLegacy);
      } catch(_legacyErr){}
    }

    var rows = Array.isArray(raw) ? raw : [];
    var transcripts = rows.map(function(it){
      if(typeof it === 'string') return { id: it };
      return {
        id: String(it.id || it.transcript_id || it.filename || it.name || ''),
        source: it.source_file || it.filename || '',
        timestamp: it.timestamp || it.created_at || '',
        text: it.text || it.content || it.summary || ''
      };
    }).filter(function(it){ return !!it.id; });
    if(!transcripts.length){
      // If local transcript list is empty, show Qdrant samples from selected
      // collections (or top collections by points) so the UI is not blank.
      var chosenCollections = Object.keys(colSet).filter(function(n){ return !!colSet[n]; });
      if(!chosenCollections.length){
        chosenCollections = (lsAvailableQdrantCollections || [])
          .slice()
          .sort(function(a,b){ return Number(b.points || 0) - Number(a.points || 0); })
          .slice(0, 3)
          .map(function(c){ return c.name; });
      }
      var qdrantRows = await lsFetchQdrantSampleRows(base, chosenCollections);
      transcripts = qdrantRows;
    }

    lsRenderCheckboxList('lsSavedTranscriptsList', transcripts, trSet, 'id',
      function(t){
        var text = String(t.text || '').trim();
        if(text) return text.length > 96 ? (text.slice(0, 96) + '…') : text;
        return t.id;
      },
      function(t){
        var source = String(t.source || '');
        var stamp = t.timestamp ? String(t.timestamp).slice(0, 19).replace('T', ' ') : '';
        return [source, stamp].filter(Boolean).join(' · ');
      });
  } catch(err){
    if(transcriptsBox) transcriptsBox.innerHTML = '<div style="color:var(--red);font-size:11px">Falha ao carregar transcrições: ' + escapeHtml(err.message || String(err)) + '</div>';
  }

  lsUpdateContextSummary();
};

window.lsSaveContext = function(){
  var collections = Array.prototype.slice.call(document.querySelectorAll('#lsQdrantCollectionsList input[type="checkbox"]:checked')).map(function(cb){ return cb.dataset.lsId; });
  var transcripts = Array.prototype.slice.call(document.querySelectorAll('#lsSavedTranscriptsList input[type="checkbox"]:checked')).map(function(cb){ return cb.dataset.lsId; });
  lsSetContextSelection({ qdrant_collections: collections, transcripts: transcripts, updated_at: new Date().toISOString() });
  lsToast('Contexto salvo (' + collections.length + ' coleções, ' + transcripts.length + ' transcrições)');
};

window.lsClearContext = function(){
  lsSetContextSelection({ qdrant_collections: [], transcripts: [], updated_at: new Date().toISOString() });
  document.querySelectorAll('#lsQdrantCollectionsList input[type="checkbox"], #lsSavedTranscriptsList input[type="checkbox"]').forEach(function(cb){ cb.checked = false; });
  lsUpdateContextSummary();
  lsToast('Seleção de contexto limpa');
};

// Public accessor so chat / agent modules can read the active context.
window.lsGetContext = function(){
  var sel = lsGetContextSelection();
  return {
    qdrant_collections: Array.isArray(sel.qdrant_collections) ? sel.qdrant_collections : [],
    transcripts: Array.isArray(sel.transcripts) ? sel.transcripts : [],
    updated_at: sel.updated_at || null
  };
};

})();