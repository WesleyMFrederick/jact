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
		const linkObject = result.links.find(
			(link) =>
				link.fullMatch ===
				"[Link using raw format](anchor-matching.md#Story 1.5: Implement Cache)",
		);
		expect(linkObject).toBeDefined();
		expect(linkObject.validation.status).toBe("valid");
	});

	it("should match anchor using URL-encoded ID format", async () => {
		// Given: Same fixture with "Story 1.5: Implement Cache" header
		const validator = createCitationValidator();
		const testFile = join(fixturesDir, "anchor-matching-source.md");

		// When: Validate link using URL-ENCODED format: #Story%201.5%20Implement%20Cache
		const result = await validator.validateFile(testFile);

		// Then: Validation succeeds (finds anchor by urlEncodedId field)
		const linkObject = result.links.find(
			(link) =>
				link.fullMatch ===
				"[Link using URL-encoded format](anchor-matching.md#Story%201.5%20Implement%20Cache)",
		);
		expect(linkObject).toBeDefined();
		expect(linkObject.validation.status).toBe("valid");
	});

	it("should match both ID formats to same anchor object", async () => {
		// Given: Fixture with header "Story 1.5: Implement Cache"
		const validator = createCitationValidator();
		const testFile = join(fixturesDir, "anchor-matching-source.md");

		// When: Validate both raw and encoded formats
		const result = await validator.validateFile(testFile);

		// Then: Both succeed (both match SAME underlying anchor)
		const rawLink = result.links.find(
			(link) =>
				link.fullMatch ===
				"[Link using raw format](anchor-matching.md#Story 1.5: Implement Cache)",
		);
		const encodedLink = result.links.find(
			(link) =>
				link.fullMatch ===
				"[Link using URL-encoded format](anchor-matching.md#Story%201.5%20Implement%20Cache)",
		);

		expect(rawLink).toBeDefined();
		expect(rawLink.validation.status).toBe("valid");
		expect(encodedLink).toBeDefined();
		expect(encodedLink.validation.status).toBe("valid");
		// Both should reference same anchor object in parsed data
	});

	it("should fail validation when anchor not found in either ID field", async () => {
		// Given: Validator with fixture
		const validator = createCitationValidator();
		const testFile = join(fixturesDir, "anchor-matching-source.md");

		// When: Validate link to non-existent anchor
		const result = await validator.validateFile(testFile);

		// Then: Validation fails with suggestions
		const linkObject = result.links.find(
			(link) =>
				link.fullMatch ===
				"[Link to non-existent anchor](anchor-matching.md#NonExistent)",
		);
		expect(linkObject).toBeDefined();
		expect(linkObject.validation.status).toBe("error");
		expect(linkObject.validation.error).toContain("Anchor not found");
	});
});

describe("CitationValidator Issue #100 - cleanMarkdownForComparison false positives", () => {
	it("should accept colon-in-heading anchor where colon encodes as space (Bug 1)", async () => {
		// Given: Heading "TRACE: LLM ... (opsx:continue)" in target file
		// Link uses Obsidian encoding: colon → space → #TRACE%20LLM%20...%20(opsx%20continue)
		const validator = createCitationValidator();
		const testFile = join(fixturesDir, "issue-100-source.md");

		// When: Validate the file
		const result = await validator.validateFile(testFile);

		// Then: The colon-in-heading link resolves as valid (not a false positive)
		const linkObject = result.links.find(
			(link) =>
				link.fullMatch ===
				"[Colon in heading - opsx continue](issue-100-colon-heading.md#TRACE%20LLM%20...%20(opsx%20continue))",
		);
		expect(linkObject).toBeDefined();
		expect(linkObject.validation.status).toBe("valid");
	});

	it("should accept backtick-in-heading anchor with URL-encoded characters (Issue #27)", async () => {
		// Given: Heading "`hasAnchor(anchorId: string): boolean`" in target file
		// Link uses URL-encoded backticks and spaces
		const validator = createCitationValidator();
		const testFile = join(fixturesDir, "issue-100-source.md");

		// When: Validate the file
		const result = await validator.validateFile(testFile);

		// Then: The backtick-in-heading link resolves as valid
		const linkObject = result.links.find(
			(link) =>
				link.fullMatch ===
				"[**`hasAnchor(anchorId: string): boolean`**](issue-27-backtick-heading.md#%60hasAnchor(anchorId%20string)%20boolean%60)",
		);
		expect(linkObject).toBeDefined();
		expect(linkObject.validation.status).toBe("valid");
	});

	it("should accept block anchor reference with correct caret format", async () => {
		// Given: Target file has ^decision-observe-jq block anchor
		// Link uses correct caret format: #^decision-observe-jq
		const validator = createCitationValidator();
		const testFile = join(fixturesDir, "issue-81-block-anchor-source.md");

		// When: Validate the file
		const result = await validator.validateFile(testFile);

		// Then: Links with caret (#^decision-observe-jq) are valid
		const validLink = result.links.find(
			(link) =>
				link.fullMatch ===
				"[D1](issue-81-block-anchor-target.md#^decision-observe-jq)",
		);
		expect(validLink).toBeDefined();
		expect(validLink.validation.status).toBe("valid");
	});

	it("should warn when #anchor used but ^anchor block reference exists (Issue #81)", async () => {
		// Given: Target file has ^decision-observe-jq block anchor
		// Link MISSING caret: #decision-observe-jq (should be #^decision-observe-jq)
		const validator = createCitationValidator();
		const testFile = join(fixturesDir, "issue-81-block-anchor-source.md");

		// When: Validate the file
		const result = await validator.validateFile(testFile);

		// Then: Links without caret should warn/error about missing caret
		const missingCaretLink = result.links.find(
			(link) =>
				link.fullMatch ===
				"[D1](issue-81-block-anchor-target.md#decision-observe-jq)",
		);
		expect(missingCaretLink).toBeDefined();
		expect(missingCaretLink.validation.status).toBe("warning");
		expect(missingCaretLink.validation.suggestion).toContain(
			"#^decision-observe-jq",
		);
	});

	it("should warn for all cross-document links missing caret when block anchor exists (Issue #81)", async () => {
		// Given: Multiple cross-document links missing caret format
		const validator = createCitationValidator();
		const testFile = join(fixturesDir, "issue-81-block-anchor-source.md");

		// When: Validate the file
		const result = await validator.validateFile(testFile);

		// Then: Both missing-caret cross-document links should warn
		const missingCaretLinks = result.links.filter(
			(link) =>
				link.scope === "cross-document" &&
				link.validation.status === "warning" &&
				link.validation.suggestion?.includes("#^"),
		);
		expect(missingCaretLinks.length).toBe(2);
	});

	it("should accept backslash-encoded bracket anchor where %5C maps to backslash (Bug 2)", async () => {
		// Given: Heading "**[M-002]** Tag distribution" in target file
		// Link uses %5C (backslash) encoding: #**%5CM-002%5C]**%20Tag%20distribution
		const validator = createCitationValidator();
		const testFile = join(fixturesDir, "issue-100-source.md");

		// When: Validate the file
		const result = await validator.validateFile(testFile);

		// Then: The backslash-bracket link resolves as valid (not a false positive)
		const linkObject = result.links.find(
			(link) =>
				link.fullMatch ===
				"[Backslash bracket M-002](issue-100-backslash-bracket-heading.md#**%5CM-002%5C]**%20Tag%20distribution)",
		);
		expect(linkObject).toBeDefined();
		expect(linkObject.validation.status).toBe("valid");
	});
});
