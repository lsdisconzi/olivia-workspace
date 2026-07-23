#!/usr/bin/env python3
"""
extract_assets_dynamic.py – Materialize scene-declared assets with SVG-to-code generation.

This script walks scene files (content/scenes/*.scene.json), finds every asset
declaration, and either uses its existing `code` field or, if a `source` field
is present, generates the code from an SVG file using engine-aware variables.

CONTRACT
--------
An asset declaration may contain a `source` object:

    {
      "id": "my_car",
      "name": "My Car",
      "icon": "🚗",
      "category": "character",
      "tags": ["car"],
      "source": {
        "svg": "content/scenes/assets/svg/my_car.svg",
        "config": {
          "engineVars": {
            "cx": "w*0.5",
            "cy": "bY-28",
            "scale": "1.8",
            "color": "Y",
            "fill": "'none'",
            "extra": [
              "const bob = sin(mt*2.2, 2*s);",
              "const bodyY = cy + bob;"
            ]
          },
          "animationBlocks": [
            "// ground shadow",
            "svg += `<ellipse .../>`;"
          ]
        }
      }
    }

`source.config` is the same JSON structure accepted by extract_svg_dynamic.py's
--config flag.  If `code` is present it always takes precedence over `source`.

Usage:
  python3 scripts/extract_assets_dynamic.py
  python3 scripts/extract_assets_dynamic.py --dry-run
  python3 scripts/extract_assets_dynamic.py --force --quiet
"""

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# ------------------------------------------------------------------ #
#  SVG extraction helpers (copied from extract_svg_dynamic.py)        #
# ------------------------------------------------------------------ #
import xml.etree.ElementTree as ET
from html import escape as _html_escape

SVG_NS = 'http://www.w3.org/2000/svg'

def _get_attr(element, name, default=None):
    if name in element.attrib:
        return element.attrib[name]
    ns_url = f'{{{SVG_NS}}}{name}'
    return element.attrib.get(ns_url, default)

def _strip_units(value):
    if value is None:
        return None
    try:
        return float(value)
    except ValueError:
        m = re.match(r'([0-9.]+)', str(value))
        return float(m.group(1)) if m else None

def _parse_viewbox(viewbox_str):
    if not viewbox_str:
        return None
    parts = viewbox_str.strip().split()
    if len(parts) == 4:
        try:
            return float(parts[0]), float(parts[1]), float(parts[2]), float(parts[3])
        except ValueError:
            return None
    return None

def _is_mm(svg_root):
    w = (svg_root.get('width') or '').lower()
    h = (svg_root.get('height') or '').lower()
    return 'mm' in w or 'mm' in h

def _extract_groups_and_paths(svg_root):
    groups = []
    seen_paths = set()
    for g in svg_root.findall(f'.//{{{SVG_NS}}}g'):
        g_id = _get_attr(g, 'id', '')
        g_transform = _get_attr(g, 'transform', '')
        g_fill = g.get('fill') or ''
        g_stroke = g.get('stroke') or ''
        paths = []
        for path in g.findall(f'{{{SVG_NS}}}path'):
            d = path.get('d')
            if not d or d in seen_paths:
                continue
            seen_paths.add(d)
            paths.append({
                'd': d,
                'fill': path.get('fill', ''),
                'stroke': path.get('stroke', ''),
                'id': _get_attr(path, 'id', ''),
            })
        if paths:
            groups.append({
                'id': g_id,
                'transform': g_transform,
                'fill': g_fill,
                'stroke': g_stroke,
                'paths': paths,
            })
    # ungrouped root paths
    root_paths = []
    for path in svg_root.findall(f'.//{{{SVG_NS}}}path'):
        if path.find(f'ancestor::{{{SVG_NS}}}g') is not None:
            continue
        d = path.get('d')
        if not d or d in seen_paths:
            continue
        seen_paths.add(d)
        root_paths.append({
            'd': d,
            'fill': path.get('fill', ''),
            'stroke': path.get('stroke', ''),
            'id': _get_attr(path, 'id', ''),
        })
    if root_paths:
        groups.insert(0, {
            'id': 'root',
            'transform': '',
            'fill': '',
            'stroke': '',
            'paths': root_paths,
        })
    return groups

def _escape_for_template_literal(s: str) -> str:
    s = s.replace("\\", "\\\\")
    s = s.replace("`", "\\`")
    s = s.replace("${", "\\${")
    return s

def _escape_svg_attr(s: str) -> str:
    s = _escape_for_template_literal(s)
    s = _html_escape(s, quote=True)
    return s

def generate_code_from_svg(svg_path: Path, config: Dict[str, Any]) -> str:
    """
    Parse an SVG file and return a JavaScript code string using the given
    engine-aware config (same as extract_svg_dynamic.py's --config structure).
    """
    if not svg_path.is_file():
        raise FileNotFoundError(f"SVG file not found: {svg_path}")

    tree = ET.parse(str(svg_path))
    root = tree.getroot()

    svg_width = _strip_units(root.get('width')) or None
    svg_height = _strip_units(root.get('height')) or None
    vb = _parse_viewbox(root.get('viewBox'))
    if svg_width is None and vb:
        svg_width = vb[2]
    if svg_height is None and vb:
        svg_height = vb[3]
    has_mm = _is_mm(root)

    groups = _extract_groups_and_paths(root)
    if not groups:
        raise ValueError("No paths found in SVG")

    engine_vars = config.get('engineVars', {})
    animation_blocks = config.get('animationBlocks', [])

    lines = []
    # extra variable declarations
    extra = engine_vars.get('extra', [])
    if extra:
        for line in extra:
            lines.append(line)
        lines.append('')

    # animation blocks
    for block in animation_blocks:
        lines.append(block)
    if animation_blocks:
        lines.append('')

    # core variables
    cx_expr = engine_vars.get('cx', 'ctx.x ?? 200')
    cy_expr = engine_vars.get('cy', 'ctx.y ?? 180')
    scale_expr = engine_vars.get('scale', 'ctx.scale ?? 1.0')
    col_expr = engine_vars.get('color', 'ctx.color || "#000000"')
    fill_expr = engine_vars.get('fill', 'ctx.fill ?? "none"')

    lines.append(f"const cx = {cx_expr};")
    lines.append(f"const cy = {cy_expr};")
    lines.append(f"const sc = {scale_expr};")
    lines.append(f"const col = {col_expr};")
    lines.append(f"const fillCol = {fill_expr};")

    if has_mm and svg_width and svg_height:
        lines.append(f"const svgW = {svg_width};")
        lines.append(f"const svgH = {svg_height};")
        lines.append("const pxScale = sc * 3.7795;")
        lines.append("const ox = cx - (svgW * pxScale) / 2;")
        lines.append("const oy = cy - (svgH * pxScale) / 2;")
        outer_tag = (
            '<g transform="translate(${ox},${oy}) scale(${pxScale})" '
            'stroke="${col}" stroke-width="${0.5 / pxScale}" fill="${fillCol}">'
        )
    else:
        outer_tag = (
            '<g transform="translate(${cx},${cy}) scale(${sc})" '
            'stroke="${col}" fill="${fillCol}">'
        )
    lines.append(f"svg += `{outer_tag}`;")

    for g in groups:
        g_id = _escape_svg_attr(g['id']) if g['id'] else 'g'
        g_transform = _escape_svg_attr(g['transform']) if g['transform'] else ''
        g_fill = _escape_svg_attr(g.get('fill') or '')
        g_stroke = _escape_svg_attr(g.get('stroke') or '')

        attrs = f'id="{g_id}"'
        if g_transform:
            attrs += f' transform="{g_transform}"'
        if g_fill:
            attrs += f' fill="{g_fill}"'
        if g_stroke:
            attrs += f' stroke="{g_stroke}"'
        lines.append(f"svg += `<g {attrs}>`;")

        for p in g['paths']:
            d = _escape_svg_attr(p['d'])
            p_fill = _escape_svg_attr(p.get('fill') or '')
            p_stroke = _escape_svg_attr(p.get('stroke') or '')
            p_id = _escape_svg_attr(p.get('id') or '')

            path_attrs = f'd="{d}"'
            if p.get('fill') not in ('none', '#000000', ''):
                path_attrs += f' fill="{p_fill}"'
            if p.get('stroke') not in ('none', '#000000', ''):
                path_attrs += f' stroke="{p_stroke}"'
            if p.get('id'):
                path_attrs += f' id="{p_id}"'
            lines.append(f"svg += `<path {path_attrs}/>`;")

        lines.append("svg += `</g>`;")

    lines.append("svg += `</g>`;")
    return "\n".join(lines)


# ------------------------------------------------------------------ #
#  Asset materialization logic (adapted from extract_assets.py)       #
# ------------------------------------------------------------------ #
PROJECT_ROOT = Path(__file__).resolve().parent.parent
SCENES_DIR = PROJECT_ROOT / "content" / "scenes"
ASSETS_DIR = SCENES_DIR / "assets"
MANIFEST_PATH = ASSETS_DIR / "manifest.json"

ASSET_FIELDS = ("id", "name", "icon", "category", "tags", "desc", "params", "code")
ID_RE = re.compile(r"^[a-z0-9_]+$")

# default params for generated assets (can be overridden in declaration)
DEFAULT_PARAMS = {
    "x":     {"type": "x",     "default": "w*0.5", "desc": "Center X"},
    "y":     {"type": "y",     "default": "bY-50", "desc": "Center Y"},
    "scale": {"type": "number","default": 1.0,      "desc": "Scale factor"},
    "color": {"type": "color", "default": "#000000","desc": "Stroke color"},
    "fill":  {"type": "color", "default": "none",   "desc": "Fill color"},
}


def load_json(path: Path) -> Any:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def iter_scenes(scene_path: Path) -> List[Dict[str, Any]]:
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
    if not ASSETS_DIR.exists():
        return []
    return sorted(p.name for p in ASSETS_DIR.glob("*.asset.json"))


def resolve_svg_path(raw_path: str) -> Path:
    """Resolve a possibly relative SVG path from the project root."""
    p = Path(raw_path)
    if p.is_absolute():
        return p
    return PROJECT_ROOT / p


def normalize_and_generate(declaration: Dict[str, Any], scene_id: str,
                           dry_run: bool, quiet: bool) -> Optional[Dict[str, Any]]:
    """
    Validate an asset declaration and, if needed, generate its `code` from an SVG.
    Returns the final asset dict ready to write, or None on failure.
    """
    asset_id = declaration.get("id")
    if not isinstance(asset_id, str) or not asset_id:
        print(f"  error: missing id in scene '{scene_id}'", file=sys.stderr)
        return None
    if not ID_RE.match(asset_id):
        print(f"  error: id '{asset_id}' invalid (must be [a-z0-9_]+)", file=sys.stderr)
        return None

    # ---- Determine code source ----------------------------------------------
    code = declaration.get("code")
    source = declaration.get("source")

    if code is not None:
        if not isinstance(code, str) or not code.strip():
            print(f"  error: asset '{asset_id}' has empty 'code'", file=sys.stderr)
            return None
    elif source is not None:
        if not isinstance(source, dict):
            print(f"  error: asset '{asset_id}' 'source' is not an object", file=sys.stderr)
            return None
        svg_raw = source.get("svg")
        if not svg_raw:
            print(f"  error: asset '{asset_id}' source missing 'svg' path", file=sys.stderr)
            return None
        svg_path = resolve_svg_path(svg_raw)
        config = source.get("config", {})
        if not dry_run:
            try:
                code = generate_code_from_svg(svg_path, config)
                if not quiet:
                    print(f"  svg generated  {asset_id} ({svg_path})")
            except Exception as e:
                print(f"  error: SVG extraction failed for '{asset_id}': {e}", file=sys.stderr)
                return None
        else:
            # Dry‑run: we don't actually parse the SVG, just flag it
            code = "// dry-run placeholder"
    else:
        print(f"  error: asset '{asset_id}' has neither 'code' nor 'source'", file=sys.stderr)
        return None

    # ---- Assemble the final asset object ------------------------------------
    asset: Dict[str, Any] = {"id": asset_id}
    for field in ASSET_FIELDS:
        if field in ("id", "code"):
            continue
        if field in declaration and declaration[field] is not None:
            asset[field] = declaration[field]
    asset["code"] = code

    # defaults
    asset.setdefault("name", asset_id.replace("_", " ").title())
    asset.setdefault("category", "scene")
    asset.setdefault("tags", [scene_id])
    asset.setdefault("desc", f"Asset declared by scene '{scene_id}'")
    if "params" not in asset:
        asset["params"] = DEFAULT_PARAMS

    return asset


def process_scenes(dry_run: bool, force: bool, no_sync: bool, quiet: bool) -> int:
    if not SCENES_DIR.exists():
        print(f"error: scenes directory not found: {SCENES_DIR}", file=sys.stderr)
        return 1

    scene_files = sorted(SCENES_DIR.glob("*.scene.json"))
    existing_files = set(on_disk_assets())
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
                print(f"\nscene {scene_id}: {len(declared)} asset(s)")

            for declaration in declared:
                asset = normalize_and_generate(declaration, scene_id, dry_run, quiet)
                if asset is None:
                    invalid.append(f"{scene_id}: invalid asset entry")
                    continue

                aid = asset["id"]
                fname = f"{aid}.asset.json"
                target = ASSETS_DIR / fname

                if fname in existing_files and not force:
                    skipped.append(aid)
                    if not quiet:
                        print(f"  skip   {aid} (exists; use --force to overwrite)")
                    continue

                if dry_run:
                    action = "overwrite" if fname in existing_files else "create"
                    print(f"  {action:8} {fname}  (dry-run)")
                    if fname not in existing_files:
                        created.append(aid)
                    else:
                        overwritten.append(aid)
                    continue

                ASSETS_DIR.mkdir(parents=True, exist_ok=True)
                with open(target, "w", encoding="utf-8") as fh:
                    json.dump(asset, fh, indent=2, ensure_ascii=False)
                    fh.write("\n")
                existing_files.add(fname)
                if fname in manifest_set:
                    overwritten.append(aid)
                    if not quiet:
                        print(f"  overwrite {fname}")
                else:
                    created.append(aid)
                    if not quiet:
                        print(f"  create   {fname}")

    # ---- Manifest sync ------------------------------------------------------
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

    # ---- Summary ------------------------------------------------------------
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
    ap = argparse.ArgumentParser(
        description="Materialize scene-declared assets, generating code from SVG if needed."
    )
    ap.add_argument("--dry-run", action="store_true", help="Preview changes; write nothing.")
    ap.add_argument("--force", action="store_true", help="Overwrite existing asset files.")
    ap.add_argument("--no-sync", action="store_true", help="Do not rewrite manifest.json.")
    ap.add_argument("--quiet", action="store_true", help="Only errors + final summary.")
    args = ap.parse_args()
    return process_scenes(args.dry_run, args.force, args.no_sync, args.quiet)


if __name__ == "__main__":
    raise SystemExit(main())