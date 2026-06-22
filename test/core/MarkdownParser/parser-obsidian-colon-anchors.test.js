import { describe, expect, it } from "vitest";
import { createMarkdownParser } from "../../../src/factories/componentFactory.js";
import ParsedDocument from "../../../src/ParsedDocument.js";

// Drive from raw markdown: parse the heading, let extractAnchors derive the
// header anchor (id + urlEncodedId), then assert hasAnchor against it. This
// exercises real anchor derivation instead of hand-fed anchor literals.
const parser = createMarkdownParser();
function docFromHeadings(...headingLines) {
	return new ParsedDocument(parser.parseContent(headingLines.join("\n\n")));
}

describe("ParsedDocument.hasAnchor — Obsidian Invalid Chars (#1)", () => {
	it("should match heading with colon when anchor has colon stripped", () => {
		const doc = docFromHeadings("### ADR-006: Title");

		// Obsidian produces this anchor (colon removed, space encoded)
		expect(doc.hasAnchor("ADR-006%20Title")).toBe(true);
		// URL-decoded version of Obsidian anchor (colon stripped): "ADR-006 Title"
		expect(doc.hasAnchor("ADR-006 Title")).toBe(true);
	});

	it("should match heading with colon using exact id match", () => {
		const doc = docFromHeadings("### MEDIUM-IMPLEMENTATION: Patterns");

		expect(doc.hasAnchor("MEDIUM-IMPLEMENTATION%20Patterns")).toBe(true);
		expect(doc.hasAnchor("MEDIUM-IMPLEMENTATION Patterns")).toBe(true);
	});

	it("should still match anchors without colons (no regression)", () => {
		const doc = docFromHeadings("## Simple Heading");

		expect(doc.hasAnchor("Simple Heading")).toBe(true);
		expect(doc.hasAnchor("Simple%20Heading")).toBe(true);
	});

	it("should match URL-decoded anchor against urlEncodedId after decoding", () => {
		const doc = docFromHeadings("### Story 1.5: Cache");

		// Obsidian link would be: #Story%201.5%20Cache
		expect(doc.hasAnchor("Story%201.5%20Cache")).toBe(true);
		// Decoded form: "Story 1.5 Cache" (colon removed)
		expect(doc.hasAnchor("Story 1.5 Cache")).toBe(true);
	});
});
