#!/usr/bin/env node
/**
 * generate-themed-pdfs.js
 *
 * Reads the two letters to Silvia and generates themed PDFs for each of the 5
 * js-pdf-silvia themes using puppeteer.
 *
 * Output: data/silvia-pdf-render-themes/
 */

const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const puppeteer = require('puppeteer');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const LETTERS_DIR = path.join(PROJECT_ROOT, 'uploads/projects/silvia-spaltro/writer');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'uploads/projects/silvia-spaltro/data');

const LETTERS = [
  { file: 'lettera-a-silvia.md', label: 'lettera-1' },
  { file: 'lettera-a-silvia-2.md', label: 'lettera-2' },
];

const THEMES = {
  games: {
    label: 'games', brandLabel: 'glasgow 2026', footerLabel: 'Games \u00b7 AI',
    css: `@page { margin: 22mm 18mm 20mm; }
@page:first { margin-top: 18mm; }
:root {
  --ink-dark: #1B1F3B; --ink-mid: #2E3360; --ink-light: #4A4F7A;
  --violet: #5E2CA5; --violet-lt: #7B4FC4;
  --cyan: #17C6E8; --cyan-lt: #4DD8F0;
  --magenta: #F53FA3; --magenta-lt: #F76DB9;
  --paper: #FDFCFE; --surface: #F5F3FA;
  --gray: #8A8794; --gray-hi: #534F5C;
  --ink-body: #1E1E2E; --border: rgba(94,44,165,.14);
  --font-serif: "Fraunces", Georgia, serif;
  --font-sans: "Plus Jakarta Sans", system-ui, -apple-system, sans-serif;
  --font-mono: "JetBrains Mono", monospace;
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--font-sans);background:#fff;color:var(--ink-body);font-size:10.5pt;line-height:1.72;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.doc-header{display:flex;align-items:center;gap:10px;padding-bottom:12px;margin-bottom:30px;border-bottom:1.5px solid var(--violet)}
.doc-header-mark{flex-shrink:0;line-height:0}
.doc-header-brand{font-family:var(--font-sans);font-size:13.5pt;font-weight:600;color:var(--violet);letter-spacing:-0.01em;line-height:1}
.doc-header-brand span{font-weight:400;color:var(--cyan);font-size:10pt;margin-left:6px;letter-spacing:0.03em;text-transform:uppercase}
.doc-header-meta{margin-left:auto;text-align:right;font-family:var(--font-mono);font-size:7pt;color:var(--gray);line-height:1.6}
.doc-header-meta strong{display:block;color:var(--gray-hi);font-weight:500;font-size:7.5pt}
h1,h2,h3,h4,h5,h6{font-family:var(--font-sans);font-weight:600;color:var(--ink-dark);line-height:1.2;letter-spacing:-0.01em;margin-top:1.9em;margin-bottom:0.55em;break-after:avoid}
h1{font-size:18pt;margin-top:0;padding-bottom:9px;border-bottom:1px solid var(--border)} h2{font-size:14pt} h3{font-size:12pt;color:var(--ink-mid)}
h4,h5,h6{font-family:var(--font-sans);font-size:8pt;font-weight:600;color:var(--gray-hi);text-transform:uppercase;letter-spacing:.12em}
h1 em,h2 em,h3 em{font-style:italic;font-weight:400;color:var(--magenta)}
p{margin-bottom:0.85em} p:last-child{margin-bottom:0}
a{color:var(--cyan);text-decoration:underline;text-decoration-color:rgba(23,198,232,.3)}
strong,b{font-weight:600;color:var(--violet)}
blockquote{font-family:var(--font-sans);font-style:italic;font-size:11pt;color:var(--ink-dark);border-left:2.5px solid var(--magenta);padding:4px 14px;margin:1.3em 0;break-inside:avoid}
code{font-family:var(--font-mono);font-size:.82em;background:var(--surface);color:var(--ink-dark);padding:1px 5px;border-radius:4px;border:1px solid var(--border)}
pre{background:var(--surface);border-left:2.5px solid var(--cyan);border-radius:0 7px 7px 0;padding:11px 14px;margin:1.2em 0;overflow-wrap:break-word;white-space:pre-wrap;break-inside:avoid}
pre code{background:none;border:none;padding:0;font-size:.85em;line-height:1.6;color:var(--ink-body)}
ul,ol{padding-left:1.35em;margin-bottom:0.85em} li{margin-bottom:0.22em} li>ul,li>ol{margin-top:0.2em;margin-bottom:0.2em}
table{border-collapse:collapse;width:100%;margin:1.3em 0;font-size:9.5pt;break-inside:avoid}
th{background:var(--surface);font-family:var(--font-mono);font-size:7pt;font-weight:500;text-transform:uppercase;letter-spacing:.1em;color:var(--gray-hi);padding:7px 10px;border-bottom:1.5px solid var(--violet);text-align:left}
td{padding:6px 10px;border-bottom:1px solid var(--border);vertical-align:top} tr:last-child td{border-bottom:none} tr:nth-child(even) td{background:rgba(245,243,250,.45)}
img{max-width:100%;height:auto;border-radius:6px} hr{border:none;border-top:1px solid var(--border);margin:1.6em 0}
.doc-footer{margin-top:36px;padding-top:10px;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:12px;font-family:var(--font-mono);font-size:7pt;color:var(--gray)}
.wm{display:flex;align-items:baseline;gap:5px} .wm-n{font-family:var(--font-sans);font-size:9pt;font-weight:600;color:var(--violet);letter-spacing:-0.01em} .wm-s{font-size:6.5pt;text-transform:uppercase;letter-spacing:.1em;color:var(--gray)}
@media print{body{background:#fff} a{color:var(--cyan)!important} pre,blockquote,table{break-inside:avoid} h1,h2,h3{break-after:avoid}}`,
    svgMark: '<svg width="28" height="28" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" style="display:block"><rect width="32" height="32" rx="6" fill="#5E2CA5"/><g transform="translate(16,26)" fill="none" stroke-linecap="round" stroke-linejoin="round"><polygon points="-10,-22 -6,-10 -1,-22" fill="#17C6E8" fill-opacity="0.9" stroke="#17C6E8" stroke-width="0.5"/><polygon points="-5,-22 -2,-8 2,-22" fill="#F53FA3" fill-opacity="0.85" stroke="#F53FA3" stroke-width="0.5"/><polygon points="1,-22 2,-8 6,-22" fill="#29D5D3" fill-opacity="0.9" stroke="#29D5D3" stroke-width="0.5"/><polygon points="-13,-16 -8,-8 -3,-16" fill="#17C6E8" fill-opacity="0.7" stroke="#17C6E8" stroke-width="0.5"/><polygon points="3,-16 8,-8 13,-16" fill="#29D5D3" fill-opacity="0.7" stroke="#29D5D3" stroke-width="0.5"/><polygon points="-8,-12 -5,-6 -2,-12" fill="#F53FA3" fill-opacity="0.6" stroke="#F53FA3" stroke-width="0.5"/><polygon points="2,-12 5,-6 8,-12" fill="#F53FA3" fill-opacity="0.6" stroke="#F53FA3" stroke-width="0.5"/><circle cx="0" cy="-6" r="2" fill="#FFFFFF" fill-opacity="0.85"/></g></svg>'
  },
  library: {
    label: 'library', brandLabel: 'library', footerLabel: 'Knowledge \u00b7 AI',
    css: `@page { margin: 22mm 18mm 20mm; }
@page:first { margin-top: 18mm; }
:root {
  --ink-dark: #1A2634; --ink-mid: #2E3B4E; --ink-light: #4A5568;
  --burgundy: #7A3B2E; --burgundy-lt: #9B5A4A;
  --gold: #B8935A; --gold-light: #D4AF6E;
  --parchment: #F5EDE0; --paper: #FDFBF7;
  --gray: #8B8581; --gray-hi: #5A5551;
  --ink-body: #2D2A26; --border: rgba(26,38,52,.12);
  --font-serif: "Fraunces", Georgia, serif;
  --font-sans: "Plus Jakarta Sans", system-ui, -apple-system, sans-serif;
  --font-mono: "JetBrains Mono", monospace;
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--font-sans);background:#fff;color:var(--ink-body);font-size:10.5pt;line-height:1.72;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.doc-header{display:flex;align-items:center;gap:10px;padding-bottom:12px;margin-bottom:30px;border-bottom:1.5px solid var(--ink-dark)}
.doc-header-mark{flex-shrink:0;line-height:0}
.doc-header-brand{font-family:var(--font-serif);font-size:13.5pt;font-weight:400;color:var(--ink-dark);letter-spacing:-0.015em;line-height:1}
.doc-header-brand span{font-style:italic;font-weight:300;color:var(--burgundy);font-size:10pt;margin-left:6px;letter-spacing:0}
.doc-header-meta{margin-left:auto;text-align:right;font-family:var(--font-mono);font-size:7pt;color:var(--gray);line-height:1.6} .doc-header-meta strong{display:block;color:var(--gray-hi);font-weight:500;font-size:7.5pt}
h1,h2,h3,h4,h5,h6{font-family:var(--font-serif);font-weight:400;color:var(--ink-dark);line-height:1.22;letter-spacing:-0.012em;margin-top:1.9em;margin-bottom:0.55em;break-after:avoid}
h1{font-size:18pt;margin-top:0;padding-bottom:9px;border-bottom:1px solid var(--border)} h2{font-size:14pt} h3{font-size:12pt;color:var(--ink-mid)}
h4,h5,h6{font-family:var(--font-sans);font-size:8pt;font-weight:600;color:var(--gray-hi);text-transform:uppercase;letter-spacing:.12em}
h1 em,h2 em,h3 em{font-style:italic;font-weight:300;color:var(--burgundy)} p{margin-bottom:0.85em} p:last-child{margin-bottom:0}
a{color:var(--ink-mid);text-decoration:underline;text-decoration-color:rgba(46,59,78,.25)} strong,b{font-weight:600;color:var(--ink-dark)}
blockquote{font-family:var(--font-serif);font-style:italic;font-size:11pt;color:var(--ink-dark);border-left:2.5px solid var(--gold);padding:4px 14px;margin:1.3em 0;break-inside:avoid}
code{font-family:var(--font-mono);font-size:.82em;background:var(--parchment);color:var(--ink-dark);padding:1px 5px;border-radius:4px;border:1px solid var(--border)}
pre{background:var(--parchment);border-left:2.5px solid var(--gold);border-radius:0 7px 7px 0;padding:11px 14px;margin:1.2em 0;overflow-wrap:break-word;white-space:pre-wrap;break-inside:avoid}
pre code{background:none;border:none;padding:0;font-size:.85em;line-height:1.6;color:var(--ink-body)}
ul,ol{padding-left:1.35em;margin-bottom:0.85em} li{margin-bottom:0.22em} li>ul,li>ol{margin-top:0.2em;margin-bottom:0.2em}
table{border-collapse:collapse;width:100%;margin:1.3em 0;font-size:9.5pt;break-inside:avoid}
th{background:var(--parchment);font-family:var(--font-mono);font-size:7pt;font-weight:500;text-transform:uppercase;letter-spacing:.1em;color:var(--gray-hi);padding:7px 10px;border-bottom:1.5px solid var(--ink-dark);text-align:left}
td{padding:6px 10px;border-bottom:1px solid var(--border);vertical-align:top} tr:last-child td{border-bottom:none} tr:nth-child(even) td{background:rgba(245,237,224,.45)}
img{max-width:100%;height:auto;border-radius:6px} hr{border:none;border-top:1px solid var(--border);margin:1.6em 0}
.doc-footer{margin-top:36px;padding-top:10px;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:12px;font-family:var(--font-mono);font-size:7pt;color:var(--gray)}
.wm{display:flex;align-items:baseline;gap:5px} .wm-n{font-family:var(--font-serif);font-size:9pt;color:var(--ink-dark);letter-spacing:-0.01em} .wm-s{font-size:6.5pt;text-transform:uppercase;letter-spacing:.1em;color:var(--gray)}
@media print{body{background:#fff} a{color:var(--ink-mid)!important} pre,blockquote,table{break-inside:avoid} h1,h2,h3{break-after:avoid}}`,
    svgMark: '<svg width="28" height="28" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" style="display:block"><rect width="32" height="32" rx="6" fill="#1A2634"/><g transform="translate(7,8)" fill="none" stroke="#F5EDE0" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9,1 L9,15 L1,14 L1,2 Z" fill="#F5EDE0" fill-opacity="0.12"/><path d="M9,1 L9,15 L17,14 L17,2 Z" fill="#F5EDE0" fill-opacity="0.08"/><line x1="9" y1="2" x2="9" y2="14" stroke="#B8935A" stroke-width="1" opacity="0.8"/><line x1="5" y1="5" x2="9" y2="5" stroke="#B8935A" stroke-width="0.6" opacity="0.5"/><line x1="5" y1="8" x2="9" y2="8" stroke="#B8935A" stroke-width="0.6" opacity="0.5"/><line x1="9" y1="5" x2="13" y2="5" stroke="#B8935A" stroke-width="0.6" opacity="0.5"/><line x1="9" y1="8" x2="13" y2="8" stroke="#B8935A" stroke-width="0.6" opacity="0.5"/></g></svg>'
  },
  scotland: {
    label: 'scotland', brandLabel: 'scotland', footerLabel: 'Scotland \u00b7 AI',
    css: `@page { margin: 22mm 18mm 20mm; }
@page:first { margin-top: 18mm; }
:root {
  --heather: #6B5876; --heather-lt: #8B7A96;
  --sea: #4A7C96; --sea-lt: #6A9CB0;
  --thistle: #9B7FB0; --thistle-lt: #B9A4C8;
  --stone: #8B8581; --stone-hi: #5A5551;
  --mist: #F7F4EE; --paper: #FCFAF7;
  --ink: #2D2826; --border: rgba(74,124,150,.12);
  --font-serif: "Fraunces", Georgia, serif;
  --font-sans: "Plus Jakarta Sans", system-ui, -apple-system, sans-serif;
  --font-mono: "JetBrains Mono", monospace;
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--font-sans);background:#fff;color:var(--ink);font-size:10.5pt;line-height:1.72;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.doc-header{display:flex;align-items:center;gap:10px;padding-bottom:14px;margin-bottom:30px;border-bottom:1.5px solid var(--sea)}
.doc-header-mark{flex-shrink:0;line-height:0}
.doc-header-brand{font-family:var(--font-serif);font-size:13.5pt;font-weight:400;color:var(--heather);letter-spacing:-0.015em;line-height:1}
.doc-header-brand span{font-style:italic;font-weight:300;color:var(--sea);font-size:10pt;margin-left:6px;letter-spacing:0}
.doc-header-meta{margin-left:auto;text-align:right;font-family:var(--font-mono);font-size:7pt;color:var(--stone);line-height:1.6} .doc-header-meta strong{display:block;color:var(--stone-hi);font-weight:500;font-size:7.5pt}
h1,h2,h3,h4,h5,h6{font-family:var(--font-serif);font-weight:400;color:var(--heather);line-height:1.25;letter-spacing:-0.01em;margin-top:1.8em;margin-bottom:0.55em;break-after:avoid}
h1{font-size:18pt;margin-top:0;padding-bottom:9px;border-bottom:1px solid var(--border)} h2{font-size:14pt} h3{font-size:12pt;color:var(--heather-lt)}
h4,h5,h6{font-family:var(--font-sans);font-size:8pt;font-weight:600;color:var(--stone-hi);text-transform:uppercase;letter-spacing:.12em}
h1 em,h2 em,h3 em{font-style:italic;font-weight:300;color:var(--sea)} p{margin-bottom:0.85em} p:last-child{margin-bottom:0}
a{color:var(--sea);text-decoration:underline;text-decoration-color:rgba(74,124,150,.25)} strong,b{font-weight:600;color:var(--heather)}
blockquote{font-family:var(--font-serif);font-style:italic;font-size:11pt;color:var(--heather);border-left:2.5px solid var(--thistle);padding:4px 14px;margin:1.3em 0;break-inside:avoid}
code{font-family:var(--font-mono);font-size:.82em;background:var(--mist);color:var(--heather);padding:1px 5px;border-radius:4px;border:1px solid var(--border)}
pre{background:var(--mist);border-left:2.5px solid var(--thistle);border-radius:0 7px 7px 0;padding:11px 14px;margin:1.2em 0;overflow-wrap:break-word;white-space:pre-wrap;break-inside:avoid}
pre code{background:none;border:none;padding:0;font-size:.85em;line-height:1.6;color:var(--ink)}
ul,ol{padding-left:1.35em;margin-bottom:0.85em} li{margin-bottom:0.22em} li>ul,li>ol{margin-top:0.2em;margin-bottom:0.2em}
table{border-collapse:collapse;width:100%;margin:1.3em 0;font-size:9.5pt;break-inside:avoid}
th{background:var(--mist);font-family:var(--font-mono);font-size:7pt;font-weight:500;text-transform:uppercase;letter-spacing:.1em;color:var(--stone-hi);padding:7px 10px;border-bottom:1.5px solid var(--sea);text-align:left}
td{padding:6px 10px;border-bottom:1px solid var(--border);vertical-align:top} tr:last-child td{border-bottom:none} tr:nth-child(even) td{background:rgba(247,244,238,.45)}
img{max-width:100%;height:auto;border-radius:6px} hr{border:none;border-top:1px solid var(--border);margin:1.6em 0}
.doc-footer{margin-top:36px;padding-top:10px;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:12px;font-family:var(--font-mono);font-size:7pt;color:var(--stone)}
.wm{display:flex;align-items:baseline;gap:5px} .wm-n{font-family:var(--font-serif);font-size:9pt;color:var(--heather);letter-spacing:-0.01em} .wm-s{font-size:6.5pt;text-transform:uppercase;letter-spacing:.1em;color:var(--stone)}
@media print{body{background:#fff} a{color:var(--sea)!important} pre,blockquote,table{break-inside:avoid} h1,h2,h3{break-after:avoid}}`,
    svgMark: '<svg width="28" height="28" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" style="display:block"><rect width="32" height="32" rx="8" fill="#4A7C96"/><g transform="translate(16,16)" fill="none"><path d="M0,-10 L4,-4 L10,0 L4,4 L0,10 L-4,4 L-10,0 L-4,-4 Z" stroke="#F7F4EE" stroke-width="1.5" fill="#F7F4EE" fill-opacity="0.15" stroke-linejoin="round"/><circle cx="0" cy="0" r="2.5" fill="#9B7FB0" opacity="0.8"/><line x1="0" y1="-8" x2="0" y2="-12.5" stroke="#9B7FB0" stroke-width="1" opacity="0.6"/><line x1="0" y1="8" x2="0" y2="12.5" stroke="#9B7FB0" stroke-width="1" opacity="0.6"/><line x1="-8" y1="0" x2="-12.5" y2="0" stroke="#9B7FB0" stroke-width="1" opacity="0.6"/><line x1="8" y1="0" x2="12.5" y2="0" stroke="#9B7FB0" stroke-width="1" opacity="0.6"/></g></svg>'
  },
  community: {
    label: 'community', brandLabel: 'community', footerLabel: 'Community \u00b7 AI',
    css: `@page { margin: 22mm 18mm 20mm; }
@page:first { margin-top: 18mm; }
:root {
  --terracotta: #C87D5E; --terracotta-lt: #D9A08A;
  --teal: #266B6A; --teal-lt: #3D8B8A;
  --amber: #E8A850; --amber-lt: #F0C278;
  --cream: #FDF8F2; --paper: #FEFCF9;
  --gray: #8B8581; --gray-hi: #5A5551;
  --ink: #2D2520; --border: rgba(38,107,106,.12);
  --font-serif: "Fraunces", Georgia, serif;
  --font-sans: "Plus Jakarta Sans", system-ui, -apple-system, sans-serif;
  --font-mono: "JetBrains Mono", monospace;
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--font-sans);background:#fff;color:var(--ink);font-size:10.5pt;line-height:1.72;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.doc-header{display:flex;align-items:center;gap:10px;padding-bottom:12px;margin-bottom:30px;border-bottom:2px solid var(--teal)}
.doc-header-mark{flex-shrink:0;line-height:0}
.doc-header-brand{font-family:var(--font-serif);font-size:13.5pt;font-weight:500;color:var(--teal);letter-spacing:-0.015em;line-height:1}
.doc-header-brand span{font-style:italic;font-weight:300;color:var(--terracotta);font-size:10pt;margin-left:6px;letter-spacing:0}
.doc-header-meta{margin-left:auto;text-align:right;font-family:var(--font-mono);font-size:7pt;color:var(--gray);line-height:1.6} .doc-header-meta strong{display:block;color:var(--gray-hi);font-weight:500;font-size:7.5pt}
h1,h2,h3,h4,h5,h6{font-family:var(--font-serif);font-weight:500;color:var(--teal);line-height:1.22;letter-spacing:-0.012em;margin-top:1.9em;margin-bottom:0.55em;break-after:avoid}
h1{font-size:18pt;margin-top:0;padding-bottom:9px;border-bottom:1px solid var(--border)} h2{font-size:14pt} h3{font-size:12pt;color:var(--teal-lt)}
h4,h5,h6{font-family:var(--font-sans);font-size:8pt;font-weight:600;color:var(--gray-hi);text-transform:uppercase;letter-spacing:.12em}
h1 em,h2 em,h3 em{font-style:italic;font-weight:300;color:var(--terracotta)} p{margin-bottom:0.85em} p:last-child{margin-bottom:0}
a{color:var(--teal-lt);text-decoration:underline;text-decoration-color:rgba(61,139,138,.3)} strong,b{font-weight:600;color:var(--teal)}
blockquote{font-family:var(--font-serif);font-style:italic;font-size:11.5pt;font-weight:300;color:var(--ink);border-left:3px solid var(--amber);padding:5px 16px;margin:1.4em 0;line-height:1.5;break-inside:avoid}
code{font-family:var(--font-mono);font-size:.82em;background:var(--cream);color:var(--teal);padding:1px 5px;border-radius:4px;border:1px solid var(--border)}
pre{background:var(--cream);border-left:3px solid var(--amber);border-radius:0 7px 7px 0;padding:11px 14px;margin:1.2em 0;overflow-wrap:break-word;white-space:pre-wrap;break-inside:avoid}
pre code{background:none;border:none;padding:0;font-size:.85em;line-height:1.6;color:var(--ink)}
ul,ol{padding-left:1.35em;margin-bottom:0.85em} li{margin-bottom:0.22em} li>ul,li>ol{margin-top:0.2em;margin-bottom:0.2em}
table{border-collapse:collapse;width:100%;margin:1.3em 0;font-size:9.5pt;break-inside:avoid}
th{background:var(--cream);font-family:var(--font-mono);font-size:7pt;font-weight:500;text-transform:uppercase;letter-spacing:.1em;color:var(--gray-hi);padding:7px 10px;border-bottom:2px solid var(--teal);text-align:left}
td{padding:6px 10px;border-bottom:1px solid var(--border);vertical-align:top} tr:last-child td{border-bottom:none} tr:nth-child(even) td{background:rgba(253,248,242,.55)}
img{max-width:100%;height:auto;border-radius:6px} hr{border:none;border-top:1px solid var(--border);margin:1.6em 0}
.doc-footer{margin-top:36px;padding-top:10px;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:12px;font-family:var(--font-mono);font-size:7pt;color:var(--gray)}
.wm{display:flex;align-items:baseline;gap:5px} .wm-n{font-family:var(--font-serif);font-size:9pt;font-weight:500;color:var(--teal);letter-spacing:-0.01em} .wm-s{font-size:6.5pt;text-transform:uppercase;letter-spacing:.1em;color:var(--gray)}
@media print{body{background:#fff} a{color:var(--teal-lt)!important} pre,blockquote,table{break-inside:avoid} h1,h2,h3{break-after:avoid}}`,
    svgMark: '<svg width="28" height="28" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" style="display:block"><rect width="32" height="32" rx="8" fill="#266B6A"/><g transform="translate(16,13)" fill="none" stroke-width="1.8"><circle cx="-5" cy="-2" r="5" stroke="#E8A850" fill="none" opacity="0.9"/><circle cx="5" cy="-2" r="5" stroke="#E8A850" fill="none" opacity="0.9"/><circle cx="0" cy="6" r="5" stroke="#E8A850" fill="none" opacity="0.9"/><circle cx="0" cy="0" r="2" fill="#E8A850" opacity="0.6"/></g></svg>'
  },
  accessible: {
    label: 'accessible', brandLabel: 'for everyone', footerLabel: 'For Everyone \u00b7 AI',
    css: `@page { margin: 22mm 18mm 20mm; }
@page:first { margin-top: 18mm; }
:root {
  --ink-dark: #2D2A28; --ink-mid: #4A4540; --ink-light: #6B6358;
  --warm-teal: #42B4B0; --warm-teal-lt: #5FC8C4;
  --coral: #F28B82; --coral-lt: #F5A39A;
  --violet-warm: #7B6BA8; --violet-warm-lt: #9B8DC0;
  --cream: #FBF5EF; --paper: #FFFDFA;
  --gray: #9A9288; --gray-hi: #5E5852;
  --ink-body: #2D2A26; --border: rgba(66,180,176,.16);
  --font-serif: "Fraunces", Georgia, serif;
  --font-sans: "Plus Jakarta Sans", system-ui, -apple-system, sans-serif;
  --font-mono: "JetBrains Mono", monospace;
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--font-sans);background:#fff;color:var(--ink-body);font-size:10.5pt;line-height:1.72;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.doc-header{display:flex;align-items:center;gap:10px;padding-bottom:12px;margin-bottom:30px;border-bottom:1.5px solid var(--warm-teal)}
.doc-header-mark{flex-shrink:0;line-height:0}
.doc-header-brand{font-family:var(--font-sans);font-size:13.5pt;font-weight:500;color:var(--warm-teal);letter-spacing:-0.01em;line-height:1}
.doc-header-brand span{font-weight:400;color:var(--coral);font-size:10pt;margin-left:6px;letter-spacing:0.02em}
.doc-header-meta{margin-left:auto;text-align:right;font-family:var(--font-mono);font-size:7pt;color:var(--gray);line-height:1.6} .doc-header-meta strong{display:block;color:var(--gray-hi);font-weight:500;font-size:7.5pt}
h1,h2,h3,h4,h5,h6{font-family:var(--font-sans);font-weight:500;color:var(--ink-dark);line-height:1.25;letter-spacing:-0.01em;margin-top:1.9em;margin-bottom:0.55em;break-after:avoid}
h1{font-size:18pt;margin-top:0;padding-bottom:9px;border-bottom:1px solid var(--border)} h2{font-size:14pt} h3{font-size:12pt;color:var(--ink-mid)}
h4,h5,h6{font-family:var(--font-sans);font-size:8pt;font-weight:600;color:var(--gray-hi);text-transform:uppercase;letter-spacing:.1em}
h1 em,h2 em,h3 em{font-style:italic;font-weight:400;color:var(--coral)} p{margin-bottom:0.85em} p:last-child{margin-bottom:0}
a{color:var(--warm-teal);text-decoration:underline;text-decoration-color:rgba(66,180,176,.3)} strong,b{font-weight:600;color:var(--warm-teal)}
blockquote{font-family:var(--font-sans);font-style:italic;font-size:11pt;color:var(--ink-dark);border-left:2.5px solid var(--coral);padding:4px 14px;margin:1.3em 0;break-inside:avoid}
code{font-family:var(--font-mono);font-size:.82em;background:var(--cream);color:var(--ink-dark);padding:1px 5px;border-radius:6px;border:1px solid var(--border)}
pre{background:var(--cream);border-left:2.5px solid var(--warm-teal);border-radius:0 10px 10px 0;padding:11px 14px;margin:1.2em 0;overflow-wrap:break-word;white-space:pre-wrap;break-inside:avoid}
pre code{background:none;border:none;padding:0;font-size:.85em;line-height:1.6;color:var(--ink-body)}
ul,ol{padding-left:1.35em;margin-bottom:0.85em} li{margin-bottom:0.22em} li>ul,li>ol{margin-top:0.2em;margin-bottom:0.2em}
table{border-collapse:collapse;width:100%;margin:1.3em 0;font-size:9.5pt;break-inside:avoid}
th{background:var(--cream);font-family:var(--font-mono);font-size:7pt;font-weight:500;text-transform:uppercase;letter-spacing:.1em;color:var(--gray-hi);padding:7px 10px;border-bottom:1.5px solid var(--warm-teal);text-align:left}
td{padding:6px 10px;border-bottom:1px solid var(--border);vertical-align:top} tr:last-child td{border-bottom:none} tr:nth-child(even) td{background:rgba(251,245,239,.45)}
img{max-width:100%;height:auto;border-radius:8px} hr{border:none;border-top:1px solid var(--border);margin:1.6em 0}
.doc-footer{margin-top:36px;padding-top:10px;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:12px;font-family:var(--font-mono);font-size:7pt;color:var(--gray)}
.wm{display:flex;align-items:baseline;gap:5px} .wm-n{font-family:var(--font-sans);font-size:9pt;font-weight:500;color:var(--warm-teal);letter-spacing:-0.01em} .wm-s{font-size:6.5pt;text-transform:uppercase;letter-spacing:.1em;color:var(--gray)}
@media print{body{background:#fff} a{color:var(--warm-teal)!important} pre,blockquote,table{break-inside:avoid} h1,h2,h3{break-after:avoid}}`,
    svgMark: '<svg width="28" height="28" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" style="display:block"><rect width="32" height="32" rx="8" fill="#42B4B0"/><g transform="translate(16,20)" fill="none" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="0" cy="3" rx="9" ry="8" fill="#FBF5EF" fill-opacity="0.95" stroke="#FBF5EF" stroke-width="0.5"/><path d="M0,-6 L-2,-18 L2,-18 Z" fill="#7B6BA8" fill-opacity="0.9" stroke="#7B6BA8" stroke-width="0.5"/><ellipse cx="-3" cy="-2" rx="1.2" ry="1.4" fill="#2D2A28"/><ellipse cx="3" cy="-2" rx="1.2" ry="1.4" fill="#2D2A28"/><path d="M-2,2 Q0,4 2,2" fill="none" stroke="#F28B82" stroke-width="1.2" opacity="0.85"/><circle cx="-3.4" cy="-2.5" r="0.4" fill="#FFFFFF" opacity="0.8"/><circle cx="2.6" cy="-2.5" r="0.4" fill="#FFFFFF" opacity="0.8"/><ellipse cx="5" cy="-3" rx="2.5" ry="1.2" fill="#7B6BA8" fill-opacity="0.45" stroke="#7B6BA8" stroke-width="0.4" opacity="0.7"/><ellipse cx="-5" cy="-3" rx="2.5" ry="1.2" fill="#7B6BA8" fill-opacity="0.45" stroke="#7B6BA8" stroke-width="0.4" opacity="0.7"/></g></svg>'
  }
};

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function generatePdfs() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const letterContents = {};
  for (const letter of LETTERS) {
    letterContents[letter.file] = fs.readFileSync(path.join(LETTERS_DIR, letter.file), 'utf-8');
  }

  const browser = await puppeteer.launch({
    headless: true,
    // Use puppeteer's bundled Chrome by default; override with PUPPETEER_EXECUTABLE_PATH.
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const total = Object.keys(THEMES).length * LETTERS.length;
  let completed = 0;

  try {
    for (const [themeKey, theme] of Object.entries(THEMES)) {
      for (const letter of LETTERS) {
        const mdText = letterContents[letter.file];
        const bodyHtml = marked.parse(mdText);
        const displayName = letter.file;
        const docTitle = letter.file.replace(/\.(md|markdown)$/i, '');
        const stamp = new Date().toLocaleString();
        const isoDate = new Date().toISOString().slice(0, 10);

        const html = '<!DOCTYPE html>\n<html lang="it">\n<head>\n<meta charset="utf-8">\n<title>' + escapeHtml(docTitle) + '</title>\n<link rel="preconnect" href="https://fonts.googleapis.com">\n<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,500;1,9..144,300;1,9..144,400&family=Plus+Jakarta+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">\n<style>\n' + theme.css + '\n</style>\n</head>\n<body>\n<div class="doc-header">\n  <div class="doc-header-mark">' + theme.svgMark + '</div>\n  <div class="doc-header-brand">Olivia <span>' + escapeHtml(theme.brandLabel) + '</span></div>\n  <div class="doc-header-meta">\n    <strong>' + escapeHtml(displayName) + '</strong>\n    ' + escapeHtml(stamp) + '\n  </div>\n</div>\n<div class="markdown-body">' + bodyHtml + '</div>\n<div class="doc-footer">\n  <div class="wm">\n    <span class="wm-n">Olivia</span>\n    <span class="wm-s">' + escapeHtml(theme.footerLabel) + '</span>\n  </div>\n  <span>Generated from workspace preview \u00b7 ' + escapeHtml(isoDate) + '</span>\n</div>\n</body>\n</html>';

        const outputFileName = letter.label + '__theme-' + theme.label + '.pdf';
        const outputPath = path.join(OUTPUT_DIR, outputFileName);

        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        await page.emulateMediaType('print');
        await page.pdf({
          path: outputPath,
          format: 'A4',
          margin: { top: '0mm', bottom: '0mm', left: '0mm', right: '0mm' },
          printBackground: true,
          displayHeaderFooter: false,
        });
        await page.close();

        completed++;
        console.log('[' + completed + '/' + total + '] \u2713 ' + outputFileName);
      }
    }
  } finally {
    await browser.close();
  }

  console.log('\n\u2728 Done! ' + total + ' PDFs generated in ' + OUTPUT_DIR);
}

generatePdfs().catch(function(err) { console.error('Error:', err); process.exit(1); });
