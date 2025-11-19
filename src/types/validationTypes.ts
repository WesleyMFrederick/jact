// src/types/validationTypes.ts
import type { LinkObject, ValidationStatus } from "./citationTypes.js";

/**
 * Validation result for single citation.
 * Integration: Returned by CitationValidator for each link.
 */
export interface CitationValidationResult {
	/** Link object with validation enrichment */
	link: LinkObject;

	/** Validation outcome */
	status: ValidationStatus;

	/** Human-readable message */
	message: string;

	/** Suggested corrections */
	suggestions: string[];
}

/**
 * File validation summary.
 * Integration: Top-level result from validateFile.
 */
export interface FileValidationSummary {
	/** Source file path */
	filePath: string;

	/** Total citation count */
	totalCitations: number;

	/** Valid citation count */
	validCount: number;

	/** Warning citation count */
	warningCount: number;

	/** Error citation count */
	errorCount: number;

	/** Individual validation results */
	results: CitationValidationResult[];
}

/**
 * File cache resolution result.
 * Pattern: Discriminated union with found/notFound states.
 *
 * Decision: Separate states prevent null path access errors.
 */
export type ResolutionResult =
	| {
			found: true;
			path: string;
			reason: "direct" | "cache";
	  }
	| {
			found: false;
			path: null;
			reason: "not_found" | "duplicate";
			candidates?: string[];
	  };
