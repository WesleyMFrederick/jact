---
story: "User Story 1.6: Refactor MarkdownParser.Output.DataContract - Eliminate Duplicate Anchor Entries"
epic: "Citation Manager Test Migration & Content Aggregation"
phase: "Phase 4: Regression Validation & Documentation"
task-id: "4.1"
task-anchor: "^US1-6T4-1"
wave: "3"
implementation-agent: "qa-validation"
evaluation-agent: "application-tech-lead"
status: "ready"
---

# Task 4.1: Execute Full Regression Validation

## Objective

Execute complete test suite to validate zero regression after AnchorObject schema refactoring. Confirm all tests pass with refactored schema.

**Link**: [Task 4.1 in US1.6](../us1.6-refactor-anchor-schema.md#^US1-6T4-1)

## Validation Scope

### What to Validate

**Parser Contract Tests** (from Task 1.1):
- ✅ Single anchor per header (no duplicates)
- ✅ `urlEncodedId` populated for all header anchors
- ✅ `urlEncodedId` omitted for block anchors
- ✅ Headers with special characters generate single anchor with dual IDs

**Integration Tests** (from Task 1.2):
- ✅ Raw format anchor matching works
- ✅ URL-encoded format anchor matching works
- ✅ Both formats match same anchor object
- ✅ Invalid anchors fail validation with suggestions

**Implementation Validation**:
- ✅ MarkdownParser creates single anchor per header (Task 2.1)
- ✅ CitationValidator checks both ID fields (Task 3.1)
- ✅ No duplicate anchor entries in parsed output

**Regression Validation**:
- ✅ All existing validation tests pass
- ✅ All existing parser tests pass
- ✅ All existing integration tests pass
- ✅ Zero test failures across entire suite

### Expected Test Results

```bash
# Complete test suite execution
npm test

# Expected output:
# Test Files  X passed (X)
#      Tests  71+ passed (71+)  # Should be all passing
#   Start at  XX:XX:XX
#   Duration  XXs
```

## Validation Commands

### 1. Run Complete Test Suite

```bash
# Execute all tests
npm test

# Expected: All tests pass, zero failures
# Verify output shows:
# - "Tests  XX passed (XX)" with no failures
# - No error messages in output
```

### 2. Validate Parser Schema Tests

```bash
# Run parser contract tests specifically
npm test -- parser-output-contract

# Expected output:
# ✓ should populate anchors array with single anchor per header
# ✓ should populate urlEncodedId for all header anchors
# ✓ should omit urlEncodedId for block anchors
# ✓ should prevent duplicate anchor entries for headers with special characters
# All tests passing
```

### 3. Validate Integration Tests

```bash
# Run CitationValidator integration tests
npm test -- integration/citation-validator-anchor-matching

# Expected output:
# ✓ should match anchor using raw ID format
# ✓ should match anchor using URL-encoded ID format
# ✓ should match both ID formats to same anchor object
# ✓ should fail validation when anchor not found in either ID field
# All 4 tests passing
```

### 4. Validate No Duplicate Anchors

```bash
# Parse test fixture and verify no duplicates
npm run citation:ast tools/citation-manager/test/fixtures/complex-headers.md 2>/dev/null | \
  jq '.anchors[] | select(.anchorType == "header") | .id' | \
  sort | \
  uniq -d

# Expected: empty output (no duplicate id values)
```

### 5. Validate Existing Tests Still Pass

```bash
# Run existing validation tests
npm test -- validation

# Expected: All existing validation tests pass (backward compatibility)
```

## Success Criteria

- ✅ Complete test suite passes with zero failures
- ✅ All new anchor schema tests pass (Tasks 1.1, 1.2)
- ✅ No duplicate anchor entries detected in parsed output
- ✅ CitationValidator works with both ID formats
- ✅ All existing tests pass (zero regressions)
- ✅ Parser output contract validation confirms schema compliance

## Validation Report Format

Document test execution results with pass/fail counts:

```markdown
## Regression Validation Report

**Execution Date**: [YYYY-MM-DD]
**Agent**: [qa-validation agent model]

### Test Suite Summary

- **Total Tests**: XX
- **Passed**: XX
- **Failed**: 0
- **Duration**: XXs

### Test Category Breakdown

**Parser Contract Tests**:
- Total: 8
- Passed: 8
- Failed: 0

**Integration Tests**:
- Total: 4
- Passed: 4
- Failed: 0

**Existing Tests**:
- Total: XX
- Passed: XX
- Failed: 0

### Validation Outcome

✅ **PASS** - All tests pass with zero regressions

### Issues Found

None - zero functional regressions detected
```

## Do NOT Modify

- ❌ Source code files (validation only, no fixes)
- ❌ Test files (validation only, no test updates)
- ❌ Documentation (covered in Tasks 4.2, 4.3)
- ❌ Configuration files

## Scope Boundaries

❌ **Fixing failing tests** (report failures, don't fix - implementation agents handle fixes)
❌ **Adding new test cases** (validation only)
❌ **Modifying source code** (validation task, not implementation)
❌ **Performance testing** (functional correctness only)

**Validation Commands**:

```bash
# Should show NO modifications
git status --short
# Expected: clean working tree or only Phase 1-3 modifications
```

## Implementation Agent Instructions

Execute the validation commands above. Document all test results in the Implementation Agent Notes section below.

**If tests fail**:
1. Document exact failure messages
2. Identify which phase (1, 2, or 3) likely introduced the failure
3. Provide specific remediation guidance for implementation agents
4. Mark validation as FAIL with remediation required

### Implementation Agent Notes

> [!attention] **AI Agent:**
> Populate this section during validation execution.

### Agent Model Used
[Record the specific AI agent model and version used]

### Test Execution Results

**Complete Test Suite**:

```bash
[Paste npm test output]
```

**Parser Contract Tests**:

```bash
[Paste npm test -- parser-output-contract output]
```

**Integration Tests**:

```bash
[Paste npm test -- integration/citation-validator-anchor-matching output]
```

**Duplicate Anchor Check**:

```bash
[Paste duplicate detection output]
```

### Test Summary

- Total Tests: [X]
- Passed: [X]
- Failed: [X]
- Duration: [Xs]

### Issues Found

[List any test failures with error messages and stack traces]

### Validation Outcome

[✅ PASS or ❌ FAIL]

### Remediation Guidance

[If FAIL: Specific guidance for which tasks need fixes]

## Evaluation Agent Instructions

Validate that the qa-validation agent executed all validation commands and documented results completely.

**Validation must confirm**:
- All validation commands executed
- Test results documented with pass/fail counts
- Complete output captured for each test category
- Validation outcome clearly stated (PASS/FAIL)
- Remediation guidance provided if FAIL

### Evaluation Agent Notes

> [!attention] **Evaluation Agent:**
> Populate this section during validation execution.

### Validator Model Used
[Record model name and version]

### Task Specification Compliance

**Validation Checklist**:
- [ ] All validation commands executed?
- [ ] Test results documented completely?
- [ ] Pass/fail counts accurate?
- [ ] Validation outcome stated clearly?
- [ ] Remediation guidance provided if needed?

**Scope Boundary Validation**:
- [ ] No source code modifications attempted
- [ ] No test file modifications attempted
- [ ] Validation-only approach maintained

### Validation Outcome
[PASS or FAIL with specific deviations if FAIL]

### Remediation Required
[Specific fixes needed if FAIL, empty if PASS]
