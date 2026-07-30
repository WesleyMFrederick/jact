import type { LinkObject } from "../../../types/citationTypes.js";
import type {
	FileCacheLike,
	PathResolutionOutcome,
	PathResolver,
} from "../PathResolver.js";

export interface PathResolutionContext {
	citation: LinkObject;
	sourceFile: string;
	candidatePath: string;
	standardPath: string;
	pathResolver: PathResolver;
	fileCache: FileCacheLike;
}

/** Internal adapter for one path-resolution case. */
export interface PathResolutionStrategy {
	resolve(context: PathResolutionContext): PathResolutionOutcome | null;
}
