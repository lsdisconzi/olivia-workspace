/* ═══════════════════════════════════════════════════════════════════
   REMOTE BUS CONSUMER (desktop)
   Long-polls /api/OliviaLegal/remote-bus for commands sent by mobile.html
   and applies them to the shaders view. Supported payload "kind" values:
     - "sh3d-call"  : invoke a whitelisted window.sh3d* function with args
     - "sh-call"    : invoke a whitelisted window.sh* function
     - "meshy-open" : open the Meshy modal
     - "send-chat"  : forward text to window.sendMessage
     - "fullscreen" : toggle fullscreen on/off (action: "on"/"off"/"toggle")
     - "rec"        : toggle preview recorder (action: "toggle"/"start"/"stop")
   Mobile acks are posted back with role="desktop" so the phone UI can
   confirm execution. A status snapshot of the preview is published
   periodically so the mobile agent has context.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const ROLE = 'desktop';
  let since = 0;
  let stopped = false;

  // Whitelist: ONLY these globals can be invoked from the bus. This is the
  // security boundary — anything else is rejected.
  const WHITELIST_SH3D = [
    // animation + camera
    'sh3dToggleAnimation', 'sh3dSelectClip', 'sh3dSetAnimSpeed',
    'sh3dToggleWireframe', 'sh3dResetCamera',
    // environment / background
    'sh3dSetEnvironment', 'sh3dSetExposure', 'sh3dSetBgColor',
    'sh3dToggleGrid', 'sh3dToggleGround',
    // hybrid 2D+3D overlay
    'sh3dSetHybrid2D',
    // objects / primitives
    'sh3dAddPrimitive', 'sh3dClearExtras', 'sh3dLoadGLB',
    // selection (for targeted actions on specific models)
    'sh3dSelect', 'sh3dSetTransformMode'
  ];
  const WHITELIST_SH = [
    // view / scene switching
    'shToggleFullscreen', 'shSwitchTab', 'shLoadScene', 'shRunEditorCode',
    'shSetSceneMode', 'shSetViewMode',
    // post-fx
    'shSetPostFxSlider', 'shResetPostFx',
    // world / weather / era
    'shToggleNight', 'shSetDayNightCycle', 'shSetWorldTimeSpeed',
    'shSetWorldWeather', 'shSetWorldRotation', 'shSetEra', 'shSetWeatherType',
    // environment fx
    'shSetEnvFx', 'shToggleEnvFlag',
    // presets + capture + export
    'shApplyPreset', 'shCapturePNG', 'shExportScene', 'shExportFxPreset'
  ];

  function invokeWhitelisted(name, args, whitelist) {
    if (!whitelist.includes(name)) return { ok: false, error: 'not-whitelisted:' + name };
    const fn = window[name];
    if (typeof fn !== 'function') return { ok: false, error: 'not-a-function:' + name };
    try {
      const ret = fn.apply(window, Array.isArray(args) ? args : []);
      return { ok: true, ret: (ret === undefined ? null : String(ret).slice(0, 500)) };
    } catch (e) {
      return { ok: false, error: String(e && e.message || e) };
    }
  }

  function guardRemoteCall(name, args) {
    if (name !== 'sh3dLoadGLB') return null;
    const url = Array.isArray(args) ? String(args[0] || '').trim() : '';
    if (!url) return null;
    if (/^(blob:|file:|data:)/i.test(url)) {
      return {
        ok: false,
        error: 'unsupported-remote-url:' + url.split(':')[0] + ' (use http/https endpoint for remote sh3dLoadGLB)'
      };
    }
    return null;
  }

  async function postAck(msgId, result) {
    try {
      await fetch('/api/olivialegal/remote-bus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: ROLE, payload: { kind: 'ack', for: msgId, result: result } })
      });
    } catch (_) {}
  }

  function apply(msg) {
    const p = msg.payload || {};
    switch (p.kind) {
      case 'sh3d-call': {
        const blocked = guardRemoteCall(p.name, p.args);
        if (blocked) return blocked;
        return invokeWhitelisted(p.name, p.args, WHITELIST_SH3D);
      }
      case 'sh-call':   return invokeWhitelisted(p.name, p.args, WHITELIST_SH);
      case 'meshy-open':
        if (typeof window.meshyOpenModal === 'function') { window.meshyOpenModal(); return { ok: true }; }
        return { ok: false, error: 'meshy-ui-not-loaded' };
      case 'send-chat':
        if (typeof window.sendMessage === 'function' && p.text) { window.sendMessage(String(p.text)); return { ok: true }; }
        return { ok: false, error: 'sendMessage-missing-or-empty' };
      case 'fullscreen': {
        const area = document.querySelector('.sh-preview-area');
        if (!area) return { ok: false, error: 'no-preview-area' };
        const on = area.classList.contains('fullscreen');
        const act = p.action || 'toggle';
        if ((act === 'on' && !on) || (act === 'off' && on) || act === 'toggle') {
          if (typeof window.shToggleFullscreen === 'function') window.shToggleFullscreen();
        }
        return { ok: true };
      }
      case 'rec':
        if (typeof window.shPreviewRecorderToggle === 'function') { window.shPreviewRecorderToggle(); return { ok: true }; }
        return { ok: false, error: 'recorder-missing' };
      case 'request-snapshot':
        publishSnapshot();
        return { ok: true };
      default:
        return { ok: false, error: 'unknown-kind:' + String(p.kind) };
    }
  }

  async function loop() {
    while (!stopped) {
      try {
        const r = await fetch('/api/olivialegal/remote-bus?role=' + ROLE + '&since=' + since + '&wait=25');
        if (!r.ok) { await sleep(2000); continue; }
        const data = await r.json();
        const prevSince = since;
        const nextSince = Number(data && data.next);
        const messages = Array.isArray(data && data.messages) ? data.messages : [];
        since = Number.isFinite(nextSince) ? nextSince : since;
        for (const msg of messages) {
          if (!msg || msg.role === ROLE) continue;
          const result = apply(msg);
          if (result) postAck(msg.id, result);
        }
        if (!messages.length) {
          const staleCursor = Number.isFinite(nextSince) ? (nextSince <= prevSince) : true;
          await sleep(staleCursor ? 500 : 250);
        }
      } catch (_) {
        await sleep(2000);
      }
    }
  }

  function sleep(ms) { return new Promise(function (res) { setTimeout(res, ms); }); }

  /* Periodic preview snapshot (helps the mobile agent reason about state) */
  async function publishSnapshot() {
    try {
      const area = document.querySelector('.sh-preview-area');
      const fullscreen = !!(area && area.classList.contains('fullscreen'));
      const is3d = document.body.classList.contains('sh-mode-3d') ||
                   (document.getElementById('sh3dCanvas') && document.getElementById('sh3dCanvas').offsetParent !== null);
      const hybridBtn = document.getElementById('sh3dBtnHybrid');
      const hybrid = !!(hybridBtn && hybridBtn.classList.contains('active'));
      const sceneMode = is3d ? (hybrid ? 'hybrid' : '3d') : '2d';
      const modelName = (document.getElementById('sh3dHudModel') || {}).textContent || '';
      const fps = (document.getElementById('sh3dHudFPS') || {}).textContent || '';
      const tri = (document.getElementById('sh3dHudTri') || {}).textContent || '';
      const activeScene = (document.querySelector('.sh-scene-card.active .sh-scene-name') || {}).textContent || '';
      const activeTab = (document.querySelector('.sh-content-tab.active') || {}).dataset ? (document.querySelector('.sh-content-tab.active').dataset.tab || '') : '';
      let objects = [];
      let selected = null;
      try {
        if (typeof window.sh3dListObjects === 'function') objects = window.sh3dListObjects() || [];
        if (typeof window.sh3dGetSelected === 'function') {
          const s = window.sh3dGetSelected();
          selected = (s === null || s === undefined) ? (objects.length ? 'main' : null) : s;
        }
      } catch (_) {}
      const snapshot = {
        kind: 'snapshot',
        fullscreen, is3d, hybrid, sceneMode,
        modelName, fps, tri, activeScene, activeTab,
        objects, selected,
        href: location.href,
        ts: Date.now()
      };
      await fetch('/api/olivialegal/remote-bus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: ROLE, payload: snapshot })
      });
    } catch (_) {}
  }
  setInterval(publishSnapshot, 5000);

  // Push a snapshot immediately on selection / extras changes so mobile
  // model lists stay in sync without waiting for the 5s poll.
  try {
    window.addEventListener('sh3d:selection-changed', publishSnapshot);
    window.addEventListener('sh3d:extras-changed', publishSnapshot);
  } catch (_) {}

  window.addEventListener('beforeunload', function () { stopped = true; });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loop);
  } else {
    loop();
  }
})();
