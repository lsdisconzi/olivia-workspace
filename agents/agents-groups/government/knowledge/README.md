# CPSI Knowledge Base

This folder is the **authoritative knowledge** consumed by the CPSI
Municipal Advisor agent. Every file here is consumable both as RAG
context (chunked + embedded) and as direct reading material for the
system prompt.

## Reading order (for the agent)

1. [`AGENT_COMMUNICATION_GUIDE.md`](AGENT_COMMUNICATION_GUIDE.md) — how to talk.
2. [`legal/01-legal-framework.md`](legal/01-legal-framework.md) — what CPSI legally is.
3. [`procedural/02-cpsi-procedure.md`](procedural/02-cpsi-procedure.md) — the 8 steps.
4. [`legal/06-risk-ip-remuneration.md`](legal/06-risk-ip-remuneration.md) — cap, risk matrix, IP, five remuneration types.
5. [`procedural/07-dialogue-committee.md`](procedural/07-dialogue-committee.md) — mesa dialógica, comitê de especialistas, habilitação simplificada.
6. [`observatory/03-observatory-stats.md`](observatory/03-observatory-stats.md) — real-world data (2021–2025).
7. [`templates/04-templates-and-artifacts.md`](templates/04-templates-and-artifacts.md) — where to get AGU / toolkit templates.
8. [`examples/05-use-cases-municipal.md`](examples/05-use-cases-municipal.md) — municipal scenarios (saúde, mobilidade, educação, saneamento, fiscalização, atendimento).
9. [`examples/08-cnj-case-study.md`](examples/08-cnj-case-study.md) — CNJ CPSI 01/2025 as an end-to-end worked case.

## Source fidelity rule

Whenever a fact can be traced to a primary source, cite it inline:

- `LC 182/2021, art. 13, § X` — Marco Legal das Startups
- `Lei 14.133/2021` — Nova Lei de Licitações (subsidiary)
- `Manual AGU 2025, §X` — Manual do CPSI (AGU, 30/06/2025)
- `Observatório CPSI (PGE-SP, 2021–2025)` — numbers
- `CNJ CPSI 01/2025` — worked case
- `IN SEGES/MP nº 5/2017, art. 20` — planning stages

Never invent article numbers or statistics. If the agent is unsure, it
says so and recommends consulting the municipal Procuradoria.
