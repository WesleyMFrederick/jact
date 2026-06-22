import { fromMarkdown } from "mdast-util-from-markdown";
import { visit } from "unist-util-visit";
import { describe, expect, it } from "vitest";
import {
	obsidianCommentFromMarkdown,
	obsidianCommentSyntax,
} from "../../../../src/core/MarkdownParser/extensions/obsidianComment.js";

function collect(md: string) {
	const tree = fromMarkdown(md, {
		extensions: [obsidianCommentSyntax],
		mdastExtensions: [obsidianCommentFromMarkdown],
	});
	const found: { value: string; span: [number, number] }[] = [];
	visit(tree, "obsidianComment", (node) => {
		// biome-ignore lint/suspicious/noExplicitAny: custom node
		const n = node as any;
		found.push({
			value: n.value,
			span: [n.position.start.offset, n.position.end.offset],
		});
	});
	return found;
}

describe("obsidianComment extension (%%text%%)", () => {
	it("captures the raw inner text of a comment", () => {
		const hits = collect("before %%a hidden note%% after");
		expect(hits).toHaveLength(1);
		expect(hits[0]?.value).toBe("a hidden note");
	});

	it("spans the full %%...%%", () => {
		const hits = collect("%%x%%");
		expect(hits[0]?.span).toEqual([0, 5]);
	});

	it("ignores a single percent sign", () => {
		expect(collect("100% done")).toHaveLength(0);
	});
});
