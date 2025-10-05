# Citation Manager - Content Aggregation Feature PRD

**Critial LLM Initialization Instructions**
When first reading this file, you MUST IMMEDIATELY run citation manager to extract base paths: `npm run citation:base-paths <this-file-path> -- --format json`. Read ALL discovered base path files to gather complete architectural context before proceeding.

## Overview (tl;dr)

**Baseline:** `Citation Manager` tool
- validates markdown citation links
- provides auto-fix capabilities for broken citations
- extracts links in a document so an LLM can read related content

**Improvement:** extend extraction to
- extract linked content, both full documents and link fragments (ie \#header and \#^blocks)
- return a single, self contained document with linked content written in place
- cache returned document to reduce read/compile time
- track changes to links in order to re-compile and re-cache, keeping cache in sync

**Value:** SAVES TIME & IMPROVES LLM FOCUS by automating context engineering vs. manually constructing context documents

---

## Goals

- **Primary Goal:** Extract, aggregate, and structure content from markdown links (fragments or full documents) into a single context package
- **User Outcome:** Reduce manual effort required to gather and structure context for complex prompts
- **Operational Capability:** Provide an automated workflow for building LLM context from distributed documentation
- **Strategic Goal:** Deliver the first feature improvement that leverages the workspace framework

---

## Background Context

AI-assisted development workflows frequently require gathering specific sections from multiple documentation files into a single context file. This is currently a manual, error-prone process involving copying and pasting content while maintaining proper attribution and structure.

This feature transforms the citation-manager from a validation-only tool into a content aggregation tool that can automatically assemble context files based on the links in a source document.

---

## Alignment with Product Vision

This feature directly supports the CC Workflows vision by:

- **Refined:** Enhances the citation-manager with a high-value capability that leverages its existing link parsing infrastructure
- **Repeatable:** Establishes a standardized pattern for automated context assembly across all documentation
- **Robust:** Builds on the validated workspace testing framework to ensure reliable content extraction
- **Impact:** Demonstrates immediate value from the centralized workspace framework

---

## Changelog

| Date | Version | Description | Author |
|------|---------|-------------|---------|
| 2025-10-03 | 1.0 | Initial feature PRD creation with Epic 2 and US 1.4 from workspace PRD | Product Manager Agent |
| 2025-10-04 | 2.1 | Split US1.4 into US1.4a (Test Migration) and US1.4b (DI Refactoring) per ADR-001, rewrote all AC in EARS format, updated dependency chain for Epic 2 | Application Tech Lead |

---

## Requirements

### Functional Requirements
- **FR2: Shared Testing Framework:** Test suite SHALL run via the workspace's shared Vitest framework. ^FR2
- **FR4: Link Section Identification:** The `citation-manager` SHALL parse a given markdown document and identify all links that point to local markdown files, distinguishing between links **with section anchors and those without**. ^FR4
- **FR5: Section Content Extraction:** The `citation-manager` SHALL be able to extract content from a target file in two ways: 1) If a section anchor is provided, it SHALL extract the full content under that specific heading, 2) If no section anchor is provided, it SHALL extract the **entire content of the file**. ^FR5
- **FR6: Content Aggregation:** The `citation-manager` SHALL aggregate the extracted content into a single markdown file, where each piece of content is **preceded by a markdown header that clearly identifies the source file and, if applicable, the section heading**. ^FR6
- **FR7: Centralized Execution:** The new aggregation feature SHALL be exposed via an **`--extract-context <output_file.md>` flag on the existing `validate` command**. ^FR7
- **FR8: Preserve Existing Functionality:** All existing `citation-manager` features SHALL be preserved and function correctly. ^FR8
- **FR9: Test Migration:** All existing unit tests for the `citation-manager` SHALL be migrated to the workspace and pass. ^FR9

### Non-Functional Requirements
- **NFR3: Reliability:** The citation-manager SHALL include unit tests that achieve at least 50% code coverage on new functionality. ^NFR3
- **NFR4: Design Adherence:** Implementation SHALL adhere to the workspace's MVB design principles and testing strategy. ^NFR4

## Technical Considerations

> [!warning] **Technical Lead Feedback**: Parser output data contract design required
> _Architecture Impact_: The data contract for the parser's output must be designed to clearly communicate the type of link (full-file vs. section) and any associated metadata to downstream components.
> _Relevant Architecture Principles_: [data-model-first](../../../../../design-docs/Architecture%20Principles.md#^data-model-first), [primitive-first-design](../../../../../design-docs/Architecture%20Principles.md#^primitive-first-design), [illegal-states-unrepresentable](../../../../../design-docs/Architecture%20Principles.md#^illegal-states-unrepresentable), [explicit-relationships](../../../../../design-docs/Architecture%20Principles.md#^explicit-relationships)
<!-- -->
> [!warning] **Technical Lead Feedback**: Parser-extractor interaction model design required
> _Architecture Impact_: The interaction model between the parser and the new extractor component needs to be designed, including the specific data structures they will use to communicate.
> _Relevant Architecture Principles_: [black-box-interfaces](../../../../../design-docs/Architecture%20Principles.md#^black-box-interfaces), [data-model-first](../../../../../design-docs/Architecture%20Principles.md#^data-model-first), [single-responsibility](../../../../../design-docs/Architecture%20Principles.md#^single-responsibility)
<!-- -->
> [!warning] **Technical Lead Feedback**: CLI interface design decision needed
> _Architecture Impact_: Research and a design decision are needed to confirm if adding a feature flag to the `validate` command is the correct long-term CLI interface, or if a new, dedicated `extract` command would be more intuitive and extensible.
> _Relevant Architecture Principles_: [simplicity-first](../../../../../design-docs/Architecture%20Principles.md#^simplicity-first), [follow-conventions](../../../../../design-docs/Architecture%20Principles.md#^follow-conventions), [immediate-understanding](../../../../../design-docs/Architecture%20Principles.md#^immediate-understanding), [extension-over-modification](../../../../../design-docs/Architecture%20Principles.md#^extension-over-modification)

---

## Feature Epics

### Epic: Citation Manager Test Migration & Content Aggregation

This feature encompasses two critical phases:
1. **Test Migration (US 1.4)**: Validate the citation-manager migration by ensuring all tests pass in the workspace
2. **Content Aggregation (US 2.1-2.3)**: Add content extraction and aggregation capabilities to the tool

---

### Story 1.4: Migrate and Validate `citation-manager` Test Suite [SUPERSEDED]

> **⚠️ Story Split per ADR-001**: This story has been decomposed into US1.4a (Test Migration) and US1.4b (DI Refactoring) to separate test framework conversion from architectural refactoring work.
>
> **Original AC Mapping**:
> - US1-4AC1 (file relocation) → US1-4aAC1
> - US1-4AC2 (Vitest execution) → US1-4aAC3
> - US1-4AC3 (tests pass) → US1-4aAC5
> - US1-4AC4 (legacy removal) → US1-4aAC6
> - US1-4bAC1-6: New requirements for DI refactoring (not in original scope)
>
> See [ADR-001: Phased Test Migration Strategy](content-aggregation-architecture.md#ADR-001%20Phased%20Test%20Migration%20Strategy) for decomposition rationale.

---

### Story 1.4a: Migrate citation-manager Test Suite to Vitest

**As a** developer,
**I want** to migrate the existing `citation-manager` test suite from Node.js test runner to Vitest,
**so that** tests run via the workspace's shared testing framework and validate zero migration regressions.

#### Story 1.4a Acceptance Criteria

1. WHEN the citation-manager test files and fixtures are relocated, THEN they SHALL reside at `tools/citation-manager/test/` within the workspace structure. ^US1-4aAC1
2. The migrated test suite SHALL use Vitest framework with `describe()`, `it()`, and `expect()` syntax, replacing all `node:test` and `node:assert` usage. ^US1-4aAC2
3. WHEN `npm test` is executed from workspace root, THEN Vitest SHALL discover and execute all citation-manager tests via the shared test configuration. ^US1-4aAC3
4. All test files SHALL reference the migrated citation-manager CLI at `tools/citation-manager/src/citation-manager.js` using workspace-relative paths. ^US1-4aAC4
5. GIVEN all test framework conversions are complete, WHEN the migrated test suite executes, THEN all 50+ existing tests SHALL pass without regression. ^US1-4aAC5
6. WHEN test migration validation confirms success (AC5 satisfied), THEN the legacy test location `src/tools/utility-scripts/citation-links/test/` SHALL be removed. ^US1-4aAC6

**Accepted Technical Debt**: Component tests will temporarily use non-DI instantiation (`new CitationValidator()`) until US1.4b implements constructor-based dependency injection. This deviation from workspace architecture principles is documented in [ADR-001: Phased Test Migration Strategy](content-aggregation-architecture.md#ADR-001%20Phased%20Test%20Migration%20Strategy).

_Depends On_: [US1.3: Make Migrated citation-manager Executable](../../../../../design-docs/features/20250928-cc-workflows-workspace-scaffolding/user-stories/us1.3-make-migrated-citation-manager-executable/us1.3-make-migrated-citation-manager-executable.md)
_Functional Requirements_: [[#^FR2|FR2]], [[#^FR9|FR9]]
_User Story Link:_ [us1.4a-migrate-test-suite-to-vitest](user-stories/us1.4a-migrate-test-suite-to-vitest/us1.4a-migrate-test-suite-to-vitest.md)

---

### Story 1.4b: Refactor citation-manager Components for Dependency Injection

**As a** developer,
**I want** to refactor citation-manager components to use constructor-based dependency injection,
**so that** the tool aligns with workspace architecture principles and enables proper integration testing with real dependencies.

#### Story 1.4b Acceptance Criteria

1. The CitationValidator, MarkdownParser, and FileCache components SHALL accept all dependencies via constructor parameters rather than creating them internally. ^US1-4bAC1
2. The citation-manager SHALL provide factory functions at `src/factories/componentFactory.js` that instantiate components with standard production dependencies. ^US1-4bAC2
3. The citation-manager CLI entry point SHALL use factory functions for component instantiation in production execution paths. ^US1-4bAC3
4. GIVEN component tests require explicit dependency control, WHEN tests instantiate components, THEN they SHALL bypass factory functions and inject real dependencies directly via constructors. ^US1-4bAC4
5. The test suite SHALL include component integration tests that validate collaboration between CitationValidator, MarkdownParser, and FileCache using real file system operations per workspace "Real Systems, Fake Fixtures" principle. ^US1-4bAC5
6. WHEN DI refactoring completes and all tests pass, THEN the technical debt "Lack of Dependency Injection" documented in content-aggregation-architecture.md SHALL be marked as resolved. ^US1-4bAC6

_Depends On_: Story 1.4a
_Enables_: Story 2.1 (Epic 2 feature work)
_Closes Technical Debt_: [Lack of Dependency Injection](content-aggregation-architecture.md#Lack%20of%20Dependency%20Injection)
_Functional Requirements_: [[#^FR2|FR2]], [[#^FR8|FR8]]
_User Story Link:_ [us1.4b-refactor-components-for-di](user-stories/us1.4b-refactor-components-for-di/us1.4b-refactor-components-for-di.md)

---

### Story 2.1: Enhance Parser to Handle Full-File and Section Links

**As a** developer,
**I want** the parser to identify links to both entire markdown files and specific sections within them,
**so that** I can handle both types of content extraction in a unified way.

#### Story 2.1 Acceptance Criteria
1. GIVEN a markdown file, WHEN the parser runs, THEN it SHALL extract an array of all links pointing to local markdown files, distinguishing between links with section anchors and those without. ^US2-1AC1
2. GIVEN the parser identifies multiple links to the same file, but at least one link includes a section anchor, THEN the system SHALL prioritize the section link(s) for extraction and issue a warning that the full file content will be ignored in favor of the more specific section(s). ^US2-1AC2
3. GIVEN the parser identifies only links without section anchors to a specific file, THEN it SHALL designate the entire file for content extraction. ^US2-1AC3

> [!warning] **Technical Lead Feedback**: Parser output data contract design required
> _Architecture Impact_: The data contract for the parser's output must be designed to clearly communicate the type of link (full-file vs. section) and any associated metadata to downstream components.
> _Relevant Architecture Principles_: [data-model-first](../../../../../design-docs/Architecture%20Principles.md#^data-model-first), [primitive-first-design](../../../../../design-docs/Architecture%20Principles.md#^primitive-first-design), [illegal-states-unrepresentable](../../../../../design-docs/Architecture%20Principles.md#^illegal-states-unrepresentable), [explicit-relationships](../../../../../design-docs/Architecture%20Principles.md#^explicit-relationships)

_Depends On_: Story 1.4b Completion
_Functional Requirements_: [[#^FR4|FR4]]

### Story 2.2: Implement Unified Content Extractor with Metadata

**As a** developer,
**I want** to create a content extraction module that can return either a full file's content or a specific section's content, including source metadata,
**so that** I have a single, reliable way to retrieve content for aggregation.

#### Story 2.2 Acceptance Criteria
1. GIVEN a file path and an optional heading, WHEN the extractor is called, THEN it SHALL return a structured object containing the extracted `content` string and `metadata`. ^US2-2AC1
2. IF a heading is provided, THEN the `content` SHALL be the text between that heading and the next heading of an equal or higher level. ^US2-2AC2
3. IF no heading is provided, THEN the `content` SHALL be the entire content of the file. ^US2-2AC3
4. GIVEN a file path or heading that does not exist, WHEN the extractor is called, THEN it SHALL fail gracefully by returning null or an empty object and log a warning. ^US2-2AC4

> [!warning] **Technical Lead Feedback**: Parser-extractor interaction model design required
> _Architecture Impact_: The interaction model between the parser and this new extractor component needs to be designed, including the specific data structures they will use to communicate.
> _Relevant Architecture Principles_: [black-box-interfaces](../../../../../design-docs/Architecture%20Principles.md#^black-box-interfaces), [data-model-first](../../../../../design-docs/Architecture%20Principles.md#^data-model-first), [single-responsibility](../../../../../design-docs/Architecture%20Principles.md#^single-responsibility)

_Depends On_: Story 2.1
_Functional Requirements_: [[#^FR5|FR5]]

### Story 2.3: Add `--extract-context` Flag to `validate` Command

**As a** developer,
**I want** to add an `--extract-context` flag to the existing `validate` command,
**so that** I can generate a structured context file based on the links found in a source document.

#### Story 2.3 Acceptance Criteria
1. GIVEN a new `--extract-context <output_file.md>` flag is added to the `validate` command, WHEN run, THEN it SHALL execute the end-to-end context aggregation process and write the result to the specified output file. ^US2-3AC1
2. GIVEN the output file, THEN the content from each extracted source SHALL be clearly delineated by a markdown header indicating its origin file (e.g., `## File: path/to/source.md`). ^US2-3AC2
3. IF content is extracted from a specific section, THEN the header in the output file SHALL also include the section heading (e.g., `## File: path/to/source.md#Section Heading`). ^US2-3AC3

> [!warning] **Technical Lead Feedback**: Research & Design CLI feature flag/command pattern
> _Architecture Impact_: Research and a design decision are needed to confirm if adding a feature flag to the `validate` command is the correct long-term CLI interface, or if a new, dedicated `extract` command would be more intuitive and extensible.
> _Relevant Architecture Principles_: [simplicity-first](../../../../../design-docs/Architecture%20Principles.md#^simplicity-first), [follow-conventions](../../../../../design-docs/Architecture%20Principles.md#^follow-conventions), [immediate-understanding](../../../../../design-docs/Architecture%20Principles.md#^immediate-understanding), [extension-over-modification](../../../../../design-docs/Architecture%20Principles.md#^extension-over-modification)

_Depends On_: Story 2.2
_Functional Requirements_: [[#^FR6|FR6]], [[#^FR7|FR7]]

---

## Feature Validation Approach

The feature will be validated through:

- **Test Migration Success**: All existing citation-manager tests pass without regressions in the workspace environment (US 1.4)
- **Content Extraction Functionality**: The `--extract-context` command successfully generates structured output files containing full content from both file-level and section-level links (US 2.1-2.3)
- **Quality Standards**: New functionality meets the 50% code coverage requirement with integration tests using real file operations

---

## Related Documentation

- [Content Aggregation Architecture](content-aggregation-architecture.md) - Feature-specific architectural enhancements
- [Workspace PRD](../../../../../design-docs/features/20250928-cc-workflows-workspace-scaffolding/cc-workflows-workspace-prd.md) - Parent workspace requirements
- [Workspace Architecture](../../../../../design-docs/features/20250928-cc-workflows-workspace-scaffolding/cc-workflows-workspace-architecture.md) - Workspace architectural context
