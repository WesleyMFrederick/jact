---
story: "User Story 1.5: Implement a Cache for Parsed File Objects"
epic: "Citation Manager Test Migration & Content Aggregation"
phase: "Phase 2: ParsedFileCache Unit Tests & Implementation (TDD)"
task-id: "2.1"
task-anchor: "^US1-5T2-1"
wave: "2a"
implementation-agent: "test-writer"
evaluation-agent: "application-tech-lead"
status: "Done"
---

# Task 2.1: Write ParsedFileCache Unit Tests

## Objective

Write comprehensive failing unit tests for ParsedFileCache component covering cache hit/miss, concurrent requests, error propagation, and path normalization.

_Source: [US1.5 Task 2.1](../us1.5-implement-cache-for-parsed-files.md#^US1-5T2-1)_

## Current State → Required State

### BEFORE: No ParsedFileCache Tests

```javascript
// tools/citation-manager/test/ directory structure
test/
├── parser-output-contract.test.js
├── validation.test.js
├── enhanced-citations.test.js
└── fixtures/
    └── valid-citations.md
```

**Problems:**
- No test coverage for ParsedFileCache component
- Cannot validate cache hit/miss behavior
- Cannot verify concurrent request handling
- Cannot validate error propagation and cleanup

### AFTER: Complete ParsedFileCache Unit Test Suite

```javascript
// tools/citation-manager/test/parsed-file-cache.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { ParsedFileCache } from '../src/ParsedFileCache.js';
import { createMarkdownParser } from '../src/factories/componentFactory.js';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('ParsedFileCache', () => {
  let parser;
  let cache;

  beforeEach(() => {
    parser = createMarkdownParser();
    cache = new ParsedFileCache(parser);
  });

  it('should parse file on cache miss and store result', async () => {
    // Given: Empty cache, test fixture file
    const testFile = join(__dirname, 'fixtures', 'valid-citations.md');

    // When: First request for file
    const result = await cache.resolveParsedFile(testFile);

    // Then: MarkdownParser.Output.DataContract returned
    expect(result).toHaveProperty('filePath');
    expect(result).toHaveProperty('content');
    expect(result).toHaveProperty('tokens');
    ...
  });

  it('should return cached result on cache hit without re-parsing', async () => {
    // Given: File already in cache
    // When: Second request for same file
    // Then: Same object instance returned, parser called once
    ...
  });

  it('should handle concurrent requests with single parse', async () => {
    // Given: Empty cache
    // When: Multiple simultaneous requests for same file
    // Then: Parser called once, all promises resolve to same result
    ...
  });

  it('should propagate parser errors and remove from cache', async () => {
    // Given: File that will cause parse error
    // When: Request to parse invalid file
    // Then: Promise rejects, cache entry removed
    ...
  });

  it('should normalize file paths for consistent cache keys', async () => {
    // Given: Same file referenced with different path formats
    // When: Request with relative vs absolute paths
    // Then: Treated as same cache entry
    ...
  });

  it('should cache different files independently', async () => {
    // Given: Multiple different test files
    // When: Parse each file
    // Then: Each cached separately
    ...
  });
});
```

**Improvements:**
- Complete unit test coverage for ParsedFileCache component
- Validates cache hit/miss behavior per AC1 and AC2
- Tests concurrent request handling (multiple requests → single parse)
- Verifies error propagation and cache cleanup
- Validates path normalization for consistent cache keys
- Uses real test fixtures from test/fixtures/ directory
- Follows BDD Given-When-Then structure

### Required Changes by Component

**Create: `tools/citation-manager/test/parsed-file-cache.test.js`**

Create comprehensive unit test suite with 6 test cases:

1. **Cache Miss Test**: Verify first request parses file and stores MarkdownParser.Output.DataContract in cache
2. **Cache Hit Test**: Verify second request returns cached object without re-parsing (validate parser called only once using spy/mock)
3. **Concurrent Request Test**: Verify multiple simultaneous requests trigger only one parse operation and all resolve to same result
4. **Error Propagation Test**: Verify parser errors are propagated correctly and failed promises removed from cache
5. **Path Normalization Test**: Verify relative paths, `./` prefixes, redundant separators normalized to consistent cache keys
6. **Independent Cache Test**: Verify different files cached separately with no interference

All tests must:
- Use factory-created MarkdownParser (`createMarkdownParser()`)
- Use real test fixtures from `test/fixtures/` directory
- Follow BDD Given-When-Then comment structure
- Use Vitest framework (`describe`, `it`, `expect`, `beforeEach`)
- Currently FAIL (no ParsedFileCache implementation exists yet)

**Do NOT Modify:**
- Existing test files (parser-output-contract.test.js, validation.test.js, etc.)
- Test fixtures directory structure
- Factory functions (componentFactory.js)
- MarkdownParser implementation

### Scope Boundaries

#### Explicitly OUT OF SCOPE

❌ **Creating ParsedFileCache implementation** (Task 2.2 responsibility)

```javascript
// ❌ VIOLATION: Don't create implementation
// tools/citation-manager/src/ParsedFileCache.js
export class ParsedFileCache { ... }
```

❌ **Modifying existing tests** (maintain test suite integrity)

❌ **Adding integration tests** (Task 3.1 responsibility - CitationValidator integration)

❌ **Creating new test fixtures** (use existing fixtures from test/fixtures/)

❌ **Modifying factory functions** (Task 4.3 responsibility)

#### Validation Commands

```bash
# Verify only parsed-file-cache.test.js created
git status --short | grep "^??"
# Expected: ?? tools/citation-manager/test/parsed-file-cache.test.js

# Verify no modifications to existing files
git status --short | grep "^ M" | grep -v "us1.5-implement-cache-for-parsed-files.md"
# Expected: empty (story file update is allowed)

# Verify tests fail (no implementation)
npm test -- parsed-file-cache
# Expected: All tests fail with "ParsedFileCache is not defined" or similar
```

## Validation

### Verify Changes

```bash
# Confirm test file created
ls -la tools/citation-manager/test/parsed-file-cache.test.js
# Expected: File exists

# Run new tests (expect failures)
npm test -- parsed-file-cache
# Expected output pattern:
# FAIL tools/citation-manager/test/parsed-file-cache.test.js
#   ParsedFileCache
#     ✗ should parse file on cache miss and store result
#     ✗ should return cached result on cache hit without re-parsing
#     ✗ should handle concurrent requests with single parse
#     ✗ should propagate parser errors and remove from cache
#     ✗ should normalize file paths for consistent cache keys
#     ✗ should cache different files independently
#
# Tests: 0 passed, 6 failed, 6 total

# Verify no impact on existing tests
npm test -- parser-output-contract
# Expected: All parser contract tests still pass (no modifications made)
```

### Expected Test Behavior

```bash
# All ParsedFileCache tests should fail (no implementation)
npm test -- parsed-file-cache 2>&1 | grep "0 passed"
# Expected: "Tests: 0 passed, 6 failed, 6 total"

# Tests should fail with module import error
npm test -- parsed-file-cache 2>&1 | grep -i "cannot find module\|is not defined"
# Expected: Error mentioning ParsedFileCache not found
```

### Success Criteria

**Test Creation:**
- ✅ `parsed-file-cache.test.js` created with 6 comprehensive test cases
- ✅ All tests use BDD Given-When-Then comment structure
- ✅ Tests use factory-created MarkdownParser for integration
- ✅ Tests use real fixtures from `test/fixtures/` directory
- ✅ Tests follow workspace Vitest patterns (describe, it, expect, beforeEach)

**Test Coverage:**
- ✅ Cache miss behavior validated (AC2: first request parses and caches)
- ✅ Cache hit behavior validated (AC1: subsequent requests return cached object)
- ✅ Concurrent request handling validated (multiple requests → single parse)
- ✅ Error propagation validated (parser errors propagated, cache cleaned up)
- ✅ Path normalization validated (relative/absolute paths normalized consistently)
- ✅ Independent caching validated (different files cached separately)

**Test Failure State:**
- ✅ All 6 tests currently fail (no ParsedFileCache implementation exists)
- ✅ Failure reason: ParsedFileCache module not found or class not defined
- ✅ No modifications to existing test files or fixtures
- ✅ Existing parser-output-contract tests still pass

---

## Implementation Agent Instructions

Execute the task specification above. When complete, populate the Implementation Agent Notes section below with:
- Agent model and version used
- Files created/modified
- Implementation challenges encountered
- Validation command results

### Implementation Agent Notes

> [!attention] **AI Agent:**
> Populate this section during implementation execution.

### Agent Model Used
Claude Sonnet 4.5 (claude-sonnet-4-5-20250929) - Test Writer Agent

### Debug Log References
No debug logs generated - straightforward test creation

### Completion Notes
Successfully created comprehensive ParsedFileCache unit test suite with all 6 required test cases following TDD principles. Tests properly fail with module not found error, confirming implementation doesn't exist yet. All tests follow BDD Given-When-Then structure and use real test fixtures.

### File List
**Created:**
- `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/cc-workflows/tools/citation-manager/test/parsed-file-cache.test.js` (6,317 bytes)

**Modified:**
- None (no modifications to existing test files or source code)

### Implementation Challenges
No significant challenges encountered. Implementation was straightforward:
1. Analyzed existing test patterns from `parser-output-contract.test.js`
2. Studied factory structure and available test fixtures
3. Created comprehensive test suite matching workspace conventions
4. Used vitest spy functionality (`vi.spyOn`) for cache hit detection
5. All tests properly structured to fail until implementation exists (Task 2.2)

### Validation Results

**Test File Creation:**

```bash
$ ls -la tools/citation-manager/test/parsed-file-cache.test.js
-rw-r--r--  6317 bytes  Oct  7 09:07
```

**Test Execution (Expected Failures):**

```bash
$ npm test -- parsed-file-cache
FAIL  test/parsed-file-cache.test.js
Error: Cannot find module '../src/ParsedFileCache.js'
Test Files  1 failed (1)
Tests  no tests (cannot collect due to module not found)
```

**Existing Tests Unaffected:**

```bash
$ npm test -- parser-output-contract
✓ test/parser-output-contract.test.js (8 tests passed)
Test Files  1 passed (1)
Tests  8 passed (8)
```

**Git Status Verification:**

```bash
$ git status --short | grep "parsed-file-cache"
?? tools/citation-manager/test/parsed-file-cache.test.js
```

All validation criteria met:
- Test file created with 6 comprehensive test cases
- All tests use BDD Given-When-Then structure
- Tests use factory-created MarkdownParser
- Tests use real fixtures (valid-citations.md, test-target.md, complex-headers.md)
- Tests fail with expected module not found error
- No modifications to existing test files
- Linting checks passed

---

## Evaluation Agent Instructions

Validate the implementation above against the task specification. Your validation must answer:

**Did implementation follow task specification exactly?**

Reference these specification sections:
- **"Required Changes by Component"**: Verify test file created with 6 required test cases
- **"Success Criteria"**: Check all ✅ items pass
- **"Validation" → "Verify Changes"**: Run provided bash commands
- **"Scope Boundaries"**: Confirm no modifications outside allowed scope

Populate the Evaluation Agent Notes section below with your findings.

### Evaluation Agent Notes

> [!attention] **Evaluation Agent:**
> Populate this section during validation execution.

### Validator Model Used
Claude Sonnet 4.5 (claude-sonnet-4-5-20250929) - Application Tech Lead Agent

### Task Specification Compliance
Implementation fully complies with task specification. All required test cases created with proper structure, factory integration, and TDD approach.

**Validation Checklist:**
- [x] Files Modified: Only `parsed-file-cache.test.js` created, no other modifications?
  - PASS: Single test file created at `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/cc-workflows/tools/citation-manager/test/parsed-file-cache.test.js` (6,317 bytes)
- [x] Scope Adherence: No ParsedFileCache implementation created (Task 2.2 responsibility)?
  - PASS: Verified `src/ParsedFileCache.js` does not exist
- [x] Test Count: Exactly 6 test cases covering specified scenarios?
  - PASS: All 6 required test cases present:
    1. Cache miss and store result (lines 19-43)
    2. Cache hit without re-parsing (lines 45-62)
    3. Concurrent requests with single parse (lines 64-90)
    4. Error propagation and cache cleanup (lines 92-103)
    5. Path normalization for consistent keys (lines 105-125)
    6. Independent caching of different files (lines 127-159)
- [x] BDD Structure: All tests use Given-When-Then comment structure?
  - PASS: All tests follow BDD pattern with explicit Given-When-Then comments
- [x] Factory Integration: Tests use `createMarkdownParser()` from factory?
  - PASS: Factory usage confirmed at lines 3 (import) and 15 (instantiation)
- [x] Real Fixtures: Tests use files from `test/fixtures/` directory?
  - PASS: Tests use `valid-citations.md`, `test-target.md`, `complex-headers.md` - all exist in fixtures directory
- [x] Test Failure: All tests currently fail with module/class not found error?
  - PASS: Test execution shows "Cannot find module '../src/ParsedFileCache.js'" error
- [x] Existing Tests: No modifications to parser-output-contract.test.js or other existing tests?
  - PASS: `parser-output-contract.test.js` passes all 8 tests unchanged

**Scope Boundary Validation:**
- [x] No implementation files created (src/ParsedFileCache.js)
  - PASS: File does not exist (verified with ls command)
- [x] No factory modifications (componentFactory.js unchanged)
  - PASS: Factory file not in git modified list
- [x] No new test fixtures created (use existing fixtures)
  - PASS: All fixtures referenced exist in test/fixtures/ directory
- [x] No integration tests created (Task 3.1 responsibility)
  - PASS: Only unit test file created
- [x] git status shows only parsed-file-cache.test.js as new file
  - PASS: Git status shows test file as untracked, no source modifications

**Validation Commands Executed:**

```bash
# Test file exists
$ ls -la tools/citation-manager/test/parsed-file-cache.test.js
-rw-r--r--@ 1 wesleyfrederick  staff  6317 Oct  7 09:07

# Tests fail with expected error
$ npm test -- parsed-file-cache
FAIL  test/parsed-file-cache.test.js
Error: Cannot find module '../src/ParsedFileCache.js'
Test Files  1 failed (1)
Tests  no tests

# Existing tests unaffected
$ npm test -- parser-output-contract
✓ test/parser-output-contract.test.js (8 tests passed)
Test Files  1 passed (1)
Tests  8 passed (8)

# Implementation does not exist
$ ls -la src/ParsedFileCache.js
ls: src/ParsedFileCache.js: No such file or directory

# Fixtures exist
$ ls -la test/fixtures/
valid-citations.md ✓
test-target.md ✓
complex-headers.md ✓
```

### Validation Outcome
**PASS** - Implementation fully complies with task specification

All success criteria met:
- Test file created with 6 comprehensive test cases matching specification
- BDD Given-When-Then structure consistently applied
- Factory-created MarkdownParser integration correct
- Real test fixtures used (valid-citations.md, test-target.md, complex-headers.md)
- Tests fail with expected module not found error (TDD approach)
- No scope violations - no implementation, no fixture creation, no existing test modifications
- Parser contract tests remain passing (8/8)

### Remediation Required
None - Task 2.1 completed successfully per specification
