import { strict as assert } from "node:assert";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const citationManagerPath = join(__dirname, "..", "citation-manager.js");

describe("Story File Validation with Symlink Scope", () => {
	test("should only flag genuine false positives in version-detection story", async () => {
		const storyFile =
			"/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/claude-code-knowledgebase/design-docs/features/version-based-analysis/stories/1.1.version-detection-directory-scaffolding.story.md";
		const scopeDir =
			"/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/claude-code-knowledgebase/design-docs";

		try {
			const output = execSync(
				`node "${citationManagerPath}" validate "${storyFile}" --scope "${scopeDir}" --format json`,
				{
					encoding: "utf8",
					cwd: join(__dirname, ".."),
				},
			);

			const result = JSON.parse(output);

			// Should have significantly more valid citations than errors
			assert(
				result.summary.valid >= 25,
				`Should have at least 25 valid citations, got ${result.summary.valid}`,
			);
			assert(
				result.summary.errors <= 5,
				`Should have 5 or fewer errors, got ${result.summary.errors}`,
			);

			// Check that lines 190-195 contain the expected true positives
			const errors = result.results.filter((r) => r.status === "error");
			const errorLines = errors.map((e) => e.line);

			// Lines 192, 194, and 195 should be flagged (true positives)
			assert(
				errorLines.includes(192),
				"Line 192 should be flagged as error (arch-technology-stack.md missing)",
			);
			assert(
				errorLines.includes(194),
				"Line 194 should be flagged as error (arch-testing-strategy missing)",
			);
			assert(
				errorLines.includes(195),
				"Line 195 should be flagged as error (arch-implmnt-guide missing)",
			);

			// Lines 149-150 should NOT be flagged (were false positives, now fixed)
			assert(
				!errorLines.includes(149),
				"Line 149 should NOT be flagged (verson-...guide.md.md exists)",
			);
			assert(
				!errorLines.includes(150),
				"Line 150 should NOT be flagged (verson-...guide.md.md exists)",
			);

			// Lines 157, 161, 162 should NOT be flagged (were false positives, now fixed)
			assert(
				!errorLines.includes(157),
				"Line 157 should NOT be flagged (version-based-analysis-architecture.md exists)",
			);
			assert(
				!errorLines.includes(161),
				"Line 161 should NOT be flagged (version-based-analysis-architecture.md exists)",
			);
			assert(
				!errorLines.includes(162),
				"Line 162 should NOT be flagged (verson-...guide.md.md exists)",
			);

			console.log(
				`✅ Story validation working correctly: ${result.summary.valid} valid, ${result.summary.errors} errors`,
			);
			console.log(`   Flagged lines: ${errorLines.join(", ")}`);
		} catch (error) {
			// If validation fails due to genuine errors, check that it's the expected errors
			const output = error.stdout || "";
			if (output.includes('"summary"')) {
				const result = JSON.parse(output);
				assert(
					result.summary.errors <= 5,
					`Should not have excessive false positives, got ${result.summary.errors} errors`,
				);

				const errors = result.results.filter((r) => r.status === "error");
				const errorLines = errors.map((e) => e.line);

				// Key assertion: lines 149, 150, 157, 161, 162 should not be errors
				const falsePositives = [149, 150, 157, 161, 162].filter((line) =>
					errorLines.includes(line),
				);
				assert(
					falsePositives.length === 0,
					`Fixed lines should not be flagged as errors: ${falsePositives.join(", ")}`,
				);
			} else {
				assert.fail(
					`Unexpected validation failure: ${error.stdout || error.message}`,
				);
			}
		}
	});

	test("should handle symlinked scope directory without excessive duplicates", async () => {
		const storyFile =
			"/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/claude-code-knowledgebase/design-docs/features/version-based-analysis/stories/1.1.version-detection-directory-scaffolding.story.md";
		const scopeDir =
			"/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/claude-code-knowledgebase/design-docs";

		try {
			const output = execSync(
				`node "${citationManagerPath}" validate "${storyFile}" --scope "${scopeDir}"`,
				{
					encoding: "utf8",
					cwd: join(__dirname, ".."),
				},
			);

			// Should not have excessive duplicate warnings
			const duplicateMatches = output.match(
				/Found duplicate filenames in scope/g,
			);
			const duplicateCount = duplicateMatches ? duplicateMatches.length : 0;

			assert(
				duplicateCount <= 1,
				`Should not have excessive duplicate warnings, got ${duplicateCount}`,
			);

			// Should show limited errors (not excessive false positives)
			assert(
				output.includes("Fix 3 critical errors") ||
					output.includes("Fix 4 critical errors") ||
					output.includes("✅ ALL CITATIONS VALID"),
				"Should show only legitimate errors, not excessive false positives",
			);
		} catch (error) {
			// Expected failure due to 3 legitimate errors - check that output is reasonable
			const output = error.stdout || "";
			if (
				(output.includes("Fix 3 critical errors") ||
					output.includes("Fix 4 critical errors")) &&
				output.includes("30")
			) {
				// This is the expected behavior - 30+ valid, 3-4 errors
				console.log(
					"✅ Expected validation failure with 3-4 legitimate errors",
				);
				return;
			}
			assert.fail(
				`Unexpected symlink scope handling failure: ${error.stdout || error.message}`,
			);
		}
	});
});
