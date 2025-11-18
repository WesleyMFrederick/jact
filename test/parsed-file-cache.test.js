import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ParsedFileCache } from "../src/ParsedFileCache.js";
import ParsedDocument from "../src/ParsedDocument.js";
import { createMarkdownParser } from "../src/factories/componentFactory.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("ParsedFileCache", () => {
	let parser;
	let cache;

	beforeEach(() => {
		parser = createMarkdownParser();
		cache = new ParsedFileCache(parser);
	});

	it("should parse file on cache miss and store result", async () => {
		// Given: Empty cache, test fixture file
		const testFile = join(__dirname, "fixtures", "valid-citations.md");

		// When: First request for file
		const result = await cache.resolveParsedFile(testFile);

		// Then: ParsedDocument instance returned with facade methods
		expect(result).toBeInstanceOf(ParsedDocument);
		expect(typeof result.extractFullContent).toBe("function");
		expect(typeof result.getLinks).toBe("function");
		expect(typeof result.hasAnchor).toBe("function");

		// Verify facade methods return correct parsed data (not metadata)
		const content = result.extractFullContent();
		const links = result.getLinks();

		expect(typeof content).toBe("string");
		expect(content.length).toBeGreaterThan(0); // Has actual content
		expect(Array.isArray(links)).toBe(true); // Has links array
	});

	it("should return cached result on cache hit without re-parsing", async () => {
		// Given: File already in cache from first request
		const testFile = join(__dirname, "fixtures", "valid-citations.md");

		// Create spy on parser to track parse calls
		const parseSpy = vi.spyOn(parser, "parseFile");

		const firstResult = await cache.resolveParsedFile(testFile);

		// When: Second request for same file
		const secondResult = await cache.resolveParsedFile(testFile);

		// Then: Same object instance returned (cache hit)
		expect(secondResult).toBe(firstResult);

		// Parser called only once (not called on second request)
		expect(parseSpy).toHaveBeenCalledTimes(1);
	});

	it("should handle concurrent requests with single parse", async () => {
		// Given: Empty cache, multiple simultaneous requests
		const testFile = join(__dirname, "fixtures", "valid-citations.md");

		// Create spy on parser to track parse calls
		const parseSpy = vi.spyOn(parser, "parseFile");

		// When: Multiple simultaneous requests for same file (no await between calls)
		const promise1 = cache.resolveParsedFile(testFile);
		const promise2 = cache.resolveParsedFile(testFile);
		const promise3 = cache.resolveParsedFile(testFile);

		// Wait for all promises to resolve
		const [result1, result2, result3] = await Promise.all([
			promise1,
			promise2,
			promise3,
		]);

		// Then: Parser called only once (single parse operation)
		expect(parseSpy).toHaveBeenCalledTimes(1);

		// All promises resolve to same result object
		expect(result2).toBe(result1);
		expect(result3).toBe(result1);

		// All results are ParsedDocument instances with facade methods
		expect(result1).toBeInstanceOf(ParsedDocument);

		// Verify facade provides access to parsed data
		const content1 = result1.extractFullContent();
		const links1 = result1.getLinks();

		expect(typeof content1).toBe("string");
		expect(Array.isArray(links1)).toBe(true);
	});

	it("should propagate parser errors and remove from cache", async () => {
		// Given: File that will cause parse error (non-existent file)
		const invalidFile = join(
			__dirname,
			"fixtures",
			"nonexistent-file-12345.md",
		);

		// When: Request to parse invalid file
		// Then: Promise rejects with error
		await expect(cache.resolveParsedFile(invalidFile)).rejects.toThrow();

		// Verify failed entry removed from cache by checking subsequent request also fails
		// (if cached, it would return the rejected promise, but we want a fresh parse attempt)
		await expect(cache.resolveParsedFile(invalidFile)).rejects.toThrow();
	});

	it("should normalize file paths for consistent cache keys", async () => {
		// Given: Same file referenced with different path formats
		const absolutePath = join(__dirname, "fixtures", "valid-citations.md");
		const pathWithDotSlash = join(
			__dirname,
			"fixtures",
			".",
			"valid-citations.md",
		);
		const pathWithRedundantSeparators = join(
			__dirname,
			"fixtures",
			"valid-citations.md",
		)
			.split("/")
			.join("//")
			.replace("//", "/");

		// Create spy on parser to track parse calls
		const parseSpy = vi.spyOn(parser, "parseFile");

		// When: Request with different path formats for same file
		const result1 = await cache.resolveParsedFile(absolutePath);
		const result2 = await cache.resolveParsedFile(pathWithDotSlash);
		const result3 = await cache.resolveParsedFile(absolutePath);

		// Then: Treated as same cache entry (parser called only once)
		expect(parseSpy).toHaveBeenCalledTimes(1);

		// All results are same object instance
		expect(result2).toBe(result1);
		expect(result3).toBe(result1);
	});

	it("should cache different files independently", async () => {
		// Given: Multiple different test files
		const file1 = join(__dirname, "fixtures", "valid-citations.md");
		const file2 = join(__dirname, "fixtures", "test-target.md");
		const file3 = join(__dirname, "fixtures", "complex-headers.md");

		// Create spy on parser to track parse calls
		const parseSpy = vi.spyOn(parser, "parseFile");

		// When: Parse each file
		const result1 = await cache.resolveParsedFile(file1);
		const result2 = await cache.resolveParsedFile(file2);
		const result3 = await cache.resolveParsedFile(file3);

		// Then: Each cached separately (parser called once per unique file)
		expect(parseSpy).toHaveBeenCalledTimes(3);

		// Each result is different object instance
		expect(result2).not.toBe(result1);
		expect(result3).not.toBe(result1);
		expect(result3).not.toBe(result2);

		// Verify each result contains correct parsed data (not metadata)
		const content1 = result1.extractFullContent();
		const content2 = result2.extractFullContent();
		const content3 = result3.extractFullContent();

		// Each file has unique content
		expect(content1).not.toBe(content2);
		expect(content1).not.toBe(content3);
		expect(content2).not.toBe(content3);

		// Verify cache hits work independently (second request for file1 doesn't re-parse)
		const result1Again = await cache.resolveParsedFile(file1);
		expect(result1Again).toBe(result1);
		expect(parseSpy).toHaveBeenCalledTimes(3); // Still only 3 total calls
	});
});
