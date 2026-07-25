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
- planning

## Phases
- [ ] Phase 1 — Project Setup & Architecture Design
  - [ ] Define document schema for shared representation
  - [ ] Choose PDF generation approach (Chromium/Puppeteer recommended)
- [ ] Phase 2 — Frontend Integration
  - [ ] Add PDF export button to response component
  - [ ] Create print-specific CSS styles
- [ ] Phase 3 — Backend PDF Service
  - [ ] Implement PDF generation endpoint
  - [ ] Integrate Puppeteer for HTML-to-PDF conversion
- [ ] Phase 4 — Testing & Refinement
  - [ ] Verify PDF matches UI at 95% fidelity
  - [ ] Test all response elements (tables, headings, citations)
- [ ] Phase 5 — Export Modes
  - [ ] Visual Copy mode (default)
  - [ ] Professional Report mode
  - [ ] Evidence Package mode

## Definition of Done
- [ ] PDF export button visible in chat response area
- [ ] Clicking button generates PDF matching UI structure
- [ ] Tables, headings, entity blocks preserved
- [ ] Evidence cards with metadata included
- [ ] Citations and references maintained
- [ ] Three export modes implemented
- [ ] Print-specific CSS handles page breaks