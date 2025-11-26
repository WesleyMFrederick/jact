# ParsedFileCache Implementation Guide

This guide provides the Level 4 (Code) details for implementing the **`ParsedFileCache`** component, as defined in user story `us1.5`. It includes the component's structure, pseudocode for its core logic, formal data contracts, and a testing strategy.

## Problem
Components like the `CitationValidator` and the upcoming `ContentExtractor` need access to the parsed structure of multiple files during a single operation. Without a caching mechanism, the same file could be read from disk and parsed by the `MarkdownParser` repeatedly, leading to significant and unnecessary I/O and CPU overhead, creating a severe performance bottleneck.

## Solution
The **`ParsedFileCache`** component acts as an in-memory, per-run singleton that serves as a broker for parsed file data. This component implements the **Read-Through Cache** pattern. It intercepts all requests for a [**`MarkdownParser.Output.DataContract`**](Markdown%20Parser%20Implementation%20Guide.md#Data%20Contracts), calling the `MarkdownParser` only on the first request for a given file and wrapping the result in a `ParsedDocument` facade before storing and returning it. Subsequent requests for the same file are served directly from the cache, ensuring that each file is parsed at most once per command execution. This drastically improves performance and reduces redundant work.

### Caching Technology
We'll use the native JavaScript **`Map`** object. A `Map` is a simple, high-performance, in-memory key-value store that's built into Node.js. It's perfectly suited for our needs and requires no external dependencies, which aligns with our [Simplicity First](../../../../ARCHITECTURE-PRINCIPLES.md#^simplicity-first) principle.

### Key-Value Structure
The key-value structure for the cache will be:
- **Key**: The **absolute, normalized file path** (string) of the document. This ensures that different relative paths pointing to the same file are treated as a single cache entry.
- **Value**: The **`ParsedDocument` facade instance** that wraps the `MarkdownParser.Output.DataContract` for that file. We store the facade instance to ensure consumers receive a stable query interface and are decoupled from parser internals.

## Memory Management
No, we do not need to worry about manual memory cleanup. Because the cache is **ephemeral** (living only for the duration of a single command run), all memory it uses is part of the Node.js process. When the command finishes and the process exits, the operating system will automatically reclaim all of its memory. There's no risk of memory leaks between command executions.

## Structure

The `ParsedFileCache` is a class that holds an in-memory map and has a dependency on the `MarkdownParser` interface. It exposes a single public method, `resolveParsedFile()`, which asynchronously returns a `ParsedDocument` facade instance. It is consumed by any component that needs parsed file data.

```mermaid
classDiagram
    direction LR

    class ParserOutputContract {
        +filePath: string
        +content: string
        +tokens: object[]
        +links: Link[]
        +anchors: Anchor[]
    }

    class ParsedDocument {
        -_data: ParserOutputContract
        +getAnchorIds(): string[]
        +hasAnchor(anchorId): boolean
        +getBlockAnchors(): Anchor[]
        +getHeaderAnchors(): Anchor[]
        +findSimilarAnchors(anchorId): string[]
        +getLinks(): Link[]
        +getCrossDocumentLinks(): Link[]
        +extractSection(headingText): string
        +extractBlock(anchorId): string
        +extractFullContent(): string
    }

    class MarkdownParser {
        <<interface>>
        +parseFile(filePath: string): Promise~ParserOutputContract~
    }

    class CitationValidator {
        +validateFile(filePath: string): Promise~ValidationResult~
    }

    class ParsedFileCache {
        -cache: Map:string, ParsedDocument
        -markdownParser: MarkdownParserInterface
        +resolveParsedFile(filePath: string): Promise~ParsedDocument~
    }

    CitationValidator --> ParsedFileCache : uses
    ParsedFileCache --> MarkdownParser : uses
    ParsedFileCache --> ParsedDocument : creates and returns
    ParsedDocument --> ParserOutputContract : wraps
    MarkdownParser ..> ParserOutputContract : returns
```

1. [**ParserOutputContract**](Markdown%20Parser%20Implementation%20Guide.md#Data%20Contracts): The data object wrapped by ParsedDocument.
2. **ParsedDocument**: The facade providing query methods over parser output (US1.7).
3. [**MarkdownParser**](Markdown%20Parser%20Implementation%20Guide.md): The dependency that produces the `ParserOutputContract` on a cache miss.
4. [**CitationValidator**](CitationValidator%20Implementation%20Guide.md): An example of a consumer of the cache.
5. [**ParsedFileCache**](ParsedFileCache%20Implementation%20Guide.md): The class that orchestrates the caching logic.

## File Structure

```text
tools/citation-manager/
└── src/
    ├── ParsedFileCache.ts     # Promise-based cache for parsed markdown files
    ├── ParsedDocument.ts      # Facade class wrapping parser output
    ├── MarkdownParser.ts      # Parser dependency
    └── types/
        └── citationTypes.ts   # TypeScript type definitions
```

**Architecture Notes:**
- Implemented in TypeScript with strict type safety
- Uses native `Map<string, Promise<ParsedDocument>>` for cache storage
- Implements Read-Through Cache pattern with Promise deduplication
- Ephemeral cache cleared on process exit
- Current structure prioritizes simplicity and performance

## Public Contracts

### Input Contract
1. **`filePath`** (string): The absolute, normalized path to the markdown file to be retrieved.

### Output Contract
The `resolveParsedFile()` method returns a `Promise` that resolves with a **`ParsedDocument` facade instance** that wraps the `MarkdownParser.Output.DataContract`.
- **Success Case**: The `Promise` resolves with the **`ParsedDocument` facade instance**
- **Error Cases**: The `Promise` will reject with an appropriate error if the underlying call to `markdownParser.parseFile()` fails (e.g., due to a `FileNotFoundError` or a `ParsingError`).
- **Cache Key**: The cache internally uses absolute, normalized file paths as keys to prevent ambiguity.
- **Facade Wrapping**: The cache wraps `MarkdownParser.Output.DataContract` in `ParsedDocument` facade before caching and returning.
- **Cache Lifecycle**: The cache is ephemeral and persists only for the duration of a single command execution. It is cleared when the process exits.

## Pseudocode

High-level architectural patterns showing Read-Through Cache with Promise deduplication.

```typescript
/**
 * Read-Through Cache Pattern: ParsedFileCache manages concurrent access to parsed files
 *
 * Key Patterns:
 * - Promise Caching: Store Promises (not values) to deduplicate concurrent requests
 * - Path Normalization: Absolute paths as cache keys prevent ambiguity
 * - Facade Wrapping: Wrap parser output before caching for stable interface
 * - Error Recovery: Failed parses removed from cache to allow retry
 */
class ParsedFileCache {
  private cache: Map<string, Promise<ParsedDocument>>  // Pattern: Promise cache
  private parser: MarkdownParser                        // Pattern: Dependency injection

  constructor(markdownParser: MarkdownParser) {
    // Pattern: Initialize empty cache on construction
    // Decision: Use Map for O(1) lookup performance
  }

  async resolveParsedFile(filePath: string): Promise<ParsedDocument> {
    // Pattern: Path normalization for consistent keys
    // Integration: resolve() + normalize() converts relative to absolute
    const cacheKey = resolve(normalize(filePath))

    // Decision Point: Cache hit or miss?
    if (this.cache.has(cacheKey)) {
      // Pattern: Return cached Promise (may be pending or resolved)
      // Benefit: Concurrent requests await same Promise (deduplication)
      return this.cache.get(cacheKey)
    }

    // Pattern: Cache miss - create parse operation
    const parsePromise = this.parser.parseFile(cacheKey)

    // Pattern: Facade wrapping before caching
    // Decision: Transform ParserOutput → ParsedDocument in Promise chain
    const parsedDocPromise = parsePromise.then(
      (output: ParserOutput) => new ParsedDocument(output)
    )

    // Pattern: Store Promise IMMEDIATELY (before await)
    // Critical: Prevents duplicate parses for concurrent requests
    this.cache.set(cacheKey, parsedDocPromise)

    // Pattern: Error recovery - cleanup failed promises
    // Decision: Remove from cache to allow retry on next request
    parsedDocPromise.catch(() => {
      this.cache.delete(cacheKey)
    })

    return parsedDocPromise
  }
}
```

## Testing Strategy

Tests for the `ParsedFileCache` must validate its core caching logic and its correct interaction with its dependencies.

**TypeScript Testing Notes:**
- Test files use `.test.ts` extension with Vitest
- Imports must reference compiled output: `import { ParsedFileCache } from "../../dist/ParsedFileCache.js"`
- Mock MarkdownParser using Vitest's `vi.fn()` for dependency injection
- All test files follow Epic 3 TypeScript conversion standards (see `scripts/validate-typescript-conversion.js`)
- Type safety validated at compile time and runtime

### Test Coverage Patterns

**Cache Hit/Miss Logic** - Validate single parse per file:
- Test parser called once when same file requested multiple times
- Verify returned instances are identical (same Promise resolution)
- Validate path normalization (relative/absolute paths treated as same key)

**Error Handling** - Validate error propagation and retry behavior:
- Test parser errors propagate to caller
- Verify failed Promises removed from cache (allows retry)
- Validate retry attempt calls parser again (no stale error caching)

**Concurrent Request Deduplication** - Validate Promise-based concurrency control:
- Test multiple concurrent requests for same file
- Verify parser called once (not N times for N concurrent requests)
- Validate all concurrent callers receive same Promise (identity check)

**Facade Wrapping** - Validate ParsedDocument integration:
- Test cache returns ParsedDocument instances (not raw ParserOutput)
- Verify facade wrapping happens before caching
- Validate facade methods available on cached results

### Test File Locations

**Source of Truth**: Actual test implementations in:
- Unit tests: `test/unit/ParsedFileCache.test.ts`
- Integration tests: `test/integration/ParsedFileCache-integration.test.ts`

**See actual tests for implementation details** - this guide documents WHAT to test and WHY, test files show HOW.

---

## Technical Debt

```github-query
outputType: table
queryType: issue
org: WesleyMFrederick
repo: cc-workflows
query: "is:issue label:component:ParsedFileCache"
sort: number
direction: asc
columns: [number, status, title, labels, created, updated]
```

---
