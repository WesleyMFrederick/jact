/**
 * Integration tests: `jact ast` smart-default-scope behavior.
 *
 * Mirrors test/integration/extract-default-scope.test.ts and asserts the
 * `ast` subcommand reaches user-visible parity with `extract file` for:
 *   - happy paths (cwd-git, bare filename, explicit scope, /tmp + explicit)
 *   - M1 (not-found + near-miss)
 *   - M2 (ambiguous filename)
 *   - M3 (no scope resolvable)
 *   - ast ↔ extract parity
 *
 * Tests assert observable contract (stdout shape, stderr substrings, exit
 * code) only — not internal call sequences.
 *
 * CLI invocations spawn `node dist/jact.js ast …` (requires prior build).
 */

import { exec } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path, { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CLI_PATH = join(__dirname, "../../dist/jact.js");
const JACT_ROOT = join(__dirname, "../..");
const JACT_CLAUDE_MD = join(JACT_ROOT, "CLAUDE.md");

let tmpDir: string;
let lonelyFile: string;

beforeAll(() => {
	const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "jact-ast-scope-test-"));
	tmpDir = fs.realpathSync(tmp);
	// Plain .md outside any project root for M3 tests
	lonelyFile = path.join(tmpDir, "lonely.md");
	fs.writeFileSync(lonelyFile, "# Lonely\n\nNo project root.\n");
});

afterAll(() => {
	fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Happy paths — parses to JSON, exit 0
// ---------------------------------------------------------------------------
describe("ast — happy paths (parses to JSON)", () => {
	it("Scenario 1: given cwd inside jact repo and absolute path to existing file, when ast runs, then exit 0 with valid AST JSON", async () => {
		const { stdout, stderr } = await execAsync(
			`node "${CLI_PATH}" ast "${JACT_CLAUDE_MD}"`,
			{ cwd: JACT_ROOT },
		);
		expect(stderr).toBe("");
		const result = JSON.parse(stdout);
		expect(result).toHaveProperty("filePath");
		expect(result).toHaveProperty("content");
		expect(result).toHaveProperty("tokens");
		expect(result).toHaveProperty("links");
		expect(result).toHaveProperty("headings");
		expect(result).toHaveProperty("anchors");
		expect(result.filePath).toBe(JACT_CLAUDE_MD);
		expect(Array.isArray(result.tokens)).toBe(true);
		expect(result.tokens.length).toBeGreaterThan(0);
	});

	it("Scenario 2: given cwd inside jact repo and bare filename unique in scope, when ast runs from subdir, then resolves via cache to absolute path", async () => {
		// Run from a subdirectory where ./CLAUDE.md does NOT exist.
		const subdir = join(JACT_ROOT, "src");
		const { stdout, stderr } = await execAsync(
			`node "${CLI_PATH}" ast CLAUDE.md`,
			{ cwd: subdir },
		);
		expect(stderr).toBe("");
		const result = JSON.parse(stdout);
		expect(result.filePath).toBe(JACT_CLAUDE_MD);
	});

	it("Scenario 3: given cwd inside jact repo and explicit --scope, when ast runs, then exit 0 with valid AST JSON", async () => {
		const { stdout, stderr } = await execAsync(
			`node "${CLI_PATH}" ast CLAUDE.md --scope "${JACT_ROOT}"`,
			{ cwd: JACT_ROOT },
		);
		expect(stderr).toBe("");
		const result = JSON.parse(stdout);
		expect(result).toHaveProperty("filePath");
		expect(result).toHaveProperty("tokens");
	});

	it("Scenario 4: given cwd is /tmp and explicit --scope rescues, when ast runs, then exit 0 with valid AST JSON", async () => {
		const { stdout, stderr } = await execAsync(
			`node "${CLI_PATH}" ast CLAUDE.md --scope "${JACT_ROOT}"`,
			{ cwd: tmpDir },
		);
		expect(stderr).toBe("");
		const result = JSON.parse(stdout);
		expect(result).toHaveProperty("filePath");
		expect(result).toHaveProperty("tokens");
	});
});

// ---------------------------------------------------------------------------
// M1 — file not found in scope
// ---------------------------------------------------------------------------
describe("ast — file not found in scope (M1)", () => {
	it("Scenario 5: given filename has no near-miss in scope, when ast runs, then exit 2 with ERROR + Suggestion + 'not found in scope=' + (source: cwd-git)", async () => {
		try {
			await execAsync(
				`node "${CLI_PATH}" ast definitely-nonexistent-xyzzy.md`,
				{ cwd: JACT_ROOT },
			);
			expect.fail("Command should have failed for non-existent file");
		} catch (error: unknown) {
			const err = error as { code: number; stderr: string; stdout: string };
			expect(err.code).toBe(2);
			expect(err.stdout).toBe("");
			expect(err.stderr).toMatch(/^ERROR: File not found:/m);
			expect(err.stderr).toMatch(/^Suggestion:/m);
			expect(err.stderr).toContain("not found in scope=");
			expect(err.stderr).toContain(JACT_ROOT);
			expect(err.stderr).toContain("(source: cwd-git)");
		}
	});

	it("Scenario 6: given filename has Levenshtein near-miss in scope, when ast runs, then Suggestion line contains 'Did you mean: CLAUDE.md'", async () => {
		try {
			await execAsync(`node "${CLI_PATH}" ast CLUADE.md`, { cwd: JACT_ROOT });
			expect.fail("Command should have failed for typo filename");
		} catch (error: unknown) {
			const err = error as { code: number; stderr: string; stdout: string };
			expect(err.code).toBe(2);
			expect(err.stderr).toContain("Did you mean: CLAUDE.md");
		}
	});
});

// ---------------------------------------------------------------------------
// M2 — ambiguous filename
// ---------------------------------------------------------------------------
describe("ast — ambiguous filename (M2)", () => {
	it("Scenario 7: given bare filename matches multiple files in scope, when ast runs, then exit 2 with 'matched N files' + (source: cwd-git) + 'Pass --scope to narrow.'", async () => {
		try {
			await execAsync(`node "${CLI_PATH}" ast plan.md`, { cwd: JACT_ROOT });
			expect.fail("Command should have failed for ambiguous filename");
		} catch (error: unknown) {
			const err = error as { code: number; stderr: string; stdout: string };
			expect(err.code).toBe(2);
			expect(err.stderr).toMatch(/'plan\.md' matched \d+ files in scope=/);
			expect(err.stderr).toContain("(source: cwd-git)");
			expect(err.stderr).toContain("Pass --scope to narrow.");
			// Each candidate path on its own line — at least one .md path indented
			expect(err.stderr).toMatch(/\n {2}[/].*plan\.md/);
		}
	});
});

// ---------------------------------------------------------------------------
// M3 — scope cannot be resolved
// ---------------------------------------------------------------------------
describe("ast — scope cannot be resolved (M3)", () => {
	it("Scenario 8: given cwd is /tmp and target file outside any project, when ast runs, then exit 2 with 'cannot resolve scope. Tried:' + 'Pass --scope <dir>.'", async () => {
		try {
			await execAsync(`node "${CLI_PATH}" ast "${lonelyFile}"`, {
				cwd: tmpDir,
			});
			expect.fail("Command should have failed with M3 scope error");
		} catch (error: unknown) {
			const err = error as { code: number; stderr: string; stdout: string };
			expect(err.code).toBe(2);
			expect(err.stderr).toContain("ERROR:");
			expect(err.stderr).toContain("cannot resolve scope. Tried:");
			expect(err.stderr).toContain("Pass --scope <dir>.");
			// Cache fallback must be skipped — no near-miss / ambiguous output
			expect(err.stderr).not.toContain("matched");
			expect(err.stderr).not.toContain("Did you mean");
		}
	});
});

// ---------------------------------------------------------------------------
// ast ↔ extract parity (Ideal Outcome 1 acceptance)
// ---------------------------------------------------------------------------
describe("ast ↔ extract parity (Ideal Outcome 1 acceptance)", () => {
	it("Scenario 9: given same ambiguous filename input, when both ast and extract file run, then both stderrs contain matched-files + Pass --scope substrings", async () => {
		const fixturesDir = join(__dirname, "fixtures");

		let astStderr = "";
		let astCode = 0;
		try {
			await execAsync(`node "${CLI_PATH}" ast plan.md`, { cwd: fixturesDir });
			expect.fail("ast should have failed for ambiguous filename");
		} catch (error: unknown) {
			const err = error as { code: number; stderr: string };
			astCode = err.code;
			astStderr = err.stderr;
		}

		let extractStderr = "";
		let extractCode = 0;
		try {
			await execAsync(`node "${CLI_PATH}" extract file plan.md`, {
				cwd: fixturesDir,
			});
			expect.fail("extract file should have failed for ambiguous filename");
		} catch (error: unknown) {
			const err = error as { code: number; stderr: string };
			extractCode = err.code;
			extractStderr = err.stderr;
		}

		// Both fail with non-zero exit
		expect(astCode).toBeGreaterThan(0);
		expect(extractCode).toBeGreaterThan(0);

		// Both stderrs share the user-visible scope-failure substrings
		const sharedSubstrings = [
			/'plan\.md' matched \d+ files in scope=/,
			/Pass --scope to narrow\./,
		];
		for (const re of sharedSubstrings) {
			expect(astStderr).toMatch(re);
			expect(extractStderr).toMatch(re);
		}
	});
});
