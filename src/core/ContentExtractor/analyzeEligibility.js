/**
 * Analyze link eligibility using strategy chain.
 * Returns first non-null decision from precedence-ordered strategies.
 *
 * @param {LinkObject} link - Link to analyze
 * @param {Object} cliFlags - CLI flags
 * @param {ExtractionStrategy[]} strategies - Strategy chain in precedence order
 * @returns {{ eligible: boolean, reason: string }} Eligibility decision
 */
export function analyzeEligibility(link, cliFlags, strategies) {
	// Loop through strategies in precedence order
	for (const strategy of strategies) {
		const decision = strategy.getDecision(link, cliFlags);

		// Return first non-null decision (highest priority wins)
		if (decision !== null) {
			return decision;
		}
	}

	// Fallback if all strategies return null
	return { eligible: false, reason: "No strategy matched" };
}

/**
 * Factory function creating configured analyzer.
 * Encapsulates strategy array for reuse.
 *
 * @param {ExtractionStrategy[]} strategies - Ordered strategy chain
 * @returns {Function} Configured analyzer: (link, cliFlags) => decision
 */
export function createEligibilityAnalyzer(strategies) {
	return (link, cliFlags) => analyzeEligibility(link, cliFlags, strategies);
}
