/**
 * Integration tests: wiki link + markdown link both resolve when FileCache is
 * shared between the parser (wiki page-name lookup) and the validator.
 *
 * Regression coverage for the bug where JactCli built two separate FileCache
 * instances — the parser's cache was never scope-seeded, so bare wiki page
 * names always failed to resolve even when the target file existed in scope.
 *
 * Fixture: test/fixtures/wiki-scope-resolution/
 *   source  — one wiki link + one markdown link to the same anchor
 *   target  — contains the ## hasAnchor(anchorId: string): boolean heading
 */

import { exec } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CLI_PATH = join(__dirname, "../../dist/cli.js");
const FIXTURE_DIR = join(__dirname, "../fixtures/wiki-scope-resolution");
const SOURCE = join(FIXTURE_DIR, "wiki-scope-resolution-source.md");

describe("wiki scope resolution — shared FileCache wiring", () => {
	it("reports 2 citations valid (wiki link + markdown link both resolve)", async () => {
		const { stdout, stderr } = await execAsync(
			`node "${CLI_PATH}" validate "${SOURCE}" --scope "${FIXTURE_DIR}"`,
		);
		expect(stderr).toBe("");
		expect(stdout).toContain("OK");
		expect(stdout).toContain("2 citations valid");
	});

	it("exits 0 when source and target are in the same scoped directory", async () => {
		// execAsync throws on non-zero exit; reaching here means exit 0
		await expect(
			execAsync(
				`node "${CLI_PATH}" validate "${SOURCE}" --scope "${FIXTURE_DIR}"`,
			),
		).resolves.not.toThrow();
	});
});
