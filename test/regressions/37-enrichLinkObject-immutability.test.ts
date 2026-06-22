/**
 * Regression: issue #37 — enrichLinkObject mutated the original LinkObject in-place.
 *
 * Before the fix, CitationValidator would write `validation` directly onto the
 * original LinkObject via a cast:
 *   (citation as EnrichedLinkObject).validation = validation;
 *
 * This meant any caller holding a reference to the original object would observe
 * the `validation` property appearing after the call — a hidden mutation side-effect.
 *
 * The fix replaced in-place mutation with an object-spread factory (enrichLinkObject),
 * ensuring the original is never touched.
 *
 * This test reproduces the original failure mode: it would have failed BEFORE the fix.
 */

import fs, { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path, { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CitationValidator } from "../../src/core/CitationValidator/CitationValidator.js";
import { MarkdownParser } from "../../src/core/MarkdownParser/MarkdownParser.js";
import { FileCache } from "../../src/FileCache.js";
import { ParsedFileCache } from "../../src/ParsedFileCache.js";
import type { LinkObject } from "../../src/types/citationTypes.js";

describe("Regression #37: enrichLinkObject must not mutate the original LinkObject", () => {
	it("validateSingleCitation — original LinkObject has no .validation after the call", async () => {
		// Arrange: build a validator and a minimal internal-link citation
		const fileCache = new FileCache(fs, path);
		const parser = new MarkdownParser(fs, fileCache);
		const cache = new ParsedFileCache(parser);
		const validator = new CitationValidator(cache, fileCache);

		const original: LinkObject = {
			linkType: "markdown",
			scope: "internal",
			anchorType: "block",
			source: { path: { absolute: "/tmp/source.md" } },
			target: {
				path: { raw: null, absolute: null, relative: null },
				anchor: "FR1",
			},
			text: "FR1",
			fullMatch: "^FR1",
			line: 1,
			column: 0,
			extractionMarker: null,
		};

		// Act: run validation
		const enriched = await validator.validateSingleCitation(
			original,
			"/tmp/source.md",
		);

		// Assert: the original is untouched — this is what FAILED before the fix
		expect(
			(original as LinkObject & { validation?: unknown }).validation,
			"Original LinkObject must NOT have .validation after validateSingleCitation (regression #37)",
		).toBeUndefined();

		// The enriched object is a new reference with validation present
		expect(enriched).not.toBe(original);
		expect(enriched.validation).toBeDefined();
	});

	it("validateFile — original parser LinkObjects have no .validation after the call", async () => {
		// Arrange: write a temp file so validateFile can parse real links
		const tmpDir = mkdtempSync(join(tmpdir(), "jact-regression-37-"));
		const sourceFile = join(tmpDir, "source.md");
		writeFileSync(sourceFile, "# Source\n\nSee [link](#section).\n\n^FR1\n");

		const fileCache = new FileCache(fs, path);
		const parser = new MarkdownParser(fs, fileCache);
		const cache = new ParsedFileCache(parser);
		const validator = new CitationValidator(cache, fileCache);

		// Capture original LinkObject references from the parser BEFORE validateFile
		const parsedDoc = await cache.resolveParsedFile(sourceFile);
		const originalLinks = parsedDoc.getLinks();

		// Act: run full-file validation
		await validator.validateFile(sourceFile);

		// Assert: every original link is still unmutated — this FAILED before the fix
		for (const link of originalLinks) {
			expect(
				(link as LinkObject & { validation?: unknown }).validation,
				`link at line ${link.line} must NOT have .validation after validateFile (regression #37)`,
			).toBeUndefined();
		}
	});
});
