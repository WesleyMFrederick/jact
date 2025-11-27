/**
 * ValidationTypes - CitationValidator output contracts
 *
 * CRITICAL: These types match the enrichment pattern where LinkObjects
 * get a `validation` property added in-place. DO NOT create wrapper objects.
 *
 * Reference: CitationValidator Component Guide - Output Contract
 */

import type { LinkObject } from './citationTypes.js';

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
}
