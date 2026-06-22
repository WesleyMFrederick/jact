import fs, { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path, { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { CitationValidator } from "../../src/core/CitationValidator/CitationValidator.js";
import { MarkdownParser } from "../../src/core/MarkdownParser/MarkdownParser.js";
import { FileCache } from "../../src/FileCache.js";
import { ParsedFileCache } from "../../src/ParsedFileCache.js";
import type { LinkObject } from "../../src/types/citationTypes.js";

/**
 * Item 6.3 — CitationValidator must consume `target.path.absolute` when the
 * parser already resolved a wiki page name (e.g. via `resolveWikiPath` slug step).
 * Re-resolving from `target.path.raw` (a Title-Case page name with spaces) drops
 * the parser's slug result and the link spuriously fails validation.
 */
describe("CitationValidator — wiki link with pre-resolved target.path.absolute", () => {
	let validator: CitationValidator;
	let tmpDir: string;
	let sourceFile: string;
	let targetFile: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "jact-wiki-validator-"));
		sourceFile = join(tmpDir, "source.md");
		// Pre-resolved file lives in a sibling subdir so re-resolving from
		// `target.path.raw` (the bare page name) cannot accidentally find it.
		const subdir = join(tmpDir, "wiki");
		writeFileSync(sourceFile, "# Source\n");
		mkdirSync(subdir, { recursive: true });
		targetFile = join(subdir, "the-hardening-principle.md");
		writeFileSync(targetFile, "# The Hardening Principle\n");

		// Empty FileCache — buildCache not called, so resolveFile always misses.
		// This forces the validator to rely on `target.path.absolute` (the spike fix).
		const fileCache = new FileCache(fs, path);
		const parser = new MarkdownParser(fs, fileCache);
		const cache = new ParsedFileCache(parser);
		validator = new CitationValidator(cache, fileCache);
	});

	it("(Item 6.4) error message includes both raw and slug attempted paths when wiki resolution failed", async () => {
		// Given: a wiki LinkObject the parser tried to resolve but failed.
		// `resolveWikiPath` returned { resolved: false, attempted: [raw, slug+".md"] };
		// `createLinkObject` surfaces that via `target.path.attempted`.
		const link: LinkObject = {
			linkType: "wiki",
			scope: "cross-document",
			anchorType: null,
			source: { path: { absolute: sourceFile } },
			target: {
				path: {
					raw: "The Hardening Principle (concept)",
					absolute: null,
					relative: null,
					attempted: [
						"The Hardening Principle (concept)",
						"the-hardening-principle-concept.md",
					],
				},
				anchor: null,
			},
			text: "The Hardening Principle (concept)",
			fullMatch: "[[The Hardening Principle (concept)]]",
			line: 1,
			column: 0,
			extractionMarker: null,
		};

		const result = await validator.validateSingleCitation(link, sourceFile);
		const v = result.validation;
		expect(v.status).toBe("error");
		if (v.status !== "error") throw new Error("expected error status");
		// Error suggestion or message must contain BOTH attempted paths
		const combined = `${v.error} ${v.suggestion ?? ""}`;
		expect(combined).toContain("The Hardening Principle (concept)");
		expect(combined).toContain("the-hardening-principle-concept.md");
	});

	it("validates a wiki link as 'valid' when target.path.absolute is pre-populated", async () => {
		// Given: a wiki LinkObject the parser already resolved (slug step found
		// `the-hardening-principle.md` for raw page name "The Hardening Principle").
		const link: LinkObject = {
			linkType: "wiki",
			scope: "cross-document",
			anchorType: null,
			source: { path: { absolute: sourceFile } },
			target: {
				path: {
					raw: "The Hardening Principle",
					absolute: targetFile,
					relative: "wiki/the-hardening-principle.md",
				},
				anchor: null,
			},
			text: "The Hardening Principle",
			fullMatch: "[[The Hardening Principle]]",
			line: 1,
			column: 0,
			extractionMarker: null,
		};

		const result = await validator.validateSingleCitation(link, sourceFile);
		expect(result.validation?.status).toBe("valid");
	});
});
