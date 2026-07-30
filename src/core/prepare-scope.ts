import path from "node:path";
import type { FileCache } from "../FileCache.js";
import type { CacheStats } from "../types/fileCacheTypes.js";
import { resolveScope } from "./resolveScope.js";

export interface ScopeOptions {
	scope?: string;
	allowGitignore?: boolean;
}

export interface PreparedScope {
	stats: CacheStats;
	notices: string[];
}

export function prepareScope(
	fileCache: FileCache,
	options: ScopeOptions,
	targetFile?: string,
): PreparedScope {
	const notices: string[] = [];
	const resolved = resolveScope({
		...(options.scope !== undefined && { explicit: options.scope }),
		cwd: process.cwd(),
		...(targetFile !== undefined && { targetFile }),
	});
	if (resolved.source === "none") {
		throw new Error(
			`cannot resolve scope. Tried: ${(resolved.triedFallbacks ?? []).join(", ")}. Pass --scope <dir>.`,
		);
	}
	if (resolved.marker === ".obsidian") {
		notices.push(
			`Scoped to ${resolved.scope} (nearest Obsidian vault). Override with --scope <dir>.`,
		);
	}

	const respectGitignore = !options.allowGitignore;
	let stats = fileCache.buildCache(resolved.scope, false, resolved, {
		respectGitignore,
	});
	if (targetFile !== undefined) {
		const absoluteTarget = path.resolve(targetFile);
		if (fileCache.isIgnored(absoluteTarget)) {
			const includeDir = path.dirname(absoluteTarget);
			stats = fileCache.buildCache(resolved.scope, false, resolved, {
				respectGitignore,
				alwaysIncludeDir: includeDir,
			});
			notices.push(
				`Note: ${includeDir} is gitignored under ${resolved.scope} (via .gitignore or .jactignore); indexed it because you targeted a file inside it. Use --allow-gitignore to scan all gitignored paths.`,
			);
		}
	}
	return { stats, notices };
}
