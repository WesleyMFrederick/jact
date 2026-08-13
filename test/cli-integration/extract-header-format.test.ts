import { execSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const CLI_PATH = join(__dirname, "../../dist/cli.js");

const SOURCE_MD_CONTENT =
	"# Doc\n\n## Overview\n\nThis is the overview content.\n\nWith multiple lines.\n\n## Other\n\nUnrelated section.\n";

/**
 * D-001: extract header default output format changed from JSON to markdown.
 * Verifies --format flag behavior and default output.
 */
describe("extract header --format flag", () => {
	let testDir: string;

	beforeEach(() => {
		testDir = join(
			tmpdir(),
			`format-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
		);
		mkdirSync(testDir, { recursive: true });
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	it("defaults to numbered markdown using original source lines", () => {
		writeFileSync(join(testDir, "source.md"), SOURCE_MD_CONTENT);
		const output = execSync(
			`node "${CLI_PATH}" extract header "${join(testDir, "source.md")}" "Overview" --scope "${testDir}"`,
			{ encoding: "utf8" },
		);

		expect(() => JSON.parse(output)).toThrow();
		expect(output).toContain("     3\t## Overview");
		expect(output).toContain("     5\tThis is the overview content.");
		expect(output).toContain("     7\tWith multiple lines.");
		expect(output).not.toContain("## Other");
	});

	it("--format json returns valid JSON with OutgoingLinksExtractedContent structure", () => {
		writeFileSync(join(testDir, "source.md"), SOURCE_MD_CONTENT);
		const output = execSync(
			`node "${CLI_PATH}" extract header "${join(testDir, "source.md")}" "Overview" --scope "${testDir}" --format json --verbose`,
			{ encoding: "utf8" },
		);

		const result = JSON.parse(output);
		expect(result).toHaveProperty("extractedContentBlocks");
		expect(result).toHaveProperty("outgoingLinksReport");
		expect(result).toHaveProperty("stats");
		expect(result.extractedContentBlocks).toHaveProperty(
			"_totalContentCharacterLength",
		);
	});

	it("--format markdown explicitly returns same as default", () => {
		writeFileSync(join(testDir, "source.md"), SOURCE_MD_CONTENT);
		const defaultOutput = execSync(
			`node "${CLI_PATH}" extract header "${join(testDir, "source.md")}" "Overview" --scope "${testDir}"`,
			{ encoding: "utf8" },
		);

		const explicitOutput = execSync(
			`node "${CLI_PATH}" extract header "${join(testDir, "source.md")}" "Overview" --scope "${testDir}" --format markdown`,
			{ encoding: "utf8" },
		);

		expect(explicitOutput).toBe(defaultOutput);
	});

	it("keeps JSON content raw while markdown adds source line prefixes", () => {
		writeFileSync(join(testDir, "source.md"), SOURCE_MD_CONTENT);
		const jsonOutput = execSync(
			`node "${CLI_PATH}" extract header "${join(testDir, "source.md")}" "Overview" --scope "${testDir}" --format json`,
			{ encoding: "utf8" },
		);

		const markdownOutput = execSync(
			`node "${CLI_PATH}" extract header "${join(testDir, "source.md")}" "Overview" --scope "${testDir}" --format markdown`,
			{ encoding: "utf8" },
		);

		const result = JSON.parse(jsonOutput);
		const blockKey = Object.keys(result.extractedContentBlocks).find(
			(key) => key !== "_totalContentCharacterLength",
		);
		if (blockKey === undefined) throw new Error("Expected extracted content block");
		expect(
			result.extractedContentBlocks[blockKey].content.startsWith("## Overview"),
		).toBe(true);
		expect(markdownOutput.startsWith("     3\t## Overview")).toBe(true);
	});
});
