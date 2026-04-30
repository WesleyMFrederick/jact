# Architecture Evaluation: LLM-Optimized Default Output for `jact validate`

%% *Last Modified: 04/29/26 22:41:08* %%

**Plan reviewed:** [plan.md](./plan.md)
**Reviewer:** application-tech-lead
**Date:** 2026-04-29

## Citation Context

%% *Last Modified: 04/29/26 22:41:08* %%

Ran `jact extract links` against the plan with `--scope` set to the jact repo root.

- **Result:** 0 wiki-linked documents extracted
- **Implication:** Plan is self-contained. No upstream design docs, PRDs, or component guides referenced. Evaluation is based solely on plan contents.
- **Note:** This is itself a minor finding — a plan modifying `formatForCLI` (in `src/jact.ts`) and `FileCache.ts` could profitably reference the **CLI Orchestrator Implementation Guide** and **FileCache** component guide in `design-docs/component-guides/` to confirm boundary contracts.

## Principle Compliance

%% *Last Modified: 04/29/26 22:41:08* %%

| Category | Status | Details |
|---|---|---|
| Modular Design | ✅ Compliant (minor concern) | Change is localized to `formatForCLI` and `FileCache`. DI threading via `componentFactory` preserves loose coupling. Concern: branching inside `formatForCLI` rather than splitting into two action-named functions. |
| Data-First Design | ⚠️ Partial | Adds primitive `verbose: boolean` flag. Output shape is rendered from branching logic, not from a structured output-mode data model. `--verbose` + `--format json` interaction is implicit. |
| Action-Based File Organization | ➖ Not engaged | No new files. Pre-existing tech debt (formatter living inside `jact.ts` orchestrator rather than a `formatValidationResult.ts` action file) is not addressed. Acceptable scope decision. |
| Format/Interface Design | ✅ Compliant | Strong alignment: minimal default = Simplicity First; `--verbose` for specialists = Progressive Defaults + Progressive Disclosure. |
| MVP Principles | ✅ Compliant | Explicit Out of Scope section. Reuses existing formatter/commander/test infrastructure. Direct branch implementation over redesign. |
| Deterministic Offloading | ✅ Compliant | Strengthens determinism: `OK: N citations valid` / `FAILED: X errors, Y warnings` are stable, parseable contracts. Reduces LLM context noise. |
| Self-Contained Naming | ✅ Compliant (minor concern) | `--verbose`, `OK:`, `FAILED:`, `ERRORS`, `WARNINGS` all self-explanatory. Concern: `verbose?: boolean` on `FileCache` constructor is ambiguous in that scope — better as `emitDuplicateWarnings?: boolean`. |
| Safety-First Design | ✅ Compliant | No data modification. Exit codes preserved. JSON contract preserved. Backward-compat path via `--verbose`. Concern: not flagged as a breaking change for external consumers. |
| Anti-Patterns Check | ⚠️ Minor risk | **Branch Explosion** risk if more output modes added later (e.g., `--summary`). **Leaky Flags** risk on `--verbose` + `--format json` interaction (undefined). No hidden global state — `verbose` threaded explicitly. |

## Prioritized Findings

%% *Last Modified: 04/29/26 22:41:08* %%

### Fix Now (Blocking MVP)

%% *Last Modified: 04/29/26 22:41:08* %%

None. Plan is well-scoped, evidence-based, and ready to implement.

### Fix During Implementation (Small additions to plan)

%% *Last Modified: 04/29/26 22:41:08* %%

1. **Specify `--verbose` × `--format json` interaction** (Anti-Patterns: Leaky Flags / Format Design: Interface Segregation)
   - Plan currently says "`--format json` behavior is preserved exactly" but doesn't say what happens when both flags are passed.
   - **Recommendation:** Define explicitly. Likely answer: `--verbose` is silently ignored under `--format json` (JSON is already complete data; verbosity is a CLI-only concept).
   - **Action:** Add one line to "Default Output Contract" section + add one assertion in the new test.

2. **Rename `FileCache` constructor flag for self-contained naming** (Self-Contained Naming: Descriptive Labels)
   - Plan step 5 adds `verbose?: boolean` to `FileCache` constructor. The name doesn't convey *what* gets verbose at the FileCache layer.
   - **Recommendation:** Use `emitDuplicateWarnings?: boolean`. The CLI flag stays `--verbose`; the orchestrator translates `options.verbose → emitDuplicateWarnings: true` when wiring the factory.
   - **Action:** Update step 5 of plan + factory signature.

3. **Document the breaking change** (Safety-First: Clear Contracts)
   - Default-output change breaks any external script that greps for `VALID CITATIONS` or `SUMMARY:` in stdout. Plan covers internal test fallout but not external consumers.
   - **Recommendation:** Add a `CHANGELOG.md` entry and a `BREAKING CHANGE:` note in the commit. Update README if it shows default output examples.
   - **Action:** Add as step 9 in Implementation Steps.

### Fix Post-MVP (Hardening)

%% *Last Modified: 04/29/26 22:41:08* %%

1. **Output mode as data, not boolean flag** (Data-First: Behavior as Data; Anti-Patterns: Branch Explosion)
   - If a third mode is ever added (e.g., `--summary`-only), the boolean explodes into multiple flags or branches.
   - **Future direction:** Replace `verbose: boolean` with `outputMode: "minimal" | "verbose"` and dispatch via a strategy map. Defer until a third mode is actually needed (Implement When Needed).

2. **Extract `formatForCLI` into action-named file** (Action-Based File Organization)
   - Pre-existing debt: a 100+ line formatter lives inside the CLI orchestrator. Out of scope for this plan, but worth tracking.
   - **Future direction:** `src/core/formatValidationResult/formatValidationResult.ts` with `formatMinimal.ts` and `formatVerbose.ts` as siblings. Defer.

### Already Mitigated

%% *Last Modified: 04/29/26 22:41:08* %%

- **Scope creep** — Plan's "Out of Scope" section explicitly excludes JSON output, `--fix`, `ast`/`extract`/`base-paths` commands, color/symbol changes, and validator core refactors.
- **Test regressions** — Step 6 enumerates exact test files and line numbers requiring updates, plus adds one new test for the minimal contract.
- **Hidden global state** — Plan explicitly considers and rejects a "module-level flag" for FileCache in favor of constructor injection (step 5).
- **Verification gaps** — End-to-end Verification section provides concrete commands for clean file, broken file, JSON unchanged, exit codes, and token-count check.

## Verdict

%% *Last Modified: 04/29/26 22:41:08* %%

- [X] **Ready to proceed** with three small additions to the plan (the "Fix During Implementation" items above)
- [ ] Requires revision

The plan is a textbook MVP-aligned change: tight scope, explicit non-goals, evidence-based critical-files table with line numbers, concrete verification, and reuse over redesign. The three small additions above sharpen the contract (flag interaction, FileCache naming, breaking-change documentation) without expanding scope.

_We are Oscar Mike_
