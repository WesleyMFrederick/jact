import { describe, expect, it } from "vitest";
import { formatExtractResult } from "../../src/formatExtractResult.js";
import type { OutgoingLinksExtractedContent } from "../../src/types/contentExtractorTypes.js";

/**
 * Unit tests for formatExtractResult — pure function, no CLI or filesystem.
 * Covers: D-002 (shared formatter) from extract-format-markdown plan.
 */

function makeResult(
	blocks: Record<string, { content: string; contentLength: number }>,
	totalLength: number = 0,
): OutgoingLinksExtractedContent {
	return {
		extractedContentBlocks: {
			_totalContentCharacterLength: totalLength,
			...blocks,
		},
		outgoingLinksReport: {
			processedLinks: [],
		},
		stats: {
			totalLinks: 0,
			uniqueContent: 0,
			duplicateContentDetected: 0,
			tokensSaved: 0,
			compressionRatio: 0,
		},
	};
}

describe("formatExtractResult", () => {
	const singleBlock = makeResult(
		{
			"block-1": { content: "# Hello\nSome content here.", contentLength: 26 },
		},
		26,
	);

	const multiBlock = makeResult(
		{
			"block-1": { content: "# First\nContent A.", contentLength: 19 },
			"block-2": { content: "# Second\nContent B.", contentLength: 20 },
		},
		39,
	);

	it("format 'json' returns valid JSON matching JSON.stringify(result, null, 2)", () => {
		const output = formatExtractResult(singleBlock, "json");
		expect(output).toBe(JSON.stringify(singleBlock, null, 2));
	});

	it("format 'markdown' returns raw content from blocks, no JSON wrapper", () => {
		const output = formatExtractResult(singleBlock, "markdown");
		expect(output).toBe("# Hello\nSome content here.");
		// Must not be valid JSON — it's raw markdown
		expect(() => JSON.parse(output)).toThrow();
	});

	it("format 'markdown' joins multiple blocks with '\\n---\\n' separator", () => {
		const output = formatExtractResult(multiBlock, "markdown");
		expect(output).toBe("# First\nContent A.\n---\n# Second\nContent B.");
	});

	it("format 'markdown' skips _totalContentCharacterLength metadata key", () => {
		const output = formatExtractResult(multiBlock, "markdown");
		// Should not contain the numeric value as a block
		expect(output).not.toContain("39");
		// Should only have 2 blocks joined by one separator
		expect(output.split("\n---\n")).toHaveLength(2);
	});

	it("single block produces output with no separator", () => {
		const output = formatExtractResult(singleBlock, "markdown");
		expect(output).not.toContain("---");
	});
});
