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
	NO_UNINDEXED_LINK_RULE,
	noUnindexedLink,
} from "../../../src/core/ValidationRules/rules/noUnindexedLink.js";
import { createMarkdownParser } from "../../../src/factories/componentFactory.js";
import type { RuleFinding } from "../../../src/types/validationRuleTypes.js";
import type { EnrichedLinkObject } from "../../../src/types/validationTypes.js";

let root: string;
let vault: string;
let note: string;

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
	return noUnindexedLink.check({ filePath: note, document, links });
}

beforeEach(() => {
	root = realpathSync(mkdtempSync(path.join(tmpdir(), "jact-unindexed-")));
	vault = path.join(root, "vault");
	mkdirSync(path.join(vault, ".obsidian"), { recursive: true });
	note = path.join(vault, "notes", "note.md");
	// The repo is outside the vault; the vault shows it through a folder symlink.
	writeFile(path.join(root, "repo", "docs", "spec.md"), "# Spec\n");
	writeFile(path.join(root, "loose", "other.md"), "# Other\n");
	symlinkSync(path.join(root, "repo"), path.join(vault, "repo-docs"));
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("obsidian/no-unindexed-link", () => {
	it("Given a hand-made file symlink to a file the vault already shows through a folder symlink, When validated, Then one finding names the shown path and vault-link", () => {
		mkdirSync(path.join(vault, "notes", "sources"), { recursive: true });
		symlinkSync(
			path.join(root, "repo", "docs", "spec.md"),
			path.join(vault, "notes", "sources", "spec.md"),
		);
		const findings = check("See [s](sources/spec.md#Spec).\n");
		expect(findings).toHaveLength(1);
		const [finding] = findings;
		expect(finding?.ruleId).toBe(NO_UNINDEXED_LINK_RULE);
		expect(finding?.source).toBe("[s](sources/spec.md#Spec)");
		expect(finding?.message).toContain("../repo-docs/docs/spec.md");
		expect(finding?.message).toContain("Fix: jact vault-link ");
		expect(finding?.message).toContain("sources/spec.md#Spec");
	});

	it("Given a file symlink to another file inside the vault, When validated, Then the finding names the real vault file", () => {
		writeFile(path.join(vault, "real.md"), "# Real\n");
		mkdirSync(path.join(vault, "notes"), { recursive: true });
		symlinkSync(
			path.join(vault, "real.md"),
			path.join(vault, "notes", "alias.md"),
		);
		const findings = check("[a](alias.md)\n");
		expect(findings).toHaveLength(1);
		expect(findings[0]?.message).toContain("../real.md");
	});

	it("Given a link under a dot-named folder in the vault, When validated, Then one finding says Obsidian skips dot names", () => {
		writeFile(path.join(vault, ".agents", "skill.md"), "# Skill\n");
		const findings = check("[k](../.agents/skill.md)\n");
		expect(findings).toHaveLength(1);
		expect(findings[0]?.message).toContain(".agents");
		expect(findings[0]?.message).toContain("dot");
	});

	it("Given links Obsidian opens (a vault file, a path under a folder symlink, a file symlink to an unshown file, a link leaving the vault), When validated, Then no finding is reported", () => {
		writeFile(path.join(vault, "real.md"), "# Real\n");
		mkdirSync(path.join(vault, "notes", "sources"), { recursive: true });
		symlinkSync(
			path.join(root, "loose", "other.md"),
			path.join(vault, "notes", "sources", "other.md"),
		);
		const findings = check(
			[
				"[r](../real.md)",
				"[d](../repo-docs/docs/spec.md)",
				"[o](sources/other.md)",
				"[e](../../loose/other.md)",
				"",
			].join("\n"),
		);
		expect(findings).toEqual([]);
	});

	it("Given a note outside any vault, When it links through a symlink, Then no finding is reported", () => {
		note = path.join(root, "plain", "note.md");
		mkdirSync(path.join(root, "plain"), { recursive: true });
		symlinkSync(
			path.join(root, "repo", "docs", "spec.md"),
			path.join(root, "plain", "spec.md"),
		);
		expect(check("[s](spec.md)\n")).toEqual([]);
	});
});
