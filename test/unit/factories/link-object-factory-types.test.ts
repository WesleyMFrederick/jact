import { describe, it, expect } from "vitest";
import { LinkObjectFactory } from "../../../src/factories/LinkObjectFactory.js";
import type { LinkObject } from "../../../src/types/citationTypes.js";

describe("LinkObjectFactory TypeScript", () => {
  it("createHeaderLink returns LinkObject", () => {
    const factory = new LinkObjectFactory();
    const link: LinkObject = factory.createHeaderLink("/tmp/test.md", "Overview");
    expect(link.linkType).toBe("markdown");
    expect(link.scope).toBe("cross-document");
    expect(link.anchorType).toBe("header");
    expect(link.target.anchor).toBe("Overview");
  });

  it("createFileLink returns LinkObject", () => {
    const factory = new LinkObjectFactory();
    const link: LinkObject = factory.createFileLink("/tmp/test.md");
    expect(link.linkType).toBe("markdown");
    expect(link.anchorType).toBeNull();
    expect(link.target.anchor).toBeNull();
  });

  it("createHeaderLink omits validation property", () => {
    const factory = new LinkObjectFactory();
    const link = factory.createHeaderLink("/tmp/test.md", "Test");
    expect(link).not.toHaveProperty("validation");
  });

  it("createFileLink omits validation property", () => {
    const factory = new LinkObjectFactory();
    const link = factory.createFileLink("/tmp/test.md");
    expect(link).not.toHaveProperty("validation");
  });

  // Edge case tests: Input validation
  describe("Input validation for createHeaderLink", () => {
    it("throws error when targetPath is empty string", () => {
      const factory = new LinkObjectFactory();
      expect(() => factory.createHeaderLink("", "Overview")).toThrow(
        "targetPath cannot be empty"
      );
    });

    it("throws error when headerName is empty string", () => {
      const factory = new LinkObjectFactory();
      expect(() => factory.createHeaderLink("/tmp/test.md", "")).toThrow(
        "headerName cannot be empty"
      );
    });

    it("throws error when targetPath is whitespace-only", () => {
      const factory = new LinkObjectFactory();
      expect(() => factory.createHeaderLink("   ", "Overview")).toThrow(
        "targetPath cannot be empty"
      );
    });

    it("throws error when headerName is whitespace-only", () => {
      const factory = new LinkObjectFactory();
      expect(() => factory.createHeaderLink("/tmp/test.md", "  \t\n")).toThrow(
        "headerName cannot be empty"
      );
    });

    it("accepts special characters in targetPath", () => {
      const factory = new LinkObjectFactory();
      const link = factory.createHeaderLink("../../docs/file.md", "Test Header");
      expect(link.target.path.raw).toBe("../../docs/file.md");
    });

    it("accepts special characters in headerName", () => {
      const factory = new LinkObjectFactory();
      const link = factory.createHeaderLink("/tmp/test.md", "Header # with Special !@# Chars");
      expect(link.target.anchor).toBe("Header # with Special !@# Chars");
    });

    it("accepts unicode characters in headerName", () => {
      const factory = new LinkObjectFactory();
      const link = factory.createHeaderLink("/tmp/test.md", "标题 (Title) العنوان");
      expect(link.target.anchor).toBe("标题 (Title) العنوان");
    });

    it("accepts spaces in targetPath", () => {
      const factory = new LinkObjectFactory();
      const link = factory.createHeaderLink("/path with spaces/file.md", "Header");
      expect(link.target.path.raw).toBe("/path with spaces/file.md");
    });
  });

  describe("Input validation for createFileLink", () => {
    it("throws error when targetPath is empty string", () => {
      const factory = new LinkObjectFactory();
      expect(() => factory.createFileLink("")).toThrow(
        "targetPath cannot be empty"
      );
    });

    it("throws error when targetPath is whitespace-only", () => {
      const factory = new LinkObjectFactory();
      expect(() => factory.createFileLink("  \t\n")).toThrow(
        "targetPath cannot be empty"
      );
    });

    it("accepts special characters in targetPath", () => {
      const factory = new LinkObjectFactory();
      const link = factory.createFileLink("../../docs/file.md");
      expect(link.target.path.raw).toBe("../../docs/file.md");
    });

    it("accepts paths with spaces", () => {
      const factory = new LinkObjectFactory();
      const link = factory.createFileLink("/path with spaces/my file.md");
      expect(link.target.path.raw).toBe("/path with spaces/my file.md");
    });

    it("handles long paths", () => {
      const factory = new LinkObjectFactory();
      const longPath = "/very/long/path/" + "subdir/".repeat(20) + "file.md";
      const link = factory.createFileLink(longPath);
      expect(link.target.path.raw).toBe(longPath);
    });
  });
});
