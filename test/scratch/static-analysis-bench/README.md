---
last_verified: 2026-11-19
verified_by: agent
---
# Static-Analysis Tool Benchmark

A **replayable, transparent** test of which code-analysis tool wins which job, run
against this repo's own TypeScript. Built to falsify the routing claims in the
global `CLAUDE.md` "Static Analysis Routing" section — not to confirm them.

## Why this exists

The routing guidance ("LSP for symbols, semble for intent, graphify for breadth,
jact never on code") was written from reasoning, not evidence. This harness
forces each claim to survive a real test on real code.

Per the Hardening Principle: deterministic execution lives in the script; the only
judgement (the answer key) is frozen in `oracle.json`. Same source → same scorecard.

## How to run

```bash
cd <jact repo root>
bash test/scratch/static-analysis-bench/run-bench.sh
```

Needs: `node` (uses the `typescript` already in `node_modules` — no new dep),
`grep`, `jq`. Optional: `semble`, `jact`, `graphify` (skipped cleanly if absent).

## Files

| File | Role |
|---|---|
| `oracle.json` | Answer key — hand-verified true positions, with what each test proves. |
| `lsp-find-refs.mjs` | Lightweight LSP proxy (TS compiler API): find-references + go-to-implementation. |
| `run-bench.sh` | Runs every tool per test, saves raw output to `results/`, prints a scorecard. |
| `_build_graph.py` | Builds a graphify code graph for `src/` SERIALLY (AST/tree-sitter, no LLM). Needed because graphify's parallel extractor crashes on Python 3.14 and its `detect()` returns 0 here. |
| `_query_t2.py` | Queries the built graph for the T2 dispatch bridge. Reads the raw extract (correct schema). |
| `results/` | Every tool's raw output, for inspection. Regenerated each run. |

## Testing graphify (the T2 head-to-head)

graphify needs a built graph. Two steps, both deterministic:

```bash
PY=$(cat graphify-out/.graphify_python)   # graphify's own interpreter
"$PY" test/scratch/static-analysis-bench/_build_graph.py   # build graph.json from src/
"$PY" test/scratch/static-analysis-bench/_query_t2.py      # query the dispatch bridge
```

## Reading the scorecard

`PASS` = matches the routing-doc expectation. `FAIL` = **contradicts the doc**, so the
doc claim was corrected. `⚠️` = informational (a tool behaving as the foil, or not tested).

## What the run on jact found (2026-05-30)

| Test | Result | Verdict on the doc |
|---|---|---|
| **T1** exact references | LSP returned exactly 3 true refs; grep returned 8 (it cannot tell the standalone `extractHeadings` function from the same-named class method, and includes comments). | **Confirmed** — LSP > grep for precision. |
| **T2** interface dispatch | LSP `findReferences` from concrete `CliFlagStrategy.getDecision` reached the interface-typed call site `analyzeEligibility.ts:23`; go-to-impl returned all 4 strategies; `findReferences` on the class found the DI wiring in `componentFactory.ts:115`. **graphify** (graph built, 232 nodes / 321 edges) had every strategy + `getDecision` node but produced **0** bridging edges — 0 `implements`, 0 dispatcher→getDecision, 0 dispatcher→strategy. Its JS/TS extractor emits only imports/contains/method/calls. | **Falsified my own claim that graphify catches dispatch LSP misses — the reverse.** LSP bridged it; graphify found *less*. Doc corrected. |
| **T3** intent search | semble ranked `extractLinksContent.ts` (content dedup) #1 from a meaning-only query; grep `duplicat` returned 88 hits across 14 files (filename dedup, link dedup, parse dedup — all noise). | **Confirmed** — semble ranks, grep floods. |
| **T4** jact on `.ts` | `jact ast src/jact.ts` exited 0 and returned valid JSON with every array empty. | **Refined** — jact does not error on code; it fails *silently*, which is worse. Doc corrected. |

## What graphify cost to test (operational findings)

- Its parallel extractor crashes on **Python 3.14** (`BrokenProcessPool`). Built serially instead (`_build_graph.py`).
- `detect()` reports `code: 59` but `graphify update`/the full pipeline produced no `graph.json`; had to extract files directly.
- Node-id collision bug: a `getDecision` node id was built from the wrong class stem in places.
- The networkx `graph.json` export renames node attributes vs the raw extract — a first query read the wrong keys and gave a **false negative**, then a false positive. Query the raw `.graphify_extract.json`.

## Known gaps / honest limits

- **LSP's true blind spot is absent from jact.** Genuinely runtime-bound dispatch
  (string-keyed maps, reflection with no static type link) does not exist here — the
  code uses static imports + DI, which LSP fully resolves. The one scenario where graphify
  *might* win could not be tested. It remains unproven, not disproven.
- At the 2026-05-30 run, one stray file from an old session sat in `graphify-out/`
  (`graphify query "..."`). Not created by this harness; left untouched. `graphify-out/`
  is an untracked local folder and is absent from this checkout.
- **The source has drifted since the run.** `src/jact.ts` (the T4 target) was removed in
  `b53295b`, and the fixed line positions in `run-bench.sh` (for example
  `extractHeadings.ts:21`, `analyzeEligibility.ts:23`) no longer land on the queried
  symbols. Update `run-bench.sh` and `oracle.json` before replaying; the table above
  records the 2026-05-30 source only.
