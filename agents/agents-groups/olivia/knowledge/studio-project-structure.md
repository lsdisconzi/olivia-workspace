# Studio Project Structure Knowledge Base

This document defines the best practices, conventions, and patterns for front‑end projects stored in the Olivia **Studio sandbox** (`<project>/studio_files/`). It is the primary reference for the Olivia Studio UI agent when reviewing, restructuring, or improving imported front‑end code.

---

## 1. The Sandbox Environment

- The sandbox lives inside an active project at `studio_files/`.
- All files uploaded via drag‑and‑drop, zip import, or manual import are placed (and persisted) there.
- The Studio **editor** shows one HTML page at a time; the **preview iframe** inlines all local resources automatically.
- External files (CSS, JS, images, fonts) referenced by the current HTML page are resolved **relative to that page’s location**.
- The sandbox is isolated – the agent must never modify files outside `studio_files/`.

---

## 2. Recommended Project Structure

A well‑organised front‑end project follows a **separation of concerns**. The exact layout depends on project size, but the following is a strong default for most single‑page or small multi‑page projects.

```
studio_files/
├── index.html                 # Main entry point (or main page)
├── pages/                     # Additional HTML pages (if more than one)
│   ├── about.html
│   └── contact.html
├── css/
│   ├── main.css               # Global styles
│   ├── components/            # Component‑specific styles (optional)
│   └── themes/                # Theme variations (optional)
├── js/
│   ├── app.js                 # Main application logic
│   ├── lib/                   # Third‑party libraries (jQuery, etc.)
│   └── components/            # Component‑specific scripts (optional)
├── assets/
│   ├── images/                # All image files (png, jpg, svg, webp, etc.)
│   ├── fonts/                 # Self‑hosted font files (.woff2, .ttf, etc.)
│   └── icons/                 # Icon sets, favicons
└── (other)                    # Any configuration files needed by the UI
```

**Key principles:**
- Never dump all files in the root – always organise into folders.
- HTML pages should be at the root or inside `pages/`.
- CSS and JS files must be in their own directories, never inside the root.
- All binaries (images, fonts) belong in `assets/`.

---

## 3. Separation of Concerns

### HTML
- Keep HTML **semantic** and **minimal**.
- No inline styles (`style="…"`). Use CSS classes.
- No inline scripts (`onclick="…"`). Attach event listeners in JS files.
- Use `<link>` for stylesheets and `<script>` for JavaScript (with `defer` or `async` when appropriate).
- Language attributes (`lang="en"`) should be set on `<html>`.

### CSS
- One **global stylesheet** (`css/main.css`) for common rules (layout, typography, colors).
- Optional **component‑specific stylesheets** (`css/components/card.css`) for isolated components – but prefer a single global file unless the project is large.
- Follow a consistent naming convention (BEM, utility‑first, etc.).
- Use **relative paths** in `url()` for background images, fonts, etc.

### JavaScript
- Keep all JS in external `.js` files.
- One **main script** (`js/app.js`) that initialises the app.
- Use **strict mode** (`'use strict'`) and avoid global variables.
- If using libraries, place them in `js/lib/` and load them before the main script.

---

## 4. File Naming Conventions

- **Lowercase with hyphens** for all file and folder names: `main.css`, `hero-banner.js`, `about-us.html`.
- No spaces, no special characters except `-`, `_`, and `.`.
- Extension should always be lowercase (`.html`, `.css`, `.js`, `.png`, `.svg`).
- Backup or temporary files (`*.bkup`, `*.nkp`, `*~`) **must never be committed to the sandbox**.

---

## 5. Handling Common File Types

### Images
- Use appropriate formats: SVG for icons/illustrations, WebP for photos, PNG for transparency, JPEG for photos when WebP is not supported.
- Provide `alt` text for all `<img>` elements.
- Use `srcset` for responsive images where needed.
- Always place images in `assets/images/`.

### Fonts
- Self‑hosted fonts go in `assets/fonts/`.
- Use `@font-face` in CSS with relative paths.
- Provide multiple formats (`woff2`, `woff`) for browser compatibility.

### Third‑party Libraries
- Download and store them in `js/lib/` or `css/lib/` if they must be offline.
- Avoid CDN links when a local copy is available; the Studio preview blocks external network requests by default, so CDN‑referenced libraries won’t load in the preview.

### Markdown, Docs, PDFs
- These do **not** belong in the front‑end sandbox. They should be moved to the project’s `uploads/` or other sections.

---

## 6. Relative Paths and Linking

Since the preview inlines resources relative to the **current HTML page’s location**, relative paths must be correct.

- From an HTML file in the root (`index.html`) linking to `css/main.css` → `href="css/main.css"`.
- From an HTML file in `pages/` linking to the same CSS → `href="../css/main.css"`.
- Inside a CSS file (`css/main.css`) referencing `assets/images/logo.png` → `url("../assets/images/logo.png")`.

The agent must always verify that all `<link>`, `<script src>`, and `url()` references are correct for the page they belong to.

---

## 7. Common Anti‑Patterns to Detect and Fix

| Anti‑Pattern | Why it’s bad | Remediation |
|--------------|--------------|-------------|
| **Huge inline `<style>` block in HTML** | Mixes concerns, hard to maintain. | Extract to a separate CSS file and link it. |
| **Inline `<script>` in HTML** | Blocks parsing, hinders caching. | Move to external `.js` file, use `<script src="...">` with `defer`. |
| **CSS/JS files in root** | Messy root, no organisation. | Move to appropriate folders, update paths. |
| **Multiple near‑duplicate pages** (e.g., `index.html`, `index-en.html`, `index-el.html`) | Maintenance overhead, inconsistency. | If only language differs, consider simple i18n or separate folder per locale. |
| **Unused backup files** (`*.bkup`, `*.nkp`) | Clutter, risk of confusion. | Delete them. |
| **CDN links for libraries** | Won’t work in preview (offline). | Download and store locally, link locally. |
| **Absolute paths** (e.g., `/css/main.css`) | Broken in sandbox. | Convert to relative paths. |
| **Non‑front‑end files** (`.md`, `.pdf`, `.docx`) | Not part of the UI. | Move out of sandbox. |

---

## 8. Preview Inlining Behavior

The Studio preview iframe is built by a function that:

1. **Inlines all resolvable local CSS** – any `<link rel="stylesheet" href="...">` pointing to a file in the sandbox is replaced by a `<style>` block containing the file content.
2. **Inlines all resolvable local JS** – any `<script src="...">` is replaced by an inline `<script>`.
3. **Leaves external (http/https) resources untouched** – but they will not load because the preview blocks network requests.
4. **Keeps original tags if the file is not found** – no error, just the tag remains as‑is.

**Implication for the agent:** You can link to any file inside the sandbox, and the preview will work correctly. Use this to split monolithic files without breaking the live view.

---

## 9. Best Practices for Maintainability

- **Keep the root clean** – only the main entry point(s) and well‑known configuration files (e.g., `manifest.json`) should be at the root.
- **Use a single global CSS file** unless the project is truly large; component‑specific styles can be added via separate files if needed, but document the convention.
- **Group JS by feature** rather than by type (e.g., `js/components/carousel.js`, `js/utils/api.js`).
- **Comment sections** in CSS and JS with clear headings.
- **Version your main CSS/JS files** only if required – avoid `main_v2.css`; use Git or other version control outside the sandbox.
- **Consistent indentation** (2 spaces or tabs, but stay consistent).

---

## 10. Agent Review Checklist

When a front‑end folder is imported, the agent should (in conversation with the user):

1. **List all files** and present a summary.
2. **Identify anti‑patterns** from the table above.
3. **Propose a target structure** that matches the recommended layout.
4. **Generate a step‑by‑step plan**:
   - Which inline blocks to extract.
   - Where to create new files (and with what content).
   - Which `<link>` / `<script>` tags to add.
   - Any files to delete or move.
5. **Ask for confirmation**, then execute edits using the Studio’s edit format (for changes to the currently loaded HTML).
6. **Instruct the user to manually create** new files in the “Arquivos” modal if needed, and paste the content.

The agent should always **explain why** each change improves maintainability or performance.

---

This knowledge base is maintained as part of the Olivia agent ecosystem and should be updated as new patterns emerge or the Studio capabilities evolve.
