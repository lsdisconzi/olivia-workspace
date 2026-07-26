<!--
PURPOSE: The single source of truth for *what* the agent is working on and *where*
it currently is. Agents MUST read this before every meaningful decision and update it
when scope changes. Lives in planning/task_plan.md.
Kept in sync by the orchestration server (serve.py) which injects this file's contents
into every agent run via _read_planning_context().
-->

# Task Plan

## Goal
- Implement a UI-fidelity PDF export engine that allows users to download AI responses as PDFs while preserving the exact rendered HTML structure, tables, headings, evidence blocks, and visual hierarchy

## Current Phase
- Phase 2 — Frontend Integration (complete)

## Phases
- [x] Phase 1 — Project Setup & Architecture Design
  - [x] Define document schema for shared representation — Uses existing chat message schema { role, html, timestamp }
  - [x] Choose PDF generation approach — Client-side iframe + window.print() (browser native "Save as PDF")
- [x] Phase 2 — Frontend Integration
  - [x] Add PDF export button to response component — Already existed at index.html:2090
  - [x] Create print-specific CSS styles — Branded CSS in olivia-pdf-export.js (Fraunces/Plus Jakarta Sans/JetBrains Mono, forest green/cream/amber palette)
  - [x] Load script in HTML — Added to both index.html and index-i18n.html
  - [x] Expose function on window — Added window.downloadLastResponseAsPdf and window.OLIVIA_PDF_BRAND
- [ ] Phase 3 — Backend PDF Service (optional — client-side approach may suffice)
  - [ ] Implement server-side PDF generation endpoint (if needed for server-side export)
- [ ] Phase 4 — Testing & Refinement
  - [ ] Verify PDF matches UI at 95% fidelity
  - [ ] Test all response elements (tables, headings, citations)
- [ ] Phase 5 — Export Modes
  - [ ] Visual Copy mode (default)
  - [ ] Professional Report mode
  - [ ] Evidence Package mode

## Definition of Done
- [x] PDF export button visible in chat response area — index.html:2090
- [x] Clicking button generates PDF matching UI structure — downloadLastResponseAsPdf() via iframe + window.print()
- [x] Tables, headings, entity blocks preserved — CSS handles tables, h1-h4, pre, blockquote, code
- [x] Evidence cards with metadata included — HTML from _lastAssistantMessage().html is injected as-is
- [x] Citations and references maintained — Preserved through HTML passthrough
- [ ] Three export modes implemented — Only Visual Copy (browser print) implemented
- [x] Print-specific CSS handles page breaks — @page margins, page-break-inside/avoid, orphans/widows