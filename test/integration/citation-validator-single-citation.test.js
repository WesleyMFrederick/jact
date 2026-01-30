import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import { CitationValidator } from "../../src/CitationValidator.js";
<<<<<<< HEAD
import { MarkdownParser } from "../../src/MarkdownParser.js";
=======
import { MarkdownParser } from "../../src/core/MarkdownParser/index.js";
>>>>>>> main
import { ParsedFileCache } from "../../src/ParsedFileCache.js";
import { LinkObjectFactory } from "../../src/factories/LinkObjectFactory.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturesDir = resolve(__dirname, "../fixtures");

describe("validateSingleCitation returns EnrichedLinkObject", () => {
	let validator;
	let factory;

	beforeEach(() => {
		const fs = { readFileSync };
		const parser = new MarkdownParser(fs);
		const cache = new ParsedFileCache(parser);
		validator = new CitationValidator(cache, null);
		factory = new LinkObjectFactory();
	});

	it("should return the same link reference enriched with validation (valid case)", async () => {
		// Given: A synthetic link pointing to an existing fixture file
		const targetPath = resolve(fixturesDir, "enrichment/valid-links-target.md");
		const syntheticLink = factory.createFileLink(targetPath);

		// When: validateSingleCitation is called
		const result = await validator.validateSingleCitation(syntheticLink);

		// Then: Returns the SAME object (enrichment pattern, not wrapper)
		expect(result).toBe(syntheticLink); // Same reference = enrichment
		expect(result.validation).toBeDefined();
		expect(result.validation.status).toBe("valid");

		// Should NOT have flat wrapper properties from SingleCitationValidationResult
		expect(result).not.toHaveProperty("citation");
	});

	it("should return the same link reference enriched with error metadata (error case)", async () => {
		// Given: A synthetic link pointing to a nonexistent file
		const syntheticLink = factory.createFileLink("/nonexistent/file.md");

		// When: validateSingleCitation is called
		const result = await validator.validateSingleCitation(syntheticLink);

		// Then: Returns the SAME object enriched with error
		expect(result).toBe(syntheticLink); // Same reference = enrichment
		expect(result.validation).toBeDefined();
		expect(result.validation.status).toBe("error");
		expect(result.validation.error).toBeDefined();
		expect(typeof result.validation.error).toBe("string");
	});
});
