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
import {
	applyCitationFixes,
	type FixFsOverrides,
} from "./core/apply-citation-fixes.js";
import type { CitationValidator } from "./core/CitationValidator/CitationValidator.js";
import type { ContentExtractor } from "./core/ContentExtractor/ContentExtractor.js";
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
import type { CacheStats } from "./types/fileCacheTypes.js";
import type {
	EnrichedLinkObject,
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
	/** Scope/gitignore decisions from the last applyScope, surfaced by validate. */
	private scopeNotices: string[] = [];

	constructor() {
		this.fileCache = createFileCache();
		this.parser = createMarkdownParser(this.fileCache);
		this.parsedFileCache = createParsedFileCache(this.parser);
		this.validator = createCitationValidator(
			this.parsedFileCache,
			this.fileCache,
		);
		this.contentExtractor = createContentExtractor(this.parsedFileCache);
	}

	/**
	 * Resolve scope and build the file cache. Throws if scope cannot be inferred.
	 * Returns the cache stats so callers (e.g. validate) can emit verbose output.
	 */
	private applyScope(
		options: { scope?: string; allowGitignore?: boolean },
		targetFile?: string,
	): CacheStats {
		this.scopeNotices = [];
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

		// When a default root is auto-picked (not an explicit --scope) and the
		// nearest marker is an Obsidian vault, say so — the user may have wanted a
		// different root. (Core principle: surface defaults, don't hide them.)
		if (resolved.marker === ".obsidian") {
			this.scopeNotices.push(
				`Scoped to ${resolved.scope} (nearest Obsidian vault). Override with --scope <dir>.`,
			);
		}

		// Default: respect .gitignore. --allow-gitignore opts in to scanning excluded files.
		// buildCache verbose stays false so JSON callers (ast/extract) keep clean
		// stdout/stderr; verbose callers (validate) log from the returned stats.
		const respectGitignore = !options.allowGitignore;
		let stats = this.fileCache.buildCache(resolved.scope, false, resolved, {
			respectGitignore,
		});

		// If the explicitly-targeted file is hidden by .gitignore under this scope,
		// index its directory branch anyway — pointing jact at a file is an explicit
		// request to validate it and its siblings (e.g. bare wiki page names).
		if (targetFile !== undefined && respectGitignore) {
			const absTarget = path.resolve(targetFile);
			if (this.fileCache.isIgnored(absTarget)) {
				const includeDir = path.dirname(absTarget);
				stats = this.fileCache.buildCache(resolved.scope, false, resolved, {
					respectGitignore,
					alwaysIncludeDir: includeDir,
				});
				this.scopeNotices.push(
					`Note: ${includeDir} is gitignored under ${resolved.scope}; indexed it because you targeted a file inside it. Use --allow-gitignore to scan all ignored paths.`,
				);
			}
		}

		return stats;
	}

	/**
	 * Part 1: when the CLI report has a "Wiki page not found" error and the scan
	 * honored an active .gitignore, hint that the target may be hidden by it.
	 * Wiki links carry only a bare page name (no path), so the hint is scoped to
	 * "gitignore is active" rather than a per-target path check.
	 */
	private appendGitignoreHint(cliOutput: string): string {
		if (
			cliOutput.includes("Wiki page not found") &&
			this.fileCache.scopeHasGitignore()
		) {
			return `${cliOutput}\n\nHint: .gitignore is active for this scan. If a wiki target lives in a gitignored folder, re-run with --allow-gitignore.`;
		}
		return cliOutput;
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
			// Smart-default scope resolution (cwd-git → cwd-pkg → target-git →
			// target-pkg), same as getAst. Seeds the shared FileCache so bare wiki
			// page names resolve even when --scope is omitted.
			const cacheStats = this.applyScope(options, filePath);
			if (options.format !== "json") {
				// Surface scope/gitignore decisions (Obsidian-vault default, gitignore
				// relax) before the report so the user sees what jact chose.
				for (const notice of this.scopeNotices) console.log(notice);
				if (options.verbose) {
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
			const reportResult = options.lines
				? this.filterResultsByLineRange(result, options.lines)
				: result;
			if (options.format === "json") return this.formatAsJSON(reportResult);
			const cli = this.formatForCLI(
				reportResult,
				nestedCodeblockWarnings,
				options.verbose ?? false,
			);
			return this.appendGitignoreHint(cli);
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

	/**
	 * Validate markdown supplied as a string (file not yet on disk). The in-memory analogue of validate().
	 * Contract: options.filePath is the INTENDED path — used for scope, relative-link base, self-anchor key.
	 * Returns the same formatted report string as validate(); same exit-code mapping in the CLI layer.
	 */
	async validateContent(
		content: string,
		options: CliValidateOptions & { filePath: string },
	): Promise<string> {
		const { filePath } = options;
		try {
			const startTime = Date.now();
			// applyScope works without the file existing on disk — it only needs the
			// intended path for the target-git/target-pkg fallback walk-up.
			const cacheStats = this.applyScope(options, filePath);
			if (options.format !== "json") {
				for (const notice of this.scopeNotices) console.log(notice);
				if (options.verbose) {
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
			const abs = path.resolve(filePath);
			const parsed = this.parser.parseContent(content, abs);
			// Seed the cache so self-anchors (`#some-heading`) resolve against this
			// in-memory content instead of attempting a disk read of an unwritten file.
			this.parsedFileCache.seedParsedFile(abs, parsed);
			const result = await this.validator.validateParsed(parsed, abs);
			result.validationTime = `${((Date.now() - startTime) / 1000).toFixed(1)}s`;
			// No disk read — feed the in-memory content directly to the nested-codeblock detector.
			const nestedCodeblockWarnings = detectNestedCodeblocks(content);
			const reportResult = options.lines
				? this.filterResultsByLineRange(result, options.lines)
				: result;
			if (options.format === "json") return this.formatAsJSON(reportResult);
			const cli = this.formatForCLI(
				reportResult,
				nestedCodeblockWarnings,
				options.verbose ?? false,
			);
			return this.appendGitignoreHint(cli);
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

	/**
	 * Validate citations in filePath, auto-fix path/anchor issues, write in-place.
	 *
	 * Thin facade — delegates to apply-citation-fixes.js (extracted from this
	 * class: god-class fix — JactCli bundled scope resolution, validation
	 * orchestration, extraction, AND fix orchestration in one 630-line class).
	 *
	 * @param filePath - Path to the markdown file to fix
	 * @param options - Fix options (scope, dryRun, etc.)
	 * @param _fs - Optional fs overrides for testing (read/write functions)
	 * @returns Fix report string, dry-run diff string, or error string
	 */
	async fix(
		filePath: string,
		options: CliValidateOptions = {},
		_fs?: FixFsOverrides,
	): Promise<string> {
		return applyCitationFixes(
			{ validator: this.validator, fileCache: this.fileCache },
			filePath,
			options,
			_fs,
		);
	}
}
