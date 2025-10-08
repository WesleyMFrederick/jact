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

_Depends On_: Story [Story 1.4a: Migrate citation-manager Test Suite to Vitest](#Story%201.4a%20Migrate%20citation-manager%20Test%20Suite%20to%20Vitest)
_Enables_: [Story 2.1: Enhance Parser to Handle Full-File and Section Links](#Story%202.1%20Enhance%20Parser%20to%20Handle%20Full-File%20and%20Section%20Links)
_Closes Technical Debt_: [Lack of Dependency Injection](content-aggregation-architecture.md#Lack%20of%20Dependency%20Injection)
_Functional Requirements_: [[#^FR2|FR2]], [[#^FR8|FR8]]
_User Story Link:_ [us1.4b-refactor-components-for-di](user-stories/us1.4b-refactor-components-for-di/us1.4b-refactor-components-for-di.md)

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
_User Story Link:_ [us1.5-implement-cache-for-parsed-files](user-stories/us1.5-implement-cache-for-parsed-files/us1.5-implement-cache-for-parsed-files.md)
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
<!-- -->
> [!success] **Technical Lead Research**: Section extraction POC validated ✅ (2025-10-07)
> _Research Objective_: Prove we can walk marked.js tokens to extract section content by heading level
> _POC Location_: `tools/citation-manager/test/poc-section-extraction.test.js`
> _Key Findings_:
> - ✅ **Token walking works**: marked.js tokens provide complete AST for section boundary detection
> - ✅ **Boundary detection validated**: Algorithm correctly stops at next same-or-higher level heading
> - ✅ **Content reconstruction proven**: Concatenating `token.raw` properties rebuilds original markdown
> - ✅ **Nested sections handled**: H3/H4 subsections correctly included under parent H2
> _Implementation Pattern_: Use `walkTokens`-like traversal (mirrors `MarkdownParser.extractHeadings()` pattern at lines 321-343)
> _API Validated_: `extractSection(tokens, headingText, headingLevel)` → `{ heading: { level, text, raw }, tokens: [...], content: string }`
> _Context7 Research_: marked.js `walkTokens` API provides idiomatic pattern for token traversal (child tokens processed before siblings)
> _Production Integration Path_: Create `ContentExtractor` component accepting `ParsedFileCache` dependency, leverage existing token structure from Parser Output Contract
> _Test Coverage_: 7/7 POC tests passing (100% success rate)
> _Next Step_: Story 2.2 ContentExtractor implementation can use validated algorithm and API contract

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
<!-- -->
> [!success] **Technical Lead Research**: Parser-extractor data contract validated ✅ (2025-10-07)
> _Research Finding_: POC confirms ContentExtractor can consume Parser Output Contract directly without schema changes
> _Data Flow Validated_:
> 1. `ParsedFileCache.resolveParsedFile(filePath)` → Parser Output Contract (`{ tokens, headings, content, ... }`)
> 2. `ContentExtractor.extractSection(tokens, headingText, headingLevel)` → Section data (`{ heading, tokens, content }`)
> 3. No parser modifications needed - existing token structure sufficient
> _Interaction Model_: ContentExtractor accepts `ParsedFileCache` as constructor dependency (DI pattern from US1.4b/US1.5)
> _Interface Contract_:
>
> ```javascript
> class ContentExtractor {
>   constructor(parsedFileCache) { ... }
>   async extractSection(filePath, headingText, headingLevel) {
>     const parsed = await this.parsedFileCache.resolveParsedFile(filePath);
>     return this.extractSectionFromTokens(parsed.tokens, headingText, headingLevel);
>   }
>   async extractFullFile(filePath) {
>     const parsed = await this.parsedFileCache.resolveParsedFile(filePath);
>     return { content: parsed.content, tokens: parsed.tokens, metadata: {...} };
>   }
> }
> ```
>
> _Metadata Structure_: `{ sourceFile: string, section: string|null, heading: object|null, lineRange: {start, end} }`
> _POC Reference_: See `tools/citation-manager/test/poc-section-extraction.test.js` for validated extraction algorithm
<!-- -->
> [!success] **Technical Lead Research**: Block anchor extraction POC validated ✅ (2025-10-07)
> _Research Objective_: Prove we can extract single block content by `^anchor-id` references
> _POC Location_: `tools/citation-manager/test/poc-block-extraction.test.js`
> _Key Findings_:
> - ✅ **Anchor detection works**: `MarkdownParser.extractAnchors()` correctly identifies all `^anchor-id` patterns at line endings
> - ✅ **Line-based extraction validated**: Can extract single line/paragraph using anchor's `line` number from Parser Output Contract
> - ✅ **Anchor metadata accurate**: Line numbers, column positions, and IDs correctly populated in `anchors` array
> - ✅ **Multiple block types handled**: Works for paragraphs, headings, list items across different sections
> _Block Anchor Formats Supported_:
> 1. Obsidian block references: `Some content ^anchor-id` (end of line)
> 2. Caret syntax: `^anchor-id` anywhere in line (legacy)
> 3. Emphasis-marked: `==**text**==` (creates implicit anchor)
> _API Validated_: `extractBlock(content, anchors, blockId)` → `{ anchor: { anchorType, id, line, column }, content: string, lineNumber: number }`
> _Key Difference from Sections_: Blocks extract ONLY single line/paragraph (not multi-line), uses line number lookup (not token walking)
> _Production Integration Path_: ContentExtractor needs both `extractSection()` and `extractBlock()` methods to handle header vs block anchors
> _Test Coverage_: 9/9 POC tests passing (100% success rate)
> _Implementation Note_: Current POC extracts single line; production may need paragraph boundary detection for multi-line blocks

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

Epic 2 Evaluation: Content Aggregation Enhancement

  Application Tech Lead Assessment

  Let me analyze Epic 2's current state and readiness for implementation.

  ---
  1. Relevance Assessment ✅ STILL HIGHLY RELEVANT

  Business Value Validation:
- Problem: Manual context assembly for LLM prompts is time-consuming and error-prone
- Solution: Automated content extraction and aggregation from markdown citations
- Impact: US1.5 cache implementation validates this need - the cache was built specifically to support Epic 2's content extraction operations efficiently

  Strategic Alignment:
- ✅ Leverages workspace framework (Epic 1 complete)
- ✅ Builds on validated DI patterns (US1.4b complete)
- ✅ Uses performance foundation (US1.5 cache complete)
- ✅ Aligns with "Refined, Repeatable, Robust" vision

  Verdict: Epic 2 remains strategically critical. The preparatory work (Epic 1) validates the architecture can support this feature.

  ---
  1. Gap Analysis 🔴 SIGNIFICANT GAPS IDENTIFIED

  2.1 Technical Design Gaps (Active Feedback Items)

  Gap 1: Parser-Extractor Interaction Model (PRD line 84-87)
  Status: Active - Required before Story 2.2 implementation
  Impact: Architecture Impact - data structures between parser and extractor undefined

  Analysis:
- ParsedFileCache now returns Parser Output Contract with known schema
- ContentExtractor needs to consume this contract for content extraction
- Missing: Detailed interaction pattern between ContentExtractor and ParsedFileCache
- Risk: Without clear contract, Story 2.2 implementation will be ad-hoc

  Recommendation: Create ContentExtractor Implementation Guide BEFORE Story 2.1 starts, defining:
- Input contract: LinkObject structure (from parser)
- Output contract: ContentBlock structure (metadata + extracted content)
- Cache interaction: How ContentExtractor requests parsed data via ParsedFileCache

  ---
  Gap 2: CLI Interface Design (PRD line 89-92)
  Status: Active - Required before Story 2.3 implementation
  Decision: --extract-context flag on validate command vs new extract command?

  Analysis:
- Current: validate command for citation checking
- Proposed: Add --extract-context <output_file> flag to validate command
- Concern: Command overloading - validate + extract are distinct operations
- Alternative: New extract command with own options/flags

  Recommendation: Research CLI patterns (yargs, commander examples) and make explicit design decision before Story 2.3:
- Option A: citation:validate --extract-context out.md (flag approach)
- Option B: citation:extract <source.md> --output out.md (command approach)
- Decision criteria: Extensibility, user intuitiveness, maintenance burden

  ---
  2.2 Story-Level Gaps

  Gap 3: Story 2.1 Parser Schema Validation (PRD line 213-216)
  Note: Parser Output Contract validated in US1.5 Phase 1
  Remaining: Verify LinkObject schema sufficient for content extraction

  Analysis:
- US1.5 Task 1.1-1.3 validated Parser Output Contract base schema
- LinkObject structure: { linkType, scope, anchorType, source, target }
- Question: Does current schema distinguish full-file vs section links adequately?
- Current scope enum: internal | cross-document - does this suffice?
- Current anchorType enum: caret | heading | block - clear for extraction?

  Recommendation: Story 2.1 should start with schema gap analysis:
  1. Review LinkObject schema against Story 2.1 AC requirements
  2. Determine if existing linkType/scope/anchorType fields sufficient
  3. Identify any missing fields needed for content extraction metadata
  4. Document decision in Story 2.1 dev notes BEFORE implementation

  ---
  Gap 4: Content Extractor Public Contract (Architecture doc line 227-230)
  Input: LinkObject (from parser)
  Output: ContentBlock object { content, metadata }
  Missing: Detailed ContentBlock schema

  Analysis:
- ContentBlock structure undefined
- Metadata fields unspecified (source path? anchor? line range?)
- No pseudocode for extraction logic

  Recommendation: Create ContentExtractor Implementation Guide.md with:
- Detailed ContentBlock schema (JSON structure)
- Pseudocode for extractContent(linkObject) method
- Edge case handling (missing anchors, invalid ranges, etc.)
- Follow pattern from ParsedFileCache Implementation Guide

  ---
  1. Risk Identification 🟡 MODERATE TO HIGH RISKS

  3.1 Technical Risks

  Risk 1: Section Boundary Detection Complexity ⚠️ HIGH
- Challenge: Determining where a section ends is non-trivial
- Current Parser: Extracts headings but doesn't compute section boundaries
- Story 2.2 AC2: "Extract text between heading and next heading of equal/higher level"
- Complexity:
  - Nested heading levels (## vs ###)
  - Ambiguous markdown (missing blank lines)
  - Edge case: Last section in file (no "next heading")

  Mitigation Strategy:
  // Pseudocode concept for Story 2.2 planning
  function getSectionBoundary(headings, targetHeading) {
    const startIndex = findHeadingIndex(targetHeading);
    const startLevel = headings[startIndex].level;

    // Find next heading of equal or higher level
    for (let i = startIndex + 1; i < headings.length; i++) {
      if (headings[i].level <= startLevel) {
        return { start: headings[startIndex].line, end: headings[i].line - 1 };
      }
    }

    // Last section: extends to EOF
    return { start: headings[startIndex].line, end: contentEndLine };
  }

  Action Required: Story 2.2 Implementation Guide must include explicit algorithm for section boundary detection with test cases.

  ---
  Risk 2: Parser Output Contract Sufficiency ⚠️ MEDIUM
- Challenge: Current schema validated for validation use case, not extraction
- Gap: Story 2.1 may discover parser schema insufficient for content extraction metadata
- Impact: Could require parser schema refactoring mid-Epic 2

  Mitigation Strategy:
  1. Story 2.1 Phase 1: Schema gap analysis BEFORE implementation
  2. If gaps found: Add Task 2.1-X to extend schema (mini-refactoring)
  3. Update Parser Implementation Guide with schema extensions
  4. Validate schema changes don't break US1.5 cache integration

  Action Required: Story 2.1 must include explicit "Schema Validation" phase before content extractor implementation begins.

  ---
  Risk 3: Async Error Propagation Through New Components ⚠️ MEDIUM
- Context: US1.5 made CitationValidator async
- Challenge: ContentExtractor will also be async (uses ParsedFileCache)
- Complexity: Error handling chain: CLI → Validator → Cache → Parser → ContentExtractor
- Risk: Promise rejection handling gaps could cause silent failures

  Mitigation Strategy:
  // Ensure proper error propagation pattern
  async validateFile(filePath) {
    try {
      const parsed = await this.cache.resolveParsedFile(filePath);
      // ... validation logic ...
    } catch (error) {
      // Re-throw with context for CLI to handle
      throw new ValidationError(`Failed to parse ${filePath}`, { cause: error });
    }
  }

  Action Required: Story 2.2 Implementation Guide must document error handling contract and test error propagation paths.

  ---
  3.2 Integration Risks

  Risk 4: CLI Command Overloading ⚠️ MEDIUM
- Challenge: Adding --extract-context to validate command mixes concerns
- Impact: validate becomes dual-purpose (check citations OR extract content)
- User Confusion: What if both validation fails AND extraction requested?
- Maintenance: Single command with branching logic vs separate commands

  Mitigation Options:
- Option A (Flag approach): validate --extract-context
  - Pro: Fewer commands, extraction implies validation
  - Con: Command does two things, harder to extend
- Option B (Command approach): New extract command
  - Pro: Clear separation of concerns, extensible
  - Con: More commands, some functionality duplication

  Action Required: Story 2.3 MUST start with explicit CLI design decision documented as ADR.

  ---
  Risk 5: Cache Memory Pressure Under Extraction Workload ⚠️ LOW TO MEDIUM
- Context: ParsedFileCache stores full file content in memory
- Challenge: Content extraction may load MORE files than validation alone
- Example: Document with 50 citation links = 50 files in cache simultaneously
- Impact: Memory usage could spike on large documentation sets

  Current Mitigation (from US1.5):
- Ephemeral per-command cache (memory released after execution)
- Documented as acceptable for MVP scope
- Architecture doc notes monitoring strategy for Epic 2

  Action Required: Story 2.2 or 2.3 should include performance test validating cache behavior with large document sets (50+ linked files).

  ---
  1. Implementation Challenges 🔴 SIGNIFICANT CHALLENGES

  4.1 ContentExtractor Component Design

  Challenge 1: Token-Based vs Line-Based Extraction
- Parser provides: Token stream from marked library
- Challenge: Extract content between section boundaries
- Options:
    a. Line-based: Use heading line numbers, extract via string slicing
    b. Token-based: Walk token tree, extract tokens between boundaries

  Recommendation: Line-based approach for MVP
- Rationale: Simpler, leverages existing content and headings[].line fields
- ParsedFileCache already stores full content string
- Can optimize to token-based in future if needed

  Implementation Guidance (for Story 2.2 guide):
  // Pseudocode: Line-based section extraction
  function extractSection(parsedData, targetAnchor) {
    const { content, headings } = parsedData;
    const lines = content.split('\n');

    // Find target heading
    const targetHeading = headings.find(h => h.id === targetAnchor);
    if (!targetHeading) return null;

    // Find section boundary (next heading of equal/higher level)
    const boundary = getSectionBoundary(headings, targetHeading);

    // Extract lines between boundaries
    return lines.slice(boundary.start, boundary.end + 1).join('\n');
  }

  ---
  Challenge 2: Metadata Structure for Aggregation
- Question: What metadata does ContentExtractor return?
- Story 2.2 AC1: "Structured object containing extracted content and metadata"
- Undefined: What fields in metadata object?

  Recommendation: Define ContentBlock schema explicitly:
  // Proposed ContentBlock schema for Story 2.2
  {
    content: string,           // Extracted markdown content
    metadata: {
      sourceFile: string,      // Absolute path to source file
      anchor: string | null,   // Section anchor if applicable
      linkType: string,        // "full-file" | "section"
      lineRange: {             // Source line range
        start: number,
        end: number
      },
      extractedAt: string      // ISO timestamp
    }
  }

  Action Required: Story 2.2 Implementation Guide must define exact ContentBlock schema BEFORE implementation starts.

  ---
  4.2 Aggregation Logic (Story 2.3)

  Challenge 3: Output File Structure
- Story 2.3 AC2: "Content delineated by markdown header indicating origin"
- Challenge: How to format aggregated output?
- Questions:
  - Header format: ## File: path/to/source.md or # [path/to/source.md]?
  - Section headers: ## File: source.md#Section or ## Section (from source.md)?
  - Preserve original markdown structure or flatten?
  - Handle duplicate content from multiple links?

  Recommendation: Define explicit output format in Story 2.3 spec:
## Aggregated Content

## Source: design-docs/architecture.md

  [Full file content here...]

## Source: design-docs/prd.md#Requirements

  [Section content here...]

## Source: design-docs/prd.md#Goals

  [Another section content here...]

  Action Required: Story 2.3 should include output format specification and test fixtures showing expected format.

  ---
  Challenge 4: Circular Reference Handling
- Scenario: Document A links to Document B, Document B links to Document A
- Risk: Infinite extraction loop
- Story 2.1-2.3: No acceptance criteria addressing circular references

  Recommendation: Add circular reference detection:
  // Pseudocode: Circular reference detection
  function extractContext(sourceFile, visitedFiles = new Set()) {
    if (visitedFiles.has(sourceFile)) {
      throw new Error(`Circular reference detected: ${sourceFile}`);
    }

    visitedFiles.add(sourceFile);

    // Extract content from links...
    for (const link of links) {
      extractContext(link.target, visitedFiles);
    }
  }

  Action Required: Add acceptance criteria to Story 2.3: "WHEN circular reference detected, THEN system SHALL fail gracefully with descriptive error."

  ---
  1. Recommendations & Action Items

  Immediate Actions (Before Starting Story 2.1)

  1. Create ContentExtractor Implementation Guide 📝 HIGH PRIORITY
  - Define ContentBlock schema
  - Document pseudocode for section extraction
  - Specify cache interaction pattern
  - Include error handling contract
  1. Story 2.1 Phase 0: Schema Gap Analysis 🔍 HIGH PRIORITY
  - Review LinkObject schema against Story 2.1 requirements
  - Identify any missing fields for content extraction
  - Document schema validation results
  - Update Parser Implementation Guide if gaps found
  1. CLI Design Decision (ADR-002) 🎯 MEDIUM PRIORITY
  - Research CLI patterns (commander best practices)
  - Evaluate flag vs command approach
  - Document decision with rationale
  - Update Story 2.3 scope based on decision

  Story-Level Actions

  Story 2.1 Enhancements:
- Add Phase 0: Schema gap analysis
- Add AC addressing circular reference detection
- Specify full-file vs section link distinction criteria

  Story 2.2 Enhancements:
- Define ContentBlock schema explicitly
- Add section boundary detection algorithm to guide
- Include performance test for large content extraction
- Specify error handling for missing/invalid anchors

  Story 2.3 Enhancements:
- Define explicit output file format specification
- Add circular reference AC
- Include CLI integration tests for new command/flag
- Specify behavior when validation fails + extraction requested

  ---
  1. Overall Verdict

  Epic 2 Status: ✅ RELEVANT but 🟡 NOT READY FOR IMPLEMENTATION

  Blocking Issues:
  7. ContentExtractor component design incomplete (no implementation guide)
  8. CLI interface decision unmade (flag vs command)
  9. Missing explicit schemas (ContentBlock, output format)
  10. No circular reference handling strategy

  Estimated Preparation Work: 8-12 hours
- ContentExtractor Implementation Guide: 4-6 hours
- CLI Design ADR: 2-3 hours
- Story spec enhancements: 2-3 hours

  Recommendation: PAUSE Epic 2 implementation until preparation complete. The architectural foundation (US1.5 cache) is excellent, but jumping into Story 2.1 without clear component contracts will result in rework and technical debt.

  Next Step: Assign product-manager or application-tech-lead agent to complete preparation work before developer implementation begins.
