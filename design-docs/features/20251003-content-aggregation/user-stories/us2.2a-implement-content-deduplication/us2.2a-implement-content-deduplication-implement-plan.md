# US2.2a: Implement Content Deduplication for OutgoingLinksExtractedContents - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend ContentExtractor to deduplicate identical extracted content using SHA-256 content-based hashing, minimizing LLM token usage

**Architecture:** ContentExtractor refactors extractLinksContent() to build a deduplicated index structure during extraction using single-pass inline deduplication. SHA-256 hashing identifies duplicate content (truncated to 16 hex chars). Output structure organizes into three groups: extractedContentBlocks (content ID → deduplicated content with sources), outgoingLinksReport (per-link extraction results with content ID references), and stats (aggregate metrics including compression ratio). No backward compatibility needed - flat array format replaced entirely.

**Tech Stack:** Node.js ESM with crypto module for SHA-256, Vitest, existing citation-manager components

**commit Strategy:** This plan uses git commits after each task (Tasks 1-20) to track granular progress with full attribution. A single comprehensive commit is created after Task 21 to represent the complete US2.2a implementation.

---

## Initial Setup: Create clean .worktree baseline

Use `using-git-worktrees` skill to create new branch `us2.a-content-deduplication` and sandbox worktree

---

## Task 1: Identical Content Hash Generation

### Files
- `tools/citation-manager/src/core/ContentExtractor/generateContentId.js` (CREATE)
- `tools/citation-manager/test/unit/ContentExtractor/generate-content-id.test.js` (CREATE)

### Purpose
Create utility for generating deterministic SHA-256 content IDs (US2.2a AC2). Validates identical content produces identical hashes.

### Step 1: Write failing test for identical content hash

```javascript
import { /* Vitest test functions */ } from 'vitest';
import { /* generateContentId function */ } from '../../../src/core/ContentExtractor/generateContentId.js';

describe("Content ID Generation - Determinism", () => {
  it("should generate identical hashes for identical content", () => {
    // Given: Two identical content strings
    const content1 = "This is test content for hashing.";
    const content2 = "This is test content for hashing.";

    // When: Generate content IDs for both
    const id1 = /* generateContentId(content1) */;
    const id2 = /* generateContentId(content2) */;

    // Then: Content IDs are identical (deterministic hashing)
    // Verification: SHA-256 determinism validated
    expect(id1).toBe(id2);
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- generate-content-id.test.js`

Expected: FAIL - Cannot find module 'generateContentId.js'

### Step 3: Implement generateContentId with SHA-256 hashing

Create `tools/citation-manager/src/core/ContentExtractor/generateContentId.js`:

```tsx
import { /* Node crypto module */ } from 'crypto';

/**
 * Generate content-based identifier using SHA-256 hashing
 * Integration: Uses Node.js crypto module for deterministic hashing
 *
 * @param content - Content string to hash
 * @returns 16-character hex hash (truncated SHA-256)
 */
export function generateContentId(content: string): string is
  // Boundary: Use Node crypto for SHA-256 hash generation
  const hash = /* crypto.createHash('sha256') */;

  // Pattern: Update hash with content, generate hex digest
  /* hash.update(content) */;
  const fullHash = /* hash.digest('hex') */;

  // Decision: Truncate to 16 chars per AC2 (balance uniqueness vs brevity)
  return /* fullHash.substring(0, 16) */;
```

### Step 4: Run test to verify it passes

Run: `npm test -- generate-content-id.test.js`

Expected: PASS (1/1 test)

### Step 5: Create commit for hash determinism

Use `create-git-commit` skills to create a commit

---

## Task 2: Different Content Hash Generation

### Files
- `tools/citation-manager/test/unit/ContentExtractor/generate-content-id.test.js` (MODIFY)

### Purpose
Validate different content produces different hashes (collision avoidance). Continues US2.2a AC2 validation.

### Step 1: Write failing test for different content hashes

Add to `generate-content-id.test.js`:

```javascript
describe("Content ID Generation - Collision Avoidance", () => {
  it("should generate different hashes for different content", () => {
    // Given: Two different content strings
    const content1 = "First piece of content";
    const content2 = "Second piece of content";

    // When: Generate content IDs for both
    const id1 = /* generateContentId(content1) */;
    const id2 = /* generateContentId(content2) */;

    // Then: Content IDs are different (collision avoidance)
    // Verification: SHA-256 uniqueness validated
    expect(id1).not.toBe(id2);
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- generate-content-id.test.js`

Expected: FAIL - Test not yet added

### Step 3: No implementation needed

Implementation from Task 1 already handles this case. SHA-256 naturally provides collision avoidance.

### Step 4: Run test to verify it passes

Run: `npm test -- generate-content-id.test.js`

Expected: PASS (2/2 tests)

### Step 5: Create commit for collision avoidance

Use `create-git-commit` skill to create a commit

---

## Task 3: Hash Truncation Format

### Files
- `tools/citation-manager/test/unit/ContentExtractor/generate-content-id.test.js` (MODIFY)

### Purpose
Validate hash output is exactly 16 hexadecimal characters (US2.2a AC2 format requirement).

### Step 1: Write failing test for hash truncation

Add to `generate-content-id.test.js`:

```javascript
describe("Content ID Generation - Format", () => {
  it("should truncate hash to exactly 16 hexadecimal characters", () => {
    // Given: Any content string
    const content = "Test content for format validation";

    // When: Generate content ID
    const contentId = /* generateContentId(content) */;

    // Then: Content ID is exactly 16 characters
    // Verification: Truncation to 16 chars per AC2
    expect(contentId).toHaveLength(16);

    // Then: Content ID contains only hexadecimal characters
    // Pattern: Validate hex format [0-9a-f]{16}
    expect(contentId).toMatch(/^[0-9a-f]{16}$/);
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- generate-content-id.test.js`

Expected: FAIL - Test not yet added

### Step 3: No implementation needed

Implementation from Task 1 already includes truncation to 16 characters.

### Step 4: Run test to verify it passes

Run: `npm test -- generate-content-id.test.js`

Expected: PASS (3/3 tests)

### Step 5: Create commit for hash format

Use `create-git-commit` skill to create a commit

---

## Task 4: Basic Deduplication Logic

### Files
- `tools/citation-manager/test/integration/ContentExtractor/content-deduplication.test.js` (CREATE)
- `tools/citation-manager/src/core/ContentExtractor/extractLinksContent.js` (MODIFY)

### Purpose
Implement core deduplication - multiple links with identical content stored once (US2.2a AC1, AC4).

### Step 1: Write failing test for basic deduplication

Create `tools/citation-manager/test/integration/ContentExtractor/content-deduplication.test.js`:

```javascript
import { /* Vitest functions */ } from 'vitest';
import { /* createContentExtractor */ } from '../../../src/factories/componentFactory.js';
import { /* path utilities */ } from 'path';

describe("Content Deduplication - Basic Logic", () => {
  it("should store identical content only once in extractedContentBlocks", async () => {
    // Fixture: Create test file with multiple links extracting identical content
    // Integration: Real ContentExtractor with real dependencies (no mocks)
    const extractor = /* createContentExtractor() */;
    const sourceFile = /* resolve('test/fixtures/us2.2a/duplicate-content-source.md') */;

    // When: Extract content from source with duplicate links
    const result = /* await extractor.extractLinksContent(sourceFile, { fullFiles: false }) */;

    // Then: Result has new deduplicated structure
    // Verification: New contract with extractedContentBlocks, outgoingLinksReport, stats
    expect(result).toHaveProperty('extractedContentBlocks');
    expect(result).toHaveProperty('outgoingLinksReport');
    expect(result).toHaveProperty('stats');

    // Then: Identical content stored once (deduplication confirmed)
    // Given: Test fixture has 3 links extracting same content
    const contentIds = /* Object.keys(result.extractedContentBlocks) */;

    // Verification: Single content block despite multiple links
    // Decision: Count unique content blocks vs total links
    expect(contentIds.length).toBe(1);  // Only 1 unique content block
    expect(result.outgoingLinksReport.processedLinks.length).toBe(3);  // But 3 links processed
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- content-deduplication.test.js`

Expected: FAIL - extractLinksContent returns flat array, not deduplicated structure

### Step 3: Refactor extractLinksContent to build deduplicated structure

Pseudocode for `extractLinksContent.js`:

```tsx
export async function extractLinksContent(
  sourceFilePath: string,
  cliFlags: object,
  dependencies: object
): Promise<DeduplicatedOutput> is
  // --- Phase 1: Validation (unchanged from US2.2) ---
  // Integration: Call CitationValidator for enriched links
  const validationResult = /* await citationValidator.validateFile(sourceFilePath) */;
  const enrichedLinks = validationResult.links;
  const sourceParsedDoc = /* await parsedFileCache.resolveParsedFile(sourceFilePath) */;

  // --- Phase 2: Initialize Deduplicated Structure ---
  // Pattern: Inline deduplication - build indexed structure during extraction
  const deduplicatedOutput = {
    extractedContentBlocks: {},  // contentId → { content, contentLength }
    outgoingLinksReport: {
      processedLinks: []  // Array of { sourceLink, contentId, status, ... }
    },
    stats: {
      totalLinks: 0,
      uniqueContent: 0,
      duplicateContentDetected: 0,
      tokensSaved: 0,
      compressionRatio: 0
    }
  };

  // --- Phase 3: Process Each Link with Deduplication ---
  FOR EACH link IN enrichedLinks DO
    deduplicatedOutput.stats.totalLinks++;

    // Decision: Skip validation errors (unchanged from US2.2)
    IF link.validation.status === 'error' THEN
      /* push to processedLinks with contentId: null, status: 'skipped' */
      CONTINUE

    // Decision: Check eligibility using strategy chain (unchanged from US2.2)
    const eligibilityDecision = /* analyzeEligibility(link, cliFlags, strategies) */;
    IF NOT eligibilityDecision.eligible THEN
      /* push to processedLinks with contentId: null, status: 'skipped' */
      CONTINUE

    // --- Content Extraction (unchanged from US2.2) ---
    TRY
      // Boundary: Extract content from target document
      const targetDoc = /* resolve target document (internal vs external) */;
      const extractedContent = /* extract via extractSection/extractBlock/extractFullContent */;

      // --- Deduplication Logic (NEW for US2.2a) ---
      // Integration: Generate content-based hash
      const contentId = /* generateContentId(extractedContent) */;

      // Pattern: Check if content already exists in index
      IF contentId NOT IN extractedContentBlocks THEN
        // Decision: First occurrence - create new index entry
        extractedContentBlocks[contentId] = {
          content: extractedContent,
          contentLength: extractedContent.length
        };
        deduplicatedOutput.stats.uniqueContent++;
      ELSE
        // Decision: Duplicate detected - track for statistics
        deduplicatedOutput.stats.duplicateContentDetected++;
        deduplicatedOutput.stats.tokensSaved += extractedContent.length;

      // Pattern: Add processed link with content ID reference
      /* outgoingLinksReport.processedLinks.push({
        sourceLink: link,
        contentId: contentId,
        status: 'success',
        eligibilityReason: eligibilityDecision.reason
      }) */;

    CATCH error
      // Decision: Extraction failed - null content reference
      /* push to processedLinks with contentId: null, status: 'error' */

  // --- Phase 4: Calculate Final Statistics ---
  // Pattern: Compression ratio = saved / (total + saved)
  const totalContentSize = /* sum all contentLength in extractedContentBlocks */;
  deduplicatedOutput.stats.compressionRatio =
    /* tokensSaved / (totalContentSize + tokensSaved) */;

  // Decision: Return deduplicated output as only public contract (AC9)
  return deduplicatedOutput;
```

### Step 4: Run test to verify it passes

Run: `npm test -- content-deduplication.test.js`

Expected: PASS (validates AC1, AC4 basic deduplication)

### Step 5: Create commit for deduplication logic

Use `create-git-commit` skill to create a commit

---

## Task 5: Content Index Structure

### Files
- `tools/citation-manager/test/integration/ContentExtractor/content-deduplication.test.js` (MODIFY)

### Purpose
Validate extractedContentBlocks index structure with all required fields (US2.2a AC5).

### Step 1: Write failing test for content index structure

Add to `content-deduplication.test.js`:

```javascript
describe("Content Deduplication - Index Structure", () => {
  it("should create index entries with content and contentLength", async () => {
    // Given: Source with extractable links
    const extractor = /* createContentExtractor() */;
    const sourceFile = /* resolve fixture */;

    // When: Extract content
    const result = /* await extractor.extractLinksContent(sourceFile, {}) */;

    // Then: Each index entry has complete structure
    // Verification: All required fields present per AC5
    const contentIds = /* Object.keys(result.extractedContentBlocks) */;
    expect(contentIds.length).toBeGreaterThan(0);

    const firstBlock = /* result.extractedContentBlocks[contentIds[0]] */;

    // Verification: Content field present (extracted text)
    expect(firstBlock).toHaveProperty('content');
    expect(typeof firstBlock.content).toBe('string');

    // Verification: ContentLength field present (character count)
    expect(firstBlock).toHaveProperty('contentLength');
    expect(firstBlock.contentLength).toBe(firstBlock.content.length);
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- content-deduplication.test.js`

Expected: FAIL - Index structure incomplete

### Step 3: Ensure index structure implementation is complete

Implementation from Task 4 should already create this structure. Verify all fields are populated.

### Step 4: Run test to verify it passes

Run: `npm test -- content-deduplication.test.js`

Expected: PASS (validates AC5 index structure)

### Step 5: Create commit for index structure

Use `create-git-commit` skill to create a commit

---

## Task 6: Source Tracking via ProcessedLinks

### Files
- `tools/citation-manager/test/integration/ContentExtractor/content-deduplication.test.js` (MODIFY)
- `tools/citation-manager/test/fixtures/us2.2a/duplicate-content-source.md` (CREATE)

### Purpose
Validate that source information for deduplicated content can be retrieved via processedLinks array (US2.2a AC4, AC5).

### Step 1: Write failing test for source tracking

Add to `content-deduplication.test.js`:

```javascript
describe("Content Deduplication - Source Tracking", () => {
  it("should track all source links that reference deduplicated content", async () => {
    // Fixture: File with 3 links extracting identical content
    // Research: Create fixture with duplicate section extractions
    const extractor = /* createContentExtractor() */;
    const sourceFile = /* resolve('test/fixtures/us2.2a/duplicate-content-source.md') */;

    // When: Extract content
    const result = /* await extractor.extractLinksContent(sourceFile, {}) */;

    // Then: Single content block with multiple links referencing it
    const contentIds = /* Object.keys(result.extractedContentBlocks) */;
    expect(contentIds.length).toBe(1);  // Only 1 unique content

    const sharedContentId = contentIds[0];

    // Verification: Multiple processedLinks reference the same contentId
    const linksForContent = result.outgoingLinksReport.processedLinks.filter(
      link => link.contentId === sharedContentId
    );
    expect(linksForContent).toHaveLength(3);

    // Verification: Each link preserves source metadata (AC5)
    const firstLink = linksForContent[0];
    expect(firstLink).toHaveProperty('linkTargetPathRaw');
    expect(firstLink).toHaveProperty('linkTargetAnchor');
    expect(firstLink).toHaveProperty('sourceLine');
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- content-deduplication.test.js`

Expected: FAIL - Test fixture missing or processedLinks not tracking correctly

### Step 3: Create test fixture and verify source tracking

Create `tools/citation-manager/test/fixtures/us2.2a/duplicate-content-source.md`:

```markdown
# Duplicate Content Test

Link 1: [[target-doc.md#Duplicate Section]]
Link 2: [[target-doc.md#Duplicate Section]]
Link 3: [[target-doc.md#Duplicate Section]]
```

Verify implementation tracks all links in processedLinks array from Task 4 code.

### Step 4: Run test to verify it passes

Run: `npm test -- content-deduplication.test.js`

Expected: PASS (validates AC4, AC5 source tracking via processedLinks)

### Step 5: Create commit for source tracking

Use `create-git-commit` skill to create a commit

---

## Task 7: ContentId References

### Files
- `tools/citation-manager/test/integration/ContentExtractor/content-deduplication.test.js` (MODIFY)

### Purpose
Validate processedLinks reference content via contentId, with null for failures (US2.2a AC6, AC8).

### Step 1: Write failing test for content ID references

Add to `content-deduplication.test.js`:

```javascript
describe("Content Deduplication - ContentId References", () => {
  it("should reference content via contentId in processedLinks", async () => {
    // Given: Mixed success/skipped/error links
    const extractor = /* createContentExtractor() */;
    const sourceFile = /* resolve fixture with mixed link types */;

    // When: Extract content
    const result = /* await extractor.extractLinksContent(sourceFile, {}) */;

    // Then: Successful links have valid contentId reference
    // Verification: contentId matches extractedContentBlocks key (AC6)
    const successLink = /* find first link with status === 'success' */;
    expect(successLink).toHaveProperty('contentId');
    expect(successLink.contentId).not.toBeNull();
    expect(result.extractedContentBlocks).toHaveProperty(successLink.contentId);

    // Then: Failed/skipped links have null contentId
    // Verification: Null reference with failure reason (AC8)
    const skippedLink = /* find first link with status === 'skipped' */;
    expect(skippedLink.contentId).toBeNull();
    expect(skippedLink).toHaveProperty('failureReason');
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- content-deduplication.test.js`

Expected: FAIL - contentId not present in processedLinks or not null for failures

### Step 3: Verify contentId reference implementation

Verify Task 4 implementation includes contentId in processedLinks structure for success cases, and null for skipped/error cases.

### Step 4: Run test to verify it passes

Run: `npm test -- content-deduplication.test.js`

Expected: PASS (validates AC6, AC8 content references)

### Step 5: Create commit for content references

Use `create-git-commit` skill to create a commit

---

## Task 8: Total Links Count

### Files
- `tools/citation-manager/test/integration/ContentExtractor/content-deduplication.test.js` (MODIFY)

### Purpose
Validate stats.totalLinks counts all processed links (US2.2a AC7).

### Step 1: Write failing test for total links count

Add to `content-deduplication.test.js`:

```javascript
describe("Content Deduplication - Statistics: Total Links", () => {
  it("should count all processed links in stats.totalLinks", async () => {
    // Given: File with mixed link statuses (success, skipped, error)
    const extractor = /* createContentExtractor() */;
    const sourceFile = /* resolve fixture */;

    // When: Extract content
    const result = /* await extractor.extractLinksContent(sourceFile, {}) */;

    // Then: totalLinks equals processedLinks array length
    // Verification: Counts all links regardless of status (AC7)
    expect(result.stats.totalLinks).toBe(result.outgoingLinksReport.processedLinks.length);

    // Verification: Includes success, skipped, AND error links
    const allStatuses = /* map processedLinks to status values */;
    expect(allStatuses).toContain('success');
    expect(result.stats.totalLinks).toBeGreaterThan(0);
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- content-deduplication.test.js`

Expected: FAIL - stats.totalLinks not calculated correctly

### Step 3: Verify total links counter in implementation

Verify Task 4 implementation increments stats.totalLinks for every processed link.

### Step 4: Run test to verify it passes

Run: `npm test -- content-deduplication.test.js`

Expected: PASS (validates AC7 total count)

### Step 5: Create commit for total links stat

Use `create-git-commit` skill to create a commit

---

## Task 9: Unique Content Count

### Files
- `tools/citation-manager/test/integration/ContentExtractor/content-deduplication.test.js` (MODIFY)

### Purpose
Validate stats.uniqueContent matches extractedContentBlocks size (US2.2a AC7).

### Step 1: Write failing test for unique content count

Add to `content-deduplication.test.js`:

```javascript
describe("Content Deduplication - Statistics: Unique Content", () => {
  it("should count unique content blocks in stats.uniqueContent", async () => {
    // Given: File with duplicate content extractions
    const extractor = /* createContentExtractor() */;
    const sourceFile = /* resolve('test/fixtures/us2.2a/duplicate-content-source.md') */;

    // When: Extract content
    const result = /* await extractor.extractLinksContent(sourceFile, {}) */;

    // Then: uniqueContent equals number of keys in extractedContentBlocks
    // Verification: Unique count matches index size (AC7)
    const uniqueCount = /* Object.keys(result.extractedContentBlocks).length */;
    expect(result.stats.uniqueContent).toBe(uniqueCount);

    // Given: 3 links extracting identical content = 1 unique
    expect(result.stats.uniqueContent).toBe(1);
    expect(result.stats.totalLinks).toBe(3);
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- content-deduplication.test.js`

Expected: FAIL - stats.uniqueContent not matching index size

### Step 3: Verify unique content counter in implementation

Verify Task 4 implementation increments stats.uniqueContent when creating new index entries.

### Step 4: Run test to verify it passes

Run: `npm test -- content-deduplication.test.js`

Expected: PASS (validates AC7 unique count)

### Step 5: Create commit for unique content stat

Use `create-git-commit` skill to create a commit

---

## Task 10: Duplicate Content Detected Count

### Files
- `tools/citation-manager/test/integration/ContentExtractor/content-deduplication.test.js` (MODIFY)

### Purpose
Validate stats.duplicateContentDetected counts reused content (US2.2a AC7).

### Step 1: Write failing test for duplicate count

Add to `content-deduplication.test.js`:

```javascript
describe("Content Deduplication - Statistics: Duplicate Detection", () => {
  it("should count duplicate content detections in stats.duplicateContentDetected", async () => {
    // Given: File with 3 links extracting identical content
    const extractor = /* createContentExtractor() */;
    const sourceFile = /* resolve('test/fixtures/us2.2a/duplicate-content-source.md') */;

    // When: Extract content
    const result = /* await extractor.extractLinksContent(sourceFile, {}) */;

    // Then: duplicateContentDetected counts reuses (not first occurrence)
    // Verification: First occurrence creates entry, next 2 are duplicates
    // Pattern: totalLinks - uniqueContent = duplicates
    expect(result.stats.duplicateContentDetected).toBe(2);  // 3 total - 1 unique = 2 duplicates

    // Verification: Formula validation
    expect(result.stats.duplicateContentDetected).toBe(
      result.stats.totalLinks - result.stats.uniqueContent
    );
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- content-deduplication.test.js`

Expected: FAIL - stats.duplicateContentDetected not counting correctly

### Step 3: Verify duplicate counter in implementation

Verify Task 4 implementation increments stats.duplicateContentDetected when contentId already exists in index.

### Step 4: Run test to verify it passes

Run: `npm test -- content-deduplication.test.js`

Expected: PASS (validates AC7 duplicate count)

### Step 5: Create commit for duplicate stat

Use `create-git-commit` skill to create a commit

---

## Task 11: Tokens Saved Calculation

### Files
- `tools/citation-manager/test/integration/ContentExtractor/content-deduplication.test.js` (MODIFY)

### Purpose
Validate stats.tokensSaved accumulates deduplicated content length (US2.2a AC7).

### Step 1: Write failing test for tokens saved

Add to `content-deduplication.test.js`:

```javascript
describe("Content Deduplication - Statistics: Tokens Saved", () => {
  it("should accumulate saved tokens in stats.tokensSaved", async () => {
    // Given: File with duplicate content (known length)
    const extractor = /* createContentExtractor() */;
    const sourceFile = /* resolve('test/fixtures/us2.2a/duplicate-content-source.md') */;

    // When: Extract content
    const result = /* await extractor.extractLinksContent(sourceFile, {}) */;

    // Then: tokensSaved equals sum of duplicate content lengths
    // Pattern: If content is 100 chars and appears 3 times, saved = 200 (2 duplicates × 100)
    const contentBlock = /* result.extractedContentBlocks[Object.keys(...)[0]] */;
    const expectedSaved = contentBlock.contentLength * result.stats.duplicateContentDetected;

    // Verification: Tokens saved calculated correctly (AC7)
    expect(result.stats.tokensSaved).toBe(expectedSaved);
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- content-deduplication.test.js`

Expected: FAIL - stats.tokensSaved not accumulating

### Step 3: Verify tokens saved accumulator in implementation

Verify Task 4 implementation accumulates content length when duplicates detected.

### Step 4: Run test to verify it passes

Run: `npm test -- content-deduplication.test.js`

Expected: PASS (validates AC7 tokens saved)

### Step 5: Create commit for tokens saved

Use `create-git-commit` skill to create a commit

---

## Task 12: Compression Ratio Calculation

### Files
- `tools/citation-manager/test/integration/ContentExtractor/content-deduplication.test.js` (MODIFY)

### Purpose
Validate stats.compressionRatio formula: saved / (total + saved) (US2.2a AC7).

### Step 1: Write failing test for compression ratio

Add to `content-deduplication.test.js`:

```javascript
describe("Content Deduplication - Statistics: Compression Ratio", () => {
  it("should calculate compression ratio as saved / (total + saved)", async () => {
    // Given: File with known duplicate content
    const extractor = /* createContentExtractor() */;
    const sourceFile = /* resolve('test/fixtures/us2.2a/duplicate-content-source.md') */;

    // When: Extract content
    const result = /* await extractor.extractLinksContent(sourceFile, {}) */;

    // Then: Calculate expected compression ratio
    // Pattern: Sum all contentLength values in extractedContentBlocks
    const totalContentSize = /* sum contentLength across all blocks */;
    const tokensSaved = result.stats.tokensSaved;

    // Verification: Compression ratio formula (AC7)
    const expectedRatio = tokensSaved / (totalContentSize + tokensSaved);
    expect(result.stats.compressionRatio).toBeCloseTo(expectedRatio, 5);  // 5 decimal places
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- content-deduplication.test.js`

Expected: FAIL - stats.compressionRatio not calculated

### Step 3: Implement compression ratio calculation

Verify Task 4 implementation calculates compression ratio in final statistics phase.

### Step 4: Run test to verify it passes

Run: `npm test -- content-deduplication.test.js`

Expected: PASS (validates AC7 compression ratio)

### Step 5: Create commit for compression ratio

Use `create-git-commit` skill to create a commit

---

## Task 13: Successful Link Metadata Preservation

### Files
- `tools/citation-manager/test/integration/ContentExtractor/content-deduplication.test.js` (MODIFY)

### Purpose
Validate processedLinks preserves all metadata for successful extractions (US2.2a AC6).

### Step 1: Write failing test for successful link metadata

Add to `content-deduplication.test.js`:

```javascript
describe("Content Deduplication - Output Structure: Success Metadata", () => {
  it("should preserve all link metadata for successful extractions", async () => {
    // Given: File with successful extractions
    const extractor = /* createContentExtractor() */;
    const sourceFile = /* resolve fixture */;

    // When: Extract content
    const result = /* await extractor.extractLinksContent(sourceFile, {}) */;

    // Then: Find successful link
    const successLink = /* find link with status === 'success' */;

    // Verification: All required metadata present (AC6)
    expect(successLink).toHaveProperty('sourceLink');  // Original LinkObject
    expect(successLink).toHaveProperty('contentId');  // Content reference
    expect(successLink).toHaveProperty('status');  // 'success'
    expect(successLink.status).toBe('success');
    expect(successLink).toHaveProperty('eligibilityReason');  // Why extracted

    // Verification: sourceLink has all original metadata
    expect(successLink.sourceLink).toHaveProperty('sourceLine');
    expect(successLink.sourceLink).toHaveProperty('sourceColumn');
    expect(successLink.sourceLink).toHaveProperty('linkText');
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- content-deduplication.test.js`

Expected: FAIL - Metadata incomplete in processedLinks

### Step 3: Verify metadata preservation in implementation

Verify Task 4 implementation preserves all sourceLink metadata when creating processedLinks entries.

### Step 4: Run test to verify it passes

Run: `npm test -- content-deduplication.test.js`

Expected: PASS (validates AC6 success metadata)

### Step 5: Create commit for success metadata

Use `create-git-commit` skill to create a commit

---

## Task 14: Skipped Link Metadata

### Files
- `tools/citation-manager/test/integration/ContentExtractor/content-deduplication.test.js` (MODIFY)

### Purpose
Validate skipped links have null contentId with failure reason (US2.2a AC8).

### Step 1: Write failing test for skipped link metadata

Add to `content-deduplication.test.js`:

```javascript
describe("Content Deduplication - Output Structure: Skipped Links", () => {
  it("should include skipped links with null contentId and failure reason", async () => {
    // Given: File with ineligible links (e.g., full-file without flag)
    const extractor = /* createContentExtractor() */;
    const sourceFile = /* resolve fixture with full-file links */;

    // When: Extract without --full-files flag
    const result = /* await extractor.extractLinksContent(sourceFile, { fullFiles: false }) */;

    // Then: Find skipped link
    const skippedLink = /* find link with status === 'skipped' */;

    // Verification: Null contentId for skipped links (AC8)
    expect(skippedLink.contentId).toBeNull();
    expect(skippedLink.status).toBe('skipped');

    // Verification: Failure reason explains why skipped
    expect(skippedLink).toHaveProperty('failureReason');
    expect(typeof skippedLink.failureReason).toBe('string');
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- content-deduplication.test.js`

Expected: FAIL - Skipped links missing proper metadata

### Step 3: Verify skipped link handling in implementation

Verify Task 4 implementation sets contentId to null and includes failureReason for skipped links.

### Step 4: Run test to verify it passes

Run: `npm test -- content-deduplication.test.js`

Expected: PASS (validates AC8 skipped metadata)

### Step 5: Create commit for skipped metadata

Use `create-git-commit` skill to create a commit

---

## Task 15: Error Link Metadata

### Files
- `tools/citation-manager/test/integration/ContentExtractor/content-deduplication.test.js` (MODIFY)

### Purpose
Validate error links have null contentId with failure reason (US2.2a AC8).

### Step 1: Write failing test for error link metadata

Add to `content-deduplication.test.js`:

```javascript
describe("Content Deduplication - Output Structure: Error Links", () => {
  it("should include error links with null contentId and failure reason", async () => {
    // Given: File with broken links (validation errors)
    const extractor = /* createContentExtractor() */;
    const sourceFile = /* resolve fixture with invalid links */;

    // When: Extract content
    const result = /* await extractor.extractLinksContent(sourceFile, {}) */;

    // Then: Find error link
    const errorLink = /* find link with status === 'error' */;

    // Verification: Null contentId for error links (AC8)
    expect(errorLink.contentId).toBeNull();
    expect(errorLink.status).toBe('error');

    // Verification: Failure reason explains extraction error
    expect(errorLink).toHaveProperty('failureReason');
    expect(errorLink.failureReason).toContain('error');  // Contains error description
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- content-deduplication.test.js`

Expected: FAIL - Error links missing proper metadata

### Step 3: Verify error link handling in implementation

Verify Task 4 implementation sets contentId to null and includes failureReason for error links.

### Step 4: Run test to verify it passes

Run: `npm test -- content-deduplication.test.js`

Expected: PASS (validates AC8 error metadata)

### Step 5: Create commit for error metadata

Use `create-git-commit` skill to create a commit

---

## Task 16: Complete Stats Object Population

### Files
- `tools/citation-manager/test/integration/ContentExtractor/content-deduplication.test.js` (MODIFY)

### Purpose
Validate complete stats object with all five fields in final output (US2.2a AC7).

### Step 1: Write failing test for complete stats

Add to `content-deduplication.test.js`:

```javascript
describe("Content Deduplication - Output Structure: Complete Stats", () => {
  it("should populate all five statistics fields accurately", async () => {
    // Given: File with mixed extraction results
    const extractor = /* createContentExtractor() */;
    const sourceFile = /* resolve fixture */;

    // When: Extract content
    const result = /* await extractor.extractLinksContent(sourceFile, {}) */;

    // Then: All five stat fields present
    // Verification: Complete stats object per AC7
    expect(result.stats).toHaveProperty('totalLinks');
    expect(result.stats).toHaveProperty('uniqueContent');
    expect(result.stats).toHaveProperty('duplicateContentDetected');
    expect(result.stats).toHaveProperty('tokensSaved');
    expect(result.stats).toHaveProperty('compressionRatio');

    // Verification: All stats are numeric and valid
    expect(typeof result.stats.totalLinks).toBe('number');
    expect(typeof result.stats.uniqueContent).toBe('number');
    expect(typeof result.stats.duplicateContentDetected).toBe('number');
    expect(typeof result.stats.tokensSaved).toBe('number');
    expect(typeof result.stats.compressionRatio).toBe('number');

    // Verification: Stats are internally consistent
    expect(result.stats.totalLinks).toBeGreaterThanOrEqual(result.stats.uniqueContent);
    expect(result.stats.compressionRatio).toBeGreaterThanOrEqual(0);
    expect(result.stats.compressionRatio).toBeLessThanOrEqual(1);
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- content-deduplication.test.js`

Expected: FAIL - Stats object incomplete

### Step 3: Verify complete stats implementation

Verify Task 4 implementation populates all five statistics fields.

### Step 4: Run test to verify it passes

Run: `npm test -- content-deduplication.test.js`

Expected: PASS (validates AC7 complete stats)

### Step 5: Create commit for complete stats

Use `create-git-commit` skill to create a commit

---

## Task 17: SHA-256 Content-Based Hashing

### Files
- `tools/citation-manager/test/integration/ContentExtractor/content-deduplication.test.js` (MODIFY)

### Purpose
Validate deduplication uses content-based SHA-256 hashing (US2.2a AC2 acceptance test).

### Step 1: Write failing test for content-based hashing

Add to `content-deduplication.test.js`:

```javascript
describe("US2.2a Acceptance - SHA-256 Content Hashing", () => {
  it("should deduplicate based on content hash, not file/anchor identity", async () => {
    // Fixture: Create files with identical content at different locations
    // Research: Same section content in different files should deduplicate
    const extractor = /* createContentExtractor() */;
    const sourceFile = /* resolve('test/fixtures/us2.2a/cross-file-duplicates.md') */;

    // When: Extract content from different files with identical text
    const result = /* await extractor.extractLinksContent(sourceFile, {}) */;

    // Then: Content deduplicated despite different file paths
    // Verification: Content-based hashing, not identity-based (AC2)
    const contentIds = /* Object.keys(result.extractedContentBlocks) */;

    // Given: 2 different files with identical section content
    const processedCount = /* count processedLinks with status === 'success' */;
    expect(processedCount).toBe(2);  // 2 links processed
    expect(contentIds.length).toBe(1);  // But only 1 unique content block

    // Verification: processedLinks tracks both different source files
    const sharedContentId = contentIds[0];
    const linksForContent = result.outgoingLinksReport.processedLinks.filter(
      link => link.contentId === sharedContentId
    );
    expect(linksForContent).toHaveLength(2);

    // Pattern: Different linkTargetPathRaw values prove cross-file deduplication
    const paths = /* map linksForContent to linkTargetPathRaw */;
    expect(new Set(paths).size).toBe(2);  // 2 different file paths
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- content-deduplication.test.js`

Expected: FAIL - Fixture missing or cross-file deduplication not working

### Step 3: Create cross-file test fixture

Create additional fixtures demonstrating content-based hashing across different files.

### Step 4: Run test to verify it passes

Run: `npm test -- content-deduplication.test.js`

Expected: PASS (validates AC2 acceptance)

### Step 5: Create commit for content hashing AC

Use `create-git-commit` skill to create a commit

---

## Task 18: Three-Group Output Structure

### Files
- `tools/citation-manager/test/integration/ContentExtractor/content-deduplication.test.js` (MODIFY)

### Purpose
Validate output structure has three logical groups matching schema (US2.2a AC3 acceptance test).

### Step 1: Write failing test for three-group structure

Add to `content-deduplication.test.js`:

```javascript
describe("US2.2a Acceptance - Three-Group Structure", () => {
  it("should organize output into extractedContentBlocks, outgoingLinksReport, and stats", async () => {
    // Given: Any extraction workflow
    const extractor = /* createContentExtractor() */;
    const sourceFile = /* resolve fixture */;

    // When: Extract content
    const result = /* await extractor.extractLinksContent(sourceFile, {}) */;

    // Then: Three top-level groups present (AC3)
    // Verification: Schema validation for OutgoingLinksExtractedContent
    expect(Object.keys(result)).toHaveLength(3);
    expect(result).toHaveProperty('extractedContentBlocks');
    expect(result).toHaveProperty('outgoingLinksReport');
    expect(result).toHaveProperty('stats');

    // Verification: No flat array format (old contract removed)
    expect(Array.isArray(result)).toBe(false);

    // Verification: extractedContentBlocks is object (index)
    expect(typeof result.extractedContentBlocks).toBe('object');
    expect(Array.isArray(result.extractedContentBlocks)).toBe(false);

    // Verification: outgoingLinksReport has processedLinks array
    expect(result.outgoingLinksReport).toHaveProperty('processedLinks');
    expect(Array.isArray(result.outgoingLinksReport.processedLinks)).toBe(true);

    // Verification: stats is object with aggregate metrics
    expect(typeof result.stats).toBe('object');
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- content-deduplication.test.js`

Expected: FAIL - Structure validation incomplete

### Step 3: Verify three-group structure in implementation

Verify Task 4 implementation returns object with exactly three top-level properties.

### Step 4: Run test to verify it passes

Run: `npm test -- content-deduplication.test.js`

Expected: PASS (validates AC3 acceptance)

### Step 5: Create commit for structure AC

Use `create-git-commit` skill to create a commit

---

## Task 19: Compression Ratio Presence

### Files
- `tools/citation-manager/test/integration/ContentExtractor/content-deduplication.test.js` (MODIFY)

### Purpose
Validate stats.compressionRatio field exists and calculates correctly (US2.2a AC7 acceptance test).

### Step 1: Write failing test for compression ratio presence

Add to `content-deduplication.test.js`:

```javascript
describe("US2.2a Acceptance - Compression Ratio", () => {
  it("should include compressionRatio in stats with correct calculation", async () => {
    // Given: File with known duplication pattern
    const extractor = /* createContentExtractor() */;
    const sourceFile = /* resolve('test/fixtures/us2.2a/duplicate-content-source.md') */;

    // When: Extract content
    const result = /* await extractor.extractLinksContent(sourceFile, {}) */;

    // Then: compressionRatio field present in stats (AC7)
    expect(result.stats).toHaveProperty('compressionRatio');

    // Verification: Ratio calculated per formula: saved / (total + saved)
    const totalSize = /* sum all contentLength in extractedContentBlocks */;
    const saved = result.stats.tokensSaved;
    const expectedRatio = saved / (totalSize + saved);

    expect(result.stats.compressionRatio).toBeCloseTo(expectedRatio, 5);

    // Verification: Ratio between 0 and 1 (percentage as decimal)
    expect(result.stats.compressionRatio).toBeGreaterThanOrEqual(0);
    expect(result.stats.compressionRatio).toBeLessThanOrEqual(1);
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- content-deduplication.test.js`

Expected: FAIL - Compression ratio validation incomplete

### Step 3: Verify compression ratio in implementation

Verify Task 4 implementation includes compressionRatio in stats object.

### Step 4: Run test to verify it passes

Run: `npm test -- content-deduplication.test.js`

Expected: PASS (validates AC7 acceptance)

### Step 5: Create commit for compression ratio AC

Use `create-git-commit` skill to create a commit

---

## Task 20: Complete Deduplication Pipeline

### Files
- `tools/citation-manager/test/integration/ContentExtractor/content-deduplication.test.js` (MODIFY)
- `tools/citation-manager/test/fixtures/us2.2a/comprehensive-test.md` (CREATE)
- `tools/citation-manager/test/fixtures/us2.2a/target-1.md` (CREATE)
- `tools/citation-manager/test/fixtures/us2.2a/target-2.md` (CREATE)

### Purpose
End-to-end test with comprehensive fixture covering all scenarios (US2.2a AC10 acceptance test).

### Step 1: Write failing test for complete pipeline

Add to `content-deduplication.test.js`:

```javascript
describe("US2.2a Acceptance - Complete Pipeline", () => {
  it("should handle complete extraction with duplicates, unique content, and errors", async () => {
    // Fixture: Comprehensive test file with:
    // - Multiple links extracting identical sections (duplicates)
    // - Links extracting different sections (unique)
    // - Mix of section/block/full-file links
    // - Skipped links (ineligible)
    // - Error links (validation failures)
    // Integration: Real components (no mocks)
    const extractor = /* createContentExtractor() */;
    const sourceFile = /* resolve('test/fixtures/us2.2a/comprehensive-test.md') */;

    // When: Complete pipeline executes
    const result = /* await extractor.extractLinksContent(sourceFile, { fullFiles: false }) */;

    // Then: Validate complete deduplicated output structure
    // Verification: Three-group structure (AC3)
    expect(result).toHaveProperty('extractedContentBlocks');
    expect(result).toHaveProperty('outgoingLinksReport');
    expect(result).toHaveProperty('stats');

    // Verification: Deduplication working (AC1, AC4)
    const uniqueBlocks = /* Object.keys(result.extractedContentBlocks).length */;
    const totalLinks = result.stats.totalLinks;
    expect(uniqueBlocks).toBeLessThan(totalLinks);  // Deduplication occurred

    // Verification: Statistics accurate (AC7)
    expect(result.stats.uniqueContent).toBe(uniqueBlocks);
    expect(result.stats.duplicateContentDetected).toBeGreaterThan(0);
    expect(result.stats.tokensSaved).toBeGreaterThan(0);
    expect(result.stats.compressionRatio).toBeGreaterThan(0);

    // Verification: Source tracking via processedLinks (AC5)
    const firstContentId = /* Object.keys(result.extractedContentBlocks)[0] */;
    const linksForContent = result.outgoingLinksReport.processedLinks.filter(
      link => link.contentId === firstContentId
    );
    expect(linksForContent.length).toBeGreaterThan(0);

    // Verification: Mixed statuses present (AC6, AC8)
    const statuses = /* map processedLinks to status */;
    expect(statuses).toContain('success');
    expect(statuses.some(s => s === 'skipped' || s === 'error')).toBe(true);

    // Verification: Content references correct (AC6, AC8)
    const successLinks = /* filter processedLinks where status === 'success' */;
    const failedLinks = /* filter processedLinks where status !== 'success' */;

    /* for each successLink: expect contentId to be non-null and in extractedContentBlocks */
    /* for each failedLink: expect contentId to be null and failureReason present */
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- content-deduplication.test.js`

Expected: FAIL - Comprehensive fixture missing or validation incomplete

### Step 3: Create comprehensive test fixtures

Create `comprehensive-test.md`, `target-1.md`, `target-2.md` with varied extraction scenarios.

### Step 4: Run test to verify it passes

Run: `npm test -- content-deduplication.test.js`

Expected: PASS (validates AC10 complete pipeline)

### Step 5: Create commit for pipeline acceptance

Use `create-git-commit` skill to create a commit

---

## Task 21: Update Documentation Post-Implementation

### Files
- `tools/citation-manager/design-docs/features/20251003-content-aggregation/content-aggregation-prd.md` (MODIFY)
- `tools/citation-manager/design-docs/features/20251003-content-aggregation/content-aggregation-architecture.md` (MODIFY)
- `tools/citation-manager/design-docs/component-guides/Content Extractor Implementation Guide.md` (MODIFY)

### Purpose
Synchronize all architectural and design documentation with final US2.2a implementation, ensuring accuracy for future development

### Step 1: Review implementation against planned architecture

```bash
git diff main -- tools/citation-manager/src/core/ContentExtractor/
```

Expected: Identify deviations from planned structure (extractLinksContent.js refactored, generateContentId.js created)

### Step 2: Update PRD status and changelog

Edit `content-aggregation-prd.md`:

1. Update Story 2.2a status (line ~386):

```markdown
_Status_: ✅ COMPLETE (2025-10-28)
```

1. Add changelog entry (find changelog table):

```markdown
| Date       | Version | Description                                                                                                                     | Author                                    |
| ---------- | ------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| 2025-10-28 | 2.x     | Mark US2.2a as COMPLETE - Content deduplication via SHA-256 hashing, three-group output structure, compression statistics     | Application Tech Lead (Claude Sonnet 4.5) |
```

1. Document any discovered limitations in Story 2.2a section if applicable

### Step 3: Update architecture document

Edit `content-aggregation-architecture.md`:

1. **Update ContentExtractor component description**:
   - Confirm extractLinksContent() now returns deduplicated structure
   - Add generateContentId() utility to component interface
   - Update output structure documentation

2. **Update file structure section**:
   - Add `generateContentId.js` to utility files list
   - Confirm extractLinksContent.js refactoring matches documentation

3. **Update sequence diagrams**:
   - Ensure deduplication workflow reflected in diagrams
   - Add hash generation step if not present

4. **Update technical debt tracking**:
   - Note nested content duplication as known limitation (H2 containing H3)
   - Mark any resolved items as RESOLVED

5. **Update "Last Updated" timestamp** at document end

### Step 4: Update Content Extractor Implementation Guide

Edit `Content Extractor Implementation Guide.md`:

1. **Update Public Contracts section**:
   - Replace OutgoingLinksExtractedContent[] with DeduplicatedOutput structure
   - Document three-group structure: extractedContentBlocks, outgoingLinksReport, stats
   - Update return type documentation

2. **Update Utility Functions section**:
   - Add generateContentId() documentation
   - Include SHA-256 hashing details
   - Note truncation to 16 hex chars

3. **Update Testing Strategy section**:
   - Confirm deduplication test coverage (Tasks 4-20)
   - Note hash generation unit tests
   - Note statistics calculation validation

4. **Add Known Limitations section** (if not present):
   - Document nested content duplication limitation
   - Note that H2 containing H3 subsections may have partial duplication
   - Reference technical debt item

### Step 5: Validate documentation

```bash
# Validate markdown formatting
markdownlint "tools/citation-manager/design-docs/**/*.md"

# Validate citations in updated documents
npm run citation:validate tools/citation-manager/design-docs/features/20251003-content-aggregation/content-aggregation-prd.md -- --scope /Users/wesleyfrederick/Documents/ObsidianVaultNew/0_SoftwareDevelopment/cc-workflows
npm run citation:validate tools/citation-manager/design-docs/features/20251003-content-aggregation/content-aggregation-architecture.md -- --scope /Users/wesleyfrederick/Documents/ObsidianVaultNew/0_SoftwareDevelopment/cc-workflows
npm run citation:validate tools/citation-manager/design-docs/component-guides/Content\ Extractor\ Implementation\ Guide.md -- --scope /Users/wesleyfrederick/Documents/ObsidianVaultNew/0_SoftwareDevelopment/cc-workflows
```

Expected: All markdown linting passes, all citations validate without errors

### Step 6: Run complete test suite

```bash
npm test
```

Expected output:
- All US2.1 tests pass (35+ tests from eligibility strategies) - zero regressions
- All US2.2 tests pass (content retrieval tests)
- All US2.2a tests pass (20 new deduplication tests from Tasks 1-20)
- Zero test failures

### Step 7: Create comprehensive final commit

After documentation updates and test verification complete, create the final commit:

```bash
git add .
git commit -m "feat(us2.2a): implement content deduplication with SHA-256 hashing

Complete implementation of US2.2a with all 10 acceptance criteria:
- AC1: Deduplicate extracted content internally, optimized output structure
- AC2: SHA-256 content-based hashing, truncated to 16 hex characters
- AC3: Three-group output: extractedContentBlocks, outgoingLinksReport, stats
- AC4: Multiple links with identical content stored once, sources tracked
- AC5: Each content block includes text, character count, source metadata
- AC6: Processed links reference content via contentId with source metadata
- AC7: Statistics include all five metrics with compression ratio
- AC8: Failed/skipped links have null contentId with failure reasons
- AC9: extractLinksContent() returns deduplicated output as only public contract
- AC10: Integration tests validate hashing, deduplication, statistics

Technical implementation:
- Created generateContentId.js with SHA-256 hashing utility
- Refactored extractLinksContent.js for inline single-pass deduplication
- Build indexed structure during extraction (no post-processing)
- Track first occurrence vs duplicates for statistics
- Preserve all link metadata through transformation
- Calculate compression ratio: saved / (total + saved)
- Added 20 integration tests covering all acceptance criteria
- Created comprehensive test fixtures for deduplication scenarios
- Zero regressions - all US2.1 and US2.2 tests pass
- Updated all architectural documentation post-implementation

Architecture: Single-pass inline deduplication using content-based hashing
Testing: 105 steps across 21 tasks, TDD (RED-GREEN-REFACTOR) throughout
Documentation: PRD, architecture docs, and implementation guides synchronized
Known Limitations: Nested content duplication (H2 containing H3) out of scope

US2.2a COMPLETE"
```

**Note:** This final commit represents the complete, tested US2.2a feature. All previous work was tracked via git commits with full attribution.

### Success Criteria

- ✅ All documentation files pass markdown linting
- ✅ All citations validate without errors using proper --scope flag
- ✅ Component descriptions match actual implementation
- ✅ generateContentId() utility documented
- ✅ Deduplicated output structure documented with schema
- ✅ Known limitations documented (nested content duplication)
- ✅ US2.2a marked as complete in PRD with date
- ✅ Changelog updated with completion entry
- ✅ All tests pass (US2.1 + US2.2 + US2.2a) - zero regressions

---

## Bugs/Known Issues

### Post-Implementation QA Report (2025-10-28)

**Code Review Status:** APPROVE WITH CONDITIONS
**Quality Score:** 8.5/10
**Test Results:** 220/252 tests passing (20/20 US2.2a tests ✅, 32 US2.2 regression failures ⚠️)

#### CRITICAL Issues (Must Fix Before Merge)

1. **Backward Compatibility Broken - 32 Regression Test Failures** (Priority: P0)
   - **Impact**: All US2.2 tests expect old `ExtractionResult[]` array format, now returns `OutgoingLinksExtractedContent` object
   - **Root Cause**: Return type changed without updating existing tests (expected per AC9)
   - **Files Affected**: 9 test files (us2.2-acceptance-criteria.test.js, content-extraction-workflow.test.js, etc.)
   - **Fix Required**: Update all US2.2 tests to expect new structure:

     ```javascript
     // Old: expect(Array.isArray(results)).toBe(true);
     // New: expect(results).toHaveProperty('extractedContentBlocks');
     ```

   - **Estimated Effort**: 2-3 hours

2. **PRD Status Not Updated to Complete** (Priority: P1)
   - **Impact**: Documentation incorrectly shows story as incomplete
   - **Location**: `content-aggregation-prd.md` line 386
   - **Current**: `_Status_: Pending`
   - **Required**: `_Status_: ✅ COMPLETE (2025-10-28)`
   - **Also Missing**: Changelog entry per Task 21 requirements
   - **Estimated Effort**: 5 minutes

#### IMPORTANT Issues (Should Fix Before Merge)

1. **Division by Zero Risk in Compression Ratio** (Priority: P2)
   - **Impact**: Potential `NaN` value when all links fail extraction (totalContentSize = 0, tokensSaved = 0)
   - **Location**: `extractLinksContent.js` lines 162-164
   - **Fix Required**:

     ```javascript
     deduplicatedOutput.stats.compressionRatio =
       (totalContentSize + deduplicatedOutput.stats.tokensSaved) === 0
         ? 0
         : deduplicatedOutput.stats.tokensSaved /
           (totalContentSize + deduplicatedOutput.stats.tokensSaved);
     ```

   - **Estimated Effort**: 5 minutes

#### Suggestions (Nice to Have)

1. **Return Type Documentation** (Priority: P3)
   - **Location**: JSDoc comment at line 15 in `extractLinksContent.js`
   - **Current**: `Promise<Object>`
   - **Recommended**: `Promise<OutgoingLinksExtractedContent>`

2. **Test Fixture Documentation** (Priority: P4)
   - **Recommendation**: Add `README.md` in `/test/fixtures/us2.2a/` explaining fixture scenarios
   - **Benefit**: Helps future developers understand test coverage

#### Implementation Strengths

- ✅ All 10 acceptance criteria met with comprehensive test coverage
- ✅ Clean architecture: Single-pass inline deduplication
- ✅ Proper SHA-256 implementation with 16-char truncation
- ✅ Excellent test organization (Given-When-Then with strategic comments)
- ✅ Content-based hashing enables cross-file deduplication
- ✅ Strategic comments (Boundary/Integration/Pattern/Decision) match plan pseudocode

#### Known Limitations (By Design)

- **Nested Content Duplication**: H2 sections containing H3 subsections may have partial duplication (documented in PRD, out of scope for US2.2a)

---

## Execution Handoff

**Plan complete and saved to:** `tools/citation-manager/design-docs/features/20251003-content-aggregation/user-stories/us2.2a-implement-content-deduplication/us2.2a-implement-content-deduplication-implement-plan.md`

### Implementation Summary

**Initial Setup:**
- Create baseline commit before starting work

**21 Tasks with TDD approach:**
1. ✅ Hash determinism (identical content → identical hash) → commit
2. ✅ Hash collision avoidance (different content → different hash) → commit
3. ✅ Hash format (16 hex chars) → commit
4. ✅ Basic deduplication logic (inline index building) → commit
5. ✅ Content index structure (content, contentLength) → commit
6. ✅ Source tracking via processedLinks (filter by contentId) → commit
7. ✅ ContentId references (success vs null) → commit
8. ✅ Total links count statistics → commit
9. ✅ Unique content count statistics → commit
10. ✅ Duplicate content detected count → commit
11. ✅ Tokens saved calculation → commit
12. ✅ Compression ratio formula → commit
13. ✅ Successful link metadata preservation → commit
14. ✅ Skipped link metadata (null contentId + reason) → commit
15. ✅ Error link metadata (null contentId + reason) → commit
16. ✅ Complete stats object validation → commit
17. ✅ SHA-256 content-based hashing acceptance → commit
18. ✅ Three-group structure acceptance → commit
19. ✅ Compression ratio presence acceptance → commit
20. ✅ Complete deduplication pipeline end-to-end → commit
21. ✅ Documentation updates + regression verification → comprehensive final commit

**Total Steps:** ~105 steps across 21 tasks
**Pattern:** Test-first (RED-GREEN-REFACTOR) throughout
**Architecture:** Single-pass inline deduplication, content-based hashing, three-group output
**Git Strategy:** commits after each task (1-20) for granular tracking, single comprehensive commit after task 21

### commit Benefits

- **Granular Progress Tracking**: Each task completion captured with full attribution
- **Easy Rollback**: Can return to any task completion state if issues discovered
- **AI Attribution**: All work clearly attributed to claude-sonnet-4-5 model
- **Clean History**: Single commit represents complete, tested US2.2a feature
- **Detailed Context**: Full descriptions preserved at each commit for future reference

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
- Batch execution with commits
- **Command:** Load this plan file in new session

### Ready to Execute

All tasks scaffolded with MEDIUM-IMPLEMENTATION pseudocode. Dev agent has:
- Clear test expectations (Given-When-Then with Research/Fixture/Integration/Verification comments)
- Implementation pseudocode with strategic comments (Boundary/Integration/Pattern/Decision)
- Exact file paths
- commit commands (Tasks 1-20) and final commit command (Task 21)
- Expected outputs and test counts

**Git commit Workflow:**
1. Initial baseline: `git commit "claude-sonnet-4-5" "pre-us2.2a-baseline" "..."`
2. After each task: `git commit "claude-sonnet-4-5" "task-N-description" "..."`
3. After Task 21: `git commit -m "feat(us2.2a): implement content deduplication..."`

---
