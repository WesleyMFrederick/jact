// Per D4 (a). Sibling to resolvePath.ts. FileCache is an injected parameter (per [H-D4-factory]).
import type { ResolveResult } from "../../types/fileCacheTypes.js";
import { levenshteinDistance } from "../../utils/stringDistance.js";
import { pageNameToSlug } from "../../utils/wikiPageSlug.js";

// Structural interface keeps the resolver decoupled from the concrete FileCache class
// (matches DI pattern used by CitationValidator). Test stubs satisfy this without needing
// the full FileCache surface area.
export interface WikiPathFileCache {
	resolveFile(filename: string): ResolveResult;
	getEntries(): Array<{ basename: string; relativePath: string }>;
}

// Return shape carries both attempted forms so the validator's broken-link reason
// can list them: "tried: <raw>, <slug>.md". On miss path, suggestions[] holds full
// relative paths whose basename is within the adaptive Levenshtein threshold (per D4).
export type ResolvedPath =
	| { resolved: true; absolutePath: string }
	| {
			resolved: false;
			attempted: [rawPath: string, slugPath: string];
			/** Full absolute paths attempted during FileCache resolution (for error output). */
			attemptedPaths?: readonly string[];
			suggestions: string[];
	  };

const SUGGESTION_THRESHOLD_FLOOR = 3;
const SUGGESTION_THRESHOLD_CEIL = 10;
const SUGGESTION_THRESHOLD_RATIO = 0.2;

function clamp(value: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, value));
}

/**
 * Two-step wiki page name resolver with adaptive Levenshtein suggestion fallback.
 *
 * Step 1: fileCache.resolveFile(rawPath)              — handles already-slugged or .md forms
 * Step 2: fileCache.resolveFile(slug + ".md")         — handles Title Case / em dash page names
 * Step 3: both miss → adaptive-threshold Levenshtein scan over fileCache.getEntries()
 *         basenames; suggestions[] = full relative paths (parent-folder context preserved).
 *         Threshold per candidate = clamp(3, 10, floor(0.2 * candidate.relativePath.length))
 *         (deeper paths warrant more headroom — see [H-D4-suggestion-threshold]).
 *         Cost optimization: scan only fires when both step-1 AND step-2 miss.
 */
export function resolveWikiPath(
	rawPath: string,
	_sourceAbsolutePath: string,
	fileCache: WikiPathFileCache,
): ResolvedPath {
	const step1 = fileCache.resolveFile(rawPath);
	if (step1.found) {
		return { resolved: true, absolutePath: step1.path };
	}

	const slugPath = `${pageNameToSlug(rawPath)}.md`;
	const step2 = fileCache.resolveFile(slugPath);
	if (step2.found) {
		return { resolved: true, absolutePath: step2.path };
	}

	// Both miss — adaptive-threshold Levenshtein scan (basename distance only).
	const suggestions: string[] = [];
	for (const entry of fileCache.getEntries()) {
		const threshold = clamp(
			Math.floor(SUGGESTION_THRESHOLD_RATIO * entry.relativePath.length),
			SUGGESTION_THRESHOLD_FLOOR,
			SUGGESTION_THRESHOLD_CEIL,
		);
		const distance = levenshteinDistance(slugPath, entry.basename);
		if (distance <= threshold) {
			suggestions.push(entry.relativePath);
		}
	}

	const attemptedPaths: string[] = [
		...(step1.attemptedPaths ?? []),
		...(step2.attemptedPaths ?? []),
	];
	return {
		resolved: false,
		attempted: [rawPath, slugPath],
		...(attemptedPaths.length > 0 && { attemptedPaths }),
		suggestions,
	};
}
