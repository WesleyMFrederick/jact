import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import { createContentExtractor } from "../../../src/factories/componentFactory.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturesDir = join(__dirname, "..", "..", "fixtures");

describe("ContentExtractor Integration - _totalContentCharacterLength", () => {
	let extractor;

	beforeEach(() => {
		extractor = createContentExtractor();
	});

	it("should include _totalContentCharacterLength in real extraction", async () => {
		// Given: Real enriched links from test fixture
		const sourceFile = join(
			fixturesDir,
			"section-extraction",
			"links.md",
		);

		// When: Extract with real cache and parsers
		const result = await extractor.extractLinksContent(sourceFile, {
			fullFiles: false,
		});

		// Then: Metadata field exists
		expect(result.extractedContentBlocks._totalContentCharacterLength).toBeDefined();
		expect(typeof result.extractedContentBlocks._totalContentCharacterLength).toBe("number");

		// Verify approximation accuracy
		const actualSize = JSON.stringify(result.extractedContentBlocks).length;
		const reportedSize = result.extractedContentBlocks._totalContentCharacterLength;
		const margin = actualSize - reportedSize;

		expect(margin).toBeGreaterThan(0);
		expect(margin).toBeLessThan(100); // Generous margin for integration test
	});
});
