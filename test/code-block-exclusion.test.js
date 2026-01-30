import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, beforeAll } from "vitest";
import { createMarkdownParser } from "../src/factories/componentFactory.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * REGRESSION TEST for Issue #39: Citation Validator False Positives in Code Blocks
 *
 * Links appearing inside fenced code blocks and inline code spans should NOT be extracted
 * for validation, as they are code examples, not navigable citations.
 */
describe("extractLinks() — Code Block Exclusion (Issue #39)", () => {
	let parser;

	beforeAll(() => {
		parser = createMarkdownParser();
	});

	it("should exclude markdown links inside fenced code blocks", async () => {
		const testFile = join(__dirname, "fixtures", "code-blocks-with-links.md");
		const result = await parser.parseFile(testFile);

		// The fixture has 2 real links (outside code blocks):
		// - [Real Link](./real-file.md) on line 5
		// - [#real-section](#real-section) on line 27
		// And 4 links inside code blocks that should be ignored:
		// - [Example Link](./example.md#section) on line 12 (in markdown code block)
		// - [Another Example](../path/to/file.md) on line 13 (in markdown code block)
		// - [docs](./api-docs.md) on line 19 (in javascript code block)
		// - [Plain Code Block](./should-not-validate.md) on line 32 (in plain code block)

		const allLinks = result.links.filter(l => l.linkType === "markdown");
		expect(allLinks.length).toBe(2);

		// Check the cross-document link
		const crossDocLinks = allLinks.filter(l => l.scope === "cross-document");
		expect(crossDocLinks.length).toBe(1);
		expect(crossDocLinks[0].text).toBe("Real Link");
		expect(crossDocLinks[0].line).toBe(5);

		// Check the internal link
		const internalLinks = allLinks.filter(l => l.scope === "internal");
		expect(internalLinks.length).toBe(1);
		expect(internalLinks[0].target.anchor).toBe("real-section");
		expect(internalLinks[0].line).toBe(27);
	});

	it("should exclude markdown links inside inline code spans", async () => {
		const testFile = join(__dirname, "fixtures", "inline-code-with-links.md");
		const result = await parser.parseFile(testFile);

		// The fixture has:
		// - 1 real markdown link outside code (should be extracted)
		// - 1 link inside inline code backticks (should be ignored)
		const markdownLinks = result.links.filter(l => l.linkType === "markdown");

		expect(markdownLinks.length).toBe(1);
		expect(markdownLinks[0].text).toBe("Valid Link");
	});

	it("should exclude internal anchor links inside fenced code blocks", async () => {
		const testFile = join(__dirname, "fixtures", "code-blocks-with-links.md");
		const result = await parser.parseFile(testFile);

		// Check for internal links (anchors starting with #)
		const internalLinks = result.links.filter(
			l => l.scope === "internal" && l.linkType === "markdown"
		);

		// Only the real internal link should be extracted, not the ones in code blocks
		expect(internalLinks.length).toBe(1);
		expect(internalLinks[0].target.anchor).toBe("real-section");
	});

	it("should still extract links from regular markdown content", async () => {
		const testFile = join(__dirname, "fixtures", "code-blocks-with-links.md");
		const result = await parser.parseFile(testFile);

		// Verify we're still extracting real links
		expect(result.links.length).toBeGreaterThan(0);

		// All extracted links should have proper line numbers
		for (const link of result.links) {
			expect(link.line).toBeGreaterThan(0);
			expect(link.column).toBeGreaterThanOrEqual(0);
		}
	});
});
