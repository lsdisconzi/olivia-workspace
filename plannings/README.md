# Olivia Restructuring — Planning Directory

> Entry point for the Olivia project restructuring documentation.

## File Map

| File | Purpose | Audience | Update Frequency |
|------|---------|----------|-----------------|
| `README.md` | This file — index and navigation | Everyone | When files are added/removed |
| `task_plan.md` | Detailed implementation plan — what to do, in what order, how to verify | Implementers | When the plan changes |
| `findings.md` | Architecture assessment findings — problems discovered, gaps identified | Architects, reviewers | Static (historical record) |
| `progress.md` | Running progress log — what was done, when, by whom, what commit | Project tracking | After each completed action |
| `memory.md` | Institutional context — what Olivia is, MCP ecosystem, why we're restructuring | New team members, future reference | When new context is established |
| `TRACKING.md` | Phase status, decision log, risk tracker, guardrails | Project management | After each phase transition or decision |

## How to Use

1. **New to the project?** Start with `memory.md` for context, then `findings.md` for what's broken.
2. **Implementing?** Read `task_plan.md` for the current phase's actions and verification steps.
3. **Tracking status?** Check `progress.md` for recent activity, `TRACKING.md` for phase/risk/decision state.
4. **Reviewing architecture?** `findings.md` has the assessment; `memory.md` has the target model.

## Quick Status

| Phase | Name | Status |
|-------|------|--------|
| 1 | Sanitize and Clarify | Done (`aa93b1a`) |
| 2 | Map the Architecture | Next |
| 3 | Platform Primitives | Pending |
| 4 | Reduce Coupling | Pending |
| 5 | Observability | Pending |

**Branch:** `olivia-review`
**Principle:** Make implicit architecture explicit. No framework migration.
