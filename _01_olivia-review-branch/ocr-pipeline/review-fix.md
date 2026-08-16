logger.js:329  LA8159 Debug  fetch interceptor active — OliviaLegal.verbose=true to expand · OliviaLegal.noisy=true for remote-bus/blob · OliviaLegal.filter="/api" to narrow · OliviaLegal.enabled=false to silence
app-state.js:36 [AppState] loaded — agents, selectedAgent (application state)
session-state.js:24 [SessionState] loaded — chatHistory, activeStream, currentRunId, tokens (transient)
api-client.js:558 [LA8159API] v1.3 loaded — 47 functions across 10 groups
service-registry.js:135 [OliviaServices] loaded — 7 services registered
permission-interface.js:139 [OliviaPermissions] loaded — advisory UI gating (backend authoritative)
context-client.js:162 [OliviaContext] loaded — context client (additive, reads live module state)
capability-registry.js:171 [OliviaCapabilities] loaded — availability derived, not raw health
logger.js:258  GET /api/memory/sources
logger.js:258  GET /olivia/languages/english.index.json
logger.js:258  GET /api/projects/list
logger.js:258  GET /api/projects/degaut/files
logger.js:258  POST /api/projects/degaut/index/refresh
logger.js:258  GET /api/projects/degaut/files
logger.js:258  GET /api/projects/degaut/files?agent_id=5a4f344c-f655-42d3-9a5b-0b7f35a8b1f2
logger.js:258  GET /api/projects/degaut/raw?path=docs%2Ffindings.md
logger.js:258  GET /api/projects/degaut/raw?path=docs%2Fprogress.md
logger.js:258  GET /api/projects/degaut/settings
logger.js:258  GET /api/ocr/status?project_id=degaut
logger.js:259  url   http://localhost:3229/api/ocr/status?project_id=degaut
logger.js:279  200 OK  5ms
logger.js:258  GET /api/ocr/documents?project_id=degaut
logger.js:259  url   http://localhost:3229/api/ocr/documents?project_id=degaut
logger.js:279  200 OK  16ms
logger.js:258  GET /api/ocr/documents?project_id=degaut
logger.js:259  url   http://localhost:3229/api/ocr/documents?project_id=degaut
logger.js:279  200 OK  6ms
logger.js:258  GET /api/ocr/profiles?project_id=degaut
logger.js:259  url   http://localhost:3229/api/ocr/profiles?project_id=degaut
logger.js:279  200 OK  6ms
logger.js:258  GET /api/ocr/status?project_id=degaut
logger.js:259  url   http://localhost:3229/api/ocr/status?project_id=degaut
logger.js:279  200 OK  7ms
logger.js:258  GET /api/ocr/documents?project_id=degaut
logger.js:259  url   http://localhost:3229/api/ocr/documents?project_id=degaut
logger.js:279  200 OK  6ms
logger.js:258  GET /api/ocr/status?project_id=degaut
ocr-pipeline.js:195 Uncaught TypeError: Cannot read properties of null (reading 'click')
    at HTMLDivElement.<anonymous> (ocr-pipeline.js:195:52)
logger.js:258  POST /api/ocr/upload
logger.js:259  url   http://localhost:3229/api/ocr/upload
logger.js:265  body  {}
logger.js:279  200 OK  14ms
logger.js:258  POST /api/ocr/run
logger.js:259  url   http://localhost:3229/api/ocr/run
logger.js:265  body  {
  "upload_id": "ocr-1786597138975-5b7b355d",
  "project_id": "degaut"
}
logger.js:269  hdrs  {
  "Content-Type": "application/json"
}
logger.js:258  GET /health
logger.js:279  200 OK  22447ms
logger.js:258  GET /api/ocr/status?project_id=degaut
logger.js:259  url   http://localhost:3229/api/ocr/status?project_id=degaut
logger.js:258  GET /api/ocr/documents?project_id=degaut
logger.js:279  200 OK  5ms
logger.js:258  GET /api/ocr/documents?project_id=degaut
logger.js:259  url   http://localhost:3229/api/ocr/documents?project_id=degaut
logger.js:279  200 OK  9ms
logger.js:258  GET /api/ocr/status?project_id=degaut
logger.js:259  url   http://localhost:3229/api/ocr/status?project_id=degaut
logger.js:279  200 OK  5ms
logger.js:258  GET /api/ocr/documents?project_id=degaut
logger.js:259  url   http://localhost:3229/api/ocr/documents?project_id=degaut
logger.js:279  200 OK  8ms
logger.js:258  GET /api/ocr/profiles?project_id=degaut
logger.js:258  GET /api/ocr/documents?project_id=degaut
logger.js:259  url   http://localhost:3229/api/ocr/documents?project_id=degaut
logger.js:279  200 OK  9ms
logger.js:258  POST /api/ocr/finalize
logger.js:259  url   http://localhost:3229/api/ocr/finalize
logger.js:265  body  {
  "project_id": "degaut",
  "person_name": "Juliana Rios",
  "markdown": "# Juliana Rios\n\n## Contact\n\nwww .linkedin.com/in/juliana-riosa22388 (Linkedln) Top Skills Change Management Strategy Strategic Planning Juliana Rios Chief Information and Digital Officer @ LATAM Airlines | Board Member | Mom Chile\n\n## Top Skills\n\n- Change Management Strategy Strategic Planning Juliana Rios Chief Information and Digital Officer @ LATAM Airlines | Board Member | Mom Chile\n\n## Summary\n\nSr Vice-President and CIDO at LATAM Airlines. Digital transformation, customer experience, business strategy.\n\n## Experience\n\n- LATAM Airlines 11 years 2 months Chief Information and Digital Officer January 2021 - Present (5 years 8 months) Leading LATAM IT and digital teams to challenge, inspire and deliver solutions that help customers reach their destination in the best possible way through a simple, sustainable and efficient operation. VP Customer and Commercial Solutions, Santiago CL September 2 ...[truncated]
logger.js:269  hdrs  {
  "Content-Type": "application/json"
}
logger.js:258  POST /api/ocr/finalize
logger.js:259  url   http://localhost:3229/api/ocr/finalize
logger.js:265  body  {
  "project_id": "degaut",
  "person_name": "Juliana Rios 7b355d",
  "markdown": "# Juliana Rios 7b355d\n\n## Contact\n\nwww .linkedin.com/in/juliana-riosa22388 (Linkedln) Top Skills Change Management Strategy Strategic Planning Juliana Rios Chief Information and Digital Officer @ LATAM Airlines | Board Member | Mom Chile\n\n## Top Skills\n\n- Change Management Strategy Strategic Planning Juliana Rios Chief Information and Digital Officer @ LATAM Airlines | Board Member | Mom Chile\n\n## Summary\n\nSr Vice-President and CIDO at LATAM Airlines. Digital transformation, customer experience, business strategy.\n\n## Experience\n\n- LATAM Airlines 11 years 2 months Chief Information and Digital Officer January 2021 - Present (5 years 8 months) Leading LATAM IT and digital teams to challenge, inspire and deliver solutions that help customers reach their destination in the best possible way through a simple, sustainable and efficient operation. VP Customer and Commercial Solutions, Santiago  ...[truncated]
logger.js:269  hdrs  {
  "Content-Type": "application/json"
}
logger.js:258  POST /api/ocr/finalize
logger.js:259  url   http://localhost:3229/api/ocr/finalize
logger.js:265  body  {
  "project_id": "degaut",
  "person_name": "Paulo Miranda",
  "markdown": "# Paulo Miranda\n\n## Contact\n\nwww .linkedin.com/in/ paulosmiranda (LinkedIn) Top Skills Customer\n\n## Top Skills\n\n- Customer\n\n## Languages\n\n- Spanish English Portuguese Paulo Miranda Board Member | Group EVP | C-Level Executive | Chief\n\n## Summary\n\nBoard Member | C-Level Executive |Senior executive and board member with a proven track record of leading transformation and delivering sustainable growth across complex, regulated, and customer-centric industries. Recognized for shaping and executing strategies that strengthen competitive positioning, enhance customer experience, and drive operational excellence at scale.Brings deep expertise in business development, strategic partnerships, and large-scale operations, with a strong focus on innovation, customercentricity, and value creation. Combines strong commercial acumen with operational discipline to improve performance, profitability, and long-t ...[truncated]
logger.js:269  hdrs  {
  "Content-Type": "application/json"
}
logger.js:258  POST /api/ocr/finalize
logger.js:259  url   http://localhost:3229/api/ocr/finalize
logger.js:265  body  {
  "project_id": "degaut",
  "person_name": "Paulo Miranda 7b355d",
  "markdown": "# Paulo Miranda 7b355d\n\n## Contact\n\nwww .linkedin.com/in/ paulosmiranda (LinkedIn) Top Skills Customer\n\n## Top Skills\n\n- Customer\n\n## Languages\n\n- Spanish English Portuguese Paulo Miranda Board Member | Group EVP | C-Level Executive | Chief\n\n## Summary\n\nBoard Member | C-Level Executive |Senior executive and board member with a proven track record of leading transformation and delivering sustainable growth across complex, regulated, and customer-centric industries. Recognized for shaping and executing strategies that strengthen competitive positioning, enhance customer experience, and drive operational excellence at scale.Brings deep expertise in business development, strategic partnerships, and large-scale operations, with a strong focus on innovation, customercentricity, and value creation. Combines strong commercial acumen with operational discipline to improve performance, profitabili ...[truncated]
logger.js:269  hdrs  {
  "Content-Type": "application/json"
}
logger.js:258  POST /api/ocr/finalize
logger.js:259  url   http://localhost:3229/api/ocr/finalize
logger.js:265  body  {
  "project_id": "degaut",
  "person_name": "Roberto Alvo",
  "markdown": "# Roberto Alvo\n\n## Contact\n\nwww .linkedin.com/in/roberto-alvo (LinkedIn) www.latam.com (Company) Top Skills Business Planning Change Management Due Diligence Languages English (Native or Bilingual) Portuguese (Professional Working) Spanish (Native or Bilingual) French (Professional Working) Roberto Alvo CEO at LATAM Airlines\n\n## Top Skills\n\n- Business Planning Change Management Due Diligence\n\n## Languages\n\n- English (Native or Bilingual) Portuguese (Professional Working) Spanish (Native or Bilingual) French (Professional Working) Roberto Alvo CEO at LATAM Airlines\n\n## Summary\n\nIn 2020, | became CEO of LATAM, where | have worked for 20 years. Throughout this period, learning has been a constant. Since the beginning, there have been many challenges and achievements. | transformed and evolved together with the company. At LATAM, we are convinced of our role as agents of transformation. Contributing ...[truncated]
logger.js:269  hdrs  {
  "Content-Type": "application/json"
}
logger.js:258  POST /api/ocr/finalize
logger.js:259  url   http://localhost:3229/api/ocr/finalize
logger.js:265  body  {
  "project_id": "degaut",
  "person_name": "Roberto Alvo 7b355d",
  "markdown": "# Roberto Alvo 7b355d\n\n## Contact\n\nwww .linkedin.com/in/roberto-alvo (LinkedIn) www.latam.com (Company) Top Skills Business Planning Change Management Due Diligence Languages English (Native or Bilingual) Portuguese (Professional Working) Spanish (Native or Bilingual) French (Professional Working) Roberto Alvo CEO at LATAM Airlines\n\n## Top Skills\n\n- Business Planning Change Management Due Diligence\n\n## Languages\n\n- English (Native or Bilingual) Portuguese (Professional Working) Spanish (Native or Bilingual) French (Professional Working) Roberto Alvo CEO at LATAM Airlines\n\n## Summary\n\nIn 2020, | became CEO of LATAM, where | have worked for 20 years. Throughout this period, learning has been a constant. Since the beginning, there have been many challenges and achievements. | transformed and evolved together with the company. At LATAM, we are convinced of our role as agents of transformation ...[truncated]
logger.js:269  hdrs  {
  "Content-Type": "application/json"
}
logger.js:258  POST /api/ocr/finalize
logger.js:259  url   http://localhost:3229/api/ocr/finalize
logger.js:265  body  {
  "project_id": "degaut",
  "person_name": "bornah moghbel",
  "markdown": "# bornah moghbel\n\n## Contact\n\nwww .linkedin.com/in/bornahmoghbel-837946221 (LinkedIn) Bornah Moghbel Partner, Co-Founder & Co-CIO San Francisco, California, United S\n\n## Experience\n\n- Sixth Street 17 years 3 months Partner, Co-Founder & Co-CIO February 2026 - Present (7 months) Co-Founder & Partner June 2009 - February 2026 (16 years 9 months)\n\n## Education\n\nUniversity of California, Berkeley\n",
  "pages": [
    "bornah-moghbel-1.jpg"
  ]
}
logger.js:269  hdrs  {
  "Content-Type": "application/json"
}
logger.js:258  POST /api/ocr/finalize
logger.js:259  url   http://localhost:3229/api/ocr/finalize
logger.js:265  body  {
  "project_id": "degaut",
  "person_name": "bornah moghbel 7b355d",
  "markdown": "# bornah moghbel 7b355d\n\n## Contact\n\nwww .linkedin.com/in/bornahmoghbel-837946221 (LinkedIn) Bornah Moghbel Partner, Co-Founder & Co-CIO San Francisco, California, United S\n\n## Experience\n\n- Sixth Street 17 years 3 months Partner, Co-Founder & Co-CIO February 2026 - Present (7 months) Co-Founder & Partner June 2009 - February 2026 (16 years 9 months)\n\n## Education\n\nUniversity of California, Berkeley\n",
  "pages": [
    "bornah-moghbel-7b355d-1.jpg"
  ]
}
logger.js:269  hdrs  {
  "Content-Type": "application/json"
}
logger.js:258  POST /api/ocr/finalize
logger.js:259  url   http://localhost:3229/api/ocr/finalize
logger.js:265  body  {
  "project_id": "degaut",
  "person_name": "ramiro alfonsin",
  "markdown": "# ramiro alfonsin\n",
  "pages": [
    "ramiro-alfonsin-1.jpg",
    "ramiro-alfonsin-2.jpg",
    "ramiro-alfonsin-3.jpg"
  ]
}
logger.js:269  hdrs  {
  "Content-Type": "application/json"
}
logger.js:258  POST /api/ocr/finalize
logger.js:259  url   http://localhost:3229/api/ocr/finalize
logger.js:265  body  {
  "project_id": "degaut",
  "person_name": "ramiro alfonsin 7b355d",
  "markdown": "# ramiro alfonsin 7b355d\n",
  "pages": [
    "ramiro-alfonsin-7b355d-1.jpg",
    "ramiro-alfonsin-7b355d-2.jpg",
    "ramiro-alfonsin-7b355d-3.jpg"
  ]
}
logger.js:269  hdrs  {
  "Content-Type": "application/json"
}
logger.js:279  200 OK  9ms
logger.js:279  200 OK  9ms
logger.js:279  200 OK  8ms
logger.js:279  200 OK  9ms
logger.js:279  200 OK  10ms
logger.js:279  200 OK  15ms
logger.js:279  200 OK  16ms
logger.js:279  200 OK  18ms
logger.js:279  200 OK  18ms
logger.js:279  200 OK  18ms
logger.js:258  GET /api/ocr/profiles?project_id=degaut
logger.js:259  url   http://localhost:3229/api/ocr/profiles?project_id=degaut
logger.js:279  200 OK  3ms
logger.js:258  GET /health
logger.js:259  url   http://localhost:3229/health
logger.js:269  hdrs  {
  "Accept": "application/json"
}
logger.js:258  GET /api/memory/collections
logger.js:259  url   http://localhost:3229/api/memory/collections
logger.js:269  hdrs  {
  "Accept": "application/json"
}
logger.js:258  GET /api/bridge/categories
logger.js:259  url   http://localhost:3229/api/bridge/categories
logger.js:269  hdrs  {
  "Accept": "application/json"
}
logger.js:258  GET /api/architecture/generated/
logger.js:259  url   http://localhost:3229/api/architecture/generated/
logger.js:269  hdrs  {
  "Accept": "application/json"
}
logger.js:258  GET /api/architecture/skills
logger.js:259  url   http://localhost:3229/api/architecture/skills
logger.js:269  hdrs  {
  "Accept": "application/json"
}
logger.js:258  GET /api/diarization/models/whisper
logger.js:259  url   http://localhost:3229/api/diarization/models/whisper
logger.js:269  hdrs  {
  "Accept": "application/json"
}
logger.js:279  200 OK  11ms
logger.js:279  200 OK  15ms
logger.js:279  200 OK  13ms
logger.js:273  GET http://localhost:3229/api/architecture/generated/ 503 (Service Unavailable)
window.fetch @ logger.js:273
_probeHttp @ service-registry.js:45
_probe @ service-registry.js:62
(anonymous) @ service-registry.js:118
logger.js:281  503 Service Unavailable  16ms
(anonymous) @ logger.js:281
Promise.then
window.fetch @ logger.js:274
_probeHttp @ service-registry.js:45
_probe @ service-registry.js:62
(anonymous) @ service-registry.js:118
logger.js:279  200 OK  16ms
logger.js:290  NETWORK ERROR  signal is aborted without reason  8001ms
(anonymous) @ logger.js:290
Promise.catch
window.fetch @ logger.js:287
_probeHttp @ service-registry.js:45
_probe @ service-registry.js:62
(anonymous) @ service-registry.js:118

---

## Fix verification — 2026-08-13 (post-fix regression run)

The console dump above is from the pre-fix test run. Four defects were identified
and fixed in the working tree (serve.py, ocr-pipeline.js, generic_ocr_pipeline.py,
ocr_profile_analytics.py). The fixes are now verified end-to-end against the live
server (PID 95320, started 2026-08-13 04:25 — loaded the fixed code) using the
degaut project store.

| # | Defect (from dump) | Fix | Verified |
|---|---|---|---|
| 1 | `ocr-pipeline.js:195 Uncaught TypeError: Cannot read properties of null (reading 'click')` on drag-drop area | `setupUploadDrag` click handler now null-guards `#ocrFileInput` (`if (input) input.click()`) | Static review of current file |
| 2 | Finalize created per-person profiles with upload-id tail in the name ("Juliana Rios 7b355d", "Paulo Miranda 7b355d", ...) — one extra "person" per upload | `ocrPersonBase()` (frontend) + `_ocr_person_base()`/`_ocr_clean_person_name()` (backend) strip upload-id tails and page markers; `_ocr_dedupe_profiles` prunes already-corrupted entries; finalize replaces by normalized name | Node regression: 11 upload-id-tail / page-marker / plain filenames all group to the expected clean base; Python helper asserts pass |
| 3 | "ramiro alfonsin" finalize saved title-only markdown (`# ramiro alfonsin\n`) — pages had no usable text | Blank/whitespace-only pages filtered before merge; finalize rejects markdown with no content beyond the title (`422`-equivalent guard) | Node merge of real store text produces sections (Contact/Skills/Languages/Summary/Experience), not title-only |
| 4 | Duplicate finalize calls persisted duplicate profiles | Finalize replaces the existing profile with the same normalized name; GET `/api/ocr/profiles` dedupes idempotently | Live API: 3 sequential finalizes (clean name, tail-name, clean again) → `profile_count` stays 1; store has exactly one "Paulo Miranda" profile |

### Live run summary (degaut)

- `POST /api/ocr/upload` (bornah-moghbel.pdf, Roberto-Alvo.pdf, Paulo-Miranda.pdf) → upload_id `ocr-1786617908544-53b8e338`
- `POST /api/ocr/run` (no LLM provider) → 6/6 files OCR ok in ~6.6 s; pipeline_summary steps `profile_llm_analysis`/`profile_refinement` correctly `skipped` (no provider)
- Store persisted at `uploads/projects/degaut/ocr/ocr_store.json` (16 634 bytes) — confirms the earlier dump session's persistence gap is resolved
- `GET /api/ocr/profiles` → `[('Paulo Miranda','manual',3)]`; pending groups `bornah-moghbel` (1 page), `Paulo-Miranda` (3), `Roberto-Alvo` (2)
- Pack validation: `node generated/validate-pack.mjs` → **passed**

### Note

LLM analysis/refinement (STEP 10) was not exercised in this run (no `--llm-provider` /
`DEEPSEEK_API_KEY` in the test). The pipeline-side code paths compile and are covered by
`--help`/`--dry-run`; a provider-backed run remains a follow-up verification item.
