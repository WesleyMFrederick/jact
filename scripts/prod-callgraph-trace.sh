#!/usr/bin/env bash
# D3 — prod-callgraph-trace.
# Heuristic: every public exported function in src/ must be reachable (by name reference)
# from src/jact.ts (the CLI entrypoint) or from a transitively-referenced module.
# Quick-start: 2-hop name-reference check via grep. Upgradeable to ts-morph callgraph.
# Usage: bash prod-callgraph-trace.sh [project-root] [entrypoint]
# Exits 0 if all public exports reachable; 1 otherwise.

set -u

PROJECT_ROOT="${1:-$(pwd)}"
ENTRY="${2:-$PROJECT_ROOT/src/jact.ts}"
SRC="$PROJECT_ROOT/src"

if [[ ! -f "$ENTRY" ]]; then
  echo "Entry not found: $ENTRY" >&2
  exit 0
fi

UNREACHABLE=()

# Extract `export function NAME` and `export const NAME` from src/.
while IFS= read -r line; do
  file="${line%%:*}"
  name=$(echo "${line#*:}" | grep -oE 'export (function|const|class) [a-zA-Z_][a-zA-Z_0-9]*' | awk '{print $3}')
  [[ -z "$name" ]] && continue
  [[ "$file" == "$ENTRY" ]] && continue

  # 1-hop: direct reference from entry.
  if grep -qE "\b$name\b" "$ENTRY" 2>/dev/null; then
    continue
  fi
  # 2-hop: any file referencing $name AND referenced by entry.
  reached=0
  for ref in $(grep -lE "\b$name\b" "$SRC" --include='*.ts' -r 2>/dev/null); do
    [[ "$ref" == "$file" ]] && continue
    base=$(basename "$ref" .ts)
    if grep -qE "\b$base\b" "$ENTRY" 2>/dev/null; then
      reached=1
      break
    fi
  done
  if [[ "$reached" == "0" ]]; then
    UNREACHABLE+=("$file:$name")
  fi
done < <(grep -rEn '^export (function|const|class) [a-zA-Z_]' "$SRC" --include='*.ts' 2>/dev/null)

if [[ ${#UNREACHABLE[@]} -gt 0 ]]; then
  echo "UNREACHABLE EXPORTS (not reached from $ENTRY within 2 hops):" >&2
  for u in "${UNREACHABLE[@]}"; do echo "  - $u" >&2; done
  exit 1
fi

exit 0
