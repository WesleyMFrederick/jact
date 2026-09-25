import { exec } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FIXTURES_DIR = join(__dirname, "..", "fixtures", "extract-file");
const CLI_PATH = join(__dirname, "../../dist/cli.js");

describe("CLI extract file subcommand - Basic Functionality", () => {
	it("should extract entire file content successfully", async () => {
		// Given: Valid markdown file
		const testFile = join(FIXTURES_DIR, "sample-document.md");

		// When: Execute extract file command
		const { stdout } = await execAsync(
			`node "${CLI_PATH}" extract file "${testFile}" --format json --verbose`,
		);

		// Then: Output contains complete file content
		const result = JSON.parse(stdout);

		// Verify: Result structure matches OutgoingLinksExtractedContent schema
		expect(result).toHaveProperty("extractedContentBlocks");
		expect(result).toHaveProperty("stats");
		expect(result.stats.uniqueContent).toBe(1);

		// Verify: Content ID exists (not metadata key)
		const contentIds = Object.keys(result.extractedContentBlocks).filter(
			(k) => k !== "_totalContentCharacterLength",
		);
		expect(contentIds.length).toBe(1);

		// Verify: Content is non-empty
		const contentBlock = result.extractedContentBlocks[contentIds[0]];
		expect(contentBlock.content.length).toBeGreaterThan(0);
		expect(contentBlock.content).toContain("Sample Document");
		expect(contentBlock.content).toContain("Section 1");
	});

	it("defaults to numbered markdown using original file lines", async () => {
		const testFile = join(FIXTURES_DIR, "sample-document.md");

		const { stdout } = await execAsync(
			`node "${CLI_PATH}" extract file "${testFile}"`,
		);

		expect(stdout).toContain("     1\t# Sample Document");
		expect(stdout).toContain("     5\t## Section 1");
		expect(stdout).toContain("    19\tFinal content.");
		expect(() => JSON.parse(stdout)).toThrow();
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
			`node "${CLI_PATH}" extract file "${fileName}" --scope "${scopedDir}" --format json --verbose`,
		);

		// Then: File is found and content extracted
		const result = JSON.parse(stdout);
		expect(result.stats.uniqueContent).toBe(1);

		const contentIds = Object.keys(result.extractedContentBlocks).filter(
			(k) => k !== "_totalContentCharacterLength",
		);
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
			`node "${CLI_PATH}" extract file "${testFile}" --format json --verbose`,
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
			`node "${CLI_PATH}" extract file --help`,
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
		const { stdout } = await execAsync(`node "${CLI_PATH}" extract --help`);

		// Then: Extract file subcommand is listed
		expect(stdout).toContain("file");
		expect(stdout).toContain("links");
		expect(stdout).toContain("header");
	});
});

describe("CLI extract file --extract-linked-content", () => {
	// root → a (full file), b#Part (section); a → c, a → root (cycle); c → d stopped.
	const makeTree = () => {
		const dir = mkdtempSync(join(tmpdir(), "jact-linked-"));
		writeFileSync(join(dir, "package.json"), "{}");
		writeFileSync(join(dir, "root.md"), "# Root\n\n[A](a.md) [Sec](b.md#Part)\n");
		writeFileSync(join(dir, "a.md"), "# A\n\n[C](c.md) [back](root.md)\n");
		writeFileSync(join(dir, "b.md"), "# B\n\n## Part\n\nPart body\n");
		writeFileSync(join(dir, "c.md"), "# C\n\n[D](d.md)%%stop-extract-link%%\n");
		writeFileSync(join(dir, "d.md"), "# D\n\nD body\n");
		return dir;
	};
	const run = (dir, args) =>
		execAsync(`node "${CLI_PATH}" extract file root.md ${args}`, { cwd: dir });

	it("defaults to depth 1: extracts direct links and hints at the next depth", async () => {
		const { stdout } = await run(makeTree(), "--extract-linked-content");

		expect(stdout).toContain("     1\t# A");
		expect(stdout).toContain("     3\t## Part");
		expect(stdout).not.toContain("# C");
		expect(stdout).toContain("--extract-linked-content 2`");
		expect(stdout).toContain("Source: a.md:1-");
		expect(stdout).toMatch(/Via: root\.md:\d+/);
	});

	it("follows deeper links, survives cycles, honors stop markers, and drops the deeper hint when nothing remains", async () => {
		const { stdout } = await run(makeTree(), "--extract-linked-content 5");

		expect(stdout).toContain("     1\t# C");
		expect(stdout).not.toContain("D body");
		expect(stdout.match(/# Root/g)).toHaveLength(1);
		expect(stdout).not.toContain("To Go Deeper");
	});

	it("keeps JSON stdout parseable by sending hints to stderr", async () => {
		const { stdout, stderr } = await run(
			makeTree(),
			"--extract-linked-content --format json",
		);

		expect(() => JSON.parse(stdout)).not.toThrow();
		expect(stderr).toContain("To Go Deeper");
	});

	it("rejects a depth below 1", async () => {
		await expect(run(makeTree(), "--extract-linked-content 0")).rejects.toMatchObject({
			stderr: expect.stringContaining("depth must be a whole number of 1 or more."),
		});
	});

	it("prints a content map with per-block load commands when output exceeds --max-chars", async () => {
		const dir = makeTree();
		const { stdout } = await run(dir, "--extract-linked-content --max-chars 50");

		expect(stdout).toContain("# Content map");
		expect(stdout).not.toContain("Part body");
		expect(stdout).toContain("`jact extract file a.md`");
		expect(stdout).toContain('`jact extract header b.md "Part"`');
		const { stdout: section } = await execAsync(
			`node "${CLI_PATH}" extract header b.md "Part"`,
			{ cwd: dir },
		);
		expect(section).toContain("Part body");
	});

	it("lists unreadable and missing links under Failures, still extracts the rest, and exits 1", async () => {
		const dir = mkdtempSync(join(tmpdir(), "jact-linked-locked-"));
		const scope = join(dir, "scope");
		mkdirSync(scope);
		writeFileSync(join(scope, "package.json"), "{}");
		writeFileSync(
			join(scope, "root.md"),
			"# Root\n\n[Locked](../locked.md) [Gone](gone.md) [A](a.md)\n",
		);
		writeFileSync(join(scope, "a.md"), "# A\n\nA body\n");
		writeFileSync(join(dir, "locked.md"), "# Locked\n");
		chmodSync(join(dir, "locked.md"), 0o000);

		try {
			const failure = await run(scope, "--extract-linked-content").catch(
				(error) => error,
			);

			expect(failure.code).toBe(1);
			expect(failure.stdout).toContain("A body");
			const failures = failure.stdout.split("## Failures")[1];
			expect(failures).toMatch(/root\.md:3 — EACCES/);
			expect(failures).toMatch(/root\.md:3 — .*File not found: gone\.md/);

			const json = await run(scope, "--extract-linked-content --format json").catch(
				(error) => error,
			);
			expect(json.code).toBe(1);
			expect(() => JSON.parse(json.stdout)).not.toThrow();
			expect(json.stderr).toMatch(/Failures:\n- root\.md:3 — EACCES/);
		} finally {
			chmodSync(join(dir, "locked.md"), 0o600);
		}
	});
});
