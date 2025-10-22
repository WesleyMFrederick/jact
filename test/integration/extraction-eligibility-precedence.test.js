// tools/citation-manager/test/integration/extraction-eligibility-precedence.test.js
import { describe, it, expect } from 'vitest';
import { createContentExtractor } from '../../src/factories/componentFactory.js';

describe('Extraction Eligibility Precedence Integration', () => {
  it('should enforce complete precedence hierarchy', () => {
    // Given: Factory-created ContentExtractor
    const extractor = createContentExtractor();

    // When/Then: Each scenario produces expected decision
    const scenarios = [
      {
        name: 'Stop marker prevents extraction (AC4, AC5)',
        link: { anchorType: 'header', extractionMarker: { innerText: 'stop-extract-link' } },
        cliFlags: { fullFiles: true },
        expected: { eligible: false, reason: 'stop-extract-link marker prevents extraction' }
      },
      {
        name: 'Force marker overrides full-file default (AC3, AC5)',
        link: { anchorType: null, extractionMarker: { innerText: 'force-extract' } },
        cliFlags: { fullFiles: false },
        expected: { eligible: true, reason: 'force-extract overrides defaults' }
      },
      {
        name: 'Section links eligible by default (AC2)',
        link: { anchorType: 'header', extractionMarker: null },
        cliFlags: {},
        expected: { eligible: true, reason: 'Markdown anchor links eligible by default' }
      },
      {
        name: 'Full-file ineligible without flag (AC1)',
        link: { anchorType: null, extractionMarker: null },
        cliFlags: { fullFiles: false },
        expected: { eligible: false, reason: 'Full-file link ineligible without --full-files flag' }
      },
      {
        name: 'CLI flag enables full-file extraction',
        link: { anchorType: null, extractionMarker: null },
        cliFlags: { fullFiles: true },
        expected: { eligible: true, reason: 'CLI flag --full-files forces extraction' }
      }
    ];

    scenarios.forEach(({ name, link, cliFlags, expected }) => {
      const result = extractor.analyzeEligibility(link, cliFlags);
      expect(result, name).toEqual(expected);
    });
  });

  it('should treat block anchors same as header anchors', () => {
    // Given: Link with block anchor
    const extractor = createContentExtractor();
    const link = {
      anchorType: 'block',
      extractionMarker: null
    };

    // When: analyzeEligibility called
    const result = extractor.analyzeEligibility(link, {});

    // Then: Eligible (block links are section links)
    expect(result.eligible).toBe(true);
  });
});
