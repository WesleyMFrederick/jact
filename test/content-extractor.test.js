// tools/citation-manager/test/content-extractor.test.js
import { describe, expect, it } from "vitest";
import { ContentExtractor } from "../src/core/ContentExtractor/ContentExtractor.js";
import { SectionLinkStrategy } from "../src/core/ContentExtractor/eligibilityStrategies/SectionLinkStrategy.js";
import { StopMarkerStrategy } from "../src/core/ContentExtractor/eligibilityStrategies/StopMarkerStrategy.js";

describe("ContentExtractor", () => {
	it("should instantiate with strategy array", () => {
		// Given: Strategy array
		const strategies = [new StopMarkerStrategy(), new SectionLinkStrategy()];

		// When: ContentExtractor created
		const extractor = new ContentExtractor(strategies);

		// Then: Instance created successfully
		expect(extractor).toBeInstanceOf(ContentExtractor);
	});

	it("should analyze eligibility using injected strategies", () => {
		// Given: ContentExtractor with strategies
		const strategies = [new SectionLinkStrategy()];
		const extractor = new ContentExtractor(strategies);
		const link = { anchorType: "header", extractionMarker: null };

		// When: analyzeEligibility called
		const result = extractor.analyzeEligibility(link, {});

		// Then: Returns decision from strategy chain
		expect(result).toEqual({
			eligible: true,
			reason: "Markdown anchor links eligible by default",
		});
	});

	it("should handle empty strategy array gracefully", () => {
		// Given: ContentExtractor with empty strategies
		const extractor = new ContentExtractor([]);
		const link = { anchorType: "header" };

		// When: analyzeEligibility called
		const result = extractor.analyzeEligibility(link, {});

		// Then: Returns fallback decision
		expect(result).toEqual({
			eligible: false,
			reason: "No strategy matched",
		});
	});
});
