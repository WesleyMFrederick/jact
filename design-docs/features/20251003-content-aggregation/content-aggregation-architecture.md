<!-- markdownlint-disable MD024 -->
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

### Citation Manager Components

```mermaid
graph TB
    AiAssistant["<div style='font-weight: bold'>AI Coding Assistant</div><div style='font-size: 85%; margin-top: 0px'>[Person]</div><div style='font-size: 85%; margin-top:10px'>Executes commands to<br/>validate and fix citations.</div>"]
    
    subgraph systemBoundary ["Citation Manager [Container]"]
        direction TB
    
    CLI("
      <div style='font-weight: bold'>CLI Orchestrator</div><div style='font-size: 85%; margin-top: 0px'>[Component: Node.js, Commander.js]</div><div style='font-size: 85%; margin-top:10px'>Parses commands and coordinates the<br/>end-to-end workflow.</div>
    ")
        
        

        subgraph coreServices ["Core Services"]
            direction TB

            Parser("
                <div style='font-weight: bold'>Markdown Parser</div><div style='font-size: 85%; margin-top: 0px'>[Component: Node.js, marked.js]</div><div style='font-size: 85%; margin-top:10px'>Recognizes and extracts syntactic<br/>elements (links, anchors).</div>
            ")

            Validator("
                <div style='font-weight: bold'>Citation Validator</div><div style='font-size: 85%; margin-top: 0px'>[Component: Node.js]</div><div style='font-size: 85%; margin-top:10px'>Orchestrates semantic validation<br/>of link paths and anchors.</div>
            ")
            
            ContentExtractor("
                <div style='font-weight: bold'>Content Extractor </div><div style='font-size: 85%; margin-top: 0px'>[Component: Node.js]</div><div style='font-size: 85%; margin-top:10px'>Extracts content based on<br/>eligibility rules.</div>
            ")
        end
        
        MarkdownFlavors("
      <div style='font-weight: bold'>Markdown Flavors (Future)</div><div style='font-size: 85%; margin-top: 0px'>[Component: Node.js]</div><div style='font-size: 85%; margin-top:10px'>Provides flavor-specific algorithms for<br/>parsing, validation, and extraction.</div>
    ")
    
    FileCaches("
      <div style='font-weight: bold'>File Caches</div><div style='font-size: 85%; margin-top: 0px'>[Component: Node.js]</div><div style='font-size: 85%; margin-top:10px'>Manages in-memory caches for file<br/>paths and parsed file objects.</div>
    ")
        
  end

    FileSystem["<div style='font-weight: bold'>File System</div><div style='font-size: 85%; margin-top: 0px'>[Software System]</div><div style='font-size: 85%; margin-top:10px'>Stores markdown documentation.</div>"]

    AiAssistant -. "Executes commands USING<br/><span style='font-size:85%'>[CLI]</span>" .-> CLI
  
  CLI -. "Writes fixes VIA<br/><span style='font-size:85%'>[Node.js fs API]</span>" .-> FileSystem
    CLI -->|"Invokes"| coreServices
    
  coreServices -- "USES rules from<br/><span style='font-size:85%'>[Sync]</span>" --> MarkdownFlavors
  coreServices -- "USES <br/><span style='font-size:85%'>[Async]</span>" --> FileCaches
    
    FileCaches -. "Reads/Scans files VIA<br/><span style='font-size:85%'>[Node.js fs API]</span>" .-> FileSystem

    style systemBoundary fill:#fafafa, stroke:#555555, stroke-width:2px
    style coreServices fill:transparent, stroke:#aaa
  
    style AiAssistant fill:#08427b,stroke:#052e56,color:#ffffff, stroke-width:2px
    style FileSystem fill:#999999,stroke:#6b6b6b,color:#ffffff, stroke-width:2px

    classDef component fill:#438dd5,stroke:#2e6295,color:#ffffff, stroke-width:2px
    classDef futureComponent fill:#85bbf0,stroke:#444444,color:#444444, stroke-width:2px, stroke-dasharray: 5 5
    
    class CLI,Parser,Validator,FileCaches,ContentExtractor component
    class MarkdownFlavors futureComponent
    
    linkStyle default color:#555555
```

#### Citation Manager.CLI Orchestrator

- **Path(s):** `tools/citation-manager/src/citation-manager.js`
- **Technology:** `Node.js` class, `Commander.js` CLI framework, ESM modules
- **Technology Status:** Production
- **Description:** CLI entry point orchestrating all citation management operations. Parses commands (validate, ast, base-paths, fix), coordinates workflow execution, formats output for CLI/JSON display, and implements auto-fix logic for broken citations and paths.

##### Interactions
- _creates and coordinates_ `Markdown Parser`, `File Cache`, `ParsedFileCache`, ==`ParsedDocument`,== `Citation Validator`, ==and `ContentExtractor`== components (synchronous).
- _injects_ dependencies such as the `FileCache` and `ParsedFileCache` into components like the `CitationValidator` at instantiation (synchronous).
- ==_delegates factory creation_ of `ParsedDocument` instances to `ParsedFileCache` via constructor injection (synchronous).==
- _delegates to_ the `MarkdownParser` for the `ast` command (asynchronous).
- ==_ast command_ continues to access raw `MarkdownParser.Output.DataContract` directly for debugging purposes, bypassing `ParsedDocument` facade.==
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
- **Description:** Parses markdown files to extract AST representation of document structure. Identifies cross-document links (multiple pattern types), extracts headings and anchors (including Obsidian block refs and caret syntax), generates single anchor per header with dual ID properties (raw text and URL-encoded) for Obsidian compatibility (US1.6). ==Output (`MarkdownParser.Output.DataContract`) is consumed directly by CLI commands for debugging/inspection, or wrapped in `ParsedDocument` facade via `ParsedFileCache` for validation workflows.==
- **Implementation Guide**: [Markdown Parser Implementation Guide](../../component-guides/Markdown%20Parser%20Implementation%20Guide.md) for the detailed data contract schema and examples

##### Interactions
- _reads_ markdown files directly from file system (synchronous)
- _tokenizes_ markdown content using `marked` library (synchronous)
- _provides_ structured AST data to `CLI Orchestrator` and `Citation Validator` (synchronous)

##### Boundaries
The component is exclusively responsible for transforming a raw markdown string into the structured **MarkdownParser.Output.DataContract**. Its responsibilities are strictly limited to syntactic analysis. ==The component is **not** aware of the `ParsedDocument` facade that wraps its output.== The component is **not** responsible for:
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
- **Description:** Validates `Link Objects` by consuming `ParsedDocument` facade instances from the `ParsedFileCache`. It classifies citation patterns (caret syntax, cross-document, wiki-style), resolves file paths using multiple strategies (relative paths, symlinks, Obsidian absolute paths, cache lookup), uses `ParsedDocument` query methods to check for target and anchor existence, generates validation results with actionable suggestions.
- **Implementation Guide**: [CitationValidator Implementation Guide](../../component-guides/CitationValidator%20Implementation%20Guide.md) for public contracts and data objects

##### Interactions
- _uses_ the `ParsedFileCache` to retrieve ==`ParsedDocument` instances== for target files (asynchronous).
- ==_uses_ `ParsedDocument` query methods (`hasAnchor()`, `getAnchorIds()`, `findSimilarAnchors()`) instead of direct data structure access (synchronous).==
- _uses_ the `FileCache` for filename resolution when a scope is provided (synchronous, optional dependency).
- _validates_ file existence directly via the file system as a fallback (synchronous).
- _returns_ validation results with status and suggestions to the `CLI Orchestrator` (asynchronous).

##### Boundaries
- The component is exclusively responsible for the semantic validation of `Link Objects` (e.g., "does this link point to a real target?").
- ==It is **not** responsible for parsing markdown (delegated to `MarkdownParser` via the cache) or navigating parser output structures (delegated to `ParsedDocument` facade).==
- It is **not** responsible for managing the efficiency of parsing operations (delegated to `ParsedFileCache`).
- It does **not** perform file modifications; it only generates suggestions.

#### Citation Manager.ParsedFileCache
- **Path(s):** `tools/citation-manager/src/ParsedFileCache.js`
- **Technology:**
  - `Node.js` class
  - ESM modules
- **Technology Status:** Implemented
- **Description:** Maintains an in-memory cache of ==`ParsedDocument` facade instances== for the duration of a single command run. ==Wraps `MarkdownParser.Output.DataContract` objects in the `ParsedDocument` facade before returning them==, ensuring each file is read from disk and parsed by the `MarkdownParser` at most once.
- **Implementation Guide**: [ParsedFileCache Implementation Guide](../../component-guides/ParsedFileCache%20Implementation%20Guide.md) for public contracts and data objects

##### Interactions
- _is consumed by_ the `CitationValidator` and ==`ContentExtractor`== to retrieve ==`ParsedDocument` instances== (asynchronous).
- _delegates to_ the `MarkdownParser` to parse files that are not yet in the cache (asynchronous).
- ==_creates_ `ParsedDocument` facade instances by wrapping `MarkdownParser.Output.DataContract` before returning (synchronous).==
- _is instantiated by_ the `CLI Orchestrator` (via its factory) (synchronous).

##### Boundaries
- The component's sole responsibility is to manage the in-memory lifecycle of ==`ParsedDocument` facade instances==. It acts as a key-value store mapping file paths to ==`ParsedDocument` instances==.
- It is **not** responsible for the parsing logic itself (which is delegated) or for any direct file system operations.

##### Error Handling & Cache Correctness
- **Promise Rejection Pattern**: When a parse operation fails (e.g., file not found, permission error), the cache MUST synchronously remove the failed promise before propagating the rejection. This ensures subsequent requests can retry without being blocked by stale failed promises.
- **Retry Support**: Removing failed promises from cache enables retry on transient errors (temporary permission issues, network drive timeouts).
- **Implementation Critical**: The `.catch()` handler must execute `cache.delete(key)` synchronously to prevent race conditions between error handling and new requests.

---
#### Citation Manager.Parsed Document

- **Path(s):** `tools/citation-manager/src/ParsedDocument.js` (Implemented - [Story 1.7](user-stories/us1.7-implement-parsed-document-facade/us1.7-implement-parsed-document-facade.md))
- **Technology:**
  - `Node.js` class
  - ESM modules
- **Technology Status:** Implemented (US1.7)
- **Description:** Facade providing a stable, method-based query interface over `MarkdownParser.Output.DataContract`. Encapsulates internal data structure access and navigation complexity, decoupling consumers from parser internals. Implements anchor query methods (`hasAnchor()`, `findSimilarAnchors()`), link query methods (`getLinks()`), and content extraction methods (`extractFullContent()`). Methods `extractSection()` and `extractBlock()` stubbed for Epic 2. Note: `getBlockAnchors()` and `getHeaderAnchors()` cache fields exist but methods not implemented (Epic 2 placeholders).
- **Implementation Guide**: [ParsedDocument Implementation Guide](../../component-guides/ParsedDocument%20Implementation%20Guide.md)

##### Interactions
- _is created by_ the `ParsedFileCache` when wrapping `MarkdownParser.Output.DataContract` (synchronous).
- _wraps_ the `MarkdownParser.Output.DataContract` to provide stable interface (synchronous).
- _is consumed by_ the `CitationValidator` for anchor and link queries (synchronous).
- _is consumed by_ the future `ContentExtractor` for content extraction operations (synchronous).

##### Boundaries
- The component is exclusively responsible for providing a stable query interface over parser output. It encapsulates all direct access to `MarkdownParser.Output.DataContract` internal structures.
- It is **not** responsible for parsing markdown (delegated to `MarkdownParser`) or caching parsed results (delegated to `ParsedFileCache`).
- It is **not** responsible for validation logic (delegated to `CitationValidator`) or content aggregation logic (delegated to `ContentExtractor`).
- **Known Limitation**: CitationValidator helper methods still access `_data.anchors` directly for type filtering and rawText operations (lines 528, 560, 570-578). Full encapsulation deferred to Epic 2.

##### Input Public Contract
1. A **`MarkdownParser.Output.DataContract`** object, provided to the constructor.

##### Output Public Contract
The facade exposes query methods that return transformed/filtered data from the wrapped contract:
- **Anchor Queries**: `hasAnchor(anchorId)`, `findSimilarAnchors(anchorId)`
- **Link Queries**: `getLinks()`
- **Content Extraction**: `extractFullContent()`; `extractSection(headingText)`, `extractBlock(anchorId)` - Stubbed for Epic 2
- **Note**: `getBlockAnchors()`, `getHeaderAnchors()` not implemented - Epic 2 placeholders only

---
#### ==Citation Manager.Markdown Flavors==
- ==**Path(s):** `tools/citation-manager/src/flavors/MarkdownFlavorService.js` (_PROPOSED - [Story 1.8: Refactor Anchor Validation to Use Strategy Pattern](content-aggregation-prd.md#Story%201.8%20Refactor%20Anchor%20Validation%20to%20Use%20Strategy%20Pattern)_==
- ==**Technology:**== ==`Node.js` class==, ==ESM modules==
- ==**Technology Status:** To Be Implemented==
- ==**Description:** Acts as a centralized service that **constructs and provides** flavor-specific rule sets for parsing, validation, and extraction. It translates a flavor name (e.g., "obsidian") into a concrete set of configurations and algorithms that other components use to perform their tasks.==

##### ==Interactions==
- ==The `componentFactory` _instantiates_ this service with a flavor name (e.g., "obsidian").==
- ==The `Markdown Parser` _retrieves_ a set of link recognition patterns (e.g., regex for `[[wikilinks]]` and `[markdown links]`) from this service.==
- ==The `Citation Validator` _retrieves_ a specific anchor validation algorithm (a strategy object) from this service.==
- ==The `Content Extractor` _retrieves_ a set of extraction eligibility rules from this service.==

##### ==Boundaries==
- ==The component's sole responsibility is to **construct and provide** configuration objects and strategy instances based on a selected markdown flavor.==
- ==It is **not** responsible for performing any parsing, validation, or extraction itself; it only provides the rules.==
- ==It is **not** responsible for orchestrating the workflow.==

##### ==Input Public Contract==
1. ==A **flavor identifier** (e.g., "obsidian", "github"), provided to its constructor to set the context for which rule set to prepare.==

##### ==Output Public Contract==

==The component's public contract consists of methods that return the **configurations and strategy objects** themselves.==

==**Example Methods and Return Values:**==

- ==`getLinkExtractionPatterns()`: Returns an **array of configuration objects**, where each object contains a regex pattern and a handler function for a specific link syntax (e.g., markdown vs. wiki).==

- ==`getAnchorValidationStrategy()`: Returns an **instance of a strategy class** (e.g., an `ObsidianAnchorStrategy` object) that contains the `validate()` method for a specific flavor.==

---
#### ==Citation Manager.Content Extractor==
- ==**Path(s):** `tools/citation-manager/src/core/ContentExtractor/ContentExtractor.js` (_PROPOSED - [Epic 2: Content Extraction Component](content-aggregation-prd.md#Epic%202%20Content%20Extraction%20Component))_==
- ==**Supporting Modules:**==
  - ==`tools/citation-manager/src/core/ContentExtractor/analyzeEligibility.js` - Eligibility analysis orchestrator using strategy pattern==
  - ==`tools/citation-manager/src/core/ContentExtractor/eligibilityStrategies/*.js` - Strategy pattern implementations for extraction rules==
- ==**Technology:**==
  - ==`Node.js` class==
  - ==ESM modules==
- ==**Technology Status:** To Be Implemented==
- ==**Description:** Extracts full content from linked documents or specific sections within them. Main component class (`ContentExtractor`) orchestrates extraction eligibility analysis and content retrieval. Supporting `analyzeEligibility` module implements strategy pattern for evaluating extraction rules. It consumes `ParsedDocument` facade instances from the `ParsedFileCache` to perform content extraction using the facade's `extractSection()`, `extractBlock()`, and `extractFullContent()` methods.==
- **Implementation Guide**: [Content Extractor Implementation Guide](../../component-guides/Content%20Extractor%20Implementation%20Guide.md)

##### ==Interactions==
- ==_Triggered By_  `CLI Orchestrator` to perform content aggregation (asynchronous).==
- ==_Sends Data To_  `CLI Orchestrator` to display information in CLI (asynchronous).==
- ==_Calls_  `ParsedFileCache` to retrieve `ParsedDocument` instances for target documents (asynchronous).==
- ==_Uses_ `ParsedDocument` content extraction methods (`extractSection()`, `extractBlock()`, `extractFullContent()`) to retrieve content (synchronous).==
- ==_Persists Data To_ `FileSystem` content extraction methods (`extractSection()`, `extractBlock()`, `extractFullContent()`) to retrieve content (synchronous).==

##### ==Boundaries==
- ==The component's sole responsibility is to extract content strings based on `Link Objects` by orchestrating calls to `ParsedDocument` facade methods.==
- ==It is **not** responsible for parsing markdown (delegated to `MarkdownParser`) or navigating parser output structures (delegated to `ParsedDocument` facade).==
- ==It is **not** responsible for reading files from disk (delegated to `ParsedFileCache`).==

##### ==Input Public Contract==
1. ==A **`ParsedFileCache` interface**, provided at instantiation.==
2. ==A **`Link Object`**, provided to its public `extract()` method, which specifies the target file and anchor to extract.==

##### ==Output Public Contract==
==The `extract()` method returns a `Promise` that resolves with a **Content Block object**. This object contains the extracted `content` (string) and `metadata` about its source (e.g., the source file path and anchor).==

---
### Validate Citations - Component Interaction Diagram

```mermaid
sequenceDiagram
    actor User
    participant CLI as CLI Orchestrator
    participant FileCache
    participant ParsedCache as ParsedFileCache
    participant ParsedDoc as ParsedDocument
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

    note over Validator: Get source file's parsed document and extract links
    Validator->>+ParsedCache: resolveParsedFile(sourceFilePath)
    ParsedCache-->>-Validator: ParsedDocument instance
    Validator->>+ParsedDoc: getLinks()
    ParsedDoc-->>-Validator: Array of LinkObjects

    loop FOR EACH: cross-document link

        opt IF: FileCache available (--scope flag provided)
            note over Validator, FileCache: Path resolution Strategy 4: Smart filename matching
            Validator->>+FileCache: resolveFile(filename)
            FileCache-->>-Validator: { found, path, fuzzyMatch }
        end

        alt IF: Target file exists
            Validator->>+ParsedCache: resolveParsedFile(targetFilePath)

            alt ON: Cache Miss
                ParsedCache->>+Parser: parseFile(filePath)

                note over Parser, FS: Parser reads file content from File System.
                Parser->>FS: readFileSync(filePath)
                FS-->>Parser: Return content

                note over Parser: Tokenizes content using marked library and extracts links, anchors, headings.

                Parser-->>-ParsedCache: Return MarkdownParser.Output.DataContract (Promise)

                note over ParsedCache, ParsedDoc: Cache wraps raw contract in ParsedDocument facade
                ParsedCache->>+ParsedDoc: new ParsedDocument(contract)
                ParsedDoc-->>-ParsedCache: ParsedDocument instance
            else ON: Cache Hit
                note over ParsedCache: Returns cached ParsedDocument instance directly from memory.
            end

            ParsedCache-->>-Validator: Return ParsedDocument instance (Promise)

            note over Validator, ParsedDoc: Validator uses facade query methods for anchor validation
            Validator->>+ParsedDoc: hasAnchor(anchorId) / findSimilarAnchors()
            ParsedDoc-->>-Validator: Query results

        else IF: Target file NOT found
            opt IF: FileCache available (--scope flag provided)
                note over Validator, FileCache: Enhanced error messages with fuzzy matching
                Validator->>+FileCache: resolveFile(filename)
                FileCache-->>-Validator: { found, path, fuzzyMatch, message }
                note over Validator: Use fuzzy match for "Did you mean?" suggestions
            end
        end
    end

    note over Validator: Validator now has all validation results in memory.

    Validator-->>-CLI: Return validation results
    CLI-->>-User: Display report
```

#### Workflow Characteristics
- **Component Creation**: The `CLI Orchestrator` (via its factory) creates instances of all components at runtime.
- **Dependency Injection**: Dependencies are injected at instantiation (`fileSystem` into `Parser`, `ParsedFileCache` into `Validator`), decoupling components.
- **Dual Caching Strategy**: The workflow uses two distinct caches: `FileCache` for mapping short filenames to absolute paths, and `ParsedFileCache` to store in-memory `ParsedDocument` facade instances.
- **Facade Pattern**: `ParsedFileCache` wraps `MarkdownParser.Output.DataContract` in `ParsedDocument` facade before returning, providing stable query interface.
- **Layered Data Retrieval**: The `CitationValidator` is decoupled from the `MarkdownParser`; it requests `ParsedDocument` instances from the `ParsedFileCache`, which delegates to the `Parser` on cache misses.
- **Query-Based Access**: Consumers use `ParsedDocument` query methods (`hasAnchor()`, `getLinks()`) instead of direct data structure access, decoupling from parser internals.
- **Asynchronous Data Flow**: Core validation operations are **asynchronous** (`Promise`-based). `ParsedFileCache.resolveParsedFile()` and `CitationValidator.validateFile()` both return Promises.
- **File System Access**: `FileCache` scans directories, `MarkdownParser` reads file content synchronously (`readFileSync`), and `CLI Orchestrator` writes file modifications for the `--fix` operation.
- **Fix Logic Location**: The `fix` logic remains within the `CLI Orchestrator`, operating on the final validation results.

---
### Extract Citation Content: Component Interaction Diagram

```mermaid
sequenceDiagram
  actor User
    participant CLI as CLI Orchestrator
    participant Extractor as Content Extractor
    participant Validator as Citation Validator
    participant ParsedCache as ParsedFileCache

    User->>CLI: extract <file> --scope <dir>

    note over CLI: Instantiates ContentExtractor via factory

    CLI->>+Extractor: extractLinksContent(sourceFilePath, cliFlags)

    note over Extractor: 0. Internal Validation (prerequisite)
    Extractor->>+Validator: validateFile(sourceFilePath)
    Validator->>ParsedCache: resolveParsedFile(sourceFilePath)
    ParsedCache-->>Validator: Return ParsedDocument
    Validator-->>-Extractor: Return validation results

    note over Extractor: Get links from source document
    Extractor->>+ParsedCache: resolveParsedFile(sourceFilePath)
    ParsedCache-->>-Extractor: Return ParsedDocument (source)
    Extractor->>Extractor: parsedDoc.getLinks()
    
    note over Extractor: 1. Internal Eligibility Analysis (Strategy Pattern)
    Extractor->>Extractor: Analyze Links for Eligibility (using internal Analyzer class)

    note over Extractor: 2. Internal Content Retrieval Loop
    loop FOR EACH: eligible Link
        Extractor->>+ParsedCache: resolveParsedFile(targetPath)
        
        ParsedCache->>ParsedCache: get ParsedDocument using cache 
        ParsedCache-->>Extractor: Return ParsedDocument (Facade)

        Extractor->>Extractor: Extract content using ParsedDocument.extract*() methods
        
        note over Extractor: Aggregates content chunk internally, manages formatting/metadata.
    end

    Extractor-->>-CLI: Return Aggregated Content (String + Metadata)

    CLI->>User: Write Output File / Display Report (Final I/O)
```

#### Extract Citation Content: Workflow Characteristics
- **Single Service Interface**: The core operation is executed via a **single, high-level call** to the `Content Extractor` component: `extractLinksContent(sourceFilePath, cliFlags)`. This abstracts the entire multi-step process from the CLI.
- **Internal Validation**: The `Content Extractor` internally calls `CitationValidator` to validate the source file before extraction, ensuring citations are valid before content aggregation begins.
- **Encapsulated Logic**: The `Content Extractor` internally manages the complex control flow, performing the **Link Eligibility Analysis** (via its internal Strategy Pattern class) and the subsequent **Content Retrieval Loop**.
- **Data Retrieval**: The workflow depends on the `ParsedFileCache` to retrieve the `ParsedDocument` facade instances. This leverages the performance guarantee that each unique file is parsed only once.
- **Complexity Abstraction**: Content retrieval is handled by declarative calls to the `ParsedDocument` facade's methods (`extractSection()`, `extractBlock()`, `extractFullContent()`). The facade hides the underlying token-walking or line-lookup mechanics.
- **Aggregation Point**: The `Content Extractor` is responsible for **internal content aggregation** (managing formatting and metadata) before returning the final result to the CLI.
- **Final I/O**: The `CLI Orchestrator` performs the single, final I/O operation: writing the fully aggregated content string to the output file.
- **Asynchronous Flow**: The core content retrieval operations remain **asynchronous** (`Promise`-based) to accommodate the file I/O operations necessary during cache misses.

---
### Auto-Fix Workflow: Component Interaction Diagram

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
    ParsedCache-->>Validator: Return MarkdownParser.Output.DataContracts

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
│   ├── MarkdownParser.js            # Parser (MarkdownParser.Output.DataContract)
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

**Contract Validation Tests** (12 tests - US1.5 + US1.6):
- Validate MarkdownParser.Output.DataContract schema compliance
- Test LinkObject structure (`linkType`, `scope`, `anchorType`, `source`, `target`)
- Test AnchorObject structure (`anchorType`, `id`, `urlEncodedId`, `rawText`) - US1.6 dual ID schema
- Verify enum constraints and required fields
- Verify single anchor per header with no duplicates (US1.6)
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

%%
### Redundant File Parsing During Validation

**Risk Category**: Performance / Architecture

**Description**: The [CitationValidator](#Citation%20Manager%2ECitation%20Validator) previously operated without a caching mechanism for parsed files. During a single validation run, if a source document linked to the same target file multiple times, the system would read and parse that file from disk repeatedly, leading to significant I/O and CPU overhead.

**Impact**:
- **High**: This inefficiency would have been a severe performance bottleneck for Epic 2 Content Aggregation, as the ContentExtractor component would compound redundant operations.
- **Medium**: It was a latent performance issue in validation and `--fix` logic.

**Resolution**: Implemented via [Story 1.5: Implement a Cache for Parsed File Objects](user-stories/us1.5-implement-cache-for-parsed-files/us1.5-implement-cache-for-parsed-files.md)

**Resolution Date**: 2025-10-07

**Implementation Summary**:
- Created `ParsedFileCache` component providing in-memory cache of MarkdownParser.Output.DataContract objects
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

### Duplicate Anchor Entries in MarkdownParser.Output.DataContract

**Risk Category**: Data Model / Performance / Maintainability

**Description**: The `MarkdownParser.extractAnchors()` method currently generates duplicate AnchorObject entries for each header - one with the raw text as the `id` and another with the URL-encoded (Obsidian-compatible) format as the `id`. For example, a header "Story 1.5: Implement Cache" produces two anchor objects:
- `{ anchorType: "header", id: "Story 1.5: Implement Cache", rawText: "Story 1.5: Implement Cache", ... }`
- `{ anchorType: "header", id: "Story%201.5%20Implement%20Cache", rawText: "Story 1.5: Implement Cache", ... }`

This duplication violates the **One Source of Truth** and **Illegal States Unrepresentable** architecture principles.

**Root Cause**: The current implementation at `MarkdownParser.js:513-538` creates two separate anchor objects to support both standard markdown linking (raw text) and Obsidian-style linking (URL-encoded). This was a pragmatic solution but creates data redundancy.

**Impact**:
- **Medium**: Increases memory footprint of MarkdownParser.Output.DataContract (2x anchor objects for each header)
- **Medium**: Complicates downstream consumer logic (CitationValidator, future ContentExtractor)
- **Low**: Creates confusing contract for developers working with anchor arrays
- **Scope**: Affects all files with headers containing special characters (colons, spaces, etc.)

**Better Design**: Each header should produce a single AnchorObject with both ID variants as separate properties:

```javascript
{
  anchorType: "header",
  id: "Story 1.5: Implement Cache",           // Raw text format
  urlEncodedId: "Story%201.5%20Implement%20Cache", // Obsidian format (only when differs from id)
  rawText: "Story 1.5: Implement Cache",
  fullMatch: "### Story 1.5: Implement Cache",
  line: 166,
  column: 0
}
```

**Migration Requirements**:
- Refactor `MarkdownParser.extractAnchors()` to generate single anchor with dual ID properties
- Update `CitationValidator.validateAnchorExists()` to check both `id` and `urlEncodedId` fields
- Update MarkdownParser.Output.DataContract test fixtures and validation schema
- Update MarkdownParser.Output.DataContract JSON schema documentation

**Resolution**: ✅ RESOLVED in [Story 1.6: Refactor MarkdownParser.Output.DataContract - Eliminate Duplicate Anchor Entries](content-aggregation-prd.md#Story%201.6%20Refactor%20MarkdownParser.Output.DataContract%20-%20Eliminate%20Duplicate%20Anchor%20Entries)

**Resolution Date**: 2025-10-09 (Wave 2: Phase 2 & 3 Complete)

**Resolution Summary**:
- Refactored `MarkdownParser.extractAnchors()` to create single AnchorObject per header with both `id` (raw text) and `urlEncodedId` (Obsidian-compatible) properties
- Updated `CitationValidator.validateAnchorExists()` to check both `id` and `urlEncodedId` fields using logical OR pattern
- Eliminated duplicate anchor entries, achieving 50% memory reduction for headers with special characters
- Updated MarkdownParser.Output.DataContract schema with dual ID properties
- All Phase 1 parser schema tests passing (12/12)
- All Phase 1 integration tests passing (4/4)
- Zero functional regressions (100/102 tests passing, 2 pre-existing failures unrelated)

**Resolution Verification**:
- Parser test: `npm test -- parser-output-contract` → All tests passing, including "should prevent duplicate anchor entries"
- Integration test: `npm test -- integration/citation-validator-anchor-matching` → All tests passing with both ID formats
- Files modified: `src/MarkdownParser.js` (lines 497-513), `src/CitationValidator.js` (lines 522-587)

**Status**: ✅ RESOLVED (2025-10-09) - Ready for Epic 2 ContentExtractor implementation
%%

%%
### Data Duplication Between LinkObject and ValidationResult

**Risk Category**: Data Model / Performance / Architecture

**Status**: ✅ RESOLVED (2025-10-18) - Implementation Complete, QA Validation Pending (Task 4.5)

**Description**: The current architecture creates separate data structures for parser output (`LinkObject`) and validation results (`ValidationResult`), leading to 80% data duplication. LinkObject stores structural data (linkType, line, column, fullMatch, target path/anchor), while ValidationResult stores the same structural data plus validation status, error messages, and suggestions.

**Root Cause**: The validation workflow returns a separate `ValidationResult` array instead of enriching the original LinkObject instances with validation metadata. This creates two parallel data structures containing mostly identical information.

**Impact**:
- **Memory overhead**: Storing same data twice (linkType, line, column, citation text duplicated)
- **Redundant `getLinks()` calls**: Validator fetches links from parser, extractor fetches same links again
- **Architectural messiness**: Data flow passes same information multiple times through pipeline
- **Correlation complexity**: Consumers must correlate ValidationResult entries back to LinkObjects for complete context
- **Scope**: Affects all validation workflows and Epic 2 ContentExtractor integration

**Better Design**: Validation metadata should live **on the LinkObject** itself via progressive enhancement pattern:

```javascript
// Enhanced LinkObject with validation metadata
{
  // Original parser data (unchanged)
  linkType: "markdown",
  scope: "cross-document",
  target: { path: "file.md", anchor: "#section" },
  line: 42,
  column: 5,
  fullMatch: "[text](file)",

  // Validation metadata (added AFTER validation)
  validation: {
    status: "valid" | "warning" | "error",
    error: "Anchor not found",           // Only when status = "error"
    suggestion: "#similar-anchor"        // Only when status = "error" | "warning"
  }
}

// ValidationResult returns summary + enriched links
{
  summary: { total: 10, valid: 8, warnings: 1, errors: 1 },
  links: LinkObject[]  // Enriched with validation metadata (no duplication!)
}
```

**Benefits**:
- **Zero Duplication**: Validation data stored once on LinkObject (50% memory reduction)
- **Single Data Flow**: One object passes through pipeline (parse → validate → filter → extract)
- **No Redundant Calls**: Validator returns enriched links; extractor uses them directly
- **Natural Lifecycle**: Progressive enhancement pattern (base data + validation metadata)
- **Separation Preserved**: Summary stays separate for CLI reporting needs

**Resolution**: [Story 1.8: Implement Validation Enrichment Pattern](user-stories/us1.8-implement-validation-enrichment-pattern/us1.8-implement-validation-enrichment-pattern.md)

**Architecture Decision**: [ADR: Validation Enrichment Pattern](../../component-guides/Content%20Extractor%20Implementation%20Guide.md#Architectural%20Decision%20Validation%20Enrichment%20Pattern) (2025-10-17)

**Resolution Date**: 2025-10-18 (Implementation Complete)

**Implementation Summary**:
- Refactored `CitationValidator.validateFile()` to return `{ summary, links }` structure with enriched LinkObjects
- Added `validation` property to LinkObject instances with `{ status, error?, suggestion?, pathConversion? }` metadata
- Implemented progressive enhancement pattern: base LinkObject from parser + validation metadata from validator
- Updated CLI orchestrator to consume new ValidationResult structure for reporting
- Migrated complete test suite to enriched structure (121/123 tests passing, 2 failures unrelated to US1.8)

**Verification**:
- CitationValidator.js (lines 162-213): validateFile() returns { summary, links } with enrichment pattern
- JSDoc type annotations added (lines 4-48): EnrichedLinkObject, ValidationResult schemas
- Test status: 121/123 passing (98.4%), zero regressions from US1.8 changes
- Files modified: src/CitationValidator.js, src/citation-manager.js, 6+ test files
- US1.8 tasks 1.1-4.2 complete (implementation phase done)

**Pending**:
- Formal QA validation (Task 4.5) - comprehensive AC validation
- Documentation updates (Tasks 5.1-5.3) - component guides, architecture diagrams

**References**:
- Implementation: tools/citation-manager/src/CitationValidator.js:162-213
- Story: [US1.8 Implement Validation Enrichment Pattern](user-stories/us1.8-implement-validation-enrichment-pattern/us1.8-implement-validation-enrichment-pattern.md)
- ADR: [Validation Enrichment Pattern](../../component-guides/Content%20Extractor%20Implementation%20Guide.md#Architectural%20Decision%20Validation%20Enrichment%20Pattern)
%%

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

### Incomplete Facade Encapsulation for Advanced Queries

**Risk Category**: Architecture / Maintainability

**Status**: Created (2025-10-15) - Technical debt created by US1.7

**Description**: CitationValidator helper methods partially bypass ParsedDocument facade for advanced anchor queries, directly accessing `_data.anchors` for type filtering and rawText access (CitationValidator.js lines 528, 560, 570-578). While core validation uses facade methods (`hasAnchor()`, `findSimilarAnchors()`), error reporting and advanced matching still couple to internal anchor schema.

**Impact**:
- **Maintainability Risk**: Error message generation breaks if anchor schema changes
- **Facade Violation**: ParsedDocument's encapsulation promise partially bypassed
- **Missing Abstractions**: Type-specific queries (header vs block) not exposed by facade
- **Scope**: Limited to error reporting and advanced matching - doesn't affect validation correctness

**Root Cause**:
ParsedDocument facade (US1.7) initially designed for core validation queries. Advanced use cases discovered during integration:
- Type filtering for error messages (`anchorType === "header"` vs `"block"`)
- RawText access for human-readable anchor suggestions
- Full anchor object metadata for flexible matching algorithms

**Code Locations**:
- Line 528: `suggestObsidianBetterFormat()` needs anchor objects with `anchorType`, `rawText` properties
- Line 560: `findFlexibleAnchorMatch()` needs anchor objects with `rawText` for markdown-aware matching
- Lines 570-578: Suggestion generation needs anchor objects filtered by type

**Resolution Strategy**:
Extend ParsedDocument facade with additional public methods:
- `getAnchorsByType(anchorType)` - Returns filtered anchor metadata
- `getAllAnchorsWithMetadata()` - Returns all anchors with id, rawText, anchorType, urlEncodedId

Refactor CitationValidator helper methods (`suggestObsidianBetterFormat()`, `findFlexibleAnchorMatch()`) to consume facade methods instead of `_data` access.

**Priority**: Low
- Isolated to error reporting code paths
- Zero impact on validation correctness
- No test failures or functional regressions
- Can be addressed incrementally without breaking changes

**Timeline**: Address in Epic 2 or dedicated refactoring story
**Status**: Documented technical debt (2025-10-15), low priority

### ParsedFileCache Memory Characteristics

**Risk Category**: Performance / Resource Management
**Description**: The `ParsedFileCache` stores complete `MarkdownParser.Output.DataContract` objects in memory, including the full file content string. For large architectural documents or multi-file validation runs, this creates measurable memory overhead.

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

### Deferred: Configuration File Layer

**Risk Category**: Feature Completeness / User Experience
**Description**: The MVP implements 3-layer configuration (defaults → CLI flags → per-link markers) but does not include file-based configuration support (`citation-manager.config.json`). This means users cannot save project-specific or user-specific extraction preferences, requiring repetitive CLI flag usage.

**Missing Layer**: File-based configuration that would slot between defaults and CLI flags in the precedence hierarchy.

**Current Implementation**:
1. Defaults (section=extract, full-file=skip)
2. CLI flags (`--full-files`)
3. Per-link markers (`%%extract-link%%`, `%%stop-extract-link%%`)

**Reference Implementation**: [Repomix hierarchical config pattern](https://github.com/yamadashy/repomix/blob/main/src/config/configLoad.ts)
- Layered precedence: defaults → file → CLI → (markers - our addition)
- Zod schema validation for type safety
- Config file discovery strategy (project root → user home)

**Technical Requirements (Future Story)**:
1. **Config File Discovery**: Search project root, then user home directory
2. **Schema Validation**: Zod schema for extraction rules, fail fast on invalid config
3. **Merge Logic**: Preserve precedence hierarchy when combining config layers
4. **Path-Based Rules**: Glob patterns for include/exclude (e.g., `"design-docs/**": { "fullFiles": true }`)

**Design Considerations**:
- **Schema Design**: Define extraction rules schema (global defaults + path-specific overrides)
- **File Format**: JSON (simplicity) vs YAML (human-friendly) vs JS (programmable)
- **Merge Strategy**: Deep merge vs shallow merge for nested objects
- **Validation UX**: Clear error messages for invalid config

**Migration Path**:
- Backward compatible: New layer slots between defaults and CLI
- Existing CLI + marker behavior unchanged
- Users can migrate gradually: CLI → file config → markers as needed

**ROI Analysis**:
- **Value**: Reduces repetitive CLI flags for projects with consistent extraction patterns
- **Cost**: Config discovery, validation, testing complexity (~8-16 hours implementation)
- **Decision**: Defer until user demand validated (can achieve similar results with shell aliases)

**Impact**:
- **Low**: MVP delivers 80% of value with CLI + markers alone
- **Scope**: File config adds complexity without proportional user value for initial release
- **Workaround**: Users can create shell scripts/aliases wrapping CLI commands

**Rationale for Deferring**: Following [simplicity-first](../../../../../design-docs/Architecture%20Principles.md#^simplicity-first) principle - don't build features until user demand demonstrates necessity. The current 3-layer system provides sufficient control for MVP validation.

**Resolution Criteria**:
- User feedback indicates repetitive CLI flag usage is a pain point
- Multiple users request project-level configuration capabilities
- Implementation includes full schema validation and comprehensive test coverage

**Timeline**: Revisit after MVP validation shows repetitive CLI usage patterns across projects.
**Status**: Backlog (deferred from Epic 2 MVP scope).

### Test Suite Edge Cases (CLI Display and POC Features)

**Risk Category**: Quality / Testing

**Description**: 2 tests in the citation manager test suite fail with pre-existing edge case issues unrelated to core functionality. These failures represent technical debt in auto-fix feature completeness and POC section extraction implementation.

**Failing Tests**:
1. **Auto-Fix Kebab-Case Anchor Conversion** (1 test) - Auto-fix feature does not convert kebab-case anchors to URL-encoded format (e.g., `#sample-header` → `#Sample%20Header`)
2. **POC Section Extraction H4 Support** (1 test) - POC section extraction logic returns null when extracting H4 sections

**Impact**:
- **Low**: Core functionality works correctly. Auto-fix handles path corrections but not anchor format normalization. POC feature affects only proof-of-concept code, not production validation.
- **Scope**: Affects auto-fix feature completeness and POC section extraction edge cases
- **Test Suite Status**: 121/123 tests passing (98.4%)

**Current State**:
- **US1.8 Validation Enrichment Pattern**: Implementation complete with zero regressions (121/123 passing)
- **Unrelated Failures**: Both failures existed before US1.8 and are unrelated to validation enrichment changes

**Rationale for Accepting Risk**: These edge case failures are isolated to feature extensions (auto-fix anchor transformation, POC section extraction) and do not affect core validation functionality. All schema validation tests pass, all enrichment pattern tests pass, zero functional regressions from recent changes.

**Mitigation Strategy**: Create dedicated user stories to address:
1. Auto-fix anchor format transformation support
2. POC section extraction H4 heading level support

**Resolution Criteria**:
- Auto-fix feature converts kebab-case anchors to appropriate format
- POC section extraction handles H4 sections correctly
- All 123 tests passing

**Timeline**: Low priority - address after Epic 2 Content Aggregation implementation complete.
**Estimated Effort**: 1-2 tasks, ~2-4 hours total
**Status**: Documented technical debt, low priority.

### CLI Subprocess Testing Buffer Limits

**Risk Category**: Testing Infrastructure / Architecture

**Status**: Workaround Implemented (2025-10-18) - Refactoring Recommended

**Description**: The current CLI integration testing pattern spawns the CLI as a subprocess using `execSync()`, which creates OS-level stdio pipes with ~64KB buffer limits on macOS. When CLI output exceeds this limit (e.g., large JSON validation results with 100+ citations producing 92KB+ output), data gets truncated, resulting in malformed JSON and test failures.

**Root Cause**: Node.js `child_process` stdio pipes are subject to OS-level buffer limits (~64KB on macOS). Tests that spawn the CLI as a subprocess encounter these limits, while production CLI usage (writing directly to terminal stdout) is not affected.

**Impact**:
- **Medium**: Tests use different execution path than production code, requiring special workarounds
- **Complexity**: Shell redirection to temporary files adds infrastructure complexity
- **Debugging**: Subprocess spawning makes debugging more difficult
- **Scope**: Affects all CLI integration tests that spawn subprocesses

**Current Workaround**: Shell redirection to temporary files (`test/helpers/cli-runner.js`) bypasses pipe buffers by writing output to filesystem before reading. This works but adds complexity and maintenance overhead.

**Recommended Mitigation**: Refactor tests to import CLI functions directly instead of spawning subprocesses:
- Export `validateFile()`, `formatAsJSON()` from CLI Orchestrator component
- Import functions directly in tests (no subprocess spawning)
- Reserve subprocess testing for true E2E scenarios (argument parsing, exit codes)
- Aligns test architecture with production architecture (both use same code path)

**Benefits of Refactoring**:
- ✅ No buffer limits (in-memory objects, not piped output)
- ✅ Faster tests (no subprocess overhead)
- ✅ Simpler debugging (same process, can use debugger)
- ✅ Tests match production code paths
- ✅ Eliminates workaround complexity

**Resolution Criteria**:
- CLI Orchestrator exports testable functions (`validateFile()`, `formatAsJSON()`)
- 99% of tests import functions directly (unit/integration tests)
- 1% of tests use subprocess spawning (E2E CLI behavior tests)
- Remove or simplify `cli-runner.js` helper

**Timeline**: Implement when adding more CLI integration tests or hitting other subprocess-related issues.
**Estimated Effort**: 8-12 hours (1-2 days)
**Priority**: Medium - current workaround functional but adds complexity

**References**:
- **Detailed Analysis**: [Bug 3: Buffer Limit Resolution](user-stories/us1.8-implement-validation-enrichment-pattern/bug3-buffer-limit-resolution.md)
- **Workspace Architecture**: [Technical Debt: CLI Subprocess Testing Buffer Limits](../../../../../design-docs/Architecture%20-%20Baseline.md#Technical%20Debt%20CLI%20Subprocess%20Testing%20Buffer%20Limits)

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
