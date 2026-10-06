# PR 101 Testing Evaluation Report

## Evaluation Metadata

- **Reviewer Role**: Architecture compliance reviewer — test design and regression safety
- **Domain Vocabulary**: behavioral contract, module boundary, error path, failure mode, fail closed, regression promotion, end-to-end flow, anti-test target, snapshot test, cosmetic output, test sprawl, source mirroring, one file per module, shared test helper, fixture directory, describe/it naming, Arrange-Act-Assert, factory setup, beforeEach lifecycle, real tmpdir, in-memory adapter, vi.mock last resort, fault injection, skipIf gating, per-it retry, quality gate, tests as documentation, centralized cleanup, deterministic isolation
- **Principle Set**: `testing` (explicit, assigned by the parent; no core pairing)
- **Principle Set Resolution**: explicit set from the parent assignment; no confirmation gate
- **Graduated Loading**: Phase 1 `jact outline` found 7 evaluable categories plus the structural "Footnotes — Source Paths" heading (skipped). Phase 2 `jact extract file` loaded 192 lines.
- **Output Path**: `docs/reviews/pr-101-testing-eval-report.md`
- **Files Evaluated**: published `test/cli-integration/rename-command.test.ts` at commit `7d627ae6b0ed77b050c0c4ae1a8a09ef27dcc27c`, plus the code paths it covers in `src/core/rename-markdown-file.ts`, `src/jact-cli.ts`, and `src/cli.ts`
- **Category Todos**: Test Scope and Targets; Anti-Test Targets; Test Organization and Sprawl Prevention; Test Authoring Style (BDD / AAA); Test Infrastructure and Doubles; Vitest-Specific Conventions; Test Quality Gates and Maintenance — all evaluated

## Citation Context

- Principles: [Testing Principles](https://github.com/WesleyMFrederick/0-documents/blob/main/markdown-documents/architecture-principles/testing/testing-principles.md#Testing%20Principles)
- Access note: The canonical principle repository is private. These links work across checkouts for readers with repository access.
- Requirement source: [jact rename interface](../spec/005-interfaces.md#`jact%20rename%20<source...>%20<destination>`) — refusal list, rollback and backup contract, JSON shape
- `src/core` and `src/jact-cli.ts` have no module `SPEC*.md`; the root living spec applies. The parent may offer a cold-start session that uses the `writing-living-specs` skill for these modules.

### Evidence Basis

| Evidence | Observer | Result |
|---|---|---|
| Published rename suite in an isolated archive of commit `7d627ae` | Parent | 14 of 14 passed |
| Local working-tree rename suite | Parent | 16 of 16 passed (local only, not published) |
| Literal file `notes/[ab].md` beside `a.md` and `b.md`; `rename notes/[ab].md new.md --fix` on the published build | Parent | Exit 0; all three files moved under a new `new.md/` directory |
| Fault injection: second move writes `foreign.txt` into `new/dir`, then throws | Parent | Exit 2 (ENOTEMPTY on `new/dir`); moves reversed, but `a.md` and `index.md` kept their rewritten links |
| Moved directory `notes` holds `secret.md`, a symlink to a file outside scope | Parent | Exit 0; `archive/secret.md` became a regular file with the outside file's private content |
| Escaped prose `\!\[\[notes/p.png\]\]` in `index.md`, folder move | Parent | Exit 1; refused as an image embed, but the text is not image syntax |
| Reference-style image `![picture][pic]` | Parent | Move succeeds; definition rewritten. Not a defect. |
| Normal `![[notes/p.png]]` incoming embed | Parent | Correctly refused (covered by a test) |

This reviewer did not run tests, builds, or the CLI.

### Published Test Inventory (14 tests)

| Lines | Test | Base status |
|---|---|---|
| 89–136 | Single file: preview writes nothing; apply rewrites link forms | Existing |
| 138–184 | Single file: move into directory; incoming and outgoing links | Existing |
| 186–196 | Single file: destination exists, exit 1 | Existing |
| 198–212 | Single file: destination outside scope, exit 1 | Existing |
| 263–313 | Batch: two linked files into a missing nested directory, with preview | New |
| 315–354 | Folder with subfolder and image into an existing directory | New |
| 356–378 | Glob source into a directory | New |
| 380–435 | `it.each`, 6 refusals: collision, non-Markdown source, same destination, directory into itself, empty glob, breaking image embed | New |
| 437–462 | Mid-commit failure (`chmod 0o555`) rolls back, exit 2 | New |

## Principle Compliance

| Category | Status | Details |
|---|---|---|
| [Test Scope and Targets](https://github.com/WesleyMFrederick/0-documents/blob/main/markdown-documents/architecture-principles/testing/testing-principles.md#Test%20Scope%20and%20Targets) | ❌ | Happy paths and 7 refusals run through the real CLI. Gaps against [Error Paths and Failure Modes](https://github.com/WesleyMFrederick/0-documents/blob/main/markdown-documents/architecture-principles/testing/testing-principles.md#^test-error-paths): (1) the spec's "rollback failure" exit-2 path has no test; the published recovery stops at `rmdirSync` (`src/core/rename-markdown-file.ts:776-778`) and skips file restoration (`:779-782`), as the parent probe showed. (2) A source with glob characters that names an existing file has no test; `src/jact-cli.ts:741` expands it as a glob, and the probe moved three files. (3) Symlinks inside a moved directory have no test; `filesUnder` (`src/core/rename-markdown-file.ts:309-316`) treats a symlink as a plain file, and the probe copied outside content into scope. (4) The wiki-embed scan (`:542-548`) has no negative test for escaped text; the probe shows a false refusal. (5) Spec refusals without a test: unresolved outgoing link, source inside another directory source, destination inside another moved directory, destination equals source, missing source in a batch. (6) The rule "a directory moved to a missing path becomes that path" has no success test. |
| [Anti-Test Targets](https://github.com/WesleyMFrederick/0-documents/blob/main/markdown-documents/architecture-principles/testing/testing-principles.md#Anti-Test%20Targets) | ✅ | No `toMatchSnapshot`. The `snapshot()` helper (lines 237–251) compares exact file trees, which is the user-visible result. `stderr` uses substring checks, not full cosmetic output. JSON counts (`links`, `movedFiles`) are consumer contract fields. No type-level or framework re-tests. |
| [Test Organization and Sprawl Prevention](https://github.com/WesleyMFrederick/0-documents/blob/main/markdown-documents/architecture-principles/testing/testing-principles.md#Test%20Organization%20and%20Sprawl%20Prevention) | ➖ | Batch tests extend the existing `rename-command.test.ts` instead of a concern-split file, per [One Test File Per Source Module](https://github.com/WesleyMFrederick/0-documents/blob/main/markdown-documents/architecture-principles/testing/testing-principles.md#^test-one-file-per-source). The 843-line `src/core/rename-markdown-file.ts` has no mirrored test, so pure planners (`pathAfterMoves`, `brokenEmbeds`, `planMoves`) are reachable only through a subprocess. Fixtures are small inline strings. Helpers (`runBatch`, `writeTree`, `snapshot`) stay file-local with one consumer. |
| Test Authoring Style (BDD / AAA) — [describe/it naming](https://github.com/WesleyMFrederick/0-documents/blob/main/markdown-documents/architecture-principles/testing/testing-principles.md#^test-describe-it-naming) | ✅ | `describe` names the subject; new `it` names state Given/When/Then behavior. Nesting depth is 1. Multi-assertion blocks are used as intended. The new `describe` uses `beforeEach`/`afterEach` only for directory lifecycle and builds inputs with the `writeTree` factory, per [Setup via Factory Functions](https://github.com/WesleyMFrederick/0-documents/blob/main/markdown-documents/architecture-principles/testing/testing-principles.md#^test-factory-not-beforeeach). The existing `describe` (lines 76–83) builds inputs in `beforeEach`; this predates the PR. Two naming styles now share one file; cosmetic only. |
| [Test Infrastructure and Doubles](https://github.com/WesleyMFrederick/0-documents/blob/main/markdown-documents/architecture-principles/testing/testing-principles.md#Test%20Infrastructure%20and%20Doubles) | ✅ | Real filesystem under `os.tmpdir()`, no virtual filesystem, no `vi.mock`, no fake timers. The rollback test uses a real permission fault. Isolation limit: fixed directory names (lines 21 and 215) let two worktrees that run the suite at the same time delete each other's fixtures; the repo mixes this pattern with `mkdtempSync`. |
| [Vitest-Specific Conventions](https://github.com/WesleyMFrederick/0-documents/blob/main/markdown-documents/architecture-principles/testing/testing-principles.md#Vitest-Specific%20Conventions) | ✅ | Explicit `vitest` imports (line 15). `it.each` with `$name` titles. `it.skipIf(process.getuid?.() === 0)` gates the permission fault, per [skipIf for environment-gated tests](https://github.com/WesleyMFrederick/0-documents/blob/main/markdown-documents/architecture-principles/testing/testing-principles.md#^test-skipif-for-env-gated). No `retry`. The repo config's `coverage` block predates the PR. |
| [Test Quality Gates and Maintenance](https://github.com/WesleyMFrederick/0-documents/blob/main/markdown-documents/architecture-principles/testing/testing-principles.md#Test%20Quality%20Gates%20and%20Maintenance) | ❌ | The PR adds tests with the behavior, per [Tests Are Documentation](https://github.com/WesleyMFrederick/0-documents/blob/main/markdown-documents/architecture-principles/testing/testing-principles.md#^test-as-documentation). But the suite passed 14 of 14 while parent probes found three consumer-visible defects and one false refusal, so the tests do not yet document the safety contract. Batch, glob, and folder previews are not checked for "writes nothing"; only line 296 checks one directory. The suite runs `dist/cli.js`, so `npm test` without a fresh build tests stale code; this is an existing repo convention, not introduced here. |

## Critical Issues (Severity: High)

1. **Rollback failure path untested; published rollback leaves rewritten links.** The spec says a failure undoes moves, removes created directories, restores edited files, and exits 2. Published `src/core/rename-markdown-file.ts:768-789` runs all recovery steps in one `try`, so an `rmdirSync` error skips file restoration. Parent probe: exit 2; `a.md` and `index.md` kept rewritten links. Principle: [Error Paths and Failure Modes](https://github.com/WesleyMFrederick/0-documents/blob/main/markdown-documents/architecture-principles/testing/testing-principles.md#^test-error-paths).
2. **Literal filename with glob characters untested; published code moves the wrong files.** `src/jact-cli.ts:741` treats every dynamic-looking path as a glob. Parent probe: `notes/[ab].md` moved `a.md`, `b.md`, and `[ab].md` into a new `new.md/` directory, exit 0. Principles: [Error Paths and Failure Modes](https://github.com/WesleyMFrederick/0-documents/blob/main/markdown-documents/architecture-principles/testing/testing-principles.md#^test-error-paths), [Regressions Are Promoted](https://github.com/WesleyMFrederick/0-documents/blob/main/markdown-documents/architecture-principles/testing/testing-principles.md#^test-regressions-promoted).
3. **Symlinked descendants of a moved directory untested; scope guard bypassed.** `filesUnder` (`src/core/rename-markdown-file.ts:309-316`) lists a symlink as a file with no scope or identity check. Parent probe: an outside file's private content became a regular file inside scope. No local fix exists. Principle: [Behavioral Contracts at Module Boundaries](https://github.com/WesleyMFrederick/0-documents/blob/main/markdown-documents/architecture-principles/testing/testing-principles.md#^test-behavioral-contracts).

## Recommendations

1. Add a test that a symlink inside a moved directory, pointing outside scope, is refused. Then check each descendant's real path against scope in `filesUnder`.
2. Add a success test: escaped `\!\[\[dir/p.png\]\]` text must not block a move. The scan at `src/core/rename-markdown-file.ts:542-548` runs a regex over decoded `text` nodes, so escaped prose looks like an embed.
3. Extend the refusal table (lines 380–411) with the untested spec rows: unresolved outgoing link, source inside a directory source, destination inside a moved directory, destination equals source, missing batch source.
4. Add a success test for a directory moved to a path that does not exist.
5. In each batch, glob, and folder test, take `snapshot()` before the preview and assert it is unchanged after.
6. Assert that the backup of an edited file inside a moved directory exists at the reported final path.
7. Use `mkdtempSync` for `workDir` and `batchDir`.

## Verdict

- [ ] Ready to proceed
- [x] Requires revision (published HEAD). Local fixes cover critical issues 1 and 2 only.

## Prioritized Findings

### Fix Now

1. Symlinked-descendant test plus scope check — [Behavioral Contracts](https://github.com/WesleyMFrederick/0-documents/blob/main/markdown-documents/architecture-principles/testing/testing-principles.md#^test-behavioral-contracts) — about 25 min.
2. Escaped-embed false refusal: test plus scan fix — [Error Paths and Failure Modes](https://github.com/WesleyMFrederick/0-documents/blob/main/markdown-documents/architecture-principles/testing/testing-principles.md#^test-error-paths) — about 25 min.
3. Missing spec refusal rows — [Error Paths and Failure Modes](https://github.com/WesleyMFrederick/0-documents/blob/main/markdown-documents/architecture-principles/testing/testing-principles.md#^test-error-paths) — about 15 min; rows in the `it.each` table.
4. Directory-to-new-path success test — [Behavioral Contracts](https://github.com/WesleyMFrederick/0-documents/blob/main/markdown-documents/architecture-principles/testing/testing-principles.md#^test-behavioral-contracts) — about 10 min.
5. Read-only preview assertions for batch, glob, and folder — [Tests Are Documentation](https://github.com/WesleyMFrederick/0-documents/blob/main/markdown-documents/architecture-principles/testing/testing-principles.md#^test-as-documentation) — about 10 min.
6. Backup final-location assertion inside a moved directory — [Behavioral Contracts](https://github.com/WesleyMFrederick/0-documents/blob/main/markdown-documents/architecture-principles/testing/testing-principles.md#^test-behavioral-contracts) — about 10 min.
7. `mkdtempSync` temp roots — [Real filesystem on tmpdir](https://github.com/WesleyMFrederick/0-documents/blob/main/markdown-documents/architecture-principles/testing/testing-principles.md#^test-real-tmpdir-not-virtual-fs) — about 10 min.

### Architectural Rework Required

1. Mirrored core test for `src/core/rename-markdown-file.ts` — [Tests Mirror Source Structure](https://github.com/WesleyMFrederick/0-documents/blob/main/markdown-documents/architecture-principles/testing/testing-principles.md#^test-mirror-source-structure) — about 45 min. Scope: new `test/core/rename-markdown-file.test.ts` that calls `renameMarkdownFiles` with factory-built dependencies for planner edge cases (path mapping, embed scan, overlap rules). Revisit trigger: the next change to `planMoves`, `brokenEmbeds`, or `commitPlan`. Maintainability advice, not a bug.

### Already Mitigated (local working tree only, not published)

1. Rollback failure: local `commitPlan` runs each recovery step on its own and restores edited files at post-failure paths. A new local test injects an `fs.renameSync` fault through `node --import` and checks restored content, a surviving foreign file, and exit 2. The parent observed 16 of 16 pass locally. The fault injection patches a Node module in the child process, which is the subprocess form of [vi.mock as last resort](https://github.com/WesleyMFrederick/0-documents/blob/main/markdown-documents/architecture-principles/testing/testing-principles.md#^test-vi-mock-last-resort); no other seam fails the second rename after the first succeeds, so it is acceptable.
2. Literal glob-character filename: local `src/jact-cli.ts` treats an existing path as literal; a new local test checks that only `notes/[ab].md` moves.

These local fixes are not evidence that the published PR complies.

## Document Hygiene (changed Markdown in the PR)

Files: `README.md`, `docs/spec/005-interfaces.md`, `docs/spec/006-behavior.md`, `docs/spec/008-capabilities.md`.

| Check | Status | Violations |
|---|---|---|
| H1 — Evidence-tag references use block-anchor links | ➖ | no evidence-tag IDs in added lines |
| H2 — Acronym table cells use header-anchor links | ➖ | no acronym tables in added lines |
| H3 — File references use markdown link syntax | ✅ | Repo override applies: code paths such as `src/core/rename-markdown-file.ts` are bare backtick paths, as required. The parent validated the changed `008-capabilities.md` line 13 link (1 citation valid). |
| Obsidian Last Modified timestamps | ✅ | none in added lines |

## Current PR Update

The PR advanced during this review. The current published head is `dd23741109c1f01a2c22de7dcd56d5317be998a6` ("Address PR review feedback (#101)"). It changes `README.md`, `docs/spec/006-behavior.md`, `src/cli.ts`, `src/core/rename-markdown-file.ts`, `src/jact-cli.ts`, and `test/cli-integration/rename-command.test.ts`.

Supersession note: everything above evaluates the starting snapshot `7d627ae`. Its line references and evidence still describe that commit and are not rewritten here.

| Finding at `7d627ae` | Status at `dd23741` |
|---|---|
| Critical issue 1: rollback cleanup failure leaves rewritten links | Resolved and tested in the published PR (the former local mitigation now ships) |
| Critical issue 2: literal filename with glob characters expands as a glob | Resolved and tested in the published PR; `src/jact-cli.ts` now checks `existsSync(source)` first |
| Critical issue 3: symlinked descendants bypass the scope guard | Still open. The diff from `7d627ae` to `dd23741` does not change `filesUnder`. |
| Escaped prose triggers the image-embed refusal | Still open. The diff does not change the embed scan. |
| Untested spec refusals, previews, backups; fixed temp root | Not re-evaluated against `dd23741` |

Test evidence for the fixed files: the parent observed 16 of 16 tests pass on the same fixes. This reviewer did not run tests.

Parent runtime check at `dd23741` (observed by the parent, not this reviewer): `npm run build` passed and the rename suite passed 16 of 16. An existing bracket-named source now moves only that file. The outside-scope symlink inside a moved directory still exits 0 and creates a regular file with the outside content. Escaped prose still causes a false image-embed refusal (exit 1). Real wiki embeds are still refused correctly, and reference-style image definitions are still rewritten correctly. Current blockers are the symlinked descendant (High) and the escaped-prose refusal (Medium).
