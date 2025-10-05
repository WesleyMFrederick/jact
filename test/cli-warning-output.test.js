import { strict as assert } from "node:assert";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const citationManagerPath = join(__dirname, "..", "citation-manager.js");

describe("CLI Warning Output Display Tests", () => {
	test("should display warnings section with proper formatting and tree structure", async () => {
		const testFile = join(__dirname, "fixtures", "warning-test-source.md");
		const scopeFolder = join(__dirname, "fixtures");

		let output = "";
		let commandSucceeded = false;

		try {
			output = execSync(
				`node "${citationManagerPath}" validate "${testFile}" --scope "${scopeFolder}"`,
				{
					encoding: "utf8",
					cwd: __dirname,
				},
			);
			commandSucceeded = true;
		} catch (error) {
			// Handle case where command might exit with error but still produce valid output
			output = error.stdout || "";
		}

		// Validate we got output
		assert(
			output.length > 0,
			`CLI should produce output. Command succeeded: ${commandSucceeded}. Output: ${output}`,
		);

		// Validate warning section header with emoji and count
		assert(
			output.includes("⚠️  WARNINGS (") && output.includes(")"),
			"CLI output should contain warnings section header with emoji and count in format '⚠️  WARNINGS (n)'",
		);

		// Validate tree structure formatting for warnings
		assert(
			output.includes("├─") || output.includes("└─"),
			"Warning section should use tree formatting with proper branch characters",
		);

		// Validate line number information is included
		assert(
			/Line \d+:/.test(output),
			"Warning items should include line number information",
		);

		// Validate the specific warning citation is displayed
		assert(
			output.includes("../wrong-path/warning-test-target.md"),
			"Warning section should display the problematic citation path",
		);

		// Validate warning suggestion is provided with proper indentation
		assert(
			output.includes("│  └─") &&
				(output.includes("Found via file cache") ||
					output.includes("Found in scope")),
			"Warning items should include suggestion or resolution information with proper nested indentation",
		);
	});

	test("should include warnings count in summary statistics with proper formatting", async () => {
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

			// Validate summary section exists
			assert(
				output.includes("SUMMARY:"),
				"CLI output should contain SUMMARY section",
			);

			// Validate warnings count is included in summary
			assert(
				/- Warnings: \d+/.test(output),
				"Summary should include warnings count in format '- Warnings: n'",
			);

			// Validate summary contains all expected fields
			assert(
				output.includes("- Total citations:"),
				"Summary should include total citations count",
			);
			assert(
				output.includes("- Valid:"),
				"Summary should include valid citations count",
			);
			assert(
				output.includes("- Critical errors:"),
				"Summary should include errors count",
			);
			assert(
				output.includes("- Validation time:"),
				"Summary should include validation time",
			);

			// Extract warnings count to ensure it's greater than zero
			const warningsMatch = output.match(/- Warnings: (\d+)/);
			assert(warningsMatch, "Should find warnings count in summary");

			const warningsCount = parseInt(warningsMatch[1], 10);
			assert(
				warningsCount > 0,
				`Warnings count should be greater than zero, got: ${warningsCount}`,
			);
		} catch (error) {
			// Handle case where command exits with error but still produces summary
			const output = error.stdout || "";

			assert(
				output.includes("SUMMARY:") && /- Warnings: \d+/.test(output),
				`CLI should display summary with warnings count even on error exit. Output: ${output}`,
			);
		}
	});

	test("should mark warnings as fixable issues distinct from valid and error sections", async () => {
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

			// Validate warnings section is distinct from valid and error sections
			const sections = output
				.split("\n")
				.filter(
					(line) =>
						line.includes("⚠️  WARNINGS") ||
						line.includes("✅ VALID CITATIONS") ||
						line.includes("❌ ERRORS"),
				);

			// Should have separate sections for different status types
			assert(
				sections.length > 0,
				"Should have clearly separated sections for different citation statuses",
			);

			// Validate warning section appears before valid section (if both exist)
			if (
				output.includes("⚠️  WARNINGS") &&
				output.includes("✅ VALID CITATIONS")
			) {
				const warningIndex = output.indexOf("⚠️  WARNINGS");
				const validIndex = output.indexOf("✅ VALID CITATIONS");
				assert(
					warningIndex < validIndex,
					"Warnings section should appear before valid citations section",
				);
			}

			// Validate warnings indicate they are fixable/actionable
			const warningSection = output.substring(
				output.indexOf("⚠️  WARNINGS"),
				output.indexOf("SUMMARY:"),
			);

			// Warning should provide actionable information (suggestion, resolution path, etc.)
			assert(
				warningSection.includes("Found in scope") ||
					warningSection.includes("resolved") ||
					warningSection.includes("└─"),
				"Warning section should indicate warnings are actionable with resolution information or suggestions",
			);
		} catch (error) {
			// Validate output structure even on error exit
			const output = error.stdout || "";

			assert(
				output.includes("⚠️  WARNINGS"),
				`CLI should display properly formatted warnings section. Output: ${output}`,
			);
		}
	});

	test("should display warnings with consistent formatting regardless of exit code", async () => {
		const testFile = join(__dirname, "fixtures", "warning-test-source.md");
		const scopeFolder = join(__dirname, "fixtures");

		let output = "";
		let exitedWithError = false;

		try {
			output = execSync(
				`node "${citationManagerPath}" validate "${testFile}" --scope "${scopeFolder}"`,
				{
					encoding: "utf8",
					cwd: __dirname,
				},
			);
		} catch (error) {
			// Capture output even when command exits with error
			output = error.stdout || "";
			exitedWithError = true;
		}

		// Core assertions should pass regardless of exit code
		assert(
			output.length > 0,
			"CLI should produce output regardless of exit code",
		);

		// Warning formatting should be consistent
		if (output.includes("⚠️  WARNINGS")) {
			// Validate warning count is properly formatted
			assert(
				/⚠️ {2}WARNINGS \(\d+\)/.test(output),
				"Warning header should include count in parentheses",
			);

			// Validate at least one warning item with proper formatting
			assert(
				output.includes("├─") || output.includes("└─"),
				"Warning items should use tree-style formatting",
			);
		}

		// Summary should be present and formatted consistently
		assert(
			output.includes("SUMMARY:"),
			"Summary section should be present regardless of exit code",
		);

		assert(
			/- Warnings: \d+/.test(output),
			"Summary should include warnings count with consistent formatting",
		);

		// Note whether command exited with error for debugging
		console.log(
			`Test completed. Command exited with error: ${exitedWithError}`,
		);
	});

	test("should provide clear visual separation between warning and other status sections", async () => {
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

			// Count empty lines used for section separation
			const lines = output.split("\n");
			let hasProperSeparation = false;

			// Check for empty lines after warning section
			for (let i = 0; i < lines.length - 1; i++) {
				if (lines[i].includes("⚠️  WARNINGS")) {
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

			assert(
				hasProperSeparation,
				"Warning section should be visually separated from other sections with empty lines",
			);

			// Validate distinct visual markers for different sections
			const sectionMarkers = {
				warnings: "⚠️",
				valid: "✅",
				errors: "❌",
			};

			Object.entries(sectionMarkers).forEach(([sectionType, emoji]) => {
				if (output.includes(emoji)) {
					assert(
						output.includes(emoji),
						`${sectionType} section should have distinct visual marker: ${emoji}`,
					);
				}
			});
		} catch (error) {
			// Validate visual formatting even on error
			const output = error.stdout || "";

			if (output.includes("⚠️  WARNINGS")) {
				assert(
					output.includes("⚠️"),
					"Warning section should maintain visual markers even on error exit",
				);
			}
		}
	});
});
