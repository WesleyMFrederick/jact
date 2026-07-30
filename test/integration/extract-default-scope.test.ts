/**
 * Integration tests for shared smart-default scope inference.
 * CLI invocations use node dist/cli.js (requires prior build).
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
const CLI_PATH = join(__dirname, "../../dist/cli.js");
const JACT_ROOT = join(__dirname, "../..");
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

describe("shared extraction scope behavior", () => {
	it("maps unresolved scope consistently for all extraction adapters", async () => {
		const lonelyFile = path.join(tmpDir, "lonely.md");
		const commands = [
			`extract file "${lonelyFile}"`,
			`extract header "${lonelyFile}" "Lonely"`,
			`extract links "${lonelyFile}"`,
		];

		for (const command of commands) {
			try {
				await execAsync(`node "${CLI_PATH}" ${command}`, { cwd: tmpDir });
				expect.fail(`Command should fail without a resolvable scope: ${command}`);
			} catch (error: unknown) {
				const result = error as { code: number; stderr: string; stdout: string };
				expect(result.code).toBeGreaterThan(0);
				expect(result.stderr + result.stdout).toContain("cannot resolve scope");
			}
		}
	});

	it("lets every extraction adapter use the same explicit scope", async () => {
		const lonelyFile = path.join(tmpDir, "lonely.md");
		const commands = [
			`extract file "${lonelyFile}" --scope "${tmpDir}"`,
			`extract header "${lonelyFile}" "Lonely" --scope "${tmpDir}"`,
			`extract links "${lonelyFile}" --scope "${tmpDir}"`,
		];

		for (const command of commands) {
			try {
				await execAsync(`node "${CLI_PATH}" ${command}`, { cwd: tmpDir });
			} catch (error: unknown) {
				const result = error as { code: number; stderr: string; stdout: string };
				expect(result.code).toBe(1);
				expect(result.stderr + result.stdout).not.toContain(
					"cannot resolve scope",
				);
			}
		}
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
