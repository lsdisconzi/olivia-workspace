# ADR 0001: Architecture Principles for Olivia Restructuring

**Date:** 2026-08-11
**Status:** Accepted
**Deciders:** Architecture review of `_01_olivia-review-branch/`
**Last amended:** 2026-08-11 (updated-review-2.md consistency pass)

## Context

Olivia has outgrown its implicit architecture. What began as a JavaScript workspace is now a frontend orchestration environment managing a distributed MCP/service ecosystem. The system developed architecture through growth, not design. As we restructure, we need explicit principles to guide decisions and prevent regression.

## Decision

We adopt the following architectural principles. Every restructuring decision must be consistent with them. When principles conflict, higher-numbered principles take precedence.

### Principle 1: Make architecture explicit or remove noise

Restructuring work must either make architecture explicit or remove concrete ambiguity/noise that obstructs architectural understanding. The primary goal is to surface invisible dependencies, contracts, and boundaries. Dead code removal, spelling fixes, and duplicate elimination are valid when they reduce the noise floor that obscures the architecture.

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
- Module identity != Capability identity (what loads this vs. what can Olivia do)
- Service health != Capability availability (is it running vs. can I use it)
- Section visibility != Permission (can I see this vs. am I allowed to do this)
- Configuration != Application state != Session state (static, app-level, transient)
- Frontend authorization != Backend authorization (UI gating vs. security enforcement)
- Tool resolution != Authorization (routing to MCP server vs. permission to execute)

### Principle 7: Frontend permissions are advisory

The frontend Permission Interface asks "should I show/invoke this?" — it is UI gating only. Authoritative authorization occurs server-side before any capability or tool executes. The frontend must never be treated as a security boundary.

### Principle 8: Distinguish runtime truth from contract truth from decision truth

The system has three truth dimensions:
1. **Runtime truth** — what the code actually does (the system's current behavior).
2. **Contract truth** — what the system promises to expose through explicit contracts and manifests.
3. **Decision truth** — what architecture decisions say should happen (ADR records).

Runtime behavior determines whether something actually works. Contracts define intended interfaces. ADRs capture decisions. Documentation is derived from or describes these dimensions. A discrepancy between runtime behavior and contract/ADR intent is a drift condition to be detected and resolved, not evidence that the contract or ADR is wrong.

### Principle 9: Additive changes preferred, not absolute

Prefer additive changes (new files and abstractions) when they reduce migration risk, but do not introduce an abstraction solely to avoid modifying code that should ultimately be simplified or removed. Avoid abstraction layering without actual simplification. "New file" is not synonymous with "good architecture."

### Principle 10: Observability as target architecture

The target architecture requires every execution path to have an identifiable correlation mechanism. Existing paths may lack complete tracing until Phase 5 — this is an architectural target, not a claim about current state. Correlation IDs must flow from browser to model to tool to service and back. Without observability, architecture is faith-based.

### Principle 11: Preserve behavioral compatibility

Restructuring should not silently change what users can accomplish. Architectural restructuring must separate concerns without changing user-visible behavior, API semantics, permissions, data handling, or execution semantics unless the change is explicitly documented and tested. When replacing a raw `fetch()` call with a capability invocation, the test is not "does it return something?" but "does it return exactly the same functional result, authorization behavior, error behavior, timeout behavior, and state effects?"

### Principle 12: No speculative abstractions

Every new abstraction must correspond to an observed existing responsibility or repeated pattern in the codebase. Do not create abstractions solely because they appear architecturally desirable. The Capability Registry, Context Client, Service Registry, and Permission Interface must each be grounded in a verifiable existing pattern before being formalized.

## Truth Hierarchy

When these truth dimensions conflict:

```
Runtime behavior  ──  is it correct that this works differently than intended?
         │
         ├── Against contract?  →  drift condition (contract needs update OR code needs fix)
         ├── Against ADR?       →  drift condition (ADR needs update OR code needs fix)
         └── Against docs?      →  docs are wrong, update them

ADI (decision truth)  ──  highest authority for intended direction
         │
         └── But runtime always wins for "what actually happens right now"
```

The architecture work exists partly to detect and eliminate drift between these dimensions.

## Consequences

### Positive
- Clear decision-making framework for all restructuring work
- Prevents scope creep (no framework migration, no rewrites, no speculative abstractions)
- Enables incremental, reversible changes
- Makes architecture governance explicit
- Prevents silent behavior changes during migration
- Establishes drift detection as an architectural practice

### Negative
- Slower initial progress (documentation-first approach)
- Requires discipline to resist "just fix it" impulses
- Behavioral compatibility requirement (Principle 11) makes some migrations more expensive to verify

### Mitigations
- Phase 1 (sanitize) was completed first to remove noise before documentation
- Phase 2 deliverables are concrete, not open-ended
- Each principle has a clear test: does this action satisfy it?
- Phase 2.5 consistency pass resolves contradictions before Phase 3 abstractions are built

## References
- `_01_olivia-review-branch/Olivia is no longer simply a JavaScript workspace.md` — original assessment
- `_01_olivia-review-branch/updated-review.md` — first review feedback
- `_01_olivia-review-branch/updated-review-2.md` — second review (consistency pass, 16 observations)
- `plannings/task_plan.md` — implementation plan derived from these principles
