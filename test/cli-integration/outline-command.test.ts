import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "../..");
const cliPath = path.join(repoRoot, "dist/cli.js");
const fixture = path.join(repoRoot, "test/fixtures/outline-command.md");
const fixtureScope = path.dirname(fixture);
const workDir = path.join(tmpdir(), "jact-outline-cli-test");

function run(
	args: string[],
	options: { session?: string; cwd?: string } = {},
): { status: number | null; stdout: string; stderr: string } {
	const env = { ...process.env };
	delete env["JACT_SESSION_ID"];
	delete env["CLAUDE_SESSION_ID"];
	if (options.session !== undefined) env["JACT_SESSION_ID"] = options.session;
	return spawnSync(process.execPath, [cliPath, ...args], {
		cwd: options.cwd ?? workDir,
		env,
		encoding: "utf8",
	});
}

function outlineArgs(...extra: string[]): string[] {
	return ["outline", fixture, ...extra, "--scope", fixtureScope];
}

describe("jact outline CLI", () => {
	beforeEach(() => {
		rmSync(workDir, { recursive: true, force: true });
		mkdirSync(workDir, { recursive: true });
	});

	afterEach(() => {
		rmSync(workDir, { recursive: true, force: true });
	});

	it("renders the default outline and first-call guidance", () => {
		const result = run(outlineArgs(), { session: "default-session" });

		expect(result.status).toBe(0);
		expect(result.stdout).toContain('"Guide"');
		expect(result.stdout).toContain('├── "Install" [*]');
		expect(result.stdout).toContain(
			'"Troubleshooting: \\"Logs\\" — 日本語" [*]',
		);
		expect(result.stdout).toContain('"**Reference** & café"');
		expect(result.stdout).toContain('"Setext Reference"');
		expect(result.stdout).toContain(
			'[*] To Expand: run `jact outline "{{absolute-or-relative-path-to-file}}" H2 --expand "{{full-header-1-text}},{{full-header-2-text}}"`',
		);
		expect(result.stdout).toContain(
			'To Extract: run `jact extract header "{{absolute-or-relative-path-to-file}}" "{{full-header-text}}" --within "{{unique-parent-header-text}}"`',
		);
		expect(result.stdout).not.toContain('"macOS"');
		expect(result.stdout).not.toContain("Not a document heading");
	});

	it("renders H1 only and accepts an explicit H-level with full branch expansion", () => {
		const h1 = run(outlineArgs("H1"));
		const expanded = run(
			outlineArgs("H3", "--expand", "Install", "--within", "Guide"),
		);

		expect(h1.status).toBe(0);
		expect(h1.stdout).toContain('"Guide"');
		expect(h1.stdout).toContain('"Appendix"');
		expect(h1.stdout).not.toContain('├── "Install"');
		expect(expanded.status).toBe(0);
		expect(expanded.stdout).toContain('"macOS"');
		expect(expanded.stdout).toContain('"Homebrew"');
		expect(expanded.stdout).toContain(
			'"Troubleshooting: \\"Logs\\" — 日本語" [*]',
		);
		expect(expanded.stdout).not.toContain('"Deep logs"');
		expect(expanded.stdout).not.toContain('"Appendix"');
	});

	it("fully expands multiple named sections in one command", () => {
		const result = run(
			outlineArgs(
				"H2",
				"--expand",
				'Install,Troubleshooting: "Logs" — 日本語',
				"--within",
				"Guide",
			),
		);

		expect(result.status).toBe(0);
		expect(result.stdout).toContain('"Homebrew"');
		expect(result.stdout).toContain('"Deep logs"');
		expect(result.stdout).not.toContain('"Install" [*]');
		expect(result.stdout).not.toContain(
			'"Troubleshooting: \\"Logs\\" — 日本語" [*]',
		);
	});

	it("narrows duplicate child names through a unique parent", () => {
		const result = run(
			outlineArgs("H2", "--expand", "Install", "--within", "Guide"),
		);

		expect(result.status).toBe(0);
		expect(result.stdout).toContain('"Guide"');
		expect(result.stdout).toContain('"Homebrew"');
		expect(result.stdout).not.toContain('"Appendix"');
		expect(result.stdout).not.toContain('"Alternate install"');
	});

	it("rejects ambiguous, missing, and comma-bearing expansion selectors safely", () => {
		const ambiguous = run(outlineArgs("--expand", "Install"));
		const missing = run(outlineArgs("--expand", "Instal"));
		const comma = run(
			outlineArgs("--expand", "Costs, Benefits", "--within", "Appendix"),
		);

		expect(ambiguous.status).toBe(1);
		expect(ambiguous.stderr).toContain('"Install" is ambiguous');
		expect(ambiguous.stderr).toContain('under "Guide"');
		expect(ambiguous.stderr).toContain('under "Appendix"');
		expect(ambiguous.stderr).toContain("--within");
		expect(missing.status).toBe(1);
		expect(missing.stderr).toContain('"Instal" was not found');
		expect(missing.stderr).toContain("Close alternatives:");
		expect(comma.status).toBe(1);
		expect(comma.stderr).toContain("contains a comma");
		expect(comma.stdout).toBe("");
	});

	it("recommends a unique ancestor when immediate parent names are duplicated", () => {
		const nested = path.join(workDir, "nested-duplicates.md");
		writeFileSync(
			nested,
			"# Guide\n\n## Section\n\n### Setup\n\n# Appendix\n\n## Section\n\n### Setup\n",
		);

		const ambiguous = run([
			"outline",
			nested,
			"--expand",
			"Setup",
			"--scope",
			workDir,
		]);
		const narrowed = run([
			"outline",
			nested,
			"--expand",
			"Setup",
			"--within",
			"Guide",
			"--scope",
			workDir,
		]);

		expect(ambiguous.status).toBe(1);
		expect(ambiguous.stderr).toContain('under "Guide" > "Section"');
		expect(ambiguous.stderr).toContain('--within "Guide"');
		expect(ambiguous.stderr).not.toContain('--within "Section"');
		expect(narrowed.status).toBe(0);
		expect(narrowed.stdout).toContain('"Setup"');
		expect(narrowed.stdout).not.toContain('"Appendix"');
	});

	it("suppresses guidance after the default cache records a successful outline", () => {
		const first = run(outlineArgs(), { session: "repeat-session" });
		const second = run(outlineArgs(), { session: "repeat-session" });

		expect(first.stdout).toContain("[*] To Expand:");
		expect(second.status).toBe(0);
		expect(second.stdout).toContain('"Guide"');
		expect(second.stdout).not.toContain("[*] To Expand:");
		expect(second.stdout).not.toContain("To Extract:");
	});

	it("shows guidance immediately after cache reset and caches it again", () => {
		run(outlineArgs(), { session: "reset-session" });
		const reset = run(outlineArgs("--cache-reset"), {
			session: "reset-session",
		});
		const following = run(outlineArgs(), { session: "reset-session" });

		expect(reset.status).toBe(0);
		expect(reset.stdout).toContain("[*] To Expand:");
		expect(reset.stdout).toContain("To Extract:");
		expect(following.stdout).not.toContain("[*] To Expand:");
	});

	it("shows guidance without cross-session suppression when session context is unavailable", () => {
		const first = run(outlineArgs());
		const second = run(outlineArgs());

		expect(first.stdout).toContain("[*] To Expand:");
		expect(second.stdout).toContain("[*] To Expand:");
	});

	it("shows guidance again after the target file content changes", () => {
		const mutableFile = path.join(workDir, "mutable.md");
		writeFileSync(mutableFile, "# Guide\n\n## Install\n\n### macOS\n");
		const args = ["outline", mutableFile, "--scope", workDir];
		const first = run(args, { session: "content-session" });
		const repeated = run(args, { session: "content-session" });
		writeFileSync(
			mutableFile,
			"# Guide\n\n## Install\n\n### macOS\n\n### Linux\n",
		);
		const changed = run(args, { session: "content-session" });

		expect(first.stdout).toContain("[*] To Expand:");
		expect(repeated.stdout).not.toContain("[*] To Expand:");
		expect(changed.stdout).toContain("[*] To Expand:");
	});

	it("returns a successful heading-free result", () => {
		const notes = path.join(workDir, "notes.md");
		writeFileSync(notes, "Plain notes without headings.\n");

		const result = run(["outline", notes, "--scope", workDir], {
			session: "empty-session",
		});

		expect(result.status).toBe(0);
		expect(result.stdout).toBe(
			"No headings found. Use jact extract file for all content.\n",
		);
	});

	it("preserves existing file-resolution diagnostics and ast compatibility", () => {
		const nearMiss = run([
			"outline",
			"outline-comand.md",
			"--scope",
			fixtureScope,
		]);
		const astMiss = run(["ast", "outline-comand.md", "--scope", fixtureScope]);
		const astControl = run(["ast", fixture, "--scope", fixtureScope]);

		expect(nearMiss.status).toBe(2);
		expect(astMiss.status).toBe(2);
		expect(nearMiss.stderr).toContain("Suggestion:");
		expect(astMiss.stderr).toContain("Suggestion:");
		expect(astControl.status).toBe(0);
		expect(JSON.parse(astControl.stdout)).toHaveProperty("headings");
	});

	it("documents the complete public command surface", () => {
		const result = run(["outline", "--help"]);

		expect(result.status).toBe(0);
		expect(result.stdout).toContain("[level]");
		expect(result.stdout).toContain("--expand <headings>");
		expect(result.stdout).toContain("--within <parent>");
		expect(result.stdout).toContain("--cache-reset");
		expect(result.stdout).toContain("Default: H2");
		expect(result.stdout).not.toContain("--session");
	});
});
