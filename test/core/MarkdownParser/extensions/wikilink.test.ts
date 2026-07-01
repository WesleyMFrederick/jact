import { fromMarkdown } from "mdast-util-from-markdown";
import { visit } from "unist-util-visit";
import { describe, expect, it } from "vitest";
import {
	wikilinkFromMarkdown,
	wikilinkSyntax,
} from "../../../../src/core/MarkdownParser/extensions/wikilink.js";

function parse(md: string) {
	return fromMarkdown(md, {
		extensions: [wikilinkSyntax],
		mdastExtensions: [wikilinkFromMarkdown],
	});
}

function collect(md: string) {
	const found: { value: string; span: [number, number] }[] = [];
	visit(parse(md), "wikilink", (node) => {
		// biome-ignore lint/suspicious/noExplicitAny: custom node
		const n = node as any;
		found.push({
			value: n.value,
			span: [n.position.start.offset, n.position.end.offset],
		});
	});
	return found;
}

describe("wikilink extension ([[target#anchor|alias]])", () => {
	// The 10 Obsidian forms previously matched by WIKI_REGEX.
	const forms: [string, string][] = [
		["[[Page]]", "Page"],
		["[[Page|Display]]", "Page|Display"],
		["[[Page.md]]", "Page.md"],
		["[[Page.md|Display]]", "Page.md|Display"],
		["[[Page#section]]", "Page#section"],
		["[[Page#section|Display]]", "Page#section|Display"],
		["[[Page.md#section]]", "Page.md#section"],
		["[[Page.md#section|Display]]", "Page.md#section|Display"],
		["[[#anchor]]", "#anchor"],
		["[[#anchor|Display]]", "#anchor|Display"],
	];

	for (const [input, value] of forms) {
		it(`tokenizes ${input} → inner "${value}"`, () => {
			const hits = collect(`See ${input} here.`);
			expect(hits).toHaveLength(1);
			expect(hits[0]?.value).toBe(value);
		});
	}

	it("spans the full [[...]] including brackets", () => {
		const hits = collect("[[Page]]");
		expect(hits[0]?.span).toEqual([0, 8]);
	});

	it("does not match a normal markdown link", () => {
		expect(collect("[text](file.md)")).toHaveLength(0);
	});

	it("does not match a single-bracket reference", () => {
		expect(collect("[ref]")).toHaveLength(0);
	});

	it("does not tokenize an empty wikilink [[]]", () => {
		expect(collect("[[]]")).toHaveLength(0);
	});

	// D4: micromark handles code context natively, so the hand-rolled
	// code-guard layer can retire.
	it("does not tokenize a wikilink inside an inline code span", () => {
		expect(collect("`[[Page]]`")).toHaveLength(0);
	});

	it("does not tokenize a wikilink inside a fenced code block", () => {
		expect(collect("```\n[[Page]]\n```\n")).toHaveLength(0);
	});

	it("captures multiple wikilinks on one line", () => {
		const hits = collect("[[A]] and [[B#x|C]]");
		expect(hits.map((h) => h.value)).toEqual(["A", "B#x|C"]);
	});
});
