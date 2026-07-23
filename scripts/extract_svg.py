#!/usr/bin/env python3
"""
Extract SVG paths and generate a scene-compatible .asset.json file.

Usage:
    # With inline metadata flags:
    python scripts/extract_svg.py input.svg \\
        --id my_thing --name "My Thing" --icon "📦" --category prop \\
        --tags tag1 tag2 --desc "Short description" \\
        --color "#FFD700" --fill "none" \\
        [--mm] [--output output.asset.json]

    # With metadata JSON file (alternative to flags):
    python scripts/extract_svg.py input.svg --meta metadata.json

    # If output path is omitted, writes <id>.asset.json to the SVG's parent.

Metadata JSON format (--meta):
    {
      "id": "my_thing",
      "name": "My Thing",
      "icon": "📦",
      "category": "prop",
      "tags": ["tag1", "tag2"],
      "desc": "Short description",
      "params": {
        "x":     { "type": "x",     "default": "w*0.5" },
        "y":     { "type": "y",     "default": "bY-50" },
        "scale": { "type": "number","default": 1.0 },
        "color": { "type": "color", "default": "#000000" },
        "fill":  { "type": "color", "default": "none" }
      }
    }
"""

import sys
import json
import re
import xml.etree.ElementTree as ET
from pathlib import Path
from html import escape as _html_escape

# SVG namespace
SVG_NS = 'http://www.w3.org/2000/svg'

# Default params injected into every generated asset
DEFAULT_PARAMS = {
    "x":     {"type": "x",     "default": "w*0.5", "desc": "Center X position"},
    "y":     {"type": "y",     "default": "bY-50", "desc": "Center Y position"},
    "scale": {"type": "number","default": 1.0,     "desc": "Scale factor"},
    "color": {"type": "color", "default": "#000000", "desc": "Stroke/primary color"},
    "fill":  {"type": "color", "default": "none",    "desc": "Fill color"},
}


def get_attr(element, name, default=None):
    """Get attribute from element, handling namespaces."""
    if name in element.attrib:
        return element.attrib[name]
    ns_url = f'{{{SVG_NS}}}{name}'
    return element.attrib.get(ns_url, default)


def strip_units(value):
    """Strip units (mm, px, etc.) from a dimension string, return float."""
    if value is None:
        return None
    try:
        return float(value)
    except ValueError:
        m = re.match(r'([0-9.]+)', str(value))
        return float(m.group(1)) if m else None


def parse_viewbox(viewbox_str):
    """Parse 'minx miny w h' from viewBox string."""
    if not viewbox_str:
        return None
    parts = viewbox_str.strip().split()
    if len(parts) == 4:
        try:
            return float(parts[0]), float(parts[1]), float(parts[2]), float(parts[3])
        except ValueError:
            return None
    return None


def is_mm(svg_root):
    """Check if SVG uses mm units."""
    w = (svg_root.get('width') or '').lower()
    h = (svg_root.get('height') or '').lower()
    return 'mm' in w or 'mm' in h


def extract_groups_and_paths(svg_root):
    """Extract all groups and their paths from the SVG root."""
    groups = []
    seen_paths = set()

    for g in svg_root.findall(f'.//{{{SVG_NS}}}g'):
        g_id = get_attr(g, 'id', '')
        g_transform = get_attr(g, 'transform', '')
        g_fill = g.get('fill') or ''
        g_stroke = g.get('stroke') or ''

        paths = []
        for path in g.findall(f'{{{SVG_NS}}}path'):
            d = path.get('d')
            if not d:
                continue
            # Deduplicate identical path data
            if d in seen_paths:
                continue
            seen_paths.add(d)

            p_fill = path.get('fill', '')
            p_stroke = path.get('stroke', '')
            p_id = get_attr(path, 'id', '')
            paths.append({
                'd': d,
                'fill': p_fill,
                'stroke': p_stroke,
                'id': p_id,
            })

        if paths:
            groups.append({
                'id': g_id,
                'transform': g_transform,
                'fill': g_fill,
                'stroke': g_stroke,
                'paths': paths,
            })

    # Ungrouped paths at root level
    root_paths = []
    for path in svg_root.findall(f'.//{{{SVG_NS}}}path'):
        # Skip paths already captured in groups
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
            'id': get_attr(path, 'id', ''),
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


def escape_for_template_literal(s: str) -> str:
    """Escape backtick, dollar-brace, and backslash for a JS template literal."""
    s = s.replace("\\", "\\\\")   # must be first
    s = s.replace("`", "\\`")
    s = s.replace("${", "\\${")
    return s


def escape_svg_attr(s: str) -> str:
    """Escape a string for use in a double-quoted SVG attribute,
    inside a JavaScript template literal."""
    # Make safe for template literal
    s = escape_for_template_literal(s)
    # HTML‑escape: `"` → `&quot;`, `&` → `&amp;`, etc.
    s = _html_escape(s, quote=True)
    return s


def generate_code(groups, svg_width, svg_height, has_mm, params):
    """
    Generate JavaScript code string that builds the SVG.
    Returns the code as a single string (with newlines).
    """
    lines = []

    # Parameter extraction from ctx
    lines.append("const cx = ctx.x ?? 200;")
    lines.append("const cy = ctx.y ?? 180;")
    lines.append("const sc = ctx.scale ?? 1.0;")
    lines.append("const col = ctx.color || \"#000000\";")
    lines.append("const fillCol = ctx.fill ?? \"none\";")

    # If original was in mm, add mm-to-px scaling
    if has_mm and svg_width and svg_height:
        lines.append(f"const svgW = {svg_width};")
        lines.append(f"const svgH = {svg_height};")
        lines.append("const pxScale = sc * 3.7795;")
        lines.append("const ox = cx - (svgW * pxScale) / 2;")
        lines.append("const oy = cy - (svgH * pxScale) / 2;")
        outer_tag = (
            f'<g transform="translate(${{ox}},${{oy}}) scale(${{pxScale}})" '
            f'stroke="${{col}}" stroke-width="${{0.5 / pxScale}}" fill="${{fillCol}}">'
        )
    else:
        outer_tag = (
            f'<g transform="translate(${{cx}},${{cy}}) scale(${{sc}})" '
            f'stroke="${{col}}" fill="${{fillCol}}">'
        )

    lines.append(f"svg += `{outer_tag}`;")

    for g in groups:
        g_id = escape_svg_attr(g['id']) if g['id'] else 'g'
        g_transform = escape_svg_attr(g['transform']) if g['transform'] else ''
        g_fill = escape_svg_attr(g.get('fill') or '')
        g_stroke = escape_svg_attr(g.get('stroke') or '')

        # Open group tag
        tag_attrs = f'id="{g_id}"'
        if g_transform:
            tag_attrs += f' transform="{g_transform}"'
        if g_fill:
            tag_attrs += f' fill="{g_fill}"'
        if g_stroke:
            tag_attrs += f' stroke="{g_stroke}"'
        lines.append(f"svg += `<g {tag_attrs}>`;")

        # Paths
        for p in g['paths']:
            d = escape_svg_attr(p['d'])
            p_fill = escape_svg_attr(p.get('fill') or '')
            p_stroke = escape_svg_attr(p.get('stroke') or '')
            p_id = escape_svg_attr(p.get('id') or '')

            path_attrs = f'd="{d}"'
            if p.get('fill') not in ('none', '#000000', ''):
                path_attrs += f' fill="{p_fill}"'
            if p.get('stroke') not in ('none', '#000000', ''):
                path_attrs += f' stroke="{p_stroke}"'
            if p.get('id'):
                path_attrs += f' id="{p_id}"'
            lines.append(f"svg += `<path {path_attrs}/>`;")

        # Close group
        lines.append("svg += `</g>`;")

    # Close outer group
    lines.append("svg += `</g>`;")

    return "\n".join(lines)


def build_asset_json(meta, code):
    """Build the full .asset.json dict."""
    return {
        "id": meta.get("id", ""),
        "name": meta.get("name", ""),
        "icon": meta.get("icon", "📦"),
        "category": meta.get("category", "prop"),
        "tags": meta.get("tags", []),
        "desc": meta.get("desc", ""),
        "params": meta.get("params", DEFAULT_PARAMS),
        "code": code,
    }


def update_manifest(manifest_path, filename):
    """Append filename to manifest.json if not already present."""
    if manifest_path.exists():
        try:
            manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
        except (json.JSONDecodeError, Exception):
            manifest = []
    else:
        manifest = []

    if not isinstance(manifest, list):
        manifest = []

    if filename not in manifest:
        manifest.append(filename)
        manifest.sort()
        manifest_path.write_text(
            json.dumps(manifest, indent=2, ensure_ascii=False) + '\n',
            encoding='utf-8'
        )
        return True
    return False


def parse_meta_file(path):
    """Parse metadata JSON file."""
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def parse_cli_meta(args):
    """Parse metadata from CLI flags (alternative to --meta)."""
    meta = {}
    if args.id_value:
        meta['id'] = args.id_value
    if args.name:
        meta['name'] = args.name
    if args.icon:
        meta['icon'] = args.icon
    if args.category:
        meta['category'] = args.category
    if args.tags:
        meta['tags'] = args.tags
    if args.desc:
        meta['desc'] = args.desc
    if args.color or args.fill:
        params = {}
        if args.color:
            params['color'] = {"type": "color", "default": args.color, "desc": "Stroke/primary color"}
        if args.fill:
            params['fill'] = {"type": "color", "default": args.fill, "desc": "Fill color"}
        meta['params'] = params
    return meta


def main():
    import argparse

    parser = argparse.ArgumentParser(
        description='Extract SVG paths and generate a .asset.json for the scene engine.'
    )
    parser.add_argument('input', help='Input SVG file path')
    parser.add_argument('--output', '-o', default=None,
                        help='Output .asset.json path (default: <id>.asset.json next to input)')
    parser.add_argument('--meta', '-m', default=None,
                        help='Path to metadata JSON file (alternative to individual flags)')
    parser.add_argument('--id', dest='id_value', default=None,
                        help='Asset ID (lowercase snake_case)')
    parser.add_argument('--name', default=None, help='Display name')
    parser.add_argument('--icon', default=None, help='Emoji icon')
    parser.add_argument('--category', default=None,
                        choices=['character', 'prop', 'environment', 'fx', 'sky'],
                        help='Asset category')
    parser.add_argument('--tags', nargs='*', default=[], help='Search tags')
    parser.add_argument('--desc', default=None, help='Short description')
    parser.add_argument('--color', default=None, help='Default stroke color')
    parser.add_argument('--fill', default=None, help='Default fill color')
    parser.add_argument('--no-manifest', action='store_true',
                        help='Skip manifest.json update')
    parser.add_argument('--mm', action='store_true',
                        help='Force mm units (auto-detected otherwise)')

    args = parser.parse_args()

    # Resolve input path
    input_path = Path(args.input)
    if not input_path.is_file():
        print(f"Error: input file not found: {input_path}", file=sys.stderr)
        sys.exit(1)

    # Parse SVG
    tree = ET.parse(str(input_path))
    root = tree.getroot()

    # Dimensions
    svg_width = strip_units(root.get('width')) or None
    svg_height = strip_units(root.get('height')) or None
    vb = parse_viewbox(root.get('viewBox'))
    if svg_width is None and vb:
        svg_width = vb[2]
    if svg_height is None and vb:
        svg_height = vb[3]

    has_mm = args.mm or is_mm(root)

    # Extract paths
    groups = extract_groups_and_paths(root)
    if not groups:
        print("Error: no paths found in SVG", file=sys.stderr)
        sys.exit(1)

    group_count = len(groups)
    path_count = sum(len(g['paths']) for g in groups)
    print(f"Parsed SVG: {group_count} group(s), {path_count} path(s)")
    if svg_width and svg_height:
        print(f"Dimensions: {svg_width:.2f} x {svg_height:.2f} {'mm' if has_mm else 'px'}")

    # Metadata
    meta = {}
    if args.meta:
        try:
            meta = parse_meta_file(args.meta)
        except Exception as e:
            print(f"Error reading metadata file: {e}", file=sys.stderr)
            sys.exit(1)
    else:
        meta = parse_cli_meta(args)

    # Auto-derive id from input filename if not provided
    if not meta.get('id'):
        stem = input_path.stem
        meta['id'] = re.sub(r'[^a-z0-9_]', '_', stem.lower()).strip('_')
        print(f"Auto-derived id: {meta['id']}")

    # Auto-derive name from id if not provided
    if not meta.get('name'):
        meta['name'] = meta['id'].replace('_', ' ').title()
        print(f"Auto-derived name: {meta['name']}")

    if not meta.get('desc'):
        meta['desc'] = f"SVG asset with {path_count} paths in {group_count} groups"

    # Merge default params with any provided in meta
    meta_params = meta.get('params', {})
    merged_params = {}
    for key, default_val in DEFAULT_PARAMS.items():
        if key in meta_params:
            merged_params[key] = meta_params[key]
        else:
            merged_params[key] = dict(default_val)
    meta['params'] = merged_params

    # Generate code
    js_code = generate_code(groups, svg_width, svg_height, has_mm, meta['params'])

    # Build output JSON
    asset_data = build_asset_json(meta, js_code)

    # Determine output path
    output_path = args.output
    if output_path is None:
        parent_dir = input_path.parent
        if parent_dir.name == 'svg':
            parent_dir = parent_dir.parent
        output_path = parent_dir / f"{meta['id']}.asset.json"
    else:
        output_path = Path(output_path)

    # Write output
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(asset_data, f, indent=2, ensure_ascii=False)
    print(f"Written: {output_path}")

    # Update manifest
    if not args.no_manifest:
        manifest_path = output_path.parent / 'manifest.json'
        added = update_manifest(manifest_path, output_path.name)
        if added:
            print(f"Added to manifest: {output_path.name}")
        else:
            print(f"Already in manifest: {output_path.name}")

    print(f"Code: {len(js_code)} chars")


if __name__ == '__main__':
    main()