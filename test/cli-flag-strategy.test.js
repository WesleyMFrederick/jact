import { describe, it, expect } from 'vitest';
import { CliFlagStrategy } from '../src/core/ContentExtractor/eligibilityStrategies/CliFlagStrategy.js';

describe('CliFlagStrategy', () => {
  it('should return eligible when --full-files flag is present', () => {
    // Given: Full-file link with --full-files flag
    const strategy = new CliFlagStrategy();
    const link = { anchorType: null };
    const cliFlags = { fullFiles: true };

    // When: getDecision called
    const result = strategy.getDecision(link, cliFlags);

    // Then: Returns eligible (CLI flag enables extraction)
    expect(result).toEqual({
      eligible: true,
      reason: 'CLI flag --full-files forces extraction'
    });
  });

  it('should return ineligible when --full-files flag is absent', () => {
    // Given: Full-file link without flag
    const strategy = new CliFlagStrategy();
    const link = { anchorType: null };
    const cliFlags = { fullFiles: false };

    // When: getDecision called
    const result = strategy.getDecision(link, cliFlags);

    // Then: Returns ineligible (default full-file behavior)
    expect(result).toEqual({
      eligible: false,
      reason: 'Full-file link ineligible without --full-files flag'
    });
  });

  it('should return ineligible when flag is undefined', () => {
    // Given: Full-file link with empty flags
    const strategy = new CliFlagStrategy();
    const link = { anchorType: null };
    const cliFlags = {};

    // When: getDecision called
    const result = strategy.getDecision(link, cliFlags);

    // Then: Returns ineligible (treats undefined as false)
    expect(result).toEqual({
      eligible: false,
      reason: 'Full-file link ineligible without --full-files flag'
    });
  });
});
