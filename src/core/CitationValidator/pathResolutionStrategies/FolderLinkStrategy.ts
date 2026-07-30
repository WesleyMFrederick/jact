import type { PathResolutionOutcome } from "../PathResolver.js";
import type {
	PathResolutionContext,
	PathResolutionStrategy,
} from "./PathResolutionStrategy.js";

export class FolderLinkStrategy implements PathResolutionStrategy {
	resolve(context: PathResolutionContext): PathResolutionOutcome | null {
		const { citation, candidatePath, standardPath, pathResolver } = context;
		const directoryPath = pathResolver.isDirectory(candidatePath)
			? candidatePath
			: pathResolver.isDirectory(standardPath)
				? standardPath
				: null;
		if (directoryPath === null) return null;

		return {
			kind: "warning",
			error: `Link points to a folder, not a file: ${citation.target.path.raw}`,
			suggestion:
				"Link to a specific file inside the folder (e.g., folder/index.md) or create an index.md in the target folder",
		};
	}
}
