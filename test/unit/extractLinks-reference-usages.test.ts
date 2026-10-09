import { describe, expect, it } from "vitest";
import { createMarkdownParser } from "../../src/factories/componentFactory.js";

const parse = (content: string) =>
	createMarkdownParser().parseContent(content, "/notes/a.md");

describe("parser — split-style link facts", () => {
	it("marks links built from reference definitions", () => {
		const output = parse("See [b][s].\n\n[s]: b.md#Sec\n");

		const definition = output.links.find(
			(link) => link.target.path.raw === "b.md",
		);
		expect(definition?.markdownForm).toBe("definition");
		expect(parse("[b](b.md#Sec)\n").links[0]?.markdownForm).toBeUndefined();
	});

	it("collects full, collapsed and shortcut usages with their source slice", () => {
		const content = "One [b][s], two [s][], three [s].\n\n[s]: b.md#Sec\n";
		const output = parse(content);

		expect(output.linkReferences).toEqual([
			{
				identifier: "s",
				referenceType: "full",
				text: "b",
				raw: "[b][s]",
				line: 1,
				column: 4,
				start: 4,
				end: 10,
			},
			{
				identifier: "s",
				referenceType: "collapsed",
				text: "s",
				raw: "[s][]",
				line: 1,
				column: 16,
				start: 16,
				end: 21,
			},
			{
				identifier: "s",
				referenceType: "shortcut",
				text: "s",
				raw: "[s]",
				line: 1,
				column: 29,
				start: 29,
				end: 32,
			},
		]);
	});

	it("has no usages for an unused definition or a reference inside a code span", () => {
		expect(parse("[s]: b.md\n").linkReferences).toEqual([]);
		expect(parse("Code `[b][s]` here.\n\n[s]: b.md\n").linkReferences).toEqual(
			[],
		);
	});
});
