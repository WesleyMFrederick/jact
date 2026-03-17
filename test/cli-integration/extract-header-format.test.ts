import { execSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const CLI_PATH = join(__dirname, "../../dist/jact.js");

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

		writeFileSync(
			join(testDir, "source.md"),
			"# Doc\n\n## Overview\n\nThis is the overview content.\n\nWith multiple lines.\n\n## Other\n\nUnrelated section.\n",
		);
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	it("default output (no --format flag) is raw markdown, NOT JSON", () => {
		const output = execSync(
			`node "${CLI_PATH}" extract header "${join(testDir, "source.md")}" "Overview" --scope "${testDir}"`,
			{ encoding: "utf8" },
		);

		// Default should be raw markdown — not parseable as JSON
		expect(() => JSON.parse(output)).toThrow();
		// Should contain the actual markdown content
		expect(output).toContain("This is the overview content.");
	});

	it("--format json returns valid JSON with OutgoingLinksExtractedContent structure", () => {
		const output = execSync(
			`node "${CLI_PATH}" extract header "${join(testDir, "source.md")}" "Overview" --scope "${testDir}" --format json`,
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

	it("markdown content matches what JSON extractedContentBlocks[id].content would return", () => {
		const jsonOutput = execSync(
			`node "${CLI_PATH}" extract header "${join(testDir, "source.md")}" "Overview" --scope "${testDir}" --format json`,
			{ encoding: "utf8" },
		);

		const markdownOutput = execSync(
			`node "${CLI_PATH}" extract header "${join(testDir, "source.md")}" "Overview" --scope "${testDir}" --format markdown`,
			{ encoding: "utf8" },
		);

		const result = JSON.parse(jsonOutput);
		const blockKeys = Object.keys(result.extractedContentBlocks).filter(
			(k) => k !== "_totalContentCharacterLength",
		);
		const blockContent = blockKeys
			.map((k) => result.extractedContentBlocks[k].content)
			.join("\n---\n");

		// Markdown output should match the content extracted from JSON blocks
		// Both trimmed: console.log adds trailing \n, and block content may have trailing whitespace
		expect(markdownOutput.trimEnd()).toBe(blockContent.trimEnd());
	});
});
