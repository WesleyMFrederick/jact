import { fromMarkdown } from "mdast-util-from-markdown";
import { visit } from "unist-util-visit";
import { describe, expect, it } from "vitest";
import {
	highlightFromMarkdown,
	highlightSyntax,
} from "../../../../src/core/MarkdownParser/extensions/highlight.js";

function parse(md: string) {
	return fromMarkdown(md, {
		extensions: [highlightSyntax],
		mdastExtensions: [highlightFromMarkdown],
	});
}

function collectHighlights(md: string) {
	const tree = parse(md);
	const found: { value: string; offset: [number, number] }[] = [];
	visit(tree, "highlight", (node) => {
		// biome-ignore lint/suspicious/noExplicitAny: custom node
		const n = node as any;
		found.push({
			value: n.value,
			offset: [n.position.start.offset, n.position.end.offset],
		});
	});
	return found;
}

describe("highlight extension (==text==)", () => {
	it("captures the raw inner text of a highlight", () => {
		const hits = collectHighlights("A ==marked phrase== here.");
		expect(hits).toHaveLength(1);
		expect(hits[0]?.value).toBe("marked phrase");
	});

	it("exposes a 1-based position span covering the full ==...==", () => {
		const hits = collectHighlights("==hi==");
		expect(hits[0]?.offset).toEqual([0, 6]);
	});

	it("does not treat a single = as a highlight", () => {
		expect(collectHighlights("a = b")).toHaveLength(0);
	});

	it("tolerates a lone = inside the highlighted content", () => {
		const hits = collectHighlights("==a=b==");
		expect(hits).toHaveLength(1);
		expect(hits[0]?.value).toBe("a=b");
	});

	it("captures multiple highlights on one line", () => {
		const hits = collectHighlights("==one== and ==two==");
		expect(hits.map((h) => h.value)).toEqual(["one", "two"]);
	});
});
