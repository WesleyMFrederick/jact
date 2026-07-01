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
import fs from "node:fs";
import os from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CLI_PATH = join(__dirname, "../../dist/cli.js");
const FIXTURE_DIR = join(__dirname, "../fixtures/wiki-scope-resolution");
const SOURCE = join(FIXTURE_DIR, "wiki-scope-resolution-source.md");

const WIKI = "[[target#hasAnchor(anchorId string) boolean]]";
const MD = "[x](target.md#hasAnchor(anchorId%20string)%20boolean)";
const TARGET_MD = "# Target\n\n## hasAnchor(anchorId: string): boolean\n";

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

	// Regression: validate built the FileCache only when --scope was passed
	// explicitly. With no --scope it never seeded the cache, so bare wiki page
	// names always failed ("Wiki page not found") even though the target sat in
	// the same directory. validate now resolves scope via smart defaults
	// (cwd-git → cwd-pkg → target-git → target-pkg), matching `ast`.
	it("resolves the wiki link with NO --scope, run from the fixture dir (smart-default scope)", async () => {
		const { stdout, stderr } = await execAsync(
			`node "${CLI_PATH}" validate "${SOURCE}"`,
			{ cwd: FIXTURE_DIR },
		);
		expect(stderr).toBe("");
		expect(stdout).toContain("OK");
		expect(stdout).toContain("2 citations valid");
	});

	it("resolves the wiki link with NO --scope using a bare filename from the fixture dir", async () => {
		const { stdout } = await execAsync(
			`node "${CLI_PATH}" validate wiki-scope-resolution-source.md`,
			{ cwd: FIXTURE_DIR },
		);
		expect(stdout).toContain("2 citations valid");
	});
});

// A self-contained temp repo (own .git + .gitignore) so we can exercise the
// gitignore-relax path and the --allow-gitignore hint without touching the
// jact repo's own ignore rules.
describe("validate — gitignored target dir is indexed, with clear messaging", () => {
	let repo: string;
	let ignoredSource: string;
	let visibleSource: string;

	beforeAll(() => {
		repo = fs.realpathSync(
			fs.mkdtempSync(join(os.tmpdir(), "wiki-gitignore-")),
		);
		fs.mkdirSync(join(repo, ".git"));
		fs.writeFileSync(join(repo, ".gitignore"), "ignored/\n");

		// Source + target both live inside the gitignored "ignored/" folder.
		const ignoredDir = join(repo, "ignored");
		fs.mkdirSync(ignoredDir);
		fs.writeFileSync(
			join(ignoredDir, "source.md"),
			`# Source\n\n${WIKI}\n\n${MD}\n`,
		);
		fs.writeFileSync(join(ignoredDir, "target.md"), TARGET_MD);
		ignoredSource = join(ignoredDir, "source.md");

		// A non-ignored file linking to a page that exists nowhere. The name is
		// long + unique so the fuzzy resolver's ceiling pre-filter skips every
		// cache entry — guaranteeing a deterministic "Wiki page not found" (a
		// short name can fuzzy-self-resolve to the source file in deep paths).
		fs.writeFileSync(
			join(repo, "visible.md"),
			"# Visible\n\n[[this-page-definitely-does-not-exist-anywhere#anchor]]\n",
		);
		visibleSource = join(repo, "visible.md");
	});

	afterAll(() => {
		fs.rmSync(repo, { recursive: true, force: true });
	});

	it("indexes the gitignored branch so the wiki link resolves, and says it did", async () => {
		const { stdout } = await execAsync(
			`node "${CLI_PATH}" validate "${ignoredSource}"`,
			{ cwd: repo },
		);
		expect(stdout).toContain("2 citations valid");
		// Messaging: explain the gitignore default we worked around.
		expect(stdout).toContain("is gitignored under");
		expect(stdout).toContain("--allow-gitignore");
	});

	it("hints at --allow-gitignore when a wiki target is not found and gitignore is active", async () => {
		try {
			await execAsync(`node "${CLI_PATH}" validate "${visibleSource}"`, {
				cwd: repo,
			});
			expect.fail("Command should have failed for missing wiki page");
		} catch (error: unknown) {
			const err = error as { code: number; stdout: string };
			expect(err.code).toBe(1);
			expect(err.stdout).toContain("Wiki page not found");
			expect(err.stdout).toContain("--allow-gitignore");
		}
	});
});
