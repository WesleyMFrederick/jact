# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**jact** (Just Another Context Tool) is a TypeScript CLI tool for validating and managing markdown citation links. It validates cross-document links, generates ASTs of citation relationships, and provides auto-fix capabilities for broken citations and anchors.

## Build and Development Commands

### Essential Commands
```bash
# Install dependencies and build
npm install
npm run build          # Compile TypeScript to dist/
npm link               # Make jact CLI globally available

# After modifying TypeScript files, always rebuild
npm run build

# Run tests
npm test              # Run all Vitest tests
npm run test:watch    # Run tests in watch mode
```

### Citation Tool Commands

%% *Last Modified: 05/01/26 21:23:24* %%

```bash
# Validate citations (CLI output)
npm run jact:validate path/to/file.md

# Validate with JSON output
npm run jact:validate path/to/file.md -- --format json

# Validate with line filtering
npm run jact:validate path/to/file.md -- --lines 150-160

# In-repo: scope auto-inferred from cwd (.git or package.json walk-up)
npm run jact:validate path/to/file.md

# Cross-project / explicit override only:
npm run jact:validate path/to/file.md -- --scope /other/project/docs

# Auto-fix broken citations
npm run jact:validate path/to/file.md -- --fix

# View AST and extracted data
npm run jact:ast path/to/file.md

# Extract base paths
npm run jact:base-paths path/to/file.md

# Extract content from links
npm run jact:extract path/to/file.md

# Direct CLI usage (after npm link)
# In-repo: scope auto-inferred from cwd
jact validate path/to/file.md --lines 157

# Cross-project / explicit override only:
jact validate path/to/file.md --lines 157 --scope /other/project/docs
```

## Architecture Overview

### High-Level Architecture
The tool follows a **layered architecture** with dependency injection via factory pattern:

```
CLI Orchestrator (cli.ts → jact-cli.ts)
    ↓
Component Factories (componentFactory.ts)
    ↓
Core Components:
    - MarkdownParser: Parses markdown to mdast AST using micromark (Flavor Extension Collection)
    - CitationValidator: Validates links and anchors
    - ContentExtractor: Extracts content from linked documents
    - ParsedFileCache: Caches parsed documents for performance
    - FileCache: Resolves file paths with smart filename matching
```

### Source Organization
%% *Last Modified: 07/01/26 17:02:05* %%

```
src/
├── cli.ts / jact-cli.ts          # Commander entry + JactCli orchestration class
├── CitationValidator.ts          # Link/anchor validation logic
├── FileCache.ts                  # File path resolution and caching
├── ParsedDocument.ts             # Facade over MarkdownParser output
├── ParsedFileCache.ts            # Caches ParsedDocument instances
├── core/
│   ├── ContentExtractor/         # Content extraction with strategy pattern
│   │   ├── ContentExtractor.ts
│   │   └── eligibilityStrategies/  # Strategy pattern for extraction rules
│   └── MarkdownParser/           # Markdown parsing to AST
│       ├── MarkdownParser.ts
│       ├── extractHeadings.ts
│       ├── resolvePath.ts
│       └── determineAnchorType.ts
├── factories/
│   ├── componentFactory.ts       # DI factory for components
│   └── LinkObjectFactory.ts      # Creates LinkObject instances
└── types/                        # TypeScript type definitions
    ├── citationTypes.ts
    ├── validationTypes.ts
    └── contentExtractorTypes.ts
```

### Key Design Patterns

1. **Factory Pattern**: `componentFactory.ts` creates components with dependency injection
2. **Facade Pattern**: `ParsedDocument` wraps `MarkdownParser` output
3. **Strategy Pattern**: `ContentExtractor` uses eligibility strategies (StopMarkerStrategy, ForceMarkerStrategy, etc.)
4. **Cache Pattern**: `ParsedFileCache` ensures files parsed at most once

## TypeScript Configuration

The project uses **strict TypeScript** with:
- Target: ES2022
- Module: NodeNext (ESM)
- Strict mode enabled with additional safety checks:
  - `noUncheckedIndexedAccess: true`
  - `exactOptionalPropertyTypes: true`
  - `noImplicitReturns: true`
  - `noPropertyAccessFromIndexSignature: true`

**Important**: All source is TypeScript (`src/*.ts`), compiled to `dist/*.js`. After any TS changes, re-run `npm run build`.

## Testing

### Test Structure
- **Framework**: Vitest
- **Location**: `test/` directory
- **Types**: Unit tests, integration tests, type safety tests

### Running Tests
```bash
npm test              # Run all tests once
npm run test:watch    # Watch mode for development
```

### Test Organization
```
test/
├── unit/                           # Component unit tests
│   ├── jact-*.test.ts
│   ├── factories/
│   └── types/
├── integration/                    # End-to-end workflow tests
└── types/                          # Type contract validation
```

## Component Interaction Patterns

### Workflow: Extract Links Command
1. **CLI Orchestrator** receives `extract links` command
2. Creates `CitationValidator` and `ContentExtractor` via factory
3. **Phase 0**: Calls `validator.validateFile()` to discover and validate links
4. **Phase 1**: Passes enriched links to `contentExtractor.extractContent()`
5. **Phase 2**: ContentExtractor retrieves target documents via `ParsedFileCache`
6. **Phase 3**: Deduplicates content and outputs JSON

### Workflow: Extract Header/File Commands
1. **CLI Orchestrator** creates synthetic link via `LinkObjectFactory`
2. Calls `validator.validateSingleCitation()` to validate synthetic link
3. Continues with same Phases 1-3 as `extract links`

### Key Principle: Separation of Concerns
- **MarkdownParser**: Only syntactic analysis, produces raw AST data
- **ParsedDocument**: Facade that provides semantic interface over parser output
- **CitationValidator**: Link/anchor validation, file existence checking
- **ContentExtractor**: Content retrieval and deduplication
- **CLI Orchestrator**: Command routing, output formatting

## Design Documentation
%% *Last Modified: 07/01/26 17:02:04* %%

The project includes extensive architecture documentation:

- **ARCHITECTURE-Citation-Manager.md**: C4 model diagrams and system context
- **component-guides/**: Implementation guides for each component
  - CLI Orchestrator Implementation Guide
  - CitationValidator Implementation Guide
  - ContentExtractor Component Guide
  - MarkdownParser Component Guide
  - ParsedDocument Implementation Guide
  - ParsedFileCache Implementation Guide

**When modifying components**: Consult the living spec at `design-docs/spec/SPEC.md` — `design-docs/component-guides/` is deprecated (banner-marked 2026-07-01).

## Path Resolution Strategy

The tool supports multiple path resolution strategies (in order):
1. Standard relative path from source location
2. Obsidian absolute path format (`0_SoftwareDevelopment/...`)
3. Symlink-aware resolution (resolves symlinks and retries)
4. Cache fallback (filename matching in `--scope` folder)

## Citation Patterns Supported

- Cross-document links: `[Text](path/to/file.md#anchor)`
- Caret syntax: `^FR1`, `^US1-1AC1`, `^NFR2`
- Wiki-style references: `[[#anchor|Text]]`
- Emphasis-marked anchors: `#==**Component%20Name**==`

## Exit Codes

- `0`: Success (all citations valid)
- `1`: Validation failure (broken citations found)
- `2`: System error (file not found, permission denied, parse error)

## Important Implementation Notes

### When Adding New Features:
1. Add types to appropriate `types/*.ts` file
2. Implement core logic in relevant component
3. Add factory method if new component created
4. Wire through CLI orchestrator
5. Add tests in `test/` mirroring source structure
6. Update component guide in `design-docs/`

### When Fixing Bugs:
1. Check component guides for expected behavior
2. Write failing test first (TDD approach)
3. Fix implementation
4. Verify all tests pass
5. Run `npm run build` before committing

### Component Boundaries:
- **MarkdownParser** is NOT aware of `ParsedDocument` facade
- **ContentExtractor** receives pre-validated links from CLI
- **ParsedFileCache** ensures single parse per file
- CLI orchestrates, components do NOT call each other directly (except through injected dependencies)

## Agentic Codebase Navigation

How an LLM/agent session should orient in this codebase. Route by what you already have — no single tool wins all jobs.

### Static analysis

| You have | Use | How |
|---|---|---|
| No symbol name — only intent ("where does anchor matching happen?") | **semble** | `semble search "<intent>" .` → hits with file:line. Expand from a hit: `semble find-related <file> <line> .`. Heuristic ranking — confirm exact relationships with LSP. |
| A TS symbol name | **LSP** | `documentSymbol` (list a file's exports), `workspaceSymbol` (find by name), `findReferences` (every consumer — resolves interface dispatch and DI wiring), `goToDefinition`. Never grep `.ts` for structure; a hook blocks it (append `# grep-ts-ok` only for literal string matches). |
| A literal string / config value / non-TS file | **grep / Read** | Exact match you already know. |

Parser entry points for orientation: `src/core/MarkdownParser/extensions/flavors.ts` (what jact parses, grouped by flavor), `src/core/MarkdownParser/mdastAdapter.ts` (tree → domain objects), `src/factories/componentFactory.ts` (DI wiring — who gets injected what).

### Runtime analysis (AppMap)
%% *Last Modified: 07/02/26 08:33:59* %%

Capture real execution traces when static reading is not enough (cache behavior, DI resolution order, which strategy fired):

```bash
# Instrument any test run; AppMaps land in tmp/appmap/ (gitignored)
npx appmap-node npx vitest run test/path/to/file.test.ts

# Instrument the CLI itself
npx appmap-node ./dist/cli.js validate path/to/file.md
```

Each `.appmap.json` under `tmp/appmap/` is a full call trace. Read it with **`appmap-read`** (global CLI; canonical source `cc-workflows-plugin/src/runtime-and-static-analysis/appmap-read.mjs` — local `scripts/appmap-read.mjs` is a symlink to it) at three zoom levels — never raw-cat the JSON:

```bash
appmap-read --zoom L0 tmp/appmap/vitest        # semantic summary per map: entry, hot functions, exceptions
appmap-read --zoom L1 tmp/appmap/vitest/<map>.appmap.json   # LLM-readable call graph (caller → callees ×count)
appmap-read --zoom L2 tmp/appmap/vitest/<map>.appmap.json   # verbose call tree with params/returns + file:line
```

Start at L0 across a directory, zoom to L2 on the one map that matters. Config: `appmap.yml` (repo root).

### Ground rules

- `jact` CLI reads **markdown only** — never point it at `.ts`/`.json` (silently returns garbage).
- After changing `src/**/*.ts`: tests need no build (Vitest transforms TS), but the `jact` CLI binary runs `dist/` — run `npm run build` before any end-to-end CLI check.
