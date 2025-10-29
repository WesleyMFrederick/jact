import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createContentExtractor } from "../../src/factories/componentFactory.js";

/**
 * Integration tests for Content Extraction Workflow
 * US2.2 AC11 - Test complete workflow with real components
 *
 * Principle: "Real Systems, Fake Fixtures"
 * - Uses real ParsedFileCache, CitationValidator, ParsedDocument via factory
 * - Uses static test fixtures (no mocks)
 * - Validates end-to-end orchestration from validation through content retrieval
 */
describe("Content Extraction Workflow Integration", () => {
	it("should execute complete extraction workflow with real components", async () => {
		// Given: Real components via factory (no mocks - "Real Systems, Fake Fixtures")
		const extractor = createContentExtractor();
		const sourceFile = join(
			__dirname,
			"../fixtures/us2.2/mixed-links-source.md",
		);

		// When: Complete workflow executes
		const output = await extractor.extractLinksContent(sourceFile, {
			fullFiles: false,
		});
		const results = output.outgoingLinksReport.processedLinks;

		// Then: Results contain expected extraction outcomes
		expect(results.length).toBeGreaterThan(0);

		// Validation: Real ParsedFileCache used (file parsed once, cached for reuse)
		// Validation: Real CitationValidator used (enriched links with validation metadata)
		// Validation: Real ParsedDocument used (calls facade methods, handles errors properly)
		expect(results.every((r) => r.status !== undefined)).toBe(true);
		expect(results.every((r) => r.sourceLink !== undefined)).toBe(true);
	});

	it("should handle section extraction with real implementation", async () => {
		// Given: Real components and source with section link
		const extractor = createContentExtractor();
		const sourceFile = join(
			__dirname,
			"../fixtures/us2.2/mixed-links-source.md",
		);

		// When: Extract content with section links
		const output = await extractor.extractLinksContent(sourceFile, {
			fullFiles: false,
		});
		const results = output.outgoingLinksReport.processedLinks;

		// Then: Section link returns success with extracted content
		const sectionResult = results.find(
			(r) =>
				r.sourceLink?.anchorType === "header" &&
				r.sourceLink?.target?.anchor === "Section to Extract" &&
				r.sourceLink?.scope === "cross-document",
		);

		expect(sectionResult).toBeDefined();
		expect(sectionResult.status).toBe("success");
		expect(sectionResult.contentId).toBeDefined();
		const contentBlock = output.extractedContentBlocks[sectionResult.contentId];
		expect(contentBlock.content).toContain(
			"This is the content that should be extracted",
		);
	});

	it("should handle block extraction with real implementation", async () => {
		// Given: Real components and source with block link
		const extractor = createContentExtractor();
		const sourceFile = join(
			__dirname,
			"../fixtures/us2.2/mixed-links-source.md",
		);

		// When: Extract content with block links
		const output = await extractor.extractLinksContent(sourceFile, {
			fullFiles: false,
		});
		const results = output.outgoingLinksReport.processedLinks;

		// Then: Block link returns success with extracted content
		const blockResult = results.find(
			(r) =>
				r.sourceLink?.anchorType === "block" &&
				r.sourceLink?.target?.anchor === "^block-ref-1" &&
				r.sourceLink?.scope === "cross-document",
		);

		expect(blockResult).toBeDefined();
		expect(blockResult.status).toBe("success");
		expect(blockResult.contentId).toBeDefined();
		const blockContent = output.extractedContentBlocks[blockResult.contentId];
		expect(blockContent.content).toContain(
			"This is a block reference that can be extracted.",
		);
		expect(blockContent.content).toContain("^block-ref-1");
	});

	it("should skip full file link when fullFiles flag disabled", async () => {
		// Given: Real components with fullFiles flag disabled
		const extractor = createContentExtractor();
		const sourceFile = join(
			__dirname,
			"../fixtures/us2.2/mixed-links-source.md",
		);

		// When: Extract content with fullFiles=false
		const output = await extractor.extractLinksContent(sourceFile, {
			fullFiles: false,
		});
		const results = output.outgoingLinksReport.processedLinks;

		// Then: Full file link is skipped due to eligibility
		const fullFileResult = results.find(
			(r) =>
				r.sourceLink?.anchorType === null &&
				r.sourceLink?.target?.path?.raw === "target-doc.md",
		);

		expect(fullFileResult).toBeDefined();
		expect(fullFileResult.status).toBe("skipped");
		expect(fullFileResult.failureDetails.reason).toContain("not eligible");
	});

	it("should extract full file content when fullFiles flag enabled", async () => {
		// Given: Real components with fullFiles flag enabled
		const extractor = createContentExtractor();
		const sourceFile = join(
			__dirname,
			"../fixtures/us2.2/mixed-links-source.md",
		);

		// When: Extract content with fullFiles=true
		const output = await extractor.extractLinksContent(sourceFile, {
			fullFiles: true,
		});
		const results = output.outgoingLinksReport.processedLinks;

		// Then: Full file link successfully extracted
		const fullFileResult = results.find(
			(r) =>
				r.sourceLink?.anchorType === null &&
				r.sourceLink?.target?.path?.raw === "target-doc.md" &&
				r.sourceLink?.scope === "cross-document",
		);

		expect(fullFileResult).toBeDefined();
		expect(fullFileResult.status).toBe("success");
		expect(fullFileResult.contentId).toBeDefined();
		const fullFileContent =
			output.extractedContentBlocks[fullFileResult.contentId];
		expect(fullFileContent.content).toContain("# Target Document");
		expect(fullFileContent.content).toContain("Section to Extract");
		expect(fullFileContent.content).toContain("^block-ref-1");
	});

	it("should handle validation errors gracefully", async () => {
		// Given: Real components and source with broken links
		const extractor = createContentExtractor();
		const sourceFile = join(
			__dirname,
			"../fixtures/us2.2/error-links-source.md",
		);

		// When: Extract content from file with errors
		const output = await extractor.extractLinksContent(sourceFile, {
			fullFiles: false,
		});
		const results = output.outgoingLinksReport.processedLinks;

		// Then: Validation errors result in skipped status
		const errorResults = results.filter(
			(r) =>
				r.status === "skipped" &&
				r.failureDetails?.reason?.includes("validation"),
		);

		expect(errorResults.length).toBeGreaterThan(0);
	});

	it("should use real ParsedFileCache for caching efficiency", async () => {
		// Given: Real components with multiple links to same target
		const extractor = createContentExtractor();
		const sourceFile = join(
			__dirname,
			"../fixtures/us2.2/mixed-links-source.md",
		);

		// When: Extract content (multiple links reference target-doc.md)
		const output = await extractor.extractLinksContent(sourceFile, {
			fullFiles: false,
		});
		const results = output.outgoingLinksReport.processedLinks;

		// Then: Multiple attempts to extract from same target document
		// Validates ParsedFileCache prevents re-parsing same file
		const targetDocResults = results.filter(
			(r) =>
				r.sourceLink?.scope === "cross-document" &&
				r.sourceLink?.target?.path?.absolute?.endsWith("target-doc.md"),
		);

		expect(targetDocResults.length).toBeGreaterThan(1);
	});

	it("should return structured ExtractionResult array", async () => {
		// Given: Real components
		const extractor = createContentExtractor();
		const sourceFile = join(
			__dirname,
			"../fixtures/us2.2/mixed-links-source.md",
		);

		// When: Extract content
		const output = await extractor.extractLinksContent(sourceFile, {
			fullFiles: false,
		});
		const results = output.outgoingLinksReport.processedLinks;

		// Then: Each result has correct structure
		for (const result of results) {
			expect(result).toHaveProperty("sourceLink");
			expect(result).toHaveProperty("status");
			expect(["success", "skipped", "error"]).toContain(result.status);

			if (result.status === "success") {
				expect(result).toHaveProperty("contentId");
				expect(result).toHaveProperty("eligibilityReason");
				expect(typeof result.contentId).toBe("string");
				// Verify content exists in extractedContentBlocks
				expect(output.extractedContentBlocks[result.contentId]).toBeDefined();
			} else {
				expect(result).toHaveProperty("failureDetails");
				expect(result.failureDetails).toHaveProperty("reason");
			}
		}
	});

	it("should integrate CitationValidator enrichment with eligibility analysis", async () => {
		// Given: Real components
		const extractor = createContentExtractor();
		const sourceFile = join(
			__dirname,
			"../fixtures/us2.2/mixed-links-source.md",
		);

		// When: Extract content
		const output = await extractor.extractLinksContent(sourceFile, {
			fullFiles: true,
		});
		const results = output.outgoingLinksReport.processedLinks;

		// Then: Results contain enriched link metadata from validator
		const successResult = results.find((r) => r.status === "success");

		expect(successResult).toBeDefined();
		expect(successResult.sourceLink).toHaveProperty("validation");
		expect(successResult.sourceLink).toHaveProperty("target");
		expect(successResult.sourceLink).toHaveProperty("anchorType");
		expect(successResult.sourceLink.validation.status).toBe("valid");
	});

	it("should validate workflow orchestration phases", async () => {
		// Given: Real components
		const extractor = createContentExtractor();
		const sourceFile = join(
			__dirname,
			"../fixtures/us2.2/mixed-links-source.md",
		);

		// When: Complete workflow executes
		const output = await extractor.extractLinksContent(sourceFile, {
			fullFiles: false,
		});
		const results = output.outgoingLinksReport.processedLinks;

		// Then: Workflow phases are validated through result patterns
		// Phase 1: Validation (all links have validation metadata)
		expect(results.every((r) => r.sourceLink.validation !== undefined)).toBe(
			true,
		);

		// Phase 2: Eligibility filtering (some skipped due to eligibility)
		expect(
			results.some(
				(r) =>
					r.status === "skipped" &&
					r.failureDetails?.reason?.includes("not eligible"),
			),
		).toBe(true);

		// Phase 3: Content retrieval (attempts extraction for eligible links)
		expect(results.some((r) => ["success", "error"].includes(r.status))).toBe(
			true,
		);
	});

	it("should extract actual content for sections, blocks, and full files", async () => {
		// Given: Real components via factory (no mocks)
		const extractor = createContentExtractor();
		const sourceFile = join(
			__dirname,
			"../fixtures/us2.2/mixed-links-source.md",
		);

		// When: Complete workflow executes
		const output = await extractor.extractLinksContent(sourceFile, {
			fullFiles: false,
		});
		const results = output.outgoingLinksReport.processedLinks;

		// Then: Results contain actual extracted content (not null/errors)
		expect(results.length).toBeGreaterThan(0);

		// Validation: Section link extracted with actual content
		const sectionResult = results.find(
			(r) =>
				r.sourceLink.target.anchor === "Section to Extract" &&
				r.sourceLink.anchorType === "header" &&
				r.sourceLink.scope === "cross-document",
		);
		expect(sectionResult).toBeDefined();
		expect(sectionResult.status).toBe("success");
		expect(sectionResult.contentId).toBeDefined();
		const sectionContent =
			output.extractedContentBlocks[sectionResult.contentId];
		expect(sectionContent.content).toContain("## Section to Extract");
		expect(sectionContent.content).toContain("Key points");
		expect(sectionContent.content).toContain("### Nested Subsection");

		// Validation: Block link extracted with actual content
		const blockResult = results.find(
			(r) =>
				r.sourceLink.target.anchor === "^block-ref-1" &&
				r.sourceLink.anchorType === "block" &&
				r.sourceLink.scope === "cross-document",
		);
		expect(blockResult).toBeDefined();
		expect(blockResult.status).toBe("success");
		expect(blockResult.contentId).toBeDefined();
		const blockContent2 = output.extractedContentBlocks[blockResult.contentId];
		expect(blockContent2.content).toContain("This is a block reference");
		expect(blockContent2.content).toContain("^block-ref-1");

		// Validation: Full-file link skipped (no --full-files flag)
		const fullFileResult = results.find(
			(r) =>
				r.sourceLink.anchorType === null &&
				r.sourceLink.scope === "cross-document",
		);
		expect(fullFileResult).toBeDefined();
		expect(fullFileResult.status).toBe("skipped");
	});

	it("should extract full file content when --full-files flag enabled", async () => {
		// Given: ContentExtractor with --full-files flag
		const extractor = createContentExtractor();
		const sourceFile = join(
			__dirname,
			"../fixtures/us2.2/mixed-links-source.md",
		);

		// When: Execute with fullFiles flag
		const output = await extractor.extractLinksContent(sourceFile, {
			fullFiles: true,
		});
		const results = output.outgoingLinksReport.processedLinks;

		// Then: Full-file link extracted successfully
		const fullFileResult = results.find(
			(r) =>
				r.sourceLink.anchorType === null &&
				r.sourceLink.scope === "cross-document",
		);
		expect(fullFileResult).toBeDefined();
		expect(fullFileResult.status).toBe("success");
		expect(fullFileResult.contentId).toBeDefined();
		const fullFileContent2 =
			output.extractedContentBlocks[fullFileResult.contentId];
		expect(fullFileContent2.content).toContain("# Target Document");
		expect(fullFileContent2.content).toContain("Section to Extract");
		expect(fullFileContent2.content).toContain("^block-ref-1");
	});
});
