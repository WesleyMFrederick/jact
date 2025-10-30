# Citation Manager Enhancement - Orchestrated Implementation Plan

**Critial LLM Initialization Instructions**: When first reading this file, you MUST IMMEDIATELY run citation manager to extract base paths: `npm run citation:base-paths <this-file-path> -- --format json`. Read ALL discovered base path files to gather complete architectural context before proceeding.

## Overview
As application-tech-lead orchestrator, I will coordinate specialized agents to enhance the citation manager with comprehensive linting and fixing capabilities. The enhanced tool will detect short filename paths as warnings and fix both path and anchor issues via the existing fix command.

## User Story
**As a** documentation maintainer working with cross-document markdown citations
**I want** the citation manager to automatically detect and fix short filename references that should use relative paths
**So that** my citations are explicit, maintainable, and work consistently across different directory structures

### Core Problem
The citation manager currently resolves short filename references (like `version-analysis.md`) through file cache when they exist in different directories, marking them as "valid" citations. However, these short filename references create maintenance issues because they rely on implicit file discovery rather than explicit relative paths. When documentation structures change or files move, these implicit references become fragile and harder to track. The system needs to detect cross-directory short filename usage as a linting warning while providing automatic conversion to explicit relative paths through the existing fix command.

- **Current State**: Short filename citations that resolve via file cache to different directories are marked as "valid" with no indication of potential maintenance issues
- **Required State**: Cross-directory short filename citations trigger "warning" status and can be automatically converted to explicit relative paths via the fix command
- **Integration Requirement**: Enhancement must extend existing validation status enum, leverage current file cache resolution logic, and integrate with the established fix command architecture

## Acceptance Criteria

1. GIVEN a citation uses a short filename that resolves via file cache to a different directory, WHEN validation runs with scope enabled, THEN the citation SHALL be flagged as a "warning" status. ^AC1
2. GIVEN validation detects both short filename warnings and kebab-case anchor issues, WHEN the fix command runs with scope enabled, THEN both types of issues SHALL be automatically corrected in the source file. ^AC2
3. GIVEN validation finds valid citations, warnings, and errors, WHEN displaying CLI output, THEN the report SHALL clearly separate these three categories with warnings distinctly marked as fixable issues. ^AC3
4. GIVEN a short filename citation like `version-analysis.md`, WHEN the target file is located at `../../features/version-analysis.md`, THEN the fix command SHALL convert it to the correct relative path. ^AC4
5. GIVEN existing fix command functionality for kebab-case anchors, WHEN the enhanced fix command runs, THEN all existing anchor fix behavior SHALL continue to work unchanged. ^AC5

## Project Root
[`agentic-workflows/utility-scripts/citation-links`](../../../../citation-links)

## Tasks/SubTasks

- [x] **1. Warning Status Test**
  - [x] 1.1 Create basic warning validation test ^T1-1
    - **Agent**: test-writer
    - **Objective**: Create focused test that validates short filename citations return "warning" status
    - **Input**: Current test structure and existing fixtures in test/ directory
    - **Output**: Single test file that validates warning status for cross-directory short filename citations
    - **Files**: `test/warning-validation.test.js`
    - **Scope**:
      - Create test fixture with short filename citation in different directory
      - Test CLI output shows warning section instead of valid section
      - Test JSON output contains "warning" status for cross-directory short filename
    - **Test**: Warning validation test created: test validates short filename citations resolving cross-directory via file cache trigger warning status
    - **Commands**: `node --test test/warning-validation.test.js`
    - _Requirements_: [[#^AC1|AC1]]
    - _Implementation Details_: [01-1-warning-validation-test.md](./01-1-warning-validation-test.md)

- [x] **2. Warning Status Implementation**
  - [x] 2.1 Implement warning validation status and short filename detection ^T2-1
    - **Agent**: code-developer-agent
    - **Objective**: Add "warning" validation status and short filename detection to CitationValidator
    - **Input**: Current CitationValidator.js with existing validation logic and file cache resolution
    - **Output**: Enhanced CitationValidator with warning status support and cross-directory short filename detection
    - **Files**: `src/CitationValidator.js`
    - **Scope**:
      - Add "warning" status to validation results enum
      - Modify `validateCrossDocumentLink()` to detect cross-directory short filenames
      - Flag resolved-via-cache citations as warnings when source/target are in different directories
    - **Test**: Warning validation implementation passes: test from T1-1 validates correct warning status behavior
    - **Commands**: `node --test test/warning-validation.test.js`
    - _Requirements_: [[#^AC1|AC1]]
    - _Implementation Details_: [02-1-warning-status-implementation.md](./02-1-warning-status-implementation.md)

- [x] **3. CLI Reporting Test**
  - [x] 3.1 Create CLI warning reporting test ^T3-1
    - **Agent**: test-writer
    - **Objective**: Create test that validates CLI properly displays warnings distinctly from valid and error statuses
    - **Input**: Warning status implementation from Task 2 with working warning detection
    - **Output**: Test that validates CLI output separates valid/warnings/errors with clear categorization
    - **Files**: `test/cli-warning-output.test.js`
    - **Scope**:
      - Test CLI output shows warning section with proper formatting
      - Test summary statistics include warning counts
      - Test warnings are distinctly marked as fixable issues
    - **Test**: CLI warning output test created: test validates proper warning section formatting and statistics
    - **Commands**: `node --test test/cli-warning-output.test.js`
    - _Requirements_: [[#^AC3|AC3]]
    - _Implementation Details_:

- [x] **4. CLI Reporting Implementation**
  - [x] 4.1 Implement CLI reporting to show warnings distinctly ^T4-1
    - **Agent**: code-developer-agent
    - **Objective**: Update validation reporting to show warnings distinctly from valid and error statuses
    - **Input**: Enhanced CitationValidator with warning status from Task 2
    - **Output**: Updated CLI formatting that separates valid/warnings/errors with clear categorization
    - **Files**: `citation-manager.js` (formatForCLI method)
    - **Scope**:
      - Modify CLI output to separate valid/warnings/errors
      - Update summary statistics to include warning counts
      - Add warning section formatting
    - **Test**: CLI reporting implementation passes: test from T3-1 validates proper warning display formatting
    - **Commands**: `node --test test/cli-warning-output.test.js`
    - _Requirements_: [[#^AC3|AC3]]
    - _Implementation Details_:

- [x] **5. Path Conversion Test**
  - [x] 5.1 Create path conversion calculation test ^T5-1
    - **Agent**: test-writer
    - **Objective**: Create test that validates relative path calculation for short filename conversions
    - **Input**: CLI reporting implementation from Task 4 with working warning display
    - **Output**: Test that validates calculateRelativePath() method and conversion suggestions
    - **Files**: `test/path-conversion.test.js`
    - **Scope**:
      - Test calculateRelativePath() method with various directory structures
      - Test validation results include path conversion suggestions
      - Test path conversion suggestions are accurate for different relative paths
    - **Test**: Path conversion test created: test validates calculateRelativePath() generates correct relative paths and suggestions
    - **Commands**: `node --test test/path-conversion.test.js`
    - _Requirements_: [[#^AC4|AC4]]
    - _Implementation Details_:

- [x] **6. Path Conversion Implementation**
  - [x] 6.1 Implement relative path calculation for short filename conversions ^T6-1
    - **Agent**: code-developer-agent
    - **Objective**: Implement relative path calculation for short filename conversions
    - **Input**: Enhanced CitationValidator with warning detection from Task 2
    - **Output**: CitationValidator with path conversion suggestion functionality
    - **Files**: `src/CitationValidator.js`
    - **Scope**:
      - Add `calculateRelativePath()` method to generate proper relative paths
      - Extend validation results to include path conversion suggestions
      - Maintain existing anchor validation functionality
    - **Test**: Path conversion implementation passes: test from T5-1 validates correct relative path calculations and suggestions
    - **Commands**: `node --test test/path-conversion.test.js`
    - _Requirements_: [[#^AC4|AC4]]
    - _Implementation Details_:

- [x] **7. Fix Command Test**
  - [x] 7.1 Create enhanced fix command test ^T7-1
    - **Agent**: test-writer
    - **Objective**: Create test that validates fix command handles both path conversions and anchor fixes
    - **Input**: Path conversion implementation from Task 6 with working path suggestions
    - **Output**: Test that validates fix command processes both anchor and path issues
    - **Files**: `test/enhanced-fix.test.js`
    - **Scope**:
      - Test fix command converts short filename paths to relative paths
      - Test fix command still handles kebab-case anchor fixes
      - Test fix command processes both issue types in single operation
    - **Test**: Enhanced fix test created: test validates fix command handles both path conversions and anchor fixes
    - **Commands**: `node --test test/enhanced-fix.test.js`
    - _Requirements_: [[#^AC2|AC2]], [[#^AC5|AC5]]
    - _Implementation Details_:

- [x] **8. Fix Command Implementation**
  - [x] 8.1 Implement enhanced fix command for path conversions ^T8-1
    - **Agent**: code-developer-agent
    - **Objective**: Extend existing fix command to handle path conversions alongside kebab-case anchor fixes
    - **Input**: Enhanced CitationValidator with path conversion suggestions from Task 6
    - **Output**: Enhanced fix command that processes both anchor and path issues
    - **Files**: `citation-manager.js` (fix method)
    - **Scope**:
      - Extend existing `fix()` method to process both anchor and path issues
      - Add path replacement logic alongside existing kebab-case anchor fixes
      - Maintain backward compatibility with current fix behavior
    - **Test**: Enhanced fix implementation passes: test from T7-1 validates fix command handles both issue types correctly
    - **Commands**: `node --test test/enhanced-fix.test.js`
    - _Requirements_: [[#^AC2|AC2]], [[#^AC5|AC5]]
    - _Implementation Details_:

- [x] **9. Documentation Update**
  - [x] 9.1 Update README.md with new linting and fix capabilities ^T9-1
    - **Agent**: code-developer-agent
    - **Objective**: Update README.md documentation with new linting and fix capabilities
    - **Input**: Complete enhanced citation manager with warning detection and comprehensive fix functionality
    - **Output**: Updated README with new feature documentation and usage examples
    - **Files**: `agentic-workflows/utility-scripts/citation-links/README.md`
    - **Scope**:
      - Document new warning status and detection
      - Update fix command documentation
      - Add examples of path conversion behavior
      - Update CLI output examples
    - **Test**: Documentation updated: README accurately documents new capabilities with examples
    - **Commands**: Manual review of README.md content
    - _Requirements_: [[#^AC1|AC1]], [[#^AC2|AC2]], [[#^AC3|AC3]]
    - _Implementation Details_:

- [x] **10. Integration Validation**
  - [x] 10.1 End-to-end validation of complete enhancement ^T10-1
    - **Agent**: qa-validation
    - **Objective**: End-to-end validation of complete citation manager enhancement
    - **Input**: All enhanced components with test coverage and updated documentation
    - **Output**: Validated complete implementation with confirmed functionality and no regressions
    - **Files**: All modified files
    - **Scope**:
      - Validate warning detection works correctly
      - Validate fix command handles both issue types
      - Validate CLI reporting is clear and accurate
      - Validate no regression in existing functionality
    - **Test**: Integration validation passes: all tests pass and functionality works end-to-end
    - **Commands**: `node --test test/*.test.js`
    - _Requirements_: [[#^AC1|AC1]], [[#^AC2|AC2]], [[#^AC3|AC3]], [[#^AC4|AC4]], [[#^AC5|AC5]]
    - _Implementation Details_:

### Deferred
1. **Anchor Preservation During Path Fix**: Clarify behavior when fixing paths that contain anchors - should validated anchors be preserved while invalid anchors get fixed simultaneously, or handle as separate operations
2. **Terminal Color Coding**: Future enhancement to add color differentiation between warnings and errors in CLI output

## Orchestration Coordination Responsibilities
- **Task Specification**: Provide detailed, atomic tasks to each agent.
- **Task Orchestrator**: Use the `## Sub-Agent Prompt Template` below for the agent prompt. Populate the {{IMPLEMENTATION_DETAILS_FILE_PATH}} variable with the task implemention details path.
- **Enforce Task Workflow Boundaries**:
  - **Never Create** todo lists for tasks that DO NOT HAVE an implemention details path that exists.
  - If the next task needs the work output from a previous task, **Wait** to create the next tasks implementation details until you can incorporate previous task's implementation details.
  - Update todo lists as more information becomes available.
  - Be explicit about your own tasks (i.e. create details file, launch agent, validate agent, mark task done in user story markdown file, to merge feature branch, etc.)
- **Interface Management**: Ensure agent outputs integrate cleanly.
- **Validation**: Validate the agent's work meets the task's expected output and that the agent followed all project coding and style conventions. If validation fails, hand back to the agent with guidance on how they can comply.
- **Merge Feature Branch**: Only after you have validated the task has completely met all expected output:
  - Mark the task done (- [x]) in this user story file.
  - Merge the feature branch back to its parent.
- **Quality Standards**: Maintain existing code patterns and architecture.
- **Progress Tracking**: Create comprehensive todo lists for your responsibilities AND for the agent. Monitor implementation through todo list updates.
- **Integration**: Coordinate handoffs between agents and validate compatibility. Integrate the previous agent's implementation details into the background context and files of the next task implementation details file.

## Sub-Agent Prompt Template

## Detail Implementations
Think carefully as you read the implementation details so you understand the task: @{{IMPLEMENTATION_DETAILS_FILE_PATH}}

## Workflow
1. Create feature branch
2. Only modify or create files you are instructed to modify or create
3. Stay within the scope and bounds of the implementation details
4. Use linting tools after significant changes
5. Create handoff notes in the implementation details file where instructed
6. Only handoff once Expected Outcome is met. Your work will be validated by another agent against the detail implementation, so no cheating.
