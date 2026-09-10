// User preferences management module
// Shared between index.html and agent.html

(function() {
  'use strict';

  const STORAGE_KEY = 'OliviaLegal.workspace.config';
  const API_KEYS_KEY = 'OliviaLegal.api.keys';
  const USER_PREFS_KEY = 'OliviaLegal.user.preferences';

  // Load user preferences from server, fall back to localStorage
  async function loadUserPrefs() {
    try {
      const response = await fetch('/api/user/preferences', {
        method: 'GET',
        credentials: 'include'
      });
      if (response.ok) {
        const prefs = await response.json();
        // Cache to localStorage
        localStorage.setItem(USER_PREFS_KEY, JSON.stringify(prefs));
        return prefs;
      }
    } catch (err) {
      console.warn('Failed to load user preferences from server:', err);
    }

    // Fallback to localStorage
    try {
      const cached = localStorage.getItem(USER_PREFS_KEY);
      if (cached) return JSON.parse(cached);
    } catch (err) {}

    return {};
  }

  // Save user preferences to server and localStorage
  async function saveUserPrefs(prefs) {
    try {
      const response = await fetch('/api/user/preferences', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs)
      });
      if (response.ok) {
        localStorage.setItem(USER_PREFS_KEY, JSON.stringify(prefs));
        return true;
      }
    } catch (err) {
      console.error('Failed to save user preferences:', err);
    }
    return false;
  }

  // Get active provider (from user prefs or workspace config)
  function getActiveProvider() {
    // Try user preferences first
    try {
      const prefs = JSON.parse(localStorage.getItem(USER_PREFS_KEY) || '{}');
      if (prefs.provider) return prefs.provider;
    } catch (err) {}

    // Fallback to workspace config
    try {
      const config = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      if (config.provider) return config.provider;
    } catch (err) {}

    return 'deepseek';
  }

  // Get active model
  function getActiveModel() {
    try {
      const prefs = JSON.parse(localStorage.getItem(USER_PREFS_KEY) || '{}');
      if (prefs.model) return prefs.model;
    } catch (err) {}

    try {
      const config = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      if (config.model) return config.model;
    } catch (err) {}

    return 'deepseek-flash';
  }

  // Set active model
  async function setModel(model) {
    const prefs = await loadUserPrefs();
    prefs.model = model;
    await saveUserPrefs(prefs);

    // Also update workspace config
    try {
      const config = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      config.model = model;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch (err) {}
  }

  // Get API key for provider
  function getApiKey(provider) {
    try {
      const prefs = JSON.parse(localStorage.getItem(USER_PREFS_KEY) || '{}');
      if (prefs.api_keys && prefs.api_keys[provider]) {
        return prefs.api_keys[provider];
      }
    } catch (err) {}

    try {
      const keys = JSON.parse(localStorage.getItem(API_KEYS_KEY) || '{}');
      return keys[provider] || '';
    } catch (err) {}

    return '';
  }

  // Save API key for provider
  async function saveApiKey(provider, key) {
    const prefs = await loadUserPrefs();
    if (!prefs.api_keys) prefs.api_keys = {};
    prefs.api_keys[provider] = key;
    await saveUserPrefs(prefs);

    // Also save to legacy localStorage for backward compatibility
    try {
      const keys = JSON.parse(localStorage.getItem(API_KEYS_KEY) || '{}');
      keys[provider] = key;
      localStorage.setItem(API_KEYS_KEY, JSON.stringify(keys));
    } catch (err) {}
  }

  // Check if setup is complete
  async function isSetupComplete() {
    const prefs = await loadUserPrefs();
    return prefs.setup_complete === true;
  }

  // Mark setup as complete
  async function markSetupComplete() {
    const prefs = await loadUserPrefs();
    prefs.setup_complete = true;
    await saveUserPrefs(prefs);
  }

  // Sync localStorage workspace config with user preferences
  async function syncWorkspaceConfig() {
    const prefs = await loadUserPrefs();
    const config = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');

    // Merge user prefs into workspace config
    if (prefs.provider) config.provider = prefs.provider;
    if (prefs.model) config.model = prefs.model;
    if (prefs.temperature !== undefined) config.temperature = prefs.temperature;
    if (prefs.max_tokens !== undefined) config.max_tokens = prefs.max_tokens;

    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));

    // Sync API keys
    if (prefs.api_keys) {
      const keys = JSON.parse(localStorage.getItem(API_KEYS_KEY) || '{}');
      Object.assign(keys, prefs.api_keys);
      localStorage.setItem(API_KEYS_KEY, JSON.stringify(keys));
    }
  }

  // Export public API
  window.OliviaUserPrefs = {
    load: loadUserPrefs,
    save: saveUserPrefs,
    getProvider: getActiveProvider,
    getModel: getActiveModel,
    setModel: setModel,
    getApiKey: getApiKey,
    saveApiKey: saveApiKey,
    isSetupComplete: isSetupComplete,
    markSetupComplete: markSetupComplete,
    syncWorkspaceConfig: syncWorkspaceConfig
  };

})();