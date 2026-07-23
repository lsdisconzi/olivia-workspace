#!/usr/bin/env python3
"""
Generate a JSON index of skills from the repository's agents/skills folder
and write it into the given project's studio_files frontend JS folder so the
UI can load skills when the API is not available (e.g., in previews).

Usage: python3 scripts/generate_skill_index.py --project paisdepe
"""
import argparse
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
AGENTS_SKILLS = ROOT / 'agents' / 'skills'

def skill_id_from_filename(name: str) -> str:
    # Strip extensions and normalize to simple slug. Keep folders if present.
    base = name
    if base.endswith('.skill.md'):
        base = base[:-9]
    base = base.strip()
    # Normalize: lower, replace spaces with '-', keep / . - _ characters
    slug = ''.join((c.lower() if (c.isalnum() or c in './-_') else '-') for c in base)
    # collapse multiple dashes
    while '--' in slug:
        slug = slug.replace('--', '-')
    return slug


def discover_skills():
    out = []
    if not AGENTS_SKILLS.exists():
        return out
    for p in sorted(AGENTS_SKILLS.rglob('*.skill.md')):
        rel = p.relative_to(AGENTS_SKILLS)
        # form skill id from path (directories + basename)
        parts = list(rel.parts)
        # remove .skill.md from last
        last = parts[-1]
        last = last[:-9]
        parts[-1] = last
        skill = '/'.join(parts)
        skill = skill_id_from_filename(skill)
        out.append(skill)
    return sorted(list(dict.fromkeys(out)))


def write_index(project=None):
    skills = discover_skills()
    if not skills:
        print('No skills found under', AGENTS_SKILLS)
        return 1
    # Default: write a workspace-level index useful to the Studio UI
    if project:
        target = ROOT / 'uploads' / 'projects' / project / 'studio_files' / 'frontend' / 'js'
    else:
        target = ROOT / 'frontend' / 'js'
    target.mkdir(parents=True, exist_ok=True)
    outfile = target / 'skill-index.json'
    with outfile.open('w', encoding='utf-8') as f:
        json.dump({'skills': skills}, f, indent=2, ensure_ascii=False)
    print('Wrote', outfile)
    return 0


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--project', required=False, help='optional project folder under uploads/projects (e.g., paisdepe)')
    args = parser.parse_args()
    raise SystemExit(write_index(args.project))
