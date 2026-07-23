# Joaquín Barraza — Personnel Dossier

> Schema: see [../../_TEMPLATE/dossier.md](../../_TEMPLATE/dossier.md). Append-only.

## 1. Identity
- **Slug:** `joaquin-barraza`
- **Full name:** Joaquín Barraza
- **Public roles (current/historical):** Airport Security Agent (Guardia de Seguridad Aeroportuaria) — **Liderman** (private security contractor at Santiago Airport)
- **Affiliations:** Liderman (employer); **NOT a LATAM employee** (confirmed by LATAM corporate messages) — `linkedin_personnel_extraction.md` §1.5
- **Education / credentials:** Universidad Alberto Hurtado — Grado en Pedagogía, Enseñanza de Inglés como Lengua Extranjera (Mar 2016 – Dec 2020); previous experience: English teacher
- **Location:** Santiago, Santiago Metropolitan Region, Chile
- **OAB inscription:** Not applicable (Chilean national; not advogado)
- **Verification status:** ⚠️ key facts verified (Liderman employment, false claim of LATAM authority, education) via `linkedin_personnel_extraction.md` §1.5

## 2. Role timeline
| Period | Role | Organization | Source |
|---|---|---|---|
| Mar 2016 – Dec 2020 | Student (Pedagogía / English teaching) | Universidad Alberto Hurtado | branch_documentation/linkedin_personnel_extraction.md §1.5 |
| post-2020 | English teacher (educational establishments) | various | branch_documentation/linkedin_personnel_extraction.md §1.5 |
| current | Airport Security Agent | Liderman (Santiago Airport contractor) | branch_documentation/linkedin_personnel_extraction.md §1.5 |
| 2024-07-05 | Central figure in LA8159 forcible removal | Santiago Airport | branch_documentation/linkedin_personnel_extraction.md §1.5; CCTV referenced |

## 3. Public statements / authored instruments
- 2024-07-05 — Verbal claim to be LATAM's "Chief of Security" (refuted by LATAM corporate) — `branch_documentation/linkedin_personnel_extraction.md` §1.5
- 2024-07-05 — Showed a "Letter of Onboarding" on his phone to PDI chief (questioned by PDI office) — `branch_documentation/linkedin_personnel_extraction.md` §1.5

## 4. Connection to LA8159 fact pattern
Per `branch_documentation/linkedin_personnel_extraction.md` §1.5 and `branch_documentation/aviation_ethics_institutional_governance.md` §1.1: Barraza is the central figure in the Jul 5, 2024 forcible removal at Santiago Airport. He **falsely represented his authority** (verbally claimed to be LATAM "Chief of Security" — refuted by LATAM corporate confirmation that he is not a LATAM employee). His employer is Liderman, a private security contractor. Per testimony and corporate messages, his conduct on-scene was "unprofessional, discriminatory, humiliating, offensive, and even racist"; he threatened to delay all passengers and shamed the passenger in front of the cabin. He is also a witness/actor for the "Letter of Onboarding" shown to PDI — the fabricated onboarding-restriction artifact at the heart of the discriminatory exclusion narrative.

This is a Chilean fact pattern \u2014 Brazilian disciplinary frameworks do not reach Barraza directly. The applicable specialists are Chilean (Código Penal Chileno, DGAC framework) plus international (ICAO Annex 17 security; ICAO Annex 9 facilitation; Montreal Convention 1999 operator liability for agents). Liderman's chain of contractual responsibility flows back to the airport operator (VINCI / Nuevo Pudahuel) and ultimately the air operator (LATAM) under principal-agent doctrine.

## 5. Agent routing
- **Primary agent:** `CL_CPCL` — Código Penal Chileno: Art. 255 (vejación de funcionario / by analogy private agent acting in official-adjacent capacity); Art. 269 TER; Art. 412 (calumnia) / Art. 416 (injuria); Art. 494.16 (coacción); plus Arts. 193–197 (falsedad) for the false-representation and "Letter of Onboarding" artifact.
- **Primary agent:** `CL_DGAC_L16752` — DGAC framework for airport-side conduct (CL-029 anchor).
- **Supporting agent:** `CL_CACH` — Ley 18.916 + Resolución 218 JAC (passenger conditions of carriage / information).
- **Supporting agent:** `INT_ICAO_AN17` — ICAO Annex 17 Security standards (institutional context for airport security agents).
- **Supporting agent:** `INT_MC99` — Montreal Convention Art. 17 / Art. 22 — operator liability for agents.
- **Explicitly NOT applicable:** `BR_OAB_DISCIPLINA` (not advogado, not Brazilian); BR_ABEAR_PLUS (Chilean fact pattern, not Brazilian industry-association governance).

## 6. Adversarial considerations
| Defense / objection | Counter-anchor | Notes |
|---|---|---|
| "I am not a LATAM employee — LATAM has no liability" | INT_MC99 Art. 17 + Art. 22 (operator liability for agents) + Chilean civil principal-agent doctrine | Operator liability extends to contracted security |
| "I followed airport security protocol" | Burden of proving the protocol authorized: false representation of authority + discriminatory removal of confirmed-boarded passenger | Protocol does not authorize falsehood |
| "I was the only one acting" | CCTV + PDI verbal confirmation of innocence + LATAM corporate confirming non-employment | Multi-agent corroborated record |

## 7. Provenance
- Source narratives:
  - `branch_documentation/linkedin_personnel_extraction.md` §1.5 (full identification, education, false-claim refutation)
  - `branch_documentation/aviation_ethics_institutional_governance.md` §1.1 (LATAM personnel directory entry)
- Evidence:
  - LinkedIn profile (low activity: 1 follower, hasn't posted yet)
  - LATAM corporate chat messages confirming non-employment
  - PDI office observations (Letter of Onboarding shown)
  - CCTV footage (referenced)
- Linked agent specs:
  - [/Users/dev/LA8159-incident/0_agents/CL/CL_CPCL/agent.md](../../../CL/CL_CPCL/agent.md)
  - [/Users/dev/LA8159-incident/0_agents/CL/CL_DGAC_L16752/agent.md](../../../CL/CL_DGAC_L16752/agent.md)
  - [/Users/dev/LA8159-incident/0_agents/INT/INT_ICAO_AN17/agent.md](../../../INT/INT_ICAO_AN17/agent.md)
- Last updated: 2026-04-28 (initial seed)
- Maintainer note: First non-Brazilian dossier in registry. Anchors the Chilean side of LA8159 personnel mapping. Liderman corporate-level liability (ISO 18788 private security; Chilean private-security regulations) to be expanded in next pass.
