// ═══════════════════════════════════════════════════════════════════
// OliviaLegal Desktop — Preload bridge (context-isolated)
// ═══════════════════════════════════════════════════════════════════
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),

  // Maximize state (async)
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),

  // Event: window maximize state changed
  onMaximizeChange: (callback) => {
    ipcRenderer.on('window:maximize-change', (_event, isMaximized) => {
      callback(isMaximized);
    });
  },

  // Platform
  platform: process.platform,
});
