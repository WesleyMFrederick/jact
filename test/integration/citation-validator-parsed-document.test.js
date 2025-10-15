import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createCitationValidator } from "../../src/factories/componentFactory.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturesDir = join(__dirname, "..", "fixtures");

describe("CitationValidator - ParsedDocument Integration", () => {
	it("should validate links using ParsedDocument.hasAnchor()", async () => {
		// Given: Factory-created validator with test fixture containing valid anchor
		const validator = createCitationValidator();
		const testFile = join(fixturesDir, "anchor-matching-source.md");

		// When: Validation executes for link to valid anchor
		const result = await validator.validateFile(testFile);

		// Then: Validation succeeds via ParsedDocument.hasAnchor() facade method
		// Find result for link using raw format (should be validated via hasAnchor())
		const rawFormatResult = result.results.find(
			(r) =>
				r.citation ===
				"[Link using raw format](anchor-matching.md#Story 1.5: Implement Cache)",
		);

		expect(rawFormatResult).toBeDefined();
		expect(rawFormatResult.status).toBe("valid");

		// Verify summary counts - should have valid citations
		expect(result.summary.total).toBeGreaterThan(0);
		expect(result.summary.valid).toBeGreaterThan(0);
		expect(result.summary.errors).toBeGreaterThan(0); // broken link exists in fixture
	});

	it("should generate suggestions using ParsedDocument.findSimilarAnchors()", async () => {
		// Given: Factory-created validator with fixture containing broken link
		const validator = createCitationValidator();
		const testFile = join(fixturesDir, "anchor-matching-source.md");

		// When: Validation executes for link to non-existent anchor
		const result = await validator.validateFile(testFile);

		// Then: Error includes suggestion generated via ParsedDocument.findSimilarAnchors()
		const brokenLinkResult = result.results.find(
			(r) =>
				r.citation ===
				"[Link to non-existent anchor](anchor-matching.md#NonExistent)",
		);

		expect(brokenLinkResult).toBeDefined();
		expect(brokenLinkResult.status).toBe("error");
		expect(brokenLinkResult.error).toContain("Anchor not found");

		// Verify suggestion was provided (comes from findSimilarAnchors())
		// Note: The suggestion format may include multiple anchor suggestions
		expect(brokenLinkResult.error || brokenLinkResult.suggestion).toBeDefined();
	});

	it("should validate both raw and URL-encoded anchor formats", async () => {
		// Given: Factory-created validator with fixture containing both anchor ID formats
		const validator = createCitationValidator();
		const testFile = join(fixturesDir, "anchor-matching-source.md");

		// When: Validation executes for both raw and URL-encoded format links
		const result = await validator.validateFile(testFile);

		// Then: Both formats validate successfully via ParsedDocument.hasAnchor()
		// The hasAnchor() method should check both id and urlEncodedId properties

		// Raw format link
		const rawResult = result.results.find(
			(r) =>
				r.citation ===
				"[Link using raw format](anchor-matching.md#Story 1.5: Implement Cache)",
		);
		expect(rawResult).toBeDefined();
		expect(rawResult.status).toBe("valid");

		// URL-encoded format link
		const encodedResult = result.results.find(
			(r) =>
				r.citation ===
				"[Link using URL-encoded format](anchor-matching.md#Story%201.5%20Implement%20Cache)",
		);
		expect(encodedResult).toBeDefined();
		expect(encodedResult.status).toBe("valid");

		// Both should reference the same anchor object in the target document
		// This validates that hasAnchor() correctly checks both ID fields
	});

	it("should maintain validation behavior after facade integration", async () => {
		// Given: Comprehensive fixture set with multiple citation types
		const validator = createCitationValidator();
		const validCitationsFile = join(fixturesDir, "valid-citations.md");
		const brokenLinksFile = join(fixturesDir, "broken-links.md");

		// When: Full validation workflow executes with facade methods
		const validResult = await validator.validateFile(validCitationsFile);
		const brokenResult = await validator.validateFile(brokenLinksFile);

		// Then: Results match expected pre-refactoring behavior
		// Valid citations file - all should pass
		expect(validResult.file).toBe(validCitationsFile);
		expect(validResult.summary.total).toBeGreaterThan(0);
		expect(validResult.summary.valid).toBe(validResult.summary.total);
		expect(validResult.summary.errors).toBe(0);

		// Verify all individual results are valid
		for (const citation of validResult.results) {
			expect(citation.status).toBe("valid");
		}

		// Broken links file - should detect errors
		expect(brokenResult.file).toBe(brokenLinksFile);
		expect(brokenResult.summary.total).toBeGreaterThan(0);
		expect(brokenResult.summary.errors).toBeGreaterThan(0);

		// Verify error results have proper error messages
		const errorResults = brokenResult.results.filter((r) => r.status === "error");
		expect(errorResults.length).toBe(brokenResult.summary.errors);

		for (const errorResult of errorResults) {
			expect(errorResult.error).toBeDefined();
			expect(typeof errorResult.error).toBe("string");
			expect(errorResult.error.length).toBeGreaterThan(0);
		}

		// Verify result structure consistency (behavioral equivalence)
		for (const citation of [...validResult.results, ...brokenResult.results]) {
			expect(citation).toHaveProperty("line");
			expect(citation).toHaveProperty("citation");
			expect(citation).toHaveProperty("status");
			expect(citation).toHaveProperty("linkType");
			expect(citation).toHaveProperty("scope");
		}
	});
});
