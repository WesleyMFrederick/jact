import type ParsedDocument from "../../ParsedDocument.js";
import type { LinkObject } from "../../types/citationTypes.js";
import type { CliFlags } from "../../types/cli-types.js";
import type {
	EligibilityDecision,
	ExtractedContentBlock,
	ExtractionRunOptions,
	ExtractionStats,
	OutgoingLinksExtractedContent,
	ProcessedLinkEntry,
} from "../../types/extraction-types.js";
import type { ExtractionEligibilityStrategy } from "../../types/strategy-types.js";
import type { EnrichedLinkObject } from "../../types/validationTypes.js";
import { analyzeEligibility } from "./analyzeEligibility.js";
import { generateContentId } from "./generateContentId.js";
import { decodeUrlAnchor, normalizeBlockId } from "./normalizeAnchor.js";

/**
 * Consumer-defined interface for the parsed-document lifecycle dependency.
 */
interface ParsedDocumentLifecycleInterface {
	resolveDocument(source: {
		kind: "file";
		filePath: string;
	}): Promise<ParsedDocumentInterface>;
}

/**
 * Consumer-defined view of the ParsedDocument facade: section, block, and full-file extraction with source lines.
 */
type ParsedDocumentInterface = Pick<
	ParsedDocument,
	| "resolveHeading"
	| "getResolvedSection"
	| "extractBlock"
	| "extractFullContent"
	| "data"
>;

/**
 * Content Extractor component orchestrating extraction eligibility analysis.
 * Component entry point following TitleCase naming convention.
 */
export class ContentExtractor {
	private eligibilityStrategies: ExtractionEligibilityStrategy[];
	private parsedDocuments: ParsedDocumentLifecycleInterface;

	/**
	 * Create ContentExtractor with eligibility strategies and dependencies.
	 */
	constructor(
		eligibilityStrategies: ExtractionEligibilityStrategy[],
		parsedDocuments: ParsedDocumentLifecycleInterface,
	) {
		this.eligibilityStrategies = eligibilityStrategies;
		this.parsedDocuments = parsedDocuments;
	}

	/**
	 * Analyze link eligibility using strategy chain.
	 */
	analyzeEligibility(
		link: LinkObject,
		cliFlags: CliFlags,
	): EligibilityDecision {
		return analyzeEligibility(link, cliFlags, this.eligibilityStrategies);
	}

	/**
	 * Extract content from pre-validated enriched links.
	 * Validation completes before the CLI passes enriched links here.
	 */
	async extractContent(
		enrichedLinks: EnrichedLinkObject[],
		cliFlags: CliFlags,
		runOptions: ExtractionRunOptions = {},
	): Promise<OutgoingLinksExtractedContent> {
		const candidateLinks = runOptions.includeInternal
			? enrichedLinks
			: enrichedLinks.filter((link) => link.scope !== "internal");

		// Initialize Deduplicated Structure
		const extractedContentBlocks: Record<string, ExtractedContentBlock> = {};
		const processedLinks: ProcessedLinkEntry[] = [];
		const stats: ExtractionStats = {
			totalLinks: 0,
			uniqueContent: 0,
			duplicateContentDetected: 0,
			tokensSaved: 0,
			compressionRatio: 0,
		};

		// Process each link with deduplication
		for (const link of candidateLinks) {
			stats.totalLinks++;

			// AC4: Skip validation errors
			if (link.validation.status === "error") {
				processedLinks.push({
					sourceLink: link,
					contentId: null,
					status: "skipped",
					failureDetails: {
						reason: `Link failed validation: ${link.validation.error}`,
					},
				});
				continue;
			}

			// AC4: Check eligibility using strategy chain
			const eligibilityDecision = analyzeEligibility(
				link,
				cliFlags,
				this.eligibilityStrategies,
			);
			if (!eligibilityDecision.eligible) {
				processedLinks.push({
					sourceLink: link,
					contentId: null,
					status: "skipped",
					failureDetails: {
						reason: `Link not eligible: ${eligibilityDecision.reason}`,
					},
				});
				continue;
			}

			// Content Retrieval with Deduplication (AC5-AC7)
			try {
				if (link.target.path.absolute == null) {
					processedLinks.push({
						sourceLink: link,
						contentId: null,
						status: "skipped",
						failureDetails: {
							reason: "Link has no resolved absolute path",
						},
					});
					continue;
				}
				const decodedPath = decodeURIComponent(link.target.path.absolute);
				const targetDoc = await this.parsedDocuments.resolveDocument({
					kind: "file",
					filePath: decodedPath,
				});

				let extractedContent: string;
				let startLine: number | undefined;
				if (link.anchorType === "header") {
					const decodedAnchor = decodeUrlAnchor(link.target.anchor);
					const resolution = targetDoc.resolveHeading(decodedAnchor ?? "");
					const section =
						resolution.status === "unique"
							? targetDoc.getResolvedSection(resolution.match)
							: null;
					if (!section) {
						throw new Error(`Heading not found: ${decodedAnchor}`);
					}
					extractedContent = section.content;
					startLine = section.startLine;
				} else if (link.anchorType === "block") {
					const blockId = normalizeBlockId(link.target.anchor);
					const blockResult =
						blockId === null ? null : targetDoc.extractBlock(blockId);
					if (!blockResult) {
						throw new Error(`Block not found: ${blockId}`);
					}
					extractedContent = blockResult;
					startLine = targetDoc.data.anchors.find(
						(anchor) => anchor.anchorType === "block" && anchor.id === blockId,
					)?.line;
				} else {
					extractedContent = targetDoc.extractFullContent();
					startLine = 1;
				}

				// Deduplication
				const contentId = generateContentId(extractedContent);
				const contentLength = extractedContent.length;

				if (!extractedContentBlocks[contentId]) {
					extractedContentBlocks[contentId] = {
						content: extractedContent,
						contentLength,
						...(startLine !== undefined && { startLine }),
						sourceLinks: [],
					};
					stats.uniqueContent++;
				} else {
					stats.duplicateContentDetected++;
					stats.tokensSaved += contentLength;
				}

				// Add source link traceability
				const block = extractedContentBlocks[contentId];
				if (!block) throw new Error(`Missing content block: ${contentId}`);
				block.sourceLinks = block.sourceLinks || [];
				block.sourceLinks.push({
					rawSourceLink: link.fullMatch,
					sourceLine: link.line,
				});

				processedLinks.push({
					sourceLink: link,
					contentId,
					status: "extracted",
				});
			} catch (error) {
				processedLinks.push({
					sourceLink: link,
					contentId: null,
					status: "failed",
					failureDetails: {
						reason: (error as Error).message,
					},
				});
			}
		}

		// Calculate compression ratio
		if (stats.totalLinks > 0) {
			const totalPotentialTokens =
				(stats.uniqueContent + stats.duplicateContentDetected) *
				(stats.tokensSaved / Math.max(stats.duplicateContentDetected, 1));
			const actualTokens =
				stats.uniqueContent *
				(stats.tokensSaved / Math.max(stats.duplicateContentDetected, 1));
			stats.compressionRatio =
				stats.duplicateContentDetected > 0
					? (1 - actualTokens / totalPotentialTokens) * 100
					: 0;
		}

		// Add JSON size metadata
		const jsonSize = JSON.stringify(extractedContentBlocks).length;

		return {
			extractedContentBlocks: {
				_totalContentCharacterLength: jsonSize,
				...extractedContentBlocks,
			},
			outgoingLinksReport: {
				processedLinks,
			},
			stats,
		} as OutgoingLinksExtractedContent;
	}
}
