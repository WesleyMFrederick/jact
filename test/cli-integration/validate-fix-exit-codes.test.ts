import { spawnSync } from "node:child_process";
import {
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const cliPath = path.resolve(testDir, "../../dist/cli.js");

const FIXABLE = "[Q1: Does it fit](target.md#Q1:%20Does%20it%20fit)\n";
const FIXED = "[Q1: Does it fit](target.md#Q1%20Does%20it%20fit)\n";
const UNFIXABLE = "[Gone](missing-target.md)\n";

let workDir: string;
let sourcePath: string;

function run(args: string[], input?: string) {
	return spawnSync(process.execPath, [cliPath, "validate", ...args], {
		cwd: workDir,
		encoding: "utf8",
		...(input !== undefined && { input }),
	});
}

const backups = (): string[] =>
	readdirSync(workDir).filter((name) => name.endsWith(".bak"));

describe("jact validate --fix — exit codes", () => {
	beforeEach(() => {
		workDir = mkdtempSync(path.join(tmpdir(), "jact-fix-exit-"));
		sourcePath = path.join(workDir, "source.md");
		writeFileSync(
			path.join(workDir, "target.md"),
			"# Target\n\n## Q1: Does it fit\n\nText.\n",
		);
	});

	afterEach(() => {
		rmSync(workDir, { recursive: true, force: true });
	});

	it("Given a missing file, When fixed, Then exits 2", () => {
		const result = run([path.join(workDir, "nope.md"), "--fix", "--scope", workDir]);

		expect(result.status).toBe(2);
	});

	it("Given an error --fix cannot repair, When fixed, Then applies the other fixes and exits 1", () => {
		writeFileSync(sourcePath, FIXABLE + UNFIXABLE);

		const result = run([sourcePath, "--fix", "--scope", workDir]);

		expect(result.stdout).toContain("Fixed 1 citation");
		expect(readFileSync(sourcePath, "utf8")).toBe(FIXED + UNFIXABLE);
		expect(result.status).toBe(1);
	});

	it("Given only fixable errors, When fixed, Then exits 0", () => {
		writeFileSync(sourcePath, FIXABLE);

		const result = run([sourcePath, "--fix", "--scope", workDir]);

		expect(readFileSync(sourcePath, "utf8")).toBe(FIXED);
		expect(result.status).toBe(0);
	});

	it("Given fixable errors, When previewed with --dry-run, Then writes nothing and exits 1", () => {
		writeFileSync(sourcePath, FIXABLE);

		const result = run([sourcePath, "--fix", "--dry-run", "--scope", workDir]);

		expect(result.stdout).toContain("DRY RUN");
		expect(readFileSync(sourcePath, "utf8")).toBe(FIXABLE);
		expect(result.status).toBe(1);
	});

	it.each([
		["two paths", ["source.md", "target.md", "--fix"]],
		["a glob", ["*.md", "--fix"]],
		["--json", ["source.md", "--json", "--fix"]],
		["--changed", ["--changed", "--fix"]],
		["--dry-run in batch", ["source.md", "target.md", "--dry-run"]],
		["--no-backup in batch", ["source.md", "target.md", "--no-backup"]],
	])("Given batch selection with %s, When fix flags are set, Then exits 2 and writes nothing", (_label, args) => {
		writeFileSync(sourcePath, FIXABLE);

		const result = run([...args, "--scope", workDir]);

		expect(result.status).toBe(2);
		expect(result.stderr).toContain("ERROR:");
		expect(result.stdout).toBe("");
		expect(readFileSync(sourcePath, "utf8")).toBe(FIXABLE);
		expect(backups()).toEqual([]);
	});

	it("Given --stdin, When --fix is set, Then exits 2 and writes nothing", () => {
		writeFileSync(sourcePath, FIXABLE);

		const result = run([sourcePath, "--stdin", "--fix", "--scope", workDir], FIXABLE);

		expect(result.status).toBe(2);
		expect(result.stderr).toContain("ERROR:");
		expect(readFileSync(sourcePath, "utf8")).toBe(FIXABLE);
		expect(backups()).toEqual([]);
	});
});
