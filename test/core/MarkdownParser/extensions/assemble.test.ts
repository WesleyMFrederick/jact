import { fromMarkdown } from "mdast-util-from-markdown";
import { visitParents } from "unist-util-visit-parents";
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
	visitParents(parseWithAll(md), (node) => {
		found.add(node.type);
	});
	return found;
}

describe("assemble — combined Obsidian-style extension set", () => {
	it("parses custom syntaxes together without confusing wiki embeds with links", () => {
		const md =
			"A ==highlight==, a %%comment%%, a [cite: docs/spec.md], a [[Page#sec|Alias]], a ![[img/p.png]], a [t](file.md#a b c), and ^block-ref-1.";
		const types = typesIn(md);
		expect(types.has("highlight")).toBe(true);
		expect(types.has("obsidianComment")).toBe(true);
		expect(types.has("citation")).toBe(true);
		expect(types.has("caretAnchor")).toBe(true);
		expect(types.has("wikilink")).toBe(true);
		expect(types.has("obsidianLink")).toBe(true);
		expect(types.has("obsidianEmbed")).toBe(true);
	});

	it("leaves standard markdown links intact alongside custom syntaxes", () => {
		let links = 0;
		visitParents(parseWithAll("[text](file.md) plus ==hi=="), "link", () => {
			links += 1;
		});
		expect(links).toBe(1);
	});
});
