import { describe, expect, it } from "vitest";
import { getLinkClass } from "../../src/core/getLinkClass.js";
import type { LinkObject } from "../../src/types/citationTypes.js";
import type { LinkClass } from "../../src/types/validationTypes.js";

const baseLink = (
	overrides: Partial<LinkObject> & Pick<LinkObject, "linkType" | "anchorType">,
): LinkObject => ({
	scope: "cross-document",
	source: { path: { absolute: "/tmp/source.md" } },
	target: {
		path: { raw: "target.md", absolute: null, relative: null },
		anchor: null,
	},
	text: "x",
	fullMatch: "[x](target.md)",
	line: 1,
	column: 0,
	extractionMarker: null,
	...overrides,
});

describe("getLinkClass", () => {
	it("returns 'wiki' for a wiki LinkObject", () => {
		const link = baseLink({ linkType: "wiki", anchorType: null });
		expect(getLinkClass(link)).toBe<LinkClass>("wiki");
	});

	it("returns 'caret' for markdown LinkObject with anchorType === 'block'", () => {
		const link = baseLink({ linkType: "markdown", anchorType: "block" });
		expect(getLinkClass(link)).toBe<LinkClass>("caret");
	});

	it("returns 'markdown' for markdown LinkObject with anchorType === 'header'", () => {
		const link = baseLink({ linkType: "markdown", anchorType: "header" });
		expect(getLinkClass(link)).toBe<LinkClass>("markdown");
	});

	it("returns 'markdown' for markdown LinkObject with no anchor", () => {
		const link = baseLink({ linkType: "markdown", anchorType: null });
		expect(getLinkClass(link)).toBe<LinkClass>("markdown");
	});

	it("maps every (linkType × anchorType) cell to exactly one LinkClass — no fall-through, no undefined", () => {
		const linkTypes: LinkObject["linkType"][] = ["markdown", "wiki"];
		const anchorTypes: LinkObject["anchorType"][] = ["header", "block", null];
		const allowed: ReadonlySet<LinkClass> = new Set([
			"markdown",
			"wiki",
			"caret",
		]);

		const expected: Record<string, LinkClass> = {
			"markdown|header": "markdown",
			"markdown|block": "caret",
			"markdown|null": "markdown",
			"wiki|header": "wiki",
			"wiki|block": "wiki",
			"wiki|null": "wiki",
		};

		for (const linkType of linkTypes) {
			for (const anchorType of anchorTypes) {
				const link = baseLink({ linkType, anchorType });
				const result = getLinkClass(link);
				expect(allowed.has(result)).toBe(true);
				expect(result).not.toBeUndefined();
				const key = `${linkType}|${anchorType ?? "null"}`;
				expect(result).toBe(expected[key]);
			}
		}
	});
});
