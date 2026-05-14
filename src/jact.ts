/**
 * JactCli — orchestration and scope management for citation operations.
 *
 * This module exports the JactCli class only. Commander CLI wiring lives in
 * cli.ts so JactCli can be imported programmatically without activating Commander.
 *
 * @module jact
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { CitationValidator } from "./core/CitationValidator/CitationValidator.js";
import type { ContentExtractor } from "./core/ContentExtractor/ContentExtractor.js";
import { applyAnchorFix, applyPathConversion } from "./core/citationFixer.js";
import {
	detectNestedCodeblocks,
	type NestedCodeblockWarning,
} from "./core/MarkdownParser/detectNestedCodeblocks.js";
import type { MarkdownParser } from "./core/MarkdownParser/index.js";
import { resolveScope } from "./core/resolveScope.js";
import type { FileCache } from "./FileCache.js";
import {
	createCitationValidator,
	createContentExtractor,
	createFileCache,
	createMarkdownParser,
	createParsedFileCache,
} from "./factories/componentFactory.js";
import { LinkObjectFactory } from "./factories/LinkObjectFactory.js";
import { formatExtractResult } from "./formatExtractResult.js";
import { formatAsJSON, formatForCLI } from "./formatValidationResult.js";
import type { ParsedFileCache } from "./ParsedFileCache.js";
import type { ParserOutput } from "./types/citationTypes.js";
import type {
	CliExtractOptions,
	CliValidateOptions,
	OutgoingLinksExtractedContent,
} from "./types/contentExtractorTypes.js";
import type {
	EnrichedLinkObject,
	FixRecord,
	ValidationResult,
} from "./types/validationTypes.js";

interface LineRange {
	startLine: number;
	endLine: number;
}

/**
 * Main application class: orchestration + scope management for citation operations.
 * Importable programmatically without activating Commander (wiring is in cli.ts).
 */
export class JactCli {
	private parser: MarkdownParser;
	private parsedFileCache: ParsedFileCache;
	private fileCache: FileCache;
	private validator: CitationValidator;
	private contentExtractor: ContentExtractor;

	constructor() {
		this.parser = createMarkdownParser();
		this.parsedFileCache = createParsedFileCache(this.parser);
		this.fileCache = createFileCache();
		this.validator = createCitationValidator(
			this.parsedFileCache,
			this.fileCache,
		);
		this.contentExtractor = createContentExtractor(this.parsedFileCache);
	}

	/** Resolve scope and build the file cache. Throws if scope cannot be inferred. */
	private applyScope(
		options: { scope?: string; allowGitignore?: boolean },
		targetFile?: string,
	): void {
		const resolved = resolveScope({
			...(options.scope !== undefined && { explicit: options.scope }),
			cwd: process.cwd(),
			...(targetFile !== undefined && { targetFile }),
		});
		if (resolved.source === "none") {
			const triedParts = resolved.triedFallbacks ?? [];
			throw new Error(
				`cannot resolve scope. Tried: ${triedParts.join(", ")}. Pass --scope <dir>.`,
			);
		}
		// Default: respect .gitignore. --allow-gitignore opts in to scanning excluded files.
		this.fileCache.buildCache(resolved.scope, false, resolved, {
			respectGitignore: !options.allowGitignore,
		});
	}

	/**
	 * Parse a markdown file and return its full AST with extracted metadata.
	 * Resolves scope via smart defaults (cwd-git → cwd-pkg → target-git → target-pkg → none).
	 * Bare filenames are resolved via FileCache. Throws with a `.suggestion` property on failure.
	 */
	async getAst(
		filePath: string,
		options: { scope?: string } = {},
	): Promise<ParserOutput> {
		this.applyScope(options, filePath);
		const absolute = path.resolve(filePath);
		if (existsSync(absolute)) {
			return this.parser.parseFile(absolute);
		}
		const cacheResult = this.fileCache.resolveFile(path.basename(filePath));
		if (cacheResult.found) {
			return this.parser.parseFile(cacheResult.path);
		}
		const err = new Error(`File not found: ${absolute}`);
		(err as Error & { suggestion?: string }).suggestion = cacheResult.message;
		throw err;
	}

	/** Validate citations in a markdown file and return a formatted report. */
	async validate(
		filePath: string,
		options: CliValidateOptions = {},
	): Promise<string> {
		try {
			const startTime = Date.now();
			if (options.scope) {
				const cacheStats = this.fileCache.buildCache(
					options.scope,
					options.verbose ?? false,
					undefined,
					{ respectGitignore: !options.allowGitignore },
				);
				if (options.verbose && options.format !== "json") {
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
			result.validationTime = `${((Date.now() - startTime) / 1000).toFixed(1)}s`;
			const fileContent = readFileSync(filePath, "utf8");
			const nestedCodeblockWarnings = detectNestedCodeblocks(fileContent);
			if (options.lines) {
				const filteredResult = this.filterResultsByLineRange(
					result,
					options.lines,
				);
				if (options.format === "json") return this.formatAsJSON(filteredResult);
				return this.formatForCLI(
					filteredResult,
					nestedCodeblockWarnings,
					options.verbose ?? false,
				);
			}
			if (options.format === "json") return this.formatAsJSON(result);
			return this.formatForCLI(
				result,
				nestedCodeblockWarnings,
				options.verbose ?? false,
			);
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			if (options.format === "json") {
				return JSON.stringify(
					{ error: errorMessage, file: filePath, success: false },
					null,
					2,
				);
			}
			return `ERROR: ${errorMessage}`;
		}
	}

	/** Filter links to those within lineRange and recompute summary stats. */
	private filterResultsByLineRange(
		result: ValidationResult,
		lineRange: string,
	): ValidationResult & { lineRange: string } {
		const { startLine, endLine } = this.parseLineRange(lineRange);
		const filteredLinks = result.links.filter(
			(link: EnrichedLinkObject) =>
				link.line >= startLine && link.line <= endLine,
		);
		const filteredSummary = {
			total: filteredLinks.length,
			valid: filteredLinks.filter(
				(l: EnrichedLinkObject) => l.validation.status === "valid",
			).length,
			errors: filteredLinks.filter(
				(l: EnrichedLinkObject) => l.validation.status === "error",
			).length,
			warnings: filteredLinks.filter(
				(l: EnrichedLinkObject) => l.validation.status === "warning",
			).length,
		};
		return {
			...result,
			links: filteredLinks,
			summary: filteredSummary,
			lineRange: `${startLine}-${endLine}`,
		};
	}

	/** Parse "start-end" or single-line range string to LineRange. */
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

	/** Delegate to formatValidationResult.formatForCLI. */
	private formatForCLI(
		result: ValidationResult & { lineRange?: string },
		nestedCodeblockWarnings: NestedCodeblockWarning[] = [],
		verbose = false,
	): string {
		return formatForCLI(result, nestedCodeblockWarnings, verbose);
	}

	/** Delegate to formatValidationResult.formatAsJSON. */
	private formatAsJSON(result: ValidationResult): string {
		return formatAsJSON(result);
	}

	/** Validate all citations in sourceFile and extract referenced content to stdout. */
	async extractLinks(
		sourceFile: string,
		options: CliExtractOptions,
	): Promise<void> {
		try {
			this.applyScope(options, sourceFile);
			const validationResult = await this.validator.validateFile(sourceFile);
			const enrichedLinks = validationResult.links;
			if (validationResult.summary.errors > 0) {
				console.error("Validation errors found:");
				for (const link of enrichedLinks.filter(
					(l: EnrichedLinkObject) => l.validation.status === "error",
				)) {
					if (link.validation.status === "error") {
						console.error(`  Line ${link.line}: ${link.validation.error}`);
					}
				}
			}
			const extractionResult = await this.contentExtractor.extractContent(
				enrichedLinks,
				{ fullFiles: options.fullFiles ?? false },
			);
			console.log(
				formatExtractResult(
					extractionResult,
					"json",
					options.verbose ? "verbose" : "minimal",
				),
			);
			process.exitCode = extractionResult.stats.uniqueContent > 0 ? 0 : 1;
		} catch (error) {
			console.error(
				"ERROR:",
				error instanceof Error ? error.message : String(error),
			);
			process.exitCode = 2;
		}
	}

	/** Create a synthetic header citation, validate it, and extract the section content. */
	async extractHeader(
		targetFile: string,
		headerName: string,
		options: CliExtractOptions,
	): Promise<OutgoingLinksExtractedContent | undefined> {
		try {
			this.applyScope(options, targetFile);
			const syntheticLink = new LinkObjectFactory().createHeaderLink(
				targetFile,
				headerName,
			);
			const enrichedLink = await this.validator.validateSingleCitation(
				syntheticLink,
				targetFile,
			);
			if (enrichedLink.validation.status === "error") {
				console.error("Validation failed:", enrichedLink.validation.error);
				if (enrichedLink.validation.suggestion) {
					console.error("Suggestion:", enrichedLink.validation.suggestion);
				}
				process.exitCode = 1;
				return;
			}
			return await this.contentExtractor.extractContent(
				[enrichedLink],
				options,
			);
		} catch (error) {
			console.error(
				"ERROR:",
				error instanceof Error ? error.message : String(error),
			);
			process.exitCode = 2;
			return undefined;
		}
	}

	/** Create a synthetic whole-file citation, validate it, and extract the full file content. */
	async extractFile(
		targetFile: string,
		options: CliExtractOptions,
	): Promise<OutgoingLinksExtractedContent | undefined> {
		try {
			this.applyScope(options, targetFile);
			// Fix(#63): Resolve to absolute before factory so target.path.raw is absolute.
			const absoluteTargetFile = path.resolve(targetFile);
			const syntheticLink = new LinkObjectFactory().createFileLink(
				absoluteTargetFile,
			);
			const enrichedLink = await this.validator.validateSingleCitation(
				syntheticLink,
				absoluteTargetFile,
			);
			// Apply cache-resolved path if validator found file via a different location.
			if (
				enrichedLink.validation.status !== "valid" &&
				"pathConversion" in enrichedLink.validation &&
				enrichedLink.validation.pathConversion?.recommended
			) {
				syntheticLink.target.path.absolute = path.resolve(
					enrichedLink.validation.pathConversion.recommended,
				);
			}
			if (enrichedLink.validation.status === "error") {
				console.error("Validation failed:", enrichedLink.validation.error);
				if (enrichedLink.validation.suggestion) {
					console.error("Suggestion:", enrichedLink.validation.suggestion);
				}
				process.exitCode = 1;
				return;
			}
			return await this.contentExtractor.extractContent([enrichedLink], {
				...options,
				fullFiles: true,
			});
		} catch (error) {
			console.error(
				"ERROR:",
				error instanceof Error ? error.message : String(error),
			);
			process.exitCode = 2;
			return undefined;
		}
	}

	/** Validate citations in filePath, auto-fix path/anchor issues, write in-place. Returns fix report. */
	async fix(
		filePath: string,
		options: CliValidateOptions = {},
	): Promise<string> {
		try {
			const { readFileSync, writeFileSync } = await import("node:fs");
			if (options.scope) {
				const cacheStats = this.fileCache.buildCache(
					options.scope,
					false,
					undefined,
					{
						respectGitignore: !options.allowGitignore,
					},
				);
				console.log(
					`Scanned ${cacheStats.totalFiles} files in ${cacheStats.scopeFolder}`,
				);
				if (cacheStats.duplicates > 0) {
					console.log(
						`WARNING: Found ${cacheStats.duplicates} duplicate filenames`,
					);
				}
			}
			const validationResults = await this.validator.validateFile(filePath);
			const fixableLinks = validationResults.links.filter(
				(link: EnrichedLinkObject) =>
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
			let fileContent = readFileSync(filePath, "utf8");
			let fixesApplied = 0;
			let pathFixesApplied = 0;
			let anchorFixesApplied = 0;
			const fixes: FixRecord[] = [];
			for (const link of fixableLinks) {
				let newCitation = link.fullMatch;
				let fixType = "";
				if (
					link.validation.status !== "valid" &&
					link.validation.pathConversion
				) {
					newCitation = applyPathConversion(
						newCitation,
						link.validation.pathConversion,
					);
					pathFixesApplied++;
					fixType = "path";
				}
				if (
					link.validation.status === "error" &&
					link.validation.suggestion &&
					(link.validation.suggestion.includes(
						"Use raw header format for better Obsidian compatibility",
					) ||
						(link.validation.error.startsWith("Anchor not found") &&
							link.validation.suggestion.includes("Available headers:")))
				) {
					newCitation = applyAnchorFix(newCitation, link);
					anchorFixesApplied++;
					fixType = fixType ? "path+anchor" : "anchor";
				}
				fileContent = fileContent.replace(link.fullMatch, newCitation);
				fixes.push({
					line: link.line,
					old: link.fullMatch,
					new: newCitation,
					type: fixType,
				});
				fixesApplied++;
			}
			if (fixesApplied > 0) {
				writeFileSync(filePath, fileContent, "utf8");
				const output = [
					`Fixed ${fixesApplied} citation${fixesApplied === 1 ? "" : "s"} in ${filePath}:`,
				];
				if (pathFixesApplied > 0)
					output.push(
						`   - ${pathFixesApplied} path correction${pathFixesApplied === 1 ? "" : "s"}`,
					);
				if (anchorFixesApplied > 0)
					output.push(
						`   - ${anchorFixesApplied} anchor correction${anchorFixesApplied === 1 ? "" : "s"}`,
					);
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
			return `ERROR: ${error instanceof Error ? error.message : String(error)}`;
		}
	}
}
