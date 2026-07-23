# Personnel Registry — LA8159 Incident

> Append-only ledger of natural persons cross-referenced by 0_agents specs.
> **Personnel data is descriptive (role, instruments authored, public statements). It does NOT establish liability.** Liability flows through the framework agents (BR/CL/INT) and verification reports.

## Schema rules
- Each person has a single dossier: `dossiers/{slug}/dossier.md` (slug = lowercase ascii, hyphenated).
- Append-only: never delete or rewrite past entries; correct via dated addenda.
- Verification flags: ✅ verified / ⏳ pending / ⚠️ caveat / ❌ retracted.
- Citations must point to `branch_documentation/*.md` source narratives or external public records.
- See [_TEMPLATE/dossier.md](_TEMPLATE/dossier.md) for canonical schema.

## Active dossiers (v0.1–0.2 — enriched 2026-04-28 from OAB-Etics-Report.md + linkedin_personnel_extraction.md + aviation_ethics_institutional_governance.md)

| Slug | Role | OAB inscription | Primary agents anchoring | Verification |
|---|---|---|---|---|
| [bruno-bartijotto](dossiers/bruno-bartijotto/dossier.md) | Legal Director, LATAM Brasil; ABEAR speaker at CNJ | Active (UFRJ + FGV; SP/DF likely) | BR_OAB_DISCIPLINA, BR_ABEAR_PLUS, META_RevolvingDoor | ⏳ |
| [rogeria-gieremek](dossiers/rogeria-gieremek/dossier.md) | CCO, LATAM Airlines (global); Chair IASP Compliance 2013–2025 | **Active OAB-SP** (confirmed via IASP role) | BR_OAB_DISCIPLINA, BR_ANTICORRUPCAO, BR_ABEAR_PLUS, META_Personnel_Accountability | ⚠️ confirmed; OAB# pending |
| [ariel-prado](dossiers/ariel-prado/dossier.md) | LATAM Argentina ERP / Crisis Management; DGAC liaison | n/a (Argentina-based) | META_Institutional_Silence, META_Personnel_Accountability | ⏳ |
| [waleska-fortini](dossiers/waleska-fortini/dossier.md) | Crisis-management consultant; co-author *Gestão de Crises*; downstream blocker per Prado | Probable (book co-authorship) | BR_OAB_DISCIPLINA (cond.), META_Personnel_Accountability, META_Institutional_Silence | ⏳ |
| [juliano-noman](dossiers/juliano-noman/dossier.md) | ABEAR President (Dec 2024–); ex-ANAC Director-President; ex-SAC/MPOR Secretary | n/a | META_RevolvingDoor, BR_CONFLITO_INTERESSES, BR_ABEAR_PLUS | ⏳ |
| [sandra-assali](dossiers/sandra-assali/dossier.md) | ABRAPAVAA founder/President (since 1997); OAB Comissão Especial Direito Aeronáutico; SENTRA Director | **Active OAB-SP** (confirmed via Comissão Especial) | BR_OAB_DISCIPLINA, META_RevolvingDoor, BR_ABRAPAVAA_SENTRA | ⚠️ confirmed; OAB# pending |
| [joaquin-barraza](dossiers/joaquin-barraza/dossier.md) | Liderman security agent (Santiago Airport); falsely claimed LATAM "Chief of Security" | n/a (Chilean, non-advogado) | CL_CPCL, CL_DGAC_L16752, INT_ICAO_AN17, INT_MC99 | ⚠️ key facts verified |

## Provenance
- Primary narrative: `branch_documentation/aviation_ethics_institutional_governance.md`
- Supporting narrative: `branch_documentation/ABEAR_CONTENT_REPORT.md`
- OAB framework + LinkedIn cycles: `branch_documentation/OAB-Etics-Report.md`
- LinkedIn personnel matrix: `branch_documentation/linkedin_personnel_extraction.md`
- Personnel evidence cache: `branch_documentation/linkedin_data_review_extract_personnel/`
- Initial seeding: 2026-04-25 (v0.1 stubs); enrichment: 2026-04-28 (v0.2 — OAB inscriptions + LinkedIn cycles + 2 new dossiers added)
