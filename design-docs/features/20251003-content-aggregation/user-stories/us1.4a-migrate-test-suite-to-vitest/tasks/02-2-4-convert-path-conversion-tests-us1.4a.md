---
story: "User Story 1.4a: Migrate citation-manager Test Suite to Vitest"
epic: "Citation Manager Test Migration & Content Aggregation"
phase: "Phase 2: Framework Conversion"
task-id: "2.4"
task-anchor: "#^US1-4aT2-4"
wave: "2a"
implementation-agent: "test-writer"
evaluation-agent: "application-tech-lead"
status: "ready"
---

# Task 2.4: Convert Path Conversion Tests to Vitest

## Objective

Convert path-conversion.test.js from node:test to Vitest framework, including both CLI integration tests and component unit tests, preserving non-DI component instantiation (`new CitationValidator()`) as accepted technical debt per ADR-001.

_Task Reference: [US1.4a Task 2.4](../us1.4a-migrate-test-suite-to-vitest.md#^US1-4aT2-4)_

## Current State → Required State

### Framework Conversion Pattern

**BEFORE (node:test)**:

```javascript
import { strict as assert } from "node:assert";
import { describe, test } from "node:test";
import { CitationValidator } from "../src/CitationValidator.js";

const citationManagerPath = join(__dirname, "..", "citation-manager.js");

// CLI integration test
test("should convert paths via CLI", async () => {
  const output = execSync(`node "${citationManagerPath}" validate "${file}"`);
  assert(output.includes("converted"), "Should report conversion");
});

// Component unit test (non-DI instantiation)
test("should resolve relative paths", () => {
  const validator = new CitationValidator();  // Preserved per ADR-001
  const result = validator.resolvePath("../file.md");
  assert.strictEqual(result, expected);
});
```

**AFTER (Vitest)**:

```javascript
import { describe, it, expect } from "vitest";
import { CitationValidator } from "../src/CitationValidator.js";

const citationManagerPath = join(__dirname, "..", "src", "citation-manager.js");

// CLI integration test
it("should convert paths via CLI", async () => {
  const output = execSync(`node "${citationManagerPath}" validate "${file}"`);
  expect(output).toContain("converted");
});

// Component unit test (non-DI instantiation preserved)
it("should resolve relative paths", () => {
  const validator = new CitationValidator();  // Unchanged per ADR-001
  const result = validator.resolvePath("../file.md");
  expect(result).toBe(expected);
});
```

### Required Changes by Component

**Import Transformations**:
- Remove: `import { strict as assert } from "node:assert";`
- Remove: `import { describe, test } from "node:test";`
- Add: `import { describe, it, expect } from "vitest";`
- Preserve: Component imports (`CitationValidator`, `MarkdownParser`)

**Test Function Conversions**:
- Replace: All `test()` → `it()`
- Preserve: Both CLI integration and component unit test patterns

**Assertion Conversions**:
- `assert(condition, "msg")` → `expect(value).toBeTruthy()` or appropriate matcher
- `assert.strictEqual(a, b)` → `expect(a).toBe(b)`
- `assert.deepStrictEqual(a, b)` → `expect(a).toEqual(b)`

**Path Updates**:
- Update: CLI path to include `/src/` directory
- Preserve: Component import paths (relative from test file)

### Do NOT Modify
- Component instantiation patterns (`new CitationValidator()` preserved per ADR-001)
- Path resolution validation logic
- Test descriptions or Given-When-Then comments
- Component import statements (beyond framework changes)

## Validation

### Verify Changes

```bash
# Verify Vitest imports
grep "from \"vitest\"" tools/citation-manager/test/path-conversion.test.js
# Expected: import { describe, it, expect } from "vitest";

# Verify framework removal
grep "node:test\|node:assert" tools/citation-manager/test/path-conversion.test.js
# Expected: no matches

# Verify non-DI instantiation preserved
grep "new CitationValidator()" tools/citation-manager/test/path-conversion.test.js
# Expected: matches found (pattern preserved per ADR-001)
```

### Expected Test Behavior

```bash
# Run converted tests
npm test -- path-conversion
# Expected: All CLI and component tests pass with zero failures
```

### Success Criteria

**Syntax Conversion**:
- ✅ Uses Vitest imports (no node:test/node:assert)
- ✅ All `test()` converted to `it()`
- ✅ All assertions use `expect()` matchers
- ✅ CLI path includes `/src/` directory

**Test Execution**:
- ✅ `npm test -- path-conversion` passes
- ✅ Both CLI integration and component unit tests execute

**Technical Debt Preservation**:
- ✅ Component instantiation uses `new CitationValidator()` (non-DI pattern preserved)
- ✅ Component import paths unchanged

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
- [ ] Files Modified: Only path-conversion.test.js?
- [ ] Scope Adherence: Framework syntax conversion only?
- [ ] Objective Met: Tests converted and passing?
- [ ] Technical Debt: Non-DI instantiation preserved?

**Scope Boundary Validation**:
- [ ] ONLY 1 specified test file modified?
- [ ] NO component instantiation changes (still uses `new CitationValidator()`)?
- [ ] NO path resolution logic modifications?
- [ ] NO new test cases added?

#### Validation Outcome
[PASS or FAIL with deviations]

#### Remediation Required
[Fixes needed if FAIL]
