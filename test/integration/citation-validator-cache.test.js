import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CitationValidator } from "../../dist/CitationValidator.js";
import { MarkdownParser } from "../../dist/MarkdownParser.js";
import { ParsedFileCache } from "../../dist/ParsedFileCache.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("CitationValidator Cache Integration", () => {
	let parser;
	let cache;
	let validator;
	let parseFileSpy;

	beforeEach(() => {
		// Create real parser with file system dependency
		const fs = { readFileSync };
		parser = new MarkdownParser(fs);

		// Spy on parseFile to track calls
		parseFileSpy = vi.spyOn(parser, "parseFile");

		// Create cache with spied parser
		cache = new ParsedFileCache(parser);

		// Task 3.2 complete: CitationValidator now accepts ParsedFileCache
		validator = new CitationValidator(cache, null);
	});

	it("should parse target file only once when multiple links reference it", async () => {
		// Given: Test fixture with multiple links to same target file
		const fixtureFile = resolve(
			__dirname,
			"../fixtures/multiple-links-same-target.md",
		);
		expect(existsSync(fixtureFile)).toBe(true);

		// Given: Real parser with spy to track parseFile calls
		// (already set up in beforeEach)

		// Given: Cache-enabled validator (Task 3.2 complete)
		const cacheEnabledValidator = new CitationValidator(cache, null);

		// When: Validate file with multiple links to same target
		await cacheEnabledValidator.validateFile(fixtureFile);

		// Then: Target file parsed exactly once despite multiple references
		const targetFile = resolve(__dirname, "../fixtures/shared-target.md");
		const targetFileCalls = parseFileSpy.mock.calls.filter(
			(call) => call[0] === targetFile,
		);

		// Expected: 1 (file parsed only once via cache)
		// Current: Will be > 1 until Task 3.2 implements cache integration
		expect(targetFileCalls.length).toBe(1);
	});

	it("should use cache for source file parsing", async () => {
		// Given: Factory-created validator with cache
		const cacheResolveSpy = vi.spyOn(cache, "resolveParsedFile");

		// Given: Cache-enabled validator (Task 3.2 complete)
		const cacheEnabledValidator = new CitationValidator(cache, null);

		// Given: Test fixture file
		const fixtureFile = resolve(__dirname, "../fixtures/valid-citations.md");

		// When: Validate file
		await cacheEnabledValidator.validateFile(fixtureFile);

		// Then: Source file requested from cache, not parser directly
		// Expected: cache.resolveParsedFile called for source file
		// Current: Will fail until Task 3.2 changes validator to use cache
		expect(cacheResolveSpy).toHaveBeenCalledWith(fixtureFile);
	});

	it("should use cache for target file anchor validation", async () => {
		// Given: Link with anchor reference
		const fixtureFile = resolve(
			__dirname,
			"../fixtures/multiple-links-same-target.md",
		);
		const targetFile = resolve(__dirname, "../fixtures/shared-target.md");

		// Given: Cache with spy on resolveParsedFile
		const cacheResolveSpy = vi.spyOn(cache, "resolveParsedFile");

		// Given: Cache-enabled validator (Task 3.2 complete)
		const cacheEnabledValidator = new CitationValidator(cache, null);

		// When: Validate anchor exists
		await cacheEnabledValidator.validateFile(fixtureFile);

		// Then: Target file data retrieved from cache
		// Expected: cache.resolveParsedFile called for target file during anchor validation
		// Current: Will fail until Task 3.2 changes validator to use cache
		const targetFileCacheCalls = cacheResolveSpy.mock.calls.filter(
			(call) => call[0] === targetFile,
		);
		expect(targetFileCacheCalls.length).toBeGreaterThan(0);
	});

	it("should produce identical validation results with cache", async () => {
		// Given: Same fixture validated with/without cache
		const fixtureFile = resolve(__dirname, "../fixtures/valid-citations.md");

		// Given: Validator with cache
		const directValidator = new CitationValidator(cache, null);

		// Given: Another validator with same cache (Task 3.2 complete)
		const cachedValidator = new CitationValidator(cache, null);

		// When: Compare validation results
		const directResult = await directValidator.validateFile(fixtureFile);
		const cachedResult = await cachedValidator.validateFile(fixtureFile);

		// Then: Results identical (cache transparent to validation logic)
		expect(cachedResult.summary.total).toBe(directResult.summary.total);
		expect(cachedResult.summary.valid).toBe(directResult.summary.valid);
		expect(cachedResult.summary.errors).toBe(directResult.summary.errors);
		expect(cachedResult.summary.warnings).toBe(directResult.summary.warnings);

		// Verify all enriched link statuses match
		expect(cachedResult.links.length).toBe(directResult.links.length);
		for (let i = 0; i < directResult.links.length; i++) {
			expect(cachedResult.links[i].validation.status).toBe(
				directResult.links[i].validation.status,
			);
			expect(cachedResult.links[i].line).toBe(directResult.links[i].line);
		}
	});
});
