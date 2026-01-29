import type { LinkObject } from '../../../types/citationTypes.js';
import type { CliFlags, EligibilityDecision } from '../../../types/contentExtractorTypes.js';
import { ExtractionStrategy } from './ExtractionStrategy.js';

/**
 * Strategy for default section/block link behavior.
 * Links with anchors are eligible by default.
 */
export class SectionLinkStrategy extends ExtractionStrategy {
	override getDecision(link: LinkObject, cliFlags: CliFlags): EligibilityDecision | null {
		if (link.anchorType !== null) {
			return {
				eligible: true,
				reason: 'Markdown anchor links eligible by default',
			};
		}
		return null;
	}
}
