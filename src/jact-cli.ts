/**
 * JactCli — orchestration and scope management for citation operations.
 *
 * This module exports the JactCli class only. Commander CLI wiring lives in
 * cli.ts so JactCli can be imported programmatically without activating Commander.
 *
 * @module jact
 */

import { existsSync } from "node:fs";
import path from "node:path";
import {
	checkOutlineReminderCache,
	resetOutlineReminderCache,
	writeOutlineReminderCache,
} from "./cache/check-outline-reminder-cache.js";
import {
	applyCitationFixes,
	type FixFsOverrides,
} from "./core/apply-citation-fixes.js";
import type { CitationValidator } from "./core/CitationValidator/CitationValidator.js";
import type { ContentExtractor } from "./core/ContentExtractor/ContentExtractor.js";
import { generateContentId } from "./core/ContentExtractor/generateContentId.js";
import type { NestedCodeblockWarning } from "./core/MarkdownParser/detectNestedCodeblocks.js";
import { prepareScope } from "./core/prepare-scope.js";
import type { FileCache } from "./FileCache.js";
import {
	createCitationValidator,
	createContentExtractor,
	createFileCache,
	createMarkdownParser,
	createParsedFileCache,
	createValidationWorkflow,
} from "./factories/componentFactory.js";
import { LinkObjectFactory } from "./factories/LinkObjectFactory.js";
import { formatExtractResult } from "./formatExtractResult.js";
import { formatAsJSON, formatForCLI } from "./formatValidationResult.js";
import { renderOutline } from "./outline/render-outline.js";
import type ParsedDocument from "./ParsedDocument.js";
import type { HeadingMatch, HeadingResolution } from "./ParsedDocument.js";
import type { ParsedFileCache } from "./ParsedFileCache.js";
import type { ParserOutput } from "./types/citationTypes.js";
import type {
	CliExtractOptions,
	CliOutlineOptions,
	CliValidateOptions,
} from "./types/cli-types.js";
import type { OutgoingLinksExtractedContent } from "./types/extraction-types.js";
import type { CacheStats } from "./types/fileCacheTypes.js";
import type {
	EnrichedLinkObject,
	ValidationResult,
} from "./types/validationTypes.js";
import type {
	ValidationWorkflow,
	ValidationWorkflowOutcome,
} from "./validate/validation-workflow.js";

export interface OutlineCommandResult {
	success: boolean;
	output: string;
}

const OUTLINE_CACHE_DIR = ".jact/claude-cache";

function quote(value: string): string {
	return JSON.stringify(value);
}

function headingLocation(match: HeadingMatch): string {
	if (match.ancestors.length === 0) return "at document root";
	return `under ${match.ancestors.map((heading) => quote(heading.text)).join(" > ")}`;
}

function formatHeadingResolution(resolution: HeadingResolution): string {
	if (resolution.status === "unique") return "";
	if (resolution.status === "ambiguous") {
		return [
			`${quote(resolution.query)} is ambiguous:`,
			...resolution.matches.map((match) => `- ${headingLocation(match)}`),
		].join("\n");
	}

	const lines = [`${quote(resolution.query)} was not found.`];
	if (resolution.alternatives.length > 0) {
		lines.push(
			"",
			"Close alternatives:",
			...resolution.alternatives.map(
				(match) => `- ${quote(match.heading.text)} ${headingLocation(match)}`,
			),
		);
	}
	return lines.join("\n");
}

function shellFileArgument(filePath: string): string {
	return /^[A-Za-z0-9_./-]+$/.test(filePath) ? filePath : quote(filePath);
}

function uniqueParentName(
	document: ParsedDocument,
	match: HeadingMatch,
): string | undefined {
	for (const ancestor of [...match.ancestors].reverse()) {
		if (document.resolveHeading(ancestor.text).status === "unique") {
			return ancestor.text;
		}
	}
	return undefined;
}

/**
 * Main application class: orchestration + scope management for citation operations.
 * Importable programmatically without activating Commander (wiring is in cli.ts).
 */
export class JactCli {
	private parsedFileCache: ParsedFileCache;
	private fileCache: FileCache;
	private validator: CitationValidator;
	private contentExtractor: ContentExtractor;
	private validationWorkflow: ValidationWorkflow;

	constructor() {
		this.fileCache = createFileCache();
		const parser = createMarkdownParser(this.fileCache);
		this.parsedFileCache = createParsedFileCache(parser);
		this.validator = createCitationValidator(
			this.parsedFileCache,
			this.fileCache,
		);
		this.contentExtractor = createContentExtractor(this.parsedFileCache);
		this.validationWorkflow = createValidationWorkflow(
			this.parsedFileCache,
			this.fileCache,
			this.validator,
		);
	}

	/**
	 * Resolve scope and build the file cache. Throws if scope cannot be inferred.
	 * Returns cache statistics for callers that need them.
	 */
	private applyScope(
		options: { scope?: string; allowGitignore?: boolean },
		targetFile?: string,
	): CacheStats {
		const prepared = prepareScope(this.fileCache, options, targetFile);
		return prepared.stats;
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
		return (await this.resolveDocument(filePath, options)).data;
	}

	private async resolveDocument(
		filePath: string,
		options: { scope?: string },
	): Promise<ParsedDocument> {
		this.applyScope(options, filePath);
		const absolute = path.resolve(filePath);
		if (existsSync(absolute)) {
			return this.parsedFileCache.resolveDocument({
				kind: "file",
				filePath: absolute,
			});
		}
		const cacheResult = this.fileCache.resolveFile(path.basename(filePath));
		if (cacheResult.found && cacheResult.path) {
			return this.parsedFileCache.resolveDocument({
				kind: "file",
				filePath: cacheResult.path,
			});
		}
		const err = new Error(`File not found: ${absolute}`);
		if (cacheResult.message !== undefined) {
			(err as Error & { suggestion?: string }).suggestion = cacheResult.message;
		}
		throw err;
	}

	/** Validate citations in a markdown file and return a formatted report. */
	async validate(
		filePath: string,
		options: CliValidateOptions = {},
	): Promise<string> {
		const outcome = await this.validationWorkflow.validate(
			{ kind: "file", filePath },
			options,
		);
		return this.renderValidationOutcome(outcome, options);
	}

	/** Validate in-memory markdown under its intended path. */
	async validateContent(
		content: string,
		options: CliValidateOptions & { filePath: string },
	): Promise<string> {
		const outcome = await this.validationWorkflow.validate(
			{ kind: "memory", filePath: options.filePath, content },
			options,
		);
		return this.renderValidationOutcome(outcome, options);
	}

	private renderValidationOutcome(
		outcome: ValidationWorkflowOutcome,
		options: CliValidateOptions,
	): string {
		if (outcome.kind === "failed") {
			if (options.format === "json") {
				return JSON.stringify(
					{ error: outcome.error, file: outcome.filePath, success: false },
					null,
					2,
				);
			}
			return `ERROR: ${outcome.error}`;
		}

		if (options.format !== "json") {
			for (const notice of outcome.scopeNotices) console.log(notice);
			if (options.verbose) {
				console.log(
					`Scanned ${outcome.cacheStats.totalFiles} files in ${outcome.cacheStats.scopeFolder}`,
				);
				if (outcome.cacheStats.duplicates > 0) {
					console.log(
						`WARNING: Found ${outcome.cacheStats.duplicates} duplicate filenames`,
					);
				}
			}
		}
		if (options.format === "json") return this.formatAsJSON(outcome.result);
		return this.appendGitignoreHint(
			this.formatForCLI(
				outcome.result,
				outcome.nestedCodeblockWarnings,
				options.verbose ?? false,
			),
		);
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
			const sourceDocument = await this.resolveDocument(sourceFile, options);
			const validationResult = await this.validator.validateDocument(
				sourceDocument,
				sourceFile,
			);
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

	/** Resolve and render a parser-derived heading outline. */
	async outline(
		filePath: string,
		maxLevel: number,
		options: CliOutlineOptions = {},
	): Promise<OutlineCommandResult> {
		const document = await this.resolveDocument(filePath, options);
		const parsed = document.data;
		const headings = document.getHeadings();
		if (headings.length === 0) {
			return {
				success: true,
				output: "No headings found. Use jact extract file for all content.",
			};
		}

		let withinIndex: number | undefined;
		if (options.within !== undefined) {
			const withinResolution = document.resolveHeading(options.within);
			if (withinResolution.status !== "unique") {
				return {
					success: false,
					output: formatHeadingResolution(withinResolution),
				};
			}
			withinIndex = withinResolution.match.index;
		}

		const expandedIndexes = new Set<number>();
		if (options.expand !== undefined) {
			if (options.expand.includes(",")) {
				const commaHeading = document.resolveHeading(options.expand, {
					...(options.within !== undefined && { within: options.within }),
				});
				if (commaHeading.status !== "missing") {
					return {
						success: false,
						output: `${quote(options.expand)} contains a comma and cannot be selected with --expand because commas separate heading names. Narrow with --within or choose a heading without a comma.`,
					};
				}
			}

			const selectors = options.expand.split(",").map((value) => value.trim());
			if (selectors.some((selector) => selector.length === 0)) {
				return {
					success: false,
					output:
						"--expand requires one or more non-empty comma-separated heading names.",
				};
			}

			for (const selector of selectors) {
				const resolution = document.resolveHeading(selector, {
					...(options.within !== undefined && { within: options.within }),
				});
				if (resolution.status !== "unique") {
					const lines = [formatHeadingResolution(resolution)];
					const parent =
						resolution.status === "ambiguous" && resolution.matches[0]
							? uniqueParentName(document, resolution.matches[0])
							: undefined;
					if (parent && options.within === undefined) {
						lines.push(
							"",
							"Retry with a unique parent:",
							`jact outline ${shellFileArgument(filePath)} H${maxLevel} --expand ${quote(selector)} --within ${quote(parent)}`,
						);
					}
					return { success: false, output: lines.join("\n") };
				}
				expandedIndexes.add(resolution.match.index);
			}
		}

		const rendered = renderOutline(headings, {
			maxLevel,
			expandedIndexes,
			...(options.exactHeadingLevel !== undefined && {
				exactHeadingLevel: options.exactHeadingLevel,
			}),
			...(options.lineNumber !== undefined && {
				lineNumber: options.lineNumber,
			}),
			...(withinIndex !== undefined && { withinIndex }),
		});
		let output = rendered.text;

		const sessionId = options.sessionId;
		if (sessionId && options.cacheReset) {
			resetOutlineReminderCache(sessionId, parsed.filePath, OUTLINE_CACHE_DIR);
		}
		const remindersAlreadyShown = sessionId
			? checkOutlineReminderCache(sessionId, parsed.filePath, OUTLINE_CACHE_DIR)
			: false;

		if (!remindersAlreadyShown) {
			const suggestedLevel = options.exactHeadingLevel ?? maxLevel;
			const reminders = [
				...(rendered.collapsedIndexes.length > 0
					? [
							`[*] To Expand: run \`jact outline "{{absolute-or-relative-path-to-file}}" H${maxLevel} --expand "{{full-header-1-text}},{{full-header-2-text}}"\``,
						]
					: []),
				`To Show Only H${suggestedLevel} with Source Lines: run \`jact outline "{{absolute-or-relative-path-to-file}}" --exact-heading-level H${suggestedLevel} -n\``,
				'To Extract: run `jact extract header "{{absolute-or-relative-path-to-file}}" "{{full-header-text}}" --within "{{unique-parent-header-text}}"`',
				"More Outline Options: run `jact outline -h`",
			];
			output += `\n\n${reminders.join("\n")}`;
			if (sessionId) {
				writeOutlineReminderCache(
					sessionId,
					parsed.filePath,
					OUTLINE_CACHE_DIR,
				);
			}
		}

		return { success: true, output };
	}

	/** Resolve one header uniquely and extract that exact section. */
	async extractHeader(
		targetFile: string,
		headerName: string,
		options: CliExtractOptions,
	): Promise<OutgoingLinksExtractedContent | undefined> {
		try {
			const document = await this.resolveDocument(targetFile, options);
			const parsed = document.data;
			const resolution = document.resolveHeading(headerName, {
				...(options.within !== undefined && { within: options.within }),
			});
			if (resolution.status !== "unique") {
				console.error(formatHeadingResolution(resolution));
				if (resolution.status === "ambiguous" && options.within === undefined) {
					const firstMatch = resolution.matches[0];
					const parent = firstMatch
						? uniqueParentName(document, firstMatch)
						: undefined;
					if (parent) {
						console.error("\nRetry with a unique parent:");
						console.error(
							`jact extract header ${shellFileArgument(targetFile)} ${quote(headerName)} --within ${quote(parent)}`,
						);
					}
				}
				process.exitCode = 1;
				return undefined;
			}

			const content = document.extractResolvedSection(resolution.match);
			if (content === null)
				throw new Error(`Unable to extract heading: ${headerName}`);
			const contentId = generateContentId(content);
			const unresolvedLink = new LinkObjectFactory().createHeaderLink(
				targetFile,
				headerName,
			);
			const syntheticLink = {
				...unresolvedLink,
				target: {
					...unresolvedLink.target,
					path: {
						...unresolvedLink.target.path,
						absolute: parsed.filePath,
					},
				},
			};
			const enrichedLink = {
				...syntheticLink,
				validation: { status: "valid" as const },
			};
			const block = {
				content,
				contentLength: content.length,
				sourceLinks: [
					{
						rawSourceLink: syntheticLink.fullMatch,
						sourceLine: syntheticLink.line,
					},
				],
			};
			return {
				extractedContentBlocks: {
					_totalContentCharacterLength: JSON.stringify({ [contentId]: block })
						.length,
					[contentId]: block,
				},
				outgoingLinksReport: {
					processedLinks: [
						{ sourceLink: enrichedLink, contentId, status: "extracted" },
					],
				},
				stats: {
					totalLinks: 1,
					uniqueContent: 1,
					duplicateContentDetected: 0,
					tokensSaved: 0,
					compressionRatio: 0,
				},
			};
		} catch (error) {
			const e = error as Error & { suggestion?: string };
			console.error("ERROR:", e.message);
			if (e.suggestion) console.error("Suggestion:", e.suggestion);
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
			{
				validator: this.validator,
				fileCache: this.fileCache,
				parsedDocuments: this.parsedFileCache,
			},
			filePath,
			options,
			_fs,
		);
	}
}
