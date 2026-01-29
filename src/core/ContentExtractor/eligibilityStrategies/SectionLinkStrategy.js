import { ExtractionStrategy } from "./ExtractionStrategy.ts";

/**
 * Strategy for default section/block link behavior.
 * Links with anchors are eligible by default.
 */
export class SectionLinkStrategy extends ExtractionStrategy {
	/**
	 * Evaluate section/block links which are eligible by default.
	 * @param {LinkObject} link - Link to evaluate
	 * @param {Object} cliFlags - CLI flags
	 * @returns {{ eligible: boolean, reason: string }|null}
	 *          Decision if strategy applies, null to pass to next strategy
	 */
	getDecision(link, cliFlags) {
		// Check if link has anchor (header or block)
		if (link.anchorType !== null) {
			return {
				eligible: true,
				reason: "Markdown anchor links eligible by default",
			};
		}

		// Full-file link - pass to next strategy
		return null;
	}
}
