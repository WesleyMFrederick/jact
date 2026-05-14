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
	verbose?: boolean;
	allowGitignore?: boolean;
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
