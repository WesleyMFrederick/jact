# Plan-02 Wikilink Validation Delta Closure — State

%% *Last Modified: 05/03/26 16:31:04* %%

> Living doc. Aden ODD (Outcome-Driven Development). **ALWAYS write task learnings here — lost on restart.**

## Session Provenance

%% *Last Modified: 05/03/26 16:31:04* %%

**Rule (HARD):** Every stateful write to this file MUST log the originating `session_id` and transcript path.

| Session ID | Transcript Path | Notes |
|---|---|---|
| `c17662b7-e3bd-438f-b5b3-bb4cd0a1e210` | `/Users/wesleyfrederick/.claude/projects/-Users-wesleyfrederick-Documents-ObsidianVault-0-SoftwareDevelopment-jact/c17662b7-e3bd-438f-b5b3-bb4cd0a1e210/` | T0: state file created; impact analysis at `plan-02-pre-authoring-impact.md` consumed as Phase-0 input |

## Source-of-Truth (HARD)

%% *Last Modified: 05/03/26 16:31:04* %%

**Aden ODD spec [must-follow]:** `https://docs.adenhq.com/building-agent/concepts/outcome-driven-development.md`

**Contract enforced this work (HC0):**
1. Lifecycle: `DRAFT → READY → ACTIVE → COMPLETED | FAILED | SUSPENDED`
2. Goal = intent+direction (no outcomes)
3. Criteria split: SuccessCriteria (define success) + Constraints (define failure)
4. Each `SuccessCriterion` MUST have: `id, description, metric, target, weight (0-1)`
5. Metrics: `output_contains | output_equals | llm_judge | custom`
6. Constraints: `type ∈ {hard, soft}` × `category ∈ {time, cost, safety, scope, quality}`
7. Tests = hypotheses
8. Each test execution → full Outcome struct
9. Feedback loop: `ACCEPT | RETRY | REPLAN | ESCALATE`
10. Goal NEVER mutated by framework — only `[l]` ESCALATE
11. Workflow MUST conform to Process Tree

**Project source-of-truth files (HARD):**
- `design-docs/features/202605020859-jact-wikilink-validation/plan.md` — §7a Delta Architecture, §7b D1–D5 Rationale, §8.3 sequencing
- `design-docs/features/202605020859-jact-wikilink-validation/plan-02-pre-authoring-impact.md` — pre-[a] reconciliation; per-Delta scope deltas
- `design-docs/features/202605020859-jact-wikilink-validation/.archive/plan-01-learnings.md` — §9b–§9d–§9f process constraints (binding)

---

## Process Tree (Aden ODD — ENFORCED)

%% *Last Modified: 05/03/26 16:31:04* %%

> Formal control-flow model. Every conformant trace MUST match this tree.

### Process Tree Key

%% *Last Modified: 05/03/26 16:31:04* %%

| Symbol | Name | Meaning |
|---|---|---|
| `→` | sequential | execute children left-to-right |
| `×` | exclusive choice | execute exactly ONE child |
| `∧` | parallel | execute ALL children, any order |
| `↻` | redo loop | first child = "do", rest = "redo" options |
| `τ` | silent activity | skip / no-op |

### Canonical Inline (structural source of truth)

%% *Last Modified: 05/03/26 16:31:04* %%

```
→(r, ×(→(a, b, c, d, w, e, w), τ), ↻(→(f, g, h, w), →(j, w, τ), →(k, w, τ), →(l, w, τ)), ×(→(m, ↻(n, →(j, w, τ), →(k, w, τ), →(l, w, τ)), w), τ), ×(→(o, ↻(p, →(j, w, τ), →(k, w, τ), →(l, w, τ)), w), τ), q, w)
```

### Visual Tree (reading aid)

%% *Last Modified: 05/03/26 16:31:04* %%

```
→ aden-odd-workflow
├── [r] Read state file at turn/session start (recover lifecycle position)        ← MANDATORY first
├── × draft-and-gate-block                                                         ← OPTIONAL: skip if [r] recovers ACTIVE/COMPLETED/FAILED
│   ├── → author-then-gate
│   │   ├── → DRAFT-authoring
│   │   │   ├── [a] Author Goal (intent + direction)
│   │   │   ├── [b] Author Success Criteria (id, description, metric, target, weight)
│   │   │   ├── [c] Author Constraints (type=hard|soft × category=time|cost|safety|scope|quality)
│   │   │   ├── [d] Author Context (durable background)
│   │   │   └── [w] Write state file (persist DRAFT artifacts + Change Log)
│   │   ├── [e] User validates DRAFT → READY                                       ← HARD GATE (Type I)
│   │   └── [w] Write state file (persist READY transition)
│   └── [τ] (skip — DRAFT+gate already cleared)
├── ↻ test-outcomes-loop
│   ├── → do-part
│   │   ├── [f] Generate tests (one hypothesis per Success Criterion)
│   │   ├── [g] Run tests → emit Outcome{success,result,error,state_changes,tokens_used,latency_ms,summary}
│   │   ├── [h] Aggregate weighted score; judgment ACCEPT|RETRY|REPLAN|ESCALATE
│   │   └── [w] Write state file (persist outcomes + judgment)
│   ├── → redo: RETRY  → [j] fix code → [w] → [τ] (loop back)
│   ├── → redo: REPLAN → [k] adjust criteria/system → [w] → [τ]
│   └── → redo: ESCALATE → [l] developer intervention → [w] → [τ]
├── × operational-phase                                                              ← optional per work-scope
│   ├── → run-operational: [m] deploy staging → ↻ ops loop ([n], j/k/l redos) → [w]
│   └── [τ] (skip — scope-out documented)
├── × real-world-phase                                                               ← optional per work-scope
│   ├── → run-real-world: [o] deploy prod → ↻ rw loop ([p], j/k/l redos) → [w]
│   └── [τ] (skip — scope-out documented)
├── [q] Emit final state COMPLETED
└── [w] Write state file (persist COMPLETED)
```

### Activity Legend

%% *Last Modified: 05/03/26 16:31:04* %%

| Node | Activity |
|---|---|
| [r] | Read state file (recover lifecycle position) — at session start |
| [a] | Author Goal — intent+direction, no outcomes |
| [b] | Author Success Criteria — `id, description, metric, target, weight`. Weights sum = 1.0. |
| [c] | Author Constraints — `type ∈ {hard,soft}, category ∈ {time,cost,safety,scope,quality}` |
| [d] | Author Context — durable background |
| [e] | User validates DRAFT → READY — **HARD GATE** |
| [f] | Generate tests as hypotheses — one per `SuccessCriterion.id` |
| [g] | Run tests; emit full Outcome struct per execution |
| [h] | Aggregate weighted score; judgment ≥0.90 → ACCEPT |
| [j] | RETRY redo: fix code (criteria UNCHANGED) |
| [k] | REPLAN redo: adjust criteria thresholds OR system structure |
| [l] | ESCALATE redo: revisit Goal — developer intervention only |
| [m] | Deploy to staging/pilot |
| [n] | Observe Operational Outcomes |
| [o] | Deploy to production |
| [p] | Observe Real-World Outcomes |
| [q] | Emit COMPLETED |
| [w] | Write state file — required after every transition |
| [τ] | Silent skip / loop-back |

### Hard Enforcement Rules

%% *Last Modified: 05/03/26 16:31:04* %%

1. `[r]` runs first on every session/turn.
2. `[e]` HARD GATE cannot be skipped on its first traversal. No user → SUSPENDED.
3. Tests-first: `[f]` precedes any implementation `[j]`.
4. ACCEPT requires weighted score ≥0.90.
5. Goal mutation = `[l]` ESCALATE only.
6. `[w]` runs after every lifecycle transition.
7. `×(...,τ)` skips: document scope-out decision in state file.
8. Each `[g]` execution emits FULL Outcome struct (all 7 fields).
9. Constraints without `category` tag → non-conformant.
10. Re-entry: lifecycle is the source of truth for which `×` branch `[r]` selects.

### Conformant Trace (this work)

%% *Last Modified: 05/03/26 16:31:04* %%

**First-pass:** `[r] → ×→([a]→[b]→[c]→[d]→[w] → [e]→[w]) → ↻([f]→[g]→[h]→[w] | [j]→[w]→τ)* → ACCEPT → ×τ (ops) → ×τ (prod) → [q]→[w]`

**Re-entry (lifecycle ≥ ACTIVE):** `[r] → ×τ (DRAFT+gate cleared) → ↻(...)*→ ACCEPT → ×τ → ×τ → [q]→[w]`

### Self-Check Before Each Step

%% *Last Modified: 05/03/26 16:31:04* %%

- [ ] Which node `[a]–[w]` am I executing right now?
- [ ] Predecessors complete? (no skipping forward)
- [ ] At HARD GATE [e] → waiting for explicit user confirm?
- [ ] Running tests [f]/[g] → emitting full Outcome struct?
- [ ] At judgment [h] → weighted score computed; redo choice data-driven?
- [ ] After lifecycle transition → did I run `[w]` to persist?

If any unchecked → STOP. Re-enter at correct node.

---

## Lifecycle

%% *Last Modified: 05/03/26 16:31:04* %%

`DRAFT` ← **CURRENT** → `READY` → **HARD GATE [e]** → `ACTIVE` → **`<TERMINAL>`**

Current tree position: post-[d] author Context, pre-[w] persist DRAFT, pending [e] HARD GATE.

## Tasks — mapped to Process Tree nodes

%% *Last Modified: 05/03/26 16:31:04* %%

| # | Tree Node | State | Task |
|---|---|---|---|
| 1 | pre-[a] | ✅ | Read plan-01 ship commit + impact analysis + retrospective rules ([OBS]) |
| 2 | [a] | ✅ | Author Goal (T3 below) |
| 3 | [b] | ✅ | Author Success Criteria (T4 below) |
| 4 | [c] | ✅ | Author Constraints (T5 below) |
| 5 | [d] | ✅ | Author Context (T6 below) |
| — | [w] | ☐ continuous | Persist state after every transition |
| 6 | [e] | ☐ HARD GATE | User validates DRAFT → READY |
| 7 | [f]+[g] | ☐ | Phase-0 close hardening REDs (C3 + C6); generate adversarial fixtures; generate failing service-level tests per Delta |
| 8 | [j]/[k]/[l] | ☐ | Redo path per judgment |
| 9 | [h] | ☐ | Weighted score → ACCEPT/RETRY/REPLAN/ESCALATE |
| — | ops [m]–[n] | ☐ scope-out [τ] | Operational deploy — N/A (CLI tool, no staging environment) |
| — | prod [o]–[p] | ☐ scope-out [τ] | Production deploy — N/A (npm publish out of scope; future work) |
| 10 | [q]+[w] | ☐ | Emit COMPLETED, persist |

---

## T3 — Goal

%% *Last Modified: 05/03/26 16:31:04* %%

Bring the wikilink validator's contract surface — CLI output, exit codes, error messages, JSON shape, and the `manager.validate()` interface — to parity with the §7a Delta Architecture spec. Plan-01 closed the parser-and-resolver gap (D1 grammar, D4 resolver core, validator wiring, loud-fail). The remaining gap lives at the user-facing layer: residual-bracket diagnostics, coverage-qualified output, structured-field exit codes, suggestion display, and documentation alignment. Direction: close the gap iteratively under the deterministic-hardening pipeline already scaffolded for the project, with deterministic gates as the first line of defense and LLM-as-judge reviewers as the second.

**Files:**
- `src/core/MarkdownParser/extractLinks.ts`, `src/core/MarkdownParser/resolveWikiPath.ts`, `src/core/getLinkClass.ts` (new), `src/types/validationTypes.ts`, `src/types/citationTypes.ts`, `src/CitationValidator.ts`, `src/jact.ts`, `src/utils/stringDistance.ts`
- `jact/CLAUDE.md`, `src/core/MarkdownParser/MarkdownParser.ts` JSDoc, `design-docs/component-guides/MarkdownParser Component Guide.md`
- `design-docs/hardening-pipeline/state.md`, `design-docs/hardening-pipeline/fixture-template.md` (restore), `scripts/defer-language-scan.sh` (`.archive/**` exemption)

**Ref pattern (adopt):** `design-docs/features/202605020859-jact-wikilink-validation/plan.md` §7a, §7b, §7g (UI sketch — verification baseline)

---

## T4 — Success Criteria (Aden ODD shape)

%% *Last Modified: 05/03/26 16:31:04* %%

| ID | Description | Metric | Target | Weight | Test (hypothesis) |
|---|---|---|---|---|---|
| C1 | Hardening pipeline GREEN before any feature work | custom | `bun test test/hardening-pipeline/` exits 0; all C1–C6 pass | 0.10 | If `.archive/**` is exempted from `defer-language-scan.sh` AND `design-docs/hardening-pipeline/{state.md,fixture-template.md}` are restored, C3 + C6 transition RED→GREEN |
| C2 | Adversarial CommonMark fixtures pass under D1 grammar | custom | New fixtures at `test/fixtures/wikilink-adversarial/` cover §4.5 + §6.1 cases (mixed inline+fenced, varying backtick runs, nested emphasis); all 10 forms still validate | 0.10 | If shipped grammar handles CommonMark adversarial inputs, fixture suite passes 100% |
| C3 | D2 residual-bracket scanner emits diagnostic per occurrence | output_contains | CLI minimal-mode includes `UNRECOGNIZED (K)` section between `ERRORS` and trailer; per-record line `- Line N: <rawText>`; verbose mode includes `UNRECOGNIZED SYNTAX (K)` block; JSON shape adds top-level `unrecognized: UnrecognizedSyntaxRecord[]` | 0.20 | If parser scans residuals after extractors run, then for any `[[unmatched` in source, both CLI and JSON modes surface the record (writers > 0 AND readers > 0 per §9c) |
| C4 | D3 coverage-qualified output + Type-I interface change + structured-field exit code | output_contains | `OK:` line shows `(markdown: N, wiki: N, caret: N; K unrecognized)`; `manager.validate()` returns `Promise<{output, result}>`; exit code = `result.summary.errors > 0 \|\| result.summary.unrecognizedCount > 0 ? 1 : 0` | 0.25 | If `getLinkClass` classifier + `byLinkClass` summary + structured-field predicate ship, then unrecognized-only failures exit 1 (today: exits 0) |
| C5 | D4 Levenshtein adaptive-threshold suggestion with path-aware display | output_contains | Broken-wiki suggestion = full relative path (single match) or comma-separated paths (multi-match); threshold = `clamp(3, 10, floor(0.2 × pathLen))` | 0.15 | If basename-distance scan with adaptive threshold runs on resolver miss, then typo wikilinks surface single-path suggestions; duplicate-basename cases surface all candidates |
| C6 | D5 documentation alignment across 3 locations | output_equals | `jact/CLAUDE.md` Citation Patterns + `MarkdownParser.ts` JSDoc + component guide each enumerate the same 10 wikilink forms | 0.05 | If all 3 docs are aligned post-edit, a grep diff between them yields zero coverage drift |
| C7 | Service-level smoke green (post all Deltas) | custom | `bash scripts/service-level-smoke.sh` exits 0 against `test/fixtures/wikilink-baseline/` AND adversarial fixture; ≥7/8 wiki valid; loud-fail format `Tried: <raw>, <slug>.md` retained | 0.15 | If full pipeline runs against canonical fixture, service-level outcome matches user job-to-be-done (per §9b rule #3) |

**Weight sum:** 1.00. **Threshold:** weighted score ≥ 0.90 → ACCEPT.

---

## T5 — Constraints

%% *Last Modified: 05/03/26 16:31:04* %%

**Hard:**
- HC0 [scope]: Implementation MUST follow Aden ODD spec
- HC1 [quality]: No deferral language in any STATE-WRITE — banned tokens enforced by `scripts/defer-language-scan.sh` (per §9d/§9f)
- HC2 [quality]: No optional injectable deps — enforced by ESLint rule on `HARDENING-ALLOWLIST` types (`FileCache`, `FileSystemInterface`, `LinkObjectFactory`, `MarkdownParser`, `CitationValidator`, `ContentExtractor`, `ParsedFileCache`, `ParsedDocument`) (per §9c canonical-cheat rule)
- HC3 [quality]: Every new shape field has writers > 0 AND readers > 0 — enforced by `scripts/find-dead-fields.sh` + mandatory consumer-side LSP audit at COMMIT (per §9b rule #1)
- HC4 [scope]: No tech-debt deferral — project CLAUDE.md TECH DEBT POLICY: fix in current PR/task (per §9d)
- HC5 [quality]: Tests-first — `[f]` generates failing test before any `[j]` (per ODD rule + project TDD)
- HC6 [safety]: Service-level smoke (`scripts/service-level-smoke.sh`) must pass — gate is CLI-layer outcome, not parser-layer (per §9b rule #3)
- HC7 [scope]: Reviewer authority = SHIP / NO-SHIP only — no "ship with caveats" (per §9d)
- HC8 [quality]: Sibling-module sweep before adding any `extractX.ts` / `resolveX.ts` / `isInsideX.ts` — `documentSymbol` on the directory; consolidate or document parallel implementations (per §9b rule #2)
- HC9 [safety]: Adversarial CommonMark fixtures land before any change to inline-code, fenced-code, link, or anchor parsing (per §9b rule #4)
- HC10 [scope]: Type-I interface change for `manager.validate()` requires explicit ADR alongside the Delta (per §7a Notes)

**Soft:**
- SC1 [quality]: Single monolithic `plan-02-implement-deltas.md` with 5 internal phase headings (Phase-0 Hardening + D2 + D3 + D4-Levenshtein + D5) over 5 separate files — APPEND-FIRST + identical review-gate count
- SC2 [time]: Phase-0 hardening closure should complete in one work session (~1–2 hours) before D2 work begins
- SC3 [scope]: Operational `[m]–[n]` and real-world `[o]–[p]` phases scope-out via `[τ]` — CLI tool with no staging/pilot environment; npm publish is future work

---

## T6 — Context

%% *Last Modified: 05/03/26 16:31:04* %%

### Plan-01 ship state (pre-conditions for plan-02)

%% *Last Modified: 05/03/26 16:31:04* %%

Commit `ec85098` (squashed ~80 commits from `ast-scope` branch on 2026-05-03) shipped:
- `src/core/MarkdownParser/extractWikilinks.ts` — D1 grammar covering all 10 Obsidian forms
- `src/core/MarkdownParser/resolveWikiPath.ts` + `src/utils/wikiPageSlug.ts` — D4 resolver core (exact + slug fallback)
- `src/core/MarkdownParser/isInsideCodeBlock.ts` + `isInsideInlineCode.ts` — code-block exclusion (Phase 5 + 6 of plan-01)
- `CitationValidator` wiring consuming parser-resolved wiki paths (no re-resolution in validator); FileCache REQUIRED end-to-end through `MarkdownParser → extractLinks → extractWikilinks → createLinkObject`
- Loud-fail surfacing: broken wiki errors render `Tried: <raw>, <slug>.md`

### Hardening pipeline state (in flight)

%% *Last Modified: 05/03/26 16:31:04* %%

Commits `643024a` + `a483992` + `02cd723` scaffolded:
- `eslint.config.js` — flat config + `HARDENING-ALLOWLIST` injectable-types ban (D1-§9f)
- `scripts/defer-language-scan.sh` (D5-§9f → C3)
- `scripts/find-dead-fields.sh` (D2-§9f → C1)
- `scripts/prod-callgraph-trace.sh` (D3-§9f)
- `scripts/service-level-smoke.sh` (D4-§9f)
- `scripts/plan-eval.sh` (C2)
- `test/hardening-pipeline/c1-d1-injectable-bans.test.ts` … `c6-fixture-template.test.ts`

**Known intentional REDs (per `ec85098` commit body):**
- C3 `defer-language-scan.test.ts` — `plan-01-learnings.md` retrospective discusses defer language; needs exemption (now resolved by file relocation to `.archive/`; Phase-0 verifies)
- C6 `fixture-template.test.ts` — `design-docs/hardening-pipeline/fixture-template.md` not yet authored AND was deleted in working tree; Phase-0 restores

### Process constraints (binding)

%% *Last Modified: 05/03/26 16:31:04* %%

`design-docs/features/202605020859-jact-wikilink-validation/.archive/plan-01-learnings.md` §9b/§9c/§9d/§9f — copied verbatim into HC1–HC9 above.

### Resolved pre-authoring questions

%% *Last Modified: 05/03/26 16:31:04* %%

Per `plan-02-pre-authoring-impact.md` §"Open Questions" + evidence falsification:
- Q1 → `design-docs/hardening-pipeline/` is canonical (tests reference path; deletes uncommitted; restore = correct mitigation)
- Q2 → exempt `.archive/**` from C3 walker (archives are not active artifacts)
- Q3 → both artifacts needed: ODD state file (this) = lifecycle/criteria orchestrator; `plan-02-implement-deltas.md` = executable plan per §8.3 pipeline
- Q4 → monolithic plan-02 with internal phase headings (per SC1; APPEND-FIRST; equivalent gate count)

### Per-Delta scope after reconciliation

%% *Last Modified: 05/03/26 16:31:04* %%

| Delta | Plan-02 scope (post plan-01) |
|---|---|
| D1 | Adversarial CommonMark fixtures only (grammar shipped) |
| D2 | Full scope — residual scanner + `unrecognized[]` + display blocks |
| D3 | Full scope — `LinkClass` + `getLinkClass.ts` + summary extensions + Type-I interface + exit-code refactor + verbose SUMMARY block + trailer branch order |
| D4 | Levenshtein adaptive-threshold + path-aware display + multi-match disambiguation only (resolver core shipped) |
| D5 | Full scope — 3 doc locations |

---

## [OBS] / [Q] / [H] sections

%% *Last Modified: 05/03/26 16:31:04* %%

### [Q] Open Questions

%% *Last Modified: 05/03/26 16:31:04* %%

| # | Q | Status | Resolution |
|---|---|---|---|
| Q1 | Hardening-pipeline canonical home | ✅ | `design-docs/hardening-pipeline/` (evidence: test path refs; uncommitted deletes) |
| Q2 | C3 scan scope on archived retrospective | ✅ | Exempt `.archive/**` (standard pattern) |
| Q3 | State file vs plan file | ✅ | Both — different roles |
| Q4 | Monolithic vs 5-file plan-02 | ✅ | Monolithic with 5 internal phases (per SC1) |
| Q5 | Does Phase-0 hardening closure block all feature work, or can D5 docs land in parallel? | ⏳ | Defer to user at HARD GATE [e] |

### [H] Hypotheses

%% *Last Modified: 05/03/26 16:31:04* %%

| # | Claim | Status |
|---|---|---|
| H1 | Closing C3 + C6 RED → GREEN unblocks all subsequent commits (per `ec85098` commit body declaring intentional REDs) | ⏳ — verify at [g] |
| H2 | Deterministic gates as first line + LLM reviewer as second line catches all 5 §9f cheats (optional-injected-dep, dead-field, stub-only coverage, deferral-by-language, parallel-implementation) | ⏳ — verify post-D2/D3/D4 commits |
| H3 | D4 Levenshtein basename-distance with `clamp(3, 10, floor(0.2 × pathLen))` adaptive threshold catches typo wikilinks without false-positive matches on long paths | ⏳ — verify with adversarial fixture in [g] |

---

## Session Learnings (lost on restart)

%% *Last Modified: 05/03/26 16:31:04* %%

### L1: Plan-01 SHIPPED — reconcile assumptions before [a]

%% *Last Modified: 05/03/26 16:31:04* %%

- USER: "we want to create this plan, but first we need to see if plan-01 implement has impacted any of the assumptions made for plan-02"
- Implication: ODD `[r]` recovery is not just reading the state file — it includes reading shipped reality (git log, on-disk artifacts) when prior phase commits exist
- Risk if ignored: re-author Goal/Criteria from stale assumptions; ship redundant work; trigger §9b rule #2 parallel-implementation violation

### L2: Falsify pre-[e] Type-I questions before HARD GATE

%% *Last Modified: 05/03/26 16:31:04* %%

- Stop hook flagged Q1–Q4 as USER questions resolvable from evidence
- All 4 resolved via 3-part gate (falsifiable [H] + tools available + reversible if wrong)
- HARD GATE [e] should surface the ONLY irreducible Type-I question (Q5) plus the resolved DRAFT for validation, not present already-resolvable questions to USER

---

## Next Action

%% *Last Modified: 05/03/26 16:31:04* %%

`[w]` persist DRAFT, then `[e]` HARD GATE — surface this state file to USER for validation of Goal (T3) + Success Criteria (T4 with weights summing to 1.00) + Constraints (T5 HC0–HC10 + SC1–SC3) + Context (T6) + open Q5. Halt until USER explicit approval.

---

## Change Log

%% *Last Modified: 05/03/26 16:31:04* %%

- T0: file created. DRAFT authored after [r] recovery of plan-01 ship state (commit `ec85098`) + hardening-pipeline scaffold (commits `643024a`, `a483992`, `02cd723`) + retrospective rules (`.archive/plan-01-learnings.md` §9b–§9f). Q1–Q4 resolved from evidence; Q5 remains for [e]. Lifecycle = DRAFT, pending [w] persist + [e] HARD GATE.
