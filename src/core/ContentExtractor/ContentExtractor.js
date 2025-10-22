// tools/citation-manager/src/core/ContentExtractor/ContentExtractor.js
import { analyzeEligibility } from './analyzeEligibility.js';

/**
 * Content Extractor component orchestrating extraction eligibility analysis.
 * Component entry point following TitleCase naming convention.
 *
 * US2.1 Scope: Eligibility analysis only
 * US2.2 Future: Add content retrieval, ParsedFileCache, CitationValidator dependencies
 */
export class ContentExtractor {
  /**
   * Create ContentExtractor with eligibility strategies.
   *
   * @param {ExtractionStrategy[]} eligibilityStrategies - Ordered strategy chain
   */
  constructor(eligibilityStrategies) {
    this.eligibilityStrategies = eligibilityStrategies;
  }

  /**
   * Analyze link eligibility using strategy chain.
   * Public method for determining which links should be extracted.
   *
   * @param {LinkObject} link - Link to analyze
   * @param {Object} cliFlags - CLI flags
   * @returns {{ eligible: boolean, reason: string }} Eligibility decision
   */
  analyzeEligibility(link, cliFlags) {
    return analyzeEligibility(link, cliFlags, this.eligibilityStrategies);
  }
}
