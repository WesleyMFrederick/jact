import { analyzeEligibility } from "./analyzeEligibility.js";
import { normalizeBlockId, decodeUrlAnchor } from "./normalizeAnchor.js";

/**
 * Extract content from links in source file
 * Primary operation orchestrating validation → eligibility → content retrieval
 *
 * @param {string} sourceFilePath - Path to source file containing links
 * @param {Object} cliFlags - CLI flags (e.g., { fullFiles: boolean })
 * @param {Object} dependencies - Component dependencies
 * @param {ParsedFileCache} dependencies.parsedFileCache - Cache for parsed documents
 * @param {CitationValidator} dependencies.citationValidator - Validator for citations
 * @param {ExtractionStrategy[]} dependencies.eligibilityStrategies - Strategy chain
 * @returns {Promise<ExtractionResult[]>} Array of extraction results
 */
export async function extractLinksContent(
	sourceFilePath,
	cliFlags,
	{ parsedFileCache, citationValidator, eligibilityStrategies },
) {
	// PHASE 1: Validation (AC3)
	// Call citationValidator to get enriched links
	const validationResult =
		await citationValidator.validateFile(sourceFilePath);
	const enrichedLinks = validationResult.links; // Array with validation metadata

	// AC15: Filter out internal links before processing
	const crossDocumentLinks = enrichedLinks.filter(
		(link) => link.scope !== "internal",
	);

	// PHASE 2: Process each link
	const results = [];
	for (const link of crossDocumentLinks) {
		// AC4: Skip validation errors
		if (link.validation.status === "error") {
			results.push({
				sourceLink: link,
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
			results.push({
				sourceLink: link,
				status: "skipped",
				failureDetails: {
					reason: `Link not eligible: ${eligibilityDecision.reason}`,
				},
			});
			continue;
		}

		// PHASE 3: Content Retrieval (AC5-AC7)
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
				const heading = targetDoc._data.headings.find(h =>
					h.text === decodedAnchor ||
					h.slug === decodedAnchor
				);
				if (!heading) {
					throw new Error(`Heading not found: ${decodedAnchor}`);
				}
				extractedContent = targetDoc.extractSection(decodedAnchor, heading.level);
			} else if (link.anchorType === "block") {
				// AC6: Block
				const normalizedAnchor = normalizeBlockId(link.target.anchor);
				extractedContent = targetDoc.extractBlock(normalizedAnchor);
			} else {
				// AC7: Full file
				extractedContent = targetDoc.extractFullContent();
			}

			// AC8: Success result
			results.push({
				sourceLink: link,
				status: "success",
				successDetails: {
					decisionReason: eligibilityDecision.reason,
					extractedContent: extractedContent,
				},
			});
		} catch (error) {
			// AC8: Error result
			results.push({
				sourceLink: link,
				status: "error",
				failureDetails: { reason: `Extraction failed: ${error.message}` },
			});
		}
	}

	// AC9: Return Promise<ExtractionResult[]>
	return results;
}
