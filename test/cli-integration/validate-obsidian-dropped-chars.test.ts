import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const cliPath = path.resolve(testDir, "../../dist/cli.js");
const workDir = path.join(tmpdir(), "jact-obsidian-dropped-chars-test");
const sourcePath = path.join(workDir, "source.md");

const TARGET_MD = [
	"# Interview",
	"",
	"## Q1: Does the problem statement describe the right gap?",
	"",
	"Answer.",
	"",
	"## 4.2 V8 Key Rules (Locked from V6)",
	"",
	"Rules.",
	"",
	"## Trace: run (opsx:continue)",
	"",
	"Trace.",
	"",
].join("\n");

const COLON_LINK =
	"[Q1: Does the problem statement describe the right gap?](target.md#Q1:%20Does%20the%20problem%20statement%20describe%20the%20right%20gap?)";
const CANONICAL_ANCHOR =
	"#Q1%20Does%20the%20problem%20statement%20describe%20the%20right%20gap?";

interface JsonLink {
	fullMatch: string;
	validation: { status: string; error?: string; suggestion?: string };
}

function run(...args: string[]) {
	return spawnSync(process.execPath, [cliPath, ...args], {
		cwd: workDir,
		encoding: "utf8",
	});
}

function validateJson(source: string): {
	status: number | null;
	links: JsonLink[];
} {
	writeFileSync(sourcePath, source);
	const result = run("validate", sourcePath, "--format", "json", "--scope", workDir);
	return {
		status: result.status,
		links: (JSON.parse(result.stdout) as { links: JsonLink[] }).links,
	};
}

describe("jact validate — anchors with characters Obsidian drops", () => {
	beforeEach(() => {
		rmSync(workDir, { recursive: true, force: true });
		mkdirSync(workDir, { recursive: true });
		writeFileSync(path.join(workDir, "target.md"), TARGET_MD);
	});

	afterEach(() => {
		rmSync(workDir, { recursive: true, force: true });
	});

	it("reports a colon anchor as an error and suggests the corrected anchor", () => {
		const { status, links } = validateJson(`${COLON_LINK}\n`);

		expect(status).toBe(1);
		expect(links[0]?.validation.status).toBe("error");
		expect(links[0]?.validation.error).toMatch(
			/^Anchor uses characters Obsidian drops/,
		);
		expect(links[0]?.validation.suggestion).toBe(CANONICAL_ANCHOR);
	});

	it("accepts the canonical anchor and headings with parentheses", () => {
		const { status, links } = validateJson(
			[
				`[Q1](target.md${CANONICAL_ANCHOR})`,
				"[Rules](target.md#4.2%20V8%20Key%20Rules%20(Locked%20from%20V6))",
				"",
			].join("\n"),
		);

		expect(status).toBe(0);
		expect(links.map((link) => link.validation.status)).toEqual([
			"valid",
			"valid",
		]);
	});

	it("still reports a missing heading as Anchor not found", () => {
		const { status, links } = validateJson("[Nope](target.md#Q1%20Nope)\n");

		expect(status).toBe(1);
		expect(links[0]?.validation.error).toBe("Anchor not found: #Q1%20Nope");
		expect(links[0]?.validation.suggestion).toContain(
			'"Q1: Does the problem statement describe the right gap?" → #Q1 Does the problem statement describe the right gap?',
		);
	});

	it("replaces a dropped character between words with a space", () => {
		const { links } = validateJson(
			"[Trace](target.md#Trace:%20run%20(opsx:continue))\n",
		);

		expect(links[0]?.validation.suggestion).toBe(
			"#Trace%20run%20(opsx%20continue)",
		);
	});

	it("--fix rewrites the anchor and keeps the link text", () => {
		writeFileSync(sourcePath, `See ${COLON_LINK} here.\n`);

		const result = run("validate", sourcePath, "--fix", "--scope", workDir);

		expect(result.status).toBe(0);
		expect(readFileSync(sourcePath, "utf8")).toBe(
			`See [Q1: Does the problem statement describe the right gap?](target.md${CANONICAL_ANCHOR}) here.\n`,
		);
	});
});
