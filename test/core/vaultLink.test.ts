import { execFileSync } from "node:child_process";
import type * as Fs from "node:fs";
import {
	closeSync,
	linkSync,
	mkdirSync,
	mkdtempSync,
	openSync,
	readdirSync,
	readFileSync,
	realpathSync,
	renameSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	applyVaultLinkPlan,
	VaultLinker,
	vaultNote,
} from "../../src/core/VaultLink/vaultLink.js";

vi.mock("node:fs", async (importOriginal) => {
	const actual = await importOriginal<typeof Fs>();
	return {
		...actual,
		renameSync: vi.fn(actual.renameSync),
		linkSync: vi.fn(actual.linkSync),
	};
});

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

afterEach(() => {
	vi.restoreAllMocks();
	rmSync(root, { recursive: true, force: true });
});
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

	it.each(["append", "replace"])(
		"preserves a completed external %s save after the final check and before replacement",
		(save) => {
			root = realpathSync(mkdtempSync(path.join(tmpdir(), "jact-vault-save-")));
			const note = path.join(root, "note.md");
			const original = "# Original\n";
			const saved = `${original}USER EDIT\n`;
			writeFileSync(note, original);
			const rename = vi.mocked(renameSync).getMockImplementation();
			if (rename === undefined) throw new Error("missing filesystem delegate");
			let scheduled = false;
			vi.mocked(renameSync).mockImplementationOnce((from, to) => {
				if (!scheduled && (String(to) === note || String(from) === note)) {
					scheduled = true;
					execFileSync(
						process.execPath,
						[
							"-e",
							`const fs = require("node:fs");
						if (process.argv[2] === "replace") {
							fs.writeFileSync(process.argv[1] + ".editor", ${JSON.stringify(saved)});
							fs.renameSync(process.argv[1] + ".editor", process.argv[1]);
						} else {
							fs.appendFileSync(process.argv[1], "USER EDIT\\n");
						}`,
							note,
							save,
						],
						{ env: { ...process.env, NODE_OPTIONS: "" } },
					);
				}
				rename(from, to);
			});

			applyVaultLinkPlan(note, original, {
				content: "# Rewritten\n",
				symlinks: [],
			});

			expect(scheduled).toBe(true);
			const retained = readdirSync(root, { recursive: true })
				.filter((entry) => String(entry).endsWith("note.md"))
				.map((entry) => readFileSync(path.join(root, String(entry)), "utf8"));
			expect(retained).toContain(saved);
		},
	);

	it("keeps an editor's recreated note instead of installing over it", () => {
		root = realpathSync(mkdtempSync(path.join(tmpdir(), "jact-vault-save-")));
		const note = path.join(root, "note.md");
		writeFileSync(note, "# Original\n");
		const link = vi.mocked(linkSync).getMockImplementation();
		if (link === undefined) throw new Error("missing filesystem delegate");
		vi.mocked(linkSync).mockImplementationOnce((from, to) => {
			execFileSync(
				process.execPath,
				[
					"-e",
					'require("node:fs").writeFileSync(process.argv[1], "EDITOR RECREATED\\n")',
					note,
				],
				{ env: { ...process.env, NODE_OPTIONS: "" } },
			);
			link(from, to);
		});

		const result = applyVaultLinkPlan(note, "# Original\n", {
			content: "# Rewritten\n",
			symlinks: [],
		});

		expect(result.kind).toBe("refused");
		expect(readFileSync(note, "utf8")).toBe("EDITOR RECREATED\n");
		const recovery = readdirSync(root).find((name) =>
			name.includes(".recovery-"),
		);
		if (recovery === undefined) throw new Error("missing recovery directory");
		expect(readFileSync(path.join(root, recovery, "note.md"), "utf8")).toBe(
			"# Original\n",
		);
		if (result.kind === "refused") expect(result.reason).toContain(recovery);
	});

	it("restores the note and reports retained recovery when installation fails", () => {
		root = realpathSync(mkdtempSync(path.join(tmpdir(), "jact-vault-save-")));
		const note = path.join(root, "note.md");
		writeFileSync(note, "# Original\n");
		vi.mocked(linkSync).mockImplementationOnce(() => {
			throw Object.assign(new Error("injected install failure"), {
				code: "EACCES",
			});
		});

		expect(() =>
			applyVaultLinkPlan(note, "# Original\n", {
				content: "# Rewritten\n",
				symlinks: [],
			}),
		).toThrow(/injected install failure; displaced note retained at/);
		expect(readFileSync(note, "utf8")).toBe("# Original\n");
	});

	it("retains late writes through an already-open descriptor after successful installation", () => {
		root = realpathSync(mkdtempSync(path.join(tmpdir(), "jact-vault-save-")));
		const note = path.join(root, "note.md");
		writeFileSync(note, "# Original\n", { mode: 0o640 });
		const descriptor = openSync(note, "a");
		try {
			const result = applyVaultLinkPlan(note, "# Original\n", {
				content: "# Rewritten\n",
				symlinks: [],
			});
			expect(result.kind).toBe("written");
			writeFileSync(descriptor, "LATE DESCRIPTOR SAVE\n");
			expect(readFileSync(note, "utf8")).toBe("# Rewritten\n");
			if (result.kind === "written") {
				expect(readFileSync(result.recoveryPath, "utf8")).toBe(
					"# Original\nLATE DESCRIPTOR SAVE\n",
				);
			}
		} finally {
			closeSync(descriptor);
		}
	});
});
