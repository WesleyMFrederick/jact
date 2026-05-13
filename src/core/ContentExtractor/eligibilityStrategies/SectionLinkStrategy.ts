import type { LinkObject } from "../../../types/citationTypes.js";
import type {
	CliFlags,
	EligibilityDecision,
	ExtractionEligibilityStrategy,
} from "../../../types/contentExtractorTypes.js";

/**
 * Strategy for default section/block link behavior.
 * Links with anchors are eligible by default.
 */
export class SectionLinkStrategy implements ExtractionEligibilityStrategy {
	getDecision(
		link: LinkObject,
		cliFlags: CliFlags,
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
