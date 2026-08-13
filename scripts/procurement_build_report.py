#!/usr/bin/env python3
"""
Procurement Invoice Report Builder
----------------------------------
Reads the procurement OCR pipeline outputs for a project and produces:

  * <outputs>/procurement-report.md            — Markdown summary report
  * <outputs>/procurement-report.docx          — Branded DOCX (python-docx)
  * <outputs>/procurement-visualization.json   — Structured data for the UI cards

The DOCX renderer mirrors scripts/health_build_docx.py but uses the procurement
orange accent (#C4622D). Everything is computed from the pipeline's CSV / JSON
outputs (no LLM calls), so serve.py can run this on demand after a pipeline run.

Usage:
  python scripts/procurement_build_report.py --project review-changes
  python scripts/procurement_build_report.py --workspace <image_processing_workspace> --output-dir <dir>
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from datetime import datetime
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
PROJECTS_DIR = PROJECT_ROOT / "uploads" / "projects"

# ----------------------------------------------------------------------------
#  Parsing helpers
# ----------------------------------------------------------------------------
def _load_json(path):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def _parse_number(value):
    """Best-effort float parsing: '£609.62', '17.95', ' 8,20 ' → float|None."""
    if value is None:
        return None
    s = str(value).replace(",", ".").strip()
    s = re.sub(r"[^\d.\-]", "", s)
    if not s or s in (".", "-"):
        return None
    try:
        return float(s)
    except ValueError:
        return None


def _fmt_money(value, currency="£"):
    if value is None:
        return "—"
    cur = str(currency).strip()
    symbol = {"GBP": "£", "USD": "$", "EUR": "€", "BRL": "R$"}.get(cur.upper(), cur)
    if symbol.isalpha() and not symbol.startswith("£"):
        symbol += " "
    return f"{symbol}{value:,.2f}"


def _clean(header):
    """Strip the col_N_ prefix added by the pipeline's wide CSV."""
    return re.sub(r"^col_\d+_", "", header).strip()


# ----------------------------------------------------------------------------
#  Workspace discovery
# ----------------------------------------------------------------------------
def _find_workspace(project_id=None, workspace=None):
    if workspace:
        p = Path(workspace)
        if p.is_dir():
            return p
    if project_id:
        p = PROJECTS_DIR / str(project_id).strip("/") / "procurement" / "workspace" / "image_processing_workspace"
        if p.is_dir():
            return p
    return None


def _preferred_csv_dir(workspace):
    refined = workspace / "csv_output_refined"
    if refined.is_dir():
        return refined
    return workspace / "csv_output"


def _load_analyses(workspace):
    """Return {filename_stem_lower: analysis_dict}. Prefer refined outputs."""
    out = {}
    plain_dir = workspace / "analysis"
    refined_dir = workspace / "analysis_refined"
    if not plain_dir.is_dir():
        return out
    for p in sorted(plain_dir.glob("*_analysis.json")):
        stem = p.name[: -len("_analysis.json")].lower()
        cand = None
        if refined_dir.is_dir():
            r = refined_dir / f"{stem}_analysis_refined.json"
            if r.is_file():
                cand = r
        cand = cand or p
        data = _load_json(cand)
        if data:
            out[stem] = data
    return out


def _load_csv_rows(path):
    rows = []
    if not Path(path).is_file():
        return rows
    with open(path, "r", newline="", encoding="utf-8-sig") as fh:
        reader = csv.reader(fh)
        try:
            headers = next(reader)
        except StopIteration:
            return rows
        for raw in reader:
            rows.append(dict(zip(headers, raw)))
    return rows


def _parse_table_groups(headers):
    """Split the wide tables.csv header into column groups (col index resets)."""
    groups = []
    nums = []
    for h in headers:
        m = re.match(r"col_(\d+)_", h)
        nums.append(int(m.group(1)) if m else None)
    start = 0
    for i in range(1, len(nums)):
        prev, cur = nums[i - 1], nums[i]
        if cur is not None and (prev is None or cur <= prev):
            groups.append((start, i))
            start = i
    groups.append((start, len(headers)))
    return groups


_FIELD_KINDS = {
    "description": ("description", "item", "goods"),
    "code": ("code",),
    "qty": ("quantity", "qty"),
    "unit_price": ("unit price", "price"),
    "amount": ("amount", "total"),
    "weight": ("weight",),
}


def _group_fields(header_slice):
    """Map semantic → column index within one table group."""
    fields = {}
    for idx, h in enumerate(header_slice):
        hl = _clean(h).lower()
        for kind, keys in _FIELD_KINDS.items():
            if any(k in hl for k in keys):
                fields.setdefault(kind, idx)
    return fields


def _load_line_items(tables_rows, filename):
    """Extract the best line-item table for one filename from tables.csv rows."""
    file_rows = [r for r in tables_rows if (r.get("filename") or "") == filename]
    if not file_rows:
        return [], {}
    all_headers = list(file_rows[0].keys())
    groups = _parse_table_groups(all_headers)
    # Score each group by how many rows populate a description column.
    best = None
    best_score = -1
    best_fields = {}
    for g_start, g_end in groups:
        fields = _group_fields(all_headers[g_start:g_end])
        desc_idx = fields.get("description")
        if desc_idx is None:
            continue
        score = 0
        for r in file_rows:
            v = (r.get(all_headers[g_start + desc_idx]) or "").strip()
            if v:
                score += 1
        if score > best_score:
            best = (g_start, g_end)
            best_score = score
            best_fields = fields
    if best is None:
        return [], {}
    g_start, g_end = best
    items = []
    for r in file_rows:
        def val(kind):
            idx = best_fields.get(kind)
            if idx is None:
                return ""
            return (r.get(all_headers[g_start + idx]) or "").strip()
        row = {k: val(k) for k in best_fields}
        if any(row.values()):
            items.append(row)
    return items, best_fields


# ----------------------------------------------------------------------------
#  Invoice model
# ----------------------------------------------------------------------------
def _find_metric(analysis, name):
    for m in analysis.get("key_metrics", []):
        if (m.get("metric_name") or "").strip().lower() == name.lower():
            return m
    return None


def _extract_payment_terms(text):
    if not text:
        return ""
    patterns = [
        (re.compile(r"strictly\s+net\s+(\d+)", re.I), lambda m: f"Strictly Net {m.group(1)} days"),
        (re.compile(r"net\s+(\d+)\s+days?", re.I), lambda m: f"Net {m.group(1)} days"),
        (re.compile(r"cash on delivery|cash\s*/\s*delivery|\bcod\b", re.I), lambda m: "Cash on Delivery"),
        (re.compile(r"payment terms?\s*[:.\-]?\s*([a-z0-9 ]{2,40})", re.I),
         lambda m: " ".join(m.group(1).split()).title()[:40]),
    ]
    for pat, fmt in patterns:
        m = pat.search(text)
        if m:
            return fmt(m)
    return ""


def _extract_invoice_number(text):
    if not text:
        return ""
    pat = re.compile(r"invoice\s*(?:no\.?|number|#)?\s*[:#.\-]?\s*([A-Z]{1,6}[- ]?\d{3,10}[A-Z0-9\-/]*)", re.I)
    m = pat.search(text)
    if m:
        return m.group(1).replace(" ", "-")
    return ""


def _build_invoice(filename, analysis, tables_rows, store_text, store_status):
    meta = analysis.get("report_metadata", {}) if analysis else {}
    supplier = (meta.get("company_name") or "").strip() or "Unknown supplier"
    date = (meta.get("report_generation_date") or "").strip() or (meta.get("period_covered") or "").strip()
    confidence = _parse_number(meta.get("confidence_score"))

    def metric(name):
        m = _find_metric(analysis, name) if analysis else None
        if m:
            return _parse_number(m.get("value")), (m.get("unit") or "GBP").upper()
        return None, "GBP"

    total, currency = metric("Invoice Total")
    nett, _ = metric("Total Nett")
    vat, _ = metric("VAT")
    weight, weight_unit = metric("Total Weight")

    items, _fields = _load_line_items(tables_rows, filename)
    line_total = None
    amount_values = []
    for it in items:
        amt = _parse_number(it.get("amount"))
        if amt is not None:
            amount_values.append(amt)
    if amount_values:
        line_total = round(sum(amount_values), 2)

    payment_terms = _extract_payment_terms(store_text)
    invoice_number = _extract_invoice_number(store_text)

    if total is None and line_total is not None:
        total = line_total

    summary = ""
    if analysis:
        summary = str(analysis.get("content_summary") or "").strip()

    categories = list(analysis.get("financial_categories", [])) if analysis else []

    return {
        "filename": filename,
        "supplier": supplier,
        "invoice_number": invoice_number,
        "date": date,
        "total": total,
        "currency": currency,
        "nett": nett,
        "vat": vat,
        "weight": weight,
        "weight_unit": weight_unit,
        "payment_terms": payment_terms,
        "confidence": confidence,
        "line_total": line_total,
        "items": items,
        "summary": summary,
        "categories": categories,
        "status": store_status or ("processed" if analysis else "unknown"),
    }


# ----------------------------------------------------------------------------
#  Aggregation
# ----------------------------------------------------------------------------
def _aggregate(invoices):
    suppliers = {}
    for inv in invoices:
        s = suppliers.setdefault(inv["supplier"], {"name": inv["supplier"], "invoice_count": 0,
                                                   "total": None, "payment_terms": ""})
        s["invoice_count"] += 1
        if inv["total"] is not None:
            s["total"] = (s["total"] or 0.0) + inv["total"]
        if inv["payment_terms"] and not s["payment_terms"]:
            s["payment_terms"] = inv["payment_terms"]
    return list(suppliers.values())


# ----------------------------------------------------------------------------
#  Markdown report
# ----------------------------------------------------------------------------
def _md_line_items_table(inv):
    if not inv["items"]:
        return ""
    head = ["Code", "Description", "Qty", "Unit Price", "Amount", "Weight"]
    rows = ["| " + " | ".join(head) + " |",
            "|" + "---|" * len(head)]
    for it in inv["items"]:
        cells = [it.get("code", ""), it.get("description", ""), it.get("qty", ""),
                 it.get("unit_price", ""), it.get("amount", ""), it.get("weight", "")]
        rows.append("| " + " | ".join(c.replace("|", "/") if c else "—" for c in cells) + " |")
    return "\n".join(rows)


def _build_markdown(project_id, invoices, suppliers, summary, pipeline, generated_at):
    total_known = sum(s["total"] for s in suppliers if s["total"] is not None)
    missing = [inv for inv in invoices if inv["total"] is None]
    avg_ocr = pipeline.get("file_statistics", {}).get("avg_ocr_confidence")
    fs = pipeline.get("file_statistics", {})
    total_invoices = len(invoices)

    L = []
    L.append("# Procurement Invoice Summary Report")
    L.append("")
    L.append(f"> **Project:** {project_id or '—'}")
    L.append(f"> **Generated:** {generated_at}")
    L.append(f"> **Pipeline:** {fs.get('total_images', total_invoices)} invoices · "
             f"{len(suppliers)} suppliers · OCR {fs.get('successful_ocr', 0)}/{fs.get('total_images', total_invoices)} "
             + (f"· avg confidence {avg_ocr:.2f}%" if avg_ocr else ""))
    L.append("")
    L.append("---")
    L.append("")
    L.append("## 1. Executive Summary")
    L.append("")
    if invoices:
        names = ", ".join(sorted({s["name"] for s in suppliers}))
        L.append(f"This report summarises **{total_invoices} procurement invoices** processed by the Olivia OCR "
                 f"pipeline, originating from **{len(suppliers)} supplier(s)**: {names}. "
                 f"The invoices cover catering supplies, fresh produce and kitchen essentials.")
        L.append("")
    L.append("**Key figures**")
    L.append("")
    L.append("| Metric | Value |")
    L.append("|---|---|")
    L.append(f"| Invoices processed | {total_invoices} |")
    L.append(f"| Suppliers | {len(suppliers)} |")
    L.append(f"| Known invoice total | {_fmt_money(total_known)} |")
    L.append(f"| Invoices with full totals | {total_invoices - len(missing)} of {total_invoices} |")
    if avg_ocr:
        L.append(f"| Average OCR confidence | {avg_ocr:.2f}% |")
    L.append("")
    L.append("## 2. Supplier Overview")
    L.append("")
    L.append("| Supplier | Invoices | Total (known) | Payment terms |")
    L.append("|---|---|---|---|")
    for s in sorted(suppliers, key=lambda x: -(x["total"] or 0)):
        total_str = _fmt_money(s["total"]) if s["total"] is not None else "—"
        terms = s["payment_terms"] or "Not extracted"
        L.append(f"| {s['name']} | {s['invoice_count']} | {total_str} | {terms} |")
    L.append("")
    L.append("## 3. Detailed Invoice List")
    L.append("")
    for i, inv in enumerate(invoices, start=1):
        L.append(f"### 3.{i} {inv['supplier']}" + (f" — Invoice {inv['invoice_number']}" if inv["invoice_number"] else ""))
        L.append("")
        L.append(f"**File:** `{inv['filename']}`")
        L.append("")
        rows = [("Supplier", inv["supplier"])]
        if inv["date"]:
            rows.append(("Invoice date", inv["date"]))
        if inv["invoice_number"]:
            rows.append(("Invoice number", inv["invoice_number"]))
        if inv["nett"] is not None:
            rows.append(("Total nett", _fmt_money(inv["nett"], inv["currency"])))
        if inv["vat"] is not None:
            rows.append(("VAT", _fmt_money(inv["vat"], inv["currency"])))
        if inv["total"] is not None:
            rows.append(("Invoice total", _fmt_money(inv["total"], inv["currency"])))
        elif inv["line_total"] is not None:
            rows.append(("Partial total (line items)", _fmt_money(inv["line_total"], inv["currency"])))
        else:
            rows.append(("Invoice total", "Not extracted"))
        if inv["weight"] is not None:
            rows.append(("Total weight", f"{inv['weight']:g} {inv['weight_unit'] or 'kg'}"))
        if inv["payment_terms"]:
            rows.append(("Payment terms", inv["payment_terms"]))
        if inv["confidence"] is not None:
            rows.append(("Analysis confidence", f"{inv['confidence']:.2f}"))
        L.append("| Field | Value |")
        L.append("|---|---|")
        for k, v in rows:
            L.append(f"| {k} | {v} |")
        L.append("")
        if inv["summary"]:
            L.append(f"> {inv['summary']}")
            L.append("")
        if inv["items"]:
            L.append("**Line items**")
            L.append("")
            L.append(_md_line_items_table(inv))
            L.append("")
        else:
            L.append("*No line items were extracted for this invoice.*")
            L.append("")
    L.append("## 4. Observations & Data Quality")
    L.append("")
    L.append("| Metric | Value |")
    L.append("|---|---|")
    L.append(f"| Invoices processed | {total_invoices} |")
    if avg_ocr:
        L.append(f"| Average OCR confidence | {avg_ocr:.2f}% |")
    L.append(f"| Fully extracted invoice totals | {total_invoices - len(missing)} |")
    L.append(f"| Missing / incomplete totals | {len(missing)} |")
    terms_set = sorted({inv["payment_terms"] for inv in invoices if inv["payment_terms"]})
    if terms_set:
        L.append(f"| Payment terms observed | {'; '.join(terms_set)} |")
    L.append("")
    for inv in invoices:
        if inv["total"] is None and inv["line_total"] is None:
            L.append(f"- **{inv['supplier']}** (`{inv['filename']}`): monetary totals were not reliably "
                     f"extracted (OCR fragmentation / missing amount columns).")
    if not missing:
        L.append("- All invoice totals were extracted cleanly.")
    if len(invoices) > 1:
        recipients = {inv["filename"] for inv in invoices}
        L.append(f"- {len(invoices)} invoices processed in this batch.")
    L.append("")
    L.append("## 5. Recommendations")
    L.append("")
    L.append("- **Improve OCR reliability** — use higher-resolution images or manual validation for key monetary fields.")
    L.append("- **Automate total extraction** — when line-item amounts are present, sum them to derive invoice totals "
             "(as done for invoices with full metrics).")
    L.append("- **Flag missing totals** — implement a validation rule to alert when an invoice total is missing.")
    L.append("- **Consolidate supplier directories** — keep invoices grouped by supplier (e.g. "
             "`Invoices/CapitalWholesalers/`) for future processing.")
    L.append("")
    L.append(f"*Report generated from pipeline outputs on {generated_at[:10]} by Olivia Procurement.*")
    L.append("")
    return "\n".join(L)


# ----------------------------------------------------------------------------
#  Visualization JSON
# ----------------------------------------------------------------------------
def _build_visualization(project_id, invoices, suppliers, pipeline, generated_at):
    total_known = sum(s["total"] for s in suppliers if s["total"] is not None)
    fs = pipeline.get("file_statistics", {})
    categories = {}
    for inv in invoices:
        for cat in inv["categories"]:
            categories[cat] = categories.get(cat, 0) + 1
    return {
        "project_id": project_id,
        "generated_at": generated_at,
        "summary": {
            "invoice_count": len(invoices),
            "supplier_count": len(suppliers),
            "total_value": round(total_known, 2) if total_known is not None else 0,
            "total_value_known": _fmt_money(total_known) if total_known else "—",
            "avg_ocr_confidence": fs.get("avg_ocr_confidence"),
            "missing_totals": sum(1 for inv in invoices if inv["total"] is None),
        },
        "suppliers": [
            {
                "name": s["name"],
                "invoice_count": s["invoice_count"],
                "total_value": round(s["total"], 2) if s["total"] is not None else None,
                "total_value_known": _fmt_money(s["total"]) if s["total"] is not None else "—",
                "payment_terms": s["payment_terms"] or "",
            }
            for s in sorted(suppliers, key=lambda x: -(x["total"] or 0))
        ],
        "invoices": [
            {
                "filename": inv["filename"],
                "supplier": inv["supplier"],
                "invoice_number": inv["invoice_number"],
                "date": inv["date"],
                "total": inv["total"],
                "currency": inv["currency"],
                "payment_terms": inv["payment_terms"],
                "confidence": inv["confidence"],
                "status": inv["status"],
                "item_count": len(inv["items"]),
                "summary": inv["summary"][:300],
            }
            for inv in invoices
        ],
        "categories": categories,
    }


# ----------------------------------------------------------------------------
#  DOCX builder (adapted from scripts/health_build_docx.py, orange palette)
# ----------------------------------------------------------------------------
ORANGE = RGBColor = None  # placeholder, replaced below


def _import_docx():
    try:
        from docx import Document
        from docx.shared import Pt, RGBColor, Cm
        from docx.enum.text import WD_ALIGN_PARAGRAPH
        from docx.oxml.ns import qn
        from docx.oxml import OxmlElement
        return Document, Pt, RGBColor, Cm, WD_ALIGN_PARAGRAPH, qn, OxmlElement
    except ImportError:
        return None


def _build_docx(md_text, out_path):
    imp = _import_docx()
    if imp is None:
        return None
    Document, Pt, RGBColor, Cm, WD_ALIGN_PARAGRAPH, qn, OxmlElement = imp

    ORANGE = RGBColor(0xC4, 0x62, 0x2D)
    ORANGE_DK = RGBColor(0x9A, 0x4A, 0x1C)
    INK = RGBColor(0x1A, 0x18, 0x14)
    MEDIO = RGBColor(0x6B, 0x66, 0x5D)
    CLARO = RGBColor(0x9A, 0x90, 0x88)
    BORDA = "E5E2DC"
    ORANGE_LO = "F7EDE6"
    CREME_FILL = "FAF9F6"
    TINT = INK

    def set_shd(cell, color_hex):
        tc_pr = cell._tc.get_or_add_tcPr()
        shd = OxmlElement("w:shd")
        shd.set(qn("w:val"), "clear")
        shd.set(qn("w:color"), "auto")
        shd.set(qn("w:fill"), color_hex)
        tc_pr.append(shd)

    def set_left_border_only(cell, color_hex, sz="24"):
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

    def add_run(p, text, size=10.5, bold=False, italic=False, color=INK, font="Calibri"):
        r = p.add_run(text)
        r.font.name = font
        r.font.size = Pt(size)
        r.bold = bold
        r.italic = italic
        r.font.color.rgb = color
        return r

    def add_markdown_runs(p, text, size=10.5, color=INK, font="Calibri"):
        pattern = re.compile(r"(\*\*.*?\*\*|\*[^*]+?\*|\[[^\]]+?\]\([^)]+?\))")
        for part in pattern.split(text):
            if not part:
                continue
            if part.startswith("**") and part.endswith("**"):
                add_run(p, part[2:-2], size=size, bold=True, color=color, font=font)
            elif part.startswith("*") and part.endswith("*"):
                add_run(p, part[1:-1], size=size, italic=True, color=color, font=font)
            else:
                add_run(p, part, size=size, color=color, font=font)

    def para(doc, text="", *, size=10.5, bold=False, italic=False, color=INK,
             align=WD_ALIGN_PARAGRAPH.LEFT, space_after=6, space_before=0, font="Calibri"):
        p = doc.add_paragraph()
        p.alignment = align
        p.paragraph_format.space_after = Pt(space_after)
        p.paragraph_format.space_before = Pt(space_before)
        p.paragraph_format.line_spacing = 1.15
        if text:
            add_markdown_runs(p, text, size=size, color=color, font=font)
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

    def process_table(doc, rows):
        if len(rows) < 2:
            return
        header = [c.strip() for c in rows[0].strip().strip("|").split("|")]
        body = []
        for r in rows[2:]:
            cells = [c.strip() for c in r.strip().strip("|").split("|")]
            if any(cells):
                body.append(cells)
        n_cols = len(header)
        table = doc.add_table(rows=1 + len(body), cols=max(n_cols, 1))
        table.alignment = WD_ALIGN_PARAGRAPH.LEFT
        table.autofit = True
        tblPr = table._tbl.tblPr
        borders = OxmlElement("w:tblBorders")
        for name in ("top", "left", "bottom", "right", "insideH", "insideV"):
            el = OxmlElement(f"w:{name}")
            el.set(qn("w:val"), "single")
            el.set(qn("w:sz"), "4")
            el.set(qn("w:space"), "0")
            el.set(qn("w:color"), BORDA)
            borders.append(el)
        tblPr.append(borders)
        for i, text in enumerate(header):
            cell = table.rows[0].cells[i]
            set_shd(cell, "C4622D")
            p = cell.paragraphs[0]
            p.paragraph_format.space_after = Pt(2)
            p.paragraph_format.space_before = Pt(2)
            add_run(p, text, size=10, bold=True, color=RGBColor(0xFF, 0xFF, 0xFF))
        for r_idx, row in enumerate(body):
            for c_idx, text in enumerate(row[:n_cols]):
                cell = table.rows[r_idx + 1].cells[c_idx]
                set_shd(cell, CREME_FILL if r_idx % 2 == 0 else "FFFFFF")
                p = cell.paragraphs[0]
                p.paragraph_format.space_after = Pt(2)
                p.paragraph_format.space_before = Pt(2)
                add_markdown_runs(p, text, size=10)
        doc.add_paragraph()

    def process_blockquote(doc, lines):
        cleaned = []
        for line in lines:
            line = re.sub(r"^>\s?", "", line.strip())
            if line:
                cleaned.append(line)
        table = doc.add_table(rows=1, cols=1)
        cell = table.cell(0, 0)
        cell.width = Cm(16.2)
        set_shd(cell, ORANGE_LO)
        set_left_border_only(cell, "C4622D", "24")
        p = cell.paragraphs[0]
        p.paragraph_format.space_after = Pt(3)
        p.paragraph_format.space_before = Pt(3)
        p.paragraph_format.line_spacing = 1.15
        add_markdown_runs(p, " ".join(cleaned), size=10.5, color=MEDIO)
        for run in p.runs:
            run.italic = True
        doc.add_paragraph()

    doc = Document()
    for section in doc.sections:
        section.top_margin = Cm(2.2)
        section.bottom_margin = Cm(2.0)
        section.left_margin = Cm(2.4)
        section.right_margin = Cm(2.4)
        section.header.is_linked_to_previous = False
        hp = section.header.paragraphs[0]
        hp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        add_run(hp, "Olivia Ecosystem", size=8.5, color=CLARO)
        section.footer.is_linked_to_previous = False
        fp = section.footer.paragraphs[0]
        fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
        add_run(fp, "OLIVIA WORKSPACE  ·  PROCUREMENT  ·  CONFIDENCIAL", size=8.5, color=CLARO)

    style = doc.styles["Normal"]
    style.font.name = "Calibri"
    style.font.size = Pt(10.5)
    style.font.color.rgb = INK

    lines = [ln.rstrip("\n") for ln in md_text.splitlines()]
    i = 0
    first_h1 = True
    while i < len(lines):
        line = lines[i].strip()
        if not line:
            i += 1
            continue
        if line == "---":
            hr(doc)
            i += 1
            continue
        if line.startswith("```"):
            i += 1
            while i < len(lines) and not lines[i].strip().startswith("```"):
                i += 1
            i += 1
            continue
        if line.startswith(">"):
            bq = []
            while i < len(lines) and lines[i].strip().startswith(">"):
                bq.append(lines[i])
                i += 1
            process_blockquote(doc, bq)
            continue
        if line.startswith("|"):
            rows = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                rows.append(lines[i])
                i += 1
            process_table(doc, rows)
            continue
        if line.startswith("#"):
            level = len(line) - len(line.lstrip("#"))
            text = re.sub(r"\*\*", "", line.lstrip("#").strip())
            if level == 1:
                if first_h1:
                    para(doc, "PROCUREMENT INVOICE REPORT", size=11, bold=True, color=ORANGE,
                         space_after=4, font="Cambria")
                    hr(doc)
                    para(doc, text, size=22, bold=True, color=ORANGE_DK, space_after=12, font="Cambria")
                    first_h1 = False
                else:
                    para(doc, text, size=16, bold=True, color=ORANGE_DK, space_before=14, space_after=8, font="Cambria")
            elif level == 2:
                para(doc, text, size=13.5, bold=True, color=ORANGE, space_before=14, space_after=6, font="Cambria")
            elif level == 3:
                para(doc, text, size=11.5, bold=True, color=TINT, space_before=10, space_after=4, font="Cambria")
            else:
                para(doc, text, size=10.5, bold=True, color=TINT, space_before=8, space_after=2)
            i += 1
            continue
        if line.startswith("- ") or line.startswith("* "):
            bullet_lines = []
            while i < len(lines) and (lines[i].strip().startswith("- ") or lines[i].strip().startswith("* ")):
                bullet_lines.append(lines[i].strip()[2:])
                i += 1
            for bt in bullet_lines:
                try:
                    p = doc.add_paragraph(style="List Bullet")
                except KeyError:
                    p = doc.add_paragraph()
                p.paragraph_format.left_indent = Cm(0.5)
                p.paragraph_format.space_after = Pt(2.5)
                p.paragraph_format.line_spacing = 1.15
                add_markdown_runs(p, bt, size=10.5)
            continue
        para(doc, line)
        i += 1

    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    doc.save(str(out_path))
    return out_path


# ----------------------------------------------------------------------------
#  Main entry
# ----------------------------------------------------------------------------
def build_report(project_id=None, workspace=None, output_dir=None, build_docx=True):
    """Generate the report files for a project. Returns a summary dict."""
    ws = _find_workspace(project_id, workspace)
    if ws is None:
        raise FileNotFoundError(
            f"No procurement pipeline workspace found (project={project_id!r}, workspace={workspace!r})"
        )

    generated_at = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
    pipeline = _load_json(ws / "pipeline_summary.json")
    tables_rows = _load_csv_rows(_preferred_csv_dir(ws) / "tables.csv")
    analyses = _load_analyses(ws)

    store = {}
    if project_id:
        store = _load_json(PROJECTS_DIR / project_id / "procurement" / "procurement_store.json")
    store_text = {}
    store_status = {}
    for d in store.get("documents", []):
        fname = d.get("filename") or ""
        if fname:
            store_text[fname] = str(d.get("text") or "")
            store_status[fname] = d.get("status") or "unknown"

    invoices = []
    seen = set()
    # Prefer store documents order, then analysis files.
    fnames = [d.get("filename") for d in store.get("documents", []) if d.get("filename")]
    for fname in fnames:
        stem = Path(fname).stem.lower()
        analysis = analyses.get(stem)
        if analysis is None:
            continue
        invoices.append(_build_invoice(fname, analysis, tables_rows,
                                       store_text.get(fname), store_status.get(fname)))
        seen.add(stem)
    for stem, analysis in analyses.items():
        if stem in seen:
            continue
        # Recover the display filename from the store or the analysis metadata.
        fname = None
        for d in store.get("documents", []):
            if Path(d.get("filename", "")).stem.lower() == stem:
                fname = d["filename"]
                break
        if fname is None:
            mf = (analysis.get("llm_analysis_metadata") or {}).get("original_filename")
            fname = mf or stem
        invoices.append(_build_invoice(fname, analysis, tables_rows,
                                       store_text.get(fname), store_status.get(fname)))

    suppliers = _aggregate(invoices)
    md = _build_markdown(project_id, invoices, suppliers, {}, pipeline, generated_at)
    viz = _build_visualization(project_id, invoices, suppliers, pipeline, generated_at)

    out_dir = Path(output_dir) if output_dir else (PROJECTS_DIR / project_id / "outputs")
    out_dir.mkdir(parents=True, exist_ok=True)
    md_path = out_dir / "procurement-report.md"
    viz_path = out_dir / "procurement-visualization.json"
    md_path.write_text(md, encoding="utf-8")
    viz_path.write_text(json.dumps(viz, ensure_ascii=False, indent=2), encoding="utf-8")

    docx_path = None
    if build_docx:
        try:
            docx_path = _build_docx(md, out_dir / "procurement-report.docx")
        except Exception as exc:  # python-docx failures should not break the report
            print(f"[Procurement] DOCX build skipped: {exc}", file=sys.stderr)

    return {
        "project_id": project_id,
        "workspace": str(ws),
        "markdown": str(md_path),
        "visualization": str(viz_path),
        "docx": str(docx_path) if docx_path else None,
        "invoice_count": len(invoices),
        "supplier_count": len(suppliers),
    }


def main(argv=None):
    ap = argparse.ArgumentParser(description="Build procurement report + visualization from pipeline outputs.")
    ap.add_argument("--project", help="project_id under uploads/projects/")
    ap.add_argument("--workspace", help="path to image_processing_workspace (overrides --project discovery)")
    ap.add_argument("--output-dir", help="directory for report files (default: <project>/outputs)")
    ap.add_argument("--md-only", action="store_true", help="skip DOCX generation")
    args = ap.parse_args(argv)

    if not args.project and not args.workspace:
        ap.error("Provide --project or --workspace")
    try:
        result = build_report(args.project, args.workspace, args.output_dir, build_docx=not args.md_only)
    except FileNotFoundError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1
    print(f"[Procurement] report: {result['markdown']} "
          f"({result['invoice_count']} invoices, {result['supplier_count']} suppliers)")
    print(f"[Procurement] visualization: {result['visualization']}")
    if result["docx"]:
        print(f"[Procurement] docx: {result['docx']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
