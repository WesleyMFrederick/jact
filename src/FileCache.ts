import ignore, { type Ignore } from "ignore";
import type { ScopeResolution } from "./core/resolveScope.js";
import type { CacheStats, ResolveResult } from "./types/fileCacheTypes.js";
import { levenshteinDistance } from "./utils/stringDistance.js";

/**
 * Default ignore patterns applied to every scan regardless of `.gitignore`
 * presence. Keeps the cache from indexing VCS metadata, vendored deps, and
 * build output that are never meaningful as wikilink targets.
 */
const DEFAULT_SCAN_IGNORE_PATTERNS: readonly string[] = [
	".git/",
	".hg/",
	".svn/",
	".venv/",
	"venv/",
	"node_modules/",
	"dist/",
	"build/",
	"coverage/",
];

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
 * - entries Map stores ALL paths per filename so duplicates are tracked as a single source of truth
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
	private scope: ScopeResolution | undefined = undefined; // set by buildCache; embedded in error messages from resolveFile
	private lastScanRoot: string | undefined = undefined; // real scan root of the last buildCache, for isIgnored()
	private lastRespectGitignore = false; // whether the last buildCache honored .gitignore

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
	 * Filtering: DEFAULT_SCAN_IGNORE_PATTERNS always apply. When
	 * `options.respectGitignore` is true (default), the root `.gitignore` is also
	 * loaded and applied. Pass `respectGitignore: false` to disable `.gitignore`
	 * filtering (default patterns still apply).
	 *
	 * @param scopeFolder - Root folder to scan (can be symlink, will be resolved)
	 * @param verbose - When true, log duplicate filename warnings to stderr
	 * @param scope - Optional resolution metadata used by resolveFile to enrich error messages
	 * @param options - Scan options
	 * @param options.respectGitignore - When true (default), apply root .gitignore patterns during scan
	 * @returns Cache statistics with { totalFiles, duplicates, scopeFolder, realScopeFolder }
	 */
	buildCache(
		scopeFolder: string,
		verbose = false,
		scope?: ScopeResolution,
		options: { respectGitignore?: boolean; alwaysIncludeDir?: string } = {},
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

		const respectGitignore = options.respectGitignore !== false;
		this.lastScanRoot = targetScanFolder;
		this.lastRespectGitignore = respectGitignore;
		const ignoreRules = this.buildIgnoreRules(
			targetScanFolder,
			respectGitignore,
		);

		// alwaysIncludeDir: paths on this branch bypass .gitignore so an
		// explicitly-targeted file inside an ignored folder is still indexed.
		// Default ignore patterns (node_modules, etc.) stay authoritative there,
		// so the include branch is checked against a defaults-only ruleset.
		const includeDir =
			options.alwaysIncludeDir !== undefined
				? this.path.resolve(options.alwaysIncludeDir)
				: undefined;
		const defaultRules =
			includeDir !== undefined
				? ignore().add([...DEFAULT_SCAN_IGNORE_PATTERNS])
				: undefined;

		this.scanDirectory(
			targetScanFolder,
			targetScanFolder,
			ignoreRules,
			includeDir,
			defaultRules,
		);

		const dupNames = this.duplicateNames();

		if (verbose && dupNames.length > 0) {
			console.error(
				`WARNING: Found duplicate filenames in scope: ${dupNames.join(", ")}`,
			);
		}

		return {
			totalFiles: this.entries.size,
			duplicates: dupNames.length,
			scopeFolder: absoluteScopeFolder,
			realScopeFolder: targetScanFolder,
		};
	}

	/**
	 * Filenames that resolve to more than one path. Single source of truth for
	 * duplicate detection — used by buildCache, getCacheStats, and any consumer
	 * that needs the ambiguous-filename list.
	 */
	private duplicateNames(): string[] {
		const dups: string[] = [];
		for (const [name, paths] of this.entries) {
			if (paths.length > 1) dups.push(name);
		}
		return dups;
	}

	/**
	 * Build the Ignore rules object used to filter entries during scan.
	 *
	 * Always includes DEFAULT_SCAN_IGNORE_PATTERNS. When `respectGitignore` is
	 * true and the scope root has a readable `.gitignore`, its patterns are
	 * loaded first, then DEFAULT_SCAN_IGNORE_PATTERNS are added to ensure
	 * defaults are authoritative (cannot be negated by .gitignore).
	 * Missing or unreadable `.gitignore` is non-fatal — defaults still apply.
	 */
	private buildIgnoreRules(
		scanRoot: string,
		respectGitignore: boolean,
	): Ignore {
		const rules = ignore();
		if (respectGitignore) {
			const gitignorePath = this.path.join(scanRoot, ".gitignore");
			try {
				const content = this.fs.readFileSync(gitignorePath, "utf-8");
				rules.add(content);
			} catch (_error) {
				// No .gitignore or unreadable — defaults still apply.
			}
		}
		rules.add([...DEFAULT_SCAN_IGNORE_PATTERNS]);
		return rules;
	}

	/**
	 * True when `fullPath` lies on the always-include branch: it is the include
	 * dir, an ancestor that leads down to it, or a descendant inside it. Used to
	 * bypass .gitignore for an explicitly-targeted file's directory subtree.
	 */
	private isOnIncludePath(fullPath: string, includeDir: string): boolean {
		const a = this.path.resolve(fullPath);
		const b = this.path.resolve(includeDir);
		if (a === b) return true;
		const sep = this.path.sep;
		return a.startsWith(b + sep) || b.startsWith(a + sep);
	}

	/**
	 * Contract: returns true only when `absPath` is excluded by the last scan's
	 * `.gitignore` (not by default ignore patterns), so callers can suggest
	 * `--allow-gitignore`. Returns false when the last scan ignored .gitignore,
	 * when there is no readable .gitignore, or when the path is outside scope.
	 */
	/**
	 * True when the last scan honored .gitignore AND the scope root has a
	 * readable, non-empty .gitignore — i.e. some paths could be hidden by it.
	 */
	scopeHasGitignore(): boolean {
		if (this.lastScanRoot === undefined || !this.lastRespectGitignore) {
			return false;
		}
		const gitignorePath = this.path.join(this.lastScanRoot, ".gitignore");
		try {
			const content = this.fs.readFileSync(gitignorePath, "utf-8");
			return content.trim().length > 0;
		} catch (_error) {
			return false;
		}
	}

	isIgnored(absPath: string): boolean {
		if (this.lastScanRoot === undefined || !this.lastRespectGitignore) {
			return false;
		}
		const gitignorePath = this.path.join(this.lastScanRoot, ".gitignore");
		let rules: Ignore;
		try {
			const content = this.fs.readFileSync(gitignorePath, "utf-8");
			rules = ignore().add(content);
		} catch (_error) {
			return false; // no .gitignore → nothing gitignore-excluded
		}
		const relative = this.path.relative(
			this.lastScanRoot,
			this.path.resolve(absPath),
		);
		// Empty (== scanRoot) or "../…" (outside scope) is not a gitignore hit.
		if (relative === "" || relative.startsWith("..")) return false;
		const posixRelative = relative.split(this.path.sep).join("/");
		return rules.ignores(posixRelative);
	}

	private scanDirectory(
		dirPath: string,
		scanRoot: string,
		ignoreRules: Ignore,
		alwaysIncludeDir?: string,
		defaultRules?: Ignore,
	): void {
		try {
			const entries = this.fs.readdirSync(dirPath);

			for (const entry of entries) {
				const fullPath = this.path.join(dirPath, entry);
				let stat: ReturnType<typeof this.fs.statSync>;
				try {
					stat = this.fs.statSync(fullPath);
				} catch (error) {
					// A dangling symlink (or an entry deleted mid-scan) makes
					// statSync throw ENOENT. Skip it silently and keep scanning
					// the rest of the directory — one bad entry must not abort
					// the whole scan or emit noise.
					if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
					throw error;
				}
				const isDir = stat.isDirectory();
				// `ignore` lib expects POSIX-style paths relative to scanRoot;
				// directory entries must end with "/" to match dir-only patterns.
				const relative = this.path.relative(scanRoot, fullPath);
				if (relative === "") continue;
				const posixRelative = relative.split(this.path.sep).join("/");
				const testPath = isDir ? `${posixRelative}/` : posixRelative;
				// On the always-include branch (ancestors leading to it, and
				// everything under it), bypass .gitignore but still apply the
				// authoritative default patterns (node_modules, etc.).
				const onIncludePath =
					alwaysIncludeDir !== undefined &&
					this.isOnIncludePath(fullPath, alwaysIncludeDir);
				const activeRules =
					onIncludePath && defaultRules !== undefined
						? defaultRules
						: ignoreRules;
				if (activeRules.ignores(testPath)) continue;

				if (isDir) {
					this.scanDirectory(
						fullPath,
						scanRoot,
						ignoreRules,
						alwaysIncludeDir,
						defaultRules,
					);
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
	 * Failure results carry candidates[] listing every matching path so callers
	 * can present the disambiguation choice to users.
	 *
	 * @param filename - Filename to resolve (with or without .md extension)
	 * @returns Result object with { found, path?, reason?, message?, candidates?, fuzzyMatch?, correctedFilename? }
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
	 * @param filename - Original filename that failed exact match
	 * @returns Fuzzy match result or null
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

	/**
	 * Get entries in the shape expected by `resolveWikiPath` Levenshtein layer.
	 *
	 * `basename` is the filename key (matches the wiki page name to fuzzy-match against).
	 * `relativePath` and `absolutePath` both reflect the cached absolute path — main's
	 * FileCache does not track scope-relative form separately, but threshold ratios
	 * clamp to ≤10 so longer absolute strings degrade gracefully.
	 */
	getEntries(): Array<{
		basename: string;
		relativePath: string;
		absolutePath?: string;
	}> {
		const result: Array<{
			basename: string;
			relativePath: string;
			absolutePath?: string;
		}> = [];
		for (const [filename, paths] of this.entries) {
			for (const p of paths) {
				result.push({
					basename: filename,
					relativePath: p,
					absolutePath: p,
				});
			}
		}
		return result;
	}

	// Get cache statistics (total files, duplicates)
	getCacheStats(): CacheStatsDetail {
		const duplicates = this.duplicateNames();
		return {
			totalFiles: this.entries.size,
			duplicateCount: duplicates.length,
			duplicates,
		};
	}
}

/**
 * Find top-k filename entries within Levenshtein distance ≤ maxDist of `name`.
 *
 * Stable sort: ties preserve Map insertion order. Length pre-filter skips
 * candidates whose length differs by more than maxDist — eliminates the O(m*n)
 * DP for the majority of entries at large scope sizes.
 *
 * Module-level export so it's unit-testable without class instantiation.
 */
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
		const d = levenshteinDistance(name, key);
		if (d <= maxDist) {
			candidates.push({ key, dist: d });
		}
	}

	candidates.sort((a, b) => a.dist - b.dist);

	return candidates.slice(0, k).map((c) => c.key);
}
