import { describe, expect, it } from "vitest";
import { MarkdownParser } from "../src/core/MarkdownParser/index.js";

const mockFs = { readFileSync: () => "" };

describe("MarkdownParser._createLinkObject() — Factory Function (#30)", () => {
  it("should create cross-document link object with correct shape", () => {
    const parser = new MarkdownParser(mockFs);

    // Access private method for testing (TypeScript allows this in test context)
    const link = parser._createLinkObject({
      linkType: "markdown",
      scope: "cross-document",
      anchor: "test-anchor",
      rawPath: "file.md",
      sourceAbsolutePath: "/source/doc.md",
      text: "Link Text",
      fullMatch: "[Link Text](file.md#test-anchor)",
      line: 5,
      column: 10,
      extractionMarker: null,
    });

    expect(link.linkType).toBe("markdown");
    expect(link.scope).toBe("cross-document");
    expect(link.anchorType).toBe("header");
    expect(link.target.anchor).toBe("test-anchor");
    expect(link.target.path.raw).toBe("file.md");
    expect(link.target.path.absolute).not.toBeNull();
    expect(link.text).toBe("Link Text");
    expect(link.line).toBe(5);
    expect(link.column).toBe(10);
  });

  it("should create internal link object with null paths", () => {
    const parser = new MarkdownParser(mockFs);

    const link = parser._createLinkObject({
      linkType: "wiki",
      scope: "internal",
      anchor: "my-anchor",
      rawPath: null,
      sourceAbsolutePath: "/source/doc.md",
      text: "Internal",
      fullMatch: "[[#my-anchor|Internal]]",
      line: 3,
      column: 0,
      extractionMarker: null,
    });

    expect(link.scope).toBe("internal");
    expect(link.target.path.raw).toBeNull();
    expect(link.target.path.absolute).toBeNull();
    expect(link.target.path.relative).toBeNull();
    expect(link.target.anchor).toBe("my-anchor");
  });

  it("should handle null anchor (link without fragment)", () => {
    const parser = new MarkdownParser(mockFs);

    const link = parser._createLinkObject({
      linkType: "markdown",
      scope: "cross-document",
      anchor: null,
      rawPath: "target.md",
      sourceAbsolutePath: "/source/doc.md",
      text: "No Anchor",
      fullMatch: "[No Anchor](target.md)",
      line: 1,
      column: 0,
      extractionMarker: null,
    });

    expect(link.anchorType).toBeNull();
    expect(link.target.anchor).toBeNull();
  });
});
