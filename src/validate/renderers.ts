/**
 * Renderers for `jact validate` batch output.
 *
 * Two output modes over the same `BatchSummary` (R3, 004 `--json` line
 * contract, 005 human/`--json` output): a human-readable renderer with
 * `✅`/`❌` lines plus a summary, and a `--json` renderer that emits one
 * compact JSONL object per file for CI/agent consumption.
 */

import type { BatchSummary, FileResult } from "../types/cli-types.js";

/**
 * Render a `BatchSummary` as human-readable text (005 "Output — human
 * (default)"): one `✅ <path>` / `❌ <path>` line per file, indented error
 * lines under failures, then a `--- N files · P passed · F failed` summary.
 *
 * @param summary Aggregate batch result.
 * @returns Multi-line string, no trailing newline.
 */
export function renderHuman(summary: BatchSummary): string {
  const lines: string[] = [];

  for (const result of summary.results) {
    lines.push(renderFileLine(result));
    for (const error of result.errors) {
      lines.push(renderErrorLine(error));
    }
  }

  lines.push("---");
  lines.push(`${summary.total} files · ${summary.passed} passed · ${summary.failed} failed`);

  return lines.join("\n");
}

/** Render one file's status line: `✅ <path>` or `❌ <path>`. */
function renderFileLine(result: FileResult): string {
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
