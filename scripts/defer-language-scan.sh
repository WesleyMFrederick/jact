#!/usr/bin/env bash
# D5 — defer-language scanner.
# Exits 0 if no banned tokens; exits 1 if any banned token found.
# Banned tokens per HC1: follow-up, plan-0[3-9], out of scope, deferred to, non-blocking, tech debt.
# Usage: bash defer-language-scan.sh <file> [project-root]

set -u

FILE="${1:-}"
PROJECT_ROOT="${2:-$(pwd)}"

if [[ -z "$FILE" ]]; then
  echo "Usage: $0 <file> [project-root]" >&2
  exit 2
fi

if [[ ! -f "$FILE" ]]; then
  echo "File not found: $FILE" >&2
  exit 2
fi

# Strip non-prose noise so meta-discussion of the rule doesn't trigger:
#   1. Fenced code blocks
#   2. Obsidian comments (%% ... %%)
#   3. Inline backticked spans (`token`) — citations of the rule, not prose usage
#   4. Markdown table separator rows (--- | ---)
# Exemption: YAML frontmatter `hardening: exempt-defer-language` OR
# Obsidian comment `%% hardening: exempt-defer-language %%` anywhere in first 20 lines.
# Bypass exemption with HARDENING_IGNORE_EXEMPT=1 (used by plan-eval historical-replay mode).
if [[ "${HARDENING_IGNORE_EXEMPT:-0}" != "1" ]]; then
  if head -20 "$FILE" | grep -qE 'hardening:\s*exempt-defer-language'; then
    exit 0
  fi
fi

CONTENT=$(awk '
  BEGIN { in_code=0 }
  /^```/ { in_code = !in_code; next }
  in_code { next }
  { print }
' "$FILE" | sed 's/%%[^%]*%%//g' | sed 's/`[^`]*`//g')

# Banned token patterns (case-insensitive, word-boundary where it makes sense).
PATTERNS=(
  'follow-up'
  'plan-0[3-9]'
  'out of scope'
  'deferred to'
  'non-blocking'
  'tech debt'
)

VIOLATIONS=()
for pattern in "${PATTERNS[@]}"; do
  if echo "$CONTENT" | grep -iE "$pattern" >/dev/null 2>&1; then
    VIOLATIONS+=("$pattern")
  fi
done

if [[ ${#VIOLATIONS[@]} -gt 0 ]]; then
  echo "DEFER-LANGUAGE VIOLATIONS in $FILE:" >&2
  for v in "${VIOLATIONS[@]}"; do
    echo "  - $v" >&2
  done
  exit 1
fi

exit 0
