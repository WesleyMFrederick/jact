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
		expect(stdout).toMatch(/^3 files · 2 passed · 1 failed · 0 skipped$/m);
		expect(exitCode).toBe(1);
	});

	it("multi-path: validates all explicit paths independently", () => {
		const { stdout, exitCode } = run(
			`validate "${vault}/good-a.md" "${vault}/good-b.md"`,
		);
		expect(stdout).toContain("good-a.md");
		expect(stdout).toContain("good-b.md");
		expect(stdout).toMatch(/^2 files · 2 passed · 0 failed · 0 skipped$/m);
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
		expect(stdout).toMatch(/^2 files · 1 passed · 1 failed · 0 skipped$/m);
	});

	it("exit-pass: all pass exits zero", () => {
		const { stdout, exitCode } = run(
			`validate "${vault}/good-a.md" "${vault}/good-b.md" "${vault}/nested/good-c.md"`,
		);
		expect(exitCode).toBe(0);
		expect(stdout).toMatch(/^3 files · 3 passed · 0 failed · 0 skipped$/m);
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

	describe("Issue 92 output controls", () => {
		const scratch = mkdtempSync(join(tmpdir(), "jact-issue-92-"));
		const scopeArg = `--scope "${scratch}"`;

		afterAll(() => {
			rmSync(scratch, { recursive: true, force: true });
		});

		it("bounds duplicate-path suggestions by default and expands them with --verbose", () => {
			const source = join(scratch, "docs", "source.md");
			mkdirSync(dirname(source), { recursive: true });
			writeFileSync(source, "[broken](missing/skill/SKILL.md)\n");
			for (let index = 0; index < 7; index++) {
				const candidate = join(
					scratch,
					"duplicates",
					`plugin-${index}`,
					"SKILL.md",
				);
				mkdirSync(dirname(candidate), { recursive: true });
				writeFileSync(candidate, "# Example\n");
			}

			const compact = run(`validate "${source}" ${scopeArg}`);
			const expanded = run(`validate "${source}" ${scopeArg} --verbose`);
			const compactJson = run(`validate "${source}" ${scopeArg} --format json`);
			const expandedJson = run(
				`validate "${source}" ${scopeArg} --format json --verbose`,
			);
			const candidatePath = /duplicates\/plugin-\d+\/SKILL\.md/g;
			expect(compact.stdout.match(candidatePath)).toHaveLength(5);
			expect(compact.stdout).toContain(
				"... 2 more matches; use --verbose to show all or --scope to narrow",
			);
			expect(expanded.stdout.match(candidatePath)).toHaveLength(7);
			const compactJsonOutput = JSON.parse(compactJson.stdout);
			const expandedJsonOutput = JSON.parse(expandedJson.stdout);
			const compactJsonSuggestion =
				compactJsonOutput.links[0].validation.suggestion;
			const expandedJsonSuggestion =
				expandedJsonOutput.links[0].validation.suggestion;
			expect(compactJsonSuggestion.match(candidatePath)).toHaveLength(5);
			expect(expandedJsonSuggestion.match(candidatePath)).toHaveLength(7);
			expect(compactJson.stdout).not.toContain("duplicatePathSuggestion");
		});

		it("skips only an exact first-body directive, with optional YAML frontmatter", () => {
			const direct = join(scratch, "direct.md");
			const afterFrontmatter = join(scratch, "frontmatter.md");
			const late = join(scratch, "late.md");
			const fenced = join(scratch, "fenced.md");
			writeFileSync(
				direct,
				"<!-- jact-validate-disable -->\n\n[example](missing.md)\n",
			);
			writeFileSync(
				afterFrontmatter,
				"---\ntitle: Example\n---\n<!-- jact-validate-disable -->\n\n[example](missing.md)\n",
			);
			writeFileSync(
				late,
				"# Intro\n\n<!-- jact-validate-disable -->\n\n[broken](missing.md)\n",
			);
			writeFileSync(
				fenced,
				"```md\n<!-- jact-validate-disable -->\n```\n\n[broken](missing.md)\n",
			);

			for (const file of [direct, afterFrontmatter]) {
				const result = run(`validate "${file}" ${scopeArg}`);
				expect(result.exitCode).toBe(0);
				expect(result.stdout.trim()).toBe(
					"SKIPPED: validation disabled by document directive",
				);
			}
			expect(run(`validate "${late}" ${scopeArg}`).exitCode).toBe(1);
			expect(run(`validate "${fenced}" ${scopeArg}`).exitCode).toBe(1);
		});

		it("reports batch skips separately from passes", () => {
			const skipped = join(scratch, "batch-skipped.md");
			const valid = join(scratch, "batch-valid.md");
			writeFileSync(skipped, "<!-- jact-validate-disable -->\n");
			writeFileSync(valid, "# Valid\n");

			const result = run(`validate "${skipped}" "${valid}" ${scopeArg}`);
			expect(result.exitCode).toBe(0);
			expect(result.stdout).toContain(`SKIPPED: ${skipped}`);
			expect(result.stdout).toMatch(
				/^2 files · 1 passed · 0 failed · 1 skipped$/m,
			);
		});

		it("collapses high-error batches without changing the failure exit code", () => {
			const first = join(scratch, "many-errors-first.md");
			const second = join(scratch, "many-errors-second.md");
			writeFileSync(
				first,
				[
					"[one](missing-one.md)",
					"[two](missing-two.md)",
					"[three](missing-three.md)",
				].join("\n"),
			);
			writeFileSync(
				second,
				[
					"[four](missing-four.md)",
					"[five](missing-five.md)",
					"[six](missing-six.md)",
				].join("\n"),
			);

			const compact = run(`validate "${first}" "${second}" ${scopeArg}`);
			const verbose = run(
				`validate "${first}" "${second}" ${scopeArg} --verbose`,
			);

			expect(compact.exitCode).toBe(1);
			expect(compact.stdout).toContain(`${first} (3 errors)`);
			expect(compact.stdout).toContain(`${second} (3 errors)`);
			expect(compact.stdout).not.toContain("Line 1:");
			expect(compact.stdout).toContain("6 error details hidden");
			expect(verbose.exitCode).toBe(1);
			expect(verbose.stdout).toContain("Line 1:");
			expect(verbose.stdout).not.toContain("error details hidden");
		});
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
			expect(stdout).toMatch(/^1 files · 1 passed · 0 failed · 0 skipped$/m);
		});

		it("changed-empty: no changes present exits zero", () => {
			execSync("git add -A", { cwd: scratch });
			execSync('git commit -q -m "add new"', { cwd: scratch });

			const stdout = runCLI(`node "${cliPath}" validate --changed`, {
				cwd: scratch,
			});
			expect(stdout).toMatch(/^0 files · 0 passed · 0 failed · 0 skipped$/m);
		});
	});
});
