#!/usr/bin/env bash
# D2 — find-dead-fields scan.
# Heuristic check: scan TS source for newly-added optional fields/params on shape types
# whose name appears as a writer site (assignment) without any reader site outside the file.
# Quick-start: bash grep version per SC2. Upgradeable to ts-morph.
# Usage: bash find-dead-fields.sh [project-root]
# Exits 0 if no dead fields suspected, 1 otherwise.

set -u

PROJECT_ROOT="${1:-$(pwd)}"
SRC="$PROJECT_ROOT/src"

if [[ ! -d "$SRC" ]]; then
  echo "src/ not found at $SRC" >&2
  exit 0
fi

DEAD=()

# Find optional fields on interfaces/types (pattern: `fieldName?:`).
while IFS= read -r line; do
  file="${line%%:*}"
  rest="${line#*:}"
  fieldname=$(echo "$rest" | grep -oE '[a-zA-Z_][a-zA-Z_0-9]*\?' | head -1 | tr -d '?')
  [[ -z "$fieldname" ]] && continue

  # Reader-site count: usages of `.fieldname` across src/ excluding the declaring file.
  readers=$(grep -rE "\.$fieldname\b" "$SRC" --include='*.ts' -l 2>/dev/null | grep -v "^${file}$" | wc -l | tr -d ' ')
  if [[ "$readers" == "0" ]]; then
    DEAD+=("$file:$fieldname")
  fi
done < <(grep -rEn '^\s*[a-zA-Z_][a-zA-Z_0-9]*\?\s*:' "$SRC" --include='*.ts' 2>/dev/null)

if [[ ${#DEAD[@]} -gt 0 ]]; then
  echo "DEAD FIELDS (zero readers outside declaring file):" >&2
  for d in "${DEAD[@]}"; do echo "  - $d" >&2; done
  exit 1
fi

exit 0
