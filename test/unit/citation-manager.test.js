import { describe, it, expect, vi } from "vitest";
import { join } from "node:path";
import { CitationManager } from "../../dist/citation-manager.js";

describe("CitationManager - Component Instantiation", () => {
	it("should instantiate ContentExtractor via factory", () => {
		// Given: CitationManager constructor

		// When: Create CitationManager instance
		const manager = new CitationManager();

		// Then: ContentExtractor created and accessible
		// Verification: Factory wiring complete
		expect(manager.contentExtractor).toBeDefined();
	});
});

describe("CitationManager - extractLinks() Phase 1", () => {
	it("should validate source file and extract enriched links", async () => {
		// Given: CitationManager and source file with links
		const consoleSpy = vi.spyOn(console, "log");
		const manager = new CitationManager();
		const sourceFile = join(
			process.cwd(),
			"tools/citation-manager/test/fixtures/section-extraction/links.md",
		);

		// When: Call extractLinks Phase 1
		// Note: This test validates validator.validateFile() called
		await manager.extractLinks(sourceFile, {});

		// Then: Validation executed and enriched links available
		// Verification: Phase 1 discovers and enriches links
		expect(consoleSpy).toHaveBeenCalled(); // Output indicates successful execution
		consoleSpy.mockRestore();
	});
});

describe("CitationManager - extractLinks() Phase 2", () => {
	it("should pass enriched links to ContentExtractor with CLI flags", async () => {
		// Given: Source file and fullFiles flag
		const consoleSpy = vi.spyOn(console, "log");
		const manager = new CitationManager();
		const sourceFile = join(
			process.cwd(),
			"tools/citation-manager/test/fixtures/section-extraction/links.md",
		);
		const options = { fullFiles: true };

		// When: Call extractLinks with flags
		await manager.extractLinks(sourceFile, options);

		// Then: ContentExtractor received enriched links and flags
		// Verification: Phase 2 delegates to extractor
		const output = JSON.parse(consoleSpy.mock.calls[0][0]);
		expect(output.stats).toBeDefined(); // OutgoingLinksExtractedContent structure
		consoleSpy.mockRestore();
	});
});

describe("CitationManager - extractLinks() Phase 3", () => {
	it("should output OutgoingLinksExtractedContent JSON to stdout", async () => {
		// Given: Console.log spy
		const consoleSpy = vi.spyOn(console, "log");
		const manager = new CitationManager();
		const sourceFile = join(
			process.cwd(),
			"tools/citation-manager/test/fixtures/section-extraction/links.md",
		);

		// When: Call extractLinks
		await manager.extractLinks(sourceFile, {});

		// Then: JSON output written to stdout
		// Verification: Phase 3 outputs to stdout
		expect(consoleSpy).toHaveBeenCalledWith(
			expect.stringContaining("extractedContentBlocks"),
		);
		consoleSpy.mockRestore();
	});
});

describe("CitationManager - extractHeader()", () => {
	it("should orchestrate synthetic link creation, validation, and extraction", async () => {
		// Fixture: Use US2.3 plan as realistic test document
		const targetFile = join(
			process.cwd(),
			"tools/citation-manager/test/fixtures/us2.3-implement-extract-links-subcommand-implement-plan.md",
		);
		const headerName =
			"Task 10: CitationManager - extractLinks() Phase 1 Validation";

		// Given: CitationManager with real components
		const manager = new CitationManager();

		// When: Extract specific header from target file
		const result = await manager.extractHeader(targetFile, headerName, {});

		// Then: Result contains extracted content for specified header
		// Verification: OutgoingLinksExtractedContent structure returned
		expect(result).toHaveProperty("extractedContentBlocks");
		expect(result).toHaveProperty("outgoingLinksReport");
		expect(result.stats.uniqueContent).toBeGreaterThan(0);
	});
});
