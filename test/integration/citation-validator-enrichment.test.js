import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import { CitationValidator } from "../../src/CitationValidator.js";
import { MarkdownParser } from "../../src/core/MarkdownParser/index.js";
import { ParsedFileCache } from "../../src/ParsedFileCache.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("CitationValidator Validation Enrichment Pattern", () => {
	let validator;
	let parser;
	let cache;
	let validLinksSourcePath;
	let errorLinksSourcePath;
	let mixedValidationSourcePath;

	beforeEach(() => {
		// Create real components with DI (no mocks)
		const fs = { readFileSync };
		parser = new MarkdownParser(fs);
		cache = new ParsedFileCache(parser);
		validator = new CitationValidator(cache, null);

		// Use real fixture files with mixed valid/invalid links
		validLinksSourcePath = resolve(
			__dirname,
			"../fixtures/enrichment/valid-links-source.md",
		);
		errorLinksSourcePath = resolve(
			__dirname,
			"../fixtures/enrichment/error-links-source.md",
		);
		mixedValidationSourcePath = resolve(
			__dirname,
			"../fixtures/enrichment/mixed-validation-source.md",
		);
	});

	it("should return ValidationResult with summary and enriched links", async () => {
		// Given: Real markdown file with citations
		// When: Validate file using enrichment pattern
		const result = await validator.validateFile(validLinksSourcePath);

		// Then: Result has correct structure
		expect(result).toHaveProperty("summary");
		expect(result).toHaveProperty("links");
		expect(result).not.toHaveProperty("results"); // OLD contract removed
	});

	it("should enrich valid LinkObjects with validation status", async () => {
		// Given: File with valid citations
		// When: Validation completes
		const { links } = await validator.validateFile(validLinksSourcePath);

		// Then: Valid links enriched with status="valid"
		const validLink = links.find(
			(link) =>
				link.validation.status === "valid" && link.scope === "cross-document",
		);
		expect(validLink).toBeDefined();
		expect(validLink.validation).toBeDefined();
		expect(validLink.validation.status).toBe("valid");
		expect(validLink.validation).not.toHaveProperty("error");
	});

	it("should enrich error LinkObjects with error and suggestion", async () => {
		// Given: File with broken anchor
		// When: Validation completes
		const { links } = await validator.validateFile(errorLinksSourcePath);

		// Then: Error links enriched with status="error", error message, suggestion
		const errorLink = links.find(
			(link) =>
				link.linkType === "markdown" &&
				link.scope === "cross-document" &&
				link.validation.status === "error",
		);
		expect(errorLink).toBeDefined();
		expect(errorLink.validation.status).toBe("error");
		expect(errorLink.validation.error).toContain("Anchor not found");
	});

	it("should derive summary counts from enriched links", async () => {
		// Given: File with 2 valid, 2 error links
		// When: Validation completes
		const { summary, links } = await validator.validateFile(
			mixedValidationSourcePath,
		);

		// Then: Summary matches link.validation.status counts
		const manualCounts = {
			total: links.length,
			valid: links.filter((link) => link.validation.status === "valid").length,
			errors: links.filter((link) => link.validation.status === "error").length,
			warnings: links.filter((link) => link.validation.status === "warning")
				.length,
		};

		expect(summary.total).toBe(manualCounts.total);
		expect(summary.valid).toBe(manualCounts.valid);
		expect(summary.errors).toBe(manualCounts.errors);
		expect(summary.warnings).toBe(manualCounts.warnings);
	});

	it("should preserve LinkObject base properties from parser", async () => {
		// Given: Validated file
		// When: Retrieve enriched links
		const { links } = await validator.validateFile(validLinksSourcePath);

		// Then: Original LinkObject properties unchanged
		const link = links[0];
		expect(link).toHaveProperty("linkType");
		expect(link).toHaveProperty("scope");
		expect(link).toHaveProperty("source");
		expect(link).toHaveProperty("target");
		expect(link).toHaveProperty("fullMatch");
		expect(link).toHaveProperty("line");
		expect(link).toHaveProperty("column");
		expect(link).toHaveProperty("validation"); // NEW: Added by validator
	});

	it("should support single-object access pattern for validation status", async () => {
		// Given: Component needs both link structure and validation
		// When: Access enriched LinkObject
		const { links } = await validator.validateFile(validLinksSourcePath);
		const link = links[0];

		// Then: Single object provides both structure and validation
		const isValid = link.validation.status === "valid";
		const targetPath = link.target.path;
		const lineNumber = link.line;

		// Verify all data accessible from one object
		expect(isValid).toBeDefined();
		expect(targetPath).toBeDefined();
		expect(lineNumber).toBeGreaterThan(0);
	});
});
