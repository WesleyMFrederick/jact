import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FIXTURES_DIR = join(__dirname, "..", "fixtures", "extract-file");
const CLI_PATH = join(__dirname, "../../src/citation-manager.js");

describe("CLI extract file subcommand - Basic Functionality", () => {
  it("should extract entire file content successfully", async () => {
    // Given: Valid markdown file
    const testFile = join(FIXTURES_DIR, "sample-document.md");

    // When: Execute extract file command
    const { stdout } = await execAsync(
      `node "${CLI_PATH}" extract file "${testFile}"`
    );

    // Then: Output contains complete file content
    const result = JSON.parse(stdout);

    // Verify: Result structure matches OutgoingLinksExtractedContent schema
    expect(result).toHaveProperty("extractedContentBlocks");
    expect(result).toHaveProperty("stats");
    expect(result.stats.uniqueContent).toBe(1);

    // Verify: Content ID exists (not metadata key)
    const contentIds = Object.keys(result.extractedContentBlocks)
      .filter(k => k !== "_totalContentCharacterLength");
    expect(contentIds.length).toBe(1);

    // Verify: Content is non-empty
    const contentBlock = result.extractedContentBlocks[contentIds[0]];
    expect(contentBlock.content.length).toBeGreaterThan(0);
    expect(contentBlock.content).toContain("Sample Document");
    expect(contentBlock.content).toContain("Section 1");
  });
});
