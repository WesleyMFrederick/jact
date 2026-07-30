import type { LinkObject } from "../../../types/citationTypes.js";
import type { CliFlags } from "../../../types/cli-types.js";
import type { EligibilityDecision } from "../../../types/extraction-types.js";
import type { ExtractionEligibilityStrategy } from "../../../types/strategy-types.js";

/**
 * Strategy checking for %%force-extract%% marker.
 * Forces extraction of full-file links without --full-files flag.
 */
export class ForceMarkerStrategy implements ExtractionEligibilityStrategy {
	getDecision(
		link: LinkObject,
		_cliFlags: CliFlags,
	): EligibilityDecision | null {
		if (link.extractionMarker?.innerText === "force-extract") {
			return {
				eligible: true,
				reason: "force-extract overrides defaults",
			};
		}
		return null;
	}
}
