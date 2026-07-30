import type { PathResolutionOutcome } from "../PathResolver.js";
import type {
	PathResolutionContext,
	PathResolutionStrategy,
} from "./PathResolutionStrategy.js";

export class WikiFailLoudStrategy implements PathResolutionStrategy {
	resolve(context: PathResolutionContext): PathResolutionOutcome | null {
		const { citation } = context;
		const attempted = citation.target.path.attempted;
		if (
			citation.linkType !== "wiki" ||
			citation.target.path.absolute !== null ||
			attempted === undefined ||
			attempted.length === 0
		) {
			return null;
		}
		return {
			kind: "error",
			error: `Wiki page not found: ${citation.target.path.raw}`,
			suggestion: `Tried: ${attempted.join(", ")}`,
		};
	}
}
