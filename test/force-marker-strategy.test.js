import { describe, expect, it } from "vitest";
import { ForceMarkerStrategy } from "../src/core/ContentExtractor/eligibilityStrategies/ForceMarkerStrategy.js";

describe("ForceMarkerStrategy", () => {
	it("should return eligible when force-extract marker is present", () => {
		// Given: Full-file link with force marker
		const strategy = new ForceMarkerStrategy();
		const link = {
			extractionMarker: { innerText: "force-extract" },
			anchorType: null,
		};

		// When: getDecision called without --full-files flag
		const result = strategy.getDecision(link, { fullFiles: false });

		// Then: Returns eligible (overrides default full-file behavior)
		expect(result).toEqual({
			eligible: true,
			reason: "force-extract overrides defaults",
		});
	});

	it("should return null when no marker is present", () => {
		// Given: Link without extraction marker
		const strategy = new ForceMarkerStrategy();
		const link = { extractionMarker: null, anchorType: null };

		// When: getDecision called
		const result = strategy.getDecision(link, {});

		// Then: Returns null (pass to next strategy)
		expect(result).toBeNull();
	});

	it("should return null when stop marker is present", () => {
		// Given: Link with stop-extract-link marker
		const strategy = new ForceMarkerStrategy();
		const link = {
			extractionMarker: { innerText: "stop-extract-link" },
			anchorType: "header",
		};

		// When: getDecision called
		const result = strategy.getDecision(link, {});

		// Then: Returns null (not this strategy's marker)
		expect(result).toBeNull();
	});
});
