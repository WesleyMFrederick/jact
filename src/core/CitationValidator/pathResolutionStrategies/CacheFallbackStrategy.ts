/**
 * CacheFallbackStrategy — resolves files that failed standard path resolution
 * by querying the FileCache with the raw filename.
 *
 * Covers three sub-cases mirroring the original waterfall:
 *   1. fuzzyMatch — cache found a best-guess; treat as valid with a note.
 *   2. exact match in different directory — valid or warning + path conversion.
 *   3. duplicate or not_found — surface cache message as error.
 *
 * Returns null when the file WAS found via standard resolution (targetPath exists).
 */

import { existsSync } from "node:fs";
import type {
	PathResolutionContext,
	PathResolutionResult,
	PathResolutionStrategy,
} from "./PathResolutionStrategy.js";
import { buildResult, checkAnchor } from "./strategyHelpers.js";

export class CacheFallbackStrategy implements PathResolutionStrategy {
	async resolve(
		ctx: PathResolutionContext,
	): Promise<PathResolutionResult | null> {
		const {
			citation,
			sourceFile,
			targetPath,
			pathResolver,
			anchorMatcher,
			fileCache,
		} = ctx;

		// Only activate when standard resolution missed
		if (existsSync(targetPath)) {
			return null;
		}

		const filename = (citation.target.path.raw ?? "").split("/").pop() ?? "";
		const cacheResult = fileCache.resolveFile(filename);

		const debugInfo = pathResolver.generatePathResolutionDebugInfo(
			citation.target.path.raw ?? "",
			sourceFile,
		);

		// Case 1: fuzzy match
		if (cacheResult.found && cacheResult.fuzzyMatch) {
			if (cacheResult.path && existsSync(cacheResult.path)) {
				const anchorResult = await checkAnchor(
					citation,
					cacheResult.path,
					anchorMatcher,
					cacheResult.message ?? null,
				);
				if (anchorResult !== null) return anchorResult;
				return buildResult(
					citation,
					"valid",
					null,
					cacheResult.message ?? undefined,
				);
			}
		}

		// Case 2: exact cache match (different directory)
		if (cacheResult.found && !cacheResult.fuzzyMatch) {
			if (cacheResult.path && existsSync(cacheResult.path)) {
				const isDirectoryMatch = pathResolver.isDirectoryMatch(
					sourceFile,
					cacheResult.path,
				);
				const baseStatus = isDirectoryMatch ? "valid" : "warning";
				const crossDirMessage = isDirectoryMatch
					? null
					: `Found via file cache in different directory: ${cacheResult.path}`;

				const anchorResult = await checkAnchor(
					citation,
					cacheResult.path,
					anchorMatcher,
					crossDirMessage,
				);
				if (anchorResult !== null) {
					// For cross-dir + anchor error, combine messages
					if (crossDirMessage && anchorResult.error) {
						return buildResult(
							citation,
							"error",
							`${crossDirMessage}. ${anchorResult.error}`,
							anchorResult.suggestion ?? null,
						);
					}
					return anchorResult;
				}

				if (!isDirectoryMatch) {
					const originalCitation = citation.target.anchor
						? `${citation.target.path.raw ?? ""}#${citation.target.anchor}`
						: (citation.target.path.raw ?? "");
					const suggestion = pathResolver.generatePathConversionSuggestion(
						originalCitation,
						sourceFile,
						cacheResult.path,
					);
					return buildResult(
						citation,
						baseStatus,
						null,
						crossDirMessage,
						suggestion,
					);
				}

				return buildResult(citation, baseStatus, null, crossDirMessage);
			}
		}

		// Case 3: duplicate or not_found in cache
		if (
			cacheResult.reason === "duplicate" ||
			cacheResult.reason === "duplicate_fuzzy" ||
			cacheResult.reason === "not_found"
		) {
			return buildResult(
				citation,
				"error",
				`File not found: ${citation.target.path.raw}`,
				`${cacheResult.message ?? ""} ${debugInfo}`,
			);
		}

		// Fallback: no cache match at all
		return buildResult(
			citation,
			"error",
			`File not found: ${citation.target.path.raw}`,
			`Check if file exists or fix path. ${debugInfo}`,
		);
	}
}
