---
story: "User Story 1.8: Implement Validation Enrichment Pattern"
epic: "Epic: Citation Manager Test Migration & Content Aggregation"
phase: "Phase 1: Test Infrastructure Setup"
task-id: "1.1"
task-anchor: "#US1-8T1-1"
wave: "1"
implementation-agent: "test-writer"
status: "ready"
---

# Task 1.1: Create Test Fixtures for Enrichment Pattern

## Objective

Create test fixture files demonstrating validation enrichment scenarios for testing the new `{ summary, links }` ValidationResult structure with enriched LinkObjects.

_Source: Story [US1.8 Acceptance Criteria](../us1.8-implement-validation-enrichment-pattern.md#^US1-8AC1)_

## Current State → Required State

### BEFORE: No Enrichment Pattern Test Fixtures

**Problem**: Current test fixtures support old ValidationResult structure (separate validation arrays). No fixtures exist for testing enriched LinkObjects with `validation` property.

**Missing Coverage**:
- ❌ No fixtures demonstrating valid links with enrichment
- ❌ No fixtures demonstrating error links with enrichment
- ❌ No fixtures demonstrating warning links with enrichment
- ❌ No fixtures for mixed validation status scenarios

### AFTER: Comprehensive Enrichment Test Fixtures

Create fixture files in `tools/citation-manager/test/fixtures/enrichment/`:

```plaintext
tools/citation-manager/test/fixtures/enrichment/
├── valid-links-source.md         # Source with valid citations only
├── valid-links-target.md         # Target file for valid citations
├── error-links-source.md         # Source with error citations
├── error-links-target.md         # Target file (missing anchors)
├── warning-links-source.md       # Source with warning-level citations
├── warning-links-target.md       # Target file (path conversion warnings)
└── mixed-validation-source.md    # Source with mix of valid/error/warning
```

**Fixture Design Requirements**:

1. **valid-links-source.md**: Contains 3 valid citations
   - Cross-document link with valid header anchor
   - Cross-document link with valid block anchor
   - Full-file link (no anchor)

2. **error-links-source.md**: Contains 2 error-producing citations
   - Link to valid file with non-existent header anchor
   - Link to valid file with non-existent block anchor

3. **warning-links-source.md**: Contains 1 warning-producing citation
   - Link using relative path (triggers path conversion warning)

4. **mixed-validation-source.md**: Contains 5 citations
   - 2 valid (status: "valid")
   - 2 errors (status: "error")
   - 1 warning (status: "warning")

**Target Files**:
- Create corresponding target files with appropriate anchor structure
- Ensure anchors exist/don't exist per test scenario requirements

### Required Changes

**Component: Test Fixtures** (CREATE 7 new files)

Create fixture files following "Real Systems, Fake Fixtures" principle:
- Use real markdown syntax (no mocking)
- Create actual file structure on disk
- Design for validation enrichment testing

**Fixture Content Pattern**:

```markdown
<!-- valid-links-source.md -->
# Valid Links Test Fixture

This fixture contains only valid citations for enrichment testing.

[Valid Header Link](valid-links-target.md#Test%20Section)

[Valid Block Link](valid-links-target.md#^test-block)

[Valid Full File Link](valid-links-target.md)
```

```markdown
<!-- valid-links-target.md -->
# Valid Links Target

## Test Section

Content under test section.

Block reference test content ^test-block
```

```markdown
<!-- error-links-source.md -->
# Error Links Test Fixture

This fixture contains citations that will produce validation errors.

[Missing Header Anchor](error-links-target.md#NonExistent%20Section)

[Missing Block Anchor](error-links-target.md#^missing-block)
```

```markdown
<!-- error-links-target.md -->
# Error Links Target

## Existing Section

This file has some content but missing the anchors referenced in source.

No block anchors exist in this file.
```

### Do NOT Modify

**Preserve Existing**:
- ✅ Keep all existing test fixtures unchanged
- ✅ Don't modify test files (only create new fixtures)
- ✅ Don't add test cases yet (fixtures only in this task)

**Scope Boundaries**:

❌ **Creating test files** (separate task)

```javascript
// ❌ VIOLATION: Don't create test files in this task
describe("Enrichment Pattern", () => {
  // Test implementation is Task 1.2
})
```

❌ **Modifying existing fixtures**

```markdown
<!-- ❌ VIOLATION: Don't modify existing fixtures -->
<!-- Files in test/fixtures/ (non-enrichment) remain unchanged -->
```

❌ **Adding validation logic** (implementation task)

```javascript
// ❌ VIOLATION: Don't implement enrichment logic yet
link.validation = { status: "valid" }  // This is Task 2.1
```

## Validation

### Verify Fixture Creation

```bash
# Should show exactly 7 new fixture files
ls -1 tools/citation-manager/test/fixtures/enrichment/ | wc -l
# Expected: 7

# Should show correct file names
ls -1 tools/citation-manager/test/fixtures/enrichment/
# Expected:
# error-links-source.md
# error-links-target.md
# mixed-validation-source.md
# valid-links-source.md
# valid-links-target.md
# warning-links-source.md
# warning-links-target.md
```

### Verify Fixture Content

```bash
# Valid fixtures should have citations
grep -c "\[.*\](.*\.md" tools/citation-manager/test/fixtures/enrichment/valid-links-source.md
# Expected: 3

# Error fixtures should have non-existent anchor references
grep -c "NonExistent\|missing-block" tools/citation-manager/test/fixtures/enrichment/error-links-source.md
# Expected: 2

# Mixed fixture should have 5 citations
grep -c "\[.*\](.*\.md" tools/citation-manager/test/fixtures/enrichment/mixed-validation-source.md
# Expected: 5
```

### Success Criteria

- ✅ Created `tools/citation-manager/test/fixtures/enrichment/` directory
- ✅ Created 7 fixture files (4 source, 3 target)
- ✅ valid-links-source.md contains 3 valid citations
- ✅ error-links-source.md contains 2 error-producing citations
- ✅ warning-links-source.md contains 1 warning-producing citation
- ✅ mixed-validation-source.md contains 5 citations (2 valid, 2 error, 1 warning)
- ✅ Target files have appropriate anchor structure for test scenarios
- ✅ All fixtures use real markdown syntax (no mock syntax)
- ✅ No modifications to existing test fixtures
- ✅ No test files created (fixtures only)

## Implementation Agent Instructions

Execute the task specification above. When complete, populate the Implementation Agent Notes section below with:
- Agent model and version used
- Files created
- Fixture design rationale
- Validation command results

### Implementation Agent Notes

> [!attention] **AI Agent:**
> Populate this section during implementation execution.

### Agent Model Used
[Record the specific AI agent model and version used]

### Debug Log References
[Reference any debug logs or traces generated]

### Completion Notes
[Notes about completion and any issues encountered]

### File List
[List all 7 fixture files created with paths]

### Fixture Design Rationale
[Document why each fixture was designed with specific citation patterns]

### Validation Results
[Results of running validation bash commands above]

## Evaluation Agent Instructions

Validate the implementation above against the task specification. Your validation must answer:

**Did implementation create exactly 7 fixture files with correct content patterns?**

Reference these specification sections:
- **"AFTER: Comprehensive Enrichment Test Fixtures"**: Verify 7 files created with correct names
- **"Fixture Design Requirements"**: Check each fixture has specified citation counts
- **"Success Criteria"**: Verify all ✅ items pass
- **"Validation" → "Verify Fixture Creation"**: Run provided bash commands
- **"Scope Boundaries"**: Confirm no test files created, no existing fixtures modified

Populate the Evaluation Agent Notes section below with your findings.

### Evaluation Agent Notes

> [!attention] **Evaluation Agent:**
> Populate this section during validation execution.

### Validator Model Used
[Record model name and version]

### Task Specification Compliance
[Compare implementation against exact task spec from story]

**Validation Checklist**:
- [ ] Files Created: Exactly 7 fixture files created?
- [ ] File Names: Match specification exactly?
- [ ] Citation Counts: valid-links (3), error-links (2), warning-links (1), mixed (5)?
- [ ] Anchor Structure: Target files have appropriate anchors per scenario?
- [ ] Real Markdown: No mock syntax, actual markdown links?
- [ ] Scope Adherence: No test files created, no existing fixtures modified?
- [ ] Directory Created: `enrichment/` subdirectory exists?

**Scope Boundary Validation**:
- [ ] No test implementation files created (*.test.js)
- [ ] No modifications to existing fixtures outside enrichment/
- [ ] No validation logic implementation (code changes)

### Validation Outcome
[PASS or FAIL with specific deviations if FAIL]

### Remediation Required
[Specific fixes needed if FAIL, empty if PASS]
