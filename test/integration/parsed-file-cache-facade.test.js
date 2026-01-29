import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import ParsedDocument from "../../src/ParsedDocument.js";
import { createCitationValidator } from "../../src/factories/componentFactory.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Integration tests for ParsedFileCache facade wrapping behavior
 *
 * These tests validate that ParsedFileCache wraps MarkdownParser.Output.DataContract
 * in ParsedDocument facade instances before caching and returning results.
 *
 * TDD RED Phase: These tests will FAIL until ParsedDocument facade is implemented
 * and ParsedFileCache is refactored to wrap parser output.
 *
 * Architecture requirement (US1.7 AC6):
 * - Cache must wrap parser output in ParsedDocument BEFORE storing in cache
 * - All consumers receive ParsedDocument instances, not raw contracts
 * - Facade provides stable query interface hiding internal data structure
 */
describe("ParsedFileCache Facade Integration Tests", () => {
	let validator;
	let cache;

	beforeEach(() => {
		// Given: Factory-created validator with all real dependencies wired
		validator = createCitationValidator();
		cache = validator.parsedFileCache;
	});

	it("should return ParsedDocument instance (not raw contract)", async () => {
		// Given: Factory-created cache with real MarkdownParser dependency
		const testFile = join(__dirname, "..", "fixtures", "valid-citations.md");

		// When: Resolve parsed file from cache (first request triggers parse)
		const result = await cache.resolveParsedFile(testFile);

		// Then: Result is ParsedDocument instance, not raw MarkdownParser.Output.DataContract
		expect(result).toBeInstanceOf(ParsedDocument);

		// Then: Facade wraps contract internally (private _data property exists)
		expect(result._data).toBeDefined();
		expect(result._data).toHaveProperty("filePath");
		expect(result._data).toHaveProperty("content");
		expect(result._data).toHaveProperty("anchors");
	});

	it("should return instance with all expected query methods", async () => {
		// Given: Cache instance from factory with real parser
		const testFile = join(__dirname, "..", "fixtures", "complex-headers.md");

		// When: Retrieve parsed document from cache
		const parsedDoc = await cache.resolveParsedFile(testFile);

		// Then: Instance has all ParsedDocument facade query methods
		expect(typeof parsedDoc.hasAnchor).toBe("function");
		expect(typeof parsedDoc.findSimilarAnchors).toBe("function");
		expect(typeof parsedDoc.getLinks).toBe("function");
		expect(typeof parsedDoc.extractFullContent).toBe("function");
		expect(typeof parsedDoc.extractSection).toBe("function");
		expect(typeof parsedDoc.extractBlock).toBe("function");
	});

	it("should cache ParsedDocument instances (not raw contracts)", async () => {
		// Given: Empty cache, test fixture file
		const testFile = join(__dirname, "..", "fixtures", "anchor-matching.md");

		// When: First request for file (triggers parse and facade wrapping)
		const firstResult = await cache.resolveParsedFile(testFile);

		// When: Second request for same file (cache hit)
		const secondResult = await cache.resolveParsedFile(testFile);

		// Then: Both results are ParsedDocument instances
		expect(firstResult).toBeInstanceOf(ParsedDocument);
		expect(secondResult).toBeInstanceOf(ParsedDocument);

		// Then: Same instance returned from cache (cache hit verification)
		expect(secondResult).toBe(firstResult);
	});

	it("should provide facade query interface over wrapped contract", async () => {
		// Given: Cache with real parser and test file containing anchors
		const testFile = join(__dirname, "..", "fixtures", "complex-headers.md");

		// When: Retrieve parsed document via cache
		const parsedDoc = await cache.resolveParsedFile(testFile);

		// Then: Facade methods work correctly (query wrapped contract)
		// Test hasAnchor method (should check wrapped contract anchors)
		const anchorExists = parsedDoc.hasAnchor("introduction");
		expect(typeof anchorExists).toBe("boolean");

		// Test getLinks method (should return wrapped contract links)
		const links = parsedDoc.getLinks();
		expect(Array.isArray(links)).toBe(true);

		// Test extractFullContent method (should return wrapped contract content)
		const content = parsedDoc.extractFullContent();
		expect(typeof content).toBe("string");
		expect(content.length).toBeGreaterThan(0);

		// Test findSimilarAnchors method (should operate on wrapped contract)
		const similarAnchors = parsedDoc.findSimilarAnchors("intro");
		expect(Array.isArray(similarAnchors)).toBe(true);
	});
});
