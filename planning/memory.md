<!--
PURPOSE: Persistent cross-session context for the agent — the *sticky brain*. Unlike
findings.md (raw evidence) and progress.md (per-session log), memory.md carries
durable facts that must survive across runs: conventions to follow, key entities,
open questions, and things explicitly never to redo. Agents read this before starting
and update it after settling decisions.
Lives in planning/memory.md; auto-injected into every agent run by serve.py.
-->

# Memory

## Decisions & Conventions (sticky)
- [Convention or decision that must persist across sessions]
- [e.g., "Use `LA8159API` named import", "Never touch legacy frontend/ until Phase 8"]

## Key Entities / Project Facts
- [List important paths, IDs, configuration, etc.]

## Open Questions / Parked Ideas
- [Questions that remain unresolved, ideas for future exploration]

## Do‑Not‑Redo
- [Things that were tried and failed, or that must not be repeated]