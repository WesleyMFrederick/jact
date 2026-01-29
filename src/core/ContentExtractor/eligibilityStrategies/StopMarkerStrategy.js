import { ExtractionStrategy } from "./ExtractionStrategy.ts";

/**
 * Strategy checking for %%stop-extract-link%% marker.
 * Highest precedence rule - prevents extraction regardless of other rules.
 */
export class StopMarkerStrategy extends ExtractionStrategy {
	/**
	 * Check for stop-extract-link marker that prevents extraction.
	 * @param {LinkObject} link - Link to evaluate
	 * @param {Object} cliFlags - CLI flags
	 * @returns {{ eligible: boolean, reason: string }|null}
	 *          Decision if strategy applies, null to pass to next strategy
	 */
	getDecision(link, cliFlags) {
		// Check for stop-extract-link marker
		if (link.extractionMarker?.innerText === "stop-extract-link") {
			return {
				eligible: false,
				reason: "stop-extract-link marker prevents extraction",
			};
		}

		// Not this strategy's concern - pass to next
		return null;
	}
}
