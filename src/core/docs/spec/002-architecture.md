# 002. Architecture

**Status:** done

This section maps the `src/core` components, the one job each owns, and the boundaries between them. The repository architecture describes the parser, checker, and extractor internals; this section links there and adds module ownership.

## System Overview

Core is a set of components that callers outside core build and connect. Reads flow from the parser to the checker to the extractor. Only the citation fixer and the rename planner write user files.

```
caller (src/jact-cli.ts, src/validate/, src/cli.ts)
  │
  ├─ scope ──► resolveScope ──► prepareScope ──► FileCache (injected, outside core)
  │             ignoreRules ───────────────────────┘
  │
  ├─ read ───► MarkdownParser ──► ParsedFileCache (outside core) ──► CitationValidator
  │                                                                      │
  │                       LinkedHeaderContextQuery ◄── ContentExtractor ◄┘
  │                       (BacklinkCandidateFilter)    (ReadBoundary)
  │
  └─ write ──► applyCitationFixes ──► citationFixer, plain-file-paths
               renameMarkdownFiles ──► plain-file-paths, fresh parser for verification
```

---

## Components

Each component owns one job and states the guarantees callers rely on.

### `MarkdownParser/` — parser

The parser turns Markdown text into one parser output: links, headings, anchors, and embeds. Internals and the extension registry: [MarkdownParser (`src/core/MarkdownParser/`)](../../../../docs/spec/002-architecture.md#MarkdownParser%20%28%60src/core/MarkdownParser/%60%29).

- **One tree per parse.** Links, headings, anchors, and embeds come from one syntax tree.
- **Size limit.** The parser refuses text over `MAX_MARKDOWN_FILE_BYTES`; limits: [Input Size Limits](../../../../docs/spec/006-behavior.md#Input%20Size%20Limits).
- **Disable flag is parsed.** The parser sets `validationDisabled` from the syntax tree, not from a text search.

Boundary: the parser knows nothing of `ParsedDocument`, validation results, or the file index beyond its injected `FileCache`.

### `CitationValidator/` — checker

The checker gives each parsed link a status, an error, and a suggestion. Internals: [CitationValidator (`src/core/CitationValidator/`)](../../../../docs/spec/002-architecture.md#CitationValidator%20%28%60src/core/CitationValidator/%60%29).

- **New objects.** The checker returns a new enriched link and leaves the parser's link unchanged.
- **One resolver.** Backlink discovery resolves each candidate link through the checker, not through its own path logic.
- **Parsed links only.** The checker reads the links of a parsed document; it never scans plain text.

Boundary: the checker reads files only through the injected parsed-document cache and file index; it never writes.

### `ContentExtractor/` — extractor

The extractor reads the content that eligible links point at and removes duplicate content. Strategy order: [ContentExtractor (`src/core/ContentExtractor/`)](../../../../docs/spec/002-architecture.md#ContentExtractor%20%28%60src/core/ContentExtractor/%60%29).

- **Read boundary.** `ReadBoundary` permits a linked target only inside the scope root or an `--allow-read` folder, after symbolic link resolution. Rules: [Extraction Read Boundary](../../../../docs/spec/006-behavior.md#Extraction%20Read%20Boundary).
- **One block reason.** Every blocked read reports `BLOCKED_READ_REASON`, so output stays consistent.

Boundary: the extractor receives links that `CitationValidator` already checked; it has no checker dependency.

### `LinkedHeaderContext/` — linked-context query

The linked-context query builds the header, outgoing links, and backlinks for `extract header --extract-linked-content`. Workflow: [Linked-context Backlink Discovery](../../../../docs/spec/006-behavior.md#Linked-context%20Backlink%20Discovery).

- **Exhaustive results.** `BacklinkCandidateFilter` only removes parse candidates; output equals a full scope scan.
- **Safe fallback.** A filter failure, an unreadable file, or an empty file-name stem falls back to parsing every scope file.

Boundary: the query reaches the parser, checker, and extractor only through injected `*Like` interfaces. Filter detail: [BacklinkCandidateFilter (`src/core/LinkedHeaderContext/BacklinkCandidateFilter.ts`)](../../../../docs/spec/002-architecture.md#BacklinkCandidateFilter%20%28%60src/core/LinkedHeaderContext/BacklinkCandidateFilter.ts%60%29).

### `apply-citation-fixes.ts`, `citationFixer.ts` — citation fixer

The citation fixer repairs broken citation paths and anchors, and turns resolved prose `.md` paths into links, for `validate --fix`. Workflow: [Fix Workflow (`--fix`)](../../../../docs/spec/006-behavior.md#Fix%20Workflow%20%28%60--fix%60%29).

- **All or nothing.** A changed citation or two overlapping edits stop the fix before any write.
- **Safe target.** Write refusal rules: [Core Guarantees](../../../../docs/spec/SPEC.md#Core%20Guarantees).
- **No throw.** The fixer returns a report string; a failure returns a string that starts with `ERROR:`.

Boundary: `citationFixer.ts` only rewrites strings; file reads and writes stay in `apply-citation-fixes.ts`.

### `plain-file-paths.ts` — plain path scanner

The plain path scanner finds file paths written as plain text or code and resolves each to one exact file. Rules: [Plain File Paths](../../../../docs/spec/006-behavior.md#Plain%20File%20Paths).

- **Two callers only.** The citation fixer and the rename planner call it; validation never does.
- **Exact match.** Resolution checks only the note folder and scope root, with no file-name search.

Boundary: the scanner parses with the parser's extension set and never writes.

### `rename-markdown-file.ts` — rename planner

The rename planner moves Markdown files and folders and rewrites every link and plain path that the move changes. Workflow: [Rename Workflow (`jact rename`)](../../../../docs/spec/006-behavior.md#Rename%20Workflow%20%28%60jact%20rename%60%29).

- **Refuse before write.** A `RenameValidationError` means jact wrote nothing.
- **Verified apply.** After the moves, a fresh parser re-reads every rewritten link at its final location.
- **Rollback.** A failed apply undoes moves, removes new folders, and restores edited files from backups.

Boundary: `src/cli.ts` and `src/jact-cli.ts` expand globs and pick scope; the planner receives absolute source paths.

### `resolveScope.ts`, `prepare-scope.ts`, `ignoreRules.ts` — scope helpers

The scope helpers find the project root, index it, and skip ignored paths. Order: [Scope Resolution Order](../../../../docs/spec/006-behavior.md#Scope%20Resolution%20Order).

- **Pure lookup.** Scope lookup reads the file system only through an injectable `existsSync`.
- **Notices, not prints.** Scope preparation returns notices; the caller decides whether to print them.
- **Fixed defaults win.** Ignore rules load `.gitignore`, then `.jactignore`, then defaults that neither file can negate.

Boundary: the scope helpers never parse Markdown.

### `computeValidationSummary.ts`, `getLinkClass.ts` — result helpers

The result helpers count link statuses and classify a link as `wiki`, `caret`, or `markdown` for reports. Both are pure functions.

---

## Boundary

Core imports types and injected services, never the CLI layer or formatters. Two files write user files: `apply-citation-fixes.ts` and `rename-markdown-file.ts`.

Three imports cross the layer line:

| Importer | Imports | Why |
|---|---|---|
| `MarkdownParser/mdastAdapter.ts` | `src/validate/validation-disable.ts` | Detects the disable comment |
| `apply-citation-fixes.ts` | `src/validate/validation-disable.ts` | Reports the skip reason |
| `rename-markdown-file.ts` | `src/factories/componentFactory.ts` | Builds a fresh parser to verify an apply |

`apply-citation-fixes.ts` also prints scan counts with `console.log` when `--scope` is set.

---

## Version History

Each row records one version of this architecture section.

| Version | Changes |
|---------|---------|
| 1.0.0 | Initial architecture for `src/core` |
