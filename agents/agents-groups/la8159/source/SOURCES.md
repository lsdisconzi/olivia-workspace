# Official Law Sources — Manifest & Gathering Plan
## LA8159 Legal Agents Library · v1.0 · 2026-04-27

> **Purpose**: single source of truth for *which official law texts each agent depends on*, *which are already verified vs. pending direct fetch*, and *what to do to upgrade `⏳` → `✅`*.
>
> **Storage convention**: cached statute texts (when fetched) live under [`sources/`](sources/), one file per instrument, named after the agent ID + article scope. Agents continue to **cite the official URL**, not the cache, but the cache is the project's offline ground truth.

---

## 1. Verification status taxonomy

| Flag | Meaning |
|---|---|
| ✅ | Article text directly verified against an official or first-class mirror; quote-safe |
| ⏳ | Pending direct fetch — text widely cited and doctrinally consistent but not yet confirmed against the official portal |
| ⚠️ | Verified but caveated (scope limit, time-bar, narrow doctrinal application) |
| ❌ | Excluded — does not apply, was misapplied, or fabricated text — never cite |

---

## 2. Per-agent source inventory

### 2.1 Brazil

| Agent | Instrument | Official portal | Mirror used | Status | Articles to lock |
|---|---|---|---|---|---|
| `BR_CDC` | Lei 8.078/1990 | planalto.gov.br/ccivil_03/leis/l8078compilado.htm | sources/BR/L8078_CDC.md ✅ cached | ✅ verified (sources/BR/L8078_CDC.md · 2026-04-27; official Planalto text confirmed) | 1, 2, 3, 4, 6 (I/IV/VI/VIII), 7 par. único, 14, 20, 30, 35, 39 (IV/V/IX), 42 (⚠️ debt-collection only), 47, 51 (IV/XI) |
| `BR_CBA` | Lei 7.565/1986 | planalto.gov.br/ccivil_03/leis/l7565.htm | sources/BR/L7565_CBA.md ✅ cached | ✅ verified (sources/BR/L7565_CBA.md · 2026-04-27) | 3 (jurisdictional cornerstone), 226, 233 |
| `BR_ANAC_R400` | Resolução ANAC 400/2016 (corrigida) | anac.gov.br/assuntos/legislacao/legislacao-1/resolucoes/2016/resolucao-no-400-13-12-2016 | sources/BR/R400_ANAC.md ✅ cached | ✅ verified (sources/BR/R400_ANAC.md · 2026-04-27; corrected article numbering) | 5, 20, 21, 22, 24, 26, 27, 28 — ❌ **never** legacy 10/11/12 |
| `BR_CP` | Decreto-Lei 2.848/1940 | planalto.gov.br/ccivil_03/decreto-lei/del2848compilado.htm | sources/BR/DL2848_CP.md ✅ cached | ✅ verified (sources/BR/DL2848_CP.md · 2026-04-27; web-confirmed) | 109 (prescription), 140 (⚠️ criminal CLOSED), 147 (⚠️ criminal CLOSED) |
| `BR_CC` | Lei 10.406/2002 | planalto.gov.br/ccivil_03/leis/2002/l10406compilada.htm | sources/BR/L10406_CC.md ✅ cached | ✅ verified (sources/BR/L10406_CC.md · 2026-04-27; official Planalto text confirmed, working cache originally extracted from missing_law_info) | 186, 205, 206 §3 V (⚠️ SOL 2027-04-04), 927, 932 III |
| `BR_CF88` | Constituição Federal 1988 | planalto.gov.br/ccivil_03/constituicao/constituicao.htm | sources/BR/CF88.md ✅ cached | ✅ verified; ✅ cached (sources/BR/CF88.md · 2026-04-28) | 4, 5 caput, 5 XXXIV, 5 XXXV, 37 caput |
| `BR_D11129` | Decreto 11.129/2022 | planalto.gov.br/ccivil_03/_ato2019-2022/2022/decreto/d11129.htm | sources/BR/D11129_PNDH3.md ✅ cached | ✅ verified (sources/BR/D11129_PNDH3.md · 2026-04-27; official Planalto text confirmed) | 1–3 (scope, investigation procedures) |
| `BR_LEI9784` | Lei 9.784/1999 | planalto.gov.br/ccivil_03/leis/l9784.htm | sources/BR/L9784.md ✅ cached | ✅ verified (sources/BR/L9784.md · 2026-04-27; official Planalto text confirmed, working cache originally extracted from missing_law_info) | 2 (princípios), 29 (instrução) |
| `BR_ABEAR_PLUS` | ABEAR Code · Lei 12.846/2013 (❌ removed) · Decreto 11.129/2022 | abear.com.br · planalto.gov.br | sources/BR/ABEAR_Code.md ✅ cached (Política POL/PMD only; Estatuto PDF ⚠️ not extractable) | ✅ Política POL/PMD cached (sources/BR/ABEAR_Code.md · 2026-04-27); ❌ Lei 12.846 excluded; ⚠️ Estatuto PDF empty | ABEAR §1 factual context only; PNDH-3 programmatic |
| `BR_L7716` | Lei 7.716/1989 (Lei do Crime Racial) | planalto.gov.br/ccivil_03/leis/l7716.htm | sources/BR/L7716_RacialCrime.md ✅ cached | ✅ verified (sources/BR/L7716_RacialCrime.md · 2026-04-27) | Art. 2-A, 20, 20-A |

### 2.2 Chile

| Agent | Instrument | Official portal | Mirror used | Status | Articles to lock |
|---|---|---|---|---|---|
| `CL_LPDC` | Ley 19.496 (DFL 3/2019) | bcn.cl/leychile/navegar?idNorma=1160403 | sources/CL/L19496_LPDC.md ✅ cached | ✅ cached (sources/CL/L19496_LPDC.md · 2026-04-27; from official BCN PDF downloaded 2026-04-28) | 3(b), 3(e), 23 (⚠️ negligence-based), 23 bis (denied boarding info duties), 50, 50 A |
| `CL_CACH` | Ley 18.916 + Resolución 218 JAC (D.O. 09-MAR-2022) | bcn.cl/leychile/navegar?idNorma=18916 · bcn.cl/leychile/navegar?idNorma=1173462 | sources/CL/L18916_CACH.md + sources/CL/R218_JAC_DerechosPasajeros.md ✅ cached | ✅ verified from official BCN norm pages (Ley 18.916 and Resolución 218 JAC · 2026-04-28) | 131 + JAC informing conditions, 133, 133 A, 133 B — ❌ **never** Art. 1 |
| `CL_CPCL` | Código Penal | bcn.cl/leychile/navegar?idNorma=1984 | sources/CL/CodigoPenal.md + sources/CL/CHIPENCOD_CP.md ✅ cached | ✅ verified from official BCN PDF (Codigo-PENAL_12-NOV-1874 (1).pdf · 2026-04-27); lock list corrected to Arts. 17, 94, 255, 269 TER, 412, 416, 494.16 | 17, 94, 255, 269 TER, 412, 416, 494.16 (⚠️ time-barred) |
| `CL_CONST` | Constitución Política | constituteproject.org/constitution/Chile_2021 · bcn.cl/leychile (Constitución) | sources/CL/Constitucion.md ✅ cached | ✅ verified from official source (missing_law_info/Chile 1980 (rev 2021) Constitution.md · 2026-04-27) | 5, 6, 19.3, 19.7, 20 |
| `CL_DGAC_L16752` | Ley 16.752 | bcn.cl/leychile/navegar?idNorma=28653 | sources/CL/L16752_DGAC.md ✅ cached | ✅ verified from official BCN PDF (LEY-16752_17-FEB-1968.pdf · 2026-04-28) | Art. 3 (functional duties) |
| `CL_DGAC_IVAAF` | DGAC IVAAF — Información a Víctimas | dgac.gob.cl/dpa/ivaaf/ | sources/CL/DGAC_IVAAF.md ✅ cached | ✅ cached (sources/CL/DGAC_IVAAF.md · 2026-04-27) | Arts. 1–10 |
| `CL_DGAC_PREVAC` | DGAC PREVAC — Dpto. Prevención de Accidentes | dgac.gob.cl/dpa/prevac/ | sources/CL/DGAC_PREVAC.md ✅ cached | ✅ cached (sources/CL/DGAC_PREVAC.md · 2026-04-27) | Arts. 1–17 |
| `CL_DGAC_DSO` | DGAC DSO — Dpto. Seguridad Operacional | dgac.gob.cl/seguridad/dso/ | sources/CL/DGAC_DSO.md ✅ cached | ✅ cached (sources/CL/DGAC_DSO.md · 2026-04-27) | Arts. 1.1–1.4 |
| `CL_DAN17` | DGAC DAN 17.02 Seguridad Privada | dgac.gob.cl/dasa/dan-17-02/ | sources/CL/DAN17_DGAC.md ✅ cached | ✅ cached (sources/CL/DAN17_DGAC.md · 2026-04-27) | Arts. 1–12 |
| `CL_TRANSPARENCY_L20285` | Ley 20.285 | bcn.cl/leychile/navegar?idNorma=276363 | sources/CL/L20285_Transparencia.md ✅ cached | ✅ verified from official BCN PDF (LEY-20285_20-AGO-2008.pdf · 2026-04-28) | 5, 14 |

### 2.3 International

| Agent | Instrument | Official portal | Status | Articles/Standards to lock |
|---|---|---|---|---|
| `INT_ACHR` | American Convention on Human Rights (1969) | oas.org/dil/treaties_B-32_American_Convention_on_Human_Rights.htm · cidh.oas.org | ✅ verified; ✅ cached (sources/INT/ACHR_1969.md · 2026-04-27) | 1(1), 5, 7, 8, 17, 19, 44, 46 |
| `INT_MC99` | Montreal Convention 1999 | icao.int (Doc 9740) · iata.org | ✅ verified; ✅ cached (sources/INT/MC99_1999.md · 2026-04-27) | 1, 17 (⚠️ bodily-injury Tseng), 19, 22 (⚠️ limits not assistance), 33, 35, 46, 49 |
| `INT_CHICAGO_VCLT` | Chicago Convention 1944 + VCLT 1969 | icao.int · un.org/treaties | ✅ verified; ✅ cached (sources/INT/Chicago_1944.md + sources/INT/VCLT_1969.md · 2026-04-28) | Chicago 26 (⚠️ "accident" not "incident"), 37 (aspirational), 38; VCLT 26, 27 |
| `INT_ICAO_AN9` | ICAO Annex 9 (Facilitation, 15th ed.) | icao.int — Annex 9 | ✅ verified; ✅ cached (sources/INT/ICAO_Annex9.md · 2026-04-27) | Standards 3.42, 3.44, 3.45, 8.15 (⚠️ `Standard` not `Article`) |
| `INT_ICAO_AN17` | ICAO Annex 17 (Security) | icao.int — Annex 17 | ✅ verified; ✅ cached (sources/INT/ICAO_Annex17.md · 2026-04-27) | Standards 2.1.1, 3.1.1, 5.2.1 (⚠️ weak fit) |
| `INT_ICAO_AN6_AN13` | ICAO Annex 6 (Operations) + Annex 13 (Investigation) | icao.int — Annex 6/13 | ✅ verified; ✅ cached (sources/INT/ICAO_Annex6.md + sources/INT/ICAO_Annex13.md · 2026-04-27) | AN6 §3.3.1; AN13 Ch1, Ch5 §5.5.1 (⚠️ weak applicability) |
| `INT_ICAO_AN10_AN11_AN14_AN18` | ICAO Annexes 10, 11, 14, 18 | icao.int | ✅ verified; ✅ cached (sources/INT/ICAO_Annex10.md, Annex11.md, Annex14.md, Annex18.md · 2026-04-27) | Telecommunications, ATS, Aerodromes, Dangerous Goods |
| `INT_ICAO_DOC4444_8168_9284` | ICAO Doc 4444, 8168, 9284 | icao.int | ✅ verified; ✅ cached (sources/INT/ICAO_DOC4444.md, DOC8168.md, DOC9284.md · 2026-04-27) | ATM Procedures, PANS-OPS, Dangerous Goods Tech Instructions |
| `INT_VCCR` | Vienna Convention on Consular Relations 1963 | un.org/treaties (VCCR) | ✅ verified; ✅ cached (sources/INT/VCCR_1963.md · 2026-04-28) | 36.1.b, 36.1.c, 36.2 |
| `INT_UNCRC_HAGUE` | UNCRC 1989 + Hague 1980 | ohchr.org · hcch.net | ✅ verified; ✅ cached (sources/INT/UNCRC_1989.md + sources/INT/Hague_1980.md · 2026-04-28) | UNCRC 3, 9, 10, 11; Hague 1, 12 (⚠️ analogical only) |
| `INT_IATA_GC` | IATA General Conditions of Carriage | iata.org | ✅ verified; ✅ cached (sources/INT/IATA_GC.md · 2026-04-27) | 8, 9, 10, 11, 12 — ⚠️ contractual not treaty |
| `INT_SOFTLAW` | UNGCP A/RES/70/186 · ILC ARSIWA · BR-CL Joint Decl. 2024 | un.org · legal.un.org · itamaraty.gov.br · minrel.gob.cl | ✅ verified; ✅ cached (sources/INT/UNGCP.md + sources/INT/ILC_ARSIWA.md + sources/INT/BR_CL_Joint_Declaration_2024.md · 2026-04-28) | UNGCP 5, 11, 19; ILC ARSIWA Art. 4; Joint Decl. 10, 12, 13, 19, 40, 41, 55 (⚠️ political not treaty) |

---

## 3. Aggregate gathering status

| Bucket | Count | Examples |
|---|---|---|
| ✅ Fully verified + locally cached (sources/) | **32** agents | BR_CDC, BR_CBA, BR_ANAC_R400, BR_CP, BR_CC, BR_CF88, BR_D11129, BR_LEI9784, BR_L7716, BR_ABEAR_PLUS; **CL_LPDC**, CL_CACH, CL_CPCL, CL_CONST, CL_DGAC_L16752, CL_TRANSPARENCY_L20285, CL_DGAC_IVAAF, CL_DGAC_PREVAC, CL_DGAC_DSO, CL_DAN17; INT_ACHR, INT_MC99, INT_CHICAGO_VCLT, INT_ICAO_AN9, INT_ICAO_AN17, INT_ICAO_AN6_AN13, INT_ICAO_AN10_AN11_AN14_AN18, INT_ICAO_DOC4444_8168_9284, INT_VCCR, INT_IATA_GC, INT_UNCRC_HAGUE, INT_SOFTLAW |
| ⏳ Locally cached but still awaiting source-level verification | **0** agents | — |
| ✅ Verified without local source cache | **0** agents | — |
| ✅ Verified with partial optional cache coverage | **0** agents | — |
| ❌ Excluded / fabricated / time-barred from criminal track | flagged inline | CACH Art. 1 (fabrication), CDC Art. 42 (debt-only), R400 Arts. 10/11/12 (legacy), Lei 12.846 (analogy too weak), CL CP Art. 494.16 (time-barred), BR CP 140/147 (procedural deadline lapsed), Hague 1980 (analogical only), Joint Decl. (political not treaty) |

**Bottom line**: every Chilean statute and operative implementing instrument currently needed in the lock list is now rebuilt or confirmed against official text, the remaining Brazil Planalto backlog has been closed, the BR-CL Joint Declaration component under `INT_SOFTLAW` is cached from the official Itamaraty text, and optional offline caches now also cover CF88, Chicago, VCLT, VCCR, UNCRC, Hague 1980, UNGCP, and ILC ARSIWA. No substantive public-law source-gather gap remains in the current `0_agents` manifest, but deferred private-governance review items remain for the ABRAPAVAA statute and the non-extractable ABEAR Estatuto PDF.

---

## 4. Remaining gathering gaps

### P0 — Substantive missing official-text gather

No remaining substantive public-law source gaps in the current `0_agents` manifest.

### P1 — Deferred later-stage review items

- `BR_ABRAPAVAA_SENTRA`: ABRAPAVAA statute/bylaws are still not publicly cached. Treat this as a later-stage review item for any internal article-level governance claim.
- `BR_ABEAR_PLUS`: the ABEAR Estatuto PDF remains non-extractable in the current toolchain. Keep policy-text routing, but defer statute-level extraction work to a later pass.

### P2 — Optional offline-cache expansion for already verified agents

No remaining optional cache gaps.

### P3 — Not missing anymore

- Brazil Planalto confirmation work for `BR_CDC`, `BR_CC`, `BR_D11129`, and `BR_LEI9784` is complete.
- The stale `DS 113/2017 MTT` anchor under `CL_CACH` has been replaced by the verified JAC Resolution 218/2022 implementing rule for Art. 131.
- The ICAO bundle rows are fully reconciled with their verified component caches.
- The BR-CL Joint Declaration text is now cached from the official Itamaraty page.
- Optional offline caches for `BR_CF88`, `INT_Chicago_1944`, `INT_VCLT_1969`, `INT_VCCR_1963`, `INT_UNCRC_1989`, `INT_Hague_1980`, `INT_UNGCP`, and `INT_ILC_ARSIWA` are now present in `sources/`.
- `ABEAR_Code.md` remains usable for the policy text; the Estatuto PDF is still not extractable, but that is an availability constraint rather than an open gathering task.

---

## 5. Cache layout — `sources/`

```
0_agents/sources/
├── BR/
│   ├── L8078_CDC.md               ✅ cached 2026-04-27
│   ├── L7565_CBA.md               ✅
│   ├── R400_ANAC.md               ✅
│   ├── DL2848_CP.md               ✅
│   ├── L7716_RacialCrime.md       ✅
│   ├── D11129_PNDH3.md            ✅ cached 2026-04-27
│   ├── L10406_CC.md               ✅ cached 2026-04-27
│   ├── L9784.md                   ✅ cached 2026-04-27
│   ├── ABEAR_Code.md              ✅ Política POL/PMD cached 2026-04-27; ⚠️ Estatuto PDF not extractable
│   └── CF88.md                    ✅ cached 2026-04-28
├── CL/
│   ├── L18916_CACH.md             ✅ cached 2026-04-27
│   ├── CHIPENCOD_CP.md            ✅ cached 2026-04-27
│   ├── CodigoPenal.md             ✅ cached 2026-04-27
│   ├── Constitucion.md            ✅ cached 2026-04-27
│   ├── DAN17_DGAC.md              ✅ cached 2026-04-27
│   ├── DGAC_DSO.md                ✅ cached 2026-04-27
│   ├── DGAC_IVAAF.md              ✅ cached 2026-04-27
│   ├── DGAC_PREVAC.md             ✅ cached 2026-04-27
│   ├── L16752_DGAC.md             ✅ cached 2026-04-27
│   ├── L20285_Transparencia.md    ✅ cached 2026-04-27
│   ├── L19496_LPDC.md             ✅ cached 2026-04-27 (from official BCN PDF; Arts. 3b, 3e, 23, 23bis, 50, 50A)
│   └── R218_JAC_DerechosPasajeros.md ✅ cached 2026-04-28
└── INT/
    ├── ACHR_1969.md               ✅ cached 2026-04-27
    ├── MC99_1999.md               ✅ cached 2026-04-27
    ├── IATA_GC.md                 ✅ cached 2026-04-27
    ├── ICAO_Annex6.md             ✅ cached 2026-04-27
    ├── ICAO_Annex9.md             ✅ cached 2026-04-27
    ├── ICAO_Annex10.md            ✅ cached 2026-04-27
    ├── ICAO_Annex11.md            ✅ cached 2026-04-27
    ├── ICAO_Annex13.md            ✅ cached 2026-04-27
    ├── ICAO_Annex14.md            ✅ cached 2026-04-27
    ├── ICAO_Annex17.md            ✅ cached 2026-04-27
    ├── ICAO_Annex18.md            ✅ cached 2026-04-27
    ├── ICAO_DOC4444.md            ✅ cached 2026-04-27
    ├── ICAO_DOC8168.md            ✅ cached 2026-04-27
    ├── ICAO_DOC9284.md            ✅ cached 2026-04-27
    ├── BR_CL_Joint_Declaration_2024.md ✅ cached 2026-04-28
    ├── Chicago_1944.md            ✅ cached 2026-04-28
    ├── VCLT_1969.md               ✅ cached 2026-04-28
    ├── VCCR_1963.md               ✅ cached 2026-04-28
    ├── UNCRC_1989.md              ✅ cached 2026-04-28
    ├── Hague_1980.md              ✅ cached 2026-04-28
    ├── UNGCP.md                   ✅ cached 2026-04-28
    └── ILC_ARSIWA.md              ✅ cached 2026-04-28
```

> Convention: each MD file begins with a metadata section — `Source`, `Fetched`, `Sha256`, `Articles`, `Notes` — matching the original 5-line header convention, followed by per-article `###` headings with full text and ELI ID tags.

---

## 6. Update protocol

1. Fetch text from the official URL listed above.
2. Save to `sources/<JURISDICTION>/<FILENAME>` with the 5-line header.
3. In the agent's `agent.md` Section 3, change `⏳ pending` → `✅ verified (sources/<path> · YYYY-MM-DD)`.
4. In each Section 2 article row, replace `⏳` with `✅` once the article text is included verbatim in the cache file.
5. Append a row to the changelog at the bottom of `INDEX.md`.
6. Re-run M6 validation: confirm no NEVER-do rule was violated by the verified text (e.g., that R400's official text really uses the corrected article numbers).

---

## 7. What is **already in** the workspace

- ✅ All 4 authoritative verification reports (BR / BR-strategic / CL_v2 / INT / INT-strategic) under `la8159/01-violations/` — these are the **doctrinal ground truth** that drove every agent's NEVER-do rules.
- ✅ All active agent specs are present in the workspace: 33 specialists + 7 meta, plus the template. Section 3 source blocks and per-article verification flags reflect each spec's current maturity (`✅` / `⏳` / `⚠️` / `❌`).
- ✅ `mapping.json` routing all 71 violation IDs.
- ✅ `INDEX.md` agent inventory.
- ✅ **44 law article MD files** cached in `sources/{BR,CL,INT}/` (10 BR, 12 CL, 22 INT): the official JAC Resolution 218 cache was added on 2026-04-28 on top of the earlier CF88, Chicago, VCLT, VCCR, UNCRC, Hague, UNGCP, ILC ARSIWA, and official BR-CL Joint Declaration caches.

## 8. What is **still to gather**

- Required: none.
- Optional if you want every verified agent to also have a local offline cache file: none.
- Not actually pending anymore: `CL_CACH` no longer depends on unresolved `DS 113/2017 MTT`; the operative Art. 131 implementing rule is now grounded in official JAC Resolution 218/2022.

> In short: there is no remaining source-gather gap in the current `0_agents` manifest. The optional cache-completeness backlog is closed.

## 9. Provenance

- Aggregated from Section 3 of the active specialist and meta `agent.md` files in this folder.
- Cross-checked against verification reports under `la8159/01-violations/`.
- Last sync: 2026-04-28.
- Cache populated: 2026-04-28 (44 MD files from 09_LAW JSON sources, missing_law_info PDFs/MDs, the official Itamaraty Joint Declaration page, the official JAC Resolution 218 norm page, and eight newly added offline treaty/constitutional/soft-law caches).
