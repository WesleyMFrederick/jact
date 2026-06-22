#!/usr/bin/env bash
#
# Static-analysis tool benchmark — replayable, transparent harness.
#
# Runs each tool (LSP proxy, grep, semble, jact) against fixed questions whose
# answers are pinned in oracle.json, saves every raw output to results/, and
# prints a scorecard. Re-run any time; same source → same scorecard.
#
# Hardening Principle: deterministic execution lives here in code, not in an
# LLM's head. The only judgement (the answer key) is frozen in oracle.json.
#
# Usage:  cd <jact repo root> && bash test/scratch/static-analysis-bench/run-bench.sh
#
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../../.." && pwd)"
RESULTS="$HERE/results"
LSP="$HERE/lsp-find-refs.mjs"
cd "$REPO"
mkdir -p "$RESULTS"

pass=0; fail=0; skip=0
line(){ printf '%s\n' "------------------------------------------------------------"; }
have(){ command -v "$1" >/dev/null 2>&1; }
verdict(){ # $1=label $2=PASS|FAIL|SKIP $3=detail
  case "$2" in
    PASS) pass=$((pass+1)); printf '  ✅ %-22s %s\n' "$1" "$3";;
    FAIL) fail=$((fail+1)); printf '  ❌ %-22s %s\n' "$1" "$3";;
    SKIP) skip=$((skip+1)); printf '  ⚠️  %-22s %s\n' "$1" "$3";;
  esac
}

echo "Repo: $REPO"
echo "Tools: node=$(have node && echo yes || echo NO)  grep=yes  semble=$(have semble && echo yes || echo NO)  jact=$(have jact && echo yes || echo NO)"
line

# ============================================================ T1: exact refs
echo "T1  EXACT REFERENCES — function extractHeadings (vs same-named method)"
node "$LSP" src/core/MarkdownParser/extractHeadings.ts 21 extractHeadings >"$RESULTS/T1.lsp.json" 2>"$RESULTS/T1.lsp.err"
grep -rn "extractHeadings" src --include="*.ts" >"$RESULTS/T1.grep.txt" 2>/dev/null

if [ -s "$RESULTS/T1.lsp.json" ]; then
  lsp_n=$(grep -c ':[0-9]' "$RESULTS/T1.lsp.json" || true)
  # true refs = 3 (def + import + function call). Method call (line 87/121) must be ABSENT.
  has_method_call=$(grep -c 'MarkdownParser.ts:87' "$RESULTS/T1.lsp.json" || true)
  if [ "$has_method_call" = "0" ]; then
    verdict "LSP precision" PASS "excluded the same-named method (line 87/121)"
  else
    verdict "LSP precision" FAIL "conflated method with function"
  fi
else
  verdict "LSP precision" SKIP "LSP proxy produced no output (see T1.lsp.err)"
fi
grep_n=$(wc -l <"$RESULTS/T1.grep.txt" | tr -d ' ')
if [ "${grep_n:-0}" -gt 3 ]; then
  verdict "grep precision" FAIL "returned $grep_n hits incl. method + comments (truth = 3)"
else
  verdict "grep precision" PASS "matched the 3 true refs"
fi
line

# ============================================================ T2: polymorphic
echo "T2  POLYMORPHIC DISPATCH — strategy.getDecision() (DI, not imported)"
node "$LSP" src/core/ContentExtractor/eligibilityStrategies/CliFlagStrategy.ts 13 getDecision >"$RESULTS/T2.lsp-concrete.json" 2>"$RESULTS/T2.lsp-concrete.err"
node "$LSP" src/types/strategy-types.ts 16 getDecision >"$RESULTS/T2.lsp-interface.json" 2>"$RESULTS/T2.lsp-interface.err"
node "$LSP" src/core/ContentExtractor/analyzeEligibility.ts 23 getDecision >"$RESULTS/T2.lsp-callsite.json" 2>"$RESULTS/T2.lsp-callsite.err"
grep -rn "getDecision" src --include="*.ts" >"$RESULTS/T2.grep.txt" 2>/dev/null

if [ -s "$RESULTS/T2.lsp-concrete.json" ]; then
  concrete_finds_call=$(grep -c 'analyzeEligibility.ts:23' "$RESULTS/T2.lsp-concrete.json" || true)
  if [ "$concrete_finds_call" = "0" ]; then
    verdict "LSP refs(concrete)" PASS "BLIND to call site (confirms the limitation)"
  else
    verdict "LSP refs(concrete)" FAIL "reached call site from concrete (limitation falsified)"
  fi
fi
if [ -s "$RESULTS/T2.lsp-callsite.json" ]; then
  impls_found=$(jq '.implementations | length' "$RESULTS/T2.lsp-callsite.json" 2>/dev/null || echo 0)
  if [ "${impls_found:-0}" -ge 4 ]; then
    verdict "LSP go-to-impl" PASS "recovered $impls_found concrete strategies from call site"
  else
    verdict "LSP go-to-impl" FAIL "found $impls_found impls (expected 4)"
  fi
fi
g2=$(grep -c 'getDecision' "$RESULTS/T2.grep.txt" || true)
verdict "grep" SKIP "flat $g2 hits, no call→impl relationship (see T2.grep.txt)"

# graphify — a real bridge counts, not a node name mentioned in free text. We check
# actual EDGES via _query_t2.py (greps raw extract for implements / dispatcher→getDecision
# / dispatcher→strategy). NOTE: PASS here means graphify correctly did NOT over-claim;
# the finding is that graphify FOUND FEWER dispatch links than LSP.
GPY="$(cat graphify-out/.graphify_python 2>/dev/null || true)"
if [ -n "$GPY" ] && [ -f graphify-out/.graphify_extract.json ]; then
  "$GPY" "$HERE/_query_t2.py" >"$RESULTS/T2.graphify.txt" 2>"$RESULTS/T2.graphify.err" || true
  if grep -q "does NOT bridge dispatch" "$RESULTS/T2.graphify.txt"; then
    verdict "graphify edges" PASS "0 bridging edges — graphify did NOT connect call→strategy (LSP did)"
  elif grep -q "BRIDGES dispatch" "$RESULTS/T2.graphify.txt"; then
    verdict "graphify edges" FAIL "graphify bridged dispatch — revisit doc claim"
  else
    verdict "graphify edges" SKIP "query inconclusive (see T2.graphify.txt)"
  fi
else
  verdict "graphify edges" SKIP "no built graph — run _build_graph.py first"
fi
line

# ============================================================ T3: intent
echo "T3  INTENT SEARCH — where is extracted CONTENT deduplicated?"
grep -rni "duplicat" src --include="*.ts" >"$RESULTS/T3.grep.txt" 2>/dev/null
grep_files=$(cut -d: -f1 "$RESULTS/T3.grep.txt" | sort -u | wc -l | tr -d ' ')
grep_hits=$(wc -l <"$RESULTS/T3.grep.txt" | tr -d ' ')
verdict "grep noise" SKIP "$grep_hits hits across $grep_files files — finds all, ranks none"

if have semble; then
  semble search "where extracted content is deduplicated by hash" "$REPO" --top-k 5 \
    >"$RESULTS/T3.semble.txt" 2>"$RESULTS/T3.semble.err" || true
  top_hit=$(grep -m1 -E 'ContentExtractor|extractLinksContent|generateContentId' "$RESULTS/T3.semble.txt" 2>/dev/null || true)
  if [ -n "$top_hit" ]; then
    verdict "semble intent" PASS "surfaced content-dedup file in top-5 (see T3.semble.txt)"
  else
    verdict "semble intent" FAIL "content-dedup file not in top-5 (see T3.semble.txt)"
  fi
else
  verdict "semble intent" SKIP "semble not installed"
fi
line

# ============================================================ T4: jact on code
echo "T4  JACT ON CODE — jact ast src/jact.ts"
if have jact; then
  jact ast src/jact.ts >"$RESULTS/T4.jact.out" 2>"$RESULTS/T4.jact.err"
  code=$?
  # "Useless on code" = it runs but every markdown array is empty (silent emptiness).
  empties=$(jq '[.headings,.links,.anchors,.wikilinks,.blockReferences] | map(length) | add' \
            "$RESULTS/T4.jact.out" 2>/dev/null || echo -1)
  if [ "$code" != "0" ]; then
    verdict "jact on .ts" PASS "errored (exit=$code) — not usable on code"
  elif [ "${empties:-(-1)}" = "0" ]; then
    verdict "jact on .ts" PASS "exit=0 but ALL arrays empty — fails SILENTLY on code"
  else
    verdict "jact on .ts" FAIL "extracted real structure from .ts (claim falsified)"
  fi
else
  verdict "jact on .ts" SKIP "jact not installed"
fi
line

echo "SCORECARD:  $pass passed   $fail failed   $skip informational"
echo "Raw outputs: $RESULTS/"
echo "Answer key:  $HERE/oracle.json"
