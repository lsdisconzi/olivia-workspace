<!--
PURPOSE: Raw, validated discoveries — the *evidence*. Only promote findings here once
they are verified, and always attach evidence (file/line, command output, source URL)
and the impact. Distinct from memory.md (sticky conclusions) and progress.md (session log).
Lives in planning/findings.md; auto-injected into every agent run by serve.py.
-->

# Findings

## Discoveries
- `frontend/js/chat/olivia-pdf-export.js` already existed with a complete branded PDF export implementation
  - Uses iframe + `window.print()` (browser native "Save as PDF" dialog)
  - Brand kit: Fraunces (display), Plus Jakarta Sans (body), JetBrains Mono (labels)
  - Color palette: cream (#faf9f6), forest dark (#1c4532), forest mid (#2d785a), amber (#c4622d)
  - SVG olive-branch logomark matching sidebar/favicon
  - Evidence: file exists at `frontend/js/chat/olivia-pdf-export.js` (297 lines, complete)
- The function was NOT wired in — no `<script>` tag loading the file, no `window` exposure
- PDF download button already existed at `index.html:2090`: `<button class="tbtn" data-tip="Download as PDF" onclick="downloadLastResponseAsPdf()">`
- Dependencies: `_lastAssistantMessage()` (stream.js:3688) and `addSystemBubble()` (stream.js:1224, exposed at 4113) were both already available
- Server-side approach (Puppeteer/Chromium) is NOT needed for this use case — client-side approach preserves exact rendered HTML

## Technical Decisions
- Client-side iframe + `window.print()` approach chosen (existing implementation)
  - Rationale: Preserves exact rendered HTML structure, no server dependency, works offline
  - Trade-off: Requires browser's native print dialog (not a one-click download)
- `downloadLastResponseAsPdf()` exposed on `window` for inline onclick handler
- `OLIVIA_PDF_BRAND` also exposed on `window` for potential reuse in other export surfaces

## Evidence & References
- `frontend/js/chat/olivia-pdf-export.js` — full implementation
- `frontend/index.html:2090-2091` — PDF button
- `frontend/js/chat/stream.js:3688-3714` — `_lastAssistantMessage()` definition
- `frontend/js/chat/stream.js:4113` — `window.addSystemBubble` exposure