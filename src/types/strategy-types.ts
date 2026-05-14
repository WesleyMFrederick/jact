/**
 * Strategy interface types for the extraction eligibility chain.
 *
 * Split from contentExtractorTypes.ts (issue #28).
 */

import type { LinkObject } from "./citationTypes.js";
import type { CliFlags } from "./cli-types.js";
import type { EligibilityDecision } from "./extraction-types.js";

/**
 * Strategy interface for extraction eligibility evaluation.
 * Pattern: Strategy pattern with null return indicating "pass to next strategy".
 */
export interface ExtractionEligibilityStrategy {
	getDecision(link: LinkObject, cliFlags: CliFlags): EligibilityDecision | null;
}
