import { describe, expect, it } from "vitest";
import { CliFlagStrategy } from "../../../src/core/ContentExtractor/eligibilityStrategies/CliFlagStrategy.js";
import { ForceMarkerStrategy } from "../../../src/core/ContentExtractor/eligibilityStrategies/ForceMarkerStrategy.js";
import { SectionLinkStrategy } from "../../../src/core/ContentExtractor/eligibilityStrategies/SectionLinkStrategy.js";
import { StopMarkerStrategy } from "../../../src/core/ContentExtractor/eligibilityStrategies/StopMarkerStrategy.js";

describe("ExtractionEligibilityStrategy interface compliance", () => {
	it("StopMarkerStrategy implements ExtractionEligibilityStrategy directly", () => {
		// Given: Strategy instantiated without base class
		const strategy = new StopMarkerStrategy();

		// When: getDecision() called with link that has no stop marker
		const result = strategy.getDecision({ extractionMarker: null }, {});

		// Then: Returns null (passes to next strategy)
		expect(result).toBeNull();
	});

	it("ForceMarkerStrategy implements ExtractionEligibilityStrategy directly", () => {
		// Given: Strategy instantiated without base class
		const strategy = new ForceMarkerStrategy();

		// When: getDecision() called with link that has no force marker
		const result = strategy.getDecision({ extractionMarker: null }, {});

		// Then: Returns null (passes to next strategy)
		expect(result).toBeNull();
	});

	it("CliFlagStrategy implements ExtractionEligibilityStrategy directly", () => {
		// Given: Strategy instantiated without base class
		const strategy = new CliFlagStrategy();

		// When: getDecision() called with fullFiles flag false
		const result = strategy.getDecision({}, { fullFiles: false });

		// Then: Returns a decision (terminal strategy never returns null)
		expect(result).not.toBeNull();
		expect(result).toHaveProperty("eligible");
		expect(result).toHaveProperty("reason");
	});

	it("SectionLinkStrategy implements ExtractionEligibilityStrategy directly", () => {
		// Given: Strategy instantiated without base class
		const strategy = new SectionLinkStrategy();

		// When: getDecision() called with link that has no anchor
		const result = strategy.getDecision({ anchorType: null }, {});

		// Then: Returns null (passes to next strategy)
		expect(result).toBeNull();
	});
});
