# 002. Architecture

**Status:** done

This section maps the `src/core` components, the one job each owns, and the boundaries between them. The repository architecture describes the parser, checker, and extractor internals; this section links there and adds module ownership.

## System Overview

Core is a set of components that callers outside core build and connect. Reads flow from the parser to the checker to the extractor. Only the citation fixer and the rename planner write user files.

```
caller (src/jact-cli.ts, src/validate/, src/cli.ts)
  │
  ├─ scope ──► scope helpers ──► file index (injected, outside core)
  │
  ├─ read ───► parser ──► parsed-document cache (outside core) ──► checker
  │                                                                  │
  │                    linked-context query ◄── extractor ◄──────────┘
  │                    (backlink filter)        (read boundary)
  │
  └─ write ──► citation fixer ──► plain path scanner
               rename planner ──► plain path scanner, fresh parser for verification
```

---

## Components

Each component owns one job and states the guarantees callers rely on.

### `MarkdownParser/` — parser

The parser turns Markdown text into one parser output: links, headings, anchors, and embeds. Internals and the extension registry: [MarkdownParser (`src/core/MarkdownParser/`)](../../../../docs/spec/002-architecture.md#MarkdownParser%20%28%60src/core/MarkdownParser/%60%29).

- **One tree per parse.** Links, headings, anchors, and embeds come from one syntax tree.
- **Size limit.** The parser refuses text over a fixed byte limit; limits: [Input Size Limits](../../../../docs/spec/006-behavior.md#Input%20Size%20Limits).
- **Disable flag is parsed.** The parser reads the validation opt-out from the syntax tree, not from a text search.

Boundary: the parser knows nothing of the parsed-document facade or validation results. It reads files through an injected file-system object.

### `CitationValidator/` — checker

The checker gives each parsed link a status, an error, and a suggestion. Internals: [CitationValidator (`src/core/CitationValidator/`)](../../../../docs/spec/002-architecture.md#CitationValidator%20%28%60src/core/CitationValidator/%60%29).

- **New objects.** The checker returns a new enriched link and leaves the parser's link unchanged.
- **One resolver.** Backlink discovery resolves each candidate link through the checker, not through its own path logic.
- **Parsed links only.** The checker reads the links of a parsed document; it never scans plain text.

Boundary: the checker reads target content only through the injected parsed-document cache. It checks file existence on disk and never writes.

### `ContentExtractor/` — extractor

The extractor reads the content that eligible links point at and removes duplicate content. Strategy order: [ContentExtractor (`src/core/ContentExtractor/`)](../../../../docs/spec/002-architecture.md#ContentExtractor%20%28%60src/core/ContentExtractor/%60%29).

- **Read boundary.** Extraction reads a linked target only inside the scope root, an `--allow-read` folder, or a file the user named. Paths compare after symbolic link resolution. Rules: [Extraction Read Boundary](../../../../docs/spec/006-behavior.md#Extraction%20Read%20Boundary).
- **One block reason.** Every blocked read reports the same reason text, so output stays consistent.

Boundary: the extractor receives links that the checker already checked; it has no checker dependency.

### `LinkedHeaderContext/` — linked-context query

The linked-context query builds the header, outgoing links, and backlinks for `extract header --extract-linked-content`. Workflow: [Linked-context Backlink Discovery](../../../../docs/spec/006-behavior.md#Linked-context%20Backlink%20Discovery).

- **Exhaustive results.** The backlink filter only removes parse candidates; output equals a full scope scan.
- **Safe fallback.** A filter failure or an empty file-name stem keeps every scope file. A file that the filter cannot read stays a candidate.

Boundary: the query receives the parsed-document cache, checker, extractor, and filter as injected interfaces. Filter detail: [BacklinkCandidateFilter (`src/core/LinkedHeaderContext/BacklinkCandidateFilter.ts`)](../../../../docs/spec/002-architecture.md#BacklinkCandidateFilter%20%28%60src/core/LinkedHeaderContext/BacklinkCandidateFilter.ts%60%29).

### `apply-citation-fixes.ts`, `citationFixer.ts` — citation fixer

The citation fixer repairs broken citation paths and anchors, and turns resolved prose `.md` paths into links, for `validate --fix`. Workflow: [Fix Workflow (`--fix`)](../../../../docs/spec/006-behavior.md#Fix%20Workflow%20%28%60--fix%60%29).

- **All or nothing.** A changed citation or two overlapping edits stop the fix before any write.
- **Safe target.** Write refusal rules: [Core Guarantees](../../../../docs/spec/SPEC.md#Core%20Guarantees).
- **No throw.** The fixer returns a report string; a failure returns a string that starts with `ERROR:`.

Boundary: `citationFixer.ts` only rewrites strings; file reads and writes stay in `apply-citation-fixes.ts`.

### `plain-file-paths.ts` — plain path scanner

The plain path scanner finds file paths written as plain text or code and resolves each to one exact file. Rules: [Plain File Paths](../../../../docs/spec/006-behavior.md#Plain%20File%20Paths).

- **Two callers only.** The citation fixer and the rename planner call it; validation never does.
- **Exact match.** Resolution checks only the note folder and scope root, with no file-name search. Two existing candidates are ambiguous, never guessed.

Boundary: the scanner parses with the parser's extension set and never writes.

### `rename-markdown-file.ts` — rename planner

The rename planner moves Markdown files and folders and rewrites every link and plain path that the move changes. Workflow: [Rename Workflow (`jact rename`)](../../../../docs/spec/006-behavior.md#Rename%20Workflow%20%28%60jact%20rename%60%29).

- **Refuse before write.** A refused plan means jact wrote nothing.
- **Verified apply.** After the moves, a fresh parser re-reads every rewritten link at its final location.
- **Rollback.** A failed apply undoes moves, removes new folders, and restores edited files from backups.

Boundary: `src/cli.ts` and `src/jact-cli.ts` expand globs and pick scope; the planner receives absolute source paths.

### `resolveScope.ts`, `prepare-scope.ts`, `ignoreRules.ts` — scope helpers

The scope helpers find the project root, index it, and skip ignored paths. Order: [Scope Resolution Order](../../../../docs/spec/006-behavior.md#Scope%20Resolution%20Order).

- **Pure lookup.** Scope lookup checks marker files only through an injectable file-system object.
- **Notices, not prints.** Scope preparation returns notices; the caller decides whether to print them.
- **Fixed defaults win.** Ignore rules load `.gitignore` (unless `--allow-gitignore`), then `.jactignore`, then defaults that neither file can negate.

Boundary: the scope helpers never parse Markdown.

### `computeValidationSummary.ts`, `getLinkClass.ts` — result helpers

The result helpers count link statuses and classify a link as `wiki`, `caret`, or `markdown` for reports. Both are pure functions.

---

## Boundary

Core imports types, shared utilities, and injected services, never the CLI layer or formatters. Two files write user files: `apply-citation-fixes.ts` and `rename-markdown-file.ts`.

Three imports cross the layer line:

| Importer | Imports | Why |
|---|---|---|
| `MarkdownParser/mdastAdapter.ts` | `src/validate/validation-disable.ts` | Detects the disable comment |
| `apply-citation-fixes.ts` | `src/validate/validation-disable.ts` | Reports the skip reason |
| `rename-markdown-file.ts` | `src/factories/componentFactory.ts` | Builds a fresh parser to verify an apply |

`apply-citation-fixes.ts` also prints scan counts to standard output when `--scope` is set.

---

## Version History

Each row records one version of this architecture section.

| Version | Changes |
|---------|---------|
| 1.0.0 | Initial architecture for `src/core` |
| 1.1.0 | 2026-10-07: Aligned to code; removed internal code names to reduce drift |
