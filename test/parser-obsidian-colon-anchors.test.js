import { describe, expect, it } from "vitest";
import ParsedDocument from "../src/ParsedDocument.js";

// Helper to create minimal ParserOutput for testing
function createParserOutput(headings, anchors) {
  return {
    filePath: "/test/target.md",
    content: headings.map(h => `${"#".repeat(h.level)} ${h.text}`).join("\n"),
    tokens: [],
    links: [],
    headings: headings,
    anchors: anchors,
  };
}

describe("ParsedDocument.hasAnchor — Obsidian Invalid Chars (#1)", () => {
  it("should match heading with colon when anchor has colon stripped", () => {
    // Heading: "### ADR-006: Title"
    // Obsidian anchor: "#ADR-006%20Title" (colon removed, space→%20)
    const headings = [{ level: 3, text: "ADR-006: Title", raw: "### ADR-006: Title\n" }];
    const anchors = [{
      anchorType: "header",
      id: "ADR-006: Title",
      urlEncodedId: "ADR-006%20Title", // colon removed per extractAnchors
      rawText: "ADR-006: Title",
      fullMatch: "### ADR-006: Title",
      line: 1,
      column: 0,
    }];

    const doc = new ParsedDocument(createParserOutput(headings, anchors));

    // URL-decoded version of Obsidian anchor (colon stripped): "ADR-006 Title"
    expect(doc.hasAnchor("ADR-006%20Title")).toBe(true);
    expect(doc.hasAnchor("ADR-006 Title")).toBe(true);
  });

  it("should match heading with colon using exact id match", () => {
    const headings = [{ level: 3, text: "MEDIUM-IMPLEMENTATION: Patterns", raw: "### MEDIUM-IMPLEMENTATION: Patterns\n" }];
    const anchors = [{
      anchorType: "header",
      id: "MEDIUM-IMPLEMENTATION: Patterns",
      urlEncodedId: "MEDIUM-IMPLEMENTATION%20Patterns",
      rawText: "MEDIUM-IMPLEMENTATION: Patterns",
      fullMatch: "### MEDIUM-IMPLEMENTATION: Patterns",
      line: 1,
      column: 0,
    }];

    const doc = new ParsedDocument(createParserOutput(headings, anchors));

    // Obsidian produces this anchor (colon removed, space encoded)
    expect(doc.hasAnchor("MEDIUM-IMPLEMENTATION%20Patterns")).toBe(true);
    // URL-decoded version
    expect(doc.hasAnchor("MEDIUM-IMPLEMENTATION Patterns")).toBe(true);
  });

  it("should still match anchors without colons (no regression)", () => {
    const headings = [{ level: 2, text: "Simple Heading", raw: "## Simple Heading\n" }];
    const anchors = [{
      anchorType: "header",
      id: "Simple Heading",
      urlEncodedId: "Simple%20Heading",
      rawText: "Simple Heading",
      fullMatch: "## Simple Heading",
      line: 1,
      column: 0,
    }];

    const doc = new ParsedDocument(createParserOutput(headings, anchors));

    expect(doc.hasAnchor("Simple Heading")).toBe(true);
    expect(doc.hasAnchor("Simple%20Heading")).toBe(true);
  });

  it("should match URL-decoded anchor against urlEncodedId after decoding", () => {
    const headings = [{ level: 3, text: "Story 1.5: Cache", raw: "### Story 1.5: Cache\n" }];
    const anchors = [{
      anchorType: "header",
      id: "Story 1.5: Cache",
      urlEncodedId: "Story%201.5%20Cache",
      rawText: "Story 1.5: Cache",
      fullMatch: "### Story 1.5: Cache",
      line: 1,
      column: 0,
    }];

    const doc = new ParsedDocument(createParserOutput(headings, anchors));

    // Obsidian link would be: #Story%201.5%20Cache
    expect(doc.hasAnchor("Story%201.5%20Cache")).toBe(true);
    // Decoded form: "Story 1.5 Cache" (colon removed)
    expect(doc.hasAnchor("Story 1.5 Cache")).toBe(true);
  });
});
