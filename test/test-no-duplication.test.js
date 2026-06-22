import { describe, expect, it } from "vitest";
import { createMarkdownParser } from "../src/factories/componentFactory.js";
import ParsedDocument from "../src/ParsedDocument.js";

// Drive from raw markdown through the real parser (mdast pipeline).
const parser = createMarkdownParser();
function docFromMarkdown(content) {
	return new ParsedDocument(parser.parseContent(content));
}

describe("ParsedDocument - No Heading Duplication", () => {
	it("should not duplicate heading text in extracted sections", () => {
		// Given: Markdown with heading that has inline text
		const markdown = `# Main Title

## Data Contracts

The component's output is strictly defined...

## Next Section`;

		const doc = docFromMarkdown(markdown);

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

		const doc = docFromMarkdown(markdown);
		// Heading text preserves inline markdown markers (parity with the prior
		// marked contract), so the heading text is "**Important** Section".
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

		const doc = docFromMarkdown(markdown);
		const section = doc.extractSection("Test Section", 2);

		// Then: Should extract paragraph once, not duplicate inline content
		expect(section).toBe(
			"## Test Section\n\nThis is **bold text** in a paragraph.\n\n",
		);
		const boldCount = (section.match(/bold text/g) || []).length;
		expect(boldCount).toBe(1); // Only once, not duplicated
	});
});
