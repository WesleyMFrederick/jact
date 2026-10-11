import {
	mkdirSync,
	mkdtempSync,
	realpathSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	NO_UNSTABLE_SYMLINK_LINK_RULE,
	noUnstableSymlinkLink,
} from "../../../src/core/ValidationRules/rules/noUnstableSymlinkLink.js";
import { createMarkdownParser } from "../../../src/factories/componentFactory.js";
import type { RuleFinding } from "../../../src/types/validationRuleTypes.js";
import type { EnrichedLinkObject } from "../../../src/types/validationTypes.js";

let root: string;
let vault: string;
let note: string;
let worktree: string;

function writeFile(filePath: string, content: string) {
	mkdirSync(path.dirname(filePath), { recursive: true });
	writeFileSync(filePath, content);
}

function check(content: string): RuleFinding[] {
	writeFile(note, content);
	const document = createMarkdownParser().parseContent(content, note);
	const links = document.links.map(
		(link) =>
			({
				...link,
				validation: { status: "valid" },
			}) as EnrichedLinkObject,
	);
	return noUnstableSymlinkLink.check({ filePath: note, document, links });
}

beforeEach(() => {
	root = realpathSync(mkdtempSync(path.join(tmpdir(), "jact-unstable-")));
	vault = path.join(root, "vault");
	mkdirSync(path.join(vault, ".obsidian"), { recursive: true });
	note = path.join(vault, "notes", "note.md");
	worktree = path.join(root, "home", ".paseo", "worktrees", "abc", "feat");
	writeFile(path.join(worktree, "docs", "spec.md"), "# Spec\n");
	writeFile(path.join(root, "skills", "lfg", "SKILL.md"), "# LFG\n");
	writeFile(path.join(root, "repo", "docs", "spec.md"), "# Spec\n");
	mkdirSync(path.join(vault, "notes"), { recursive: true });
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("obsidian/no-unstable-symlink-link", () => {
	it("Given a vault folder symlink into a .paseo worktree, When a note links through it, Then one finding names the folder symlink, the worktree, and vault-link", () => {
		symlinkSync(worktree, path.join(vault, "wt-docs"), "dir");
		const findings = check("See [s](../wt-docs/docs/spec.md#Spec).\n");
		expect(findings).toHaveLength(1);
		const [finding] = findings;
		expect(finding?.ruleId).toBe(NO_UNSTABLE_SYMLINK_LINK_RULE);
		expect(finding?.message).toContain("../wt-docs");
		expect(finding?.message).toContain(".paseo worktree");
		expect(finding?.message).toContain("Fix: jact vault-link ");
	});

	it("Given another note's sources folder holds a folder symlink, When this note links through it, Then one finding names the sources folder symlink", () => {
		mkdirSync(path.join(vault, "other", "sources"), { recursive: true });
		symlinkSync(
			path.join(root, "skills", "lfg"),
			path.join(vault, "other", "sources", "lfg"),
			"dir",
		);
		const findings = check("[l](../other/sources/lfg/SKILL.md)\n");
		expect(findings).toHaveLength(1);
		expect(findings[0]?.message).toContain("../other/sources/lfg");
		expect(findings[0]?.message).toContain("sources folder");
	});

	it("Given a stable folder symlink outside any sources folder and a per-file symlink under sources, When a note links through them, Then no finding is reported", () => {
		symlinkSync(path.join(root, "repo"), path.join(vault, "repo-docs"), "dir");
		mkdirSync(path.join(vault, "notes", "sources"), { recursive: true });
		symlinkSync(
			path.join(root, "skills", "lfg", "SKILL.md"),
			path.join(vault, "notes", "sources", "SKILL.md"),
			"file",
		);
		expect(
			check("[d](../repo-docs/docs/spec.md)\n[k](sources/SKILL.md)\n"),
		).toEqual([]);
	});
});
