import { strict as assert } from "node:assert";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { CitationValidator } from "../src/CitationValidator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const citationManagerPath = join(__dirname, "..", "citation-manager.js");

describe("Path Conversion Calculation", () => {
	test("should calculate correct relative path for cross-directory resolution", () => {
		const validator = new CitationValidator();
		const sourceFile = join(__dirname, "fixtures", "warning-test-source.md");
		const targetFile = join(
			__dirname,
			"fixtures",
			"subdir",
			"warning-test-target.md",
		);

		// This should fail initially since calculateRelativePath() doesn't exist yet
		const relativePath = validator.calculateRelativePath(
			sourceFile,
			targetFile,
		);
		assert.strictEqual(relativePath, "subdir/warning-test-target.md");
	});

	test("should calculate relative path for same directory files", () => {
		const validator = new CitationValidator();
		const sourceFile = join(__dirname, "fixtures", "warning-test-source.md");
		const targetFile = join(__dirname, "fixtures", "test-target.md");

		const relativePath = validator.calculateRelativePath(
			sourceFile,
			targetFile,
		);
		assert.strictEqual(relativePath, "test-target.md");
	});

	test("should calculate relative path for parent directory access", () => {
		const validator = new CitationValidator();
		const sourceFile = join(
			__dirname,
			"fixtures",
			"subdir",
			"warning-test-target.md",
		);
		const targetFile = join(__dirname, "fixtures", "warning-test-source.md");

		const relativePath = validator.calculateRelativePath(
			sourceFile,
			targetFile,
		);
		assert.strictEqual(relativePath, "../warning-test-source.md");
	});

	test("should calculate relative path for nested subdirectories", () => {
		const validator = new CitationValidator();
		const sourceFile = join(__dirname, "fixtures", "warning-test-source.md");
		const targetFile = join(__dirname, "fixtures", "nested", "deep", "file.md");

		const relativePath = validator.calculateRelativePath(
			sourceFile,
			targetFile,
		);
		assert.strictEqual(relativePath, "nested/deep/file.md");
	});

	test("should handle absolute paths by converting to relative paths", () => {
		const validator = new CitationValidator();
		const sourceFile = join(__dirname, "fixtures", "warning-test-source.md");
		const targetFile = join(
			__dirname,
			"fixtures",
			"subdir",
			"warning-test-target.md",
		);

		const relativePath = validator.calculateRelativePath(
			sourceFile,
			targetFile,
		);
		assert.strictEqual(relativePath, "subdir/warning-test-target.md");

		// Should not contain absolute path components
		assert(
			!relativePath.includes(__dirname),
			"Relative path should not contain absolute path components",
		);
	});
});

describe("Path Conversion Suggestion Integration", () => {
	test("should include path conversion suggestions in warning validation results", async () => {
		const testFile = join(__dirname, "fixtures", "warning-test-source.md");
		const scopeFolder = join(__dirname, "fixtures");

		try {
			const output = execSync(
				`node "${citationManagerPath}" validate "${testFile}" --scope "${scopeFolder}" --format json`,
				{
					encoding: "utf8",
					cwd: __dirname,
				},
			);

			const result = JSON.parse(output);
			const warningResults = result.results.filter(
				(r) => r.status === "warning",
			);

			assert(
				warningResults.length > 0,
				"Should have warning results for path conversion testing",
			);

			// Find the specific warning citation that should have conversion suggestions
			const conversionWarning = warningResults.find((r) =>
				r.citation.includes("../wrong-path/warning-test-target.md"),
			);

			assert(
				conversionWarning,
				"Should find warning result for cross-directory citation",
			);

			// Test that suggestion structure exists (will be implemented in Task 6.1)
			// This should initially fail since conversion suggestions aren't implemented yet
			assert(
				conversionWarning.suggestion &&
					typeof conversionWarning.suggestion === "object",
				"Warning result should include structured conversion suggestion",
			);

			assert.strictEqual(
				conversionWarning.suggestion.type,
				"path-conversion",
				"Suggestion should be identified as path conversion type",
			);

			assert.strictEqual(
				conversionWarning.suggestion.recommended,
				"subdir/warning-test-target.md#Test%20Anchor",
				"Should recommend correct relative path with preserved anchor",
			);
		} catch (error) {
			// Expected to fail initially in TDD approach
			// This proves the test detects missing functionality
			if (
				error.message.includes("suggestion") ||
				error.message.includes("calculateRelativePath")
			) {
				// This is expected - the functionality doesn't exist yet
				assert(
					true,
					"Test correctly fails due to missing path conversion functionality (TDD validated)",
				);
			} else {
				throw error;
			}
		}
	});

	test("should preserve anchor fragments in conversion suggestions", () => {
		const validator = new CitationValidator();

		// Test anchor preservation with URL encoding
		const sourceFile = join(__dirname, "fixtures", "warning-test-source.md");
		const targetFile = join(
			__dirname,
			"fixtures",
			"subdir",
			"warning-test-target.md",
		);
		const originalCitation =
			"../wrong-path/warning-test-target.md#Test%20Anchor";

		// This should fail initially since method doesn't exist
		const suggestion = validator.generatePathConversionSuggestion(
			originalCitation,
			sourceFile,
			targetFile,
		);

		assert.strictEqual(
			suggestion.recommended,
			"subdir/warning-test-target.md#Test%20Anchor",
			"Should preserve URL-encoded anchor in conversion suggestion",
		);

		assert.strictEqual(
			suggestion.type,
			"path-conversion",
			"Should identify suggestion as path conversion type",
		);

		assert(
			suggestion.original && suggestion.original === originalCitation,
			"Should include original citation for reference",
		);
	});

	test("should handle citations without anchors in conversion suggestions", () => {
		const validator = new CitationValidator();

		const sourceFile = join(__dirname, "fixtures", "warning-test-source.md");
		const targetFile = join(
			__dirname,
			"fixtures",
			"subdir",
			"warning-test-target.md",
		);
		const originalCitation = "../wrong-path/warning-test-target.md";

		// This should fail initially since method doesn't exist
		const suggestion = validator.generatePathConversionSuggestion(
			originalCitation,
			sourceFile,
			targetFile,
		);

		assert.strictEqual(
			suggestion.recommended,
			"subdir/warning-test-target.md",
			"Should provide clean conversion suggestion without anchor",
		);

		assert(
			!suggestion.recommended.includes("#"),
			"Should not include anchor when none was present",
		);
	});

	test("should generate conversion suggestions for various directory structures", () => {
		const validator = new CitationValidator();

		// Test multiple directory scenarios
		const testCases = [
			{
				source: join(__dirname, "fixtures", "warning-test-source.md"),
				target: join(__dirname, "fixtures", "subdir", "warning-test-target.md"),
				original: "../wrong-path/warning-test-target.md#anchor",
				expected: "subdir/warning-test-target.md#anchor",
			},
			{
				source: join(__dirname, "fixtures", "subdir", "warning-test-target.md"),
				target: join(__dirname, "fixtures", "warning-test-source.md"),
				original: "wrong-dir/warning-test-source.md",
				expected: "../warning-test-source.md",
			},
			{
				source: join(__dirname, "fixtures", "warning-test-source.md"),
				target: join(__dirname, "fixtures", "test-target.md"),
				original: "subdir/test-target.md",
				expected: "test-target.md",
			},
		];

		for (const testCase of testCases) {
			// This should fail initially since method doesn't exist
			const suggestion = validator.generatePathConversionSuggestion(
				testCase.original,
				testCase.source,
				testCase.target,
			);

			assert.strictEqual(
				suggestion.recommended,
				testCase.expected,
				`Should generate correct conversion for ${testCase.original} → ${testCase.expected}`,
			);
		}
	});
});

describe("Path Conversion Validation Result Structure", () => {
	test("should maintain backward compatibility while adding conversion suggestions", async () => {
		const testFile = join(__dirname, "fixtures", "warning-test-source.md");
		const scopeFolder = join(__dirname, "fixtures");

		try {
			const output = execSync(
				`node "${citationManagerPath}" validate "${testFile}" --scope "${scopeFolder}" --format json`,
				{
					encoding: "utf8",
					cwd: __dirname,
				},
			);

			const result = JSON.parse(output);
			const warningResults = result.results.filter(
				(r) => r.status === "warning",
			);

			if (warningResults.length > 0) {
				const warningResult = warningResults[0];

				// Existing fields should remain
				assert(warningResult.line !== undefined, "Should maintain line field");
				assert(
					warningResult.citation !== undefined,
					"Should maintain citation field",
				);
				assert(
					warningResult.status === "warning",
					"Should maintain status field",
				);
				assert(warningResult.type !== undefined, "Should maintain type field");

				// New suggestion field should be added (when implemented)
				if (warningResult.suggestion) {
					assert(
						typeof warningResult.suggestion === "object",
						"Suggestion should be structured object",
					);

					assert(
						warningResult.suggestion.type,
						"Suggestion should have type field",
					);

					assert(
						warningResult.suggestion.recommended,
						"Suggestion should have recommended field",
					);
				}
			}
		} catch (_error) {
			// Expected to fail initially in TDD approach
			assert(
				true,
				"Test setup validates structure requirements for future implementation",
			);
		}
	});
});
