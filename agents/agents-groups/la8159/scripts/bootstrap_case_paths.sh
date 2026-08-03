#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GROUP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
AGENTS_ROOT="$(cd "$GROUP_ROOT/../.." && pwd)"
WORKSPACE_ROOT="$(cd "$AGENTS_ROOT/.." && pwd)"

INCIDENT_ROOT="${LA8159_INCIDENT_ROOT:-$WORKSPACE_ROOT/LA8159-incident}"
SHARED_ROOT="${LA8159_SHARED_ROOT:-$WORKSPACE_ROOT/services/_shared}"
SHARED_CASES_ROOT="${LA8159_SHARED_CASES_ROOT:-$SHARED_ROOT/cases}"
AWARENESS_ROOT="${LA8159_AWARENESS_ROOT:-$WORKSPACE_ROOT/awareness}"

SHARED_CASE_ROOT=""
VIOLATIONS_SOURCE_ROOT=""

for candidate in \
  "$SHARED_CASES_ROOT/la8159" \
  "$WORKSPACE_ROOT/_shared/cases/la8159" \
  "$INCIDENT_ROOT/la8159" \
  "$INCIDENT_ROOT"; do
  if [[ -d "$candidate" ]]; then
    SHARED_CASE_ROOT="$candidate"
    break
  fi
done

for candidate in \
  "$INCIDENT_ROOT/10_violations_json" \
  "$SHARED_CASES_ROOT/10_violations_json" \
  "$SHARED_CASES_ROOT/la8159/01-violations" \
  "$WORKSPACE_ROOT/_shared/cases/la8159/01-violations"; do
  if [[ -d "$candidate" ]]; then
    VIOLATIONS_SOURCE_ROOT="$candidate"
    break
  fi
done

if [[ -z "$SHARED_CASE_ROOT" ]]; then
  echo "[error] Could not find a shared LA8159 case root under $SHARED_CASES_ROOT or $WORKSPACE_ROOT/_shared/cases"
  exit 1
fi

if [[ -z "$VIOLATIONS_SOURCE_ROOT" ]]; then
  echo "[error] Could not find a violations corpus root under $INCIDENT_ROOT or $SHARED_CASES_ROOT"
  exit 1
fi

SHARED_VIOLATIONS_LINK="$SHARED_CASES_ROOT/10_violations_json"
GROUP_CASE_LINK="$GROUP_ROOT/source/la8159"
GROUP_VIOLATIONS_LINK="$GROUP_ROOT/source/10_violations_json"
AWARENESS_VIOLATIONS_LINK="$AWARENESS_ROOT/data/violations"

FORCE_LINKS="${LA8159_FORCE:-0}"
LINK_AWARENESS_WORKSPACE="${LA8159_LINK_AWARENESS_WORKSPACE:-0}"

safe_link() {
  local source_path="$1"
  local target_path="$2"
  local label="$3"

  if [[ -e "$target_path" && ! -L "$target_path" ]]; then
    if [[ "$FORCE_LINKS" == "1" ]]; then
      rm -rf "$target_path"
    else
      echo "[skip] $label: $target_path exists and is not a symlink."
      echo "       Set LA8159_FORCE=1 to replace it."
      return 0
    fi
  fi

  mkdir -p "$(dirname "$target_path")"

  # Prefer workspace-relative links so tracked symlinks stay portable
  # (PATHS.md: never output absolute local filesystem paths).
  local link_target="$source_path"
  if [[ "$source_path" == "$WORKSPACE_ROOT/"* ]] && command -v python3 >/dev/null 2>&1; then
    local target_dir
    target_dir="$(cd "$(dirname "$target_path")" && pwd)"
    link_target="$(python3 -c 'import os,sys;print(os.path.relpath(sys.argv[1],sys.argv[2]))' "$source_path" "$target_dir")"
  fi

  rm -f "$target_path"
  ln -s "$link_target" "$target_path"
  echo "[ok] $label -> $target_path"
}

if [[ ! -d "$VIOLATIONS_SOURCE_ROOT" ]]; then
  echo "[error] Missing source violations corpus: $VIOLATIONS_SOURCE_ROOT"
  echo "        Set LA8159_INCIDENT_ROOT or LA8159_SHARED_CASES_ROOT if your paths are different."
  exit 1
fi

mkdir -p "$SHARED_CASES_ROOT"
safe_link "$SHARED_CASE_ROOT" "$SHARED_CASES_ROOT/la8159" "shared case root"
safe_link "$VIOLATIONS_SOURCE_ROOT" "$SHARED_VIOLATIONS_LINK" "shared violations root"
safe_link "$SHARED_CASE_ROOT" "$GROUP_CASE_LINK" "group source case root"
safe_link "$SHARED_VIOLATIONS_LINK" "$GROUP_VIOLATIONS_LINK" "group source violations root"

if [[ "$LINK_AWARENESS_WORKSPACE" == "1" ]]; then
  safe_link "$SHARED_VIOLATIONS_LINK/validated" "$AWARENESS_VIOLATIONS_LINK" "awareness workspace violations"
fi

cat <<EOF

Canonical paths ready.

Recommended Awareness environment values:
  AWARENESS_SHARED_DIR=$SHARED_ROOT
  AWARENESS_LEGAL_ROUTER_ROOT=$GROUP_ROOT/source
  AWARENESS_VIOLATIONS_ROOT=$SHARED_VIOLATIONS_LINK/validated
  AWARENESS_LAW_LIBRARY_ROOT=$SHARED_CASES_ROOT/law_md

EOF
