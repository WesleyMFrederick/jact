/**
 * Extraction result and eligibility types.
 */

import type { EnrichedLinkObject } from "./validationTypes.js";

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
	/** Processing outcome from the extraction workflow. */
	status: "extracted" | "skipped" | "failed";
	failureDetails?: {
		reason: string;
	};
}

/**
 * Outgoing links report section of extraction output.
 */
export interface OutgoingLinksReport {
	processedLinks: ProcessedLinkEntry[];
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
 * This is the result returned by ContentExtractor.extractContent().
 */
export interface OutgoingLinksExtractedContent {
	extractedContentBlocks: {
		_totalContentCharacterLength: number;
		[contentId: string]: ExtractedContentBlock | number;
	};
	outgoingLinksReport: OutgoingLinksReport;
	stats: ExtractionStats;
}
