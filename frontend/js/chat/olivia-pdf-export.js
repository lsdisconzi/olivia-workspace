/**
 * Olivia PDF Export
 * ────────────────────────────────────────────────────────────────────
 * Renders the last assistant/agent response as a branded, print-ready
 * document and opens the browser's native print dialog (Save as PDF).
 *
 * Matches the real Olivia design system used across the workspace:
 *   - Fraunces (display) + Plus Jakarta Sans (body) + JetBrains Mono (labels)
 *   - Cream paper / deep forest green / terracotta amber accents
 *   - The same olive-branch mark used in the sidebar & favicon
 *
 * Depends on helpers defined elsewhere in the app:
 *   - _lastAssistantMessage()  → { role, html }
 *   - addSystemBubble(text)    → shows a small system toast/bubble
 *
 * IDEMPOTENT: this file is safe to load even if stream.js has already
 * declared OLIVIA_PDF_BRAND and downloadLastResponseAsPdf. Uses window
 * assignments (not const) and a load guard to avoid redeclaration errors.
 */

(function() {
  // Guard: skip if already loaded or if stream.js already defined everything
  if (window.__oliviaPdfExportLoaded) return;
  window.__oliviaPdfExportLoaded = true;

  // Guard: if stream.js already exposed the function, skip ALL declarations.
  // stream.js defines const OLIVIA_PDF_BRAND + downloadLastResponseAsPdf()
  // and sets window.downloadLastResponseAsPdf. If we set window.OLIVIA_PDF_BRAND
  // here first, stream.js's const OLIVIA_PDF_BRAND would fail with
  // "Identifier has already been declared". So we must check this FIRST.
  if (typeof window.downloadLastResponseAsPdf === 'function') return;

  // ─── Shared brand kit — reuse this for any other export/print surface ───
  window.OLIVIA_PDF_BRAND = {
    name: 'Olivia',
    kicker: 'Olivia · Workspace Export',
    footerLeft: 'Olivia · AI Operating Environment',
    colors: {
      cream: '#faf9f6',
      ink: '#1a1a1a',
      forestDark: '#1c4532',
      forestMid: '#2d785a',
      amber: '#c4622d',
      amberLight: '#d4733e',
      gray: '#8a8a8a',
      grayHi: '#5a5a5a',
      border: 'rgba(28, 69, 50, 0.14)',
      codeBg: 'rgba(28, 69, 50, 0.05)',
      quoteBg: 'rgba(196, 98, 45, 0.05)',
    },
    // Exact mark used across Olivia surfaces (favicon / sidebar / nav)
    logoSvg: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="8" fill="#1c4532"/>
      <g transform="translate(6,7) scale(0.31)">
        <path d="M12 52 Q24 38,34 30 Q44 22,54 16" fill="none" stroke="#faf9f6" stroke-width="2.5" stroke-linecap="round" opacity=".6"/>
        <path d="M28 36 Q20 26,16 18 Q24 24,28 36Z" fill="#faf9f6" opacity=".4"/>
        <path d="M30 34 Q38 24,44 18 Q38 28,30 34Z" fill="#faf9f6" opacity=".35"/>
        <path d="M42 24 Q36 14,34 8 Q40 14,42 24Z" fill="#faf9f6" opacity=".35"/>
        <ellipse cx="22" cy="42" rx="4" ry="5" fill="#c4622d"/>
      </g>
    </svg>`
  };

  async function downloadLastResponseAsPdf() {
  const msg = _lastAssistantMessage();
  if (!msg) {
    addSystemBubble('Nenhuma resposta do assistente para exportar como PDF');
    return;
  }

  const role = msg.role === 'agent' ? 'Agente' : 'Assistente';
  const html = msg.html || '';

  if (!html) {
    addSystemBubble('A última resposta está vazia');
    return;
  }

  function _escapeHtml(s) {
    return String(s || '').replace(/&/g, '&amp;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  const B = OLIVIA_PDF_BRAND;
  const now = new Date();
  const timestamp = now.toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' });
  const fileDate = now.toISOString().slice(0, 10);
  const title = `Olivia · ${role} · ${fileDate}`;

  const printDoc = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${_escapeHtml(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400&family=Plus+Jakarta+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  @page { margin: 20mm 18mm 22mm; }
  * {
    box-sizing: border-box;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
  }
  body {
    font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
    color: ${B.colors.ink};
    font-size: 11.5pt;
    line-height: 1.65;
    margin: 0;
    background: ${B.colors.cream};
  }
  .brand-accent-bar {
    height: 5px;
    border-radius: 3px;
    background: linear-gradient(90deg, ${B.colors.forestDark} 0%, ${B.colors.forestMid} 55%, ${B.colors.amber} 100%);
    margin-bottom: 22px;
  }
  .brand-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding-bottom: 14px;
    margin-bottom: 24px;
    border-bottom: 1px solid ${B.colors.border};
  }
  .brand-mark { width: 30px; height: 30px; flex: 0 0 auto; }
  .brand-mark svg { width: 100%; height: 100%; display: block; }
  .brand-word { display: flex; flex-direction: column; line-height: 1.25; }
  .brand-name {
    font-family: 'Fraunces', Georgia, serif;
    font-weight: 500;
    font-size: 17pt;
    letter-spacing: -0.01em;
    color: ${B.colors.forestDark};
  }
  .brand-kicker {
    font-family: 'JetBrains Mono', monospace;
    font-size: 7.5pt;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: ${B.colors.amber};
    margin-top: 2px;
  }
  .brand-meta {
    margin-left: auto;
    text-align: right;
    font-family: 'JetBrains Mono', monospace;
    font-size: 8pt;
    letter-spacing: 0.03em;
    color: ${B.colors.grayHi};
    line-height: 1.8;
  }
  .role-tag {
    display: inline-block;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-size: 7.5pt;
    color: ${B.colors.forestDark};
    background: rgba(28, 69, 50, 0.08);
    border: 1px solid ${B.colors.border};
    padding: 3px 10px;
    border-radius: 20px;
  }
  .content { font-size: 11.5pt; line-height: 1.7; }
  .content h1, .content h2, .content h3, .content h4 {
    font-family: 'Fraunces', Georgia, serif;
    font-weight: 500;
    letter-spacing: -0.01em;
    color: ${B.colors.forestDark};
    line-height: 1.3;
    margin: 1.3em 0 0.5em;
    page-break-after: avoid;
    break-after: avoid;
  }
  .content h1 { font-size: 18pt; border-bottom: 1px solid ${B.colors.border}; padding-bottom: 6px; }
  .content h2 { font-size: 15pt; }
  .content h3 { font-size: 13pt; }
  .content p, .content li { margin: 0 0 0.9em; orphans: 3; widows: 3; }
  .content a { color: ${B.colors.forestMid}; text-decoration: underline; }
  .content strong { color: ${B.colors.forestDark}; }
  .content ul, .content ol { margin: 0 0 0.9em; padding-left: 1.4em; }
  .content code {
    font-family: 'JetBrains Mono', monospace;
    background: ${B.colors.codeBg};
    padding: 1px 5px;
    border-radius: 4px;
    font-size: 0.9em;
    color: ${B.colors.forestDark};
  }
  .content pre {
    font-family: 'JetBrains Mono', monospace;
    background: ${B.colors.codeBg};
    border-left: 3px solid ${B.colors.amber};
    padding: 12px 14px;
    border-radius: 0 6px 6px 0;
    overflow: auto;
    font-size: 9.5pt;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .content pre code { background: none; padding: 0; }
  .content blockquote {
    border-left: 3px solid ${B.colors.amber};
    margin: 0 0 0.9em;
    padding: 4px 16px;
    color: ${B.colors.grayHi};
    font-style: italic;
    background: ${B.colors.quoteBg};
    border-radius: 0 6px 6px 0;
  }
  .content table {
    border-collapse: collapse;
    width: 100%;
    margin: 12px 0;
    font-size: 10pt;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .content th, .content td {
    border: 1px solid ${B.colors.border};
    padding: 7px 10px;
    text-align: left;
  }
  .content th {
    background: rgba(28, 69, 50, 0.06);
    color: ${B.colors.forestDark};
    font-weight: 600;
  }
  .content tr:nth-child(even) td { background: rgba(28, 69, 50, 0.02); }
  .content img { max-width: 100%; border-radius: 6px; }
  .content hr { border: none; border-top: 1px solid ${B.colors.border}; margin: 20px 0; }
  .brand-footer {
    margin-top: 32px;
    padding-top: 10px;
    border-top: 1px solid ${B.colors.border};
    display: flex;
    justify-content: space-between;
    font-family: 'JetBrains Mono', monospace;
    font-size: 7.5pt;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: ${B.colors.gray};
  }
</style>
</head>
<body>
  <div class="doc-wrapper">
    <div class="brand-accent-bar"></div>
    <div class="brand-header">
      <span class="brand-mark">${B.logoSvg}</span>
      <div class="brand-word">
        <span class="brand-name">${B.name}</span>
        <span class="brand-kicker">${_escapeHtml(B.kicker)}</span>
      </div>
      <div class="brand-meta">
        <span class="role-tag">${_escapeHtml(role)}</span><br>
        ${_escapeHtml(timestamp)}
      </div>
    </div>
    <div class="content">${html}</div>
    <div class="brand-footer">
      <span>${_escapeHtml(B.footerLeft)}</span>
      <span>Exportado em ${fileDate}</span>
    </div>
  </div>
</body>
</html>`;

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const finish = () => {
    try { document.body.removeChild(iframe); } catch (_) {}
  };

  iframe.onload = () => {
    let printed = false;
    const triggerPrint = () => {
      if (printed) return;
      printed = true;
      try {
        iframe.contentWindow.document.title = title;
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (_) {}
      setTimeout(finish, 1500);
    };

    // Wait for the brand webfonts (Fraunces / Plus Jakarta Sans / JetBrains
    // Mono) to finish loading before printing, so the exported PDF doesn't
    // get captured mid-swap on a fallback font. Falls back to a fixed delay
    // if the Font Loading API isn't available or never resolves.
    const idoc = iframe.contentWindow.document;
    if (idoc.fonts && idoc.fonts.ready) {
      idoc.fonts.ready.then(triggerPrint).catch(triggerPrint);
      setTimeout(triggerPrint, 900);
    } else {
      setTimeout(triggerPrint, 300);
    }
  };

  iframe.srcdoc = printDoc;
  addSystemBubble('Preparando PDF com a identidade Olivia...');
}

// Expose to global scope so inline onclick="downloadLastResponseAsPdf()" works
window.downloadLastResponseAsPdf = downloadLastResponseAsPdf;
})();