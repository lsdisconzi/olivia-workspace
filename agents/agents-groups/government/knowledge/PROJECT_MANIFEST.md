# Olivia · CPSI Agent Bundle

**Profile ID:** `cpsi`
**Agent:** `CPSI Municipal Advisor` (consultor público de inovação)
**Target workspace:** Quantum / Olivia (same bundle schema as `ibsco.bundle.import.json`)
**Language:** pt-BR (default) · en (fallback)
**Version:** 1.0.0 — 2026-04-22

## Purpose

A domain-expert agent that acts as the **right hand of mayors, municipal
secretaries, and procurement attorneys** when diagnosing public problems
and deciding whether, when, and how to use the **Contrato Público para
Solução Inovadora (CPSI)** — the innovation procurement regime created by
Lei Complementar nº 182/2021 ("Marco Legal das Startups").

The agent turns dense, fragmented legal material (AGU manual, CNJ edital,
PGE-SP toolkit, Observatório CPSI) into a conversational, operational
companion that:

1. Helps frame the **public problem** (not a pre-picked solution).
2. Walks the user through the **CPSI procedure** (DOD → ETP → Risk Plan → TR → Edital → Teste → Contrato de Fornecimento).
3. Quotes **authoritative clauses** from LC 182/2021 and the AGU manual.
4. Pulls **real-world numbers** from the Observatório CPSI (192 CPSIs, R$ 791k average, 244 days median).
5. Warns about **limits and risks** (R$ 1.6M cap, 12 + 12 months, IP, risk matrix).
6. Points to **official templates** (Edital, TR, Contrato, DOD) and fresh worked examples (CNJ CPSI 01/2025).
7. **Never** gives a final legal opinion — always recommends the municipal Procuradoria.

## Repository layout

```
CPSI/
├── PROJECT_MANIFEST.md              <- this file
├── PROJECT_STATUS.md                <- current delivery status
├── README.md                        <- quick-start for developers
│
├── agents/
│   └── cpsi-municipal-advisor.agent.md   <- agent definition (system prompt + rules)
│
├── knowledge/
│   ├── README.md
│   ├── AGENT_COMMUNICATION_GUIDE.md
│   ├── legal/
│   │   ├── 01-legal-framework.md
│   │   └── 06-risk-ip-remuneration.md
│   ├── procedural/
│   │   ├── 02-cpsi-procedure.md
│   │   └── 07-dialogue-committee.md
│   ├── observatory/
│   │   └── 03-observatory-stats.md
│   ├── templates/
│   │   └── 04-templates-and-artifacts.md
│   └── examples/
│       ├── 05-use-cases-municipal.md
│       └── 08-cnj-case-study.md
│
├── bundle/
│   ├── build_bundle.py              <- emits cpsi.bundle.import.json
│   └── cpsi.bundle.import.json      <- generated artifact, ready for Olivia/Quantum
│
└── SHA256SUMS.txt
```

## Knowledge-base provenance

| File | Primary source | Role |
|------|----------------|------|
| `legal/01-legal-framework.md` | LC 182/2021, Lei 14.133/2021, Lei 10.973/2004, CF art. 218 | legal foundation |
| `legal/06-risk-ip-remuneration.md` | AGU Manual §6 · LC 182/2021 art. 14 | risk matrix, IP, pricing |
| `procedural/02-cpsi-procedure.md` | AGU Manual §5 · IN SEGES/MP 5/2017 | 8-step procedure |
| `procedural/07-dialogue-committee.md` | AGU Manual §4.6–4.8 | dialogue table, expert committee, qualification |
| `observatory/03-observatory-stats.md` | PGE-SP Observatório CPSI (2021–2025) | real-world numbers |
| `templates/04-templates-and-artifacts.md` | AGU modelos · CNJ anexos | where to find each artifact |
| `examples/05-use-cases-municipal.md` | synthesized municipal scenarios | domain priming |
| `examples/08-cnj-case-study.md` | CNJ CPSI 01/2025 (edital + Q&A + homologação) | end-to-end worked case |

## Cleanup policy

To keep this repository deployable in downstream projects and VPS
architectures, source corpora and exploratory notes used during generation
were removed from the runtime tree.

The runtime agent package is intentionally lean at root: `agents/`,
`knowledge/`, `bundle/`, plus project docs.

## How to rebuild the bundle

```bash
cd CPSI
python3 bundle/build_bundle.py
# -> writes bundle/cpsi.bundle.import.json
```

The generated JSON matches the `bundle` schema used by
`ibsco.bundle.import.json` and can be imported into the Quantum / Olivia
workspace the same way.
