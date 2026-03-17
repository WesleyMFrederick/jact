import { execSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const CLI_PATH = join(__dirname, "../../dist/jact.js");

/**
 * H-002 Falsification: Does extract header ever return multiple content blocks?
 *
 * Hypothesis: extractHeader always returns exactly 1 content block.
 * Negate-first: Use a header containing nested citations to another file.
 * If extractContent followed nested links, it would produce multiple blocks.
 */
describe("H-002: extract header content block count", () => {
	let testDir: string;

	beforeEach(() => {
		testDir = join(
			tmpdir(),
			`h002-block-count-${Date.now()}-${Math.random().toString(36).slice(2)}`,
		);
		mkdirSync(testDir, { recursive: true });
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	it("returns exactly 1 content block for header with no nested citations", () => {
		writeFileSync(
			join(testDir, "source.md"),
			"# Doc\n\n## Rules\n\nRule 1: Do the thing.\n\nRule 2: Do the other thing.\n\n## Other\n\nUnrelated.\n",
		);

		const output = execSync(
			`node "${CLI_PATH}" extract header "${join(testDir, "source.md")}" "Rules" --scope "${testDir}" --format json`,
			{ encoding: "utf8" },
		);

		const result = JSON.parse(output);
		const blockKeys = Object.keys(result.extractedContentBlocks).filter(
			(k) => k !== "_totalContentCharacterLength",
		);

		expect(blockKeys).toHaveLength(1);
	});

	it("returns exactly 1 content block even when header contains nested citations", () => {
		// Target file that the nested citation points to
		writeFileSync(
			join(testDir, "referenced.md"),
			"# Referenced\n\n## Details\n\nThis is referenced content.\n",
		);

		// Source file with a header containing a citation to referenced.md
		writeFileSync(
			join(testDir, "source.md"),
			"# Doc\n\n## Rules\n\nRule 1: See [Details](referenced.md#Details) for more.\n\nRule 2: Do the other thing.\n\n## Other\n\nUnrelated.\n",
		);

		const output = execSync(
			`node "${CLI_PATH}" extract header "${join(testDir, "source.md")}" "Rules" --scope "${testDir}" --format json`,
			{ encoding: "utf8" },
		);

		const result = JSON.parse(output);
		const blockKeys = Object.keys(result.extractedContentBlocks).filter(
			(k) => k !== "_totalContentCharacterLength",
		);

		// H-002: Even with nested citations, extract header produces exactly 1 block
		expect(blockKeys).toHaveLength(1);
	});

	it("nested citation text appears verbatim in content (not expanded)", () => {
		writeFileSync(
			join(testDir, "referenced.md"),
			"# Referenced\n\n## Details\n\nThis is referenced content.\n",
		);

		writeFileSync(
			join(testDir, "source.md"),
			"# Doc\n\n## Rules\n\nRule 1: See [Details](referenced.md#Details) for more.\n\n## Other\n\nUnrelated.\n",
		);

		const output = execSync(
			`node "${CLI_PATH}" extract header "${join(testDir, "source.md")}" "Rules" --scope "${testDir}" --format json`,
			{ encoding: "utf8" },
		);

		const result = JSON.parse(output);
		const blockKeys = Object.keys(result.extractedContentBlocks).filter(
			(k) => k !== "_totalContentCharacterLength",
		);
		const block = result.extractedContentBlocks[blockKeys[0]];

		// Citation link text preserved verbatim — not followed/expanded
		expect(block.content).toContain("[Details](referenced.md#Details)");
		// Referenced file content NOT present in the block
		expect(block.content).not.toContain("This is referenced content.");
	});
});
