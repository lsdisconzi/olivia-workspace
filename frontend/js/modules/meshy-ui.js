/* ═══════════════════════════════════════════════════════════════════
   MESHY UI — Shaders view integration for the `meshy` MCP server.
   Exposes: meshyOpenModal, meshyCloseModal, meshySwitchTab, meshySubmit.
   Strategy: the UI does NOT call Meshy directly. It drafts a natural-
   language instruction for the agent (openclaude), which then selects
   the correct meshy__* tool. Task progress/results surface via the
   normal chat stream.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }

  function show(el) { if (el) el.style.display = 'flex'; }
  function hide(el) { if (el) el.style.display = 'none'; }

  window.meshyOpenModal = function () {
    const m = $('meshyModal');
    if (!m) return;
    show(m);
    // default focus on the text prompt
    setTimeout(function () { const p = $('meshyTextPrompt'); if (p) p.focus(); }, 50);
  };

  window.meshyCloseModal = function () { hide($('meshyModal')); };

  window.meshySwitchTab = function (tab) {
    document.querySelectorAll('.meshy-tab-btn').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-meshy-tab') === tab);
    });
    document.querySelectorAll('.meshy-tab-panel').forEach(function (p) {
      p.style.display = (p.getAttribute('data-meshy-panel') === tab) ? 'block' : 'none';
    });
  };

  function draftTextPrompt() {
    const prompt = ($('meshyTextPrompt') || {}).value || '';
    if (!prompt.trim()) return null;
    const lowpoly = ($('meshyTextLowpoly') || {}).checked;
    const pbr     = ($('meshyTextPBR') || {}).checked;
    const rig     = ($('meshyTextRig') || {}).checked;

    const steps = [];
    steps.push(
      'Call meshy__text_to_3d_preview with ' +
      JSON.stringify({
        prompt: prompt.trim(),
        model_type: lowpoly ? 'lowpoly' : 'standard',
        pose_mode: rig ? 'a-pose' : '',
        target_formats: ['glb']
      }) + '.'
    );
    steps.push('Poll meshy__get_task (resource="text-to-3d") every 5s until status="SUCCEEDED".');
    if (pbr) {
      steps.push(
        'Then call meshy__text_to_3d_refine with {preview_task_id: <that id>, enable_pbr: true, target_formats: ["glb"]} ' +
        'and poll the same way.'
      );
    }
    if (rig) {
      steps.push(
        'Finally call meshy__rigging with the SUCCEEDED textured task id and poll resource="rigging" until SUCCEEDED.'
      );
    }
    steps.push('Report the final GLB URL so the user can click "Import into scene" (sh3dLoadGLB).');
    return 'Generate a 3D model via Meshy:\n\n- ' + steps.join('\n- ');
  }

  function draftImagePrompt() {
    const raw = ($('meshyImageURLs') || {}).value || '';
    const urls = raw.split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
    if (urls.length === 0) return null;
    const tex = (($('meshyImageTexPrompt') || {}).value || '').trim();
    const pbr = ($('meshyImagePBR') || {}).checked;
    const remesh = ($('meshyImageRemesh') || {}).checked;

    const payload = {
      enable_pbr: !!pbr,
      should_remesh: !!remesh,
      topology: remesh ? 'quad' : 'triangle',
      target_formats: ['glb']
    };
    if (tex) payload.texture_prompt = tex;

    let call;
    if (urls.length === 1) {
      payload.image_url = urls[0];
      call = 'meshy__image_to_3d';
    } else {
      payload.image_urls = urls.slice(0, 4);
      call = 'meshy__multi_image_to_3d';
    }

    return (
      'Reconstruct a 3D model from image(s) via Meshy:\n\n' +
      '- Call ' + call + ' with ' + JSON.stringify(payload) + '.\n' +
      '- Poll meshy__get_task (resource="' + (urls.length === 1 ? 'image-to-3d' : 'multi-image-to-3d') + '") every 10s until status="SUCCEEDED".\n' +
      '- Return the final GLB URL so the user can import it into the scene.'
    );
  }

  function draftImportPrompt() {
    const id = (($('meshyImportID') || {}).value || '').trim();
    const resource = ($('meshyImportResource') || {}).value || 'text-to-3d';
    if (!id) return null;
    return (
      'Import a Meshy task into the Shaders 3D scene:\n\n' +
      '- Call meshy__get_task with {resource: "' + resource + '", id: "' + id + '"}.\n' +
      '- If status is "PENDING" or "IN_PROGRESS", keep polling every 10s.\n' +
      '- Once SUCCEEDED, return the GLB URL from model_urls.glb (or result.rigged_character_glb_url for rigging).\n' +
      '- Tell me that URL so I can click "Import into scene".'
    );
  }

  window.meshySubmit = function () {
    const activeTab = (document.querySelector('.meshy-tab-btn.active') || {}).getAttribute
      ? document.querySelector('.meshy-tab-btn.active').getAttribute('data-meshy-tab')
      : 'text';
    let text = null;
    if (activeTab === 'text')   text = draftTextPrompt();
    if (activeTab === 'image')  text = draftImagePrompt();
    if (activeTab === 'import') text = draftImportPrompt();

    if (!text) {
      if (typeof window.shToast === 'function') window.shToast('Preencha os campos obrigatórios.');
      else alert('Preencha os campos obrigatórios.');
      return;
    }

    window.meshyCloseModal();

    // Route through the main chat — sendMessage(preset) is the single entry point
    // that streams tool calls through the agent and surfaces progress in the UI.
    if (typeof window.sendMessage === 'function') {
      window.sendMessage(text);
    } else {
      const ta = $('chatInput');
      if (ta) { ta.value = text; ta.focus(); }
    }
  };

  /* Surface Meshy tool-call events from the chat stream as a tiny
     HUD chip (best-effort — integrates if stream.js dispatches custom events). */
  window.addEventListener('kout:tool-call', function (ev) {
    try {
      const d = ev.detail || {};
      if (!d.name || !d.name.startsWith('meshy__')) return;
      const hud = $('sh3dHud');
      if (!hud) return;
      let chip = $('meshyHudChip');
      if (!chip) {
        chip = document.createElement('div');
        chip.id = 'meshyHudChip';
        chip.className = 'sh-preview-badge';
        chip.style.borderColor = '#E879F9';
        chip.style.color = '#E879F9';
        hud.appendChild(chip);
      }
      chip.innerHTML = '<i class="fas fa-cube"></i> ' + d.name.replace(/^meshy__/, '') + (d.progress != null ? (' ' + d.progress + '%') : '…');
      if (d.status === 'SUCCEEDED' && d.glb_url && typeof window.sh3dLoadGLB === 'function') {
        chip.innerHTML += ' <a href="#" onclick="event.preventDefault();sh3dLoadGLB(\'' + d.glb_url.replace(/'/g, "%27") + '\')" style="color:#4ECDC4;margin-left:6px">➕ Importar</a>';
      }
    } catch (_) { /* ignore */ }
  });
})();
