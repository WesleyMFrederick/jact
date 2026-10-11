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

function jact(args: string[], env: NodeJS.ProcessEnv = {}): SpawnSyncReturns<string> {
	return spawnSync(process.execPath, [cliPath, ...args], {
		cwd: root,
		encoding: "utf8",
		env: { ...cleanEnv(), ...env },
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

	it("Given the note's sources folder is a symlink to a folder outside the vault, When vault-link runs, Then it refuses with exit 1 and writes nothing outside the vault", () => {
		const outside = path.join(root, "outside");
		mkdirSync(outside);
		symlinkSync(outside, path.join(notesDir, "sources"), "dir");
		const target = path.join(worktree, "docs", "spec.md");
		writeFileSync(note, `See [spec](${target}).\n`);

		const result = jact(["vault-link", note, target]);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain(path.join(notesDir, "sources"));
		expect(existsSync(path.join(outside, REPO_NAME))).toBe(false);
	});

	it("Given the main checkout file is a symlink into a linked worktree, When vault-link runs on it, Then it refuses with exit 1 and creates no symlink", () => {
		writeFileSync(path.join(worktree, "docs", "wt-only.md"), "# Only\n");
		symlinkSync(
			path.join(worktree, "docs", "wt-only.md"),
			path.join(mainCheckout, "docs", "linked.md"),
			"file",
		);
		const target = path.join(mainCheckout, "docs", "linked.md");
		writeFileSync(note, `See [linked](${target}).\n`);

		const result = jact(["vault-link", note, target]);

		expect(result.status).toBe(1);
		expect(
			isSymlink(path.join(notesDir, "sources", REPO_NAME, "docs", "linked.md")),
		).toBe(false);
	});

	it("Given a file symlink outside any repo points into a linked worktree, When vault-link runs on the symlink, Then the real worktree location maps to the main checkout", () => {
		const alias = path.join(root, "outside-repo-alias.md");
		symlinkSync(path.join(worktree, "docs", "spec.md"), alias, "file");
		writeFileSync(note, `See [alias](${alias}).\n`);

		const result = jact(["vault-link", note, alias]);

		expect(result.status, result.stderr).toBe(0);
		const symlinkPath = path.join(
			notesDir,
			"sources",
			REPO_NAME,
			"docs",
			"spec.md",
		);
		expect(readlinkSync(symlinkPath)).toBe(
			path.join(mainCheckout, "docs", "spec.md"),
		);
		expect(lastLine(result.stdout)).toBe(
			`sources/${REPO_NAME}/docs/spec.md`,
		);
	});

	it("Given the vault already shows the repo folder through a folder symlink, When vault-link runs on a worktree file, Then the link goes through that vault folder and no symlink is created", () => {
		symlinkSync(path.join(mainCheckout, "docs"), path.join(vault, "repo-docs"), "dir");
		const target = `${path.join(worktree, "docs", "spec.md")}#Second`;
		writeFileSync(note, `See [spec](${target}).\n`);

		const result = jact(["vault-link", note, target]);

		expect(result.status, result.stderr).toBe(0);
		expect(lastLine(result.stdout)).toBe("../repo-docs/spec.md#Second");
		expect(existsSync(path.join(notesDir, "sources"))).toBe(false);
	});

	it("Given a link leaves the vault but its real file is inside the vault, When vault-link runs, Then the link points at the vault file and no symlink is created", () => {
		const alias = path.join(root, "outside-alias-of-vault-note.md");
		symlinkSync(path.join(vault, "other.md"), alias, "file");
		writeFileSync(note, `See [other](${alias}).\n`);

		const result = jact(["vault-link", note, alias]);

		expect(result.status, result.stderr).toBe(0);
		expect(lastLine(result.stdout)).toBe("../other.md");
		expect(existsSync(path.join(notesDir, "sources"))).toBe(false);
	});

	it("Given the target sits under a dot folder in the repo, When vault-link runs, Then it refuses with exit 1 because Obsidian would not index the symlink", () => {
		mkdirSync(path.join(mainCheckout, ".agents"));
		writeFileSync(path.join(mainCheckout, ".agents", "skill.md"), "# Skill\n");
		const target = path.join(mainCheckout, ".agents", "skill.md");
		writeFileSync(note, `See [skill](${target}).\n`);

		const result = jact(["vault-link", note, target]);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain(".agents");
		expect(existsSync(path.join(notesDir, "sources"))).toBe(false);
	});

	it("Given a hand-made file symlink to a file the vault already shows through a folder symlink, When validated and then --all runs, Then validate flags it and --all rewrites the link to the shown path", () => {
		symlinkSync(path.join(mainCheckout, "docs"), path.join(vault, "repo-docs"), "dir");
		mkdirSync(path.join(notesDir, "sources"));
		symlinkSync(
			path.join(mainCheckout, "docs", "spec.md"),
			path.join(notesDir, "sources", "spec.md"),
			"file",
		);
		writeFileSync(note, "See [spec](sources/spec.md#Second).\n");
		writeFileSync(
			path.join(configHome, "jact", "config.json"),
			JSON.stringify({ rules: { "obsidian/no-unindexed-link": "error" } }),
		);

		const before = jact(["validate", note]);
		const fixed = jact(["vault-link", note, "--all"]);
		const after = jact(["validate", note]);

		expect(before.status).toBe(1);
		expect(before.stdout).toContain("obsidian/no-unindexed-link");
		expect(fixed.status, fixed.stderr).toBe(0);
		expect(readFileSync(note, "utf8")).toBe(
			"See [spec](../repo-docs/spec.md#Second).\n",
		);
		expect(after.status, after.stdout).toBe(0);
	});

	it("Given another note's sources folder symlinks the worktree, When vault-link runs on a worktree file, Then it links the main checkout beside this note instead of reusing the other note's folder", () => {
		mkdirSync(path.join(vault, "other", "sources"), { recursive: true });
		symlinkSync(worktree, path.join(vault, "other", "sources", "wt"), "dir");
		const target = `${path.join(worktree, "docs", "spec.md")}#Second`;
		writeFileSync(note, `See [spec](${target}).\n`);

		const result = jact(["vault-link", note, target]);

		expect(result.status, result.stderr).toBe(0);
		expect(lastLine(result.stdout)).toBe(
			`sources/${REPO_NAME}/docs/spec.md#Second`,
		);
		expect(
			readlinkSync(
				path.join(notesDir, "sources", REPO_NAME, "docs", "spec.md"),
			),
		).toBe(path.join(mainCheckout, "docs", "spec.md"));
	});

	it("Given a link through a vault folder symlink into the worktree, When validated and then --all runs, Then validate flags it and --all relinks it to the main checkout", () => {
		symlinkSync(worktree, path.join(vault, "wt"), "dir");
		writeFileSync(note, "See [spec](../wt/docs/spec.md#Second).\n");
		writeFileSync(
			path.join(configHome, "jact", "config.json"),
			JSON.stringify({ preset: "obsidian" }),
		);

		const before = jact(["validate", note]);
		const fixed = jact(["vault-link", note, "--all"]);
		const after = jact(["validate", note]);

		expect(before.status).toBe(1);
		expect(before.stdout).toContain("obsidian/no-unstable-symlink-link");
		expect(fixed.status, fixed.stderr).toBe(0);
		expect(readFileSync(note, "utf8")).toBe(
			`See [spec](sources/${REPO_NAME}/docs/spec.md#Second).\n`,
		);
		expect(after.status, after.stdout).toBe(0);
	});

	it("Given a hand-made per-file symlink into the worktree, When validated and then --all runs, Then validate flags it and --all relinks it to the main checkout", () => {
		mkdirSync(path.join(notesDir, "sources"), { recursive: true });
		symlinkSync(
			path.join(worktree, "docs", "spec.md"),
			path.join(notesDir, "sources", "spec.md"),
			"file",
		);
		writeFileSync(note, "See [spec](sources/spec.md#Second).\n");
		writeFileSync(
			path.join(configHome, "jact", "config.json"),
			JSON.stringify({ preset: "obsidian" }),
		);

		const before = jact(["validate", note]);
		const fixed = jact(["vault-link", note, "--all"]);
		const after = jact(["validate", note]);

		expect(before.status).toBe(1);
		expect(before.stdout).toContain("obsidian/no-unstable-symlink-link");
		expect(fixed.status, fixed.stderr).toBe(0);
		expect(readFileSync(note, "utf8")).toBe(
			`See [spec](sources/${REPO_NAME}/docs/spec.md#Second).\n`,
		);
		expect(after.status, after.stdout).toBe(0);
	});

	it("Given another note's sources folder symlinks the main checkout folder, When vault-link runs on a file in it, Then it refuses with exit 1 and names that folder symlink", () => {
		const folder = path.join(vault, "other", "sources", "docs");
		mkdirSync(path.dirname(folder), { recursive: true });
		symlinkSync(path.join(mainCheckout, "docs"), folder, "dir");
		const target = path.join(mainCheckout, "docs", "spec.md");
		writeFileSync(note, `See [spec](${target}).\n`);

		const result = jact(["vault-link", note, target]);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain(folder);
		expect(existsSync(path.join(notesDir, "sources"))).toBe(false);
	});

	it("Given GIT_DIR and GIT_WORK_TREE point at another repository, When vault-link runs on a worktree target, Then it still maps the target's own main checkout", () => {
		const otherRepo = path.join(root, "other-repo");
		mkdirSync(otherRepo);
		git(otherRepo, ["init"]);
		const target = path.join(worktree, "docs", "spec.md");
		writeFileSync(note, `See [spec](${target}).\n`);

		const result = jact(["vault-link", note, target], {
			GIT_DIR: path.join(otherRepo, ".git"),
			GIT_WORK_TREE: otherRepo,
		});

		expect(result.status, result.stderr).toBe(0);
		const symlinkPath = path.join(notesDir, "sources", REPO_NAME, "docs", "spec.md");
		expect(readlinkSync(symlinkPath)).toBe(path.join(mainCheckout, "docs", "spec.md"));
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
			/vault-link: 5 links rewritten, 2 symlinks created, \d+ reused, 0 already in vault, 0 refused/,
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

	it("Given an escaping link to a file whose name holds #, written as %23, When --all runs, Then the new link encodes # and resolves to the symlink for that file", () => {
		const hashFile = path.join(mainCheckout, "docs", "spec#1.md");
		writeFileSync(hashFile, "# One\n");
		writeFileSync(note, `- [h](../../${REPO_NAME}/docs/spec%231.md#One)\n`);

		const result = jact(["vault-link", note, "--all"]);

		expect(result.status, result.stderr).toBe(0);
		const link = `sources/${REPO_NAME}/docs/spec%231.md`;
		expect(readFileSync(note, "utf8")).toBe(`- [h](${link}#One)\n`);
		const symlinkPath = path.resolve(notesDir, decodeURIComponent(link));
		expect(symlinkPath).toBe(
			path.join(notesDir, "sources", REPO_NAME, "docs", "spec#1.md"),
		);
		expect(readlinkSync(symlinkPath)).toBe(hashFile);
	});

	it("Given an escaping link with a Markdown backslash escape in its path, When --all runs, Then it links the unescaped file and replaces the whole written destination", () => {
		writeFileSync(note, `- [s](../../${REPO_NAME}/docs/spec\\.md#Second)\n`);

		const result = jact(["vault-link", note, "--all"]);

		expect(result.status, result.stderr).toBe(0);
		expect(readFileSync(note, "utf8")).toBe(
			`- [s](sources/${REPO_NAME}/docs/spec.md#Second)\n`,
		);
		expect(
			readlinkSync(path.join(notesDir, "sources", REPO_NAME, "docs", "spec.md")),
		).toBe(path.join(mainCheckout, "docs", "spec.md"));
		expect(escapeFindings(note)).toEqual([]);
	});

	it("Given encoded-scheme file URLs whose filenames contain # and ?, When --all runs, Then the encoded characters stay in the filename rather than becoming URL suffixes", () => {
		const hashFile = path.join(mainCheckout, "docs", "hash#name.md");
		const queryFile = path.join(mainCheckout, "docs", "query?name.md");
		writeFileSync(hashFile, "# Hash name\n");
		writeFileSync(queryFile, "# Query name\n");
		writeFileSync(path.join(mainCheckout, "docs", "hash"), "# Wrong hash\n");
		writeFileSync(path.join(mainCheckout, "docs", "query"), "# Wrong query\n");
		writeFileSync(
			note,
			`- [h](${pathToFileURL(hashFile).href.replace(/^file:/, "file%3A")})\n- [q](${pathToFileURL(queryFile).href.replace(/^file:/, "file%3A")})\n`,
		);

		const result = jact(["vault-link", note, "--all"]);

		expect(result.status, result.stderr).toBe(0);
		expect(readFileSync(note, "utf8")).toBe(
			`- [h](sources/${REPO_NAME}/docs/hash%23name.md)\n- [q](sources/${REPO_NAME}/docs/query%3Fname.md)\n`,
		);
		expect(
			readlinkSync(
				path.join(notesDir, "sources", REPO_NAME, "docs", "hash#name.md"),
			),
		).toBe(hashFile);
		expect(
			readlinkSync(
				path.join(notesDir, "sources", REPO_NAME, "docs", "query?name.md"),
			),
		).toBe(queryFile);
	});

	it("Given the note is saved while --all runs, When --all reaches the write, Then it refuses with exit 1, keeps the saved edit, and creates no symlinks", () => {
		// A git shim first on PATH appends to the note on the first git call,
		// which --all makes after reading the note and before writing it.
		const shimDir = path.join(root, "shim");
		mkdirSync(shimDir);
		const realGit = spawnSync("sh", ["-c", "command -v git"], {
			encoding: "utf8",
			env: cleanEnv(),
		}).stdout.trim();
		const marker = path.join(root, "edited");
		writeFileSync(
			path.join(shimDir, "git"),
			`#!/bin/sh\nif [ ! -e ${shellArgument(marker)} ]; then : > ${shellArgument(marker)}; printf 'USER EDIT\\n' >> ${shellArgument(note)}; fi\nexec ${shellArgument(realGit)} "$@"\n`,
			{ mode: 0o755 },
		);
		const original = `- [spec](${path.join(mainCheckout, "docs", "spec.md")})\n`;
		writeFileSync(note, original);

		const result = jact(["vault-link", note, "--all"], {
			PATH: `${shimDir}${path.delimiter}${process.env["PATH"] ?? ""}`,
		});

		expect(existsSync(marker)).toBe(true);
		expect(result.status, result.stdout).toBe(1);
		expect(result.stderr).toContain("changed");
		expect(readFileSync(note, "utf8")).toBe(`${original}USER EDIT\n`);
		expect(existsSync(path.join(notesDir, "sources"))).toBe(false);
	});

	it("Given an escaping autolink whose destination cannot be located in the text, When --all runs, Then it refuses the link and creates no symlink", () => {
		const original = `- <${pathToFileURL(path.join(mainCheckout, "docs", "spec.md")).href}>\n`;
		writeFileSync(note, original);

		const result = jact(["vault-link", note, "--all"]);

		expect(result.status).toBe(1);
		expect(result.stdout).toContain("cannot locate the link destination");
		expect(result.stdout).toContain("0 symlinks created");
		expect(existsSync(path.join(notesDir, "sources"))).toBe(false);
		expect(readFileSync(note, "utf8")).toBe(original);
	});

	it("Given a read-only note with an escaping link, When --all runs, Then it fails without writing the note and creates no symlink", () => {
		const original = `- [spec](${path.join(mainCheckout, "docs", "spec.md")})\n`;
		writeFileSync(note, original, { mode: 0o444 });

		const result = jact(["vault-link", note, "--all"]);

		expect(result.status).toBe(2);
		expect(existsSync(path.join(notesDir, "sources"))).toBe(false);
		expect(readFileSync(note, "utf8")).toBe(original);
	});

	it("Given a note links folders outside the vault, inside and outside a repo, When --all runs, Then it refuses both as not files, creates nothing under sources, and leaves the note unchanged", () => {
		const outsideFolder = path.join(root, "outside-folder");
		mkdirSync(outsideFolder);
		const original = `- [outside](${outsideFolder})\n- [docs](${path.join(mainCheckout, "docs")})\n`;
		writeFileSync(note, original);

		const result = jact(["vault-link", note, "--all"]);

		expect(result.status).toBe(1);
		expect(result.stdout).toContain(`${outsideFolder} is not a file`);
		expect(result.stdout).toContain(`${path.join(mainCheckout, "docs")} is not a file`);
		expect(existsSync(path.join(notesDir, "sources"))).toBe(false);
		expect(readFileSync(note, "utf8")).toBe(original);
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
