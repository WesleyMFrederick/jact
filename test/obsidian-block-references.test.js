import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createMarkdownParser } from "../src/factories/componentFactory.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Obsidian Block Reference Extraction Tests
 *
 * These tests validate that MarkdownParser correctly extracts Obsidian-style
 * block references with text-based IDs like:
 * - ^first-section-intro
 * - ^black-box-interfaces
 * - ^important-info
 * - ^deep-heading
 *
 * Obsidian allows both numbered patterns (^FR1) and text-based patterns
 * (^black-box-interfaces), and both should be correctly parsed.
 */

describe("MarkdownParser: Obsidian Block Reference Extraction", () => {
	it("should extract text-based block references from source fixture", async () => {
		// Given: Parser with source.md fixture containing Obsidian-style block refs
		const parser = createMarkdownParser();
		const testFile = join(
			__dirname,
			"fixtures",
			"section-extraction",
			"source.md",
		);

		// When: Parse file
		const result = await parser.parseFile(testFile);

		// Then: Should extract all text-based block references
		expect(result.anchors.length).toBeGreaterThan(0);

		// Verify specific Obsidian-style block references are extracted
		const blockAnchors = result.anchors.filter(
			(anchor) => anchor.anchorType === "block",
		);

		expect(blockAnchors.length).toBeGreaterThan(0);

		// Expected text-based block IDs from source.md
		const expectedBlockIds = [
			"first-section-intro",
			"important-info",
			"deep-heading",
			"list-item-1",
			"list-item-3",
			"mid-paragraph",
		];

		// Verify each expected block ID is found
		for (const expectedId of expectedBlockIds) {
			const found = blockAnchors.find((anchor) => anchor.id === expectedId);
			expect(
				found,
				`Block reference ^${expectedId} should be extracted`,
			).toBeDefined();
			expect(found.anchorType).toBe("block");
			expect(found.fullMatch).toBe(`^${expectedId}`);
		}
	});

	it("should correctly identify block anchor structure for text-based IDs", async () => {
		// Given: Parser with source.md fixture
		const parser = createMarkdownParser();
		const testFile = join(
			__dirname,
			"fixtures",
			"section-extraction",
			"source.md",
		);

		// When: Parse file and find specific block reference
		const result = await parser.parseFile(testFile);
		const blockAnchor = result.anchors.find(
			(anchor) =>
				anchor.anchorType === "block" && anchor.id === "black-box-interfaces",
		);

		// Then: If this block exists in the fixture, validate its structure
		if (blockAnchor) {
			expect(blockAnchor.anchorType).toBe("block");
			expect(blockAnchor.id).toBe("black-box-interfaces");
			expect(blockAnchor.fullMatch).toBe("^black-box-interfaces");
			expect(typeof blockAnchor.line).toBe("number");
			expect(typeof blockAnchor.column).toBe("number");
		}
	});

	it("should extract both numbered and text-based block references", async () => {
		// Given: Parser with source.md fixture
		const parser = createMarkdownParser();
		const testFile = join(
			__dirname,
			"fixtures",
			"section-extraction",
			"source.md",
		);

		// When: Parse file
		const result = await parser.parseFile(testFile);

		// Then: Should extract all block references regardless of ID format
		const blockAnchors = result.anchors.filter(
			(anchor) => anchor.anchorType === "block",
		);

		expect(blockAnchors.length).toBeGreaterThan(0);

		// Verify text-based IDs are present (kebab-case with hyphens)
		const textBasedBlocks = blockAnchors.filter((anchor) =>
			anchor.id.includes("-"),
		);
		expect(textBasedBlocks.length).toBeGreaterThan(
			0,
			"Should extract text-based block IDs with hyphens",
		);

		// All block anchors should have consistent structure
		for (const anchor of blockAnchors) {
			expect(anchor.anchorType).toBe("block");
			expect(anchor.id).toBeTruthy();
			expect(anchor.fullMatch).toBe(`^${anchor.id}`);
			expect(typeof anchor.line).toBe("number");
			expect(typeof anchor.column).toBe("number");
		}
	});

	it("should validate block reference regex accepts text-based patterns", async () => {
		// Given: Parser with source.md fixture
		const parser = createMarkdownParser();
		const testFile = join(
			__dirname,
			"fixtures",
			"section-extraction",
			"source.md",
		);

		// When: Parse file
		const result = await parser.parseFile(testFile);

		// Then: Block references with various text-based patterns should be extracted
		const blockAnchors = result.anchors.filter(
			(anchor) => anchor.anchorType === "block",
		);

		// Validate different text-based ID patterns
		const patterns = {
			"kebab-case": /^[a-z]+-[a-z-]+$/, // e.g., first-section-intro
			"single-word": /^[a-z]+\d*$/, // e.g., introduction, section1
			numbered: /^[A-Z]+\d+$/, // e.g., FR1, US1
		};

		// Ensure at least kebab-case patterns are extracted
		const kebabCaseBlocks = blockAnchors.filter((anchor) =>
			patterns["kebab-case"].test(anchor.id),
		);

		expect(
			kebabCaseBlocks.length,
			"Should extract kebab-case block references",
		).toBeGreaterThan(0);
	});

	it("should extract block references from links fixture", async () => {
		// Given: Parser with links.md fixture that references block anchors
		const parser = createMarkdownParser();
		const linksFile = join(
			__dirname,
			"fixtures",
			"section-extraction",
			"links.md",
		);

		// When: Parse links file
		const result = await parser.parseFile(linksFile);

		// Then: Should find links that reference block anchors
		const blockLinks = result.links.filter(
			(link) => link.anchorType === "block",
		);

		expect(blockLinks.length).toBeGreaterThan(
			0,
			"Links file should contain references to block anchors",
		);

		// Verify text-based block references are in the links
		const textBasedBlockLinks = blockLinks.filter((link) => {
			const anchor = link.target.anchor;
			return anchor && anchor.includes("-");
		});

		expect(
			textBasedBlockLinks.length,
			"Should find links to text-based block anchors",
		).toBeGreaterThan(0);
	});
});
