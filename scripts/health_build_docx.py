"""Build branded DOCX from any Markdown resume or report.
Now supports tables, blockquotes, and fenced code blocks.
Style mirrors the clean minimal, green+terra palette.
"""
from __future__ import annotations

import re
import sys
import unicodedata
from pathlib import Path

from docx import Document
from docx.shared import Pt, RGBColor, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

VERDE = RGBColor(0x1C, 0x45, 0x32)
VERDE2 = RGBColor(0x2D, 0x6A, 0x4F)
TERRA = RGBColor(0xC4, 0x62, 0x2D)
OURO = RGBColor(0xB8, 0x86, 0x0B)
TINTA = RGBColor(0x1A, 0x18, 0x14)
MEDIO = RGBColor(0x6B, 0x66, 0x5D)
CLARO = RGBColor(0x9A, 0x90, 0x88)
PALHA = RGBColor(0xC8, 0xB9, 0x9A)
BORDA = "E5E2DC"
CREME_FILL = "FAF9F6"
VERDE_LO = "EDF2EE"
TERRA_LO = "F7EDE6"


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


def add_run(p, text, *, size=11, bold=False, italic=False, color=TINTA, font="Calibri"):
    r = p.add_run(text)
    r.font.name = font
    r.font.size = Pt(size)
    r.bold = bold
    r.italic = italic
    r.font.color.rgb = color
    return r


def add_markdown_runs(p, text, size=10.5, color=TINTA, font="Calibri"):
    """Parse bold, italic and link markdown formatting and add styled runs."""
    text = text.replace("\\.", ".")
    text = text.replace("\\&", "&")
    text = text.replace("\\-", "-")
    text = text.replace("\\*", "*")
    text = text.replace("\\_", "_")
    text = text.replace("\\#", "#")

    pattern = re.compile(r'(\*\*.*?\*\*|\*[^*]+?\*|\[[^\]]+?\]\([^)]+?\))')
    parts = pattern.split(text)

    for part in parts:
        if not part:
            continue
        if part.startswith('**') and part.endswith('**'):
            add_run(p, part[2:-2], size=size, bold=True, color=color, font=font)
        elif part.startswith('*') and part.endswith('*'):
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


def para(doc, text="", *, size=11, bold=False, italic=False, color=TINTA,
         align=WD_ALIGN_PARAGRAPH.LEFT, space_after=6, space_before=0, font="Calibri"):
    p = doc.add_paragraph()
    p.alignment = align
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.space_before = Pt(space_before)
    p.paragraph_format.line_spacing = 1.15
    if text:
        add_markdown_runs(p, text, size=size, color=color, font=font)
    return p


def kicker(doc, text):
    return para(doc, text, size=11, bold=True, color=TERRA, space_before=18, space_after=4,
                font="Cambria")


def section_title(doc, number, title):
    if number:
        kicker(doc, f"{number} · {title.upper()}")
    else:
        kicker(doc, title.upper())
    p = para(doc, title, size=18, bold=True, color=VERDE, space_after=10, font="Cambria")
    return p


def h2(doc, text):
    return para(doc, text, size=14, bold=True, color=VERDE2, space_before=14, space_after=6,
                font="Cambria")


def h3(doc, text):
    return para(doc, text, size=12.5, bold=True, color=VERDE, space_before=10, space_after=4,
                font="Cambria")


def body(doc, text):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(6)
    p.paragraph_format.line_spacing = 1.15
    add_markdown_runs(p, text, size=10.5)
    return p


def bullet(doc, text, level=0):
    try:
        p = doc.add_paragraph(style="List Bullet")
    except KeyError:
        p = doc.add_paragraph()
        p.paragraph_format.left_indent = Cm(0.5 + 0.5 * level)

    p.paragraph_format.left_indent = Cm(0.5 + 0.5 * level)
    p.paragraph_format.space_after = Pt(2.5)
    p.paragraph_format.line_spacing = 1.15
    add_markdown_runs(p, text, size=10.5)
    return p


def hr(doc):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.space_before = Pt(4)
    pPr = p._p.get_or_add_pPr()
    pBdr = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), "6")
    bottom.set(qn("w:space"), "1")
    bottom.set(qn("w:color"), BORDA)
    pBdr.append(bottom)
    pPr.append(pBdr)


def add_metadata_box(doc, lines, bg_color_hex=VERDE_LO, border_color_hex="1C4532"):
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_ALIGN_PARAGRAPH.LEFT
    cell = table.cell(0, 0)
    cell.width = Cm(16.2)

    set_shd(cell, bg_color_hex)
    set_left_border_only(cell, border_color_hex, "24")

    p = cell.paragraphs[0]
    p.paragraph_format.space_after = Pt(3)
    p.paragraph_format.space_before = Pt(3)
    p.paragraph_format.line_spacing = 1.15

    for idx, text in enumerate(lines):
        if idx > 0:
            p = cell.add_paragraph()
            p.paragraph_format.space_after = Pt(3)
            p.paragraph_format.space_before = Pt(3)
            p.paragraph_format.line_spacing = 1.15
        add_markdown_runs(p, text, size=9.5, color=TINTA)

    p_after = doc.add_paragraph()
    p_after.paragraph_format.space_before = Pt(8)
    p_after.paragraph_format.space_after = Pt(0)


# ----------------------------------------------------------------------
#  New elements: TABLE, BLOCKQUOTE, CODE FENCE
# ----------------------------------------------------------------------
def _split_table_row(line: str) -> list[str]:
    """Split a markdown table row like '| A | B | C |' into cell texts."""
    # Remove leading/trailing pipe, then split by '|'
    inner = line.strip().strip('|')
    return [cell.strip() for cell in inner.split('|')]


def process_table(doc, rows: list[str]):
    """Convert a list of markdown table rows into a docx table."""
    if not rows:
        return
    # The second row is the separator (e.g. |---|---|), we skip it
    header_row = _split_table_row(rows[0])
    # Body rows: skip separator (row index 1) and any further empty lines
    body_rows = []
    for r in rows[2:]:
        cells = _split_table_row(r)
        if any(c.strip() for c in cells):  # ignore completely empty rows
            body_rows.append(cells)

    num_cols = len(header_row)
    table = doc.add_table(rows=1 + len(body_rows), cols=num_cols)
    table.alignment = WD_ALIGN_PARAGRAPH.LEFT
    table.autofit = True

    # Style borders
    tbl = table._tbl
    tblPr = tbl.tblPr if tbl.tblPr is not None else OxmlElement("w:tblPr")
    borders = OxmlElement("w:tblBorders")
    for border_name in ("top", "left", "bottom", "right", "insideH", "insideV"):
        element = OxmlElement(f"w:{border_name}")
        element.set(qn("w:val"), "single")
        element.set(qn("w:sz"), "4")
        element.set(qn("w:space"), "0")
        element.set(qn("w:color"), BORDA)
        borders.append(element)
    tblPr.append(borders)

    # Header row formatting
    header_cells = table.rows[0].cells
    for i, cell_text in enumerate(header_row):
        cell = header_cells[i]
        set_shd(cell, "1C4532")  # VERDE background
        p = cell.paragraphs[0]
        p.paragraph_format.space_after = Pt(2)
        p.paragraph_format.space_before = Pt(2)
        # Remove default bold from Normal style, we set explicitly
        run = p.add_run(cell_text)
        run.font.name = "Calibri"
        run.font.size = Pt(10.5)
        run.bold = True
        run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)  # white text

    # Body rows
    for r_idx, row_data in enumerate(body_rows):
        for c_idx, cell_text in enumerate(row_data):
            cell = table.rows[r_idx + 1].cells[c_idx]
            # Alternating fill
            fill = CREME_FILL if r_idx % 2 == 0 else "FFFFFF"
            set_shd(cell, fill)
            p = cell.paragraphs[0]
            p.paragraph_format.space_after = Pt(2)
            p.paragraph_format.space_before = Pt(2)
            add_markdown_runs(p, cell_text, size=10.5)

    # Spacer after table
    p_after = doc.add_paragraph()
    p_after.paragraph_format.space_before = Pt(6)
    p_after.paragraph_format.space_after = Pt(0)


def process_blockquote(doc, lines: list[str]):
    """Render a blockquote as a styled paragraph with left border."""
    # Remove '>' prefix and join lines
    cleaned = []
    for line in lines:
        # Remove leading '>', optional space
        if line.strip().startswith('>'):
            line = re.sub(r'^>\s?', '', line.strip())
        cleaned.append(line)
    text = ' '.join(cleaned)

    # Build a single-cell table to get left border + background
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_ALIGN_PARAGRAPH.LEFT
    cell = table.cell(0, 0)
    cell.width = Cm(16.2)

    set_shd(cell, "F2F2F2")  # light grey
    set_left_border_only(cell, "888888", "24")

    p = cell.paragraphs[0]
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.space_before = Pt(4)
    p.paragraph_format.line_spacing = 1.15
    # Use italic for blockquote text, same size as body
    add_markdown_runs(p, text, size=10.5, color=TINTA)
    for run in p.runs:
        run.italic = True

    p_after = doc.add_paragraph()
    p_after.paragraph_format.space_before = Pt(6)
    p_after.paragraph_format.space_after = Pt(0)


def process_code_block(doc, lines: list[str], language: str = ""):
    """Render a fenced code block in a monospaced styled box."""
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_ALIGN_PARAGRAPH.LEFT
    cell = table.cell(0, 0)
    cell.width = Cm(16.2)

    set_shd(cell, "F4F4F4")
    # All borders (thin)
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
    # Language caption
    if language:
        caption = f"▌ {language}"
        add_run(p, caption, size=8, italic=True, color=MEDIO, font="Calibri")
        p = cell.add_paragraph()
        p.paragraph_format.space_after = Pt(2)
        p.paragraph_format.space_before = Pt(0)

    code_text = '\n'.join(lines)
    run = p.add_run(code_text)
    run.font.name = "Consolas"
    run.font.size = Pt(9)
    run.font.color.rgb = TINTA

    p_after = doc.add_paragraph()
    p_after.paragraph_format.space_before = Pt(8)
    p_after.paragraph_format.space_after = Pt(0)


# ----------------------------------------------------------------------
# Main builder
# ----------------------------------------------------------------------
def build_from_markdown(md_path: Path, out_path: Path):
    doc = Document()

    for section in doc.sections:
        section.top_margin = Cm(2.2)
        section.bottom_margin = Cm(2.0)
        section.left_margin = Cm(2.4)
        section.right_margin = Cm(2.4)

        section.header.is_linked_to_previous = False
        hp = section.header.paragraphs[0]
        hp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        hrun = hp.add_run("Olivia Ecosystem")
        hrun.font.name = "Calibri"
        hrun.font.size = Pt(8.5)
        hrun.font.color.rgb = CLARO

        section.footer.is_linked_to_previous = False
        fp = section.footer.paragraphs[0]
        fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
        frun = fp.add_run("PROJETO DE OTIMIZAÇÃO DE IA  ·  CONFIDENCIAL")
        frun.font.name = "Calibri"
        frun.font.size = Pt(8.5)
        frun.font.color.rgb = CLARO

    style = doc.styles["Normal"]
    style.font.name = "Calibri"
    style.font.size = Pt(10.5)
    style.font.color.rgb = TINTA

    with open(md_path, "r", encoding="utf-8") as f:
        raw_lines = f.readlines()

    # --- Metadata extraction (unchanged) ---
    processed_lines = []
    metadata_lines = []
    in_metadata_zone = False
    h1_found = False

    for r_line in raw_lines:
        stripped = r_line.strip()

        if stripped.startswith("# ") or stripped.startswith("#**"):
            h1_found = True
            in_metadata_zone = True
            processed_lines.append((r_line, stripped))
            continue

        if in_metadata_zone:
            if not stripped:
                continue
            is_metadata = re.match(
                r'^\s*(\*\*De:\*\*|\*\*Para:\*\*|\*\*Data:\*\*|\*\*saúde\b|SUS\b|\*\*cidadao\b)',
                stripped,
                re.IGNORECASE
            )
            if is_metadata:
                metadata_lines.append(stripped)
            else:
                in_metadata_zone = False
                if metadata_lines:
                    processed_lines.append(("METADATA_BLOCK", metadata_lines))
                processed_lines.append((r_line, stripped))
        else:
            processed_lines.append((r_line, stripped))

    if in_metadata_zone and metadata_lines:
        processed_lines.append(("METADATA_BLOCK", metadata_lines))

    # --- Stateful processing of new elements ---
    # We'll create a flat list of tokens: (type, payload) where type can be:
    # 'TABLE', 'BLOCKQUOTE', 'CODE', or None for normal line handling.
    tokens = []
    i = 0
    lines = processed_lines
    while i < len(lines):
        raw_line, line = lines[i]
        if isinstance(raw_line, str) and raw_line == "METADATA_BLOCK":
            tokens.append(("METADATA", line))
            i += 1
            continue

        # Check for code fence start
        if line.strip().startswith("```"):
            # Start of code block
            lang = line.strip()[3:].strip()
            code_lines = []
            i += 1
            while i < len(lines):
                raw_next, next_line = lines[i]
                if next_line.strip().startswith("```"):
                    # end of code block
                    i += 1
                    break
                code_lines.append(next_line)
                i += 1
            tokens.append(("CODE", (code_lines, lang)))
            continue

        # Check for blockquote (can be multiple consecutive lines)
        if line.strip().startswith(">"):
            bq_lines = []
            while i < len(lines) and lines[i][1].strip().startswith(">"):
                bq_lines.append(lines[i][1])
                i += 1
            tokens.append(("BLOCKQUOTE", bq_lines))
            continue

        # Check for table (line starts with '|')
        if line.strip().startswith("|"):
            table_rows = []
            while i < len(lines) and lines[i][1].strip().startswith("|"):
                table_rows.append(lines[i][1])
                i += 1
            # Must have at least 2 rows (header + separator) to be a valid table
            if len(table_rows) >= 2:
                tokens.append(("TABLE", table_rows))
            else:
                # Not a real table, fallback to normal text
                for row in table_rows:
                    tokens.append(("NORMAL", row))
            continue

        # Normal line
        tokens.append(("NORMAL", line))
        i += 1

    first_h1 = True
    for token_type, payload in tokens:
        if token_type == "METADATA":
            add_metadata_box(doc, payload, bg_color_hex=VERDE_LO, border_color_hex="1C4532")
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

        # --- Normal markdown line (original logic) ---
        line = payload
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
                    kicker_text = "RELATÓRIO DE PROJETO"
                    lower_name = md_path.name.lower()
                    if "resumo" in lower_name:
                        kicker_text = "DIAGNÓSTICO E PROPOSTA"
                    elif "mp1" in lower_name:
                        kicker_text = "MACROPROCESSO DE IA"

                    para(doc, kicker_text, size=11, bold=True, color=TERRA, space_after=4, font="Cambria")
                    hr(doc)
                    para(doc, clean_text, size=22, bold=True, color=VERDE, space_after=12, font="Cambria")
                    first_h1 = False
                else:
                    section_title(doc, "", clean_text)
            elif level == 2:
                h2(doc, clean_text)
            elif level == 3:
                h3(doc, clean_text)
            elif level == 4:
                para(doc, clean_text, size=11, bold=True, color=VERDE, space_before=10, space_after=2, font="Cambria")
            else:
                para(doc, clean_text, size=10.5, bold=True, color=TINTA, space_before=8, space_after=2)
        elif line.startswith("* ") or line.startswith("- "):
            # Original bullet handling (doesn't have raw_line here, so can't compute leading spaces easily)
            # We'll assume top-level bullets only; for nested bullets you'd need raw indentation.
            bullet(doc, line[2:].strip(), level=0)
        else:
            body(doc, line)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    doc.save(str(out_path))
    return out_path


if __name__ == "__main__":
    project_dir = Path(__file__).resolve().parent.parent

    if len(sys.argv) > 1:
        md_file = Path(sys.argv[1]).resolve()
        if not md_file.exists():
            print(f"Error: Could not find markdown file at {md_file}")
            sys.exit(1)
        out_file = md_file.with_suffix(".docx")
        out = build_from_markdown(md_file, out_file)
        print(f"Saved DOCX: {out} ({out.stat().st_size} bytes)")
    else:
        # Compile both target markdown reports from the project root
        targets = [
            "Resumo Executivo – Projeto de Otimização de IA.md",
            "MP1 — Redação e Revisão de Peças Processuais.md"
        ]
        compiled_any = False
        for target in targets:
            found_file = None
            def normalize(s):
                return unicodedata.normalize('NFC', re.sub(r'[\s\W_]+', '', s.lower()))

            for p in project_dir.glob("*.md"):
                if normalize(p.name) == normalize(target):
                    found_file = p
                    break

            if found_file and found_file.exists():
                out_file = found_file.with_suffix(".docx")
                out = build_from_markdown(found_file, out_file)
                print(f"Saved DOCX: {out} ({out.stat().st_size} bytes)")
                compiled_any = True
            else:
                print(f"Target file not found: {target}")

        if not compiled_any:
            print("No target reports compiled. Please pass a markdown file path as an argument.")
            sys.exit(1)