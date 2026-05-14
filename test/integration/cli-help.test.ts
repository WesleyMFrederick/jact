/**
 * D5 CLI help text tests: --scope option documents inference algorithm.
 * Phase 3 — §8f assertions (5 total).
 *
 * Spawns `jact extract <sub> --help` and checks stdout text.
 */

import { exec } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CLI_PATH = join(__dirname, "../../dist/cli.js");
const JACT_ROOT = join(__dirname, "../..");

async function helpText(subcommand: string): Promise<string> {
	const { stdout } = await execAsync(
		`node "${CLI_PATH}" extract ${subcommand} --help`,
		{ cwd: JACT_ROOT },
	);
	// Normalize line-wrapped option descriptions: collapse continuation whitespace
	return stdout.replace(/\n\s{10,}/g, " ");
}

describe("CLI help — extract file --help", () => {
	it("--scope help contains 'Defaults to nearest ancestor'", async () => {
		const help = await helpText("file");
		expect(help).toContain("Defaults to nearest ancestor");
	});

	it("--scope help mentions both .git and package.json", async () => {
		const help = await helpText("file");
		expect(help).toContain(".git");
		expect(help).toContain("package.json");
	});

	it("--scope help mentions target file walk-up fallback", async () => {
		const help = await helpText("file");
		expect(help).toContain("target file");
	});

	it("--scope help states 'Required only when neither cwd nor target reveal a project root'", async () => {
		const help = await helpText("file");
		expect(help).toContain(
			"Required only when neither cwd nor target reveal a project root",
		);
	});
});

describe("CLI help — extract header / extract links", () => {
	it("--scope help text matches extract file across all 3 subcommands", async () => {
		const [fileHelp, headerHelp, linksHelp] = await Promise.all([
			helpText("file"),
			helpText("header"),
			helpText("links"),
		]);
		const expectedPhrase = "Defaults to nearest ancestor";
		expect(fileHelp).toContain(expectedPhrase);
		expect(headerHelp).toContain(expectedPhrase);
		expect(linksHelp).toContain(expectedPhrase);
	});
});
