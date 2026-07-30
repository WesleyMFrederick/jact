import type { PathResolutionOutcome } from "../PathResolver.js";
import type {
	PathResolutionContext,
	PathResolutionStrategy,
} from "./PathResolutionStrategy.js";

export class WikiFastPathStrategy implements PathResolutionStrategy {
	resolve(context: PathResolutionContext): PathResolutionOutcome | null {
		const absolute = context.citation.target.path.absolute;
		if (
			context.citation.linkType !== "wiki" ||
			absolute === null ||
			!context.pathResolver.isFile(absolute)
		) {
			return null;
		}
		return {
			kind: "resolved",
			targetPath: absolute,
			anchorFailureStatus: "error",
		};
	}
}
