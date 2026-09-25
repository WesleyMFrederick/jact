import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createCitationHarness } from "../helpers/workflow-harness.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturesDir = join(__dirname, "..", "fixtures");

/**
 * A link resolves to its heading when it is valid, or when the only problem is
 * that its anchor keeps characters Obsidian drops (`: # | ^ [ ]`).
 */
function expectResolvesToHeading(link) {
	if (link.validation.status === "valid") return;
	expect(link.validation.error).toMatch(
		/^Anchor uses characters Obsidian drops/,
	);
}

describe("Internal links with backticks in anchor IDs (Issue #27)", () => {
	it("should resolve every internal link in backtick-anchors fixture to its heading", async () => {
		const { validateDocumentFile } = createCitationHarness();
		const testFile = join(fixturesDir, "backtick-anchors.md");

		const result = await validateDocumentFile(testFile);

		expect(result.summary.total).toBeGreaterThan(0);

		// Every link references an existing heading
		for (const link of result.links) {
			expectResolvesToHeading(link);
		}
	});

	it("should not produce duplicate links from regex fallback when token parser succeeds", async () => {
		const { validateDocumentFile } = createCitationHarness();
		const testFile = join(fixturesDir, "backtick-anchors.md");

		const result = await validateDocumentFile(testFile);

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
		const { validateDocumentFile } = createCitationHarness();
		const testFile = join(fixturesDir, "backtick-anchors.md");

		const result = await validateDocumentFile(testFile);

		// Find the nested parens links referencing transform heading
		const nestedParenLinks = result.links.filter(
			(link) => link.target.anchor && link.target.anchor.includes("transform"),
		);

		expect(nestedParenLinks.length).toBeGreaterThanOrEqual(2);

		for (const link of nestedParenLinks) {
			expectResolvesToHeading(link);
		}
	});

	it("should match URL-encoded backtick anchors to heading targets", async () => {
		const { validateDocumentFile } = createCitationHarness();
		const testFile = join(fixturesDir, "backtick-anchors.md");

		const result = await validateDocumentFile(testFile);

		// Find links with URL-encoded anchors containing backticks
		const backtickLinks = result.links.filter(
			(link) => link.target.anchor && link.target.anchor.includes("`"),
		);

		expect(backtickLinks.length).toBeGreaterThanOrEqual(1);

		for (const link of backtickLinks) {
			expectResolvesToHeading(link);
		}
	});

	it("should match anchors with %28/%29 encoded parentheses", async () => {
		const { validateDocumentFile } = createCitationHarness();
		const testFile = join(fixturesDir, "backtick-anchors.md");

		const result = await validateDocumentFile(testFile);

		// Find links with %28/%29 encoded parens
		const encodedParenLinks = result.links.filter(
			(link) =>
				link.target.anchor &&
				(link.target.anchor.includes("%28") ||
					link.target.anchor.includes("%29")),
		);

		expect(encodedParenLinks.length).toBeGreaterThanOrEqual(2);

		for (const link of encodedParenLinks) {
			expectResolvesToHeading(link);
		}
	});

	it("should handle unencoded special chars in internal anchor links", async () => {
		const { validateDocumentFile } = createCitationHarness();
		const testFile = join(fixturesDir, "backtick-anchors.md");

		const result = await validateDocumentFile(testFile);

		// Find links with unencoded colons (raw method signatures)
		const unencodedLinks = result.links.filter(
			(link) =>
				link.target.anchor &&
				link.target.anchor.includes(":") &&
				!link.target.anchor.includes("%"),
		);

		expect(unencodedLinks.length).toBeGreaterThanOrEqual(1);

		for (const link of unencodedLinks) {
			expectResolvesToHeading(link);
		}
	});
});
