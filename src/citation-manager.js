#!/usr/bin/env node

/**
 * Citation Manager CLI - Command-line tool for markdown citation validation
 *
 * Main CLI application providing citation validation, fixing, AST inspection,
 * and base path extraction for markdown files. Integrates MarkdownParser,
 * CitationValidator, FileCache, and ParsedFileCache components.
 *
 * Commands:
 * - validate: Validate citations in markdown file (with optional --fix)
 * - ast: Display parsed AST and extracted metadata
 * - base-paths: Extract distinct base paths from citations
 *
 * Features:
 * - File cache for smart filename resolution (--scope option)
 * - Line range filtering (--lines option)
 * - JSON and CLI output formats
 * - Automatic path and anchor fixing (--fix flag)
 * - Exit codes for CI/CD integration (0=success, 1=validation errors, 2=file not found)
 *
 * @module citation-manager
 */

import { Command } from "commander";
import {
	createCitationValidator,
	createContentExtractor,
	createFileCache,
	createMarkdownParser,
	createParsedFileCache,
} from "./factories/componentFactory.js";
import { LinkObjectFactory } from "./factories/LinkObjectFactory.js";

/**
 * Main application class for citation management operations
 *
 * Wires together all components and provides high-level operations for validation,
 * fixing, AST inspection, and path extraction. Handles CLI output formatting and
 * error reporting.
 */
export class CitationManager {
	/**
	 * Initialize citation manager with all required components
	 *
	 * Creates and wires together parser, caches, and validator using factory functions.
	 */
	constructor() {
		this.parser = createMarkdownParser();
		this.parsedFileCache = createParsedFileCache(this.parser);
		this.fileCache = createFileCache();
		this.validator = createCitationValidator(
			this.parsedFileCache,
			this.fileCache,
		);

		// Integration: Add ContentExtractor via factory
		this.contentExtractor = createContentExtractor(
			this.parsedFileCache,  // Share cache with validator
		);
	}

	/**
	 * Validate citations in markdown file
	 *
	 * Main validation entry point. Optionally builds file cache if scope provided.
	 * Supports line range filtering and multiple output formats (CLI or JSON).
	 *
	 * @param {string} filePath - Path to markdown file to validate
	 * @param {Object} [options={}] - Validation options
	 * @param {string} [options.scope] - Scope folder for file cache
	 * @param {string} [options.lines] - Line range to validate (e.g., "150-160" or "157")
	 * @param {string} [options.format='cli'] - Output format ('cli' or 'json')
	 * @returns {Promise<string>} Formatted validation report
	 */
	async validate(filePath, options = {}) {
		try {
			const startTime = Date.now();

			// Build file cache if scope is provided
			if (options.scope) {
				const cacheStats = this.fileCache.buildCache(options.scope);
				// Only show cache messages in non-JSON mode
				if (options.format !== "json") {
					console.log(
						`Scanned ${cacheStats.totalFiles} files in ${cacheStats.scopeFolder}`,
					);
					if (cacheStats.duplicates > 0) {
						console.log(
							`WARNING: Found ${cacheStats.duplicates} duplicate filenames`,
						);
					}
				}
			}

			const result = await this.validator.validateFile(filePath);
			const endTime = Date.now();

			result.validationTime = `${((endTime - startTime) / 1000).toFixed(1)}s`;

			// Apply line range filtering if specified
			if (options.lines) {
				const filteredResult = this.filterResultsByLineRange(
					result,
					options.lines,
				);
				if (options.format === "json") {
					return this.formatAsJSON(filteredResult);
				}
				return this.formatForCLI(filteredResult);
			}

			if (options.format === "json") {
				return this.formatAsJSON(result);
			}
			return this.formatForCLI(result);
		} catch (error) {
			if (options.format === "json") {
				return JSON.stringify(
					{
						error: error.message,
						file: filePath,
						success: false,
					},
					null,
					2,
				);
			}
			return `ERROR: ${error.message}`;
		}
	}

	/**
	 * Filter validation results by line range
	 *
	 * Filters citation results to only include those within specified line range.
	 * Recalculates summary statistics for filtered results.
	 *
	 * @param {Object} result - Full validation result object
	 * @param {string} lineRange - Line range string (e.g., "150-160" or "157")
	 * @returns {Object} Filtered result with updated summary and lineRange property
	 */
	filterResultsByLineRange(result, lineRange) {
		const { startLine, endLine } = this.parseLineRange(lineRange);

		const filteredLinks = result.links.filter((link) => {
			return link.line >= startLine && link.line <= endLine;
		});

		const filteredSummary = {
			total: filteredLinks.length,
			valid: filteredLinks.filter((link) => link.validation.status === "valid").length,
			errors: filteredLinks.filter((link) => link.validation.status === "error").length,
			warnings: filteredLinks.filter((link) => link.validation.status === "warning").length,
		};

		return {
			...result,
			links: filteredLinks,
			summary: filteredSummary,
			lineRange: `${startLine}-${endLine}`,
		};
	}

	// Parse line range string (e.g., "150-160" or "157")
	parseLineRange(lineRange) {
		if (lineRange.includes("-")) {
			const [start, end] = lineRange
				.split("-")
				.map((n) => Number.parseInt(n.trim(), 10));
			return { startLine: start, endLine: end };
		}
		const line = Number.parseInt(lineRange.trim(), 10);
		return { startLine: line, endLine: line };
	}

	/**
	 * Format validation results for CLI output
	 *
	 * Generates human-readable tree-style output with sections for errors,
	 * warnings, and valid citations. Includes summary statistics and validation time.
	 *
	 * @param {Object} result - Validation result object
	 * @returns {string} Formatted CLI output
	 */
	formatForCLI(result) {
		const lines = [];
		lines.push("Citation Validation Report");
		lines.push("==========================");
		lines.push("");
		lines.push(`File: ${result.file}`);
		if (result.lineRange) {
			lines.push(`Line Range: ${result.lineRange}`);
		}
		lines.push(`Processed: ${result.summary.total} citations found`);
		lines.push("");

		if (result.summary.errors > 0) {
			lines.push(`CRITICAL ERRORS (${result.summary.errors})`);
			result.links
				.filter((link) => link.validation.status === "error")
				.forEach((link, index) => {
					const isLast =
						index ===
						result.links.filter((link) => link.validation.status === "error").length - 1;
					const prefix = isLast ? "└─" : "├─";
					lines.push(`${prefix} Line ${link.line}: ${link.fullMatch}`);
					lines.push(`│  └─ ${link.validation.error}`);
					if (link.validation.suggestion) {
						lines.push(`│  └─ Suggestion: ${link.validation.suggestion}`);
					}
					if (!isLast) lines.push("│");
				});
			lines.push("");
		}

		if (result.summary.warnings > 0) {
			lines.push(`WARNINGS (${result.summary.warnings})`);
			result.links
				.filter((link) => link.validation.status === "warning")
				.forEach((link, index) => {
					const isLast =
						index ===
						result.links.filter((link) => link.validation.status === "warning").length - 1;
					const prefix = isLast ? "└─" : "├─";
					lines.push(`${prefix} Line ${link.line}: ${link.fullMatch}`);
					if (link.validation.suggestion) {
						lines.push(`│  └─ ${link.validation.suggestion}`);
					}
					if (!isLast) lines.push("│");
				});
			lines.push("");
		}

		if (result.summary.valid > 0) {
			lines.push(`VALID CITATIONS (${result.summary.valid})`);
			result.links
				.filter((link) => link.validation.status === "valid")
				.forEach((link, index) => {
					const isLast =
						index ===
						result.links.filter((link) => link.validation.status === "valid").length - 1;
					const prefix = isLast ? "└─" : "├─";
					lines.push(`${prefix} Line ${link.line}: ${link.fullMatch}`);
				});
			lines.push("");
		}

		lines.push("SUMMARY:");
		lines.push(`- Total citations: ${result.summary.total}`);
		lines.push(`- Valid: ${result.summary.valid}`);
		lines.push(`- Warnings: ${result.summary.warnings}`);
		lines.push(`- Critical errors: ${result.summary.errors}`);
		lines.push(`- Validation time: ${result.validationTime}`);
		lines.push("");

		if (result.summary.errors > 0) {
			lines.push(
				`VALIDATION FAILED - Fix ${result.summary.errors} critical errors`,
			);
		} else if (result.summary.warnings > 0) {
			lines.push(
				`VALIDATION PASSED WITH WARNINGS - ${result.summary.warnings} issues to review`,
			);
		} else {
			lines.push("ALL CITATIONS VALID");
		}

		return lines.join("\n");
	}

	// Format validation results as JSON
	formatAsJSON(result) {
		return JSON.stringify(result, null, 2);
	}

	/**
	 * Extract content from links in source document
	 *
	 * Pattern: Three-phase orchestration workflow
	 * Integration: Coordinates validator → extractor → output
	 *
	 * @param {string} sourceFile - Path to markdown file containing citations
	 * @param {Object} options - CLI options (scope, fullFiles)
	 * @returns {Promise<Object>} OutgoingLinksExtractedContent structure
	 */
	async extractLinks(sourceFile, options) {
		try {
			// Decision: Build file cache if --scope provided
			if (options.scope) {
				this.fileCache.buildCache(options.scope);
			}

			// Phase 1: Link Discovery & Validation
			// Pattern: Delegate to validator for link discovery and enrichment
			const validationResult = await this.validator.validateFile(sourceFile);
			const enrichedLinks = validationResult.links;

			// Decision: Report validation errors to stderr
			if (validationResult.summary.errors > 0) {
				console.error('Validation errors found:');
				const errors = enrichedLinks.filter(l => l.validation.status === 'error');
				for (const link of errors) {
					console.error(`  Line ${link.line}: ${link.validation.error}`);
				}
			}

			// Phase 2: Content Extraction
			// Pattern: Pass pre-validated enriched links to extractor
			const extractionResult = await this.contentExtractor.extractContent(
				enrichedLinks,
				{ fullFiles: options.fullFiles }  // Pass CLI flags to strategies
			);

			// Phase 3: Output
			// Boundary: Output JSON to stdout
			console.log(JSON.stringify(extractionResult, null, 2));

			// Decision: Exit code based on extraction success
			if (extractionResult.stats.uniqueContent > 0) {
				process.exitCode = 0;
			} else {
				process.exitCode = 1;
			}

		} catch (error) {
			console.error('ERROR:', error.message);
			process.exitCode = 2;
		}
	}

	/**
	 * Extract specific header content from target file using synthetic link pattern.
	 * Integration: Coordinates LinkObjectFactory → CitationValidator → ContentExtractor.
	 *
	 * Pattern: Four-phase orchestration workflow
	 * 1. Create synthetic LinkObject via factory
	 * 2. Validate synthetic link via validator
	 * 3. Extract content via extractor (if valid)
	 * 4. Return OutgoingLinksExtractedContent structure
	 *
	 * @param {string} targetFile - Path to markdown file containing header
	 * @param {string} headerName - Exact header text to extract
	 * @param {Object} options - CLI options (scope)
	 * @returns {Promise<Object>} OutgoingLinksExtractedContent structure
	 */
	async extractHeader(targetFile, headerName, options) {
		try {
			// Decision: Build file cache if --scope provided
			if (options.scope) {
				await this.fileCache.buildCache(options.scope);
			}

			// --- Phase 1: Synthetic Link Creation ---
			// Pattern: Use factory to create unvalidated LinkObject from CLI parameters
			const factory = new LinkObjectFactory();
			const syntheticLink = factory.createHeaderLink(targetFile, headerName);

			// --- Phase 2: Validation ---
			// Pattern: Validate synthetic link before extraction (fail-fast on errors)
			// Integration: CitationValidator returns validation result
			const validationResult = await this.validator.validateSingleCitation(syntheticLink, targetFile);

			// Extract validation metadata from result
			const validation = {
				status: validationResult.status,
			};

			if (validationResult.error) {
				validation.error = validationResult.error;
			}

			if (validationResult.suggestion) {
				validation.suggestion = validationResult.suggestion;
			}

			if (validationResult.pathConversion) {
				validation.pathConversion = validationResult.pathConversion;
			}

			// Add validation property to link object
			syntheticLink.validation = validation;

			// Decision: Check validation status before extraction (error handling)
			if (syntheticLink.validation.status === "error") {
				// Boundary: Error output to stderr
				console.error("Validation failed:", syntheticLink.validation.error);
				if (syntheticLink.validation.suggestion) {
					console.error("Suggestion:", syntheticLink.validation.suggestion);
				}
				process.exitCode = 1;
				return;
			}

			// --- Phase 3: Extraction ---
			// Pattern: Extract content from validated link
			// Integration: ContentExtractor processes single-link array
			const result = await this.contentExtractor.extractContent([syntheticLink], options);

			// --- Phase 4: Return ---
			// Decision: Return result for CLI to output (CLI handles stdout)
			return result;

		} catch (error) {
			// Decision: System errors use exit code 2
			console.error("ERROR:", error.message);
			process.exitCode = 2;
		}
	}

	/**
	 * Extract entire file content using synthetic link pattern.
	 * Integration: Coordinates LinkObjectFactory → CitationValidator → ContentExtractor.
	 *
	 * Pattern: Four-phase orchestration workflow
	 * 1. Create synthetic LinkObject via factory (anchorType: null)
	 * 2. Validate synthetic link via validator
	 * 3. Extract content via extractor with fullFiles flag
	 * 4. Return OutgoingLinksExtractedContent structure
	 *
	 * @param {string} targetFile - Path to markdown file to extract
	 * @param {Object} options - CLI options (scope, format)
	 * @returns {Promise<Object>} OutgoingLinksExtractedContent structure
	 */
	async extractFile(targetFile, options) {
		try {
			// Decision: Build file cache if --scope provided
			if (options.scope) {
				await this.fileCache.buildCache(options.scope);
			}

			// --- Phase 1: Synthetic Link Creation ---
			// Pattern: Use factory to create unvalidated LinkObject for full file
			const factory = new LinkObjectFactory();
			const syntheticLink = factory.createFileLink(targetFile);

			// --- Phase 2: Validation ---
			// Pattern: Validate synthetic link before extraction (fail-fast on errors)
			const validationResult = await this.validator.validateSingleCitation(syntheticLink, targetFile);

			// Extract validation metadata from result
			const validation = {
				status: validationResult.status,
			};

			if (validationResult.error) {
				validation.error = validationResult.error;
			}

			if (validationResult.suggestion) {
				validation.suggestion = validationResult.suggestion;
			}

			if (validationResult.pathConversion) {
				validation.pathConversion = validationResult.pathConversion;
			}

			// Add validation property to link object
			syntheticLink.validation = validation;

			// Decision: Apply path conversion if validator found file via cache
			// Pattern: Validator suggests recommended path when file found in different location
			if (validationResult.pathConversion && validationResult.pathConversion.recommended) {
				// Update target path to use cache-resolved absolute path
				const { resolve } = await import("node:path");
				const absolutePath = resolve(validationResult.pathConversion.recommended);
				syntheticLink.target.path.absolute = absolutePath;
			}

			// Decision: Check validation status before extraction (error handling)
			if (syntheticLink.validation.status === "error") {
				// Boundary: Error output to stderr
				console.error("Validation failed:", syntheticLink.validation.error);
				if (syntheticLink.validation.suggestion) {
					console.error("Suggestion:", syntheticLink.validation.suggestion);
				}
				process.exitCode = 1;
				return;
			}

			// --- Phase 3: Extraction ---
			// Decision: Force fullFiles flag for full-file extraction
			// Pattern: ContentExtractor uses CliFlagStrategy to make link eligible
			const result = await this.contentExtractor.extractContent(
				[syntheticLink],
				{ ...options, fullFiles: true }
			);

			// --- Phase 4: Return ---
			// Decision: Return result for CLI to output (CLI handles stdout)
			return result;

		} catch (error) {
			// Decision: System errors use exit code 2
			console.error("ERROR:", error.message);
			process.exitCode = 2;
		}
	}

	/**
	 * Extract distinct base paths from citations
	 *
	 * Parses file and extracts all unique target file paths from citations.
	 * Converts relative paths to absolute paths for consistency.
	 *
	 * @param {string} filePath - Path to markdown file
	 * @returns {Promise<Array<string>>} Sorted array of absolute paths
	 * @throws {Error} If extraction fails
	 */
	async extractBasePaths(filePath) {
		try {
			const { resolve, dirname, isAbsolute } = await import("node:path");
			const result = await this.validator.validateFile(filePath);

			const basePaths = new Set();
			const sourceDir = dirname(filePath);

			for (const link of result.links) {
				// Extract path from link - prefer target.path.absolute if available
				let path = null;

				if (link.target && link.target.path && link.target.path.absolute) {
					// Use pre-resolved absolute path from link object
					basePaths.add(link.target.path.absolute);
					continue;
				}

				// Fallback: extract path from fullMatch for patterns not captured in target
				// Standard markdown link pattern: [text](path) or [text](path#anchor)
				const standardMatch = link.fullMatch.match(
					/\[([^\]]+)\]\(([^)#]+)(?:#[^)]+)?\)/,
				);
				if (standardMatch) {
					path = standardMatch[2];
				}

				// Citation pattern: [cite: path]
				const citeMatch = link.fullMatch.match(/\[cite:\s*([^\]]+)\]/);
				if (citeMatch) {
					path = citeMatch[1].trim();
				}

				if (path) {
					// Convert relative paths to absolute paths
					const absolutePath = isAbsolute(path)
						? path
						: resolve(sourceDir, path);
					basePaths.add(absolutePath);
				}
			}

			return Array.from(basePaths).sort();
		} catch (error) {
			throw new Error(`Failed to extract base paths: ${error.message}`);
		}
	}

	/**
	 * Automatically fix citations in markdown file
	 *
	 * Applies automatic fixes for:
	 * - Path corrections (cross-directory warnings with pathConversion suggestions)
	 * - Anchor corrections (kebab-case to raw header format, missing anchor fixes)
	 *
	 * Modifies file in-place. Builds file cache if scope provided.
	 *
	 * @param {string} filePath - Path to markdown file to fix
	 * @param {Object} [options={}] - Fix options
	 * @param {string} [options.scope] - Scope folder for file cache
	 * @returns {Promise<string>} Fix report with changes made
	 */
	async fix(filePath, options = {}) {
		try {
			// Import fs for file operations
			const { readFileSync, writeFileSync } = await import("node:fs");

			// Build file cache if scope is provided
			if (options.scope) {
				const cacheStats = this.fileCache.buildCache(options.scope);
				console.log(
					`Scanned ${cacheStats.totalFiles} files in ${cacheStats.scopeFolder}`,
				);
				if (cacheStats.duplicates > 0) {
					console.log(
						`WARNING: Found ${cacheStats.duplicates} duplicate filenames`,
					);
				}
			}

			// First, validate to find fixable issues
			const validationResults = await this.validator.validateFile(filePath);

			// Find all fixable issues: warnings (path conversion) and errors (anchor fixes)
			const fixableLinks = validationResults.links.filter(
				(link) =>
					(link.validation.status === "warning" && link.validation.pathConversion) ||
					(link.validation.status === "error" &&
						link.validation.suggestion &&
						(link.validation.suggestion.includes(
							"Use raw header format for better Obsidian compatibility",
						) ||
							(link.validation.error.startsWith("Anchor not found") &&
								link.validation.suggestion.includes("Available headers:")))),
			);

			if (fixableLinks.length === 0) {
				return `No auto-fixable citations found in ${filePath}`;
			}

			// Read the file content
			let fileContent = readFileSync(filePath, "utf8");

			let fixesApplied = 0;
			let pathFixesApplied = 0;
			let anchorFixesApplied = 0;
			const fixes = [];

			// Process all fixable links
			for (const link of fixableLinks) {
				let newCitation = link.fullMatch;
				let fixType = "";

				// Apply path conversion if available
				if (link.validation.pathConversion) {
					newCitation = this.applyPathConversion(
						newCitation,
						link.validation.pathConversion,
					);
					pathFixesApplied++;
					fixType = "path";
				}

				// Apply anchor fix if needed (expanded logic for all anchor errors)
				if (
					link.validation.status === "error" &&
					link.validation.suggestion &&
					(link.validation.suggestion.includes(
						"Use raw header format for better Obsidian compatibility",
					) ||
						(link.validation.error.startsWith("Anchor not found") &&
							link.validation.suggestion.includes("Available headers:")))
				) {
					newCitation = this.applyAnchorFix(newCitation, link);
					anchorFixesApplied++;
					fixType = fixType ? "path+anchor" : "anchor";
				}

				// Replace citation in file content
				fileContent = fileContent.replace(link.fullMatch, newCitation);

				fixes.push({
					line: link.line,
					old: link.fullMatch,
					new: newCitation,
					type: fixType,
				});
				fixesApplied++;
			}

			// Write the fixed content back to the file
			if (fixesApplied > 0) {
				writeFileSync(filePath, fileContent, "utf8");

				// Enhanced reporting with breakdown
				const output = [
					`Fixed ${fixesApplied} citation${fixesApplied === 1 ? "" : "s"} in ${filePath}:`,
				];

				if (pathFixesApplied > 0) {
					output.push(
						`   - ${pathFixesApplied} path correction${pathFixesApplied === 1 ? "" : "s"}`,
					);
				}
				if (anchorFixesApplied > 0) {
					output.push(
						`   - ${anchorFixesApplied} anchor correction${anchorFixesApplied === 1 ? "" : "s"}`,
					);
				}

				output.push("", "Changes made:");

				for (const fix of fixes) {
					output.push(`  Line ${fix.line} (${fix.type}):`);
					output.push(`    - ${fix.old}`);
					output.push(`    + ${fix.new}`);
					output.push("");
				}

				return output.join("\n");
			}
			return `WARNING: Found ${fixableResults.length} fixable citations but could not apply fixes`;
		} catch (error) {
			return `ERROR: ${error.message}`;
		}
	}

	// Apply path conversion to citation
	applyPathConversion(citation, pathConversion) {
		return citation.replace(
			pathConversion.original,
			pathConversion.recommended,
		);
	}

	/**
	 * Parse available headers from suggestion message
	 *
	 * Extracts header mappings from validator suggestion string.
	 * Format: "Available headers: \"Vision Statement\" → #Vision Statement, ..."
	 *
	 * @param {string} suggestion - Suggestion message from validator
	 * @returns {Array<Object>} Array of { text, anchor } header objects
	 */
	parseAvailableHeaders(suggestion) {
		const headerRegex = /"([^"]+)"\s*→\s*#([^,]+)/g;
		return [...suggestion.matchAll(headerRegex)].map((match) => ({
			text: match[1].trim(),
			anchor: `#${match[2].trim()}`,
		}));
	}

	// Normalize anchor for fuzzy matching (removes # and hyphens)
	normalizeAnchorForMatching(anchor) {
		return anchor.replace("#", "").replace(/-/g, " ").toLowerCase();
	}

	/**
	 * Find best header match using fuzzy logic
	 *
	 * Matches normalized broken anchor against available headers using exact
	 * or punctuation-stripped comparison.
	 *
	 * @param {string} brokenAnchor - Anchor that wasn't found
	 * @param {Array<Object>} availableHeaders - Available headers with { text, anchor }
	 * @returns {Object|undefined} Best matching header or undefined
	 */
	findBestHeaderMatch(brokenAnchor, availableHeaders) {
		const searchText = this.normalizeAnchorForMatching(brokenAnchor);
		return availableHeaders.find(
			(header) =>
				header.text.toLowerCase() === searchText ||
				header.text.toLowerCase().replace(/[.\s]/g, "") ===
					searchText.replace(/\s/g, ""),
		);
	}

	// URL-encode anchor text (spaces to %20, periods to %2E)
	urlEncodeAnchor(headerText) {
		return headerText.replace(/ /g, "%20").replace(/\./g, "%2E");
	}

	/**
	 * Apply anchor fix to citation
	 *
	 * Handles two fix types:
	 * - Obsidian compatibility: kebab-case to raw header format
	 * - Missing anchors: fuzzy match to available headers
	 *
	 * @param {string} citation - Original citation text
	 * @param {Object} link - Enriched link object with validation metadata
	 * @returns {string} Citation with corrected anchor or original if no fix found
	 */
	applyAnchorFix(citation, link) {
		const suggestionMatch = link.validation.suggestion.match(
			/Use raw header format for better Obsidian compatibility: #(.+)$/,
		);
		if (suggestionMatch) {
			const newAnchor = suggestionMatch[1];
			const citationMatch = citation.match(/\[([^\]]+)\]\(([^)]+)#([^)]+)\)/);
			if (citationMatch) {
				const [, linkText, filePath] = citationMatch;
				return `[${linkText}](${filePath}#${newAnchor})`;
			}
		}

		// Handle anchor not found errors
		if (
			link.validation.error.startsWith("Anchor not found") &&
			link.validation.suggestion.includes("Available headers:")
		) {
			const availableHeaders = this.parseAvailableHeaders(link.validation.suggestion);
			const citationMatch = citation.match(/\[([^\]]+)\]\(([^)]+)#([^)]+)\)/);

			if (citationMatch && availableHeaders.length > 0) {
				const [, linkText, filePath, brokenAnchor] = citationMatch;
				const bestMatch = this.findBestHeaderMatch(
					`#${brokenAnchor}`,
					availableHeaders,
				);

				if (bestMatch) {
					const encodedAnchor = this.urlEncodeAnchor(bestMatch.text);
					return `[${linkText}](${filePath}#${encodedAnchor})`;
				}
			}
		}

		return citation;
	}
}

const program = new Command();

program
	.name("citation-manager")
	.description("Citation validation and management tool for markdown files")
	.version("1.0.0");

program
	.command("validate")
	.description("Validate citations in a markdown file")
	.argument("<file>", "path to markdown file to validate")
	.option("--format <type>", "output format (cli, json)", "cli")
	.option(
		"--lines <range>",
		'validate specific line range (e.g., "150-160" or "157")',
	)
	.option(
		"--scope <folder>",
		"limit file resolution to specific folder (enables smart filename matching)",
	)
	.option(
		"--fix",
		"automatically fix citation anchors including kebab-case conversions and missing anchor corrections",
	)
	.action(async (file, options) => {
		const manager = new CitationManager();
		let result;

		if (options.fix) {
			result = await manager.fix(file, options);
			console.log(result);
		} else {
			result = await manager.validate(file, options);
			console.log(result);
		}

		// Set exit code based on validation result (only for validation, not fix)
		if (!options.fix) {
			if (options.format === "json") {
				const parsed = JSON.parse(result);
				if (parsed.error) {
					process.exit(2); // File not found or other errors
				} else {
					process.exit(parsed.summary?.errors > 0 ? 1 : 0);
				}
			} else {
				if (result.includes("ERROR:")) {
					process.exit(2); // File not found or other errors
				} else {
					process.exit(result.includes("VALIDATION FAILED") ? 1 : 0);
				}
			}
		}
	});

program
	.command("ast")
	.description("Show AST and extracted data from markdown file")
	.argument("<file>", "path to markdown file to analyze")
	.action(async (file) => {
		const manager = new CitationManager();
		const ast = await manager.parser.parseFile(file);
		console.log(JSON.stringify(ast, null, 2));
	});

program
	.command("base-paths")
	.description("Extract distinct base paths from citations in a markdown file")
	.argument("<file>", "path to markdown file to analyze")
	.option("--format <type>", "output format (cli, json)", "cli")
	.action(async (file, options) => {
		try {
			const manager = new CitationManager();
			const basePaths = await manager.extractBasePaths(file);

			if (options.format === "json") {
				console.log(
					JSON.stringify({ file, basePaths, count: basePaths.length }, null, 2),
				);
			} else {
				console.log("Distinct Base Paths Found:");
				console.log("========================");
				console.log("");
				basePaths.forEach((path, index) => {
					console.log(`${index + 1}. ${path}`);
				});
				console.log("");
				console.log(
					`Total: ${basePaths.length} distinct base path${basePaths.length === 1 ? "" : "s"}`,
				);
			}
		} catch (error) {
			console.error(`ERROR: ${error.message}`);
			process.exit(1);
		}
	});

// Pattern: Extract command with links subcommand
const extractCmd = program
	.command("extract")
	.description("Extract content from citations");

extractCmd
	.command("links <source-file>")
	.description("Extract content from all links in source document\n\n" +
		"Workflow:\n" +
		"  Phase 1: Validate and discover all links in source file\n" +
		"  Phase 2: Extract content from eligible links\n" +
		"  Phase 3: Output deduplicated JSON structure\n\n" +
		"Examples:\n" +
		"  $ citation-manager extract links docs/design.md\n" +
		"  $ citation-manager extract links docs/design.md --full-files\n" +
		"  $ citation-manager extract links docs/design.md --scope ./docs\n\n" +
		"Exit Codes:\n" +
		"  0  At least one link extracted successfully\n" +
		"  1  No eligible links or all extractions failed\n" +
		"  2  System error (file not found, permission denied)")
	.option("--scope <folder>", "Limit file resolution to folder")
	.option("--format <type>", "Output format (reserved for future)", "json")
	.option("--full-files", "Enable full-file link extraction (default: sections only)")
	.action(async (sourceFile, options) => {
		// Pattern: Delegate to CitationManager orchestrator
		const manager = new CitationManager();

		try {
			await manager.extractLinks(sourceFile, options);
		} catch (error) {
			console.error("ERROR:", error.message);
			process.exitCode = 2;
		}
	});

extractCmd
	.command("header")
	.description("Extract specific header content from target file")
	.argument("<target-file>", "Markdown file to extract from")
	.argument("<header-name>", "Exact header text to extract")
	.option("--scope <folder>", "Limit file resolution scope")
	.addHelpText("after", `
Examples:
  # Extract specific section from design document
  $ citation-manager extract header plan.md "Task 1: Implementation"

  # Extract with scope limiting
  $ citation-manager extract header docs/guide.md "Overview" --scope ./docs

Exit Codes:
  0  Header extracted successfully
  1  Header not found or validation failed
  2  System error (file not found, permission denied)

Notes:
  - Header name must match exactly (case-sensitive)
  - Extracts complete section until next same-level heading
  - Output is JSON OutgoingLinksExtractedContent structure
  `)
	.action(async (targetFile, headerName, options) => {
		// Integration: Create CitationManager instance
		const manager = new CitationManager();

		try {
			// Pattern: Delegate to CitationManager orchestration method
			const result = await manager.extractHeader(targetFile, headerName, options);

			// Decision: Output JSON to stdout if extraction succeeded
			if (result) {
				// Boundary: JSON output to stdout
				console.log(JSON.stringify(result, null, 2));
				process.exitCode = 0;
			}
			// Note: Error exit codes set by extractHeader() method

		} catch (error) {
			// Decision: Unexpected errors use exit code 2
			console.error("ERROR:", error.message);
			process.exitCode = 2;
		}
	});

extractCmd
	.command("file")
	.description("Extract entire file content")
	.argument("<target-file>", "Markdown file to extract")
	.option("--scope <folder>", "Limit file resolution to specified directory")
	.option("--format <type>", "Output format (json)", "json")
	.addHelpText("after", `
Examples:
  # Extract entire file
  $ citation-manager extract file docs/architecture.md

  # Extract with scope restriction
  $ citation-manager extract file architecture.md --scope ./docs

  # Pipe to jq for filtering
  $ citation-manager extract file file.md | jq '.extractedContentBlocks'

Exit Codes:
  0  File extracted successfully
  1  File not found or validation failed
  2  System error (permission denied, parse error)

Notes:
  - Extracts complete file content without requiring source document
  - Output is JSON OutgoingLinksExtractedContent structure
  - Use --scope for smart filename resolution in large projects
  `)
	.action(async (targetFile, options) => {
		// Integration: Create CitationManager instance
		const manager = new CitationManager();

		try {
			// Pattern: Delegate to CitationManager orchestration method
			const result = await manager.extractFile(targetFile, options);

			// Decision: Output JSON to stdout if extraction succeeded
			if (result) {
				// Boundary: JSON output to stdout
				console.log(JSON.stringify(result, null, 2));
				process.exitCode = 0;
			}
			// Note: Error exit codes set by extractFile() method

		} catch (error) {
			// Decision: Unexpected errors use exit code 2
			console.error("ERROR:", error.message);
			process.exitCode = 2;
		}
	});

// Only run CLI if this file is executed directly (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
	program.parse();
}
