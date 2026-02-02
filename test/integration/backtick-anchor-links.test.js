import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createCitationValidator } from "../../src/factories/componentFactory.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturesDir = join(__dirname, "..", "fixtures");

describe("Internal links with backticks in anchor IDs (Issue #27)", () => {
	it("should validate all internal links in backtick-anchors fixture without errors", async () => {
		const validator = createCitationValidator();
		const testFile = join(fixturesDir, "backtick-anchors.md");

		const result = await validator.validateFile(testFile);

		expect(result.summary.total).toBeGreaterThan(0);

		// No link should have validation errors - all reference valid headings
		const errorLinks = result.links.filter(
			(link) => link.validation.status === "error",
		);

		expect(errorLinks).toEqual([]);
	});

	it("should not produce duplicate links from regex fallback when token parser succeeds", async () => {
		const validator = createCitationValidator();
		const testFile = join(fixturesDir, "backtick-anchors.md");

		const result = await validator.validateFile(testFile);

		// Count links per line - no line should have more than one extracted link
		const linksByLine = new Map();
		for (const link of result.links) {
			if (!linksByLine.has(link.line)) {
				linksByLine.set(link.line, []);
			}
			linksByLine.get(link.line).push(link);
		}

		for (const [line, links] of linksByLine) {
			expect(links.length).toBe(1);
		}
	});

	it("should correctly extract anchors with nested parentheses", async () => {
		const validator = createCitationValidator();
		const testFile = join(fixturesDir, "backtick-anchors.md");

		const result = await validator.validateFile(testFile);

		// Find the nested parens links referencing transform heading
		const nestedParenLinks = result.links.filter(
			(link) =>
				link.target.anchor &&
				link.target.anchor.includes("transform"),
		);

		expect(nestedParenLinks.length).toBeGreaterThanOrEqual(2);

		for (const link of nestedParenLinks) {
			expect(link.validation.status).toBe("valid");
		}
	});

	it("should match URL-encoded backtick anchors to heading targets", async () => {
		const validator = createCitationValidator();
		const testFile = join(fixturesDir, "backtick-anchors.md");

		const result = await validator.validateFile(testFile);

		// Find links with URL-encoded anchors containing backticks
		const backtickLinks = result.links.filter(
			(link) =>
				link.target.anchor &&
				link.target.anchor.includes("`"),
		);

		expect(backtickLinks.length).toBeGreaterThanOrEqual(1);

		for (const link of backtickLinks) {
			expect(link.validation.status).toBe("valid");
		}
	});

	it("should match anchors with %28/%29 encoded parentheses", async () => {
		const validator = createCitationValidator();
		const testFile = join(fixturesDir, "backtick-anchors.md");

		const result = await validator.validateFile(testFile);

		// Find links with %28/%29 encoded parens
		const encodedParenLinks = result.links.filter(
			(link) =>
				link.target.anchor &&
				(link.target.anchor.includes("%28") || link.target.anchor.includes("%29")),
		);

		expect(encodedParenLinks.length).toBeGreaterThanOrEqual(2);

		for (const link of encodedParenLinks) {
			expect(link.validation.status).toBe("valid");
		}
	});

	it("should handle unencoded special chars in internal anchor links", async () => {
		const validator = createCitationValidator();
		const testFile = join(fixturesDir, "backtick-anchors.md");

		const result = await validator.validateFile(testFile);

		// Find links with unencoded colons (raw method signatures)
		const unencodedLinks = result.links.filter(
			(link) =>
				link.target.anchor &&
				link.target.anchor.includes(":") &&
				!link.target.anchor.includes("%"),
		);

		expect(unencodedLinks.length).toBeGreaterThanOrEqual(1);

		for (const link of unencodedLinks) {
			expect(link.validation.status).toBe("valid");
		}
	});
});
