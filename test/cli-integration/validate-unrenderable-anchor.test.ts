/**
 * jact#125 — a markdown link whose anchor has a raw space, `(`, or `)` does
 * not render on GitHub or in Obsidian. `validate` reports it under every
 * preset, and `--fix` rewrites it to the %-encoded anchor.
 */
import { spawnSync } from "node:child_process";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const cliPath = path.resolve(testDir, "../../dist/cli.js");

const RAW_LINK = "[t](target.md#Header (parens) and spaces)";
const ENCODED_ANCHOR = "Header%20%28parens%29%20and%20spaces";
const ENCODED_LINK = `[t](target.md#${ENCODED_ANCHOR})`;

interface JsonLink {
	fullMatch: string;
	validation: {
		status: string;
		error?: string;
		suggestion?: string;
		anchorConversion?: { original: string; recommended: string };
	};
}

let workDir: string;
let configHome: string;
let sourcePath: string;

function run(...args: string[]) {
	return spawnSync(process.execPath, [cliPath, ...args], {
		cwd: workDir,
		encoding: "utf8",
		env: { ...process.env, XDG_CONFIG_HOME: configHome },
	});
}

function validateJson(source: string): { status: number | null; links: JsonLink[] } {
	writeFileSync(sourcePath, source);
	const result = run("validate", sourcePath, "--format", "json", "--scope", workDir);
	return {
		status: result.status,
		links: (JSON.parse(result.stdout) as { links: JsonLink[] }).links,
	};
}

function usePreset(preset: "commonmark" | "obsidian"): void {
	if (preset === "commonmark") return;
	mkdirSync(path.join(workDir, ".jact"), { recursive: true });
	writeFileSync(
		path.join(workDir, ".jact", "config.json"),
		JSON.stringify({ preset }),
	);
}

describe.each(["commonmark", "obsidian"] as const)(
	"jact validate — anchors a markdown link cannot contain (%s preset)",
	(preset) => {
		beforeEach(() => {
			workDir = mkdtempSync(path.join(tmpdir(), "jact-unrenderable-anchor-"));
			configHome = path.join(workDir, "xdg");
			mkdirSync(configHome);
			sourcePath = path.join(workDir, "source.md");
			writeFileSync(
				path.join(workDir, "target.md"),
				"# Header (parens) and spaces\n\nbody ^blk-1\n",
			);
			usePreset(preset);
		});

		afterEach(() => {
			rmSync(workDir, { recursive: true, force: true });
		});

		it("AC1/AC2: reports a raw space or paren anchor as an error naming the characters", () => {
			const { status, links } = validateJson(`# Src\n\n${RAW_LINK}\n`);

			expect(status).toBe(1);
			expect(links[0]?.validation.status).toBe("error");
			expect(links[0]?.validation.error).toBe(
				'Anchor has characters a markdown link cannot contain (space, "(", ")"): #Header (parens) and spaces',
			);
		});

		it("AC3: JSON carries the original and recommended anchors", () => {
			const { links } = validateJson(`${RAW_LINK}\n`);

			expect(links[0]?.validation.anchorConversion).toEqual({
				type: "anchor-conversion",
				original: "Header (parens) and spaces",
				recommended: ENCODED_ANCHOR,
			});
			expect(links[0]?.validation.suggestion).toBe(`#${ENCODED_ANCHOR}`);
		});

		it("names only the characters present", () => {
			writeFileSync(path.join(workDir, "target.md"), "# Two words\n");
			const { links } = validateJson("[t](target.md#Two words)\n");

			expect(links[0]?.validation.error).toMatch(/\(space\): #Two words$/);
		});

		it("AC3/AC4: --fix rewrites to the encoded anchor, and a second run changes nothing", () => {
			writeFileSync(sourcePath, `See ${RAW_LINK} here.\n`);

			const first = run("validate", sourcePath, "--fix", "--scope", workDir);
			expect(first.status).toBe(0);
			const fixed = readFileSync(sourcePath, "utf8");
			expect(fixed).toBe(`See ${ENCODED_LINK} here.\n`);

			const recheck = run("validate", sourcePath, "--scope", workDir);
			expect(recheck.status).toBe(0);

			run("validate", sourcePath, "--fix", "--scope", workDir);
			expect(readFileSync(sourcePath, "utf8")).toBe(fixed);
		});

		it("AC4: never double-encodes an anchor that is already encoded", () => {
			writeFileSync(path.join(workDir, "target.md"), "# 100% done (now)\n");
			writeFileSync(sourcePath, "[t](target.md#100%25 done (now))\n");

			run("validate", sourcePath, "--fix", "--scope", workDir);

			expect(readFileSync(sourcePath, "utf8")).toBe(
				"[t](target.md#100%25%20done%20%28now%29)\n",
			);
		});

		it("fixes a same-file anchor link", () => {
			writeFileSync(sourcePath, "# Local (x) heading\n\n[t](#Local (x) heading)\n");

			const result = run("validate", sourcePath, "--fix", "--scope", workDir);

			expect(result.status).toBe(0);
			expect(readFileSync(sourcePath, "utf8")).toBe(
				"# Local (x) heading\n\n[t](#Local%20%28x%29%20heading)\n",
			);
		});

		it("accepts the encoded anchor", () => {
			const { status, links } = validateJson(`${ENCODED_LINK}\n`);

			expect(status).toBe(0);
			expect(links[0]?.validation.status).toBe("valid");
		});

		it("AC5: wikilinks with raw spaces and parens stay valid", () => {
			const { status, links } = validateJson(
				"[[target#Header (parens) and spaces]]\n",
			);

			expect(status).toBe(0);
			expect(links[0]?.validation.status).toBe("valid");
		});

		it("AC7: block-reference links are not flagged", () => {
			const { status, links } = validateJson("[b](target.md#^blk-1)\n");

			expect(status).toBe(0);
			expect(links[0]?.validation.status).toBe("valid");
		});

		it("still reports a missing heading as Anchor not found", () => {
			const { links } = validateJson("[t](target.md#No such (heading))\n");

			expect(links[0]?.validation.error).toBe(
				"Anchor not found: #No such (heading)",
			);
		});
	},
);
