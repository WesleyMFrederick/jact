# Component Guides Research - TypeScript Migration Phase 2

## Research Summary

This document captures the key data contracts, function signatures, and architecture patterns found in the Component Guides. This research informs the TypeScript migration design by identifying existing contracts that need to be preserved.

## Component Overview

The citation-manager tool consists of 7 main components with clear separation of concerns:

1. **MarkdownParser** - Parses markdown files into structured AST
2. **ParsedDocument** - Facade providing query interface over parser output
3. **ParsedFileCache** - Caches ParsedDocument instances per-command
4. **CitationValidator** - Validates LinkObjects against parsed documents
5. **ContentExtractor** - Extracts content from target documents
6. **CLI Orchestrator** - Coordinates workflows and manages component lifecycle
7. **FileCache** - Maps short filenames to absolute paths

---

## Core Data Contracts

### MarkdownParser.Output.DataContract

**Location:** [Markdown Parser Implementation Guide](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/cc-workflows/tools/citation-manager/design-docs/component-guides/Markdown Parser Implementation Guide.md#Data Contracts)

**Description:** The complete output from MarkdownParser's `parseFile()` method. This is the foundational data structure that all other components consume.

**Key Structure:**

```javascript
{
  filePath: string,           // Absolute path of parsed file
  content: string,            // Full raw content
  tokens: Array<object>,      // Marked library tokens (external structure)
  links: Array<LinkObject>,   // All outgoing links
  headings: Array<HeadingObject>,  // All headings
  anchors: Array<AnchorObject>     // All anchor targets
}
```

**Sub-Contracts:**

1. **LinkObject** - Represents an outgoing link from the document
   - Created by MarkdownParser with base properties
   - Enriched post-parse by CitationValidator with `validation` property (US1.8 Validation Enrichment Pattern)
   - Properties: `linkType`, `scope`, `anchorType`, `source`, `target`, `text`, `fullMatch`, `line`, `column`, `extractionMarker`, `validation?`

2. **HeadingObject** - Represents a heading in document structure
   - Properties: `level`, `text`, `raw`
   - Note: `.headings[]` array is not used by production code, only tests (potential for AST generation)

3. **AnchorObject** - Represents an anchor target in the document
   - Properties: `anchorType`, `id`, `urlEncodedId?`, `rawText`, `fullMatch`, `line`, `column`
   - Header anchors include both `id` (raw) and `urlEncodedId` (Obsidian-compatible)
   - Block anchors omit `urlEncodedId`

**Enrichment Pattern:** LinkObject's `validation` property is added post-parse by CitationValidator, demonstrating the progressive enhancement pattern used throughout the system.

---

### OutgoingLinksExtractedContent Schema

**Location:** [Content Extractor Implementation Guide](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/cc-workflows/tools/citation-manager/design-docs/component-guides/Content Extractor Implementation Guide.md#OutgoingLinksExtractedContent Schema)

**Description:** Output structure from ContentExtractor using indexed format to minimize token usage through content deduplication.

**Key Structure:**

```javascript
{
  extractedContentBlocks: {
    _totalContentCharacterLength: number,  // Reserved metadata field
    [contentId: string]: {  // contentId is SHA-256 hash
      content: string,
      contentLength: number,
      sourceLinks: Array<{
        rawSourceLink: string,
        sourceLine: number
      }>
    }
  },
  outgoingLinksReport: {
    sourceFilePath: string,
    processedLinks: Array<{
      contentId: string | null,
      sourceLine: number,
      sourceColumn: number,
      linkText: string,
      linkTargetPathRaw: string | null,
      linkTargetAnchor: string | null,
      linkExtractionEligibilityReason?: string,
      extractionStatus: "success" | "skipped" | "error",
      extractionFailureReason?: string
    }>
  },
  stats: {
    totalLinks: number,
    uniqueContent: number,
    duplicateContentDetected: number,
    tokensSaved: number,
    compressionRatio: number
  }
}
```

**Design Notes:**
- Deduplication is default behavior (not optional)
- Single-pass inline approach (no intermediate arrays)
- Content indexed by SHA-256 hash for efficient lookup

---

## Component Contracts

### 1. MarkdownParser

**File:** `tools/citation-manager/src/MarkdownParser.js`

**Input Contract:**
- `filePath` (string): Absolute path to markdown file

**Output Contract:**
- Returns `MarkdownParser.Output.DataContract` (synchronous)
- Throws on file not found or parsing errors

**Key Methods:**
- `parseFile(filePath: string): MarkdownParser.Output.DataContract`

**Dependencies:**
- `marked` library for tokenization
- Node.js `fs` module for file I/O

**Boundaries:**
- Transforms raw markdown into structured AST
- NOT responsible for: validation, semantic correctness, file existence checking
- NOT aware of ParsedDocument facade wrapper

**Architecture Notes:**
- Generates single anchor per header with dual ID properties (raw + URL-encoded) for Obsidian compatibility (US1.6)
- Handles Obsidian block refs and caret syntax
- Identifies multiple link pattern types (markdown, wiki-style)

---

### 2. ParsedDocument (Facade)

**File:** `tools/citation-manager/src/ParsedDocument.js`

**Input Contract:**
- Constructor receives `MarkdownParser.Output.DataContract`

**Output Contract:**
- Exposes query methods returning transformed/filtered data

**Key Methods:**
- **Anchor Queries:**
  - `hasAnchor(anchorId: string): boolean`
  - `findSimilarAnchors(anchorId: string): Array<string>`
- **Link Queries:**
  - `getLinks(): Array<LinkObject>`
- **Content Extraction:**
  - `extractFullContent(): string`
  - `extractSection(headingText: string): string`
  - `extractBlock(anchorId: string): string`

**Dependencies:**
- None (wraps MarkdownParser.Output.DataContract)

**Boundaries:**
- Provides stable query interface over parser output
- Encapsulates direct access to internal data structures
- NOT responsible for: parsing, caching, validation, content aggregation

**Known Limitation:**
- CitationValidator still accesses `_data.anchors` directly for type filtering and rawText operations (lines 528, 560, 570-578)
- Full encapsulation deferred to Epic 2

**Architecture Pattern:** Facade pattern decoupling consumers from parser internals

---

### 3. ParsedFileCache

**File:** `tools/citation-manager/src/ParsedFileCache.js`

**Input Contract:**
- `filePath` (string): Absolute, normalized path to markdown file

**Output Contract:**
- `resolveParsedFile(filePath: string): Promise<ParsedDocument>`
- Resolves with ParsedDocument facade instance
- Rejects on parse failures (FileNotFoundError, ParsingError)

**Key Methods:**
- `resolveParsedFile(filePath: string): Promise<ParsedDocument>`

**Dependencies:**
- MarkdownParser (for parsing)
- ParsedDocument (for wrapping)

**Boundaries:**
- Manages in-memory lifecycle of ParsedDocument instances
- Acts as key-value store (file path → ParsedDocument)
- NOT responsible for: parsing logic, direct file system operations

**Cache Lifecycle:**
- Ephemeral (persists only for single command execution)
- Cleared when process exits
- Uses absolute, normalized file paths as keys

**Error Handling Pattern:**
- Promise rejection pattern with synchronous cache cleanup
- Failed promises MUST be removed from cache before rejection propagation
- Enables retry on transient errors

**Architecture Notes:**
- Wraps MarkdownParser.Output.DataContract in ParsedDocument facade before caching
- Ensures each file is read and parsed at most once per command
- Critical for efficiency: both CitationValidator and ContentExtractor use same cache

---

### 4. CitationValidator

**File:** `tools/citation-manager/src/CitationValidator.js`

**Input Contract:**
- **For `validateFile()`:**
  - `filePath` (string): Absolute path to source file
  - `scope?` (string): Optional directory scope for FileCache
- **For `validateSingleCitation()`:**
  - `linkObject` (LinkObject): Unvalidated LinkObject

**Output Contract:**
- **`validateFile()`:** Returns `ValidationResult`:

  ```javascript
  {
    summary: {
      total: number,
      valid: number,
      warnings: number,
      errors: number
    },
    links: Array<LinkObject>  // Enriched with validation property
  }
  ```

- **`validateSingleCitation()`:** Returns enriched LinkObject with `validation` property

**Key Methods:**
- `validateFile(filePath: string, scope?: string): Promise<ValidationResult>`
- `validateSingleCitation(linkObject: LinkObject): Promise<LinkObject>`

**Dependencies:**
- ParsedFileCache (to retrieve ParsedDocument instances)
- ParsedDocument query methods (`hasAnchor()`, `getAnchorIds()`, `findSimilarAnchors()`)
- FileCache (optional, for filename resolution when scope provided)
- Node.js `fs` module (for file existence fallback checks)

**Boundaries:**
- Exclusively responsible for semantic validation of LinkObjects
- NOT responsible for: parsing markdown, navigating parser output, managing parse efficiency, file modifications

**Validation Strategies:**
- Classifies citation patterns (caret syntax, cross-document, wiki-style)
- Resolves file paths using multiple strategies:
  - Relative paths
  - Symlinks
  - Obsidian absolute paths
  - Cache lookup

**Enrichment Pattern (US1.8):**
- Adds `validation` property to LinkObject:

  ```javascript
  {
    status: "valid" | "warning" | "error",
    error?: string,
    suggestion?: string,
    pathConversion?: object
  }
  ```

**Architecture Notes:**
- Uses ParsedDocument query methods instead of direct data structure access (mostly - see known limitation)
- Generates actionable suggestions for broken links

---

### 5. ContentExtractor

**File:** `tools/citation-manager/src/core/ContentExtractor/ContentExtractor.js`

**Input Contract:**
- `extractContent(enrichedLinks: Array<LinkObject>, cliFlags: object): Promise<OutgoingLinksExtractedContent>`
- Receives pre-validated enriched LinkObjects from CLI
- Filters out internal links (`scope='internal'`) before processing (US2.2 AC15)

**Output Contract:**
- Returns `OutgoingLinksExtractedContent` object (see schema above)

**Key Methods:**
- `extractContent(enrichedLinks: Array<LinkObject>, cliFlags: object): Promise<OutgoingLinksExtractedContent>`

**Dependencies:**
- ParsedFileCache (to retrieve ParsedDocument instances)
- ParsedDocument content extraction methods (`extractSection()`, `extractBlock()`, `extractFullContent()`)
- ExtractionStrategy chain (injected, for eligibility analysis)

**Boundaries:**
- Responsibilities:
  1. Analyze extraction eligibility via Strategy Pattern
  2. Extract content from target documents via ParsedDocument facade
  3. Deduplicate extracted content using SHA-256 content-based hashing
  4. Aggregate results into OutgoingLinksExtractedContent structure
- NOT responsible for: link discovery/validation, parsing markdown, navigating parser output, reading files from disk, final output formatting/file writing

**Architecture Patterns:**
- Strategy Pattern for extraction eligibility
- Progressive enhancement (receives enriched links)
- Content deduplication via SHA-256 hashing (US2.2a)
- Indexed content structure for token usage minimization

**Integration Points:**
- Consumed by CLI Orchestrator via `extractContent()` method
- Receives pre-validated enriched LinkObjects from CLI orchestrator

---

### 6. CLI Orchestrator

**File:** `tools/citation-manager/src/citation-manager.js`

**Input Contract:**
- Command-line arguments (`process.argv`)
- Access to component factory

**Output Contract:**
- Formatted string to stdout (human-readable or JSON)
- Exit code (0 for success, non-zero for failure)
- File system modifications (only for `--fix` command)

**Commands:**
- `validate` - Validates citations in a file
- `ast` - Displays AST for debugging
- `base-paths` - (deprecated, to be removed US2.7)
- `fix` - Auto-fixes broken citations
- `extract links` - Discovers and extracts content from links in source file
- `extract header` - Extracts specific header section
- `extract file` - Extracts full file content

**Orchestration Patterns:**

1. **Link Discovery Workflow** (`extract links`):
   - Calls `citationValidator.validateFile(sourceFile)` to discover links
   - Passes enriched links to `contentExtractor.extractContent()`

2. **Synthetic Link Creation Workflow** (`extract header`, `extract file`):
   - Creates synthetic LinkObjects via LinkObjectFactory helper
   - Validates synthetic links via `citationValidator.validateSingleCitation()`
   - Passes validated links to `contentExtractor.extractContent()`

**Dependencies:**
- MarkdownParser
- FileCache
- ParsedFileCache
- ParsedDocument (indirectly via ParsedFileCache)
- CitationValidator
- ContentExtractor
- Commander.js (CLI framework)
- Node.js `fs` module (for `--fix` operation)

**Boundaries:**
- Primary responsibility: orchestrate workflow coordination
- Exception: `--fix` operation contains application-level logic to read file, apply suggestions, write corrected content
  - This boundary exception is basis for "Scattered File I/O Operations" tech debt

**Level 4 Implementation Detail:**
- **LinkObjectFactory** helper (NOT separate component):
  - Location: `tools/citation-manager/src/factories/LinkObjectFactory.js`
  - Methods: `createHeaderLink()`, `createFileLink()`
  - Constructs unvalidated LinkObjects from CLI parameters
  - Handles path normalization
  - Does NOT validate or extract content

**Architecture Notes:**
- Creates and coordinates all components
- Injects dependencies at instantiation
- `ast` command accesses raw MarkdownParser.Output.DataContract directly (bypasses ParsedDocument facade for debugging)

---

### 7. FileCache

**File:** `tools/citation-manager/src/FileCache.js`

**Input Contract:**
- Constructor: File System interface, Path Module interface
- `buildCache(scopeFolder: string): object` - Initialize cache
- `resolveFile(filename: string): object` - Perform lookup

**Output Contract:**
- **`buildCache()`:** Returns statistics object
- **`resolveFile()`:** Returns Resolution Result object:

  ```javascript
  {
    found: boolean,
    path?: string,  // Absolute path if found
    reason?: string // Failure reason ('duplicate', 'not_found')
  }
  ```

**Key Methods:**
- `buildCache(scopeFolder: string): object`
- `resolveFile(filename: string): object`

**Dependencies:**
- Node.js `fs` module (for directory scanning)
- Node.js `path` module

**Boundaries:**
- Maps short filenames to absolute file paths within directory scope
- File system access limited to initial directory scan
- NOT responsible for: reading/parsing/caching file content (only manages paths)

**Architecture Notes:**
- Handles symlink resolution to avoid duplicates
- Detects duplicate filenames
- Provides fuzzy matching for common typos
- Warns about duplicates to stderr during cache build

---

## Architecture Patterns

### 1. Validation Enrichment Pattern (US1.8)

**Description:** Progressive enhancement of LinkObjects through the pipeline

**Flow:**
1. MarkdownParser creates LinkObject with base properties
2. CitationValidator enriches LinkObject with `validation` property
3. ContentExtractor consumes enriched LinkObject

**Benefits:**
- Zero duplication (validation data stored once on LinkObject)
- Single data flow (one object passes through pipeline)
- No redundant calls
- Natural lifecycle (progressive enhancement)

**Breaking Change Note:** Requires coordinated updates across CitationValidator, ContentExtractor, and CLI

---

### 2. Facade Pattern (ParsedDocument)

**Description:** Stable query interface decoupling consumers from parser internals

**Benefits:**
- Changes to MarkdownParser.Output.DataContract don't affect consumers
- Encapsulates navigation complexity
- Allows parser evolution without breaking consumers

**Current Limitation:** CitationValidator has some direct `_data.anchors` access (Epic 2 cleanup target)

---

### 3. Strategy Pattern (ContentExtractor)

**Description:** Extraction eligibility analysis using injected strategy chain

**Benefits:**
- Extensible filtering logic
- Testable in isolation
- Clear precedence rules

---

### 4. Dependency Injection

**Description:** CLI Orchestrator creates components and injects dependencies at instantiation

**Benefits:**
- Loose coupling
- Testable components
- Clear dependency graph

**Example:** ParsedFileCache injected into both CitationValidator and ContentExtractor, enabling single-parse guarantee

---

### 5. Single-Parse Guarantee (via ParsedFileCache)

**Description:** Files parsed once even though both Validator and Extractor need parsed content

**Workflow:**
1. CLI calls `citationValidator.validateSingleCitation(syntheticLink)`
2. Validator calls `parsedFileCache.resolveParsedFile(targetFile)` → Parse #1
3. Validator uses ParsedDocument to check anchor existence
4. CLI calls `contentExtractor.extractContent([validatedLink])`
5. Extractor calls `parsedFileCache.resolveParsedFile(targetFile)` → Cache Hit! No Parse
6. Extractor uses ParsedDocument to extract content

**Result:** Single parse, two consumers - elegant architectural reuse

---

## Component Dependencies

### Dependency Graph

```text
CLI Orchestrator
├── MarkdownParser
├── FileCache
├── ParsedFileCache
│   ├── MarkdownParser
│   └── ParsedDocument
├── CitationValidator
│   ├── ParsedFileCache
│   ├── ParsedDocument (via ParsedFileCache)
│   └── FileCache (optional)
└── ContentExtractor
    ├── ParsedFileCache
    ├── ParsedDocument (via ParsedFileCache)
    └── ExtractionStrategy (injected)
```

### Shared Infrastructure

- **ParsedFileCache:** Shared by CitationValidator and ContentExtractor
  - Enables single-parse guarantee
  - Critical efficiency win

- **ParsedDocument:** Query interface consumed by:
  - CitationValidator (anchor queries)
  - ContentExtractor (content extraction)

---

## Known Technical Debt

### Scattered File I/O Operations

**Location:** [Content Aggregation Architecture](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/cc-workflows/tools/citation-manager/design-docs/features/20251003-content-aggregation/content-aggregation-architecture.md) (See "Scattered File I/O Operations" section)

**Risk Category:** Architecture / Maintainability

**Description:** Multiple components perform direct file system operations:
- MarkdownParser reads files
- CitationValidator checks file existence
- CLI Orchestrator reads/writes files for `--fix` command

**Impact:**
- Makes components harder to test in isolation
- Requires mocking `fs` module in multiple places
- Risk of inconsistent error handling
- System more brittle

**Mitigation Strategy:** Create dedicated FileSystemManager component
- Centralize all file I/O (`readFile`, `writeFile`, `exists`)
- Instantiate via factory
- Inject into components needing disk access

**Timeline:** Address after Epic 2 completion

---

### ParsedDocument Encapsulation Incomplete

**Description:** CitationValidator still accesses `_data.anchors` directly for type filtering and rawText operations (lines 528, 560, 570-578)

**Impact:** Violates facade pattern encapsulation

**Resolution:** Full encapsulation deferred to Epic 2

---

### CLI Subprocess Testing Buffer Limits

**Location:** Referenced in CLI Orchestrator Implementation Guide

**Description:** Testing buffer limits when running CLI as subprocess

**Status:** Documented technical debt

---

## TypeScript Migration Implications

### High Priority Type Definitions Needed

1. **MarkdownParser.Output.DataContract** - Foundation for all other types
   - LinkObject (with progressive enrichment)
   - HeadingObject
   - AnchorObject

2. **OutgoingLinksExtractedContent** - ContentExtractor output contract

3. **ValidationResult** - CitationValidator output contract

4. **ParsedDocument interface** - Facade method signatures

### Progressive Enhancement Pattern Support

TypeScript types must support progressive enhancement:
- LinkObject with optional `validation` property
- Clear documentation of when properties are added
- Type guards for property presence checking

### Interface vs Implementation

- Define interfaces for public contracts
- Keep implementation details flexible
- Support dependency injection patterns

### Error Handling Types

- Define error types for each component
- Promise rejection patterns
- File I/O error handling

---

## References

### Component Guides
- [CitationValidator Implementation Guide](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/cc-workflows/tools/citation-manager/design-docs/component-guides/CitationValidator Implementation Guide.md)
- [Content Extractor Implementation Guide](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/cc-workflows/tools/citation-manager/design-docs/component-guides/Content Extractor Implementation Guide.md)
- [CLI Orchestrator Implementation Guide](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/cc-workflows/tools/citation-manager/design-docs/component-guides/CLI Orchestrator Implementation Guide.md)
- [Markdown Parser Implementation Guide](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/cc-workflows/tools/citation-manager/design-docs/component-guides/Markdown Parser Implementation Guide.md)
- [ParsedDocument Implementation Guide](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/cc-workflows/tools/citation-manager/design-docs/component-guides/ParsedDocument Implementation Guide.md)
- [ParsedFileCache Implementation Guide](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/cc-workflows/tools/citation-manager/design-docs/component-guides/ParsedFileCache Implementation Guide.md)
- [CLI Architecture Overview](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/cc-workflows/tools/citation-manager/design-docs/component-guides/CLI Architecture Overview.md)

### Architecture Documents
- [Content Aggregation Architecture](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/cc-workflows/tools/citation-manager/design-docs/features/20251003-content-aggregation/content-aggregation-architecture.md)
- [Content Aggregation PRD](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/cc-workflows/tools/citation-manager/design-docs/features/20251003-content-aggregation/content-aggregation-prd.md)
- [Architecture Principles](/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/cc-workflows/ARCHITECTURE-PRINCIPLES.md)

---

## Next Steps

1. Review this research document
2. Validate contract completeness against actual source code
3. Design TypeScript type definitions for core contracts
4. Plan migration strategy respecting existing architecture patterns
