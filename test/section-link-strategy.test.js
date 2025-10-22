import { describe, expect, it } from "vitest";
import { SectionLinkStrategy } from "../src/core/ContentExtractor/eligibilityStrategies/SectionLinkStrategy.js";

describe("SectionLinkStrategy", () => {
	it("should return eligible when link has header anchor", () => {
		// Given: Link with header anchor
		const strategy = new SectionLinkStrategy();
		const link = {
			anchorType: "header",
			target: { anchor: "Section Heading" },
		};

		// When: getDecision called
		const result = strategy.getDecision(link, {});

		// Then: Returns eligible (section links eligible by default)
		expect(result).toEqual({
			eligible: true,
			reason: "Markdown anchor links eligible by default",
		});
	});

	it("should return eligible when link has block anchor", () => {
		// Given: Link with block anchor
		const strategy = new SectionLinkStrategy();
		const link = {
			anchorType: "block",
			target: { anchor: "FR1" },
		};

		// When: getDecision called
		const result = strategy.getDecision(link, {});

		// Then: Returns eligible (block links eligible by default)
		expect(result).toEqual({
			eligible: true,
			reason: "Markdown anchor links eligible by default",
		});
	});

	it("should return null when link has no anchor", () => {
		// Given: Full-file link (anchorType: null)
		const strategy = new SectionLinkStrategy();
		const link = {
			anchorType: null,
			target: { anchor: null },
		};

		// When: getDecision called
		const result = strategy.getDecision(link, {});

		// Then: Returns null (pass to next strategy)
		expect(result).toBeNull();
	});
});
