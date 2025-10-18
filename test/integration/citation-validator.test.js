import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
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
			expect(result.summary.total).toBeGreaterThan(0);
			expect(result.summary.valid).toBe(result.summary.total);
			expect(result.summary.errors).toBe(0);
			expect(result.links).toBeInstanceOf(Array);
			expect(result.links.length).toBe(result.summary.total);
			// Verify all enriched links have valid status in validation property
			for (const link of result.links) {
				expect(link.validation).toBeDefined();
				expect(link.validation.status).toBe("valid");
				// Verify LinkObject base properties remain intact
				expect(link.linkType).toBeDefined();
				expect(link.line).toBeDefined();
				expect(link.target).toBeDefined();
			}
		});

		it("should detect broken links using component collaboration", async () => {
			// Given: Factory-created validator with real dependencies
			const validator = createCitationValidator();
			const testFile = join(fixturesDir, "broken-links.md");

			// When: Validator processes broken-links.md fixture
			const result = await validator.validateFile(testFile);

			// Then: Component collaboration detects errors
			expect(result.summary.total).toBeGreaterThan(0);
			expect(result.summary.errors).toBeGreaterThan(0);
			// Verify that errors are properly detected in enriched links
			const errorLinks = result.links.filter((link) => link.validation.status === "error");
			expect(errorLinks.length).toBe(result.summary.errors);
			// Verify error messages are populated
			for (const errorLink of errorLinks) {
				expect(errorLink.validation.error).toBeDefined();
				expect(typeof errorLink.validation.error).toBe("string");
			}
		});

		it("should validate citations with cache-assisted resolution", async () => {
			// Given: Validator with file cache built for fixtures directory
			const validator = createCitationValidator();
			const testFile = join(fixturesDir, "scope-test.md");

			// When: Validating scope-test.md using cache for resolution
			const result = await validator.validateFile(testFile);

			// Then: Cache-assisted validation succeeds
			expect(result.summary.total).toBeGreaterThan(0);
			// Verify cache can resolve valid citations
			const validLinks = result.links.filter(
				(link) => link.validation.status === "valid" || link.validation.status === "warning",
			);
			expect(validLinks.length).toBeGreaterThan(0);
			// Verify component collaboration through enriched link structure
			for (const link of result.links) {
				expect(link).toHaveProperty("line");
				expect(link).toHaveProperty("target");
				expect(link).toHaveProperty("validation");
				expect(link.validation).toHaveProperty("status");
				expect(link).toHaveProperty("linkType");
				expect(link).toHaveProperty("scope");
			}
		});
	});
});
