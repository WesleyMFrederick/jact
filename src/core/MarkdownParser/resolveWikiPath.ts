// Per D4 (a). Sibling to resolvePath.ts. FileCache is an injected parameter (per [H-D4-factory]).
import { dirname } from "node:path";
import type { ResolveResult } from "../../types/fileCacheTypes.js";
import { levenshteinDistance } from "../../utils/stringDistance.js";
import { pageNameToSlug } from "../../utils/wikiPageSlug.js";

// Structural interface keeps the resolver decoupled from the concrete FileCache class
// (matches DI pattern used by CitationValidator). Test stubs satisfy this without needing
// the full FileCache surface area.
export interface WikiPathFileCache {
	resolveFile(filename: string): ResolveResult;
	getEntries(): Array<{
		basename: string;
		relativePath: string;
		absolutePath?: string;
	}>;
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
 * Wiki page name resolver with local-first fuzzy resolution.
 *
 * Step 1: fileCache.resolveFile(rawPath)              — handles already-slugged or .md forms
 * Step 2: fileCache.resolveFile(slug + ".md")         — handles Title Case / em dash page names
 * Step 3: local-biased Levenshtein — files within 2 directory levels get 1.5× threshold;
 *         a local fuzzy hit returns resolved: true (not just a suggestion).
 * Step 4: global Levenshtein fallback → suggestions[] only, resolved: false.
 *         Cost optimization: scan only fires when steps 1–3 all miss.
 *
 * Note: relative paths (./  ../) are routed via resolvePath in createLinkObject, not here.
 */
export function resolveWikiPath(
	rawPath: string,
	sourceAbsolutePath: string,
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

	// Step 3: Local-biased fuzzy resolution — files within 2 directory levels of
	// sourceAbsolutePath get 1.5× threshold headroom; a local hit returns resolved: true.
	if (sourceAbsolutePath) {
		const sourceDir = dirname(sourceAbsolutePath);
		const parentDir = dirname(sourceDir);
		let bestLocal: { path: string; distance: number } | null = null;

		for (const entry of fileCache.getEntries()) {
			if (!entry.absolutePath) continue;
			const isLocal =
				entry.absolutePath.startsWith(sourceDir + "/") ||
				entry.absolutePath.startsWith(parentDir + "/");
			if (!isLocal) continue;

			const threshold =
				clamp(
					Math.floor(SUGGESTION_THRESHOLD_RATIO * entry.relativePath.length),
					SUGGESTION_THRESHOLD_FLOOR,
					SUGGESTION_THRESHOLD_CEIL,
				) * 1.5;
			if (Math.abs(slugPath.length - entry.basename.length) > threshold)
				continue;
			const distance = levenshteinDistance(slugPath, entry.basename);
			if (distance <= threshold) {
				if (!bestLocal || distance < bestLocal.distance) {
					bestLocal = { path: entry.absolutePath, distance };
				}
			}
		}

		if (bestLocal) {
			return { resolved: true, absolutePath: bestLocal.path };
		}
	}

	// Step 4: All miss — adaptive-threshold Levenshtein scan (basename distance only).
	// Collect candidates with distances, sort by distance, limit to top 3.
	const candidatesWithDistance: Array<{ path: string; distance: number }> = [];
	for (const entry of fileCache.getEntries()) {
		const threshold = clamp(
			Math.floor(SUGGESTION_THRESHOLD_RATIO * entry.relativePath.length),
			SUGGESTION_THRESHOLD_FLOOR,
			SUGGESTION_THRESHOLD_CEIL,
		);
		if (Math.abs(slugPath.length - entry.basename.length) > threshold) continue;
		const distance = levenshteinDistance(slugPath, entry.basename);
		if (distance <= threshold) {
			candidatesWithDistance.push({ path: entry.relativePath, distance });
		}
	}

	// Sort by distance (minimal changes first) and take top 3
	const suggestions: string[] = candidatesWithDistance
		.sort((a, b) => a.distance - b.distance)
		.slice(0, 3)
		.map((c) => c.path);

	// Deduplicate attemptedPaths to avoid redundant paths in error output
	const attemptedPaths: string[] = Array.from(
		new Set([...(step1.attemptedPaths ?? []), ...(step2.attemptedPaths ?? [])]),
	);
	// Always include attemptedPaths for consistent error output
	// (whether scope was explicit or auto-resolved)
	return {
		resolved: false,
		attempted: [rawPath, slugPath],
		...(attemptedPaths.length > 0 && { attemptedPaths }),
		suggestions,
	};
}
