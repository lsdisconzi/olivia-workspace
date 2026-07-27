# LA8159 Source Paths

> Canonical reference for the source paths used by LA8159 agents.

## Overview

The `source/` directory holds the LA8159 case corpus, the validated violations corpus, law caches, and the personnel registry. The core case tree is mounted through a symlink so the repo stays lightweight and portable.

## Directory inventory

| Path | Purpose |
|------|---------|
| `source/la8159` | Full incident case folder (symlink → `_shared/cases/la8159`): transcripts, evidence, emails, audio/video, speaker profiles, and analytical narratives. |
| `source/la8159/01-violations` | Canonical violations corpus root used by routing and grounding workflows. Contains `index.json` and `_json/` with jurisdiction-specific violation files. |
| `source/la8159/04-law` | Law caches organized by jurisdiction: `BR/` (Brazil), `CL/` (Chile), `INT/` (International). Contains Markdown statute files with verification annotations. |
| `source/personnel/` | Personnel registry with dossiers, templates, and `personnel.json` routing table. |

## Symlink inventory

| Path | Target | Purpose |
|------|--------|---------|
| `source/la8159` | `../../../../_shared/cases/la8159` | Full incident case folder. |

> **Note:** The deprecated `source/10_violations_json` symlink has been removed. Violations now live at `source/la8159/01-violations/`.
> The deprecated `source/BR/`, `source/CL/`, `source/INT/`, `source/meta/` directories have been consolidated into `source/la8159/04-law/`.

## How agents should use these paths

- Violation IDs such as `BR-001`, `CL-014`, or `INT-008` should resolve through the routing table in `mapping.json` and the corpus under `source/la8159/01-violations/`.
- Evidence IDs such as `I-002_05` should be resolved from `source/la8159/02-transcripts/` or `source/la8159/03-evidence/`.
- Law caches should be read from `source/la8159/04-law/<jurisdiction>/`.
- Personnel dossiers should be read from `source/personnel/`.

## Symlink management

- The canonical bootstrap script is `scripts/bootstrap_case_paths.sh`.
- If the symlinks are missing or broken, re-run the script with `LA8159_FORCE=1` to recreate them.
- The script respects the following environment variables:
  - `LA8159_INCIDENT_ROOT`
  - `LA8159_SHARED_ROOT`
  - `LA8159_SHARED_CASES_ROOT`

## Recommended environment values for downstream tools

```bash
AWARENESS_SHARED_DIR=$LA8159_SHARED_ROOT
AWARENESS_LEGAL_ROUTER_ROOT=$GROUP_ROOT/source
AWARENESS_VIOLATIONS_ROOT=$LA8159_SHARED_CASES_ROOT/la8159/01-violations
AWARENESS_LAW_LIBRARY_ROOT=$LA8159_SHARED_CASES_ROOT/la8159/04-law
```

## Path discipline

When generating output that references evidence, always use relative paths from `source/` such as:

- `source/la8159/03-evidence/I-002/...`
- `source/la8159/01-violations/...`
- `source/la8159/04-law/BR/...`

Never output absolute local filesystem paths.
