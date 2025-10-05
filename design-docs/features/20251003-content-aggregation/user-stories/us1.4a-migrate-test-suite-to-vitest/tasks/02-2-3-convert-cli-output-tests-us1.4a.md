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
[Record model and version]

#### Completion Notes
[Implementation notes]

#### File List
[Files modified]

#### Validation Results
[Command results]

## Evaluation Agent Instructions

Validate implementation against specification.

### Evaluation Agent Notes

> [!attention] **Evaluation Agent:**
> Populate this section during validation execution.

#### Validator Model Used
[Record model and version]

#### Task Specification Compliance

**Validation Checklist**:
- [ ] Files Modified: Only cli-warning-output.test.js?
- [ ] Scope Adherence: Framework syntax conversion only?
- [ ] Objective Met: Tests converted and passing?

**Scope Boundary Validation**:
- [ ] ONLY 1 specified test file modified?
- [ ] NO CLI output format logic changes?
- [ ] NO new test cases added?

#### Validation Outcome
[PASS or FAIL with deviations]

#### Remediation Required
[Fixes needed if FAIL]
