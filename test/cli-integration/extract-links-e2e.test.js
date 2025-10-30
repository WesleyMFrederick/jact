import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

describe('Extract Links - End-to-End Integration', () => {
  it('should complete full extraction workflow with real fixtures', () => {
    // Given: Source file with mixed link types
    const sourceFile = join(__dirname, '../fixtures/extract-test-source.md');

    // When: Execute extract links with --full-files flag
    const output = execSync(
      `node tools/citation-manager/src/citation-manager.js extract links "${sourceFile}" --full-files`,
      { encoding: 'utf8' }
    );

    // Then: Complete OutgoingLinksExtractedContent structure returned
    const result = JSON.parse(output);

    // Verification: Three logical groups present
    expect(result.extractedContentBlocks).toBeDefined();
    expect(result.outgoingLinksReport).toBeDefined();
    expect(result.stats).toBeDefined();

    // Verification: Block links extracted (2 blocks + 1 full file = 3 unique content blocks)
    expect(result.stats.uniqueContent).toBeGreaterThanOrEqual(2);

    // Verification: Full-file link extracted (force marker)
    const fullFileLink = result.outgoingLinksReport.processedLinks.find(
      l => l.sourceLink.anchorType === null && l.sourceLink.extractionMarker !== null
    );
    expect(fullFileLink).toBeDefined();
    expect(fullFileLink.status).toBe('extracted');

    // Verification: Block links extracted successfully
    const blockLinks = result.outgoingLinksReport.processedLinks.filter(
      l => l.sourceLink.anchorType === 'block'
    );
    expect(blockLinks.length).toBe(2);
    expect(blockLinks.every(link => link.status === 'extracted')).toBe(true);

    // Verification: Internal link skipped (filtered before processing)
    const internalLink = result.outgoingLinksReport.processedLinks.find(
      l => l.sourceLink.scope === 'internal'
    );
    expect(internalLink).toBeUndefined(); // Filtered before processing
  });
});
