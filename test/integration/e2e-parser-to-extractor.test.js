import { describe, it, expect, beforeEach } from "vitest";
import { MarkdownParser } from "../../src/MarkdownParser.js";
import { createContentExtractor } from "../../src/factories/componentFactory.js";
import fs from "node:fs";
import path from "node:path";

describe("E2E: MarkdownParser → ContentExtractor", () => {
	let parser;
	let extractor;

	beforeEach(() => {
		parser = new MarkdownParser(fs, path);
		extractor = createContentExtractor();
	});

	it("should parse markers and analyze eligibility correctly", async () => {
		// Given: Static fixture with mixed link types
		const fixturePath = path.join(
			__dirname,
			"../fixtures/us2.1/e2e-mixed-markers.md",
		);

		// When: Parse file → analyze each link
		const parsed = await parser.parseFile(fixturePath);
		const decisions = parsed.links.map((link) => ({
			link: link.fullMatch,
			decision: extractor.analyzeEligibility(link, { fullFiles: false }),
		}));

		// Then: Each decision matches expected eligibility
		expect(decisions).toEqual([
			{
				link: "[Full file without flag](target.md)",
				decision: {
					eligible: false,
					reason: "Full-file link ineligible without --full-files flag",
				},
			},
			{
				link: "[Full file with force marker](another.md)",
				decision: {
					eligible: true,
					reason: "force-extract overrides defaults",
				},
			},
			{
				link: "[Section link](#header)",
				decision: {
					eligible: true,
					reason: "Markdown anchor links eligible by default",
				},
			},
			{
				link: "[Section with stop marker](#section)",
				decision: {
					eligible: false,
					reason: "stop-extract-link marker prevents extraction",
				},
			},
		]);
	});

	it("should change eligibility when CLI flag changes", async () => {
		// Given: Static fixture with full-file link
		const fixturePath = path.join(
			__dirname,
			"../fixtures/us2.1/e2e-full-file-no-flag.md",
		);

		// When: Parse and analyze with/without --full-files flag
		const parsed = await parser.parseFile(fixturePath);
		const link = parsed.links[0];

		const withoutFlag = extractor.analyzeEligibility(link, {
			fullFiles: false,
		});
		const withFlag = extractor.analyzeEligibility(link, { fullFiles: true });

		// Then: Flag changes eligibility
		expect(withoutFlag.eligible).toBe(false);
		expect(withFlag.eligible).toBe(true);
	});

	it("should detect markers in various markdown link formats", async () => {
		// Given: Static fixture with different link syntaxes
		const fixturePath = path.join(
			__dirname,
			"../fixtures/us2.1/e2e-various-formats.md",
		);

		// When: Parse file
		const parsed = await parser.parseFile(fixturePath);

		// Then: All markers detected
		expect(parsed.links[0].extractionMarker.innerText).toBe("force-extract");
		expect(parsed.links[1].extractionMarker.innerText).toBe(
			"stop-extract-link",
		);
		expect(parsed.links[2].extractionMarker.innerText).toBe("force-extract");
	});
});
