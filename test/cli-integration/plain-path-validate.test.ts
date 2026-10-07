import { spawnSync } from "node:child_process";
import {
	mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
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

describe("plain text paths in Markdown notes", () => {
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

	it("Given plain text and code that only look like paths, When validated, Then reports no errors in any output format (#110)", () => {
		const content = [
			"# Repro",
			"",
			"Plain words: artifact/skill and AI/LLM, and ../data/missing.json.",
			"",
			"Slash command in code: `/move <path>`.",
			"",
			"Abbrev e.g and file CLAUDE.md in text.",
			"",
			"Inline code path: `~/.pi/agent/config.yml`.",
			"",
			"```sh",
			"jact extract header ../plans/missing.md Details",
			"```",
			"",
		].join("\n");
		const { result, report } = readReport(content);

		expect(result.status).toBe(0);
		expect(report.links).toEqual([]);
		expect(report.summary).toEqual({ total: 0, valid: 0, warnings: 0, errors: 0 });
		expect(validate(content).status).toBe(0);
		expect(JSON.parse(validate(content, ["--json"]).stdout)).toEqual({
			path: notePath, ok: true, errors: [],
		});
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

	it.each([":12", ":L12-L14"])("Given a prose Markdown path with %s, When fixed, Then retains the suffix only in link text", (suffix) => {
		const content = `See ../plans/plan.md${suffix}.\n`;
		const result = validate(content, ["--fix"]);

		expect(result.status).toBe(0);
		const updated = readFileSync(notePath, "utf8");
		expect(updated).toBe(`See [../plans/plan.md${suffix}](../plans/plan.md).\n`);
		const checked = readReport(updated);
		expect(checked.result.status).toBe(0);
		expect(checked.report.links[0].validation.status).toBe("valid");
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

	it("Given two exact locations, When fixed, Then does not choose a target", () => {
		writeFileSync(path.join(workDir, "shared.md"), "# Root\n");
		writeFileSync(path.join(workDir, "docs/shared.md"), "# Note-relative\n");
		const content = "See shared.md and missing/file.md.\n";
		const fixed = validate(content, ["--fix"]);

		expect(fixed.status).toBe(0);
		expect(fixed.stdout).toContain("No auto-fixable citations found");
		expect(readFileSync(notePath, "utf8")).toBe(content);
		expect(backups()).toEqual([]);
	});

	it("Given paths inside links, wiki links, definitions, and citations, When fixed, Then does not wrap them in another link", () => {
		const content = [
			"[see ../plans/plan.md](../plans/plan.md)",
			"[[../plans/plan.md]]",
			"",
			"[plan]: ../plans/plan.md",
			"",
			"[cite: ../plans/plan.md]",
			"",
		].join("\n");
		validate(content, ["--fix"]);

		expect(readFileSync(notePath, "utf8")).toBe(content);
		expect(backups()).toEqual([]);
	});

	it("Given a lowercase command-shaped line with no code markup, When fixed, Then preserves its uncertain syntax", () => {
		const content = "custom-tool ../plans/plan.md\n";
		validate(content, ["--fix"]);

		expect(readFileSync(notePath, "utf8")).toBe(content);
		expect(backups()).toEqual([]);
	});
});
