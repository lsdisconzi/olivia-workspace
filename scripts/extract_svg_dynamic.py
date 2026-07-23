#!/usr/bin/env python3
"""
Extract SVG paths and generate a dynamic .asset.json with engine-aware variables.

This script is for assets that need relative positioning (e.g. w, bY), built-in
animation (using mt, sin, etc.), or multiple hard-coded colours. You supply a
configuration file that defines the JavaScript expressions.

Usage:
    python scripts/extract_svg_dynamic.py input.svg --config config.json
    # Or, if you prefer inline flags:
    python scripts/extract_svg_dynamic.py input.svg \
        --id my_car --name "My Car" --icon "🚗" --category character \
        --cx "w*0.5" --cy "bY-28" --scale "1.8" \
        --color "Y" --fill "'none'" \
        --extra "const bob = sin(mt*2.2, 2*s);" \
        --extra "const bodyY = cy + bob;" \
        --output my_car.asset.json

Configuration JSON format (--config):
{
  "id": "fiat_havan",
  "name": "Fiat Havan",
  "icon": "🚗",
  "category": "character",
  "tags": ["car", "vehicle"],
  "desc": "Animated Fiat Havan car",
  "engineVars": {
    "cx": "w * 0.5",
    "cy": "bY - 28",
    "scale": "1.8",
    "color": "Y",
    "fill": "'none'",
    "extra": [
      "const happy = true;",
      "const ol2 = Math.max(1.5 * s, 1);",
      "const bob = sin(mt * 2.2, 2 * s);",
      "const blink = sin(mt * 1.3) > 0.96 ? 0.15 : 1;",
      "const glow2 = 0.55 + sin(mt * 3) * 0.2;",
      "const smile = happy ? 5 * s : 1 * s;",
      "const bodyY = cy + bob;"
    ]
  },
  "animationBlocks": [
    "// custom shadows or pre-drawings here"
  ]
}

All paths from the SVG will be placed inside a <g> that is transformed using
the expressions you provide. The default params (x, y, scale, color, fill) in
the asset will be overridden/ignored by your engineVars, so you can set them
to any placeholder.
"""

import sys
import json
import re
import argparse
import xml.etree.ElementTree as ET
from pathlib import Path
from html import escape as _html_escape

SVG_NS = 'http://www.w3.org/2000/svg'

# Default static params (will be overridden by engineVars in the final code,
# but kept here for asset compatibility)
DEFAULT_PARAMS = {
    "x":     {"type": "x",     "default": "w*0.5", "desc": "Center X"},
    "y":     {"type": "y",     "default": "bY-50", "desc": "Center Y"},
    "scale": {"type": "number","default": 1.0,      "desc": "Scale factor"},
    "color": {"type": "color", "default": "#000000","desc": "Stroke color"},
    "fill":  {"type": "color", "default": "none",   "desc": "Fill color"},
}


# ---------- SVG helpers (same as static extractor) ----------
def get_attr(element, name, default=None):
    if name in element.attrib:
        return element.attrib[name]
    ns_url = f'{{{SVG_NS}}}{name}'
    return element.attrib.get(ns_url, default)

def strip_units(value):
    if value is None:
        return None
    try:
        return float(value)
    except ValueError:
        m = re.match(r'([0-9.]+)', str(value))
        return float(m.group(1)) if m else None

def parse_viewbox(viewbox_str):
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
    w = (svg_root.get('width') or '').lower()
    h = (svg_root.get('height') or '').lower()
    return 'mm' in w or 'mm' in h

def extract_groups_and_paths(svg_root):
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
            if not d or d in seen_paths:
                continue
            seen_paths.add(d)
            paths.append({
                'd': d,
                'fill': path.get('fill', ''),
                'stroke': path.get('stroke', ''),
                'id': get_attr(path, 'id', ''),
            })
        if paths:
            groups.append({
                'id': g_id,
                'transform': g_transform,
                'fill': g_fill,
                'stroke': g_stroke,
                'paths': paths,
            })
    # Ungrouped root paths
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


# ---------- Safe escaping (improved) ----------
def escape_for_template_literal(s: str) -> str:
    s = s.replace("\\", "\\\\")
    s = s.replace("`", "\\`")
    s = s.replace("${", "\\${")
    return s

def escape_svg_attr(s: str) -> str:
    s = escape_for_template_literal(s)
    s = _html_escape(s, quote=True)  # escapes ", &, <, >
    return s


# ---------- Dynamic code generation ----------
def generate_dynamic_code(groups, svg_width, svg_height, has_mm, engine_vars, animation_blocks=None):
    """
    Build the JavaScript code that uses engine-aware variables.
    engine_vars: dict with keys 'cx', 'cy', 'scale', 'color', 'fill', and optional 'extra' (list of strings).
    animation_blocks: optional list of JS code lines to inject before drawing.
    """
    lines = []
    # 1. Extra variable declarations (e.g. bob, blink)
    extra = engine_vars.get('extra', [])
    if extra:
        for line in extra:
            lines.append(line)
        lines.append('')

    # 2. Pre‑animation blocks
    if animation_blocks:
        for block in animation_blocks:
            lines.append(block)
        lines.append('')

    # 3. Core variable extraction from engine_vars (or fallback to defaults)
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

    # 4. Transform wrapper (mm logic retained just in case)
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

    # 5. Groups and paths (same as static, but with safe escaping)
    for g in groups:
        g_id = escape_svg_attr(g['id']) if g['id'] else 'g'
        g_transform = escape_svg_attr(g['transform']) if g['transform'] else ''
        g_fill = escape_svg_attr(g.get('fill') or '')
        g_stroke = escape_svg_attr(g.get('stroke') or '')

        tag_attrs = f'id="{g_id}"'
        if g_transform:
            tag_attrs += f' transform="{g_transform}"'
        if g_fill:
            tag_attrs += f' fill="{g_fill}"'
        if g_stroke:
            tag_attrs += f' stroke="{g_stroke}"'
        lines.append(f"svg += `<g {tag_attrs}>`;")

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

        lines.append("svg += `</g>`;")

    lines.append("svg += `</g>`;")
    return "\n".join(lines)


def build_asset_json(meta, code):
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


# ---------- CLI ----------
def main():
    parser = argparse.ArgumentParser(
        description='Generate a dynamic (engine-aware) SVG asset from a static SVG.',
        epilog='Use either --config for a full JSON spec, or individual flags for a quick dynamic asset.'
    )
    parser.add_argument('input', help='Input SVG file')
    parser.add_argument('--output', '-o', default=None, help='Output .asset.json path')
    parser.add_argument('--config', '-c', default=None, help='Path to JSON config file (see docs)')

    # Metadata flags (used if --config not supplied)
    parser.add_argument('--id', dest='id_value', default=None)
    parser.add_argument('--name', default=None)
    parser.add_argument('--icon', default=None)
    parser.add_argument('--category', default='prop')
    parser.add_argument('--tags', nargs='*', default=[])
    parser.add_argument('--desc', default=None)

    # Engine variable overrides (inline)
    parser.add_argument('--cx', default=None, help='Expression for cx (e.g. "w*0.5")')
    parser.add_argument('--cy', default=None, help='Expression for cy')
    parser.add_argument('--scale', default=None, help='Expression for scale')
    parser.add_argument('--color', default=None, help='Expression for primary color')
    parser.add_argument('--fill', default=None, help='Expression for fill')
    parser.add_argument('--extra', action='append', default=[], help='Extra variable line (can be repeated)')

    parser.add_argument('--mm', action='store_true', help='Force mm units (auto-detected otherwise)')
    parser.add_argument('--no-manifest', action='store_true', help='Skip manifest update')

    args = parser.parse_args()

    # Load config or build from flags
    if args.config:
        with open(args.config, 'r', encoding='utf-8') as f:
            cfg = json.load(f)
        meta = {
            'id': cfg.get('id', ''),
            'name': cfg.get('name', ''),
            'icon': cfg.get('icon', '📦'),
            'category': cfg.get('category', 'prop'),
            'tags': cfg.get('tags', []),
            'desc': cfg.get('desc', ''),
            'params': cfg.get('params', DEFAULT_PARAMS),
        }
        engine_vars = cfg.get('engineVars', {})
        animation_blocks = cfg.get('animationBlocks', [])
    else:
        meta = {
            'id': args.id_value or '',
            'name': args.name or '',
            'icon': args.icon or '📦',
            'category': args.category,
            'tags': args.tags,
            'desc': args.desc or '',
            'params': DEFAULT_PARAMS,
        }
        # Build engine_vars from flags
        engine_vars = {}
        if args.cx:
            engine_vars['cx'] = args.cx
        if args.cy:
            engine_vars['cy'] = args.cy
        if args.scale:
            engine_vars['scale'] = args.scale
        if args.color:
            engine_vars['color'] = args.color
        if args.fill:
            engine_vars['fill'] = args.fill
        if args.extra:
            engine_vars['extra'] = args.extra
        animation_blocks = []

    # Parse SVG
    input_path = Path(args.input)
    if not input_path.is_file():
        print(f"Error: input file not found: {input_path}", file=sys.stderr)
        sys.exit(1)

    tree = ET.parse(str(input_path))
    root = tree.getroot()
    svg_width = strip_units(root.get('width')) or None
    svg_height = strip_units(root.get('height')) or None
    vb = parse_viewbox(root.get('viewBox'))
    if svg_width is None and vb:
        svg_width = vb[2]
    if svg_height is None and vb:
        svg_height = vb[3]
    has_mm = args.mm or is_mm(root)

    groups = extract_groups_and_paths(root)
    if not groups:
        print("Error: no paths found", file=sys.stderr)
        sys.exit(1)

    # Auto‑derive id/name if missing
    if not meta.get('id'):
        stem = input_path.stem
        meta['id'] = re.sub(r'[^a-z0-9_]', '_', stem.lower()).strip('_')
        print(f"Auto id: {meta['id']}")
    if not meta.get('name'):
        meta['name'] = meta['id'].replace('_', ' ').title()
    if not meta.get('desc'):
        meta['desc'] = f"Dynamic SVG asset (engine-aware)"

    # Generate code
    js_code = generate_dynamic_code(groups, svg_width, svg_height, has_mm, engine_vars, animation_blocks)
    asset_data = build_asset_json(meta, js_code)

    # Determine output path
    out = args.output
    if out is None:
        parent_dir = input_path.parent
        if parent_dir.name == 'svg':
            parent_dir = parent_dir.parent
        out = parent_dir / f"{meta['id']}.asset.json"
    else:
        out = Path(out)

    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, 'w', encoding='utf-8') as f:
        json.dump(asset_data, f, indent=2, ensure_ascii=False)
    print(f"Written: {out}")

    # Manifest update
    if not args.no_manifest:
        manifest_path = out.parent / 'manifest.json'
        try:
            if manifest_path.exists():
                manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
                if not isinstance(manifest, list):
                    manifest = []
            else:
                manifest = []
            fname = out.name
            if fname not in manifest:
                manifest.append(fname)
                manifest.sort()
                manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
                print(f"Added to manifest: {fname}")
            else:
                print(f"Already in manifest: {fname}")
        except Exception as e:
            print(f"Warning: could not update manifest: {e}", file=sys.stderr)


if __name__ == '__main__':
    main()