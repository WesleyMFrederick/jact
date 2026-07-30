import type { PathResolutionOutcome } from "../PathResolver.js";
import type {
	PathResolutionContext,
	PathResolutionStrategy,
} from "./PathResolutionStrategy.js";

export class FileFoundStrategy implements PathResolutionStrategy {
	resolve(context: PathResolutionContext): PathResolutionOutcome | null {
		const {
			citation,
			sourceFile,
			candidatePath,
			standardPath,
			pathResolver,
		} = context;
		if (!pathResolver.isFile(candidatePath)) return null;

		if (candidatePath === standardPath) {
			return {
				kind: "resolved",
				targetPath: candidatePath,
				anchorFailureStatus: "error",
			};
		}

		const originalCitation = citation.target.anchor
			? `${citation.target.path.raw}#${citation.target.anchor}`
			: (citation.target.path.raw ?? "");
		return {
			kind: "resolved",
			targetPath: candidatePath,
			anchorFailureStatus: "warning",
			warning: `Found via file cache in different directory: ${candidatePath}`,
			pathConversion: pathResolver.generatePathConversionSuggestion(
				originalCitation,
				sourceFile,
				candidatePath,
			),
		};
	}
}
