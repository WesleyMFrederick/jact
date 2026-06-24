import { fromMarkdown } from "mdast-util-from-markdown";
import { visit } from "unist-util-visit";
import { describe, expect, it } from "vitest";
import {
	jactMdastExtensions,
	jactSyntaxExtension,
} from "../../../../src/core/MarkdownParser/extensions/assemble.js";

function parseWithAll(md: string) {
	return fromMarkdown(md, {
		extensions: [jactSyntaxExtension()],
		mdastExtensions: jactMdastExtensions(),
	});
}

function typesIn(md: string) {
	const found = new Set<string>();
	visit(parseWithAll(md), (node) => {
		found.add(node.type);
	});
	return found;
}

describe("assemble — combined Obsidian-style extension set", () => {
	it("returns one combined syntax extension and five fromMarkdown extensions", () => {
		expect(jactSyntaxExtension()).toBeTypeOf("object");
		expect(jactMdastExtensions()).toHaveLength(5);
	});

	it("parses all five custom syntaxes in a single document", () => {
		const md =
			"A ==highlight==, a %%comment%%, a [cite: docs/spec.md], a [[Page#sec|Alias]], and ^block-ref-1.";
		const types = typesIn(md);
		expect(types.has("highlight")).toBe(true);
		expect(types.has("obsidianComment")).toBe(true);
		expect(types.has("citation")).toBe(true);
		expect(types.has("caretAnchor")).toBe(true);
		expect(types.has("wikilink")).toBe(true);
	});

	it("leaves standard markdown links intact alongside custom syntaxes", () => {
		let links = 0;
		visit(parseWithAll("[text](file.md) plus ==hi=="), "link", () => {
			links += 1;
		});
		expect(links).toBe(1);
	});
});
