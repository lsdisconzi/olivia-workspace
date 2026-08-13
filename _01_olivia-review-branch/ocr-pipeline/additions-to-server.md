Here are the server-side additions for the generic OCR pipeline, following the same pattern as the procurement module but adapted to the `/api/ocr/` endpoints.

```python
import json
import os
import re
import shutil
import subprocess
import time
import uuid
import urllib.parse
from datetime import datetime
from pathlib import Path

from .project_storage import PROJECTS_DIR, PROJECT_ROOT   # adjust import as needed

# ── OCR store helpers ─────────────────────────────────────────────────────
OCR_STORE_FILE = "ocr_store.json"

def _ocr_store_path(project_id: str) -> Path:
    """Return the path to the OCR store for a given project."""
    if not project_id:
        raise ValueError("project_id required")
    return PROJECTS_DIR / project_id / "ocr" / OCR_STORE_FILE

def _ocr_store_load(project_id: str) -> dict:
    path = _ocr_store_path(project_id)
    if path.is_file():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            pass
    return {
        "documents": [],
        "last_results": None,
        "last_workspace": None,
    }

def _ocr_store_save(store: dict, project_id: str) -> None:
    path = _ocr_store_path(project_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(store, ensure_ascii=False, indent=2), encoding="utf-8")

def _ocr_normalize_filename(filename: str) -> str:
    """Strip UUID-like suffixes and extensions so dedup works."""
    stem = Path(filename).stem
    # Remove trailing hex fragment like -0a3b2f
    stem = re.sub(r'-[0-9a-f]{6,}$', '', stem)
    return stem.lower()

def _ocr_file_kind(image_path: Path) -> str:
    """Return 'pdf', 'image', or 'none' for UI preview."""
    ext = image_path.suffix.lower()
    if ext == '.pdf':
        return 'pdf'
    if ext in ('.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tiff', '.tif'):
        return 'image'
    return 'none'

def _ocr_file_mime(image_path: Path) -> str:
    """Quick MIME mapping."""
    ext = image_path.suffix.lower()
    mime_map = {
        '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
        '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp',
        '.pdf': 'application/pdf',
    }
    return mime_map.get(ext, 'application/octet-stream')

def _ocr_resolve_image_file(project_id: str, filename: str) -> Path | None:
    """Look for a file named `filename` inside the project's OCR directories.
    Handles the case where a deduped suffix was added (e.g., -abc123)."""
    dirs = [
        PROJECTS_DIR / project_id / "ocr" / "images",
        PROJECTS_DIR / project_id / "ocr" / "workspace" / "image_processing_workspace" / "extractions",
        # also check the base images folder in the main project (if original files are stored there)
        PROJECTS_DIR / project_id / "images",
    ]
    filename = Path(filename).name
    for d in dirs:
        if not d.is_dir():
            continue
        # exact match first
        exact = d / filename
        if exact.is_file():
            return exact
        # fuzzy: match with or without extra suffix
        stem = Path(filename).stem
        ext = Path(filename).suffix
        for f in d.iterdir():
            if f.is_file() and f.stem.startswith(stem) and f.suffix == ext:
                return f
    return None

def _ocr_pipeline_python() -> str:
    """Return the python executable to use (respecting venv)."""
    possible = [
        PROJECT_ROOT / ".venv" / "bin" / "python3",
        PROJECT_ROOT / ".venv" / "bin" / "python",
        Path("/usr/bin/python3"),
    ]
    for p in possible:
        if p.is_file():
            return str(p)
    return "python3"

def _ocr_pdf_to_images(pdf_path: Path, output_dir: Path) -> None:
    """Convert PDF pages to JPEGs using pdftoppm."""
    base = pdf_path.stem
    subprocess.run(
        ["pdftoppm", "-jpeg", "-r", "200", str(pdf_path), str(output_dir / base)],
        capture_output=True, check=False,
    )

# ── API handlers for OCR ─────────────────────────────────────────────────
def _ocr_api_get(self, path: str):
    qs = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
    project_id = (qs.get("project_id") or [""])[0].strip() or None
    store = _ocr_store_load(project_id) if project_id else {"documents": [], "last_results": None}

    # --- Status / overview stats ---
    if path == "/api/ocr/status":
        total_docs = len(store.get("documents", []))
        successful_ocr = sum(1 for d in store.get("documents", []) if d.get("ocr_success"))
        markdown_count = sum(1 for d in store.get("documents", []) if d.get("text_md") and str(d["text_md"]).strip())
        self._json_response({
            "document_count": total_docs,
            "successful_ocr": successful_ocr,
            "markdown_count": markdown_count,
            "project_id": project_id,
        })
        return

    # --- Last pipeline results (summary) ---
    if path == "/api/ocr/results":
        summary = store.get("last_results") or {"file_statistics": {"total_files": 0, "successful_ocr": 0}}
        workspace = None
        if project_id:
            pdir = PROJECTS_DIR / project_id / "ocr"
            if pdir.is_dir():
                workspace = str(pdir / "workspace" / "image_processing_workspace")
        self._json_response({
            "status": "completed" if store.get("last_results") else "none",
            "summary": summary,
            "workspace": workspace,
        })
        return

    # --- Documents with image URLs (for the Documents grid) ---
    if path == "/api/ocr/documents":
        docs = []
        for doc in store.get("documents", []):
            text = str(doc.get("text") or "")
            text_md = str(doc.get("text_md") or "")
            fname = doc.get("filename", "")
            kind = "none"
            if project_id and fname:
                resolved = _ocr_resolve_image_file(project_id, fname)
                if resolved is not None:
                    kind = _ocr_file_kind(resolved)
            entry = {
                "id": doc.get("id"),
                "filename": fname,
                "uploaded_at": doc.get("uploaded_at"),
                "status": doc.get("status", "unknown"),
                "ocr_success": bool(doc.get("ocr_success")),
                "text": text,
                "text_md": text_md,
                "kind": kind,
                "image_url": None,
            }
            if project_id and fname:
                entry["image_url"] = (
                    "/api/ocr/image?project_id="
                    + urllib.parse.quote(project_id)
                    + "&file="
                    + urllib.parse.quote(fname)
                )
            docs.append(entry)
        self._json_response({"documents": docs})
        return

    # --- Serve a single document image/PDF ---
    if path == "/api/ocr/image":
        fname = (qs.get("file") or [""])[0].strip()
        if not fname or not project_id:
            self._json_response({"error": "Missing file or project_id"}, 400)
            return
        image_path = _ocr_resolve_image_file(project_id, fname)
        if image_path is None:
            self._json_response({"error": "Image not found"}, 404)
            return
        content_type = _ocr_file_mime(image_path)
        try:
            data = image_path.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "public, max-age=3600")
            self.end_headers()
            self.wfile.write(data)
        except OSError:
            self._json_response({"error": "Could not read image"}, 500)
        return

    self._json_response({"error": "Not found"}, 404)

def _ocr_api_post(self, path: str):
    if path == "/api/ocr/upload":
        self._ocr_upload_post()
        return
    if path == "/api/ocr/run":
        self._ocr_run_post()
        return
    self._json_response({"error": "Not found"}, 404)

def _ocr_upload_post(self):
    """Handle multipart upload of PDF/image files."""
    ctype = self.headers.get("Content-Type", "")
    if "multipart/form-data" not in ctype:
        self._json_response({"error": "Expected multipart/form-data"}, 400)
        return
    clen = int(self.headers.get("Content-Length", 0))
    raw = self.rfile.read(clen)
    try:
        boundary = ctype.split("boundary=", 1)[1].strip()
    except IndexError:
        self._json_response({"error": "Missing multipart boundary"}, 400)
        return
    if boundary.startswith('"') and boundary.endswith('"'):
        boundary = boundary[1:-1]

    b_boundary = ("--" + boundary).encode("utf-8")
    b_end = ("--" + boundary + "--").encode("utf-8")
    parts = raw.split(b_boundary)[1:]
    if parts and b_end in parts[-1]:
        parts[-1] = parts[-1].split(b_end)[0]

    files = []  # (filename, mime, bytes)
    project_id = ""
    for part in parts:
        part = part.lstrip(b"\r\n")
        header_end = part.find(b"\r\n\r\n")
        if header_end < 0:
            continue
        header_block = part[:header_end].decode("utf-8", errors="replace")
        body = part[header_end + 4:]
        if body.endswith(b"\r\n"):
            body = body[:-2]
        if 'name="project_id"' in header_block:
            project_id = body.decode("utf-8", errors="replace").strip()
        elif 'name="files"' in header_block:
            fn_match = re.search(r'filename="([^"]*)"', header_block)
            fname = fn_match.group(1) if fn_match else "upload"
            ct_match = re.search(r"Content-Type:\s*(\S+)", header_block)
            fmime = ct_match.group(1) if ct_match else "application/octet-stream"
            files.append((fname, fmime, body))

    if not files:
        self._json_response({"error": "No files part found in upload"}, 400)
        return

    upload_id = f"ocr-{int(time.time() * 1000)}-{uuid.uuid4().hex[:8]}"
    pdir = (PROJECTS_DIR / str(project_id).strip("/")) if project_id else None
    if pdir and pdir.is_dir():
        upload_dir = pdir / "ocr" / "images"
    else:
        upload_dir = PROJECT_ROOT / "uploads" / "ocr" / upload_id
    try:
        upload_dir.mkdir(parents=True, exist_ok=True)
        for fname, _fmime, fbytes in files:
            safe = Path(fname).name or "upload"
            target = upload_dir / safe
            if target.exists():
                target = upload_dir / f"{target.stem}-{upload_id[-6:]}{target.suffix}"
            target.write_bytes(fbytes)
    except OSError as exc:
        self._json_response({"error": f"Failed to store upload: {exc}"}, 500)
        return

    print(f"[OCR] upload {upload_id}: {len(files)} file(s) -> {upload_dir}", flush=True)
    self._json_response({"upload_id": upload_id, "files": [f[0] for f in files], "project_id": project_id or None})

def _ocr_run_post(self):
    """Launch the OCR pipeline on uploaded files."""
    body = self._read_body()
    upload_id = str(body.get("upload_id") or "").strip()
    project_id = str(body.get("project_id") or "").strip()
    if not (project_id and (PROJECTS_DIR / project_id).is_dir()):
        self._json_response({"error": "A valid project is required to run the pipeline"}, 400)
        return

    pdir = PROJECTS_DIR / project_id
    ocr_dir = pdir / "ocr"
    images_dir = ocr_dir / "images"
    images_dir.mkdir(parents=True, exist_ok=True)

    # Generic OCR pipeline script (must exist in scripts/)
    pipeline_script = PROJECT_ROOT / "scripts" / "generic_ocr_pipeline.py"
    if not pipeline_script.is_file():
        self._json_response({"error": "generic_ocr_pipeline.py not found in scripts/"}, 500)
        return

    # Rasterise any PDFs so the script sees images
    if shutil.which("pdftoppm"):
        for f in sorted(images_dir.iterdir()):
            if f.suffix.lower() != ".pdf" or not f.is_file():
                continue
            _ocr_pdf_to_images(f, images_dir)

    output_root = ocr_dir / "workspace"
    cmd = [
        _ocr_pipeline_python(), str(pipeline_script),
        "--input", str(images_dir),
        "--output", str(output_root),
    ]
    if body.get("llm_provider"):
        cmd += ["--llm-provider", str(body["llm_provider"])]

    print(f"[OCR] running pipeline: {' '.join(cmd)}", flush=True)
    try:
        proc = subprocess.run(
            cmd, capture_output=True, text=True, timeout=3600,
            cwd=str(PROJECT_ROOT),
        )
    except (OSError, subprocess.SubprocessError) as exc:
        self._json_response({"error": f"Pipeline failed to start: {exc}"}, 500)
        return

    if proc.returncode != 0:
        tail = (proc.stderr or proc.stdout or "")[-1200:]
        print(f"[OCR] pipeline failed (rc={proc.returncode}): {tail}", flush=True)
        self._json_response({
            "status": "failed",
            "error": f"Pipeline exited with code {proc.returncode}",
            "log_tail": tail,
        }, 500)
        return

    # Parse summary from pipeline output
    summary = {}
    summary_path = output_root / "image_processing_workspace" / "pipeline_summary.json"
    try:
        summary = json.loads(summary_path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        summary = {}

    # Update OCR store with new documents
    store = _ocr_store_load(project_id)
    now_iso = datetime.now().isoformat(timespec="seconds")
    documents = list(store.get("documents", []))
    docs_by_stem = {}

    extractions_dir = output_root / "image_processing_workspace" / "extractions"
    total_files = 0
    successful_ocr = 0
    if extractions_dir.is_dir():
        for xf in sorted(extractions_dir.glob("*_extraction.json")):
            try:
                extr = json.loads(xf.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                continue
            total_files += 1
            text = " ".join(p.get("text") or "" for p in extr.get("pages", [])) or extr.get("text_summary") or ""
            text_md = extr.get("text_md") or extr.get("markdown") or ""
            ok = not extr.get("error") and bool(text.strip())
            if ok:
                successful_ocr += 1
            filename = extr.get("filename") or xf.name[:-len("_extraction.json")]
            stem = _ocr_normalize_filename(filename)

            doc = {
                "id": f"{project_id}-{stem}-{int(time.time() * 1000)}",
                "filename": filename,
                "uploaded_at": now_iso,
                "upload_id": upload_id or None,
                "project_id": project_id,
                "status": "processed" if ok else "failed",
                "ocr_success": ok,
                "text": text[:20000],
                "text_md": text_md[:50000],  # store Markdown (up to 50k chars)
            }
            if stem in docs_by_stem:
                documents[docs_by_stem[stem]] = doc
            else:
                docs_by_stem[stem] = len(documents)
                documents.append(doc)

    store["documents"] = documents
    store["last_results"] = summary
    store["last_workspace"] = str(output_root)
    _ocr_store_save(store, project_id)

    print(f"[OCR] run for project {project_id}: {total_files} file(s), {successful_ocr} OCR ok", flush=True)
    self._json_response({
        "status": "completed",
        "summary": summary,
        "workspace": str(output_root),
        "file_statistics": {
            "total_files": total_files,
            "total_images": total_files,
            "successful_ocr": successful_ocr,
        },
    })
```

---

## Integration notes

1. **Add to your request router**  
   Inside your HTTP handler, call the OCR methods when the path starts with `/api/ocr/`:

   ```python
   if self.path.startswith("/api/ocr/"):
       if self.command == "GET":
           return _ocr_api_get(self, self.path)
       elif self.command == "POST":
           return _ocr_api_post(self, self.path)
   ```

2. **Generic pipeline script**  
   The code expects a script `generic_ocr_pipeline.py` in the `scripts/` directory. It should accept `--input`, `--output`, and optionally `--llm-provider`. The script must:
   - Read all images from `--input`
   - Perform OCR (using your preferred engine)
   - Generate Markdown output
   - Write per-document extraction JSONs in `output/image_processing_workspace/extractions/`
     with fields: `filename`, `pages` (list of `{text}`), `text_summary`, `text_md`, `error`
   - Write a `pipeline_summary.json` in `output/image_processing_workspace/`

3. **Markdown storage**  
   The `text_md` field is stored in `doc` and served via the frontend for the "Markdown" and "Side-by-Side" tabs.

4. **No timeline needed**  
   The generic OCR frontend doesn't include a timeline panel, so the server omits timeline endpoints. You can easily add them later if needed.

This server code integrates cleanly with the previously provided frontend and completes the OCR pipeline module.