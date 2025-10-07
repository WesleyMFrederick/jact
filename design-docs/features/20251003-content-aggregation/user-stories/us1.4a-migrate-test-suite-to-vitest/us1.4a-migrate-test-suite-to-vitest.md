---
title: "User Story 1.4a: Migrate citation-manager Test Suite to Vitest"
feature-title: Citation Manager Content Aggregation
epic-number: 1
epic-name: Citation Manager Test Migration & Content Aggregation
epic-url: ../../content-aggregation-prd.md#Epic%20Citation%20Manager%20Test%20Migration%20&%20Content%20Aggregation
user-story-number: 1.4a
status: Done
---

# Story 1.4a: Migrate citation-manager Test Suite to Vitest
<critical-llm-Initialization-Instructions>
When first reading this file, you MUST IMMEDIATELY run citation manager to extract base paths: `npm run citation:base-paths "this-file-path" -- --format json`. Read ALL discovered base path files to gather complete architectural context before proceeding.
</critical-llm-Initialization-Instructions>

## Story

**As a** developer,
**I want** to migrate the existing `citation-manager` test suite from Node.js test runner to Vitest,
**so that** tests run via the workspace's shared testing framework and validate zero migration regressions.

_Source: [Story 1.4a: Migrate citation-manager Test Suite to Vitest](../../content-aggregation-prd.md#Story%201.4a%20Migrate%20citation-manager%20Test%20Suite%20to%20Vitest)_

## Acceptance Criteria

1. WHEN the citation-manager test files and fixtures are relocated, THEN they SHALL reside at `tools/citation-manager/test/` within the workspace structure. ^US1-4aAC1
2. The migrated test suite SHALL use Vitest framework with `describe()`, `it()`, and `expect()` syntax, replacing all `node:test` and `node:assert` usage. ^US1-4aAC2
3. WHEN `npm test` is executed from workspace root, THEN Vitest SHALL discover and execute all citation-manager tests via the shared test configuration. ^US1-4aAC3
4. All test files SHALL reference the migrated citation-manager CLI at `tools/citation-manager/src/citation-manager.js` using workspace-relative paths. ^US1-4aAC4
5. GIVEN all test framework conversions are complete, WHEN the migrated test suite executes, THEN all 50+ existing tests SHALL pass without regression. ^US1-4aAC5
6. WHEN test migration validation confirms success (AC5 satisfied), THEN the legacy test location `src/tools/utility-scripts/citation-links/test/` SHALL be removed. ^US1-4aAC6

_Source: [Story 1.4a Acceptance Criteria](../../content-aggregation-prd.md#Story%201.4a%20Acceptance%20Criteria)_

## Technical Debt Note

**Accepted Technical Debt**: Component tests will temporarily use non-DI instantiation (`new CitationValidator()`) until US1.4b implements constructor-based dependency injection. This deviation from workspace architecture principles is documented in [ADR-001: Phased Test Migration Strategy](../../content-aggregation-architecture.md#ADR-001%20Phased%20Test%20Migration%20Strategy).

## Dev Notes

### Architectural Context (C4)

This story migrates the citation-manager test suite from Node.js built-in test runner to the workspace's shared Vitest framework, validating that the Epic 1 migration has not introduced regressions.

- **Components Affected**:
  - [Citation Manager Test Suite](../../content-aggregation-architecture.md#Testing%20Strategy) - 7 test files (1,863 lines) with 50+ test cases covering validation, AST generation, auto-fix, path conversion, and CLI output
  - [Workspace Testing Infrastructure](../../../../../../../design-docs/features/20250928-cc-workflows-workspace-scaffolding/cc-workflows-workspace-architecture.md#Testing%20Strategy) - Shared Vitest framework with test discovery pattern `tools/**/test/**/*.test.js`

- **Implementation Guides**:
  - [Testing Strategy](../../content-aggregation-architecture.md#Testing%20Strategy) - MVP-focused testing with 0.3-0.5:1 test-to-code ratio, integration-driven approach with real file system operations
  - [Workspace Testing Strategy](../../../../../../../design-docs/features/20250928-cc-workflows-workspace-scaffolding/cc-workflows-workspace-architecture.md#Testing%20Strategy) - BDD structure, Given-When-Then comments, "Real Systems, Fake Fixtures" philosophy

### Current Test Framework (Pre-US1.4a)

**Node.js Built-in Test Runner**:

```javascript
// Current syntax (node:test)
import { describe, test } from "node:test";
import { strict as assert } from "node:assert";

test("should validate citations successfully", async () => {
  assert(output.includes("✅ ALL CITATIONS VALID"), "Should report valid");
  assert.strictEqual(result, expected);
});
```

**Characteristics**:
- Syntax: `test()` function with `node:assert` assertions
- Execution: `node --test` command
- Test patterns: CLI integration tests via `execSync()`, unit tests for components
- Location: `src/tools/utility-scripts/citation-links/test/` (legacy location)

**Test Files to Migrate** (from `src/tools/utility-scripts/citation-links/test/`):
 1. `validation.test.js` - Core validation integration tests (CLI execution)
 2. `warning-validation.test.js` - Warning system validation
 3. `enhanced-citations.test.js` - Enhanced citation format tests
 4. `cli-warning-output.test.js` - CLI output format validation
 5. `path-conversion.test.js` - Path resolution and conversion tests (includes component unit tests)
 6. `auto-fix.test.js` - Auto-fix feature integration tests
 7. `story-validation.test.js` - Story-specific validation tests

- **Fixture Files**: 18 markdown test fixtures in `test/fixtures/` directory (17 in fixtures/, 1 in fixtures/subdir/)

### Target Test Framework (Post-US1.4a)

**Vitest Framework** ([[#^US1-4aAC2|AC2]]):

```javascript
// Target syntax (Vitest)
import { describe, it, expect } from "vitest";

it("should validate citations successfully", async () => {
  expect(output).toContain("✅ ALL CITATIONS VALID");
  expect(result).toBe(expected);
});
```

**Characteristics**:
- Syntax: `it()` function with Vitest `expect()` API
- Discovery: Automatic via workspace `vitest.config.js` glob pattern `tools/**/test/**/*.test.js`
- Execution: `npm test` from workspace root
- Location: `tools/citation-manager/test/` (new workspace-aligned location)

**Key Migration Patterns**:

**Assert → Expect Syntax Conversion**:

```javascript
// BEFORE (node:assert)
assert(output.includes("✅ ALL CITATIONS VALID"), "Should report valid");
assert.strictEqual(result, expected);

// AFTER (Vitest expect)
expect(output).toContain("✅ ALL CITATIONS VALID");
expect(result).toBe(expected);
```

**Test Function Naming Conversion**:

```javascript
// BEFORE (node:test uses 'test')
import { describe, test } from "node:test";
test("should validate citations successfully", async () => { ... });

// AFTER (Vitest uses 'it')
import { describe, it, expect } from "vitest";
it("should validate citations successfully", async () => { ... });
```

**Path Resolution Updates** ([[#^US1-4aAC4|AC4]]):

```javascript
// BEFORE (relative to legacy location src/tools/utility-scripts/citation-links/test/)
const citationManagerPath = join(__dirname, "..", "citation-manager.js");

// AFTER (workspace-relative from tools/citation-manager/test/)
const citationManagerPath = join(__dirname, "..", "src", "citation-manager.js");
```

### Dependencies

- **Prerequisite**: [Story 1.3](../../../../../../../design-docs/features/20250928-cc-workflows-workspace-scaffolding/user-stories/us1.3-make-migrated-citation-manager-executable/us1.3-make-migrated-citation-manager-executable.md) complete - CLI must be executable from workspace root
- **Enables**: [Story 1.4b](../us1.4b-refactor-components-for-di/us1.4b-refactor-components-for-di.md) - DI refactoring with working test baseline
- Vitest framework (already configured in workspace root `vitest.config.js`)

### Design Principles Adherence

This story must adhere to the following [Design Principles](../../../../../../../design-docs/Architecture%20Principles.md):

**Critical Principles:**
- [**Foundation Reuse**](../../../../../../../design-docs/Architecture%20Principles.md#^foundation-reuse) (MVP): Leverage workspace Vitest configuration already validated in US1.1, proven test discovery pattern
- [**Real Systems, Fake Fixtures**](../../../../../../../design-docs/Architecture%20Principles.md) (Testing): Maintain existing test approach using real file operations with test fixture markdown files, no mocking
- [**Simplicity First**](../../../../../../../design-docs/Architecture%20Principles.md#^simplicity-first) (MVP): Direct test framework conversion without introducing new test patterns or abstractions

**Anti-Patterns to Avoid:**
- [**Scattered Checks**](../../../../../../../design-docs/Architecture%20Principles.md#^scattered-checks): Keep all tests in single `tools/citation-manager/test/` directory following workspace pattern
- [**Mocking Real Systems**](../../../../../../../design-docs/Architecture%20Principles.md): Preserve existing integration test approach using `execSync()` and real file operations

### Testing

- **Test Framework**: [Vitest](../../content-aggregation-architecture.md#Testing%20Strategy) (shared workspace framework)
- **Test Strategy**: Migrate existing tests without changing testing approach - preserve CLI integration tests and component unit tests exactly as-is except for framework syntax
- **Test Location**: `tools/citation-manager/test/` (target after migration)

#### Migration Validation

All 50+ existing tests must pass after migration to confirm zero regression:

1. **CLI Integration Tests** (majority) - Execute citation-manager via `execSync()` and validate output
2. **Component Unit Tests** (path-conversion.test.js) - Direct component instantiation: `new CitationValidator()`
3. **Fixture-Based Tests** - Real markdown files in `test/fixtures/` directory

**No New Tests Required**: This story focuses on framework conversion, not expanding test coverage. All existing test behavior must be preserved.

## Tasks/Subtasks

### Phase 1: Test File Relocation and Setup

- [x] **1.1. Relocate Test Files and Fixtures to Workspace Structure** ^US1-4aT1-1
  - **Agent**: code-developer-agent
  - **Objective**: Move all test files and fixture markdown files from legacy location to workspace-aligned directory structure
  - **Input**: 7 test files and 18 fixture files at `src/tools/utility-scripts/citation-links/test/`
  - **Output**: All test and fixture files relocated to `tools/citation-manager/test/` with preserved directory structure
  - **Files**:
    - `tools/citation-manager/test/validation.test.js` (create via move)
    - `tools/citation-manager/test/warning-validation.test.js` (create via move)
    - `tools/citation-manager/test/enhanced-citations.test.js` (create via move)
    - `tools/citation-manager/test/cli-warning-output.test.js` (create via move)
    - `tools/citation-manager/test/path-conversion.test.js` (create via move)
    - `tools/citation-manager/test/auto-fix.test.js` (create via move)
    - `tools/citation-manager/test/story-validation.test.js` (create via move)
    - `tools/citation-manager/test/fixtures/broken-links.md` (create via move)
    - `tools/citation-manager/test/fixtures/complex-headers.md` (create via move)
    - `tools/citation-manager/test/fixtures/enhanced-citations.md` (create via move)
    - `tools/citation-manager/test/fixtures/fix-test-anchor.md` (create via move)
    - `tools/citation-manager/test/fixtures/fix-test-combined.md` (create via move)
    - `tools/citation-manager/test/fixtures/fix-test-legacy.md` (create via move)
    - `tools/citation-manager/test/fixtures/fix-test-multiple.md` (create via move)
    - `tools/citation-manager/test/fixtures/fix-test-no-issues.md` (create via move)
    - `tools/citation-manager/test/fixtures/fix-test-path.md` (create via move)
    - `tools/citation-manager/test/fixtures/fix-test-reporting.md` (create via move)
    - `tools/citation-manager/test/fixtures/fix-test-validation.md` (create via move)
    - `tools/citation-manager/test/fixtures/scope-test.md` (create via move)
    - `tools/citation-manager/test/fixtures/test-target.md` (create via move)
    - `tools/citation-manager/test/fixtures/valid-citations.md` (create via move)
    - `tools/citation-manager/test/fixtures/warning-test-source.md` (create via move)
    - `tools/citation-manager/test/fixtures/wiki-cross-doc.md` (create via move)
    - `tools/citation-manager/test/fixtures/subdir/warning-test-target.md` (create via move)
  - **Scope**:
    - Create `tools/citation-manager/test/` directory if not exists
    - Move all 7 test files from `src/tools/utility-scripts/citation-links/test/` to `tools/citation-manager/test/`
    - Create `tools/citation-manager/test/fixtures/` directory
    - Create `tools/citation-manager/test/fixtures/subdir/` directory
    - Move all 17 markdown fixture files from legacy `fixtures/` to new `fixtures/` location
    - Move 1 markdown fixture file from legacy `fixtures/subdir/` to new `fixtures/subdir/` location
    - Preserve exact file names and fixture directory structure (including subdir/)
    - Do NOT modify file contents during move - syntax conversion happens in Phase 2
    - Verify all files successfully relocated with no data loss (total: 7 test files + 18 fixture files = 25 files)
  - **Test**: All 7 test files present at new location, all 18 fixture files present in fixtures subdirectory (17 in fixtures/, 1 in fixtures/subdir/), file contents unchanged from source
  - **Commands**: `ls -la tools/citation-manager/test/ && ls -la tools/citation-manager/test/fixtures/ && ls -la tools/citation-manager/test/fixtures/subdir/`
  - _Requirements_: [[#^US1-4aAC1|AC1]]
  - _Leverage_: Existing workspace structure pattern from tools/mock-tool/test/
  - _Implementation Details_: [Will be populated in Phase 4]

### Phase 2: Framework Conversion

- [x] **2.1. Convert Core Validation Tests to Vitest** ^US1-4aT2-1
  - **Agent**: test-writer
  - **Objective**: Convert validation.test.js and warning-validation.test.js from node:test to Vitest framework
  - **Input**: Two test files using node:test/node:assert at new location from Phase 1
  - **Output**: Two test files using Vitest syntax with all tests passing
  - **Files**:
    - `tools/citation-manager/test/validation.test.js` (modify)
    - `tools/citation-manager/test/warning-validation.test.js` (modify)
  - **Scope**:
    - Replace `import { describe, test } from "node:test"` with `import { describe, it, expect } from "vitest"`
    - Remove `import { strict as assert } from "node:assert"`
    - Convert all `test()` calls to `it()` calls
    - Convert all `assert()` calls to `expect().toBe()` or appropriate expect matchers
    - Convert `assert.strictEqual()` to `expect().toBe()`
    - Convert `assert.includes()` patterns to `expect().toContain()`
    - Update citation-manager CLI path references from `join(__dirname, "..", "citation-manager.js")` to `join(__dirname, "..", "src", "citation-manager.js")`
    - Preserve all test descriptions, Given-When-Then comments, and test logic exactly
    - Ensure all tests pass with Vitest runner
  - **Test**: All validation and warning validation tests execute via `npm test` and pass with zero failures
  - **Commands**: `npm test -- validation && npm test -- warning-validation`
  - _Requirements_: [[#^US1-4aAC2|AC2]], [[#^US1-4aAC4|AC4]], [[#^US1-4aAC5|AC5]]
  - _Leverage_: Vitest expect API documentation, existing test logic from node:test version
  - _Implementation Details_: [Will be populated in Phase 4]

- [x] **2.2. Convert Enhanced Citation Tests to Vitest** ^US1-4aT2-2
  - **Agent**: test-writer
  - **Objective**: Convert enhanced-citations.test.js and story-validation.test.js from node:test to Vitest framework
  - **Input**: Two test files using node:test/node:assert at new location from Phase 1
  - **Output**: Two test files using Vitest syntax with all tests passing
  - **Files**:
    - `tools/citation-manager/test/enhanced-citations.test.js` (modify)
    - `tools/citation-manager/test/story-validation.test.js` (modify)
  - **Scope**:
    - Replace node:test imports with Vitest imports
    - Remove node:assert imports
    - Convert all `test()` to `it()`, `assert` to `expect()` matchers
    - Update citation-manager CLI path references to workspace-relative paths
    - Preserve all enhanced citation format validation logic
    - Preserve all story-specific validation test logic
    - Ensure all tests pass with Vitest runner
  - **Test**: All enhanced citation and story validation tests execute via `npm test` and pass with zero failures
  - **Commands**: `npm test -- enhanced-citations && npm test -- story-validation`
  - _Requirements_: [[#^US1-4aAC2|AC2]], [[#^US1-4aAC4|AC4]], [[#^US1-4aAC5|AC5]]
  - _Leverage_: Vitest expect API, conversion patterns from Task 2.1
  - _Implementation Details_: [Will be populated in Phase 4]

- [x] **2.3. Convert CLI Output Tests to Vitest** ^US1-4aT2-3
  - **Agent**: test-writer
  - **Objective**: Convert cli-warning-output.test.js from node:test to Vitest framework
  - **Input**: Single test file using node:test/node:assert at new location from Phase 1
  - **Output**: Test file using Vitest syntax with all tests passing
  - **Files**:
    - `tools/citation-manager/test/cli-warning-output.test.js` (modify)
  - **Scope**:
    - Replace node:test imports with Vitest imports
    - Remove node:assert imports
    - Convert all `test()` to `it()`, `assert` to `expect()` matchers
    - Update citation-manager CLI path references to workspace-relative paths
    - Preserve all CLI output format validation logic
    - Preserve all warning message format assertions
    - Ensure all tests pass with Vitest runner
  - **Test**: All CLI warning output tests execute via `npm test` and pass with zero failures
  - **Commands**: `npm test -- cli-warning-output`
  - _Requirements_: [[#^US1-4aAC2|AC2]], [[#^US1-4aAC4|AC4]], [[#^US1-4aAC5|AC5]]
  - _Leverage_: Vitest expect API, conversion patterns from Task 2.1
  - _Implementation Details_: [Will be populated in Phase 4]

- [x] **2.4. Convert Path Conversion Tests to Vitest** ^US1-4aT2-4
  - **Agent**: test-writer
  - **Objective**: Convert path-conversion.test.js from node:test to Vitest framework, including component unit tests
  - **Input**: Test file with both CLI integration tests and component unit tests using node:test/node:assert
  - **Output**: Test file using Vitest syntax with all CLI and component tests passing
  - **Files**:
    - `tools/citation-manager/test/path-conversion.test.js` (modify)
  - **Scope**:
    - Replace node:test imports with Vitest imports
    - Remove node:assert imports
    - Convert all `test()` to `it()`, `assert` to `expect()` matchers
    - Update citation-manager CLI path references to workspace-relative paths
    - Preserve component unit tests using direct instantiation `new CitationValidator()` (DI refactoring deferred to US1.4b per ADR-001)
    - Preserve all path resolution and conversion validation logic
    - Ensure all CLI integration tests and component unit tests pass with Vitest runner
  - **Test**: All path conversion tests (CLI + component) execute via `npm test` and pass with zero failures
  - **Commands**: `npm test -- path-conversion`
  - _Requirements_: [[#^US1-4aAC2|AC2]], [[#^US1-4aAC4|AC4]], [[#^US1-4aAC5|AC5]]
  - _Leverage_: Vitest expect API, conversion patterns from Task 2.1, accepted technical debt for non-DI component instantiation
  - _Implementation Details_: [Will be populated in Phase 4]

- [x] **2.5. Convert Auto-Fix Tests to Vitest** ^US1-4aT2-5
  - **Agent**: test-writer
  - **Objective**: Convert auto-fix.test.js from node:test to Vitest framework
  - **Input**: Test file using node:test/node:assert at new location from Phase 1
  - **Output**: Test file using Vitest syntax with all tests passing
  - **Files**:
    - `tools/citation-manager/test/auto-fix.test.js` (modify)
  - **Scope**:
    - Replace node:test imports with Vitest imports
    - Remove node:assert imports
    - Convert all `test()` to `it()`, `assert` to `expect()` matchers
    - Update citation-manager CLI path references to workspace-relative paths
    - Preserve all auto-fix feature integration test logic
    - Preserve all file modification validation assertions
    - Ensure all tests pass with Vitest runner
  - **Test**: All auto-fix tests execute via `npm test` and pass with zero failures
  - **Commands**: `npm test -- auto-fix`
  - _Requirements_: [[#^US1-4aAC2|AC2]], [[#^US1-4aAC4|AC4]], [[#^US1-4aAC5|AC5]]
  - _Leverage_: Vitest expect API, conversion patterns from Task 2.1
  - _Implementation Details_: [Will be populated in Phase 4]

### Phase 3: Legacy Cleanup and Validation

- [x] **3.1. Remove Legacy Test Location** ^US1-4aT3-1
  - **Agent**: code-developer-agent
  - **Objective**: Remove legacy test directory after confirming all tests pass at new location
  - **Input**: Passing test suite at new location from Phase 2, legacy directory at `src/tools/utility-scripts/citation-links/test/`
  - **Output**: Legacy test location removed, only workspace-aligned test location remains
  - **Files**:
    - `src/tools/utility-scripts/citation-links/test/` (delete directory)
  - **Scope**:
    - Verify all tests passing at new location: `npm test` shows zero failures
    - Remove entire legacy test directory `src/tools/utility-scripts/citation-links/test/` including all subdirectories
    - Confirm no references to legacy test path remain in codebase
    - Verify Vitest discovers tests only from new location
  - **Test**: Legacy directory no longer exists, `npm test` continues to discover and execute all tests from new location
  - **Commands**: `ls src/tools/utility-scripts/citation-links/test/ 2>&1 | grep "No such file" && npm test`
  - _Requirements_: [[#^US1-4aAC6|AC6]]
  - _Leverage_: Passing test validation from Phase 2 tasks
  - _Implementation Details_: [tasks/03-3-1-remove-legacy-test-location-us1.4a.md](tasks/03-3-1-remove-legacy-test-location-us1.4a.md)

- [ ] **3.2. Implement CLI Test Helper for Process Cleanup** ^US1-4aT3-2
  - **Agent**: test-writer
  - **Objective**: Create reusable CLI test helper with proper cleanup to prevent Vitest worker process accumulation while maintaining parallel test execution
  - **Input**: Current 7 test files using direct `execSync()` calls, observed worker process accumulation (7 workers × ~4GB each)
  - **Output**: CLI helper created, all test files updated, vitest.config adjusted for controlled parallelism
  - **Files**:
    - `tools/citation-manager/test/helpers/cli-runner.js` (create)
    - `tools/citation-manager/test/validation.test.js` (modify)
    - `tools/citation-manager/test/warning-validation.test.js` (modify)
    - `tools/citation-manager/test/enhanced-citations.test.js` (modify)
    - `tools/citation-manager/test/cli-warning-output.test.js` (modify)
    - `tools/citation-manager/test/path-conversion.test.js` (modify)
    - `tools/citation-manager/test/auto-fix.test.js` (modify)
    - `tools/citation-manager/test/story-validation.test.js` (modify)
    - `vitest.config.js` (modify)
  - **Scope**:
    - Create CLI helper with proper cleanup: `tools/citation-manager/test/helpers/cli-runner.js`
    - Replace all direct `execSync()` calls with helper usage in 7 test files
    - Update `vitest.config.js`: replace `singleFork: true` with `maxForks: 4` for controlled parallelism
    - Add cleanup hints (garbage collection) in helper finally block
    - Verify parallel execution preserved with controlled worker count
  - **Test**: All tests pass, max 4 worker processes during execution, no hanging processes after completion, parallel execution preserved
  - **Commands**: `npm test && ps aux | grep vitest | grep -v grep`
  - _Requirements_: [[#^US1-4aAC3|AC3]], [[#^US1-4aAC5|AC5]]
  - _Leverage_: Existing test suite, workspace Vitest configuration
  - _Implementation Details_: [tasks/03-3-2-implement-cli-test-helper-us1.4a.md](tasks/03-3-2-implement-cli-test-helper-us1.4a.md)

- [ ] **3.3. Execute Full Regression Validation** ^US1-4aT3-3
  - **Agent**: qa-validation
  - **Objective**: Execute complete test suite to validate zero regression after framework migration AND process cleanup
  - **Input**: All migrated tests from Phase 2, legacy location removed from Task 3.1, CLI helper implemented from Task 3.2
  - **Output**: Validation report confirming all 50+ tests pass with zero regressions and proper process cleanup
  - **Files**: (validation only - no file modifications)
  - **Scope**:
    - Execute full test suite from workspace root: `npm test`
    - Validate all 50+ existing tests pass with Vitest runner
    - Confirm Vitest discovers tests via workspace glob pattern `tools/**/test/**/*.test.js`
    - Validate test execution time reasonable (no significant performance regression)
    - Verify worker process cleanup (max 4 workers during execution, no hanging processes after completion)
    - Confirm zero test failures, zero regressions from node:test baseline
    - Document test execution results with pass/fail counts and process cleanup verification
  - **Test**: All 50+ tests pass using Vitest framework, confirming zero regression from node:test migration and proper process cleanup
  - **Commands**: `npm test && ps aux | grep vitest | grep -v grep`
  - _Requirements_: [[#^US1-4aAC3|AC3]], [[#^US1-4aAC5|AC5]]
  - _Leverage_: Complete migrated test suite from Phase 2, workspace Vitest configuration, CLI helper from Task 3.2
  - _Implementation Details_: [tasks/03-3-3-execute-full-regression-validation-us1.4a.md](tasks/03-3-3-execute-full-regression-validation-us1.4a.md)

### Acceptance Criteria Coverage

**AC1 Coverage** ([[#^US1-4aAC1|AC1]] - Test files relocated to tools/citation-manager/test/):
- Task 1.1: Relocate test files and fixtures to workspace structure

**AC2 Coverage** ([[#^US1-4aAC2|AC2]] - Migrated tests use Vitest framework):
- Task 2.1: Convert core validation tests to Vitest
- Task 2.2: Convert enhanced citation tests to Vitest
- Task 2.3: Convert CLI output tests to Vitest
- Task 2.4: Convert path conversion tests to Vitest
- Task 2.5: Convert auto-fix tests to Vitest

**AC3 Coverage** ([[#^US1-4aAC3|AC3]] - npm test executes via shared Vitest configuration):
- Task 3.2: Implement CLI helper with proper process cleanup
- Task 3.3: Execute full regression validation via workspace npm test

**AC4 Coverage** ([[#^US1-4aAC4|AC4]] - Tests reference workspace-relative CLI paths):
- Task 2.1: Update CLI paths in validation tests
- Task 2.2: Update CLI paths in enhanced citation tests
- Task 2.3: Update CLI paths in CLI output tests
- Task 2.4: Update CLI paths in path conversion tests
- Task 2.5: Update CLI paths in auto-fix tests

**AC5 Coverage** ([[#^US1-4aAC5|AC5]] - All 50+ existing tests pass without regression):
- Task 2.1: Validation and warning tests pass
- Task 2.2: Enhanced citation and story tests pass
- Task 2.3: CLI output tests pass
- Task 2.4: Path conversion tests pass
- Task 2.5: Auto-fix tests pass
- Task 3.2: CLI helper maintains test passing status
- Task 3.3: Full regression validation confirms all tests pass

**AC6 Coverage** ([[#^US1-4aAC6|AC6]] - Legacy test location removed):
- Task 3.1: Remove legacy test location

**Error Scenarios**: All Phase 2 tasks maintain existing error handling test coverage from node:test version
**Happy Path**: Task 3.3 validates successful end-to-end test execution with Vitest and proper process cleanup
**Integration Points**: All Phase 2 tasks validate CLI integration via execSync() patterns, Task 3.2 wraps execSync() in cleanup helper

### Task Sequencing

#### Sequential Dependencies

**Phase 1 → Phase 2**: Task [[#^US1-4aT1-1|1.1]] must complete before Tasks [[#^US1-4aT2-1|2.1]]-[[#^US1-4aT2-5|2.5]]
- Dependency Rationale: Framework conversion operations require test files physically relocated to workspace directory structure where Vitest can discover them via glob pattern

**Phase 2 → Phase 3 (Task 3.1)**: All tasks [[#^US1-4aT2-1|2.1]]-[[#^US1-4aT2-5|2.5]] must complete before Task [[#^US1-4aT3-1|3.1]]
- Dependency Rationale: Legacy location removal is only safe after confirming all tests execute successfully from new location with Vitest framework

**Task 3.1 → Task 3.2**: Task [[#^US1-4aT3-1|3.1]] must complete before Task [[#^US1-4aT3-2|3.2]]
- Dependency Rationale: CLI helper implementation (3.2) requires clean workspace state after legacy directory removal (3.1)

**Task 3.2 → Task 3.3**: Task [[#^US1-4aT3-2|3.2]] must complete before Task [[#^US1-4aT3-3|3.3]]
- Dependency Rationale: Final regression validation (3.3) should run with proper cleanup configuration in place to verify production-ready test suite

#### Parallel Execution Groups

**Group 1 - Framework Conversion (Phase 2)**:
- Tasks [[#^US1-4aT2-1|2.1]], [[#^US1-4aT2-2|2.2]], [[#^US1-4aT2-3|2.3]], [[#^US1-4aT2-4|2.4]], [[#^US1-4aT2-5|2.5]] can execute in parallel
- Independent test files (7 total) applying identical node:test → Vitest conversion pattern
- Same agent: test-writer
- Parallel execution saves 60-75 minutes vs sequential conversion

#### Agent Handoff Points

**Handoff 1: code-developer-agent → test-writer** (After Phase 1)
- Outgoing Agent: code-developer-agent
- Incoming Agent: test-writer
- Deliverable: All test and fixture files relocated to workspace structure at `tools/citation-manager/test/`
- Validation Gate:
  - All 7 test files present at `tools/citation-manager/test/` (validation.test.js, warning-validation.test.js, enhanced-citations.test.js, cli-warning-output.test.js, path-conversion.test.js, auto-fix.test.js, story-validation.test.js)
  - All 18 fixture markdown files present at `tools/citation-manager/test/fixtures/` subdirectory (17 in fixtures/, 1 in fixtures/subdir/)
  - File contents binary-identical to source (verified via diff or checksum comparison)
  - Directory structure preserved exactly from legacy location (including subdir/)
  - Manual smoke test: `ls -la tools/citation-manager/test/ && wc -l tools/citation-manager/test/*.test.js && find tools/citation-manager/test/fixtures -name "*.md" | wc -l`

**Handoff 2: test-writer → code-developer-agent** (After Phase 2)
- Outgoing Agent: test-writer
- Incoming Agent: code-developer-agent
- Deliverable: All 7 test files converted to Vitest framework with all tests passing
- Validation Gate:
  - All 50+ tests pass using Vitest runner (confirmed via `npm test` output)
  - Zero test failures, zero test skips
  - All test files use Vitest syntax exclusively (no remaining `node:test` or `node:assert` imports)
  - All `test()` functions converted to `it()` functions
  - All `assert` calls converted to `expect()` matchers
  - CLI path references updated to `join(__dirname, "..", "src", "citation-manager.js")` workspace-relative pattern
  - Test execution time reasonable (no significant performance degradation from node:test baseline)

**Handoff 3: code-developer-agent → test-writer** (After Task 3.1)
- Outgoing Agent: code-developer-agent
- Incoming Agent: test-writer
- Deliverable: Legacy test location completely removed, workspace structure as only test location
- Validation Gate:
  - Legacy directory no longer exists: `ls src/tools/utility-scripts/citation-links/test/ 2>&1` returns "No such file or directory"
  - No references to legacy path in codebase: `grep -r "src/tools/utility-scripts/citation-links/test" .` returns zero matches
  - Tests continue passing after cleanup: `npm test` shows zero failures
  - Vitest discovers exactly 7 test files from new location only (verified via `npm test -- --reporter=verbose` output)
  - Test coverage maintained at pre-cleanup levels

**Handoff 4: test-writer → qa-validation** (After Task 3.2)
- Outgoing Agent: test-writer
- Incoming Agent: qa-validation
- Deliverable: CLI helper implemented, all test files updated, vitest config adjusted for controlled parallelism
- Validation Gate:
  - Helper file created at `tools/citation-manager/test/helpers/cli-runner.js`
  - All 7 test files use helper (no direct `execSync()` calls remain in test files)
  - vitest.config uses `maxForks: 4` (not `singleFork: true`)
  - All tests pass with controlled worker count
  - No hanging processes after test completion: `ps aux | grep vitest | grep -v grep` returns empty
  - Parallel execution preserved (test duration unchanged ±10%)

#### Scope Validation Checkpoints

Each code-developer-agent and test-writer task completion triggers an application-tech-lead validation checkpoint to ensure implementation adheres strictly to task specification.

**Validation Approach**:
- Validation agent receives the **exact same task specification** given to implementation agent
- Compares implementation against task specification fields: Objective, Files, Scope, Output, Test criteria
- Answers: "Did implementation follow task specification exactly? Any deviations?"

**Validation Agent**: application-tech-lead

**Validation Output**: PASS or FAIL
- **PASS**: Implementation matches task specification exactly, next wave proceeds
- **FAIL**: Specific deviations identified, blocks next wave until remediation complete

#### Execution Sequence

**Wave 1a - Execute Test Relocation** (Estimated: 15-20 min):
- Execute: Task [[#^US1-4aT1-1|1.1]]
- Agent: code-developer-agent
- Deliverable: All 7 test files and 18 fixture files relocated to `tools/citation-manager/test/` directory structure (includes subdir/ preservation)

**Wave 1b - Validate Test Relocation** (Estimated: 5-10 min):
- Validate: Task [[#^US1-4aT1-1|1.1]]
- Agent: application-tech-lead
- Input: Task 1.1 specification
- Validation: All 7 test files moved to correct location, all 18 fixtures relocated (17 in fixtures/, 1 in fixtures/subdir/), file contents unchanged (binary diff verification), directory structure matches spec including subdir/, scope limited to relocation only (no content modifications), AC1 requirements met
- **Block Condition**: Wave 2 blocked until validation PASS

**Wave 2a - Execute Framework Conversion** (Estimated: 75-90 min):
- Execute: Tasks [[#^US1-4aT2-1|2.1]], [[#^US1-4aT2-2|2.2]], [[#^US1-4aT2-3|2.3]], [[#^US1-4aT2-4|2.4]], [[#^US1-4aT2-5|2.5]] in parallel
- Agent: test-writer
- Prerequisite: Wave 1b PASS (requires relocated files)
- Deliverable: 7 test files converted to Vitest syntax with all 50+ tests passing at new location

**Wave 2b - Validate Framework Conversion** (Estimated: 25-30 min):
- Validate: Tasks [[#^US1-4aT2-1|2.1]], [[#^US1-4aT2-2|2.2]], [[#^US1-4aT2-3|2.3]], [[#^US1-4aT2-4|2.4]], [[#^US1-4aT2-5|2.5]] in parallel
- Agent: application-tech-lead
- Input: Same task specifications from Wave 2a (tasks 2.1-2.5)
- Validation: Only specified 7 test files modified (no fixture changes, no component changes), Vitest imports correctly applied (`describe/it/expect` replacing `test/assert`), all CLI path references updated to workspace-relative pattern, all tests passing, scope limited to syntax conversion only (no test logic changes, no new tests added), AC2/AC4/AC5 requirements met
- **Block Condition**: Wave 3 blocked until all 5 parallel validations PASS

**Wave 3a - Execute Legacy Cleanup** (Estimated: 10-15 min):
- Execute: Task [[#^US1-4aT3-1|3.1]]
- Agent: code-developer-agent
- Prerequisite: Wave 2b PASS (requires all tests passing at new location)
- Deliverable: Legacy test directory `src/tools/utility-scripts/citation-links/test/` completely removed

**Wave 3b - Validate Legacy Cleanup** (Estimated: 5-10 min):
- Validate: Task [[#^US1-4aT3-1|3.1]]
- Agent: application-tech-lead
- Input: Same task specification from Wave 3a (task 3.1)
- Validation: Legacy directory successfully deleted (ls command fails with "No such file"), no remaining references to legacy path in codebase (grep search returns empty), tests continue passing after removal (`npm test` shows zero failures), Vitest discovers tests only from workspace location, scope limited to directory removal only (no test content changes), AC6 requirements met
- **Block Condition**: Wave 3c blocked until validation PASS

**Wave 3c - Execute Process Cleanup Implementation** (Estimated: 30-40 min):
- Execute: Task [[#^US1-4aT3-2|3.2]]
- Agent: test-writer
- Prerequisite: Wave 3b PASS (requires legacy cleanup complete)
- Deliverable: CLI helper created at `tools/citation-manager/test/helpers/cli-runner.js`, all 7 test files updated to use helper, vitest config adjusted with `maxForks: 4` for controlled parallelism

**Wave 3d - Validate Process Cleanup Implementation** (Estimated: 10-15 min):
- Validate: Task [[#^US1-4aT3-2|3.2]]
- Agent: application-tech-lead
- Input: Same task specification from Wave 3c (task 3.2)
- Validation: Helper file created, all 7 test files use helper (no direct `execSync()` calls remain), vitest.config uses `maxForks: 4` (not `singleFork: true`), all tests pass, worker count ≤ 4 during execution, no hanging processes after completion, parallel execution preserved (duration unchanged ±10%), AC3/AC5 requirements met
- **Block Condition**: Wave 5 blocked until validation PASS

**Wave 5 - Final Regression Validation** (Estimated: 10-15 min):
- Execute: Task [[#^US1-4aT3-3|3.3]]
- Agent: qa-validation
- Prerequisite: Wave 3d PASS (requires process cleanup implemented)
- Deliverable: Comprehensive validation report confirming all 50+ tests pass with Vitest framework, zero regressions from node:test baseline, proper process cleanup verified
- Validation Scope: Execute full test suite from workspace root, confirm test count matches baseline (50+ tests), verify test discovery via Vitest glob pattern, validate execution time acceptable, verify worker cleanup (max 4 workers, no hanging processes), document pass/fail counts and process cleanup verification
- Note: No validation checkpoint needed (qa-validation is already a validation agent)

**Total Estimated Duration**: 3.0-3.5 hours (with parallelization + validation)
**Critical Path**: Wave 1a → 1b → 2a (bottleneck: 75-90 min) → 2b → 3a → 3b → 3c → 3d → 5
**Time Savings**: 60-75 minutes vs sequential execution (Phase 2 parallel conversion saves time)
**Longest Single Wave**: Wave 2a (75-90 min) - parallel execution of 5 test file conversions, driven by test-writer processing time per file

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|---------|
| 2025-10-05 | 1.2 | Enhanced Task Sequencing section with deeper dependency rationale, detailed validation gates, comprehensive wave execution analysis matching US1.4b depth | Application Tech Lead (Claude Sonnet 4.5) |
| 2025-10-05 | 1.1 | Restructured to match US1.4b format with phased task structure | Application Tech Lead (Claude Sonnet 4.5) |
| 2025-10-04 | 1.0 | Initial story creation from US1.4 split per ADR-001 | Application Tech Lead (Claude Sonnet 4.5) |

## Related Documentation

- [Content Aggregation PRD](../../content-aggregation-prd.md) - Parent feature PRD with story definition
- [Content Aggregation Architecture](../../content-aggregation-architecture.md) - Tool architecture with ADR-001 phased migration rationale
- [Workspace Testing Strategy](../../../../../../../design-docs/features/20250928-cc-workflows-workspace-scaffolding/cc-workflows-workspace-architecture.md#Testing%20Strategy) - Shared Vitest framework configuration
