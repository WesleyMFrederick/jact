import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CitationValidator } from "../src/CitationValidator.js";
import { MarkdownParser } from "../src/MarkdownParser.js";
import { ParsedFileCache } from "../src/ParsedFileCache.js";
import ParsedDocument from "../src/ParsedDocument.js";
import {
	createCitationValidator,
	createParsedFileCache,
} from "../src/factories/componentFactory.js";

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
		const result = await cache.resolveParsedFile(fixtureFile);

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

describe("Component Factory - CitationValidator Cache Wiring", () => {
	it("should create ParsedFileCache internally when creating CitationValidator", () => {
		// Given: Factory function exists
		// When: createCitationValidator() called
		const validator = createCitationValidator();

		// Then: Validator has parsedFileCache property
		expect(validator.parsedFileCache).toBeDefined();
		expect(validator.parsedFileCache).toBeInstanceOf(ParsedFileCache);
	});

	it("should inject ParsedFileCache as first constructor argument", () => {
		// Given: Factory creates validator
		// When: Validator instantiated
		const validator = createCitationValidator();

		// Then: ParsedFileCache injected correctly
		expect(validator.parsedFileCache).toBeInstanceOf(ParsedFileCache);
	});

	it("should inject FileCache as second constructor argument", () => {
		// Given: Factory creates validator
		// When: Validator instantiated
		const validator = createCitationValidator();

		// Then: FileCache injected correctly (existing behavior)
		expect(validator.fileCache).toBeDefined();
	});

	it("should wire complete dependency chain MarkdownParser → ParsedFileCache → CitationValidator", async () => {
		// Given: Factory creates validator
		// When: Full dependency chain instantiated
		const validator = createCitationValidator();

		// Then: Complete chain exists
		// 1. Validator has ParsedFileCache
		expect(validator.parsedFileCache).toBeInstanceOf(ParsedFileCache);

		// 2. ParsedFileCache has MarkdownParser
		expect(validator.parsedFileCache.parser).toBeInstanceOf(MarkdownParser);

		// 3. MarkdownParser functional (can parse files)
		const fixtureFile = resolve(__dirname, "fixtures/valid-citations.md");
		const parsed =
			await validator.parsedFileCache.parser.parseFile(fixtureFile);
		expect(parsed).toHaveProperty("filePath");
		expect(parsed).toHaveProperty("content");
		expect(parsed).toHaveProperty("links");
		expect(parsed).toHaveProperty("anchors");
	});
});
