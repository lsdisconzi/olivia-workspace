#!/usr/bin/env python3
"""
Qdrant Uploads Indexer — Tiers 2 & 3

Indexes files under uploads/ into Qdrant for semantic search, complementing
the existing project-index.json / config/index-project/ (Tier 1 — Olivia dev code).

Usage:
    # Tier 2 — Global uploads index (all files under uploads/)
    python3 scripts/index_uploads_to_qdrant.py --global

    # Tier 3 — Per-project index
    python3 scripts/index_uploads_to_qdrant.py --project achilleas

    # List existing Qdrant collections
    python3 scripts/index_uploads_to_qdrant.py --list

    # Combine: global + specific project
    python3 scripts/index_uploads_to_qdrant.py --global --project achilleas --project prima-volta
"""

import argparse
import json
import logging
import os
import sys
import urllib.parse
import urllib.request
import urllib.error
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
log = logging.getLogger(__name__)

# ── Defaults ──────────────────────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
UPLOADS_DIR = PROJECT_ROOT / "uploads"
PROJECTS_DIR = UPLOADS_DIR / "projects"

# The garage ingestion / Qdrant API backend
INGESTION_BASE = os.environ.get("INGESTION_BASE_URL", "http://127.0.0.1:8066")

# Supported text file types for ingestion
TEXT_EXTS = {
    ".md", ".txt", ".json", ".csv", ".yaml", ".yml", ".toml",
    ".py", ".js", ".ts", ".html", ".css", ".sh", ".xml", ".rst",
    ".cfg", ".ini", ".log", ".sql",
}
# PDF and other binary types supported by the ingestion service
BINARY_EXTS = {".pdf"}

INGESTION_SUPPORTED_EXTS = TEXT_EXTS | BINARY_EXTS

# ── HTTP helpers ──────────────────────────────────────────────────────────────


def _api_post(path: str, params: dict | None = None, body: dict | None = None) -> dict:
    """POST to the ingestion API and return parsed JSON."""
    url = f"{INGESTION_BASE}{path}"
    if params:
        qs = "&".join(f"{k}={urllib.parse.quote(str(v))}" for k, v in params.items() if v is not None)
        url = f"{url}?{qs}"
    data = json.dumps(body).encode("utf-8") if body else None
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body_text = e.read().decode("utf-8", errors="replace")
        log.error(f"HTTP {e.code} from {url}: {body_text[:500]}")
        raise
    except Exception as e:
        log.error(f"Request to {url} failed: {e}")
        raise


def _api_get(path: str) -> dict:
    """GET the ingestion API and return parsed JSON."""
    url = f"{INGESTION_BASE}{path}"
    req = urllib.request.Request(url, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body_text = e.read().decode("utf-8", errors="replace")
        log.error(f"HTTP {e.code} from {url}: {body_text[:500]}")
        raise
    except Exception as e:
        log.error(f"Request to {url} failed: {e}")
        raise


# ── Collection management ─────────────────────────────────────────────────────


def list_collections() -> list[str]:
    """Return list of collection names in Qdrant."""
    try:
        data = _api_get("/v1/qdrant/collections")
        # Response may be {"collections": [...]} or similar
        if isinstance(data, dict):
            for key in ("collections", "collection_names", "data", "result"):
                val = data.get(key)
                if isinstance(val, list):
                    return [str(c) if not isinstance(c, str) else c for c in val]
            # fallback: return keys if dict of objects
            for key in data:
                return list(data.keys())
        return []
    except Exception as e:
        log.warning(f"Could not list collections: {e}")
        return []


def collection_exists(name: str) -> bool:
    return name in list_collections()


# ── Tier 2: Global uploads index ──────────────────────────────────────────────


def index_global() -> int:
    """Ingest ALL files under uploads/ into the 'uploads-global' Qdrant collection.

    Returns the number of projects/subdirs ingested, or 0 on skip.
    """
    if not PROJECTS_DIR.is_dir():
        log.warning("uploads/projects/ not found — nothing to index globally.")
        return 0

    collection = "uploads-global"
    log.info(f"[Tier 2] Indexing all uploads into Qdrant collection '{collection}'...")

    # ingest_directory handles the whole directory
    try:
        result = _api_post("/v1/ingestion/ingest-directory", params={
            "directory_path": str(UPLOADS_DIR),
            "collection_name": collection,
            "force_recreate": True,
        })
        log.info(f"[Tier 2] ingest-directory result: {json.dumps(result)[:300]}")
        return 1
    except Exception as e:
        log.warning(f"[Tier 2] ingest-directory failed for {UPLOADS_DIR}: {e}")
        log.info("[Tier 2] Falling back to per-project ingest...")

        # Fallback: ingest each project directory individually
        count = 0
        for pdir in sorted(PROJECTS_DIR.iterdir()):
            if not pdir.is_dir() or pdir.name.startswith("."):
                continue
            if not list(pdir.rglob("*")):
                continue
            try:
                log.info(f"  ingesting project {pdir.name} into '{collection}'...")
                _api_post("/v1/ingestion/ingest-directory", params={
                    "directory_path": str(pdir),
                    "collection_name": collection,
                    "force_recreate": False,  # append to existing
                })
                count += 1
            except Exception as e2:
                log.warning(f"  failed {pdir.name}: {e2}")
        log.info(f"[Tier 2] {count} project(s) ingested into '{collection}'.")
        return count


# ── Tier 3: Per-project index ────────────────────────────────────────────────


def index_project(project_id: str) -> int:
    """Ingest a single project directory into a dedicated Qdrant collection.

    Collection name: 'project-<pid>'
    Returns 1 on success, 0 on skip/failure.
    """
    safe_pid = project_id.replace("/", "_").replace("\\", "_").replace(" ", "_")
    collection = f"project-{safe_pid}"

    pid_path = PROJECTS_DIR / project_id
    if not pid_path.is_dir():
        log.error(f"[Tier 3] Project directory not found: {pid_path}")
        return 0

    files = list(pid_path.rglob("*"))
    file_count = sum(1 for f in files if f.is_file() and f.suffix.lower() in INGESTION_SUPPORTED_EXTS)
    if file_count == 0:
        log.info(f"[Tier 3] {project_id}: no ingestible files found, skipping.")
        return 0

    log.info(f"[Tier 3] Indexing {project_id} ({file_count} files) into collection '{collection}'...")

    # Try embed-case-directory first (creates collection + ingests in one call)
    try:
        result = _api_post("/v1/qdrant/embed-case-directory", body={
            "case_directory": str(pid_path),
            "collection_name": collection,
            "embedding_dim": 384,
        })
        log.info(f"[Tier 3] {project_id}: embed-case-directory result: {json.dumps(result)[:200]}")
        return 1
    except Exception as e:
        log.warning(f"[Tier 3] embed-case-directory failed for {project_id}: {e}")

    # Fallback: use ingest-directory with per-collection
    try:
        result = _api_post("/v1/ingestion/ingest-directory", params={
            "directory_path": str(pid_path),
            "collection_name": collection,
            "force_recreate": True,
        })
        log.info(f"[Tier 3] {project_id}: ingest-directory result: {json.dumps(result)[:200]}")
        return 1
    except Exception as e2:
        log.error(f"[Tier 3] {project_id}: all ingestion methods failed: {e2}")
        return 0


# ── CLI ───────────────────────────────────────────────────────────────────────


def main():
    parser = argparse.ArgumentParser(
        description="Index uploads/ files into Qdrant collections for semantic search.\n\n"
                    "Tier 2 (--global): all uploads/ files → 'uploads-global' collection\n"
                    "Tier 3 (--project): per-project files → 'project-<pid>' collections"
    )
    parser.add_argument(
        "--global", "-g", action="store_true", dest="do_global",
        help="Index ALL uploads into 'uploads-global' collection (Tier 2)",
    )
    parser.add_argument(
        "--project", "-p", action="append", default=[], dest="projects",
        help="Index a specific project by ID (Tier 3). Repeatable for multiple projects.",
    )
    parser.add_argument(
        "--list", "-l", action="store_true",
        help="List existing Qdrant collections and exit",
    )
    parser.add_argument(
        "--all-projects", action="store_true",
        help="Index ALL non-empty projects into their own collections",
    )

    args = parser.parse_args()

    if args.list:
        cols = list_collections()
        if cols:
            print("Qdrant collections:")
            for c in cols:
                print(f"  {c}")
        else:
            print("No Qdrant collections found (or API unreachable).")
        return

    if not (args.do_global or args.projects or args.all_projects):
        parser.print_help()
        print("\nNo action specified. Use --global, --project <id>, or --all-projects.")
        sys.exit(1)

    success = 0
    total_ops = 0

    if args.do_global:
        total_ops += 1
        success += 1 if index_global() > 0 else 0

    if args.all_projects:
        if not PROJECTS_DIR.is_dir():
            log.error("uploads/projects/ not found.")
            sys.exit(1)
        all_pids = sorted(
            d.name for d in PROJECTS_DIR.iterdir()
            if d.is_dir()
            and not d.name.startswith(".")
            and any(f.is_file() and f.suffix.lower() in INGESTION_SUPPORTED_EXTS for f in d.rglob("*"))
        )
        log.info(f"Found {len(all_pids)} non-empty project(s) for indexing.")
        total_ops += len(all_pids)
        for pid in all_pids:
            success += index_project(pid)

    for pid in args.projects:
        total_ops += 1
        success += index_project(pid)

    log.info(f"Done. {success}/{total_ops} index operations completed.")
    sys.exit(0 if success == total_ops else 1)


if __name__ == "__main__":
    main()
