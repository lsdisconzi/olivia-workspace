"""Build branded DOCX reports from Markdown — Olivia visual identity.

Minimalist, editorial layout: quiet type scale, a single accent rule under
the title, restrained use of colour (green + terra), small-caps kickers
instead of shouty uppercase, generous whitespace. Supports headings (with
real Word styles + optional Table of Contents), tables, blockquotes, fenced
code, inline code, bold/italic/links, and nested bullet lists.

Usage:
    python build_docx.py report.md                 # writes report.docx
    python build_docx.py report.md out.docx         # explicit output path

Or import build_from_markdown() directly for programmatic control over the
brand name, kicker, and footer text.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

from docx import Document
from docx.shared import Pt, RGBColor, Cm, Twips
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.style import WD_STYLE_TYPE
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

# ----------------------------------------------------------------------
# Palette — quiet green + terra, warm neutrals. Keep it to this set.
# ----------------------------------------------------------------------
VERDE = RGBColor(0x1C, 0x45, 0x32)       # deep green — titles, brand
VERDE2 = RGBColor(0x2D, 0x6A, 0x4F)      # mid green — H2
TERRA = RGBColor(0xC4, 0x62, 0x2D)       # terracotta — kickers, accents
OURO = RGBColor(0xB8, 0x86, 0x0B)        # ochre — reserved accent
TINTA = RGBColor(0x1A, 0x18, 0x14)       # near-black body text
MEDIO = RGBColor(0x6B, 0x66, 0x5D)       # secondary text / captions
CLARO = RGBColor(0x9A, 0x90, 0x88)       # tertiary text / running header
BORDA = "E5E2DC"                          # hairline rules
CREME_FILL = "FAF9F6"                     # warm off-white fill
VERDE_LO = "EDF2EE"                       # pale green fill
TERRA_LO = "F7EDE6"                       # pale terra fill

HEAD_FONT = "Cambria"
BODY_FONT = "Calibri"
MONO_FONT = "Consolas"


# ----------------------------------------------------------------------
# Low-level OXML helpers
# ----------------------------------------------------------------------
def set_shd(cell, color_hex: str):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), color_hex)
    tc_pr.append(shd)


def set_left_border_only(cell, color_hex: str = "1C4532", sz: str = "24"):
    tc_pr = cell._tc.get_or_add_tcPr()
    tcBorders = OxmlElement("w:tcBorders")
    left = OxmlElement("w:left")
    left.set(qn("w:val"), "single")
    left.set(qn("w:sz"), sz)
    left.set(qn("w:space"), "0")
    left.set(qn("w:color"), color_hex)
    tcBorders.append(left)
    for edge in ("top", "bottom", "right"):
        b = OxmlElement(f"w:{edge}")
        b.set(qn("w:val"), "none")
        tcBorders.append(b)
    tc_pr.append(tcBorders)


def set_cell_margins(cell, top=100, bottom=100, left=170, right=170):
    tc_pr = cell._tc.get_or_add_tcPr()
    mar = OxmlElement("w:tcMar")
    for side, val in (("top", top), ("bottom", bottom), ("left", left), ("right", right)):
        node = OxmlElement(f"w:{side}")
        node.set(qn("w:w"), str(val))
        node.set(qn("w:type"), "dxa")
        mar.append(node)
    tc_pr.append(mar)


def set_letter_spacing(run, twips: int):
    """Character spacing in twentieths of a point (20 = +1pt)."""
    rPr = run._r.get_or_add_rPr()
    spacing = OxmlElement("w:spacing")
    spacing.set(qn("w:val"), str(twips))
    rPr.append(spacing)


def set_row_height(row, dxa: int, rule: str = "atLeast"):
    tr_pr = row._tr.get_or_add_trPr()
    h = OxmlElement("w:trHeight")
    h.set(qn("w:val"), str(dxa))
    h.set(qn("w:hRule"), rule)
    tr_pr.append(h)


def paragraph_border(p, color_hex: str, sz: str = "6", space: str = "4", side: str = "bottom"):
    pPr = p._p.get_or_add_pPr()
    pBdr = OxmlElement("w:pBdr")
    edge = OxmlElement(f"w:{side}")
    edge.set(qn("w:val"), "single")
    edge.set(qn("w:sz"), sz)
    edge.set(qn("w:space"), space)
    edge.set(qn("w:color"), color_hex)
    pBdr.append(edge)
    pPr.append(pBdr)


def add_field_run(paragraph, field_code: str):
    """Insert a Word field (e.g. PAGE, NUMPAGES) as a run in `paragraph`."""
    run = paragraph.add_run()
    r = run._r
    rPr = OxmlElement("w:rPr")
    rFonts = OxmlElement("w:rFonts")
    rFonts.set(qn("w:ascii"), BODY_FONT)
    rPr.append(rFonts)
    r.append(rPr)

    fld_begin = OxmlElement("w:fldChar")
    fld_begin.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = f" {field_code} "
    fld_sep = OxmlElement("w:fldChar")
    fld_sep.set(qn("w:fldCharType"), "separate")
    fld_end = OxmlElement("w:fldChar")
    fld_end.set(qn("w:fldCharType"), "end")

    r.append(fld_begin)
    r2 = OxmlElement("w:r")
    r2.append(instr)
    paragraph._p.append(r2)
    r3 = OxmlElement("w:r")
    r3.append(fld_sep)
    paragraph._p.append(r3)
    r4 = OxmlElement("w:r")
    r4.append(fld_end)
    paragraph._p.append(r4)
    return run


def force_update_fields_on_open(doc: Document):
    """So the TOC (and any other field) refreshes automatically when opened."""
    settings = doc.settings.element
    upd = OxmlElement("w:updateFields")
    upd.set(qn("w:val"), "true")
    settings.append(upd)


def add_hyperlink(paragraph, url, text, color="1C4532", underline=True):
    part = paragraph.part
    try:
        from docx.opc.constants import RELATIONSHIP_TYPE
        r_id = part.relate_to(url, RELATIONSHIP_TYPE.HYPERLINK, is_external=True)
    except Exception:
        p_run = paragraph.add_run(f" {text} ({url})")
        p_run.font.color.rgb = RGBColor(0, 0, 255)
        p_run.font.underline = True
        return p_run

    hyperlink = OxmlElement('w:hyperlink')
    hyperlink.set(qn('r:id'), r_id)
    new_run = OxmlElement('w:r')
    rPr = OxmlElement('w:rPr')
    if color:
        c = OxmlElement('w:color')
        c.set(qn('w:val'), color)
        rPr.append(c)
    if underline:
        u = OxmlElement('w:u')
        u.set(qn('w:val'), 'single')
        rPr.append(u)
    new_run.append(rPr)
    text_node = OxmlElement('w:t')
    text_node.text = text
    new_run.append(text_node)
    hyperlink.append(new_run)
    paragraph._p.append(hyperlink)
    return hyperlink


# ----------------------------------------------------------------------
# Text runs / inline markdown (bold, italic, links, inline code)
# ----------------------------------------------------------------------
def add_run(p, text, *, size=11, bold=False, italic=False, color=TINTA,
            font=BODY_FONT, small_caps=False, spacing=None, mono=False):
    r = p.add_run(text)
    r.font.name = MONO_FONT if mono else font
    r.font.size = Pt(size)
    r.bold = bold
    r.italic = italic
    r.font.color.rgb = color
    if small_caps:
        r.font.small_caps = True
    if spacing:
        set_letter_spacing(r, spacing)
    return r


_INLINE_PATTERN = re.compile(
    r'(\*\*.*?\*\*|\*[^*]+?\*|`[^`]+?`|\[[^\]]+?\]\([^)]+?\))'
)


def add_markdown_runs(p, text, size=10.5, color=TINTA, font=BODY_FONT):
    """Parse bold, italic, inline-code and link markdown into styled runs."""
    for esc, lit in (("\\.", "."), ("\\&", "&"), ("\\-", "-"),
                     ("\\*", "*"), ("\\_", "_"), ("\\#", "#")):
        text = text.replace(esc, lit)

    parts = _INLINE_PATTERN.split(text)
    for part in parts:
        if not part:
            continue
        if part.startswith('**') and part.endswith('**'):
            add_run(p, part[2:-2], size=size, bold=True, color=color, font=font)
        elif part.startswith('`') and part.endswith('`') and len(part) > 1:
            add_run(p, part[1:-1], size=size - 0.5, color=VERDE2, mono=True)
        elif part.startswith('*') and part.endswith('*') and len(part) > 1:
            add_run(p, part[1:-1], size=size, italic=True, color=color, font=font)
        elif part.startswith('[') and ']' in part and part.endswith(')'):
            match = re.match(r'\[([^\]]+)\]\(([^)]+)\)', part)
            if match:
                link_text, url = match.groups()
                add_hyperlink(p, url, link_text, color="1C4532", underline=True)
            else:
                add_run(p, part, size=size, color=color, font=font)
        else:
            add_run(p, part, size=size, color=color, font=font)


# ----------------------------------------------------------------------
# Block-level paragraph builders
# ----------------------------------------------------------------------
def para(doc, text="", *, size=11, bold=False, italic=False, color=TINTA,
         align=WD_ALIGN_PARAGRAPH.LEFT, space_after=6, space_before=0, font=BODY_FONT):
    p = doc.add_paragraph()
    p.alignment = align
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.space_before = Pt(space_before)
    p.paragraph_format.line_spacing = 1.15
    if text:
        add_markdown_runs(p, text, size=size, color=color, font=font)
    return p


def kicker(doc, text, *, space_before=18, space_after=4):
    """Small-caps, letter-spaced label — used instead of shouty UPPERCASE."""
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(space_before)
    p.paragraph_format.space_after = Pt(space_after)
    add_run(p, text, size=10, bold=True, color=TERRA, font=HEAD_FONT,
            small_caps=True, spacing=16)
    return p


def brand_wordmark(doc, brand_name: str):
    """Small letterhead mark at the very top of the first page."""
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.space_before = Pt(0)
    add_run(p, brand_name, size=10.5, bold=True, color=VERDE, font=HEAD_FONT,
            small_caps=True, spacing=24)
    return p


def title_rule(doc):
    """Single accent rule under the main title — the one bold brand gesture."""
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.space_before = Pt(0)
    paragraph_border(p, "1C4532", sz="10", space="6", side="bottom")
    return p


def _ensure_style(doc, name, base="Normal", style_type=WD_STYLE_TYPE.PARAGRAPH):
    try:
        return doc.styles[name]
    except KeyError:
        style = doc.styles.add_style(name, style_type)
        style.base_style = doc.styles[base]
        return style


def section_title(doc, title, *, heading_style="Heading 1"):
    """A top-level ('#') section after the first: kicker + real Heading-1 style."""
    kicker(doc, title)
    p = doc.add_paragraph(style=heading_style)
    p.paragraph_format.space_after = Pt(10)
    for r in p.runs:
        r.text = ""
    add_run(p, title, size=18, bold=True, color=VERDE, font=HEAD_FONT)
    return p


def h2(doc, text):
    p = doc.add_paragraph(style="Heading 2")
    p.paragraph_format.space_before = Pt(16)
    p.paragraph_format.space_after = Pt(6)
    paragraph_border(p, BORDA, sz="4", space="6", side="bottom")
    add_run(p, text, size=13.5, bold=True, color=VERDE2, font=HEAD_FONT)
    return p


def h3(doc, text):
    p = doc.add_paragraph(style="Heading 3")
    p.paragraph_format.space_before = Pt(11)
    p.paragraph_format.space_after = Pt(4)
    add_run(p, "▪ ", size=11, bold=True, color=TERRA, font=HEAD_FONT)
    add_markdown_runs(p, text, size=12, color=VERDE, font=HEAD_FONT)
    for r in p.runs:
        r.bold = True
    return p


def h4(doc, text):
    p = para(doc, "", size=11, bold=True, color=TINTA, space_before=10, space_after=2)
    add_markdown_runs(p, text, size=11, color=TINTA, font=BODY_FONT)
    for r in p.runs:
        r.bold = True
    return p


def body(doc, text):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(7)
    p.paragraph_format.line_spacing = 1.2
    add_markdown_runs(p, text, size=10.5)
    return p


_BULLET_CHARS = ["—", "–", "·"]  # top level em-dash, then en-dash, then middle dot


def bullet(doc, text, level=0):
    p = doc.add_paragraph()
    p.paragraph_format.left_indent = Cm(0.55 + 0.55 * level)
    p.paragraph_format.first_line_indent = Cm(-0.4)
    p.paragraph_format.space_after = Pt(3)
    p.paragraph_format.line_spacing = 1.2
    glyph = _BULLET_CHARS[min(level, len(_BULLET_CHARS) - 1)]
    add_run(p, f"{glyph}  ", size=10.5, bold=False, color=TERRA)
    add_markdown_runs(p, text, size=10.5)
    return p


def hr(doc):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.space_before = Pt(4)
    paragraph_border(p, BORDA, sz="6", space="1", side="bottom")


def add_metadata_box(doc, lines, bg_color_hex=VERDE_LO, border_color_hex="1C4532"):
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_ALIGN_PARAGRAPH.LEFT
    cell = table.cell(0, 0)
    cell.width = Cm(16.2)
    set_shd(cell, bg_color_hex)
    set_left_border_only(cell, border_color_hex, "24")
    set_cell_margins(cell, top=140, bottom=140, left=220, right=180)

    p = cell.paragraphs[0]
    p.paragraph_format.space_after = Pt(3)
    p.paragraph_format.space_before = Pt(3)
    p.paragraph_format.line_spacing = 1.2
    for idx, text in enumerate(lines):
        if idx > 0:
            p = cell.add_paragraph()
            p.paragraph_format.space_after = Pt(3)
            p.paragraph_format.space_before = Pt(3)
            p.paragraph_format.line_spacing = 1.2
        add_markdown_runs(p, text, size=9.5, color=TINTA)

    p_after = doc.add_paragraph()
    p_after.paragraph_format.space_before = Pt(8)
    p_after.paragraph_format.space_after = Pt(0)


# ----------------------------------------------------------------------
# Tables, blockquotes, code fences
# ----------------------------------------------------------------------
def _split_table_row(line: str) -> list[str]:
    inner = line.strip().strip('|')
    return [cell.strip() for cell in inner.split('|')]


def process_table(doc, rows: list[str]):
    if not rows:
        return
    header_row = _split_table_row(rows[0])
    body_rows = []
    for r in rows[2:]:
        cells = _split_table_row(r)
        if any(c.strip() for c in cells):
            body_rows.append(cells)

    num_cols = len(header_row)
    table = doc.add_table(rows=1 + len(body_rows), cols=num_cols)
    table.alignment = WD_ALIGN_PARAGRAPH.LEFT
    table.autofit = True

    # Minimalist borders: only horizontal hairlines, no verticals.
    tbl = table._tbl
    tblPr = tbl.tblPr if tbl.tblPr is not None else OxmlElement("w:tblPr")
    borders = OxmlElement("w:tblBorders")
    spec = {
        "top": ("single", "8", "1C4532"),
        "bottom": ("single", "8", "1C4532"),
        "insideH": ("single", "4", BORDA),
        "left": ("none", "0", "FFFFFF"),
        "right": ("none", "0", "FFFFFF"),
        "insideV": ("none", "0", "FFFFFF"),
    }
    for border_name, (val, sz, color) in spec.items():
        element = OxmlElement(f"w:{border_name}")
        element.set(qn("w:val"), val)
        element.set(qn("w:sz"), sz)
        element.set(qn("w:space"), "0")
        element.set(qn("w:color"), color)
        borders.append(element)
    tblPr.append(borders)

    header_cells = table.rows[0].cells
    for i, cell_text in enumerate(header_row):
        cell = header_cells[i]
        set_cell_margins(cell)
        p = cell.paragraphs[0]
        p.paragraph_format.space_after = Pt(3)
        p.paragraph_format.space_before = Pt(3)
        add_run(p, cell_text, size=10, bold=True, color=VERDE, font=HEAD_FONT,
                small_caps=True, spacing=10)

    for r_idx, row_data in enumerate(body_rows):
        for c_idx, cell_text in enumerate(row_data):
            cell = table.rows[r_idx + 1].cells[c_idx]
            fill = CREME_FILL if r_idx % 2 == 0 else "FFFFFF"
            set_shd(cell, fill)
            set_cell_margins(cell)
            p = cell.paragraphs[0]
            p.paragraph_format.space_after = Pt(3)
            p.paragraph_format.space_before = Pt(3)
            add_markdown_runs(p, cell_text, size=10)

    p_after = doc.add_paragraph()
    p_after.paragraph_format.space_before = Pt(8)
    p_after.paragraph_format.space_after = Pt(0)


def process_blockquote(doc, lines: list[str]):
    cleaned = []
    for line in lines:
        if line.strip().startswith('>'):
            line = re.sub(r'^>\s?', '', line.strip())
        cleaned.append(line)
    text = ' '.join(cleaned)

    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_ALIGN_PARAGRAPH.LEFT
    cell = table.cell(0, 0)
    cell.width = Cm(16.2)
    set_shd(cell, TERRA_LO)
    set_left_border_only(cell, "C4622D", "24")
    set_cell_margins(cell, top=150, bottom=150, left=220, right=200)

    p = cell.paragraphs[0]
    p.paragraph_format.space_after = Pt(0)
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.line_spacing = 1.2
    add_markdown_runs(p, text, size=11, color=VERDE)
    for run in p.runs:
        run.italic = True

    p_after = doc.add_paragraph()
    p_after.paragraph_format.space_before = Pt(8)
    p_after.paragraph_format.space_after = Pt(0)


def process_code_block(doc, lines: list[str], language: str = ""):
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_ALIGN_PARAGRAPH.LEFT
    cell = table.cell(0, 0)
    cell.width = Cm(16.2)
    set_shd(cell, "F4F4F2")
    set_cell_margins(cell, top=120, bottom=120, left=200, right=200)

    tc_pr = cell._tc.get_or_add_tcPr()
    tcBorders = OxmlElement("w:tcBorders")
    for edge in ("top", "left", "bottom", "right"):
        b = OxmlElement(f"w:{edge}")
        b.set(qn("w:val"), "single")
        b.set(qn("w:sz"), "4")
        b.set(qn("w:space"), "0")
        b.set(qn("w:color"), BORDA)
        tcBorders.append(b)
    tc_pr.append(tcBorders)

    p = cell.paragraphs[0]
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.space_before = Pt(2)
    if language:
        add_run(p, language, size=8, italic=True, color=MEDIO, font=BODY_FONT,
                small_caps=True, spacing=10)
        p = cell.add_paragraph()
        p.paragraph_format.space_after = Pt(2)
        p.paragraph_format.space_before = Pt(0)

    code_text = '\n'.join(lines)
    run = p.add_run(code_text)
    run.font.name = MONO_FONT
    run.font.size = Pt(9)
    run.font.color.rgb = TINTA

    p_after = doc.add_paragraph()
    p_after.paragraph_format.space_before = Pt(8)
    p_after.paragraph_format.space_after = Pt(0)


def insert_toc(doc):
    """Insert an updatable Table of Contents field (levels 1–3)."""
    kicker(doc, "Sumário", space_before=8)
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(4)
    add_field_run(p, r'TOC \o "1-3" \h \z \u')
    note = doc.add_paragraph()
    add_run(note, "Clique com o botão direito sobre o sumário e escolha "
                  "\u201cAtualizar campo\u201d para atualizá-lo.",
            size=8.5, italic=True, color=CLARO)
    note.paragraph_format.space_after = Pt(4)
    hr(doc)


# ----------------------------------------------------------------------
# Document chrome: margins, header/footer, styles
# ----------------------------------------------------------------------
def setup_document_chrome(doc, brand_name: str, footer_text: str):
    for section in doc.sections:
        section.top_margin = Cm(2.3)
        section.bottom_margin = Cm(2.1)
        section.left_margin = Cm(2.5)
        section.right_margin = Cm(2.5)

        section.header.is_linked_to_previous = False
        hp = section.header.paragraphs[0]
        hp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        paragraph_border(hp, BORDA, sz="4", space="6", side="bottom")
        add_run(hp, brand_name, size=8.5, color=CLARO, font=HEAD_FONT,
                small_caps=True, spacing=14)

        section.footer.is_linked_to_previous = False
        fp = section.footer.paragraphs[0]
        fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
        add_run(fp, f"{footer_text}  ·  ", size=8.5, color=CLARO, font=BODY_FONT,
                small_caps=True, spacing=10)
        add_field_run(fp, "PAGE")
        add_run(fp, " / ", size=8.5, color=CLARO, font=BODY_FONT)
        add_field_run(fp, "NUMPAGES")

    style = doc.styles["Normal"]
    style.font.name = BODY_FONT
    style.font.size = Pt(10.5)
    style.font.color.rgb = TINTA

    # Retint the built-in Heading styles so navigation-pane / TOC entries
    # (which read these styles, not our manual runs) match the palette.
    heading_specs = {
        "Heading 1": (18, VERDE, True),
        "Heading 2": (13.5, VERDE2, True),
        "Heading 3": (12, VERDE, True),
    }
    for name, (size, color, bold) in heading_specs.items():
        try:
            hstyle = doc.styles[name]
            hstyle.font.name = HEAD_FONT
            hstyle.font.size = Pt(size)
            hstyle.font.color.rgb = color
            hstyle.font.bold = bold
            hstyle.paragraph_format.space_before = Pt(4)
            hstyle.paragraph_format.space_after = Pt(2)
        except KeyError:
            pass


def set_core_properties(doc, title: str, brand_name: str):
    props = doc.core_properties
    props.title = title
    props.author = brand_name
    props.subject = title


# ----------------------------------------------------------------------
# Main builder
# ----------------------------------------------------------------------
def build_from_markdown(
    md_path: Path,
    out_path: Path,
    *,
    brand_name: str = "Olivia",
    footer_text: str = "Confidencial",
    kicker_text: str | None = None,
    include_toc: bool | None = None,
) -> Path:
    """Render `md_path` (Markdown) into a branded .docx at `out_path`.

    include_toc=None -> auto (adds a TOC page when the doc has 3+ H2/H1
    sections after the title).
    """
    doc = Document()
    setup_document_chrome(doc, brand_name, footer_text)

    with open(md_path, "r", encoding="utf-8") as f:
        raw_lines = f.readlines()

    # --- Generic metadata-block extraction -------------------------------
    # Any run of consecutive "**Label:** value" lines directly under the H1
    # is treated as a letterhead metadata box (works for any label set,
    # not just a fixed vocabulary).
    processed_lines: list[tuple] = []
    metadata_lines: list[str] = []
    in_metadata_zone = False
    metadata_pattern = re.compile(r'^\s*\*\*[^*:\n]{1,40}:\*\*')

    for r_line in raw_lines:
        stripped = r_line.strip()
        if stripped.startswith("# ") or stripped.startswith("#**"):
            in_metadata_zone = True
            processed_lines.append((r_line, stripped))
            continue
        if in_metadata_zone:
            if not stripped:
                continue
            if metadata_pattern.match(stripped):
                metadata_lines.append(stripped)
            else:
                in_metadata_zone = False
                if metadata_lines:
                    processed_lines.append(("METADATA_BLOCK", metadata_lines))
                    metadata_lines = []
                processed_lines.append((r_line, stripped))
        else:
            processed_lines.append((r_line, stripped))
    if in_metadata_zone and metadata_lines:
        processed_lines.append(("METADATA_BLOCK", metadata_lines))

    # --- Tokenize: TABLE / BLOCKQUOTE / CODE / METADATA / NORMAL ---------
    tokens = []
    i = 0
    lines = processed_lines
    while i < len(lines):
        raw_line, line = lines[i]
        if isinstance(raw_line, str) and raw_line == "METADATA_BLOCK":
            tokens.append(("METADATA", line))
            i += 1
            continue

        if line.strip().startswith("```"):
            lang = line.strip()[3:].strip()
            code_lines = []
            i += 1
            while i < len(lines):
                _, next_line = lines[i]
                if next_line.strip().startswith("```"):
                    i += 1
                    break
                code_lines.append(next_line)
                i += 1
            tokens.append(("CODE", (code_lines, lang)))
            continue

        if line.strip().startswith(">"):
            bq_lines = []
            while i < len(lines) and lines[i][1].strip().startswith(">"):
                bq_lines.append(lines[i][1])
                i += 1
            tokens.append(("BLOCKQUOTE", bq_lines))
            continue

        if line.strip().startswith("|"):
            table_rows = []
            while i < len(lines) and lines[i][1].strip().startswith("|"):
                table_rows.append(lines[i][1])
                i += 1
            if len(table_rows) >= 2:
                tokens.append(("TABLE", table_rows))
            else:
                for row in table_rows:
                    tokens.append(("NORMAL", (row, row)))
            continue

        tokens.append(("NORMAL", (raw_line, line)))
        i += 1

    # --- Optional auto TOC decision --------------------------------------
    heading_count = sum(
        1 for t, p in tokens
        if t == "NORMAL" and p[1].startswith("#") and not p[1].startswith("####")
    )
    want_toc = include_toc if include_toc is not None else heading_count >= 4

    doc_title = "Documento"
    first_h1 = True
    toc_inserted = False

    for token_type, payload in tokens:
        if token_type == "METADATA":
            add_metadata_box(doc, payload)
            continue
        if token_type == "TABLE":
            process_table(doc, payload)
            continue
        if token_type == "BLOCKQUOTE":
            process_blockquote(doc, payload)
            continue
        if token_type == "CODE":
            code_lines, lang = payload
            process_code_block(doc, code_lines, lang)
            continue

        raw_line, line = payload
        if not line:
            continue

        if line == "---":
            hr(doc)
            continue

        if line.startswith("#"):
            level = len(line) - len(line.lstrip("#"))
            text = line.lstrip("#").strip()
            clean_text = re.sub(r"\*\*", "", text)
            clean_text = clean_text.replace("\\.", ".").replace("\\&", "&")

            if level == 1:
                if first_h1:
                    doc_title = clean_text
                    brand_wordmark(doc, brand_name)
                    if kicker_text:
                        kicker(doc, kicker_text, space_before=6)
                    p = doc.add_paragraph(style="Title")
                    for r in list(p.runs):
                        r.text = ""
                    p.paragraph_format.space_before = Pt(6)
                    p.paragraph_format.space_after = Pt(8)
                    add_run(p, clean_text, size=25, bold=True, color=VERDE, font=HEAD_FONT)
                    title_rule(doc)
                    first_h1 = False
                    if want_toc and not toc_inserted:
                        spacer = doc.add_paragraph()
                        spacer.paragraph_format.space_after = Pt(2)
                        insert_toc(doc)
                        toc_inserted = True
                else:
                    section_title(doc, clean_text)
            elif level == 2:
                h2(doc, clean_text)
            elif level == 3:
                h3(doc, clean_text)
            elif level == 4:
                h4(doc, clean_text)
            else:
                para(doc, clean_text, size=10.5, bold=True, color=TINTA,
                     space_before=8, space_after=2)
        elif line.startswith("* ") or line.startswith("- "):
            indent = len(raw_line) - len(raw_line.lstrip(" "))
            nest_level = indent // 2
            bullet(doc, line[2:].strip(), level=nest_level)
        else:
            body(doc, line)

    set_core_properties(doc, doc_title, brand_name)
    force_update_fields_on_open(doc)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    doc.save(str(out_path))
    return out_path


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python build_docx.py <input.md> [output.docx]")
        sys.exit(1)

    md_file = Path(sys.argv[1]).resolve()
    if not md_file.exists():
        print(f"Error: could not find markdown file at {md_file}")
        sys.exit(1)

    out_file = Path(sys.argv[2]).resolve() if len(sys.argv) > 2 else md_file.with_suffix(".docx")
    out = build_from_markdown(md_file, out_file)
    print(f"Saved DOCX: {out} ({out.stat().st_size} bytes)")