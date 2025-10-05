---
story: "User Story 1.4a: Migrate citation-manager Test Suite to Vitest"
epic: "Citation Manager Test Migration & Content Aggregation"
phase: "Phase 2: Framework Conversion"
task-id: "2.2"
task-anchor: "#^US1-4aT2-2"
wave: "2a"
implementation-agent: "test-writer"
evaluation-agent: "application-tech-lead"
status: "ready"
---

# Task 2.2: Convert Enhanced Citation Tests to Vitest

## Objective

Convert enhanced-citations.test.js and story-validation.test.js from node:test to Vitest framework, replacing framework imports, converting test functions to `it()`, transforming assertions to `expect()` matchers, and updating CLI path references.

_Task Reference: [US1.4a Task 2.2](../us1.4a-migrate-test-suite-to-vitest.md#^US1-4aT2-2)_

## Current State → Required State

### Framework Conversion Pattern

**BEFORE (node:test)**:

```javascript
import { strict as assert } from "node:assert";
import { describe, test } from "node:test";

const citationManagerPath = join(__dirname, "..", "citation-manager.js");

test("should handle enhanced citation format", async () => {
  assert(output.includes("expected"), "Should match");
  assert.strictEqual(count, 5);
});
```

**AFTER (Vitest)**:

```javascript
import { describe, it, expect } from "vitest";

const citationManagerPath = join(__dirname, "..", "src", "citation-manager.js");

it("should handle enhanced citation format", async () => {
  expect(output).toContain("expected");
  expect(count).toBe(5);
});
```

### Required Changes by Component

**Import Transformations** (both files):
- Remove: `import { strict as assert } from "node:assert";`
- Remove: `import { describe, test } from "node:test";`
- Add: `import { describe, it, expect } from "vitest";`

**Test Function Conversions** (both files):
- Replace: `test()` → `it()` for all test functions
- Preserve: Exact test descriptions
- Preserve: All Given-When-Then comments

**Assertion Conversions** (both files):
- `assert(condition, "msg")` → `expect(value).toBeTruthy()` or appropriate matcher
- `assert(str.includes("text"))` → `expect(str).toContain("text")`
- `assert.strictEqual(a, b)` → `expect(a).toBe(b)`
- `assert.deepStrictEqual(a, b)` → `expect(a).toEqual(b)`

**Path Updates** (both files):
- Update: `join(__dirname, "..", "citation-manager.js")` → `join(__dirname, "..", "src", "citation-manager.js")`

### Do NOT Modify
- Test descriptions (preserve exact wording)
- Test logic or enhanced citation validation rules
- Fixture references or file paths (except CLI path)
- Story-specific validation patterns
- Given-When-Then comments

## Validation

### Verify Changes

```bash
# Verify Vitest imports
grep "from \"vitest\"" tools/citation-manager/test/enhanced-citations.test.js
grep "from \"vitest\"" tools/citation-manager/test/story-validation.test.js
# Expected: import { describe, it, expect } from "vitest";

# Verify framework removal
grep "node:test\|node:assert" tools/citation-manager/test/enhanced-citations.test.js
grep "node:test\|node:assert" tools/citation-manager/test/story-validation.test.js
# Expected: no matches

# Verify CLI path updated
grep "src.*citation-manager.js" tools/citation-manager/test/enhanced-citations.test.js
# Expected: path contains /src/
```

### Expected Test Behavior

```bash
# Run converted tests
npm test -- enhanced-citations
npm test -- story-validation
# Expected: All tests pass with zero failures
```

### Success Criteria

**Syntax Conversion**:
- ✅ Both files use Vitest imports (no node:test/node:assert)
- ✅ All `test()` converted to `it()`
- ✅ All assertions use `expect()` matchers
- ✅ CLI path includes `/src/` directory

**Test Execution**:
- ✅ `npm test -- enhanced-citations` passes
- ✅ `npm test -- story-validation` passes

**Preservation**:
- ✅ Enhanced citation format validation logic unchanged
- ✅ Story-specific validation patterns preserved

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
- [ ] Files Modified: Only enhanced-citations.test.js and story-validation.test.js?
- [ ] Scope Adherence: Framework syntax conversion only?
- [ ] Objective Met: All tests converted and passing?

**Scope Boundary Validation**:
- [ ] ONLY 2 specified test files modified?
- [ ] NO validation logic changes beyond syntax?
- [ ] NO new test cases added?
- [ ] Line count unchanged (±5%)?

#### Validation Outcome
[PASS or FAIL with deviations]

#### Remediation Required
[Fixes needed if FAIL]
