import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createMarkdownParser } from "../src/factories/componentFactory.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * POC: Section Extraction by Walking Tokens
 *
 * This test suite proves we can extract section content by walking tokens
 * from the existing MarkdownParser, leveraging:
 * - marked.lexer() tokenization (already used in MarkdownParser.parseFile)
 * - extractHeadings() pattern for recursive token walking
 * - Parser Output Contract's tokens array
 *
 * Expected API:
 * extractSection(tokens, headingText, headingLevel) => {
 *   heading: { level, text, raw },
 *   tokens: [...],
 *   content: string
 * }
 */

/**
 * Extract a section from tokens by walking until next same-or-higher level heading
 *
 * Uses walkTokens-like pattern instead of manual flattening for several reasons:
 * 1. More idiomatic to marked.js ecosystem (mirrors marked.use({ walkTokens }) API)
 * 2. Processes tokens in-order during single traversal (child before sibling)
 * 3. Avoids creating intermediate flattened array (better memory efficiency)
 * 4. Easier to extend with additional token filtering/transformation logic
 *
 * @param {Array} tokens - Token array from marked.lexer()
 * @param {string} headingText - Text of the heading to find
 * @param {number} headingLevel - Level of the heading (1-6)
 * @returns {Object|null} - { heading, tokens, content } or null if not found
 */
function extractSection(tokens, headingText, headingLevel) {
	// Phase 1: Walk tokens to build ordered list and find target
	// This mimics walkTokens API where child tokens are processed before siblings
	const orderedTokens = [];
	let targetToken = null;
	let targetIndex = -1;

	const walkTokens = (tokenList) => {
		for (const token of tokenList) {
			// Record current token position
			const currentIndex = orderedTokens.length;
			orderedTokens.push(token);

			// Check if this is our target heading
			if (
				!targetToken &&
				token.type === "heading" &&
				token.depth === headingLevel &&
				token.text === headingText
			) {
				targetToken = token;
				targetIndex = currentIndex;
			}

			// Process nested tokens (child before sibling, like walkTokens API)
			if (token.tokens) {
				walkTokens(token.tokens);
			}
		}
	};

	walkTokens(tokens);

	// Return null if heading not found
	if (!targetToken) {
		return null;
	}

	// Phase 2: Find section boundary (next same-or-higher level heading)
	let endIndex = orderedTokens.length;
	for (let i = targetIndex + 1; i < orderedTokens.length; i++) {
		const token = orderedTokens[i];
		if (token.type === "heading" && token.depth <= headingLevel) {
			endIndex = i;
			break;
		}
	}

	// Extract section tokens and reconstruct content
	const sectionTokens = orderedTokens.slice(targetIndex, endIndex);
	const content = sectionTokens.map((t) => t.raw).join("");

	return {
		heading: {
			level: targetToken.depth,
			text: targetToken.text,
			raw: targetToken.raw,
		},
		tokens: sectionTokens,
		content: content,
	};
}

describe("POC: Section Extraction by Token Walking", () => {
	it("should extract H2 section including all nested H3/H4 content", async () => {
		// Given: Parser with source.md fixture
		const parser = createMarkdownParser();
		const testFile = join(
			__dirname,
			"fixtures",
			"section-extraction",
			"source.md",
		);

		// When: Parse file and extract "First Section" (H2)
		const result = await parser.parseFile(testFile);
		const section = extractSection(result.tokens, "First Section", 2);

		// Then: Section includes H2 and all nested content until next H2
		expect(section).not.toBeNull();
		expect(section.heading).toBeDefined();
		expect(section.heading.level).toBe(2);
		expect(section.heading.text).toBe("First Section");

		// Should include the H3 "Nested Subsection"
		expect(section.content).toContain("Nested Subsection");

		// Should include the H4 "Deep Nested Section"
		expect(section.content).toContain("Deep Nested Section");

		// Should NOT include next H2 "Middle Section"
		expect(section.content).not.toContain("Middle Section");

		// Validate tokens array is populated
		expect(Array.isArray(section.tokens)).toBe(true);
		expect(section.tokens.length).toBeGreaterThan(0);
	});

	it("should extract H3 section including nested H4 but stopping at next H2/H3", async () => {
		// Given: Parser with source.md fixture
		const parser = createMarkdownParser();
		const testFile = join(
			__dirname,
			"fixtures",
			"section-extraction",
			"source.md",
		);

		// When: Parse file and extract "Nested Subsection" (H3)
		const result = await parser.parseFile(testFile);
		const section = extractSection(result.tokens, "Nested Subsection", 3);

		// Then: Section includes H3 and nested H4 content
		expect(section).not.toBeNull();
		expect(section.heading.level).toBe(3);
		expect(section.heading.text).toBe("Nested Subsection");

		// Should include the nested H4 "Deep Nested Section"
		expect(section.content).toContain("Deep Nested Section");

		// Should include H4 content
		expect(section.content).toContain(
			"important details about the implementation",
		);

		// Should NOT include next H2 "Middle Section"
		expect(section.content).not.toContain("Middle Section");

		// Validate structure
		expect(Array.isArray(section.tokens)).toBe(true);
		expect(typeof section.content).toBe("string");
	});

	it("should extract H4 section stopping at next H2/H3/H4", async () => {
		// Given: Parser with source.md fixture
		const parser = createMarkdownParser();
		const testFile = join(
			__dirname,
			"fixtures",
			"section-extraction",
			"source.md",
		);

		// When: Parse file and extract "Deep Nested Section" (H4)
		const result = await parser.parseFile(testFile);
		const section = extractSection(result.tokens, "Deep Nested Section", 4);

		// Then: Section includes only H4 content until next heading
		expect(section).not.toBeNull();
		expect(section.heading.level).toBe(4);
		expect(section.heading.text).toBe("Deep Nested Section");

		// Should include H4's own content
		expect(section.content).toContain(
			"important details about the implementation",
		);
		expect(section.content).toContain("Some more content in the H4 section");

		// Should NOT include next H2 "Middle Section"
		expect(section.content).not.toContain("Middle Section");

		// Validate structure
		expect(section.tokens.length).toBeGreaterThan(0);
		expect(section.content.length).toBeGreaterThan(0);
	});

	it("should extract last H2 section including all remaining content", async () => {
		// Given: Parser with source.md fixture
		const parser = createMarkdownParser();
		const testFile = join(
			__dirname,
			"fixtures",
			"section-extraction",
			"source.md",
		);

		// When: Parse file and extract "Last Section" (H2)
		const result = await parser.parseFile(testFile);
		const section = extractSection(result.tokens, "Last Section", 2);

		// Then: Section includes all content from H2 to end of file
		expect(section).not.toBeNull();
		expect(section.heading.level).toBe(2);
		expect(section.heading.text).toBe("Last Section");

		// Should include the nested H3 "Final Subsection"
		expect(section.content).toContain("Final Subsection");

		// Should include content after the last subsection
		expect(section.content).toContain(
			"All content after this point should be included",
		);

		// Validate structure
		expect(section.tokens.length).toBeGreaterThan(0);
		expect(typeof section.content).toBe("string");
	});

	it("should return null when heading not found", async () => {
		// Given: Parser with source.md fixture
		const parser = createMarkdownParser();
		const testFile = join(
			__dirname,
			"fixtures",
			"section-extraction",
			"source.md",
		);

		// When: Parse file and try to extract non-existent section
		const result = await parser.parseFile(testFile);
		const section = extractSection(result.tokens, "Non-Existent Section", 2);

		// Then: Should return null
		expect(section).toBeNull();
	});

	it("should validate tokens array contains proper token structure", async () => {
		// Given: Parser with source.md fixture
		const parser = createMarkdownParser();
		const testFile = join(
			__dirname,
			"fixtures",
			"section-extraction",
			"source.md",
		);

		// When: Parse file and extract any section
		const result = await parser.parseFile(testFile);
		const section = extractSection(result.tokens, "First Section", 2);

		// Then: Tokens should have marked.js structure
		expect(section).not.toBeNull();
		expect(Array.isArray(section.tokens)).toBe(true);

		// First token should be the heading itself
		const firstToken = section.tokens[0];
		expect(firstToken.type).toBe("heading");
		expect(firstToken.depth).toBe(2);
		expect(firstToken.text).toBe("First Section");

		// Other tokens should have valid types (paragraph, heading, etc.)
		for (const token of section.tokens) {
			expect(token).toHaveProperty("type");
			expect(token).toHaveProperty("raw");
		}
	});

	it("should reconstruct content from tokens' raw property", async () => {
		// Given: Parser with source.md fixture
		const parser = createMarkdownParser();
		const testFile = join(
			__dirname,
			"fixtures",
			"section-extraction",
			"source.md",
		);

		// When: Parse file and extract section
		const result = await parser.parseFile(testFile);
		const section = extractSection(result.tokens, "Middle Section", 2);

		// Then: Content should be reconstructed from tokens' raw property
		expect(section).not.toBeNull();

		// Verify content can be reconstructed from tokens
		const reconstructed = section.tokens.map((t) => t.raw).join("");
		expect(reconstructed).toBe(section.content);

		// Verify content includes expected text
		expect(section.content).toContain("## Middle Section");
		expect(section.content).toContain(
			"This is the middle section with different content",
		);
	});
});
