import { describe, it, expect } from "vitest";
import { marked } from "marked";
import ParsedDocument from "../src/ParsedDocument.js";

describe("ParsedDocument - No Heading Duplication", () => {
	it("should not duplicate heading text in extracted sections", () => {
		// Given: Markdown with heading that has inline text tokens
		const markdown = `# Main Title

## Data Contracts

The component's output is strictly defined...

## Next Section`;

		// When: Using real marked tokens (which have nested text tokens)
		const tokens = marked.lexer(markdown);
		const parserOutput = {
			filePath: "/test/file.md",
			content: markdown,
			tokens: tokens,
			links: [],
			headings: [],
			anchors: [],
		};
		const doc = new ParsedDocument(parserOutput);

		// When: Extract section
		const section = doc.extractSection("Data Contracts", 2);

		// Then: Should not contain duplicated heading text
		expect(section).toBe(
			"## Data Contracts\n\nThe component's output is strictly defined...\n\n",
		);
		expect(section).not.toContain("Data ContractsThe component");
	});

	it("should handle headings with inline formatting without duplication", () => {
		// Given: Heading with bold text
		const markdown = `## **Important** Section

Content here.`;

		// When: Parse and extract
		const tokens = marked.lexer(markdown);
		const parserOutput = {
			filePath: "/test/file.md",
			content: markdown,
			tokens: tokens,
			links: [],
			headings: [],
			anchors: [],
		};
		const doc = new ParsedDocument(parserOutput);
		// Note: marked preserves ** in heading text, so we search for "**Important** Section"
		const section = doc.extractSection("**Important** Section", 2);

		// Then: Should extract cleanly without duplication
		expect(section).toContain("## **Important** Section");
		expect(section).toContain("Content here.");
		// Should not duplicate the "Important" text
		const textCount = (section.match(/Important/g) || []).length;
		expect(textCount).toBe(1); // Only once in the heading
	});

	it("should handle paragraphs with inline formatting without duplication", () => {
		// Given: Section with paragraph containing bold text
		const markdown = `## Test Section

This is **bold text** in a paragraph.

## Next`;

		// When: Parse and extract
		const tokens = marked.lexer(markdown);
		const parserOutput = {
			filePath: "/test/file.md",
			content: markdown,
			tokens: tokens,
			links: [],
			headings: [],
			anchors: [],
		};
		const doc = new ParsedDocument(parserOutput);
		const section = doc.extractSection("Test Section", 2);

		// Then: Should extract paragraph once, not duplicate inline content
		expect(section).toBe(
			"## Test Section\n\nThis is **bold text** in a paragraph.\n\n",
		);
		const boldCount = (section.match(/bold text/g) || []).length;
		expect(boldCount).toBe(1); // Only once, not duplicated
	});
});
