#!/usr/bin/env bash
# D4 — service-level smoke.
# Runs CLI binary against a baseline fixture; jq-asserts expected counts.
# Usage: bash service-level-smoke.sh [project-root] [fixture] [expected-min-valid]
# Exits 0 if smoke passes; 1 otherwise.

set -u

PROJECT_ROOT="${1:-$(pwd)}"
FIXTURE="${2:-$PROJECT_ROOT/test/fixtures/wikilink-baseline/probabilistic-vs-deterministic-systems.md}"
MIN_VALID="${3:-7}"
CLI="$PROJECT_ROOT/dist/jact.js"

if [[ ! -f "$CLI" ]]; then
  echo "CLI not built: $CLI (run npm run build)" >&2
  exit 1
fi

if [[ ! -f "$FIXTURE" ]]; then
  echo "Fixture missing: $FIXTURE" >&2
  exit 1
fi

OUT=$(node "$CLI" extract links "$FIXTURE" --format json 2>/dev/null || true)
if [[ -z "$OUT" ]]; then
  echo "CLI produced empty output for $FIXTURE" >&2
  exit 1
fi

VALID=$(echo "$OUT" | jq -r '.byClassification.wiki.valid // 0' 2>/dev/null)
if [[ -z "$VALID" || "$VALID" == "null" ]]; then
  VALID=0
fi

if (( VALID < MIN_VALID )); then
  echo "SMOKE FAIL: byClassification.wiki.valid=$VALID < $MIN_VALID" >&2
  exit 1
fi

# Loud-fail format check on any error records.
ERROR_OK=$(echo "$OUT" | jq -r '
  [.errors[]? | select(.classification == "wiki")] |
  all(.message | test("Tried:"))
' 2>/dev/null)
if [[ "$ERROR_OK" == "false" ]]; then
  echo "SMOKE FAIL: wiki errors missing 'Tried: <attempts>' loud-fail format" >&2
  exit 1
fi

exit 0
