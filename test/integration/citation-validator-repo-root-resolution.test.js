import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createCitationValidator } from "../../src/factories/componentFactory.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturesDir = join(__dirname, "..", "fixtures");

describe("Issue #13: repo-root-relative path resolution", () => {
	describe("footnote paths resolved from repo root", () => {
		it("should resolve footnote paths relative to repo root when file-relative fails", async () => {
			// Given: A markdown file in a subdirectory with footnotes pointing to
			// files using repo-root-relative paths (e.g., test/fixtures/file.md)
			const validator = createCitationValidator();
			const sourceFile = join(
				fixturesDir,
				"subdir",
				"issue-13-footnote-source.md",
			);

			// When: Validating the file
			const result = await validator.validateFile(sourceFile);

			// Then: The footnote [^S-001] pointing to test/fixtures/issue-13-repo-root-target.md
			// should resolve successfully (not "File not found")
			const footnoteLink = result.links.find(
				(link) =>
					link.target.path.raw === "test/fixtures/issue-13-repo-root-target.md",
			);
			expect(footnoteLink).toBeDefined();
			expect(footnoteLink.validation.status).not.toBe("error");
			// Should be valid or warning (warning acceptable for cross-directory resolution)
			expect(["valid", "warning"]).toContain(footnoteLink.validation.status);
		});
	});

	describe("mailto links should not be treated as file paths", () => {
		it("should skip mailto links during file resolution", async () => {
			// Given: A markdown file with a mailto: footnote
			const validator = createCitationValidator();
			const sourceFile = join(
				fixturesDir,
				"subdir",
				"issue-13-footnote-source.md",
			);

			// When: Validating the file
			const result = await validator.validateFile(sourceFile);

			// Then: The mailto: link should NOT produce a "File not found" error
			const mailtoLink = result.links.find(
				(link) =>
					link.target.path.raw?.startsWith("mailto:") ||
					link.fullMatch.includes("mailto:"),
			);
			// Either mailto is not extracted as a link at all (ideal),
			// or if extracted, it should not be an error
			if (mailtoLink) {
				expect(mailtoLink.validation.status).not.toBe("error");
			}
			// Verify no error messages mention mailto
			const mailtoErrors = result.links.filter(
				(link) =>
					link.validation.status === "error" &&
					(link.validation.error?.includes("mailto") ||
						link.target.path.raw?.includes("mailto")),
			);
			expect(mailtoErrors).toHaveLength(0);
		});
	});

	describe("non-markdown footnote targets from repo root", () => {
		it("should resolve non-.md footnote targets relative to repo root", async () => {
			// Given: A markdown file in a subdirectory with footnotes pointing to
			// .ts files using repo-root-relative paths
			const validator = createCitationValidator();
			const sourceFile = join(
				fixturesDir,
				"subdir",
				"issue-13-non-md-footnote-source.md",
			);

			// When: Validating the file
			const result = await validator.validateFile(sourceFile);

			// Then: The footnote pointing to test/fixtures/issue-13-target-script.ts
			// should resolve successfully
			const tsLink = result.links.find(
				(link) =>
					link.target.path.raw === "test/fixtures/issue-13-target-script.ts",
			);
			expect(tsLink).toBeDefined();
			expect(tsLink.validation.status).not.toBe("error");
			expect(["valid", "warning"]).toContain(tsLink.validation.status);
		});
	});
});
