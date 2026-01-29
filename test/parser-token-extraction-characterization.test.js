import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, beforeAll } from "vitest";
import { createMarkdownParser } from "../src/factories/componentFactory.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * CHARACTERIZATION TESTS for Token-First Extraction (#28)
 *
 * These tests capture the EXACT current behavior of extractLinks().
 * They must pass before AND after refactoring.
 * DO NOT modify these tests during the refactor — they ARE the safety net.
 */
describe("extractLinks() — Characterization Tests (#28)", () => {
	let parser;

	beforeAll(() => {
		parser = createMarkdownParser();
	});

	it("should produce exact link count for valid-citations.md", async () => {
		const testFile = join(__dirname, "fixtures", "valid-citations.md");
		const result = await parser.parseFile(testFile);

		// Baseline: capture actual count from current implementation
		// valid-citations.md has:
		// - 3 cross-document markdown links (lines 7-9)
		// - 5 caret syntax references (lines 13-16)
		// - 3 wiki-style internal references (lines 21-22)
		expect(result.links.length).toBeGreaterThan(0);
		expect(result.links.length).toBe(11);
	});

	it("should produce exact link count for enhanced-citations.md", async () => {
		const testFile = join(__dirname, "fixtures", "enhanced-citations.md");
		const result = await parser.parseFile(testFile);

		// Baseline: capture actual count from current implementation
		// enhanced-citations.md has:
		// - 5 standard markdown links with anchors (lines 7-8)
		// - 3 standard markdown links without anchors (lines 12-14)
		// - 3 citation format links (lines 18-20)
		// - 1 mixed content link (line 24, first one)
		// - 2 caret references (lines 28-29)
		expect(result.links.length).toBeGreaterThan(0);
		expect(result.links.length).toBe(12);
	});

	it("should preserve cross-document link path resolution", async () => {
		const testFile = join(__dirname, "fixtures", "valid-citations.md");
		const result = await parser.parseFile(testFile);

		const crossDocLinks = result.links.filter(l => l.scope === "cross-document");
		expect(crossDocLinks.length).toBeGreaterThan(0);

		for (const link of crossDocLinks) {
			// Raw path must be non-null for cross-document links
			expect(link.target.path.raw).not.toBeNull();
			// Absolute path must be resolved
			expect(link.target.path.absolute).not.toBeNull();
		}
	});

	it("should preserve internal link properties", async () => {
		const testFile = join(__dirname, "fixtures", "valid-citations.md");
		const result = await parser.parseFile(testFile);

		const internalLinks = result.links.filter(l => l.scope === "internal");
		expect(internalLinks.length).toBeGreaterThan(0);

		for (const link of internalLinks) {
			// Internal links have null paths
			expect(link.target.path.raw).toBeNull();
			expect(link.target.path.absolute).toBeNull();
			expect(link.target.path.relative).toBeNull();
		}
	});

	it("should preserve line and column positions", async () => {
		const testFile = join(__dirname, "fixtures", "valid-citations.md");
		const result = await parser.parseFile(testFile);

		for (const link of result.links) {
			expect(typeof link.line).toBe("number");
			expect(link.line).toBeGreaterThan(0); // 1-based
			expect(typeof link.column).toBe("number");
			expect(link.column).toBeGreaterThanOrEqual(0); // 0-based
		}
	});

	it("should preserve extraction marker detection", async () => {
		const testFile = join(__dirname, "fixtures", "valid-citations.md");
		const result = await parser.parseFile(testFile);

		// extractionMarker should be present on all links (null or object)
		for (const link of result.links) {
			expect(link).toHaveProperty("extractionMarker");
			if (link.extractionMarker !== null) {
				expect(link.extractionMarker).toHaveProperty("fullMatch");
				expect(link.extractionMarker).toHaveProperty("innerText");
			}
		}
	});

	it("should preserve all link object properties", async () => {
		const testFile = join(__dirname, "fixtures", "valid-citations.md");
		const result = await parser.parseFile(testFile);

		for (const link of result.links) {
			expect(link).toHaveProperty("linkType");
			expect(link).toHaveProperty("scope");
			expect(link).toHaveProperty("target");
			expect(link).toHaveProperty("line");
			expect(link).toHaveProperty("column");
			expect(link).toHaveProperty("fullMatch");
			expect(link).toHaveProperty("extractionMarker");
			expect(link).toHaveProperty("source");
			expect(link.target).toHaveProperty("anchor");
			expect(link.target).toHaveProperty("path");
		}
	});

	it("should preserve markdown link type detection", async () => {
		const testFile = join(__dirname, "fixtures", "valid-citations.md");
		const result = await parser.parseFile(testFile);

		const markdownLinks = result.links.filter(l => l.linkType === "markdown");
		expect(markdownLinks.length).toBeGreaterThan(0);

		// All markdown links should have valid properties
		for (const link of markdownLinks) {
			expect(link.linkType).toBe("markdown");
		}
	});

	it("should preserve wiki link type detection", async () => {
		const testFile = join(__dirname, "fixtures", "valid-citations.md");
		const result = await parser.parseFile(testFile);

		const wikiLinks = result.links.filter(l => l.linkType === "wiki");
		expect(wikiLinks.length).toBeGreaterThan(0);

		for (const link of wikiLinks) {
			expect(link.linkType).toBe("wiki");
		}
	});

	it("should preserve anchor type classification", async () => {
		const testFile = join(__dirname, "fixtures", "valid-citations.md");
		const result = await parser.parseFile(testFile);

		const linksWithAnchors = result.links.filter(l => l.target.anchor !== null);
		expect(linksWithAnchors.length).toBeGreaterThan(0);

		for (const link of linksWithAnchors) {
			expect(["header", "block", null]).toContain(link.anchorType);
		}
	});

	it("should preserve cite format link extraction", async () => {
		const testFile = join(__dirname, "fixtures", "enhanced-citations.md");
		const result = await parser.parseFile(testFile);

		const citeLinks = result.links.filter(
			l => l.text && l.text.startsWith("cite:")
		);
		expect(citeLinks.length).toBeGreaterThan(0);

		for (const link of citeLinks) {
			expect(link.scope).toBe("cross-document");
			expect(link.linkType).toBe("markdown");
			expect(link.target.anchor).toBeNull();
		}
	});
});
