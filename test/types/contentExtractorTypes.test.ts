import { describe, expect, it } from "vitest";
import type {
	EligibilityAnalysis,
	ExtractedContent,
	OutgoingLinksExtractedContent,
} from "../../src/types/contentExtractorTypes";

describe("contentExtractorTypes", () => {
	it("should export EligibilityAnalysis interface", () => {
		// Given: Type imported
		// When: Create analysis result
		const analysis: EligibilityAnalysis = {
			eligible: true,
			reason: "Section link with force marker",
			strategy: "ForceMarkerStrategy",
		};

		// Then: TypeScript validates structure
		expect(analysis.eligible).toBe(true);
		expect(analysis.strategy).toBeDefined();
	});

	it("should export ExtractedContent interface", () => {
		// Given: Type imported
		// When: Create extracted content
		const content: ExtractedContent = {
			contentId: "abc123",
			content: "# Sample Content",
			sourceLinks: [
				{
					rawSourceLink: "[Link](/path/to/file.md)",
					sourceLine: 42,
				},
			],
		};

		// Then: TypeScript validates structure
		expect(content.contentId).toBe("abc123");
		expect(content.content).toBe("# Sample Content");
		expect(content.sourceLinks).toHaveLength(1);
	});

	it("should export OutgoingLinksExtractedContent interface", () => {
		// Given: Type imported
		// When: Create complete extraction result
		const result: OutgoingLinksExtractedContent = {
			extractedContentBlocks: {
				abc123: {
					contentId: "abc123",
					content: "# Content",
					sourceLinks: [],
				},
			},
			_totalContentCharacterLength: 9,
		};

		// Then: TypeScript validates structure
		expect(result.extractedContentBlocks.abc123).toBeDefined();
		expect(result._totalContentCharacterLength).toBe(9);
	});
});
