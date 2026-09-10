# LA8159 Overview — Netlify-ready deploy

Static, self-contained site for the LA8159 (Disconzi v. LATAM) Overview page.

## Contents
- `index.html` — the LA8159-Overview page (all narratives + transcript audio player). Uses only the Google Fonts stylesheet from an external CDN; everything else is local.
- `case_files/10-audio/<transcript>_segments_all/audio_segments/*.wav` — the audio segments referenced by the page's Play buttons (all 27 recordings, referenced segments only ≈ 100 MB).

## Deploy to Netlify
1. Go to https://app.netlify.com → **Add new site → Deploy manually**.
2. Drag-and-drop this whole folder (`la8159-overview-netlify`) into the drop zone.
3. Netlify publishes it; the site is served at `https://<your-site>.netlify.app/`.

## Notes
- The page loads audio via absolute `/case_files/10-audio/...` URLs, which resolve to the `case_files/` folder at the site root — so the folder **must be deployed at the site root** (it already is when you drop this folder as-is).
- If you want to preview locally, run a static server from this folder:
  `python3 -m http.server 8080` then open `http://localhost:8080/`
  (Opening `index.html` directly via `file://` will show the page but Play buttons will not find audio, because browsers treat `/case_files/...` as filesystem-root paths.)

## Regenerate
The deploy folder was generated from:
- Page: `_shared/cases/la8159/02-transcripts/transcripts_rendered/compilations/LA8159-Overview.html`
- Audio: `_shared/cases/la8159/10-audio/`
