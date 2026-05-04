#!/usr/bin/env bash
# D4 — service-level smoke.
# Runs CLI binary against a baseline fixture; jq-asserts expected counts.
# Usage: bash service-level-smoke.sh [project-root] [fixture] [expected-min-valid]
# Exits 0 if smoke passes; 1 otherwise.
#
# Uses `jact validate --format json` (per P3B coverage-qualified shape) instead of
# `jact extract links --format json`, which emits only `{extractedContentBlocks}`
# and never carried per-class valid counts. Wiki valid count is derived by
# filtering `.links[]` on `linkType=="wiki"` AND `validation.status=="valid"`.

set -u

PROJECT_ROOT="${1:-$(pwd)}"
FIXTURE="${2:-$PROJECT_ROOT/test/fixtures/wikilink-baseline/probabilistic-vs-deterministic-systems.md}"
MIN_VALID="${3:-7}"
CLI="$PROJECT_ROOT/dist/jact.js"
SCOPE="$(dirname "$FIXTURE")"

if [[ ! -f "$CLI" ]]; then
  echo "CLI not built: $CLI (run npm run build)" >&2
  exit 1
fi

if [[ ! -f "$FIXTURE" ]]; then
  echo "Fixture missing: $FIXTURE" >&2
  exit 1
fi

OUT=$(node "$CLI" validate "$FIXTURE" --scope "$SCOPE" --format json 2>/dev/null || true)
if [[ -z "$OUT" ]]; then
  echo "CLI produced empty output for $FIXTURE" >&2
  exit 1
fi

VALID=$(echo "$OUT" | jq -r '[.links[]? | select(.linkType=="wiki" and .validation.status=="valid")] | length' 2>/dev/null)
if [[ -z "$VALID" || "$VALID" == "null" ]]; then
  VALID=0
fi

if (( VALID < MIN_VALID )); then
  echo "SMOKE FAIL: wiki valid count=$VALID < $MIN_VALID" >&2
  exit 1
fi

# Loud-fail format check: every wiki miss must surface `Tried: <raw>, <slug>.md`.
ERROR_OK=$(echo "$OUT" | jq -r '
  [.links[]? | select(.linkType=="wiki" and .validation.status!="valid")] as $misses
  | if ($misses | length) == 0 then "true"
    else ($misses | all(.validation.error | test("Tried:")))
    end
' 2>/dev/null)
if [[ "$ERROR_OK" != "true" ]]; then
  echo "SMOKE FAIL: wiki errors missing 'Tried: <attempts>' loud-fail format" >&2
  exit 1
fi

# Suggestion-layer wiring check: every wiki miss must expose `target.path.suggestions`
# (the array, possibly empty — the field's presence proves the Levenshtein layer ran
# and surfaced its result on the miss path; populated vs empty is a function of the
# adaptive-threshold formula).
SUGG_OK=$(echo "$OUT" | jq -r '
  [.links[]? | select(.linkType=="wiki" and .validation.status!="valid")] as $misses
  | if ($misses | length) == 0 then "true"
    else ($misses | all(.target.path.suggestions | type == "array"))
    end
' 2>/dev/null)
if [[ "$SUGG_OK" != "true" ]]; then
  echo "SMOKE FAIL: wiki misses missing target.path.suggestions field (suggestion layer not wired)" >&2
  exit 1
fi

exit 0
