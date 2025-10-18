# ParsedDocument Implementation Guide

This guide provides the Level 4 (Code) details for the **`ParsedDocument`** facade, which will be implemented as part of User Story 1.7.

## Problem

Consumers like the `CitationValidator` are tightly coupled to the internal structure of the `MarkdownParser.Output.DataContract`. This makes the `CitationValidator` complex, forces it to contain data-querying logic, and makes any future change to the parser's output a breaking change for all consumers.

## Solution

The **`ParsedDocument`** facade is a wrapper class that encapsulates the raw `MarkdownParser.Output.DataContract`. It provides a stable, method-based API for querying links, anchors, and content, hiding the complex internal data structures from all consumers. This simplifies consumer logic and isolates the system from future changes to the underlying parser.

## Structure

The `ParsedFileCache` is responsible for creating `ParsedDocument` instances. Consumers like `CitationValidator` and the future `ContentExtractor` will depend on the `ParsedDocument` interface for all data access.

```mermaid
classDiagram
    direction LR

    class ParsedFileCache {
        +resolveParsedFile(filePath): Promise~ParsedDocument~
    }

    class ParsedDocument {
        <<Facade>>
        -data: MarkdownParserOutputDataContract
        +hasAnchor(anchorId): boolean
        +findSimilarAnchors(anchorId): string
        +getLinks(): Link[]
        +extractSection(headingText): string
        +extractBlock(anchorId): string
        +extractFullContent(): string
    }

    class CitationValidator {
        +validateFile(filePath)
    }

    class ContentExtractor {
        +extract(link)
    }

    class MarkdownParserOutputDataContract {
        +filePath: string
        +content: string
        +links: Link[]
        +anchors: Anchor[]
        +tokens: object[]
    }

    ParsedFileCache --> ParsedDocument : creates and returns
    CitationValidator --> ParsedDocument : uses
    ContentExtractor --> ParsedDocument : uses
    ParsedDocument o-- MarkdownParserOutputDataContract : wraps
```

1. [MarkdownParser.Output.DataContract](Markdown%20Parser%20Implementation%20Guide.md#Data%20Contracts): The raw data object being wrapped
2. **ParsedDocument**: The facade providing query methods (this guide)
3. [CitationValidator](CitationValidator%20Implementation%20Guide.md): Consumer using anchor/link query methods
4. [Citation Manager.Content Extractor](../features/20251003-content-aggregation/content-aggregation-architecture.md#==Citation%20Manager.Content%20Extractor==): Future Epic 2 consumer using content extraction methods

## Public Contracts

### Input Contract
1. **`parserOutput`** (object): A complete `MarkdownParser.Output.DataContract` object produced by the `MarkdownParser`.

### Output Contract (Public Methods)
The facade exposes a set of query methods for consumers.

#### Anchor Queries
- **`hasAnchor(anchorId: string): boolean`**: Returns `true` or `false` if an anchor ID exists in the document. This method encapsulates all complex matching logic, including direct, URL-decoded, and flexible markdown matching.
- **`findSimilarAnchors(anchorId: string): string`**: Returns a formatted suggestion string (e.g., "Did you mean...") when an anchor is not found, encapsulating all suggestion-generation logic.

#### Link Queries
- **`getLinks(): LinkObject[]`**: Returns the full array of `LinkObject`s from the document for consumers that need to iterate over all links.

#### Content Extraction
- **`extractSection(headingText: string): string`**: Returns the string content for a specific section by encapsulating the complex token-walking logic.
- **`extractBlock(anchorId: string): string`**: Returns the string content for a specific block reference (e.g., `^my-block-id`).
- **`extractFullContent(): string`**: A simple getter that returns the entire raw content of the document as a string.

## Pseudocode

This pseudocode follows the **MEDIUM-IMPLEMENTATION** abstraction level, showing the core facade pattern and query method implementations.

```tsx
// The ParsedDocument class, providing a stable query interface over parser output
class ParsedDocument is
  private field _data: MarkdownParser.Output.DataContract
  private field _cachedAnchorIds: string[] = null
  private field _cachedBlockAnchors: Anchor[] = null
  private field _cachedHeaderAnchors: Anchor[] = null
  private field _cachedCrossDocumentLinks: Link[] = null

  // Constructor accepts and wraps the raw parser output
  constructor ParsedDocument(parserOutput: MarkdownParser.Output.DataContract) is
    // Encapsulation: Store raw data privately, never expose directly
    this._data = parserOutput

  // === PUBLIC METHODS ===

  // --- Anchor Queries ---

  // Check if an anchor exists using direct and flexible matching
  public method hasAnchor(anchorId: string): boolean is
    // Logic: Checks both raw `id` and `urlEncodedId` for a direct match.
    // This is the primary, high-performance method for validation.
    return this._data.anchors.some(anchor =>
      anchor.id == anchorId || anchor.urlEncodedId == anchorId
    )

  // Find anchors similar to a given anchor ID for generating suggestions
  public method findSimilarAnchors(anchorId: string): string[] is
    // Complexity Encapsulation: Hides the fuzzy matching algorithm from consumers.
    field allIds = this._getAnchorIds()
    return this._fuzzyMatch(anchorId, allIds)

  // --- Link Queries ---

  // Get all links found in the document
  public method getLinks(): Link[] is
    return this._data.links

  // --- Content Extraction (for Epic 2) ---

  // Get the entire raw content of the document as a string
  public method extractFullContent(): string is
    return this._data.content

  // Extract content for a specific section (stubbed for US 1.7)
  public method extractSection(headingText: string): string | null is
    // Token Navigation Complexity will be encapsulated here in Epic 2.
    throw new Error("Not implemented - full implementation in Epic 2")

  // Extract content for a specific block reference (stubbed for US 1.7)
  public method extractBlock(anchorId: string): string | null is
    // Line-based lookup logic will be encapsulated here in Epic 2.
    throw new Error("Not implemented - full implementation in Epic 2")


  // === INTERNAL (PRIVATE) HELPERS ===

  // Get all anchor IDs, including both id and urlEncodedId variants, for fuzzy matching
  private method _getAnchorIds(): string[] is
    // Performance: Lazy-loads and caches the result on the first call
    if (this._cachedAnchorIds == null) then
      field ids = new Set<string>()
      foreach (anchor in this._data.anchors) do
        ids.add(anchor.id)
        // Include urlEncodedId if it's different from the raw id
        if (anchor.urlEncodedId && anchor.urlEncodedId != anchor.id) then
          ids.add(anchor.urlEncodedId)
      this._cachedAnchorIds = Array.from(ids)
    return this._cachedAnchorIds

  // Get all block-level anchors, cached for performance
  private method _getBlockAnchors(): Anchor[] is
    if (this._cachedBlockAnchors == null) then
      this._cachedBlockAnchors = this._data.anchors.filter(a => a.anchorType == "block")
    return this._cachedBlockAnchors

  // Get all header-level anchors, cached for performance
  private method _getHeaderAnchors(): Anchor[] is
    if (this._cachedHeaderAnchors == null) then
        this._cachedHeaderAnchors = this._data.anchors.filter(a => a.anchorType == "header")
    return this._cachedHeaderAnchors

  // Fuzzy matching implementation to find similar strings
  private method _fuzzyMatch(target: string, candidates: string[]): string[] is
    // Implementation: Uses Levenshtein distance for similarity calculation
    field matches = new array of object
    foreach (candidate in candidates) do
      field similarity = this._calculateSimilarity(target, candidate)
      if (similarity > 0.3) then  // 30% similarity threshold for higher recall
        matches.add({ candidate: candidate, score: similarity })

    matches.sort((a, b) => b.score - a.score)
    return matches.map(m => m.candidate).slice(0, 5) // Return top 5 suggestions

  // Levenshtein distance similarity calculation
  private method _calculateSimilarity(str1: string, str2: string): number is
    // Implementation: Full Levenshtein distance algorithm with case-insensitive comparison
    // Edge cases: identical strings return 1.0, empty strings return 0.0
    // Algorithm: Dynamic programming matrix for edit distance calculation
    // Normalization: Distance normalized by max string length: 1 - (distance / maxLength)
    // Returns a value between 0 (completely different) and 1 (identical)
    // Actual implementation in ParsedDocument.js lines 180-219
```

## Method Contracts

### Anchor Query Methods

#### `getAnchorIds(): string[]`
- **Purpose**: Get all available anchor IDs in the document
- **Returns**: Array of strings containing both `id` and `urlEncodedId` (when different)
- **Caching**: Result cached after first call for performance
- **Example**: `["Story 1.7: Implementation", "Story%201.7%20Implementation", "FR1", "header-name"]`

#### `hasAnchor(anchorId: string): boolean`
- **Purpose**: Check if specific anchor exists in document
- **Parameters**: `anchorId` - Anchor ID to check (raw or URL-encoded format)
- **Returns**: `true` if anchor found, `false` otherwise
- **Logic**: Checks both `anchor.id` and `anchor.urlEncodedId` for match
- **Example**: `hasAnchor("Story 1.7: Implementation")` → `true`

#### `getBlockAnchors(): Anchor[]` - **Epic 2 - Not Implemented in US1.7**
- **Purpose**: Get all block-type anchors (caret syntax: `^anchor-id`)
- **Returns**: Array of anchor objects with `anchorType === "block"`
- **Status**: Cache field `_cachedBlockAnchors` exists but helper method not implemented
- **Example**: `[{ anchorType: "block", id: "FR1", ... }]`

#### `getHeaderAnchors(): Anchor[]` - **Epic 2 - Not Implemented in US1.7**
- **Purpose**: Get all header-type anchors (from headings)
- **Returns**: Array of anchor objects with `anchorType === "header"`
- **Status**: Cache field `_cachedHeaderAnchors` exists but helper method not implemented
- **Example**: `[{ anchorType: "header", id: "Overview", urlEncodedId: "Overview", ... }]`

#### `findSimilarAnchors(anchorId: string): string[]`
- **Purpose**: Find anchors similar to given anchor ID (fuzzy matching for suggestions)
- **Parameters**: `anchorId` - Target anchor ID to find matches for
- **Returns**: Array of similar anchor IDs sorted by similarity score (max 5 results)
- **Algorithm**: Levenshtein distance with 0.3 threshold (30% similarity)
- **Example**: `findSimilarAnchors("Story 1.7")` → `["Story 1.7: Implementation", "Story 1.6"]`

**Design Note**: The 0.3 threshold (30% similarity) was chosen to provide higher recall (more suggestions) for partial anchor queries. This lower threshold compared to typical fuzzy matching (50-60%) accommodates common user patterns like typing partial anchor text during citation creation.

### Link Query Methods

#### `getLinks(): Link[]`
- **Purpose**: Get all links in the document
- **Returns**: Array of all link objects
- **Example**: `[{ linkType: "markdown", scope: "cross-document", ... }]`
- **Note**: Returns direct reference to internal array for performance. Consumers should not mutate returned values.

### Content Extraction Methods

#### `extractFullContent(): string`
- **Purpose**: Get complete file content
- **Returns**: Full content string from `_data.content`
- **Use Case**: Full-file extraction for Epic 2
- **Note**: Returns direct reference to internal string for performance. Consumers should not mutate returned values.

#### `extractSection(headingText: string): string | null`
- **Purpose**: Extract content under specific heading
- **Parameters**: `headingText` - Heading text to extract section for
- **Returns**: Section content string or `null` if heading not found
- **Implementation**: US1.7 stub, full implementation in Epic 2
- **Example**: `extractSection("Overview")` → content between Overview and next same-level heading

#### `extractBlock(anchorId: string): string | null`
- **Purpose**: Extract content for specific block anchor
- **Parameters**: `anchorId` - Block anchor ID (e.g., "FR1")
- **Returns**: Block content string or `null` if anchor not found
- **Implementation**: US1.7 stub, full implementation in Epic 2
- **Example**: `extractBlock("FR1")` → line containing `^FR1` anchor

## Testing Strategy

Tests for the `ParsedDocument` facade must validate that each query method correctly transforms and filters the internal data structures.

### Test Structure

```tsx
// Test pattern: BDD-style behavioral validation for the public facade methods
describe("ParsedDocument", () => {

  // Test anchor existence check, which is a primary public method
  it("hasAnchor should correctly validate existence using both id and urlEncodedId", () => {
    // Given: A ParsedDocument with an anchor that has two ID formats
    const parserOutput = {
      anchors: [
        { anchorType: "header", id: "Test Header", urlEncodedId: "Test%20Header" }
      ]
    };
    const parsedDoc = new ParsedDocument(parserOutput);

    // When/Then: The hasAnchor method should return true for both ID formats
    expect(parsedDoc.hasAnchor("Test Header")).toBe(true);
    expect(parsedDoc.hasAnchor("Test%20Header")).toBe(true);
    expect(parsedDoc.hasAnchor("NonExistent")).toBe(false);
  });

  // Test the public method for generating suggestions
  it("findSimilarAnchors should return a sorted list of suggested matches", () => {
    // Given: A ParsedDocument with several anchors
    const parserOutput = {
      anchors: [
        { id: "Story 1.7: Implementation", urlEncodedId: null },
        { id: "Story 1.6: Refactoring", urlEncodedId: null },
        { id: "Story 2.1: New Feature", urlEncodedId: null }
      ]
    };
    const parsedDoc = new ParsedDocument(parserOutput);

    // When: findSimilarAnchors() is called with a partial or misspelled ID
    const suggestions = parsedDoc.findSimilarAnchors("Story 1.7");

    // Then: It returns a list of potential matches, sorted by relevance
    expect(suggestions[0]).toBe("Story 1.7: Implementation");
    expect(suggestions).toContain("Story 1.6: Refactoring");
  });

  // Test the public method for retrieving all links
  it("getLinks should return the complete array of link objects", () => {
    // Given: A ParsedDocument with a known set of links
    const mockLinks = [
      { scope: "cross-document", target: { path: { raw: "other.md" } } },
      { scope: "internal", target: { anchor: "section" } }
    ];
    const parserOutput = { links: mockLinks };
    const parsedDoc = new ParsedDocument(parserOutput);

    // When: getLinks() is called
    const links = parsedDoc.getLinks();

    // Then: It returns the exact array of link objects
    expect(links).toHaveLength(2);
    expect(links).toEqual(mockLinks);
  });

  // Test the public method for full content extraction
  it("extractFullContent should return the complete, raw content string", () => {
    // Given: A ParsedDocument with a known content string
    const mockContent = "# Test Document\n\nThis is test content.";
    const parserOutput = { content: mockContent };
    const parsedDoc = new ParsedDocument(parserOutput);

    // When: extractFullContent() is called
    const content = parsedDoc.extractFullContent();

    // Then: It returns the exact content string
    expect(content).toBe(mockContent);
  });

  // Test stubs for future Epic 2 methods to ensure they exist on the interface
  it("extractSection should throw a 'Not Implemented' error for US 1.7", () => {
    // Given: A ParsedDocument instance
    const parsedDoc = new ParsedDocument({ tokens: [] });

    // When/Then: Calling the stubbed method should throw an error
    expect(() => parsedDoc.extractSection("any")).toThrow("Not implemented");
  });

  it("extractBlock should throw a 'Not Implemented' error for US 1.7", () => {
    // Given: A ParsedDocument instance
    const parsedDoc = new ParsedDocument({ anchors: [] });

    // When/Then: Calling the stubbed method should throw an error
    expect(() => parsedDoc.extractBlock("any")).toThrow("Not implemented");
  });
});
```

## Epic 2 Content Extraction Methods

The `extractSection()` and `extractBlock()` methods are stubbed in US1.7 and will be fully implemented in Epic 2. Here's the planned implementation approach:

### Section Extraction Algorithm
1. Get heading tokens from `_data.tokens`
2. Find target heading by matching `headingText`
3. Collect all tokens between target heading and next same-or-higher level heading
4. Convert token range to content string using line numbers
5. Return extracted content or null if heading not found

### Block Extraction Algorithm
1. Find anchor in `_data.anchors` by `anchorId`
2. Use anchor's `line` property to locate content
3. Extract line content containing block anchor
4. Return extracted content or null if anchor not found

## Known Limitations (US1.7)

### Incomplete Facade Encapsulation for Advanced Queries

**Status**: Technical debt created by US1.7, resolution planned for Epic 2

**Issue**: CitationValidator helper methods require direct `_data.anchors` access for metadata-dependent operations:
- Line 528: `suggestObsidianBetterFormat()` needs anchor objects with `anchorType` and `rawText` properties
- Line 560: `findFlexibleAnchorMatch()` needs anchor objects with `rawText` for markdown-aware matching
- Lines 570-578: Suggestion generation needs anchor objects filtered by type

**Missing Facade Methods**:
- `getHeaderAnchors(): AnchorObject[]` - Return header anchor objects with metadata
- `getBlockAnchors(): AnchorObject[]` - Return block anchor objects with metadata
- `getAnchorByIdWithMetadata(anchorId): AnchorObject|null` - Return full anchor object

**Impact**: Primary validation fully decoupled via `hasAnchor()` and `findSimilarAnchors()` methods, but error reporting and advanced matching still coupled to internal anchor schema.

**Workaround**: Helper methods access `parsedDoc._data.anchors` directly until facade extended in Epic 2.

**Resolution**: Epic 2 will extend facade with metadata-aware query methods to eliminate remaining coupling.

## Design Notes

**Encapsulation Benefits**:
- All direct access to `_data` is private - consumers cannot bypass facade
- Fuzzy matching complexity hidden in `_fuzzyMatch()` private method
- Token navigation complexity will be hidden in extraction methods (Epic 2)

**Performance Optimization**:
- Lazy-load and cache anchor IDs on first call
- Future: Consider caching other frequently-accessed queries

**Extension Strategy**:
- New query methods can be added without modifying existing methods
- Consumers only depend on methods they use, not entire interface

**Testing Approach**:
- Unit tests validate each query method independently
- Integration tests validate CitationValidator and ContentExtractor usage
- Use real parser output fixtures from test/fixtures/

## Integration with Existing Components

### ParsedFileCache Integration
The `ParsedFileCache` wraps parser output in `ParsedDocument` before caching:

```javascript
const parsePromise = this.markdownParser.parseFile(filePath)
const parsedDocPromise = parsePromise.then(contract =>
  new ParsedDocument(contract)
)
this.cache.set(cacheKey, parsedDocPromise)
```

### CitationValidator Integration
The `CitationValidator` uses facade methods instead of direct data access:

```javascript
// Before US1.7:
const anchorExists = parsed.anchors.some(a => a.id === anchor)

// After US1.7:
const anchorExists = parsedDoc.hasAnchor(anchor)
```

### ContentExtractor Integration (Epic 2)
The future `ContentExtractor` will use extraction methods:

```javascript
const section = parsedDoc.extractSection(headingText)
const block = parsedDoc.extractBlock(anchorId)
const fullContent = parsedDoc.extractFullContent()
```
