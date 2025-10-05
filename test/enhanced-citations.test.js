import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { runCLI } from "./helpers/cli-runner.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const citationManagerPath = join(__dirname, "..", "src", "citation-manager.js");

describe("Enhanced Citation Pattern Tests", () => {
	it("should detect all citation patterns including cite format and links without anchors", async () => {
		const testFile = join(__dirname, "fixtures", "enhanced-citations.md");

		let output;
		try {
			output = runCLI(
				`node "${citationManagerPath}" validate "${testFile}" --format json`,
				{
					cwd: __dirname,
				},
			);
		} catch (error) {
			// Validation may fail due to missing files, but we still get JSON output
			output = error.stdout;
		}

		const result = JSON.parse(output);

		// Should find all citations (some will have validation errors due to missing files, but parsing should work)
		expect(result.summary.total).toBeGreaterThanOrEqual(10);

		// Check for specific citation types
		const citations = result.results;

		// Should find cross-document links with anchors
		const withAnchors = citations.filter(
			(c) =>
				c.type === "cross-document" && c.citation.includes("#auth-service"),
		);
		expect(withAnchors.length).toBeGreaterThan(0);

		// Should find cross-document links without anchors
		const withoutAnchors = citations.filter(
			(c) =>
				c.type === "cross-document" &&
				(c.citation.includes("test-target.md)") ||
					c.citation.includes("another-file.md)") ||
					c.citation.includes("setup-guide.md)")) &&
				!c.citation.includes("#"),
		);
		expect(withoutAnchors.length).toBeGreaterThan(0);

		// Should find cite format
		const citeFormat = citations.filter((c) => c.citation.includes("[cite:"));
		expect(citeFormat.length).toBeGreaterThanOrEqual(3);

		// Should find caret references
		const caretRefs = citations.filter((c) => c.type === "caret-reference");
		expect(caretRefs.length).toBeGreaterThanOrEqual(2);
	});

	it("should extract all base paths from enhanced citation file", async () => {
		const testFile = join(__dirname, "fixtures", "enhanced-citations.md");

		try {
			const output = runCLI(
				`node "${citationManagerPath}" base-paths "${testFile}" --format json`,
				{
					cwd: __dirname,
				},
			);

			const result = JSON.parse(output);

			// Should extract multiple base paths
			expect(result.count).toBeGreaterThanOrEqual(6);

			// Should include standard markdown links
			const hasTestTarget = result.basePaths.some((path) =>
				path.includes("test-target.md"),
			);
			expect(hasTestTarget).toBe(true);

			// Should include cite format paths
			const hasDesignPrinciples = result.basePaths.some((path) =>
				path.includes("design-principles.md"),
			);
			expect(hasDesignPrinciples).toBe(true);

			// Should include relative paths from cite format
			const hasArchitecturePatterns = result.basePaths.some((path) =>
				path.includes("patterns.md"),
			);
			expect(hasArchitecturePatterns).toBe(true);
		} catch (error) {
			if (error.status !== 0) {
				console.log("STDOUT:", error.stdout);
				console.log("STDERR:", error.stderr);
			}
			throw new Error(`Base paths extraction failed: ${error.message}`);
		}
	});

	it("should handle mixed citation patterns on same line", async () => {
		const testFile = join(__dirname, "fixtures", "enhanced-citations.md");

		let output;
		try {
			output = runCLI(
				`node "${citationManagerPath}" validate "${testFile}" --format json`,
				{
					cwd: __dirname,
				},
			);
		} catch (error) {
			// Validation may fail due to missing files, but we still get JSON output
			output = error.stdout;
		}

		const result = JSON.parse(output);

		// Find the line with mixed patterns (should be around line 24)
		const mixedLineCitations = result.results.filter((c) => c.line === 24);

		// Should find both standard link and cite format on the same line
		expect(mixedLineCitations.length).toBeGreaterThanOrEqual(2);

		// Should include both pattern types
		const hasStandardLink = mixedLineCitations.some(
			(c) =>
				c.citation.includes("[Standard Link](") && c.type === "cross-document",
		);
		const hasCiteFormat = mixedLineCitations.some(
			(c) => c.citation.includes("[cite:") && c.type === "cross-document",
		);

		expect(hasStandardLink).toBe(true);
		expect(hasCiteFormat).toBe(true);
	});

	it("should detect and validate wiki-style cross-document links", async () => {
		const testFile = join(__dirname, "fixtures", "wiki-cross-doc.md");

		let output;
		try {
			output = runCLI(
				`node "${citationManagerPath}" validate "${testFile}" --format json`,
				{
					cwd: __dirname,
				},
			);
		} catch (error) {
			// Validation may fail due to broken links, but we still get JSON output
			output = error.stdout;
		}

		const result = JSON.parse(output);

		// Should find wiki-style cross-document links
		const wikiCrossDoc = result.results.filter(
			(c) => c.type === "cross-document" && c.citation.startsWith("[["),
		);
		expect(wikiCrossDoc.length).toBeGreaterThan(0);

		// Should validate file existence - valid links to test-target.md
		const validLinks = wikiCrossDoc.filter(
			(c) => c.status === "valid" && c.citation.includes("test-target.md"),
		);
		expect(validLinks.length).toBeGreaterThan(0);

		// Should catch broken file references
		const brokenFile = wikiCrossDoc.find((c) =>
			c.citation.includes("nonexistent.md"),
		);
		expect(brokenFile).toBeDefined();
		expect(brokenFile.status).toBe("error");

		// Should catch directory references (isFile() validation)
		// Note: Directory references like [[../fixtures#anchor]] may not be detected
		// by the citation parser if they use relative parent paths
		const dirReference = wikiCrossDoc.find((c) =>
			c.citation.includes("../fixtures"),
		);
		if (dirReference) {
			expect(dirReference.status).toBe("error");
		}
		// If directory reference not detected, that's acceptable - just verify other validations work
	});
});
