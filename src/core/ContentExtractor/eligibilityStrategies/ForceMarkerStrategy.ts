import type { LinkObject } from '../../../types/citationTypes.js';
import type { CliFlags, EligibilityDecision } from '../../../types/contentExtractorTypes.js';
import { ExtractionStrategy } from './ExtractionStrategy.js';

/**
 * Strategy checking for %%force-extract%% marker.
 * Forces extraction of full-file links without --full-files flag.
 */
export class ForceMarkerStrategy extends ExtractionStrategy {
	override getDecision(link: LinkObject, cliFlags: CliFlags): EligibilityDecision | null {
		if (link.extractionMarker?.innerText === 'force-extract') {
			return {
				eligible: true,
				reason: 'force-extract overrides defaults',
			};
		}
		return null;
	}
}
