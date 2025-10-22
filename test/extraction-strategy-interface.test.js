import { describe, expect, it } from "vitest";
import { ExtractionStrategy } from "../src/core/ContentExtractor/eligibilityStrategies/ExtractionStrategy.js";

describe("ExtractionStrategy Interface", () => {
	it("should return null when base strategy is called", () => {
		// Given: ExtractionStrategy instance
		const strategy = new ExtractionStrategy();

		// When: getDecision() called with empty link and flags
		const result = strategy.getDecision({}, {});

		// Then: Returns null (base implementation passes to next strategy)
		expect(result).toBeNull();
	});

	it("should return null when subclass does not override getDecision", () => {
		// Given: Strategy subclass without override
		class TestStrategy extends ExtractionStrategy {}
		const strategy = new TestStrategy();

		// When: getDecision() called
		const result = strategy.getDecision({}, {});

		// Then: Returns null (inherited base behavior)
		expect(result).toBeNull();
	});
});
