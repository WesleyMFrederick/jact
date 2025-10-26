# US2.2a: Implement Content Deduplication for ExtractionResults - Design Plan

**Status**: Design Complete - Ready for Implementation Planning
**Epic**: Epic 2 - Content Extraction Component
**Dependency**: US2.2 (Content Retrieval) - ✅ Complete
**Enables**: US2.3 (Extract Command)

---

## Overview

This story adds content-based deduplication to the ContentExtractor component, transforming intermediate extraction attempts into an indexed `ExtractionResult` structure that stores each unique piece of content only once. The primary goal is to minimize token usage in LLM context packages by eliminating redundant content when multiple links reference identical text. Deduplication is the default behavior of `extractLinksContent()`, not an optional variant.

**Key Insight**: Your test extraction showed 4,886 characters wasted across just 2 duplicates in a 40-link document. Content-based hashing detects and eliminates this waste automatically.

---

## Problem Statement

### Token Waste from Duplicate Content

When building LLM context packages from documentation, multiple links often reference the same content:
- Different links pointing to the same section
- Different files containing identical text
- Repeated references to foundational concepts

**Current Behavior** (US2.2): Each link produces a separate intermediate extraction attempt with full content, leading to massive duplication if not deduplicated.

**Impact**:
- Wasted LLM tokens (expensive)
- Slower processing (larger payloads)
- Reduced context window capacity
- Difficulty identifying unique vs duplicate content

---

## Solution Approach

### Content-Based Hashing Strategy

Transform extraction results using **SHA-256 content hashing**:

1. **Generate contentId**: Hash the extracted content string → truncated 16-char hex string
2. **Index unique content**: Store each unique piece of content once in `contentIndex`
3. **Create references**: Links point to content via `contentId` instead of embedding full text
4. **Track sources**: Each content entry tracks all source locations that produced it
5. **Calculate stats**: Aggregate metrics show deduplication effectiveness

### Architecture Principle: One Source of Truth

This follows the **One Source of Truth** principle from Architecture Principles:
> Keep an authoritative dataset with projections, not duplicates.

Content lives once in `contentIndex` (authoritative), referenced by multiple links (projections).

---

## Story Definition & Acceptance Criteria

**Full Story**: See [US2.2a in content-aggregation-prd.md](../../content-aggregation-prd.md#Story%202.2a%20Implement%20Content%20Deduplication%20for%20ExtractionResults)

**Key Acceptance Criteria**:
- AC2: SHA-256 hashing of `extractedContent`, truncated to 16 hex chars
- AC3: Three top-level properties: `contentIndex`, `links`, `stats`
- AC4: Identical content stored once with all sources tracked
- AC9: `ExtractionResult` with deduplicated structure is the only public contract (no backward compatibility)

---

## Technical Specification

### Complete Schema & Algorithm

**Detailed Specification**: See [Content Deduplication Strategy in Implementation Guide](../../../../component-guides/Content%20Extractor%20Implementation%20Guide.md#Content%20Deduplication%20Strategy)

**Key Technical Details**:
- Hash generation using Node.js `crypto.createHash('sha256')`
- Pseudocode for `deduplicateExtractionResults()` transformation
- Stats calculation formulas
- Integration with `extractLinksContent()` workflow

### Data Structures

**Schema Reference**: See [ExtractionResult Schema](../../../../component-guides/Content%20Extractor%20Implementation%20Guide.md#ExtractionResult%20Schema)

**Quick Schema Overview**:

```javascript
{
  contentIndex: {
    [contentId: string]: {
      content: string,
      contentLength: number,
      sources: Array<{ targetFile, anchor, anchorType }>
    }
  },
  links: Array<{
    contentId: string | null,
    sourceLine: number,
    sourceColumn: number,
    linkText: string,
    status: "success" | "skipped" | "error",
    decisionReason?: string,
    reason?: string
  }>,
  stats: {
    totalLinks: number,
    uniqueContent: number,
    duplicateContentDetected: number,
    tokensSaved: number,
    compressionRatio: number
  }
}
```

### Component Interactions

**Workflow Diagram**: See [ContentExtractor Workflow](../../../../component-guides/Content%20Extractor%20Implementation%20Guide.md#ContentExtractor%20Workflow%20Component%20Interaction%20Diagram)

**Architecture Details**: See [ContentExtractor Component in Architecture Doc](../../content-aggregation-architecture.md#Citation%20Manager.ContentExtractor)

---

## Key Design Decisions

### Decision 1: Content-Based Hashing (Not Identity-Based)

**Chosen Approach**: Hash the extracted content string itself

**Alternative Rejected**: Use `targetFile + anchor` as key (identity-based)

**Rationale**:
- **Catches more duplicates**: Different files with identical content get deduplicated
- **Content-driven**: Same text = same hash, regardless of source
- **Automatic detection**: No manual tracking of which files might have duplicates
- **Collision risk negligible**: SHA-256 with 16 chars = 2^64 possible values

**Trade-offs Accepted**:
- Whitespace-sensitive (minor formatting differences create different hashes)
- Cannot detect partial matches (H3 as substring of H2)
- Slightly more computation (hashing vs string comparison)

**Why This Matters**: Real documentation often has identical text in different locations (examples, definitions, boilerplate). Identity-based keys would miss these.

---

### Decision 2: Default Output Format (No Backward Compatibility)

**Chosen Approach**: `ExtractionResult` with deduplicated structure is THE ONLY public contract

**Alternative Rejected**: Provide both flat and indexed formats with flag

**Rationale**:
- **Primary goal**: Minimize token usage (deduplication must be default)
- **Epic 2 cohesion**: Entire epic ships together, no incremental API stability needed
- **Simplicity**: Single output contract reduces complexity
- **Clear intent**: Deduplication is core feature, not optional optimization
- **Names as Contracts**: The name `ExtractionResult` describes WHAT it is (extraction results), not HOW it works (deduplicated). Implementation details don't belong in public contract names.

**Architecture Impact**:
- `_LinkExtractionAttempt[]` is internal implementation detail only (private naming with underscore prefix)
- Documentation clearly states `ExtractionResult` is public contract with deduplicated structure
- CLI consumers get optimized output by default

**From Implementation Guide**:
> **Internal Implementation Detail**: The extraction workflow internally produces intermediate extraction attempts (stored in `_LinkExtractionAttempt[]` array) during processing, but these are immediately transformed via internal `_deduplicateExtractionResults()` function before returning. The intermediate flat array format is an implementation detail, not a public contract.

---

### Decision 3: Defer Nested Content Detection

**Known Limitation**: Cannot detect when extracted content is substring of another extraction

**Scenario**:
- Link A extracts H2 section (includes nested H3 subsections)
- Link B directly targets one of those H3s
- Result: Two entries in `contentIndex` despite H3 being substring of H2

**Why Deferred**:
- Substring detection requires O(n²) comparisons or complex suffix trees
- Edge cases are numerous (overlapping substrings, partial matches)
- MVP goal is exact duplicate detection
- Token savings from exact duplicates provides majority of value (4,886 chars in test case)

**Mitigation**: Document as technical debt, accept 5-10% additional token usage in documents with many nested subsection links

**Technical Debt Reference**: See [Issue 1: Nested Content Duplication Detection](../../../../component-guides/Content%20Extractor%20Implementation%20Guide.md#Issue%201%20Nested%20Content%20Duplication%20Detection%20(Deferred%20-%20US2.2a))

---

## File Organization

### New Operation File

Following **Action-Based File Organization** principle:

**File**: `tools/citation-manager/src/core/ContentExtractor/deduplicateExtractionResults.js`

**Purpose**: Transform `_LinkExtractionAttempt[]` → `ExtractionResult` (internal operation)

**Rationale**:
- Single responsibility: content deduplication transformation
- Named by action (verb-noun pattern)
- Co-located with related operations in ContentExtractor folder

**File Structure Reference**: See [File Structure in Implementation Guide](../../../../component-guides/Content%20Extractor%20Implementation%20Guide.md#File%20Structure)

---

## Known Limitations

### 1. Nested Content Duplication

**Description**: H3 subsections extracted separately create duplicates when parent H2 already extracted

**Impact**: 5-10% additional token usage in documents with nested links

**Status**: Documented as technical debt, deferred to future enhancement

**Reference**: [Issue 1 in Technical Debt](../../../../component-guides/Content%20Extractor%20Implementation%20Guide.md#Issue%201%20Nested%20Content%20Duplication%20Detection%20(Deferred%20-%20US2.2a))

### 2. Whitespace Sensitivity

**Description**: Minor formatting differences (extra spaces, line breaks) create different hashes

**Impact**: Some near-duplicates won't be deduplicated

**Status**: Acceptable for MVP - content should be byte-identical for deduplication

**Mitigation**: Consistent markdown formatting across documentation

### 3. No Partial Content Matching

**Description**: Cannot detect that one piece of content contains another as substring

**Impact**: Some duplication remains undetected

**Status**: Deferred complexity - exact matching provides majority of value

---

## Dependencies

### Depends On
- ✅ **US2.2**: Content Retrieval (Complete 2025-10-23)
  - Provides `extractLinksContent()` that produces intermediate extraction attempts
  - Deduplication transforms this intermediate array into final `ExtractionResult`

### Enables
- 🔄 **US2.3**: Extract Command (In Progress)
  - CLI consumes `ExtractionResult` for output
  - Depends on deduplicated format being the public contract

### Architecture Foundation
- ✅ **US1.8**: Validation Enrichment Pattern (Complete 2025-10-19)
  - Provides enriched `LinkObject` with validation metadata
  - Used in `ExtractionResult.links[]`

---

## Related Documentation

### Primary References
- [Content Aggregation PRD - US2.2a](../../content-aggregation-prd.md#Story%202.2a%20Implement%20Content%20Deduplication%20for%20ExtractionResults)
- [Content Extractor Implementation Guide - Deduplication Strategy](../../../../component-guides/Content%20Extractor%20Implementation%20Guide.md#Content%20Deduplication%20Strategy)
- [Content Aggregation Architecture - ContentExtractor Component](../../content-aggregation-architecture.md#Citation%20Manager.ContentExtractor)

### Architecture Principles
- [One Source of Truth](../../../../../../design-docs/Architecture%20Principles.md#^one-source-of-truth)
- [Action-Based File Organization](../../../../../../design-docs/Architecture%20Principles.md#^action-based-file-organization-definition)
- [Data Model First](../../../../../../design-docs/Architecture%20Principles.md#^data-model-first)

### Related User Stories
- [US2.2: Implement Content Retrieval](../us2.2-implement-content-retrieval/us2.2-implement-content-retrieval.md)
- [US2.3: Implement Extract Command](../us2.3-implement-extract-command/us2.3-implement-extract-command.md) (when created)

---

## Next Steps

This design plan document is now complete. The next phase is **implementation planning**, which will:

1. Create detailed implementation tasks (not included in this design doc per requirements)
2. Define test strategy for deduplication logic
3. Plan integration with existing `extractLinksContent()` workflow
4. Define acceptance test scenarios with known duplicates

**Ready for**: Separate implementation planning session
