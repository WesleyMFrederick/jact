# 006. Behavior

**Status:** done

## Validate Workflow (single file)

`ValidationWorkflow.validate()` (`src/validate/validation-workflow.ts`), used by file, in-memory, and batch validation:

1. **Resolve scope** via `prepareScope()`. Seeds the shared `FileCache` even when `--scope` is omitted, so bare wiki page names resolve.
2. **Emit scope notices** (non-JSON format only), such as an automatically selected Obsidian vault.
3. **Parse** through `ParsedFileCache`. If `ParserOutput.validationDisabled` is true, return a successful skipped outcome before citation validation, nested-codeblock detection, line filtering, or fixes.
4. **Validate links** with `CitationValidator.validateDocument()` and detect nested-codeblock warnings.
5. **Apply `--lines` filter** if present. `filterResultsByLineRange()` re-slices `links` and recomputes `summary`.
6. **Format**: `--format json` uses `formatAsJSON()`; human output uses the verbose tree or minimal formatter.
7. **Append gitignore hint** if a wiki page was not found and the active scope has a `.gitignore`.

`JactCli.validateContent(content, options & {filePath})` is the in-memory analogue for `--stdin`: it skips the disk read and parses the supplied content, while `filePath` remains the intended path for scope resolution and relative links.

The disable state is parser-derived, not found by a source-text scan. `<!-- jact-validate-disable -->` must be the exact first mdast HTML body node; one mdast YAML frontmatter node may precede it. Blank lines do not create body nodes. Comments after other content, inside code fences or blockquotes, or with additional text do not disable validation.

## Validate Workflow (batch)

Batch mode (`src/cli.ts`) is a distinct orchestration path over the same validation workflow:

1. `resolveFileSet({paths, changed}, cwd)` expands globs, unions `--changed` Markdown files, deduplicates, and sorts.
2. Fresh parser, cache, and validator instances are constructed per batch run.
3. `runBatch(files, validateOne)` iterates sequentially to avoid shared-cache races.
4. Completed results map to passing or failing `FileResult` values. Disabled documents map to `ok: true`, `errors: []`, and `skipped: true`.
5. `BatchSummary` counts skipped files separately; `passed` excludes them.
6. `renderHuman()` totals errors across the batch. At five or fewer it reports every file and error. Above five, default output reports only failing files with per-file error counts, the totals, the reason details were hidden, and drill/filter/fix guidance. `--verbose` bypasses the collapse. `renderJson()` remains complete.
7. Exit code is `1` only when `failed > 0`; a batch containing only passes and skips exits `0`.

## Scope Resolution Order

`resolveScope()` (`src/core/resolveScope.ts`) is a pure function (only I/O is `fs.existsSync`) used by every command that needs to locate a project/vault root:

1. **Explicit** — `--scope <folder>` is trusted completely, no marker search.
2. **Nearest marker walking up from cwd** — checks each directory level for `.git`, `.obsidian`, `package.json` (same-level tiebreak order: `.git` > `.obsidian` > `package.json`, i.e. repo root beats vault root beats sub-project).
3. **Nearest marker walking up from the target file's directory** — same marker search, different starting point.
4. **None** — no marker found via either walk; the caller gets a `triedFallbacks` list for the error message and must pass `--scope` explicitly.

When the scope resolves via `.obsidian` (not an explicit `--scope`), `JactCli` emits a notice: *"Scoped to `<dir>` (nearest Obsidian vault). Override with --scope <dir>."* — surfacing the default instead of hiding it.

## Linked-context Backlink Discovery

`extract header ... --extract-linked-content` begins with the complete file list produced by [Scope Resolution Order](#Scope%20Resolution%20Order). Before parsing backlinks, `BacklinkCandidateFilter` reads each file as text and keeps files containing the root filename stem in decoded or percent-encoded form, case-insensitively. It always keeps the root file so same-file header links remain discoverable.

The screen is excludes-only. Every candidate is parsed and every possible backlink is resolved through `CitationValidator.resolveCitationTarget()` before it can appear in the result. Unreadable files, an empty root stem, and candidate-filter failures use exhaustive parsing instead. Output, failures, exit codes, and `scope.filesScanned` therefore retain exhaustive-scan semantics.

## Path Resolution Strategy Order (cross-document links)

`CitationValidator.validateCrossDocumentLink()` iterates `defaultPathResolutionStrategies` (`src/core/CitationValidator/pathResolutionStrategies/index.ts:32-38`) and returns the first non-null result:

1. **`WikiFastPathStrategy`** — wiki link (`[[...]]`) whose parser-resolved absolute path already exists; trusts it, checks the anchor, short-circuits valid.
2. **`WikiFailLoudStrategy`** — wiki link whose resolution failed at parse time (`target.path.absolute === null` with a non-empty `attempted` log) → hard error listing every path the parser tried.
3. **`FolderLinkStrategy`** — the resolved path exists but is a directory, not a file → warning.
4. **`FileFoundStrategy`** — target file exists on disk via standard or cross-directory resolution; warns + suggests a path-conversion fix if the resolution crossed directories, otherwise valid after an anchor check.
5. **`CacheFallbackStrategy`** — file not found via standard resolution; probes `FileCache.resolveFile()` for a fuzzy match, an exact match in a different directory, or a duplicate-filename conflict. This strategy always returns a result (never `null`), so it terminates the chain.

For duplicate-filename failures, `FileCache` ranks every candidate by directory-tree distance from the unresolved target's expected directory. Normalized scope-relative path provides the deterministic tie-break. Default human and single-file JSON output render the first five candidates, an omitted count, and recovery guidance. `--verbose` renders the full ranked set. Stored candidates remain complete in both modes.

Internally, `PathResolver.resolveTargetPath()` (`src/core/CitationValidator/PathResolver.ts:123-195`) runs its own 5-step waterfall to produce the candidate path each strategy checks: (0) tilde-expand `~/`, (1) standard relative resolution (with a decoded/non-decoded retry for URL-encoded paths), (2) Obsidian absolute-path format (`0_SoftwareDevelopment/...` style, walking up from the source file to find a match), (3) symlink-resolved source directory retry, (4) `FileCache` smart filename matching. If none succeed, it falls back to the standard path, which the caller then reports as "file not found."

## Anchor Matching Order

`AnchorMatcher.findFlexibleAnchorMatch()` (`src/core/CitationValidator/AnchorMatcher.ts:66-117`) tries, in order:

1. **Exact match** — search anchor equals the header's `id`.
2. **Raw-text match** — search anchor equals the header's `rawText`.
3. **Backtick-unwrapped** — search anchor is backtick-wrapped; strip backticks and compare to the header's raw/id text.
4. **Backtick-wrapped** — the header's raw text contains backticks; wrap the search term in backticks and compare.
5. **Markdown-cleaned comparison** — both sides run through `cleanMarkdownForComparison()` (tokenizer-backed `stripInlineMarkdown` plus domain-specific normalization: strip `:` → space, strip backslashes/brackets, collapse whitespace) and compared.

`validateAnchorExists()` (`AnchorMatcher.ts:142-279`) wraps this with additional passes checked *before* falling through to the flexible matcher: a direct `ParsedDocument.hasAnchor()` check, block-ref-without-caret detection (a link to `^id` that omits the leading `^`), URL-decoded `%20` matching for emphasis-marked anchors, and `^`-prefixed Obsidian block-reference matching. If nothing matches, it falls back to an Obsidian "better format" suggestion (prefer the raw header over a guessed kebab-case slug) and, failing that, Levenshtein-based similar-anchor suggestions.

### Anchors with characters Obsidian drops

Obsidian drops `:` `#` `|` `^` `[` `]` from heading-link anchors. It renders an anchor that keeps any of these characters as an external link. Before the matching passes, `validateAnchorExists()` decodes a header anchor (an anchor that does not start with `^`) and checks it for these characters. If the anchor has one, `AnchorMatcher` replaces each character with a space, collapses whitespace, and matches again. When a header matches, the link is an error:

- `error`: `Anchor uses characters Obsidian drops (<chars>): #<anchor>`
- `suggestion`: the corrected anchor, `#` + the header text with those characters replaced and whitespace collapsed, spaces encoded as `%20`. Examples: `#Q1%20Does%20the%20gap?` for the heading `Q1: Does the gap?`; `#Trace%20run%20(opsx%20continue)` for the heading `Trace: run (opsx:continue)`
- `anchorConversion`: the same correction, which `--fix` applies

If no header matches after the replacement, the normal `Anchor not found` result applies. Its `Available headers` list and its fuzzy-match `--fix` correction use the same replacement, so they never suggest an anchor that this rule rejects.

## Extraction Eligibility Order

`ContentExtractor.extractContent()` runs each cross-document link (internal links are filtered out first, per AC15) through `analyzeEligibility()`, which tries strategies in this fixed order (`componentFactory.ts:95-99`, wired in `createContentExtractor`):

1. **`StopMarkerStrategy`** — a `%%stop-extract-link%%` marker immediately after the link forces `eligible: false`. Highest precedence — an explicit stop always wins.
2. **`ForceMarkerStrategy`** — a `%%force-extract%%` marker forces `eligible: true`, overriding the `--full-files` requirement below.
3. **`SectionLinkStrategy`** — any link with a non-null `anchorType` (header or block) is eligible by default; no flag needed.
4. **`CliFlagStrategy`** — terminal strategy, never returns `null`. A full-file link (no anchor) is eligible only if `--full-files` was passed; otherwise ineligible.

Links that fail validation (`status === "error"`) are skipped before eligibility is even checked. Eligible links dispatch to `ParsedDocument.extractSection()`, `.extractBlock()`, or `.extractFullContent()` depending on `anchorType`, then get deduplicated by a SHA-256 content hash — a second link to already-extracted content increments `duplicateContentDetected`/`tokensSaved` instead of re-emitting the content.

## Citation Patterns Supported

| Pattern | Example | Classification |
|---|---|---|
| Cross-document link | `[Text](path/to/file.md#anchor)` | `CROSS_DOCUMENT` |
| Internal anchor link | `[Text](#anchor)` | `INTERNAL_ANCHOR` |
| Wiki-style link | `[[file.md#anchor\|text]]` or `[[#anchor\|text]]` | `WIKI_STYLE` |
| Caret / block reference | `^FR1`, `^US1-1AC1` | `CARET_SYNTAX` |
| Emphasis-marked anchor | `==**Component Name**==` | `EMPHASIS_MARKED` |
| Citation format | `[cite: path]` | tokenized via the `citation` micromark extension |

All six are tokenized by the Flavor Extension Collection (see the Architecture section) rather than re-derived with regex against raw source text; `CitationValidator.classifyPattern()` (`CitationValidator.ts:206-`) dispatches each `LinkObject` to its pattern-specific validator based on `scope`/`anchorType`/`linkType`.

## Fix Workflow (`--fix`)

`JactCli.fix()` parses before selecting fixes. A document with the validation-disable directive returns the same successful skip result as validation and is not read again, backed up, or written. Other documents validate, filter to fixable links, require `--scope` for path fixes, and then either print a dry-run diff or write the fixes. Before it writes, `--fix` creates a timestamped `.bak` backup; `--no-backup` skips the backup. Anchor fixes cover the kebab-case-to-raw-header conversion, a fuzzy header match for a missing anchor, and anchors with characters Obsidian drops. An anchor fix replaces only the anchor; the link text stays the same. A fix that leaves a citation unchanged (for example, a missing anchor with no close header match) is not applied, counted, or reported. If no fix changes a citation, `--fix` prints `No auto-fixable citations found in <file>` and writes nothing.

## Rename Workflow (`jact rename`)

`JactCli.rename()` gives existing source paths literal precedence over glob expansion, including names containing brackets. It expands only non-existing glob sources with the same `resolveFiles()` that batch validate uses (a glob with no Markdown match is a validation error), infers scope from the first source, and calls `renameMarkdownFiles()` (`src/core/rename-markdown-file.ts`), which runs in this order:

1. **Plan moves.** Resolve each source's destination with `mv` rules, then refuse invalid or overlapping requests before reading any links. Collect missing destination directories. Expand every directory move into a map from each carried file's current path to its new path. Reject a source directory if it contains a symlink (a file or folder shortcut), including nested file and folder symlinks. Report the shortcut path with exit code 1. Preview and `--fix` both stop without changing files.
2. **Plan links.** Parse every Markdown file in scope plus every moved Markdown file. A cross-document link is rewritten when its target moves or its file changes directory. The new text is relative to the file's final location and points at the target's final location. Unchanged rewrites are dropped. Inline image embeds (`![alt](path)`) and wiki image embeds (`![[folder/image.png]]`) are not rewritten; moves that would break them refuse the plan with exit code 1 and no writes. Reference-style images such as `![picture][pic]` use ordinary parsed definitions such as `[pic]: notes/p.png`, which follow the same link-rewrite rules.
3. **Preview** returns the plan. **Apply** (`--fix`) re-checks that sources, destinations, and edited files did not change. It then backs up and stages edits, writes them, creates directories, performs the moves, and re-parses each edited file at its final path to confirm every rewritten link resolves to its expected target. On failure, recovery is best-effort: it attempts to reverse every completed move, remove every created directory, and restore every edited file from backups, continuing after recovery errors, and exits 2. Nonempty directories are retained rather than deleting files created by another process; errors and retained backup paths are reported for manual recovery.

## Version History

| Version | Date | Changes |
|---|---|---|
| 1.0.0-draft | 2026-10-05 | Folder rename plans reject symlinks (file or folder shortcuts) before reading links or changing files |
| 1.0.0-draft | 2026-10-05 | Existing rename sources with glob characters remain literal; rollback continues restoring files after directory cleanup errors and reports incomplete recovery |
| 1.0.0-draft | 2026-10-05 | `jact rename` accepts several sources, globs, and directories as one guarded batch with best-effort recovery; creates missing destination directories; refuses moves that would break inline or wiki image embeds |
| 1.0.0-draft | 2026-09-25 | Added `--fix --no-backup`; `--fix` skips fixes that leave a citation unchanged |
| 1.0.0-draft | 2026-09-25 | Added the error and `--fix` correction for header anchors with characters Obsidian drops (`: # \| ^ [ ]`) |
| 1.0.0-draft | 2026-08-24 | Added byte-screened backlink candidates with exhaustive fallback and unchanged output semantics |
| 1.0.0-draft | 2026-08-02 | Added progressive disclosure for batches above five errors while preserving complete verbose/JSON output and existing exit-code semantics |
| 1.0.0-draft | 2026-08-02 | Added bounded duplicate diagnostics and parser-derived document opt-out across validation, batch, stdin, and fix |
| 1.0.0-draft | 2026-07-01 | Initial behavior doc, grounded in `src/jact-cli.ts`, `src/core/CitationValidator/*`, `src/core/ContentExtractor/*`, `src/core/resolveScope.ts` |
