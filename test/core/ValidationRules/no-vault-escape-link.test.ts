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
	NO_VAULT_ESCAPE_LINK_RULE,
	noVaultEscapeLink,
} from "../../../src/core/ValidationRules/rules/noVaultEscapeLink.js";
import { createMarkdownParser } from "../../../src/factories/componentFactory.js";
import type { RuleFinding } from "../../../src/types/validationRuleTypes.js";
import type { EnrichedLinkObject } from "../../../src/types/validationTypes.js";

let root: string;
let vault: string;

function writeNote(filePath: string, content: string) {
	mkdirSync(path.dirname(filePath), { recursive: true });
	writeFileSync(filePath, content);
}

function check(filePath: string, content: string): RuleFinding[] {
	writeNote(filePath, content);
	const document = createMarkdownParser().parseContent(content, filePath);
	const links = document.links.map(
		(link) =>
			({
				...link,
				validation: { status: "valid" },
			}) as EnrichedLinkObject,
	);
	return noVaultEscapeLink.check({ filePath, document, links });
}

function expectOneEscape(
	findings: RuleFinding[],
	line: number,
	source: string,
) {
	expect(findings).toHaveLength(1);
	const [finding] = findings;
	expect(finding?.ruleId).toBe(NO_VAULT_ESCAPE_LINK_RULE);
	expect(finding?.line).toBe(line);
	expect(finding?.source).toBe(source);
	expect(finding?.message).toContain("symlink");
	expect(finding?.edits).toBeUndefined();
}

beforeEach(() => {
	root = realpathSync(mkdtempSync(path.join(tmpdir(), "jact-vault-escape-")));
	vault = path.join(root, "vault");
	mkdirSync(path.join(vault, ".obsidian"), { recursive: true });
	writeNote(path.join(root, "outside.md"), "# Outside\n");
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("obsidian/no-vault-escape-link", () => {
	it("Given a vault note, When it links ../../outside.md escaping the vault, Then one finding is reported", () => {
		const findings = check(
			path.join(vault, "notes", "note.md"),
			"Intro.\n\nSee [x](../../outside.md).\n",
		);
		expectOneEscape(findings, 3, "[x](../../outside.md)");
	});

	it("Given a vault note, When it links an absolute filesystem path, Then one finding is reported", () => {
		const findings = check(
			path.join(vault, "note.md"),
			"[x](/Users/someone/repo/file.md)\n",
		);
		expectOneEscape(findings, 1, "[x](/Users/someone/repo/file.md)");
	});

	it("Given a vault note, When it links a relative path through .paseo/worktrees inside the vault, Then one finding is reported", () => {
		const findings = check(
			path.join(vault, "note.md"),
			"[x](sub/.paseo/worktrees/abc/file.md)\n",
		);
		expectOneEscape(findings, 1, "[x](sub/.paseo/worktrees/abc/file.md)");
	});

	it("Given a symlink beside a vault note pointing outside the vault, When the note links through the symlink, Then no finding is reported", () => {
		const outsideDir = path.join(root, "repo", "src");
		writeNote(path.join(outsideDir, "file.md"), "# File\n");
		mkdirSync(path.join(vault, "notes"), { recursive: true });
		symlinkSync(outsideDir, path.join(vault, "notes", "src-link"), "dir");
		const findings = check(
			path.join(vault, "notes", "note.md"),
			"[x](src-link/file.md)\n",
		);
		expect(findings).toEqual([]);
	});

	it("Given a markdown file with no .obsidian above it, When it has escaping links, Then no finding is reported", () => {
		const findings = check(
			path.join(root, "plain", "deep", "note.md"),
			"[a](../../outside.md) [b](/Users/someone/repo/file.md) [c](sub/.paseo/worktrees/abc/file.md)\n",
		);
		expect(findings).toEqual([]);
	});

	it("Given a vault reached through a symlinked folder, When a note's ../ link escapes relative to its real location, Then one finding is reported", () => {
		mkdirSync(path.join(vault, "notes"), { recursive: true });
		const alias = path.join(root, "alias");
		symlinkSync(path.join(vault, "notes"), alias, "dir");
		const findings = check(
			path.join(alias, "note.md"),
			"[x](../../outside.md)\n",
		);
		expectOneEscape(findings, 1, "[x](../../outside.md)");
	});

	it("Given a vault reached through a symlinked folder, When a note's relative link stays inside the vault, Then no finding is reported", () => {
		mkdirSync(path.join(vault, "notes"), { recursive: true });
		writeNote(path.join(vault, "other.md"), "# Other\n");
		const alias = path.join(root, "alias");
		symlinkSync(path.join(vault, "notes"), alias, "dir");
		const findings = check(path.join(alias, "note.md"), "[x](../other.md)\n");
		expect(findings).toEqual([]);
	});

	it("Given a vault note, When it has web URL and anchor-only links, Then no finding is reported", () => {
		const findings = check(
			path.join(vault, "note.md"),
			"[web](https://example.com/x.md) [self](#heading) [mail](mailto:a@b.c)\n\n# heading\n",
		);
		expect(findings).toEqual([]);
	});

	it("Given a vault note with footnote definitions naming outside paths, When checked, Then no finding is reported", () => {
		const findings = check(
			path.join(vault, "notes", "note.md"),
			"Claim[^S-1] and more[^S-2].\n\n[^S-1]: `/Users/someone/x.jsonl:L4` note\n[^S-2]: ../../outside.md\n",
		);
		expect(findings).toEqual([]);
	});

	it("Given a folder named ..hidden inside the vault, When a note links into it, Then no finding is reported", () => {
		writeNote(path.join(vault, "..hidden", "file.md"), "# File\n");
		const findings = check(
			path.join(vault, "note.md"),
			"[x](..hidden/file.md)\n",
		);
		expect(findings).toEqual([]);
	});

	it.each([
		["a file: URL", "[x](file:///outside.md)"],
		["a percent-encoded ../ escape", "[x](%2e%2e/%2e%2e/outside.md)"],
		["an angle-bracketed escape with an anchor", "[x](<../../outside.md#heading>)"],
		["an escape with a malformed percent escape", "[x](../../bad%ZZ.md)"],
	])("Given a vault note, When it links %s, Then one finding is reported", (_name, source) => {
		const findings = check(
			path.join(vault, "notes", "note.md"),
			`${source}\n`,
		);
		expectOneEscape(findings, 1, source);
	});
});
