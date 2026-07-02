/**
 * AnchorMatcher unit tests — RED phase for issue #28
 *
 * Verifies AnchorMatcher can be instantiated and called without CitationValidator.
 *
 * Contract tests: validate the public surface of AnchorMatcher's pure matching
 * helpers. These describe blocks are the enforcement layer for the observable
 * behavioral obligations of the class.
 */
import { describe, expect, it } from "vitest";
import type { ParsedDocumentLike } from "../../../src/core/CitationValidator/AnchorMatcher.js";
import type { AnchorObject } from "../../../src/types/citationTypes.js";

/** Minimal ParsedDocumentLike stub — only the surface validateAnchorExists reads. */
function stubParsedDoc(anchors: AnchorObject[]): ParsedDocumentLike {
	return {
		hasAnchor: () => false,
		findSimilarAnchors: () => [],
		getLinks: () => [],
		data: {
			filePath: "target.md",
			content: "",
			ast: { type: "root", children: [] } as never,
			links: [],
			headings: [],
			anchors,
		},
	};
}

describe("Contract: AnchorMatcher — pure matching helpers (no I/O)", () => {
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

describe("Contract: AnchorMatcher.validateAnchorExists — structured anchorConversion (issue: anchor suggestion-string round-trip)", () => {
	it("populates anchorConversion for the Obsidian-better-format suggestion", async () => {
		const { AnchorMatcher } = await import(
			"../../../src/core/CitationValidator/AnchorMatcher.js"
		);

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
		const cache = {
			resolveParsedFile: async () => stubParsedDoc(anchors),
		};
		const matcher = new AnchorMatcher(cache);

		const result = await matcher.validateAnchorExists(
			"some-heading",
			"target.md",
		);

		expect(result.valid).toBe(false);
		expect(result.anchorConversion).toEqual({
			type: "anchor-conversion",
			original: "some-heading",
			recommended: "Some%2520Heading",
		});
	});

	it("populates anchorConversion via fuzzy header match when anchor is missing", async () => {
		const { AnchorMatcher } = await import(
			"../../../src/core/CitationValidator/AnchorMatcher.js"
		);

		// Trailing period on the header text keeps this out of the exact/
		// flexible/obsidian-better-format branches, so it only resolves via
		// findBestHeaderMatch's punctuation-and-whitespace-stripped comparison.
		const anchors: AnchorObject[] = [
			{
				anchorType: "header",
				id: "vision-statement.",
				urlEncodedId: "vision-statement.",
				rawText: "Vision Statement.",
				fullMatch: "## Vision Statement.",
				line: 1,
				column: 0,
			},
		];
		const cache = {
			resolveParsedFile: async () => stubParsedDoc(anchors),
		};
		const matcher = new AnchorMatcher(cache);

		const result = await matcher.validateAnchorExists(
			"vision-statement",
			"target.md",
		);

		expect(result.valid).toBe(false);
		expect(result.anchorConversion).toEqual({
			type: "anchor-conversion",
			original: "vision-statement",
			recommended: "Vision%20Statement%2E",
		});
	});

	it("omits anchorConversion when no header fuzzy-matches the missing anchor", async () => {
		const { AnchorMatcher } = await import(
			"../../../src/core/CitationValidator/AnchorMatcher.js"
		);

		const anchors: AnchorObject[] = [
			{
				anchorType: "header",
				id: "vision-statement",
				urlEncodedId: "vision-statement",
				rawText: "Vision Statement",
				fullMatch: "## Vision Statement",
				line: 1,
				column: 0,
			},
		];
		const cache = {
			resolveParsedFile: async () => stubParsedDoc(anchors),
		};
		const matcher = new AnchorMatcher(cache);

		const result = await matcher.validateAnchorExists(
			"totally-unrelated-anchor",
			"target.md",
		);

		expect(result.valid).toBe(false);
		expect(result.anchorConversion).toBeUndefined();
	});
});
