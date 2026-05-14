/**
 * Unit tests for CitationValidator — enrichLinkObject factory (issue #37)
 *
 * TDD: RED test first — verifies original LinkObject is NOT mutated after
 * validateFile/validateSingleCitation returns. Proves the factory creates a
 * new object via spread rather than mutating the input in-place.
 *
 * Contract tests: validate the TSDoc Contract: blocks on enrichLinkObject,
 * validateFile, and validateSingleCitation. These tests will fail if those
 * contracts are broken — they are the enforcement layer for the TSDoc obligations.
 */

import fs, { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path, { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CitationValidator } from "../../../src/core/CitationValidator/CitationValidator.js";
import { MarkdownParser } from "../../../src/core/MarkdownParser/MarkdownParser.js";
import { FileCache } from "../../../src/FileCache.js";
import { ParsedFileCache } from "../../../src/ParsedFileCache.js";
import type { LinkObject } from "../../../src/types/citationTypes.js";

function makeValidator() {
	const fileCache = new FileCache(fs, path);
	const parser = new MarkdownParser(fs, fileCache);
	const cache = new ParsedFileCache(parser);
	return new CitationValidator(cache, fileCache);
}

function makeInternalLink(overrides: Partial<LinkObject> = {}): LinkObject {
	return {
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
		...overrides,
	};
}

describe("Contract: enrichLinkObject — immutability and spread (issue #37)", () => {
	it("validateSingleCitation does NOT mutate the original LinkObject", async () => {
		const validator = makeValidator();
		const original = makeInternalLink();

		// Retain a reference to the original object BEFORE validation.
		// After the call, the original must be unchanged — no .validation property added.
		const validationKey = "validation" as keyof LinkObject;
		expect(original[validationKey]).toBeUndefined();

		const enriched = await validator.validateSingleCitation(
			original,
			"/tmp/source.md",
		);

		// The returned enriched object has a validation property.
		expect(enriched.validation).toBeDefined();
		expect(enriched.validation.status).toBe("valid");

		// The ORIGINAL object must NOT have been mutated.
		expect(original[validationKey]).toBeUndefined();

		// The returned object must be a NEW object (not the same reference).
		expect(enriched).not.toBe(original);
	});

	it("validateFile does NOT mutate the original LinkObjects from the parser", async () => {
		// Set up a real temp file with a single caret-syntax link so validateFile
		// exercises the full enrichment path on real parser output.
		const tmpDir = mkdtempSync(join(tmpdir(), "jact-cv-test-"));
		const sourceFile = join(tmpDir, "source.md");
		writeFileSync(sourceFile, "# Source\n\nSee [link](#section).\n\n^FR1\n");

		const fileCache = new FileCache(fs, path);
		const parser = new MarkdownParser(fs, fileCache);
		const cache = new ParsedFileCache(parser);
		const validator = new CitationValidator(cache, fileCache);

		// Parse once to get the original LinkObjects.
		const parsedDoc = await cache.resolveParsedFile(sourceFile);
		const originalLinks = parsedDoc.getLinks();

		// Capture each link object reference BEFORE validateFile runs.
		// Snapshot the absence of .validation on every link.
		for (const link of originalLinks) {
			expect(
				(link as LinkObject & { validation?: unknown }).validation,
				`link at line ${link.line} must not have .validation before validateFile`,
			).toBeUndefined();
		}

		const result = await validator.validateFile(sourceFile);

		// validateFile must return enriched links.
		expect(result.links.length).toBeGreaterThan(0);
		for (const enriched of result.links) {
			expect(enriched.validation).toBeDefined();
		}

		// The ORIGINAL link objects must still be unmodified.
		for (const link of originalLinks) {
			expect(
				(link as LinkObject & { validation?: unknown }).validation,
				`link at line ${link.line} must NOT be mutated by validateFile`,
			).toBeUndefined();
		}
	});

	it("enriched object returned by validateSingleCitation has all original LinkObject fields", async () => {
		const validator = makeValidator();
		const original = makeInternalLink({ line: 42, column: 5, text: "MyRef" });

		const enriched = await validator.validateSingleCitation(
			original,
			"/tmp/source.md",
		);

		// All original fields preserved in the new object.
		expect(enriched.line).toBe(42);
		expect(enriched.column).toBe(5);
		expect(enriched.text).toBe("MyRef");
		expect(enriched.linkType).toBe("markdown");
		expect(enriched.scope).toBe("internal");
		expect(enriched.anchorType).toBe("block");
	});
});

describe("Contract: validateFile — throws on missing file", () => {
	it("throws Error('File not found: …') when filePath does not exist", async () => {
		// Given: a validator and a path that does not exist on disk
		const validator = makeValidator();

		// When / Then: validateFile rejects with "File not found" contract
		await expect(
			validator.validateFile("/non-existent-path-jact-test.md"),
		).rejects.toThrow("File not found");
	});
});

describe("Contract: validateSingleCitation — status values are exhaustive", () => {
	it("returns validation.status of 'valid', 'warning', or 'error' — no other values", async () => {
		// Given: a validator and a minimal internal-link citation
		const validator = makeValidator();
		const citation = makeInternalLink();

		// When: validateSingleCitation is called
		const enriched = await validator.validateSingleCitation(
			citation,
			"/tmp/source.md",
		);

		// Then: status is one of the three allowed values (contract exhaustiveness)
		expect(["valid", "warning", "error"]).toContain(enriched.validation.status);
	});

	it("returns a NEW object reference — original citation not mutated", async () => {
		// Given: validator and a link with no validation property
		const validator = makeValidator();
		const citation = makeInternalLink();

		// When: validateSingleCitation is called
		const enriched = await validator.validateSingleCitation(
			citation,
			"/tmp/source.md",
		);

		// Then: returned object is a new reference (contract: no mutation)
		expect(enriched).not.toBe(citation);
		expect(
			(citation as typeof citation & { validation?: unknown }).validation,
		).toBeUndefined();
	});
});
