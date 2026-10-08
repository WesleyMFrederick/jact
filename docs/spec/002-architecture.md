# 002. Architecture

**Status:** done

jact is a layered command-line interface (CLI): a thin command layer, an orchestration layer, a dependency-injection factory, and core components that never print or pick exit codes. This section states what each component owns, what it guarantees, and what it must not do.

## System Overview

Each layer calls only the layer below it, and a factory builds and connects every core component. Command registration stays apart from orchestration, so tests import the orchestrator without starting the command parser.

```
┌──────────────────────────────────────────────────────────────────────┐
│  CLI layer — src/cli.ts                                              │
│  commands: validate, rename, outline, ast, extract links|header|file │
└───────────────────────────────┬──────────────────────────────────────┘
                                │ single file          │ batch
                                ▼                      ▼
┌───────────────────────────────┐  ┌─────────────────────────────────┐
│ Orchestrator — src/jact-cli.ts │─▶│ Validate module — src/validate/ │
│ scope, fix, extract, render    │  │ workflow; batch select, run,    │
│                                │  │ report                          │
└───────────────┬───────────────┘  └────────────────┬────────────────┘
                └────────────── wires via ──────────┘
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Component factory — src/factories/                                  │
└──┬──────────────┬───────────────┬────────────────┬───────────────┬───┘
   ▼              ▼               ▼                ▼               ▼
MarkdownParser  FileCache   ParsedFileCache  CitationValidator  ContentExtractor
(src/core/)     (src/)      (src/)           (src/core/)        (src/core/)
   │                              │
   ▼                              ▼
extension registry          ParsedDocument (query facade over parser output)
```

| Folder or file | Owns |
|---|---|
| `src/cli.ts` | Command and flag registration, flag conflicts, exit codes |
| `src/jact-cli.ts` | Single-file orchestration: scope, fix, extraction, report rendering |
| `src/validate/` | The validate workflow and batch selection, run, and report |
| `src/factories/` | Component construction and dependency injection |
| `src/core/` | Parsing, link checking, content extraction, fixes, renames, scope |
| `src/types/` | Shared type declarations; no runtime code |
| `src/outline/` | The heading tree that `jact outline` prints |
| `src/cache/` | Per-session marker files |

`src/core/`, `src/validate/`, and `src/types/` each have a module spec, listed in [Spec Sections](SPEC.md#Spec%20Sections).

---

## Component Specifications

Each component has one job, a few guarantees that tests enforce, and one boundary.

### CLI Orchestrator: `src/cli.ts` + `src/jact-cli.ts`

The command layer parses arguments and maps results to exit codes; the orchestrator runs each command against the core components.

- The command layer rejects conflicting flags (`--stdin` with batch selection, `--json` with `--format json`) with exit `2`.
- The orchestrator renders validation outcomes, scope notices, and hints; the validate workflow returns an outcome only.
- `extract header` and `extract file` build a synthetic link from the command arguments. `extract file` checks that link through the same checker as parsed links.

Boundary: neither file builds the parser, caches, checker, extractor, or validate workflow itself; the factory builds them.

### Component Factory (`src/factories/`)

The factory builds each component with production defaults and accepts a replacement for every dependency.

- Tests inject fakes through the factory and the dependency interfaces, not through concrete classes.
- The extractor gets its eligibility rules in fixed precedence: stop marker, force marker, section link, CLI flag. Rules: [Extraction Eligibility Order](006-behavior.md#Extraction%20Eligibility%20Order).

Boundary: the factory wires components; it holds no parsing, checking, or extraction logic.

### BacklinkCandidateFilter (`src/core/LinkedHeaderContext/BacklinkCandidateFilter.ts`)

The candidate filter cuts the scope files that `extract header --extract-linked-content` parses for backlinks.

- It keeps a file only if the file text contains the root file name, decoded or percent-encoded, ignoring case.
- It always keeps the root file and any file it cannot read.
- A filter failure or an empty file-name stem falls back to parsing every scope file.
- The reported scanned-file count stays the full scope size.

Boundary: the filter only removes candidates; the checker confirms every backlink.

### MarkdownParser (`src/core/MarkdownParser/`)

The parser turns Markdown text into one parser output (links, headings, anchors, embeds) from one micromark and mdast syntax tree. Why: [ADR-0002 — Regex → mdast-token migration (WMF-35)](../adrs/003-adrs.md#ADR-0002%20—%20Regex%20→%20mdast-token%20migration%20%28WMF-35%29).

- One registry groups every syntax extension by Markdown flavor, so a new construct is one new registry entry: [ADR-0003 — Flavor Extension Collection](../adrs/003-adrs.md#ADR-0003%20—%20Flavor%20Extension%20Collection).
- Consumers read typed results, including [typed embed references](004-domain-model.md#EmbedReference); nothing re-scans decoded prose.
- The parser refuses input over its size limit: [Input Size Limits](006-behavior.md#Input%20Size%20Limits).

The registry recognizes this syntax:

| Flavor | Syntax |
|---|---|
| CommonMark (built into micromark) | inline and reference links, autolinks, ATX and setext headings, code |
| Obsidian | YAML frontmatter, `==highlight==`, `%%comment%%`, `[cite: path]`, `^anchor-id`, `[[target#anchor\|alias]]`, `![[embed]]`, links whose fragment holds a raw space |

Boundary: the parser knows nothing of the query facade or validation results.

### CitationValidator (`src/core/CitationValidator/`)

The checker gives each parsed link a status (valid, warning, or error), an error message, and a suggestion.

- It returns a new enriched link and leaves the parser's link unchanged.
- Path resolution and anchor matching are separate units inside the folder; the order is in [Path Resolution Strategy Order (cross-document links)](006-behavior.md#Path%20Resolution%20Strategy%20Order%20%28cross-document%20links%29) and [Anchor Matching Order](006-behavior.md#Anchor%20Matching%20Order).
- Backlink discovery resolves each candidate link through the checker, not through its own path logic.

Boundary: the checker reads documents only through the injected parsed-document cache and file index; it never writes.

### ContentExtractor (`src/core/ContentExtractor/`)

The extractor reads the content that eligible links point at and removes duplicate content by content hash.

- A read boundary permits a linked target only inside the scope root or an `--allow-read` folder: [Extraction Read Boundary](006-behavior.md#Extraction%20Read%20Boundary).

Boundary: the extractor receives links that the checker already checked; it has no checker dependency.

### ParsedDocument (`src/ParsedDocument.ts`)

The query facade answers questions about one parsed document: anchors, links, headings, sections, and blocks.

- Heading lookup reports a unique, missing, or ambiguous match.
- Similar-anchor suggestions stop at fixed work limits.

Boundary: consumers query the facade, never the raw parser output.

### ParsedFileCache (`src/ParsedFileCache.ts`)

The parsed-document cache makes sure jact parses each file at most once per process.

- It caches the in-flight parse by absolute path, so concurrent requests share one parse.
- A failed parse leaves the cache, so a retry parses again.
- In-memory content (`--stdin`) replaces any cached entry for its intended path.

Boundary: the cache holds no parsing logic; the injected parser does the work.

### FileCache (`src/FileCache.ts`)

The file index maps Markdown file names to paths inside the scope folder, for links that do not resolve by relative path.

- It resolves the scope folder and each subfolder to its real path, and scans each real folder once.
- It obeys `.gitignore` unless `--allow-gitignore` is set, and always obeys `.jactignore` and the default ignore patterns.
- A name that matches more than one file is an error with ranked candidates; a near-miss name gets suggestions.

Boundary: the index never parses Markdown.

---

## Batch-Validate Components (`src/validate/`)

The validate module runs `jact validate` for one file or many over the shared checker, with no copy of the validation logic. `jact validate` checks link syntax only; plain text and inline code are never checked.

| Part | Responsibility |
|---|---|
| Single-input workflow | Checks one file or one in-memory document; returns a completed, skipped, or failed outcome and never throws |
| Opt-out directive | Detects the disable comment and holds the one skip reason |
| File-set selection | Expands paths, globs, and `--changed` into one sorted, deduplicated `.md` list |
| Git-changed files | Lists changed Markdown from `git status` through a replaceable `git` runner |
| Batch run | Checks files one at a time and totals the results |
| Batch reports | Human and JSON Lines views of one batch summary |

Module ownership and guarantees: [validate Module Living Specification](../../src/validate/docs/spec/SPEC.md#validate%20Module%20Living%20Specification).

---

## Layer Boundaries

Core never imports the command layer, the orchestrator, or the output formatters. Four imports cross a layer line on purpose, so each shared rule keeps one owner.

| Importer | Imports from | Why |
|---|---|---|
| Parser adapter in `src/core/MarkdownParser/` | `src/validate/` opt-out directive | Sets the disable flag from the syntax tree |
| Citation fixer in `src/core/` | `src/validate/` opt-out directive | Reports the same skip reason as validation |
| Rename planner in `src/core/` | `src/factories/` | Builds a fresh parser to verify an applied rename |
| `src/ParsedDocument.ts` | `src/outline/` | Builds the heading tree for heading lookup |

The opt-out directive imports only syntax-tree types, so these imports form no cycle. The dependency interfaces live in `src/core/`; `src/types/` re-exports them as type-only imports.

---

## Version History

| Version | Date | Changes |
|---|---|---|
| 1.1.0 | 2026-10-07 | Aligned to code; removed internal code names to reduce drift |
| 1.0.0-draft | 2026-08-24 | Added the stateless backlink candidate filter and its excludes-only correctness boundary |
| 1.0.0-draft | 2026-07-01 | Initial architecture doc, replacing per-component design-docs guides |
