#!/usr/bin/env node
/**
 * generate-neil-bradley-pack-pdfs.js
 *
 * Generates branded PDF exports for every document in the Neil Bradley outreach
 * pack, replicating the Olivia workspace preview exporter exactly — the same
 * output the user gets from `downloadPreviewAsPdf()` in the page.
 *
 *   - Each markdown document is rendered to HTML with `marked`.
 *   - The body is wrapped in the workspace exporter's branded print document
 *     (Olivia olive-branch mark, "Olivia ecosystem" header, doc-footer).
 *   - The result is printed to PDF via puppeteer with the same @page margins
 *     the exporter uses (22mm 18mm 20mm).
 *
 * Run from repo root:  node scripts/generate-neil-bradley-pack-pdfs.js
 */
const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const puppeteer = require('puppeteer');

const PROJECT = path.resolve(__dirname, '../uploads/projects/neil-bradley');
const PACK    = path.join(PROJECT, 'outputs/outreach-neil-bradley');
const OUT_DIR = path.join(PACK, 'pdfs');
const SITE_ASSETS = path.join(PACK, 'site', 'assets');

const DOCS = [
  '00_reading_guide.md',
  '01_source_capture.md',
  '02_discovery_enrichment.md',
  '03_profile_synthesis.md',
  'lead-profile.md',
  '04_context_hypothesis_analysis.md',
  '05_alignment_qualification.md',
  'context-hypothesis-alignment.md',
  '06_bridge_creation.md',
  'bridge-document.md',
  '07_ready_pack_assembly.md',
  '08_human_outreach.md',
  '99_case_record.md',
];

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── The workspace preview exporter's branded print template (mirrors
//    frontend/js/modules/output.js downloadPreviewAsPdf) ─────────────────────
const oliveMark = '<svg width="28" height="28" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" style="display:block"><rect width="32" height="32" rx="8" fill="#1c4532"/><g transform="translate(6,7) scale(0.31)"><path d="M12 52 Q24 38,34 30 Q44 22,54 16" fill="none" stroke="#faf9f6" stroke-width="2.5" stroke-linecap="round" opacity=".65"/><path d="M28 36 Q20 26,16 18 Q24 24,28 36Z" fill="#faf9f6" opacity=".4"/><path d="M30 34 Q38 24,44 18 Q38 28,30 34Z" fill="#faf9f6" opacity=".38"/><path d="M42 24 Q36 14,34 8  Q40 14,42 24Z" fill="#faf9f6" opacity=".35"/><ellipse cx="22" cy="42" rx="4" ry="5" fill="#c4622d"/></g></svg>';

const PRINT_CSS = `
@page{ margin: 22mm 18mm 20mm; }
@page:first{ margin-top: 18mm; }
:root{ --green-dark:#1c4532; --green-mid:#2d785a; --green-light:#5a8a6e; --amber:#c4622d; --amber-light:#d4733e;
 --cream:#f8f5ee; --paper:#fdfcf9; --gray:#9a9088; --gray-hi:#5a5a5a; --ink:#1a1a1a;
 --border:rgba(28,69,50,.14);
 --font-serif: Fraunces,Georgia,serif; --font-sans: Plus\\ Jakarta\\ Sans,system-ui,-apple-system,sans-serif;
 --font-mono: JetBrains\\ Mono,monospace; }
*,*::before,*::after{ box-sizing:border-box; margin:0; padding:0; }
body{ font-family:var(--font-sans); background:#fff; color:var(--ink); font-size:10.5pt; line-height:1.7;
 -webkit-print-color-adjust:exact; print-color-adjust:exact; }
.doc-header{ display:flex; align-items:center; gap:10px; padding-bottom:12px; margin-bottom:30px; border-bottom:1.5px solid var(--green-dark); }
.doc-header-mark{ flex-shrink:0; line-height:0; }
.doc-header-brand{ font-family:var(--font-serif); font-size:13.5pt; font-weight:400; color:var(--green-dark); letter-spacing:-0.015em; line-height:1; }
.doc-header-brand span{ font-style:italic; font-weight:300; color:var(--amber); font-size:10pt; margin-left:6px; letter-spacing:0; }
.doc-header-meta{ margin-left:auto; text-align:right; font-family:var(--font-mono); font-size:7pt; color:var(--gray); line-height:1.6; }
.doc-header-meta strong{ display:block; color:var(--gray-hi); font-weight:500; font-size:7.5pt; }
h1,h2,h3,h4,h5,h6{ font-family:var(--font-serif); font-weight:400; color:var(--green-dark); line-height:1.22; letter-spacing:-0.012em; margin-top:1.9em; margin-bottom:.55em; break-after:avoid; }
h1{ font-size:18pt; margin-top:0; padding-bottom:9px; border-bottom:1px solid var(--border); }
h2{ font-size:14pt; } h3{ font-size:12pt; color:var(--green-mid); }
h4,h5,h6{ font-family:var(--font-sans); font-size:8pt; font-weight:600; color:var(--gray-hi); text-transform:uppercase; letter-spacing:.12em; }
h1 em,h2 em,h3 em{ font-style:italic; font-weight:300; color:var(--amber); }
p{ margin-bottom:.85em; } p:last-child{ margin-bottom:0; }
a{ color:var(--green-mid); text-decoration:underline; text-decoration-color:rgba(45,120,90,.3); }
strong,b{ font-weight:600; color:var(--green-dark); }
blockquote{ font-family:var(--font-serif); font-style:italic; font-size:11pt; color:var(--green-dark); border-left:2px solid var(--amber); padding:3px 14px; margin:1.3em 0; break-inside:avoid; }
code{ font-family:var(--font-mono); font-size:.82em; background:var(--cream); color:var(--green-dark); padding:1px 5px; border-radius:4px; border:1px solid var(--border); }
pre{ background:var(--cream); border-left:2.5px solid var(--amber); border-radius:0 7px 7px 0; padding:11px 14px; margin:1.2em 0; overflow-wrap:break-word; white-space:pre-wrap; break-inside:avoid; }
pre code{ background:none; border:none; padding:0; font-size:.85em; line-height:1.6; color:var(--ink); }
ul,ol{ padding-left:1.35em; margin-bottom:.85em; } li{ margin-bottom:.22em; } li>ul,li>ol{ margin-top:.2em; margin-bottom:.2em; }
table{ border-collapse:collapse; width:100%; margin:1.3em 0; font-size:9.5pt; break-inside:avoid; }
th{ background:var(--cream); font-family:var(--font-mono); font-size:7pt; font-weight:500; text-transform:uppercase; letter-spacing:.1em; color:var(--gray-hi); padding:7px 10px; border-bottom:1.5px solid var(--green-dark); text-align:left; }
td{ padding:6px 10px; border-bottom:1px solid var(--border); vertical-align:top; } tr:last-child td{ border-bottom:none; } tr:nth-child(even) td{ background:rgba(248,245,238,.45); }
img{ max-width:100%; height:auto; border-radius:6px; }
hr{ border:none; border-top:1px solid var(--border); margin:1.6em 0; }
.mermaid-container{ text-align:center; margin:1.2em 0; break-inside:avoid; }
.mermaid-container svg{ max-width:100%; height:auto; }
.doc-footer{ margin-top:36px; padding-top:10px; border-top:1px solid var(--border); display:flex; align-items:center; justify-content:space-between; gap:12px; font-family:var(--font-mono); font-size:7pt; color:var(--gray); }
.wm{ display:flex; align-items:baseline; gap:5px; } .wm-n{ font-family:var(--font-serif); font-size:9pt; color:var(--green-dark); letter-spacing:-0.01em; } .wm-s{ font-size:6.5pt; text-transform:uppercase; letter-spacing:.1em; color:var(--gray); }
@media print{ body{ background:#fff; } a{ color:var(--green-mid)!important; } pre,blockquote,table{ break-inside:avoid; } h1,h2,h3{ break-after:avoid; } }
`;

function buildPrintHtml(mdText, displayName) {
  const bodyHtml = marked.parse(mdText, { gfm: true, breaks: false });
  const docTitle = displayName.replace(/\.(md|markdown)$/i, '');
  const stamp = new Date().toLocaleString();
  const isoDate = new Date().toISOString().slice(0, 10);
  return '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>' + escapeHtml(docTitle) + '</title>\n' +
    '<link rel="preconnect" href="https://fonts.googleapis.com">\n' +
    '<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,500;1,9..144,300;1,9..144,400&family=Plus+Jakarta+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">\n' +
    '<style>\n' + PRINT_CSS + '\n</style>\n</head>\n<body>\n' +
    '<div class="doc-header"><div class="doc-header-mark">' + oliveMark + '</div>' +
    '<div class="doc-header-brand">Olivia <span>ecosystem</span></div>' +
    '<div class="doc-header-meta"><strong>' + escapeHtml(displayName) + '</strong>' + escapeHtml(stamp) + '</div></div>\n' +
    '<div class="doc-body">' + bodyHtml + '</div>\n' +
    '<div class="doc-footer"><div class="wm"><span class="wm-n">Olivia</span><span class="wm-s">Awareness · AI</span></div>' +
    '<span>Generated from workspace preview · ' + escapeHtml(isoDate) + '</span></div>\n' +
    '</body>\n</html>';
}

async function generate() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(SITE_ASSETS, { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  let completed = 0;
  try {
    for (const doc of DOCS) {
      const mdPath = path.join(PACK, doc);
      const mdText = fs.readFileSync(mdPath, 'utf-8');
      const html = buildPrintHtml(mdText, doc);
      const outName = doc.replace(/\.md$/, '') + '.pdf';

      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      await page.emulateMediaType('print');
      await page.pdf({
        path: path.join(OUT_DIR, outName),
        format: 'A4',
        margin: { top: '0mm', bottom: '0mm', left: '0mm', right: '0mm' },
        printBackground: true,
        displayHeaderFooter: false,
        preferCSSPageSize: true,
      });
      await page.close();

      // Mirror into site/assets so the Netlify-ready folder is self-contained.
      fs.copyFileSync(path.join(OUT_DIR, outName), path.join(SITE_ASSETS, outName));

      completed++;
      console.log('[' + completed + '/' + DOCS.length + '] \u2713 ' + outName + ' (' + doc + ')');
    }
  } finally {
    await browser.close();
  }
  console.log('\n\u2728 Done — ' + completed + ' PDFs in ' + OUT_DIR + ' and mirrored to ' + SITE_ASSETS);
}

generate().catch(function (err) { console.error('Error:', err); process.exit(1); });
