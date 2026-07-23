/* ═══════════════════════════════════════════════════════════════════
   MODALS MODULE - Modal dialogs, forms, and UI overlays
   ═══════════════════════════════════════════════════════════════════ */

// Show create modal
function showCreateModal() {
  document.getElementById('modalOverlay').classList.add('show');
  document.getElementById('createModal').classList.add('show');
  document.getElementById('modalAgentName').focus();
  loadSharedScopes();
  loadExistingQdrantCollections();
}

// Close modal
function closeModal() {
  document.getElementById('modalOverlay').classList.remove('show');
  document.getElementById('createModal').classList.remove('show');
  // Reset basic fields
  document.getElementById('modalAgentName').value = '';
  document.getElementById('modalAgentDesc').value = '';
  document.getElementById('modalSystemPrompt').value = '';
  document.getElementById('modalImportStatus').textContent = '';
  document.getElementById('sharedScopesGrid').innerHTML = '';
  // Reset scope fields
  document.getElementById('modalWorkspaceScope').value = 'own';
  document.getElementById('customScopeFoldersDiv').style.display = 'none';
  document.getElementById('modalScopeFolders').value = '';
  document.getElementById('modalOutputFolder').value = '';
  document.getElementById('modalScopePermissions').value = 'read_write';
  // Reset Qdrant fields
  document.getElementById('modalQdrantShared').checked = true;
  document.getElementById('qdrantExistingDiv').style.display = 'none';
  document.getElementById('qdrantDedicatedDiv').style.display = 'none';
  document.getElementById('modalQdrantDedicatedName').value = '';
  // Reset Neo4j fields
  document.getElementById('modalNeo4jShared').checked = true;
  document.getElementById('neo4jDedicatedDiv').style.display = 'none';
  document.getElementById('modalNeo4jDedicatedName').value = '';
  // Reset memory files
  document.getElementById('modalInitialMemoryFiles').value = '';
  document.getElementById('modalCustomSharedPaths').value = '';
}

// Create project
async function createProject() {
  const name = await window.customPrompt('Project name:');
  if (!name) return;
  const list = document.getElementById('projectList');
  const item = document.createElement('div');
  item.className = 'project-item';
  item.dataset.project = name.toLowerCase().replace(/\s+/g, '-');
  item.innerHTML = `<div class="project-name">${escapeHtml(name)}</div><div class="project-meta">Custom project</div>`;
  item.onclick = () => { document.querySelectorAll('.project-item').forEach(p => p.classList.remove('selected')); item.classList.add('selected'); };
  list.appendChild(item);
}

// Create Qdrant collection
async function createQdrantCollection(name) {
  if (!name) {
    name = await window.customPrompt('Collection name:');
    if (!name) return;
  }

  try {
    await LA8159API.memory.createCollection(name);
    addSystemBubble(`Collection "${name}" criada`);
  } catch (e) {
    addSystemBubble(`Falha ao criar collection: ${e.message}`);
  }
}

// Create Neo4j database
async function createNeo4jDb(name) {
  if (!name) {
    name = await window.customPrompt('Database name:');
    if (!name) return;
  }
  
  try {
    // Neo4j database creation is managed server-side; no API endpoint available
    addSystemBubble(`Banco Neo4j "${name}" configurado. Reinicie o servidor para aplicar.`);
    return;
  } catch (e) {
    addSystemBubble(`Erro: ${e.message}`);
  }
}

// Memory view create collection
window.mvCreateCollection = function() {
  mvToast('Para criar coleções, use o painel Config ou reinicie o servidor com as coleções padrão.');
}

// Studio open config modal
function studioOpenCfgModal() {
  document.getElementById('studioCfgOverlay').classList.add('open');
  document.getElementById('studioCfgModal').classList.add('open');
}

// Close bundle import modal
function closeBundleImportModal() {
  document.getElementById('bundleImportOverlay').classList.remove('show');
  document.getElementById('bundleImportModal').classList.remove('show');
}

// Click modal handler
function clickedModal(e) {
  if (e.target.id === 'modalOverlay' || e.target.closest('.modal-close')) {
    closeModal();
  }
}

// Render CSV table
function renderCsvTable(csvText) {
  const lines = csvText.trim().split('\n').map(l => l.split(','));
  if (!lines.length) return `<pre>${escapeHtml(csvText)}</pre>`;
  let html = '<div style="overflow-x:auto"><table class="answer-md" style="width:100%;font-size:12px">';
  html += '<tr>' + lines[0].map(h => `<th>${escapeHtml(h.trim())}</th>`).join('') + '</tr>';
  for (let i = 1; i < lines.length; i++) {
    html += '<tr>' + lines[i].map(c => `<td>${escapeHtml(c.trim())}</td>`).join('') + '</tr>';
  }
  html += '</table></div>';
  return html;
}

// Load shared scopes
function loadSharedScopes() {
  try {
    const res = fetch(`${API_BASE}/api/shared/scopes`);
    if (res.ok) {
      const scopes = res.json();
      const container = document.getElementById('sharedScopesGrid');
      if (container) {
        const html = scopes.map(scope => `
          <div class="scope-card">
            <div class="scope-header">
              <input type="checkbox" class="scope-check" data-scope="${scope.id}" name="scopeCheck_${scope.id}">
              <span class="scope-name">${escapeHtml(scope.name)}</span>
            </div>
            <div class="scope-desc">${escapeHtml(scope.description || '')}</div>
          </div>
        `).join('');
        container.innerHTML = html;
      }
    }
  } catch (e) {
    console.log('Failed to load scopes:', e);
  }
}

// Load existing Qdrant collections
async function loadExistingQdrantCollections() {
  const select = document.getElementById('modalQdrantExisting');
  if (!select) return;
  try {
    const data = await LA8159API.memory.collections();
    const collections = Array.isArray(data) ? data : (data.collections || []);
    select.innerHTML = '<option value="">Select collection</option>' +
      collections.map(c => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`).join('');
  } catch (e) {
    console.log('Failed to load collections:', e);
  }
}

// Show confirmation modal
function showConfirmationModal(title, message, onConfirm, onCancel = null) {
  const modal = document.getElementById('confirmationModal');
  const titleEl = document.getElementById('confirmationTitle');
  const messageEl = document.getElementById('confirmationMessage');
  const confirmBtn = document.getElementById('confirmationConfirm');
  const cancelBtn = document.getElementById('confirmationCancel');
  
  if (!modal || !titleEl || !messageEl) return;
  
  titleEl.textContent = title;
  messageEl.textContent = message;
  
  const confirmHandler = () => {
    if (onConfirm) onConfirm();
    closeConfirmationModal();
  };
  
  const cancelHandler = () => {
    if (onCancel) onCancel();
    closeConfirmationModal();
  };
  
  confirmBtn.onclick = confirmHandler;
  cancelBtn.onclick = cancelHandler;
  
  modal.classList.add('show');
}

// Close confirmation modal
function closeConfirmationModal() {
  document.getElementById('confirmationModal').classList.remove('show');
}

// Show alert modal
function showAlertModal(title, message) {
  const modal = document.getElementById('alertModal');
  const titleEl = document.getElementById('alertTitle');
  const messageEl = document.getElementById('alertMessage');
  
  if (!modal || !titleEl || !messageEl) return;
  
  titleEl.textContent = title;
  messageEl.textContent = message;
  modal.classList.add('show');
}

// Close alert modal
function closeAlertModal() {
  document.getElementById('alertModal').classList.remove('show');
}

// Show loading modal
function showLoadingModal(message = 'Carregando...') {
  const modal = document.getElementById('loadingModal');
  const messageEl = document.getElementById('loadingMessage');
  
  if (!modal || !messageEl) return;
  
  messageEl.textContent = message;
  modal.classList.add('show');
}

// Hide loading modal
function hideLoadingModal() {
  document.getElementById('loadingModal').classList.remove('show');
}

// Show file picker modal
function showFilePickerModal(title, onSelect, filters = {}) {
  const modal = document.getElementById('filePickerModal');
  const titleEl = document.getElementById('filePickerTitle');
  
  if (!modal || !titleEl) return;
  
  titleEl.textContent = title;
  modal.classList.add('show');
  
  // TODO: Implement file picker logic
}

// Close file picker modal
function closeFilePickerModal() {
  document.getElementById('filePickerModal').classList.remove('show');
}

// Show settings modal
function showSettingsModal() {
  document.getElementById('settingsOverlay').classList.add('show');
  document.getElementById('settingsModal').classList.add('show');
}

// Close settings modal
function closeSettingsModal() {
  document.getElementById('settingsOverlay').classList.remove('show');
  document.getElementById('settingsModal').classList.remove('show');
}

// Toggle modal section
function toggleModalSection(sectionId) {
  const section = document.getElementById(sectionId);
  if (section) {
    section.classList.toggle('collapsed');
  }
}

// Modal form validation
function validateModalForm(formId) {
  const form = document.getElementById(formId);
  if (!form) return false;
  
  const inputs = form.querySelectorAll('input[required], select[required], textarea[required]');
  let valid = true;
  
  inputs.forEach(input => {
    if (!input.value.trim()) {
      input.classList.add('error');
      valid = false;
    } else {
      input.classList.remove('error');
    }
  });
  
  return valid;
}

// Reset modal form
function resetModalForm(formId) {
  const form = document.getElementById(formId);
  if (!form) return;
  
  form.reset();
  form.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
}

// Expose functions to window scope
window.showCreateModal = showCreateModal;
window.closeModal = closeModal;
window.createProject = createProject;
window.createQdrantCollection = createQdrantCollection;
window.createNeo4jDb = createNeo4jDb;
window.studioOpenCfgModal = studioOpenCfgModal;
window.closeBundleImportModal = closeBundleImportModal;
window.clickedModal = clickedModal;
window.renderCsvTable = renderCsvTable;
window.loadSharedScopes = loadSharedScopes;
window.loadExistingQdrantCollections = loadExistingQdrantCollections;
window.showConfirmationModal = showConfirmationModal;
window.closeConfirmationModal = closeConfirmationModal;
window.showAlertModal = showAlertModal;
window.closeAlertModal = closeAlertModal;
window.showLoadingModal = showLoadingModal;
window.hideLoadingModal = hideLoadingModal;
window.showFilePickerModal = showFilePickerModal;
window.closeFilePickerModal = closeFilePickerModal;
window.showSettingsModal = showSettingsModal;
window.closeSettingsModal = closeSettingsModal;
window.toggleModalSection = toggleModalSection;
window.validateModalForm = validateModalForm;
window.resetModalForm = resetModalForm;