// tools/citation-manager/test/analyze-eligibility.test.js
import { describe, it, expect } from 'vitest';
import { analyzeEligibility, createEligibilityAnalyzer } from '../src/core/ContentExtractor/analyzeEligibility.js';
import { StopMarkerStrategy } from '../src/core/ContentExtractor/eligibilityStrategies/StopMarkerStrategy.js';
import { ForceMarkerStrategy } from '../src/core/ContentExtractor/eligibilityStrategies/ForceMarkerStrategy.js';
import { SectionLinkStrategy } from '../src/core/ContentExtractor/eligibilityStrategies/SectionLinkStrategy.js';
import { CliFlagStrategy } from '../src/core/ContentExtractor/eligibilityStrategies/CliFlagStrategy.js';

describe('analyzeEligibility', () => {
  it('should return first non-null decision from strategy chain', () => {
    // Given: Strategies in precedence order and section link
    const strategies = [
      new StopMarkerStrategy(),
      new ForceMarkerStrategy(),
      new SectionLinkStrategy(),
      new CliFlagStrategy()
    ];
    const link = { anchorType: 'header', extractionMarker: null };

    // When: analyzeEligibility called
    const result = analyzeEligibility(link, {}, strategies);

    // Then: Returns SectionLinkStrategy decision (first non-null)
    expect(result).toEqual({
      eligible: true,
      reason: 'Markdown anchor links eligible by default'
    });
  });

  it('should respect precedence order with stop marker winning', () => {
    // Given: Link with stop marker AND section anchor
    const strategies = [
      new StopMarkerStrategy(),
      new SectionLinkStrategy()
    ];
    const link = {
      anchorType: 'header',
      extractionMarker: { innerText: 'stop-extract-link' }
    };

    // When: analyzeEligibility called
    const result = analyzeEligibility(link, {}, strategies);

    // Then: Returns StopMarkerStrategy decision (highest precedence)
    expect(result).toEqual({
      eligible: false,
      reason: 'stop-extract-link marker prevents extraction'
    });
  });

  it('should fall through to terminal strategy when others return null', () => {
    // Given: Full-file link without markers or flags
    const strategies = [
      new StopMarkerStrategy(),
      new ForceMarkerStrategy(),
      new SectionLinkStrategy(),
      new CliFlagStrategy()
    ];
    const link = { anchorType: null, extractionMarker: null };

    // When: analyzeEligibility called without --full-files
    const result = analyzeEligibility(link, { fullFiles: false }, strategies);

    // Then: Returns CliFlagStrategy default decision
    expect(result).toEqual({
      eligible: false,
      reason: 'Full-file link ineligible without --full-files flag'
    });
  });
});

describe('createEligibilityAnalyzer', () => {
  it('should create configured analyzer function', () => {
    // Given: Strategies in precedence order
    const strategies = [new SectionLinkStrategy()];

    // When: createEligibilityAnalyzer called
    const analyzer = createEligibilityAnalyzer(strategies);

    // Then: Returns function accepting (link, cliFlags)
    expect(typeof analyzer).toBe('function');

    const link = { anchorType: 'header' };
    const result = analyzer(link, {});
    expect(result.eligible).toBe(true);
  });
});
