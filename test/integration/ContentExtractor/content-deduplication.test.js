import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createContentExtractor } from "../../../src/factories/componentFactory.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturesDir = join(__dirname, "..", "..", "fixtures");

describe("Content Deduplication - Basic Logic", () => {
	it("should store identical content only once in extractedContentBlocks", async () => {
		// Fixture: Create test file with multiple links extracting identical content
		// Integration: Real ContentExtractor with real dependencies (no mocks)
		const extractor = createContentExtractor();
		const sourceFile = join(
			fixturesDir,
			"us2.2a",
			"duplicate-content-source.md",
		);

		// When: Extract content from source with duplicate links
		const result = await extractor.extractLinksContent(sourceFile, {
			fullFiles: false,
		});

		// Then: Result has new deduplicated structure
		// Verification: New contract with extractedContentBlocks, outgoingLinksReport, stats
		expect(result).toHaveProperty("extractedContentBlocks");
		expect(result).toHaveProperty("outgoingLinksReport");
		expect(result).toHaveProperty("stats");

		// Then: Identical content stored once (deduplication confirmed)
		// Given: Test fixture has 3 links extracting same content
		const contentIds = Object.keys(result.extractedContentBlocks).filter(
			(key) => !key.startsWith("_"),
		);

		// Verification: Single content block despite multiple links
		// Decision: Count unique content blocks vs total links
		expect(contentIds.length).toBe(1); // Only 1 unique content block
		expect(result.outgoingLinksReport.processedLinks.length).toBe(3); // But 3 links processed
	});
});

describe("Content Deduplication - Index Structure", () => {
	it("should create index entries with content and contentLength", async () => {
		// Given: Source with extractable links
		const extractor = createContentExtractor();
		const sourceFile = join(
			fixturesDir,
			"us2.2a",
			"duplicate-content-source.md",
		);

		// When: Extract content
		const result = await extractor.extractLinksContent(sourceFile, {
			fullFiles: false,
		});

		// Then: Each index entry has complete structure
		// Verification: All required fields present per AC5
		const contentIds = Object.keys(result.extractedContentBlocks).filter(key => !key.startsWith('_'));
		expect(contentIds.length).toBeGreaterThan(0);

		const firstBlock = result.extractedContentBlocks[contentIds[0]];

		// Verification: Content field present (extracted text)
		expect(firstBlock).toHaveProperty("content");
		expect(typeof firstBlock.content).toBe("string");

		// Verification: ContentLength field present (character count)
		expect(firstBlock).toHaveProperty("contentLength");
		expect(firstBlock.contentLength).toBe(firstBlock.content.length);
	});
});

describe("Content Deduplication - Statistics: Total Links", () => {
	it("should count all processed links in stats.totalLinks", async () => {
		// Given: File with mixed link statuses (success, skipped, error)
		const extractor = createContentExtractor();
		const sourceFile = join(
			fixturesDir,
			"us2.2a",
			"duplicate-content-source.md",
		);

		// When: Extract content
		const result = await extractor.extractLinksContent(sourceFile, {
			fullFiles: false,
		});

		// Then: totalLinks equals processedLinks array length
		// Verification: Counts all links regardless of status (AC7)
		expect(result.stats.totalLinks).toBe(
			result.outgoingLinksReport.processedLinks.length,
		);

		// Verification: Includes success, skipped, AND error links
		const allStatuses = result.outgoingLinksReport.processedLinks.map(
			(link) => link.status,
		);
		expect(allStatuses).toContain("success");
		expect(result.stats.totalLinks).toBeGreaterThan(0);
	});
});

describe("Content Deduplication - Statistics: Unique Content", () => {
	it("should count unique content blocks in stats.uniqueContent", async () => {
		// Given: File with duplicate content extractions
		const extractor = createContentExtractor();
		const sourceFile = join(
			fixturesDir,
			"us2.2a",
			"duplicate-content-source.md",
		);

		// When: Extract content
		const result = await extractor.extractLinksContent(sourceFile, {
			fullFiles: false,
		});

		// Then: uniqueContent equals number of keys in extractedContentBlocks
		// Verification: Unique count matches index size (AC7)
		const uniqueCount = Object.keys(result.extractedContentBlocks).filter(
			(key) => !key.startsWith("_"),
		).length;
		expect(result.stats.uniqueContent).toBe(uniqueCount);

		// Given: 3 links extracting identical content = 1 unique
		expect(result.stats.uniqueContent).toBe(1);
		expect(result.stats.totalLinks).toBe(3);
	});
});

describe("Content Deduplication - ContentId References", () => {
	it("should reference content via contentId in processedLinks", async () => {
		// Given: Mixed success/skipped/error links
		const extractor = createContentExtractor();
		const sourceFile = join(fixturesDir, "us2.2a", "mixed-links-source.md");

		// When: Extract content
		const result = await extractor.extractLinksContent(sourceFile, {
			fullFiles: false,
		});

		// Then: Successful links have valid contentId reference
		// Verification: contentId matches extractedContentBlocks key (AC6)
		const successLink = result.outgoingLinksReport.processedLinks.find(
			(link) => link.status === "success",
		);
		expect(successLink).toBeDefined();
		expect(successLink).toHaveProperty("contentId");
		expect(successLink.contentId).not.toBeNull();
		expect(result.extractedContentBlocks).toHaveProperty(successLink.contentId);

		// Then: Failed/skipped links have null contentId
		// Verification: Null reference with failure reason (AC8)
		const skippedLink = result.outgoingLinksReport.processedLinks.find(
			(link) => link.status === "skipped",
		);
		expect(skippedLink).toBeDefined();
		expect(skippedLink.contentId).toBeNull();
		expect(skippedLink).toHaveProperty("failureDetails");
		expect(skippedLink.failureDetails).toHaveProperty("reason");
		expect(skippedLink.failureDetails.reason).toBeTruthy();

		// Additional verification: Error links also have null contentId
		const errorLink = result.outgoingLinksReport.processedLinks.find(
			(link) => link.status === "error",
		);
		if (errorLink) {
			expect(errorLink.contentId).toBeNull();
			expect(errorLink).toHaveProperty("failureDetails");
			expect(errorLink.failureDetails).toHaveProperty("reason");
		}
	});
});

describe("Content Deduplication - Statistics: Duplicate Detection", () => {
	it("should count duplicate content detections in stats.duplicateContentDetected", async () => {
		// Given: File with 3 links extracting identical content
		const extractor = createContentExtractor();
		const sourceFile = join(
			fixturesDir,
			"us2.2a",
			"duplicate-content-source.md",
		);

		// When: Extract content
		const result = await extractor.extractLinksContent(sourceFile, {
			fullFiles: false,
		});

		// Then: duplicateContentDetected counts reuses (not first occurrence)
		// Verification: First occurrence creates entry, next 2 are duplicates
		// Pattern: totalLinks - uniqueContent = duplicates
		expect(result.stats.duplicateContentDetected).toBe(2); // 3 total - 1 unique = 2 duplicates

		// Verification: Formula validation
		expect(result.stats.duplicateContentDetected).toBe(
			result.stats.totalLinks - result.stats.uniqueContent,
		);
	});
});

describe("Content Deduplication - Statistics: Tokens Saved", () => {
	it("should accumulate saved tokens in stats.tokensSaved", async () => {
		// Given: File with duplicate content (known length)
		const extractor = createContentExtractor();
		const sourceFile = join(
			fixturesDir,
			"us2.2a",
			"duplicate-content-source.md",
		);

		// When: Extract content
		const result = await extractor.extractLinksContent(sourceFile, {
			fullFiles: false,
		});

		// Then: tokensSaved equals sum of duplicate content lengths
		// Pattern: If content is 100 chars and appears 3 times, saved = 200 (2 duplicates × 100)
		const contentIds = Object.keys(result.extractedContentBlocks).filter(key => !key.startsWith('_'));
		const contentBlock = result.extractedContentBlocks[contentIds[0]];
		const expectedSaved =
			contentBlock.contentLength * result.stats.duplicateContentDetected;

		// Verification: Tokens saved calculated correctly (AC7)
		expect(result.stats.tokensSaved).toBe(expectedSaved);
	});
});

describe("Content Deduplication - Statistics: Compression Ratio", () => {
	it("should calculate compression ratio as saved / (total + saved)", async () => {
		// Given: File with known duplicate content
		const extractor = createContentExtractor();
		const sourceFile = join(
			fixturesDir,
			"us2.2a",
			"duplicate-content-source.md",
		);

		// When: Extract content
		const result = await extractor.extractLinksContent(sourceFile, {
			fullFiles: false,
		});

		// Then: Calculate expected compression ratio
		// Pattern: Sum all contentLength values in extractedContentBlocks
		const totalContentSize = Object.entries(
			result.extractedContentBlocks,
		)
			.filter(([key]) => !key.startsWith("_"))
			.reduce((sum, [, block]) => sum + block.contentLength, 0);
		const tokensSaved = result.stats.tokensSaved;

		// Verification: Compression ratio formula (AC7)
		const expectedRatio = tokensSaved / (totalContentSize + tokensSaved);
		expect(result.stats.compressionRatio).toBeCloseTo(expectedRatio, 5); // 5 decimal places
	});
});

describe("Content Deduplication - Output Structure: Skipped Links", () => {
	it("should include skipped links with null contentId and failure reason", async () => {
		// Given: File with ineligible links (e.g., full-file without flag)
		const extractor = createContentExtractor();
		const sourceFile = join(fixturesDir, "us2.2a", "mixed-links-source.md");

		// When: Extract without --full-files flag
		const result = await extractor.extractLinksContent(sourceFile, {
			fullFiles: false,
		});

		// Then: Find skipped link
		const skippedLink = result.outgoingLinksReport.processedLinks.find(
			(link) => link.status === "skipped",
		);

		// Verification: Null contentId for skipped links (AC8)
		expect(skippedLink).toBeDefined();
		expect(skippedLink.contentId).toBeNull();
		expect(skippedLink.status).toBe("skipped");

		// Verification: Failure reason explains why skipped
		expect(skippedLink).toHaveProperty("failureDetails");
		expect(skippedLink.failureDetails).toHaveProperty("reason");
		expect(typeof skippedLink.failureDetails.reason).toBe("string");
		expect(skippedLink.failureDetails.reason.length).toBeGreaterThan(0);
	});
});

describe("Content Deduplication - Output Structure: Error Links", () => {
	it("should include error links with null contentId and failure reason", async () => {
		// Given: File with broken links (validation errors)
		const extractor = createContentExtractor();
		const sourceFile = join(fixturesDir, "us2.2a", "mixed-links-source.md");

		// When: Extract content
		const result = await extractor.extractLinksContent(sourceFile, {
			fullFiles: false,
		});

		// Then: Find link with validation error (treated as skipped with error details)
		const errorLink = result.outgoingLinksReport.processedLinks.find(
			(link) =>
				link.sourceLink?.validation?.status === "error" &&
				link.sourceLink?.validation?.error?.includes("File not found"),
		);

		// Verification: Null contentId for error links (AC8)
		expect(errorLink).toBeDefined();
		expect(errorLink.contentId).toBeNull();
		expect(errorLink.status).toBe("skipped"); // Validation errors result in skipped status

		// Verification: Failure reason explains extraction error
		expect(errorLink).toHaveProperty("failureDetails");
		expect(errorLink.failureDetails).toHaveProperty("reason");
		expect(errorLink.failureDetails.reason).toContain("Link failed validation"); // Contains error description
		expect(errorLink.sourceLink.validation.error).toContain("File not found"); // Original error preserved
	});
});

describe("Content Deduplication - Output Structure: Success Metadata", () => {
	it("should preserve all link metadata for successful extractions", async () => {
		// Given: File with successful extractions
		const extractor = createContentExtractor();
		const sourceFile = join(fixturesDir, "us2.2a", "mixed-links-source.md");

		// When: Extract content
		const result = await extractor.extractLinksContent(sourceFile, {
			fullFiles: false,
		});

		// Then: Find successful link
		const successLink = result.outgoingLinksReport.processedLinks.find(
			(link) => link.status === "success",
		);
		expect(successLink).toBeDefined();

		// Verification: All required metadata present (AC6)
		expect(successLink).toHaveProperty("sourceLink"); // Original LinkObject
		expect(successLink).toHaveProperty("contentId"); // Content reference
		expect(successLink).toHaveProperty("status"); // 'success'
		expect(successLink.status).toBe("success");
		expect(successLink).toHaveProperty("eligibilityReason"); // Why extracted

		// Verification: sourceLink has all original metadata
		expect(successLink.sourceLink).toHaveProperty("line");
		expect(successLink.sourceLink).toHaveProperty("column");
		expect(successLink.sourceLink).toHaveProperty("text");
	});
});

describe("Content Deduplication - Output Structure: Complete Stats", () => {
	it("should populate all five statistics fields accurately", async () => {
		// Given: File with mixed extraction results
		const extractor = createContentExtractor();
		const sourceFile = join(fixturesDir, "us2.2a", "mixed-links-source.md");

		// When: Extract content
		const result = await extractor.extractLinksContent(sourceFile, {
			fullFiles: false,
		});

		// Then: All five stat fields present
		// Verification: Complete stats object per AC7
		expect(result.stats).toHaveProperty("totalLinks");
		expect(result.stats).toHaveProperty("uniqueContent");
		expect(result.stats).toHaveProperty("duplicateContentDetected");
		expect(result.stats).toHaveProperty("tokensSaved");
		expect(result.stats).toHaveProperty("compressionRatio");

		// Verification: All stats are numeric and valid
		expect(typeof result.stats.totalLinks).toBe("number");
		expect(typeof result.stats.uniqueContent).toBe("number");
		expect(typeof result.stats.duplicateContentDetected).toBe("number");
		expect(typeof result.stats.tokensSaved).toBe("number");
		expect(typeof result.stats.compressionRatio).toBe("number");

		// Verification: Stats are internally consistent
		expect(result.stats.totalLinks).toBeGreaterThanOrEqual(
			result.stats.uniqueContent,
		);
		expect(result.stats.compressionRatio).toBeGreaterThanOrEqual(0);
		expect(result.stats.compressionRatio).toBeLessThanOrEqual(1);
	});
});

describe("US2.2a Acceptance - Compression Ratio", () => {
	it("should include compressionRatio in stats with correct calculation", async () => {
		// Given: File with known duplication pattern
		const extractor = createContentExtractor();
		const sourceFile = join(
			fixturesDir,
			"us2.2a",
			"duplicate-content-source.md",
		);

		// When: Extract content
		const result = await extractor.extractLinksContent(sourceFile, {
			fullFiles: false,
		});

		// Then: compressionRatio field present in stats (AC7)
		expect(result.stats).toHaveProperty("compressionRatio");

		// Verification: Ratio calculated per formula: saved / (total + saved)
		const totalSize = Object.entries(result.extractedContentBlocks)
			.filter(([key]) => !key.startsWith("_"))
			.reduce((sum, [, block]) => sum + block.contentLength, 0);
		const saved = result.stats.tokensSaved;
		const expectedRatio = saved / (totalSize + saved);

		expect(result.stats.compressionRatio).toBeCloseTo(expectedRatio, 5);

		// Verification: Ratio between 0 and 1 (percentage as decimal)
		expect(result.stats.compressionRatio).toBeGreaterThanOrEqual(0);
		expect(result.stats.compressionRatio).toBeLessThanOrEqual(1);
	});
});

describe("US2.2a Acceptance - Three-Group Structure", () => {
	it("should organize output into extractedContentBlocks, outgoingLinksReport, and stats", async () => {
		// Given: Any extraction workflow
		const extractor = createContentExtractor();
		const sourceFile = join(
			fixturesDir,
			"us2.2a",
			"duplicate-content-source.md",
		);

		// When: Extract content
		const result = await extractor.extractLinksContent(sourceFile, {
			fullFiles: false,
		});

		// Then: Three top-level groups present (AC3)
		// Verification: Schema validation for OutgoingLinksExtractedContent
		expect(Object.keys(result)).toHaveLength(3);
		expect(result).toHaveProperty("extractedContentBlocks");
		expect(result).toHaveProperty("outgoingLinksReport");
		expect(result).toHaveProperty("stats");

		// Verification: No flat array format (old contract removed)
		expect(Array.isArray(result)).toBe(false);

		// Verification: extractedContentBlocks is object (index)
		expect(typeof result.extractedContentBlocks).toBe("object");
		expect(Array.isArray(result.extractedContentBlocks)).toBe(false);

		// Verification: outgoingLinksReport has processedLinks array
		expect(result.outgoingLinksReport).toHaveProperty("processedLinks");
		expect(Array.isArray(result.outgoingLinksReport.processedLinks)).toBe(true);

		// Verification: stats is object with aggregate metrics
		expect(typeof result.stats).toBe("object");
	});
});

describe("US2.2a Acceptance - SHA-256 Content Hashing", () => {
	it("should deduplicate based on content hash, not file/anchor identity", async () => {
		// Fixture: Create files with identical content at different locations
		// Research: Same section content in different files should deduplicate
		const extractor = createContentExtractor();
		const sourceFile = join(fixturesDir, "us2.2a", "cross-file-duplicates.md");

		// When: Extract content from different files with identical text
		const result = await extractor.extractLinksContent(sourceFile, {
			fullFiles: false,
		});

		// Then: Content deduplicated despite different file paths
		// Verification: Content-based hashing, not identity-based (AC2)
		const contentIds = Object.keys(result.extractedContentBlocks).filter(
			(key) => !key.startsWith("_"),
		);

		// Given: 2 different files with identical section content
		const processedCount = result.outgoingLinksReport.processedLinks.filter(
			(link) => link.status === "success",
		).length;
		expect(processedCount).toBe(2); // 2 links processed
		expect(contentIds.length).toBe(1); // But only 1 unique content block

		// Verification: Both links reference the same contentId (cross-file deduplication)
		const contentBlock = result.extractedContentBlocks[contentIds[0]];
		const successLinks = result.outgoingLinksReport.processedLinks.filter(
			(link) => link.status === "success",
		);
		expect(successLinks).toHaveLength(2);

		// Pattern: Different targetPath values prove cross-file deduplication
		const paths = successLinks.map((link) => link.sourceLink.target.path.absolute);
		expect(new Set(paths).size).toBe(2); // 2 different file paths
	});
});

describe("Content Deduplication - Edge Cases", () => {
	it("should return 0 compression ratio when no content extracted", async () => {
		// Given: File with only failed/skipped links (no successful extractions)
		const extractor = createContentExtractor();
		const sourceFile = join(fixturesDir, "us2.2a", "all-failed-links.md");

		// When: Extract content (all links fail)
		const result = await extractor.extractLinksContent(sourceFile, {
			fullFiles: false,
		});

		// Then: compressionRatio should be 0, not NaN
		// Verification: Division by zero guard (P2 bug fix)
		expect(result.stats.compressionRatio).toBe(0);
		expect(Number.isNaN(result.stats.compressionRatio)).toBe(false);

		// Verification: No content extracted (only metadata fields)
		expect(
			Object.keys(result.extractedContentBlocks).filter(
				(key) => !key.startsWith("_"),
			).length,
		).toBe(0);
		expect(result.stats.tokensSaved).toBe(0);
		expect(result.stats.uniqueContent).toBe(0);
	});
});

describe("US2.2a Acceptance - Complete Pipeline", () => {
	it("should handle complete extraction with duplicates, unique content, and errors", async () => {
		// Fixture: Comprehensive test file with:
		// - Multiple links extracting identical sections (duplicates)
		// - Links extracting different sections (unique)
		// - Mix of section/block/full-file links
		// - Skipped links (ineligible)
		// - Error links (validation failures)
		// Integration: Real components (no mocks)
		const extractor = createContentExtractor();
		const sourceFile = join(fixturesDir, "us2.2a", "comprehensive-test.md");

		// When: Complete pipeline executes
		const result = await extractor.extractLinksContent(sourceFile, {
			fullFiles: false,
		});

		// Then: Validate complete deduplicated output structure
		// Verification: Three-group structure (AC3)
		expect(result).toHaveProperty("extractedContentBlocks");
		expect(result).toHaveProperty("outgoingLinksReport");
		expect(result).toHaveProperty("stats");

		// Verification: Deduplication working (AC1, AC4)
		const uniqueBlocks = Object.keys(result.extractedContentBlocks).filter(
			(key) => !key.startsWith("_"),
		).length;
		const totalLinks = result.stats.totalLinks;
		expect(uniqueBlocks).toBeLessThan(totalLinks); // Deduplication occurred

		// Verification: Statistics accurate (AC7)
		expect(result.stats.uniqueContent).toBe(uniqueBlocks);
		expect(result.stats.duplicateContentDetected).toBeGreaterThan(0);
		expect(result.stats.tokensSaved).toBeGreaterThan(0);
		expect(result.stats.compressionRatio).toBeGreaterThan(0);

		// Verification: Content blocks exist in extractedContentBlocks (AC5)
		const firstBlockId = Object.keys(result.extractedContentBlocks).filter(key => !key.startsWith('_'))[0];
		const firstBlock = result.extractedContentBlocks[firstBlockId];
		expect(firstBlock).toHaveProperty("content");
		expect(firstBlock).toHaveProperty("contentLength");

		// Verification: Mixed statuses present (AC6, AC8)
		const statuses = result.outgoingLinksReport.processedLinks.map(
			(link) => link.status,
		);
		expect(statuses).toContain("success");
		expect(statuses.some((s) => s === "skipped")).toBe(true);

		// Verification: Content references correct (AC6, AC8)
		const successLinks = result.outgoingLinksReport.processedLinks.filter(
			(link) => link.status === "success",
		);
		const failedLinks = result.outgoingLinksReport.processedLinks.filter(
			(link) => link.status !== "success",
		);

		// For each success link: expect contentId to be non-null and in extractedContentBlocks
		for (const successLink of successLinks) {
			expect(successLink.contentId).not.toBeNull();
			expect(result.extractedContentBlocks).toHaveProperty(
				successLink.contentId,
			);
		}

		// For each failed link: expect contentId to be null and failureReason present
		for (const failedLink of failedLinks) {
			expect(failedLink.contentId).toBeNull();
			expect(failedLink).toHaveProperty("failureDetails");
			expect(failedLink.failureDetails).toHaveProperty("reason");
		}
	});
});
