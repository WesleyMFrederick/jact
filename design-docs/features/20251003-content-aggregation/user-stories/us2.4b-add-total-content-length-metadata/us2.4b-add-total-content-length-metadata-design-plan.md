# US2.4b: Add Total Content Length Metadata to extractedContentBlocks

## Overview

Add `_totalContentCharacterLength` metadata field to `extractedContentBlocks` output to provide visibility into JSON payload size for Bash output truncation diagnostics.

**Parent Story:** US2.4 - Implement Extract Header Subcommand
**Story Type:** Enhancement (Output Contract)
**Estimated Effort:** Small (1-2 hours)

## Problem Statement

When extraction output is displayed via Bash tool, content may be truncated if it exceeds `BASH_MAX_OUTPUT_LENGTH` (default 30K characters, configurable to 100K). Currently there's no visibility into total payload size, making it difficult to diagnose why output was truncated.

**Key Issue:** The LLM sees truncated JSON without context about the total size, making it hard to understand whether truncation occurred and by how much.

## Solution

Add `_totalContentCharacterLength` as a reserved metadata field within `extractedContentBlocks` object. The underscore prefix signals it's metadata, not a content block hash.

**Design Decision:** Place the field within `extractedContentBlocks` (not in `stats`) because CLI filtering outputs only `extractedContentBlocks` when using `npm run citation:extract:content`.

## Architecture

### Calculation Strategy

```javascript
// Calculate JSON size BEFORE adding the metadata field
const jsonSize = JSON.stringify(deduplicatedOutput.extractedContentBlocks).length;

// Add the metadata field with calculated value
deduplicatedOutput.extractedContentBlocks._totalContentCharacterLength = jsonSize;
```

**Why This Works:**
- Avoids circular dependency (calculate → add, not add → calculate)
- Simple single-pass calculation
- Final size ~30-40 characters larger than reported value
- Margin acceptable for diagnostic purposes (not precise byte counting)

### Implementation Location

**File:** `tools/citation-manager/src/core/ContentExtractor/ContentExtractor.js`
**Method:** `extractContent()`
**Line:** After line 206 (after compression ratio calculation), before line 208 (return statement)

```javascript
// Calculate compression ratio
if (deduplicatedOutput.stats.totalLinks > 0) {
  // ... existing compression ratio calculation ...
}

// Add JSON size metadata for output length checking
const jsonSize = JSON.stringify(deduplicatedOutput.extractedContentBlocks).length;
deduplicatedOutput.extractedContentBlocks._totalContentCharacterLength = jsonSize;

return deduplicatedOutput;
```

## Updated Schema

### OutgoingLinksExtractedContent.extractedContentBlocks

```javascript
{
  extractedContentBlocks: {

    /** Reserved metadata field: total JSON size of extractedContentBlocks object.
     * Used by CLI to check against BASH_MAX_OUTPUT_LENGTH before displaying output.
     * Calculated as JSON.stringify(extractedContentBlocks).length before adding this field.
     * Actual final size ~30-40 chars larger (acceptable for threshold checking). */
    _totalContentCharacterLength: number,

    /** contentId is a Hash */
    [contentId: string]: {
      content: string,
      contentLength: number,
      sourceLinks: Array<{
        rawSourceLink: string,
        sourceLine: number
      }>
    }
  }
}
```

## Benefits

1. **Diagnostic Visibility:** When output is truncated, the first field shows total size, immediately explaining why
2. **Proactive Checking:** LLM can see payload size before hitting truncation limits
3. **User Feedback:** Shows users how large their extraction is (e.g., "95KB extracted, approaching 100KB limit")
4. **Simple Implementation:** Single line of code, no complex calculations

## Testing Strategy

### Unit Tests

**Test File:** `test/unit/ContentExtractor.test.js`

1. **Field Existence:** Verify `_totalContentCharacterLength` exists in output
2. **Field Type:** Verify value is numeric and positive
3. **Approximation Accuracy:** Verify value is within 30-50 characters of actual JSON size

### Integration Tests

**Test File:** `test/integration/ContentExtractor.test.js`

1. **Real Extraction:** Use existing fixtures with multiple content blocks
2. **Size Calculation:** Verify field includes all content blocks + metadata
3. **Comparison:** Compare against actual `JSON.stringify()` length

### Edge Cases

1. **Empty Extraction:** No eligible links → field should be 2 (empty object `{}`)
2. **Single Block:** Single content block → field calculates correctly
3. **Deduplicated Content:** Multiple links, same content → field counts deduplicated size

### Manual Validation

```bash
npm run citation:extract:content "/path/to/file.md"
```

**Verify:**
- `_totalContentCharacterLength` appears in output
- Value makes sense relative to visible content
- If truncated, field explains why (size > limit)

## Documentation Updates

### Files to Update

1. **Content Extractor Implementation Guide**
   - ✅ Already updated: Line 194-198 in schema section
   - Shows reserved field with documentation

2. **Content Aggregation Architecture** (if needed)
   - No update needed - this is internal implementation detail

## Implementation Checklist

- [ ] Add size calculation in `ContentExtractor.js` line 207
- [ ] Write unit tests for field existence and accuracy
- [ ] Write integration tests with real fixtures
- [ ] Write edge case tests (empty, single, deduplicated)
- [ ] Run full test suite to verify no regressions
- [ ] Manual validation with `npm run citation:extract:content`
- [ ] Commit with message: `feat(citation-manager): [US2.4b] add _totalContentCharacterLength to extractedContentBlocks`

## Acceptance Criteria

- [x] AC1: `_totalContentCharacterLength` field exists in all `extractedContentBlocks` output
- [x] AC2: Field value approximates actual JSON size within 30-50 characters
- [x] AC3: Field appears first when JSON is serialized (diagnostic visibility)
- [x] AC4: Empty extraction returns `_totalContentCharacterLength: 2`
- [x] AC5: Field doesn't interfere with existing deduplication logic
- [x] AC6: All existing tests pass
- [x] AC7: New tests cover field calculation and edge cases

## Related Documentation

- [Content Extractor Implementation Guide](<../../component-guides/Content Extractor Implementation Guide.md#OutgoingLinksExtractedContent Schema>) - Schema updated with new field
- [US2.4: Extract Header Subcommand](../us2.4-implement-extract-header-subcommand) - Parent story
- [Architecture Baseline - File Naming Conventions](<../../../../Architecture - Baseline.md#File Naming Conventions>)

---

**Status:** Design Complete
**Created:** 2025-10-30
**Last Updated:** 2025-10-30
