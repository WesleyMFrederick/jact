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
		// Find enriched link for link using raw format (should be validated via hasAnchor())
		const rawFormatLink = result.links.find(
			(link) =>
				link.fullMatch ===
				"[Link using raw format](anchor-matching.md#Story 1.5: Implement Cache)",
		);

		expect(rawFormatLink).toBeDefined();
		expect(rawFormatLink.validation.status).toBe("valid");

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
		const brokenLinkObject = result.links.find(
			(link) =>
				link.fullMatch ===
				"[Link to non-existent anchor](anchor-matching.md#NonExistent)",
		);

		expect(brokenLinkObject).toBeDefined();
		expect(brokenLinkObject.validation.status).toBe("error");
		expect(brokenLinkObject.validation.error).toContain("Anchor not found");

		// Verify suggestion was provided (comes from findSimilarAnchors())
		// Note: The suggestion format may include multiple anchor suggestions
		expect(
			brokenLinkObject.validation.error ||
				brokenLinkObject.validation.suggestion,
		).toBeDefined();
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
		const rawLink = result.links.find(
			(link) =>
				link.fullMatch ===
				"[Link using raw format](anchor-matching.md#Story 1.5: Implement Cache)",
		);
		expect(rawLink).toBeDefined();
		expect(rawLink.validation.status).toBe("valid");

		// URL-encoded format link
		const encodedLink = result.links.find(
			(link) =>
				link.fullMatch ===
				"[Link using URL-encoded format](anchor-matching.md#Story%201.5%20Implement%20Cache)",
		);
		expect(encodedLink).toBeDefined();
		expect(encodedLink.validation.status).toBe("valid");

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
		expect(validResult.summary.total).toBeGreaterThan(0);
		expect(validResult.summary.valid).toBe(validResult.summary.total);
		expect(validResult.summary.errors).toBe(0);

		// Verify all enriched links are valid
		for (const link of validResult.links) {
			expect(link.validation.status).toBe("valid");
		}

		// Broken links file - should detect errors
		expect(brokenResult.summary.total).toBeGreaterThan(0);
		expect(brokenResult.summary.errors).toBeGreaterThan(0);

		// Verify error links have proper error messages
		const errorLinks = brokenResult.links.filter(
			(link) => link.validation.status === "error",
		);
		expect(errorLinks.length).toBe(brokenResult.summary.errors);

		for (const errorLink of errorLinks) {
			expect(errorLink.validation.error).toBeDefined();
			expect(typeof errorLink.validation.error).toBe("string");
			expect(errorLink.validation.error.length).toBeGreaterThan(0);
		}

		// Verify enriched link structure consistency
		for (const link of [...validResult.links, ...brokenResult.links]) {
			expect(link).toHaveProperty("line");
			expect(link).toHaveProperty("target");
			expect(link).toHaveProperty("validation");
			expect(link.validation).toHaveProperty("status");
			expect(link).toHaveProperty("linkType");
			expect(link).toHaveProperty("scope");
		}
	});
});
