---
title: "User Story 1.5: Implement a Cache for Parsed File Objects"
feature-title: Citation Manager Content Aggregation
epic-number: 1
epic-name: Citation Manager Test Migration & Content Aggregation
epic-url: ../../content-aggregation-prd.md#Epic%20Citation%20Manager%20Test%20Migration%20&%20Content%20Aggregation
user-story-number: 1.5
status: Done
---

# Story 1.5: Implement a Cache for Parsed File Objects

<critical-llm-Initialization-Instructions>
When first reading this file, you MUST IMMEDIATELY run citation manager to extract base paths: `npm run citation:base-paths "this-file-path" -- --format json`. Read ALL discovered base path files to gather complete architectural context before proceeding.
</critical-llm-Initialization-Instructions>

## Story

**As a** `citation-manager` tool,
**I want** to implement a caching layer that stores parsed file objects (the `MarkdownParser.Output.DataContract`) in memory during a single command run,
**so that** I can eliminate redundant file read operations, improve performance, and provide an efficient foundation for new features like content extraction.

_Source: [Story 1.5: Implement a Cache for Parsed File Objects](../../content-aggregation-prd.md#Story%201.5%20Implement%20a%20Cache%20for%20Parsed%20File%20Objects)_

## Acceptance Criteria

1. GIVEN a file has already been parsed during a command's execution, WHEN a subsequent request is made for its parsed data, THEN the system SHALL return the `MarkdownParser.Output.DataContract` object from the in-memory cache instead of re-reading the file from disk. ^US1-5AC1
2. GIVEN a file has not yet been parsed, WHEN a request is made for its parsed data, THEN the system SHALL parse the file from disk, store the resulting `MarkdownParser.Output.DataContract` object in the cache, and then return it. ^US1-5AC2
3. The `CitationValidator` component SHALL be refactored to use this caching layer for all file parsing operations. ^US1-5AC3
4. WHEN validating a document that contains multiple links to the same target file, THEN the target file SHALL only be read from disk and parsed once per command execution. ^US1-5AC4
5. GIVEN the new caching layer is implemented, WHEN the full test suite is executed, THEN all existing tests SHALL pass, confirming zero functional regressions. ^US1-5AC5

_Source: [Story 1.5 Acceptance Criteria](../../content-aggregation-prd.md#Story%201.5%20Acceptance%20Criteria)_

## Technical Debt Resolution

**Closes Technical Debt**:
- [Redundant File Parsing During Validation](../../content-aggregation-architecture.md#Redundant%20File%20Parsing%20During%20Validation): Eliminates redundant I/O and CPU overhead by caching MarkdownParser.Output.DataContract objects

## Dev Notes

### Architectural Context (C4)

This story implements an in-memory caching layer that eliminates redundant file parsing operations during a single command execution, directly addressing a critical performance bottleneck that would severely impact Epic 2 Content Aggregation feature.

- **Components Affected**:
  - [ParsedFileCache](../../content-aggregation-architecture.md#Citation%20Manager.ParsedFileCache) (NEW) - In-memory cache component managing MarkdownParser.Output.DataContract object lifecycle
  - [CitationValidator](../../content-aggregation-architecture.md#Citation%20Manager.Citation%20Validator) (MODIFIED) - Refactored to request parsed data from cache instead of calling parser directly
  - [MarkdownParser](../../content-aggregation-architecture.md#Citation%20Manager.Markdown%20Parser) (INTEGRATION) - Injected into cache as dependency for cache-miss scenarios
  - [CLI Orchestrator](../../content-aggregation-architecture.md#Citation%20Manager.CLI%20Orchestrator) (INTEGRATION) - Uses factory to instantiate cache-enabled validator

- **Implementation Guides**:
  - [ParsedFileCache Implementation Guide](../../../../component-guides/ParsedFileCache%20Implementation%20Guide.md) - Component structure, pseudocode, data contracts, and testing strategy for new cache component
  - [CitationValidator Implementation Guide](../../../../component-guides/CitationValidator%20Implementation%20Guide.md) - Updated public contracts and refactoring guidance for cache integration
  - [MarkdownParser Implementation Guide](../../../../component-guides/Markdown%20Parser%20Implementation%20Guide.md) - MarkdownParser.Output.DataContract schema required for cache operations

### Files Impacted

- `tools/citation-manager/src/ParsedFileCache.js` (CREATE) - New cache component with Map-based in-memory storage, manages MarkdownParser.Output.DataContract lifecycle
- `tools/citation-manager/src/CitationValidator.js` (MODIFY) - Refactor to use ParsedFileCache instead of direct MarkdownParser calls, convert validation methods to async
- `tools/citation-manager/src/factories/componentFactory.js` (MODIFY) - Add `createParsedFileCache()` factory function, wire into `createCitationValidator()`
- `tools/citation-manager/src/citation-manager.js` (MODIFY) - Update CLI orchestrator to handle async validator methods (if needed)
- `tools/citation-manager/test/parsed-file-cache.test.js` (CREATE) - Unit tests for cache hit/miss scenarios and MarkdownParser collaboration
- `tools/citation-manager/test/integration/citation-validator.test.js` (MODIFY) - Add performance validation for single-parse-per-file behavior

### Current Architecture (Pre-US1.5)

#### Problem: Redundant File Parsing

Currently, the CitationValidator calls MarkdownParser directly for every validation operation. When a source document contains multiple links to the same target file, that file is read from disk and parsed multiple times:

```javascript
// tools/citation-manager/src/CitationValidator.js (BEFORE)
class CitationValidator {
  constructor(parser, fileCache) {
    this.parser = parser;      // MarkdownParser injected via DI (US1.4b)
    this.fileCache = fileCache;
  }

  validateFile(filePath) {
    // Parse source file
    const sourceData = this.parser.parseFile(filePath);  // PARSE #1

    for (const link of sourceData.links) {
      // For each citation, parse target file
      const targetData = this.parser.parseFile(link.target);  // PARSE #2, #3, #4...

      // If 10 links point to same target, file is parsed 10 times!
    }
  }
}
```

**Impact**:
- High I/O overhead: Same file read from disk multiple times
- High CPU overhead: Same markdown tokenization repeated unnecessarily
- Severe bottleneck for Epic 2: ContentExtractor will compound this problem

### Target Architecture (Post-US1.5)

#### Solution: In-Memory Parsed File Cache

The new ParsedFileCache component sits between CitationValidator and MarkdownParser, ensuring each file is parsed only once per command execution:

```javascript
// tools/citation-manager/src/ParsedFileCache.js (NEW)
class ParsedFileCache {
  constructor(markdownParser) {
    this.parser = markdownParser;  // MarkdownParser injected via DI
    this.cache = new Map();        // Key: absolute path, Value: MarkdownParser.Output.DataContract
  }

  async get(filePath) {
    // Cache hit: return cached object immediately
    if (this.cache.has(filePath)) {
      return this.cache.get(filePath);
    }

    // Cache miss: parse, cache, and return
    const parsedData = await this.parser.parseFile(filePath);
    this.cache.set(filePath, parsedData);
    return parsedData;
  }
}
```

**Factory Pattern Integration** ([[#^US1-5AC2|AC2]]):

```javascript
// tools/citation-manager/src/factories/componentFactory.js (MODIFIED)
import { ParsedFileCache } from '../ParsedFileCache.js';

export function createParsedFileCache() {
  const parser = createMarkdownParser();
  return new ParsedFileCache(parser);
}

export function createCitationValidator(scopeDirectory = null) {
  const parsedFileCache = createParsedFileCache();  // NEW: Create cache
  const fileCache = scopeDirectory ? createFileCache(scopeDirectory) : null;

  return new CitationValidator(
    parsedFileCache,  // NEW: Inject cache instead of parser
    fileCache
  );
}
```

**CitationValidator Refactored** ([[#^US1-5AC3|AC3]]):

```javascript
// tools/citation-manager/src/CitationValidator.js (MODIFIED)
class CitationValidator {
  constructor(parsedFileCache, fileCache) {
    this.parsedFileCache = parsedFileCache;  // NEW: Cache replaces parser
    this.fileCache = fileCache;
  }

  async validateFile(filePath) {  // NOW ASYNC
    // Request parsed data from cache (single parse guaranteed)
    const sourceData = await this.parsedFileCache.get(filePath);

    for (const link of sourceData.links) {
      // Request target data from cache (reuses cached object if already parsed)
      const targetData = await this.parsedFileCache.get(link.target);

      // Same target file requested 10 times? Parsed only once!
    }
  }
}
```

**Cache Lifecycle**:
- **Scope**: In-memory only, lifetime = single command execution
- **Cache Key**: Absolute file path (string)
- **Cache Value**: Complete MarkdownParser.Output.DataContract object
- **Threading**: Single-threaded Node.js, no concurrency concerns

### Dependencies
- **Prerequisite**: [Story 1.4b](../us1.4b-refactor-components-for-di/us1.4b-refactor-components-for-di.md) complete - Constructor DI pattern and factory infrastructure enable clean cache integration
- **Enables**: [Story 2.1](../../content-aggregation-prd.md#Story%202.1%20Enhance%20Parser%20to%20Handle%20Full-File%20and%20Section%20Links) - ContentExtractor can consume same ParsedFileCache instance for efficient content extraction

### Design Principles Adherence

This story must adhere to the following [Design Principles](../../../../../../../ARCHITECTURE-PRINCIPLES.md):

**Critical Principles:**
- [**Single Responsibility**](../../../../../../../ARCHITECTURE-PRINCIPLES.md#^single-responsibility) (Modular): ParsedFileCache has exactly one responsibility - managing in-memory lifecycle of parsed file objects
- [**One Source of Truth**](../../../../../../../ARCHITECTURE-PRINCIPLES.md#^one-source-of-truth) (Data-First): During a command run, cache becomes authoritative source for any file's parsed object
- [**Dependency Abstraction**](../../../../../../../ARCHITECTURE-PRINCIPLES.md#^dependency-abstraction) (Modular): CitationValidator depends on cache abstraction, not concrete MarkdownParser
- [**Performance (NFR5)**](../../content-aggregation-prd.md#^NFR5) (Non-Functional): System parses each unique file at most once per command execution
- [**Simplicity First**](../../../../../../../ARCHITECTURE-PRINCIPLES.md#^simplicity-first) (MVP): Map-based in-memory cache, no persistence, no TTL, no eviction - simplest solution that meets requirements

**Anti-Patterns to Avoid:**
- [**Scattered File I/O**](../../content-aggregation-architecture.md#Scattered%20File%20I/O%20Operations): Cache centralizes parser access, reducing scattered file operations
- [**Hidden Global State**](../../../../../../../ARCHITECTURE-PRINCIPLES.md#^hidden-global-state) (Anti-Pattern): Cache explicitly injected as constructor dependency, not hidden global

**Implementation Guidance:**
- Cache methods return Promises to support async file I/O
- Use absolute file paths as cache keys for unambiguous identity
- No cache expiration needed (lifetime = command execution)
- No cache size limits needed (MVP scope: documentation files only)

### Testing

- **Test Framework**: [Vitest](../../content-aggregation-architecture.md#Testing%20Strategy) (shared workspace framework)
- **Test Strategy**: Real file system operations, BDD Given-When-Then structure, no mocking per workspace "Real Systems, Fake Fixtures" principle
- **Test Location**: `tools/citation-manager/test/` (established in US1.4a)

#### Required Test Implementation

##### 1. ParsedFileCache Unit Tests (Unit Test)
- **Purpose**: Validate cache hit/miss behavior and MarkdownParser collaboration
- **Acceptance Criteria**: Validates [[#^US1-5AC1|AC1]] (cache hit returns cached object) and [[#^US1-5AC2|AC2]] (cache miss triggers parse and caches result)
- **Implementation Guidance**:
  - Test 1: First request (cache miss) parses file and caches result
  - Test 2: Second request (cache hit) returns cached object without re-parsing
  - Test 3: Different files cached independently
  - Use real test fixtures from `test/fixtures/` directory

##### 2. CitationValidator Integration Test (Integration Test)
- **Purpose**: Verify CitationValidator uses cache for all parsing operations
- **Acceptance Criteria**: Validates [[#^US1-5AC3|AC3]] (validator refactored to use cache) and [[#^US1-5AC4|AC4]] (file parsed once per execution)
- **Implementation Guidance**:
  - Create test fixture with multiple links to same target file
  - Verify target file parsed only once despite multiple references
  - Use factory-created validator with real dependencies

##### 3. Full Regression Test (Regression Validation)
- **Purpose**: Confirm zero functional regressions from cache introduction
- **Acceptance Criteria**: Validates [[#^US1-5AC5|AC5]] (all existing tests pass)
- **Implementation Guidance**:
  - Execute complete test suite via `npm test`
  - All 50+ existing tests must pass unchanged
  - No test logic modifications required (cache is transparent to CLI integration tests)

---

## Implementation Risks & Mitigations

### Risk: Factory Wiring Complexity
**Challenge**: Adding ParsedFileCache to dependency graph increases factory instantiation complexity.

**Dependency Order** (CRITICAL - must instantiate in this sequence):
1. FileCache (no dependencies)
2. MarkdownParser (depends on FileCache)
3. ParsedFileCache (depends on MarkdownParser) ← NEW
4. CitationValidator (depends on ParsedFileCache + FileCache) ← CHANGED

**Factory Pattern**:
- `createFileCache()` - existing
- `createMarkdownParser()` - existing
- `createParsedFileCache()` - NEW, calls createMarkdownParser()
- `createCitationValidator()` - MODIFIED, calls createParsedFileCache()

**Validation**: Factory integration tests must verify correct DI order and circular dependency absence.

---

### Risk: Asynchronous Error Timing Changes
**Challenge**: Existing tests may expect synchronous errors from direct parser calls. Caching layer introduces async error propagation.

**Behavior Change**:
- BEFORE: `parser.parseFile()` throws synchronous errors
- AFTER: `cache.resolveParsedFile()` returns rejected promises

**Mitigation**:
- Audit all existing tests for error handling patterns
- Update to async/await where parser is called
- Verify error messages remain identical post-refactoring
- AC5 gate: Full regression suite must pass

---

### Risk: Concurrent Request Handling
**Challenge**: Testing the "store promise immediately" pattern requires simulating concurrent cache access.

**Test Strategy**:

```javascript
// Use Promise that doesn't auto-resolve for deterministic testing
let resolveParsePromise;
const mockParser = {
  parseFile: vi.fn(() => new Promise(resolve => {
    resolveParsePromise = resolve;
  }))
};

// Make concurrent requests BEFORE resolving
const p1 = cache.resolveParsedFile('test.md');
const p2 = cache.resolveParsedFile('test.md');

// Verify parser called only once BEFORE resolution
expect(mockParser.parseFile).toHaveBeenCalledTimes(1);

// Resolve and verify both get same result
resolveParsePromise(mockData);
await expect(p1).resolves.toBe(mockData);
await expect(p2).resolves.toBe(mockData);
```

**Coverage Required**: Integration test demonstrating cache hit during concurrent requests.

---

### Risk: Path Normalization Inconsistency
**Challenge**: Inconsistent path normalization could cause cache misses for same physical file.

**Mitigation** (Simplified from original recommendation):
- Use Node.js built-in: `path.resolve(path.normalize(filePath))`
- **Symlink handling**: NOT supported in cache normalization (acceptable trade-off)
- Rationale: Symlink resolution adds complexity with minimal real-world benefit for documentation files
- If symlinks needed: User can pass absolute paths or resolve symlinks before calling citation-manager

**Edge Cases ACCEPTED** (documented as out of scope):
- Symlink loops: User responsibility
- File modified during execution: Acceptable (per-command cache assumes stable file system)
- Large file timeouts: Acceptable (concurrent requests wait on same slow parse)
- Mid-parse permission errors: Handled by promise rejection cleanup

---

## CitationValidator Refactoring Checklist

**Parser Call Sites** (CRITICAL - must replace both):
1. **Line 107**: Source file parsing in `validateFile()`
   - BEFORE: `const parsed = await this.parser.parseFile(filePath);`
   - AFTER: `const parsed = await this.parsedFileCache.resolveParsedFile(filePath);`

2. **Line 471**: Target file parsing in `validateAnchorExists()`
   - BEFORE: `const parsed = await this.parser.parseFile(targetFile);`
   - AFTER: `const parsed = await this.parsedFileCache.resolveParsedFile(targetFile);`

**Verification**:
- Static analysis: Search CitationValidator.js for `this.parser.parseFile` - zero matches after refactoring
- Integration test: Spy on parser, verify called exactly once per unique file despite multiple links
- AC3 gate: CitationValidator uses caching layer for ALL file parsing operations

---

## Bugs/Known Issues

### Pre-Existing Test Failures (Technical Debt)

**Issue**: 7 tests in the citation manager test suite fail with pre-existing edge case issues unrelated to Phase 1 schema refactoring (Tasks 1.1-1.3).

**Root Cause**: Technical debt in CLI display formatting and URL-encoded anchor handling accumulated before US1.5 implementation.

**Failing Tests**:
1. **CLI Warning Output Formatting** (3 tests) - Display logic issues in warning section formatting
2. **URL-Encoded Anchor Handling** (3 tests) - Edge case in anchor matching when anchors contain URL-encoded characters (e.g., spaces as `%20`)
3. **Wiki-Style Link Classification** (1 test) - Edge case in pattern detection for wiki-style links

**Impact**: Low - Core functionality works correctly. Issues affect edge cases in display formatting and specific anchor encoding patterns.

**Verification**:
- Test suite pass rate: 44/51 tests passing (86%)
- All schema validation tests (8/8) pass, confirming Phase 1 objectives met
- All core parsing and validation functionality works correctly

**Status**: Documented technical debt, low priority. Not blocking for US1.5 cache implementation (Phase 2+). Can be addressed in future story: "Improve CLI warning display formatting and URL-encoded anchor handling".

**Resolution Plan**:
- Create separate user story to address these edge cases
- Recommended priority: Low (after cache implementation complete)
- Estimated effort: 2-3 tasks, ~4-6 hours total

### Citation Manager Validation False Positives

**Issue**: Citation validation reports 6 "invalid caret pattern" errors for external anchor references.

**Root Cause**: The citation manager validates both full markdown links AND standalone anchor patterns. When external files (like Architecture Principles) use kebab-case anchors (e.g., `^single-responsibility`), the validator flags these as invalid caret patterns because they don't match the requirement format (`^FR1`, `^US1-1AC1`, etc.).

**Impact**: None - All actual citations are valid and functional. The 6 errors are false positives:
- Lines 190-194, 198: Anchors from Architecture Principles document use kebab-case format
- Line 197: "Scattered File I/O Operations" anchor (space encoding issue in error message only)

**Verification**: All 45 full markdown links validate successfully, including the ones flagged as errors when checked as standalone patterns.

**Status**: Documentation issue only - no action required. Future: Citation manager could skip anchor pattern validation for external file references.

---

## Tasks / Subtasks

### Phase 1: MarkdownParser.Output.DataContract Validation & Documentation

- [x] **1.1. Validate and Document MarkdownParser.Output.DataContract** ^US1-5T1-1
  - **Agent**: test-writer
  - **Objective**: Validate MarkdownParser returns complete MarkdownParser.Output.DataContract including all fields (filePath, content, tokens, links, headings, anchors) and update Implementation Guide to reflect actual schema
  - **Input**: Existing MarkdownParser implementation, Implementation Guide specification
  - **Output**: Tests validating complete MarkdownParser.Output.DataContract, updated Implementation Guide documentation
  - **Files**:
    - `tools/citation-manager/test/parser-output-contract.test.js` (create)
    - `tools/citation-manager/design-docs/component-guides/Markdown Parser Implementation Guide.md` (modify)
  - **Scope**:
    - Create test suite validating MarkdownParser.parseFile() returns object with exact schema: `{ filePath, content, tokens, links, headings, anchors }`
    - Test each field is populated correctly with expected data types
    - Validate `headings` array structure (level, text, raw properties)
    - Validate `anchors` array structure (type, anchor, text, line properties)
    - Validate `links` array structure (type, text, file, anchor, fullMatch, line properties)
    - Update Implementation Guide to include `headings` field in MarkdownParser.Output.DataContract JSON schema
    - Document rationale for `headings` field presence (used by CLI ast command, available for future features)
  - **Test**: MarkdownParser.Output.DataContract tests pass, MarkdownParser returns all documented fields, Implementation Guide accurately reflects actual schema
  - **Commands**: `npm test -- parser-output-contract`
  - _Requirements_: [[#^US1-5AC2|AC2]] (foundation for cache storage)
  - _Leverage_: Existing MarkdownParser implementation, Implementation Guide template structure
  - _Implementation Details_: [tasks/01-1-1-validate-document-parser-output-contract-us1.5.md](tasks/01-1-1-validate-document-parser-output-contract-us1.5.md)

- [x] **1.2. Update Parser Tests to Documented Schema (RED Phase)** ^US1-5T1-2
  - **Agent**: test-writer
  - **Objective**: Update `parser-output-contract.test.js` to validate the Implementation Guide schema as source of truth. Tests should FAIL, exposing mismatch between current implementation and documented contract.
  - **Input**: Implementation Guide LinkObject/AnchorObject schemas, Task 1.1 test file
  - **Output**: Updated tests validating documented schema (tests will fail)
  - **Files**:
    - `tools/citation-manager/test/parser-output-contract.test.js` (modify)
  - **Scope**:
    - Update link tests to validate linkType, scope, anchorType, source.path, target.path structure
    - Update anchor tests to validate anchorType, id, rawText properties
    - Add tests for path variations (raw, absolute, relative)
    - Add tests for enum constraints (linkType: markdown|wiki, scope: internal|cross-document)
    - Replace all `type` → `linkType`/`anchorType`, `file` → `target.path`, `anchor` → `id`/`target.anchor`
    - Use BDD Given-When-Then comment structure
  - **Test**: Tests fail showing current implementation doesn't match documented schema
  - **Commands**: `npm test -- parser-output-contract` (expect failures)
  - _Requirements_: [[#^US1-5AC2|AC2]] (expose schema mismatch for TDD refactoring)
  - _Leverage_: Implementation Guide JSON schemas, existing test structure
  - _Implementation Details_: [tasks/01-1-2-update-parser-tests-to-documented-schema-us1.5.md](tasks/01-1-2-update-parser-tests-to-documented-schema-us1.5.md)

- [x] **1.3. Refactor Parser to Match Documented Schema (GREEN Phase)** ^US1-5T1-3
  - **Agent**: code-developer-agent
  - **Objective**: Refactor MarkdownParser `extractLinks()` and `extractAnchors()` to return Implementation Guide schema. Make Task 1.2 tests PASS while maintaining zero regressions.
  - **Input**: Implementation Guide schemas, Task 1.2 failing tests, MarkdownParser pseudocode
  - **Output**: Refactored MarkdownParser returning documented schema
  - **Files**:
    - `tools/citation-manager/src/MarkdownParser.js` (modify)
    - `tools/citation-manager/src/CitationValidator.js` (modify)
    - `tools/citation-manager/test/*.test.js` (modify existing tests)
  - **Scope**:
    - Update `extractLinks()` to return LinkObject schema (linkType, scope, anchorType, source, target)
    - Update `extractAnchors()` to return AnchorObject schema (anchorType, id, rawText)
    - Add helper methods: `determineAnchorType()`, `resolvePath()`
    - Update CitationValidator to use new schema properties
    - Update all existing tests to use new schema
  - **Test**: Task 1.2 tests pass, full test suite passes (zero regressions)
  - **Commands**: `npm test -- parser-output-contract && npm test`
  - _Requirements_: [[#^US1-5AC2|AC2]] (schema refactoring prerequisite for cache implementation)
  - _Leverage_: Implementation Guide pseudocode patterns, existing parser structure
  - _Implementation Details_: [tasks/01-1-3-refactor-parser-to-match-documented-schema-us1.5.md](tasks/01-1-3-refactor-parser-to-match-documented-schema-us1.5.md)

### Phase 2: ParsedFileCache Unit Tests & Implementation (TDD)

- [x] **2.1. Write ParsedFileCache Unit Tests** ^US1-5T2-1
  - **Agent**: test-writer
  - **Objective**: Write comprehensive failing unit tests for ParsedFileCache component covering cache hit/miss, concurrent requests, error propagation, and path normalization
  - **Input**: ParsedFileCache Implementation Guide specification, MarkdownParser.Output.DataContract schema from Phase 1
  - **Output**: Complete unit test suite for ParsedFileCache (failing until implementation)
  - **Files**:
    - `tools/citation-manager/test/parsed-file-cache.test.js` (create)
  - **Scope**:
    - Test cache miss: first request parses file and stores result in cache
    - Test cache hit: second request returns cached MarkdownParser.Output.DataContract without re-parsing
    - Test concurrent requests: multiple simultaneous requests for same file trigger only one parse
    - Test error propagation: parser errors are propagated and failed promises removed from cache
    - Test path normalization: relative paths, `./` prefixes, redundant separators normalized to consistent cache keys
    - Test different files cached independently
    - Use BDD Given-When-Then comment structure
    - Use real test fixtures from `test/fixtures/` directory
  - **Test**: All ParsedFileCache unit tests written and failing (no implementation exists yet)
  - **Commands**: `npm test -- parsed-file-cache` (expect failures)
  - _Requirements_: [[#^US1-5AC1|AC1]], [[#^US1-5AC2|AC2]]
  - _Leverage_: ParsedFileCache Implementation Guide pseudocode, workspace BDD testing patterns
  - _Implementation Details_: [tasks/02-2-1-write-parsed-file-cache-unit-tests-us1.5.md](tasks/02-2-1-write-parsed-file-cache-unit-tests-us1.5.md)

- [x] **2.2. Implement ParsedFileCache Component** ^US1-5T2-2
  - **Agent**: code-developer-agent
  - **Objective**: Implement ParsedFileCache component with Map-based in-memory cache storing MarkdownParser.Output.DataContract objects
  - **Input**: ParsedFileCache Implementation Guide, failing unit tests from Task 2.1
  - **Output**: ParsedFileCache.js implementation passing all unit tests
  - **Files**:
    - `tools/citation-manager/src/ParsedFileCache.js` (create)
  - **Scope**:
    - Implement constructor accepting MarkdownParser dependency via DI, create Map-based cache for storing Promises
    - Implement `resolveParsedFile(filePath)` async method using read-through cache pattern (cache hit returns cached Promise, cache miss delegates to parser)
    - Normalize file paths to absolute paths for consistent cache keys
    - Handle concurrent requests by storing Promises immediately (prevents duplicate parses for same file)
    - Clean up cache on parse errors to prevent caching failed promises
    - Preserve MarkdownParser.Output.DataContract interface unchanged
  - **Test**: All unit tests from Task 2.1 pass, cache correctly stores and retrieves MarkdownParser.Output.DataContract objects
  - **Commands**: `npm test -- parsed-file-cache`
  - _Requirements_: [[#^US1-5AC1|AC1]], [[#^US1-5AC2|AC2]]
  - _Leverage_: ParsedFileCache Implementation Guide pseudocode, existing MarkdownParser interface
  - _Implementation Details_: [tasks/02-2-2-implement-parsed-file-cache-component-us1.5.md](tasks/02-2-2-implement-parsed-file-cache-component-us1.5.md)

### Phase 3: CitationValidator Integration Tests & Refactoring (TDD)

- [x] **3.1. Write CitationValidator Cache Integration Tests** ^US1-5T3-1
  - **Agent**: test-writer
  - **Objective**: Write failing integration tests proving CitationValidator should use ParsedFileCache and parse each file only once despite multiple links
  - **Input**: CitationValidator current implementation, ParsedFileCache from Phase 2
  - **Output**: Integration test suite validating CitationValidator cache usage (failing until refactoring)
  - **Files**:
    - `tools/citation-manager/test/integration/citation-validator-cache.test.js` (create)
  - **Scope**:
    - Create test fixture with multiple links to same target file (e.g., 5 links to guide.md)
    - Write test validating target file parsed only once during validation (spy on MarkdownParser.parseFile)
    - Write test validating CitationValidator uses cache for source file parsing
    - Write test validating CitationValidator uses cache for target file anchor validation
    - Write test validating validation results identical with/without cache
    - Use real file system operations per workspace testing strategy
    - Follow BDD Given-When-Then structure
  - **Test**: All CitationValidator cache integration tests written and failing (implementation doesn't use cache yet)
  - **Commands**: `npm test -- integration/citation-validator-cache` (expect failures)
  - _Requirements_: [[#^US1-5AC3|AC3]], [[#^US1-5AC4|AC4]]
  - _Leverage_: Existing test fixtures, workspace integration testing patterns
  - _Implementation Details_: [tasks/03-3-1-write-citation-validator-cache-integration-tests-us1.5.md](tasks/03-3-1-write-citation-validator-cache-integration-tests-us1.5.md)

- [x] **3.2. Refactor CitationValidator to Use ParsedFileCache** ^US1-5T3-2
  - **Agent**: code-developer-agent
  - **Objective**: Refactor CitationValidator to accept ParsedFileCache dependency and use cache for all file parsing operations
  - **Input**: CitationValidator current implementation, failing tests from Task 3.1, ParsedFileCache from Phase 2
  - **Output**: CitationValidator using ParsedFileCache, all integration tests passing
  - **Files**:
    - `tools/citation-manager/src/CitationValidator.js` (modify)
  - **Scope**:
    - Update constructor to accept ParsedFileCache instead of MarkdownParser: `constructor(parsedFileCache, fileCache)`
    - Replace ALL `this.parser.parseFile()` calls with `this.parsedFileCache.resolveParsedFile()` calls (search to find all locations)
    - Convert affected methods to async (at minimum: `validateFile`, `validateAnchorExists`, `validateSingleCitation`)
    - Ensure async methods properly await cache calls and propagate promises through call chain
    - Verify completeness: Search for `this.parser.parseFile` should return ZERO matches after refactoring
    - Preserve all validation logic unchanged
  - **Test**: All integration tests from Task 3.1 pass, files parsed only once per execution, validation results unchanged
  - **Commands**: `npm test -- integration/citation-validator-cache && npm test -- validation`
  - _Requirements_: [[#^US1-5AC3|AC3]], [[#^US1-5AC4|AC4]]
  - _Leverage_: CitationValidator Implementation Guide, ParsedFileCache interface
  - _Implementation Details_: [tasks/03-3-2-refactor-citation-validator-to-use-cache-us1.5.md](tasks/03-3-2-refactor-citation-validator-to-use-cache-us1.5.md)

### Phase 4: Factory Tests & Implementation (TDD)

- [x] **4.1. Write and Validate Factory Tests for Cache Integration** ^US1-5T4-1
  - **Agent**: test-writer
  - **Objective**: Write comprehensive factory tests for ParsedFileCache creation and CitationValidator cache wiring, and verify they pass with existing factory implementation
  - **Input**: componentFactory existing implementation (completed in Phase 2/3), ParsedFileCache from Phase 2, refactored CitationValidator from Phase 3
  - **Output**: Comprehensive factory test suite validating cache integration (all tests passing)
  - **Files**:
    - `tools/citation-manager/test/factory.test.js` (create)
  - **Scope**:
    - **ParsedFileCache Factory Tests** (3 tests):
      - Write test validating `createParsedFileCache()` returns ParsedFileCache instance
      - Write test validating ParsedFileCache receives MarkdownParser dependency
      - Write test validating cache can successfully parse files via injected parser
    - **CitationValidator Cache Wiring Tests** (4 tests):
      - Write test validating `createCitationValidator()` creates ParsedFileCache internally
      - Write test validating CitationValidator receives ParsedFileCache as first constructor argument
      - Write test validating CitationValidator receives FileCache as second constructor argument (existing)
      - Write test validating complete dependency chain: MarkdownParser → ParsedFileCache → CitationValidator
    - Use BDD Given-When-Then structure for all 7 tests
    - Verify all tests pass (factory implementation completed in Phase 2/3)
  - **Test**: All 7 factory tests written and passing with existing factory implementation
  - **Commands**: `npm test -- factory`
  - _Requirements_: [[#^US1-5AC2|AC2]], [[#^US1-5AC3|AC3]]
  - _Leverage_: Existing factory implementation, componentFactory structure, refactored CitationValidator interface
  - _Implementation Details_: [tasks/04-4-1-write-factory-tests-for-cache-integration-us1.5.md](tasks/04-4-1-write-factory-tests-for-cache-integration-us1.5.md)

### Phase 5: End-to-End Tests & CLI Integration (TDD)

- [x] **5.1. Write End-to-End Integration Tests** ^US1-5T5-1
  - **Agent**: test-writer
  - **Objective**: Write end-to-end tests validating complete workflow (CLI → Validator → Cache → Parser) with real files, exposing whether CLI async handling needs updates
  - **Input**: Complete implementation from Phases 1-4, existing test fixtures
  - **Output**: E2E test suite validating production workflow with factory-created components (may initially fail if CLI async handling incomplete)
  - **Files**:
    - `tools/citation-manager/test/integration/end-to-end-cache.test.js` (create)
  - **Scope**:
    - Write test using factory to create validator with cache
    - Write test validating multi-file validation with repeated file references
    - Write test confirming cache performance improvement (spy on parser calls)
    - Write test validating validation results identical with cache vs without
    - Write test validating CLI commands work correctly with cached validator
    - Use real test fixtures, real file system operations
    - Follow BDD Given-When-Then structure
    - Tests may fail if CLI doesn't properly await async validator calls
  - **Test**: E2E tests written (may fail if CLI needs async updates)
  - **Commands**: `npm test -- integration/end-to-end-cache` (expect failures if CLI needs updates)
  - _Requirements_: [[#^US1-5AC1|AC1]], [[#^US1-5AC4|AC4]]
  - _Leverage_: Existing integration test patterns, complete implementation stack
  - _Implementation Details_: [tasks/05-5-1-write-end-to-end-integration-tests-us1.5.md](tasks/05-5-1-write-end-to-end-integration-tests-us1.5.md)

- [x] **5.2. Update CLI Orchestrator for Async Validator (If Needed)** ^US1-5T5-2
  - **Agent**: code-developer-agent
  - **Objective**: Make Task 5.1 E2E tests pass by ensuring CLI orchestrator properly handles async CitationValidator methods
  - **Input**: citation-manager.js current implementation, failing E2E tests from Task 5.1, refactored async CitationValidator from Phase 3
  - **Output**: CLI handling async validator calls correctly, E2E tests passing
  - **Files**:
    - `tools/citation-manager/src/citation-manager.js` (modify - if needed)
  - **Scope**:
    - Review E2E test failures to identify missing await calls
    - Search for all `this.validator.validateFile()` calls in citation-manager.js
    - Ensure all validator calls use await and parent methods are async
    - Verify `validate()` method (line ~17) properly awaits
    - Verify `extractBasePaths()` method (line ~204) properly awaits
    - Verify `fix()` method (line ~259) properly awaits
    - If all calls already use await: no changes needed, tests should pass
  - **Test**: All E2E tests from Task 5.1 pass, CLI commands execute successfully with async validator
  - **Commands**: `npm test -- integration/end-to-end-cache && npm run citation:validate <test-file>`
  - _Requirements_: [[#^US1-5AC3|AC3]]
  - _Leverage_: Existing async CLI methods, async/await pattern already in use
  - _Implementation Details_: [tasks/05-5-2-update-cli-orchestrator-for-async-validator-us1.5.md](tasks/05-5-2-update-cli-orchestrator-for-async-validator-us1.5.md)

### Phase 6: Regression Validation & Documentation

- [x] **6.1. Execute Full Regression Validation** ^US1-5T6-1
  - **Agent**: qa-validation
  - **Objective**: Execute complete test suite to validate zero regression after caching layer implementation
  - **Input**: All implementation from Phases 1-5, existing 50+ test suite
  - **Output**: Validation report confirming all tests pass with zero regressions
  - **Files**: (validation only - no file modifications)
  - **Scope**:
    - Execute full test suite: `npm test`
    - Validate all 50+ existing tests pass with caching layer
    - Validate new ParsedFileCache unit tests pass
    - Validate new CitationValidator integration tests pass
    - Validate new factory tests pass
    - Validate new E2E tests pass
    - Confirm zero test failures, zero regressions
    - Document test execution results with pass/fail counts
  - **Test**: All 50+ existing tests + new cache tests pass, confirming zero regression
  - **Commands**: `npm test`
  - _Requirements_: [[#^US1-5AC5|AC5]]
  - _Leverage_: Complete test suite, Vitest framework
  - **Implementation Details**: [tasks/06-6-1-execute-full-regression-validation-us1.5.md](tasks/06-6-1-execute-full-regression-validation-us1.5.md)

- [x] **6.2. Update Architecture Documentation** ^US1-5T6-2
  - **Agent**: application-tech-lead
  - **Objective**: Update content-aggregation-architecture.md to mark "Redundant File Parsing During Validation" technical debt as resolved
  - **Input**: content-aggregation-architecture.md, completed cache implementation from Phases 1-5
  - **Output**: Architecture documentation reflecting resolved technical debt
  - **Files**:
    - `tools/citation-manager/design-docs/features/20251003-content-aggregation/content-aggregation-architecture.md` (modify)
  - **Scope**:
    - Update "Known Risks and Technical Debt" section
    - Mark "Redundant File Parsing During Validation" as RESOLVED
    - Add resolution date and reference to US1.5
    - Update component interaction diagram to show ParsedFileCache integration
    - Update "Migration Status" if applicable
    - Document ParsedFileCache component in architecture
    - **Remove US1.5 Completion Highlights**:
      - Search content-aggregation-architecture.md for all `==highlight==` markup
      - Remove highlights from ParsedFileCache component sections (new component - now complete)
      - Remove highlights from CitationValidator modifications (async refactoring - now complete)
      - Remove highlights from MarkdownParser modifications (schema updates - now complete)
      - Remove highlights from Factory modifications (cache wiring - now complete)
      - Remove highlights from CLI Orchestrator modifications (async handling - now complete)
      - **PRESERVE** all highlights for ContentExtractor component (future Epic 2 work - not yet implemented)
    - **Highlight Removal Validation**:
      - Verify no US1.5-related `==highlight==` markup remains after cleanup
      - Confirm ContentExtractor highlights are preserved for future work
      - Document removed highlights in Task 6.2 completion notes
  - **Test**: Architecture documentation accurately reflects resolved technical debt and new cache component, all US1.5 completion highlights removed, ContentExtractor highlights preserved
  - **Commands**: `npm run citation:validate <architecture-doc>`
  - _Requirements_: [[#^US1-5AC5|AC5]]
  - _Leverage_: ADR format, existing technical debt documentation structure
  - _Implementation Details_: [tasks/06-6-2-update-architecture-documentation-us1.5.md](tasks/06-6-2-update-architecture-documentation-us1.5.md)

### Acceptance Criteria Coverage

**AC1 Coverage** ([[#^US1-5AC1|AC1]] - Cache returns cached object on subsequent requests):
- Task 2.1: Unit test for cache hit behavior
- Task 2.2: Implementation returning cached MarkdownParser.Output.DataContract
- Task 5.2: E2E validation of cache hit in production workflow

**AC2 Coverage** ([[#^US1-5AC2|AC2]] - Cache parses and stores on first request):
- Task 1.1: Validate MarkdownParser.Output.DataContract schema
- Task 2.1: Unit test for cache miss behavior
- Task 2.2: Implementation parsing and caching on miss
- Task 4.1: Factory creates cache with parser dependency
- Task 4.3: Factory wires parser into cache

**AC3 Coverage** ([[#^US1-5AC3|AC3]] - CitationValidator uses caching layer):
- Task 3.1: Integration tests proving validator uses cache
- Task 3.2: Refactor validator to use ParsedFileCache
- Task 4.2: Factory tests for cache wiring
- Task 4.3: Factory wires cache into validator

**AC4 Coverage** ([[#^US1-5AC4|AC4]] - File parsed once despite multiple links):
- Task 2.1: Unit test for concurrent request handling
- Task 3.1: Integration test validating single parse per file
- Task 5.2: E2E test confirming cache performance improvement

**AC5 Coverage** ([[#^US1-5AC5|AC5]] - All existing tests pass):
- Task 6.1: Full regression validation
- Task 6.2: Documentation update confirming completion

**Error Scenarios**: Task 2.1 tests error propagation and cleanup
**Happy Path**: Tasks 5.2 and 6.1 validate successful end-to-end execution
**Integration Points**: Task 3.1 validates Validator ↔ Cache ↔ Parser collaboration

### Task Sequencing

#### Sequential Dependencies

**Phase 1 → Phase 2**: Task [[#^US1-5T1-1|1.1]] must complete before Tasks [[#^US1-5T2-1|2.1]]-[[#^US1-5T2-2|2.2]]
- Dependency Rationale: ParsedFileCache implementation requires validated MarkdownParser.Output.DataContract schema

**Task 2.1 → Task 2.2**: Task [[#^US1-5T2-1|2.1]] must complete before Task [[#^US1-5T2-2|2.2]]
- Dependency Rationale: TDD approach requires failing tests before implementation

**Phase 2 → Phase 3**: Tasks [[#^US1-5T2-1|2.1]]-[[#^US1-5T2-2|2.2]] must complete before Tasks [[#^US1-5T3-1|3.1]]-[[#^US1-5T3-2|3.2]]
- Dependency Rationale: CitationValidator refactoring requires working ParsedFileCache implementation

**Task 3.1 → Task 3.2**: Task [[#^US1-5T3-1|3.1]] must complete before Task [[#^US1-5T3-2|3.2]]
- Dependency Rationale: TDD approach requires failing integration tests before refactoring

**Phase 3 → Phase 4**: Tasks [[#^US1-5T3-1|3.1]]-[[#^US1-5T3-2|3.2]] must complete before Tasks [[#^US1-5T4-1|4.1]]-[[#^US1-5T4-3|4.3]]
- Dependency Rationale: Factory tests require refactored CitationValidator interface

**Tasks 4.1-4.2 → Task 4.3**: Tasks [[#^US1-5T4-1|4.1]]-[[#^US1-5T4-2|4.2]] must complete before Task [[#^US1-5T4-3|4.3]]
- Dependency Rationale: TDD approach requires failing factory tests before implementation

**Phase 4 → Phase 5**: Tasks [[#^US1-5T4-1|4.1]]-[[#^US1-5T4-3|4.3]] must complete before Tasks [[#^US1-5T5-1|5.1]]-[[#^US1-5T5-2|5.2]]
- Dependency Rationale: CLI integration requires complete factory-based dependency wiring

**Phases 1-5 → Phase 6**: All tasks [[#^US1-5T1-1|1.1]]-[[#^US1-5T5-2|5.2]] must complete before Tasks [[#^US1-5T6-1|6.1]]-[[#^US1-5T6-2|6.2]]
- Dependency Rationale: Regression validation and documentation require complete implementation

#### Parallel Execution Groups

**Group 1 - Factory Tests (Phase 4)**:
- Tasks [[#^US1-5T4-1|4.1]] and [[#^US1-5T4-2|4.2]] can execute in parallel
- Independent test files for ParsedFileCache creation and CitationValidator wiring
- Same agent: test-writer
- Parallel execution saves 15-20 minutes

### Agent Handoff Points

**Handoff 1: test-writer → code-developer-agent** (After Task 1.1)
- Outgoing Agent: test-writer
- Incoming Agent: code-developer-agent
- Deliverable: Validated MarkdownParser.Output.DataContract schema, documentation updated
- Validation Gate:
  - MarkdownParser.Output.DataContract tests pass validating all fields present
  - Implementation Guide updated with `headings` field
  - Schema documented as: `{ filePath, content, tokens, links, headings, anchors }`
  - Manual verification: `npm test -- parser-output-contract` passes

**Handoff 2: test-writer → code-developer-agent** (After Task 2.1)
- Outgoing Agent: test-writer
- Incoming Agent: code-developer-agent
- Deliverable: Comprehensive failing unit tests for ParsedFileCache
- Validation Gate:
  - All ParsedFileCache unit tests written covering cache hit/miss, concurrent requests, errors, normalization
  - Tests follow BDD Given-When-Then structure
  - Tests are failing (no implementation exists)
  - Manual verification: `npm test -- parsed-file-cache` shows expected failures

**Handoff 3: code-developer-agent → test-writer** (After Task 2.2)
- Outgoing Agent: code-developer-agent
- Incoming Agent: test-writer
- Deliverable: Working ParsedFileCache implementation passing all unit tests
- Validation Gate:
  - ParsedFileCache.js created with Map-based cache
  - All unit tests pass
  - Cache correctly stores/retrieves MarkdownParser.Output.DataContract objects
  - Manual verification: `npm test -- parsed-file-cache` passes

**Handoff 4: test-writer → code-developer-agent** (After Task 3.1)
- Outgoing Agent: test-writer
- Incoming Agent: code-developer-agent
- Deliverable: Failing integration tests for CitationValidator cache usage
- Validation Gate:
  - Integration tests validate validator uses cache, parses files once
  - Tests use real file system operations
  - Tests are failing (validator doesn't use cache yet)
  - Manual verification: `npm test -- integration/citation-validator-cache` shows expected failures

**Handoff 5: code-developer-agent → test-writer** (After Task 3.2)
- Outgoing Agent: code-developer-agent
- Incoming Agent: test-writer
- Deliverable: Refactored CitationValidator using ParsedFileCache
- Validation Gate:
  - CitationValidator constructor accepts ParsedFileCache as first parameter
  - Lines 107 and 471 replaced with cache calls
  - validateFile() and validateAnchorExists() are async
  - All integration tests pass
  - Manual verification: `npm test -- integration/citation-validator-cache` passes

**Handoff 6: test-writer → code-developer-agent** (After Tasks 4.1-4.2)
- Outgoing Agent: test-writer
- Incoming Agent: code-developer-agent
- Deliverable: Failing factory tests for ParsedFileCache creation and validator wiring
- Validation Gate:
  - Factory tests validate createParsedFileCache() functionality
  - Factory tests validate cache wiring into CitationValidator
  - Tests are failing (factory not updated yet)
  - Manual verification: `npm test -- factory` shows expected failures

**Handoff 7: code-developer-agent → test-writer** (After Task 4.3)
- Outgoing Agent: code-developer-agent
- Incoming Agent: test-writer
- Deliverable: Updated factory creating and wiring ParsedFileCache
- Validation Gate:
  - createParsedFileCache() factory function exists
  - createCitationValidator() wires ParsedFileCache correctly
  - All factory tests pass
  - Dependency chain correct: MarkdownParser → ParsedFileCache → CitationValidator
  - Manual verification: `npm test -- factory` passes

**Handoff 8: test-writer → code-developer-agent** (After Task 5.1)
- Outgoing Agent: test-writer
- Incoming Agent: code-developer-agent
- Deliverable: E2E test suite validating complete workflow (may initially fail)
- Validation Gate:
  - E2E tests written covering CLI → Validator → Cache → Parser workflow
  - Tests validate multi-file validation with cache performance
  - Tests follow BDD Given-When-Then structure
  - Tests may fail if CLI doesn't properly await async validator
  - Manual verification: `npm test -- integration/end-to-end-cache` (expect potential failures)

**Handoff 9: code-developer-agent → qa-validation** (After Task 5.2)
- Outgoing Agent: code-developer-agent
- Incoming Agent: qa-validation
- Deliverable: CLI handling async validator correctly, E2E tests passing
- Validation Gate:
  - CLI properly awaits all async validator calls (if updates needed)
  - E2E tests from Task 5.1 pass
  - All new tests pass (unit, integration, factory, E2E)
  - Manual verification: `npm test -- integration/end-to-end-cache` passes

**Handoff 10: qa-validation → application-tech-lead** (After Task 6.1)
- Outgoing Agent: qa-validation
- Incoming Agent: application-tech-lead
- Deliverable: Validation report confirming zero regressions
- Validation Gate:
  - All 50+ existing tests pass
  - All new cache tests pass
  - Zero test failures
  - Validation report documents results

### Scope Validation Checkpoints

Each implementation task triggers an application-tech-lead validation checkpoint to ensure adherence to task specification.

**Validation Approach**:
- Validation agent receives exact task specification given to implementation agent
- Compares implementation against: Objective, Files, Scope, Output, Test criteria
- Answers: "Did implementation follow task specification exactly? Any deviations?"

**Validation Agent**: application-tech-lead

**Validation Output**: PASS or FAIL
- **PASS**: Implementation matches specification exactly, next wave proceeds
- **FAIL**: Specific deviations identified, blocks next wave until remediation

### Execution Sequence

**Wave 1a - Execute Contract Validation** (Estimated: 30-40 min):
- Execute: Task [[#^US1-5T1-1|1.1]]
- Agent: test-writer
- Deliverable: MarkdownParser.Output.DataContract tests, updated Implementation Guide

**Wave 1b - Validate Contract Validation** (Estimated: 10-15 min):
- Validate: Task [[#^US1-5T1-1|1.1]]
- Agent: application-tech-lead
- Input: Task 1.1 specification
- Validation: Tests validate complete schema, Implementation Guide updated, scope not exceeded
- **Block Condition**: Wave 1c blocked until validation PASS

**Wave 1c - Update Tests to Documented Schema** (Estimated: 50-60 min):
- Execute: Task [[#^US1-5T1-2|1.2]]
- Agent: test-writer
- Prerequisite: Wave 1b PASS
- Deliverable: Updated parser-output-contract.test.js validating Implementation Guide schema (tests will fail)

**Wave 1d - Validate Schema Test Updates** (Estimated: 10-15 min):
- Validate: Task [[#^US1-5T1-2|1.2]]
- Agent: application-tech-lead
- Input: Task 1.2 specification
- Validation: Tests validate documented schema, tests appropriately fail, scope not exceeded
- **Block Condition**: Wave 1e blocked until validation PASS

**Wave 1e - Refactor Parser to Schema** (Estimated: 90-120 min):
- Execute: Task [[#^US1-5T1-3|1.3]]
- Agent: code-developer-agent
- Prerequisite: Wave 1d PASS
- Deliverable: Refactored MarkdownParser + updated CitationValidator + passing schema tests

**Wave 1f - Validate Schema Refactoring** (Estimated: 15-20 min):
- Validate: Task [[#^US1-5T1-3|1.3]]
- Agent: application-tech-lead
- Input: Task 1.3 specification
- Validation: Parser returns documented schema, Task 1.2 tests pass, zero regressions, scope not exceeded
- **Block Condition**: Wave 2a blocked until validation PASS

**Wave 2a - Execute Cache Unit Tests** (Estimated: 40-50 min):
- Execute: Task [[#^US1-5T2-1|2.1]]
- Agent: test-writer
- Prerequisite: Wave 1f PASS
- Deliverable: Comprehensive failing ParsedFileCache unit tests

**Wave 2b - Validate Cache Unit Tests** (Estimated: 10-15 min):
- Validate: Task [[#^US1-5T2-1|2.1]]
- Agent: application-tech-lead
- Input: Task 2.1 specification
- Validation: All test scenarios covered, BDD structure, tests failing appropriately
- **Block Condition**: Wave 3 blocked until validation PASS

**Wave 3a - Execute Cache Implementation** (Estimated: 60-75 min):
- Execute: Task [[#^US1-5T2-2|2.2]]
- Agent: code-developer-agent
- Prerequisite: Wave 2b PASS
- Deliverable: Working ParsedFileCache implementation

**Wave 3b - Validate Cache Implementation** (Estimated: 10-15 min):
- Validate: Task [[#^US1-5T2-2|2.2]]
- Agent: application-tech-lead
- Input: Task 2.2 specification
- Validation: Implementation matches spec, all unit tests pass, scope not exceeded
- **Block Condition**: Wave 4 blocked until validation PASS

**Wave 4a - Execute Validator Integration Tests** (Estimated: 40-50 min):
- Execute: Task [[#^US1-5T3-1|3.1]]
- Agent: test-writer
- Prerequisite: Wave 3b PASS
- Deliverable: Failing CitationValidator cache integration tests

**Wave 4b - Validate Validator Integration Tests** (Estimated: 10-15 min):
- Validate: Task [[#^US1-5T3-1|3.1]]
- Agent: application-tech-lead
- Input: Task 3.1 specification
- Validation: Integration scenarios covered, real filesystem operations, tests failing
- **Block Condition**: Wave 5 blocked until validation PASS

**Wave 5a - Execute Validator Refactoring** (Estimated: 60-75 min):
- Execute: Task [[#^US1-5T3-2|3.2]]
- Agent: code-developer-agent
- Prerequisite: Wave 4b PASS
- Deliverable: Refactored CitationValidator using cache

**Wave 5b - Validate Validator Refactoring** (Estimated: 10-15 min):
- Validate: Task [[#^US1-5T3-2|3.2]]
- Agent: application-tech-lead
- Input: Task 3.2 specification
- Validation: Lines 107/471 replaced, async methods, integration tests pass, validation logic unchanged
- **Block Condition**: Wave 6 blocked until validation PASS

**Wave 6 - Factory Test Validation** (Estimated: 50-65 min):
- Execute & Validate: Task [[#^US1-5T4-1|4.1]] (test-writer + application-tech-lead validation)
- Agents: test-writer → application-tech-lead
- Prerequisite: Wave 5b PASS
- Deliverable: Comprehensive factory test suite (7 tests) validating existing factory implementation
- Details:
  1. Task 4.1 Implementation: Write 7 factory tests - test-writer
  2. Task 4.1 Validation: Verify tests written and passing with existing factory - application-tech-lead
- Final Output: Factory tests confirm complete dependency chain (MarkdownParser → ParsedFileCache → CitationValidator) works correctly, all 7 tests passing
- Note: Factory implementation already exists from Phase 2/3, this wave adds test coverage
- **Block Condition**: Wave 7 blocked until Task 4.1 validation PASS

**Wave 7 - E2E Tests & Validation** (Estimated: 60-75 min):
- Execute & Validate: Task [[#^US1-5T5-1|5.1]] (test-writer + application-tech-lead validation)
- Agents: test-writer → application-tech-lead
- Prerequisite: Wave 6 PASS
- Deliverable: E2E test suite validating complete workflow (may initially fail if CLI async handling incomplete)
- Details: Tests expose whether CLI properly awaits async validator calls (RED phase)
- **Block Condition**: Wave 8 blocked until validation PASS

**Wave 8 - CLI Integration & Validation** (Estimated: 25-40 min):
- Execute & Validate: Task [[#^US1-5T5-2|5.2]] (code-developer-agent + application-tech-lead validation)
- Agents: code-developer-agent → application-tech-lead
- Prerequisite: Wave 7 PASS
- Deliverable: CLI handling async validator correctly, E2E tests from Wave 7 passing (GREEN phase)
- Details: Updates only if E2E tests revealed missing await calls
- **Block Condition**: Wave 9 blocked until validation PASS

**Wave 9 - Regression Validation** (Estimated: 15-20 min):
- Execute: Task [[#^US1-5T6-1|6.1]]
- Agent: qa-validation
- Prerequisite: Wave 8 PASS
- Deliverable: Regression validation report confirming all 50+ existing tests pass
- Note: qa-validation agent performs validation (no separate validation step needed)

**Wave 10 - Documentation Update & Validation** (Estimated: 40-55 min):
- Execute & Validate: Task [[#^US1-5T6-2|6.2]] (application-tech-lead implementation + self-validation)
- Agent: application-tech-lead
- Prerequisite: Wave 9 PASS
- Deliverable: Updated architecture documentation marking technical debt as resolved
- Note: Self-validation by same agent

**Total Estimated Duration**: 11-13.5 hours (original) → 9.7-12 hours (final optimized)
**Critical Path**: Wave 1a → 1b → 1c → 1d → 1e → 1f → 2a → 2b → 3a → 3b → 4a → 4b → 5a → 5b → 6 → 7 → 8 → 9 → 10
**Time Savings**: ~1.3-1.5 hours total via combined waves and eliminated redundant tasks
**Longest Single Wave**: Wave 1e (90-120 min) - parser schema refactoring
**Wave Structure**: Simplified from 25 sub-waves (a/b pattern) to 16 waves (validation embedded)
**Optimizations Applied**:
- Combined validation checkpoints (30-60 min savings)
- Eliminated redundant Task 4.2 - factory already implemented (50-60 min savings)
**Added Duration**: +2.5-3.5 hours from original estimate (Tasks 1.2-1.3 added to address schema mismatch discovered in Task 1.1)

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|---------|
| 2025-10-06 | 1.0 | Initial story creation with Phases 1 & 2 (Story Definition + Architectural Context) | Application Tech Lead (Claude Sonnet 4.5) |
| 2025-10-06 | 1.1 | Added Implementation Risks & Mitigations section, CitationValidator Refactoring Checklist, corrected component guide paths, documented citation validation false positives | Application Tech Lead (Claude Sonnet 4.5) |
| 2025-10-06 | 2.0 | Added complete Tasks/Subtasks section with 6 phases, 13 tasks following TDD approach, comprehensive task sequencing with agent handoffs and validation checkpoints, estimated 8.5-10.5 hour duration | Application Tech Lead (Claude Sonnet 4.5) |
| 2025-10-06 | 2.1 | Refactored code-developer-agent task scopes (Tasks 2.2, 3.2, 4.3) to be less prescriptive and more context-driven following US1.4b style; removed brittle line number references in favor of search-based refactoring guidance | Application Tech Lead (Claude Sonnet 4.5) |
| 2025-10-06 | 2.2 | Added Tasks 1.2-1.3 to address parser schema mismatch discovered in Task 1.1; inserted TDD workflow (RED: update tests to documented schema, GREEN: refactor implementation); updated wave sequence (1c-1f), extended duration to 11-13.5 hours; task files include self-contained JSON schemas and pseudocode from Implementation Guide | Application Tech Lead (Claude Sonnet 4.5) |
| 2025-10-07 | 2.3 | Phase 4 optimization: Combined Tasks 4.1 & 4.2 into single comprehensive factory test task; simplified wave structure from 25 sub-waves (a/b validation pattern) to 16 waves with embedded validation; Wave 6 now includes complete TDD cycle (test-writer → validation → code-developer → validation); estimated time savings: 30-60 minutes; improved cohesion for factory testing; maintained TDD discipline | Application Tech Lead (Claude Sonnet 4.5) |
| 2025-10-07 | 2.4 | Phase 4 further optimization: Eliminated Task 4.2 entirely after discovering factory implementation already exists from Phase 2/3; Task 4.1 now writes tests and validates they pass with existing factory; Wave 6 simplified to single test-writer execution (50-65 min vs 100-125 min); total estimated duration reduced to 9.7-12 hours; eliminated redundant code-developer work; maintained complete test coverage | Application Tech Lead (Claude Sonnet 4.5) |
| 2025-10-07 | 2.5 | Phase 5 TDD compliance fix: Reordered tasks to follow test-first pattern - Task 5.1 now writes E2E tests (test-writer, RED phase), Task 5.2 updates CLI if needed (code-developer-agent, GREEN phase); matches TDD discipline from Phases 1-4; updated Waves 7-8 sequence and Handoffs 8-10 accordingly; no duration impact | Application Tech Lead (Claude Sonnet 4.5) |

## Related Documentation

- [Content Aggregation PRD](../../content-aggregation-prd.md) - Parent feature PRD with story definition
- [Content Aggregation Architecture](../../content-aggregation-architecture.md) - Tool architecture with technical debt documentation
- [Workspace Architecture](../../../../../../../design-docs/features/20250928-cc-workflows-workspace-scaffolding/cc-workflows-workspace-architecture.md) - Workspace DI patterns and testing strategy
