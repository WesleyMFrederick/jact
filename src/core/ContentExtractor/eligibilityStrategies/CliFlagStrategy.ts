import type { LinkObject } from '../../../types/citationTypes.js';
import type { CliFlags, EligibilityDecision } from '../../../types/contentExtractorTypes.js';
import { ExtractionStrategy } from './ExtractionStrategy.js';

/**
 * Strategy evaluating --full-files CLI flag.
 * Terminal strategy - always returns decision (never null).
 */
export class CliFlagStrategy extends ExtractionStrategy {
	override getDecision(link: LinkObject, cliFlags: CliFlags): EligibilityDecision | null {
		if (cliFlags.fullFiles === true) {
			return {
				eligible: true,
				reason: 'CLI flag --full-files forces extraction',
			};
		}
		return {
			eligible: false,
			reason: 'Full-file link ineligible without --full-files flag',
		};
	}
}
