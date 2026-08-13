Now we need the **backend** that serves the `api/procurement/*` endpoints, mirroring the Health API but adapted for supplier invoices.

Below is the complete procurement backend code that you can integrate alongside your existing health handler. It reuses the same OCR pipeline script (`health_images_to_report.py`) because it’s already generic, but stores everything under a `procurement/` folder per project.

---

## `procurement_api.py` (to be added to your server)

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

# ── Procurement store helpers ────────────────────────────────────────────
PROCUREMENT_STORE_FILE = "procurement_store.json"

def _procurement_store_path(project_id: str) -> Path:
    """Return the path to the procurement store for a given project."""
    if not project_id:
        raise ValueError("project_id required")
    return PROJECTS_DIR / project_id / "procurement" / PROCUREMENT_STORE_FILE

def _procurement_store_load(project_id: str) -> dict:
    path = _procurement_store_path(project_id)
    if path.is_file():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            pass
    return {
        "documents": [],
        "timeline": [],
        "last_results": None,
        "last_workspace": None,
    }

def _procurement_store_save(store: dict, project_id: str) -> None:
    path = _procurement_store_path(project_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(store, ensure_ascii=False, indent=2), encoding="utf-8")

def _procurement_normalize_filename(filename: str) -> str:
    """Strip UUID-like suffixes and extensions so dedup works."""
    stem = Path(filename).stem
    # Remove trailing hex fragment like -0a3b2f
    stem = re.sub(r'-[0-9a-f]{6,}$', '', stem)
    return stem.lower()

def _procurement_file_kind(image_path: Path) -> str:
    """Return 'pdf', 'image', or 'none' for UI preview."""
    ext = image_path.suffix.lower()
    if ext == '.pdf':
        return 'pdf'
    if ext in ('.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tiff', '.tif'):
        return 'image'
    return 'none'

def _procurement_file_mime(image_path: Path) -> str:
    """Quick MIME mapping."""
    ext = image_path.suffix.lower()
    mime_map = {
        '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
        '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp',
        '.pdf': 'application/pdf',
    }
    return mime_map.get(ext, 'application/octet-stream')

def _procurement_resolve_image_file(project_id: str, filename: str) -> Path | None:
    """Look for a file named `filename` inside the project's procurement images/ directory.
    Handles the case where a deduped suffix was added (e.g., -abc123)."""
    dirs = [
        PROJECTS_DIR / project_id / "procurement" / "images",
        PROJECTS_DIR / project_id / "procurement" / "workspace" / "image_processing_workspace" / "extractions",
        # also check the base images folder in the main project (if invoice images are stored there)
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

def _procurement_pipeline_python() -> str:
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

def _procurement_pdf_to_images(pdf_path: Path, output_dir: Path) -> None:
    """Convert PDF pages to JPEGs using pdftoppm."""
    import subprocess
    base = pdf_path.stem
    subprocess.run(
        ["pdftoppm", "-jpeg", "-r", "200", str(pdf_path), str(output_dir / base)],
        capture_output=True, check=False,
    )

# ── API handlers for procurement ─────────────────────────────────────────
def _procurement_api_get(self, path: str):
    qs = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
    project_id = (qs.get("project_id") or [""])[0].strip() or None
    store = _procurement_store_load(project_id) if project_id else {"documents": [], "timeline": [], "last_results": None}

    # --- Status / overview stats ---
    if path == "/api/procurement/status":
        # we might not have condition/medication for procurement; adapt to what we track
        total_invoices = len(store.get("documents", []))
        # For supplier count and total value, we'd need extracted data.
        # For now, compute from documents if we stored extracted fields.
        # This is a stub; in a real implementation you'd parse extracted data.
        supplier_count = 0
        total_value = "0"
        # TODO: iterate over extracted analysis to compute actual stats
        self._json_response({
            "invoice_count": total_invoices,
            "supplier_count": supplier_count,
            "total_value": total_value,
            "project_id": project_id,
        })
        return

    # --- Timeline ---
    if path == "/api/procurement/timeline":
        self._json_response({"events": store.get("timeline", [])})
        return

    # --- Last pipeline results (summary) ---
    if path == "/api/procurement/results":
        summary = store.get("last_results") or {"file_statistics": {"total_images": 0, "successful_ocr": 0}}
        workspace = None
        if project_id:
            pdir = PROJECTS_DIR / project_id / "procurement"
            if pdir.is_dir():
                workspace = str(pdir / "workspace" / "image_processing_workspace")
        self._json_response({
            "status": "completed" if store.get("last_results") else "none",
            "summary": summary,
            "workspace": workspace,
        })
        return

    # --- Knowledge base / document list ---
    if path == "/api/procurement/knowledge-base":
        docs = []
        for doc in store.get("documents", []):
            text = str(doc.get("text") or "")
            docs.append({
                "id": doc.get("id"),
                "filename": doc.get("filename"),
                "uploaded_at": doc.get("uploaded_at"),
                "status": doc.get("status", "unknown"),
                "ocr_success": bool(doc.get("ocr_success")),
                "text_length": len(text),
                "preview": text[:500],
            })
        self._json_response({"documents": docs})
        return

    # --- Outputs (visualization data) ---
    if path == "/api/procurement/outputs":
        data = {}
        if project_id:
            out_file = PROJECTS_DIR / project_id / "outputs" / "procurement-visualization.json"
            if out_file.is_file():
                try:
                    data = json.loads(out_file.read_text(encoding="utf-8"))
                except (OSError, ValueError):
                    data = {"error": "Could not parse visualization data"}
        self._json_response(data)
        return

    # --- Report (Markdown) ---
    if path == "/api/procurement/report":
        report = ""
        if project_id:
            report_file = PROJECTS_DIR / project_id / "outputs" / "procurement-report.md"
            if report_file.is_file():
                try:
                    report = report_file.read_text(encoding="utf-8")
                except OSError:
                    report = ""
        self._json_response({"report": report})
        return

    # --- Documents with image URLs (for the Invoices grid) ---
    if path == "/api/procurement/documents-detail":
        docs = []
        for doc in store.get("documents", []):
            text = str(doc.get("text") or "")
            fname = doc.get("filename", "")
            kind = "none"
            if project_id and fname:
                resolved = _procurement_resolve_image_file(project_id, fname)
                if resolved is not None:
                    kind = _procurement_file_kind(resolved)
            entry = {
                "id": doc.get("id"),
                "filename": fname,
                "uploaded_at": doc.get("uploaded_at"),
                "status": doc.get("status", "unknown"),
                "ocr_success": bool(doc.get("ocr_success")),
                "text": text,
                "kind": kind,
                "image_url": None,
            }
            if project_id and fname:
                entry["image_url"] = (
                    "/api/procurement/image?project_id="
                    + urllib.parse.quote(project_id)
                    + "&file="
                    + urllib.parse.quote(fname)
                )
            docs.append(entry)
        self._json_response({"documents": docs})
        return

    # --- Serve a single invoice image/PDF ---
    if path == "/api/procurement/image":
        fname = (qs.get("file") or [""])[0].strip()
        if not fname or not project_id:
            self._json_response({"error": "Missing file or project_id"}, 400)
            return
        image_path = _procurement_resolve_image_file(project_id, fname)
        if image_path is None:
            self._json_response({"error": "Image not found"}, 404)
            return
        content_type = _procurement_file_mime(image_path)
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

def _procurement_api_post(self, path: str):
    if path == "/api/procurement/upload":
        self._procurement_upload_post()
        return
    if path == "/api/procurement/run":
        self._procurement_run_post()
        return
    if path == "/api/procurement/assistant/chat":
        # Reuse the existing assistant chat endpoint but with procurement context.
        # You might adjust the system prompt based on section_key = "procurement".
        # For now, forward to the generic assistant handler.
        self._assistant_chat()
        return
    self._json_response({"error": "Not found"}, 404)

def _procurement_upload_post(self):
    """Handle multipart upload of invoice images/PDFs."""
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

    upload_id = f"pr-{int(time.time() * 1000)}-{uuid.uuid4().hex[:8]}"
    pdir = (PROJECTS_DIR / str(project_id).strip("/")) if project_id else None
    if pdir and pdir.is_dir():
        upload_dir = pdir / "procurement" / "images"
    else:
        upload_dir = PROJECT_ROOT / "uploads" / "procurement" / upload_id
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

    print(f"[Procurement] upload {upload_id}: {len(files)} file(s) -> {upload_dir}", flush=True)
    self._json_response({"upload_id": upload_id, "files": [f[0] for f in files], "project_id": project_id or None})

def _procurement_run_post(self):
    """Launch the OCR pipeline on uploaded invoice files."""
    body = self._read_body()
    upload_id = str(body.get("upload_id") or "").strip()
    project_id = str(body.get("project_id") or "").strip()
    if not (project_id and (PROJECTS_DIR / project_id).is_dir()):
        self._json_response({"error": "A valid project is required to run the pipeline"}, 400)
        return

    pdir = PROJECTS_DIR / project_id
    proc_dir = pdir / "procurement"
    images_dir = proc_dir / "images"
    images_dir.mkdir(parents=True, exist_ok=True)

    # Reuse the same generic pipeline script (or a procurement-specific one).
    # We'll copy the health script to the project's scripts folder as well,
    # but can run it directly from the source.
    pipeline_script = PROJECT_ROOT / "scripts" / "health_images_to_report.py"
    if not pipeline_script.is_file():
        self._json_response({"error": "health_images_to_report.py not found in scripts/"}, 500)
        return

    # Rasterise any PDFs so the script sees images
    if shutil.which("pdftoppm"):
        for f in sorted(images_dir.iterdir()):
            if f.suffix.lower() != ".pdf" or not f.is_file():
                continue
            _procurement_pdf_to_images(f, images_dir)

    output_root = proc_dir / "workspace"
    cmd = [
        _procurement_pipeline_python(), str(pipeline_script),
        "--input", str(images_dir),
        "--output", str(output_root),
    ]
    if body.get("llm_provider"):
        cmd += ["--llm-provider", str(body["llm_provider"])]

    print(f"[Procurement] running pipeline: {' '.join(cmd)}", flush=True)
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
        print(f"[Procurement] pipeline failed (rc={proc.returncode}): {tail}", flush=True)
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

    # Update procurement store with new documents
    store = _procurement_store_load(project_id)
    now_iso = datetime.now().isoformat(timespec="seconds")
    today = datetime.now().strftime("%Y-%m-%d")
    documents = list(store.get("documents", []))
    docs_by_stem = {}
    new_docs_seen = set()

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
            ok = not extr.get("error") and bool(text.strip())
            if ok:
                successful_ocr += 1
            filename = extr.get("filename") or xf.name[:-len("_extraction.json")]
            stem = _procurement_normalize_filename(filename)

            doc = {
                "id": f"{project_id}-{stem}-{int(time.time() * 1000)}",
                "filename": filename,
                "uploaded_at": now_iso,
                "upload_id": upload_id or None,
                "project_id": project_id,
                "status": "processed" if ok else "failed",
                "ocr_success": ok,
                "text": text[:20000],
            }
            if stem in docs_by_stem:
                documents[docs_by_stem[stem]] = doc
            else:
                docs_by_stem[stem] = len(documents)
                documents.append(doc)

            preview = " ".join(text.split())[:120]
            description = f"Invoice processed: {filename}"
            if preview:
                description += f" — {preview}"
            if stem not in new_docs_seen:
                new_docs_seen.add(stem)
                store.setdefault("timeline", []).append({"date": today, "description": description})

    store["documents"] = documents
    store["last_results"] = summary
    store["last_workspace"] = str(output_root)
    _procurement_store_save(store, project_id)

    print(f"[Procurement] run for project {project_id}: {total_files} file(s), {successful_ocr} OCR ok", flush=True)
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
   Inside your `KoutHandler` (or similar), call these methods when the path starts with `/api/procurement/`:
   ```python
   if self.path.startswith("/api/procurement/"):
       if self.command == "GET":
           return _procurement_api_get(self, self.path)
       elif self.command == "POST":
           return _procurement_api_post(self, self.path)
   ```

2. **Pipeline script**  
   The code reuses `health_images_to_report.py` – it’s generic and will work with invoice images. If you want a dedicated copy, rename it to `procurement_invoice_processing.py` and adjust the path.

3. **Store**  
   Each project now has a `procurement/` folder with its own `procurement_store.json`, separate from health.

4. **Visualization data & reports**  
   The endpoints expect the pipeline to produce `outputs/procurement-visualization.json` and `outputs/procurement-report.md` (or you can change the code to read from the pipeline’s workspace). Adjust accordingly.

5. **Assistant chat**  
   The procurement assistant uses the same SSE endpoint but with a different `section_key`. Make sure your assistant handler recognises `section_key: "procurement"` and injects the procurement-specific system prompt (the one we defined in `procurement.js`).

Now your Olivia workspace has a fully functional **Procurement** module that mirrors the Health pipeline, but focused on supplier invoices.