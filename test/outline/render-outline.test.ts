import { describe, expect, it } from "vitest";
import { renderOutline } from "../../src/outline/render-outline.js";
import type { HeadingObject } from "../../src/types/citationTypes.js";

function headings(...values: Array<[number, string]>): HeadingObject[] {
	return values.map(([level, text]) => ({ level, text, raw: "" }));
}

function positionedHeadings(
	...values: Array<[number, string, number]>
): HeadingObject[] {
	return values.map(([level, text, line]) => ({
		level,
		text,
		raw: "",
		position: {
			start: { line, column: 1, offset: 0 },
			end: { line, column: 1, offset: 0 },
		},
	}));
}

describe("renderOutline", () => {
	it("renders quoted H1-H2 nodes and marks collapsed branches by default", () => {
		const result = renderOutline(
			headings(
				[1, "Guide"],
				[2, "Install"],
				[3, "macOS"],
				[4, "Homebrew"],
				[2, "Troubleshooting"],
				[3, "Logs"],
			),
		);

		expect(result.text).toContain('"Guide" [*]');
		expect(result.text).toContain('├── "Install" [*]');
		expect(result.text).toContain('└── "Troubleshooting" [*]');
		expect(result.text).not.toContain('"macOS"');
		expect(result.text).not.toContain('"Homebrew"');
	});

	it("preserves actual hierarchy when heading levels are skipped", () => {
		const result = renderOutline(headings([1, "Guide"], [4, "Deep"]), {
			maxLevel: 6,
		});

		expect(result.text).toBe('"Guide"\n└── "Deep"');
		expect(result.text).not.toContain("H2");
		expect(result.text).not.toContain("H3");
	});

	it("fully expands only the selected branch", () => {
		const result = renderOutline(
			headings(
				[1, "Guide"],
				[2, "Install"],
				[3, "macOS"],
				[4, "Homebrew"],
				[2, "Troubleshooting"],
				[3, "Logs"],
			),
			{ expandedIndexes: new Set([1]) },
		);

		expect(result.text).toContain('"macOS"');
		expect(result.text).toContain('"Homebrew"');
		expect(result.text).toContain('"Troubleshooting" [*]');
		expect(result.text).not.toContain('"Install" [*]');
		expect(result.text).not.toContain('"Logs"');
	});

	it("retains ancestor context while narrowing to a unique parent", () => {
		const result = renderOutline(
			headings(
				[1, "Handbook"],
				[2, "Guide"],
				[3, "Install"],
				[2, "Appendix"],
				[3, "Install"],
			),
			{ maxLevel: 3, withinIndex: 1 },
		);

		expect(result.text).toContain('"Handbook"');
		expect(result.text).toContain('"Guide"');
		expect(result.text).toContain('"Install"');
		expect(result.text).not.toContain('"Appendix"');
	});

	it("renders only one exact heading level without collapsed markers", () => {
		const result = renderOutline(
			headings(
				[1, "Guide"],
				[2, "Install"],
				[3, "macOS"],
				[3, "Linux"],
				[2, "Troubleshooting"],
				[3, "Logs"],
			),
			{ exactHeadingLevel: 3 },
		);

		expect(result).toEqual({
			text: '"macOS"\n"Linux"\n"Logs"',
			collapsedIndexes: [],
		});
	});

	it("prefixes visible headings with parser-derived source lines", () => {
		const result = renderOutline(
			positionedHeadings([1, "Guide", 1], [2, "Install", 11]),
			{ maxLevel: 2, lineNumber: true },
		);

		expect(result.text).toBe('     1  "Guide"\n    11  └── "Install"');
	});

	it("fails clearly when a visible heading has no parser source position", () => {
		expect(() =>
			renderOutline(headings([1, "Guide"]), { lineNumber: true }),
		).toThrow(
			'Cannot render line numbers: heading "Guide" has no parser source position.',
		);
	});

	it("returns the heading-free guidance for an empty heading collection", () => {
		const result = renderOutline([]);

		expect(result).toEqual({
			text: "No headings found. Use jact extract file for all content.",
			collapsedIndexes: [],
		});
	});
});
