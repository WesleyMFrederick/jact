import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createMarkdownParser } from "../src/factories/componentFactory.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * POC: Block Extraction by Anchor ID
 *
 * This test suite proves we can extract single block content by anchor ID,
 * leveraging the existing MarkdownParser's anchor extraction capabilities:
 * - extractAnchors() detects ^anchor-id at end of lines (Obsidian format)
 * - MarkdownParser.Output.DataContract provides { anchorType, id, line, column }
 * - Content is reconstructed from original file content using line numbers
 *
 * Expected API:
 * extractBlock(content, anchors, blockId) => {
 *   anchor: { anchorType, id, line, column, ... },
 *   content: string,
 *   lineNumber: number
 * }
 *
 * Key Difference from Section Extraction:
 * - Sections: Extract heading + all content until next same-level heading (multi-line)
 * - Blocks: Extract ONLY the single line/paragraph containing ^anchor-id (single unit)
 */

/**
 * Extract a single block by anchor ID
 *
 * Blocks are individual content units (single line, paragraph, list item, heading)
 * that contain a block anchor (^anchor-id). Unlike sections which span multiple
 * content units, blocks represent atomic, citable units.
 *
 * @param {string} content - Full file content from parser
 * @param {Array} anchors - Anchor array from parser (contains { id, line, column, anchorType })
 * @param {string} blockId - The anchor ID to find (without ^ prefix)
 * @returns {Object|null} - { anchor, content, lineNumber } or null if not found
 */
function extractBlock(content, anchors, blockId) {
	// Find the anchor with matching ID
	const anchor = anchors.find(
		(a) => a.anchorType === "block" && a.id === blockId,
	);

	if (!anchor) {
		return null;
	}

	// Split content into lines (anchor.line is 1-based)
	const lines = content.split("\n");
	const lineIndex = anchor.line - 1;

	if (lineIndex < 0 || lineIndex >= lines.length) {
		return null;
	}

	// Extract the line containing the block anchor
	// Note: For now, we extract just the single line. In future iterations,
	// we may need to expand this to handle multi-line paragraphs or list items.
	const blockContent = lines[lineIndex];

	return {
		anchor: anchor,
		content: blockContent,
		lineNumber: anchor.line,
	};
}

describe("POC: Block Extraction by Anchor ID", () => {
	it("should extract a paragraph block by anchor ID", async () => {
		// Given: A markdown file with block anchors on paragraphs
		const parser = createMarkdownParser();
		const testFile = join(
			__dirname,
			"fixtures",
			"section-extraction",
			"source.md",
		);

		// When: Parse file and extract block by anchor ID
		const result = await parser.parseFile(testFile);
		const block = extractBlock(
			result.content,
			result.anchors,
			"first-section-intro",
		);

		// Then: Should return only that specific paragraph
		expect(block).not.toBeNull();
		expect(block.content).toContain("This is the content of the first section");
		expect(block.content).toContain("^first-section-intro");
		expect(block.lineNumber).toBe(7);
		expect(block.anchor.id).toBe("first-section-intro");
		expect(block.anchor.anchorType).toBe("block");

		// Should NOT include other paragraphs from the section
		expect(block.content).not.toContain("another paragraph");
	});

	it("should extract a different paragraph block in the same section", async () => {
		// Given: A markdown file with multiple block anchors
		const parser = createMarkdownParser();
		const testFile = join(
			__dirname,
			"fixtures",
			"section-extraction",
			"source.md",
		);

		// When: Parse file and extract second paragraph block
		const result = await parser.parseFile(testFile);
		const block = extractBlock(
			result.content,
			result.anchors,
			"important-info",
		);

		// Then: Should return only that specific paragraph, not the first one
		expect(block).not.toBeNull();
		expect(block.content).toContain("another paragraph in the first section");
		expect(block.content).toContain("important information");
		expect(block.content).toContain("^important-info");
		expect(block.lineNumber).toBe(9);

		// Should NOT include the first paragraph
		expect(block.content).not.toContain("content of the first section");
	});

	it("should extract a heading block with anchor", async () => {
		// Given: A markdown file with block anchor on heading
		const parser = createMarkdownParser();
		const testFile = join(
			__dirname,
			"fixtures",
			"section-extraction",
			"source.md",
		);

		// When: Parse file and extract heading block
		const result = await parser.parseFile(testFile);
		const block = extractBlock(result.content, result.anchors, "deep-heading");

		// Then: Should return only the heading line
		expect(block).not.toBeNull();
		expect(block.content).toContain("#### Deep Nested Section");
		expect(block.content).toContain("^deep-heading");
		expect(block.lineNumber).toBe(15);

		// Should NOT include content after the heading
		expect(block.content).not.toContain("important details");
	});

	it("should extract a list item block by anchor ID", async () => {
		// Given: A markdown file with block anchors on list items
		const parser = createMarkdownParser();
		const testFile = join(
			__dirname,
			"fixtures",
			"section-extraction",
			"source.md",
		);

		// When: Parse file and extract first list item
		const result = await parser.parseFile(testFile);
		const block = extractBlock(result.content, result.anchors, "list-item-1");

		// Then: Should return only that list item
		expect(block).not.toBeNull();
		expect(block.content).toContain("- First list item with details");
		expect(block.content).toContain("^list-item-1");
		expect(block.lineNumber).toBe(27);

		// Should NOT include other list items
		expect(block.content).not.toContain("Second list item");
		expect(block.content).not.toContain("Third list item");
	});

	it("should extract a different list item in the same list", async () => {
		// Given: A markdown file with multiple list items with anchors
		const parser = createMarkdownParser();
		const testFile = join(
			__dirname,
			"fixtures",
			"section-extraction",
			"source.md",
		);

		// When: Parse file and extract third list item
		const result = await parser.parseFile(testFile);
		const block = extractBlock(result.content, result.anchors, "list-item-3");

		// Then: Should return only the third list item
		expect(block).not.toBeNull();
		expect(block.content).toContain("- Third list item to test extraction");
		expect(block.content).toContain("^list-item-3");
		expect(block.lineNumber).toBe(29);

		// Should NOT include other list items
		expect(block.content).not.toContain("First list item");
		expect(block.content).not.toContain("Second list item");
	});

	it("should extract a paragraph block in the middle of a section", async () => {
		// Given: A markdown file with block anchor in middle of section
		const parser = createMarkdownParser();
		const testFile = join(
			__dirname,
			"fixtures",
			"section-extraction",
			"source.md",
		);

		// When: Parse file and extract mid-section paragraph
		const result = await parser.parseFile(testFile);
		const block = extractBlock(result.content, result.anchors, "mid-paragraph");

		// Then: Should return only that paragraph
		expect(block).not.toBeNull();
		expect(block.content).toContain(
			"paragraph in the middle of a section that needs a block reference",
		);
		expect(block.content).toContain("^mid-paragraph");
		expect(block.lineNumber).toBe(35);

		// Should NOT include surrounding paragraphs
		expect(block.content).not.toContain("Another paragraph without");
		expect(block.content).not.toContain("subsection belongs");
	});

	it("should return null when block anchor not found", async () => {
		// Given: A markdown file with block anchors
		const parser = createMarkdownParser();
		const testFile = join(
			__dirname,
			"fixtures",
			"section-extraction",
			"source.md",
		);

		// When: Try to extract non-existent block
		const result = await parser.parseFile(testFile);
		const block = extractBlock(
			result.content,
			result.anchors,
			"non-existent-block",
		);

		// Then: Should return null
		expect(block).toBeNull();
	});

	it("should validate anchor object structure from parser", async () => {
		// Given: A markdown file with block anchors
		const parser = createMarkdownParser();
		const testFile = join(
			__dirname,
			"fixtures",
			"section-extraction",
			"source.md",
		);

		// When: Parse file and extract any block
		const result = await parser.parseFile(testFile);
		const block = extractBlock(
			result.content,
			result.anchors,
			"first-section-intro",
		);

		// Then: Anchor should have proper structure from MarkdownParser
		expect(block).not.toBeNull();
		expect(block.anchor).toHaveProperty("anchorType", "block");
		expect(block.anchor).toHaveProperty("id");
		expect(block.anchor).toHaveProperty("line");
		expect(block.anchor).toHaveProperty("column");
		expect(block.anchor).toHaveProperty("fullMatch");

		// Line should be 1-based positive integer
		expect(block.anchor.line).toBeGreaterThan(0);
		expect(Number.isInteger(block.anchor.line)).toBe(true);

		// Column should be non-negative integer
		expect(block.anchor.column).toBeGreaterThanOrEqual(0);
		expect(Number.isInteger(block.anchor.column)).toBe(true);
	});

	it("should extract blocks from different sections independently", async () => {
		// Given: A markdown file with block anchors in different sections
		const parser = createMarkdownParser();
		const testFile = join(
			__dirname,
			"fixtures",
			"section-extraction",
			"source.md",
		);

		// When: Parse file and extract blocks from different sections
		const result = await parser.parseFile(testFile);
		const block1 = extractBlock(
			result.content,
			result.anchors,
			"first-section-intro",
		);
		const block2 = extractBlock(
			result.content,
			result.anchors,
			"mid-paragraph",
		);

		// Then: Both blocks should be extracted correctly and independently
		expect(block1).not.toBeNull();
		expect(block2).not.toBeNull();

		// Block 1 from First Section
		expect(block1.content).toContain("content of the first section");
		expect(block1.lineNumber).toBe(7);

		// Block 2 from Middle Section's subsection
		expect(block2.content).toContain("paragraph in the middle of a section");
		expect(block2.lineNumber).toBe(35);

		// Blocks should be completely independent
		expect(block1.content).not.toBe(block2.content);
		expect(block1.lineNumber).not.toBe(block2.lineNumber);
	});
});
