import type { NestedCodeblockWarning } from "./core/MarkdownParser/detectNestedCodeblocks.js";
import type {
	DuplicatePathSuggestion,
	EnrichedLinkObject,
	ValidationMetadata,
	ValidationResult,
} from "./types/validationTypes.js";

/**
 * Format validation results for CLI output (verbose tree style).
 *
 * Generates human-readable tree-style output with sections for errors,
 * warnings, and valid citations. Includes summary statistics and validation time.
 * When `verbose` is false, delegates to `formatForCLIMinimal`.
 *
 * @param result - Validation result object (optionally filtered by line range)
 * @param nestedCodeblockWarnings - Nested codeblock warnings to include
 * @param verbose - If true, emit full tree report; if false, emit minimal output
 * @returns Formatted CLI output string
 */
export function formatForCLI(
	result: ValidationResult & { lineRange?: string },
	nestedCodeblockWarnings: NestedCodeblockWarning[] = [],
	verbose = false,
): string {
	if (!verbose) {
		return formatForCLIMinimal(result, nestedCodeblockWarnings);
	}

	const lines: string[] = [];
	lines.push("Citation Validation Report");
	lines.push("==========================");
	lines.push("");
	if (result.lineRange) {
		lines.push(`Line Range: ${result.lineRange}`);
	}
	lines.push(`Processed: ${result.summary.total} citations found`);
	lines.push("");

	if (result.summary.errors > 0) {
		lines.push(`CRITICAL ERRORS (${result.summary.errors})`);
		const errorLinks = result.links.filter(
			(link) => link.validation.status === "error",
		);
		for (const [index, link] of errorLinks.entries()) {
			const isLast = index === errorLinks.length - 1;
			const prefix = isLast ? "└─" : "├─";
			lines.push(`${prefix} Line ${link.line}: ${link.fullMatch}`);
			if (link.validation.status === "error") {
				lines.push(`│  └─ ${link.validation.error}`);
				const suggestion = renderValidationSuggestion(link.validation, true);
				if (suggestion) {
					lines.push(`│  └─ Suggestion: ${suggestion}`);
				}
			}
			if (!isLast) lines.push("│");
		}
		lines.push("");
	}

	if (result.summary.warnings > 0) {
		lines.push(`WARNINGS (${result.summary.warnings})`);
		const warnLinks = result.links.filter(
			(link) => link.validation.status === "warning",
		);
		for (const [index, link] of warnLinks.entries()) {
			const isLast = index === warnLinks.length - 1;
			const prefix = isLast ? "└─" : "├─";
			lines.push(`${prefix} Line ${link.line}: ${link.fullMatch}`);
			if (link.validation.status === "warning") {
				if (link.validation.message) {
					lines.push(`│  └─ ${link.validation.message}`);
				}
				const suggestion = renderValidationSuggestion(link.validation, true);
				if (suggestion) {
					lines.push(`│  └─ ${suggestion}`);
				}
			}
			if (!isLast) lines.push("│");
		}
		lines.push("");
	}

	if (result.summary.valid > 0) {
		lines.push(`VALID CITATIONS (${result.summary.valid})`);
		const validLinks = result.links.filter(
			(link) => link.validation.status === "valid",
		);
		for (const [index, link] of validLinks.entries()) {
			const isLast = index === validLinks.length - 1;
			const prefix = isLast ? "└─" : "├─";
			lines.push(`${prefix} Line ${link.line}: ${link.fullMatch}`);
		}
		lines.push("");
	}

	if (nestedCodeblockWarnings.length > 0) {
		lines.push(`NESTED CODEBLOCK WARNINGS (${nestedCodeblockWarnings.length})`);
		nestedCodeblockWarnings.forEach((warning, index) => {
			const isLast = index === nestedCodeblockWarnings.length - 1;
			const prefix = isLast ? "└─" : "├─";
			lines.push(`${prefix} Line ${warning.line}: ${warning.message}`);
			if (!isLast) lines.push("│");
		});
		lines.push("");
	}

	lines.push("SUMMARY:");
	lines.push(`- Total citations: ${result.summary.total}`);
	lines.push(`- Valid: ${result.summary.valid}`);
	lines.push(`- Warnings: ${result.summary.warnings}`);
	lines.push(`- Critical errors: ${result.summary.errors}`);
	if (nestedCodeblockWarnings.length > 0) {
		lines.push(
			`- Nested codeblock warnings: ${nestedCodeblockWarnings.length}`,
		);
	}
	lines.push(`- Validation time: ${result.validationTime}`);
	lines.push("");

	if (result.summary.errors > 0) {
		lines.push(
			`VALIDATION FAILED - Fix ${result.summary.errors} critical errors`,
		);
	} else if (
		result.summary.warnings > 0 ||
		nestedCodeblockWarnings.length > 0
	) {
		const totalWarnings =
			result.summary.warnings + nestedCodeblockWarnings.length;
		lines.push(
			`VALIDATION PASSED WITH WARNINGS - ${totalWarnings} issues to review`,
		);
	} else {
		lines.push("ALL CITATIONS VALID");
	}

	return lines.join("\n");
}

/**
 * Minimal (LLM-optimized) CLI formatter — default output.
 *
 * Emits only errors and warnings. Clean files produce a single "OK:" line.
 * Designed to minimize token consumption for LLM-driven repair workflows.
 *
 * @param result - Validation result object (optionally filtered by line range)
 * @param nestedCodeblockWarnings - Nested codeblock warnings to include
 * @returns Formatted CLI output string
 */
export function formatForCLIMinimal(
	result: ValidationResult & { lineRange?: string },
	nestedCodeblockWarnings: NestedCodeblockWarning[] = [],
): string {
	const lines: string[] = [];

	if (result.summary.errors > 0) {
		lines.push(`ERRORS (${result.summary.errors})`);
		const errorLinks = result.links.filter(
			(link) => link.validation.status === "error",
		);
		for (const link of errorLinks) {
			lines.push(`- Line ${link.line}: ${link.fullMatch}`);
			if (link.validation.status === "error") {
				lines.push(`  error: ${link.validation.error}`);
				const suggestion = renderValidationSuggestion(link.validation, false);
				if (suggestion) {
					lines.push(`  suggestion: ${suggestion}`);
				}
			}
		}
		lines.push("");
	}

	const totalWarnings =
		result.summary.warnings + nestedCodeblockWarnings.length;

	if (totalWarnings > 0) {
		lines.push(`WARNINGS (${totalWarnings})`);
		const warnLinks = result.links.filter(
			(link: EnrichedLinkObject) => link.validation.status === "warning",
		);
		for (const link of warnLinks) {
			lines.push(`- Line ${link.line}: ${link.fullMatch}`);
			if (link.validation.status === "warning") {
				if (link.validation.message) {
					lines.push(`  message: ${link.validation.message}`);
				}
				const suggestion = renderValidationSuggestion(link.validation, false);
				if (suggestion) {
					lines.push(`  suggestion: ${suggestion}`);
				}
			}
		}
		for (const w of nestedCodeblockWarnings) {
			lines.push(`- Line ${w.line}: ${w.message}`);
		}
		lines.push("");
	}

	if (result.summary.errors > 0) {
		// Errors → FAILED (exit 1)
		const parts = [
			`${result.summary.errors} ${result.summary.errors === 1 ? "error" : "errors"}`,
		];
		if (totalWarnings > 0) {
			parts.push(
				`${totalWarnings} ${totalWarnings === 1 ? "warning" : "warnings"}`,
			);
		}
		lines.push(`FAILED: ${parts.join(", ")}`);
	} else if (totalWarnings > 0) {
		// Warnings only → OK with note (exit 0, preserves exit code contract)
		lines.push(
			`OK: ${result.summary.total} citations valid (${totalWarnings} ${totalWarnings === 1 ? "warning" : "warnings"})`,
		);
	} else {
		lines.push(`OK: ${result.summary.total} citations valid`);
	}

	return lines.join("\n");
}

function renderDuplicatePathSuggestion(
	details: DuplicatePathSuggestion,
	verbose: boolean,
): string {
	const candidates = verbose ? details.candidates : details.candidates.slice(0, 5);
	const candidateLines = candidates
		.map((candidate) => `  ${candidate}`)
		.join("\n");
	const omitted = details.total - candidates.length;
	const omittedLine =
		!verbose && omitted > 0
			? `\n  ... ${omitted} more matches; use --verbose to show all or --scope to narrow`
			: "";
	return `'${details.filename}' matched ${details.total} files; closest matches:\n${candidateLines}${omittedLine} ${details.debugInfo}`;
}

function renderValidationSuggestion(
	validation: ValidationMetadata,
	verbose: boolean,
): string | undefined {
	if (validation.status === "valid") return undefined;
	if (validation.duplicatePathSuggestion !== undefined) {
		return renderDuplicatePathSuggestion(
			validation.duplicatePathSuggestion,
			verbose,
		);
	}
	return validation.suggestion;
}

/**
 * Format validation results as JSON.
 *
 * @param result - Result object to format
 * @param verbose - Include every ranked duplicate-path candidate
 * @returns JSON string representation
 */
export function formatAsJSON(
	result: ValidationResult,
	verbose = false,
): string {
	const links = result.links.map((link) => {
		if (
			link.validation.status === "valid" ||
			link.validation.duplicatePathSuggestion === undefined
		) {
			return link;
		}

		const validation = {
			...link.validation,
			suggestion: renderDuplicatePathSuggestion(
				link.validation.duplicatePathSuggestion,
				verbose,
			),
		};
		delete validation.duplicatePathSuggestion;
		return { ...link, validation };
	});
	return JSON.stringify({ ...result, links }, null, 2);
}
