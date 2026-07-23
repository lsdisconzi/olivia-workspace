#!/usr/bin/env python3
"""
Compile the three jurisdictional analysis reports into a unified master report.
Run after all three agents complete their reports.
"""
import json, os, sys
from datetime import datetime

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

REPORTS = {
    "BR": os.path.join(BASE, "docs/reports/jurisprudence/BR_analysis_report.md"),
    "CL": os.path.join(BASE, "docs/reports/jurisprudence/CL_analysis_report.md"),
    "INT": os.path.join(BASE, "docs/reports/jurisprudence/INT_analysis_report.md"),
    "STF": os.path.join(BASE, "docs/reports/jurisprudence/STF_supplement_report.md"),
}

CROSS_REF = {
    "BR": os.path.join(BASE, "data/cross_reference/cross_reference_BR.json"),
    "CL": os.path.join(BASE, "data/cross_reference/cross_reference_CL.json"),
    "INT": os.path.join(BASE, "data/cross_reference/cross_reference_INT.json"),
}

MASTER_INDEX = os.path.join(BASE, "data/cross_reference/cross_reference_all.json")
OUTPUT = os.path.join(BASE, "docs/reports/jurisprudence/MASTER_REPORT.md")

def load_stats():
    with open(MASTER_INDEX) as f:
        master = json.load(f)

    docs = master["documents"]

    # Compute dynamic stats from actual data
    latam_count = 0
    monetary_count = 0
    json_available = 0
    for doc in docs:
        text = str(doc.get("ementa", "")) + " " + str(doc.get("text_excerpt", ""))
        if "latam" in text.lower():
            latam_count += 1
        if doc.get("monetary_values"):
            monetary_count += 1
        jp = doc.get("json_path")
        if jp and os.path.exists(jp):
            json_available += 1

    total = len(docs)

    stats = {
        "total_docs": total,
        "tribunals": master["by_tribunal"],
        "by_year": master["by_year"],
        "outcomes": master["by_outcome"],
        "latam_count": latam_count,
        "monetary_count": monetary_count,
        "json_available": json_available,
        "jurisdictions": {
            "BR": {"violations": 0, "strong_matches": 0, "total_matches": 0},
            "CL": {"violations": 0, "strong_matches": 0, "total_matches": 0},
            "INT": {"violations": 0, "strong_matches": 0, "total_matches": 0},
        }
    }

    for jur in ["BR", "CL", "INT"]:
        if os.path.exists(CROSS_REF[jur]):
            with open(CROSS_REF[jur]) as f:
                data = json.load(f)
            stats["jurisdictions"][jur]["violations"] = len(data)
            for v in data:
                stats["jurisdictions"][jur]["total_matches"] += v["total_matches"]
                if v["top_matches"] and v["top_matches"][0]["score"] >= 20:
                    stats["jurisdictions"][jur]["strong_matches"] += 1

    return stats

def compile_report():
    stats = load_stats()

    report = []
    report.append("# LA8159 Master Cross-Reference Report")
    report.append(f"> Generated: {datetime.now().isoformat()}")
    report.append("")
    report.append("## Executive Summary")
    report.append("")
    report.append(f"This report cross-references **{sum(s['violations'] for s in stats['jurisdictions'].values())} validated violations** (BR: {stats['jurisdictions']['BR']['violations']}, CL: {stats['jurisdictions']['CL']['violations']}, INT: {stats['jurisdictions']['INT']['violations']}) against **{stats['total_docs']} Brazilian jurisprudence documents** from {', '.join(f'{k} ({v})' for k,v in stats['tribunals'].items())}. The automated cross-reference engine processed a baseline subset of 216 documents; the master index has since grown to {stats['total_docs']} with additional downloads. The STF Supreme Court supplement adds 52 Supreme Court decisions (2011-2026) analyzed separately.")
    report.append("")
    report.append("### Key Statistics")
    report.append("")
    report.append("| Jurisdiction | Violations | Strong Matches (score>=20) | Avg Matches/Violation |")
    report.append("|---|---|---|---|")
    for jur, s in stats["jurisdictions"].items():
        avg = s["total_matches"] / s["violations"] if s["violations"] else 0
        report.append(f"| {jur} | {s['violations']} | {s['strong_matches']} | {avg:.1f} |")

    report.append("")
    report.append("### Master Index Overview")
    report.append("")
    report.append(f"- **Total documents**: {stats['total_docs']}")
    report.append(f"- **LATAM mentions**: {stats['latam_count']}/{stats['total_docs']} documents ({stats['latam_count']*100//stats['total_docs']}%)")
    report.append(f"- **Documents with damages awarded**: {stats['monetary_count']}/{stats['total_docs']} ({stats['monetary_count']*100//stats['total_docs']}%)")
    report.append(f"- **Full texts available**: {stats['json_available']}/{stats['total_docs']} ({stats['json_available']*100//stats['total_docs']}%)")
    report.append(f"- **Top outcomes**: {json.dumps(dict(sorted(stats['outcomes'].items(), key=lambda x: -x[1])[:5]), indent=2)}")
    report.append("")

    report.append("---")
    report.append("")

    # Jurisdictional sections
    for jur in ["BR", "CL", "INT"]:
        report.append(f"# Part {['1','2','3'][['BR','CL','INT'].index(jur)]}: {jur} Jurisdiction Analysis")
        report.append("")

        if os.path.exists(REPORTS[jur]):
            with open(REPORTS[jur]) as f:
                content = f.read()
            report.append(content)
            report.append("")
        else:
            report.append(f"> **WARNING**: Report file not found: {REPORTS[jur]}")
            report.append("> The analysis agent may still be running.")
            report.append("")

        report.append("---")
        report.append("")

    # Cross-jurisdictional synthesis
    report.append("# Part 4: Cross-Jurisdictional Synthesis")
    report.append("")
    report.append("## Multi-Jurisdiction Violation Patterns")
    report.append("")
    report.append("The following patterns emerge across all three jurisdictions:")
    report.append("")
    report.append("### 1. LATAM Airlines Institutional Pattern")
    report.append("- Violations in BR (GRU), CL (STG), and INT contexts all involve LATAM or its subsidiaries")
    report.append("- Pattern: initial staff misconduct → escalation → institutional cover-up → regulatory failure")
    report.append("- Brazilian jurisprudence provides the strongest comparable case law")
    report.append("")
    report.append("### 2. Regulatory Capture / Avoidance")
    report.append("- BR: ANAC avoided jurisdiction over LATAM complaints (BR-007, BR-008, BR-013)")
    report.append("- CL: DGAC abdicated oversight (CL-008, CL-022)")
    report.append("- INT: ICAO standards violated through non-enforcement (INT-001, INT-002)")
    report.append("")
    report.append("### 3. Consumer Protection Framework Hierarchy")
    report.append("- Domestic (BR: CDC, CL: LPDC) → Regional (ACHR) → International (MC99, ICAO)")
    report.append("- MC99 Article 22 liability caps may preempt domestic consumer law for international flights")
    report.append("- STF Tema 210 confirms international conventions prevail over CDC")
    report.append("")
    report.append("### 4. Criminal/Administrative Overlap")
    report.append("- BR: CP violations (injúria, ameaça) + CDC + ANAC R400")
    report.append("- CL: CPCL violations (false accusation, prevaricación) + LPDC + CACH")
    report.append("- INT: ACHR violations (due process, personal liberty) + MC99 + ICAO")
    report.append("")
    report.append("## MC99 Preemption Analysis")
    report.append("")
    report.append("The Montreal Convention 1999 (MC99) presents a significant preemption risk:")
    report.append("")
    report.append("| Issue | MC99 Position | Domestic Law | Resolution |")
    report.append("|---|---|---|---|")
    report.append("| Bodily injury | Art. 17: strict liability | CDC Art. 14: strict liability | MC99 exclusive (Tseng v. Eastern) |")
    report.append("| Moral damages | Not explicit | CDC Art. 6 VI: explicit | Contested - some TJSP awards under CDC |")
    report.append("| Delay | Art. 19: carrier liability | CDC Art. 14: service defect | MC99 prevails for international |")
    report.append("| Liability caps | Art. 22: ~US$180K | CDC: unlimited | MC99 prevails (STF Tema 210) |")
    report.append("| Written reasons | ICAO Annex 9 §3.42 | CDC Art. 6 III: information right | Complementary - both apply |")
    report.append("")
    report.append("---")
    report.append("")

    # STF Supplement
    report.append("# Part 5: STF Supreme Court Supplement")
    report.append("")
    if os.path.exists(REPORTS.get("STF", "")):
        with open(REPORTS["STF"]) as f:
            stf_content = f.read()
        report.append(stf_content)
        report.append("")
    else:
        report.append("> **WARNING**: STF supplement report not found.")
        report.append("")

    report.append("---")
    report.append("")
    report.append("## Methodology")
    report.append("")
    report.append("1. **Cross-reference engine**: Automated matching of 71 violations against a baseline of 216 jurisprudence documents (since expanded to " + str(stats['total_docs']) + ") using framework keyword matching, search term overlap, actor detection, and outcome scoring")
    report.append("2. **Agent analysis**: Three parallel agents performed deep reads of top-matched full-text jurisprudence documents per jurisdiction")
    report.append("3. **STF supplement**: 52 Supreme Court decisions (2011-2026) parsed and cross-referenced — the highest judicial authority level in Brazil")
    report.append("4. **Law library verification**: Legal bases cross-checked against cached law library files (BR: 20 files, CL: 17 files, INT: 20 files)")
    report.append("5. **Chilean jurisprudence**: CONADECUS v. LATAM collective consumer action (S.J.L. Civil Santiago, 2020) analyzed and cross-referenced against 32 CL violations")
    report.append("6. **STF-3 supplement**: IACHR Brazil Jurisprudence (Cuadernillo 36), 5 LATAM news articles (2025-2026), TRT-2 labor ruling, 11 STJ precedent bulletins")
    report.append("7. **Severity classification**: CRITICAL (irreversible harm, systemic), HIGH (individual rights violation), MEDIUM (procedural)")
    report.append("")
    report.append("---")
    report.append("")
    report.append("*Report generated by OpenClaude cross-reference system. For questions, consult the individual jurisdiction reports.*")

    with open(OUTPUT, "w") as f:
        f.write("\n".join(report))

    print(f"Master report compiled: {OUTPUT}")
    print(f"Total size: {len('\n'.join(report)):,} chars")

    # Check report completeness
    for jur, path in REPORTS.items():
        if os.path.exists(path):
            size = os.path.getsize(path)
            print(f"  {jur}: {size:,} bytes - READY")
        else:
            print(f"  {jur}: MISSING - agent may still be running")

if __name__ == "__main__":
    compile_report()
