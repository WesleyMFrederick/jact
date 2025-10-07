import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runCLI } from "./helpers/cli-runner.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const citationManagerPath = join(__dirname, "..", "src", "citation-manager.js");

describe("Warning Status Validation Tests", () => {
	it("should return warning status for cross-directory short filename citations resolved via file cache", async () => {
		const testFile = join(__dirname, "fixtures", "warning-test-source.md");
		const scopeFolder = join(__dirname, "fixtures");

		try {
			const output = runCLI(
				`node "${citationManagerPath}" validate "${testFile}" --scope "${scopeFolder}" --format json`,
				{
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
			expect(warningResults.length).toBeGreaterThan(0);

			// Specific validation: The citation with wrong path should be marked as warning
			const warningCitation = warningResults.find((r) =>
				r.citation.includes("../wrong-path/warning-test-target.md"),
			);

			expect(warningCitation).toBeTruthy();

			expect(warningCitation.status).toBe("warning");

			// Verify summary includes warning count
			expect(typeof result.summary.warnings).toBe("number");

			expect(result.summary.warnings).toBeGreaterThan(0);
		} catch (error) {
			expect.fail(
				`Warning status validation should work with JSON format: ${error.stdout || error.message}`,
			);
		}
	});

	it("should display warning section in CLI output for cross-directory citations", async () => {
		const testFile = join(__dirname, "fixtures", "warning-test-source.md");
		const scopeFolder = join(__dirname, "fixtures");

		// Warnings exit with code 0, so this should succeed
		const output = runCLI(
			`node "${citationManagerPath}" validate "${testFile}" --scope "${scopeFolder}"`,
			{
				cwd: __dirname,
			},
		);

		// Should contain warning section markup in CLI output
		expect(output.includes("WARNINGS") || output.includes("WARNING")).toBe(
			true,
		);

		// Should reference the specific warning citation
		expect(output).toContain("../wrong-path/warning-test-target.md");
	});

	it("should maintain compatibility with existing valid/error status structure", async () => {
		const testFile = join(__dirname, "fixtures", "warning-test-source.md");
		const scopeFolder = join(__dirname, "fixtures");

		try {
			const output = runCLI(
				`node "${citationManagerPath}" validate "${testFile}" --scope "${scopeFolder}" --format json`,
				{
					cwd: __dirname,
				},
			);

			const result = JSON.parse(output);

			// Ensure backward compatibility - existing fields should still exist
			expect(result.summary).toBeTruthy();
			expect(Array.isArray(result.results)).toBe(true);
			expect(typeof result.summary.total).toBe("number");
			expect(typeof result.summary.valid).toBe("number");
			expect(typeof result.summary.errors).toBe("number");

			// New warning functionality should extend, not replace
			expect(typeof result.summary.warnings).toBe("number");

			// Results should have proper status enum values
			const allStatuses = result.results.map((r) => r.status);
			const validStatuses = ["valid", "error", "warning"];

			for (const status of allStatuses) {
				expect(validStatuses.includes(status)).toBe(true);
			}
		} catch (error) {
			expect.fail(
				`JSON structure compatibility check failed: ${error.stdout || error.message}`,
			);
		}
	});
});
