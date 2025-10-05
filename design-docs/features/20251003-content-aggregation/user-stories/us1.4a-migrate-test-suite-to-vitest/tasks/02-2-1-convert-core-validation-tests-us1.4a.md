---
story: "User Story 1.4a: Migrate citation-manager Test Suite to Vitest"
epic: "Citation Manager Test Migration & Content Aggregation"
phase: "Phase 2: Framework Conversion"
task-id: "2.1"
task-anchor: "#^US1-4aT2-1"
wave: "2a"
implementation-agent: "test-writer"
evaluation-agent: "application-tech-lead"
status: "ready"
---

# Task 2.1: Convert Core Validation Tests to Vitest

## Objective

Convert validation.test.js and warning-validation.test.js from node:test to Vitest framework, replacing all `test()` calls with `it()`, converting `assert` to `expect()` matchers, and updating citation-manager CLI path references to workspace-relative paths.

_Task Reference: [US1.4a Task 2.1](../us1.4a-migrate-test-suite-to-vitest.md#^US1-4aT2-1)_

## Current State → Required State

### BEFORE: node:test Syntax

```javascript
// validation.test.js (current)
import { strict as assert } from "node:assert";
import { execSync } from "node:child_process";
import { describe, test } from "node:test";
import { dirname, join } from "node:path";

const citationManagerPath = join(__dirname, "..", "citation-manager.js");

describe("Citation Manager Integration Tests", () => {
  test("should validate citations in valid-citations.md successfully", async () => {
    const output = execSync(
      `node "${citationManagerPath}" validate "${testFile}"`,
      { encoding: "utf8" }
    );

    assert(
      output.includes("✅ ALL CITATIONS VALID"),
      "Should report all citations as valid"
    );
    assert(output.includes("Total citations:"), "Should show citation count");
  });
});
```

### AFTER: Vitest Syntax

```javascript
// validation.test.js (required)
import { execSync } from "node:child_process";
import { describe, it, expect } from "vitest";
import { dirname, join } from "node:path";

const citationManagerPath = join(__dirname, "..", "src", "citation-manager.js");

describe("Citation Manager Integration Tests", () => {
  it("should validate citations in valid-citations.md successfully", async () => {
    const output = execSync(
      `node "${citationManagerPath}" validate "${testFile}"`,
      { encoding: "utf8" }
    );

    expect(output).toContain("✅ ALL CITATIONS VALID");
    expect(output).toContain("Total citations:");
  });
});
```

### Problems with Current State
- Uses `node:test` and `node:assert` imports incompatible with Vitest
- CLI path points to legacy location (missing `src/` directory)
- Uses `test()` function instead of Vitest's `it()` convention
- Uses `assert()` assertions with message parameters instead of Vitest expect matchers

### Improvements in Required State
- Vitest framework imports for workspace-consistent testing
- Workspace-relative CLI path includes `src/` directory
- Uses `it()` for test function naming (Vitest convention)
- Uses `expect()` matchers with fluent assertion API

### Required Changes by Component

**Import Transformations** (both files):
- Remove: `import { strict as assert } from "node:assert";`
- Remove: `import { describe, test } from "node:test";`
- Add: `import { describe, it, expect } from "vitest";`

**Test Function Conversions** (both files):
- Replace all: `test("description", async () => ...)` → `it("description", async () => ...)`
- Preserve: Test descriptions exactly as written
- Preserve: All Given-When-Then comments

**Assertion Conversions** (both files):
- `assert(condition, "message")` → `expect(value).toBeTruthy()` or appropriate matcher
- `assert(str.includes("text"), "msg")` → `expect(str).toContain("text")`
- `assert.strictEqual(a, b)` → `expect(a).toBe(b)`
- `assert.fail("message")` → `expect.fail("message")`

**Path Updates** (both files):
- Update: `join(__dirname, "..", "citation-manager.js")` → `join(__dirname, "..", "src", "citation-manager.js")`

### Do NOT Modify
- Test descriptions (preserve exact wording)
- Test logic or execution flow
- execSync command patterns
- Given-When-Then comment structure
- File import organization (beyond framework changes)
- Fixture file references

## Validation

### Verify Changes

```bash
# Verify Vitest imports present
grep "from \"vitest\"" tools/citation-manager/test/validation.test.js
grep "from \"vitest\"" tools/citation-manager/test/warning-validation.test.js
# Expected: import { describe, it, expect } from "vitest";

# Verify node:test/node:assert removed
grep "node:test\|node:assert" tools/citation-manager/test/validation.test.js
grep "node:test\|node:assert" tools/citation-manager/test/warning-validation.test.js
# Expected: no matches

# Verify CLI path updated
grep "citation-manager.js" tools/citation-manager/test/validation.test.js
# Expected: contains "src", "citation-manager.js"

# Verify it() function used
grep "^[[:space:]]*test(" tools/citation-manager/test/validation.test.js
# Expected: no matches (all converted to it())
```

### Expected Test Behavior

```bash
# Run converted tests
npm test -- validation
npm test -- warning-validation
# Expected: All tests pass, zero failures

# Verify Vitest executes tests
npm test -- validation 2>&1 | grep "PASS"
# Expected: shows PASS with test count
```

### Success Criteria

**Syntax Conversion**:
- ✅ Both files import from "vitest" (not "node:test" or "node:assert")
- ✅ All `test()` functions converted to `it()`
- ✅ All `assert()` calls converted to `expect()` matchers
- ✅ CLI path includes `/src/` directory: `join(__dirname, "..", "src", "citation-manager.js")`

**Test Execution**:
- ✅ `npm test -- validation` passes with zero failures
- ✅ `npm test -- warning-validation` passes with zero failures
- ✅ Vitest discovers and executes all test cases

**Preservation**:
- ✅ Test descriptions unchanged
- ✅ Test logic preserved exactly
- ✅ Given-When-Then comments intact

## Implementation Agent Instructions

Execute the task specification above. When complete, populate the Implementation Agent Notes section below.

### Implementation Agent Notes

> [!attention] **AI Agent:**
> Populate this section during implementation execution.

#### Agent Model Used
[Record the specific AI agent model and version used]

#### Debug Log References
[Reference any debug logs or traces generated]

#### Completion Notes
[Notes about completion and any issues encountered]

#### File List
[List all files created, modified, or affected]

#### Implementation Challenges
[Document challenges encountered and resolutions]

#### Validation Results
[Results of running validation commands]

## Evaluation Agent Instructions

Validate the implementation against the task specification.

**Did implementation follow task specification exactly?**

Reference sections:
- **"Required Changes by Component"**: Verify import/function/assertion/path transformations
- **"Success Criteria"**: Check all ✅ items pass
- **"Validation" → "Verify Changes"**: Run bash commands
- **"Do NOT Modify"**: Confirm test logic/descriptions unchanged

### Evaluation Agent Notes

> [!attention] **Evaluation Agent:**
> Populate this section during validation execution.

#### Validator Model Used
[Record model name and version]

#### Task Specification Compliance

**Validation Checklist**:
- [ ] Files Modified: Only validation.test.js and warning-validation.test.js modified?
- [ ] Scope Adherence: No changes beyond framework syntax conversion?
- [ ] Objective Met: All tests converted to Vitest syntax and passing?
- [ ] Critical Rules: Test descriptions and logic preserved exactly?

**Scope Boundary Validation** (Test Migration):
- [ ] ONLY 2 specified test files modified (validation.test.js, warning-validation.test.js)?
- [ ] NO fixture file modifications?
- [ ] NO new test cases added?
- [ ] NO test assertion logic changes beyond syntax conversion?
- [ ] NO test description modifications?
- [ ] Line count unchanged (±5% tolerance)?

**Git-Based Validation Commands**:

```bash
# Verify only 2 files modified
git status --short | grep "^ M.*test.js$" | wc -l
# Expected: 2

# Verify no fixture changes
git status --short | grep "fixtures/"
# Expected: empty

# Verify line count similar (validation.test.js)
git diff --stat tools/citation-manager/test/validation.test.js
# Expected: similar insertions/deletions (±5%)
```

#### Validation Outcome
[PASS or FAIL with specific deviations if FAIL]

#### Remediation Required
[Specific fixes needed if FAIL, empty if PASS]
