/**
 * CLI-facing types for jact commands.
 *
 * Split from contentExtractorTypes.ts (issue #28).
 */

import type { ValidationResult } from "./validationTypes.js";

/**
 * CLI flags affecting content extraction behavior.
 * Integration: Passed to ContentExtractor and strategy chain.
 */
export interface CliFlags {
	/** Extract full file content instead of sections */
	fullFiles?: boolean;
}

/**
 * CLI validate command options.
 * Integration: Passed to JactCli.validate() and .fix() methods.
 */
export interface CliValidateOptions {
	format?: "cli" | "json";
	lines?: string;
	scope?: string;
	fix?: boolean;
	/** When true, preview fixes without writing files. Prints a diff to stdout. Requires fix: true. */
	dryRun?: boolean;
	verbose?: boolean;
	allowGitignore?: boolean;
	/** Read markdown from stdin instead of <file-path>; <file-path> becomes the intended path (D1/D2). */
	stdin?: boolean;
}

/**
 * CLI extract command options.
 * Integration: Passed to JactCli.extractLinks/Header/File methods.
 */
export interface CliExtractOptions {
	scope?: string;
	format?: "markdown" | "json";
	fullFiles?: boolean;
	session?: string;
	verbose?: boolean;
}

/**
 * Validation result enriched with CLI-specific metadata.
 * Pattern: Extends ValidationResult with timing and filter info.
 */
export interface FormattedValidationResult extends ValidationResult {
	/** Time taken for validation (e.g., "0.5s") */
	validationTime: string;
	/** Line range filter applied (e.g., "150-160") */
	lineRange?: string;
	/** File path of validated file */
	file?: string;
}

/**
 * Individual fix detail for the fix report.
 * Pattern: Tracks each change applied during auto-fix.
 */
export interface FixDetail {
	line: number;
	old: string;
	new: string;
	type: "path" | "anchor" | "path+anchor";
}

/**
 * Options for one batch `validate` invocation, parsed from argv.
 *
 * @property paths   Explicit file paths and/or glob patterns (tinyglobby syntax).
 * @property changed `--changed`: union git working-tree-modified `.md` into the
 * selection (adds, never shrinks). See ADR D2.
 * @property json    `--json`: emit one compact JSON object per file (JSONL). See ADR D3.
 */
export interface BatchValidateOptions {
  paths: string[];
  changed: boolean;
  json: boolean;
}

/**
 * Result for a single validated file.
 *
 * @property path   Absolute or repo-relative file path (as selected).
 * @property ok     true iff the file's ValidationResult had zero errors
 * (`summary.errors === 0`).
 * @property errors Empty when `ok`; one entry per error otherwise.
 */
export interface FileResult {
  path: string;
  ok: boolean;
  errors: ValidationError[];
}

/**
 * One validation error within a file.
 *
 * GOTCHA — `line` is `number | null`, NOT optional (`line?`). Under jact's
 * `exactOptionalPropertyTypes`, an absent key and an explicit `null` are distinct
 * types. The JSONL contract always emits the `line` key, so a file-level error
 * (not tied to a line) is an explicit `null`, never a missing field.
 */
export interface ValidationError {
  line: number | null; // 1-indexed; null = file-level, not tied to a line
  message: string;
}

/**
 * Aggregate over one batch run. Drives the process exit code.
 *
 * Exit code (ADR D4/D5): system or usage error → 2; else `failed > 0` → 1; else 0.
 *
 * @property total   Files validated.
 * @property passed  Count with `ok === true`.
 * @property failed  Count with `ok === false`.
 * @property results Per-file results, in selection order.
 */
export interface BatchSummary {
  total: number;
  passed: number;
  failed: number;
  results: FileResult[];
}
