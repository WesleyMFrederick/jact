---
title: "User Story 1.7: Implement ParsedDocument Facade"
feature-title: Citation Manager Content Aggregation
epic-number: 1
epic-name: Citation Manager Test Migration & Content Aggregation
epic-url: ../../content-aggregation-prd.md#Epic%20Citation%20Manager%20Test%20Migration%20&%20Content%20Aggregation
user-story-number: 1.7
status: Done
---

# Story 1.7: Implement ParsedDocument Facade

<critical-llm-Initialization-Instructions>
When first reading this file, you MUST IMMEDIATELY run citation manager to extract base paths: `npm run citation:base-paths "this-file-path" -- --format json`. Read ALL discovered base path files to gather complete architectural context before proceeding.
</critical-llm-Initialization-Instructions>

## Story

**As a** developer,
**I want** a ParsedDocument wrapper class that encapsulates parser output navigation,
**so that** consumers (CitationValidator, ContentExtractor) depend on stable interfaces instead of internal data structures.

_Source: [Story 1.7: Implement ParsedDocument Facade](../../content-aggregation-prd.md#Story%201.7%20Implement%20ParsedDocument%20Facade)_

## Acceptance Criteria

1. The `ParsedDocument` class SHALL wrap the `MarkdownParser.Output.DataContract` and expose a public interface with query methods, encapsulating direct data structure access. ^US1-7AC1
2. The `ParsedDocument` class's public interface SHALL provide anchor query methods for consumers: `hasAnchor(anchorId)` and `findSimilarAnchors(anchorId)`. Internal helper methods for filtering and listing anchors are not part of the public contract. ^US1-7AC2
3. The `ParsedDocument` class SHALL provide content extraction methods: `extractSection(headingText)`, `extractBlock(anchorId)`, and `extractFullContent()` for `ContentExtractor` use cases (Epic 2). ^US1-7AC3
4. The `ParsedDocument` class's public interface SHALL provide a `getLinks()` method for `CitationValidator` use cases, returning all link objects found in the document. ^US1-7AC4
5. `CitationValidator` SHALL be refactored to use the public `ParsedDocument` methods instead of direct data structure access. ^US1-7AC5
6. `ParsedFileCache` SHALL be updated to return `ParsedDocument` instances instead of raw parser output objects. ^US1-7AC6
7. GIVEN the `ParsedDocument` facade is implemented and `CitationValidator` refactored, WHEN the full test suite executes, THEN all existing tests SHALL pass with zero behavioral changes. ^US1-7AC7
8. The component SHALL include unit tests validating each **public** query method's correct transformation of internal data structures into expected return values. ^US1-7AC8

_Source: [Story 1.7 Acceptance Criteria](../../content-aggregation-prd.md#Story%201.7%20Acceptance%20Criteria)_

## Technical Debt Resolution

**Closes Technical Debt**:
- Tight coupling to parser internals: Eliminates direct access to `MarkdownParser.Output.DataContract` internal data structures across consumer components
- Duplicate navigation logic across consumers: Consolidates anchor and link navigation logic into single facade component

## Dev Notes

### Architectural Context (C4)

This story introduces the ParsedDocument facade pattern to establish a stable interface layer between the MarkdownParser and its consumers (CitationValidator, future ContentExtractor). This prevents tight coupling to parser internals and enables safe refactoring of the underlying data contract.

**Architectural Rationale** (from PRD Technical Lead Feedback):
> Introduce ParsedDocument wrapper class before implementing ContentExtractor to prevent tight coupling to parser internals. With two consumers (CitationValidator and ContentExtractor), the facade pays for itself immediately.
>
> Benefits: Interface stability, refactoring safety, encapsulation of complexity (especially token navigation), and parser independence (can swap marked.js for micromark without breaking consumers).

- **Components Affected**:
  - [ParsedDocument](../../content-aggregation-architecture.md#Citation%20Manager.ParsedDocument) (NEW) - Facade wrapping MarkdownParser.Output.DataContract with query methods
  - [ParsedFileCache](../../content-aggregation-architecture.md#Citation%20Manager.ParsedFileCache) (MODIFIED) - Return ParsedDocument instances instead of raw parser output
  - [CitationValidator](../../content-aggregation-architecture.md#Citation%20Manager.Citation%20Validator) (MODIFIED) - Refactor to use ParsedDocument methods instead of direct data access
  - [MarkdownParser](../../content-aggregation-architecture.md#Citation%20Manager.Markdown%20Parser) (INTEGRATION) - Output consumed by ParsedDocument constructor

- **Implementation Guides**:
  - [ParsedDocument Implementation Guide](../../../../component-guides/ParsedDocument%20Implementation%20Guide.md) (TO BE CREATED) - Facade interface specification and method contracts
  - [ParsedFileCache Implementation Guide](../../../../component-guides/ParsedFileCache%20Implementation%20Guide.md) - Cache integration with ParsedDocument wrapper
  - [CitationValidator Implementation Guide](../../../../component-guides/CitationValidator%20Implementation%20Guide.md) - Refactoring patterns for facade consumption

### Files Impacted

- `tools/citation-manager/src/ParsedDocument.js` (CREATE) - New facade class wrapping MarkdownParser.Output.DataContract
- `tools/citation-manager/src/ParsedFileCache.js` (MODIFY) - Update `resolveParsedFile()` to return ParsedDocument instances
- `tools/citation-manager/src/CitationValidator.js` (MODIFY) - Refactor anchor/link navigation to use ParsedDocument methods
- `tools/citation-manager/test/parsed-document.test.js` (CREATE) - Unit tests for all ParsedDocument query methods
- `tools/citation-manager/test/integration/citation-validator-parsed-document.test.js` (CREATE) - Integration tests validating CitationValidator works with ParsedDocument facade
- `tools/citation-manager/design-docs/component-guides/ParsedDocument Implementation Guide.md` (CREATE) - Facade interface specification and usage patterns

### Current Architecture (Pre-US1.7)

#### Problem: Tight Coupling to Parser Internals

Currently, CitationValidator directly accesses the MarkdownParser.Output.DataContract internal data structures, creating tight coupling:

```javascript
// tools/citation-manager/src/CitationValidator.js (BEFORE)
// Direct access to parser output internals

async validateAnchorExists(anchor, targetFile) {
  const parsed = await this.parsedFileCache.resolveParsedFile(targetFile);

  // PROBLEM 1: Direct access to internal data structure
  const anchorIds = parsed.anchors.map(a => a.id);
  const urlEncodedIds = parsed.anchors.map(a => a.urlEncodedId);

  // PROBLEM 2: Duplicate navigation logic (will be repeated in ContentExtractor)
  const anchorExists = parsed.anchors.some(anchorObj =>
    anchorObj.id === anchor || anchorObj.urlEncodedId === anchor
  );

  if (anchorExists) {
    return { valid: true };
  } else {
    // PROBLEM 3: Complex fuzzy matching logic coupled to internal structure
    const suggestion = this.generateAnchorSuggestions(anchor, parsed.anchors);
    return { valid: false, suggestion };
  }
}
```

**Impact**:
- **Tight Coupling**: CitationValidator breaks if `MarkdownParser.Output.DataContract` schema changes
- **Duplicate Logic**: ContentExtractor (Epic 2) will duplicate same navigation patterns
- **Refactoring Risk**: Changing parser output structure requires updating all consumers
- **Complexity Leak**: Token navigation complexity exposed to all consumers
- **Test Fragility**: Tests break when internal data contract changes

_Source: [Content Aggregation PRD - Technical Lead Feedback](../../content-aggregation-prd.md#Story%201.7%20Implement%20ParsedDocument%20Facade)_

### Target Architecture (Post-US1.7)

#### Solution: Facade Pattern with Stable Query Interface

The ParsedDocument facade encapsulates all parser output navigation behind a stable interface:

```javascript
// tools/citation-manager/src/ParsedDocument.js (NEW)
/**
 * Facade providing stable query interface over MarkdownParser.Output.DataContract
 * Encapsulates internal data structure access and navigation complexity
 */
class ParsedDocument {
  constructor(parserOutput) {
    this._data = parserOutput; // Private: consumers never access directly
    // Lazy-loaded caches for performance optimization
    this._cachedAnchorIds = null;
    this._cachedBlockAnchors = null;
    this._cachedHeaderAnchors = null;
  }

  // === PUBLIC METHODS ===

  // --- Anchor Query Methods (AC2) ---

  /**
   * Check if anchor exists (checks both id and urlEncodedId)
   * @param {string} anchorId - Anchor ID to check
   * @returns {boolean} True if anchor exists
   */
  hasAnchor(anchorId) {
    return this._data.anchors.some(a =>
      a.id === anchorId || a.urlEncodedId === anchorId
    );
  }

  /**
   * Find anchors similar to given anchor ID (fuzzy matching for suggestions)
   * @param {string} anchorId - Anchor ID to find similar matches for
   * @returns {string[]} Array of similar anchor IDs sorted by similarity score
   */
  findSimilarAnchors(anchorId) {
    // Encapsulates fuzzy matching complexity
    const allIds = this._getAnchorIds();
    return this._fuzzyMatch(anchorId, allIds);
  }

  // --- Link Query Methods (AC4) ---

  /**
   * Get all links
   * @returns {LinkObject[]} Array of all link objects
   */
  getLinks() {
    return this._data.links;
  }

  // --- Content Extraction Methods (AC3) ---

  /**
   * Extract full file content
   * @returns {string} Full content of parsed file
   */
  extractFullContent() {
    return this._data.content;
  }

  /**
   * Extract section content by heading text
   * @param {string} headingText - Heading text to extract section for
   * @returns {string|null} Section content or null if not found
   */
  extractSection(headingText) {
    // Token navigation complexity encapsulated here
    // Implementation deferred to Epic 2
    throw new Error("Not implemented - Epic 2");
  }

  /**
   * Extract block content by anchor ID
   * @param {string} anchorId - Block anchor ID
   * @returns {string|null} Block content or null if not found
   */
  extractBlock(anchorId) {
    // Token navigation complexity encapsulated here
    // Implementation deferred to Epic 2
    throw new Error("Not implemented - Epic 2");
  }

  // === PRIVATE HELPERS ===
  // Internal methods for filtering and caching - NOT part of public contract

  /**
   * Get all anchor IDs (both id and urlEncodedId variants)
   * Lazy-loaded and cached for performance
   * @private
   * @returns {string[]} Array of all anchor IDs
   */
  _getAnchorIds() {
    if (this._cachedAnchorIds === null) {
      const ids = new Set();
      for (const anchor of this._data.anchors) {
        ids.add(anchor.id);
        if (anchor.urlEncodedId && anchor.urlEncodedId !== anchor.id) {
          ids.add(anchor.urlEncodedId);
        }
      }
      this._cachedAnchorIds = Array.from(ids);
    }
    return this._cachedAnchorIds;
  }

  /**
   * Get all block anchors (lazy-loaded and cached)
   * @private
   * @returns {AnchorObject[]} Array of block anchor objects
   */
  _getBlockAnchors() {
    if (this._cachedBlockAnchors === null) {
      this._cachedBlockAnchors = this._data.anchors.filter(a => a.anchorType === "block");
    }
    return this._cachedBlockAnchors;
  }

  /**
   * Get all header anchors (lazy-loaded and cached)
   * @private
   * @returns {AnchorObject[]} Array of header anchor objects
   */
  _getHeaderAnchors() {
    if (this._cachedHeaderAnchors === null) {
      this._cachedHeaderAnchors = this._data.anchors.filter(a => a.anchorType === "header");
    }
    return this._cachedHeaderAnchors;
  }

  /**
   * Fuzzy matching implementation to find similar strings
   * @private
   * @param {string} target - Target string to match
   * @param {string[]} candidates - Array of candidate strings
   * @returns {string[]} Array of similar strings sorted by similarity (top 5)
   */
  _fuzzyMatch(target, candidates) {
    const matches = [];
    for (const candidate of candidates) {
      const similarity = this._calculateSimilarity(target, candidate);
      if (similarity > 0.6) { // Example threshold
        matches.push({ candidate, score: similarity });
      }
    }
    matches.sort((a, b) => b.score - a.score);
    return matches.map(m => m.candidate).slice(0, 5);
  }

  /**
   * Calculate string similarity (placeholder for Levenshtein distance)
   * @private
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} Similarity score between 0 and 1
   */
  _calculateSimilarity(str1, str2) {
    // Placeholder: Real implementation would use Levenshtein distance
    return 0.0;
  }
}

export default ParsedDocument;
```

**CitationValidator Integration** ([[#^US1-7AC5|AC5]]):

```javascript
// tools/citation-manager/src/CitationValidator.js (AFTER)

// Primary validation method using ParsedDocument facade
async validateFile(filePath) {
  // Get source document wrapped in facade
  const sourceParsedDoc = await this.parsedFileCache.resolveParsedFile(filePath);

  const validationPromises = [];
  // BENEFIT 1: Use facade method instead of direct array access
  for (const link of sourceParsedDoc.getLinks()) {
    validationPromises.push(this.validateSingleLink(link));
  }

  const results = await Promise.all(validationPromises);
  return this.generateSummary(results);
}

// Anchor validation using facade query methods
async validateAnchorExists(link) {
  try {
    // Get target document wrapped in facade
    const targetParsedDoc = await this.parsedFileCache.resolveParsedFile(
      link.target.path.absolute
    );

    // BENEFIT 2: Clean interface - no direct data structure access
    if (targetParsedDoc.hasAnchor(link.target.anchor)) {
      return { status: "valid" };
    } else {
      // BENEFIT 3: Encapsulated complexity - fuzzy matching hidden
      const suggestions = targetParsedDoc.findSimilarAnchors(link.target.anchor);
      return {
        status: "error",
        error: "Anchor not found",
        suggestion: suggestions[0] // Top match from sorted array
      };
    }
  } catch (error) {
    return { status: "error", error: error.message };
  }
}
```

**ParsedFileCache Integration** ([[#^US1-7AC6|AC6]]):

```javascript
// tools/citation-manager/src/ParsedFileCache.js (MODIFIED)
async resolveParsedFile(filePath) {
  // Validation: Ensure valid file path provided
  if (!filePath) {
    throw new Error("File path cannot be null or empty.");
  }

  // Normalize path for consistent cache keys
  const cacheKey = this._normalizePath(filePath);

  // Cache hit: Return existing ParsedDocument instance
  if (this.cache.has(cacheKey)) {
    return this.cache.get(cacheKey);
  }

  // Cache miss: Parse file and wrap in facade
  const parsePromise = this.markdownParser.parseFile(cacheKey);

  // CHANGE: Wrap parser output in ParsedDocument facade before caching
  const parsedDocPromise = parsePromise.then(contract =>
    new ParsedDocument(contract)
  );

  // Store the Promise immediately to handle concurrent requests
  this.cache.set(cacheKey, parsedDocPromise);

  // Error handling: Remove failed parse from cache for retry
  parsedDocPromise.catch(() => {
    this.cache.delete(cacheKey);
  });

  return parsedDocPromise;
}
```

**Benefits**:
- **Stable Interface**: Parser output structure changes don't break consumers
- **Single Navigation Logic**: All anchor/link navigation consolidated in one place
- **Refactoring Safety**: Can change parser output structure safely
- **Complexity Encapsulation**: Token navigation complexity hidden from consumers
- **Test Resilience**: Consumer tests resilient to parser output changes
- **Epic 2 Foundation**: ContentExtractor can reuse same navigation methods

_Source: [Content Aggregation PRD - Technical Lead Feedback](../../content-aggregation-prd.md#Story%201.7%20Implement%20ParsedDocument%20Facade)_

### Dependencies

- **Prerequisite**: [Story 1.6: Refactor MarkdownParser.Output.DataContract - Eliminate Duplicate Anchor Entries](../../content-aggregation-prd.md#Story%201.6%20Refactor%20MarkdownParser.Output.DataContract%20-%20Eliminate%20Duplicate%20Anchor%20Entries) complete - Normalized anchor schema with dual ID properties
- **Enables**: [Story 1.8: Refactor Anchor Validation to Use Strategy Pattern](../../content-aggregation-prd.md#Story%201.8%20Refactor%20Anchor%20Validation%20to%20Use%20Strategy%20Pattern) - ParsedDocument provides stable interface for strategy implementations
- **Strategic Position**: Facade implementation before Epic 2 ContentExtractor to prevent tight coupling per [Dependency Abstraction](../../../../../../../design-docs/Architecture%20Principles.md#^dependency-abstraction) principle

### Design Principles Adherence

This story must adhere to the following [Design Principles](../../../../../../../design-docs/Architecture%20Principles.md):

**Critical Principles:**
- [**Black Box Interfaces**](../../../../../../../design-docs/Architecture%20Principles.md#^black-box-interfaces) (Modular): ParsedDocument hides internal data structure complexity behind clean query methods
- [**Dependency Abstraction**](../../../../../../../design-docs/Architecture%20Principles.md#^dependency-abstraction) (Modular): Consumers depend on ParsedDocument interface, not MarkdownParser.Output.DataContract structure
- [**Single Responsibility**](../../../../../../../design-docs/Architecture%20Principles.md#^single-responsibility) (Modular): ParsedDocument has single responsibility for parser output navigation
- [**Extension Over Modification**](../../../../../../../design-docs/Architecture%20Principles.md#^extension-over-modification) (Modular): New query methods can be added without modifying consumers

**Implementation Guidance:**
- Use TDD approach: Write facade method tests first (RED), implement methods (GREEN), refactor consumers (REFACTOR)
- Keep facade interface minimal: Only methods actually needed by current consumers (avoid speculation)
- Encapsulate complexity: All fuzzy matching, token navigation complexity lives in facade
- Maintain backward compatibility: Existing tests pass after CitationValidator refactoring

### Testing

- **Test Framework**: [Vitest](../../content-aggregation-architecture.md#Testing%20Strategy) (shared workspace framework)
- **Test Strategy**: TDD approach - facade method tests define contracts first, implementation follows, consumer refactoring validates integration
- **Test Location**: `tools/citation-manager/test/` (established in US1.4a)

#### Required Test Implementation

##### 1. ParsedDocument Facade Unit Tests (Unit Test)
- **Purpose**: Validate each **public** query method correctly transforms internal data structures
- **Acceptance Criteria**: Validates [[#^US1-7AC1|AC1]] (wraps parser output), [[#^US1-7AC2|AC2]] (anchor query methods), [[#^US1-7AC3|AC3]] (content extraction methods), [[#^US1-7AC4|AC4]] (link query methods), [[#^US1-7AC8|AC8]] (unit tests for all public methods)
- **Implementation Guidance**:
  - **Test `hasAnchor()`**: Should correctly validate existence using both `id` and `urlEncodedId` properties
    - Given: A ParsedDocument with an anchor having two ID formats
    - When/Then: `hasAnchor()` returns true for both ID formats, false for non-existent anchors
  - **Test `findSimilarAnchors()`**: Should return a sorted list of suggested matches
    - Given: A ParsedDocument with several anchors
    - When: `findSimilarAnchors()` called with partial or misspelled ID
    - Then: Returns array of potential matches sorted by relevance (top 5)
  - **Test `getLinks()`**: Should return the complete array of link objects
    - Given: A ParsedDocument with known set of links
    - When: `getLinks()` is called
    - Then: Returns exact array of link objects
  - **Test `extractFullContent()`**: Should return the complete, raw content string
    - Given: A ParsedDocument with known content string
    - When: `extractFullContent()` is called
    - Then: Returns exact content string
  - **Test Epic 2 stubs**: `extractSection()` and `extractBlock()` should throw "Not implemented" errors for US 1.7
    - Given: A ParsedDocument instance
    - When/Then: Calling stubbed methods throws error with "Not implemented" message
  - Use real parser output fixtures from `test/fixtures/` directory
  - Follow BDD Given-When-Then structure
  - **NOTE**: Internal helper methods (`_getAnchorIds()`, `_getBlockAnchors()`, `_getHeaderAnchors()`) are NOT tested directly - they are private implementation details

##### 2. CitationValidator ParsedDocument Integration Test (Integration Test)
- **Purpose**: Verify CitationValidator works correctly with ParsedDocument facade
- **Acceptance Criteria**: Validates [[#^US1-7AC5|AC5]] (CitationValidator refactored), [[#^US1-7AC7|AC7]] (zero behavioral changes)
- **Implementation Guidance**:
  - Create test fixture with various anchor types
  - Test validation succeeds when anchor exists (using ParsedDocument.hasAnchor())
  - Test validation fails with suggestions when anchor missing (using ParsedDocument.findSimilarAnchors())
  - Test validation works with both raw and URL-encoded anchor formats
  - Verify same validation behavior as pre-refactoring implementation
  - Use factory-created validator with real dependencies

##### 3. ParsedFileCache Integration Test (Integration Test)
- **Purpose**: Verify ParsedFileCache returns ParsedDocument instances
- **Acceptance Criteria**: Validates [[#^US1-7AC6|AC6]] (cache returns ParsedDocument instances)
- **Implementation Guidance**:
  - Test `resolveParsedFile()` returns ParsedDocument instance
  - Test returned instance has all expected query methods
  - Test cache hit returns same ParsedDocument instance
  - Test cache miss creates new ParsedDocument instance
  - Use factory-created cache with real dependencies

##### 4. Full Regression Test (Regression Validation)
- **Purpose**: Confirm zero behavioral changes from facade introduction and CitationValidator refactoring
- **Acceptance Criteria**: Validates [[#^US1-7AC7|AC7]] (all existing tests pass)
- **Implementation Guidance**:
  - Execute complete test suite via `npm test`
  - All existing validation tests must pass with facade integration
  - No changes to test assertions required (validation behavior unchanged)

---
### Whiteboard Summary

This story's design is heavily influenced by the "Parse Once, Query Many Times" architectural pattern observed in the `markdownlint` codebase.

- **Parse Once**: The `ParsedFileCache` ensures the expensive `MarkdownParser` is run only once per file.
- **Query Many**: The `ParsedDocument` facade will serve as an in-memory "query cache". It will use lazy-loading for internal helper methods (like `_getAnchorIds()`) to pre-compute and cache data structures (like `Set`s of anchor IDs) on their first use. Subsequent calls to public methods (`hasAnchor()`, `findSimilarAnchors()`) will leverage these cached sets for high-performance lookups, avoiding redundant iteration of the raw data.

This approach ensures the facade is not only a clean interface but also an efficient one, which is critical for handling documents with many links and anchors.

---

## Tasks / Subtasks

### Phase 1: ParsedDocument Facade Tests (RED Phase - TDD)

- [x] **1.1. Write ParsedDocument Facade Unit Tests** ^US1-7T1-1
  - **Implementation Details**: [Implementation Agent Notes](tasks/01-1-1-write-parsed-document-unit-tests-us1.7.md#Implementation%20Agent%20Notes)
    %%[tasks/01-1-1-write-parsed-document-unit-tests-us1.7.md](tasks/01-1-1-write-parsed-document-unit-tests-us1.7.md)%% %%stop-extract-link%%
  - **Agent**: test-writer
  - **Objective**: Create comprehensive unit tests for all ParsedDocument public query methods, validating correct transformation of MarkdownParser.Output.DataContract internal structures (tests will fail - RED phase)
  - **Input**: ParsedDocument pseudocode from lines 122-284, method contracts from ParsedDocument Implementation Guide
  - **Output**: Complete unit test suite for ParsedDocument facade (failing until implementation)
  - **Files**:
    - `tools/citation-manager/test/parsed-document.test.js` (create)
  - **Scope**:
    - Test `hasAnchor(anchorId)`: Validates existence using both `id` and `urlEncodedId` properties
    - Test `findSimilarAnchors(anchorId)`: Returns sorted array of suggested matches (top 5)
    - Test `getLinks()`: Returns complete array of link objects
    - Test `extractFullContent()`: Returns complete raw content string
    - Test `extractSection(headingText)`: Throws "Not implemented - Epic 2" error (stub validation)
    - Test `extractBlock(anchorId)`: Throws "Not implemented - Epic 2" error (stub validation)
    - Use real parser output fixtures from `test/fixtures/` directory
    - Follow BDD Given-When-Then comment structure
    - Tests should FAIL showing ParsedDocument class doesn't exist yet
  - **Test**: All ParsedDocument unit tests written and failing (expected - RED phase)
  - **Commands**: `npm test -- parsed-document` (expect failures)
  - _Requirements_: [[#^US1-7AC1|AC1]], [[#^US1-7AC2|AC2]], [[#^US1-7AC3|AC3]], [[#^US1-7AC4|AC4]], [[#^US1-7AC8|AC8]]
  - _Leverage_: Existing test/fixtures/, ParsedDocument Implementation Guide method contracts

- [x] **1.2. Write ParsedFileCache Integration Tests** ^US1-7T1-2
  - **Implementation Details**: [tasks/01-1-2-write-cache-integration-tests-us1.7.md](tasks/01-1-2-write-cache-integration-tests-us1.7.md)%%stop-extract-link%%
  - **Agent**: test-writer
  - **Objective**: Create integration tests validating ParsedFileCache returns ParsedDocument instances instead of raw parser output (tests will fail - RED phase)
  - **Input**: ParsedFileCache current implementation, target integration from lines 333-368
  - **Output**: Integration test suite for cache facade wrapping (failing until implementation)
  - **Files**:
    - `tools/citation-manager/test/integration/parsed-file-cache-facade.test.js` (create)
  - **Scope**:
    - Test `resolveParsedFile()` returns ParsedDocument instance (not raw contract)
    - Test returned instance has all expected query methods (hasAnchor, getLinks, etc.)
    - Test cache hit returns same ParsedDocument instance
    - Test cache miss creates new ParsedDocument instance
    - Use factory-created cache with real dependencies
    - Follow BDD Given-When-Then structure
    - Tests should FAIL showing cache returns raw contracts, not facades
  - **Test**: All cache integration tests written and failing (expected - RED phase)
  - **Commands**: `npm test -- integration/parsed-file-cache-facade` (expect failures)
  - _Requirements_: [[#^US1-7AC6|AC6]]
  - _Leverage_: Existing ParsedFileCache, factory pattern, integration test patterns

- [x] **1.3. Write CitationValidator Integration Tests** ^US1-7T1-3
  - **Implementation Details**: [tasks/01-1-3-write-validator-integration-tests-us1.7.md](tasks/01-1-3-write-validator-integration-tests-us1.7.md)%%stop-extract-link%%
  - **Agent**: test-writer
  - **Objective**: Create integration tests validating CitationValidator works correctly with ParsedDocument facade methods (tests will fail - RED phase)
  - **Input**: CitationValidator current implementation, target integration from lines 287-330
  - **Output**: Integration test suite for validator facade usage (failing until implementation)
  - **Files**:
    - `tools/citation-manager/test/integration/citation-validator-parsed-document.test.js` (create)
  - **Scope**:
    - Create test fixture with various anchor types (headers with special chars, blocks)
    - Test validation succeeds when anchor exists (using ParsedDocument.hasAnchor())
    - Test validation fails with suggestions when anchor missing (using ParsedDocument.findSimilarAnchors())
    - Test validation works with both raw and URL-encoded anchor formats
    - Verify same validation behavior as pre-refactoring implementation
    - Use factory-created validator with real dependencies
    - Follow BDD Given-When-Then structure
    - Tests should FAIL showing validator uses direct data access, not facade methods
  - **Test**: All validator integration tests written and failing (expected - RED phase)
  - **Commands**: `npm test -- integration/citation-validator-parsed-document` (expect failures)
  - _Requirements_: [[#^US1-7AC5|AC5]]
  - _Leverage_: Existing CitationValidator, factory pattern, validation test patterns

### Phase 2: ParsedDocument Implementation (GREEN Phase - TDD)

- [x] **2.1. Implement ParsedDocument Facade Class** ^US1-7T2-1
  - **Implementation Details**: [tasks/02-2-1-implement-parsed-document-facade-us1.7.md](tasks/02-2-1-implement-parsed-document-facade-us1.7.md)%%stop-extract-link%%
  - **Agent**: code-developer
  - **Objective**: Create ParsedDocument facade class wrapping MarkdownParser.Output.DataContract with query methods, making Phase 1 unit tests pass
  - **Input**: ParsedDocument pseudocode from lines 122-284, failing tests from Task 1.1
  - **Output**: Complete ParsedDocument.js implementation
  - **Files**:
    - `tools/citation-manager/src/ParsedDocument.js` (create)
  - **Scope**:
    - Create ParsedDocument class with constructor accepting MarkdownParser.Output.DataContract
    - Store contract in private `_data` field (encapsulation)
    - Implement public `hasAnchor(anchorId)`: Check both `id` and `urlEncodedId` in anchors array
    - Implement public `findSimilarAnchors(anchorId)`: Return sorted array of suggestions (use _fuzzyMatch helper)
    - Implement public `getLinks()`: Return `_data.links` array
    - Implement public `extractFullContent()`: Return `_data.content` string
    - Implement stub `extractSection(headingText)`: Throw "Not implemented - Epic 2" error
    - Implement stub `extractBlock(anchorId)`: Throw "Not implemented - Epic 2" error
    - Implement private helper `_getAnchorIds()`: Lazy-loaded cache of all anchor IDs (both variants)
    - Implement private helper `_fuzzyMatch(target, candidates)`: Levenshtein distance matching, top 5 results
    - Implement private helper `_calculateSimilarity(str1, str2)`: String similarity score (0-1)
    - Initialize lazy-load caches: `_cachedAnchorIds`, `_cachedBlockAnchors`, `_cachedHeaderAnchors`
  - **Test**: Task 1.1 unit tests pass, all public methods work correctly
  - **Commands**: `npm test -- parsed-document`
  - _Requirements_: [[#^US1-7AC1|AC1]], [[#^US1-7AC2|AC2]], [[#^US1-7AC3|AC3]], [[#^US1-7AC4|AC4]], [[#^US1-7AC8|AC8]]
  - _Leverage_: Pseudocode lines 122-284, ParsedDocument Implementation Guide

### Phase 3: Component Integration (GREEN Phase - TDD)

- [x] **3.1. Refactor ParsedFileCache to Return ParsedDocument Instances** ^US1-7T3-1
  - **Implementation Details**: [tasks/03-3-1-refactor-cache-to-return-facades-us1.7.md](tasks/03-3-1-refactor-cache-to-return-facades-us1.7.md)%%stop-extract-link%%
  - **Agent**: code-developer
  - **Objective**: Update ParsedFileCache.resolveParsedFile() to wrap parser output in ParsedDocument facade before caching, making Phase 1 cache integration tests pass
  - **Input**: ParsedFileCache.js current implementation, failing tests from Task 1.2, target integration from lines 333-368
  - **Output**: Refactored ParsedFileCache returning ParsedDocument instances
  - **Files**:
    - `tools/citation-manager/src/ParsedFileCache.js` (modify)
  - **Scope**:
    - Import ParsedDocument class
    - Update `resolveParsedFile()` method to wrap parser output: `parsePromise.then(contract => new ParsedDocument(contract))`
    - Store ParsedDocument Promise in cache (not raw contract Promise)
    - Preserve error handling: cache cleanup on parse failure
    - Preserve path normalization logic
    - Maintain all other cache behavior unchanged
    - Update JSDoc to reflect ParsedDocument return type
  - **Test**: Task 1.2 integration tests pass, cache returns ParsedDocument instances
  - **Commands**: `npm test -- integration/parsed-file-cache-facade && npm test -- parsed-file-cache`
  - _Requirements_: [[#^US1-7AC6|AC6]]
  - _Leverage_: Existing ParsedFileCache structure, integration pattern from lines 333-368

- [x] **3.2. Refactor CitationValidator to Use ParsedDocument Methods** ^US1-7T3-2
  - **Implementation Details**: [tasks/03-3-2-refactor-validator-to-use-facade-us1.7.md](tasks/03-3-2-refactor-validator-to-use-facade-us1.7.md)%%stop-extract-link%%
  - **Agent**: code-developer
  - **Objective**: Refactor CitationValidator to use ParsedDocument query methods instead of direct data structure access, making Phase 1 validator integration tests pass
  - **Input**: CitationValidator.js current implementation, failing tests from Task 1.3, target refactoring from lines 287-330
  - **Output**: Refactored CitationValidator using ParsedDocument facade
  - **Files**:
    - `tools/citation-manager/src/CitationValidator.js` (modify)
  - **Scope**:
    - Update `validateFile()`: Use `sourceParsedDoc.getLinks()` instead of direct `parsed.links` access
    - Update `validateAnchorExists()`: Use `targetParsedDoc.hasAnchor(anchor)` instead of manual array iteration
    - Update suggestion generation: Use `targetParsedDoc.findSimilarAnchors(anchor)` for fuzzy matching
    - Remove all direct access to `parsed.anchors`, `parsed.links` arrays
    - Preserve all validation logic unchanged (same behavior, different interface)
    - Maintain error handling and edge cases
    - Update JSDoc references to ParsedDocument types
  - **Test**: Task 1.3 integration tests pass, validation works with facade methods
  - **Commands**: `npm test -- integration/citation-validator-parsed-document && npm test -- validation`
  - _Requirements_: [[#^US1-7AC5|AC5]]
  - _Leverage_: Existing CitationValidator structure, refactoring pattern from lines 287-330

### Phase 4: Regression Validation & Documentation

- [x] **4.0.1. Refactor Legacy Tests to Use ParsedDocument Facade Interface** ^US1-7T4-1-1
  - **Implementation Details**: [tasks/04-4-0-1-refactor-legacy-tests-facade-interface-us1.7.md](tasks/04-4-0-1-refactor-legacy-tests-facade-interface-us1.7.md)%%stop-extract-link%%
  - **Agent**: test-writer
  - **Objective**: Update legacy test files that directly access parser output properties to use ParsedDocument facade methods instead, resolving regression failures identified in Task 4.1
  - **Input**: Task 4.1 regression report, failing test files (test/parsed-file-cache.test.js, test/factory.test.js)
  - **Output**: Refactored test files using facade interface
  - **Files**:
    - `tools/citation-manager/test/parsed-file-cache.test.js` (modify) - 3 failing tests
    - `tools/citation-manager/test/factory.test.js` (modify) - 1 failing test
  - **Scope**:
    - Replace direct property access (`result.filePath`, `result.content`, `result.tokens`) with facade method calls
    - Verify cache behavior using `extractFullContent()` instead of checking `filePath` metadata
    - Verify cache behavior using `getLinks()` to confirm correct parsed data returned
    - Use `hasAnchor()` to validate anchor existence instead of accessing `._data.anchors`
    - Maintain same test intent - verify cache behavior works correctly, just through facade interface
    - Update test assertions to compare actual parsed content/links rather than metadata properties
    - Do NOT add new public methods to ParsedDocument facade - use existing interface only
  - **Test**: All 4 previously failing tests pass, full test suite passes (zero regressions)
  - **Commands**: `npm test -- parsed-file-cache && npm test -- factory && npm test`
  - _Requirements_: [[#^US1-7AC7|AC7]] - Zero behavioral changes requirement
  - _Leverage_: Existing ParsedDocument facade methods (extractFullContent, getLinks, hasAnchor)

- [x] **4.1. Execute Full Regression Validation** ^US1-7T4-1
  - **Implementation Details**: [tasks/04-4-1-execute-full-regression-validation-us1.7.md](tasks/04-4-1-execute-full-regression-validation-us1.7.md)
  - **Agent**: qa-validation
  - **Objective**: Execute complete test suite to validate zero behavioral changes from ParsedDocument facade introduction
  - **Input**: All implementation from Phases 1-3, existing test suite
  - **Output**: Validation report confirming all tests pass with zero behavioral changes
  - **Files**: (validation only - no file modifications)
  - **Scope**:
    - Execute full test suite: `npm test`
    - Validate all existing tests pass with ParsedDocument facade integration
    - Validate new facade unit tests pass
    - Validate new integration tests pass
    - Confirm zero test failures, zero behavioral regressions
    - Document test execution results with pass/fail counts
  - **Test**: All existing tests + new facade tests pass, confirming zero behavioral changes
  - **Commands**: `npm test`
  - _Requirements_: [[#^US1-7AC7|AC7]]
  - _Leverage_: Complete test suite, Vitest framework

- [x] **4.1.2. Review Code Changes for Tasks 4.2 and 4.3** ^US1-7T4-1-2
  - **Implementation Details**: (Inline task - no separate file)
  - **Agent**: Explore
  - **Objective**: Review all code and documentation changes from US1.7 implementation to provide comprehensive context for creating the ParsedDocument Implementation Guide (4.2) and updating the Architecture Documentation (4.3)
  - **Input**:
    - Implemented code: `ParsedDocument.js`, `ParsedFileCache.js`, `CitationValidator.js`
    - Test files from Phase 1 (unit tests, integration tests)
    - Current Implementation Guide template (if exists)
    - Current Architecture documentation
  - **Output**:
    - Comprehensive review report documenting:
      - Actual implementation patterns used in ParsedDocument facade
      - Public interface methods and their signatures
      - Private helper methods and caching mechanisms
      - Integration patterns in ParsedFileCache and CitationValidator
      - Test coverage and validation approaches
      - Deviations from original pseudocode (if any)
      - Key implementation decisions and rationale
      - Architectural impact summary for documentation updates
  - **Files**:
    - `tools/citation-manager/src/ParsedDocument.js` (read)
    - `tools/citation-manager/src/ParsedFileCache.js` (read)
    - `tools/citation-manager/src/CitationValidator.js` (read)
    - `tools/citation-manager/test/parsed-document.test.js` (read)
    - `tools/citation-manager/test/integration/parsed-file-cache-facade.test.js` (read)
    - `tools/citation-manager/test/integration/citation-validator-parsed-document.test.js` (read)
    - `tools/citation-manager/design-docs/component-guides/ParsedDocument Implementation Guide.md` (read - if exists)
  - **Scope**:
    - **ParsedDocument.js Analysis**:
      - Document public interface methods: `hasAnchor()`, `findSimilarAnchors()`, `getLinks()`, `extractFullContent()`, stub methods
      - Document private helpers: `_getAnchorIds()`, `_fuzzyMatch()`, `_calculateSimilarity()`, caching mechanisms
      - Capture JSDoc documentation and type annotations
      - Identify implementation deviations from user story pseudocode (lines 122-284)
      - Document lazy-loading cache implementation patterns
    - **ParsedFileCache.js Analysis**:
      - Document how `resolveParsedFile()` wraps parser output in ParsedDocument facade
      - Capture import statements and dependency injection patterns
      - Document JSDoc updates for return type changes
      - Verify error handling preservation
    - **CitationValidator.js Analysis**:
      - Document usage of ParsedDocument methods replacing direct data access
      - Identify removed/updated internal methods
      - Verify behavior preservation (zero regressions)
      - Capture refactoring patterns for Implementation Guide examples
    - **Test Implementation Review**:
      - Summarize test coverage for ParsedDocument public interface
      - Document integration test patterns used
      - Note fixture usage and test data strategies
    - **Documentation Context Gathering**:
      - List key findings for Implementation Guide creation (Task 4.2)
      - Summarize architectural changes for Architecture doc updates (Task 4.3)
      - Identify technical debt resolution evidence
  - **Test**: n/a (read-only review task)
  - **Commands**: Read operations only - file reviews via Explore agent
  - _Requirements_: Provides comprehensive implementation context for Tasks 4.2 and 4.3
  - _Leverage_: Completed implementation from Phases 1-3, US1.7 pseudocode, existing documentation structure

- [x] **4.2. Create ParsedDocument Implementation Guide** ^US1-7T4-2
  - **Implementation Details**: [tasks/04-4-2-create-implementation-guide-us1.7.md](tasks/04-4-2-create-implementation-guide-us1.7.md)
  - **Agent**: none
  - **Objective**: Create comprehensive Implementation Guide documenting ParsedDocument facade interface, method contracts, and usage patterns
  - **Input**: ParsedDocument.js implementation from Phase 2, ParsedDocument Implementation Guide template
  - **Output**: Complete Implementation Guide for ParsedDocument component
  - **Files**:
    - `tools/citation-manager/design-docs/component-guides/ParsedDocument Implementation Guide.md` (already exists - verify completeness)
  - **Scope**:
    - Verify facade interface specification complete (public methods documented)
    - Verify method contracts documented (parameters, return types, behavior)
    - Verify pseudocode matches implementation
    - Verify integration patterns documented (ParsedFileCache, CitationValidator usage)
    - Verify testing strategy documented
    - Add implementation notes from Phase 2 learnings if needed
  - **Test**: Implementation Guide accurately reflects ParsedDocument facade implementation
  - **Commands**: `npm run citation:validate <implementation-guide>`
  - _Requirements_: Story references Implementation Guide as primary documentation
  - _Leverage_: Existing ParsedDocument Implementation Guide.md (already created)

- [x] **4.3. Update Architecture Documentation** ^US1-7T4-3
  - **Implementation Details**: [tasks/04-4-3-update-architecture-documentation-us1.7.md](tasks/04-4-3-update-architecture-documentation-us1.7.md)
  - **Agent**: none
  - **Objective**: Update content-aggregation-architecture.md to reflect ParsedDocument facade integration and mark technical debt as resolved
  - **Input**: content-aggregation-architecture.md, completed facade implementation from Phases 1-3
  - **Output**: Architecture documentation reflecting ParsedDocument facade integration
  - **Files**:
    - `tools/citation-manager/design-docs/features/20251003-content-aggregation/content-aggregation-architecture.md` (modify)
  - **Scope**:
    - Update component descriptions: ParsedFileCache returns ParsedDocument instances (lines 186-194)
    - Update component descriptions: CitationValidator uses ParsedDocument methods (lines 166-174)
    - Update component interaction diagram: Add ParsedDocument facade layer (lines 261-319)
    - Mark technical debt "Tight coupling to parser internals" as RESOLVED
    - Mark technical debt "Duplicate navigation logic across consumers" as RESOLVED
    - Add resolution date and reference to US1.7
    - Document resolution summary: Facade provides stable interface over parser internals
  - **Test**: Architecture documentation accurately reflects ParsedDocument facade integration
  - **Commands**: `npm run citation:validate <architecture-doc>`
  - _Requirements_: Story closes documented technical debt
  - _Leverage_: Existing architecture structure, technical debt documentation format

### Acceptance Criteria Coverage

**AC1 Coverage** ([[#^US1-7AC1|AC1]] - ParsedDocument wraps parser output):
- Task 1.1: Test validates ParsedDocument wraps MarkdownParser.Output.DataContract
- Task 2.1: Implementation creates facade with private `_data` field
- Task 4.1: Regression validation confirms encapsulation

**AC2 Coverage** ([[#^US1-7AC2|AC2]] - Anchor query methods):
- Task 1.1: Test validates `hasAnchor()` and `findSimilarAnchors()` methods
- Task 2.1: Implementation provides anchor query methods
- Task 3.2: CitationValidator uses anchor methods

**AC3 Coverage** ([[#^US1-7AC3|AC3]] - Content extraction methods):
- Task 1.1: Test validates `extractSection()`, `extractBlock()`, `extractFullContent()` methods
- Task 2.1: Implementation provides content extraction stubs + full content method
- Task 4.2: Implementation Guide documents Epic 2 stub strategy

**AC4 Coverage** ([[#^US1-7AC4|AC4]] - Link query methods):
- Task 1.1: Test validates `getLinks()` method
- Task 2.1: Implementation provides link query method
- Task 3.2: CitationValidator uses `getLinks()` method

**AC5 Coverage** ([[#^US1-7AC5|AC5]] - CitationValidator refactored):
- Task 1.3: Integration tests validate validator uses facade methods
- Task 3.2: Implementation refactors validator to use ParsedDocument
- Task 4.1: Regression confirms same validation behavior

**AC6 Coverage** ([[#^US1-7AC6|AC6]] - ParsedFileCache returns facades):
- Task 1.2: Integration tests validate cache returns ParsedDocument instances
- Task 3.1: Implementation wraps parser output in facade before caching
- Task 4.1: Regression confirms cache integration works

**AC7 Coverage** ([[#^US1-7AC7|AC7]] - Zero behavioral changes):
- Task 4.1: Full regression validation
- All tests: Maintain existing behavior throughout refactoring

**AC8 Coverage** ([[#^US1-7AC8|AC8]] - Unit tests for public methods):
- Task 1.1: Comprehensive unit tests for all public query methods
- Task 2.1: Implementation passes all unit tests
- Task 4.1: Unit tests included in regression validation

### Task Sequencing

#### Sequential Dependencies

**Phase 1 → Phase 2**: Tasks [[#^US1-7T1-1|1.1]]-[[#^US1-7T1-3|1.3]] must complete before Task [[#^US1-7T2-1|2.1]]
- Dependency Rationale: TDD approach requires failing tests (RED phase) before implementation (GREEN phase)

**Phase 2 → Phase 3**: Task [[#^US1-7T2-1|2.1]] must complete before Tasks [[#^US1-7T3-1|3.1]]-[[#^US1-7T3-2|3.2]]
- Dependency Rationale: Component integration depends on ParsedDocument facade existing

**Task 3.1 → Task 3.2**: Task [[#^US1-7T3-1|3.1]] must complete before Task [[#^US1-7T3-2|3.2]]
- Dependency Rationale: CitationValidator refactoring requires cache to return ParsedDocument instances

**Phase 3 → Phase 4**: Tasks [[#^US1-7T3-1|3.1]]-[[#^US1-7T3-2|3.2]] must complete before Tasks [[#^US1-7T4-1|4.1]]-[[#^US1-7T4-3|4.3]]
- Dependency Rationale: Regression validation and documentation require complete facade integration

#### Parallel Execution Groups

**Group 1 - Phase 1 Tests (RED Phase)**:
- Tasks [[#^US1-7T1-1|1.1]], [[#^US1-7T1-2|1.2]], and [[#^US1-7T1-3|1.3]] can execute in parallel
- Independent test files for facade unit tests, cache integration, and validator integration
- Same agent: test-writer
- Parallel execution saves 50-70 minutes

**Group 2 - Phase 4 Documentation**:
- Tasks [[#^US1-7T4-2|4.2]] and [[#^US1-7T4-3|4.3]] can execute in parallel after Task [[#^US1-7T4-1|4.1]] completes
- Independent documentation files
- Same agent: application-tech-lead
- Parallel execution saves 20-30 minutes

### Execution Sequence

**Wave 1 - RED Phase: Facade Tests** (Estimated: 110-140 min):
- Execute: Tasks [[#^US1-7T1-1|1.1]], [[#^US1-7T1-2|1.2]], and [[#^US1-7T1-3|1.3]] in parallel
- Agent: test-writer (all three tasks)
- Validation: application-tech-lead validates all tests written correctly and failing appropriately
- Deliverable: Failing facade unit tests + failing cache integration tests + failing validator integration tests (RED phase complete)
- **Block Condition**: Wave 2 blocked until validation PASS

**Wave 2 - GREEN Phase: Facade Implementation** (Estimated: 90-120 min):
- Execute: Task [[#^US1-7T2-1|2.1]]
- Agent: code-developer
- Validation: application-tech-lead validates ParsedDocument implementation complete, Task 1.1 tests pass
- Deliverable: Complete ParsedDocument.js with all public methods (unit tests GREEN)
- Prerequisite: Wave 1 validation PASS
- **Block Condition**: Wave 3 blocked until validation PASS

**Wave 3 - GREEN Phase: Component Integration** (Estimated: 110-140 min):
- Execute: Tasks [[#^US1-7T3-1|3.1]] and [[#^US1-7T3-2|3.2]] sequentially
- Agent: code-developer (both tasks)
- Validation: application-tech-lead validates both integrations complete, all Phase 1 tests pass, zero behavioral regressions
- Deliverable: Refactored ParsedFileCache + refactored CitationValidator (all integration tests GREEN)
- Prerequisite: Wave 2 validation PASS
- **Block Condition**: Wave 4 blocked until validation PASS

**Wave 4 - Regression Validation** (Estimated: 15-20 min):
- Execute: Task [[#^US1-7T4-1|4.1]]
- Agent: qa-validation
- Deliverable: Regression validation report confirming zero behavioral changes
- Prerequisite: Wave 3 validation PASS
- **Block Condition**: Wave 5 blocked until PASS

**Wave 5 - Documentation Updates** (Estimated: 50-70 min):
- Execute: Tasks [[#^US1-7T4-2|4.2]] and [[#^US1-7T4-3|4.3]] in parallel
- Agent: application-tech-lead (both tasks)
- Deliverable: Verified Implementation Guide + updated architecture documentation
- Prerequisite: Wave 4 PASS

**Total Estimated Duration**: 6.0-8.0 hours
**Critical Path**: Wave 1 → Wave 2 → Wave 3 → Wave 4 → Wave 5
**Validation Checkpoints**: 3 (Wave 1 + Wave 2 + Wave 3)
**TDD Compliance**: RED phase (Wave 1) → GREEN phase (Waves 2-3) → Validation/Docs (Waves 4-5)
**Longest Single Wave**: Wave 1 (110-140 min) - parallel test writing for facade, cache, and validator
**Time Savings**: ~70-100 minutes via parallel execution (Wave 1 + Wave 5)

---

## Additional Implementation Risks

> [!note] Additional risks to be identified during implementation

---

## Bugs/Known Issues

> [!note] To be documented during implementation

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|---------|
| 2025-10-09 | 1.0 | Initial story creation with architectural context, populated through Dev Notes section per template structure | Application Tech Lead (Claude Sonnet 4.5) |

## Related Documentation

- [Content Aggregation PRD](../../content-aggregation-prd.md) - Parent feature PRD with story definition and acceptance criteria
- [Content Aggregation Architecture](../../content-aggregation-architecture.md) - Tool architecture with component specifications
- [ParsedDocument Implementation Guide](../../../../component-guides/ParsedDocument%20Implementation%20Guide.md) - Facade interface specification (TO BE CREATED)
- [ParsedFileCache Implementation Guide](../../../../component-guides/ParsedFileCache%20Implementation%20Guide.md) - Cache integration patterns
- [CitationValidator Implementation Guide](../../../../component-guides/CitationValidator%20Implementation%20Guide.md) - Validation logic and integration patterns
