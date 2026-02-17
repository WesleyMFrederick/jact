import { execSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const CLI_PATH = join(__dirname, "../../dist/citation-manager.js");

describe("extract links --session (cache integration)", () => {
	let testDir: string;

	beforeEach(() => {
		testDir = join(
			tmpdir(),
			`session-cache-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
		);
		mkdirSync(testDir, { recursive: true });

		// Create source markdown with a citation (wiki links require |displayText)
		writeFileSync(
			join(testDir, "source.md"),
			"# Source\n\nSee [[target.md#Section One|Section One]] for details.\n",
		);

		// Create target markdown with the referenced section
		writeFileSync(
			join(testDir, "target.md"),
			"# Target\n\n## Section One\n\nThis is section one content.\n",
		);
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	it("first call with --session produces JSON output (cache miss)", () => {
		const sourcePath = join(testDir, "source.md");
		const output = execSync(
			`node "${CLI_PATH}" extract links "${sourcePath}" --scope "${testDir}" --session test-session-1`,
			{ encoding: "utf8", cwd: testDir },
		);

		const result = JSON.parse(output);
		expect(result.extractedContentBlocks).toBeDefined();
		expect(result.stats).toBeDefined();
	});

	it("second call with same --session produces no output (cache hit)", () => {
		const sourcePath = join(testDir, "source.md");

		// First call — cache miss
		execSync(
			`node "${CLI_PATH}" extract links "${sourcePath}" --scope "${testDir}" --session test-session-2`,
			{ encoding: "utf8", cwd: testDir },
		);

		// Second call — cache hit, should produce empty stdout
		const output = execSync(
			`node "${CLI_PATH}" extract links "${sourcePath}" --scope "${testDir}" --session test-session-2`,
			{ encoding: "utf8", cwd: testDir },
		);

		expect(output.trim()).toBe("");
	});

	it("no-links file with --session does not write cache (allows retry)", () => {
		// Create a file with no extractable links
		const noLinksPath = join(testDir, "no-links.md");
		writeFileSync(
			noLinksPath,
			"# No Links\n\nJust plain text, no citations.\n",
		);

		// First call — no links, exits with code 1 (thrown as error by execSync)
		try {
			execSync(
				`node "${CLI_PATH}" extract links "${noLinksPath}" --scope "${testDir}" --session test-session-nolinks`,
				{ encoding: "utf8", cwd: testDir },
			);
		} catch {
			// Expected: exit code 1 for no eligible links
		}

		// Now add a citation to the file
		writeFileSync(
			noLinksPath,
			"# Now Has Links\n\nSee [[target.md#Section One|Section One]] for details.\n",
		);

		// Second call — should extract (no cache was written for the failed attempt)
		const output = execSync(
			`node "${CLI_PATH}" extract links "${noLinksPath}" --scope "${testDir}" --session test-session-nolinks`,
			{ encoding: "utf8", cwd: testDir },
		);
		const result = JSON.parse(output);
		expect(result.extractedContentBlocks).toBeDefined();
		expect(result.stats.uniqueContent).toBeGreaterThan(0);
	});

	it("call without --session always performs extraction (backward compat)", () => {
		// Use existing fixtures that are known to work
		const fixtureSource = join(__dirname, "../fixtures/extract-test-source.md");

		// First call without --session
		const output1 = execSync(
			`node "${CLI_PATH}" extract links "${fixtureSource}" --full-files`,
			{ encoding: "utf8" },
		);
		const result1 = JSON.parse(output1);
		expect(result1.extractedContentBlocks).toBeDefined();

		// Second call without --session — still produces output (no caching)
		const output2 = execSync(
			`node "${CLI_PATH}" extract links "${fixtureSource}" --full-files`,
			{ encoding: "utf8" },
		);
		const result2 = JSON.parse(output2);
		expect(result2.extractedContentBlocks).toBeDefined();
	});
});
