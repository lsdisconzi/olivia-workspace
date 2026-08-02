# 0_agents — Legal Grounding Library for the LA8159 Incident

This folder is a grounded legal-spec library for the LA8159 matter. Each `agent.md` is a markdown specialist brief for one framework, not an auto-runnable VS Code agent. Use the folder to route a question to the right framework, read the owning spec's verified scope and caveats, and only then synthesize across frameworks.

## What is in this folder
- `BR/`, `CL/`, `INT/` — specialist framework specs.
- `meta/` — routing, adversarial, evidence, prescription, and institutional-pattern synthesis specs.
- `personnel/` — natural-person registry and dossiers used by the meta layer.
- `sources/` — offline legal text caches and supporting source extracts.
- `la8159/01-violations/` — canonical mounted validated violations corpus and reports.
- [mapping.json](mapping.json) — violation ID to primary/supporting agent routing.
- [INDEX.md](INDEX.md) — canonical inventory with current verification status.
- [PLAN.md](PLAN.md) — design intent, schema rules, milestones, and operating constraints.
- [SOURCES.md](SOURCES.md) — source-cache coverage and update protocol.

## Canonical data mount
- This library expects validated violations at `source/la8159/01-violations/validated/`.
- Use [../scripts/bootstrap_case_paths.sh](../scripts/bootstrap_case_paths.sh) to create/update the canonical symlink chain:
	1. `services/_shared/cases/la8159/01-violations -> LA8159-incident/la8159/01-violations`
	2. `agents-groups/la8159/source/la8159/01-violations -> services/_shared/cases/la8159/01-violations`
- This keeps relative report links stable after backup/cleanup/redeploy workflows.

## Current status
- Core validated-corpus library complete: the original plan's 28-agent baseline is filled.
- Current manifest: 33 specialist specs + 7 meta specs, plus the personnel registry.
- The extension layer is now promoted into usable specs; no `v0.1 (stub)` specs remain in `0_agents/`.
- Remaining caveats are source-availability issues at the margins, especially the uncached ABRAPAVAA statute/bylaws, the non-extractable ABEAR Estatuto PDF, and the still-caveated OAB CED 2015 numbering layer.

## Best-use workflow
1. Start with a violation ID, article query, or fact pattern.
2. Open [mapping.json](mapping.json) if you have a violation ID; open [INDEX.md](INDEX.md) if you have an article or framework query.
3. Read the primary specialist first, then its supporting specialists.
4. In each specialist, prioritize Section 2 (articles), Section 4 (NEVER do), Section 6 (cross-references), and Section 7 (adversarial vulnerabilities).
5. Use meta specs only after specialist review. `META_Orchestrator` routes, `META_Adversarial` stress-tests, `META_Evidence_Mapper` ties proof to claims, and `META_Prescription_Forum` checks timing/forum risk.
6. Use `personnel/` only to anchor people to evidence and frameworks. Do not treat personnel dossiers as liability determinations.

## Practical entry points
- Article ownership question: start with [INDEX.md](INDEX.md), then open the owning `agent.md`.
- Violation-grounding question: start with [mapping.json](mapping.json), then read the listed primary and supporting agents.
- Pleading or memo drafting: specialist agents first, then [meta/META_Orchestrator/agent.md](meta/META_Orchestrator/agent.md), then [meta/META_Adversarial/agent.md](meta/META_Adversarial/agent.md).
- Evidence assembly: use [meta/META_Evidence_Mapper/agent.md](meta/META_Evidence_Mapper/agent.md) alongside the specialist Section 6 tables.
- Regulator-industry or silence-pattern analysis: use the Tier-4 meta specs plus [personnel/REGISTRY.md](personnel/REGISTRY.md), but keep the final legal theory grounded in BR/CL/INT specialists.

## Maintenance rules
1. Do not contradict the authoritative verification reports under [la8159/01-violations/](la8159/01-violations/).
2. When adding or revising an agent, update the spec, [INDEX.md](INDEX.md), and [mapping.json](mapping.json) together.
3. If a source cache changes verification status, update [SOURCES.md](SOURCES.md) and the affected Section 2 and Section 3 blocks.
4. Use [_TEMPLATE/agent.md](_TEMPLATE/agent.md) for any new specialist or meta spec.
5. For every active project, keep the project-level planning loop fresh: update `task_plan.md`, `memory.md`, `progress.md`, and `findings.md` every two turns of conversation in the active project context.

## Authoritative inputs (do not contradict)
- BR Verification and Strategic Narrative: [la8159/01-violations/](la8159/01-violations/)
- CL Verification v2: [la8159/01-violations/](la8159/01-violations/)
- INT Verification and Strategic Narrative: [la8159/01-violations/](la8159/01-violations/)
