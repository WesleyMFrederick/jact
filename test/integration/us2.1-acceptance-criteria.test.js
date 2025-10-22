// tools/citation-manager/test/integration/us2.1-acceptance-criteria.test.js
import { describe, it, expect } from 'vitest';
import { createContentExtractor } from '../../src/factories/componentFactory.js';

describe('US2.1 Acceptance Criteria Validation', () => {
  const extractor = createContentExtractor();

  it('AC1: should mark full-file link ineligible without --full-files flag', () => {
    // Given: Link to full file (anchorType: null), no flag
    const link = { anchorType: null, extractionMarker: null };
    const cliFlags = { fullFiles: false };

    // When: Analyze eligibility
    const result = extractor.analyzeEligibility(link, cliFlags);

    // Then: Decision is ineligible
    expect(result.eligible).toBe(false);
  });

  it('AC2: should mark section and block links eligible by default', () => {
    // Given: Links with anchors (header and block)
    const headerLink = { anchorType: 'header', extractionMarker: null };
    const blockLink = { anchorType: 'block', extractionMarker: null };

    // When: Analyze eligibility
    const headerResult = extractor.analyzeEligibility(headerLink, {});
    const blockResult = extractor.analyzeEligibility(blockLink, {});

    // Then: Both eligible by default
    expect(headerResult.eligible).toBe(true);
    expect(blockResult.eligible).toBe(true);
  });

  it('AC3: should force full-file extraction with %%extract-link%% marker', () => {
    // Given: Full-file link with force marker, no flag
    const link = {
      anchorType: null,
      extractionMarker: { innerText: 'force-extract' }
    };
    const cliFlags = { fullFiles: false };

    // When: Analyze eligibility
    const result = extractor.analyzeEligibility(link, cliFlags);

    // Then: Eligible despite no --full-files flag
    expect(result.eligible).toBe(true);
  });

  it('AC4: should prevent section extraction with %%stop-extract-link%% marker', () => {
    // Given: Section link with stop marker
    const link = {
      anchorType: 'header',
      extractionMarker: { innerText: 'stop-extract-link' }
    };

    // When: Analyze eligibility
    const result = extractor.analyzeEligibility(link, {});

    // Then: Ineligible despite having anchor
    expect(result.eligible).toBe(false);
  });

  it('AC5: should give markers highest precedence over CLI flags', () => {
    // Given: Stop marker + --full-files flag
    const link1 = {
      anchorType: 'header',
      extractionMarker: { innerText: 'stop-extract-link' }
    };
    const result1 = extractor.analyzeEligibility(link1, { fullFiles: true });

    // Then: Stop marker wins (ineligible)
    expect(result1.eligible).toBe(false);

    // Given: Force marker + no flag
    const link2 = {
      anchorType: null,
      extractionMarker: { innerText: 'force-extract' }
    };
    const result2 = extractor.analyzeEligibility(link2, { fullFiles: false });

    // Then: Force marker wins (eligible)
    expect(result2.eligible).toBe(true);
  });

  it('AC6: should implement Strategy Pattern correctly', () => {
    // Given: Factory-created ContentExtractor
    const extractor = createContentExtractor();

    // Then: Component has 4 strategies in correct order
    expect(extractor.eligibilityStrategies).toBeDefined();
    expect(extractor.eligibilityStrategies.length).toBe(4);

    // Verify strategies in precedence order
    const strategyNames = extractor.eligibilityStrategies.map(s => s.constructor.name);
    expect(strategyNames).toEqual([
      'StopMarkerStrategy',
      'ForceMarkerStrategy',
      'SectionLinkStrategy',
      'CliFlagStrategy'
    ]);
  });
});
