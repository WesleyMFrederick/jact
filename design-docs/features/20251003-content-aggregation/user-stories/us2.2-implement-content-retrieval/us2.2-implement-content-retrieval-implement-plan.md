# US2.2: Implement Content Retrieval in ContentExtractor - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend ContentExtractor to orchestrate complete extraction workflow: validation → eligibility → content retrieval → aggregation

**Architecture:** ContentExtractor accepts ParsedFileCache and CitationValidator dependencies via constructor, internally calls validator to discover enriched links, filters by eligibility using existing strategy chain from US2.1, retrieves content from target documents via ParsedDocument facade methods (extractSection/extractBlock/extractFullContent), and returns OutgoingLinksExtractedContent array with status/details for each link.

**Tech Stack:** Node.js ESM, Vitest, existing citation-manager components (CitationValidator, ParsedFileCache, ParsedDocument)

**Checkpoint Strategy:** This plan uses git checkpoints after each task (Tasks 1-8) to track granular progress with full attribution. A single comprehensive commit is created after Task 9 to represent the complete US2.2 implementation.

---

## Initial Setup: Create Baseline Checkpoint

**Before Task 1 begins:**

```bash
git checkpoint "claude-sonnet-4-5" "pre-us2.2-baseline" "Clean state before US2.2 implementation begins"
```

This captures the clean state before any US2.2 work, allowing easy comparison and rollback if needed.

---

## Task 1: Create Anchor Normalization Utility File

### Files
- `tools/citation-manager/src/core/ContentExtractor/normalizeAnchor.js` (CREATE)
- `tools/citation-manager/test/normalize-anchor.test.js` (CREATE)

### Purpose
Create utility file with exported anchor normalization functions per [ADR-CE02: Anchor Normalization Location for Extraction](../../../../component-guides/Content%20Extractor%20Implementation%20Guide.md#ADR-CE02%20Anchor%20Normalization%20Location%20for%20Extraction) and [Action-Based File Organization](../../../../../../../ARCHITECTURE-PRINCIPLES.md#^action-based-file-organization-definition) (utility extraction pattern)

### Step 1: Write failing test for normalizeBlockId

```javascript
import { describe, expect, it } from 'vitest';
import { normalizeBlockId, decodeUrlAnchor } from '../src/core/ContentExtractor/normalizeAnchor.js';

describe("Anchor Normalization Utilities", () => {
 it("should remove caret prefix from block anchor", () => {
  // Given: Block anchor with caret '^block-id'
  // When: normalizeBlockId called
  const result = normalizeBlockId('^block-id')

  // Then: Caret prefix removed
  expect(result).toBe('block-id')
 });

 it("should return null for null block anchor", () => {
  // Given: null anchor
  // When: normalizeBlockId called
  // Then: Returns null unchanged
  expect(normalizeBlockId(null)).toBe(null)
 });

 it("should return unchanged anchor without caret", () => {
  // Given: Anchor without caret 'no-caret'
  // When: normalizeBlockId called
  // Then: Returns unchanged
  expect(normalizeBlockId('no-caret')).toBe('no-caret')
 });
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- normalize-anchor.test.js`

Expected: FAIL - Cannot find module 'normalizeAnchor.js'

### Step 3: Create normalizeAnchor.js with normalizeBlockId

Create `tools/citation-manager/src/core/ContentExtractor/normalizeAnchor.js`:

```javascript
/**
 * Anchor normalization utilities
 * Per ADR-CE02: Normalization in ContentExtractor, not ParsedDocument
 */

/**
 * Normalize block anchor by removing '^' prefix
 */
export function normalizeBlockId(anchor) {
 // IF anchor is not null AND starts with '^'
 //   RETURN anchor.substring(1)
 // ELSE
 //   RETURN anchor unchanged
}
```

### Step 4: Run test to verify it passes

Run: `npm test -- normalize-anchor.test.js`

Expected: PASS (3/3 tests for normalizeBlockId)

### Step 5: Add decodeUrlAnchor tests

Add to `normalize-anchor.test.js`:

```javascript
describe("URL Decoding", () => {
 it("should decode URL-encoded anchor with spaces", () => {
  // Given: URL-encoded anchor 'Story%201.7%20Implementation'
  // When: decodeUrlAnchor called
  // Then: Decoded to spaces
  expect(decodeUrlAnchor('Story%201.7%20Implementation')).toBe('Story 1.7 Implementation')
 });

 it("should return original anchor if decoding fails", () => {
  // Given: Invalid encoding 'invalid%'
  // When: decodeUrlAnchor called with invalid encoding
  // Then: Returns original (graceful fallback)
  expect(decodeUrlAnchor('invalid%')).toBe('invalid%')
 });

 it("should handle null anchor", () => {
  // Given: null anchor
  // When: decodeUrlAnchor called
  // Then: Returns null
  expect(decodeUrlAnchor(null)).toBe(null)
 });
});
```

### Step 6: Run test to verify it fails

Run: `npm test -- normalize-anchor.test.js`

Expected: FAIL - decodeUrlAnchor is not defined

### Step 7: Add decodeUrlAnchor to normalizeAnchor.js

Add to `normalizeAnchor.js`:

```javascript
/**
 * Decode URL-encoded characters in anchor strings
 */
export function decodeUrlAnchor(anchor) {
 // IF anchor is null
 //   RETURN null
 //
 // TRY
 //   RETURN decodeURIComponent(anchor)
 // CATCH error
 //   RETURN anchor unchanged // Graceful fallback
}
```

### Step 8: Run test to verify all pass

Run: `npm test -- normalize-anchor.test.js`

Expected: PASS (6/6 tests total)

### Step 9: Create checkpoint for anchor normalization utilities

```bash
git add tools/citation-manager/src/core/ContentExtractor/normalizeAnchor.js tools/citation-manager/test/normalize-anchor.test.js
git checkpoint "claude-sonnet-4-5" "task-1-anchor-normalization" "Create normalizeAnchor.js with exported normalizeBlockId() and decodeUrlAnchor(). normalizeBlockId() removes '^' prefix from block anchors. decodeUrlAnchor() handles URL-encoded strings with graceful fallback. Add unit tests for both utilities (6 tests). Follows Action-Based File Organization (utility extraction pattern). Per ADR-CE02: normalization in ContentExtractor, not ParsedDocument. US2.2 AC5, AC6"
```

---

## Task 2: Update ContentExtractor Constructor for Dependency Injection

### Files
- `tools/citation-manager/src/core/ContentExtractor/ContentExtractor.js` (MODIFY)
- `tools/citation-manager/test/content-extractor.test.js` (MODIFY)

### Purpose
Add parsedFileCache and citationValidator dependencies to constructor (US2.2 AC1)

### Step 1: Write failing test for constructor with new dependencies

Create test in `tools/citation-manager/test/content-extractor.test.js`:

```javascript
it("should accept parsedFileCache and citationValidator dependencies", () => {
 // Given: Mock dependencies
 const mockCache = CREATE_MOCK_PARSED_FILE_CACHE
 const mockValidator = CREATE_MOCK_CITATION_VALIDATOR
 const mockStrategies = []

 // When: ContentExtractor instantiated with all dependencies
 const extractor = new ContentExtractor(mockStrategies, mockCache, mockValidator)

 // Then: Dependencies stored correctly
 expect(extractor.parsedFileCache).toBe(mockCache)
 expect(extractor.citationValidator).toBe(mockValidator)
 expect(extractor.eligibilityStrategies).toBe(mockStrategies)
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- content-extractor.test.js`

Expected: FAIL - Constructor doesn't accept parsedFileCache/citationValidator

### Step 3: Update ContentExtractor constructor

Pseudocode for `ContentExtractor.js`:

```javascript
class ContentExtractor {
 constructor(eligibilityStrategies, parsedFileCache, citationValidator) {
  // Store eligibility strategies (existing)
  this.eligibilityStrategies = eligibilityStrategies

  // Store NEW dependencies for US2.2
  this.parsedFileCache = parsedFileCache
  this.citationValidator = citationValidator
 }

 // Existing methods: analyzeEligibility, normalizeBlockId, decodeUrlAnchor...
}
```

### Step 4: Run test to verify it passes

Run: `npm test -- content-extractor.test.js`

Expected: PASS

### Step 5: Create checkpoint for constructor update

```bash
git add tools/citation-manager/src/core/ContentExtractor/ContentExtractor.js tools/citation-manager/test/content-extractor.test.js
git checkpoint "claude-sonnet-4-5" "task-2-constructor-di" "Update ContentExtractor constructor to accept parsedFileCache and citationValidator. Add unit test validating dependency injection. Maintains backward compatibility with existing eligibilityStrategies parameter. US2.2 AC1"
```

---

## Task 3: Create extractLinksContent Operation File

### Files
- `tools/citation-manager/src/core/ContentExtractor/extractLinksContent.js` (CREATE)
- `tools/citation-manager/src/core/ContentExtractor/ContentExtractor.js` (MODIFY)
- `tools/citation-manager/test/content-extractor.test.js` (MODIFY)
- `tools/citation-manager/test/fixtures/us2.2/mixed-links-source.md` (CREATE)
- `tools/citation-manager/test/fixtures/us2.2/target-doc.md` (CREATE)
- `tools/citation-manager/test/fixtures/us2.2/error-links-source.md` (CREATE)

### Purpose
Create primary operation file that orchestrates validation → eligibility → content retrieval workflow (US2.2 AC2-AC9). Follows [Action-Based File Organization](../../../../../../../ARCHITECTURE-PRINCIPLES.md#^action-based-file-organization-definition) with verb-noun naming

### Step 1: Write failing test for extractLinksContent signature

Create test in `tools/citation-manager/test/content-extractor.test.js`:

```javascript
it("should provide extractLinksContent method returning Promise of OutgoingLinksExtractedContent array", async () => {
 // Given: ContentExtractor with real dependencies via factory
 const extractor = CREATE_CONTENT_EXTRACTOR_VIA_FACTORY

 // When: extractLinksContent called with source file and flags
 const result = await extractor.extractLinksContent('source-file.md', { fullFiles: false })

 // Then: Returns array of OutgoingLinksExtractedContent objects
 expect(Array.isArray(result)).toBe(true)
 // Validation: Each result has required structure
 IF result.length > 0 THEN
  expect(result[0]).toHaveProperty('sourceLink')
  expect(result[0]).toHaveProperty('status')
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- content-extractor.test.js`

Expected: FAIL - extractLinksContent is not a function

### Step 3: Create extractLinksContent.js operation file

Create `tools/citation-manager/src/core/ContentExtractor/extractLinksContent.js`:

```javascript
import { analyzeEligibility } from './analyzeEligibility.js';
import { normalizeBlockId, decodeUrlAnchor } from './normalizeAnchor.js';

/**
 * Extract content from links in source file
 * Primary operation orchestrating validation → eligibility → content retrieval
 */
export async function extractLinksContent(
 sourceFilePath,
 cliFlags,
 { parsedFileCache, citationValidator, eligibilityStrategies }
) {
 // ... (pseudocode below)
}
```

Pseudocode for operation logic:

```javascript
// PHASE 1: Validation (AC3)
// Call citationValidator to get enriched links
const validationResult = await citationValidator.validateFile(sourceFilePath)
const enrichedLinks = validationResult.links  // Array with validation metadata

// Get source document for internal link handling
const sourceParsedDoc = await parsedFileCache.resolveParsedFile(sourceFilePath)

// PHASE 2: Process each link
const results = []
FOR EACH link IN enrichedLinks DO
 // AC4: Skip validation errors
 IF link.validation.status === 'error' THEN
  results.push({
   sourceLink: link,
   status: 'skipped',
   failureDetails: { reason: `Link failed validation: ${link.validation.error}` }
  })
  CONTINUE

 // AC4: Check eligibility using strategy chain
 const eligibilityDecision = analyzeEligibility(link, cliFlags, eligibilityStrategies)
 IF NOT eligibilityDecision.eligible THEN
  results.push({
   sourceLink: link,
   status: 'skipped',
   failureDetails: { reason: `Link not eligible: ${eligibilityDecision.reason}` }
  })
  CONTINUE

 // PHASE 3: Content Retrieval (AC5-AC7)
 TRY
  // Determine target document
  LET targetDoc
  IF link.scope === 'internal' THEN
   targetDoc = sourceParsedDoc  // Reuse source
  ELSE
   targetDoc = await parsedFileCache.resolveParsedFile(link.target.path.absolute)

  // Extract content based on anchor type
  LET extractedContent
  IF link.anchorType === 'header' THEN  // AC5: Section
   const decodedAnchor = decodeUrlAnchor(link.target.anchor)
   extractedContent = targetDoc.extractSection(decodedAnchor)
  ELSE IF link.anchorType === 'block' THEN  // AC6: Block
   const normalizedAnchor = normalizeBlockId(link.target.anchor)
   extractedContent = targetDoc.extractBlock(normalizedAnchor)
  ELSE  // AC7: Full file
   extractedContent = targetDoc.extractFullContent()

  // AC8: Success result
  results.push({
   sourceLink: link,
   status: 'success',
   successDetails: {
    decisionReason: eligibilityDecision.reason,
    extractedContent: extractedContent
   }
  })

 CATCH error
  // AC8: Error result
  results.push({
   sourceLink: link,
   status: 'error',
   failureDetails: { reason: `Extraction failed: ${error.message}` }
  })

// AC9: Return Promise<OutgoingLinksExtractedContent[]>
RETURN results
```

### Step 3a: Add delegation method to ContentExtractor.js

Update `ContentExtractor.js` to delegate to operation file:

```javascript
import { extractLinksContent as extractLinksContentOp } from './extractLinksContent.js';

class ContentExtractor {
 constructor(eligibilityStrategies, parsedFileCache, citationValidator) {
  // Store dependencies...
 }

 /**
  * Thin wrapper delegating to operation file
  */
 async extractLinksContent(sourceFilePath, cliFlags) {
  // Delegate to operation function with dependencies
  return await extractLinksContentOp(
   sourceFilePath,
   cliFlags,
   {
    parsedFileCache: this.parsedFileCache,
    citationValidator: this.citationValidator,
    eligibilityStrategies: this.eligibilityStrategies
   }
  )
 }
}
```

### Step 4: Run test to verify basic structure passes

Run: `npm test -- content-extractor.test.js`

Expected: PASS (basic structure test)

### Step 5: Add comprehensive workflow test

```javascript
it("should execute complete workflow: validation → eligibility → extraction", async () => {
 // Given: Source file with multiple link types (section, block, full-file)
 const sourceFile = PATH_TO_FIXTURE('us2.2/mixed-links-source.md')
 const extractor = CREATE_EXTRACTOR_VIA_FACTORY

 // When: extractLinksContent executed
 const results = await extractor.extractLinksContent(sourceFile, { fullFiles: false })

 // Then: Results array contains mix of success/skipped/error statuses
 expect(results.length).toBeGreaterThan(0)

 // Validation: Section link extracted successfully
 const sectionResult = results.find(r => r.sourceLink.anchorType === 'header')
 expect(sectionResult.status).toBe('success')
 expect(sectionResult.successDetails.extractedContent).toContain('Expected section content')

 // Validation: Block link extracted successfully
 const blockResult = results.find(r => r.sourceLink.anchorType === 'block')
 expect(blockResult.status).toBe('success')

 // Validation: Full-file link skipped without --full-files flag
 const fullFileResult = results.find(r => r.sourceLink.anchorType === null)
 expect(fullFileResult.status).toBe('skipped')
 expect(fullFileResult.failureDetails.reason).toContain('not eligible')
});
```

### Step 6: Run comprehensive test

Run: `npm test -- content-extractor.test.js`

Expected: PASS (validates AC3-AC9)

### Step 7: Create checkpoint for extractLinksContent operation

```bash
git add tools/citation-manager/src/core/ContentExtractor/extractLinksContent.js tools/citation-manager/src/core/ContentExtractor/ContentExtractor.js tools/citation-manager/test/content-extractor.test.js tools/citation-manager/test/fixtures/us2.2/
git checkpoint "claude-sonnet-4-5" "task-3-extract-links-content" "Create extractLinksContent.js as primary operation file (verb-noun naming). Orchestrates validation → eligibility → content retrieval workflow. Internally calls CitationValidator.validateFile() to get enriched links. Filters by validation status and eligibility using strategy chain. Extracts content via ParsedDocument methods (extractSection/extractBlock/extractFullContent). Returns OutgoingLinksExtractedContent array with success/skipped/error statuses. Add delegation method in ContentExtractor.js (thin wrapper pattern). Add comprehensive workflow tests with mixed link types. Follows Action-Based File Organization (operation extraction). US2.2 AC2, AC3, AC4, AC5, AC6, AC7, AC8, AC9"
```

---

## Task 4: Update Factory for New Dependencies

### Files
- `tools/citation-manager/src/factories/componentFactory.js` (MODIFY)
- `tools/citation-manager/test/component-factory.test.js` (MODIFY)

### Purpose
Update createContentExtractor() factory to wire ParsedFileCache and CitationValidator dependencies (US2.2 AC10)

### Step 1: Write failing test for factory with new dependencies

Create test in `tools/citation-manager/test/component-factory.test.js`:

```javascript
it("should create ContentExtractor with ParsedFileCache and CitationValidator dependencies", () => {
 // When: Factory creates ContentExtractor with default dependencies
 const extractor = createContentExtractor()

 // Then: All dependencies injected correctly
 expect(extractor.parsedFileCache).toBeDefined()
 expect(extractor.citationValidator).toBeDefined()
 expect(extractor.eligibilityStrategies).toBeDefined()
 expect(extractor.eligibilityStrategies.length).toBe(4)  // All strategies present
});

it("should allow dependency override for testing", () => {
 // Given: Custom dependencies for testing
 const mockCache = CREATE_MOCK_CACHE
 const mockValidator = CREATE_MOCK_VALIDATOR
 const mockStrategies = [CREATE_MOCK_STRATEGY]

 // When: Factory called with overrides
 const extractor = createContentExtractor(mockCache, mockValidator, mockStrategies)

 // Then: Custom dependencies used instead of defaults
 expect(extractor.parsedFileCache).toBe(mockCache)
 expect(extractor.citationValidator).toBe(mockValidator)
 expect(extractor.eligibilityStrategies).toBe(mockStrategies)
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- component-factory.test.js`

Expected: FAIL - Factory doesn't wire new dependencies

### Step 3: Update createContentExtractor factory

Pseudocode for `componentFactory.js`:

```javascript
export function createContentExtractor(
 parsedFileCache = null,
 citationValidator = null,
 strategies = null
) {
 // Create or use provided dependencies
 const _parsedFileCache = parsedFileCache || createParsedFileCache()
 const _citationValidator = citationValidator || createCitationValidator()
 const _strategies = strategies || [
  new StopMarkerStrategy(),
  new ForceMarkerStrategy(),
  new SectionLinkStrategy(),
  new CliFlagStrategy()
 ]

 // Instantiate ContentExtractor with ALL dependencies
 return new ContentExtractor(_strategies, _parsedFileCache, _citationValidator)
}
```

### Step 4: Run test to verify it passes

Run: `npm test -- component-factory.test.js`

Expected: PASS (both factory tests)

### Step 5: Create checkpoint for factory update

```bash
git add tools/citation-manager/src/factories/componentFactory.js tools/citation-manager/test/component-factory.test.js
git checkpoint "claude-sonnet-4-5" "task-4-factory-wiring" "Update createContentExtractor() to accept parsedFileCache and citationValidator parameters. Wire dependencies using existing factory functions (createParsedFileCache, createCitationValidator). Support optional dependency override for testing. Maintain default strategy chain instantiation. US2.2 AC10"
```

---

## Task 5: Create Test Fixtures for Content Extraction

### Files
- `tools/citation-manager/test/fixtures/us2.2/mixed-links-source.md` (CREATE)
- `tools/citation-manager/test/fixtures/us2.2/target-doc.md` (CREATE)
- `tools/citation-manager/test/fixtures/us2.2/error-links-source.md` (CREATE)

### Purpose
Create markdown fixtures for testing section, block, and full-file extraction scenarios

### Step 1: Create fixture directory

```bash
mkdir -p tools/citation-manager/test/fixtures/us2.2
```

### Step 2: Create source file with mixed link types

Create `tools/citation-manager/test/fixtures/us2.2/mixed-links-source.md`:

```markdown
# Source Document for US2.2 Testing

This document contains various link types for testing content extraction.

## Section Link
Link to section: [[target-doc.md#Section to Extract]]

## Block Link
Link to block: [[target-doc.md#^block-ref-1]]

## Full File Link
Link to full file: [[target-doc.md]]

## Internal Section Link
Link to internal section: [[#Section to Extract]]
```

### Step 3: Create target document with extractable content

Create `tools/citation-manager/test/fixtures/us2.2/target-doc.md`:

```markdown
# Target Document

## Section to Extract

This is the content that should be extracted when linking to this section.
It spans multiple lines and contains important information.

## Another Section

This section should NOT be extracted when requesting "Section to Extract".

This is a block reference that can be extracted. ^block-ref-1

More content after the block reference.
```

### Step 4: Create fixture for validation error testing

Create `tools/citation-manager/test/fixtures/us2.2/error-links-source.md`:

```markdown
# Document with Broken Links

Valid link: [[target-doc.md#Section to Extract]]

Broken link (file not found): [[nonexistent.md#section]]

Broken anchor link: [[target-doc.md#NonexistentSection]]
```

### Step 5: Verify fixtures exist

```bash
ls -la tools/citation-manager/test/fixtures/us2.2/
```

Expected output: Shows all created fixture files

### Step 6: Create checkpoint for test fixtures

```bash
git add tools/citation-manager/test/fixtures/us2.2/
git checkpoint "claude-sonnet-4-5" "task-5-test-fixtures" "Add mixed-links-source.md with section/block/full-file links. Add target-doc.md with extractable section and block content. Add error-links-source.md for validation error scenarios. Fixtures support integration testing for AC5-AC9. US2.2 test infrastructure"
```

---

## Task 6: Integration Tests for Content Retrieval

### Files
- Create: `tools/citation-manager/test/integration/content-extraction-workflow.test.js`

### Purpose
Test complete workflow with real ParsedFileCache, CitationValidator, ParsedDocument (US2.2 AC11)

### Step 1: Create integration test file

Create `tools/citation-manager/test/integration/content-extraction-workflow.test.js`:

```javascript
describe("Content Extraction Workflow Integration", () => {
 it("should execute complete extraction workflow with real components", async () => {
  // Given: Real components via factory (no mocks - "Real Systems, Fake Fixtures")
  const extractor = createContentExtractor()
  const sourceFile = join(__dirname, '../fixtures/us2.2/mixed-links-source.md')

  // When: Complete workflow executes
  const results = await extractor.extractLinksContent(sourceFile, { fullFiles: false })

  // Then: Results contain expected extraction outcomes
  expect(results.length).toBeGreaterThan(0)

  // Validation: Real ParsedFileCache used (file parsed once, cached for reuse)
  // Validation: Real CitationValidator used (enriched links with validation metadata)
  // Validation: Real ParsedDocument used (content extracted via facade methods)
  expect(results.some(r => r.status === 'success')).toBe(true)
 });
});
```

### Step 2: Run integration tests

Run: `npm test -- content-extraction-workflow.test.js`

Expected: PASS (validates AC11 - real component integration)

### Step 3: Create checkpoint for integration tests

```bash
git add tools/citation-manager/test/integration/content-extraction-workflow.test.js
git checkpoint "claude-sonnet-4-5" "task-6-integration-tests" "Test complete workflow with real ParsedFileCache, CitationValidator, ParsedDocument. Follow 'Real Systems, Fake Fixtures' principle (no mocks). Validate end-to-end orchestration from validation through content retrieval. US2.2 AC11"
```

---

## Task 7: US2.2 Acceptance Criteria Validation Tests

### Files
- Create: `tools/citation-manager/test/integration/us2.2-acceptance-criteria.test.js`

### Purpose
Validate all AC1-AC12 acceptance criteria with integration tests

### Step 1: Create AC validation test file

Create comprehensive test file validating each AC:

```javascript
describe("US2.2 Acceptance Criteria Validation", () => {
 it("AC1: should accept parsedFileCache and citationValidator dependencies", () => {
  // Validate constructor signature and dependency injection
 });

 it("AC2: should provide extractLinksContent public method", async () => {
  // Validate method exists and returns Promise<OutgoingLinksExtractedContent[]>
 });

 it("AC3: should internally call citationValidator.validateFile", async () => {
  // Validate validator integration returns enriched links
 });

 it("AC4: should filter out validation errors and ineligible links", async () => {
  // Validate error filtering and eligibility checks
 });

 it("AC5: should extract section content with URL-decoded anchor", async () => {
  // Validate parsedDoc.extractSection() with decoded anchor
 });

 it("AC6: should extract block content with normalized anchor", async () => {
  // Validate parsedDoc.extractBlock() with '^' removed
 });

 it("AC7: should extract full file content", async () => {
  // Validate parsedDoc.extractFullContent()
 });

 it("AC8: should return OutgoingLinksExtractedContent with correct structure", async () => {
  // Validate { sourceLink, status, successDetails/failureDetails }
 });

 it("AC9: should return Promise resolving to OutgoingLinksExtractedContent array", async () => {
  // Validate return type
 });

 it("AC10: should wire dependencies via factory", () => {
  // Validate createContentExtractor() wiring
 });

 it("AC11: should work with real components (no mocks)", async () => {
  // Validate real ParsedFileCache, CitationValidator, ParsedDocument integration
 });

 it("AC12: should not break US2.1 tests (regression check)", () => {
  // This is verified in Task 8
 });
});
```

### Step 2: Run AC validation tests

Run: `npm test -- us2.2-acceptance-criteria.test.js`

Expected: PASS (all 12 ACs validated)

### Step 3: Create checkpoint for AC tests

```bash
git add tools/citation-manager/test/integration/us2.2-acceptance-criteria.test.js
git checkpoint "claude-sonnet-4-5" "task-7-acceptance-tests" "Validate all AC1-AC12 with dedicated integration tests. One test per acceptance criteria for traceability. Confirms complete US2.2 implementation. US2.2 acceptance validation"
```

---

## Task 8: Regression Verification

### Files
- N/A (test execution only)

### Purpose
Verify all US2.1 tests (35+ tests) continue passing with zero regressions (US2.2 AC12)

### Step 1: Run complete test suite

```bash
npm test
```

Expected output:
- All US2.1 tests pass (35+ tests from eligibility strategies)
- All US2.2 tests pass (new tests from Tasks 1-7)
- Zero test failures
- Zero regressions

### Step 2: Run US2.1-specific tests

```bash
npm test -- analyze-eligibility.test.js
npm test -- cli-flag-strategy.test.js
npm test -- force-marker-strategy.test.js
npm test -- section-link-strategy.test.js
npm test -- stop-marker-strategy.test.js
npm test -- extraction-strategy-interface.test.js
npm test -- extraction-eligibility-precedence.test.js
npm test -- us2.1-acceptance-criteria.test.js
```

Expected: PASS for all US2.1 tests (confirms AC12 - zero regressions)

### Step 3: Document regression verification

If all tests pass, US2.2 AC12 is satisfied. If any failures occur, investigate and fix before proceeding.

---

## Task 9: Update Documentation Post-Implementation

### Files
- `tools/citation-manager/design-docs/features/20251003-content-aggregation/content-aggregation-prd.md` (MODIFY)
- `tools/citation-manager/design-docs/features/20251003-content-aggregation/content-aggregation-architecture.md` (MODIFY)
- `tools/citation-manager/design-docs/component-guides/Content Extractor Implementation Guide.md` (MODIFY)

### Purpose
Synchronize all architectural and design documentation with the final US2.2 implementation, ensuring accuracy for future development

### Step 1: Review implementation against planned architecture

```bash
git diff main -- tools/citation-manager/src/core/ContentExtractor/
```

Expected: Identify any deviations from planned file structure or component organization

### Step 2: Update PRD status and changelog

Edit `content-aggregation-prd.md`:

1. Update Story 2.2 status (line ~350):

```markdown
_Status_: ✅ COMPLETE (2025-10-XX)
```

1. Add changelog entry:

```markdown
| Date       | Version | Description                                                                                                                     | Author                                    |
| ---------- | ------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| 2025-10-XX | 2.x     | Mark US2.2 as COMPLETE - Content retrieval implemented with ParsedDocument facade integration, zero regressions confirmed      | Application Tech Lead (Claude Sonnet 4.5) |
```

1. Document any deferred scope or discovered limitations in Story 2.2 section if applicable

### Step 3: Update architecture document

Edit `content-aggregation-architecture.md`:

1. **Verify ContentExtractor component description** (lines 234-270):
   - Confirm description matches final implementation
   - Update if any constructor parameters or methods evolved

2. **Update file structure section** (lines 492-532):
   - Verify actual file organization matches documented structure
   - Update if `extractLinksContent.js` or `normalizeAnchor.js` were created as separate files

3. **Validate sequence diagrams**:
   - Ensure `extract` command workflow diagram (line ~342) reflects implemented behavior
   - Update if integration points or data flow changed

4. **Update technical debt tracking**:
   - Mark any resolved technical debt items as RESOLVED
   - Add new technical debt if discovered during implementation

5. **Update "Last Updated" timestamp** at document end

### Step 4: Update Content Extractor Implementation Guide

Edit `Content Extractor Implementation Guide.md`:

1. **Validate Public Contracts section**:
   - Verify `extractLinksContent(sourceFilePath, cliFlags)` signature matches implementation
   - Confirm `OutgoingLinksExtractedContent` structure matches actual return type
   - Update dependency injection parameters if changed

2. **Update File Structure section**:
   - Verify actual code organization matches documented structure
   - Update if helper utilities remained co-located vs extracted to separate files
   - Document actual function export patterns

3. **Validate workflow diagrams**:
   - Ensure ContentExtractor Workflow sequence diagram reflects implemented flow
   - Update if validation enrichment pattern integration differs from plan

4. **Update pseudocode**:
   - Replace pseudocode with implementation details where helpful
   - Add code examples for anchor normalization if utilities were extracted

5. **Add Known Limitations section** (if applicable):
   - Document any edge cases discovered during testing
   - Note performance characteristics if relevant
   - Reference related technical debt items

### Step 5: Update related component guides (if needed)

Review and update if integration points changed:
- `ParsedDocument Implementation Guide.md` - if extraction methods evolved
- `CitationValidator Implementation Guide.md` - if validation integration changed
- `CLI Integration Guide.md` - if CLI orchestration pattern changed

### Step 6: Validate documentation

```bash
# Validate markdown formatting
markdownlint "tools/citation-manager/design-docs/**/*.md"

# Validate citations in updated documents
npm run citation:validate tools/citation-manager/design-docs/features/20251003-content-aggregation/content-aggregation-prd.md -- --scope /Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/cc-workflows
npm run citation:validate tools/citation-manager/design-docs/features/20251003-content-aggregation/content-aggregation-architecture.md -- --scope /Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/cc-workflows
npm run citation:validate tools/citation-manager/design-docs/component-guides/Content\ Extractor\ Implementation\ Guide.md -- --scope /Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/cc-workflows
```

Expected: All markdown linting passes, all citations validate without errors

### Step 7: Create comprehensive final commit

After documentation updates are complete, create the final commit that captures the entire US2.2 implementation:

```bash
git add .
git commit -m "feat(us2.2): implement content retrieval in ContentExtractor

Complete implementation of US2.2 with all 12 acceptance criteria:
- AC1: Constructor accepts ParsedFileCache and CitationValidator dependencies
- AC2: Provides extractLinksContent public method
- AC3: Internally calls CitationValidator.validateFile for enriched links
- AC4: Filters validation errors and ineligible links via strategy chain
- AC5: Extracts section content with URL-decoded anchors
- AC6: Extracts block content with normalized anchors (^ prefix removed)
- AC7: Extracts full file content
- AC8: Returns OutgoingLinksExtractedContent with sourceLink, status, and details
- AC9: Returns Promise<OutgoingLinksExtractedContent[]>
- AC10: Factory wires all dependencies correctly
- AC11: Integration tests use real components (no mocks)
- AC12: Zero regressions - all US2.1 tests pass

Technical implementation:
- Created normalizeAnchor.js utility file (Action-Based File Organization)
- Created extractLinksContent.js operation file (verb-noun naming)
- Updated ContentExtractor constructor for dependency injection
- Updated componentFactory for complete dependency wiring
- Added comprehensive test fixtures for integration testing
- Added integration tests following 'Real Systems, Fake Fixtures' principle
- Added acceptance criteria validation tests (one test per AC)
- Verified regression suite passes (35+ US2.1 tests)
- Updated all architectural documentation post-implementation

Architecture: ContentExtractor orchestrates validation → eligibility → content retrieval → aggregation workflow
Testing: ~57 steps across 9 tasks, TDD (RED-GREEN-REFACTOR) throughout
Documentation: PRD, architecture docs, and implementation guides synchronized

US2.2 COMPLETE"
```

**Note:** This final commit represents the complete, tested US2.2 feature. All previous work was tracked via git checkpoints with full attribution.

### Success Criteria

- ✅ All documentation files pass markdown linting
- ✅ All citations validate without errors using proper --scope flag
- ✅ Component descriptions match actual implementation
- ✅ File structure diagrams reflect actual code organization
- ✅ Workflow diagrams accurately represent implemented behavior
- ✅ Public contracts documentation matches actual interfaces
- ✅ Known limitations documented (if any discovered)
- ✅ US2.2 marked as complete in PRD with date
- ✅ Changelog updated with completion entry

---

## Execution Handoff

**Plan complete and saved to:** `tools/citation-manager/design-docs/features/20251003-content-aggregation/user-stories/us2.2-implement-content-retrieval/us2.2-implement-content-retrieval-implement-plan.md`

### Implementation Summary

**Initial Setup:**
- Create baseline checkpoint before starting work

**9 Tasks with TDD approach:**
1. ✅ Anchor normalization helpers (normalizeBlockId, decodeUrlAnchor) → checkpoint
2. ✅ Constructor DI for ParsedFileCache and CitationValidator → checkpoint
3. ✅ Core extractLinksContent orchestration method → checkpoint
4. ✅ Factory updates for dependency wiring → checkpoint
5. ✅ Test fixtures for integration testing → checkpoint
6. ✅ Integration tests with real components → checkpoint
7. ✅ Acceptance criteria validation tests → checkpoint
8. ✅ Regression verification (test execution only)
9. ✅ Documentation updates post-implementation → comprehensive final commit

**Total Steps:** ~57 steps across 9 tasks
**Pattern:** Test-first (RED-GREEN-REFACTOR) throughout
**Architecture:** Follows workspace testing principles (Real Systems, Fake Fixtures)
**Git Strategy:** Checkpoints after each task (1-8) for granular tracking, single comprehensive commit after task 9

### Checkpoint Benefits

- **Granular Progress Tracking**: Each task completion captured with full attribution
- **Easy Rollback**: Can return to any task completion state if issues discovered
- **AI Attribution**: All work clearly attributed to claude-sonnet-4-5 model
- **Clean History**: Single commit represents complete, tested US2.2 feature
- **Detailed Context**: Full descriptions preserved at each checkpoint for future reference

### Two Execution Options

#### Option 1: Subagent-Driven Development (Recommended)

- Use `superpowers:subagent-driven-development` skill
- Fresh subagent per task
- Code review between tasks
- Fast iteration with quality gates
- **Command:** Invoke subagent-driven-development skill in this session

#### Option 2: Parallel Session Execution

- Open new Claude Code session in same worktree
- Use `superpowers:executing-plans` skill
- Batch execution with checkpoints
- **Command:** Load this plan file in new session

### Ready to Execute

All tasks scaffolded with detailed pseudocode. Dev agent has:
- Clear test expectations (Given/When/Then)
- Implementation pseudocode (logic flow)
- Exact file paths
- Checkpoint commands (Tasks 1-8) and final commit command (Task 9)
- Expected outputs

**Git Checkpoint Workflow:**
1. Initial baseline: `git checkpoint "claude-sonnet-4-5" "pre-us2.2-baseline" "..."`
2. After each task: `git checkpoint "claude-sonnet-4-5" "task-N-description" "..."`
3. After Task 9: `git commit -m "feat(us2.2): implement content retrieval in ContentExtractor..."`

---
