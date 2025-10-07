# Citation Manager - Tool Architecture [DRAFT]

**Critical LLM Initialization Instructions**: When first reading this file, you MUST IMMEDIATELY run citation manager to extract base paths: `npm run citation:base-paths <this-file-path> -- --format json`. Read ALL discovered base path files to gather complete architectural context before proceeding.

**Status**: DRAFT - Component-level architecture in development

**Parent Architecture**: [CC Workflows Workspace Architecture](../../../../../design-docs/features/20250928-cc-workflows-workspace-scaffolding/cc-workflows-workspace-architecture.md)

---

## Tool Overview

**Purpose**: Citation-manager validates markdown citation links, generates abstract syntax trees of citation relationships, and provides auto-fix capabilities for broken citations and anchors.

**User Value**:
- Eliminates manual citation validation in documentation
- Prevents broken links and invalid anchors before commits
- Provides automated citation correction and path resolution
- Enables AI agents to understand documentation structure through AST output

**Workspace Role**: First tool migrated into CC Workflows workspace, serving as validation for workspace architecture patterns and shared testing infrastructure.

---

## Level 1: System Context Diagram

This diagram shows the **Citation Manager** as the central system used by developers and AI coding assistants to maintain documentation quality through automated citation validation and correction.

### System Context Diagram

```mermaid
graph TB
    AiAssistant("<b style='font-size: 1.15em;'>AI Coding Assistant</b><br/>[Person]<br/><br/>AI agents ensuring documentation quality")@{ shape: circle }

    CitationMgr("<b style='font-size: 1.15em;'>Citation Manager</b><br/>[Software System]<br/><br/>Validates markdown citations, generates AST representations, and provides automated fixing of broken links and anchors")

    FileSystem("<b style='font-size: 1.15em;'>File System</b><br/>[Software System]<br/><br/>Local file system containing markdown documentation")

    AiAssistant -.->|"Validates documentation and fixes citations USING"| CitationMgr
    AiAssistant -.->|"Ensures documentation quality USING"| CitationMgr

    CitationMgr -.->|"Reads markdown files FROM"| FileSystem
    CitationMgr -.->|"Writes corrected files TO"| FileSystem

    CitationMgr -.->|"Returns validation results, AST output TO"| AiAssistant

    %% Color coding for C4 diagram clarity
    classDef person stroke:#052e56, stroke-width:2px, color:#ffffff, fill:#08427b
    classDef softwareSystemFocus stroke:#444444, stroke-width:2px, color:#444444, fill:transparent
    classDef softwareSystemExternal fill:#999999,stroke:#6b6b6b,color:#ffffff, stroke-width:2px

    class AiAssistant person
    class CitationMgr softwareSystemFocus
    class FileSystem softwareSystemExternal

    linkStyle default color:#555555
```

---

## Level 2: Container Context

**Container Classification**: Citation-manager is a **Tool Package Container** within the [CC Workflows Workspace](../../../../../design-docs/features/20250928-cc-workflows-workspace-scaffolding/cc-workflows-workspace-architecture.md#Level%202%20Containers) software system.

**Container Details**:
- **Name**: Citation Manager
- **Technology**: Node.js, Commander.js, ESM modules
- **Deployment**: CLI tool executable via workspace npm scripts
- **Process Model**: Single-process command execution

**Workspace Integration**:
- Testing: Shared Vitest framework from workspace root
- Quality: Shared Biome configuration from workspace root
- Dependencies: Managed via workspace package.json hoisting
- Execution: Via workspace root npm scripts (`npm run citation:validate`, etc.)

---

## Level 3: Components

%%
### Component Level: Impact Analysis

The primary impact is the addition of **Content Extractor** (Epic 2), enabling content aggregation from linked markdown sections. Existing components remain functionally unchanged during migration, with path updates only.

**Current Architecture**: 4 source files with 1:1 component mapping (CitationManager, MarkdownParser, FileCache, CitationValidator). Each file contains a single class representing one component.

#### New Components (Epic 2)
- **ContentExtractor**: Extracts and aggregates content from linked files/sections for AI context management (new standalone file)

%%

### Citation Manager Components

#### Citation Manager.CLI Orchestrator

- **Path(s):** `tools/citation-manager/src/citation-manager.js`
- **Technology:** `Node.js` class, `Commander.js` CLI framework, ESM modules
- **Technology Status:** Production
- **Description:** CLI entry point orchestrating all citation management operations. Parses commands (validate, ast, base-paths, fix), coordinates workflow execution, formats output for CLI/JSON display, and implements auto-fix logic for broken citations and paths.

##### Interactions
- _creates and coordinates_ `Markdown Parser`, `File Cache`, `ParsedFileCache`, `Citation Validator`, ==and `ContentExtractor`== components (synchronous).
- _injects_ dependencies such as the `FileCache` and `ParsedFileCache` into components like the `CitationValidator` at instantiation (synchronous).
- _delegates to_ the `MarkdownParser` for the `ast` command (asynchronous).
- _delegates to_ the `CitationValidator` for the `validate` command (asynchronous).
- ==_delegates to_ the `ContentExtractor` to aggregate document content (asynchronous).==
- _reads and writes_ markdown files directly for the `--fix` operation (synchronous).
- _outputs_ formatted results to stdout/stderr (synchronous).

##### Boundaries
The component's primary responsibility is to delegate core business logic (e.g., parsing, validation) to specialized components. It makes a specific exception for the **`--fix`** operation, where it contains the application-level logic to read a file, apply suggestions generated by the `CitationValidator`, and write the corrected content back to disk. This boundary exception is the basis for the [Scattered File I/O Operations](#Scattered%20File%20I/O%20Operations) Tech Debt

##### Input Public Contract
1. **Command-line arguments** (`process.argv`), provided by the user, which define the requested command and its options.
2. Access to the **component factory** to instantiate and wire together all necessary downstream components.

##### Output Public Contract
1. A **formatted string** (a human-readable report or JSON) written to `stdout`.
2. An **exit code** (`0` for success, non-zero for failure) to signal the outcome of the operation to the calling process.
3. **File system modifications**, which occur only when the `--fix` command is used.

#### Citation Manager.Markdown Parser
- **Path(s):** `tools/citation-manager/src/MarkdownParser.js`
- **Technology:**
  - `Node.js` class
  - `marked` markdown tokenizer library
  - ESM modules
- **Technology Status:** Production
- **Description:** Parses markdown files to extract AST representation of document structure. Identifies cross-document links (multiple pattern types), extracts headings and anchors (including Obsidian block refs and caret syntax), generates multiple anchor format variations for compatibility.
- **Implementation Guide**: [Markdown Parser Implementation Guide](../../component-guides/Markdown%20Parser%20Implementation%20Guide.md) for the detailed data contract schema and examples

##### Interactions
- _reads_ markdown files directly from file system (synchronous)
- _tokenizes_ markdown content using `marked` library (synchronous)
- _provides_ structured AST data to `CLI Orchestrator` and `Citation Validator` (synchronous)

##### Boundaries
The component is exclusively responsible for transforming a raw markdown string into the structured **Parser Output Contract**. Its responsibilities are strictly limited to syntactic analysis. The component is **not** responsible for:
- Validating the existence or accessibility of file paths.
- Verifying the semantic correctness of links or anchors.
- Interpreting or executing any code within the document.

#### Citation Manager.File Cache
- **Path(s):** `tools/citation-manager/src/FileCache.js`
- **Technology:** `Node.js` class, ESM modules
- **Technology Status:** Production
- **Description:** Maintains an in-memory cache mapping short filenames to absolute file paths within a given directory scope. It handles symlink resolution to avoid duplicates, detects duplicate filenames, and provides fuzzy matching capabilities for common typos.

##### Interactions
- _scans_ directories recursively to build its internal cache upon request (synchronous).
- _provides_ filename-to-absolute-path resolution to the `Citation Validator` (synchronous).
- _warns_ about duplicate filenames to stderr during the cache build process (synchronous).

##### Boundaries
The component is exclusively responsible for mapping short filenames to their absolute file paths within a given directory scope. Its file system access is limited to the initial directory scan when `buildCache()` is called. It is **not** responsible for reading, parsing, or caching the **content** of any files; it only manages their paths.

##### Input Public Contract
1. A **File System interface** and a **Path Module interface**, provided at instantiation.
2. A **`scopeFolder`** (string), provided to its `buildCache()` method to initialize the cache.
3. A **`filename`** (string), provided to its `resolveFile()` method to perform a lookup.

##### Output Public Contract
The component's primary output is from the `resolveFile()` method, which returns a **Resolution Result object**. This object indicates whether a file was `found`, its absolute `path` if successful, and contextual information such as the `reason` for failure (e.g., 'duplicate', 'not_found'). The `buildCache()` method returns a statistics object summarizing the state of the cache after a scan.

#### Citation Manager.Citation Validator
- **Path(s):** `tools/citation-manager/src/CitationValidator.js`
- **Technology:**
  - `Node.js` class
  - ESM modules
- **Technology Status:** Production
- **Description:** Validates `Link Objects` by consuming `Parser Output Contract` objects to check for target and anchor existence. It classifies citation patterns (caret syntax,cross-document, wiki-style), resolves file paths using multiple strategies (relative paths, symlinks, Obsidian absolute paths, cache lookup), generates validation results with actionable suggestions.
- **Implementation Guide**: [CitationValidator Implementation Guide](../../component-guides/CitationValidator%20Implementation%20Guide.md) for public contracts and data objects

##### Interactions
- _uses_ the `ParsedFileCache` to retrieve parsed data for target files (asynchronous).
- _uses_ the `FileCache` for filename resolution when a scope is provided (synchronous, optional dependency).
- _validates_ file existence directly via the file system as a fallback (synchronous).
- _returns_ validation results with status and suggestions to the `CLI Orchestrator` (asynchronous).

##### Boundaries
- The component is exclusively responsible for the semantic validation of `Link Objects` (e.g., "does this link point to a real target?").
- It is **not** responsible for parsing markdown (delegated to `MarkdownParser` via the cache) or for managing the efficiency of parsing operations (delegated to `ParsedFileCache`).
- It does **not** perform file modifications; it only generates suggestions.

#### Citation Manager.ParsedFileCache
- **Path(s):** `tools/citation-manager/src/ParsedFileCache.js`
- **Technology:**
  - `Node.js` class
  - ESM modules
- **Technology Status:** Implemented
- **Description:** Maintains an in-memory cache of parsed file objects (`Parser Output Contract`) for the duration of a single command run. Ensures each file is read from disk and parsed by the `MarkdownParser` at most once.
- **Implementation Guide**: [ParsedFileCache Implementation Guide](../../component-guides/ParsedFileCache%20Implementation%20Guide.md) for public contracts and data objects

##### Interactions
- _is consumed by_ the `CitationValidator` and ==`ContentExtractor`== to retrieve parsed file data (asynchronous).
- _delegates to_ the `MarkdownParser` to parse files that are not yet in the cache (asynchronous).
- _is instantiated by_ the `CLI Orchestrator` (via its factory) (synchronous).

##### Boundaries
- The component's sole responsibility is to manage the in-memory lifecycle of parsed file objects. It acts as a key-value store mapping file paths to `Parser Output Contract` objects.
- It is **not** responsible for the parsing logic itself (which is delegated) or for any direct file system operations.

##### Error Handling & Cache Correctness
- **Promise Rejection Pattern**: When a parse operation fails (e.g., file not found, permission error), the cache MUST synchronously remove the failed promise before propagating the rejection. This ensures subsequent requests can retry without being blocked by stale failed promises.
- **Retry Support**: Removing failed promises from cache enables retry on transient errors (temporary permission issues, network drive timeouts).
- **Implementation Critical**: The `.catch()` handler must execute `cache.delete(key)` synchronously to prevent race conditions between error handling and new requests.

#### ==Citation Manager.Content Extractor==
- ==**Path(s):** `tools/citation-manager/src/ContentExtractor.js` (_PROPOSED - [Epic 2](https://www.google.com/search?q=content-aggregation-prd.md%23Feature%2520Epics))_==
- ==**Technology:**==
  - ==`Node.js` class==
  - ==ESM modules==
- ==**Technology Status:** To Be Implemented==
- ==**Description:** Extracts full content from linked documents or specific sections within them. It uses the pre-parsed token stream to reliably identify section boundaries for accurate content aggregation.==

##### ==Interactions==
- ==_is consumed by_ the `CLI Orchestrator` to perform content aggregation (asynchronous).==
- ==_uses_ the `ParsedFileCache` to retrieve the `Parser Output Contract` (which includes the content and tokens) for target documents (asynchronous).==

##### ==Boundaries==
- ==The component's sole responsibility is to extract a string of content from a `Parser Output Contract` based on a given `Link Object`.==
- ==It is **not** responsible for parsing markdown or reading files from disk; it operates on the already-parsed data provided by the cache.==

##### ==Input Public Contract==
1. ==A **`ParsedFileCache` interface**, provided at instantiation.==
2. ==A **`Link Object`**, provided to its public `extract()` method, which specifies the target file and anchor to extract.==

##### ==Output Public Contract==
==The `extract()` method returns a `Promise` that resolves with a **Content Block object**. This object contains the extracted `content` (string) and `metadata` about its source (e.g., the source file path and anchor).==

### Component Interaction Diagram After US1.5

```mermaid
sequenceDiagram
    actor User
    participant CLI as CLI Orchestrator
    participant FileCache
    participant ParsedCache as ParsedFileCache
    participant Validator as Citation Validator
    participant Parser as MarkdownParser
    participant FS as File System

    User->>+CLI: validate <file> --scope <dir>

    note right of CLI: Instantiates all components and injects dependencies.
    
    alt FLAG "--scope <dir>"
        CLI->>+FileCache: buildCache(scopeDir)
        FileCache->>FS: Scan directories recursively
        FS-->>FileCache: Return file list
        FileCache-->>-CLI: File path cache is built
    end

    CLI->>+Validator: validateFile(filePath)

    loop FOR EACH: unique file needed for validation
        Validator->>+ParsedCache: resolveParsedFile(filePath)

        alt ON: Cache Miss
            ParsedCache->>+Parser: parseFile(filePath)

            note over Parser, FS: Parser reads file content from File System.
            Parser->>FS: readFileSync(filePath)
            FS-->>Parser: Return content

            note over Parser: Tokenizes content using marked library and extracts links, anchors, headings.

            Parser-->>-ParsedCache: Return Parser Output Contract (Promise)
        else On a Cache Hit
            note over ParsedCache: Returns cached Promise directly from memory.
        end

        ParsedCache-->>-Validator: Return Parser Output Contract (Promise)
    end

    note over Validator: Validator now has all parsed data and performs its validation logic in memory.

    Validator-->>-CLI: Return validation results
    CLI-->>-User: Display report
```

**Workflow Characteristics (Post-`us1.5`)**
- **Component Creation**: The `CLI Orchestrator` (via its factory) creates instances of all components at runtime.
- **Dependency Injection**: Dependencies are injected at instantiation (`fileSystem` into `Parser`, `ParsedFileCache` into `Validator`), decoupling components.
- **Dual Caching Strategy**: The workflow uses two distinct caches: `FileCache` for mapping short filenames to absolute paths, and `ParsedFileCache` to store in-memory parsed file objects.
- **Layered Data Retrieval**: The `CitationValidator` is decoupled from the `MarkdownParser`; it requests all parsed data from the `ParsedFileCache`, which delegates to the `Parser` on cache misses.
- **Asynchronous Data Flow**: Core validation operations are **asynchronous** (`Promise`-based). `ParsedFileCache.resolveParsedFile()` and `CitationValidator.validateFile()` both return Promises.
- **File System Access**: `FileCache` scans directories, `MarkdownParser` reads file content synchronously (`readFileSync`), and `CLI Orchestrator` writes file modifications for the `--fix` operation.
- **Fix Logic Location**: The `fix` logic remains within the `CLI Orchestrator`, operating on the final validation results.

### Auto-Fix Workflow

The `--fix` flag enables automatic correction of broken citations. This workflow executes after async validation completes, applying corrections based on validation suggestions.

```mermaid
sequenceDiagram
    actor User
    participant CLI as CLI Orchestrator
    participant Validator as Citation Validator
    participant ParsedCache as ParsedFileCache
    participant FS as File System

    User->>+CLI: validate <file> --fix

    note over CLI: Creates components via factory (ParsedCache, Validator, etc.)

    CLI->>+Validator: validateFile(filePath)

    note over Validator, ParsedCache: Async validation workflow (see diagram above)
    Validator->>ParsedCache: resolveParsedFile() for source and targets
    ParsedCache-->>Validator: Return Parser Output Contracts

    Validator-->>-CLI: Return validation results with suggestions (Promise)

    note over CLI: Examines validation results for fixable issues

    alt HAS: Fixable citations
        CLI->>+FS: readFileSync(filePath)
        FS-->>-CLI: Return source file content

        loop FOR EACH: fixable citation
            alt TYPE: Path conversion warning
                CLI->>CLI: Apply pathConversion suggestion
                note over CLI: Convert relative path to recommended format
            else TYPE: Anchor correction error
                CLI->>CLI: Apply anchor suggestion
                note over CLI: Update anchor reference to valid format
            end
        end

        CLI->>+FS: writeFileSync(filePath, correctedContent)
        FS-->>-CLI: File written successfully

        CLI-->>User: Report fixes applied (counts + details)
    else NO: Fixable citations
        CLI-->>User: No auto-fixable citations found
    end

    CLI-->>-User: Return exit code (0 = success)
```

**Auto-Fix Characteristics**:
- **Trigger**: Runs when `--fix` flag provided with `validate` command
- **Timing**: Executes after async validation completes and returns results
- **Input**: Validation results object containing suggestions for fixable issues
- **Fixable Issues**:
  - Path conversions (relative → absolute, etc.) from warnings with `pathConversion` property
  - Anchor corrections (invalid → valid format) from errors with `suggestion` property
- **File Operations**: Synchronous read and write operations on source file only
- **Atomicity**: Reads entire file, applies all corrections, writes once
- **Safety**: Original file content replaced only after all corrections computed
- **Scope**: Modifies only the source file being validated, never target files

### Component Architecture Notes
- **Cross-Cutting Infrastructure**: All components use Node.js `fs` and `path` modules directly for file I/O operations. There is no centralized File System Manager abstraction - this follows a pragmatic approach prioritizing simplicity over layered architecture for this tool's scope.
- **Interaction Style**: Validation workflow is asynchronous (Promise-based) post-US1.5. `CitationValidator.validateFile()` returns Promise, `ParsedFileCache.resolveParsedFile()` returns Promise. MarkdownParser uses synchronous file reads internally but is wrapped in async cache layer.
- **Component Mapping**: Each component corresponds to exactly one source file containing one class (1:1 mapping), following simple modular design principles.

#### Path Normalization Strategy

**ParsedFileCache Approach**:
- Uses Node.js built-in normalization: `path.resolve(path.normalize(filePath))`
- Simple, predictable, no external dependencies
- Handles relative paths, `./` prefixes, redundant separators
- Does NOT handle symlinks (documented limitation)

**Design Rationale**:
- Maintains "Simplicity First" principle - no separate PathResolver component
- Cache needs basic key normalization, not complex multi-strategy resolution
- CitationValidator's 4-strategy resolution (symlinks, Obsidian paths, FileCache) remains separate concern
- Future: If path logic centralization becomes needed, extract PathResolver component

**Trade-offs Accepted**:
- Symlinks: Different symlink paths to same file create separate cache entries
- Mitigation: Users can pass absolute paths if symlink normalization needed
- Real-world impact: Minimal for documentation file use case

---

## Level 4: Code Organization

### Current File Structure

**Source Code Location** (post-US1.5):

```text
tools/citation-manager/
├── src/
│   ├── citation-manager.js          # CLI entry point (async workflow)
│   ├── CitationValidator.js         # Validation logic (async, cache-integrated)
│   ├── MarkdownParser.js            # Parser (Parser Output Contract)
│   ├── FileCache.js                 # Filename-to-path resolution cache
│   ├── ParsedFileCache.js           # Parsed file object cache (US1.5)
│   └── factories/
│       └── componentFactory.js      # Component instantiation with DI (US1.4b)
├── test/
│   ├── parser-output-contract.test.js    # Parser schema validation (US1.5)
│   ├── parsed-file-cache.test.js         # Cache unit tests (US1.5)
│   ├── integration/
│   │   ├── citation-validator-cache.test.js   # Cache integration (US1.5)
│   │   └── end-to-end-cache.test.js           # E2E cache workflow (US1.5)
│   ├── factory.test.js                   # Factory pattern tests (US1.5)
│   ├── validation.test.js                # Core validation tests
│   ├── enhanced-citations.test.js        # Citation feature tests
│   ├── auto-fix.test.js                  # Auto-fix functionality
│   ├── warning-validation.test.js        # Warning detection
│   ├── path-conversion.test.js           # Path resolution
│   ├── story-validation.test.js          # Story-specific validation
│   ├── cli-warning-output.test.js        # CLI display tests
│   └── fixtures/                         # 16+ test fixture files
│       ├── valid-citations.md
│       ├── broken-links.md
│       ├── multiple-links-same-target.md # Cache test fixtures (US1.5)
│       └── [additional fixtures]
└── design-docs/
    ├── features/
    │   └── 20251003-content-aggregation/
    │       ├── content-aggregation-architecture.md  # This file
    │       ├── content-aggregation-prd.md
    │       └── component-guides/
    │           ├── CitationValidator Implementation Guide.md
    │           ├── Markdown Parser Implementation Guide.md
    │           └── ParsedFileCache Implementation Guide.md  
    └── [additional documentation]
```

**Key Changes Post-US1.5**:
- **ParsedFileCache.js**: New component providing in-memory cache of parsed file objects
- **componentFactory.js**: Factory pattern for DI-based component instantiation
- **Async Architecture**: CitationValidator and CLI orchestrator use Promise-based async flow
- **Test Expansion**: 31 new tests added (cache unit, integration, factory, E2E, contract validation)
- **Implementation Guides**: ParsedFileCache guide added for cache contract documentation

### Module System

**Type**: ECMAScript Modules (ESM)
- Uses `import`/`export` syntax
- Explicit `.js` extensions in import paths
- Confirmed in [US1.3 Implementation Note](../../../../../design-docs/features/20250928-cc-workflows-workspace-scaffolding/user-stories/us1.3-make-migrated-citation-manager-executable/us1.3-make-migrated-citation-manager-executable.md)

**Import Pattern Example**:

```javascript
import { CitationValidator } from "./src/CitationValidator.js";
```

### Coding Standards

Follows workspace coding standards defined in [Architecture: Coding Standards](../../../../../design-docs/features/20250928-cc-workflows-workspace-scaffolding/cc-workflows-workspace-architecture.md#Coding%20Standards%20and%20Conventions):
- Files: `kebab-case.js`
- Functions/Variables: `camelCase`
- Classes: `TitleCase`
- Test Descriptions: Natural language with spaces in `it()` methods

---

## Testing Strategy

### Framework

**Test Framework**: Vitest (shared workspace framework)
- Configuration: Root `vitest.config.js`
- Execution: `npm test` from workspace root
- Discovery Pattern: `tools/**/test/**/*.test.js`

### Test Organization

**Test Location** (post-US1.5):

```text
tools/citation-manager/test/
├── parser-output-contract.test.js    # Parser schema validation (US1.5)
├── parsed-file-cache.test.js         # Cache unit tests (US1.5)
├── factory.test.js                   # Factory pattern tests (US1.5)
├── integration/
│   ├── citation-validator-cache.test.js   # Cache integration (US1.5)
│   ├── citation-validator.test.js         # Validator integration
│   └── end-to-end-cache.test.js           # E2E cache workflow (US1.5)
├── validation.test.js                # Core validation tests
├── enhanced-citations.test.js        # Enhanced citation tests
├── auto-fix.test.js                  # Auto-fix feature tests
├── warning-validation.test.js        # Warning system tests
├── path-conversion.test.js           # Path resolution tests
├── story-validation.test.js          # Story-specific validation
├── cli-warning-output.test.js        # CLI output tests
└── fixtures/                         # Test fixture files
    ├── valid-citations.md
    ├── broken-links.md
    ├── multiple-links-same-target.md # Cache fixtures (US1.5)
    ├── shared-target.md              # Cache fixtures (US1.5)
    └── [additional fixtures]
```

**Test Suite Statistics** (post-US1.5):
- **Total tests**: 73
- **Passing**: 71 (97.3%)
- **Pre-existing failures**: 2 (documented in [Test Suite Edge Cases](#Test%20Suite%20Edge%20Cases%20(CLI%20Display%20and%20URL%20Encoding)))
- **US1.5 additions**: 31 new tests (contract validation, cache unit, integration, factory, E2E)

### Test Categories

**Contract Validation Tests** (8 tests - US1.5):
- Validate Parser Output Contract schema compliance
- Test LinkObject structure (`linkType`, `scope`, `anchorType`, `source`, `target`)
- Test AnchorObject structure (`anchorType`, `id`, `rawText`)
- Verify enum constraints and required fields
- Reference: [Markdown Parser Implementation Guide](../../component-guides/Markdown%20Parser%20Implementation%20Guide.md)

**Cache Unit Tests** (6 tests - US1.5):
- Cache hit/miss behavior
- Concurrent request handling with single parse guarantee
- Error propagation and cache cleanup on parse failure
- Path normalization for consistent cache keys
- Multiple independent file caching

**Cache Integration Tests** (4 tests - US1.5):
- Single-parse-per-file guarantee when multiple links reference same target
- CitationValidator cache usage for source and target files
- Multi-file validation scenarios with cache efficiency

**Factory Pattern Tests** (7 tests - US1.5):
- Component instantiation with correct DI wiring
- ParsedFileCache creation and injection into CitationValidator
- Factory method parameter validation

**End-to-End Tests** (6 tests - US1.5):
- Complete validation workflow with ParsedFileCache integration
- CLI integration with async validator and cache
- Real-world multi-file validation scenarios

### Testing Principles

Follows workspace testing strategy from [Architecture: Testing Strategy](../../../../../design-docs/features/20250928-cc-workflows-workspace-scaffolding/cc-workflows-workspace-architecture.md#Testing%20Strategy):
- **MVP-Focused**: Target 0.3:1 to 0.5:1 test-to-code ratio (achieved: 0.4:1)
- **Integration-Driven**: Real file system operations, no mocking
- **BDD Structure**: Given-When-Then comment structure required
- **Real Systems**: Zero-tolerance policy for mocking application components

### Async Testing Patterns (Post-US1.5)

**Promise-Based Validation**:

```javascript
it('should validate file asynchronously using cache', async () => {
  // Given: Factory-created validator with ParsedFileCache
  const validator = createCitationValidator(scopeDir);

  // When: Async validation executes
  const result = await validator.validateFile(testFile);

  // Then: Results returned via Promise
  expect(result.isValid).toBe(true);
  expect(result.citations).toBeDefined();
});
```

**Cache Integration Testing**:

```javascript
it('should parse file only once when multiple links reference it', async () => {
  // Given: Validator with cache, file with multiple links to same target
  const validator = createCitationValidator();

  // When: Validation processes multiple links to same file
  await validator.validateFile(fixtureWithMultipleLinksToSameTarget);

  // Then: Target file parsed exactly once (verified via cache hit logging)
  expect(parseSpy).toHaveBeenCalledTimes(1);
});
```

**Key Patterns**:
- Test async `resolveParsedFile()` method returns Promises
- Verify Promise caching (cache stores Promises, not resolved values)
- Test concurrent async requests to same file resolve to single parse
- Use `async/await` syntax throughout async test code

### Process Management

Citation-manager test suite uses CLI integration testing via `execSync()`, which can leave Vitest worker processes in memory after test completion. See [Workspace Testing Infrastructure - Vitest Process Management](../../../../../design-docs/features/20250928-cc-workflows-workspace-scaffolding/cc-workflows-workspace-architecture.md#Vitest%20Process%20Management%20and%20Cleanup) for configuration best practices and cleanup procedures.

**Quick Cleanup**:

```bash
# Kill hanging Vitest worker processes
pkill -f "vitest"
```

---
## Technology Stack

| Technology | Version | Purpose | Source |
|------------|---------|---------|--------|
| **Node.js** | ≥18.0.0 | Runtime environment | [Workspace Tech Stack](../../../../../design-docs/features/20250928-cc-workflows-workspace-scaffolding/cc-workflows-workspace-architecture.md#Technology%20Stack) |
| **Commander.js** | ^14.0.1 | CLI command parsing and argument handling | Tool-specific dependency |
| **marked** | ^15.0.12 | Markdown tokenization and AST generation | Tool-specific dependency |
| **Vitest** | latest | Testing framework (shared) | [Workspace Tech Stack](../../../../../design-docs/features/20250928-cc-workflows-workspace-scaffolding/cc-workflows-workspace-architecture.md#Technology%20Stack) |
| **Biome** | latest | Linting/formatting (shared) | [Workspace Tech Stack](../../../../../design-docs/features/20250928-cc-workflows-workspace-scaffolding/cc-workflows-workspace-architecture.md#Technology%20Stack) |
| **Node.js built-in modules** | native | File I/O (fs), path operations (path), URL utilities (url) | Node.js standard library |

---

## Cross-Cutting Concerns

As a tool within the CC Workflows Workspace, the Citation Manager inherits all of its cross-cutting architectural patterns from the [parent system](../../../../../design-docs/features/20250928-cc-workflows-workspace-scaffolding/cc-workflows-workspace-architecture.md#Cross-Cutting%20Concerns).

### Code Quality and Consistency
All source code within the `citation-manager` package must adhere to the shared `biome.json` configuration located at the workspace root. This includes standards for **tab indentation** and **double quotes** for strings.

### Testing Infrastructure
The tool's test suite, located in `tools/citation-manager/test/`, is executed by the shared **Vitest framework**. Tests are discovered via the `tools/**/test/**/*.test.js` glob pattern and must follow the workspace's established testing principles, including the **"Real Systems, Fake Fixtures"** approach, BDD-style comments, and `snake_case` test naming.

### Dependency Management
The tool's dependencies, such as `commander` and `marked`, are declared in its local `package.json` but are managed and hoisted by **NPM Workspaces** at the root level.

---

## Design Principles Adherence

This tool follows workspace design principles defined in [Architecture Principles](../../../../../design-docs/Architecture%20Principles.md):

**Key Principles**:
- [**Modular Design**](../../../../../design-docs/Architecture%20Principles.md#Modular%20Design%20Principles): Component-based architecture with clear boundaries
- [**Deterministic Offloading**](../../../../../design-docs/Architecture%20Principles.md#Deterministic%20Offloading%20Principles): Predictable, mechanical citation processing
- [**Safety-First**](../../../../../design-docs/Architecture%20Principles.md#Safety-First%20Design%20Patterns): Backup creation before auto-fix, dry-run capability
- [**Self-Contained Naming**](../../../../../design-docs/Architecture%20Principles.md#Self-Contained%20Naming%20Principles): Descriptive command and component names

---

## Known Risks and Technical Debt

### Redundant File Parsing During Validation

**Risk Category**: Performance / Architecture

**Description**: The [CitationValidator](#Citation%20Manager%2ECitation%20Validator) previously operated without a caching mechanism for parsed files. During a single validation run, if a source document linked to the same target file multiple times, the system would read and parse that file from disk repeatedly, leading to significant I/O and CPU overhead.

**Impact**:
- **High**: This inefficiency would have been a severe performance bottleneck for Epic 2 Content Aggregation, as the ContentExtractor component would compound redundant operations.
- **Medium**: It was a latent performance issue in validation and `--fix` logic.

**Resolution**: Implemented via [Story 1.5: Implement a Cache for Parsed File Objects](user-stories/us1.5-implement-cache-for-parsed-files/us1.5-implement-cache-for-parsed-files.md)

**Resolution Date**: 2025-10-07

**Implementation Summary**:
- Created `ParsedFileCache` component providing in-memory cache of Parser Output Contract objects
- Refactored `CitationValidator` to use `ParsedFileCache` instead of direct `MarkdownParser` calls
- Integrated cache into factory pattern for production deployment
- Ensured files are parsed at most once per command execution
- Zero functional regressions confirmed via full test suite validation

**Verification**:
- All existing tests pass (50+ test suite)
- New ParsedFileCache unit tests validate cache hit/miss behavior
- CitationValidator integration tests confirm single-parse-per-file guarantee
- Factory tests validate correct dependency wiring
- End-to-end tests verify complete workflow with cache integration

**Status**: ✅ RESOLVED (2025-10-07)

### Scattered File I/O Operations

**Risk Category**: Architecture / Maintainability
**Description**: Currently, multiple components perform direct file system operations. The `MarkdownParser` reads files, the `CitationValidator` checks for file existence, and the `CLI Orchestrator` reads and writes files for the `--fix` command. This scatters a core cross-cutting concern throughout the application, violating the Single Responsibility Principle.

**Impact**:
- **High**: This makes the components harder to test in isolation, as the Node.js `fs` module must be mocked or managed in multiple places. It also increases the risk of inconsistent error handling for I/O operations and makes the overall system more brittle.
- **Scope**: Affects `MarkdownParser`, `CitationValidator`, and `CLI Orchestrator`.
  
**Rationale for Accepting Risk**: This pattern is a remnant of the tool's original, simpler design. Formally separating file I/O is a refactoring effort that was not prioritized over the foundational DI and caching work, which are direct blockers for new feature development.

**Mitigation Strategy**: Create a dedicated **`FileSystemManager`** component. This component would centralize all file system interactions (`readFile`, `writeFile`, `exists`, etc.). It would be instantiated by the factory and injected as a dependency into all components that need to interact with the disk.

**Resolution Criteria**:
- A new `FileSystemManager` component is created and integrated via the component factory.
- All direct `fs` module usage is removed from `MarkdownParser`, `CitationValidator`, and `CLI Orchestrator`.
- These components are refactored to use the injected `FileSystemManager` for all file I/O operations.
  
**Timeline**: Address after Epic 2 is complete. This is a valuable refactoring for long-term maintainability but does not block the current feature roadmap.
**Status**: Documented technical debt, medium priority.

### ParsedFileCache Memory Characteristics

**Risk Category**: Performance / Resource Management
**Description**: The `ParsedFileCache` stores complete `Parser Output Contract` objects in memory, including the full file content string. For large architectural documents or multi-file validation runs, this creates measurable memory overhead.

**Memory Profile**:
- **Typical Document**: 50KB per cached file
- **Large Document**: 500KB per cached file
- **Validation Run Example**: 100 files = 5-50MB in memory
- **Additional Overhead**: Token arrays, link objects, anchor objects per file

**Impact**:
- **Low**: Acceptable for CLI tool with ephemeral per-command lifecycle
- **Scope**: Memory released automatically when command process exits
- **Scale Limits**: No production concerns identified for documentation file use cases

**Rationale for Accepting Risk**: The ParsedFileCache follows an ephemeral, per-command caching strategy where the cache exists only during a single CLI command execution. Since the Node.js process exits after command completion, the operating system automatically reclaims all memory. This simple approach eliminates the need for complex memory management (LRU eviction, cache size limits, TTL) while meeting MVP requirements.

**Monitoring Strategy**: If Epic 2 content aggregation shows memory pressure exceeding 100MB during normal operations, consider optimization strategies:
- Lazy content loading (cache metadata without full content)
- LRU eviction policy for large validation runs
- Content streaming for extraction operations

**Resolution Criteria**: No action required unless real-world usage demonstrates memory issues. Current design sufficient for documented use cases.

**Timeline**: Monitor during Epic 2 implementation; optimize only if empirical evidence demonstrates need.
**Status**: Documented architectural characteristic, acceptable trade-off for MVP scope.

### Test Suite Edge Cases (CLI Display and URL Encoding)

**Risk Category**: Quality / Testing

**Description**: 7 tests in the citation manager test suite fail with pre-existing edge case issues unrelated to core functionality. These failures represent technical debt in CLI display formatting and URL-encoded anchor handling that accumulated before US1.5 implementation.

**Failing Tests**:
1. **CLI Warning Output Formatting** (3 tests) - Display logic issues in warning section formatting
2. **URL-Encoded Anchor Handling** (3 tests) - Edge case in anchor matching when anchors contain URL-encoded characters (e.g., spaces as `%20`)
3. **Wiki-Style Link Classification** (1 test) - Edge case in pattern detection for wiki-style links

**Impact**:
- **Low**: Core functionality works correctly. Issues affect edge cases in display formatting and specific anchor encoding patterns.
- **Scope**: Affects CLI display logic and anchor matching edge cases
- **Test Suite Status**: 44/51 tests passing (86%)

**Rationale for Accepting Risk**: These edge case failures were identified during US1.5 validation but are unrelated to cache implementation. All schema validation tests (8/8) pass, confirming Phase 1 parser contract objectives met. Core parsing and validation functionality works correctly.

**Mitigation Strategy**: Create dedicated user story to address edge cases in CLI warning display formatting and URL-encoded anchor handling.

**Resolution Criteria**:
- All 7 failing tests updated or refactored to pass
- CLI warning output formatting matches expected format
- URL-encoded anchors (e.g., spaces as `%20`) handled correctly in anchor matching
- Wiki-style link classification edge cases resolved

**Timeline**: Low priority - address after Epic 2 Content Aggregation implementation complete.
**Estimated Effort**: 2-3 tasks, ~4-6 hours total
**Status**: Documented technical debt, low priority.

## Architecture Decision Records (ADRs)

### ADR-001: Phased Test Migration Strategy

- **Status**: Accepted
- **Date**: 2025-10-04
- **Context**: Analysis of US1.4 scope revealed that test migration involves two distinct, separable work streams with different risk profiles:
 1. **Test Framework Conversion**: Migrating 1,863 lines across 7 test files from `node:test` to Vitest with `expect()` assertions
 2. **Component DI Refactoring**: Restructuring CitationValidator, MarkdownParser, and FileCache for constructor-based dependency injection with factory pattern implementation

 Combining both efforts creates compound risk: test conversion failures could mask DI refactoring issues, and vice versa. Additionally, Epic 2 architecture design will establish DI patterns for new components (ContentExtractor), making it more effective to refactor existing components after new patterns are proven.

- **Decision**: Split US1.4 into two sequential stories:
  - **US1.4a - Test Migration**: Convert test suite to Vitest, update assertions to expect(), fix paths to workspace structure. Accept non-DI component instantiation as temporary technical debt.
  - **US1.4b - DI Refactoring**: Implement constructor-based DI, create factory pattern, update tests for DI usage, add integration tests. Resolves documented technical debt.

- **Alternatives Considered**:
  - **Comprehensive US1.4**: Do both simultaneously - rejected due to compound risk and delayed Epic 2 delivery
  - **Minimal US1.4 with indefinite debt**: Accept non-DI architecture permanently - rejected as violates workspace architecture principles

- **Consequences**:
  - **Positive**: Risk isolation - test conversion validated independently before component refactoring begins
  - **Positive**: Faster Epic 2 start - US1.4a unblocks architecture design for new components
  - **Positive**: Better DI patterns - Epic 2 design informs US1.4b refactoring approach
  - **Positive**: Incremental validation - clear gates between test migration and DI implementation
  - **Negative**: Temporary architectural non-compliance during US1.4a execution (mitigated by time-boxed technical debt)
  - **Negative**: Two-phase migration overhead (mitigated by reduced compound risk)

- **Implementation Timeline**:
  - US1.4a: Immediate (Epic 1 completion)
  - US1.4b: After Epic 2 architecture design, before US2.1 implementation

---

## CLI Commands

**Available Commands** (validated in US1.3):
- `validate` - Validate citation links in markdown files
- `ast` - Generate abstract syntax tree of citations
- `extract` - Extract base paths from citations
- `baseline` - [TBD - functionality to be documented]
- `--fix` - Auto-fix broken citations and anchors
- `--help` - Display help menu

**Execution Pattern**:

```bash
npm run citation:validate <file-path> [options]
npm run citation:ast <file-path> [options]
npm run citation:base-paths <file-path> -- --format json
```

---

## Future Enhancements (Epic 2)

**Content Aggregation Feature** (planned):
- Extract full content from linked sections
- Aggregate content into single output file
- Support both section-specific and full-file extraction
- Provide metadata-rich output for AI context management

**Reference**: [Epic 2: citation-manager Content Aggregation Enhancement](content-aggregation-prd.md#Feature%20Epics)

---

## Document Status

**Last Updated**: 2025-10-05
**Version**: 0.2 (Draft)
**Next Steps**:
- ✓ Complete US1.4a test migration to Vitest (DONE)
- ✓ Implement US1.4b DI refactoring with factory pattern (DONE)
- Design Epic 2 architecture with DI patterns for ContentExtractor
- Document component interfaces and data contracts
- Create component interaction diagrams

---

## Related Documentation

- [Architecture Principles](../../../../../design-docs/Architecture%20Principles.md) - Design principles and patterns
- [citation-guidelines](../../../../../agentic-workflows/rules/citation-guidelines.md) - Citation linking guidelines

## Whiteboard
