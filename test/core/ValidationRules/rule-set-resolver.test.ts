import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { createRuleSetResolver } from "../../../src/core/ValidationRules/loadConfig.js";

let root: string;
let userConfig: string;
let note: string;

const write = (path: string, content: unknown) =>
	writeFileSync(
		path,
		typeof content === "string" ? content : JSON.stringify(content),
	);

const writeProject = (content: unknown) => {
	mkdirSync(join(root, "project", ".jact"), { recursive: true });
	write(join(root, "project", ".jact", "config.json"), content);
};

const enabledFor = async (filePath = note) =>
	[
		...(await createRuleSetResolver({ userConfigPath: userConfig })(filePath))
			.enabled,
	].sort();

beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), "jact-rules-"));
	userConfig = join(root, "home", "config.json");
	mkdirSync(join(root, "home"));
	mkdirSync(join(root, "project", "notes"), { recursive: true });
	note = join(root, "project", "notes", "a.md");
	write(note, "# A\n");
});

describe("rule set resolution from config", () => {
	it("runs the commonmark preset with no config", async () => {
		expect(await enabledFor()).toEqual([]);
	});

	it("selects the user config preset", async () => {
		write(userConfig, { preset: "obsidian" });
		expect(await enabledFor()).toEqual([
			"obsidian/anchor-dropped-chars",
			"obsidian/no-reference-note-link",
			"obsidian/no-vault-escape-link",
		]);
	});

	it("reads the nearest .jact/config.json walking up from the file", async () => {
		writeProject({ rules: { "obsidian/no-reference-note-link": "error" } });
		expect(await enabledFor()).toEqual(["obsidian/no-reference-note-link"]);
	});

	it("lets project keys override user keys", async () => {
		write(userConfig, { preset: "obsidian" });
		writeProject({ rules: { "obsidian/no-reference-note-link": "off" } });
		expect(await enabledFor()).toEqual([
			"obsidian/anchor-dropped-chars",
			"obsidian/no-vault-escape-link",
		]);
	});

	it("rejects malformed JSON and bad keys, naming the file", async () => {
		write(userConfig, "{ preset: ");
		await expect(enabledFor()).rejects.toThrow(userConfig);
		write(userConfig, { preset: 3 });
		await expect(enabledFor()).rejects.toThrow(/preset/);
	});

	it("rejects an unknown rule ID", async () => {
		write(userConfig, { rules: { "obsidian/nope": "off" } });
		await expect(enabledFor()).rejects.toThrow(/obsidian\/nope/);
	});
});

describe("plugins", () => {
	const pluginSource = (id: string) =>
		`export default { rules: [{ id: "${id}", preset: "todo", check: ({ document }) =>
			document.content.includes("TODO-LINK")
				? [{ ruleId: "${id}", line: 1, column: 0, message: "TODO-LINK found" }]
				: [] }] };`;

	it("loads a plugin rule that config enables (AE6)", async () => {
		write(join(root, "home", "todo.mjs"), pluginSource("todo/flag"));
		write(userConfig, {
			plugins: ["./todo.mjs"],
			rules: { "todo/flag": "error" },
		});
		const ruleSet = await createRuleSetResolver({ userConfigPath: userConfig })(
			note,
		);
		expect([...ruleSet.enabled]).toEqual(["todo/flag"]);
	});

	it("loads an installed package whose exports are import-only", async () => {
		const packageDir = join(root, "home", "node_modules", "esm-only-plugin");
		mkdirSync(packageDir, { recursive: true });
		write(join(packageDir, "package.json"), {
			name: "esm-only-plugin",
			type: "module",
			exports: { ".": { import: "./plugin.js" } },
		});
		write(join(packageDir, "plugin.js"), pluginSource("pkg/flag"));
		write(userConfig, {
			plugins: ["esm-only-plugin"],
			rules: { "pkg/flag": "error" },
		});
		const ruleSet = await createRuleSetResolver({ userConfigPath: userConfig })(
			note,
		);
		expect([...ruleSet.enabled]).toEqual(["pkg/flag"]);
	});

	it("names a package that is not installed", async () => {
		write(userConfig, { plugins: ["not-installed-plugin"] });
		await expect(enabledFor()).rejects.toThrow(
			/"not-installed-plugin" not found from/,
		);
	});

	it("names a plugin path that does not exist", async () => {
		write(userConfig, { plugins: ["./missing.mjs"] });
		await expect(enabledFor()).rejects.toThrow(
			join(root, "home", "missing.mjs"),
		);
	});

	it("rejects a rule ID that is already registered", async () => {
		write(
			join(root, "home", "dupe.mjs"),
			pluginSource("obsidian/no-reference-note-link"),
		);
		write(userConfig, { plugins: ["./dupe.mjs"] });
		await expect(enabledFor()).rejects.toThrow(/already registered/);
	});

	it("rejects a module without a default export", async () => {
		write(join(root, "home", "bare.mjs"), "export const rules = [];");
		write(userConfig, { plugins: ["./bare.mjs"] });
		await expect(enabledFor()).rejects.toThrow(/bare\.mjs.*default-export/);
	});

	it("refuses plugins in a project config without running them", async () => {
		const marker = join(root, "ran");
		writeProject({ plugins: ["./evil.mjs"] });
		write(
			join(root, "project", ".jact", "evil.mjs"),
			`import { writeFileSync } from "node:fs"; writeFileSync(${JSON.stringify(marker)}, "x"); export default { rules: [] };`,
		);
		await expect(enabledFor()).rejects.toThrow(
			/project config.*"plugins".*personal config/,
		);
		expect(existsSync(marker)).toBe(false);
	});
});
