# jact — Agent Operating Rules

Canonical operating doc for agents working in the jact repo. Referenced by the squid `/plan` workflow and by any agent authoring plans, ADRs, or task files here.

## Tracker mode

- `TRACKER_MODE: file` — issues are local Markdown files, one per atomic task.
- **ADR location:** `docs/adrs/`. See [Before exploring, read these](docs/agents/domain.md#Before exploring, read these).

## Issue tracking and case logs

- Issues: local Markdown under `.scratch/{YYYYMMDDTHHMMSS}-{module}-{slug}/` (see [Issue tracker: Local Markdown](docs/agents/issue-tracker.md#Issue tracker: Local Markdown)), not Linear. `design-docs/features/<feature>/` holds the plan/spec/PRD; `/to-issues` slices it into many small tracer-bullet issues — never a 1:1 mapping.
- `CASE-TRACKER.md` rows use the [ten-column session-log format](docs/agents/issue-tracker.md#CASE-TRACKER session log); outcome cells stay 25–40 words.

## Spec and issue separation

- **WHEN** running `/to-spec`, **ALWAYS** create and publish only the canonical spec plus its required Pointer or symlink, **NEVER** create implementation issue files, **BECAUSE** `/to-issues` exclusively owns one-to-many tracer-bullet decomposition and issue creation.

## Canonical-source discipline for `.scratch/`

- `.scratch/{YYYYMMDDTHHMMSS}-{module}-{slug}/` is the issue-tracker workspace (naming per [Issue tracker: Local Markdown](docs/agents/issue-tracker.md#Issue tracker: Local Markdown)). Files meant to persist (PRDs, specs) have their **canonical version in `design-docs/features/<feature>/`** and are **symlinked into `.scratch/`** — never copied.
- **WHEN** a file needs to exist in both `.scratch/` and `design-docs/features/`, **ALWAYS** write the canonical version to `design-docs/features/<feature>/` and `ln -s` into `.scratch/`, **NEVER** `cp`, **BECAUSE** copying creates two files with one truth — they inevitably diverge, and downstream consumers silently read the stale copy while the canonical version moves ahead.
- `.scratch/`-only files (ad-hoc issues, captured ideas not yet promoted to a feature) live directly in `.scratch/` — no symlink needed until they graduate to `design-docs/features/`.

## Markdown links — surgical, to canonical source (like imports)
- **WHEN** writing any markdown document (plans, ADRs, specs, task files, design docs) that references another document, **ALWAYS** use a surgical markdown link to the exact header/anchor of the canonical source — treat it like an `import` statement in code — **NEVER** a prose mention, a bare filename, or a paraphrase, **BECAUSE** linking to the exact section of the canonical source prevents document drift: the reader (human or LLM) resolves current truth on click instead of trusting a copy that silently goes stale.
- **Example:** a plan referencing an ADR links to the ADR file **and** its exact header — `[ADR-0001 · Decision](spec/003-adrs.md#Decision)`, never "see ADR-0001".
- **WHEN** linking to a section, **ALWAYS** use the header's **exact text** as the anchor (run `jact outline <file> H6` first to copy it verbatim), **BECAUSE** jact validates anchors and matches verbatim, not kebab-case.
- **WHEN** a fact already lives in a canonical doc, **ALWAYS** link to it rather than restating it, **BECAUSE** one source of truth + surgical links = no divergent copies to reconcile.
- **WHEN** the link target is a NON-markdown file (`.ts`, `.js`, `.json`, config, any non-`.md`), **NEVER** use a markdown link — write it as a bare backtick path, optionally `path:line` (e.g. `` `src/cli.ts:105` ``), **BECAUSE** jact extracts only markdown: a link to code can't be surgically extracted. Markdown links are for `.md` targets only.

## Chromium rendering and capture

- **WHEN** browser rendering, DOM inspection, screengrabs, or other headless browser work is required, **ALWAYS** use `ws-chromium` as the [Pointer](CONTEXT.md#Pointer) to Chromium under `~/Applications`; **NEVER** infer Chromium is unavailable from a failed `open`, PATH lookup, or system Chrome launch, **BECAUSE** the Pointer resolves the canonical browser source without copying launch details that drift or become stale.

## Delta design research

- **WHEN** proposing a delta or delta hypothesis, **ALWAYS** research how established expert repositories, tools, or domain authorities already solve the same problem before choosing names or interfaces, and cite the evidence that affects the proposal, **BECAUSE** observed conventions prevent local invention and make the change predictable.

## Design-doc hygiene

- Strip Obsidian `%% *Last Modified: ...* %%` timestamps from any markdown committed to this repo — they are fork-local vault artifacts that leak into PRs.

## Artifact drafting

- **WHEN** drafting artifacts, **NEVER** present the artifact in the chat window, **BECAUSE** you waste tokens duplicating the artifact when you **WRITE** it to a persistent location.

## Abstraction translation

- **WHEN** reporting a technical warning in chat, **ALWAYS** explain in plain language what happened, whether it affected the work, and what the user should do; **NEVER** present unexplained technical jargon, **BECAUSE** the user cannot act on information without understanding its practical consequence.

## Project Overview

**jact** (Just Another Context Tool) is a TypeScript CLI tool for validating and managing markdown citation links. It validates cross-document links, generates ASTs of citation relationships, and provides auto-fix capabilities for broken citations and anchors.

## Build and Development Commands

### Essential Commands
```bash
# Install dependencies and build the local checkout
npm install
npm run build

# Run this branch's CLI; tracked hooks maintain global jact from canonical main
node ./dist/cli.js --help

# Run tests
npm test              # Run all Vitest tests
npm run test:watch    # Run tests in watch mode
```

### Citation Tool Commands

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

# Global CLI usage (always canonical main's build; use `node ./dist/cli.js` for this branch)
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
The project includes extensive architecture documentation:

- **ARCHITECTURE-Citation-Manager.md**: C4 model diagrams and system context
- **component-guides/**: Implementation guides for each component
  - CLI Orchestrator Implementation Guide
  - CitationValidator Implementation Guide
  - ContentExtractor Component Guide
  - MarkdownParser Component Guide
  - ParsedDocument Implementation Guide
  - ParsedFileCache Implementation Guide

**When modifying components**: Consult the [jact Living Specification](docs/spec/SPEC.md#jact Living Specification) — `design-docs/component-guides/` is deprecated (banner-marked 2026-07-01).

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
- After changing `src/**/*.ts`, Vitest needs no build. For an end-to-end check of *this* branch, run `npm run build` and invoke `node ./dist/cli.js`—never the global `jact`. Tracked Git hooks synchronize dependencies, rebuild, and relink the global command after changes land on canonical `main`. `npm run global:link` exists only as agent/system recovery and refuses to run outside canonical main.

## Agent skills

### Issue tracker

Issues are tracked as local Markdown files under `.scratch/`. See [Issue tracker: Local Markdown](docs/agents/issue-tracker.md#Issue tracker: Local Markdown).

### Triage labels

Triage uses the five default role names. See [Triage Labels](docs/agents/triage-labels.md#Triage Labels).

### Domain docs

This is a single-context repository with ADRs in `docs/adrs/` and specifications in `docs/spec/`. See [Domain Docs](docs/agents/domain.md#Domain Docs).
