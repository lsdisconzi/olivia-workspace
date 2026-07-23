/* ═══════════════════════════════════════════════════════════════════
   FLOATING CHAT — Shaders-agent companion, draggable, resizable.
   - Only appears while the shaders preview is in fullscreen mode.
   - Mirrors the shaders brainstorm chat (`_sh.brainMessages` / #shBrainLog),
     NOT the main workspace chat. Input is routed through
     `window.shBrainSend()` so replies use the same shaders section agent,
     system prompt, scene context and persistence.
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const STATE_KEY = 'OliviaLegal.fchat.state.v1';
  let mirrorBox, panel, toggleBtn, headerEl, brainLog, observer;
  let isOpen = false;

  function loadState() {
    try { return JSON.parse(localStorage.getItem(STATE_KEY) || '{}'); } catch (_) { return {}; }
  }
  function saveState(patch) {
    const cur = loadState();
    localStorage.setItem(STATE_KEY, JSON.stringify(Object.assign(cur, patch)));
  }

  function injectStyles() {
    if (document.getElementById('floatingChatStyles')) return;
    const css = document.createElement('style');
    css.id = 'floatingChatStyles';
    css.textContent = `
      /* Toggle is hidden by default; only visible while the shaders preview
         is in fullscreen mode (desktop controls are occluded there). */
      #fchatToggle{position:fixed;right:12px;bottom:12px;z-index:10002;width:24px;height:24px;border-radius:50%;
        background:linear-gradient(135deg,#ff8c00,#f59e0b);color:#fff;border:none;cursor:pointer;
        box-shadow:0 2px 8px rgba(0,0,0,.35);font-size:11px;transition:transform .15s ease,opacity .15s ease;
        display:none;align-items:center;justify-content:center;padding:0}
      body:has(.sh-preview-area.fullscreen) #fchatToggle{display:inline-flex}
      #fchatToggle:hover{transform:scale(1.12)}
      #fchatToggle.hide{opacity:0;pointer-events:none;transform:scale(.8)}
      #fchatPanel{position:fixed;right:16px;bottom:72px;z-index:9998;width:340px;height:440px;min-width:260px;min-height:260px;
        background:rgba(14,14,16,.97);color:#eee;border:1px solid #333;border-radius:10px;
        box-shadow:0 10px 40px rgba(0,0,0,.55);display:flex;flex-direction:column;overflow:hidden;
        backdrop-filter:blur(8px);font-family:var(--sans,system-ui,sans-serif);resize:both}
      #fchatPanel.collapsed{height:42px!important;min-height:42px!important;resize:none}
      #fchatPanel.collapsed .fchat-body,#fchatPanel.collapsed .fchat-compose{display:none}
      .fchat-header{display:flex;align-items:center;gap:8px;padding:8px 10px;background:rgba(255,140,0,.12);
        border-bottom:1px solid #2a2a2a;cursor:grab;user-select:none;flex:0 0 auto}
      .fchat-header.dragging{cursor:grabbing}
      .fchat-header .fchat-title{flex:1;font-size:12px;font-weight:600;color:#ff8c00}
      .fchat-header button{background:transparent;border:none;color:#aaa;cursor:pointer;font-size:12px;padding:2px 6px;border-radius:3px}
      .fchat-header button:hover{background:rgba(255,255,255,.08);color:#fff}
      .fchat-body{flex:1;overflow-y:auto;padding:10px;font-size:12px;line-height:1.4}
      .fchat-body .chat-message{margin-bottom:10px}
      .fchat-body .chat-message .bubble{background:rgba(255,255,255,.04);padding:8px 10px;border-radius:8px;word-break:break-word}
      .fchat-body .chat-message.user .bubble{background:rgba(255,140,0,.12);border:1px solid rgba(255,140,0,.3)}
      .fchat-body .chat-message.assistant .bubble{background:rgba(78,205,196,.08);border:1px solid rgba(78,205,196,.2)}
      .fchat-body .chat-message.system .bubble{background:rgba(255,255,255,.03);color:#999;font-size:11px;font-style:italic}
      .fchat-body pre,.fchat-body code{font-size:11px;max-width:100%;overflow-x:auto;white-space:pre-wrap}
      .fchat-compose{display:flex;gap:6px;padding:8px;border-top:1px solid #2a2a2a;background:rgba(0,0,0,.3);flex:0 0 auto}
      .fchat-compose textarea{flex:1;background:#111;color:#eee;border:1px solid #333;border-radius:6px;
        padding:6px 8px;font-family:inherit;font-size:12px;resize:none;min-height:28px;max-height:90px;outline:none}
      .fchat-compose textarea:focus{border-color:#ff8c00}
      .fchat-compose button{background:#ff8c00;color:#111;border:none;border-radius:6px;padding:6px 10px;
        cursor:pointer;font-size:12px;font-weight:600}
      .fchat-compose button:hover{background:#f59e0b}
      @media(max-width:600px){#fchatPanel{left:8px;right:8px;bottom:64px;width:auto!important;height:60vh!important}}
    `;
    document.head.appendChild(css);
  }

  function buildUI() {
    injectStyles();

    toggleBtn = document.createElement('button');
    toggleBtn.id = 'fchatToggle';
    toggleBtn.innerHTML = '<i class="fas fa-comment-dots"></i>';
    toggleBtn.title = 'Chat flutuante (disponível no preview em fullview)';
    toggleBtn.onclick = togglePanel;
    document.body.appendChild(toggleBtn);

    /* Auto-close the panel if the user exits fullscreen — the toggle is
       hidden by CSS (body:has(.fullscreen)) and a lingering panel would be
       orphaned. */
    const fsObserver = new MutationObserver(function () {
      const inFs = !!document.querySelector('.sh-preview-area.fullscreen');
      if (!inFs && isOpen) close();
    });
    fsObserver.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });

    panel = document.createElement('div');
    panel.id = 'fchatPanel';
    panel.style.display = 'none';
    panel.innerHTML = `
      <div class="fchat-header" id="fchatHeader">
        <i class="fas fa-wand-magic-sparkles" style="color:#E879F9"></i>
        <span class="fchat-title">Shaders Agent</span>
        <button id="fchatCollapse" title="Minimizar"><i class="fas fa-minus"></i></button>
        <button id="fchatDock" title="Abrir painel de shaders"><i class="fas fa-up-right-from-square"></i></button>
        <button id="fchatClose" title="Fechar"><i class="fas fa-times"></i></button>
      </div>
      <div class="fchat-body" id="fchatBody">
        <div class="chat-message system"><div class="bubble">Conectado ao agente de shaders. Mensagens aqui usam o mesmo pipeline do Brainstorm (contexto da cena atual, prompt de sistema, persistência e atalhos como <code>/persist</code> e <code>/save</code>).</div></div>
      </div>
      <div class="fchat-compose">
        <textarea id="fchatInput" rows="1" placeholder="Pergunte ao agente de shaders… (Enter envia, Shift+Enter quebra linha)"></textarea>
        <button id="fchatSend" title="Enviar"><i class="fas fa-paper-plane"></i></button>
      </div>
    `;
    document.body.appendChild(panel);

    headerEl = document.getElementById('fchatHeader');
    document.getElementById('fchatCollapse').onclick = collapseToggle;
    document.getElementById('fchatClose').onclick = close;
    document.getElementById('fchatDock').onclick = function () {
      close();
      // Open/expand the shaders brain panel so the conversation continues
      // side-by-side with the preview.
      try {
        if (typeof window.openSidebarToTab === 'function') window.openSidebarToTab('shaders');
        else if (typeof window.shadersShowView === 'function') window.shadersShowView('preview');
      } catch (_) {}
      const bi = document.getElementById('shBrainInput');
      if (bi && bi.scrollIntoView) bi.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (bi) bi.focus();
    };
    document.getElementById('fchatSend').onclick = sendFromFloating;
    const ta = document.getElementById('fchatInput');
    ta.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendFromFloating(); }
    });
    ta.addEventListener('input', function () {
      ta.style.height = 'auto';
      ta.style.height = Math.min(90, ta.scrollHeight) + 'px';
    });

    makeDraggable(panel, headerEl);
    restoreGeometry();
    startMirror();
  }

  function makeDraggable(el, handle) {
    let sx = 0, sy = 0, ox = 0, oy = 0, dragging = false;
    handle.addEventListener('mousedown', function (e) {
      if (e.target.closest('button')) return;
      dragging = true; handle.classList.add('dragging');
      sx = e.clientX; sy = e.clientY;
      const r = el.getBoundingClientRect();
      ox = r.left; oy = r.top;
      el.style.right = 'auto'; el.style.bottom = 'auto';
      el.style.left = ox + 'px'; el.style.top = oy + 'px';
      e.preventDefault();
    });
    document.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      const nx = ox + (e.clientX - sx), ny = oy + (e.clientY - sy);
      const maxX = window.innerWidth - 80, maxY = window.innerHeight - 40;
      el.style.left = Math.max(0, Math.min(maxX, nx)) + 'px';
      el.style.top  = Math.max(0, Math.min(maxY, ny)) + 'px';
    });
    document.addEventListener('mouseup', function () {
      if (!dragging) return;
      dragging = false; handle.classList.remove('dragging');
      saveState({ left: el.style.left, top: el.style.top, width: el.style.width, height: el.style.height });
    });
    // Persist resize
    const ro = new ResizeObserver(function () {
      if (!isOpen || panel.classList.contains('collapsed')) return;
      saveState({ width: panel.style.width, height: panel.style.height });
    });
    ro.observe(panel);
  }

  function restoreGeometry() {
    const s = loadState();
    if (s.left) { panel.style.left = s.left; panel.style.right = 'auto'; }
    if (s.top)  { panel.style.top  = s.top;  panel.style.bottom = 'auto'; }
    if (s.width)  panel.style.width  = s.width;
    if (s.height) panel.style.height = s.height;
    if (s.collapsed) panel.classList.add('collapsed');
  }

  function togglePanel() { isOpen ? close() : open(); }
  function open() {
    isOpen = true;
    panel.style.display = 'flex';
    toggleBtn.classList.add('hide');
    saveState({ open: true });
    setTimeout(function () { const i = document.getElementById('fchatInput'); if (i) i.focus(); }, 50);
    syncMirror();
  }
  function close() {
    isOpen = false;
    panel.style.display = 'none';
    toggleBtn.classList.remove('hide');
    saveState({ open: false });
  }
  function collapseToggle() {
    panel.classList.toggle('collapsed');
    saveState({ collapsed: panel.classList.contains('collapsed') });
  }

  function sendFromFloating() {
    const ta = document.getElementById('fchatInput');
    const text = (ta.value || '').trim();
    if (!text) return;
    ta.value = ''; ta.style.height = 'auto';
    // Route through the shaders brain chat: inject into #shBrainInput
    // and trigger shBrainSend() so the shaders-section agent, scene
    // context, slash-commands (/persist, /save) and persistence work.
    const brainInput = document.getElementById('shBrainInput');
    if (brainInput && typeof window.shBrainSend === 'function') {
      brainInput.value = text;
      try { brainInput.dispatchEvent(new Event('input', { bubbles: true })); } catch (_) {}
      window.shBrainSend();
      // Ensure we reflect the new message immediately.
      syncMirror();
    } else {
      // Shaders module not ready — surface a soft hint instead of silently
      // falling back to the main chat (which would contaminate history).
      const mirror = document.getElementById('fchatBody');
      if (mirror) {
        const warn = document.createElement('div');
        warn.className = 'chat-message system';
        warn.innerHTML = '<div class="bubble">⚠️ Agente de shaders ainda não inicializou. Abra a aba Shaders uma vez para ativá-lo.</div>';
        mirror.appendChild(warn);
        mirror.scrollTop = mirror.scrollHeight;
      }
    }
  }

  /* Mirror messages from the shaders brain chat (#shBrainLog) into #fchatBody.
     We clone bubbles as-is so the existing .sh-brain-msg styles apply. */
  function startMirror() {
    brainLog = document.getElementById('shBrainLog');
    mirrorBox = document.getElementById('fchatBody');
    if (!mirrorBox) {
      setTimeout(startMirror, 500);
      return;
    }
    // The shaders preview + brain chat are only built after the user opens
    // the shaders tab for the first time. Keep retrying so the mirror picks
    // up whenever it becomes available.
    if (!brainLog) {
      setTimeout(startMirror, 800);
      return;
    }
    syncMirror();
    observer = new MutationObserver(syncMirror);
    observer.observe(brainLog, { childList: true, subtree: true, characterData: true });
  }

  function syncMirror() {
    if (!mirrorBox) return;
    // Re-resolve #shBrainLog defensively — it may have been (re)rendered.
    brainLog = brainLog && brainLog.isConnected ? brainLog : document.getElementById('shBrainLog');
    if (!brainLog) return;
    const kids = Array.from(brainLog.children);
    const slice = kids.slice(-60);
    const lastHTML = slice.length ? slice[slice.length - 1].innerHTML : '';
    if (mirrorBox._lastCount === slice.length && mirrorBox._lastHTML === lastHTML) return;
    mirrorBox._lastCount = slice.length;
    mirrorBox._lastHTML = lastHTML;
    mirrorBox.innerHTML = '';
    if (!slice.length) {
      const hint = document.createElement('div');
      hint.className = 'chat-message system';
      hint.innerHTML = '<div class="bubble">Nenhuma mensagem ainda. Pergunte algo sobre a cena atual, ou use <code>/persist</code> para implementar com o agente e <code>/save</code> para salvar a conversa.</div>';
      mirrorBox.appendChild(hint);
    } else {
      slice.forEach(function (node) {
        mirrorBox.appendChild(node.cloneNode(true));
      });
    }
    mirrorBox.scrollTop = mirrorBox.scrollHeight;
  }

  /* Alt+C keyboard toggle */
  document.addEventListener('keydown', function (e) {
    if (e.altKey && (e.key === 'c' || e.key === 'C')) { e.preventDefault(); togglePanel(); }
  });

  /* Boot */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      buildUI();
      if (loadState().open) open();
    });
  } else {
    buildUI();
    if (loadState().open) open();
  }

  // Expose
  window.fchatOpen = open;
  window.fchatClose = close;
  window.fchatToggle = togglePanel;
})();
