import type { LinkObject } from "../../../types/citationTypes.js";
import type { CliFlags } from "../../../types/cli-types.js";
import type { EligibilityDecision } from "../../../types/extraction-types.js";
import type { ExtractionEligibilityStrategy } from "../../../types/strategy-types.js";

/**
 * Strategy for default section/block link behavior.
 * Links with anchors are eligible by default.
 */
export class SectionLinkStrategy implements ExtractionEligibilityStrategy {
	getDecision(
		link: LinkObject,
		_cliFlags: CliFlags,
	): EligibilityDecision | null {
		if (link.anchorType !== null) {
			return {
				eligible: true,
				reason: "Markdown anchor links eligible by default",
			};
		}
		return null;
	}
}
