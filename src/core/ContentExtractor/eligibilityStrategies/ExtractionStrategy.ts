import type { LinkObject } from '../../../types/citationTypes.js';
import type { CliFlags, EligibilityDecision } from '../../../types/contentExtractorTypes.js';

/**
 * Base class for extraction eligibility strategies.
 * Strategy Pattern: Each rule encapsulated in its own class.
 */
export class ExtractionStrategy {
	/**
	 * Evaluate link eligibility based on strategy-specific criteria.
	 * @param link - Link to evaluate
	 * @param cliFlags - CLI flags
	 * @returns Decision if strategy applies, null to pass to next strategy
	 */
	getDecision(link: LinkObject, cliFlags: CliFlags): EligibilityDecision | null {
		return null;
	}
}
