# 002. Architecture

**Status:** done

## System Overview

jact is a **layered CLI architecture** with dependency injection via a factory pattern. Commander command registration is deliberately separated from orchestration logic (`src/cli.ts` vs `src/jact-cli.ts`, issue #29), so the orchestration class (`JactCli`) is importable and testable without activating Commander at all.

```
┌──────────────────────────────────────────────────────────────────────┐
│                         CLI Layer                                    │
│  src/cli.ts — Commander command registration only                    │
│  (validate, ast, extract links/header/file)                          │
└───────────────────────────────┬────────────────────────────────────--┘
                                 │ delegates to
                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    Orchestration Layer                                │
│  src/jact-cli.ts — JactCli class (scope resolution, formatting,           │
│  fix workflow, importable without Commander)                          │
└───────────────────────────────┬──────────────────────────────────────┘
                                 │ wires via
                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│              src/factories/componentFactory.ts (DI factory)           │
└──┬──────────────┬───────────────┬────────────────┬───────────────┬───┘
   ▼              ▼               ▼                ▼               ▼
MarkdownParser  FileCache   ParsedFileCache  CitationValidator  ContentExtractor
   │                              │            │      │              │
   │ produces ParserOutput        │            │      │              │
   ▼                              │            ▼      ▼              ▼
extensions/ (Flavor Extension     │      PathResolver AnchorMatcher  eligibilityStrategies/
Collection: flavors.ts + assemble.ts)   pathResolutionStrategies/    (Stop/Force/Section/CliFlag)
                                 │
                                 ▼
                          ParsedDocument (facade over ParserOutput)
```

```
Batch validate path (jact validate with multiple paths/glob/--changed/--json):

  src/cli.ts ──▶ resolveFileSet() ──▶ runBatch() ──▶ renderHuman()/renderJson()
   (validate/resolve-files.ts,     (validate/       (validate/renderers.ts)
    resolve-changed-files.ts)       batch-runner.ts)
```

---

## Component Specifications

### CLI Orchestrator: `src/cli.ts` + `src/jact-cli.ts`

**`cli.ts`** (538 lines) owns every Commander `.command()` registration: `validate`, `ast`, `extract` (with `links`/`header`/`file` subcommands). It contains argument parsing, flag validation (e.g. `--stdin`/batch-mode mutual exclusion, `--json`/`--format json` conflict), exit-code mapping, and delegates all actual work to `JactCli`.

**`jact.ts``'s `JactCli` class** (630 lines) is the orchestration layer:

```ts
class JactCli {
  private parser: MarkdownParser;
  private parsedFileCache: ParsedFileCache;
  private fileCache: FileCache;
  private validator: CitationValidator;
  private contentExtractor: ContentExtractor;
  private scopeNotices: string[];

  async getAst(filePath, options?): Promise<ParserOutput>
  async validate(filePath, options?): Promise<string>
  async validateContent(content, options & {filePath}): Promise<string>
  async extractLinks(sourceFile, options): Promise<void>
  async extractHeader(targetFile, headerName, options): Promise<OutgoingLinksExtractedContent | undefined>
  async extractFile(targetFile, options): Promise<OutgoingLinksExtractedContent | undefined>
  async fix(filePath, options?, _fs?): Promise<string>
}
```

All dependencies are wired via `componentFactory` in the constructor — `JactCli` never directly `new`s a `CitationValidator` or `MarkdownParser`.

---

### `componentFactory.ts` (`src/factories/componentFactory.ts`)

Dependency-injection factory. Every `create*` function accepts optional overrides, falling back to production defaults:

```ts
createMarkdownParser(fileCache?: FileCache): MarkdownParser
createFileCache(): FileCache
createParsedFileCache(parser?: MarkdownParser | null): ParsedFileCache
createCitationValidator(parsedFileCache?, fileCache?): CitationValidator
createContentExtractor(parsedFileCache?, citationValidator?, strategies?): ContentExtractor
```

`createContentExtractor` wires the eligibility strategy chain in fixed precedence order: `[StopMarkerStrategy, ForceMarkerStrategy, SectionLinkStrategy, CliFlagStrategy]` — see the Behavior section for what each does. This is the seam tests use to inject fakes without importing concrete production classes (`FileCacheLike`/`ParsedFileCacheLike` interfaces in `src/types/componentInterfaces.ts` exist for exactly this purpose).

`LinkObjectFactory` (`src/factories/LinkObjectFactory.ts`) is a separate, smaller factory used only by the CLI's `extract header`/`extract file` commands to build a synthetic `LinkObject` from CLI string arguments (`createHeaderLink`, `createFileLink`) before handing it to `CitationValidator.validateSingleCitation()` — the same validation path real parsed links go through.

---

### MarkdownParser (`src/core/MarkdownParser/`)

Parses markdown using **micromark + mdast** (`mdast-util-from-markdown`) — **not marked.js**. (jact's own `CLAUDE.md` still says marked.js; that line is stale — see [003-adrs.md](../adrs/003-adrs.md#ADR-0002%20—%20Regex%20→%20mdast-token%20migration%20%28WMF-35%29).)

```ts
class MarkdownParser {
  constructor(fs: FileSystemInterface, fileCache: FileCache, extensions?)
  async parseFile(filePath: string): Promise<ParserOutput>
  async parseContent(content: string, filePath: string): Promise<ParserOutput>
  extractLinks(content, sourcePath): LinkObject[]
  extractHeadings(content): HeadingObject[]
  extractAnchors(content): AnchorObject[]
}
```

**The Flavor Extension Collection** (`src/core/MarkdownParser/extensions/flavors.ts` + `assemble.ts`) is the pattern that groups every micromark/mdast extension by *markdown flavor*, so "what does jact parse?" is answered by one registry instead of diffing six imports:

```ts
interface FlavorExtensionGroup {
  flavor: "commonmark" | "obsidian";
  description: string;
  syntax: Extension[];        // micromark syntax extensions
  fromMarkdown: MdastExtension[]; // mdast builders, order-aligned with syntax
}

const commonmarkFlavor: FlavorExtensionGroup; // baseline: inline/reference links, autolinks,
                                                // ATX/setext headings — built into micromark itself
const obsidianFlavor: FlavorExtensionGroup;    // highlight, obsidianComment, citation,
                                                // caretAnchor, wikilink, obsidianLink
const allFlavors: FlavorExtensionGroup[] = [commonmarkFlavor, obsidianFlavor];
```

`assemble.ts` composes `allFlavors` into the two things `MarkdownParser` actually needs: `jactSyntaxExtension()` (via `combineExtensions`) and `jactMdastExtensions()` (a flat, order-aligned array). Adding a new construct means adding one group to `flavors.ts` — nothing else changes.

**Individual extension responsibilities** (all in `extensions/`):

| Extension | Syntax | Node type |
|---|---|---|
| `caretAnchor.ts` | `^anchor-id` | `caretAnchor` |
| `citation.ts` | `[cite: path]` | `citation` |
| `highlight.ts` | `==text==` | `highlight` |
| `obsidianComment.ts` | `%%text%%` | (comment, suppressed from output) |
| `obsidianLink.ts` | Permissive links whose fragment contains a raw space, e.g. `[t](file#My Heading)` | link with unencoded fragment |
| `wikilink.ts` | `[[target#anchor\|alias]]`, all parts optional | `wikilink` |

`highlight.ts` and `obsidianComment.ts` share a `wrappedInline` helper (delimiter-pair tokenizer), differing only by marker character (`=` vs `%`).

**Post-parse extraction** (`mdastAdapter.ts` → `extractHeadings.ts`, `extractLinks.ts`, `extractAnchors.ts`) walks the single parsed tree via `unist-util-visit` to build `HeadingObject[]`, `LinkObject[]`, `AnchorObject[]` — one parse, three extraction passes over the same tree, never a re-parse.

---

### CitationValidator (`src/core/CitationValidator/`)

A **thin coordinator** — pattern classification and result assembly only. Path resolution and anchor matching are extracted into their own classes (issue #28):

```ts
class CitationValidator {
  constructor(parsedFileCache, fileCache, pathResolutionStrategies?)
  async validateFile(filePath): Promise<ValidationResult>
  async validateSingleCitation(citation, contextFile?): Promise<EnrichedLinkObject>
  classifyPattern(citation): "CARET_SYNTAX" | "EMPHASIS_MARKED" | "CROSS_DOCUMENT" | "WIKI_STYLE" | "INTERNAL_ANCHOR"
}
```

**`AnchorMatcher`** (`AnchorMatcher.ts`) owns all anchor-matching logic: flexible matching (exact → raw-text → backtick-unwrapped → backtick-wrapped → markdown-cleaned), Obsidian "prefer raw header" suggestions, and block-ref-without-caret detection. See the Behavior section for the full matching order.

**`PathResolver`** (`PathResolver.ts`) owns path resolution: tilde expansion, Obsidian absolute-path conversion, symlink-aware retries, and path-conversion suggestion generation.

**`pathResolutionStrategies/`** is a strategy array (`WikiFastPathStrategy`, `WikiFailLoudStrategy`, `FolderLinkStrategy`, `FileFoundStrategy`, `CacheFallbackStrategy`) that `CitationValidator` iterates for cross-document link resolution, mirroring the eligibility-strategy pattern in `ContentExtractor`.

---

### ContentExtractor (`src/core/ContentExtractor/`)

```ts
class ContentExtractor {
  constructor(eligibilityStrategies, parsedFileCache, citationValidator)
  async extractContent(enrichedLinks, cliFlags): Promise<OutgoingLinksExtractedContent>
}
```

Strategy pattern (`eligibilityStrategies/`) decides, per link, whether to extract at all: `StopMarkerStrategy` → `ForceMarkerStrategy` → `SectionLinkStrategy` → `CliFlagStrategy` (fixed precedence — see the Behavior section). `extractContent()` deduplicates extracted content by SHA-256 hash across all processed links in one call, tracking `tokensSaved`/`compressionRatio`.

---

### ParsedDocument (`src/ParsedDocument.ts`)

Facade providing a stable query interface over raw `ParserOutput`, isolating consumers (`CitationValidator`, `ContentExtractor`) from parser internals:

```ts
class ParsedDocument {
  get data(): ParserOutput
  hasAnchor(anchorId): boolean
  findSimilarAnchors(anchorId): string[]     // Levenshtein fuzzy, top 5
  getLinks(): LinkObject[]
  getAnchorIds(): string[]                    // lazy-cached
  extractFullContent(): string
  extractSection(headingText, headingLevel?): string | null
  extractBlock(anchorId): string | null
}
```

---

### ParsedFileCache (`src/ParsedFileCache.ts`)

Enforces the **single-parse-per-file guarantee**: caches the *Promise* returned by `MarkdownParser.parseFile()`, keyed by `resolve(normalize(filePath))`, not the resolved value. This means two concurrent `resolveParsedFile()` calls for the same path share one in-flight parse rather than triggering two. Failed parses are evicted from the cache so a retry is possible. `seedParsedFile()` lets a caller pre-populate the cache with in-memory content (used by `validateContent` for `--stdin`).

---

### FileCache (`src/FileCache.ts`, 605 lines)

Builds and queries a filename → paths index for a scope folder:

```ts
class FileCache {
  buildCache(scopeFolder, verbose, scope?, options): CacheStats
  resolveFile(filename): ResolveResult
  scopeHasGitignore(): boolean
  isIgnored(absPath): boolean
  getAllFiles(): FileEntry[]
  getCacheStats(): CacheStatsDetail
}
export function findNearMisses(name, entries, k=3, maxDist=2): string[]
```

Resolves symlinks (`realpathSync`) before scanning to avoid duplicate cache entries from symlink artifacts. Respects `.gitignore` by default (`--allow-gitignore` opts out). `resolveFile()` tries exact match, then with/without `.md` extension, then `findFuzzyMatch()` (handles double-extension typos, a small hardcoded typo-correction table, and `arch-`-style prefix matching).

---

## Batch-Validate Components (`src/validate/`)

Added as an orchestration layer over the same single-file `CitationValidator` — no validation logic was forked:

| File | Responsibility |
|---|---|
| `resolve-files.ts` | Glob/path expansion (tinyglobby), `.gitignore` filtering, dedup, sort |
| `resolve-changed-files.ts` | `git status --porcelain` parsing into a changed-`.md` file list, via an injectable `RunGit` seam |
| `batch-runner.ts` | Sequential iteration over resolved files, calling an injected `ValidateOneFn`, aggregating into `BatchSummary` |
| `renderers.ts` | `renderHuman()` and `renderJson()` — two views over the same `BatchSummary` |

---

## Version History

| Version | Date | Changes |
|---|---|---|
| 1.0.0-draft | 2026-07-01 | Initial architecture doc, replacing per-component design-docs guides |
