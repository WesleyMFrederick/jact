// Display-layer discriminator separate from LinkObject.linkType.
// Per §7a D3 + §7a.3 Data Shape Deltas.

import type { LinkObject } from "../types/citationTypes.js";
import type { LinkClass } from "../types/validationTypes.js";

/**
 * Classify a LinkObject for display/reporting (per D3).
 *
 * Rules:
 *   linkType === "wiki"                                 → "wiki"
 *   linkType === "markdown" && anchorType === "block"   → "caret"
 *   linkType === "markdown"  (other anchor types)       → "markdown"
 *
 * Exhaustive over (linkType × anchorType): no fall-through, no undefined.
 */
export const getLinkClass = (link: LinkObject): LinkClass => {
	switch (link.linkType) {
		case "wiki":
			return "wiki";
		case "markdown":
			return link.anchorType === "block" ? "caret" : "markdown";
	}
};
