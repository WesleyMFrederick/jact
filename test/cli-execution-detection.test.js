import { symlinkSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runCLI } from "./helpers/cli-runner.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const citationManagerPath = join(__dirname, "..", "src", "citation-manager.js");

describe("CLI Execution Detection via Symlink", () => {
	let symlinkPath;

	beforeEach(() => {
		// Create unique symlink path for this test run
		symlinkPath = join(tmpdir(), `citation-manager-test-${Date.now()}`);
	});

	afterEach(() => {
		// Clean up symlink if it exists
		try {
			unlinkSync(symlinkPath);
		} catch {
			// Ignore if symlink doesn't exist
		}
	});

	it("should detect direct execution via symlink and produce output", () => {
		// Regression test for: https://github.com/nodejs/modules/issues/152
		// Problem: import.meta.url === `file://${process.argv[1]}` fails with symlinks
		// Solution: Use realpathSync() to resolve symlinks before comparing

		// Create symlink to citation-manager
		symlinkSync(citationManagerPath, symlinkPath);

		// Execute via symlink (simulates npm link behavior)
		const result = runCLI(`node ${symlinkPath} --help`, {
			cwd: __dirname,
		});

		// Should produce help output, not silence
		expect(result).toContain("Citation validation and management tool");
		expect(result).toContain("Commands:");
		expect(result).toContain("validate");
		expect(result).toContain("extract");
	});

	it("should execute validate command via symlink", () => {
		// Create symlink
		symlinkSync(citationManagerPath, symlinkPath);

		const testFile = join(__dirname, "fixtures", "valid-citations.md");

		// Execute validate command via symlink
		const result = runCLI(`node ${symlinkPath} validate "${testFile}"`, {
			cwd: __dirname,
		});

		// Should produce validation output
		expect(result).toContain("Citation Validation Report");
		expect(result).toContain("ALL CITATIONS VALID");
	});

	it("should execute extract command via symlink", () => {
		// Create symlink
		symlinkSync(citationManagerPath, symlinkPath);

		const testFile = join(__dirname, "fixtures", "extract-test-source.md");

		// Execute extract links command via symlink
		const result = runCLI(`node ${symlinkPath} extract links "${testFile}"`, {
			cwd: __dirname,
		});

		// Should produce JSON output
		const output = JSON.parse(result);
		expect(output).toHaveProperty("extractedContentBlocks");
		expect(output).toHaveProperty("outgoingLinksReport");
		expect(output).toHaveProperty("stats");
	});
});
