import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import { CitationValidator } from "../src/CitationValidator.js";
import { MarkdownParser } from "../src/core/MarkdownParser/index.js";
import { ParsedFileCache } from "../src/ParsedFileCache.js";
import { createCitationValidator } from "../src/factories/componentFactory.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturesDir = resolve(__dirname, "fixtures");

describe("Folder link detection (Issue #46)", () => {
	let validator;

	beforeEach(() => {
		const fs = { readFileSync };
		const parser = new MarkdownParser(fs);
		const cache = new ParsedFileCache(parser);
		validator = new CitationValidator(cache, null);
	});

	describe("validateSingleCitation warns on folder links", () => {
		it("should emit warning for link with trailing slash pointing to directory", async () => {
			// Given: A link pointing to an existing directory (trailing slash)
			const folderLink = {
				linkType: "markdown",
				scope: "cross-document",
				anchorType: null,
				source: { path: { absolute: join(fixturesDir, "valid-citations.md") } },
				target: {
					path: {
						raw: "subdir/",
						absolute: null,
						relative: null,
					},
					anchor: null,
				},
				text: "Subdir",
				fullMatch: "[Subdir](subdir/)",
				line: 10,
				column: 0,
				extractionMarker: null,
			};

			const result = await validator.validateSingleCitation(
				folderLink,
				join(fixturesDir, "valid-citations.md"),
			);

			expect(result.validation.status).toBe("warning");
			expect(result.validation.error).toContain("folder");
		});

		it("should emit warning for folder link without trailing slash", async () => {
			// Given: A link pointing to an existing directory (no trailing slash)
			const folderLink = {
				linkType: "markdown",
				scope: "cross-document",
				anchorType: null,
				source: { path: { absolute: join(fixturesDir, "valid-citations.md") } },
				target: {
					path: {
						raw: "subdir",
						absolute: null,
						relative: null,
					},
					anchor: null,
				},
				text: "Subdir",
				fullMatch: "[Subdir](subdir)",
				line: 10,
				column: 0,
				extractionMarker: null,
			};

			const result = await validator.validateSingleCitation(
				folderLink,
				join(fixturesDir, "valid-citations.md"),
			);

			expect(result.validation.status).toBe("warning");
			expect(result.validation.error).toContain("folder");
		});

		it("should suggest linking to a specific file or creating index.md", async () => {
			// Given: A folder link
			const folderLink = {
				linkType: "markdown",
				scope: "cross-document",
				anchorType: null,
				source: { path: { absolute: join(fixturesDir, "valid-citations.md") } },
				target: {
					path: {
						raw: "subdir/",
						absolute: null,
						relative: null,
					},
					anchor: null,
				},
				text: "Subdir",
				fullMatch: "[Subdir](subdir/)",
				line: 10,
				column: 0,
				extractionMarker: null,
			};

			const result = await validator.validateSingleCitation(
				folderLink,
				join(fixturesDir, "valid-citations.md"),
			);

			expect(result.validation.status).toBe("warning");
			// Should provide actionable suggestion
			expect(result.validation.suggestion).toBeDefined();
			expect(typeof result.validation.suggestion).toBe("string");
		});

		it("should not false-positive on legitimate file links", async () => {
			// Given: A link pointing to an actual file (not a folder)
			const fileLink = {
				linkType: "markdown",
				scope: "cross-document",
				anchorType: null,
				source: { path: { absolute: join(fixturesDir, "valid-citations.md") } },
				target: {
					path: {
						raw: "test-target.md",
						absolute: null,
						relative: null,
					},
					anchor: null,
				},
				text: "Target",
				fullMatch: "[Target](test-target.md)",
				line: 10,
				column: 0,
				extractionMarker: null,
			};

			const result = await validator.validateSingleCitation(
				fileLink,
				join(fixturesDir, "valid-citations.md"),
			);

			// Should be valid, not a folder warning
			expect(result.validation.status).toBe("valid");
		});
	});

	describe("validateFile integration with folder links", () => {
		it("should detect folder links in a markdown file and report warnings", async () => {
			const factoryValidator = createCitationValidator();
			const testFile = join(fixturesDir, "folder-link-test.md");

			const result = await factoryValidator.validateFile(testFile);

			// Should have warnings for folder links
			expect(result.summary.warnings).toBeGreaterThan(0);

			const warningLinks = result.links.filter(
				(link) => link.validation.status === "warning",
			);
			expect(warningLinks.length).toBeGreaterThan(0);

			// At least one warning should mention "folder"
			const folderWarning = warningLinks.find(
				(link) =>
					link.validation.status !== "valid" &&
					link.validation.error?.toLowerCase().includes("folder"),
			);
			expect(folderWarning).toBeTruthy();
		});
	});
});
