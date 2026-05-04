/**
 * ValidationTypes - CitationValidator output contracts
 *
 * CRITICAL: These types match the enrichment pattern where LinkObjects
 * get a `validation` property added in-place. DO NOT create wrapper objects.
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
 * ValidationMetadata - Discriminated union based on status
 *
 * Valid state: No additional fields
 * Error/Warning states: Include error message, optional suggestion, optional path conversion
 */
export type ValidationMetadata =
	| { status: "valid" }
	| {
			status: "error";
			error: string;
			suggestion?: string;
			pathConversion?: PathConversion;
	  }
	| {
			status: "warning";
			error: string;
			suggestion?: string;
			pathConversion?: PathConversion;
	  };

/**
 * EnrichedLinkObject - LinkObject with validation property added in-place
 *
 * ENRICHMENT PATTERN: CitationValidator adds `validation` property to
 * existing LinkObjects from parser. No wrapper objects created.
 */
export interface EnrichedLinkObject extends LinkObject {
	validation: ValidationMetadata;
}

/**
 * UnrecognizedSyntaxRecord - residual-bracket scanner output (per D2)
 *
 * Emitted by extractLinks for any `[[...]]` sequence that the consolidated
 * wikilink grammar did not consume. Closes CI-03 (Critical) — no fail-fast
 * on unrecognized wiki — by surfacing residual brackets to the validator.
 */
export interface UnrecognizedSyntaxRecord {
	/** 1-based line number where residual bracket sequence begins */
	line: number;
	/** 0-based column where residual bracket sequence begins */
	column: number;
	/** Matched bracket sequence text */
	rawText: string;
	/** Syntax family — reserved for future families (e.g., "footnote") */
	syntaxFamily: "wiki";
}

/**
 * ValidationSummary - Aggregate counts derived from enriched links
 */
export interface ValidationSummary {
	total: number;
	valid: number;
	warnings: number;
	/** Derived: brokenLinks + unrecognized (per GAP-5) */
	errors: number;
	/** Per-class counts (per D3) */
	byLinkClass: Record<LinkClass, number>;
	/** Count of UnrecognizedSyntaxRecord emissions (per D3) */
	unrecognizedCount: number;
	/** Error subtotals (per D3 (e), GAP-5) */
	errorBreakdown: {
		brokenLinks: number;
		unrecognized: number;
	};
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
	/** Residual `[[...]]` sequences not consumed by D1 grammar (per D2) */
	unrecognized: UnrecognizedSyntaxRecord[];
	validationTime?: string;
}
