// tools/jact/test/content-extractor.test.js
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { ContentExtractor } from "../../../src/core/ContentExtractor/ContentExtractor.js";
import { SectionLinkStrategy } from "../../../src/core/ContentExtractor/eligibilityStrategies/SectionLinkStrategy.js";
import { StopMarkerStrategy } from "../../../src/core/ContentExtractor/eligibilityStrategies/StopMarkerStrategy.js";
import { createExtractionHarness } from "../../helpers/workflow-harness.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("ContentExtractor", () => {
	it("should instantiate with strategy array", () => {
		// Given: Strategy array
		const strategies = [new StopMarkerStrategy(), new SectionLinkStrategy()];

		// When: ContentExtractor created with optional dependencies
		const extractor = new ContentExtractor(strategies, null);

		// Then: Instance created successfully
		expect(extractor).toBeInstanceOf(ContentExtractor);
	});

	it("should analyze eligibility using injected strategies", () => {
		// Given: ContentExtractor with strategies
		const strategies = [new SectionLinkStrategy()];
		const extractor = new ContentExtractor(strategies, null);
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
		const extractor = new ContentExtractor([], null);
		const link = { anchorType: "header" };

		// When: analyzeEligibility called
		const result = extractor.analyzeEligibility(link, {});

		// Then: Returns fallback decision
		expect(result).toEqual({
			eligible: false,
			reason: "No strategy matched",
		});
	});

	it("uses the injected semantic-document lifecycle", async () => {
		const resolveDocument = vi.fn().mockResolvedValue({
			extractFullContent: () => "content",
		});
		const extractor = new ContentExtractor(
			[{ getDecision: () => ({ eligible: true, reason: "test" }) }],
			{ resolveDocument },
		);
		const link = {
			scope: "cross-document",
			anchorType: null,
			validation: { status: "valid" },
			target: { path: { absolute: "/virtual/target.md" }, anchor: null },
			fullMatch: "[target](target.md)",
			line: 1,
			column: 1,
		};

		const result = await extractor.extractContent([link], { fullFiles: true });

		expect(resolveDocument).toHaveBeenCalledWith({
			kind: "file",
			filePath: "/virtual/target.md",
		});
		expect(result.stats.uniqueContent).toBe(1);
	});

	it("exposes one extraction operation with the production result contract", async () => {
		const extractor = new ContentExtractor([], { resolveDocument: vi.fn() });

		const result = await extractor.extractContent([], { fullFiles: false });

		expect(result).toHaveProperty("extractedContentBlocks");
		expect(result).toHaveProperty("outgoingLinksReport");
		expect(result).toHaveProperty("stats");
	});

	it("should execute complete workflow: validation → eligibility → extraction", async () => {
		// Given: Source file with multiple link types (section, block, full-file)
		const sourceFile = path.join(
			__dirname,
			"../../fixtures/us2.2/mixed-links-source.md",
		);
		const { extractFile } = createExtractionHarness();

		// When: the extraction operation executes WITHOUT --full-files flag
		const output = await extractFile(sourceFile, {
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
		expect(sectionResult.status).toBe("extracted");
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
		expect(blockResult.status).toBe("extracted");
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
			"../../fixtures/us2.2/mixed-links-source.md",
		);
		const { extractFile } = createExtractionHarness();

		// When: the extraction operation executes WITH --full-files flag
		const output = await extractFile(sourceFile, {
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
		expect(fullFileResult.status).toBe("extracted");
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
				"../../fixtures/us2.2/mixed-links-source.md",
			);
			const { extractFile } = createExtractionHarness();

			// When: the extraction operation executes
			const output = await extractFile(sourceFile, {
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
				"../../fixtures/us2.2/mixed-links-source.md",
			);
			const { extractFile } = createExtractionHarness();

			// When: the extraction operation executes
			const output = await extractFile(sourceFile, {
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
				"../../fixtures/us2.2/mixed-links-source.md",
			);
			const { extractFile } = createExtractionHarness();

			// When: the extraction operation executes
			const output = await extractFile(sourceFile, {
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
			const extractor = new ContentExtractor([], { resolveDocument: vi.fn() });

			const output = await extractor.extractContent([], { fullFiles: false });

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
				resolveDocument: vi.fn().mockResolvedValue({
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
				"../../fixtures/us2.2/mixed-links-source.md",
			);
			const { extractFile } = createExtractionHarness();

			// When: the extraction operation executes
			const output = await extractFile(sourceFile, {
				fullFiles: false,
			});

			// Then: _totalContentCharacterLength appears as first key in extractedContentBlocks
			const keys = Object.keys(output.extractedContentBlocks);
			expect(keys[0]).toBe("_totalContentCharacterLength");
		});
	});
});
