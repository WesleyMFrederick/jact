/**
 * Extraction result and eligibility types.
 */

import type ParsedDocument from "../ParsedDocument.js";
import type { HeadingMatch } from "../ParsedDocument.js";
import type { LinkObject } from "./citationTypes.js";
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
	/** One-based source line containing the first character of content. */
	startLine?: number;
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

export interface ExtractionRunOptions {
	includeInternal?: boolean;
}

export interface ResolvedSection {
	content: string;
	startLine: number;
	endLine: number;
	links: readonly LinkObject[];
}

export interface LinkedHeaderContextInput {
	rootDocument: ParsedDocument;
	rootHeading: HeadingMatch;
	scopePath: string;
	scopeFiles: readonly string[];
	respectGitignore: boolean;
	/** Link depth to follow from the root section (≥ 1). */
	depth: number;
}

export interface LinkedContextSourcePosition {
	file: string;
	line: number;
	column: number;
	raw: string;
}

export interface LinkedContentSource {
	file: string;
	kind: "header" | "block" | "file";
	heading?: string;
	blockId?: string;
	startLine: number;
	endLine: number;
}

export interface LinkedExtractedContentBlock extends ExtractedContentBlock {
	source: LinkedContentSource;
}

export interface LinkedContextTarget {
	file: string;
	kind: "header" | "block" | "file";
	heading?: string;
	blockId?: string;
}

export interface LinkedContextOutgoingLink {
	source: LinkedContextSourcePosition;
	target?: LinkedContextTarget;
	status: "extracted" | "deduplicated" | "not-followed" | "failed";
	contentId?: string;
	reason?: string;
}

export interface LinkedContextBacklink {
	source: LinkedContextSourcePosition;
	target: LinkedContextTarget;
}

export interface LinkedContextFailure {
	source?: LinkedContextSourcePosition;
	reason: string;
}

export interface LinkedHeaderContextResult {
	mode: "linked-context";
	complete: boolean;
	/** Link depth followed from the root section. */
	depth: number;
	/** Linked files whose own links would add content at the next depth. */
	unfollowedDeeperFiles: number;
	scope: {
		path: string;
		filesScanned: number;
		respectGitignore: boolean;
	};
	root: {
		contentId: string;
		source: LinkedContentSource;
	};
	extractedContentBlocks: {
		_totalContentCharacterLength: number;
		[contentId: string]: LinkedExtractedContentBlock | number;
	};
	outgoingLinks: LinkedContextOutgoingLink[];
	backlinks: LinkedContextBacklink[];
	failures: LinkedContextFailure[];
	stats: {
		directLinks: number;
		uniqueLinkedContent: number;
		backlinks: number;
	};
}

export type HeaderExtractionResult =
	| OutgoingLinksExtractedContent
	| LinkedHeaderContextResult;
