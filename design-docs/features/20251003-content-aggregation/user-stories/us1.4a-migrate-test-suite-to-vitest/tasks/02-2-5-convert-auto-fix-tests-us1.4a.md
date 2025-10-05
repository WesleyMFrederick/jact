---
story: "User Story 1.4a: Migrate citation-manager Test Suite to Vitest"
epic: "Citation Manager Test Migration & Content Aggregation"
phase: "Phase 2: Framework Conversion"
task-id: "2.5"
task-anchor: "#^US1-4aT2-5"
wave: "2a"
implementation-agent: "test-writer"
evaluation-agent: "application-tech-lead"
status: "ready"
---

# Task 2.5: Convert Auto-Fix Tests to Vitest

## Objective

Convert auto-fix.test.js from node:test to Vitest framework, replacing test framework imports, converting test functions and assertions, and updating CLI path references to workspace structure.

_Task Reference: [US1.4a Task 2.5](../us1.4a-migrate-test-suite-to-vitest.md#^US1-4aT2-5)_

## Current State → Required State

### Framework Conversion Pattern

**BEFORE (node:test)**:

```javascript
import { strict as assert } from "node:assert";
import { describe, test } from "node:test";
import { readFileSync } from "node:fs";

const citationManagerPath = join(__dirname, "..", "citation-manager.js");

test("should fix broken citations automatically", async () => {
  const output = execSync(`node "${citationManagerPath}" validate --fix "${file}"`);
  const fixed = readFileSync(file, "utf8");
  assert(output.includes("Fixed:"), "Should report fixes");
  assert(fixed.includes("corrected-path"), "Should update file");
});
```

**AFTER (Vitest)**:

```javascript
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const citationManagerPath = join(__dirname, "..", "src", "citation-manager.js");

it("should fix broken citations automatically", async () => {
  const output = execSync(`node "${citationManagerPath}" validate --fix "${file}"`);
  const fixed = readFileSync(file, "utf8");
  expect(output).toContain("Fixed:");
  expect(fixed).toContain("corrected-path");
});
```

### Required Changes by Component

**Import Transformations**:
- Remove: `import { strict as assert } from "node:assert";`
- Remove: `import { describe, test } from "node:test";`
- Add: `import { describe, it, expect } from "vitest";`
- Preserve: Node.js module imports (fs, child_process, path)

**Test Function Conversions**:
- Replace: All `test()` → `it()`
- Preserve: Auto-fix feature test descriptions
- Preserve: File modification validation logic

**Assertion Conversions**:
- `assert(condition, "msg")` → `expect(value).toBeTruthy()` or appropriate matcher
- `assert(str.includes("text"))` → `expect(str).toContain("text")`
- `assert.strictEqual(a, b)` → `expect(a).toBe(b)`

**Path Updates**:
- Update: `join(__dirname, "..", "citation-manager.js")` → `join(__dirname, "..", "src", "citation-manager.js")`

### Do NOT Modify
- Auto-fix feature test logic
- File modification validation patterns
- Temporary file handling code
- Test descriptions or Given-When-Then comments

## Validation

### Verify Changes

```bash
# Verify Vitest imports
grep "from \"vitest\"" tools/citation-manager/test/auto-fix.test.js
# Expected: import { describe, it, expect } from "vitest";

# Verify framework removal
grep "node:test\|node:assert" tools/citation-manager/test/auto-fix.test.js
# Expected: no matches

# Verify CLI path updated
grep "src.*citation-manager.js" tools/citation-manager/test/auto-fix.test.js
# Expected: path contains /src/
```

### Expected Test Behavior

```bash
# Run converted tests
npm test -- auto-fix
# Expected: All tests pass with zero failures
```

### Success Criteria

**Syntax Conversion**:
- ✅ Uses Vitest imports (no node:test/node:assert)
- ✅ All `test()` converted to `it()`
- ✅ All assertions use `expect()` matchers
- ✅ CLI path includes `/src/` directory

**Test Execution**:
- ✅ `npm test -- auto-fix` passes

**Preservation**:
- ✅ Auto-fix feature validation logic unchanged
- ✅ File modification assertions preserved

## Implementation Agent Instructions

Execute the task specification above. When complete, populate the Implementation Agent Notes section below.

### Implementation Agent Notes

> [!attention] **AI Agent:**
> Populate this section during implementation execution.

#### Agent Model Used
Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)

#### Completion Notes
Successfully converted auto-fix.test.js from node:test to Vitest framework. All syntax conversions completed per specification:

1. **Import Transformations**: Removed node:assert and node:test imports, added Vitest imports
2. **Test Function Conversions**: Converted all `test()` calls to `it()`
3. **Assertion Conversions**:
   - `assert(condition, "msg")` → `expect(condition).toBeTruthy()`
   - `assert(str.includes("text"))` → `expect(str).toContain("text")`
   - Preserved negation patterns with `.not.toContain()`
4. **Path Updates**: Updated CLI path to include `/src/` directory

**Important Finding**: Test execution reveals CLI output format has changed from what tests expect. This is an implementation issue outside the scope of framework conversion. Tests are syntactically correct but failing due to:
- Expected: "Fixed 2 kebab-case citation"
- Actual: "✅ Fixed 2 citations in [file]:\n   - 2 anchor corrections"

The framework conversion is complete and correct. Test failures indicate the CLI output format needs alignment with test expectations (separate issue).

#### File List
- `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/cc-workflows/tools/citation-manager/test/auto-fix.test.js` (modified)

#### Validation Results

**Syntax Validation - All Passed**:

```bash
# Verify Vitest imports
grep "from \"vitest\"" tools/citation-manager/test/auto-fix.test.js
# Result: import { describe, it, expect } from "vitest";

# Verify framework removal
grep "node:test\|node:assert" tools/citation-manager/test/auto-fix.test.js
# Result: No matches (✅ Passed)

# Verify CLI path updated
grep "src.*citation-manager.js" tools/citation-manager/test/auto-fix.test.js
# Result: const citationManagerPath = join(__dirname, "..", "src", "citation-manager.js");
```

**Test Execution**:

```bash
npm test -- auto-fix
# Result: 3 tests failed due to CLI output format mismatch (not conversion issue)
# - Test 1: Expected "Fixed 2 kebab-case citation", got new output format
# - Test 2: Expected "No auto-fixable kebab-case citations found", got new output format
# - Test 3: Expected specific output patterns, got new output format
```

**Conversion Success Criteria - All Met**:
- ✅ Uses Vitest imports (no node:test/node:assert)
- ✅ All `test()` converted to `it()`
- ✅ All assertions use `expect()` matchers
- ✅ CLI path includes `/src/` directory
- ✅ Auto-fix feature validation logic unchanged
- ✅ File modification assertions preserved

## Evaluation Agent Instructions

Validate implementation against specification.

### Evaluation Agent Notes

> [!attention] **Evaluation Agent:**
> Populate this section during validation execution.

#### Validator Model Used
Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)

#### Task Specification Compliance

**Validation Checklist**:
- [x] Files Modified: Only auto-fix.test.js? **YES** - Confirmed via git diff
- [x] Scope Adherence: Framework syntax conversion only? **YES** - Only framework-related changes made
- [x] Objective Met: Tests converted and passing? **PARTIAL** - Converted correctly, failing due to CLI output format changes (out of scope)

**Scope Boundary Validation**:
- [x] ONLY 1 specified test file modified? **YES** - Only auto-fix.test.js changed
- [x] NO auto-fix feature logic changes? **YES** - Test logic preserved exactly
- [x] NO file modification validation changes? **YES** - File validation patterns unchanged
- [x] NO new test cases added? **YES** - Same 3 tests remain

#### Detailed Validation Results

**Import Transformations** - PASS:

```bash
# Verified Vitest imports present
grep "from \"vitest\"" tools/citation-manager/test/auto-fix.test.js
Result: import { describe, it, expect } from "vitest";

# Verified old framework imports removed
grep "node:test\|node:assert" tools/citation-manager/test/auto-fix.test.js
Result: No matches (clean removal)
```

**Path Updates** - PASS:

```bash
# Verified CLI path includes /src/
grep "src.*citation-manager.js" tools/citation-manager/test/auto-fix.test.js
Result: const citationManagerPath = join(__dirname, "..", "src", "citation-manager.js");
```

**Syntax Conversions** - PASS:
All conversion requirements met per specification:
- test() -> it(): 3 conversions (all test functions updated)
- assert() -> expect(): Multiple conversions verified in git diff
  - assert(condition, "msg") -> expect(condition).toBeTruthy()
  - assert(str.includes("text")) -> expect(str).toContain("text")
  - assert(!condition) -> expect().not.toContain()

**Test Structure Preservation** - PASS:
- 3 test cases remain unchanged in purpose/scope
- Auto-fix validation logic preserved
- File modification assertions preserved
- Temporary file handling unchanged

**Test Execution Results**:

```
npm test -- auto-fix
Result: 3 tests failed due to CLI output format mismatch
```

**Analysis of Test Failures**:
The tests fail because the CLI output format has changed since these tests were written:

Expected: "Fixed 2 kebab-case citation"
Actual: "Fixed 2 citations in [file]:\n   - 2 anchor corrections"

Expected: "No auto-fixable kebab-case citations found"
Actual: New output format with emoji and detailed reporting

**Critical Finding**: These failures are NOT due to incorrect framework conversion. The Vitest conversion is syntactically correct and complete. The failures indicate that the CLI implementation has evolved with a new output format that doesn't match test expectations. This is a separate issue outside the scope of Task 2.5.

#### Validation Outcome
**PASS WITH QUALIFICATION**

The framework conversion from node:test to Vitest is complete, correct, and meets all specification requirements:
- All syntax conversions completed correctly
- Path updates applied as specified
- Test logic and structure preserved
- Scope boundaries respected (only auto-fix.test.js modified)

**Qualification**: Tests fail at runtime due to CLI output format evolution (not conversion errors). This is documented as a known issue outside the scope of framework migration. The Implementation Agent correctly noted this in their completion notes.

#### Remediation Required
**None for Task 2.5** - Framework conversion is complete and correct.

**Separate Issue Identified**: Test expectations need alignment with current CLI output format. This should be tracked as a separate task outside the Vitest migration effort, as it represents a business logic change (updating test assertions to match evolved CLI output) rather than a framework conversion issue.
