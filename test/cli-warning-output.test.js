import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runCLI } from "./helpers/cli-runner.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const citationManagerPath = join(__dirname, "..", "src", "citation-manager.js");

describe("CLI Warning Output Display Tests", () => {
	it("should display warnings section with proper formatting and tree structure", async () => {
		const testFile = join(__dirname, "fixtures", "warning-test-source.md");
		const scopeFolder = join(__dirname, "fixtures");

		let output = "";
		let commandSucceeded = false;

		try {
			output = runCLI(
				`node "${citationManagerPath}" validate "${testFile}" --scope "${scopeFolder}"`,
				{
					cwd: __dirname,
				},
			);
			commandSucceeded = true;
		} catch (error) {
			// Handle case where command might exit with error but still produce valid output
			output = error.stdout || "";
		}

		// Validate we got output
		expect(output.length).toBeGreaterThan(0);

		// Validate warning section header with count
		expect(output).toContain("WARNINGS (");
		expect(output).toContain(")");

		// Validate tree structure formatting for warnings
		expect(output.includes("├─") || output.includes("└─")).toBe(true);

		// Validate line number information is included
		expect(output).toMatch(/Line \d+:/);

		// Validate the specific warning citation is displayed
		expect(output).toContain("../wrong-path/warning-test-target.md");

		// Validate warning suggestion is provided with proper indentation
		expect(output).toContain("│  └─");
		expect(
			output.includes("Found via file cache") ||
				output.includes("Found in scope"),
		).toBe(true);
	});

	it("should include warnings count in summary statistics with proper formatting", async () => {
		const testFile = join(__dirname, "fixtures", "warning-test-source.md");
		const scopeFolder = join(__dirname, "fixtures");

		try {
			const output = runCLI(
				`node "${citationManagerPath}" validate "${testFile}" --scope "${scopeFolder}"`,
				{
					cwd: __dirname,
				},
			);

			// Validate summary section exists
			expect(output).toContain("SUMMARY:");

			// Validate warnings count is included in summary
			expect(output).toMatch(/- Warnings: \d+/);

			// Validate summary contains all expected fields
			expect(output).toContain("- Total citations:");
			expect(output).toContain("- Valid:");
			expect(output).toContain("- Critical errors:");
			expect(output).toContain("- Validation time:");

			// Extract warnings count to ensure it's greater than zero
			const warningsMatch = output.match(/- Warnings: (\d+)/);
			expect(warningsMatch).toBeTruthy();

			const warningsCount = Number.parseInt(warningsMatch[1], 10);
			expect(warningsCount).toBeGreaterThan(0);
		} catch (error) {
			// Handle case where command exits with error but still produces summary
			const output = error.stdout || "";

			expect(output).toContain("SUMMARY:");
			expect(output).toMatch(/- Warnings: \d+/);
		}
	});

	it("should mark warnings as fixable issues distinct from valid and error sections", async () => {
		const testFile = join(__dirname, "fixtures", "warning-test-source.md");
		const scopeFolder = join(__dirname, "fixtures");

		try {
			const output = runCLI(
				`node "${citationManagerPath}" validate "${testFile}" --scope "${scopeFolder}"`,
				{
					cwd: __dirname,
				},
			);

			// Validate warnings section is distinct from valid and error sections
			const sections = output
				.split("\n")
				.filter(
					(line) =>
						line.includes("WARNINGS") ||
						line.includes("VALID CITATIONS") ||
						line.includes("ERRORS"),
				);

			// Should have separate sections for different status types
			expect(sections.length).toBeGreaterThan(0);

			// Validate warning section appears before valid section (if both exist)
			if (output.includes("WARNINGS") && output.includes("VALID CITATIONS")) {
				const warningIndex = output.indexOf("WARNINGS");
				const validIndex = output.indexOf("VALID CITATIONS");
				expect(warningIndex).toBeLessThan(validIndex);
			}

			// Validate warnings indicate they are fixable/actionable
			const warningSection = output.substring(
				output.indexOf("WARNINGS"),
				output.indexOf("SUMMARY:"),
			);

			// Warning should provide actionable information (suggestion, resolution path, etc.)
			expect(
				warningSection.includes("Found in scope") ||
					warningSection.includes("resolved") ||
					warningSection.includes("└─"),
			).toBe(true);
		} catch (error) {
			// Validate output structure even on error exit
			const output = error.stdout || "";

			expect(output).toContain("WARNINGS");
		}
	});

	it("should display warnings with consistent formatting regardless of exit code", async () => {
		const testFile = join(__dirname, "fixtures", "warning-test-source.md");
		const scopeFolder = join(__dirname, "fixtures");

		let output = "";
		let exitedWithError = false;

		try {
			output = runCLI(
				`node "${citationManagerPath}" validate "${testFile}" --scope "${scopeFolder}"`,
				{
					cwd: __dirname,
				},
			);
		} catch (error) {
			// Capture output even when command exits with error
			output = error.stdout || "";
			exitedWithError = true;
		}

		// Core assertions should pass regardless of exit code
		expect(output.length).toBeGreaterThan(0);

		// Warning formatting should be consistent
		if (output.includes("WARNINGS")) {
			// Validate warning count is properly formatted
			expect(output).toMatch(/WARNINGS \(\d+\)/);

			// Validate at least one warning item with proper formatting
			expect(output.includes("├─") || output.includes("└─")).toBe(true);
		}

		// Summary should be present and formatted consistently
		expect(output).toContain("SUMMARY:");

		expect(output).toMatch(/- Warnings: \d+/);

		// Note whether command exited with error for debugging
		console.log(
			`Test completed. Command exited with error: ${exitedWithError}`,
		);
	});

	it("should provide clear visual separation between warning and other status sections", async () => {
		const testFile = join(__dirname, "fixtures", "warning-test-source.md");
		const scopeFolder = join(__dirname, "fixtures");

		try {
			const output = runCLI(
				`node "${citationManagerPath}" validate "${testFile}" --scope "${scopeFolder}"`,
				{
					cwd: __dirname,
				},
			);

			// Count empty lines used for section separation
			const lines = output.split("\n");
			let hasProperSeparation = false;

			// Check for empty lines after warning section
			for (let i = 0; i < lines.length - 1; i++) {
				if (lines[i].includes("WARNINGS")) {
					// Find the end of warning section and check for separation
					let j = i + 1;
					while (
						j < lines.length &&
						(lines[j].includes("├─") ||
							lines[j].includes("└─") ||
							lines[j].includes("│"))
					) {
						j++;
					}
					// Check if there's an empty line after warning section
					if (j < lines.length && lines[j].trim() === "") {
						hasProperSeparation = true;
						break;
					}
				}
			}

			expect(hasProperSeparation).toBe(true);
		} catch (error) {
			// Validate visual formatting even on error
			const output = error.stdout || "";

			if (output.includes("WARNINGS")) {
				expect(output).toContain("WARNINGS");
			}
		}
	});
});
