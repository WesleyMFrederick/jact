import { describe, it, expect } from "vitest";
import { CitationManager } from "../../dist/citation-manager.js";

describe("CitationManager public methods TypeScript", () => {
  it("validate returns string", async () => {
    const manager = new CitationManager();
    // Use a non-existent file to trigger error path (returns string)
    const result = await manager.validate("/nonexistent/file.md");
    expect(typeof result).toBe("string");
  });

  it("validate with json format returns JSON string", async () => {
    const manager = new CitationManager();
    const result = await manager.validate("/nonexistent/file.md", {
      format: "json",
    });
    expect(typeof result).toBe("string");
    const parsed = JSON.parse(result);
    expect(parsed.error).toBeDefined();
  });

  it("fix returns string", async () => {
    const manager = new CitationManager();
    const result = await manager.fix("/nonexistent/file.md");
    expect(typeof result).toBe("string");
  });
});
