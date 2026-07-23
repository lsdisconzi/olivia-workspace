# 0_agents — Complete Directory Documentation

## Overview

`0_agents/` is a legal grounding library for the LA8159 matter: a structured, machine-traversable set of markdown framework specs, meta-specs, personnel dossiers, and offline source caches. The folder is not a runnable agent runtime. It is a source-grounded reasoning library used to route facts to the right legal framework, preserve citation discipline, and keep cross-framework synthesis subordinate to verified sources.

Current state as of 2026-04-28:

- Core baseline completed and extended.
- Current manifest: **33 specialist specs + 7 meta specs**.
- Total active specs: **40** `agent.md` files, plus the template.
- Personnel layer: append-only registry plus **7 dossiers**.
- Source layer: **59 cached markdown source files** under `sources/`.
- Remaining backlog is now mostly **source-availability**, not stub-spec scaffolding.

The library's operating rule is simple: start with the owning specialist, read the verification posture and NEVER-do rules, and only then synthesize across frameworks.

---

## Directory Tree

```text
0_agents/
├── README.md                           # Orientation / entrypoint
├── DOC_agents.md                       # This fuller directory-level documentation
├── PLAN.md                             # Architecture, taxonomy, milestones, operating rules
├── INDEX.md                            # Canonical inventory with verification and changelog
├── SOURCES.md                          # Source manifest, cache inventory, deferred review items
├── mapping.json                        # Programmatic routing: violation IDs -> primary/supporting agents
│
├── _TEMPLATE/
│   └── agent.md                        # Canonical 9-section schema for every spec
│
├── BR/                                 # 16 Brazil specialist specs (8 core + 8 extension)
├── CL/                                 # 7 Chile specialist specs (6 core + 1 extension)
├── INT/                                # 10 international specialist specs
├── meta/                               # 7 cross-framework meta specs
├── personnel/                          # Registry + dossiers for natural-person accountability
├── sources/                            # Offline source caches
│   ├── BR/                             # 20 cached BR source files
│   ├── CL/                             # 17 cached CL source files
│   └── INT/                            # 22 cached INT source files
│
└── missing_law_info/                   # Raw gather artifacts, PDFs, intermediate harvests
```

Top-level documentation now centers on:

- [README.md](README.md): fast orientation.
- [INDEX.md](INDEX.md): canonical inventory and changelog.
- [SOURCES.md](SOURCES.md): cache coverage and deferred source work.
- [PLAN.md](PLAN.md): architecture, milestones, and schema rules.

---

## Current Architecture

### Layer 1 — Source caches

These are the local ground-truth extracts in [sources/](sources/). They are the safest way to keep article text stable once verified.

- `sources/BR/`: 20 files.
- `sources/CL/`: 17 files.
- `sources/INT/`: 22 files.
- Total cached sources: **59** markdown files.

### Layer 2 — Specialist framework specs

These are the framework owners. Each specialist owns one legal framework or one tightly bounded institutional slice.

- Brazil: **16** specialists.
- Chile: **7** specialists.
- International: **10** specialists.
- Total specialists: **33**.

### Layer 3 — Meta specs

These route, synthesize, stress-test, and preserve timing/accountability logic across specialists.

- `META_Orchestrator`
- `META_Adversarial`
- `META_Evidence_Mapper`
- `META_Prescription_Forum`
- `META_RevolvingDoor`
- `META_Personnel_Accountability`
- `META_Institutional_Silence`

Total meta specs: **7**.

### Personnel layer

This is not a substitute for the legal frameworks. It is a registry layer used to bind real actors to evidence and to the relevant framework owners.

- Registry files: [personnel/REGISTRY.md](personnel/REGISTRY.md), [personnel/personnel.json](personnel/personnel.json)
- Current dossier count: **7**

---

## What Changed Since The Early Scaffold

The original scaffold-era description is no longer accurate. The main changes are:

- The library is no longer a 28-agent core only. It now includes a substantial extension layer.
- The old “some extension agents are still v0.1 stubs” posture is no longer true. The current workspace has **no remaining `v0.1 (stub)` specs** in `0_agents/`.
- Chile now includes an official BCN-backed extension specialist for Contraloría and INDH.
- Brazil’s extension layer has been promoted into usable specialists for OAB discipline, conflict-of-interest, anti-corruption, improbity, transparency, SNDC/PROCON/SENACON routing, OAB institutional-channel work, and ABRAPAVAA governance.
- Source coverage has moved from a partial cache model to a broad offline-grounded model, with the remaining gaps concentrated in private-governance documents that are unavailable or non-extractable.

---

## Current Specialist Inventory

### Core specialists

These are the original baseline frameworks that ground the validated corpus directly.

#### Brazil core (8)

- `BR_CDC`
- `BR_CBA`
- `BR_ANAC_R400`
- `BR_CP`
- `BR_CC`
- `BR_CF88`
- `BR_LEI9784`
- `BR_ABEAR_PLUS`

#### Chile core (6)

- `CL_LPDC`
- `CL_CACH`
- `CL_CPCL`
- `CL_CONST`
- `CL_DGAC_L16752`
- `CL_TRANSPARENCY_L20285`

#### International core (10)

- `INT_ACHR`
- `INT_MC99`
- `INT_CHICAGO_VCLT`
- `INT_ICAO_AN9`
- `INT_ICAO_AN17`
- `INT_ICAO_AN6_AN13`
- `INT_VCCR`
- `INT_UNCRC_HAGUE`
- `INT_IATA_GC`
- `INT_SOFTLAW`

### Extension specialists

These extend the baseline into ethics, institutional, personnel, and governance tracks.

#### Brazil extension (8)

- `BR_OAB_DISCIPLINA`
- `BR_CONFLITO_INTERESSES`
- `BR_ANTICORRUPCAO`
- `BR_IMPROBIDADE`
- `BR_LAI_TRANSPARENCY`
- `BR_SDC_PROCON_SENACON`
- `BR_OAB_COMISSAO_AERO`
- `BR_ABRAPAVAA_SENTRA`

#### Chile extension (1)

- `CL_CONTRALORIA_INDH`

---

## Tier Logic

The library still uses a tiered evidentiary model.

| Tier | Meaning | Typical examples |
|---|---|---|
| 1 | Hard binding law | Codes, statutes, constitutions, treaties directly binding in forum |
| 2 | Binding by reference / institutional norm | ANAC/ICAO implementing layers, internal OAB institutional competence layers |
| 3 | Soft, contractual, self-regulatory, or programmatic | ABEAR instruments, IATA GC, UNGCP, political declarations |
| 4 | Pattern/meta synthesis only | Revolving-door, institutional-silence, personnel-accountability overlays |

Tier 4 appears only in the meta layer. It does not displace Tier 1-3 legal anchors.

---

## Canonical Spec Shape

Every active `agent.md` follows the 9-section schema from [_TEMPLATE/agent.md](_TEMPLATE/agent.md):

1. Identity
2. Primary articles in scope
3. Official sources
4. Knowledge boundaries
5. Capabilities
6. Cross-references
7. Adversarial vulnerabilities
8. Output constraints
9. Provenance

When reading quickly, the most decision-useful sections are usually:

- Section 2 for article ownership and verification status.
- Section 4 for scope limits and false-anchor avoidance.
- Section 6 for routing into adjacent frameworks.
- Section 7 for expected opposing arguments.
- Section 9 for why the framework was included in the first place.

---

## How To Use The Folder Well

### If you start from a violation ID

1. Open [mapping.json](mapping.json).
2. Identify the primary and supporting specialists.
3. Read the primary specialist first.
4. Only then read supporting specialists and meta specs.

### If you start from an article or framework question

1. Open [INDEX.md](INDEX.md).
2. Find the owning framework row.
3. Open the owning `agent.md`.
4. Check verification posture before citing anything.

### If you start from a person

1. Open [personnel/REGISTRY.md](personnel/REGISTRY.md) or the relevant dossier.
2. Use the listed primary/supporting agents.
3. Route back into the owning specialist frameworks.
4. Do not let the dossier substitute for article-level legal grounding.

### If you are drafting or stress-testing a theory

1. Start with the primary specialist.
2. Use `META_Orchestrator` to structure the cross-framework theory.
3. Use `META_Adversarial` to pressure-test it.
4. Use `META_Prescription_Forum` before treating the theory as actionable.

---

## Best Outcome Workflow

For the best results, use the library in this order:

1. **Find the owner**: use [INDEX.md](INDEX.md) or [mapping.json](mapping.json).
2. **Check the verification posture**: do not assume every cited instrument is quote-safe just because it is listed.
3. **Read the NEVER-do rules**: these often carry the highest-value corrections.
4. **Distinguish direct anchors from supporting context**: especially for Tier 3 and Tier 4 material.
5. **Use source caches for quote stability**: if a norm is cached locally, prefer the cache over memory or scattered notes.
6. **Treat private-governance gaps honestly**: if the charter/bylaws/policy text is unavailable, keep the output at the public-law or verified-policy layer.

This matters because the project already contains several deliberately documented anti-overreach corrections, including:

- soft-law instruments that cannot be promoted to treaty-level anchors;
- time-barred criminal provisions that remain usable only as factual support;
- statutes that were previously misapplied by analogy;
- institutional or governance documents whose text is unavailable or only partially extractable.

---

## Current Verification And Backlog Posture

The library is no longer blocked by core public-law source gathering. The main remaining constraints are narrower:

- **ABRAPAVAA statute/bylaws**: still not publicly cached. Keep ABRAPAVAA analysis at the CC / CF / Lei 13.460 level unless the statute text is obtained.
- **ABEAR Estatuto PDF**: still non-extractable in the current toolchain. Treat it as a deferred review item, not as a silent source.
- **ABEAR policy inventory beyond the extracted items**: several documents remain factual or partially harvested rather than fully quoted.
- **OAB CED 2015 numbering**: usable through doctrinal continuity and partial cache support, but still caveated until the full text is directly extracted.

These are documented in [SOURCES.md](SOURCES.md) and in the affected specialist specs.

---

## Relationship Between The Main Docs

- [README.md](README.md): shortest explanation of what `0_agents` is and how to enter it.
- [PLAN.md](PLAN.md): design logic, milestones, taxonomy, schema, and operating rules.
- [INDEX.md](INDEX.md): canonical answer to “what exists right now?”.
- [SOURCES.md](SOURCES.md): canonical answer to “what is verified, cached, deferred, or unavailable?”.
- [DOC_agents.md](DOC_agents.md): fuller orientation for humans who need the whole directory explained in one place.

If these files disagree, treat [INDEX.md](INDEX.md) and [SOURCES.md](SOURCES.md) as controlling and bring the others back into sync.

---

## Practical Rules For Maintenance

1. Update the owning `agent.md`, [INDEX.md](INDEX.md), and [mapping.json](mapping.json) together when routing changes.
2. Update [SOURCES.md](SOURCES.md) whenever verification status, cache presence, or deferred-review posture changes.
3. Preserve the distinction between verified public-law sources and unavailable private-governance materials.
4. Do not overwrite an older non-official cache when adding an official one; keep provenance layers distinct.
5. Keep the meta layer subordinate to the specialists. Meta specs synthesize; they do not silently replace framework owners.

---

## Bottom Line

`0_agents/` is now a mature legal grounding library with a completed core baseline, a promoted extension layer, a usable personnel layer, and broad offline source coverage. Its remaining risk is not lack of structure. The remaining risk is source provenance at the margins: unavailable bylaws, non-extractable private charters, and a few still-caveated institutional texts. Used correctly, the folder gives you a deterministic route from fact pattern or violation ID to verified framework owner, adversarial warnings, and source-backed legal grounding.
                                    