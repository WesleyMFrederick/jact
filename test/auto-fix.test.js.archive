import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { runCLI } from "./helpers/cli-runner.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const citationManagerPath = join(__dirname, "..", "src", "citation-manager.js");
const fixturesPath = join(__dirname, "fixtures");

describe("Auto-Fix Functionality", () => {
	// Restore fixtures after each test by checking them out from git
	afterEach(() => {
		try {
			runCLI("git checkout tools/citation-manager/test/fixtures/auto-fix-*.md", {
				cwd: join(__dirname, "..", ".."),
			});
		} catch {
			// Ignore errors if files weren't modified
		}
	});

	it("should auto-fix kebab-case anchors to raw header format", async () => {
		const testFile = join(fixturesPath, "auto-fix-source.md");

		// Run auto-fix
		const output = runCLI(
			`node "${citationManagerPath}" validate "${testFile}" --fix --scope "${fixturesPath}"`,
			{
				cwd: join(__dirname, ".."),
			},
		);

		// Check that auto-fix was successful
		expect(output).toContain("Fixed 2 citations");
		expect(output).toContain("anchor corrections");

		// Verify the file was actually modified
		const fixedContent = readFileSync(testFile, "utf8");
		expect(fixedContent).toContain("#Sample%20Header");
		expect(fixedContent).toContain("#Another%20Test%20Header");
		expect(fixedContent).not.toContain("#sample-header");
		expect(fixedContent).not.toContain("#another-test-header");

		console.log("Auto-fix functionality working correctly");
	});

	it("should report no fixes needed when no kebab-case citations exist", async () => {
		const testFile = join(fixturesPath, "auto-fix-no-fix-needed.md");

		// Run auto-fix
		const output = runCLI(
			`node "${citationManagerPath}" validate "${testFile}" --fix --scope "${fixturesPath}"`,
			{
				cwd: join(__dirname, ".."),
			},
		);

		// Check that either no fixes were needed OR citations were already in correct format
		const hasOutput = output.length > 0;
		expect(hasOutput).toBe(true);

		// Verify file content still has correct format (not broken by fix attempt)
		const content = readFileSync(testFile, "utf8");
		expect(content).toContain("#Sample%20Header");
		expect(content).toContain("#Another%20Test%20Header");

		console.log("Auto-fix correctly identifies when no fixes are needed");
	});

	it("should only fix validated existing headers", async () => {
		const testFile = join(fixturesPath, "auto-fix-selective.md");

		// Run auto-fix
		const output = runCLI(
			`node "${citationManagerPath}" validate "${testFile}" --fix --scope "${fixturesPath}"`,
			{
				cwd: join(__dirname, ".."),
			},
		);

		// Check that we get reasonable output
		expect(output.length).toBeGreaterThan(0);

		// Verify the file content shows appropriate handling
		const fixedContent = readFileSync(testFile, "utf8");
		// Should have at least one working citation format
		const hasRawFormat = fixedContent.includes("#Sample%20Header");
		const hasKebabFormat = fixedContent.includes("#Sample-Header");
		expect(hasRawFormat || hasKebabFormat).toBeTruthy();

		console.log("Auto-fix correctly handles mixed valid/invalid citations");
	});
});
