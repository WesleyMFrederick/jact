import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createCitationValidator } from "../../src/factories/componentFactory.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturesDir = join(__dirname, "..", "fixtures");

describe("CitationValidator Anchor Matching with Dual IDs", () => {
	it("should match anchor using raw ID format", async () => {
		// Given: Validator with test fixture containing header "Story 1.5: Implement Cache"
		const validator = createCitationValidator();
		const testFile = join(fixturesDir, "anchor-matching-source.md");

		// When: Validate link using RAW format: #Story 1.5: Implement Cache
		const result = await validator.validateFile(testFile);

		// Then: Validation succeeds (finds anchor by id field)
		const linkResult = result.results.find(
			(r) =>
				r.citation ===
				"[Link using raw format](anchor-matching.md#Story 1.5: Implement Cache)",
		);
		expect(linkResult).toBeDefined();
		expect(linkResult.status).toBe("valid");
	});

	it("should match anchor using URL-encoded ID format", async () => {
		// Given: Same fixture with "Story 1.5: Implement Cache" header
		const validator = createCitationValidator();
		const testFile = join(fixturesDir, "anchor-matching-source.md");

		// When: Validate link using URL-ENCODED format: #Story%201.5%20Implement%20Cache
		const result = await validator.validateFile(testFile);

		// Then: Validation succeeds (finds anchor by urlEncodedId field)
		const linkResult = result.results.find(
			(r) =>
				r.citation ===
				"[Link using URL-encoded format](anchor-matching.md#Story%201.5%20Implement%20Cache)",
		);
		expect(linkResult).toBeDefined();
		expect(linkResult.status).toBe("valid");
	});

	it("should match both ID formats to same anchor object", async () => {
		// Given: Fixture with header "Story 1.5: Implement Cache"
		const validator = createCitationValidator();
		const testFile = join(fixturesDir, "anchor-matching-source.md");

		// When: Validate both raw and encoded formats
		const result = await validator.validateFile(testFile);

		// Then: Both succeed (both match SAME underlying anchor)
		const rawResult = result.results.find(
			(r) =>
				r.citation ===
				"[Link using raw format](anchor-matching.md#Story 1.5: Implement Cache)",
		);
		const encodedResult = result.results.find(
			(r) =>
				r.citation ===
				"[Link using URL-encoded format](anchor-matching.md#Story%201.5%20Implement%20Cache)",
		);

		expect(rawResult).toBeDefined();
		expect(rawResult.status).toBe("valid");
		expect(encodedResult).toBeDefined();
		expect(encodedResult.status).toBe("valid");
		// Both should reference same anchor object in parsed data
	});

	it("should fail validation when anchor not found in either ID field", async () => {
		// Given: Validator with fixture
		const validator = createCitationValidator();
		const testFile = join(fixturesDir, "anchor-matching-source.md");

		// When: Validate link to non-existent anchor
		const result = await validator.validateFile(testFile);

		// Then: Validation fails with suggestions
		const linkResult = result.results.find(
			(r) =>
				r.citation ===
				"[Link to non-existent anchor](anchor-matching.md#NonExistent)",
		);
		expect(linkResult).toBeDefined();
		expect(linkResult.status).toBe("error");
		expect(linkResult.error).toContain("Anchor not found");
	});
});
