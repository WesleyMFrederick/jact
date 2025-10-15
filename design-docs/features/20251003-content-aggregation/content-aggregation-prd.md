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
| 2025-10-07 | 2.2 | Mark US1.5 as COMPLETE, update Technical Lead Feedback sections: Parser data contract RESOLVED (US1.5 Phase 1), US1.5 caching feedback IMPLEMENTED, Epic 2 feedback remains active for Stories 2.2-2.3 | Application Tech Lead |

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
- **NFR5: Performance:** The system SHALL parse each unique file at most once per command execution to minimize redundant I/O and processing time. ^NFR5

## Technical Considerations

> [!success] **Technical Lead Feedback**: Parser output data contract design ✅ RESOLVED
> _Resolution_: Parser Output Contract schema validated and documented via [US1.5 Phase 1](user-stories/us1.5-implement-cache-for-parsed-files/us1.5-implement-cache-for-parsed-files.md#Phase%201%20Parser%20Output%20Contract%20Validation%20&%20Documentation). Base schema includes `{ filePath, content, tokens, links, headings, anchors }` with LinkObject and AnchorObject structures.
> _Resolution Date_: 2025-10-07
> _Epic 2 Note_: Base schema sufficient for ContentExtractor. May require minor extensions for content extraction metadata if Story 2.1 analysis identifies gaps.
<!-- -->
> [!warning] **Technical Lead Feedback**: Parser-extractor interaction model design required (Epic 2)
> _Architecture Impact_: The interaction model between the parser and the new extractor component needs to be designed, including the specific data structures they will use to communicate.
> _Status_: Active - Required before Story 2.2 implementation
> _Relevant Architecture Principles_: [black-box-interfaces](../../../../../design-docs/Architecture%20Principles.md#^black-box-interfaces), [data-model-first](../../../../../design-docs/Architecture%20Principles.md#^data-model-first), [single-responsibility](../../../../../design-docs/Architecture%20Principles.md#^single-responsibility)
<!-- -->
> [!warning] **Technical Lead Feedback**: CLI interface design decision needed (Epic 2)
> _Architecture Impact_: Research and a design decision are needed to confirm if adding a feature flag to the `validate` command is the correct long-term CLI interface, or if a new, dedicated `extract` command would be more intuitive and extensible.
> _Status_: Active - Required before Story 2.3 implementation
> _Relevant Architecture Principles_: [simplicity-first](../../../../../design-docs/Architecture%20Principles.md#^simplicity-first), [follow-conventions](../../../../../design-docs/Architecture%20Principles.md#^follow-conventions), [immediate-understanding](../../../../../design-docs/Architecture%20Principles.md#^immediate-understanding), [extension-over-modification](../../../../../design-docs/Architecture%20Principles.md#^extension-over-modification)

---

## Feature Epics

### Epic: Citation Manager Test Migration & Content Aggregation

This feature encompasses two critical phases:
1. **Test Migration (US 1.4)**: Validate the citation-manager migration by ensuring all tests pass in the workspace
2. **Content Aggregation (US 2.1-2.3)**: Add content extraction and aggregation capabilities to the tool

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
_User Story Link:_ [us1.4a-migrate-test-suite-to-vitest](user-stories/us1.4a-migrate-test-suite-to-vitest/us1.4a-migrate-test-suite-to-vitest.md)%%stop-extract-link%%
_Status_: ✅ COMPLETE (2025-10-07)claudeclaude

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

_Depends On_: Story [Story 1.4a: Migrate citation-manager Test Suite to Vitest](#Story%201.4a%20Migrate%20citation-manager%20Test%20Suite%20to%20Vitest)
_Enables_: [Story 2.1: Enhance Parser to Handle Full-File and Section Links](#Story%202.1%20Enhance%20Parser%20to%20Handle%20Full-File%20and%20Section%20Links)
_Closes Technical Debt_: [Lack of Dependency Injection](content-aggregation-architecture.md#Lack%20of%20Dependency%20Injection)
_Functional Requirements_: [[#^FR2|FR2]], [[#^FR8|FR8]]
_User Story Link:_ [us1.4b-refactor-components-for-di](user-stories/us1.4b-refactor-components-for-di/us1.4b-refactor-components-for-di.md)%%stop-extract-link%%
_Status_: ✅ COMPLETE (2025-10-07)

---
### Story 1.5: Implement a Cache for Parsed File Objects

**As a** `citation-manager` tool,
**I want** to implement a caching layer that stores parsed file objects (the `Parser Output Contract`) in memory during a single command run,
**so that** I can eliminate redundant file read operations, improve performance, and provide an efficient foundation for new features like content extraction.

#### Story 1.5 Acceptance Criteria

1. GIVEN a file has already been parsed during a command's execution, WHEN a subsequent request is made for its parsed data, THEN the system SHALL return the `Parser Output Contract` object from the in-memory cache instead of re-reading the file from disk. ^US1-5AC1
2. GIVEN a file has not yet been parsed, WHEN a request is made for its parsed data, THEN the system SHALL parse the file from disk, store the resulting `Parser Output Contract` object in the cache, and then return it. ^US1-5AC2
3. The `CitationValidator` component SHALL be refactored to use this caching layer for all file parsing operations. ^US1-5AC3
4. WHEN validating a document that contains multiple links to the same target file, THEN the target file SHALL only be read from disk and parsed once per command execution. ^US1-5AC4
5. GIVEN the new caching layer is implemented, WHEN the full test suite is executed, THEN all existing tests SHALL pass, confirming zero functional regressions. ^US1-5AC5

_Depends On_: [Story 1.4b: Refactor citation-manager Components for Dependency Injection](#Story%201.4b%20Refactor%20citation-manager%20Components%20for%20Dependency%20Injection)
_Enables_: [Story 2.1: Enhance Parser to Handle Full-File and Section Links](#Story%202.1%20Enhance%20Parser%20to%20Handle%20Full-File%20and%20Section%20Links)
_Closes Technical Debt_: [Redundant File Parsing During Validation](content-aggregation-architecture.md#Redundant%20File%20Parsing%20During%20Validation)
_Functional Requirements_: [[#^FR8|FR8]]
_Non-Functional Requirements_: [[#^NFR5|NFR5]]
_User Story Link:_ [us1.5-implement-cache-for-parsed-files](user-stories/us1.5-implement-cache-for-parsed-files/us1.5-implement-cache-for-parsed-files.md)%%stop-extract-link%%
_Status_: ✅ COMPLETE (2025-10-07)

> [!success] **Technical Lead Feedback**: Caching Layer for Performance and Modularity ✅ IMPLEMENTED
> _Resolution_: ParsedFileCache component successfully implemented with Map-based in-memory caching. CitationValidator refactored to use cache via constructor injection. Factory pattern integration complete. All acceptance criteria met with zero regressions.
> _Resolution Date_: 2025-10-07
> _Architecture Impact Realized_:
> - **ParsedFileCache Component**: New caching component sits between CitationValidator and MarkdownParser, managing in-memory lifecycle of Parser Output Contract objects
> - **CitationValidator Refactoring**: Refactored to accept ParsedFileCache dependency via constructor, uses cache for all file parsing operations (lines 107, 471)
> - **CLI Orchestrator Updates**: Handles async validator methods, factory creates and injects cache into validator
> - **Public Contracts**: ParsedFileCache provides `resolveParsedFile()` async method, CitationValidator constructor signature changed to accept cache dependency
> _Architecture Principles Applied_:
> - [Dependency Abstraction](../../../../../design-docs/Architecture%20Principles.md#^dependency-abstraction): CitationValidator depends on ParsedFileCache abstraction, not concrete MarkdownParser ✅
> - [Single Responsibility](../../../../../design-docs/Architecture%20Principles.md#^single-responsibility): ParsedFileCache has single responsibility for managing parsed file object lifecycle ✅
> - [One Source of Truth](../../../../../design-docs/Architecture%20Principles.md#^one-source-of-truth): Cache is authoritative source for parsed data during command execution ✅
---

### Story 1.6: Refactor MarkdownParser.Output.DataContract - Eliminate Duplicate Anchor Entries

As a developer working on content extraction features,
I want the MarkdownParser.Output.DataContract to represent each anchor once with both raw and URL-encoded ID variants as properties,
so that anchor data is normalized, memory-efficient, and easier to work with in downstream components.

#### Story 1.6 Acceptance Criteria
1. GIVEN a markdown header is parsed, WHEN the `MarkdownParser.Output.DataContract` is generated, THEN each header anchor SHALL be represented by a single AnchorObject containing both `id` (raw text format) and `urlEncodedId` (Obsidian-compatible format) properties, eliminating duplicate anchor entries. ^US1-6AC1
2. The AnchorObject schema SHALL include: `{ anchorType: "header"|"block", id: string, urlEncodedId: string|null, rawText: string|null, fullMatch: string, line: number, column: number }`, where `urlEncodedId` is populated only when it differs from `id`. ^US1-6AC2
3. The `CitationValidator.validateAnchorExists()` method SHALL check both `id` and `urlEncodedId` fields when matching anchors, maintaining backward compatibility with existing anchor validation logic. ^US1-6AC3
4. GIVEN a header containing colons and spaces (e.g., "Story 1.5: Implement Cache"), WHEN parsed, THEN the system SHALL generate one anchor with `id: "Story 1.5: Implement Cache"` and `urlEncodedId: "Story%201.5%20Implement%20Cache"`, not two separate anchor objects. ^US1-6AC4
5. GIVEN the refactored anchor schema is implemented, WHEN the full test suite executes, THEN all existing tests SHALL pass with zero functional regressions, and the `MarkdownParser.Output.DataContract` validation test SHALL confirm no duplicate anchor entries. ^US1-6AC5
6. The `MarkdownParser.Output.DataContract` JSON schema documentation SHALL be updated to reflect the new single-anchor-per-header structure with dual ID properties. ^US1-6AC6

_Depends On_: [Story 1.5: Implement a Cache for Parsed File Objects](#Story%201.5%20Implement%20a%20Cache%20for%20Parsed%20File%20Objects)
_Enables_: [Story 1.7: Implement ParsedDocument Facade](#Story%201.7%20Implement%20ParsedDocument%20Facade)
_Closes Technical Debt_: [Duplicate Anchor Entries in MarkdownParser.Output.DataContract](content-aggregation-architecture.md#Duplicate%20Anchor%20Entries%20in%20MarkdownParser.Output.DataContract)
_Functional Requirements_: [[#^FR8|FR8]]
_User Story Link_: [us1.6: Refactor MarkdownParser.Output.DataContract - Eliminate Duplicate Anchor Entries](user-stories/us1.6-refactor-anchor-schema/us1.6-refactor-anchor-schema.md)
_Status_:  ✅ COMPLETE (2025-10-09)

---

### Story 1.7: Implement ParsedDocument Facade

As a developer,
I want a ParsedDocument wrapper class that encapsulates parser output navigation,
so that consumers (CitationValidator, ContentExtractor) depend on stable interfaces instead of internal data structures.

#### Story 1.7 Acceptance Criteria

1. The `ParsedDocument` class SHALL wrap the `MarkdownParser.Output.DataContract` and expose a public interface with query methods, encapsulating direct data structure access. ^US1-7AC1
2. The `ParsedDocument` class's public interface SHALL provide anchor query methods for consumers: `hasAnchor(anchorId)` and `findSimilarAnchors(anchorId)`. Internal helper methods for filtering and listing anchors are not part of the public contract. ^US1-7AC2
3. The `ParsedDocument` class SHALL provide content extraction methods: `extractSection(headingText)`, `extractBlock(anchorId)`, and `extractFullContent()` for `ContentExtractor` use cases (Epic 2). ^US1-7AC3
4. The `ParsedDocument` class's public interface SHALL provide a `getLinks()` method for `CitationValidator` use cases, returning all link objects found in the document. ^US1-7AC4
5. `CitationValidator` SHALL be refactored to use the public `ParsedDocument` methods instead of direct data structure access. ^US1-7AC5
6. `ParsedFileCache` SHALL be updated to return `ParsedDocument` instances instead of raw parser output objects. ^US1-7AC6
7. GIVEN the `ParsedDocument` facade is implemented and `CitationValidator` refactored, WHEN the full test suite executes, THEN all existing tests SHALL pass with zero behavioral changes. ^US1-7AC7
8. The component SHALL include unit tests validating each **public** query method's correct transformation of internal data structures into expected return values. ^US1-7AC8

_Depends On_: [Story 1.6: Refactor MarkdownParser.Output.DataContract - Eliminate Duplicate Anchor Entries](#Story%201.6%20Refactor%20MarkdownParser.Output.DataContract%20-%20Eliminate%20Duplicate%20Anchor%20Entries)
_Enables_: [Story 1.8: Refactor Anchor Validation to Use Strategy Pattern](#Story%201.8%20Refactor%20Anchor%20Validation%20to%20Use%20Strategy%20Pattern)
_Closes Technical Debt_: Tight coupling to parser internals (partially resolved), duplicate navigation logic across consumers (fully resolved)
_Creates Technical Debt_: [Incomplete Facade Encapsulation for Advanced Queries](content-aggregation-architecture.md#Incomplete%20Facade%20Encapsulation%20for%20Advanced%20Queries) (Low priority - isolated to error reporting)
_Functional Requirements_: [[#^FR8|FR8]] (Architecture principle: interface stability)
_User Story Link_: [us1.7: Implement ParsedDocument Facade](user-stories/us1.7-implement-parsed-document-facade/us1.7-implement-parsed-document-facade.md)
_Status_: ✅ COMPLETE (2025-10-15)

> [!success] **Technical Lead Feedback**: ParsedDocument Facade Implementation ✅ COMPLETE
>
> **Resolution**: ParsedDocument facade successfully implemented with all core query methods. CitationValidator and ParsedFileCache refactored to use facade interface. Zero functional regressions confirmed via full test suite (114 passed tests).
> 
> **Resolution Date**: 2025-10-15
> 
> **Implementation Guide**: [ParsedDocument Implementation Guide](../../../../../../resume-coach/design-docs/examples/component-guides/ParsedDocument%20Implementation%20Guide.md)
>
> **Known Limitation**:
> CitationValidator helper methods (lines 528, 560, 570-578) still access `_data.anchors` directly for type filtering and rawText operations. This creates [new technical debt](content-aggregation-architecture.md#Incomplete%20Facade%20Encapsulation%20for%20Advanced%20Queries) for Epic 2 resolution. Core validation fully decoupled; partial encapsulation acceptable for MVP scope.

---

### Story 1.8: Refactor Anchor Validation to Use Strategy Pattern

*As a* **developer**,
*I want* to **refactor** the **CitationValidator** to use a **Strategy pattern** for anchor validation,
*so that* the **system** can be easily **extended** to support **different markdown flavors** (e.g., GitHub-style anchors) without modifying core validation logic.

#### Story 1.8 Acceptance Criteria

1. An `AnchorValidationStrategy` interface SHALL be created at `src/strategies/AnchorValidationStrategy.js`, defining a `validate()` method contract. ^US1-8AC1
2. A default `ObsidianAnchorStrategy` SHALL be implemented, encapsulating the existing logic for validating Obsidian-style URL-escaped anchors. ^US1-8AC2
3. The `CitationValidator` constructor SHALL be refactored to accept an `AnchorValidationStrategy` dependency, and its validation logic SHALL delegate to the injected strategy. ^US1-8AC3
4. The `componentFactory` SHALL be updated to instantiate and inject the default `ObsidianAnchorStrategy` into the `CitationValidator`. ^US1-8AC4
5. GIVEN the refactoring is complete, WHEN the full test suite is executed, THEN all existing tests SHALL pass, confirming zero functional regressions. ^US1-8AC5
6. The component architecture documentation SHALL be updated to reflect the new Strategy pattern for anchor validation. ^US1-8AC6

_Depends On_: [Story 1.7: Implement ParsedDocument Facade](#Story%201.7%20Implement%20ParsedDocument%20Facade)
_Enables_: [Story 2.1: Enhance Parser to Handle Full-File and Section Links](#Story%202.1%20Enhance%20Parser%20to%20Handle%20Full-File%20and%20Section%20Links)
_Closes Technical Debt_: Prevents future debt by decoupling validation logic and enabling extension over modification.
_Functional Requirements_: [[#^FR8|FR8]]
_Status_: 📋 PENDING

> [!note] Technical Lead Feedback: Establishes Core Architectural Pattern
>
> Architectural Impact: This story establishes the Strategy Pattern as a core pattern for the application. By implementing it on an existing, well-tested feature (anchor validation), we prove its viability before reusing it for the more complex new feature (extraction eligibility) in Epic 2.
>
> Relevant Architecture Principles: [extension-over-modification](../../../../../design-docs/Architecture%20Principles.md#^extension-over-modification), [dependency-abstraction](../../../../../design-docs/Architecture%20Principles.md#^dependency-abstraction), [single-responsibility](../../../../../design-docs/Architecture%20Principles.md#^single-responsibility).

---
### Story 2.1: Enhance Parser to Handle Full-File and Section Links

**As a** developer,
**I want** the parser to identify links to both entire markdown files and specific sections within them,
**so that** I can handle both types of content extraction in a unified way.

#### Story 2.1 Acceptance Criteria
1. GIVEN a markdown file, WHEN the parser runs, THEN it SHALL extract an array of all links pointing to local markdown files, distinguishing between links with section anchors and those without. ^US2-1AC1
2. GIVEN the parser identifies multiple links to the same file, but at least one link includes a section anchor, THEN the system SHALL prioritize the section link(s) for extraction and issue a warning that the full file content will be ignored in favor of the more specific section(s). ^US2-1AC2
3. GIVEN the parser identifies only links without section anchors to a specific file, THEN it SHALL designate the entire file for content extraction. ^US2-1AC3

> [!note] **Technical Lead Feedback**: Parser output data contract - Base schema validated ✅
> _Base Schema Status_: Parser Output Contract validated in [US1.5 Phase 1](user-stories/us1.5-implement-cache-for-parsed-files/us1.5-implement-cache-for-parsed-files.md#Phase%201%20Parser%20Output%20Contract%20Validation%20&%20Documentation). Current schema: `{ filePath, content, tokens, links, headings, anchors }` with LinkObject (`linkType`, `scope`, `anchorType`, `source`, `target`) and AnchorObject (`anchorType`, `id`, `rawText`) structures.
> _Epic 2 Analysis Required_: Story 2.1 implementation should review existing LinkObject schema to determine if current `linkType`/`scope`/`anchorType` fields sufficiently distinguish full-file vs. section links, or if minor schema extensions are needed for content extraction metadata.
> _Relevant Architecture Principles_: [data-model-first](../../../../../design-docs/Architecture%20Principles.md#^data-model-first), [primitive-first-design](../../../../../design-docs/Architecture%20Principles.md#^primitive-first-design), [illegal-states-unrepresentable](../../../../../design-docs/Architecture%20Principles.md#^illegal-states-unrepresentable), [explicit-relationships](../../../../../design-docs/Architecture%20Principles.md#^explicit-relationships)

_Depends On_: [Story 1.5: Implement a Cache for Parsed File Objects](#Story%201.5%20Implement%20a%20Cache%20for%20Parsed%20File%20Objects)
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

---
## Whiteboard

You've hit on the most important strategic questions we need to answer before starting Epic 2. You're right to be confused about the sequence; let's clarify it.

The proposed sequence of US 1.6, 1.7, and 1.8 is the correct, low-risk path forward. Regarding the parser's technical debt, I recommend we **defer** that refactoring until after Epic 2. Here’s the rationale.

---

### Clarifying the Sequence and Rationale

The current plan is a classic, incremental approach: fix the data, create a clean interface, prove the new pattern, and then build the new feature. US 1.8 does not "re-do" US 1.6; it builds upon it.

Here is the logical flow:

1. **US 1.6 (Refactor Anchor Schema): Fix the Data Model.** We first normalize the `AnchorObject` data model to be efficient and correct. This is a prerequisite for any new logic that consumes anchors.

2. **US 1.7 (Implement ParsedDocument Facade): Create the Interface.** We then introduce the `ParsedDocument` facade to encapsulate the parser's raw output. This provides a stable, method-based API (`hasAnchor()`, `getLinks()`, etc.) for all consumers and is the most critical step for enabling future refactoring.

3. **US 1.8 (Refactor Anchor Validation): Prove the New Pattern.** We introduce the **Strategy and Factory patterns** here by refactoring the _existing_ anchor validation logic. This allows us to validate the new architectural pattern on a known, testable feature before using it to build something new.

4. **US 2.1 (Implement Extraction Eligibility): Build the New Feature.** As the first story of Epic 2, we apply the now-proven Strategy pattern to the _new_ content extraction eligibility logic.

---

### Parser Refactoring (Regex vs. Tokens)

You are absolutely right to point out the parser's technical debt regarding its heavy use of regex instead of the generated tokens. However, I strongly recommend we **defer this specific refactoring** until after Epic 2 is complete.

Here’s why:

- **The Facade is the Safety Net:** The most important thing is to implement **US 1.7 (ParsedDocument Facade)**. Once the facade is in place, it completely decouples the `CitationValidator` and the future `ContentExtractor` from the parser's internal logic.

- **Decoupling Enables Safe Refactoring:** After the facade exists, we can gut and rewrite the `MarkdownParser`'s internals—switching entirely to a token-based approach—and as long as it still produces the same `MarkdownParser.Output.DataContract` for the facade to consume, **no downstream components will break**.

- **Focus on Delivery:** Refactoring the parser now is a significant task that would delay the start of Epic 2. By implementing the facade first, we can deliver the high-value content extraction feature and then safely circle back to optimize the parser's performance and code quality later.
