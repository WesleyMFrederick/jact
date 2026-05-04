// Phase 3B.2 — CitationValidator summary wiring assertions (D3 + GAP-5).
// Asserts byLinkClass + errorBreakdown population via the exported
// computeValidationSummary helper. Suggestion-path assertions deferred to P4.

import { describe, expect, it } from "vitest";
import { computeValidationSummary } from "../../src/CitationValidator.js";
import type { LinkObject } from "../../src/types/citationTypes.js";
import type {
	EnrichedLinkObject,
	ValidationMetadata,
} from "../../src/types/validationTypes.js";

function makeLink(
	overrides: Partial<LinkObject> & { validation: ValidationMetadata },
): EnrichedLinkObject {
	const base: LinkObject = {
		linkType: "markdown",
		scope: "internal",
		anchorType: "header",
		source: { path: { absolute: "/x.md" } },
		target: {
			path: { raw: null, absolute: null, relative: null },
			anchor: null,
		},
		text: null,
		fullMatch: "[T](x.md)",
		line: 1,
		column: 0,
		extractionMarker: null,
	};
	return { ...base, ...overrides } as EnrichedLinkObject;
}

describe("computeValidationSummary — D3 byLinkClass + errorBreakdown wiring", () => {
	it("counts every link via getLinkClass — markdown + wiki + caret", () => {
		const links: EnrichedLinkObject[] = [
			makeLink({
				linkType: "markdown",
				anchorType: "header",
				validation: { status: "valid" },
			}),
			makeLink({
				linkType: "markdown",
				anchorType: "header",
				validation: { status: "valid" },
			}),
			makeLink({
				linkType: "wiki",
				anchorType: "header",
				validation: { status: "valid" },
			}),
			makeLink({
				linkType: "markdown",
				anchorType: "block",
				validation: { status: "valid" },
			}),
		];
		const summary = computeValidationSummary(links, 0);
		expect(summary.byLinkClass.markdown).toBe(2);
		expect(summary.byLinkClass.wiki).toBe(1);
		expect(summary.byLinkClass.caret).toBe(1);
		expect(summary.total).toBe(4);
	});

	it("unrecognizedCount mirrors arg; errors derived per GAP-5 invariant", () => {
		const links: EnrichedLinkObject[] = [
			makeLink({
				validation: { status: "error", error: "bad" },
			}),
			makeLink({
				validation: { status: "error", error: "bad" },
			}),
			makeLink({
				validation: { status: "valid" },
			}),
		];
		const summary = computeValidationSummary(links, 3);
		expect(summary.unrecognizedCount).toBe(3);
		expect(summary.errorBreakdown.brokenLinks).toBe(2);
		expect(summary.errorBreakdown.unrecognized).toBe(3);
		// GAP-5 invariant: errors === brokenLinks + unrecognized
		expect(summary.errors).toBe(
			summary.errorBreakdown.brokenLinks + summary.errorBreakdown.unrecognized,
		);
		expect(summary.errors).toBe(5);
	});

	it("empty link list — all classes zero, no derived errors", () => {
		const summary = computeValidationSummary([], 0);
		expect(summary.byLinkClass).toEqual({ markdown: 0, wiki: 0, caret: 0 });
		expect(summary.total).toBe(0);
		expect(summary.errors).toBe(0);
		expect(summary.unrecognizedCount).toBe(0);
		expect(summary.errorBreakdown.brokenLinks).toBe(0);
		expect(summary.errorBreakdown.unrecognized).toBe(0);
	});

	it("warnings counted separately; errors only counts status=error + unrecognized", () => {
		const links: EnrichedLinkObject[] = [
			makeLink({ validation: { status: "warning", error: "warn" } }),
			makeLink({ validation: { status: "warning", error: "warn" } }),
			makeLink({ validation: { status: "error", error: "bad" } }),
		];
		const summary = computeValidationSummary(links, 1);
		expect(summary.warnings).toBe(2);
		expect(summary.errorBreakdown.brokenLinks).toBe(1);
		expect(summary.errors).toBe(2); // 1 broken + 1 unrecognized
	});
});
