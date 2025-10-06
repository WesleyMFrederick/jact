---
title: "User Story 1.4b: Refactor citation-manager Components for Dependency Injection"
feature-title: "Citation Manager Content Aggregation"
epic-number: 1
epic-name: "Citation Manager Test Migration & Content Aggregation"
epic-url: "../../content-aggregation-prd.md#Epic%20Citation%20Manager%20Test%20Migration%20&%20Content%20Aggregation"
user-story-number: 1.4b
status: Draft
---

# Story 1.4b: Refactor citation-manager Components for Dependency Injection

<critical-llm-Initialization-Instructions>
When first reading this file, you MUST IMMEDIATELY run citation manager to extract base paths: `npm run citation:base-paths "this-file-path" -- --format json`. Read ALL discovered base path files to gather complete architectural context before proceeding.
</critical-llm-Initialization-Instructions>

## Story

**As a** developer,
**I want** to refactor citation-manager components to use constructor-based dependency injection,
**so that** the tool aligns with workspace architecture principles and enables proper integration testing with real dependencies.

_Source: [Story 1.4b: Refactor citation-manager Components for Dependency Injection](../../content-aggregation-prd.md#Story%201.4b%20Refactor%20citation-manager%20Components%20for%20Dependency%20Injection)_

## Acceptance Criteria

1. The CitationValidator, MarkdownParser, and FileCache components SHALL accept all dependencies via constructor parameters rather than creating them internally. ^US1-4bAC1
2. The citation-manager SHALL provide factory functions at `src/factories/componentFactory.js` that instantiate components with standard production dependencies. ^US1-4bAC2
3. The citation-manager CLI entry point SHALL use factory functions for component instantiation in production execution paths. ^US1-4bAC3
4. GIVEN component tests require explicit dependency control, WHEN tests instantiate components, THEN they SHALL use factory functions with real dependencies (not mocks) to maintain consistency with production code. ^US1-4bAC4
5. The test suite SHALL include component integration tests that validate collaboration between CitationValidator, MarkdownParser, and FileCache using real file system operations per workspace "Real Systems, Fake Fixtures" principle. ^US1-4bAC5
6. WHEN DI refactoring completes and all tests pass, THEN the technical debt "Lack of Dependency Injection" documented in content-aggregation-architecture.md SHALL be marked as resolved. ^US1-4bAC6

_Source: [Story 1.4b Acceptance Criteria](../../content-aggregation-prd.md#Story%201.4b%20Acceptance%20Criteria)_

## Technical Debt Resolution

**Closes Technical Debt**:
- [Lack of Dependency Injection](../../content-aggregation-architecture.md#Lack%20of%20Dependency%20Injection): Replaces direct import with DI
- [Constructor-Based DI Wiring Overhead](../../../../../../../design-docs/Architecture%20-%20Basline.md#Constructor-Based%20DI%20Wiring%20Overhead): Replaces manual dependency wiring at every component instantiation with a factory pattern that must explicitly import and pass all dependencies.

## Dev Notes

### Architectural Context (C4)

This story refactors the citation-manager component architecture to use constructor-based dependency injection, aligning with workspace patterns and enabling proper integration testing with real dependencies.

- **Components Affected**:
  - [CitationValidator](../../content-aggregation-architecture.md#Citation%20Manager.Citation%20Validator) - Core validation component that orchestrates citation checking
  - [MarkdownParser](../../content-aggregation-architecture.md#Citation%20Manager.Markdown%20Parser) - AST generation and link extraction component
  - [FileCache](../../content-aggregation-architecture.md#Citation%20Manager.File%20Cache) - File system caching layer
  - [CLI Orchestrator](../../content-aggregation-architecture.md#Citation%20Manager.CLI%20Orchestrator) - `src/citation-manager.js` command-line interface

- **Implementation Guides**:
  - [Workspace Testing Strategy](../../../../../../../design-docs/features/20250928-cc-workflows-workspace-scaffolding/cc-workflows-workspace-architecture.md#Testing%20Strategy) - Constructor-based DI enables "Real Systems, Fake Fixtures" testing without mocks
  - [ADR-001: Phased Test Migration Strategy](../../content-aggregation-architecture.md#ADR-001%20Phased%20Test%20Migration%20Strategy) - Rationale for scheduling DI refactoring after Epic 2 architecture design

### Current Architecture (Non-DI)

**Component Instantiation** (pre-US1.4b):

```javascript
// CitationValidator creates dependencies internally
class CitationValidator {
  constructor() {
    this.parser = new MarkdownParser();  // Hard-coded dependency
    this.cache = new FileCache();        // Hard-coded dependency
  }
}

// Tests directly instantiate components
const validator = new CitationValidator();  // Cannot control dependencies
```

**Problems**:
- Hard-coded dependencies prevent explicit dependency control in tests
- Violates workspace architecture principle of constructor-based DI
- Cannot test component collaboration with real dependencies

### Target Architecture (Constructor DI)

**Component Refactoring** ([[#^US1-4bAC1|AC1]]):

```javascript
// Components accept dependencies via constructor
class CitationValidator {
  constructor(parser, fileCache) {
    this.parser = parser;   // Injected dependency
    this.fileCache = fileCache;     // Injected dependency
  }
}

class MarkdownParser {
  constructor(fileSystem) {
    this.fs = fileSystem;   // Injected dependency
  }
}

class FileCache {
  constructor(fileSystem) {
    this.fs = fileSystem;   // Injected dependency
  }
}
```

**Factory Pattern** ([[#^US1-4bAC2|AC2]]):

Create `src/factories/componentFactory.js`:

```javascript
import fs from 'fs';
import { MarkdownParser } from '../components/MarkdownParser.js';
import { FileCache } from '../components/FileCache.js';
import { CitationValidator } from '../components/CitationValidator.js';

export function createCitationValidator() {
  const parser = createMarkdownParser();
  const fileCache = createFileCache();
  return new CitationValidator(parser, fileCache);
}

export function createMarkdownParser() {
  return new MarkdownParser(fs);
}

export function createFileCache() {
  return new FileCache(fs);
}
```

**Production Usage: CLI Integration** ([[#^US1-4bAC3|AC3]]):

```javascript
// src/citation-manager.js
import { createCitationValidator } from './factories/componentFactory.js';

// Production code uses factory for standard dependency wiring
const validator = createCitationValidator(scopeDirectory);
const results = validator.validateFile(filePath);
```

**Test Usage: Factory Pattern** ([[#^US1-4bAC4|AC4]]):

Tests use the same factory pattern as production code. Since we use real dependencies (not mocks), there's no need to bypass the factory:

```javascript
// test/integration/citation-validator.test.js
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { createCitationValidator } from '../src/factories/componentFactory.js';

describe('CitationValidator Integration Tests', () => {
  it('should validate citations using factory-created dependencies', () => {
    // Given: Factory creates validator with standard production dependencies
    const validator = createCitationValidator(join(__dirname, 'fixtures'));
    const testFile = join(__dirname, 'fixtures', 'valid-citations.md');

    // When: Validator processes file using factory-created components
    const result = validator.validateFile(testFile);

    // Then: Integration of real components produces expected result
    expect(result.isValid).toBe(true);
    expect(result.citations).toHaveLength(5);
    expect(result.errors).toHaveLength(0);
  });
});
```

### Dependencies

- **Prerequisite**: [Story 1.4a](../us1.4a-migrate-test-suite-to-vitest/us1.4a-migrate-test-suite-to-vitest.md) complete - Working Vitest test suite provides baseline for refactoring validation
- **Informed By**: Epic 2 architecture design - DI patterns for ContentExtractor inform component refactoring approach
- **Enables**: [Story 2.1](../../content-aggregation-prd.md#Story%202.1%20Enhance%20Parser%20to%20Handle%20Full-File%20and%20Section%20Links) - New Epic 2 components will use established DI patterns

### Design Principles Adherence

This story must adhere to the following [Design Principles](../../../../../../../design-docs/Architecture%20Principles.md):

**Critical Principles:**
- [**Explicit Dependencies**](../../../../../../../design-docs/Architecture%20Principles.md) (Testing): Constructor-based DI makes all dependencies explicit and testable
- [**Real Systems, Fake Fixtures**](../../../../../../../design-docs/Architecture%20Principles.md) (Testing): DI enables integration tests with real file system operations
- [**Factory Pattern**](../../../../../../../design-docs/Architecture%20Principles.md) (Architecture): Centralized factory functions encapsulate production dependency wiring

**Anti-Patterns to Avoid:**
- [**Hard-Coded Dependencies**](../../../../../../../design-docs/Architecture%20Principles.md): Components must not create dependencies internally
- [**Excessive Mocking**](../../../../../../../design-docs/Architecture%20Principles.md): Use real dependencies in tests, not mocks

### Testing

- **Test Framework**: [Vitest](../../content-aggregation-architecture.md#Testing%20Strategy) (shared workspace framework)
- **Test Strategy**: Update existing tests to use constructor DI, add new component integration tests with real dependencies
- **Test Location**: `tools/citation-manager/test/` (established in US1.4a)

#### Test Updates Required

**Existing Component Unit Tests** ([[#^US1-4bAC4|AC4]]):
- Update `path-conversion.test.js` component tests to use factory pattern
- Replace `new CitationValidator()` with `createCitationValidator(scopeDir)`
- Factory provides real `fs` module and production dependencies

**New Component Integration Tests** ([[#^US1-4bAC5|AC5]]):

```javascript
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { createCitationValidator } from '../src/factories/componentFactory.js';

describe('Component Integration', () => {
  describe('CitationValidator with MarkdownParser and FileCache', () => {
    it('should validate citations using real file operations', () => {
      // Given: Factory creates validator with real production dependencies
      const fixturesDir = join(__dirname, 'fixtures');
      const validator = createCitationValidator(fixturesDir);
      const testFile = join(fixturesDir, 'valid-citations.md');

      // When: Validating a test fixture with real file system
      const result = validator.validateFile(testFile);

      // Then: Validation succeeds with real file reading
      expect(result.isValid).toBe(true);
      expect(result.citations).toHaveLength(5);
      expect(result.errors).toHaveLength(0);
    });
  });
});
```

**CLI Integration Tests** (existing):
- No changes required - CLI integration tests execute via `execSync()` and validate end-to-end behavior
- Factory pattern changes are transparent to CLI tests

**Regression Validation**:
All 50+ existing tests must continue to pass after DI refactoring to confirm zero regression.

## Tasks/Subtasks

### Phase 1: Component Constructor Refactoring

- [ ] **1.1. Refactor Components for Constructor DI** ^US1-4bT1-1
  - **Agent**: code-developer-agent (single session)
  - **Objective**: Refactor CitationValidator, MarkdownParser, and FileCache to accept all dependencies via constructor parameters instead of creating them internally
  - **Input**: Three components with hard-coded dependencies (direct imports, internal instantiation)
  - **Output**: Three DI-refactored component files with consistent constructor injection pattern
  - **Files**:
    - `tools/citation-manager/src/CitationValidator.js` (modify)
    - `tools/citation-manager/src/MarkdownParser.js` (modify)
    - `tools/citation-manager/src/FileCache.js` (modify)
  - **Scope**:
    - **CitationValidator**: Update constructor to `constructor(parser, fileCache)`, remove internal `new MarkdownParser()` and `new FileCache()`, store as `this.parser` and `this.fileCache`
    - **MarkdownParser**: Update constructor to `constructor(fileSystem)`, remove direct `import fs`, store as `this.fs`, update all `fs.*` calls to `this.fs.*`
    - **FileCache**: Update constructor to `constructor(fileSystem)`, remove direct `import fs`, store as `this.fs`, update all `fs.*` calls to `this.fs.*`
    - Preserve all existing validation/parsing/caching logic unchanged across all components
    - Apply consistent DI pattern across all three files
  - **Test**: All components instantiate with injected dependencies, existing validation/parsing/caching methods work correctly with injected dependencies
  - **Commands**:
    - `npm test -- CitationValidator`
    - `npm test -- MarkdownParser`
    - `npm test -- FileCache`
  - _Requirements_: [[#^US1-4bAC1|AC1]]
  - _Leverage_: Existing component logic, constructor DI pattern from workspace architecture
  - _Implementation Details_: [tasks/us1.4b-t1.1-component-di-refactoring.md]

### Phase 2: Factory Pattern Implementation

- [ ] **2.1. Implement Component Factory** ^US1-4bT2-1
  - **Agent**: code-developer-agent
  - **Objective**: Create component factory module with factory functions for all DI-refactored components
  - **Input**: DI-refactored CitationValidator, MarkdownParser, and FileCache from Phase 1
  - **Output**: componentFactory.js exporting factory functions that instantiate components with standard production dependencies
  - **Files**:
    - `tools/citation-manager/src/factories/componentFactory.js` (create)
  - **Scope**:
    - Create `src/factories/` directory
    - Implement `createCitationValidator()` factory function
    - Implement `createMarkdownParser()` factory function returning `new MarkdownParser(fs)`
    - Implement `createFileCache()` factory function returning `new FileCache(fs)`
    - Wire createCitationValidator to use createMarkdownParser and createFileCache
    - Import Node.js `fs` module for production filesystem dependency
    - Export all factory functions
  - **Test**: Factory functions create fully-wired component instances with real fs dependency, components function identically to direct instantiation
  - **Commands**: `npm test -- factory`
  - _Requirements_: [[#^US1-4bAC2|AC2]]
  - _Leverage_: Factory pattern from workspace architecture, DI-refactored components from Phase 1
  - _Implementation Details_: [Will be populated in Phase 4]

### Phase 3: CLI Integration

- [ ] **3.1. Update CLI to Use Factory Pattern** ^US1-4bT3-1
  - **Agent**: code-developer-agent
  - **Objective**: Replace direct component instantiation in CLI with factory function calls
  - **Input**: citation-manager.js with direct component instantiation, componentFactory from Phase 2
  - **Output**: CLI using factory functions for all component instantiation, maintaining identical functionality
  - **Files**:
    - `tools/citation-manager/src/citation-manager.js` (modify)
  - **Scope**:
    - Import factory functions from `./factories/componentFactory.js`
    - Replace `new CitationValidator()` with `createCitationValidator()`
    - Replace `new MarkdownParser()` with `createMarkdownParser()` (if directly used)
    - Replace `new FileCache()` with `createFileCache()` (if directly used)
    - Remove direct component class imports if no longer needed
    - Preserve all CLI command logic, output formatting, and error handling
  - **Test**: CLI executes successfully with factory-created components, all commands (validate, ast, base-paths, fix) work identically to before refactoring
  - **Commands**: `npm run citation:validate <test-file>`, `npm run citation:ast <test-file>`
  - _Requirements_: [[#^US1-4bAC3|AC3]]
  - _Leverage_: componentFactory from Phase 2, existing CLI command logic
  - _Implementation Details_: [Will be populated in Phase 4]

### Phase 4: Test Updates

- [ ] **4.1. Update Path Conversion Tests** ^US1-4bT4-1
  - **Agent**: test-writer
  - **Objective**: Update path-conversion.test.js to use factory pattern for component instantiation
  - **Input**: path-conversion.test.js with direct component instantiation, componentFactory from Phase 2
  - **Output**: Tests using factory functions with real dependencies, all tests passing
  - **Files**:
    - `tools/citation-manager/test/path-conversion.test.js` (modify)
  - **Scope**:
    - Import factory functions from `../src/factories/componentFactory.js`
    - Replace `new CitationValidator()` with `createCitationValidator()`
    - Replace `new MarkdownParser()` with `createMarkdownParser()`
    - Replace `new FileCache()` with `createFileCache()`
    - Remove direct component class imports
    - Ensure all tests pass with factory-created components using real fs
  - **Test**: All path conversion tests pass using factory-created components with real file system operations
  - **Commands**: `npm test -- path-conversion`
  - _Requirements_: [[#^US1-4bAC4|AC4]]
  - _Leverage_: componentFactory from Phase 2, existing test fixtures and assertions
  - _Implementation Details_: [Will be populated in Phase 4]

- [ ] **4.2. Update Validation Tests** ^US1-4bT4-2
  - **Agent**: test-writer
  - **Objective**: Update validation.test.js and auto-fix.test.js to use factory pattern for component instantiation
  - **Input**: validation.test.js and auto-fix.test.js with direct component instantiation, componentFactory from Phase 2
  - **Output**: Tests using factory functions with real dependencies, all tests passing
  - **Files**:
    - `tools/citation-manager/test/validation.test.js` (modify)
    - `tools/citation-manager/test/auto-fix.test.js` (modify)
  - **Scope**:
    - Import factory functions in both test files
    - Replace direct component instantiation with factory calls
    - Remove direct component class imports
    - Ensure all tests pass with factory-created components using real fs
  - **Test**: All validation and auto-fix tests pass using factory-created components with real file system operations
  - **Commands**: `npm test -- validation && npm test -- auto-fix`
  - _Requirements_: [[#^US1-4bAC4|AC4]]
  - _Leverage_: componentFactory from Phase 2, existing test fixtures and assertions
  - _Implementation Details_: [Will be populated in Phase 4]

- [ ] **4.3. Update Enhanced Citation Tests** ^US1-4bT4-3
  - **Agent**: test-writer
  - **Objective**: Update enhanced-citations.test.js, story-validation.test.js, and cli-warning-output.test.js to use factory pattern
  - **Input**: Three test files with direct component instantiation, componentFactory from Phase 2
  - **Output**: Tests using factory functions with real dependencies, all tests passing
  - **Files**:
    - `tools/citation-manager/test/enhanced-citations.test.js` (modify)
    - `tools/citation-manager/test/story-validation.test.js` (modify)
    - `tools/citation-manager/test/cli-warning-output.test.js` (modify)
  - **Scope**:
    - Import factory functions in all three test files
    - Replace direct component instantiation with factory calls
    - Remove direct component class imports
    - Ensure all tests pass with factory-created components using real fs
  - **Test**: All enhanced citation, story validation, and CLI warning tests pass using factory-created components
  - **Commands**: `npm test -- enhanced-citations && npm test -- story-validation && npm test -- cli-warning`
  - _Requirements_: [[#^US1-4bAC4|AC4]]
  - _Leverage_: componentFactory from Phase 2, existing test fixtures and assertions
  - _Implementation Details_: [Will be populated in Phase 4]

- [ ] **4.4. Update Warning Validation Tests** ^US1-4bT4-4
  - **Agent**: test-writer
  - **Objective**: Update warning-validation.test.js to use factory pattern for component instantiation
  - **Input**: warning-validation.test.js with direct component instantiation, componentFactory from Phase 2
  - **Output**: Tests using factory functions with real dependencies, all tests passing
  - **Files**:
    - `tools/citation-manager/test/warning-validation.test.js` (modify)
  - **Scope**:
    - Import factory functions from `../src/factories/componentFactory.js`
    - Replace direct component instantiation with factory calls
    - Remove direct component class imports
    - Ensure all tests pass with factory-created components using real fs
  - **Test**: All warning validation tests pass using factory-created components with real file system operations
  - **Commands**: `npm test -- warning-validation`
  - _Requirements_: [[#^US1-4bAC4|AC4]]
  - _Leverage_: componentFactory from Phase 2, existing test fixtures and assertions
  - _Implementation Details_: [Will be populated in Phase 4]

- [ ] **4.5. Create Component Integration Tests** ^US1-4bT4-5
  - **Agent**: test-writer
  - **Objective**: Create integration tests validating CitationValidator, MarkdownParser, and FileCache collaboration using real file system operations
  - **Input**: componentFactory from Phase 2, existing test fixtures
  - **Output**: Integration test suite validating component collaboration with real dependencies
  - **Files**:
    - `tools/citation-manager/test/integration/citation-validator.test.js` (create)
  - **Scope**:
    - Create `test/integration/` directory
    - Import factory functions from `../../src/factories/componentFactory.js`
    - Create test suite "Component Integration"
    - Implement test "CitationValidator with MarkdownParser and FileCache validates citations using real file operations"
    - Use factory-created validator with real test fixtures
    - Validate parser extracts citations correctly, cache resolves files, validator produces expected results
    - Follow BDD Given-When-Then comment structure
    - Use real file system operations per workspace testing strategy
  - **Test**: Integration tests validate CitationValidator orchestrates MarkdownParser and FileCache collaboration correctly using real file system
  - **Commands**: `npm test -- integration/citation-validator`
  - _Requirements_: [[#^US1-4bAC5|AC5]]
  - _Leverage_: componentFactory from Phase 2, existing test fixtures from tools/citation-manager/test/fixtures/
  - _Implementation Details_: [Will be populated in Phase 4]

### Phase 5: Documentation & Validation

- [ ] **5.1. Update Architecture Documentation** ^US1-4bT5-1
  - **Agent**: code-developer-agent
  - **Objective**: Update content-aggregation-architecture.md to mark "Lack of Dependency Injection" technical debt as resolved
  - **Input**: content-aggregation-architecture.md with documented technical debt, completed DI refactoring from Phases 1-4
  - **Output**: Architecture documentation reflecting resolved technical debt and updated migration status
  - **Files**:
    - `tools/citation-manager/design-docs/features/20251003-content-aggregation/content-aggregation-architecture.md` (modify)
  - **Scope**:
    - Update "Known Risks and Technical Debt" section to mark "Lack of Dependency Injection" as RESOLVED
    - Add resolution date and reference to US1.4b
    - Update "Migration Status" table to mark "DI Architecture" and "Factory Pattern" as complete
    - Update "Document Status" section with completion date
    - Document factory pattern location (`src/factories/componentFactory.js`)
  - **Test**: Architecture documentation accurately reflects completed DI refactoring, technical debt closure, and factory pattern implementation
  - **Commands**: `npm run citation:validate tools/citation-manager/design-docs/features/20251003-content-aggregation/content-aggregation-architecture.md`
  - _Requirements_: [[#^US1-4bAC6|AC6]]
  - _Leverage_: ADR-001 phased migration strategy, US1.4b completion evidence from Phases 1-4
  - _Implementation Details_: [Will be populated in Phase 4]

- [ ] **5.2. Execute Full Regression Validation** ^US1-4bT5-2
  - **Agent**: qa-validation
  - **Objective**: Execute complete test suite to validate zero regression after DI refactoring
  - **Input**: All refactored components and tests from Phases 1-4
  - **Output**: Validation report confirming all 50+ tests pass with zero regressions
  - **Files**: (validation only - no file modifications)
  - **Scope**:
    - Execute full test suite: `npm test`
    - Validate all 50+ existing tests pass
    - Validate new integration tests pass
    - Confirm zero test failures, zero regressions
    - Document test execution results
  - **Test**: All 50+ tests pass including new integration tests, confirming zero regression from DI refactoring
  - **Commands**: `npm test`
  - _Requirements_: [[#^US1-4bAC6|AC6]]
  - _Leverage_: Complete test suite from Phase 4, validation criteria from acceptance criteria
  - _Implementation Details_: [Will be populated in Phase 4]

### Acceptance Criteria Coverage

**AC1 Coverage** ([[#^US1-4bAC1|AC1]] - Components accept dependencies via constructor):
- Task 1.1: Component DI refactoring (CitationValidator, MarkdownParser, FileCache)

**AC2 Coverage** ([[#^US1-4bAC2|AC2]] - Factory functions at src/factories/componentFactory.js):
- Task 2.1: Implement component factory

**AC3 Coverage** ([[#^US1-4bAC3|AC3]] - CLI uses factory functions):
- Task 3.1: Update CLI to use factory pattern

**AC4 Coverage** ([[#^US1-4bAC4|AC4]] - Tests use factory functions with real dependencies):
- Task 4.1: Update path conversion tests
- Task 4.2: Update validation tests
- Task 4.3: Update enhanced citation tests
- Task 4.4: Update warning validation tests

**AC5 Coverage** ([[#^US1-4bAC5|AC5]] - Integration tests with real file system):
- Task 4.5: Create component integration tests

**AC6 Coverage** ([[#^US1-4bAC6|AC6]] - Technical debt marked as resolved):
- Task 5.1: Update architecture documentation
- Task 5.2: Execute full regression validation

**Error Scenarios**: Tasks 4.1-4.5 maintain existing error handling test coverage
**Happy Path**: Tasks 3.1 and 4.5 validate successful execution with factory-created components
**Integration Points**: Task 4.5 validates CitationValidator ↔ MarkdownParser ↔ FileCache collaboration

## Task Sequencing

### Sequential Dependencies

**Phase 1 → Phase 2**: Task [[#^US1-4bT1-1|1.1]] must complete before Task [[#^US1-4bT2-1|2.1]]
- Dependency Rationale: Factory implementation requires DI-refactored components

**Phase 2 → Phase 3**: Task [[#^US1-4bT2-1|2.1]] must complete before Task [[#^US1-4bT3-1|3.1]]
- Dependency Rationale: CLI integration requires factory functions to exist

**Phase 2 → Phase 4**: Task [[#^US1-4bT2-1|2.1]] must complete before Tasks [[#^US1-4bT4-1|4.1]]-[[#^US1-4bT4-5|4.5]]
- Dependency Rationale: Test updates require factory functions for component instantiation

**Phases 1-4 → Phase 5**: All tasks [[#^US1-4bT1-1|1.1]]-[[#^US1-4bT4-5|4.5]] must complete before Tasks [[#^US1-4bT5-1|5.1]]-[[#^US1-4bT5-2|5.2]]
- Dependency Rationale: Documentation and validation require completed refactoring evidence

### Parallel Execution Groups

**Group 1 - Test Updates (Phase 4)**:
- Tasks [[#^US1-4bT4-1|4.1]], [[#^US1-4bT4-2|4.2]], [[#^US1-4bT4-3|4.3]], [[#^US1-4bT4-4|4.4]], [[#^US1-4bT4-5|4.5]] can execute in parallel
- Independent test files across 7 existing tests + 1 new integration test
- Same agent: test-writer

### Agent Handoff Points

**Handoff 1: code-developer-agent → test-writer** (After Phase 3)
- Outgoing Agent: code-developer-agent
- Incoming Agent: test-writer
- Deliverable: Factory functions operational, CLI integrated with factories
- Validation Gate:
  - Factory successfully creates component instances with real fs dependency
  - CLI executes all commands (validate, ast, base-paths, fix) successfully
  - Manual smoke test: `npm run citation:validate <test-file>` passes

**Handoff 2: test-writer → code-developer-agent** (After Phase 4)
- Outgoing Agent: test-writer
- Incoming Agent: code-developer-agent
- Deliverable: All tests passing with factory pattern implementation
- Validation Gate:
  - All 50+ existing tests pass using factory-created components
  - New integration test passes validating component collaboration
  - Test execution: `npm test` shows zero failures

**Handoff 3: code-developer-agent → qa-validation** (After Task 5.1)
- Outgoing Agent: code-developer-agent
- Incoming Agent: qa-validation
- Deliverable: Updated architecture documentation with resolved technical debt
- Validation Gate:
  - Architecture doc marks "Lack of Dependency Injection" as RESOLVED
  - Migration status table shows DI Architecture and Factory Pattern complete
  - Documentation validates: `npm run citation:validate <architecture-doc>` passes

### Scope Validation Checkpoints

Each code-developer-agent and test-writer task completion triggers an application-tech-lead validation checkpoint to ensure implementation adheres strictly to task specification.

**Validation Approach**:
- Validation agent receives the **exact same task specification** given to implementation agent
- Compares implementation against task specification fields: Objective, Files, Scope, Output, Test criteria
- Answers: "Did implementation follow task specification exactly? Any deviations?"

**Validation Agent**: application-tech-lead

**Validation Output**: PASS or FAIL
- **PASS**: Implementation matches task specification exactly, next wave proceeds
- **FAIL**: Specific deviations identified, blocks next wave until remediation complete

### Execution Sequence

**Wave 1a - Execute Component DI** (Estimated: 30-40 min):
- Execute: Task [[#^US1-4bT1-1|1.1]] (unified implementation)
- Agent: code-developer-agent (single session)
- Deliverable: 3 DI-refactored component files with consistent pattern

**Wave 1b - Validate Component DI** (Estimated: 10-15 min):
- Validate: Task [[#^US1-4bT1-1|1.1]]
- Agent: application-tech-lead
- Input: Task 1.1 specification
- Validation: All three files modified per spec, consistent DI pattern applied, scope not exceeded, AC1 requirements met
- **Block Condition**: Wave 2 blocked until validation PASS

**Wave 2a - Execute Factory Implementation** (Estimated: 30-45 min):
- Execute: Task [[#^US1-4bT2-1|2.1]]
- Agent: code-developer-agent
- Prerequisite: Wave 1b PASS
- Deliverable: componentFactory.js with all factory functions

**Wave 2b - Validate Factory Implementation** (Estimated: 5-10 min):
- Validate: Task [[#^US1-4bT2-1|2.1]]
- Agent: application-tech-lead
- Input: Same task specification from Wave 2a (task 2.1)
- Validation: Only componentFactory.js created, factory scope not exceeded, AC2 met
- **Block Condition**: Wave 3 blocked until validation PASS

**Wave 3a - Execute CLI Integration** (Estimated: 20-30 min):
- Execute: Task [[#^US1-4bT3-1|3.1]]
- Agent: code-developer-agent
- Prerequisite: Wave 2b PASS
- Deliverable: CLI using factory pattern for component instantiation

**Wave 3b - Validate CLI Integration** (Estimated: 5-10 min):
- Validate: Task [[#^US1-4bT3-1|3.1]]
- Agent: application-tech-lead
- Input: Same task specification from Wave 3a (task 3.1)
- Validation: Only citation-manager.js modified, CLI scope not exceeded, AC3 met
- **Block Condition**: Wave 4 blocked until validation PASS

**Wave 4a - Execute Test Updates** (Estimated: 60-90 min):
- Execute: Tasks [[#^US1-4bT4-1|4.1]], [[#^US1-4bT4-2|4.2]], [[#^US1-4bT4-3|4.3]], [[#^US1-4bT4-4|4.4]], [[#^US1-4bT4-5|4.5]] in parallel
- Agent: test-writer
- Prerequisite: Wave 2b PASS (needs factory)
- Deliverable: 7 updated test files + 1 new integration test, all passing

**Wave 4b - Validate Test Updates** (Estimated: 20-25 min):
- Validate: Tasks [[#^US1-4bT4-1|4.1]], [[#^US1-4bT4-2|4.2]], [[#^US1-4bT4-3|4.3]], [[#^US1-4bT4-4|4.4]], [[#^US1-4bT4-5|4.5]] in parallel
- Agent: application-tech-lead
- Input: Same task specifications from Wave 4a (tasks 4.1-4.5)
- Validation: Only specified test files modified, test scope not exceeded, AC4/AC5 met
- **Block Condition**: Wave 5 blocked until all validations PASS

**Wave 5a - Execute Documentation Update** (Estimated: 15-20 min):
- Execute: Task [[#^US1-4bT5-1|5.1]]
- Agent: code-developer-agent
- Prerequisite: Wave 4b PASS
- Deliverable: Architecture documentation with resolved technical debt

**Wave 5b - Validate Documentation Update** (Estimated: 5-10 min):
- Validate: Task [[#^US1-4bT5-1|5.1]]
- Agent: application-tech-lead
- Input: Same task specification from Wave 5a (task 5.1)
- Validation: Only architecture doc modified, documentation scope not exceeded, AC6 met
- **Block Condition**: Wave 6 blocked until validation PASS

**Wave 6 - Regression Validation** (Estimated: 10-15 min):
- Execute: Task [[#^US1-4bT5-2|5.2]]
- Agent: qa-validation
- Prerequisite: Wave 5b PASS
- Deliverable: Validation report confirming zero regression
- Note: No validation checkpoint needed (qa-validation is already a validation agent)

**Total Estimated Duration**: 3.5-4.5 hours (with parallelization + validation)
**Critical Path**: Wave 1a → 1b → 2a → 2b → 3a → 3b → 4a → 4b → 5a → 5b → 6
**Time Savings**: 35-40 minutes vs original plan (unified Phase 1 implementation)

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|---------|
| 2025-10-04 | 1.0 | Initial story creation from US1.4 split per ADR-001 | Application Tech Lead (Claude Sonnet 4.5) |

## Related Documentation

- [Content Aggregation PRD](../../content-aggregation-prd.md) - Parent feature PRD with story definition
- [Content Aggregation Architecture](../../content-aggregation-architecture.md) - Tool architecture with ADR-001 and technical debt documentation
- [Workspace Architecture](../../../../../../../design-docs/features/20250928-cc-workflows-workspace-scaffolding/cc-workflows-workspace-architecture.md) - Workspace DI patterns and testing strategy
- [US1.4a: Migrate Test Suite to Vitest](../us1.4a-migrate-test-suite-to-vitest/us1.4a-migrate-test-suite-to-vitest.md) - Prerequisite test migration story
