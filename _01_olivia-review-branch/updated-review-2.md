Overall, I think this is substantially stronger than the restructuring plan alone. The ADR, Glossary, Execution Model, and Source-of-Truth Map turn the restructuring from “clean up some JavaScript” into an actual architecture-governance exercise.

But I would not yet freeze these four documents as canonical. There are several contradictions and a few places where the documents assert architectural facts that the plan itself has not established. Those are exactly the kinds of inconsistencies that later become technical debt.

My assessment: good architecture foundation, but it needs one consistency pass before implementation proceeds beyond Phase 2.

⸻

1. The strongest part: the architecture is being made explicit

The central thesis is excellent:

“The primary problem is not missing technology — it is invisible architecture.”

That is the right diagnosis given the system you’ve described.

In particular, I strongly agree with:

* no framework migration;
* no rewrite;
* documentation before abstraction;
* one coupling hotspot at a time;
* contracts before implementations;
* explicit separation of state, capabilities, modules, services and permissions;
* frontend permissions being advisory;
* incremental migration;
* observability being treated as architecture rather than logging.

This is much more disciplined than the usual “let’s refactor the frontend” approach.

The Glossary + Execution Model + Source-of-Truth Map are particularly valuable because they attack three different problems:

Artifact	Problem it solves
ADR	Why decisions are being made
Glossary	What things mean
Execution Model	How things move
Source-of-Truth Map	Where truth lives

That is a very good architecture-documentation quartet.

⸻

2. There is one important contradiction between the ADR and Source-of-Truth Map

The ADR says:

Principle 8: The code is the source of truth

But the Source-of-Truth Map says:

Manifest over code comments — capability-manifest.json over inline comments

And the ADR says:

“Contracts are the architecture; code is the implementation.”

These ideas aren’t quite compatible yet.

You actually have three different concepts:

1. Runtime truth — what the system actually does.
2. Contract truth — what the system promises to expose.
3. Documentation truth — what humans are told.

Those should not be collapsed into one “source of truth.”

I’d recommend changing Principle 8 to something closer to:

Runtime behavior is the source of truth for current behavior. Explicit contracts are the source of truth for intended interfaces. Documentation is derived from or describes those contracts and runtime behavior.

That distinction is extremely important.

Otherwise you create this paradox:

“The capability manifest defines the contract.”

but also:

“Code is the source of truth.”

If the manifest says a capability exists but the code doesn’t implement it, which one wins?

The answer should probably be:

Runtime implementation determines whether it actually works; the contract determines what it is supposed to provide.

That is a much healthier architecture.

⸻

3. The biggest concrete inconsistency: 4 execution paths vs 5

This appears in several places.

The original restructuring plan says:

“Document the 4 canonical execution paths”

The Glossary says:

“One of the five canonical ways”

The Execution Model then defines:

1. Chat / Assistant
2. Direct Capability Call
3. SSE Streaming
4. Remote Bus
5. Context Resolution

The problem is deeper than numbering.

SSE streaming is arguably not an execution path at the same architectural level as Chat or Remote Bus.

SSE is a transport/execution mechanism, while:

* Chat is an interaction path;
* Direct Capability Call is an interaction path;
* Remote Bus is a command path;
* Context Resolution is a supporting pipeline.

So right now the taxonomy mixes levels of abstraction.

That’s dangerous because eventually developers will ask:

“Which execution path does this feature belong to?”

and the answer becomes ambiguous.

I would restructure this into layers.

For example:

Interaction paths

* Chat / Assistant
* Direct Capability
* Remote Bus

Supporting pipelines

* Context Resolution
* Authentication / Authorization
* History Persistence

Transport mechanisms

* HTTP REST
* SSE
* MCP
* Remote Bus polling

Then SSE doesn’t have to pretend to be a peer of Chat.

This would make the architecture significantly cleaner.

⸻

4. The Execution Model currently contains some assertions that look stronger than the evidence

For example:

“Every execution path has at least two authorization checks”

I would remove or soften that.

The table itself demonstrates why.

You have:

* section visibility;
* capability display;
* capability execution;
* tool execution;
* resource access.

But section visibility isn’t authorization. It is UI filtering.

The ADR correctly says:

“Frontend permissions are advisory.”

Therefore calling section visibility an authorization check muddies the distinction.

Also, a direct REST capability call might have:

endpoint authorization → resource authorization

while a simple UI operation might have only one relevant backend authorization boundary.

And Context Resolution isn’t necessarily an “execution” in the same sense as an agent run.

I’d replace:

Every execution path has at least two authorization checks.

with something like:

Authorization may occur at multiple layers depending on the execution path. Frontend visibility and capability gating are advisory; backend capability, tool, and resource checks are authoritative where applicable.

Much more defensible.

⸻

5. agent-functions-registry.js should not casually be described as an authorization boundary

The Execution Model says:

[AUTHORIZATION: checks tool permissions]

at agent-functions-registry.js.

That deserves verification.

There is an important distinction between:

tool resolution

and

authorization.

If agent-functions-registry.js merely does:

tool name → MCP server → transport

then it is a routing/resolution layer, not an authorization layer.

Even if it filters tools based on permissions, you need to determine whether that filtering is actually authoritative.

The ADR says backend authorization is authoritative.

Therefore the architecture should distinguish:

Tool discovery
      ↓
Tool resolution
      ↓
Authorization
      ↓
Execution

rather than merging those concepts.

This is exactly the kind of subtle distinction your restructuring is supposed to make explicit.

⸻

6. The garge / garage issue needs to be resolved more rigorously

This is probably the most obvious terminology problem.

The Glossary says:

garge / garage

and:

“Sometimes spelled ‘garge’ in older documentation — the canonical spelling is ‘garage.’”

But throughout the Execution Model and Source-of-Truth Map you continue to use:

garge

For example:

garge REST endpoint

garge-qdrant

garge (assistants API)

This creates ambiguity between:

* an actual service named garge;
* an actual service named garage;
* an old typo;
* a filesystem/repository naming convention;
* an API hostname;
* an MCP service name.

Do not normalize this merely as a spelling correction until you’ve established the actual runtime identifiers.

I’d explicitly distinguish:

Concept	Canonical name
Human-facing architecture term	Garage
Actual executable/service identifier	garge if that’s what the process/API actually uses
Historical typo in prose	garge
MCP server identifier	exact runtime identifier

If the runtime really is garge, then calling it “garage” everywhere may actually make the architecture less accurate.

This is one place where runtime truth must win over naming preference.

⸻

7. The Capability Registry has a design problem already

The restructuring plan says:

Capability Registry … “populated initially from module-manifest.json”

But the Glossary explicitly introduces:

capability-manifest.json

and says:

“Capability Manifest … Distinct from the module manifest.”

I strongly agree with the distinction.

Therefore the Phase 3 plan should be corrected.

The architecture should probably be:

module-manifest.json
        │
        │ describes
        ▼
Frontend modules
        │
        │ consume
        ▼
capability-manifest.json
        │
        │ defines capability contract
        ▼
Capability Registry
        │
        ▼
runtime invocation

Not:

module-manifest
       ↓
capability registry

Otherwise the capability registry becomes a projection of which modules happen to use capabilities, which is conceptually wrong.

A capability should exist independently of the module that invokes it.

This is actually one of the best architectural principles in your ADR:

Module identity ≠ Capability identity.

The implementation plan needs to obey that principle.

⸻

8. The Source-of-Truth Map is excellent, but one entry is particularly questionable

This:

Module inventory | module-manifest.json | → docs, capability registry | Generated from code inspection.

is sensible.

But:

Capability inventory | capability-manifest.json | → Capability Registry, docs | Authored, not generated.

creates a potential drift problem.

If it’s authored manually, then Phase 5’s automation should eventually verify it against runtime reality.

I’d make the distinction explicit:

Capability manifest

Declared contract

Runtime capability discovery

Observed implementation

Verification

Detect divergence

Then you get:

Declared capabilities
        │
        ├──────→ documentation
        │
        └──────→ registry
                    │
                    ↓
             runtime execution
Runtime discovery / inspection
        │
        ↓
   verification
        │
        ↓
  drift detected

That is much stronger than treating the manifest as authoritative simply because it is a JSON file.

⸻

9. Principle 9 is good, but it is too absolute

“Prefer adding new files and abstractions over modifying existing ones”

I understand why you wrote this. It minimizes blast radius.

But taken literally, this could generate exactly the kind of architecture you are trying to avoid:

old module
     ↓
adapter
     ↓
new abstraction
     ↓
another adapter
     ↓
another abstraction

You can end up with abstraction layering without actual simplification.

I’d keep the principle but qualify it:

Prefer additive changes when they reduce migration risk, but do not introduce an abstraction solely to avoid modifying code that should ultimately be simplified or removed.

That preserves the safety strategy without making “new file” synonymous with “good architecture.”

⸻

10. Principle 1 also needs a small qualification

This is elegant:

“If an action doesn’t make something more explicit, it doesn’t belong in this restructuring.”

But Phase 1 includes things like:

* removing dead code;
* fixing spelling;
* removing duplicate CDN loading;
* fixing .gitignore.

Those don’t necessarily make architecture more explicit.

They’re justified because they remove ambiguity/noise.

I’d therefore change the principle from:

If an action doesn’t make something more explicit, it doesn’t belong…

to something like:

Restructuring work must either make architecture explicit or remove concrete ambiguity/noise that obstructs architectural understanding.

That makes Phase 1 logically compatible with the ADR.

⸻

11. The Source-of-Truth Map has a subtle conflict around ADRs

It says:

ADR over informal docs

That’s correct.

But ADRs themselves shouldn’t necessarily outrank observed runtime behavior.

Suppose an ADR says:

Capability X must require permission Y.

but the production code currently allows X without Y.

The ADR describes the decision, but it doesn’t make the implementation magically compliant.

You therefore need two dimensions:

Current-state truth

What actually happens.

Decision truth

What architecture says should happen.

That’s a fundamental distinction for a restructuring project.

I’d make the conflict hierarchy:

1. Runtime/code — current behavior
2. Explicit contract — intended interface
3. ADR — architectural decision
4. Documentation — explanation
5. Historical material — background

But with an explicit rule:

A discrepancy between runtime behavior and an ADR is a defect/drift condition, not evidence that the ADR is wrong.

That will be much more useful later.

⸻

12. The State Mutation table is useful, but config.js is still doing too much conceptual work

The table says:

config (static)

then:

app state

then:

session state

This is exactly what the Phase 4 refactoring intends to fix.

But I would label the current state explicitly as:

Legacy conflated state model

rather than presenting config.js as three legitimate state domains.

Something like:

CURRENT
config.js
 ├── static configuration
 ├── application state
 └── session state
TARGET
config.js
app-state.js
session-state.js
model-catalog.js

That makes the migration direction much clearer.

⸻

13. The Execution Model says SSE is used for health monitoring/background workers

This sentence caught my attention:

“Used by chat, but also by health monitoring and background workers.”

If that’s actually true, then SSE is more fundamental than simply being a “Chat execution path.”

But if it is not actually verified against the current code, this is precisely the sort of architectural statement that should not be casually encoded into a canonical document.

I’d mark uncertain claims during Phase 2:

* Verified
* Observed
* Inferred
* Planned

That could be very useful throughout the entire documentation set.

For example:

SSE → health monitoring [verified]

versus:

SSE → background workers [inferred]

This would prevent documentation from gradually turning hypotheses into “facts.”

⸻

14. “Every execution must be traceable” is an excellent goal, but Principle 10 is slightly ahead of the current architecture

The ADR says:

“Every execution must be traceable.”

But the Execution Model acknowledges:

“~60% of these calls currently bypass api-client.js”

and:

“no run_id” for direct calls.

That’s fine if Principle 10 is explicitly a target state.

I would phrase it:

Every execution path must have an identifiable correlation mechanism in the target architecture. Existing paths may lack complete tracing until Phase 5.

Otherwise the ADR is claiming a property the system doesn’t currently have.

This is an important distinction between:

architecture principle

and

current architecture.

⸻

15. I would add one principle: preserve behavioral compatibility

You have:

* explicitness;
* documentation;
* no framework;
* incremental changes;
* contracts;
* separation;
* security;
* source of truth;
* additive changes;
* observability.

But there’s one missing principle that I think is critical for Olivia:

Behavioral compatibility

The restructuring should not silently change what users can accomplish.

Something like:

Principle 11: Preserve existing behavior unless a behavior change is explicitly identified.

Architectural restructuring should separate concerns without changing user-visible behavior, API semantics, permissions, data handling, or execution semantics unless the change is explicitly documented and tested.

This would be extremely useful during Phase 4.

For example, when replacing:

fetch(API_BASE + "/api/memory/search")

with:

OliviaCapabilities.call("memory.search")

the test isn’t merely:

“Does it return something?”

It is:

“Does it return exactly the same functional result, authorization behavior, error behavior, timeout behavior, and state effects?”

That’s much safer.

⸻

16. I would also add a principle around “no speculative abstractions”

This is especially relevant because Phase 3 creates four abstractions:

* Capability Registry
* Context Client
* Service Registry
* Permission Manager

That’s a lot of architecture before migration.

The danger is that you could accidentally build four new abstractions based on assumptions about the existing architecture.

You already have Principle 2 and 5 mitigating this, but I’d make it explicit:

Every new abstraction must correspond to an observed existing responsibility or repeated pattern. Do not create abstractions solely because they appear architecturally desirable.

That would protect the project from “architecture astronautics.”

⸻

17. The Glossary is very good, but I’d make one terminology correction

This:

Capability — “What Olivia can do”

is good.

But:

“Capabilities are defined in the capability manifest and implemented by MCP tools or REST endpoints.”

I’d avoid making the implementation relationship so direct.

A better conceptual model is:

Capability
   │
   ├── may be implemented by REST
   ├── may be implemented by MCP
   ├── may combine multiple backend operations
   └── may eventually have multiple transports

Because otherwise you could accidentally turn:

memory.search

into synonymous with:

qdrant_search

when the whole point of the capability abstraction is to decouple user-facing intent from implementation.

Your existing example actually demonstrates why:

memory.search → qdrant_search

That’s a good mapping. Keep it as a mapping, not an identity.

⸻

18. The Source-of-Truth Map should distinguish databases from services

For example:

Qdrant vectors | Qdrant database

Good.

But:

Qdrant vectors | Qdrant database → memory.js

There are actually multiple layers:

Qdrant
   ↓
garge-qdrant MCP
   ↓
capability / API
   ↓
frontend

Likewise Neo4j.

I would make the propagation column describe interfaces, not simply arrows.

That will help prevent a future developer from thinking the frontend somehow directly owns or accesses Qdrant.

⸻

19. One thing I particularly like: the documentation is beginning to describe boundaries, not just files

This is the biggest positive change.

The documents aren’t merely saying:

memory.js does X.

They’re beginning to say:

Who owns X?

Who may invoke X?

Where does authorization occur?

Where does state live?

Which system is authoritative?

What is transport vs capability?

That’s exactly the right direction.

For an architecture like Olivia, ownership and authority are more important than folder structure.

⸻

20. Recommended next step: don’t start Phase 3 quite yet

I would make one short intermediate step:

Phase 2.5 — Architecture Consistency Pass

Not a runtime phase. No code changes.

Resolve these before creating the primitives:

Must resolve

1. 4 vs 5 execution paths
2. SSE as path vs transport
3. garge vs garage
4. Capability Manifest vs Module Manifest
5. Code truth vs contract truth
6. Authorization vs UI gating
7. Tool resolution vs tool authorization
8. Current state vs target state
9. Current observability vs target observability
10. ADR authority vs runtime behavior

Then freeze

ADR 0001
   ↓
Glossary
   ↓
Execution Model
   ↓
Source-of-Truth Map
   ↓
module-manifest
capability-manifest
   ↓
Phase 3 primitives

That ordering is important.

⸻

My overall verdict

Architecture quality: 8.5/10

Direction: very strong.

Readiness for implementation: ~7/10.

The weakness isn’t that the architecture is poorly conceived. Quite the opposite. The weakness is that the documents have become sufficiently sophisticated that small inconsistencies between them now matter.

That’s actually a good sign.

The next risk isn’t “Olivia needs a better architecture.”

It’s:

Olivia now has an architecture vocabulary, but the vocabulary itself needs to be internally consistent before it becomes canonical.

I would not rewrite the restructuring plan. I’d keep its five phases.

I would, however, make a targeted revision to these four artifacts so that the following hierarchy becomes explicit:

                    ADR
                     │
             architectural decisions
                     │
                     ▼
                 Contracts
          ┌──────────┴──────────┐
          │                     │
   Capability Manifest    Context Contract
          │
          ▼
       Registries
          │
          ▼
      Runtime Code
          │
          ▼
   Actual Behavior
          │
          ▼
      Verification
          │
          ▼
 Documentation / generated views

And importantly:

The system’s actual behavior and its intended architecture must be allowed to disagree temporarily. The architecture work exists partly to detect and eliminate that drift.

That, to me, is the central refinement these documents now need.