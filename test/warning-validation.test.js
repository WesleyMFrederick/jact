import { strict as assert } from "node:assert";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const citationManagerPath = join(__dirname, "..", "citation-manager.js");

describe("Warning Status Validation Tests", () => {
	test("should return warning status for cross-directory short filename citations resolved via file cache", async () => {
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

			// Filter results by status
			const warningResults = result.results.filter(
				(r) => r.status === "warning",
			);
			const _validResults = result.results.filter((r) => r.status === "valid");
			const _errorResults = result.results.filter((r) => r.status === "error");

			// Primary assertion: Should have warning status for cross-directory resolution
			assert(
				warningResults.length > 0,
				"Should have at least one warning result for cross-directory short filename citation",
			);

			// Specific validation: The citation with wrong path should be marked as warning
			const warningCitation = warningResults.find((r) =>
				r.citation.includes("../wrong-path/warning-test-target.md"),
			);

			assert(
				warningCitation,
				"Citation with wrong path '../wrong-path/warning-test-target.md' should be marked as warning",
			);

			assert.strictEqual(
				warningCitation.status,
				"warning",
				"Cross-directory short filename citation should have warning status",
			);

			// Verify summary includes warning count
			assert(
				typeof result.summary.warnings === "number",
				"Summary should include warnings count",
			);

			assert(
				result.summary.warnings > 0,
				"Summary should show at least one warning",
			);
		} catch (error) {
			assert.fail(
				`Warning status validation should work with JSON format: ${error.stdout || error.message}`,
			);
		}
	});

	test("should display warning section in CLI output for cross-directory citations", async () => {
		const testFile = join(__dirname, "fixtures", "warning-test-source.md");
		const scopeFolder = join(__dirname, "fixtures");

		try {
			const output = execSync(
				`node "${citationManagerPath}" validate "${testFile}" --scope "${scopeFolder}"`,
				{
					encoding: "utf8",
					cwd: __dirname,
				},
			);

			// Should contain warning section markup in CLI output
			assert(
				output.includes("⚠️  WARNINGS") || output.includes("WARNING"),
				"CLI output should contain warning section for cross-directory citations",
			);

			// Should reference the specific warning citation
			assert(
				output.includes("../wrong-path/warning-test-target.md"),
				"CLI output should show the citation with incorrect path",
			);

			// Should indicate it was resolved via file cache
			assert(
				output.includes("resolved via") ||
					output.includes("file cache") ||
					output.includes("Found in scope"),
				"CLI output should indicate file was resolved via cache",
			);
		} catch (error) {
			// Even if command exits with error due to warnings, check output content
			const output = error.stdout || "";

			assert(
				output.includes("⚠️  WARNINGS") || output.includes("WARNING"),
				`CLI should show warning section even on error exit: ${output}`,
			);
		}
	});

	test("should maintain compatibility with existing valid/error status structure", async () => {
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

			// Ensure backward compatibility - existing fields should still exist
			assert(result.summary, "Should include summary object");
			assert(Array.isArray(result.results), "Should include results array");
			assert(
				typeof result.summary.total === "number",
				"Should include total count",
			);
			assert(
				typeof result.summary.valid === "number",
				"Should include valid count",
			);
			assert(
				typeof result.summary.errors === "number",
				"Should include errors count",
			);

			// New warning functionality should extend, not replace
			assert(
				typeof result.summary.warnings === "number",
				"Should include warnings count in summary",
			);

			// Results should have proper status enum values
			const allStatuses = result.results.map((r) => r.status);
			const validStatuses = ["valid", "error", "warning"];

			allStatuses.forEach((status) => {
				assert(
					validStatuses.includes(status),
					`All status values should be valid enum values, got: ${status}`,
				);
			});
		} catch (error) {
			assert.fail(
				`JSON structure compatibility check failed: ${error.stdout || error.message}`,
			);
		}
	});
});
