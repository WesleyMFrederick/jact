import { join, dirname } from "node:path";
import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import { createCitationValidator } from "../../src/factories/componentFactory.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturesDir = join(__dirname, "..", "fixtures");

describe("Component Integration", () => {
	describe("CitationValidator with MarkdownParser and FileCache", () => {

		it("should validate citations using real file operations", async () => {
			// Given: Factory creates validator with production dependencies
			const validator = createCitationValidator();
			const testFile = join(fixturesDir, "valid-citations.md");

			// When: Validator processes file with real file system
			const result = await validator.validateFile(testFile);

			// Then: Validation succeeds with expected citation count
			expect(result.file).toBe(testFile);
			expect(result.summary.total).toBeGreaterThan(0);
			expect(result.summary.valid).toBe(result.summary.total);
			expect(result.summary.errors).toBe(0);
			expect(result.results).toBeInstanceOf(Array);
			expect(result.results.length).toBe(result.summary.total);
			// Verify all results have valid status
			result.results.forEach(citation => {
				expect(citation.status).toBe("valid");
			});
		});

		it("should detect broken links using component collaboration", async () => {
			// Given: Factory-created validator with real dependencies
			const validator = createCitationValidator();
			const testFile = join(fixturesDir, "broken-links.md");

			// When: Validator processes broken-links.md fixture
			const result = await validator.validateFile(testFile);

			// Then: Component collaboration detects errors
			expect(result.file).toBe(testFile);
			expect(result.summary.total).toBeGreaterThan(0);
			expect(result.summary.errors).toBeGreaterThan(0);
			// Verify that errors are properly detected
			const errorResults = result.results.filter(r => r.status === "error");
			expect(errorResults.length).toBe(result.summary.errors);
			// Verify error messages are populated
			errorResults.forEach(errorResult => {
				expect(errorResult.error).toBeDefined();
				expect(typeof errorResult.error).toBe("string");
			});
		});

		it("should validate citations with cache-assisted resolution", async () => {
			// Given: Validator with file cache built for fixtures directory
			const validator = createCitationValidator();
			const testFile = join(fixturesDir, "scope-test.md");

			// When: Validating scope-test.md using cache for resolution
			const result = await validator.validateFile(testFile);

			// Then: Cache-assisted validation succeeds
			expect(result.file).toBe(testFile);
			expect(result.summary.total).toBeGreaterThan(0);
			// Verify cache can resolve valid citations
			const validResults = result.results.filter(r => r.status === "valid" || r.status === "warning");
			expect(validResults.length).toBeGreaterThan(0);
			// Verify component collaboration through result structure
			result.results.forEach(citation => {
				expect(citation).toHaveProperty("line");
				expect(citation).toHaveProperty("citation");
				expect(citation).toHaveProperty("status");
				expect(citation).toHaveProperty("linkType");
				expect(citation).toHaveProperty("scope");
			});
		});
	});
});
