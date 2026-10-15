import { execFileSync } from "node:child_process";
import {
	mkdirSync,
	mkdtempSync,
	realpathSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { VaultLinker, vaultNote } from "../../src/core/VaultLink/vaultLink.js";

let root: string;

function git(cwd: string, args: string[]): void {
	execFileSync("git", [
		"-C",
		cwd,
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
	]);
}

afterEach(() => rmSync(root, { recursive: true, force: true }));
describe("VaultLinker", () => {
	it("Given a repository path ending in a newline, When linking its file, Then its main checkout is found without truncating the path", () => {
		root = realpathSync(mkdtempSync(path.join(tmpdir(), "jact-vault-link-")));
		const vault = path.join(root, "vault");
		const noteDir = path.join(vault, "notes");
		const notePath = path.join(noteDir, "note.md");
		mkdirSync(path.join(vault, ".obsidian"), { recursive: true });
		mkdirSync(noteDir);
		writeFileSync(notePath, "# Note\n");

		const repo = path.join(root, "repo\n");
		const target = path.join(repo, "docs", "spec.md");
		mkdirSync(path.dirname(target), { recursive: true });
		writeFileSync(target, "# Spec\n");
		git(repo, ["init"]);
		git(repo, ["add", "."]);
		git(repo, ["commit", "-m", "init"]);

		const note = vaultNote(notePath);
		if (note === null) throw new Error("fixture note must be in the vault");
		const outcome = new VaultLinker(note).link(target);

		expect(outcome).toMatchObject({
			kind: "linked",
			mapped: target,
			symlinkPath: path.join(noteDir, "sources", "repo\n", "docs", "spec.md"),
		});
	});
});
