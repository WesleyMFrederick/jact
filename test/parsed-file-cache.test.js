import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ParsedFileCache } from "../src/ParsedFileCache.js";
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

		// Then: Parser Output Contract returned with all required fields
		expect(result).toHaveProperty("filePath");
		expect(result).toHaveProperty("content");
		expect(result).toHaveProperty("tokens");
		expect(result).toHaveProperty("links");
		expect(result).toHaveProperty("headings");
		expect(result).toHaveProperty("anchors");

		expect(typeof result.filePath).toBe("string");
		expect(typeof result.content).toBe("string");
		expect(Array.isArray(result.tokens)).toBe(true);
		expect(Array.isArray(result.links)).toBe(true);
		expect(Array.isArray(result.headings)).toBe(true);
		expect(Array.isArray(result.anchors)).toBe(true);

		// Verify filePath is absolute path to test file
		expect(result.filePath).toContain("valid-citations.md");
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

		// All results have complete Parser Output Contract
		expect(result1).toHaveProperty("filePath");
		expect(result1).toHaveProperty("content");
		expect(result1).toHaveProperty("tokens");
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

		// Each result has correct filePath
		expect(result1.filePath).toContain("valid-citations.md");
		expect(result2.filePath).toContain("test-target.md");
		expect(result3.filePath).toContain("complex-headers.md");

		// Verify cache hits work independently (second request for file1 doesn't re-parse)
		const result1Again = await cache.resolveParsedFile(file1);
		expect(result1Again).toBe(result1);
		expect(parseSpy).toHaveBeenCalledTimes(3); // Still only 3 total calls
	});
});
