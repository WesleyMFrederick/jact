/**
 * FileFoundStrategy — handles links where the target file exists on disk.
 *
 * Covers two sub-cases:
 *   1. File found via PathResolver at a different path than standard resolution
 *      (cross-directory) → warning + path conversion suggestion.
 *   2. File found at expected path → valid (after optional anchor check).
 *
 * Returns null when the file does NOT exist (defers to CacheFallbackStrategy).
 */

import { existsSync } from "node:fs";
import type {
	PathResolutionContext,
	PathResolutionResult,
	PathResolutionStrategy,
} from "./PathResolutionStrategy.js";
import { buildResult, checkAnchor } from "./strategyHelpers.js";

export class FileFoundStrategy implements PathResolutionStrategy {
	async resolve(
		ctx: PathResolutionContext,
	): Promise<PathResolutionResult | null> {
		const {
			citation,
			sourceFile,
			targetPath,
			standardPath,
			pathResolver,
			anchorMatcher,
		} = ctx;

		if (!existsSync(targetPath)) {
			return null;
		}

		const isCrossDirectory = standardPath !== targetPath;
		const crossDirMessage = isCrossDirectory
			? `Found via file cache in different directory: ${targetPath}`
			: null;

		if (citation.target.anchor) {
			const anchorExists = await anchorMatcher.validateAnchorExists(
				citation.target.anchor,
				targetPath,
			);
			if (!anchorExists.valid) {
				const anchorMessage = `Anchor not found: #${citation.target.anchor}`;
				const combinedMessage = crossDirMessage
					? `${crossDirMessage}. ${anchorMessage}`
					: anchorMessage;
				const status = isCrossDirectory ? "warning" : "error";
				return buildResult(
					citation,
					status,
					combinedMessage,
					anchorExists.suggestion,
				);
			}
			if (anchorExists.matchedAs === "block-ref-missing-caret") {
				return buildResult(citation, "warning", null, anchorExists.suggestion);
			}
		}

		if (isCrossDirectory) {
			const originalCitation = citation.target.anchor
				? `${citation.target.path.raw}#${citation.target.anchor}`
				: (citation.target.path.raw ?? "");
			const suggestion = pathResolver.generatePathConversionSuggestion(
				originalCitation,
				sourceFile,
				targetPath,
			);
			return buildResult(
				citation,
				"warning",
				null,
				crossDirMessage,
				suggestion,
			);
		}

		return buildResult(citation, "valid");
	}
}
