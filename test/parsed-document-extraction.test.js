import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createMarkdownParser } from "../src/factories/componentFactory.js";
import ParsedDocument from "../src/ParsedDocument.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Drive tests from raw markdown through the real parser (with a wired FileCache),
// so they exercise the actual mdast pipeline rather than hand-built token literals.
const parser = createMarkdownParser();
function docFromMarkdown(content) {
	return new ParsedDocument(parser.parseContent(content));
}

describe("ParsedDocument Content Extraction", () => {
	describe("extractSection", () => {
		it("should extract section content including nested headings", () => {
			// Given: Document with nested sections
			const doc = docFromMarkdown(
				"## First\n\nContent here.\n\n### Sub\n\nNested.\n\n## Second",
			);

			// When: Extract section by heading text
			const section = doc.extractSection("First", 2);

			// Then: Section includes heading, content, and nested subsections up to next same-level heading
			expect(section).toContain("## First");
			expect(section).toContain("Content here");
			expect(section).toContain("### Sub");
			expect(section).toContain("Nested");
			expect(section).not.toContain("Second");
		});

		it("should return null when heading not found", () => {
			// Given: Document without target heading
			const doc = docFromMarkdown("## Existing");

			// When: Extract non-existent section
			const section = doc.extractSection("Nonexistent", 2);

			// Then: Returns null
			expect(section).toBeNull();
		});

		it("should extract last section to end of document", () => {
			// Given: Document where target section is last
			const doc = docFromMarkdown(
				"## First\n\nText.\n\n## Last\n\nFinal content.",
			);

			// When: Extract last section
			const section = doc.extractSection("Last", 2);

			// Then: Includes all content to end of file
			expect(section).toContain("## Last");
			expect(section).toContain("Final content");
		});

		it("should extract section by heading text only without level parameter", async () => {
			// Given: Real-world document parsed with MarkdownParser
			const fixturePath = join(
				__dirname,
				"fixtures",
				"content-aggregation-prd.md",
			);
			const parserOutput = await parser.parseFile(fixturePath);
			const doc = new ParsedDocument(parserOutput);

			// When: Extract section using only heading text (no level parameter)
			const section = doc.extractSection("Overview (tl;dr)");

			// Then: Should extract the correct section
			expect(section).not.toBeNull();
			expect(section).toContain("## Overview (tl;dr)");
			expect(section).toContain("**Baseline:**"); // Content from the section
			expect(section).not.toContain("## Goals"); // Next level 2 section
		});

		it("should match heading with colon when anchor has colon removed (Obsidian normalization)", () => {
			// Given: Document with heading containing colon (Obsidian invalid character)
			const doc = docFromMarkdown(
				"## MEDIUM-IMPLEMENTATION: Implementation-Ready Patterns\n\nContent here.",
			);

			// When: Extract using Obsidian-normalized anchor (colon removed)
			const section = doc.extractSection(
				"MEDIUM-IMPLEMENTATION Implementation-Ready Patterns",
			);

			// Then: Should match and extract section
			expect(section).not.toBeNull();
			expect(section).toContain(
				"MEDIUM-IMPLEMENTATION: Implementation-Ready Patterns",
			);
			expect(section).toContain("Content here");
		});

		it("should match heading with pipe when anchor has pipe removed (Obsidian normalization)", () => {
			// Given: Document with heading containing pipe
			const doc = docFromMarkdown("## Test | Heading\n\nContent here.");

			// When: Extract using Obsidian-normalized anchor (pipe removed)
			const section = doc.extractSection("Test  Heading");

			// Then: Should match and extract section
			expect(section).not.toBeNull();
			expect(section).toContain("Test | Heading");
		});

		it("should match heading with caret when anchor has caret removed (Obsidian normalization)", () => {
			// Given: Document with heading containing caret
			const doc = docFromMarkdown("## Test ^ Heading\n\nContent here.");

			// When: Extract using Obsidian-normalized anchor (caret removed)
			const section = doc.extractSection("Test  Heading");

			// Then: Should match and extract section
			expect(section).not.toBeNull();
			expect(section).toContain("Test ^ Heading");
		});

		it("should match heading with hash when anchor has hash removed (Obsidian normalization)", () => {
			// Given: Document with heading containing hash
			const doc = docFromMarkdown("## Test # Heading\n\nContent here.");

			// When: Extract using Obsidian-normalized anchor (hash removed)
			const section = doc.extractSection("Test  Heading");

			// Then: Should match and extract section
			expect(section).not.toBeNull();
			expect(section).toContain("Test # Heading");
		});

		it("should match heading with %% when anchor has %% removed (Obsidian normalization)", () => {
			// Given: Document with heading containing comment markers
			const doc = docFromMarkdown("## Test %% Comment\n\nContent here.");

			// When: Extract using Obsidian-normalized anchor (%% removed)
			const section = doc.extractSection("Test  Comment");

			// Then: Should match and extract section
			expect(section).not.toBeNull();
			expect(section).toContain("Test %% Comment");
		});

		it("should match heading with [[ ]] when anchor has wiki brackets removed (Obsidian normalization)", () => {
			// Given: Document with heading containing wiki link brackets
			const doc = docFromMarkdown("## Test [[Link]] Heading\n\nContent here.");

			// When: Extract using Obsidian-normalized anchor (wiki brackets removed)
			const section = doc.extractSection("Test Link Heading");

			// Then: Should match and extract section
			expect(section).not.toBeNull();
			expect(section).toContain("Test [[Link]] Heading");
		});

		it("should match heading with multiple Obsidian invalid characters", () => {
			// Given: Document with heading containing multiple invalid characters
			const doc = docFromMarkdown("## Test: A | B ^ C\n\nContent here.");

			// When: Extract using Obsidian-normalized anchor (all invalid chars removed)
			const section = doc.extractSection("Test A  B  C");

			// Then: Should match and extract section
			expect(section).not.toBeNull();
			expect(section).toContain("Test: A | B ^ C");
		});

		it("should match URL-decoded anchor with collapsed whitespace against heading with colon (Issue #14)", () => {
			// Given: Document with heading "Level 3: Components"
			const doc = docFromMarkdown(
				"## Level 3: Components\n\nComponent details here.\n\n## Next Section",
			);

			// When: Extract using decoded URL anchor (single space, as ContentExtractor does)
			const section = doc.extractSection("Level 3 Components");

			// Then: Should match the heading and extract section
			expect(section).not.toBeNull();
			expect(section).toContain("Level 3: Components");
			expect(section).toContain("Component details here");
			expect(section).not.toContain("Next Section");
		});

		it("should match URL-decoded anchor with collapsed whitespace for multiple special chars (Issue #14)", () => {
			// Given: Heading with multiple Obsidian-invalid chars creating whitespace gaps
			const doc = docFromMarkdown(
				"## Story 1.5: Cache | Design\n\nDesign content.",
			);

			// When: Extract using URL-decoded form (whitespace collapsed)
			const section = doc.extractSection("Story 1.5 Cache Design");

			// Then: Should match
			expect(section).not.toBeNull();
			expect(section).toContain("Story 1.5: Cache | Design");
		});

		it("should still match headings without Obsidian invalid characters (backward compatibility)", () => {
			// Given: Document with normal heading (no invalid characters)
			const doc = docFromMarkdown("## Normal Heading\n\nContent here.");

			// When: Extract using exact heading text
			const section = doc.extractSection("Normal Heading");

			// Then: Should still match (normalization doesn't break normal headings)
			expect(section).not.toBeNull();
			expect(section).toContain("Normal Heading");
		});
	});

	describe("extractBlock", () => {
		it("should extract single line containing block anchor", () => {
			// Given: Document with block anchor
			const parserOutput = {
				content: "Line 1\nImportant content. ^block-id\nLine 3",
				anchors: [{ anchorType: "block", id: "block-id", line: 2, column: 20 }],
			};
			const doc = new ParsedDocument(parserOutput);

			// When: Extract block by anchor ID
			const block = doc.extractBlock("block-id");

			// Then: Returns line containing block anchor
			expect(block).toBe("Important content. ^block-id");
		});

		it("should return null when block anchor not found", () => {
			// Given: Document without target block
			const parserOutput = {
				content: "Some content",
				anchors: [{ anchorType: "block", id: "existing", line: 1 }],
			};
			const doc = new ParsedDocument(parserOutput);

			// When: Extract non-existent block
			const block = doc.extractBlock("nonexistent");

			// Then: Returns null
			expect(block).toBeNull();
		});

		it("should return null when line index out of bounds", () => {
			// Given: Document with invalid line number in anchor
			const parserOutput = {
				content: "Line 1",
				anchors: [{ anchorType: "block", id: "invalid", line: 999, column: 0 }],
			};
			const doc = new ParsedDocument(parserOutput);

			// When: Extract block with out-of-bounds line
			const block = doc.extractBlock("invalid");

			// Then: Returns null (defensive check)
			expect(block).toBeNull();
		});

		it("should not return header anchors when searching for block", () => {
			// Given: Document with header anchor having same ID
			const parserOutput = {
				content: "## Header Name",
				anchors: [
					{ anchorType: "header", id: "header-name", line: 1, column: 0 },
				],
			};
			const doc = new ParsedDocument(parserOutput);

			// When: Extract with anchor ID that belongs to header
			const block = doc.extractBlock("header-name");

			// Then: Returns null (only block anchors matched)
			expect(block).toBeNull();
		});
	});
});
