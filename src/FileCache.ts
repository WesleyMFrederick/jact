import type { ScopeResolution } from "./core/resolveScope.js";
import type { CacheStats, ResolveResult } from "./types/fileCacheTypes.js";

interface FileEntry {
	filename: string;
	path: string;
	isDuplicate: boolean;
}

interface CacheStatsDetail {
	totalFiles: number;
	duplicateCount: number;
	duplicates: string[];
}

/**
 * Filename-based cache for smart file resolution
 *
 * Enables filename-only link resolution by building an in-memory index of all markdown files
 * within a scope folder. Supports fuzzy matching for common typos, double extensions, and
 * architecture file variants. Handles symlinks by resolving to real paths before scanning.
 *
 * Use case: Allow citations like [text](file.md) to resolve correctly even when the file
 * is in a different directory, as long as there's only one file with that name in scope.
 *
 * Architecture decisions:
 * - Scans only the symlink-resolved directory to avoid duplicate entries
 * - entries Map stores ALL paths per filename (D2 refactor — eliminates dual-state bug)
 * - Provides fuzzy matching as fallback (typo corrections, double extensions)
 * - Warns about duplicates to help users fix ambiguous references
 *
 * @example
 * const cache = new FileCache(fs, path);
 * cache.buildCache('/project/docs');
 * const result = cache.resolveFile('architecture.md');
 * // Returns { found: true, path: '/project/docs/design/architecture.md' }
 */
export class FileCache {
	private fs: typeof import("fs");
	private path: typeof import("path");
	private entries: Map<string, string[]>; // filename -> all paths in scan order
	private scope: ScopeResolution | undefined = undefined; // set by buildCache; used by resolveFile for D7 error messages

	/**
	 * Initialize cache with file system and path dependencies
	 *
	 * @param fileSystem - Node.js fs module (or mock for testing)
	 * @param pathModule - Node.js path module (or mock for testing)
	 */
	constructor(
		fileSystem: typeof import("fs"),
		pathModule: typeof import("path"),
	) {
		this.fs = fileSystem;
		this.path = pathModule;
		this.entries = new Map<string, string[]>();
	}

	/**
	 * Build cache by recursively scanning scope folder
	 *
	 * Resolves symlinks before scanning to prevent duplicate entries from symlink artifacts.
	 * Scans all subdirectories for .md files and indexes by filename. Warns if duplicate
	 * filenames are detected (these will require relative path disambiguation).
	 *
	 * @param {string} scopeFolder - Root folder to scan (can be symlink, will be resolved)
	 * @returns {Object} Cache statistics with { totalFiles, duplicates, scopeFolder, realScopeFolder }
	 */
	buildCache(
		scopeFolder: string,
		verbose = false,
		scope?: ScopeResolution,
	): CacheStats {
		this.entries.clear();
		this.scope = scope;

		const absoluteScopeFolder = this.path.resolve(scopeFolder);
		let targetScanFolder: string;

		try {
			targetScanFolder = this.fs.realpathSync(absoluteScopeFolder);
		} catch (_error) {
			targetScanFolder = absoluteScopeFolder;
		}

		this.scanDirectory(targetScanFolder);

		// Single pass: collect duplicate names and count together
		const dupNames: string[] = [];
		for (const [k, v] of this.entries) {
			if (v.length > 1) dupNames.push(k);
		}
		const duplicateCount = dupNames.length;

		if (verbose && duplicateCount > 0) {
			console.error(
				`WARNING: Found duplicate filenames in scope: ${dupNames.join(", ")}`,
			);
		}

		return {
			totalFiles: this.entries.size,
			duplicates: duplicateCount,
			scopeFolder: absoluteScopeFolder,
			realScopeFolder: targetScanFolder,
		};
	}

	private scanDirectory(dirPath: string): void {
		try {
			const entries = this.fs.readdirSync(dirPath);

			for (const entry of entries) {
				const fullPath = this.path.join(dirPath, entry);
				const stat = this.fs.statSync(fullPath);

				if (stat.isDirectory()) {
					this.scanDirectory(fullPath);
				} else if (entry.endsWith(".md")) {
					this.addToCache(entry, fullPath);
				}
			}
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			console.warn(
				`Warning: Could not read directory ${dirPath}: ${errorMessage}`,
			);
		}
	}

	private addToCache(filename: string, fullPath: string): void {
		const existing = this.entries.get(filename);
		if (existing) {
			existing.push(fullPath);
		} else {
			this.entries.set(filename, [fullPath]);
		}
	}

	/**
	 * Resolve filename to absolute path with fuzzy matching fallback
	 *
	 * Resolution strategy:
	 * 1. Exact filename match (fastest)
	 * 2. Try without/with .md extension
	 * 3. Fuzzy matching for typos and common issues
	 *
	 * Returns error if filename is ambiguous (multiple files with same name).
	 * D2: failure results carry candidates[] listing every matching path.
	 *
	 * @param {string} filename - Filename to resolve (with or without .md extension)
	 * @returns {Object} Result object with { found, path?, reason?, message?, candidates?, fuzzyMatch?, correctedFilename? }
	 */
	resolveFile(filename: string): ResolveResult {
		const arr = this.entries.get(filename);
		if (arr !== undefined) {
			if (arr.length > 1) {
				return this.buildDuplicateFailure(filename, arr);
			}
			// arr.length === 1 guaranteed (addToCache always pushes at least one)
			const resolvedPath = arr[0];
			if (resolvedPath === undefined) {
				return this.buildNotFoundFailure(filename);
			}
			return { found: true, path: resolvedPath };
		}

		// Try without/with .md extension
		const filenameWithoutExt = filename.replace(/\.md$/, "");
		const withMdExt = `${filenameWithoutExt}.md`;

		const arrExt = this.entries.get(withMdExt);
		if (arrExt !== undefined) {
			if (arrExt.length > 1) {
				return this.buildDuplicateFailure(withMdExt, arrExt);
			}
			const resolvedPathExt = arrExt[0];
			if (resolvedPathExt === undefined) {
				return this.buildNotFoundFailure(withMdExt);
			}
			return { found: true, path: resolvedPathExt };
		}

		// Try fuzzy matching for common typos and issues
		const fuzzyMatch = this.findFuzzyMatch(filename);
		if (fuzzyMatch) {
			return fuzzyMatch;
		}

		return this.buildNotFoundFailure(filename);
	}

	private buildDuplicateFailure(
		filename: string,
		paths: string[],
	): import("./types/fileCacheTypes.js").ResolveResultFailure {
		const scopeStr = this.scope
			? ` in scope=${this.scope.scope} (source: ${this.scope.source})`
			: "";
		const candidateLines = paths.map((p) => `  ${p}`).join("\n");
		const message = `'${filename}' matched ${paths.length} files${scopeStr}:\n${candidateLines}\nPass --scope to narrow.`;
		return {
			found: false,
			reason: "duplicate",
			candidates: paths,
			...(this.scope !== undefined && { scope: this.scope }),
			message,
		};
	}

	private buildNotFoundFailure(
		filename: string,
	): import("./types/fileCacheTypes.js").ResolveResultFailure {
		const nearMisses = findNearMisses(filename, this.entries);
		const scopeStr = this.scope
			? `'${filename}' not found in scope=${this.scope.scope} (source: ${this.scope.source}).`
			: `File "${filename}" not found in scope folder.`;
		const didYouMean =
			nearMisses.length > 0 ? ` Did you mean: ${nearMisses.join(", ")}?` : "";
		return {
			found: false,
			reason: "not_found",
			...(nearMisses.length > 0 && { nearMisses }),
			...(this.scope !== undefined && { scope: this.scope }),
			message: `${scopeStr}${didYouMean}`,
		};
	}

	/**
	 * Find fuzzy matches for common filename issues
	 *
	 * Applies intelligent corrections for:
	 * - Double extensions (file.md.md → file.md)
	 * - Common typos (verson → version, architeture → architecture, managment → management)
	 * - Partial architecture file matching (arch- prefixes)
	 *
	 * Returns null if no fuzzy match found. Returns duplicate error if corrected filename
	 * has multiple matches.
	 *
	 * @param {string} filename - Original filename that failed exact match
	 * @returns {Object|null} Fuzzy match result or null
	 */
	private findFuzzyMatch(filename: string): ResolveResult | null {
		const allFiles = Array.from(this.entries.keys());

		// Strategy 1: Fix double .md extension (e.g., "file.md.md" → "file.md")
		if (filename.endsWith(".md.md")) {
			const fixedFilename = filename.replace(/\.md\.md$/, ".md");
			const fixedArr = this.entries.get(fixedFilename);
			if (fixedArr !== undefined) {
				if (fixedArr.length > 1) {
					return {
						found: false,
						reason: "duplicate_fuzzy",
						candidates: fixedArr,
						message: `Found potential match "${fixedFilename}" (corrected double .md extension), but multiple files with this name exist. Use relative path for disambiguation.`,
					};
				}
				const fixedPath = fixedArr[0];
				if (fixedPath === undefined) {
					return {
						found: false,
						reason: "not_found",
						message: `File not found: ${fixedFilename}`,
					};
				}
				return {
					found: true,
					path: fixedPath,
					fuzzyMatch: true,
					correctedFilename: fixedFilename,
					message: `Auto-corrected double extension: "${filename}" → "${fixedFilename}"`,
				};
			}
		}

		// Strategy 2: Common typos (verson → version, etc.)
		const typoPatterns = [
			{ pattern: /verson/g, replacement: "version" },
			{ pattern: /architeture/g, replacement: "architecture" },
			{ pattern: /managment/g, replacement: "management" },
		];

		for (const typo of typoPatterns) {
			if (typo.pattern.test(filename)) {
				const correctedFilename = filename.replace(
					typo.pattern,
					typo.replacement,
				);
				const correctedArr = this.entries.get(correctedFilename);
				if (correctedArr !== undefined) {
					if (correctedArr.length > 1) {
						return {
							found: false,
							reason: "duplicate_fuzzy",
							candidates: correctedArr,
							message: `Found potential typo correction "${correctedFilename}", but multiple files with this name exist. Use relative path for disambiguation.`,
						};
					}
					const correctedPath = correctedArr[0];
					if (correctedPath === undefined) {
						return {
							found: false,
							reason: "not_found",
							message: `File not found: ${correctedFilename}`,
						};
					}
					return {
						found: true,
						path: correctedPath,
						fuzzyMatch: true,
						correctedFilename: correctedFilename,
						message: `Auto-corrected typo: "${filename}" → "${correctedFilename}"`,
					};
				}
			}
		}

		// Strategy 3: Partial filename matching for architecture files
		if (filename.includes("arch-") || filename.includes("architecture")) {
			const archFiles = allFiles.filter((f) => {
				const fArr = this.entries.get(f);
				return (
					(f.includes("arch") || f.includes("architecture")) &&
					fArr !== undefined &&
					fArr.length === 1
				);
			});

			const baseFilename = filename.replace(/^arch-/, "").replace(/\.md$/, "");
			const closeMatch = archFiles.find((f) => {
				const baseTarget = f.replace(/^arch.*?-/, "").replace(/\.md$/, "");
				return (
					baseTarget.includes(baseFilename) || baseFilename.includes(baseTarget)
				);
			});

			if (closeMatch) {
				const closeMatchArr = this.entries.get(closeMatch);
				if (closeMatchArr === undefined || closeMatchArr.length === 0) {
					return {
						found: false,
						reason: "not_found",
						message: `File not found: ${closeMatch}`,
					};
				}
				const closeMatchPath = closeMatchArr[0];
				if (closeMatchPath === undefined) {
					return {
						found: false,
						reason: "not_found",
						message: `File not found: ${closeMatch}`,
					};
				}
				return {
					found: true,
					path: closeMatchPath,
					fuzzyMatch: true,
					correctedFilename: closeMatch,
					message: `Found similar architecture file: "${filename}" → "${closeMatch}"`,
				};
			}
		}

		return null;
	}

	// Get all cached files with duplicate status
	getAllFiles(): FileEntry[] {
		const result: FileEntry[] = [];
		for (const [filename, paths] of this.entries) {
			const isDuplicate = paths.length > 1;
			for (const p of paths) {
				result.push({ filename, path: p, isDuplicate });
			}
		}
		return result;
	}

	// Get cache statistics (total files, duplicates)
	getCacheStats(): CacheStatsDetail {
		const duplicates = [...this.entries.entries()]
			.filter(([, v]) => v.length > 1)
			.map(([k]) => k);
		return {
			totalFiles: this.entries.size,
			duplicateCount: duplicates.length,
			duplicates,
		};
	}
}

// Module-level export (per G3): unit-testable without class instantiation
// Levenshtein top-k entries by ascending distance ≤ maxDist. Stable sort: ties preserve Map insertion order.
export function findNearMisses(
	name: string,
	entries: Map<string, string[]>,
	k = 3,
	maxDist = 2,
): string[] {
	const candidates: Array<{ key: string; dist: number }> = [];

	for (const key of entries.keys()) {
		if (key === name) continue;
		if (Math.abs(name.length - key.length) > maxDist) continue;
		const d = levenshtein(name, key);
		if (d <= maxDist) {
			candidates.push({ key, dist: d });
		}
	}

	// Stable sort by ascending distance (Map insertion order preserved for ties)
	candidates.sort((a, b) => a.dist - b.dist);

	return candidates.slice(0, k).map((c) => c.key);
}

function levenshtein(a: string, b: string): number {
	const m = a.length;
	const n = b.length;
	// Two rolling rows — O(n) allocation instead of O(m*n)
	let prev = Array.from({ length: n + 1 }, (_, j) => j);
	let curr = new Array<number>(n + 1);

	for (let i = 1; i <= m; i++) {
		curr[0] = i;
		for (let j = 1; j <= n; j++) {
			if (a[i - 1] === b[j - 1]) {
				curr[j] = prev[j - 1]!;
			} else {
				curr[j] = 1 + Math.min(prev[j]!, curr[j - 1]!, prev[j - 1]!);
			}
		}
		[prev, curr] = [curr, prev];
	}
	return prev[n]!;
}
