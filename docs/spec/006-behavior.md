# 006. Behavior

**Status:** done

## Validate Workflow (single file)

`JactCli.validate(filePath, options)` (`src/jact-cli.ts:173-224`):

1. **Resolve scope** via `applyScope()` — see Scope Resolution Order below. Seeds the shared `FileCache` even when `--scope` is omitted, so bare wiki page names resolve.
2. **Emit scope notices** (non-JSON format only) — e.g. a hint when the scope auto-resolved to the nearest `.obsidian` vault rather than an explicit choice.
3. **Parse + validate**: `CitationValidator.validateFile(filePath)` — throws `File not found` if the path doesn't exist on disk; otherwise resolves the parsed document via `ParsedFileCache` and validates every extracted `LinkObject`.
4. **Detect nested-codeblock warnings** via `detectNestedCodeblocks(fileContent)` — a separate warning channel from citation validation.
5. **Apply `--lines` filter** if present — `filterResultsByLineRange()` re-slices `links` to the given range and recomputes `summary` from the filtered set only.
6. **Format**: `--format json` → `formatAsJSON()`; otherwise `formatForCLI()` (verbose tree or minimal one-liner per `--verbose`).
7. **Append gitignore hint** if a wiki page wasn't found and the active scope has a `.gitignore` — nudges toward `--allow-gitignore`.

`validateContent(content, options & {filePath})` (`jact.ts:231-285`) is the in-memory analogue for `--stdin`: identical pipeline, but skips the disk read and instead calls `MarkdownParser` on the supplied string content, with `filePath` used only as the *intended* path for scope resolution, relative-link base, and self-anchor context.

## Validate Workflow (batch)

Batch mode (`src/cli.ts:283-312`) is a distinct code path from single-file validate, reusing the same `CitationValidator.validateFile`:

1. `resolveFileSet({paths, changed}, cwd)` — expands globs (tinyglobby), unions in `--changed` git-modified `.md` files, dedupes, sorts lexicographically. Throws `NoFilesMatchedError` (exit 2) or `NotAGitRepositoryError` (exit 2) on failure.
2. Fresh `ParsedFileCache`/`FileCache`/`CitationValidator` are constructed **per batch run** — never reused across runs, since `FileCache` carries state between validations.
3. `runBatch(files, validateOne)` iterates **sequentially** (not concurrently) — a deliberate choice (see the ADRs section) to avoid cache races on the shared `CitationValidator`.
4. Each file's `ValidationResult` maps to a `FileResult` (`ok = summary.errors === 0`), aggregated into a `BatchSummary`.
5. Render: `renderHuman()` (default) or `renderJson()` (`--json`, JSONL).
6. Exit code: `summary.failed > 0 ? 1 : 0`.

## Scope Resolution Order

`resolveScope()` (`src/core/resolveScope.ts`) is a pure function (only I/O is `fs.existsSync`) used by every command that needs to locate a project/vault root:

1. **Explicit** — `--scope <folder>` is trusted completely, no marker search.
2. **Nearest marker walking up from cwd** — checks each directory level for `.git`, `.obsidian`, `package.json` (same-level tiebreak order: `.git` > `.obsidian` > `package.json`, i.e. repo root beats vault root beats sub-project).
3. **Nearest marker walking up from the target file's directory** — same marker search, different starting point.
4. **None** — no marker found via either walk; the caller gets a `triedFallbacks` list for the error message and must pass `--scope` explicitly.

When the scope resolves via `.obsidian` (not an explicit `--scope`), `JactCli` emits a notice: *"Scoped to `<dir>` (nearest Obsidian vault). Override with --scope <dir>."* — surfacing the default instead of hiding it.

## Path Resolution Strategy Order (cross-document links)

`CitationValidator.validateCrossDocumentLink()` iterates `defaultPathResolutionStrategies` (`src/core/CitationValidator/pathResolutionStrategies/index.ts:32-38`) and returns the first non-null result:

1. **`WikiFastPathStrategy`** — wiki link (`[[...]]`) whose parser-resolved absolute path already exists; trusts it, checks the anchor, short-circuits valid.
2. **`WikiFailLoudStrategy`** — wiki link whose resolution failed at parse time (`target.path.absolute === null` with a non-empty `attempted` log) → hard error listing every path the parser tried.
3. **`FolderLinkStrategy`** — the resolved path exists but is a directory, not a file → warning.
4. **`FileFoundStrategy`** — target file exists on disk via standard or cross-directory resolution; warns + suggests a path-conversion fix if the resolution crossed directories, otherwise valid after an anchor check.
5. **`CacheFallbackStrategy`** — file not found via standard resolution; probes `FileCache.resolveFile()` for a fuzzy match, an exact match in a different directory, or a duplicate-filename conflict. This strategy always returns a result (never `null`), so it terminates the chain.

Internally, `PathResolver.resolveTargetPath()` (`src/core/CitationValidator/PathResolver.ts:123-195`) runs its own 5-step waterfall to produce the candidate path each strategy checks: (0) tilde-expand `~/`, (1) standard relative resolution (with a decoded/non-decoded retry for URL-encoded paths), (2) Obsidian absolute-path format (`0_SoftwareDevelopment/...` style, walking up from the source file to find a match), (3) symlink-resolved source directory retry, (4) `FileCache` smart filename matching. If none succeed, it falls back to the standard path, which the caller then reports as "file not found."

## Anchor Matching Order

`AnchorMatcher.findFlexibleAnchorMatch()` (`src/core/CitationValidator/AnchorMatcher.ts:66-117`) tries, in order:

1. **Exact match** — search anchor equals the header's `id`.
2. **Raw-text match** — search anchor equals the header's `rawText`.
3. **Backtick-unwrapped** — search anchor is backtick-wrapped; strip backticks and compare to the header's raw/id text.
4. **Backtick-wrapped** — the header's raw text contains backticks; wrap the search term in backticks and compare.
5. **Markdown-cleaned comparison** — both sides run through `cleanMarkdownForComparison()` (tokenizer-backed `stripInlineMarkdown` plus domain-specific normalization: strip `:` → space, strip backslashes/brackets, collapse whitespace) and compared.

`validateAnchorExists()` (`AnchorMatcher.ts:142-279`) wraps this with additional passes checked *before* falling through to the flexible matcher: a direct `ParsedDocument.hasAnchor()` check, block-ref-without-caret detection (a link to `^id` that omits the leading `^`), URL-decoded `%20` matching for emphasis-marked anchors, and `^`-prefixed Obsidian block-reference matching. If nothing matches, it falls back to an Obsidian "better format" suggestion (prefer the raw header over a guessed kebab-case slug) and, failing that, Levenshtein-based similar-anchor suggestions.

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

`JactCli.fix()` (`src/jact-cli.ts:482-`): validates the file, filters to fixable links (warnings with a `pathConversion`, or errors whose suggestion recommends the raw header format), fails fast with an explicit error if a path fix is needed but `--scope` wasn't supplied (anchor-only fixes don't need scope), then either:
- prints a diff and exits without writing (`--dry-run`), or
- writes a timestamped `.bak` backup of the original content, applies the fixes in place, and writes the result.

## Version History

| Version | Date | Changes |
|---|---|---|
| 1.0.0-draft | 2026-07-01 | Initial behavior doc, grounded in `src/jact-cli.ts`, `src/core/CitationValidator/*`, `src/core/ContentExtractor/*`, `src/core/resolveScope.ts` |
