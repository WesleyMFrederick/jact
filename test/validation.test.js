import { strict as assert } from "node:assert";
import { execSync } from "node:child_process";
import { unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const citationManagerPath = join(__dirname, "..", "citation-manager.js");

describe("Citation Manager Integration Tests", () => {
	test("should validate citations in valid-citations.md successfully", async () => {
		const testFile = join(__dirname, "fixtures", "valid-citations.md");

		try {
			const output = execSync(
				`node "${citationManagerPath}" validate "${testFile}"`,
				{
					encoding: "utf8",
					cwd: __dirname,
				},
			);

			assert(
				output.includes("✅ ALL CITATIONS VALID"),
				"Should report all citations as valid",
			);
			assert(output.includes("Total citations:"), "Should show citation count");
			assert(
				output.includes("Validation time:"),
				"Should show validation time",
			);
		} catch (error) {
			// If execSync throws, it means non-zero exit code
			assert.fail(
				`Validation should pass for valid citations: ${error.stdout || error.message}`,
			);
		}
	});

	test("should detect broken links in broken-links.md", async () => {
		const testFile = join(__dirname, "fixtures", "broken-links.md");

		try {
			execSync(`node "${citationManagerPath}" validate "${testFile}"`, {
				encoding: "utf8",
				cwd: __dirname,
			});
			assert.fail("Should have failed validation for broken links");
		} catch (error) {
			const output = error.stdout || "";
			assert(
				output.includes("❌ VALIDATION FAILED"),
				"Should report validation failure",
			);
			assert(output.includes("CRITICAL ERRORS"), "Should show critical errors");
			assert(output.includes("File not found"), "Should detect missing files");
		}
	});

	test("should return JSON format when requested", async () => {
		const testFile = join(__dirname, "fixtures", "valid-citations.md");

		try {
			const output = execSync(
				`node "${citationManagerPath}" validate "${testFile}" --format json`,
				{
					encoding: "utf8",
					cwd: __dirname,
				},
			);

			const result = JSON.parse(output);
			assert(typeof result === "object", "Should return valid JSON");
			assert(result.summary, "Should include summary");
			assert(Array.isArray(result.results), "Should include results array");
			assert(
				typeof result.summary.total === "number",
				"Should include total count",
			);
		} catch (error) {
			assert.fail(`JSON format should work: ${error.stdout || error.message}`);
		}
	});

	test("should show AST output with ast command", async () => {
		const testFile = join(__dirname, "fixtures", "valid-citations.md");

		try {
			const output = execSync(
				`node "${citationManagerPath}" ast "${testFile}"`,
				{
					encoding: "utf8",
					cwd: __dirname,
				},
			);

			const ast = JSON.parse(output);
			assert(ast.filePath, "Should include file path");
			assert(ast.links, "Should include extracted links");
			assert(ast.anchors, "Should include extracted anchors");
			assert(Array.isArray(ast.tokens), "Should include AST tokens");
		} catch (error) {
			assert.fail(`AST command should work: ${error.stdout || error.message}`);
		}
	});

	test("should handle non-existent files gracefully", async () => {
		const testFile = join(__dirname, "fixtures", "does-not-exist.md");

		try {
			execSync(`node "${citationManagerPath}" validate "${testFile}"`, {
				encoding: "utf8",
				cwd: __dirname,
			});
			assert.fail("Should have failed for non-existent file");
		} catch (error) {
			const output = error.stdout || "";
			assert(output.includes("ERROR"), "Should show error message");
			assert(error.status === 2, "Should exit with code 2 for file not found");
		}
	});

	test("should filter citations by line range", async () => {
		const testFile = join(__dirname, "fixtures", "scope-test.md");

		try {
			const output = execSync(
				`node "${citationManagerPath}" validate "${testFile}" --lines 13-14`,
				{
					encoding: "utf8",
					cwd: __dirname,
				},
			);

			assert(
				output.includes("Line Range: 13-14"),
				"Should show line range in output",
			);
			assert(
				output.includes("Processed: 2 citations found"),
				"Should process exactly 2 citations in range",
			);
			assert(output.includes("Line 13:"), "Should include line 13");
			assert(output.includes("Line 14:"), "Should include line 14");
			assert(!output.includes("Line 15:"), "Should not include line 15");
		} catch (error) {
			assert.fail(
				`Line range filtering should work: ${error.stdout || error.message}`,
			);
		}
	});

	test("should use folder scope for smart file resolution", async () => {
		const testFile = join(__dirname, "fixtures", "scope-test.md");
		const scopeFolder = join(__dirname, "fixtures");

		try {
			const output = execSync(
				`node "${citationManagerPath}" validate "${testFile}" --scope "${scopeFolder}"`,
				{
					encoding: "utf8",
					cwd: __dirname,
				},
			);

			assert(output.includes("📁 Scanned"), "Should show file scan message");
			assert(output.includes("files in"), "Should show scanned file count");
			// The broken path ../missing/test-target.md should be resolved to test-target.md via cache
			assert(
				output.includes("test-target.md"),
				"Should reference target files",
			);
		} catch (error) {
			const output = error.stdout || "";
			// Even if validation fails due to other issues, scope should work
			assert(
				output.includes("📁 Scanned"),
				`Scope should scan files: ${error.stdout || error.message}`,
			);
		}
	});

	test("should combine line range with folder scope", async () => {
		const testFile = join(__dirname, "fixtures", "scope-test.md");
		const scopeFolder = join(__dirname, "fixtures");

		try {
			const output = execSync(
				`node "${citationManagerPath}" validate "${testFile}" --lines 13-14 --scope "${scopeFolder}" --format json`,
				{
					encoding: "utf8",
					cwd: __dirname,
				},
			);

			const result = JSON.parse(output);
			assert(
				result.lineRange === "13-14",
				"Should have line range in JSON output",
			);
			assert(Array.isArray(result.results), "Should have results array");
			assert(
				result.results.every((r) => r.line >= 13 && r.line <= 14),
				"All results should be in specified range",
			);
		} catch (error) {
			const output = error.stdout || "";
			// Try to parse even if validation failed
			try {
				const result = JSON.parse(output);
				assert(
					result.lineRange === "13-14",
					`Should have line range: ${output}`,
				);
			} catch (_parseError) {
				assert.fail(
					`Should return valid JSON with line range: ${error.stdout || error.message}`,
				);
			}
		}
	});

	test("should handle single line filtering", async () => {
		const testFile = join(__dirname, "fixtures", "scope-test.md");

		try {
			const output = execSync(
				`node "${citationManagerPath}" validate "${testFile}" --lines 7`,
				{
					encoding: "utf8",
					cwd: __dirname,
				},
			);

			assert(
				output.includes("Line Range: 7-7"),
				"Should show single line range",
			);
			assert(
				output.includes("Processed: 1 citations found"),
				"Should process exactly 1 citation",
			);
			assert(output.includes("Line 7:"), "Should include line 7");
		} catch (error) {
			assert.fail(
				`Single line filtering should work: ${error.stdout || error.message}`,
			);
		}
	});

	test("should validate complex markdown headers with flexible anchor matching", async () => {
		const testFile = join(__dirname, "fixtures", "complex-headers.md");

		try {
			const output = execSync(
				`node "${citationManagerPath}" validate "${testFile}"`,
				{
					encoding: "utf8",
					cwd: __dirname,
				},
			);

			assert(
				output.includes("✅ ALL CITATIONS VALID"),
				"Should validate all complex header citations",
			);
			assert(
				output.includes("Processed: 15 citations found"),
				"Should process all citations",
			);

			// Check specific complex patterns are validated
			assert(
				output.includes("%60setupOrchestrator.js%60"),
				"Should validate URL-encoded backtick-wrapped file anchors",
			);
			assert(
				output.includes("%60directoryManager.js%60"),
				"Should validate URL-encoded backtick-wrapped file anchors",
			);
			assert(
				output.includes("special-characters-symbols"),
				"Should handle special character removal in kebab-case",
			);
			assert(
				output.includes("unicode-characters"),
				"Should handle unicode character removal in kebab-case",
			);
		} catch (error) {
			assert.fail(
				`Complex header validation should work: ${error.stdout || error.message}`,
			);
		}
	});

	test("should use raw text anchors for headers with markdown formatting", async () => {
		const testFile = join(__dirname, "fixtures", "complex-headers.md");

		try {
			const output = execSync(
				`node "${citationManagerPath}" ast "${testFile}"`,
				{
					encoding: "utf8",
					cwd: __dirname,
				},
			);

			const ast = JSON.parse(output);

			// Find headers with markdown (backticks)
			const backtickHeaders = ast.anchors.filter((anchor) =>
				anchor.rawText?.includes("`"),
			);

			assert(backtickHeaders.length > 0, "Should find headers with backticks");

			// Verify that headers with backticks use raw text as anchors
			backtickHeaders.forEach((header) => {
				assert.strictEqual(
					header.anchor,
					header.rawText,
					`Header "${header.rawText}" should use raw text as anchor, not kebab-case`,
				);
			});

			// Verify plain text headers still use kebab-case
			const plainHeaders = ast.anchors.filter(
				(anchor) =>
					anchor.type === "header" &&
					anchor.rawText &&
					!anchor.rawText.includes("`") &&
					!anchor.rawText.includes("**") &&
					!anchor.rawText.includes("*") &&
					!anchor.rawText.includes("==") &&
					!anchor.rawText.includes("["),
			);

			plainHeaders.forEach((header) => {
				assert.notStrictEqual(
					header.anchor,
					header.rawText,
					`Plain header "${header.rawText}" should use kebab-case anchor, not raw text`,
				);
			});
		} catch (error) {
			assert.fail(
				`Markdown header anchor generation should work: ${error.stdout || error.message}`,
			);
		}
	});

	test("should handle URL-encoded paths in citations", async () => {
		const testFile = join(__dirname, "fixtures", "url-encoded-paths.md");

		// Create test file with URL-encoded paths
		const testContent = `# Test File

[Link with spaces](test%20file%20with%20spaces.md)
[Another test](Design%20Principles.md#Test%20Section)
`;

		writeFileSync(testFile, testContent);

		// Create target file with spaces in name
		const targetFile = join(__dirname, "fixtures", "test file with spaces.md");
		writeFileSync(targetFile, "# Test Header\nContent here.");

		try {
			const output = execSync(
				`node "${citationManagerPath}" validate "${testFile}"`,
				{
					encoding: "utf8",
					cwd: __dirname,
				},
			);

			// Should validate the URL-encoded path successfully
			assert(
				output.includes("✅ VALID CITATIONS"),
				"Should validate URL-encoded paths",
			);
			assert(
				output.includes("test%20file%20with%20spaces.md"),
				"Should show URL-encoded citation",
			);
		} catch (error) {
			// Even if some citations fail, URL decoding should work for the space-encoded file
			const output = error.stdout || "";
			assert(
				output.includes("test%20file%20with%20spaces.md") &&
					output.includes("✓"),
				`URL decoding should resolve file paths: ${output}`,
			);
		} finally {
			// Cleanup
			try {
				unlinkSync(testFile);
				unlinkSync(targetFile);
			} catch (_e) {
				// Ignore cleanup errors
			}
		}
	});

	test("should detect and handle Obsidian absolute path format", async () => {
		const testFile = join(__dirname, "fixtures", "obsidian-absolute-paths.md");

		// Create test file with Obsidian absolute path format
		const testContent = `# Test File

[Test Link](0_SoftwareDevelopment/test-file.md)
[Another Link](MyProject/docs/readme.md)
[Invalid Absolute](/absolute/path/file.md)
`;

		writeFileSync(testFile, testContent);

		try {
			const output = execSync(
				`node "${citationManagerPath}" validate "${testFile}"`,
				{
					encoding: "utf8",
					cwd: __dirname,
				},
			);

			// The validator should detect Obsidian format and attempt resolution
			// Even if files don't exist, it should provide helpful error messages
			assert(
				output.includes("Detected Obsidian absolute path format"),
				"Should detect Obsidian absolute path format in debug messages",
			);
		} catch (error) {
			const output = error.stdout || "";
			assert(
				output.includes("Detected Obsidian absolute path format"),
				`Should detect Obsidian paths in error output: ${output}`,
			);
		} finally {
			// Cleanup
			try {
				unlinkSync(testFile);
			} catch (_e) {
				// Ignore cleanup errors
			}
		}
	});
});
