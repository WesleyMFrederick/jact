import { existsSync } from "node:fs";
import path from "node:path";
import type { CitationValidator } from "../core/CitationValidator/CitationValidator.js";
import {
	detectNestedCodeblocks,
	type NestedCodeblockWarning,
} from "../core/MarkdownParser/detectNestedCodeblocks.js";
import { prepareScope } from "../core/prepare-scope.js";
import { NO_RULES } from "../core/ValidationRules/presets.js";
import { runRules } from "../core/ValidationRules/runRules.js";
import type { FileCache } from "../FileCache.js";
import type { ParsedFileCache } from "../ParsedFileCache.js";
import type { CliValidateOptions } from "../types/cli-types.js";
import type { CacheStats } from "../types/fileCacheTypes.js";
import type { RuleSetResolver } from "../types/validationRuleTypes.js";
import type { ValidationResult } from "../types/validationTypes.js";
import { VALIDATION_DISABLED_REASON } from "./validation-disable.js";

export type ValidationInput =
	| { kind: "file"; filePath: string }
	| { kind: "memory"; filePath: string; content: string };

export type ValidationWorkflowOutcome =
	| {
			kind: "completed";
			filePath: string;
			result: ValidationResult & { lineRange?: string };
			nestedCodeblockWarnings: NestedCodeblockWarning[];
			scopeNotices: string[];
			cacheStats: CacheStats;
	  }
	| {
			kind: "skipped";
			filePath: string;
			reason: string;
	  }
	| { kind: "failed"; filePath: string; error: string };

export class ValidationWorkflow {
	constructor(
		private parsedDocuments: ParsedFileCache,
		private validator: CitationValidator,
		private fileCache: FileCache,
		/** Enabled validation rules per file; defaults to none (commonmark). */
		private resolveRuleSet: RuleSetResolver = async () => NO_RULES,
	) {}

	async validate(
		input: ValidationInput,
		options: CliValidateOptions = {},
	): Promise<ValidationWorkflowOutcome> {
		const startTime = Date.now();
		try {
			const preparedScope = prepareScope(
				this.fileCache,
				options,
				input.filePath,
			);
			if (input.kind === "file" && !existsSync(input.filePath)) {
				throw new Error(`File not found: ${input.filePath}`);
			}

			const intendedPath =
				input.kind === "memory" ? path.resolve(input.filePath) : input.filePath;
			const document = await this.parsedDocuments.resolveDocument(
				input.kind === "memory"
					? {
							kind: "memory",
							filePath: intendedPath,
							content: input.content,
						}
					: { kind: "file", filePath: intendedPath },
			);
			if (document.data.validationDisabled) {
				return {
					kind: "skipped",
					filePath: intendedPath,
					reason: VALIDATION_DISABLED_REASON,
				};
			}
			const ruleSet = await this.resolveRuleSet(intendedPath);
			const validation = runRules(
				ruleSet,
				intendedPath,
				document.data,
				await this.validator.validateDocument(document, intendedPath, {
					ruleIds: ruleSet.enabled,
				}),
			);
			const content = document.data.content;
			validation.validationTime = `${((Date.now() - startTime) / 1000).toFixed(1)}s`;
			const result = options.lines
				? this.filterByLineRange(validation, options.lines)
				: validation;

			return {
				kind: "completed",
				filePath: intendedPath,
				result,
				nestedCodeblockWarnings: detectNestedCodeblocks(content),
				scopeNotices: preparedScope.notices,
				cacheStats: preparedScope.stats,
			};
		} catch (error) {
			return {
				kind: "failed",
				filePath: input.filePath,
				error: error instanceof Error ? error.message : String(error),
			};
		}
	}

	private filterByLineRange(
		result: ValidationResult,
		lineRange: string,
	): ValidationResult & { lineRange: string } {
		const [startLine, endLine] = this.parseLineRange(lineRange);
		const links = result.links.filter(
			(link) => link.line >= startLine && link.line <= endLine,
		);
		const findings = result.findings?.filter(
			(finding) => finding.line >= startLine && finding.line <= endLine,
		);
		return {
			...result,
			links,
			...(findings && { findings }),
			summary: {
				total: links.length,
				valid: links.filter((link) => link.validation.status === "valid").length,
				warnings: links.filter((link) => link.validation.status === "warning").length,
				errors:
					links.filter((link) => link.validation.status === "error").length +
					(findings?.length ?? 0),
			},
			lineRange: `${startLine}-${endLine}`,
		};
	}

	private parseLineRange(lineRange: string): [number, number] {
		if (lineRange.includes("-")) {
			const [start, end] = lineRange
				.split("-")
				.map((value) => Number.parseInt(value.trim(), 10));
			return [start || 0, end || 0];
		}
		const line = Number.parseInt(lineRange.trim(), 10);
		return [line, line];
	}
}
