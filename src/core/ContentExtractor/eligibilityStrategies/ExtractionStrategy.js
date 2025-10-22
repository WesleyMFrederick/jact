/**
 * Base interface for extraction eligibility strategies.
 * Strategy Pattern: Each rule encapsulated in its own class.
 */
export class ExtractionStrategy {
	/**
	 * Evaluate link eligibility based on strategy-specific criteria.
	 * @param {LinkObject} link - Link to evaluate
	 * @param {Object} cliFlags - CLI flags
	 * @returns {{ eligible: boolean, reason: string }|null}
	 *          Decision if strategy applies, null to pass to next strategy
	 */
	getDecision(link, cliFlags) {
		// Base implementation: No decision (pass to next strategy)
		return null;
	}
}
