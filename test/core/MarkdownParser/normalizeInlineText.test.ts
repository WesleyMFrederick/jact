import { describe, expect, it } from "vitest";
import {
	normalizeAnchorText,
	stripInlineMarkdown,
} from "../../../src/core/MarkdownParser/normalizeInlineText.js";

describe("stripInlineMarkdown (tokenizer-backed formatting removal)", () => {
	it("strips bold markers", () => {
		expect(stripInlineMarkdown("**bold text**")).toBe("bold text");
	});

	it("strips italic markers", () => {
		expect(stripInlineMarkdown("*italic*")).toBe("italic");
	});

	it("unwraps inline code to its literal content", () => {
		expect(stripInlineMarkdown("`code`")).toBe("code");
	});

	it("unwraps highlight and recursively strips inner formatting", () => {
		expect(stripInlineMarkdown("==highlight==")).toBe("highlight");
		expect(stripInlineMarkdown("==**text**==")).toBe("text");
	});

	it("reduces a markdown link to its label", () => {
		expect(stripInlineMarkdown("[label](https://example.com)")).toBe("label");
	});

	it("keeps code-span content literal — the chained-regex breaker", () => {
		// Chained regex stripped ** inside code spans; the tokenizer knows
		// code content is literal.
		expect(stripInlineMarkdown("`**not bold**`")).toBe("**not bold**");
	});

	it("handles mixed formatting in one fragment", () => {
		expect(stripInlineMarkdown("**Bold** and `code` and ==mark==")).toBe(
			"Bold and code and mark",
		);
	});

	it("returns empty string for empty input", () => {
		expect(stripInlineMarkdown("")).toBe("");
	});

	it("passes plain text through unchanged", () => {
		expect(stripInlineMarkdown("plain heading text")).toBe(
			"plain heading text",
		);
	});
});

describe("normalizeAnchorText (shared anchor-comparison normalization)", () => {
	it("returns empty string for empty input", () => {
		expect(normalizeAnchorText("")).toBe("");
	});

	it("strips inline markdown by default before domain normalization", () => {
		expect(normalizeAnchorText("**Bold** Heading")).toBe("Bold Heading");
	});

	it("skips markdown stripping when stripMarkdown is false", () => {
		expect(normalizeAnchorText("a_b: c", { stripMarkdown: false })).toBe(
			"a_b: c",
		);
	});

	it("collapses any whitespace run by default", () => {
		expect(normalizeAnchorText("a\tb  c")).toBe("a b c");
	});

	it("supports a narrower whitespace pattern (2+ literal spaces only)", () => {
		// A single tab is not collapsed under this narrower pattern.
		expect(normalizeAnchorText("a\tb", { whitespacePattern: / {2,}/g })).toBe(
			"a\tb",
		);
		expect(normalizeAnchorText("a  b", { whitespacePattern: / {2,}/g })).toBe(
			"a b",
		);
	});

	it("reproduces AnchorMatcher.cleanMarkdownForComparison's character set", () => {
		expect(
			normalizeAnchorText("Section: [Name]\\here", {
				colons: "space",
				removeBackslash: true,
				removeBrackets: true,
				whitespacePattern: / {2,}/g,
			}),
		).toBe("Section Namehere");
	});

	it("reproduces ParsedDocument.hasAnchor's colon-strip character set", () => {
		expect(
			normalizeAnchorText("Section: Name", {
				stripMarkdown: false,
				colons: "strip",
			}),
		).toBe("Section Name");
	});

	it("reproduces ParsedDocument._normalizeObsidianHeading's character set", () => {
		expect(
			normalizeAnchorText("Section: #Name |alt ^ref %%note%% [[wiki]]", {
				stripMarkdown: false,
				colons: "strip",
				removeHash: true,
				removePipe: true,
				removeCaret: true,
				removeCommentMarkers: true,
				removeWikiBrackets: true,
			}),
		).toBe("Section Name alt ref note wiki");
	});
});
