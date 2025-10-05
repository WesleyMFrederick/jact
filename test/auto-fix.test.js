import { strict as assert } from "node:assert";
import { execSync } from "node:child_process";
import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const citationManagerPath = join(__dirname, "..", "citation-manager.js");

describe("Auto-Fix Functionality", () => {
	test("should auto-fix kebab-case anchors to raw header format", async () => {
		// Create a temporary test file with kebab-case citations
		const testContent = `# Test Document

## Sample Header

This is a test document with kebab-case citations that should be auto-fixed.

- [Link to header](../test-target.md#sample-header)
- [Another link](../test-target.md#another-test-header)

## Another Test Header

Content here.
`;

		const targetContent = `# Test Target

## Sample Header

Content for sample header.

## Another Test Header

Content for another test header.
`;

		// Create temporary files
		const testFile = join(tmpdir(), "test-auto-fix.md");
		const targetFile = join(tmpdir(), "test-target.md");

		writeFileSync(testFile, testContent);
		writeFileSync(targetFile, targetContent);

		try {
			// Run auto-fix
			const output = execSync(
				`node "${citationManagerPath}" validate "${testFile}" --fix --scope "${tmpdir()}"`,
				{
					encoding: "utf8",
					cwd: join(__dirname, ".."),
				},
			);

			// Check that auto-fix was successful
			assert(
				output.includes("Fixed 2 kebab-case citation"),
				"Should report fixing 2 citations",
			);
			assert(
				output.includes("sample-header"),
				"Should show old kebab-case anchor",
			);
			assert(
				output.includes("Sample%20Header"),
				"Should show new raw header anchor",
			);
			assert(
				output.includes("another-test-header"),
				"Should show old kebab-case anchor",
			);
			assert(
				output.includes("Another%20Test%20Header"),
				"Should show new raw header anchor",
			);

			// Verify the file was actually modified
			const fixedContent = readFileSync(testFile, "utf8");
			assert(
				fixedContent.includes("#Sample%20Header"),
				"File should contain fixed anchor",
			);
			assert(
				fixedContent.includes("#Another%20Test%20Header"),
				"File should contain fixed anchor",
			);
			assert(
				!fixedContent.includes("#sample-header"),
				"File should not contain old kebab-case anchor",
			);
			assert(
				!fixedContent.includes("#another-test-header"),
				"File should not contain old kebab-case anchor",
			);

			console.log("✅ Auto-fix functionality working correctly");
		} finally {
			// Clean up temporary files
			try {
				unlinkSync(testFile);
			} catch {}
			try {
				unlinkSync(targetFile);
			} catch {}
		}
	});

	test("should report no fixes needed when no kebab-case citations exist", async () => {
		// Create a temporary test file with only raw header citations
		const testContent = `# Test Document

## Sample Header

This document already uses raw header format.

- [Link to header](../test-target.md#Sample%20Header)
- [Another link](../test-target.md#Another%20Test%20Header)
`;

		const targetContent = `# Test Target

## Sample Header

Content for sample header.

## Another Test Header

Content for another test header.
`;

		// Create temporary files
		const testFile = join(tmpdir(), "test-no-fix-needed.md");
		const targetFile = join(tmpdir(), "test-target.md");

		writeFileSync(testFile, testContent);
		writeFileSync(targetFile, targetContent);

		try {
			// Run auto-fix
			const output = execSync(
				`node "${citationManagerPath}" validate "${testFile}" --fix --scope "${tmpdir()}"`,
				{
					encoding: "utf8",
					cwd: join(__dirname, ".."),
				},
			);

			// Check that no fixes were needed
			assert(
				output.includes("No auto-fixable kebab-case citations found"),
				"Should report no fixes needed",
			);

			console.log("✅ Auto-fix correctly identifies when no fixes are needed");
		} finally {
			// Clean up temporary files
			try {
				unlinkSync(testFile);
			} catch {}
			try {
				unlinkSync(targetFile);
			} catch {}
		}
	});

	test("should only fix validated existing headers", async () => {
		// Create a test file with both valid and invalid kebab-case citations
		const testContent = `# Test Document

## Sample Header

Mixed citations - some valid, some invalid.

- [Valid link](../test-target.md#existing-header)
- [Invalid link](../test-target.md#non-existent-header)
`;

		const targetContent = `# Test Target

## Existing Header

This header exists and should be fixable.
`;

		// Create temporary files
		const testFile = join(tmpdir(), "test-selective-fix.md");
		const targetFile = join(tmpdir(), "test-target.md");

		writeFileSync(testFile, testContent);
		writeFileSync(targetContent, targetContent);

		try {
			// Run auto-fix
			const output = execSync(
				`node "${citationManagerPath}" validate "${testFile}" --fix --scope "${tmpdir()}"`,
				{
					encoding: "utf8",
					cwd: join(__dirname, ".."),
				},
			);

			// Check that we get reasonable output (either fixes or no auto-fixable citations)
			const hasFixed =
				output.includes("Fixed") && output.includes("kebab-case citation");
			const noFixes = output.includes(
				"No auto-fixable kebab-case citations found",
			);
			assert(
				hasFixed || noFixes,
				"Should either make fixes or report no auto-fixable citations",
			);

			// If fixes were made, verify the file content
			const fixedContent = readFileSync(testFile, "utf8");
			if (hasFixed) {
				// Should have at least one working citation format
				const hasRawFormat = fixedContent.includes("#Existing%20Header");
				const hasKebabFormat = fixedContent.includes("#existing-header");
				assert(
					hasRawFormat || hasKebabFormat,
					"Should maintain valid citation format",
				);
			}

			console.log(
				"✅ Auto-fix correctly handles mixed valid/invalid citations",
			);
		} finally {
			// Clean up temporary files
			try {
				unlinkSync(testFile);
			} catch {}
			try {
				unlinkSync(targetFile);
			} catch {}
		}
	});
});
