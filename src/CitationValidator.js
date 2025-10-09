import { existsSync, realpathSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

export class CitationValidator {
	constructor(parsedFileCache, fileCache) {
		this.parsedFileCache = parsedFileCache;
		this.fileCache = fileCache;

		// Pattern validation rules with precedence order
		this.patterns = {
			CARET_SYNTAX: {
				regex:
					/^\^([A-Za-z]{2,3}\d+(?:-\d+[a-z]?(?:AC\d+|T\d+(?:-\d+)?)?)?|[A-Za-z]+\d+|MVP-P\d+|[a-z][a-z0-9-]+[a-z0-9])$/,
				examples: [
				"^FR1",
				"^US1-1AC1",
				"^US1-4bT1-1",
				"^NFR2",
				"^MVP-P1",
				"^black-box-interfaces",
				"^first-section-intro",
				"^deep-heading",
			],
				description:
				"Caret syntax for requirements/criteria (numbered) and Obsidian block references (text-based)",
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

	// Symlink resolution utilities
	safeRealpathSync(path) {
		try {
			return realpathSync(path);
		} catch (_error) {
			return path; // Return original path if realpath fails
		}
	}

	isFile(path) {
		try {
			return existsSync(path) && statSync(path).isFile();
		} catch (_error) {
			return false;
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
			debugParts.push("Detected Obsidian absolute path format");
		}

		return debugParts.join("; ");
	}

	async validateFile(filePath) {
		if (!existsSync(filePath)) {
			throw new Error(`File not found: ${filePath}`);
		}

		const parsed = await this.parsedFileCache.resolveParsedFile(filePath);
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

		// Caret references are now internal links with block anchorType
		if (citation.scope === "internal" && citation.anchorType === "block") {
			return "CARET_SYNTAX";
		}

		// Wiki-style links
		if (citation.linkType === "wiki") {
			if (citation.scope === "internal") {
				return "WIKI_STYLE";
			}
			// Wiki cross-document links
			return "CROSS_DOCUMENT";
		}

		// Cross-document links
		if (citation.scope === "cross-document") {
			if (
				citation.target.anchor?.startsWith("==**") &&
				citation.target.anchor.endsWith("**==")
			) {
				return "EMPHASIS_MARKED";
			}
			return "CROSS_DOCUMENT";
		}

		return "UNKNOWN_PATTERN";
	}

	validateCaretPattern(citation) {
		const anchor = citation.target.anchor || citation.fullMatch.substring(1); // Remove ^ from fullMatch

		// If anchor already starts with ^, don't add another one
		const anchorToTest = anchor.startsWith("^") ? anchor : `^${anchor}`;

		if (this.patterns.CARET_SYNTAX.regex.test(anchorToTest)) {
			return this.createValidationResult(citation, "valid");
		}
		return this.createValidationResult(
			citation,
			"error",
			`Invalid caret pattern: ${anchorToTest}`,
			`Use format: ${this.patterns.CARET_SYNTAX.examples.join(", ")}`,
		);
	}

	validateEmphasisPattern(citation) {
		const anchor = citation.target.anchor;

		if (this.patterns.EMPHASIS_MARKED.regex.test(anchor)) {
			return this.createValidationResult(citation, "valid");
		}
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

		return this.createValidationResult(
			citation,
			"error",
			"Invalid emphasis pattern",
			`Use format: ${this.patterns.EMPHASIS_MARKED.examples.join(", ")}`,
		);
	}

	async validateCrossDocumentLink(citation, sourceFile) {
		// Calculate what the standard path resolution would give us
		const decodedRelativePath = decodeURIComponent(citation.target.path.raw);
		const sourceDir = dirname(sourceFile);
		const standardPath = resolve(sourceDir, decodedRelativePath);

		const targetPath = this.resolveTargetPath(
			citation.target.path.raw,
			sourceFile,
		);

		// Check if target file exists
		if (!existsSync(targetPath)) {
			// Enhanced error message with path resolution debugging
			const debugInfo = this.generatePathResolutionDebugInfo(
				citation.target.path.raw,
				sourceFile,
			);

			// Provide enhanced error message when using file cache
			if (this.fileCache) {
				const filename = citation.target.path.raw.split("/").pop();
				const cacheResult = this.fileCache.resolveFile(filename);

				if (cacheResult.found && cacheResult.fuzzyMatch) {
					// Fuzzy match found - validate the corrected file exists and use it
					if (existsSync(cacheResult.path)) {
						// Continue with anchor validation using corrected file
						if (citation.target.anchor) {
							const anchorExists = await this.validateAnchorExists(
								citation.target.anchor,
								cacheResult.path,
							);
							if (!anchorExists.valid) {
								return this.createValidationResult(
									citation,
									"error",
									`Anchor not found: #${citation.target.anchor}`,
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
						// Check if resolution crosses directory boundaries FIRST
						const isDirectoryMatch = this.isDirectoryMatch(
							sourceFile,
							cacheResult.path,
						);
						const baseStatus = isDirectoryMatch ? "valid" : "warning";
						const crossDirMessage = isDirectoryMatch
							? null
							: `Found via file cache in different directory: ${cacheResult.path}`;

						// Then validate anchor if present
						if (citation.target.anchor) {
							const anchorExists = await this.validateAnchorExists(
								citation.target.anchor,
								cacheResult.path,
							);
							if (!anchorExists.valid) {
								// Combine messages if cross-directory AND anchor issue
								const anchorMessage = `Anchor not found: #${citation.target.anchor}`;
								const combinedMessage = crossDirMessage
									? `${crossDirMessage}. ${anchorMessage}`
									: anchorMessage;

								// For same-directory, use "error"; for cross-directory, use "warning"
								const status = isDirectoryMatch ? "error" : "warning";

								return this.createValidationResult(
									citation,
									status,
									combinedMessage,
									null,
									anchorExists.suggestion,
								);
							}
						}

						// Include path conversion suggestion for cross-directory warnings
						if (!isDirectoryMatch) {
							const originalCitation = citation.target.anchor
								? `${citation.target.path.raw}#${citation.target.anchor}`
								: citation.target.path.raw;
							const suggestion = this.generatePathConversionSuggestion(
								originalCitation,
								sourceFile,
								cacheResult.path,
							);
							return this.createValidationResult(
								citation,
								baseStatus,
								null,
								crossDirMessage,
								suggestion,
							);
						}

						return this.createValidationResult(
							citation,
							baseStatus,
							null,
							crossDirMessage,
						);
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
						`File not found: ${citation.target.path.raw}`,
						`${cacheResult.message}. ${debugInfo}`,
					);
				}
				if (cacheResult.reason === "not_found") {
					return this.createValidationResult(
						citation,
						"error",
						`File not found: ${citation.target.path.raw}`,
						`File "${filename}" not found in scope folder. ${debugInfo}`,
					);
				}
			}

			return this.createValidationResult(
				citation,
				"error",
				`File not found: ${citation.target.path.raw}`,
				`Check if file exists or fix path. ${debugInfo}`,
			);
		}

		// Check if file was resolved via file cache (paths differ) FIRST
		const isCrossDirectory = standardPath !== targetPath;
		const crossDirMessage = isCrossDirectory
			? `Found via file cache in different directory: ${targetPath}`
			: null;

		// Then validate anchor if present
		if (citation.target.anchor) {
			const anchorExists = await this.validateAnchorExists(
				citation.target.anchor,
				targetPath,
			);
			if (!anchorExists.valid) {
				// Combine messages if cross-directory AND anchor issue
				const anchorMessage = `Anchor not found: #${citation.target.anchor}`;
				const combinedMessage = crossDirMessage
					? `${crossDirMessage}. ${anchorMessage}`
					: anchorMessage;

				// For same-directory, use "error"; for cross-directory, use "warning"
				const status = isCrossDirectory ? "warning" : "error";

				return this.createValidationResult(
					citation,
					status,
					combinedMessage,
					null,
					anchorExists.suggestion,
				);
			}
		}

		// Return warning with path conversion suggestion if cross-directory
		if (isCrossDirectory) {
			const originalCitation = citation.target.anchor
				? `${citation.target.path.raw}#${citation.target.anchor}`
				: citation.target.path.raw;
			const suggestion = this.generatePathConversionSuggestion(
				originalCitation,
				sourceFile,
				targetPath,
			);
			return this.createValidationResult(
				citation,
				"warning",
				null,
				crossDirMessage,
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

		if (this.isFile(standardPath)) {
			return standardPath;
		}

		// Also try with original (non-decoded) path for backwards compatibility
		if (decodedRelativePath !== relativePath) {
			const originalStandardPath = resolve(sourceDir, relativePath);
			if (this.isFile(originalStandardPath)) {
				return originalStandardPath;
			}
		}

		// Strategy 2: Handle Obsidian absolute path format
		if (this.isObsidianAbsolutePath(decodedRelativePath)) {
			const obsidianPath = this.convertObsidianToFilesystemPath(
				decodedRelativePath,
				sourceFile,
			);
			if (obsidianPath && this.isFile(obsidianPath)) {
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
				if (this.isFile(symlinkResolvedPath)) {
					return symlinkResolvedPath;
				}

				// Try with original path as fallback
				if (decodedRelativePath !== relativePath) {
					const originalSymlinkPath = resolve(realSourceDir, relativePath);
					if (this.isFile(originalSymlinkPath)) {
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
			const parsed = await this.parsedFileCache.resolveParsedFile(targetFile);
			const availableAnchors = parsed.anchors.map((a) => a.id);

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
					.filter((a) => a.anchorType === "block")
					.map((a) => a.id);

				if (obsidianBlockRefs.includes(blockRefName)) {
					return { valid: true, matchedAs: "block-ref" };
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
				.filter((a) => a.anchorType === "header")
				.map((a) => `"${a.rawText}" → #${a.id}`)
				.slice(0, 5);

			const availableBlockRefs = parsed.anchors
				.filter((a) => a.anchorType === "block")
				.map((a) => `^${a.id}`)
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
			const anchorText = anchorObj.id;
			const rawText = anchorObj.rawText;

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
			if (anchorObj.id === usedAnchor) {
				// Check if there's a corresponding raw header with same rawText
				const rawHeaderEquivalent = availableAnchors.find(
					(a) =>
						a.anchorType === "header" &&
						a.id === anchorObj.rawText &&
						a.id !== usedAnchor,
				);

				if (rawHeaderEquivalent) {
					// URL encode the raw header for proper anchor format
					return encodeURIComponent(rawHeaderEquivalent.id).replace(
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

	/**
	 * Create a validation result object
	 * @param {object} citation - Citation object
	 * @param {string} status - Validation status
	 * @param {string|null} error - Error message if any
	 * @param {string|null} message - Additional message if any
	 * @param {object|null} suggestion - Suggestion object if any
	 * @returns {object} Validation result
	 */
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
			linkType: citation.linkType,
			scope: citation.scope,
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
