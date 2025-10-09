---
story: "User Story 1.6: Refactor MarkdownParser.Output.DataContract - Eliminate Duplicate Anchor Entries"
epic: "Citation Manager Test Migration & Content Aggregation"
phase: "Phase 4: Regression Validation & Documentation"
task-id: "4.2"
task-anchor: "^US1-6T4-2"
wave: "4"
implementation-agent: "application-tech-lead"
evaluation-agent: "application-tech-lead"
status: "ready"
---

# Task 4.2: Update MarkdownParser Implementation Guide JSON Schema

## Objective

Update MarkdownParser Implementation Guide to reflect new AnchorObject schema with dual ID properties (`id` and `urlEncodedId`).

**Link**: [Task 4.2 in US1.6](../us1.6-refactor-anchor-schema.md#^US1-6T4-2)

## Current State → Required State

### BEFORE: Old AnchorObject Schema Documentation

```markdown
<!-- File: tools/citation-manager/design-docs/component-guides/Markdown Parser Implementation Guide.md -->

#### AnchorObject Schema

{
  anchorType: "header" | "block",
  id: string,                    // Anchor ID (various formats)
  rawText: string | null,
  fullMatch: string,
  line: number,
  column: number
}

Example:
- Header: { anchorType: "header", id: "Story 1.5: Implement Cache", ... }
- Header (Obsidian): { anchorType: "header", id: "Story%201.5%20Implement%20Cache", ... }
  ❌ Creates TWO separate objects for same header
```

### AFTER: Updated AnchorObject Schema Documentation

```markdown
<!-- File: tools/citation-manager/design-docs/component-guides/Markdown Parser Implementation Guide.md -->

#### AnchorObject Schema

{
  anchorType: "header" | "block",
  id: string,                    // Raw text format for headers, anchor ID for blocks
  urlEncodedId?: string,         // Obsidian-compatible format (headers only, always populated)
  rawText: string | null,
  fullMatch: string,
  line: number,
  column: number
}

**Field Descriptions**:
- `anchorType`: Type of anchor ("header" for headings, "block" for block references)
- `id`: Raw text format (headers) or anchor identifier (blocks)
- `urlEncodedId`: Obsidian-compatible URL-encoded format (ONLY for headers, always populated even when identical to id)
- `rawText`: Original text content (headers) or null (blocks)
- `fullMatch`: Full matched text from markdown
- `line`: Line number (1-indexed)
- `column`: Column position (0-indexed)

**Examples**:

Header with special characters:
{
  anchorType: "header",
  id: "Story 1.5: Implement Cache",
  urlEncodedId: "Story%201.5%20Implement%20Cache",
  rawText: "Story 1.5: Implement Cache",
  fullMatch: "## Story 1.5: Implement Cache",
  line: 10,
  column: 0
}

Simple header:
{
  anchorType: "header",
  id: "Introduction",
  urlEncodedId: "Introduction",  // Always populated, even when identical
  rawText: "Introduction",
  fullMatch: "## Introduction",
  line: 5,
  column: 0
}

Block anchor:
{
  anchorType: "block",
  id: "test-block",
  // ❌ NO urlEncodedId property for blocks
  rawText: null,
  fullMatch: "^test-block",
  line: 15,
  column: 42
}
```

### Problems

- ❌ Documentation shows old schema (two objects per header)
- ❌ No documentation of `urlEncodedId` property
- ❌ No clarification that urlEncodedId is headers-only
- ❌ Examples don't show new single-anchor-per-header structure

### Improvements

- ✅ Schema documentation reflects actual implementation
- ✅ `urlEncodedId` property documented with field description
- ✅ Clear distinction: headers have urlEncodedId, blocks don't
- ✅ Examples show single anchor with dual IDs
- ✅ Field descriptions explain usage patterns

### Required Changes by Component

**File**: `tools/citation-manager/design-docs/component-guides/Markdown Parser Implementation Guide.md`

**Section**: "Data Contracts → AnchorObject Schema"

**Updates Required**:
1. Add `urlEncodedId?: string` to schema definition
2. Add field description explaining urlEncodedId is headers-only, always populated
3. Update examples to show single anchor with both id and urlEncodedId
4. Add example showing simple header (urlEncodedId identical to id)
5. Add example showing block anchor (no urlEncodedId)
6. Remove old examples showing duplicate anchor objects

**Section**: "Pseudocode → extractAnchors() method" (if present)

**Updates Required**:
1. Update pseudocode to show single anchor creation
2. Show urlEncodedId population logic
3. Remove duplicate anchor creation logic

### Do NOT modify

- ❌ Other Implementation Guide sections unrelated to anchors
- ❌ CitationValidator Implementation Guide (separate document)
- ❌ Architecture documentation (covered in Task 4.3)
- ❌ Source code files

### Scope Boundaries

❌ **Adding implementation details beyond schema** (focus: data contract only)
❌ **Documenting future enhancements** (document current implementation)
❌ **Modifying non-anchor sections** (anchor schema updates only)
❌ **Creating new documentation files** (update existing guide)

**Validation Commands**:

```bash
# Should show ONLY Implementation Guide modification
git status --short tools/citation-manager/design-docs/component-guides/Markdown\ Parser\ Implementation\ Guide.md
# Expected: M  tools/citation-manager/design-docs/component-guides/Markdown Parser Implementation Guide.md

# Verify urlEncodedId documented
grep -c "urlEncodedId" tools/citation-manager/design-docs/component-guides/Markdown\ Parser\ Implementation\ Guide.md
# Expected: ≥ 3 (schema + examples)
```

## Validation

### Verify Changes

```bash
# 1. Verify schema definition updated
grep -A 10 "AnchorObject Schema" tools/citation-manager/design-docs/component-guides/Markdown\ Parser\ Implementation\ Guide.md | \
  grep "urlEncodedId"
# Expected: urlEncodedId?: string line present

# 2. Verify examples include urlEncodedId
grep -A 15 "Story 1.5: Implement Cache" tools/citation-manager/design-docs/component-guides/Markdown\ Parser\ Implementation\ Guide.md | \
  grep "urlEncodedId"
# Expected: urlEncodedId property in example

# 3. Verify block anchor example excludes urlEncodedId
grep -A 10 '"anchorType": "block"' tools/citation-manager/design-docs/component-guides/Markdown\ Parser\ Implementation\ Guide.md | \
  grep "urlEncodedId"
# Expected: empty output or comment showing absence

# 4. Validate citations in updated guide
npm run citation:validate tools/citation-manager/design-docs/component-guides/Markdown\ Parser\ Implementation\ Guide.md
# Expected: All citations valid
```

### Success Criteria

- ✅ AnchorObject schema definition includes `urlEncodedId?: string`
- ✅ Field descriptions explain urlEncodedId is headers-only, always populated
- ✅ Examples show single anchor with both id and urlEncodedId
- ✅ Example shows simple header with identical id and urlEncodedId
- ✅ Example shows block anchor without urlEncodedId
- ✅ Old duplicate anchor examples removed
- ✅ Documentation accurately reflects implemented schema

## Implementation Agent Instructions

Execute the task specification above. When complete, populate the Implementation Agent Notes section below with:
- Agent model and version used
- Files modified
- Documentation sections updated
- Validation command results

### Implementation Agent Notes

> [!attention] **AI Agent:**
> Populate this section during implementation execution.

### Agent Model Used
[Record the specific AI agent model and version used]

### Files Modified
[List documentation files updated]

### Sections Updated
[List specific sections modified in Implementation Guide]

### Validation Results
[Results of running validation commands]

## Evaluation Agent Instructions

Validate that the Implementation Guide accurately documents the new AnchorObject schema.

**Validation must confirm**:
- Schema definition updated with urlEncodedId
- Field descriptions clear and accurate
- Examples show correct structure
- Old duplicate-anchor examples removed
- Documentation matches implementation

### Evaluation Agent Notes

> [!attention] **Evaluation Agent:**
> Populate this section during validation execution.

### Validator Model Used
[Record model name and version]

### Task Specification Compliance

**Validation Checklist**:
- [ ] Schema definition includes urlEncodedId?
- [ ] Field descriptions accurate?
- [ ] Examples show single anchor with dual IDs?
- [ ] Block anchor example excludes urlEncodedId?
- [ ] Old duplicate examples removed?

**Scope Boundary Validation**:
- [ ] Only anchor-related documentation updated
- [ ] No implementation details added beyond schema
- [ ] No future enhancements documented

### Validation Outcome
[PASS or FAIL with specific deviations if FAIL]

### Remediation Required
[Specific fixes needed if FAIL, empty if PASS]
