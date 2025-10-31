# Citation Manager - Content Aggregation Feature PRD

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

| Date       | Version | Description                                                                                                                                                                                                        | Author                                    |
| ---------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------- |
| 2025-10-03 | 1.0     | Initial feature PRD creation with Epic 2 and US 1.4 from workspace PRD                                                                                                                                             | Product Manager Agent                     |
| 2025-10-04 | 2.1     | Split US1.4 into US1.4a (Test Migration) and US1.4b (DI Refactoring) per ADR-001, rewrote all AC in EARS format, updated dependency chain for Epic 2                                                               | Application Tech Lead                     |
| 2025-10-07 | 2.2     | Mark US1.5 as COMPLETE, update Technical Lead Feedback sections: Parser data contract RESOLVED (US1.5 Phase 1), US1.5 caching feedback IMPLEMENTED, Epic 2 feedback remains active for Stories 2.2-2.3             | Application Tech Lead                     |
| 2025-10-19 | 2.3     | Mark US1.8 as COMPLETE - Validation Enrichment Pattern successfully implemented, all acceptance criteria validated, zero regressions confirmed (121/123 tests passing, 2 pre-existing failures unrelated to US1.8) | Application Tech Lead (Claude Sonnet 4.5) |
| 2025-10-23 | 2.4     | Mark US2.2 as COMPLETE - Content retrieval implemented with ParsedDocument facade integration, zero regressions confirmed                                                                                          | Application Tech Lead (Claude Sonnet 4.5) |
| 2025-10-23 | 2.5     | Add US2.2 AC15 - Filter out internal links (scope='internal') before processing to exclude them from OutgoingLinksExtractedContent array                                                                                        | Application Tech Lead (Claude Sonnet 4.5) |
| 2025-10-25 | 2.6     | Add US2.2a - Implement content deduplication using SHA-256 hashing to minimize token usage in LLM context. No backward compatibility required (Epic 2 cohesive unit)                                               | Application Tech Lead (Claude Sonnet 4.5) |
| 2025-10-28 | 2.7     | Mark US2.2a as COMPLETE - Content deduplication via SHA-256 hashing, three-group output structure, compression statistics                                                                                           | Application Tech Lead (Claude Sonnet 4.5) |
| 2025-10-29 | 2.8     | Refactor US2.3 to `extract links` subcommand with generic AC, add US2.4 for `extract header` subcommand, update FR6/FR7 for subcommand architecture, add FR12 for direct content extraction                        | Product Manager (Claude Sonnet 4.5)      |
| 2025-10-29 | 2.9     | Add US2.3 AC12 for --full-files flag, add US2.5 for extract file subcommand, add US2.6 for CLI help enhancements, add US2.7 for base-paths removal, update FR7 and FR12 for extract file support                | Product Manager (Claude Sonnet 4.5)      |
| 2025-10-30 | 3.0     | Mark US2.3 as COMPLETE - `extract links` subcommand implemented with comprehensive CLI integration tests, help documentation, and two-phase workflow (267/267 tests passing)                                     | Application Tech Lead (Claude Sonnet 4.5) |
| 2025-10-30 | 3.1     | Mark US2.5 as COMPLETE - `extract file` subcommand implemented with four-phase orchestration workflow, scope support, path conversion, comprehensive error handling, and help documentation (288/288 tests, 8 new) | Application Tech Lead (Claude Sonnet 4.5) |

---

## Requirements

### Functional Requirements
- **FR2: Shared Testing Framework:** Test suite SHALL run via the workspace's shared Vitest framework. ^FR2
- **FR4: Link Section Identification:** The `citation-manager` SHALL parse a given markdown document and identify all links that point to local markdown files, distinguishing between links **with section anchors and those without**. ^FR4
- **FR5: Section Content Extraction:** The `citation-manager` SHALL be able to extract content from a target file in two ways: 1) If a section anchor is provided, it SHALL extract the full content under that specific heading, 2) If no section anchor is provided, it SHALL extract the **entire content of the file**. ^FR5
- **FR6: Content Aggregation:** The `citation-manager` SHALL aggregate the extracted content into a structured output format containing deduplicated content blocks, processed link metadata, and extraction statistics. ^FR6
- **FR7: Subcommand Architecture:** The extraction features SHALL be exposed via `extract` command subcommands (`extract links`, `extract header`, and `extract file`) that provide distinct workflows for link-based, header-specific, and full-file content extraction. ^FR7
- **FR8: Preserve Existing Functionality:** All existing `citation-manager` features SHALL be preserved and function correctly. ^FR8
- **FR9: Test Migration:** All existing unit tests for the `citation-manager` SHALL be migrated to the workspace and pass. ^FR9
- **FR10: Extraction Control Markers:** The system SHALL recognize `%%extract-link%%` and `%%stop-extract-link%%` markers on the same line as a citation. `%%extract-link%%` SHALL force the extraction of a full-file link that would otherwise be skipped, and `%%stop-extract-link%%` SHALL prevent the extraction of a section or block link that would otherwise be included. These markers SHALL have the highest precedence over all other extraction rules. ^FR10
- **FR11: Content Deduplication:** The system SHALL deduplicate extracted content using content-based hashing (SHA-256) such that identical content is stored once in an indexed structure, regardless of how many links reference it. ^FR11
- **FR12: Direct Content Extraction:** The `citation-manager` SHALL support direct extraction of content from a specified file (full file or specific header) without requiring link discovery from a source document. ^FR12

### Non-Functional Requirements
- **NFR3: Reliability:** The citation-manager SHALL include unit tests that achieve at least 50% code coverage on new functionality. ^NFR3
- **NFR4: Design Adherence:** Implementation SHALL adhere to the workspace's MVB design principles and testing strategy. ^NFR4
- **NFR5: Performance:** The system SHALL parse each unique file at most once per command execution to minimize redundant I/O and processing time. ^NFR5
- **NFR6: Marker Scanning Performance:** The process of scanning for extraction control markers SHALL not significantly degrade parsing performance. The check MUST be a localized, line-level operation. ^NFR6
- **NFR7: Token Usage Optimization:** The output structure SHALL minimize redundant data to reduce LLM token consumption, with deduplicated content stored once and referenced by multiple links. ^NFR7

## Technical Considerations

> [!success] **Technical Lead Feedback**: Parser output data contract design ✅ RESOLVED
> _Resolution_: Parser Output Contract schema validated and documented via [US1.5 Phase 1](user-stories/us1.5-implement-cache-for-parsed-files/us1.5-implement-cache-for-parsed-files.md#Phase%201%20MarkdownParser.Output.DataContract%20Validation%20&%20Documentation). Base schema includes `{ filePath, content, tokens, links, headings, anchors }` with LinkObject and AnchorObject structures.
> _Resolution Date_: 2025-10-07
> _Epic 2 Note_: Base schema sufficient for ContentExtractor. May require minor extensions for content extraction metadata if Story 2.1 analysis identifies gaps.

> [!success] **Technical Lead Feedback**: Parser-extractor interaction model ✅ MOSTLY RESOLVED
> _Resolution_: Facade pattern successfully implemented with ParsedDocument providing black-box interface over MarkdownParser.Output.DataContract. ContentExtractor interacts exclusively through facade methods (extractSection, extractBlock, extractFullContent). Architecture principles (black-box-interfaces, data-model-first, single-responsibility) validated through code analysis.
> _Resolution Date_: 2025-10-30
> _Known Issue_: One facade violation in extractLinksContent.js:95-97 accessing `_data.headings` directly. Fix pending: remove heading level lookup and rely on extractSection's internal Phase 0 lookup.
> _Architecture Impact Realized_: Clean separation with MarkdownParser → ParsedDocument facade → ContentExtractor. ParsedFileCache wraps all parser output before exposure to consumers.

> [!success] **Technical Lead Feedback**: CLI interface design ✅ RESOLVED
> _Resolution_: Dedicated `extract` command implemented with subcommand architecture (`extract links`, `extract header`). Commander.js pattern provides clear semantic separation, extensibility, and intuitive interface. All four architecture principles validated.
> _Resolution Date_: 2025-10-30
> _Implementation_: citation-manager.js:810-890 implements parent command with subcommands. Strategy pattern + Factory pattern enable extension without CLI modification.
> _Architecture Impact Realized_: Validation and extraction cleanly separated. Subcommand pattern allows incremental feature additions (extract file, extract blocks) without modifying core commands.

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

**Accepted Technical Debt**: Component tests will temporarily use non-DI instantiation (`new CitationValidator()`) until US1.4b implements constructor-based dependency injection. This deviation from workspace architecture principles is documented in [ADR-001: Phased Test Migration Strategy](content-aggregation-architecture.md#ADR-001%20Phased%20Test%20Migration%20Strategy)%% stop-extract-link %%.

_Depends On_: [US1.3: Make Migrated citation-manager Executable](../../../../../design-docs/features/20250928-cc-workflows-workspace-scaffolding/user-stories/us1.3-make-migrated-citation-manager-executable/us1.3-make-migrated-citation-manager-executable.md)
_Functional Requirements_: [[#^FR2|FR2]], [[#^FR9|FR9]]
_User Story Link:_ [us1.4a-migrate-test-suite-to-vitest](user-stories/us1.4a-migrate-test-suite-to-vitest/us1.4a-migrate-test-suite-to-vitest.md)
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

_Depends On_: [Story 1.4b: Refactor citation-manager Components for Dependency Injection](#Story%201.4b%20Refactor%20citation-manager%20Components%20for%20Dependency%20Injection) %% stop-extract-link %%
_Enables_: [Story 2.1: Enhance Parser to Handle Full-File and Section Links](#Story%202.1%20Enhance%20Parser%20to%20Handle%20Full-File%20and%20Section%20Links) %% stop-extract-link %%
_Closes Technical Debt_:  [Redundant File Parsing During Validation](_archive/Content%20Aggregation%20Technical%20Debt.md#Redundant%20File%20Parsing%20During%20Validation) %% stop-extract-link %%
_Functional Requirements_: [[#^FR8|FR8]]
_Non-Functional Requirements_: [[#^NFR5|NFR5]]
_User Story Link:_ [us1.5-implement-cache-for-parsed-files](user-stories/us1.5-implement-cache-for-parsed-files/us1.5-implement-cache-for-parsed-files.md)%% stop-extract-link %%
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
_Closes Technical Debt_: [Duplicate Anchor Entries in MarkdownParser.Output.DataContract](_archive/Content%20Aggregation%20Technical%20Debt.md#Duplicate%20Anchor%20Entries%20in%20MarkdownParser.Output.DataContract) %% stop-extract-link %%
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
> **Implementation Guide**: [ParsedDocument Implementation Guide](../../component-guides/ParsedDocument%20Implementation%20Guide.md)
>
> **Known Limitation**:
> CitationValidator helper methods (lines 528, 560, 570-578) still access `_data.anchors` directly for type filtering and rawText operations. This creates [new technical debt](content-aggregation-architecture.md#Incomplete%20Facade%20Encapsulation%20for%20Advanced%20Queries) for Epic 2 resolution. Core validation fully decoupled; partial encapsulation acceptable for MVP scope.

---

### Story 1.8: Implement Validation Enrichment Pattern

**As a** **developer** building content extraction features,
**I want** the **`CitationValidator`** to enrich LinkObjects with validation metadata directly,
**so that** downstream components can access validation results without data duplication and redundant parser calls.

#### Story 1.8 Acceptance Criteria

1. The `CitationValidator.validateFile()` method SHALL return a `ValidationResult` object with structure `{ summary: { total, valid, warnings, errors }, links: LinkObject[] }`, where `links` is the array of enriched LinkObjects. ^US1-8AC1
2. GIVEN a LinkObject is validated, WHEN validation completes, THEN the LinkObject SHALL be enriched with a `validation` property containing `{ status: "valid"|"warning"|"error", error?: string, suggestion?: string, pathConversion?: object }`. ^US1-8AC2
3. The `summary` object SHALL provide aggregate counts derived from the enriched links array, eliminating the need for separate validation result objects. ^US1-8AC3
4. The CLI SHALL be refactored to consume the new `ValidationResult` structure, using `summary` for reporting and `links` for detailed validation information. ^US1-8AC4
5. GIVEN the Validation Enrichment Pattern is implemented, WHEN a component needs both link structure and validation status, THEN it SHALL access a single enriched LinkObject instead of correlating separate data structures. ^US1-8AC5
6. GIVEN the refactored validation workflow is complete, WHEN the full test suite executes, THEN all existing tests SHALL pass with zero functional regressions. ^US1-8AC6

_Depends On_: [Story 1.7: Implement ParsedDocument Facade](#Story%201.7%20Implement%20ParsedDocument%20Facade)
_Enables_: [Story 2.1: Implement Extraction Eligibility using Strategy Pattern](#Story%202.1%20Implement%20Extraction%20Eligibility%20using%20Strategy%20Pattern)
_Closes Technical Debt_: Data Duplication Between LinkObject and ValidationResult (80% duplication), Redundant getLinks() Calls Across Pipeline
_Functional Requirements_: [[#^FR8|FR8]] (Preserve existing functionality with improved architecture)
_User Story Link_: [us1.8-implement-validation-enrichment-pattern](user-stories/us1.8-implement-validation-enrichment-pattern/us1.8-implement-validation-enrichment-pattern.md)%%stop-extract-link%%
_Status_: ✅ COMPLETE (2025-10-19)

> [!info] **Architecture Impact**
> This story implements the Validation Enrichment Pattern, fundamentally changing how validation metadata flows through the system. The pattern achieves:
> - **Zero Duplication**: Validation data stored once on LinkObject (50% memory reduction)
> - **Single Data Flow**: One object passes through pipeline (parse → validate → filter → extract)
> - **No Redundant Calls**: Validator returns enriched links; extractor uses them directly
> - **Natural Lifecycle**: Progressive enhancement pattern (base data + validation metadata)
>
> **Breaking Change**: The `ValidationResult` structure changes from separate validation arrays to enriched LinkObjects. Coordinated updates required across:
> - `CitationValidator.js` (output contract)
> - `ContentExtractor.js` (consumes enriched links)
> - `citation-manager.js` CLI (reporting logic)
>
> **Implementation Priority**: Must complete before US2.1, as extraction eligibility strategies depend on `link.validation.status` being present.

---

## Epic 2: Content Extraction Component

### Story 2.1: Implement Extraction Eligibility using Strategy Pattern

**As a** developer creating context packages for an AI,
**I want** to use link-level markers (`%%extract-link%%`, `%%stop-extract-link%%`) to override the default content extraction behavior, **
so that** I can have fine-grained control and create precisely tailored context for my prompts.

#### Story 2.1 Acceptance Criteria

1. GIVEN a link points to a full file (no anchor), WHEN the `--full-files` flag is **not** present, THEN the default eligibility decision SHALL be `ineligible`. ^US2-1AC1
2. GIVEN a link points to a specific section or block (has an anchor), THEN the default eligibility decision SHALL be `eligible`. ^US2-1AC2
3. GIVEN a full-file link has a `%%extract-link%%` marker on the same line, THEN its eligibility SHALL be overridden to `eligible`, even without the `--full-files` flag. ^US2-1AC3
4. GIVEN a section or block link has a `%%stop-extract-link%%` marker on the same line, THEN its eligibility SHALL be overridden to `ineligible`. ^US2-1AC4
5. The marker-based rules (`%%extract-link%%`, `%%stop-extract-link%%`) SHALL have the highest precedence, overriding both default behaviors and the `--full-files` CLI flag. ^US2-1AC5
6. The eligibility logic SHALL be implemented using the **Strategy Pattern**, with each rule (e.g., `StopMarkerStrategy`, `CliFlagStrategy`) encapsulated in its own component, as defined in the architecture. ^US2-1AC6

_Depends On_: [Story 1.7: Implement ParsedDocument Facade](user-stories/us1.7-implement-parsed-document-facade/us1.7-implement-parsed-document-facade.md)
_Requirements_: [[#^FR4|FR4]], [[#^FR10|FR10]]
_Non-Functional Requirements_: [[#^NFR6|NFR6]]
_User Story Link_: [us2.1-implement-extraction-eligibility-strategy-pattern](user-stories/us2.1-implement-extraction-eligibility-strategy-pattern/us2.1-implement-extraction-eligibility-strategy-pattern.md)
_Status_: ✅ COMPLETE (2025-10-21)

### Story 2.2: Implement Content Retrieval in ContentExtractor

**As a** developer,
**I want** to extend the ContentExtractor component with content retrieval capabilities using the ParsedDocument facade,
**so that** the component can orchestrate the complete extraction workflow from validation through aggregation.

#### Story 2.2 Acceptance Criteria

1. The `ContentExtractor` component SHALL accept `parsedFileCache` and `citationValidator` dependencies via constructor injection in addition to the existing `eligibilityStrategies` dependency. ^US2-2AC1
2. The `ContentExtractor` component SHALL provide a public `extractLinksContent(sourceFilePath, cliFlags)` method that orchestrates the complete extraction workflow: validation → eligibility analysis → content retrieval → aggregation. ^US2-2AC2
3. GIVEN a source file path is provided, WHEN `extractLinksContent()` is called, THEN the component SHALL internally call `citationValidator.validateFile()` to discover and validate links, returning enriched LinkObjects with validation metadata. ^US2-2AC3
4. GIVEN enriched links are returned from validation, WHEN eligibility analysis executes, THEN the component SHALL filter links using the strategy chain from US2.1, excluding links where `link.validation.status === "error"` or eligibility decision is `false`. ^US2-2AC4
5. GIVEN an eligible link points to a section (`anchorType: "header"`), WHEN content retrieval executes, THEN the component SHALL use `parsedFileCache.resolveParsedFile()` to get the TARGET document, **normalize the anchor by URL-decoding it**, and call `parsedDoc.extractSection()` **with the decoded anchor text** to retrieve section content. ^US2-2AC5
6. GIVEN an eligible link points to a block (`anchorType: "block"`), WHEN content retrieval executes, THEN the component SHALL **normalize the anchor by removing any leading `^` character** and call `parsedDoc.extractBlock()` **with the normalized block ID** to retrieve block content. ^US2-2AC6
7. GIVEN an eligible link points to a full file (anchorType: null), WHEN content retrieval executes, THEN the component SHALL call `parsedDoc.extractFullContent()` to retrieve the entire file content. ^US2-2AC7
8. WHEN content extraction is attempted for an eligible link, THEN the `extractLinksContent` method SHALL produce an `OutgoingLinksExtractedContent` object for that link within its returned array. Each `OutgoingLinksExtractedContent` SHALL contain the `sourceLink` (`LinkObject`), a `status` ('success', 'skipped', or 'error'), and either `successDetails` (with `decisionReason` and `extractedContent` if status is 'success') or `failureDetails` (with a `reason` string if status is 'skipped' or 'error'). ^US2-2AC8
9. The `extractLinksContent()` method SHALL return a Promise resolving to an `array of OutgoingLinksExtractedContent` objects. ^US2-2AC9
10. The `createContentExtractor()` factory function SHALL be updated to accept and inject `parsedFileCache` and `citationValidator` dependencies with optional override parameters for testing. ^US2-2AC10
11. GIVEN the content retrieval implementation is complete, WHEN integration tests execute, THEN they SHALL validate the complete workflow using real **`ParsedFileCache`**, **`CitationValidator`**, and **ParsedDocument** instances per the "Real Systems, Fake Fixtures" principle. ^US2-2AC11
12. GIVEN the complete ContentExtractor implementation, WHEN the full test suite executes, THEN all US2.1 tests (35+ tests) SHALL continue passing with zero regressions. ^US2-2AC12
13. The `ParsedDocument.extractSection(headingText)` method SHALL be fully implemented using a 3-phase algorithm: (1) flatten token tree via recursive walk to locate target heading, (2) find section boundary by locating next same-or-higher level heading, (3) reconstruct content from token.raw properties. The method SHALL return the complete section content as a string, or null if heading not found. ^US2-2AC13
14. The `ParsedDocument.extractBlock(anchorId)` method SHALL be fully implemented to find the block anchor by ID in the anchors array, validate the line index is within bounds, and extract the single line containing the block anchor. The method SHALL return the line content as a string, or null if block anchor not found or line index invalid. ^US2-2AC14
15. GIVEN enriched links are returned from validation, WHEN `extractLinksContent()` processes links, THEN the component SHALL filter out links where `link.scope === 'internal'` before entering the processing loop, excluding them from the returned OutgoingLinksExtractedContent array. ^US2-2AC15

**Architecture Notes:**
- AC13-AC14 are prerequisites for AC5-AC7: extraction methods must be implemented before ContentExtractor can retrieve content
- Follows the [ContentExtractor Workflow Component Interaction](../../component-guides/Content%20Extractor%20Implementation%20Guide.md#ContentExtractor%20Workflow%20Component%20Interaction)
- Implements Validation Enrichment Pattern from US1.8
- Single service interface abstracts multi-step workflow from CLI

_Depends On_: [Story 2.1: Implement Extraction Eligibility using Strategy Pattern](#Story%202.1%20Implement%20Extraction%20Eligibility%20using%20Strategy%20Pattern)
_Enables_: [Story 2.2a: Implement Content Deduplication for OutgoingLinksExtractedContents](#Story%202.2a%20Implement%20Content%20Deduplication%20for%20OutgoingLinksExtractedContents)
_Functional Requirements_: [[#^FR5|FR5]], [[#^FR6|FR6]]
_Non-Functional Requirements_: [[#^NFR5|NFR5]] (ParsedFileCache ensures single parse per file)
_Architecture Reference_:
- [Content Extractor Implementation Guide](../../component-guides/Content%20Extractor%20Implementation%20Guide.md)
- [ParsedDocument Implementation Guide](../../component-guides/ParsedDocument%20Implementation%20Guide.md)
_Implement Plan_: [us2.2-implement-content-retrieval-implement-plan](user-stories/us2.2-implement-content-retrieval/us2.2-implement-content-retrieval-implement-plan.md)
_Status_: ✅ COMPLETE (2025-10-23)

---

### Story 2.2a: Implement Content Deduplication for OutgoingLinksExtractedContents

**As a** developer creating context packages for AI,
**I want** the ContentExtractor to deduplicate identical extracted content using content-based hashing,
**so that** LLM token usage is minimized by storing each unique piece of content only once.

#### Story 2.2a Acceptance Criteria

1. The ContentExtractor SHALL deduplicate extracted content internally during the extraction workflow, returning an optimized output structure that stores identical content only once. ^US2-2aAC1
2. GIVEN extracted content is successfully retrieved, THEN the system SHALL generate a content identifier using SHA-256 hashing of the content string, truncated to the first 16 hexadecimal characters. ^US2-2aAC2
3. The output structure SHALL organize extracted content into three logical groups: an index mapping content IDs to deduplicated content blocks, a report of processed links with their extraction outcomes, and aggregate statistics summarizing the results. ^US2-2aAC3
4. GIVEN multiple links extract identical content, THEN the content SHALL be stored once with all source locations tracked in an array that records the file path, anchor, and anchor type for each occurrence. ^US2-2aAC4
5. Each deduplicated content entry SHALL include the extracted text, its character count, and metadata about all source locations that produced this content (including target file paths, anchors, and anchor types). ^US2-2aAC5
6. Each processed link entry SHALL reference its extracted content via content ID and SHALL include source location metadata (line number, column number, link text, eligibility reason, and extraction status). ^US2-2aAC6
7. The output statistics SHALL include counts of total processed links, unique content blocks, duplicate content detected, estimated tokens saved through deduplication, and compression ratio achieved. ^US2-2aAC7
8. GIVEN a link extraction attempt fails or is skipped, THEN the link SHALL be included in the processed links report with a null content reference and a reason explaining the failure. ^US2-2aAC8
9. The extractLinksContent() method SHALL return deduplicated output as the only public contract format. Any intermediate non-deduplicated structures are internal implementation details. ^US2-2aAC9
10. GIVEN the deduplication implementation is complete, WHEN integration tests execute, THEN they SHALL validate correct hash generation, duplicate detection, statistics calculation, and preservation of all link metadata. ^US2-2aAC10

_Depends On_: [Story 2.2: Implement Content Retrieval in ContentExtractor](#Story%202.2%20Implement%20Content%20Retrieval%20in%20ContentExtractor)
_Enables_: [Story 2.3: Implement `extract` Command](#Story%202.3%20Implement%20extract%20Command)
_Functional Requirements_: [[#^FR11|FR11]] (Content deduplication)
_Non-Functional Requirements_: [[#^NFR7|NFR7]] (Token usage optimization)
_Status_: ✅ COMPLETE (2025-10-28)
#### Story 2.2a Impacted Components
- [Citation Manager.ContentExtractor](content-aggregation-architecture.md#Citation%20Manager.ContentExtractor)

> [!warning] **Technical Lead Architecture Notes**
> **No backward compatibility**: Epic 2 is a cohesive unit; flat array format is replaced entirely
> - **Primary goal**: Minimize token usage for LLM context packages
> - **Content-based hashing**: Catches duplicates even when different files contain identical text
> - **Known limitation**: Nested content duplication (H2 containing H3 subsections) is out of scope; documented as technical debt
---

### Story 2.3: Implement `extract links` Subcommand

**As a** developer creating context packages for AI,
**I want** a new `extract links` subcommand that extracts content from all links in a source document,
**so that** I can automate context assembly for linked content instead of manually gathering content from multiple files.

#### Story 2.3 Acceptance Criteria

1. A new `extract links` subcommand SHALL be implemented in the citation-manager CLI with signature: `extract links <source-file> [options]`. ^US2-3AC1
2. The `extract links` subcommand SHALL support the following options: `--scope <folder>` for limiting file resolution scope, `--format <type>` for output format control, and `--full-files` flag for enabling full-file link extraction. ^US2-3AC2
3. WHEN the `extract links` subcommand executes, THEN it SHALL coordinate a two-phase workflow: (Phase 1) discover and validate all links in the source file, (Phase 2) extract content from validated links. ^US2-3AC3
4. The CLI orchestrator SHALL pass pre-validated, enriched LinkObjects to the ContentExtractor component and receive structured results containing extraction outcomes for each processed link. ^US2-3AC4
5. GIVEN the `extract links` subcommand executes, WHEN validation errors or warnings are encountered during Phase 1 (link discovery), THEN they SHALL be reported to the user clearly indicating which citations have issues. ^US2-3AC5
6. GIVEN validation has been reported, WHEN the subcommand proceeds to Phase 2 (content extraction), THEN it SHALL extract content only from links with valid status that pass eligibility checks. ^US2-3AC6
7. GIVEN extraction has completed with results, WHEN output is ready, THEN the subcommand SHALL output the deduplicated content structure to stdout, and SHALL exit with status code 0 if at least one link resulted in successful extraction. ^US2-3AC7
8. GIVEN extraction fails completely, WHEN no content can be extracted due to source file errors or no eligible links, THEN the subcommand SHALL exit with a non-zero status code to signal failure. ^US2-3AC8
9. The `extract links` subcommand SHALL be implemented without affecting existing `validate` command functionality, maintaining backward compatibility with current validation workflows. ^US2-3AC9
10. GIVEN the `extract links` subcommand is implemented, WHEN CLI integration tests execute with real fixture files, THEN they SHALL validate the complete end-to-end workflow from source file to successful extraction output. ^US2-3AC10
11. The citation-manager help text SHALL document the `extract` command at both levels: top-level help (`extract --help` or `extract -h`) SHALL list available subcommands with brief descriptions, and subcommand help (`extract links --help` or `extract links -h`) SHALL provide detailed usage, options, and examples for the `links` workflow. ^US2-3AC11
12. WHEN the user provides the `--full-files` flag, THEN full-file links (links without section/block anchors) SHALL be extracted rather than skipped by default eligibility rules. ^US2-3AC12

**Deferred Scope Note:** Output formatting (originally AC5), file writing (originally AC6, AC7), and the `--output` option (originally AC2) have been deferred. See the 'Future Work' section in the [Content Extractor Implementation Guide](../../component-guides/Content%20Extractor%20Implementation%20Guide.md#Future%20Work) for details.

**Implementation Notes - CLI Orchestration Pattern:**
The CLI orchestrates the two-phase workflow by calling components sequentially:
1. **Phase 1 (Validation)**: Call `citationValidator.validateFile(sourceFile)` to discover and validate links in the source document
2. **Phase 2 (Extraction)**: Extract enriched links from validation result (`validationResult.links`) and pass to `contentExtractor.extractContent(enrichedLinks, cliFlags)`
3. **Phase 3 (Output)**: Receive deduplicated `OutgoingLinksExtractedContent` structure and output to stdout

This pattern separates concerns: validator discovers/enriches links, extractor processes pre-validated links. See [Epic 2 Whiteboard - CLI Orchestrator](#CLI%20Orchestrator%20(ENHANCED)) for detailed orchestration pseudocode.

> [!warning] **Technical Lead Feedback**: CLI Testing Buffer Limits & Workaround
>
> **Resolution**: Defer direct import refactor for tests; continue using shell redirection workaround (`runCLI` helper) for US2.3 CLI integration testing (AC11). **Resolution Date**: 2025-10-22
>
> **Architecture Reference**: [Technical Debt: CLI Subprocess Testing Buffer Limits](../../../../../design-docs/Architecture%20-%20Baseline.md#Technical%20Debt%20CLI%20Subprocess%20Testing%20Buffer%20Limits)
>
> **Known Limitation**: Testing the `extract` command via subprocesses (using the `runCLI` helper) relies on shell redirection to bypass stdio buffer limits (~64KB). This adds complexity compared to directly importing and testing CLI functions. The recommended refactor (direct import) is deferred to maintain MVP velocity. Ensure AC11 tests use the `runCLI` helper or similar redirection to handle potentially large output from `extractLinksContent`.

> [!note] **Technical Lead Feedback**: CLI Design Decision
> The `extract` command is a separate command (not a flag on `validate`) because extraction is a distinct operation with different inputs (requires --output), different outputs (aggregated content vs validation report), and different workflow (validation is an internal prerequisite step, as shown in the ContentExtractor Workflow diagram).

_Depends On_: [Story 2.2a: Implement Content Deduplication for OutgoingLinksExtractedContents](#Story%202.2a%20Implement%20Content%20Deduplication%20for%20OutgoingLinksExtractedContents)
_Functional Requirements_: [[#^FR6|FR6]], [[#^FR7|FR7]] (updated: dedicated command vs flag)
_Architecture Workflow Reference_: [ContentExtractor Workflow Component Interaction](../../component-guides/Content%20Extractor%20Implementation%20Guide.md#ContentExtractor%20Workflow%20Component%20Interaction)
_User Story Link_:
_Status_: ✅ COMPLETE (2025-10-30)

> [!success] **Technical Lead Feedback**: `extract links` Subcommand Implementation ✅ COMPLETE
>
> **Resolution**: CLI subcommand successfully implemented with comprehensive two-phase workflow orchestration. All 12 acceptance criteria validated through 11 CLI integration tests plus end-to-end workflow verification.
>
> **Resolution Date**: 2025-10-30
>
> **Implementation Summary**:
> - CLI command registration at citation-manager.js:732-763 with Commander.js subcommand pattern
> - Two-phase workflow: Phase 1 validates/discovers links (lines 293-305), Phase 2 extracts content (lines 307-312)
> - Validation error reporting to stderr before extraction (lines 299-305)
> - Exit code logic: 0 on success, 1 on no content, 2 on system error (lines 318-328)
> - Help documentation implemented at both levels (top-level `extract --help` and subcommand `extract links --help`)
> - All three CLI flags functional: `--scope`, `--format`, `--full-files`
>
> **Verification**:
> - Test suite: 267/267 tests passing (100% pass rate)
> - CLI integration tests: 11 tests covering all acceptance criteria
> - End-to-end test validates complete workflow with real fixtures
> - Zero regressions to existing `validate` command functionality
> - Files implemented: src/citation-manager.js (extract command), src/CitationManager.js (extractLinks method)
>
> **Architecture Impact Realized**:
> - Clean separation of concerns: CLI orchestrates, Validator discovers/enriches, Extractor processes
> - Validation Enrichment Pattern enables single data flow (parse → validate → extract)
> - ParsedFileCache ensures single-parse guarantee across validation and extraction phases

#### Required Reading
- [CLI Orchestrator Implementation Guide](../../component-guides/CLI%20Orchestrator%20Implementation%20Guide.md)
- [Content Extractor Implementation Guide](../../component-guides/Content%20Extractor%20Implementation%20Guide.md)
- [Citation Validator.Public Contracts](../../component-guides/CitationValidator%20Implementation%20Guide.md#Public%20Contracts)
- [Architecture Guidance: Directory and Naming Conventions](../../../../../design-docs/Architecture%20-%20Baseline.md#Level%204%20Code)
- [Architecture Guidance: Coding Standards and Conventions](../../../../../design-docs/Architecture%20-%20Baseline.md#Coding%20Standards%20and%20Conventions)
- [Architecture Guidance: Testing Strategy](../../../../../design-docs/Architecture%20-%20Baseline.md#Testing%20Strategy)

---

### Story 2.4 Implement `extract header` Subcommand

**As a** developer creating context packages for AI,
**I want** a new `extract header` subcommand that extracts content from a specific header in a target file,
**so that** I can directly extract a section without needing to create a link in a source document.

#### Story 2.4 Acceptance Criteria

1. A new `extract header` subcommand SHALL be implemented in the citation-manager CLI with signature: `extract header <target-file> "<header-name>" [options]`. ^US2-4AC1
2. The `extract header` subcommand SHALL support options for controlling extraction behavior, including scope for file resolution and output formatting. ^US2-4AC2
3. WHEN the `extract header` subcommand executes, THEN it SHALL create a synthetic enriched link structure representing the target file and header, bypassing the link discovery phase from the source file workflow. ^US2-4AC3
4. The subcommand SHALL leverage the ContentExtractor component by passing the synthetic link structure through the same extraction pipeline used by `extract links`, ensuring consistent behavior and code reuse. ^US2-4AC4
5. GIVEN the `extract header` subcommand executes, WHEN the target file or header cannot be found, THEN appropriate errors SHALL be reported to the user with clear diagnostic information. ^US2-4AC5
6. GIVEN the target file and header exist and are accessible, WHEN content extraction succeeds, THEN the subcommand SHALL output the extracted content structure to stdout and exit with status code 0. ^US2-4AC6
7. GIVEN extraction fails, WHEN the target file is inaccessible or the header does not exist, THEN the subcommand SHALL exit with a non-zero status code to signal failure. ^US2-4AC7
8. The `extract header` subcommand SHALL be implemented without affecting existing command functionality, maintaining backward compatibility with `validate` and `extract links` commands. ^US2-4AC8
9. GIVEN the `extract header` subcommand is implemented, WHEN CLI integration tests execute with real fixture files, THEN they SHALL validate the complete workflow from target file and header specification to successful extraction output. ^US2-4AC9
10. The citation-manager help text SHALL document the `extract header` subcommand at both levels: top-level help (`extract --help` or `extract -h`) SHALL include `header` in the subcommands list, and subcommand help (`extract header --help` or `extract header -h`) SHALL provide detailed usage, options, and examples for direct extraction workflows. ^US2-4AC10

**Implementation Notes - Synthetic Link Pattern:**
The CLI implements synthetic link creation as an internal orchestration detail using LinkObjectFactory (Level 4 code):
1. **Phase 1 (Create)**: Instantiate `LinkObjectFactory` and call `createHeaderLink(targetFile, header)` to build unvalidated LinkObject
2. **Phase 2 (Validate)**: Pass synthetic link to `citationValidator.validateSingleCitation(syntheticLink)` to enrich with validation metadata
3. **Phase 3 (Extract)**: Pass validated link array to `contentExtractor.extractContent([validatedLink], options)`
4. **Phase 4 (Output)**: Output deduplicated result structure to stdout

The synthetic LinkObject contains: `{ linkType, scope, anchorType: "header", target: { path, anchor }, validation: null }`. After validation, `validation` is populated with `{ status: "valid"|"error", error?, suggestion? }`. See [Epic 2 Whiteboard - LinkObjectFactory](#LinkObjectFactory%20(Level%204%20Code%20Detail%20of%20CLI%20Orchestrator)) for factory contracts.

> [!warning] **Technical Lead Feedback**: Implementation Notes
> - The CLI orchestrator creates a synthetic `LinkObject` structure with required properties: `target.path.absolute` (resolved target file), `target.anchor` (header name), `anchorType: "header"`, and `validation: { status: "valid" }`
> - This synthetic link bypasses CitationValidator's `validateFile()` call but still uses `parsedFileCache.resolveParsedFile()` to parse the target
> - The synthetic link is passed to ContentExtractor's eligibility analysis and content retrieval phases, ensuring consistent behavior with `extract links`
> - No deduplication occurs (single link), but the output structure remains consistent with the `OutgoingLinksExtractedContent` schema

_Depends On_: [Story 2.3: Implement `extract links` Subcommand](#Story%202.3%20Implement%20extract%20links%20Subcommand)
_Enables_: Future enhancement - `extract` subcommand variants for blocks, full files
_Functional Requirements_: [[#^FR5|FR5]], [[#^FR7|FR7]]
_Architecture Workflow Reference_: [ContentExtractor Workflow Component Interaction](../../component-guides/Content%20Extractor%20Implementation%20Guide.md#ContentExtractor%20Workflow%20Component%20Interaction)
_User Story Link_:
_Status_: Pending

#### Required Reading
- [Extract Header Command Contract (US2.4)](../../component-guides/CLI%20Orchestrator%20Implementation%20Guide.md#Extract%20Header%20Command%20Contract%20(US2.4))
- [Extract Header Command Psuedocode (US2.4)](../../component-guides/CLI%20Orchestrator%20Implementation%20Guide.md#Extract%20Header%20Command%20Psuedocode%20(US2.4))
- [Content Extractor Implementation Guide](../../component-guides/Content%20Extractor%20Implementation%20Guide.md) %% force-extract %%
- [Epic 2 Whiteboard - LinkObjectFactory](#LinkObjectFactory%20(Level%204%20Code%20Detail%20of%20CLI%20Orchestrator))
- [Citation Validator.Public Contracts](../../component-guides/CitationValidator%20Implementation%20Guide.md#Public%20Contracts)
- [Architecture Guidance: Directory and Naming Conventions](../../../../../design-docs/Architecture%20-%20Baseline.md#Level%204%20Code)
- [Architecture Guidance: Coding Standards and Conventions](../../../../../design-docs/Architecture%20-%20Baseline.md#Coding%20Standards%20and%20Conventions)
- [Architecture Guidance: Testing Strategy](../../../../../design-docs/Architecture%20-%20Baseline.md#Testing%20Strategy)

---

### Story 2.5 - Implement `extract file` Subcommand

**As a** developer creating context packages for AI,
**I want** a subcommand to extract an entire file's content directly,
**so that** I can extract full files without creating a source document containing links.

#### Story 2.5 Acceptance Criteria

1. A new `extract file` subcommand SHALL be implemented in the citation-manager CLI with signature: `extract file <target-file> [options]`. ^US2-5AC1
2. WHEN the user executes the subcommand with a target file path, THEN the system SHALL extract the complete content of the target file. ^US2-5AC2
3. The subcommand SHALL support scope options for file resolution consistent with other extract subcommands. ^US2-5AC3
4. WHEN the target file cannot be found or accessed, THEN appropriate errors SHALL be reported with diagnostic information. ^US2-5AC4
5. WHEN extraction succeeds, THEN the system SHALL output results in the standard extraction output format and exit with status code 0. ^US2-5AC5
6. WHEN extraction fails, THEN the system SHALL exit with a non-zero status code. ^US2-5AC6
7. The `extract file` subcommand SHALL be documented in citation-manager help output alongside `extract links` and `extract header` subcommands. ^US2-5AC7

**Implementation Notes - Synthetic Link Pattern for Full Files:**
The CLI implements synthetic link creation for full-file extraction using LinkObjectFactory (Level 4 code):
1. **Phase 1 (Create)**: Instantiate `LinkObjectFactory` and call `createFileLink(targetFile)` to build unvalidated LinkObject with `anchorType: null`
2. **Phase 2 (Validate)**: Pass synthetic link to `citationValidator.validateSingleCitation(syntheticLink)` to enrich with validation metadata
3. **Phase 3 (Extract)**: Pass validated link array to `contentExtractor.extractContent([validatedLink], { ...options, fullFiles: true })` - note `fullFiles: true` flag enables CliFlagStrategy to make full-file links eligible
4. **Phase 4 (Output)**: Output deduplicated result structure to stdout

The synthetic LinkObject contains: `{ linkType, scope, anchorType: null, target: { path }, validation: null }`. The `fullFiles: true` flag reuses existing CliFlagStrategy without hardcoding extraction markers in CLI. See [Epic 2 Whiteboard - LinkObjectFactory](#LinkObjectFactory%20(Level%204%20Code%20Detail%20of%20CLI%20Orchestrator)) for factory contracts.

> [!note] **Technical Lead Feedback**: Implementation Approach for extract file
>
> **Suggested Approach**: Create synthetic link structure with `anchorType: null` and pass `{ fullFiles: true }` flag to ContentExtractor. This enables extraction through existing CliFlagStrategy without introducing marker coupling.
>
> **Rationale**: Reuses existing full-file extraction eligibility logic (CliFlagStrategy), avoids hardcoding extraction markers in CLI layer, maintains clean separation between CLI orchestration and eligibility rules.
>
> **Architecture Impact**: No changes to ContentExtractor or eligibility strategies required. CLI creates pre-validated synthetic link and enables flag that makes full-file links eligible.

_Depends On_: [Story 2.4: Implement `extract header` Subcommand](#Story%202.4%20Implement%20extract%20header%20Subcommand)
_Functional Requirements_: [[#^FR7|FR7]], [[#^FR12|FR12]]
_Status_: ✅ COMPLETE (2025-10-30)

---

### Story 2.6 Add Comprehensive Help Documentation to CLI Commands

**As a** user of the citation-manager CLI,
**I want** comprehensive help documentation for each command,
**so that** I can understand command usage, options, and behavior without external documentation.

#### Story 2.6 Acceptance Criteria

1. WHEN the user requests help for the `validate` command, THEN the system SHALL display comprehensive usage information including description, all options with explanations, usage examples, and exit codes. ^US2-6AC1
2. WHEN the user requests help for the `ast` command, THEN the system SHALL display comprehensive usage information including description, output structure documentation, and use case examples. ^US2-6AC2
3. WHEN the user requests help for the `extract` command, THEN the system SHALL display subcommand list with brief descriptions at the top level. ^US2-6AC3
4. WHEN the user requests help for extract subcommands (`extract links`, `extract header`, `extract file`), THEN each SHALL display detailed usage, options, and examples specific to that workflow. ^US2-6AC4
5. Help documentation SHALL be accessible via standard help flags (`--help` or `-h`) for each command and subcommand. ^US2-6AC5

_Depends On_: [Story 2.5: Implement `extract file` Subcommand](#Story%202.5%20Implement%20extract%20file%20Subcommand)
_Status_: Pending

---

### Story 2.7: Remove Deprecated base-paths Command

**As a** maintainer of the citation-manager codebase,
**I want** to remove the deprecated `base-paths` command and related functionality,
**so that** the codebase reflects that LinkObjects now contain base path information directly.

#### Story 2.7 Acceptance Criteria

1. The `base-paths` CLI command SHALL be removed from the citation-manager command registry. ^US2-7AC1
2. The `CitationManager.extractBasePaths()` method SHALL be removed from the CitationManager class. ^US2-7AC2
3. WHEN the full test suite executes after removal, THEN all tests SHALL pass with zero regressions. ^US2-7AC3
4. Helper methods used by the `fix` command (`parseAvailableHeaders`, `normalizeAnchorForMatching`, `findBestHeaderMatch`, `urlEncodeAnchor`) SHALL be retained until Epic 3 refactoring. ^US2-7AC4

**Rationale**: The `base-paths` command was originally designed to extract distinct file paths from citations. With the Validation Enrichment Pattern (US1.8), LinkObjects now include `target.path.absolute` directly in the validation results, making a separate extraction command redundant. Users can obtain base paths by parsing the `links` array from `ValidationResult`.

> [!warning] **Technical Lead Feedback**: Deprecation vs Breaking Change
>
> **Impact**: This is a breaking change for any users relying on the `base-paths` command in automation scripts or workflows.
>
> **Migration Path**: Users should update scripts to:
>
> ```bash
> # Old approach
> citation-manager base-paths file.md --format json
>
> # New approach
> citation-manager validate file.md --format json | jq '.links[].target.path.absolute' | sort -u
> ```
>
> **Alternative**: Consider deprecation warning in version N, removal in version N+1 if versioning strategy exists.

_Depends On_: None (cleanup of pre-existing functionality)
_Closes Technical Debt_: Redundant base-paths extraction command
_Status_: Pending

### Epic 2 Whiteboard

#### Architectural Decision: ContentExtractor Responsibility Boundaries

##### Problem Statement

During Epic 2 design, we identified an architectural tension around ContentExtractor's responsibilities. The initial design had ContentExtractor orchestrating validation internally, which created the following issues:

**Architectural Violations:**
- **Low Cohesion**: ContentExtractor doing link discovery (via validator), synthetic link creation, eligibility analysis, AND content extraction
- **High Coupling**: ContentExtractor directly coupled to CitationValidator, knowing about validation workflow
- **Single Responsibility Violation**: One component handling multiple distinct concerns
- **Extension Fragility**: Adding new extraction modes (e.g., `extract block`) requires modifying ContentExtractor core

##### Final Decision: Separation of Concerns via Orchestration

**DECISION**: Create three focused components with single responsibilities, orchestrated by CLI:

1. **LinkObjectFactory** (NEW) - Creates unvalidated LinkObjects from CLI inputs
2. **CitationValidator** (EXISTING) - Validates and enriches LinkObjects
3. **ContentExtractor** (REFACTORED) - Extracts content from validated LinkObjects
4. **CLI Orchestrator** (ENHANCED) - Coordinates workflow between components

---

#### Component Responsibilities

##### LinkObjectFactory (Level 4 Code Detail of CLI Orchestrator)

**Location**: `tools/citation-manager/src/factories/LinkObjectFactory.js`

**Single Responsibility**: Construct LinkObjects from CLI command parameters

**C4 Architecture Level**: Level 4 (Code) - Implementation detail of the Level 3 `CLI Orchestrator` Component

**Architectural Justification**:
- The factory's _only_ role is to support the `CLI Orchestrator`'s job
- It adapts simple string inputs from the command line (e.g., `<target-file>`, `<header>`) into the complex `LinkObject` data contract
- This makes it an internal helper of the orchestration logic, not a standalone component
- The CLI is the _only_ component that will ever use this factory, making it part of the CLI's "grouping of related functionality"
- Should NOT appear as a separate box on Level 3 component diagrams (would clutter the view)

**Public Methods**:

```javascript
createHeaderLink(targetPath, headerName): LinkObject
  // Returns: { linkType, scope, anchorType: "header", target: { path, anchor }, validation: null }

createFileLink(targetPath): LinkObject
  // Returns: { linkType, scope, anchorType: null, target: { path }, validation: null }
```

**Boundaries**:
- ✅ Creates LinkObject data structures
- ✅ Handles path normalization for target files
- ❌ Does NOT validate (no file system access)
- ❌ Does NOT extract content
- ❌ Does NOT apply eligibility rules

**Cohesion**: HIGH - single purpose (LinkObject construction), tightly cohesive with CLI Orchestrator
**Coupling**: LOW - zero external dependencies, pure data construction, only used by CLI Orchestrator

---

##### CitationValidator (EXISTING - No Changes)

**Location**: `tools/citation-manager/src/CitationValidator.js`

**Single Responsibility**: Validate LinkObjects and enrich with validation metadata

**Key Method** (already exists):

```javascript
async validateSingleCitation(link, contextFile?): Promise<EnrichedLinkObject>
  // 1. Calls parsedFileCache.resolveParsedFile(link.target.path)
  // 2. Uses ParsedDocument.hasAnchor() to check anchor existence
  // 3. Enriches link.validation = { status: "valid"|"error", error?, suggestion? }
  // 4. Returns enriched LinkObject
```

**Boundaries**:
- ✅ Validates file existence, anchor existence, path validity
- ✅ Uses ParsedFileCache for parsing (delegates to infrastructure)
- ✅ Enriches LinkObjects with validation metadata
- ❌ Does NOT create LinkObjects (receives them as input)
- ❌ Does NOT extract content (only validates it exists)

**Cohesion**: HIGH - focused on validation logic only
**Coupling**: LOW - depends on ParsedFileCache (infrastructure) and LinkObject contract (data)

**Key Insight**: Validation REQUIRES parsing. The validator must parse the target file to check if anchors exist. This is appropriate responsibility, and ParsedFileCache ensures efficiency (single parse shared with extractor).

---

##### ContentExtractor (REFACTORED)

**Location**: `tools/citation-manager/src/core/ContentExtractor/ContentExtractor.js`

**Single Responsibility**: Extract content from validated LinkObjects

**Public Method** (CHANGED):

```javascript
async extractContent(enrichedLinks: LinkObject[], cliFlags): Promise<OutgoingLinksExtractedContent>
  // 1. Filters links: skip if link.validation.status === "error"
  // 2. Analyzes eligibility using strategy chain
  // 3. Retrieves content from parsedFileCache (cache hit!)
  // 4. Deduplicates content using SHA-256 hashing
  // 5. Returns OutgoingLinksExtractedContent structure
```

**Dependencies** (CHANGED):

```javascript
constructor(eligibilityStrategies, parsedFileCache)
  // REMOVED: citationValidator dependency
```

**Boundaries**:
- ✅ Extracts content from validated LinkObjects
- ✅ Applies eligibility strategies (Strategy Pattern)
- ✅ Deduplicates extracted content
- ❌ Does NOT validate links (receives pre-validated links)
- ❌ Does NOT create synthetic links (receives links from caller)
- ❌ Does NOT parse files directly (delegates to ParsedFileCache)

**Cohesion**: HIGH - focused only on extraction, not validation or link creation
**Coupling**: LOW - depends on LinkObject contract (data), not on CitationValidator

---

##### CLI Orchestrator (ENHANCED)

**Location**: `tools/citation-manager/src/citation-manager.js`

**Responsibility**: Coordinate workflow between Factory, Validator, and Extractor

**Pattern for `extract links` subcommand** (see [[#^US2-3AC3|US2.3 AC3]], [[#^US2-3AC4|AC4]]):

```javascript
program
  .command('extract links <source-file>')
  .action(async (sourceFile, options) => {
    // Phase 1: Discover and validate links in source file
    const validationResult = await citationValidator.validateFile(sourceFile);
    const enrichedLinks = validationResult.links; // Links with validation metadata

    // Phase 2: Extract content from validated links
    const result = await contentExtractor.extractContent(enrichedLinks, options);

    // Phase 3: Output results
    console.log(JSON.stringify(result));
  });
```

**Pattern for `extract header` subcommand**:

```javascript
program
  .command('extract header <target-file> <header>')
  .action(async (targetFile, header, options) => {
    // Phase 1: Create synthetic link
    const linkFactory = new LinkObjectFactory();
    const syntheticLink = linkFactory.createHeaderLink(targetFile, header);

    // Phase 2: Validate the synthetic link
    const validatedLink = await citationValidator.validateSingleCitation(syntheticLink);

    // Phase 3: Extract content (if valid)
    const result = await contentExtractor.extractContent([validatedLink], options);

    // Phase 4: Output results
    console.log(JSON.stringify(result));
  });
```

**Pattern for `extract file` subcommand**:

```javascript
program
  .command('extract file <target-file>')
  .action(async (targetFile, options) => {
    // Phase 1: Create synthetic link
    const linkFactory = new LinkObjectFactory();
    const syntheticLink = linkFactory.createFileLink(targetFile);

    // Phase 2: Validate the synthetic link
    const validatedLink = await citationValidator.validateSingleCitation(syntheticLink);

    // Phase 3: Extract content (force full-files flag for file extraction)
    const result = await contentExtractor.extractContent([validatedLink], { ...options, fullFiles: true });

    // Phase 4: Output results
    console.log(JSON.stringify(result));
  });
```

**Boundaries**:
- ✅ Translates CLI commands to component calls
- ✅ Orchestrates workflow: Factory → Validator → Extractor
- ✅ Handles output formatting (JSON to stdout)
- ✅ Manages error reporting and exit codes
- ❌ Does NOT contain business logic (delegates to components)

**Cohesion**: MODERATE - orchestration is inherently cross-cutting
**Coupling**: MODERATE - knows about all components, but only through interfaces

---

#### Why This Design Is Correct

##### Architecture Principles Alignment

✅ **Single Responsibility** (Principles.md#^single-responsibility)
- Factory creates links, Validator validates links, Extractor extracts content, CLI orchestrates
- No component does another's job

✅ **Loose Coupling, Tight Cohesion** (Principles.md#^loose-coupling-tight-cohesion)
- Components interact only through LinkObject data contract
- Changes to validation logic don't affect extraction logic
- Shared dependency is ParsedFileCache (infrastructure, not business logic)

✅ **Black Box Interfaces** (Principles.md#^black-box-interfaces)
- Each component exposes clean API
- Implementation details hidden
- Consumers depend on interfaces, not implementations

✅ **Extension Over Modification** (Principles.md#^extension-over-modification)
- Add new extraction mode: extend Factory + add strategy + add CLI command
- No modification to Validator or Extractor core logic

✅ **Data Model First** (Principles.md#^data-model-first)
- LinkObject is central data primitive
- Pure data transformation pipeline: unvalidated → validated → extracted

✅ **One Source of Truth** (Principles.md#^one-source-of-truth)
- ParsedFileCache is authoritative for parsed content
- Both Validator and Extractor use same cache (efficiency win)

✅ **Service Layer Separation** (Principles.md#^service-layer-separation)
- Presentation: CLI (user I/O)
- Business Logic: Validator, Extractor (domain operations)
- Data Access: ParsedFileCache, ParsedDocument (file I/O)

##### The Single-Parse Guarantee

**Key Efficiency Win**: ParsedFileCache ensures files are parsed once, even though both Validator and Extractor need the parsed content.

**Workflow**:

1. CLI calls `citationValidator.validateSingleCitation(syntheticLink)`
2. Validator calls `parsedFileCache.resolveParsedFile(targetFile)` → **Parse #1**
3. Validator uses ParsedDocument to check anchor existence
4. CLI calls `contentExtractor.extractContent([validatedLink])`
5. Extractor calls `parsedFileCache.resolveParsedFile(targetFile)` → **Cache Hit! No Parse**
6. Extractor uses ParsedDocument to extract content

**Result**: Single parse, two consumers. This is elegant architectural reuse.

---

#### Trade-offs Accepted

| Aspect | Benefit | Cost | Verdict |
|--------|---------|------|---------|
| **CLI Orchestration** | Business logic components stay simple | CLI coordinates 3-4 component calls | ✅ Correct - orchestration belongs in presentation layer |
| **Shared Cache** | Eliminates double-parsing (major perf win) | Validator and Extractor share infrastructure dependency | ✅ Appropriate - cache is infrastructure, like a database |
| **Explicit Validation** | Fail-fast with clear errors, separation of concerns | Extra method call before extraction | ✅ Worth it - validation should be explicit |
| **LinkObjectFactory** | CLI doesn't know LinkObject structure details | Additional component to maintain | ✅ Small component, high value (encapsulation) |

**Net Assessment**: Benefits significantly outweigh costs. Trade-offs align with architecture principles.

---
#### Conclusion

This architectural decision achieves **low coupling, high cohesion** while:

- ✅ Reusing existing infrastructure (ParsedFileCache, validateSingleCitation)
- ✅ Avoiding double-parsing through intelligent caching
- ✅ Maintaining clear separation of concerns
- ✅ Supporting fail-fast error handling
- ✅ Enabling extension without modification

The design is **ready for implementation**. Follow the Next Steps checklist to update all documentation before beginning US2.X (LinkObjectFactory) implementation.

---

## Epic 3: Markdown Parser Refactoring for Flavor Extensibility

This epic focuses on a significant architectural improvement to the `MarkdownParser`. Its goal is to replace the current hybrid parsing model with a fully token-based, extensible architecture that will serve as the engine for the `MarkdownFlavorService`, enabling support for multiple markdown syntaxes.

---

### Story 3.1: Research and POC for a Pluggable Parser Engine

**As a** developer, **I want** to evaluate `micromark` and its extensions to prove it can serve as the engine for our `MarkdownFlavorService`, **so that** I can confirm we can generate the `MarkdownParser.Output.DataContract` for the "obsidian" flavor without custom regex.

#### Acceptance Criteria
1. GIVEN a proof-of-concept script using `micromark` and its Obsidian extensions, WHEN it's run on our test fixtures, THEN it SHALL produce a `MarkdownParser.Output.DataContract` that is structurally identical to the one from our current parser.
2. The proof-of-concept SHALL successfully parse all existing link and anchor types using a single, token-based pass, demonstrating it can replace our custom regex patterns.
3. The output from the proof-of-concept SHALL pass all tests in `parser-output-contract.test.js`, confirming zero regressions in the data contract.
4. A research summary SHALL document how this new engine will be configured and controlled by the future `MarkdownFlavorService`.

_Closes Technical Debt_: [Double-Parse Anti-Pattern](https://www.google.com/search?q=tools/citation-manager/design-docs/component-guides/Markdown%2520Parser%2520Implementation%2520Guide.md%23Performance%2520Double-Parse%2520Anti-Pattern) (Validation Phase)

---

### Story 3.2: Implement `MarkdownFlavorService` and Refactor Parser

**As a** developer, **I want** to implement the `MarkdownFlavorService` and refactor the `MarkdownParser` to use the new `micromark` engine, **so that** the parser's logic is driven by the flavor configuration provided by the service.

#### Story 3.2 Acceptance Criteria
1. A new `MarkdownFlavorService` component SHALL be created at `src/services/MarkdownFlavorService.js`.
2. The `MarkdownFlavorService` SHALL be responsible for providing the correct set of `micromark` extensions for a given flavor (starting with "obsidian").
3. The internal logic of the `MarkdownParser` SHALL be replaced with the new `micromark`-based implementation.
4. The `MarkdownParser` SHALL be refactored to request and use the parsing extensions from the `MarkdownFlavorService`.
5. GIVEN the refactoring is complete, WHEN the full test suite is executed, THEN all 114+ existing tests SHALL pass, confirming zero behavioral regressions.
6. The "Double-Parse Anti-Pattern" technical debt item SHALL be marked as "RESOLVED" in all architecture documentation.

_Depends On_: "Story: Research and POC for a Pluggable Parser Engine" _Closes Technical Debt_: [Double-Parse Anti-Pattern](https://www.google.com/search?q=tools/citation-manager/design-docs/component-guides/Markdown%2520Parser%2520Implementation%2520Guide.md%23Performance%2520Double-Parse%2520Anti-Pattern) (Implementation and Documentation Phase)

---

## Related Documentation

- [Content Aggregation Architecture](content-aggregation-architecture.md) - Feature-specific architectural enhancements
- [Workspace PRD](../../../../../design-docs/features/20250928-cc-workflows-workspace-scaffolding/cc-workflows-workspace-prd.md) - Parent workspace requirements
- [Workspace Architecture](../../../../../design-docs/features/20250928-cc-workflows-workspace-scaffolding/cc-workflows-workspace-architecture.md) - Workspace architectural context

---
## Whiteboard
