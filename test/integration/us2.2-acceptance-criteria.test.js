// tools/citation-manager/test/integration/us2.2-acceptance-criteria.test.js
import { describe, it, expect } from "vitest";
import { createContentExtractor } from "../../src/factories/componentFactory.js";
import { ContentExtractor } from "../../src/core/ContentExtractor/ContentExtractor.js";
import { ParsedFileCache } from "../../dist/ParsedFileCache.js";
import { CitationValidator } from "../../dist/CitationValidator.js";
import { join } from "node:path";

/**
 * US2.2 Acceptance Criteria Validation Tests
 *
 * Purpose: Validate all AC1-AC12 acceptance criteria with dedicated integration tests.
 * One test per acceptance criteria for traceability.
 *
 * Testing Principle: "Real Systems, Fake Fixtures"
 * - Uses real ParsedFileCache, CitationValidator, ParsedDocument via factory
 * - Uses static test fixtures (no mocks)
 * - Validates end-to-end orchestration
 */
describe("US2.2 Acceptance Criteria Validation", () => {
	it("AC1: should accept parsedFileCache and citationValidator dependencies", () => {
		// Given: Real components via factory
		const extractor = createContentExtractor();

		// Then: Constructor signature and dependency injection validated
		expect(extractor).toBeInstanceOf(ContentExtractor);
		expect(extractor.parsedFileCache).toBeInstanceOf(ParsedFileCache);
		expect(extractor.citationValidator).toBeInstanceOf(CitationValidator);
		expect(extractor.eligibilityStrategies).toBeDefined();
		expect(extractor.eligibilityStrategies.length).toBe(4);
	});

	it("AC2: should provide extractLinksContent public method", async () => {
		// Given: ContentExtractor instance
		const extractor = createContentExtractor();

		// Then: Method exists and returns Promise<OutgoingLinksExtractedContent>
		expect(extractor.extractLinksContent).toBeDefined();
		expect(typeof extractor.extractLinksContent).toBe("function");

		// When: Method is called
		const sourceFile = join(
			__dirname,
			"../fixtures/us2.2/mixed-links-source.md",
		);
		const result = extractor.extractLinksContent(sourceFile, {
			fullFiles: false,
		});

		// Then: Returns Promise
		expect(result).toBeInstanceOf(Promise);

		// Then: Promise resolves to OutgoingLinksExtractedContent object
		const results = await result;
		expect(results).toHaveProperty("extractedContentBlocks");
		expect(results).toHaveProperty("outgoingLinksReport");
		expect(results).toHaveProperty("stats");
	});

	it("AC3: should internally call citationValidator.validateFile", async () => {
		// Given: ContentExtractor with real CitationValidator
		const extractor = createContentExtractor();
		const sourceFile = join(
			__dirname,
			"../fixtures/us2.2/mixed-links-source.md",
		);

		// When: extractLinksContent is called
		const output = await extractor.extractLinksContent(sourceFile, {
			fullFiles: false,
		});
		const results = output.outgoingLinksReport.processedLinks;

		// Then: Results contain enriched links with validation metadata
		expect(results.length).toBeGreaterThan(0);
		expect(results.every((r) => r.sourceLink.validation !== undefined)).toBe(
			true,
		);
		expect(results.every((r) => r.sourceLink.target !== undefined)).toBe(true);
		expect(results.every((r) => r.sourceLink.anchorType !== undefined)).toBe(
			true,
		);

		// Validation: CitationValidator was called and enriched links
		const validLinks = results.filter(
			(r) => r.sourceLink.validation.status === "valid",
		);
		expect(validLinks.length).toBeGreaterThan(0);
	});

	it("AC4: should filter out validation errors and ineligible links", async () => {
		// Given: Source file with error links and mixed eligibility
		const extractor = createContentExtractor();
		const sourceFile = join(
			__dirname,
			"../fixtures/us2.2/mixed-links-source.md",
		);

		// When: extractLinksContent is called without fullFiles flag
		const output = await extractor.extractLinksContent(sourceFile, {
			fullFiles: false,
		});
		const results = output.outgoingLinksReport.processedLinks;

		// Then: Links with validation errors are skipped
		const errorLinks = results.filter(
			(r) => r.sourceLink.validation.status === "error",
		);
		for (const errorLink of errorLinks) {
			expect(errorLink.status).toBe("skipped");
			expect(errorLink.failureDetails.reason).toContain("validation");
		}

		// Then: Ineligible links are skipped (full file link without flag)
		const fullFileLink = results.find(
			(r) =>
				r.sourceLink.anchorType === null &&
				r.sourceLink.target?.path?.raw === "target-doc.md",
		);
		expect(fullFileLink).toBeDefined();
		expect(fullFileLink.status).toBe("skipped");
		expect(fullFileLink.failureDetails.reason).toContain("not eligible");
	});

	it("AC5: should extract section content with URL-decoded anchor", async () => {
		// Given: Source file with section link (URL-encoded anchor)
		const extractor = createContentExtractor();
		const sourceFile = join(
			__dirname,
			"../fixtures/us2.2/mixed-links-source.md",
		);

		// When: extractLinksContent is called
		const output = await extractor.extractLinksContent(sourceFile, {
			fullFiles: false,
		});
		const results = output.outgoingLinksReport.processedLinks;

		// Then: Section link with URL-encoded anchor is processed
		const sectionLink = results.find(
			(r) =>
				r.sourceLink.anchorType === "header" &&
				r.sourceLink.target?.anchor === "Section%20to%20Extract",
		);

		expect(sectionLink).toBeDefined();
		expect(sectionLink.status).toBe("success");
		// Content is now in extractedContentBlocks, verify via contentId
		expect(sectionLink.contentId).toBeDefined();
		const contentBlock = output.extractedContentBlocks[sectionLink.contentId];
		expect(contentBlock.content).toContain("This is the content");
	});

	it("AC6: should extract block content with normalized anchor", async () => {
		// Given: Source file with block link (anchor with '^' prefix)
		const extractor = createContentExtractor();
		const sourceFile = join(
			__dirname,
			"../fixtures/us2.2/mixed-links-source.md",
		);

		// When: extractLinksContent is called
		const output = await extractor.extractLinksContent(sourceFile, {
			fullFiles: false,
		});
		const results = output.outgoingLinksReport.processedLinks;

		// Then: Block link with '^' prefix is processed (normalized internally)
		const blockLink = results.find(
			(r) =>
				r.sourceLink.anchorType === "block" &&
				r.sourceLink.target?.anchor === "^block-ref-1",
		);

		expect(blockLink).toBeDefined();
		expect(blockLink.status).toBe("success");
		// Content is now in extractedContentBlocks, verify via contentId
		expect(blockLink.contentId).toBeDefined();
		const contentBlock = output.extractedContentBlocks[blockLink.contentId];
		expect(contentBlock.content).toContain("This is a block reference");
	});

	it("AC7: should extract full file content", async () => {
		// Given: Source file with full file link
		const extractor = createContentExtractor();
		const sourceFile = join(
			__dirname,
			"../fixtures/us2.2/mixed-links-source.md",
		);

		// When: extractLinksContent is called with fullFiles flag
		const output = await extractor.extractLinksContent(sourceFile, {
			fullFiles: true,
		});
		const results = output.outgoingLinksReport.processedLinks;

		// Then: Full file link successfully extracted
		const fullFileLink = results.find(
			(r) =>
				r.sourceLink.anchorType === null &&
				r.sourceLink.target?.path?.raw === "target-doc.md",
		);

		expect(fullFileLink).toBeDefined();
		expect(fullFileLink.status).toBe("success");
		// Content is now in extractedContentBlocks, verify via contentId
		expect(fullFileLink.contentId).toBeDefined();
		const contentBlock = output.extractedContentBlocks[fullFileLink.contentId];
		expect(contentBlock.content).toContain("Target Document");
		expect(contentBlock.content).toContain("Section to Extract");
	});

	it("AC8: should return ExtractionResult with correct structure", async () => {
		// Given: ContentExtractor with test fixture
		const extractor = createContentExtractor();
		const sourceFile = join(
			__dirname,
			"../fixtures/us2.2/mixed-links-source.md",
		);

		// When: extractLinksContent is called
		const output = await extractor.extractLinksContent(sourceFile, {
			fullFiles: true,
		});
		const results = output.outgoingLinksReport.processedLinks;

		// Then: Each result has correct structure
		for (const result of results) {
			// Every result has sourceLink and status
			expect(result).toHaveProperty("sourceLink");
			expect(result).toHaveProperty("status");
			expect(["success", "skipped", "error"]).toContain(result.status);

			// Success results have contentId and eligibilityReason
			if (result.status === "success") {
				expect(result).toHaveProperty("contentId");
				expect(result).toHaveProperty("eligibilityReason");
				expect(typeof result.contentId).toBe("string");
				// Verify content exists in extractedContentBlocks
				expect(output.extractedContentBlocks[result.contentId]).toBeDefined();
				expect(
					typeof output.extractedContentBlocks[result.contentId].content,
				).toBe("string");
			}

			// Failure results have failureDetails with reason
			if (result.status === "skipped" || result.status === "error") {
				expect(result).toHaveProperty("failureDetails");
				expect(result.failureDetails).toHaveProperty("reason");
				expect(typeof result.failureDetails.reason).toBe("string");
			}
		}
	});

	it("AC9: should return Promise resolving to ExtractionResult array", async () => {
		// Given: ContentExtractor instance
		const extractor = createContentExtractor();
		const sourceFile = join(
			__dirname,
			"../fixtures/us2.2/mixed-links-source.md",
		);

		// When: extractLinksContent is called
		const result = extractor.extractLinksContent(sourceFile, {
			fullFiles: false,
		});

		// Then: Returns Promise
		expect(result).toBeInstanceOf(Promise);

		// Then: Promise resolves to OutgoingLinksExtractedContent object with processedLinks array
		const output = await result;
		expect(output).toHaveProperty("outgoingLinksReport");
		expect(Array.isArray(output.outgoingLinksReport.processedLinks)).toBe(true);
		expect(output.outgoingLinksReport.processedLinks.length).toBeGreaterThan(0);

		// Validate each element is an ExtractionResult
		for (const item of output.outgoingLinksReport.processedLinks) {
			expect(item).toHaveProperty("sourceLink");
			expect(item).toHaveProperty("status");
		}
	});

	it("AC10: should wire dependencies via factory", () => {
		// Given: Factory function is called
		const extractor = createContentExtractor();

		// Then: All dependencies are wired correctly
		expect(extractor.parsedFileCache).toBeInstanceOf(ParsedFileCache);
		expect(extractor.citationValidator).toBeInstanceOf(CitationValidator);
		expect(extractor.eligibilityStrategies).toBeDefined();

		// Validation: Factory supports dependency override for testing
		const mockCache = createContentExtractor(
			new ParsedFileCache(null), // Override parsedFileCache
			null, // Use default citationValidator
			null, // Use default strategies
		);
		expect(mockCache.parsedFileCache).toBeInstanceOf(ParsedFileCache);
	});

	it("AC11: should work with real components (no mocks)", async () => {
		// Given: Real ParsedFileCache, CitationValidator, ParsedDocument integration
		const extractor = createContentExtractor();
		const sourceFile = join(
			__dirname,
			"../fixtures/us2.2/mixed-links-source.md",
		);

		// When: Complete workflow executes with real components
		const output = await extractor.extractLinksContent(sourceFile, {
			fullFiles: true,
		});
		const results = output.outgoingLinksReport.processedLinks;

		// Then: Real ParsedFileCache used (file parsing and caching)
		expect(extractor.parsedFileCache).toBeInstanceOf(ParsedFileCache);

		// Then: Real CitationValidator used (link validation and enrichment)
		expect(extractor.citationValidator).toBeInstanceOf(CitationValidator);
		expect(results.every((r) => r.sourceLink.validation !== undefined)).toBe(
			true,
		);

		// Then: Real ParsedDocument used (content extraction via facade methods)
		// Multiple links to same target document validates caching
		const targetDocResults = results.filter((r) =>
			r.sourceLink.target?.path?.absolute?.endsWith("target-doc.md"),
		);
		expect(targetDocResults.length).toBeGreaterThan(1);

		// Then: At least one successful extraction validates real ParsedDocument
		const successResults = results.filter((r) => r.status === "success");
		expect(successResults.length).toBeGreaterThan(0);
	});

	it("AC12: should not break US2.1 tests (regression check)", async () => {
		// NOTE: This AC is verified in Task 8 by running full test suite
		// This test confirms US2.1 functionality is still accessible

		// Given: ContentExtractor from factory
		const extractor = createContentExtractor();

		// When: US2.1 analyzeEligibility method is called
		const link1 = { anchorType: null, extractionMarker: null };
		const result1 = extractor.analyzeEligibility(link1, { fullFiles: false });

		// Then: US2.1 eligibility analysis still works
		expect(result1.eligible).toBe(false);

		// Given: Section link with anchor
		const link2 = { anchorType: "header", extractionMarker: null };
		const result2 = extractor.analyzeEligibility(link2, {});

		// Then: Section links are eligible by default
		expect(result2.eligible).toBe(true);

		// Validation: All US2.1 tests continue passing (verified in Task 8)
		expect(extractor.eligibilityStrategies.length).toBe(4);
	});

	it("AC13: should implement extractSection with 3-phase algorithm", async () => {
		// Given: ParsedDocument with tokenized sections
		const parserOutput = {
			content: "## Test\n\nContent.\n\n### Sub\n\nMore.\n\n## Next",
			tokens: [
				{ type: "heading", depth: 2, text: "Test", raw: "## Test\n" },
				{ type: "paragraph", raw: "\nContent.\n\n" },
				{ type: "heading", depth: 3, text: "Sub", raw: "### Sub\n" },
				{ type: "paragraph", raw: "\nMore.\n\n" },
				{ type: "heading", depth: 2, text: "Next", raw: "## Next" },
			],
			anchors: [],
		};

		// Create ParsedDocument instance directly
		const ParsedDocument = (await import("../../src/ParsedDocument.js"))
			.default;
		const doc = new ParsedDocument(parserOutput);

		// When: Extract section (should NOT throw "Not implemented")
		const section = doc.extractSection("Test", 2);

		// Then: Returns actual section content (not stub error)
		expect(section).toBeDefined();
		expect(section).toContain("## Test");
		expect(section).toContain("Content");
		expect(section).toContain("### Sub");
		expect(section).not.toContain("Next");

		// Validation: Null when not found
		expect(doc.extractSection("Nonexistent", 2)).toBeNull();
	});

	it("AC14: should implement extractBlock with anchor lookup", async () => {
		// Given: ParsedDocument with block anchors
		const parserOutput = {
			content: "Line 1\nBlock content. ^test-block\nLine 3",
			tokens: [],
			anchors: [{ anchorType: "block", id: "test-block", line: 2, column: 15 }],
		};

		// Create ParsedDocument instance directly
		const ParsedDocument = (await import("../../src/ParsedDocument.js"))
			.default;
		const doc = new ParsedDocument(parserOutput);

		// When: Extract block (should NOT throw "Not implemented")
		const block = doc.extractBlock("test-block");

		// Then: Returns actual block content (not stub error)
		expect(block).toBeDefined();
		expect(block).toContain("Block content");
		expect(block).toContain("^test-block");

		// Validation: Null when not found
		expect(doc.extractBlock("nonexistent")).toBeNull();

		// Validation: Null when line index invalid
		const invalidDoc = new ParsedDocument({
			content: "Line 1",
			tokens: [],
			anchors: [{ anchorType: "block", id: "invalid", line: 999 }],
		});
		expect(invalidDoc.extractBlock("invalid")).toBeNull();
	});

	it("AC15: should filter out internal links before processing", async () => {
		// Given: Source file containing internal link (mixed-links-source.md line 21)
		const extractor = createContentExtractor();
		const sourceFile = join(
			__dirname,
			"../fixtures/us2.2/mixed-links-source.md",
		);

		// When: extractLinksContent is called
		const output = await extractor.extractLinksContent(sourceFile, {
			fullFiles: false,
		});
		const results = output.outgoingLinksReport.processedLinks;

		// Then: Internal links (scope === 'internal') should NOT appear in results
		const internalLinks = results.filter(
			(r) => r.sourceLink.scope === "internal",
		);
		expect(internalLinks.length).toBe(0);

		// Then: Only cross-document links should be in results
		const crossDocumentLinks = results.filter(
			(r) => r.sourceLink.scope === "cross-document",
		);
		expect(crossDocumentLinks.length).toBeGreaterThan(0);
		expect(crossDocumentLinks.length).toBe(results.length);
	});
});
