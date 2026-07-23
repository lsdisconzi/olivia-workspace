<!--
PURPOSE: The single source of truth for *what* the agent is working on and *where*
it currently is. Agents MUST read this before every meaningful decision and update it
when scope changes. Lives in planning/task_plan.md.
Kept in sync by the orchestration server (serve.py) which injects this file's contents
into every agent run via _read_planning_context().
-->

# Task Plan

## Goal
- [Describe the overall objective of the project or current initiative]

## Current Phase
- [e.g., "planning", "in_progress", "review", "done"]

## Phases
- [ ] Phase 1 — [Short description]
  - [ ] Sub‑step
- [ ] Phase 2 — [Short description]
- [ ] Phase 3 — [Short description]

## Definition of Done
- [ ] Bullet list of conditions that mean this task is finished