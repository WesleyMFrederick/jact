# Plan-02 Pre-Authoring Impact Analysis

%% *Last Modified: 05/03/26 16:26:34* %%

> Aden ODD `[r]` recovery + Phase-0 anti-pattern scan. Reconciles plan-02 assumptions (from `plan.md` §7a + §8.3) against shipped reality after plan-01 (commit `ec85098`) + hardening-pipeline scaffold (commits `643024a`, `a483992`, `02cd723`). Output: per-Delta scope deltas the plan-02 author MUST consume before `[a]` Goal authoring.

---

## TL;DR

%% *Last Modified: 05/03/26 16:26:34* %%

| Layer | Pre-Plan-01 Assumption | Post-Plan-01 Reality | Plan-02 Impact |
|---|---|---|---|
| **D1 grammar** | Build `extractWikilinks` + 10 forms | **SHIPPED** in `ec85098` | D1 phase = adversarial-fixture verification only |
| **D2 residual scanner** | Build module + extend `ValidationReport` | NOT shipped | Intact, but new Phase-0 sibling-module sweep required |
| **D3 interface change** | `manager.validate()` Type-I + exit-code refactor | NOT shipped | Intact |
| **D4 wiki resolver** | Build `resolveWikiPath` + `wikiPageSlug` + validator wiring + Levenshtein | **MOSTLY SHIPPED** — Levenshtein + adaptive threshold + path-aware display NOT shipped | D4 phase shrinks to Levenshtein-only |
| **D5 docs alignment** | 3 docs to update | NOT shipped | Intact |
| **§9f hardening pipeline** | Build 5 gates as Phase-0 (~10–12h) | **SCAFFOLDED** — 5 scripts + ESLint config + C1–C6 tests on disk; C3 + C6 intentionally RED | Phase-0 closes RED gates instead of green-fielding |
| **Process rules §9b–§9d** | New for plan-02 | Authored | Embed verbatim into plan-02 Constraints (HC) |

**Net effect:** plan-02 scope shrinks ~40% on feature work, expands on Phase-0 hardening closure + adversarial-fixture work.

---

## Source Reconciliation

%% *Last Modified: 05/03/26 16:26:34* %%

### S1 — Plan-01 ship commit `ec85098`

%% *Last Modified: 05/03/26 16:26:34* %%

[OBS] Commit message: *"feat: wikilink validation, AST smart-default scope, hardening-pipeline scaffolding. Three feature areas squashed from ast-scope branch (~80 commits)."* [^S-ec85098]

Shipped from plan-01:
- `extractWikilinks.ts` (D1 grammar)
- `resolveWikiPath.ts`, `wikiPageSlug.ts` (D4 resolver core)
- `isInsideCodeBlock.ts`, `isInsideInlineCode.ts` (Phase 5 + 6 fenced/inline exclusion)
- CitationValidator wiring (consumes parser-resolved wiki paths; no re-resolution)
- Loud-fail surfacing for broken wiki links; both attempted paths rendered
- Plan-01 retrospective + learnings → `plan-01-learnings.md` (now in `.archive/`)

Did NOT ship from plan-01:
- D2 residual-bracket scanner + `unrecognized[]` field
- D3 `manager.validate()` Type-I return-shape change + exit-code refactor + display-class taxonomy
- D4 Levenshtein adaptive-threshold suggestion + path-aware display + multi-match disambiguation
- D5 doc alignment (CLAUDE.md, JSDoc, component guide)

### S2 — Hardening-pipeline scaffold

%% *Last Modified: 05/03/26 16:26:34* %%

[OBS] Three commits — `643024a` *"feat(hardening-pipeline): Add pipeline infrastructure with tests"*, `a483992` *"test(hardening-pipeline): add tests for all 6 validation stages"*, `02cd723` *"chore(infra): add analysis scripts and update infrastructure"*.

On disk:
- `scripts/defer-language-scan.sh` (D5-§9f → C3)
- `scripts/find-dead-fields.sh` (D2-§9f → C1)
- `scripts/prod-callgraph-trace.sh` (D3-§9f)
- `scripts/service-level-smoke.sh` (D4-§9f)
- `scripts/plan-eval.sh` (C2)
- `eslint.config.js` (D1-§9f flat config + `HARDENING-ALLOWLIST`-driven injectable types ban — `FileCache`, `FileSystemInterface`, `LinkObjectFactory`, etc.)
- `test/hardening-pipeline/c1-d1-injectable-bans.test.ts` … `c6-fixture-template.test.ts`

[OBS] Commit `ec85098` message: *"Known red tests (intentional): c3-defer-language-scan (1 fail — plan-01-learnings.md retrospective discusses defer language; needs exemption); c6-fixture-template (3 fail — fixture-template.md not yet authored)."*

[OBS] Working-tree change (uncommitted, per `git status`): `D design-docs/hardening-pipeline/fixture-template.md`, `D design-docs/hardening-pipeline/state.md`. The fixture-template + state docs were deleted; this is mid-flight refactor of where hardening-pipeline lives. Plan-02 must clarify the canonical home before [a].

### S3 — Plan-01 retrospective rules (now binding for plan-02)

%% *Last Modified: 05/03/26 16:26:34* %%

[OBS] Per `.archive/plan-01-learnings.md` §9b/9c/9d/9f, plan-02 Phase-0 MUST include:

1. Consumer-side LSP audit on every new shape field (writers + readers; both > 0).
2. Sibling-module sweep before adding any `extractX.ts` / `resolveX.ts` / `isInsideX.ts`.
3. Service-level (CLI) hard gates — not parser-level.
4. Adversarial CommonMark fixtures before any lexer change.
5. No deferral language in any STATE-WRITE (banned tokens enforced by `defer-language-scan.sh`).
6. Reviewer authority = SHIP / NO-SHIP only; no "ship with caveats."
7. Coder `findReferences` self-check on COMMIT for every new field.

---

## Per-Delta Assumption Deltas

%% *Last Modified: 05/03/26 16:26:34* %%

### D1 — Consolidated Wikilink Grammar

%% *Last Modified: 05/03/26 16:26:34* %%

| Aspect | Assumption (plan §7a) | Reality | Delta |
|---|---|---|---|
| Module | Build `extractWikilinks` covering 10 forms | Shipped in `ec85098` | Drop "implement" tasks |
| Code-block exclusion | Out of scope | Shipped (`isInsideCodeBlock`, `isInsideInlineCode`) — Phase 5 + 6 of plan-01 | New verification surface for plan-02 |
| Adversarial fixtures | Not specified | NOT shipped; §9b rule #4 makes mandatory | New Phase-0 task |
| Inline-code triple-backtick parity (§9b Item 4) | Unknown | Known parser-correctness bug surfaced post-Phase-5 | Plan-02 D1 phase MUST include adversarial-fixture suite covering CommonMark §4.5 + §6.1 |

**Plan-02 D1 phase reduces to:** (a) author CommonMark adversarial fixtures, (b) verify all 10 forms still pass under fenced+inline mixed lines, (c) confirm `getCodeBlockLines` (in `extractLinks.ts:75-102`) + `isInsideCodeBlock.ts` are NOT a parallel-implementation violation per §9b Item 3 (sibling-module sweep verdict).

### D2 — Residual-Bracket Scanner

%% *Last Modified: 05/03/26 16:26:34* %%

| Aspect | Assumption | Reality | Delta |
|---|---|---|---|
| Scanner module | Build new sibling utility | NOT shipped | Intact — but §9b Item 3 mandates `documentSymbol` sweep on `src/core/MarkdownParser/` BEFORE adding the file |
| `unrecognized[]` field on `ValidationResult` | Add new field | NOT shipped | Intact — but §9c canonical-cheat rule mandates `findReferences` (writers > 0 AND readers > 0) gate at COMMIT |
| Schema departure (`UnrecognizedSyntaxRecord`) | Define | NOT defined | Intact |
| Display section (UNRECOGNIZED block in CLI) | Add to minimal + verbose | NOT shipped | Intact |

**Risk:** D2 introduces the highest density of new fields → highest exposure to dead-field cheat. Plan-02 D2 phase MUST run consumer-side LSP audit on `summary.unrecognizedCount`, top-level `unrecognized[]`, and every `UnrecognizedSyntaxRecord` field at COMMIT.

### D3 — Coverage-Qualified Output + Type-I Interface Change

%% *Last Modified: 05/03/26 16:26:34* %%

| Aspect | Assumption | Reality | Delta |
|---|---|---|---|
| `LinkClass` discriminator + `getLinkClass.ts` | Add | NOT shipped | Intact |
| `ReportSummary` extensions (`byLinkClass`, `unrecognizedCount`, `errorBreakdown`) | Add | NOT shipped | Intact |
| `manager.validate()` return shape `Promise<{output, result}>` | Type-I change | NOT shipped | Intact — but Type-I change requires explicit ADR per §7a Notes column |
| Exit-code refactor (string-match → structured-field) | Refactor | NOT shipped | Intact |
| Verbose SUMMARY block additions | Add | NOT shipped | Intact |

**No scope change.** D3 is the largest remaining piece and dominates plan-02 effort. Plan-02 author should keep D3 as its own phase with discrete review gate.

### D4 — Wiki Page Name Resolution + Levenshtein

%% *Last Modified: 05/03/26 16:26:34* %%

| Aspect | Assumption | Reality | Delta |
|---|---|---|---|
| `resolveWikiPath.ts` 2-step (exact + slug) | Build | **SHIPPED** | Drop |
| `wikiPageSlug.ts` slugifier | Build | **SHIPPED** | Drop |
| FileCache REQUIRED end-to-end | Wire optional | **SHIPPED** as REQUIRED (forced post-Gate-2 in plan-01) | Drop |
| Validator consumes parser-resolved path (no re-resolution) | Wire | **SHIPPED** (Phase-6 forced) | Drop |
| Loud-fail with `Tried: <raw>, <slug>.md` | Add | **SHIPPED** (Phase-6 forced) | Drop |
| Levenshtein adaptive threshold (basename-distance, `clamp(3, 10, floor(0.2 × pathLen))`) | Add | NOT shipped | **Plan-02 D4 phase = this only** |
| Path-aware display of suggestion (full relative path; multi-match comma-separated) | Add | NOT shipped | Intact |
| Multi-match disambiguation (≥2 candidates within threshold) | Add | NOT shipped | Intact |

**Plan-02 D4 phase reduces ~70%** — only the suggestion layer remains. Phase rationale should reference plan-01 §9c canonical-cheat rule (the optional-injected-dep cheat surfaced exactly here in plan-01; D4 work in plan-02 must NOT add any optional injectable).

### D5 — Documentation Alignment

%% *Last Modified: 05/03/26 16:26:34* %%

| Aspect | Assumption | Reality | Delta |
|---|---|---|---|
| `jact/CLAUDE.md` Citation Patterns | Update to 10 forms | NOT updated | Intact |
| `MarkdownParser.ts` JSDoc | Update | NOT updated | Intact |
| Component guide "Wikilink Grammar" subsection | Add | NOT added | Intact |

**Risk:** D5 is now self-policing — `defer-language-scan.sh` will fail any commit that uses banned tokens. Plan-02 author must verify the doc-update wording itself does not trip C3.

---

## Hardening-Pipeline Closure (NEW Plan-02 Phase 0)

%% *Last Modified: 05/03/26 16:26:34* %%

The §9f pipeline assumed plan-02 builds the gates from scratch (~10–12h). Reality: 5 scripts + ESLint config + C1–C6 tests already exist. Plan-02 Phase 0 closes the RED gates instead of green-fielding:

| Gate | Status | Plan-02 Phase-0 Task |
|---|---|---|
| **C1 — D1 injectable-bans (ESLint)** | likely GREEN (config + test on disk) | Run; if RED, fix `src/` violations |
| **C2 — `plan-eval.sh`** | unknown | Run; document exit code |
| **C3 — `defer-language-scan.sh`** | **RED (intentional)** — banned tokens in `plan-01-learnings.md` (now archived) and possibly `plan.md` §9b–§9f | Verify archival relocates the violation OR add scoped exemption to script |
| **C4 — portability** | unknown | Run; document exit code |
| **C5 — historical-replay** | unknown | Run; document exit code |
| **C6 — `fixture-template`** | **RED (intentional)** — `design-docs/hardening-pipeline/fixture-template.md` was deleted in working tree | Re-author at canonical location OR update test path; resolve mid-flight refactor |
| **D3 §9f gate (`prod-callgraph-trace.sh`)** | script on disk; no test ID identified | Confirm coverage; map to a Cn slot if missing |
| **D4 §9f gate (`service-level-smoke.sh`)** | script on disk; no test ID identified | Same |

**[A] Risk-if-wrong:** if Phase-0 doesn't close C3 + C6 first, every plan-02 phase commit fails CI on intentional REDs. Plan-02 author MUST add Phase-0 task: "Resolve C3 + C6 to GREEN before any feature work begins." Mitigation cost: ~30–60 min (relocate fixture-template.md, scope-exempt the archived retrospective).

---

## Anti-Pattern Watchlist Pre-Scan (Plan-02 Authoring)

%% *Last Modified: 05/03/26 16:26:34* %%

Per `writing-odd-state-files` Phase 0:

| Anti-Pattern | Risk in Plan-02 | Mitigation |
|---|---|---|
| `silent-gate-bypass` | LOW — HARD GATE [e] is mandatory; user has been treating gates seriously | Standard [e] flow |
| `goal-mutation-without-escalate` | MEDIUM — D1 + D4 scope shrunk substantially; tempting to silently revise Goal mid-loop if more reality drift surfaces | Lock Goal to "ship D2 + D3 + D5 + D4-Levenshtein + close hardening REDs"; any further drift → [l] ESCALATE |
| `vague-success-criteria` | MEDIUM — multi-Delta plan invites freeform criteria | Per-Delta criterion with explicit metric (`output_contains` for CLI text, `custom` for hardening-gate exit codes) |
| `untagged-constraints` | LOW — §9b–§9d already category-tagged (scope, quality, safety) | Copy verbatim |
| `outcome-struct-elision` | HIGH — `service-level-smoke.sh` + ESLint output is verbose; tempting to record "pass/fail" only | Mandate full Outcome struct on every [g] |
| `implementation-before-tests` | HIGH — D2 + D4-Levenshtein are TDD candidates | Block [j] until [f]/[g] RED |
| `re-entry-re-authoring` | LOW — fresh state file | Standard [r] |
| `silent-write-elision` | MEDIUM — multi-Delta plan = many transitions | Mandate [w] + Change Log entry per transition |
| `weight-arithmetic-failure` | LOW — short criterion list | Show explicit math at [h] |
| `mixed-goal-and-outcomes` | MEDIUM — `ship D1–D5` reads outcome-y | Goal = "Close gap between shipped wikilink validator and full §7a delta spec, including Type-I interface change and hardening-pipeline RED closure" |

---

## Recommended Plan-02 Goal (DRAFT input for [a])

%% *Last Modified: 05/03/26 16:26:34* %%

> Close the gap between the wikilink validator shipped in `ec85098` and the full §7a Delta Architecture spec. Specifically: (a) close hardening-pipeline RED gates (C3 + C6) so plan-02 commits pass CI; (b) ship D2 residual-bracket scanner as a fail-fast surface for unrecognized wiki syntax; (c) ship D3 coverage-qualified output including the Type-I `manager.validate()` return-shape change and structured-field exit-code refactor; (d) ship D4 Levenshtein adaptive-threshold suggestion layer with path-aware display + multi-match disambiguation; (e) ship D5 documentation alignment across `jact/CLAUDE.md`, `MarkdownParser.ts` JSDoc, and the component guide. All work runs under §9b–§9d–§9f process constraints (consumer-side LSP audit, sibling-module sweep, no-deferral-language, SHIP/NO-SHIP reviewer, deterministic gates as first line).

**Files this plan touches** (per §7a + reality):
- `src/core/MarkdownParser/extractLinks.ts` (D2)
- `src/core/MarkdownParser/resolveWikiPath.ts` (D4 Levenshtein add)
- `src/core/getLinkClass.ts` (D3 — new file)
- `src/types/validationTypes.ts` (D2 + D3)
- `src/types/citationTypes.ts` (D3)
- `src/CitationValidator.ts` (D3 + D4 suggestion wiring)
- `src/jact.ts` (D3 manager + formatters + exit-code)
- `src/utils/stringDistance.ts` (D4 reuse)
- `jact/CLAUDE.md`, `src/core/MarkdownParser/MarkdownParser.ts` JSDoc, `design-docs/component-guides/MarkdownParser Component Guide.md` (D5)
- `design-docs/hardening-pipeline/fixture-template.md` re-author or relocate (Phase-0 C6 closure)
- `scripts/defer-language-scan.sh` exemption logic (Phase-0 C3 closure — only if archive scoping insufficient)

---

## Open Questions for User Before [a] Goal Lock

%% *Last Modified: 05/03/26 16:26:34* %%

| # | Q | Why it matters before [a] |
|---|---|---|
| Q1 | Is `design-docs/hardening-pipeline/` the canonical home, or does it move to `design-docs/features/`? Working-tree shows `state.md` + `fixture-template.md` deleted. | C6 RED closure path depends on it |
| Q2 | Should plan-01 retrospective (now in `.archive/`) remain scanned by C3 or be exempted? | Determines C3 closure approach (move file vs. exempt path glob) |
| Q3 | Does plan-02 = single state file (this skill's output) OR separate ODD state file + plan-02 implementation plan (per `application-tech-lead` + `bdd-test-writer` + `plan-sequencer` pipeline in §8.3)? | Determines whether [a]–[w] authoring produces an executable plan or a state file referencing a separate plan |
| Q4 | 2-file structure (plan-02 monolithic with internal D2/D3/D4/D5 phase headings) vs. 5-file structure (one plan per Delta)? Per §8.3 [A] note, both are open. | Drives task table cardinality + review-gate placement |

---

## Source Footnotes

%% *Last Modified: 05/03/26 16:26:34* %%

[^S-ec85098]: `git show ec85098` commit message body. Squashed plan-01 ship from `ast-scope` branch on 2026-05-03.
