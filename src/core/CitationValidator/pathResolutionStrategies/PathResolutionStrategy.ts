/**
 * PathResolutionStrategy — interface for cross-document path resolution.
 *
 * Pattern: Strategy (mirrors eligibilityStrategies in ContentExtractor).
 * Each strategy returns a result or null to fall through to the next strategy.
 *
 * Extracted from CitationValidator.validateCrossDocumentLink (issue #28).
 */

import type { LinkObject } from "../../../types/citationTypes.js";
import type { PathConversion } from "../../../types/validationTypes.js";
import type { AnchorMatcher } from "../AnchorMatcher.js";
import type { FileCacheLike, PathResolver } from "../PathResolver.js";

// ── Shared result shape (matches SingleCitationValidationResult in CitationValidator) ──

export interface PathResolutionResult {
	line: number;
	citation: string;
	status: "valid" | "error" | "warning";
	linkType: string;
	scope: string;
	error?: string;
	suggestion?: string;
	pathConversion?: PathConversion;
}

// ── Context passed to every strategy ──────────────────────────────────────────

export interface PathResolutionContext {
	citation: LinkObject;
	sourceFile: string;
	targetPath: string;
	standardPath: string;
	pathResolver: PathResolver;
	anchorMatcher: AnchorMatcher;
	fileCache: FileCacheLike;
}

// ── Strategy interface ─────────────────────────────────────────────────────────

/**
 * Strategy interface for path resolution.
 * Returns PathResolutionResult when the strategy matches, null to pass through.
 */
export interface PathResolutionStrategy {
	resolve(ctx: PathResolutionContext): Promise<PathResolutionResult | null>;
}
