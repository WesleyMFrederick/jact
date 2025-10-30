// tools/citation-manager/src/core/ContentExtractor/ContentExtractor.js
import { analyzeEligibility } from "./analyzeEligibility.js";
import { extractLinksContent as extractLinksContentOp } from "./extractLinksContent.js";

/**
 * Content Extractor component orchestrating extraction eligibility analysis.
 * Component entry point following TitleCase naming convention.
 *
 * US2.1 Scope: Eligibility analysis only
 * US2.2 Scope: Add content retrieval, ParsedFileCache, CitationValidator dependencies
 */
export class ContentExtractor {
	/**
	 * Create ContentExtractor with eligibility strategies and dependencies.
	 *
	 * @param {ExtractionStrategy[]} eligibilityStrategies - Ordered strategy chain
	 * @param {ParsedFileCache} parsedFileCache - Cache for parsed documents
	 * @param {CitationValidator} citationValidator - Validator for citations
	 */
	constructor(eligibilityStrategies, parsedFileCache, citationValidator) {
		this.eligibilityStrategies = eligibilityStrategies;
		this.parsedFileCache = parsedFileCache;
		this.citationValidator = citationValidator;
	}

	/**
	 * Analyze link eligibility using strategy chain.
	 * Public method for determining which links should be extracted.
	 *
	 * @param {LinkObject} link - Link to analyze
	 * @param {Object} cliFlags - CLI flags
	 * @returns {{ eligible: boolean, reason: string }} Eligibility decision
	 */
	analyzeEligibility(link, cliFlags) {
		return analyzeEligibility(link, cliFlags, this.eligibilityStrategies);
	}

	/**
	 * Extract content from links in source file.
	 * Thin wrapper delegating to operation file.
	 *
	 * @param {string} sourceFilePath - Path to source file
	 * @param {Object} cliFlags - CLI flags
	 * @returns {Promise<ExtractionResult[]>} Array of extraction results
	 */
	async extractLinksContent(sourceFilePath, cliFlags) {
		// Delegate to operation function with dependencies
		return await extractLinksContentOp(sourceFilePath, cliFlags, {
			parsedFileCache: this.parsedFileCache,
			citationValidator: this.citationValidator,
			eligibilityStrategies: this.eligibilityStrategies,
		});
	}

	/**
	 * Extract content from pre-validated enriched links.
	 * US2.3 Pattern: CitationManager handles Phase 1 validation, passes enriched links here
	 *
	 * @param {LinkObject[]} enrichedLinks - Pre-validated links with validation metadata
	 * @param {Object} cliFlags - CLI flags (e.g., { fullFiles: boolean })
	 * @returns {Promise<OutgoingLinksExtractedContent>} Deduplicated extraction result
	 */
	async extractContent(enrichedLinks, cliFlags) {
		// Import the extraction logic from extractLinksContent
		// We'll need to refactor to reuse the extraction logic without validation
		const { analyzeEligibility } = await import("./analyzeEligibility.js");
		const { generateContentId } = await import("./generateContentId.js");
		const { decodeUrlAnchor, normalizeBlockId } = await import("./normalizeAnchor.js");

		// AC15: Filter out internal links before processing
		const crossDocumentLinks = enrichedLinks.filter(
			(link) => link.scope !== "internal",
		);

		// Initialize Deduplicated Structure
		const deduplicatedOutput = {
			extractedContentBlocks: {}, // contentId → { content, contentLength }
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

		// Process each link with deduplication
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
				this.eligibilityStrategies,
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

			// Content Retrieval with Deduplication (AC5-AC7)
			try {
				// Determine target document (all links are cross-document after AC15 filter)
				const decodedPath = decodeURIComponent(link.target.path.absolute);
				const targetDoc = await this.parsedFileCache.resolveParsedFile(decodedPath);

				// Extract content based on anchor type
				let extractedContent;
				if (link.anchorType === "header") {
					// AC5: Section
					const decodedAnchor = decodeUrlAnchor(link.target.anchor);
					// extractSection now handles heading lookup internally
					extractedContent = targetDoc.extractSection(decodedAnchor);
					if (!extractedContent) {
						throw new Error(`Heading not found: ${decodedAnchor}`);
					}
				} else if (link.anchorType === "block") {
					// AC6: Block
					const blockId = normalizeBlockId(link.target.anchor);
					extractedContent = targetDoc.extractBlock(blockId);
				} else {
					// AC7: Full file
					extractedContent = targetDoc.extractFullContent();
				}

				// Deduplication: Generate content-based hash
				const contentId = generateContentId(extractedContent);
				const contentLength = extractedContent.length;

				// Check if content already exists in deduplicatedOutput
				if (deduplicatedOutput.extractedContentBlocks[contentId]) {
					// Duplicate detected: increment stats only (contentOrigins redundant)
					deduplicatedOutput.stats.duplicateContentDetected++;
					deduplicatedOutput.stats.tokensSaved += contentLength;
				} else {
					// New unique content: create block
					deduplicatedOutput.extractedContentBlocks[contentId] = {
						content: extractedContent,
						contentLength,
						sourceLinks: [], // Initialize array for tracking all source links
					};
					deduplicatedOutput.stats.uniqueContent++;
				}

				// Add source link traceability to content block (for both new and duplicate content)
				deduplicatedOutput.extractedContentBlocks[contentId].sourceLinks.push({
					rawSourceLink: link.fullMatch,
					sourceLine: link.line,
				});

				// Add to processedLinks report
				deduplicatedOutput.outgoingLinksReport.processedLinks.push({
					sourceLink: link,
					contentId,
					status: "extracted",
				});
			} catch (error) {
				// AC8: Error handling - continue processing remaining links
				deduplicatedOutput.outgoingLinksReport.processedLinks.push({
					sourceLink: link,
					contentId: null,
					status: "failed",
					failureDetails: {
						reason: error.message,
					},
				});
			}
		}

		// Calculate compression ratio
		if (deduplicatedOutput.stats.totalLinks > 0) {
			const totalPotentialTokens =
				(deduplicatedOutput.stats.uniqueContent + deduplicatedOutput.stats.duplicateContentDetected) *
				(deduplicatedOutput.stats.tokensSaved / Math.max(deduplicatedOutput.stats.duplicateContentDetected, 1));
			const actualTokens = deduplicatedOutput.stats.uniqueContent *
				(deduplicatedOutput.stats.tokensSaved / Math.max(deduplicatedOutput.stats.duplicateContentDetected, 1));
			deduplicatedOutput.stats.compressionRatio =
				deduplicatedOutput.stats.duplicateContentDetected > 0
					? (1 - actualTokens / totalPotentialTokens) * 100
					: 0;
		}

		return deduplicatedOutput;
	}
}
