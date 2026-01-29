import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import ParsedDocument from "../src/ParsedDocument.js";
import { MarkdownParser } from "../src/MarkdownParser.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("ParsedDocument Content Extraction", () => {
	describe("extractSection", () => {
		it("should extract section content including nested headings", () => {
			// Given: Document with nested sections
			const parserOutput = {
				content: "## First\n\nContent here.\n\n### Sub\n\nNested.\n\n## Second",
				tokens: [
					{ type: "heading", depth: 2, text: "First", raw: "## First\n" },
					{ type: "paragraph", raw: "\nContent here.\n\n" },
					{ type: "heading", depth: 3, text: "Sub", raw: "### Sub\n" },
					{ type: "paragraph", raw: "\nNested.\n\n" },
					{ type: "heading", depth: 2, text: "Second", raw: "## Second" },
				],
			};
			const doc = new ParsedDocument(parserOutput);

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
			const parserOutput = {
				content: "## Existing",
				tokens: [
					{ type: "heading", depth: 2, text: "Existing", raw: "## Existing" },
				],
			};
			const doc = new ParsedDocument(parserOutput);

			// When: Extract non-existent section
			const section = doc.extractSection("Nonexistent", 2);

			// Then: Returns null
			expect(section).toBeNull();
		});

		it("should extract last section to end of document", () => {
			// Given: Document where target section is last
			const parserOutput = {
				content: "## First\n\nText.\n\n## Last\n\nFinal content.",
				tokens: [
					{ type: "heading", depth: 2, text: "First", raw: "## First\n" },
					{ type: "paragraph", raw: "\nText.\n\n" },
					{ type: "heading", depth: 2, text: "Last", raw: "## Last\n" },
					{ type: "paragraph", raw: "\nFinal content." },
				],
			};
			const doc = new ParsedDocument(parserOutput);

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
			const parser = new MarkdownParser({ readFileSync });
			const parserOutput = await parser.parseFile(fixturePath);
			const doc = new ParsedDocument(parserOutput);

			// When: Extract section using only heading text (no level parameter)
			const section = doc.extractSection("Overview (tl;dr)");

			// Then: Should extract the correct section
			expect(section).not.toBeNull();
			expect(section).toContain("## Overview (tl;dr)");
			expect(section).toContain("Citation Manager"); // Content from the section
			expect(section).not.toContain("## Goals"); // Next level 2 section
		});

		it("should match heading with colon when anchor has colon removed (Obsidian normalization)", () => {
			// Given: Document with heading containing colon (Obsidian invalid character)
			const parserOutput = {
				content: "## MEDIUM-IMPLEMENTATION: Implementation-Ready Patterns\n\nContent here.",
				tokens: [
					{
						type: "heading",
						depth: 2,
						text: "MEDIUM-IMPLEMENTATION: Implementation-Ready Patterns",
						raw: "## MEDIUM-IMPLEMENTATION: Implementation-Ready Patterns\n",
					},
					{ type: "paragraph", raw: "\nContent here." },
				],
				headings: [
					{
						text: "MEDIUM-IMPLEMENTATION: Implementation-Ready Patterns",
						level: 2,
					},
				],
			};
			const doc = new ParsedDocument(parserOutput);

			// When: Extract using Obsidian-normalized anchor (colon removed)
			const section = doc.extractSection(
				"MEDIUM-IMPLEMENTATION Implementation-Ready Patterns",
			);

			// Then: Should match and extract section
			expect(section).not.toBeNull();
			expect(section).toContain("MEDIUM-IMPLEMENTATION: Implementation-Ready Patterns");
			expect(section).toContain("Content here");
		});

		it("should match heading with pipe when anchor has pipe removed (Obsidian normalization)", () => {
			// Given: Document with heading containing pipe
			const parserOutput = {
				content: "## Test | Heading\n\nContent here.",
				tokens: [
					{
						type: "heading",
						depth: 2,
						text: "Test | Heading",
						raw: "## Test | Heading\n",
					},
					{ type: "paragraph", raw: "\nContent here." },
				],
				headings: [{ text: "Test | Heading", level: 2 }],
			};
			const doc = new ParsedDocument(parserOutput);

			// When: Extract using Obsidian-normalized anchor (pipe removed)
			const section = doc.extractSection("Test  Heading");

			// Then: Should match and extract section
			expect(section).not.toBeNull();
			expect(section).toContain("Test | Heading");
		});

		it("should match heading with caret when anchor has caret removed (Obsidian normalization)", () => {
			// Given: Document with heading containing caret
			const parserOutput = {
				content: "## Test ^ Heading\n\nContent here.",
				tokens: [
					{
						type: "heading",
						depth: 2,
						text: "Test ^ Heading",
						raw: "## Test ^ Heading\n",
					},
					{ type: "paragraph", raw: "\nContent here." },
				],
				headings: [{ text: "Test ^ Heading", level: 2 }],
			};
			const doc = new ParsedDocument(parserOutput);

			// When: Extract using Obsidian-normalized anchor (caret removed)
			const section = doc.extractSection("Test  Heading");

			// Then: Should match and extract section
			expect(section).not.toBeNull();
			expect(section).toContain("Test ^ Heading");
		});

		it("should match heading with hash when anchor has hash removed (Obsidian normalization)", () => {
			// Given: Document with heading containing hash
			const parserOutput = {
				content: "## Test # Heading\n\nContent here.",
				tokens: [
					{
						type: "heading",
						depth: 2,
						text: "Test # Heading",
						raw: "## Test # Heading\n",
					},
					{ type: "paragraph", raw: "\nContent here." },
				],
				headings: [{ text: "Test # Heading", level: 2 }],
			};
			const doc = new ParsedDocument(parserOutput);

			// When: Extract using Obsidian-normalized anchor (hash removed)
			const section = doc.extractSection("Test  Heading");

			// Then: Should match and extract section
			expect(section).not.toBeNull();
			expect(section).toContain("Test # Heading");
		});

		it("should match heading with %% when anchor has %% removed (Obsidian normalization)", () => {
			// Given: Document with heading containing comment markers
			const parserOutput = {
				content: "## Test %% Comment\n\nContent here.",
				tokens: [
					{
						type: "heading",
						depth: 2,
						text: "Test %% Comment",
						raw: "## Test %% Comment\n",
					},
					{ type: "paragraph", raw: "\nContent here." },
				],
				headings: [{ text: "Test %% Comment", level: 2 }],
			};
			const doc = new ParsedDocument(parserOutput);

			// When: Extract using Obsidian-normalized anchor (%% removed)
			const section = doc.extractSection("Test  Comment");

			// Then: Should match and extract section
			expect(section).not.toBeNull();
			expect(section).toContain("Test %% Comment");
		});

		it("should match heading with [[ ]] when anchor has wiki brackets removed (Obsidian normalization)", () => {
			// Given: Document with heading containing wiki link brackets
			const parserOutput = {
				content: "## Test [[Link]] Heading\n\nContent here.",
				tokens: [
					{
						type: "heading",
						depth: 2,
						text: "Test [[Link]] Heading",
						raw: "## Test [[Link]] Heading\n",
					},
					{ type: "paragraph", raw: "\nContent here." },
				],
				headings: [{ text: "Test [[Link]] Heading", level: 2 }],
			};
			const doc = new ParsedDocument(parserOutput);

			// When: Extract using Obsidian-normalized anchor (wiki brackets removed)
			const section = doc.extractSection("Test Link Heading");

			// Then: Should match and extract section
			expect(section).not.toBeNull();
			expect(section).toContain("Test [[Link]] Heading");
		});

		it("should match heading with multiple Obsidian invalid characters", () => {
			// Given: Document with heading containing multiple invalid characters
			const parserOutput = {
				content: "## Test: A | B ^ C\n\nContent here.",
				tokens: [
					{
						type: "heading",
						depth: 2,
						text: "Test: A | B ^ C",
						raw: "## Test: A | B ^ C\n",
					},
					{ type: "paragraph", raw: "\nContent here." },
				],
				headings: [{ text: "Test: A | B ^ C", level: 2 }],
			};
			const doc = new ParsedDocument(parserOutput);

			// When: Extract using Obsidian-normalized anchor (all invalid chars removed)
			const section = doc.extractSection("Test A  B  C");

			// Then: Should match and extract section
			expect(section).not.toBeNull();
			expect(section).toContain("Test: A | B ^ C");
		});

		it("should still match headings without Obsidian invalid characters (backward compatibility)", () => {
			// Given: Document with normal heading (no invalid characters)
			const parserOutput = {
				content: "## Normal Heading\n\nContent here.",
				tokens: [
					{
						type: "heading",
						depth: 2,
						text: "Normal Heading",
						raw: "## Normal Heading\n",
					},
					{ type: "paragraph", raw: "\nContent here." },
				],
				headings: [{ text: "Normal Heading", level: 2 }],
			};
			const doc = new ParsedDocument(parserOutput);

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
