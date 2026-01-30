import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, beforeAll } from "vitest";
import { createMarkdownParser } from "../src/factories/componentFactory.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("extractAnchors — Header Anchor Derivation (#29)", () => {
  let parser;

  beforeAll(() => {
    parser = createMarkdownParser();
  });

  it("should produce identical header anchors when derived from headings vs regex", async () => {
    const testFile = join(__dirname, "fixtures", "complex-headers.md");

    // Get current output (baseline)
    const result = await parser.parseFile(testFile);

    // Filter to header anchors only
    const headerAnchors = result.anchors.filter(a => a.anchorType === "header");

    // Each heading should produce exactly one header anchor
    expect(headerAnchors.length).toBe(result.headings.length);

    // Each heading text should appear as anchor id
    for (const heading of result.headings) {
      const matchingAnchor = headerAnchors.find(a => a.id === heading.text);
      expect(matchingAnchor).toBeDefined();
      expect(matchingAnchor.rawText).toBe(heading.text);
    }
  });

  it("should preserve urlEncodedId generation from headings", async () => {
    const testFile = join(__dirname, "fixtures", "complex-headers.md");
    const result = await parser.parseFile(testFile);

    const headerAnchors = result.anchors.filter(a => a.anchorType === "header");

    for (const anchor of headerAnchors) {
      expect(anchor).toHaveProperty("urlEncodedId");
      expect(typeof anchor.urlEncodedId).toBe("string");
      // urlEncodedId should have colons removed and spaces as %20
      expect(anchor.urlEncodedId).not.toContain(":");
    }
  });

  it("should preserve block anchors unchanged (not derived from headings)", async () => {
    const testFile = join(__dirname, "fixtures", "complex-headers.md");
    const result = await parser.parseFile(testFile);

    const blockAnchors = result.anchors.filter(a => a.anchorType === "block");

    for (const anchor of blockAnchors) {
      expect(anchor).not.toHaveProperty("urlEncodedId");
      expect(anchor.rawText).toBeNull();
    }
  });
});
