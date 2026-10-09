/**
 * `jact vault-link` end-to-end: spawns the built CLI against a temp Obsidian
 * vault and a temp git repo (main checkout + linked .paseo worktree) outside it.
 */

import { type SpawnSyncReturns, spawnSync } from "node:child_process";
import {
	existsSync,
	lstatSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	readlinkSync,
	realpathSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { shellArgument } from "../../src/shellArgument.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const cliPath = path.resolve(testDir, "../../dist/cli.js");
const RULE_ID = "obsidian/no-vault-escape-link";
const REPO_NAME = "proj-repo";

let root: string;
let configHome: string;
let vault: string;
let notesDir: string;
let note: string;
let mainCheckout: string;
let worktree: string;

/** Environment without inherited GIT_* variables (e.g. from a hook-driven run). */
function cleanEnv(): NodeJS.ProcessEnv {
	const env: NodeJS.ProcessEnv = {};
	for (const [key, value] of Object.entries(process.env)) {
		if (!key.startsWith("GIT_")) env[key] = value;
	}
	env["XDG_CONFIG_HOME"] = configHome;
	return env;
}

function git(cwd: string, args: string[]): void {
	const result = spawnSync(
		"git",
		[
			"-c",
			"user.name=Vault Link Test",
			"-c",
			"user.email=vault-link@example.com",
			"-c",
			"commit.gpgsign=false",
			"-c",
			"core.hooksPath=/dev/null",
			"-c",
			"init.defaultBranch=main",
			...args,
		],
		{ cwd, encoding: "utf8", env: cleanEnv() },
	);
	if (result.status !== 0) {
		throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
	}
}

function jact(args: string[]): SpawnSyncReturns<string> {
	return spawnSync(process.execPath, [cliPath, ...args], {
		cwd: root,
		encoding: "utf8",
		env: cleanEnv(),
	});
}

function lastLine(text: string): string {
	const lines = text.trimEnd().split("\n");
	return lines[lines.length - 1] ?? "";
}

function escapeFindings(notePath: string): Array<{ ruleId: string; message: string; source: string }> {
	const result = jact(["validate", notePath, "--format", "json"]);
	const report = JSON.parse(result.stdout) as {
		findings?: Array<{ ruleId: string; message: string; source: string }>;
	};
	return (report.findings ?? []).filter((finding) => finding.ruleId === RULE_ID);
}

function isSymlink(filePath: string): boolean {
	try {
		return lstatSync(filePath).isSymbolicLink();
	} catch {
		return false;
	}
}

beforeEach(() => {
	root = realpathSync(mkdtempSync(path.join(tmpdir(), "jact-vault-link-")));
	configHome = path.join(root, "config-home");
	mkdirSync(path.join(configHome, "jact"), { recursive: true });
	writeFileSync(
		path.join(configHome, "jact", "config.json"),
		JSON.stringify({ rules: { [RULE_ID]: "error" } }),
	);

	vault = path.join(root, "vault");
	notesDir = path.join(vault, "notes");
	mkdirSync(path.join(vault, ".obsidian"), { recursive: true });
	mkdirSync(notesDir, { recursive: true });
	note = path.join(notesDir, "note.md");
	writeFileSync(path.join(vault, "other.md"), "# Other\n");

	mainCheckout = path.join(root, REPO_NAME);
	mkdirSync(path.join(mainCheckout, "docs"), { recursive: true });
	writeFileSync(
		path.join(mainCheckout, "docs", "spec.md"),
		"# Anchor\n\nText.\n\n## Second\n\nMore.\n",
	);
	writeFileSync(path.join(mainCheckout, "docs", "other.md"), "# Other\n");
	git(mainCheckout, ["init"]);
	git(mainCheckout, ["add", "."]);
	git(mainCheckout, ["commit", "-m", "init"]);

	const worktreeParent = path.join(root, "home", ".paseo", "worktrees", "abc123");
	mkdirSync(worktreeParent, { recursive: true });
	worktree = path.join(worktreeParent, "feat-x");
	git(mainCheckout, ["worktree", "add", "-b", "feat-x", worktree]);
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("jact vault-link — single target", () => {
	it("Given a vault note linking a file in a .paseo worktree, When vault-link runs on that target with an anchor, Then a symlink to the main checkout file is created beside the note and the relative link is printed", () => {
		const target = `${path.join(worktree, "docs", "spec.md")}#Anchor`;
		writeFileSync(note, `See [spec](${target}).\n`);

		const result = jact(["vault-link", note, target]);

		expect(result.status, result.stderr).toBe(0);
		const symlinkPath = path.join(notesDir, "sources", REPO_NAME, "docs", "spec.md");
		expect(isSymlink(symlinkPath)).toBe(true);
		expect(readlinkSync(symlinkPath)).toBe(path.join(mainCheckout, "docs", "spec.md"));
		const link = lastLine(result.stdout);
		expect(link).toBe(`sources/${REPO_NAME}/docs/spec.md#Anchor`);
		const resolved = path.resolve(notesDir, link.split("#")[0] ?? "");
		expect(path.relative(vault, resolved).startsWith("..")).toBe(false);
		expect(readFileSync(note, "utf8")).toBe(`See [spec](${target}).\n`);
	});

	it("Given a file that exists only in the worktree, When vault-link runs on it, Then it refuses with exit 1 and creates no symlink", () => {
		writeFileSync(path.join(worktree, "docs", "new.md"), "# New\n");
		const target = path.join(worktree, "docs", "new.md");
		writeFileSync(note, `See [new](${target}).\n`);

		const result = jact(["vault-link", note, target]);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain(path.join(mainCheckout, "docs", "new.md"));
		expect(
			isSymlink(path.join(notesDir, "sources", REPO_NAME, "docs", "new.md")),
		).toBe(false);
	});

	it("Given vault-link already created the symlink, When the same command runs again, Then it reports reuse, exits 0, and keeps the same symlink", () => {
		const target = path.join(worktree, "docs", "spec.md");
		writeFileSync(note, `See [spec](${target}).\n`);
		const symlinkPath = path.join(notesDir, "sources", REPO_NAME, "docs", "spec.md");

		const first = jact(["vault-link", note, target]);
		expect(first.status, first.stderr).toBe(0);
		const second = jact(["vault-link", note, target]);

		expect(second.status, second.stderr).toBe(0);
		expect(second.stdout).toContain("reused");
		expect(readlinkSync(symlinkPath)).toBe(path.join(mainCheckout, "docs", "spec.md"));
		expect(lastLine(second.stdout)).toBe(`sources/${REPO_NAME}/docs/spec.md`);
	});

	it("Given a different symlink already occupies the symlink path, When vault-link runs, Then it exits 1 and leaves the existing symlink unchanged", () => {
		const target = path.join(worktree, "docs", "spec.md");
		writeFileSync(note, `See [spec](${target}).\n`);
		const symlinkPath = path.join(notesDir, "sources", REPO_NAME, "docs", "spec.md");
		mkdirSync(path.dirname(symlinkPath), { recursive: true });
		const elsewhere = path.join(mainCheckout, "docs", "other.md");
		symlinkSync(elsewhere, symlinkPath, "file");

		const result = jact(["vault-link", note, target]);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain(symlinkPath);
		expect(readlinkSync(symlinkPath)).toBe(elsewhere);
	});

	it("Given --dry-run, When vault-link runs on an escaping target, Then it prints the link but creates no symlink or folder", () => {
		const target = `${path.join(worktree, "docs", "spec.md")}#Anchor`;
		writeFileSync(note, `See [spec](${target}).\n`);

		const result = jact(["vault-link", note, target, "--dry-run"]);

		expect(result.status, result.stderr).toBe(0);
		expect(lastLine(result.stdout)).toBe(`sources/${REPO_NAME}/docs/spec.md#Anchor`);
		expect(existsSync(path.join(notesDir, "sources"))).toBe(false);
	});
});

describe("jact vault-link --all", () => {
	it("Given a note with several kinds of escaping links and one in-vault link, When --all runs, Then every escape is rewritten with anchors kept, the in-vault link is unchanged, and validate reports no escape findings", () => {
		const mainSpec = path.join(mainCheckout, "docs", "spec.md");
		const worktreeSpec = path.join(worktree, "docs", "spec.md");
		const fileUrl = pathToFileURL(path.join(mainCheckout, "docs", "other.md")).href;
		writeFileSync(
			note,
			[
				`- [abs](${mainSpec}#Anchor)`,
				`- [url](${fileUrl})`,
				`- [wt](${worktreeSpec}#Second)`,
				`- [rel](../../${REPO_NAME}/docs/spec.md)`,
				`- [again](${mainSpec}#Second)`,
				"- [inside](../other.md)",
				"",
			].join("\n"),
		);
		expect(escapeFindings(note)).toHaveLength(5);

		const result = jact(["vault-link", note, "--all"]);

		expect(result.status, result.stderr).toBe(0);
		expect(result.stdout).toMatch(
			/vault-link: 5 links rewritten, 2 symlinks created, \d+ reused, 0 refused/,
		);
		const specLink = `sources/${REPO_NAME}/docs/spec.md`;
		expect(readFileSync(note, "utf8")).toBe(
			[
				`- [abs](${specLink}#Anchor)`,
				`- [url](sources/${REPO_NAME}/docs/other.md)`,
				`- [wt](${specLink}#Second)`,
				`- [rel](${specLink})`,
				`- [again](${specLink}#Second)`,
				"- [inside](../other.md)",
				"",
			].join("\n"),
		);
		expect(readlinkSync(path.join(notesDir, specLink))).toBe(mainSpec);
		expect(escapeFindings(note)).toEqual([]);
	});
});

describe("obsidian/no-vault-escape-link message", () => {
	it("Given a vault note with an escaping link carrying an anchor, When validated, Then the finding names the exact shell-quoted vault-link command for this note and target", () => {
		const target = `${path.join(mainCheckout, "docs", "spec.md")}#Anchor`;
		writeFileSync(note, `See [spec](${target}).\n`);

		const findings = escapeFindings(note);

		expect(findings).toHaveLength(1);
		expect(findings[0]?.message).toBe(
			`Link leaves the Obsidian vault, so Obsidian cannot open it. Fix: jact vault-link ${shellArgument(note)} ${shellArgument(target)} (or --all for every such link in this note)`,
		);
	});
});
