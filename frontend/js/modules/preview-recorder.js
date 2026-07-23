/* ═══════════════════════════════════════════════════════════════════
   PREVIEW RECORDER — Records the visible preview canvas while the
   .sh-preview-area is in fullscreen mode.
   - Targets: 3D canvas (#sh3dCanvas) when 3D mode is active, else the
     2D shader canvas inside .sh-preview-stage.
   - Uses canvas.captureStream + MediaRecorder (webm/vp9 fallback vp8).
   - Adds a floating record toggle on top-right of .sh-preview-area.
   - Download starts automatically when recording stops.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  let mediaRecorder = null;
  let chunks = [];
  let startedAt = 0;
  let timerId = null;
  let btn = null;
  let timerEl = null;
  let recCanvas = null;
  let recCtx = null;
  let recRaf = null;
  let recStream = null;
  let svgSnapshotImg = null;
  let svgSnapshotSig = '';
  let svgSnapshotPending = false;
  let svgSnapshotAt = 0;

  function injectStyles() {
    if (document.getElementById('shRecStyles')) return;
    const s = document.createElement('style');
    s.id = 'shRecStyles';
    s.textContent = `
      .sh-rec-btn{position:absolute;top:12px;right:12px;z-index:50;
        background:rgba(0,0,0,.6);color:#fff;border:1px solid rgba(255,255,255,.2);
        border-radius:20px;padding:6px 12px;font-size:11px;cursor:pointer;display:none;
        align-items:center;gap:6px;font-family:var(--sans,system-ui,sans-serif);backdrop-filter:blur(4px)}
      .sh-preview-area.fullscreen .sh-rec-btn{display:inline-flex}
      .sh-rec-btn:hover{background:rgba(0,0,0,.8)}
      .sh-rec-btn.recording{background:rgba(220,38,38,.9);border-color:#dc2626}
      .sh-rec-btn .dot{width:8px;height:8px;border-radius:50%;background:#dc2626}
      .sh-rec-btn.recording .dot{animation:shRecBlink 1s infinite}
      @keyframes shRecBlink{0%,100%{opacity:1}50%{opacity:.3}}
      .sh-rec-timer{font-variant-numeric:tabular-nums;font-size:10px;color:#ddd;margin-left:2px}
    `;
    document.head.appendChild(s);
  }

  function getPreviewArea() {
    const area = document.querySelector('.sh-preview-area');
    return area || null;
  }

  function isVisible(el) {
    if (!el) return false;
    if (el.offsetParent === null) return false;
    const cs = window.getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity || 1) > 0;
  }

  function ensureRecorderCanvas(area) {
    const w = Math.max(2, Math.floor(area.clientWidth || 0));
    const h = Math.max(2, Math.floor(area.clientHeight || 0));
    if (!recCanvas) {
      recCanvas = document.createElement('canvas');
      recCanvas.width = w;
      recCanvas.height = h;
      recCtx = recCanvas.getContext('2d', { alpha: false, desynchronized: true });
      return recCanvas;
    }
    if (recCanvas.width !== w || recCanvas.height !== h) {
      recCanvas.width = w;
      recCanvas.height = h;
    }
    return recCanvas;
  }

  function refreshSvgSnapshot(force) {
    const now = performance.now();
    if (!force && now - svgSnapshotAt < 120) return;
    if (svgSnapshotPending) return;

    const host = document.getElementById('shPreviewSVG');
    const svgNode = host ? host.querySelector('svg') : null;
    if (!svgNode || !isVisible(host)) {
      svgSnapshotImg = null;
      svgSnapshotSig = '';
      svgSnapshotAt = now;
      return;
    }

    let markup = '';
    try {
      markup = new XMLSerializer().serializeToString(svgNode);
    } catch (_e) {
      svgSnapshotAt = now;
      return;
    }
    if (!markup) {
      svgSnapshotAt = now;
      return;
    }
    if (!force && markup === svgSnapshotSig) {
      svgSnapshotAt = now;
      return;
    }

    svgSnapshotPending = true;
    svgSnapshotAt = now;
    const blob = new Blob([markup], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = function () {
      svgSnapshotImg = img;
      svgSnapshotSig = markup;
      svgSnapshotPending = false;
      URL.revokeObjectURL(url);
    };
    img.onerror = function () {
      svgSnapshotPending = false;
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  function drawCompositeFrame() {
    const area = getPreviewArea();
    if (!area || !recCtx || !recCanvas) return;
    ensureRecorderCanvas(area);
    const w = recCanvas.width;
    const h = recCanvas.height;

    recCtx.clearRect(0, 0, w, h);
    recCtx.fillStyle = '#000';
    recCtx.fillRect(0, 0, w, h);

    refreshSvgSnapshot(false);
    if (svgSnapshotImg) {
      try {
        recCtx.drawImage(svgSnapshotImg, 0, 0, w, h);
      } catch (_e) {
        // Ignore intermittent decode/draw races.
      }
    }

    const c3d = document.getElementById('sh3dCanvas');
    if (c3d && isVisible(c3d)) {
      try {
        recCtx.drawImage(c3d, 0, 0, w, h);
      } catch (_e) {
        // Ignore tainted or transient canvas draws.
      }
    }

    recRaf = requestAnimationFrame(drawCompositeFrame);
  }

  function startCompositeLoop() {
    const area = getPreviewArea();
    if (!area) return null;
    ensureRecorderCanvas(area);
    refreshSvgSnapshot(true);
    if (recRaf) cancelAnimationFrame(recRaf);
    recRaf = requestAnimationFrame(drawCompositeFrame);
    return recCanvas;
  }

  function stopCompositeLoop() {
    if (recRaf) {
      cancelAnimationFrame(recRaf);
      recRaf = null;
    }
    svgSnapshotPending = false;
    svgSnapshotImg = null;
    svgSnapshotSig = '';
  }

  function fmt(ms) {
    const s = Math.floor(ms / 1000);
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  }

  function start() {
    const area = getPreviewArea();
    if (!area) { toast('Preview indisponível para gravação.'); return; }

    const canvas = startCompositeLoop();
    if (!canvas) { toast('Nenhuma camada visível para gravar.'); return; }
    if (!canvas.captureStream) {
      stopCompositeLoop();
      toast('Navegador sem captureStream — use Chrome/Firefox.');
      return;
    }

    try { recStream = canvas.captureStream(30); }
    catch (e) {
      stopCompositeLoop();
      toast('Falha ao capturar preview: ' + e.message);
      return;
    }

    const mime = pickMime();
    if (!mime) {
      if (recStream) {
        recStream.getTracks().forEach(function (t) { try { t.stop(); } catch (_e) {} });
        recStream = null;
      }
      stopCompositeLoop();
      toast('MediaRecorder indisponível neste navegador.');
      return;
    }

    try { mediaRecorder = new MediaRecorder(recStream, { mimeType: mime, videoBitsPerSecond: 8_000_000 }); }
    catch (e) {
      if (recStream) {
        recStream.getTracks().forEach(function (t) { try { t.stop(); } catch (_e) {} });
        recStream = null;
      }
      stopCompositeLoop();
      toast('MediaRecorder erro: ' + e.message);
      return;
    }

    chunks = [];
    mediaRecorder.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
    mediaRecorder.onstop = function () {
      const blob = new Blob(chunks, { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const ext = mime.includes('webm') ? 'webm' : 'mp4';
      a.href = url;
      a.download = 'LA8159-preview-' + new Date().toISOString().replace(/[:.]/g, '-') + '.' + ext;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
      if (recStream) {
        recStream.getTracks().forEach(function (t) { try { t.stop(); } catch (_e) {} });
        recStream = null;
      }
      stopCompositeLoop();
      toast('Gravação salva: ' + a.download);
    };
    mediaRecorder.start(1000);
    startedAt = Date.now();
    btn.classList.add('recording');
    btn.querySelector('.sh-rec-label').textContent = 'Parar';
    timerId = setInterval(function () { timerEl.textContent = fmt(Date.now() - startedAt); }, 250);
  }

  function stop() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
    else {
      if (recStream) {
        recStream.getTracks().forEach(function (t) { try { t.stop(); } catch (_e) {} });
        recStream = null;
      }
      stopCompositeLoop();
    }
    if (timerId) { clearInterval(timerId); timerId = null; }
    if (btn) {
      btn.classList.remove('recording');
      btn.querySelector('.sh-rec-label').textContent = 'REC';
      timerEl.textContent = '';
    }
  }

  function toggle() {
    if (mediaRecorder && mediaRecorder.state === 'recording') stop();
    else start();
  }

  function pickMime() {
    const candidates = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
      'video/mp4'
    ];
    return candidates.find(function (m) { return window.MediaRecorder && MediaRecorder.isTypeSupported(m); }) || '';
  }

  function toast(msg) {
    if (typeof window.shToast === 'function') window.shToast(msg);
    else console.log('[rec]', msg);
  }

  function mount() {
    const area = document.querySelector('.sh-preview-area');
    if (!area) { setTimeout(mount, 500); return; }
    injectStyles();
    btn = document.createElement('button');
    btn.className = 'sh-rec-btn';
    btn.title = 'Gravar preview (somente em fullscreen)';
    btn.innerHTML = '<span class="dot"></span><span class="sh-rec-label">REC</span><span class="sh-rec-timer" id="shRecTimer"></span>';
    btn.onclick = toggle;
    area.appendChild(btn);
    timerEl = btn.querySelector('#shRecTimer');

    // Stop automatically when leaving fullscreen
    const obs = new MutationObserver(function () {
      if (!area.classList.contains('fullscreen') && mediaRecorder && mediaRecorder.state === 'recording') stop();
    });
    obs.observe(area, { attributes: true, attributeFilter: ['class'] });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }

  window.shPreviewRecorderToggle = toggle;
})();
