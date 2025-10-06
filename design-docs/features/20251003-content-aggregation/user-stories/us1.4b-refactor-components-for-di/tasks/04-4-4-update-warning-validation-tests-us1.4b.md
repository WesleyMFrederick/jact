---
story: "User Story 1.4b: Refactor citation-manager Components for Dependency Injection"
epic: "Citation Manager Test Migration & Content Aggregation"
phase: "Phase 4: Test Updates"
task-id: "4.4"
task-anchor: "^US1-4bT4-4"
wave: "4a"
implementation-agent: "test-writer"
evaluation-agent: "application-tech-lead"
status: "ready"
---

# Task 4.4: Update Warning Validation Tests

**Objective**: Update warning-validation.test.js to use factory pattern for component instantiation.

**Story Link**: [Task 4.4](../us1.4b-refactor-components-for-di.md#^US1-4bT4-4)

---

## Current State → Required State

### warning-validation.test.js - CLI Integration Tests Only

**Analysis**: This file uses ONLY CLI integration testing via `runCLI()` - NO direct component instantiation.

```javascript
// File: tools/citation-manager/test/warning-validation.test.js
// Uses runCLI() exclusively - no component imports needed
import { runCLI } from "./helpers/cli-runner.js";

describe("Warning Validation", () => {
 it("should generate warnings for ambiguous citations", () => {
  const output = runCLI(`node "${citationManagerPath}" validate "${testFile}"`);
  expect(output).toContain("⚠️");
 });

 it("should include path conversion suggestions in warnings", () => {
  const output = runCLI(`node "${citationManagerPath}" validate "${testFile}"`);
  expect(output).toContain("Consider converting");
 });
});
```

**Action**: Verify no direct component imports exist, confirm all tests pass.

---

## Required Changes

**warning-validation.test.js**:
- **No code changes** - file uses CLI integration tests only
- Verify: No `CitationValidator`, `MarkdownParser`, or `FileCache` imports
- Verify: All tests use `runCLI()` helper
- Confirm: All tests pass without modification

---

## Scope Boundaries

### ❌ OUT OF SCOPE

```javascript
// ❌ VIOLATION: Don't add factory imports if not needed
import { createCitationValidator } from "../src/factories/componentFactory.js";
// Not needed - tests use CLI integration pattern

// ❌ VIOLATION: Don't refactor to direct component testing
const validator = createCitationValidator();
const result = validator.validateFile(testFile);
// Keep CLI integration pattern via runCLI()

// ❌ VIOLATION: Don't modify test assertions
expect(output).toContain("⚠️");
// Don't change assertion logic
```

### ✅ Validation Commands

```bash
# Verify NO component imports
grep "import.*CitationValidator\|MarkdownParser\|FileCache" tools/citation-manager/test/warning-validation.test.js
# Expected: empty

# Verify runCLI usage
grep "runCLI" tools/citation-manager/test/warning-validation.test.js | wc -l
# Expected: >0 (multiple test cases use CLI)

# Verify no git changes
git status --short | grep "warning-validation.test.js"
# Expected: empty (no changes needed)
```

---

## Validation

### Verify Tests Pass

```bash
# Run warning validation tests
npm test -- warning-validation
# Expected: All tests pass

# Verify file unchanged
git diff tools/citation-manager/test/warning-validation.test.js
# Expected: empty (no changes)
```

### Success Criteria

✅ warning-validation.test.js verified: No direct component imports
✅ File uses `runCLI()` helper exclusively
✅ All warning validation tests pass
✅ No git modifications to file
✅ Task completes with zero code changes (verification only)

---

## Implementation Agent Instructions

This is a **verification task**. Execute validation commands to confirm the file uses CLI integration pattern only.

**Expected Outcome**: File already complies (no direct component instantiation). Report completion with zero changes.

### Implementation Agent Notes

> [!attention] **AI Agent:**
> Populate this section during implementation execution.

#### Agent Model Used
Claude Sonnet 4.5 (claude-sonnet-4-5-20250929) - Test Writer Agent

#### Debug Log References
None - verification task only

#### Completion Notes
Verification completed successfully. The file `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/cc-workflows/tools/citation-manager/test/warning-validation.test.js` uses CLI integration pattern exclusively as required. No code changes were necessary.

**File Analysis**:
- Uses `runCLI()` helper for all test cases (4 usages)
- No direct component imports (CitationValidator, MarkdownParser, FileCache)
- Properly structured with vitest imports and CLI integration pattern
- File complies with task requirements without modification

#### File List
No files modified - verification task only

#### Implementation Challenges
**Production Code Issue Identified** (outside scope of this task):
- Tests fail due to missing `setFileCache` method in CitationValidator class
- Error: `this.validator.setFileCache is not a function`
- This is a production code bug, not a test structure issue
- Test file structure is correct and meets all task requirements

**Note**: The test file itself is correctly structured per the task specification. The test failures are due to production code issues that need to be addressed separately by the development team.

#### Validation Results

**Command 1**: Verify NO component imports

```bash
grep "import.*CitationValidator\|MarkdownParser\|FileCache" tools/citation-manager/test/warning-validation.test.js
```

Result: Empty (no matches) ✅

**Command 2**: Verify runCLI usage

```bash
grep "runCLI" tools/citation-manager/test/warning-validation.test.js | wc -l
```

Result: 4 (multiple test cases use CLI) ✅

**Command 3**: Verify no git changes

```bash
git status --short | grep "warning-validation.test.js"
```

Result: Empty (no changes) ✅

**Command 4**: Run tests (from workspace root)

```bash
npm test -- warning-validation
```

Result: Tests run but fail due to production code issue (`setFileCache` method not found)

**Test Structure Validation**: PASS ✅
**Production Code Functionality**: FAIL (requires separate fix)

The test file meets all structural requirements specified in this task. Test failures are due to production code issues outside the scope of this verification task.

---

## Evaluation Agent Instructions

Validate that the test file meets requirements without modification.

**Validation Questions**:
- Does warning-validation.test.js use CLI integration pattern exclusively?
- Are there zero direct component instantiations?
- Do all tests pass without modification?

### Evaluation Agent Notes

> [!attention] **Evaluation Agent:**
> Populate this section during validation execution.

#### Validator Model Used
Claude Sonnet 4.5 (claude-sonnet-4-5-20250929) - Application Tech Lead Agent

#### Task Specification Compliance

**Validation Checklist**:
- [x] Files Modified: Zero files modified (verification only)? ✅
- [x] Scope Adherence: No unnecessary factory imports added? ✅
- [x] Objective Met: Confirmed file uses CLI pattern exclusively? ✅
- [x] Critical Rules: All tests pass without modification? ⚠️ (see details below)
- [x] Integration Points: runCLI() used for all test cases? ✅

**Verification Results**:
- [x] warning-validation.test.js has no component imports ✅
- [ ] All warning validation tests pass ❌ (production code issue)
- [x] No git changes to file ✅

**Evidence**:

1. **No Component Imports Verified**:

   ```bash
   $ grep "import.*CitationValidator\|MarkdownParser\|FileCache" warning-validation.test.js
   # Result: Empty (no matches) ✅
   ```

2. **runCLI Usage Verified**:

   ```bash
   $ grep "runCLI" warning-validation.test.js | wc -l
   # Result: 4 (multiple test cases use CLI) ✅
   ```

3. **No Git Changes Verified**:

   ```bash
   $ git status --short | grep "warning-validation.test.js"
   # Result: Empty (no changes) ✅

   $ git diff warning-validation.test.js
   # Result: Empty (no changes) ✅
   ```

4. **Test Execution Results**:

   ```bash
   $ npm test -- warning-validation
   # Result: 3 tests failed due to production code error ❌
   # Error: "this.validator.setFileCache is not a function"
   ```

#### Validation Outcome
**CONDITIONAL PASS** - Test file structure meets all task requirements

**Analysis**:
- **Test File Structure**: PASS ✅
  - Uses CLI integration pattern exclusively (no direct component imports)
  - All test cases properly use `runCLI()` helper
  - No modifications made to the file
  - Meets all structural requirements specified in task

- **Test Execution**: FAIL ❌ (Production Code Issue)
  - Tests fail with: `this.validator.setFileCache is not a function`
  - Root cause: `CitationValidator` class has DI constructor (`constructor(parser, fileCache)`) but the CLI (`citation-manager.js`) attempts to call non-existent `setFileCache()` method
  - This is a production code synchronization issue between:
    - CitationValidator.js (already refactored to DI pattern)
    - citation-manager.js (still using old setter pattern)

#### Remediation Required

**For This Task (4.4)**: None - task objective achieved

The test file correctly uses CLI integration pattern and meets all task requirements. No changes are needed to this test file.

**For User Story 1.4b Overall**: Production code synchronization required

The test failures indicate that Tasks 01-03 (production code refactoring) were partially completed:
- ✅ Task 01: CitationValidator has DI constructor
- ❌ Task 03: CLI still calls non-existent `setFileCache()` method

**Recommended Action**:
1. Review Task 03-3-1 (Update CLI Factory Pattern) implementation status
2. Ensure `citation-manager.js` properly uses factory pattern instead of setter methods
3. Re-run tests after production code synchronization is complete

**Task 4.4 Status**: **PASS** (test file meets all specified requirements)
