# Legal Grounding Agents — Expansion Plan
## LA8159 Incident · v1.1 · 2026-04-28 (core M1–M6 complete; extension layer added)

> Supersedes the initial sketch in [brainstorming_to_expand.md](brainstorming_to_expand.md).
> This plan defines **what we are building, why, and how it maps to the validated violations corpus**.

---

## 1. Goal

Build a **library of single-purpose legal agents**, one per legal framework actually cited in the LA8159 violations corpus, so that:

- Every probable violation in the [01-violations corpus](la8159/01-violations/) can be reasoned about by a specialist agent that knows **only** its framework, its caveats, and its enforcement pathway.
- Strategic synthesis (cross-framework arguments, hierarchies of claims, adversarial testing) is delegated to a small set of **meta-agents** that orchestrate the specialists.
- Citations are **always traceable to a verified source** (or explicitly flagged as pending/unverified).
- The same structure can later be re-used for any other incident or jurisdiction by swapping the agent inventory.

## 2. Scope — frameworks actually cited

Derived from filenames in `validated/{BR,CL,INT}/` and the four verification reports:

### Chile (6 frameworks)
| Code | Instrument | Cited in |
|---|---|---|
| LPDC | Ley 19.496 (Protección Derechos del Consumidor) | CL-001, 014, … |
| CACH | Ley 18.916 (Código Aeronáutico) + Resolución 218 JAC (D.O. 09-MAR-2022) | CL-001/006/007/009/011/014/016/018/022 |
| CPCL | Código Penal | CL-001/002/003/004/005/007/012/013/014/015/017/023/025/028/030 |
| CONST | Constitución Política | multiple |
| L16752 | Ley orgánica DGAC | CL-029 |
| L20285 | Ley de Transparencia | CL-032 |

### Brazil (8 frameworks)
| Code | Instrument | Cited in |
|---|---|---|
| CDC | Lei 8.078/1990 | BR-001/004/005/006/009/010/011/012 |
| CBA | Lei 7.565/1986 | BR-002/013 |
| R400 | ANAC Resolução 400/2016 | BR-007/008/012 |
| CP | Decreto-Lei 2.848/1940 (Código Penal) | BR-016 |
| CC | Lei 10.406/2002 (Código Civil) | BR-001/006 (damages support) |
| CF88 | Constituição Federal 1988 | BR-013/014/017/019 |
| L9784 | Lei 9.784/1999 (Processo Administrativo) | BR-013/017/019 |
| ABEAR+ | ABEAR Code of Conduct + Lei 12.846/2013 (by analogy) + Decreto 11.129/2022 (PNDH-3) | BR-014/020 |

### International (10 frameworks)
| Code | Instrument | Cited in |
|---|---|---|
| ACHR | American Convention on Human Rights | INT-008/009/010/014 |
| MC99 | Montreal Convention 1999 | INT-004/005/006/007 |
| CHICAGO+VCLT | Chicago Convention 1944 + Vienna Convention on Law of Treaties | INT-001/002/003/012/019, foundational |
| AN9 | ICAO Annex 9 (Facilitation) | INT-001/002/003 |
| AN17 | ICAO Annex 17 (Security) | INT-012 |
| AN6+AN13 | ICAO Annex 6 (Operations) + Annex 13 (Investigation) | INT-019 |
| VCCR | Vienna Convention on Consular Relations | INT-017 |
| UNCRC+HAGUE | UN Convention Rights of the Child + Hague 1980 (by analogy) | INT-016 |
| IATA_GC | IATA General Conditions of Carriage / Resolution 724 | INT-011 |
| SOFTLAW | UNGCP + PIL (customary) + BR-CL Joint Declaration 2024 | INT-013/018 |

## 3. Agent taxonomy

Three layers:

```
0_agents/
├── PLAN.md                    ← this file
├── INDEX.md                   ← canonical inventory + verification status
├── README.md                  ← orientation
├── _TEMPLATE/
│   └── agent.md               ← canonical agent.md schema
├── meta/                      ← cross-framework orchestrators
│   ├── META_Orchestrator/
│   ├── META_Adversarial/
│   ├── META_Evidence_Mapper/
│   └── META_Prescription_Forum/
├── CL/                        ← Chilean specialists
│   ├── CL_LPDC/
│   ├── CL_CACH/
│   ├── CL_CPCL/
│   ├── CL_CONST/
│   ├── CL_DGAC_L16752/
│   └── CL_TRANSPARENCY_L20285/
├── BR/                        ← Brazilian specialists
│   ├── BR_CDC/
│   ├── BR_CBA/
│   ├── BR_ANAC_R400/
│   ├── BR_CP/
│   ├── BR_CC/
│   ├── BR_CF88/
│   ├── BR_LEI9784/
│   └── BR_ABEAR_PLUS/
└── INT/                       ← International specialists
    ├── INT_ACHR/
    ├── INT_MC99/
    ├── INT_CHICAGO_VCLT/
    ├── INT_ICAO_AN9/
    ├── INT_ICAO_AN17/
    ├── INT_ICAO_AN6_AN13/
    ├── INT_VCCR/
    ├── INT_UNCRC_HAGUE/
    ├── INT_IATA_GC/
    └── INT_SOFTLAW/
```

**Core validated-corpus library: 24 specialists + 4 meta = 28 agents.**

Current workspace manifest also includes an extension layer of 9 additional specialist specs, 3 Tier-4 meta specs, and the personnel registry. Current total: **33 specialists + 7 meta = 40 active specs** (41 `agent.md` files including the template).

### Why split this way (vs. the original 11)
- ICAO Annexes split into 9 / 17 / 6+13 because their **doctrinal logic differs**: facilitation (rights), security (state monopoly), operations/investigation (technical). Conflating them is what produced the AN17 §5.2.1 weak-fit issue flagged in INT_VERIFICATION.
- MC99 split from Chicago/VCLT because MC99 is **enforceable by individuals** (Art. 33), while Chicago/VCLT are **state-to-state**. Different remedies.
- VCCR split from UNCRC because they protect **different right-holders** (consul/state vs. child) with non-overlapping enforcement.
- IATA GC isolated from SOFTLAW because it is **contractual**, not soft law — domestic court enforceable.
- ABEAR grouped with Lei 12.846 + PNDH-3 because all three are non-statutory or analogical and share the same caveat profile.

## 4. Canonical agent.md schema

Every `agent.md` MUST contain these sections (template in `_TEMPLATE/agent.md`):

1. **Identity** — Agent ID, jurisdiction, legal domain, primary instrument, version.
2. **Primary articles in scope** — exhaustive list with verification status (`verified` / `pending` / `unverifiable`).
3. **Official sources** — URLs to canonical repositories; date last checked.
4. **Knowledge boundaries** — what the agent must NOT do (avoid extraterritorial overreach, avoid time-barred articles for criminal track, avoid private-actor framing for state-only treaties, etc.).
5. **Capabilities** — concrete tasks the agent can perform on the LA8159 corpus.
6. **Cross-references** — list of `LA8159-incident` violation IDs grounded in this framework, plus pointers to verification report sections.
7. **Adversarial vulnerabilities** — known counter-arguments and mitigations.
8. **Output constraints** — formatting and citation rules; explicit "always-flag" and "never-claim" lists.
9. **Provenance** — link to the verification report passage(s) that authorized each article's inclusion.

## 5. Meta-agents

| Agent | Role | Inputs | Outputs |
|---|---|---|---|
| META_Orchestrator | Routes a fact pattern to the right specialists; synthesizes hierarchical claims | Fact descriptions, violation IDs | Multi-framework strategic memo |
| META_Adversarial | Plays opposing counsel; stresses every claim from the verification reports' "Adversarial vulnerability" sections | Specialist outputs | Vulnerability matrix + mitigations |
| META_Evidence_Mapper | Links each evidence ID (STG-/EVID-/LATAM-) to articles and violation IDs | Evidence corpus + agent outputs | Evidence→article→violation graph |
| META_Prescription_Forum | Tracks SOL/prescrição windows and forum-shopping options across CL/BR/INT | All criminal/civil articles + dates | Time-bar table + filing roadmap |

## 6. Deliverables & milestones

### M1 — Scaffold ✅ done
- `PLAN.md`, `INDEX.md`, `README.md`, `_TEMPLATE/agent.md`, `mapping.json`, all 28 core agent folders with stub `agent.md` (Identity + TODO).

### M2 — Tier-1 agents (highest enforceability) ✅ done
Filled out (v1.0): BR_CDC, BR_CBA, BR_ANAC_R400, CL_LPDC, CL_CACH, INT_ACHR, INT_MC99.

### M3 — Tier-2 agents (supporting / state) ✅ done (2026-04-27)
Filled out (v1.0): CL_CPCL, BR_CP, BR_CC, INT_ICAO_AN9, INT_VCCR, BR_CF88, CL_CONST.

### M4 — Tier-3 agents (administrative / soft) ✅ done (2026-04-27)
Filled out (v1.0): BR_LEI9784, CL_DGAC_L16752, CL_TRANSPARENCY_L20285, INT_ICAO_AN17, INT_ICAO_AN6_AN13, INT_UNCRC_HAGUE, INT_IATA_GC, INT_SOFTLAW, INT_CHICAGO_VCLT, BR_ABEAR_PLUS.

### M5 — Meta-agents ✅ done (2026-04-27)
META_Orchestrator → META_Adversarial → META_Evidence_Mapper → META_Prescription_Forum — all v1.0.

### M6 — Validation pass ✅ done (2026-04-27)
- All 24 core specialists + 4 core meta agents present (29 `agent.md` files including template).
- Each follows the canonical 9-section schema from `_TEMPLATE/agent.md`.
- Verification flags (✅/⏳/⚠️/❌) propagated from the four authoritative reports.
- Critical NEVER-do rules locked: R400 corrected article numbers (5/20/21/22/24/26/27/28), CDC Art. 42 limited to debt-collection, LPDC Art. 23 negligence-based (not strict), CACH Art. 1 fabrication banned, ACHR state-only doctrine, MC99 Art. 22 = limits-not-assistance + Art. 17 bodily-injury Tseng, ICAO `Standard` not `Article`, Chicago Art. 26 `accident` not `incident`, BR CP 140/147 criminal track CLOSED, CL Art. 494.16 time-barred, Lei 12.846 removed from BR-014/018, Hague 1980 analogical only, Joint Declaration not VCLT-treaty.
- Prescription urgencies tracked in `META_Prescription_Forum`: BR CC 206 §3 V deadline 2027-04-04 flagged URGENT.

### M7 — Extension layer + personnel registry ✅ done (2026-04-28)
- Added 8 BR + 1 CL specialist extension specs for ethics, transparency, anti-corruption, procurement/conflict, and institutional-channel tracks.
- Added 3 Tier-4 meta specs: `META_RevolvingDoor`, `META_Personnel_Accountability`, and `META_Institutional_Silence`.
- Added append-only `personnel/` registry with 7 dossiers cross-linked to extension and meta specs.
- Preserved the rule that these extension specs support or contextualize claims; they do not silently override the validated-corpus specialists.

## 7. Provenance — authoritative inputs

Every agent draws from these four reports (do not contradict without justification):

- [BR Comprehensive Verification Report](la8159/01-violations/)
- [BR Strategic Legal Narrative](la8159/01-violations/)
- [CL Comprehensive Verification Report v2](la8159/01-violations/)
- [INT Comprehensive Verification Report](la8159/01-violations/)
- [INT Strategic Legal Narrative](la8159/01-violations/)

## 8. Operating rules (apply to every agent)

1. **Verified > Pending > Unverifiable.** Always tag.
2. **Cite the article, then the source URL, then the date checked.**
3. **Never invent text.** If text unverified, mark `[working reconstruction — confirm via {official source}]`.
4. **Respect the verification report's vulnerability flags.** Do not promote a flagged claim to "direct" without new evidence.
5. **Distinguish private-actor liability (LATAM) from state liability (Chile/Brazil/PDI/DGAC/ANAC).**
6. **Do not silently combine soft law with treaty law.** Always declare the tier.
7. **Do not use time-barred criminal articles for criminal prosecution** — only as factual/civil support.
8. **One framework per agent.** Cross-references go through META_Orchestrator.

## 9. What success looks like

- A user can ask "Which agent owns CDC Art. 14?" and get a deterministic answer (`BR_CDC`).
- For any violation JSON, the agent set can produce: applicable articles · verification status · vulnerabilities · enforcement pathway · damages framework — without contradicting the verification reports.
- Adversarial testing (META_Adversarial) surfaces every weakness already documented in the four reports, plus any new ones generated by combining frameworks.
- The library is portable: a new incident only requires updating `INDEX.md` and adding/removing folders.

## 10. Open questions for the user

1. **Do you want each `agent.md` written as a Copilot-style instruction file** (`.instructions.md` with `applyTo` frontmatter) so they can be auto-attached when editing matching files? Or as plain markdown specs?
2. **Should META_Orchestrator be implemented as a runnable pipeline** (e.g., Python script reading violation JSONs) or remain a documentation/prompt-only agent?
3. **Granularity of CL_CACH** — keep Resolución 218 JAC inside CL_CACH, or break it out as `CL_JAC_DERECHOS_PASAJEROS`?
4. **Granularity of BR_ABEAR_PLUS** — keep grouped, or split into three agents (one per analogical source)?
5. **Versioning** — adopt semver per-agent (`v1.0`) tied to the verification report version, or a single repo-wide version?
