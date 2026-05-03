#!/usr/bin/env bash
# Plan-eval trigger — runs deterministic-hardening rules against a plan file.
# Emits structured JSON {rules: [{id, status, message}]} to stdout.
# Exits 0 if all rules pass, 1 if any fail.
# Rules: D5 (defer-language), D6 (plan-residual: unfalsified-Type-1, layer-mismatch, scope-creep).
# Usage: bash plan-eval.sh <plan.md> [project-root]

set -u

PLAN="${1:-}"
PROJECT_ROOT="${2:-$(pwd)}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -z "$PLAN" ]]; then
  echo '{"error":"missing plan path"}' >&2
  exit 2
fi

if [[ ! -f "$PLAN" ]]; then
  echo "{\"error\":\"file not found: $PLAN\"}" >&2
  exit 2
fi

# Strip Obsidian comments + code blocks for content-pattern checks.
CONTENT=$(awk '
  BEGIN { in_code=0 }
  /^```/ { in_code = !in_code; next }
  in_code { next }
  { print }
' "$PLAN" | sed 's/%%[^%]*%%//g')

# ----- D5 -----
D5_STATUS="pass"
D5_MSG="no banned tokens"
if ! HARDENING_IGNORE_EXEMPT=1 bash "$SCRIPT_DIR/defer-language-scan.sh" "$PLAN" "$PROJECT_ROOT" 2>/dev/null; then
  D5_STATUS="fail"
  D5_MSG="defer-language tokens present"
fi

# ----- D6 plan-residual scan -----
D6_STATUS="pass"
D6_REASONS=()

# (a) Unfalsified Type 1 hypothesis: "If ... then ..." with no falsification clause.
#     Heuristic: "If ... then" present AND no "unless"/"falsified"/"would fail if"/"counter-example".
if echo "$CONTENT" | grep -iE 'if .* then' >/dev/null 2>&1; then
  if ! echo "$CONTENT" | grep -iE 'unless|falsified|would fail if|counter-example|counterexample' >/dev/null 2>&1; then
    D6_REASONS+=("unfalsified-hypothesis")
  fi
fi

# (b) Layer-mismatched hypothesis: only fires on plans DECLARING new gate hypotheses
#     (i.e., contains "hypothesis" AND a gate keyword). Plans that merely reference
#     existing gates (e.g., "D1 gate runs at pre-commit") are exempt.
if echo "$CONTENT" | grep -iE 'hypothesis' >/dev/null 2>&1; then
  if echo "$CONTENT" | grep -iE 'hard.gate|gate hypothesis|new gate' >/dev/null 2>&1; then
    if ! echo "$CONTENT" | grep -iE 'parser|validator|CLI|cross-component|cross component' >/dev/null 2>&1; then
      D6_REASONS+=("layer-mismatch")
    fi
  fi
fi

# (c) Scope-creep: phase numbering beyond plan boundary or "future plan" language.
if echo "$CONTENT" | grep -iE 'phase 6|phase 7|future plan|next plan' >/dev/null 2>&1; then
  D6_REASONS+=("scope-creep")
fi

if [[ ${#D6_REASONS[@]} -gt 0 ]]; then
  D6_STATUS="fail"
  D6_MSG=$(IFS=,; echo "${D6_REASONS[*]}")
else
  D6_MSG="no residual patterns detected"
fi

# Emit JSON.
cat <<EOF
{"rules":[{"id":"D5","status":"$D5_STATUS","message":"$D5_MSG"},{"id":"D6","status":"$D6_STATUS","message":"$D6_MSG"}]}
EOF

if [[ "$D5_STATUS" == "fail" || "$D6_STATUS" == "fail" ]]; then
  exit 1
fi

exit 0
