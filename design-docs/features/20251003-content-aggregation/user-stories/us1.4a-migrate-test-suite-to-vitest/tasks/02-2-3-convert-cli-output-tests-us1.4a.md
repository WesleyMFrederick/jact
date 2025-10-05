---
story: "User Story 1.4a: Migrate citation-manager Test Suite to Vitest"
epic: "Citation Manager Test Migration & Content Aggregation"
phase: "Phase 2: Framework Conversion"
task-id: "2.3"
task-anchor: "#^US1-4aT2-3"
wave: "2a"
implementation-agent: "test-writer"
evaluation-agent: "application-tech-lead"
status: "ready"
---

# Task 2.3: Convert CLI Output Tests to Vitest

## Objective

Convert cli-warning-output.test.js from node:test to Vitest framework, replacing test framework imports, converting test functions and assertions, and updating CLI path references to workspace structure.

_Task Reference: [US1.4a Task 2.3](../us1.4a-migrate-test-suite-to-vitest.md#^US1-4aT2-3)_

## Current State → Required State

### Framework Conversion Pattern

**BEFORE (node:test)**:

```javascript
import { strict as assert } from "node:assert";
import { describe, test } from "node:test";

const citationManagerPath = join(__dirname, "..", "citation-manager.js");

test("should format warning messages correctly", async () => {
  assert(stderr.includes("⚠️"), "Should show warning icon");
  assert.match(output, /WARNING:/);
});
```

**AFTER (Vitest)**:

```javascript
import { describe, it, expect } from "vitest";

const citationManagerPath = join(__dirname, "..", "src", "citation-manager.js");

it("should format warning messages correctly", async () => {
  expect(stderr).toContain("⚠️");
  expect(output).toMatch(/WARNING:/);
});
```

### Required Changes by Component

**Import Transformations**:
- Remove: `import { strict as assert } from "node:assert";`
- Remove: `import { describe, test } from "node:test";`
- Add: `import { describe, it, expect } from "vitest";`

**Test Function Conversions**:
- Replace: All `test()` → `it()`
- Preserve: CLI output format test descriptions
- Preserve: Warning message validation logic

**Assertion Conversions**:
- `assert(str.includes("text"))` → `expect(str).toContain("text")`
- `assert.match(str, /pattern/)` → `expect(str).toMatch(/pattern/)`
- `assert.strictEqual(a, b)` → `expect(a).toBe(b)`

**Path Updates**:
- Update: `join(__dirname, "..", "citation-manager.js")` → `join(__dirname, "..", "src", "citation-manager.js")`

### Do NOT Modify
- CLI output format validation patterns
- Warning message assertions
- stderr/stdout capture logic
- Test descriptions

## Validation

### Verify Changes

```bash
# Verify Vitest imports
grep "from \"vitest\"" tools/citation-manager/test/cli-warning-output.test.js
# Expected: import { describe, it, expect } from "vitest";

# Verify framework removal
grep "node:test\|node:assert" tools/citation-manager/test/cli-warning-output.test.js
# Expected: no matches

# Verify CLI path updated
grep "src.*citation-manager.js" tools/citation-manager/test/cli-warning-output.test.js
# Expected: path contains /src/
```

### Expected Test Behavior

```bash
# Run converted tests
npm test -- cli-warning-output
# Expected: All tests pass with zero failures
```

### Success Criteria

**Syntax Conversion**:
- ✅ Uses Vitest imports (no node:test/node:assert)
- ✅ All `test()` converted to `it()`
- ✅ All assertions use `expect()` matchers
- ✅ CLI path includes `/src/` directory

**Test Execution**:
- ✅ `npm test -- cli-warning-output` passes

**Preservation**:
- ✅ CLI output validation logic unchanged
- ✅ Warning format assertions preserved

## Implementation Agent Instructions

Execute the task specification above. When complete, populate the Implementation Agent Notes section below.

### Implementation Agent Notes

> [!attention] **AI Agent:**
> Populate this section during implementation execution.

#### Agent Model Used
claude-sonnet-4-5-20250929 (Sonnet 4.5)

#### Completion Notes
Successfully converted cli-warning-output.test.js from node:test to Vitest framework. All required transformations completed:

- Replaced node:assert and node:test imports with Vitest imports
- Converted all 5 test() functions to it() functions
- Converted all assert() calls to expect() matchers using appropriate Vitest assertions:
  - assert(condition, message) -> expect(value).toBeGreaterThan(0) / toBe(true) / toBeTruthy()
  - assert(str.includes("text")) -> expect(str).toContain("text")
  - assert.match(str, /pattern/) -> expect(str).toMatch(/pattern/)
  - assert(a < b) -> expect(a).toBeLessThan(b)
- Updated citationManagerPath to include /src/ directory in path structure
- Preserved all CLI output validation logic, warning message assertions, and test descriptions
- No modifications made to CLI output format validation patterns or stderr/stdout capture logic

#### File List
- /Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/cc-workflows/tools/citation-manager/test/cli-warning-output.test.js

#### Validation Results
1. Vitest imports verified:

   ```
   import { describe, it, expect } from "vitest";
   ```

2. node:test and node:assert removal verified:
   - No matches found (successfully removed)

3. CLI path update verified:

   ```
   const citationManagerPath = join(__dirname, "..", "src", "citation-manager.js");
   ```

4. Test execution results:

   ```
   Test Files  1 passed (1)
        Tests  5 passed (5)
     Duration  498ms
   ```

   All 5 tests passed successfully with zero failures.

## Evaluation Agent Instructions

Validate implementation against specification.

### Evaluation Agent Notes

> [!attention] **Evaluation Agent:**
> Populate this section during validation execution.

#### Validator Model Used
claude-sonnet-4-5-20250929 (Sonnet 4.5)

#### Task Specification Compliance

**Validation Checklist**:
- [x] Files Modified: Only cli-warning-output.test.js?
- [x] Scope Adherence: Framework syntax conversion only?
- [x] Objective Met: Tests converted and passing?

**Scope Boundary Validation**:
- [x] ONLY 1 specified test file modified?
- [x] NO CLI output format logic changes?
- [x] NO new test cases added?

#### Validation Outcome
PASS

**Evidence Summary**:

1. **Import Transformations**: VERIFIED
   - Removed `import { strict as assert } from "node:assert";`
   - Removed `import { describe, test } from "node:test";`
   - Added `import { describe, it, expect } from "vitest";`
   - Confirmation: `grep "from \"vitest\"" [file]` returned correct import
   - Confirmation: `grep "node:test\|node:assert" [file]` returned no matches

2. **Test Function Conversions**: VERIFIED
   - All 5 `test()` functions converted to `it()` functions
   - Test descriptions preserved exactly:
     - "should display warnings section with proper formatting and tree structure"
     - "should include warnings count in summary statistics with proper formatting"
     - "should mark warnings as fixable issues distinct from valid and error sections"
     - "should display warnings with consistent formatting regardless of exit code"
     - "should provide clear visual separation between warning and other status sections"

3. **Assertion Conversions**: VERIFIED
   - All `assert()` calls converted to `expect()` matchers
   - Conversion examples from diff:
     - `assert(output.length > 0)` → `expect(output.length).toBeGreaterThan(0)`
     - `assert(output.includes("text"))` → `expect(output).toContain("text")`
     - `assert(/pattern/.test(output))` → `expect(output).toMatch(/pattern/)`
     - `assert(warningIndex < validIndex)` → `expect(warningIndex).toBeLessThan(validIndex)`
     - `assert(condition)` → `expect(condition).toBe(true)` or `expect(value).toBeTruthy()`

4. **Path Updates**: VERIFIED
   - Updated from: `join(__dirname, "..", "citation-manager.js")`
   - Updated to: `join(__dirname, "..", "src", "citation-manager.js")`
   - Confirmation: `grep "src.*citation-manager.js" [file]` found correct path

5. **Test Execution**: VERIFIED
   - Command: `npm test -- cli-warning-output`
   - Result: All 5 tests PASSED
   - Duration: 478ms
   - No failures or errors

6. **Preservation Constraints**: VERIFIED
   - CLI output format validation patterns unchanged
   - Warning message assertions preserved
   - stderr/stdout capture logic intact
   - Test descriptions unchanged
   - No new test cases added (maintained 5 tests)

7. **File Scope**: VERIFIED
   - Git diff confirms ONLY cli-warning-output.test.js was modified for this task
   - Other modified files in working directory are from separate tasks
   - Implementation correctly scoped to single file

#### Remediation Required
None. All task requirements met successfully.
