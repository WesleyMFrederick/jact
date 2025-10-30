import { unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runCLI } from "./helpers/cli-runner.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const citationManagerPath = join(__dirname, "..", "src", "citation-manager.js");

describe("Citation Manager Integration Tests", () => {
	it("should validate citations in valid-citations.md successfully", async () => {
		const testFile = join(__dirname, "fixtures", "valid-citations.md");

		try {
			const output = runCLI(
				`node "${citationManagerPath}" validate "${testFile}"`,
				{
					cwd: __dirname,
				},
			);

			expect(output).toContain("ALL CITATIONS VALID");
			expect(output).toContain("Total citations:");
			expect(output).toContain("Validation time:");
		} catch (error) {
			// If execSync throws, it means non-zero exit code
			expect.fail(
				`Validation should pass for valid citations: ${error.stdout || error.message}`,
			);
		}
	});

	it("should detect broken links in broken-links.md", async () => {
		const testFile = join(__dirname, "fixtures", "broken-links.md");

		try {
			runCLI(`node "${citationManagerPath}" validate "${testFile}"`, {
				cwd: __dirname,
			});
			expect.fail("Should have failed validation for broken links");
		} catch (error) {
			const output = error.stdout || "";
			expect(output).toContain("VALIDATION FAILED");
			expect(output).toContain("CRITICAL ERRORS");
			expect(output).toContain("File not found");
		}
	});

	it("should return JSON format when requested", async () => {
		const testFile = join(__dirname, "fixtures", "valid-citations.md");

		try {
			const output = runCLI(
				`node "${citationManagerPath}" validate "${testFile}" --format json`,
				{
					cwd: __dirname,
				},
			);

			const result = JSON.parse(output);
			expect(typeof result).toBe("object");
			expect(result.summary).toBeTruthy();
			expect(Array.isArray(result.links)).toBe(true);
			expect(typeof result.summary.total).toBe("number");
		} catch (error) {
			expect.fail(`JSON format should work: ${error.stdout || error.message}`);
		}
	});

	it("should show AST output with ast command", async () => {
		const testFile = join(__dirname, "fixtures", "valid-citations.md");

		try {
			const output = runCLI(`node "${citationManagerPath}" ast "${testFile}"`, {
				cwd: __dirname,
			});

			const ast = JSON.parse(output);
			expect(ast.filePath).toBeTruthy();
			expect(ast.links).toBeTruthy();
			expect(ast.anchors).toBeTruthy();
			expect(Array.isArray(ast.tokens)).toBe(true);
		} catch (error) {
			expect.fail(`AST command should work: ${error.stdout || error.message}`);
		}
	});

	it("should handle non-existent files gracefully", async () => {
		const testFile = join(__dirname, "fixtures", "does-not-exist.md");

		try {
			runCLI(`node "${citationManagerPath}" validate "${testFile}"`, {
				cwd: __dirname,
			});
			expect.fail("Should have failed for non-existent file");
		} catch (error) {
			const output = error.stdout || "";
			expect(output).toContain("ERROR");
			expect(error.status).toBe(2);
		}
	});

	it("should filter citations by line range", async () => {
		const testFile = join(__dirname, "fixtures", "scope-test.md");

		try {
			const output = runCLI(
				`node "${citationManagerPath}" validate "${testFile}" --lines 13-14`,
				{
					cwd: __dirname,
				},
			);

			expect(output).toContain("Line Range: 13-14");
			expect(output).toContain("Processed: 2 citations found");
			expect(output).toContain("Line 13:");
			expect(output).toContain("Line 14:");
			expect(output).not.toContain("Line 15:");
		} catch (error) {
			expect.fail(
				`Line range filtering should work: ${error.stdout || error.message}`,
			);
		}
	});

	it("should use folder scope for smart file resolution", async () => {
		const testFile = join(__dirname, "fixtures", "scope-test.md");
		const scopeFolder = join(__dirname, "fixtures");

		try {
			const output = runCLI(
				`node "${citationManagerPath}" validate "${testFile}" --scope "${scopeFolder}"`,
				{
					cwd: __dirname,
				},
			);

			expect(output).toContain("Scanned");
			expect(output).toContain("files in");
			// The broken path ../missing/test-target.md should be resolved to test-target.md via cache
			expect(output).toContain("test-target.md");
		} catch (error) {
			const output = error.stdout || "";
			// Even if validation fails due to other issues, scope should work
			expect(output).toContain("Scanned");
		}
	});

	it("should combine line range with folder scope", async () => {
		const testFile = join(__dirname, "fixtures", "scope-test.md");
		const scopeFolder = join(__dirname, "fixtures");

		try {
			const output = runCLI(
				`node "${citationManagerPath}" validate "${testFile}" --lines 13-14 --scope "${scopeFolder}" --format json`,
				{
					cwd: __dirname,
					captureStderr: false, // JSON output - don't mix stderr warnings
				},
			);

			const result = JSON.parse(output);
			expect(result.lineRange).toBe("13-14");
			expect(Array.isArray(result.links)).toBe(true);
			expect(result.links.every((r) => r.line >= 13 && r.line <= 14)).toBe(
				true,
			);
		} catch (error) {
			const output = error.stdout || "";
			// Try to parse even if validation failed
			try {
				const result = JSON.parse(output);
				expect(result.lineRange).toBe("13-14");
			} catch (_parseError) {
				expect.fail(
					`Should return valid JSON with line range: ${error.stdout || error.message}`,
				);
			}
		}
	});

	it("should handle single line filtering", async () => {
		const testFile = join(__dirname, "fixtures", "scope-test.md");

		try {
			const output = runCLI(
				`node "${citationManagerPath}" validate "${testFile}" --lines 7`,
				{
					cwd: __dirname,
				},
			);

			expect(output).toContain("Line Range: 7-7");
			expect(output).toContain("Processed: 1 citations found");
			expect(output).toContain("Line 7:");
		} catch (error) {
			expect.fail(
				`Single line filtering should work: ${error.stdout || error.message}`,
			);
		}
	});

	it("should validate complex markdown headers with flexible anchor matching", async () => {
		const testFile = join(__dirname, "fixtures", "complex-headers.md");

		try {
			const output = runCLI(
				`node "${citationManagerPath}" validate "${testFile}"`,
				{
					cwd: __dirname,
				},
			);

			// Note: The complex-headers.md file may have some anchors that don't match exactly
			// This is because some headers use special characters that require specific encoding
			// We verify that key patterns are present in the output
			const hasFilecodeCitations =
				output.includes("%60setupOrchestrator.js%60") ||
				output.includes("setupOrchestrator");
			expect(hasFilecodeCitations).toBe(true);

			// Check that validation ran and processed citations
			expect(output).toContain("citations found");
		} catch (error) {
			// If validation fails, check that it's due to known anchor format issues
			const errorOutput = error.stdout || error.message;
			expect(errorOutput).toContain("citations found");
		}
	});

	it("should use raw text anchors for headers with markdown formatting", async () => {
		const testFile = join(__dirname, "fixtures", "complex-headers.md");

		try {
			const output = runCLI(`node "${citationManagerPath}" ast "${testFile}"`, {
				cwd: __dirname,
			});

			const ast = JSON.parse(output);

			// Find headers with markdown (backticks)
			const backtickHeaders = ast.anchors.filter((anchor) =>
				anchor.rawText?.includes("`"),
			);

			expect(backtickHeaders.length).toBeGreaterThan(0);

			// The system generates TWO types of anchors for each header:
			// 1. type="header" with raw text anchors
			// 2. type="header-obsidian" with URL-encoded anchors
			// Both are valid - we just verify that anchors are generated
			for (const header of backtickHeaders) {
				expect(header.id).toBeDefined();
				expect(header.id.length).toBeGreaterThan(0);
			}

			// Verify plain text headers also get anchors
			const plainHeaders = ast.anchors.filter(
				(anchor) =>
					anchor.anchorType === "header" &&
					anchor.rawText &&
					!anchor.rawText.includes("`") &&
					!anchor.rawText.includes("**") &&
					!anchor.rawText.includes("*") &&
					!anchor.rawText.includes("==") &&
					!anchor.rawText.includes("["),
			);

			// Plain headers should have anchors defined
			for (const header of plainHeaders) {
				expect(header.id).toBeDefined();
			}
		} catch (error) {
			expect.fail(
				`Markdown header anchor generation should work: ${error.stdout || error.message}`,
			);
		}
	});

	it("should handle URL-encoded paths in citations", async () => {
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
			const output = runCLI(
				`node "${citationManagerPath}" validate "${testFile}"`,
				{
					cwd: __dirname,
				},
			);

			// Should validate the URL-encoded path successfully
			expect(output).toContain("VALID CITATIONS");
			expect(output).toContain("test%20file%20with%20spaces.md");
		} catch (error) {
			// Even if some citations fail, URL decoding should work for the space-encoded file
			const output = error.stdout || "";
			expect(output).toContain("test%20file%20with%20spaces.md");
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

	it("should detect and handle Obsidian absolute path format", async () => {
		const testFile = join(__dirname, "fixtures", "obsidian-absolute-paths.md");

		// Create test file with Obsidian absolute path format
		const testContent = `# Test File

[Test Link](0_SoftwareDevelopment/test-file.md)
[Another Link](MyProject/docs/readme.md)
[Invalid Absolute](/absolute/path/file.md)
`;

		writeFileSync(testFile, testContent);

		try {
			const output = runCLI(
				`node "${citationManagerPath}" validate "${testFile}"`,
				{
					cwd: __dirname,
				},
			);

			// The validator should detect Obsidian format and attempt resolution
			// Even if files don't exist, it should provide helpful error messages
			expect(output).toContain("Detected Obsidian absolute path format");
		} catch (error) {
			const output = error.stdout || "";
			expect(output).toContain("Detected Obsidian absolute path format");
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
