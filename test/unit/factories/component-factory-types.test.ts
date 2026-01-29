import { describe, it, expect } from "vitest";
import {
  createMarkdownParser,
  createFileCache,
  createParsedFileCache,
  createCitationValidator,
  createContentExtractor,
} from "../../../src/factories/componentFactory.js";

describe("componentFactory TypeScript", () => {
  it("createMarkdownParser returns MarkdownParser instance", () => {
    const parser = createMarkdownParser();
    expect(parser).toBeDefined();
    expect(typeof parser.parseFile).toBe("function");
  });

  it("createFileCache returns FileCache instance", () => {
    const cache = createFileCache();
    expect(cache).toBeDefined();
    expect(typeof cache.buildCache).toBe("function");
  });

  it("createParsedFileCache accepts null parser", () => {
    const cache = createParsedFileCache(null);
    expect(cache).toBeDefined();
  });

  it("createCitationValidator accepts null dependencies", () => {
    const validator = createCitationValidator(null, null);
    expect(validator).toBeDefined();
    expect(typeof validator.validateFile).toBe("function");
  });

  it("createContentExtractor accepts null dependencies", () => {
    const extractor = createContentExtractor(null, null, null);
    expect(extractor).toBeDefined();
    expect(typeof extractor.extractContent).toBe("function");
  });

  // TypeScript type enforcement tests - verify parameter types are enforced
  it("createMarkdownParser rejects extra parameters", () => {
    // @ts-expect-error - Should not accept extra parameters
    createMarkdownParser("invalid");
  });

  it("createParsedFileCache rejects wrong parameter type", () => {
    // @ts-expect-error - Should reject non-MarkdownParser
    createParsedFileCache("not a parser");
  });

  it("createCitationValidator rejects wrong parameter types", () => {
    // @ts-expect-error - Should reject wrong parsedFileCache type
    createCitationValidator("invalid", null);
  });

  it("createContentExtractor rejects wrong parameter types", () => {
    // @ts-expect-error - Should reject non-array strategies parameter
    createContentExtractor(null, null, "not an array");
  });

  it("createFileCache rejects extra parameters", () => {
    // @ts-expect-error - Should not accept extra parameters
    createFileCache("extra");
  });
});
