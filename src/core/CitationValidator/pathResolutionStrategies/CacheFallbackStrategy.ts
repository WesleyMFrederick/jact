import type { PathResolutionOutcome } from "../PathResolver.js";
import type {
	PathResolutionContext,
	PathResolutionStrategy,
} from "./PathResolutionStrategy.js";

export class CacheFallbackStrategy implements PathResolutionStrategy {
	resolve(context: PathResolutionContext): PathResolutionOutcome {
		const { citation, sourceFile, pathResolver, fileCache } = context;
		const rawPath = citation.target.path.raw ?? "";
		const filename = rawPath.split("/").pop() ?? "";
		const cacheResult = fileCache.resolveFile(filename);

		if (
			cacheResult.found &&
			cacheResult.path &&
			pathResolver.isFile(cacheResult.path)
		) {
			const targetPath = cacheResult.path;
			if (cacheResult.fuzzyMatch) {
				return {
					kind: "resolved",
					targetPath,
					anchorFailureStatus: "error",
					...(cacheResult.message && {
						anchorFailurePrefix: cacheResult.message,
					}),
				};
			}

			if (pathResolver.isDirectoryMatch(sourceFile, targetPath)) {
				return {
					kind: "resolved",
					targetPath,
					anchorFailureStatus: "error",
				};
			}

			const warning = `Found via file cache in different directory: ${targetPath}`;
			const originalCitation = citation.target.anchor
				? `${rawPath}#${citation.target.anchor}`
				: rawPath;
			return {
				kind: "resolved",
				targetPath,
				anchorFailureStatus: "error",
				anchorFailurePrefix: warning,
				warning,
				pathConversion: pathResolver.generatePathConversionSuggestion(
					originalCitation,
					sourceFile,
					targetPath,
				),
			};
		}

		const debugInfo = pathResolver.generatePathResolutionDebugInfo(
			rawPath,
			sourceFile,
		);
		const hasCacheFailure =
			cacheResult.reason === "duplicate" ||
			cacheResult.reason === "duplicate_fuzzy" ||
			cacheResult.reason === "not_found";
		return {
			kind: "error",
			error: `File not found: ${rawPath}`,
			suggestion: hasCacheFailure
				? `${cacheResult.message ?? ""} ${debugInfo}`
				: `Check if file exists or fix path. ${debugInfo}`,
		};
	}
}
