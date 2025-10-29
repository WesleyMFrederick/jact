import { analyzeEligibility } from "./analyzeEligibility.js";
import { generateContentId } from "./generateContentId.js";
import { decodeUrlAnchor, normalizeBlockId } from "./normalizeAnchor.js";

/**
 * Extract content from links in source file with deduplication
 * Primary operation orchestrating validation → eligibility → content retrieval → deduplication
 *
 * @param {string} sourceFilePath - Path to source file containing links
 * @param {Object} cliFlags - CLI flags (e.g., { fullFiles: boolean })
 * @param {Object} dependencies - Component dependencies
 * @param {ParsedFileCache} dependencies.parsedFileCache - Cache for parsed documents
 * @param {CitationValidator} dependencies.citationValidator - Validator for citations
 * @param {ExtractionStrategy[]} dependencies.eligibilityStrategies - Strategy chain
 * @returns {Promise<OutgoingLinksExtractedContent>} Deduplicated extraction result with extractedContentBlocks, outgoingLinksReport, stats
 */
export async function extractLinksContent(
	sourceFilePath,
	cliFlags,
	{ parsedFileCache, citationValidator, eligibilityStrategies },
) {
	// PHASE 1: Validation (AC3)
	// Call citationValidator to get enriched links
	const validationResult = await citationValidator.validateFile(sourceFilePath);
	const enrichedLinks = validationResult.links; // Array with validation metadata

	// AC15: Filter out internal links before processing
	const crossDocumentLinks = enrichedLinks.filter(
		(link) => link.scope !== "internal",
	);

	// PHASE 2: Initialize Deduplicated Structure
	// Pattern: Inline deduplication - build indexed structure during extraction
	const deduplicatedOutput = {
		extractedContentBlocks: {}, // contentId → { content, contentLength, contentOrigins[] }
		outgoingLinksReport: {
			processedLinks: [], // Array of { sourceLink, contentId, status, ... }
		},
		stats: {
			totalLinks: 0,
			uniqueContent: 0,
			duplicateContentDetected: 0,
			tokensSaved: 0,
			compressionRatio: 0,
		},
	};

	// PHASE 3: Process each link with deduplication
	for (const link of crossDocumentLinks) {
		deduplicatedOutput.stats.totalLinks++;

		// AC4: Skip validation errors
		if (link.validation.status === "error") {
			deduplicatedOutput.outgoingLinksReport.processedLinks.push({
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
			eligibilityStrategies,
		);
		if (!eligibilityDecision.eligible) {
			deduplicatedOutput.outgoingLinksReport.processedLinks.push({
				sourceLink: link,
				contentId: null,
				status: "skipped",
				failureDetails: {
					reason: `Link not eligible: ${eligibilityDecision.reason}`,
				},
			});
			continue;
		}

		// PHASE 4: Content Retrieval with Deduplication (AC5-AC7)
		try {
			// Determine target document (all links are cross-document after AC15 filter)
			const decodedPath = decodeURIComponent(link.target.path.absolute);
			const targetDoc = await parsedFileCache.resolveParsedFile(decodedPath);

			// Extract content based on anchor type
			let extractedContent;
			if (link.anchorType === "header") {
				// AC5: Section
				const decodedAnchor = decodeUrlAnchor(link.target.anchor);
				// Find the heading level from the target document's headings
				const heading = targetDoc._data.headings.find(
					(h) => h.text === decodedAnchor || h.slug === decodedAnchor,
				);
				if (!heading) {
					throw new Error(`Heading not found: ${decodedAnchor}`);
				}
				extractedContent = targetDoc.extractSection(
					decodedAnchor,
					heading.level,
				);
			} else if (link.anchorType === "block") {
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
			if (!(contentId in deduplicatedOutput.extractedContentBlocks)) {
				// Decision: First occurrence - create new index entry
				deduplicatedOutput.extractedContentBlocks[contentId] = {
					content: extractedContent,
					contentLength: extractedContent.length,
					contentOrigins: [], // Will track all sources for this content
				};
				deduplicatedOutput.stats.uniqueContent++;
			} else {
				// Decision: Duplicate detected - track for statistics
				deduplicatedOutput.stats.duplicateContentDetected++;
				deduplicatedOutput.stats.tokensSaved += extractedContent.length;
			}

			// Pattern: Always add source location to contentOrigins array
			deduplicatedOutput.extractedContentBlocks[contentId].contentOrigins.push({
				targetPath: link.target.path.absolute,
				targetAnchor: link.target.anchor,
				targetAnchorType: link.anchorType,
			});

			// Pattern: Add processed link with content ID reference
			deduplicatedOutput.outgoingLinksReport.processedLinks.push({
				sourceLink: link,
				contentId: contentId,
				status: "success",
				eligibilityReason: eligibilityDecision.reason,
			});
		} catch (error) {
			// AC8: Error result
			deduplicatedOutput.outgoingLinksReport.processedLinks.push({
				sourceLink: link,
				contentId: null,
				status: "error",
				failureDetails: { reason: `Extraction failed: ${error.message}` },
			});
		}
	}

	// PHASE 5: Calculate Final Statistics
	// Pattern: Compression ratio = saved / (total + saved)
	const totalContentSize = Object.values(
		deduplicatedOutput.extractedContentBlocks,
	).reduce((sum, block) => sum + block.contentLength, 0);
	deduplicatedOutput.stats.compressionRatio =
		totalContentSize + deduplicatedOutput.stats.tokensSaved === 0
			? 0
			: deduplicatedOutput.stats.tokensSaved /
				(totalContentSize + deduplicatedOutput.stats.tokensSaved);

	// Decision: Return deduplicated output as only public contract (AC9)
	return deduplicatedOutput;
}
