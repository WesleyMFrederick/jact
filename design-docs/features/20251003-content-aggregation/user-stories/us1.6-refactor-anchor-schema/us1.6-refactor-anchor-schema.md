---
title: "User Story 1.6: Refactor MarkdownParser.Output.DataContract - Eliminate Duplicate Anchor Entries"
feature-title: Citation Manager Content Aggregation
epic-number: 1
epic-name: Citation Manager Test Migration & Content Aggregation
epic-url: ../../content-aggregation-prd.md#Epic%20Citation%20Manager%20Test%20Migration%20&%20Content%20Aggregation
user-story-number: 1.6
status: Needs Evaluation
---

# Story 1.6: Refactor MarkdownParser.Output.DataContract - Eliminate Duplicate Anchor Entries

<critical-llm-Initialization-Instructions>
When first reading this file, you MUST IMMEDIATELY run citation manager to extract base paths: `npm run citation:base-paths "this-file-path" -- --format json`. Read ALL discovered base path files to gather complete architectural context before proceeding.
</critical-llm-Initialization-Instructions>

## Story

**As a** developer working on content extraction features,
**I want** the MarkdownParser.Output.DataContract to represent each anchor once with both raw and URL-encoded ID variants as properties,
**so that** anchor data is normalized, memory-efficient, and easier to work with in downstream components.

_Source: [Story 1.6: Refactor MarkdownParser.Output.DataContract - Eliminate Duplicate Anchor Entries](../../content-aggregation-prd.md#Story%201.6%20Refactor%20MarkdownParser.Output.DataContract%20-%20Eliminate%20Duplicate%20Anchor%20Entries)_

## Acceptance Criteria

1. GIVEN a markdown header is parsed, WHEN the `MarkdownParser.Output.DataContract` is generated, THEN each header anchor SHALL be represented by a single AnchorObject containing both `id` (raw text format) and `urlEncodedId` (Obsidian-compatible format) properties, eliminating duplicate anchor entries. ^US1-6AC1
2. The AnchorObject schema SHALL include: `{ anchorType: "header"|"block", id: string, urlEncodedId: string, rawText: string|null, fullMatch: string, line: number, column: number }`, where `urlEncodedId` is always populated for header anchors (even when identical to `id`) and omitted for block anchors. ^US1-6AC2
3. The `CitationValidator.validateAnchorExists()` method SHALL check both `id` and `urlEncodedId` fields when matching anchors, maintaining backward compatibility with existing anchor validation logic. ^US1-6AC3
4. GIVEN a header containing colons and spaces (e.g., "Story 1.5: Implement Cache"), WHEN parsed, THEN the system SHALL generate one anchor with `id: "Story 1.5: Implement Cache"` and `urlEncodedId: "Story%201.5%20Implement%20Cache"`, not two separate anchor objects. ^US1-6AC4
5. GIVEN the refactored anchor schema is implemented, WHEN the full test suite executes, THEN all existing tests SHALL pass with zero functional regressions, and the `MarkdownParser.Output.DataContract` validation test SHALL confirm no duplicate anchor entries. ^US1-6AC5
6. The `MarkdownParser.Output.DataContract` JSON schema documentation SHALL be updated to reflect the new single-anchor-per-header structure with dual ID properties. ^US1-6AC6

_Source: [Story 1.6 Acceptance Criteria](../../content-aggregation-prd.md#Story%201.6%20Acceptance%20Criteria)_

## Technical Debt Resolution

**Closes Technical Debt**:
- [Duplicate Anchor Entries in MarkdownParser.Output.DataContract](../../content-aggregation-architecture.md#Duplicate%20Anchor%20Entries%20in%20MarkdownParser.Output.DataContract): Eliminates duplicate AnchorObject creation for headers with special characters, normalizes anchor representation to single object per header

## Dev Notes

### Architectural Context (C4)

This story refactors the MarkdownParser.Output.DataContract to eliminate duplicate anchor entries, establishing a normalized data model that serves as the foundation for the Strategy Pattern implementations in US1.7 (Anchor Validation) and US1.8 (Extraction Eligibility).

- **Components Affected**:
  - [MarkdownParser](../../content-aggregation-architecture.md#Citation%20Manager.Markdown%20Parser) (MODIFIED) - Refactor `extractAnchors()` to generate single AnchorObject with dual ID properties
  - [CitationValidator](../../content-aggregation-architecture.md#Citation%20Manager.Citation%20Validator) (MODIFIED) - Update anchor matching logic to check both `id` and `urlEncodedId` fields
  - [ParsedFileCache](../../content-aggregation-architecture.md#Citation%20Manager.ParsedFileCache) (INTEGRATION) - Cache stores and retrieves updated AnchorObject schema

- **Implementation Guides**:
  - [MarkdownParser Implementation Guide](../../../../component-guides/Markdown%20Parser%20Implementation%20Guide.md) - AnchorObject JSON schema and extraction pseudocode
  - [CitationValidator Implementation Guide](../../../../component-guides/CitationValidator%20Implementation%20Guide.md) - Anchor validation logic and integration patterns

### Files Impacted

- `tools/citation-manager/src/MarkdownParser.js` (MODIFY) - Refactor `extractAnchors()` method to generate single AnchorObject with both `id` and `urlEncodedId` properties
- `tools/citation-manager/src/CitationValidator.js` (MODIFY) - Update `validateAnchorExists()` to check both ID fields during anchor matching
- `tools/citation-manager/test/parser-output-contract.test.js` (MODIFY) - Update AnchorObject schema validation tests to enforce single-anchor-per-header constraint
- `tools/citation-manager/test/integration/citation-validator-anchor-matching.test.js` (CREATE) - Integration tests validating anchor matching works with both ID variants
- `tools/citation-manager/design-docs/component-guides/Markdown Parser Implementation Guide.md` (MODIFY) - Update AnchorObject JSON schema documentation

### Current Architecture (Pre-US1.6)

#### Problem: Duplicate Anchor Entries

Currently, the MarkdownParser creates **two separate AnchorObject entries** for each header that contains special characters (spaces, colons, etc.). This duplication occurs because Obsidian requires URL-encoded anchor IDs while maintaining human-readable raw text:

```javascript
// tools/citation-manager/src/MarkdownParser.js (BEFORE)
// Lines 399-446 in extractAnchors()

// For header: "## Story 1.5: Implement Cache"
const anchors = [
  {
    anchorType: "header",
    id: "Story 1.5: Implement Cache",      // Raw text version
    rawText: "Story 1.5: Implement Cache",
    fullMatch: "## Story 1.5: Implement Cache",
    line: 10,
    column: 0
  },
  {
    anchorType: "header",
    id: "Story%201.5%20Implement%20Cache",  // URL-encoded version (Obsidian-compatible)
    rawText: "Story 1.5: Implement Cache",
    fullMatch: "## Story 1.5: Implement Cache",
    line: 10,
    column: 0
  }
];
```

**Impact**:
- **Memory inefficiency**: Duplicate objects for same logical anchor
- **Validation complexity**: CitationValidator must iterate twice as many anchors
- **Data model confusion**: Two objects represent single conceptual entity
- **Epic 2 blocker**: ContentExtractor needs clean, normalized anchor data

_Source: [MarkdownParser Implementation Guide - Whiteboard](../../../../component-guides/Markdown%20Parser%20Implementation%20Guide.md#Whiteboard)_

### Target Architecture (Post-US1.6)

#### Solution: Single AnchorObject with Dual ID Properties

The refactored schema represents each anchor as a single object with both ID variants as properties:

```javascript
// tools/citation-manager/src/MarkdownParser.js (AFTER)
// Refactored extractAnchors()

// For header: "## Story 1.5: Implement Cache"
const anchors = [
  {
    anchorType: "header",
    id: "Story 1.5: Implement Cache",           // Raw text format
    urlEncodedId: "Story%201.5%20Implement%20Cache", // Obsidian-compatible format
    rawText: "Story 1.5: Implement Cache",
    fullMatch: "## Story 1.5: Implement Cache",
    line: 10,
    column: 0
  }
];

// For simple headers without special characters:
// "## Introduction"
const anchors = [
  {
    anchorType: "header",
    id: "Introduction",
    urlEncodedId: "Introduction",  // Always populated, even when identical to id
    rawText: "Introduction",
    fullMatch: "## Introduction",
    line: 5,
    column: 0
  }
];
```

**Schema Design Decision**:
- `urlEncodedId` is **always populated**, even when identical to `id`
- **Rationale**: [Simplicity First](../../../../../../../design-docs/Architecture%20Principles.md#^simplicity-first) principle - uniform data structure over premature optimization (~600 bytes saved per 50 headers not worth conditional logic)
- **Benefits**: No null checks required, clearer intent, consistent structure for all anchors

**CitationValidator Integration** ([[#^US1-6AC3|AC3]]):

```javascript
// tools/citation-manager/src/CitationValidator.js (MODIFIED)
async validateAnchorExists(anchor, targetFile) {
  const parsed = await this.parsedFileCache.resolveParsedFile(targetFile);

  // Check both ID variants for match
  const anchorExists = parsed.anchors.some(anchorObj =>
    anchorObj.id === anchor || anchorObj.urlEncodedId === anchor
  );

  if (anchorExists) {
    return { valid: true };
  } else {
    // Generate suggestions from both ID variants
    const suggestion = this.generateAnchorSuggestions(anchor, parsed.anchors);
    return { valid: false, suggestion };
  }
}
```

**Benefits**:
- **Memory efficiency**: Single object per logical anchor (50% reduction for headers with special characters)
- **Cleaner validation**: Check both properties in single object iteration
- **Data integrity**: One source of truth for each anchor
- **Epic 2 foundation**: Enables Strategy Pattern for markdown flavor support

_Source: [Content Aggregation Architecture Whiteboard](../../research/content-aggregation-architecture-whiteboard.md)_

### Dependencies

- **Prerequisite**: [Story 1.5: Implement a Cache for Parsed File Objects](../../content-aggregation-prd.md#Story%201.5%20Implement%20a%20Cache%20for%20Parsed%20File%20Objects) complete - ParsedFileCache validated with current AnchorObject schema
- **Enables**: [Story 1.7](../../content-aggregation-prd.md#Story%201.7%20Implement%20ParsedDocument%20Facade) - ParsedDocument facade can consume normalized anchor data
- **Strategic Position**: Data model refactoring before Strategy Pattern implementation (US1.8) per [Data Model First](../../../../../../../design-docs/Architecture%20Principles.md#^data-model-first) principle

_Source: [Content Aggregation Architecture Whiteboard - Phase 1](../../research/content-aggregation-architecture-whiteboard.md#Phase%201%20Implement%20US%201.6%20(Refactor%20the%20Anchor%20Schema))_

### Design Principles Adherence

This story must adhere to the following [Design Principles](../../../../../../../design-docs/Architecture%20Principles.md):

**Critical Principles:**
- [**Data Model First**](../../../../../../../design-docs/Architecture%20Principles.md#^data-model-first) (Data-First): Stabilize AnchorObject schema before building Strategy Pattern logic that consumes it (prevents rework in US1.7-1.8)
- [**Illegal States Unrepresentable**](../../../../../../../design-docs/Architecture%20Principles.md#^illegal-states-unrepresentable) (Data-First): Single AnchorObject per header makes duplicate entries impossible by design
- [**One Source of Truth**](../../../../../../../design-docs/Architecture%20Principles.md#^one-source-of-truth) (Data-First): Each anchor has exactly one canonical representation with multiple ID formats as properties
- [**Single Responsibility**](../../../../../../../design-docs/Architecture%20Principles.md#^single-responsibility) (Modular): AnchorObject represents single logical entity with all ID variants as properties

**Implementation Guidance:**
- Use TDD approach: Update tests to expect new schema (RED), refactor implementation (GREEN)
- Populate `urlEncodedId` only when it differs from `id` (avoid redundant data)
- Maintain backward compatibility: CitationValidator checks both ID fields during validation

### Testing

- **Test Framework**: [Vitest](../../content-aggregation-architecture.md#Testing%20Strategy) (shared workspace framework)
- **Test Strategy**: TDD approach - tests define schema first, implementation follows, real file system operations per workspace "Real Systems, Fake Fixtures" principle
- **Test Location**: `tools/citation-manager/test/` (established in US1.4a)

#### Required Test Implementation

##### 1. AnchorObject Schema Validation Tests (Unit Test)
- **Purpose**: Validate single-anchor-per-header constraint and dual ID property structure
- **Acceptance Criteria**: Validates [[#^US1-6AC1|AC1]] (single AnchorObject per header), [[#^US1-6AC2|AC2]] (schema includes both ID properties), [[#^US1-6AC4|AC4]] (special character example validates correctly)
- **Implementation Guidance**:
  - Test 1: Header with spaces and colons generates single anchor with both `id` and `urlEncodedId`
  - Test 2: Simple header generates single anchor with `urlEncodedId: null`
  - Test 3: Block anchor schema unchanged (no `urlEncodedId` field needed)
  - Use real test fixtures from `test/fixtures/` directory

##### 2. CitationValidator Anchor Matching Integration Test (Integration Test)
- **Purpose**: Verify anchor matching works with both ID variants after schema refactoring
- **Acceptance Criteria**: Validates [[#^US1-6AC3|AC3]] (CitationValidator checks both ID fields)
- **Implementation Guidance**:
  - Create test fixture with header "Story 1.5: Implement Cache"
  - Test validation succeeds when link uses raw format: `#Story 1.5: Implement Cache`
  - Test validation succeeds when link uses URL-encoded format: `#Story%201.5%20Implement%20Cache`
  - Use factory-created validator with real dependencies

##### 3. Full Regression Test (Regression Validation)
- **Purpose**: Confirm zero functional regressions from schema refactoring
- **Acceptance Criteria**: Validates [[#^US1-6AC5|AC5]] (all existing tests pass)
- **Implementation Guidance**:
  - Execute complete test suite via `npm test`
  - All existing validation tests must pass with refactored schema
  - No changes to test assertions required (validation logic backward compatible)

---

## Implementation Risks & Mitigations

### Risk: Breaking Changes to Downstream Consumers

**Challenge**: Refactoring AnchorObject schema is a breaking change to the MarkdownParser.Output.DataContract. Any code directly iterating `anchors` array may break.

**Known Consumers** (must be updated):
1. **CitationValidator.validateAnchorExists()** - Uses `anchors.some(a => a.id === anchor)` for matching
2. **ParsedFileCache** - Stores and retrieves AnchorObjects (transparent pass-through, no direct consumption)
3. **Test fixtures** - All test files referencing AnchorObject structure

**Mitigation Strategy**:
- Update CitationValidator to check both `id` and `urlEncodedId` in single pass
- Update all test fixtures to expect new schema structure
- Use comprehensive regression testing to catch missed consumers
- AC5 gate: Full test suite must pass before story completion

_Source: [Content Aggregation PRD - Technical Lead Feedback](../../content-aggregation-prd.md#Story%201.6%20Refactor%20MarkdownParser.Output.DataContract%20-%20Eliminate%20Duplicate%20Anchor%20Entries)_

---

## Tasks / Subtasks

### Phase 1: AnchorObject Schema Tests (RED Phase - TDD)

- [ ] **1.1. Update Parser Schema Tests to Expect Single Anchor with Dual ID Properties** ^US1-6T1-1
  - **Implementation Details**: [tasks/01-1-1-update-parser-schema-tests-us1.6.md](tasks/01-1-1-update-parser-schema-tests-us1.6.md)
  - **Agent**: test-writer
  - **Objective**: Update parser-output-contract.test.js to expect new AnchorObject schema with single anchor per header containing both `id` and `urlEncodedId` properties (tests will fail - RED phase)
  - **Input**: Current parser-output-contract.test.js, AnchorObject schema from lines 109-139
  - **Output**: Updated AnchorObject schema validation tests (failing until implementation)
  - **Files**:
    - `tools/citation-manager/test/parser-output-contract.test.js` (modify)
  - **Scope**:
    - Update anchor extraction tests to expect single AnchorObject per header
    - Add test validating `urlEncodedId` always populated for header anchors (even when identical to `id`)
    - Add test validating headers with special characters generate single anchor with both ID variants
    - Add test validating block anchors do NOT have `urlEncodedId` property
    - Add test enforcing no duplicate anchor entries for same header
    - Use BDD Given-When-Then comment structure
    - Tests should FAIL showing current implementation creates duplicate anchors
  - **Test**: All updated anchor schema tests fail (expected - RED phase)
  - **Commands**: `npm test -- parser-output-contract` (expect failures)
  - _Requirements_: [[#^US1-6AC1|AC1]], [[#^US1-6AC2|AC2]], [[#^US1-6AC4|AC4]]
  - _Leverage_: Existing parser-output-contract.test.js structure, target schema from lines 109-139

- [ ] **1.2. Write CitationValidator Anchor Matching Integration Tests** ^US1-6T1-2
  - **Implementation Details**: [tasks/01-1-2-write-validator-anchor-matching-tests-us1.6.md](tasks/01-1-2-write-validator-anchor-matching-tests-us1.6.md)
  - **Agent**: test-writer
  - **Objective**: Create integration tests validating CitationValidator can match anchors using both `id` and `urlEncodedId` fields (tests will fail - RED phase)
  - **Input**: CitationValidator current implementation, target schema from lines 146-166
  - **Output**: Integration test suite for dual ID anchor matching (failing until implementation)
  - **Files**:
    - `tools/citation-manager/test/integration/citation-validator-anchor-matching.test.js` (create)
  - **Scope**:
    - Create test fixture with header "Story 1.5: Implement Cache"
    - Write test validating validation succeeds when link uses raw format: `#Story 1.5: Implement Cache`
    - Write test validating validation succeeds when link uses URL-encoded format: `#Story%201.5%20Implement%20Cache`
    - Write test validating both ID formats match same anchor object
    - Use factory-created validator with real dependencies
    - Follow BDD Given-When-Then structure
    - Tests should FAIL showing validator doesn't check both ID fields yet
  - **Test**: All anchor matching integration tests written and failing (expected - RED phase)
  - **Commands**: `npm test -- integration/citation-validator-anchor-matching` (expect failures)
  - _Requirements_: [[#^US1-6AC3|AC3]]
  - _Leverage_: Existing integration test patterns, factory-created validator

### Phase 2: MarkdownParser Refactoring (GREEN Phase - TDD)

- [x] **2.1. Refactor extractAnchors() to Generate Single AnchorObject with Dual ID Properties** ^US1-6T2-1
  - **Implementation Details**: [tasks/02-2-1-refactor-extract-anchors-method-us1.6.md](tasks/02-2-1-refactor-extract-anchors-method-us1.6.md)
  - **Agent**: code-developer
  - **Objective**: Refactor MarkdownParser.extractAnchors() to create single AnchorObject per header with both `id` (raw) and `urlEncodedId` (Obsidian-compatible) properties, making Phase 1 parser tests pass
  - **Input**: MarkdownParser.js current implementation (lines 399-446), failing tests from Phase 1, target schema from lines 109-139
  - **Output**: Refactored extractAnchors() method generating single anchor with dual IDs
  - **Files**:
    - `tools/citation-manager/src/MarkdownParser.js` (modify)
  - **Scope**:
    - Refactor extractAnchors() header processing to create single AnchorObject per header
    - Populate `id` field with raw header text (no URL encoding)
    - Populate `urlEncodedId` field with Obsidian-compatible URL-encoded format (always, even when identical to `id`)
    - Remove logic that creates duplicate anchors for headers with special characters
    - Preserve block anchor logic unchanged (no `urlEncodedId` for block anchors)
    - Maintain all other AnchorObject properties (anchorType, rawText, fullMatch, line, column)
  - **Test**: Task 1.1 parser schema tests pass, no duplicate anchors created
  - **Commands**: `npm test -- parser-output-contract`
  - _Requirements_: [[#^US1-6AC1|AC1]], [[#^US1-6AC2|AC2]], [[#^US1-6AC4|AC4]]
  - _Leverage_: Existing extractAnchors() structure, URL encoding logic from current implementation

### Phase 3: CitationValidator Refactoring (GREEN Phase - TDD)

- [x] **3.1. Update validateAnchorExists() to Check Both ID and urlEncodedId Fields** ^US1-6T3-1
  - **Implementation Details**: [tasks/03-3-1-update-validate-anchor-exists-us1.6.md](tasks/03-3-1-update-validate-anchor-exists-us1.6.md)
  - **Agent**: code-developer
  - **Objective**: Refactor CitationValidator.validateAnchorExists() to check both `id` and `urlEncodedId` when matching anchors, making Phase 1 integration tests pass
  - **Input**: CitationValidator.js current implementation, failing tests from Task 1.2, target logic from lines 146-166
  - **Output**: Refactored validateAnchorExists() method checking both ID fields
  - **Files**:
    - `tools/citation-manager/src/CitationValidator.js` (modify)
  - **Scope**:
    - Update anchor matching logic to check both `anchorObj.id` and `anchorObj.urlEncodedId`
    - Use logical OR: `anchorObj.id === anchor || anchorObj.urlEncodedId === anchor`
    - Update suggestion generation to consider both ID variants when building fuzzy matches
    - Preserve all other validation logic unchanged
    - Ensure backward compatibility: validation still works with existing test fixtures
  - **Test**: Task 1.2 integration tests pass, validation works with both ID formats
  - **Commands**: `npm test -- integration/citation-validator-anchor-matching && npm test -- validation`
  - _Requirements_: [[#^US1-6AC3|AC3]]
  - _Leverage_: Existing validateAnchorExists() structure, anchor matching patterns

### Phase 4: Regression Validation & Documentation

- [ ] **4.1. Execute Full Regression Validation** ^US1-6T4-1
  - **Implementation Details**: [tasks/04-4-1-execute-full-regression-validation-us1.6.md](tasks/04-4-1-execute-full-regression-validation-us1.6.md)
  - **Agent**: qa-validation
  - **Objective**: Execute complete test suite to validate zero regression after AnchorObject schema refactoring
  - **Input**: All implementation from Phases 1-3, existing test suite
  - **Output**: Validation report confirming all tests pass with zero regressions
  - **Files**: (validation only - no file modifications)
  - **Scope**:
    - Execute full test suite: `npm test`
    - Validate all existing tests pass with refactored AnchorObject schema
    - Validate no duplicate anchors created in parser output
    - Validate CitationValidator works with both ID formats
    - Confirm zero test failures, zero regressions
    - Document test execution results with pass/fail counts
  - **Test**: All existing tests + new schema tests pass, confirming zero regression
  - **Commands**: `npm test`
  - _Requirements_: [[#^US1-6AC5|AC5]]
  - _Leverage_: Complete test suite, Vitest framework

- [ ] **4.2. Update MarkdownParser Implementation Guide JSON Schema** ^US1-6T4-2
  - **Implementation Details**: [tasks/04-4-2-update-implementation-guide-schema-us1.6.md](tasks/04-4-2-update-implementation-guide-schema-us1.6.md)
  - **Agent**: application-tech-lead
  - **Objective**: Update MarkdownParser Implementation Guide to reflect new AnchorObject schema with dual ID properties
  - **Input**: Markdown Parser Implementation Guide, refactored AnchorObject schema from Phase 2
  - **Output**: Updated Implementation Guide with accurate AnchorObject JSON schema
  - **Files**:
    - `tools/citation-manager/design-docs/component-guides/Markdown Parser Implementation Guide.md` (modify)
  - **Scope**:
    - Update AnchorObject JSON schema definition in Data Contracts section
    - Add `urlEncodedId` property to header anchor schema
    - Document `urlEncodedId` as always populated for headers, omitted for blocks
    - Update schema examples showing single anchor with both ID properties
    - Update any pseudocode referencing AnchorObject structure
  - **Test**: Implementation Guide accurately reflects new AnchorObject schema
  - **Commands**: `npm run citation:validate <implementation-guide>`
  - _Requirements_: [[#^US1-6AC6|AC6]]
  - _Leverage_: Existing Implementation Guide structure, JSON schema format

- [ ] **4.3. Update Architecture Documentation** ^US1-6T4-3
  - **Implementation Details**: [tasks/04-4-3-update-architecture-documentation-us1.6.md](tasks/04-4-3-update-architecture-documentation-us1.6.md)
  - **Agent**: application-tech-lead
  - **Objective**: Update content-aggregation-architecture.md to mark "Duplicate Anchor Entries" technical debt as resolved
  - **Input**: content-aggregation-architecture.md, completed schema refactoring from Phases 1-3
  - **Output**: Architecture documentation reflecting resolved technical debt
  - **Files**:
    - `tools/citation-manager/design-docs/features/20251003-content-aggregation/content-aggregation-architecture.md` (modify)
  - **Scope**:
    - Update "Known Risks and Technical Debt" section
    - Mark "Duplicate Anchor Entries in MarkdownParser.Output.DataContract" as RESOLVED
    - Add resolution date and reference to US1.6
    - Document resolution summary: single AnchorObject per header with dual ID properties
    - Add resolution verification: parser tests confirm no duplicate anchors
  - **Test**: Architecture documentation accurately reflects resolved technical debt
  - **Commands**: `npm run citation:validate <architecture-doc>`
  - _Requirements_: [[#^US1-6AC5|AC5]]
  - _Leverage_: ADR format, existing technical debt documentation structure

### Acceptance Criteria Coverage

**AC1 Coverage** ([[#^US1-6AC1|AC1]] - Single AnchorObject per header):
- Task 1.1: Test validates single anchor created per header
- Task 2.1: Implementation creates single anchor with dual IDs
- Task 4.1: Regression validation confirms no duplicates

**AC2 Coverage** ([[#^US1-6AC2|AC2]] - Schema includes dual ID properties):
- Task 1.1: Test validates `id` and `urlEncodedId` properties present
- Task 2.1: Implementation populates both ID properties
- Task 4.2: Documentation updated with new schema

**AC3 Coverage** ([[#^US1-6AC3|AC3]] - CitationValidator checks both IDs):
- Task 1.2: Integration tests validate dual ID matching
- Task 3.1: Implementation checks both `id` and `urlEncodedId`
- Task 4.1: Regression confirms backward compatibility

**AC4 Coverage** ([[#^US1-6AC4|AC4]] - Special character example):
- Task 1.1: Test validates "Story 1.5: Implement Cache" generates single anchor
- Task 2.1: Implementation handles special characters correctly
- Task 1.2: Integration test validates both ID formats match

**AC5 Coverage** ([[#^US1-6AC5|AC5]] - Zero regressions):
- Task 4.1: Full regression validation
- Task 4.3: Documentation confirms completion

**AC6 Coverage** ([[#^US1-6AC6|AC6]] - Documentation updated):
- Task 4.2: Implementation Guide schema updated
- Task 4.3: Architecture documentation updated

### Task Sequencing

#### Sequential Dependencies

**Phase 1 → Phase 2**: Tasks [[#^US1-6T1-1|1.1]]-[[#^US1-6T1-2|1.2]] must complete before Task [[#^US1-6T2-1|2.1]]
- Dependency Rationale: TDD approach requires failing tests (RED phase) before implementation (GREEN phase)

**Phase 2 → Phase 3**: Task [[#^US1-6T2-1|2.1]] must complete before Task [[#^US1-6T3-1|3.1]]
- Dependency Rationale: CitationValidator refactoring depends on new AnchorObject schema from parser

**Phase 3 → Phase 4**: Task [[#^US1-6T3-1|3.1]] must complete before Tasks [[#^US1-6T4-1|4.1]]-[[#^US1-6T4-3|4.3]]
- Dependency Rationale: Regression validation and documentation require complete implementation

#### Parallel Execution Groups

**Group 1 - Phase 1 Tests (RED Phase)**:
- Tasks [[#^US1-6T1-1|1.1]] and [[#^US1-6T1-2|1.2]] can execute in parallel
- Independent test files for parser schema and validator integration
- Same agent: test-writer
- Parallel execution saves 20-30 minutes

**Group 2 - Phase 4 Documentation**:
- Tasks [[#^US1-6T4-2|4.2]] and [[#^US1-6T4-3|4.3]] can execute in parallel after Task [[#^US1-6T4-1|4.1]] completes
- Independent documentation files
- Same agent: application-tech-lead
- Parallel execution saves 15-20 minutes

### Execution Sequence

**Wave 1 - RED Phase: Schema Tests** (Estimated: 70-85 min):
- Execute: Tasks [[#^US1-6T1-1|1.1]] and [[#^US1-6T1-2|1.2]]
- Agent: test-writer (both tasks sequentially)
- Validation: application-tech-lead validates both tests written correctly and failing appropriately
- Deliverable: Failing parser schema tests + failing validator integration tests (RED phase complete)
- **Block Condition**: Wave 2 blocked until validation PASS

**Wave 2 - GREEN Phase: Parser + Validator Refactoring** (Estimated: 145-175 min):
- Execute: Tasks [[#^US1-6T2-1|2.1]] and [[#^US1-6T3-1|3.1]]
- Agent: code-developer (both tasks sequentially)
- Validation: application-tech-lead validates both refactorings complete, all Phase 1 tests pass, zero regressions
- Deliverable: Refactored extractAnchors() + refactored validateAnchorExists() (all tests GREEN)
- Prerequisite: Wave 1 validation PASS
- **Block Condition**: Wave 3 blocked until validation PASS

**Wave 3 - Regression Validation** (Estimated: 15-20 min):
- Execute: Task [[#^US1-6T4-1|4.1]]
- Agent: qa-validation
- Deliverable: Regression validation report confirming zero regressions
- Prerequisite: Wave 2 validation PASS
- **Block Condition**: Wave 4 blocked until PASS

**Wave 4 - Documentation Updates** (Estimated: 50-65 min):
- Execute: Tasks [[#^US1-6T4-2|4.2]] and [[#^US1-6T4-3|4.3]] in parallel
- Agent: application-tech-lead (both tasks in parallel)
- Deliverable: Updated Implementation Guide + updated architecture documentation
- Prerequisite: Wave 3 PASS

**Total Estimated Duration**: 4.5-5.5 hours
**Critical Path**: Wave 1 → Wave 2 → Wave 3 → Wave 4
**Validation Checkpoints**: 2 (Wave 1 + Wave 2)
**TDD Compliance**: RED phase (Wave 1) → GREEN phase (Wave 2) → Validation/Docs (Waves 3-4)
**Longest Single Wave**: Wave 2 (145-175 min) - combined parser + validator refactoring

---

## Additional Implementation Risks

> [!note] Additional risks to be identified during implementation

---

## Bugs/Known Issues

> [!note] To be documented during implementation

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|---------|
| 2025-10-09 | 1.0 | Initial story creation with architectural context, populated through Dev Notes section per template structure | Application Tech Lead (Claude Sonnet 4.5) |
| 2025-10-09 | 2.0 | Added complete Tasks/Subtasks section with 4 phases, 7 tasks following TDD approach (RED → GREEN → Documentation), comprehensive task sequencing with parallel execution groups, estimated 4.5-5.5 hour duration, ~35-50 min time savings via parallel execution | Application Tech Lead (Claude Sonnet 4.5) |
| 2025-10-09 | 2.1 | Optimized execution sequence: consolidated from 5 waves to 4 waves with agent grouping (Wave 1: test-writer for both test tasks + validation, Wave 2: code-developer for both refactoring tasks + validation, Waves 3-4: unchanged), added 2 validation checkpoints with block conditions, improved execution efficiency while maintaining TDD discipline | Application Tech Lead (Claude Sonnet 4.5) |

## Related Documentation

- [Content Aggregation PRD](../../content-aggregation-prd.md) - Parent feature PRD with story definition and acceptance criteria
- [Content Aggregation Architecture](../../content-aggregation-architecture.md) - Tool architecture with technical debt documentation
- [Content Aggregation Architecture Whiteboard](../../research/content-aggregation-architecture-whiteboard.md) - Strategy Pattern design decisions and sequencing rationale
- [MarkdownParser Implementation Guide](../../../../component-guides/Markdown%20Parser%20Implementation%20Guide.md) - Component pseudocode and data contracts
- [CitationValidator Implementation Guide](../../../../component-guides/CitationValidator%20Implementation%20Guide.md) - Validation logic and integration patterns
