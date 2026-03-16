import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createCitationValidator } from "../../src/factories/componentFactory.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturesDir = join(__dirname, "..", "fixtures");

describe("Issue #16: detect nested backtick codeblocks", () => {
	describe("nested backtick detection", () => {
		it("should flag nested backtick codeblocks as warnings", async () => {
			// Given: A markdown file with backtick fences nested inside backtick fences
			const validator = createCitationValidator();
			const sourceFile = join(fixturesDir, "issue-16-nested-backticks.md");

			// When: Validating the file
			const result = await validator.validateFile(sourceFile);

			// Then: Should have diagnostics with a warning about nested backtick codeblocks
			expect(result.diagnostics).toBeDefined();
			expect(result.diagnostics.length).toBeGreaterThan(0);

			const nestedWarning = result.diagnostics.find(
				(d) => d.message.includes("nested") || d.message.includes("Nested"),
			);
			expect(nestedWarning).toBeDefined();
			expect(nestedWarning.status).toBe("warning");
			expect(nestedWarning.line).toBeGreaterThan(0);
		});

		it("should suggest using tilde fences for the outer block", async () => {
			// Given: A file with nested backtick codeblocks
			const validator = createCitationValidator();
			const sourceFile = join(fixturesDir, "issue-16-nested-backticks.md");

			// When: Validating the file
			const result = await validator.validateFile(sourceFile);

			// Then: The diagnostic should suggest using ~~~ for the outer block
			const nestedWarning = result.diagnostics.find(
				(d) => d.message.includes("nested") || d.message.includes("Nested"),
			);
			expect(nestedWarning.suggestion).toBeDefined();
			expect(nestedWarning.suggestion).toMatch(/~~~/);
		});
	});

	describe("valid tilde-wrapped outer blocks", () => {
		it("should NOT flag tilde outer blocks containing backtick inner blocks", async () => {
			// Given: A markdown file that correctly uses ~~~ for outer and ``` for inner
			const validator = createCitationValidator();
			const sourceFile = join(fixturesDir, "issue-16-tilde-outer-valid.md");

			// When: Validating the file
			const result = await validator.validateFile(sourceFile);

			// Then: No nested codeblock diagnostics should be present
			const diagnostics = result.diagnostics ?? [];
			const nestedWarnings = diagnostics.filter(
				(d) => d.message.includes("nested") || d.message.includes("Nested"),
			);
			expect(nestedWarnings).toHaveLength(0);
		});
	});

	describe("diagnostics included in summary", () => {
		it("should include diagnostic warnings in the summary warning count", async () => {
			// Given: A file with nested backtick codeblocks
			const validator = createCitationValidator();
			const sourceFile = join(fixturesDir, "issue-16-nested-backticks.md");

			// When: Validating the file
			const result = await validator.validateFile(sourceFile);

			// Then: Summary warning count should include diagnostic warnings
			const diagnosticWarnings = result.diagnostics.filter(
				(d) => d.status === "warning",
			);
			expect(result.summary.warnings).toBeGreaterThanOrEqual(
				diagnosticWarnings.length,
			);
		});
	});
});
