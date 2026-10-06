import { spawnSync } from "node:child_process";
import {
	mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const cliPath = fileURLToPath(new URL("../../dist/cli.js", import.meta.url));
let workDir: string;
let notePath: string;

function validate(content: string, args: string[] = [], stdin = false) {
	if (!stdin) writeFileSync(notePath, content);
	return spawnSync(process.execPath, [
		cliPath, "validate", notePath, "--scope", workDir,
		...(stdin ? ["--stdin"] : []), ...args,
	], { cwd: workDir, encoding: "utf8", ...(stdin ? { input: content } : {}) });
}

function readReport(content: string, args: string[] = [], stdin = false) {
	const result = validate(content, ["--format", "json", ...args], stdin);
	return { result, report: JSON.parse(result.stdout) };
}

function backups(): string[] {
	return readdirSync(path.dirname(notePath)).filter((name) => name.endsWith(".bak"));
}

describe("plain file paths in Markdown notes", () => {
	beforeEach(() => {
		workDir = mkdtempSync(path.join(tmpdir(), "jact-plain-paths-"));
		for (const directory of ["docs", "plans", "data", "src"]) {
			mkdirSync(path.join(workDir, directory));
		}
		notePath = path.join(workDir, "docs/note.md");
		writeFileSync(path.join(workDir, "plans/plan.md"), "# Plan\n\n## Details\n\nText.\n");
		writeFileSync(path.join(workDir, "data/results.json"), "{\"ok\":true}\n");
		writeFileSync(path.join(workDir, "src/tool.ts"), "export const answer = 42;\n");
	});

	afterEach(() => {
		rmSync(workDir, { recursive: true, force: true });
	});

	it("Given prose, code, and a slash command, When validated, Then checks Markdown and non-Markdown targets without writing", () => {
		const content = [
			"See ../plans/plan.md.",
			"`../data/results.json`",
			"```sh",
			"jact extract header ../plans/plan.md Details",
			"```",
			"/goal plan:../plans/plan.md",
			"../src/tool.ts:12",
			"",
		].join("\n");
		const { result, report } = readReport(content);

		expect(result.status).toBe(0);
		expect(report.links).toEqual([]);
		expect(report.plainPaths.map((reference: { raw: string }) => reference.raw)).toEqual([
			"../plans/plan.md", "../data/results.json", "../plans/plan.md",
			"../plans/plan.md", "../src/tool.ts:12",
		]);
		expect(report.summary).toEqual({ total: 5, valid: 5, warnings: 0, errors: 0 });
		expect(readFileSync(notePath, "utf8")).toBe(content);
		expect(backups()).toEqual([]);
	});

	it("Given the same path in code and prose, When fixed, Then converts only prose and backs up the original", () => {
		const content = [
			"`../plans/plan.md`",
			"See ../plans/plan.md#Details.",
			"```sh",
			"jact extract header ../plans/plan.md Details",
			"```",
			"/goal plan:../plans/plan.md",
			"../data/results.json",
			"../src/tool.ts:12",
			"",
		].join("\n");
		const result = validate(content, ["--fix"]);

		expect(result.status).toBe(0);
		expect(readFileSync(notePath, "utf8")).toBe(content.replace(
			"See ../plans/plan.md#Details.",
			"See [../plans/plan.md#Details](../plans/plan.md#Details).",
		));
		const backupNames = backups();
		expect(backupNames).toHaveLength(1);
		expect(backupNames.map((name) =>
			readFileSync(path.join(path.dirname(notePath), name), "utf8"),
		)).toEqual([content]);
	});

	it("Given a fixable prose path, When dry-run is used, Then previews the link without changing files or writing backups", () => {
		const content = "See ../plans/plan.md.\n";
		const result = validate(content, ["--fix", "--dry-run"]);

		expect(result.stdout).toContain("[../plans/plan.md](../plans/plan.md)");
		expect(result.stdout).toContain("No files were written");
		expect(readFileSync(notePath, "utf8")).toBe(content);
		expect(backups()).toEqual([]);
	});

	it("Given a scope-relative prose path, When fixed without backups, Then writes a working note-relative link", () => {
		const result = validate("See plans/plan.md.\n", ["--fix", "--no-backup"]);

		expect(result.stdout).toContain("No backup written");
		expect(readFileSync(notePath, "utf8")).toBe("See [plans/plan.md](../plans/plan.md).\n");
		expect(backups()).toEqual([]);
	});

	it("Given missing files and a matching basename elsewhere, When validated, Then reports exact missing targets rather than guessing", () => {
		const { result, report } = readReport("plan.md\n`../data/missing.json`\n");

		expect(result.status).toBe(1);
		expect(report.summary.errors).toBe(2);
		expect(report.plainPaths.map((reference: { validation: { error: string } }) => reference.validation.error)).toEqual([
			"File not found: plan.md", "File not found: ../data/missing.json",
		]);
		const human = validate("`../data/missing.json`\n");
		expect(human.status).toBe(1);
		expect(human.stdout).toContain("Line 1: ../data/missing.json");
		expect(human.stdout).toContain("File not found: ../data/missing.json");
	});

	it("Given two exact locations, When validated or fixed, Then reports both and does not choose a target", () => {
		writeFileSync(path.join(workDir, "shared.md"), "# Root\n");
		writeFileSync(path.join(workDir, "docs/shared.md"), "# Note-relative\n");
		const content = "See shared.md.\n";
		const { result, report } = readReport(content);

		expect(result.status).toBe(1);
		expect(report.plainPaths[0].target).toBeNull();
		expect(report.plainPaths[0].candidates).toEqual([
			path.join(workDir, "docs/shared.md"), path.join(workDir, "shared.md"),
		]);
		expect(report.plainPaths[0].validation.error).toContain("Ambiguous plain file path: shared.md");
		const fixed = validate(content, ["--fix"]);
		expect(fixed.stdout).toContain("Ambiguous plain file path: shared.md");
		expect(readFileSync(notePath, "utf8")).toBe(content);
		expect(backups()).toEqual([]);
	});

	it("Given links, URLs, globs, and templates, When validated, Then does not create duplicate or invented plain references", () => {
		const content = [
			"[../src/missing.ts](../plans/plan.md)",
			"[[../plans/plan.md]]",
			"",
			"[plan]: ../plans/plan.md",
			"",
			"[cite: ../plans/plan.md]",
			"![../data/missing.json](../plans/plan.md)",
			"https://example.test/missing.md",
			"`https://example.test/missing.json`",
			"`plans/*.md` `plans/file?.md` `plans/{one,two}.md`",
			"`${ROOT}/missing.md` `{{folder}}/missing.json` `<path>/missing.md`",
			"",
		].join("\n");
		const { report } = readReport(content);

		expect(report.plainPaths).toEqual([]);
		expect(report.links.map((link: { target: { path: { raw: string } } }) => link.target.path.raw)).toEqual([
			"../plans/plan.md", "../plans/plan.md", "../plans/plan.md", "../plans/plan.md",
		]);
	});

	it("Given absolute and home-relative paths, When validated, Then checks their literal files and preserves suffixes", () => {
		const absolute = path.join(workDir, "data/results.json");
		const homeRelative = `~/${path.relative(homedir(), path.join(workDir, "src/tool.ts"))}`;
		const { result, report } = readReport(`${absolute}\n\`${homeRelative}:L12-L14\`\n`);

		expect(result.status).toBe(0);
		expect(report.plainPaths.map((reference: { target: string; suffix: string }) => [reference.target, reference.suffix])).toEqual([
			[absolute, ""], [path.join(workDir, "src/tool.ts"), ":L12-L14"],
		]);
	});

	it("Given a lowercase command-shaped line with no code markup, When fixed, Then preserves its uncertain syntax while still checking its file", () => {
		const content = "custom-tool ../plans/plan.md\n";
		validate(content, ["--fix"]);

		expect(readFileSync(notePath, "utf8")).toBe(content);
		expect(backups()).toEqual([]);
		const { result, report } = readReport("custom-tool ../plans/missing.md\n");
		expect(result.status).toBe(1);
		expect(report.plainPaths[0].validation.error).toBe("File not found: ../plans/missing.md");
	});

	it("Given in-memory content with paths on different lines, When line-filtered, Then reports only the selected path without reading a note", () => {
		const { result, report } = readReport("../plans/plan.md\n../data/missing.json\n", ["--lines", "2"], true);

		expect(result.status).toBe(1);
		expect(report.summary).toEqual({ total: 1, valid: 0, warnings: 0, errors: 1 });
		expect(report.plainPaths[0].line).toBe(2);
	});

	it("Given a missing non-Markdown path, When batch JSON is requested, Then includes its line and error", () => {
		const result = validate("`../data/missing.json`\n", ["--json"]);

		expect(result.status).toBe(1);
		expect(JSON.parse(result.stdout)).toEqual({
			path: notePath, ok: false,
			errors: [{ line: 1, message: "File not found: ../data/missing.json" }],
		});
	});
});
