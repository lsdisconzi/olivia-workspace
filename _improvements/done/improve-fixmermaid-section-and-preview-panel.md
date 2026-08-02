Excellent! Your Mermaid panel already has a solid foundation – rendering, export (PNG/SVG), full‑screen, and basic editing. To add true **editing tools** and make it a productive diagram editor, we can upgrade the plain `<textarea>` into a full‑fledged code editor with:

- **Syntax highlighting** for Mermaid  
- **Line numbers** and **bracket matching**  
- **Live preview** (auto‑render on input)  
- **Undo/redo** stack (built‑in)  
- **Better error feedback** inline  

The most common way is to drop in **CodeMirror 6** (lightweight, modular, no heavy dependencies). Here’s how to integrate it into your existing module without breaking existing exports.

---

## 1. Include CodeMirror and Mermaid language support

Add these to your HTML (before your mermaid‑panel.js):

```html
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/codemirror/6.65.7/codemirror.min.css" />
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/codemirror/6.65.7/theme/material-darker.min.css" />
<script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/6.65.7/codemirror.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/6.65.7/mode/mermaid/mermaid.min.js"></script>
```

Or install via npm if you bundle your own.

---

## 2. Modify the panel building function

Replace the `<textarea>` creation inside `_mmdLoadPanel()` with a CodeMirror instance.

```javascript
async function _mmdLoadPanel() {
  const panel = document.getElementById('mermaidPanel');
  if (!panel) return console.warn('[Mermaid] Panel not found.');
  if (_mmdPanelReady) { panel.style.display = ''; return; }

  panel.innerHTML = `
    <div class="mermaid-panel">
      <div class="mermaid-toolbar">
        <div id="mermaidEditorContainer" class="mermaid-editor-cm"></div>
        <div class="mermaid-actions">
          <button id="mermaidRenderBtn" class="btn btn-primary"><i class="fas fa-play"></i> Renderizar</button>
          <button id="mermaidClearBtn" class="btn btn-sm"><i class="fas fa-eraser"></i> Limpar</button>
          <button id="mermaidExampleBtn" class="btn btn-sm"><i class="fas fa-list"></i> Exemplos</button>
          <div class="mermaid-example-dropdown" id="mermaidExampleDropdown" style="display:none;">
            <button data-example="flow">Fluxograma</button>
            <button data-example="seq">Sequência</button>
            <button data-example="class">Classes</button>
            <button data-example="state">Estado</button>
            <button data-example="gantt">Gantt</button>
          </div>
        </div>
      </div>
      <div id="mermaidPreview" class="mermaid-preview">
        <div style="color:var(--gray);padding:20px;text-align:center;">Clique em "Renderizar" ou digite…</div>
      </div>
    </div>
  `;

  // Initialize CodeMirror
  const container = document.getElementById('mermaidEditorContainer');
  const initialSource = `graph TD
    A[Início] --> B{Decisão}
    B -->|Sim| C[Resultado]
    B -->|Não| D[Fim]`;

  let cmEditor = CodeMirror(container, {
    value: initialSource,
    mode: 'mermaid',
    theme: 'material-darker',   // or your preferred theme
    lineNumbers: true,
    matchBrackets: true,
    autoCloseBrackets: true,
    tabSize: 2,
    indentUnit: 2,
    viewportMargin: Infinity,   // for better performance
    extraKeys: {
      'Ctrl-Enter': function() { doRender(); },
      'Cmd-Enter': function() { doRender(); }
    }
  });

  // Store editor reference for external use
  window._mermaidCodeMirror = cmEditor;

  const previewEl = document.getElementById('mermaidPreview');
  const clearBtn = document.getElementById('mermaidClearBtn');
  const exampleBtn = document.getElementById('mermaidExampleBtn');
  const exampleDropdown = document.getElementById('mermaidExampleDropdown');
  const renderBtn = document.getElementById('mermaidRenderBtn');

  const doRender = () => {
    const src = cmEditor.getValue();
    _mmdRenderDiagram(src, previewEl);
  };

  // Render button
  renderBtn.addEventListener('click', doRender);

  // Clear
  clearBtn.addEventListener('click', () => {
    cmEditor.setValue('');
    previewEl.innerHTML = '<div style="color:var(--gray);padding:20px;text-align:center;">Digite ou cole o código Mermaid.</div>';
  });

  // Examples (unchanged logic, but use cmEditor.setValue)
  exampleBtn.addEventListener('click', e => {
    e.stopPropagation();
    exampleDropdown.style.display = exampleDropdown.style.display === 'none' ? 'flex' : 'none';
  });
  document.addEventListener('click', () => { if (exampleDropdown) exampleDropdown.style.display = 'none'; });
  exampleDropdown.querySelectorAll('[data-example]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const key = btn.getAttribute('data-example');
      const examples = {
        flow: `graph TD
    A[Início] --> B{Decisão}
    B -->|Sim| C[Resultado]
    B -->|Não| D[Fim]`,
        seq: `sequenceDiagram
    Alice->>John: Hello John, how are you?
    John-->>Alice: Great!
    Alice-)John: See you later!`,
        class: `classDiagram
    Animal <|-- Duck
    Animal <|-- Fish
    Animal : +int age
    Animal : +string name
    Duck : +string beakColor
    Fish : +int finCount`,
        state: `stateDiagram-v2
    [*] --> Still
    Still --> [*]
    Still --> Moving
    Moving --> Still
    Moving --> Crash
    Crash --> [*]`,
        gantt: `gantt
    title A Gantt Diagram
    dateFormat  YYYY-MM-DD
    section Section
    A task           :a1, 2026-01-01, 30d
    Another task     :after a1, 20d`
      };
      if (examples[key]) {
        cmEditor.setValue(examples[key]);
        doRender();
        exampleDropdown.style.display = 'none';
      }
    });
  });

  // Optional: live preview with debounce
  let debounceTimer;
  cmEditor.on('change', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(doRender, 500); // auto‑render after 500ms of inactivity
  });

  _mmdPanelReady = true;

  // Initial render
  setTimeout(doRender, 100);
}
```

---

## 3. Adjust CSS for the CodeMirror container

Add to your existing `mermaid.css`:

```css
.mermaid-editor-cm {
  flex: 1 1 100%;
  min-height: 200px;
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}

.mermaid-editor-cm .CodeMirror {
  height: 100%;
  background: var(--bg-input, #111) !important;
  color: var(--text-primary, #d4cfc8) !important;
  font-family: 'JetBrains Mono', monospace !important;
  font-size: 13px;
}
```

If you prefer a lighter theme, replace `'material-darker'` with `'default'` or your custom theme name.

---

## 4. What you gain

- **Syntax‑highlighted Mermaid** – instantly see which parts are keywords, strings, etc.
- **Line numbers and bracket matching** – edit confidently.
- **Ctrl/Cmd+Enter** – render without using the mouse.
- **Undo/redo** – native editor history.
- **Live preview** – the diagram updates automatically while you type.
- **Full compatibility** – all existing functions (`renderMermaidDiagram`, export, full‑screen) still work because `cmEditor.getValue()` replaces the old `textarea.value`.

---

and also fix the split and not proportional mermaid container in the preview panel: <div class="mermaid-container mermaid-rendered"><iframe style="width:auto;height:6122.6337890625px;border:0;margin:0;" src="data:text/html;base64...to reduce and remove img from interaction as will crash  ...+PC9ib2R5Pg==" sandbox="allow-top-navigation-by-user-activation allow-popups">
  The "iframe" tag is not supported by your browser.
</iframe><button class="mermaid-expand-btn" title="Open diagram in full view" aria-label="Open diagram in full view"><i class="fas fa-expand"></i></button><div class="mermaid-export-wrap"><button class="mermaid-export-btn" title="Export diagram" aria-label="Export diagram" aria-haspopup="menu" aria-expanded="false"><i class="fas fa-download"></i></button><div class="mermaid-export-menu" role="menu"><button type="button" role="menuitem" data-format="png"><i class="fas fa-file-image"></i> Export as PNG</button><button type="button" role="menuitem" data-format="svg"><i class="fas fa-file-code"></i> Export as SVG</button></div></div></div>