import { describe, it, expect } from 'vitest';
import { createContentExtractor } from '../../../src/factories/componentFactory.js';
import { ContentExtractor } from '../../../src/core/ContentExtractor/ContentExtractor.js';
import { StopMarkerStrategy } from '../../../src/core/ContentExtractor/eligibilityStrategies/StopMarkerStrategy.js';
import { ForceMarkerStrategy } from '../../../src/core/ContentExtractor/eligibilityStrategies/ForceMarkerStrategy.js';
import { SectionLinkStrategy } from '../../../src/core/ContentExtractor/eligibilityStrategies/SectionLinkStrategy.js';
import { CliFlagStrategy } from '../../../src/core/ContentExtractor/eligibilityStrategies/CliFlagStrategy.js';

describe('ComponentFactory - ContentExtractor Creation', () => {
  it('should create ContentExtractor with ParsedFileCache dependency', () => {
    // Given: Factory function available

    // When: Create ContentExtractor
    const extractor = createContentExtractor();

    // Then: Returns ContentExtractor instance
    // Verification: Factory wires dependencies correctly
    expect(extractor).toBeInstanceOf(ContentExtractor);
  });
});

describe('ComponentFactory - Strategy Precedence', () => {
  it('should create ContentExtractor with strategies in correct precedence order', () => {
    // Given: Factory creates default strategies

    // When: Create ContentExtractor without strategy override
    const extractor = createContentExtractor();

    // Then: Strategies array has correct precedence
    // Verification: Stop → Force → Section → CliFlag order
    const strategies = extractor.eligibilityStrategies;
    expect(strategies[0]).toBeInstanceOf(StopMarkerStrategy);
    expect(strategies[1]).toBeInstanceOf(ForceMarkerStrategy);
    expect(strategies[2]).toBeInstanceOf(SectionLinkStrategy);
    expect(strategies[3]).toBeInstanceOf(CliFlagStrategy);
  });
});
