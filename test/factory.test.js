import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { CitationValidator } from "../src/core/CitationValidator/CitationValidator.js";
import { MarkdownParser } from "../src/core/MarkdownParser/index.js";
import {
	createCitationValidator,
	createFileCache,
	createParsedFileCache,
	createValidationWorkflow,
} from "../src/factories/componentFactory.js";
import ParsedDocument from "../src/ParsedDocument.js";
import { ParsedFileCache } from "../src/ParsedFileCache.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("Component Factory - ParsedFileCache Creation", () => {
	it("should create ParsedFileCache instance", () => {
		// Given: Factory function exists
		// When: createParsedFileCache() called
		const cache = createParsedFileCache();

		// Then: Returns ParsedFileCache instance
		expect(cache).toBeInstanceOf(ParsedFileCache);
	});

	it("should inject MarkdownParser dependency into ParsedFileCache", () => {
		// Given: Factory creates ParsedFileCache
		// When: Cache created via factory
		const cache = createParsedFileCache();

		// Then: Cache has parser property set
		expect(cache.parser).toBeDefined();
		expect(cache.parser).toBeInstanceOf(MarkdownParser);
	});

	it("should enable file parsing through injected parser", async () => {
		// Given: Factory-created cache with parser dependency
		const cache = createParsedFileCache();

		// Given: Test fixture file
		const fixtureFile = resolve(__dirname, "fixtures/valid-citations.md");

		// When: Cache resolves parsed file
		const result = await cache.resolveDocument({ kind: "file", filePath: fixtureFile });

		// Then: Returns valid ParsedDocument facade instance
		expect(result).toBeInstanceOf(ParsedDocument);

		// Verify facade methods available
		expect(typeof result.getLinks).toBe("function");
		expect(typeof result.extractFullContent).toBe("function");

		// Verify facade provides access to parsed data
		const links = result.getLinks();
		expect(Array.isArray(links)).toBe(true);
	});
});

describe("Component Factory - CitationValidator lifecycle wiring", () => {
	it("creates the semantic validation operation with production defaults", async () => {
		const validator = createCitationValidator();
		const result = await validator.validateDocument(
			{ getLinks: () => [] },
			"/virtual/source.md",
		);

		expect(validator).toBeInstanceOf(CitationValidator);
		expect(result.summary).toEqual({
			total: 0,
			valid: 0,
			warnings: 0,
			errors: 0,
		});
	});

	it("uses an injected parsed-document lifecycle for anchor checks", async () => {
		const resolveDocument = vi.fn().mockResolvedValue({
			hasAnchor: () => true,
			findSimilarAnchors: () => [],
			getLinks: () => [],
			data: { anchors: [] },
		});
		const validator = createCitationValidator(
			{ resolveDocument },
			createFileCache(),
		);

		await validator.validateSingleCitation(
			{
				line: 1,
				column: 1,
				text: "self",
				fullMatch: "[self](#heading)",
				linkType: "markdown",
				scope: "internal",
				anchorType: "header",
				source: { raw: "[self](#heading)" },
				target: {
					path: { raw: "", absolute: null },
					anchor: "heading",
				},
			},
			"/virtual/source.md",
		);

		expect(resolveDocument).toHaveBeenCalledWith({
			kind: "file",
			filePath: "/virtual/source.md",
		});
	});

	it("uses an injected file cache during fallback resolution", async () => {
		const fileCache = createFileCache();
		const resolveFile = vi.spyOn(fileCache, "resolveFile");
		const validator = createCitationValidator(null, fileCache);

		await validator.validateSingleCitation(
			{
				line: 1,
				column: 1,
				text: "missing",
				fullMatch: "[missing](missing.md)",
				linkType: "markdown",
				scope: "cross-document",
				anchorType: "none",
				source: { raw: "[missing](missing.md)" },
				target: {
					path: { raw: "missing.md", absolute: null },
					anchor: null,
				},
			},
			"/virtual/source.md",
		);

		expect(resolveFile).toHaveBeenCalledWith("missing.md");
	});

	it("wires parser, lifecycle, and validator into one working chain", async () => {
		const parsedDocuments = createParsedFileCache();
		const validator = createCitationValidator(parsedDocuments, createFileCache());
		const fixtureFile = resolve(__dirname, "fixtures/valid-citations.md");
		const document = await parsedDocuments.resolveDocument({
			kind: "file",
			filePath: fixtureFile,
		});
		const result = await validator.validateDocument(document, fixtureFile);

		expect(document).toBeInstanceOf(ParsedDocument);
		expect(result.summary.total).toBeGreaterThan(0);
	});
});

describe("Component Factory - ValidationWorkflow wiring", () => {
	it("shares the scoped file cache with wiki parsing and validation", async () => {
		const fixtureDir = resolve(__dirname, "fixtures/wiki-scope-resolution");
		const sourceFile = resolve(
			fixtureDir,
			"wiki-scope-resolution-source.md",
		);
		const workflow = createValidationWorkflow();

		const outcome = await workflow.validate(
			{ kind: "file", filePath: sourceFile },
			{ scope: fixtureDir },
		);

		expect(outcome.kind).toBe("completed");
		if (outcome.kind === "completed") {
			expect(outcome.result.summary).toEqual({
				total: 2,
				valid: 2,
				warnings: 0,
				errors: 0,
			});
		}
	});
});
