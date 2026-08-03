#!/usr/bin/env node
/**
 * generate-beverly-reading-pack.js
 *
 * Phase 7 — Reading pack for the Beverly de Guzman × Olivia Ecosystem project.
 *
 * 1. Exports every project document as a PDF into uploads/netify-pack/ using the
 *    exact same branding as the workspace `downloadPreviewAsPdf` exporter
 *    (frontend/js/modules/output.js): olive-branch mark, "Olivia ecosystem"
 *    header, "Awareness · AI" footer, forest-green theme, Fraunces / Plus Jakarta
 *    Sans / JetBrains Mono.
 * 2. Generates outputs/olivia-reading-room-beverly-de-guzman.html — a reading
 *    portal in the pastel design system that renders every document inline (in
 *    the guide's read order) and provides a "Download PDF" button per document.
 *
 * Run from repo root:  node scripts/generate-beverly-reading-pack.js
 */

const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const puppeteer = require('puppeteer');

const PROJECT = path.resolve(__dirname, '../uploads/projects/beverly-de-guzman');
const OUT_DIR = path.join(PROJECT, 'uploads/netify-pack');
const READING_ROOM = path.join(PROJECT, 'outputs/olivia-reading-room-beverly-de-guzman.html');
const MAIN_PAGE_REL = 'olivia-mutual-understanding-beverly-de-guzman.html';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const DOCS = [
  { n: '00', label: 'reading-guide-and-index', cat: 'orientation', time: '3 min',
    title: 'Reading Guide & Index',
    file: 'outputs/reading-guide-beverly-de-guzman.md',
    desc: 'The front door to the pack — a summary of the project and the best read order for everything that follows.' },
  { n: '01', label: 'beverly-profile-summary', cat: 'orientation', time: '4 min',
    title: 'Profile Summary — Beverly de Guzman',
    file: 'discovery_files/notes/01-beverly-profile-summary.md',
    desc: 'Phase-2 deep understanding: line of work, The Founder Positioning Framework\u2122, core principles, and AI transformation views.' },
  { n: '02', label: 'olivia-beverly-cross-reference', cat: 'analysis', time: '6 min',
    title: 'Cross-Reference — Olivia Ecosystem \u00d7 Beverly de Guzman',
    file: 'discovery_files/olivia-beverly-cross-reference.md',
    desc: 'Six alignments between Founder Positioning and the Olivia Ecosystem, plus possible contributions, open questions, and clarifications.' },
  { n: '03', label: 'content-architecture', cat: 'analysis', time: '4 min',
    title: 'Content Architecture — Mutual-Understanding Page',
    file: 'discovery_files/content-architecture.md',
    desc: 'The page map: every section of the mutual-understanding page and the evidence behind it.' },
  { n: '04', label: 'validation-two-disciplines-one-belief', cat: 'analysis', time: '5 min',
    title: 'Validation — \u201CTwo disciplines, one belief\u201D',
    file: 'outputs/validation-two-disciplines-one-belief.md',
    desc: 'Quote-level audit proving every alignment quote on the page is verbatim against the source captures.' },
  { n: '05', label: 'profile-beverly-de-guzman', cat: 'sources', time: '5 min',
    title: 'Profile — Beverly de Guzman',
    file: 'case_files/structured/01-profile-beverly-de-guzman.md',
    desc: 'Structured conversion of the LinkedIn profile: contact, headline, skills, summary, experience, education.' },
  { n: '06', label: 'linkedin-full-profile-beverly-de-guzman', cat: 'sources', time: '8 min',
    title: 'LinkedIn Full Profile',
    file: 'case_files/structured/02-linkedin-full-profile-beverly-de-guzman.md',
    desc: 'Full-profile export — About, skills, Featured, recent activity, experience, education.' },
  { n: '07', label: 'company-founder-positioning-studio', cat: 'sources', time: '3 min',
    title: 'Founder Positioning Studio — Company',
    file: 'case_files/structured/03-company-founder-positioning-studio.md',
    desc: 'The studio as a business, in its own words.' },
  { n: '08', label: 'conversation-beverly-leandro-ai-transformation', cat: 'sources', time: '4 min',
    title: 'Conversation — Beverly \u2194 Leandro',
    file: 'case_files/structured/04-conversation-beverly-leandro-ai-transformation.md',
    desc: 'The LinkedIn exchange on AI transformation and the Olivia Ecosystem — the origin of this project.' },
  { n: '09', label: 'posts-beverly-de-guzman', cat: 'sources', time: '10 min',
    title: 'Posts — Beverly de Guzman',
    file: 'case_files/structured/05-posts-beverly-de-guzman.md',
    desc: 'All 24 posts (22 original + 2 reposts) — the evidence base for the alignments.' },
  { n: '10', label: 'case-files-readme', cat: 'appendix', time: '2 min',
    title: 'Case Files README & Provenance',
    file: 'case_files/README.md',
    desc: 'How the raw \u2194 structured sources were organised and why they are trustworthy.' },
  { n: '11', label: 'appendix-project-planning-notes', cat: 'appendix', time: 'optional',
    title: 'Appendix — Project Planning Notes',
    file: 'outputs/appendix-project-planning-notes.md',
    desc: 'The four internal planning files (findings, memory, progress, task plan) in one document.' },
];

const CATS = [
  { id: 'orientation', label: 'Part A \u00b7 Orientation' },
  { id: 'analysis', label: 'Part B \u00b7 Analysis' },
  { id: 'sources', label: 'Part C \u00b7 Source documents' },
  { id: 'appendix', label: 'Part D \u00b7 Provenance & process' },
];

// ── Exact branding from frontend/js/modules/output.js (downloadPreviewAsPdf) ──
const oliveMark = '<svg width="28" height="28" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" style="display:block"><rect width="32" height="32" rx="8" fill="#1c4532"/><g transform="translate(6,7) scale(0.31)"><path d="M12 52 Q24 38,34 30 Q44 22,54 16" fill="none" stroke="#faf9f6" stroke-width="2.5" stroke-linecap="round" opacity=".65"/><path d="M28 36 Q20 26,16 18 Q24 24,28 36Z" fill="#faf9f6" opacity=".4"/><path d="M30 34 Q38 24,44 18 Q38 28,30 34Z" fill="#faf9f6" opacity=".38"/><path d="M42 24 Q36 14,34 8  Q40 14,42 24Z" fill="#faf9f6" opacity=".35"/><ellipse cx="22" cy="42" rx="4" ry="5" fill="#c4622d"/></g></svg>';

const printCss = `@page{ margin: 22mm 18mm 20mm; }
@page:first{ margin-top: 18mm; }
:root{ --green-dark:#1c4532; --green-mid:#2d785a; --green-light:#5a8a6e; --amber:#c4622d; --amber-light:#d4733e;
 --cream:#f8f5ee; --paper:#fdfcf9; --gray:#9a9088; --gray-hi:#5a5a5a; --ink:#1a1a1a;
 --border:rgba(28,69,50,.14);
 --font-serif: Fraunces,Georgia,serif; --font-sans: Plus Jakarta Sans,system-ui,-apple-system,sans-serif;
 --font-mono: JetBrains Mono,monospace; }
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
@media print{ body{ background:#fff; } a{ color:var(--green-mid)!important; } pre,blockquote,table{ break-inside:avoid; } h1,h2,h3{ break-after:avoid; } }`;

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function stripFrontmatter(md) {
  return md.replace(/^---[\s\S]*?---\s*\n/, '');
}

function buildPrintHtml(mdText, fileName) {
  const bodyHtml = marked.parse(stripFrontmatter(mdText));
  const docTitle = fileName.replace(/\.(md|markdown)$/i, '');
  const stamp = new Date().toLocaleString();
  const isoDate = new Date().toISOString().slice(0, 10);
  return '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>' + escapeHtml(docTitle) + '</title>\n' +
    '<link rel="preconnect" href="https://fonts.googleapis.com">\n' +
    '<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,500;1,9..144,300;1,9..144,400&family=Plus+Jakarta+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">\n' +
    '<style>\n' + printCss + '\n</style>\n</head>\n<body>\n' +
    '<div class="doc-header"><div class="doc-header-mark">' + oliveMark + '</div>' +
    '<div class="doc-header-brand">Olivia <span>ecosystem</span></div>' +
    '<div class="doc-header-meta"><strong>' + escapeHtml(fileName) + '</strong>' + escapeHtml(stamp) + '</div></div>\n' +
    '<div class="doc-body">' + bodyHtml + '</div>\n' +
    '<div class="doc-footer"><div class="wm"><span class="wm-n">Olivia</span><span class="wm-s">Awareness \u00b7 AI</span></div>' +
    '<span>Generated from workspace preview \u00b7 ' + escapeHtml(isoDate) + '</span></div>\n' +
    '</body>\n</html>';
}

async function generatePdfs(browser) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const doc of DOCS) {
    const mdText = fs.readFileSync(path.join(PROJECT, doc.file), 'utf-8');
    const html = buildPrintHtml(mdText, doc.file);
    const outName = doc.n + '-' + doc.label + '.pdf';
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.emulateMediaType('print');
    await page.pdf({
      path: path.join(OUT_DIR, outName),
      format: 'A4',
      margin: { top: '0mm', bottom: '0mm', left: '0mm', right: '0mm' },
      printBackground: true,
      preferCSSPageSize: true,
    });
    await page.close();
    console.log('\u2713 ' + outName);
  }
}

// ── Reading room (pastel design system, same tokens as the main page) ──────────
const roomCss = `:root{
 --white:#FAF6EF; --paper:#FFFFFF; --cream:#F2ECDE; --black:#34302A;
 --green-dark:#3F6152; --green-mid:#7FA98E; --green-light:#A9CBB7;
 --amber:#D98A5E; --amber-light:#E7A67D; --golden:#D6B87A;
 --gray:#ADA396; --gray-hi:#6B6458;
 --color-border-light:rgba(63,97,82,.12); --color-border-medium:rgba(63,97,82,.20);
 --font-serif:'Fraunces',Georgia,serif; --font-sans:'Plus Jakarta Sans',system-ui,-apple-system,sans-serif;
 --font-mono:'JetBrains Mono',monospace; --transition:.35s cubic-bezier(.4,0,.2,1);
}
*{margin:0;padding:0;box-sizing:border-box}
html{scroll-behavior:smooth}
body{font-family:var(--font-sans);background:var(--white);color:var(--black);line-height:1.65;overflow-x:hidden;-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}
nav{position:fixed;top:0;left:0;right:0;z-index:40;display:flex;align-items:center;justify-content:space-between;padding:1.1rem 2.4rem;backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);background:color-mix(in srgb, var(--white) 82%, transparent);border-bottom:1px solid var(--color-border-light)}
nav .logo{font-family:var(--font-serif);font-size:1.15rem;color:var(--green-dark);letter-spacing:-.01em}
nav .logo .tag{font-family:var(--font-sans);font-style:italic;font-weight:300;color:var(--amber);font-size:.8rem;margin-left:7px}
nav .links{display:flex;gap:1.5rem;align-items:center}
nav .links a{font-size:.82rem;color:var(--gray-hi);transition:color var(--transition)}
nav .links a:hover{color:var(--green-dark)}
nav .links .cta{background:var(--green-dark);color:var(--white);padding:.5rem 1.1rem;border-radius:999px;font-size:.78rem}
nav .links .cta:hover{background:var(--green-mid);color:var(--white)}
main{max-width:1120px;margin:0 auto;padding:0 2rem}
.hero{padding:8.5rem 0 3.5rem}
.kicker{font-family:var(--font-mono);font-size:.68rem;letter-spacing:.22em;text-transform:uppercase;color:var(--amber)}
.hero h1{font-family:var(--font-serif);font-weight:400;font-size:clamp(2.1rem,4.4vw,3.3rem);line-height:1.12;color:var(--green-dark);margin:1rem 0 1.3rem;letter-spacing:-.015em}
.hero .lede{max-width:680px;color:var(--gray-hi);font-size:1.02rem;font-weight:300}
.quote-line{border-left:2.5px solid var(--amber);background:var(--paper);padding:1.2rem 1.5rem;margin:1.6rem 0 0;border-radius:0 12px 12px 0;max-width:720px}
.quote-line p{font-family:var(--font-serif);font-style:italic;font-size:1.05rem;color:var(--green-dark)}
.quote-line cite{display:block;margin-top:.5rem;font-family:var(--font-sans);font-style:normal;font-size:.75rem;color:var(--gray);letter-spacing:.04em}
section.block{padding:2.6rem 0}
.sec-kicker{font-family:var(--font-mono);font-size:.64rem;letter-spacing:.2em;text-transform:uppercase;color:var(--amber)}
h2.sec-title{font-family:var(--font-serif);font-weight:400;font-size:1.65rem;color:var(--green-dark);margin:.5rem 0 1.4rem;letter-spacing:-.01em}
.order-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:1rem}
.order-card{background:var(--paper);border:1px solid var(--color-border-light);border-radius:14px;padding:1.1rem 1.2rem;display:flex;gap:.9rem;align-items:flex-start;transition:border-color var(--transition),transform var(--transition)}
.order-card:hover{border-color:var(--color-border-medium);transform:translateY(-2px)}
.order-card .n{font-family:var(--font-serif);font-size:1.15rem;color:var(--amber);min-width:2rem;text-align:center;background:color-mix(in srgb, var(--cream) 70%, transparent);border-radius:10px;padding:.25rem 0}
.order-card .t{font-weight:600;color:var(--green-dark);font-size:.9rem}
.order-card .d{color:var(--gray-hi);font-size:.78rem;margin-top:.2rem}
.order-card a{color:var(--green-mid);font-size:.72rem}
.doc{background:var(--paper);border:1px solid var(--color-border-light);border-radius:18px;margin:1.6rem 0;overflow:hidden;scroll-margin-top:90px}
.doc-head{display:flex;align-items:center;gap:1rem;padding:1.1rem 1.4rem;border-bottom:1px solid var(--color-border-light);background:color-mix(in srgb, var(--white) 55%, transparent)}
.doc-head .n{font-family:var(--font-serif);font-size:1.5rem;color:var(--amber);background:color-mix(in srgb, var(--cream) 80%, transparent);border-radius:12px;padding:.2rem .7rem;line-height:1.3}
.doc-head h3{font-family:var(--font-serif);font-weight:400;font-size:1.15rem;color:var(--green-dark);letter-spacing:-.01em}
.doc-head .src{font-family:var(--font-mono);font-size:.62rem;color:var(--gray);margin-top:.2rem;word-break:break-all}
.doc-head .spacer{flex:1}
.dl{display:inline-flex;align-items:center;gap:.5rem;background:var(--green-dark);color:var(--white);font-size:.74rem;padding:.55rem 1rem;border-radius:999px;white-space:nowrap;transition:background var(--transition)}
.dl:hover{background:var(--green-mid)}
.doc-body{padding:1.5rem 1.8rem 1.9rem}
.markdown-body{font-size:.92rem;color:var(--black)}
.markdown-body h1,.markdown-body h2,.markdown-body h3{font-family:var(--font-serif);font-weight:400;color:var(--green-dark);line-height:1.25;letter-spacing:-.01em;margin:1.6em 0 .5em}
.markdown-body h1{font-size:1.5rem;border-bottom:1px solid var(--color-border-light);padding-bottom:.4rem;margin-top:.2em}
.markdown-body h2{font-size:1.2rem;color:var(--green-mid)} .markdown-body h3{font-size:1.02rem}
.markdown-body p{margin-bottom:.85em} .markdown-body p:last-child{margin-bottom:0}
.markdown-body a{color:var(--green-mid);text-decoration:underline;text-decoration-color:rgba(127,169,142,.4);word-break:break-word}
.markdown-body strong,.markdown-body b{font-weight:600;color:var(--green-dark)}
.markdown-body em{color:var(--green-dark)}
.markdown-body blockquote{font-family:var(--font-serif);font-style:italic;color:var(--green-dark);border-left:2.5px solid var(--amber);background:color-mix(in srgb, var(--cream) 55%, transparent);padding:.8rem 1.2rem;margin:1.1em 0;border-radius:0 10px 10px 0}
.markdown-body code{font-family:var(--font-mono);font-size:.82em;background:var(--cream);color:var(--green-dark);padding:1px 5px;border-radius:5px;border:1px solid var(--color-border-light)}
.markdown-body pre{background:color-mix(in srgb, var(--cream) 65%, transparent);border-left:2.5px solid var(--amber);border-radius:0 10px 10px 0;padding:12px 16px;margin:1.1em 0;overflow-x:auto}
.markdown-body pre code{background:none;border:none;padding:0;color:var(--black);white-space:pre-wrap}
.markdown-body ul,.markdown-body ol{padding-left:1.4em;margin-bottom:.85em}
.markdown-body li{margin-bottom:.25em}
.markdown-body table{border-collapse:collapse;width:100%;margin:1.2em 0;font-size:.82rem;display:block;overflow-x:auto}
.markdown-body th{background:color-mix(in srgb, var(--cream) 70%, transparent);font-family:var(--font-mono);font-size:.62rem;font-weight:500;text-transform:uppercase;letter-spacing:.1em;color:var(--gray-hi);padding:7px 10px;border-bottom:1.5px solid var(--green-dark);text-align:left}
.markdown-body td{padding:6px 10px;border-bottom:1px solid var(--color-border-light);vertical-align:top}
.markdown-body hr{border:none;border-top:1px solid var(--color-border-light);margin:1.6em 0}
.markdown-body img{max-width:100%;border-radius:8px}
.back{display:inline-flex;align-items:center;gap:.5rem;font-size:.8rem;color:var(--green-dark)}
footer{border-top:1px solid var(--color-border-light);padding:2.4rem 2rem 3rem;text-align:center;color:var(--gray);font-size:.78rem}
footer .frow{display:flex;justify-content:center;gap:1.6rem;margin-top:.9rem;flex-wrap:wrap}
footer a{color:var(--green-mid)}
@media (max-width:760px){nav{padding:1rem 1.2rem}nav .links .hide-sm{display:none}main{padding:0 1.2rem}.doc-head{flex-wrap:wrap}.doc-body{padding:1.2rem 1.1rem 1.5rem}}
.reveal{opacity:0;transform:translateY(14px);transition:opacity .6s ease,transform .6s ease}
.reveal.in{opacity:1;transform:none}`;

function buildReadingRoom() {
  const docSections = DOCS.map((doc) => {
    const mdText = fs.readFileSync(path.join(PROJECT, doc.file), 'utf-8');
    const html = marked.parse(stripFrontmatter(mdText));
    return `<section class="doc reveal" id="doc-${doc.n}">
  <div class="doc-head">
    <span class="n">${doc.n}</span>
    <div>
      <h3>${escapeHtml(doc.title)}</h3>
      <div class="src">${escapeHtml(doc.file)} \u00b7 read: ${escapeHtml(doc.time)}</div>
    </div>
    <span class="spacer"></span>
    <a class="dl" href="../uploads/netify-pack/${doc.n}-${doc.label}.pdf" download title="Download PDF"><i class="fas fa-file-pdf"></i> Download PDF</a>
  </div>
  <div class="doc-body markdown-body">${html}</div>
</section>`;
  }).join('\n');

  const orderCards = DOCS.map((doc) =>
    `<a class="order-card reveal" href="#doc-${doc.n}">
       <span class="n">${doc.n}</span>
       <span><span class="t">${escapeHtml(doc.title)}</span><br><span class="d">${escapeHtml(doc.desc)}</span><br><span class="d">${escapeHtml(doc.time)}</span></span>
     </a>`).join('\n');

  const indexTable = DOCS.map((doc) =>
    `<tr><td style="white-space:nowrap">${doc.n}</td><td><a href="#doc-${doc.n}">${escapeHtml(doc.title)}</a></td><td>${escapeHtml(doc.time)}</td><td><a class="dl" style="background:var(--green-mid)" href="../uploads/netify-pack/${doc.n}-${doc.label}.pdf" download>PDF</a></td></tr>`
  ).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="color-scheme" content="light">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Olivia \u00d7 Beverly de Guzman — Project Reading Room</title>
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='9' fill='%237FA98E'/><g transform='translate(6,7) scale(0.31)'><path d='M12 52 Q24 38,34 30 Q44 22,54 16' fill='none' stroke='%23FAF6EF' stroke-width='2.6' stroke-linecap='round' opacity='.75'/><ellipse cx='22' cy='42' rx='4.4' ry='5.5' fill='%23D98A5E'/></g></svg>">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,500;1,9..144,300;1,9..144,400&family=Plus+Jakarta+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
<style>${roomCss}</style>
</head>
<body>

<nav>
  <a href="#top" class="logo">Olivia <span class="tag">\u00d7 Beverly de Guzman</span></a>
  <div class="links">
    <a href="#overview">Overview</a>
    <a href="#order" class="hide-sm">Reading order</a>
    <a href="#index" class="hide-sm">Index</a>
    <a class="cta" href="${MAIN_PAGE_REL}"><i class="fas fa-arrow-left"></i> Main page</a>
  </div>
</nav>

<main id="top">

<header class="hero">
  <div class="kicker">Project reading room</div>
  <h1>Understand the project, <em>in order.</em></h1>
  <p class="lede">This room gathers every document of the <strong>Beverly de Guzman \u00d7 Olivia Ecosystem</strong> project in the order that tells the story best. Read it start to finish, or jump to any document \u2014 every section offers its own <strong>Download PDF</strong> button, exported with the Olivia workspace exporter.</p>
  <div class="quote-line">
    <p>\u201CThe knowledge is already there \u2014 start with the people, then apply AI.\u201D</p>
    <cite>The shared belief at the centre of this project</cite>
  </div>
</header>

<section class="block" id="overview">
  <div class="sec-kicker">In one paragraph</div>
  <h2 class="sec-title">What this pack is</h2>
  <div class="markdown-body">
    <p>This project is a <strong>mutual understanding</strong> between Beverly de Guzman \u2014 founder of Founder Positioning Studio and creator of The Founder Positioning Framework\u2122 \u2014 and the <strong>Olivia Ecosystem</strong>, an AI operating environment that turns the operational knowledge already inside an organisation into working software. Beverly\u2019s discipline (<em>positioning before copy, evidence before opinions</em>) and Olivia\u2019s mission (<em>democratise the creation of AI-powered capability</em>) meet on one belief: <strong>the evidence and the knowledge already exist \u2014 they need translation, not invention.</strong></p>
    <p>The pack is ordered in four parts: <strong>Orientation</strong> (the guide and the profile summary), <strong>Analysis</strong> (cross-reference, content architecture, validation), <strong>Source documents</strong> (your profile, company, conversation and posts), and <strong>Provenance &amp; process</strong> (case-file README and the planning notes).</p>
  </div>
</section>

<section class="block" id="order">
  <div class="sec-kicker">Best read order</div>
  <h2 class="sec-title">Start here, then follow the numbers</h2>
  <div class="order-grid">${orderCards}</div>
</section>

<section class="block" id="index">
  <div class="sec-kicker">Index</div>
  <h2 class="sec-title">All documents &amp; PDFs</h2>
  <div class="markdown-body"><table>
    <thead><tr><th>#</th><th>Document</th><th>Read</th><th>PDF</th></tr></thead>
    <tbody>${indexTable}</tbody>
  </table></div>
</section>

<section class="block" id="docs">
  <div class="sec-kicker">Documents</div>
  <h2 class="sec-title">Read &amp; download</h2>
  ${docSections}
</section>

<section class="block" style="text-align:center">
  <a class="dl" style="font-size:.85rem;padding:.8rem 1.6rem" href="${MAIN_PAGE_REL}"><i class="fas fa-book-open"></i> Return to the mutual-understanding page</a>
</section>

</main>

<footer>
  <div>\u00A9 Olivia Ecosystem \u00b7 Mutual Understanding with Beverly de Guzman</div>
  <div class="frow">
    <a href="${MAIN_PAGE_REL}">Main page</a>
    <a href="reading-guide-beverly-de-guzman.md">Reading guide (source)</a>
    <a href="#top">Back to top</a>
  </div>
</footer>

<script>
document.querySelectorAll('.reveal').forEach(el => {
  new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in'); });
  }, { threshold: .05 }).observe(el);
});
</script>
</body>
</html>`;
}

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: CHROME,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  try {
    await generatePdfs(browser);
  } finally {
    await browser.close();
  }
  fs.writeFileSync(READING_ROOM, buildReadingRoom());
  console.log('\n\u2728 Reading room written: ' + READING_ROOM);
  console.log('\u2728 ' + DOCS.length + ' PDFs in ' + OUT_DIR);
}

main().catch(function (err) { console.error('Error:', err); process.exit(1); });
