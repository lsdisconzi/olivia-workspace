// ═══════════════════════════════════════════════════════════════════
// Olivia Desktop — Electron main process
// ═══════════════════════════════════════════════════════════════════
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// GPU / WebGL availability strategy.
// A real GPU process is required for WebGL (the 3D shader scenes use Three.js).
// The GPU process is also the thing that SIGTRAP-crashes inside headless /
// container environments (no display, no DRM device). So:
//   - In a headless/container context we keep hardware acceleration DISABLED
//     (avoids the shutdown crash) and rely on the frontend's 2D fallback.
//   - On a normal desktop we leave acceleration ON and pass SwiftShader flags
//     so WebGL still works even if the system GPU is unavailable.
const _isHeadlessContainer = (() => {
  if (process.argv.includes('--headless')) return true;
  if (process.platform === 'linux' && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) return true;
  return false;
})();

if (_isHeadlessContainer) {
  // No display → no GPU process. Disabling acceleration prevents the
  // SIGTRAP crash on shutdown; the app falls back to 2D scene rendering.
  app.disableHardwareAcceleration();
} else {
  // Desktop with a display: keep the NATIVE GPU backend (Metal on macOS,
  // GL on Linux/X11) so WebGL works through the normal driver path.
  // Do not force a software ANGLE/SwiftShader backend, because that can
  // disable the real WebGL pipeline instead of enabling it. We only allow
  // Chromium to fall back to software WebGL when the GPU is absent and
  // ignore any GPU blocklist.
  app.commandLine.appendSwitch('ignore-gpu-blocklist');
}

// ── CLI argument parsing ─────────────────────────────────────────────
function parseArgs() {
  const args = {};
  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === '--port' && process.argv[i + 1]) {
      args.port = parseInt(process.argv[i + 1], 10);
      i++;
    } else if (process.argv[i] === '--devtools') {
      args.devtools = true;
    } else if (process.argv[i] === '--url' && process.argv[i + 1]) {
      args.url = process.argv[i + 1];
      i++;
    }
  }
  return args;
}

const cli = parseArgs();
const PORT = cli.port || process.env.Olivia_PORT || 3229;
const APP_URL = cli.url || `http://localhost:${PORT}/olivia/`;
const DEVTOOLS = cli.devtools || false;

// ── Explicit Content-Security-Policy ───────────────────────────────
// Declaring a policy explicitly silences Electron's "no CSP / unsafe-eval"
// warning and removes the default permissive baseline. The app loads the
// workspace from the local HTTP server (serve.py, which sets no CSP of its
// own), so we scope the policy to localhost + the built-in fallback
// page. `unsafe-eval`/`unsafe-inline` are required by the Electron
// fallback page (inline onclick) and main.js executeJavaScript() titlebar
// injection; tighten further only after those are refactored out.
const CSP = [
  "default-src 'self'",
  `connect-src 'self' http://localhost:${PORT} http://127.0.0.1:${PORT} ws://localhost:${PORT} ws://127.0.0.1:${PORT}`,
  "img-src 'self' data: blob: http://localhost:* http://127.0.0.1:*",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
  "font-src 'self' data:",
  "frame-src 'self'",
].join('; ');

// ── Single instance lock ──────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}

app.on('second-instance', () => {
  const win = BrowserWindow.getAllWindows()[0];
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

// ── Window creation ──────────────────────────────────────────────────
let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,              // removes native title bar + traffic lights on all OSes
    backgroundColor: '#0d1117',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Apply an explicit Content-Security-Policy so we don't fall back to
  // Electron's default (which permits unsafe-eval and trips the
  // "Insecure Content-Security-Policy" renderer warning).
  try {
    mainWindow.webContents.session.setCSP(CSP);
  } catch (_) { }

  // Try loading the server URL; fall back to built-in waiting page on failure
  loadAppOrFallback();

  // Notify renderer when maximize state changes
  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('window:maximize-change', true);
  });
  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window:maximize-change', false);
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (DEVTOOLS) {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  });

  // Inject custom titlebar after every committed navigation.
  // 'did-navigate' fires after the URL has fully changed (including JS-driven
  // redirects like mode-select → workspace), so we never inject into a page
  // that is about to navigate away immediately.
  mainWindow.webContents.on('did-navigate', (_event, url) => {
    if (url.startsWith('chrome')) return;
    injectTitleBar(mainWindow);
  });
  // Also cover in-page navigations (hash changes, history.pushState)
  mainWindow.webContents.on('did-navigate-in-page', (_event, url, isMainFrame) => {
    if (!isMainFrame) return;
    if (url.startsWith('chrome')) return;
    injectTitleBar(mainWindow);
  });
  // Also hook dom-ready to be robust against timing issues on initial load
  mainWindow.webContents.on('dom-ready', () => {
    const url = mainWindow.webContents.getURL();
    if (url.startsWith('chrome')) return;
    injectTitleBar(mainWindow);
  });
  // Also hook did-finish-load just in case
  let hasReloaded = false;
  mainWindow.webContents.on('did-finish-load', () => {
    const url = mainWindow.webContents.getURL();
    // Quick fix: The titlebar works reliably after a reload.
    // Trigger a single reload on the first successful app load.
    if (!hasReloaded && !url.includes('waiting.html')) {
      hasReloaded = true;
      mainWindow.webContents.reload();
      return;
    }

    if (url.startsWith('chrome')) return;
    injectTitleBar(mainWindow);
  });

  // Handle page load failures gracefully
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    // Only show fallback for the main app URL failures
    if (validatedURL === APP_URL || validatedURL.startsWith(APP_URL)) {
      console.log(`Failed to load ${validatedURL}: ${errorDescription} (code ${errorCode})`);
      const waitingPath = path.join(__dirname, 'src', 'renderer', 'waiting.html');
      if (fs.existsSync(waitingPath)) {
        mainWindow?.loadFile(waitingPath, { query: { port: String(PORT) } });
      }
    }
  });

  // Allow the waiting page to trigger a retry via loadURL
  mainWindow.webContents.on('will-navigate', (_event, url) => {
    // Only allow navigation back to the app URL
    if (url.startsWith(APP_URL)) return;
    // Block all other navigations
    _event.preventDefault();
  });

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function loadAppOrFallback() {
  // Quick connectivity check before loading the URL
  const http = require('http');
  const req = http.get(`http://127.0.0.1:${PORT}/api/health`, { timeout: 3000 }, (res) => {
    if (res.statusCode >= 200 && res.statusCode < 500) {
      mainWindow?.loadURL(APP_URL);
    } else {
      loadFallback('Server returned status ' + res.statusCode);
    }
    res.resume();
  });
  req.on('error', () => {
    loadFallback('Server not reachable on port ' + PORT);
  });
  req.on('timeout', () => {
    req.destroy();
    loadFallback('Connection timed out on port ' + PORT);
  });
}

function loadFallback(reason) {
  console.log('Server not ready: ' + reason);
  const waitingPath = path.join(__dirname, 'src', 'renderer', 'waiting.html');
  if (fs.existsSync(waitingPath)) {
    mainWindow?.loadFile(waitingPath, { query: { port: String(PORT), reason } });
  } else {
    // Minimal inline fallback
    mainWindow?.loadURL(`data:text/html,<html><body style="background:#0d1117;color:#e6edf3;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center"><h2>Olivia</h2><p>Server not reachable on port ${PORT}</p><p style="color:#8b949e">Run <code>./runtime/start-all.sh</code> first</p><button onclick="window.location.href='${APP_URL}'" style="padding:8px 16px;background:#d4a72c;border:none;border-radius:6px;color:#0d1117;cursor:pointer;font-size:14px">Retry</button></div></body></html>`);
  }
}

// ── Title bar injection ───────────────────────────────────────────────
function injectTitleBar(win) {
  const titlebarPath = path.join(__dirname, 'src', 'renderer', 'titlebar.html');
  const stylePath = path.join(__dirname, 'src', 'renderer', 'style.css');

  let titlebarHTML = '';
  let titlebarCSS = '';

  try { titlebarHTML = fs.readFileSync(titlebarPath, 'utf-8'); } catch (_) { }
  try { titlebarCSS = fs.readFileSync(stylePath, 'utf-8'); } catch (_) { }

  if (titlebarCSS) {
    win.webContents.insertCSS(titlebarCSS);
  }

  if (!titlebarHTML) return;

  // Escape for JS string
  const escaped = titlebarHTML
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$');

  win.webContents.executeJavaScript(`
    (function() {
      console.log('[TitleBar] Injected script started');
      // ── helpers ──────────────────────────────────────────────────
      function _olCreateBar() {
        try {
          console.log('[TitleBar] Creating bar...');
          const bar = document.createElement('div');
          bar.id = 'ol-titlebar';
          bar.innerHTML = \`${escaped}\`;
          bar.setAttribute('data-platform', '${process.platform}');
          document.documentElement.appendChild(bar);
          document.body.style.paddingTop = '14px';
          // Wire buttons via electronAPI
          const minBtn = bar.querySelector('#ol-titlebar-minimize');
          const maxBtn = bar.querySelector('#ol-titlebar-maximize');
          const closeBtn = bar.querySelector('#ol-titlebar-close');
          if (minBtn)   minBtn.onclick   = () => window.electronAPI?.minimize();
          if (maxBtn)   maxBtn.onclick   = () => window.electronAPI?.maximize();
          if (closeBtn) closeBtn.onclick = () => window.electronAPI?.close();

          if (window.electronAPI?.onMaximizeChange) {
            window.electronAPI.onMaximizeChange((isMax) => {
              const svg = maxBtn?.querySelector('svg');
              if (svg) {
                svg.innerHTML = isMax
                  ? '<rect x="6" y="6" width="10" height="10" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M9 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2" fill="none" stroke="currentColor" stroke-width="1.5"/>'
                  : '<rect x="4" y="6" width="14" height="10" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.5"/>';
              }
            });
          }
          console.log('[TitleBar] Bar created successfully');
        } catch (e) {
          console.error('[TitleBar] Failed to create bar:', e);
        }
      }

      function _olEnsureBar() {
        if (!document.body) {
          console.log('[TitleBar] _olEnsureBar: no body yet');
          return;
        }
        if (!document.getElementById('ol-titlebar')) {
          _olCreateBar();
        } else {
          // Ensure padding is maintained if SPA resets body styles
          if (document.body.style.paddingTop !== '14px') {
            document.body.style.paddingTop = '14px';
          }
        }
      }

      // ── initial injection ─────────────────────────────────────────
      _olEnsureBar();

      // ── polling guard: keep the bar alive for the first 10 s ─────
      // This covers the case where the SPA wipes the DOM after did-navigate
      // fires. We stop polling once the bar has been stable for 10 s.
      if (window.__olTitlebarPoller) {
        clearInterval(window.__olTitlebarPoller);
      }
      const _olStart = Date.now();
      window.__olTitlebarPoller = setInterval(function() {
        if (Date.now() - _olStart > 10000) {
          clearInterval(window.__olTitlebarPoller);
          window.__olTitlebarPoller = null;
          console.log('[TitleBar] Poller finished (10s elapsed)');
          return;
        }
        _olEnsureBar();
      }, 200);
      console.log('[TitleBar] Poller started');
    })();
  `).catch(err => {
    console.error('Failed to inject title bar script:', err);
  });
}

// ── IPC handlers ──────────────────────────────────────────────────────
ipcMain.on('window:minimize', () => {
  mainWindow?.minimize();
});

ipcMain.on('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

ipcMain.on('window:close', () => {
  mainWindow?.close();
});

ipcMain.handle('window:isMaximized', () => {
  return mainWindow?.isMaximized() ?? false;
});

// ── App lifecycle ────────────────────────────────────────────────────
app.whenReady().then(() => {
  // Dev mode only: packaged builds get their icon from the .app bundle,
  // but `npm start` would otherwise show the default Electron icon.
  if (!app.isPackaged && process.platform === 'darwin') {
    const devIcon = path.join(__dirname, 'build', 'icon.png');
    if (fs.existsSync(devIcon)) app.dock.setIcon(devIcon);
  }
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
