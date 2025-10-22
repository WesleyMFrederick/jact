import { ExtractionStrategy } from "./ExtractionStrategy.js";

/**
 * Strategy checking for %%force-extract%% marker.
 * Forces extraction of full-file links without --full-files flag.
 */
export class ForceMarkerStrategy extends ExtractionStrategy {
	/**
	 * Check for force-extract marker that overrides default full-file link behavior.
	 * @param {LinkObject} link - Link to evaluate
	 * @param {Object} cliFlags - CLI flags
	 * @returns {{ eligible: boolean, reason: string }|null}
	 *          Decision if strategy applies, null to pass to next strategy
	 */
	getDecision(link, cliFlags) {
		// Check for force-extract marker
		if (link.extractionMarker?.innerText === "force-extract") {
			return {
				eligible: true,
				reason: "force-extract overrides defaults",
			};
		}

		return null;
	}
}
