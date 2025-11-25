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
 * - Tracks duplicate filenames to prevent ambiguous resolutions
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
	private fs: any;
	private path: any;
	private cache: Map<string, string>; // filename -> absolute path
	private duplicates: Set<string>; // filenames that appear multiple times

	/**
	 * Initialize cache with file system and path dependencies
	 *
	 * @param {Object} fileSystem - Node.js fs module (or mock for testing)
	 * @param {Object} pathModule - Node.js path module (or mock for testing)
	 */
	constructor(fileSystem: any, pathModule: any) {
		this.fs = fileSystem;
		this.path = pathModule;
		this.cache = new Map<string, string>();
		this.duplicates = new Set<string>();
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
	buildCache(scopeFolder: string) {
		this.cache.clear();
		this.duplicates.clear();

		// Resolve symlinks to get the real path, but only scan the resolved path
		const absoluteScopeFolder = this.path.resolve(scopeFolder);
		let targetScanFolder;

		try {
			targetScanFolder = this.fs.realpathSync(absoluteScopeFolder);
		} catch (_error) {
			// If realpath fails, use the original path
			targetScanFolder = absoluteScopeFolder;
		}

		// Only scan the resolved target directory to avoid duplicates from symlink artifacts
		this.scanDirectory(targetScanFolder);

		// Log duplicates for debugging (should be much fewer now)
		if (this.duplicates.size > 0) {
			console.error(
				`WARNING: Found duplicate filenames in scope: ${Array.from(this.duplicates).join(", ")}`,
			);
		}

		return {
			totalFiles: this.cache.size,
			duplicates: this.duplicates.size,
			scopeFolder: absoluteScopeFolder,
			realScopeFolder: targetScanFolder,
		};
	}

	// Recursively scan directory for markdown files
	scanDirectory(dirPath: string) {
		try {
			const entries = this.fs.readdirSync(dirPath);

			for (const entry of entries) {
				const fullPath = this.path.join(dirPath, entry);
				const stat = this.fs.statSync(fullPath);

				if (stat.isDirectory()) {
					// Recursively scan subdirectories
					this.scanDirectory(fullPath);
				} else if (entry.endsWith(".md")) {
					// Cache markdown files
					this.addToCache(entry, fullPath);
				}
			}
		} catch (error) {
			// Skip directories we can't read (permissions, etc.)
			const errorMessage = error instanceof Error ? error.message : String(error);
			console.warn(
				`Warning: Could not read directory ${dirPath}: ${errorMessage}`,
			);
		}
	}

	// Add file to cache or mark as duplicate if filename already exists
	addToCache(filename: string, fullPath: string) {
		if (this.cache.has(filename)) {
			// Mark as duplicate
			this.duplicates.add(filename);
		} else {
			this.cache.set(filename, fullPath);
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
	 *
	 * @param {string} filename - Filename to resolve (with or without .md extension)
	 * @returns {Object} Result object with { found, path?, reason?, message?, fuzzyMatch?, correctedFilename? }
	 */
	resolveFile(filename: string) {
		// Check for exact filename match first
		if (this.cache.has(filename)) {
			if (this.duplicates.has(filename)) {
				return {
					found: false,
					reason: "duplicate",
					message: `Multiple files named "${filename}" found in scope. Use relative path for disambiguation.`,
				};
			}
			return {
				found: true,
				path: this.cache.get(filename),
			};
		}

		// Try without extension if not found
		const filenameWithoutExt = filename.replace(/\.md$/, "");
		const withMdExt = `${filenameWithoutExt}.md`;

		if (this.cache.has(withMdExt)) {
			if (this.duplicates.has(withMdExt)) {
				return {
					found: false,
					reason: "duplicate",
					message: `Multiple files named "${withMdExt}" found in scope. Use relative path for disambiguation.`,
				};
			}
			return {
				found: true,
				path: this.cache.get(withMdExt),
			};
		}

		// Try fuzzy matching for common typos and issues
		const fuzzyMatch = this.findFuzzyMatch(filename);
		if (fuzzyMatch) {
			return fuzzyMatch;
		}

		return {
			found: false,
			reason: "not_found",
			message: `File "${filename}" not found in scope folder.`,
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
	 * @returns {Object|null} Fuzzy match result with { found, path, fuzzyMatch: true, correctedFilename, message } or null
	 */
	findFuzzyMatch(filename: string) {
		const allFiles = Array.from(this.cache.keys());

		// Strategy 1: Fix double .md extension (e.g., "file.md.md" → "file.md")
		if (filename.endsWith(".md.md")) {
			const fixedFilename = filename.replace(/\.md\.md$/, ".md");
			if (this.cache.has(fixedFilename)) {
				if (this.duplicates.has(fixedFilename)) {
					return {
						found: false,
						reason: "duplicate_fuzzy",
						message: `Found potential match "${fixedFilename}" (corrected double .md extension), but multiple files with this name exist. Use relative path for disambiguation.`,
					};
				}
				return {
					found: true,
					path: this.cache.get(fixedFilename),
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
				if (this.cache.has(correctedFilename)) {
					if (this.duplicates.has(correctedFilename)) {
						return {
							found: false,
							reason: "duplicate_fuzzy",
							message: `Found potential typo correction "${correctedFilename}", but multiple files with this name exist. Use relative path for disambiguation.`,
						};
					}
					return {
						found: true,
						path: this.cache.get(correctedFilename),
						fuzzyMatch: true,
						correctedFilename: correctedFilename,
						message: `Auto-corrected typo: "${filename}" → "${correctedFilename}"`,
					};
				}
			}
		}

		// Strategy 3: Partial filename matching for architecture files
		if (filename.includes("arch-") || filename.includes("architecture")) {
			const archFiles = allFiles.filter(
				(f) =>
					(f.includes("arch") || f.includes("architecture")) &&
					!this.duplicates.has(f),
			);

			// Look for close matches based on key terms
			const baseFilename = filename.replace(/^arch-/, "").replace(/\.md$/, "");
			const closeMatch = archFiles.find((f) => {
				const baseTarget = f.replace(/^arch.*?-/, "").replace(/\.md$/, "");
				return (
					baseTarget.includes(baseFilename) || baseFilename.includes(baseTarget)
				);
			});

			if (closeMatch) {
				return {
					found: true,
					path: this.cache.get(closeMatch),
					fuzzyMatch: true,
					correctedFilename: closeMatch,
					message: `Found similar architecture file: "${filename}" → "${closeMatch}"`,
				};
			}
		}

		return null;
	}

	// Get all cached files with duplicate status
	getAllFiles() {
		return Array.from(this.cache.entries()).map(([filename, path]) => ({
			filename,
			path,
			isDuplicate: this.duplicates.has(filename),
		}));
	}

	// Get cache statistics (total files, duplicates)
	getCacheStats() {
		return {
			totalFiles: this.cache.size,
			duplicateCount: this.duplicates.size,
			duplicates: Array.from(this.duplicates),
		};
	}
}
