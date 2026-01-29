import type { EnrichedLinkObject, ValidationResult } from '../../types/validationTypes.js';
import type {
	CliFlags,
	ExtractionEligibilityStrategy,
	ExtractionStats,
	OutgoingLinksExtractedContent,
	OutgoingLinksReport,
	ProcessedLinkEntry,
	ExtractedContentBlock,
} from '../../types/contentExtractorTypes.js';
import { analyzeEligibility } from './analyzeEligibility.js';
import { generateContentId } from './generateContentId.js';
import { decodeUrlAnchor, normalizeBlockId } from './normalizeAnchor.js';

/**
 * Consumer-defined interface for ParsedFileCache dependency.
 * Only declares the method this operation needs.
 */
interface ParsedFileCacheDep {
	resolveParsedFile(filePath: string): Promise<ParsedDocumentDep>;
}

/**
 * Consumer-defined interface for ParsedDocument facade.
 * Only declares the methods this operation calls.
 */
interface ParsedDocumentDep {
	extractSection(headingText: string): string | null;
	extractBlock(blockId: string | null): string;
	extractFullContent(): string;
}

/**
 * Consumer-defined interface for CitationValidator dependency.
 */
interface CitationValidatorDep {
	validateFile(filePath: string): Promise<ValidationResult>;
}

/**
 * Dependencies for extractLinksContent operation.
 */
interface ExtractLinksContentDeps {
	parsedFileCache: ParsedFileCacheDep;
	citationValidator: CitationValidatorDep;
	eligibilityStrategies: ExtractionEligibilityStrategy[];
}

/**
 * Extract content from links in source file with deduplication.
 * Primary operation orchestrating validation -> eligibility -> content retrieval -> deduplication.
 *
 * @param sourceFilePath - Path to source file containing links
 * @param cliFlags - CLI flags (e.g., { fullFiles: boolean })
 * @param dependencies - Component dependencies
 * @returns Deduplicated extraction result
 */
export async function extractLinksContent(
	sourceFilePath: string,
	cliFlags: CliFlags,
	{ parsedFileCache, citationValidator, eligibilityStrategies }: ExtractLinksContentDeps,
): Promise<OutgoingLinksExtractedContent> {
	// PHASE 1: Validation (AC3)
	// Call citationValidator to get enriched links
	const validationResult: ValidationResult = await citationValidator.validateFile(sourceFilePath);
	const enrichedLinks: EnrichedLinkObject[] = validationResult.links; // Array with validation metadata

	// AC15: Filter out internal links before processing
	const crossDocumentLinks = enrichedLinks.filter(
		(link) => link.scope !== 'internal',
	);

	// PHASE 2: Initialize Deduplicated Structure
	// Pattern: Inline deduplication - build indexed structure during extraction
	const extractedContentBlocks: Record<string, ExtractedContentBlock> = {};
	const processedLinks: ProcessedLinkEntry[] = [];
	const stats: ExtractionStats = {
		totalLinks: 0,
		uniqueContent: 0,
		duplicateContentDetected: 0,
		tokensSaved: 0,
		compressionRatio: 0,
	};

	// PHASE 3: Process each link with deduplication
	for (const link of crossDocumentLinks) {
		stats.totalLinks++;

		// AC4: Skip validation errors
		if (link.validation.status === 'error') {
			processedLinks.push({
				sourceLink: link,
				contentId: null,
				status: 'skipped',
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
			eligibilityStrategies,
		);
		if (!eligibilityDecision.eligible) {
			processedLinks.push({
				sourceLink: link,
				contentId: null,
				status: 'skipped',
				failureDetails: {
					reason: `Link not eligible: ${eligibilityDecision.reason}`,
				},
			});
			continue;
		}

		// PHASE 4: Content Retrieval with Deduplication (AC5-AC7)
		try {
			// Determine target document (all links are cross-document after AC15 filter)
			const decodedPath = decodeURIComponent(link.target.path.absolute as string);
			const targetDoc = await parsedFileCache.resolveParsedFile(decodedPath);

			// Extract content based on anchor type
			let extractedContent: string;
			if (link.anchorType === 'header') {
				// AC5: Section
				const decodedAnchor = decodeUrlAnchor(link.target.anchor);
				// extractSection handles heading level lookup internally (Phase 0)
				const result = targetDoc.extractSection(decodedAnchor ?? '');
				if (!result) {
					throw new Error(`Heading not found: ${decodedAnchor}`);
				}
				extractedContent = result;
			} else if (link.anchorType === 'block') {
				// AC6: Block
				const normalizedAnchor = normalizeBlockId(link.target.anchor);
				extractedContent = targetDoc.extractBlock(normalizedAnchor);
			} else {
				// AC7: Full file
				extractedContent = targetDoc.extractFullContent();
			}

			// --- Deduplication Logic (NEW for US2.2a) ---
			// Integration: Generate content-based hash
			const contentId = generateContentId(extractedContent);

			// Pattern: Check if content already exists in index
			if (!(contentId in extractedContentBlocks)) {
				// Decision: First occurrence - create new index entry
				extractedContentBlocks[contentId] = {
					content: extractedContent,
					contentLength: extractedContent.length,
				};
				stats.uniqueContent++;
			} else {
				// Decision: Duplicate detected - track for statistics
				stats.duplicateContentDetected++;
				stats.tokensSaved += extractedContent.length;
			}

			// Pattern: Add processed link with content ID reference
			processedLinks.push({
				sourceLink: link,
				contentId: contentId,
				status: 'success',
				eligibilityReason: eligibilityDecision.reason,
			});
		} catch (error) {
			// AC8: Error result
			processedLinks.push({
				sourceLink: link,
				contentId: null,
				status: 'error',
				failureDetails: { reason: `Extraction failed: ${(error as Error).message}` },
			});
		}
	}

	// PHASE 5: Calculate Final Statistics
	// Pattern: Compression ratio = saved / (total + saved)
	const totalContentSize = Object.values(
		extractedContentBlocks,
	).reduce((sum, block) => sum + block.contentLength, 0);
	stats.compressionRatio =
		totalContentSize + stats.tokensSaved === 0
			? 0
			: stats.tokensSaved /
				(totalContentSize + stats.tokensSaved);

	// Add JSON size metadata for output length checking (AC3: metadata first for diagnostic visibility)
	const jsonSize = JSON.stringify(
		extractedContentBlocks,
	).length;

	// Decision: Return deduplicated output as only public contract (AC9)
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
