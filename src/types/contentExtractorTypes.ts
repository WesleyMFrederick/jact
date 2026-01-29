import type { LinkObject } from './citationTypes.js';
import type { EnrichedLinkObject, ValidationResult } from './validationTypes.js';

/**
 * CLI flags affecting content extraction behavior.
 * Integration: Passed to ContentExtractor and strategy chain.
 */
export interface CliFlags {
	/** Extract full file content instead of sections */
	fullFiles?: boolean;
}

/**
 * Strategy interface for extraction eligibility evaluation.
 * Pattern: Strategy pattern with null return indicating "pass to next strategy".
 */
export interface ExtractionEligibilityStrategy {
	getDecision(
		link: LinkObject,
		cliFlags: CliFlags
	): { eligible: boolean; reason: string } | null;
}

/**
 * Eligibility decision returned by strategy chain.
 */
export interface EligibilityDecision {
	eligible: boolean;
	reason: string;
}

/**
 * Source link traceability entry within a content block.
 */
export interface SourceLinkEntry {
	rawSourceLink: string;
	sourceLine: number;
}

/**
 * Single extracted content block with deduplication metadata.
 * Keyed by SHA-256 content hash in extractedContentBlocks.
 */
export interface ExtractedContentBlock {
	content: string;
	contentLength: number;
	sourceLinks?: SourceLinkEntry[];
}

/**
 * Processed link entry in the outgoing links report.
 * Each link gets one entry regardless of extraction outcome.
 */
export interface ProcessedLinkEntry {
	sourceLink: EnrichedLinkObject;
	contentId: string | null;
	/**
	 * Processing outcome status.
	 * - extractLinksContent path: "skipped" | "success" | "error"
	 * - ContentExtractor.extractContent path: "skipped" | "extracted" | "failed"
	 */
	status: "extracted" | "skipped" | "success" | "error" | "failed";
	eligibilityReason?: string;
	failureDetails?: {
		reason: string;
	};
}

/**
 * Outgoing links report section of extraction output.
 */
export interface OutgoingLinksReport {
	processedLinks: ProcessedLinkEntry[];
	sourceFilePath?: string;
}

/**
 * Extraction statistics for deduplication metrics.
 */
export interface ExtractionStats {
	totalLinks: number;
	uniqueContent: number;
	duplicateContentDetected: number;
	tokensSaved: number;
	compressionRatio: number;
}

/**
 * Complete extraction result — the public output contract.
 * Built incrementally during extraction with inline deduplication.
 *
 * CRITICAL: This must match what extractLinksContent.js and
 * ContentExtractor.extractContent() actually return at runtime.
 */
export interface OutgoingLinksExtractedContent {
	extractedContentBlocks: {
		_totalContentCharacterLength: number;
		[contentId: string]: ExtractedContentBlock | number;
	};
	outgoingLinksReport: OutgoingLinksReport;
	stats: ExtractionStats;
}

/**
 * CLI validate command options.
 * Integration: Passed to CitationManager.validate() and .fix() methods.
 */
export interface CliValidateOptions {
	format?: "cli" | "json";
	lines?: string;
	scope?: string;
	fix?: boolean;
}

/**
 * CLI extract command options.
 * Integration: Passed to CitationManager.extractLinks/Header/File methods.
 */
export interface CliExtractOptions {
	scope?: string;
	format?: string;
	fullFiles?: boolean;
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
