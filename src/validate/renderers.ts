/**
 * Renderers for `jact validate` batch output.
 *
 * Human output preserves complete small reports but collapses high-error
 * batches to a navigable file-level overview. JSONL remains complete for
 * machine consumers.
 */

import type { BatchSummary, FileResult } from "../types/cli-types.js";

const DEFAULT_ERROR_DETAIL_LIMIT = 5;

/**
 * Render a `BatchSummary` as human-readable text.
 *
 * Small reports retain one status line per file and full error details. When
 * the total error count exceeds the default display limit, the report
 * collapses to one line per failing file with its error count and commands for
 * drilling into a file, filtering by line, and applying supported fixes.
 * Verbose output always renders the complete report.
 *
 * @param summary Aggregate batch result.
 * @param verbose Whether to render every file and error.
 * @returns Multi-line string, no trailing newline.
 */
export function renderHuman(summary: BatchSummary, verbose = false): string {
	const errorCount = summary.results.reduce(
		(total, result) => total + result.errors.length,
		0,
	);

	if (!verbose && errorCount > DEFAULT_ERROR_DETAIL_LIMIT) {
		return renderCollapsedHuman(summary, errorCount);
	}

	const lines: string[] = [];

	for (const result of summary.results) {
		lines.push(renderFileLine(result));
		for (const error of result.errors) {
			lines.push(renderErrorLine(error));
		}
	}

	appendSummary(lines, summary);
	return lines.join("\n");
}

/** Render a high-error batch as a navigable file-level overview. */
function renderCollapsedHuman(
	summary: BatchSummary,
	errorCount: number,
): string {
	const lines: string[] = [];

	for (const result of summary.results) {
		if (!result.ok) {
			const noun = result.errors.length === 1 ? "error" : "errors";
			lines.push(`❌ ${result.path} (${result.errors.length} ${noun})`);
		}
	}

	appendSummary(lines, summary);
	lines.push("");
	lines.push(
		`${errorCount} error details hidden because they exceed the default ${DEFAULT_ERROR_DETAIL_LIMIT}-error display limit.`,
	);
	lines.push('To Drill Into a File: run `jact validate "{{path-to-file}}"`');
	lines.push(
		'To Filter Lines: run `jact validate "{{path-to-file}}" --lines "{{start-line}}-{{end-line}}"`',
	);
	lines.push(
		'To Preview Auto-Fix: run `jact validate "{{path-to-file}}" --fix --dry-run --scope "{{scope-folder}}"`',
	);
	lines.push(
		'To Apply Auto-Fix: run `jact validate "{{path-to-file}}" --fix --scope "{{scope-folder}}"`',
	);
	lines.push(
		"To Show Full Batch Errors: rerun the batch command with `--verbose`",
	);
	lines.push("More Validate Options: run `jact validate -h`");
	return lines.join("\n");
}

/** Append the stable batch totals line. */
function appendSummary(lines: string[], summary: BatchSummary): void {
	lines.push("---");
	lines.push(
		`${summary.total} files · ${summary.passed} passed · ${summary.failed} failed · ${summary.skipped} skipped`,
	);
}

/** Render one file's pass, fail, or skipped status line. */
function renderFileLine(result: FileResult): string {
	if (result.skipped) {
		return `SKIPPED: ${result.path} (validation disabled by document directive)`;
	}
	const icon = result.ok ? "✅" : "❌";
	return `${icon} ${result.path}`;
}

/** Render one indented error line under a failing file. */
function renderErrorLine(error: FileResult["errors"][number]): string {
	const location = error.line === null ? "" : `Line ${error.line}: `;
	return `   ${location}${error.message}`;
}

/**
 * Render a `BatchSummary` as `--json` output (004 `--json` line contract,
 * 005 "Output — `--json`"): one compact `{path, ok, errors}` JSON object per
 * line (JSONL), in selection order, no summary line.
 *
 * @param summary Aggregate batch result.
 * @returns Multi-line string, one JSON object per line, no trailing newline.
 */
export function renderJson(summary: BatchSummary): string {
	return summary.results.map((result) => JSON.stringify(result)).join("\n");
}
