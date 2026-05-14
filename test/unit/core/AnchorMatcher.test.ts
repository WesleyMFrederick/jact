/**
 * AnchorMatcher unit tests — RED phase for issue #28
 *
 * Verifies AnchorMatcher can be instantiated and called without CitationValidator.
 */
import { describe, expect, it } from "vitest";
import type { AnchorObject } from "../../../src/types/citationTypes.js";

describe("AnchorMatcher — isolated unit", () => {
	it("cleanMarkdownForComparison removes markdown markers", async () => {
		const { AnchorMatcher } = await import(
			"../../../src/core/CitationValidator/AnchorMatcher.js"
		);

		const matcher = new AnchorMatcher();
		expect(matcher.cleanMarkdownForComparison("**bold text**")).toBe(
			"bold text",
		);
		expect(matcher.cleanMarkdownForComparison("`code`")).toBe("code");
		expect(matcher.cleanMarkdownForComparison("==highlight==")).toBe(
			"highlight",
		);
		expect(matcher.cleanMarkdownForComparison("")).toBe("");
	});

	it("findFlexibleAnchorMatch finds exact match", async () => {
		const { AnchorMatcher } = await import(
			"../../../src/core/CitationValidator/AnchorMatcher.js"
		);

		const matcher = new AnchorMatcher();
		const anchors: AnchorObject[] = [
			{
				anchorType: "header",
				id: "my-heading",
				urlEncodedId: "my-heading",
				rawText: "My Heading",
				fullMatch: "## My Heading",
				line: 1,
				column: 0,
			},
		];

		const result = matcher.findFlexibleAnchorMatch("my-heading", anchors);
		expect(result.found).toBe(true);
	});

	it("findFlexibleAnchorMatch returns not found for unknown anchor", async () => {
		const { AnchorMatcher } = await import(
			"../../../src/core/CitationValidator/AnchorMatcher.js"
		);

		const matcher = new AnchorMatcher();
		const result = matcher.findFlexibleAnchorMatch("nonexistent", []);
		expect(result.found).toBe(false);
	});

	it("suggestObsidianBetterFormat returns null when no kebab match", async () => {
		const { AnchorMatcher } = await import(
			"../../../src/core/CitationValidator/AnchorMatcher.js"
		);

		const matcher = new AnchorMatcher();
		const anchors: AnchorObject[] = [
			{
				anchorType: "header",
				id: "Some%20Heading",
				urlEncodedId: "Some%20Heading",
				rawText: "Some Heading",
				fullMatch: "## Some Heading",
				line: 1,
				column: 0,
			},
		];

		// "different-anchor" won't match "some-heading" kebab of "Some Heading"
		const result = matcher.suggestObsidianBetterFormat(
			"different-anchor",
			anchors,
		);
		expect(result).toBeNull();
	});

	it("suggestObsidianBetterFormat suggests raw format when kebab matches header", async () => {
		const { AnchorMatcher } = await import(
			"../../../src/core/CitationValidator/AnchorMatcher.js"
		);

		const matcher = new AnchorMatcher();
		const anchors: AnchorObject[] = [
			{
				anchorType: "header",
				id: "Some%20Heading",
				urlEncodedId: "Some%20Heading",
				rawText: "Some Heading",
				fullMatch: "## Some Heading",
				line: 1,
				column: 0,
			},
		];

		// "some-heading" is the kebab form of "Some Heading"
		const result = matcher.suggestObsidianBetterFormat("some-heading", anchors);
		// Should suggest the URL-encoded raw format
		expect(result).not.toBeNull();
	});
});
