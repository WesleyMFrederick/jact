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
});
