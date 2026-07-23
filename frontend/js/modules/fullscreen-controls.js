/* ═══════════════════════════════════════════════════════════════════
   FULLSCREEN CONTROLS — Auto-hiding overlay for essential actions while
   .sh-preview-area is in fullscreen. The existing shaders CSS hides the
   inline control bars in fullscreen, so without this overlay the user
   has no way to pause/record/change environment without the phone.
   - Appears as a floating toolbar pinned to the bottom-center.
   - Auto-hides after 3s of mouse/touch inactivity; re-appears on any
     mousemove/touchstart inside the fullscreen area.
   - Also exposes a button to open the floating chat overlay.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  let toolbar = null, hideTimer = null, area = null, visible = true;

  function injectStyles() {
    if (document.getElementById('shFsCtrlStyles')) return;
    const s = document.createElement('style');
    s.id = 'shFsCtrlStyles';
    s.textContent = `
      .sh-fs-overlay{position:absolute;left:50%;bottom:24px;transform:translateX(-50%);z-index:60;
        display:none;gap:6px;align-items:center;padding:8px 10px;border-radius:999px;
        background:rgba(14,14,16,.82);border:1px solid rgba(255,255,255,.12);backdrop-filter:blur(10px);
        box-shadow:0 8px 28px rgba(0,0,0,.45);transition:opacity .25s ease,transform .25s ease;
        font-family:var(--sans,system-ui,sans-serif);max-width:calc(100vw - 32px);flex-wrap:wrap;justify-content:center}
      .sh-preview-area.fullscreen .sh-fs-overlay{display:inline-flex}
      .sh-fs-overlay.hidden{opacity:0;pointer-events:none;transform:translateX(-50%) translateY(12px)}
      .sh-fs-overlay button{background:transparent;color:#fff;border:1px solid rgba(255,255,255,.15);
        border-radius:999px;min-width:34px;height:34px;padding:0 10px;font-size:12px;cursor:pointer;
        display:inline-flex;align-items:center;gap:6px;line-height:1}
      .sh-fs-overlay button:hover{background:rgba(255,255,255,.08)}
      .sh-fs-overlay button.primary{background:#E879F9;color:#111;border-color:#E879F9}
      .sh-fs-overlay button.danger{background:rgba(220,38,38,.18);border-color:rgba(220,38,38,.4);color:#fca5a5}
      .sh-fs-overlay button.danger.active{background:#dc2626;color:#fff;border-color:#dc2626}
      .sh-fs-overlay .sep{width:1px;height:20px;background:rgba(255,255,255,.15);margin:0 2px}
      .sh-fs-overlay select{background:rgba(0,0,0,.4);color:#fff;border:1px solid rgba(255,255,255,.15);
        border-radius:999px;height:34px;padding:0 10px;font-size:11px;outline:none;cursor:pointer}
      .sh-fs-overlay .slider-wrap{display:inline-flex;align-items:center;gap:4px;padding:0 8px;height:34px;
        border:1px solid rgba(255,255,255,.15);border-radius:999px;background:rgba(0,0,0,.25)}
      .sh-fs-overlay .slider-wrap label{font-size:10px;color:#aaa}
      .sh-fs-overlay .slider-wrap input[type=range]{width:90px;accent-color:#E879F9}
      .sh-fs-overlay .slider-wrap span{font-size:10px;color:#ddd;font-variant-numeric:tabular-nums;min-width:28px;text-align:right}
      /* Raise floating chat toggle above fullscreen stacking context */
      .sh-preview-area.fullscreen ~ #fchatToggle,
      #fchatToggle{z-index:10001!important}
      #fchatPanel{z-index:10001!important}
    `;
    document.head.appendChild(s);
  }

  function build() {
    area = document.querySelector('.sh-preview-area');
    if (!area) { setTimeout(build, 500); return; }
    injectStyles();

    toolbar = document.createElement('div');
    toolbar.className = 'sh-fs-overlay';
    toolbar.innerHTML = `
      <button id="shFsPlay" title="Play/Pause (3D)"><i class="fas fa-pause"></i></button>
      <button id="shFsWire" title="Wireframe"><i class="fas fa-bezier-curve"></i></button>
      <button id="shFsReset" title="Reset camera"><i class="fas fa-crosshairs"></i></button>
      <span class="sep"></span>
      <select id="shFsEnv" title="Environment">
        <option value="studio">Studio</option>
        <option value="outdoor">Outdoor</option>
        <option value="night">Night</option>
        <option value="cyberpunk">Cyberpunk</option>
        <option value="warm">Warm</option>
        <option value="product">Product</option>
      </select>
      <span class="slider-wrap"><label for="shFsExp">Exp</label><input type="range" id="shFsExp" min="0.1" max="4" step="0.05" value="1"><span id="shFsExpVal">1.00</span></span>
      <span class="sep"></span>
      <button id="shFsRec" class="danger" title="Gravar preview (webm)"><i class="fas fa-record-vinyl"></i> REC</button>
      <button id="shFsChat" title="Abrir chat flutuante"><i class="fas fa-comment-dots"></i></button>
      <button id="shFsRemote" title="Abrir página mobile remota"><i class="fas fa-mobile-screen"></i></button>
      <span class="sep"></span>
      <button id="shFsExit" title="Sair do fullscreen (Esc)"><i class="fas fa-compress"></i></button>
    `;
    area.appendChild(toolbar);

    bindHandlers();
    bindActivityHide();
    bindRecMirror();
  }

  function call(name, args) {
    const fn = window[name];
    if (typeof fn === 'function') try { fn.apply(window, args || []); } catch (_) {}
  }

  function bindHandlers() {
    toolbar.querySelector('#shFsPlay').onclick  = function () { call('sh3dToggleAnimation'); syncPlayIcon(); };
    toolbar.querySelector('#shFsWire').onclick  = function () { call('sh3dToggleWireframe'); };
    toolbar.querySelector('#shFsReset').onclick = function () { call('sh3dResetCamera'); };
    toolbar.querySelector('#shFsEnv').onchange  = function (e) { call('sh3dSetEnvironment', [e.target.value]); };
    const exp = toolbar.querySelector('#shFsExp');
    const expVal = toolbar.querySelector('#shFsExpVal');
    exp.oninput = function () { expVal.textContent = parseFloat(exp.value).toFixed(2); call('sh3dSetExposure', [exp.value]); };
    toolbar.querySelector('#shFsRec').onclick  = function () { call('shPreviewRecorderToggle'); };
    toolbar.querySelector('#shFsChat').onclick = function () { call('fchatToggle'); };
    toolbar.querySelector('#shFsRemote').onclick = function () { window.open('mobile.html', '_blank', 'noopener'); };
    toolbar.querySelector('#shFsExit').onclick = function () { call('shToggleFullscreen'); };
    // Prevent clicks inside the bar from triggering the hide-on-activity reset
    toolbar.addEventListener('click', function (e) { e.stopPropagation(); showBar(); scheduleHide(); });
  }

  function syncPlayIcon() {
    const src = document.querySelector('#sh3dBtnPlayPause i');
    const dst = toolbar.querySelector('#shFsPlay i');
    if (src && dst) dst.className = src.className;
  }

  function bindActivityHide() {
    const reset = function () { showBar(); scheduleHide(); };
    ['mousemove', 'touchstart', 'keydown'].forEach(function (ev) {
      area.addEventListener(ev, reset, { passive: true });
    });
    // observe fullscreen toggle
    new MutationObserver(function () {
      if (area.classList.contains('fullscreen')) { showBar(); scheduleHide(); }
      else { clearTimeout(hideTimer); toolbar.classList.remove('hidden'); }
    }).observe(area, { attributes: true, attributeFilter: ['class'] });
  }

  function showBar() { toolbar.classList.remove('hidden'); visible = true; }
  function hideBar() { toolbar.classList.add('hidden'); visible = false; }
  function scheduleHide() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hideBar, 3200);
  }

  /* Mirror the REC button active state from preview-recorder's .sh-rec-btn */
  function bindRecMirror() {
    const recBtn = toolbar.querySelector('#shFsRec');
    setInterval(function () {
      const src = document.querySelector('.sh-rec-btn');
      if (!src || !recBtn) return;
      recBtn.classList.toggle('active', src.classList.contains('recording'));
    }, 500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();
