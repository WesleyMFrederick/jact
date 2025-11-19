/**
 * Eligibility analysis result from strategy chain.
 * Integration: Used by analyzeEligibility and strategy implementations.
 */
export interface EligibilityAnalysis {
	/** Whether link is eligible for content extraction */
	eligible: boolean;

	/** Human-readable reason for decision */
	reason: string;

	/** Strategy class name that made decision */
	strategy: string;
}

/**
 * Extracted content block with metadata.
 * Integration: Created by ContentExtractor, consumed by extract commands.
 */
export interface ExtractedContent {
	/** SHA-256 hash prefix for content deduplication */
	contentId: string;

	/** Extracted markdown content */
	content: string;

	/** Source links that reference this content */
	sourceLinks: Array<{
		rawSourceLink: string;
		sourceLine: number;
	}>;
}

/**
 * Complete extraction result with all content blocks.
 * Integration: Top-level result from extractLinksContent.
 */
export interface OutgoingLinksExtractedContent {
	/** All extracted content blocks (deduplicated by contentId) */
	extractedContentBlocks: Record<string, ExtractedContent>;

	/** Total character length across all content */
	_totalContentCharacterLength: number;
}
