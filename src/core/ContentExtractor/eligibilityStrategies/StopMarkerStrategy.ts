import type { LinkObject } from "../../../types/citationTypes.js";
import type { CliFlags } from "../../../types/cli-types.js";
import type { EligibilityDecision } from "../../../types/extraction-types.js";
import type { ExtractionEligibilityStrategy } from "../../../types/strategy-types.js";

/**
 * Strategy checking for %%stop-extract-link%% marker.
 * Highest precedence rule - prevents extraction regardless of other rules.
 */
export class StopMarkerStrategy implements ExtractionEligibilityStrategy {
	getDecision(
		link: LinkObject,
		_cliFlags: CliFlags,
	): EligibilityDecision | null {
		if (link.extractionMarker?.innerText === "stop-extract-link") {
			return {
				eligible: false,
				reason: "stop-extract-link marker prevents extraction",
			};
		}
		return null;
	}
}
