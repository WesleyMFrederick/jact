import { describe, it, expect } from "vitest";
import { CitationManager } from "../../dist/citation-manager.js";

describe("CitationManager class property types", () => {
  it("parser property is a MarkdownParser instance", () => {
    const manager = new CitationManager();
    // Access private properties via type-safe cast for verification
    const internal = manager as unknown as Record<string, unknown>;
    expect(internal.parser).toBeDefined();
    expect(internal.parser).toHaveProperty("parseFile");
  });

  it("parsedFileCache property is a ParsedFileCache instance", () => {
    const manager = new CitationManager();
    const internal = manager as unknown as Record<string, unknown>;
    expect(internal.parsedFileCache).toBeDefined();
    expect(internal.parsedFileCache).toHaveProperty("resolveParsedFile");
  });

  it("fileCache property is a FileCache instance", () => {
    const manager = new CitationManager();
    const internal = manager as unknown as Record<string, unknown>;
    expect(internal.fileCache).toBeDefined();
    expect(internal.fileCache).toHaveProperty("buildCache");
  });

  it("validator property is a CitationValidator instance", () => {
    const manager = new CitationManager();
    const internal = manager as unknown as Record<string, unknown>;
    expect(internal.validator).toBeDefined();
    expect(internal.validator).toHaveProperty("validateFile");
  });

  it("contentExtractor property is a ContentExtractor instance", () => {
    const manager = new CitationManager();
    const internal = manager as unknown as Record<string, unknown>;
    expect(internal.contentExtractor).toBeDefined();
    expect(internal.contentExtractor).toHaveProperty("extractContent");
  });
});
