import type { LinkObject } from "../../../types/citationTypes.js";
import type { CliFlags } from "../../../types/cli-types.js";
import type { EligibilityDecision } from "../../../types/extraction-types.js";
import type { ExtractionEligibilityStrategy } from "../../../types/strategy-types.js";

/**
 * Strategy evaluating --full-files CLI flag.
 * Terminal strategy - always returns decision (never null).
 */
export class CliFlagStrategy implements ExtractionEligibilityStrategy {
	getDecision(
		_link: LinkObject,
		cliFlags: CliFlags,
	): EligibilityDecision | null {
		if (cliFlags.fullFiles === true) {
			return {
				eligible: true,
				reason: "CLI flag --full-files forces extraction",
			};
		}
		return {
			eligible: false,
			reason: "Full-file link ineligible without --full-files flag",
		};
	}
}
