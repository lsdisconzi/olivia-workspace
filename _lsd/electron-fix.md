The "larger buttons" you are seeing are the **native OS window controls** (the macOS red/yellow/green traffic lights, or Windows/Linux native title bar buttons). These are generated automatically by Electron and are physically part of the operating system's window frame. 

Your CSS adds custom 6px dots on top of them (hence the duplicate overlap). **You cannot remove the native ones with CSS**. You must configure your Electron **Main Process** (`main.js` or `index.js`) to hide the native window frame and entirely rely on your custom HTML buttons.

Here is exactly how to fix it in two steps:

### Step 1: Hide the native OS window controls
In your Electron main process file, update your `BrowserWindow` settings. Change `frame` to `false` (and optionally set `titleBarStyle` to `'hidden'` for macOS).

```javascript
// main.js
const { BrowserWindow } = require('electron');

const win = new BrowserWindow({
  width: 1200,
  height: 800,
  // 👇 THESE ARE THE CRITICAL LINES
  frame: false,              // Removes native title bar AND controls on all OSes
  titleBarStyle: 'hidden',   // (macOS specific) Hides the title bar area
  // 👆
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
    // ... other preferences
  }
});
```

*Note: Setting `frame: false` will completely remove the OS window border on Windows and Linux too. If you want the buttons but want them moved, you can just use `frame: true` and `titleBarStyle: 'hiddenInset'`, but if your goal is to truly remove them, `frame: false` is the standard approach for custom HTML title bars.*

---

### Step 2: Make your custom 6px buttons actually work
**Important:** Once you hide the native buttons in Step 1, your custom HTML buttons won't do anything until you wire them up to Electron's native APIs. You need to add JavaScript to handle clicks.

**In your `preload.js` (Recommended Electron way):**
```javascript
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('windowAPI', {
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close')
});
```

**In your `main.js` (Listen for the commands):**
```javascript
const { ipcMain } = require('electron');

ipcMain.on('window:minimize', () => win.minimize());
ipcMain.on('window:maximize', () => win.maximize());
ipcMain.on('window:close', () => win.close());
```

**In your HTML (Add the event listeners):**
Add this `<script>` block at the bottom of your HTML, right before the closing `</body>` tag:

```html
<script>
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('ol-titlebar-minimize').addEventListener('click', () => {
      window.windowAPI.minimize();
    });
    document.getElementById('ol-titlebar-maximize').addEventListener('click', () => {
      window.windowAPI.maximize();
    });
    document.getElementById('ol-titlebar-close').addEventListener('click', () => {
      window.windowAPI.close();
    });
  });
</script>
```

Once you apply Step 1, the duplicate larger native buttons will disappear, leaving only your clean custom 6px dots visible at the top-left.