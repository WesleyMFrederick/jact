export class FileCache {
	constructor(fileSystem, pathModule) {
		this.fs = fileSystem;
		this.path = pathModule;
		this.cache = new Map(); // filename -> absolute path
		this.duplicates = new Set(); // filenames that appear multiple times
	}

	buildCache(scopeFolder) {
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
			console.warn(
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

	scanDirectory(dirPath) {
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
			console.warn(
				`Warning: Could not read directory ${dirPath}: ${error.message}`,
			);
		}
	}

	addToCache(filename, fullPath) {
		if (this.cache.has(filename)) {
			// Mark as duplicate
			this.duplicates.add(filename);
		} else {
			this.cache.set(filename, fullPath);
		}
	}

	resolveFile(filename) {
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

	findFuzzyMatch(filename) {
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

	getAllFiles() {
		return Array.from(this.cache.entries()).map(([filename, path]) => ({
			filename,
			path,
			isDuplicate: this.duplicates.has(filename),
		}));
	}

	getCacheStats() {
		return {
			totalFiles: this.cache.size,
			duplicateCount: this.duplicates.size,
			duplicates: Array.from(this.duplicates),
		};
	}
}
