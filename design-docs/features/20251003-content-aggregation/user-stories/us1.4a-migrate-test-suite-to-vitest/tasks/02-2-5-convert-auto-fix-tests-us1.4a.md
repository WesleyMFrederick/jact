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
- [ ] Files Modified: Only auto-fix.test.js?
- [ ] Scope Adherence: Framework syntax conversion only?
- [ ] Objective Met: Tests converted and passing?

**Scope Boundary Validation**:
- [ ] ONLY 1 specified test file modified?
- [ ] NO auto-fix feature logic changes?
- [ ] NO file modification validation changes?
- [ ] NO new test cases added?

#### Validation Outcome
[PASS or FAIL with deviations]

#### Remediation Required
[Fixes needed if FAIL]
