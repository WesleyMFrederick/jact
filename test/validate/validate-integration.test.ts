import { execSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

import { runCLI } from "../helpers/cli-runner.js";

/**
 * Integration tests for `jact validate` batch CLI wiring (task 006).
 *
 * Runs the built CLI (`dist/cli.js`) end-to-end against a fixture vault,
 * asserting output + exit code per the 006-testing.md suite table.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, "..", "..");
const cliPath = join(repoRoot, "dist", "cli.js");
const vault = join(repoRoot, "test", "fixtures", "batch-validate-vault");

/** Run the CLI, tolerating non-zero exit codes (returns stdout/exit code either way). */
function run(
	args: string,
	cwd: string = repoRoot,
): { stdout: string; exitCode: number } {
	try {
		const stdout = runCLI(`node "${cliPath}" ${args}`, { cwd });
		return { stdout, exitCode: 0 };
	} catch (error) {
		const e = error as { stdout?: string; status?: number };
		return { stdout: e.stdout ?? "", exitCode: e.status ?? 1 };
	}
}

describe("jact validate — batch CLI (task 006)", () => {
	it("glob: validates each match, one result line per file", () => {
		// cwd pinned to the vault: the repo root's .jactignore hides test/ from
		// sweeps (globs), and glob expansion reads ignore files from cwd.
		const { stdout, exitCode } = run(`validate "${vault}/*.md"`, vault);
		expect(stdout).toContain("good-a.md");
		expect(stdout).toContain("good-b.md");
		expect(stdout).toContain("broken.md");
		expect(stdout).toMatch(/^3 files · 2 passed · 1 failed$/m);
		expect(exitCode).toBe(1);
	});

	it("multi-path: validates all explicit paths independently", () => {
		const { stdout, exitCode } = run(
			`validate "${vault}/good-a.md" "${vault}/good-b.md"`,
		);
		expect(stdout).toContain("good-a.md");
		expect(stdout).toContain("good-b.md");
		expect(stdout).toMatch(/^2 files · 2 passed · 0 failed$/m);
		expect(exitCode).toBe(0);
	});

	it("no-match: zero-match glob exits non-zero and names the pattern", () => {
		const pattern = `${vault}/zzz-nope-*.md`;
		const { stdout, exitCode } = run(`validate "${pattern}"`);
		expect(exitCode).toBe(2);
		expect(stdout).toContain(pattern);
	});

	it("json: one JSONL object per file, parses, has path/ok/errors", () => {
		const { stdout, exitCode } = run(
			`validate "${vault}/good-a.md" "${vault}/good-b.md" --json`,
		);
		const lines = stdout
			.trim()
			.split("\n")
			.filter((l) => l.length > 0);
		expect(lines).toHaveLength(2);
		for (const line of lines) {
			const parsed = JSON.parse(line);
			expect(parsed).toHaveProperty("path");
			expect(parsed).toHaveProperty("ok");
			expect(parsed).toHaveProperty("errors");
		}
		expect(exitCode).toBe(0);
	});

	it("exit-fail: one failure fails the batch and identifies the file", () => {
		const { stdout, exitCode } = run(
			`validate "${vault}/good-a.md" "${vault}/broken.md"`,
		);
		expect(exitCode).toBe(1);
		expect(stdout).toContain("broken.md");
		expect(stdout).toMatch(/^2 files · 1 passed · 1 failed$/m);
	});

	it("exit-pass: all pass exits zero", () => {
		const { stdout, exitCode } = run(
			`validate "${vault}/good-a.md" "${vault}/good-b.md" "${vault}/nested/good-c.md"`,
		);
		expect(exitCode).toBe(0);
		expect(stdout).toMatch(/^3 files · 3 passed · 0 failed$/m);
	});

	it("compat: single-file output + exit code unchanged", () => {
		const { stdout, exitCode } = run(`validate "${vault}/good-a.md"`);
		expect(stdout).toMatch(/^OK: \d+ citations valid$/m);
		expect(exitCode).toBe(0);
	});

	it("compat: single-file failure output + exit code unchanged", () => {
		const { stdout, exitCode } = run(`validate "${vault}/broken.md"`);
		expect(exitCode).toBe(1);
		expect(stdout).toContain("ERRORS (");
		expect(stdout).toContain("FAILED:");
	});

	it("--json + --format json clash errors with exit 2", () => {
		const { stdout, exitCode } = run(
			`validate "${vault}/good-a.md" --json --format json`,
		);
		expect(exitCode).toBe(2);
		expect(stdout).toContain("ERROR:");
	});

	describe("--changed", () => {
		const scratch = mkdtempSync(join(tmpdir(), "jact-changed-"));

		afterAll(() => {
			rmSync(scratch, { recursive: true, force: true });
		});

		it("changed: validates exactly the git-changed markdown", () => {
			execSync("git init -q", { cwd: scratch });
			execSync('git config user.email "t@t.com"', { cwd: scratch });
			execSync('git config user.name "t"', { cwd: scratch });
			writeFileSync(join(scratch, "tracked.md"), "# Tracked\n\nBody.\n");
			execSync("git add tracked.md", { cwd: scratch });
			execSync("git commit -q -m init", { cwd: scratch });

			mkdirSync(join(scratch, "sub"), { recursive: true });
			writeFileSync(join(scratch, "new.md"), "# New\n\nBody.\n");

			const stdout = runCLI(`node "${cliPath}" validate --changed`, {
				cwd: scratch,
			});
			expect(stdout).toContain("new.md");
			expect(stdout).not.toContain("tracked.md");
			expect(stdout).toMatch(/^1 files · 1 passed · 0 failed$/m);
		});

		it("changed-empty: no changes present exits zero", () => {
			execSync("git add -A", { cwd: scratch });
			execSync('git commit -q -m "add new"', { cwd: scratch });

			const stdout = runCLI(`node "${cliPath}" validate --changed`, {
				cwd: scratch,
			});
			expect(stdout).toMatch(/^0 files · 0 passed · 0 failed$/m);
		});
	});
});
