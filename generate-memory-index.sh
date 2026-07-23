#!/usr/bin/env bash
# generate-memory-index.sh
# Usage: ./generate-memory-index.sh [target_directory]
# Defaults to '_shared/docs/memory'.
#
# Scans target_dir for markdown files (excluding hidden files and the index
# itself) and writes MEMORY_INDEX.md with a hierarchical listing. Each entry
# uses the `name` field from YAML frontmatter (or first # heading, or filename
# minus extension) with the `description` field appended after an em dash.

set -euo pipefail

TARGET_DIR="${1:-_shared/docs/memory}"

if [ ! -d "$TARGET_DIR" ]; then
    echo "Error: directory '$TARGET_DIR' does not exist." >&2
    exit 1
fi

# Resolve to real path (follow symlinks)
cd "$TARGET_DIR"
REAL_DIR="$(pwd -P)"
OUTPUT_FILE="$REAL_DIR/MEMORY_INDEX.md"

# Extract fields from YAML frontmatter.
# Expects: file with optional --- delimited frontmatter containing name: and description:.
# Returns "name||description" — fields are empty strings if not found.
extract_meta() {
    local file="$1"
    local name=""
    local desc=""
    local in_frontmatter=false
    while IFS= read -r line; do
        # Toggle frontmatter state on --- delimiters
        if [[ "$line" == "---" ]]; then
            $in_frontmatter && in_frontmatter=false || in_frontmatter=true
            # After closing frontmatter, stop scanning metadata
            $in_frontmatter || break
            continue
        fi
        $in_frontmatter || break   # not in frontmatter → stop
        [[ -z "$line" ]] && continue

        # Extract name
        if [[ -z "$name" && "$line" =~ ^name:[[:space:]]*(.*)$ ]]; then
            name="${BASH_REMATCH[1]}"
            continue
        fi
        # Extract description
        if [[ -z "$desc" && "$line" =~ ^description:[[:space:]]*(.*)$ ]]; then
            desc="${BASH_REMATCH[1]}"
            continue
        fi
    done < "$file"
    echo "${name}||${desc}"
}

# Extract first # heading (fallback when name not in frontmatter).
extract_heading() {
    local file="$1"
    local title=""
    local in_frontmatter=false
    while IFS= read -r line; do
        if [[ "$line" == "---" ]]; then
            $in_frontmatter && in_frontmatter=false || in_frontmatter=true
            continue
        fi
        $in_frontmatter && continue
        [[ -z "$line" ]] && continue
        if [[ "$line" =~ ^#[[:space:]]+(.*)$ ]]; then
            title="${BASH_REMATCH[1]}"
            break
        fi
    done < "$file"
    echo "$title"
}

# Count path separators (depth)
depth_of() {
    local path="$1"
    local stripped="${path##/}"
    if [[ "$stripped" != */* ]]; then
        echo 0
        return
    fi
    echo "$stripped" | grep -o '/' | wc -l | tr -d ' '
}

# ── Write header ────────────────────────────────────────────────────────────
header="# Memory Index"
printf '%s\n\n' "$header" > "$OUTPUT_FILE"

# ── Scan files and build index ──────────────────────────────────────────────
file_count=0
prev_dir=""

while IFS= read -r -d '' filepath; do
    # Strip leading ./
    relpath="${filepath#./}"
    dirpath=$(dirname "$relpath")
    [[ "$dirpath" == "." ]] && dirpath=""

    # Heading when entering a new subdirectory
    if [[ -n "$dirpath" && "$dirpath" != "$prev_dir" ]]; then
        depth=$(depth_of "$dirpath")
        heading_level=$(( depth + 2 ))   # root=H2, one-level=H3, etc.
        heading_markers=$(printf '#%.0s' $(seq 1 $heading_level))
        printf '%*s%s %s\n\n' $((depth * 2)) '' "$heading_markers" "$dirpath" >> "$OUTPUT_FILE"
        prev_dir="$dirpath"
    fi

    depth=$(depth_of "$relpath")
    indent=$(printf '%*s' $((depth * 2)) '')
    base=$(basename "$relpath")

    # Extract title and description
    title=""
    desc=""
    if [[ "$filepath" == *.md ]]; then
        meta=$(extract_meta "$filepath")
        title="${meta%%||*}"
        desc="${meta##*||}"
    fi

    # Fallback: use first # heading
    if [[ -z "$title" ]]; then
        title=$(extract_heading "$filepath")
    fi

    # Fallback: use filename minus extension
    if [[ -z "$title" ]]; then
        title="${base%.*}"
    fi

    if [[ -n "$desc" ]]; then
        printf '%s- [%s](%s) — %s\n' "$indent" "$title" "$relpath" "$desc" >> "$OUTPUT_FILE"
    else
        printf '%s- [%s](%s)\n' "$indent" "$title" "$relpath" >> "$OUTPUT_FILE"
    fi
    file_count=$(( file_count + 1 ))

done < <(find . -type f \( ! -name '.*' -a ! -name 'MEMORY_INDEX.md' \) -print0 | sort -z)

if [[ $file_count -eq 0 ]]; then
    printf 'No files found in %s (excluding hidden files and the index itself).\n' "$REAL_DIR" >> "$OUTPUT_FILE"
fi

echo "✅ MEMORY_INDEX.md written ($file_count entries) → $OUTPUT_FILE"
