/**
 * WikiFailLoudStrategy — rejects wiki links whose absolute path failed to resolve.
 *
 * When the parser attempted to resolve a wiki link but found nothing
 * (absolute === null, attempted paths recorded), we surface a clear error
 * rather than falling through to file-system probing.
 *
 * Returns null for non-wiki links or wiki links that were never attempted.
 */

import type {
	PathResolutionContext,
	PathResolutionResult,
	PathResolutionStrategy,
} from "./PathResolutionStrategy.js";
import { buildResult } from "./strategyHelpers.js";

export class WikiFailLoudStrategy implements PathResolutionStrategy {
	async resolve(
		ctx: PathResolutionContext,
	): Promise<PathResolutionResult | null> {
		const { citation } = ctx;

		if (
			citation.linkType !== "wiki" ||
			citation.target.path.absolute !== null ||
			citation.target.path.attempted === undefined ||
			citation.target.path.attempted.length === 0
		) {
			return null;
		}

		const tried = citation.target.path.attempted.join(", ");
		return buildResult(
			citation,
			"error",
			`Wiki page not found: ${citation.target.path.raw}`,
			`Tried: ${tried}`,
		);
	}
}
