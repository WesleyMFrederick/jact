import { describe, expect, it } from "vitest";
import { StopMarkerStrategy } from "../src/core/ContentExtractor/eligibilityStrategies/StopMarkerStrategy.js";

describe("StopMarkerStrategy", () => {
	it("should return ineligible when stop-extract-link marker is present", () => {
		// Given: Strategy instance and link with stop marker
		const strategy = new StopMarkerStrategy();
		const link = {
			extractionMarker: { innerText: "stop-extract-link" },
			anchorType: "header",
		};

		// When: getDecision called
		const result = strategy.getDecision(link, {});

		// Then: Returns ineligible decision
		expect(result).toEqual({
			eligible: false,
			reason: "stop-extract-link marker prevents extraction",
		});
	});

	it("should return null when no marker is present", () => {
		// Given: Link without extraction marker
		const strategy = new StopMarkerStrategy();
		const link = { extractionMarker: null, anchorType: "header" };

		// When: getDecision called
		const result = strategy.getDecision(link, {});

		// Then: Returns null (pass to next strategy)
		expect(result).toBeNull();
	});

	it("should return null when different marker is present", () => {
		// Given: Link with force-extract marker
		const strategy = new StopMarkerStrategy();
		const link = {
			extractionMarker: { innerText: "force-extract" },
			anchorType: null,
		};

		// When: getDecision called
		const result = strategy.getDecision(link, {});

		// Then: Returns null (not this strategy's marker)
		expect(result).toBeNull();
	});
});
