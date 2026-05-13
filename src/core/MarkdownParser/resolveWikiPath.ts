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

/**
 * Constrain a number to the inclusive range [lo, hi].
 *
 * If `value` is less than `lo`, returns `lo`; if greater than `hi`, returns `hi`; otherwise returns `value`.
 *
 * @param value - The number to clamp
 * @param lo - Lower bound of the range (inclusive)
 * @param hi - Upper bound of the range (inclusive)
 * @returns The input value constrained to the range `[lo, hi]`
 */
function clamp(value: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, value));
}

/**
 * Resolve a wiki page reference to an absolute file path using direct lookup, slug-normalization, and a local-first fuzzy match.
 *
 * @param rawPath - The page reference as written in the wiki link.
 * @param sourceAbsolutePath - Absolute path of the source file used to prefer nearby files when fuzzy matching; may be empty.
 * @param fileCache - Cache providing file resolution and entries for fuzzy matching.
 * @returns A ResolvedPath: on success includes `{ resolved: true; absolutePath }`; on failure includes `attempted` (the raw and slugged forms), optional `attemptedPaths` (deduplicated looked-up paths), and `suggestions` (up to three ranked relative paths).
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

	// Steps 3+4 merged: single pass over FileCache entries.
	// Local entries (within 2 directory levels of source) get 1.5× threshold headroom;
	// a local fuzzy hit returns resolved: true.
	// Ceiling pre-filter fires before clamp() to eliminate impossible candidates cheaply.
	const sourceDir = sourceAbsolutePath ? dirname(sourceAbsolutePath) : null;
	const parentDir = sourceDir ? dirname(sourceDir) : null;
	let bestLocal: { path: string; distance: number } | null = null;
	const candidatesWithDistance: Array<{ path: string; distance: number }> = [];

	for (const entry of fileCache.getEntries()) {
		const lenDiff = Math.abs(slugPath.length - entry.basename.length);
		// Ceiling pre-filter: skip entries that cannot match at any threshold (max is CEIL × 1.5)
		if (lenDiff > SUGGESTION_THRESHOLD_CEIL * 1.5) continue;

		const baseThreshold = clamp(
			Math.floor(SUGGESTION_THRESHOLD_RATIO * entry.relativePath.length),
			SUGGESTION_THRESHOLD_FLOOR,
			SUGGESTION_THRESHOLD_CEIL,
		);

		const isLocal =
			entry.absolutePath !== undefined &&
			sourceDir !== null &&
			parentDir !== null &&
			(entry.absolutePath.startsWith(sourceDir + "/") ||
				entry.absolutePath.startsWith(parentDir + "/"));

		const localThreshold = baseThreshold * 1.5;
		const qualifiesForLocal = isLocal && lenDiff <= localThreshold;
		const qualifiesForGlobal = lenDiff <= baseThreshold;

		if (!qualifiesForLocal && !qualifiesForGlobal) continue;

		const distance = levenshteinDistance(slugPath, entry.basename);

		if (qualifiesForLocal && distance <= localThreshold && entry.absolutePath) {
			if (!bestLocal || distance < bestLocal.distance) {
				bestLocal = { path: entry.absolutePath, distance };
			}
		}
		if (qualifiesForGlobal && distance <= baseThreshold) {
			candidatesWithDistance.push({ path: entry.relativePath, distance });
		}
	}

	if (bestLocal) {
		return { resolved: true, absolutePath: bestLocal.path };
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
