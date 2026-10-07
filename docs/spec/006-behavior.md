# 006. Behavior

**Status:** done

## Validate Workflow (single file)

`ValidationWorkflow.validate()` (`src/validate/validation-workflow.ts`), used by file, in-memory, and batch validation:

1. **Resolve scope** via `prepareScope()`. Seeds the shared `FileCache` even when `--scope` is omitted, so bare wiki page names resolve.
2. **Emit scope notices** (non-JSON format only), such as an automatically selected Obsidian vault.
3. **Parse** through `ParsedFileCache`. If `ParserOutput.validationDisabled` is true, return a successful skipped outcome before citation validation, nested-codeblock detection, line filtering, or fixes.
4. **Validate links** with `CitationValidator.validateDocument()` and detect nested-codeblock warnings. Plain text and code are not validated.
5. **Apply `--lines` filter** if present, then recompute `summary` from the filtered `links`.
6. **Format**: `--format json` uses `formatAsJSON()`; human output uses the verbose tree or minimal formatter.
7. **Append gitignore hint** if a wiki page was not found and the active scope has a `.gitignore`.

`JactCli.validateContent(content, options & {filePath})` is the in-memory analogue for `--stdin`: it skips the disk read and parses the supplied content, while `filePath` remains the intended path for scope resolution and relative links.

The disable state is parser-derived, not found by a source-text scan. `<!-- jact-validate-disable -->` must be the exact first mdast HTML body node; one mdast YAML frontmatter node may precede it. Blank lines do not create body nodes. Comments after other content, inside code fences or blockquotes, or with additional text do not disable validation.

### Plain File Paths

`src/core/plain-file-paths.ts` exposes `findPlainFilePaths(content)` and `resolvePlainFilePath(reference, sourceFile, scope)` for `--fix` conversion and rename. Validation does not use them: plain text and code are not link targets. The scanner uses the Markdown parser's syntax tree to select prose, inline-code, and code-block spans. It does not scan existing links, reference definitions, wiki links, citations, images, HTML, YAML, or Obsidian comments. URLs, globs, and template paths are excluded.

Each reference carries its original text, file path, optional `#anchor` or `:line` suffix, source offsets, line, column, and prose/code context. Offsets cover only the path and suffix; enclosing quotes, backticks, and fences remain outside the edit span. Bare filenames require an extension; slash paths, absolute paths, and `~/` paths are also supported. A `/goal` command verb is not a file reference; its path operands are checked.

Resolution checks only exact existing files relative to the note and the scope root. Absolute paths use their own location; `~/` expands from the home directory. Directories are not file targets. One distinct existing candidate succeeds; two distinct candidates are ambiguous; missing targets are unresolved. No basename search or fuzzy matching is used.

`--fix` converts only resolved prose `.md` references to Markdown links, with a destination relative to the note. Anchors are retained in both link text and destination; line suffixes such as `:12` and `:L12-L14` are retained only in the link text. Non-Markdown paths, inline code, code blocks, `/goal` commands, and shell-prompt lines remain plain. Unmarked lowercase command-shaped lines are conservatively preserved to honor the USER's requirement that commands remain usable. Their file targets are still rewritten during moves. Missing and ambiguous references are left unchanged and not reported, because plain text may not be a path at all. Without any resolvable scope, `--fix` skips plain-path conversion.

Validation and `--fix --dry-run` do not write files or backups. Applied conversions use the same timestamped backup behavior as citation fixes, including `--no-backup`. Edits use original source offsets, so a prose occurrence cannot accidentally replace the same text inside code.

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

## Extraction Read Boundary

Extraction reads a link target only when the target is inside a permitted directory. This rule applies to every target that comes from a link in Markdown: `extract links` (including `--full-files` and force markers), and `extract file` or `extract header` with `--extract-linked-content`. A file that the user names on the command line (`extract file <path>`, `extract header <path>`) is always permitted.

- **Permitted directories.** The scope root (the `--scope` value or the inferred project root) is permitted. Each `--allow-read <dir>` adds one more directory. The flag is repeatable.
- **Check.** jact resolves symlinks in the target and in each directory with `realpath`, then compares them with `path.relative`. Absolute paths, `~/` paths, `../` traversal, symbolic links to files or parent directories outside the root, and sibling folders that share a name prefix (`/proj-evil` next to `/proj`) are all outside.
- **Result.** jact does not read a blocked target. The link gets status `skipped` with the reason `Blocked: target is outside the project. To allow, add --allow-read <dir>.` jact prints that reason on stderr with the source `file:line`. `extract file` does not follow links in a blocked file. In linked header output, the link shows as `not-followed` with the same reason. A blocked link is an intentional skip, so exit codes follow the existing rules for skipped links.
- **Validation.** `validate` does not use this boundary.

A link path with malformed percent-encoding (for example, `%E0%A4%A`) does not crash jact. Validation reports `Malformed percent-encoding in link path`. Output formatting keeps the raw text.

## Input Size Limits

jact uses fixed limits so that hostile or very large input cannot stop the process. Each limit is a constant in the module that owns it.

- **Markdown file size.** jact does not parse a Markdown file larger than 8 MiB (`MAX_MARKDOWN_FILE_BYTES` in `src/core/MarkdownParser/MarkdownParser.ts`). The error is `Skipped <path>: file is larger than 8 MiB.` For a file named on the command line, the command exits with code `2`. For a link target, the link fails with that reason. Parse cost still grows with file size. A 4 MiB file that contains only links validates in about 13 seconds and uses about 3 GB of memory. A file of that kind near 8 MiB can need more memory than Node.js allows. Then the process stops with an out-of-memory error.
- **Similar-anchor suggestions.** `ParsedDocument.findSimilarAnchors()` in `src/ParsedDocument.ts` skips an anchor longer than 256 characters (`MAX_FUZZY_ANCHOR_LENGTH`). It compares at most 1,000 anchors for each lookup (`MAX_FUZZY_ANCHOR_CANDIDATES`). It compares at most 20,000,000 character pairs for each target document (`MAX_FUZZY_ANCHOR_WORK`). After a limit, jact gives fewer suggestions or none. The `Anchor not found` error stays the same.
- **Anchor lookup.** `AnchorMatcher` in `src/core/CitationValidator/AnchorMatcher.ts` normalizes each anchor one time for each parsed document. A link lookup reads only the anchors that share a text form with the link. Many broken links to a document with many headings stay fast.
- **Similar wiki page names.** `resolveWikiPath()` in `src/core/MarkdownParser/resolveWikiPath.ts` does not compare a file name longer than 256 characters (`MAX_FUZZY_NAME_LENGTH`). Such a wiki link gets no page-name suggestion.
- **Directory scan.** The `FileCache` scan in `src/FileCache.ts` reads each real directory (after `realpath`) one time. A symbolic link loop in the scope does not repeat the scan. A directory that two paths reach is scanned only through the first path.

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

`JactCli.rename()` gives existing source paths literal precedence over glob expansion, including names containing brackets. It expands only non-existing glob sources to regular files, applies ignore rules, and refuses a glob when no eligible files remain. It infers scope from the first source and calls `renameMarkdownFiles()` (`src/core/rename-markdown-file.ts`), which runs in this order:

1. **Plan moves.** Resolve each source's destination with `mv` rules, then refuse invalid or overlapping requests before reading any links. Collect missing destination directories. Expand every directory move into a map from each carried file's current path to its new path. Reject a source directory if it contains a symlink (a file or folder shortcut), including nested file and folder symlinks. Report the shortcut path with exit code 1. Preview and `--fix` both stop without changing files.
2. **Plan reference edits.** Parse discovered Markdown notes plus every moved Markdown file. A cross-document link or plain path is rewritten when its target moves or its file changes directory. The new text points at the target's final location. Unchanged rewrites are dropped. For every note whose reference text would change, resolve its physical location and refuse the whole plan with exit code 1 if it is outside canonical scope, including another Windows drive or unrelated network root. This happens before backups, staging, directory creation, writes, or moves. Reference discovery through internal symlinks remains allowed, and an external note with no selected edits does not trigger the containment check. Image embeds that the moves would break refuse the plan, because they are outside the link model. Reference-style images such as `![picture][pic]` use ordinary parsed definitions such as `[pic]: notes/p.png`, which follow the same link-rewrite rules.
3. **Preview** returns the plan. **Apply** (`--fix`) re-checks that sources, destinations, and edited files did not change. It then backs up and stages edits, writes them, creates directories, performs the moves, and verifies every rewritten relationship at its final location against the planned target: parsed links are re-parsed, and plain paths are checked with exact disk resolution. On failure, recovery is best-effort: it attempts to reverse every completed move, remove every created directory, and restore every edited file from backups, continuing after recovery errors, and exits 2. Nonempty directories are retained rather than deleting files created by another process; errors and retained backup paths are reported for manual recovery.

Embed classification comes from parsed syntax, not decoded prose. Escaped examples such as `\!\[\[folder/image.png\]\]` and `!\[\[folder/image.png\]\]`, inline code, and fenced code do not block a move. In `\![[notes/a.md]]`, only the bang is escaped: the ordinary wiki link still follows the link-rewrite rules. A genuine embed that still resolves correctly after a move remains unchanged.

A valid Markdown image with bracketed description text, such as `![[caption]](folder/image.png)`, remains an image. Wiki-like syntax inside an image's description remains description text, including through a nested link; CommonMark still handles its formatting, escapes, entities, and code.

## Version History

| Version | Date | Changes |
|---|---|---|
| 1.0.0-draft | 2026-10-07 | Validation checks link syntax only; `plainPaths` removed from `ValidationResult`, so plain text and code never produce errors (issue #110). `--fix` no longer reports unresolved plain text and skips plain conversion without a scope |
| 1.0.0-draft | 2026-10-06 | Parser-owned wiki embed detection distinguishes genuine embeds from escaped prose and code; rename consumes typed embed references without rescanning decoded text |
| 1.0.0-draft | 2026-10-06 | Shared rename containment rejects absolute relative-path results across Windows drives and unrelated network roots; equality and descendants remain accepted |
| 1.0.0-draft | 2026-10-06 | Corrected rename glob eligibility: regular files after ignore filtering, not Markdown-only matches or batch validate's resolver |
| 1.0.0-draft | 2026-10-06 | Rename checks the physical scope of every note selected for reference edits before any writes, without banning internal shortcuts or unaffected external notes |
| 1.0.0-draft | 2026-10-06 | Prose Markdown conversion retains line suffixes only in link text, keeping destinations usable by Markdown clients |
| 1.0.0-draft | 2026-10-05 | Folder rename plans reject symlinks (file or folder shortcuts) before reading links or changing files |
| 1.0.0-draft | 2026-10-06 | Added exact plain-file-path validation and prose Markdown conversion; code and commands retain plain syntax, including uncertain command-shaped lines |
| 1.0.0-draft | 2026-10-05 | Existing rename sources with glob characters remain literal; rollback continues restoring files after directory cleanup errors and reports incomplete recovery |
| 1.0.0-draft | 2026-10-05 | `jact rename` accepts several sources, globs, and directories as one guarded batch with best-effort recovery; creates missing destination directories; refuses moves that would break inline or wiki image embeds |
| 1.0.0-draft | 2026-09-30 | Added the extraction read boundary and `--allow-read`; malformed percent-encoding no longer crashes |
| 1.0.0-draft | 2026-09-25 | Added `--fix --no-backup`; `--fix` skips fixes that leave a citation unchanged |
| 1.0.0-draft | 2026-09-25 | Added the error and `--fix` correction for header anchors with characters Obsidian drops (`: # \| ^ [ ]`) |
| 1.0.0-draft | 2026-08-24 | Added byte-screened backlink candidates with exhaustive fallback and unchanged output semantics |
| 1.0.0-draft | 2026-08-02 | Added progressive disclosure for batches above five errors while preserving complete verbose/JSON output and existing exit-code semantics |
| 1.0.0-draft | 2026-08-02 | Added bounded duplicate diagnostics and parser-derived document opt-out across validation, batch, stdin, and fix |
| 1.0.0-draft | 2026-07-01 | Initial behavior doc, grounded in `src/jact-cli.ts`, `src/core/CitationValidator/*`, `src/core/ContentExtractor/*`, `src/core/resolveScope.ts` |
