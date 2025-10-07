---
story: "User Story 1.5: Implement a Cache for Parsed File Objects"
epic: Citation Manager Test Migration & Content Aggregation
phase: "Phase 1: Parser Output Contract Validation & Documentation"
task-id: "1.2"
task-anchor: ^US1-5T1-2
wave: 1c
implementation-agent: test-writer
evaluation-agent: application-tech-lead
status: Done
---

# Task 1.2: Update Parser Tests to Documented Schema (RED Phase)

**Objective**: Update `parser-output-contract.test.js` to validate the Implementation Guide schema as the source of truth. Tests should FAIL, exposing the mismatch between current implementation and documented contract.

**Reference**: [Task ^US1-5T1-2](../us1.5-implement-cache-for-parsed-files.md#^US1-5T1-2)

---

## Reference Schema Documentation

The following schema definitions are from the **Markdown Parser Implementation Guide** and represent the **source of truth** for MarkdownParser output:

### LinkObject Schema (from Implementation Guide)

```json
{
  "title": "Link Object",
  "type": "object",
  "properties": {
    "linkType": { "type": "string", "enum": [ "markdown", "wiki" ] },
    "scope": { "type": "string", "enum": [ "internal", "cross-document" ] },
    "anchorType": { "type": ["string", "null"], "enum": [ "header", "block", null ] },
    "source": {
      "type": "object",
      "properties": {
        "path": {
          "type": "object",
          "properties": {
            "absolute": { "type": "string" }
          },
          "required": ["absolute"]
        }
      },
      "required": ["path"]
    },
    "target": {
      "type": "object",
      "properties": {
        "path": {
          "type": "object",
          "properties": {
            "raw": { "type": ["string", "null"] },
            "absolute": { "type": ["string", "null"] },
            "relative": { "type": ["string", "null"] }
          },
          "required": ["raw", "absolute", "relative"]
        },
        "anchor": { "type": ["string", "null"] }
      },
      "required": ["path", "anchor"]
    },
    "text": { "type": ["string", "null"] },
    "fullMatch": { "type": "string" },
    "line": { "type": "integer", "minimum": 1 },
    "column": { "type": "integer", "minimum": 1 }
  },
  "required": [ "linkType", "scope", "anchorType", "source", "target", "text", "fullMatch", "line", "column" ]
}
```

### AnchorObject Schema (from Implementation Guide)

```json
{
  "title": "Anchor Object",
  "type": "object",
  "properties": {
    "anchorType": { "type": "string", "enum": [ "header", "block" ] },
    "id": { "type": "string" },
    "rawText": { "type": ["string", "null"] },
    "fullMatch": { "type": "string" },
    "line": { "type": "integer", "minimum": 1 },
    "column": { "type": "integer", "minimum": 1 }
  },
  "required": [ "anchorType", "id", "rawText", "fullMatch", "line", "column" ]
}
```

### HeadingObject Schema (from Implementation Guide)

```json
{
  "title": "Heading Object",
  "description": "Represents a heading extracted from the document structure. Used by the CLI 'ast' command for document structure analysis and available for future content aggregation features.",
  "type": "object",
  "properties": {
    "level": { "type": "integer", "minimum": 1, "maximum": 6, "description": "Heading depth (1-6)" },
    "text": { "type": "string", "description": "Heading text content" },
    "raw": { "type": "string", "description": "Raw markdown including # symbols" }
  },
  "required": [ "level", "text", "raw" ]
}
```

---

## Current State → Required State

### BEFORE: Tests Validate Current Implementation Schema

**Current Test File** (`tools/citation-manager/test/parser-output-contract.test.js`):

```javascript
// Tests validate CURRENT implementation schema (Task 1.1)
it('should populate links array with type, text, file, anchor, fullMatch, line properties', async () => {
  const link = result.links[0];
  expect(link).toHaveProperty('type');        // Current schema
  expect(link).toHaveProperty('text');
  expect(link).toHaveProperty('file');
  expect(link).toHaveProperty('anchor');
  // ...
});

it('should populate anchors array with type, anchor, line properties', async () => {
  const anchor = result.anchors[0];
  expect(anchor).toHaveProperty('type');      // Current schema
  expect(anchor).toHaveProperty('anchor');
  expect(anchor).toHaveProperty('line');
  // ...
});
```

**Problems**:
- ❌ Tests validate current implementation schema instead of documented contract
- ❌ Implementation Guide documents a richer schema (linkType, scope, anchorType, source/target paths)
- ❌ No tests validate nested path structures (source.path.absolute, target.path.raw/absolute/relative)
- ❌ No tests validate proper anchorType/id vs type/anchor property naming
- ❌ Cache implementation in Phase 2 will depend on undocumented/untested schema properties

### AFTER: Tests Validate Implementation Guide Schema (Source of Truth)

**Updated Test File** (`tools/citation-manager/test/parser-output-contract.test.js`):

```javascript
// Tests validate DOCUMENTED schema from Implementation Guide
describe('MarkdownParser Output Contract - Link Schema', () => {
  it('should populate links array with documented LinkObject schema', async () => {
    // Given: Parser with fixture containing cross-document links
    const parser = createMarkdownParser();
    const testFile = join(__dirname, 'fixtures', 'valid-citations.md');

    // When: Parse file
    const result = await parser.parseFile(testFile);

    // Then: Link objects match Implementation Guide schema
    expect(result.links.length).toBeGreaterThan(0);

    const link = result.links[0];

    // Validate top-level required fields per Implementation Guide
    expect(link).toHaveProperty('linkType');
    expect(link).toHaveProperty('scope');
    expect(link).toHaveProperty('anchorType');
    expect(link).toHaveProperty('source');
    expect(link).toHaveProperty('target');
    expect(link).toHaveProperty('text');
    expect(link).toHaveProperty('fullMatch');
    expect(link).toHaveProperty('line');
    expect(link).toHaveProperty('column');

    // Validate enum values
    expect(['markdown', 'wiki']).toContain(link.linkType);
    expect(['internal', 'cross-document']).toContain(link.scope);
    if (link.anchorType) {
      expect(['header', 'block']).toContain(link.anchorType);
    }

    // Validate source path structure
    expect(link.source).toHaveProperty('path');
    expect(link.source.path).toHaveProperty('absolute');
    expect(typeof link.source.path.absolute).toBe('string');

    // Validate target path structure
    expect(link.target).toHaveProperty('path');
    expect(link.target.path).toHaveProperty('raw');
    expect(link.target.path).toHaveProperty('absolute');
    expect(link.target.path).toHaveProperty('relative');
    expect(link.target).toHaveProperty('anchor');
  });

  it('should correctly populate path variations (raw, absolute, relative)', async () => {
    // Given: Parser with fixture in subdirectory
    // When: Parse file with links to parent/sibling/child directories
    // Then: Verify raw (original), absolute (full path), relative (from source) all correct
    // ...
  });
});

describe('MarkdownParser Output Contract - Anchor Schema', () => {
  it('should populate anchors array with documented AnchorObject schema', async () => {
    // Given: Parser with fixture containing anchors
    const parser = createMarkdownParser();
    const testFile = join(__dirname, 'fixtures', 'valid-citations.md');

    // When: Parse file
    const result = await parser.parseFile(testFile);

    // Then: Anchor objects match Implementation Guide schema
    expect(result.anchors.length).toBeGreaterThan(0);

    const anchor = result.anchors[0];

    // Validate required fields per Implementation Guide
    expect(anchor).toHaveProperty('anchorType');
    expect(anchor).toHaveProperty('id');
    expect(anchor).toHaveProperty('rawText');
    expect(anchor).toHaveProperty('fullMatch');
    expect(anchor).toHaveProperty('line');
    expect(anchor).toHaveProperty('column');

    // Validate enum values
    expect(['header', 'block']).toContain(anchor.anchorType);

    // Validate types
    expect(typeof anchor.id).toBe('string');
    expect(typeof anchor.fullMatch).toBe('string');
    expect(typeof anchor.line).toBe('number');
    expect(typeof anchor.column).toBe('number');

    // rawText can be null for block anchors
    if (anchor.rawText !== null) {
      expect(typeof anchor.rawText).toBe('string');
    }
  });
});
```

**Improvements**:
- ✅ Tests validate Implementation Guide LinkObject schema (linkType, scope, anchorType, source, target)
- ✅ Tests validate Implementation Guide AnchorObject schema (anchorType, id, rawText)
- ✅ Tests validate nested path structures (source.path.absolute, target.path.{raw,absolute,relative})
- ✅ Tests validate enum constraints (linkType: markdown|wiki, scope: internal|cross-document, anchorType: header|block)
- ✅ Tests use BDD Given-When-Then structure
- ✅ Tests will FAIL (expected) because current implementation returns different schema

### Required Changes by Component

**Test File** (`test/parser-output-contract.test.js` - MODIFY):
- Update "should populate links array..." test to validate documented LinkObject schema
- Update "should populate anchors array..." test to validate documented AnchorObject schema
- Add test: "should correctly populate path variations (raw, absolute, relative)" for Link target paths
- Add test: "should validate enum constraints for linkType, scope, anchorType"
- Replace all references to `type` with `linkType` (links) or `anchorType` (anchors)
- Replace all references to `file` with `target.path` structure
- Replace all references to `anchor` (as anchor ID) with `id` (for anchors) or `target.anchor` (for links)
- Use BDD Given-When-Then comment structure consistently

**Do NOT Modify**:
❌ `MarkdownParser.js` implementation (Task 1.3 will fix implementation)
❌ `CitationValidator.js` (Task 1.3 will update to use new schema)
❌ Existing test fixtures (read-only for validation)
❌ Other test files (only update parser-output-contract.test.js)

---

## Scope Boundaries

### ❌ Explicitly OUT OF SCOPE

**Fixing the implementation**:

```javascript
// ❌ VIOLATION: Don't modify MarkdownParser.js
// Task 1.3 will refactor implementation to match schema
```

**Creating new test files**:

```javascript
// ❌ VIOLATION: Don't create parser-schema-contract.test.js
// UPDATE existing parser-output-contract.test.js instead
```

**Modifying other components**:
- ❌ CitationValidator.js (Task 1.3 handles validator updates)
- ❌ Factory functions (no schema changes needed)
- ❌ CLI orchestrator (transparent to schema changes)

### Validation Commands

```bash
# Verify only test file modified
git status --short
# Expected: M tools/citation-manager/test/parser-output-contract.test.js

# Verify MarkdownParser.js unchanged
git diff tools/citation-manager/src/MarkdownParser.js
# Expected: empty (no changes)

# Run updated tests (expect FAILURES)
npm test -- parser-output-contract
# Expected: Multiple test failures showing schema mismatches
#   - "Expected property 'linkType' to exist" (has 'type' instead)
#   - "Expected property 'source' to exist" (missing nested structure)
#   - "Expected property 'anchorType' to exist" (has 'type' instead)
```

---

## Validation

### Verify Changes

```bash
# Run updated contract tests (should FAIL)
npm test -- parser-output-contract
# Expected: Test failures showing:
#   - Links missing linkType, scope, anchorType, source, target.path structure
#   - Anchors missing anchorType, id (has type, anchor instead)
#   - Clear failure messages indicating schema mismatch

# Verify test file exists and updated
ls -la tools/citation-manager/test/parser-output-contract.test.js
# Expected: File exists, ~200-250 lines (expanded from ~164)

# Count test cases
grep -c "it('should" tools/citation-manager/test/parser-output-contract.test.js
# Expected: 8+ test cases (up from 6 in Task 1.1)
```

### Expected Test Behavior

```bash
# Tests should FAIL with clear schema mismatch messages
npm test -- parser-output-contract

# Sample expected output:
✗ MarkdownParser Output Contract - Link Schema
  ✗ should populate links array with documented LinkObject schema
    AssertionError: Expected link to have property 'linkType'
    Expected: { linkType: string, scope: string, ... }
    Received: { type: 'cross-document', text: '...', file: '...', ... }

✗ MarkdownParser Output Contract - Anchor Schema
  ✗ should populate anchors array with documented AnchorObject schema
    AssertionError: Expected anchor to have property 'anchorType'
    Expected: { anchorType: string, id: string, ... }
    Received: { type: 'obsidian-block-ref', anchor: 'FR1', ... }

Test Files  1 failed (1)
Tests  8 failed (8)
```

### Success Criteria

✅ **Test Updates Complete**: All link/anchor tests validate Implementation Guide schema
✅ **Schema Properties Validated**: Tests check linkType, scope, anchorType, source.path, target.path structure
✅ **Enum Constraints Tested**: Tests validate linkType (markdown|wiki), scope (internal|cross-document), anchorType (header|block)
✅ **Path Variations Tested**: Tests validate target.path.raw, target.path.absolute, target.path.relative
✅ **Tests Appropriately Fail**: Test suite fails with clear messages showing current implementation doesn't match documented schema
✅ **Scope Adherence**: Only parser-output-contract.test.js modified (git status confirms)
✅ **BDD Structure**: All tests use Given-When-Then comment structure

---

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
- Model: Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)
- Role: Test Writer Agent
- Execution Date: 2025-10-07

### Debug Log References
No debug logs generated - implementation proceeded cleanly without errors.

### Completion Notes
Successfully updated `parser-output-contract.test.js` to validate the Implementation Guide schema as the source of truth. All tests now check for the documented LinkObject and AnchorObject schemas including:
- LinkObject schema with linkType, scope, anchorType, source/target path structures
- AnchorObject schema with anchorType, id, rawText properties
- Nested path validation (source.path.absolute, target.path.raw/absolute/relative)
- Enum constraint validation for linkType, scope, and anchorType

Tests appropriately FAIL as expected, exposing the mismatch between current implementation (which uses `type`, `file`, `anchor`) and documented contract (which uses `linkType`, `scope`, `anchorType`, `source`, `target`, `id`).

### File List
**Modified**:
- `/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/cc-workflows/tools/citation-manager/test/parser-output-contract.test.js` (164 → 242 lines, 8 test cases)

**Unchanged** (verified via git diff):
- `tools/citation-manager/src/MarkdownParser.js` (no changes)
- All other source files (no changes)

### Implementation Challenges
No significant challenges encountered. The task specification was clear and comprehensive. Implementation proceeded as follows:

1. Replaced existing anchor test to validate `anchorType`, `id`, `rawText`, `fullMatch`, `line`, `column` properties per Implementation Guide
2. Replaced existing link test to validate `linkType`, `scope`, `anchorType`, `source`, `target` with nested path structures
3. Added new test for path variations (raw, absolute, relative) validation
4. Added new test for enum constraint validation (linkType: markdown|wiki, scope: internal|cross-document, anchorType: header|block)
5. All tests use BDD Given-When-Then comment structure consistently

### Validation Results

**Git Status Check**:

```bash
M tools/citation-manager/test/parser-output-contract.test.js
```

✅ Only test file modified

**MarkdownParser.js Unchanged**:

```bash
(empty output - no changes)
```

✅ Implementation file untouched

**Test Case Count**:

```bash
8 test cases
```

✅ Increased from 6 to 8 test cases

**File Size**:

```bash
242 lines
```

✅ Expanded from 164 to 242 lines

**Test Execution Results**:

```bash
Test Files  1 failed (1)
Tests  4 failed | 4 passed (8)
```

**Failed Tests (Expected)**:
1. ✅ `should populate anchors array with documented AnchorObject schema`
   - Error: `expected { type: 'header', …(5) } to have property "anchorType"`
   - Shows current implementation uses `type` instead of `anchorType`

2. ✅ `should populate links array with documented LinkObject schema`
   - Error: `expected { type: 'cross-document', …(6) } to have property "linkType"`
   - Shows current implementation uses `type` instead of `linkType`

3. ✅ `should correctly populate path variations (raw, absolute, relative)`
   - Error: `expected undefined to be defined` (looking for link.scope)
   - Shows current implementation missing `scope` property entirely

4. ✅ `should validate enum constraints for linkType, scope, anchorType`
   - Error: `expected [ 'markdown', 'wiki' ] to include undefined`
   - Shows current implementation missing `linkType` property

**Passing Tests** (validating top-level contract structure):
- ✅ `should return complete Parser Output Contract with all fields`
- ✅ `should populate headings array with level, text, raw properties`
- ✅ `should validate headings extracted from complex header fixture`
- ✅ `should validate parser output matches documented contract schema`

All test failures clearly demonstrate the schema mismatch between current implementation and documented contract, exactly as expected for the RED phase of TDD.

---

## Evaluation Agent Instructions

Validate the implementation above against the task specification. Your validation must answer:

**Did implementation follow task specification exactly?**

Reference these specification sections:
- **"Required Changes by Component"**: Verify only parser-output-contract.test.js updated with documented schema tests
- **"Success Criteria"**: Check all ✅ items pass
- **"Validation" → "Verify Changes"**: Run provided bash commands
- **"Scope Boundaries"**: Confirm no modifications outside allowed scope

Populate the Evaluation Agent Notes section below with your findings.

### Evaluation Agent Notes

> [!attention] **Evaluation Agent:**
> Populate this section during validation execution.

### Validator Model Used
- Model: Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)
- Role: Application Technical Lead (Evaluation Agent)
- Execution Date: 2025-10-07

### Task Specification Compliance

The implementation fully complies with the task specification. All required changes were implemented exactly as specified in the "Required Changes by Component" section.

**Validation Checklist**:
- [x] Files Modified: Only `parser-output-contract.test.js` updated? **YES** - Confirmed via `git status --short`
- [x] Scope Adherence: No implementation changes, no other test file changes? **YES** - All source files unchanged
- [x] Objective Met: Tests validate Implementation Guide schema (LinkObject, AnchorObject)? **YES** - All schema properties validated
- [x] Schema Properties: Tests check linkType, scope, anchorType, source/target path structures? **YES** - Lines 107-135 validate all properties
- [x] Enum Validation: Tests validate linkType/scope/anchorType enum constraints? **YES** - Dedicated test at lines 166-189
- [x] Tests Appropriately Fail: Test suite fails showing schema mismatch? **YES** - 4 tests fail as expected (see details below)
- [x] BDD Structure: All tests use Given-When-Then comments? **YES** - All 8 tests use BDD structure consistently

**Scope Boundary Validation**:
- [x] MarkdownParser.js unchanged (git diff shows no changes) **YES** - `git diff` returned empty output
- [x] No new test files created (only parser-output-contract.test.js modified) **YES** - Only one modified file in test directory
- [x] No modifications to CitationValidator.js or other components **YES** - `git status tools/citation-manager/src/` shows clean working tree
- [x] Test failures clearly show expected vs actual schema differences **YES** - Error messages clearly show property mismatches

### Test Execution Results

**Test Suite Summary**:
- Total Tests: 8 (increased from 6, as required)
- Passed: 4 tests (top-level contract structure validation)
- Failed: 4 tests (schema property validation - expected failures)
- File Size: 242 lines (expanded from 164 lines, within expected range)

**Expected Failures (RED Phase - TDD)**:

1. **Anchor Schema Test** (Line 71):
   - Error: `expected { type: 'header', …(5) } to have property "anchorType"`
   - Shows current implementation uses `type` instead of `anchorType`
   - Validates test correctly checks for Implementation Guide schema

2. **Link Schema Test** (Line 107):
   - Error: `expected { type: 'cross-document', …(6) } to have property "linkType"`
   - Shows current implementation uses `type` instead of `linkType`
   - Validates test correctly checks for Implementation Guide schema

3. **Path Variations Test** (Line 149):
   - Error: `expected undefined to be defined` (looking for `link.scope`)
   - Shows current implementation missing `scope` property entirely
   - Validates test correctly checks for nested path structures

4. **Enum Constraints Test** (Line 179):
   - Error: `expected [ 'markdown', 'wiki' ] to include undefined`
   - Shows current implementation missing `linkType` property
   - Validates test correctly enforces enum constraints

All test failures demonstrate the exact schema mismatches the RED phase is designed to expose. The failures provide clear, actionable information for the GREEN phase (Task 1.3).

### Validation Commands Executed

```bash
# Verify only test file modified
git status --short
# Result: M tools/citation-manager/test/parser-output-contract.test.js ✅

# Verify MarkdownParser.js unchanged
git diff tools/citation-manager/src/MarkdownParser.js
# Result: (empty output - no changes) ✅

# Verify source files unchanged
git status tools/citation-manager/src/
# Result: nothing to commit, working tree clean ✅

# Count test cases
grep -c "it('should" tools/citation-manager/test/parser-output-contract.test.js
# Result: 8 (increased from 6) ✅

# Verify file size
wc -l tools/citation-manager/test/parser-output-contract.test.js
# Result: 242 lines (expanded from 164) ✅

# Run tests (expect failures)
npm test -- parser-output-contract
# Result: 4 failed | 4 passed (8 total) ✅

# Verify BDD structure
grep -n "// Given:\|// When:\|// Then:" tools/citation-manager/test/parser-output-contract.test.js
# Result: All 8 tests use Given-When-Then structure ✅
```

### Success Criteria Verification

All success criteria from the task specification are met:

✅ **Test Updates Complete**: All link/anchor tests validate Implementation Guide schema
✅ **Schema Properties Validated**: Tests check linkType, scope, anchorType, source.path, target.path structure (lines 107-135)
✅ **Enum Constraints Tested**: Tests validate linkType (markdown|wiki), scope (internal|cross-document), anchorType (header|block) (lines 166-189)
✅ **Path Variations Tested**: Tests validate target.path.raw, target.path.absolute, target.path.relative (lines 137-164)
✅ **Tests Appropriately Fail**: Test suite fails with clear messages showing current implementation doesn't match documented schema
✅ **Scope Adherence**: Only parser-output-contract.test.js modified (git status confirms)
✅ **BDD Structure**: All tests use Given-When-Then comment structure

### Validation Outcome

**PASS** - Implementation fully complies with task specification.

The implementation successfully achieves the RED phase objective of Test-Driven Development: tests now validate the Implementation Guide schema as the source of truth and appropriately fail, exposing the schema mismatch between current implementation and documented contract. The failures provide clear, actionable guidance for Task 1.3 (GREEN phase implementation).

### Remediation Required

None. Implementation is complete and correct.
