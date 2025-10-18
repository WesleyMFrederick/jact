---
story: "User Story 1.8: Implement Validation Enrichment Pattern"
epic: "Citation Manager Test Migration & Content Aggregation"
phase: "Phase 1: Validation Enrichment Implementation"
task-id: "1.2"
task-anchor: "#^US1-8T1-2"
wave: "1"
implementation-agent: "test-writer"
status: "ready"
---

# Task 1.2: Write Failing Integration Tests for Validation Enrichment Pattern

## Objective

Write integration tests that validate the Validation Enrichment Pattern contract BEFORE implementation, following TDD principles. Tests SHALL verify that CitationValidator returns `{ summary, links }` structure with enriched LinkObjects containing validation metadata.

_Task Reference_: [US1.8 Task 1.2](../us1.8-implement-validation-enrichment-pattern.md#^US1-8T1-2)

## Current State → Required State

### BEFORE: Current Test Coverage (No Enrichment Pattern Tests)

Current integration tests validate OLD contract (separate validation results):

```javascript
// tools/citation-manager/test/integration/citation-validator-cache.test.js:106-134
it("should produce identical validation results with cache", async () => {
  const directResult = await directValidator.validateFile(fixtureFile);

  // OLD CONTRACT: Separate results array
  expect(cachedResult.summary.total).toBe(directResult.summary.total);
  expect(cachedResult.results.length).toBe(directResult.results.length);

  // Validates SEPARATE result objects, not enriched links
  for (let i = 0; i < directResult.results.length; i++) {
    expect(cachedResult.results[i].status).toBe(directResult.results[i].status);
  }
});
```

**Problems**:
- No tests for NEW `{ summary, links }` contract structure
- No validation of LinkObject enrichment with `validation` property
- Tests expect OLD contract with separate `results` array
- Missing tests for enrichment pattern integrity (validation metadata ON LinkObject)

### AFTER: Integration Tests for Enrichment Pattern (MEDIUM-IMPLEMENTATION)

New integration test file validates enrichment contract:

```javascript
// tools/citation-manager/test/integration/citation-validator-enrichment.test.js (CREATE)
import { describe, it, expect, beforeEach } from "vitest";
import { /* real system dependencies */ } from "...";

describe("CitationValidator Validation Enrichment Pattern", () => {
  let validator;
  let testFixturePath;

  beforeEach(() => {
    // 1. Create real components with DI (no mocks)
    const parser = /* new MarkdownParser with real fs */;
    const cache = /* new ParsedFileCache(parser) */;
    validator = /* new CitationValidator(cache, null) */;

    // 2. Use real fixture file with mixed valid/invalid links
    testFixturePath = /* resolve fixture path */;
  });

  it("should return ValidationResult with summary and enriched links", async () => {
    // Given: Real markdown file with citations
    // When: Validate file using enrichment pattern
    const result = /* await validator.validateFile(testFixturePath) */;

    // Then: Result has correct structure
    expect(result).toHaveProperty("summary");
    expect(result).toHaveProperty("links");
    expect(result).not.toHaveProperty("results"); // OLD contract removed
  });

  it("should enrich valid LinkObjects with validation status", async () => {
    // Given: File with valid citations
    // When: Validation completes
    const { links } = /* await validator.validateFile(...) */;

    // Then: Valid links enriched with status="valid"
    const validLink = /* links.find(link => link has valid target) */;
    expect(validLink).toHaveProperty("validation");
    expect(validLink.validation.status).toBe("valid");
    expect(validLink.validation).not.toHaveProperty("error");
    expect(validLink.validation).not.toHaveProperty("suggestion");
  });

  it("should enrich error LinkObjects with error and suggestion", async () => {
    // Given: File with broken anchor
    // When: Validation completes
    const { links } = /* await validator.validateFile(...) */;

    // Then: Error links enriched with status="error", error message, suggestion
    const errorLink = /* links.find(link => link has broken anchor) */;
    expect(errorLink.validation.status).toBe("error");
    expect(errorLink.validation.error).toContain("Anchor not found");
    expect(errorLink.validation.suggestion).toBeDefined();
  });

  it("should derive summary counts from enriched links", async () => {
    // Given: File with 3 valid, 2 error, 1 warning links
    // When: Validation completes
    const { summary, links } = /* await validator.validateFile(...) */;

    // Then: Summary matches link.validation.status counts
    const manualCounts = {
      total: links.length,
      valid: /* count links where validation.status === "valid" */,
      errors: /* count links where validation.status === "error" */,
      warnings: /* count links where validation.status === "warning" */
    };

    expect(summary.total).toBe(manualCounts.total);
    expect(summary.valid).toBe(manualCounts.valid);
    expect(summary.errors).toBe(manualCounts.errors);
    expect(summary.warnings).toBe(manualCounts.warnings);
  });

  it("should preserve LinkObject base properties from parser", async () => {
    // Given: Validated file
    // When: Retrieve enriched links
    const { links } = /* await validator.validateFile(...) */;

    // Then: Original LinkObject properties unchanged
    const link = links[0];
    expect(link).toHaveProperty("linkType");
    expect(link).toHaveProperty("scope");
    expect(link).toHaveProperty("anchorType");
    expect(link).toHaveProperty("source");
    expect(link).toHaveProperty("target");
    expect(link).toHaveProperty("text");
    expect(link).toHaveProperty("fullMatch");
    expect(link).toHaveProperty("line");
    expect(link).toHaveProperty("column");
    expect(link).toHaveProperty("validation"); // NEW: Added by validator
  });

  it("should support single-object access pattern for validation status", async () => {
    // Given: Component needs both link structure and validation
    // When: Access enriched LinkObject
    const { links } = /* await validator.validateFile(...) */;
    const link = links[0];

    // Then: Single object provides both structure and validation
    const isValid = link.validation.status === "valid";
    const targetFile = link.target.path.absolute;
    const lineNumber = link.line;

    // Verify all data accessible from one object
    expect(isValid).toBeDefined();
    expect(targetFile).toBeDefined();
    expect(lineNumber).toBeGreaterThan(0);
  });
});
```

**Improvements**:
- Tests validate NEW `{ summary, links }` contract structure
- Verifies LinkObject enrichment with `validation` property
- Confirms summary derived from enriched links (no separate tracking)
- Tests single-object access pattern (no data correlation needed)
- Uses real file fixtures following "Real Systems, Fake Fixtures" principle

### Required Changes by Component

**File**: `tools/citation-manager/test/integration/citation-validator-enrichment.test.js` (CREATE)
- Create integration test file for Validation Enrichment Pattern
- Import real components (CitationValidator, MarkdownParser, ParsedFileCache)
- Use real file fixtures from `test/fixtures/` directory
- Implement 6 integration tests validating enrichment contract:
  1. ValidationResult structure test (`summary` + `links`, no `results`)
  2. Valid link enrichment test (status="valid", no error/suggestion)
  3. Error link enrichment test (status="error", error message, suggestion)
  4. Summary derivation test (counts match link.validation.status aggregation)
  5. Base property preservation test (original LinkObject fields unchanged)
  6. Single-object access pattern test (both structure and validation from one object)

**Fixtures Used**: From Task 1.1 - `test/fixtures/enrichment/` directory
- `valid-links-source.md` + `valid-links-target.md` - For valid link enrichment tests
- `error-links-source.md` + `error-links-target.md` - For error link enrichment tests
- `warning-links-source.md` + `warning-links-target.md` - For warning link enrichment tests
- `mixed-validation-source.md` - For comprehensive enrichment pattern tests (uses targets above)

**Do NOT Modify**:
- Existing test files (cache, parsed-document, anchor-matching tests)
- CitationValidator.js implementation (tests written BEFORE implementation)
- Existing fixtures outside enrichment/ directory (Task 1.1 creates new fixtures)

## Scope Boundaries

### Explicitly OUT OF SCOPE

❌ **Implementing enrichment logic** (Task 1.3's responsibility)

```javascript
// ❌ VIOLATION: Don't modify CitationValidator.js
async validateFile(filePath) {
  const links = sourceParsedDoc.getLinks();
  links.forEach(link => link.validation = { /* enrichment */ }); // Task 1.3!
}
```

❌ **Modifying existing integration tests** (preserve current coverage)

```javascript
// ❌ VIOLATION: Don't change citation-validator-cache.test.js
it("should produce identical validation results with cache", async () => {
  // Keep OLD contract assertions for now
  expect(cachedResult.results.length).toBe(directResult.results.length);
});
```

❌ **Creating component unit tests** (integration tests only)

```javascript
// ❌ VIOLATION: Don't create validator unit tests
describe("CitationValidator.enrichLinkWithValidation", () => {
  // This is component unit testing, not integration testing
});
```

❌ **Adding helper test utilities** (use inline test code)

### Validation Commands

```bash
# Verify ONLY new test file created
git status --short | grep "^??"
# Expected output: ?? test/integration/citation-validator-enrichment.test.js

# Verify NO modifications to existing files
git status --short | grep "^ M" | grep -E "(CitationValidator|test)" | wc -l
# Expected: 0 (no existing files modified)

# Verify fixtures from Task 1.1 exist
ls -la tools/citation-manager/test/fixtures/enrichment/*.md
# Expected: 7 fixture files from Task 1.1

# Verify tests FAIL initially (TDD red phase)
npm test -- citation-validator-enrichment
# Expected: All tests fail (implementation not done yet)
```

## Validation

### Verify Changes

```bash
# 1. Verify new test file created
ls -la tools/citation-manager/test/integration/citation-validator-enrichment.test.js
# Expected: File exists with ~150-200 lines

# 2. Verify Task 1.1 fixtures exist (prerequisite)
ls -la tools/citation-manager/test/fixtures/enrichment/*.md
# Expected: 7 fixture files (valid/error/warning sources + targets, mixed source)

# 3. Run failing tests (TDD red phase)
npm test -- citation-validator-enrichment
# Expected output:
#   FAIL test/integration/citation-validator-enrichment.test.js
#   ✗ should return ValidationResult with summary and enriched links
#   ✗ should enrich valid LinkObjects with validation status
#   ✗ should enrich error LinkObjects with error and suggestion
#   ✗ should derive summary counts from enriched links
#   ✗ should preserve LinkObject base properties from parser
#   ✗ should support single-object access pattern
#   Tests: 6 failed, 6 total

# 4. Verify existing tests still pass
npm test -- citation-validator-cache
# Expected: All existing integration tests pass (no regressions)
```

### Expected Test Behavior

**TDD Red Phase** (This Task):
- New enrichment tests FAIL (expected - no implementation yet)
- Failures show missing `validation` property on LinkObject
- Failures show OLD contract `results` still returned instead of `links`
- Existing integration tests PASS (no modifications to current behavior)

**TDD Green Phase** (Task 1.3):
- Implementation adds enrichment logic to CitationValidator
- New enrichment tests PASS after implementation complete
- Existing tests updated to expect new contract

### Success Criteria

✅ **Test File Created**: `citation-validator-enrichment.test.js` exists with 6 integration tests
✅ **Fixtures Available**: Task 1.1 fixtures exist in `test/fixtures/enrichment/` directory (7 files)
✅ **Tests Follow BDD**: Given-When-Then structure in all test descriptions
✅ **Real Systems Used**: No mocks - real MarkdownParser, ParsedFileCache, CitationValidator
✅ **Tests Currently Fail**: All 6 enrichment tests fail (TDD red phase confirmed)
✅ **No Regressions**: Existing integration tests pass unchanged
✅ **Scope Adherence**: No modifications to CitationValidator.js or existing tests

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
[Record the specific AI agent model and version used]

### Debug Log References
[Reference any debug logs or traces generated]

### Completion Notes
[Notes about completion and any issues encountered]

### File List
[List all files created, modified, or affected]

### Implementation Challenges
[Document challenges encountered and resolutions]

### Validation Results
[Results of running validation commands]

## Evaluation Agent Instructions

Validate the implementation above against the task specification. Your validation must answer:

**Did implementation follow task specification exactly?**

Reference these specification sections:
- **"Required Changes by Component"**: Verify new test file and fixture created
- **"Success Criteria"**: Check all ✅ items pass
- **"Validation" → "Verify Changes"**: Run provided bash commands
- **"Scope Boundaries"**: Confirm no modifications outside allowed scope

Populate the Evaluation Agent Notes section below with your findings.

### Evaluation Agent Notes

> [!attention] **Evaluation Agent:**
> Populate this section during validation execution.

### Validator Model Used
[Record model name and version]

### Task Specification Compliance
[Compare implementation against exact task spec from story]

**Validation Checklist**:
- [ ] Files Created: `citation-validator-enrichment.test.js` exists?
- [ ] Fixtures Available: Task 1.1 fixtures exist in `enrichment/` directory (7 files)?
- [ ] Test Count: Exactly 6 integration tests implemented?
- [ ] BDD Structure: All tests use Given-When-Then comments?
- [ ] Real Systems: No mocks used (MarkdownParser, ParsedFileCache, CitationValidator are real)?
- [ ] Scope Adherence: No modifications to CitationValidator.js or existing tests?
- [ ] TDD Red Phase: All 6 new tests currently fail?
- [ ] No Regressions: Existing integration tests pass unchanged?

**Scope Boundary Validation**:
- [ ] CitationValidator.js unchanged (implementation is Task 1.3)?
- [ ] Existing test files unchanged (cache, parsed-document, anchor-matching)?
- [ ] No component unit tests created (integration tests only)?
- [ ] No test helper utilities added (inline code only)?

### Validation Outcome
[PASS or FAIL with specific deviations if FAIL]

### Remediation Required
[Specific fixes needed if FAIL, empty if PASS]
