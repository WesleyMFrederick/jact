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
import type { EnrichedLinkObject } from "./types/validationTypes.js";
import type { OutgoingLinksExtractedContent } from "./types/contentExtractorTypes.js";
import {
	createCitationValidator,
	createContentExtractor,
	createFileCache,
	createMarkdownParser,
	createParsedFileCache,
} from "./factories/componentFactory.js";
import { LinkObjectFactory } from "./factories/LinkObjectFactory.js";
import type { MarkdownParser } from "./core/MarkdownParser/index.js";
import type { ParserOutput } from "./types/citationTypes.js";
import type { ParsedFileCache } from "./ParsedFileCache.js";
import type { FileCache } from "./FileCache.js";
import type { CitationValidator } from "./CitationValidator.js";
import type { ContentExtractor } from "./core/ContentExtractor/ContentExtractor.js";

/**
 * Options for validation operations.
 */
interface CliValidateOptions {
	scope?: string;
	lines?: string;
	format?: string;
	fix?: boolean;
}

/**
 * Options for extraction and file operations.
 */
interface CliExtractOptions {
	scope?: string;
	format?: string;
	fullFiles?: boolean;
}

/**
 * Line range parsed from input string.
 */
interface LineRange {
	startLine: number;
	endLine: number;
}

/**
 * Header object with text and anchor.
 */
interface HeaderObject {
	text: string;
	anchor: string;
}

/**
 * Fix record tracking applied fixes.
 */
interface FixRecord {
	line: number;
	old: string;
	new: string;
	type: string;
}

/**
 * Path conversion object from validator.
 */
interface PathConversion {
	original: string;
	recommended: string;
}


/**
 * Main application class for citation management operations
 *
 * Wires together all components and provides high-level operations for validation,
 * fixing, AST inspection, and path extraction. Handles CLI output formatting and
 * error reporting.
 */
export class CitationManager {
	private parser: MarkdownParser;
	private parsedFileCache: ParsedFileCache;
	private fileCache: FileCache;
	private validator: CitationValidator;
	private contentExtractor: ContentExtractor;

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
			this.parsedFileCache, // Share cache with validator
		);
	}

	/**
	 * Parse a markdown file and return its full AST with extracted metadata.
	 * Used by the `ast` CLI command to expose parser internals for debugging.
	 */
	async getAst(filePath: string): Promise<ParserOutput> {
		return this.parser.parseFile(filePath);
	}

	/**
	 * Validate citations in markdown file and generate a formatted report
	 *
	 * Validates all wiki-style citations in the specified markdown file, checking for
	 * broken links, missing files, invalid anchors, and path conversion opportunities.
	 * Optionally builds a file cache when scope is provided for more accurate validation.
	 * Supports line range filtering and multiple output formats (CLI or JSON).
	 *
	 * @param filePath - Path to markdown file (absolute or relative to current directory)
	 * @param options - Validation configuration options
	 * @param options.format - Output format: "cli" (default) for human-readable or "json" for structured data
	 * @param options.lines - Line range filter in format "start-end" (e.g., "10-50") to validate specific sections
	 * @param options.scope - Base directory to scan for building file cache (enables relative path resolution)
	 * @param options.fix - Not used by validate (reserved for fix command)
	 * @returns Formatted validation report - CLI format with colors/symbols or JSON with structured data
	 *
	 * @example
	 * ```typescript
	 * // Basic validation with CLI output
	 * const report = await manager.validate("docs/readme.md");
	 *
	 * // JSON output for programmatic use
	 * const jsonReport = await manager.validate("docs/readme.md", { format: "json" });
	 *
	 * // Validate specific line range with file cache
	 * const filtered = await manager.validate("docs/readme.md", {
	 *   lines: "50-100",
	 *   scope: "/path/to/docs"
	 * });
	 * ```
	 */
	async validate(filePath: string, options: CliValidateOptions = {}): Promise<string> {
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
			const errorMessage = error instanceof Error ? error.message : String(error);
			if (options.format === "json") {
				return JSON.stringify(
					{
						error: errorMessage,
						file: filePath,
						success: false,
					},
					null,
					2,
				);
			}
			return `ERROR: ${errorMessage}`;
		}
	}

	/**
	 * Filter validation results by line range
	 *
	 * Filters citation results to only include those within specified line range.
	 * Recalculates summary statistics for filtered results.
	 *
	 * @param result - Full validation result object
	 * @param lineRange - Line range string
	 * @returns Filtered result with updated summary and lineRange property
	 */
	private filterResultsByLineRange(result: any, lineRange: string): any {
		const { startLine, endLine } = this.parseLineRange(lineRange);

		const filteredLinks = result.links.filter((link: any) => {
			return link.line >= startLine && link.line <= endLine;
		});

		const filteredSummary = {
			total: filteredLinks.length,
			valid: filteredLinks.filter((link: any) => link.validation.status === "valid")
				.length,
			errors: filteredLinks.filter((link: any) => link.validation.status === "error")
				.length,
			warnings: filteredLinks.filter(
				(link: any) => link.validation.status === "warning",
			).length,
		};

		return {
			...result,
			links: filteredLinks,
			summary: filteredSummary,
			lineRange: `${startLine}-${endLine}`,
		};
	}

	/**
	 * Parse line range string
	 * @param lineRange - Line range string to parse
	 * @returns Parsed line range
	 */
	private parseLineRange(lineRange: string): LineRange {
		if (lineRange.includes("-")) {
			const [start, end] = lineRange
				.split("-")
				.map((n) => Number.parseInt(n.trim(), 10));
			return { startLine: start || 0, endLine: end || 0 };
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
	 * @param result - Validation result object
	 * @returns Formatted CLI output
	 */
	private formatForCLI(result: any): string {
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
				.filter((link: any) => link.validation.status === "error")
				.forEach((link: any, index: number) => {
					const isLast =
						index ===
						result.links.filter((link: any) => link.validation.status === "error")
							.length -
							1;
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
				.filter((link: any) => link.validation.status === "warning")
				.forEach((link: any, index: number) => {
					const isLast =
						index ===
						result.links.filter((link: any) => link.validation.status === "warning")
							.length -
							1;
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
				.filter((link: any) => link.validation.status === "valid")
				.forEach((link: any, index: number) => {
					const isLast =
						index ===
						result.links.filter((link: any) => link.validation.status === "valid")
							.length -
							1;
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

	/**
	 * Format validation results as JSON
	 * @param result - Result object to format
	 * @returns JSON string representation
	 */
	private formatAsJSON(result: any): string {
		return JSON.stringify(result, null, 2);
	}

	/**
	 * Extract content from all citations found in a markdown file
	 *
	 * Discovers all wiki-style citations in the source file, validates each link,
	 * and extracts the referenced content. Outputs a structured JSON result to stdout
	 * containing the extracted content with metadata. Reports validation errors to stderr.
	 *
	 * Pattern: Three-phase orchestration workflow
	 * Integration: Coordinates validator → extractor → output
	 *
	 * @param sourceFile - Path to markdown file containing wiki-style citations (e.g., [[file#header]])
	 * @param options - Extraction configuration options
	 * @param options.scope - Base directory to scan for building file cache (enables relative path resolution)
	 * @param options.format - Output format (currently only "json" is supported)
	 * @param options.fullFiles - If true, extract entire file content instead of just header sections
	 * @returns Promise that resolves when extraction completes (outputs to stdout, sets process.exitCode)
	 *
	 * @example
	 * ```typescript
	 * // Extract header sections from all citations
	 * await manager.extractLinks("source.md", { scope: "/docs" });
	 *
	 * // Extract full file content for each citation
	 * await manager.extractLinks("source.md", {
	 *   scope: "/docs",
	 *   fullFiles: true
	 * });
	 * ```
	 */
	async extractLinks(sourceFile: string, options: CliExtractOptions): Promise<void> {
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
				console.error("Validation errors found:");
				const errors = enrichedLinks.filter(
					(l: EnrichedLinkObject) => l.validation.status === "error",
				);
				for (const link of errors) {
					if (link.validation.status === "error") {
						console.error(`  Line ${link.line}: ${link.validation.error}`);
					}
				}
			}

			// Phase 2: Content Extraction
			// Pattern: Pass pre-validated enriched links to extractor
			const extractionResult = await this.contentExtractor.extractContent(
				enrichedLinks,
				{ fullFiles: options.fullFiles ?? false }, // Pass CLI flags to strategies
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
			const errorMessage = error instanceof Error ? error.message : String(error);
			console.error("ERROR:", errorMessage);
			process.exitCode = 2;
		}
	}

	/**
	 * Extract a specific header section from a markdown file
	 *
	 * Creates a synthetic citation targeting the specified header, validates it exists,
	 * and extracts the header section content including any nested citations. Returns
	 * structured JSON output to stdout. Useful for extracting specific sections on-demand
	 * without needing to add citations to a source file.
	 *
	 * Pattern: Four-phase orchestration workflow
	 * 1. Create synthetic LinkObject via factory
	 * 2. Validate synthetic link via validator
	 * 3. Extract content via extractor (if valid)
	 * 4. Return OutgoingLinksExtractedContent structure
	 *
	 * Integration: Coordinates LinkObjectFactory → CitationValidator → ContentExtractor.
	 *
	 * @param targetFile - Path to markdown file containing the header to extract
	 * @param headerName - Exact header text to extract (e.g., "Installation" for ## Installation)
	 * @param options - Extraction configuration options
	 * @param options.scope - Base directory to scan for building file cache (enables relative path resolution)
	 * @param options.format - Output format (currently only "json" is supported)
	 * @param options.fullFiles - Not used by extractHeader (applies to nested citations only)
	 * @returns Promise resolving to OutgoingLinksExtractedContent structure, or undefined on error
	 *
	 * @example
	 * ```typescript
	 * // Extract specific section
	 * const content = await manager.extractHeader(
	 *   "docs/api.md",
	 *   "Authentication",
	 *   { scope: "/docs" }
	 * );
	 *
	 * // Output contains extracted header content with metadata
	 * console.log(JSON.stringify(content, null, 2));
	 * ```
	 */
	async extractHeader(targetFile: string, headerName: string, options: CliExtractOptions): Promise<OutgoingLinksExtractedContent | undefined> {
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
			// Integration: CitationValidator enriches link in-place with validation metadata
			const enrichedLink = await this.validator.validateSingleCitation(
				syntheticLink,
				targetFile,
			);

			// Decision: Check validation status before extraction (error handling)
			if (enrichedLink.validation.status === "error") {
				// Boundary: Error output to stderr
				// Type narrowing allows accessing error property
				const errorMsg = enrichedLink.validation.error;
				console.error("Validation failed:", errorMsg);
				if (enrichedLink.validation.suggestion) {
					console.error("Suggestion:", enrichedLink.validation.suggestion);
				}
				process.exitCode = 1;
				return;
			}

			// --- Phase 3: Extraction ---
			// Pattern: Extract content from validated link
			// Integration: ContentExtractor processes single-link array
			const result = await this.contentExtractor.extractContent(
				[enrichedLink],
				options,
			);

			// --- Phase 4: Return ---
			// Decision: Return result for CLI to output (CLI handles stdout)
			return result;
		} catch (error) {
			// Decision: System errors use exit code 2
			const errorMessage = error instanceof Error ? error.message : String(error);
			console.error("ERROR:", errorMessage);
			process.exitCode = 2;
			return undefined;
		}
	}

	/**
	 * Extract entire content from a markdown file
	 *
	 * Creates a synthetic citation targeting the entire file, validates the file exists,
	 * and extracts all content including any nested citations. Returns structured JSON
	 * output to stdout. Useful for programmatically retrieving complete file content
	 * with citation metadata without manual file operations.
	 *
	 * Pattern: Four-phase orchestration workflow
	 * 1. Create synthetic LinkObject via factory (anchorType: null)
	 * 2. Validate synthetic link via validator
	 * 3. Extract content via extractor with fullFiles flag
	 * 4. Return OutgoingLinksExtractedContent structure
	 *
	 * Integration: Coordinates LinkObjectFactory → CitationValidator → ContentExtractor.
	 *
	 * @param targetFile - Path to markdown file to extract in full
	 * @param options - Extraction configuration options
	 * @param options.scope - Base directory to scan for building file cache (enables relative path resolution)
	 * @param options.format - Output format (currently only "json" is supported)
	 * @param options.fullFiles - Not used by extractFile (entire file is always extracted)
	 * @returns Promise resolving to OutgoingLinksExtractedContent structure, or undefined on error
	 *
	 * @example
	 * ```typescript
	 * // Extract complete file content
	 * const content = await manager.extractFile(
	 *   "docs/guide.md",
	 *   { scope: "/docs" }
	 * );
	 *
	 * // Output contains full file content with all nested citations
	 * console.log(JSON.stringify(content, null, 2));
	 * ```
	 */
	async extractFile(targetFile: string, options: CliExtractOptions): Promise<OutgoingLinksExtractedContent | undefined> {
		try {
			// Decision: Build file cache if --scope provided
			if (options.scope) {
				await this.fileCache.buildCache(options.scope);
			}

			// --- Phase 1: Synthetic Link Creation ---
			// Pattern: Use factory to create unvalidated LinkObject for full file
			// Fix(#63): Resolve targetFile to absolute BEFORE creating synthetic link
			// so target.path.raw is absolute. path.resolve() with an absolute second
			// arg ignores the first, preventing duplicate segments in resolveTargetPath()
			const { resolve } = await import("node:path");
			const absoluteTargetFile = resolve(targetFile);
			const factory = new LinkObjectFactory();
			const syntheticLink = factory.createFileLink(absoluteTargetFile);

			// --- Phase 2: Validation ---
			// Pattern: Validate synthetic link before extraction (fail-fast on errors)
			// Integration: CitationValidator enriches link in-place with validation metadata
			const enrichedLink = await this.validator.validateSingleCitation(
				syntheticLink,
				absoluteTargetFile,
			);

			// Decision: Apply path conversion if validator found file via cache
			// Pattern: Validator suggests recommended path when file found in different location
			if (
				enrichedLink.validation.status !== "valid" &&
				"pathConversion" in enrichedLink.validation &&
				enrichedLink.validation.pathConversion?.recommended
			) {
				// Update target path to use cache-resolved absolute path
				const { resolve } = await import("node:path");
				const absolutePath = resolve(
					enrichedLink.validation.pathConversion.recommended,
				);
				syntheticLink.target.path.absolute = absolutePath;
			}

			// Decision: Check validation status before extraction (error handling)
			if (enrichedLink.validation.status === "error") {
				// Boundary: Error output to stderr
				// Type narrowing allows accessing error property
				const errorMsg = enrichedLink.validation.error;
				console.error("Validation failed:", errorMsg);
				if (enrichedLink.validation.suggestion) {
					console.error("Suggestion:", enrichedLink.validation.suggestion);
				}
				process.exitCode = 1;
				return;
			}

			// --- Phase 3: Extraction ---
			// Decision: Force fullFiles flag for full-file extraction
			// Pattern: ContentExtractor uses CliFlagStrategy to make link eligible
			const result = await this.contentExtractor.extractContent(
				[enrichedLink],
				{ ...options, fullFiles: true },
			);

			// --- Phase 4: Return ---
			// Decision: Return result for CLI to output (CLI handles stdout)
			return result;
		} catch (error) {
			// Decision: System errors use exit code 2
			const errorMessage = error instanceof Error ? error.message : String(error);
			console.error("ERROR:", errorMessage);
			process.exitCode = 2;
			return undefined;
		}
	}

	/**
	 * Auto-fix fixable citation issues in a markdown file
	 *
	 * Validates citations and automatically applies fixes for correctable issues including
	 * path conversions (relative to absolute paths) and anchor format corrections (GitHub
	 * to Obsidian format). Modifies the file in-place and returns a detailed report of
	 * changes made. Only fixes issues where automated correction is safe and unambiguous.
	 *
	 * Applies automatic fixes for:
	 * - Path corrections (cross-directory warnings with pathConversion suggestions)
	 * - Anchor corrections (kebab-case to raw header format, missing anchor fixes)
	 *
	 * Modifies file in-place. Builds file cache if scope provided.
	 *
	 * @param filePath - Path to markdown file to fix (will be modified in-place)
	 * @param options - Fix configuration options
	 * @param options.scope - Base directory to scan for building file cache (enables path conversion fixes)
	 * @param options.format - Not used by fix (always returns CLI format)
	 * @param options.lines - Not used by fix (always processes entire file)
	 * @param options.fix - Not used by fix (reserved for future fix modes)
	 * @returns Promise resolving to fix report describing changes made and statistics
	 *
	 * @example
	 * ```typescript
	 * // Auto-fix with file cache for path conversions
	 * const report = await manager.fix("docs/readme.md", {
	 *   scope: "/path/to/docs"
	 * });
	 * console.log(report); // "Applied 3 fixes to docs/readme.md..."
	 *
	 * // Fix without cache (only anchor format fixes)
	 * const report = await manager.fix("docs/readme.md");
	 * ```
	 */
	async fix(filePath: string, options: CliValidateOptions = {}): Promise<string> {
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
				(link: any) =>
					(link.validation.status === "warning" &&
						link.validation.pathConversion) ||
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
			const fixes: FixRecord[] = [];

			// Process all fixable links
			for (const link of fixableLinks) {
				let newCitation = link.fullMatch;
				let fixType = "";

				// Apply path conversion if available
				if (link.validation.status !== "valid" && link.validation.pathConversion) {
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
			return `WARNING: Found ${fixableLinks.length} fixable citations but could not apply fixes`;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			return `ERROR: ${errorMessage}`;
		}
	}

	/**
	 * Apply path conversion to citation
	 * @param citation - Citation text to modify
	 * @param pathConversion - Path conversion object
	 * @returns Citation with converted path
	 */
	private applyPathConversion(citation: string, pathConversion: PathConversion): string {
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
	 * @param suggestion - Suggestion message from validator
	 * @returns Array of header objects with text and anchor
	 */
	private parseAvailableHeaders(suggestion: string): HeaderObject[] {
		const headerRegex = /"([^"]+)"\s*→\s*#([^,]+)/g;
		return [...suggestion.matchAll(headerRegex)].map((match) => ({
			text: (match[1] || "").trim(),
			anchor: `#${(match[2] || "").trim()}`,
		}));
	}

	/**
	 * Normalize anchor for fuzzy matching (removes # and hyphens)
	 * @param anchor - Anchor text to normalize
	 * @returns Normalized anchor
	 */
	private normalizeAnchorForMatching(anchor: string): string {
		return anchor.replace("#", "").replace(/-/g, " ").toLowerCase();
	}

	/**
	 * Find best header match using fuzzy logic
	 *
	 * Matches normalized broken anchor against available headers using exact
	 * or punctuation-stripped comparison.
	 *
	 * @param brokenAnchor - Anchor that wasn't found
	 * @param availableHeaders - Available headers
	 * @returns Best matching header or undefined
	 */
	private findBestHeaderMatch(brokenAnchor: string, availableHeaders: HeaderObject[]): HeaderObject | undefined {
		const searchText = this.normalizeAnchorForMatching(brokenAnchor);
		return availableHeaders.find(
			(header) =>
				header.text.toLowerCase() === searchText ||
				header.text.toLowerCase().replace(/[.\s]/g, "") ===
					searchText.replace(/\s/g, ""),
		);
	}

	/**
	 * URL-encode anchor text (spaces to %20, periods to %2E)
	 * @param headerText - Header text to encode
	 * @returns URL-encoded anchor
	 */
	private urlEncodeAnchor(headerText: string): string {
		return headerText.replace(/ /g, "%20").replace(/\./g, "%2E");
	}

	/**
	 * Apply anchor fix to citation
	 *
	 * Handles two fix types:
	 * - Obsidian compatibility: kebab-case to raw header format
	 * - Missing anchors: fuzzy match to available headers
	 *
	 * @param citation - Original citation text
	 * @param link - Link object with validation metadata
	 * @returns Citation with corrected anchor or original
	 */
	private applyAnchorFix(citation: string, link: any): string {
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
			const availableHeaders = this.parseAvailableHeaders(
				link.validation.suggestion,
			);
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

/**
 * Semantic suggestion map for common user mistakes
 *
 * Maps common synonyms and typos to correct commands/options.
 * Used by custom error handler to provide helpful suggestions.
 */
const semanticSuggestionMap: Record<string, string[]> = {
	// Command synonyms
	check: ["validate"],
	verify: ["validate"],
	lint: ["validate"],
	parse: ["ast"],
	tree: ["ast"],
	debug: ["ast"],
	show: ["ast"],

	// Option synonyms
	fix: ["--fix"],
	repair: ["--fix"],
	correct: ["--fix"],
	output: ["--format"],
	json: ["--format json"],
	range: ["--lines"],
	folder: ["--scope"],
	directory: ["--scope"],
	path: ["--scope"],
	dir: ["--scope"],
};

const program: Command = new Command();

program
	.name("citation-manager")
	.description("Citation validation and management tool for markdown files")
	.version("1.0.0");

// Configure custom error output with semantic suggestions
program.configureOutput({
	outputError: (str: string, write: (str: string) => void) => {
		const match = str.match(/unknown (?:command|option) '([^']+)'/);
		if (match && match[1]) {
			const input = match[1].replace(/^--?/, "");
			const suggestions = semanticSuggestionMap[input];

			if (suggestions) {
				write(
					`Unknown ${match[0].includes("command") ? "command" : "option"} '${match[1]}'\n`,
				);
				write(`Did you mean: ${suggestions.join(", ")}?\n`);
				return;
			}
		}
		write(str);
	},
});

program
	.command("validate")
	.description(
		"Validate citations in a markdown file, checking that target files exist and anchors resolve correctly",
	)
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
	.addHelpText(
		"after",
		`
Examples:
    $ citation-manager validate docs/design.md
    $ citation-manager validate file.md --format json
    $ citation-manager validate file.md --lines 100-200
    $ citation-manager validate file.md --fix --scope ./docs

Exit Codes:
  0  All citations valid
  1  Validation errors found
  2  System error (file not found, permission denied)
`,
	)
	.action(async (file: string, options: CliValidateOptions) => {
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
	.description("Display markdown AST and citation metadata for debugging")
	.argument("<file>", "path to markdown file to analyze")
	.addHelpText(
		"after",
		`
Examples:
    $ citation-manager ast docs/design.md
    $ citation-manager ast file.md | jq '.links'
    $ citation-manager ast file.md | jq '.anchors | length'

Output includes:
  - tokens: Markdown AST from marked.js parser
  - links: Detected citation links with anchor metadata
  - headings: Parsed heading structure
  - anchors: Available anchor points (headers and blocks)
`,
	)
	.action(async (file: string) => {
		const manager = new CitationManager();
		const ast = await manager.getAst(file);
		console.log(JSON.stringify(ast, null, 2));
	});


// Pattern: Extract command with links subcommand
const extractCmd = program
	.command("extract")
	.description("Extract content from citations");

extractCmd
	.command("links <source-file>")
	.description(
		"Extract content from all links in source document with validation and deduplication",
	)
	.option("--scope <folder>", "Limit file resolution to folder")
	.option("--format <type>", "Output format (reserved for future)", "json")
	.option(
		"--full-files",
		"Enable full-file link extraction (default: sections only)",
	)
	.addHelpText(
		"after",
		`
Examples:
    $ citation-manager extract links docs/design.md
    $ citation-manager extract links docs/design.md --full-files
    $ citation-manager extract links docs/design.md --scope ./docs
    $ citation-manager extract links file.md | jq '.stats.compressionRatio'

Exit Codes:
  0  At least one link extracted successfully
  1  No eligible links or all extractions failed
  2  System error (file not found, permission denied)
`,
	)
	.action(async (sourceFile: string, options: CliExtractOptions) => {
		// Pattern: Delegate to CitationManager orchestrator
		const manager = new CitationManager();

		try {
			await manager.extractLinks(sourceFile, options);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			console.error("ERROR:", errorMessage);
			process.exitCode = 2;
		}
	});

extractCmd
	.command("header")
	.description("Extract specific header section content from a target file")
	.argument("<target-file>", "Markdown file to extract from")
	.argument("<header-name>", "Exact header text to extract")
	.option("--scope <folder>", "Limit file resolution scope")
	.option("--format <type>", "Output format (json)", "json")
	.addHelpText(
		"after",
		`
Examples:
    $ citation-manager extract header plan.md "Task 1: Implementation"
    $ citation-manager extract header docs/guide.md "Overview" --scope ./docs
    $ citation-manager extract header file.md "Design" | jq '.extractedContentBlocks'

Exit Codes:
  0  Header extracted successfully
  1  Header not found or validation failed
  2  System error (file not found, permission denied)
`,
	)
	.action(async (targetFile: string, headerName: string, options: CliExtractOptions) => {
		// Integration: Create CitationManager instance
		const manager = new CitationManager();

		try {
			// Pattern: Delegate to CitationManager orchestration method
			const result = await manager.extractHeader(
				targetFile,
				headerName,
				options,
			);

			// Decision: Output JSON to stdout if extraction succeeded
			if (result) {
				// Boundary: JSON output to stdout
				console.log(JSON.stringify(result, null, 2));
				process.exitCode = 0;
			}
			// Note: Error exit codes set by extractHeader() method
		} catch (error) {
			// Decision: Unexpected errors use exit code 2
			const errorMessage = error instanceof Error ? error.message : String(error);
			console.error("ERROR:", errorMessage);
			process.exitCode = 2;
		}
	});

extractCmd
	.command("file")
	.description("Extract entire markdown file content")
	.argument("<target-file>", "Markdown file to extract")
	.option("--scope <folder>", "Limit file resolution to specified directory")
	.option("--format <type>", "Output format (json)", "json")
	.addHelpText(
		"after",
		`
Examples:
    $ citation-manager extract file docs/architecture.md
    $ citation-manager extract file architecture.md --scope ./docs
    $ citation-manager extract file file.md | jq '.extractedContentBlocks'
    $ citation-manager extract file file.md | jq '.stats'

Exit Codes:
  0  File extracted successfully
  1  File not found or validation failed
  2  System error (permission denied, parse error)
`,
	)
	.action(async (targetFile: string, options: CliExtractOptions) => {
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
			const errorMessage = error instanceof Error ? error.message : String(error);
			console.error("ERROR:", errorMessage);
			process.exitCode = 2;
		}
	});

// Only run CLI if this file is executed directly (not imported)
// Uses realpathSync to resolve symlinks (e.g., from npm link or node_modules/.bin)
import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";

const realPath = realpathSync(process.argv[1] || "");
const realPathAsUrl = pathToFileURL(realPath).href;

if (import.meta.url === realPathAsUrl) {
	program.parse();
}
