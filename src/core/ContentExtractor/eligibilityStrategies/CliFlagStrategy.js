import { ExtractionStrategy } from "./ExtractionStrategy.js";

/**
 * Strategy evaluating --full-files CLI flag.
 * Terminal strategy - always returns decision (never null).
 */
export class CliFlagStrategy extends ExtractionStrategy {
	/**
	 * Evaluate full-file links based on --full-files flag (terminal strategy).
	 * @param {LinkObject} link - Link to evaluate
	 * @param {Object} cliFlags - CLI flags
	 * @returns {{ eligible: boolean, reason: string }|null}
	 *          Decision if strategy applies, null to pass to next strategy
	 */
	getDecision(link, cliFlags) {
		// Check if --full-files flag enables extraction
		if (cliFlags.fullFiles === true) {
			return {
				eligible: true,
				reason: "CLI flag --full-files forces extraction",
			};
		}

		// Default: full-file links ineligible without flag
		return {
			eligible: false,
			reason: "Full-file link ineligible without --full-files flag",
		};
	}
}
