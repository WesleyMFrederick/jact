# PR 101 TypeScript Principles Evaluation

## Evaluation Metadata

- **Reviewer Role**: Architecture compliance reviewer — TypeScript implementation systems
- **Domain Vocabulary**: strict mode, Node16 ESM `.js` imports, import type discipline, static imports only, no any, const by default, TSDoc on every export, module-level TSDoc, `Contract:` marker, file preamble (purpose, responsibilities, boundary), document the residue, link do not restate, co-locate at smallest unit, names first, discriminated union, `kind` discriminant, export type vs interface, README as interface contract, merge semantics, kebab-case self-contained names, split by cohesive concern, tests mirror source, barrel pure re-export, package boundary via barrel, core minimal, accessor defensive copy, no backward compat by default
- **Principle Set**: `typescript` (one file, no core pairing)
- **Principle Set Resolution**: explicit, assigned by parent orchestrator; no inference gate
- **Graduated Loading**: Phase 1: 6 principle categories via `jact outline` (Footnotes skipped as structural). Phase 2: `jact extract file` loaded 165 lines.
- **Output Path**: `docs/reviews/pr-101-typescript-eval-report.md` 
- **Files Evaluated**: published commit `7d627ae` — `src/core/rename-markdown-file.ts`, `src/jact-cli.ts`, `src/cli.ts`, `test/cli-integration/rename-command.test.ts`; changed Markdown for hygiene only: `README.md`, `docs/spec/005-interfaces.md`, `docs/spec/006-behavior.md`, `docs/spec/008-capabilities.md`
- **TodoWrite Categories**: TypeScript Coding Style; Architecture Patterns; File Organization; Interface Design; TSDoc Documentation Style; Module Boundaries

**Source discipline.** Every line reference below is `7d627ae:<path>:<line>`. During this review the user committed the local fixes as `dd23741` ("Address PR review feedback"). Those changes are recorded under Already Mitigated. They are not evidence that the published commit complies. Runtime results marked **parent-observed** came from the parent orchestrator. This reviewer did not run them.

## Citation Context

- Principles: [TypeScript Implementation Principles](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/0-documents/markdown-documents/architecture-principles/typescript/typescript-principles.md#TypeScript%20Implementation%20Principles)
- Repo decisions: [ADR-0001 — DI-via-factory pattern](../adrs/003-adrs.md#ADR-0001%20—%20DI-via-factory%20pattern), [ADR-0003 — Flavor Extension Collection](../adrs/003-adrs.md#ADR-0003%20—%20Flavor%20Extension%20Collection)
- Rename contract: [jact rename interface](../spec/005-interfaces.md#`jact%20rename%20<source...>%20<destination>`), [Rename Workflow](../spec/006-behavior.md#Rename%20Workflow%20%28%60jact%20rename%60%29)
- Repo conventions observed in code: Purpose/Responsibilities/Boundary preambles in `src/core/MarkdownParser/mdastAdapter.ts:1-9` and every file under `src/core/MarkdownParser/extensions/`; `Contract:` markers in `src/FileCache.ts:185` and `src/core/CitationValidator/CitationValidator.ts:56`.
- Parent-observed runtime on an archive of `7d627ae`: rename suite 14/14 pass; probes listed per finding. Local tree (now `dd23741`): 16/16 pass.

## Principle Compliance

| Category | Status | Details |
|---|---|---|
| [TypeScript Coding Style](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/0-documents/markdown-documents/architecture-principles/typescript/typescript-principles.md#TypeScript%20Coding%20Style) | ✅ | `.js` import suffixes, `import type` for `Root`, `FileCache`, `ParsedFileCache`, `LinkObject` (`rename-markdown-file.ts:16-26`); static imports only (`jact-cli.ts:12` adds `isDynamicPattern` statically); no `any`; `const` by default with `let` only for try/catch assignment (`:151`, `:516`). Minor: the `/\.md$/i` literal repeats at `:157`, `:362`, `:405`, `:559` with no named constant. The pi-specific tsgo and Biome-gate bullets do not apply to jact. |
| [Architecture Patterns](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/0-documents/markdown-documents/architecture-principles/typescript/typescript-principles.md#Architecture%20Patterns) | ❌ | Good: planning (`planMoves`, `planFiles`) is separated from side effects (`commitPlan`). Violation: `brokenEmbeds` (`:542-549`) re-tokenizes Markdown source with a regex over decoded `text` node values. The repo pattern is ADR-0003 rule 1: a construct in Markdown source gets a tokenizer extension. Parent-observed: escaped prose `\!\[\[notes/p.png\]\]` makes a folder move fail with the image-embed refusal (exit 1). `RenameMove` uses a `kind` literal, but `movedFiles` is not tied to the `directory` variant (`:51-57`). |
| [File Organization](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/0-documents/markdown-documents/architecture-principles/typescript/typescript-principles.md#File%20Organization) | ❌ | Kebab-case is kept, but the self-contained name drifted: `rename-markdown-file.ts` now exports `renameMarkdownFiles`, `RenameRequest`, and directory moves. The module (843 lines) holds four cohesive concerns: move planning, link rewriting, embed safety, and commit/rollback. The principle allows one file when concerns are cohesive, so a split is optional. No `test/core/` mirror; coverage is CLI integration only (pre-existing pattern). |
| [Interface Design](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/0-documents/markdown-documents/architecture-principles/typescript/typescript-principles.md#Interface%20Design) | ❌ | The README and spec contract promised all-or-nothing apply and literal source paths; the published code broke both (Already Mitigated 1–2). `RenameMarkdownFilesResult.source`/`destination` are linked optionals ("present only for a single-file request", `:59-66`) instead of a union, so `cli.ts:407` must check both fields and `cli.ts:416` tests `movedFiles === undefined` instead of narrowing on `kind`. `export interface` for object shapes follows the principle. |
| [TSDoc Documentation Style](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/0-documents/markdown-documents/architecture-principles/typescript/typescript-principles.md#TSDoc%20Documentation%20Style) | ❌ | No file preamble, unlike the repo convention. Exports without TSDoc: `RenameMarkdownFilesDeps` (`:28`), `RenameFileChange` (`:45`), `RenameValidationError` (`:76`). No `Contract:` markers, although `renameMarkdownFiles` (`:792-798`) and `commitPlan` (`:697-704`) state behavioral guarantees. Both stated guarantees were false on published code: `MovePlan.moved` says "canonical old path" (`:108`) but symlinked descendants keep link paths (Critical 1), and `commitPlan` says "Any failure undoes" (`:700-701`) but rollback stopped at the first cleanup error (Already Mitigated 1). Good: no `{type}` annotations; comments document residue such as ordering ("outermost first", `:69`, `:106`). |
| [Module Boundaries](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/0-documents/markdown-documents/architecture-principles/typescript/typescript-principles.md#Module%20Boundaries) | ❌ | New in this PR: the rename module reads raw mdast through `document.data.ast` (`:582`) and imports `unist-util-visit` (`:17`). The parser boundary says consumers get domain objects and do not touch mdast (`src/core/MarkdownParser/mdastAdapter.ts:2-4`). `ParsedDocument.data` is documented as "Used by CitationValidator for direct data access" (`src/ParsedDocument.ts:66-71`). Pre-existing, not introduced: the core signature takes the CLI type `CliRenameOptions` (`:26`, `:803`); `verifyRelationships` builds its own components through the factory instead of receiving them (`:653-662`); dependencies use concrete `FileCache`/`ParsedFileCache` instead of the `*Like` interfaces named in ADR-0001. |

## Critical Issues (Severity: High)

1. **Symlinked descendants escape the scope guard and the canonical-path invariant (published and still open in `dd23741`).** Principle: [TSDoc Documentation Style](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/0-documents/markdown-documents/architecture-principles/typescript/typescript-principles.md#TSDoc%20Documentation%20Style) — `Contract:` as greppable marker, document the residue. `MovePlan.moved` is documented as "canonical old path → canonical new path" (`rename-markdown-file.ts:108`). `filesUnder` (`:309-316`) pushes `path.join(directory, entry.name)` for symlink entries and never canonicalizes them. The scope check (`:410-414`) covers only the top-level source. `planFiles` then parses the symlink target (`:558-575`), and `commitPlan` replaces the symlink with a regular file (`:753`). Parent-observed: `scope/notes/secret.md` is a symlink to a file outside scope. `rename notes archive --scope scope --fix` exits 0 and creates a regular `archive/secret.md` that holds the external content plus a rewritten link. The external file stays unchanged. Fix: in `planMoves`, refuse a descendant when `entry.isSymbolicLink()` and its realpath is outside `canonicalScope`, or refuse symlink descendants. Do not plan content edits through a symlink. Add one regression test.

## Recommendations

1. Treat symlink descendants in directory moves explicitly (Critical 1). Principle: [Module Boundaries](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/0-documents/markdown-documents/architecture-principles/typescript/typescript-principles.md#Module%20Boundaries).
2. Add a Purpose/Responsibilities/Boundary preamble to `src/core/rename-markdown-file.ts`, TSDoc on the three bare exports, and `Contract:` lines on `renameMarkdownFiles` (refusals throw `RenameValidationError` before any write; other errors are commit or rollback failures). Principle: [TSDoc Documentation Style](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/0-documents/markdown-documents/architecture-principles/typescript/typescript-principles.md#TSDoc%20Documentation%20Style) (`^tsdoc-file-preamble-purpose-responsibilities-boundaries`, `^tsdoc-contract-greppable-marker`).
3. Encode the result invariants in types: `RenameMove = { kind: "file"; source; destination } | { kind: "directory"; source; destination; movedFiles: number }`, and narrow on `move.kind` in `cli.ts:416`. Optional: make the single-file `source`/`destination` pair one union member. JSON output does not change. Principle: [Interface Design](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/0-documents/markdown-documents/architecture-principles/typescript/typescript-principles.md#Interface%20Design) (`^discriminated-union-type-field`).
4. Detect Obsidian embeds from parser tokens instead of a text regex. Principle: [Architecture Patterns](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/0-documents/markdown-documents/architecture-principles/typescript/typescript-principles.md#Architecture%20Patterns) and [ADR-0003 — Flavor Extension Collection](../adrs/003-adrs.md#ADR-0003%20—%20Flavor%20Extension%20Collection).
5. Rename the module to match its export (for example `rename-markdown-files.ts`). There is one importer (`src/jact-cli.ts`) and one spec path in the Rename Workflow section. Principle: [File Organization](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/0-documents/markdown-documents/architecture-principles/typescript/typescript-principles.md#File%20Organization) (`^kebab-case-self-contained-file-naming`).
6. Narrow the image-embed wording in `README.md`, `docs/spec/005-interfaces.md`, and `src/cli.ts:378-380`. Parent-observed: a reference-style image `![picture][pic]` with `[pic]: notes/p.png` moves successfully and its definition is rewritten. The docs say image embeds are never rewritten. Name the inline `![alt](path)` and `![[dir/file]]` forms only.

## Verdict

- [ ] Ready to proceed
- [X] Requires revision — Critical 1 is open on published `7d627ae` and on `dd23741`. The two other published P1 defects are fixed in `dd23741` but not in the published commit under review.

## Prioritized Findings

### Fix Now

1. **P1 — Refuse or canonicalize symlinked descendants** (Critical 1) — 25 min — `7d627ae:src/core/rename-markdown-file.ts:308-317`, `:401-414`; add a regression test in `test/cli-integration/rename-command.test.ts`. Confidence 0.85 (parent-observed).
2. **P3 — Preamble, export TSDoc, `Contract:` markers** — 15 min — `:1`, `:28`, `:45`, `:76`, `:792-798`. Confidence 0.9.
3. **P3 — Discriminated `RenameMove` union and narrowing in CLI** — 15 min — `:50-57`, `src/cli.ts:416`. Confidence 0.8.
4. **P3 — Self-contained module name** — 10 min — `src/core/rename-markdown-file.ts`, `src/jact-cli.ts:31-35`, the Rename Workflow spec line. Confidence 0.7.
5. **P3 — Image-embed doc wording** — 5 min — `README.md` rename section, `docs/spec/005-interfaces.md` Non-Markdown files paragraph, `src/cli.ts:378-380`. Confidence 0.75 (parent-observed).

### Architectural Rework Required

1. **P2 — Embed detection re-tokenizes Markdown with a regex and goes past the parser facade** — Cost: about 45–60 min — Named scope: add an Obsidian embed construct (or an `embed` flag on the `wikilink` node) to the Flavor Extension Collection (`src/core/MarkdownParser/extensions/flavors.ts`), expose embeds as typed parser output, and replace `visit(ast, "text")` plus `matchAll` in `brokenEmbeds` (`7d627ae:src/core/rename-markdown-file.ts:539-549`, `:582`). Trigger to revisit: the next change to `brokenEmbeds`, or the first report of a valid move refused for escaped or code-like embed text. Parent-observed today: escaped `\!\[\[notes/p.png\]\]` refuses a folder move (safe failure, exit 1). A real `![[notes/p.png]]` is still refused correctly. Confidence 0.8.

### Already Mitigated (in `dd23741`, not in published `7d627ae`)

1. **P1 — Rollback stopped at the first cleanup error, which broke the documented all-or-nothing contract.** Published `7d627ae:src/core/rename-markdown-file.ts:770-786` runs the rollback steps in one `try`. When `rmdirSync` throws, edited-file restoration is skipped. Parent-observed: a fault on the second move leaves `foreign.txt` in `new/dir`. Cleanup fails with ENOTEMPTY (exit 2), and `a.md` and `index.md` keep the rewritten links. `dd23741` runs each recovery step on its own, collects every error, and reports backup locations. Docs and TSDoc were updated to match. Principle: [Interface Design](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/0-documents/markdown-documents/architecture-principles/typescript/typescript-principles.md#Interface%20Design) (`^readme-as-contract`).
2. **P1 — An existing path with glob characters was also expanded as a glob.** Published `7d627ae:src/jact-cli.ts:741` checks only `isDynamicPattern(source)`. Parent-observed: with `notes/[ab].md`, `a.md`, and `b.md` present, `rename notes/[ab].md new.md --fix` moves all three into `new.md/` with exit 0. `dd23741` checks `existsSync(source)` first. Principle: [Interface Design](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/0-documents/markdown-documents/architecture-principles/typescript/typescript-principles.md#Interface%20Design).

### Pre-existing debt (not introduced by PR 101)

- `CliRenameOptions` in the core signature (`:26`, `:803`); internal construction of verification components in `verifyRelationships` (`:653-662`) instead of an injected factory per [ADR-0001 — DI-via-factory pattern](../adrs/003-adrs.md#ADR-0001%20—%20DI-via-factory%20pattern); concrete dependency types instead of the `*Like` interfaces; no mirrored unit test file. All four were present on `origin/main` before this PR. They are recorded here and are not part of this PR verdict.

## Document Hygiene

Applied to changed Markdown only (`README.md`, `docs/spec/005-interfaces.md`, `docs/spec/006-behavior.md`, `docs/spec/008-capabilities.md`), with the repo override that non-Markdown paths stay bare backtick paths.

| Check | Status | Violations |
|---|---|---|
| H1 — Evidence-tag references use block-anchor links | ✅ | none; the changed sections have no evidence-tag IDs |
| H2 — Acronym table cells use header-anchor links | ➖ | no acronym tables; the 005 flag table and the 008 matrix row have no defined acronyms |
| H3 — File references use markdown link syntax (repo override for code paths) | ✅ | the code path `src/core/rename-markdown-file.ts` in the 006 Rename Workflow is a bare backtick path, as required; parent validated the 008 line 13 link (1 citation valid). No Obsidian Last Modified timestamps in the changed hunks. |


## Current PR Update

The PR moved forward during this review. The current published head is `dd23741` ("Address PR review feedback (#101)"), as `gh pr view 101 --json headRefOid` confirmed (parent-observed). All line references above stay on the evaluated snapshot `7d627ae` as historical evidence.

- **Resolved and published in `dd23741`:** the literal path with bracket characters (Already Mitigated 2) and the rollback that continues after a cleanup error (Already Mitigated 1). They are no longer open blockers for the current PR. Parent-observed: the rename suite passes 16/16 on these same fixed files.
- **Still open in `dd23741`:** symlinked descendants escaping the scope (Critical 1, P1), and escaped prose `\!\[\[...\]\]` that wrongly blocks a move through embed detection (Architectural Rework 1, P2).
- **Unchanged:** the P3 TSDoc, discriminated-union, module-name, and image-embed wording items.

Verdict for the current PR `dd23741`: requires revision, because Critical 1 is still open.

Parent revalidation against the `dd23741` build: `npm run build` passes and the rename suite passes 16/16. In the CLI probes, the bracket-path source moves only the literal file. The symlink to a file outside the scope still creates a regular `archive/secret.md` and exits 0. Escaped prose still gets a false refusal (exit 1). A real wiki embed is still refused correctly. The reference-style image definition is rewritten correctly.
