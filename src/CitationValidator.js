import { existsSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { MarkdownParser } from "./MarkdownParser.js";

export class CitationValidator {
	constructor() {
		this.parser = new MarkdownParser();
		this.fileCache = null;

		// Pattern validation rules with precedence order
		this.patterns = {
			CARET_SYNTAX: {
				regex:
					/^\^([A-Z]{2,3}\d+(?:-\d+(?:AC\d+|T\d+(?:-\d+)?)?)?|[A-Z]+\d+|MVP-P\d+)$/,
				examples: ["^FR1", "^US1-1AC1", "^NFR2", "^MVP-P1"],
				description: "Caret syntax for requirements and criteria",
			},
			EMPHASIS_MARKED: {
				regex: /^==\*\*[^*]+\*\*==$/,
				examples: [
					"==**Component**==",
					"==**Code Processing Application.SetupOrchestrator**==",
				],
				description: "Emphasis-marked headers with double asterisks",
			},
			CROSS_DOCUMENT: {
				regex: /\.md$/,
				description: "Cross-document markdown file references",
			},
		};
	}

	setFileCache(fileCache) {
		this.fileCache = fileCache;
	}

	// Symlink resolution utilities
	safeRealpathSync(path) {
		try {
			return realpathSync(path);
		} catch (_error) {
			return path; // Return original path if realpath fails
		}
	}

	isObsidianAbsolutePath(path) {
		// Detect Obsidian absolute paths like "0_SoftwareDevelopment/..."
		return /^[A-Za-z0-9_-]+\//.test(path) && !isAbsolute(path);
	}

	convertObsidianToFilesystemPath(obsidianPath, sourceFile) {
		// Try to find the project root by walking up from source file
		let currentDir = dirname(sourceFile);

		// Walk up directory tree looking for common project indicators
		while (currentDir !== dirname(currentDir)) {
			const testPath = join(currentDir, obsidianPath);
			if (existsSync(testPath)) {
				return testPath;
			}
			currentDir = dirname(currentDir);
		}

		return null;
	}

	generatePathResolutionDebugInfo(relativePath, sourceFile) {
		const sourceDir = dirname(sourceFile);
		const realSourceFile = this.safeRealpathSync(sourceFile);
		const isSymlink = realSourceFile !== sourceFile;

		const debugParts = [];

		// Show if source file is a symlink
		if (isSymlink) {
			debugParts.push(`Source via symlink: ${sourceFile} → ${realSourceFile}`);
		}

		// Show attempted resolution paths
		const standardPath = resolve(sourceDir, relativePath);
		debugParts.push(`Tried: ${standardPath}`);

		// Show symlink-resolved path if different
		if (isSymlink) {
			const realSourceDir = dirname(realSourceFile);
			const symlinkResolvedPath = resolve(realSourceDir, relativePath);
			debugParts.push(`Symlink-resolved: ${symlinkResolvedPath}`);
		}

		// Check if it's an Obsidian absolute path
		if (this.isObsidianAbsolutePath(relativePath)) {
			debugParts.push(`Detected Obsidian absolute path format`);
		}

		return debugParts.join("; ");
	}

	async validateFile(filePath) {
		if (!existsSync(filePath)) {
			throw new Error(`File not found: ${filePath}`);
		}

		const parsed = await this.parser.parseFile(filePath);
		const results = [];

		// Validate each extracted link
		for (const link of parsed.links) {
			const result = await this.validateSingleCitation(link, filePath);
			results.push(result);
		}

		// Generate summary
		const summary = {
			total: results.length,
			valid: results.filter((r) => r.status === "valid").length,
			errors: results.filter((r) => r.status === "error").length,
			warnings: results.filter((r) => r.status === "warning").length,
		};

		return {
			file: filePath,
			summary,
			results,
		};
	}

	async validateSingleCitation(citation, contextFile) {
		const patternType = this.classifyPattern(citation);

		switch (patternType) {
			case "CARET_SYNTAX":
				return this.validateCaretPattern(citation);
			case "EMPHASIS_MARKED":
				return this.validateEmphasisPattern(citation);
			case "CROSS_DOCUMENT":
				return await this.validateCrossDocumentLink(citation, contextFile);
			case "WIKI_STYLE":
				return this.validateWikiStyleLink(citation);
			default:
				return this.createValidationResult(
					citation,
					"error",
					"Unknown citation pattern",
					"Use one of: cross-document [text](file.md#anchor), caret ^FR1, or wiki-style [[#anchor|text]]",
				);
		}
	}

	classifyPattern(citation) {
		// Pattern precedence: CARET > EMPHASIS > CROSS_DOCUMENT > WIKI_STYLE

		if (citation.type === "caret-reference") {
			return "CARET_SYNTAX";
		}

		if (citation.type === "wiki-style") {
			return "WIKI_STYLE";
		}

		if (citation.type === "cross-document") {
			if (
				citation.anchor?.startsWith("==**") &&
				citation.anchor.endsWith("**==")
			) {
				return "EMPHASIS_MARKED";
			}
			return "CROSS_DOCUMENT";
		}

		return "UNKNOWN_PATTERN";
	}

	validateCaretPattern(citation) {
		const anchor = citation.anchor || citation.fullMatch.substring(1); // Remove ^

		if (this.patterns.CARET_SYNTAX.regex.test(`^${anchor}`)) {
			return this.createValidationResult(citation, "valid");
		} else {
			return this.createValidationResult(
				citation,
				"error",
				`Invalid caret pattern: ^${anchor}`,
				`Use format: ${this.patterns.CARET_SYNTAX.examples.join(", ")}`,
			);
		}
	}

	validateEmphasisPattern(citation) {
		const anchor = citation.anchor;

		if (this.patterns.EMPHASIS_MARKED.regex.test(anchor)) {
			return this.createValidationResult(citation, "valid");
		} else {
			// Check common malformations
			if (anchor.includes("==") && anchor.includes("**")) {
				if (!anchor.startsWith("==**") || !anchor.endsWith("**==")) {
					return this.createValidationResult(
						citation,
						"error",
						"Malformed emphasis anchor - incorrect marker placement",
						`Use format: ==**ComponentName**== (found: ${anchor})`,
					);
				}
			} else {
				return this.createValidationResult(
					citation,
					"error",
					"Malformed emphasis anchor - missing ** markers",
					`Use format: ==**ComponentName**== (found: ${anchor})`,
				);
			}
		}

		return this.createValidationResult(
			citation,
			"error",
			"Invalid emphasis pattern",
			`Use format: ${this.patterns.EMPHASIS_MARKED.examples.join(", ")}`,
		);
	}

	async validateCrossDocumentLink(citation, sourceFile) {
		// Calculate what the standard path resolution would give us
		const decodedRelativePath = decodeURIComponent(citation.file);
		const sourceDir = dirname(sourceFile);
		const standardPath = resolve(sourceDir, decodedRelativePath);

		const targetPath = this.resolveTargetPath(citation.file, sourceFile);

		// Check if target file exists
		if (!existsSync(targetPath)) {
			// Enhanced error message with path resolution debugging
			const debugInfo = this.generatePathResolutionDebugInfo(
				citation.file,
				sourceFile,
			);

			// Provide enhanced error message when using file cache
			if (this.fileCache) {
				const filename = citation.file.split("/").pop();
				const cacheResult = this.fileCache.resolveFile(filename);

				if (cacheResult.found && cacheResult.fuzzyMatch) {
					// Fuzzy match found - validate the corrected file exists and use it
					if (existsSync(cacheResult.path)) {
						// Continue with anchor validation using corrected file
						if (citation.anchor) {
							const anchorExists = await this.validateAnchorExists(
								citation.anchor,
								cacheResult.path,
							);
							if (!anchorExists.valid) {
								return this.createValidationResult(
									citation,
									"error",
									`Anchor not found: #${citation.anchor}`,
									`${anchorExists.suggestion} (Note: ${cacheResult.message})`,
								);
							}
						}

						return this.createValidationResult(
							citation,
							"valid",
							null,
							cacheResult.message,
						);
					}
				} else if (cacheResult.found && !cacheResult.fuzzyMatch) {
					// Exact match found in cache - validate the file and continue
					if (existsSync(cacheResult.path)) {
						if (citation.anchor) {
							const anchorExists = await this.validateAnchorExists(
								citation.anchor,
								cacheResult.path,
							);
							if (!anchorExists.valid) {
								return this.createValidationResult(
									citation,
									"error",
									`Anchor not found: #${citation.anchor}`,
									anchorExists.suggestion,
								);
							}
						}

						// Check if resolution crosses directory boundaries
						const isDirectoryMatch = this.isDirectoryMatch(
							sourceFile,
							cacheResult.path,
						);
						const status = isDirectoryMatch ? "valid" : "warning";
						const message = isDirectoryMatch
							? null
							: `Found via file cache in different directory: ${cacheResult.path}`;

						// Include path conversion suggestion for cross-directory warnings
						if (!isDirectoryMatch) {
							const originalCitation = citation.anchor
								? `${citation.file}#${citation.anchor}`
								: citation.file;
							const suggestion = this.generatePathConversionSuggestion(
								originalCitation,
								sourceFile,
								cacheResult.path,
							);
							return this.createValidationResult(
								citation,
								status,
								null,
								message,
								suggestion,
							);
						}

						return this.createValidationResult(citation, status, null, message);
					}
				}

				// Handle error cases
				if (
					cacheResult.reason === "duplicate" ||
					cacheResult.reason === "duplicate_fuzzy"
				) {
					return this.createValidationResult(
						citation,
						"error",
						`File not found: ${citation.file}`,
						`${cacheResult.message}. ${debugInfo}`,
					);
				} else if (cacheResult.reason === "not_found") {
					return this.createValidationResult(
						citation,
						"error",
						`File not found: ${citation.file}`,
						`File "${filename}" not found in scope folder. ${debugInfo}`,
					);
				}
			}

			return this.createValidationResult(
				citation,
				"error",
				`File not found: ${citation.file}`,
				`Check if file exists or fix path. ${debugInfo}`,
			);
		}

		// If there's an anchor, validate it exists in target file
		if (citation.anchor) {
			const anchorExists = await this.validateAnchorExists(
				citation.anchor,
				targetPath,
			);
			if (!anchorExists.valid) {
				return this.createValidationResult(
					citation,
					"error",
					`Anchor not found: #${citation.anchor}`,
					anchorExists.suggestion,
				);
			}
		}

		// Check if file was resolved via file cache (paths differ)
		if (standardPath !== targetPath) {
			// Cross-directory resolution detected - return warning
			const status = "warning";
			const message = `Found via file cache in different directory: ${targetPath}`;
			const originalCitation = citation.anchor
				? `${citation.file}#${citation.anchor}`
				: citation.file;
			const suggestion = this.generatePathConversionSuggestion(
				originalCitation,
				sourceFile,
				targetPath,
			);
			return this.createValidationResult(
				citation,
				status,
				null,
				message,
				suggestion,
			);
		}

		return this.createValidationResult(citation, "valid");
	}

	validateWikiStyleLink(citation) {
		// Wiki-style links are internal references, always valid for now
		// Could add anchor existence checking in the future
		return this.createValidationResult(citation, "valid");
	}

	resolveTargetPath(relativePath, sourceFile) {
		// Decode URL encoding in paths (e.g., %20 becomes space)
		const decodedRelativePath = decodeURIComponent(relativePath);

		// Strategy 1: Standard relative path resolution with decoded path
		const sourceDir = dirname(sourceFile);
		const standardPath = resolve(sourceDir, decodedRelativePath);

		if (existsSync(standardPath)) {
			return standardPath;
		}

		// Also try with original (non-decoded) path for backwards compatibility
		if (decodedRelativePath !== relativePath) {
			const originalStandardPath = resolve(sourceDir, relativePath);
			if (existsSync(originalStandardPath)) {
				return originalStandardPath;
			}
		}

		// Strategy 2: Handle Obsidian absolute path format
		if (this.isObsidianAbsolutePath(decodedRelativePath)) {
			const obsidianPath = this.convertObsidianToFilesystemPath(
				decodedRelativePath,
				sourceFile,
			);
			if (obsidianPath && existsSync(obsidianPath)) {
				return obsidianPath;
			}
		}

		// Strategy 3: Resolve source file symlinks, then try relative resolution
		try {
			const realSourceFile = this.safeRealpathSync(sourceFile);
			if (realSourceFile !== sourceFile) {
				const realSourceDir = dirname(realSourceFile);

				// Try with decoded path first
				const symlinkResolvedPath = resolve(realSourceDir, decodedRelativePath);
				if (existsSync(symlinkResolvedPath)) {
					return symlinkResolvedPath;
				}

				// Try with original path as fallback
				if (decodedRelativePath !== relativePath) {
					const originalSymlinkPath = resolve(realSourceDir, relativePath);
					if (existsSync(originalSymlinkPath)) {
						return originalSymlinkPath;
					}
				}
			}
		} catch (_error) {
			// Continue to next strategy if symlink resolution fails
		}

		// Strategy 4: File cache smart filename matching (existing logic)
		if (this.fileCache) {
			const filename = decodedRelativePath.split("/").pop();
			const cacheResult = this.fileCache.resolveFile(filename);

			if (cacheResult.found) {
				return cacheResult.path;
			}
		}

		// Return standard path as fallback (will be caught as "file not found")
		return standardPath;
	}

	async validateAnchorExists(anchor, targetFile) {
		try {
			const parsed = await this.parser.parseFile(targetFile);
			const availableAnchors = parsed.anchors.map((a) => a.anchor);

			// Direct match
			if (availableAnchors.includes(anchor)) {
				// Check if this is a kebab-case anchor that has a raw header equivalent
				const obsidianBetterSuggestion = this.suggestObsidianBetterFormat(
					anchor,
					parsed.anchors,
				);
				if (obsidianBetterSuggestion) {
					return {
						valid: false,
						suggestion: `Use raw header format for better Obsidian compatibility: #${obsidianBetterSuggestion}`,
					};
				}
				return { valid: true };
			}

			// For emphasis-marked anchors, try URL-decoded version
			if (anchor.includes("%20")) {
				const decoded = decodeURIComponent(anchor);
				if (availableAnchors.includes(decoded)) {
					return { valid: true };
				}
			}

			// Obsidian block reference matching
			if (anchor.startsWith("^")) {
				const blockRefName = anchor.substring(1); // Remove the ^ prefix

				// Check if there's an Obsidian block reference with this name
				const obsidianBlockRefs = parsed.anchors
					.filter((a) => a.type === "obsidian-block-ref")
					.map((a) => a.anchor);

				if (obsidianBlockRefs.includes(blockRefName)) {
					return { valid: true, matchedAs: "obsidian-block-ref" };
				}

				// Also check legacy caret format for backward compatibility
				const caretRefs = parsed.anchors
					.filter((a) => a.type === "caret")
					.map((a) => a.anchor);

				if (caretRefs.includes(blockRefName)) {
					return { valid: true, matchedAs: "caret-ref" };
				}
			}

			// Enhanced flexible matching for complex markdown in headers
			const flexibleMatch = this.findFlexibleAnchorMatch(
				anchor,
				parsed.anchors,
			);
			if (flexibleMatch.found) {
				return { valid: true, matchedAs: flexibleMatch.matchType };
			}

			// Generate suggestions for similar anchors
			const suggestions = this.generateAnchorSuggestions(
				anchor,
				availableAnchors,
			);

			// Include Obsidian block references in available anchors list
			const availableHeaders = parsed.anchors
				.filter((a) => a.type === "header" || a.type === "header-explicit")
				.map((a) => `"${a.rawText || a.text}" → #${a.anchor}`)
				.slice(0, 5);

			const availableBlockRefs = parsed.anchors
				.filter((a) => a.type === "obsidian-block-ref" || a.type === "caret")
				.map((a) => `^${a.anchor}`)
				.slice(0, 5);

			const allSuggestions = [];
			if (suggestions.length > 0) {
				allSuggestions.push(
					`Available anchors: ${suggestions.slice(0, 3).join(", ")}`,
				);
			}
			if (availableHeaders.length > 0) {
				allSuggestions.push(
					`Available headers: ${availableHeaders.join(", ")}`,
				);
			}
			if (availableBlockRefs.length > 0) {
				allSuggestions.push(
					`Available block refs: ${availableBlockRefs.join(", ")}`,
				);
			}

			return {
				valid: false,
				suggestion:
					allSuggestions.length > 0
						? allSuggestions.join("; ")
						: "No similar anchors found",
			};
		} catch (error) {
			return {
				valid: false,
				suggestion: `Error reading target file: ${error.message}`,
			};
		}
	}

	findFlexibleAnchorMatch(searchAnchor, availableAnchors) {
		// Remove URL encoding for comparison
		const cleanSearchAnchor = decodeURIComponent(searchAnchor);

		for (const anchorObj of availableAnchors) {
			const anchorText = anchorObj.anchor;
			const rawText = anchorObj.rawText || anchorObj.text;

			// 1. Exact match (already checked above, but included for completeness)
			if (anchorText === cleanSearchAnchor) {
				return { found: true, matchType: "exact" };
			}

			// 2. Raw text match (handles backticks and other markdown)
			if (rawText === cleanSearchAnchor) {
				return { found: true, matchType: "raw-text" };
			}

			// 3. Backtick wrapped match (`setupOrchestrator.js` vs setupOrchestrator.js)
			if (
				cleanSearchAnchor.startsWith("`") &&
				cleanSearchAnchor.endsWith("`")
			) {
				const withoutBackticks = cleanSearchAnchor.slice(1, -1);
				if (rawText === withoutBackticks || anchorText === withoutBackticks) {
					return { found: true, matchType: "backtick-unwrapped" };
				}
			}

			// 4. Try wrapping search term in backticks if header has them
			if (rawText?.includes("`")) {
				const wrappedSearch = `\`${cleanSearchAnchor}\``;
				if (rawText === wrappedSearch) {
					return { found: true, matchType: "backtick-wrapped" };
				}
			}

			// 5. Flexible markdown cleanup - remove common markdown markers for comparison
			const cleanedHeader = this.cleanMarkdownForComparison(
				rawText || anchorText,
			);
			const cleanedSearch = this.cleanMarkdownForComparison(cleanSearchAnchor);

			if (cleanedHeader === cleanedSearch) {
				return { found: true, matchType: "markdown-cleaned" };
			}
		}

		return { found: false };
	}

	cleanMarkdownForComparison(text) {
		if (!text) return "";
		return text
			.replace(/`/g, "") // Remove backticks
			.replace(/\*\*/g, "") // Remove bold markers
			.replace(/\*/g, "") // Remove italic markers
			.replace(/==([^=]+)==/g, "$1") // Remove highlight markers
			.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // Remove links, keep text
			.trim();
	}

	suggestObsidianBetterFormat(usedAnchor, availableAnchors) {
		// Check if the used anchor is kebab-case and has a raw header equivalent
		for (const anchorObj of availableAnchors) {
			// Skip if this is the exact anchor being used
			if (anchorObj.anchor === usedAnchor) {
				// Check if there's a corresponding raw header (header-raw type)
				const rawHeaderEquivalent = availableAnchors.find(
					(a) =>
						a.type === "header-raw" &&
						a.anchor === anchorObj.rawText &&
						a.anchor !== usedAnchor,
				);

				if (rawHeaderEquivalent) {
					// URL encode the raw header for proper anchor format
					return encodeURIComponent(rawHeaderEquivalent.anchor).replace(
						/'/g,
						"%27",
					);
				}
			}
		}

		return null;
	}

	generateAnchorSuggestions(anchor, availableAnchors) {
		// Simple similarity matching - could be enhanced with fuzzy matching
		const searchTerm = anchor.toLowerCase();
		return availableAnchors
			.filter(
				(a) =>
					a.toLowerCase().includes(searchTerm) ||
					searchTerm.includes(a.toLowerCase()),
			)
			.slice(0, 5);
	}

	/**
	 * Check if the source file and target file are in the same directory.
	 * Used to detect cross-directory resolutions that should trigger warnings.
	 * @param {string} sourceFile - The source file path
	 * @param {string} targetFile - The target file path
	 * @returns {boolean} True if files are in the same directory, false otherwise
	 */
	isDirectoryMatch(sourceFile, targetFile) {
		const { dirname } = require("node:path");
		const sourceDir = dirname(sourceFile);
		const targetDir = dirname(targetFile);
		return sourceDir === targetDir;
	}

	/**
	 * Calculate relative path from source file to target file
	 * @param {string} sourceFile - Path to the source file
	 * @param {string} targetFile - Path to the target file
	 * @returns {string} Relative path with normalized forward slashes
	 */
	calculateRelativePath(sourceFile, targetFile) {
		const sourceDir = dirname(sourceFile);
		const relativePath = relative(sourceDir, targetFile);
		return relativePath.replace(/\\/g, "/"); // Normalize path separators for cross-platform compatibility
	}

	/**
	 * Generate structured conversion suggestion for path corrections
	 * @param {string} originalCitation - Original citation path
	 * @param {string} sourceFile - Path to the source file
	 * @param {string} targetFile - Path to the target file
	 * @returns {object} Structured suggestion with type, original, and recommended paths
	 */
	generatePathConversionSuggestion(originalCitation, sourceFile, targetFile) {
		const relativePath = this.calculateRelativePath(sourceFile, targetFile);

		// Preserve anchor fragments from original citation
		const anchorMatch = originalCitation.match(/#(.*)$/);
		const anchor = anchorMatch ? `#${anchorMatch[1]}` : "";

		return {
			type: "path-conversion",
			original: originalCitation,
			recommended: `${relativePath}${anchor}`,
		};
	}

	createValidationResult(
		citation,
		status,
		error = null,
		message = null,
		suggestion = null,
	) {
		const result = {
			line: citation.line,
			citation: citation.fullMatch,
			status,
			type: citation.type,
		};

		if (error) {
			result.error = error;
		}

		if (message) {
			result.suggestion = message;
		}

		if (suggestion) {
			result.pathConversion = suggestion;
		}

		return result;
	}
}
