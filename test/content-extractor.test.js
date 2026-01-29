// tools/citation-manager/test/content-extractor.test.js
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { ContentExtractor } from "../dist/core/ContentExtractor/ContentExtractor.js";
import { SectionLinkStrategy } from "../dist/core/ContentExtractor/eligibilityStrategies/SectionLinkStrategy.js";
import { StopMarkerStrategy } from "../dist/core/ContentExtractor/eligibilityStrategies/StopMarkerStrategy.js";
import { createContentExtractor } from "../src/factories/componentFactory.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("ContentExtractor", () => {
	it("should instantiate with strategy array", () => {
		// Given: Strategy array
		const strategies = [new StopMarkerStrategy(), new SectionLinkStrategy()];

		// When: ContentExtractor created with optional dependencies
		const extractor = new ContentExtractor(strategies, null, null);

		// Then: Instance created successfully
		expect(extractor).toBeInstanceOf(ContentExtractor);
	});

	it("should analyze eligibility using injected strategies", () => {
		// Given: ContentExtractor with strategies
		const strategies = [new SectionLinkStrategy()];
		const extractor = new ContentExtractor(strategies, null, null);
		const link = { anchorType: "header", extractionMarker: null };

		// When: analyzeEligibility called
		const result = extractor.analyzeEligibility(link, {});

		// Then: Returns decision from strategy chain
		expect(result).toEqual({
			eligible: true,
			reason: "Markdown anchor links eligible by default",
		});
	});

	it("should handle empty strategy array gracefully", () => {
		// Given: ContentExtractor with empty strategies
		const extractor = new ContentExtractor([], null, null);
		const link = { anchorType: "header" };

		// When: analyzeEligibility called
		const result = extractor.analyzeEligibility(link, {});

		// Then: Returns fallback decision
		expect(result).toEqual({
			eligible: false,
			reason: "No strategy matched",
		});
	});

	it("should accept parsedFileCache and citationValidator dependencies", () => {
		// Given: Mock dependencies
		const mockCache = { get: () => null, set: () => {} };
		const mockValidator = { validate: () => ({ valid: true }) };
		const mockStrategies = [];

		// When: ContentExtractor instantiated with all dependencies
		const extractor = new ContentExtractor(
			mockStrategies,
			mockCache,
			mockValidator,
		);

		// Then: Dependencies stored correctly
		expect(extractor.parsedFileCache).toBe(mockCache);
		expect(extractor.citationValidator).toBe(mockValidator);
		expect(extractor.eligibilityStrategies).toBe(mockStrategies);
	});

	it("should provide extractLinksContent method returning Promise of OutgoingLinksExtractedContent", async () => {
		// Given: ContentExtractor with mock dependencies
		const mockCache = {
			resolveParsedFile: async () => ({
				extractFullContent: () => "content",
			}),
		};
		const mockValidator = { validateFile: async () => ({ links: [] }) };
		const strategies = [];
		const extractor = new ContentExtractor(
			strategies,
			mockCache,
			mockValidator,
		);

		// When: extractLinksContent called with source file and flags
		const result = await extractor.extractLinksContent("source-file.md", {
			fullFiles: false,
		});

		// Then: Returns OutgoingLinksExtractedContent object
		expect(result).toHaveProperty("extractedContentBlocks");
		expect(result).toHaveProperty("outgoingLinksReport");
		expect(result).toHaveProperty("stats");
	});

	it("should execute complete workflow: validation → eligibility → extraction", async () => {
		// Given: Source file with multiple link types (section, block, full-file)
		const sourceFile = path.join(
			__dirname,
			"fixtures/us2.2/mixed-links-source.md",
		);
		const extractor = createContentExtractor();

		// When: extractLinksContent executed WITHOUT --full-files flag
		const output = await extractor.extractLinksContent(sourceFile, {
			fullFiles: false,
		});
		const results = output.outgoingLinksReport.processedLinks;

		// Then: Results array contains mix of success/skipped/error statuses
		// (AC15: internal links filtered out, only cross-document links remain)
		expect(results.length).toBe(7);

		// Validation: Section link returns success with extracted content
		const sectionResult = results.find(
			(r) =>
				r.sourceLink.anchorType === "header" &&
				r.sourceLink.scope === "cross-document",
		);
		expect(sectionResult).toBeDefined();
		expect(sectionResult.status).toBe("success");
		expect(sectionResult.contentId).toBeDefined();
		const sectionContent =
			output.extractedContentBlocks[sectionResult.contentId];
		expect(sectionContent.content).toContain(
			"This is the content that should be extracted",
		);

		// Validation: Block link returns success with extracted content
		const blockResult = results.find(
			(r) =>
				r.sourceLink.anchorType === "block" &&
				r.sourceLink.scope === "cross-document",
		);
		expect(blockResult).toBeDefined();
		expect(blockResult.status).toBe("success");
		expect(blockResult.contentId).toBeDefined();
		const blockContent = output.extractedContentBlocks[blockResult.contentId];
		expect(blockContent.content).toContain(
			"This is a block reference that can be extracted.",
		);

		// Validation: Full-file link skipped without --full-files flag (eligibility filtering works)
		const fullFileResult = results.find(
			(r) =>
				r.sourceLink.anchorType === null &&
				r.sourceLink.scope === "cross-document",
		);
		expect(fullFileResult).toBeDefined();
		expect(fullFileResult.status).toBe("skipped");
		expect(fullFileResult.failureDetails.reason).toContain("not eligible");

		// Note: Internal links are filtered out before processing (AC15)
		// and will not appear in results
	});

	it("should extract full-file content when --full-files flag enabled", async () => {
		// Given: Source file with full-file link
		const sourceFile = path.join(
			__dirname,
			"fixtures/us2.2/mixed-links-source.md",
		);
		const extractor = createContentExtractor();

		// When: extractLinksContent executed WITH --full-files flag
		const output = await extractor.extractLinksContent(sourceFile, {
			fullFiles: true,
		});
		const results = output.outgoingLinksReport.processedLinks;

		// Then: Full-file link should be extracted successfully
		const fullFileResult = results.find(
			(r) =>
				r.sourceLink.anchorType === null &&
				r.sourceLink.scope === "cross-document",
		);
		expect(fullFileResult).toBeDefined();
		expect(fullFileResult.status).toBe("success");
		expect(fullFileResult.contentId).toBeDefined();
		const fullFileContent =
			output.extractedContentBlocks[fullFileResult.contentId];
		expect(fullFileContent.content).toContain("# Target Document");
	});

	describe("_totalContentCharacterLength metadata field", () => {
		it("should include _totalContentCharacterLength field in extractedContentBlocks", async () => {
			// Given: Source file with content links
			const sourceFile = path.join(
				__dirname,
				"fixtures/us2.2/mixed-links-source.md",
			);
			const extractor = createContentExtractor();

			// When: extractLinksContent executed
			const output = await extractor.extractLinksContent(sourceFile, {
				fullFiles: false,
			});

			// Then: _totalContentCharacterLength field exists in extractedContentBlocks
			expect(output.extractedContentBlocks).toHaveProperty(
				"_totalContentCharacterLength",
			);
		});

		it("should have _totalContentCharacterLength as numeric and positive", async () => {
			// Given: Source file with content links
			const sourceFile = path.join(
				__dirname,
				"fixtures/us2.2/mixed-links-source.md",
			);
			const extractor = createContentExtractor();

			// When: extractLinksContent executed
			const output = await extractor.extractLinksContent(sourceFile, {
				fullFiles: false,
			});

			// Then: Field value is numeric and positive
			const fieldValue =
				output.extractedContentBlocks._totalContentCharacterLength;
			expect(typeof fieldValue).toBe("number");
			expect(fieldValue).toBeGreaterThan(0);
			expect(Number.isInteger(fieldValue)).toBe(true);
		});

		it("should approximate actual JSON size within 30-50 characters", async () => {
			// Given: Source file with content links
			const sourceFile = path.join(
				__dirname,
				"fixtures/us2.2/mixed-links-source.md",
			);
			const extractor = createContentExtractor();

			// When: extractLinksContent executed
			const output = await extractor.extractLinksContent(sourceFile, {
				fullFiles: false,
			});

			// Then: Field value approximates actual JSON size within acceptable margin
			const reportedSize =
				output.extractedContentBlocks._totalContentCharacterLength;
			const actualSize = JSON.stringify(output.extractedContentBlocks).length;
			const difference = actualSize - reportedSize;

			// The reported size should be smaller than actual (calculated before adding field)
			expect(difference).toBeGreaterThan(0);
			// The difference should be within 30-50 characters
			expect(difference).toBeGreaterThanOrEqual(30);
			expect(difference).toBeLessThanOrEqual(50);
		});

		it("should return _totalContentCharacterLength of 2 for empty extraction", async () => {
			// Given: Source file with no eligible links
			const mockCache = {
				resolveParsedFile: async () => ({
					extractFullContent: () => "content",
				}),
			};
			const mockValidator = { validateFile: async () => ({ links: [] }) };
			const strategies = [];
			const extractor = new ContentExtractor(
				strategies,
				mockCache,
				mockValidator,
			);

			// When: extractLinksContent called with no links
			const output = await extractor.extractLinksContent("source-file.md", {
				fullFiles: false,
			});

			// Then: _totalContentCharacterLength equals 2 (empty object "{}")
			expect(output.extractedContentBlocks._totalContentCharacterLength).toBe(
				2,
			);
		});

		it("should calculate _totalContentCharacterLength within acceptable margin", async () => {
			// Given: Multiple content blocks for realistic size calculation
			const enrichedLinks = [
				{
					scope: "cross-document",
					anchorType: "header",
					validation: { status: "valid" },
					target: {
						path: { absolute: "/test/fixtures/multi.md" },
						anchor: "Section One",
					},
					fullMatch: "[[multi.md#Section One]]",
					line: 1,
					column: 0,
				},
				{
					scope: "cross-document",
					anchorType: "header",
					validation: { status: "valid" },
					target: {
						path: { absolute: "/test/fixtures/multi.md" },
						anchor: "Section Two",
					},
					fullMatch: "[[multi.md#Section Two]]",
					line: 2,
					column: 0,
				},
			];

			const mockParsedFileCache = {
				resolveParsedFile: vi.fn().mockResolvedValue({
					extractSection: (anchor) => {
						if (anchor === "Section One") return "Content for section one";
						if (anchor === "Section Two") return "Content for section two";
					},
				}),
			};

			const mockStrategies = [
				{
					getDecision: () => ({ eligible: true, reason: "Test eligible" }),
				},
			];

			const extractor = new ContentExtractor(
				mockStrategies,
				mockParsedFileCache,
				null,
			);

			// When: Extract content
			const result = await extractor.extractContent(enrichedLinks, {});

			// Then: Calculate actual final JSON size
			const actualJsonSize = JSON.stringify(
				result.extractedContentBlocks,
			).length;
			const reportedSize =
				result.extractedContentBlocks._totalContentCharacterLength;

			// Reported size should be less than actual (doesn't include the field itself)
			expect(reportedSize).toBeLessThan(actualJsonSize);

			// Difference should be ~30-50 characters (the field overhead)
			const difference = actualJsonSize - reportedSize;
			expect(difference).toBeGreaterThanOrEqual(20);
			expect(difference).toBeLessThanOrEqual(60);
		});

		it("should place _totalContentCharacterLength as first key (AC3: diagnostic visibility)", async () => {
			// Given: Source file with content links
			const sourceFile = path.join(
				__dirname,
				"fixtures/us2.2/mixed-links-source.md",
			);
			const extractor = createContentExtractor();

			// When: extractLinksContent executed
			const output = await extractor.extractLinksContent(sourceFile, {
				fullFiles: false,
			});

			// Then: _totalContentCharacterLength appears as first key in extractedContentBlocks
			const keys = Object.keys(output.extractedContentBlocks);
			expect(keys[0]).toBe("_totalContentCharacterLength");
		});
	});
});
