/* ============================================================================
   Social Media Assistant — seção do Olivia Workspace.
   Gerenciamento de perfis, chat com DeepSeek e geração de conteúdo.
   ============================================================================ */
(function () {
  'use strict';

  // ── State ────────────────────────────────────────────────────────────────
  var built = false;
  var profiles = [];
  var activeProfileId = null;
  var currentEditProfile = null;
  var chatHistory = [];        // { role: 'user'|'assistant', text: string }
  var typingTimer = null;

  var STORAGE_KEY = 'Olivia_social_media_profiles_v1';

  // ── Helpers ──────────────────────────────────────────────────────────────
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function apiBase() {
    return (typeof API_BASE === 'string' && API_BASE) ? API_BASE.replace(/\/$/, '') : window.location.origin;
  }

  // ── Build the view (once) ────────────────────────────────────────────────
  function build() {
    var container = document.getElementById('socialMediaView');
    if (!container || built) return;

    container.innerHTML =
      '<div class="sm-head">' +
      '<div class="sm-head-brand">' +
      '<i class="fas fa-user-circle"></i>' +
      '<span class="sm-title">Social Media Assistant</span>' +
      '</div>' +
      '<button class="sm-btn sm-btn-sm" onclick="socialMediaHideView()" title="Fechar">' +
      '<i class="fas fa-times"></i></button>' +
      '</div>' +
      '<div class="sm-panels">' +
      // left profile panel
      '<div class="sm-profile-panel" id="smProfilePanel">' +
      '<div class="sm-toggle-btn" id="smToggleProfileBtn" title="Recolher perfis">' +
      '<i class="fas fa-chevron-left"></i></div>' +
      '<div class="sm-profile-list-container">' +
      '<h4 style="font-family:var(--serif);color:var(--white);margin-bottom:12px;">' +
      '<i class="fas fa-user-circle me-2"></i>Profiles</h4>' +
      '<div id="smActiveProfileCard" class="sm-profile-card">' +
      '<div class="sm-profile-pic"><i class="fas fa-user"></i></div>' +
      '<div>' +
      '<h5 id="smActiveName">Loading...</h5>' +
      '<p id="smActiveHeadline" class="small"></p>' +
      '<p id="smActiveLocation" class="small"></p>' +
      '</div>' +
      '</div>' +
      '<div id="smProfileList"></div>' +
      '<div class="d-grid gap-2 mt-3">' +
      '<button class="sm-btn sm-btn-outline w-100" id="smNewProfileBtn"><i class="fas fa-plus me-2"></i>Create New Profile</button>' +
      '<button class="sm-btn w-100" id="smUploadBtn"><i class="fas fa-file-upload me-2"></i>Upload PDF ' +
      '<input type="file" id="smFileInput" accept=".pdf" style="display:none"></button>' +
      '</div>' +
      '</div>' +
      '</div>' +
      // center chat panel
      '<div class="sm-chat-panel">' +
      '<div class="sm-chat-header">' +
      '<div><i class="fas fa-robot" style="color:var(--amber);font-size:20px;"></i></div>' +
      '<div>' +
      '<h5 style="font-family:var(--serif);color:var(--white);margin:0;">Content Assistant</h5>' +
      '<p class="small" style="margin:0;">Ready to help with your social media content</p>' +
      '</div>' +
      '</div>' +
      '<div class="sm-chat-messages" id="smChatMessages">' +
      '<div class="sm-message assistant">Hello! I\'m your social media content assistant. ...</div>' +
      '</div>' +
      '<div class="sm-chat-input-area">' +
      '<input type="text" class="sm-input" id="smMessageInput" placeholder="Type your message..." style="flex:1;">' +
      '<button class="sm-btn sm-btn-primary" id="smSendBtn"><i class="fas fa-paper-plane"></i></button>' +
      '</div>' +
      '</div>' +
      // right output panel
      '<div class="sm-output-panel" id="smOutputPanel">' +
      '<div class="sm-toggle-btn" id="smToggleOutputBtn" title="Recolher saída" style="right:auto;left:-14px;border-radius:6px 0 0 6px;">' +
      '<i class="fas fa-chevron-right"></i></div>' +
      '<div class="sm-output-content">' +
      '<h4 style="font-family:var(--serif);color:var(--white);margin-bottom:12px;">' +
      '<i class="fas fa-edit me-2"></i>Generated Content</h4>' +
      '<div class="sm-form-group">' +
      '<label class="sm-form-label">Content Purpose</label>' +
      '<select class="sm-select" id="smContentPurpose">' +
      '<option>Connection Request</option><option>Follow-up Message</option><option>Comment Response</option>' +
      '<option>Content Sharing</option><option>Job Inquiry</option></select>' +
      '</div>' +
      '<div class="sm-form-group">' +
      '<label class="sm-form-label">Tone</label>' +
      '<select class="sm-select" id="smContentTone">' +
      '<option>Professional</option><option>Friendly</option><option>Enthusiastic</option>' +
      '<option>Formal</option><option>Casual</option></select>' +
      '</div>' +
      '<div class="sm-form-group">' +
      '<label class="sm-form-label">Key Points</label>' +
      '<textarea class="sm-textarea" id="smKeyPoints" rows="3" placeholder="Mention specific experience..."></textarea>' +
      '</div>' +
      '<div class="sm-output-preview" id="smOutputPreview">' +
      '<p class="text-muted">Your generated content will appear here...</p>' +
      '</div>' +
      '<div class="d-flex gap-2 mt-3">' +
      '<button class="sm-btn sm-btn-sm" id="smCopyBtn"><i class="fas fa-copy me-1"></i>Copy</button>' +
      '<button class="sm-btn sm-btn-outline sm-btn-sm" id="smRegenerateBtn"><i class="fas fa-sync me-1"></i>Regenerate</button>' +
      '<button class="sm-btn sm-btn-primary sm-btn-sm" id="smUseThisBtn"><i class="fas fa-check me-1"></i>Use This</button>' +
      '</div>' +
      '</div>' +
      '</div>' +
      '</div>' +
      // Profile editor modal
      '<div class="sm-modal-overlay" id="smProfileModal">' +
      '<div class="sm-modal">' +
      '<div class="sm-modal-header">' +
      '<h3 class="sm-modal-title" id="smModalTitle">Edit Profile</h3>' +
      '<button class="sm-modal-close" id="smCloseModalBtn">&times;</button>' +
      '</div>' +
      '<form id="smProfileForm">' +
      '<div class="sm-form-group"><label class="sm-form-label">Full Name *</label><input class="sm-input" id="smProfileName" required></div>' +
      '<div class="sm-form-group"><label class="sm-form-label">Headline</label><input class="sm-input" id="smProfileHeadline"></div>' +
      '<div class="sm-form-group"><label class="sm-form-label">Location</label><input class="sm-input" id="smProfileLocation"></div>' +
      '<div class="sm-form-group"><label class="sm-form-label">Summary</label><textarea class="sm-textarea" id="smProfileSummary" rows="3"></textarea></div>' +
      '<div class="sm-form-group"><label class="sm-form-label">Key Skills (comma separated)</label><input class="sm-input" id="smProfileSkills"></div>' +
      '</form>' +
      '<div class="d-flex gap-2 justify-end mt-3">' +
      '<button class="sm-btn" id="smCancelBtn">Cancel</button>' +
      '<button class="sm-btn sm-btn-primary" id="smSaveProfileBtn">Save Profile</button>' +
      '</div>' +
      '</div>' +
      '</div>' +
      // Notification
      '<div id="smNotification" class="sm-notification" style="display:none;"></div>';

    built = true;
    loadProfiles();
    attachEvents();
    updateProfileUI();
  }

  // ── Event binding ────────────────────────────────────────────────────────
  function attachEvents() {
    document.getElementById('smToggleProfileBtn').onclick = toggleProfilePanel;
    document.getElementById('smToggleOutputBtn').onclick = toggleOutputPanel;
    document.getElementById('smNewProfileBtn').onclick = function() { openProfileModal(null); };
    document.getElementById('smUploadBtn').onclick = function() { document.getElementById('smFileInput').click(); };
    document.getElementById('smFileInput').onchange = handleFileUpload;
    document.getElementById('smSendBtn').onclick = sendMessage;
    document.getElementById('smMessageInput').onkeypress = function(e) { if (e.key === 'Enter') sendMessage(); };
    document.getElementById('smRegenerateBtn').onclick = regenerateContent;
    document.getElementById('smCopyBtn').onclick = copyContent;
    document.getElementById('smUseThisBtn').onclick = useGeneratedContent;
    document.getElementById('smCloseModalBtn').onclick = closeModal;
    document.getElementById('smCancelBtn').onclick = closeModal;
    document.getElementById('smSaveProfileBtn').onclick = saveProfile;
  }

  // ── Profile operations ───────────────────────────────────────────────────
  function loadProfiles() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      profiles = raw ? JSON.parse(raw) : [];
    } catch (e) { profiles = []; }
    renderProfileList();
  }
  function saveProfiles() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
    updateProfileCount();
  }
  function updateProfileCount() {
    var badge = document.getElementById('smProfileCount');
    if (badge) badge.textContent = profiles.length;
  }

  function renderProfileList() {
    var list = document.getElementById('smProfileList');
    if (!list) return;
    if (!profiles.length) {
      list.innerHTML = '<div class="sm-empty-state"><i class="fas fa-user-slash"></i><p>No profiles yet</p></div>';
      return;
    }
    list.innerHTML = profiles.map(function(p) {
      return '<div class="sm-profile-item' + (p.id === activeProfileId ? ' active' : '') + '" data-id="' + p.id + '">' +
        '<div>' +
        '<div class="fw-medium">' + esc(p.name) + '</div>' +
        '<div class="small">' + esc(p.headline || '') + '</div>' +
        '</div>' +
        '<span class="edit-btn" data-action="edit" data-id="' + p.id + '"><i class="fas fa-edit"></i></span>' +
        '</div>';
    }).join('');
    // bind clicks
    list.querySelectorAll('.sm-profile-item').forEach(function(el) {
      el.addEventListener('click', function(e) {
        if (e.target.closest('.edit-btn')) return;
        setActiveProfile(el.dataset.id);
      });
    });
    list.querySelectorAll('.edit-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var pid = btn.dataset.id;
        var profile = profiles.find(function(p) { return p.id === pid; });
        if (profile) openProfileModal(profile);
      });
    });
  }

  function setActiveProfile(id) {
    activeProfileId = id;
    renderProfileList();
    updateProfileUI();
  }

  function updateProfileUI() {
    var profile = profiles.find(function(p) { return p.id === activeProfileId; });
    var card = document.getElementById('smActiveProfileCard');
    if (!card) return;
    if (profile) {
      document.getElementById('smActiveName').textContent = profile.name;
      document.getElementById('smActiveHeadline').textContent = profile.headline || '';
      document.getElementById('smActiveLocation').textContent = profile.location || '';
    } else {
      document.getElementById('smActiveName').textContent = 'No profile selected';
      document.getElementById('smActiveHeadline').textContent = '';
      document.getElementById('smActiveLocation').textContent = '';
    }
  }

  // ── PDF upload & extraction ──────────────────────────────────────────────
  async function handleFileUpload(e) {
    var files = e.target.files;
    if (!files || !files.length) return;
    var file = files[0];
    showNotification('Processing ' + file.name + '...');
    if (file.type !== 'application/pdf') {
      showNotification('Please upload a valid PDF.', 'error');
      return;
    }
    try {
      if (typeof pdfjsLib === 'undefined') {
        showNotification('PDF.js not loaded.', 'error');
        return;
      }
      var arrayBuffer = await file.arrayBuffer();
      var pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
      var text = '';
      for (var i = 1; i <= pdf.numPages; i++) {
        var page = await pdf.getPage(i);
        var content = await page.getTextContent();
        text += content.items.map(function(item) { return item.str; }).join(' ') + ' ';
      }
      var profile = await processWithDeepSeek(text, file.name);
      profiles.push(profile);
      saveProfiles();
      renderProfileList();
      setActiveProfile(profile.id);
      showNotification('Profile ' + profile.name + ' added!', 'success');
    } catch (err) {
      console.error(err);
      showNotification('Error: ' + err.message, 'error');
    }
    e.target.value = ''; // reset
  }

  /**
   * Safely parse LLM JSON response, handling markdown code fences and
   * other common wrapping patterns that models sometimes return.
   */
  function parseLLMJson(raw) {
    if (!raw) return null;
    var s = raw.trim();
    // Strip markdown code fences: ```json ... ``` or ``` ... ```
    s = s.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
    // Try direct parse first
    try { return JSON.parse(s); } catch (_e) { /* fall through */ }
    // Try to find a JSON object/array via regex as last resort
    var match = s.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (match) {
      try { return JSON.parse(match[1]); } catch (_e2) { /* give up */ }
    }
    return null;
  }

  /**
   * Validate that an extracted profile object has the minimum required fields.
   * Returns null if valid, or an error message string if invalid.
   */
  function validateProfile(obj) {
    if (!obj || typeof obj !== 'object') return 'Extracted data is not an object';
    if (!obj.name || typeof obj.name !== 'string' || !obj.name.trim()) return 'Profile must include a name';
    return null;
  }

  async function processWithDeepSeek(extractedText, fileName) {
    var systemPrompt = 'You are a LinkedIn profile extraction assistant. '
      + 'Analyze the following text and extract profile information. '
      + 'Return ONLY a valid JSON object (no markdown, no code fences) with these exact keys:\n'
      + '{\n'
      + '    "name": "Full Name",\n'
      + '    "headline": "Professional Headline",\n'
      + '    "location": "Location",\n'
      + '    "skills": ["skill1", "skill2"],\n'
      + '    "experience": [{"title": "Job Title", "company": "Company Name", "duration": "Duration", "description": "Job Description"}],\n'
      + '    "education": [{"school": "School Name", "degree": "Degree"}],\n'
      + '    "summary": "Professional Summary"\n'
      + '}\n'
      + 'If the text is not a LinkedIn profile, return {"name": "Unknown Profile"}.\n'
      + 'Respond with raw JSON only — no explanations, no formatting.';

    var config = JSON.parse(localStorage.getItem('OliviaLegal.workspace.config') || '{}');
    var provider = config.provider || 'fireworks';
    var model = config.model || 'accounts/fireworks/models/qwen3p7-plus';
    var payload = {
      provider: provider,
      model: model,
      message: extractedText,
      system: systemPrompt,
      max_tokens: 2048,
      response_format: { type: 'json_object' }
    };
    var headers = { 'Content-Type': 'application/json' };
    if (typeof window.getCustomApiKey === 'function') {
      var customKey = window.getCustomApiKey(provider);
      if (customKey) {
        headers['Authorization'] = 'Bearer ' + customKey;
      }
    }
    var res = await fetch(apiBase() + '/api/llm/completions', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      var errData;
      try { errData = await res.json(); } catch (_e) { errData = {}; }
      throw new Error(errData.error || 'API error ' + res.status);
    }
    var data = await res.json();
    if (data.error) throw new Error(data.error);
    var content = data.content || '';
    if (!content) throw new Error('No content returned from API');
    // Safely parse the LLM JSON, handling markdown fences etc.
    var json = parseLLMJson(content);
    if (!json) {
      throw new Error(
        'Failed to parse LLM response as JSON. Raw response (first 200 chars): '
        + content.slice(0, 200)
      );
    }
    // Validate minimum required fields
    var validationError = validateProfile(json);
    if (validationError) {
      throw new Error(validationError + '. Raw keys: ' + Object.keys(json).join(', '));
    }
    return Object.assign({}, json, { id: 'profile-' + Date.now(), filename: fileName });
  }

  // ── Chat (LLM) ──────────────────────────────────────────────────────
  /**
   * Build the system prompt for the chat LLM, injecting active profile context.
   */
  function buildChatSystemPrompt() {
    var profile = profiles.find(function(p) { return p.id === activeProfileId; });
    var base = 'You are a LinkedIn content assistant integrated into the Olivia Workspace. '
      + 'Your role is to help the user craft professional LinkedIn content — '
      + 'connection requests, follow-up messages, comments, posts, and job inquiries. '
      + 'Keep responses concise, actionable, and professional. '
      + 'When generating messages, use the active profile details for personalization.';
    if (profile) {
      base += '\n\n--- Active LinkedIn Profile ---\n'
        + 'Name: ' + (profile.name || 'N/A') + '\n'
        + 'Headline: ' + (profile.headline || 'N/A') + '\n'
        + 'Location: ' + (profile.location || 'N/A') + '\n'
        + 'Summary: ' + (profile.summary || 'N/A') + '\n';
      if (profile.skills && profile.skills.length) {
        base += 'Skills: ' + profile.skills.join(', ') + '\n';
      }
      if (profile.experience && profile.experience.length) {
        base += 'Experience:\n';
        for (var ei = 0; ei < profile.experience.length; ei++) {
          var exp = profile.experience[ei];
          base += '  - ' + (exp.title || '') + ' at ' + (exp.company || '') + ' (' + (exp.duration || '') + ')\n';
        }
      }
      if (profile.education && profile.education.length) {
        base += 'Education:\n';
        for (var edi = 0; edi < profile.education.length; edi++) {
          var ed = profile.education[edi];
          base += '  - ' + (ed.degree || '') + ' at ' + (ed.school || '') + '\n';
        }
      }
      base += '---\n\nUse these profile details to personalize all generated content.';
    }
    return base;
  }

  function sendMessage() {
    var input = document.getElementById('smMessageInput');
    var msg = input.value.trim();
    if (!msg) return;
    addMessageToChat(msg, 'user');
    input.value = '';
    showTyping(true);
    var config = JSON.parse(localStorage.getItem('OliviaLegal.workspace.config') || '{}');
    var provider = config.provider || 'fireworks';
    var model = config.model || 'accounts/fireworks/models/qwen3p7-plus';
    var systemPrompt = buildChatSystemPrompt();
    var payload = {
      provider: provider,
      model: model,
      message: msg,
      system: systemPrompt,
      history: chatHistory,
      section_key: 'socialmedia',
      max_tokens: 1000
    };
    var headers = { 'Content-Type': 'application/json' };
    if (typeof window.getCustomApiKey === 'function') {
      var customKey = window.getCustomApiKey(provider);
      if (customKey) {
        headers['Authorization'] = 'Bearer ' + customKey;
      }
    }
    fetch(apiBase() + '/api/assistant/chat', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload)
    })
    .then(function(res) {
      if (!res.ok || !res.body || !res.body.getReader) throw new Error('API error ' + res.status);
      var reader = res.body.getReader();
      var decoder = new TextDecoder('utf-8');
      var buffer = '';
      var accumulated = '';
      function pump() {
        return reader.read().then(function(r) {
          if (r.done) return accumulated;
          buffer += decoder.decode(r.value, { stream: true });
          var lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (var k = 0; k < lines.length; k++) {
            var line = lines[k].trim();
            if (line.indexOf('data:') !== 0) continue;
            var json = line.slice(5).trim();
            if (!json || json === '[DONE]') continue;
            var evt;
            try { evt = JSON.parse(json); } catch (_e) { continue; }

            // Handle error events
            if (evt.type === 'error' || evt.event === 'error' ||
                (evt.content && typeof evt.content === 'object' && evt.content.event === 'error')) {
              var errMsg = evt.message || (evt.content && evt.content.message) || 'Unknown error';
              throw new Error(errMsg);
            }

            if (evt.type === 'token' && typeof evt.content === 'string') {
              accumulated += evt.content;
            }
          }
          return pump();
        });
      }
      return pump();
    })
    .then(function(reply) {
      showTyping(false);
      var text = reply || 'No response.';
      addMessageToChat(text, 'assistant');
      // Store in history for context continuity
      chatHistory.push({ role: 'user', text: msg });
      chatHistory.push({ role: 'assistant', text: text });
      // Keep history bounded
      if (chatHistory.length > 20) {
        chatHistory = chatHistory.slice(-20);
      }
    })
    .catch(function(err) {
      showTyping(false);
      addMessageToChat('Error: ' + err.message, 'assistant');
    });
  }

  function addMessageToChat(text, role) {
    var container = document.getElementById('smChatMessages');
    var div = document.createElement('div');
    div.className = 'sm-message ' + (role === 'user' ? 'user' : 'assistant');
    div.textContent = text;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function showTyping(show) {
    var indicator = document.getElementById('smTypingIndicator');
    if (show) {
      if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'smTypingIndicator';
        indicator.className = 'sm-typing';
        indicator.innerHTML = '<div class="sm-typing-dot"></div><div class="sm-typing-dot"></div><div class="sm-typing-dot"></div>';
        document.getElementById('smChatMessages').appendChild(indicator);
      }
      indicator.style.display = 'flex';
    } else if (indicator) {
      indicator.style.display = 'none';
    }
  }

  // ── Content generation (LLM-powered) ─────────────────────────────────────
  function regenerateContent() {
    var profile = profiles.find(function(p) { return p.id === activeProfileId; });
    if (!profile) { showNotification('No active profile.', 'error'); return; }
    var purpose = document.getElementById('smContentPurpose').value;
    var tone = document.getElementById('smContentTone').value;
    var keyPoints = document.getElementById('smKeyPoints').value.trim();

    // Build a profile summary to inject into the LLM prompt
    var profileSummary = 'Name: ' + (profile.name || 'N/A') + '\n'
      + 'Headline: ' + (profile.headline || 'N/A') + '\n'
      + 'Location: ' + (profile.location || 'N/A') + '\n'
      + 'Summary: ' + (profile.summary || 'N/A') + '\n';
    if (profile.skills && profile.skills.length) {
      profileSummary += 'Skills: ' + profile.skills.join(', ') + '\n';
    }
    if (profile.experience && profile.experience.length) {
      profileSummary += 'Experience:\n';
      for (var ei = 0; ei < profile.experience.length; ei++) {
        var e = profile.experience[ei];
        profileSummary += '  - ' + (e.title || '') + ' at ' + (e.company || '') + ' (' + (e.duration || '') + ')\n';
      }
    }
    if (profile.education && profile.education.length) {
      profileSummary += 'Education:\n';
      for (var edi = 0; edi < profile.education.length; edi++) {
        var ed = profile.education[edi];
        profileSummary += '  - ' + (ed.degree || '') + ' at ' + (ed.school || '') + '\n';
      }
    }

    var systemPrompt = 'You are a LinkedIn content generation specialist. '
      + 'Generate professional LinkedIn content based on the profile and parameters provided. '
      + 'Output ONLY the final message text (no explanations, no JSON).';

    var userPrompt = 'Using this LinkedIn profile:\n' + profileSummary + '\n'
      + 'Generate a ' + tone.toLowerCase() + ' ' + purpose.toLowerCase() + '.\n'
      + (keyPoints ? 'Key points to include: ' + keyPoints + '\n' : '')
      + 'Write in first person as if the profile owner is reaching out. '
      + 'Keep it concise (under 200 words) and ready to copy-paste.';

    var config = JSON.parse(localStorage.getItem('OliviaLegal.workspace.config') || '{}');
    var provider = config.provider || 'fireworks';
    var model = config.model || 'accounts/fireworks/models/qwen3p7-plus';
    var payload = {
      provider: provider,
      model: model,
      message: userPrompt,
      system: systemPrompt,
      max_tokens: 1024
    };
    var headers = { 'Content-Type': 'application/json' };
    if (typeof window.getCustomApiKey === 'function') {
      var customKey = window.getCustomApiKey(provider);
      if (customKey) {
        headers['Authorization'] = 'Bearer ' + customKey;
      }
    }

    document.getElementById('smOutputPreview').innerHTML =
      '<p class="text-muted"><i class="fas fa-spinner fa-spin"></i> Generating...</p>';

    fetch(apiBase() + '/api/llm/completions', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload)
    })
    .then(function(res) {
      if (!res.ok) return res.json().then(function(d) { throw new Error(d.error || 'API error ' + res.status); });
      return res.json();
    })
    .then(function(data) {
      if (data.error) throw new Error(data.error);
      var text = (data.content || 'No content generated.').trim();
      document.getElementById('smOutputPreview').innerHTML = esc(text).replace(/\n/g, '<br>');
      showNotification('Content generated!', 'success');
    })
    .catch(function(err) {
      document.getElementById('smOutputPreview').innerHTML =
        '<p class="text-danger">Error: ' + esc(err.message) + '</p>';
      showNotification('Generation failed: ' + err.message, 'error');
    });
  }

  function copyContent() {
    var el = document.getElementById('smOutputPreview');
    if (!el) return;
    navigator.clipboard.writeText(el.innerText).then(function() {
      showNotification('Copied!', 'success');
    }).catch(function() { showNotification('Failed to copy', 'error'); });
  }

  function useGeneratedContent() {
    var el = document.getElementById('smOutputPreview');
    if (!el || !el.innerText.trim()) return;
    addMessageToChat(el.innerText, 'user');
    showNotification('Content added to chat.');
  }

  // ── Modal ────────────────────────────────────────────────────────────────
  function openProfileModal(profile) {
    currentEditProfile = profile;
    document.getElementById('smModalTitle').textContent = profile ? 'Edit Profile' : 'Create Profile';
    document.getElementById('smProfileName').value = profile ? profile.name : '';
    document.getElementById('smProfileHeadline').value = profile ? profile.headline : '';
    document.getElementById('smProfileLocation').value = profile ? profile.location : '';
    document.getElementById('smProfileSummary').value = profile ? profile.summary : '';
    document.getElementById('smProfileSkills').value = profile && profile.skills ? profile.skills.join(', ') : '';
    document.getElementById('smProfileModal').classList.add('open');
  }
  function closeModal() {
    document.getElementById('smProfileModal').classList.remove('open');
  }
  function saveProfile() {
    var name = document.getElementById('smProfileName').value.trim();
    if (!name) { showNotification('Name required', 'error'); return; }
    var data = {
      name: name,
      headline: document.getElementById('smProfileHeadline').value.trim(),
      location: document.getElementById('smProfileLocation').value.trim(),
      summary: document.getElementById('smProfileSummary').value.trim(),
      skills: document.getElementById('smProfileSkills').value.split(',').map(function(s){return s.trim();}).filter(Boolean)
    };
    if (currentEditProfile) {
      var idx = profiles.findIndex(function(p) { return p.id === currentEditProfile.id; });
      if (idx !== -1) Object.assign(profiles[idx], data);
    } else {
      var newProfile = Object.assign({}, data, { id: 'profile-' + Date.now(), filename: 'Manual entry', experience: [], education: [] });
      profiles.push(newProfile);
      setActiveProfile(newProfile.id);
    }
    saveProfiles();
    renderProfileList();
    closeModal();
    showNotification('Profile saved.', 'success');
  }

  // ── Notifications ────────────────────────────────────────────────────────
  function showNotification(msg, type) {
    type = type || 'info';
    var el = document.getElementById('smNotification');
    if (!el) return;
    el.textContent = msg;
    el.className = 'sm-notification sm-notification-' + type + ' show';
    el.style.display = 'block';
    clearTimeout(el._timeout);
    el._timeout = setTimeout(function() { el.style.display = 'none'; }, 3000);
  }

  // ── Panel toggles ────────────────────────────────────────────────────────
  function toggleProfilePanel() {
    var panel = document.getElementById('smProfilePanel');
    panel.classList.toggle('collapsed');
    var icon = document.querySelector('#smToggleProfileBtn i');
    if (icon) {
      icon.classList.toggle('fa-chevron-left');
      icon.classList.toggle('fa-chevron-right');
    }
  }
  function toggleOutputPanel() {
    var panel = document.getElementById('smOutputPanel');
    panel.classList.toggle('collapsed');
    var icon = document.querySelector('#smToggleOutputBtn i');
    if (icon) {
      icon.classList.toggle('fa-chevron-right');
      icon.classList.toggle('fa-chevron-left');
    }
  }

  // ── Lifecycle: show / hide view ──────────────────────────────────────────
  var SIBLING_HIDE = ['violationsHideView', 'lawLibHideView', 'masterIndexHideView',
    'legalRouterHideView', 'spacesHideView', 'listeningHideView', 'studioHideView',
    'descobertaHideView', 'memoryHideView', 'shadersHideView', 'architectureHideView',
    'craudioHideView', 'sheetsHideView', 'driveHideView'];
  var CHAT_IDS = ['chatHeader', 'welcomeState', 'chatLog', 'chatCompose', 'chatToolbar'];

  window.socialMediaShowView = function () {
    build();
    CHAT_IDS.forEach(function(id) {
      var el = document.getElementById(id); if (el) el.style.display = 'none';
    });
    var mc = document.querySelector('.main-content');
    if (mc) { mc._smDisplay = mc.style.display; mc.style.display = 'none'; }
    if (typeof window.aexHideMain === 'function') window.aexHideMain();
    SIBLING_HIDE.forEach(function(fn) {
      try { if (typeof window[fn] === 'function') window[fn](); } catch (_e) {}
    });
    var v = document.getElementById('socialMediaView');
    if (v) v.classList.add('active');
    var ws = document.querySelector('.workspace');
    if (ws) ws.classList.add('sm-open');
  };

  window.socialMediaHideView = function () {
    var v = document.getElementById('socialMediaView');
    if (v) v.classList.remove('active');
    var ws = document.querySelector('.workspace');
    if (ws) ws.classList.remove('sm-open');
    var mc = document.querySelector('.main-content');
    if (mc) { mc.style.display = mc._smDisplay !== undefined ? mc._smDisplay : ''; delete mc._smDisplay; }
    CHAT_IDS.forEach(function(id) {
      var el = document.getElementById(id); if (el) el.style.display = '';
    });
  };

  // Wrap sibling ShowView functions to auto-close this section
  function wrapSiblings() {
    var names = ['violationsShowView', 'lawLibShowView', 'masterIndexShowView',
      'legalRouterShowView', 'spacesShowView', 'listeningShowView', 'studioShowView',
      'descobertaShowView', 'memoryShowView', 'shadersShowView', 'architectureShowView',
      'craudioShowView', 'sheetsShowView', 'driveShowView',
      'resetToWelcome', 'aexToggleMain'];
    names.forEach(function (n) {
      var orig = window[n];
      if (typeof orig !== 'function' || orig._smWrapped) return;
      var wrapped = function () {
        try { window.socialMediaHideView(); } catch (_e) {}
        return orig.apply(this, arguments);
      };
      wrapped._smWrapped = true;
      window[n] = wrapped;
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wrapSiblings);
  } else {
    wrapSiblings();
  }
})();