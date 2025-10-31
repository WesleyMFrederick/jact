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

describe("CLI extract file subcommand - Error Handling", () => {
  it("should report error when file does not exist", async () => {
    // Given: Non-existent file path
    const missingFile = join(FIXTURES_DIR, "does-not-exist.md");

    // When: Execute extract file command (expect failure)
    try {
      await execAsync(`node "${CLI_PATH}" extract file "${missingFile}"`);
      // If we get here, test should fail
      expect.fail("Command should have failed for missing file");
    } catch (error) {
      // Then: Command exits with non-zero code
      expect(error.code).toBeGreaterThan(0);

      // Then: Error message contains helpful information
      expect(error.stderr || error.stdout).toContain("File not found");
    }
  });
});

describe("CLI extract file subcommand - Scope Option", () => {
  it("should respect scope option for file resolution", async () => {
    // Given: File exists in scoped directory
    const scopedDir = join(FIXTURES_DIR, "scoped");
    const fileName = "nested-file.md"; // Relative filename only

    // When: Execute with scope option
    const { stdout } = await execAsync(
      `node "${CLI_PATH}" extract file "${fileName}" --scope "${scopedDir}"`
    );

    // Then: File is found and content extracted
    const result = JSON.parse(stdout);
    expect(result.stats.uniqueContent).toBe(1);

    const contentIds = Object.keys(result.extractedContentBlocks)
      .filter(k => k !== "_totalContentCharacterLength");
    const contentBlock = result.extractedContentBlocks[contentIds[0]];
    expect(contentBlock.content).toContain("Nested File");
  });
});

describe("CLI extract file subcommand - Exit Codes", () => {
  it("should exit with code 0 when extraction succeeds", async () => {
    // Given: Valid markdown file
    const testFile = join(FIXTURES_DIR, "sample-document.md");

    // When: Execute extract file command
    const { stdout, stderr } = await execAsync(
      `node "${CLI_PATH}" extract file "${testFile}"`
    );

    // Then: Command exits with code 0 (success - implicit in execAsync not throwing)
    const result = JSON.parse(stdout);
    expect(result.stats.uniqueContent).toBeGreaterThan(0);
    expect(stderr).toBe("");
  });

  it("should exit with non-zero code when file not found", async () => {
    // Given: Non-existent file
    const missingFile = join(FIXTURES_DIR, "missing.md");

    // When: Execute extract file command
    try {
      await execAsync(`node "${CLI_PATH}" extract file "${missingFile}"`);
      expect.fail("Should have thrown error");
    } catch (error) {
      // Then: Exit code is non-zero (1 or 2)
      expect(error.code).toBeGreaterThan(0);
    }
  });

  it("should exit with code 1 when validation fails", async () => {
    // Given: Invalid file path that validator rejects
    const invalidFile = "/tmp/nonexistent-citation-test-file.md";

    // When: Execute extract file command
    try {
      await execAsync(`node "${CLI_PATH}" extract file "${invalidFile}"`);
      expect.fail("Should have thrown error");
    } catch (error) {
      // Then: Exit code is 1 (validation error)
      expect(error.code).toBe(1);
    }
  });
});

describe("CLI extract file subcommand - Help Documentation", () => {
  it("should display help text for extract file subcommand", async () => {
    // Given: Extract file help flag

    // When: Execute help command
    const { stdout } = await execAsync(
      `node "${CLI_PATH}" extract file --help`
    );

    // Then: Help output contains description
    expect(stdout).toContain("Extract entire markdown file content");
    expect(stdout).toContain("target-file");
    expect(stdout).toContain("--scope");
    expect(stdout).toContain("--format");
  });

  it("should list extract file in top-level extract help", async () => {
    // Given: Extract help flag

    // When: Execute extract help
    const { stdout } = await execAsync(
      `node "${CLI_PATH}" extract --help`
    );

    // Then: Extract file subcommand is listed
    expect(stdout).toContain("file");
    expect(stdout).toContain("links");
    expect(stdout).toContain("header");
  });
});
