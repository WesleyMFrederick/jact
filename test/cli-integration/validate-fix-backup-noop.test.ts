import { spawnSync } from "node:child_process";
import {
	mkdirSync,
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
const workDir = path.join(tmpdir(), "jact-fix-backup-noop-test");
const sourcePath = path.join(workDir, "source.md");

const FIXABLE_SOURCE = "[Q1: Does it fit](target.md#Q1:%20Does%20it%20fit)\n";
const UNFIXABLE_SOURCE = [
	"[Kebab](target.md#q1-does-it-fit)",
	"[Nope](target.md#Q1%20Nope)",
	"",
].join("\n");

function fix(source: string, ...extra: string[]) {
	writeFileSync(sourcePath, source);
	return spawnSync(
		process.execPath,
		[cliPath, "validate", sourcePath, "--fix", "--scope", workDir, ...extra],
		{ cwd: workDir, encoding: "utf8" },
	);
}

const backups = (): string[] =>
	readdirSync(workDir).filter((name) => name.endsWith(".bak"));

describe("jact validate --fix — backups and no-op fixes", () => {
	beforeEach(() => {
		rmSync(workDir, { recursive: true, force: true });
		mkdirSync(workDir, { recursive: true });
		writeFileSync(
			path.join(workDir, "target.md"),
			"# Target\n\n## Q1: Does it fit\n\nText.\n",
		);
	});

	afterEach(() => {
		rmSync(workDir, { recursive: true, force: true });
	});

	it("writes a .bak backup by default", () => {
		const result = fix(FIXABLE_SOURCE);

		expect(result.stdout).toContain("Backup written to:");
		expect(backups()).toHaveLength(1);
	});

	it("--no-backup applies the fix without writing a .bak file", () => {
		const result = fix(FIXABLE_SOURCE, "--no-backup");

		expect(result.stdout).toContain("Fixed 1 citation");
		expect(result.stdout).toContain("No backup written (--no-backup).");
		expect(readFileSync(sourcePath, "utf8")).toBe(
			"[Q1: Does it fit](target.md#Q1%20Does%20it%20fit)\n",
		);
		expect(backups()).toEqual([]);
	});

	it("does not count or report fixes that leave the citation unchanged", () => {
		const result = fix(UNFIXABLE_SOURCE);

		expect(result.stdout).not.toContain("Fixed");
		expect(result.stdout).toContain("No auto-fixable citations found");
		expect(readFileSync(sourcePath, "utf8")).toBe(UNFIXABLE_SOURCE);
		expect(backups()).toEqual([]);
	});
});
