---
title: "User Story 2.1: Implement Extraction Eligibility using Strategy Pattern"
feature-title: Citation Manager Content Aggregation
epic-number: 2
epic-name: Content Extraction Component
epic-url: ../../content-aggregation-prd.md#Epic%202%20Content%20Extraction%20Component
user-story-number: 2.1
status: Pending
---

# Story 2.1: Implement Extraction Eligibility using Strategy Pattern

<critical-llm-initialization-instructions>
When first reading this file, you MUST IMMEDIATELY run citation manager to extract base paths: `npm run citation:base-paths "this-file-path" -- --format json`. Read ALL discovered base path files to gather complete architectural context before proceeding.
</critical-llm-initialization-instructions>

## Story

**As a** developer creating context packages for an AI,
**I want** to use link-level markers (`%%extract-link%%`, `%%stop-extract-link%%`) to override the default content extraction behavior,
**so that** I can have fine-grained control and create precisely tailored context for my prompts.

_Source: [Story 2.1: Implement Extraction Eligibility using Strategy Pattern](../../content-aggregation-prd.md#Story%202.1%20Implement%20Extraction%20Eligibility%20using%20Strategy%20Pattern)_

## Acceptance Criteria
1. GIVEN a link points to a full file (no anchor), WHEN the `--full-files` flag is **not** present, THEN the default eligibility decision SHALL be `ineligible`. ^US2-1AC1
2. GIVEN a link points to a specific section or block (has an anchor), THEN the default eligibility decision SHALL be `eligible`. ^US2-1AC2
3. GIVEN a full-file link has a `%%extract-link%%` marker on the same line, THEN its eligibility SHALL be overridden to `eligible`, even without the `--full-files` flag. ^US2-1AC3
4. GIVEN a section or block link has a `%%stop-extract-link%%` marker on the same line, THEN its eligibility SHALL be overridden to `ineligible`. ^US2-1AC4
5. The marker-based rules (`%%extract-link%%`, `%%stop-extract-link%%`) SHALL have the highest precedence, overriding both default behaviors and the `--full-files` CLI flag. ^US2-1AC5
6. The eligibility logic SHALL be implemented using the **Strategy Pattern**, with each rule (e.g., `StopMarkerStrategy`, `CliFlagStrategy`) encapsulated in its own component, as defined in the architecture. ^US2-1AC6

_Source: [Story 2.1 Acceptance Criteria](../../content-aggregation-prd.md#Story%202.1%20Acceptance%20Criteria)_
_Depends On_: [Story 1.7: Implement ParsedDocument Facade](../../content-aggregation-prd.md#Story%201.7%20Implement%20ParsedDocument%20Facade)
_Requirements_: [[../../content-aggregation-prd.md#^FR4|FR4]], [[../../content-aggregation-prd.md#^FR10|FR10]]
_Non-Functional Requirements_: [[../../content-aggregation-prd.md#^NFR6|NFR6]]

## Dev Notes

### Architectural Context (C4)

> [!help] Overview
> - **Creates** `ContentExtraction` component that contains the:
>   - `ExtractionEligibilityAnalyzer`
>   - `ExtractionStrategy` classes, which implement the eligibility rule logic using the Strategy Pattern.
> - **Updates**
>   - `MarkdownParser` to scan for extraction markers and add a new `extractionMarker` property to each `LinkObject`
>   - `CLI Orchestrator` to pass the `--full-files` flag to the new analyzer
> - **Leverages** the `ParsedDocument` facade (from US 1.7) to retrieve the enhanced `LinkObject`s that are fed into the eligibility analyzer.

### US 2.1 Scope

1. **Create** the `ContentExtractor` component structure following [Action-Based File Organization](../../../../../../design-docs/Architecture%20Principles.md#^action-based-file-organization-definition) principles:
    - `src/core/ContentExtractor/ContentExtractor.js` - Main component class (Component Entry Point, TitleCase)
    - `src/core/ContentExtractor/analyzeEligibility.js` - Supporting operation implementing strategy pattern (verb-noun, camelCase)
    - `src/core/ContentExtractor/eligibilityStrategies/` directory for strategy classes

2. **Create** strategy classes in `eligibilityStrategies/` subfolder (all TitleCase, behavior-as-data):
    - `ExtractionStrategy.js` - Base interface defining `getDecision(link, cliFlags)` contract
    - `StopMarkerStrategy.js` - Checks for `%%stop-extract-link%%` marker (highest precedence)
    - `ForceMarkerStrategy.js` - Checks for `%%extract-link%%` marker (second precedence)
    - `SectionLinkStrategy.js` - Default behavior for links with anchors
    - `CliFlagStrategy.js` - Evaluates `--full-files` CLI flag (lowest precedence)

3. The `analyzeEligibility` operation **orchestrates** the prioritized strategy chain:
    - Loops through strategies in precedence order
    - Returns first non-null decision: `{ eligible: boolean, reason: string }`
    - Falls back to default action if no strategy applies

4. **Update** the `MarkdownParser` to:
    - Detect `%%extract-link%%` and `%%stop-extract-link%%` markers on the same line as a link
    - Add `extractionMarker` property to `LinkObject` schema (values: `'force-extract'`, `'stop-extract'`, `null`)

5. **Update** the `CLI Orchestrator` to:
    - Instantiate `ContentExtractor` via factory
    - Pass the `--full-files` flag to the ContentExtractor
    - Handle extraction results for content aggregation workflow

6. **Update** `componentFactory.js` to:
    - Create `createContentExtractor()` factory function
    - Instantiate all strategy classes in precedence order
    - Inject strategy array into `ContentExtractor` constructor
    - Return configured component instance

### US2.1 Components Impacted

- [Content Extractor](../../content-aggregation-architecture.md#==Citation%20Manager.Content%20Extractor==)(CREATE)
  - Encapsulate extraction eligibility logic using the Strategy Pattern.
  - Orchestrate `Strategy` classes (`StopMarkerStrategy`, `ForceMarkerStrategy`, `SectionLinkStrategy`, `CliFlagStrategy`) to determine link eligibility.
  - Produce an `ExtractionJob` object with a decision (`{ eligible: boolean, reason: string }`) for each link.
-[Markdown Parser](../../content-aggregation-architecture.md#Citation%20Manager.Markdown%20Parser) (UPDATE)
  - Scan for `%%extract-link%%` and `%%stop-extract-link%%` markers on the same line as a link.
  - Add an `extractionMarker` property to the `LinkObject` schema in `MarkdownParser.Output.DataContract`.
- [CLI Orchestrator](../../content-aggregation-architecture.md#Citation%20Manager.CLI%20Orchestrator) (UPDATE)
  - Instantiate `ExtractionEligibility` analyzer via factory.
  - Pass the `--full-files` flag to the analyzer's `getDecision()` method.
- [Component Factory](../../content-aggregation-architecture.md#Level%204%20Code%20Organization)(UPDATE)
  - Create `createEligibilityAnalyzer()` factory function.
  - Instantiate all strategy classes in precedence order: `[StopMarkerStrategy, ForceMarkerStrategy, SectionLinkStrategy, CliFlagStrategy]`.
  - Inject strategy array into `ExtractionEligibility` constructor.

#### Implementation Guides
- [Content Extractor Implementation Guide](../../../../component-guides/Content%20Extractor%20Implementation%20Guide.md)
- [Markdown Parser Implementation Guide](../../../../component-guides/Markdown%20Parser%20Implementation%20Guide.md)
- [Extract Citation Content: Component Interaction Diagram](../../content-aggregation-architecture.md#Extract%20Citation%20Content%20Component%20Interaction%20Diagram)
- [Revised Recommendation: The Strategy Pattern](../../research/content-aggregation-architecture-whiteboard.md#Revised%20Recommendation%20The%20Strategy%20Pattern)

### Files Impacted

|File Path|Action|Description|Rationale & Requirements|
|---|---|---|---|
|`tools/citation-manager/src/core/ContentExtractor/ContentExtractor.js`|**(CREATE)**|Main component class orchestrating content extraction.|Component entry point (TitleCase, noun-based) per [Component Entry Point Priority](../../../component-guides/Content%20Extractor%20Implementation%20Guide.md#File%20Naming%20Conventions). Orchestrates eligibility analysis and content retrieval.|
|`tools/citation-manager/src/core/ContentExtractor/analyzeEligibility.js`|**(CREATE)**|Supporting operation implementing strategy pattern for eligibility analysis.|Supporting operation (camelCase, verb-noun) per [Action-Based File Organization](../../../../../../design-docs/Architecture%20Principles.md#^action-based-file-organization-definition). Orchestrates prioritized strategy chain execution.|
|`tools/citation-manager/src/core/ContentExtractor/eligibilityStrategies/ExtractionStrategy.js`|**(CREATE)**|Base interface class defining the contract for extraction eligibility strategies.|Required by [AC6](#^US2-1AC6) (Strategy Pattern). All concrete strategy classes extend this interface with a `getDecision(link, cliFlags)` method.|
|`tools/citation-manager/src/core/ContentExtractor/eligibilityStrategies/StopMarkerStrategy.js`|**(CREATE)**|Concrete strategy checking for `%%stop-extract-link%%` marker.|Highest precedence rule ([AC5](#^US2-1AC5)). Returns `{ eligible: false, reason: "..." }` when marker present, `null` otherwise.|
|`tools/citation-manager/src/core/ContentExtractor/eligibilityStrategies/ForceMarkerStrategy.js`|**(CREATE)**|Concrete strategy checking for `%%extract-link%%` marker.|Second-highest precedence rule ([AC5](#^US2-1AC5), [AC3](#^US2-1AC3)). Overrides default full-file behavior to force extraction.|
|`tools/citation-manager/src/core/ContentExtractor/eligibilityStrategies/SectionLinkStrategy.js`|**(CREATE)**|Concrete strategy for default section/block link behavior.|Returns `{ eligible: true }` when `link.anchorType` is not null ([AC2](#^US2-1AC2)), implementing default extraction for links with anchors.|
|`tools/citation-manager/src/core/ContentExtractor/eligibilityStrategies/CliFlagStrategy.js`|**(CREATE)**|Concrete strategy evaluating `--full-files` CLI flag.|Lowest precedence rule. Returns `{ eligible: true }` for full-file links when flag present, `{ eligible: false }` otherwise ([AC1](#^US2-1AC1)).|
|`tools/citation-manager/src/MarkdownParser.js`|**(UPDATE)**|Add marker detection logic in `extractLinks()` method.|Required by [FR10](../../content-aggregation-prd.md#^FR10), [NFR6](../../content-aggregation-prd.md#^NFR6). Scan for `%%extract-link%%` and `%%stop-extract-link%%` on same line as links. Add `extractionMarker` property to LinkObject schema (values: `'force-extract'`, `'stop-extract'`, `null`).|
|`tools/citation-manager/src/citation-manager.js`|**(UPDATE)**|CLI orchestrator to instantiate ContentExtractor and pass `--full-files` flag.|Required for Epic 2 integration. Create ContentExtractor via factory, invoke component methods for eligibility analysis and content extraction. Handle results for content aggregation workflow.|
|`tools/citation-manager/src/factories/componentFactory.js`|**(UPDATE)**|Add `createContentExtractor()` factory function.|Required by [AC6](#^US2-1AC6) and DI pattern. Instantiate ContentExtractor with strategy array in precedence order (StopMarkerStrategy, ForceMarkerStrategy, SectionLinkStrategy, CliFlagStrategy), return configured component instance.|
|`tools/citation-manager/design-docs/component-guides/Markdown Parser Implementation Guide.md`|**(UPDATE)**|Document `extractionMarker` property in `LinkObject` schema.|Required for contract documentation. Update `LinkObject` JSON schema with new `extractionMarker: string\|null` field. Add examples showing marker detection in parser output.|
