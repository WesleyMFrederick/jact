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

let root: string;
let configHome: string;

function run(args: string[]) {
	return spawnSync(process.execPath, [cliPath, "validate", ...args], {
		cwd: root,
		encoding: "utf8",
		env: { ...process.env, XDG_CONFIG_HOME: configHome },
	});
}

function setPreset(preset: "commonmark" | "obsidian") {
	mkdirSync(path.join(configHome, "jact"), { recursive: true });
	writeFileSync(
		path.join(configHome, "jact", "config.json"),
		JSON.stringify({ preset }),
	);
}

function validation(source: string) {
	writeFileSync(path.join(root, "source.md"), source);
	const result = run(["source.md", "--format", "json"]);
	const links = (
		JSON.parse(result.stdout) as {
			links: {
				validation: {
					suggestion?: string;
					anchorConversion?: { recommended: string };
				};
			}[];
		}
	).links;
	return links[0]?.validation;
}

beforeEach(() => {
	root = realpathSync(mkdtempSync(path.join(tmpdir(), "jact-cm-anchor-")));
	configHome = path.join(root, "config-home");
	writeFileSync(path.join(root, "package.json"), "{}");
	writeFileSync(path.join(root, "target.md"), "# Doc\n\n## Q1: Does it fit.\n");
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("jact validate — heading punctuation in anchor suggestions", () => {
	it("keeps the colon in listed headers and the fuzzy fix when the dropped-character rule is off", () => {
		setPreset("commonmark");
		const result = validation("[a](target.md#q1:-does-it-fit)\n");

		expect(result?.suggestion).toContain(
			'"Q1: Does it fit." → #Q1: Does it fit.',
		);
		expect(result?.anchorConversion?.recommended).toBe(
			"Q1:%20Does%20it%20fit%2E",
		);
	});

	it("--fix writes the colon-preserving anchor when the rule is off", () => {
		setPreset("commonmark");
		writeFileSync(
			path.join(root, "source.md"),
			"[a](target.md#q1:-does-it-fit)\n",
		);

		run(["source.md", "--fix", "--no-backup"]);

		expect(readFileSync(path.join(root, "source.md"), "utf8")).toBe(
			"[a](target.md#Q1:%20Does%20it%20fit%2E)\n",
		);
	});

	it("strips the colon in listed headers and the fuzzy fix when the rule is on", () => {
		setPreset("obsidian");
		const result = validation("[a](target.md#q1:-does-it-fit)\n");

		expect(result?.suggestion).toContain(
			'"Q1: Does it fit." → #Q1 Does it fit.',
		);
		expect(result?.anchorConversion?.recommended).toBe(
			"Q1%20Does%20it%20fit%2E",
		);
	});
});
