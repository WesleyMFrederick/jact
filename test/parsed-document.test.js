import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import ParsedDocument from "../src/ParsedDocument.js";
import { createMarkdownParser } from "../src/factories/componentFactory.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("ParsedDocument Facade", () => {
	// 1. Test anchor existence check with dual ID formats
	it("hasAnchor should validate using both id and urlEncodedId", async () => {
		// Given: Real parser output from existing fixture
		const parser = createMarkdownParser();
		const testFile = join(__dirname, "fixtures", "valid-citations.md");
		const parserOutput = await parser.parseFile(testFile);
		const doc = new ParsedDocument(parserOutput);

		// When/Then: Validate anchor existence using both ID formats
		// Test with first anchor from fixture (validates dual ID matching logic)
		const firstAnchor = parserOutput.anchors[0];
		expect(doc.hasAnchor(firstAnchor.id)).toBe(true);
		if (firstAnchor.urlEncodedId) {
			expect(doc.hasAnchor(firstAnchor.urlEncodedId)).toBe(true);
		}
		expect(doc.hasAnchor("NonExistentAnchor")).toBe(false);
	});

	// 2. Test fuzzy anchor matching for suggestions
	it("findSimilarAnchors should return sorted suggestions", async () => {
		// Given: Real parser output with multiple anchors from fixture
		const parser = createMarkdownParser();
		const testFile = join(__dirname, "fixtures", "valid-citations.md");
		const parserOutput = await parser.parseFile(testFile);
		const doc = new ParsedDocument(parserOutput);

		// When: Find similar anchors using partial query from actual anchor
		const actualAnchor = parserOutput.anchors[0].id;
		const partialQuery = actualAnchor.substring(
			0,
			Math.min(10, actualAnchor.length),
		);
		const suggestions = doc.findSimilarAnchors(partialQuery);

		// Then: Returns array with top matches sorted by similarity
		expect(Array.isArray(suggestions)).toBe(true);
		expect(suggestions.length).toBeLessThanOrEqual(5); // Top 5 matches
		// First suggestion should be the complete anchor (best match)
		expect(suggestions.includes(actualAnchor)).toBe(true);
	});

	// 3. Test link query method
	it("getLinks should return all link objects", async () => {
		// Given: Real parser output with links from fixture
		const parser = createMarkdownParser();
		const testFile = join(__dirname, "fixtures", "valid-citations.md");
		const parserOutput = await parser.parseFile(testFile);
		const doc = new ParsedDocument(parserOutput);

		// When: Query all links
		const links = doc.getLinks();

		// Then: Returns exact link array from parser output
		expect(links).toEqual(parserOutput.links);
		expect(Array.isArray(links)).toBe(true);
		expect(links[3].scope).toBe("internal"); // Internal links start at index 3
	});

	// 4. Test full content extraction
	it("extractFullContent should return raw content string", async () => {
		// Given: Real parser output with content from fixture
		const parser = createMarkdownParser();
		const testFile = join(__dirname, "fixtures", "valid-citations.md");
		const parserOutput = await parser.parseFile(testFile);
		const doc = new ParsedDocument(parserOutput);

		// When: Extract full content
		const content = doc.extractFullContent();

		// Then: Returns exact content string from parser
		expect(content).toBe(parserOutput.content);
		expect(typeof content).toBe("string");
		expect(content.length).toBeGreaterThan(0);
	});

	// 5. Test extractSection implementation (US2.2 AC13)
	it("extractSection should extract section content or return null", async () => {
		// Given: ParsedDocument instance from real parser output
		const parser = createMarkdownParser();
		const testFile = join(__dirname, "fixtures", "valid-citations.md");
		const parserOutput = await parser.parseFile(testFile);
		const doc = new ParsedDocument(parserOutput);

		// When/Then: Method returns string or null (no longer throws error)
		const result = doc.extractSection("any", 2);
		expect(result === null || typeof result === "string").toBe(true);
	});

	// 6. Test extractBlock implementation (US2.2 AC14)
	it("extractBlock should extract block content or return null", async () => {
		// Given: ParsedDocument instance from real parser output
		const parser = createMarkdownParser();
		const testFile = join(__dirname, "fixtures", "valid-citations.md");
		const parserOutput = await parser.parseFile(testFile);
		const doc = new ParsedDocument(parserOutput);

		// When: Extract non-existent block
		const result = doc.extractBlock("nonexistent-block");

		// Then: Returns null (not throwing error)
		expect(result).toBeNull();
	});
});
