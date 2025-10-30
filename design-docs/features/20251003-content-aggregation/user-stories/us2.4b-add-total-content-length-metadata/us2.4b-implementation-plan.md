# US2.4b: Add Total Content Length Metadata - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development for all implementation tasks.

**Goal:** Add `_totalContentCharacterLength` metadata field to `extractedContentBlocks` for Bash output size diagnostics.

**Architecture:** Add single line of code in `ContentExtractor.extractContent()` to calculate JSON size before return, place in reserved metadata field with underscore prefix.

**Tech Stack:** JavaScript, Vitest (testing)

**Commit Strategy:** Git commit after each task (Tasks 1-7) with full attribution. Final comprehensive commit represents complete US2.4b implementation.

---

## Task 0: Development Environment Setup

Use `using-git-worktrees` skill to create clean development environment

### Step 1: Commit current work

Ensure main branch is clean before creating worktree

Run: `git status`
Run: `git add .`
Run: `git commit -m "wip: save current work before us2.4b worktree"`

### Step 2: Create worktree for US2.4b

Use `using-git-worktrees` skill to create isolated development environment

Branch: `us2.4b-add-total-content-length-metadata`
Worktree: `../cc-workflows-us2.4b/`

---

## Task 1 - Write Failing Unit Test for Field Existence

### Files
- `tools/citation-manager/test/unit/ContentExtractor.test.js` (MODIFY)

### Step 1: Write the failing test

Add test after existing `extractContent()` tests:

```javascript
describe('ContentExtractor.extractContent() - Output Metadata', () => {
  it('should include _totalContentCharacterLength in extractedContentBlocks', async () => {
    // Given: Valid enriched link with successful extraction
    const enrichedLinks = [{
      scope: 'cross-document',
      anchorType: null, // full-file link
      validation: { status: 'valid' },
      target: {
        path: { absolute: '/test/fixtures/simple.md' },
        anchor: null
      },
      fullMatch: '[[simple.md]]',
      line: 1,
      column: 0
    }];

    const mockParsedFileCache = {
      resolveParsedFile: vi.fn().mockResolvedValue({
        extractFullContent: () => 'Test content'
      })
    };

    const mockStrategies = [{
      getDecision: () => ({ eligible: true, reason: 'Test eligible' })
    }];

    const extractor = new ContentExtractor(
      mockStrategies,
      mockParsedFileCache,
      null
    );

    // When: Extract content
    const result = await extractor.extractContent(enrichedLinks, {});

    // Then: _totalContentCharacterLength field exists and is a number
    expect(result.extractedContentBlocks._totalContentCharacterLength).toBeDefined();
    expect(typeof result.extractedContentBlocks._totalContentCharacterLength).toBe('number');
    expect(result.extractedContentBlocks._totalContentCharacterLength).toBeGreaterThan(0);
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm run test:unit -- ContentExtractor.test.js`

Expected: FAIL with "_totalContentCharacterLength is undefined"

### Step 3: Implement the feature

**File:** `tools/citation-manager/src/core/ContentExtractor/ContentExtractor.js`

Add after line 206 (after compression ratio calculation), before line 208 (return):

```javascript
  // Calculate compression ratio
  if (deduplicatedOutput.stats.totalLinks > 0) {
   const totalPotentialTokens =
    (deduplicatedOutput.stats.uniqueContent + deduplicatedOutput.stats.duplicateContentDetected) *
    (deduplicatedOutput.stats.tokensSaved / Math.max(deduplicatedOutput.stats.duplicateContentDetected, 1));
   const actualTokens = deduplicatedOutput.stats.uniqueContent *
    (deduplicatedOutput.stats.tokensSaved / Math.max(deduplicatedOutput.stats.duplicateContentDetected, 1));
   deduplicatedOutput.stats.compressionRatio =
    deduplicatedOutput.stats.duplicateContentDetected > 0
     ? (1 - actualTokens / totalPotentialTokens) * 100
     : 0;
  }

  // Add JSON size metadata for BASH_MAX_OUTPUT_LENGTH checking
  const jsonSize = JSON.stringify(deduplicatedOutput.extractedContentBlocks).length;
  deduplicatedOutput.extractedContentBlocks._totalContentCharacterLength = jsonSize;

  return deduplicatedOutput;
```

### Step 4: Run test to verify it passes

Run: `npm run test:unit -- ContentExtractor.test.js`

Expected: PASS - test now passes

### Step 5: Commit

Message: `test(citation-manager): [US2.4b] add test for _totalContentCharacterLength field`

Use `create-git-commit` skill

---

## Task 2 - Test Size Accuracy with Approximation

### Files
- `tools/citation-manager/test/unit/ContentExtractor.test.js` (MODIFY)

### Step 1: Write the failing test

Add test in same describe block:

```javascript
it('should calculate _totalContentCharacterLength within acceptable margin', async () => {
  // Given: Multiple content blocks for realistic size calculation
  const enrichedLinks = [
    {
      scope: 'cross-document',
      anchorType: 'header',
      validation: { status: 'valid' },
      target: {
        path: { absolute: '/test/fixtures/multi.md' },
        anchor: 'Section One'
      },
      fullMatch: '[[multi.md#Section One]]',
      line: 1,
      column: 0
    },
    {
      scope: 'cross-document',
      anchorType: 'header',
      validation: { status: 'valid' },
      target: {
        path: { absolute: '/test/fixtures/multi.md' },
        anchor: 'Section Two'
      },
      fullMatch: '[[multi.md#Section Two]]',
      line: 2,
      column: 0
    }
  ];

  const mockParsedFileCache = {
    resolveParsedFile: vi.fn().mockResolvedValue({
      extractSection: (anchor) => {
        if (anchor === 'Section One') return 'Content for section one';
        if (anchor === 'Section Two') return 'Content for section two';
      }
    })
  };

  const mockStrategies = [{
    getDecision: () => ({ eligible: true, reason: 'Test eligible' })
  }];

  const extractor = new ContentExtractor(
    mockStrategies,
    mockParsedFileCache,
    null
  );

  // When: Extract content
  const result = await extractor.extractContent(enrichedLinks, {});

  // Then: Calculate actual final JSON size
  const actualJsonSize = JSON.stringify(result.extractedContentBlocks).length;
  const reportedSize = result.extractedContentBlocks._totalContentCharacterLength;

  // Reported size should be less than actual (doesn't include the field itself)
  expect(reportedSize).toBeLessThan(actualJsonSize);

  // Difference should be ~30-50 characters (the field overhead)
  const difference = actualJsonSize - reportedSize;
  expect(difference).toBeGreaterThanOrEqual(20);
  expect(difference).toBeLessThanOrEqual(60);
});
```

### Step 2: Run test to verify it fails

Run: `npm run test:unit -- ContentExtractor.test.js`

Expected: Should PASS (implementation already exists from Task 1)

### Step 3: If test passes, commit

Message: `test(citation-manager): [US2.4b] verify _totalContentCharacterLength accuracy`

Use `create-git-commit` skill

---

## Task 3 - Test Edge Case - Empty Extraction

### Files
- `tools/citation-manager/test/unit/ContentExtractor.test.js` (MODIFY)

### Step 1: Write the failing test

Add test in same describe block:

```javascript
it('should return _totalContentCharacterLength of 2 for empty extraction', async () => {
  // Given: Link that will be skipped (validation error)
  const enrichedLinks = [{
    scope: 'cross-document',
    anchorType: null,
    validation: {
      status: 'error',
      error: 'File not found'
    },
    target: {
      path: { absolute: '/test/fixtures/missing.md' },
      anchor: null
    },
    fullMatch: '[[missing.md]]',
    line: 1,
    column: 0
  }];

  const mockStrategies = [{
    getDecision: () => ({ eligible: true, reason: 'Test eligible' })
  }];

  const extractor = new ContentExtractor(
    mockStrategies,
    null, // no cache needed - validation fails
    null
  );

  // When: Extract content
  const result = await extractor.extractContent(enrichedLinks, {});

  // Then: Empty extractedContentBlocks (no content extracted)
  expect(Object.keys(result.extractedContentBlocks).length).toBe(1); // Only metadata field
  expect(result.extractedContentBlocks._totalContentCharacterLength).toBe(2); // "{}"
});
```

### Step 2: Run test to verify it fails or passes

Run: `npm run test:unit -- ContentExtractor.test.js`

Expected: Should PASS (implementation handles empty case)

### Step 3: If test passes, commit

Message: `test(citation-manager): [US2.4b] verify empty extraction edge case`

Use `create-git-commit` skill

---

## Task 4 - Integration Test with Real Fixtures

### Files
- `tools/citation-manager/test/integration/ContentExtractor.integration.test.js` (MODIFY or CREATE)

### Step 1: Write the integration test

```javascript
import { describe, it, expect, beforeEach } from 'vitest';
import { ContentExtractor } from '../../src/core/ContentExtractor/ContentExtractor.js';
import { createParsedFileCache } from '../../src/factories/componentFactory.js';
import { StopMarkerStrategy } from '../../src/core/ContentExtractor/eligibilityStrategies/StopMarkerStrategy.js';
import { ForceMarkerStrategy } from '../../src/core/ContentExtractor/eligibilityStrategies/ForceMarkerStrategy.js';
import { SectionLinkStrategy } from '../../src/core/ContentExtractor/eligibilityStrategies/SectionLinkStrategy.js';
import { CliFlagStrategy } from '../../src/core/ContentExtractor/eligibilityStrategies/CliFlagStrategy.js';

describe('ContentExtractor Integration - _totalContentCharacterLength', () => {
  let extractor;
  let parsedFileCache;

  beforeEach(() => {
    parsedFileCache = createParsedFileCache();
    const strategies = [
      new StopMarkerStrategy(),
      new ForceMarkerStrategy(),
      new SectionLinkStrategy(),
      new CliFlagStrategy()
    ];
    extractor = new ContentExtractor(strategies, parsedFileCache, null);
  });

  it('should include _totalContentCharacterLength in real extraction', async () => {
    // Given: Real enriched links from test fixture
    const enrichedLinks = [{
      scope: 'cross-document',
      anchorType: 'header',
      validation: { status: 'valid' },
      target: {
        path: {
          absolute: '/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/cc-workflows/tools/citation-manager/test/fixtures/target-with-sections.md'
        },
        anchor: 'Introduction'
      },
      fullMatch: '[[target-with-sections.md#Introduction]]',
      line: 1,
      column: 0
    }];

    // When: Extract with real cache and parsers
    const result = await extractor.extractContent(enrichedLinks, {});

    // Then: Metadata field exists
    expect(result.extractedContentBlocks._totalContentCharacterLength).toBeDefined();
    expect(typeof result.extractedContentBlocks._totalContentCharacterLength).toBe('number');

    // Verify approximation accuracy
    const actualSize = JSON.stringify(result.extractedContentBlocks).length;
    const reportedSize = result.extractedContentBlocks._totalContentCharacterLength;
    const margin = actualSize - reportedSize;

    expect(margin).toBeGreaterThan(0);
    expect(margin).toBeLessThan(100); // Generous margin for integration test
  });
});
```

### Step 2: Run integration test

Run: `npm run test:integration`

Expected: PASS

### Step 3: Commit

Message: `test(citation-manager): [US2.4b] add integration test for size metadata`

Use `create-git-commit` skill

---

## Task 5 - Manual Validation with CLI

### Step 1: Run extraction command

```bash
npm run citation:extract:content "/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/cc-workflows/tools/citation-manager/design-docs/features/20251003-content-aggregation/content-aggregation-prd.md"
```

### Step 2: Verify output

Check JSON output:
- `_totalContentCharacterLength` field appears
- Value is numeric
- Value makes sense relative to visible content size

### Step 3: Test with filtered output (only extractedContentBlocks)

The CLI already filters to show only `extractedContentBlocks` for the `extract:content` command.

Verify the metadata field is visible in filtered output.

### Step 4: Document validation results

If all checks pass, proceed to final commit.

---

## Task 6 - Run Full Test Suite

### Step 1: Run all tests

```bash
npm test
```

Expected: All tests PASS (no regressions)

### Step 2: Fix any failures

If any tests fail:
- Investigate root cause
- Fix implementation or tests
- Re-run until all pass

### Step 3: Commit any fixes

Message: `fix(citation-manager): [US2.4b] resolve test regressions`

Use `create-git-commit` skill

---

## Task 7 - Final Commit and Cleanup

### Step 1: Verify all acceptance criteria met

Review US2.4b acceptance criteria:
- [x] AC1: Field exists in all output
- [x] AC2: Value approximates JSON size within margin
- [x] AC3: Field appears first (implicit - added to empty object first)
- [x] AC4: Empty extraction returns value of 2
- [x] AC5: No interference with deduplication
- [x] AC6: All existing tests pass
- [x] AC7: New tests cover field calculation

### Step 2: Create final feature commit (if needed)

If implementation split across multiple commits, create final commit:

Message: `feat(citation-manager): [US2.4b] add _totalContentCharacterLength metadata to extractedContentBlocks`

Use `create-git-commit` skill

### Step 3: Update US2.4b status

Mark user story as complete in tracking system.

---

## Testing Commands Reference

```bash
# Run all tests
npm test

# Run only unit tests
npm run test:unit

# Run specific test file
npm run test:unit -- ContentExtractor.test.js

# Run integration tests
npm run test:integration

# Run with coverage
npm run test:coverage

# Manual CLI testing
npm run citation:extract:content "<file-path>"
```

---

## Rollback Plan

If issues discovered after implementation:

1. Revert commit: `git revert <commit-hash>`
2. Remove `_totalContentCharacterLength` calculation from `ContentExtractor.js`
3. Remove associated tests
4. Revert schema documentation changes in Implementation Guide
5. Re-run test suite to verify clean state

---

**Implementation Time Estimate:** 1-2 hours
**Testing Time Estimate:** 30 minutes
**Total Effort:** ~2 hours

---

**Status:** Ready for Implementation
**Created:** 2025-10-30
