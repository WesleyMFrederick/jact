---
story: "User Story 1.6: Refactor MarkdownParser.Output.DataContract - Eliminate Duplicate Anchor Entries"
epic: "Citation Manager Test Migration & Content Aggregation"
phase: "Phase 1: AnchorObject Schema Tests (RED Phase - TDD)"
task-id: "1.2"
task-anchor: "^US1-6T1-2"
wave: "1"
implementation-agent: "test-writer"
evaluation-agent: "application-tech-lead"
status: "Done"
---

# Task 1.2: Write CitationValidator Anchor Matching Integration Tests

## Objective

Create integration tests validating CitationValidator can match anchors using both `id` (raw) and `urlEncodedId` (Obsidian-compatible) fields. Tests will fail (RED phase) showing validator doesn't check both ID fields yet.

**Link**: [Task 1.2 in US1.6](../us1.6-refactor-anchor-schema.md#^US1-6T1-2)

## Current State → Required State

### BEFORE: No Dual ID Matching Tests

```javascript
// File: tools/citation-manager/test/integration/ (no such file exists)
// Current state: No integration tests for dual ID anchor matching
// ❌ No tests validating raw format matching: #Story 1.5: Implement Cache
// ❌ No tests validating URL-encoded format matching: #Story%201.5%20Implement%20Cache
// ❌ No tests confirming both formats match SAME anchor object
```

### AFTER: Required Integration Tests

```javascript
// File: tools/citation-manager/test/integration/citation-validator-anchor-matching.test.js
// New integration test suite

import { describe, expect, it } from "vitest";
import { createCitationValidator } from "../../src/factories/componentFactory.js";

describe("CitationValidator Anchor Matching with Dual IDs", () => {
 it("should match anchor using raw ID format", async () => {
  // Given: Validator with test fixture containing header "Story 1.5: Implement Cache"
  const validator = /* createCitationValidator() */;
  const testFile = /* path to fixture with header */;

  // When: Validate link using RAW format: #Story 1.5: Implement Cache
  const result = /* await validator.validateFile(testFile) */;

  // Then: Validation succeeds (finds anchor by id field)
  const linkResult = /* find result for this anchor */;
  expect(linkResult.status).toBe("valid");
 });

 it("should match anchor using URL-encoded ID format", async () => {
  // Given: Same fixture with "Story 1.5: Implement Cache" header
  const validator = /* createCitationValidator() */;
  const testFile = /* path to fixture */;

  // When: Validate link using URL-ENCODED format: #Story%201.5%20Implement%20Cache
  const result = /* await validator.validateFile(testFile) */;

  // Then: Validation succeeds (finds anchor by urlEncodedId field)
  const linkResult = /* find result for this anchor */;
  expect(linkResult.status).toBe("valid");
 });

 it("should match both ID formats to same anchor object", async () => {
  // Given: Fixture with header "Story 1.5: Implement Cache"
  const validator = /* createCitationValidator() */;
  const testFile = /* path to fixture */;

  // When: Validate both raw and encoded formats
  const rawResult = /* validate raw format link */;
  const encodedResult = /* validate encoded format link */;

  // Then: Both succeed (both match SAME underlying anchor)
  expect(rawResult.status).toBe("valid");
  expect(encodedResult.status).toBe("valid");
  // Both should reference same anchor object in parsed data
 });

 it("should fail validation when anchor not found in either ID field", async () => {
  // Given: Validator with fixture
  const validator = /* createCitationValidator() */;
  const testFile = /* path to fixture */;

  // When: Validate link to non-existent anchor
  const result = /* validate link with invalid anchor */;

  // Then: Validation fails with suggestions
  const linkResult = /* find result */;
  expect(linkResult.status).toBe("error");
  expect(linkResult.error).toContain("Anchor not found");
 });
});
```

### Problems

- ❌ No integration tests for dual ID anchor matching
- ❌ No validation that both `id` and `urlEncodedId` are checked
- ❌ No test fixtures with headers containing special characters
- ❌ No tests confirming backward compatibility with existing validation

### Improvements

- ✅ Integration tests validate dual ID matching logic
- ✅ Tests confirm both raw and URL-encoded formats work
- ✅ Tests use factory-created validator with real dependencies
- ✅ Tests follow BDD Given-When-Then structure
- ✅ Tests will FAIL until CitationValidator updated (RED phase)

### Required Changes by Component

**File**: `tools/citation-manager/test/integration/citation-validator-anchor-matching.test.js` (CREATE)
- Add test: "should match anchor using raw ID format"
  - Create fixture with header "Story 1.5: Implement Cache"
  - Validate link using raw format: `#Story 1.5: Implement Cache`
  - Assert validation succeeds

- Add test: "should match anchor using URL-encoded ID format"
  - Use same fixture
  - Validate link using encoded format: `#Story%201.5%20Implement%20Cache`
  - Assert validation succeeds

- Add test: "should match both ID formats to same anchor object"
  - Validate both formats
  - Assert both succeed
  - Confirm both reference same anchor

- Add test: "should fail validation when anchor not found in either ID field"
  - Validate link to non-existent anchor
  - Assert error status with suggestions

**File**: `tools/citation-manager/test/fixtures/anchor-matching.md` (CREATE)
- Add header: "## Story 1.5: Implement Cache"
- Add link using raw format: `[Link 1](#Story 1.5: Implement Cache)`
- Add link using encoded format: `[Link 2](#Story%201.5%20Implement%20Cache)`
- Add link to non-existent anchor: `[Link 3](#NonExistent)`

### Do NOT modify

- ❌ Existing integration tests in `test/integration/`
- ❌ CitationValidator source code (implementation in Task 3.1)
- ❌ MarkdownParser source code (implementation in Task 2.1)
- ❌ Factory code (unless required for test setup)

### Scope Boundaries

❌ **Testing validation features beyond anchor matching** (focus: dual ID only)
❌ **Modifying existing CitationValidator tests** (create new integration tests)
❌ **Implementing validator changes** (tests define expected behavior)
❌ **Creating complex multi-file test scenarios** (single fixture sufficient)

**Validation Commands**:

```bash
# Should show ONLY new integration test file
git status --short test/integration/citation-validator-anchor-matching.test.js
# Expected: ?? test/integration/citation-validator-anchor-matching.test.js

# Should show new fixture file
git status --short test/fixtures/anchor-matching.md
# Expected: ?? test/fixtures/anchor-matching.md

# Should NOT modify CitationValidator source
git status --short src/CitationValidator.js
# Expected: empty output
```

## Validation

### Verify Changes

```bash
# 1. Run new integration tests (should FAIL - RED phase)
npm test -- integration/citation-validator-anchor-matching
# Expected output:
# - New tests added: 4
# - New tests failing: 3 (encoded format tests fail, raw format may pass)
# - Error: "anchor.urlEncodedId is undefined" or similar

# 2. Verify test file exists
ls -la tools/citation-manager/test/integration/citation-validator-anchor-matching.test.js
# Expected: file exists

# 3. Verify fixture created
cat tools/citation-manager/test/fixtures/anchor-matching.md | grep "Story 1.5"
# Expected: "## Story 1.5: Implement Cache"

# 4. Confirm tests use BDD structure
grep -c "// Given:" tools/citation-manager/test/integration/citation-validator-anchor-matching.test.js
# Expected: 4 (one per test)
```

### Expected Test Behavior

```bash
# Tests should FAIL showing validator doesn't check urlEncodedId:
npm test -- integration/citation-validator-anchor-matching 2>&1 | grep "urlEncodedId"
# Expected output showing: "Cannot read property 'urlEncodedId'" or similar

# Raw format test might PASS (current validator checks id field):
npm test -- integration/citation-validator-anchor-matching 2>&1 | grep "raw ID format"
# Expected: May show PASS or FAIL depending on current implementation
```

### Success Criteria

- ✅ New integration test file created: `citation-validator-anchor-matching.test.js`
- ✅ 4 tests added validating dual ID matching
- ✅ Tests use factory-created validator (real dependencies)
- ✅ Test fixture created with header containing special characters
- ✅ Tests follow BDD Given-When-Then comment structure
- ✅ Tests FAIL appropriately (RED phase) - validator doesn't check both IDs yet
- ✅ No modifications to CitationValidator source code

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

Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)

### Debug Log References

No debug logs required - implementation completed successfully on first attempt after fixture structure adjustment.

### Completion Notes

Task completed successfully. Created integration test suite following TDD RED phase principles - tests demonstrate that validator currently only matches raw ID format but not URL-encoded format, establishing clear requirements for future implementation.

Key implementation decision: Used cross-document links (not internal links) because MarkdownParser.extractLinks() currently only extracts cross-document references. Created two fixtures:
- `anchor-matching.md` - Target file with header containing special characters
- `anchor-matching-source.md` - Source file with cross-document links using both ID formats

### File List

**Created**:
- `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/cc-workflows/tools/citation-manager/test/integration/citation-validator-anchor-matching.test.js` - Integration test suite with 4 tests
- `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/cc-workflows/tools/citation-manager/test/fixtures/anchor-matching.md` - Target fixture with header "Story 1.5: Implement Cache"
- `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/cc-workflows/tools/citation-manager/test/fixtures/anchor-matching-source.md` - Source fixture with cross-document links

**Modified**: None (no production code or existing test files modified)

### Implementation Challenges

**Challenge 1**: Initial fixture used internal markdown links `[text](#anchor)` which are not extracted by MarkdownParser.extractLinks().

**Resolution**: Changed approach to use cross-document links `[text](file.md#anchor)` which the parser does extract. Created separate source and target fixture files to enable cross-document link testing.

**Challenge 2**: Understanding TDD RED phase expectations - needed to ensure tests would fail appropriately.

**Resolution**: Confirmed current implementation creates two separate anchor objects (one with raw ID, one with URL-encoded ID) and validator only checks `anchor.id` field, not a future `anchor.urlEncodedId` field. Tests correctly fail for URL-encoded format since validator doesn't check both ID fields yet.

### Validation Results

**Git Status Checks**:

```bash
# New integration test file
$ git status --short test/integration/citation-validator-anchor-matching.test.js
?? test/integration/citation-validator-anchor-matching.test.js
✓ PASS

# New fixture files
$ git status --short test/fixtures/anchor-matching.md
?? test/fixtures/anchor-matching.md
✓ PASS

$ git status --short test/fixtures/anchor-matching-source.md
?? test/fixtures/anchor-matching-source.md
✓ PASS

# CitationValidator source unchanged
$ git status --short src/CitationValidator.js
(empty output)
✓ PASS
```

**Test Execution Results**:

```bash
$ npm test -- integration/citation-validator-anchor-matching

Test Results:
✓ should match anchor using raw ID format (10ms) - PASS
✗ should match anchor using URL-encoded ID format (4ms) - FAIL (expected 'valid', received 'error')
✗ should match both ID formats to same anchor object (1ms) - FAIL (expected 'valid', received 'error')
✓ should fail validation when anchor not found in either ID field (0ms) - PASS

Test Files: 1 failed (1)
Tests: 2 failed | 2 passed (4)
```

**BDD Structure Check**:

```bash
$ grep -c "// Given:" test/integration/citation-validator-anchor-matching.test.js
4
✓ PASS - All 4 tests use Given-When-Then structure
```

**Fixture Verification**:

```bash
$ cat test/fixtures/anchor-matching.md | grep "Story 1.5"
## Story 1.5: Implement Cache
✓ PASS - Header with special characters present
```

**Test Behavior Analysis**:
- Raw format test PASSES: Current implementation finds anchor by checking `anchor.id` field
- URL-encoded format test FAILS: Validator doesn't check `urlEncodedId` field (doesn't exist yet)
- Combined test FAILS: URL-encoded portion fails as expected
- Non-existent anchor test PASSES: Error handling works correctly

**RED Phase Confirmation**: ✓ Tests fail appropriately, demonstrating validator needs refactoring to check both ID fields

## Evaluation Agent Instructions

Validate the implementation above against the task specification. Your validation must answer:

**Did implementation follow task specification exactly?**

Reference these specification sections:
- **"Required Changes by Component"**: Verify new integration test file + fixture created
- **"Success Criteria"**: Check all ✅ items pass
- **"Validation" → "Verify Changes"**: Run provided bash commands
- **"Scope Boundaries"**: Confirm no validator source code modifications

Populate the Evaluation Agent Notes section below with your findings.

### Evaluation Agent Notes

> [!attention] **Evaluation Agent:**
> Populate this section during validation execution.

### Validator Model Used

Claude Sonnet 4.5 (claude-sonnet-4-5-20250929) - Application Technical Lead Agent

### Task Specification Compliance

Implementation follows task specification exactly. All required files created with no modifications to existing source code or tests.

**Validation Checklist**:
- [x] Files Modified: Only new integration test + fixture created?
  - VERIFIED: 3 new files created (test + 2 fixtures), 0 existing files modified
  - Git status shows only untracked files: `??` prefix on all new files
- [x] Scope Adherence: No CitationValidator.js modifications?
  - VERIFIED: `git status --short src/CitationValidator.js` returns empty output
  - No source code files modified in entire `src/` directory
- [x] Objective Met: 4 integration tests validate dual ID matching?
  - VERIFIED: 4 tests present in citation-validator-anchor-matching.test.js
  - Test 1: "should match anchor using raw ID format"
  - Test 2: "should match anchor using URL-encoded ID format"
  - Test 3: "should match both ID formats to same anchor object"
  - Test 4: "should fail validation when anchor not found in either ID field"
- [x] Critical Rules: All tests use factory-created validator?
  - VERIFIED: All 4 tests use `createCitationValidator()` from componentFactory
  - No mock dependencies, tests use real integration components
- [x] Integration Points: Tests fail appropriately (RED phase)?
  - VERIFIED: 2 tests fail (URL-encoded format tests), 2 tests pass
  - Failures show validator returns 'error' instead of 'valid' for encoded format
  - Demonstrates validator doesn't support urlEncodedId field yet (expected RED phase)

**Scope Boundary Validation**:
- [x] No modifications to existing integration tests
  - VERIFIED: Only new file in test/integration/ directory
  - `git status --short test/integration/` shows single untracked file
- [x] No validator implementation changes
  - VERIFIED: No changes to src/CitationValidator.js or any src/ files
  - `git status --short src/` returns empty output
- [x] Test fixture minimal (single header + links)
  - VERIFIED: anchor-matching.md contains single header with special characters
  - anchor-matching-source.md contains 3 test links (raw, encoded, non-existent)
  - Fixtures focused solely on anchor matching requirements
- [x] Tests focused on anchor matching only
  - VERIFIED: All tests validate anchor matching behavior exclusively
  - No testing of unrelated validator features
  - Tests align with dual ID matching objective

**Required Changes Verification**:

Files Created (Per Spec):
- [x] `test/integration/citation-validator-anchor-matching.test.js` - Integration test suite
  - Contains all 4 required tests from specification
  - Uses BDD Given-When-Then structure (4 "// Given:" comments found)
  - Uses factory-created validator for real integration testing
- [x] `test/fixtures/anchor-matching.md` - Target fixture
  - Contains header: "## Story 1.5: Implement Cache"
  - Header includes special characters requiring URL encoding
- [x] `test/fixtures/anchor-matching-source.md` - Source fixture
  - Contains link using raw format
  - Contains link using URL-encoded format
  - Contains link to non-existent anchor
  - Note: Implementation correctly used cross-document links instead of internal links (MarkdownParser only extracts cross-document references)

Test Execution Results:

```text
Test Files: 1 failed (1)
Tests: 2 failed | 2 passed (4)

PASS: should match anchor using raw ID format (10ms)
FAIL: should match anchor using URL-encoded ID format (4ms)
FAIL: should match both ID formats to same anchor object (1ms)
PASS: should fail validation when anchor not found in either ID field (0ms)
```

RED Phase Confirmation:
- URL-encoded format tests fail as expected
- Demonstrates current implementation limitation
- Establishes clear requirement for future validator refactoring
- Test failures show 'error' status instead of 'valid' for encoded anchors

**Implementation Quality Notes**:

Strengths:
- Proper TDD RED phase execution - tests fail for the right reasons
- Clean BDD structure with Given-When-Then comments
- Pragmatic solution using cross-document links (adapted to actual parser behavior)
- Minimal fixture design - no unnecessary complexity
- Factory-based integration testing with real dependencies

Trade-offs Documented:
- Implementation agent correctly identified that MarkdownParser.extractLinks() only extracts cross-document references
- Adapted by creating separate source/target fixtures rather than using internal links
- This is a reasonable architectural constraint that doesn't affect test validity

### Validation Outcome

**PASS** - Implementation fully complies with task specification

All success criteria met:
- New integration test file created with 4 tests
- Tests use factory-created validator (real dependencies)
- Test fixtures created with special character header
- Tests follow BDD Given-When-Then structure
- Tests fail appropriately (RED phase) - 2 failures demonstrate validator limitation
- No modifications to CitationValidator source code
- No modifications to existing tests
- Scope boundaries respected

### Remediation Required

None - Implementation is production-ready and meets all specification requirements.
