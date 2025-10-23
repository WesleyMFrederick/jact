#!/usr/bin/env node

/**
 * Inspect full ExtractionResult data structures - NO TRUNCATION
 */

import { createContentExtractor } from './src/factories/componentFactory.js';
import { inspect } from 'node:util';

async function inspectFullData() {
  const extractor = createContentExtractor();
  const filePath = '/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/cc-workflows/.worktrees/feature/us2.2-content-retrieval/tools/citation-manager/design-docs/component-guides/Content Extractor Implementation Guide.md';

  console.log('🔍 FULL ExtractionResult Data - Content Extractor Implementation Guide\n');
  console.log('Source: Content Extractor Implementation Guide.md\n');
  console.log('═══════════════════════════════════════════════════\n');

  const results = await extractor.extractLinksContent(filePath, { fullFiles: false });

  console.log(`Total: ${results.length} ExtractionResult objects\n`);

  // Status summary
  const statusCounts = results.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

  console.log('Status Summary:');
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`);
  });
  console.log('\n═══════════════════════════════════════════════════\n');

  // Example 1: Internal block
  console.log('━━━ Example 1: Internal Block Reference ━━━\n');
  const internalBlock = results.find(r =>
    r.sourceLink.scope === 'internal' &&
    r.sourceLink.anchorType === 'block'
  );
  console.log(inspect(internalBlock, { depth: null, colors: true, maxStringLength: null }));

  // Example 2: Cross-doc section
  console.log('\n━━━ Example 2: Cross-Document Section Link ━━━\n');
  const crossDocSection = results.find(r =>
    r.sourceLink.scope === 'cross-document' &&
    r.sourceLink.anchorType === 'header'
  );
  console.log(inspect(crossDocSection, { depth: null, colors: true, maxStringLength: null }));

  // Example 3: Full-file skipped
  console.log('\n━━━ Example 3: Full-File Link (SKIPPED by default) ━━━\n');
  const fullFileSkipped = results.find(r =>
    !r.sourceLink.anchorType &&
    r.status === 'skipped' &&
    r.failureDetails?.reason?.includes('Full-file')
  );
  console.log(inspect(fullFileSkipped, { depth: null, colors: true, maxStringLength: null }));

  // Example 4: Validation error
  console.log('\n━━━ Example 4: Validation Error ━━━\n');
  const validationError = results.find(r =>
    r.sourceLink.validation?.status === 'error'
  );
  console.log(inspect(validationError, { depth: null, colors: true, maxStringLength: null }));

  console.log('\n═══════════════════════════════════════════════════\n');
}

inspectFullData().catch(console.error);
