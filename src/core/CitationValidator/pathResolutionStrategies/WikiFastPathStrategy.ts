/**
 * WikiFastPathStrategy — resolves wiki links with a known absolute path.
 *
 * Highest-priority strategy. When the parser has already resolved the wiki
 * link to an absolute path we trust that resolution, validate the anchor
 * (if any), and short-circuit.
 *
 * Returns null for non-wiki links or wiki links without a resolved path.
 */

import type {
	PathResolutionContext,
	PathResolutionResult,
	PathResolutionStrategy,
} from "./PathResolutionStrategy.js";
import { buildResult, checkAnchor } from "./strategyHelpers.js";

export class WikiFastPathStrategy implements PathResolutionStrategy {
	async resolve(
		ctx: PathResolutionContext,
	): Promise<PathResolutionResult | null> {
		const { citation, pathResolver, anchorMatcher } = ctx;

		if (
			citation.linkType !== "wiki" ||
			citation.target.path.absolute === null ||
			!pathResolver.isFile(citation.target.path.absolute)
		) {
			return null;
		}

		const targetPath = citation.target.path.absolute;

		const anchorResult = await checkAnchor(citation, targetPath, anchorMatcher);
		if (anchorResult !== null) return anchorResult;

		return buildResult(citation, "valid");
	}
}
