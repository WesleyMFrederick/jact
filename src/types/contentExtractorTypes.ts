import type { LinkObject } from './citationTypes.js';

/**
 * CLI flags affecting content extraction behavior.
 * Integration: Passed to ContentExtractor and strategy chain.
 *
 * Pattern: Expand during implementation as flags discovered.
 */
export interface CliFlags {
	/** Extract full file content instead of sections */
	fullFiles?: boolean;
	// Additional flags added during component conversion as needed
}

/**
 * Strategy interface for extraction eligibility evaluation.
 * Integration: Implemented by 5 strategy classes in ContentExtractor eligibility chain.
 *
 * Pattern: Strategy pattern with null return indicating "pass to next strategy".
 */
export interface ExtractionEligibilityStrategy {
	/**
	 * Evaluate whether a link is eligible for content extraction.
	 *
	 * @param link - Link object to evaluate
	 * @param cliFlags - CLI flags affecting eligibility (e.g., fullFiles)
	 * @returns Decision object if strategy applies, null to pass to next strategy
	 */
	getDecision(
		link: LinkObject,
		cliFlags: CliFlags
	): { eligible: boolean; reason: string } | null;
}

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
