import { describe, expect, it } from "vitest";
import { MarkdownParser } from "../src/core/MarkdownParser/index.js";

const mockFs = (content) => ({
  readFileSync: () => content,
});

describe("MarkdownParser — Internal Link Extraction (#33)", () => {
  it("should extract standard markdown internal link [text](#anchor)", async () => {
    const content = 'See [this section](#overview) for details';
    const parser = new MarkdownParser(mockFs(content));
    const result = await parser.parseFile("/test/source.md");

    const internalLinks = result.links.filter(l => l.scope === "internal" && l.linkType === "markdown");
    expect(internalLinks.length).toBe(1);
    expect(internalLinks[0].target.anchor).toBe("overview");
    expect(internalLinks[0].text).toBe("this section");
    expect(internalLinks[0].anchorType).toBe("header");
  });

  it("should extract internal link with special characters in anchor", async () => {
    const content = '[Jump](#ADR-006%20Decision)';
    const parser = new MarkdownParser(mockFs(content));
    const result = await parser.parseFile("/test/source.md");

    const link = result.links.find(l => l.scope === "internal");
    expect(link).toBeDefined();
    expect(link.target.anchor).toBe("ADR-006%20Decision");
  });

  it("should extract internal link with URL-encoded spaces", async () => {
    const content = '[Go](#My%20Section%20Name)';
    const parser = new MarkdownParser(mockFs(content));
    const result = await parser.parseFile("/test/source.md");

    const link = result.links.find(l => l.scope === "internal");
    expect(link).toBeDefined();
    expect(link.target.anchor).toBe("My%20Section%20Name");
  });

  it("should set null paths for internal links", async () => {
    const content = '[Internal](#target)';
    const parser = new MarkdownParser(mockFs(content));
    const result = await parser.parseFile("/test/source.md");

    const link = result.links.find(l => l.scope === "internal");
    expect(link.target.path.raw).toBeNull();
    expect(link.target.path.absolute).toBeNull();
    expect(link.target.path.relative).toBeNull();
  });

  it("should classify block anchors correctly for internal links", async () => {
    const content = '[Block ref](#^block-id)';
    const parser = new MarkdownParser(mockFs(content));
    const result = await parser.parseFile("/test/source.md");

    const link = result.links.find(l => l.scope === "internal");
    expect(link).toBeDefined();
    expect(link.anchorType).toBe("block");
  });

  it("should handle multiple internal links on same line", async () => {
    const content = 'See [A](#first) and [B](#second) sections';
    const parser = new MarkdownParser(mockFs(content));
    const result = await parser.parseFile("/test/source.md");

    const internalLinks = result.links.filter(l => l.scope === "internal");
    expect(internalLinks.length).toBe(2);
    expect(internalLinks.map(l => l.target.anchor).sort()).toEqual(["first", "second"]);
  });

  it("should not extract external http links as internal", async () => {
    const content = '[External](https://example.com#hash)';
    const parser = new MarkdownParser(mockFs(content));
    const result = await parser.parseFile("/test/source.md");

    const internalLinks = result.links.filter(l => l.scope === "internal");
    expect(internalLinks.length).toBe(0);
  });
});
