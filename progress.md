# Progress

## 2026-08-27
- Started Event Map case-source integration.
- Confirmed source locations and current importer helpers.
- Added New Map source chooser and shared API loading for violations, transcripts, emails, and all sources.
- Added transcript-card normalization and source provenance in event details.
- Validation: source JSON parsed; source counts are 72 / 27 / 29; JavaScript syntax checks passed.
- Improved node visualization with deterministic arrangement, larger fixed node cards, wrapped titles, source/date metadata, and compact summaries.
- Added an Arrange nodes control and automatic arrangement after fresh source loading.
- Final JavaScript and editor diagnostics passed.
- Replaced the flat grid arrangement with semantic source lanes and automatic relationship links.
- Added vertical/horizontal connector routing and lane headings/counts to match the diagram-style reference.
- Final renderer syntax and diagnostics passed.
- Restored the graph-toolbar Add event action.
- Empty Map now creates and selects an initial starter event; add/duplicate refresh filters.
- Final add-node syntax and diagnostics passed.
- Added node-level Add field dialog with known-field suggestions, custom fields, text/JSON values, and Markdown preview.
- New fields are preserved in the event and rendered in the rich detail view and filter field inventory.
- Moved granular filter selectors and active rules inside each collapsible source group.
- Source rules now evaluate only records from their owning source; final syntax and diagnostics passed.
- Expanded each source's card visibility checklist to every available field, including nested fields.
- Selected fields now render as labeled card lines, and automatic lane spacing accounts for expanded card content.
- Added per-node hide/show toggle (toolbar button) and per-field hide/show toggles (eye buttons) in the detail panel.
- Hidden nodes are excluded from graph, timeline, entities, and filter counts; hidden fields are excluded from card rendering.
- Added `.em-field-visibility` / `.is-hidden` styles; removed duplicate helper definitions; entities view now respects node visibility.
- Added an "Add new category…" option to the category dropdown; new categories are added to `EVENT_CATEGORIES` and reflected in the legend, lanes, and node colors.
- Added a "…" button at the end of the legend that opens a config popover with a color picker for every category; changing a color updates node fills and the legend immediately.
- Added arrow/link editing: a "Link" toggle button enters link mode (click source then target to create an arrow), clicking an existing arrow selects it and opens a detail panel with From/To, a relationship-type selector, and a Remove arrow button.
- Added full persistence via localStorage (`olivia.eventMap.v1`): events, links, and category colors are saved on every mutation (add/duplicate/delete event, add/remove/retarget link, change link type, change category, change category color, node move/resize, field edits, and JSON import) and restored on load.
- Added an "Add arrow" button to the event detail toolbar and the link detail panel; it enters link mode with the source event pre-selected and shows a toast hint ("Click a target event to create an arrow"), so users can create new arrows without using the graph-toolbar Link toggle.
- Reworked field visibility: the eye button is now right-aligned in each widget row (and right-aligned under column rows), and clicking it opens a popover anchored to the button showing the actual field value plus a Hide/Show toggle. Hiding a field persists and removes it from the card; boolean values render as "yes"/"no" instead of raw `true`/`false`.
- Fixed invalid shorthand hex colors (`#888` → `#888888`) in `EVENT_CATEGORIES['Other']` and `RELATIONSHIP_TYPES['related to']`, which broke SVG/CSS color parsing.
- Added a `safeDate()` helper that returns `null` for invalid/empty dates instead of throwing; used it in the event detail date display, the date input field, `eventMapUpdateEvent`, the graph card date label, and the timeline sort/date rendering to eliminate `RangeError: Invalid time value`.
- Made the event detail panel horizontally resizable: added a drag handle on its left edge (`.em-detail-resize`) that adjusts the panel width between 240px and 640px, with the width persisted to localStorage (`panelWidth`) and restored on load.
- Fixed a bug where the resize handle disappeared and stopped working after clicking a node or resizing once: `renderEventDetail`/`renderLinkDetail` overwrite `panel.innerHTML`, which wiped out the handle. Added `ensureDetailResizeHandle()` (re-inserts and re-wires the handle after every detail-panel render) and refactored the drag logic into a reusable `wireDetailResize(handle, panel)`.
- Improved violation JSON import: `importData` now recognizes a single violation object (has `violation_id`/`incident_id` + `legal_basis`/`element_grids`/`allegation_summary`/`incident_timestamp`) and arrays of violations, in addition to the existing `{meta, entries}` index format. `violationToEvent` now reads the actual violation schema: date from `incident_timestamp`, category from the violation's `category` (auto-registered in `EVENT_CATEGORIES`), entities from `aliases` + `key_admissions` speakers, tags from `tags` + `severity` + `jurisdiction`, status from `required_elements_status`, plus flattened `severity`, `incident`, `legal_theory`, `legal_reasoning`, `evidentiary_strength`, `confidence`, `legal_basis_summary`, and `element_grids_summary` fields for the detail panel.
- Final syntax and diagnostics passed.

## 2026-08-27 (map decomposition)
- Violation imports now decompose into a full connected map instead of a single node. Added `violationToMap(v)` which builds a radial cluster around a central violation node: legal-basis article nodes (linked `involved`), element-grid nodes per article (linked `documented by`), key-admission group nodes (linked `documented by`), evidence nodes (linked `documented by`), and related-violation placeholder nodes (linked `related to`).
- Added `violationIndexToMap(violations)` for arrays and `{meta, entries}` index imports, which lays out each violation's cluster side-by-side horizontally so clusters don't overlap.
- `importData` now routes single violations, arrays of violations, and `{meta, entries}` indexes through the map decomposition.
- Validation: CL-001.json decomposes into 38 events + 37 links (1 central, 4 legal basis, 18 elements, 4 admissions, 4 evidence, 7 related); array of 2 violations → 76 events + 74 links; no NaN coordinates; no dangling links; `node --check` and editor diagnostics passed.

## 2026-09-09 (LA8159 incident review compilation)
- Added a responsive Detailed Review Sourcebook to the incident HTML page, linking all 22 requested detailed review files.
- Added a runtime Reviewed Detail Addenda loader that fetches the linked fragments, de-duplicates repeated raw/code-fenced groups, and appends 16 reviewed groups with 125 segment cards.
- Validation: two inline scripts parsed with `new Function`; browser runtime loaded all 22 review files, reported 16 groups, found no duplicate IDs, and found 125 valid reviewed audio URLs.
- Note: the generated `_shared` HTML is intentionally ignored by `.gitignore`; the on-disk page was updated successfully.
