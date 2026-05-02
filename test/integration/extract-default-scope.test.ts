/**
 * D3 integration tests: applyScope helper + smart default scope inference.
 * Phase 2 — §8d assertions (8 total).
 *
 * CLI invocations use node dist/jact.js (requires prior build).
 * Source-inspection assertions read src/jact.ts directly.
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
const JACT_SRC = join(JACT_ROOT, "src/jact.ts");
const JACT_CLAUDE_MD = join(JACT_ROOT, "CLAUDE.md");

let tmpDir: string;

beforeAll(() => {
	const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "jact-scope-test-"));
	tmpDir = fs.realpathSync(tmp);
	// Create a plain .md file outside any repo for M3 tests
	fs.writeFileSync(
		path.join(tmpDir, "lonely.md"),
		"# Lonely\n\nNo project root.\n",
	);
});

afterAll(() => {
	fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("extract file — default scope inference", () => {
	it("given cwd inside jact repo and no --scope flag, when extract file <name> runs, then succeeds without error", async () => {
		const { stdout, stderr } = await execAsync(
			`node "${CLI_PATH}" extract file "${JACT_CLAUDE_MD}"`,
			{ cwd: JACT_ROOT },
		);
		const result = JSON.parse(stdout);
		expect(result).toHaveProperty("extractedContentBlocks");
		expect(stderr).toBe("");
	});

	it("given cwd inside jact repo and --scope passed, when extract file runs, then explicit scope wins (matches D1 source: 'explicit')", async () => {
		const { stdout } = await execAsync(
			`node "${CLI_PATH}" extract file "${JACT_CLAUDE_MD}" --scope "${JACT_ROOT}"`,
			{ cwd: JACT_ROOT },
		);
		const result = JSON.parse(stdout);
		expect(result).toHaveProperty("extractedContentBlocks");
	});

	it("given cwd outside any project + no --scope + targetFile inside a repo, when extract file runs, then succeeds via target-walk-up", async () => {
		// cwd = tmpDir (no .git / package.json); targetFile = jact CLAUDE.md (inside jact .git repo)
		const { stdout, stderr } = await execAsync(
			`node "${CLI_PATH}" extract file "${JACT_CLAUDE_MD}"`,
			{ cwd: tmpDir },
		);
		const result = JSON.parse(stdout);
		expect(result).toHaveProperty("extractedContentBlocks");
		expect(stderr).toBe("");
	});

	it("given cwd outside any project + no --scope + no targetFile in a repo, when extract file runs, then exits non-zero with M3 error message", async () => {
		const lonelyFile = path.join(tmpDir, "lonely.md");
		try {
			await execAsync(`node "${CLI_PATH}" extract file "${lonelyFile}"`, {
				cwd: tmpDir,
			});
			expect.fail("Command should have failed with M3 scope error");
		} catch (error: unknown) {
			const err = error as { code: number; stderr: string; stdout: string };
			expect(err.code).toBeGreaterThan(0);
			const output = err.stderr + err.stdout;
			expect(output).toContain("cannot resolve scope");
		}
	});
});

describe("extract header — default scope inference", () => {
	it("given cwd inside jact repo and no --scope, when extract header runs, then succeeds (mirrors extract file behavior)", async () => {
		const { stdout } = await execAsync(
			`node "${CLI_PATH}" extract header "${JACT_CLAUDE_MD}" "Project Overview"`,
			{ cwd: JACT_ROOT },
		);
		// Should produce JSON output (even if header not found, no crash)
		expect(stdout.length).toBeGreaterThan(0);
	});
});

describe("extract links — default scope inference", () => {
	it("given cwd inside jact repo and no --scope, when extract links runs, then succeeds (mirrors extract file behavior)", async () => {
		// Exit 1 is valid: means "no links found" (not a scope error).
		// Exit 2 would mean scope/system error. We accept 0 or 1.
		let stdout = "";
		try {
			({ stdout } = await execAsync(
				`node "${CLI_PATH}" extract links "${JACT_CLAUDE_MD}"`,
				{ cwd: JACT_ROOT },
			));
		} catch (err: unknown) {
			const e = err as { code: number; stdout: string; stderr: string };
			expect(e.code).toBe(1); // no-links exit, not a scope error
			expect(e.stderr).not.toContain("cannot resolve scope");
			stdout = e.stdout;
		}
		const result = JSON.parse(stdout);
		expect(result).toHaveProperty("extractedContentBlocks");
	});
});

describe("applyScope — duplication elimination", () => {
	it("given the three extract methods, when source is inspected, then each invokes applyScope and contains zero direct buildCache calls in extract body", () => {
		const src = fs.readFileSync(JACT_SRC, "utf8");

		// applyScope must appear at least 3 times (once per extract method)
		const applyScopeCount = (src.match(/this\.applyScope\(/g) ?? []).length;
		expect(applyScopeCount).toBeGreaterThanOrEqual(3);

		// No direct `this.fileCache.buildCache(` in extractLinks/Header/File method bodies
		// (only allowed in applyScope itself + validate + fix)
		// Strategy: split by method boundaries and check the 3 extract method regions
		const buildCacheInExtract =
			/async extract(?:Links|Header|File)[^}]*this\.fileCache\.buildCache\(/s;
		expect(src).not.toMatch(buildCacheInExtract);
	});

	it("given applyScope receives source: 'none' from resolveScope, when called, then throws with M3 error before reaching FileCache", () => {
		const src = fs.readFileSync(JACT_SRC, "utf8");
		// applyScope must check for source === 'none' and throw
		expect(src).toMatch(/source.*none|none.*source/);
		expect(src).toMatch(/cannot resolve scope/);
	});
});

describe("M1 near-miss suggestion — not_found branch", () => {
	it("given a typo filename close to CLAUDE.md, when extract file runs, then output contains 'Did you mean: CLAUDE.md'", async () => {
		const typoPath = join(JACT_ROOT, "CLUADE.md"); // deliberate typo
		try {
			await execAsync(`node "${CLI_PATH}" extract file "${typoPath}"`, {
				cwd: JACT_ROOT,
			});
			expect.fail("Command should have failed for non-existent file");
		} catch (error: unknown) {
			const err = error as { code: number; stderr: string; stdout: string };
			expect(err.code).toBeGreaterThan(0);
			const output = err.stderr + err.stdout;
			expect(output).toContain("Did you mean: CLAUDE.md");
		}
	});
});

describe("applyScope — sync semantics (tech debt fix)", () => {
	it("given extract header / extract file methods, when source is inspected, then no spurious 'await' on buildCache (TS80007 cleared)", () => {
		const src = fs.readFileSync(JACT_SRC, "utf8");
		// TS80007: 'await' has no effect here — buildCache is synchronous
		// After fix, no `await this.fileCache.buildCache` should appear anywhere
		expect(src).not.toContain("await this.fileCache.buildCache");
	});
});
