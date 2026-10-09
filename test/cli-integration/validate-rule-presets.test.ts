import { spawnSync } from "node:child_process";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	realpathSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const cliPath = path.resolve(testDir, "../../dist/cli.js");

const SPLIT_SOURCE = "See [the target][t] here.\n\n[t]: target.md#Intro\n";
const INLINED = "See [the target](target.md#Intro) here.\n\n";

let root: string;
let configHome: string;

function run(args: string[], input?: string) {
	return spawnSync(process.execPath, [cliPath, "validate", ...args], {
		cwd: root,
		encoding: "utf8",
		env: { ...process.env, XDG_CONFIG_HOME: configHome },
		...(input !== undefined && { input }),
	});
}

function userConfig(config: unknown) {
	mkdirSync(path.join(configHome, "jact"), { recursive: true });
	writeFileSync(
		path.join(configHome, "jact", "config.json"),
		JSON.stringify(config),
	);
}

beforeEach(() => {
	root = realpathSync(mkdtempSync(path.join(tmpdir(), "jact-rule-presets-")));
	configHome = path.join(root, "config-home");
	writeFileSync(path.join(root, "package.json"), "{}");
	writeFileSync(path.join(root, "target.md"), "# Intro\n\nText.\n");
	writeFileSync(path.join(root, "source.md"), SPLIT_SOURCE);
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("jact validate — rule presets", () => {
	it("passes a split-style note link with no config (commonmark)", () => {
		const result = run(["source.md"]);
		expect(result.status).toBe(0);
	});

	it("fails a split-style note link under the obsidian preset and names the rule (AE1)", () => {
		userConfig({ preset: "obsidian" });
		const result = run(["source.md"]);
		expect(result.status).toBe(1);
		expect(result.stdout).toContain("[the target][t]");
		expect(result.stdout).toContain("[obsidian/no-reference-note-link]");
	});

	it("reports the rule ID in JSON findings", () => {
		userConfig({ preset: "obsidian" });
		const result = run(["source.md", "--format", "json"]);
		expect(result.status).toBe(1);
		const parsed = JSON.parse(result.stdout) as {
			summary: { errors: number };
			findings: { ruleId: string; line: number }[];
		};
		expect(parsed.summary.errors).toBe(1);
		expect(parsed.findings.map((f) => [f.ruleId, f.line])).toEqual([
			["obsidian/no-reference-note-link", 1],
		]);
	});

	it("--fix inlines the link, deletes the definition, and exits 0 (AE3)", () => {
		userConfig({ preset: "obsidian" });
		const result = run(["source.md", "--fix", "--no-backup"]);
		expect(result.status).toBe(0);
		expect(readFileSync(path.join(root, "source.md"), "utf8")).toBe(INLINED);
	});

	it("--fix folds the definition's own anchor correction into the inlined link", () => {
		userConfig({ preset: "obsidian" });
		writeFileSync(path.join(root, "target.md"), "# Q1: Does it fit\n");
		writeFileSync(
			path.join(root, "source.md"),
			"See [a][x] and [b][x].\n\n[x]: target.md#Q1:%20Does%20it%20fit\n",
		);
		const result = run(["source.md", "--fix", "--no-backup"]);
		expect(result.stderr).toBe("");
		expect(result.status).toBe(0);
		expect(readFileSync(path.join(root, "source.md"), "utf8")).toBe(
			"See [a](target.md#Q1%20Does%20it%20fit) and [b](target.md#Q1%20Does%20it%20fit).\n\n",
		);
	});

	it("--fix exits 1 when an error it cannot fix remains", () => {
		userConfig({ preset: "obsidian" });
		writeFileSync(
			path.join(root, "source.md"),
			`${SPLIT_SOURCE}[Gone](missing.md)\n`,
		);
		const result = run(["source.md", "--fix", "--no-backup"]);
		expect(result.status).toBe(1);
		expect(readFileSync(path.join(root, "source.md"), "utf8")).toContain(
			"[the target](target.md#Intro)",
		);
	});

	it("a rule set to off in .jact.json overrides the user preset (AE4)", () => {
		userConfig({ preset: "obsidian" });
		writeFileSync(
			path.join(root, ".jact.json"),
			JSON.stringify({ rules: { "obsidian/no-reference-note-link": "off" } }),
		);
		expect(run(["source.md"]).status).toBe(0);
	});

	it("applies each file's nearest .jact.json in a batch", () => {
		mkdirSync(path.join(root, "vault"));
		writeFileSync(
			path.join(root, "vault", ".jact.json"),
			JSON.stringify({ preset: "obsidian" }),
		);
		writeFileSync(path.join(root, "vault", "target.md"), "# Intro\n");
		writeFileSync(path.join(root, "vault", "note.md"), SPLIT_SOURCE);
		const result = run(["source.md", "vault/note.md", "--json"]);
		expect(result.status).toBe(1);
		const lines = result.stdout
			.trim()
			.split("\n")
			.map((line) => JSON.parse(line) as { path: string; ok: boolean });
		expect(lines.map((line) => [path.basename(line.path), line.ok])).toEqual([
			["source.md", true],
			["note.md", false],
		]);
	});

	it("checks stdin content under the config for its intended path", () => {
		userConfig({ preset: "obsidian" });
		const result = run(["source.md", "--stdin"], SPLIT_SOURCE);
		expect(result.status).toBe(1);
		expect(result.stdout).toContain("[obsidian/no-reference-note-link]");
	});

	it("exits 2 and names the file and key for an unknown preset", () => {
		userConfig({ preset: "obsidain" });
		const result = run(["source.md"]);
		expect(result.status).toBe(2);
		expect(result.stderr).toContain(
			path.join(configHome, "jact", "config.json"),
		);
		expect(result.stderr).toContain('unknown preset "obsidain"');
	});
});
