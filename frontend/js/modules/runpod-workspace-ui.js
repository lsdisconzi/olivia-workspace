/**
 * Olivia CEL RunPod Workspace UI Module
 * Version 1.0 · July 2026
 */

(function () {
  'use strict';

  // Configuration
  var config = {
    apiBaseUrl: '/api/runpod',
    logEndpoint: '/api/runpod/logs',
    autoFetchGpus: true,
    showCostEstimate: true,
    modalOpen: false,
    apiKey: null
  };

  // State
  var state = {
    currentStep: 1,
    gpus: [],
    workspaceId: null,
    deploymentStatus: null
  };

  // Initialize the RunPod UI
  function init(options) {
    Object.assign(config, options);

    // Create FAB if not exists
    createFAB();

    // Create modal HTML
    createModal();

    // Create dashboard HTML
    createDashboard();

    // Load GPU options if enabled
    if (config.autoFetchGpus) {
      fetchGPUOptions();
    }

    // Attach event listeners
    attachEvents();
  }

  // Create Floating Action Button
  function createFAB() {
    var fab = document.createElement('button');
    fab.id = 'runpod-fab';
    fab.className = 'ep-gear';
    fab.setAttribute('aria-label', 'RunPod Workspace Configuration');
    fab.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">' +
      '<rect x="2" y="3" width="20" height="18" rx="2" />' +
      '<path d="M6 8h12M6 12h8M6 16h10" />' +
      '</svg>';
    fab.onclick = function () {
      openModal();
    };
    document.body.appendChild(fab);
  }

  // Create workspace configuration modal
  function createModal() {
    var modal = document.createElement('div');
    modal.id = 'runpod-workspace-modal';
    modal.className = 'ep-modal hidden';
    modal.innerHTML = getModalHTML();
    document.body.appendChild(modal);
  }

  // Create dashboard overlay
  function createDashboard() {
    var dashboard = document.createElement('div');
    dashboard.id = 'runpod-dashboard';
    dashboard.className = 'ep-dashboard';
    dashboard.innerHTML = getDashboardHTML();
    document.body.appendChild(dashboard);
  }

  // Modal HTML template
  function getModalHTML() {
    return '<div class="ep-modal-backdrop" onclick="RunPodUI.closeModal()"></div>' +
      '<div class="ep-modal-content">' +
      '<div class="ep-modal-header">' +
      '<h2>Deploy to Cloud Workspace</h2>' +
      '<button class="ep-close-btn" onclick="RunPodUI.closeModal()">×</button>' +
      '</div>' +
      getStepHTML(1) +
      getStepHTML(2) +
      getStepHTML(3) +
      getStepHTML(4) +
      '</div>';
  }

  // Dashboard HTML template
  function getDashboardHTML() {
    return '<div class="ep-dashboard-header">' +
      '<h2>Your Workspaces</h2>' +
      '<button class="ep-close-btn" onclick="RunPodUI.closeDashboard()">×</button>' +
      '</div>' +
      '<div class="ep-dashboard-content">' +
      '<div class="ep-section">' +
      '<h3>Running</h3>' +
      '<div id="ws-active-list" class="ep-workspace-list">No active workspaces</div>' +
      '</div>' +
      '<div class="ep-section">' +
      '<h3>Recent</h3>' +
      '<div id="ws-recent-list" class="ep-workspace-list">No recent workspaces</div>' +
      '</div>' +
      '</div>';
  }

  // Step HTML templates
  function getStepHTML(step) {
    switch (step) {
      case 1: return getStep1HTML();
      case 2: return getStep2HTML();
      case 3: return getStep3HTML();
      case 4: return getStep4HTML();
      default: return '';
    }
  }

  function getStep1HTML() {
    return '<div class="ep-tab-content active" data-step="1">' +
      '<div class="ep-form-group">' +
      '<label>Repository URL</label>' +
      '<input type="text" id="ws-git-url" placeholder="https://github.com/user/project" class="ep-input">' +
      '</div>' +
      '<div class="ep-form-group">' +
      '<label>Branch (optional)</label>' +
      '<input type="text" id="ws-branch" placeholder="main" value="main" class="ep-input">' +
      '</div>' +
      '<div class="ep-btn-group">' +
      '<button class="ep-btn-secondary" onclick="RunPodUI.closeModal()">Cancel</button>' +
      '<button class="ep-btn-primary" onclick="RunPodUI.nextStep(2)">Next: Hardware</button>' +
      '</div>' +
      '</div>';
  }

  function getStep2HTML() {
    return '<div class="ep-tab-content" data-step="2">' +
      '<div class="ep-form-group">' +
      '<label>GPU Type</label>' +
      '<select id="ws-gpu-type" class="ep-select">' +
      '<option value="RTX_4090">NVIDIA RTX 4090 (24GB) - $0.79/hr</option>' +
      '<option value="RTX_A6000">NVIDIA RTX A6000 (48GB) - $0.59/hr</option>' +
      '<option value="A100_80GB">NVIDIA A100 80GB - $1.29/hr</option>' +
      '<option value="H100_PCIE">NVIDIA H100 PCIe (80GB) - $2.19/hr</option>' +
      '</select>' +
      '</div>' +
      '<div class="ep-form-row">' +
      '<div class="ep-form-group">' +
      '<label>GPU Count</label>' +
      '<input type="number" id="ws-gpu-count" min="1" max="8" value="1" class="ep-input">' +
      '</div>' +
      '<div class="ep-form-group">' +
      '<label>Disk Size (GB)</label>' +
      '<input type="number" id="ws-disk-size" min="20" max="500" value="20" class="ep-input">' +
      '</div>' +
      '</div>' +
      '<div class="ep-btn-group">' +
      '<button class="ep-btn-secondary" onclick="RunPodUI.prevStep(1)">Back</button>' +
      '<button class="ep-btn-primary" onclick="RunPodUI.nextStep(3)">Next: Ports</button>' +
      '</div>' +
      '</div>';
  }

  function getStep3HTML() {
    return '<div class="ep-tab-content" data-step="3">' +
      '<div class="ep-form-group">' +
      '<label>Exposed Ports</label>' +
      '<input type="text" id="ws-ports" placeholder="8888/http, 8080/http" class="ep-input" value="8888/http">' +
      '<small class="ep-help">Comma-separated: port/protocol (http/tcp)</small>' +
      '</div>' +
      '<div class="ep-form-group">' +
      '<label>Build Command</label>' +
      '<textarea id="ws-build-command" placeholder="pip install -r requirements.txt && python app.py" class="ep-textarea"></textarea>' +
      '</div>' +
      '<div class="ep-btn-group">' +
      '<button class="ep-btn-secondary" onclick="RunPodUI.prevStep(2)">Back</button>' +
      '<button class="ep-btn-primary" onclick="RunPodUI.nextStep(4)">Next: Review</button>' +
      '</div>' +
      '</div>';
  }

  function getStep4HTML() {
    return '<div class="ep-tab-content" data-step="4">' +
      '<div class="ep-summary-card">' +
      '<h3>Summary</h3>' +
      '<div class="ep-summary-row">' +
      '<span>GPU:</span>' +
      '<strong id="summary-gpu">RTX 4090 ×1</strong>' +
      '</div>' +
      '<div class="ep-summary-row">' +
      '<span>Disk:</span>' +
      '<strong id="summary-disk">20 GB</strong>' +
      '</div>' +
      '<div class="ep-summary-row">' +
      '<span>Estimated Cost:</span>' +
      '<strong id="summary-cost">$0.79 / hour</strong>' +
      '</div>' +
      '</div>' +
      '<div class="ep-btn-group">' +
      '<button class="ep-btn-secondary" onclick="RunPodUI.prevStep(3)">Back</button>' +
      '<button class="ep-btn-primary ep-btn-deploy" onclick="RunPodUI.deployWorkspace()">Deploy Workspace</button>' +
      '</div>' +
      '</div>';
  }

  // Navigation functions
  function openModal(gitUrl) {
    state.currentStep = 1;
    var modal = document.getElementById('runpod-workspace-modal');
    modal.classList.remove('hidden');
    config.modalOpen = true;

    if (gitUrl) {
      document.getElementById('ws-git-url').value = gitUrl;
    }

    updateStepDisplay();
  }

  function closeModal() {
    var modal = document.getElementById('runpod-workspace-modal');
    modal.classList.add('hidden');
    config.modalOpen = false;
  }

  function nextStep(step) {
    state.currentStep = step;
    updateStepDisplay();

    if (step === 4) {
      updateSummary();
    }
  }

  function prevStep(step) {
    state.currentStep = step;
    updateStepDisplay();
  }

  // Update step display
  function updateStepDisplay() {
    var tabs = document.querySelectorAll('.ep-tab-content');
    tabs.forEach(function (tab) {
      if (parseInt(tab.dataset.step) === state.currentStep) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });
  }

  // Update summary with current selections
  function updateSummary() {
    var gpuType = document.getElementById('ws-gpu-type').value;
    var gpuCount = document.getElementById('ws-gpu-count').value;
    var diskSize = document.getElementById('ws-disk-size').value;

    document.getElementById('summary-gpu').textContent = gpuType.replace('_', ' ') + ' ×' + gpuCount;
    document.getElementById('summary-disk').textContent = diskSize + ' GB';
    document.getElementById('summary-cost').textContent = '$0.79 / hour'; // Will be calculated
  }

  // Fetch GPU options from API
  async function fetchGPUOptions() {
    try {
      var response = await fetch(config.apiBaseUrl + '/gpus');
      var gpus = await response.json();
      state.gpus = gpus;
      populateGPUSelect(gpus);
    } catch (error) {
      console.error('Failed to fetch GPU options:', error);
    }
  }

  // Populate GPU select dropdown
  function populateGPUSelect(gpus) {
    var select = document.getElementById('ws-gpu-type');
    if (select && gpus.length > 0) {
      select.innerHTML = gpus.map(function (gpu) {
        return '<option value="' + gpu.name + '">' + gpu.name + ' (' + gpu.vramGb + 'GB) - $' + gpu.pricePerHour + '/hr</option>';
      }).join('');
    }
  }

  // Deploy workspace
  async function deployWorkspace() {
    var spec = {
      gitUrl: document.getElementById('ws-git-url').value,
      branch: document.getElementById('ws-branch').value || 'main',
      gpuType: document.getElementById('ws-gpu-type').value,
      gpuCount: parseInt(document.getElementById('ws-gpu-count').value),
      diskSizeGb: parseInt(document.getElementById('ws-disk-size').value),
      exposedPorts: document.getElementById('ws-ports').value.split(',').map(function (p) { return p.trim(); }),
      buildCommand: document.getElementById('ws-build-command').value,
      envVars: {}
    };

    // Include API key if available (for multi-user support)
    var requestBody = spec;
    if (config.apiKey) {
      requestBody = { apiKey: config.apiKey, spec: spec };
    }

    try {
      var response = await fetch(config.apiBaseUrl + '/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      var workspace = await response.json();
      state.workspaceId = workspace.providerId;

      closeModal();
      showDashboard();
      pollWorkspaceStatus(workspace.providerId);
    } catch (error) {
      console.error('Failed to deploy workspace:', error);
      alert('Deployment failed: ' + error.message);
    }
  }

  // Poll workspace status
  async function pollWorkspaceStatus(workspaceId) {
    var interval = setInterval(async function () {
      try {
        var response = await fetch(config.apiBaseUrl + '/workspaces/' + workspaceId + '/status');
        var status = await response.json();
        state.deploymentStatus = status;
        updateDashboardStatus(status);

        if (status.state === 'running' || status.state === 'error') {
          clearInterval(interval);
        }
      } catch (error) {
        console.error('Failed to fetch status:', error);
      }
    }, 3000);
  }

  // Show dashboard
  function showDashboard() {
    var dashboard = document.getElementById('runpod-dashboard');
    dashboard.classList.add('open');
  }

  function closeDashboard() {
    var dashboard = document.getElementById('runpod-dashboard');
    dashboard.classList.remove('open');
  }

  // Update dashboard status display
  function updateDashboardStatus(status) {
    // Will be implemented to update workspace cards
    console.log('Workspace status:', status);
  }

  // Attach event listeners
  function attachEvents() {
    // Close modal on escape
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && config.modalOpen) {
        closeModal();
      }
    });
  }

  // Public API
  window.RunPodUI = {
    init: init,
    openModal: openModal,
    closeModal: closeModal,
    nextStep: nextStep,
    prevStep: prevStep,
    deployWorkspace: deployWorkspace,
    closeDashboard: closeDashboard
  };

  // Auto-initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      init();
    });
  } else {
    init();
  }
})();
