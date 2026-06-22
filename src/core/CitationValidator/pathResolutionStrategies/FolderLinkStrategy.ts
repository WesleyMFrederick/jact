/**
 * FolderLinkStrategy — detects links that resolve to a directory, not a file.
 *
 * Emits a warning so the author knows to target a specific file inside
 * the folder. Checked before file-not-found strategies to give a more
 * helpful message when the directory itself exists.
 *
 * Returns null when the resolved path is not a directory.
 */

import type {
	PathResolutionContext,
	PathResolutionResult,
	PathResolutionStrategy,
} from "./PathResolutionStrategy.js";
import { buildResult } from "./strategyHelpers.js";

export class FolderLinkStrategy implements PathResolutionStrategy {
	async resolve(
		ctx: PathResolutionContext,
	): Promise<PathResolutionResult | null> {
		const { citation, targetPath, standardPath, pathResolver } = ctx;

		const directoryCheckPath = pathResolver.isFile(targetPath)
			? null
			: pathResolver.isDirectory(targetPath)
				? targetPath
				: pathResolver.isDirectory(standardPath)
					? standardPath
					: null;

		if (directoryCheckPath === null) {
			return null;
		}

		return buildResult(
			citation,
			"warning",
			`Link points to a folder, not a file: ${citation.target.path.raw}`,
			"Link to a specific file inside the folder (e.g., folder/index.md) or create an index.md in the target folder",
		);
	}
}
