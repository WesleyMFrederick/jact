# US2.2 AC13-AC14: Implement ParsedDocument Extraction Methods - Gap Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement ParsedDocument.extractSection() and extractBlock() methods to replace Epic 2 stubs with full implementations

**Architecture:** Replace stub methods in ParsedDocument with complete implementations per Implementation Guide pseudocode. extractSection() uses 3-phase algorithm (flatten tokens, find boundary, reconstruct content). extractBlock() uses anchor lookup and line extraction. Both methods enable ContentExtractor to retrieve actual content for sections, blocks, and full files.

**Tech Stack:** Node.js ESM, Vitest, marked.js tokens, ParsedDocument facade

**Checkpoint Strategy:** Initial checkpoint captures clean state. Final checkpoint after all implementations and tests complete.

---

## Initial Setup: Create Baseline Checkpoint

**Before Task 1 begins:**

```bash
git checkpoint "claude-sonnet-4-5" "pre-us2.2-ac13-ac14-baseline" "Clean state before implementing ParsedDocument extraction methods (AC13-AC14)"
```

This captures the clean state with AC13-AC14 added to PRD but extraction methods still stubs.

---

## Task 1: Implement extractSection Method

### Files
- Modify: `tools/citation-manager/src/ParsedDocument.js` (lines 87-90, replace stub)
- Create: `tools/citation-manager/test/parsed-document-extraction.test.js`

### Purpose
Implement extractSection() method per ParsedDocument Implementation Guide (US2.2 AC13)

### Step 1: Create test file and write failing test for extractSection

Create `tools/citation-manager/test/parsed-document-extraction.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import ParsedDocument from '../src/ParsedDocument.js';

describe('ParsedDocument Content Extraction', () => {
  describe('extractSection', () => {
    it('should extract section content including nested headings', () => {
      // Given: Document with nested sections
      const parserOutput = {
        content: '## First\n\nContent here.\n\n### Sub\n\nNested.\n\n## Second',
        tokens: [
          { type: 'heading', depth: 2, text: 'First', raw: '## First\n' },
          { type: 'paragraph', raw: '\nContent here.\n\n' },
          { type: 'heading', depth: 3, text: 'Sub', raw: '### Sub\n' },
          { type: 'paragraph', raw: '\nNested.\n\n' },
          { type: 'heading', depth: 2, text: 'Second', raw: '## Second' }
        ]
      };
      const doc = new ParsedDocument(parserOutput);

      // When: Extract section by heading text
      const section = doc.extractSection('First');

      // Then: Section includes heading, content, and nested subsections up to next same-level heading
      expect(section).toContain('## First');
      expect(section).toContain('Content here');
      expect(section).toContain('### Sub');
      expect(section).toContain('Nested');
      expect(section).not.toContain('Second');
    });

    it('should return null when heading not found', () => {
      // Given: Document without target heading
      const parserOutput = {
        content: '## Existing',
        tokens: [{ type: 'heading', depth: 2, text: 'Existing', raw: '## Existing' }]
      };
      const doc = new ParsedDocument(parserOutput);

      // When: Extract non-existent section
      const section = doc.extractSection('Nonexistent');

      // Then: Returns null
      expect(section).toBeNull();
    });

    it('should extract last section to end of document', () => {
      // Given: Document where target section is last
      const parserOutput = {
        content: '## First\n\nText.\n\n## Last\n\nFinal content.',
        tokens: [
          { type: 'heading', depth: 2, text: 'First', raw: '## First\n' },
          { type: 'paragraph', raw: '\nText.\n\n' },
          { type: 'heading', depth: 2, text: 'Last', raw: '## Last\n' },
          { type: 'paragraph', raw: '\nFinal content.' }
        ]
      };
      const doc = new ParsedDocument(parserOutput);

      // When: Extract last section
      const section = doc.extractSection('Last');

      // Then: Includes all content to end of file
      expect(section).toContain('## Last');
      expect(section).toContain('Final content');
    });
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- parsed-document-extraction.test.js`

Expected: FAIL - "Error: Not implemented - Epic 2"

### Step 3: Implement extractSection method

Replace stub in `tools/citation-manager/src/ParsedDocument.js` (lines 87-90):

```javascript
/**
 * Extract section content by heading text
 *
 * Uses 3-phase algorithm: (1) flatten token tree and locate target heading,
 * (2) find section boundary (next same-or-higher level heading),
 * (3) reconstruct content from token.raw properties.
 *
 * @param {string} headingText - Exact heading text to find (case-sensitive)
 * @returns {string|null} Section content string or null if not found
 */
extractSection(headingText) {
  // Phase 1: Flatten token tree and locate target heading
  const orderedTokens = [];
  let targetIndex = -1;

  const walkTokens = (tokenList) => {
    for (const token of tokenList) {
      const currentIndex = orderedTokens.length;
      orderedTokens.push(token);

      // Found our target heading?
      if (token.type === 'heading' && token.text === headingText) {
        targetIndex = currentIndex;
      }

      // Recurse into nested tokens (child-before-sibling traversal)
      if (token.tokens) {
        walkTokens(token.tokens);
      }
    }
  };

  walkTokens(this._data.tokens);

  // Not found? Return null
  if (targetIndex === -1) return null;

  // Phase 2: Find section boundary (next same-or-higher level heading)
  const headingLevel = orderedTokens[targetIndex].depth;
  let endIndex = orderedTokens.length;  // Default: to end of file

  for (let i = targetIndex + 1; i < orderedTokens.length; i++) {
    const token = orderedTokens[i];
    if (token.type === 'heading' && token.depth <= headingLevel) {
      endIndex = i;
      break;
    }
  }

  // Phase 3: Reconstruct content from token.raw properties
  const sectionTokens = orderedTokens.slice(targetIndex, endIndex);
  return sectionTokens.map(t => t.raw).join('');
}
```

### Step 4: Run test to verify extractSection passes

Run: `npm test -- parsed-document-extraction.test.js`

Expected: PASS (3 extractSection tests)

---

## Task 2: Implement extractBlock Method

### Files
- Modify: `tools/citation-manager/src/ParsedDocument.js` (lines 101-104, replace stub)
- Modify: `tools/citation-manager/test/parsed-document-extraction.test.js` (add extractBlock tests)

### Purpose
Implement extractBlock() method per ParsedDocument Implementation Guide (US2.2 AC14)

### Step 1: Write failing tests for extractBlock

Add to `tools/citation-manager/test/parsed-document-extraction.test.js`:

```javascript
describe('extractBlock', () => {
  it('should extract single line containing block anchor', () => {
    // Given: Document with block anchor
    const parserOutput = {
      content: 'Line 1\nImportant content. ^block-id\nLine 3',
      anchors: [
        { anchorType: 'block', id: 'block-id', line: 2, column: 20 }
      ]
    };
    const doc = new ParsedDocument(parserOutput);

    // When: Extract block by anchor ID
    const block = doc.extractBlock('block-id');

    // Then: Returns line containing block anchor
    expect(block).toBe('Important content. ^block-id');
  });

  it('should return null when block anchor not found', () => {
    // Given: Document without target block
    const parserOutput = {
      content: 'Some content',
      anchors: [{ anchorType: 'block', id: 'existing', line: 1 }]
    };
    const doc = new ParsedDocument(parserOutput);

    // When: Extract non-existent block
    const block = doc.extractBlock('nonexistent');

    // Then: Returns null
    expect(block).toBeNull();
  });

  it('should return null when line index out of bounds', () => {
    // Given: Document with invalid line number in anchor
    const parserOutput = {
      content: 'Line 1',
      anchors: [
        { anchorType: 'block', id: 'invalid', line: 999, column: 0 }
      ]
    };
    const doc = new ParsedDocument(parserOutput);

    // When: Extract block with out-of-bounds line
    const block = doc.extractBlock('invalid');

    // Then: Returns null (defensive check)
    expect(block).toBeNull();
  });

  it('should not return header anchors when searching for block', () => {
    // Given: Document with header anchor having same ID
    const parserOutput = {
      content: '## Header Name',
      anchors: [
        { anchorType: 'header', id: 'header-name', line: 1, column: 0 }
      ]
    };
    const doc = new ParsedDocument(parserOutput);

    // When: Extract with anchor ID that belongs to header
    const block = doc.extractBlock('header-name');

    // Then: Returns null (only block anchors matched)
    expect(block).toBeNull();
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- parsed-document-extraction.test.js`

Expected: FAIL - "Error: Not implemented - Epic 2" (for extractBlock tests only)

### Step 3: Implement extractBlock method

Replace stub in `tools/citation-manager/src/ParsedDocument.js` (lines 101-104):

```javascript
/**
 * Extract block content by anchor ID
 *
 * Finds block anchor by ID, validates line index is within bounds,
 * and extracts the single line containing the block anchor.
 *
 * @param {string} anchorId - Block anchor ID without ^ prefix
 * @returns {string|null} Single line content string or null if not found
 */
extractBlock(anchorId) {
  // Find anchor with matching ID and anchorType === "block"
  const anchor = this._data.anchors.find(a =>
    a.anchorType === 'block' && a.id === anchorId
  );

  // Not found? Return null
  if (!anchor) return null;

  // Split content into lines (anchor.line is 1-based)
  const lines = this._data.content.split('\n');
  const lineIndex = anchor.line - 1;  // Convert to 0-based

  // Validate line index within bounds
  if (lineIndex < 0 || lineIndex >= lines.length) return null;

  // Extract single line containing block anchor
  return lines[lineIndex];
}
```

### Step 4: Run all tests to verify complete implementation

Run: `npm test -- parsed-document-extraction.test.js`

Expected: PASS (7 total tests: 3 extractSection + 4 extractBlock)

### Step 5: Verify no regressions in existing ParsedDocument tests

Run: `npm test -- parsed-document.test.js`

Expected: PASS (all existing facade tests)

---

## Task 3: Update Test Fixtures for Content Extraction

### Files
- Modify: `tools/citation-manager/test/fixtures/us2.2/target-doc.md`
- Modify: `tools/citation-manager/test/fixtures/us2.2/mixed-links-source.md`

### Purpose
Ensure fixtures have proper content for testing section, block, and full-file extraction

### Step 1: Update target-doc.md with rich extractable content

Edit `tools/citation-manager/test/fixtures/us2.2/target-doc.md`:

````markdown
# Target Document for Extraction Testing

This document contains various types of extractable content for US2.2 testing.

## Section to Extract

This is the content that should be extracted when linking to this section.
It spans multiple lines and contains important information.

**Key points:**
- Point 1
- Point 2
- Point 3

### Nested Subsection

This nested content should be included when extracting "Section to Extract".

## Another Section

This section should NOT be extracted when requesting "Section to Extract".
It demonstrates proper section boundary detection.

This is a block reference that can be extracted. ^block-ref-1

Another block for testing. ^block-ref-2

More content after the block references.

## Complex Section

This section tests extraction with multiple formatting types.

```javascript
// Code block example
console.log('test');
```

> Quote block

| Table | Example |
|-------|---------|
| Cell  | Data    |

Final paragraph. ^inline-block
````

### Step 2: Update mixed-links-source.md with all link types

Edit `tools/citation-manager/test/fixtures/us2.2/mixed-links-source.md`:

```markdown
# Source Document for US2.2 Testing

This document contains various link types for testing content extraction.

## Section Link Test
Link to section: [[target-doc.md#Section to Extract]]

## Block Link Test
Link to block: [[target-doc.md#^block-ref-1]]

## Full File Link Test
Link to full file: [[target-doc.md]]

## Internal Section Link Test
Link to internal section: [[#Section Link Test]]

## Multiple Links
- Section: [[target-doc.md#Complex Section]]
- Block: [[target-doc.md#^block-ref-2]]
- Inline block: [[target-doc.md#^inline-block]]
```

### Step 3: Verify fixtures are valid markdown

Run: `markdownlint "tools/citation-manager/test/fixtures/us2.2/*.md" --fix`

Expected: Markdown formatting corrected if needed

---

## Task 4: Update Integration Tests for Content Extraction

### Files
- Modify: `tools/citation-manager/test/integration/content-extraction-workflow.test.js`

### Purpose
Verify ContentExtractor returns actual extracted content for all link types

### Step 1: Add content validation to integration test

Add/update test in `content-extraction-workflow.test.js`:

```javascript
it('should extract actual content for sections, blocks, and full files', async () => {
  // Given: Real components via factory (no mocks)
  const extractor = createContentExtractor();
  const sourceFile = join(__dirname, '../fixtures/us2.2/mixed-links-source.md');

  // When: Complete workflow executes
  const results = await extractor.extractLinksContent(sourceFile, { fullFiles: false });

  // Then: Results contain actual extracted content (not null/errors)
  expect(results.length).toBeGreaterThan(0);

  // Validation: Section link extracted with actual content
  const sectionResult = results.find(r =>
    r.sourceLink.target.anchor === 'Section to Extract' &&
    r.sourceLink.anchorType === 'header'
  );
  expect(sectionResult).toBeDefined();
  expect(sectionResult.status).toBe('success');
  expect(sectionResult.successDetails.extractedContent).toContain('## Section to Extract');
  expect(sectionResult.successDetails.extractedContent).toContain('Key points');
  expect(sectionResult.successDetails.extractedContent).toContain('### Nested Subsection');

  // Validation: Block link extracted with actual content
  const blockResult = results.find(r =>
    r.sourceLink.target.anchor === '^block-ref-1' &&
    r.sourceLink.anchorType === 'block'
  );
  expect(blockResult).toBeDefined();
  expect(blockResult.status).toBe('success');
  expect(blockResult.successDetails.extractedContent).toContain('This is a block reference');
  expect(blockResult.successDetails.extractedContent).toContain('^block-ref-1');

  // Validation: Full-file link skipped (no --full-files flag)
  const fullFileResult = results.find(r =>
    r.sourceLink.anchorType === null
  );
  expect(fullFileResult).toBeDefined();
  expect(fullFileResult.status).toBe('skipped');
});

it('should extract full file content when --full-files flag enabled', async () => {
  // Given: ContentExtractor with --full-files flag
  const extractor = createContentExtractor();
  const sourceFile = join(__dirname, '../fixtures/us2.2/mixed-links-source.md');

  // When: Execute with fullFiles flag
  const results = await extractor.extractLinksContent(sourceFile, { fullFiles: true });

  // Then: Full-file link extracted successfully
  const fullFileResult = results.find(r => r.sourceLink.anchorType === null);
  expect(fullFileResult).toBeDefined();
  expect(fullFileResult.status).toBe('success');
  expect(fullFileResult.successDetails.extractedContent).toContain('# Target Document');
  expect(fullFileResult.successDetails.extractedContent).toContain('Section to Extract');
  expect(fullFileResult.successDetails.extractedContent).toContain('^block-ref-1');
});
```

### Step 2: Run integration tests

Run: `npm test -- content-extraction-workflow.test.js`

Expected: PASS (validates actual content extraction for all types)

---

## Task 5: Update Acceptance Criteria Tests

### Files
- Modify: `tools/citation-manager/test/integration/us2.2-acceptance-criteria.test.js`

### Purpose
Add test cases for AC13 and AC14 to validate extraction method implementations

### Step 1: Add AC13 test (extractSection implementation)

Add to `us2.2-acceptance-criteria.test.js`:

```javascript
it('AC13: should implement extractSection with 3-phase algorithm', () => {
  // Given: ParsedDocument with tokenized sections
  const parserOutput = {
    content: '## Test\n\nContent.\n\n### Sub\n\nMore.\n\n## Next',
    tokens: [
      { type: 'heading', depth: 2, text: 'Test', raw: '## Test\n' },
      { type: 'paragraph', raw: '\nContent.\n\n' },
      { type: 'heading', depth: 3, text: 'Sub', raw: '### Sub\n' },
      { type: 'paragraph', raw: '\nMore.\n\n' },
      { type: 'heading', depth: 2, text: 'Next', raw: '## Next' }
    ]
  };
  const doc = new ParsedDocument(parserOutput);

  // When: Extract section (should NOT throw "Not implemented")
  const section = doc.extractSection('Test');

  // Then: Returns actual section content (not stub error)
  expect(section).toBeDefined();
  expect(section).toContain('## Test');
  expect(section).toContain('Content');
  expect(section).toContain('### Sub');
  expect(section).not.toContain('Next');

  // Validation: Null when not found
  expect(doc.extractSection('Nonexistent')).toBeNull();
});

it('AC14: should implement extractBlock with anchor lookup', () => {
  // Given: ParsedDocument with block anchors
  const parserOutput = {
    content: 'Line 1\nBlock content. ^test-block\nLine 3',
    anchors: [
      { anchorType: 'block', id: 'test-block', line: 2, column: 15 }
    ]
  };
  const doc = new ParsedDocument(parserOutput);

  // When: Extract block (should NOT throw "Not implemented")
  const block = doc.extractBlock('test-block');

  // Then: Returns actual block content (not stub error)
  expect(block).toBeDefined();
  expect(block).toContain('Block content');
  expect(block).toContain('^test-block');

  // Validation: Null when not found
  expect(doc.extractBlock('nonexistent')).toBeNull();

  // Validation: Null when line index invalid
  const invalidDoc = new ParsedDocument({
    content: 'Line 1',
    anchors: [{ anchorType: 'block', id: 'invalid', line: 999 }]
  });
  expect(invalidDoc.extractBlock('invalid')).toBeNull();
});
```

### Step 2: Run AC tests

Run: `npm test -- us2.2-acceptance-criteria.test.js`

Expected: PASS (all AC1-AC14 tests passing)

---

## Task 6: Create Manual Testing Script

### Files
- Create: `tools/citation-manager/scripts/test-extract.js`

### Purpose
Allow manual testing of extraction functionality on any markdown file

### Step 1: Create test script

Create `tools/citation-manager/scripts/test-extract.js`:

```javascript
#!/usr/bin/env node
/**
 * Manual testing script for content extraction
 *
 * Usage:
 *   node scripts/test-extract.js <source-file> [--full-files]
 *
 * Examples:
 *   node scripts/test-extract.js test/fixtures/us2.2/mixed-links-source.md
 *   node scripts/test-extract.js path/to/file.md --full-files
 */

import { createContentExtractor } from '../src/factories/componentFactory.js';
import { resolve } from 'path';

async function testExtract(sourceFilePath, cliFlags = {}) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Extracting content from: ${sourceFilePath}`);
  console.log(`${'='.repeat(60)}\n`);

  const extractor = createContentExtractor();
  const results = await extractor.extractLinksContent(sourceFilePath, cliFlags);

  console.log(`Found ${results.length} link(s)\n`);

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    console.log(`${'-'.repeat(60)}`);
    console.log(`Link ${i + 1}:`);
    console.log(`  Target: ${result.sourceLink.target.path?.raw || '(internal)'}`);
    console.log(`  Anchor: ${result.sourceLink.target.anchor || '(none - full file)'}`);
    console.log(`  Type: ${result.sourceLink.anchorType || 'full-file'}`);
    console.log(`  Status: ${result.status}`);

    if (result.status === 'success') {
      const content = result.successDetails.extractedContent;
      console.log(`  Content Length: ${content.length} characters`);
      console.log(`  Decision: ${result.successDetails.decisionReason}`);
      console.log(`\n  Content Preview (first 300 chars):`);
      console.log(`  ${'-'.repeat(56)}`);
      const preview = content.substring(0, 300).split('\n').map(line => `  ${line}`).join('\n');
      console.log(preview);
      if (content.length > 300) {
        console.log(`  ... (${content.length - 300} more characters)`);
      }
    } else if (result.status === 'skipped') {
      console.log(`  Reason: ${result.failureDetails.reason}`);
    } else {
      console.log(`  Error: ${result.failureDetails.reason}`);
    }
    console.log('');
  }

  console.log(`${'='.repeat(60)}`);
  console.log(`Extraction complete: ${results.filter(r => r.status === 'success').length} successful, ${results.filter(r => r.status === 'skipped').length} skipped, ${results.filter(r => r.status === 'error').length} errors`);
  console.log(`${'='.repeat(60)}\n`);
}

// Parse command line arguments
const args = process.argv.slice(2);
const sourceFile = args.find(arg => !arg.startsWith('--'));
const fullFiles = args.includes('--full-files');

if (!sourceFile) {
  console.error('Error: Source file path required\n');
  console.error('Usage: node scripts/test-extract.js <source-file> [--full-files]\n');
  console.error('Examples:');
  console.error('  node scripts/test-extract.js test/fixtures/us2.2/mixed-links-source.md');
  console.error('  node scripts/test-extract.js path/to/file.md --full-files');
  process.exit(1);
}

// Resolve absolute path
const absolutePath = resolve(sourceFile);

// Run extraction
testExtract(absolutePath, { fullFiles }).catch(err => {
  console.error('\n❌ Extraction failed:', err.message);
  console.error(err.stack);
  process.exit(1);
});
```

### Step 2: Make script executable

Run: `chmod +x tools/citation-manager/scripts/test-extract.js`

Expected: Script has execute permissions

### Step 3: Test the script manually

Run: `node tools/citation-manager/scripts/test-extract.js test/fixtures/us2.2/mixed-links-source.md`

Expected: Script displays extracted content from all links in the fixture file

### Step 4: Verify script with --full-files flag

Run: `node tools/citation-manager/scripts/test-extract.js test/fixtures/us2.2/mixed-links-source.md --full-files`

Expected: Script shows full-file extraction as successful instead of skipped

---

## Task 7: Final Regression Verification

### Files
- N/A (test execution only)

### Purpose
Verify all existing tests pass with extraction methods implemented

### Step 1: Run complete test suite

Run: `npm test`

Expected: All tests pass (unit + integration + AC tests)

### Step 2: Verify specific test suites

Run each test suite individually:

```bash
# ParsedDocument unit tests
npm test -- parsed-document.test.js

# New extraction tests
npm test -- parsed-document-extraction.test.js

# Integration workflow tests
npm test -- content-extraction-workflow.test.js

# Acceptance criteria tests
npm test -- us2.2-acceptance-criteria.test.js

# US2.1 regression check
npm test -- analyze-eligibility.test.js
npm test -- us2.1-acceptance-criteria.test.js
```

Expected: PASS for all test suites (confirms zero regressions)

### Step 3: Verify test counts

Expected test counts:
- parsed-document-extraction.test.js: 7 tests (3 extractSection + 4 extractBlock)
- us2.2-acceptance-criteria.test.js: 14 tests (AC1-AC14)
- No test failures or errors

---

## Final Checkpoint: Complete Implementation

**After Task 7 completes successfully:**

```bash
git add .
git checkpoint "claude-sonnet-4-5" "us2.2-ac13-ac14-complete" "Implement ParsedDocument.extractSection() and extractBlock() per Implementation Guide (US2.2 AC13-AC14). extractSection() uses 3-phase algorithm: flatten tokens, find boundary, reconstruct content. extractBlock() finds block anchor and extracts line. Replace 'Epic 2' stubs with full implementations. Update fixtures with rich extractable content. Update integration tests to validate actual content extraction for sections, blocks, and full files. Add AC13-AC14 tests to acceptance criteria suite. Create manual testing script (scripts/test-extract.js) for validation. All tests passing, zero regressions confirmed."
```

---

## Execution Handoff

**Plan complete and saved to:** `tools/citation-manager/design-docs/features/20251003-content-aggregation/user-stories/us2.2-implement-content-retrieval/us2.2-implement-content-retrieval-implement-plan-gaps.md`

### Implementation Summary

**7 Tasks with TDD approach:**
1. ✅ Implement extractSection() method with unit tests
2. ✅ Implement extractBlock() method with unit tests
3. ✅ Update test fixtures with rich extractable content
4. ✅ Update integration tests to validate actual content extraction
5. ✅ Add AC13-AC14 tests to acceptance criteria suite
6. ✅ Create manual testing script for validation
7. ✅ Final regression verification

**Total Steps:** ~30 steps across 7 tasks
**Pattern:** Test-first (RED-GREEN-REFACTOR) throughout
**Git Strategy:** Initial checkpoint before work, final checkpoint after completion

### Two Execution Options

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
