/**
 * Re-export shim — contentExtractorTypes.ts split into three files (issue #28).
 *
 * All types are still importable from this path for backward compatibility,
 * but canonical locations are:
 *   - cli-types.ts        : CliFlags, CliValidateOptions, CliExtractOptions,
 *                           FormattedValidationResult, FixDetail
 *   - extraction-types.ts : EligibilityDecision, ExtractedContentBlock,
 *                           ProcessedLinkEntry, OutgoingLinksReport,
 *                           ExtractionStats, OutgoingLinksExtractedContent,
 *                           SourceLinkEntry
 *   - strategy-types.ts   : ExtractionEligibilityStrategy
 */

export type {
	CliExtractOptions,
	CliFlags,
	CliValidateOptions,
	FixDetail,
	FormattedValidationResult,
} from "./cli-types.js";

export type {
	EligibilityDecision,
	ExtractedContentBlock,
	ExtractionStats,
	OutgoingLinksExtractedContent,
	OutgoingLinksReport,
	ProcessedLinkEntry,
	SourceLinkEntry,
} from "./extraction-types.js";

export type { ExtractionEligibilityStrategy } from "./strategy-types.js";
