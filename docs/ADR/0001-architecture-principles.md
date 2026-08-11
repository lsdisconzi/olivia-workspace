# ADR 0001: Architecture Principles for Olivia Restructuring

**Date:** 2026-08-11
**Status:** Accepted
**Deciders:** Architecture review of `_01_olivia-review-branch/`

## Context

Olivia has outgrown its implicit architecture. What began as a JavaScript workspace is now a frontend orchestration environment managing a distributed MCP/service ecosystem. The system developed architecture through growth, not design. As we restructure, we need explicit principles to guide decisions and prevent regression.

## Decision

We adopt the following architectural principles. Every restructuring decision must be consistent with them. When principles conflict, higher-numbered principles take precedence.

### Principle 1: Make implicit architecture explicit

The primary problem is not missing technology — it is invisible architecture. Every restructuring action should make a dependency, contract, or boundary visible that was previously implicit. If an action doesn't make something more explicit, it doesn't belong in this restructuring.

### Principle 2: Document before changing

Understanding must precede modification. No runtime abstraction (Phase 3) may be built before the relevant domain is documented (Phase 2). No module migration (Phase 4) may proceed before its contracts are defined (Phase 3). This prevents encoding incorrect assumptions into new abstractions.

### Principle 3: No framework migration

Do not introduce React, Vue, TypeScript, or any frontend framework. The problem is architectural, not technological. Adding a framework would create a parallel migration track, not solve the underlying issue. The existing `<script>` tag + `window.*` pattern can be disciplined without being replaced.

### Principle 4: One module at a time

No big-bang changes. Each migration targets exactly one coupling hotspot. Each change is independently committable, testable, and reversible. If a change can't be described in one sentence, it's too large.

### Principle 5: Contracts before implementations

Define the interface before writing the code. The capability manifest defines what Olivia can do before the Capability Registry implements how. The Context Manager contract defines the frontend-backend boundary before the Context Client wraps it. Contracts are the architecture; code is the implementation.

### Principle 6: Separate concerns that are currently conflated

The architecture assessment identified several conflations that must be separated:
- Module identity ≠ Capability identity (what loads this vs. what can Olivia do)
- Service health ≠ Capability availability (is it running vs. can I use it)
- Section visibility ≠ Permission (can I see this vs. am I allowed to do this)
- Configuration ≠ Application state ≠ Session state (static, app-level, transient)
- Frontend authorization ≠ Backend authorization (UI gating vs. security enforcement)

### Principle 7: Frontend permissions are advisory

The frontend Permission Interface asks "should I show/invoke this?" — it is UI gating only. Authoritative authorization occurs server-side before any capability or tool executes. The frontend must never be treated as a security boundary.

### Principle 8: The code is the source of truth

Documentation describes the code; it does not define it. Generated documentation (Phase 5) must be labeled as derived, not canonical. When documentation and code disagree, the code is correct — and the documentation must be fixed.

### Principle 9: Additive changes preferred

Prefer adding new files and abstractions over modifying existing ones, especially in early phases. This reduces blast radius. Existing code can be migrated to new abstractions incrementally after the abstractions are proven.

### Principle 10: Observability is not optional

Every execution must be traceable. Correlation IDs flow from browser to model to tool to service and back. Without observability, architecture is faith-based. Phase 5 is not a nice-to-have.

## Consequences

### Positive
- Clear decision-making framework for all restructuring work
- Prevents scope creep (no framework migration, no rewrites)
- Enables incremental, reversible changes
- Makes architecture governance explicit

### Negative
- Slower initial progress (documentation-first approach)
- Requires discipline to resist "just fix it" impulses
- Some useful refactoring may be deferred if it doesn't make architecture explicit (Principle 1)

### Mitigations
- Phase 1 (sanitize) was completed first to remove noise before documentation
- Phase 2 deliverables are concrete, not open-ended
- Each principle has a clear test: does this action satisfy it?

## References
- `_01_olivia-review-branch/Olivia is no longer simply a JavaScript workspace.md` — original assessment
- `_01_olivia-review-branch/updated-review.md` — review feedback incorporated into this ADR
- `plannings/task_plan.md` — implementation plan derived from these principles
