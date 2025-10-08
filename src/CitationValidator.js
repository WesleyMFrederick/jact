import { existsSync, realpathSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

/**
 * Citation validator with multi-strategy path resolution
 *
 * Validates markdown citations (links and anchors) with intelligent path resolution
 * and anchor verification. Supports multiple link formats, symlink resolution, and
 * file cache-based smart matching.
 *
 * Validation features:
 * - Pattern validation (caret syntax, emphasis-marked, cross-document)
 * - File existence checking with multiple resolution strategies
 * - Anchor existence verification in target files
 * - Flexible anchor matching (handles markdown in headers, URL encoding)
 * - Cross-directory detection with path correction suggestions
 *
 * Path resolution strategies (in order):
 * 1. Standard relative path resolution
 * 2. Obsidian absolute path format (e.g., "0_SoftwareDevelopment/...")
 * 3. Symlink-resolved path resolution
 * 4. File cache smart filename matching
 *
 * Architecture decisions:
 * - Uses ParsedFileCache for anchor validation to avoid re-parsing target files
 * - Uses FileCache for smart filename resolution when relative paths fail
 * - Distinguishes between errors (broken links) and warnings (cross-directory resolutions)
 * - Provides path conversion suggestions for cross-directory warnings
 *
 * @example
 * const validator = new CitationValidator(parsedFileCache, fileCache);
 * const result = await validator.validateFile('/path/to/file.md');
 * // Returns { file, summary: { total, valid, errors, warnings }, results: [...] }
 */
export class CitationValidator {
	/**
	 * Initialize validator with cache dependencies
	 *
	 * @param {ParsedFileCache} parsedFileCache - Cache for parsed file data (anchor validation)
	 * @param {FileCache} fileCache - Cache for smart filename resolution
	 */
	constructor(parsedFileCache, fileCache) {
		this.parsedFileCache = parsedFileCache;
		this.fileCache = fileCache;

		// Pattern validation rules with precedence order
		this.patterns = {
			CARET_SYNTAX: {
				regex:
					/^\^([A-Za-z]{2,3}\d+(?:-\d+[a-z]?(?:AC\d+|T\d+(?:-\d+)?)?)?|[A-Za-z]+\d+|MVP-P\d+)$/,
				examples: ["^FR1", "^US1-1AC1", "^US1-4bT1-1", "^NFR2", "^MVP-P1"],
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

	// Safely resolve symlinks to real paths, returning original path if resolution fails
	safeRealpathSync(path) {
		try {
			return realpathSync(path);
		} catch (_error) {
			return path; // Return original path if realpath fails
		}
	}

	// Check if path exists and is a file
	isFile(path) {
		try {
			return existsSync(path) && statSync(path).isFile();
		} catch (_error) {
			return false;
		}
	}

	// Detect Obsidian absolute path format (e.g., "0_SoftwareDevelopment/file.md")
	isObsidianAbsolutePath(path) {
		// Detect Obsidian absolute paths like "0_SoftwareDevelopment/..."
		return /^[A-Za-z0-9_-]+\//.test(path) && !isAbsolute(path);
	}

	/**
	 * Convert Obsidian absolute path to filesystem path
	 *
	 * Walks up directory tree from source file looking for project root where
	 * the Obsidian path exists. Returns null if path cannot be resolved.
	 *
	 * @param {string} obsidianPath - Obsidian vault-relative path
	 * @param {string} sourceFile - Source file path (used to find project root)
	 * @returns {string|null} Resolved filesystem path or null
	 */
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

	/**
	 * Generate debug information for path resolution failures
	 *
	 * Provides detailed diagnostic information about why a path couldn't be resolved,
	 * including attempted resolution strategies and symlink information. Used in error
	 * messages to help users fix broken links.
	 *
	 * @param {string} relativePath - Relative path that failed to resolve
	 * @param {string} sourceFile - Source file path
	 * @returns {string} Debug information string
	 */
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

	/**
	 * Validate all citations in a markdown file
	 *
	 * Parses file and validates each extracted link. Generates summary with counts
	 * of valid, error, and warning citations. Throws error if file doesn't exist.
	 *
	 * @param {string} filePath - Path to markdown file to validate
	 * @returns {Promise<Object>} Validation result with { file, summary: { total, valid, errors, warnings }, results: [...] }
	 * @throws {Error} If file not found
	 */
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

	/**
	 * Validate a single citation
	 *
	 * Routes citation to appropriate validator based on pattern classification.
	 * Supports caret syntax, emphasis-marked, cross-document, and wiki-style links.
	 *
	 * @param {Object} citation - Citation object from parser with { linkType, scope, anchorType, target, ... }
	 * @param {string} contextFile - Source file path (for relative path resolution)
	 * @returns {Promise<Object>} Validation result with { status, line, citation, error?, suggestion?, pathConversion? }
	 */
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

	/**
	 * Resolve target file path using multi-strategy approach
	 *
	 * Attempts path resolution in order:
	 * 1. Standard relative path resolution (with URL decoding)
	 * 2. Obsidian absolute path format conversion
	 * 3. Symlink-resolved path resolution
	 * 4. File cache smart filename matching
	 *
	 * Returns standard path as fallback (will be caught as "file not found" by caller).
	 *
	 * @param {string} relativePath - Relative path from citation
	 * @param {string} sourceFile - Source file path
	 * @returns {string} Resolved absolute path (may not exist)
	 */
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

	/**
	 * Validate anchor exists in target file with flexible matching
	 *
	 * Checks if anchor exists in target file using multiple matching strategies:
	 * - Direct anchor ID match
	 * - URL-decoded match (for emphasis-marked anchors with %20)
	 * - Obsidian block reference match (^anchor-id)
	 * - Flexible markdown matching (handles backticks, bold, etc. in headers)
	 *
	 * Returns suggestions for similar anchors if not found. Validates that kebab-case
	 * anchors use raw header format for better Obsidian compatibility.
	 *
	 * @param {string} anchor - Anchor ID to find
	 * @param {string} targetFile - Target file path
	 * @returns {Promise<Object>} Result with { valid: boolean, suggestion?, matchedAs? }
	 */
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

	/**
	 * Find flexible anchor match handling markdown in headers
	 *
	 * Attempts multiple matching strategies for anchors with markdown formatting:
	 * - Exact match (ID or raw text)
	 * - Backtick-wrapped/unwrapped variations
	 * - Markdown-cleaned comparison (removes backticks, bold, italic, etc.)
	 *
	 * This handles cases where headers contain markdown like `code`, **bold**, or ==highlights==
	 * that affect anchor generation.
	 *
	 * @param {string} searchAnchor - Anchor to find (may be URL-encoded)
	 * @param {Array<Object>} availableAnchors - Anchors from target file with { id, rawText, anchorType }
	 * @returns {Object} Result with { found: boolean, matchType?: string }
	 */
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

	// Remove markdown syntax for anchor comparison
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

	/**
	 * Suggest better Obsidian-compatible anchor format
	 *
	 * Checks if a kebab-case anchor has a raw header equivalent and suggests using
	 * the raw format for better Obsidian compatibility. Obsidian prefers raw header
	 * text with URL encoding over auto-generated kebab-case.
	 *
	 * @param {string} usedAnchor - Anchor currently being used (may be kebab-case)
	 * @param {Array<Object>} availableAnchors - Available anchors from target file
	 * @returns {string|null} Suggested better anchor format or null
	 */
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

	/**
	 * Generate anchor suggestions based on similarity
	 *
	 * Simple similarity matching using substring comparison. Returns anchors that
	 * contain the search term or vice versa. Could be enhanced with fuzzy matching
	 * algorithms like Levenshtein distance.
	 *
	 * @param {string} anchor - Anchor that wasn't found
	 * @param {Array<string>} availableAnchors - Available anchor IDs from target file
	 * @returns {Array<string>} Up to 5 similar anchor suggestions
	 */
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

	// Check if source and target files are in the same directory
	isDirectoryMatch(sourceFile, targetFile) {
		const { dirname } = require("node:path");
		const sourceDir = dirname(sourceFile);
		const targetDir = dirname(targetFile);
		return sourceDir === targetDir;
	}

	// Calculate relative path from source to target file
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
