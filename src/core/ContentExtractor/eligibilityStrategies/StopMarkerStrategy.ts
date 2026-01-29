import type { LinkObject } from '../../../types/citationTypes.js';
import type { CliFlags, EligibilityDecision } from '../../../types/contentExtractorTypes.js';
import { ExtractionStrategy } from './ExtractionStrategy.js';

/**
 * Strategy checking for %%stop-extract-link%% marker.
 * Highest precedence rule - prevents extraction regardless of other rules.
 */
export class StopMarkerStrategy extends ExtractionStrategy {
	override getDecision(link: LinkObject, cliFlags: CliFlags): EligibilityDecision | null {
		if (link.extractionMarker?.innerText === 'stop-extract-link') {
			return {
				eligible: false,
				reason: 'stop-extract-link marker prevents extraction',
			};
		}
		return null;
	}
}
