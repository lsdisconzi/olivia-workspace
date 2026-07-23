#!/usr/bin/env python3
"""
extract_assets.py — Materialize assets declared by scenes into the asset catalog.

CONTRACT
--------
Each scene file (content/scenes/*.scene.json) MAY declare an `assets` array.
Every entry is a FULL asset-definition object that matches the on-disk asset
schema:

    {
      "id":      "owl",            # required, unique, [a-z0-9_]
      "name":    "Wise Owl",       # optional (defaults from id)
      "icon":    "🦉",             # optional
      "category":"character",      # optional
      "tags":    ["forest"],        # optional
      "desc":    "...",            # optional
      "params":  {"x": {"type":"x","default":"w*0.3"}},  # optional
      "code":    "const owlX = ...; svg += `...`;"       # required
    }

The script:
  1. Walks every scene file (object or array-of-objects).
  2. For each declared asset, validates it (needs `id` + `code`).
  3. If assets/<id>.asset.json does NOT exist -> writes it ("extracted").
     If it exists -> leaves it alone and reports a skip (catalog asset wins).
  4. Reconciles assets/manifest.json so it lists every *.asset.json on disk.

Flags:
  --dry-run   Preview what would change; write nothing.
  --force     Overwrite existing asset files with the scene's declaration.
  --no-sync   Do not rewrite manifest.json (only materialize files).
  --quiet     Only print errors and the final summary counts.

Usage:
  python3 scripts/extract_assets.py
  python3 scripts/extract_assets.py --dry-run
"""

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SCENES_DIR = PROJECT_ROOT / "content" / "scenes"
ASSETS_DIR = SCENES_DIR / "assets"
MANIFEST_PATH = ASSETS_DIR / "manifest.json"

# Schema fields an asset may carry (id + code are mandatory).
ASSET_FIELDS = ("id", "name", "icon", "category", "tags", "desc", "params", "code")
ID_RE = re.compile(r"^[a-z0-9_]+$")


# --------------------------------------------------------------------------- #
# Loading helpers
# --------------------------------------------------------------------------- #
def load_json(path: Path) -> Any:
    with open(path, "r", encoding="utf-8") as fh:
        return json.load(fh)


def iter_scenes(scene_path: Path) -> List[Dict[str, Any]]:
    """Return scene dicts from a file that may be an object or an array."""
    data = load_json(scene_path)
    if isinstance(data, dict):
        return [data]
    if isinstance(data, list):
        return [s for s in data if isinstance(s, dict)]
    return []


def load_manifest() -> List[str]:
    if MANIFEST_PATH.exists():
        data = load_json(MANIFEST_PATH)
        if isinstance(data, list):
            return data
    return []


def on_disk_assets() -> List[str]:
    """Asset filenames currently present on disk (*.asset.json)."""
    if not ASSETS_DIR.exists():
        return []
    return sorted(p.name for p in ASSETS_DIR.glob("*.asset.json"))


# --------------------------------------------------------------------------- #
# Validation
# --------------------------------------------------------------------------- #
def normalize_asset(raw: Any, scene_id: str) -> Tuple[Optional[Dict[str, Any]], str]:
    """
    Validate a single declared asset.
    Returns (cleaned_asset_or_None, error_message).
    """
    if not isinstance(raw, dict):
        return None, "asset entry is not an object"

    asset_id = raw.get("id")
    if not isinstance(asset_id, str) or not asset_id:
        return None, "missing or invalid 'id'"
    if not ID_RE.match(asset_id):
        return None, f"id '{asset_id}' must match [a-z0-9_]+"

    code = raw.get("code")
    if not isinstance(code, str) or not code.strip():
        return None, f"asset '{asset_id}' missing 'code'"

    # Keep only known fields; fill friendly defaults.
    asset: Dict[str, Any] = {"id": asset_id}
    for field in ASSET_FIELDS:
        if field in ("id", "code"):
            continue
        if field in raw and raw[field] is not None:
            asset[field] = raw[field]
    asset["code"] = code

    if "name" not in asset:
        asset["name"] = asset_id.replace("_", " ").title()
    if "category" not in asset:
        asset["category"] = "scene"
    if "tags" not in asset:
        asset["tags"] = [scene_id]
    if "desc" not in asset:
        asset["desc"] = f"Asset declared by scene '{scene_id}'"
    if "params" not in asset:
        asset["params"] = {}

    return asset, ""


# --------------------------------------------------------------------------- #
# Core
# --------------------------------------------------------------------------- #
def extract(dry_run: bool, force: bool, no_sync: bool, quiet: bool) -> int:
    if not SCENES_DIR.exists():
        print(f"error: scenes dir not found: {SCENES_DIR}", file=sys.stderr)
        return 1

    scene_files = sorted(SCENES_DIR.glob("*.scene.json"))
    existing = set(on_disk_assets())
    manifest = load_manifest()
    manifest_set = set(manifest)

    created: List[str] = []
    overwritten: List[str] = []
    skipped: List[str] = []
    invalid: List[str] = []
    scenes_with_assets: List[str] = []

    for scene_path in scene_files:
        scenes = iter_scenes(scene_path)
        for scene in scenes:
            scene_id = scene.get("id", scene_path.stem)
            declared = scene.get("assets")
            if not declared:
                continue
            if not isinstance(declared, list):
                invalid.append(f"{scene_id}: 'assets' is not a list")
                continue
            scenes_with_assets.append(scene_id)
            if not quiet:
                print(f"scene {scene_id}: {len(declared)} declared asset(s)")

            for raw in declared:
                asset, err = normalize_asset(raw, scene_id)
                if asset is None:
                    invalid.append(f"{scene_id}: {err}")
                    continue
                aid = asset["id"]
                fname = f"{aid}.asset.json"
                target = ASSETS_DIR / fname

                if fname in existing and not force:
                    skipped.append(aid)
                    if not quiet:
                        print(f"  skip   {aid} (already in catalog; use --force to override)")
                    continue

                if dry_run:
                    action = "overwrite" if fname in existing else "create"
                    print(f"  {action:8} {fname}  (dry-run)")
                    created.append(aid) if fname not in existing else overwritten.append(aid)
                    continue

                ASSETS_DIR.mkdir(parents=True, exist_ok=True)
                with open(target, "w", encoding="utf-8") as fh:
                    json.dump(asset, fh, indent=2, ensure_ascii=False)
                    fh.write("\n")
                existing.add(fname)
                if fname in manifest_set:
                    overwritten.append(aid)
                    if not quiet:
                        print(f"  overwrite {fname}")
                else:
                    created.append(aid)
                    if not quiet:
                        print(f"  create {fname}")

    # ---- Reconcile manifest with disk -------------------------------------- #
    if not no_sync:
        if dry_run:
            would_add = sorted(set(on_disk_assets()) - manifest_set)
            if would_add:
                print(f"\nmanifest would gain {len(would_add)} entry(ies):")
                for f in would_add:
                    print(f"  + {f}")
        else:
            disk = on_disk_assets()
            if set(disk) != manifest_set:
                with open(MANIFEST_PATH, "w", encoding="utf-8") as fh:
                    json.dump(disk, fh, indent=2)
                    fh.write("\n")
                if not quiet:
                    print(f"\nmanifest.json synced -> {len(disk)} entries")

    # ---- Summary ----------------------------------------------------------- #
    print("\n" + "=" * 52)
    print("SUMMARY")
    print("=" * 52)
    print(f"scenes scanned        : {len(scene_files)}")
    print(f"scenes w/ assets      : {len(set(scenes_with_assets))}")
    print(f"assets created        : {len(created)}")
    print(f"assets overwritten    : {len(overwritten)}")
    print(f"assets skipped (exist): {len(skipped)}")
    print(f"invalid declarations  : {len(invalid)}")
    if invalid:
        print("\nINVALID:")
        for i in invalid:
            print(f"  - {i}")
    print(f"\ncatalog size now      : {len(on_disk_assets())} asset file(s)")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="Extract scene-declared assets into the catalog.")
    ap.add_argument("--dry-run", action="store_true", help="Preview changes; write nothing.")
    ap.add_argument("--force", action="store_true", help="Overwrite existing asset files.")
    ap.add_argument("--no-sync", action="store_true", help="Do not rewrite manifest.json.")
    ap.add_argument("--quiet", action="store_true", help="Only errors + final summary.")
    args = ap.parse_args()
    return extract(args.dry_run, args.force, args.no_sync, args.quiet)


if __name__ == "__main__":
    raise SystemExit(main())
