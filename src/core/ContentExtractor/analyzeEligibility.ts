import type { LinkObject } from '../../types/citationTypes.js';
import type {
	CliFlags,
	EligibilityDecision,
	ExtractionEligibilityStrategy,
} from '../../types/contentExtractorTypes.js';

/**
 * Analyze link eligibility using strategy chain.
 * Returns first non-null decision from precedence-ordered strategies.
 *
 * @param link - Link to analyze
 * @param cliFlags - CLI flags
 * @param strategies - Strategy chain in precedence order
 * @returns Eligibility decision
 */
export function analyzeEligibility(
	link: LinkObject,
	cliFlags: CliFlags,
	strategies: ExtractionEligibilityStrategy[],
): EligibilityDecision {
	for (const strategy of strategies) {
		const decision = strategy.getDecision(link, cliFlags);
		if (decision !== null) {
			return decision;
		}
	}
	return { eligible: false, reason: 'No strategy matched' };
}

/**
 * Factory function creating configured analyzer.
 * Encapsulates strategy array for reuse.
 *
 * @param strategies - Ordered strategy chain
 * @returns Configured analyzer function
 */
export function createEligibilityAnalyzer(
	strategies: ExtractionEligibilityStrategy[],
): (link: LinkObject, cliFlags: CliFlags) => EligibilityDecision {
	return (link: LinkObject, cliFlags: CliFlags) =>
		analyzeEligibility(link, cliFlags, strategies);
}
