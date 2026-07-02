/**
 * ValidationTypes - CitationValidator output contracts
 *
 * Enrichment pattern: CitationValidator.validateSingleCitation returns a new
 * EnrichedLinkObject via enrichLinkObject factory (object spread). The original
 * LinkObject is never mutated. See issue #37.
 *
 * Reference: CitationValidator Component Guide - Output Contract
 */

import type { LinkObject } from "./citationTypes.js";

/**
 * LinkClass - display-layer discriminator (per D3).
 *
 * Separate from `LinkObject.linkType` so display/reporting can distinguish
 * caret-block markdown citations from header markdown citations without
 * mutating the syntactic linkType field.
 */
export type LinkClass = "markdown" | "wiki" | "caret";

/**
 * PathConversion metadata for path auto-fix suggestions
 * Used when validator detects path resolution issues
 */
export interface PathConversion {
	type: "path-conversion";
	original: string;
	recommended: string;
}

/**
 * AnchorConversion metadata for anchor auto-fix suggestions
 * Used when validator detects an anchor resolution issue (missing anchor with
 * a fuzzy-matched replacement, or a kebab-case anchor with a raw-header
 * replacement). Mirrors PathConversion so anchor fixes carry structured
 * {original, recommended} data instead of `citationFixer` regex-parsing the
 * human-readable `suggestion` string back into a fix (issue: anchor
 * suggestion-string round-trip).
 */
export interface AnchorConversion {
	type: "anchor-conversion";
	original: string;
	recommended: string;
}

/**
 * ValidationMetadata - Discriminated union based on status
 *
 * Valid state: No additional fields
 * Error/Warning states: Include error message, optional suggestion, optional path/anchor conversion
 */
export type ValidationMetadata =
	| { status: "valid" }
	| {
			status: "error";
			error: string;
			suggestion?: string;
			pathConversion?: PathConversion;
			anchorConversion?: AnchorConversion;
	  }
	| {
			status: "warning";
			message: string;
			suggestion?: string;
			pathConversion?: PathConversion;
			anchorConversion?: AnchorConversion;
	  };

/**
 * EnrichedLinkObject - new object constructed from a LinkObject plus validation
 *
 * ENRICHMENT PATTERN: enrichLinkObject factory creates a new object via
 * object spread: { ...link, validation: meta }. The original LinkObject
 * is never mutated. See issue #37.
 */
export interface EnrichedLinkObject extends LinkObject {
	validation: ValidationMetadata;
}

/**
 * ValidationSummary - Aggregate counts derived from enriched links
 */
export interface ValidationSummary {
	total: number;
	valid: number;
	warnings: number;
	errors: number;
}

/**
 * ValidationResult - CitationValidator.validateFile() return structure
 *
 * CRITICAL: Property names are `summary` and `links` (NOT `results`)
 * This matches the enrichment pattern where links are enriched in-place.
 */
export interface ValidationResult {
	summary: ValidationSummary;
	links: EnrichedLinkObject[];
	validationTime?: string;
}

export interface FixRecord {
	line: number;
	old: string;
	new: string;
	type: string;
}
