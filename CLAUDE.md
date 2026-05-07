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

### `jact` (Just Another Context Tool) Commands To Validate & Extract Markdown Content

%% *Last Modified: 05/01/26 21:23:24* %%

```bash
# Validate citations (CLI output)
jact validate path/to/file.md

# Validate with JSON output
jact validate path/to/file.md --format json

# Validate with line filtering
jact validate path/to/file.md --lines 150-160

# In-repo: scope auto-inferred from cwd (.git or package.json walk-up)
jact validate path/to/file.md

# Cross-project / explicit override only:
jact validate path/to/file.md --scope /other/project/docs

# Auto-fix broken citations
jact validate path/to/file.md --fix

# View AST and extracted data
jact ast path/to/file.md

# Extract base paths
jact base-paths path/to/file.md

# Extract content from links
jact extract path/to/file.md

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
CLI Orchestrator (jact.ts)
    ↓
Component Factories (componentFactory.ts)
    ↓
Core Components:
    - MarkdownParser: Parses markdown to AST using marked.js
    - CitationValidator: Validates links and anchors
    - ContentExtractor: Extracts content from linked documents
    - ParsedFileCache: Caches parsed documents for performance
    - FileCache: Resolves file paths with smart filename matching
```

### Source Organization

%% *Last Modified: 05/07/26 08:43:37* %%


Run !`find src -type f -not -name '.DS_Store' | sort`


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

### Key Principle: Separation of Concerns
- **MarkdownParser**: Only syntactic analysis, produces raw AST data
- **ParsedDocument**: Facade that provides semantic interface over parser output
- **CitationValidator**: Link/anchor validation, file existence checking
- **ContentExtractor**: Content retrieval and deduplication
- **CLI Orchestrator**: Command routing, output formatting


## Path Resolution Strategy

The tool supports multiple path resolution strategies (in order):
1. Standard relative path from source location
2. Obsidian absolute path format (`0_SoftwareDevelopment/...`)
3. Symlink-aware resolution (resolves symlinks and retries)
4. Cache fallback (filename matching in `--scope` folder)

## Citation Patterns Supported

%% *Last Modified: 05/03/26 19:33:35* %%

- Cross-document links: `[Text](path/to/file.md#anchor)`
- Caret syntax: `^FR1`, `^US1-1AC1`, `^NFR2`
- Emphasis-marked anchors: `#==**Component%20Name**==`
- Wiki-style references — 10 forms per D1 grammar (source of truth: `src/core/MarkdownParser/extractWikilinks.ts`):
  1. `[[Page]]`
  2. `[[Page|Display]]`
  3. `[[Page.md]]`
  4. `[[Page.md|Display]]`
  5. `[[Page#section]]`
  6. `[[Page#section|Display]]`
  7. `[[Page.md#section]]`
  8. `[[Page.md#section|Display]]`
  9. `[[#anchor]]`
  10. `[[#anchor|Display]]`

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

### Test Fixtures:

%% *Last Modified: 05/04/26 10:25:32* %%

- **ALWAYS use test fixtures from `test/` folder, BECAUSE files outside `test/` are not guaranteed to exist** (may be archived, moved, or deleted)
- **NEVER hardcode paths to design-docs/** — copy files to `test/<suite>/fixtures/` instead
- When design-docs files are needed by tests: copy them to fixtures once, then reference only the fixture copy
- Hardcoded external paths = flaky tests; fixture copies = reliable isolation

### Feature Design-Doc Naming and Persistence

%% *Last Modified: 05/07/26 12:25:06* %%

**ALWAYS create a feature directory in `design-docs/features/` for any new feature or feature update, BECAUSE design artifacts without a persistent home get scattered across `design-docs/` root or lost between sessions.**

**Directory naming:** `YYMMDDHHMM-ComponentName-feature-verb/`
- `YYMMDDHHMM` = feature kickoff timestamp (24h, local time) — **always run `date '+%y%m%d%H%M'` via Bash to get the real system time. Never approximate.**
- `ComponentName` = the primary code module affected (e.g., `FileCache`, `CitationValidator`, `MarkdownParser`)
- `feature-verb` = kebab-case action describing the work (e.g., `scan-optimization`, `add-wikilink-validation`, `fix-anchor-resolution`)
- Examples:
  - `2605070945-FileCache-scan-optimization/`
  - `2605081400-CitationValidator-add-depth-limiting/`
  - `2605090830-MarkdownParser-fix-nested-emphasis/`

**File naming inside feature directories:** `{folder-name}-{file-type}.md`
- Files re-use the full folder name and append a kebab-case file-type suffix, BECAUSE a file must be self-contained (readable in search results, git log, or flat listings without needing the parent path for context)
- `{file-type}` = the artifact's role (e.g., `analysis`, `todo`, `plan`, `learnings`, `sequence`)
- Examples (folder: `2605070945-FileCache-scan-optimization/`):
  - `2605070945-FileCache-scan-optimization-analysis.md`
  - `2605070945-FileCache-scan-optimization-todo.md`
  - `2605070945-FileCache-scan-optimization-learnings.md`

**When updating an existing feature:** Add new artifacts to the existing feature directory. Do not create a second directory for the same feature. If the feature scope changes significantly (different component, different problem), create a new directory.

**NEVER create design-doc artifacts at `design-docs/` root for feature work, BECAUSE rootlevel files have no feature context and become orphaned when the feature completes.**

**Archival:** When a feature ships or is abandoned, move the entire directory to `design-docs/features/.archive/`.

## graphify

%% *Last Modified: 05/07/26 08:54:41* %%

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)

## Baseline Code Gathering Process

%% *Last Modified: 05/07/26 08:54:41* %%

Before implementing any change request, gather baseline understanding of the affected code. Goal: know what to change and what it touches before writing a single line.

### Step 1: Map the neighborhood (graphify)

%% *Last Modified: 05/07/26 08:54:41* %%

Run `graphify explain "<target>"` on the file or function the user identified. This returns connections, community, and degree. Repeat for each direct neighbor that looks relevant (consumers, callees).

```bash
$(cat graphify-out/.graphify_python) -m graphify explain "<target_symbol>"
```

### Step 2: Trace the call chain (graphify path)

%% *Last Modified: 05/07/26 08:54:41* %%

If the change affects a component consumed by other modules, trace the shortest path to the primary consumer:

```bash
$(cat graphify-out/.graphify_python) -m graphify path "<changed_module>" "<consumer_module>"
```

This reveals intermediate dependencies that may need updating.

### Step 3: Confirm call sites (Grep)

%% *Last Modified: 05/07/26 08:54:41* %%

Use Grep to find exact import and invocation lines in the files graphify identified:

```bash
# Grep for the function/export name in each consuming file
```

This grounds the graph edges in actual line numbers.

### Step 4: Read the hot path (Read)

%% *Last Modified: 05/07/26 08:54:41* %%

Read the specific code sections where the target is called. Use `offset`/`limit` to read only the relevant function or loop, not the entire file. Focus on:
- How the target is invoked (args, return value usage)
- What surrounds it (loops, conditionals, error handling)
- Performance characteristics (per-call allocation, recursion depth)

### Step 5: Write analysis, then present

%% *Last Modified: 05/07/26 08:54:41* %%

Write findings to `design-docs/<topic>-analysis.md` with:
- Current behavior and call chain
- Identified problem (with data if available)
- Ranked alternatives with effort/impact/deps tradeoffs
- Recommendation

Present a scannable summary in chat. The file is the durable artifact; chat is the executive briefing.
