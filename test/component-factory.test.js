// Add to tools/citation-manager/test/component-factory.test.js
import { describe, it, expect } from 'vitest';
import { createContentExtractor } from '../src/factories/componentFactory.js';
import { ContentExtractor } from '../src/core/ContentExtractor/ContentExtractor.js';

describe('createContentExtractor', () => {
  it('should create ContentExtractor with default strategies', () => {
    // When: Factory called without arguments
    const extractor = createContentExtractor();

    // Then: Returns ContentExtractor instance
    expect(extractor).toBeInstanceOf(ContentExtractor);
  });

  it('should inject strategies in correct precedence order', () => {
    // Given: Factory creates extractor
    const extractor = createContentExtractor();

    // When: Analyzing link with stop marker AND section anchor
    const link = {
      anchorType: 'header',
      extractionMarker: { innerText: 'stop-extract-link' }
    };
    const result = extractor.analyzeEligibility(link, {});

    // Then: Stop marker takes precedence (highest priority)
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('stop-extract-link marker prevents');
  });

  it('should allow custom strategy override for testing', () => {
    // Given: Custom empty strategy array
    const extractor = createContentExtractor([]);

    // When: analyzeEligibility called
    const result = extractor.analyzeEligibility({}, {});

    // Then: Uses custom strategies
    expect(result.reason).toBe('No strategy matched');
  });

  it('should instantiate all four strategies in precedence order', () => {
    // Given: Factory creates extractor
    const extractor = createContentExtractor();

    // When: Testing each strategy precedence level
    const tests = [
      // Stop marker (highest)
      {
        link: { anchorType: 'header', extractionMarker: { innerText: 'stop-extract-link' } },
        expected: false
      },
      // Force marker (second)
      {
        link: { anchorType: null, extractionMarker: { innerText: 'force-extract' } },
        expected: true
      },
      // Section link (third)
      {
        link: { anchorType: 'header', extractionMarker: null },
        expected: true
      },
      // CLI flag (lowest)
      {
        link: { anchorType: null, extractionMarker: null },
        cliFlags: { fullFiles: true },
        expected: true
      }
    ];

    // Then: All strategies work in correct order
    tests.forEach(({ link, cliFlags = {}, expected }) => {
      const result = extractor.analyzeEligibility(link, cliFlags);
      expect(result.eligible).toBe(expected);
    });
  });
});
