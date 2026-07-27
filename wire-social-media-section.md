I've extracted and refactored the Social Media Assistant page into a standalone, Olivia‑workspace‑style section following the same architecture as the existing **Craudio** module. You get two files:

- **`social-media.css`** — all styles, using the workspace’s native design tokens (`--bg`, `--amber`, `--border`, etc.).
- **`social-media.js`** — the full application logic (profiles, PDF extraction, chat with DeepSeek, content generation) with `ShowView`/`HideView` lifecycle functions, sibling‑view wrapping, and no global namespace pollution.

---

## `social-media.css`
`frontend/css/social-media.css`
---

## `social-media.js`
`frontend/js/modules/social-media.js`
---

### Integration notes

1. **HTML container** – Add a `<div id="socialMediaView" class="social-media-view"></div>` inside the main workspace container (alongside the `craudioView` div).
2. **Include the files** – Load `social-media.css` and `social-media.js` after the workspace core.
3. **Trigger button** – Create a menu item or button that calls `socialMediaShowView()`, e.g.  
   `<button onclick="socialMediaShowView()"><i class="fas fa-share-nodes"></i> Social Media</button>`
4. **DeepSeek endpoint** – The chat uses `/api/deepseek/v1/chat/completions`. Adjust the URL if your backend proxy differs.
5. **PDF.js** – The original page includes `pdf.js` from CDN. Ensure that library is available globally (e.g., via the workspace’s script includes).

The module reuses the workspace’s design tokens, respects the multi‑view lifecycle (auto‑closes when another section opens), and keeps all state in `localStorage`. It’s now ready to sit alongside **Craudio** as a first‑class Olivia workspace section.