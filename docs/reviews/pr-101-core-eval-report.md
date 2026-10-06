# PR 101 Core Architecture Evaluation

## Evaluation Metadata

- **Reviewer Role**: Architecture compliance reviewer — core, paradigm-agnostic system design (batch file-move transactions and link-rewrite planning)
- **Domain Vocabulary**: loose coupling, tight cohesion, stable public boundary, single responsibility, replaceable parts, dependency abstraction, transformation naming, primary export, data contract, pipeline state, orchestrator, descriptive label, confusion prevention, primitive-first, illegal states unrepresentable, explicit relationships, one source of truth, one invariant one place, stable schema, progressive defaults, boundary validation, scope adherence, foundation reuse, mechanical separation, no surprises, atomic operation, error recovery, fail fast, clear contract, leaky flag, scattered checks
- **Principle Set**: `core`
- **Principle Set Resolution**: explicit assignment from the parent (no inference, no confirmation gate). One principle file only; no paradigm pairing.
- **Graduated Loading**: Phase 1 discovered 9 `##` categories with `jact outline`. Phase 2 `jact extract file` loaded 165 lines.
- **Output Path**: `docs/reviews/pr-101-core-eval-report.md`
- **Evaluated Snapshot**: `7d627ae6b0ed77b050c0c4ae1a8a09ef27dcc27c`. All line references below are for this snapshot. See [Current PR Update](#Current%20PR%20Update) for the later published head `dd23741`.
- **Files Evaluated**: `src/core/rename-markdown-file.ts`, `src/jact-cli.ts`, `src/cli.ts`, `test/cli-integration/rename-command.test.ts`, `README.md`, [005 · rename interface](../spec/005-interfaces.md#`jact%20rename%20<source...>%20<destination>`), [006 · Rename Workflow](../spec/006-behavior.md#Rename%20Workflow%20%28%60jact%20rename%60%29), [008 · Capabilities](../spec/008-capabilities.md#008.%20Capabilities)
- **TodoWrite Categories**: Modular Design Principles; Action-Based File Organization; Self-Contained Naming Principles; Data-First Design Principles; Format/Interface Design; Minimum Viable Product (MVP) Principles; Deterministic Offloading Principles; Safety-First Design Patterns; Anti-Patterns to Avoid
- **Module spec note**: `src/core/` has no module-level `SPEC*.md`; the root [jact Living Specification](../spec/SPEC.md#jact%20Living%20Specification) applies.

## Citation Context

- Principle source: [Core Architecture Design Principles](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/0-documents/markdown-documents/architecture-principles/core/core-software-architecture-design-principles.md#Core%20Architecture%20Design%20Principles)
- Canonical constraints read: [ADR-0001 — DI-via-factory pattern](../adrs/003-adrs.md#ADR-0001%20—%20DI-via-factory%20pattern), [ADR-0002 — Regex → mdast-token migration (WMF-35)](../adrs/003-adrs.md#ADR-0002%20—%20Regex%20→%20mdast-token%20migration%20%28WMF-35%29), [ADR-0003 — Flavor Extension Collection](../adrs/003-adrs.md#ADR-0003%20—%20Flavor%20Extension%20Collection), [ADR-0004 — ParsedFileCache single-parse guarantee](../adrs/003-adrs.md#ADR-0004%20—%20ParsedFileCache%20single-parse%20guarantee)
- Runtime evidence in this report is **parent-observed**. This reviewer ran no build, test, or CLI probe.

## Principle Compliance

| Category | Status | Details |
|---|---|---|
| Modular Design Principles | ❌ | Plan and commit are separate: `planMoves` (`src/core/rename-markdown-file.ts:388-495`), then `planFiles` (`:553-625`), then `commitPlan` (`:705-790`). Preview never calls a writer (`:809-816`). The verification parser comes from the factory (`:653-662`), per ADR-0001; the fresh post-move cache is intentional. Violation: `brokenEmbeds` runs a regex over decoded text (`:542-549`) instead of using parser tokens. Markdown-syntax knowledge leaks out of the parser boundary ([Single Responsibility](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/0-documents/markdown-documents/architecture-principles/core/core-software-architecture-design-principles.md#^single-responsibility), ADR-0003). The 843-line file also mixes `mv` destination rules, move planning, embed scanning, link rewriting, transaction, and verification. That is a maintainability concern only. |
| Action-Based File Organization | ➖ | The file has one primary export, `renameMarkdownFiles` (`:799`), but the file name stays singular while the operation is now plural and includes directories ([Primary Export Pattern](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/0-documents/markdown-documents/architecture-principles/core/core-software-architecture-design-principles.md#^primary-export-pattern)). Public types in the operation file predate this PR. Pipeline states `PlannedMove`, `MovePlan`, `PlannedFile` follow [Files Transform States](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/0-documents/markdown-documents/architecture-principles/core/core-software-architecture-design-principles.md#^files-transform-states). |
| Self-Contained Naming Principles | ➖ | Good names: `requestedDestination`, `missingParents`, `pathAfterMoves`, `assertUnchanged`, `verifyRelationships`. Weak: `RenameRequest.batch` (`:39-43`) means "the destination is a directory" and needs its comment to be understood ([Descriptive Labels](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/0-documents/markdown-documents/architecture-principles/core/core-software-architecture-design-principles.md#^descriptive-labels)). The `moved` and `reported` maps rely on comments (`:108-111`). |
| Data-First Design Principles | ❌ | Strong: one `MovePlan` with a `moved` map drives both link rewriting and embed checks ([One Source of Truth](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/0-documents/markdown-documents/architecture-principles/core/core-software-architecture-design-principles.md#^one-source-of-truth)). Violation: the descendant entries come from non-canonical walk paths (`:486-492`, `filesUnder` `:309-317`) with no symlink kind, so a symlinked descendant looks like an ordinary in-scope file (Critical Issue 2). Representable illegal states: `RenameMove.movedFiles?` on a file move (`:51-57`); `source?` and `destination?` can appear alone (`:63-74`) ([Illegal States Unrepresentable](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/0-documents/markdown-documents/architecture-principles/core/core-software-architecture-design-principles.md#^illegal-states-unrepresentable)). The JSON change is additive and keeps the old single-file `source` and `destination` fields, which complies with [Stable Schemas](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/0-documents/markdown-documents/architecture-principles/core/core-software-architecture-design-principles.md#^stable-schemas). |
| Format/Interface Design | ❌ | Preview is the default, rules follow `mv`, JSON is additive, and exit codes are documented ([Progressive Defaults](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/0-documents/markdown-documents/architecture-principles/core/core-software-architecture-design-principles.md#^progressive-defaults)). Violation at the input boundary: `src/jact-cli.ts:741` treats an existing literal path with glob characters as a glob ([Boundary Validation](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/0-documents/markdown-documents/architecture-principles/core/core-software-architecture-design-principles.md#^boundary-validation); Critical Issue 1). Wording gap only: README `:174` and 005 `:152` say image embeds are not rewritten. A reference-style image definition (`[pic]: notes/p.png`) is a link and is rewritten correctly (parent-observed). |
| Minimum Viable Product (MVP) Principles | ✅ | Scope matches the intent: files, quoted globs, directories, missing-directory creation, and embed refusal instead of embed rewriting. The change reuses `resolveFiles`, `ParsedFileCache`, the factory, and `RenameValidationError` ([Foundation Reuse](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/0-documents/markdown-documents/architecture-principles/core/core-software-architecture-design-principles.md#^foundation-reuse)). Partial exception: the wiki-embed scan does not reuse the parser tokenizer. |
| Deterministic Offloading Principles | ✅ | No model call. Planning sorts files (`:561-566`), and errors depend only on input ([Prioritize Deterministic Operations](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/0-documents/markdown-documents/architecture-principles/core/core-software-architecture-design-principles.md#^prioritize-deterministic-operations)). The regex embed scan is deterministic but wrong for escaped text. |
| Safety-First Design Patterns | ❌ | Strong guards: scope, existence, self-move, overlap, same destination, nested destination, unresolved outgoing links, re-check before commit, staged temporary writes, and post-move verification. Violations: (a) rollback is one `try` block (`:768-789`), so one failed step stops later steps and edited files stay rewritten ([Atomic Operations](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/0-documents/markdown-documents/architecture-principles/core/core-software-architecture-design-principles.md#^atomic-operations), [Error Recovery](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/0-documents/markdown-documents/architecture-principles/core/core-software-architecture-design-principles.md#^error-recovery)); (b) scope is checked on the directory only, never on each descendant's real target (`:410-414` vs `:486-492`, `:748-754`) ([Input Validation](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/0-documents/markdown-documents/architecture-principles/core/core-software-architecture-design-principles.md#^input-validation)). |
| Anti-Patterns to Avoid | ❌ | [Leaky Flags](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/0-documents/markdown-documents/architecture-principles/core/core-software-architecture-design-principles.md#^leaky-flags): `batch: boolean` (`:42`, set at `src/jact-cli.ts:782`) needs outside knowledge to read. [Scattered Checks](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/0-documents/markdown-documents/architecture-principles/core/core-software-architecture-design-principles.md#^scattered-checks): the "is Markdown" rule repeats `/\.md$/i` in four places (`:157`, `:362`, `:405`, `:559`). The conflict checks in `planMoves` (`:429-471`) are a flat, readable list. No hidden global state. |

## Critical Issues (Severity: High)

1. **An existing literal path with glob characters expands as a glob.** `src/jact-cli.ts:741-748` calls `isDynamicPattern` before it checks whether the path exists. Parent probe at `7d627ae`: with `notes/[ab].md`, `a.md`, and `b.md` present, `rename notes/[ab].md new.md --fix` exited `0` and moved all three files into a new directory `new.md/`. A one-file rename became an unrequested batch write ([Boundary Validation](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/0-documents/markdown-documents/architecture-principles/core/core-software-architecture-design-principles.md#^boundary-validation)). **Resolved in `dd23741`.**
2. **A directory move copies out-of-scope symlink content into scope.** `filesUnder` (`src/core/rename-markdown-file.ts:309-317`) lists file symlinks as ordinary files. `planMoves` checks scope only for the directory (`:410-414`). `planFiles` parses the symlink target, and `commitPlan` replaces the link with a regular file (`:748-754`). Parent probe: `scope/notes/secret.md` links to `root/secret.md` outside scope (private text plus a link to `scope/notes/a.md`). `rename notes archive --scope scope --fix` exited `0` and created a regular `archive/secret.md` with the private text and a rewritten link. The rename contract in [005 · rename interface](../spec/005-interfaces.md#`jact%20rename%20<source...>%20<destination>`) bounds sources and destinations by `--scope` ([Input Validation](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/0-documents/markdown-documents/architecture-principles/core/core-software-architecture-design-principles.md#^input-validation)). **Still open in `dd23741`.**
3. **Rollback stops at the first recovery error.** `src/core/rename-markdown-file.ts:768-789` wraps every recovery step in one `try`. Parent probe at `7d627ae`: after a move fault, `rmdirSync` failed with `ENOTEMPTY` because a foreign file was in `new/dir`. Moves were reversed, but `a.md` kept `[Ref](../../ref/shared.md)` and `index.md` kept `[A](new/dir/a.md)`; both links were then broken. The docs promised full undo (005 `:154`, README `:172`, 006 `:120`) ([Atomic Operations](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/0-documents/markdown-documents/architecture-principles/core/core-software-architecture-design-principles.md#^atomic-operations), [Error Recovery](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/0-documents/markdown-documents/architecture-principles/core/core-software-architecture-design-principles.md#^error-recovery)). **Resolved in `dd23741`.**

## Recommendations

1. Refuse a directory move whose tree contains a symlink, or whose descendant real path leaves the canonical scope. Check `entry.isSymbolicLink()` in `filesUnder` and throw `RenameValidationError` before planning links. Add one integration test for the parent's symlink scenario.
2. Detect wiki embeds from parser tokens, not decoded text. Parent probe: escaped prose `\!\[\[notes/p.png\]\]` made a valid `notes` to `archive` move fail with exit `1`. Per ADR-0003, add an embed flag or construct to the Obsidian flavor and read it in `brokenEmbeds`.
3. Replace `batch: boolean` with a named destination mode, for example `destinationMode: "directory" | "path"`.
4. Make `RenameMove` a discriminated union (`{kind:"file"}` or `{kind:"directory", movedFiles}`), and group `source` and `destination` into one optional pair. JSON output stays the same.
5. Narrow the "image embeds are not rewritten" wording to inline `![alt](path)` and `![[dir/file]]` embeds.
6. Rename `src/core/rename-markdown-file.ts` to match its plural export, and put the `.md` test in one helper.

## Verdict

- [ ] Ready to proceed
- [X] Requires revision. At `7d627ae`, three high findings existed. At current `dd23741`, the symlink scope breach is still open; the escaped-prose false refusal is a medium parser-boundary finding.

## Prioritized Findings

### Fix Now

1. **P1 · Symlinked descendants bypass the scope guard.** `src/core/rename-markdown-file.ts:309-317`, `:410-414`, `:748-754`. [Input Validation](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/0-documents/markdown-documents/architecture-principles/core/core-software-architecture-design-principles.md#^input-validation). About 25 minutes. Refuse symlinks in moved trees and add the probe as a test. Confidence 0.85.
2. **P3 · Data-model and naming cleanups** (recommendations 3, 4, 6). About 25 minutes. No behavior change.
3. **P3 · Image-embed wording** (recommendation 5). About 5 minutes.

### Architectural Rework Required

1. **P2 · Wiki-embed detection by regex over decoded text.** `src/core/rename-markdown-file.ts:542-549`. [Single Responsibility](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/0-documents/markdown-documents/architecture-principles/core/core-software-architecture-design-principles.md#^single-responsibility), ADR-0003. Cost: 30 minutes or more. Scope: an embed construct or flag in the Obsidian flavor (`src/core/MarkdownParser/extensions/wikilink.ts`, `src/core/MarkdownParser/extensions/flavors.ts`, the mdast adapter) plus `brokenEmbeds`. Revisit trigger: before rename gains embed rewriting, or at the first reported false refusal. Today the failure refuses a safe move; it does not corrupt data. Confidence 0.85.

### Already Mitigated

At review time these two fixes were uncommitted local edits. They are now published in `dd23741` (see [Current PR Update](#Current%20PR%20Update)).

1. Literal glob-character paths: `src/jact-cli.ts:741` now uses `existsSync(source) || !isDynamicPattern(source)`, with a test "Given an existing bracketed filename…".
2. Rollback continuation: `src/core/rename-markdown-file.ts:769-813` collects `rollbackErrors`, restores files at their current locations, and reports kept backups, with a test "Given failed directory cleanup during rollback…".

## Current PR Update

The PR advanced during review. Current published head is `dd23741109c1f01a2c22de7dcd56d5317be998a6` ("Address PR review feedback (#101)"). This report keeps the `7d627ae` line references as historical evidence; they are not rewritten.

Parent-observed results on `dd23741`: `npm run build` passes; the rename suite passes 16/16.

| Finding | `7d627ae` | `dd23741` | Evidence |
|---|---|---|---|
| Literal glob-character path expands as a glob | Open (P1) | **Resolved** | Probe moves only the literal file to `notes/new.md`; `a.md` stays. |
| Rollback stops at first recovery error | Open (P1) | **Resolved** | `rollbackErrors` at `dd23741` line 769; regression test passes. |
| Symlinked descendant bypasses scope | Open (P1) | **Open (High)** | Probe still creates regular `archive/secret.md` with external private text, exit `0`. `filesUnder` unchanged (line 309). |
| Escaped prose triggers false embed refusal | Open (P2) | **Open (Medium)** | Probe still exits `1`. Regex still at `dd23741` line 543. |
| Normal incoming wiki embed refusal | Works | Works | Probe rejects the unsafe move. |
| Reference-style image definition | Works | Works | Definition is rewritten. |

## Document Hygiene

Applied to the four changed Markdown files at `7d627ae` (`README.md`, 005, 006, 008), with the repo rule that non-Markdown code paths are bare backtick paths.

| Check | Status | Violations |
|---|---|---|
| H1 — Evidence-tag references use block-anchor links | ✅ | none (no evidence tags) |
| H2 — Acronym table cells use header-anchor links | ➖ | no acronym tables |
| H3 — File references (Markdown links for `.md`, backticks for code) | ✅ | none; 006 `:116` uses a backtick code path; parent validated the changed 008 line 13 link (OK) |
| Obsidian `Last Modified` timestamps | ✅ | none found |
