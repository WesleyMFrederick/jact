import { strict as assert } from "node:assert";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const citationManagerPath = join(__dirname, "..", "citation-manager.js");

describe("Enhanced Citation Pattern Tests", () => {
	test("should detect all citation patterns including cite format and links without anchors", async () => {
		const testFile = join(__dirname, "fixtures", "enhanced-citations.md");

		let output;
		try {
			output = execSync(
				`node "${citationManagerPath}" validate "${testFile}" --format json`,
				{
					encoding: "utf8",
					cwd: __dirname,
				},
			);
		} catch (error) {
			// Validation may fail due to missing files, but we still get JSON output
			output = error.stdout;
		}

		const result = JSON.parse(output);

		// Should find all citations (some will have validation errors due to missing files, but parsing should work)
		assert(
			result.summary.total >= 10,
			`Expected at least 10 citations, found ${result.summary.total}`,
		);

		// Check for specific citation types
		const citations = result.results;

		// Should find cross-document links with anchors
		const withAnchors = citations.filter(
			(c) =>
				c.type === "cross-document" && c.citation.includes("#auth-service"),
		);
		assert(withAnchors.length > 0, "Should find links with anchors");

		// Should find cross-document links without anchors
		const withoutAnchors = citations.filter(
			(c) =>
				c.type === "cross-document" &&
				(c.citation.includes("test-target.md)") ||
					c.citation.includes("another-file.md)") ||
					c.citation.includes("setup-guide.md)")) &&
				!c.citation.includes("#"),
		);
		assert(withoutAnchors.length > 0, "Should find links without anchors");

		// Should find cite format
		const citeFormat = citations.filter((c) => c.citation.includes("[cite:"));
		assert(
			citeFormat.length >= 3,
			`Expected at least 3 cite format links, found ${citeFormat.length}`,
		);

		// Should find caret references
		const caretRefs = citations.filter((c) => c.type === "caret-reference");
		assert(
			caretRefs.length >= 2,
			`Expected at least 2 caret references, found ${caretRefs.length}`,
		);
	});

	test("should extract all base paths from enhanced citation file", async () => {
		const testFile = join(__dirname, "fixtures", "enhanced-citations.md");

		try {
			const output = execSync(
				`node "${citationManagerPath}" base-paths "${testFile}" --format json`,
				{
					encoding: "utf8",
					cwd: __dirname,
				},
			);

			const result = JSON.parse(output);

			// Should extract multiple base paths
			assert(
				result.count >= 6,
				`Expected at least 6 base paths, found ${result.count}`,
			);

			// Should include standard markdown links
			const hasTestTarget = result.basePaths.some((path) =>
				path.includes("test-target.md"),
			);
			assert(
				hasTestTarget,
				"Should include test-target.md from standard links",
			);

			// Should include cite format paths
			const hasDesignPrinciples = result.basePaths.some((path) =>
				path.includes("design-principles.md"),
			);
			assert(
				hasDesignPrinciples,
				"Should include design-principles.md from cite format",
			);

			// Should include relative paths from cite format
			const hasArchitecturePatterns = result.basePaths.some((path) =>
				path.includes("patterns.md"),
			);
			assert(
				hasArchitecturePatterns,
				"Should include patterns.md from relative cite format",
			);
		} catch (error) {
			if (error.status !== 0) {
				console.log("STDOUT:", error.stdout);
				console.log("STDERR:", error.stderr);
			}
			assert.fail(`Base paths extraction failed: ${error.message}`);
		}
	});

	test("should handle mixed citation patterns on same line", async () => {
		const testFile = join(__dirname, "fixtures", "enhanced-citations.md");

		let output;
		try {
			output = execSync(
				`node "${citationManagerPath}" validate "${testFile}" --format json`,
				{
					encoding: "utf8",
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
		assert(
			mixedLineCitations.length >= 2,
			`Expected at least 2 citations on mixed content line, found ${mixedLineCitations.length}`,
		);

		// Should include both pattern types
		const hasStandardLink = mixedLineCitations.some(
			(c) =>
				c.citation.includes("[Standard Link](") && c.type === "cross-document",
		);
		const hasCiteFormat = mixedLineCitations.some(
			(c) => c.citation.includes("[cite:") && c.type === "cross-document",
		);

		assert(hasStandardLink, "Should detect standard link in mixed content");
		assert(hasCiteFormat, "Should detect cite format in mixed content");
	});

	test("should detect and validate wiki-style cross-document links", async () => {
		const testFile = join(__dirname, "fixtures", "wiki-cross-doc.md");

		let output;
		try {
			output = execSync(
				`node "${citationManagerPath}" validate "${testFile}" --format json`,
				{
					encoding: "utf8",
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
		assert(
			wikiCrossDoc.length > 0,
			`Expected wiki-style cross-document links, found ${wikiCrossDoc.length}`,
		);

		// Should validate file existence - valid links to test-target.md
		const validLinks = wikiCrossDoc.filter(
			(c) => c.status === "valid" && c.citation.includes("test-target.md"),
		);
		assert(
			validLinks.length > 0,
			`Expected valid links to test-target.md, found ${validLinks.length}`,
		);

		// Should catch broken file references
		const brokenFile = wikiCrossDoc.find((c) =>
			c.citation.includes("nonexistent.md"),
		);
		assert(brokenFile, "Should find broken file reference");
		assert.equal(
			brokenFile.status,
			"error",
			"Nonexistent file should have error status",
		);

		// Should catch directory references (isFile() validation)
		const dirReference = wikiCrossDoc.find((c) =>
			c.citation.includes("../fixtures"),
		);
		assert(dirReference, "Should find directory reference");
		assert.equal(
			dirReference.status,
			"error",
			"Directory reference should have error status",
		);
	});
});
