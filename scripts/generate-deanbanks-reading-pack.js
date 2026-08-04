#!/usr/bin/env node
/**
 * generate-deanbanks-reading-pack.js
 *
 * Netlify-ready documentation pack for the Dean Banks Group × Olivia project.
 *
 * 1. Exports every project document as a PDF into data/netify/pdfs/ using the
 *    exact same branding as the workspace `downloadPreviewAsPdf` exporter
 *    (frontend/js/modules/output.js): olive-branch mark, "Olivia" header,
 *    "Awareness · AI" footer, forest-green theme, Fraunces / Plus Jakarta Sans
 *    / JetBrains Mono.
 * 2. Copies the original source brochure PDFs into data/netify/originals/.
 * 3. Generates data/netify/index.html — a reading guide / documentation index
 *    in the pastel design system that renders every document inline (in the
 *    guide's read order) and provides "Open PDF" + "Download PDF" per document.
 * 4. Copies the cleaned outreach page to data/netify/outreach.html and injects
 *    cross-links so the two HTML pages navigate to one another.
 *
 * Run from repo root:  node scripts/generate-deanbanks-reading-pack.js
 */

const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const puppeteer = require('puppeteer');

const PROJECT = path.resolve(__dirname, '../uploads/projects/deanbanks');
const OUT_DIR = path.join(PROJECT, 'data/netify/pdfs');
const ORIGINALS_DIR = path.join(PROJECT, 'data/netify/originals');
const INDEX_HTML = path.join(PROJECT, 'data/netify/index.html');
const OUTREACH_SRC = path.join(PROJECT, 'outputs/dean-banks-group-outreach.html');
const OUTREACH_DST = path.join(PROJECT, 'data/netify/outreach.html');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// ── Documents in best-read order ──────────────────────────────────────────────
const DOCS = [
  { n: '01', label: 'group-overview', cat: 'orientation', time: '4 min',
    title: 'The Group at a Glance',
    file: 'data/docs/group-overview.md',
    desc: 'The front door to the pack — who the Dean Banks Group is, its mission, values, portfolio, spirits, delivery brands and services.' },
  { n: '02', label: 'dean-banks-biography', cat: 'orientation', time: '5 min',
    title: 'Dean Banks — Biography & Journey',
    file: 'data/docs/dean-banks-biography.md',
    desc: 'The person behind the group: Arbroath beginnings, global apprenticeship, MasterChef 2018, founding Haar, and his philosophy.' },
  { n: '03', label: 'venues', cat: 'group', time: '8 min',
    title: 'Venues — Six Venues, One Collective',
    file: 'data/docs/venues.md',
    desc: 'Every venue in detail — Haar, Dune, Dulse West End, Dulse Leith, 1925 at The Pompadour and Temple Lane — with capacities and offerings.' },
  { n: '04', label: 'team', cat: 'group', time: '5 min',
    title: 'Leadership Team',
    file: 'data/docs/team.md',
    desc: 'The people who run the collective: Dean, the operations and marketing directors, the group executive chef, and current openings.' },
  { n: '05', label: 'brand-products', cat: 'group', time: '6 min',
    title: 'Brand Products & Spirits',
    file: 'data/docs/brand-products.md',
    desc: 'Lunun Gin, Mond Vodka, Haar at Home, Waagyu, Shaaken and the private chef service — the brands that extend the group beyond the venues.' },
  { n: '06', label: 'brand-partners', cat: 'group', time: '3 min',
    title: 'Brand Partners',
    file: 'data/docs/brand-partners.md',
    desc: 'The curated partner network — wines, champagnes, spirits, food & beverage and sustainability partners.' },
  { n: '07', label: 'private-dining-events', cat: 'events', time: '5 min',
    title: 'Private Dining, Weddings & Events',
    file: 'data/docs/private-dining-events.md',
    desc: 'Private dining at 1925, weddings, corporate & private events across the group, and the booking FAQs.' },
  { n: '08', label: 'private-hire-brochure', cat: 'events', time: '10 min',
    title: 'Private Hire Brochure',
    file: 'data/docs/private-hire-brochure.md',
    desc: 'The full private hire story: a life of cooking, the route to the restaurant, and each venue as a hire option.' },
  { n: '09', label: 'wedding-brochure-pompadour', cat: 'events', time: '5 min',
    title: 'Pompadour Wedding Brochure',
    file: 'data/docs/wedding-brochure-pompadour.md',
    desc: 'The Pompadour wedding offering — spaces, the food philosophy, menus & pricing and included services.' },
  { n: '10', label: 'olivia-alignment', cat: 'alignment', time: '8 min',
    title: 'Olivia Alignment — Analysis',
    file: 'data/dean-banks-olivia-alignment.md',
    desc: 'Why the group and Olivia fit: the alignment matrix, the strongest alignments, honest caveats and the shared-intelligence model.' },
];

const CATS = [
  { id: 'orientation', label: 'Part A · Orientation' },
  { id: 'group', label: 'Part B · The Group' },
  { id: 'events', label: 'Part C · Events & Brochures' },
  { id: 'alignment', label: 'Part D · The Olivia Alignment' },
];

const ORIGINALS = [
  { file: 'data/pdf/DB-GROUP-BROCHURE-960-x-540-px.pdf',
    title: 'Dean Banks Group — Full Brochure',
    note: 'The original group brochure source PDF.' },
  { file: 'data/pdf/POMPADOUR-WEDDING-BROCHURE-3.pdf',
    title: 'Pompadour Wedding Brochure (Original)',
    note: 'The original Pompadour wedding brochure source PDF.' },
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
.doc-footer{ margin-top:36px; padding-top:10px; border-top:1px solid var(--border); display:flex; align-items:center; justify-content:space-between; gap:12px; font-family:var(--font-mono); font-size:7pt; color:var(--gray); }
.wm{ display:flex; align-items:baseline; gap:5px; } .wm-n{ font-family:var(--font-serif); font-size:9pt; color:var(--green-dark); letter-spacing:-0.01em; } .wm-s{ font-size:6.5pt; text-transform:uppercase; letter-spacing:.1em; color:var(--gray); }
@media print{ body{ background:#fff; } a{ color:var(--green-mid)!important; } pre,blockquote,table{ break-inside:avoid; } h1,h2,h3{ break-after:avoid; } }`;

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function stripFrontmatter(md) {
  return md.replace(/^---[\s\S]*?---\s*\n/, '');
}

function buildPrintHtml(mdText, fileName, docLabel) {
  const bodyHtml = marked.parse(stripFrontmatter(mdText));
  const stamp = new Date().toLocaleString();
  const isoDate = new Date().toISOString().slice(0, 10);
  return '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>' + escapeHtml(docLabel) + '</title>\n' +
    '<link rel="preconnect" href="https://fonts.googleapis.com">\n' +
    '<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,500;1,9..144,300;1,9..144,400&family=Plus+Jakarta+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">\n' +
    '<style>\n' + printCss + '\n</style>\n</head>\n<body>\n' +
    '<div class="doc-header"><div class="doc-header-mark">' + oliveMark + '</div>' +
    '<div class="doc-header-brand">Olivia <span>Dean Banks Group</span></div>' +
    '<div class="doc-header-meta"><strong>' + escapeHtml(fileName) + '</strong>' + escapeHtml(stamp) + '</div></div>\n' +
    '<div class="doc-body">' + bodyHtml + '</div>\n' +
    '<div class="doc-footer"><div class="wm"><span class="wm-n">Olivia</span><span class="wm-s">Awareness \u00b7 AI</span></div>' +
    '<span>Dean Banks Group \u00b7 Documentation \u00b7 ' + escapeHtml(isoDate) + '</span></div>\n' +
    '</body>\n</html>';
}

async function generatePdfs(browser) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const doc of DOCS) {
    const mdText = fs.readFileSync(path.join(PROJECT, doc.file), 'utf-8');
    const html = buildPrintHtml(mdText, doc.file, doc.title);
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

function copyOriginals() {
  fs.mkdirSync(ORIGINALS_DIR, { recursive: true });
  for (const orig of ORIGINALS) {
    const src = path.join(PROJECT, orig.file);
    const dst = path.join(ORIGINALS_DIR, path.basename(orig.file));
    fs.copyFileSync(src, dst);
    console.log('\u2713 original copied: ' + path.basename(orig.file));
  }
}

// ── Reading guide / index page (pastel design system, same tokens as outreach) ─
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
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
.rail{position:fixed;left:20px;top:0;bottom:0;width:1px;z-index:5;pointer-events:none}
.rail::before{content:'';position:absolute;left:0;top:64px;bottom:64px;width:1px;background:linear-gradient(var(--green-mid),var(--color-border-light) 40%,var(--color-border-light) 60%,var(--amber));opacity:.4}
.rail .dot{position:absolute;left:-2.5px;width:6px;height:6px;border-radius:50%}
.rail .dot.top{top:60px;background:var(--green-mid)}
.rail .dot.bottom{bottom:60px;background:var(--amber)}
@media (max-width:900px){.rail{display:none}}
nav{position:fixed;top:0;left:0;right:0;z-index:40;display:flex;align-items:center;justify-content:space-between;padding:1.1rem 2.4rem;backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);background:color-mix(in srgb, var(--white) 82%, transparent);border-bottom:1px solid var(--color-border-light)}
nav .logo{display:flex;align-items:baseline;gap:.5rem;font-family:var(--font-serif);font-size:1.15rem;color:var(--green-dark);letter-spacing:-.01em}
nav .logo .tag{font-family:var(--font-mono);font-size:.56rem;letter-spacing:.14em;text-transform:uppercase;color:var(--gray);font-weight:400}
nav .links{display:flex;gap:1.5rem;align-items:center}
nav .links a{font-size:.82rem;color:var(--gray-hi);transition:color var(--transition)}
nav .links a:hover{color:var(--amber)}
nav .links .cta{background:var(--green-dark);color:var(--white);padding:.5rem 1.1rem;border-radius:999px;font-size:.78rem}
nav .links .cta:hover{background:var(--green-mid);color:var(--white)}
main{max-width:1120px;margin:0 auto;padding:0 2rem}
.hero{padding:8.5rem 0 3.5rem}
.kicker{font-family:var(--font-mono);font-size:.68rem;letter-spacing:.22em;text-transform:uppercase;color:var(--amber)}
.hero h1{font-family:var(--font-serif);font-weight:400;font-size:clamp(2.1rem,4.4vw,3.3rem);line-height:1.12;color:var(--green-dark);margin:1rem 0 1.3rem;letter-spacing:-.015em}
.hero h1 em{font-style:italic;color:var(--amber);font-weight:300}
.hero .lede{max-width:680px;color:var(--gray-hi);font-size:1.02rem;font-weight:300}
.quote-line{border-left:2.5px solid var(--amber);background:var(--paper);padding:1.2rem 1.5rem;margin:1.6rem 0 0;border-radius:0 12px 12px 0;max-width:720px}
.quote-line p{font-family:var(--font-serif);font-style:italic;font-size:1.05rem;color:var(--green-dark)}
.quote-line cite{display:block;margin-top:.5rem;font-family:var(--font-sans);font-style:normal;font-size:.75rem;color:var(--gray);letter-spacing:.04em}
section.block{padding:2.6rem 0}
.sec-kicker{font-family:var(--font-mono);font-size:.64rem;letter-spacing:.2em;text-transform:uppercase;color:var(--amber)}
h2.sec-title{font-family:var(--font-serif);font-weight:400;font-size:1.65rem;color:var(--green-dark);margin:.5rem 0 1.4rem;letter-spacing:-.01em}
h2.sec-title em{font-style:italic;color:var(--amber);font-weight:300}
.order-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:1rem}
.order-card{background:var(--paper);border:1px solid var(--color-border-light);border-radius:14px;padding:1.1rem 1.2rem;display:flex;gap:.9rem;align-items:flex-start;transition:border-color var(--transition),transform var(--transition)}
.order-card:hover{border-color:var(--color-border-medium);transform:translateY(-2px)}
.order-card .n{font-family:var(--font-serif);font-size:1.15rem;color:var(--amber);min-width:2rem;text-align:center;background:color-mix(in srgb, var(--cream) 70%, transparent);border-radius:10px;padding:.25rem 0}
.order-card .t{font-weight:600;color:var(--green-dark);font-size:.9rem}
.order-card .d{color:var(--gray-hi);font-size:.78rem;margin-top:.2rem}
.order-card .dl{color:var(--green-mid);font-size:.72rem;display:inline-block;margin-top:.35rem}
.doc{background:var(--paper);border:1px solid var(--color-border-light);border-radius:18px;margin:1.6rem 0;overflow:hidden;scroll-margin-top:90px}
.doc-head{display:flex;align-items:center;gap:1rem;padding:1.1rem 1.4rem;border-bottom:1px solid var(--color-border-light);background:color-mix(in srgb, var(--white) 55%, transparent);flex-wrap:wrap}
.doc-head .n{font-family:var(--font-serif);font-size:1.5rem;color:var(--amber);background:color-mix(in srgb, var(--cream) 80%, transparent);border-radius:12px;padding:.2rem .7rem;line-height:1.3}
.doc-head h3{font-family:var(--font-serif);font-weight:400;font-size:1.15rem;color:var(--green-dark);letter-spacing:-.01em}
.doc-head .src{font-family:var(--font-mono);font-size:.62rem;color:var(--gray);margin-top:.2rem;word-break:break-all}
.doc-head .spacer{flex:1}
.dl{display:inline-flex;align-items:center;gap:.5rem;background:var(--green-dark);color:var(--white);font-size:.74rem;padding:.55rem 1rem;border-radius:999px;white-space:nowrap;transition:background var(--transition)}
.dl:hover{background:var(--green-mid);color:var(--white)}
.dl.ghost{background:transparent;color:var(--green-dark);border:1px solid var(--color-border-medium)}
.dl.ghost:hover{background:var(--cream);color:var(--green-dark)}
.doc-actions{display:flex;gap:.55rem;flex-wrap:wrap}
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
.orig-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:1rem}
.orig-card{background:var(--paper);border:1px solid var(--color-border-light);border-radius:14px;padding:1.2rem 1.3rem;display:flex;flex-direction:column;gap:.5rem;transition:border-color var(--transition),transform var(--transition)}
.orig-card:hover{border-color:var(--color-border-medium);transform:translateY(-2px)}
.orig-card h4{font-family:var(--font-serif);font-weight:400;font-size:1.02rem;color:var(--green-dark)}
.orig-card p{font-size:.78rem;color:var(--gray-hi)}
.orig-card .dl{align-self:flex-start;margin-top:.3rem}
footer{border-top:1px solid var(--color-border-light);padding:2.4rem 2rem 3rem;text-align:center;color:var(--gray);font-size:.78rem}
footer .frow{display:flex;justify-content:center;gap:1.6rem;margin-top:.9rem;flex-wrap:wrap}
footer a{color:var(--green-mid)}
@media (max-width:760px){nav{padding:1rem 1.2rem}nav .links .hide-sm{display:none}main{padding:0 1.2rem}.doc-body{padding:1.2rem 1.1rem 1.5rem}}
.reveal{opacity:0;transform:translateY(14px);transition:opacity .6s ease,transform .6s ease}
.reveal.in{opacity:1;transform:none}`;

function pdfHref(doc) { return 'pdfs/' + doc.n + '-' + doc.label + '.pdf'; }

function buildReadingGuide() {
  const docSections = DOCS.map((doc) => {
    const mdText = fs.readFileSync(path.join(PROJECT, doc.file), 'utf-8');
    const html = marked.parse(stripFrontmatter(mdText));
    return `<section class="doc reveal" id="doc-${doc.n}">
  <div class="doc-head">
    <span class="n">${doc.n}</span>
    <div>
      <h3>${escapeHtml(doc.title)}</h3>
      <div class="src">${escapeHtml(doc.file)} &middot; read: ${escapeHtml(doc.time)}</div>
    </div>
    <span class="spacer"></span>
    <div class="doc-actions">
      <a class="dl ghost" href="${pdfHref(doc)}" target="_blank" rel="noopener" title="Open in a new tab"><i class="fas fa-book-open"></i> Open PDF</a>
      <a class="dl" href="${pdfHref(doc)}" download title="Download PDF"><i class="fas fa-file-pdf"></i> Download PDF</a>
    </div>
  </div>
  <div class="doc-body markdown-body">${html}</div>
</section>`;
  }).join('\n');

  const orderCards = DOCS.map((doc) =>
    `<a class="order-card reveal" href="#doc-${doc.n}">
       <span class="n">${doc.n}</span>
       <span><span class="t">${escapeHtml(doc.title)}</span><br><span class="d">${escapeHtml(doc.desc)}</span><br><span class="d">${escapeHtml(doc.time)}</span><br><span class="dl"><i class="fas fa-file-pdf"></i> Open PDF</span></span>
     </a>`).join('\n');

  const indexTable = DOCS.map((doc) =>
    `<tr><td style="white-space:nowrap">${doc.n}</td><td><a href="#doc-${doc.n}">${escapeHtml(doc.title)}</a></td><td>${escapeHtml(doc.time)}</td><td><a class="dl ghost" style="background:transparent;border:1px solid var(--color-border-medium);color:var(--green-dark);font-size:.66rem;padding:.35rem .7rem" href="${pdfHref(doc)}" target="_blank" rel="noopener"><i class="fas fa-book-open"></i> Open</a></td><td><a class="dl" style="background:var(--green-mid);font-size:.66rem;padding:.35rem .7rem" href="${pdfHref(doc)}" download>PDF</a></td></tr>`
  ).join('\n');

  const origCards = ORIGINALS.map((orig) => {
    const name = path.basename(orig.file);
    return `<article class="orig-card reveal">
      <h4>${escapeHtml(orig.title)}</h4>
      <p>${escapeHtml(orig.note)}</p>
      <a class="dl" href="originals/${escapeHtml(name)}" target="_blank" rel="noopener" download><i class="fas fa-file-pdf"></i> Open / Download PDF</a>
    </article>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="color-scheme" content="light">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Olivia × Dean Banks Group — Reading Guide &amp; Documentation Index</title>
<meta name="description" content="Reading guide and documentation index for the Dean Banks Group project — every document in best-read order, with open and download options for each PDF.">
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='9' fill='%237FA98E'/><g transform='translate(6,7) scale(0.31)'><path d='M12 52 Q24 38,34 30 Q44 22,54 16' fill='none' stroke='%23FAF6EF' stroke-width='2.6' stroke-linecap='round' opacity='.75'/><ellipse cx='22' cy='42' rx='4.4' ry='5.5' fill='%23D98A5E'/></g></svg>">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,500;1,9..144,300;1,9..144,400&family=Plus+Jakarta+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
<style>${roomCss}</style>
</head>
<body>

<div class="rail"><span class="dot top"></span><span class="dot bottom"></span></div>

<nav>
  <a href="#top" class="logo">Olivia <span class="tag">Dean Banks Group · Reading Guide</span></a>
  <div class="links">
    <a href="#overview">Overview</a>
    <a href="#order" class="hide-sm">Reading order</a>
    <a href="#index" class="hide-sm">Index</a>
    <a href="#docs" class="hide-sm">Documents</a>
    <a class="cta" href="outreach.html"><i class="fas fa-arrow-left"></i> Outreach page</a>
  </div>
</nav>

<main id="top">

<header class="hero">
  <div class="kicker">Reading guide &amp; documentation index</div>
  <h1>Understand the project, <em>in order.</em></h1>
  <p class="lede">This guide gathers every document of the <strong>Dean Banks Group × Olivia</strong> project in the order that tells the story best — from the group at a glance to the deep-dive alignment analysis. Read it start to finish, or jump straight to any document: each section offers an <strong>Open PDF</strong> and a <strong>Download PDF</strong> button, exported with the Olivia workspace exporter.</p>
  <div class="quote-line">
    <p>&ldquo;Technology has always asked people to learn software. Olivia asks software to learn people.&rdquo;</p>
    <cite>Olivia · AI Operating Environment</cite>
  </div>
</header>

<section class="block" id="overview">
  <div class="sec-kicker">In one paragraph</div>
  <h2 class="sec-title">What this pack is</h2>
  <div class="markdown-body">
    <p>The <strong>Dean Banks Group</strong> is a Scottish chef-led hospitality collective — six venues, two spirits brands, delivery concepts, a private chef service, and weddings &amp; events — founded and led by Chef Dean Banks. This documentation pack collects everything the project knows about the group, ordered to build understanding progressively.</p>
    <p>The pack is organised in four parts: <strong>Part A · Orientation</strong> (the group at a glance and the person behind it), <strong>Part B · The Group</strong> (venues, team, brands and partners), <strong>Part C · Events &amp; Brochures</strong> (private dining, weddings and the full brochures), and <strong>Part D · The Olivia Alignment</strong> (the analysis of why the group and Olivia fit).</p>
    <p>Every document is available as a branded PDF &mdash; readable in the browser and downloadable &mdash; alongside the original source brochures in the <a href="#originals">Originals</a> section.</p>
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
    <thead><tr><th>#</th><th>Document</th><th>Read</th><th>Open</th><th>Download</th></tr></thead>
    <tbody>${indexTable}</tbody>
  </table></div>
</section>

<section class="block" id="docs">
  <div class="sec-kicker">Documents</div>
  <h2 class="sec-title">Read &amp; download</h2>
  ${docSections}
</section>

<section class="block" id="originals">
  <div class="sec-kicker">Original source PDFs</div>
  <h2 class="sec-title">The source brochures</h2>
  <p class="lede" style="color:var(--gray-hi);font-size:.9rem;margin-bottom:1.4rem">The original brochure files the structured documentation was drawn from. Open them in the browser or download them for reference.</p>
  <div class="orig-grid">${origCards}</div>
</section>

<section class="block" style="text-align:center">
  <a class="dl" style="font-size:.85rem;padding:.8rem 1.6rem" href="outreach.html"><i class="fas fa-arrow-left"></i> Visit the Olivia × Dean Banks Group outreach page</a>
</section>

</main>

<footer>
  <div>© Olivia Ecosystem · Dean Banks Group Documentation</div>
  <div class="frow">
    <a href="outreach.html">Outreach page</a>
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

// ── Outreach page copy + cross-link injection ─────────────────────────────────
function writeOutreachCopy() {
  let html = fs.readFileSync(OUTREACH_SRC, 'utf-8');

  // Inject a "Reading Guide" nav link just before the agent badge.
  html = html.replace(
    '        <span class="agent-badge"><span class="d"></span> Agent online</span>',
    '        <a href="index.html">Reading Guide</a>\n        <span class="agent-badge"><span class="d"></span> Agent online</span>'
  );

  // Inject a "Reading Guide" footer link.
  html = html.replace(
    '        <a href="#demo">Book a demonstration</a>',
    '        <a href="index.html">Reading Guide</a>\n        <a href="#demo">Book a demonstration</a>'
  );

  fs.writeFileSync(OUTREACH_DST, html);
  console.log('\u2713 outreach page written: ' + OUTREACH_DST);
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
  copyOriginals();
  fs.writeFileSync(INDEX_HTML, buildReadingGuide());
  writeOutreachCopy();
  console.log('\n\u2728 Reading guide written: ' + INDEX_HTML);
  console.log('\u2728 ' + DOCS.length + ' PDFs in ' + OUT_DIR);
  console.log('\u2728 ' + ORIGINALS.length + ' original PDFs in ' + ORIGINALS_DIR);
}

main().catch(function (err) { console.error('Error:', err); process.exit(1); });
