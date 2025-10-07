import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	createCitationValidator,
	createMarkdownParser,
	createParsedFileCache,
} from "../../src/factories/componentFactory.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("End-to-End Cache Integration", () => {
	let parser;
	let cache;
	let validator;
	let parseFileSpy;

	beforeEach(() => {
		// Create factory components for production-like setup
		parser = createMarkdownParser();
		parseFileSpy = vi.spyOn(parser, "parseFile");
		cache = createParsedFileCache(parser);
		validator = createCitationValidator(cache);
	});

	it("should validate complete workflow with factory components", async () => {
		// Given: Factory-created validator with cache
		const fixtureFile = resolve(__dirname, "../fixtures/valid-citations.md");
		expect(existsSync(fixtureFile)).toBe(true);

		// When: Validate file with multiple cross-document links
		const result = await validator.validateFile(fixtureFile);

		// Then: Validation completes successfully
		expect(result).toBeDefined();
		expect(result.summary).toBeDefined();
		expect(result.summary.total).toBeGreaterThan(0);
		expect(result.summary.errors).toBe(0);
		expect(result.results).toBeDefined();
		expect(Array.isArray(result.results)).toBe(true);
	});

	it("should handle multi-file validation with cache", async () => {
		// Given: Validator with cache, fixture with repeated references
		const fixtureFile = resolve(
			__dirname,
			"../fixtures/multiple-links-same-target.md",
		);
		const targetFile = resolve(__dirname, "../fixtures/shared-target.md");
		expect(existsSync(fixtureFile)).toBe(true);
		expect(existsSync(targetFile)).toBe(true);

		// When: Validate file referencing same target multiple times
		const result = await validator.validateFile(fixtureFile);

		// Then: Target parsed once, all links validated
		const targetFileCalls = parseFileSpy.mock.calls.filter(
			(call) => call[0] === targetFile,
		);
		expect(targetFileCalls.length).toBe(1);

		// Then: All links processed (note: fixture has one invalid anchor for testing)
		expect(result.summary.total).toBe(5);
		expect(result.summary.valid).toBe(4);
		expect(result.summary.errors).toBe(1);
	});

	it("should parse each file only once across validation", async () => {
		// Given: Parser spy, validator with cache
		const fixtureFile = resolve(
			__dirname,
			"../fixtures/multiple-links-same-target.md",
		);
		const targetFile = resolve(__dirname, "../fixtures/shared-target.md");

		// When: Validate file with repeated file references
		await validator.validateFile(fixtureFile);

		// Then: Each unique file parsed exactly once
		const targetFileCalls = parseFileSpy.mock.calls.filter(
			(call) => call[0] === targetFile,
		);
		expect(targetFileCalls.length).toBe(1);

		// Then: Source file parsed exactly once
		const sourceFileCalls = parseFileSpy.mock.calls.filter(
			(call) => call[0] === fixtureFile,
		);
		expect(sourceFileCalls.length).toBe(1);

		// Then: Total parse operations = unique files only
		const uniqueFiles = new Set(parseFileSpy.mock.calls.map((call) => call[0]));
		expect(parseFileSpy.mock.calls.length).toBe(uniqueFiles.size);
	});

	it("should produce identical results with cache enabled", async () => {
		// Given: Same validator configuration, same fixture
		const fixtureFile = resolve(__dirname, "../fixtures/valid-citations.md");
		const validator1 = createCitationValidator(cache);
		const validator2 = createCitationValidator(cache);

		// When: Validate same file twice
		const result1 = await validator1.validateFile(fixtureFile);
		const result2 = await validator2.validateFile(fixtureFile);

		// Then: Results structurally identical
		expect(result2.summary.total).toBe(result1.summary.total);
		expect(result2.summary.valid).toBe(result1.summary.valid);
		expect(result2.summary.errors).toBe(result1.summary.errors);
		expect(result2.summary.warnings).toBe(result1.summary.warnings);

		// Then: Individual results match
		expect(result2.results.length).toBe(result1.results.length);
		for (let i = 0; i < result1.results.length; i++) {
			expect(result2.results[i].status).toBe(result1.results[i].status);
			expect(result2.results[i].line).toBe(result1.results[i].line);
		}
	});

	it("should validate workflow from factory creation through validation", async () => {
		// Given: Complete factory-created component chain
		const factoryParser = createMarkdownParser();
		const factoryCache = createParsedFileCache(factoryParser);
		const factoryValidator = createCitationValidator(factoryCache);
		const fixtureFile = resolve(__dirname, "../fixtures/valid-citations.md");

		// When: Execute complete validation workflow
		const result = await factoryValidator.validateFile(fixtureFile);

		// Then: Workflow completes with expected results
		expect(result).toBeDefined();
		expect(result.summary).toBeDefined();
		expect(result.results).toBeDefined();
		expect(result.summary.total).toBeGreaterThan(0);
	});

	it("should cache target file data for anchor validation", async () => {
		// Given: Fixture with anchor reference to target file
		const fixtureFile = resolve(
			__dirname,
			"../fixtures/multiple-links-same-target.md",
		);
		const targetFile = resolve(__dirname, "../fixtures/shared-target.md");
		const cacheResolveSpy = vi.spyOn(cache, "resolveParsedFile");

		// When: Validate file with anchor links
		await validator.validateFile(fixtureFile);

		// Then: Target file data retrieved from cache
		const targetCacheCalls = cacheResolveSpy.mock.calls.filter(
			(call) => call[0] === targetFile,
		);
		expect(targetCacheCalls.length).toBeGreaterThan(0);

		// Then: Cache used for target file access
		expect(cacheResolveSpy).toHaveBeenCalledWith(targetFile);
	});
});
